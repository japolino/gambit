/**
 * Which lorebook entries the Card Reader reads, and how much of each.
 *
 * A big lorebook does not fit the read. Entries are ranked by what matters
 * to this chat: active in the chat right now (the host's own keyword and
 * vector match), always-on, triggered by the chat, close to the chat in
 * meaning (lore-vectors.ts), triggered by the card or by the persona; then
 * the book's own order. The top entries are read in full,
 * the next ones as a short excerpt, and the rest are listed by name so the
 * reader still knows who and what exists. Pure: the backend fetches the
 * entries (backend/cards.ts gather).
 */

import type { CardSources, SourceLore } from "../engine/card/types.js";

const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n)}…` : s);

/** CJK and other scripts that don't put spaces between words. */
const NO_SPACES = /[぀-ヿ㐀-鿿가-힯]/;

const norm = (s: string): string => ` ${s.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, " ").trim()} `;

/** Usable trigger words: the keys and the title, without regexes and one- or two-letter keys. */
export function loreKeys(l: SourceLore): string[] {
  const out = new Set<string>();
  for (const k of [l.title, ...(l.keys ?? [])]) {
    const t = k?.trim();
    if (!t || t === "entry" || /^\/.*\/[a-z]*$/i.test(t)) continue;
    if (t.length < 3 && !NO_SPACES.test(t)) continue;
    out.add(t);
  }
  return [...out];
}

/** How many of the keys a text mentions (whole words, or plain contains for CJK). */
export function hits(keys: readonly string[], text: string): number {
  if (!text) return 0;
  const low = norm(text);
  let n = 0;
  for (const k of keys) {
    const nk = norm(k);
    if (nk.trim().length && (NO_SPACES.test(k) ? low.includes(nk.trim()) : low.includes(nk))) n++;
  }
  return n;
}

/** What the closest entry in meaning adds to its rank: a little more than a key the chat names. */
export const SEMANTIC_WEIGHT = 35;

export interface RankedLore {
  lore: SourceLore;
  score: number;
  /** Position in the gathered list (book order), the tie-break. */
  at: number;
}

/** The entries, most relevant to this chat first. A global book's entry only counts when this chat uses it: the host has it active, or the chat names it. */
export function rankLore(src: CardSources): RankedLore[] {
  const card = src.cards.map((c) => [c.description, c.personality, c.scenario, c.firstMes, ...c.alternateGreetings.slice(0, 2)].join("\n")).join("\n");
  const persona = `${src.persona.name} ${src.persona.title} ${src.persona.description}`;
  const chat = src.chat.map((m) => m.content).join("\n");
  return src.lore
    .flatMap((lore, at) => {
      const keys = loreKeys(lore);
      const inChat = hits(keys, chat);
      if (lore.scope === "global" && !lore.active && !inChat) return [];
      let score = 0;
      if (lore.active) score += 100;
      if (lore.constant) score += 60;
      if (inChat) score += 30 + 5 * Math.min(3, inChat - 1);
      if (hits(keys, card)) score += 20;
      if (hits(keys, persona)) score += 10;
      // Close in meaning to the chat (the user's embedding model): ranks like a keyword hit, without the keyword.
      if (lore.semantic) score += Math.round(SEMANTIC_WEIGHT * lore.semantic);
      return [{ lore, score, at }];
    })
    .sort((a, b) => b.score - a.score || a.at - b.at);
}

/** Entry text cut at a sentence end near n characters. */
function excerpt(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "), cut.lastIndexOf("。"));
  return `${end > n * 0.5 ? cut.slice(0, end + 1) : cut}…`;
}

export const LORE_FULL = 1500;
export const LORE_BRIEF = 320;

/**
 * The lore part of the reader's sources, within `room` characters: about
 * two thirds read in full, then excerpts, then a list of the names left.
 */
export function loreText(src: CardSources, room: number): { text: string; full: number; brief: number; named: number } {
  const ranked = rankLore(src);
  const blocks: string[] = [];
  let used = 0;
  let full = 0;
  let brief = 0;
  const rest: RankedLore[] = [];
  for (const r of ranked) {
    const block = `[LORE: ${r.lore.title}]\n${clip(r.lore.content.trim(), LORE_FULL)}`;
    if (used + block.length + 2 <= room * 0.65) {
      blocks.push(block);
      used += block.length + 2;
      full++;
    } else rest.push(r);
  }
  const unnamed: RankedLore[] = [];
  for (const r of rest) {
    const block = `[LORE, EXCERPT: ${r.lore.title}]\n${excerpt(r.lore.content, LORE_BRIEF)}`;
    if (used + block.length + 2 <= room * 0.92) {
      blocks.push(block);
      used += block.length + 2;
      brief++;
    } else unnamed.push(r);
  }
  let named = 0;
  if (unnamed.length) {
    const head = "[ALSO IN THE LOREBOOK: entries not read here, by name]\n";
    const names: string[] = [];
    let len = head.length;
    for (const r of unnamed) {
      const keys = loreKeys(r.lore);
      const label = keys.length > 1 && !hits([keys[1]!], r.lore.title) ? `${keys[0]} (${keys.slice(1, 3).join(", ")})` : (keys[0] ?? r.lore.title);
      if (used + len + label.length + 2 > room) break;
      names.push(label);
      len += label.length + 2;
      named++;
    }
    if (names.length) blocks.push(head + names.join("; "));
  }
  return { text: blocks.join("\n\n"), full, brief, named };
}

/** The lorebook's own text about a name (a person or place the chat keeps mentioning), or "". */
export function loreAbout(lore: readonly SourceLore[], name: string, max = LORE_FULL): string {
  const want = norm(name).trim();
  if (!want) return "";
  const first = want.split(" ")[0] ?? "";
  let best: { l: SourceLore; s: number } | null = null;
  for (const l of lore) {
    let s = 0;
    for (const k of loreKeys(l)) {
      const nk = norm(k).trim();
      if (nk === want) s = Math.max(s, 3);
      else if (first.length > 3 && nk.split(" ")[0] === first) s = Math.max(s, 2);
      else if (nk.length > 3 && ` ${want} `.includes(` ${nk} `)) s = Math.max(s, 1);
    }
    if (s && (!best || s > best.s)) best = { l, s };
  }
  return best ? clip(best.l.content.trim(), max) : "";
}
