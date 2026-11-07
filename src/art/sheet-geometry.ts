/**
 * Icon-sheet geometry (pure): where each cell of a generated grid sheet is,
 * and how far in to cut so the gutters and neighbours' edges stay out. The
 * browser does the drawing (src/frontend/art/pixels.ts); this is shared so
 * the backend can validate and tests can pin the numbers.
 */
import type { PixelRect } from "./inset-geometry.js";

export type SheetGrid = { cols: number; rows: number };

/** Gambit's GPT icon sheet: 4x4 on a 1024x1024 canvas (docs/DESIGN.md, 5.3). */
export const ICON_SHEET_GRID: SheetGrid = { cols: 4, rows: 4 };
export const ICON_SHEET_SIZE = { width: 1024, height: 1024 };
/** Share of a cell cut away on each side (gutters, bleeding neighbours). */
export const ICON_SHEET_MARGIN = 0.04;
export const MAX_SHEET_CELLS = 64;

export function validGrid(grid: unknown): grid is SheetGrid {
  if (!grid || typeof grid !== "object") return false;
  const { cols, rows } = grid as Partial<SheetGrid>;
  return Number.isInteger(cols) && Number.isInteger(rows) && cols! >= 1 && rows! >= 1 && cols! * rows! <= MAX_SHEET_CELLS;
}

/**
 * The cells of a sheet, row-major, each shrunk by `margin` (a share of the
 * cell) on every side. Cell edges are spread with rounding so the cells tile
 * the whole image even when its size does not divide evenly. `count` limits
 * the cells returned (a sheet asked for fewer icons than it has cells).
 */
export function sheetCells(size: { width: number; height: number }, grid: SheetGrid, margin = ICON_SHEET_MARGIN, count = grid.cols * grid.rows): PixelRect[] {
  if (!validGrid(grid) || !(size.width >= grid.cols) || !(size.height >= grid.rows)) return [];
  const m = Math.min(0.45, Math.max(0, margin));
  const cells: PixelRect[] = [];
  const total = Math.min(count, grid.cols * grid.rows);
  for (let i = 0; i < total; i++) {
    const c = i % grid.cols;
    const r = Math.floor(i / grid.cols);
    const x0 = Math.round((c * size.width) / grid.cols);
    const x1 = Math.round(((c + 1) * size.width) / grid.cols);
    const y0 = Math.round((r * size.height) / grid.rows);
    const y1 = Math.round(((r + 1) * size.height) / grid.rows);
    const dx = Math.floor((x1 - x0) * m);
    const dy = Math.floor((y1 - y0) * m);
    cells.push({ x: x0 + dx, y: y0 + dy, width: Math.max(1, x1 - x0 - 2 * dx), height: Math.max(1, y1 - y0 - 2 * dy) });
  }
  return cells;
}

/**
 * Bounding box of the pixels whose alpha is above `threshold` (RGBA, row
 * major), or null when every pixel is transparent. Used to trim icons cut
 * from a transparent sheet.
 */
export function alphaBounds(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, threshold = 8): PixelRect | null {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3]! > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** A square box centred on `rect`, padded by `pad` (share of the long side), clamped to the image. */
export function squareAround(rect: PixelRect, image: { width: number; height: number }, pad = 0.06): PixelRect {
  const side0 = Math.max(rect.width, rect.height);
  const side = Math.min(Math.max(image.width, image.height), Math.round(side0 * (1 + 2 * pad)));
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const w = Math.min(side, image.width);
  const h = Math.min(side, image.height);
  const x = Math.min(Math.max(0, Math.round(cx - w / 2)), image.width - w);
  const y = Math.min(Math.max(0, Math.round(cy - h / 2)), image.height - h);
  return { x, y, width: w, height: h };
}
