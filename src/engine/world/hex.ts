/**
 * The honeycomb overland for frontier cards (docs/DESIGN.md 6.1): the
 * card's places sit on a hex map; you step one cell per turn, spending time
 * and supplies, and cells reveal as you go. Pure and seeded, with Worldgen's
 * contract: every place is reachable from the start, or the map carves a way.
 */
import type { World } from "./places.js";

export type Terrain = "plain" | "wood" | "hill" | "water" | "ruin";
export const TERRAIN_NAME: Record<Terrain, string> = { plain: "Open country", wood: "The woods", hill: "The hills", water: "Water", ruin: "Old ruins" };

export interface HexCell {
  q: number;
  r: number;
  t: Terrain;
  /** World place id standing on this cell. */
  place?: string;
  /** Added after the start (Bible, chat): known of, so shown on the map before you get there. */
  known?: boolean;
}

export interface HexMap {
  radius: number;
  cells: Record<string, HexCell>;
}

export interface HexState {
  q: number;
  r: number;
  seen: string[];
  supplies: number;
}

export const SUPPLY_MAX = 8;
export const DIRS: readonly [number, number][] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

export const hexKey = (q: number, r: number) => `${q},${r}`;
export const hexDist = (a: { q: number; r: number }, b: { q: number; r: number }) => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
export const passable = (c: HexCell | undefined): c is HexCell => !!c && c.t !== "water";

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** The cells of the ring at distance d, in order around the centre. */
function ring(d: number): [number, number][] {
  if (d === 0) return [[0, 0]];
  const out: [number, number][] = [];
  let q = DIRS[4]![0] * d;
  let r = DIRS[4]![1] * d;
  for (let side = 0; side < 6; side++) {
    for (let i = 0; i < d; i++) {
      out.push([q, r]);
      q += DIRS[side]![0];
      r += DIRS[side]![1];
    }
  }
  return out;
}

function terrainFor(seed: number, q: number, r: number): Terrain {
  const v = hash(`${seed}:${q}:${r}`) % 100;
  return v < 46 ? "plain" : v < 70 ? "wood" : v < 84 ? "hill" : v < 94 ? "water" : "ruin";
}

const placeTerrain = (p: World["places"][string]): Terrain => (p.delve || p.danger ? "ruin" : "plain");

/** Cells on the straight line from a to b (hex lerp), for carving a way through water. */
function line(a: { q: number; r: number }, b: { q: number; r: number }): [number, number][] {
  const n = hexDist(a, b);
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 0 : i / n;
    let q = a.q + (b.q - a.q) * t;
    let r = a.r + (b.r - a.r) * t;
    let s = -q - r;
    let rq = Math.round(q);
    let rr = Math.round(r);
    const rs = Math.round(s);
    const dq = Math.abs(rq - q);
    const dr = Math.abs(rr - r);
    const ds = Math.abs(rs - s);
    if (dq > dr && dq > ds) rq = -rr - rs;
    else if (dr > ds) rr = -rq - rs;
    out.push([rq, rr]);
  }
  return out;
}

/** Breadth-first path over passable cells (inclusive of both ends), or null. */
export function hexPath(map: HexMap, from: { q: number; r: number }, to: { q: number; r: number }): { q: number; r: number }[] | null {
  const start = hexKey(from.q, from.r);
  const goal = hexKey(to.q, to.r);
  if (!passable(map.cells[goal])) return null;
  const prev = new Map<string, string | null>([[start, null]]);
  const queue = [start];
  while (queue.length) {
    const k = queue.shift()!;
    if (k === goal) break;
    const c = map.cells[k]!;
    for (const [dq, dr] of DIRS) {
      const nk = hexKey(c.q + dq, c.r + dr);
      if (prev.has(nk) || !passable(map.cells[nk])) continue;
      prev.set(nk, k);
      queue.push(nk);
    }
  }
  if (!prev.has(goal)) return null;
  const out: { q: number; r: number }[] = [];
  for (let k: string | null = goal; k; k = prev.get(k) ?? null) {
    const c = map.cells[k]!;
    out.unshift({ q: c.q, r: c.r });
  }
  return out;
}

function carve(map: HexMap, a: { q: number; r: number }, b: { q: number; r: number }): void {
  for (const [q, r] of line(a, b)) {
    const c = map.cells[hexKey(q, r)];
    if (c && c.t === "water") c.t = "plain";
  }
}

/** A free passable cell for a new place: on rings from `minD` outwards, picked by seed. */
function freeCell(map: HexMap, seed: number, minD: number): HexCell {
  for (let d = minD; d <= map.radius + 3; d++) {
    if (d > map.radius) grow(map, d, seed);
    const cells = ring(d)
      .map(([q, r]) => map.cells[hexKey(q, r)]!)
      .filter((c) => c && !c.place);
    if (!cells.length) continue;
    // Not right next to another place, when that can be helped.
    const spaced = cells.filter((c) => DIRS.every(([dq, dr]) => !map.cells[hexKey(c.q + dq, c.r + dr)]?.place));
    const pool = spaced.length ? spaced : cells;
    return pool[seed % pool.length]!;
  }
  return map.cells[hexKey(0, 0)]!;
}

function grow(map: HexMap, to: number, seed: number): void {
  for (let d = map.radius + 1; d <= to; d++) for (const [q, r] of ring(d)) map.cells[hexKey(q, r)] = { q, r, t: terrainFor(seed, q, r) };
  map.radius = Math.max(map.radius, to);
}

/** The overland for a world: the start at the centre, the other places spread around it. */
export function buildHex(world: World, seedStr: string): HexMap {
  const seed = hash(seedStr);
  const ids = Object.keys(world.places).filter((id) => id !== world.start);
  const radius = Math.max(3, Math.min(6, 2 + Math.ceil(ids.length / 2)));
  const map: HexMap = { radius: 0, cells: {} };
  map.cells[hexKey(0, 0)] = { q: 0, r: 0, t: "plain", place: world.start };
  grow(map, radius, seed);
  ids.forEach((id, i) => {
    const c = freeCell(map, hash(`${seed}:${id}`), 2 + (i % Math.max(1, radius - 1)));
    c.place = id;
    c.t = placeTerrain(world.places[id]!);
  });
  ensureReachable(map);
  return map;
}

/** Worldgen's contract: every place reachable from the start. */
export function ensureReachable(map: HexMap): void {
  const origin = { q: 0, r: 0 };
  for (const c of Object.values(map.cells)) if (c.place && !hexPath(map, origin, c)) carve(map, origin, c);
}

/** Put a place added later (Bible, chat) on the map. Returns a new map. */
export function addHexPlace(map: HexMap, world: World, placeId: string, near?: string): HexMap {
  if (Object.values(map.cells).some((c) => c.place === placeId)) return map;
  const next: HexMap = { radius: map.radius, cells: Object.fromEntries(Object.entries(map.cells).map(([k, c]) => [k, { ...c }])) };
  const seed = hash(placeId);
  const anchor = near ? Object.values(next.cells).find((c) => c.place === near) : undefined;
  let cell: HexCell | undefined;
  if (anchor) {
    // Two steps from the place it sits next to, when there is room.
    const around = ring(2)
      .map(([dq, dr]) => next.cells[hexKey(anchor.q + dq, anchor.r + dr)])
      .filter((c): c is HexCell => !!c && !c.place);
    cell = around[seed % Math.max(1, around.length)];
  }
  cell ??= freeCell(next, seed, 2);
  cell.place = placeId;
  cell.known = true;
  const p = world.places[placeId];
  if (p) cell.t = placeTerrain(p);
  ensureReachable(next);
  return next;
}

/** Where a place is on the map. */
export const cellOf = (map: HexMap, placeId: string): HexCell | undefined => Object.values(map.cells).find((c) => c.place === placeId);

/** Cells you can see from here: one ring, two from a hill. */
export function reveal(map: HexMap, s: HexState): HexState {
  const here = map.cells[hexKey(s.q, s.r)];
  const d = here?.t === "hill" ? 2 : 1;
  const seen = new Set(s.seen);
  for (let i = 0; i <= d; i++) for (const [q, r] of ring(i)) if (map.cells[hexKey(s.q + q, s.r + r)]) seen.add(hexKey(s.q + q, s.r + r));
  return { ...s, seen: [...seen] };
}

export function newHex(map: HexMap, at?: { q: number; r: number }): HexState {
  const s: HexState = { q: at?.q ?? 0, r: at?.r ?? 0, seen: [], supplies: SUPPLY_MAX };
  // Places the player already knows of are marked from the start.
  const known = Object.values(map.cells).filter((c) => c.place).map((c) => hexKey(c.q, c.r));
  return reveal(map, { ...s, seen: known });
}

export type HexStep = { state: HexState; place: string | null; hungry: boolean };

/** One step to a neighbouring cell. Throws on an illegal step. */
export function stepHex(map: HexMap, s: HexState, to: { q: number; r: number }): HexStep {
  const c = map.cells[hexKey(to.q, to.r)];
  if (hexDist(s, to) !== 1) throw new Error("You can only step to a neighbouring cell.");
  if (!passable(c)) throw new Error("Water blocks the way.");
  const hungry = s.supplies <= 0;
  const state = reveal(map, { ...s, q: to.q, r: to.r, supplies: Math.max(0, s.supplies - 1) });
  return { state, place: c.place ?? null, hungry };
}
