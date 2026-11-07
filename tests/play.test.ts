import { describe, expect, test } from "bun:test";
import { createPlay } from "../src/backend/play.js";
import { fallbackFoes } from "../src/engine/card/foes.js";
import type { BattleState } from "../src/engine/types.js";
import type { ToFrontend } from "../src/shared/protocol.js";
import type { SceneView } from "../src/shared/scene-view.js";

const ev = { source: "card" as const, quote: "", verified: true };
const sheet = {
  v: 1,
  cardKey: "card-0001",
  cardName: "Saltmarsh",
  characterIds: [],
  premise: "A fog-bound harbor town.",
  tone: "",
  shape: "town",
  modules: { parley: true, encounters: true, places: true, delves: true, kits: true, economy: true },
  skin: { genre: "low fantasy", currency: "crowns", fight: "brawl", stats: { presence: "Presence", menace: "Menace", guile: "Guile" } },
  player: { name: "Wren", concept: "a courier", social: { presence: 2, menace: 1, guile: 3 } },
  cast: [{ id: "mara", name: "Mara", role: "the harbormaster, usually at the docks", look: "", main: true, pronoun: "she", evidence: ev }],
  places: [
    { id: "docks", name: "The Docks", description: "Wet planks and gulls", evidence: ev },
    { id: "tavern", name: "The Drowned Lantern", description: "A tavern with rooms to rent", evidence: ev },
    { id: "caves", name: "Smugglers' Caves", description: "A cave tunnel under the cliffs", evidence: ev },
  ],
  facts: [{ id: "f1", text: "Mara takes bribes", about: ["mara"], weight: 1, known: false, evidence: ev }],
  notes: [],
  foes: fallbackFoes("low fantasy"),
  kits: [],
};

function setup() {
  const files = new Map<string, unknown>();
  const posted: string[] = [];
  const sent: ToFrontend[] = [];
  const started: BattleState[] = [];
  const known: string[] = [];
  const spindle = {
    log: { info() {}, warn() {}, error() {} },
    userStorage: {
      getJson: async (p: string, o: { fallback: unknown }) => (files.has(p) ? structuredClone(files.get(p)) : o.fallback),
      setJson: async (p: string, v: unknown) => void files.set(p, structuredClone(v)),
    },
    chat: { appendMessage: async (_chatId: string, m: { content: string }) => void posted.push(m.content) },
  };
  const art = { request: () => ({ key: "", state: "queued" }), status: () => null, whenDone: () => new Promise(() => {}) };
  const cards = {
    sheetFor: async () => sheet as never,
    armory: async () => sheet as never,
    talk: async () => {},
    markKnown: async (_u: string, _c: string, id: string) => void known.push(id),
  };
  const battles = { startState: async (_u: string, s: BattleState) => void started.push(s) };
  const play = createPlay(spindle as never, (m) => sent.push(m), art as never, cards, battles);
  const views = () => sent.flatMap((m) => (m.type === "scene.state" ? [m.view] : []));
  const last = (): SceneView => views()[views().length - 1]!;
  return { play, files, posted, sent, started, known, last };
}

/** End a started battle the way the engine would, with the given outcome. */
function ended(s: BattleState, outcome: "victory" | "defeat"): BattleState {
  return {
    ...s,
    outcome,
    combatants: s.combatants.map((c) => (c.side === "enemy" ? { ...c, alive: outcome !== "victory", hp: outcome === "victory" ? 0 : c.hp } : { ...c, hp: outcome === "victory" ? Math.round(c.maxHp / 2) : 0, alive: outcome === "victory" })),
  };
}

describe("play on a card", () => {
  test("a town opens as a lobby with tiles for the other places and a menu", async () => {
    const { play, last } = setup();
    await play.open("u", "chat1");
    const v = last();
    expect(v.movement).toBe("lobby");
    expect(v.place.id).toBe("docks");
    expect(v.tiles.map((t) => t.id).sort()).toEqual(["caves", "tavern"]);
    expect(v.menu.some((h) => h.id === "talk:mara")).toBe(true);
    expect(v.canFight).toBe(true);
  });

  test("moving posts a short aside to the chat; a found fact becomes known", async () => {
    const { play, last, posted, known } = setup();
    await play.open("u", "chat1");
    await play.act("u", "chat1", "go:tavern");
    expect(last().place.id).toBe("tavern");
    expect(posted.at(-1)).toContain("The Drowned Lantern");
    await play.act("u", "chat1", "go:docks");
    await play.act("u", "chat1", "search");
    expect(last().log.at(-1)).toMatch(/Looking around|look around/);
    if (known.length) expect(known).toEqual(["f1"]);
  });

  test("a fight starts a card battle over the scene; a victory pays out and tells the chat", async () => {
    const { play, started, posted, last } = setup();
    await play.open("u", "chat1");
    await play.fight("u", "chat1");
    expect(started).toHaveLength(1);
    const s = started[0]!;
    expect(s.meta?.chatId).toBe("chat1");
    expect(s.meta?.backdrop).toBe(last().place.art);
    expect(Object.keys(s.meta?.monsters ?? {}).length).toBeGreaterThan(0);
    expect(s.combatants.filter((c) => c.side === "party").map((c) => c.name)).toContain("Wren");
    await play.onBattleEnd(ended(s, "victory"), "u");
    expect(last().coin).toBeGreaterThan(50);
    expect(last().vigor).toBeCloseTo(0.5, 1);
    expect(posted.at(-1)).toContain("is over");
    // A finished battle is not paid twice.
    const coin = last().coin;
    await play.onBattleEnd(ended(s, "victory"), "u");
    expect(last().coin).toBe(coin);
  });

  test("a defeat sends the party back to the start, tired and poorer", async () => {
    const { play, started, last } = setup();
    await play.open("u", "chat1");
    await play.act("u", "chat1", "go:tavern");
    await play.fight("u", "chat1");
    await play.onBattleEnd(ended(started[0]!, "defeat"), "u");
    expect(last().place.id).toBe("docks");
    expect(last().vigor).toBeCloseTo(0.35);
    expect(last().coin).toBe(40);
  });

  test("a delve: enter, walk until a fight room, win it, and the room is cleared", async () => {
    const { play, started, last } = setup();
    await play.open("u", "chat1");
    await play.act("u", "chat1", "go:caves");
    expect(last().menu.some((h) => h.kind === "delve")).toBe(true);
    await play.act("u", "chat1", "delve");
    expect(last().movement).toBe("delve");
    expect(last().theme).toBe("onebit");
    // Wander (turning right at walls) until a fight starts.
    for (let i = 0; i < 400 && !started.length; i++) {
      const d = last().delve!;
      const ahead = d.view[1]?.ahead ?? "#";
      await play.step("u", "chat1", ahead === "#" || ahead === "L" ? (i % 7 === 0 ? "left" : "right") : "forward");
    }
    expect(started).toHaveLength(1);
    const room = started[0]!.meta?.room;
    expect(room).toBeTruthy();
    await play.onBattleEnd(ended(started[0]!, "victory"), "u");
    expect(last().delve?.rooms.find((r) => r.id === room)?.cleared).toBe(true);
    await play.leave("u", "chat1");
    expect(last().movement).toBe("lobby");
    expect(last().theme).toBe("storybook");
  });
});
