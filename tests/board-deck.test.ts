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
