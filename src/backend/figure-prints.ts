/**
 * A card person's figure follows their tags (docs/DESIGN.md 5.3a): the tags a
 * figure was drawn from are kept as a print, per user, in
 * `art/figure-prints.json`. Asking for a figure whose tags changed (Inlay
 * profiled them, the reader added their character tag) forgets the old one and
 * draws it again. A figure drawn before prints were kept is adopted as it is.
 * Scenes (play.ts) and Parley (parleys.ts) both ask through here.
 */
import type { SpindleAPI } from "lumiverse-spindle-types";
import type { ArtApi } from "../art/controller.js";
import type { CharacterDNA } from "../art/specs.js";

const PRINTS = "art/figure-prints.json";

export const figurePrint = (c: CharacterDNA): string =>
  ([...`${c.sex ?? ""}|${c.booru ?? c.tags}`].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261) >>> 0).toString(36);

/** What to do with a figure: draw it, keep it, adopt it (record the print), or draw it again. */
export function figureMove(ready: boolean, drawnWith: string | undefined, now: string): "draw" | "keep" | "adopt" | "redraw" {
  if (!ready) return "draw";
  if (drawnWith === undefined) return "adopt";
  return drawnWith === now ? "keep" : "redraw";
}

export interface FigurePrints {
  /** Ask for this figure from these tags: drawn, kept, or drawn again when its tags changed. Resolves once asked. */
  request(userId: string, key: string, character: CharacterDNA, priority: 0 | 1 | 2, log?: (m: string) => void): Promise<void>;
}

// One cache for the backend: scenes and Parley each make their own FigurePrints over the same file.
const mem = new Map<string, Promise<Record<string, string>>>();
let writing = Promise.resolve();

export function createFigurePrints(spindle: Pick<SpindleAPI, "userStorage">, art: Pick<ArtApi, "status" | "request" | "forget">): FigurePrints {
  const prints = (userId: string) => {
    let p = mem.get(userId);
    if (!p) mem.set(userId, (p = spindle.userStorage.getJson<Record<string, string>>(PRINTS, { fallback: {}, userId }).catch(() => ({}))));
    return p;
  };
  const save = (userId: string, key: string, print: string) =>
    (writing = writing.then(async () => {
      const all = await prints(userId);
      all[key] = print;
      await spindle.userStorage.setJson(PRINTS, all, { userId }).catch(() => {});
    }));
  return {
    async request(userId, key, character, priority, log) {
      const ready = art.status(key, userId)?.state === "ready";
      const now = figurePrint(character);
      const move = figureMove(ready, (await prints(userId))[key], now);
      if (move === "keep") return;
      if (move === "adopt") return save(userId, key, now);
      if (move === "redraw") {
        log?.(`figure ${key}: tags changed, drawing it again`);
        await art.forget(key, userId);
      }
      await save(userId, key, now);
      art.request(key, { kind: "figure", character }, priority, userId);
    },
  };
}
