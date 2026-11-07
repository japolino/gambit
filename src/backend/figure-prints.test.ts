import { describe, expect, test } from "bun:test";
import { createFigurePrints, figureMove, figurePrint } from "./figure-prints.js";
import type { CharacterDNA } from "../art/specs.js";

const dna = (booru: string): CharacterDNA => ({ id: "wren", name: "Wren", tags: "red skin", description: "", seed: 1, sex: "boy", palette: "", booru }) as CharacterDNA;

describe("figure prints", () => {
  test("the move: draw, adopt, keep, or draw again", () => {
    expect(figureMove(false, undefined, "a")).toBe("draw");
    expect(figureMove(true, undefined, "a")).toBe("adopt");
    expect(figureMove(true, "a", "a")).toBe("keep");
    expect(figureMove(true, "a", "b")).toBe("redraw");
  });
  test("the print follows the tags", () => {
    expect(figurePrint(dna("imp, red skin"))).toBe(figurePrint(dna("imp, red skin")));
    expect(figurePrint(dna("imp, red skin"))).not.toBe(figurePrint(dna("wren (moorland tales), imp, red skin")));
  });
  test("a ready figure whose tags changed is forgotten and asked for again", async () => {
    const files: Record<string, unknown> = { "art/figure-prints.json": { k: figurePrint(dna("old")) } };
    const calls: string[] = [];
    const spindle = {
      userStorage: {
        getJson: async (p: string) => files[p] ?? {},
        setJson: async (p: string, v: unknown) => void (files[p] = v),
      },
    } as never;
    let ready = true;
    const art = {
      status: () => (ready ? { key: "k", state: "ready" as const } : null),
      request: (key: string) => (calls.push(`request ${key}`), { key, state: "queued" as const }),
      forget: async (key: string) => void (calls.push(`forget ${key}`), (ready = false)),
    } as never;
    const prints = createFigurePrints(spindle, art);
    await prints.request("u-test-1", "k", dna("new"), 1);
    expect(calls).toEqual(["forget k", "request k"]);
    expect((files["art/figure-prints.json"] as Record<string, string>).k).toBe(figurePrint(dna("new")));
  });
});
