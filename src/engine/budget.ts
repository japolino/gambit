/**
 * The budget solver (docs/DESIGN.md, 4.3). A designer (a person or a model)
 * picks a skill's shape: which atoms, targets, conditions, costs, and a
 * weight per atom. Code picks the sizes. Every atom has a point price per
 * unit; a skill's budget comes from its tier plus whatever it pays (Focus,
 * resource, HP, cooldown, a slow recovery). "auto" magnitudes split the
 * remaining points by weight.
 */
import { STATUS_RULES } from "./statuses.js";
import type { Atom, Mag, SkillDef, TargetRule } from "./types.js";

/** Points a skill of each tier may spend (index = tier; 0 = basic attack). */
export const TIER_BUDGET = [10, 16, 22, 30, 40, 52] as const;

export const SIGNATURE_BONUS = 1.2;

/** Default Focus price per tier when a skill says `focus: "auto"`. */
export const TIER_FOCUS = [0, 6, 10, 15, 22, 30] as const;

const num = (m: Mag | undefined, fallback = 0): number => (typeof m === "number" ? m : fallback);

/** How many bodies a target rule usually reaches, as a price multiplier. */
export function targetMultiplier(rule: TargetRule, count = 1): number {
  switch (rule) {
    case "all_enemies":
    case "all_allies":
      return 1.6;
    case "random_enemies":
      return 0.55 * Math.max(1, count);
    default:
      return 1;
  }
}

/** Points gained back from what the skill costs its user. */
export function refunds(skill: SkillDef): number {
  const c = skill.cost ?? {};
  const focus = c.focus === "auto" ? TIER_FOCUS[skill.tier] ?? 0 : num(c.focus);
  let pts = focus * 0.9 + (c.resource ?? 0) * 4 + (c.hpPct ?? 0) * 0.5 + (c.cooldown ?? 0) * 3;
  const delay = skill.delay ?? 1;
  pts += (delay - 1) * 20;
  return pts;
}

export function skillBudget(skill: SkillDef): number {
  const base = TIER_BUDGET[Math.max(0, Math.min(5, skill.tier))];
  return base * (skill.signature ? SIGNATURE_BONUS : 1) + refunds(skill);
}

/** Price of one unit of an atom's main magnitude, before target and condition multipliers. */
export function unitPrice(atom: Atom): number {
  switch (atom.op) {
    case "hit": {
      const hits = atom.hits ?? 1;
      const pierce = atom.pierce ?? 0;
      return hits * (1 + 0.5 * pierce);
    }
    case "heal": return 1.4;
    case "shield": return 1.2 * ((atom.turns ?? 2) / 2);
    case "status": {
      const rule = STATUS_RULES[atom.status];
      const stacks = num(atom.stacks, 1);
      const turns = atom.turns ?? rule.turns;
      // price per 1% chance
      return (rule.value * stacks * (turns / rule.turns)) / 100;
    }
    case "cleanse": return 4;
    case "delay": return 0.12;
    case "haste_self": return 0.12;
    case "gain": return atom.resource === "class" ? 3.5 : 0.6;
    case "drain": return 0.15;
    case "execute": return 0.25;
    // priced for a nearly full bar: the bonus is perStack x stacks spent
    case "spend_all_for_power": return 4;
    case "when":
    case "on_break":
    case "on_kill":
      return 0;
  }
}

/** Fixed extra cost an atom carries regardless of magnitude. */
function fixedExtra(atom: Atom): number {
  if (atom.op === "hit" && atom.stagger !== undefined) return Math.max(0, atom.stagger - 1) * 2;
  return 0;
}

export const CONDITION_FACTOR = { when: 0.6, on_break: 0.4, on_kill: 0.35 } as const;

interface Slot {
  atom: Atom;
  /** Combined multiplier (targets x conditions). */
  mult: number;
  weight: number;
}

function magnitudeOf(atom: Atom): Mag | undefined {
  switch (atom.op) {
    case "hit":
    case "heal":
    case "shield": return atom.power;
    case "status": return atom.chance;
    case "cleanse": return atom.count;
    case "delay":
    case "haste_self": return atom.amount;
    case "gain": return atom.n;
    case "drain": return atom.pct;
    case "execute": return atom.below;
    case "spend_all_for_power": return atom.perStack;
    default: return undefined;
  }
}

function setMagnitude(atom: Atom, value: number): void {
  switch (atom.op) {
    case "hit":
    case "heal":
    case "shield": atom.power = Math.max(1, Math.round(value)); break;
    case "status": atom.chance = Math.max(5, Math.min(100, Math.round(value / 5) * 5)); break;
    case "cleanse": atom.count = Math.max(1, Math.round(value)); break;
    case "delay":
    case "haste_self": atom.amount = Math.max(5, Math.round(value / 5) * 5); break;
    case "gain": atom.n = Math.max(1, Math.round(value)); break;
    case "drain": atom.pct = Math.max(5, Math.min(100, Math.round(value / 5) * 5)); break;
    case "execute": atom.below = Math.max(5, Math.min(50, Math.round(value / 5) * 5)); break;
    case "spend_all_for_power": atom.perStack = Math.max(1, Math.round(value)); break;
  }
}

/** Atoms that land on the user once, whatever the skill targets. */
export function isSelfish(atom: Atom): boolean {
  return atom.op === "haste_self" || atom.op === "drain" || atom.op === "gain" || ("self" in atom && atom.self === true);
}

function atCap(atom: Atom): boolean {
  return (atom.op === "status" && atom.chance === 100) || (atom.op === "drain" && atom.pct === 100) || (atom.op === "execute" && atom.below === 50);
}

function collect(atoms: Atom[], mult: number, out: Slot[], parentWeight = 1): void {
  for (const atom of atoms) {
    if (atom.op === "when" || atom.op === "on_break" || atom.op === "on_kill") {
      // A wrapper's weight is shared among the atoms inside it.
      const inner = atom.then.length || 1;
      collect(atom.then, mult * CONDITION_FACTOR[atom.op], out, (parentWeight * (atom.weight ?? 1)) / inner);
      continue;
    }
    out.push({ atom, mult, weight: parentWeight * (atom.weight ?? 1) });
  }
}

/** Fill every "auto" in a skill so its total price matches its budget. Returns a new skill. */
export function solveSkill(input: SkillDef): SkillDef {
  const skill: SkillDef = structuredClone(input);
  if (skill.cost?.focus === "auto") skill.cost.focus = TIER_FOCUS[skill.tier] ?? 0;
  const tMult = targetMultiplier(skill.target, skill.count);
  const slots: Slot[] = [];
  collect(skill.atoms, 1, slots);

  // Atoms aimed at the user or allies are priced at single target when the
  // skill hits enemies (a self-buff riding on an AoE attack is not an AoE buff).
  const priceMult = (s: Slot): number => {
    return s.mult * (isSelfish(s.atom) ? 1 : tMult);
  };

  let budget = skillBudget(skill);
  const autos: Slot[] = [];
  for (const s of slots) {
    budget -= fixedExtra(s.atom) * priceMult(s);
    const m = magnitudeOf(s.atom);
    if (m === "auto") autos.push(s);
    else if (typeof m === "number") budget -= m * unitPrice(s.atom) * priceMult(s);
    if (s.atom.op === "status" && s.atom.stacks === "auto") s.atom.stacks = 1;
  }

  // A magnitude can hit its cap (a 100% chance, a 50% execute line). Its
  // spare points go back to the atoms that are still free, for one more pass.
  let pending = autos;
  for (let pass = 0; pass < 3 && pending.length > 0 && budget > 0.5; pass++) {
    const totalWeight = pending.reduce((n, s) => n + s.weight, 0) || 1;
    const share = budget;
    const free: Slot[] = [];
    for (const s of pending) {
      const pts = (share * s.weight) / totalWeight;
      const price = unitPrice(s.atom) * priceMult(s);
      const before = pass === 0 ? 0 : (magnitudeOf(s.atom) as number);
      const want = before + (price > 0 ? pts / price : 0);
      setMagnitude(s.atom, want);
      const got = magnitudeOf(s.atom) as number;
      budget -= (got - before) * price;
      if (!atCap(s.atom)) free.push(s);
    }
    if (free.length === pending.length) break;
    pending = free;
  }
  // Anything still "auto" (no budget left) gets the floor value.
  for (const s of autos) if (magnitudeOf(s.atom) === "auto") setMagnitude(s.atom, 0);
  skill.solved = true;
  return skill;
}

/** Total price of a solved skill (for tests and the design preview). */
export function skillPrice(skill: SkillDef): number {
  const tMult = targetMultiplier(skill.target, skill.count);
  const slots: Slot[] = [];
  collect(skill.atoms, 1, slots);
  let total = 0;
  for (const s of slots) {
    const pm = s.mult * (isSelfish(s.atom) ? 1 : tMult);
    total += fixedExtra(s.atom) * pm;
    const m = magnitudeOf(s.atom);
    if (typeof m === "number") total += m * unitPrice(s.atom) * pm;
  }
  return total;
}
