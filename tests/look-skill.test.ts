import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyUiTokens, C } from "../src/frontend/stage/theme.js";

const SCRIPT = join(import.meta.dir, "..", ".claude", "skills", "gambit-look", "scripts", "validate.ts");

function run(...files: string[]): { code: number; out: string } {
  const p = Bun.spawnSync(["bun", "run", SCRIPT, ...files], { stdout: "pipe", stderr: "pipe" });
  return { code: p.exitCode ?? 1, out: `${p.stdout.toString()}${p.stderr.toString()}` };
}

describe("the gambit-look skill's validator", () => {
  test("passes the built-in looks", () => {
    const r = run(join(import.meta.dir, "..", "looks", "ink_wash.json"), join(import.meta.dir, "..", "looks", "modern_anime.json"));
    expect(r.code).toBe(0);
    expect(r.out).toContain("✓");
  });

  test("refuses a look that asks for text, and says why", () => {
    const dir = mkdtempSync(join(tmpdir(), "gambit-look-"));
    const bad = join(dir, "bad.json");
    writeFileSync(bad, JSON.stringify({ id: "poster", label: "Poster", preferred: "gpt", nai: { positive: "poster, text, logo" }, gpt: { style: "A poster with the words BIG SALE across the top." } }));
    const r = run(bad);
    expect(r.code).toBe(1);
    expect(r.out).toContain("asks for text in the image");
  });
});

describe("palette tokens on the stage", () => {
  test("a look's tokens retint the code-drawn layer, and null puts the defaults back", () => {
    const gold = C.gold;
    applyUiTokens({ gold: "#d4a017", enemy: "#aa0000", panel: "#101820" });
    expect(C.gold).toBe(0xd4a017);
    expect(C.enemy).toBe(0xaa0000);
    expect(C.panel).toBe(0x101820);
    expect(C.goldDim).not.toBe(0xd4a017);
    applyUiTokens(null);
    expect(C.gold).toBe(gold);
  });
});
