/**
 * Vendored from Cue:
 *   repo:   visual-novel-preview (D:\Lumiverse\visual-novel-preview)
 *   branch: origin/testing @ ab0fa34 (file last changed at 0f11d58)
 *   path:   src/shared/novelai-inset.ts
 * Changes: added the "wide" layout (unverified, see below); types renamed to
 * Gambit's layout ids. Pure: used by the backend (request, checks) and the
 * browser (canvas, mask, crop). Pull upstream fixes by hand.
 *
 * NovelAI V5 reference inset: V5 has no Precise Reference or Vibe Transfer,
 * so a character is kept consistent by inpainting: the reference image fills
 * one part of a canvas, the rest is masked, and a V5 inpainting request
 * ("split screen") draws the masked part copying the character and its art
 * style; the repainted part is cropped out as the result. Technique:
 * arca.live AI-art channel, author "bequiet" (posts 180786125, 185554190,
 * 185642997).
 *
 * Mask edges must sit on 8-px blocks (the latent grid) or a grey seam
 * appears; canvas sides are multiples of 64.
 */

/** A pixel rectangle (integers). */
export type PixelRect = { x: number; y: number; width: number; height: number };

export type InsetLayoutId = "sprite" | "wide";

export type InsetLayout = {
  id: InsetLayoutId;
  canvas: { width: number; height: number };
  /** Where the reference is fitted (contained and centred, on white). */
  reference: PixelRect;
  /** The masked part: white in the mask, repainted, and cropped as the result. */
  repaint: PixelRect;
};

/** Mask edges must sit on blocks of this many pixels. */
export const INSET_BLOCK = 8;
/** Canvas sides must be multiples of this. */
export const INSET_CANVAS_STEP = 64;

/**
 * - sprite (author-validated, used by Cue): a 1216x832 landscape canvas (free
 *   on Opus at <= 28 steps), the reference in the left half (608x832), the
 *   right half repainted. Output 608x832. Gambit: expressions and busts.
 * - wide (UNVERIFIED; Cue's probe candidate `--canvas 1472x704 --strip 448`):
 *   a 1472x704 canvas (1,036,288 px, under the Opus free limit), the
 *   reference in a 448x704 strip, a 1024x704 repaint. Gambit: cut-in action
 *   poses, which need horizontal room. Calibrate in the M1 art spike.
 */
export const INSET_LAYOUTS: Readonly<Record<InsetLayoutId, InsetLayout>> = {
  sprite: {
    id: "sprite",
    canvas: { width: 1216, height: 832 },
    reference: { x: 0, y: 0, width: 608, height: 832 },
    repaint: { x: 608, y: 0, width: 608, height: 832 },
  },
  wide: {
    id: "wide",
    canvas: { width: 1472, height: 704 },
    reference: { x: 0, y: 0, width: 448, height: 704 },
    repaint: { x: 448, y: 0, width: 1024, height: 704 },
  },
};

export function insetLayout(id: unknown): InsetLayout | null {
  return typeof id === "string" && Object.hasOwn(INSET_LAYOUTS, id) ? INSET_LAYOUTS[id as InsetLayoutId] : null;
}

function inside(rect: PixelRect, canvas: { width: number; height: number }): boolean {
  return rect.x >= 0 && rect.y >= 0 && rect.width > 0 && rect.height > 0 && rect.x + rect.width <= canvas.width && rect.y + rect.height <= canvas.height;
}

function overlaps(left: PixelRect, right: PixelRect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width && left.y < right.y + right.height && right.y < left.y + left.height;
}

/** What is wrong with a layout (empty when it is usable). */
export function insetLayoutProblems(layout: Pick<InsetLayout, "canvas" | "reference" | "repaint">): string[] {
  const problems: string[] = [];
  const { canvas, reference, repaint } = layout;
  const integers = [canvas.width, canvas.height, reference.x, reference.y, reference.width, reference.height, repaint.x, repaint.y, repaint.width, repaint.height];
  if (!integers.every((value) => Number.isInteger(value))) problems.push("not integer pixels");
  if (canvas.width % INSET_CANVAS_STEP || canvas.height % INSET_CANVAS_STEP) problems.push(`canvas sides are not multiples of ${INSET_CANVAS_STEP}`);
  if (!inside(reference, canvas)) problems.push("reference box outside the canvas");
  if (!inside(repaint, canvas)) problems.push("repaint box outside the canvas");
  if ([repaint.x, repaint.y, repaint.x + repaint.width, repaint.y + repaint.height].some((edge) => edge % INSET_BLOCK)) problems.push(`mask edges are not on ${INSET_BLOCK}-px blocks`);
  if (overlaps(reference, repaint)) problems.push("reference and repaint boxes overlap");
  return problems;
}

/** The reference's drawn box: contained in `box` (scaled up or down, aspect kept), centred, integer pixels. */
export function fitContain(source: { width: number; height: number }, box: PixelRect): PixelRect {
  if (!(source.width > 0) || !(source.height > 0)) return { ...box };
  const scale = Math.min(box.width / source.width, box.height / source.height);
  const width = Math.max(1, Math.min(box.width, Math.round(source.width * scale)));
  const height = Math.max(1, Math.min(box.height, Math.round(source.height * scale)));
  return { x: box.x + Math.floor((box.width - width) / 2), y: box.y + Math.floor((box.height - height) / 2), width, height };
}

/** Mask value at a pixel: 255 (white, repaint) inside the repaint box, else 0 (black, keep). */
export function insetMaskValue(layout: Pick<InsetLayout, "repaint">, x: number, y: number): 0 | 255 {
  const { repaint } = layout;
  return x >= repaint.x && x < repaint.x + repaint.width && y >= repaint.y && y < repaint.y + repaint.height ? 255 : 0;
}

/** Largest side a crop rectangle may name. */
export const MAX_CROP_SIDE = 16384;

/** A crop rectangle from untrusted input (stored data, a message), or null when it is not usable. */
export function normalizePixelRect(value: unknown): PixelRect | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Partial<Record<keyof PixelRect, unknown>>;
  const fields = [record.x, record.y, record.width, record.height];
  if (!fields.every((field) => typeof field === "number" && Number.isInteger(field))) return null;
  const [x, y, width, height] = fields as number[];
  if (x! < 0 || y! < 0 || width! < 1 || height! < 1 || x! + width! > MAX_CROP_SIDE || y! + height! > MAX_CROP_SIDE) return null;
  return { x: x!, y: y!, width: width!, height: height! };
}
