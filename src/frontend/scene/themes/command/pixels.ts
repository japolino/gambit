/**
 * Pixel plumbing for the Command theme: the EGA / CGA / mono palettes, an
 * ordered (Bayer 8x8) dither that maps any picture onto a palette at the
 * screen's own virtual resolution, the 8x8 glyph tiles the frames and
 * meters are built from, and the frame SVG (double white rules that end in
 * chevron caps around inline labels, the way the old crawler screens drew
 * their windows). Everything here is drawn once and cached.
 */

export type Rgb = [number, number, number];
export type PaletteId = "ega" | "cga" | "mono";

/** The 16 IBM EGA colours. */
export const EGA: Rgb[] = [
  [0, 0, 0], [0, 0, 170], [0, 170, 0], [0, 170, 170], [170, 0, 0], [170, 0, 170], [170, 85, 0], [170, 170, 170],
  [85, 85, 85], [85, 85, 255], [85, 255, 85], [85, 255, 255], [255, 85, 85], [255, 85, 255], [255, 255, 85], [255, 255, 255],
];
/** What the place art is allowed to use in each mode (the chassis blue stays the frame's). */
export const PALETTES: Record<PaletteId, Rgb[]> = {
  // The art keeps to the low-intensity half of EGA (plus the greys and white): the bright
  // yellows, cyans and reds belong to the text, and in a picture they read as blobs.
  ega: EGA.filter((_, i) => [0, 2, 3, 4, 5, 6, 7, 8, 15].includes(i)),
  cga: [[0, 0, 0], [85, 255, 255], [255, 85, 255], [255, 255, 255]],
  mono: [[0, 0, 0], [85, 85, 85], [170, 170, 170], [255, 255, 255]],
};
export const PALETTE_LABEL: Record<PaletteId, string> = { ega: "EGA", cga: "CGA", mono: "MONO" };

/** Bayer 8x8 thresholds, 0..63. */
const BAYER8 = (() => {
  const m = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21];
  return Float32Array.from(m, (x) => (x + 0.5) / 64 - 0.5);
})();
export const bayer = (x: number, y: number): number => BAYER8[(y & 7) * 8 + (x & 7)]!;

/** Nearest palette entry (weighted, so greens and greys read as the eye expects). */
function nearest(pal: Rgb[], r: number, g: number, b: number): Rgb {
  let best = pal[0]!;
  let bd = Infinity;
  for (const c of pal) {
    const dr = r - c[0], dg = g - c[1], db = b - c[2];
    const d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

export interface DitherLook {
  /** Contrast around mid grey (1 = as is). */
  contrast?: number;
  saturation?: number;
  /** Added to every channel, -255..255. */
  lift?: number;
  /** How far the Bayer threshold pushes a colour, in 0-255 units. */
  spread?: number;
}

/**
 * In place: every opaque pixel is pushed by the Bayer threshold and snapped
 * to the palette. See-through pixels stay see-through (for cutouts).
 */
export function ditherToPalette(img: ImageData, pal: Rgb[], look: DitherLook = {}): void {
  const { contrast = 1.25, saturation = 1.25, lift = 0, spread = pal.length > 4 ? 72 : 120 } = look;
  const d = img.data;
  const W = img.width;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3]! < 110) {
      d[i + 3] = 0;
      continue;
    }
    const p = i >> 2;
    const t = bayer(p % W, (p / W) | 0) * spread;
    let r = d[i]!, g = d[i + 1]!, b = d[i + 2]!;
    const l = r * 0.3 + g * 0.59 + b * 0.11;
    r = l + (r - l) * saturation;
    g = l + (g - l) * saturation;
    b = l + (b - l) * saturation;
    r = (r - 128) * contrast + 128 + lift + t;
    g = (g - 128) * contrast + 128 + lift + t;
    b = (b - 128) * contrast + 128 + lift + t;
    const c = nearest(pal, r, g, b);
    d[i] = c[0];
    d[i + 1] = c[1];
    d[i + 2] = c[2];
    d[i + 3] = 255;
  }
}

/** Load an image (cached per URL). */
const imgs = new Map<string, Promise<HTMLImageElement>>();
export function loadImage(url: string): Promise<HTMLImageElement> {
  let p = imgs.get(url);
  if (!p) {
    p = new Promise((res, rej) => {
      const im = new Image();
      im.decoding = "async";
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = url;
    });
    imgs.set(url, p);
  }
  return p;
}

export function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Draw `src` to cover a w x h box, with the focus point (0-1) kept in view. */
export function coverDraw(g: CanvasRenderingContext2D, src: CanvasImageSource & { width: number; height: number }, sw: number, sh: number, w: number, h: number, fx = 0.5, fy = 0.5): void {
  const k = Math.max(w / sw, h / sh);
  const dw = sw * k;
  const dh = sh * k;
  g.drawImage(src, (w - dw) * fx, (h - dh) * fy, dw, dh);
}

/* -------------------------------- Glyphs -------------------------------- */

/**
 * 8x8 tiles drawn like character-ROM glyphs. Each row is 8 chars:
 * "#" ink, "o" second ink, "." black, " " see-through.
 */
const GLYPHS: Record<string, string[]> = {
  // The prompt chevron the terminal's history lines start with.
  chev: [".#......", "..#.....", "...#....", "....#...", "....#...", "...#....", "..#.....", ".#......"],
  // The chevron caps a label sits between in a window rule.
  capL: ["..#.....", "...#....", "....#...", ".....#..", ".....#..", "....#...", "...#....", "..#....."],
  capR: [".....#..", "....#...", "...#....", "..#.....", "..#.....", "...#....", "....#...", ".....#.."],
  full: ["#######.", "#######.", "#######.", "#######.", "#######.", "#######.", "#######.", "........"],
  half: ["#.#.#.#.", ".#.#.#..", "#.#.#.#.", ".#.#.#..", "#.#.#.#.", ".#.#.#..", "#.#.#.#.", "........"],
  empty: ["#.....#.", "........", "........", "........", "........", "........", "#.....#.", "........"],
  heart: [".##.##..", "#######.", "#######.", "#######.", ".#####..", "..###...", "...#....", "........"],
  coin: ["..####..", ".#oooo#.", "#oo##oo#", "#o#oooo#", "#oo##oo#", "#oooo#o#", ".#o##o#.", "..####.."],
  key: [".###....", "#...#...", "#...####", "#...#.#.", ".###..#.", "........", "........", "........"],
  clue: ["..###...", ".#...#..", ".....#..", "....#...", "...#....", "...#....", "........", "...#...."],
  sack: ["...##...", "..#..#..", "...##...", "..####..", ".######.", "########", "########", ".######."],
  star: ["...#....", "...#....", "#######.", ".#####..", "..###...", ".##.##..", ".#...#..", "........"],
  hollow: ["...#....", "...#....", "##...##.", ".#...#..", "..#.#...", ".#.#.#..", ".#...#..", "........"],
  // The pointer: a fat CGA arrow.
  arrow: ["#       ", "##      ", "#o#     ", "#oo#    ", "#ooo#   ", "#oo##   ", "#.#o#   ", "   ##   "],
};

const glyphCache = new Map<string, string>();
/** A glyph as a PNG data URL, 8x8 (scaled up with image-rendering: pixelated). */
export function glyph(name: string, ink: string, ink2 = ink, black = "#000"): string {
  const key = `${name}|${ink}|${ink2}|${black}`;
  let u = glyphCache.get(key);
  if (u) return u;
  const rows = GLYPHS[name] ?? GLYPHS.full!;
  const c = canvas(8, 8);
  const g = c.getContext("2d")!;
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === " ") return;
      g.fillStyle = ch === "#" ? ink : ch === "o" ? ink2 : black;
      g.fillRect(x, y, 1, 1);
    }),
  );
  u = c.toDataURL();
  glyphCache.set(key, u);
  return u;
}

/** The pointer as a CSS cursor at `scale` screen pixels per virtual pixel. */
export function cursorUrl(scale: number): string {
  const s = Math.max(1, Math.min(4, scale));
  const c = canvas(8 * s, 8 * s);
  const g = c.getContext("2d")!;
  GLYPHS.arrow!.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === " ") return;
      g.fillStyle = ch === "." ? "#000" : ch === "#" ? "#000" : "#fff";
      g.fillRect(x * s, y * s, s, s);
    }),
  );
  return c.toDataURL();
}

/* -------------------------------- Frames -------------------------------- */

export interface FrameOpts {
  /** Label set into the top / bottom rule (its length in cells). */
  top?: number;
  bottom?: number;
  /** Cell column of the top label (centred when omitted). */
  topX?: number;
  /** Fill the inside black (false: leave it to the content). */
  fill?: boolean;
  /** Rule colours. */
  ink?: string;
  /** Paint the margin outside the outer rule (a blue mat for inset windows). */
  mat?: string;
}

/** Where the rule sits inside a window's edge cells: the blue strap between windows is twice this. */
const M = 3;

/**
 * A window frame as SVG markup, w x h cells (8 virtual pixels each): a thick
 * blue strap outside, one crisp white rule hugging the black box, and labels
 * set into the rule between a ">" and a "<" cap, as the old crawler screens
 * cut their window titles into the frame.
 */
export function frameSvg(w: number, h: number, o: FrameOpts = {}): string {
  const W = w * 8;
  const H = h * 8;
  const ink = o.ink ?? "#fff";
  const r: string[] = [];
  const rect = (x: number, y: number, ww: number, hh: number, c = ink) => r.push(`<rect x="${x}" y="${y}" width="${ww}" height="${hh}" fill="${c}"/>`);
  if (o.mat) rect(0, 0, W, H, o.mat);
  if (o.fill !== false) rect(M + 1, M + 1, W - 2 * M - 2, H - 2 * M - 2, "#000");
  // A horizontal rule broken by a label, with chevron caps either side of it.
  const rule = (y: number, label?: number, rowY = 0, at?: number) => {
    if (!label) {
      rect(M, y, W - 2 * M, 1);
      return;
    }
    const tx = at ?? Math.floor((w - label) / 2);
    const a = (tx - 1) * 8;
    const b = (tx + label + 1) * 8;
    if (a > M) rect(M, y, a - M, 1);
    rect(b, y, W - M - b, 1);
    rect(a, rowY, b - a, 8, "#000");
    const cap: [number, number][] = [[1, 0], [2, 1], [3, 2], [4, 3], [4, 4], [3, 5], [2, 6], [1, 7]];
    for (const [x, yy] of cap) {
      rect(a + x + 1, rowY + yy, 1, 1);
      rect(b - 2 - x, rowY + yy, 1, 1);
    }
  };
  rule(M, o.top, 0, o.topX);
  rule(H - M - 1, o.bottom, H - 8);
  rect(M, M, 1, H - 2 * M);
  rect(W - M - 1, M, 1, H - 2 * M);
  return `<svg class="fr" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true">${r.join("")}</svg>`;
}

/** A 24x24 nine-slice of the same frame, for borders on elements the theme does not own (border-image). */
let nine = "";
export function frameNine(): string {
  if (nine) return nine;
  const c = canvas(24, 24);
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(4, 4, 16, 16);
  g.fillStyle = "#fff";
  g.fillRect(3, 3, 18, 1);
  g.fillRect(3, 20, 18, 1);
  g.fillRect(3, 3, 1, 18);
  g.fillRect(20, 3, 1, 18);
  nine = c.toDataURL();
  return nine;
}

/* ------------------------------ CRT textures ----------------------------- */

/** One virtual pixel of scanline: the last screen row of each is darkened. */
export function scanTile(vpx: number): string {
  const h = Math.max(2, Math.round(vpx));
  const c = canvas(1, h);
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(0,0,0,.34)";
  g.fillRect(0, h - 1, 1, 1);
  if (h >= 3) {
    g.fillStyle = "rgba(255,255,255,.035)";
    g.fillRect(0, 0, 1, 1);
  }
  return c.toDataURL();
}

/** A faint aperture grille: R, G, B columns. */
let grille = "";
export function grilleTile(): string {
  if (grille) return grille;
  const c = canvas(3, 1);
  const g = c.getContext("2d")!;
  ["rgba(255,40,40,.05)", "rgba(40,255,40,.04)", "rgba(60,60,255,.06)"].forEach((s, x) => {
    g.fillStyle = s;
    g.fillRect(x, 0, 1, 1);
  });
  grille = c.toDataURL();
  return grille;
}

/**
 * A scene's register: the few palette colours its picture actually leans
 * on (counted after the same contrast and saturation as the dither), so the
 * place and everyone shown in it are drawn from one small set of inks, the
 * way a 16-colour game picked a handful per screen. Black is always in it.
 */
export function registerOf(img: CanvasImageSource & { width: number; height: number }, pal: Rgb[], look: DitherLook, n = 6): Rgb[] {
  if (pal.length <= n) return pal;
  const c = canvas(48, 48);
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, 48, 48);
  const d = g.getImageData(0, 0, 48, 48).data;
  const { contrast = 1.25, saturation = 1.25, lift = 0 } = look;
  const count = new Map<Rgb, number>();
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i]!, gg = d[i + 1]!, b = d[i + 2]!;
    const l = r * 0.3 + gg * 0.59 + b * 0.11;
    r = (l + (r - l) * saturation - 128) * contrast + 128 + lift;
    gg = (l + (gg - l) * saturation - 128) * contrast + 128 + lift;
    b = (l + (b - l) * saturation - 128) * contrast + 128 + lift;
    const k = nearest(pal, r, gg, b);
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  const top = [...count.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
  const out: Rgb[] = [[0, 0, 0]];
  for (const k of top) if (out.length < n && !(k[0] === 0 && k[1] === 0 && k[2] === 0)) out.push(k);
  // Always keep a light ink so highlights and faces read.
  if (!out.some((k) => k[0] + k[1] + k[2] > 600)) out[out.length - 1] = [255, 255, 255];
  return out;
}
