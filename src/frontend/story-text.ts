/**
 * Story text as the chat shows it, for every box the game writes into: light markdown (*italic*, **bold**,
 * ***both***, _x_, __x__) and dialogue in quotes, coloured per speaker. One renderer for every theme; the
 * themes only set the colours (STORY_CSS's variables).
 *
 * Who speaks a quote, in order:
 *  1. A tag after it, when the quote doesn't end its sentence ("Fine," she says / "Run!" Rook snaps): the first
 *     name or pronoun after the closing mark, up to the end of that sentence.
 *  2. Else the subject of the nearest sentence before it in the same paragraph: its first name or pronoun. A quote
 *     with no one named since the last quote carries that quote's speaker on. A paragraph that opens on speech looks
 *     at the narration that ends the paragraph before.
 *  3. Else the box's own speaker (`speaker`): the NPC in a Parley, the player in their own line.
 * A pronoun means the nearest person named before it with that pronoun, else the box's speaker when theirs matches,
 * else the only one here it fits. "I" and "you" are the player. Names and pronouns inside quotes are words spoken,
 * not who speaks. Anything left unresolved is plain dialogue, coloured but no one's.
 */

import type { Voices } from "../shared/scene-view.js";

export type { Voices };
type Pronoun = Voices["cast"][number]["pronoun"];

export interface StoryOpts {
  voices?: Voices;
  /** Who speaks a quote nobody is named for: a cast name, or "you". */
  speaker?: string;
  /** Draw the quote marks curly (book faces). */
  curly?: boolean;
  /** The text is still arriving: a marker not closed yet runs to the end instead of showing. */
  streaming?: boolean;
}

/** The speaker colours a theme sets: --q1 .. --q6 by cast order, --q-you for the player, --q for anyone else. */
export const SPEAKER_COLOURS = 6;

/** Who speaks: a cast index, "you" (the player), or null (no one this can tell). */
export type Who = number | "you" | null;

/** A piece of a paragraph with one look. `said`: inside the paragraph's quote number `n`, spoken by `who`. */
export interface Run {
  text: string;
  em: boolean;
  strong: boolean;
  said?: { n: number; who: Who };
}

const PUNCT = /[\p{P}\p{S}]/u;
const SPACE = /\s/u;

/** The paragraph without its markers, and the emphasis on each character left. */
function emphasis(s: string, streaming: boolean): { text: string; em: boolean[]; strong: boolean[] } {
  type Delim = { ch: string; start: number; end: number; open: boolean; close: boolean; left: number; right: number };
  const hidden = new Uint8Array(s.length);
  const emD = new Int16Array(s.length + 1);
  const strongD = new Int16Array(s.length + 1);
  const delims: Delim[] = [];
  for (let i = 0; i < s.length; ) {
    const ch = s[i]!;
    if (ch !== "*" && ch !== "_") {
      i++;
      continue;
    }
    let j = i;
    while (s[j] === ch) j++;
    const b = s[i - 1] ?? " ";
    const a = s[j] ?? " ";
    const leftFl = !SPACE.test(a) && (!PUNCT.test(a) || SPACE.test(b) || PUNCT.test(b));
    const rightFl = !SPACE.test(b) && (!PUNCT.test(b) || SPACE.test(a) || PUNCT.test(a));
    // An underscore inside a word (snake_case) is a letter.
    const open = ch === "*" ? leftFl : leftFl && (!rightFl || PUNCT.test(b));
    const close = ch === "*" ? rightFl : rightFl && (!leftFl || PUNCT.test(a));
    delims.push({ ch, start: i, end: j, open, close, left: i, right: j });
    i = j;
  }
  const stack: Delim[] = [];
  for (const d of delims) {
    if (d.close) {
      for (let k = stack.length - 1; k >= 0 && d.left < d.right; k--) {
        const o = stack[k]!;
        if (o.ch !== d.ch || o.left >= o.right) continue;
        const use = o.right - o.left >= 2 && d.right - d.left >= 2 ? 2 : 1;
        o.right -= use;
        for (let x = o.right; x < o.right + use; x++) hidden[x] = 1;
        for (let x = d.left; x < d.left + use; x++) hidden[x] = 1;
        const D = use === 2 ? strongD : emD;
        D[o.right + use]!++;
        D[d.left]!--;
        d.left += use;
        stack.splice(k + 1);
        if (o.left < o.right) k++;
        else stack.splice(k, 1);
      }
    }
    if (d.open && d.left < d.right) stack.push(d);
  }
  if (streaming) {
    // Not closed yet: hide the marker and let what follows wear it, so the line doesn't jump when the close arrives.
    for (const o of stack) {
      if (o.left >= o.right) continue;
      const n = o.right - o.left;
      for (let x = o.left; x < o.right; x++) hidden[x] = 1;
      if (n !== 2) emD[o.right]!++;
      if (n >= 2) strongD[o.right]!++;
    }
    // A run of markers the text ends on may be half of one.
    const last = delims.at(-1);
    if (last && last.end === s.length) for (let x = last.left; x < last.right; x++) hidden[x] = 1;
  }
  let text = "";
  const em: boolean[] = [];
  const strong: boolean[] = [];
  let e = 0;
  let st = 0;
  for (let i = 0; i < s.length; i++) {
    e += emD[i]!;
    st += strongD[i]!;
    if (hidden[i]) continue;
    text += s[i];
    em.push(e > 0);
    strong.push(st > 0);
  }
  return { text, em, strong };
}

interface Quote {
  /** Opening mark, and one past the closing mark (or the paragraph's end when it never closes). */
  start: number;
  end: number;
  closed: boolean;
  who: Who;
}

/** Spoken words: from an opening quote mark to its close (or the paragraph's end). Straight quotes alternate. */
function quotes(t: string): Quote[] {
  const out: Quote[] = [];
  let open = -1;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (open < 0 && (c === "\u201c" || c === '"')) open = i;
    else if (open >= 0 && (c === "\u201d" || c === '"')) {
      out.push({ start: open, end: i + 1, closed: true, who: null });
      open = -1;
    }
  }
  if (open >= 0) out.push({ start: open, end: t.length, closed: false, who: null });
  return out;
}

interface Ref {
  /** Position in the whole text. */
  at: number;
  who: Who | Pronoun;
}

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Names (whole, or any word of one no one else shares), the pronouns, and the player's "I" and "you". */
function namer(v: Voices): (s: string, offset: number) => Ref[] {
  const people: { name: string; who: number | "you" }[] = v.cast.map((c, i) => ({ name: c.name, who: i }));
  if (v.player) people.push({ name: v.player, who: "you" });
  const words = new Map<string, (number | "you")[]>();
  for (const p of people)
    for (const w of new Set([p.name, ...p.name.split(/[\s-]+/)])) if (w.length > 1 && /^\p{Lu}/u.test(w)) words.set(w, [...(words.get(w) ?? []), p.who]);
  const own = new Map([...words].filter(([, w]) => new Set(w).size === 1).map(([k, w]) => [k, w[0]!]));
  const names = [...own.keys()].sort((a, b) => b.length - a.length).map(escRe);
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${[...names, "[Ss]he", "[Hh]e", "[Tt]hey", "[Yy]ou", "I"].join("|")})(?![\\p{L}\\p{N}])`, "gu");
  return (s, offset) =>
    [...s.matchAll(re)].map((m) => {
      const w = m[1]!;
      const who: Ref["who"] = own.has(w) ? own.get(w)! : w === "I" || /^you$/i.test(w) ? "you" : (w.toLowerCase() as Pronoun);
      return { at: offset + m.index!, who };
    });
}

/** Paragraphs of runs. Paragraphs are split at line breaks. */
export function storyRuns(text: string, o: StoryOpts = {}): Run[][] {
  const v = o.voices ?? { cast: [], player: "" };
  const find = namer(v);
  const fallback: Who = o.speaker === undefined ? null : o.speaker === "you" ? "you" : v.cast.findIndex((c) => c.name === o.speaker);
  const fallbackWho: Who = fallback === -1 ? null : fallback;
  const paras = text
    .split(/\n+/)
    .filter((p) => p.trim())
    .map((p, i, all) => emphasis(p, !!o.streaming && i === all.length - 1));
  // Every name and pronoun said outside quotes, through the whole text: what a pronoun looks back on.
  let offset = 0;
  const laid = paras.map((p) => {
    const qs = quotes(p.text);
    const refs: Ref[] = [];
    let from = 0;
    for (const q of [...qs, { start: p.text.length, end: p.text.length }]) {
      refs.push(...find(p.text.slice(from, q.start), offset + from));
      from = q.end;
    }
    const at = offset;
    offset += p.text.length + 1;
    return { ...p, qs, refs, at };
  });
  const mentions = laid.flatMap((p) => p.refs.filter((r) => typeof r.who === "number"));
  const resolve = (r: Ref): Who => {
    if (typeof r.who !== "string" || r.who === "you") return r.who;
    const p = r.who;
    const named = mentions.findLast((m) => m.at < r.at && v.cast[m.who as number]?.pronoun === p);
    if (named) return named.who as number;
    if (typeof fallbackWho === "number" && v.cast[fallbackWho]?.pronoun === p) return fallbackWho;
    const here = v.cast.flatMap((c, i) => (c.here && c.pronoun === p ? [i] : []));
    return here.length === 1 ? here[0]! : null;
  };
  const first = (p: (typeof laid)[number], from: number, to: number): Ref | undefined => p.refs.find((r) => r.at >= p.at + from && r.at < p.at + to);

  /** The subject of the nearest sentence in a stretch of narration: the first name or pronoun of the last sentence that has one. */
  const subject = (p: (typeof laid)[number], from: number, to: number): Ref | undefined => {
    const piece = p.text.slice(from, to);
    const cuts = [0, ...[...piece.matchAll(/[.!?\u2026]+\s+/g)].map((m) => m.index! + m[0].length)];
    for (let c = cuts.length - 1; c >= 0; c--) {
      const ref = first(p, from + cuts[c]!, from + (cuts[c + 1] ?? piece.length));
      if (ref) return ref;
    }
  };

  laid.forEach((p, pi) => {
    p.qs.forEach((q, qi) => {
      const t = p.text;
      // 1. A tag after a quote that runs on into it.
      const inner = t.slice(q.start + 1, q.closed ? q.end - 1 : q.end).trimEnd();
      if (q.closed && !(inner.endsWith(".") && !inner.endsWith(".."))) {
        const stop = p.qs[qi + 1]?.start ?? t.length;
        const end = t.slice(q.end, stop).search(/[.!?\u2026]/);
        const ref = first(p, q.end, end < 0 ? stop : q.end + end + 1);
        if (ref) return void (q.who = resolve(ref));
      }
      // 2. The subject of the sentence before it, back to the last quote.
      let to = q.start;
      for (let k = qi - 1; k >= -1; k--) {
        const ref = subject(p, k >= 0 ? p.qs[k]!.end : 0, to);
        if (ref) return void (q.who = resolve(ref));
        if (k >= 0 && p.qs[k]!.who !== null) return void (q.who = p.qs[k]!.who);
        to = k >= 0 ? p.qs[k]!.start : 0;
      }
      // A paragraph that opens on speech follows the narration that ends the one before.
      const prev = laid[pi - 1];
      if (prev && !t.slice(0, q.start).trim()) {
        const ref = subject(prev, prev.qs.at(-1)?.end ?? 0, prev.text.length);
        if (ref) return void (q.who = resolve(ref));
      }
      // 3. The box's own speaker.
      q.who = fallbackWho;
    });
  });

  return laid.map((p) => {
    const runs: Run[] = [];
    for (let i = 0; i < p.text.length; i++) {
      const n = p.qs.findIndex((q) => i >= q.start && i < q.end);
      const q = p.qs[n];
      let ch = p.text[i]!;
      if (o.curly && q && (i === q.start || (q.closed && i === q.end - 1))) ch = i === q.start ? "\u201c" : "\u201d";
      const prev = runs.at(-1);
      if (prev && prev.em === p.em[i] && prev.strong === p.strong[i] && (prev.said?.n ?? -1) === n) prev.text += ch;
      else runs.push({ text: ch, em: p.em[i]!, strong: p.strong[i]!, ...(q ? { said: { n, who: q.who } } : {}) });
    }
    return runs;
  });
}

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The class a quote wears: q (no one's), q v1..v6 (cast, cycling), q vy (the player). */
export const quoteClass = (who: Who): string => (who === null ? "q" : who === "you" ? "q vy" : `q v${(who % SPEAKER_COLOURS) + 1}`);

/** Paragraphs as inline HTML (escaped; the only tags are em, strong and span.q), for the caller's own <p>s. */
export function storyHtml(text: string, o: StoryOpts = {}): string[] {
  return storyRuns(text, o).map((runs) => {
    let html = "";
    runs.forEach((r, i) => {
      const n = r.said?.n ?? -1;
      const before = runs[i - 1]?.said?.n ?? -1;
      if (before >= 0 && before !== n) html += "</span>";
      if (r.said && before !== n) html += `<span class="${quoteClass(r.said.who)}">`;
      let t = esc(r.text);
      if (r.em) t = `<em>${t}</em>`;
      if (r.strong) t = `<strong>${t}</strong>`;
      html += t;
    });
    return runs.at(-1)?.said ? `${html}</span>` : html;
  });
}

/** A theme's speaker colours as the custom properties STORY_CSS reads: anyone's dialogue, the player's, then the cast's. */
export const speakerVars = (anyone: string, you: string, cast: readonly string[]): string =>
  [`--q: ${anyone};`, `--q-you: ${you};`, ...cast.slice(0, SPEAKER_COLOURS).map((c, i) => `--q${i + 1}: ${c};`)].join(" ");

/** The look of the classes storyHtml writes; each theme sets the colours on the box's container (speakerVars). Inside a quote the speaker's colour wins over a theme's colour for italics. */
export const STORY_CSS = `
.q { color: var(--q, inherit); }
${Array.from({ length: SPEAKER_COLOURS }, (_, i) => `.q.v${i + 1} { color: var(--q${i + 1}, var(--q, inherit)); }`).join("\n")}
.q.vy { color: var(--q-you, var(--q, inherit)); }
.q em, .q strong { color: inherit !important; }
`;
