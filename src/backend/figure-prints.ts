/**
 * A card person's figure follows their tags (docs/DESIGN.md 5.3a): the tags a
 * figure was drawn from are kept as a print, per user, in
 * `art/figure-prints.json`. Asking for a figure whose tags changed (Inlay
 * profiled them, the reader added their character tag) forgets the old one and
 * draws it again. A figure drawn before prints were kept is adopted as it is.
 * Scenes (play.ts) and Parley (parleys.ts) both ask through here.
 */
import { actionArtKey, cutinArtKey } from "../shared/art-keys.js";
import { figureRequestText, type InlayPictures } from "./inlay-pictures.js";
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
  request(userId: string, key: string, character: CharacterDNA, priority: 0 | 1 | 2, log?: (m: string) => void, via?: FigureVia): Promise<void>;
  /** Is this a different picture from the one these (a person's moods, say) were last drawn from? Remembers this one. */
  movedOn(userId: string, key: string, imageId: string): Promise<boolean>;
}

/** In a chat, Inlay draws it. */
export interface FigureVia {
  chatId: string;
  role: string;
}

// One cache for the backend: scenes and Parley each make their own FigurePrints over the same file.
const mem = new Map<string, Promise<Record<string, string>>>();
let writing = Promise.resolve();

export function createFigurePrints(spindle: Pick<SpindleAPI, "userStorage">, art: Pick<ArtApi, "status" | "request" | "forget"> & Partial<Pick<ArtApi, "adopt">>, pictures?: Pick<InlayPictures, "request" | "forget">): FigurePrints {
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
  const asked = new Set<string>();
  const running = new Map<string, Promise<void>>();

  /** Inlay's picture of them, under the key the tags belong to. True when it is in. */
  async function viaInlay(userId: string, key: string, character: CharacterDNA, plain: string, via: FigureVia): Promise<boolean> {
    const pic = await pictures!.request(userId, { id: `${key}#${plain}`, chatId: via.chatId, direction: "figure", text: figureRequestText(character.name, via.role) }).catch(() => null);
    if (!pic) return false;
    await art.adopt!(key, { ...pic, via: "inlay" }, userId, true);
    return true;
  }

  /** Inlay's figure as it came (adopted before figures were cut, or with no browser to cut it): cut it, once per run. */
  async function cutIfDrawn(userId: string, key: string): Promise<void> {
    const st = art.status(key, userId);
    if (st?.via !== "inlay" || st.cutout || !st.imageId || !st.url || !art.adopt || asked.has(`cut:${userId}:${key}`)) return;
    asked.add(`cut:${userId}:${key}`);
    await art.adopt(key, { imageId: st.imageId, url: st.url, via: "inlay" }, userId, true);
  }

  /** What's drawn from this figure shows their old looks once it changes. */
  async function forgetDrawnFrom(userId: string, key: string): Promise<void> {
    await Promise.all([art.forget(actionArtKey(key), userId), art.forget(cutinArtKey(key), userId), pictures?.forget(userId, actionArtKey(key))]);
  }

  async function ask(userId: string, key: string, character: CharacterDNA, priority: 0 | 1 | 2, log: ((m: string) => void) | undefined, via: FigureVia | undefined): Promise<void> {
    const ready = art.status(key, userId)?.state === "ready";
    const plain = figurePrint(character);
    const inlay = via && pictures && art.adopt ? via : undefined;
    const stored = (await prints(userId))[key];
    const now = inlay ? `inlay:${plain}` : plain;
    // Drawn by Gambit only because Inlay couldn't: once per run, see whether it can now. The figure stays up meanwhile.
    if (inlay && ready && stored === `gambit:${plain}`) {
      if (asked.has(`${userId}:${key}`)) return;
      asked.add(`${userId}:${key}`);
      if (await viaInlay(userId, key, character, plain, inlay)) {
        await save(userId, key, now);
        await forgetDrawnFrom(userId, key);
      }
      return;
    }
    // No chat to ask Inlay in: what it drew from these same tags still stands.
    if (!inlay && (stored === `inlay:${plain}` || stored === `gambit:${plain}`)) return cutIfDrawn(userId, key);
    const move = figureMove(ready, stored, now);
    if (move === "keep") return cutIfDrawn(userId, key);
    if (move === "adopt" && !inlay) return save(userId, key, now);
    const again = move !== "draw";
    if (again) log?.(`figure ${key}: ${stored?.endsWith(plain) ? "Inlay can draw it now" : "tags changed"}, drawing it again`);
    if (inlay && (await viaInlay(userId, key, character, plain, inlay))) {
      await save(userId, key, now);
      if (again) await forgetDrawnFrom(userId, key);
      return;
    }
    if (again) {
      await art.forget(key, userId);
      await forgetDrawnFrom(userId, key);
    }
    await save(userId, key, inlay ? `gambit:${plain}` : now);
    art.request(key, { kind: "figure", character }, priority, userId);
  }

  return {
    async movedOn(userId, key, imageId) {
      const k = `from:${key}`;
      if ((await prints(userId))[k] === imageId) return false;
      await save(userId, k, imageId);
      return true;
    },
    request(userId, key, character, priority, log, via) {
      const k = `${userId}:${key}`;
      const on = running.get(k);
      if (on) return on;
      const job = ask(userId, key, character, priority, log, via).finally(() => running.delete(k));
      running.set(k, job);
      return job;
    },
  };
}
