/**
 * Byte-level image helpers shared by the backend and the browser (no canvas,
 * no host imports): base64 conversion, the PNG size from its header, and
 * whether an encoded image can carry transparency at all.
 *
 * `encodedMayBeTransparent` is ported from Cue:
 *   repo visual-novel-preview, branch origin/testing @ ab0fa34
 *   (file last changed at 150abe7), src/frontend/sprites/cutout/index.ts
 *   `mayBeTransparent`, made to take bytes instead of a Blob.
 * `pngSize` follows Cue's cut-bridge `pngSize` (same branch).
 */

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_LOOKUP = (() => {
  const table = new Int16Array(128).fill(-1);
  for (let i = 0; i < B64.length; i++) table[B64.charCodeAt(i)] = i;
  return table;
})();

/** Base64 (no data-URL prefix) of some bytes. Pure JS so the worker needs neither Buffer nor btoa. */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + B64[(n >> 6) & 63]! + B64[n & 63]!;
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i]! << 16;
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + "==";
  } else if (rest === 2) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + B64[(n >> 6) & 63]! + "=";
  }
  return out;
}

/** Bytes of a base64 string (a `data:` prefix is accepted). Throws on invalid input. */
export function base64ToBytes(text: string): Uint8Array {
  const clean = text.replace(/^data:[^;,]*;base64,/, "").replace(/\s+/g, "");
  if (clean.length % 4 !== 0) throw new Error("Invalid base64 length.");
  const pad = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  const out = new Uint8Array((clean.length / 4) * 3 - pad);
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const v = [0, 1, 2, 3].map((k) => {
      const c = clean.charCodeAt(i + k);
      if (c === 61) return 0; // '='
      const d = c < 128 ? B64_LOOKUP[c]! : -1;
      if (d < 0) throw new Error("Invalid base64 character.");
      return d;
    });
    const n = (v[0]! << 18) | (v[1]! << 12) | (v[2]! << 6) | v[3]!;
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

function ascii(bytes: Uint8Array, at: number, length: number): string {
  let s = "";
  for (let i = at; i < at + length && i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return s;
}

function u32(bytes: Uint8Array, at: number): number {
  return ((bytes[at]! << 24) | (bytes[at + 1]! << 16) | (bytes[at + 2]! << 8) | bytes[at + 3]!) >>> 0;
}

/** Width and height from a PNG's IHDR (first 24 bytes), or null when it is not a PNG. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24 || bytes[0] !== 0x89 || ascii(bytes, 1, 3) !== "PNG" || ascii(bytes, 12, 4) !== "IHDR") return null;
  const width = u32(bytes, 16);
  const height = u32(bytes, 20);
  return width > 0 && height > 0 ? { width, height } : null;
}

/**
 * Whether an encoded image can be transparent, from its header alone: a PNG
 * with an alpha channel or a tRNS chunk, or a WebP with alpha. A JPEG, a PNG
 * or WebP without alpha, or another format: false. It says nothing about
 * whether any pixel actually is transparent (see the browser's `isPreCut`).
 */
export function encodedMayBeTransparent(bytes: Uint8Array): boolean {
  if (bytes.length >= 33 && bytes[0] === 0x89 && ascii(bytes, 1, 3) === "PNG" && ascii(bytes, 12, 4) === "IHDR") {
    const colourType = bytes[25]!;
    if (colourType === 4 || colourType === 6) return true;
    // Grey, RGB or palette: transparent only with a tRNS chunk, which comes before the image data.
    for (let at = 33; at + 8 <= bytes.length; at += 12 + u32(bytes, at)) {
      const type = ascii(bytes, at + 4, 4);
      if (type === "tRNS") return true;
      if (type === "IDAT" || type === "IEND") return false;
    }
    return true; // Its chunks run past what was read: it may be.
  }
  if (bytes.length >= 25 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    const chunk = ascii(bytes, 12, 4);
    if (chunk === "VP8X") return (bytes[20]! & 0x10) !== 0;
    if (chunk === "VP8L") return bytes[20] === 0x2f && ((bytes[24]! >> 4) & 1) === 1;
    return false; // Lossy "VP8 ": no alpha.
  }
  return false;
}

/** MIME type sniffed from the first bytes (PNG, JPEG, WebP), default PNG. */
export function sniffMime(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "image/webp";
  return "image/png";
}
