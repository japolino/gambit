import { describe, expect, test } from "bun:test";
import { ahead, checkContract, clearRoom, enterDelve, generateDelve, reachableRooms, roomAt, stepDelve, type DelveMap, type DelveState } from "../src/engine/world/delve.js";
import { buildWorld, hotspotsOf, moveScene, newScene, nextStop, searchScene } from "../src/engine/world/places.js";

const ev = (quote = "") => ({ source: "card" as const, quote, verified: true });
const mods = { parley: true, encounters: true, places: true, delves: true, kits: true, economy: true };
const cast = [
  { id: "corvin", name: "Corvin", role: "prince", look: "", main: true, evidence: ev() },
  { id: "mira", name: "Mira", role: "his daughter, often in the manor library", look: "", main: false, evidence: ev() },
  { id: "imp", name: "Butcher Imp", role: "an imp lurking in the Ash Ward streets", look: "", main: false, evidence: ev() },
] as never[];
const places = [
  { id: "manor", name: "Owl Manor", description: "Corvin's manor", evidence: ev() },
  { id: "library", name: "Manor Library", description: "towering shelves", evidence: ev() },
  { id: "ward", name: "Ash Ward Streets", description: "dangerous streets of the old city", evidence: ev() },
  { id: "crypt", name: "Old Crypt", description: "a crypt under the city", evidence: ev() },
];
const sheet = (shape: string, over: Record<string, unknown> = {}) => ({ shape, places, cast, modules: mods, cardName: "Corvin", skin: { fight: "brawl" }, ...over }) as never;

describe("the card's places", () => {
  test("a town is a hub with every place one step away; people stand where their words put them", () => {
    const w = buildWorld(sheet("town"), "s");
    expect(w.start).toBe("manor");
    expect(w.places.manor!.exits.sort()).toEqual(["crypt", "library", "ward"]);
    expect(w.places.library!.exits).toEqual(["manor"]);
    expect(w.places.manor!.people).toContain("corvin");
    expect(w.places.library!.people).toContain("mira");
    expect(w.places.ward!.danger).toBe(true);
    expect(w.places.crypt!.delve).toBe(true);
  });

  test("a journey is a line with a next stop; one place is a single scene; no places still gives a scene", () => {
    const j = buildWorld(sheet("journey"), "s");
    expect(j.route).toEqual(["manor", "library", "ward", "crypt"]);
    expect(nextStop(j, newScene(j))).toBe("library");
    expect(buildWorld(sheet("town", { places: [places[0]] }), "s").shape).toBe("scene");
    const none = buildWorld(sheet("town", { places: [] }), "s");
    expect(Object.keys(none.places)).toEqual(["here"]);
  });

  test("the menu has talk, look, exits, and what the place allows", () => {
    const w = buildWorld(sheet("town"), "s");
    const menu = hotspotsOf(w, "ward", sheet("town"));
    expect(menu.map((h) => h.kind)).toEqual(["talk", "search", "exit", "fight", "wait"]);
    expect(hotspotsOf(w, "crypt", sheet("town")).some((h) => h.kind === "delve")).toBe(true);
    expect(hotspotsOf(w, "manor", sheet("town")).some((h) => h.kind === "rest")).toBe(true);
  });

  test("moves follow exits and the clock; rest sleeps to morning and restores", () => {
    const w = buildWorld(sheet("town"), "s");
    let s = newScene(w);
    s = moveScene(w, s, { kind: "go", to: "library" });
    expect([s.placeId, s.time]).toEqual(["library", 1]);
    expect(() => moveScene(w, s, { kind: "go", to: "crypt" })).toThrow();
    s = moveScene(w, moveScene(w, { ...s, vigor: 0.3 }, { kind: "go", to: "manor" }), { kind: "rest" });
    expect([s.day, s.time, s.vigor]).toEqual([2, 0, 1]);
  });

  test("a search is once per place per day and can turn up a hidden fact", () => {
    const w = buildWorld(sheet("town"), "s");
    const facts = [{ id: "f1", text: "Mira hides a letter", about: ["mira"], weight: 1, known: false }] as never[];
    const s0 = moveScene(w, newScene(w), { kind: "go", to: "library" });
    const r = searchScene(w, s0, { facts, player: { social: { guile: 4 } } } as never, "seed");
    expect(r.dc).toBe(12);
    expect(r.factId === "f1" || r.factId === null).toBe(true);
    expect(() => searchScene(w, r.scene, { facts, player: { social: { guile: 4 } } } as never, "seed")).toThrow();
  });
});

describe("delves", () => {
  test("every seed passes the map contract: all rooms reachable, key before lock, boss behind it", () => {
    for (let i = 0; i < 60; i++) {
      const m = generateDelve(`seed${i}`);
      expect(checkContract(m)).toEqual([]);
      expect(reachableRooms(m, false).has(m.boss)).toBe(false);
      expect(reachableRooms(m, true).has(m.boss)).toBe(true);
      expect(m.rooms.filter((r) => r.kind === "entrance").length).toBe(1);
    }
  });

  test("the same seed builds the same delve", () => {
    expect(generateDelve("x")).toEqual(generateDelve("x"));
  });

  test("walking: walls block, the lock needs the key, and the boss ends it", () => {
    const m: DelveMap = generateDelve("walk");
    let s: DelveState = enterDelve(m);
    // Walk to every room by BFS over cells, picking up the key, then the boss.
    const path = (from: [number, number], to: [number, number], unlocked: boolean): [number, number][] => {
      const prev = new Map<string, string>();
      const q = [from];
      const seen = new Set([`${from[0]},${from[1]}`]);
      while (q.length) {
        const [x, y] = q.shift()!;
        if (x === to[0] && y === to[1]) break;
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
          const c = m.grid[y + dy]?.[x + dx];
          const k = `${x + dx},${y + dy}`;
          if (!c || c === "#" || (c === "L" && !unlocked) || seen.has(k)) continue;
          seen.add(k);
          prev.set(k, `${x},${y}`);
          q.push([x + dx, y + dy]);
        }
      }
      const out: [number, number][] = [];
      let k = `${to[0]},${to[1]}`;
      while (prev.has(k)) {
        out.unshift(k.split(",").map(Number) as [number, number]);
        k = prev.get(k)!;
      }
      return out;
    };
    const walk = (to: [number, number], unlocked: boolean) => {
      for (const [x, y] of path([s.x, s.y], to, unlocked)) {
        const dir = x > s.x ? 1 : x < s.x ? 3 : y > s.y ? 2 : 0;
        while (s.facing !== dir) s = stepDelve(m, s, "right").state;
        let r = stepDelve(m, s, "forward");
        if (r.event.kind === "unlocked") r = stepDelve(m, r.state, "forward");
        expect(r.event.kind).not.toBe("blocked");
        s = r.state;
      }
    };
    const keyRoom = m.rooms.find((r) => r.kind === "key")!;
    const boss = m.rooms.find((r) => r.kind === "boss")!;
    // Locked without the key.
    const bossPath = path([s.x, s.y], [boss.x, boss.y], true);
    expect(bossPath.length).toBeGreaterThan(0);
    walk([keyRoom.x, keyRoom.y], false);
    const got = stepDelve(m, s, "search");
    expect(got.event).toEqual({ kind: "found", what: "key" });
    s = got.state;
    walk([boss.x, boss.y], true);
    expect(roomAt(m, s.x, s.y)?.kind).toBe("boss");
    s = clearRoom(m, s, boss.id);
    expect(s.done).toBe(true);
    expect(s.seen.length).toBeGreaterThan(5);
    expect(["#", ".", "R", "L"]).toContain(ahead(m, s));
  });
});
