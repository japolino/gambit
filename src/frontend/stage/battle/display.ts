/**
 * What the stage shows for each combatant while events play. Pure. The
 * engine hands the stage a final state and the events that led to it; the
 * bars should move with each hit, not jump to the end, so the stage keeps
 * this display copy and applies events one at a time. When the batch ends
 * it syncs to the final state, which corrects any drift.
 */
import type { BattleEvent, BattleState, Combatant, RigKind, Side, StatusId } from "../../../engine/types.js";

export type DisplayStatus = { id: StatusId; stacks: number; turns: number };

export type DisplayUnit = {
  id: string;
  name: string;
  side: Side;
  defId: string;
  hp: number;
  maxHp: number;
  focus: number;
  maxFocus: number;
  shield: number;
  poise: number;
  maxPoise: number;
  broken: boolean;
  alive: boolean;
  statuses: DisplayStatus[];
  resource?: { name: string; value: number; max: number };
  rig: RigKind;
  art: string;
  phase: 1 | 2;
};

export function displayUnit(c: Combatant): DisplayUnit {
  return {
    id: c.id,
    name: c.name,
    side: c.side,
    defId: c.defId,
    hp: c.hp,
    maxHp: c.maxHp,
    focus: c.focus,
    maxFocus: c.maxFocus,
    shield: c.shield,
    poise: c.poise,
    maxPoise: c.maxPoise,
    broken: c.broken,
    alive: c.alive,
    statuses: c.statuses.map((s) => ({ id: s.id, stacks: s.stacks, turns: s.turns })),
    resource: c.resource ? { name: c.resource.name, value: c.resource.value, max: c.resource.max } : undefined,
    rig: c.rig,
    art: c.art,
    phase: c.phase,
  };
}

export function displayFromState(state: BattleState): Map<string, DisplayUnit> {
  return new Map(state.combatants.map((c) => [c.id, displayUnit(c)]));
}

/** Apply one event to the display copy. `final` fills what an event does not carry (a phase's new numbers). */
export function applyEvent(units: Map<string, DisplayUnit>, ev: BattleEvent, final?: BattleState): void {
  const get = (id: string) => units.get(id);
  switch (ev.kind) {
    case "hit": {
      const u = get(ev.target);
      if (!u) return;
      u.shield = Math.max(0, u.shield - ev.shieldTaken);
      u.hp = Math.max(0, u.hp - ev.amount);
      return;
    }
    case "status_tick": {
      const u = get(ev.target);
      if (!u) return;
      const harmful = ev.status !== "regen";
      u.hp = harmful ? Math.max(0, u.hp - ev.amount) : Math.min(u.maxHp, u.hp + ev.amount);
      return;
    }
    case "heal": {
      const u = get(ev.target);
      if (u) u.hp = Math.min(u.maxHp, u.hp + ev.amount);
      return;
    }
    case "shield": {
      const u = get(ev.target);
      if (u) u.shield += ev.amount;
      return;
    }
    case "status_on": {
      const u = get(ev.target);
      if (!u) return;
      const found = u.statuses.find((s) => s.id === ev.status);
      if (found) {
        found.stacks = ev.stacks;
        found.turns = ev.turns;
      } else u.statuses.push({ id: ev.status, stacks: ev.stacks, turns: ev.turns });
      return;
    }
    case "status_off": {
      const u = get(ev.target);
      if (u) u.statuses = u.statuses.filter((s) => s.id !== ev.status);
      return;
    }
    case "poise": {
      const u = get(ev.target);
      if (!u) return;
      u.poise = ev.poise;
      u.maxPoise = ev.max;
      return;
    }
    case "break": {
      const u = get(ev.target);
      if (u) u.broken = true;
      return;
    }
    case "recover": {
      const u = get(ev.target);
      if (u) u.broken = false;
      return;
    }
    case "resource": {
      const u = get(ev.target);
      if (u?.resource) {
        u.resource.value = ev.value;
        u.resource.max = ev.max;
      }
      return;
    }
    case "focus": {
      const u = get(ev.target);
      if (!u) return;
      u.focus = ev.value;
      u.maxFocus = ev.max;
      return;
    }
    case "defeat": {
      const u = get(ev.target);
      if (!u) return;
      u.alive = false;
      u.hp = 0;
      u.statuses = [];
      return;
    }
    case "phase": {
      const u = get(ev.target);
      const c = final?.combatants.find((x) => x.id === ev.target);
      if (!u) return;
      u.name = ev.name;
      u.phase = 2;
      u.broken = false;
      u.statuses = [];
      if (c) {
        u.defId = c.defId;
        u.maxHp = c.maxHp;
        u.hp = c.maxHp;
        u.maxPoise = c.maxPoise;
        u.poise = c.maxPoise;
        u.rig = c.rig;
        u.art = c.art;
      }
      return;
    }
    default:
      return;
  }
}
