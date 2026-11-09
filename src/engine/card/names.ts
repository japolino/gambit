/**
 * Matching people by name across a card, its lorebook, its image assets,
 * and the user's library ("Corvin" / "Prince Corvin" / "Tomas_Reyne").
 */

/** Lowercase, Latin accents dropped, every other script kept whole: "Café" -> "cafe", "레퍼리드" stays. */
export const fold = (s: string): string => s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").normalize("NFC");

export const normName = (s: string): string =>
  fold(s)
    .replace(/[_.]+/g, " ")
    .replace(/[^\p{L}\p{M}\p{N}' ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const TITLES = new Set(["the", "of", "lord", "lady", "sir", "dame", "prince", "princess", "king", "queen", "duke", "duchess", "count", "countess", "baron", "baroness", "mr", "mrs", "ms", "miss", "dr", "doctor", "captain", "sergeant", "master", "mistress", "father", "mother", "sister", "brother"]);

export const nameWords = (s: string): string[] => normName(s).split(" ").filter((w) => w && !TITLES.has(w));

/** Same person, named two ways: every word of the shorter name is in the longer ("Corvin" / "Prince Corvin"), titles ignored. */
export function sameName(a: string, b: string): boolean {
  const x = nameWords(a);
  const y = nameWords(b);
  if (!x.length || !y.length) return normName(a) === normName(b) && !!normName(a);
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.every((w) => long.includes(w));
}

/**
 * The one candidate that is this person: an exact name first, else the only
 * loose match. Several loose matches ("Ryuzu" against five Ryuzus) are no match.
 */
export function bestNameMatch<T>(name: string, items: readonly T[], nameOf: (item: T) => string): T | null {
  const exact = items.filter((i) => normName(nameOf(i)) === normName(name));
  if (exact.length) return exact[0]!;
  const loose = items.filter((i) => sameName(nameOf(i), name));
  return loose.length === 1 ? loose[0]! : null;
}
