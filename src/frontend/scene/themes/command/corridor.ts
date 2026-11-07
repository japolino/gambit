/**
 * The delve as the old crawlers drew it: a grid raycaster at the screen's
 * virtual resolution (one ray per virtual pixel column), brick walls with
 * black mortar, a dithered floor and ceiling falling off into the dark, a
 * door where the map has a lock, and a floor hatch where a room waits.
 * Every pixel lands on the theme's palette, so the corridor is the same
 * resolution and colours as the rest of the screen.
 */
import type { DelveView } from "../contract.js";
import { bayer, type PaletteId } from "./pixels.js";

type Rgb = [number, number, number];

/** Brick, mortar, door and mark colours per palette (all from that palette). */
const INKS: Record<PaletteId, { brick: Rgb; brick2: Rgb; mortar: Rgb; floor: Rgb; floor2: Rgb; door: Rgb; doorDark: Rgb; mark: Rgb; boss: Rgb }> = {
  ega: { brick: [170, 170, 170], brick2: [255, 255, 255], mortar: [85, 85, 85], floor: [85, 85, 85], floor2: [170, 85, 0], door: [170, 85, 0], doorDark: [85, 85, 85], mark: [255, 255, 85], boss: [255, 85, 85] },
  cga: { brick: [85, 255, 255], brick2: [255, 255, 255], mortar: [0, 0, 0], floor: [255, 85, 255], floor2: [85, 255, 255], door: [255, 85, 255], doorDark: [0, 0, 0], mark: [255, 255, 255], boss: [255, 85, 255] },
  mono: { brick: [170, 170, 170], brick2: [255, 255, 255], mortar: [85, 85, 85], floor: [85, 85, 85], floor2: [170, 170, 170], door: [170, 170, 170], doorDark: [85, 85, 85], mark: [255, 255, 255], boss: [255, 255, 255] },
};

const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

/** Brick pattern in wall space (u across one cell, v down its height): 0 mortar, 1 brick, 2 lit brick edge. */
function brick(u: number, v: number): number {
  const rows = 9;
  const ry = v * rows;
  const row = Math.floor(ry);
  const fy = ry - row;
  const bx = u * 4 + (row % 2 ? 0.5 : 0);
  const fx = bx - Math.floor(bx);
  if (fy < 0.13 || fx < 0.05) return 0;
  if (fy < 0.26 || fx < 0.1) return 2;
  return 1;
}

/** Draw the corridor into `out` (its pixel size is the virtual resolution). */
export function drawCorridor(out: HTMLCanvasElement, d: DelveView, pal: PaletteId): void {
  const W = out.width;
  const H = out.height;
  const g = out.getContext("2d")!;
  const img = g.createImageData(W, H);
  const px = img.data;
  const ink = INKS[pal];
  const cell = (x: number, y: number): string => {
    const c = d.grid[y]?.[x];
    return c === undefined || c === "?" ? "#" : c;
  };
  const f = d.facing;
  const dirX = DX[f]!;
  const dirY = DY[f]!;
  // Stand at the back of the cell, as the old crawlers do, so its side walls are in view.
  const posX = d.x + 0.5 - dirX * 0.42;
  const posY = d.y + 0.5 - dirY * 0.42;
  const fov = 0.92;
  const planeX = -dirY * fov;
  const planeY = dirX * fov;
  // Wall height in pixels at distance 1: square cells on screen.
  const scale = W / 2 / fov;
  const horizon = H / 2;
  const zbuf = new Float32Array(W);
  const put = (x: number, y: number, c: Rgb) => {
    const i = (y * W + x) * 4;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = 255;
  };
  const black: Rgb = [0, 0, 0];
  // Light falls off with distance: a pixel survives where the Bayer threshold says so.
  const lit = (x: number, y: number, dist: number) => bayer(x, y) + 0.5 < Math.max(0, Math.min(1, 1.25 - dist * 0.24));

  // Floor and ceiling first.
  for (let y = 0; y < H; y++) {
    const dy = Math.abs(y + 0.5 - horizon);
    const dist = (0.5 * scale) / Math.max(0.001, dy);
    const floor = y >= horizon;
    for (let x = 0; x < W; x++) {
      const k = Math.max(0, Math.min(1, 1.1 - dist * 0.3));
      const on = bayer(x, y) + 0.5 < k * (floor ? 0.75 : 0.45);
      put(x, y, on ? (floor && bayer(x + 3, y + 5) + 0.5 < k * 0.35 ? ink.floor2 : ink.floor) : black);
    }
  }

  // Walls: one ray per column, DDA through the grid.
  for (let x = 0; x < W; x++) {
    const camX = (2 * (x + 0.5)) / W - 1;
    const rx = dirX + planeX * camX;
    const ry = dirY + planeY * camX;
    let mx = Math.floor(posX);
    let my = Math.floor(posY);
    const ddx = Math.abs(1 / (rx || 1e-9));
    const ddy = Math.abs(1 / (ry || 1e-9));
    const sx = rx < 0 ? -1 : 1;
    const sy = ry < 0 ? -1 : 1;
    let sdx = rx < 0 ? (posX - mx) * ddx : (mx + 1 - posX) * ddx;
    let sdy = ry < 0 ? (posY - my) * ddy : (my + 1 - posY) * ddy;
    let side = 0;
    let hit = "#";
    for (let n = 0; n < 24; n++) {
      if (sdx < sdy) {
        sdx += ddx;
        mx += sx;
        side = 0;
      } else {
        sdy += ddy;
        my += sy;
        side = 1;
      }
      const c = cell(mx, my);
      if (c === "#" || c === "L") {
        hit = c;
        break;
      }
    }
    const dist = Math.max(0.05, side === 0 ? sdx - ddx : sdy - ddy);
    zbuf[x] = dist;
    const hgt = scale / dist;
    const top = horizon - hgt / 2;
    const y0 = Math.max(0, Math.floor(top));
    const y1 = Math.min(H, Math.ceil(horizon + hgt / 2));
    let u = side === 0 ? posY + dist * ry : posX + dist * rx;
    u -= Math.floor(u);
    // Faces lit from the side read darker: fewer bricks survive the dither.
    const shadeDist = dist + (side === 1 ? 0.9 : 0);
    // Wall edges (corners) get a solid outline column.
    const edge = u < 0.02 || u > 0.98;
    for (let y = y0; y < y1; y++) {
      const v = (y + 0.5 - top) / hgt;
      let c: Rgb = black;
      if (hit === "L") {
        const frame = u < 0.12 || u > 0.88 || v < 0.1;
        const plank = Math.floor(u * 6) % 2 === 0;
        const band = (v > 0.28 && v < 0.34) || (v > 0.7 && v < 0.76);
        c = frame ? ink.brick : band ? ink.mark : plank ? ink.door : ink.doorDark;
        if (u > 0.68 && u < 0.76 && v > 0.5 && v < 0.58) c = ink.mark;
      } else {
        const b = edge ? 0 : brick(u, v);
        c = b === 0 ? ink.mortar : b === 2 ? ink.brick2 : ink.brick;
        if (edge || v < 0.012 || v > 0.988) c = black;
      }
      if (!lit(x, y, shadeDist)) c = c === ink.brick2 && lit(x, y, shadeDist - 1.2) ? ink.mortar : black;
      put(x, y, c);
    }
  }

  // Rooms waiting on the floor: a hatch, as the old maps marked them.
  const invDet = 1 / (planeX * dirY - dirX * planeY);
  const project = (wx: number, wy: number): [number, number, number] => {
    const rx = wx - posX;
    const ry = wy - posY;
    const tx = invDet * (dirY * rx - dirX * ry);
    const ty = invDet * (-planeY * rx + planeX * ry);
    return [(W / 2) * (1 + tx / ty), horizon + (0.5 * scale) / ty, ty];
  };
  for (const r of d.rooms) {
    if (r.cleared && r.kind !== "boss") continue;
    const [, , depth] = project(r.x + 0.5, r.y + 0.5);
    if (depth < 0.2 || depth > 5) continue;
    const corners = [project(r.x + 0.25, r.y + 0.25), project(r.x + 0.75, r.y + 0.25), project(r.x + 0.75, r.y + 0.75), project(r.x + 0.25, r.y + 0.75)];
    const xs = corners.map((c) => c[0]);
    const ys = corners.map((c) => c[1]);
    const colour = r.kind === "boss" || r.kind === "fight" ? ink.boss : ink.mark;
    const minX = Math.max(0, Math.floor(Math.min(...xs)));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(...xs)));
    const minY = Math.max(0, Math.floor(Math.min(...ys)));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(...ys)));
    const inside = (x: number, y: number) => {
      let s = 0;
      for (let i = 0; i < 4; i++) {
        const a = corners[i]!;
        const b = corners[(i + 1) % 4]!;
        const cr = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
        s += cr > 0 ? 1 : cr < 0 ? -1 : 0;
      }
      return Math.abs(s) === 4;
    };
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (zbuf[x]! < depth - 0.3) continue;
        if (!inside(x + 0.5, y + 0.5)) continue;
        const rim = !inside(x - 0.5, y + 0.5) || !inside(x + 1.5, y + 0.5) || !inside(x + 0.5, y - 0.5) || !inside(x + 0.5, y + 1.5);
        put(x, y, rim ? colour : (x + y) % 2 ? black : ink.mortar);
      }
    }
  }
  g.putImageData(img, 0, 0);
}
