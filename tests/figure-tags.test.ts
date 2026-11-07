import { describe, expect, test } from "bun:test";
import { figureCaption, hasCharacterTag, parseFigureTags, withReaderTags } from "../src/meaning/figure-tags.js";

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
