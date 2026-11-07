/**
 * Lorebook entries ranked by meaning, with the user's own embedding model
 * (backend/cards.ts semanticLore). Pure helpers: the entry hash that keys a
 * stored vector, an 8-bit pack that keeps a big lorebook's vectors small on
 * disk, cosine similarity, and the step from raw similarities to the 0..1
 * `semantic` score that meaning/lore-pick.ts adds to an entry's rank.
 */

/** A vector stored at 8 bits per dimension, with its scale. */
export interface PackedVec {
  scale: number;
  q: Int8Array;
}

/** Characters of an entry that are embedded: its opening says what it is about, and long CJK entries stay within a provider's per-request tokens. */
export const ENTRY_CHARS = 900;

/** The text an entry is embedded from: its title, keys and content, cut to what the model needs. */
export function entryText(e: { title: string; keys?: string[]; content: string }): string {
  const keys = (e.keys ?? []).filter((k) => k && k !== e.title).slice(0, 6);
  return `${e.title}${keys.length ? ` (${keys.join(", ")})` : ""}\n${e.content.replace(/\s+/g, " ").trim()}`.slice(0, ENTRY_CHARS);
}

/** 16 hex characters: two FNV-1a passes, enough to key a few thousand entries per book. */
export function textHash(s: string): string {
  let a = 2166136261;
  let b = 0x811c9dc5 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 16777619);
    b = Math.imul(b ^ c ^ (i & 0xff), 16777619);
  }
  return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
}

export function quantize(v: readonly number[]): PackedVec {
  let m = 0;
  for (const x of v) m = Math.max(m, Math.abs(x));
  const scale = m > 0 ? m / 127 : 1;
  const q = new Int8Array(v.length);
  for (let i = 0; i < v.length; i++) q[i] = Math.max(-127, Math.min(127, Math.round(v[i]! / scale)));
  return { scale, q };
}

/** Cosine between a full query vector and a packed entry vector (the scale cancels out). */
export function cosine(query: readonly number[], e: PackedVec): number {
  const n = Math.min(query.length, e.q.length);
  let dot = 0;
  let qq = 0;
  let ee = 0;
  for (let i = 0; i < n; i++) {
    const a = query[i]!;
    const b = e.q[i]!;
    dot += a * b;
    qq += a * a;
    ee += b * b;
  }
  return qq > 0 && ee > 0 ? dot / Math.sqrt(qq * ee) : 0;
}

const MAGIC = 0x31505647; // "GVP1"

/** One book's vectors as bytes: magic, count, dims, then per entry a 16-char hash, the scale and the 8-bit values. */
export function packVectors(map: ReadonlyMap<string, PackedVec>): Uint8Array {
  const dims = map.size ? [...map.values()][0]!.q.length : 0;
  const rows = [...map.entries()].filter(([h, v]) => h.length === 16 && v.q.length === dims);
  const size = 12 + rows.length * (16 + 4 + dims);
  const buf = new Uint8Array(size);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, MAGIC, true);
  dv.setUint32(4, rows.length, true);
  dv.setUint32(8, dims, true);
  let o = 12;
  for (const [h, v] of rows) {
    for (let i = 0; i < 16; i++) buf[o + i] = h.charCodeAt(i);
    dv.setFloat32(o + 16, v.scale, true);
    buf.set(new Uint8Array(v.q.buffer, v.q.byteOffset, dims), o + 20);
    o += 20 + dims;
  }
  return buf;
}

/** The vectors a pack holds; an unreadable or foreign file reads as empty. */
export function unpackVectors(buf: Uint8Array): Map<string, PackedVec> {
  const out = new Map<string, PackedVec>();
  if (buf.byteLength < 12) return out;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== MAGIC) return out;
  const count = dv.getUint32(4, true);
  const dims = dv.getUint32(8, true);
  if (12 + count * (20 + dims) > buf.byteLength) return out;
  let o = 12;
  for (let r = 0; r < count; r++) {
    const h = String.fromCharCode(...buf.subarray(o, o + 16));
    const scale = dv.getFloat32(o + 16, true);
    const q = new Int8Array(buf.slice(o + 20, o + 20 + dims).buffer);
    out.set(h, { scale, q });
    o += 20 + dims;
  }
  return out;
}

/**
 * Raw similarities to a 0..1 score per entry: anything at or below the
 * median scores 0, the best match 1, squared so only clear matches count.
 * When everything is about equally close (a flat spread), nothing scores.
 */
export function semanticScores(sims: readonly (number | null)[]): number[] {
  const known = sims.filter((s): s is number => s !== null).sort((a, b) => a - b);
  if (known.length < 3) return sims.map(() => 0);
  const median = known[Math.floor(known.length / 2)]!;
  const top = known[known.length - 1]!;
  if (top - median < 0.03) return sims.map(() => 0);
  return sims.map((s) => {
    if (s === null || s <= median) return 0;
    const t = (s - median) / (top - median);
    return Math.round(t * t * 1000) / 1000;
  });
}
