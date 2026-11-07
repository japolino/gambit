/**
 * Delves (docs/DESIGN.md 4.5, 6.1): a room graph laid on a grid and walked
 * in first person. Rooms sit on a coarse lattice joined by short corridors;
 * one locked door guards the boss, and its key lies elsewhere. Code checks
 * the map contract (every room reachable, key before lock, boss reachable)
 * and rebuilds with the next seed on failure. Pure and seeded.
 */

export type RoomKind = "entrance" | "fight" | "boss" | "key" | "rest" | "treasure" | "trap" | "event";
export type Facing = 0 | 1 | 2 | 3; // N, E, S, W

export interface DelveRoom {
  id: string;
  x: number;
  y: number;
  kind: RoomKind;
  /** Steps from the entrance in the room graph. */
  depth: number;
}

export interface DelveMap {
  v: 1;
  seed: string;
  w: number;
  h: number;
  /** Rows of cells: '#' wall, '.' corridor, 'R' room, 'L' locked door. */
  grid: string[];
  rooms: DelveRoom[];
  entrance: string;
  boss: string;
  /** Builds it took to pass the contract (1 = first try). */
  tries: number;
}

export interface DelveState {
  v: 1;
  x: number;
  y: number;
  facing: Facing;
  /** Cells seen ("x,y"), for the automap. */
  seen: string[];
  keys: number;
  /** Rooms whose event is over (fought, looted, sprung). */
  cleared: string[];
  /** Locked doors opened ("x,y"). */
  opened: string[];
  done: boolean;
}

const STRIDE = 3;
const DX = [0, 1, 0, -1] as const;
const DY = [-1, 0, 1, 0] as const;

function rng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const key = (x: number, y: number): string => `${x},${y}`;

interface Draft {
  slots: Map<string, { sx: number; sy: number; depth: number }>;
  edges: [string, string][];
}

function grow(r: () => number, cols: number, rows: number, n: number): Draft {
  const slots = new Map<string, { sx: number; sy: number; depth: number }>();
  const edges: [string, string][] = [];
  const start = { sx: Math.floor(cols / 2), sy: rows - 1, depth: 0 };
  slots.set(key(start.sx, start.sy), start);
  let guard = 0;
  while (slots.size < n && guard++ < 500) {
    const list = [...slots.values()];
    // Prefer growing from deeper rooms, so the boss ends up far away.
    const from = list[Math.floor(Math.pow(r(), 0.6) * list.length)]!;
    const d = Math.floor(r() * 4);
    const sx = from.sx + DX[d]!;
    const sy = from.sy + DY[d]!;
    if (sx < 0 || sy < 0 || sx >= cols || sy >= rows || slots.has(key(sx, sy))) continue;
    slots.set(key(sx, sy), { sx, sy, depth: from.depth + 1 });
    edges.push([key(from.sx, from.sy), key(sx, sy)]);
  }
  return { slots, edges };
}

/** Rooms reachable from the entrance; `blocked` edges are not crossed. */
function reach(rooms: readonly string[], edges: readonly [string, string][], from: string, blocked: ReadonlySet<string>): Set<string> {
  const adj = new Map<string, string[]>(rooms.map((r) => [r, []]));
  for (const [a, b] of edges) {
    if (blocked.has(`${a}|${b}`) || blocked.has(`${b}|${a}`)) continue;
    adj.get(a)?.push(b);
    adj.get(b)?.push(a);
  }
  const seen = new Set([from]);
  const q = [from];
  while (q.length) for (const n of adj.get(q.shift()!) ?? []) if (!seen.has(n)) (seen.add(n), q.push(n));
  return seen;
}

function build(seed: string, rooms: number): Omit<DelveMap, "tries"> | null {
  const r = rng(seed);
  const cols = 5;
  const rows = 5;
  const draft = grow(r, cols, rows, Math.max(5, Math.min(12, rooms)));
  if (draft.slots.size < 5) return null;
  const ids = [...draft.slots.keys()];
  const entranceSlot = ids[0]!;
  // Boss: the deepest room. Its single way in becomes the locked door.
  const byDepth = [...draft.slots.entries()].sort((a, b) => b[1].depth - a[1].depth);
  const bossSlot = byDepth[0]![0];
  // Loops make it a place, not a tree; never through the boss.
  for (let i = 0; i < 2; i++) {
    const [a, s] = [...draft.slots.entries()][Math.floor(r() * draft.slots.size)]!;
    const d = Math.floor(r() * 4);
    const b = key(s.sx + DX[d]!, s.sy + DY[d]!);
    if (a === bossSlot || b === bossSlot || !draft.slots.has(b)) continue;
    if (draft.edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) continue;
    draft.edges.push([a, b]);
  }
  const lockEdge = draft.edges.find(([a, b]) => a === bossSlot || b === bossSlot)!;
  const w = cols * STRIDE - (STRIDE - 1) + 2;
  const h = rows * STRIDE - (STRIDE - 1) + 2;
  const grid = Array.from({ length: h }, () => Array.from({ length: w }, () => "#"));
  const cell = (sx: number, sy: number) => ({ x: 1 + sx * STRIDE, y: 1 + sy * STRIDE });
  for (const s of draft.slots.values()) {
    const c = cell(s.sx, s.sy);
    grid[c.y]![c.x] = "R";
  }
  for (const [a, b] of draft.edges) {
    const A = draft.slots.get(a)!;
    const B = draft.slots.get(b)!;
    const ca = cell(A.sx, A.sy);
    const cb = cell(B.sx, B.sy);
    const sx = Math.sign(cb.x - ca.x);
    const sy = Math.sign(cb.y - ca.y);
    const locked = (a === lockEdge[0] && b === lockEdge[1]) || (a === lockEdge[1] && b === lockEdge[0]);
    for (let i = 1; i < STRIDE; i++) {
      const x = ca.x + sx * i;
      const y = ca.y + sy * i;
      // The door is the corridor cell next to the boss room.
      const nextToBoss = (x + sx === cell(draft.slots.get(bossSlot)!.sx, draft.slots.get(bossSlot)!.sy).x && y + sy === cell(draft.slots.get(bossSlot)!.sx, draft.slots.get(bossSlot)!.sy).y) || (x - sx === cell(draft.slots.get(bossSlot)!.sx, draft.slots.get(bossSlot)!.sy).x && y - sy === cell(draft.slots.get(bossSlot)!.sx, draft.slots.get(bossSlot)!.sy).y);
      grid[y]![x] = locked && nextToBoss ? "L" : ".";
    }
  }
  // Room roles.
  const roomOf = (slot: string): DelveRoom => {
    const s = draft.slots.get(slot)!;
    const c = cell(s.sx, s.sy);
    return { id: key(c.x, c.y), x: c.x, y: c.y, kind: "event", depth: s.depth };
  };
  const all = ids.map(roomOf);
  const bySlot = new Map(ids.map((slot, i) => [slot, all[i]!]));
  bySlot.get(entranceSlot)!.kind = "entrance";
  bySlot.get(bossSlot)!.kind = "boss";
  const free = all.filter((x) => x.kind === "event").sort((a, b) => b.depth - a.depth || a.id.localeCompare(b.id));
  const take = (kind: RoomKind, choose: (list: DelveRoom[]) => DelveRoom | undefined) => {
    const room = choose(free.filter((x) => x.kind === "event"));
    if (room) room.kind = kind;
  };
  take("key", (l) => l[Math.floor(r() * Math.max(1, Math.ceil(l.length / 2)))]);
  take("rest", (l) => l[Math.floor(l.length / 2)]);
  take("treasure", (l) => l[Math.floor(r() * l.length)]);
  take("trap", (l) => l[Math.floor(r() * l.length)]);
  for (const room of free) if (room.kind === "event" && r() < 0.6) room.kind = "fight";
  return { v: 1, seed, w, h, grid: grid.map((row) => row.join("")), rooms: all, entrance: bySlot.get(entranceSlot)!.id, boss: bySlot.get(bossSlot)!.id };
}

/** Rooms connected through open cells; locked doors pass only when `unlocked`. */
export function reachableRooms(map: Pick<DelveMap, "grid" | "rooms" | "entrance">, unlocked: boolean): Set<string> {
  const [ex, ey] = map.entrance.split(",").map(Number) as [number, number];
  const seen = new Set([key(ex, ey)]);
  const q: [number, number][] = [[ex, ey]];
  while (q.length) {
    const [x, y] = q.shift()!;
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d]!;
      const ny = y + DY[d]!;
      const c = map.grid[ny]?.[nx];
      if (!c || c === "#" || (c === "L" && !unlocked) || seen.has(key(nx, ny))) continue;
      seen.add(key(nx, ny));
      q.push([nx, ny]);
    }
  }
  return new Set(map.rooms.map((r) => r.id).filter((id) => seen.has(id)));
}

/** The map contract (4.5): every room but the boss reachable without the key, the key among them, and the boss with it. */
export function checkContract(map: Omit<DelveMap, "tries">): string[] {
  const problems: string[] = [];
  const open = reachableRooms(map, false);
  const keyRoom = map.rooms.find((r) => r.kind === "key");
  if (!keyRoom) problems.push("no key room");
  else if (!open.has(keyRoom.id)) problems.push("key behind the lock");
  if (open.has(map.boss)) problems.push("boss not locked");
  if (!reachableRooms(map, true).has(map.boss)) problems.push("boss unreachable");
  for (const room of map.rooms) if (room.id !== map.boss && !open.has(room.id)) problems.push(`room ${room.id} unreachable`);
  if (map.grid.join("").split("L").length - 1 !== 1) problems.push("not exactly one locked door");
  return problems;
}

/** A delve that passes the contract, rebuilding up to `maxTries` times. */
export function generateDelve(seed: string, rooms = 9, maxTries = 12): DelveMap {
  for (let t = 0; t < maxTries; t++) {
    const m = build(t ? `${seed}#${t}` : seed, rooms);
    if (m && checkContract(m).length === 0) return { ...m, seed, tries: t + 1 };
  }
  throw new Error(`No valid delve for seed ${seed}`);
}

/* ------------------------------- walking ------------------------------- */

const at = (map: DelveMap, x: number, y: number): string => map.grid[y]?.[x] ?? "#";
export const roomAt = (map: DelveMap, x: number, y: number): DelveRoom | undefined => map.rooms.find((r) => r.x === x && r.y === y);

/** Cells in view: the line ahead until a wall (up to 4) with its sides, and every neighbour. */
function sight(map: DelveMap, s: Pick<DelveState, "x" | "y" | "facing">): string[] {
  const out = [key(s.x, s.y)];
  for (let d = 0; d < 4; d++) out.push(key(s.x + DX[d]!, s.y + DY[d]!));
  for (let i = 1; i <= 4; i++) {
    const x = s.x + DX[s.facing]! * i;
    const y = s.y + DY[s.facing]! * i;
    out.push(key(x, y));
    if (at(map, x, y) === "#") break;
    // The walls and openings beside the hall ahead are in view too.
    out.push(key(x + DX[(s.facing + 1) % 4]!, y + DY[(s.facing + 1) % 4]!), key(x + DX[(s.facing + 3) % 4]!, y + DY[(s.facing + 3) % 4]!));
  }
  return out;
}

const withSight = (map: DelveMap, s: DelveState): DelveState => ({ ...s, seen: [...new Set([...s.seen, ...sight(map, s)])] });

export function enterDelve(map: DelveMap): DelveState {
  const [x, y] = map.entrance.split(",").map(Number) as [number, number];
  return withSight(map, { v: 1, x, y, facing: 0, seen: [], keys: 0, cleared: [map.entrance], opened: [], done: false });
}

export type DelveMove = "forward" | "back" | "left" | "right" | "search";

/** What stepping somewhere did, for the stage and the host. */
export type DelveEvent =
  | { kind: "blocked"; why: "wall" | "locked" }
  | { kind: "unlocked" }
  | { kind: "room"; room: DelveRoom; first: boolean }
  | { kind: "found"; what: "nothing" | "key" | "treasure" }
  | { kind: "none" };

/** The cell straight ahead, as the first-person view draws it. */
export function ahead(map: DelveMap, s: Pick<DelveState, "x" | "y" | "facing">, n = 1): string {
  return at(map, s.x + DX[s.facing]! * n, s.y + DY[s.facing]! * n);
}

export function stepDelve(map: DelveMap, s: DelveState, move: DelveMove): { state: DelveState; event: DelveEvent } {
  if (move === "left" || move === "right") {
    const facing = ((s.facing + (move === "left" ? 3 : 1)) % 4) as Facing;
    return { state: withSight(map, { ...s, facing }), event: { kind: "none" } };
  }
  if (move === "search") {
    const room = roomAt(map, s.x, s.y);
    if (!room || s.cleared.includes(room.id) || (room.kind !== "key" && room.kind !== "treasure")) return { state: s, event: { kind: "found", what: "nothing" } };
    const state = { ...s, cleared: [...s.cleared, room.id], keys: s.keys + (room.kind === "key" ? 1 : 0) };
    return { state, event: { kind: "found", what: room.kind } };
  }
  const dir = move === "forward" ? s.facing : ((s.facing + 2) % 4) as Facing;
  const nx = s.x + DX[dir]!;
  const ny = s.y + DY[dir]!;
  const c = at(map, nx, ny);
  if (c === "#") return { state: s, event: { kind: "blocked", why: "wall" } };
  if (c === "L" && !s.opened.includes(key(nx, ny))) {
    if (s.keys < 1) return { state: s, event: { kind: "blocked", why: "locked" } };
    return { state: withSight(map, { ...s, keys: s.keys - 1, opened: [...s.opened, key(nx, ny)] }), event: { kind: "unlocked" } };
  }
  const moved = withSight(map, { ...s, x: nx, y: ny });
  const room = roomAt(map, nx, ny);
  if (!room) return { state: moved, event: { kind: "none" } };
  return { state: moved, event: { kind: "room", room, first: !s.cleared.includes(room.id) } };
}

/** Mark a room's event over (a fight won, a trap sprung); the boss's ends the delve. */
export function clearRoom(map: DelveMap, s: DelveState, roomId: string): DelveState {
  const cleared = s.cleared.includes(roomId) ? s.cleared : [...s.cleared, roomId];
  return { ...s, cleared, done: s.done || roomId === map.boss };
}
