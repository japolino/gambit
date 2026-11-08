/**
 * Play on a card (docs/DESIGN.md 6.1, M4): the chat's world, where the
 * player is in it, the scene menu, fights built from the card's foes, and
 * delves walked room by room. One record per chat. The chat stays the
 * story: travel, finds and fights post short narrated asides into it.
 */
import type { SpindleAPI } from "lumiverse-spindle-types";
import type { ArtApi } from "../art/controller.js";
import { advance, createBattle } from "../engine/battle.js";
import { chooseAction } from "../engine/ai.js";
import { encounterFrom, foeFromCast, partyFromSheet } from "../engine/card/foes.js";
import { kitClass } from "../engine/card/kits.js";
import type { CardSheet, CardSources } from "../engine/card/types.js";
import { camp as boardCamp, dealBoard, moveTo as boardMove, openLore, skip as boardSkip, winFight, type Board, type BoardEvent, type LoreCard } from "../engine/world/board.js";
import { boardLore, glimpse, loreScenePrompt, parseLoreScene } from "../meaning/board-deck.js";

export type BoardOp = "move" | "lore" | "camp" | "skip" | "leave";
import type { BattleState, MonsterDef } from "../engine/types.js";
import { clearRoom, enterDelve, generateDelve, stepDelve, type DelveMove } from "../engine/world/delve.js";
import { addPlace, applyTraits, buildWorld, clockTo, moveScene, newScene, searchScene, seatPeople, sleepScene, TIMES, unjudged } from "../engine/world/places.js";
import { createSenses } from "./senses.js";
import { PLACE_TRAITS as PLACE_FLAGS, type CompanionLike } from "../meaning/senses.js";
import { addHexPlace, buildHex, cellOf, hexKey, hexPath, newHex, reveal, stepHex, SUPPLY_MAX, TERRAIN_NAME } from "../engine/world/hex.js";
import { fallbackPlaceFromChat, parsePlaceFromChat, placeFromChatPrompt, type Bible } from "../meaning/bible.js";
import { modelsFor } from "./models.js";
import { resolveBeat, rollLine } from "../engine/story/beat.js";
import { fallbackReply as storyFallback, judgePrompt, narratorPrompt as storyNarrator, parseRead, rulesRead as storyRules, type StoryContext } from "../meaning/story.js";
import { cleanReply } from "../engine/parley/narrate.js";
import { fallbackVignettes, meanwhilePrompt, meanwhileText, parseMeanwhile, type Vignette } from "../meaning/meanwhile.js";
import { slug } from "../meaning/card-reader.js";
import type { Ledger } from "./ledger.js";
import type { Jaot, Priority } from "./jaot.js";
import {
  adaptations,
  adaptFoes,
  adaptMonster,
  BOND_AT,
  companionsReact,
  deedsFromBattle,
  deedsFromParley,
  MAX_PARTY,
  NOTICE,
  profileOf,
  readyToPromote,
  remember,
  type Deed,
  type Promotion,
} from "../engine/memory/memory.js";
import { fallbackNight, fallbackPromotion, nightPrompt, parseNight, parsePromotion, promotedId, promotePrompt } from "../meaning/night.js";
import { baseClassFor } from "../engine/card/foes.js";
import { bookOf, createForge } from "./forge.js";
import { rankOf } from "../engine/forge/forge.js";
import type { ForgeOp } from "../shared/forge-view.js";
import type { ClassDef } from "../engine/types.js";
import { solveSkill } from "../engine/budget.js";
import type { CastMember } from "../engine/card/types.js";
import { figureCaption, figureTagsPrompt, hasCharacterTag, parseFigureTags, withReaderTags } from "../meaning/figure-tags.js";
import type { ParleyScenario, ParleyState } from "../engine/parley/types.js";
import type { InterceptorContextDTO, LlmMessageDTO } from "lumiverse-spindle-types";
import { figureArtKey, npcArtKey } from "../shared/art-keys.js";
import type { CharacterDNA } from "../art/specs.js";
import { createFigurePrints } from "./figure-prints.js";
import type { ToFrontend } from "../shared/protocol.js";
import type { ThemeId } from "../shared/scene-view.js";
import { boardMapKey, buildSceneView, cardTag, menuFor, newMemory, placeArt, placeKey, wallKey, WILD_TEXT, wildCell, type MemoryRecord, type PlayRecord } from "../shared/scene-build.js";

type Send = (msg: ToFrontend, userId: string) => void;


export interface CardsPort {
  sheetFor(userId: string, chatId: string): Promise<CardSheet | null>;
  armory(userId: string, chatId: string): Promise<CardSheet | null>;
  talk(userId: string, chatId: string, castId: string): Promise<void>;
  recent?(userId: string, chatId: string, n: number): Promise<{ name: string; content: string; isUser: boolean }[]>;
  /** The lorebook's text about a name, for promotions (meaning/lore-pick.ts loreAbout). */
  loreFor?(userId: string, chatId: string, name: string): Promise<string>;
  markKnown?(userId: string, chatId: string, factId: string): Promise<void>;
  /** The card's sources with its lorebook, for an expedition board's deck. */
  sourcesFor?(userId: string, chatId: string): Promise<CardSources | null>;
  inlayLook?(userId: string, sheet: CardSheet, m: CastMember): Promise<{ tags: string; sex?: "girl" | "boy" | "other" } | null>;
  /** The World Bible (M5): compiled on the JAOT queue, or the stored one. */
  bible?(userId: string, chatId: string, priority?: Priority): Promise<Bible | null>;
  storedBible?(userId: string, cardKey: string, sheet?: Pick<CardSheet, "readAt" | "shape">): Promise<Bible | null>;
  compile?: Ledger["compile"];
  jaot?: Jaot;
}

export interface BattlesPort {
  startState(userId: string, state: BattleState): Promise<void>;
}

const path = (chatId: string) => `play/${chatId}.json`;
const tag = cardTag;

/** How a Parley ended, as the moment its CG shows. */
const PARLEY_END_SCENE: Record<"won" | "final_offer" | "deal" | "walked" | "refused", string> = {
  won: "they give in and agree, won over",
  final_offer: "they make one last offer, arms folded",
  deal: "they strike a deal and shake on it",
  walked: "one of them turns and walks away",
  refused: "they refuse flatly, the door closing",
};
const view = buildSceneView;

export function createPlay(spindle: SpindleAPI, send: Send, art: ArtApi, cards: CardsPort, battles: BattlesPort) {
  const log = (m: string) => {
    try {
      spindle.log.info(`gambit play: ${m}`);
    } catch {
      /* best effort */
    }
  };
  const load = (userId: string, chatId: string) => spindle.userStorage.getJson<PlayRecord | null>(path(chatId), { fallback: null, userId });
  const save = (userId: string, chatId: string, r: PlayRecord) => spindle.userStorage.setJson(path(chatId), r, { userId });

  /** A short narrated line in the chat, without starting the character's reply. */
  async function aside(chatId: string, text: string): Promise<void> {
    try {
      await spindle.chat.appendMessage(chatId, { role: "assistant", content: `*${text}*`, metadata: { gambit: { aside: true } } } as never, { triggerGeneration: false });
    } catch (err) {
      log(`could not post to ${chatId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** A finished CG goes into the chat as a picture with its caption (an aside, no reply). */
  async function picture(chatId: string, imageId: string, caption: string): Promise<void> {
    const alt = caption.replace(/[\[\]\n]/g, " ").slice(0, 120);
    try {
      await spindle.chat.appendMessage(chatId, { role: "assistant", content: `![${alt}](/api/v1/images/${imageId})\n\n*${caption}*`, metadata: { gambit: { aside: true, cg: true } } } as never, { triggerGeneration: false });
    } catch (err) {
      log(`could not post a picture to ${chatId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const forge = createForge({ spindle, send, art, sheetFor: (u, c) => cards.sheetFor(u, c), ...(cards.compile ? { compile: cards.compile } : {}), load, save, aside, log });

  /** Merge the World Bible's places and thread into a chat's world (4.5). True when anything changed. */
  function mergeBible(sheet: CardSheet, r: PlayRecord, b: Bible): boolean {
    if (r.bibleAt === b.at) return false;
    let world = r.world;
    for (const p of b.places) world = addPlace(world, sheet, { ...p, added: !p.evidence.verified }, p.near);
    if (sheet.shape === "frontier" && Object.keys(world.places).length > 1) world = { ...world, shape: "frontier" };
    r.world = world;
    r.bibleAt = b.at;
    if (b.thread && !r.thread) r.thread = b.thread;
    if (r.hex) for (const p of b.places) r.hex.map = addHexPlace(r.hex.map, r.world, p.id, p.near);
    return true;
  }

  /** Frontier worlds walk on the honeycomb overland (6.1). */
  function ensureHex(r: PlayRecord, chatId: string): boolean {
    if (r.world.shape !== "frontier" || r.hex) return false;
    const map = buildHex(r.world, `${r.cardKey}:${chatId}:hex`);
    r.hex = { map, state: newHex(map, cellOf(map, r.scene.placeId)) };
    return true;
  }

  const growing = new Set<string>();
  /** No Bible yet: compile it (P1) and grow the world when it lands, without making the player wait. */
  function growLater(userId: string, chatId: string): void {
    const k = `${userId}:${chatId}`;
    if (!cards.bible || growing.has(k)) return;
    growing.add(k);
    void cards
      .bible(userId, chatId, 1)
      .then(async (b) => {
        if (!b) return;
        const sheet = await cards.sheetFor(userId, chatId);
        const r = await load(userId, chatId);
        if (!sheet || !r || r.cardKey !== sheet.cardKey || !mergeBible(sheet, r, b)) return;
        ensureHex(r, chatId);
        if (b.places.length) note(r, `The world grows: ${b.places.map((p) => p.name).join(", ")}.`);
        await save(userId, chatId, r);
        await show(userId, chatId, sheet, r);
      })
      .catch((err) => log(`bible: ${err instanceof Error ? err.message : String(err)}`))
      .finally(() => growing.delete(k));
  }

  async function record(userId: string, chatId: string, sheet: CardSheet): Promise<PlayRecord> {
    let r = await load(userId, chatId);
    let changed = false;
    if (!r || r.cardKey !== sheet.cardKey || r.v !== 1) {
      const world = buildWorld(sheet, `${sheet.cardKey}:${chatId}`);
      r = { v: 1, cardKey: sheet.cardKey, world, scene: newScene(world), theme: sheet.shape === "delve" ? "onebit" : "storybook", log: [] };
      changed = true;
    }
    const b = (await cards.storedBible?.(userId, sheet.cardKey, sheet).catch(() => null)) ?? null;
    if (b) changed = mergeBible(sheet, r, b) || changed;
    else growLater(userId, chatId);
    changed = ensureHex(r, chatId) || changed;
    if (changed) await save(userId, chatId, r);
    judgeLater(userId, chatId, sheet, r);
    return r;
  }

  /* --------------- decision models (backend/senses.ts, DESIGN 9) --------------- */
  const senses = createSenses(spindle, log);
  const judging = new Map<string, number>();
  /**
   * Places still on the word rules are judged by the Decision model once,
   * in the background; the menu updates when the answer lands. Without a
   * Decision model the word flags stay (tried again after a while).
   */
  function judgeLater(userId: string, chatId: string, sheet: CardSheet, r: PlayRecord): void {
    const k = `${userId}:${chatId}`;
    const todo = unjudged(r.world);
    if (!todo.length || (judging.get(k) ?? 0) > Date.now()) return;
    judging.set(k, Date.now() + 5 * 60_000);
    void senses
      .classifyPlaces(userId, `${sheet.cardName} (${sheet.skin.genre}): ${sheet.premise}`, todo)
      .then(async (traits) => {
        if (!traits || !Object.keys(traits).length) return;
        const fresh = await load(userId, chatId);
        if (!fresh || fresh.cardKey !== sheet.cardKey) return;
        fresh.world = applyTraits(fresh.world, sheet, traits);
        await save(userId, chatId, fresh);
        // New places (the Bible, the chat) are judged soon; failures wait the full cooldown.
        judging.set(k, Date.now() + 30_000);
        log(`places: judged ${Object.keys(traits).length} (${Object.entries(traits).map(([id, t]) => `${fresh.world.places[id]?.name ?? id}: ${PLACE_FLAGS.filter((f) => t[f]).join("/") || "plain"}`).join("; ")})`);
        if (!fresh.battleId) await show(userId, chatId, sheet, fresh);
      })
      .catch((err) => log(`places: ${err instanceof Error ? err.message : String(err)}`));
  }

  /** Who reacts to deeds: the card's main cast and the recruits. */
  const companionsOf = (sheet: CardSheet, m: MemoryRecord): CompanionLike[] => [
    ...sheet.cast.filter((c) => c.main).map((c) => ({ id: c.id, name: c.name, role: c.role, warmth: c.temperament?.warmth ?? 2, wants: c.wants, fears: c.fears })),
    ...m.recruits.map((x) => ({ id: x.id, name: x.name, role: x.role, warmth: 2 })),
  ];

  /** Companions react to a fight's deeds: the Decision model reads who they are; the warmth rule covers the rest. */
  function reactLater(userId: string, chatId: string, sheet: CardSheet, deeds: Deed[]): void {
    void (async () => {
      const r0 = await load(userId, chatId);
      if (!r0) return;
      const companions = companionsOf(sheet, mem(r0));
      const judged = await senses.reactions(userId, companions, deeds).catch(() => ({}));
      const r = await load(userId, chatId);
      if (!r) return;
      const m = mem(r);
      m.npc = companionsReact(m.npc, deeds, companions, judged);
      await save(userId, chatId, r);
    })().catch((err) => log(`reactions: ${err instanceof Error ? err.message : String(err)}`));
  }

  /** The chat's memory, created on first use. */
  const mem = (r: PlayRecord): MemoryRecord => (r.memory ??= newMemory());

  /** The card's sheet with the people this chat's world promoted, so they can be talked to and drawn. */
  function withPromoted(sheet: CardSheet, r: PlayRecord): CardSheet {
    const extra = (r.memory?.promoted ?? []).map((p) => p.castId && (p as Promotion & { cast?: CastMember }).cast).filter((c): c is CastMember => !!c && !sheet.cast.some((x) => x.id === c.id));
    return extra.length ? { ...sheet, cast: [...sheet.cast, ...extra] } : sheet;
  }

  /** Add deeds to the ledger and let people remember them. `react: false` leaves companions to reactLater. */
  function record_(sheet: CardSheet, r: PlayRecord, deeds: Deed[], react = true): void {
    if (!deeds.length) return;
    const m = mem(r);
    m.deeds = [...m.deeds, ...deeds].slice(-300);
    m.nightAt = Math.min(m.nightAt, m.deeds.length);
    const cast = new Set([...sheet.cast.map((c) => c.id), ...m.promoted.map((p) => p.castId).filter((x): x is string => !!x)]);
    m.npc = remember(m.npc, deeds, cast, sheet.player.name);
    if (react) m.npc = companionsReact(m.npc, deeds, companionsOf(sheet, m));
  }

  /** Notice: interest in a person or place goes up. */
  function interest(r: PlayRecord, key: string, n: number): void {
    const m = mem(r);
    m.interest[key] = Math.round(((m.interest[key] ?? 0) + n) * 10) / 10;
  }

  const note = (r: PlayRecord, text: string) => {
    if (r.log[r.log.length - 1] === text) return;
    r.log = [...r.log, text].slice(-6);
  };


  /** What keeps a card character the same person in every picture Gambit draws of them. */
  function castDna(sheet: CardSheet, m: CastMember): CharacterDNA {
    const id = `${sheet.cardKey}:${m.id}`;
    return {
      id,
      name: m.name,
      tags: m.look,
      description: `${m.name}: ${m.look || m.role}`,
      seed: [...id].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261) >>> 0,
      sex: m.pronoun === "she" ? "girl" : m.pronoun === "he" ? "boy" : "other",
    };
  }

  /**
   * Tags for a cast member, looked up once per card and person: Inlay's
   * (character tag, body, outfit) when its library knows them, else the
   * reader model's (their Danbooru character tag and appearance), kept in
   * the ledger.
   */
  const inlayTags = new Map<string, Promise<{ tags: string; sex?: "girl" | "boy" | "other" } | null>>();
  function inlayFor(userId: string, sheet: CardSheet, m: CastMember) {
    const k = `${userId}:${sheet.cardKey}:${m.id}`;
    let p = inlayTags.get(k);
    if (!p) {
      p = (async () => {
        const look = cards.inlayLook ? await cards.inlayLook(userId, sheet, m).catch(() => null) : null;
        if (look?.tags && hasCharacterTag(look.tags)) return look;
        const reader = cards.compile ? ((await cards.compile(userId, "figure-tags", figureTagsPrompt(sheet, m), 400, parseFigureTags, () => null, { tries: 2 }).catch(() => null))?.value ?? null) : null;
        // Inlay's traits without a character tag draw a generic person: the reader's character tag goes in front.
        if (look?.tags) return { ...look, tags: withReaderTags(look.tags, reader) };
        return reader ? { tags: figureCaption(reader), ...(reader.sex !== "other" ? { sex: reader.sex } : {}) } : null;
      })();
      inlayTags.set(k, p);
      // A miss is asked again later (Inlay may get a document for them).
      void p.then((x) => !x && setTimeout(() => inlayTags.delete(k), 5 * 60_000));
    }
    return p;
  }

  /** castDna with Inlay's tags as the caption when Inlay knows them. */
  async function tagDna(userId: string, sheet: CardSheet, m: CastMember): Promise<CharacterDNA> {
    const dna = castDna(sheet, m);
    const look = await inlayFor(userId, sheet, m);
    return look?.tags ? { ...dna, booru: look.tags, ...(look.sex ? { sex: look.sex } : {}) } : dna;
  }

  /**
   * A cast member's full figure, drawn by V5 from their tags (Inlay's when
   * there, else the reader's; no reference image), transparent. It replaces
   * their framed card art, or the old bust portrait. Returns its key.
   */
  function requestFigure(userId: string, sheet: CardSheet, m: CastMember, priority: 0 | 1 | 2): string | null {
    const key = figureArtKey(sheet.cardKey, m.id);
    // Ready: asking again re-sends it (a reloaded page has no other way to learn it); the spec is not used.
    const ready = art.status(key, userId)?.state === "ready";
    if (ready) art.request(key, { kind: "figure", character: castDna(sheet, m) }, priority, userId);
    void tagDna(userId, sheet, m)
      .then((character) => figures.request(userId, key, character, priority, log))
      .catch(() => undefined);
    return key;
  }
  const figures = createFigurePrints(spindle, art);

  /**
   * A key moment as a CG: a wide illustration with the people in it drawn
   * from their own figures (or card art) as references, set where it
   * happens. It joins the album, and when chatId is given the finished
   * picture is posted to the chat. Returns its art key.
   */
  function requestCg(userId: string, sheet: CardSheet, r: PlayRecord, o: { moment: string; caption: string; cast?: string[]; placeId?: string; chatId?: string; priority?: 0 | 1 | 2 }): string {
    const h = [...`${o.moment}|${r.scene.day}`].reduce((x, ch) => Math.imul(x ^ ch.charCodeAt(0), 16777619), 2166136261) >>> 0;
    const key = `cg:${tag(sheet.cardKey)}.${h.toString(36)}`;
    const people = withPromoted(sheet, r).cast;
    const members = [...new Set(o.cast ?? [])]
      .map((id) => people.find((c) => c.id === id))
      .filter((m): m is CastMember => !!m)
      .slice(0, 3);
    const placeId = o.placeId ?? r.scene.placeId;
    const wild = placeId.startsWith("wild_") ? (placeId.slice(5) as keyof typeof WILD_TEXT) : null;
    const p = wild ? null : r.world.places[placeId];
    const location = wild
      ? { id: `${tag(sheet.cardKey)}.${placeId}`, name: TERRAIN_NAME[wild], description: `${WILD_TEXT[wild]}. The land of ${sheet.cardName}` }
      : p
        ? { id: `${tag(sheet.cardKey)}.${p.id}`, name: p.name, description: p.description, timeOfDay: TIMES[r.scene.time] }
        : undefined;
    const before = art.status(key, userId);
    if (!(r.album ?? []).some((x) => x.key === key)) r.album = [...(r.album ?? []), { key, caption: o.caption, day: r.scene.day }].slice(-48);
    if (before?.state === "ready") return key;
    const chatId = o.chatId;
    // Each person by their tags (Inlay's when there); their figure rides along only for a GPT edit.
    void Promise.all(
      members.map(async (m) => {
        const fig = art.status(figureArtKey(sheet.cardKey, m.id), userId);
        return { character: await tagDna(userId, sheet, m), ...(fig?.state === "ready" && fig.imageId ? { ref: { imageId: fig.imageId } } : {}) };
      }),
    )
      .then((cast) => {
        art.request(key, { kind: "cg", moment: `${o.moment}. From ${sheet.cardName} (${sheet.skin.genre})`, cast, ...(location ? { location } : {}) }, o.priority ?? 1, userId);
        return chatId ? art.whenDone(key, userId) : null;
      })
      .then((st) => (chatId && st?.state === "ready" && st.imageId ? picture(chatId, st.imageId, o.caption) : undefined))
      .catch(() => {});
    return key;
  }

  /** The board's map (the place from above, in the painting's style) and its party's figures. */
  function requestBoardArt(userId: string, sheet: CardSheet, r: PlayRecord): void {
    const b = r.board!;
    const wild = b.placeId.startsWith("wild_") ? (b.placeId.slice(5) as keyof typeof WILD_TEXT) : null;
    const p = wild ? null : r.world.places[b.placeId];
    const paintingKey = wild ? placeKey(sheet, b.placeId) : placeArt(sheet, r, b.placeId);
    const painting = art.status(paintingKey, userId);
    art.request(
      boardMapKey(sheet, b.placeId),
      {
        kind: "map",
        location: { id: `${tag(sheet.cardKey)}.${b.placeId}.map`, name: wild ? TERRAIN_NAME[wild] : (p?.name ?? "the way"), description: wild ? `${WILD_TEXT[wild]}. The land of ${sheet.cardName}` : `${p?.description ?? ""}. ${sheet.premise.slice(0, 120)}` },
        ...(painting?.state === "ready" && painting.imageId ? { painting: { imageId: painting.imageId } } : {}),
      },
      0,
      userId,
    );
    for (const m of b.party) {
      const c = sheet.cast.find((x) => `p_${x.id}` === m.id);
      if (c) requestFigure(userId, sheet, c, 1);
    }
  }

  /** Ask for the place's painting and the art of anyone here without art of their own. */
  function requestSceneArt(userId: string, sheet: CardSheet, r: PlayRecord): void {
    const p = r.world.places[r.scene.placeId];
    if (!p) return;
    const when = TIMES[r.scene.time];
    const wild = wildCell(r);
    if (wild) {
      art.request(placeKey(sheet, `wild_${wild}`), { kind: "background", location: { id: `${tag(sheet.cardKey)}.wild_${wild}`, name: TERRAIN_NAME[wild], description: `${WILD_TEXT[wild]}. The land of ${sheet.cardName} (${sheet.skin.genre})`, timeOfDay: when } }, 0, userId);
    }
    art.request(placeKey(sheet, p.id), { kind: "background", location: { id: `${tag(sheet.cardKey)}.${p.id}`, name: p.name, description: `${p.description}. ${sheet.premise.slice(0, 160)}`, timeOfDay: when } }, 0, userId);
    if (r.memory?.scars[p.id]) requestScarArt(userId, sheet, r, p.id);
    for (const id of p.exits) {
      const q = r.world.places[id];
      if (q) art.request(placeKey(sheet, q.id), { kind: "background", location: { id: `${tag(sheet.cardKey)}.${q.id}`, name: q.name, description: q.description } }, 2, userId);
    }
    // Everyone here gets their own full figure from their tags (Inlay's character library first).
    for (const m of sheet.cast.filter((c) => p.people.includes(c.id))) requestFigure(userId, sheet, m, 1);
    if (r.board) requestBoardArt(userId, sheet, r);
    if (r.delve) {
      const d = r.delve;
      art.request(wallKey(sheet, d.placeId), { kind: "background", location: { id: `${tag(sheet.cardKey)}.${d.placeId}.wall`, name: `${r.world.places[d.placeId]?.name ?? "delve"} wall`, description: `seamless tileable texture of a stone wall inside ${r.world.places[d.placeId]?.description ?? "a dungeon"}, flat, front view, no perspective, no objects` } }, 2, userId);
    }
  }


  async function show(userId: string, chatId: string, sheet: CardSheet, r: PlayRecord, busy?: string): Promise<void> {
    const s = withPromoted(sheet, r);
    send({ type: "scene.state", view: view(s, chatId, r, busy) }, userId);
    requestSceneArt(userId, s, r);
  }

  /** A scarred place is redrawn as an edit of its original painting (4.6): the same place, changed. */
  function requestScarArt(userId: string, sheet: CardSheet, r: PlayRecord, placeId: string): void {
    const scar = r.memory?.scars[placeId];
    const p = r.world.places[placeId];
    if (!scar || !p) return;
    const original = art.status(placeKey(sheet, placeId), userId);
    const location = { id: `${tag(sheet.cardKey)}.${placeId}~${scar.flag}`, name: p.name, description: `${p.description}. Now ${scar.flag}: ${scar.change}` };
    if (original?.state === "ready" && original.imageId) art.request(placeArt(sheet, r, placeId), { kind: "background_variant", location, original: { imageId: original.imageId }, change: scar.change } as never, 1, userId);
    else art.request(placeArt(sheet, r, placeId), { kind: "background", location }, 1, userId);
  }

  async function context(userId: string, chatId: string): Promise<{ sheet: CardSheet; r: PlayRecord } | null> {
    const sheet = await cards.sheetFor(userId, chatId);
    if (!sheet) {
      send({ type: "notice", level: "warn", text: "Gambit has not read this card yet. Turn it on for this chat first." }, userId);
      return null;
    }
    return { sheet, r: await record(userId, chatId, sheet) };
  }

  /* ------------------------------ fights ------------------------------- */

  async function fight(userId: string, chatId: string, opts: { lead?: string; boss?: boolean; room?: string; title?: string; initiative?: "party" | "foes"; board?: boolean } = {}): Promise<void> {
    const ctx = await context(userId, chatId);
    if (!ctx) return;
    let { sheet, r } = ctx;
    await show(userId, chatId, sheet, r, "Reading who you might fight on this card…");
    sheet = (await cards.armory(userId, chatId)) ?? sheet;
    const adapt = r.memory?.adapt ?? {};
    const foes = adaptFoes(sheet.foes ?? [], adapt);
    const lead = opts.lead ? sheet.cast.find((c) => c.id === opts.lead) : undefined;
    if (lead) foes.unshift(foeFromCast(lead, sheet.skin.fight));
    const seed = `${chatId}:${r.scene.day}:${r.scene.time}:${Date.now().toString(36)}`;
    const enc = encounterFrom(foes, { seed, ...(opts.boss ? { boss: true } : {}), ...(lead ? { lead: `cast_${lead.id}` } : {}), ...(opts.title ? { name: opts.title } : {}) });
    if (!enc) return send({ type: "notice", level: "warn", text: "This card has nobody to fight." }, userId);
    const t = tag(sheet.cardKey);
    const ns = (def: MonsterDef): MonsterDef => {
      const id = `${t}.${def.id}`;
      return { ...def, id, ...(def.phase2 ? { phase2: { ...def.phase2, into: { ...def.phase2.into, id: `${t}.${def.phase2.into.id}` } } } : {}) };
    };
    const monsters: Record<string, MonsterDef> = {};
    const enemies = enc.foes.map((f) => {
      const def = ns(adaptMonster(f.def, adapt[f.foe?.id ?? ""]));
      monsters[def.id] = def;
      if (def.phase2) monsters[def.phase2.into.id] = { ...def.phase2.into } as MonsterDef;
      return { def };
    });
    const slots = partyFromSheet(sheet, { exclude: lead?.id });
    // Recruits join the party behind the card's own companions (4.6), up to a full party.
    const taken = new Set(slots.map((s) => s.classDef.id));
    for (const x of r.memory?.recruits ?? []) {
      if (slots.length >= MAX_PARTY) break;
      const cls = baseClassFor(`${x.role} ${x.look}`, taken);
      taken.add(cls.id);
      slots.push({ id: `p_${x.id}`, name: x.name, classDef: cls });
    }
    // A companion you are close to unlocks a combo skill for you both.
    const bonded = slots.find((s) => s.id !== "p_player" && (r.memory?.npc[s.castId ?? s.id.slice(2)]?.affinity ?? 0) >= BOND_AT);
    if (bonded) {
      const me = slots[0]!;
      const combo = solveSkill({
        id: `combo_${bonded.id}`,
        name: `${me.name} & ${bonded.name}`,
        flavor: "Side by side, the way only the two of you can.",
        target: "all_enemies",
        tier: 3,
        signature: true,
        visual: { cutin: "diagonal_band" },
        atoms: [
          { op: "hit", element: me.classDef.attack.atoms.find((a) => a.op === "hit")?.element ?? "physical", scale: "might", power: "auto", hits: 2, weight: 0.7 },
          { op: "status", status: "mark", chance: "auto", weight: 0.3 },
        ],
        cost: { focus: 30, cooldown: 5 },
      });
      slots[0] = { ...me, classDef: { ...me.classDef, skills: [...me.classDef.skills, combo] } };
    }
    const kits = new Map((sheet.kits ?? []).map((k) => [k.who, k]));
    const faces: Record<string, string> = {};
    const party = slots.map((p) => {
      const kit = kits.get(p.id);
      const m = p.castId ? sheet.cast.find((c) => c.id === p.castId) : undefined;
      // Their own cut-out figure once it is drawn; the card art until then.
      const figure = m ? requestFigure(userId, sheet, m, 0) : null;
      const figureReady = figure ? art.status(figure, userId)?.state === "ready" : false;
      const img = figureReady ? null : (m?.faces?.base ?? m?.avatarImageId ?? null);
      if (img) faces[p.id] = img;
      const cls = kit ? kitClass(p.classDef, kit, p.id) : p.classDef;
      // A kit replaces the class skills: keep a combo skill the player earned.
      const combo = p.classDef.skills.filter((sk) => sk.id.startsWith("combo_"));
      return { classDef: kit && combo.length ? { ...cls, skills: [...cls.skills, ...combo] } : cls, level: 5, id: p.id, name: p.name, art: figureReady && figure ? figure : img ? `face:${img}` : `class:${p.classDef.id}:${t}.${p.id}` };
    });
    // The player fights as the class picked in the class book (M7): the card's kit, a base class, or one they made.
    const mine = party.find((p) => p.id === "p_player");
    const classes: Record<string, Pick<ClassDef, "id" | "name" | "visual">> = {};
    let cardDef: ClassDef | null = null;
    if (mine) {
      const combo = mine.classDef.skills.filter((sk) => sk.id.startsWith("combo_"));
      cardDef = { ...mine.classDef, skills: mine.classDef.skills.filter((sk) => !sk.id.startsWith("combo_")) };
      const pc = forge.playerClass(sheet, r, cardDef);
      const book = bookOf(r);
      mine.classDef = { ...pc.def, skills: [...pc.def.skills, ...combo] };
      mine.level = 4 + rankOf(book.classes[book.active]?.wins ?? 0);
      if (pc.art) {
        mine.art = pc.art;
        classes[pc.def.id] = { id: pc.def.id, name: pc.def.name, visual: pc.def.visual };
      } else if (pc.def !== cardDef && !pc.def.id.includes("~")) mine.art = `class:${pc.def.id}:${t}.p_player`;
    }
    let state = createBattle({ id: `${t}.${enc.id}.${Date.now().toString(36)}`, seed, party, enemies });
    // Vigor carries between fights: a tired party starts hurt.
    for (const c of state.combatants) if (c.side === "party") c.hp = Math.max(1, Math.round(c.maxHp * Math.max(0.35, r.scene.vigor)));
    // Who has the jump (the expedition board): the side that struck first all act before the other's first turn.
    if (opts.initiative) {
      const first = state.combatants.filter((c) => (c.side === "party") === (opts.initiative === "party"));
      const rest = state.combatants.filter((c) => (c.side === "party") !== (opts.initiative === "party"));
      const lead = Math.min(...rest.map((c) => c.next));
      first.sort((a, b) => a.next - b.next).forEach((c, i) => (c.next = Math.min(c.next, lead - first.length + i)));
    }
    const wildHere = wildCell(r);
    state.meta = { title: enc.name, chatId, ...(enc.boss ? { boss: true } : {}), ...(Object.keys(classes).length ? { classes } : {}), backdrop: r.delve ? placeKey(sheet, r.delve.placeId) : wildHere ? placeKey(sheet, `wild_${wildHere}`) : placeKey(sheet, r.scene.placeId), monsters, faces, ...(opts.room ? { room: opts.room } : {}), ...(opts.board ? { board: true } : {}) };
    state = advance(state, { enemyPolicy: chooseAction }).state;
    r = (await load(userId, chatId)) ?? r;
    if (cardDef) forge.playerClass(sheet, r, cardDef);
    r.battleId = state.id;
    note(r, `${enc.name}!`);
    await save(userId, chatId, r);
    await show(userId, chatId, sheet, r);
    // Card art is shown as it is; the rest is drawn by battle-art.ts.
    const items = Object.entries(faces).map(([, img]) => ({ key: `face:${img}`, state: "ready" as const, url: `/api/v1/images/${img}`, imageId: img, cutout: true, via: "card" }));
    if (items.length) send({ type: "art.update", items }, userId);
    log(`fight on ${sheet.cardName}: ${enc.name} (${enc.foes.map((f) => `${f.def.name} ${f.def.hp}hp`).join(", ")}) vs ${party.map((p) => `${p.name}/${p.classDef.name}`).join(", ")}`);
    await battles.startState(userId, state);
  }

  /** A card battle ended: carry vigor, pay out, clear the room, and tell the chat. */
  async function onBattleEnd(state: BattleState, userId: string): Promise<void> {
    const chatId = state.meta?.chatId;
    if (!chatId) return;
    const sheet = await cards.sheetFor(userId, chatId);
    const r = await load(userId, chatId);
    if (!sheet || !r || r.battleId !== state.id) return;
    const party = state.combatants.filter((c) => c.side === "party");
    const hp = party.reduce((n, c) => n + Math.max(0, c.hp), 0);
    const max = party.reduce((n, c) => n + c.maxHp, 0) || 1;
    const enemies = state.combatants.filter((c) => c.side === "enemy");
    const talked = enemies.filter((c) => c.left);
    const fallen = enemies.filter((c) => !c.alive && !c.left);
    const bribes = talked.filter((c) => c.left === "bargain").length * 15;
    const cur = sheet.skin.currency || "coin";
    let line: string;
    if (state.outcome === "victory") {
      const loot = fallen.length * 12 + talked.filter((c) => c.left === "surrender").length * 8;
      r.scene = { ...r.scene, vigor: Math.max(0.2, hp / max), coin: Math.max(0, r.scene.coin + loot - bribes) };
      const how = [
        fallen.length ? `beat ${fallen.map((c) => c.name).join(", ")}` : "",
        talked.length ? `talked ${talked.map((c) => `${c.name} into ${c.left === "surrender" ? "yielding" : c.left === "bargain" ? "a deal" : "joining you"}`).join(", ")}` : "",
      ].filter(Boolean).join(" and ");
      line = `${state.meta?.title ?? "The fight"} is over. ${party.map((c) => c.name).join(" and ")} ${how}${loot - bribes ? ` (${loot - bribes > 0 ? "+" : ""}${loot - bribes} ${cur})` : ""}.`;
      if (r.delve && state.meta?.room) r.delve.state = clearRoom(r.delve.map, r.delve.state, state.meta.room);
      if (r.board && state.meta?.board) {
        const w = winFight(r.board);
        r.board = w.board;
        r.boardFx = [{ text: "The way is clear", kind: "foe" }, ...applyBoard(sheet, r, w.events)];
        if (r.board.done) line += ` ${finishBoard(sheet, r)}`;
      }
      if (r.delve?.state.done) {
        line += ` The depths of ${r.world.places[r.delve.placeId]?.name ?? "the delve"} fall quiet, and a catalyst waits at the bottom.`;
        bookOf(r).catalysts++;
      }
    } else {
      // Story difficulty (4.2): lose, retreat, take a consequence. The model never rescues anyone.
      r.scene = { ...r.scene, vigor: 0.35, coin: Math.max(0, Math.round(r.scene.coin * 0.8)), placeId: r.world.start };
      if (r.delve) r.delve = undefined;
      if (r.board) {
        r.board = undefined;
        r.boardFx = undefined;
      }
      if (r.hex) {
        const home = cellOf(r.hex.map, r.world.start);
        if (home) r.hex.state = reveal(r.hex.map, { ...r.hex.state, q: home.q, r: home.r });
      }
      line = `${state.meta?.title ?? "The fight"} is lost. ${party.map((c) => c.name).join(" and ")} fall back to ${r.world.places[r.world.start]?.name ?? "safety"}, bruised and lighter of ${cur}.`;
    }
    r.battleId = undefined;
    // Classes (M7): ranks from wins, catalysts from bosses, skills ready to awaken.
    for (const l of forge.afterBattle(r, state, !!state.meta?.boss)) line += ` ${l}`;
    // The deed ledger (4.6): who fell, who was spared or recruited, and how you fought.
    const t = tag(sheet.cardKey);
    const foeIdOf = (id: string) => id.replace(`${t}.`, "").replace(/_p2$/, "").replace(/~.*$/, "");
    const where = r.delve?.placeId ?? (wildCell(r) ? `wild_${wildCell(r)}` : state.outcome === "victory" ? r.scene.placeId : (r.scene.visited[r.scene.visited.length - 1] ?? r.scene.placeId));
    const deeds = deedsFromBattle(state, r.scene.day, where, foeIdOf, state.meta?.tally);
    const m = mem(r);
    if (state.meta?.tally) {
      const tt = state.meta.tally;
      const into = m.tally;
      const els = into.elements as Record<string, number>;
      const sts = into.statuses as Record<string, number>;
      for (const [k, v] of Object.entries(tt.elements)) els[k] = (els[k] ?? 0) + (v ?? 0);
      for (const [k, v] of Object.entries(tt.statuses)) sts[k] = (sts[k] ?? 0) + (v ?? 0);
      into.talks += tt.talks;
      into.hits += tt.hits;
    }
    for (const d of deeds.filter((x) => x.kind === "recruited")) {
      const foe = sheet.foes?.find((f) => f.id === d.target);
      for (let i = 0; i < (d.n ?? 1) && m.recruits.length < MAX_PARTY - 1; i++) {
        const id = `r_${d.target}_${r.scene.day}_${m.recruits.length}`;
        m.recruits.push({ id, name: d.name, foe: d.target, look: foe?.look ?? "", role: foe?.role ?? "brute", day: r.scene.day });
        line += ` ${d.name} joins the party.`;
      }
    }
    record_(sheet, r, deeds, false);
    note(r, line);
    await save(userId, chatId, r);
    // Companions' feelings about the fight: judged in the background (a Decision model, else their warmth).
    reactLater(userId, chatId, sheet, deeds);
    await aside(chatId, line);
    await show(userId, chatId, sheet, r);
  }

  /* ------------------------------ delves ------------------------------- */

  async function enter(userId: string, chatId: string, sheet: CardSheet, r: PlayRecord): Promise<void> {
    const p = r.world.places[r.scene.placeId]!;
    const map = generateDelve(`${sheet.cardKey}:${chatId}:${p.id}`, 9);
    r.delve = { placeId: p.id, map, state: enterDelve(map) };
    if (r.theme === "storybook") r.theme = "onebit";
    note(r, `You enter ${p.name}.`);
    await save(userId, chatId, r);
    await aside(chatId, `${sheet.player.name || "You"} venture${sheet.player.name ? "s" : ""} into ${p.name}.`);
    // Prepare the boss and the foes ahead of time (P1): the first fight then opens fast.
    void cards.armory(userId, chatId).catch(() => {});
    await show(userId, chatId, sheet, r);
  }

  /* ------------------------------ the night ----------------------------- */

  /**
   * "Meanwhile…" (4.5): the montage covers the night's compile window. The
   * frontend gets an empty montage at once, then the vignettes; the chat
   * gets them as one aside.
   */
  async function meanwhile(userId: string, chatId: string, sheet: CardSheet, r: PlayRecord, rumors: string[] = []): Promise<void> {
    const day = r.scene.day;
    send({ type: "scene.meanwhile", chatId, day, vignettes: null }, userId);
    const places = Object.values(r.world.places).map((p) => ({ id: p.id, name: p.name }));
    const b = (await cards.storedBible?.(userId, sheet.cardKey).catch(() => null)) ?? null;
    const fallback = () => fallbackVignettes(sheet, b, places, day);
    let vs: Vignette[] = fallback();
    if (cards.compile) {
      const prompt = meanwhilePrompt(sheet, b, places, day, r.log.slice(-4));
      const ids = new Set(places.map((p) => p.id));
      const job = async () => (await cards.compile!(userId, "meanwhile", prompt, 900, (raw) => parseMeanwhile(raw, sheet, ids), fallback, { tries: 1 })).value;
      vs = await (cards.jaot ? cards.jaot.run(`meanwhile:${chatId}:${day}`, 1, job) : job()).catch(fallback);
    }
    // The world's own moves are always foreshadowed: tonight's rumours open the montage.
    vs = [...rumors.map((text) => ({ text: `Word goes round: ${text}` })), ...vs].slice(0, 6);
    const cast = new Map(sheet.cast.map((c) => [c.id, c]));
    const items = vs.map((v) => {
      const m = v.who ? cast.get(v.who) : undefined;
      const imageId = m ? (m.faces?.base ?? m.avatarImageId ?? null) : null;
      // Each vignette that shows someone or somewhere is drawn as its own scene.
      const cg = v.who || v.where ? requestCg(userId, sheet, r, { moment: v.text, caption: v.text, ...(v.who ? { cast: [v.who] } : {}), ...(v.where ? { placeId: v.where } : {}), priority: 1 }) : undefined;
      return { text: v.text, ...(v.where ? { art: placeKey(sheet, v.where) } : m && !imageId ? { art: npcArtKey(`${sheet.cardKey}:${m.id}`) } : {}), ...(imageId ? { imageId } : {}), ...(cg ? { cg } : {}) };
    });
    await save(userId, chatId, r);
    send({ type: "scene.meanwhile", chatId, day, vignettes: items }, userId);
    await aside(chatId, meanwhileText(vs));
  }

  /**
   * The night phase (4.6). Code first: groups you keep hurting adapt (their
   * rumours open the montage). Then, on the queue, the Architect reads the
   * day's deeds for a scar and what people now think; Notice promotions and
   * companion bonds are written too. Everything has a code fallback.
   */
  function nightAdapt(r: PlayRecord): { deeds: Deed[]; rumors: string[] } {
    const m = mem(r);
    const deeds = m.deeds.slice(m.nightAt);
    m.nightAt = m.deeds.length;
    const fresh = adaptations(m.deeds, m.adapt, profileOf(m.tally), r.scene.day);
    for (const a of fresh) m.adapt[a.foe] = [...(m.adapt[a.foe] ?? []), a];
    const rumors = fresh.map((a) => a.rumor);
    m.rumors = [...m.rumors, ...rumors].slice(-12);
    return { deeds, rumors };
  }

  async function night(userId: string, chatId: string, sheet: CardSheet, deeds: Deed[], day: number): Promise<void> {
    const r0 = await load(userId, chatId);
    if (!r0) return;
    const places = Object.values(r0.world.places).map((p) => ({ id: p.id, name: p.name }));
    const placeIds = new Set(places.map((p) => p.id));
    const castIds = new Set(sheet.cast.map((c) => c.id));
    let answer = fallbackNight(deeds, day);
    if (deeds.length && cards.compile) {
      const job = async () => (await cards.compile!(userId, "night", nightPrompt(sheet, deeds, places, day), 700, (raw) => parseNight(raw, deeds, placeIds, castIds, day), () => fallbackNight(deeds, day), { tries: 1 })).value;
      answer = await (cards.jaot ? cards.jaot.run(`night:${chatId}:${day}`, 3, job) : job()).catch(() => answer);
    }
    const r = (await load(userId, chatId)) ?? r0;
    const m = mem(r);
    const lines: string[] = [];
    for (const sc of answer.scars) {
      m.scars[sc.place] = sc;
      lines.push(`Overnight, ${r.world.places[sc.place]?.name ?? sc.place} changed: ${sc.note}`);
    }
    for (const x of answer.memories) {
      const n = (m.npc[x.who] ??= { notes: [], affinity: 0 });
      n.notes = [...n.notes, { day, text: x.text, tone: 0 as const }].slice(-8);
    }
    for (const l of lines) note(r, l);
    await save(userId, chatId, r);
    for (const sc of answer.scars) requestScarArt(userId, sheet, r, sc.place);
    if (lines.length) await aside(chatId, lines.join(" "));
    await promote(userId, chatId, sheet, 3);
    await show(userId, chatId, sheet, (await load(userId, chatId)) ?? r);
  }

  /** Notice promotions (4.6) and companions' personal quests: P3 jobs, capped at 3 active. */
  async function promote(userId: string, chatId: string, sheet: CardSheet, priority: Priority): Promise<void> {
    const r0 = await load(userId, chatId);
    if (!r0) return;
    const m0 = mem(r0);
    const main = new Set(sheet.cast.filter((c) => c.main).map((c) => c.id));
    // Companions at the bond line get their personal quest; the card's main cast are not "noticed", they are companions.
    const bonds = [...main, ...m0.recruits.map((x) => x.id)].filter((id) => (m0.npc[id]?.affinity ?? 0) >= BOND_AT && !m0.promoted.some((p) => p.key === `bond:${id}`)).map((id) => `bond:${id}`);
    const skip = new Set([...main].map((id) => `cast:${id}`));
    const keys = [...bonds, ...readyToPromote(m0.interest, m0.promoted, skip)].slice(0, 3);
    if (!keys.length) return;
    const places = Object.values(r0.world.places).map((p) => ({ id: p.id, name: p.name }));
    const placeIds = new Set(places.map((p) => p.id));
    const recent = (await cards.recent?.(userId, chatId, 8).catch(() => [])) ?? [];
    for (const key of keys) {
      const [kind, rest] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
      const castMember = kind === "cast" || kind === "bond" ? sheet.cast.find((c) => c.id === rest) : undefined;
      const recruit = kind === "bond" ? m0.recruits.find((x) => x.id === rest) : undefined;
      const place = kind === "place" ? r0.world.places[rest] : undefined;
      const name = castMember?.name ?? recruit?.name ?? place?.name ?? rest;
      const known = castMember ? `${castMember.role}. ${castMember.look}` : recruit ? `Once a foe (${recruit.role}), now in the party.` : place ? `A place: ${place.description}` : "Someone the roleplay keeps mentioning.";
      // Someone or somewhere the lorebook has an entry for is promoted from that entry, not invented.
      const lore = recruit ? "" : ((await cards.loreFor?.(userId, chatId, name).catch(() => "")) ?? "");
      const companion = kind === "bond";
      const mentionedIn = recent.filter((l) => l.content.includes(name.split(" ")[0]!)).map((l) => l.content).slice(-3);
      const fallback = () => fallbackPromotion(name, places, `${chatId}:${key}`, companion);
      const job = async () => (cards.compile ? (await cards.compile(userId, "promote", promotePrompt(sheet, { name, known, lore }, places, mentionedIn, companion), 900, (raw) => parsePromotion(raw, name, placeIds), fallback, { tries: 1 })).value : fallback());
      const draft = await (cards.jaot ? cards.jaot.run(`promote:${chatId}:${key}`, priority, job) : job()).catch(fallback);
      const r = (await load(userId, chatId)) ?? r0;
      const m = mem(r);
      if (m.promoted.some((p) => p.key === key)) continue;
      let placeId: string | undefined;
      if (draft.place) {
        const near = draft.steps[0]?.where ?? r.scene.placeId;
        placeId = `p_${promotedId(draft.place.name).slice(2)}`;
        if (!r.world.places[placeId]) {
          r.world = addPlace(r.world, sheet, { id: placeId, name: draft.place.name, description: draft.place.description, evidence: { source: "gambit", quote: "", verified: false }, added: true }, near);
          if (sheet.shape === "frontier") r.world = { ...r.world, shape: "frontier" };
          if (r.hex) r.hex.map = addHexPlace(r.hex.map, r.world, placeId, near);
        }
      }
      // A name nobody had on the card becomes a person this chat's world knows.
      let castId: string | null = castMember?.id ?? recruit?.id ?? null;
      let cast: CastMember | undefined;
      if (kind === "name") {
        castId = promotedId(name);
        cast = {
          id: castId,
          name,
          role: draft.role,
          pronoun: "they",
          voice: "",
          look: draft.look,
          main: false,
          temperament: { warmth: draft.warmth as 0, pride: 2, greed: 2, fear: 2 },
          wants: [],
          fears: [],
          respects: [],
          despises: [],
          likesTactics: [],
          hatesTactics: [],
          insight: 2,
          patience: 3,
          tells: {},
          evidence: { source: "chat", quote: name, verified: true },
        };
        const home = placeId ?? draft.steps[0]?.where ?? r.scene.placeId;
        const hp = r.world.places[home];
        if (hp && !hp.people.includes(castId)) r.world = { ...r.world, places: { ...r.world.places, [home]: { ...hp, people: [...hp.people, castId] } } };
      }
      const promo: Promotion & { cast?: CastMember } = { key, castId, name, dossier: draft.dossier, steps: draft.steps, item: draft.item, ...(placeId ? { placeId } : {}), day: r.scene.day, done: false, ...(cast ? { cast } : {}) };
      m.promoted = [...m.promoted, promo];
      const line = companion ? `${name} trusts you now. They have something to ask of you.` : `${name} has caught your attention. There is more to them than it seemed.`;
      note(r, line);
      if (castId) requestCg(userId, sheet, r, { moment: `${name} confides in the traveller: ${draft.dossier.replace(/\s+/g, " ").slice(0, 240)}`, caption: line, cast: [castId], ...(placeId ? { placeId } : {}), chatId, priority: 2 });
      await save(userId, chatId, r);
      log(`promoted ${key} (${draft.steps.length} steps${placeId ? `, place ${placeId}` : ""})`);
    }
  }

  /** Searching where a quest step points completes it (or the chat did, by promotion `key`); the last step gives the item. */
  function questStep(r: PlayRecord, placeId: string, key?: string): string | null {
    const m = r.memory;
    if (!m) return null;
    for (const p of m.promoted) {
      if (p.done) continue;
      const step = p.steps.find((s) => !s.done);
      if (!step || (key ? p.key !== key : step.where !== placeId)) continue;
      step.done = true;
      if (p.steps.every((s) => s.done)) {
        p.done = true;
        m.items = [...m.items, { ...p.item, from: p.name }];
        bookOf(r).crests++;
        if (p.castId) {
          const n = (m.npc[p.castId] ??= { notes: [], affinity: 0 });
          n.affinity = Math.min(10, n.affinity + 2);
        }
        return `${step.text}: done. ${p.name}'s thread comes together, and you come away with ${p.item.name} and a Blank Crest.`;
      }
      return `${step.text}: done. (${p.name}, ${p.steps.filter((s) => s.done).length}/${p.steps.length})`;
    }
    return null;
  }

  /**
   * Memories the note leaves out (people elsewhere, older notes, older
   * rumours, other places' scars), as lines: the ones the player's latest
   * line is about are recalled by meaning (senses.recall) and added.
   */
  function recallPool(sheet: CardSheet, r: PlayRecord): string[] {
    const m = r.memory;
    if (!m) return [];
    const p = r.world.places[r.scene.placeId];
    const s = withPromoted(sheet, r);
    const here = new Set([...(p?.people ?? []), ...s.cast.filter((c) => c.main).map((c) => c.id), ...m.recruits.map((x) => x.id)]);
    const out: string[] = [];
    for (const [id, n] of Object.entries(m.npc)) {
      const who = s.cast.find((c) => c.id === id)?.name ?? m.recruits.find((x) => x.id === id)?.name;
      if (!who) continue;
      for (const x of here.has(id) ? n.notes.slice(0, -3) : n.notes) out.push(`${who} remembers: ${x.text}`);
    }
    for (const x of m.rumors.slice(0, -2)) out.push(`Rumour: ${x}`);
    for (const [id, sc] of Object.entries(m.scars)) if (id !== p?.id && r.world.places[id]) out.push(`${r.world.places[id]!.name} is ${sc.flag}: ${sc.note}`);
    return out.slice(-200);
  }

  /** The narrator hears what people here remember (4.6): a short background note before the reply, plus recalled lines. */
  function memoryNote(sheet: CardSheet, r: PlayRecord, recalled: readonly string[] = []): string | null {
    const m = r.memory;
    if (!m) return null;
    const p = r.world.places[r.scene.placeId];
    const s = withPromoted(sheet, r);
    const here = new Set([...(p?.people ?? []), ...s.cast.filter((c) => c.main).map((c) => c.id), ...m.recruits.map((x) => x.id)]);
    const out: string[] = [];
    for (const id of here) {
      const n = m.npc[id];
      if (!n?.notes.length) continue;
      const who = s.cast.find((c) => c.id === id)?.name ?? m.recruits.find((x) => x.id === id)?.name ?? id;
      const feel = n.affinity >= BOND_AT ? "devoted" : n.affinity >= 2 ? "warm" : n.affinity <= -5 ? "hostile" : n.affinity <= -2 ? "wary" : "neutral";
      out.push(`- ${who} remembers (feels ${feel}): ${n.notes.slice(-3).map((x) => x.text).join("; ")}`);
    }
    const scar = p ? m.scars[p.id] : undefined;
    if (scar && p) out.push(`- ${p.name} is ${scar.flag}: ${scar.note}`);
    for (const x of m.rumors.slice(-2)) out.push(`- Rumour: ${x}`);
    for (const x of m.recruits) out.push(`- ${x.name} travels with the party now (once a foe).`);
    for (const x of recalled) out.push(`- Recalled: ${x}`);
    return out.length ? `[World memory from the game, for continuity. Background only; do not recite it.]\n${out.join("\n")}` : null;
  }

  /* ------------------------------ overland ----------------------------- */

  /** One step on the overland: time passes, supplies run down, arriving at a place makes it the scene. */
  function hexMove(r: PlayRecord, to: { q: number; r: number }): string | null {
    const res = stepHex(r.hex!.map, r.hex!.state, to);
    r.hex!.state = res.state;
    r.scene = moveScene(r.world, r.scene, { kind: "wait" });
    if (res.hungry) r.scene = { ...r.scene, vigor: Math.max(0.2, r.scene.vigor - 0.1) };
    if (res.place && r.world.places[res.place]) {
      interest(r, `place:${res.place}`, NOTICE.visit);
      r.scene = { ...r.scene, placeId: res.place, visited: r.scene.visited.includes(res.place) ? r.scene.visited : [...r.scene.visited, res.place] };
      return res.place;
    }
    return null;
  }

  /** Walk the overland path to a place (a "Go to" from the menu). */
  async function travel(userId: string, chatId: string, sheet: CardSheet, r: PlayRecord, to: string): Promise<void> {
    const goal = cellOf(r.hex!.map, to);
    const path = goal ? hexPath(r.hex!.map, r.hex!.state, goal) : null;
    if (!path) return note(r, "There is no way there over land.");
    for (const step of path.slice(1)) hexMove(r, step);
    const name = r.world.places[to]?.name ?? to;
    note(r, `You travel to ${name} (${path.length - 1} step${path.length === 2 ? "" : "s"}, ${r.hex!.state.supplies} supplies left).`);
    await save(userId, chatId, r);
    await aside(chatId, `${sheet.player.name || "You"} travel${sheet.player.name ? "s" : ""} across the land to ${name}.`);
  }

  /** Move the scene to a place the chat went to, on the overland too. */
  function arrive(r: PlayRecord, placeId: string): void {
    interest(r, `place:${placeId}`, NOTICE.visit);
    r.scene = { ...r.scene, placeId, visited: r.scene.visited.includes(placeId) ? r.scene.visited : [...r.scene.visited, placeId] };
    if (r.hex) {
      const c = cellOf(r.hex.map, placeId);
      if (c) r.hex.state = reveal(r.hex.map, { ...r.hex.state, q: c.q, r: c.r });
    }
  }

  /* --------------------------- expedition board -------------------------- */

  /** How the board's events land on the chat's world (coin, vigor), and the pops they leave. */
  function applyBoard(sheet: CardSheet, r: PlayRecord, events: BoardEvent[]): NonNullable<PlayRecord["boardFx"]> {
    const fx: NonNullable<PlayRecord["boardFx"]> = [];
    const cur = sheet.skin.currency || "coin";
    for (const e of events) {
      switch (e.kind) {
        case "flip":
          fx.push({ cell: e.cell, text: "+1 supply", kind: "supply" });
          break;
        case "cache":
          r.scene = { ...r.scene, coin: r.scene.coin + e.coin };
          fx.push({ text: `+${e.coin} ${cur}`, kind: "coin" });
          note(r, `A cache: ${e.coin} ${cur}.`);
          break;
        case "forage":
          fx.push({ text: `+${e.got} supplies`, kind: "supply" });
          note(r, `Food and water to be had here: +${e.got} supplies.`);
          break;
        case "spring":
          r.scene = { ...r.scene, vigor: Math.min(1, r.scene.vigor + e.heal) };
          fx.push({ text: "Refreshed", kind: "heal" });
          note(r, "A clear spring. Everyone drinks and feels better.");
          break;
        case "hazard":
          if (e.what === "hurt") {
            r.scene = { ...r.scene, vigor: Math.max(0.2, r.scene.vigor - e.amount) };
            fx.push({ text: "Hurt", kind: "hurt" });
            note(r, "Bad footing and worse luck: everyone takes a knock.");
          } else {
            fx.push({ text: `-${e.amount} supplies`, kind: "hurt" });
            note(r, e.amount ? `Something spoils the packs: -${e.amount} supplies.` : "A close call; nothing lost.");
          }
          break;
        case "shortcut":
          fx.push({ text: "A view of the way ahead", kind: "info" });
          note(r, `A high point: ${e.opened.length} tiles around come clear.`);
          break;
        case "lore":
          fx.push({ cell: e.cell, text: e.card.title, kind: "lore" });
          break;
        case "camp":
          fx.push({ cell: e.cell, text: "A place to camp", kind: "info" });
          break;
        case "contact":
          fx.push({ text: e.first === "party" ? "You have the jump on them!" : "Ambush!", kind: "foe" });
          break;
        case "goal":
          fx.push({ text: e.here === e.of ? "Everyone is here" : `${e.here}/${e.of} at the way on`, kind: "goal" });
          break;
        default:
          break;
      }
    }
    return fx;
  }

  const boardPlace = (r: PlayRecord, b: Board) => (b.placeId.startsWith("wild_") ? "the wild" : (r.world.places[b.placeId]?.name ?? "the way"));

  /** The whole party crossed: leftover supplies become coin, the place counts as known, and the board closes. */
  function finishBoard(sheet: CardSheet, r: PlayRecord): string {
    const b = r.board!;
    const bonus = 10 + b.supplies * 3;
    r.scene = { ...r.scene, coin: r.scene.coin + bonus, time: Math.min(r.scene.time + 1, TIMES.length - 1) };
    if (!b.placeId.startsWith("wild_")) interest(r, `place:${b.placeId}`, NOTICE.search);
    const line = `${sheet.player.name || "You"} and company make it across ${boardPlace(r, b)} (+${bonus} ${sheet.skin.currency || "coin"}).`;
    r.board = undefined;
    r.boardFx = undefined;
    r.boardStory = undefined;
    note(r, line);
    return line;
  }

  /** Deal a board for where you stand: the card's lore face down among the road's luck. */
  async function explore(userId: string, chatId: string, sheet: CardSheet, r0: PlayRecord): Promise<void> {
    const wild = wildCell(r0);
    const placeId = wild ? `wild_${wild}` : r0.scene.placeId;
    const p = r0.world.places[r0.scene.placeId];
    await show(userId, chatId, sheet, r0, "Laying out the way ahead…");
    const sources = (await cards.sourcesFor?.(userId, chatId).catch(() => null)) ?? null;
    const r = (await load(userId, chatId)) ?? r0;
    const met = new Set([...Object.keys(r.memory?.npc ?? {}), ...sheet.cast.filter((c) => c.main).map((c) => c.id)]);
    const revelation = r.thread?.revelations.find((x) => !r.revealed?.includes(x.id)) ?? null;
    const party = partyFromSheet(sheet).slice(0, 3).map((s) => ({ id: s.id, name: s.name }));
    const danger = wild ? wild !== "plain" : !!p?.danger;
    const lore = boardLore({ sheet, sources, met, spent: new Set(r.loreSpent ?? []), revelation, found: r.scene.found, room: 12 });
    r.board = dealBoard({ seed: `${chatId}:${placeId}:${r.scene.day}:${r.scene.time}:${(r.loreSpent ?? []).length}`, placeId, party, lore, radius: 3, foes: sheet.modules.encounters ? (danger ? 2 : 1) : 0 });
    r.boardFx = [{ text: "Blue is safe, green is chance, violet is the story, gold is the way on", kind: "info" }];
    const name = wild ? `the ${TERRAIN_NAME[wild].toLowerCase()}` : (p?.name ?? "the way");
    note(r, `You set out across ${name}.`);
    await save(userId, chatId, r);
    await aside(chatId, `${sheet.player.name || "You"} set${sheet.player.name ? "s" : ""} out across ${name}.`);
    if (sheet.modules.encounters) void cards.armory(userId, chatId).catch(() => {});
    await show(userId, chatId, sheet, r);
  }

  /** Open a lore tile: a glimpse by code, or a scene by the model, and at three stars what it changes. */
  async function resolveLore(userId: string, chatId: string, sheet: CardSheet, r: PlayRecord, card: LoreCard, tier: 1 | 2 | 3): Promise<void> {
    r.loreSpent = [...new Set([...(r.loreSpent ?? []), card.id])].slice(-400);
    if (tier === 1) {
      const g = glimpse(card);
      note(r, card.kind === "entry" ? `${card.title}: ${g}` : g);
      r.boardFx = [{ text: card.title, kind: "lore" }];
      r.boardStory = { title: card.title, text: g, stars: 1 };
      return;
    }
    await save(userId, chatId, r);
    await show(userId, chatId, sheet, r, "Writing what you find…");
    const party = r.board?.party.map((p) => p.name) ?? [sheet.player.name || "You"];
    const recent = (await cards.recent?.(userId, chatId, 3).catch(() => [])) ?? [];
    const prompt = loreScenePrompt(sheet, card, tier, r.board ? boardPlace(r, r.board) : "the way", party, recent);
    const fallback = () => card.text.replace(/\s+/g, " ").slice(0, 600);
    const text = cards.compile ? (await cards.compile(userId, "board-scene", prompt, 700, parseLoreScene, fallback, { tries: 1 })).value : fallback();
    const effects: string[] = [];
    if (tier === 3) {
      if (card.kind === "fact") {
        r.scene = { ...r.scene, found: [...new Set([...r.scene.found, card.ref])] };
        await cards.markKnown?.(userId, chatId, card.ref);
        effects.push("You know this now, and can use it when you talk.");
      } else if (card.kind === "person") {
        interest(r, `cast:${card.ref}`, NOTICE.talk * 2);
        effects.push(`${card.title} is on your mind.`);
      } else if (card.kind === "entry") {
        const m = mem(r);
        m.rumors = [...m.rumors, `${card.title}: ${card.text.replace(/\s+/g, " ").slice(0, 140)}`].slice(-20);
        effects.push("Noted in the journal.");
      }
    }
    if (card.kind === "thread") {
      r.revealed = [...new Set([...(r.revealed ?? []), card.ref])];
      effects.push("A piece of the larger story falls into place.");
    }
    r.boardFx = [{ text: card.title, kind: "lore" }, ...effects.map((t) => ({ text: t, kind: "info" as const }))];
    note(r, `${card.title}${effects.length ? `: ${effects.join(" ")}` : ""}`);
    const partyCast = (r.board?.party ?? []).map((p) => p.id.replace(/^p_/, "")).filter((id) => sheet.cast.some((c) => c.id === id));
    const cg = requestCg(userId, sheet, r, {
      moment: text.replace(/\s+/g, " ").slice(0, 360),
      caption: card.title,
      cast: [...(card.kind === "person" ? [card.ref] : []), ...partyCast],
      ...(r.board ? { placeId: r.board.placeId } : {}),
      chatId,
      priority: 0,
    });
    r.boardStory = { title: card.title, text: effects.length ? `${text}

${effects.join(" ")}` : text, stars: tier, art: cg };
    await aside(chatId, text);
  }

  /** One action on the board: a move, a depth for a lore tile, camp, skip, or turning back. */
  async function boardAct(userId: string, chatId: string, op: BoardOp, cell?: string, tier?: number): Promise<void> {
    const ctx = await context(userId, chatId);
    if (!ctx?.r.board || ctx.r.battleId) return;
    const { sheet, r } = ctx;
    const b = r.board!;
    r.boardStory = undefined;
    try {
      let events: BoardEvent[] = [];
      switch (op) {
        case "move": {
          if (!cell) return;
          const res = boardMove(b, cell);
          r.board = res.board;
          events = res.events;
          r.boardFx = applyBoard(sheet, r, events);
          break;
        }
        case "skip": {
          const res = boardSkip(b);
          r.board = res.board;
          events = res.events;
          r.boardFx = applyBoard(sheet, r, events);
          break;
        }
        case "camp": {
          const res = boardCamp(b);
          r.scene = { ...r.scene, vigor: Math.min(1, r.scene.vigor + res.healed) };
          r.board = res.board;
          events = res.events;
          r.boardFx = [{ text: "Rested", kind: "heal" }, ...applyBoard(sheet, r, events)];
          note(r, "You make camp for a while. Everyone rests.");
          break;
        }
        case "lore": {
          const t = Math.max(0, Math.min(3, Math.round(tier ?? 0))) as 0 | 1 | 2 | 3;
          const res = openLore(b, t);
          r.board = res.board;
          events = res.events;
          r.boardFx = applyBoard(sheet, r, events);
          if (res.card && res.tier) await resolveLore(userId, chatId, sheet, r, res.card, res.tier);
          else note(r, "You leave it for now. You can come back to it.");
          break;
        }
        case "leave": {
          note(r, `You turn back from ${boardPlace(r, b)}.`);
          r.board = undefined;
          r.boardFx = undefined;
          r.boardStory = undefined;
          await save(userId, chatId, r);
          await show(userId, chatId, sheet, r);
          return;
        }
      }
      if (r.board?.done) {
        const line = finishBoard(sheet, r);
        await save(userId, chatId, r);
        await aside(chatId, line);
        await show(userId, chatId, sheet, r);
        return;
      }
      await save(userId, chatId, r);
      // A foe met: on to the battle, with whoever struck first acting first.
      const contact = events.find((e): e is Extract<BoardEvent, { kind: "contact" }> => e.kind === "contact");
      if (contact) {
        await show(userId, chatId, sheet, r);
        return fight(userId, chatId, { board: true, initiative: contact.first, title: contact.first === "party" ? "Caught unawares" : "An ambush" });
      }
    } catch (err) {
      note(r, err instanceof Error ? err.message : String(err));
      await save(userId, chatId, r);
    }
    await show(userId, chatId, sheet, r);
  }

  return {
    onBattleEnd,
    boardAct,
    /** The class panel (M7). */
    forgeAct: (userId: string, chatId: string, op: ForgeOp, arg?: string, arg2?: string, text?: string) => forge.act(userId, chatId, op, arg, arg2, text),

    /** A Parley with someone on the card ended: the outcome and how you spoke become deeds. */
    async onParleyEnd(userId: string, scenario: ParleyScenario, state: ParleyState) {
      const chatId = state.chatId;
      const castId = scenario.card?.castId;
      if (!chatId || !castId || !state.end) return;
      const sheet = await cards.sheetFor(userId, chatId);
      const r = await load(userId, chatId);
      if (!sheet || !r) return;
      const name = withPromoted(sheet, r).cast.find((c) => c.id === castId)?.name ?? scenario.npc.name;
      const tactics = state.exchanges.map((e) => e.read.tactic);
      const bluffed = state.exchanges.some((e) => e.bluff && !e.bluff.fact);
      record_(sheet, r, deedsFromParley(castId, name, state.end.kind, tactics, bluffed, r.scene.day, r.scene.placeId));
      // How it ended, as a picture: the two of you at the talk's last beat.
      const how = PARLEY_END_SCENE[state.end.kind] ?? "the talk ends";
      requestCg(userId, sheet, r, { moment: `${name} and ${sheet.player.name || "the traveller"} face to face as ${how}`, caption: `${name}: ${how}.`, cast: [castId], chatId, priority: 1 });
      await save(userId, chatId, r);
    },

    /**
     * After a reply (4.6, 9): the names the player's line mentions raise
     * interest, hidden facts that came up in the chat count as known, and
     * quest steps the chat accomplished are done. One Decision request
     * (backend/senses.ts); without it, the code rules (names) and close
     * meaning or rule words (facts) decide.
     */
    async notice(userId: string, chatId: string, lines: { name: string; content: string; isUser: boolean }[]) {
      const sheet = await cards.sheetFor(userId, chatId);
      const r0 = await load(userId, chatId);
      if (!sheet || !r0) return;
      const last = [...lines].reverse().find((l) => l.isUser);
      const s = withPromoted(sheet, r0);
      const known = [...s.cast.map((c) => ({ key: `cast:${c.id}`, name: c.name })), ...Object.values(r0.world.places).map((p) => ({ key: `place:${p.id}`, name: p.name }))];
      const steps = (r0.memory?.promoted ?? []).flatMap((p) => {
        const st = p.done ? undefined : p.steps.find((x) => !x.done);
        return st ? [{ key: p.key, text: st.text, who: p.name }] : [];
      });
      const hidden = sheet.facts.filter((f) => !f.known && !r0.scene.found.includes(f.id));
      const sense = await senses.afterReply(userId, { line: last?.content ?? "", lines: lines.map((l) => l.content), known, skip: [sheet.player.name, sheet.cardName], facts: hidden, steps });
      if (!sense.mentions.length && !sense.facts.length && !sense.quests.length) return;
      // Reload: the reply detector may have moved the scene meanwhile.
      const r = (await load(userId, chatId)) ?? r0;
      for (const k of sense.mentions) {
        // A name that is now someone promoted counts for them.
        const promoted = k.startsWith("name:") ? s.cast.find((c) => c.name === k.slice(5)) : undefined;
        interest(r, promoted ? `cast:${promoted.id}` : k, NOTICE.mention);
      }
      const done = sense.quests.map((key) => questStep(r, r.scene.placeId, key)).filter((x): x is string => !!x);
      for (const line of done) note(r, line);
      for (const id of sense.facts) note(r, `Noted: ${sheet.facts.find((f) => f.id === id)?.text ?? id}`);
      await save(userId, chatId, r);
      // A fact met in the chat counts as known: Parley Leverage can use it (4.0).
      for (const id of sense.facts) await cards.markKnown?.(userId, chatId, id);
      for (const line of done) await aside(chatId, line);
      if (sense.facts.length || done.length) log(`after reply (${sense.by}): ${sense.facts.length} fact${sense.facts.length === 1 ? "" : "s"} known, ${done.length} quest step${done.length === 1 ? "" : "s"} done`);
      if (readyToPromote(mem(r).interest, mem(r).promoted, new Set(sheet.cast.filter((c) => c.main).map((c) => `cast:${c.id}`))).length) void promote(userId, chatId, sheet, 3).catch(() => {});
    },

    /** People this chat's world promoted, for Parley. */
    async extraCast(userId: string, chatId: string): Promise<CastMember[]> {
      const r = await load(userId, chatId);
      return (r?.memory?.promoted ?? []).map((p) => (p as Promotion & { cast?: CastMember }).cast).filter((c): c is CastMember => !!c);
    },

    /** Prompt pipeline: what people here remember goes in as a background note before the reply. */
    async intercept(messages: LlmMessageDTO[], ctx: InterceptorContextDTO): Promise<LlmMessageDTO[]> {
      if (ctx.generationType === "quiet" || ctx.generationType === "impersonate" || ctx.isDryRun || !ctx.chatId) return messages;
      const r = await load(ctx.userId, ctx.chatId).catch(() => null);
      if (!r?.memory) return messages;
      const sheet = await cards.sheetFor(ctx.userId, ctx.chatId).catch(() => null);
      // Memories the latest line is about, by meaning (embeddings); a short wait at most, never past the deadline.
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      const query = typeof lastUser?.content === "string" ? lastUser.content : "";
      const ms = Math.min(2500, (ctx.interceptorDeadlineAt ?? Date.now() + 10_000) - Date.now() - 4000);
      const recalled = sheet && query ? await senses.recall(ctx.userId, query, recallPool(sheet, r), ms).catch(() => []) : [];
      const text = sheet ? memoryNote(sheet, r, recalled) : null;
      if (!text) return messages;
      let at = messages.length;
      for (let i = messages.length - 1; i >= 0; i--) if (messages[i]!.role === "user") {
        at = i;
        break;
      }
      return [...messages.slice(0, at), { role: "system", content: text } as LlmMessageDTO, ...messages.slice(at)];
    },

    /** Where the scene is, for the reply detector's "where" question (null when there is no open scene to move). */
    async where(userId: string, chatId: string) {
      const r = await load(userId, chatId);
      if (!r || r.delve || r.battleId) return null;
      const here = r.world.places[r.scene.placeId];
      if (!here) return null;
      const sheet = await cards.sheetFor(userId, chatId);
      const people = sheet ? withPromoted(sheet, r).cast.map((c) => ({ id: c.id, name: c.name, here: here.people.includes(c.id) })) : [];
      return { here: { id: here.id, name: here.name }, places: Object.values(r.world.places).map((p) => ({ id: p.id, name: p.name })), time: TIMES[r.scene.time]!, people };
    },

    /** The chat moved the scene (4.5): to a known place, or somewhere new that is added, quoted from the chat. */
    async moved(userId: string, chatId: string, pick: string, p: number, lines: { name: string; content: string }[]) {
      if (p < 0.6) return;
      const sheet = await cards.sheetFor(userId, chatId);
      let r = await load(userId, chatId);
      if (!sheet || !r || r.delve || r.battleId) return;
      const here = r.world.places[r.scene.placeId]!;
      let target = pick;
      if (pick === "new") {
        const known = Object.values(r.world.places).map((x) => x.name);
        const ask = async () =>
          cards.compile
            ? (await cards.compile(userId, "place-from-chat", placeFromChatPrompt(sheet, here.name, known, lines), 400, (raw) => parsePlaceFromChat(raw, lines, known), () => fallbackPlaceFromChat(lines, known), { tries: 1 })).value
            : fallbackPlaceFromChat(lines, known);
        const np = await (cards.jaot ? cards.jaot.run(`place:${chatId}:${lines.length ? lines[lines.length - 1]!.content.length : 0}`, 0, ask) : ask());
        if (!np) return log("where: the chat went somewhere new, but no place could be read from it");
        r = (await load(userId, chatId)) ?? r;
        let id = `c_${slug(np.name, "place")}`;
        for (let i = 2; r.world.places[id]; i++) id = `c_${slug(np.name, "place")}_${i}`;
        r.world = addPlace(r.world, sheet, { id, name: np.name, description: np.description, evidence: { source: "chat", quote: np.quote, verified: true }, added: true }, here.id);
        if (sheet.shape === "frontier") r.world = { ...r.world, shape: "frontier" };
        if (r.hex) r.hex.map = addHexPlace(r.hex.map, r.world, id, here.id);
        else ensureHex(r, chatId);
        target = id;
        log(`where: added "${np.name}" from the chat`);
      }
      if (!r.world.places[target] || target === r.scene.placeId) return;
      arrive(r, target);
      note(r, `The story moves to ${r.world.places[target]!.name}.`);
      await save(userId, chatId, r);
      await show(userId, chatId, sheet, r);
    },

    /** The chat says what time it is or who is there: the scene shows the same story. */
    async settled(userId: string, chatId: string, now: { time?: string; here: string[]; away: string[] }) {
      const sheet = await cards.sheetFor(userId, chatId);
      const r = await load(userId, chatId);
      if (!sheet || !r || r.delve || r.battleId) return;
      const time = TIMES.findIndex((t) => t === now.time);
      if (time >= 0 && time !== r.scene.time) {
        r.scene = clockTo(r.scene, time);
        note(r, `It is ${TIMES[time]} now.`);
      }
      r.world = seatPeople(r.world, r.scene.placeId, now.here, now.away);
      await save(userId, chatId, r);
      await show(userId, chatId, sheet, r);
    },

    async hexStep(userId: string, chatId: string, q: number, rr: number) {
      const ctx = await context(userId, chatId);
      if (!ctx?.r.hex || ctx.r.delve || ctx.r.battleId) return;
      const { sheet, r } = ctx;
      try {
        const arrived = hexMove(r, { q, r: rr });
        if (arrived) {
          const name = r.world.places[arrived]!.name;
          note(r, `You reach ${name}.`);
          await save(userId, chatId, r);
          await aside(chatId, `${sheet.player.name || "You"} reach${sheet.player.name ? "es" : ""} ${name}.`);
        } else {
          const c = r.hex!.map.cells[hexKey(q, rr)];
          note(r, `${c ? TERRAIN_NAME[c.t] : "Onward"}. ${r.hex!.state.supplies ? `${r.hex!.state.supplies} supplies left.` : "You are out of supplies, and it tells."}`);
          await save(userId, chatId, r);
        }
      } catch (err) {
        note(r, err instanceof Error ? err.message : String(err));
      }
      await show(userId, chatId, sheet, r);
    },

    async open(userId: string, chatId: string) {
      const ctx = await context(userId, chatId);
      if (ctx) await show(userId, chatId, ctx.sheet, ctx.r);
    },

    async setTheme(userId: string, chatId: string, theme: ThemeId) {
      const ctx = await context(userId, chatId);
      if (!ctx) return;
      ctx.r.theme = theme;
      await save(userId, chatId, ctx.r);
      await show(userId, chatId, ctx.sheet, ctx.r);
    },

    fight,

    /**
     * A line the player wrote in the scene: a model reads what it attempts, code rolls if it
     * matters, a narrator writes what happens, and the beat is kept here and in the chat.
     */
    async say(userId: string, chatId: string, raw: string) {
      const line = raw.trim().slice(0, 2000);
      if (!line) return;
      const ctx0 = await context(userId, chatId);
      if (!ctx0) return;
      const { sheet, r } = ctx0;
      const s = withPromoted(sheet, r);
      const place = r.world.places[r.scene.placeId];
      const people = s.cast.filter((c) => place?.people.includes(c.id)).map((c) => ({ id: c.id, name: c.name, role: c.role, voice: c.voice }));
      const story: StoryContext = {
        premise: sheet.premise,
        tone: sheet.tone,
        player: { name: sheet.player.name, concept: sheet.player.concept },
        place: { name: place?.name ?? "Here", description: place?.description ?? "" },
        time: TIMES[r.scene.time] ?? "",
        people,
        recent: (r.story ?? []).map((b) => ({ text: b.said, reply: b.reply })),
        memory: memoryNote(sheet, r),
      };
      await show(userId, chatId, sheet, r, "The story turns…");
      const models = modelsFor(spindle);
      const asked = judgePrompt(story, line);
      const said = await models
        .quiet(userId, "helper", { messages: [{ role: "system", content: asked.system }, { role: "user", content: asked.user }], parameters: { temperature: 0.1 }, signal: AbortSignal.timeout(15_000) })
        .catch((err: unknown) => (log(`story judge: ${String(err).slice(0, 160)}`), ""));
      const read = parseRead(said, people.map((p) => p.id)) ?? storyRules(line, people);
      const index = r.beats ?? 0;
      const res = resolveBeat(`${chatId}:${r.cardKey}`, index, read, sheet.player.social);
      const roll = res.roll ? rollLine(read.attempt, res.roll) : null;
      send({ type: "scene.story", chatId, said: line, roll, text: "" }, userId);
      const brief = storyNarrator(story, line, res.fallout);
      let last = 0;
      const written = await models
        .stream(userId, "narrator", { messages: [{ role: "system", content: brief.system }, { role: "user", content: brief.user }], parameters: { temperature: 0.9, max_tokens: 400 }, signal: AbortSignal.timeout(90_000) }, (t: string) => {
          if (Date.now() - last < 250) return;
          last = Date.now();
          send({ type: "scene.story", chatId, said: line, roll, text: cleanReply(t, 160) }, userId);
        })
        .catch((err: unknown) => (log(`story narrator: ${String(err).slice(0, 160)}`), ""));
      const reply = cleanReply(written, 160) || storyFallback(story, res.fallout);
      // The world may have grown while the models wrote: the beat lands on the latest record.
      const fresh = (await load(userId, chatId)) ?? r;
      fresh.beats = index + 1;
      fresh.story = [...(fresh.story ?? []), { said: line, roll, reply }].slice(-40);
      if (res.vigorLoss) fresh.scene = { ...fresh.scene, vigor: Math.max(0.2, fresh.scene.vigor - res.vigorLoss) };
      if (res.caughtBy) {
        const name = people.find((p) => p.id === res.caughtBy)?.name ?? res.caughtBy;
        record_(sheet, fresh, [{ day: fresh.scene.day, kind: "caught", target: res.caughtBy, name, method: read.attempt, place: fresh.scene.placeId }]);
      }
      if (read.target) interest(fresh, `cast:${read.target}`, NOTICE.talk);
      await save(userId, chatId, fresh);
      await show(userId, chatId, sheet, fresh);
      // The chat stays the record: both sides are posted without starting a generation.
      for (const m of [{ role: "user", content: line }, { role: "assistant", content: roll ? `*(${roll})*\n\n${reply}` : reply }]) {
        await spindle.chat.appendMessage(chatId, { ...m, metadata: { gambit: { story: true } } } as never, { triggerGeneration: false }).catch((err: unknown) => log(`story post: ${String(err).slice(0, 160)}`));
      }
    },

    async act(userId: string, chatId: string, hotspot: string) {
      const ctx = await context(userId, chatId);
      if (!ctx) return;
      const { sheet, r } = ctx;
      const p = r.world.places[r.scene.placeId]!;
      const spot = menuFor(sheet, r).find((h) => h.id === hotspot);
      const wild = wildCell(r);
      if (!spot) return send({ type: "notice", level: "warn", text: "That is not something you can do here." }, userId);
      switch (spot.kind) {
        case "talk":
          interest(r, `cast:${spot.target}`, NOTICE.talk);
          await save(userId, chatId, r);
          return cards.talk(userId, chatId, spot.target!);
        case "exit": {
          if (r.hex) {
            await travel(userId, chatId, sheet, r, spot.target!);
            break;
          }
          r.scene = moveScene(r.world, r.scene, { kind: "go", to: spot.target! });
          const to = r.world.places[spot.target!]!;
          note(r, `You go to ${to.name}.`);
          interest(r, `place:${to.id}`, NOTICE.visit);
          await save(userId, chatId, r);
          await aside(chatId, `${sheet.player.name || "You"} head${sheet.player.name ? "s" : ""} to ${to.name}.`);
          break;
        }
        case "rest": {
          if (wild) {
            // A camp in the wild costs supplies; without them the night is cold and does less.
            const fed = r.hex!.state.supplies >= 2;
            r.hex!.state = { ...r.hex!.state, supplies: Math.max(0, r.hex!.state.supplies - 2) };
            r.scene = sleepScene(r.scene, fed ? 0.85 : 0.55);
            note(r, `You make camp. Day ${r.scene.day} begins${fed ? "" : ", cold and hungry"}.`);
          } else {
            r.scene = moveScene(r.world, r.scene, { kind: "rest" });
            if (r.hex) r.hex.state = { ...r.hex.state, supplies: SUPPLY_MAX };
            note(r, `You rest. Day ${r.scene.day} begins.`);
          }
          const { deeds: today, rumors } = nightAdapt(r);
          await save(userId, chatId, r);
          await show(userId, chatId, sheet, r);
          // The night is the big compile window: the montage covers it, and the night phase runs under it.
          const nightJob = night(userId, chatId, sheet, today, r.scene.day - 1).catch((err) => log(`night: ${err instanceof Error ? err.message : String(err)}`));
          await meanwhile(userId, chatId, sheet, r, rumors);
          await nightJob;
          return;
        }
        case "wait":
          r.scene = moveScene(r.world, r.scene, { kind: "wait" });
          note(r, `Time passes: ${TIMES[r.scene.time]}.`);
          await save(userId, chatId, r);
          break;
        case "search": {
          if (wild) {
            const key = `wild:${r.hex!.state.q},${r.hex!.state.r}`;
            if (r.scene.searched.includes(key)) {
              note(r, "You have already picked this ground clean today.");
              break;
            }
            const roll = (([...`${chatId}:${key}:${r.scene.day}`].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261) >>> 0) % 20) + 1;
            const got = roll + (sheet.player.social.guile ?? 2) >= 10 ? (roll >= 17 ? 3 : 2) : 0;
            r.hex!.state = { ...r.hex!.state, supplies: Math.min(SUPPLY_MAX, r.hex!.state.supplies + got) };
            r.scene = { ...moveScene(r.world, r.scene, { kind: "wait" }), searched: [...r.scene.searched, key] };
            note(r, got ? `You forage (${roll}) and find ${got} days of supplies.` : `You forage (${roll}) and find nothing to eat.`);
            await save(userId, chatId, r);
            break;
          }
          interest(r, `place:${p.id}`, NOTICE.search);
          const quest = r.scene.searched.includes(p.id) ? null : questStep(r, p.id);
          if (quest) {
            r.scene = { ...moveScene(r.world, r.scene, { kind: "wait" }), searched: [...r.scene.searched, p.id] };
            note(r, quest);
            await save(userId, chatId, r);
            await aside(chatId, quest);
            break;
          }
          try {
            const res = searchScene(r.world, r.scene, sheet, `${chatId}:${p.id}`);
            r.scene = res.scene;
            const fact = res.factId ? sheet.facts.find((f) => f.id === res.factId) : undefined;
            let line = fact ? `Looking around ${p.name} (${res.roll} vs ${res.dc}), you learn: ${fact.text}` : `You look around ${p.name} (${res.roll} vs ${res.dc}) and find nothing new.`;
            // With the card's secrets found, searching turns up the central thread, one revelation at a time.
            const rev = !fact && r.thread && res.roll >= 8 ? r.thread.revelations.find((x) => !r.revealed?.includes(x.id)) : undefined;
            if (rev) {
              r.revealed = [...(r.revealed ?? []), rev.id];
              line = `Looking around ${p.name} (${res.roll}), you uncover part of it: ${rev.text}`;
            }
            note(r, line);
            await save(userId, chatId, r);
            if (rev) await aside(chatId, line);
            if (fact) {
              // A found fact counts as met in play: Parley Leverage can now use it (4.0).
              await cards.markKnown?.(userId, chatId, fact.id);
              await aside(chatId, line);
            }
          } catch (err) {
            note(r, err instanceof Error ? err.message : String(err));
          }
          break;
        }
        case "shop":
          send({ type: "scene.suggest", chatId, text: `*I look over what's for sale at ${p.name}.*` }, userId);
          return;
        case "fight":
          return fight(userId, chatId);
        case "delve":
          return enter(userId, chatId, sheet, r);
        case "explore":
          return explore(userId, chatId, sheet, r);
      }
      await show(userId, chatId, sheet, r);
    },

    async step(userId: string, chatId: string, move: DelveMove) {
      const ctx = await context(userId, chatId);
      if (!ctx?.r.delve) return;
      const { sheet, r } = ctx;
      const d = r.delve!;
      const { state, event } = stepDelve(d.map, d.state, move);
      d.state = state;
      switch (event.kind) {
        case "blocked":
          note(r, event.why === "locked" ? "A locked door. You need a key." : "A wall.");
          break;
        case "unlocked":
          note(r, "The key turns. The door grinds open.");
          break;
        case "found":
          note(r, event.what === "key" ? "You find a heavy iron key." : event.what === "treasure" ? `You find a cache: +25 ${sheet.skin.currency || "coin"}.` : "Nothing here.");
          if (event.what === "treasure") r.scene = { ...r.scene, coin: r.scene.coin + 25 };
          break;
        case "room": {
          const room = event.room;
          if (!event.first) break;
          if (room.kind === "fight" || room.kind === "boss") {
            await save(userId, chatId, r);
            return fight(userId, chatId, { room: room.id, ...(room.kind === "boss" ? { boss: true } : {}) });
          }
          if (room.kind === "trap") {
            r.scene = { ...r.scene, vigor: Math.max(0.2, r.scene.vigor - 0.15) };
            d.state = clearRoom(d.map, d.state, room.id);
            note(r, "A trap springs! Everyone is hurt.");
          } else if (room.kind === "rest") {
            r.scene = { ...r.scene, vigor: 1 };
            d.state = clearRoom(d.map, d.state, room.id);
            note(r, "A quiet room. You rest and recover.");
          } else if (room.kind === "key" || room.kind === "treasure") note(r, "Something glints here. Search the room.");
          else if (room.kind === "event") {
            d.state = clearRoom(d.map, d.state, room.id);
            note(r, "An empty chamber, long abandoned.");
          }
          break;
        }
        case "none":
          break;
      }
      await save(userId, chatId, r);
      await show(userId, chatId, sheet, r);
    },

    async leave(userId: string, chatId: string) {
      const ctx = await context(userId, chatId);
      if (!ctx?.r.delve) return;
      const { sheet, r } = ctx;
      const name = r.world.places[r.delve!.placeId]?.name ?? "the delve";
      const done = r.delve!.state.done;
      r.delve = undefined;
      if (r.theme === "onebit" && r.world.shape !== "delve") r.theme = "storybook";
      note(r, done ? `You leave ${name}, its master beaten.` : `You climb out of ${name}.`);
      await save(userId, chatId, r);
      await aside(chatId, done ? `${sheet.player.name || "You"} emerge${sheet.player.name ? "s" : ""} from ${name}, victorious.` : `${sheet.player.name || "You"} leave${sheet.player.name ? "s" : ""} ${name} for now.`);
      await show(userId, chatId, sheet, r);
    },
  };
}
