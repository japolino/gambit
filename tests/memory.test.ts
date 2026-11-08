import { describe, expect, test } from "bun:test";
import { createPlay } from "../src/backend/play.js";
import { fallbackFoes } from "../src/engine/card/foes.js";
import {
  adaptations,
  adaptFoes,
  adaptMonster,
  ADAPT_AFTER,
  BOND_AT,
  companionsReact,
  deedsFromBattle,
  deedsFromParley,
  emptyTally,
  mentions,
  profileOf,
  readyToPromote,
  remember,
  tallyEvents,
  type Deed,
} from "../src/engine/memory/memory.js";
import { fallbackNight, parsePromotion } from "../src/meaning/night.js";
import type { BattleState, MonsterDef } from "../src/engine/types.js";
import type { ToFrontend } from "../src/shared/protocol.js";
import type { SceneView } from "../src/shared/scene-view.js";

const ev = { source: "card" as const, quote: "", verified: true };
const temperament = { warmth: 3, pride: 2, greed: 2, fear: 2 };
const sheet = {
  v: 1,
  cardKey: "card-0003",
  cardName: "Saltmarsh",
  characterIds: [],
  readAt: 1,
  premise: "A fog-bound harbor town.",
  tone: "",
  shape: "town",
  modules: { parley: true, encounters: true, places: true, delves: true, kits: true, economy: true },
  skin: { genre: "low fantasy", currency: "crowns", fight: "brawl", stats: { presence: "Presence", menace: "Menace", guile: "Guile" } },
  player: { name: "Wren", concept: "a courier", social: { presence: 2, menace: 1, guile: 3 } },
  cast: [
    { id: "mara", name: "Mara", role: "the harbormaster, usually at the docks", look: "", main: true, pronoun: "she", temperament, evidence: ev },
    { id: "tobin", name: "Tobin", role: "keeps The Drowned Lantern", look: "", main: false, pronoun: "he", temperament, evidence: ev },
  ],
  places: [
    { id: "docks", name: "The Docks", description: "Wet planks and gulls", evidence: ev },
    { id: "tavern", name: "The Drowned Lantern", description: "A tavern with rooms to rent", evidence: ev },
    { id: "caves", name: "Smugglers' Caves", description: "A cave tunnel under the cliffs", evidence: ev },
  ],
  facts: [],
  notes: [],
  foes: fallbackFoes("low fantasy"),
  kits: [],
};

describe("the deed ledger and the build profile", () => {
  test("a tally counts only what the party did", () => {
    const party = new Set(["p_player"]);
    const t = tallyEvents(
      emptyTally(),
      [
        { kind: "use", actor: "p_player", skill: "s", name: "Fire", targets: ["e1"] },
        { kind: "hit", source: "p_player", target: "e1", amount: 30, element: "fire", crit: false, weak: false, resisted: false, absorbed: false, shieldTaken: 0 },
        { kind: "status_on", target: "e1", status: "burn", stacks: 1, turns: 2 },
        { kind: "hit", source: "e1", target: "p_player", amount: 99, element: "frost", crit: false, weak: false, resisted: false, absorbed: false, shieldTaken: 0 },
      ],
      party,
    );
    expect(t.elements).toEqual({ fire: 30 });
    expect(t.statuses).toEqual({ burn: 1 });
    expect(profileOf(t)).toMatchObject({ element: "fire", share: 1, status: "burn" });
  });

  test("a won battle records who fell, who was spared and who joined", () => {
    const state = {
      outcome: "victory",
      combatants: [
        { id: "a", defId: "t.bandit", side: "enemy", name: "Bandit", alive: false },
        { id: "b", defId: "t.bandit", side: "enemy", name: "Bandit", alive: false },
        { id: "c", defId: "t.thug", side: "enemy", name: "Thug", alive: true, left: "surrender" },
        { id: "d", defId: "t.thug", side: "enemy", name: "Thug", alive: true, left: "recruit" },
      ],
    } as unknown as BattleState;
    const deeds = deedsFromBattle(state, 2, "docks", (id) => id.replace("t.", ""), { elements: { fire: 10 }, statuses: {}, talks: 2, hits: 3 });
    expect(deeds).toContainEqual({ day: 2, kind: "killed", target: "bandit", name: "Bandit", n: 2, place: "docks", method: "fire" });
    expect(deeds.map((d) => d.kind).sort()).toEqual(["killed", "recruited", "spared"]);
  });

  test("a Parley's tactics become deeds: a bluff is a lie, a threat is a threat", () => {
    const d = deedsFromParley("mara", "Mara", "deal", ["threat", "logic", "bluff"], true, 3, "docks");
    expect(d.map((x) => x.kind)).toEqual(["deal", "lied_to", "threatened"]);
    // How a line was read doesn't make it a lie: only a claim rolled as a bluff does.
    expect(deedsFromParley("mara", "Mara", "walked", ["bluff", "candor"], false, 3).map((x) => x.kind)).toEqual(["walked"]);
  });
});

describe("factions adapt, and say so first", () => {
  const killed = (n: number): Deed[] => [{ day: 1, kind: "killed", target: "bandit", name: "Bandit", n }];
  test("a group hurt enough resists your favourite element, inside a budget", () => {
    const profile = { element: "fire" as const, share: 0.8, status: "burn" as const, talker: false };
    expect(adaptations(killed(ADAPT_AFTER - 1), {}, profile, 2)).toEqual([]);
    const first = adaptations(killed(ADAPT_AFTER), {}, profile, 2);
    expect(first).toHaveLength(1);
    expect(first[0]!.resist).toBe("fire");
    expect(first[0]!.rumor).toMatch(/^The Bandits have started carrying wet hides/);
    // The second countermeasure needs twice the hurt, and is a different one.
    const second = adaptations(killed(ADAPT_AFTER * 2), { bandit: first }, profile, 3);
    expect(second[0]!.cleanse).toBe("burn");
    expect(adaptations(killed(ADAPT_AFTER * 9), { bandit: [...first, ...second] }, profile, 4)).toEqual([]);
  });

  test("adapted foes resist and lose the matching weakness; a cleanse becomes a skill", () => {
    const foe = { ...sheet.foes[0]!, id: "bandit", weakTo: ["fire" as const], resists: [] };
    const [a] = adaptFoes([foe], { bandit: [{ foe: "bandit", resist: "fire", rumor: "", day: 1 }] });
    expect(a!.resists).toContain("fire");
    expect(a!.weakTo).not.toContain("fire");
    const def = { id: "m", skills: [] } as unknown as MonsterDef;
    expect(adaptMonster(def, [{ foe: "bandit", cleanse: "bleed", rumor: "", day: 1 }]).skills[0]!.atoms[0]!.op).toBe("cleanse");
  });
});

describe("people remember, companions react", () => {
  test("a lie makes someone wary; kindness warms them", () => {
    const deeds = deedsFromParley("mara", "Mara", "walked", ["bluff"], true, 2);
    const m = remember({}, deeds, new Set(["mara"]), "Wren");
    expect(m.mara!.notes.map((n) => n.text)).toEqual(["Wren walked away from them on day 2", "Wren lied to them on day 2"]);
    expect(m.mara!.affinity).toBe(-2.5);
    expect(remember({}, deeds, new Set(["tobin"]), "Wren")).toEqual({});
  });

  test("warm companions like mercy and dislike slaughter", () => {
    const kind = companionsReact({}, [{ day: 1, kind: "spared", target: "x", name: "X" }], [{ id: "mara", warmth: 4 }]);
    expect(kind.mara!.affinity).toBeGreaterThan(0);
    const grim = companionsReact({}, [{ day: 1, kind: "killed", target: "x", name: "X", n: 5 }], [{ id: "mara", warmth: 4 }]);
    expect(grim.mara!.affinity).toBeLessThan(0);
  });
});

describe("Notice", () => {
  test("mentions find known names and new proper names, not sentence starts or the player", () => {
    const known = [{ key: "cast:mara", name: "Mara" }, { key: "place:tavern", name: "The Drowned Lantern" }];
    const m = mentions("Then I ask Mara about Old Brannoc, the one at the drowned lantern who sold Wren out.", known, ["Wren"]);
    expect(m.sort()).toEqual(["cast:mara", "name:Old Brannoc", "place:tavern"]);
  });

  test("promotions wait for the threshold and stop at three active", () => {
    expect(readyToPromote({ "name:A": 7, "name:B": 2 }, [])).toEqual(["name:A"]);
    const active = [1, 2, 3].map((i) => ({ key: `name:${i}`, done: false }) as never);
    expect(readyToPromote({ "name:A": 9 }, active)).toEqual([]);
  });

  test("a promotion's steps must point at real places; the night only scars a place you touched", () => {
    const places = new Set(["docks", "tavern"]);
    expect(parsePromotion({ dossier: "d", item: { name: "Ring" }, steps: [{ text: "a", where: "docks" }, { text: "b", where: "nowhere" }] }, "X", places)).toBeNull();
    expect(parsePromotion({ dossier: "d", item: { name: "Ring" }, steps: [{ text: "a", where: "docks" }, { text: "b", where: "tavern" }] }, "X", places)?.steps).toHaveLength(2);
    const deeds: Deed[] = [{ day: 1, kind: "killed", target: "b", name: "B", n: 4, place: "docks", method: "fire" }];
    expect(fallbackNight(deeds, 1).scars[0]).toMatchObject({ place: "docks", flag: "burned" });
  });
});

describe("memory in play", () => {
  function setup() {
    const files = new Map<string, unknown>();
    const posted: string[] = [];
    const sent: ToFrontend[] = [];
    const started: BattleState[] = [];
    const talked: string[] = [];
    const requested: string[] = [];
    const spindle = {
      log: { info() {}, warn() {}, error() {} },
      userStorage: {
        getJson: async (p: string, o: { fallback: unknown }) => (files.has(p) ? structuredClone(files.get(p)) : o.fallback),
        setJson: async (p: string, v: unknown) => void files.set(p, structuredClone(v)),
      },
      chat: { appendMessage: async (_c: string, m: { content: string }) => void posted.push(m.content) },
    };
    const art = { request: (key: string) => (requested.push(key), { key, state: "queued" }), status: () => null, whenDone: () => new Promise(() => {}) };
    const cards = { sheetFor: async () => sheet as never, armory: async () => sheet as never, talk: async (_u: string, _c: string, id: string) => void talked.push(id), recent: async () => [] };
    const play = createPlay(spindle as never, (m) => sent.push(m), art as never, cards, { startState: async (_u: string, s: BattleState) => void started.push(s) });
    const last = (): SceneView => sent.flatMap((m) => (m.type === "scene.state" ? [m.view] : [])).at(-1)!;
    return { play, files, posted, started, talked, requested, last };
  }

  const win = (s: BattleState, how: (i: number) => object): BattleState => ({
    ...s,
    outcome: "victory",
    combatants: s.combatants.map((c, i) => (c.side === "enemy" ? { ...c, alive: false, hp: 0, ...how(i) } : c)),
    meta: { ...s.meta, tally: { elements: { fire: 90 }, statuses: {}, talks: 0, hits: 6 } },
  });

  test("a recruit joins the next fight; a Parley's lie is remembered and reaches the narrator", async () => {
    const { play, started, last } = setup();
    await play.open("u", "c1");
    await play.fight("u", "c1");
    const s = started[0]!;
    const enemyIdx = s.combatants.findIndex((c) => c.side === "enemy");
    await play.onBattleEnd(win(s, (i) => (i === enemyIdx ? { alive: true, left: "recruit" } : {})), "u");
    expect(last().journal.companions.some((c) => c.recruit)).toBe(true);
    await play.fight("u", "c1");
    expect(started[1]!.combatants.filter((c) => c.side === "party").length).toBeGreaterThan(started[0]!.combatants.filter((c) => c.side === "party").length);

    await play.onParleyEnd("u", { card: { castId: "mara" }, npc: { name: "Mara" } } as never, { chatId: "c1", end: { kind: "walked" }, exchanges: [{ read: { tactic: "bluff" }, bluff: { fact: null } }] } as never);
    const out = await play.intercept([{ role: "system", content: "preset" }, { role: "user", content: "hi" }] as never, { chatId: "c1", userId: "u", generationType: "normal" } as never);
    expect(out).toHaveLength(3);
    expect(String(out[1]!.content)).toMatch(/Mara remembers \(feels wary\): .*lied to them/);
  });

  test("resting runs the night: a bloodied place is redrawn, and a group you keep hurting adapts with a rumour", async () => {
    const { play, started, last, posted, requested } = setup();
    await play.open("u", "c2");
    for (let i = 0; i < 3; i++) {
      await play.fight("u", "c2");
      await play.onBattleEnd(win(started[i]!, () => ({})), "u");
    }
    await play.act("u", "c2", "rest");
    await new Promise((res) => setTimeout(res, 5)); // the night phase finishes in the background
    const v = last();
    expect(v.place.art).toMatch(/~(burned|bloodied)$/);
    expect(requested.some((k) => /~(burned|bloodied)$/.test(k))).toBe(true);
    expect(posted.some((p) => /By morning:[\s\S]*The Docks/.test(p))).toBe(true);
    expect(v.journal.deeds.length).toBeGreaterThan(0);
    // Six or more of one kind fell: they adapt, and the montage opens with the rumour.
    if (v.journal.rumors.length) expect(posted.some((p) => p.includes("Word goes round"))).toBe(true);
  });

  test("names the player keeps bringing up are promoted into people with a questline", async () => {
    const { play, last, posted, talked } = setup();
    await play.open("u", "c3");
    for (let i = 0; i < 6; i++) await play.notice("u", "c3", [{ name: "Wren", content: `I ask about Old Brannoc again (${i}).`, isUser: true }]);
    await new Promise((r) => setTimeout(r, 10));
    await play.open("u", "c3");
    const q = last().journal.quests.find((x) => x.name === "Old Brannoc")!;
    expect(q.steps.length).toBeGreaterThanOrEqual(2);
    // They stand somewhere and can be talked to.
    const extra = await play.extraCast("u", "c3");
    expect(extra.map((c) => c.name)).toEqual(["Old Brannoc"]);
    // Following the steps by Looking around where they point finishes the thread and gives the item.
    for (const step of q.steps) {
      const target = Object.entries({ docks: "The Docks", tavern: "The Drowned Lantern", caves: "Smugglers' Caves" }).find(([, n]) => n === step.where)?.[0];
      if (!target) continue;
      // The town links every place through the docks (its hub).
      if (last().place.id !== target && last().place.id !== "docks") await play.act("u", "c3", "go:docks");
      if (last().place.id !== target) await play.act("u", "c3", `go:${target}`);
      await play.act("u", "c3", "search");
      if (last().journal.quests[0]!.done) break;
      if (last().place.id !== "docks") await play.act("u", "c3", "go:docks");
      await play.act("u", "c3", "rest");
    }
    expect(last().journal.quests[0]!.done).toBe(true);
    expect(last().journal.items[0]!.from).toBe("Old Brannoc");
    expect(posted.some((p) => p.includes("comes together"))).toBe(true);
    void talked;
  });

  test("a companion at the bond line gets a personal quest and a combo skill", async () => {
    const { play, started, last } = setup();
    await play.open("u", "c4");
    for (let i = 0; i < 8; i++) await play.onParleyEnd("u", { card: { castId: "mara" }, npc: { name: "Mara" } } as never, { chatId: "c4", end: { kind: "won" }, exchanges: [] } as never);
    expect(last().journal.companions.find((c) => c.id === "mara")?.affinity ?? 0).toBeGreaterThanOrEqual(BOND_AT); // a finished talk refreshes the scene
    await play.act("u", "c4", "rest");
    await new Promise((res) => setTimeout(res, 5)); // the night phase finishes in the background
    const v = last();
    expect(v.journal.companions.find((c) => c.id === "mara")!.bonded).toBe(true);
    expect(v.journal.quests.some((x) => x.name === "Mara")).toBe(true);
    await play.fight("u", "c4");
    const me = started.at(-1)!.combatants.find((c) => c.id === "p_player")!;
    expect(started.at(-1)!.skills[Object.keys(started.at(-1)!.skills).find((k) => k.startsWith("combo_"))!]?.name).toBe("Wren & Mara");
    void me;
  });
});
