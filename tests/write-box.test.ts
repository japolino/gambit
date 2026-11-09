import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { beatsHtml, canWrite, isWriting, writeFormHtml } from "../src/frontend/scene/themes/write.js";
import { typewriterHtml } from "../src/frontend/scene/themes/typewriter.js";
import { scrollFontSize } from "../src/frontend/scene/themes/storybook/scroll-fit.js";
import type { SceneView } from "../src/frontend/scene/themes/contract.js";

const view = (over: Partial<SceneView>) => ({ story: [], ...over }) as unknown as SceneView;
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
    const html = beatsHtml([beat({ said: "I sneak past", roll: "Going unseen: failed", reply: "He turns." })]);
    expect(html.indexOf("said")).toBeLessThan(html.indexOf("roll"));
    expect(html.indexOf("roll")).toBeLessThan(html.indexOf("told"));
  });

  test("a talk or a fight that's over ends on how it came out", () => {
    const html = beatsHtml([beat({ roll: "You won the argument", reply: "They give way." })]);
    expect(html).not.toContain('class="said"');
    expect(html.indexOf("told")).toBeLessThan(html.indexOf("roll"));
  });

  test("each paragraph of a reply is its own, and what was typed stays text", () => {
    const html = beatsHtml([beat({ said: "<img src=x onerror=boom>", reply: "One.\n\nTwo." })]);
    expect(html).not.toContain("<img");
    expect(html.match(/class="told"/g)).toHaveLength(2);
  });

  test("what a line turned up comes before what's told", () => {
    const html = beatsHtml([beat({ said: "I look", found: "A key", reply: "It's cold." })]);
    expect(html.indexOf("found")).toBeLessThan(html.indexOf("told"));
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

  test("table, on a typewriter", () => {
    const src = readFileSync("src/frontend/scene/themes/table.ts", "utf8");
    expect(src).toContain("wireTypewriter(ctx,");
    expect(src).toContain("typewriterHtml(");
    expect(src).toContain("TYPEWRITER_CSS");
  });

  test("diorama, on a typewriter in both its rooms", () => {
    expect(readFileSync("src/frontend/scene/themes/diorama/shared.ts", "utf8")).toContain("typewriterHtml(");
    expect(readFileSync("src/frontend/scene/themes/diorama.ts", "utf8")).toContain("TYPEWRITER_CSS");
    for (const f of ["flat", "room3d"]) expect(readFileSync(`src/frontend/scene/themes/diorama/${f}.ts`, "utf8")).toContain("wireTypewriter(ctx,");
  });

  test("two typewriters don't share gradients: one hidden would take them with it", () => {
    const ids = (html: string) => [...html.matchAll(/id="(tw\d+)e"/g)].map((m) => m[1]);
    expect(ids(typewriterHtml("a"))).not.toEqual(ids(typewriterHtml("b")));
  });

  test("the field finds its way past the host's keys, and \"/\" finds the field", () => {
    expect(writeFormHtml("x")).toContain("data-write");
    expect(typewriterHtml("x")).toContain("data-write");
    const host = readFileSync("src/frontend/scene/view.ts", "utf8");
    // In a shadow root the window sees only the host as the target: this has to look past it.
    expect(host).toContain("e.composedPath()[0]");
    expect(host).toContain("[data-write]");
  });
});

describe("the words on the page", () => {
  test("a book's quotes open and close, a terminal's stay as typed", () => {
    const b = [beat({ said: '"I am awake," I say', reply: "" })];
    expect(beatsHtml(b)).toContain("\u201cI am awake,\u201d");
    expect(beatsHtml(b, false)).toContain("&quot;I am awake,&quot;");
  });

  test("a find the narrator already showed isn't printed twice", () => {
    expect(beatsHtml([beat({ said: "I look", found: "A hidden door.", reply: "There: a hidden door, behind the shelf." })])).not.toContain('class="found"');
    expect(beatsHtml([beat({ said: "I look", found: "A hidden door.", reply: "Dust everywhere." })])).toContain('class="found"');
  });
});

describe("the name scroll", () => {
  test("a short name keeps its size, a long one shrinks to fit the curve", () => {
    expect(scrollFontSize("Mara")).toBe(15);
    expect(scrollFontSize("Tessera Ashbourne")).toBeLessThan(10);
    // Wide capitals with their spacing take about 0.9em each; the curve is about 146 units long.
    for (const name of ["Orla Tamsin Wren", "Lord Dov of the Long Grey Tide"]) expect([...name].length * 0.9 * scrollFontSize(name)).toBeLessThanOrEqual(146);
  });
});
