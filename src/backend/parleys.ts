/**
 * Parley sessions on the backend (docs/DESIGN.md 4.1 and 8.3).
 *
 * The flow for a line typed in the Parley box:
 *   judge (Referee) -> applyExchange (code, seeded dice) -> save ->
 *   frontend plays the read and dice -> the line is posted to the bound chat
 *   with metadata.gambit.parley = { id, index } -> the interceptor finds
 *   that exchange on the message and injects the decided outcome -> the
 *   narrator voices it. A swipe re-narrates the same exchange.
 *
 * A line typed in the normal composer while a Parley is open is judged
 * inside the interceptor instead (the dice then land under the reply).
 * Editing a line re-judges its words with the same die faces; deleting it
 * rewinds the Parley to before it.
 */
import { createFigurePrints } from "./figure-prints.js";
import { sharedInlayPictures } from "./inlay-pictures.js";
import { withSuffix } from "./suffix.js";
import type { InterceptorContextDTO, InterceptorResultDTO, LlmMessageDTO, SpindleAPI } from "lumiverse-spindle-types";
import type { ArtApi } from "../art/controller.js";
import type { CharacterDNA } from "../art/specs.js";
import { PARLEYS } from "../engine/content/parleys.js";
import { applyExchange, canPay, closeParley, createParley, replayParley } from "../engine/parley/exchange.js";
import { momentIndexes, parleyMoment } from "../engine/parley/moments.js";
import { cleanReply, fallbackReply, narratorPrompt, outcomeBlock, sceneBlock } from "../engine/parley/narrate.js";
import type { Exchange, ParleyScenario, ParleyState, RefereeRead } from "../engine/parley/types.js";
import { EXPRESSION_FOR_MOOD } from "../shared/parley-view.js";
import { expressionArtKey, figureArtKey, momentArtKey, npcArtKey, placeArtKey } from "../shared/art-keys.js";
import type { ParleyMessageMeta, ParleyNarrator, ParleyViewMode, ToFrontend } from "../shared/protocol.js";
import { modelsFor } from "./models.js";
import { writeWithRetry } from "./writing.js";
import { judge } from "./referee-host.js";

type Send = (msg: ToFrontend, userId: string) => void;

const statePath = (id: string) => `parley/${encodeURIComponent(id)}.json`;
const scenePath = (id: string) => `parley/scene/${encodeURIComponent(id)}.json`;
const CURRENT = "parley/current.json";
const JOURNAL = "journal.json";
/** Card scenes keep one journal per chat (docs/DESIGN.md 4.0); the Saltgate demo keeps the global one. */
const journalPath = (scenario: ParleyScenario | null | undefined) => (scenario?.card ? `journal/${encodeURIComponent(scenario.card.journalKey)}.json` : JOURNAL);
const SETTINGS = "settings.json";

interface Current {
  id?: string;
  chatId?: string | null;
}
interface Settings {
  parleyView?: ParleyViewMode;
  parleyNarrator?: ParleyNarrator;
}

const seedOf = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

export function npcDna(scenario: ParleyScenario): CharacterDNA {
  const npc = scenario.npc;
  const inlay = scenario.card?.inlay;
  return {
    id: npc.id,
    name: npc.name,
    tags: npc.look.tags,
    description: npc.look.description,
    seed: seedOf(`npc:${npc.id}`),
    sex: inlay?.sex ?? npc.look.sex,
    palette: npc.look.palette,
    ...(inlay?.tags ? { booru: inlay.tags } : {}),
  };
}

const textOf = (m: LlmMessageDTO | undefined): string => {
  if (!m) return "";
  const c = (m as { content?: unknown }).content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((p) => (typeof p === "object" && p && "text" in p ? String((p as { text: unknown }).text ?? "") : "")).join("");
  return "";
};

const metaOf = (meta: unknown): ParleyMessageMeta | null => {
  const p = (meta as { gambit?: { parley?: ParleyMessageMeta } } | null | undefined)?.gambit?.parley;
  return p && typeof p.id === "string" && Number.isInteger(p.index) ? p : null;
};

/** A Parley with someone on a card ended (4.6: the deed ledger hears about it). */
export type ParleyEndHook = (userId: string, scenario: ParleyScenario, state: ParleyState) => void;

export function createParleys(spindle: SpindleAPI, send: Send, art: ArtApi, { retryMs = [1500, 4000] }: { retryMs?: number[] } = {}) {
  const figures = createFigurePrints(spindle, art, sharedInlayPictures(spindle, (m) => log(m)));
  /** Where Inlay can draw this person: the chat the scene belongs to, and who they are. */
  const figureVia = (scenario: ParleyScenario) => {
    const key = scenario.card?.journalKey ?? "";
    return key.startsWith("chat/") ? { chatId: key.slice(5), role: scenario.npc.role } : undefined;
  };
  let pictures: ReturnType<typeof sharedInlayPictures> | null = null;
  let endHook: ParleyEndHook | null = null;
  const told = new Set<string>();
  const live = new Map<string, ParleyState>();
  const scenes = new Map<string, ParleyScenario>();
  const k = (userId: string, id: string) => `${userId}\u0000${id}`;
  const busy = new Set<string>();
  /** Chat -> the exchange whose narration we are waiting for (kept for swipes). */
  const awaiting = new Map<string, { userId: string; parleyId: string; index: number }>();
  const streams = new Map<string, { text: string; timer: ReturnType<typeof setTimeout> | null }>();
  /** Chats whose running generation narrates a Parley exchange (cleared when it ends). */
  const narrating = new Set<string>();
  const log = (m: string) => {
    try {
      spindle.log.info(`gambit parley: ${m}`);
    } catch {
      /* best effort */
    }
  };

  async function load(userId: string, id: string): Promise<ParleyState | null> {
    if (live.has(k(userId, id))) return live.get(k(userId, id))!;
    const saved = await spindle.userStorage.getJson<ParleyState | null>(statePath(id), { fallback: null, userId });
    if (saved) live.set(k(userId, id), saved);
    return saved;
  }

  async function save(userId: string, state: ParleyState): Promise<void> {
    live.set(k(userId, state.id), state);
    await spindle.userStorage.setJson(statePath(state.id), state, { userId });
  }

  /** A hand-made scenario, or one built from a Card Sheet and saved when it started. */
  async function scenarioOf(userId: string, id: string | undefined | null): Promise<ParleyScenario | null> {
    if (!id) return null;
    if (PARLEYS[id]) return PARLEYS[id]!;
    const hit = scenes.get(k(userId, id));
    if (hit) return hit;
    const saved = await spindle.userStorage.getJson<ParleyScenario | null>(scenePath(id), { fallback: null, userId });
    if (saved) scenes.set(k(userId, id), saved);
    return saved;
  }

  const current = (userId: string) => spindle.userStorage.getJson<Current>(CURRENT, { fallback: {}, userId });
  const journal = async (userId: string, scenario?: ParleyScenario | null) => (await spindle.userStorage.getJson<{ known?: string[] }>(journalPath(scenario), { fallback: {}, userId })).known ?? [];
  const settings = (userId: string) => spindle.userStorage.getJson<Settings>(SETTINGS, { fallback: {}, userId });
  const viewMode = async (userId: string): Promise<ParleyViewMode> => (await settings(userId)).parleyView ?? "immersive";
  const narratorMode = async (userId: string): Promise<ParleyNarrator> => (await settings(userId)).parleyNarrator ?? "gambit";

  async function learn(userId: string, scenario: ParleyScenario, facts: string[]): Promise<void> {
    if (!facts.length) return;
    const known = new Set(await journal(userId, scenario));
    for (const f of facts) known.add(f);
    await spindle.userStorage.setJson(journalPath(scenario), { known: [...known] }, { userId });
  }

  async function pushState(userId: string, state: ParleyState, resumed = false): Promise<void> {
    const scenario = await scenarioOf(userId, state.scenarioId);
    if (!scenario) return;
    send({ type: "parley.state", state, scenario, journal: await journal(userId, scenario), view: await viewMode(userId), narrator: await narratorMode(userId), resumed }, userId);
  }

  function requestNpcArt(scenario: ParleyScenario, userId: string): void {
    const key = npcArtKey(scenario.npc.id);
    const dna = npcDna(scenario);
    art.request(placeArtKey(scenario.id), { kind: "background", location: { id: scenario.id, name: scenario.name, description: scenario.setting, palette: scenario.npc.look.palette } }, 1, userId);
    const wanted = [...new Set(Object.values(EXPRESSION_FOR_MOOD).filter((e): e is NonNullable<typeof e> => !!e))];
    /** Moods drawn from an older figure of them show their old looks: those go first. */
    const fromFigure = async (imageId: string) => {
      if (await figures.movedOn(userId, key, imageId)) await Promise.all(wanted.map((expression) => art.forget(expressionArtKey(key, expression), userId)));
    };
    const expressions = (imageId: string, source?: "card") => {
      for (const expression of wanted) {
        art.request(expressionArtKey(key, expression), { kind: "expression", character: dna, expression, canonical: { imageId, ...(source ? { source } : {}) } }, 2, userId);
      }
    };
    // Art the user already has is canonical (docs/DESIGN.md 4.0): their sprites are the
    // moods as they are; only moods they lack are drawn, from their base face.
    const faces = scenario.card?.faces;
    const avatar = scenario.card?.avatar;
    const baseId = faces?.base ?? avatar?.imageId ?? null;
    const baseUrl = baseId ? `/api/v1/images/${baseId}` : (avatar?.url ?? null);
    if (baseUrl) {
      // cutout: true means "show as drawn": the user's art is never keyed (a black ground would eat black clothes).
      const items: Extract<ToFrontend, { type: "art.update" }>["items"] = [{ key, state: "ready", url: baseUrl, ...(baseId ? { imageId: baseId } : {}), cutout: true, via: faces ? `card-${faces.source}` : "card-avatar" }];
      const missing: typeof wanted = [];
      for (const expression of wanted) {
        const have = faces?.expressions[expression];
        if (have) items.push({ key: expressionArtKey(key, expression), state: "ready", url: `/api/v1/images/${have}`, imageId: have, cutout: true, via: `card-${faces!.source}` });
        else missing.push(expression);
      }
      send({ type: "art.update", items }, userId);
      const card = scenario.card;
      if (!baseId) return;
      if (!card) {
        for (const expression of missing) art.request(expressionArtKey(key, expression), { kind: "expression", character: dna, expression, canonical: { imageId: baseId, source: "card" } }, 2, userId);
        return;
      }
      // Their own full figure, drawn by V5 from their tags (Inlay's when there),
      // transparent (play.ts draws the same one for scenes): it replaces the
      // framed card art, and the moods they lack are drawn from it with the V5 inset.
      const figure = figureArtKey(card.cardKey, card.castId);
      // Through the tag prints: a figure whose tags changed is drawn again (figure-prints.ts).
      void figures
        .request(userId, figure, dna, 0, log, figureVia(scenario))
        .then(() => art.whenDone(figure, userId))
        .then(async (f) => {
        if (f.state === "ready" && f.imageId && f.url) {
          await fromFigure(f.imageId);
          send({ type: "art.update", items: [{ key, state: "ready", url: f.url, imageId: f.imageId, cutout: f.cutout === true, via: "figure", ...(f.face !== undefined ? { face: f.face } : {}) }] }, userId);
          for (const expression of missing) art.request(expressionArtKey(key, expression), { kind: "expression", character: dna, expression, canonical: { imageId: f.imageId } }, 2, userId);
        } else {
          for (const expression of missing) art.request(expressionArtKey(key, expression), { kind: "expression", character: dna, expression, canonical: { imageId: baseId, source: "card" } }, 2, userId);
        }
        })
        .catch(() => undefined);
      return;
    }
    const portrait = () => {
      art.request(key, { kind: "portrait", character: dna }, 0, userId);
      void art.whenDone(key, userId).then((p) => {
        if (p.state === "ready" && p.imageId) expressions(p.imageId);
      });
    };
    // A card person with no art of their own (a lorebook character) stands as their figure,
    // the same one scenes show; the moods are drawn from it. Without a figure: a portrait.
    const person = scenario.card;
    if (person) {
      const figure = figureArtKey(person.cardKey, person.castId);
      void figures
        .request(userId, figure, dna, 0, log, figureVia(scenario))
        .then(() => art.whenDone(figure, userId))
        .then(async (f) => {
          if (f.state !== "ready" || !f.imageId || !f.url) return portrait();
          await fromFigure(f.imageId);
          send({ type: "art.update", items: [{ key, state: "ready", url: f.url, imageId: f.imageId, cutout: f.cutout === true, via: "figure", ...(f.face !== undefined ? { face: f.face } : {}) }] }, userId);
          expressions(f.imageId);
        })
        .catch(() => portrait());
      return;
    }
    portrait();
  }

  /**
   * Parley moments (engine/parley/moments.ts): the beats worth a picture,
   * each the person seen from the speaker's eyes in the place, from their
   * tags (Inlay's when there), with their figure along for a GPT edit. A
   * picture already drawn is sent again (a resumed Parley shows it).
   */
  function requestMoments(scenario: ParleyScenario, state: ParleyState, userId: string): void {
    const figureKey = scenario.card ? figureArtKey(scenario.card.cardKey, scenario.card.castId) : npcArtKey(scenario.npc.id);
    pictures ??= sharedInlayPictures(spindle, (m) => log(m));
    for (const index of momentIndexes(scenario, state)) {
      const ex = state.exchanges[index];
      const m = ex && parleyMoment(scenario, ex);
      if (!m) continue;
      const key = momentArtKey(state.id, index);
      // In a chat, Inlay draws it (its Gambit: Parley guideline over the chat's cast and the user's preset).
      if (state.chatId) {
        const said = ex.text.replace(/\s+/g, " ").trim().slice(0, 320);
        const answer = (ex.reply ?? "").replace(/\s+/g, " ").trim().slice(0, 600);
        const text = `${m.moment}. The persona had just said to ${scenario.npc.name}: "${said}"${answer ? `\n\n${answer}` : ""}`;
        void pictures
          .request(userId, { id: key, chatId: state.chatId, direction: "parley", text })
          .then((pic) => {
            if (pic) send({ type: "art.update", items: [{ key, state: "ready", url: pic.url, imageId: pic.imageId, cutout: false, via: "inlay" }] }, userId);
            else drawOwnMoment(scenario, state, index, m, figureKey, userId);
          })
          .catch(() => drawOwnMoment(scenario, state, index, m, figureKey, userId));
        continue;
      }
      drawOwnMoment(scenario, state, index, m, figureKey, userId);
    }
  }

  /** Gambit's own picture of a moment (no chat, or Inlay could not make it). */
  function drawOwnMoment(scenario: ParleyScenario, state: ParleyState, index: number, m: NonNullable<ReturnType<typeof parleyMoment>>, figureKey: string, userId: string): void {
    const fig = art.status(figureKey, userId);
    art.request(
      momentArtKey(state.id, index),
      {
        kind: "cg",
        direction: "parley",
        moment: m.moment,
        tags: m.tags,
        cast: [{ character: npcDna(scenario), ...(fig?.state === "ready" && fig.imageId ? { ref: { imageId: fig.imageId } } : {}) }],
        location: { id: scenario.id, name: scenario.name, description: scenario.setting, palette: scenario.npc.look.palette },
      },
      0,
      userId,
    );
  }

  /** After an exchange: journal entries for a win, and the frontend event. */
  async function settle(userId: string, scenario: ParleyScenario, state: ParleyState, exchange: Exchange, narrated: boolean): Promise<void> {
    if (state.end?.kind === "won") await learn(userId, scenario, scenario.reveals ?? []);
    send({ type: "parley.exchange", parleyId: state.id, state, exchange, narrated }, userId);
    if (!narrated) send({ type: "parley.reply", parleyId: state.id, index: exchange.index, text: fallbackReply(scenario, state, exchange), final: true }, userId);
    requestMoments(scenario, state, userId);
  }

  /**
   * The story hears how a Parley ended once its last reply is in: earlier, the page, the night and the
   * people in the scene would all go by the reply before. Once only, or a swiped reply makes the same deeds again.
   */
  async function tellEnd(userId: string, parleyId: string): Promise<void> {
    const key = k(userId, parleyId);
    if (told.has(key)) return;
    const state = await load(userId, parleyId);
    const scenario = state && (await scenarioOf(userId, state.scenarioId));
    if (!state?.end || !scenario?.card || !state.chatId) return;
    told.add(key);
    try {
      endHook?.(userId, scenario, state);
    } catch {
      /* the ledger never breaks a Parley */
    }
  }

  /** Store a reply (and the message that carries the exchange) on the saved exchange. */
  async function remember(userId: string, parleyId: string, index: number, patch: Partial<Pick<Exchange, "reply" | "messageId">>): Promise<void> {
    const fresh = await load(userId, parleyId);
    if (!fresh?.exchanges[index]) return;
    fresh.exchanges[index] = { ...fresh.exchanges[index]!, ...patch };
    await save(userId, fresh);
  }

  /**
   * Gambit's own narrator: one short streamed call that voices the NPC for
   * this exchange, whatever the chat's preset asks for. A rate limit is
   * tried again after a moment, then the helper's connection is asked. Only
   * when all of that fails does a code-written line stand in (`written` false).
   */
  async function gambitNarrate(userId: string, scenario: ParleyScenario, state: ParleyState, ex: Exchange): Promise<{ text: string; written: boolean }> {
    const { system, messages } = narratorPrompt(scenario, state, ex);
    let lastSent = 0;
    const written = await writeWithRetry(
      modelsFor(spindle),
      userId,
      () => ({ messages: [{ role: "system", content: system }, ...messages], parameters: { temperature: 0.9, max_tokens: 700 }, signal: AbortSignal.timeout(40_000) }),
      (t) => {
        if (Date.now() - lastSent > 180) {
          lastSent = Date.now();
          send({ type: "parley.reply", parleyId: state.id, index: ex.index, text: cleanReply(t), final: false }, userId);
        }
      },
      { retryMs, log, usable: (t) => !!cleanReply(t) },
    );
    const clean = cleanReply(written);
    if (!clean) log("no narrator answered; using a short line, kept out of the chat");
    return clean ? { text: clean, written: true } : { text: fallbackReply(scenario, state, ex), written: false };
  }

  /** Post a line to the chat without starting the chat's own reply. */
  async function appendQuiet(chatId: string, role: "user" | "assistant", content: string, meta: ParleyMessageMeta & { npc?: boolean }, name?: string): Promise<string | null> {
    const message = { role, content, metadata: { gambit: { parley: meta } } };
    try {
      return (await spindle.chat.appendMessage(chatId, (name ? { ...message, name } : message) as never, { triggerGeneration: false })).id;
    } catch (err) {
      if (name) {
        try {
          return (await spindle.chat.appendMessage(chatId, message as never, { triggerGeneration: false })).id;
        } catch {
          /* fall through */
        }
      }
      log(`could not post to chat ${chatId}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  async function postToChat(userId: string, state: ParleyState, exchange: Exchange): Promise<boolean> {
    if (!state.chatId) return false;
    try {
      awaiting.set(state.chatId, { userId, parleyId: state.id, index: exchange.index });
      narrating.add(state.chatId);
      const meta: ParleyMessageMeta = { id: state.id, index: exchange.index };
      const posted = await spindle.chat.appendMessage(state.chatId, { role: "user", content: exchange.text, metadata: { gambit: { parley: meta } } } as never, { triggerGeneration: true });
      const fresh = await load(userId, state.id);
      if (fresh?.exchanges[exchange.index]) {
        fresh.exchanges[exchange.index] = { ...fresh.exchanges[exchange.index]!, messageId: posted.id };
        await save(userId, fresh);
      }
      return true;
    } catch (err) {
      awaiting.delete(state.chatId);
      narrating.delete(state.chatId);
      log(`could not post to chat ${state.chatId}: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  return {
    async start(userId: string, scenarioId: string, chatId: string | null) {
      const scenario = PARLEYS[scenarioId];
      if (!scenario) return send({ type: "parley.error", error: `Unknown Parley ${scenarioId}` }, userId);
      await this.startScenario(userId, scenario, chatId);
    },

    /** Start a Parley from any scenario (a card scene is saved first, so it survives reloads). */
    async startScenario(userId: string, scenario: ParleyScenario, chatId: string | null) {
      if (!PARLEYS[scenario.id]) {
        scenes.set(k(userId, scenario.id), scenario);
        await spindle.userStorage.setJson(scenePath(scenario.id), scenario, { userId });
      }
      const base = createParley(scenario, crypto.randomUUID().slice(0, 8), chatId);
      const known = new Set([...base.known, ...(await journal(userId, scenario)).filter((id) => scenario.facts.some((f) => f.id === id))]);
      const state: ParleyState = { ...base, known: [...known] };
      await save(userId, state);
      await spindle.userStorage.setJson(CURRENT, { id: state.id, chatId } satisfies Current, { userId });
      await pushState(userId, state);
      requestNpcArt(scenario, userId);
      return state.id;
    },

    async resume(userId: string) {
      const cur = await current(userId);
      if (!cur.id) return;
      const state = await load(userId, cur.id);
      const scenario = state && (await scenarioOf(userId, state.scenarioId));
      if (state && scenario && !state.end) {
        await pushState(userId, state, true);
        requestNpcArt(scenario, userId);
        requestMoments(scenario, state, userId);
      }
    },

    async say(userId: string, parleyId: string, text: string) {
      const line = text.trim();
      if (!line) return;
      const bk = k(userId, parleyId);
      if (busy.has(bk)) return send({ type: "parley.error", error: "Still judging the last line." }, userId);
      busy.add(bk);
      try {
        const state = await load(userId, parleyId);
        const scenario = state && (await scenarioOf(userId, state.scenarioId));
        if (!state || !scenario) return send({ type: "parley.error", error: "That Parley is gone." }, userId);
        if (state.end) return send({ type: "parley.error", error: "This Parley is over." }, userId);
        const read = await judge(spindle, scenario, state, line, userId, { log });
        const r = applyExchange(scenario, state, line, read);
        await save(userId, r.state);
        log(`${parleyId} #${r.exchange.index}: ${read.by} read ${read.tactic}, tier ${r.exchange.tier}, ${r.exchange.roll.result}`);
        const chatId = r.state.chatId;
        if (chatId && (await narratorMode(userId)) === "chat") {
          // The chat's own model voices the NPC; the interceptor hands it the outcome.
          const narrated = await postToChat(userId, r.state, r.exchange);
          await settle(userId, scenario, (await load(userId, parleyId)) ?? r.state, r.exchange, narrated);
          // Narrated: its end comes with the reply (onGenerationEnded). Otherwise no reply is coming.
          if (!narrated) await tellEnd(userId, parleyId);
          return;
        }
        // Gambit's narrator: post the line, play the dice, write the reply, post it as the NPC.
        const meta: ParleyMessageMeta = { id: parleyId, index: r.exchange.index };
        const lineId = chatId ? await appendQuiet(chatId, "user", line, meta) : null;
        if (lineId) await remember(userId, parleyId, r.exchange.index, { messageId: lineId });
        await settle(userId, scenario, (await load(userId, parleyId)) ?? r.state, r.exchange, true);
        const { text: reply, written } = await gambitNarrate(userId, scenario, r.state, r.exchange);
        await remember(userId, parleyId, r.exchange.index, { reply });
        send({ type: "parley.reply", parleyId, index: r.exchange.index, text: reply, final: true }, userId);
        // The chat keeps what a narrator wrote. A stand-in line is for the Parley on screen, not the story.
        if (chatId && written) await appendQuiet(chatId, "assistant", reply, { ...meta, npc: true }, scenario.npc.name);
        await tellEnd(userId, parleyId);
      } finally {
        busy.delete(bk);
      }
    },

    async close(userId: string, parleyId: string, how: "deal" | "walk") {
      // A line still being judged would save over this ending; a second tap would end it twice.
      const bk = k(userId, parleyId);
      if (busy.has(bk)) return send({ type: "parley.error", error: "Still judging the last line." }, userId);
      busy.add(bk);
      try {
        const state = await load(userId, parleyId);
        const scenario = state && (await scenarioOf(userId, state.scenarioId));
        if (!state || !scenario) return;
        if (how === "deal" && !canPay(scenario, state.value)) return send({ type: "parley.error", error: "You don't have that much." }, userId);
        const closed = closeParley(scenario, state, how);
        await save(userId, closed);
        if (closed !== state && scenario.card && closed.chatId) {
          try {
            endHook?.(userId, scenario, closed);
          } catch {
            /* the ledger never breaks a Parley */
          }
        }
        await pushState(userId, closed);
      } finally {
        busy.delete(bk);
      }
    },

    async setNarrator(userId: string, mode: ParleyNarrator) {
      await spindle.userStorage.setJson(SETTINGS, { ...(await settings(userId)), parleyNarrator: mode }, { userId });
      send({ type: "parley.narrator", mode }, userId);
    },

    async setView(userId: string, mode: ParleyViewMode) {
      await spindle.userStorage.setJson(SETTINGS, { ...(await settings(userId)), parleyView: mode }, { userId });
      send({ type: "parley.view", mode }, userId);
    },

    async resetJournal(userId: string) {
      const cur = await current(userId);
      const state = cur.id ? await load(userId, cur.id) : null;
      const scenario = state ? await scenarioOf(userId, state.scenarioId) : null;
      await spindle.userStorage.setJson(JOURNAL, { known: [] }, { userId });
      if (scenario?.card) await spindle.userStorage.setJson(journalPath(scenario), { known: [] }, { userId });
      if (state) await pushState(userId, state);
    },

    /** The Parley open in this chat, if any (contest chips stay quiet while one is open). */
    async openIn(userId: string, chatId: string): Promise<boolean> {
      const cur = await current(userId);
      if (!cur.id || cur.chatId !== chatId) return false;
      const state = await load(userId, cur.id);
      return !!state && !state.end;
    },

    /** The chat is waiting on a Parley narration (that reply is not roleplay to scan for contests). */
    awaitingIn(chatId: string): boolean {
      return narrating.has(chatId);
    },

    setEndHook(h: ParleyEndHook) {
      endHook = h;
    },

    /** Prompt pipeline: inject the decided outcome (and judge composer lines inline). */
    async intercept(messages: LlmMessageDTO[], ctx: InterceptorContextDTO): Promise<LlmMessageDTO[] | InterceptorResultDTO> {
      if (ctx.generationType === "quiet" || ctx.generationType === "impersonate" || ctx.isDryRun) return messages;
      let lastUser = -1;
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i]!;
        if (m.role === "user" && m.__isChatHistory !== false && (m.sourceMessageId || m.__isChatHistory)) {
          lastUser = i;
          break;
        }
      }
      const userMsg = lastUser >= 0 ? messages[lastUser] : undefined;
      // The outcome rides on the latest user turn as a bracketed note, and again
      // as the very last message. A trailing system message alone is not enough:
      // some providers (Gemini, Vertex) fold system messages into the system
      // instruction, where a long preset drowns it out.
      const inject = (content: string): InterceptorResultDTO => {
        const out = messages.slice();
        if (lastUser >= 0 && typeof out[lastUser]!.content === "string") {
          out[lastUser] = { ...out[lastUser]!, content: `${out[lastUser]!.content as string}\n\n(OOC — game engine note, not part of my line:\n${content})` };
        }
        const note: LlmMessageDTO = { role: "system", content };
        const all = withSuffix(out, note);
        return { messages: all, breakdown: [{ messageIndex: all.indexOf(note), name: "Gambit Parley" }] };
      };

      // 1. The latest line already carries a decided exchange: narrate it.
      const meta = metaOf(userMsg?.sourceMessageMetadata);
      if (meta) {
        const state = await load(ctx.userId, meta.id);
        const scenario = state && (await scenarioOf(ctx.userId, state.scenarioId));
        const ex = state?.exchanges[meta.index];
        if (state && scenario && ex) {
          awaiting.set(ctx.chatId, { userId: ctx.userId, parleyId: state.id, index: ex.index });
          narrating.add(ctx.chatId);
          return inject(outcomeBlock(scenario, { ...state, value: ex.after.value, patience: ex.after.patience }, ex));
        }
        return messages;
      }

      // 2. A Parley is open in this chat: judge a composer line inline, or keep the narrator briefed.
      const cur = await current(ctx.userId);
      if (!cur.id || cur.chatId !== ctx.chatId) return messages;
      const state = await load(ctx.userId, cur.id);
      const scenario = state && (await scenarioOf(ctx.userId, state.scenarioId));
      if (!state || !scenario || state.end) return messages;
      const text = textOf(userMsg).trim();
      const already = state.exchanges.some((e) => e.messageId && e.messageId === userMsg?.sourceMessageId);
      if (ctx.generationType === "normal" && userMsg?.sourceMessageId && text && !already && !busy.has(k(ctx.userId, state.id))) {
        const bk = k(ctx.userId, state.id);
        busy.add(bk);
        try {
          send({ type: "parley.judging", parleyId: state.id, text }, ctx.userId);
          const read = await judge(spindle, scenario, state, text, ctx.userId, { deadline: ctx.interceptorDeadlineAt - 3000, log });
          const r = applyExchange(scenario, state, text, read);
          r.exchange.messageId = userMsg.sourceMessageId;
          await save(ctx.userId, r.state);
          const meta: ParleyMessageMeta = { id: state.id, index: r.exchange.index };
          await spindle.chat
            .updateMessage(ctx.chatId, userMsg.sourceMessageId, { ownMetadata: { parley: meta } })
            .catch(() => spindle.chat.updateMessage(ctx.chatId, userMsg.sourceMessageId!, { metadata_patch: { gambit: { parley: meta } } }))
            .catch((err: unknown) => log(`could not tag message: ${err instanceof Error ? err.message : String(err)}`));
          awaiting.set(ctx.chatId, { userId: ctx.userId, parleyId: state.id, index: r.exchange.index });
          narrating.add(ctx.chatId);
          await settle(ctx.userId, scenario, r.state, r.exchange, true);
          return inject(outcomeBlock(scenario, r.state, r.exchange));
        } finally {
          busy.delete(bk);
        }
      }
      return inject(sceneBlock(scenario, state));
    },

    /**
     * The narrator finished, failed or was stopped: the Parley view gets a final reply either way, or its input
     * stays locked. This generation was the exchange's; a swipe briefs a new one through the interceptor, and any
     * other reply in this chat must not be taken for it.
     */
    async onGenerationEnded(chatId: string, content: string | undefined, userId?: string) {
      narrating.delete(chatId);
      const s = streams.get(chatId);
      if (s?.timer) clearTimeout(s.timer);
      streams.delete(chatId);
      const w = awaiting.get(chatId);
      if (!w || (userId && w.userId !== userId)) return;
      awaiting.delete(chatId);
      if (content) {
        send({ type: "parley.reply", parleyId: w.parleyId, index: w.index, text: content, final: true }, w.userId);
        await remember(w.userId, w.parleyId, w.index, { reply: cleanReply(content, 400) }).catch(() => {});
        await tellEnd(w.userId, w.parleyId);
        return;
      }
      const state = await load(w.userId, w.parleyId);
      const scenario = state && (await scenarioOf(w.userId, state.scenarioId));
      const ex = state?.exchanges[w.index];
      if (!state || !scenario || !ex) return send({ type: "parley.error", error: "The narrator stopped before answering." }, w.userId);
      const text = ex.reply || fallbackReply(scenario, state, ex);
      send({ type: "parley.reply", parleyId: w.parleyId, index: w.index, text, final: true }, w.userId);
      if (!ex.reply) await remember(w.userId, w.parleyId, w.index, { reply: text }).catch(() => {});
      await tellEnd(w.userId, w.parleyId);
    },

    onGenerationStarted(chatId: string) {
      streams.delete(chatId);
    },

    /** Stream the narration into the Parley view, a few times a second. */
    onStreamToken(chatId: string, token: string, reasoning: boolean, userId?: string) {
      const w = awaiting.get(chatId);
      if (!w || reasoning || (userId && w.userId !== userId)) return;
      const s = streams.get(chatId) ?? { text: "", timer: null as ReturnType<typeof setTimeout> | null };
      s.text += token;
      streams.set(chatId, s);
      if (s.timer) return;
      s.timer = setTimeout(() => {
        s.timer = null;
        if (streams.get(chatId) === s) send({ type: "parley.reply", parleyId: w.parleyId, index: w.index, text: s.text, final: false }, w.userId);
      }, 180);
    },

    /** A Parley line was deleted: rewind to before it. */
    async onMessageDeleted(chatId: string, messageId: string, userId: string) {
      const cur = await current(userId);
      if (!cur.id || cur.chatId !== chatId) return;
      const state = await load(userId, cur.id);
      const scenario = state && (await scenarioOf(userId, state.scenarioId));
      const at = state?.exchanges.findIndex((e) => e.messageId === messageId) ?? -1;
      if (!state || !scenario || at < 0) return;
      const rewound = replayParley(scenario, state, state.exchanges.slice(0, at).map((e) => ({ text: e.text, read: e.read, messageId: e.messageId, reply: e.reply })));
      await save(userId, rewound);
      log(`${state.id}: rewound to exchange ${at} after a deleted message`);
      await pushState(userId, rewound);
    },

    /** A Parley line was edited: re-judge the new words with the same die faces. */
    async onMessageEdited(chatId: string, messageId: string, content: string, userId: string) {
      const cur = await current(userId);
      if (!cur.id || cur.chatId !== chatId) return;
      const state = await load(userId, cur.id);
      const scenario = state && (await scenarioOf(userId, state.scenarioId));
      const at = state?.exchanges.findIndex((e) => e.messageId === messageId) ?? -1;
      if (!state || !scenario || at < 0 || state.exchanges[at]!.text === content.trim()) return;
      const before = replayParley(scenario, state, state.exchanges.slice(0, at).map((e) => ({ text: e.text, read: e.read, messageId: e.messageId, reply: e.reply })));
      const read: RefereeRead = await judge(spindle, scenario, before, content.trim(), userId, { log });
      const inputs = state.exchanges.map((e, i) => (i === at ? { text: content.trim(), read, messageId: e.messageId } : { text: e.text, read: e.read, messageId: e.messageId, reply: e.reply }));
      const redone = replayParley(scenario, state, inputs);
      await save(userId, redone);
      log(`${state.id}: re-judged edited exchange ${at}`);
      await pushState(userId, redone);
    },
  };
}
