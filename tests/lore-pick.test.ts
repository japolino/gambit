import { describe, expect, test } from "bun:test";
import type { CardSources, SourceLore } from "../src/engine/card/types.js";
import { hits, loreAbout, loreText, rankLore } from "../src/meaning/lore-pick.js";
import { readerPrompts, sourcesText } from "../src/meaning/card-reader.js";

const card = (description: string): CardSources["cards"][number] => ({
  id: "c1",
  name: "Aria",
  description,
  personality: "",
  scenario: "",
  firstMes: "",
  alternateGreetings: [],
  mesExample: "",
  creatorNotes: "",
  tags: [],
  imageId: null,
  avatarUrl: null,
  updatedAt: 1,
});

const src = (lore: SourceLore[], chat = "", description = "Aria guards the gate of the Spire."): CardSources => ({
  cards: [card(description)],
  persona: { id: null, name: "Ren", title: "", description: "A climber from another world." },
  lore,
  chat: chat ? [{ name: "Ren", isUser: true, content: chat }] : [],
});

const entry = (title: string, extra: Partial<SourceLore> = {}): SourceLore => ({ title, content: `${title} is someone in this world. `.repeat(20), scope: "card", ...extra });

/** A lorebook far bigger than the read: 150 people. */
const big = Array.from({ length: 150 }, (_, i) => entry(`Person${String(i).padStart(3, "0")}`, { keys: [`Person${String(i).padStart(3, "0")}`] }));

describe("lore-pick", () => {
  test("ranks active, then always-on, then the chat, the card and the persona, then book order", () => {
    const lore = [entry("Plain"), entry("Persona", { keys: ["climber"] }), entry("Card", { keys: ["Spire"] }), entry("Chat", { keys: ["Brannoc"] }), entry("Always", { constant: true }), entry("Live", { active: true })];
    const order = rankLore(src(lore, "We should ask Brannoc.")).map((r) => r.lore.title);
    expect(order).toEqual(["Live", "Always", "Chat", "Card", "Persona", "Plain"]);
  });

  test("a global book only ranks up when the chat uses it", () => {
    const lore = [entry("Global", { scope: "global" }), entry("Local")];
    expect(rankLore(src(lore)).map((r) => r.lore.title)).toEqual(["Local", "Global"]);
    const used = [entry("Global", { scope: "global", keys: ["Mira"] }), entry("Local")];
    expect(rankLore(src(used, "Mira waves.")).map((r) => r.lore.title)[0]).toBe("Global");
  });

  test("keys match whole words, and CJK keys match inside text", () => {
    expect(hits(["Kai"], "Kaiser waves.")).toBe(0);
    expect(hits(["Kai"], "Kai waves.")).toBe(1);
    expect(hits(["東京"], "彼女は東京に住んでいる。")).toBe(1);
  });

  test("a big lorebook: the chat's people are read in full, more as excerpts, the rest by name, all in the room", () => {
    const s = src(big, "Person140 and Person149 are waiting at the gate.");
    const room = 20_000;
    const out = loreText(s, room);
    expect(out.text.length).toBeLessThanOrEqual(room);
    expect(out.full).toBeGreaterThan(5);
    expect(out.brief).toBeGreaterThan(10);
    expect(out.named).toBeGreaterThan(20);
    // The two people the chat names come first, read in full.
    expect(out.text.indexOf("[LORE: Person140]")).toBeGreaterThanOrEqual(0);
    expect(out.text.indexOf("[LORE: Person149]")).toBeGreaterThanOrEqual(0);
    expect(out.text).toContain("[ALSO IN THE LOREBOOK");
    // Nobody is read twice.
    expect(out.text.split("Person140]").length).toBe(2);
  });

  test("the reader's sources stay within budget and keep the card first", () => {
    const text = sourcesText(src(big, "Person010 nods."));
    expect(text.length).toBeLessThanOrEqual(30_001);
    expect(text.startsWith("[CARD: Aria]")).toBe(true);
    expect(text).toContain("[LORE: Person010]");
    expect(readerPrompts(src(big)).world.user).toContain("up to 11 people");
  });

  test("a small lorebook is read whole", () => {
    const out = loreText(src([entry("Brannoc"), entry("Mira")]), 20_000);
    expect(out.full).toBe(2);
    expect(out.brief + out.named).toBe(0);
  });

  test("loreAbout finds a name by title, key or first name", () => {
    const lore = [entry("Brannoc the Smith"), { ...entry("Floor 7"), keys: ["The Glass Garden"] }, entry("Mira")];
    expect(loreAbout(lore, "Brannoc")).toContain("Brannoc the Smith is");
    expect(loreAbout(lore, "the glass garden")).toContain("Floor 7 is");
    expect(loreAbout(lore, "Mira")).toContain("Mira is");
    expect(loreAbout(lore, "Nobody")).toBe("");
  });
});
