import { describe, expect, test } from "bun:test";
import { italicLines } from "../src/backend/play.js";
import { withSuffix } from "../src/backend/suffix.js";
import { pictureMoments, pictureText, scenePages, withPictures } from "../src/meaning/afterglow.js";
import { fillNote, noteText } from "../src/meaning/notes.js";

const para = (i: number) => `Paragraph ${i} ${"word ".repeat(30).trim()}.`;

describe("the adult scene after a fight", () => {
  test("a reply becomes pages, short paragraphs joined, with pictures at the ends of its thirds", () => {
    const reply = [para(1), "A short line.", para(2), para(3), para(4), para(5), para(6)].join("\n\n");
    const pages = scenePages(reply);
    expect(pages).toHaveLength(6);
    expect(pages[1]!.text.startsWith("A short line. Paragraph 2")).toBe(true);
    expect(pages.map((p) => p.picture)).toEqual([false, true, false, true, false, true]);
    expect(pictureMoments(pages).map((m) => m.page)).toEqual([1, 3, 5]);
    expect(pictureMoments(pages)[0]!.text).toBe(`${pages[0]!.text}\n\n${pages[1]!.text}`);
  });

  test("a preset's headings and markdown emphasis don't reach the pages", () => {
    const pages = scenePages(`## Response\n\n### Chapter 1: The Claim\n\n${para(1)} *"Mine,"* she says.`);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.text.startsWith("Paragraph 1")).toBe(true);
    expect(pages[0]!.text.endsWith('"Mine," she says.')).toBe(true);
  });

  test("pictures go into the reply after the paragraph their page ends with, and nothing else in it changes", () => {
    const reply = `## Response\n\n${para(1)}\n\nShort.\n \n${para(2)}`;
    const pages = scenePages(reply);
    const out = withPictures(reply, pages, [{ page: 0, url: "/a.png", alt: "One [1/2]" }, { page: 1, url: "/b.png", alt: "Two" }]);
    expect(out).toBe(`## Response\n\n${para(1)}\n\n![One  1/2 ](/a.png)\n\nShort.\n \n${para(2)}\n\n![Two](/b.png)`);
  });

  test("a picture's text says who and where first, and a long moment loses its start, not its end", () => {
    const who = "Rook and Tobin, at Hollowfang Wood.";
    expect(pictureText(who, "She grins.")).toBe(`${who}\n\nShe grins.`);
    const long = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(para).join("\n\n");
    const text = pictureText(who, long);
    expect(text.length).toBeLessThanOrEqual(1900);
    expect(text.startsWith(`${who}\n\n`)).toBe(true);
    expect(text.endsWith(para(12))).toBe(true);
    expect(text).not.toContain(para(1));
  });

  test("a short reply gets one picture, at its end", () => {
    expect(scenePages("Just this.").map((p) => p.picture)).toEqual([true]);
  });

  test("the notes are templates: the user's edit wins, and a line for a missing look goes", () => {
    const def = fillNote(noteText("scene.win.note", {}), { player: "Tobin", partner: "Rook" });
    expect(def).toContain("Tobin won the fight against Rook");
    expect(def).not.toContain("{{");
    expect(def).not.toContain("looks like this");
    expect(fillNote(noteText("scene.loss.line", { "scene.loss.line": "*{{partner}} pins {{player}}.*" }), { player: "Tobin", partner: "Rook" })).toBe("*Rook pins Tobin.*");
    expect(fillNote("{{look}}", { player: "", partner: "a wolf girl", look: "grey fur" })).toBe("a wolf girl looks like this: grey fur.");
  });
});

test("Gambit's notes go at the prompt's very end, before a preset's prefill", () => {
  const note = { role: "system" as const, content: "note" };
  expect(withSuffix([{ role: "user", content: "hi" }], note).at(-1)).toBe(note);
  const out = withSuffix([{ role: "user", content: "hi" }, { role: "assistant", content: "Sure,", partial: true } as never], note);
  expect(out.map((m) => m.content)).toEqual(["hi", "note", "Sure,"]);
});

test("an aside is italic line by line, so lists and paragraphs keep their asterisks paired", () => {
  expect(italicLines("Meanwhile…\n\n- one\n- two")).toBe("*Meanwhile…*\n\n- *one*\n- *two*");
});
