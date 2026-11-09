/**
 * The 1-bit frame buffer: one byte per virtual pixel, 0 = ink (phosphor off)
 * and 1 = paper (phosphor on). Every window, glyph, portrait and dither dot
 * of the theme is drawn into it, so the whole screen shares one pixel grid;
 * it is shown on one canvas scaled up with nearest-neighbour sampling.
 */
import { TINY, plain, type BitFont } from "./font.js";

export const INK = 0;
export const PAPER = 1;
/** Text colour that inverts whatever is underneath. */
export const XOR = 2;

/** 8x8 ordered dither thresholds (0..63). */
export const BAYER8 = Uint8Array.from([
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
]);
/** Threshold 0..1 at a screen pixel (screen-anchored, as old hardware did). */
export const bayer = (x: number, y: number): number => (BAYER8[(y & 7) * 8 + (x & 7)]! + 0.5) / 64;

export interface Rect { x: number; y: number; w: number; h: number }

/** A 1-bit picture with its own see-through mask (1 = drawn). */
export interface Bits { w: number; h: number; pix: Uint8Array; mask: Uint8Array }

/** A letter the face lacks, where it was drawn: `sig` is its cell then, so a window drawn over it later hides it. */
interface Foreign { x: number; y: number; size: number; ch: string; c: number; sig: number }

export class Frame {
  pix: Uint8Array;
  /** Letters the face lacks, kept for a console that draws them sharp over the frame (drawForeign); null where none does. */
  foreign: Foreign[] | null = null;
  private img: ImageData | null = null;
  constructor(public w: number, public h: number) {
    this.pix = new Uint8Array(w * h);
  }

  set(x: number, y: number, c: number): void {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.pix[y * this.w + x] = c;
  }
  fill(r: Rect, c: number): void {
    const x0 = Math.max(0, r.x), y0 = Math.max(0, r.y), x1 = Math.min(this.w, r.x + r.w), y1 = Math.min(this.h, r.y + r.h);
    for (let y = y0; y < y1; y++) this.pix.fill(c, y * this.w + x0, y * this.w + x1);
  }
  invert(r: Rect): void {
    const x0 = Math.max(0, r.x), y0 = Math.max(0, r.y), x1 = Math.min(this.w, r.x + r.w), y1 = Math.min(this.h, r.y + r.h);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) this.pix[y * this.w + x] ^= 1;
  }
  /** A 1-pixel outline. */
  box(r: Rect, c: number): void {
    this.fill({ x: r.x, y: r.y, w: r.w, h: 1 }, c);
    this.fill({ x: r.x, y: r.y + r.h - 1, w: r.w, h: 1 }, c);
    this.fill({ x: r.x, y: r.y, w: 1, h: r.h }, c);
    this.fill({ x: r.x + r.w - 1, y: r.y, w: 1, h: r.h }, c);
  }
  /** Ordered-dither fill at a grey level 0..1 (0.5 is the Macintosh desktop checkerboard). */
  tone(r: Rect, level: number): void {
    const x0 = Math.max(0, r.x), y0 = Math.max(0, r.y), x1 = Math.min(this.w, r.x + r.w), y1 = Math.min(this.h, r.y + r.h);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) this.pix[y * this.w + x] = level > bayer(x, y) ? PAPER : INK;
  }
  /** Knock out every other pixel of whatever is there (a "disabled" stipple). */
  stipple(r: Rect): void {
    const x0 = Math.max(0, r.x), y0 = Math.max(0, r.y), x1 = Math.min(this.w, r.x + r.w), y1 = Math.min(this.h, r.y + r.h);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if ((x + y) & 1) this.pix[y * this.w + x] = INK;
  }
  hline(x: number, y: number, w: number, c: number, dash = 0): void {
    for (let i = 0; i < w; i++) if (!dash || ((i / dash) | 0) % 2 === 0) this.set(x + i, y, c);
  }
  vline(x: number, y: number, h: number, c: number, dash = 0): void {
    for (let i = 0; i < h; i++) if (!dash || ((i / dash) | 0) % 2 === 0) this.set(x, y + i, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number): void {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  /**
   * Bitmap text: `scale` is a whole multiple of the 8x8 cell; colour XOR
   * flips what is underneath (numbers stamped across a bar). Returns the width drawn.
   */
  text(f: BitFont, x: number, y: number, s: string, c: number, scale = 1): number {
    const str = plain(s);
    let cx = x;
    for (const ch of str) {
      const gl = f.glyph(ch);
      const size = 8 * scale;
      const own = c === XOR ? (this.pix[(y + (size >> 1)) * this.w + cx + (size >> 1)] ?? INK) ^ 1 : c;
      for (let r = 0; r < 8; r++) {
        const bits = gl[r]!;
        if (!bits) continue;
        for (let col = 0; col < 8; col++) {
          if (!(bits & (0x80 >> col))) continue;
          if (c === XOR) {
            for (let j = 0; j < scale; j++) for (let i = 0; i < scale; i++) {
              const px = cx + col * scale + i, py = y + r * scale + j;
              if (px >= 0 && py >= 0 && px < this.w && py < this.h) this.pix[py * this.w + px] ^= 1;
            }
          } else if (scale === 1) this.set(cx + col, y + r, c);
          else this.fill({ x: cx + col * scale, y: y + r * scale, w: scale, h: scale }, c);
        }
      }
      if (this.foreign && !f.has(ch)) this.foreign.push({ x: cx, y, size, ch, c: own, sig: this.sig(cx, y, size) });
      cx += size;
    }
    return cx - x;
  }
  /** A hash of a square of the frame. */
  sig(x: number, y: number, size: number): number {
    let h = 2166136261;
    for (let j = y; j < y + size; j++) for (let i = x; i < x + size; i++) h = Math.imul(h ^ (i >= 0 && j >= 0 && i < this.w && j < this.h ? this.pix[j * this.w + i]! : 9), 16777619);
    return h >>> 0;
  }
  /** 3x5 digits; `xor` flips what is underneath instead of painting. */
  tiny(x: number, y: number, s: string, c: number, xor = false): number {
    let cx = x;
    for (const ch of s) {
      const rows = TINY[ch] ?? TINY[" "]!;
      for (let r = 0; r < 5; r++) for (let col = 0; col < 3; col++) {
        if (!(rows[r]! & (4 >> col))) continue;
        const px = cx + col, py = y + r;
        if (px < 0 || py < 0 || px >= this.w || py >= this.h) continue;
        if (xor) this.pix[py * this.w + px] ^= 1;
        else this.pix[py * this.w + px] = c;
      }
      cx += 4;
    }
    return cx - x;
  }
  /** ASCII pixel art: '#' paper, '.' ink, anything else left alone. */
  sprite(x: number, y: number, art: readonly string[], scale = 1, flip = false): void {
    for (let r = 0; r < art.length; r++) {
      const row = art[r]!;
      for (let col = 0; col < row.length; col++) {
        const ch = row[flip ? row.length - 1 - col : col];
        if (ch !== "#" && ch !== ".") continue;
        this.fill({ x: x + col * scale, y: y + r * scale, w: scale, h: scale }, ch === "#" ? PAPER : INK);
      }
    }
  }
  /** A 1-bit picture, clipped to `clip`. */
  blit(b: Bits, x: number, y: number, clip?: Rect): void {
    const cx0 = clip ? Math.max(0, clip.x) : 0, cy0 = clip ? Math.max(0, clip.y) : 0;
    const cx1 = clip ? Math.min(this.w, clip.x + clip.w) : this.w, cy1 = clip ? Math.min(this.h, clip.y + clip.h) : this.h;
    for (let j = 0; j < b.h; j++) {
      const py = y + j;
      if (py < cy0 || py >= cy1) continue;
      for (let i = 0; i < b.w; i++) {
        const px = x + i;
        if (px < cx0 || px >= cx1) continue;
        const k = j * b.w + i;
        if (b.mask[k]) this.pix[py * this.w + px] = b.pix[k]!;
      }
    }
  }
  /**
   * Dither a luminance field (0..1, `lw` wide) into a rect, offset by (ox, oy)
   * into the field. `light` (r.w x r.h) multiplies it: the vignette and the
   * directional light; `ring` scales the torch flicker per pixel. `at` is the
   * threshold at a screen pixel (art fields use the manga screens).
   */
  dither(r: Rect, lum: Float32Array, lw: number, lh: number, ox: number, oy: number, light?: Float32Array, ring?: Float32Array, flick = 0, at: (x: number, y: number) => number = bayer): void {
    for (let y = 0; y < r.h; y++) {
      const py = r.y + y;
      if (py < 0 || py >= this.h) continue;
      const sy = Math.min(lh - 1, Math.max(0, y + oy));
      for (let x = 0; x < r.w; x++) {
        const px = r.x + x;
        if (px < 0 || px >= this.w) continue;
        const sx = Math.min(lw - 1, Math.max(0, x + ox));
        let l = lum[sy * lw + sx]!;
        const k = y * r.w + x;
        if (light) l *= light[k]!;
        if (ring) l *= 1 + flick * ring[k]!;
        this.pix[py * this.w + px] = l > at(px, py) ? PAPER : INK;
      }
    }
  }
  /** Paint into a 2D canvas the same size as the frame. */
  present(g: CanvasRenderingContext2D, ink: number, paper: number): void {
    if (!this.img || this.img.width !== this.w || this.img.height !== this.h) this.img = g.createImageData(this.w, this.h);
    const out = new Uint32Array(this.img.data.buffer);
    const p = this.pix;
    for (let i = 0; i < p.length; i++) out[i] = p[i] ? paper : ink;
    g.putImageData(this.img, 0, 0);
  }
}

const sharp = new Map<string, HTMLCanvasElement>();
/** A letter the face lacks, `px` device pixels square, from the system's fonts, thresholded to one colour. */
function sharpGlyph(ch: string, px: number, color: string): HTMLCanvasElement {
  const key = `${ch}|${px}|${color}`;
  let cv = sharp.get(key);
  if (cv) return cv;
  cv = document.createElement("canvas");
  cv.width = cv.height = px;
  const g = cv.getContext("2d", { willReadFrequently: true })!;
  let size = Math.round(px * 0.95);
  g.font = `700 ${size}px sans-serif`;
  const w = g.measureText(ch).width;
  if (w > px) g.font = `700 ${(size = Math.floor((size * px) / w))}px sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = color;
  g.fillText(ch, px / 2, px / 2 + size * 0.06);
  const img = g.getImageData(0, 0, px, px);
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i]! > 110 ? 255 : 0;
  g.putImageData(img, 0, 0);
  sharp.set(key, cv);
  return cv;
}

/**
 * Draw the letters the bitmap face lacks sharp, at `k` device pixels per frame
 * pixel, onto a canvas laid over the frame's, wherever the frame still shows
 * them; then forget them for the next paint.
 */
export function drawForeign(fb: Frame, g: CanvasRenderingContext2D, k: number, ink: string, paper: string): void {
  g.clearRect(0, 0, g.canvas.width, g.canvas.height);
  for (const t of fb.foreign ?? []) {
    if (fb.sig(t.x, t.y, t.size) !== t.sig) continue;
    const px = t.size * k;
    g.fillStyle = t.c === PAPER ? ink : paper;
    g.fillRect(t.x * k, t.y * k, px, px);
    g.drawImage(sharpGlyph(t.ch, px, t.c === PAPER ? paper : ink), t.x * k, t.y * k);
  }
  if (fb.foreign) fb.foreign = [];
}

/** Grow a mask by one pixel (8-neighbour); used for sprite outlines. */
export function dilate(mask: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (mask[y * w + x]) { out[y * w + x] = 1; continue; }
    let on = 0;
    for (let dy = -1; dy <= 1 && !on; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && mask[ny * w + nx]) { on = 1; break; }
    }
    out[y * w + x] = on;
  }
  return out;
}
