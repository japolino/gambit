import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { beatsHtml, canWrite, isWriting, writeFormHtml } from "../src/frontend/scene/themes/write.js";
import { fitScroll } from "../src/frontend/scene/themes/storybook/scroll-fit.js";
import type { SceneView } from "../src/frontend/scene/themes/contract.js";

const view = (over: Partial<SceneView>) => ({ story: [], ...over }) as unknown as SceneView;
const NO_ONE = { cast: [], player: "" };
const beat = (over: Partial<SceneView["story"][number]>) => ({ said: "", roll: null, reply: "", ...over });

describe("where you can write", () => {
  test("in the scene, not in a delve or on the board", () => {
    expect(canWrite(view({}))).toBe(true);
    expect(canWrite(view({ delve: {} as never }))).toBe(false);
    expect(canWrite(view({ board: {} as never }))).toBe(false);
  });

  test("there's a story to read once a beat has happened, and only where you can write", () => {
    expect(isWriting(view({}))).toBe(false);
    expect(isWriting(view({ story: [beat({ said: "Hello" })] }))).toBe(true);
    expect(isWriting(view({ story: [beat({ said: "Hello" })], delve: {} as never }))).toBe(false);
  });
});

describe("the beats", () => {
  test("a line you wrote rolls first", () => {
    const html = beatsHtml([beat({ said: "I sneak past", roll: "Going unseen: failed", reply: "He turns." })], NO_ONE);
    expect(html.indexOf("said")).toBeLessThan(html.indexOf("roll"));
    expect(html.indexOf("roll")).toBeLessThan(html.indexOf("told"));
  });

  test("a talk or a fight that's over ends on how it came out", () => {
    const html = beatsHtml([beat({ roll: "You won the argument", reply: "They give way." })], NO_ONE);
    expect(html).not.toContain('class="said"');
    expect(html.indexOf("told")).toBeLessThan(html.indexOf("roll"));
  });

  test("each paragraph of a reply is its own, and what was typed stays text", () => {
    const html = beatsHtml([beat({ said: "<img src=x onerror=boom>", reply: "One.\n\nTwo." })], NO_ONE);
    expect(html).not.toContain("<img");
    expect(html.match(/class="told"/g)).toHaveLength(2);
  });

  test("what a beat turned up is its last line, under the reply and the roll", () => {
    const html = beatsHtml([beat({ said: "I look", found: "A key", reply: "It's cold." })], NO_ONE);
    expect(html.indexOf("told")).toBeLessThan(html.indexOf("found"));
    const talk = beatsHtml([beat({ roll: "Talking with Mara: won over", found: "Mara lets it out", reply: "She sighs." })], NO_ONE);
    expect(talk.indexOf('class="roll"')).toBeLessThan(talk.indexOf('class="found"'));
    expect(talk.indexOf('class="told"')).toBeLessThan(talk.indexOf('class="roll"'));
  });
});

describe("every theme offers it", () => {
  const themes = ["storybook", "lobby", "command", "onebit"];
  for (const id of themes) {
    test(id, () => {
      const src = readFileSync(`src/frontend/scene/themes/${id}.ts`, "utf8");
      expect(src).toContain("wireWrite(ctx,");
      expect(src).toContain("writeFormHtml(");
    });
  }




  test("the field finds its way past the host's keys, and \"/\" finds the field", () => {
    expect(writeFormHtml("x")).toContain("data-write");
    const host = readFileSync("src/frontend/scene/view.ts", "utf8");
    // In a shadow root the window sees only the host as the target: this has to look past it.
    expect(host).toContain("e.composedPath()[0]");
    expect(host).toContain("[data-write]");
  });
});

describe("the words on the page", () => {
  test("a book's quotes open and close, a terminal's stay as typed", () => {
    const b = [beat({ said: '"I am awake," I say', reply: "" })];
    expect(beatsHtml(b, NO_ONE)).toContain("\u201cI am awake,\u201d");
    expect(beatsHtml(b, NO_ONE, false)).toContain("&quot;I am awake,&quot;");
  });

  test("a find the narrator already showed isn't printed twice", () => {
    expect(beatsHtml([beat({ said: "I look", found: "A hidden door.", reply: "There: a hidden door, behind the shelf." })], NO_ONE)).not.toContain('class="found"');
    expect(beatsHtml([beat({ said: "I look", found: "A hidden door.", reply: "Dust everywhere." })], NO_ONE)).toContain('class="found"');
  });
});

describe("the name scroll", () => {
  test("a short name keeps its size, a long one shrinks to fit the curve", () => {
    expect(fitScroll("Mara")).toEqual({ label: "Mara", size: 15 });
    expect(fitScroll("Brother Tam Wicks").label).toBe("Brother Tam Wicks");
    expect(fitScroll("Brother Tam Wicks").size).toBeLessThan(11);
    // The widest capitals with their spacing take 1.14em; the curve is about 146 units long.
    expect(fitScroll("WWWWWWWWWWWW").size * 12 * 1.14).toBeLessThanOrEqual(146);
  });

  test("a name too long to read whole loses words from its end, not mid-word", () => {
    expect(fitScroll("Captain Hollis Ashworth").label).toBe("Captain Hollis");
    expect(fitScroll("Lord Dov of the Long Grey Tide").label).toBe("Lord Dov");
    expect(fitScroll("Bartholomewsworthingtonshire").label).toBe("Bartholomewsworthingtonshire");
  });
});
