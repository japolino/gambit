/**
 * The night answers the day: what the player did reaches the writer, what it decides is checked and
 * becomes true, and the next day hears about it.
 */
import { describe, expect, test } from "bun:test";
import { dayLines, effectStamp, fallbackNightScenes, meanwhilePrompt, meanwhileText, morningLines, parseNightScenes, quietDay, type NightBrief } from "../src/meaning/meanwhile.js";
import { createPlay } from "../src/backend/play.js";
import { remember, type Deed } from "../src/engine/memory/memory.js";
import type { ToFrontend } from "../src/shared/protocol.js";

const sheet = {
  cardKey: "k",
  cardName: "Saltgate",
  premise: "A harbour town with a secret.",
  tone: "dry",
  skin: { genre: "mystery" },
  cast: [],
} as never;

const brief = (over: Partial<NightBrief> = {}): NightBrief => ({
  day: 2,
  player: "Wren",
  people: [
    { id: "orla", name: "Orla", role: "harbourmaster", at: "The Docks", free: true },
    { id: "tam", name: "Tam", role: "your friend", at: "The Inn", free: false },
  ],
  places: [
    { id: "docks", name: "The Docks" },
    { id: "inn", name: "The Inn" },
  ],
  here: "inn",
  beats: [{ said: "I slip the ledger under my coat.", roll: "Going unseen: 7 vs 12, failed", reply: "Orla looks up.", where: "docks" }],
  deeds: [],
  chat: [],
  lastNight: [],
  thread: null,
  ...over,
});

const line = (text: string, extra: object = {}) => ({ text, ...extra });
const filler = [line("The tide comes in over the old stones."), line("A lamp burns late above the chandler's shop.")];

describe("what the night reads", () => {
  test("the whole day reaches the writer, with how each thing went", () => {
    const { user } = meanwhilePrompt(sheet, null, brief({ deeds: [{ day: 2, kind: "lied_to", target: "orla", name: "Orla" }], lastNight: ["A boat leaves without lights."], thread: { goal: "Find who runs the night boat", found: 1, total: 3, daysLeft: 2, justEnded: false } }));
    expect(user).toContain("I slip the ledger under my coat");
    expect(user).toContain("failed");
    expect(user).toContain("You lied to Orla");
    expect(user).toContain("A boat leaves without lights");
    expect(user).toContain("1 of 3 pieces found, 2 days left");
    // Only someone free to go can be moved, and only somewhere played can be marked.
    expect(user).toMatch(/"who": one of orla, "to"/);
    expect(user).toMatch(/"place": one of docks,/);
  });

  test("a thread that just ended has to be shown", () => {
    const { user } = meanwhilePrompt(sheet, null, brief({ thread: { goal: "Find the boat", found: 1, total: 3, daysLeft: 0, ended: "lost", justEnded: true } }));
    expect(user).toMatch(/ran out of time and is lost today: one scene must show/);
  });

  test("the curtain opens on the day in plain words", () => {
    const deeds: Deed[] = [{ day: 2, kind: "caught", target: "orla", name: "Orla", method: "Going unseen" }, { day: 2, kind: "visited", target: "docks", name: "The Docks" }];
    const lines = dayLines(brief().beats, deeds);
    expect(lines[0]).toBe("Orla caught you: going unseen.");
    expect(lines[1]).toBe("“I slip the ledger under my coat.” It went badly.");
    expect(dayLines([], [], [])).toEqual([]);
    expect(dayLines([], [], [{ name: "Wren", content: "We talk until late.", isUser: true }, { name: "Orla", content: "Go home.", isUser: false }])).toEqual(["“We talk until late.”"]);
  });
});

describe("what the night can change", () => {
  test("each change is checked against the limits: the scene stays, the change doesn't", () => {
    const scenes = parseNightScenes(
      {
        vignettes: [
          line("Orla checks the ledger shelf, then checks it again.", { because: "You took the ledger", who: "orla", effect: { kind: "remembers", who: "orla", text: "Knows what you took.", warmth: -3 } }),
          line("Someone repaints the sign at the inn before dawn.", { effect: { kind: "marks", place: "inn", flag: "burned" } }),
          line("Smoke drifts over the docks from a fire nobody claims.", { effect: { kind: "marks", place: "docks", flag: "burned", change: "scorched pilings", note: "The pilings are burned." } }),
          line("Tam walks out into the rain without a word.", { effect: { kind: "moves", who: "tam", to: "docks" } }),
          line("Orla takes the long way to the inn before the sun is up.", { effect: { kind: "moves", who: "orla", to: "inn" } }),
          line("This one is past the limit of five scenes."),
        ],
      },
      brief(),
    )!;
    expect(scenes).toHaveLength(5);
    expect(scenes[0]!.effect).toEqual({ kind: "remembers", who: "orla", text: "Knows what you took.", warmth: -1 });
    expect(scenes[0]!.because).toBe("You took the ledger");
    // The inn wasn't touched today.
    expect(scenes[1]!.effect).toBeUndefined();
    expect(scenes[2]!.effect).toMatchObject({ kind: "marks", scar: { place: "docks", flag: "burned", day: 2 } });
    expect(scenes[2]!.where).toBe("docks");
    // Companions stay with you.
    expect(scenes[3]!.effect).toBeUndefined();
    expect(scenes[4]!.effect).toEqual({ kind: "moves", who: "orla", to: "inn" });
    expect(scenes[4]).toMatchObject({ who: "orla", where: "inn" });
  });

  test("at most one mark, one move, one rumour; one memory per person", () => {
    const scenes = parseNightScenes(
      {
        vignettes: [
          line("The first word gets round the fish market.", { effect: { kind: "word", text: "One" } }),
          line("A second word follows the first one out.", { effect: { kind: "word", text: "Two" } }),
          line("Orla thinks about you for a while tonight.", { effect: { kind: "remembers", who: "orla", text: "A", warmth: 1 } }),
          line("Orla thinks about you a little more again.", { effect: { kind: "remembers", who: "orla", text: "B", warmth: 1 } }),
        ],
      },
      brief(),
    )!;
    expect(scenes.map((s) => s.effect?.kind)).toEqual(["word", undefined, "remembers", undefined]);
  });

  test("on a quiet day nobody remembers anything the player didn't do", () => {
    const quiet = brief({ beats: [] });
    expect(quietDay(quiet)).toBe(true);
    const scenes = parseNightScenes({ vignettes: [line("Orla remembers something you never did.", { because: "You stole it", effect: { kind: "remembers", who: "orla", text: "Thief.", warmth: -1 } }), ...filler] }, quiet)!;
    expect(scenes[0]!.because).toBeUndefined();
    expect(scenes[0]!.effect).toBeUndefined();
  });

  test("it needs three real scenes", () => {
    expect(parseNightScenes({ vignettes: [line("Only one real scene is here tonight."), line("short")] }, brief())).toBeNull();
    expect(parseNightScenes({ nothing: true }, brief())).toBeNull();
  });

  test("without a model, what you did still echoes first", () => {
    const full = { ...(sheet as object), cast: [{ id: "orla", name: "Orla", role: "harbourmaster", wants: [] }], facts: [], player: { name: "Wren" } } as never;
    const scenes = fallbackNightScenes(full, null, brief({ deeds: [{ day: 2, kind: "lied_to", target: "orla", name: "Orla" }] }));
    expect(scenes[0]).toMatchObject({ who: "orla", because: "You lied to Orla" });
    expect(scenes[0]!.text).toContain("Orla");
    expect(scenes.length).toBeGreaterThanOrEqual(3);
    expect(scenes.length).toBeLessThanOrEqual(5);
  });
});

describe("what the night writes", () => {
  test("the sleeping player isn't in it, and a scene doesn't explain itself", () => {
    const scenes = parseNightScenes(
      {
        vignettes: [
          line("Wren curses under their breath, digging at the seal."),
          line("Orla stares into a cold cup because you walked away from Orla."),
          line("Tam counts the coins twice, because of what you did at the docks."),
          line("Orla asks after Wren, and nobody answers."),
          line("A gull lands on the empty mooring post.", { effect: { kind: "word", text: "Word is spreading that the harbourmaster sold the night boat." } }),
        ],
      },
      brief(),
    )!;
    expect(scenes.map((s) => s.text)).toEqual(["Orla stares into a cold cup.", "Tam counts the coins twice.", "Orla asks after Wren, and nobody answers.", "A gull lands on the empty mooring post."]);
    expect(scenes[3]!.effect).toEqual({ kind: "word", text: "The harbourmaster sold the night boat." });
  });

  test("the writer is told so", () => {
    const { system, user } = meanwhilePrompt(sheet, null, brief());
    expect(system).toContain("Wren is the player: asleep");
    expect(system).toContain("the scene never explains its own cause");
    expect(user).toContain("calls Wren 'you', such as: Thinks you are hiding something");
    // A default persona name isn't anyone's name.
    expect(meanwhilePrompt(sheet, null, brief({ player: "User" })).system).toContain("The player is asleep");
    const scenes = parseNightScenes({ vignettes: [line("Orla watches the road until the lamps go out.", { effect: { kind: "remembers", who: "orla", text: "Thinks You saw too much.", warmth: -1 } }), ...filler] }, brief())!;
    expect(scenes[0]!.effect).toMatchObject({ text: "Thinks you saw too much." });
  });
});

describe("what was said holds", () => {
  const talk = { day: 2, where: "docks", who: "Orla", said: ["Here, take the ledger back."], reply: "She takes it without a word.", ended: "she hears you out" };

  test("the night reads what was said in a talk, and is told to hold to it", () => {
    const { system, user } = meanwhilePrompt(sheet, null, brief({ talks: [talk] }));
    expect(user).toContain("Here, take the ledger back");
    expect(user).toContain("She takes it without a word");
    expect(system).toContain("if a talk settled something, or something was given back, it stands");
    expect(quietDay(brief({ beats: [], talks: [talk] }))).toBe(false);
  });

  test("charming someone who refuses you is only trying", () => {
    const deeds: Deed[] = [{ day: 2, kind: "refused", target: "orla", name: "Orla" }, { day: 2, kind: "charmed", target: "orla", name: "Orla" }, { day: 2, kind: "charmed", target: "tam", name: "Tam" }];
    expect(dayLines([], deeds)).toEqual(["Orla refused you.", "You tried to charm Orla.", "You charmed Tam."]);
  });

  test("a day of lines with no deeds still gets answered without a model", () => {
    const full = { ...(sheet as object), cast: [], facts: [], player: { name: "Wren" } } as never;
    const scenes = fallbackNightScenes(full, null, brief({ beats: [{ said: "I search the crates.", roll: "Searching: 15 vs 12, success", reply: "A key.", found: "A brass key", where: "docks" }] }));
    expect(scenes[0]).toMatchObject({ where: "docks", because: "What you found" });
    expect(scenes[0]!.text).toContain("the Docks");
    const slipped = fallbackNightScenes(full, null, brief());
    expect(slipped[0]).toMatchObject({ where: "docks", because: "What you tried" });
  });

  test("a blank player name reads as a person", () => {
    const scenes = parseNightScenes({ vignettes: [line("Orla watches the road until the lamps go out.", { effect: { kind: "remembers", who: "orla", text: "Thinks You is a thief.", warmth: -1 } }), ...filler] }, brief())!;
    expect(scenes[0]!.effect).toMatchObject({ text: "Thinks you are a thief." });
    const m = remember({}, [{ day: 1, kind: "charmed", target: "orla", name: "Orla" }, { day: 1, kind: "caught", target: "orla", name: "Orla", method: "Going unseen" }], new Set(["orla"]), "");
    expect(m.orla!.notes.map((n) => n.text)).toEqual(["the player was kind to them on day 1", "caught the player at it on day 1: Going unseen"]);
    expect(remember({}, [{ day: 1, kind: "charmed", target: "orla", name: "Orla" }], new Set(["orla"]), "User").orla!.notes[0]!.text).toContain("the player was kind");
  });
});

describe("the night a thread ends", () => {
  test("without a model it still gets its scene, first", () => {
    const full = { ...(sheet as object), cast: [], facts: [], player: { name: "Wren" } } as never;
    const lost = fallbackNightScenes(full, null, brief({ thread: { goal: "Find the boat.", found: 1, total: 3, daysLeft: 0, ended: "lost", justEnded: true } }));
    expect(lost[0]).toMatchObject({ because: "Time ran out" });
    expect(lost[0]!.text).toContain("Find the boat");
    const solved = fallbackNightScenes(full, null, brief({ thread: { goal: "Find the boat", found: 3, total: 3, daysLeft: 1, ended: "solved", justEnded: true } }));
    expect(solved[0]).toMatchObject({ because: "You found all of it" });
    const told = fallbackNightScenes(full, null, brief({ thread: { goal: "Find the boat", found: 1, total: 3, daysLeft: 0, ended: "lost", justEnded: false } }));
    expect(told[0]!.because).not.toBe("Time ran out");
  });
});

describe("by morning", () => {
  const names = { person: (id: string) => ({ orla: "Orla" })[id] ?? id, place: (id: string) => ({ docks: "The Docks", inn: "The Inn" })[id] ?? id, here: "inn" };

  test("each change is named in plain words", () => {
    expect(effectStamp({ kind: "remembers", who: "orla", text: "x", warmth: -1 }, names)).toBe("Orla cools toward you");
    expect(effectStamp({ kind: "moves", who: "orla", to: "inn" }, names)).toBe("Orla is coming here");
    const lower = { ...names, place: () => "the old kitchens" };
    expect(effectStamp({ kind: "marks", scar: { place: "x", flag: "quiet", change: "", note: "", day: 1 } }, lower)).toBe("The old kitchens has changed");
    const lines = morningLines(
      [
        { text: "a", effect: { kind: "remembers", who: "orla", text: "Knows what you took.", warmth: -1 } },
        { text: "b", effect: { kind: "moves", who: "orla", to: "docks" } },
        { text: "c" },
      ],
      names,
      { goal: "Find the boat.", found: 1, total: 3, daysLeft: 1, justEnded: false },
      [{ who: "orla", text: "caught you" }, { who: "tam", text: "Wren talked them round" }],
    );
    // Someone the montage already covered isn't repeated; someone it didn't is still told.
    expect(lines).toEqual(["Orla: Knows what you took.", "Orla is at The Docks now.", "tam: Wren talked them round", "Last day. 1 of 3 found."]);
    expect(meanwhileText([{ text: "a" }], lines.slice(0, 1))).toBe("Meanwhile…\n\n- a\n\nBy morning:\n- Orla: Knows what you took.");
  });
});

describe("a night in play", () => {
  const cast = [
    { id: "orla", name: "Orla", role: "harbourmaster", look: "", wants: ["the ledger back"], main: false, evidence: { source: "gambit", quote: "works the docks", verified: false } },
    { id: "tam", name: "Tam", role: "your friend", look: "", wants: [], main: true, evidence: { source: "gambit", quote: "", verified: false } },
  ];
  const full = {
    v: 1,
    cardKey: "k",
    cardName: "Saltgate",
    premise: "A harbour town.",
    tone: "dry",
    readAt: 1,
    shape: "town",
    skin: { genre: "mystery", defaultTheme: "storybook" },
    cast,
    places: [
      { id: "docks", name: "The Docks", description: "Wet stone.", evidence: { source: "gambit", quote: "", verified: false } },
      { id: "inn", name: "The Inn", description: "Warm.", evidence: { source: "gambit", quote: "", verified: false } },
    ],
    facts: [],
    player: { personaId: null, name: "Wren", concept: "", social: { presence: 1, menace: 1, guile: 1 }, edited: false },
    modules: { parley: true, encounters: false, delves: false, board: false, overland: false },
    foes: [],
    kits: [],
    verifyWorld: [],
    lore: [],
  };

  function setup(answer: Record<string, unknown> | null, models: { slow?: string[]; failed?: string[] } = {}, timing: { hedgeMs?: number } = {}) {
    const files = new Map<string, unknown>();
    const posted: string[] = [];
    const sent: ToFrontend[] = [];
    const asked: { user: string }[] = [];
    const requested: string[] = [];
    const night: string[] = [];
    const spindle = {
      log: { info() {}, warn() {}, error() {} },
      userStorage: {
        getJson: async (p: string, o: { fallback: unknown }) => (files.has(p) ? structuredClone(files.get(p)) : o.fallback),
        setJson: async (p: string, v: unknown) => void files.set(p, structuredClone(v)),
      },
      chat: { appendMessage: async (_c: string, m: { content: string }) => void posted.push(m.content) },
    };
    const art = { request: (key: string) => (requested.push(key), { key, state: "queued" }), status: () => null, whenDone: () => new Promise(() => {}) };
    const cards = {
      sheetFor: async () => full as never,
      armory: async () => full as never,
      talk: async () => {},
      recent: async () => [],
      compile: async (_u: string, kind: string, prompt: { user: string }, _m: number, parse: (raw: Record<string, unknown>) => unknown, fallback: (why: string) => unknown) => {
        if (kind !== "meanwhile" && kind !== "night-plain") return { value: fallback("not the night"), by: "fallback", tries: 1, why: "not the night" };
        asked.push({ user: prompt.user });
        night.push(kind);
        if (models.slow?.includes(kind)) await new Promise(() => {});
        const value = answer && !models.failed?.includes(kind) ? parse(answer) : null;
        return value ? { value, by: "model", tries: 1 } : { value: fallback("no"), by: "fallback", tries: 1, why: "no" };
      },
    };
    const play = createPlay(spindle as never, (m) => sent.push(m), art as never, cards as never, { startState: async () => {} }, { readMs: 0, retryMs: [], ...timing });
    const nights = () => sent.flatMap((m) => (m.type === "scene.meanwhile" ? [m] : []));
    return { play, files, posted, sent, asked, requested, nights, kinds: () => night };
  }

  const answer = {
    vignettes: [
      line("Orla checks the shelf where the ledger was, twice.", { who: "orla", because: "You went to the docks", effect: { kind: "remembers", who: "orla", text: "Is watching you now.", warmth: -1 } }),
      line("Smoke hangs over the docks until the tide takes it.", { where: "docks", effect: { kind: "marks", place: "docks", flag: "burned", change: "scorched pilings", note: "The pilings are burned." } }),
      line("Orla walks down to the docks in the dark and waits by the water.", { who: "orla", effect: { kind: "moves", who: "orla", to: "docks" } }),
    ],
  };

  test("what the night shows is what's true the next day", async () => {
    const { play, files, nights, posted, requested, asked } = setup(answer);
    await play.open("u", "c1");
    // Something to answer: the fallback line is fine, what matters is that it was played at a place.
    const key = [...files.keys()].find((k) => /c1/.test(k))!;
    const start = files.get(key) as { scene: { placeId: string; day: number }; story?: unknown[]; world: { places: Record<string, { people: string[] }> } };
    start.story = [{ said: "I walk the docks.", roll: null, reply: "Gulls.", day: start.scene.day, where: "docks" }];
    start.world.places.docks!.people = start.world.places.docks!.people.filter((p) => p !== "orla");
    start.world.places.inn!.people = ["orla"];
    files.set(key, start);
    await play.act("u", "c1", "rest");
    await new Promise((res) => setTimeout(res, 5));

    expect(asked[0]!.user).toContain("I walk the docks");
    const [open, shown] = nights();
    expect(open).toMatchObject({ vignettes: null, today: ["“I walk the docks.”"] });
    expect(shown!.vignettes!.map((v) => v.change)).toEqual(["Orla cools toward you", "The Docks has changed", "Orla is coming here"]);
    expect(shown!.vignettes![0]!.why).toBe("You went to the docks");
    expect(shown!.morning).toEqual(expect.arrayContaining(["Orla: Is watching you now.", "The Docks: The pilings are burned.", "Orla is here now."]));
    expect(posted.at(-1)).toMatch(/By morning/);

    const r = files.get(key) as { world: { places: Record<string, { people: string[] }> }; memory: { scars: Record<string, { flag: string }>; npc: Record<string, { notes: { text: string }[]; affinity: number }>; nights: { lines: string[] }[] } };
    expect(r.memory.npc.orla!.notes.at(-1)!.text).toBe("Is watching you now.");
    expect(r.memory.npc.orla!.affinity).toBe(-1);
    expect(r.memory.scars.docks!.flag).toBe("burned");
    expect(r.world.places.docks!.people).toContain("orla");
    expect(r.world.places.inn!.people).not.toContain("orla");
    expect(requested.some((k) => /~burned$/.test(k))).toBe(true);
    expect(r.memory.nights.at(-1)!.lines[0]).toContain("Orla checks the shelf");

    // The next day's narrator hears about it.
    const out = await play.intercept([{ role: "system", content: "preset" }, { role: "user", content: "hi" }] as never, { chatId: "c1", userId: "u", generationType: "normal" } as never);
    expect(String(out[1]!.content)).toContain("Last night, while Wren slept");
    expect(String(out[1]!.content)).toContain("Orla checks the shelf");
  });

  test("a Parley's words reach that night and the next day's narrator", async () => {
    const { play, asked } = setup(answer);
    await play.open("u", "c8");
    await play.onParleyEnd("u", { card: { castId: "orla" }, npc: { name: "Orla" } } as never, { chatId: "c8", end: { kind: "refused" }, exchanges: [{ text: "Here, take the ledger back.", reply: "She takes it without a word.", read: { tactic: "offer" } }] } as never);
    await play.act("u", "c8", "rest");
    expect(asked[0]!.user).toContain("Here, take the ledger back");
    const out = await play.intercept([{ role: "system", content: "preset" }, { role: "user", content: "hi" }] as never, { chatId: "c8", userId: "u", generationType: "normal" } as never);
    expect(String(out[1]!.content)).toContain("Here, take the ledger back");
    expect(String(out[1]!.content)).toContain("Hold to what was said");
  });

  test("the next night is told about the last one", async () => {
    const { play, asked } = setup(answer);
    await play.open("u", "c2");
    await play.act("u", "c2", "rest");
    await play.act("u", "c2", "rest");
    expect(asked[1]!.user).toContain("Last night's montage showed: Orla checks the shelf");
  });

  test("a slow narrator doesn't cost the night: the helper starts beside it, and the first real answer wins", async () => {
    const { play, nights, kinds } = setup(answer, { slow: ["meanwhile"] }, { hedgeMs: 1 });
    await play.open("u", "c4");
    await play.act("u", "c4", "rest");
    expect(kinds()).toEqual(["meanwhile", "night-plain"]);
    expect(nights().at(-1)!.vignettes![0]!.text).toContain("Orla checks the shelf");
  });

  test("a narrator that answers in time is the only one asked", async () => {
    const { play, kinds } = setup(answer, {}, { hedgeMs: 500 });
    await play.open("u", "c5");
    await play.act("u", "c5", "rest");
    expect(kinds()).toEqual(["meanwhile"]);
  });

  test("a narrator that fails hands over at once, and code answers if the helper fails too", async () => {
    const failed = setup(answer, { failed: ["meanwhile"] }, { hedgeMs: 500 });
    await failed.play.open("u", "c6");
    await failed.play.act("u", "c6", "rest");
    expect(failed.kinds()).toEqual(["meanwhile", "night-plain"]);
    expect(failed.nights().at(-1)!.vignettes![0]!.text).toContain("Orla checks the shelf");
    const neither = setup(null, {}, { hedgeMs: 500 });
    await neither.play.open("u", "c7");
    await neither.play.act("u", "c7", "rest");
    expect(neither.kinds()).toEqual(["meanwhile", "night-plain"]);
    expect(neither.nights().at(-1)!.vignettes!.length).toBeGreaterThanOrEqual(3);
  });

  test("no model: the night still plays and the morning still comes", async () => {
    const { play, nights, posted } = setup(null);
    await play.open("u", "c3");
    await play.act("u", "c3", "rest");
    const shown = nights().at(-1)!;
    expect(shown.vignettes!.length).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(shown.morning)).toBe(true);
    expect(posted.at(-1)).toMatch(/^\*Meanwhile…/);
  });
});
