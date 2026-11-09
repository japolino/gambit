/**
 * A card that is a game or a setting, not a person; a player with no persona; and what such a card's rules ask of a model.
 */
import { describe, expect, test } from "bun:test";
import { encounterFrom, parseFoe, partyFromSheet, playerPerson, type SheetFoe } from "../src/engine/card/foes.js";
import { cleanReply } from "../src/engine/parley/narrate.js";
import { cardSaysWorld, fallbackSheet, mergeEdits, mergeReads, parseSheet, quoteFound, readerPrompts, repairSheet, resolveMacros } from "../src/meaning/card-reader.js";
import { salvageJson } from "../src/meaning/referee.js";
import { narratorPrompt, readFromAnswers, routeQuestions, type StoryContext } from "../src/meaning/story.js";
import type { CardSheet, CardSources } from "../src/engine/card/types.js";

const RULES = "### RULES\n\nTessera Project [Re] 2.0 is a game and the player is a player so always show status information of the player at the end of every output.";

const card = (name: string, description: string): CardSources["cards"][number] => ({ id: name, name, description, personality: "", scenario: "", firstMes: "", alternateGreetings: [], mesExample: "", creatorNotes: "", tags: [], imageId: null, avatarUrl: null, updatedAt: 1 }) as never;
const sources = (name: string, description: string, persona = ""): CardSources => ({ cards: [card(name, description)], persona: { id: persona ? "p1" : null, name: persona, title: "", description: "" }, lore: [], chat: [] });
const person = (name: string, role = "a guild clerk") => ({ id: name.toLowerCase(), name, role, pronoun: "she" });

test("where someone is found survives the merge with the detailed read, and only for a place the sheet has", () => {
  const world = sources("Harrowmere", "A frontier town narrated by the world.");
  const sheet = parseSheet(
    mergeReads(
      { places: [{ id: "kettle", name: "The Coiled Kettle", description: "an inn" }], cast: [{ ...person("Ysolde", "lamia innkeeper"), at: "kettle" }, { ...person("Rook", "werewolf"), at: "den" }] },
      { cast: [{ ...person("Ysolde", "lamia innkeeper"), wants: ["a husband"] }] },
    ),
    world,
    1,
  );
  expect(sheet.cast.find((c) => c.name === "Ysolde")).toMatchObject({ at: "kettle", wants: ["a husband"] });
  expect(sheet.cast.find((c) => c.name === "Rook")?.at).toBeUndefined();
});

describe("a card that isn't a person", () => {
  const world = sources("Tessera Project [Re] 2.0", RULES);

  test("left out by the reader, it stays out, and the panel says why", () => {
    const sheet = parseSheet(mergeReads({ cast: [person("Orla"), person("Tam")] }, null), world, 1);
    expect(sheet.cast.map((c) => c.name)).toEqual(["Orla", "Tam"]);
    expect(sheet.notes.join(" ")).toContain("isn't in the cast");
  });

  test("the reader naming it as not a person keeps it out, even if the other half listed it", () => {
    const src = sources("The Long Road", "A journey across the marches, told in chapters.");
    const sheet = parseSheet(mergeReads({ cast: [person("Orla")], not_people: ["The Long Road"] }, { cast: [person("The Long Road")] }), src, 1);
    expect(sheet.cast.map((c) => c.name)).toEqual(["Orla"]);
  });

  test("a person the reader forgot still goes back in", () => {
    const src = sources("Mara", "Mara is a quiet lighthouse keeper who distrusts strangers.");
    const sheet = parseSheet(mergeReads({ cast: [person("Orla")] }, null), src, 1);
    expect(sheet.cast[0]).toMatchObject({ name: "Mara", main: true });
    expect(sheet.notes.join(" ")).toContain("was missing from the read");
  });

  test("someone with a job in games isn't a game", () => {
    expect(cardSaysWorld({ name: "Wren", description: "Wren is a game developer with a sharp tongue." })).toBe(false);
    expect(cardSaysWorld({ name: "Wren", description: "Wren is a young knight." })).toBe(false);
    expect(cardSaysWorld({ name: "Dusk RPG", description: "Dusk RPG is a text adventure. The player wakes up." })).toBe(true);
    expect(cardSaysWorld({ name: "Anything", description: "### Rules\nDo this." })).toBe(true);
  });

  test("with nobody else read, its rules still never become anyone's role", () => {
    for (const sheet of [fallbackSheet(world, 1), parseSheet({ cast: [] }, world, 1)]) {
      expect(sheet.cast).toHaveLength(1);
      expect(JSON.stringify(sheet.cast[0])).not.toMatch(/status information|RULES/);
    }
  });

  test("a person card's headings and tags don't become their role", () => {
    const src = sources("Mara", "### About\n<bio>Mara keeps the lighthouse on the north shore.</bio>");
    expect(parseSheet({ cast: [] }, src, 1).cast[0]!.role).toBe("Mara keeps the lighthouse on the north shore.");
  });

  test("<char> reads as the card's name, like {{char}}", () => {
    expect(resolveMacros("<char> greets {{user}}", "Mara", "Orla")).toBe("Mara greets Orla");
  });
});

describe("a card in Korean", () => {
  const src = sources("레퍼리드 사단", "Name: Leporid Division. Overview: a terrifying military force of rabbit-eared soldiers. 레퍼리드 사단은 토끼 귀를 가진 병사들의 부대다.");

  test("a faction the reader names as not a person stays out of the cast", () => {
    const sheet = parseSheet(mergeReads({ cast: [person("한소연", "a shock trooper")], not_people: ["레퍼리드 사단", "Leporid Division"] }, null), src, 1);
    expect(sheet.cast.map((c) => c.name)).toEqual(["한소연"]);
    expect(sheet.notes.join(" ")).not.toContain("was missing from the read");
  });

  test("a quote in Hangul is found in the card", () => {
    expect(quoteFound("토끼 귀를 가진 병사들의 부대다", src.cards[0]!.description)).toBe(true);
    expect(quoteFound("토끼 귀를 가진 마법사들의 왕국이다", src.cards[0]!.description)).toBe(false);
  });
});

describe("how people look", () => {
  const src = sources("Ero Trap Dungeon", "A dungeon run by its officers.");

  test("the reader is asked, and its answer is kept for the cast and the player", () => {
    expect(readerPrompts(src).world.user).toMatch(/"cast": \[\{[^\]]*"look"/);
    const sheet = parseSheet(mergeReads({ cast: [{ ...person("Lilim", "trap officer"), look: "short pink twin tails, small bat wings, latex jacket" }], player: { concept: "a newborn monster", look: "a palm-sized green slime", pronoun: "they" } }, null), src, 1);
    expect(sheet.cast.find((c) => c.name === "Lilim")!.look).toBe("short pink twin tails, small bat wings, latex jacket");
    expect(sheet.player).toMatchObject({ look: "a palm-sized green slime", pronoun: "they" });
  });

  test("the player's figure is drawn from the persona, else from what the card says the player is", () => {
    const sheet = parseSheet({ player: { concept: "a newborn monster", look: "a palm-sized green slime" } }, src, 1);
    expect(playerPerson(sheet)).toEqual({ id: "p_player", name: "the player", role: "a newborn monster", look: "a palm-sized green slime", pronoun: "they" });
    const tobin = parseSheet({ player: { concept: "a deserter", look: "dark curly hair, broken nose", pronoun: "he" } }, sources("Harrowmere", "A frontier town.", "Tobin"), 1);
    expect(playerPerson(tobin)).toMatchObject({ name: "Tobin", look: "dark curly hair, broken nose", pronoun: "he" });
  });
});

describe("a sheet read before these rules", () => {
  const old = (): CardSheet => ({
    ...fallbackSheet(sources("Tessera Project [Re] 2.0", RULES), 1),
    notes: ["Tessera Project [Re] 2.0 was missing from the read and was added from the card."],
    skin: { genre: "", currency: "Coins (Bronze, Silver, Gold, S", stats: { presence: "", menace: "", guile: "" }, fight: "fight" },
    player: { personaId: null, name: "You", concept: "", social: { presence: 2, menace: 1, guile: 2 } as CardSheet["player"]["social"], edited: false },
  });

  test("loses the game from its cast, the placeholder name and the clipped currency", () => {
    const stale = old();
    const orla = { ...stale.cast[0]!, id: "orla", name: "Orla", role: "a guild clerk", main: false };
    stale.cast = [{ ...stale.cast[0]!, role: "### RULES <char> is a game and the player is a player" }, orla];
    const sheet = repairSheet(stale);
    expect(sheet.cast.map((c) => c.name)).toEqual(["Orla"]);
    expect(sheet.notes).toEqual([]);
    expect(sheet.player.name).toBe("");
    expect(sheet.skin.currency).toBe("Coins");
  });

  test("a real persona called that, and an ordinary cast, are left alone", () => {
    const sheet = fallbackSheet(sources("Mara", "Mara keeps the lighthouse.", "Tam"), 1);
    expect(repairSheet(sheet)).toBe(sheet);
  });
});

describe("reading a card again", () => {
  const src = sources("Mara", "Mara keeps the lighthouse.");
  const first = parseSheet({ cast: [{ ...person("Orla Venn"), id: "orla_venn" }, { ...person("Tam"), id: "tam" }] }, src, 1);

  test("keeps everyone's id, in the cast and in the facts, so chats in progress still know them", () => {
    const again = parseSheet({ cast: [{ ...person("Orla Venn"), id: "orla" }, { ...person("Wren"), id: "wren" }], facts: [{ id: "f", text: "Orla owes money.", about: ["Orla Venn"] }] }, src, 2);
    const merged = mergeEdits(again, first);
    expect(merged.cast.find((c) => c.name === "Orla Venn")!.id).toBe("orla_venn");
    expect(merged.cast.find((c) => c.name === "Wren")!.id).toBe("wren");
    expect(merged.facts[0]!.about).toEqual(["orla_venn"]);
  });

  test("never gives two people the same id", () => {
    const again = parseSheet({ cast: [{ ...person("Orla Venn"), id: "tam" }, { ...person("Tam"), id: "orla_venn" }] }, src, 2);
    const ids = mergeEdits(again, first).cast.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("a player with no persona", () => {
  const ctx: StoryContext = { premise: "A world.", tone: "", player: { name: "", concept: "a newcomer" }, place: { name: "Gate", description: "" }, time: "day", people: [], places: [], goal: null, recent: [], memory: null };

  test("has no made-up name, and fights under one the log can read", () => {
    const sheet = parseSheet({ cast: [person("Orla")] }, sources("Mara", "Mara keeps the lighthouse."), 1);
    expect(sheet.player.name).toBe("");
    expect(partyFromSheet(sheet)[0]!.name).toBe("Hero");
  });

  test("a persona literally named as a placeholder counts as none", () => {
    expect(parseSheet({}, sources("Mara", "Mara keeps the lighthouse.", "User"), 1).player.name).toBe("");
  });

  test("is written as you, and a named one in third person", () => {
    expect(narratorPrompt(ctx, "I wait.", "", "flavor").system).toContain("second person");
    expect(narratorPrompt({ ...ctx, player: { name: "Tam", concept: "" } }, "I wait.", "", "flavor").system).toContain("third person");
  });
});

describe("what the playtest turned up in the reading", () => {
  const ctx: StoryContext = { premise: "A frontier town.", tone: "", player: { name: "Tobin", concept: "an Order deserter with a forged writ" }, place: { name: "Gate", description: "" }, time: "night", people: [], places: [], goal: "Reach the inn unseen", recent: [], memory: null };
  const harrowmere = (description: string) => ({ ...sources("Harrowmere", description), persona: { id: "p", name: "Tobin", title: "", description: "Tobin, a deserter. Has 12 silver." } });

  test("the card's person is the narrator's, and a named player is still called by name", () => {
    const { system } = narratorPrompt({ ...ctx, player: { ...ctx.player, person: "second" } }, "I wait.", "", "flavor");
    expect(system).toContain(`second person present, calling Tobin "you"`);
    expect(narratorPrompt({ ...ctx, player: { name: "", concept: "", person: "third" } }, "I wait.", "", "flavor").system).toContain("third person");
  });

  test("the player's past and aims are the narrator's to know, not the world's", () => {
    const { system, user } = narratorPrompt(ctx, "I wait.", "", "flavor");
    expect(system).toContain("never Tobin's past, secrets or aims");
    expect(user).toContain("nobody here knows unless the story has shown it");
  });

  test("the reader records the card's person and the starting purse, and leaves them out when unsaid", () => {
    const read = parseSheet({ player: { concept: "a deserter", person: "second", coin: 12 } }, harrowmere("Second person present tense for {{user}}."), 1);
    expect(read.player).toMatchObject({ person: "second", coin: 12 });
    const unsaid = parseSheet({ player: { concept: "a deserter", person: null, coin: null } }, harrowmere("A town."), 1).player;
    expect(unsaid.person).toBeUndefined();
    expect(unsaid.coin).toBeUndefined();
  });
});

describe("a scene with nobody in it", () => {
  const ctx: StoryContext = { premise: "", tone: "", player: { name: "", concept: "" }, place: { name: "Gate", description: "" }, time: "day", people: [], places: [], goal: null, recent: [], memory: null };

  test("asks nothing about who, so the decision model can still read the line", () => {
    const q = routeQuestions(ctx);
    expect(q.target).toBeUndefined();
    for (const one of Object.values(q) as { criteria?: Record<string, string> }[]) expect(Object.keys(one.criteria ?? {}).length).toBeGreaterThanOrEqual(2);
    const answers = { route: { type: "choice", choice: "risk", confidence: 0.9 }, stat: { type: "choice", choice: "guile", confidence: 0.9 } };
    expect(readFromAnswers(answers as never, [], [])).toMatchObject({ route: "risk", target: null });
  });

  test("with someone here it still asks", () => {
    expect(routeQuestions({ ...ctx, people: [{ id: "orla", name: "Orla", role: "a clerk" }] }).target).toBeDefined();
  });
});

describe("what a card's rules ask of a model", () => {
  test("the narrator is told prose only", () => {
    const ctx: StoryContext = { premise: "", tone: "", player: { name: "Tam", concept: "" }, place: { name: "Gate", description: "" }, time: "day", people: [], places: [], goal: null, recent: [], memory: null };
    expect(narratorPrompt(ctx, "I wait.", "", "flavor").system).toContain("no status lines");
  });

  test("a status line that slips through is cut; prose and speech about the same things are not", () => {
    expect(cleanReply("Orla frowns.\n\n[HP: 100/100 | Mana: 50/50 | Gold: 0 | Items: Edict, Crystal]")).toBe("Orla frowns.");
    expect(cleanReply("Orla frowns.\nHP: 40/40")).toBe("Orla frowns.");
    expect(cleanReply('She counts it twice.\n"Gold: that is all you ever ask about," she says.')).toContain("Gold: that is");
    expect(cleanReply("The status: nobody knows. The gate stays shut.")).toContain("The status");
  });
});

describe("a read cut off partway", () => {
  test("keeps everything whole that came through", () => {
    const raw = salvageJson('{"cast": [{"name": "Orla", "wants": ["coin"]}, {"name": "Tam", "wan');
    expect(raw).toEqual({ cast: [{ name: "Orla", wants: ["coin"] }, { name: "Tam" }] });
  });

  test("a finished or hopeless answer isn't salvaged", () => {
    expect(salvageJson('{"cast": []}')).toBeNull();
    expect(salvageJson("no json here")).toBeNull();
    expect(salvageJson('{"a"')).toBeNull();
  });
});

describe("someone alone", () => {
  const foe = (id: string, tier: number): SheetFoe => parseFoe({ id, name: id, role: "brute", tier }, 0)!;

  test("doesn't face a squad; a party still does", () => {
    const foes = [foe("a", 2), foe("b", 1), foe("c", 1)];
    expect(encounterFrom(foes, { seed: "s", lead: "a", party: 1 })!.foes).toHaveLength(1);
    expect(encounterFrom(foes, { seed: "s", lead: "b", party: 1 })!.foes).toHaveLength(2);
    expect(encounterFrom(foes, { seed: "s", lead: "a", party: 2 })!.foes).toHaveLength(3);
    expect(encounterFrom(foes, { seed: "s", lead: "a" })!.foes).toHaveLength(3);
  });
});
