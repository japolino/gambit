/**
 * Turning painted art into 1-bit pictures on the theme's pixel grid.
 *
 * Places become a luminance field (levels stretched and an S-curve so the
 * shadows reach pure black) that the viewport dithers every frame with its
 * own light, vignette and torch flicker. People become portraits the way a
 * 1-bit artist would draw them: local contrast boosted so a low-contrast
 * painting still separates, Sobel edges inked in as outlines, then Atkinson
 * error diffusion (which keeps highlights clean) instead of a flat threshold
 * that turns faces into static.
 */
import type { Bits } from "./fb.js";

const images = new Map<string, Promise<HTMLImageElement>>();
export function loadImage(url: string): Promise<HTMLImageElement> {
  let p = images.get(url);
  if (!p) {
    p = (async () => {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      return img;
    })();
    images.set(url, p);
    p.catch(() => images.delete(url));
  }
  return p;
}

function pixels(img: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, w: number, h: number): Uint8ClampedArray {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  return g.getImageData(0, 0, w, h).data;
}

const lumOf = (d: Uint8ClampedArray, i: number) => Math.pow((0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!) / 255, 1.1);

function percentile(vals: Float32Array, n: number, q: number): number {
  const s = Float32Array.from(vals.subarray(0, n)).sort();
  return s[Math.min(n - 1, Math.max(0, Math.floor(q * (n - 1))))] ?? 0;
}

/** A place painting cover-fitted to w x h, levels stretched and contrast curved (0..1). */
export async function placeField(url: string, w: number, h: number): Promise<Float32Array> {
  const img = await loadImage(url);
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const k = Math.max(w / iw, h / ih);
  const sw = w / k, sh = h / k;
  const d = pixels(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, w, h);
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = lumOf(d, i * 4);
  const lo = percentile(out, out.length, 0.02), hi = percentile(out, out.length, 0.985);
  const span = Math.max(0.05, hi - lo);
  for (let i = 0; i < out.length; i++) {
    const l = Math.min(1, Math.max(0, (out[i]! - lo) / span));
    // An S-curve: midtones open up into dither texture, shadows fall to black.
    const s = l * l * (3 - 2 * l);
    out[i] = Math.max(0, s * 0.75 + l * 0.25 - 0.04);
  }
  return out;
}

function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * w + Math.min(w - 1, Math.max(0, x))]!;
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / (2 * r + 1);
      acc += src[y * w + Math.min(w - 1, x + r + 1)]! - src[y * w + Math.max(0, x - r)]!;
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]!;
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / (2 * r + 1);
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x]! - tmp[Math.max(0, y - r) * w + x]!;
    }
  }
  return out;
}

/** Contrast, ink lines and Atkinson dither: a 1-bit drawing of a figure. */
function draw1bit(l: Float32Array, a: Uint8Array, w: number, h: number, edge = 1): Bits {
  const n = w * h;
  // Levels over the figure only, so a dark coat on a white ground still spans the range.
  const inside = new Float32Array(n);
  let m = 0;
  for (let i = 0; i < n; i++) if (a[i]) inside[m++] = l[i]!;
  const lo = m ? percentile(inside, m, 0.03) : 0, hi = m ? percentile(inside, m, 0.97) : 1;
  const span = Math.max(0.08, hi - lo);
  const L = new Float32Array(n);
  for (let i = 0; i < n; i++) L[i] = Math.min(1, Math.max(0, (l[i]! - lo) / span));
  // Local contrast: detail around a blurred mean, so faces separate from hair and cloth.
  const mean = boxBlur(L, w, h, Math.max(1, Math.round(Math.min(w, h) / 14)));
  const v = new Float32Array(n);
  for (let i = 0; i < n; i++) v[i] = Math.min(1, Math.max(0, 0.5 + (L[i]! - mean[i]!) * 2.1 + (mean[i]! - 0.5) * 0.95));
  // Sobel: the strongest edges are inked as outlines.
  const mag = new Float32Array(n);
  let k = 0;
  const sm = boxBlur(L, w, h, 1);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const p = (dx: number, dy: number) => sm[(y + dy) * w + x + dx]!;
    const gx = p(1, -1) + 2 * p(1, 0) + p(1, 1) - p(-1, -1) - 2 * p(-1, 0) - p(-1, 1);
    const gy = p(-1, 1) + 2 * p(0, 1) + p(1, 1) - p(-1, -1) - 2 * p(0, -1) - p(1, -1);
    const g = Math.hypot(gx, gy);
    mag[y * w + x] = g;
    if (a[y * w + x]) inside[k++] = g;
  }
  const T = Math.max(0.35, k ? percentile(inside, k, 0.86) : 1) / edge;
  for (let i = 0; i < n; i++) {
    if (mag[i]! > T) v[i] = v[i]! * 0.12;
    v[i] = Math.pow(v[i]!, 0.82);
  }
  // Atkinson: 6/8 of the error carried, so highlights stay clean white.
  const pix = new Uint8Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!a[i]) continue;
    const old = v[i]!;
    const nw = old > 0.5 ? 1 : 0;
    pix[i] = nw;
    const err = (old - nw) / 8;
    const add = (dx: number, dy: number) => {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < w && ny < h && a[ny * w + nx]) v[ny * w + nx] += err;
    };
    add(1, 0); add(2, 0); add(-1, 1); add(0, 1); add(1, 1); add(0, 2);
  }
  return { w, h, pix, mask: a };
}

const people = new Map<string, Promise<Bits>>();

/**
 * A person as 1-bit art: "body" is the whole figure `size` pixels tall (for
 * standing in the viewport), "bust" a size x size head-and-shoulders crop
 * (for the portrait dock).
 */
export function personBits(url: string, cutout: boolean, kind: "body" | "bust", size: number, clean = false): Promise<Bits> {
  const key = `${url}|${cutout}|${kind}|${size}|${clean}`;
  let p = people.get(key);
  if (!p) {
    p = buildPerson(url, cutout, kind, size, clean);
    people.set(key, p);
    p.catch(() => people.delete(key));
  }
  return p;
}

/**
 * Tidy a mask keyed out of opaque art: open it (drop specks and hairline
 * fringes of the old ground) and drop pieces much smaller than the figure.
 */
function cleanMask(a: Uint8Array, w: number, h: number): void {
  const at = (m: Uint8Array, x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h ? m[y * w + x]! : 0);
  const morph = (m: Uint8Array, grow: boolean): Uint8Array => {
    const o = new Uint8Array(m.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let v = grow ? 0 : 1;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const q = at(m, x + dx, y + dy);
        v = grow ? v | q : v & q;
      }
      o[y * w + x] = v;
    }
    return o;
  };
  const m = morph(morph(a, false), true);
  // The big pieces (the figure, maybe in parts); specks and floaters go.
  const lab = new Int32Array(m.length);
  let bestN = 0, id = 0;
  const sizes: number[] = [0];
  const stack: number[] = [];
  for (let i = 0; i < m.length; i++) {
    if (!m[i] || lab[i]) continue;
    id++;
    let cnt = 0;
    stack.push(i);
    lab[i] = id;
    while (stack.length) {
      const k = stack.pop()!;
      cnt++;
      const x = k % w, y = (k / w) | 0;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (m[q] && !lab[q]) { lab[q] = id; stack.push(q); }
      }
    }
    sizes.push(cnt);
    bestN = Math.max(bestN, cnt);
  }
  for (let i = 0; i < m.length; i++) a[i] = lab[i] && sizes[lab[i]]! >= bestN * 0.12 ? 1 : 0;
}

async function buildPerson(url: string, cutout: boolean, kind: "body" | "bust", size: number, clean: boolean): Promise<Bits> {
  const img = await loadImage(url);
  const iw = img.naturalWidth, ih = img.naturalHeight;
  // Where the figure is: the alpha bounding box of a cutout (at a small working size).
  const pw = Math.min(256, iw), ph = Math.max(1, Math.round((ih / iw) * pw));
  let bx0 = 0, by0 = 0, bx1 = iw, by1 = ih, cxTop = iw / 2;
  if (cutout) {
    const d = pixels(img, 0, 0, iw, ih, pw, ph);
    let x0 = pw, y0 = ph, x1 = -1, y1 = -1;
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) if (d[(y * pw + x) * 4 + 3]! > 60) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    if (x1 >= 0) {
      const s = iw / pw;
      bx0 = x0 * s; by0 = y0 * s; bx1 = (x1 + 1) * s; by1 = (y1 + 1) * s;
      // The head: the middle of the figure's top tenth.
      let sx = 0, cnt = 0;
      const band = Math.max(2, Math.round((y1 - y0) * 0.1));
      for (let y = y0; y < y0 + band; y++) for (let x = x0; x <= x1; x++) if (d[(y * pw + x) * 4 + 3]! > 60) { sx += x; cnt++; }
      cxTop = cnt ? (sx / cnt) * s : (bx0 + bx1) / 2;
    }
  }
  const bw = bx1 - bx0, bh = by1 - by0;
  let sx: number, sy: number, sw: number, sh: number, tw: number, th: number;
  if (kind === "body") {
    sx = bx0; sy = by0; sw = bw; sh = bh;
    th = size;
    tw = Math.max(4, Math.round((bw / bh) * size));
  } else {
    // A full figure is tall and narrow: its head is a small square at the top.
    // Half-figures and portraits are framed wider.
    const full = bh / Math.max(1, bw) > 1.7;
    const side = cutout ? (full ? Math.min(bw, bh * 0.36) : Math.min(bw, bh) * 0.72) : Math.min(iw, ih) * 0.78;
    sw = sh = side;
    sx = Math.min(iw - side, Math.max(0, (cutout ? cxTop : iw / 2) - side / 2));
    sy = Math.max(0, (cutout ? by0 : ih * 0.02) - side * 0.05);
    tw = th = size;
  }
  const d = pixels(img, sx, sy, sw, sh, tw, th);
  const n = tw * th;
  const l = new Float32Array(n), a = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    l[i] = lumOf(d, i * 4);
    a[i] = !cutout || d[i * 4 + 3]! >= (clean ? 48 : 128) ? 1 : 0;
  }
  if (cutout && clean) cleanMask(a, tw, th);
  return draw1bit(l, a, tw, th, kind === "bust" ? 1.1 : 1);
}

const busts = new Map<string, Promise<Bits>>();

/**
 * Opaque art (a painting with its own ground) as a figure that can stand
 * among cutouts: the whole picture `size` rows tall, cut to a tombstone
 * (round-topped) silhouette round the head and shoulders, its light falling
 * away to black toward the edge before it is dithered, so the painted ground
 * dissolves into the dark instead of ending in a frame.
 */
export function bustBits(url: string, size: number): Promise<Bits> {
  const key = `${url}|${size}`;
  let p = busts.get(key);
  if (!p) {
    p = (async () => {
      const img = await loadImage(url);
      const iw = img.naturalWidth, ih = img.naturalHeight;
      // Head and shoulders: the top of the picture, a little narrower than it.
      const sw = Math.min(iw, ih * 0.82), sh = Math.min(ih, sw * 1.25);
      const th = size, tw = Math.max(8, Math.round((sw / sh) * size));
      const d = pixels(img, (iw - sw) / 2, 0, sw, sh, tw, th);
      const n = tw * th;
      const l = new Float32Array(n), a = new Uint8Array(n);
      const r = tw / 2 - 1, cx = (tw - 1) / 2;
      for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
        const i = y * tw + x;
        // Distance inside the tombstone, 0 at its edge, 1 deep inside.
        const dx = Math.abs(x - cx) / r;
        const e = y < r ? 1 - Math.hypot(x - cx, y - r) / r : 1 - dx;
        if (e <= 0) continue;
        a[i] = 1;
        const fall = Math.min(1, e / 0.28);
        l[i] = lumOf(d, i * 4) * fall * fall * (3 - 2 * fall);
      }
      return draw1bit(l, a, tw, th, 1.1);
    })();
    busts.set(key, p);
    p.catch(() => busts.delete(key));
  }
  return p;
}

/** A wall texture's luminance at s x s (for the corridor), levels stretched. */
export async function textureField(url: string, s: number): Promise<Float32Array> {
  const img = await loadImage(url);
  const d = pixels(img, 0, 0, img.naturalWidth, img.naturalHeight, s, s);
  const out = new Float32Array(s * s);
  for (let i = 0; i < out.length; i++) out[i] = lumOf(d, i * 4);
  const lo = percentile(out, out.length, 0.03), hi = percentile(out, out.length, 0.97);
  for (let i = 0; i < out.length; i++) out[i] = Math.min(1, Math.max(0, (out[i]! - lo) / Math.max(0.05, hi - lo)));
  return out;
}
