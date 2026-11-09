import { describe, expect, test } from "bun:test";
import type { DecisionAnswer } from "lumiverse-spindle-types";
import { contestFrom, scenarioFromSheet } from "../src/engine/card/sizing.js";
import type { CardSources, SheetFact } from "../src/engine/card/types.js";
import { applyExchange, createParley } from "../src/engine/parley/exchange.js";
import type { RefereeRead } from "../src/engine/parley/types.js";
import { chipFromAnswers, fallbackFrame, fallbackSheet, framePrompt, lastBeat, mergeEdits, mergeReads, parseFrame, parseSheet, quoteFound, readerPrompt, readerPrompts, resolveMacros, storySoFar } from "../src/meaning/card-reader.js";

const SRC: CardSources = {
  cards: [
    {
      id: "char-ilse",
      name: "Ilse Varga",
      description: "Ilse Varga is a smuggler captain on the drowned coast. She runs the sloop Heron out of Lowmarsh and trusts nobody who hasn't paid up front. The Tide Guild fined her twice this month.",
      personality: "Sharp, mercenary, secretly sentimental about her old crew.",
      scenario: "{{user}} needs passage upriver and finds {{char}} drinking at the Drowned Lantern tavern.",
      firstMes: '"Upriver? That costs half your cut," Ilse says, not looking up from her cards. Her quartermaster Dov watches the door.',
      alternateGreetings: [],
      mesExample: "",
      creatorNotes: "",
      tags: ["fantasy", "smuggler"],
      imageId: "img-ilse",
      avatarUrl: "/thumb/ilse.webp",
      updatedAt: 1000,
    },
  ],
  persona: { id: "p1", name: "Corin", title: "disgraced navigator", description: "Corin lost his commission after running the Heron aground years ago." },
  lore: [{ title: "Customs fleet", content: "The customs cutter Vigil patrols the river mouth and boards any ship flying no guild pennant.", scope: "card" }],
  chat: [],
};

const ARCHITECT = {
  premise: "A smuggler captain sells passage upriver.",
  tone: "salty, tense",
  skin: { genre: "low fantasy", currency: "marks", stats: { presence: "Nerve", menace: "Steel", guile: "Wiles" }, fight: "boarding fight" },
  shape: "journey",
  modules: { parley: true, encounters: true, places: true, delves: false, kits: false, economy: true },
  cast: [
    { id: "ilse", name: "Ilse", role: "smuggler captain", pronoun: "she", voice: "dry", look: "weathered, red scarf", temperament: { warmth: 1, pride: 3, greed: 4, fear: 1 }, wants: ["money"], fears: ["the guild"], likes_tactics: ["interest", "nonsense"], hates_tactics: ["flattery"], insight: 3, patience: 9, tells: { irritated: "taps her cards" }, quote: "trusts nobody who hasn't paid up front" },
    { id: "dov", name: "Dov", role: "quartermaster", pronoun: "he", quote: "Her quartermaster Dov watches the door" },
    { id: "corin", name: "Corin", role: "the player" },
  ],
  facts: [
    { id: "fines", text: "The Tide Guild fined Ilse twice this month.", claim: "the guild fined her twice this month", about: ["ilse"], weight: 2, quote: "The Tide Guild fined her twice this month" },
    { id: "aground", text: "Corin ran the Heron aground years ago.", claim: "you ran the Heron aground", about: ["Ilse"], weight: 3, quote: "running the Heron aground years ago" },
    { id: "cutter", text: "A customs cutter boards ships without a guild pennant.", claim: "the Vigil boards ships with no pennant", about: ["ilse"], weight: 2, quote: "boards any ship flying no guild pennant" },
    { id: "made_up", text: "Ilse owes a crime lord a fortune.", claim: "she owes Mother Brine", about: ["ilse"], weight: 3, quote: "Ilse owes Mother Brine nine hundred marks" },
  ],
  places: [{ id: "lantern", name: "The Drowned Lantern", description: "A tavern on stilts.", quote: "drinking at the Drowned Lantern tavern" }],
  player: { concept: "a disgraced navigator", social: { presence: 3, menace: 0, guile: 7 } },
};

describe("card reader", () => {
  test("macros resolve to names", () => {
    expect(resolveMacros("{{user}} meets {{char}} {{random:a,b}}", "Ilse", "Corin")).toBe("Corin meets Ilse");
  });

  test("quotes are found exactly or mostly", () => {
    expect(quoteFound("trusts nobody who hasn't paid up front", SRC.cards[0]!.description)).toBe(true);
    expect(quoteFound("Ilse owes Mother Brine nine hundred marks", SRC.cards[0]!.description)).toBe(false);
  });

  test("the prompt carries the card, persona, and lore, with tiers only", () => {
    const { user, system } = readerPrompt(SRC);
    expect(user).toContain("[CARD: Ilse Varga]");
    expect(user).toContain("[PERSONA: the player — Corin");
    expect(user).toContain("[LORE: Customs fleet]");
    expect(system).toContain("tiers");
  });

  test("a read is validated: sources, knowledge, ids, and tiers are decided in code", () => {
    const sheet = parseSheet(ARCHITECT, SRC, 5);
    expect(sheet.by).toBe("architect");
    expect(sheet.cardKey).toBe("char-ilse");
    // The card's character keeps the card's name and art; the player is never cast.
    const ilse = sheet.cast[0]!;
    expect(ilse.name).toBe("Ilse Varga");
    expect(ilse.main).toBe(true);
    expect(ilse.avatarImageId).toBe("img-ilse");
    expect(ilse.patience).toBe(4);
    expect(ilse.likesTactics).toEqual(["interest"]);
    expect(sheet.cast.map((c) => c.name)).toEqual(["Ilse Varga", "Dov"]);
    const byId = Object.fromEntries(sheet.facts.map((f) => [f.id, f]));
    expect(byId.fines!.evidence).toMatchObject({ source: "card", verified: true });
    expect(byId.fines!.known).toBe(false);
    expect(byId.aground!.evidence.source).toBe("persona");
    expect(byId.aground!.known).toBe(true);
    expect(byId.aground!.about).toEqual(["ilse"]);
    expect(byId.cutter!.evidence.source).toBe("lore");
    expect(byId.made_up!.evidence).toMatchObject({ source: "gambit", verified: false });
    expect(sheet.notes.join(" ")).toContain("Gambit-added");
    expect(sheet.player.social).toEqual({ presence: 3, menace: 0, guile: 4 });
    expect(sheet.shape).toBe("journey");
    expect(sheet.modules.encounters).toBe(true);
  });

  test("the read is two short asks whose answers merge, detailed people first", () => {
    const { world, people } = readerPrompts(SRC);
    expect(world.user).toContain('"modules"');
    expect(world.user).not.toContain('"facts"');
    expect(people.user).toContain('"facts"');
    const merged = mergeReads(
      { premise: "p", cast: [{ id: "ilse", name: "Ilse", role: "captain" }, { id: "dov", name: "Dov", role: "quartermaster" }], places: [] },
      { cast: [{ id: "ilse", name: "Ilse", role: "captain", temperament: { greed: 4 } }], facts: [{ id: "f", text: "t" }] },
    );
    expect((merged.cast as { name: string }[]).map((c) => c.name)).toEqual(["Ilse", "Dov"]);
    expect((merged.cast as { temperament?: unknown }[])[0]!.temperament).toEqual({ greed: 4 });
    expect(merged.facts).toHaveLength(1);
    // Either half alone still gives a sheet with the card's character.
    expect(parseSheet(mergeReads(null, { cast: [], facts: [] }), SRC, 1).cast[0]!.name).toBe("Ilse Varga");
  });

  test("the same person named two ways is one cast member, and facts point at the detailed one", () => {
    const merged = mergeReads(
      { cast: [{ id: "captain_ilse", name: "Captain Ilse Varga", role: "captain" }, { id: "dov", name: "Dov", role: "quartermaster" }, { id: "mara_varga", name: "Mara Varga", role: "sister" }] },
      { cast: [{ id: "ilse", name: "Ilse", temperament: { greed: 4 }, wants: ["money"] }, { id: "dov_q", name: "Quartermaster Dov", wants: [] }], facts: [{ id: "f", text: "The guild fined her.", about: ["ilse", "captain_ilse", "dov"], weight: 2 }] },
    );
    // Titles and a surname do not make two people; a shared surname alone does not make one.
    expect((merged.cast as { name: string }[]).map((c) => c.name)).toEqual(["Ilse", "Quartermaster Dov", "Mara Varga"]);
    // Even when the halves are not merged first, the parser folds the duplicate in and keeps the first id.
    const sheet = parseSheet({ cast: [{ id: "ilse", name: "Ilse", wants: ["money"] }, { id: "ilse_v", name: "Captain Ilse Varga", fears: ["the guild"] }, { id: "dov", name: "Dov" }], facts: [{ id: "f", text: "t", about: ["ilse_v", "dov"], weight: 2 }] }, SRC, 1);
    expect(sheet.cast.map((c) => c.id)).toEqual(["ilse", "dov"]);
    expect(sheet.cast[0]!.wants).toEqual(["money"]);
    expect(sheet.cast[0]!.fears).toEqual(["the guild"]);
    expect(sheet.facts[0]!.about).toEqual(["ilse", "dov"]);
  });

  test("junk from the model still gives a playable sheet with the card's character", () => {
    const sheet = parseSheet({ cast: "nope", facts: [{}], modules: null }, SRC, 5);
    expect(sheet.cast).toHaveLength(1);
    expect(sheet.cast[0]!.characterId).toBe("char-ilse");
    expect(sheet.modules.parley).toBe(true);
    expect(sheet.facts).toEqual([]);
  });

  test("the fallback sheet needs no model", () => {
    const sheet = fallbackSheet(SRC, 5);
    expect(sheet.by).toBe("fallback");
    expect(sheet.cast[0]!.pronoun).toBe("she");
    expect(sheet.modules).toMatchObject({ parley: true, encounters: false });
    expect(sheet.player.name).toBe("Corin");
  });

  test("a re-read keeps the player's edits", () => {
    const old = parseSheet(ARCHITECT, SRC, 5);
    old.player = { ...old.player, social: { presence: 4, menace: 4, guile: 4 }, edited: true };
    old.modules = { ...old.modules, encounters: false };
    old.modulesEdited = true;
    const merged = mergeEdits(parseSheet(ARCHITECT, SRC, 6), old);
    expect(merged.player.social.menace).toBe(4);
    expect(merged.modules.encounters).toBe(false);
  });
});

describe("contests from a card", () => {
  const sheet = parseSheet(ARCHITECT, SRC, 5);

  test("framing gives the shape; code gives the size", () => {
    const frame = parseFrame({ kind: "haggle", stake: "passage upriver", stake_size: 3, price: 200, unit: "marks", opening: "Half your cut." }, sheet, "ilse_varga");
    const c = contestFrom(frame, sheet.cast[0]!, sheet.skin.currency);
    expect(c).toMatchObject({ kind: "haggle", start: 200, floor: 164, hardFloor: 100, unit: "marks" });
    expect(c.dc).toBe(15);
    const persuade = contestFrom({ ...frame, kind: "persuade" }, sheet.cast[0]!, "");
    expect(persuade).toMatchObject({ track: "resistance", start: 100, floor: 35, winAt: 0 });
  });

  test("a price they already offered can be reached, free included", () => {
    const frame = parseFrame({ kind: "haggle", stake: "a room for the night", stake_size: 1, price: 2, lowest_offer: 0, unit: "coppers" }, sheet, "ilse_varga");
    expect(contestFrom(frame, sheet.cast[0]!, "")).toMatchObject({ start: 2, floor: 0, hardFloor: 0 });
    const higher = parseFrame({ kind: "haggle", stake: "passage upriver", stake_size: 3, price: 200, lowest_offer: 190 }, sheet, "ilse_varga");
    expect(contestFrom(higher, sheet.cast[0]!, "")).toMatchObject({ floor: 164, hardFloor: 100 });
  });

  test("a price named in another coin is counted in the purse's currency", () => {
    const frame = parseFrame({ kind: "haggle", stake: "a room for the night", stake_size: 1, price: 20, lowest_offer: 2, unit: "coppers" }, sheet, "ilse_varga");
    expect(contestFrom(frame, sheet.cast[0]!, "silver")).toMatchObject({ unit: "silver", start: 2, floor: 1 });
    expect(contestFrom({ ...frame, price: 3, unit: "gold crowns" }, sheet.cast[0]!, "silver")).toMatchObject({ start: 30 });
    expect(contestFrom({ ...frame, unit: "marks" }, sheet.cast[0]!, "silver")).toMatchObject({ unit: "silver", start: 20 });
  });

  test("no talk starts out unwinnable: a wall is never higher than the facts on that person can take down", () => {
    const ilse = sheet.cast[0]!.id;
    const frame = (size: 1 | 2 | 3 | 4) => parseFrame({ kind: "persuade", stake: "passage upriver", stake_size: size }, sheet, ilse);
    // A small or real ask has no wall.
    for (const size of [1, 2] as const) expect(scenarioFromSheet(sheet, frame(size), "c", "x", [])!.contest.floor).toBe(0);
    // A big one has, while there's something on them that opens it.
    expect(scenarioFromSheet(sheet, frame(3), "c", "x", [])!.contest.floor).toBe(35);
    const none = { ...sheet, facts: sheet.facts.filter((f) => !f.about.includes(ilse)) };
    expect(scenarioFromSheet(none, frame(4), "c", "x", [])!.contest.floor).toBe(0);
    const one = { ...sheet, facts: [{ ...sheet.facts.find((f) => f.id === "fines")! }] };
    const sc = scenarioFromSheet(one, frame(4), "c", "x", ["fines"])!;
    expect(sc.contest.floor).toBe(20);
    const after = applyExchange(sc, createParley(sc, "open", "c"), "The guild fined you twice this month.", { tactic: "logic", tacticP: {}, fit: 2, credibility: 2, temperament: 2, asserts: { fines: 0.9 }, otherClaim: 0, by: "rules" });
    expect(after.state.floor).toBe(0);
    // A price keeps its floor whatever is known.
    expect(scenarioFromSheet(none, parseFrame({ kind: "haggle", stake: "x", stake_size: 2, price: 100 }, sheet, ilse), "c", "x", [])!.contest.floor).toBeGreaterThan(0);
  });

  test("a talk brings the facts that matter to it, not every secret on the card", () => {
    const other = sheet.cast[1]!;
    const world: SheetFact = { ...sheet.facts[0]!, id: "law", text: "Night travel is banned upriver.", claim: "night travel is banned", about: [], known: true, weight: 1 };
    const withWorld = { ...sheet, facts: [...sheet.facts, world] };
    const frame = parseFrame({ kind: "persuade", stake: "a word with the crew", stake_size: 2 }, sheet, other.id);
    const sc = scenarioFromSheet(withWorld, frame, "c", "x", ["fines"])!;
    expect(sc.facts.map((f) => f.id)).toEqual(["law"]);
    expect(sc.known).toEqual(["law"]);
    // Someone they have to do with counts.
    const tied = { ...withWorld, cast: withWorld.cast.map((c) => (c.id === other.id ? { ...c, fears: ["what Ilse will do"] } : c)) };
    expect(scenarioFromSheet(tied, frame, "c", "x", ["fines"])!.known).toContain("fines");
  });

  test("framing hears the line that started the talk, and reads a voice for someone with none", () => {
    const ilse = sheet.cast[0]!.id;
    const { user } = framePrompt(sheet, ilse, [{ name: "Narrator", content: "You pocket the map." }], "persuade", "Take me upriver and the map is yours.");
    expect(user).toContain("Take me upriver and the map is yours.");
    expect(user).toContain("not what the other side wants from them");
    expect(user).toContain("has not agreed to anything");
    expect(user).not.toContain('"voice"');
    const quiet = { ...sheet, cast: sheet.cast.map((c) => (c.id === ilse ? { ...c, voice: "" } : c)) };
    expect(framePrompt(quiet, ilse, [], "persuade").user).toContain('"voice"');
    const f = parseFrame({ kind: "persuade", stake: "a place on the boat", stake_size: 2, voice: "bright and nervous" }, quiet, ilse);
    expect(scenarioFromSheet(quiet, f, "c", "x", [])!.npc.voice).toBe("bright and nervous");
    // The card's own voice wins.
    expect(scenarioFromSheet(sheet, f, "c", "x", [])!.npc.voice).toBe("dry");
    expect(storySoFar([{ name: "A", content: "one" }, { name: "B", content: "two" }], 1)).toBe("B: two");
  });

  test("a scenario from the sheet plays through the Parley engine", () => {
    const frame = parseFrame({ kind: "haggle", stake: "passage upriver", stake_size: 2, price: 120 }, sheet, sheet.cast[0]!.id);
    const sc = scenarioFromSheet(sheet, frame, "chat1", "card:x", [])!;
    expect(sc.npc.name).toBe("Ilse Varga");
    expect(sc.speaker.stats.presence).toBe(3);
    // The player's own past, from their persona, is theirs to keep: never something to hold over someone.
    expect(sc.facts.some((f) => f.id === "aground")).toBe(false);
    expect(sc.known).not.toContain("fines");
    expect(sc.reveals).toContain("fines");
    expect(sc.card).toMatchObject({ journalKey: "chat/chat1", avatar: { imageId: "img-ilse", url: "/api/v1/images/img-ilse" } });
    expect(sc.facts.find((f) => f.id === "fines")!.floorShift).toBe(0.2);
    expect(sc.npc.stance.tells.irritated).toBe("taps her cards");
    expect(sc.npc.stance.tells.amused).toBeTruthy();
    const learned = scenarioFromSheet(sheet, frame, "chat1", "card:x", ["fines"])!;
    const read: RefereeRead = { tactic: "interest", tacticP: {}, fit: 2, credibility: 2.5, temperament: 3, asserts: { fines: 0.9 }, otherClaim: 0, by: "rules" };
    const r = applyExchange(learned, createParley(learned, "seed1", "chat1"), "The Tide Guild fined you twice this month. Take my coin.", read);
    expect(r.exchange.leverageFacts).toContain("fines");
  });

  test("fallback framing uses their last line as the opening", () => {
    const f = fallbackFrame(sheet, sheet.cast[0]!.id, [{ name: "Ilse Varga", content: "Half your cut, or swim.", isUser: false }], "haggle");
    expect(f).toMatchObject({ kind: "haggle", opening: "Half your cut, or swim.", by: "fallback" });
  });

  test("the opening is the end of a long reply, without its headings", () => {
    const long = [
      "## Response",
      "### Chapter 2: A Bargain in the Dark",
      "",
      "The goblet clicks against the nightstand. ".repeat(12).trim(),
      "",
      "---",
      "",
      "She leans back and studies you.",
      "",
      '"Half your cut," she says. "Or swim."',
    ].join("\n");
    const beat = lastBeat(long);
    expect(beat).toBe('She leans back and studies you. "Half your cut," she says. "Or swim."');
    expect(beat).not.toContain("#");
    // One paragraph longer than the limit keeps its end, cut at a word.
    const one = lastBeat("word ".repeat(200) + "the last words.", 60);
    expect(one.startsWith("…")).toBe(true);
    expect(one.endsWith("the last words.")).toBe(true);
    expect(one.length).toBeLessThanOrEqual(60);
  });
});

describe("contest chips", () => {
  const sheet = parseSheet(ARCHITECT, SRC, 5);
  const at = { chatId: "c", messageId: "m1" };
  const ch = (choice: string, probabilities: Record<string, number>): DecisionAnswer => ({ type: "choice", choice, confidence: probabilities[choice] ?? 0, probabilities });

  test("a clear contest with someone in the cast gives a chip", () => {
    const chip = chipFromAnswers(sheet, { contest: ch("haggle", { none: 0.1, haggle: 0.8, persuade: 0.1 }), target: ch(sheet.cast[0]!.id, { [sheet.cast[0]!.id]: 0.9, other: 0.1 }) }, at);
    expect(chip).toMatchObject({ kind: "haggle", castName: "Ilse Varga", label: "Haggle with Ilse Varga?" });
  });

  test("no chip for ordinary talk, unclear targets, or strangers", () => {
    expect(chipFromAnswers(sheet, { contest: ch("none", { none: 0.8, haggle: 0.2 }), target: ch("ilse_varga", { ilse_varga: 1 }) }, at)).toBeNull();
    expect(chipFromAnswers(sheet, { contest: ch("persuade", { none: 0.5, persuade: 0.5 }), target: ch("ilse_varga", { ilse_varga: 1 }) }, at)).toBeNull();
    expect(chipFromAnswers(sheet, { contest: ch("persuade", { none: 0.1, persuade: 0.9 }), target: ch("other", { other: 0.9 }) }, at)).toBeNull();
  });
});

describe("Saltgate demo card", () => {
  test("names every demo person and carries every fact as lore", async () => {
    const { DEMO_CARD, DEMO_LORE } = await import("../src/engine/content/saltgate-card.js");
    const { FACTS } = await import("../src/engine/content/parleys.js");
    for (const n of ["Marta", "Pell", "Sergeant Vey"]) expect(DEMO_CARD.description).toContain(n);
    for (const f of Object.values(FACTS)) expect(DEMO_LORE.some((e) => e.content === f.text)).toBe(true);
  });
});
