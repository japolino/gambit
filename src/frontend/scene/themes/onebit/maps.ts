/**
 * Maps on the 1-bit grid: the delve automap (hand-ruled cells, room glyphs,
 * your arrow) and the frontier honeycomb. The honeycomb is laid out by the
 * host's ctx.drawHex into an off-screen <svg>; its cells are then re-drawn
 * here as dithered terrain hexes, and the step / travel cells keep their SVG
 * click handlers (the theme's invisible buttons forward clicks to them).
 */
import type { DelveView } from "../contract.js";
import { INK, PAPER, type Frame, type Rect } from "./fb.js";

/** 5x5 room marks, drawn in ink on a lit cell. */
const MARK: Record<string, number[]> = {
  boss: [0b01110, 0b10101, 0b11111, 0b01010, 0b01110],
  key: [0b01100, 0b10010, 0b01100, 0b00100, 0b00110],
  treasure: [0b00000, 0b11111, 0b10101, 0b11111, 0b11111],
  rest: [0b00100, 0b01010, 0b00100, 0b11111, 0b00000],
  fight: [0b10001, 0b01010, 0b00100, 0b01010, 0b10001],
  trap: [0b00000, 0b00100, 0b01110, 0b11111, 0b00000],
  event: [0b00100, 0b00100, 0b00100, 0b00000, 0b00100],
  entrance: [0b11111, 0b10001, 0b10001, 0b10001, 0b10001],
};

/** The automap; returns the cell size used (for the caller's legend). */
export function drawAutomap(fb: Frame, r: Rect, d: DelveView, blink: boolean): number {
  fb.fill(r, INK);
  let x0 = d.x, x1 = d.x, y0 = d.y, y1 = d.y;
  const known = (x: number, y: number) => {
    const c = d.grid[y]?.[x];
    return c !== undefined && c !== "?";
  };
  d.grid.forEach((row, y) => [...row].forEach((c, x) => {
    if (c === "?") return;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }));
  const span = Math.max(x1 - x0 + 3, y1 - y0 + 3, 7);
  const cs = Math.max(3, Math.min(18, Math.floor(Math.min(r.w, r.h) / span)));
  const ox = r.x + Math.floor(r.w / 2 - ((x0 + x1 + 1) / 2) * cs);
  const oy = r.y + Math.floor(r.h / 2 - ((y0 + y1 + 1) / 2) * cs);
  const clip = (x: number, y: number, w: number, h: number): Rect => {
    const a = Math.max(r.x, x), b = Math.max(r.y, y);
    return { x: a, y: b, w: Math.min(r.x + r.w, x + w) - a, h: Math.min(r.y + r.h, y + h) - b };
  };
  // Unknown ground near what you have mapped: a faint graph-paper dot per cell
  // corner. Beyond two cells of it, pure dark: the map grows out of the black.
  const gx0 = Math.floor((r.x - ox) / cs) - 1, gy0 = Math.floor((r.y - oy) / cs) - 1;
  for (let gy = gy0; gy * cs + oy < r.y + r.h; gy++) for (let gx = gx0; gx * cs + ox < r.x + r.w; gx++) {
    if (known(gx, gy)) continue;
    let near = false;
    for (let j = -2; j <= 2 && !near; j++) for (let i = -2; i <= 2; i++) if (known(gx + i, gy + j)) { near = true; break; }
    if (!near) continue;
    const px = ox + gx * cs, py = oy + gy * cs;
    if (px >= r.x && py >= r.y && px < r.x + r.w && py < r.y + r.h) fb.set(px, py, PAPER);
  }
  const floor = (x: number, y: number) => known(x, y) && d.grid[y]![x] !== "#";
  d.grid.forEach((row, y) => [...row].forEach((c, x) => {
    const px = ox + x * cs, py = oy + y * cs;
    if (c === "?") return;
    if (c === "#") {
      // Rock: diagonal hatching, ruled hard where it meets a floor.
      const cr = clip(px, py, cs, cs);
      for (let j = cr.y; j < cr.y + cr.h; j++) for (let i = cr.x; i < cr.x + cr.w; i++) if ((i + j) % 3 === 0) fb.set(i, j, PAPER);
      if (floor(x, y - 1)) fb.fill(clip(px, py, cs, 1), PAPER);
      if (floor(x, y + 1)) fb.fill(clip(px, py + cs - 1, cs, 1), PAPER);
      if (floor(x - 1, y)) fb.fill(clip(px, py, 1, cs), PAPER);
      if (floor(x + 1, y)) fb.fill(clip(px + cs - 1, py, 1, cs), PAPER);
      return;
    }
    fb.fill(clip(px + 1, py + 1, cs - 2, cs - 2), PAPER);
    if (c === "L") {
      fb.fill(clip(px + 2, py + (cs >> 1) - 1, cs - 4, 2), INK);
      fb.fill(clip(px + (cs >> 1) - 1, py + 2, 2, cs - 4), INK);
    }
  }));
  for (const room of d.rooms) {
    const px = ox + room.x * cs, py = oy + room.y * cs;
    const m = MARK[room.kind];
    if (!m) continue;
    if (room.cleared && room.kind !== "boss") {
      fb.set(px + (cs >> 1) - 1, py + (cs >> 1) - 1, INK);
      continue;
    }
    if (cs >= 7) {
      const k = cs >= 15 ? 2 : 1;
      const o = (cs - 5 * k) >> 1;
      for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (m[j]! & (16 >> i)) fb.fill({ x: px + o + i * k, y: py + o + j * k, w: k, h: k }, INK);
    } else fb.fill({ x: px + 1, y: py + 1, w: cs - 3, h: cs - 3 }, INK);
  }
  // You: an inverse cell with a pointer facing the way you look.
  const px = ox + d.x * cs, py = oy + d.y * cs;
  fb.fill(clip(px - 1, py - 1, cs + 1, cs + 1), blink ? INK : PAPER);
  const c = blink ? PAPER : INK;
  const m = cs - 1, h = m >> 1;
  for (let j = 0; j <= h; j++) {
    // A triangle pointing "up", rotated to the facing.
    for (let i = h - j; i <= h + j && i < m; i++) {
      const [u, v] = [i, j + 1];
      const [qx, qy] = d.facing === 0 ? [u, v] : d.facing === 1 ? [m - 1 - v, u] : d.facing === 2 ? [u, m - 1 - v] : [v, u];
      if (qx >= 0 && qy >= 0 && qx < m && qy < m) fb.set(px + qx, py + qy, c);
    }
  }
  return cs;
}

export interface HexHit {
  key: string;
  rect: Rect;
  label: string;
  el: SVGGElement;
  here: boolean;
}

/** Ink/paper per terrain: each ground has its own 1-bit weave. */
const WEAVE: Record<string, (x: number, y: number) => boolean> = {
  plain: (x, y) => (x & 3) === 0 && (y & 3) === 0,
  wood: (x, y) => { const a = x & 3, b = y & 3; return (b === 0 && a === 1) || (b === 1 && a < 3); },
  hill: (x, y) => ((x + y) & 3) === 0 && (y & 1) === 0,
  water: (x, y) => (y & 3) === 1 && ((x + ((y >> 2) & 1) * 3) % 6) < 3,
  ruin: (x, y) => (y & 3) === 0 || (((x + ((y >> 2) & 1) * 2) & 3) === 0 && (y & 1) === 0),
};

/**
 * Draw the honeycomb that ctx.drawHex put into `svg` (in user units) onto
 * `r`. `lit` is the key of the hovered or focused cell.
 */
export function drawHexMap(fb: Frame, r: Rect, svg: SVGSVGElement, lit: string | null, blink: boolean): HexHit[] {
  fb.fill(r, INK);
  const vb = (svg.getAttribute("viewBox") ?? "0 0 100 100").split(/\s+/).map(Number);
  const [vx, vy, vw, vh] = [vb[0] ?? 0, vb[1] ?? 0, Math.max(1, vb[2] ?? 100), Math.max(1, vb[3] ?? 100)];
  const k = Math.min(r.w / vw, r.h / vh);
  const ox = r.x + (r.w - vw * k) / 2 - vx * k, oy = r.y + (r.h - vh * k) / 2 - vy * k;
  const hits: HexHit[] = [];
  const cells = [...svg.querySelectorAll<SVGGElement>(":scope > g")];
  const drawn: { pts: [number, number][]; cls: string; key: string }[] = [];
  for (const g of cells) {
    const poly = g.querySelector("polygon");
    if (!poly) continue;
    const pts = (poly.getAttribute("points") ?? "").trim().split(/\s+/).map((p) => p.split(",").map(Number) as [number, number]).map(([x, y]): [number, number] => [ox + x * k, oy + y * k]);
    const terrain = g.dataset.terrain ?? "fog";
    const cls = g.getAttribute("class") ?? "";
    const key = g.dataset.q !== undefined ? `hex:${g.dataset.q},${g.dataset.r}` : g.dataset.go ? `hexgo:${g.dataset.go}` : cls === "here" ? "hex:here" : "";
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const [x, y] of pts) { bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); }
    const weave = WEAVE[terrain];
    const on = key && key === lit;
    for (let y = Math.max(r.y, Math.floor(by0)); y < Math.min(r.y + r.h, Math.ceil(by1)); y++) {
      for (let x = Math.max(r.x, Math.floor(bx0)); x < Math.min(r.x + r.w, Math.ceil(bx1)); x++) {
        if (!inside(pts, x + 0.5, y + 0.5)) continue;
        let p = weave ? (weave(x, y) ? PAPER : INK) : INK;
        if (cls === "here") p = PAPER;
        if (on) p = p === PAPER ? INK : PAPER;
        fb.set(x, y, p);
      }
    }
    drawn.push({ pts, cls, key });
    const title = g.querySelector("title")?.textContent ?? terrain;
    if (key && key !== "hex:here") hits.push({ key, rect: { x: Math.floor(bx0), y: Math.floor(by0), w: Math.ceil(bx1 - bx0), h: Math.ceil(by1 - by0) }, label: g.getAttribute("aria-label") ?? title, el: g, here: false });
    if (cls === "here") hits.push({ key: "hex:here", rect: { x: Math.floor(bx0), y: Math.floor(by0), w: Math.ceil(bx1 - bx0), h: Math.ceil(by1 - by0) }, label: title, el: g, here: true });
  }
  // Edges: seen cells ruled in paper; the cells you can step to doubled.
  for (const c of drawn) {
    const fog = !c.cls && !c.key;
    for (let i = 0; i < c.pts.length; i++) {
      const [ax, ay] = c.pts[i]!, [bx, by] = c.pts[(i + 1) % c.pts.length]!;
      if (fog) continue;
      fb.line(Math.round(ax), Math.round(ay), Math.round(bx), Math.round(by), c.cls === "here" ? INK : PAPER);
    }
  }
  // Pins: known places; you: a blinking marker.
  svg.querySelectorAll("circle.pin").forEach((cEl) => {
    const x = Math.round(ox + Number(cEl.getAttribute("cx")) * k), y = Math.round(oy + Number(cEl.getAttribute("cy")) * k);
    fb.fill({ x: x - 2, y: y - 2, w: 5, h: 5 }, PAPER);
    fb.fill({ x: x - 1, y: y - 1, w: 3, h: 3 }, INK);
  });
  const you = svg.querySelector("circle.you");
  if (you) {
    const x = Math.round(ox + Number(you.getAttribute("cx")) * k), y = Math.round(oy + Number(you.getAttribute("cy")) * k);
    fb.fill({ x: x - 3, y: y - 3, w: 7, h: 7 }, blink ? INK : PAPER);
    fb.fill({ x: x - 1, y: y - 1, w: 3, h: 3 }, blink ? PAPER : INK);
  }
  return hits;
}

function inside(pts: [number, number][], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!, [xj, yj] = pts[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
