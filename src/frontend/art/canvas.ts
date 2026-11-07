/**
 * Canvas helpers for the art pipeline (browser, main thread): the NovelAI V5
 * reference inset canvas and mask, crops, and icon-sheet slicing.
 *
 * `makeCanvas`, `toPng`, `composeInset` and `cropImageBlob` are ported from
 * Cue:
 *   repo:   visual-novel-preview (D:\Lumiverse\visual-novel-preview)
 *   branch: origin/testing @ ab0fa34 (file last changed at 7b1c360)
 *   path:   src/frontend/sprites/canvas-tools.ts
 * Changes: Gambit's layout types; crops and slices also report `preCut`.
 * OffscreenCanvas where it exists, else a detached <canvas>.
 */
import { fitContain, type InsetLayout, type PixelRect } from "../../art/inset-geometry.js";
import { alphaBounds, sheetCells, squareAround, type SheetGrid } from "../../art/sheet-geometry.js";
import { isPreCut } from "./alpha.js";

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;
type Context2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

export function makeCanvas(width: number, height: number): { canvas: AnyCanvas; context: Context2D } {
  if (typeof OffscreenCanvas === "function") {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (context) return { canvas, context };
  }
  if (typeof document === "undefined") throw new Error("This browser cannot draw images (no canvas).");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot draw images (no 2D canvas).");
  return { canvas, context };
}

export async function toPng(canvas: AnyCanvas): Promise<Blob> {
  if ("convertToBlob" in canvas) return canvas.convertToBlob({ type: "image/png" });
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The canvas could not be saved as PNG."))), "image/png");
  });
}

/**
 * The inset canvas (white, the reference contained and centred in the
 * layout's reference box) and its mask (black keep, white repaint), both
 * PNGs of the canvas size.
 */
export async function composeInset(reference: Blob, layout: InsetLayout): Promise<{ image: Blob; mask: Blob }> {
  const bitmap = await createImageBitmap(reference);
  try {
    const { width, height } = layout.canvas;
    const image = makeCanvas(width, height);
    image.context.fillStyle = "#ffffff";
    image.context.fillRect(0, 0, width, height);
    const box = fitContain({ width: bitmap.width, height: bitmap.height }, layout.reference);
    image.context.imageSmoothingEnabled = true;
    image.context.imageSmoothingQuality = "high";
    // A transparent reference (a cut-out) lands on white.
    image.context.drawImage(bitmap, box.x, box.y, box.width, box.height);
    const mask = makeCanvas(width, height);
    mask.context.fillStyle = "#000000";
    mask.context.fillRect(0, 0, width, height);
    mask.context.fillStyle = "#ffffff";
    mask.context.fillRect(layout.repaint.x, layout.repaint.y, layout.repaint.width, layout.repaint.height);
    return { image: await toPng(image.canvas), mask: await toPng(mask.canvas) };
  } finally {
    bitmap.close();
  }
}

export interface PixelResult {
  png: Blob;
  width: number;
  height: number;
  preCut: boolean;
}

/** `blob` cropped to `rect` as a PNG. Throws when the rectangle is not inside the image. */
export async function cropImageBlob(blob: Blob, rect: PixelRect): Promise<PixelResult> {
  const bitmap = await createImageBitmap(blob);
  try {
    if (rect.x + rect.width > bitmap.width || rect.y + rect.height > bitmap.height) {
      throw new Error(`The crop ${rect.width}x${rect.height} at ${rect.x},${rect.y} is outside the ${bitmap.width}x${bitmap.height} image.`);
    }
    const target = makeCanvas(rect.width, rect.height);
    target.context.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
    const data = target.context.getImageData(0, 0, rect.width, rect.height).data;
    return { png: await toPng(target.canvas), width: rect.width, height: rect.height, preCut: isPreCut(data, rect.width, rect.height) };
  } finally {
    bitmap.close();
  }
}

/**
 * Slice a grid sheet into cells (row-major, `count` of them), each shrunk by
 * `margin`. With `trim`, a cell is cut to its opaque pixels and padded to a
 * square (transparent sheets); cells with no opaque pixel stay whole.
 */
export async function sliceSheet(blob: Blob, grid: SheetGrid, count: number, margin: number, trim: boolean): Promise<PixelResult[]> {
  const bitmap = await createImageBitmap(blob);
  try {
    const cells = sheetCells({ width: bitmap.width, height: bitmap.height }, grid, margin, count);
    const out: PixelResult[] = [];
    for (const cell of cells) {
      const first = makeCanvas(cell.width, cell.height);
      first.context.drawImage(bitmap, cell.x, cell.y, cell.width, cell.height, 0, 0, cell.width, cell.height);
      let data = first.context.getImageData(0, 0, cell.width, cell.height).data;
      let canvas = first.canvas;
      let width = cell.width;
      let height = cell.height;
      if (trim) {
        const bounds = alphaBounds(data, cell.width, cell.height);
        if (bounds) {
          const box = squareAround(bounds, { width: cell.width, height: cell.height });
          const square = Math.max(box.width, box.height);
          const second = makeCanvas(square, square);
          second.context.drawImage(first.canvas as CanvasImageSource, box.x, box.y, box.width, box.height, Math.floor((square - box.width) / 2), Math.floor((square - box.height) / 2), box.width, box.height);
          canvas = second.canvas;
          width = height = square;
          data = second.context.getImageData(0, 0, square, square).data;
        }
      }
      out.push({ png: await toPng(canvas), width, height, preCut: isPreCut(data, width, height) });
    }
    return out;
  } finally {
    bitmap.close();
  }
}
