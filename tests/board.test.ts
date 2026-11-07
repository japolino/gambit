import { describe, expect, test } from "bun:test";
import { type Board, camp, center, dealBoard, distance, key, type LoreCard, moveTo, neighbours, openLore, reachable, skip, SUPPLY_START, TIER_COST, winFight } from "../src/engine/world/board.js";

const lore = (n: number): LoreCard[] => Array.from({ length: n }, (_, i) => ({ id: `l${i}`, kind: "entry" as const, ref: `e${i}`, title: `Entry ${i}`, text: `Text ${i}`, stars: (1 + (i % 3)) as 1 | 2 | 3 }));
const party = [
  { id: "you", name: "You" },
  { id: "mira", name: "Mira" },
];
const deal = (seed = "s1", extra: Partial<Parameters<typeof dealBoard>[0]> = {}) => dealBoard({ seed, placeId: "p1", party, lore: lore(8), ...extra });

/** Every cell reachable from the start over the honeycomb, ignoring faces and foes. */
function linked(b: Board): number {
  const seen = new Set([b.start]);
  const todo = [b.start];
  while (todo.length) {
    const [q, r] = todo.pop()!.split(",").map(Number);
    for (const n of neighbours(b, q!, r!)) if (!seen.has(n)) seen.add(n), todo.push(n);
  }
  return seen.size;
}

/** Walk a member to a cell one legal move at a time (greedy along reachable cells). */
function stepToward(b: Board, goal: string): Board {
  const r = [...reachable(b)];
  const g = b.cells[goal]!;
  r.sort((a, c) => distance(b.cells[a]!, g) - distance(b.cells[c]!, g));
  return moveTo(b, r[0]!).board;
}

describe("expedition board", () => {
  test("the same seed deals the same board; another seed deals another", () => {
    expect(deal("a")).toEqual(deal("a"));
    expect(JSON.stringify(deal("a").cells)).not.toBe(JSON.stringify(deal("b").cells));
  });

  test("a dealt board is one connected honeycomb with a few edge tiles cut", () => {
    for (const seed of ["a", "b", "c", "d", "e"]) {
      const b = deal(seed);
      const n = Object.keys(b.cells).length;
      expect(n).toBeLessThan(37);
      expect(n).toBeGreaterThan(28);
      expect(linked(b)).toBe(n);
    }
    expect(Object.keys(dealBoard({ seed: "x", placeId: "p", party, lore: [], radius: 2 }).cells).length).toBeLessThanOrEqual(19);
  });

  test("the way in is at the bottom and open, the way on near the top, with a camp and a spring", () => {
    const b = deal();
    const ys = Object.values(b.cells).map((c) => center(c.q, c.r).y);
    const s = b.cells[b.start]!;
    expect(center(s.q, s.r).y).toBeCloseTo(Math.max(...ys), 5);
    expect(s.open).toBe(true);
    const g = b.cells[b.goal]!;
    expect(g.kind).toBe("goal");
    expect(g.ring).toBe("goal");
    expect(center(g.q, g.r).y).toBeLessThan(0);
    const kinds = Object.values(b.cells).map((c) => c.kind);
    expect(kinds.filter((k) => k === "camp").length).toBe(1);
    expect(kinds.filter((k) => k === "spring").length).toBe(1);
    expect(kinds.filter((k) => k === "lore").length).toBeGreaterThan(3);
    expect(b.party.every((m) => key(m.q, m.r) === b.start)).toBe(true);
    expect(b.supplies).toBe(SUPPLY_START);
  });

  test("rings tell the kind of tile but every tile but the way in starts face down", () => {
    const b = deal();
    for (const c of Object.values(b.cells)) {
      if (c.kind === "lore") expect(c.ring).toBe("lore");
      if (c.kind === "camp" || c.kind === "spring") expect(c.ring).toBe("safe");
      if (["cache", "forage", "hazard", "shortcut", "quiet"].includes(c.kind)) expect(c.ring).toBe("chance");
      if (key(c.q, c.r) !== b.start) expect(c.open).toBe(false);
    }
  });

  test("foes start away from the way in", () => {
    const b = deal("f", { foes: 3 });
    expect(b.foes.length).toBe(3);
    for (const f of b.foes) expect(distance(f, b.cells[b.start]!)).toBeGreaterThanOrEqual(3);
  });

  test("from the start you can reach exactly its face-down neighbours", () => {
    const b = deal();
    const s = b.cells[b.start]!;
    expect([...reachable(b)].sort()).toEqual(neighbours(b, s.q, s.r).sort());
  });

  test("turning a tile earns a supply and passes the move to the next member, then a new round", () => {
    const plain = (x: Board) => [...reachable(x)].find((k) => ["quiet", "cache", "camp", "spring", "shortcut"].includes(x.cells[k]!.kind));
    let b = deal();
    for (let i = 0; !plain(b); i++) b = deal(`plain${i}`);
    const to = plain(b)!;
    const r1 = moveTo(b, to);
    expect(r1.events[0]).toEqual({ kind: "flip", cell: to, got: 1 });
    expect(r1.board.cells[to]!.open).toBe(true);
    expect(r1.board.supplies).toBeGreaterThanOrEqual(SUPPLY_START + 1);
    expect(r1.board.active).toBe(1);
    b = r1.board;
    const r2 = skip(b);
    expect(r2.board.active).toBe(0);
    expect(r2.board.round).toBe(2);
    expect(r2.events.some((e) => e.kind === "round")).toBe(true);
  });

  test("you can't move somewhere unreachable", () => {
    const b = deal();
    expect(() => moveTo(b, b.goal)).toThrow();
  });

  test("a lore tile waits for a depth; deeper costs more, and you can pass and come back", () => {
    let b = deal("lore", { lore: lore(30) });
    // Find a run where a lore tile is next to the start.
    let seed = 0;
    while (![...reachable(b)].some((k) => b.cells[k]!.kind === "lore")) b = dealBoard({ seed: `lore${++seed}`, placeId: "p", party, lore: lore(30) });
    const at = [...reachable(b)].find((k) => b.cells[k]!.kind === "lore")!;
    const card = b.cells[at]!.lore!;
    const m = moveTo(b, at);
    expect(m.board.pending).toBe(at);
    expect(m.events.some((e) => e.kind === "lore")).toBe(true);
    expect(reachable(m.board).size).toBe(0);
    expect(m.board.active).toBe(0);
    // Pass: it stays unspent and the move goes on.
    const pass = openLore(m.board, 0);
    expect(pass.board.pending).toBeUndefined();
    expect(pass.board.cells[at]!.used).toBe(false);
    expect(pass.board.active).toBe(1);
    // Open at depth 1 instead.
    const open = openLore(m.board, 1);
    expect(open.card).toEqual(card);
    expect(open.tier).toBe(1);
    expect(open.board.supplies).toBe(m.board.supplies - TIER_COST[1]);
    expect(open.board.cells[at]!.used).toBe(true);
    // Too deep, or too poor.
    if (card.stars < 3) expect(() => openLore(m.board, 3)).toThrow();
    expect(() => openLore({ ...m.board, supplies: 0 }, 1)).toThrow();
  });

  test("passing on a lore tile and stepping back onto it offers it again", () => {
    let b = deal();
    let seed = 0;
    while (![...reachable(b)].some((k) => b.cells[k]!.kind === "lore")) b = dealBoard({ seed: `back${++seed}`, placeId: "p", party: [party[0]!], lore: lore(30) });
    b = { ...b, party: [b.party[0]!] };
    const at = [...reachable(b)].find((k) => b.cells[k]!.kind === "lore")!;
    b = openLore(moveTo(b, at).board, 0).board;
    b = moveTo(b, b.start).board;
    const again = moveTo(b, at);
    expect(again.board.pending).toBe(at);
  });

  test("stepping onto a foe strikes first; winning turns the tile and ends the move", () => {
    let b = deal("foe", { foes: 1 });
    const s = b.cells[b.start]!;
    const next = neighbours(b, s.q, s.r).find((k) => b.cells[k]!.kind !== "lore")!;
    b = { ...b, foes: [{ id: "foe1", ...b.cells[next]!, q: b.cells[next]!.q, r: b.cells[next]!.r }].map(({ id, q, r }) => ({ id, q, r })) };
    const m = moveTo(b, next);
    expect(m.events).toEqual([{ kind: "contact", foe: "foe1", first: "party", member: "you" }]);
    expect(m.board.fight?.first).toBe("party");
    expect(reachable(m.board).size).toBe(0);
    const w = winFight(m.board);
    expect(w.board.foes.length).toBe(0);
    expect(w.board.fight).toBeUndefined();
    expect(w.board.cells[next]!.open).toBe(true);
    expect(w.board.active).toBe(1);
  });

  test("a foe that steps onto a member ambushes them", () => {
    // One member on the start's neighbour, one foe next to it with nowhere else to go.
    let found = false;
    for (let i = 0; i < 400 && !found; i++) {
      let b = dealBoard({ seed: `amb${i}`, placeId: "p", party: [party[0]!], lore: [] });
      const s = b.cells[b.start]!;
      const n = neighbours(b, s.q, s.r)[0]!;
      b = moveTo(b, n).board; // round 2: the board has no foes yet
      const c = b.cells[n]!;
      const lair = neighbours(b, c.q, c.r).find((k) => k !== b.start && k !== b.goal);
      if (!lair) continue;
      b = { ...b, foes: [{ id: "foe1", ...b.cells[lair]! }].map(({ id, q, r }) => ({ id, q, r })) };
      const r = skip(b);
      const hit = r.events.find((e) => e.kind === "contact");
      if (!hit) continue;
      found = true;
      expect(hit).toEqual({ kind: "contact", foe: "foe1", first: "foes", member: "you" });
      expect(r.board.fight?.first).toBe("foes");
      // After an ambush the round already moved on: winning doesn't spend another move.
      const w = winFight(r.board);
      expect(w.board.active).toBe(r.board.active);
      expect(w.board.round).toBe(r.board.round);
    }
    expect(found).toBe(true);
  });

  test("the camp heals once for supplies", () => {
    let b = dealBoard({ seed: "camp", placeId: "p", party: [party[0]!], lore: [] });
    const at = Object.keys(b.cells).find((k) => b.cells[k]!.kind === "camp")!;
    for (const c of Object.values(b.cells)) c.open = true;
    b = moveTo(b, at).board;
    const r = camp(b);
    expect(r.healed).toBeGreaterThan(0);
    expect(r.board.supplies).toBe(b.supplies - 2);
    expect(() => camp(r.board)).toThrow();
  });

  test("the whole party on the way on finishes the board", () => {
    let b = deal("goal");
    for (const c of Object.values(b.cells)) if (c.kind !== "lore") c.open = true;
    b = { ...b, foes: [] };
    let guard = 0;
    while (!b.done && guard++ < 200) {
      if (b.pending) b = openLore(b, 0).board;
      const m = b.party[b.active]!;
      if (key(m.q, m.r) === b.goal) b = skip(b).board;
      else b = stepToward(b, b.goal);
    }
    expect(b.done).toBe(true);
    expect(b.party.every((m) => key(m.q, m.r) === b.goal)).toBe(true);
    expect(reachable(b).size).toBe(0);
  });
});
