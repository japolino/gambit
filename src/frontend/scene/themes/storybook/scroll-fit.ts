/** Gambit Cinzel 800 capitals' widths in em, its .16em letter-spacing included. */
const EM: Record<string, number> = {
  A: 0.88, B: 0.86, C: 0.95, D: 0.98, E: 0.81, F: 0.77, G: 1.01, H: 1.04, I: 0.56, J: 0.56, K: 0.95, L: 0.79, M: 1.12,
  N: 1.02, O: 1.06, P: 0.84, Q: 1.07, R: 0.92, S: 0.77, T: 0.86, U: 0.99, V: 0.91, W: 1.14, X: 0.91, Y: 0.88, Z: 0.82,
  " ": 0.41, ".": 0.4, ",": 0.4, "'": 0.37, "-": 0.54,
};
const em = (s: string) => [...s.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase()].reduce((n, c) => n + (EM[c] ?? 0.85), 0);

/** The scroll's curve is about 146 units long and cuts off whatever runs past its ends. */
const CURVE = 146;
/** Below this the scroll's capitals are too small to read. */
const LEAST = 9;

/**
 * The name to print on the scroll and its size: the whole name, shrunk to fit;
 * a name that would get too small loses words from its end ("Captain Hollis
 * Ashworth" gives "Captain Hollis"), never ending on a small word like "of".
 */
export function fitScroll(name: string): { label: string; size: number } {
  const words = name.trim().split(/\s+/);
  const sized = (label: string) => ({ label, size: Math.min(15, Math.floor((CURVE / Math.max(1, em(label))) * 10) / 10) });
  for (let n = words.length; n > 1; n--) {
    if (!/^\p{Lu}/u.test(words[n - 1]!)) continue;
    const s = sized(words.slice(0, n).join(" "));
    if (s.size >= LEAST) return s;
  }
  return sized(words[0]!);
}
