/**
 * The Card Reader on the backend (docs/DESIGN.md 4.0).
 *
 *   gather  card(s), persona, lorebook entries, recent chat (host APIs)
 *   read    the Architect writes a Card Sheet (generate.quiet, JSON);
 *           code validates it (meaning/card-reader.ts) or builds a fallback
 *   detect  after a reply, the Referee asks whether a contest was set up;
 *           a chip is offered under that reply, never a scene by itself
 *   talk    the Architect frames the contest; code sizes it and the Parley
 *           starts against the card's own character
 *
 * Sheets are stored per card (every chat with that card reuses one); the
 * on/off switch, chip setting, and journal are per chat. Gambit never edits
 * the card, its lorebooks, or the persona.
 */
import type { DecisionAnswer, GenerationResponseDTO, SpindleAPI } from "lumiverse-spindle-types";
import { scenarioFromSheet } from "../engine/card/sizing.js";
import { DEMO_CARD, DEMO_LORE } from "../engine/content/saltgate-card.js";
import type { CardSheet, CardSources, ContestChip, ModuleId, SourceLore } from "../engine/card/types.js";
import type { ContestKind, SocialStat } from "../engine/parley/types.js";
import {
  cardKey as cardKeyOf,
  chipFromAnswers,
  corpora,
  quoteFound,
  sourcesText,
  detectorQuestions,
  detectorState,
  fallbackFrame,
  fallbackSheet,
  framePrompt,
  mergeEdits,
  parseFrame,
  parseSheet,
  mergeReads,
  readerPrompts,
  resolveMacros,
} from "../meaning/card-reader.js";
import { firstJson, typedAnswers, typedPrompt } from "../meaning/referee.js";
import { armoryPrompt, parseArmory } from "../meaning/armory.js";
import { matchCardPrompt, validateLook, type LookFile } from "../art/look-file.js";
import type { CardStatus, ToFrontend } from "../shared/protocol.js";
import { createFaceFinder } from "./card-faces.js";
import { createInlayLibrary } from "./inlay-library.js";
import { preferredConnection } from "./referee-host.js";
import { createLedger } from "./ledger.js";
import { createJaot, type Priority } from "./jaot.js";
import { biblePrompt, fallbackBible, parseBible, whereQuestion, type Bible } from "../meaning/bible.js";

type Send = (msg: ToFrontend, userId: string) => void;
interface ParleysPort {
  startScenario(userId: string, scenario: NonNullable<ReturnType<typeof scenarioFromSheet>>, chatId: string | null): Promise<void>;
  openIn(userId: string, chatId: string): Promise<boolean>;
  awaitingIn(chatId: string): boolean;
}

interface ChatConf {
  enabled?: boolean;
  cardKey?: string;
  chips?: boolean;
}

const sheetPath = (key: string) => `cards/sheet/${encodeURIComponent(key)}.json`;
const biblePath = (key: string) => `cards/bible/${encodeURIComponent(key)}.json`;
/** A Bible that fell back to code is asked for again after this long. */
const BIBLE_RETRY_MS = 10 * 60_000;

/** Play's side of "where is the scene now" (4.5: new places come from play). */
export interface PlaceHook {
  where(userId: string, chatId: string): Promise<{ here: { id: string; name: string }; places: { id: string; name: string }[] } | null>;
  moved(userId: string, chatId: string, pick: string, p: number, lines: { name: string; content: string }[]): Promise<void>;
  /** Notice (4.6): what the player's latest line mentions raises interest. */
  notice?(userId: string, chatId: string, lines: { name: string; content: string; isUser: boolean }[]): Promise<void>;
  /** People the chat's world promoted (4.6): they can be talked to like the card's own cast. */
  extraCast?(userId: string, chatId: string): Promise<CardSheet["cast"]>;
}
const chatPath = (chatId: string) => `cards/chat/${encodeURIComponent(chatId)}.json`;
const DEMO = "cards/demo.json";
const READ_MS = 240_000;
const READ_IDLE_MS = 60_000;
/** Framing answers are short, but some providers send nothing until done (one took 25 s+). */
const FRAME_MS = 45_000;
const DETECT_MS = 12_000;
/** Bumped when the way a card NPC's art is made changes, so old renders are not reused. */
const ART_REV = "r3";
/** Short FNV-1a hash, for art keys that follow a look. */
const hash8 = (s: string): string => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36).slice(0, 8);
};
/** Library cards and sprites change: look the cast's art up again after this long. */
const FACES_TTL_MS = 10 * 60_000;

const errText = (err: unknown) => (err instanceof Error ? err.message : String(err));
const stripThink = (t: string) => t.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
const contentOf = (res: unknown): string => (typeof res === "string" ? res : ((res as GenerationResponseDTO | null)?.content ?? ""));
const permissionHint = (msg: string) =>
  /permission|not granted|forbidden|denied/i.test(msg) ? "Gambit needs the characters, personas, and world books permissions to read this card. Grant them on the Extensions page, then try again." : msg;

export function createCards(spindle: SpindleAPI, send: Send, parleys: ParleysPort) {
  const reading = new Map<string, Promise<CardSheet>>();
  const chips = new Map<string, ContestChip>();
  const log = (m: string) => {
    try {
      spindle.log.info(`gambit cards: ${m}`);
    } catch {
      /* best effort */
    }
  };

  const conf = (userId: string, chatId: string) => spindle.userStorage.getJson<ChatConf>(chatPath(chatId), { fallback: {}, userId });
  const setConf = async (userId: string, chatId: string, patch: ChatConf) => spindle.userStorage.setJson(chatPath(chatId), { ...(await conf(userId, chatId)), ...patch }, { userId });
  const inlay = createInlayLibrary(spindle, log);
  const faces = createFaceFinder(spindle, log, inlay);
  const loadSheet = (userId: string, key: string) => spindle.userStorage.getJson<CardSheet | null>(sheetPath(key), { fallback: null, userId });
  const saveSheet = (userId: string, sheet: CardSheet) => spindle.userStorage.setJson(sheetPath(sheet.cardKey), sheet, { userId });

  /** Character ids of a chat: the group members, else its one card. */
  async function chatCards(userId: string, chatId: string): Promise<string[]> {
    const chat = await spindle.chats.get(chatId, userId);
    if (!chat) throw new Error("That chat no longer exists.");
    const group = (chat.metadata as { character_ids?: unknown } | undefined)?.character_ids;
    const ids = Array.isArray(group) ? group.filter((x): x is string => typeof x === "string" && !!x) : [];
    return ids.length ? [...new Set(ids)] : [chat.character_id];
  }

  async function recent(userId: string, chatId: string, n: number): Promise<{ name: string; content: string; isUser: boolean }[]> {
    try {
      const msgs = await spindle.chat.getMessages(chatId);
      return msgs
        .filter((m) => !m.hidden && m.role !== "system" && m.content?.trim())
        .slice(-n)
        .map((m) => ({ name: m.name || (m.is_user ? "Player" : "Narrator"), content: m.content, isUser: m.is_user }));
    } catch (err) {
      log(`could not read chat ${chatId}: ${errText(err)}`);
      return [];
    }
  }

  /** Everything the reader may read, fetched through the host with macros resolved. */
  async function gather(userId: string, chatId: string): Promise<CardSources> {
    const ids = await chatCards(userId, chatId);
    const persona = await spindle.personas.getActive(userId).catch(() => null);
    // Without a persona, {{user}} reads as "the player" in the sources (never "you", which garbles the card's prose).
    const userName = persona?.name || "the player";
    const raw = (await Promise.all(ids.map((id) => spindle.characters.get(id, userId)))).filter((c): c is NonNullable<typeof c> => !!c);
    if (!raw.length) throw new Error("This chat's card could not be found.");
    const cards = raw.map((c) => {
      const r = (t: string) => resolveMacros(t ?? "", c.name, userName);
      return {
        id: c.id,
        name: c.name,
        description: r(c.description),
        personality: r(c.personality),
        scenario: r(c.scenario),
        firstMes: r(c.first_mes),
        alternateGreetings: (c.alternate_greetings ?? []).map(r).filter(Boolean),
        mesExample: r(c.mes_example),
        creatorNotes: r(c.creator_notes),
        tags: c.tags ?? [],
        imageId: c.image_id,
        avatarUrl: c.avatar_url ?? null,
        updatedAt: c.updated_at ?? 0,
      };
    });
    const books: { id: string; scope: SourceLore["scope"] }[] = [];
    for (const c of raw) for (const id of c.world_book_ids ?? []) if (!books.some((b) => b.id === id)) books.push({ id, scope: "card" });
    if (persona?.attached_world_book_id && !books.some((b) => b.id === persona.attached_world_book_id)) books.push({ id: persona.attached_world_book_id, scope: "persona" });
    const lore: SourceLore[] = [];
    const mainName = cards[0]!.name;
    for (const b of books.slice(0, 6)) {
      try {
        const { data } = await spindle.world_books.entries.list(b.id, { limit: 200, userId });
        const usable = data
          .filter((e) => !e.disabled && e.content?.trim())
          .sort((a, z) => Number(z.constant) - Number(a.constant) || (a.order_value ?? 0) - (z.order_value ?? 0))
          .slice(0, 40);
        for (const e of usable) lore.push({ title: e.comment || e.key?.[0] || "entry", content: resolveMacros(e.content, mainName, userName), scope: b.scope });
      } catch (err) {
        log(`could not read lorebook ${b.id}: ${errText(err)}`);
      }
    }
    const chat = (await recent(userId, chatId, 12)).map((m) => ({ ...m, content: resolveMacros(m.content, mainName, userName) }));
    return { cards, persona: { id: persona?.id ?? null, name: persona?.name ?? "", title: persona?.title ?? "", description: resolveMacros(persona?.description ?? "", mainName, userName) }, lore, chat };
  }

  /**
   * One streamed Architect call. Some providers send nothing until the answer
   * is nearly done, so "gone quiet" only counts after the first chunk; before
   * that only the overall cap applies.
   */
  async function architect(userId: string, prompt: { system: string; user: string }, maxTokens: number): Promise<{ raw: Record<string, unknown> | null; ms: number; chars: number; why?: string }> {
    const ctl = new AbortController();
    const cap = setTimeout(() => ctl.abort(new Error(`no answer within ${READ_MS / 1000} s`)), READ_MS);
    let idle: ReturnType<typeof setTimeout> | null = null;
    const poke = () => {
      if (idle) clearTimeout(idle);
      idle = setTimeout(() => ctl.abort(new Error(`the model stopped mid-answer for ${READ_IDLE_MS / 1000} s`)), READ_IDLE_MS);
    };
    const started = Date.now();
    let text = "";
    try {
      const stream = spindle.generate.quietStream({
        type: "quiet",
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        reasoning: { source: "off" },
        parameters: { temperature: 0.4, max_tokens: maxTokens },
        userId,
        signal: ctl.signal,
      } as never);
      for await (const chunk of stream) {
        poke();
        if (chunk.type === "token") text += chunk.token;
        else if (chunk.type === "done" && chunk.content) text = chunk.content;
      }
      const raw = firstJson(stripThink(text));
      return { raw, ms: Date.now() - started, chars: text.length, ...(raw ? {} : { why: `no readable JSON in ${text.length} characters` }) };
    } catch (err) {
      return { raw: null, ms: Date.now() - started, chars: text.length, why: errText(ctl.signal.aborted ? (ctl.signal.reason ?? err) : err).slice(0, 200) };
    } finally {
      clearTimeout(cap);
      if (idle) clearTimeout(idle);
    }
  }

  /** Every Architect answer is kept by question (4.5): a re-read of an unchanged card costs no model call. */
  const jaot = createJaot({ concurrency: 2, log });
  let placeHook: PlaceHook | null = null;
  const ledger = createLedger(spindle.userStorage as never, (userId) => (prompt, max) => architect(userId, prompt, max), log);
  type Raw = Record<string, unknown>;
  const askRaw = async (userId: string, kind: string, prompt: { system: string; user: string }, max: number, fresh: boolean) => {
    const started = Date.now();
    const r = await ledger.compile<Raw | null>(userId, kind, prompt, max, (raw) => raw, () => null, { fresh });
    return { raw: r.value, ms: Date.now() - started, by: r.by, ...(r.why ? { why: r.why } : {}) };
  };

  /** The Architect's read: the world and the people, asked at the same time, merged and checked in code. */
  async function architectRead(userId: string, src: CardSources, fresh = false): Promise<CardSheet> {
    const now = Date.now();
    const prompts = readerPrompts(src);
    const [world, people] = await Promise.all([askRaw(userId, "read-world", prompts.world, 2500, fresh), askRaw(userId, "read-people", prompts.people, 3500, fresh)]);
    const secs = (ms: number) => `${Math.round(ms / 1000)} s`;
    log(`read: world ${world.raw ? `ok (${world.by})` : `failed (${world.why})`} in ${secs(world.ms)}, people ${people.raw ? `ok (${people.by})` : `failed (${people.why})`} in ${secs(people.ms)}`);
    // The last read's prompts, answers, and outcome, for diagnosing a model that will not answer or answers oddly.
    void spindle.userStorage
      .setJson("cards/debug/last-read.json", { at: now, world: { ...world, prompt: prompts.world }, people: { ...people, prompt: prompts.people } }, { userId })
      .catch(() => {});
    if (!world.raw && !people.raw) {
      return fallbackSheet(src, now, `The card reader failed (${world.why ?? people.why}), so this sheet was built from the card without a model. Try "Read the card again".`);
    }
    const sheet = parseSheet(mergeReads(world.raw, people.raw), src, now);
    if (!world.raw) sheet.notes.unshift(`Half the read failed (${world.why}): the premise, places, and modules are guesses. Try "Read the card again".`);
    if (!people.raw) sheet.notes.unshift(`Half the read failed (${people.why}): the people's motives and the facts are missing. Try "Read the card again".`);
    return sheet;
  }

  async function status(userId: string, chatId: string, extra: Partial<CardStatus> = {}): Promise<void> {
    const c = await conf(userId, chatId);
    let key = c.cardKey;
    let stale = false;
    let error: string | undefined;
    try {
      const ids = await chatCards(userId, chatId);
      key = [...ids].sort().join("+");
      const sheet = await loadSheet(userId, key);
      if (sheet) {
        const cards = await Promise.all(ids.map((id) => spindle.characters.get(id, userId).catch(() => null)));
        stale = cards.some((x) => x && (x.updated_at ?? 0) > sheet.cardUpdatedAt);
        // Sheets read before faces existed, or a while ago: look the cast's art up (host reads only).
        if (!sheet.facesAt || Date.now() - sheet.facesAt > FACES_TTL_MS) await saveSheet(userId, { ...(await faces.attachFaces(userId, sheet)), facesAt: Date.now() });
      }
    } catch (err) {
      error = permissionHint(errText(err));
    }
    const sheet = key ? await loadSheet(userId, key) : null;
    send({ type: "card.status", status: { chatId, enabled: !!c.enabled, reading: !!(key && reading.has(`${userId}:${key}`)), sheet, stale, chips: c.chips !== false, ...(error ? { error } : {}), ...extra } }, userId);
  }

  /** Read the chat's card now (or reuse the stored sheet unless forced). */
  async function read(userId: string, chatId: string, force: boolean): Promise<CardSheet | null> {
    let src: CardSources;
    try {
      src = await gather(userId, chatId);
    } catch (err) {
      await status(userId, chatId, { error: permissionHint(errText(err)) });
      return null;
    }
    const key = cardKeyOf(src);
    await setConf(userId, chatId, { cardKey: key });
    const old = await loadSheet(userId, key);
    const updated = Math.max(0, ...src.cards.map((c) => c.updatedAt));
    if (old && !force && old.cardUpdatedAt >= updated) return old;
    const rk = `${userId}:${key}`;
    let job = reading.get(rk);
    if (!job) {
      job = (async () => {
        const sheet = { ...(await faces.attachFaces(userId, mergeEdits(await architectRead(userId, src, force), old))), facesAt: Date.now() };
        await saveSheet(userId, sheet);
        log(`read ${sheet.cardName}: ${sheet.by}, ${sheet.cast.length} cast, ${sheet.facts.length} facts, modules ${Object.entries(sheet.modules).filter(([, v]) => v).map(([k]) => k).join("+")}`);
        // The World Bible compiles while the player reviews the sheet (4.5).
        void bible(userId, chatId, 1).catch(() => {});
        return sheet;
      })().finally(() => reading.delete(rk));
      reading.set(rk, job);
      void status(userId, chatId);
    }
    const sheet = await job;
    await status(userId, chatId);
    return sheet;
  }

  async function sheetFor(userId: string, chatId: string): Promise<CardSheet | null> {
    const c = await conf(userId, chatId);
    if (c.cardKey) {
      const s = await loadSheet(userId, c.cardKey);
      if (s) return s;
    }
    return read(userId, chatId, false);
  }

  /** Typed answers from the Decision model, else the helper model imitating them. */
  async function ask(userId: string, state: Record<string, unknown>, questions: ReturnType<typeof detectorQuestions>): Promise<Record<string, DecisionAnswer | undefined> | null> {
    if (spindle.decisions?.evaluate) {
      try {
        const connection_id = await preferredConnection(spindle, userId);
        const r = await spindle.decisions.evaluate({ state: state as never, questions, userId, ...(connection_id ? { connection_id } : {}) }, { signal: AbortSignal.timeout(DETECT_MS) });
        return r.answers as Record<string, DecisionAnswer | undefined>;
      } catch (err) {
        log(`detector: decision model unavailable (${errText(err).slice(0, 120)}); trying the helper`);
      }
    }
    try {
      const { system, user } = typedPrompt(state, questions);
      const res = await spindle.generate.quiet({
        type: "quiet",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        reasoning: { source: "off" },
        parameters: { temperature: 0.1 },
        userId,
        signal: AbortSignal.timeout(DETECT_MS + 6000),
      } as never);
      const raw = firstJson(stripThink(contentOf(res)));
      return raw ? typedAnswers(raw, questions) : null;
    } catch (err) {
      log(`detector: helper failed (${errText(err).slice(0, 120)})`);
      return null;
    }
  }

  async function frame(userId: string, sheet: CardSheet, chatId: string, castId: string, kind?: ContestKind) {
    const lines = await recent(userId, chatId, 8);
    const { system, user } = framePrompt(sheet, castId, lines, kind);
    try {
      const res = await spindle.generate.quiet({
        type: "quiet",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        reasoning: { source: "off" },
        parameters: { temperature: 0.5, max_tokens: 600 },
        userId,
        signal: AbortSignal.timeout(FRAME_MS),
      } as never);
      const raw = firstJson(stripThink(contentOf(res)));
      if (raw) return parseFrame(raw, sheet, castId, kind);
    } catch (err) {
      log(`framing failed (${errText(err).slice(0, 120)}); using the fallback`);
    }
    return fallbackFrame(sheet, castId, lines, kind);
  }

  /**
   * The card's World Bible (meaning/bible.ts), stored per card. It is built
   * from the sheet it was compiled against, so a re-read rebuilds it (from
   * the ledger when the question is unchanged).
   */
  async function bible(userId: string, chatId: string, priority: Priority = 1): Promise<Bible | null> {
    const sheet = await sheetFor(userId, chatId);
    if (!sheet) return null;
    const stored = await spindle.userStorage.getJson<{ sheetAt?: number; shape?: string; bible?: Bible } | null>(biblePath(sheet.cardKey), { fallback: null, userId }).catch(() => null);
    if (stored?.bible && stored.sheetAt === sheet.readAt && stored.shape === sheet.shape && (stored.bible.by === "architect" || Date.now() - stored.bible.at < BIBLE_RETRY_MS)) return stored.bible;
    return jaot.run(`bible:${userId}:${sheet.cardKey}`, priority, async () => {
      const src = await gather(userId, chatId).catch(() => null);
      const all = src ? Object.values(corpora(src)).join(" ") : "";
      const verify = (q: string) => !!all && quoteFound(q, all);
      let rejected: unknown = null;
      const r = await ledger.compile(
        userId,
        "bible",
        biblePrompt(sheet, src ? sourcesText(src, 10_000) : sheet.premise),
        2500,
        (raw) => {
          const parsed = parseBible(raw, sheet, verify);
          if (!parsed) rejected = raw;
          return parsed;
        },
        () => fallbackBible(sheet),
      );
      const b = r.value;
      void spindle.userStorage.setJson("cards/debug/last-bible.json", { at: Date.now(), by: r.by, tries: r.tries, why: r.why ?? null, rejected }, { userId }).catch(() => {});
      log(`bible ${sheet.cardName}: ${b.by} (${r.by}${r.why ? `: ${r.why}` : ""}), ${b.places.length} places (${b.places.map((p) => p.name).join(", ")}), thread ${b.thread ? `"${b.thread.goal}"` : "none"}, ${b.factions.length} factions`);
      await spindle.userStorage.setJson(biblePath(sheet.cardKey), { sheetAt: sheet.readAt, shape: sheet.shape, bible: b }, { userId });
      return b;
    });
  }

  /** The stored Bible, without compiling one; with a sheet, only one built for that read and shape. */
  async function storedBible(userId: string, cardKey: string, sheet?: Pick<CardSheet, "readAt" | "shape">): Promise<Bible | null> {
    const stored = await spindle.userStorage.getJson<{ sheetAt?: number; shape?: string; bible?: Bible } | null>(biblePath(cardKey), { fallback: null, userId }).catch(() => null);
    if (sheet && (stored?.sheetAt !== sheet.readAt || stored?.shape !== sheet.shape)) return null;
    return stored?.bible ?? null;
  }

  const arming = new Map<string, Promise<CardSheet>>();

  /** The sheet with the card's foes and the party's kits, read once (meaning/armory.ts). */
  async function armory(userId: string, chatId: string): Promise<CardSheet | null> {
    const sheet = await sheetFor(userId, chatId);
    if (!sheet || sheet.foes?.length) return sheet;
    const rk = `${userId}:${sheet.cardKey}`;
    let job = arming.get(rk);
    if (!job) {
      job = (async () => {
        const src = await gather(userId, chatId).catch(() => null);
        const all = src ? Object.values(corpora(src)).join(" ") : "";
        const verify = (q: string) => !!all && quoteFound(q, all);
        // A usable answer names foes; one with none is asked again, then the genre's foes stand in.
        const r = await ledger.compile(
          userId,
          "armory",
          armoryPrompt(sheet, src ? sourcesText(src, 12_000) : sheet.premise),
          4000,
          (raw) => {
            const parsed = parseArmory(raw, sheet, verify);
            return parsed.by === "architect" ? parsed : null;
          },
          () => parseArmory(null, sheet, verify),
        );
        const a = r.value;
        log(`armory ${sheet.cardName}: ${a.by} (${r.by}${r.why ? `: ${r.why}` : ""}), ${a.foes.length} foes (${a.foes.map((f) => `${f.name}:${f.role}${f.tier}`).join(", ")}), ${a.kits.length} kits`);
        void spindle.userStorage.setJson("cards/debug/last-armory.json", { at: Date.now(), by: r.by, tries: r.tries, why: r.why ?? null }, { userId }).catch(() => {});
        const fresh = (await loadSheet(userId, sheet.cardKey)) ?? sheet;
        const next: CardSheet = { ...fresh, foes: a.foes, kits: a.kits, armoryBy: a.by };
        await saveSheet(userId, next);
        return next;
      })().finally(() => arming.delete(rk));
      arming.set(rk, job);
    }
    return job;
  }

  return {
    status,
    jaot,
    bible,
    storedBible,
    /** A validated model answer through the ledger (4.5), for play's own compiles. */
    compile: ledger.compile,
    setPlaceHook(h: PlaceHook) {
      placeHook = h;
    },
    sheetFor,
    armory,
    saveSheet,
    recent,

    /** "Match the card" (5.2a): the strong model writes a look file for this card's world; code validates it. */
    async matchLook(userId: string, chatId: string): Promise<{ look: LookFile; warnings: string[] } | { error: string }> {
      const sheet = await sheetFor(userId, chatId);
      if (!sheet) return { error: "Gambit has not read this card yet. Turn it on for this chat first." };
      const prompt = matchCardPrompt({ name: sheet.cardName, premise: sheet.premise, tone: sheet.tone, genre: sheet.skin.genre, looks: sheet.cast.map((c) => c.look).filter(Boolean).slice(0, 4) });
      const slug = sheet.cardName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "card";
      let errors: string[] = [];
      // A look that fails the validator is asked for once more; there is no code fallback for taste.
      const res = await ledger.compile(
        userId,
        "match-look",
        prompt,
        1200,
        (raw) => {
          const checked = validateLook({ format: "gambit-look", v: 1, ...raw, id: `card-${slug}`, author: "Gambit (matched to the card)" });
          if (!checked.ok) errors = checked.errors;
          return checked.ok ? checked : null;
        },
        () => null,
        { fresh: true },
      );
      if (!res.value) return { error: errors.length ? `The model's look did not pass the checks: ${errors.join(" ")}` : `The model gave no look (${res.why ?? "no answer"}).` };
      log(`look: matched "${res.value.look.label}" to ${sheet.cardName} (${res.by}, ${res.tries} ask${res.tries === 1 ? "" : "s"})`);
      return { look: res.value.look, warnings: res.value.warnings };
    },

    /** A fact turned up in play counts as known: Parley Leverage can use it (4.0). */
    async markKnown(userId: string, chatId: string, factId: string) {
      const sheet = await sheetFor(userId, chatId);
      const f = sheet?.facts.find((x) => x.id === factId);
      if (!sheet || !f || f.known) return;
      f.known = true;
      await saveSheet(userId, sheet);
    },

    /** Add the Saltgate demo card and its lorebook to the user's library (once). */
    async installDemo(userId: string) {
      const had = await spindle.userStorage.getJson<{ characterId?: string }>(DEMO, { fallback: {}, userId });
      if (had.characterId && (await spindle.characters.get(had.characterId, userId).catch(() => null))) {
        return send({ type: "notice", level: "info", text: "The Saltgate demo card is already in your library. Open a chat with it, then switch Gambit on." }, userId);
      }
      try {
        const book = await spindle.world_books.create({ name: "Saltgate (Gambit demo)", description: "Lore for the Gambit demo card." }, userId);
        for (const [i, e] of DEMO_LORE.entries()) {
          await spindle.world_books.entries.create(book.id, { key: e.key, content: e.content, comment: e.comment, constant: !!e.constant, order_value: 100 + i }, userId);
        }
        const c = await spindle.characters.create({ ...DEMO_CARD, world_book_ids: [book.id] }, userId);
        await spindle.userStorage.setJson(DEMO, { characterId: c.id, worldBookId: book.id }, { userId });
        log(`installed the demo card ${c.id}`);
        send({ type: "notice", level: "info", text: "Added the Saltgate demo card to your library. Open a chat with it, then switch Gambit on." }, userId);
      } catch (err) {
        send({ type: "notice", level: "error", text: permissionHint(errText(err)) }, userId);
      }
    },

    async enable(userId: string, chatId: string, on: boolean) {
      await setConf(userId, chatId, { enabled: on });
      await status(userId, chatId);
      if (on) void read(userId, chatId, false);
    },

    async reread(userId: string, chatId: string) {
      await read(userId, chatId, true);
    },

    async setChips(userId: string, chatId: string, on: boolean) {
      await setConf(userId, chatId, { chips: on });
      await status(userId, chatId);
    },

    async edit(userId: string, chatId: string, social?: Partial<Record<SocialStat, number>>, modules?: Partial<Record<ModuleId, boolean>>) {
      const sheet = await sheetFor(userId, chatId);
      if (!sheet) return;
      if (social) {
        const next = { ...sheet.player.social };
        for (const [k, v] of Object.entries(social)) if (k in next && Number.isFinite(v)) next[k as SocialStat] = Math.max(0, Math.min(4, Math.round(v!))) as 0 | 1 | 2 | 3 | 4;
        sheet.player = { ...sheet.player, social: next, edited: true };
      }
      if (modules) {
        sheet.modules = { ...sheet.modules, ...modules, parley: true };
        sheet.modulesEdited = true;
      }
      await saveSheet(userId, sheet);
      await status(userId, chatId);
    },

    /** Start a Parley with someone in the cast (from the drawer or a chip). */
    async talk(userId: string, chatId: string, castId: string, kind?: ContestKind, chipId?: string) {
      const chip = chipId ? chips.get(chipId) : undefined;
      const base = await sheetFor(userId, chatId);
      const extra = base && placeHook?.extraCast ? await placeHook.extraCast(userId, chatId).catch(() => []) : [];
      const sheet = base && extra.length ? { ...base, cast: [...base.cast, ...extra.filter((m) => !base.cast.some((c) => c.id === m.id))] } : base;
      const who = sheet?.cast.find((c) => c.id === castId);
      if (!sheet || !who) return send({ type: "parley.error", error: "Gambit has no sheet for this chat yet." }, userId);
      send({ type: "card.starting", chatId, castName: who.name }, userId);
      const f = await frame(userId, sheet, chatId, castId, chip?.kind ?? kind);
      const scenario = scenarioFromSheet(sheet, f, chatId, `card:${chatId.slice(0, 8)}:${castId}:${Date.now().toString(36)}`, []);
      if (!scenario) return send({ type: "parley.error", error: "Could not set that scene up." }, userId);
      // Their art, looked up fresh: sprites become moods, the base is the reference for the rest.
      const [art, look] = await Promise.all([
        faces.facesFor(userId, sheet, who).catch(() => null).then((f) => f ?? who.faces ?? null),
        inlay.lookFor(userId, who.name, [who.characterId, ...sheet.characterIds]).catch(() => null),
      ]);
      if (art && scenario.card) scenario.card.faces = art;
      if (look && scenario.card) scenario.card.inlay = look;
      if (look) log(`inlay: ${who.name} is "${look.name}" in Inlay${look.outfit ? ` (${look.outfit})` : ""}${look.referenceImageId ? ", with a reference" : ""}`);
      const ref = art?.base ?? who.avatarImageId;
      // The art key follows the reference (and Inlay's tags), so a new avatar, sprite set, or look is never shown old renders.
      const tagged = look?.tags ? `i${hash8(look.tags)}` : "";
      if (ref) scenario.npc = { ...scenario.npc, id: `${scenario.npc.id}~${ART_REV}${ref.slice(0, 8)}${tagged}` };
      log(`scene with ${who.name}: ${f.kind} over "${f.stake}" (${f.by}), DC ${scenario.contest.dc}`);
      await parleys.startScenario(userId, scenario, chatId);
    },

    /** After a real reply in a Gambit chat: offer a contest chip if the scene set one up. */
    async afterReply(userId: string, chatId: string, messageId: string | undefined, generationType: string | undefined) {
      if (!messageId || generationType === "impersonate") return;
      const c = await conf(userId, chatId);
      if (!c.enabled || !c.cardKey) return;
      if (parleys.awaitingIn(chatId) || (await parleys.openIn(userId, chatId))) return log("chip: skipped, a Parley is open in this chat");
      const sheet = await loadSheet(userId, c.cardKey);
      if (!sheet) return log("chip: skipped, the card has not been read");
      const wantChip = c.chips !== false;
      // Where the scene is now: asked in the same call when this chat has a scene (places from play).
      const where = placeHook ? await placeHook.where(userId, chatId).catch(() => null) : null;
      if (!wantChip && !where) return;
      const lines = await recent(userId, chatId, 4);
      if (placeHook?.notice) void placeHook.notice(userId, chatId, lines).catch((err) => log(`notice: ${errText(err).slice(0, 160)}`));
      const t0 = Date.now();
      const questions = { ...(wantChip ? detectorQuestions(sheet) : {}), ...(where ? whereQuestion(where.here, where.places) : {}) };
      const state = { ...detectorState(sheet, lines), ...(where ? { scene_was_at: where.here.name, known_places: where.places.map((p) => p.name) } : {}) };
      const answers = await ask(userId, state, questions);
      if (!answers) return log("chip: the detector gave no answer");
      const w = answers.where;
      if (where && w && w.type === "choice" && w.choice !== "same") {
        const p = Number(w.probabilities?.[w.choice] ?? w.confidence ?? 0);
        log(`where: ${w.choice} (p ${Math.round(p * 100) / 100})`);
        void placeHook!.moved(userId, chatId, w.choice, p, lines).catch((err) => log(`where: ${errText(err).slice(0, 160)}`));
      }
      if (!wantChip) return;
      const chip = chipFromAnswers(sheet, answers, { chatId, messageId });
      const pick = (a: DecisionAnswer | undefined) => (a && "pick" in a ? `${String(a.pick)} ${JSON.stringify((a as { probs?: unknown }).probs ?? {}).slice(0, 140)}` : "?");
      if (!chip) return log(`chip: none in ${Math.round((Date.now() - t0) / 1000)} s (contest ${pick(answers.contest)}; target ${pick(answers.target)})`);
      chips.set(chip.id, chip);
      log(`chip: ${chip.label} (p ${chip.p})`);
      send({ type: "card.chip", chip }, userId);
    },
  };
}
