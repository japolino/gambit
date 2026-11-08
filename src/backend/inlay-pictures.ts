/**
 * Pictures drawn by Inlay Illustrator (inlay-illustrator src/backend/pipeline/shared-pictures.ts): Parley moments and
 * combat cut-ins go through Inlay's own chat pipeline (the chat's cast and their looks, the user's Atelier preset and
 * parser) with Inlay's Gambit guidelines ("Gambit: Parley", "Gambit: Cut-in"; the user can edit them in the Maid
 * Atelier). Gambit's own art pipeline is the fallback when Inlay is missing, older, has no chat to read, or fails.
 *
 * Shared RPC pool: Gambit publishes what it wants on its own endpoint `gambit.inlay.pictures.<user>`, then reading
 * `inlay_illustrator.pictures.<user>` makes Inlay queue them and answers each one's status. Gambit reads again until
 * the picture is ready. Finished pictures are kept per user (`art/inlay-pictures.json`) so a reloaded page gets them
 * again without a new run.
 */
import type { SpindleAPI } from "lumiverse-spindle-types";

const OWNER = "inlay_illustrator";
const SEGMENT = /^[a-z0-9][a-z0-9_-]*$/;
const STORE = "art/inlay-pictures.json";
const POLL_MS = 4000;
const GIVE_UP_MS = 8 * 60_000;
const MAX_KEPT = 300;

/** The id Inlay accepts for a key (letters, digits, `_.:-`, at most 96): Gambit's keys can hold `#` and `|`. */
export function inlayPictureId(key: string): string {
  const safe = key.replace(/[^A-Za-z0-9_.:-]/g, "_").replace(/^[^A-Za-z0-9]+/, "");
  if (safe.length <= 96) return safe;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return `${safe.slice(0, 86)}.${(h >>> 0).toString(36)}`;
}

export type InlayPictureDirection = "parley" | "cutin";
export interface InlayPictureRequest {
  /** Gambit's art key, also the request id Inlay sees. */
  id: string;
  chatId: string;
  direction: InlayPictureDirection;
  /** The moment in words: who, where, what happens. Inlay's analyzer reads it like a chat reply. */
  text: string;
}
export interface InlayPicture {
  imageId: string;
  url: string;
}
interface InlayStatus {
  status: "queued" | "running" | "ready" | "failed";
  imageId?: string;
  url?: string;
  error?: string;
}

export function createInlayPictures(spindle: SpindleAPI, log: (m: string) => void) {
  /** Per user: requests not settled yet (what the published endpoint holds). */
  const pending = new Map<string, Map<string, InlayPictureRequest>>();
  /** Per user: the user segment Inlay answered on (the user id, or "owner"). */
  const answered = new Map<string, string>();
  const waits = new Map<string, Promise<InlayPicture | null>>();
  const kept = new Map<string, Record<string, InlayPicture>>();

  async function store(userId: string): Promise<Record<string, InlayPicture>> {
    let s = kept.get(userId);
    if (!s) {
      s = (await spindle.userStorage.getJson<Record<string, InlayPicture>>(STORE, { fallback: {}, userId }).catch(() => ({}))) ?? {};
      kept.set(userId, s);
    }
    return s;
  }

  async function remember(userId: string, key: string, pic: InlayPicture): Promise<void> {
    const s = await store(userId);
    delete s[key];
    s[key] = pic;
    const keys = Object.keys(s);
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_KEPT))) delete s[k];
    await spindle.userStorage.setJson(STORE, s, { userId }).catch(() => {});
  }

  /** A picture Inlay already made for this key, or null. */
  async function known(userId: string, key: string): Promise<InlayPicture | null> {
    return (await store(userId))[key] ?? null;
  }

  function users(userId: string): string[] {
    const first = answered.get(userId);
    const all = [userId.trim().toLowerCase(), "owner"].filter((u, i, a) => SEGMENT.test(u) && a.indexOf(u) === i);
    return first ? [first, ...all.filter((u) => u !== first)] : all;
  }

  /** Publish the pending list and read Inlay's answer; null when Inlay does not answer at all. */
  async function exchange(userId: string): Promise<Record<string, InlayStatus> | null> {
    if (!spindle.rpcPool?.read || !spindle.rpcPool.sync) return null;
    const pictures = [...(pending.get(userId)?.values() ?? [])];
    const tries: { user: string; result: unknown }[] = [];
    try {
      for (const user of users(userId)) {
        try {
          spindle.rpcPool.sync(`inlay.pictures.${user}`, { version: 1, pictures }, { requires: ["characters"] });
          const answer = (await spindle.rpcPool.read(`${OWNER}.pictures.${user}`)) as { version?: number; pictures?: Record<string, InlayStatus> } | null;
          tries.push({ user, result: answer });
          if (answer?.version === 1 && answer.pictures) {
            answered.set(userId, user);
            return answer.pictures;
          }
        } catch (err) {
          // No pictures endpoint for this user segment (Inlay missing, older, or not started).
          tries.push({ user, result: err instanceof Error ? err.message : String(err) });
        }
      }
      return null;
    } finally {
      // The last exchange, for diagnosing an Inlay that does not answer.
      void spindle.userStorage.setJson("cards/debug/inlay-pictures.json", { at: Date.now(), asked: pictures.map((p) => p.id), tries }, { userId }).catch(() => {});
    }
  }

  /**
   * Ask Inlay for a picture and wait for it. Null when Inlay cannot make it (missing, older, failed, too slow): the
   * caller draws it itself.
   */
  function request(userId: string, req: InlayPictureRequest): Promise<InlayPicture | null> {
    const wk = `${userId}\u0000${req.id}`;
    const running = waits.get(wk);
    if (running) return running;
    const wait = (async (): Promise<InlayPicture | null> => {
      const have = await known(userId, req.id);
      if (have) return have;
      const wire = inlayPictureId(req.id);
      const mine = pending.get(userId) ?? new Map<string, InlayPictureRequest>();
      mine.set(wire, { ...req, id: wire });
      pending.set(userId, mine);
      const until = Date.now() + GIVE_UP_MS;
      try {
        for (;;) {
          const all = await exchange(userId);
          const st = all?.[wire];
          if (!all || !st) {
            log(`inlay pictures: no answer for ${req.id}; Gambit draws it`);
            return null;
          }
          if (st.status === "ready" && st.imageId) {
            const pic = { imageId: st.imageId, url: st.url || `/api/v1/images/${st.imageId}` };
            await remember(userId, req.id, pic);
            log(`inlay pictures: ${req.direction} ${req.id} ready`);
            return pic;
          }
          if (st.status === "failed") {
            log(`inlay pictures: ${req.direction} ${req.id} failed: ${st.error ?? "no reason"}; Gambit draws it`);
            void spindle.userStorage.setJson("cards/debug/inlay-picture-failed.json", { at: Date.now(), id: req.id, direction: req.direction, error: st.error ?? null }, { userId }).catch(() => {});
            return null;
          }
          if (Date.now() > until) {
            log(`inlay pictures: ${req.id} took too long; Gambit draws it`);
            return null;
          }
          await new Promise((r) => setTimeout(r, POLL_MS));
        }
      } finally {
        mine.delete(wire);
        waits.delete(wk);
        void exchange(userId).catch(() => null);
      }
    })();
    waits.set(wk, wait);
    return wait;
  }

  return { request, known };
}

export type InlayPictures = ReturnType<typeof createInlayPictures>;
