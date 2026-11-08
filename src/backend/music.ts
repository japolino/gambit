/**
 * The music catalogue and the model's pick (meaning/music.ts). The catalogue is read from where it's published through
 * the host's CORS proxy, which needs the cors_proxy permission, and kept for a month.
 */
import type { SpindleAPI } from "lumiverse-spindle-types";
import type { DecisionAnswer, DecisionQuestion } from "lumiverse-spindle-types";
import { CATALOGUE_URL, feelPrompt, feelQuestions, feelsIn, musicState, parseCatalogue, parseFeel, parseTrack, plainWanted, shortlist, trackFromAnswers, trackPrompt, trackQuestions, wantedFromAnswers, type MusicAsk, type Piece, type Wanted } from "../meaning/music.js";
import type { Ledger } from "./ledger.js";

const STORED = "music/catalogue.json";
const KEEP_MS = 30 * 24 * 3600_000;
const RETRY_MS = 60_000;
const DECIDE_MS = 8_000;

export const NEEDS_PERMISSION = "Music needs the CORS proxy permission: grant cors_proxy to Gambit on the Extensions page.";

export interface MusicDeps {
  spindle: Pick<SpindleAPI, "cors" | "storage">;
  decide(userId: string, state: unknown, questions: Record<string, DecisionQuestion>, ms: number, what: string): Promise<Record<string, DecisionAnswer | undefined> | null>;
  compile?: Ledger["compile"];
  log(m: string): void;
  now?(): number;
}

export function createMusicBox({ spindle, decide, compile, log, now = Date.now }: MusicDeps) {
  let loaded: Piece[] | null = null;
  let failed: { at: number; error: string } | null = null;
  let loading: Promise<Piece[] | string> | null = null;

  async function fetchCatalogue(): Promise<Piece[] | string> {
    const stored = await spindle.storage.getJson<{ at?: number; pieces?: Piece[] } | null>(STORED, { fallback: null }).catch(() => null);
    const fresh = stored?.pieces?.length && now() - (stored.at ?? 0) < KEEP_MS ? stored.pieces : null;
    if (fresh) return fresh;
    try {
      const res = (await spindle.cors(CATALOGUE_URL)) as { status?: number; body?: string };
      if (res.status && res.status >= 400) throw new Error(`the catalogue answered ${res.status}`);
      const pieces = parseCatalogue(JSON.parse(res.body ?? ""));
      if (!pieces.length) throw new Error("the catalogue had no usable tracks");
      await spindle.storage.setJson(STORED, { at: now(), pieces }).catch(() => {});
      log(`music: catalogue read, ${pieces.length} tracks`);
      return pieces;
    } catch (err) {
      const why = err instanceof Error ? err.message : String(err);
      log(`music: could not read the catalogue: ${why.slice(0, 160)}`);
      // An old catalogue beats no music.
      if (stored?.pieces?.length) return stored.pieces;
      return /permission|cors_proxy/i.test(why) ? NEEDS_PERMISSION : `Music couldn't reach its catalogue: ${why.slice(0, 120)}`;
    }
  }

  /** The tracks to choose from, or why there are none. */
  async function catalogue(): Promise<Piece[] | string> {
    if (loaded) return loaded;
    if (failed && now() - failed.at < RETRY_MS) return failed.error;
    const got = await (loading ??= fetchCatalogue().finally(() => (loading = null)));
    if (typeof got === "string") failed = { at: now(), error: got };
    else {
      loaded = got;
      failed = null;
    }
    return got;
  }

  async function wanted(userId: string, ask: MusicAsk, feels: string[]): Promise<Wanted> {
    const typed = wantedFromAnswers(await decide(userId, musicState(ask), feelQuestions(feels), DECIDE_MS, "music").catch(() => null), feels);
    if (typed) return typed;
    if (compile) {
      const res = await compile<Wanted | null>(userId, "music-feel", feelPrompt(ask, feels), 200, (raw) => parseFeel(raw, feels), () => null, { tries: 1 }).catch(() => null);
      if (res?.value) return res.value;
    }
    return plainWanted(ask.moment, feels);
  }

  async function chosen(userId: string, ask: MusicAsk, list: Piece[]): Promise<Piece> {
    if (list.length < 2) return list[0]!;
    const typed = trackFromAnswers(await decide(userId, musicState(ask), trackQuestions(list), DECIDE_MS, "music").catch(() => null), list);
    if (typed) return typed;
    if (compile) {
      const res = await compile<Piece | null>(userId, "music-track", trackPrompt(ask, list), 100, (raw) => parseTrack(raw, list), () => null, { tries: 1 }).catch(() => null);
      if (res?.value) return res.value;
    }
    return list[0]!;
  }

  /** The model scores the moment from the whole catalogue. */
  async function pick(userId: string, ask: MusicAsk, pieces: Piece[], used: ReadonlySet<string>, seed: string): Promise<Piece | null> {
    if (!pieces.length) return null;
    const want = await wanted(userId, ask, feelsIn(pieces));
    const list = shortlist(pieces, want, used, seed);
    if (!list.length) return null;
    const piece = await chosen(userId, ask, list);
    log(`music: ${ask.moment}${ask.about ? ` (${ask.about})` : ""}: ${want.feel}${want.also ? `, ${want.also}` : ""}${want.sound ? `, ${want.sound}` : ""} -> ${piece.title}, from ${list.length}`);
    return piece;
  }

  return { catalogue, pick };
}

export type MusicBox = ReturnType<typeof createMusicBox>;
