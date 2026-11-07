/**
 * The expedition board (docs/DESIGN.md 6.1): a small honeycomb dealt face
 * down for one outing at a place. Every tile shows a coloured ring for what
 * kind of thing it is (safe, chance, lore, objective) but not what it is.
 * The party moves one member at a time across what they have uncovered;
 * flipping a new tile earns a supply, and lore tiles spend supplies on how
 * deep a scene goes (1, 2 or 3 stars). Foes roam between rounds: step onto
 * one and you strike first, let one step onto you and you are ambushed. The
 * way on needs the whole party standing on it.
 *
 * Pure and seeded: the same seed deals the same board, and every draw comes
 * from the board's own generator, so a saved board replays exactly.
 */

export type CellKind = "start" | "goal" | "camp" | "spring" | "cache" | "forage" | "hazard" | "shortcut" | "lore" | "quiet";
/** What the ring on a face-down tile tells you. */
export type Ring = "safe" | "chance" | "lore" | "goal";

export const RING_OF: Record<CellKind, Ring> = {
  start: "safe",
  camp: "safe",
  spring: "safe",
  goal: "goal",
  cache: "chance",
  forage: "chance",
  hazard: "chance",
  shortcut: "chance",
  quiet: "chance",
  lore: "lore",
};

/** A piece of the card's world dealt onto a lore tile; the backend narrates it when it is opened. */
export interface LoreCard {
  id: string;
  /** fact: a card fact (3 stars makes it known); person: someone in the cast; entry: a lorebook entry; thread: a revelation of the central thread. */
  kind: "fact" | "person" | "entry" | "thread";
  /** The fact, cast or entry id it comes from. */
  ref: string;
  title: string;
  text: string;
  /** How deep it can go: the highest tier you may open it at. */
  stars: 1 | 2 | 3;
}

export interface BoardCell {
  q: number;
  r: number;
  kind: CellKind;
  ring: Ring;
  /** Turned face up. */
  open: boolean;
  /** Its effect is spent (a cache emptied, a camp slept at, a lore tile opened). */
  used: boolean;
  /** Treasure size for a cache, 1-3. */
  stars?: number;
  lore?: LoreCard;
}

export interface BoardFoe {
  id: string;
  q: number;
  r: number;
}

export interface BoardMember {
  id: string;
  name: string;
  q: number;
  r: number;
}

export interface Board {
  v: 1;
  seed: string;
  placeId: string;
  radius: number;
  cells: Record<string, BoardCell>;
  foes: BoardFoe[];
  party: BoardMember[];
  /** Whose move it is (index into party). */
  active: number;
  round: number;
  supplies: number;
  /** The generator's state. */
  rng: number;
  start: string;
  goal: string;
  done: boolean;
  /** A lore tile that was just turned and waits for the player to choose how deep to go. */
  pending?: string;
  /** A foe met: the board waits for the battle. `first` says who struck first (and whether the member's turn was spent). */
  fight?: { foe: string; first: "party" | "foes"; member: string };
}

export const SUPPLY_START = 5;
export const SUPPLY_CAP = 12;
/** What opening a lore tile at each depth costs. */
export const TIER_COST: Record<1 | 2 | 3, number> = { 1: 1, 2: 3, 3: 6 };
export const CAMP_COST = 2;

/* ------------------------------- geometry ------------------------------- */

export const key = (q: number, r: number): string => `${q},${r}`;
export const DIRS: readonly [number, number][] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

/** Flat-topped hexes: centre of a cell in units of the hex's outer radius. */
export function center(q: number, r: number): { x: number; y: number } {
  return { x: 1.5 * q, y: Math.sqrt(3) * (r + q / 2) };
}

export function neighbours(b: Pick<Board, "cells">, q: number, r: number): string[] {
  return DIRS.map(([dq, dr]) => key(q + dq, r + dr)).filter((k) => !!b.cells[k]);
}

export const distance = (a: { q: number; r: number }, b: { q: number; r: number }): number => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;

const parse = (k: string): { q: number; r: number } => {
  const [q, r] = k.split(",").map(Number);
  return { q: q!, r: r! };
};

/* -------------------------------- random -------------------------------- */

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** One draw in [0, 1) from the board's generator (mulberry32), advancing it. */
function draw(b: { rng: number }): number {
  b.rng = (b.rng + 0x6d2b79f5) >>> 0;
  let t = b.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(b: { rng: number }, xs: readonly T[]): T => xs[Math.floor(draw(b) * xs.length)]!;
function shuffle<T>(b: { rng: number }, xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(draw(b) * (i + 1));
    [xs[i], xs[j]] = [xs[j]!, xs[i]!];
  }
  return xs;
}

/* --------------------------------- deal --------------------------------- */

export interface DealOptions {
  seed: string;
  placeId: string;
  /** Rings around the centre: 2 is 19 tiles, 3 is 37, 4 is 61 (before a few edge tiles are cut). */
  radius?: number;
  party: { id: string; name: string }[];
  /** Lore cards to deal, most relevant first. */
  lore: LoreCard[];
  /** Foes roaming the board. */
  foes?: number;
}

/** Every cell still reachable from `from` without crossing `cut`. */
function connected(cells: ReadonlySet<string>, from: string): Set<string> {
  const seen = new Set([from]);
  const todo = [from];
  while (todo.length) {
    const { q, r } = parse(todo.pop()!);
    for (const [dq, dr] of DIRS) {
      const k = key(q + dq, r + dr);
      if (cells.has(k) && !seen.has(k)) {
        seen.add(k);
        todo.push(k);
      }
    }
  }
  return seen;
}

export function dealBoard(o: DealOptions): Board {
  const radius = Math.max(2, Math.min(4, o.radius ?? 3));
  const g = { rng: hashSeed(`board:${o.seed}`) };
  // The honeycomb, with a few edge tiles cut so no two boards have the same outline.
  const all = new Set<string>();
  for (let q = -radius; q <= radius; q++) for (let r = -radius; r <= radius; r++) if (Math.abs(q + r) <= radius) all.add(key(q, r));
  const edge = [...all].filter((k) => distance(parse(k), { q: 0, r: 0 }) === radius);
  for (const k of shuffle(g, edge).slice(0, Math.round(edge.length * 0.3))) {
    all.delete(k);
    if (connected(all, key(0, 0)).size !== all.size) all.add(k);
  }
  const ys = [...all].map((k) => ({ k, ...center(parse(k).q, parse(k).r) }));
  // The way in at the bottom, the way on near the top: every outing is a crossing.
  const bottom = Math.max(...ys.map((c) => c.y));
  const start = pick(g, ys.filter((c) => c.y >= bottom - 0.01).map((c) => c.k));
  const top = [...ys].sort((a, b) => a.y - b.y).slice(0, 3);
  const goal = pick(g, top.map((c) => c.k));
  const cells: Record<string, BoardCell> = {};
  const put = (k: string, kind: CellKind, extra: Partial<BoardCell> = {}) => {
    const { q, r } = parse(k);
    cells[k] = { q, r, kind, ring: RING_OF[kind], open: false, used: false, ...extra };
  };
  put(start, "start", { open: true, used: true });
  put(goal, "goal");
  // A camp in the middle of the crossing and a spring somewhere off the line.
  const free = () => [...all].filter((k) => !cells[k]);
  const mid = free().filter((k) => distance(parse(k), parse(start)) >= 2 && distance(parse(k), parse(goal)) >= 2);
  put(pick(g, mid.length ? mid : free()), "camp");
  put(pick(g, free().filter((k) => distance(parse(k), parse(start)) >= 2)), "spring");
  // The deck: the card's lore first, then the road's own luck.
  const slots = shuffle(g, free());
  const n = slots.length;
  const lore = o.lore.slice(0, Math.max(1, Math.round(n * 0.3)));
  const deck: Omit<BoardCell, "q" | "r" | "ring" | "open" | "used">[] = [
    ...lore.map((l) => ({ kind: "lore" as const, lore: l })),
    ...Array.from({ length: Math.round(n * 0.15) }, () => ({ kind: "cache" as const, stars: draw(g) < 0.15 ? 3 : draw(g) < 0.4 ? 2 : 1 })),
    ...Array.from({ length: Math.round(n * 0.12) }, () => ({ kind: "forage" as const })),
    ...Array.from({ length: Math.round(n * 0.1) }, () => ({ kind: "hazard" as const })),
    ...Array.from({ length: n >= 20 ? 2 : 1 }, () => ({ kind: "shortcut" as const })),
  ];
  slots.forEach((k, i) => {
    const card = deck[i];
    if (card) put(k, card.kind, card);
    else put(k, "quiet");
  });
  // Foes, never next to the way in.
  const foes: BoardFoe[] = [];
  const lairs = shuffle(g, [...all].filter((k) => distance(parse(k), parse(start)) >= 3 && k !== goal));
  for (let i = 0; i < Math.min(o.foes ?? 0, lairs.length); i++) foes.push({ id: `foe${i + 1}`, ...parse(lairs[i]!) });
  const s = parse(start);
  return {
    v: 1,
    seed: o.seed,
    placeId: o.placeId,
    radius,
    cells,
    foes,
    party: o.party.slice(0, 3).map((p) => ({ id: p.id, name: p.name, q: s.q, r: s.r })),
    active: 0,
    round: 1,
    supplies: SUPPLY_START,
    rng: g.rng,
    start,
    goal,
    done: false,
  };
}

/* --------------------------------- moves -------------------------------- */

const foeAt = (b: Board, k: string) => b.foes.find((f) => key(f.q, f.r) === k);
const memberAt = (b: Board, k: string) => b.party.find((m) => key(m.q, m.r) === k);

/**
 * Where the active member may go: anywhere across tiles already turned
 * (foes block the way), stopping on a face-down tile at the edge of what is
 * known, or on a foe to strike first.
 */
export function reachable(b: Board): Set<string> {
  const m = b.party[b.active];
  const out = new Set<string>();
  if (!m || b.done || b.pending || b.fight) return out;
  const from = key(m.q, m.r);
  const seen = new Set([from]);
  const todo = [from];
  while (todo.length) {
    const k = todo.shift()!;
    const { q, r } = parse(k);
    for (const n of neighbours(b, q, r)) {
      if (seen.has(n)) continue;
      seen.add(n);
      const c = b.cells[n]!;
      if (foeAt(b, n)) {
        out.add(n);
        continue;
      }
      out.add(n);
      if (c.open) todo.push(n);
    }
  }
  return out;
}

export type BoardEvent =
  | { kind: "flip"; cell: string; got: number }
  | { kind: "spring"; heal: number }
  | { kind: "cache"; coin: number; stars: number }
  | { kind: "forage"; got: number }
  | { kind: "hazard"; what: "hurt" | "lost"; amount: number }
  | { kind: "shortcut"; opened: string[] }
  | { kind: "lore"; cell: string; card: LoreCard }
  | { kind: "camp"; cell: string }
  | { kind: "contact"; foe: string; first: "party" | "foes"; member: string }
  | { kind: "goal"; here: number; of: number }
  | { kind: "done" }
  | { kind: "round"; round: number };

export interface Step {
  board: Board;
  events: BoardEvent[];
}

const clone = (b: Board): Board => ({ ...b, cells: Object.fromEntries(Object.entries(b.cells).map(([k, c]) => [k, { ...c }])), foes: b.foes.map((f) => ({ ...f })), party: b.party.map((p) => ({ ...p })) });

/** Turn a tile face up and resolve what lies under it. */
function turn(b: Board, k: string, events: BoardEvent[]): void {
  const c = b.cells[k]!;
  if (c.open) return;
  c.open = true;
  b.supplies = Math.min(SUPPLY_CAP, b.supplies + 1);
  events.push({ kind: "flip", cell: k, got: 1 });
  switch (c.kind) {
    case "spring":
      c.used = true;
      events.push({ kind: "spring", heal: 0.25 });
      break;
    case "cache": {
      c.used = true;
      const stars = c.stars ?? 1;
      events.push({ kind: "cache", coin: stars * 10 + Math.floor(draw(b) * 6), stars });
      break;
    }
    case "forage":
      c.used = true;
      b.supplies = Math.min(SUPPLY_CAP, b.supplies + 2);
      events.push({ kind: "forage", got: 2 });
      break;
    case "hazard": {
      c.used = true;
      if (draw(b) < 0.5) events.push({ kind: "hazard", what: "hurt", amount: 0.1 });
      else {
        const lost = Math.min(b.supplies, 2);
        b.supplies -= lost;
        events.push({ kind: "hazard", what: "lost", amount: lost });
      }
      break;
    }
    case "shortcut": {
      c.used = true;
      const opened = neighbours(b, c.q, c.r).filter((n) => !b.cells[n]!.open && !foeAt(b, n));
      for (const n of opened) b.cells[n]!.open = true;
      events.push({ kind: "shortcut", opened });
      break;
    }
    case "lore":
      b.pending = k;
      events.push({ kind: "lore", cell: k, card: c.lore! });
      break;
    case "camp":
      events.push({ kind: "camp", cell: k });
      break;
    case "quiet":
      c.used = true;
      break;
  }
}

/** The whole party on the way on finishes the board. */
function goalCheck(b: Board, events: BoardEvent[]): void {
  const here = b.party.filter((m) => key(m.q, m.r) === b.goal).length;
  if (!here) return;
  b.cells[b.goal]!.open = true;
  events.push({ kind: "goal", here, of: b.party.length });
  if (here === b.party.length) {
    b.done = true;
    events.push({ kind: "done" });
  }
}

/** The next member's move; after the last, the foes move and a new round starts. */
function endTurn(b: Board, events: BoardEvent[]): void {
  if (b.done || b.pending) return;
  b.active++;
  if (b.active < b.party.length) return;
  b.active = 0;
  b.round++;
  events.push({ kind: "round", round: b.round });
  for (const f of b.foes) {
    if (draw(b) < 0.4) continue;
    const ways = neighbours(b, f.q, f.r).filter((n) => n !== b.start && n !== b.goal && !foeAt(b, n));
    if (!ways.length) continue;
    const to = pick(b, ways);
    Object.assign(f, parse(to));
    const m = memberAt(b, to);
    if (m) {
      b.fight = { foe: f.id, first: "foes", member: m.id };
      events.push({ kind: "contact", foe: f.id, first: "foes", member: m.id });
      return;
    }
  }
}

/** Move the active member to a tile it can reach. */
export function moveTo(b0: Board, to: string): Step {
  if (!reachable(b0).has(to)) throw new Error("You can't get there from here.");
  const b = clone(b0);
  const events: BoardEvent[] = [];
  const m = b.party[b.active]!;
  const foe = foeAt(b, to);
  if (foe) {
    // Stepping onto a foe: you have the jump on them.
    b.fight = { foe: foe.id, first: "party", member: m.id };
    events.push({ kind: "contact", foe: foe.id, first: "party", member: m.id });
    Object.assign(m, parse(to));
    return { board: b, events };
  }
  Object.assign(m, parse(to));
  const c = b.cells[to]!;
  if (c.open && c.kind === "lore" && !c.used) {
    // Back on a lore tile you passed on: it offers itself again.
    b.pending = to;
    events.push({ kind: "lore", cell: to, card: c.lore! });
  } else turn(b, to, events);
  if (c.kind === "goal") goalCheck(b, events);
  endTurn(b, events);
  return { board: b, events };
}

/** The active member holds still this turn. */
export function skip(b0: Board): Step {
  const b = clone(b0);
  const events: BoardEvent[] = [];
  goalCheck(b, events);
  endTurn(b, events);
  return { board: b, events };
}

/** Open the pending lore tile at a depth, or pass on it (it stays open to come back to). */
export function openLore(b0: Board, tier: 0 | 1 | 2 | 3): Step & { card?: LoreCard; tier?: 1 | 2 | 3 } {
  if (!b0.pending) throw new Error("Nothing waits to be opened.");
  const b = clone(b0);
  const k = b.pending!;
  const c = b.cells[k]!;
  b.pending = undefined;
  const events: BoardEvent[] = [];
  if (tier === 0) {
    endTurn(b, events);
    return { board: b, events };
  }
  if (tier > (c.lore?.stars ?? 1)) throw new Error("It doesn't go that deep.");
  if (b.supplies < TIER_COST[tier]) throw new Error(`That needs ${TIER_COST[tier]} supplies.`);
  b.supplies -= TIER_COST[tier];
  c.used = true;
  endTurn(b, events);
  return { board: b, events, card: c.lore!, tier };
}

/** Make camp on a camp tile: costs supplies, heals the party, once per board. */
export function camp(b0: Board): Step & { healed: number } {
  const m = b0.party[b0.active];
  const c = m ? b0.cells[key(m.q, m.r)] : undefined;
  if (!c || c.kind !== "camp" || c.used) throw new Error("There is no camp here.");
  if (b0.supplies < CAMP_COST) throw new Error(`Making camp needs ${CAMP_COST} supplies.`);
  const b = clone(b0);
  b.supplies -= CAMP_COST;
  b.cells[key(c.q, c.r)]!.used = true;
  const events: BoardEvent[] = [];
  endTurn(b, events);
  return { board: b, events, healed: 0.35 };
}

/**
 * The battle with a foe is won: it leaves the board. A member who struck
 * first now turns the tile they stepped onto, and their turn ends; after an
 * ambush the round already moved on.
 */
export function winFight(b0: Board): Step {
  const f = b0.fight;
  if (!f) return { board: b0, events: [] };
  const b = clone(b0);
  b.fight = undefined;
  b.foes = b.foes.filter((x) => x.id !== f.foe);
  const events: BoardEvent[] = [];
  if (f.first === "party") {
    const m = b.party.find((p) => p.id === f.member);
    if (m) {
      const k = key(m.q, m.r);
      turn(b, k, events);
      if (b.cells[k]!.kind === "goal") goalCheck(b, events);
    }
    endTurn(b, events);
  }
  return { board: b, events };
}

/** Lore ids on a board, so later boards deal fresh ones. */
export const loreOn = (b: Board): string[] => Object.values(b.cells).flatMap((c) => (c.lore && c.used ? [c.lore.id] : []));
