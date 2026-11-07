/**
 * Builds a puppet rig for a battle figure (docs/DESIGN.md, 5.6). Pure. The
 * opaque bbox comes from the texture's alpha; the face box from the framing
 * estimate Cue uses when no detector box is known (estimateSpriteFace, in
 * the vendored shims), since Gambit runs no face model. A detected or
 * authored face box can be passed instead.
 *
 * Gambit's rig variants (floating, serpentine, huge) reuse Cue's rig and
 * pose and add their own displacement on top (variants.ts).
 */
import type { RigKind } from "../../../engine/types.js";
import { spriteFaceSpot, spriteGeometry, type SpriteFaceBox } from "../../../vendor/cue-puppet/shims.js";
import { puppetRig, type PuppetRig } from "../../../vendor/cue-puppet/sprite-puppet-rig.js";

export type AlphaBox = [number, number, number, number];

/**
 * The opaque bbox of RGBA pixels, normalized [x, y, w, h], or null when the
 * image is empty. Pixels at or under `threshold` alpha are transparent; a
 * row or column counts once it has `minRun` opaque pixels (stray specks of
 * a soft edge do not stretch the box). Samples every `step` pixels.
 */
export function alphaBBox(data: Uint8ClampedArray | Uint8Array, width: number, height: number, threshold = 24, step = 2, minRun = 2): AlphaBox | null {
  const rows = new Uint16Array(height);
  const cols = new Uint16Array(width);
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (data[(y * width + x) * 4 + 3]! > threshold) {
        rows[y]! += 1;
        cols[x]! += 1;
      }
    }
  }
  let top = -1, bottom = -1, left = -1, right = -1;
  for (let y = 0; y < height; y += 1) if (rows[y]! >= minRun) { top = y; break; }
  for (let y = height - 1; y >= 0; y -= 1) if (rows[y]! >= minRun) { bottom = y; break; }
  for (let x = 0; x < width; x += 1) if (cols[x]! >= minRun) { left = x; break; }
  for (let x = width - 1; x >= 0; x -= 1) if (cols[x]! >= minRun) { right = x; break; }
  if (top < 0 || left < 0) return null;
  const pad = step;
  const x0 = Math.max(0, left - pad / 2);
  const y0 = Math.max(0, top - pad / 2);
  const x1 = Math.min(width, right + pad);
  const y1 = Math.min(height, bottom + pad);
  return [x0 / width, y0 / height, (x1 - x0) / width, (y1 - y0) / height];
}

export type FigureRig = {
  rig: PuppetRig;
  kind: RigKind;
  /** Normalized bbox [x, y, w, h]. */
  bbox: AlphaBox;
  /** Pixel size of the source image. */
  width: number;
  height: number;
  /** Where the face is (normalized to the image, y down), for hit sparks and cut-in crops. */
  face: { x: number; y: number; w: number; h: number };
};

/** A rig for a figure image of a given rig kind. */
export function buildFigureRig(kind: RigKind, bbox: AlphaBox, width: number, height: number, face?: SpriteFaceBox | null): FigureRig {
  // A huge figure overflows the frame: its anchor sits below the image, so
  // the bbox is treated as cut by the bottom edge (the bust branch of the estimate).
  const box: AlphaBox = kind === "huge" ? [bbox[0], bbox[1], bbox[2], 1 - bbox[1]] : bbox;
  const image = { bbox: box, width, height, face: face ?? null };
  const geometry = spriteGeometry(image);
  const spot = spriteFaceSpot(image, geometry);
  const rig = puppetRig(geometry, spot);
  const faceH = spot.top - spot.bottom;
  return {
    rig,
    kind,
    bbox: box,
    width,
    height,
    face: {
      x: geometry.cx + spot.dx,
      y: geometry.by - (spot.top + spot.bottom) / 2,
      w: spot.w,
      h: faceH,
    },
  };
}
