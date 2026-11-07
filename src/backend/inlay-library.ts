/**
 * Reads Inlay Illustrator's character library (engine/card/inlay.ts) over the
 * shared RPC pool. Inlay is optional: when it is missing, older, or has no
 * document for a card, every read is null and Gambit uses its own face finder.
 * Reads are cached briefly; a Parley start asks for a few cards at once.
 */
import type { SpindleAPI } from "lumiverse-spindle-types";
import { inlayLookOf, inlayMemberFor, parseInlayCharacter, type InlayCharacter, type InlayLook } from "../engine/card/inlay.js";

const OWNER = "inlay_illustrator";
const TTL_MS = 60_000;
const SEGMENT = /^[a-z0-9][a-z0-9_-]*$/;

export function createInlayLibrary(spindle: SpindleAPI, log: (m: string) => void) {
  const cache = new Map<string, { at: number; value: InlayCharacter | null }>();
  let missingLogged = false;

  /** Inlay's channel is per user (`<userId>`), or `owner` for a user-scoped install. */
  async function read(userId: string, characterId: string): Promise<InlayCharacter | null> {
    const id = characterId.trim().toLowerCase();
    if (!SEGMENT.test(id) || !spindle.rpcPool?.read) return null;
    const ck = `${userId}\u0000${id}`;
    const hit = cache.get(ck);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
    const users = [userId.trim().toLowerCase(), "owner"].filter((u, i, a) => SEGMENT.test(u) && a.indexOf(u) === i);
    let value: InlayCharacter | null = null;
    let reached = false;
    const tries: { endpoint: string; result: string }[] = [];
    for (const user of users) {
      const endpoint = `${OWNER}.characters.${user}.${id}`;
      try {
        const raw = await spindle.rpcPool.read(endpoint);
        value = parseInlayCharacter(raw);
        reached = true;
        tries.push({ endpoint, result: value ? `${value.members.length} members` : raw === null ? "no document" : "unreadable value" });
        if (value) break;
      } catch (err) {
        // Not registered under this user (no Inlay, or no document for this card), or refused.
        tries.push({ endpoint, result: err instanceof Error ? err.message : String(err) });
      }
    }
    // The last lookup, for diagnosing a library that does not answer.
    void spindle.userStorage.setJson("cards/debug/inlay.json", { at: Date.now(), characterId: id, tries }, { userId }).catch(() => {});
    if (!reached && !missingLogged) {
      missingLogged = true;
      log("inlay: no character library to read (Inlay Illustrator missing, older, or without documents); using card art only");
    }
    cache.set(ck, { at: Date.now(), value });
    return value;
  }

  /** The first of `characterIds` whose Inlay document has `name`. */
  async function lookFor(userId: string, name: string, characterIds: readonly (string | undefined)[]): Promise<InlayLook | null> {
    for (const id of [...new Set(characterIds.filter((c): c is string => !!c))]) {
      const doc = await read(userId, id);
      const member = doc && inlayMemberFor(doc.members, name);
      const look = member && inlayLookOf(doc.characterId, member);
      if (look) return look;
    }
    return null;
  }

  return { read, lookFor };
}

export type InlayLibrary = ReturnType<typeof createInlayLibrary>;
