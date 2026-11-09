import { standsOnTwoLegs } from "../src/art/specs.js";
import { describe, expect, test } from "bun:test";
import { figureCaption, hasCharacterTag, parseFigureTags, withReaderTags } from "../src/meaning/figure-tags.js";

describe("a body that isn't on two legs", () => {
  test("isn't told to stand on them", () => {
    for (const tags of ["lamia, snake lower body", "naga", "green snake tail", "centaur", "mermaid", "arachne", "slime girl"]) expect(standsOnTwoLegs(tags)).toBe(false);
    for (const tags of ["wolf ears, long hair", "tail, red skin", "fox tail", "snakeskin boots"]) expect(standsOnTwoLegs(tags)).toBe(true);
  });
});

describe("what goes in front of Inlay's reading", () => {
  test("the reader's guess at their hair or eyes doesn't, but what Inlay lacks does", () => {
    const reader = { character: "", tags: ["wolf ears", "blonde hair", "blue eyes", "slender"], sex: "girl" as const };
    expect(withReaderTags("auburn hair, brown eyes", reader)).toBe("wolf ears, slender, auburn hair, brown eyes");
    expect(withReaderTags("glasses", reader)).toBe("wolf ears, blonde hair, blue eyes, slender, glasses");
  });
});

describe("figure tags", () => {
  test("parses the character tag and appearance, lowercased, character first", () => {
    const t = parseFigureTags('Sure: {"character": "Some Hound (Some Show)", "tags": ["White fur", "wolf ears", "red eyes", "grey hoodie"], "sex": "girl"}');
    expect(t).toEqual({ character: "some hound (some show)", tags: ["white fur", "wolf ears", "red eyes", "grey hoodie"], sex: "girl" });
    expect(figureCaption(t!)).toBe("some hound (some show), white fur, wolf ears, red eyes, grey hoodie");
  });

  test("an original character has no character tag; junk is refused", () => {
    expect(parseFigureTags('{"character": "", "tags": "tall, scarred, green cloak", "sex": "x"}')).toEqual({ character: "", tags: ["tall", "scarred", "green cloak"], sex: "other" });
    expect(parseFigureTags("no json here")).toBeNull();
    expect(parseFigureTags('{"character": "", "tags": []}')).toBeNull();
  });
});

describe("withReaderTags", () => {
  const reader = { character: "wren (moorland tales)", tags: ["imp", "short", "red skin", "white freckles", "horns", "tail", "grey coat"], sex: "boy" as const };
  test("puts the reader's character tag and leading traits in front when Inlay has none", () => {
    expect(withReaderTags("red skin, curved horns, dark grey coat", reader)).toBe("wren (moorland tales), imp, short, white freckles, horns, tail, red skin, curved horns, dark grey coat");
  });
  test("leaves Inlay's caption alone when it names the character", () => {
    expect(withReaderTags("wren (moorland tales), red skin", reader)).toBe("wren (moorland tales), red skin");
    expect(hasCharacterTag("1girl, corvin (card), grey fur")).toBe(true);
    expect(hasCharacterTag("red skin, curved horns")).toBe(false);
  });
  test("no reader answer keeps Inlay's caption", () => {
    expect(withReaderTags("red skin", null)).toBe("red skin");
  });
});
