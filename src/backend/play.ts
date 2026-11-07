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
import type { CardSheet } from "../engine/card/types.js";
import type { BattleState, MonsterDef } from "../engine/types.js";
import { clearRoom, enterDelve, generateDelve, stepDelve, type DelveMove } from "../engine/world/delve.js";
import { buildWorld, hotspotsOf, moveScene, newScene, searchScene, TIMES } from "../engine/world/places.js";
import { npcArtKey } from "../shared/art-keys.js";
import type { ToFrontend } from "../shared/protocol.js";
import type { ThemeId } from "../shared/scene-view.js";
import { buildSceneView, cardTag, placeKey, wallKey, type PlayRecord } from "../shared/scene-build.js";

type Send = (msg: ToFrontend, userId: string) => void;


export interface CardsPort {
  sheetFor(userId: string, chatId: string): Promise<CardSheet | null>;
  armory(userId: string, chatId: string): Promise<CardSheet | null>;
  talk(userId: string, chatId: string, castId: string): Promise<void>;
  markKnown?(userId: string, chatId: string, factId: string): Promise<void>;
}

export interface BattlesPort {
  startState(userId: string, state: BattleState): Promise<void>;
}

const path = (chatId: string) => `play/${chatId}.json`;
const tag = cardTag;
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

  async function record(userId: string, chatId: string, sheet: CardSheet): Promise<PlayRecord> {
    const old = await load(userId, chatId);
    if (old && old.cardKey === sheet.cardKey && old.v === 1) return old;
    const world = buildWorld(sheet, `${sheet.cardKey}:${chatId}`);
    const r: PlayRecord = { v: 1, cardKey: sheet.cardKey, world, scene: newScene(world), theme: sheet.shape === "delve" ? "onebit" : "storybook", log: [] };
    await save(userId, chatId, r);
    return r;
  }

  const note = (r: PlayRecord, text: string) => {
    if (r.log[r.log.length - 1] === text) return;
    r.log = [...r.log, text].slice(-6);
  };


  /** Ask for the place's painting and the art of anyone here without art of their own. */
  function requestSceneArt(userId: string, sheet: CardSheet, r: PlayRecord): void {
    const p = r.world.places[r.scene.placeId];
    if (!p) return;
    const when = TIMES[r.scene.time];
    art.request(placeKey(sheet, p.id), { kind: "background", location: { id: `${tag(sheet.cardKey)}.${p.id}`, name: p.name, description: `${p.description}. ${sheet.premise.slice(0, 160)}`, timeOfDay: when } }, 0, userId);
    for (const id of p.exits) {
      const q = r.world.places[id];
      if (q) art.request(placeKey(sheet, q.id), { kind: "background", location: { id: `${tag(sheet.cardKey)}.${q.id}`, name: q.name, description: q.description } }, 2, userId);
    }
    for (const m of sheet.cast.filter((c) => p.people.includes(c.id) && !c.faces?.base && !c.avatarImageId)) {
      const seed = [...m.id].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261) >>> 0;
      art.request(npcArtKey(`${sheet.cardKey}:${m.id}`), { kind: "portrait", character: { id: `${sheet.cardKey}:${m.id}`, name: m.name, tags: "", description: `${m.look || m.role}. A character from ${sheet.cardName} (${sheet.skin.genre}): ${sheet.premise.slice(0, 120)}`, seed, sex: m.pronoun === "she" ? "girl" : m.pronoun === "he" ? "boy" : "other" } }, 1, userId);
    }
    if (r.delve) {
      const d = r.delve;
      art.request(wallKey(sheet, d.placeId), { kind: "background", location: { id: `${tag(sheet.cardKey)}.${d.placeId}.wall`, name: `${r.world.places[d.placeId]?.name ?? "delve"} wall`, description: `seamless tileable texture of a stone wall inside ${r.world.places[d.placeId]?.description ?? "a dungeon"}, flat, front view, no perspective, no objects` } }, 2, userId);
    }
  }


  async function show(userId: string, chatId: string, sheet: CardSheet, r: PlayRecord, busy?: string): Promise<void> {
    send({ type: "scene.state", view: view(sheet, chatId, r, busy) }, userId);
    requestSceneArt(userId, sheet, r);
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

  async function fight(userId: string, chatId: string, opts: { lead?: string; boss?: boolean; room?: string; title?: string } = {}): Promise<void> {
    const ctx = await context(userId, chatId);
    if (!ctx) return;
    let { sheet, r } = ctx;
    await show(userId, chatId, sheet, r, "Reading who you might fight on this card…");
    sheet = (await cards.armory(userId, chatId)) ?? sheet;
    const foes = [...(sheet.foes ?? [])];
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
      const def = ns(f.def);
      monsters[def.id] = def;
      if (def.phase2) monsters[def.phase2.into.id] = { ...def.phase2.into } as MonsterDef;
      return { def };
    });
    const slots = partyFromSheet(sheet, { exclude: lead?.id });
    const kits = new Map((sheet.kits ?? []).map((k) => [k.who, k]));
    const faces: Record<string, string> = {};
    const party = slots.map((p) => {
      const kit = kits.get(p.id);
      const m = p.castId ? sheet.cast.find((c) => c.id === p.castId) : undefined;
      const img = m?.faces?.base ?? m?.avatarImageId ?? null;
      if (img) faces[p.id] = img;
      return { classDef: kit ? kitClass(p.classDef, kit, p.id) : p.classDef, level: 5, id: p.id, name: p.name, art: img ? `face:${img}` : `class:${p.classDef.id}:${t}.${p.id}` };
    });
    let state = createBattle({ id: `${t}.${enc.id}.${Date.now().toString(36)}`, seed, party, enemies });
    // Vigor carries between fights: a tired party starts hurt.
    for (const c of state.combatants) if (c.side === "party") c.hp = Math.max(1, Math.round(c.maxHp * Math.max(0.35, r.scene.vigor)));
    state.meta = { title: enc.name, chatId, backdrop: r.delve ? placeKey(sheet, r.delve.placeId) : placeKey(sheet, r.scene.placeId), monsters, faces, ...(opts.room ? { room: opts.room } : {}) };
    state = advance(state, { enemyPolicy: chooseAction }).state;
    r = (await load(userId, chatId)) ?? r;
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
      if (r.delve?.state.done) line += ` The depths of ${r.world.places[r.delve.placeId]?.name ?? "the delve"} fall quiet.`;
    } else {
      // Story difficulty (4.2): lose, retreat, take a consequence. The model never rescues anyone.
      r.scene = { ...r.scene, vigor: 0.35, coin: Math.max(0, Math.round(r.scene.coin * 0.8)), placeId: r.world.start };
      if (r.delve) r.delve = undefined;
      line = `${state.meta?.title ?? "The fight"} is lost. ${party.map((c) => c.name).join(" and ")} fall back to ${r.world.places[r.world.start]?.name ?? "safety"}, bruised and lighter of ${cur}.`;
    }
    r.battleId = undefined;
    note(r, line);
    await save(userId, chatId, r);
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

  return {
    onBattleEnd,

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

    async act(userId: string, chatId: string, hotspot: string) {
      const ctx = await context(userId, chatId);
      if (!ctx) return;
      const { sheet, r } = ctx;
      const p = r.world.places[r.scene.placeId]!;
      const spot = hotspotsOf(r.world, p.id, sheet).find((h) => h.id === hotspot);
      if (!spot) return send({ type: "notice", level: "warn", text: "That is not something you can do here." }, userId);
      switch (spot.kind) {
        case "talk":
          return cards.talk(userId, chatId, spot.target!);
        case "exit": {
          r.scene = moveScene(r.world, r.scene, { kind: "go", to: spot.target! });
          const to = r.world.places[spot.target!]!;
          note(r, `You go to ${to.name}.`);
          await save(userId, chatId, r);
          await aside(chatId, `${sheet.player.name || "You"} head${sheet.player.name ? "s" : ""} to ${to.name}.`);
          break;
        }
        case "rest":
          r.scene = moveScene(r.world, r.scene, { kind: "rest" });
          note(r, `You rest. Day ${r.scene.day} begins.`);
          await save(userId, chatId, r);
          await aside(chatId, `Night passes at ${p.name}. Day ${r.scene.day} begins, and everyone is rested.`);
          break;
        case "wait":
          r.scene = moveScene(r.world, r.scene, { kind: "wait" });
          note(r, `Time passes: ${TIMES[r.scene.time]}.`);
          await save(userId, chatId, r);
          break;
        case "search": {
          try {
            const res = searchScene(r.world, r.scene, sheet, `${chatId}:${p.id}`);
            r.scene = res.scene;
            const fact = res.factId ? sheet.facts.find((f) => f.id === res.factId) : undefined;
            const line = fact ? `Looking around ${p.name} (${res.roll} vs ${res.dc}), you learn: ${fact.text}` : `You look around ${p.name} (${res.roll} vs ${res.dc}) and find nothing new.`;
            note(r, line);
            await save(userId, chatId, r);
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
