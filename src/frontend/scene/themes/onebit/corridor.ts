/**
 * The delve as a first-person crawler view drawn on the theme's own pixel
 * grid: a small grid raycaster (walls, floor and ceiling cast per pixel,
 * room props as billboards) producing a luminance field that the frame
 * buffer dithers. The light is a carried torch, so stone falls off into pure
 * black down the hall, the way 1-bit crawlers sculpted depth out of dither.
 * Steps and turns glide between cells instead of cutting.
 */
import type { DelveView } from "../contract.js";
import { rng } from "../contract.js";

const TS = 64;
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

interface Cam { x: number; y: number; a: number }

/** A procedural texture: TS x TS luminance. */
function tex(fn: (x: number, y: number, r: () => number) => number, seed: number): Float32Array {
  const r = rng(seed);
  const out = new Float32Array(TS * TS);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) out[y * TS + x] = fn(x, y, r);
  return out;
}

/** Scratch random marks (cracks) into a texture. */
function crack(t: Float32Array, seed: number, n: number, depth: number): void {
  const r = rng(seed);
  for (let k = 0; k < n; k++) {
    let x = r() * TS, y = r() * TS;
    let a = r() * Math.PI * 2;
    const len = 6 + r() * 16;
    for (let i = 0; i < len; i++) {
      t[(Math.floor(y) & (TS - 1)) * TS + (Math.floor(x) & (TS - 1))] *= depth;
      a += (r() - 0.5) * 0.9;
      x += Math.cos(a);
      y += Math.sin(a);
    }
  }
}

function stoneWall(): Float32Array {
  // Bevelled ashlar: per-brick tone, a lit top edge and a shadowed lower edge.
  const tones = rng(31);
  const tone = Array.from({ length: 16 }, () => 0.42 + tones() * 0.3);
  // Uneven courses, so no mortar line runs along the horizon of every wall.
  const COURSE = [0, 13, 24, 38, 50, 64];
  const t = tex((x, y, r) => {
    let row = 0;
    while (y >= COURSE[row + 1]!) row++;
    const yy = y - COURSE[row]!, hh = COURSE[row + 1]! - COURSE[row]!;
    const shift = [0, 17, 7, 23, 11][row]!;
    const bx = (x + shift) & 63;
    const brick = (row * 3 + (bx >> 5)) & 15;
    const xx = bx & 31;
    if (yy < 2 || xx < 2) return 0.03;
    let l = tone[brick]! + (r() - 0.5) * 0.18;
    if (yy === 2 || xx === 2) l += 0.24;
    if (yy === hh - 1 || xx === 31) l -= 0.25;
    return l;
  }, 7);
  crack(t, 9, 7, 0.35);
  return t;
}

function doorTex(): Float32Array {
  return tex((x, y, r) => {
    if (x < 4 || x > 59 || y < 3) return 0.2 + r() * 0.1; // stone jamb
    if ((y > 12 && y < 17) || (y > 46 && y < 51)) return (x & 7) === 4 && (y === 14 || y === 48) ? 1 : 0.12; // iron bands, rivets
    if (x > 42 && x < 47 && y > 28 && y < 38) return y < 33 ? 0.02 : (x === 44 || x === 45 ? 0.02 : 0.7); // keyhole
    const plank = ((x - 4) % 11) === 0;
    return plank ? 0.05 : 0.5 + Math.sin(y * 0.35 + (x >> 2)) * 0.06 + (r() - 0.5) * 0.12;
  }, 13);
}

function floorTex(): Float32Array {
  const t = tex((x, y, r) => {
    const xx = (x + ((y >> 5) & 1) * 16) & 31, yy = y & 31;
    if (xx < 1 || yy < 1) return 0.03;
    return 0.55 + (r() - 0.5) * 0.2 + (yy === 1 ? 0.12 : 0);
  }, 17);
  crack(t, 19, 5, 0.4);
  return t;
}

function ceilTex(): Float32Array {
  return tex((x, y, r) => ((y & 31) < 3 ? 0.02 : 0.16 + (r() - 0.5) * 0.1 + ((x & 15) === 0 ? -0.08 : 0)), 23);
}

/** Room props, as billboards: '#' bright, '.' dark, ' ' clear. */
const CHEST = [
  "   ##########   ",
  "  #..........#  ",
  " #.##########.# ",
  " #.#........#.# ",
  "################",
  "#..............#",
  "#.####.##.####.#",
  "#.#..#.##.#..#.#",
  "#.####.##.####.#",
  "#..............#",
  "#.############.#",
  "################",
];
const SKULL = [
  "  #   ####   #  ",
  " #.# ###### #.# ",
  " #..########..# ",
  "  ############  ",
  "  ##..####..##  ",
  "  #....##....#  ",
  "  ##..####..##  ",
  "   ####..####   ",
  "    ########    ",
  "    #.#.#.##    ",
  "     ######     ",
  "      ####      ",
  "      ####      ",
  "     ######     ",
  "    ########    ",
  "   ##########   ",
];
const FIRE = [
  "       #        ",
  "      ##    #   ",
  "     ###   ##   ",
  "    ####  ###   ",
  "   ##.### ####  ",
  "   #..########  ",
  "  ##...#####.## ",
  "  #....###....# ",
  "  ##..........# ",
  "   ##........## ",
  " ##.##########.#",
  "#..#..#..#..#..#",
  " ############## ",
];
const SPIKES = [
  "  #   #   #   # ",
  " ##  ##  ##  ## ",
  " ##  ##  ##  ## ",
  "###.###.###.### ",
  "################",
];

export class Corridor {
  private wall = stoneWall();
  private door = doorTex();
  private floor = floorTex();
  private ceil = ceilTex();
  private skin: Float32Array | null = null;
  private skinUrl: string | null = null;
  private cam: Cam | null = null;
  private goal: Cam = { x: 0, y: 0, a: 0 };
  private lum = new Float32Array(1);
  private z = new Float32Array(1);
  private moving = 0;

  /** A painted wall texture, when there is one, modulates the stone. */
  setSkin(url: string | null, field: Float32Array | null): void {
    if (url === this.skinUrl && field === this.skin) return;
    this.skinUrl = url;
    this.skin = field;
  }

  /** Aim at the current cell; glide there unless `snap`. */
  aim(d: DelveView, snap: boolean): void {
    const dx = DX[d.facing]!, dy = DY[d.facing]!;
    // Stand at the back of the cell, as crawlers do, so its side walls are in view.
    const g = { x: d.x + 0.5 - dx * 0.38, y: d.y + 0.5 - dy * 0.38, a: Math.atan2(dy, dx) };
    if (!this.cam || snap) {
      this.cam = { ...g };
    } else {
      while (g.a - this.cam.a > Math.PI) g.a -= Math.PI * 2;
      while (g.a - this.cam.a < -Math.PI) g.a += Math.PI * 2;
    }
    if (g.x !== this.goal.x || g.y !== this.goal.y || g.a !== this.goal.a) this.moving = 1;
    this.goal = g;
  }

  /** Advance the glide; true while still moving. */
  tick(dt: number): boolean {
    const c = this.cam;
    if (!c) return false;
    const k = 1 - Math.exp(-dt * 11);
    c.x += (this.goal.x - c.x) * k;
    c.y += (this.goal.y - c.y) * k;
    c.a += (this.goal.a - c.a) * k;
    const far = Math.abs(this.goal.x - c.x) + Math.abs(this.goal.y - c.y) + Math.abs(this.goal.a - c.a);
    if (far < 0.002) {
      c.x = this.goal.x; c.y = this.goal.y; c.a = this.goal.a;
      this.moving = 0;
      return false;
    }
    this.moving = Math.min(1, far * 3);
    return true;
  }

  /** The view as luminance (w x h). `torch` ~1 scales the light (flicker). */
  render(w: number, h: number, d: DelveView, t: number, torch: number): Float32Array {
    if (this.lum.length !== w * h) this.lum = new Float32Array(w * h);
    if (this.z.length !== w) this.z = new Float32Array(w);
    const out = this.lum;
    const c = this.cam;
    if (!c) return out.fill(0);
    const grid = d.grid;
    const at = (x: number, y: number) => grid[y]?.[x] ?? "#";
    const solid = (ch: string) => ch === "#" || ch === "?" || ch === "L";
    const dirX = Math.cos(c.a), dirY = Math.sin(c.a);
    const P = 0.72; // tan(half the horizontal field of view)
    const plX = -dirY * P, plY = dirX * P;
    const focal = w / 2 / P;
    const bob = Math.sin(t * 9) * this.moving * 1.5;
    const hor = h / 2 + bob;
    const light = (dist: number) => Math.min(1.05, (1.25 * torch) / (1 + dist * dist * 0.75)) * (dist > 4.5 ? Math.max(0, 1 - (dist - 4.5) * 0.8) : 1);
    const wall = this.wall, skin = this.skin;
    const S = TS - 1;
    for (let x = 0; x < w; x++) {
      const cx = (2 * x) / w - 1;
      const rx = dirX + plX * cx, ry = dirY + plY * cx;
      let mx = Math.floor(c.x), my = Math.floor(c.y);
      const ddx = Math.abs(1 / (rx || 1e-9)), ddy = Math.abs(1 / (ry || 1e-9));
      const sx = rx < 0 ? -1 : 1, sy = ry < 0 ? -1 : 1;
      let sdx = rx < 0 ? (c.x - mx) * ddx : (mx + 1 - c.x) * ddx;
      let sdy = ry < 0 ? (c.y - my) * ddy : (my + 1 - c.y) * ddy;
      let side = 0, hit = "#";
      for (let i = 0; i < 32; i++) {
        if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; }
        hit = at(mx, my);
        if (solid(hit)) break;
      }
      const dist = Math.max(0.05, side === 0 ? sdx - ddx : sdy - ddy);
      this.z[x] = dist;
      let wx = side === 0 ? c.y + dist * ry : c.x + dist * rx;
      wx -= Math.floor(wx);
      const tx = hit === "L" ? this.door : wall;
      // Stone repeats twice per cell (smaller courses read as a real wall); a door fills its cell.
      const rep = tx === wall ? 2 : 1;
      const u = Math.floor(wx * TS * rep) & S;
      const lineH = focal / dist;
      const top = hor - lineH / 2, bot = hor + lineH / 2;
      const wl = light(dist) * (side ? 0.7 : 1);
      for (let y = 0; y < h; y++) {
        let l: number;
        if (y >= top && y < bot) {
          const v = Math.floor(((y - top) / lineH) * TS * rep) & S;
          let s = tx[v * TS + u]!;
          if (skin && tx === wall) s *= 0.72 + skin[v * TS + u]! * 0.45;
          l = s * wl;
        } else {
          const below = y >= bot;
          const rd = (focal * 0.5) / Math.max(0.5, below ? y - hor : hor - y);
          const fx = c.x + rd * rx, fy = c.y + rd * ry;
          const tu = Math.floor((fx - Math.floor(fx)) * TS) & S, tv = Math.floor((fy - Math.floor(fy)) * TS) & S;
          l = (below ? this.floor : this.ceil)[tv * TS + tu]! * light(rd * 1.25) * (below ? 1 : 0.75);
        }
        // A gamma on the torchlight: midtones sink toward black, lit stone stays bright.
        out[y * w + x] = Math.pow(l, 1.4) * 1.45;
      }
    }
    // Room props stand on the floor of their cell.
    const invDet = 1 / (plX * dirY - dirX * plY);
    const props = d.rooms
      .filter((r) => !r.cleared && (r.kind === "key" || r.kind === "treasure" || r.kind === "boss" || r.kind === "rest" || r.kind === "trap"))
      .map((r) => {
        const sx = r.x + 0.5 - c.x, sy = r.y + 0.5 - c.y;
        return { r, tx: invDet * (dirY * sx - dirX * sy), ty: invDet * (-plY * sx + plX * sy) };
      })
      .filter((p) => p.ty > 0.15)
      .sort((a, b) => b.ty - a.ty);
    for (const p of props) {
      const art = p.r.kind === "boss" ? SKULL : p.r.kind === "rest" ? FIRE : p.r.kind === "trap" ? SPIKES : CHEST;
      const aw = art[0]!.length, ah = art.length;
      const scale = p.r.kind === "boss" ? 0.5 : 0.34;
      const ph = (focal * scale) / p.ty;
      const pw = ph * (aw / ah);
      const scx = (w / 2) * (1 + p.tx / p.ty);
      const bottom = hor + (focal * 0.5) / p.ty;
      const glint = p.r.kind === "key" || p.r.kind === "treasure" ? 0.25 + 0.25 * Math.sin(t * 5) : 0;
      const L = Math.min(1.3, light(p.ty) * 1.25 + glint);
      const x0 = Math.floor(scx - pw / 2), x1 = Math.ceil(scx + pw / 2);
      const y0 = Math.floor(bottom - ph), y1 = Math.ceil(bottom);
      for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) {
        if (p.ty >= this.z[x]!) continue;
        const ax = Math.floor(((x - x0) / (x1 - x0)) * aw);
        for (let y = Math.max(0, y0); y < Math.min(h, y1); y++) {
          const ay = Math.floor(((y - y0) / (y1 - y0)) * ah);
          const ch = art[ay]?.[ax];
          if (ch === "#") out[y * w + x] = 0.95 * L;
          else if (ch === ".") out[y * w + x] = 0;
        }
      }
    }
    return out;
  }
}
