import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("a hidden scene", () => {
  test("the rule reaches the scene's own root, so a board can't sit over a fight", () => {
    const css = readFileSync(new URL("../src/frontend/scene/view.ts", import.meta.url), "utf8");
    // hide() puts .gone on .gs itself: ".gs .gone" alone only reaches what's inside it.
    expect(css).toContain('el.classList.add("gone")');
    expect(css).toMatch(/\.gs\.gone\s*\{[^}]*visibility:\s*hidden/);
  });
});
