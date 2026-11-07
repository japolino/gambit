/**
 * Battle sessions on the backend. The engine is authoritative here: the
 * frontend only sends actions and plays back the events it gets. Each
 * battle's state is saved per user, so a reload resumes the same fight.
 */
import type { SpindleAPI } from "lumiverse-spindle-types";
import { actAndAdvance } from "../engine/battle.js";
import { chooseAction } from "../engine/ai.js";
import { ENCOUNTERS, startEncounter } from "../engine/content/index.js";
import type { Action, BattleState } from "../engine/types.js";
import type { ToFrontend } from "../shared/protocol.js";

type Send = (msg: ToFrontend, userId: string) => void;

const path = (battleId: string) => `battles/${encodeURIComponent(battleId)}.json`;

export function createBattles(spindle: SpindleAPI, send: Send, onShown?: (state: BattleState, userId: string) => void) {
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
    await spindle.userStorage.setJson("battles/current.json", { battleId: state.id }, { userId });
  }

  return {
    async start(userId: string, encounterId: string, seed?: string) {
      if (!ENCOUNTERS[encounterId]) return send({ type: "battle.error", error: `Unknown encounter ${encounterId}` }, userId);
      const state = startEncounter(encounterId, seed ?? crypto.randomUUID().slice(0, 8));
      await save(userId, state);
      send({ type: "battle.state", state, events: [] }, userId);
      onShown?.(state, userId);
    },

    async resume(userId: string) {
      const current = await spindle.userStorage.getJson<{ battleId?: string }>("battles/current.json", { fallback: {}, userId });
      if (!current.battleId) return;
      const state = await load(userId, current.battleId);
      if (state && state.outcome === "ongoing") {
        send({ type: "battle.state", state, events: [] }, userId);
        onShown?.(state, userId);
      }
    },

    async act(userId: string, battleId: string, action: Action) {
      const state = await load(userId, battleId);
      if (!state) return send({ type: "battle.error", error: "That battle is gone." }, userId);
      try {
        const r = actAndAdvance(state, action, chooseAction);
        await save(userId, r.state);
        send({ type: "battle.state", state: r.state, events: r.events }, userId);
      } catch (err) {
        send({ type: "battle.error", error: err instanceof Error ? err.message : String(err) }, userId);
        send({ type: "battle.state", state, events: [] }, userId);
      }
    },
  };
}
