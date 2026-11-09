import { describe, expect, test } from "bun:test";
import type { CardSheet, CardSources, SourceLore } from "../src/engine/card/types.js";
import { boardLore } from "../src/meaning/board-deck.js";

const ev = { source: "card" as const, quote: "", verified: true };
const person = (id: string, main = false) => ({ id, name: id[0]!.toUpperCase() + id.slice(1), role: "a regular", look: "tall", main, pronoun: "she" as const, evidence: ev });
const fact = (id: string, weight: 1 | 2 | 3, known = false) => ({ id, text: `${id} is true.`, claim: `About ${id}`, about: [], weight, keywords: [], known, evidence: ev });
const sheet = {
  cast: [person("mara", true), person("tobin"), person("ysolde")],
  facts: [fact("debt", 1), fact("murder", 3), fact("old", 2, true)],
} as unknown as Pick<CardSheet, "facts" | "cast">;
const entry = (title: string, extra: Partial<SourceLore> = {}): SourceLore => ({ title, content: `${title} content.`, scope: "card", ...extra });
const sources = (lore: SourceLore[]): CardSources => ({
  cards: [{ id: "c", name: "Mara", description: "", personality: "", scenario: "", firstMes: "", alternateGreetings: [], mesExample: "", creatorNotes: "", tags: [], imageId: null, avatarUrl: null, updatedAt: 1 }],
  persona: { id: null, name: "Wren", title: "", description: "" },
  lore,
  chat: [],
});

describe("board deck", () => {
  test("deals unknown facts, unmet people, the next revelation and lorebook entries in turn", () => {
    const out = boardLore({ sheet, sources: sources([entry("Harbor", { constant: true }), entry("Fog"), entry("Bell")]), met: new Set(["tobin"]), spent: new Set(), revelation: { id: "r1", text: "The bell rings for the dead." }, room: 6 });
    expect(out.map((c) => c.kind)).toEqual(["thread", "fact", "person", "entry", "fact", "entry"]);
    expect(out[0]!.stars).toBe(3);
    // The damning fact comes first, and goes three deep; a minor one goes one deep.
    expect(out[1]).toMatchObject({ ref: "murder", stars: 3 });
    expect(out[4]).toMatchObject({ ref: "debt", stars: 1 });
    // The main character and people already met are not dealt; known facts aren't either.
    expect(out.some((c) => c.ref === "mara" || c.ref === "tobin" || c.ref === "old")).toBe(false);
    // The always-on entry ranks first and goes deepest.
    expect(out[3]).toMatchObject({ title: "Harbor", stars: 3 });
  });

  test("the card's machinery is never dealt as lore: image lists, rules for the model, rulesets, empty folders", () => {
    const lore = [
      entry("💠Eralith💠", { constant: true, content: "### Eralith's Image List\n\nThis image must be printed in Character image slot, According to Eralith's situation.\n\nEralith_smile.png" }),
      entry("Skill", { content: "# Skill information\n\nWhen a character activates a skill, write a Skill Activation popup using this exact format:\n\n<Skill: name | Cost: cost>" }),
      entry("Choice mode", { content: "- Show the options only once per response at the end of response." }),
      entry("DK_SYS_Cont", { content: "(OOC — your previous reply stopped before the scene was finished.) Pick up exactly where it stopped." }),
      entry("warp-ruleset · world", { content: "locations:\n  inn:\n    name: The Crooked Lantern\n    exits: [road]\n  road:\n    name: The Road" }),
      entry("🏞WORLD🏞", { content: "" }),
      entry("🏰 Valeria Kingdom", { content: "### Valeria info\n\nName of place: Valeria Kingdom.\n\n**Valeria** is a majestic land, nestled amidst lush green valleys." }),
    ];
    const out = boardLore({ sheet: { cast: [], facts: [] }, sources: sources(lore), met: new Set(), spent: new Set(), room: 10 });
    expect(out.map((c) => c.title)).toEqual(["🏰 Valeria Kingdom"]);
    expect(out[0]!.text).toBe("Name of place: Valeria Kingdom. Valeria is a majestic land, nestled amidst lush green valleys.");
  });

  test("lore opened on earlier boards is held back while fresh lore is left", () => {
    const first = boardLore({ sheet, sources: null, met: new Set(), spent: new Set(), room: 10 });
    const spent = new Set(first.slice(0, 2).map((c) => c.id));
    const next = boardLore({ sheet, sources: null, met: new Set(), spent, room: 10 });
    expect(next.some((c) => spent.has(c.id))).toBe(false);
  });

  test("facts found by searching count as known", () => {
    const out = boardLore({ sheet, sources: null, met: new Set(), spent: new Set(), found: ["murder"], room: 10 });
    expect(out.some((c) => c.ref === "murder")).toBe(false);
  });

  test("a small world deals its best lorebook entries again rather than leave the board bare", () => {
    const s = sources([entry("Harbor"), entry("Fog")]);
    const all = boardLore({ sheet, sources: s, met: new Set(), spent: new Set(), room: 10 });
    const entryIds = all.filter((c) => c.kind === "entry").map((c) => c.id);
    const again = boardLore({ sheet: { cast: [], facts: [] }, sources: s, met: new Set(), spent: new Set(entryIds), room: 2 });
    expect(again.length).toBe(2);
    expect(boardLore({ sheet, sources: s, met: new Set(), spent: new Set(), room: 3 }).length).toBe(3);
  });
});
