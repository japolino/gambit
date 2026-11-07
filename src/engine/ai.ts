/**
 * Combat AI. Scores every legal action with a quick estimate and picks the
 * best most of the time, so fights feel purposeful without being perfect.
 * The same policy drives the party in the balance simulator.
 */
import { estimateHit, legalActions, livingOf, hpPercent, rand, combatant } from "./battle.js";
import { STATUS_RULES } from "./statuses.js";
import type { Action, Atom, BattleState, Combatant, SkillDef } from "./types.js";

const num = (v: number | "auto" | undefined, d = 0): number => (typeof v === "number" ? v : d);

function flatten(atoms: Atom[], weight = 1, out: { atom: Atom; w: number }[] = []): { atom: Atom; w: number }[] {
  for (const a of atoms) {
    if (a.op === "when") flatten(a.then, weight * 0.5, out);
    else if (a.op === "on_break" || a.op === "on_kill") flatten(a.then, weight * 0.3, out);
    else out.push({ atom: a, w: weight });
  }
  return out;
}

function scoreAgainst(state: BattleState, src: Combatant, t: Combatant, skill: SkillDef): number {
  let score = 0;
  for (const { atom, w } of flatten(skill.atoms)) {
    switch (atom.op) {
      case "hit": {
        if (!t.alive || t.side === src.side) break;
        const bonus = atom.op === "hit" && skill.atoms.some((a) => a.op === "spend_all_for_power") ? (src.resource?.value ?? 0) * 4 : 0;
        const est = estimateHit(src, t, atom, bonus);
        score += w * Math.min(est, t.hp + t.shield) ;
        if (est >= t.hp + t.shield) score += w * 40;
        if ((t.affinities[atom.element] ?? 1) >= 2) score += w * 15;
        if (t.broken) score += w * 8;
        break;
      }
      case "heal": {
        const who = atom.self ? src : t;
        const missing = who.maxHp - who.hp;
        const pct = hpPercent(who);
        score += pct < 70 ? w * Math.min(missing, num(atom.power) * 2.5) * 1.3 : -30;
        break;
      }
      case "shield": {
        const who = atom.self ? src : t;
        score += w * (hpPercent(who) < 55 ? 18 : 4);
        break;
      }
      case "status": {
        const who = atom.self ? src : t;
        const rule = STATUS_RULES[atom.status];
        const already = who.statuses.some((x) => x.id === atom.status);
        if (rule.good === (who.side === src.side) && !already) score += w * (num(atom.chance) / 100) * rule.value * 2.2;
        break;
      }
      case "cleanse": {
        const who = atom.self ? src : t;
        score += w * who.statuses.filter((x) => !STATUS_RULES[x.id].good).length * 8;
        break;
      }
      case "delay":
        score += w * num(atom.amount) / 8;
        break;
      case "execute":
        if (hpPercent(t) <= num(atom.below)) score += 60;
        break;
      default:
        score += w * 2;
    }
  }
  return score;
}

function targetsFor(state: BattleState, src: Combatant, skill: SkillDef, set: string[]): Combatant[] {
  if (set.length) return set.map((id) => combatant(state, id)!).filter(Boolean);
  switch (skill.target) {
    case "self": return [src];
    case "all_allies": return livingOf(state, src.side);
    case "lowest_hp_ally": return livingOf(state, src.side).sort((a, b) => hpPercent(a) - hpPercent(b)).slice(0, 1);
    case "all_enemies": return livingOf(state, src.side === "party" ? "enemy" : "party");
    case "random_enemies": {
      const pool = livingOf(state, src.side === "party" ? "enemy" : "party");
      // expected value: average target, times the number of picks
      return pool.length ? Array(skill.count ?? 1).fill(pool[0]) : [];
    }
    default: return [];
  }
}

export function chooseAction(state: BattleState, actorId: string): Action {
  const src = combatant(state, actorId)!;
  const options = legalActions(state, actorId).filter((o) => o.usable);
  const scored: { action: Action; score: number }[] = [];
  for (const o of options) {
    const costFocus = typeof o.skill.cost?.focus === "number" ? o.skill.cost.focus : 0;
    for (const set of o.targetSets) {
      const ts = targetsFor(state, src, o.skill, set);
      let score = ts.reduce((n, t) => n + scoreAgainst(state, src, t, o.skill), 0);
      score -= costFocus * 0.25;
      score -= (o.skill.cost?.resource ?? 0) * 1.5;
      if (src.ai === "boss" && o.skill.signature) score += 12;
      if (src.ai === "assassin" && set[0]) score += (100 - hpPercent(combatant(state, set[0])!)) * 0.25;
      if (src.ai === "brute" && set[0]) score -= combatant(state, set[0])!.stats.guard * 0.2;
      scored.push({ action: { actor: actorId, skill: o.skill.id, targets: set }, score });
    }
  }
  if (scored.length === 0) return { actor: actorId, skill: src.attack, targets: [] };
  scored.sort((a, b) => b.score - a.score);
  const r = rand(state);
  if (r < 0.75 || scored.length === 1) return scored[0].action;
  const top = scored.slice(0, Math.min(3, scored.length));
  return top[Math.floor(rand(state) * top.length)].action;
}
