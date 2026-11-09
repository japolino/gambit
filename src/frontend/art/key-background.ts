/**
 * Flat-background keying for opaque art (a V5 inset render on white, say).
 * When most of the border is one flat colour, that colour is flood-filled
 * to transparent from the edges, and a thin band around the figure gets
 * partial alpha so the edge is not jagged. Pixels of the background colour
 * inside the figure (a white collar) are kept: only what the border reaches
 * goes.
 *
 * Pure: works on an RGBA buffer in place and says whether it keyed.
 */

export interface KeyOptions {
  /** Share of border pixels that must match the background colour. */
  borderShare?: number;
  /** Colour distance (0-441) still counted as background. */
  tolerance?: number;
  /** Distance over which alpha ramps back up at the edge. */
  feather?: number;
}

const dist = (d: Uint8ClampedArray | Uint8Array, i: number, r: number, g: number, b: number): number => {
  const dr = d[i]! - r;
  const dg = d[i + 1]! - g;
  const db = d[i + 2]! - b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
};

export function keyFlatBackground(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, opts: KeyOptions = {}): boolean {
  const share = opts.borderShare ?? 0.8;
  const tol = opts.tolerance ?? 38;
  const feather = opts.feather ?? 40;
  if (width < 3 || height < 3) return false;

  // The background colour: the median of the border, per channel.
  const border: number[] = [];
  for (let x = 0; x < width; x++) border.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y++) border.push(y * width, y * width + width - 1);
  const channel = (c: number) => {
    const v = border.map((p) => rgba[p * 4 + c]!).sort((a, b) => a - b);
    return v[v.length >> 1]!;
  };
  const r = channel(0);
  const g = channel(1);
  const b = channel(2);
  const matching = border.filter((p) => rgba[p * 4 + 3]! > 200 && dist(rgba, p * 4, r, g, b) <= tol).length;
  if (matching < border.length * share) return false;

  // Flood from every matching border pixel through background-coloured pixels.
  const seen = new Uint8Array(width * height);
  const stack: number[] = [];
  for (const p of border) {
    if (!seen[p] && dist(rgba, p * 4, r, g, b) <= tol) {
      seen[p] = 1;
      stack.push(p);
    }
  }
  while (stack.length) {
    const p = stack.pop()!;
    rgba[p * 4 + 3] = 0;
    const x = p % width;
    const y = (p - x) / width;
    const visit = (q: number) => {
      if (!seen[q] && dist(rgba, q * 4, r, g, b) <= tol) {
        seen[q] = 1;
        stack.push(q);
      }
    };
    if (x > 0) visit(p - 1);
    if (x < width - 1) visit(p + 1);
    if (y > 0) visit(p - width);
    if (y < height - 1) visit(p + width);
  }

  // Feather: figure pixels touching the cleared area fade by how close to the background they are.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (seen[p]) continue;
      const touches = (x > 0 && seen[p - 1]) || (x < width - 1 && seen[p + 1]) || (y > 0 && seen[p - width]) || (y < height - 1 && seen[p + width]);
      if (!touches) continue;
      const d = dist(rgba, p * 4, r, g, b);
      if (d < tol + feather) rgba[p * 4 + 3] = Math.round(rgba[p * 4 + 3]! * Math.max(0.15, (d - tol) / feather));
    }
  }
  return true;
}

/** How much of a picture is figure (alpha > 0.5) and how colourful that figure is (mean chroma, (max-min)/255, 0..1; dark noise does not inflate it the way HSV saturation does). */
export function figureStats(rgba: Uint8ClampedArray | Uint8Array): { coverage: number; saturation: number } {
  let seen = 0;
  let solid = 0;
  let sat = 0;
  // Every 7th pixel is plenty for a verdict and keeps this cheap on large art.
  for (let i = 0; i + 3 < rgba.length; i += 4 * 7) {
    seen++;
    if (rgba[i + 3]! < 128) continue;
    solid++;
    const r = rgba[i]!, g = rgba[i + 1]!, b = rgba[i + 2]!;
    const max = Math.max(r, g, b);
    sat += (max - Math.min(r, g, b)) / 255;
  }
  return { coverage: seen ? solid / seen : 0, saturation: solid ? sat / solid : 0 };
}

/**
 * Whether a generated expression is fit to replace the face it was drawn from.
 * Rejects a blank or keyed-away render (almost no figure left) and a greyscale
 * render of a colourful character (the generator lost the reference).
 */
export function usableExpression(expr: { coverage: number; saturation: number }, base?: { saturation: number }): boolean {
  if (expr.coverage < 0.04) return false;
  // Relative to the reference: a card's art can be muted (Corvin measures 0.165), a lost render is ~0.
  if (base && base.saturation > 0.08 && expr.saturation < Math.min(0.05, base.saturation * 0.35)) return false;
  return true;
}

/**
 * Whether a picture is shown framed, cropped round its face, instead of standing where a figure stands: opaque art
 * (`coverage` of the base face, so the look holds from mood to mood), or a bust or square sprite (`aspect`, height over
 * width), which a figure's place would show only the top of.
 */
export function framedPicture(coverage: number, aspect: number): boolean {
  return coverage > 0.97 || (aspect > 0 && aspect < 1.2);
}
