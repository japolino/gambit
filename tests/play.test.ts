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
  cast: [{ id: "mara", name: "Mara", role: "the harbormaster, usually at the docks", look: "", main: true, pronoun: "she", temperament: { warmth: 0.5, pride: 0.5, greed: 0.5, fear: 0.5 }, evidence: ev }],
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

function setup(o: { sheet?: Record<string, unknown>; cards?: Record<string, unknown> } = {}) {
  const card = { ...sheet, ...o.sheet };
  const files = new Map<string, unknown>();
  const posted: string[] = [];
  const messages: { role: string; content: string; metadata?: Record<string, unknown> }[] = [];
  const sent: ToFrontend[] = [];
  const started: BattleState[] = [];
  const known: string[] = [];
  const talks: { castId: string; kind?: string; line?: string }[] = [];
  const spindle = {
    log: { info() {}, warn() {}, error() {} },
    userStorage: {
      getJson: async (p: string, o: { fallback: unknown }) => (files.has(p) ? structuredClone(files.get(p)) : o.fallback),
      setJson: async (p: string, v: unknown) => void files.set(p, structuredClone(v)),
    },
    chat: {
      appendMessage: async (_chatId: string, m: { role: string; content: string; metadata?: Record<string, unknown> }) => {
        posted.push(m.content);
        messages.push(m);
      },
      getMessages: async () => messages.map((m) => ({ ...m, hidden: false })),
    },
    personas: { getActive: async () => ({ description: "A wiry courier." }) },
  };
  const art = { request: () => ({ key: "", state: "queued" }), status: () => null, expect: () => {}, adopt: () => {}, whenDone: () => new Promise(() => {}) };
  const cards = {
    sheetFor: async () => card as never,
    armory: async () => card as never,
    talk: async (_u: string, _c: string, castId: string, kind?: string, _chip?: string, line?: string) => void talks.push({ castId, kind, line }),
    markKnown: async (_u: string, _c: string, id: string) => void known.push(id),
    ...o.cards,
  };
  /** What the battles session has, by id: reshow answers from this, as it would from storage. */
  const fights = new Map<string, BattleState>();
  const reshown: string[] = [];
  const battles = {
    startState: async (_u: string, s: BattleState) => {
      started.push(s);
      fights.set(s.id, s);
    },
    reshow: async (_u: string, id: string) => {
      const s = fights.get(id) ?? null;
      if (s?.outcome === "ongoing") reshown.push(id);
      return s;
    },
  };
  const play = createPlay(spindle as never, (m) => sent.push(m), art as never, cards, battles);
  const views = () => sent.flatMap((m) => (m.type === "scene.state" ? [m.view] : []));
  const last = (): SceneView => views()[views().length - 1]!;
  return { play, files, posted, messages, sent, started, known, talks, last, fights, reshown };
}

/** End a started battle the way the engine would, with the given outcome. */
function ended(s: BattleState, outcome: "victory" | "defeat"): BattleState {
  return {
    ...s,
    outcome,
    combatants: s.combatants.map((c) => (c.side === "enemy" ? { ...c, alive: outcome !== "victory", hp: outcome === "victory" ? 0 : c.hp } : { ...c, hp: outcome === "victory" ? Math.round(c.maxHp / 2) : 0, alive: outcome === "victory" })),
  };
}

describe("a fight nobody can see", () => {
  const record = (files: Map<string, unknown>) => files.get("play/chat1.json") as { battleId?: string; board?: { fight?: unknown; foes: { id: string }[] } };

  test("opening the scene brings a running fight back, after the scene", async () => {
    const { play, started, reshown, sent } = setup();
    await play.open("u", "chat1");
    await play.fight("u", "chat1");
    expect(reshown).toEqual([]);
    await play.open("u", "chat1");
    expect(reshown).toEqual([started[0]!.id]);
    expect(sent.at(-1)?.type).toBe("scene.state");
  });

  test("a click on the board during the fight brings it back instead of doing nothing", async () => {
    const { play, files, started, reshown } = setup();
    await play.open("u", "chat1");
    await play.fight("u", "chat1");
    const r = record(files);
    files.set("play/chat1.json", { ...r, board: { foes: [], party: [], cells: {} } });
    await play.boardAct("u", "chat1", "move", "0,0");
    expect(reshown).toEqual([started[0]!.id]);
  });

  test("a fight that finished unnoticed is settled when the scene opens", async () => {
    const { play, files, started, fights } = setup();
    await play.open("u", "chat1");
    await play.fight("u", "chat1");
    fights.set(started[0]!.id, ended(started[0]!, "victory"));
    await play.open("u", "chat1");
    expect(record(files).battleId).toBeUndefined();
  });

  test("a fight that's gone no longer locks the scene", async () => {
    const { play, files, fights } = setup();
    await play.open("u", "chat1");
    await play.fight("u", "chat1");
    fights.clear();
    await play.open("u", "chat1");
    expect(record(files).battleId).toBeUndefined();
  });
});

describe("play on a card", () => {
  test("a risky line in the scene rolls, keeps the player's words, and lands in the story and the chat", async () => {
    const { play, last, posted } = setup();
    await play.open("u", "chat1");
    await play.say("u", "chat1", "I sneaked past Mara");
    const beat = last().story[0]!;
    expect(beat.said).toBe("I sneaked past Mara");
    expect(beat.roll).toMatch(/^Sneaking: \d+ vs 12, /);
    expect(beat.reply.length).toBeGreaterThan(0);
    expect(last().busy).toBeUndefined();
    expect(posted.at(-1)).toBe("I sneaked past Mara");
  });

  test("an ordinary line rolls nothing", async () => {
    const { play, last } = setup();
    await play.open("u", "chat1");
    await play.say("u", "chat1", "I watch the gulls for a while");
    expect(last().story[0]!.roll).toBeNull();
  });

  test("when no narrator can write, the player reads plain words and the chat keeps only their line", async () => {
    const { play, last, posted } = setup();
    await play.open("u", "chat1");
    await play.say("u", "chat1", "I sneaked past Mara");
    expect(last().story[0]!.reply).not.toMatch(/show|consequence|they wrote/i);
    expect(posted).toEqual(["I sneaked past Mara"]);
  });

  test("pressing someone opens a Parley, with the line as the first word", async () => {
    const { play, last, talks } = setup();
    await play.open("u", "chat1");
    await play.say("u", "chat1", "I threaten Mara until she talks");
    expect(talks).toEqual([{ castId: "mara", kind: "intimidate", line: "I threaten Mara until she talks" }]);
    expect(last().busy).toBeUndefined();
    // What you wrote stays written: the talk's ending follows it.
    expect(last().story.map((b: { said: string }) => b.said)).toEqual(["I threaten Mara until she talks"]);
  });

  test("talking to someone is talking: no contest starts until a line presses them", async () => {
    const { play, talks } = setup();
    await play.open("u", "chat1");
    await play.act("u", "chat1", "talk:mara");
    expect(talks).toEqual([]);
  });

  describe("what a talk leaves behind", () => {
    const end = (kind: string, money = true, about = false) => ({
      scenario: { npc: { name: "Mara" }, card: { castId: "mara", ...(about ? { aboutThread: true } : {}) }, contest: { stake: "a place on the night boat", unit: "crowns", money } } as never,
      state: { chatId: "chat1", exchanges: [{ read: { tactic: "logic" }, text: "Well?", reply: "Fine.", bluff: null }], end: kind === "deal" ? { kind, value: 20 } : { kind } } as never,
    });
    const record = (files: Map<string, unknown>) => files.get("play/chat1.json") as { scene: { coin: number }; revealed?: string[]; thread?: unknown; memory: { items: { name: string; from: string }[] } };

    test("a deal is paid for, and what was at stake is yours", async () => {
      const { play, files, last } = setup();
      await play.open("u", "chat1");
      const coin = record(files).scene.coin;
      const e = end("deal");
      await play.onParleyEnd("u", e.scenario, e.state);
      expect(record(files).scene.coin).toBe(coin - 20);
      expect(record(files).memory.items).toMatchObject([{ name: "a place on the night boat", from: "Mara" }]);
      expect(last().story.at(-1)?.found).toBe("Yours now: a place on the night boat.");
    });

    test("a price that isn't money costs no money", async () => {
      const { play, files } = setup();
      await play.open("u", "chat1");
      const coin = record(files).scene.coin;
      const e = end("deal", false);
      await play.onParleyEnd("u", e.scenario, e.state);
      expect(record(files).scene.coin).toBe(coin);
    });

    test("walking away gets you nothing", async () => {
      const { play, files, last } = setup();
      await play.open("u", "chat1");
      const coin = record(files).scene.coin;
      const e = end("walked");
      await play.onParleyEnd("u", e.scenario, e.state);
      expect(record(files).scene.coin).toBe(coin);
      expect(record(files).memory?.items ?? []).toEqual([]);
      expect(last().story.at(-1)?.found).toBeUndefined();
    });

    test("the next talk starts from what the last one left", async () => {
      const { play } = setup();
      await play.open("u", "chat1");
      const e = end("refused");
      await play.onParleyEnd("u", e.scenario, e.state);
      const s = await play.standing("u", "chat1", "mara");
      expect(s?.history.remembers.join(" ")).toContain("refused");
      expect(s?.history.remembers.join(" ")).toContain("it ended");
    });
  });

  test("naming someone who isn't here brings them into the scene", async () => {
    const { play, talks, files } = setup();
    await play.open("u", "chat1");
    const key = [...files.keys()].find((k) => k.includes("chat1"))!;
    const saved = files.get(key) as { world: { places: Record<string, { people: string[] }> }; scene: { placeId: string } };
    for (const p of Object.values(saved.world.places)) p.people = [];
    await play.say("u", "chat1", "I find Mara and threaten her");
    expect(talks[0]?.castId).toBe("mara");
    const after = files.get(key) as typeof saved;
    expect(after.world.places[after.scene.placeId]!.people).toContain("mara");
  });

  test("violence opens a fight with them", async () => {
    const { play, started, posted } = setup();
    await play.open("u", "chat1");
    await play.say("u", "chat1", "I stab Mara");
    expect(started.length).toBe(1);
    expect(posted).toContain("I stab Mara");
  });

  test("going somewhere moves the scene and writes the arrival", async () => {
    const { play, last, files } = setup();
    await play.open("u", "chat1");
    await play.say("u", "chat1", "I head to the Drowned Lantern");
    const r = files.get([...files.keys()].find((k) => k.includes("chat1"))!) as { scene: { placeId: string; time: number } };
    expect(r.scene.placeId).toBe("tavern");
    expect(r.scene.time).toBe(1);
    expect(last().story[0]!.said).toBe("I head to the Drowned Lantern");
  });

  test("a walk next door on the overland takes part of the day, and only a step of the day on the road eats a supply", async () => {
    const { play, files } = setup({ sheet: { shape: "frontier" } });
    await play.open("u", "chat1");
    const key = [...files.keys()].find((k) => k.includes("chat1"))!;
    const at = () => files.get(key) as { scene: { placeId: string; time: number }; spent: number; hex: { state: { supplies: number } } };
    // The tavern is two cells from the docks on this seed.
    await play.act("u", "chat1", "go:tavern");
    expect([at().scene.placeId, at().scene.time, at().spent, at().hex.state.supplies]).toEqual(["tavern", 0, 2, 8]);
    await play.act("u", "chat1", "go:docks");
    expect([at().scene.placeId, at().scene.time, at().spent, at().hex.state.supplies]).toEqual(["docks", 1, 1, 7]);
  });

  test("a walk by the menu that runs past midnight brings the night", async () => {
    const { play, files, sent } = setup({ sheet: { shape: "frontier" } });
    await play.open("u", "chat1");
    const key = [...files.keys()].find((k) => k.includes("chat1"))!;
    const r = files.get(key) as { scene: object };
    files.set(key, { ...r, scene: { ...r.scene, time: 3 }, spent: 2 });
    await play.act("u", "chat1", "go:tavern");
    expect(sent.some((m) => m.type === "scene.meanwhile")).toBe(true);
  });

  test("writing runs the clock, and enough of it moves the day on", async () => {
    const { play, files } = setup();
    await play.open("u", "chat1");
    for (const l of ["I watch the gulls", "I hum a little", "I fix my boot"]) await play.say("u", "chat1", l);
    const r = files.get([...files.keys()].find((k) => k.includes("chat1"))!) as { scene: { time: number }; spent: number };
    expect([r.scene.time, r.spent]).toEqual([1, 0]);
  });

  test("looking around from the menu runs the same clock as a written search", async () => {
    const { play, files } = setup();
    await play.open("u", "chat1");
    const record = () => files.get([...files.keys()].find((k) => k.includes("chat1"))!) as { scene: { time: number }; spent: number };
    await play.act("u", "chat1", "search");
    expect([record().scene.time, record().spent]).toEqual([0, 2]);
    await play.say("u", "chat1", "I watch the gulls");
    expect([record().scene.time, record().spent]).toEqual([1, 0]);
  });

  test("a thread runs against a deadline, and running out of days ends it", async () => {
    const { play, last, files } = setup();
    await play.open("u", "chat1");
    const key = [...files.keys()].find((k) => k.includes("chat1"))!;
    const put = (over: Record<string, unknown>) => files.set(key, { ...(files.get(key) as object), ...over });
    put({ thread: { goal: "Find the warden", revelations: [{ id: "a", text: "The warden fled" }, { id: "b", text: "North" }], by: "fallback" } });
    await play.open("u", "chat1");
    await play.say("u", "chat1", "I watch the gulls");
    expect(last().thread).toMatchObject({ goal: "Find the warden", daysLeft: 3 });
    put({ deadline: 0 });
    await play.say("u", "chat1", "I watch the gulls again");
    expect(last().thread).toMatchObject({ daysLeft: 0, ended: "lost" });
  });

  test("searching that works turns up the next piece of the thread, once per place per day", async () => {
    const { play, last, files } = setup();
    await play.open("u", "chat1");
    const key = [...files.keys()].find((k) => k.includes("chat1"))!;
    files.set(key, { ...(files.get(key) as object), thread: { goal: "Find the warden", revelations: [{ id: "a", text: "The warden fled" }, { id: "b", text: "North" }, { id: "c", text: "By boat" }], by: "fallback" } });
    for (let i = 0; i < 12 && !last().story.some((b) => b.found); i++) await play.say("u", "chat1", "I search the place");
    const beat = last().story.find((b) => b.found)!;
    expect(beat.found).toBe("The warden fled");
    expect(last().thread!.found).toEqual(["The warden fled"]);
  });

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

  test("a fight's result is on the page when you come back, and the night doesn't quote it as something you said", async () => {
    const { play, started, last } = setup();
    await play.open("u", "chat1");
    await play.act("u", "chat1", "go:tavern");
    await play.fight("u", "chat1");
    await play.onBattleEnd(ended(started[0]!, "defeat"), "u");
    const beat = last().story.at(-1)!;
    expect(beat.said).toBe("");
    expect(beat.roll).toContain("is lost");
    expect(last().place.id).toBe("docks");
  });

  test("where the winner keeps the loser, a lost fight claims you: no coin lost, no retreat to the start", async () => {
    const { play, started, last } = setup({ sheet: { skin: { ...sheet.skin, defeat: "claimed" } } });
    await play.open("u", "chat1");
    await play.act("u", "chat1", "go:tavern");
    await play.fight("u", "chat1");
    const coin = last().coin;
    await play.onBattleEnd(ended(started[0]!, "defeat"), "u");
    expect(last().story.at(-1)!.roll).toContain("claims Wren");
    expect(last().coin).toBe(coin);
    expect(last().place.id).toBe("tavern");
  });

  test("with adult scenes on, a fight offers one: the chat writes it under its own preset, with Gambit's note at the end", async () => {
    const { play, started, last, sent, messages, files } = setup({ cards: { adultOn: async () => true } });
    await play.open("u", "chat1");
    await play.fight("u", "chat1");
    await play.onBattleEnd(ended(started[0]!, "victory"), "u");
    const offer = last().menu.find((h) => h.id === "afterglow")!;
    expect(offer.label).toMatch(/^Claim /);
    await play.act("u", "chat1", "afterglow");
    expect(last().menu.some((h) => h.id === "afterglow")).toBe(false);
    const line = messages.at(-1)!;
    expect(line.content).toMatch(/^\*Wren claims .+\.\*$/);
    // The chat's generation: the note goes last, before the preset's prefill, and nothing before it changes. The
    // scene is known from the chat's latest line, whatever the preset did with it in the prompt.
    const prompt = [
      { role: "system", content: "preset" },
      { role: "user", content: `# User's input\n${line.content}` },
      { role: "assistant", content: "Mm,", partial: true },
    ];
    const out = await play.intercept(prompt as never, { userId: "u", chatId: "chat1", generationType: "normal" } as never);
    expect(out.slice(0, 2)).toEqual(prompt.slice(0, 2) as never);
    expect(String(out.at(-2)!.content)).toContain("won the fight");
    expect(out.at(-1)!.content).toBe("Mm,");
    const reply = Array.from({ length: 6 }, (_, i) => `Page ${i + 1}. ${"word ".repeat(30).trim()}.`).join("\n\n");
    expect(await play.onGenerationEnded("chat1", reply, "m2")).toBe(true);
    const shown = sent.filter((m) => m.type === "scene.afterglow").at(-1) as Extract<ToFrontend, { type: "scene.afterglow" }>;
    expect(shown.pages).toHaveLength(6);
    expect(shown.pages!.filter((p) => p.cg)).toHaveLength(3);
    // A swipe rewrites the scene; it is remembered once.
    await play.intercept(prompt as never, { userId: "u", chatId: "chat1", generationType: "swipe" } as never);
    await play.onGenerationEnded("chat1", reply, "m2");
    const story = (files.get("play/chat1.json") as { story: { scene?: string }[] }).story;
    expect(story.filter((b) => b.scene)).toHaveLength(1);
    expect(await play.onGenerationEnded("chat1", reply, "m2")).toBe(false);
  });

  test("a Parley's end is on the page when you come back, and the scene is refreshed", async () => {
    const { play, last, sent } = setup();
    await play.open("u", "chat1");
    const before = sent.length;
    await play.onParleyEnd("u", { card: { castId: "mara" }, npc: { name: "Mara" }, contest: { stake: "a favor" } } as never, { chatId: "chat1", end: { kind: "refused" }, exchanges: [{ text: "Give me the ledger.", reply: "Mara shuts the door in your face.", read: { tactic: "threat" } }] } as never);
    expect(sent.slice(before).some((m) => m.type === "scene.state")).toBe(true);
    expect(last().story.at(-1)).toMatchObject({ said: "", roll: "Talking with Mara: refused", reply: "Mara shuts the door in your face." });
  });

  test("a risky way out moves the scene too, and the narration can't leave the game behind", async () => {
    const { play, last } = setup();
    await play.open("u", "chat1");
    expect(last().place.id).toBe("docks");
    const places: string[] = [];
    for (let i = 0; i < 8; i++) {
      await play.say("u", "chat1", "I slip past Mara and head for The Drowned Lantern");
      places.push(last().place.id);
      if (last().place.id === "tavern") break;
    }
    expect(places.at(-1)).toBe("tavern");
    expect(last().story.at(-1)!.roll).toMatch(/^Sneaking/);
  });

  test("a line that names a foe fights that foe and its own kind, and a line that goes somewhere fights there", async () => {
    const { play, started, last } = setup();
    const foe = sheet.foes.find((f) => f.role !== "boss")!;
    await play.open("u", "chat1");
    await play.say("u", "chat1", `I walk to The Drowned Lantern and attack the ${foe.name}`);
    expect(last().place.id).toBe("tavern");
    // Copies are told apart by a letter ("Bandit A", "Bandit B").
    const enemies = started[0]!.combatants.filter((c) => c.side === "enemy").map((c) => c.name.replace(/ [A-Z]$/, ""));
    expect(new Set(enemies)).toEqual(new Set([foe.name]));
  });

  test("someone from the card fights as themselves, not as a creature drawn from their name", async () => {
    const { play, started } = setup();
    await play.open("u", "chat1");
    await play.say("u", "chat1", "I attack Mara");
    const enemies = started[0]!.combatants.filter((c) => c.side === "enemy");
    expect(enemies.map((c) => c.name)).toEqual(["Mara"]);
    expect(enemies[0]!.art).toStartWith("figure:");
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
