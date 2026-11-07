/**
 * Starting kits from the card (docs/DESIGN.md 4.4): the Architect maps what
 * the card says someone can do onto effect atoms; code validates every atom,
 * fills every magnitude with the budget solver, and keeps the base class's
 * growth and resource. The same validator serves the Class Forge (M7).
 */
import { solveSkill, TIER_FOCUS } from "../budget.js";
import type { Atom, ClassDef, Element, SkillDef, StatusId, TargetRule } from "../types.js";
import { ELEMENTS, STATUS_IDS } from "../types.js";

export interface KitSkill {
  name: string;
  flavor: string;
  target: TargetRule;
  tier: number;
  atoms: Atom[];
  signature: boolean;
}

export interface CardKit {
  /** Party slot id (`p_player`, `p_<castId>`). */
  who: string;
  /** Their element for the basic attack. */
  element: Element;
  skills: KitSkill[];
}

const TARGETS: readonly TargetRule[] = ["self", "ally", "all_allies", "lowest_hp_ally", "enemy", "all_enemies", "random_enemies"];
const OPS = ["hit", "heal", "shield", "status", "cleanse", "delay", "haste_self", "gain", "drain", "execute"] as const;
type Op = (typeof OPS)[number];

const str = (v: unknown, max = 80): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown, lo: number, hi: number, d: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};
const isElement = (v: string): v is Element => (ELEMENTS as readonly string[]).includes(v);
const isStatus = (v: string): v is StatusId => (STATUS_IDS as readonly string[]).includes(v);
const DEBUFFS = new Set<StatusId>(["bleed", "burn", "poison", "frost", "stun", "fear", "mark", "vulnerable", "weaken", "slow", "silence", "taunt"]);

/** One atom from model JSON, with every number left "auto" for the solver; null when it is not a legal atom. */
export function parseAtom(v: unknown, element: Element): Atom | null {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const op = str(o.op) as Op;
  if (!(OPS as readonly string[]).includes(op)) return null;
  const weight = num(o.weight, 0.05, 1, 0.5);
  switch (op) {
    case "hit": {
      const el = str(o.element).toLowerCase();
      return { op, element: isElement(el) ? el : element, scale: str(o.scale) === "spirit" ? "spirit" : "might", power: "auto", hits: Math.round(num(o.hits, 1, 4, 1)), ...(o.stagger ? { stagger: Math.round(num(o.stagger, 1, 3, 1)) } : {}), weight };
    }
    case "status": {
      const st = str(o.status).toLowerCase();
      if (!isStatus(st)) return null;
      const self = !DEBUFFS.has(st);
      return { op, status: st, chance: "auto", turns: Math.round(num(o.turns, 1, 4, 2)), ...(self ? { self: true } : {}), weight };
    }
    case "heal":
      return { op, power: "auto", ...(o.self ? { self: true } : {}), weight };
    case "shield":
      return { op, power: "auto", turns: 2, ...(o.self ? { self: true } : {}), weight };
    case "cleanse":
      return { op, count: "auto", ...(o.self ? { self: true } : {}), weight };
    case "delay":
      return { op, amount: "auto", weight };
    case "haste_self":
      return { op, amount: "auto", weight };
    case "gain":
      return { op, resource: str(o.resource) === "class" ? "class" : "focus", n: "auto", weight };
    case "drain":
      return { op, pct: "auto", weight };
    case "execute":
      return { op, below: "auto", weight };
  }
}

/** A skill from model JSON, or null. Up to 3 atoms; healing and shields aim at allies, harm at enemies. */
export function parseKitSkill(v: unknown, element: Element): KitSkill | null {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const name = str(o.name, 40);
  if (!name) return null;
  const atoms = (Array.isArray(o.atoms) ? o.atoms : []).map((a) => parseAtom(a, element)).filter((a): a is Atom => !!a).slice(0, 3);
  if (!atoms.length) return null;
  let target = (TARGETS as readonly string[]).includes(str(o.target)) ? (str(o.target) as TargetRule) : "enemy";
  const harms = atoms.some((a) => a.op === "hit" || a.op === "delay" || a.op === "drain" || a.op === "execute" || (a.op === "status" && !a.self));
  const helps = atoms.some((a) => a.op === "heal" || a.op === "shield" || a.op === "cleanse");
  if (harms && !helps && !target.includes("enemy")) target = "enemy";
  if (helps && !harms && (target === "enemy" || target === "all_enemies" || target === "random_enemies")) target = "ally";
  if (harms && helps) {
    // Mixed: harm the enemy, help yourself.
    target = target.includes("enemy") ? target : "enemy";
    for (const a of atoms) if (a.op === "heal" || a.op === "shield" || a.op === "cleanse") (a as { self?: boolean }).self = true;
  }
  return { name, flavor: str(o.flavor, 140), target, tier: Math.round(num(o.tier, 1, 4, 2)), atoms, signature: o.signature === true };
}

export function parseKit(v: unknown, who: string): CardKit | null {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const el = str(o.element).toLowerCase();
  const element: Element = isElement(el) ? el : "physical";
  const skills = (Array.isArray(o.skills) ? o.skills : []).map((s) => parseKitSkill(s, element)).filter((s): s is KitSkill => !!s);
  // One signature at most: the highest tier.
  let sig = false;
  for (const s of [...skills].sort((a, b) => b.tier - a.tier)) {
    if (s.signature && !sig) sig = true;
    else s.signature = false;
  }
  return skills.length ? { who, element, skills: skills.slice(0, 4) } : null;
}

const idOf = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30) || "skill";

/** A base class wearing a card kit: its growth and resource, the kit's skills, sized by the solver. */
export function kitClass(base: ClassDef, kit: CardKit, slot: string): ClassDef {
  const skills: SkillDef[] = kit.skills.map((k, i) => {
    const tier = k.signature ? Math.max(3, k.tier) : k.tier;
    const def: SkillDef = {
      id: `${slot}_${idOf(k.name)}_${i}`,
      name: k.name,
      ...(k.flavor ? { flavor: k.flavor } : {}),
      target: k.target,
      tier,
      atoms: k.atoms.map((a) => ({ ...a })),
      cost: { focus: TIER_FOCUS[tier] ?? 10, cooldown: k.signature ? 4 : tier >= 3 ? 3 : tier >= 2 ? 2 : 1 },
      ...(k.signature ? { signature: true, visual: { cutin: "diagonal_band" as const } } : {}),
    };
    return solveSkill(def);
  });
  const attack: SkillDef = { ...base.attack, id: `${slot}_attack`, atoms: base.attack.atoms.map((a) => (a.op === "hit" ? { ...a, element: kit.element } : a)) };
  return { ...base, id: `${base.id}~${slot}`, skills, attack };
}
