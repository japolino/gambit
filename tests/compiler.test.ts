import { describe, expect, test } from "bun:test";
import { createJaot } from "../src/backend/jaot.js";
import { createLedger } from "../src/backend/ledger.js";
import { createPlay } from "../src/backend/play.js";
import { fallbackFoes } from "../src/engine/card/foes.js";
import { addHexPlace, buildHex, cellOf, hexDist, hexKey, hexPath, newHex, passable, stepHex } from "../src/engine/world/hex.js";
import { addPlace, buildWorld } from "../src/engine/world/places.js";
import { fallbackBible, gaps, parseBible, parsePlaceFromChat, fallbackPlaceFromChat, whereQuestion } from "../src/meaning/bible.js";
import { fallbackPlaces, placeNameFrom } from "../src/meaning/fallbacks.js";
import type { ToFrontend } from "../src/shared/protocol.js";
import type { SceneView } from "../src/shared/scene-view.js";

const ev = { source: "card" as const, quote: "", verified: true };
const base = () => ({
  v: 1,
  cardKey: "card-0002",
  cardName: "Greyreach",
  characterIds: [],
  readAt: 1,
  premise: "A frontier of wild hills and old ruins beyond the last town.",
  tone: "",
  shape: "frontier",
  modules: { parley: true, encounters: true, places: true, delves: true, kits: true, economy: true },
  skin: { genre: "low fantasy", currency: "crowns", fight: "skirmish", stats: { presence: "Presence", menace: "Menace", guile: "Guile" } },
  player: { name: "Wren", concept: "a scout", social: { presence: 2, menace: 1, guile: 3 } },
  cast: [
    { id: "ash", name: "Ash", role: "the warden of the last town", look: "", main: true, pronoun: "she", wants: ["order"], evidence: ev },
    { id: "pell", name: "Pell", role: "a trader", look: "", main: false, pronoun: "he", wants: [], evidence: ev },
  ],
  places: [{ id: "town", name: "Lastlight", description: "The last town, a stockade with an inn", evidence: ev }],
  facts: [],
  notes: [],
  foes: fallbackFoes("low fantasy"),
  kits: [],
});

describe("the World Bible", () => {
  test("gaps follow the shape: a frontier wants five places", () => {
    expect(gaps(base() as never).places).toBe(4);
    expect(gaps({ ...base(), shape: "scene", modules: { ...base().modules, places: false } } as never).places).toBe(0);
  });

  test("parse keeps new, described places, marks quoted ones as the card's, and drops repeats", () => {
    const raw = {
      places: [
        { name: "Lastlight", description: "dup", quote: "" },
        { name: "The Bone Hills", description: "Bare hills strewn with old bones", near: "town", quote: "the Bone Hills to the north" },
        { name: "Saltmere", description: "A grey lake", quote: "made up" },
        { name: "The Sunken Keep", description: "A ruined keep half under the marsh", quote: "" },
        { name: "Hollow Road", description: "A road through a ravine", quote: "" },
      ],
      thread: { goal: "Find who burned the old keep", revelations: ["a", "b", "c", "d"] },
      factions: [{ name: "The Wardens", want: "Hold the line", members: ["ash", "nobody"] }],
    };
    const b = parseBible(raw, base() as never, (q) => q.includes("Bone Hills"))!;
    expect(b.places.map((p) => p.name)).toEqual(["The Bone Hills", "Saltmere", "The Sunken Keep", "Hollow Road"]);
    expect(b.places[0]!.evidence.verified).toBe(true);
    expect(b.places[0]!.near).toBe("town");
    expect(b.places[1]!.evidence.verified).toBe(false);
    expect(b.thread?.revelations).toHaveLength(4);
    expect(b.factions[0]!.members).toEqual(["ash"]);
  });

  test("a delve shape with nowhere to explore is not a usable answer; the fallback has one", () => {
    const s = { ...base(), shape: "delve" };
    expect(parseBible({ places: [{ name: "A Meadow", description: "Grass" }] }, s as never, () => false)).toBeNull();
    const fb = fallbackBible(s as never);
    expect(fb.places.length).toBeGreaterThan(0);
    expect(fb.places[0]!.name).toMatch(/Crypt|Tunnel|Hull|Catacomb|Cellar/);
  });

  test("fallback names never repeat the card's, and a frontier with no secrets gets a templated thread", () => {
    const fb = fallbackBible(base() as never);
    expect(fb.places).toHaveLength(4);
    expect(new Set(fb.places.map((p) => p.id)).size).toBe(4);
    expect(fb.thread?.goal).toContain("Ash");
    expect(fallbackPlaces({ ...base(), places: [{ ...base().places[0]!, name: "The Old Market" }] } as never, 8).some((p) => p.name === "The Old Market")).toBe(false);
  });

  test("places from the chat need their quote in the lines", () => {
    const lines = [{ content: "They push through the door into the Rusted Anchor, a dockside bar." }];
    expect(parsePlaceFromChat({ name: "The Rusted Anchor", description: "A dockside bar", quote: "into the Rusted Anchor" }, lines, ["Lastlight"])).not.toBeNull();
    expect(parsePlaceFromChat({ name: "The Rusted Anchor", description: "", quote: "a quote that is not there" }, lines, [])).toBeNull();
    expect(fallbackPlaceFromChat(lines, [])?.name).toBe("The Rusted Anchor");
    expect(placeNameFrom("she said hello")).toBeNull();
    expect(Object.keys((whereQuestion({ id: "town", name: "Lastlight" }, [{ id: "town", name: "Lastlight" }, { id: "x", name: "X" }]).where as { criteria: object }).criteria)).toEqual(["same", "x", "new"]);
  });
});

describe("the honeycomb overland", () => {
  const world = () => {
    let w = buildWorld(base() as never, "seed");
    for (const p of fallbackBible(base() as never).places) w = addPlace(w, base() as never, p);
    return { ...w, shape: "frontier" } as typeof w;
  };

  test("every place is on the map and reachable from the start", () => {
    const w = world();
    const map = buildHex(w, "hex-seed");
    expect(cellOf(map, w.start)).toMatchObject({ q: 0, r: 0 });
    for (const id of Object.keys(w.places)) {
      const c = cellOf(map, id)!;
      expect(c).toBeTruthy();
      expect(passable(c)).toBe(true);
      expect(hexPath(map, { q: 0, r: 0 }, c)).not.toBeNull();
    }
    // Seeded: the same seed builds the same map.
    expect(JSON.stringify(buildHex(w, "hex-seed"))).toBe(JSON.stringify(map));
  });

  test("steps reveal cells, spend supplies, and refuse non-neighbours", () => {
    const w = world();
    const map = buildHex(w, "hex-seed");
    let s = newHex(map);
    const before = s.seen.length;
    const goal = cellOf(map, Object.keys(w.places)[1]!)!;
    const path = hexPath(map, s, goal)!;
    for (const step of path.slice(1)) s = stepHex(map, s, step).state;
    expect(s.q).toBe(goal.q);
    expect(s.supplies).toBe(8 - (path.length - 1));
    expect(s.seen.length).toBeGreaterThan(before);
    expect(() => stepHex(map, s, { q: s.q + 2, r: s.r })).toThrow();
  });

  test("a place added later lands near its neighbour and stays reachable", () => {
    let w = world();
    const map = buildHex(w, "hex-seed");
    w = addPlace(w, base() as never, { id: "c_cave", name: "Wolf Cave", description: "A cave", evidence: { source: "chat", quote: "Wolf Cave", verified: true } }, "town");
    const next = addHexPlace(map, w, "c_cave", "town");
    const c = cellOf(next, "c_cave")!;
    expect(hexDist(c, { q: 0, r: 0 })).toBeLessThanOrEqual(3);
    expect(hexPath(next, { q: 0, r: 0 }, c)).not.toBeNull();
    expect(cellOf(map, "c_cave")).toBeUndefined();
    expect(next.cells[hexKey(c.q, c.r)]!.place).toBe("c_cave");
  });
});

describe("the JAOT queue", () => {
  test("runs the most urgent job first, joins duplicate keys, and raises their priority", async () => {
    const q = createJaot({ concurrency: 1 });
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    void q.run("block", 0, async () => {
      await gate;
      order.push("block");
    });
    const late = q.run("speculative", 2, async () => void order.push("speculative"));
    const a = q.run("downtime", 3, async () => {
      order.push("downtime");
      return 1;
    });
    const b = q.run("downtime", 3, async () => 2);
    void q.run("needed", 1, async () => void order.push("needed"));
    q.run("downtime", 0, async () => 3); // raised to P0
    expect(q.stats().queued.find((j) => j.key === "downtime")!.priority).toBe(0);
    release();
    await Promise.all([late, a]);
    await q.idle();
    expect(order).toEqual(["block", "downtime", "needed", "speculative"]);
    expect(await b).toBe(1);
  });
});

describe("the compiler in play", () => {
  function setup(opts: { bible?: unknown; model?: (kind: string) => Record<string, unknown> | null } = {}) {
    const files = new Map<string, unknown>();
    const posted: string[] = [];
    const sent: ToFrontend[] = [];
    const spindle = {
      log: { info() {}, warn() {}, error() {} },
      userStorage: {
        getJson: async (p: string, o: { fallback: unknown }) => (files.has(p) ? structuredClone(files.get(p)) : o.fallback),
        setJson: async (p: string, v: unknown) => void files.set(p, structuredClone(v)),
      },
      chat: { appendMessage: async (_c: string, m: { content: string }) => void posted.push(m.content) },
    };
    const sheet = base();
    const asked: string[] = [];
    const ledger = createLedger(spindle.userStorage as never, () => async (prompt) => {
      const kind = /meanwhile/i.test(prompt.system) ? "meanwhile" : /where a roleplay scene has moved/.test(prompt.system) ? "place" : "bible";
      asked.push(kind);
      return { raw: opts.model?.(kind) ?? null, ms: 1 };
    });
    const jaot = createJaot();
    const cards = {
      sheetFor: async () => sheet as never,
      armory: async () => sheet as never,
      talk: async () => {},
      storedBible: async () => (opts.bible as never) ?? null,
      bible: async () => fallbackBible(sheet as never, 5),
      compile: ledger.compile,
      jaot,
    };
    const play = createPlay(spindle as never, (m) => sent.push(m), { request: () => ({ key: "", state: "queued" }), status: () => null, expect: () => {}, adopt: () => {}, whenDone: () => new Promise(() => {}) } as never, cards, { startState: async () => {} });
    const last = (): SceneView => sent.flatMap((m) => (m.type === "scene.state" ? [m.view] : [])).at(-1)!;
    return { play, files, posted, sent, last, jaot, asked };
  }

  test("a frontier without a Bible opens at once, then grows and walks the overland", async () => {
    const { play, last, jaot } = setup();
    await play.open("u", "c1");
    expect(last().movement).toBe("hex");
    await jaot.idle();
    await new Promise((r) => setTimeout(r, 5));
    const v = last();
    expect(v.hex!.cells.filter((c) => c.placeId).length).toBe(5);
    // Places the Bible added are known on the map before you reach them.
    expect(v.hex!.cells.filter((c) => c.placeId).every((c) => c.seen && c.name)).toBe(true);
    expect(v.log.at(-1)).toMatch(/The world grows/);
    // Step to a neighbour: out into the wild, with a wild menu.
    const here = v.hex!.cells.find((c) => c.here)!;
    const next = v.hex!.cells.find((c) => hexDist(c, here) === 1 && c.terrain !== "water" && !c.placeId)!;
    await play.hexStep("u", "c1", next.q, next.r);
    expect(last().hex!.wild).toBe(true);
    expect(last().menu.map((h) => h.id)).toContain("camp");
    expect(last().hex!.supplies).toBe(7);
  });

  test("travelling by menu walks the path; camping plays a Meanwhile montage", async () => {
    const { play, last, sent, posted, jaot } = setup({ bible: fallbackBible(base() as never, 9) });
    await play.open("u", "c2");
    const go = last().menu.find((h) => h.kind === "exit")!;
    await play.act("u", "c2", go.id);
    expect(last().place.id).toBe(go.target!);
    expect(posted.at(-1) ?? "").toContain("travels across the land");
    await play.act("u", "c2", "rest");
    await jaot.idle();
    const m = sent.filter((x) => x.type === "scene.meanwhile");
    expect(m[0]).toMatchObject({ vignettes: null });
    expect((m[1] as { vignettes: unknown[] }).vignettes.length).toBeGreaterThanOrEqual(3);
    expect(posted.at(-1) ?? "").toMatch(/^\*Meanwhile…/);
  });

  test("the chat moving somewhere new adds that place, quoted, and moves the scene", async () => {
    const { play, last } = setup({ bible: fallbackBible(base() as never, 9), model: (k) => (k === "place" ? { name: "The Rusted Anchor", description: "A dockside bar", quote: "into the Rusted Anchor" } : null) });
    await play.open("u", "c3");
    await play.moved("u", "c3", "new", 0.8, [{ name: "Ash", content: "We duck into the Rusted Anchor to get out of the rain." }]);
    const v = last();
    expect(v.place.name).toBe("The Rusted Anchor");
    expect(v.place.added).toBe(true);
    expect(v.hex!.cells.find((c) => c.here)!.placeId).toBe(v.place.id);
    // Unsure answers move nothing.
    await play.moved("u", "c3", "town", 0.3, []);
    expect(last().place.name).toBe("The Rusted Anchor");
  });

});
