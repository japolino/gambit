/**
 * Stable, dependency-free hashing for the art cache and for deterministic
 * seeds. Pure: runs the same in the backend worker, the browser and tests.
 */

/** cyrb53 (public domain): a fast 53-bit string hash. */
function cyrb53(text: string, seed: number): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** JSON with sorted object keys, so equal values always serialize the same. */
export function stableStringify(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).filter((k) => record[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(",")}}`;
}

/** About 106 bits as 28 hex characters: two cyrb53 runs with different seeds. */
export function stableHash(value: unknown): string {
  const text = typeof value === "string" ? value : stableStringify(value);
  const a = cyrb53(text, 0x9e3779b9).toString(16).padStart(14, "0");
  const b = cyrb53(text, 0x85ebca6b).toString(16).padStart(14, "0");
  return a + b;
}

/** A seed in 0..2^32-1 from any text (NovelAI accepts uint32 seeds; GPT ignores seeds). */
export function seed32(text: string): number {
  return cyrb53(text, 0x27d4eb2f) % 4294967296;
}
