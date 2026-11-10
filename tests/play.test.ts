import { describe, expect, test } from "bun:test";
import { createPlay } from "../src/backend/play.js";
import { FEATURES } from "../src/shared/features.js";
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

function setup(o: { sheet?: Record<string, unknown>; cards?: Record<string, unknown>; pictures?: unknown; spindle?: Record<string, unknown>; story?: "gambit" | "chat"; chatMs?: number } = {}) {
  const card = { ...sheet, ...o.sheet };
  const files = new Map<string, unknown>();
  // Gambit's own narrator unless a test is about the chat writing the scene: no generation runs here to answer one.
  files.set("settings.json", { storyNarrator: o.story ?? "gambit" });
  const posted: string[] = [];
  const messages: { id: string; role: string; content: string; metadata?: Record<string, unknown> }[] = [];
  const sent: ToFrontend[] = [];
  const started: BattleState[] = [];
  const known: string[] = [];
  const talks: { castId: string; kind?: string; line?: string; ask?: { goal: string; piece?: string } }[] = [];
  const spindle = {
    log: { info() {}, warn() {}, error() {} },
    userStorage: {
      getJson: async (p: string, o: { fallback: unknown }) => (files.has(p) ? structuredClone(files.get(p)) : o.fallback),
      setJson: async (p: string, v: unknown) => void files.set(p, structuredClone(v)),
    },
    chat: {
      appendMessage: async (_chatId: string, m: { role: string; content: string; metadata?: Record<string, unknown> }) => {
        const id = `m${posted.length}`;
        posted.push(m.content);
        messages.push({ ...m, id });
        return { id };
      },
      getMessages: async () => messages.map((m) => ({ ...m, hidden: false })),
      deleteMessage: async (_chatId: string, id: string) => void messages.splice(messages.findIndex((m) => m.id === id), 1),
    },
    personas: { getActive: async () => ({ description: "A wiry courier." }) },
    ...o.spindle,
  };
  const art = { request: () => ({ key: "", state: "queued" }), status: () => null, expect: () => {}, adopt: () => {}, whenDone: () => new Promise(() => {}) };
  const cards = {
    sheetFor: async () => card as never,
    armory: async () => card as never,
    talk: async (_u: string, _c: string, castId: string, kind?: string, _chip?: string, line?: string, ask?: { goal: string; piece?: string }) => void talks.push({ castId, kind, line, ...(ask ? { ask } : {}) }),
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
  const play = createPlay(spindle as never, (m) => sent.push(m), art as never, cards, battles, { ...(o.pictures ? { pictures: o.pictures as never } : {}), ...(o.chatMs ? { chatMs: o.chatMs } : {}) });
  const views = () => sent.flatMap((m) => (m.type === "scene.state" ? [m.view] : []));
  const last = (): SceneView => views()[views().length - 1]!;
  return { play, files, posted, messages, sent, started, known, talks, last, fights, reshown };
}

/** Wait for what play does in the background after a call. */
async function until(ok: () => boolean, ms = 3000): Promise<void> {
  for (const end = Date.now() + ms; !ok() && Date.now() < end; ) await new Promise((res) => setTimeout(res, 5));
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

  test("warmth toward someone here does something: they like you better for it, once a day, and the page says so", async () => {
    const { play, last, files } = setup();
    await play.open("u", "chat1");
    await play.say("u", "chat1", "I thank Mara for the tea");
    expect(last().story[0]!.roll).toBe("Mara warms to you");
    const npc = () => (files.get("play/chat1.json") as { memory: { npc: Record<string, { affinity: number; notes: { text: string }[] }> } }).memory.npc.mara!;
    expect(npc().affinity).toBeGreaterThan(0);
    expect(npc().notes.at(-1)!.text).toMatch(/kind to them/);
    const before = npc().affinity;
    await play.say("u", "chat1", "I hug Mara");
    expect(last().story[1]!.roll).toBeNull();
    expect(npc().affinity).toBe(before);
  });

  test("when no narrator can write, the player reads plain words and the chat keeps only their line", async () => {
    const { play, last, posted } = setup();
    await play.open("u", "chat1");
    await play.say("u", "chat1", "I sneaked past Mara");
    expect(last().story[0]!.reply).not.toMatch(/show|consequence|they wrote/i);
    expect(posted).toEqual(["I sneaked past Mara"]);
  });

  test("under the chat's preset the chat writes the beat: the line starts a reply, the note goes last, and the reply is the story", async () => {
    const { play, last, messages, sent } = setup({ story: "chat" });
    await play.open("u", "chat1");
    const saying = play.say("u", "chat1", "I sneaked past Mara");
    await until(() => messages.some((m) => m.content === "I sneaked past Mara"));
    const line = messages.at(-1)!;
    expect(line.role).toBe("user");
    // The chat's generation: the note is the last thing before the preset's prefill, and it carries the roll's result.
    const prompt = [
      { role: "system", content: "preset" },
      { role: "user", content: line.content },
      { role: "assistant", content: "Mm,", partial: true },
    ];
    const out = await play.intercept(prompt as never, { userId: "u", chatId: "chat1", generationType: "normal" } as never);
    expect(out.slice(0, 2)).toEqual(prompt.slice(0, 2) as never);
    expect(String(out.at(-2)!.content)).toMatch(/next beat of the story, at The Docks[\s\S]*Sneaking: /);
    expect(out.at(-1)!.content).toBe("Mm,");
    // It streams onto the page, and the finished reply is the beat: prose only, at the preset's own length.
    play.onStreamToken("chat1", "Mara turns", false);
    await until(() => sent.some((m) => m.type === "scene.story" && m.text === "Mara turns"));
    const reply = `## Chapter\n\nMara turns at the sound of a loose plank. ${"She waits. ".repeat(60)}\n\n| HP | 10 |\n\n**Options:**\n1. Run`;
    expect(await play.onGenerationEnded("chat1", reply, "m9")).toBe(true);
    await saying;
    const beat = last().story[0]!;
    expect(beat.roll).toMatch(/^Sneaking: /);
    expect(beat.reply).toMatch(/^Mara turns at the sound of a loose plank\./);
    expect(beat.reply.split(/\s+/).length).toBeGreaterThan(100);
    expect(beat.reply).not.toMatch(/Chapter|HP|Options|Run/);
    // The chat already holds both lines: nothing is posted a second time.
    expect(messages.filter((m) => m.content === "I sneaked past Mara")).toHaveLength(1);
    expect(messages).toHaveLength(1);
    expect(await play.onGenerationEnded("chat1", "something else", "m10")).toBe(false);
  });

  test("when the chat writes nothing, Gambit's narrator stands in and the line isn't posted twice", async () => {
    const { play, last, messages } = setup({ story: "chat" });
    await play.open("u", "chat1");
    const saying = play.say("u", "chat1", "I watch the gulls for a while");
    await until(() => messages.length > 0);
    await play.onGenerationEnded("chat1", "", undefined, "provider error");
    await saying;
    expect(last().story[0]!.reply.length).toBeGreaterThan(0);
    expect(last().busy).toBeUndefined();
    expect(messages.filter((m) => m.role === "user")).toHaveLength(1);
  });

  test("a chat that never answers doesn't hold the scene: the wait ends and the game goes on", async () => {
    const { play, last } = setup({ story: "chat", chatMs: 30 });
    await play.open("u", "chat1");
    await play.say("u", "chat1", "I watch the gulls for a while");
    expect(last().story[0]!.said).toBe("I watch the gulls for a while");
    expect(last().busy).toBeUndefined();
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

    test("a won talk charges what the player offered for it, and pays what they're owed", async () => {
      const { play, files, last } = setup();
      await play.open("u", "chat1");
      const coin = record(files).scene.coin;
      const won = (contest: object) => ({ ...end("won"), scenario: { npc: { name: "Mara" }, card: { castId: "mara" }, contest: { stake: "a warm bed and supper", money: true, ...contest } } as never });
      const bed = won({ cost: 3 });
      await play.onParleyEnd("u", bed.scenario, bed.state);
      expect(record(files).scene.coin).toBe(coin - 3);
      const job = won({ stake: "the job", pay: 10 });
      await play.onParleyEnd("u", job.scenario, job.state);
      expect(record(files).scene.coin).toBe(coin + 7);
      expect(last().log.slice(-2).join(" ")).toEqual("You pay Mara 3 crowns. Mara pays you 10 crowns.");
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

    test("leaning on someone says its price, and they carry it into the next talk", async () => {
      const { play, last } = setup();
      await play.open("u", "chat1");
      const e = end("won");
      const leaned = { ...e, state: { chatId: "chat1", exchanges: [{ read: { tactic: "logic" }, text: "I know what you take at the docks.", reply: "She goes still.", bluff: null, lean: "pressure", yieldStep: 1 }], end: { kind: "won" } } as never };
      await play.onParleyEnd("u", leaned.scenario, leaned.state);
      expect(last().log.join(" ")).toContain("Mara will remember being leaned on.");
      const s = await play.standing("u", "chat1", "mara");
      expect(s?.history.remembers.join(" ")).toContain("held what they knew over them");
    });

    test("a talk won kindly says nothing of a price, and they like you better for it", async () => {
      const { play, last } = setup();
      await play.open("u", "chat1");
      const e = end("won");
      const kind = { ...e, state: { chatId: "chat1", exchanges: [{ read: { tactic: "empathy" }, text: "That must be hard.", reply: "She nods.", bluff: null, lean: "goodwill", yieldStep: 1 }], end: { kind: "won" } } as never };
      await play.onParleyEnd("u", kind.scenario, kind.state);
      expect(last().log.join(" ")).not.toContain("leaned on");
      const s = await play.standing("u", "chat1", "mara");
      expect(s?.history.remembers.join(" ")).toContain("was kind to them");
    });

    test("a talk can ask which theme its chat is played in, scene on screen or not", async () => {
      const { play } = setup();
      await play.open("u", "chat1");
      expect(await play.themeOf("u", "chat1")).toBe("storybook");
      await play.setTheme("u", "chat1", "command");
      expect(await play.themeOf("u", "chat1")).toBe("command");
      expect(await play.themeOf("u", "no-such-chat")).toBeNull();
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

  test("what happens after the story's last beat reads under the story, where the page rests", async () => {
    const { play, last } = setup();
    await play.open("u", "chat1");
    await play.say("u", "chat1", "I watch the gulls");
    expect(last().story).toHaveLength(1);
    // What the beat itself noted is part of the beat: nothing came after it yet.
    expect(last().logAfter).toBeUndefined();
    const before = last().log.at(-1);
    await play.act("u", "chat1", "wait");
    expect(last().story).toHaveLength(1);
    expect(last().log.at(-1)).not.toBe(before);
    expect(last().logAfter).toBe(true);
    // The next line the player writes is the newest thing again.
    await play.say("u", "chat1", "I hum a little");
    expect(last().logAfter).toBeUndefined();
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

  test("a search that works gets what it went for, even with no secret left to find here today", async () => {
    const { play, last, files } = setup();
    await play.open("u", "chat1");
    const key = [...files.keys()].find((k) => k.includes("chat1"))!;
    const r = files.get(key) as { scene: { placeId: string; searched: string[] } };
    files.set(key, { ...r, scene: { ...r.scene, searched: [r.scene.placeId] } });
    for (let i = 0; i < 12 && !last().story.some((b) => /, success$/.test(b.roll ?? "")); i++) await play.say("u", "chat1", "I search for the way to the harbour office");
    const beat = last().story.find((b) => /, success$/.test(b.roll ?? ""))!;
    expect(beat.found).toBeUndefined();
    expect(beat.reply).toBe("It works.");
  });

  test("waiting past midnight brings the night, and the night gives back some strength", async () => {
    const { play, files, sent, last } = setup();
    await play.open("u", "chat1");
    const key = [...files.keys()].find((k) => k.includes("chat1"))!;
    const r = files.get(key) as { scene: object };
    files.set(key, { ...r, scene: { ...r.scene, time: 3, vigor: 0.3 } });
    await play.act("u", "chat1", "wait");
    expect(sent.some((m) => m.type === "scene.meanwhile")).toBe(true);
    expect(last().clock).toEqual({ day: 2, time: "morning" });
    expect(last().vigor).toBe(0.5);
  });

  test("reading the card again seats its people where the new read says", async () => {
    const at = (files: Map<string, unknown>) => (files.get("play/chat1.json") as { world: { places: Record<string, { people: string[] }> } }).world.places;
    const first = setup({ sheet: { readAt: 1 } });
    await first.play.open("u", "chat1");
    expect(at(first.files).docks!.people).toContain("mara");
    const reread = setup({ sheet: { readAt: 2, cast: [{ ...sheet.cast[0]!, at: "caves" }] } });
    reread.files.set("play/chat1.json", first.files.get("play/chat1.json"));
    await reread.play.open("u", "chat1");
    expect(at(reread.files).caves!.people).toEqual(["mara"]);
    expect(at(reread.files).docks!.people).toEqual([]);
  });

  test("the player's own secret from their persona is never a fact to play on someone", async () => {
    const persona = { id: "deserter", text: "Wren deserted the navy.", about: ["mara"], weight: 3, known: true, evidence: { source: "persona", quote: "", verified: true } };
    const { play, last } = setup({ sheet: { facts: [...sheet.facts, persona] } });
    await play.open("u", "chat1");
    expect(last().hand.map((f) => f.id)).not.toContain("deserter");
  });

  test("the purse starts with what the persona says the player has", async () => {
    const { play, last } = setup({ sheet: { player: { ...sheet.player, coin: 12 } } });
    await play.open("u", "chat1");
    expect(last().coin).toBe(12);
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

  test("searching a place turns up the piece that belongs to it, and says how far that puts you", async () => {
    const { play, last, files } = setup();
    await play.open("u", "chat1");
    const key = [...files.keys()].find((k) => k.includes("chat1"))!;
    files.set(key, { ...(files.get(key) as object), thread: { goal: "Find the warden", revelations: [{ id: "a", text: "The warden left The Docks by night" }, { id: "b", text: "Mara rowed him out" }, { id: "c", text: "A lamp was lit in the Smugglers' Caves" }], by: "fallback" } });
    for (let i = 0; i < 12 && !last().story.some((b) => b.found); i++) await play.say("u", "chat1", "I search the place");
    const beat = last().story.find((b) => b.found)!;
    expect(beat.found).toBe("The warden left The Docks by night (piece 1 of 3)");
    expect(last().thread!.found).toEqual(["The warden left The Docks by night"]);
    // What Mara knows is hers to give: no amount of searching where she stands turns it up.
    const record = () => files.get(key) as { scene: { searched: string[] } };
    for (let i = 0; i < 6; i++) {
      files.set(key, { ...record(), scene: { ...record().scene, searched: [] } });
      await play.act("u", "chat1", "search");
    }
    expect(last().thread!.found).toEqual(["The warden left The Docks by night"]);
  });

  test("the game never runs out of a goal: once an ending has been shown, the next thread starts from it", async () => {
    const { play, last, files, posted } = setup();
    await play.open("u", "chat1");
    const key = [...files.keys()].find((k) => k.includes("chat1"))!;
    const put = (over: Record<string, unknown>) => files.set(key, { ...(files.get(key) as object), ...over });
    // A thread that ran out, and a night that has told how: the world's Bible has landed, so threads are its to give.
    put({ bibleAt: 1, thread: { goal: "Find the warden", revelations: [{ id: "rev1", text: "The warden fled" }, { id: "rev2", text: "North" }], by: "fallback" }, revealed: ["rev1"], deadline: 0, threadEnd: "lost", threadTold: true });
    await play.open("u", "chat1");
    await until(() => last().thread?.goal !== "Find the warden" && !!last().thread);
    const t = last().thread!;
    expect(t.ended).toBeUndefined();
    expect(t.found).toEqual([]);
    expect(t.total).toBeGreaterThanOrEqual(3);
    expect(t.daysLeft).toBe(Math.max(3, t.total + 1));
    // Every piece of a written thread says where to look: a person, or a place.
    expect(t.leads.length).toBeGreaterThan(0);
    expect(t.leads.every((l) => l.castId || l.placeId)).toBe(true);
    expect(posted.at(-1)).toMatch(/A new thread begins/);
    const kept = (files.get(key) as { threadsDone: { goal: string; ended: string; found: number; total: number }[] }).threadsDone;
    expect(kept).toMatchObject([{ goal: "Find the warden", ended: "lost", found: 1, total: 2 }]);
    // A thread still running is left alone.
    const goal = t.goal;
    await play.open("u", "chat1");
    await new Promise((res) => setTimeout(res, 30));
    expect(last().thread!.goal).toBe(goal);
  });

  test("a thread says the one thing to do next, and what someone knows is won from them", async () => {
    const { play, last, files, talks } = setup();
    await play.open("u", "chat1");
    const key = [...files.keys()].find((k) => k.includes("chat1"))!;
    const thread = { goal: "Find the warden", revelations: [{ id: "a", text: "A boat left from the Smugglers' Caves" }, { id: "b", text: "Mara was paid to look away" }, { id: "c", text: "Nobody saw the lamp go out" }], by: "fallback" };
    files.set(key, { ...(files.get(key) as object), thread });
    await play.open("u", "chat1");
    // Three pieces get a day each and one to spare. A piece that names nobody is given to someone who would know.
    expect(last().thread).toMatchObject({ daysLeft: 4, total: 3 });
    expect(last().thread!.leads.map((l) => l.text)).toEqual(["Smugglers' Caves", "Mara, at The Docks"]);
    expect(last().thread!.how).toMatch(/you win from them/);
    // One next step, as an action, and one marked action in the menu: asking Mara, who is here.
    expect(last().thread!.next).toEqual({ text: "Ask Mara what she knows", act: "ask:mara" });
    expect(last().menu.filter((h) => h.lead).map((h) => h.id)).toEqual(["ask:mara"]);
    expect(last().menu.find((h) => h.id === "talk:mara")).toBeDefined();
    // Asking opens a talk with her, once a day; then the next step is somewhere else.
    await play.act("u", "chat1", "ask:mara");
    // The talk is told what it is about: the goal, and the piece that is hers.
    expect(talks).toEqual([{ castId: "mara", kind: "persuade", line: undefined, ask: { goal: "Find the warden", piece: "Mara was paid to look away" } }]);
    expect(last().menu.some((h) => h.id === "ask:mara")).toBe(false);
    expect(last().thread!.next!.text).toMatch(/Smugglers' Caves.*search it/);
    expect(last().menu.filter((h) => h.lead)).toHaveLength(1);
    // Refused, she keeps it: the story's own line says so, where the player is reading.
    await play.onParleyEnd("u", { id: "s", npc: { name: "Mara" }, contest: { kind: "persuade", stake: "her word" }, card: { cardKey: "card-0001", castId: "mara", journalKey: "chat/chat1" } } as never, { chatId: "chat1", end: { kind: "refused" }, exchanges: [] } as never);
    expect(last().story.at(-1)?.roll).toBe("Talking with Mara: refused. Nothing given away today: try again tomorrow");
    expect(last().thread!.found).toEqual([]);
    // Winning her over gives the piece that is hers, not the first on the list.
    await play.onParleyEnd("u", { id: "s", npc: { name: "Mara" }, contest: { kind: "persuade", stake: "her word" }, card: { cardKey: "card-0001", castId: "mara", journalKey: "chat/chat1" } } as never, { chatId: "chat1", end: { kind: "won" }, exchanges: [] } as never);
    expect(last().thread!.found).toEqual(["Mara was paid to look away"]);
    expect(last().log.at(-1)).toMatch(/Mara lets it out: Mara was paid to look away \(piece 1 of 3\)/);
    expect(last().thread!.leads.map((l) => l.text)).toEqual(["Smugglers' Caves", "Mara, at The Docks"]);
    // What has come out goes into the next talk, with anyone, as something the player knows.
    expect((await play.standing("u", "chat1", "mara"))?.found).toEqual([{ id: "piece:b", text: "Mara was paid to look away" }]);
  });

  test("asking in your own words is the ask: a written question opens the same talk, once a day", async () => {
    const { play, last, files, talks } = setup();
    await play.open("u", "chat1");
    const key = [...files.keys()].find((k) => k.includes("chat1"))!;
    const thread = { goal: "Find the warden", revelations: [{ id: "a", text: "A boat left from the Smugglers' Caves" }, { id: "b", text: "Mara was paid to look away" }], by: "fallback" };
    files.set(key, { ...(files.get(key) as object), thread });
    await play.open("u", "chat1");
    expect(last().thread!.next).toEqual({ text: "Ask Mara what she knows", act: "ask:mara" });
    // Small talk with her is only a line: nothing is spent.
    await play.say("u", "chat1", "To Mara: Cold morning for it.");
    expect(talks).toEqual([]);
    expect(last().menu.some((h) => h.id === "ask:mara")).toBe(true);
    // A polite question about what is going on is the ask. Her piece is at stake, and the line is the first thing said.
    const line = "To Mara: You mind answering me about it? About whatever is going on, I guess";
    await play.say("u", "chat1", line);
    expect(talks).toEqual([{ castId: "mara", kind: "persuade", line, ask: { goal: "Find the warden", piece: "Mara was paid to look away" } }]);
    expect(last().log.at(-1)).toMatch(/You ask Mara what she knows/);
    expect(last().story.at(-1)!.said).toBe(line);
    expect(last().busy).toBeUndefined();
    // That was today's try, the same as the button: it is gone from the menu, and the next step is elsewhere.
    expect(last().menu.some((h) => h.id === "ask:mara")).toBe(false);
    expect(last().thread!.next!.text).toMatch(/Smugglers' Caves/);
    // Asked again the same day, it is only a line, and the page says why.
    await play.say("u", "chat1", "To Mara: Please, what do you know about it?");
    expect(talks).toHaveLength(1);
    expect(last().log.some((l) => /Mara has said all they will today\. Ask again tomorrow\./.test(l))).toBe(true);
  });

  test("what you wore down stays worn down: the next talk about their piece starts where the last one ended", async () => {
    const { play, last, files } = setup();
    await play.open("u", "chat1");
    const key = [...files.keys()].find((k) => k.includes("chat1"))!;
    const thread = { goal: "Find the warden", revelations: [{ id: "a", text: "A boat left from the Smugglers' Caves" }, { id: "b", text: "Mara was paid to look away" }], by: "fallback" };
    files.set(key, { ...(files.get(key) as object), thread });
    await play.open("u", "chat1");
    const scenario = { id: "s", npc: { name: "Mara" }, contest: { kind: "persuade", stake: "her word", start: 100, floor: 0, hardFloor: 0, winAt: 0, dc: 14 }, card: { cardKey: "card-0001", castId: "mara", journalKey: "chat/chat1" } } as never;
    expect((await play.standing("u", "chat1", "mara"))?.history.ground).toBeUndefined();
    // Out of patience half way there: she keeps it, and the page says the half is not lost.
    await play.onParleyEnd("u", scenario, { chatId: "chat1", end: { kind: "refused" }, exchanges: [], value: 50 } as never);
    expect(last().log.at(-1)).toMatch(/Mara gives nothing away today\. Try again tomorrow: .+ What you wore down stays worn down: you start from there\./);
    expect((await play.standing("u", "chat1", "mara"))?.history.ground).toBe(50);
    // A talk that got nowhere says nothing of the kind, and a harder one than the start is only the start again.
    await play.onParleyEnd("u", scenario, { chatId: "chat1", end: { kind: "walked" }, exchanges: [], value: 110 } as never);
    expect(last().log.at(-1)).not.toMatch(/wore down/);
    expect((await play.standing("u", "chat1", "mara"))?.history.ground).toBe(100);
    // Won, the piece is out and there is nothing left to pick up.
    await play.onParleyEnd("u", scenario, { chatId: "chat1", end: { kind: "refused" }, exchanges: [], value: 25 } as never);
    await play.onParleyEnd("u", scenario, { chatId: "chat1", end: { kind: "won" }, exchanges: [], value: 0 } as never);
    expect(last().thread!.found).toEqual(["Mara was paid to look away"]);
    expect((await play.standing("u", "chat1", "mara"))?.history.ground).toBeUndefined();
    expect((files.get(key) as { ground?: Record<string, unknown> }).ground?.mara).toBeUndefined();
  });

  test("the day can always be ended in one step, and solving a thread pays", async () => {
    const { play, last, files } = setup();
    await play.open("u", "chat1");
    // Wherever you are there is one action that ends the day: a bed, or the ground.
    expect(last().menu.filter((h) => h.kind === "rest")).toHaveLength(1);
    const key = [...files.keys()].find((k) => k.includes("chat1"))!;
    const coin = last().coin;
    files.set(key, { ...(files.get(key) as object), thread: { goal: "Find the warden", revelations: [{ id: "a", text: "Mara rowed him out" }, { id: "b", text: "Mara was paid for it" }], by: "fallback" }, revealed: ["a"] });
    await play.onParleyEnd("u", { id: "s", npc: { name: "Mara" }, contest: { kind: "persuade", stake: "her word" }, card: { cardKey: "card-0001", castId: "mara", journalKey: "chat/chat1" } } as never, { chatId: "chat1", end: { kind: "won" }, exchanges: [] } as never);
    expect(last().thread).toMatchObject({ ended: "solved" });
    expect(last().coin).toBe(coin + 30);
    expect(last().log.at(-1)).toMatch(/You have it all: Find the warden\. It pays: \+30/);
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
    await until(() => last().menu.some((h) => h.id === "afterglow"));
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

  test("an adult scene's first picture sets the place: the others are drawn into it once it is in", async () => {
    const run = async (firstFails: boolean) => {
      const asked: { id: string; base?: string }[] = [];
      const pictures = {
        request: async (_u: string, req: { id: string; base?: string }) => {
          asked.push(req);
          const n = req.id.split(".").at(-1);
          return firstFails && n === "0" ? null : { imageId: `img-${n}`, url: `/api/v1/images/img-${n}` };
        },
      };
      const { play, started, messages, last } = setup({ cards: { adultOn: async () => true }, pictures });
      await play.open("u", "chat1");
      await play.fight("u", "chat1");
      await play.onBattleEnd(ended(started[0]!, "victory"), "u");
      await until(() => last().menu.some((h) => h.id === "afterglow"));
      await play.act("u", "chat1", "afterglow");
      await play.intercept([{ role: "user", content: messages.at(-1)!.content }] as never, { userId: "u", chatId: "chat1", generationType: "normal" } as never);
      await play.onGenerationEnded("chat1", Array.from({ length: 6 }, (_, i) => `Page ${i + 1}. ${"word ".repeat(30).trim()}.`).join("\n\n"), "m2");
      return asked;
    };
    const asked = await run(false);
    expect(asked.map((a) => a.base)).toEqual([undefined, "img-0", "img-0"]);
    // Without a first picture, the others are drawn on their own.
    expect((await run(true)).slice(1).map((a) => a.base)).toEqual([undefined, undefined]);
  });

  test("a claimed loss holds you where the winner keeps you until morning, unless a way out works", async () => {
    const { play, started, last, sent } = setup({ sheet: { skin: { ...sheet.skin, defeat: "claimed" } } });
    await play.open("u", "chat1");
    await play.act("u", "chat1", "go:tavern");
    await play.fight("u", "chat1");
    await play.onBattleEnd(ended(started[0]!, "defeat"), "u");
    expect(last().story.at(-1)!.roll).toContain("kept there until morning");
    expect(last().menu.some((h) => h.kind === "exit")).toBe(false);
    await play.act("u", "chat1", "go:docks");
    expect(sent.at(-1)).toMatchObject({ type: "notice", text: expect.stringContaining("before morning") });
    expect(last().place.id).toBe("tavern");
    // Going somewhere is rolled as a way out: only one that works leaves.
    for (let i = 0; i < 8 && last().place.id === "tavern"; i++) {
      await play.say("u", "chat1", "I walk to The Docks");
      const beat = last().story.at(-1)!;
      expect(beat.roll).toBeTruthy();
      if (last().place.id === "docks") expect(beat.roll).toMatch(/success|partial/i);
    }
    expect(last().place.id).toBe("docks");
    expect(last().menu.some((h) => h.kind === "exit")).toBe(true);
  });

  test("a claim holds only until the next day", async () => {
    const { play, started, last } = setup({ sheet: { skin: { ...sheet.skin, defeat: "claimed" } } });
    await play.open("u", "chat1");
    await play.fight("u", "chat1");
    await play.onBattleEnd(ended(started[0]!, "defeat"), "u");
    const day = last().clock.day;
    for (let i = 0; i < 8 && last().clock.day === day; i++) await play.act("u", "chat1", "wait");
    expect(last().clock.day).toBe(day + 1);
    expect(last().menu.some((h) => h.kind === "exit")).toBe(true);
  });

  test("an adult scene is offered once the fight's account is on the page, and never after a loss that robs you", async () => {
    let write = () => {};
    const written = new Promise<void>((res) => (write = res));
    const writes = { generate: { quietStream: async function* () { await written; yield { type: "done", content: "You come round on warm furs, unhurt, and she is watching you." }; } }, connections: { list: async () => [{ id: "c1", name: "c", provider: "x", model: "m", is_default: true }] } };
    const claimed = setup({ sheet: { skin: { ...sheet.skin, defeat: "claimed" } }, spindle: writes, cards: { adultOn: async () => true } });
    await claimed.play.open("u", "chat1");
    await claimed.play.fight("u", "chat1");
    const s = ended(claimed.started[0]!, "defeat");
    await claimed.play.onBattleEnd(s, "u");
    await new Promise((res) => setTimeout(res, 50));
    expect(claimed.last().menu.some((h) => h.id === "afterglow")).toBe(false);
    write();
    await until(() => claimed.last().menu.some((h) => h.id === "afterglow"));
    expect(claimed.posted.at(-1)).toContain("warm furs");
    // It is with the one who claimed you.
    const claimer = s.combatants.find((c) => c.side === "enemy" && claimed.last().story.some((b) => b.roll?.includes(`${c.name} claims`)))!;
    expect(claimed.last().menu.find((h) => h.id === "afterglow")!.label).toBe(`Give in to ${claimer.name}`);

    const robbed = setup({ cards: { adultOn: async () => true } });
    await robbed.play.open("u", "chat1");
    await robbed.play.fight("u", "chat1");
    await robbed.play.onBattleEnd(ended(robbed.started[0]!, "defeat"), "u");
    await new Promise((res) => setTimeout(res, 50));
    expect(robbed.last().menu.some((h) => h.id === "afterglow")).toBe(false);
  });

  test("no adult scene with a child, won or claimed; adults called young or little still get one", async () => {
    const foe = (id: string, name: string, look: string) => ({ ...fallbackFoes("low fantasy")[0]!, id, name, look, talks: true });
    const offered = async (foes: unknown[], outcome: "victory" | "defeat") => {
      const { play, started, last } = setup({ sheet: { foes, skin: { ...sheet.skin, defeat: "claimed" } }, cards: { adultOn: async () => true } });
      await play.open("u", "chat1");
      await play.fight("u", "chat1");
      await play.onBattleEnd(ended(started[0]!, outcome), "u");
      await until(() => last().menu.some((h) => h.id === "afterglow"), 300);
      return last().menu.some((h) => h.id === "afterglow");
    };
    const recruit = [foe("recruit", "Maturation Recruit", "Young rabbit-girl soldier, one of the one-month-old offspring")];
    expect(await offered(recruit, "victory")).toBe(false);
    expect(await offered(recruit, "defeat")).toBe(false);
    const adults = [foe("woman", "Bandit", "a young woman with a notched blade"), foe("knight", "Knight", "a youthful knight"), foe("sister", "Little Sister", "the boss's little sister (24)")];
    expect(await offered(adults, "victory")).toBe(true);
    expect(await offered(adults, "defeat")).toBe(true);
  });

  test("a model's refusal is never the story: a line gets plain words, and a fight keeps its result line", async () => {
    const refuses = { generate: { quietStream: async function* () { yield { type: "done", content: "I cannot fulfill this request. The prompt asks to generate content I can't write." }; } }, connections: { list: async () => [{ id: "c1", name: "c", provider: "x", model: "m", is_default: true }] } };
    const { play, started, last, posted } = setup({ sheet: { skin: { ...sheet.skin, defeat: "claimed" } }, spindle: refuses });
    await play.open("u", "chat1");
    await play.say("u", "chat1", "I sneaked past Mara");
    expect(last().story.at(-1)!.reply).not.toMatch(/fulfill/);
    expect(last().story.at(-1)!.reply.length).toBeGreaterThan(0);
    await play.fight("u", "chat1");
    await play.onBattleEnd(ended(started[0]!, "defeat"), "u");
    await new Promise((res) => setTimeout(res, 100));
    expect(last().story.at(-1)!.roll).toContain("claims Wren");
    expect(last().story.at(-1)!.reply).toBe("");
    expect(posted.some((p) => /fulfill/.test(p))).toBe(false);
  });

  test("the story box tells the scene you are in: a move or a night starts it afresh", async () => {
    const { play, last } = setup();
    await play.open("u", "chat1");
    await play.say("u", "chat1", "I watch the gulls for a while");
    expect(last().story).toHaveLength(1);
    await play.act("u", "chat1", "go:tavern");
    expect(last().story).toHaveLength(0);
    await play.say("u", "chat1", "I order a drink");
    expect(last().story).toHaveLength(1);
    const day = last().clock.day;
    for (let i = 0; i < 8 && last().clock.day === day; i++) await play.act("u", "chat1", "wait");
    expect(last().clock.day).toBe(day + 1);
    expect(last().place.id).toBe("tavern");
    expect(last().story).toHaveLength(0);
  });

  test("someone with sprites of their own stands as those in the scene, not as a drawn figure", async () => {
    const faces = { base: "img-mara", expressions: {}, source: "risu" };
    const { play, last } = setup({ sheet: { cast: [{ ...sheet.cast[0]!, faces }] } });
    await play.open("u", "chat1");
    await play.act("u", "chat1", "go:docks");
    const mara = last().people.find((p) => p.id === "mara")!;
    expect(mara.imageId).toBe("img-mara");
    expect(mara.figure).toBeUndefined();
  });

  test("a scene the host fails to write closes the reader with a notice, and the offer comes back", async () => {
    const { play, started, last, sent, messages } = setup({ cards: { adultOn: async () => true } });
    await play.open("u", "chat1");
    await play.fight("u", "chat1");
    await play.onBattleEnd(ended(started[0]!, "victory"), "u");
    await until(() => last().menu.some((h) => h.id === "afterglow"));
    await play.act("u", "chat1", "afterglow");
    expect(last().menu.some((h) => h.id === "afterglow")).toBe(false);
    const leadIn = () => messages.filter((m) => (m.metadata?.gambit as { scene?: unknown } | undefined)?.scene);
    expect(leadIn()).toHaveLength(1);
    // The generation fails before any prompt is built, so no note was ever added.
    expect(await play.onGenerationEnded("chat1", "", undefined, "The browser owning this Lua operation disconnected")).toBe(true);
    expect(sent.some((m) => m.type === "scene.afterglow" && m.pages?.length === 0)).toBe(true);
    expect(sent.some((m) => m.type === "notice" && m.text.includes("Lua operation disconnected"))).toBe(true);
    expect(last().menu.some((h) => h.id === "afterglow")).toBe(true);
    // Its lead-in line goes with it, so failed tries leave no "You give in" lines behind.
    expect(leadIn()).toHaveLength(0);
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

  test("force is a route to what someone knows: beaten, they give it up, they live, and the others who know turn colder", async () => {
    const ilse = { id: "ilse", name: "Ilse", role: "a net-mender, usually at the tavern", look: "", main: false, pronoun: "she", temperament: { warmth: 0.5, pride: 0.5, greed: 0.5, fear: 0.5 }, evidence: ev };
    const { play, started, last, files } = setup({ sheet: { cast: [...sheet.cast, ilse] } });
    await play.open("u", "chat1");
    const key = [...files.keys()].find((k) => k.includes("chat1"))!;
    files.set(key, { ...(files.get(key) as object), thread: { goal: "Find the warden", revelations: [{ id: "a", text: "Mara rowed him out" }, { id: "b", text: "Ilse mended the sail he left under" }], by: "fallback" } });
    await play.say("u", "chat1", "I attack Mara");
    await play.onBattleEnd(ended(started[0]!, "victory"), "u");
    await until(() => last().thread?.found.length === 1);
    expect(last().thread!.found).toEqual(["Mara rowed him out"]);
    const record = files.get(key) as { memory: { deeds: { kind: string; target: string }[]; npc: Record<string, { affinity: number; notes: { text: string }[] }> }; story: { roll: string | null }[] };
    // Beaten, not killed: she is still someone, and she remembers it.
    expect(record.memory.deeds.some((d) => d.kind === "beat" && d.target === "mara")).toBe(true);
    expect(record.memory.deeds.some((d) => d.kind === "killed")).toBe(false);
    expect(record.memory.npc.mara!.affinity).toBeLessThan(0);
    // Word gets round: Ilse, who holds the other piece, will be harder to talk to.
    expect(record.memory.npc.ilse!.affinity).toBeLessThan(0);
    expect(record.memory.npc.ilse!.notes.at(-1)!.text).toMatch(/beat Mara for what they knew/);
    expect(record.story.at(-1)!.roll).toMatch(/Mara, beaten, gives it up: Mara rowed him out \(piece 1 of 2\)\..*harder to talk to/);
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

  test("the board, delves and the class panel are switched off: none is on the menu, and a delve card plays as a town", async () => {
    const { play, last, files } = setup({ sheet: { shape: "delve" } });
    await play.open("u", "chat1");
    expect(last().shape).toBe("town");
    expect(last().theme).toBe("storybook");
    expect(last().canForge).toBe(false);
    for (const place of ["docks", "tavern", "caves"]) {
      if (last().place.id !== place) await play.act("u", "chat1", `go:${place}`);
      expect(last().menu.map((h) => h.kind)).not.toContain("explore");
      expect(last().menu.map((h) => h.kind)).not.toContain("delve");
    }
    // The class panel's actions do nothing while it is off.
    const before = JSON.stringify(files.get("play/chat1.json"));
    await play.forgeAct("u", "chat1", "open" as never);
    expect(JSON.stringify(files.get("play/chat1.json"))).toBe(before);
  });

  test("a delve: enter, walk until a fight room, win it, and the room is cleared", async () => {
    // Delves are switched off in the game (shared/features.ts); they are kept working, so this runs switched on.
    FEATURES.delves = true;
    try {
      await delveRun();
    } finally {
      FEATURES.delves = false;
    }
  });

  async function delveRun(): Promise<void> {
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
  }
});
