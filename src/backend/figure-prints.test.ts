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
    expect(calls).toEqual(["forget k", "forget k#action", "forget k#determined", "request k"]);
    expect((files["art/figure-prints.json"] as Record<string, string>).k).toBe(figurePrint(dna("new")));
  });

  describe("drawn by Inlay, in a chat", () => {
    const via = { chatId: "chat-1", role: "a clerk" };
    const set = (stored: Record<string, string>, opts: { ready?: boolean; picture?: boolean; uncut?: boolean } = {}) => {
      const files: Record<string, unknown> = { "art/figure-prints.json": stored };
      const calls: string[] = [];
      let ready = opts.ready ?? false;
      const spindle = { userStorage: { getJson: async (p: string) => files[p] ?? {}, setJson: async (p: string, v: unknown) => void (files[p] = v) } } as never;
      const art = {
        status: () => (ready ? { key: "k", state: "ready" as const, ...(opts.uncut ? { via: "inlay", cutout: false, imageId: "i", url: "/i" } : {}) } : null),
        request: (key: string) => (calls.push(`draw ${key}`), { key, state: "queued" as const }),
        forget: async (key: string) => void (calls.push(`forget ${key}`), key === "k" && (ready = false)),
        adopt: async (key: string, _p: unknown, _u: string, cut?: boolean) => void (calls.push(`adopt ${key}${cut ? " cut" : ""}`), (ready = true)),
      } as never;
      const pictures = {
        request: async (_u: string, r: { direction: string; text: string }) => (calls.push(`ask ${r.direction}: ${r.text}`), opts.picture === false ? null : { imageId: "i", url: "/i" }),
        forget: async () => {},
      } as never;
      return { files, calls, prints: createFigurePrints(spindle, art, pictures), kept: () => (files["art/figure-prints.json"] as Record<string, string>).k };
    };
    let n = 0;
    const user = () => `u-inlay-${++n}`;

    test("Inlay draws it, in whatever body their profile gives them", async () => {
      const t = set({});
      await t.prints.request(user(), "k", dna("snake lower body"), 1, undefined, via);
      expect(t.calls).toEqual(["ask figure: Wren, a clerk, alone, the whole of their body in view, facing the viewer.", "adopt k cut"]);
      expect(t.calls.join()).not.toContain("stand");
    });

    test("once drawn it's kept, with or without a chat to ask in", async () => {
      const print = `inlay:${figurePrint(dna("a"))}`;
      for (const v of [via, undefined]) {
        const t = set({ k: print }, { ready: true });
        await t.prints.request(user(), "k", dna("a"), 1, undefined, v);
        expect(t.calls).toEqual([]);
      }
    });

    test("Inlay's figure still on its white ground is cut out, once a run", async () => {
      const u = user();
      const t = set({ k: `inlay:${figurePrint(dna("a"))}` }, { ready: true, uncut: true });
      await t.prints.request(u, "k", dna("a"), 1, undefined, via);
      await t.prints.request(u, "k", dna("a"), 1);
      expect(t.calls).toEqual(["adopt k cut"]);
    });

    test("a figure Gambit drew stays up until Inlay's picture is in", async () => {
      const t = set({ k: figurePrint(dna("a")) }, { ready: true });
      await t.prints.request(user(), "k", dna("a"), 1, undefined, via);
      expect(t.calls[0]).toStartWith("ask figure");
      expect(t.calls[1]).toBe("adopt k cut");
      expect(t.calls).not.toContain("draw k");
      expect(t.kept()).toBe(`inlay:${figurePrint(dna("a"))}`);
    });

    test("when Inlay can't, Gambit draws it, and asks Inlay once more next run only", async () => {
      const u = user();
      const t = set({}, { picture: false });
      await t.prints.request(u, "k", dna("a"), 1, undefined, via);
      expect(t.calls.at(-1)).toBe("draw k");
      expect(t.kept()).toBe(`gambit:${figurePrint(dna("a"))}`);
      const later = set({ k: `gambit:${figurePrint(dna("a"))}` }, { ready: true, picture: false });
      await later.prints.request(u, "k", dna("a"), 1, undefined, via);
      await later.prints.request(u, "k", dna("a"), 1, undefined, via);
      expect(later.calls.filter((c) => c.startsWith("ask"))).toHaveLength(1);
      expect(later.calls).not.toContain("forget k");
    });

    test("what was drawn from a figure knows when the figure changes", async () => {
      const t = set({});
      const u = user();
      expect(await t.prints.movedOn(u, "npc", "a")).toBe(true);
      expect(await t.prints.movedOn(u, "npc", "a")).toBe(false);
      expect(await t.prints.movedOn(u, "npc", "b")).toBe(true);
    });
  });
});
