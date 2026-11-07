/**
 * Transparent-source detection for the stage and the art helpers.
 *
 * `isPreCut` is ported from Cue:
 *   repo:   visual-novel-preview (D:\Lumiverse\visual-novel-preview)
 *   branch: origin/testing @ ab0fa34 (file last changed at f2228ee)
 *   path:   src/frontend/sprites/cutout/kernel.ts `isPreCut` (params
 *           `cutAlpha: 8`, `cutBorder: 0.5`), documented in docs/SPRITE_MODE.md
 *           "Cut-out (frontend)", "Pre-cut sources".
 * A source is already cut out when at least half of its 1-px border has
 * alpha <= 8 and some pixel is fully opaque: keep its own alpha (no cut-out
 * model). Images with a few transparent pixels on an opaque frame still
 * count as opaque. Judge an inset render after its crop (on the whole
 * canvas, the opaque reference half would be half of the border).
 *
 * `mayBeTransparent` (header only) is the same port as src/art/png.ts.
 */
import { encodedMayBeTransparent } from "../../art/png.js";

/** Border pixels with alpha at most this are transparent ... */
export const PRE_CUT_ALPHA = 8;
/** ... and the source is pre-cut when at least this share of the border is. */
export const PRE_CUT_BORDER = 0.5;

export function isPreCut(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): boolean {
  if (width < 1 || height < 1) return false;
  let border = 0;
  let clear = 0;
  const at = (x: number, y: number): void => {
    border++;
    if (rgba[(y * width + x) * 4 + 3]! <= PRE_CUT_ALPHA) clear++;
  };
  for (let x = 0; x < width; x++) {
    at(x, 0);
    if (height > 1) at(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    at(0, y);
    if (width > 1) at(width - 1, y);
  }
  if (clear < border * PRE_CUT_BORDER) return false;
  for (let o = 3; o < rgba.length; o += 4) if (rgba[o] === 255) return true;
  return false;
}

/** Whether an encoded image can be transparent at all (PNG alpha / tRNS, WebP alpha), from its header. */
export async function mayBeTransparent(image: Blob): Promise<boolean> {
  try {
    return encodedMayBeTransparent(new Uint8Array(await image.slice(0, 65536).arrayBuffer()));
  } catch {
    return false;
  }
}
