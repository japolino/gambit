import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { FEATURES } from "../src/shared/features.js";
import { createPlay } from "../src/backend/play.js";
import { fallbackFoes } from "../src/engine/card/foes.js";
import { CLASSES } from "../src/engine/content/classes.js";
import {
  addToCodex,
  applyAwakenings,
  AWAKEN_AT,
  balance,
  classFromDraft,
  countUses,
  fallbackAwakenings,
  fallbackForge,
  familiesOf,
  flatAtoms,
  fromCodex,
  fuseClasses,
  fuseResource,
  newBook,
  rankOf,
  restrictAtoms,
  TIER_ROOM,
} from "../src/engine/forge/forge.js";
import { emptyTally, tallyEvents } from "../src/engine/memory/memory.js";
import type { BattleState, ClassDef } from "../src/engine/types.js";
import { parseAwaken, parseForge, parseFusion } from "../src/meaning/forge.js";
import { buildForgeView, type ForgeView } from "../src/shared/forge-view.js";
import type { ToFrontend } from "../src/shared/protocol.js";

const D = CLASSES.duelist!;
const H = CLASSES.hexwright!;
const W = CLASSES.warden!;

describe("the class book", () => {
  test("ranks come from wins, two a rank, up to five", () => {
    expect([0, 1, 2, 3, 4, 5, 8, 20].map(rankOf)).toEqual([1, 1, 2, 2, 3, 3, 5, 5]);
  });

  test("uses count toward awakening, and an awakened skill replaces the original", () => {
    const b = newBook();
    expect(countUses(b, { duelist_flurry: AWAKEN_AT - 1 })).toEqual([]);
    expect(countUses(b, { duelist_flurry: 1 })).toEqual(["duelist_flurry"]);
    expect(countUses(b, { duelist_flurry: 5 })).toEqual([]);
    const flurry = D.skills.find((s) => s.id === "duelist_flurry")!;
    const [aw] = fallbackAwakenings(flurry);
    b.awakened.duelist_flurry = aw!;
    expect(applyAwakenings(D, b.awakened).skills.map((s) => s.id)).toContain(aw!.id);
  });

  test("the player's skill uses are tallied from battle events", () => {
    const t = tallyEvents(emptyTally(), [
      { kind: "use", actor: "p_player", skill: "duelist_flurry", name: "Flurry", targets: [] },
      { kind: "use", actor: "p_player", skill: "duelist_flurry", name: "Flurry", targets: [] },
      { kind: "use", actor: "p_mara", skill: "x", name: "X", targets: [] },
      { kind: "use", actor: "p_player", skill: "talk:surrender", name: "Talk", targets: [] },
    ], new Set(["p_player", "p_mara"]));
    expect(t.uses).toEqual({ duelist_flurry: 2 });
  });
});

describe("fusion", () => {
  test("blends stats with one mutation, makes a hybrid resource, keeps two skills from each parent and adds three", () => {
    const f = fuseClasses(D, W, null, "seed-1");
    expect(f.def.resource?.name).toBe("Momentum");
    expect(f.changes.some((c) => c.startsWith("Mutation:"))).toBe(true);
    expect(f.def.skills).toHaveLength(7);
    expect(f.def.skills.filter((s) => s.signature)).toHaveLength(1);
    // Same seed, same fusion.
    expect(JSON.stringify(fuseClasses(D, W, null, "seed-1").def)).toBe(JSON.stringify(f.def));
    // Every skill is sized.
    for (const s of f.def.skills) expect(JSON.stringify(s.atoms)).not.toContain('"auto"');
  });

  test("new skills use only what the parents use", () => {
    const fam = familiesOf(D, H);
    const notes: string[] = [];
    const out = restrictAtoms(
      [
        { op: "hit", element: "storm", scale: "might", power: "auto" },
        { op: "status", status: "regen", chance: "auto" },
        { op: "heal", power: "auto" },
      ],
      fam,
      notes,
      "Test",
    );
    expect(out.map((a) => a.op)).toEqual(["hit"]);
    expect((out[0] as { element: string }).element).not.toBe("storm");
    expect(notes).toHaveLength(3);
    const draft = parseFusion({ name: "Ashblade", identity: "x", skills: [{ name: "Frost Heal", target: "ally", tier: 2, atoms: [{ op: "heal" }] }, { name: "Hex Cut", target: "enemy", tier: 3, signature: true, atoms: [{ op: "hit", element: "shadow" }, { op: "status", status: "burn" }] }] }, D, H)!;
    const f = fuseClasses(D, H, draft, "s");
    expect(f.changes.some((c) => c.includes("Frost Heal was dropped"))).toBe(true);
    const made = f.def.skills.slice(4);
    for (const a of made.flatMap((s) => flatAtoms(s.atoms))) {
      expect(fam.ops.has(a.op)).toBe(true);
      if (a.op === "hit") expect(fam.elements.has(a.element)).toBe(true);
    }
  });

  test("a pair with no hybrid entry keeps one resource with a twist", () => {
    const forged = { ...D, resource: { id: "flavor", name: "Flavor", max: 5, start: 0, gain: [{ on: "kill" as const, n: 1 }] } };
    const r = fuseResource(forged, W, "x");
    expect(r.resource?.name).toMatch(/^Twisted /);
    expect(r.resource!.gain.length).toBe(2);
  });
});

describe("the Forge", () => {
  const raw = {
    name: "War-chef",
    identity: "A cook who fights.",
    element: "fire",
    high: ["might", "will"],
    low: "speed",
    hp: "high",
    resource: { name: "Flavor", gain: ["apply_status", "kill", "turn_start"], max: 9 },
    passive: { name: "Second Helping", text: "Heals a little at the start of a turn.", on: "turn_start", atoms: [{ op: "heal" }] },
    skills: [
      { name: "Cleaver", target: "enemy", tier: 4, atoms: [{ op: "hit", element: "physical", hits: 2 }] },
      { name: "Feast", target: "all_allies", tier: 4, atoms: [{ op: "heal" }, { op: "status", status: "regen" }] },
      { name: "Flambé", target: "all_enemies", tier: 4, atoms: [{ op: "hit", element: "fire" }, { op: "status", status: "burn" }] },
      { name: "Chef's Kiss", target: "enemy", tier: 4, signature: true, atoms: [{ op: "hit", element: "fire" }, { op: "execute" }] },
      { name: "Win Instantly", target: "enemy", tier: 4, atoms: [{ op: "instant_win" }] },
    ],
    brief: "a broad cook in a stained apron with two cleavers",
    palette: "#3a1f12,#d98b3a,#f2e6d0",
    changes: ["Asked for stacks per distinct meal; it fills when you apply a status instead."],
  };

  test("parses a draft; drops what isn't an atom; keeps a class inside its tier room", () => {
    const d = parseForge(raw, "A war-chef who fights with cleavers")!;
    expect(d.skills.map((s) => s.name)).toEqual(["Cleaver", "Feast", "Flambé", "Chef's Kiss"]);
    const notes: string[] = [];
    const c = classFromDraft(d, "seed", notes);
    expect(c.skills.reduce((n, s) => n + s.tier, 0)).toBeLessThanOrEqual(TIER_ROOM);
    expect(c.skills.filter((s) => s.signature)).toHaveLength(1);
    expect(c.resource?.max).toBe(6);
    expect(c.resource?.gain).toHaveLength(2);
    expect(c.passives[0]?.chance).toBe(100);
    expect(c.base.might).toBeGreaterThan(c.base.speed);
    expect(notes.some((n) => n.startsWith("Lowered"))).toBe(true);
    // The signature pays with the class resource.
    expect(c.skills.find((s) => s.signature)?.cost?.resource).toBe(3);
  });

  test("junk does not parse", () => {
    expect(parseForge({ name: "X", skills: [] }, "")).toBeNull();
    expect(parseForge({}, "")).toBeNull();
  });

  test("with no model, the closest base class is renamed from the words", () => {
    const d = fallbackForge("A war-chef who fights with cleavers and feeds the party", W);
    expect(d.name).toBe("War-chef");
    expect(classFromDraft(d, "x").skills.length).toBe(W.skills.length);
  });

  test("test fights size a class against a Duelist; a class far too strong drops a tier", () => {
    const notes: string[] = [];
    const strong: ClassDef = { ...D, id: "strong", base: { ...D.base, hp: 400, might: 60, speed: 40 }, growth: { ...D.growth, might: 8 } };
    const out = balance(strong, notes, 6);
    expect(out.sim).toMatch(/^Test fights: won \d+%/);
    expect(notes.some((n) => n.includes("too strong"))).toBe(true);
  });
});

describe("awakening", () => {
  test("three mutations, a tier up, a new cut-in", () => {
    const s = D.skills.find((x) => x.id === "duelist_flurry")!;
    const opts = fallbackAwakenings(s);
    expect(opts).toHaveLength(3);
    for (const o of opts) {
      expect(o.tier).toBe(Math.min(4, s.tier + 1));
      expect(o.visual?.cutin).not.toBe(s.visual?.cutin ?? "diagonal_band");
    }
    const parsed = parseAwaken({ options: [{ name: "Storm", target: "enemy", atoms: [{ op: "hit", element: "storm", hits: 2 }] }] }, s);
    expect(parsed?.[0]?.name).toBe("Flurry: Storm");
  });
});

describe("the codex", () => {
  test("keeps one entry per class; a class taken into a new campaign starts at rank 1", () => {
    const f = fuseClasses(D, H, null, "z").def;
    let c = addToCodex({ v: 1, entries: [] }, { id: f.id, name: f.name, origin: "fused", parents: ["Duelist", "Hexwright"], card: "A", def: f, at: 1 });
    c = addToCodex(c, { id: f.id, name: f.name, origin: "fused", card: "B", def: f, at: 2 });
    expect(c.entries).toHaveLength(1);
    expect(c.entries[0]!.card).toBe("B");
    expect(rankOf(fromCodex(c.entries[0]!).wins)).toBe(1);
  });
});

/* ------------------------------- in play ------------------------------- */

const ev = { source: "card" as const, quote: "", verified: true };
const sheet = {
  v: 1,
  cardKey: "card-0007",
  cardName: "Saltmarsh",
  characterIds: [],
  readAt: 1,
  premise: "A fog-bound harbor town.",
  tone: "",
  shape: "town",
  modules: { parley: true, encounters: true, places: true, delves: true, kits: true, economy: true },
  skin: { genre: "low fantasy", currency: "crowns", fight: "brawl", stats: { presence: "Presence", menace: "Menace", guile: "Guile" } },
  player: { name: "Wren", concept: "a courier", social: { presence: 2, menace: 1, guile: 3 } },
  cast: [{ id: "mara", name: "Mara", role: "the harbormaster", look: "", main: true, pronoun: "she", evidence: ev }],
  places: [
    { id: "docks", name: "The Docks", description: "Wet planks and gulls", evidence: ev },
    { id: "tavern", name: "The Drowned Lantern", description: "A tavern with rooms to rent", evidence: ev },
  ],
  facts: [],
  notes: [],
  foes: fallbackFoes("low fantasy"),
  kits: [],
};

describe("classes in play", () => {
  // The class panel is switched off in the game (shared/features.ts); it is kept working, so it is tested switched on.
  beforeAll(() => void (FEATURES.forge = true));
  afterAll(() => void (FEATURES.forge = false));
  function setup() {
    const files = new Map<string, unknown>();
    const posted: string[] = [];
    const sent: ToFrontend[] = [];
    const started: BattleState[] = [];
    const requested: string[] = [];
    const spindle = {
      log: { info() {}, warn() {}, error() {} },
      userStorage: {
        getJson: async (p: string, o: { fallback: unknown }) => (files.has(p) ? structuredClone(files.get(p)) : o.fallback),
        setJson: async (p: string, v: unknown) => void files.set(p, structuredClone(v)),
      },
      chat: { appendMessage: async (_c: string, m: { content: string }) => void posted.push(m.content) },
    };
    const art = { request: (key: string) => (requested.push(key), { key, state: "queued" }), status: () => null, expect: () => {}, adopt: () => {} };
    const cards = { sheetFor: async () => sheet as never, armory: async () => sheet as never, talk: async () => {}, recent: async () => [] };
    const play = createPlay(spindle as never, (m) => sent.push(m), art as never, cards, { startState: async (_u: string, s: BattleState) => void started.push(s) });
    const forge = (): ForgeView => sent.flatMap((m) => (m.type === "forge.state" ? [m.view] : [])).at(-1)!;
    return { play, files, posted, started, requested, forge };
  }

  const win = (s: BattleState, uses: Record<string, number> = {}, boss = false): BattleState => ({
    ...s,
    outcome: "victory",
    combatants: s.combatants.map((c) => (c.side === "enemy" ? { ...c, alive: false, hp: 0 } : c)),
    meta: { ...s.meta, ...(boss ? { boss: true } : {}), tally: { elements: {}, statuses: {}, talks: 0, hits: 3, uses } },
  });

  test("wins rank up the class in use, bosses leave catalysts, and two rank-3 classes fuse into the codex", async () => {
    const { play, started, posted, forge, files } = setup();
    await play.open("u", "c1");
    // Six wins as the card kit (rank 3, two of them bosses), then six as the Hexwright.
    for (let i = 0; i < 6; i++) {
      await play.fight("u", "c1");
      await play.onBattleEnd(win(started.at(-1)!, {}, i < 2), "u");
    }
    await play.forgeAct("u", "c1", "use", "hexwright");
    for (let i = 0; i < 6; i++) {
      await play.fight("u", "c1");
      expect(started.at(-1)!.combatants.find((c) => c.id === "p_player")!.defId).toBe("hexwright");
      await play.onBattleEnd(win(started.at(-1)!), "u");
    }
    await play.forgeAct("u", "c1", "open");
    let v = forge();
    expect(v.classes.find((c) => c.id === "card")!.rank).toBe(4);
    expect(v.classes.find((c) => c.id === "hexwright")!.rank).toBe(4);
    expect(v.catalysts).toBe(2);
    expect(posted.some((p) => p.includes("reaches rank 3 and can be fused"))).toBe(true);

    await play.forgeAct("u", "c1", "fuse", "card", "hexwright");
    v = forge();
    expect(v.pending?.kind).toBe("fusion");
    expect(v.pending?.sheet?.skills.length).toBe(7);
    expect(v.catalysts).toBe(1);
    expect(v.pending?.canReroll).toBe(true);
    // Declining gives the catalyst back.
    await play.forgeAct("u", "c1", "decline");
    expect(forge().catalysts).toBe(2);
    await play.forgeAct("u", "c1", "fuse", "card", "hexwright");
    await play.forgeAct("u", "c1", "reroll");
    v = forge();
    expect(v.catalysts).toBe(0);
    expect(v.pending?.canReroll).toBe(false);
    await play.forgeAct("u", "c1", "confirm");
    v = forge();
    const fused = v.classes.find((c) => c.origin === "fused")!;
    expect(fused.active).toBe(true);
    expect(fused.parents).toHaveLength(2);
    expect(v.codex.map((e) => e.id)).toEqual([fused.id]);
    expect((files.get("codex.json") as { entries: unknown[] }).entries).toHaveLength(1);

    // The next fight is fought as the fusion, with its own portrait.
    await play.fight("u", "c1");
    const me = started.at(-1)!.combatants.find((c) => c.id === "p_player")!;
    expect(me.defId).toBe(fused.id);
    expect(me.art).toBe(`forge:${fused.id}`);
    expect(started.at(-1)!.meta?.classes?.[fused.id]?.name).toBe(fused.name);
  });

  test("the Forge spends a Blank Crest only when kept; a skill used fifty times awakens", async () => {
    const { play, started, forge, posted } = setup();
    await play.open("u", "c2");
    await play.forgeAct("u", "c2", "forge", undefined, undefined, "A war-chef who fights with cleavers and feeds the party between turns.");
    let v = forge();
    expect(v.pending?.kind).toBe("forge");
    expect(v.pending?.sim).toMatch(/^Test fights/);
    expect(v.crests).toBe(1);
    await play.forgeAct("u", "c2", "confirm");
    v = forge();
    expect(v.crests).toBe(0);
    expect(v.classes.find((c) => c.origin === "forged")?.active).toBe(true);
    // A second forge needs a new crest.
    await play.forgeAct("u", "c2", "forge", undefined, undefined, "Another one entirely, please.");
    expect(forge().pending).toBeNull();

    await play.forgeAct("u", "c2", "use", "duelist");
    await play.fight("u", "c2");
    await play.onBattleEnd(win(started.at(-1)!, { duelist_flurry: AWAKEN_AT }), "u");
    expect(posted.some((p) => p.includes(`Flurry has been used ${AWAKEN_AT} times`))).toBe(true);
    await play.forgeAct("u", "c2", "awaken", "duelist_flurry");
    v = forge();
    expect(v.pending?.options).toHaveLength(3);
    await play.forgeAct("u", "c2", "pick", "0");
    v = forge();
    expect(v.skills.find((s) => s.id === "duelist_flurry")?.awakened).toBe(true);
    await play.fight("u", "c2");
    const skills = started.at(-1)!.combatants.find((c) => c.id === "p_player")!.skills;
    expect(skills.some((id) => id.endsWith("_aw"))).toBe(true);
  });

  test("the view lists every base class beside your own", () => {
    const b = newBook();
    const v = buildForgeView("c", b, { v: 1, entries: [] }, (o) => `class:${o.def.id}`, null);
    expect(v.classes.map((c) => c.id).sort()).toEqual(Object.keys(CLASSES).sort());
    expect(v.pending).toBeNull();
  });
});
