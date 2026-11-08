/**
 * Repetition check (4.1.2 step 5): how much an argument repeats an earlier
 * one in the same Parley. Pure word overlap, no model: word trigrams catch
 * a pasted speech, content-word sets catch the same point reworded lightly.
 */

const STOP = new Set(
  "a an the and or but so if then than to of in on at by for with from into onto about as is are was were be been being am i me my mine you your yours we us our he him his she her hers they them their it its this that these those there here what which who whom whose do does did not no yes just very too can could would should will shall may might must have has had".split(" "),
);

export function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** A rough stem, so "breaks", "breaking" and "break" count as one word. */
const stem = (w: string): string => w.replace(/(?:ing|ed|es|s)$/, (end, at: number) => (at >= 3 ? "" : end)).replace(/e$/, "");

/**
 * Does a line state this fact in its own words? Two of the fact's distinctive words are enough, in any form, leaving
 * out `ignore` (the name of whoever they're talking to, which says nothing about the fact).
 */
export function echoesFact(text: string, fact: string, ignore: string): boolean {
  const skip = new Set(words(ignore));
  const said = new Set(words(text).map(stem));
  const key = new Set(words(fact).filter((w) => w.length >= 4 && !STOP.has(w) && !skip.has(w)).map(stem));
  let shared = 0;
  for (const w of key) if (said.has(w)) shared++;
  return shared >= 2;
}

const jaccard = (a: Set<string>, b: Set<string>): number => {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const x of a) if (b.has(x)) shared++;
  return shared / (a.size + b.size - shared);
};

function trigrams(w: string[]): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + 2 < w.length; i++) out.add(`${w[i]} ${w[i + 1]} ${w[i + 2]}`);
  return out;
}

/** 0 (new) .. 1 (the same words). */
export function similarity(a: string, b: string): number {
  const wa = words(a);
  const wb = words(b);
  const tri = jaccard(trigrams(wa), trigrams(wb));
  const content = jaccard(new Set(wa.filter((w) => !STOP.has(w) && w.length > 2)), new Set(wb.filter((w) => !STOP.has(w) && w.length > 2)));
  return Math.max(tri, content * 0.9);
}

/** The strongest overlap with any earlier argument. */
export function repetition(text: string, earlier: readonly string[]): number {
  let max = 0;
  for (const e of earlier) max = Math.max(max, similarity(text, e));
  return max;
}

/**
 * Repetition by meaning: the closest earlier line's cosine (from the user's
 * embedding model, backend/referee-host.ts) as 0..1. Lines in one Parley all
 * share a topic, so only a near-paraphrase counts: at or below FLOOR is new,
 * CEIL and up is the same point again.
 */
export const MEANING_FLOOR = 0.86;
export const MEANING_CEIL = 0.97;
export function meaningRepetition(sims: readonly (number | null)[]): number {
  let max = -1;
  for (const s of sims) if (s !== null && Number.isFinite(s)) max = Math.max(max, s);
  if (max <= MEANING_FLOOR) return 0;
  return Math.min(1, (max - MEANING_FLOOR) / (MEANING_CEIL - MEANING_FLOOR));
}
