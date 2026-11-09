/**
 * The name bank and the names Gambit gives (engine/card/naming.ts): drawn by the card's seed, never a repeat,
 * never a stock fantasy name, and never a change to what the card itself named.
 */
import { describe, expect, test } from "bun:test";
import { TRADITION_IDS, TRADITIONS } from "../src/engine/card/name-bank.js";
import { canonOf, drawNames, fixName, fixSkillName, inferTradition, isSlop, plainSkillName } from "../src/engine/card/naming.js";
import { nameWords } from "../src/engine/card/names.js";
import type { CardSheet, CardSources } from "../src/engine/card/types.js";
import { parseArmory } from "../src/meaning/armory.js";
import { parseSheet } from "../src/meaning/card-reader.js";
import { parseForge } from "../src/meaning/forge.js";

const all = TRADITION_IDS.flatMap((id) => {
  const t = TRADITIONS[id];
  return [...t.female, ...t.male, ...t.surnames, ...t.places];
});

describe("the name bank", () => {
  test("a dozen and more traditions, hundreds of names, none of them stock fantasy", () => {
    expect(TRADITION_IDS.length).toBeGreaterThanOrEqual(12);
    expect(all.length).toBeGreaterThanOrEqual(600);
    for (const id of TRADITION_IDS) for (const list of [TRADITIONS[id].female, TRADITIONS[id].male, TRADITIONS[id].surnames, TRADITIONS[id].places]) expect(new Set(list).size).toBe(16);
    expect(all.filter(isSlop)).toEqual([]);
  });

  test("draws are the same for the same seed, differ by seed, and never repeat", () => {
    const a = drawNames("czech", "given", "card-1:story", 8);
    expect(drawNames("czech", "given", "card-1:story", 8)).toEqual(a);
    expect(drawNames("czech", "given", "card-2:story", 8)).not.toEqual(a);
    expect(new Set(a).size).toBe(8);
    expect(a.every((n) => [...TRADITIONS.czech.female, ...TRADITIONS.czech.male].includes(n))).toBe(true);
  });

  test("a draw skips any name the sheet, the world or a text already uses, and tops up from other traditions", () => {
    const taken = ["Marta Novák", "The Inn at Lhota", "and then Ludmila said hello"];
    const drawn = drawNames("czech", "female", "s", 16, taken);
    expect(drawn).toHaveLength(16);
    const used = new Set(taken.flatMap(nameWords));
    expect(drawn.some((n) => nameWords(n).some((w) => used.has(w)))).toBe(false);
    expect(drawn.filter((n) => !TRADITIONS.czech.female.includes(n)).length).toBe(2);
  });

  test("the tradition follows the setting, then the card's own names; with neither, the default", () => {
    expect(inferTradition("Edo-period samurai drama", [])).toBe("japanese");
    expect(inferTradition("frontier fantasy", ["Václav", "Kateřina", "Ysolde"])).toBe("czech");
    expect(inferTradition("frontier fantasy", ["Zsófia Nagy"])).toBe("hungarian");
    expect(inferTradition("romance", ["Ysolde", "Rook"])).toBe("english");
  });

  test("the card read records the tradition, or code infers it", () => {
    const src: CardSources = { cards: [{ id: "c", name: "Ilona", description: "", personality: "", scenario: "", firstMes: "", alternateGreetings: [], mesExample: "", creatorNotes: "", tags: [], imageId: null, avatarUrl: null, updatedAt: 1 }], persona: { id: null, name: "", title: "", description: "" }, lore: [], chat: [] };
    expect(parseSheet({ names: "basque", cast: [] }, src, 1).names).toBe("basque");
    expect(parseSheet({ names: "elvish", skin: { genre: "puszta folk tale" }, cast: [] }, src, 1).names).toBe("hungarian");
  });
});

describe("checking a name a model gave", () => {
  const canon = canonOf("Ysolde keeps the Coiled Kettle. North lies Hollowfang Wood, where Sister Maren Voss hunts.");
  const cands = ["Lhota", "Telč", "Beroun"];

  test("the card's names stay, even ones the ban list has", () => {
    expect(fixName("Hollowfang Wood", "place", canon, cands)).toBe("Hollowfang Wood");
    expect(fixName("Voss's Chapel", "place", canon, cands)).toBe("Voss's Chapel");
  });

  test("stock words go, made-up names become a candidate, plain words and candidates stay", () => {
    expect(fixName("The Whispering Woods", "place", canon, cands)).toBe("Lhota Woods");
    expect(fixName("Shadowfen", "place", canon, cands)).toBe("Lhota");
    expect(fixName("Grimholt Keep", "place", canon, cands)).toBe("Lhota Keep");
    expect(fixName("The Moon Vale", "place", canon, cands)).toBe("Lhota Vale");
    expect(fixName("The Old Mill", "place", canon, cands)).toBe("The Old Mill");
    expect(fixName("The Tanner's Yard at Telč", "place", canon, cands)).toBe("The Tanner's Yard at Telč");
    expect(fixName("The Ember Circle", "group", canon, ["Novák"])).toBe("Novák Circle");
  });

  test("a thing keeps its words, swaps a stock person's name, and can come back empty", () => {
    expect(fixName("Vance's Locket", "thing", canon, ["Marta"])).toBe("Marta's Locket");
    expect(fixName("Bog Lurker", "thing", canon, ["Marta"])).toBe("Bog Lurker");
    expect(fixName("Ethereal Crimson Veil", "thing", canon, [])).toBe("");
  });

  test("a stock skill name becomes plain words for what it does; the card's own and plain ones stay", () => {
    const fire = [{ op: "hit" as const, element: "fire" as const, scale: "spirit" as const, power: "auto" as const }];
    expect(isSlop("Veil of Thorns")).toBe(true);
    expect(isSlop("Shield Bash")).toBe(false);
    expect(fixSkillName("Ember Requiem", fire, "all_enemies", canon)).toBe("Fire Wave");
    expect(fixSkillName("Coil and Squeeze", fire, "enemy", canon)).toBe("Coil and Squeeze");
    expect(fixSkillName("Whispering Glamour", fire, "enemy", canonOf("Her Whispering Glamour charms any man."))).toBe("Whispering Glamour");
    expect(plainSkillName(fire, "enemy", new Set(["Fire Bolt"]))).toBe("Flame Burst");
    expect(plainSkillName([{ op: "heal", power: "auto" }], "all_allies")).toBe("Group Heal");
  });
});

describe("names in the armory and the forge", () => {
  const sheet = {
    cardKey: "k", cardName: "Harrowmere", premise: "", tone: "", skin: { genre: "fantasy", currency: "", fight: "fight", stats: {} },
    player: { name: "Tobin", concept: "a deserter" }, places: [], facts: [],
    cast: [{ id: "ysolde", name: "Ysolde", role: "lamia innkeeper", look: "", voice: "", main: true }],
  } as unknown as CardSheet;
  const hit = { op: "hit", element: "physical" };

  test("kit skills and foes the card never named get plain names; the card's own stay", () => {
    const raw = {
      foes: [{ name: "Malakar the Defiler", role: "boss", quote: "" }, { name: "Shadowfen Stalker", role: "assassin" }],
      kits: [{ who: "p_ysolde", skills: [{ name: "Veil of Coils", atoms: [{ op: "status", status: "stun" }] }, { name: "Siren's Lullaby", atoms: [hit] }] }],
    };
    const a = parseArmory(raw, sheet, () => false, "Ysolde sings her Siren's Lullaby to travellers.");
    expect(a.foes[0]!.name).toMatch(/^\S+ the Defiler$/);
    expect(a.foes[0]!.name).not.toContain("Malakar");
    expect(a.foes[1]!.name).toBe("Stalker");
    expect(a.kits[0]!.skills.map((s) => s.name)).toEqual(["Stun", "Siren's Lullaby"]);
  });

  test("a forged class with a stock name gets a plain one, unless the player wrote it", () => {
    const raw = { name: "Shadow Dancer", element: "shadow", skills: [{ name: "Eclipse", atoms: [{ op: "hit", element: "shadow" }] }, { name: "Knife Throw", atoms: [hit] }, { name: "Smoke Step", atoms: [{ op: "haste_self" }] }] };
    const d = parseForge(raw, "a dancer who fights with knives")!;
    expect(d.name).toBe("Dark Mage");
    expect(d.skills.map((s) => s.name)).toEqual(["Dark Bolt", "Knife Throw", "Smoke Step"]);
    expect(parseForge(raw, "I want to be a Shadow Dancer")!.name).toBe("Shadow Dancer");
  });
});
