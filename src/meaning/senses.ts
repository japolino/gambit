/**
 * Cheap classifiers for play (docs/DESIGN.md 9): the questions a Decision
 * model is asked, how its answers are read, and the code rules used when
 * there is no Decision model or it does not answer. Pure: the backend
 * (backend/senses.ts) asks and passes the answers in.
 *
 *   places      indoor / rest / shop / danger / delve, once per place
 *   notice      which names the player's line really mentions
 *   facts       which of the card's hidden facts came up in the chat
 *   quests      which quest steps the chat just accomplished
 *   reactions   how each companion feels about what the party just did
 *   recall      which memories are worth repeating before a reply
 *
 * Question ids are short and positional (`place_0_indoor`, `fact_2`) so a
 * name never has to be a JSON key.
 */
import type { DecisionAnswer, DecisionQuestion } from "lumiverse-spindle-types";
import type { Deed } from "../engine/memory/memory.js";
import type { PlaceTraits } from "../engine/world/places.js";

export type Answers = Record<string, DecisionAnswer | undefined>;
type Questions = Record<string, DecisionQuestion>;

/** Probability of a yes/no answer, or null when it is missing. */
export function yes(a: DecisionAnswer | undefined): number | null {
  if (!a) return null;
  if (a.type === "noul") return Number.isFinite(a.noul) ? Math.max(0, Math.min(1, a.noul)) : null;
  if (a.type === "choice") {
    const p = a.probabilities as Record<string, number>;
    if (typeof p?.yes === "number") return p.yes;
    return a.choice === "yes" ? (a.confidence ?? 1) : a.choice === "no" ? 1 - (a.confidence ?? 1) : null;
  }
  return null;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/* -------------------------------- places ------------------------------- */

export const PLACE_TRAITS: readonly (keyof PlaceTraits)[] = ["indoor", "rest", "shop", "danger", "delve"];
/** Places per request: five questions each. */
export const PLACES_PER_ASK = 6;

const TRAIT_Q: Record<keyof PlaceTraits, (n: string) => string> = {
  indoor: (n) => `Is ${n} indoors: inside a building, a room, or under a roof?`,
  rest: (n) => `Could the party safely rest or sleep the night at ${n}?`,
  shop: (n) => `Can things be bought or traded at ${n}, as at a shop, market, bar, or merchant?`,
  danger: (n) => `Is ${n} dangerous: could a fight with hostile creatures or people plausibly break out there?`,
  delve: (n) => `Is ${n} a place to explore room by room, like a dungeon, cave, ruin, wreck, vault, or tunnels?`,
};

export function placeState(setting: string, places: readonly { name: string; description: string }[]): Record<string, unknown> {
  return { setting: clip(setting, 600), places: places.map((p, i) => ({ place: i, name: p.name, description: clip(p.description, 300) })) };
}

export function placeQuestions(places: readonly { name: string }[]): Questions {
  const q: Questions = {};
  places.forEach((p, i) => {
    for (const t of PLACE_TRAITS) q[`place_${i}_${t}`] = { type: "noul", instructions: TRAIT_Q[t](`place ${i} ("${clip(p.name, 60)}")`) };
  });
  return q;
}

/** Traits per place id; a place with any trait unanswered is left out (it keeps its code flags). */
export function placeTraits(answers: Answers, places: readonly { id: string }[]): Record<string, PlaceTraits> {
  const out: Record<string, PlaceTraits> = {};
  places.forEach((p, i) => {
    const t: Partial<PlaceTraits> = {};
    for (const k of PLACE_TRAITS) {
      const v = yes(answers[`place_${i}_${k}`]);
      if (v === null) return;
      t[k] = v >= 0.5;
    }
    out[p.id] = t as PlaceTraits;
  });
  return out;
}

/* -------------------------------- notice ------------------------------- */

export interface NoticeCandidate {
  /** `cast:<id>`, `place:<id>`, or `name:<Name>`. */
  key: string;
  name: string;
}

/** At most this many names are checked per line. */
export const NOTICE_MAX = 12;

const tokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter((w) => w.length > 3);
const stem = (w: string) => w.replace(/'s$/, "").replace(/(es|s)$/, "");

/**
 * The names worth asking about: what the code rule found (`mentions`), plus
 * known names the rule missed but whose words appear in the line in another
 * form ("Mira's", "the Docks").
 */
export function noticeCandidates(line: string, known: readonly NoticeCandidate[], found: readonly string[]): NoticeCandidate[] {
  const out: NoticeCandidate[] = [];
  const seen = new Set<string>();
  const add = (c: NoticeCandidate) => {
    if (!seen.has(c.key) && out.length < NOTICE_MAX) {
      seen.add(c.key);
      out.push(c);
    }
  };
  for (const k of found) add(known.find((x) => x.key === k) ?? { key: k, name: k.startsWith("name:") ? k.slice(5) : k });
  const words = new Set(tokens(line).map(stem));
  for (const k of known) if (tokens(k.name.replace(/^the\s+/i, "")).some((w) => words.has(stem(w)))) add(k);
  return out;
}

export function noticeQuestions(candidates: readonly NoticeCandidate[]): Questions {
  const q: Questions = {};
  candidates.forEach((c, i) => {
    q[`seen_${i}`] = c.key.startsWith("name:")
      ? { type: "noul", instructions: `In the player's line, is "${clip(c.name, 60)}" the name of a specific person, group, or place in the story (not an ordinary word, an exclamation, or the player's own name)?` }
      : { type: "noul", instructions: `Does the player's line mention ${c.key.startsWith("place:") ? "the place" : ""} "${clip(c.name, 60)}", by name, nickname, or title?`.replace(/\s+/g, " ") };
  });
  return q;
}

/** The keys the model confirmed. An unanswered candidate keeps the code rule's verdict. */
export function noticeFromAnswers(answers: Answers, candidates: readonly NoticeCandidate[], found: readonly string[]): string[] {
  return candidates.filter((c, i) => {
    const p = yes(answers[`seen_${i}`]);
    return p === null ? found.includes(c.key) : p >= 0.5;
  }).map((c) => c.key);
}

/* --------------------------------- facts ------------------------------- */

export interface FactLike {
  id: string;
  text: string;
  keywords?: string[][];
}

/** Hidden facts checked per reply at most, and the cosine a fact needs to be a candidate. */
export const FACTS_MAX = 6;
export const FACT_NEAR = 0.5;
/** Without a Decision model: the cosine that alone counts as "it came up". */
export const FACT_SURE = 0.8;

/** Each fact's best cosine with any chat line (null where a vector is missing). */
export function bestSims(factVecs: readonly (readonly number[] | null)[], lineVecs: readonly (readonly number[] | null)[], cos: (a: readonly number[], b: readonly number[]) => number): (number | null)[] {
  return factVecs.map((f) => {
    if (!f) return null;
    let best: number | null = null;
    for (const l of lineVecs) if (l) best = Math.max(best ?? -1, cos(f, l));
    return best;
  });
}

/**
 * Facts worth asking about: by meaning when there are vectors (closest
 * first, above FACT_NEAR), else those whose rule words appear in the chat.
 */
export function factCandidates<F extends FactLike>(facts: readonly F[], sims: readonly (number | null)[] | null, lines: readonly string[]): F[] {
  if (sims) {
    return facts
      .map((f, i) => [f, sims[i] ?? -1] as const)
      .filter(([, s]) => s >= FACT_NEAR)
      .sort((a, b) => b[1] - a[1])
      .slice(0, FACTS_MAX)
      .map(([f]) => f);
  }
  return facts.filter((f) => keywordHit(f, lines, 1)).slice(0, FACTS_MAX);
}

/** A fact's rule words: some group with at least `minWords` words all appears in one line. */
export function keywordHit(f: FactLike, lines: readonly string[], minWords = 2): boolean {
  const groups = (f.keywords ?? []).filter((g) => g.length >= minWords && g.every((w) => w.trim()));
  if (!groups.length) return false;
  return lines.some((l) => {
    const low = ` ${l.toLowerCase().replace(/[^a-z0-9' ]+/g, " ")} `;
    return groups.some((g) => g.every((w) => low.includes(` ${w.toLowerCase().trim()}`)));
  });
}

export function factQuestions(facts: readonly FactLike[]): Questions {
  const q: Questions = {};
  facts.forEach((f, i) => (q[`fact_${i}`] = { type: "noul", instructions: `Did the recent chat reveal, state, or clearly show this: "${clip(f.text, 240)}"?` }));
  return q;
}

/**
 * Which candidates came up. With answers: a confident yes. Without: a very
 * close meaning (FACT_SURE), or, without vectors either, a multi-word rule
 * match (a single word is too easy to hit by chance).
 */
export function factsSeen<F extends FactLike>(candidates: readonly F[], answers: Answers | null, sims: ReadonlyMap<string, number> | null, lines: readonly string[]): string[] {
  return candidates
    .filter((f, i) => {
      const p = answers ? yes(answers[`fact_${i}`]) : null;
      if (p !== null) return p >= 0.7;
      if (sims) return (sims.get(f.id) ?? 0) >= FACT_SURE;
      return keywordHit(f, lines, 2);
    })
    .map((f) => f.id);
}

/* --------------------------------- quests ------------------------------ */

export interface StepLike {
  /** The promotion's key. */
  key: string;
  text: string;
  who: string;
}

export function questQuestions(steps: readonly StepLike[]): Questions {
  const q: Questions = {};
  steps.forEach((s, i) => (q[`quest_${i}`] = { type: "noul", instructions: `Did the recent chat just accomplish this step of ${clip(s.who, 60)}'s thread: "${clip(s.text, 200)}"?` }));
  return q;
}

/** Steps the chat accomplished (a confident yes only; the place-search rule still completes the rest). */
export function questsDone(answers: Answers | null, steps: readonly StepLike[]): string[] {
  if (!answers) return [];
  return steps.filter((_, i) => (yes(answers[`quest_${i}`]) ?? 0) >= 0.75).map((s) => s.key);
}

/* ------------------------------- reactions ----------------------------- */

export interface CompanionLike {
  id: string;
  name: string;
  role?: string;
  warmth: number;
  wants?: string[];
  fears?: string[];
}

/** Deeds a companion could feel something about (the rest are bookkeeping). */
export const moralDeeds = (deeds: readonly Deed[]) => deeds.filter((d) => d.kind === "killed" || d.kind === "spared" || d.kind === "recruited" || d.kind === "bargained");

const deedLine = (d: Deed): string => {
  const n = d.n && d.n > 1 ? `${d.n} ` : "";
  switch (d.kind) {
    case "killed":
      return `The party killed ${n}${d.name}${d.method ? ` (mostly with ${d.method})` : ""}.`;
    case "spared":
      return `The party spared ${n}${d.name} when they yielded.`;
    case "recruited":
      return `The party took ${n}${d.name} into their ranks instead of killing them.`;
    case "bargained":
      return `The party struck a bargain with ${n}${d.name} mid-fight.`;
    default:
      return `${d.kind} ${d.name}.`;
  }
};

export function reactionState(companions: readonly CompanionLike[], deeds: readonly Deed[]): Record<string, unknown> {
  return {
    what_happened: moralDeeds(deeds).map(deedLine),
    companions: companions.map((c, i) => ({ companion: i, name: c.name, role: c.role ?? "", warmth: `${c.warmth} of 4`, wants: (c.wants ?? []).slice(0, 3), fears: (c.fears ?? []).slice(0, 3) })),
  };
}

export function reactionQuestions(companions: readonly CompanionLike[]): Questions {
  const q: Questions = {};
  companions.forEach((c, i) => {
    q[`react_${i}`] = {
      type: "choice",
      instructions: `How does companion ${i} (${clip(c.name, 60)}) feel about what the party just did?`,
      criteria: { approve: "Approves: it fits who they are.", indifferent: "Does not much care either way.", disapprove: "Disapproves: it goes against who they are." },
    };
  });
  return q;
}

/** -1, 0, or 1 per companion id; unanswered ones are left out (the warmth rule decides for them). */
export function reactionsFromAnswers(answers: Answers | null, companions: readonly CompanionLike[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (!answers) return out;
  companions.forEach((c, i) => {
    const a = answers[`react_${i}`];
    if (a?.type !== "choice") return;
    if ((a.confidence ?? 1) < 0.4) return;
    out[c.id] = a.choice === "approve" ? 1 : a.choice === "disapprove" ? -1 : 0;
  });
  return out;
}

/* --------------------------------- recall ------------------------------ */

/** Memories added before a reply at most, and the closeness they need. */
export const RECALL_MAX = 3;
export const RECALL_MIN = 0.35;

/**
 * Which memories the latest line is about: the closest few, each within
 * 0.12 of the best and above RECALL_MIN, so a line about nothing in
 * particular recalls nothing.
 */
export function recallPick(sims: readonly (number | null)[], max = RECALL_MAX): number[] {
  const scored = sims.map((s, i) => [i, s ?? -1] as const).filter(([, s]) => s >= RECALL_MIN);
  if (!scored.length) return [];
  const top = Math.max(...scored.map(([, s]) => s));
  return scored
    .filter(([, s]) => s >= top - 0.12)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([i]) => i);
}
