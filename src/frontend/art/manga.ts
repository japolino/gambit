/**
 * Manga-style 1-bit art: the conversion the pixel themes use for paintings.
 * A figure's detail is its line art, which an ordered dither over a shrunk
 * picture averages into a dark blob, so instead the lines are found first and
 * drawn in solid ink, and the shading is cut to three screentones:
 *
 * 1. Ink lines by XDoG (a difference of two Gaussians, thresholded) on the
 *    luminance at 3x the output size; an output pixel is ink when more than
 *    30% of its 3x3 block is, so a line one big pixel wide survives the shrink.
 * 2. Local contrast: luminance around its own mean over about 20 pixels, in
 *    units of the local spread, so a dark painting still separates.
 * 3. Screens on that tone (SCREEN): solid ink, a 50% checker, a sparse dot,
 *    paper. Lines go over them.
 *
 * `mangaKernel` is self-contained (no imports, no module-level values): its
 * source text runs in a Worker built from a blob URL, so a big figure does not
 * stall the page. Without a Worker it runs on the main thread.
 */

/**
 * The three screentones as one 2x2 threshold tile: a pixel is paper when its
 * tone is above SCREEN[(y & 1) * 2 + (x & 1)]. Below .28 every pixel is ink;
 * up to .5 the odd ones are paper (a checker); up to .68 only the even-even
 * ones stay ink (a sparse dot); above that all paper.
 */
export const SCREEN = [0.68, 0.28, 0.28, 0.5] as const;
export const screen = (x: number, y: number): number => SCREEN[((y & 1) << 1) | (x & 1)]!;

export interface Manga {
  w: number;
  h: number;
  /** Local-contrast tone, 0..1, w x h. */
  tone: Float32Array;
  /** 1 where an ink line falls, w x h. */
  line: Uint8Array;
  /** The picture's colour at w x h (each pixel the mean of its 3x3 block). */
  rgba: Uint8ClampedArray;
}

/**
 * `rgba` is the picture at 3w x 3h. See-through pixels are left out of the
 * local contrast; for the lines they count as `ground` (the luminance the
 * picture will stand on): on paper (1) a cut-out gets an ink outline, on ink
 * (0) its edge is left alone instead of merging into the ground.
 */
export function mangaKernel(rgba: Uint8ClampedArray, w: number, h: number, ground = 1): Manga {
  const W = w * 3, H = h * 3;
  const gauss = (src: Float32Array, sw: number, sh: number, sigma: number): Float32Array => {
    const r = Math.ceil(sigma * 3);
    const k = new Float32Array(2 * r + 1);
    let sum = 0;
    for (let i = -r; i <= r; i++) sum += k[i + r] = Math.exp((-i * i) / (2 * sigma * sigma));
    for (let i = 0; i < k.length; i++) k[i]! /= sum;
    const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
    for (let y = 0; y < sh; y++) {
      const row = y * sw;
      for (let x = 0; x < sw; x++) {
        let a = 0;
        for (let i = -r; i <= r; i++) a += k[i + r]! * src[row + Math.min(sw - 1, Math.max(0, x + i))]!;
        tmp[row + x] = a;
      }
    }
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        let a = 0;
        for (let i = -r; i <= r; i++) a += k[i + r]! * tmp[Math.min(sh - 1, Math.max(0, y + i)) * sw + x]!;
        out[y * sw + x] = a;
      }
    }
    return out;
  };
  // A wide Gaussian as three box blurs (running sums), clamped at the edges.
  const wide = (src: Float32Array, sw: number, sh: number, sigma: number): Float32Array => {
    const r = Math.max(1, Math.round((Math.sqrt(4 * sigma * sigma + 1) - 1) / 2));
    let a = Float32Array.from(src);
    const b = new Float32Array(src.length);
    const n = 2 * r + 1;
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < sh; y++) {
        const row = y * sw;
        let acc = 0;
        for (let x = -r; x <= r; x++) acc += a[row + Math.min(sw - 1, Math.max(0, x))]!;
        for (let x = 0; x < sw; x++) {
          b[row + x] = acc / n;
          acc += a[row + Math.min(sw - 1, x + r + 1)]! - a[row + Math.max(0, x - r)]!;
        }
      }
      for (let x = 0; x < sw; x++) {
        let acc = 0;
        for (let y = -r; y <= r; y++) acc += b[Math.min(sh - 1, Math.max(0, y)) * sw + x]!;
        for (let y = 0; y < sh; y++) {
          a[y * sw + x] = acc / n;
          acc += b[Math.min(sh - 1, y + r + 1) * sw + x]! - b[Math.max(0, y - r) * sw + x]!;
        }
      }
    }
    return a;
  };

  const big = new Float32Array(W * H);
  for (let i = 0; i < big.length; i++) {
    const p = i * 4, a = rgba[p + 3]! / 255;
    big[i] = ((0.299 * rgba[p]! + 0.587 * rgba[p + 1]! + 0.114 * rgba[p + 2]!) / 255) * a + ground * (1 - a);
  }
  const g1 = gauss(big, W, H, 0.9), g2 = gauss(big, W, H, 1.5);
  const line3 = new Uint8Array(W * H);
  for (let i = 0; i < line3.length; i++) line3[i] = g1[i]! - 0.985 * g2[i]! < -0.01 ? 1 : 0;

  const n = w * h;
  const line = new Uint8Array(n), small = new Uint8ClampedArray(n * 4);
  const L = new Float32Array(n), A = new Float32Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let ink = 0, l = 0, r = 0, g = 0, b = 0, a = 0;
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      const q = (y * 3 + j) * W + x * 3 + i, p = q * 4, al = rgba[p + 3]!;
      ink += line3[q]!;
      l += big[q]!;
      r += rgba[p]! * al; g += rgba[p + 1]! * al; b += rgba[p + 2]! * al; a += al;
    }
    const o = y * w + x;
    line[o] = ink > 2.7 ? 1 : 0;
    L[o] = l / 9;
    A[o] = a >= 128 * 9 ? 1 : 0;
    small[o * 4] = a ? r / a : 255; small[o * 4 + 1] = a ? g / a : 255; small[o * 4 + 2] = a ? b / a : 255; small[o * 4 + 3] = a / 9;
  }

  // Mean and spread over the drawn pixels only, so a figure's ground does not set its contrast.
  const LA = new Float32Array(n);
  for (let i = 0; i < n; i++) LA[i] = L[i]! * A[i]!;
  const wA = wide(A, w, h, 20), m = wide(LA, w, h, 20);
  for (let i = 0; i < n; i++) m[i] = wA[i]! > 1e-4 ? m[i]! / wA[i]! : L[i]!;
  const d2 = new Float32Array(n);
  for (let i = 0; i < n; i++) d2[i] = (L[i]! - m[i]!) ** 2 * A[i]!;
  const v = wide(d2, w, h, 20);
  const tone = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = Math.sqrt(wA[i]! > 1e-4 ? v[i]! / wA[i]! : 0) + 0.06;
    tone[i] = Math.min(1, Math.max(0, 0.55 + (0.35 * (L[i]! - m[i]!)) / s));
  }
  return { w, h, tone, line, rgba: small };
}

/** The picture in two colours, 1 = paper and 0 = ink: the tone through the screens, the lines over it. */
export function mangaPixels(m: Manga): Uint8Array {
  const out = new Uint8Array(m.w * m.h);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const i = y * m.w + x;
    out[i] = !m.line[i] && m.tone[i]! > screen(x, y) ? 1 : 0;
  }
  return out;
}

/**
 * The picture's colour with its light pulled `pull` of the way to the tone
 * (the colour scaled with it, so it keeps its hue), for palettes.
 */
export function mangaColor(m: Manga, pull: number): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(m.rgba.length);
  for (let i = 0; i < m.w * m.h; i++) {
    const p = i * 4;
    const l = (0.299 * m.rgba[p]! + 0.587 * m.rgba[p + 1]! + 0.114 * m.rgba[p + 2]!) / 255;
    const k = (l + pull * (m.tone[i]! - l)) / Math.max(0.02, l);
    out[p] = m.rgba[p]! * k;
    out[p + 1] = m.rgba[p + 1]! * k;
    out[p + 2] = m.rgba[p + 2]! * k;
    out[p + 3] = m.rgba[p + 3]!;
  }
  return out;
}

/* ------------------------------ Running it ------------------------------ */

type Job = { resolve: (m: Manga) => void; reject: (e: Error) => void };
let worker: Worker | null | undefined;
const jobs = new Map<number, Job>();
let nextId = 1;

function startWorker(): Worker | null {
  try {
    const src = `"use strict";const k=(${String(mangaKernel)});self.onmessage=(e)=>{const{id,rgba,w,h,ground}=e.data;const m=k(rgba,w,h,ground);self.postMessage({id,m},[m.tone.buffer,m.line.buffer,m.rgba.buffer]);};`;
    const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
    const wk = new Worker(url);
    URL.revokeObjectURL(url);
    wk.onmessage = (e: MessageEvent<{ id: number; m: Manga }>) => {
      jobs.get(e.data.id)?.resolve(e.data.m);
      jobs.delete(e.data.id);
    };
    wk.onerror = (e) => {
      e.preventDefault();
      for (const j of jobs.values()) j.reject(new Error("The manga worker failed."));
      jobs.clear();
      worker = null;
    };
    return wk;
  } catch {
    return null;
  }
}

/** The kernel on `rgba` (3w x 3h), off the main thread when a Worker can start. */
export function runManga(rgba: Uint8ClampedArray, w: number, h: number, ground = 1): Promise<Manga> {
  if (worker === undefined) worker = typeof Worker === "undefined" ? null : startWorker();
  if (!worker) return Promise.resolve(mangaKernel(rgba, w, h, ground));
  const id = nextId++;
  return new Promise<Manga>((resolve, reject) => {
    jobs.set(id, { resolve, reject });
    worker!.postMessage({ id, rgba, w, h, ground });
  }).catch(() => mangaKernel(rgba, w, h, ground));
}

/**
 * Part of a picture (`sx, sy, sw, sh` in its own pixels) as manga at w x h:
 * drawn at 3x with smoothing, then run through the kernel.
 */
export function mangaOf(img: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, w: number, h: number): Promise<Manga> {
  const c = document.createElement("canvas");
  c.width = w * 3;
  c.height = h * 3;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return runManga(g.getImageData(0, 0, c.width, c.height).data, w, h);
}
