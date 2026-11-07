import { describe, expect, test } from "bun:test";
import type { CardSources, SourceLore } from "../src/engine/card/types.js";
import { rankLore } from "../src/meaning/lore-pick.js";
import { cosine, ENTRY_CHARS, entryText, packVectors, quantize, semanticScores, textHash, unpackVectors } from "../src/meaning/lore-vectors.js";

const vec = (seed: number, n = 64): number[] => Array.from({ length: n }, (_, i) => Math.sin(seed * 12.9898 + i * 78.233) * 0.5);

describe("lore-vectors", () => {
  test("the entry hash is stable, 16 hex characters, and changes with the text", () => {
    const a = textHash("Floor 7\nThe Glass Garden");
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(textHash("Floor 7\nThe Glass Garden")).toBe(a);
    expect(textHash("Floor 7\nThe Glass Gardens")).not.toBe(a);
  });

  test("entry text carries the title, other keys and content, cut to ENTRY_CHARS", () => {
    expect(entryText({ title: "Mira", keys: ["Mira", "the archivist"], content: "Keeps  the\nrecords." })).toBe("Mira (the archivist)\nKeeps the records.");
    expect(entryText({ title: "x", content: "y".repeat(5000) }).length).toBe(ENTRY_CHARS);
  });

  test("8-bit vectors keep cosine close to the full-precision value", () => {
    const a = vec(1);
    const b = vec(2);
    const full = a.reduce((s, x, i) => s + x * b[i]!, 0) / Math.sqrt(a.reduce((s, x) => s + x * x, 0) * b.reduce((s, x) => s + x * x, 0));
    expect(Math.abs(cosine(a, quantize(b)) - full)).toBeLessThan(0.01);
    expect(cosine(a, quantize(a))).toBeGreaterThan(0.999);
  });

  test("a pack round-trips, and a foreign or short file reads as empty", () => {
    const m = new Map([
      [textHash("one"), quantize(vec(1))],
      [textHash("two"), quantize(vec(2))],
    ]);
    const back = unpackVectors(packVectors(m));
    expect([...back.keys()].sort()).toEqual([...m.keys()].sort());
    const h = textHash("two");
    expect(Array.from(back.get(h)!.q)).toEqual(Array.from(m.get(h)!.q));
    expect(back.get(h)!.scale).toBeCloseTo(m.get(h)!.scale, 6);
    expect(unpackVectors(new Uint8Array([1, 2, 3])).size).toBe(0);
    expect(unpackVectors(new TextEncoder().encode("not a pack at all, really")).size).toBe(0);
  });

  test("scores: the median and below are 0, the best is 1, a flat spread scores nothing", () => {
    const s = semanticScores([0.1, 0.2, 0.3, 0.4, 0.9, null]);
    expect(s[0]).toBe(0);
    expect(s[2]).toBe(0);
    expect(s[4]).toBe(1);
    expect(s[3]).toBeGreaterThan(0);
    expect(s[3]).toBeLessThan(0.1);
    expect(s[5]).toBe(0);
    expect(semanticScores([0.5, 0.51, 0.52, 0.5]).every((x) => x === 0)).toBe(true);
  });

  test("an entry close in meaning ranks above plain ones and next to a keyword hit", () => {
    const e = (title: string, extra: Partial<SourceLore> = {}): SourceLore => ({ title, content: `${title} text.`, scope: "card", ...extra });
    const src: CardSources = {
      cards: [{ id: "c", name: "Aria", description: "", personality: "", scenario: "", firstMes: "", alternateGreetings: [], mesExample: "", creatorNotes: "", tags: [], imageId: null, avatarUrl: null, updatedAt: 1 }],
      persona: { id: null, name: "Ren", title: "", description: "" },
      lore: [e("Plain"), e("Close", { semantic: 1 }), e("Named", { keys: ["Brannoc"] })],
      chat: [{ name: "Ren", isUser: true, content: "Where is Brannoc?" }],
    };
    expect(rankLore(src).map((r) => r.lore.title)).toEqual(["Close", "Named", "Plain"]);
  });
});
