import { describe, expect, test } from "bun:test";
import { italicLines } from "../src/backend/play.js";
import { parseAfterglow, pictureMoments } from "../src/meaning/afterglow.js";

describe("the adult scene after a fight", () => {
  test("pages are held to at most three pictures, and each picture is drawn from the pages since the last one", () => {
    const pages = Array.from({ length: 9 }, (_, i) => ({ text: `p${i}`, picture: i % 2 === 1 }));
    const scene = parseAfterglow({ title: "After", pages })!;
    expect(scene.pages.filter((p) => p.picture)).toHaveLength(3);
    expect(pictureMoments(scene)).toEqual([
      { page: 1, text: "p0\n\np1" },
      { page: 3, text: "p2\n\np3" },
      { page: 5, text: "p4\n\np5" },
    ]);
  });

  test("a scene too short is no scene; one with no picture marked gets one early", () => {
    expect(parseAfterglow({ pages: [{ text: "a" }, { text: "b" }] })).toBeNull();
    const scene = parseAfterglow({ pages: ["a", "b", "c", "d"].map((text) => ({ text })) })!;
    expect(scene.pages.map((p) => p.picture)).toEqual([false, true, false, false]);
  });
});

test("an aside is italic line by line, so lists and paragraphs keep their asterisks paired", () => {
  expect(italicLines("Meanwhile…\n\n- one\n- two")).toBe("*Meanwhile…*\n\n- *one*\n- *two*");
});
