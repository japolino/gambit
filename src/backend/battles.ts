/**
 * Battle sessions on the backend. The engine is authoritative here: the
 * frontend only sends actions and plays back the events it gets. Each
 * battle's state is saved, and each chat remembers its running fight, so a
 * reload resumes it in that chat.
 */
import { emptyTally, tallyEvents } from "../engine/memory/memory.js";
import type { SpindleAPI } from "lumiverse-spindle-types";
import { actAndAdvance } from "../engine/battle.js";
import { chooseAction } from "../engine/ai.js";
import { ENCOUNTERS, startEncounter } from "../engine/content/index.js";
import type { Action, BattleState } from "../engine/types.js";
import type { ToFrontend } from "../shared/protocol.js";

type Send = (msg: ToFrontend, userId: string) => void;

const path = (battleId: string) => `battles/${encodeURIComponent(battleId)}.json`;
/** Each chat's latest fight; "none" holds the one started outside any chat (a demo encounter). */
const chatPath = (chatId: string | null) => `battles/chat/${encodeURIComponent(chatId ?? "none")}.json`;
/** Older saves kept one fight per user here. */
const OLD_CURRENT = "battles/current.json";
const chatOf = (state: BattleState): string | null => state.meta?.chatId ?? null;

export function createBattles(spindle: SpindleAPI, send: Send, onShown?: (state: BattleState, userId: string) => void, onEnd?: (state: BattleState, userId: string) => void) {
  const live = new Map<string, BattleState>();
  const key = (userId: string, battleId: string) => `${userId}\u0000${battleId}`;

  async function load(userId: string, battleId: string): Promise<BattleState | null> {
    const k = key(userId, battleId);
    if (live.has(k)) return live.get(k)!;
    const saved = await spindle.userStorage.getJson<BattleState | null>(path(battleId), { fallback: null, userId });
    if (saved) live.set(k, saved);
    return saved;
  }

  async function save(userId: string, state: BattleState): Promise<void> {
    live.set(key(userId, state.id), state);
    await spindle.userStorage.setJson(path(state.id), state, { userId });
    await spindle.userStorage.setJson(chatPath(chatOf(state)), { battleId: state.id }, { userId });
  }

  return {
    async start(userId: string, encounterId: string, seed?: string) {
      if (!ENCOUNTERS[encounterId]) return send({ type: "battle.error", error: `Unknown encounter ${encounterId}` }, userId);
      const state = startEncounter(encounterId, seed ?? crypto.randomUUID().slice(0, 8));
      await save(userId, state);
      send({ type: "battle.state", state, events: [] }, userId);
      onShown?.(state, userId);
    },

    /** A battle built elsewhere (a card fight): saved, shown, and its art requested. */
    async startState(userId: string, state: BattleState) {
      await save(userId, state);
      send({ type: "battle.state", state, events: [] }, userId);
      onShown?.(state, userId);
    },

    /** The chat's running fight, sent again. An older save's one fight belongs to the chat it was fought in. */
    async resume(userId: string, chatId: string | null) {
      const own = await spindle.userStorage.getJson<{ battleId?: string } | null>(chatPath(chatId), { fallback: null, userId });
      const battleId = own ? own.battleId : (await spindle.userStorage.getJson<{ battleId?: string }>(OLD_CURRENT, { fallback: {}, userId })).battleId;
      const state = battleId ? await load(userId, battleId) : null;
      if (state && chatOf(state) === chatId && state.outcome === "ongoing") {
        send({ type: "battle.state", state, events: [] }, userId);
        onShown?.(state, userId);
      }
    },

    /** One particular fight, shown again if it's still going. Whatever its state, says how it stands (null: it's gone). */
    async reshow(userId: string, battleId: string): Promise<BattleState | null> {
      const state = await load(userId, battleId);
      if (state?.outcome === "ongoing") {
        send({ type: "battle.state", state, events: [] }, userId);
        onShown?.(state, userId);
      }
      return state;
    },

    async act(userId: string, battleId: string, action: Action) {
      const state = await load(userId, battleId);
      if (!state) return send({ type: "battle.error", error: "That battle is gone.", battleId }, userId);
      try {
        const r = actAndAdvance(state, action, chooseAction);
        // Card battles keep a tally of how the party fights (the build profile, 4.6).
        if (r.state.meta) {
          const party = new Set(r.state.combatants.filter((c) => c.side === "party").map((c) => c.id));
          r.state.meta = { ...r.state.meta, tally: tallyEvents(r.state.meta.tally ?? emptyTally(), r.events, party) };
        }
        await save(userId, r.state);
        send({ type: "battle.state", state: r.state, events: r.events }, userId);
        if (state.outcome === "ongoing" && r.state.outcome !== "ongoing") onEnd?.(r.state, userId);
      } catch (err) {
        send({ type: "battle.error", error: err instanceof Error ? err.message : String(err), battleId }, userId);
        send({ type: "battle.state", state, events: [] }, userId);
      }
    },
  };
}
