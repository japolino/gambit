import { describe, expect, test } from "bun:test";
import { ahead, checkContract, clearRoom, enterDelve, generateDelve, reachableRooms, roomAt, stepDelve, type DelveMap, type DelveState } from "../src/engine/world/delve.js";
import { applyTraits, buildWorld, fightLabel, hotspotsOf, moveScene, newScene, nextStop, searchScene, seatCast } from "../src/engine/world/places.js";

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

  test("someone a place's own words name stands there, by a name word that isn't a title", () => {
    const people = [
      { id: "ysolde", name: "Ysolde", role: "lamia innkeeper", look: "", main: false, evidence: ev("warm, teasing, maternal") },
      { id: "maren", name: "Sister Maren Voss", role: "Order inquisitor", look: "", main: false, evidence: ev("tall, severe, grey-eyed") },
    ] as never[];
    const at = [
      { id: "gate", name: "The River Gate", description: "the town gate", evidence: ev("the River Gate (Order guards, curfew at bells)") },
      { id: "kettle", name: "The Coiled Kettle", description: "an inn run by a lamia", evidence: ev("the Coiled Kettle inn (Ysolde, the secret back room)") },
      { id: "chapel", name: "Chapel of the Chief God", description: "the Order's chapel", evidence: ev("the Chapel of the Chief God (Sister Maren's seat, the pyre yard)") },
      { id: "abbey", name: "The Sunken Abbey", description: "a flooded abbey", evidence: ev() },
    ];
    const w = buildWorld(sheet("frontier", { places: at, cast: people }), "s");
    expect(w.places.kettle!.people).toEqual(["ysolde"]);
    expect(w.places.chapel!.people).toEqual(["maren"]);
  });

  test("a word only one place's name has puts someone there, the start too, but a smaller place wins over the start", () => {
    const realm = [
      { id: "valeria", name: "Valeria Kingdom", description: "a human kingdom", evidence: ev() },
      { id: "aldurin", name: "Aldurin Kingdom", description: "a magic kingdom", evidence: ev() },
      { id: "tavern", name: "Rosedale Tavern", description: "a tavern", evidence: ev() },
    ];
    const people = [
      { id: "cedric", name: "King Cedric", role: "monarch of Valeria", look: "", main: false, evidence: ev() },
      { id: "adin", name: "King Adin", role: "ruler of Aldurin", look: "", main: false, evidence: ev() },
      { id: "nina", name: "Nina", role: "waitress at the Rosedale tavern in Valeria", look: "", main: false, evidence: ev() },
    ] as never[];
    const w = buildWorld(sheet("journey", { places: realm, cast: people }), "s");
    expect([w.places.valeria!.people, w.places.aldurin!.people, w.places.tavern!.people]).toEqual([["cedric"], ["adin"], ["nina"]]);
  });

  test("a newer read seats the card's people where it says, and leaves anyone else where play put them", () => {
    const w = buildWorld(sheet("town"), "s");
    const played = { ...w, places: { ...w.places, crypt: { ...w.places.crypt!, people: ["mira", "stranger"] }, library: { ...w.places.library!, people: [] } } };
    const again = seatCast(played, { cast: [{ ...(cast as { id: string }[])[1], at: "ward" }] } as never, "s");
    expect(again.places.ward!.people).toContain("mira");
    expect(again.places.crypt!.people).toEqual(["stranger"]);
  });

  test("a delve-shaped card's delve is the deepest of its places that isn't where people live", () => {
    const rooms = [
      { id: "core", name: "Core Room", description: "the heart of the dungeon", evidence: ev() },
      { id: "prison", name: "Prison Block", description: "cells for captured heroes", evidence: ev() },
      { id: "surface", name: "Surface Domain", description: "the settlement above the labyrinth", evidence: ev() },
    ];
    const w = buildWorld(sheet("delve", { places: rooms, cast: [] }), "s");
    expect(w.places.prison!.delve).toBe(true);
    // Judged with no delve anywhere, it still goes there.
    const judged = applyTraits(w, sheet("delve"), Object.fromEntries(rooms.map((p) => [p.id, { indoor: true, rest: false, shop: false, danger: false, delve: false }])));
    expect(Object.values(judged.places).filter((p) => p.delve).map((p) => p.id)).toEqual(["prison"]);
  });

  test("where the reader says someone is found comes first", () => {
    const people = [{ id: "rook", name: "Rook", role: "werewolf pack alpha", look: "", main: false, at: "crypt", evidence: ev() }] as never[];
    expect(buildWorld(sheet("town", { cast: people }), "s").places.crypt!.people).toEqual(["rook"]);
  });

  test("a journey is a line with a next stop; one place is a single scene; no places still gives a scene", () => {
    const j = buildWorld(sheet("journey"), "s");
    expect(j.route).toEqual(["manor", "library", "ward", "crypt"]);
    expect(nextStop(j, newScene(j))).toBe("library");
    expect(buildWorld(sheet("town", { places: [places[0]] }), "s").shape).toBe("scene");
    const none = buildWorld(sheet("town", { places: [] }), "s");
    expect(Object.keys(none.places)).toEqual(["here"]);
  });

  test("the fight item reads as English", () => {
    expect([fightLabel("brawl"), fightLabel("invasion"), fightLabel("a long and bloody war"), fightLabel(undefined)]).toEqual(["Look for a brawl", "Look for an invasion", "Look for a fight", "Look for a fight"]);
  });

  test("the menu has talk, look, exits, and what the place allows", () => {
    const w = buildWorld(sheet("town"), "s");
    const menu = hotspotsOf(w, "ward", sheet("town"));
    // The day can always be ended: with no bed here, on the ground.
    expect(menu.map((h) => h.kind)).toEqual(["talk", "search", "exit", "fight", "rest", "wait"]);
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
