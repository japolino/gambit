/**
 * Classes the player makes (docs/DESIGN.md 4.4, M7): the class book a
 * campaign keeps, ranks from wins, the Class Forge, fusion, skill
 * awakening, and what goes into the codex. All of it is code: the
 * Architect's drafts arrive already parsed (src/meaning/forge.ts) and are
 * checked, sized by the budget solver and tested in sim fights here.
 */
import { advance, createBattle } from "../battle.js";
import { chooseAction } from "../ai.js";
import { solveSkill, TIER_FOCUS } from "../budget.js";
import type { KitSkill } from "../card/kits.js";
import { statsAt } from "../combatant.js";
import { CLASSES } from "../content/classes.js";
import { ENCOUNTERS } from "../content/index.js";
import { MONSTERS } from "../content/monsters.js";
import { seededRng } from "../dice.js";
import { STATUS_RULES } from "../statuses.js";
import type { Atom, ClassDef, Element, PassiveDef, ResourceDef, SkillDef, SkillVisual, Stat, StatBlock, StatusId, TargetRule, TriggerEvent } from "../types.js";
import { STATS } from "../types.js";

/* ------------------------------ the book ------------------------------ */

/** Wins with a class for each rank. */
export const RANK_WINS = 2;
export const MAX_RANK = 5;
/** Both parents of a fusion need this rank. */
export const FUSE_RANK = 3;
/** Uses before a skill can awaken. */
export const AWAKEN_AT = 50;
export const rankOf = (wins: number): number => Math.min(MAX_RANK, 1 + Math.floor(Math.max(0, wins) / RANK_WINS));

export type ClassOrigin = "card" | "base" | "forged" | "fused" | "codex";

export interface OwnedClass {
  /** The class. For "base" it is looked up again in CLASSES (so tuning reaches old saves). */
  def: ClassDef;
  origin: ClassOrigin;
  wins: number;
  /** Names of a fusion's parents. */
  parents?: [string, string];
  /** What the player wrote at the Forge. */
  prompt?: string;
  /** One line about who uses it. */
  identity?: string;
  /** Art key of its portrait (forged, fused and codex classes). */
  art?: string;
  at: number;
}

export type PendingKind = "forge" | "fusion" | "awaken";

/** A class or a skill shown before the player confirms it. */
export interface Pending {
  kind: PendingKind;
  /** The class it would add (forge, fusion). */
  owned?: OwnedClass;
  /** Awakening: the skill and the three choices. */
  skillId?: string;
  options?: SkillDef[];
  /** What was changed from the request, in plain words. */
  changes: string[];
  /** Test fights, one line. */
  sim?: string;
  /** Fusion: the two parent ids, and whether the one reroll is spent. */
  pair?: [string, string];
  rerolled?: boolean;
}

export interface ClassBook {
  /** Class id in `classes`; "card" is the kit the card gives you. */
  active: string;
  classes: Record<string, OwnedClass>;
  /** Skill id → times used in battle. */
  uses: Record<string, number>;
  /** Original skill id → its awakened form. */
  awakened: Record<string, SkillDef>;
  /** Blank Crests (the Forge) and catalysts (fusion). */
  crests: number;
  catalysts: number;
  pending?: Pending | null;
}

export function newBook(now = Date.now()): ClassBook {
  const classes: Record<string, OwnedClass> = {};
  for (const [id, def] of Object.entries(CLASSES)) classes[id] = { def, origin: "base", wins: 0, at: now };
  return { active: "card", classes, uses: {}, awakened: {}, crests: 1, catalysts: 0, pending: null };
}

/** The class an owned entry stands for today. */
export const defOf = (o: OwnedClass): ClassDef => (o.origin === "base" ? (CLASSES[o.def.id] ?? o.def) : o.def);

/** Swap every awakened skill into a class. */
export function applyAwakenings(cls: ClassDef, awakened: Record<string, SkillDef>): ClassDef {
  if (!Object.keys(awakened).length) return cls;
  return { ...cls, skills: cls.skills.map((s) => awakened[s.id] ?? s) };
}

/** Count skill uses from a battle's tally into the book; returns skills that just became ready to awaken. */
export function countUses(book: ClassBook, uses: Record<string, number>): string[] {
  const ready: string[] = [];
  for (const [id, n] of Object.entries(uses)) {
    const before = book.uses[id] ?? 0;
    book.uses[id] = before + n;
    if (before < AWAKEN_AT && book.uses[id]! >= AWAKEN_AT && !book.awakened[id]) ready.push(id);
  }
  return ready;
}

/* ---------------------------- small helpers --------------------------- */

const hashOf = (s: string): string => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
};
export const slugOf = (s: string, d = "class"): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || d;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Every atom in a list, wrappers opened. */
export function flatAtoms(atoms: readonly Atom[]): Atom[] {
  const out: Atom[] = [];
  for (const a of atoms) {
    if (a.op === "when" || a.op === "on_break" || a.op === "on_kill") out.push(...flatAtoms(a.then));
    else out.push(a);
  }
  return out;
}

/** What a class is made of: the ops, elements and statuses its skills use. */
export interface Families {
  ops: Set<Atom["op"]>;
  elements: Set<Element>;
  statuses: Set<StatusId>;
}

export function familiesOf(...classes: ClassDef[]): Families {
  const f: Families = { ops: new Set(), elements: new Set(), statuses: new Set() };
  for (const c of classes) {
    for (const s of [c.attack, ...c.skills]) {
      for (const a of flatAtoms(s.atoms)) {
        f.ops.add(a.op);
        if (a.op === "hit") f.elements.add(a.element);
        if (a.op === "status") f.statuses.add(a.status);
      }
    }
    for (const p of c.passives) for (const a of flatAtoms(p.atoms)) {
      f.ops.add(a.op);
      if (a.op === "status") f.statuses.add(a.status);
    }
  }
  if (!f.elements.size) f.elements.add("physical");
  f.ops.add("hit");
  return f;
}

/** Keep only atoms the families allow; an element outside them becomes the nearest one the parents have. */
export function restrictAtoms(atoms: readonly Atom[], fam: Families, notes: string[], label: string): Atom[] {
  const out: Atom[] = [];
  const firstEl = [...fam.elements][0] ?? "physical";
  for (const a of atoms) {
    if (a.op === "when" || a.op === "on_break" || a.op === "on_kill") {
      const inner = restrictAtoms(a.then, fam, notes, label);
      if (inner.length) out.push({ ...a, then: inner });
      continue;
    }
    if (!fam.ops.has(a.op)) {
      notes.push(`${label}: dropped "${a.op}", which neither parent uses.`);
      continue;
    }
    if (a.op === "status" && !fam.statuses.has(a.status)) {
      notes.push(`${label}: dropped ${STATUS_RULES[a.status].name}, which neither parent uses.`);
      continue;
    }
    if (a.op === "hit" && !fam.elements.has(a.element)) {
      notes.push(`${label}: ${a.element} became ${firstEl}, an element the parents have.`);
      out.push({ ...a, element: firstEl });
      continue;
    }
    out.push(a);
  }
  return out;
}

const CUTINS: NonNullable<SkillVisual["cutin"]>[] = ["diagonal_band", "eye_strip", "full_splash", "triple_panel", "shatter"];

/** A kit skill turned into a sized skill. Signatures pay with the class resource when there is one. */
export function sizedSkill(k: KitSkill, id: string, hasResource: boolean): SkillDef {
  const tier = k.signature ? Math.max(3, k.tier) : k.tier;
  const cost = k.signature && hasResource ? { resource: 3, cooldown: 2 } : { focus: TIER_FOCUS[tier] ?? 10, cooldown: k.signature ? 4 : tier >= 3 ? 3 : tier >= 2 ? 2 : 1 };
  return solveSkill({
    id,
    name: k.name,
    ...(k.flavor ? { flavor: k.flavor } : {}),
    target: k.target,
    tier,
    atoms: k.atoms.map((a) => structuredClone(a)),
    cost,
    ...(k.signature ? { signature: true, visual: { cutin: "diagonal_band" as const } } : {}),
  });
}

/** How often a passive fires on each trigger: frequent triggers fire less often. */
const PASSIVE_CHANCE: Record<TriggerEvent, number> = { turn_start: 100, deal_hit: 30, take_hit: 30, apply_status: 35, kill: 100, break: 100, crit: 100, ally_falls: 100 };

export interface PassiveDraft {
  name: string;
  text: string;
  on: TriggerEvent;
  atoms: Atom[];
}

/** A passive sized at a tier-1 budget, firing at the trigger's chance. */
export function sizedPassive(p: PassiveDraft, id: string): PassiveDef | null {
  if (!p.atoms.length) return null;
  const helps = p.atoms.every((a) => a.op === "heal" || a.op === "shield" || a.op === "cleanse" || a.op === "gain" || a.op === "haste_self" || (a.op === "status" && STATUS_RULES[a.status].good));
  const target: TargetRule = helps ? "self" : "enemy";
  const solved = solveSkill({ id, name: p.name, target, tier: 1, atoms: p.atoms.map((a) => structuredClone(a)) });
  return { id, name: p.name, text: p.text, on: p.on, atoms: solved.atoms, ...(target === "enemy" ? { target } : {}), chance: PASSIVE_CHANCE[p.on] };
}

/* ------------------------------ stats -------------------------------- */

type Line = StatBlock & { hp: number; focus: number };
const KEYS = [...STATS, "hp", "focus"] as const;

function average(field: "base" | "growth"): Line {
  const all = Object.values(CLASSES);
  const out = {} as Line;
  for (const k of KEYS) out[k] = all.reduce((n, c) => n + c[field][k], 0) / all.length;
  return out;
}

export interface Lean {
  high: Stat[];
  low: Stat | null;
  hp: "low" | "mid" | "high";
}

/** Stats for a forged class: the base classes' average, tilted by what the player described. */
export function statsFromLean(lean: Lean): { base: Line; growth: Line } {
  const base = average("base");
  const growth = average("growth");
  for (const s of lean.high.slice(0, 2)) {
    base[s] += 4;
    growth[s] += 0.6;
  }
  if (lean.low && !lean.high.includes(lean.low)) {
    base[lean.low] = Math.max(3, base[lean.low] - 4);
    growth[lean.low] = Math.max(0.3, growth[lean.low] - 0.5);
  }
  if (lean.hp !== "mid") {
    const d = lean.hp === "high" ? 1 : -1;
    base.hp += 15 * d;
    growth.hp += 3 * d;
  }
  for (const k of KEYS) {
    base[k] = Math.round(base[k]);
    growth[k] = round1(growth[k]);
  }
  return { base, growth };
}

/** Fusion stats: an even blend, plus one seeded mutation toward a stat a parent was strong in. */
export function fuseStats(a: ClassDef, b: ClassDef, seed: string): { base: Line; growth: Line; mutation: string } {
  const base = {} as Line;
  const growth = {} as Line;
  for (const k of KEYS) {
    base[k] = Math.round((a.base[k] + b.base[k]) / 2);
    growth[k] = round1((a.growth[k] + b.growth[k]) / 2);
  }
  const rng = seededRng(`fuse:${seed}`);
  const strong = [...STATS].sort((x, y) => Math.max(b.growth[y], a.growth[y]) - Math.max(b.growth[x], a.growth[x])).slice(0, 3);
  const stat = strong[Math.floor(rng() * strong.length)]!;
  growth[stat] = round1(growth[stat] * 1.25);
  base[stat] = Math.round(base[stat] * 1.15);
  return { base, growth, mutation: `Mutation: ${cap(stat)} is 15% higher and grows 25% faster.` };
}

/* ---------------------------- resources ------------------------------ */

const HYBRID: Record<string, Omit<ResourceDef, "id">> = {
  "resolve|tempo": { name: "Momentum", max: 6, start: 0, gain: [{ on: "deal_hit", n: 1 }, { on: "take_hit", n: 1 }], decay: 1 },
  "tempo|tide": { name: "Current", max: 6, start: 1, gain: [{ on: "deal_hit", n: 1 }, { on: "turn_start", n: 1 }], decay: 1 },
  "hex|tempo": { name: "Rhythm", max: 6, start: 0, gain: [{ on: "deal_hit", n: 1 }, { on: "apply_status", n: 1 }], decay: 1 },
  "resolve|tide": { name: "Swell", max: 6, start: 1, gain: [{ on: "take_hit", n: 1 }, { on: "turn_start", n: 1 }], decay: 1 },
  "hex|resolve": { name: "Grudge", max: 6, start: 0, gain: [{ on: "take_hit", n: 1 }, { on: "apply_status", n: 1 }] },
  "hex|tide": { name: "Foresight", max: 6, start: 1, gain: [{ on: "turn_start", n: 1 }, { on: "apply_status", n: 1 }], decay: 1 },
};

/** A fusion's resource: from the hybrid table, else one parent's with a twist from the other. */
export function fuseResource(a: ClassDef, b: ClassDef, seed: string): { resource?: ResourceDef; note: string } {
  const ra = a.resource;
  const rb = b.resource;
  if (!ra && !rb) return { note: "Neither parent has a class resource, so neither does the fusion." };
  if (ra && rb) {
    const key = [ra.id, rb.id].sort().join("|");
    const h = HYBRID[key];
    if (h) return { resource: { id: slugOf(h.name), ...structuredClone(h) }, note: `${ra.name} and ${rb.name} make ${h.name}.` };
    const rng = seededRng(`res:${seed}`);
    const [keep, twist] = rng() < 0.5 ? [ra, rb] : [rb, ra];
    const extra = twist.gain.find((g) => !keep.gain.some((k) => k.on === g.on));
    const res: ResourceDef = { ...structuredClone(keep), id: `${keep.id}_twisted`, name: `Twisted ${keep.name}`, max: keep.max + 1, gain: [...keep.gain.map((g) => ({ ...g })), ...(extra ? [{ on: extra.on, n: 1 }] : [])] };
    return { resource: res, note: `${keep.name} with a twist from ${twist.name}: it also fills ${extra ? `on ${extra.on.replace("_", " ")}` : "a little higher"}.` };
  }
  const only = (ra ?? rb)!;
  return { resource: structuredClone(only), note: `Keeps ${only.name}.` };
}

/* ---------------------------- fallbacks ------------------------------ */

const ELEMENT_WORD: Record<Element, string> = { physical: "Blade", fire: "Fire", frost: "Ice", storm: "Lightning", water: "Water", earth: "Stone", light: "Light", shadow: "Dark", blood: "Blood" };
const ELEMENT_STATUS: Record<Element, StatusId> = { physical: "vulnerable", fire: "burn", frost: "frost", storm: "stun", water: "slow", earth: "weaken", light: "mark", shadow: "fear", blood: "bleed" };

const mainElement = (c: ClassDef): Element => {
  for (const s of [c.attack, ...c.skills]) for (const a of flatAtoms(s.atoms)) if (a.op === "hit") return a.element;
  return "physical";
};

/** Three skills from the union of the parents' families, for when the Architect can't answer. */
export function fallbackFusionSkills(a: ClassDef, b: ClassDef, fam: Families): KitSkill[] {
  const ea = mainElement(a);
  const eb = fam.elements.has(mainElement(b)) ? mainElement(b) : ea;
  const st = [...fam.statuses].find((s) => !STATUS_RULES[s].good);
  const helper = fam.ops.has("shield") ? ("shield" as const) : fam.ops.has("heal") ? ("heal" as const) : null;
  const hit = (element: Element, hits = 1, weight = 1): Atom => ({ op: "hit", element, scale: "might", power: "auto", hits, weight });
  const s1: KitSkill = { name: ea === eb ? `${ELEMENT_WORD[ea]} Flurry` : `${ELEMENT_WORD[ea]} and ${ELEMENT_WORD[eb]}`, flavor: "Both teachers in one motion.", target: "enemy", tier: 2, signature: false, atoms: st ? [hit(ea, 2, 0.7), { op: "status", status: st, chance: "auto", turns: 2, weight: 0.3 }] : [hit(ea, 2)] };
  const s2: KitSkill = { name: `${ELEMENT_WORD[eb]} Wave`, flavor: "It reaches everyone.", target: "all_enemies", tier: 2, signature: false, atoms: fam.ops.has("delay") ? [hit(eb, 1, 0.75), { op: "delay", amount: "auto", weight: 0.25 }] : [hit(eb)] };
  const s3: KitSkill = {
    name: `${ELEMENT_WORD[ea]} Finisher`,
    flavor: "What neither could do alone.",
    target: "enemy",
    tier: 3,
    signature: true,
    atoms: helper ? [hit(ea, 1, 0.65), { op: helper, power: "auto", self: true, ...(helper === "shield" ? { turns: 2 } : {}), weight: 0.35 } as Atom] : [{ ...hit(ea, 1, 1), stagger: 2 } as Atom],
  };
  return [s1, s2, s3];
}

/* ------------------------------ forging ------------------------------ */

export interface ForgeDraft {
  name: string;
  identity: string;
  element: Element;
  lean: Lean;
  resource: { name: string; gain: TriggerEvent[]; max: number } | null;
  passive: PassiveDraft | null;
  skills: KitSkill[];
  brief: string;
  palette: string;
  /** What the Architect had to change from the request. */
  changes: string[];
  rig?: ClassDef["visual"]["rig"];
}

/** Total tiers a class may carry across its skills (the base classes carry 8). */
export const TIER_ROOM = 10;

/** Build a class from a draft. Notes say what code changed. */
export function classFromDraft(d: ForgeDraft, seed: string, notes: string[] = []): ClassDef {
  const id = `forged_${slugOf(d.name)}_${hashOf(seed)}`;
  const { base, growth } = statsFromLean(d.lean);
  const resource: ResourceDef | undefined = d.resource && d.resource.gain.length ? { id: `${id}_res`, name: d.resource.name, max: Math.max(3, Math.min(6, Math.round(d.resource.max))), start: 0, gain: [...new Set(d.resource.gain)].slice(0, 2).map((on) => ({ on, n: 1 })) } : undefined;
  let skills = d.skills.slice(0, 5);
  if (d.skills.length > 5) notes.push(`Kept 5 of ${d.skills.length} skills.`);
  // One signature at most, and a class's tiers fit in its room.
  let sig = false;
  for (const s of [...skills].sort((x, y) => y.tier - x.tier)) {
    if (s.signature && !sig) sig = true;
    else s.signature = false;
  }
  skills = skills.map((s) => ({ ...s, tier: s.signature ? Math.min(4, Math.max(3, s.tier)) : Math.min(3, s.tier) }));
  let room = skills.reduce((n, s) => n + s.tier, 0);
  while (room > TIER_ROOM) {
    const top = skills.filter((s) => !s.signature && s.tier > 1).sort((x, y) => y.tier - x.tier)[0];
    if (!top) break;
    top.tier--;
    room--;
    notes.push(`Lowered ${top.name} a tier to fit a class's budget.`);
  }
  const sized = skills.map((k, i) => sizedSkill(k, `${id}_${slugOf(k.name, "skill")}_${i}`, !!resource));
  const passive = d.passive ? sizedPassive(d.passive, `${id}_passive`) : null;
  return {
    id,
    name: d.name,
    base,
    growth,
    ...(resource ? { resource } : {}),
    passives: passive ? [passive] : [],
    skills: sized,
    attack: { id: `${id}_attack`, name: "Attack", target: "enemy", tier: 0, atoms: [{ op: "hit", element: d.element, scale: "might", power: "auto" }] },
    visual: { brief: d.brief || d.identity, palette: d.palette || "#2a2320,#c8a26a,#e9e2d4", rig: d.rig ?? "standing" },
  };
}

/** The base class closest to a description, renamed: the Forge with no model. */
export function fallbackForge(text: string, closest: ClassDef): ForgeDraft {
  // "A war-chef who fights with cleavers…" → "War-chef".
  const head = text.split(/[,.;:!?(]|\b(?:who|that|which|with|and|but|whose|wields?|uses?|fights?)\b/i)[0] ?? "";
  const words = head.replace(/[^A-Za-z' -]+/g, " ").trim().split(/\s+/).filter((w) => w.length > 1 && !/^(a|an|the|my|some|kind|of|sort|like)$/i.test(w));
  const name = words.slice(-2).map(cap).join(" ") || `New ${closest.name}`;
  const fam = familiesOf(closest);
  return {
    name: name.slice(0, 32),
    identity: text.slice(0, 140),
    element: mainElement(closest),
    lean: { high: [...STATS].sort((x, y) => closest.growth[y] - closest.growth[x]).slice(0, 2), low: null, hp: closest.base.hp >= 90 ? "high" : closest.base.hp <= 65 ? "low" : "mid" },
    resource: closest.resource ? { name: closest.resource.name, gain: closest.resource.gain.map((g) => g.on), max: closest.resource.max } : null,
    passive: closest.passives[0] ? { name: closest.passives[0].name, text: closest.passives[0].text, on: closest.passives[0].on, atoms: closest.passives[0].atoms.map((a) => structuredClone(a)) } : null,
    skills: closest.skills.map((s) => ({ name: s.name, flavor: s.flavor ?? "", target: s.target, tier: s.tier, signature: !!s.signature, atoms: autoAtoms(s.atoms) })),
    brief: closest.visual.brief,
    palette: closest.visual.palette,
    changes: [`Built from the ${closest.name}, the closest base class (${[...fam.elements].join(", ")}), because the Architect could not answer. Its skills keep their shapes.`],
    rig: closest.visual.rig,
  };
}

/** A copy of atoms with every magnitude left to the solver. */
export function autoAtoms(atoms: readonly Atom[]): Atom[] {
  return atoms.map((a): Atom => {
    switch (a.op) {
      case "hit":
      case "heal":
      case "shield": return { ...a, power: "auto" };
      case "status": return { ...a, chance: "auto" };
      case "cleanse": return { ...a, count: "auto" };
      case "delay":
      case "haste_self": return { ...a, amount: "auto" };
      case "gain": return { ...a, n: "auto" };
      case "drain": return { ...a, pct: "auto" };
      case "execute": return { ...a, below: "auto" };
      case "spend_all_for_power": return { ...a, perStack: "auto" };
      case "when":
      case "on_break":
      case "on_kill": return { ...a, then: autoAtoms(a.then) };
    }
  });
}

/* ------------------------------- fusion ------------------------------ */

export interface FusionDraft {
  name: string;
  identity: string;
  passive: PassiveDraft | null;
  skills: KitSkill[];
  brief: string;
  palette: string;
}

/** The two skills a parent passes on: its strongest, combo skills aside. */
export function inherited(c: ClassDef): SkillDef[] {
  return c.skills.filter((s) => !s.id.startsWith("combo_")).sort((x, y) => y.tier - x.tier || (y.signature ? 1 : 0) - (x.signature ? 1 : 0)).slice(0, 2);
}

/** Fuse two classes. The draft supplies names and three new skills; code does the rest. */
export function fuseClasses(a: ClassDef, b: ClassDef, draft: FusionDraft | null, seed: string): { def: ClassDef; changes: string[] } {
  const changes: string[] = [];
  const fam = familiesOf(a, b);
  const { base, growth, mutation } = fuseStats(a, b, seed);
  changes.push(mutation);
  const res = fuseResource(a, b, seed);
  changes.push(res.note);
  const id = `fused_${slugOf(draft?.name || `${a.name} ${b.name}`)}_${hashOf(seed)}`;
  // New skills only from the union of the parents' atom families.
  let fresh: KitSkill[] = [];
  for (const k of draft?.skills ?? []) {
    const atoms = restrictAtoms(k.atoms, fam, changes, k.name);
    if (atoms.length) fresh.push({ ...k, atoms });
    else changes.push(`${k.name} was dropped: nothing in it came from the parents.`);
  }
  if (!draft) changes.push("The Architect could not answer, so the new skills are built from the parents' elements and statuses.");
  // Code-built skills hit with whichever of might and spirit the fusion is better at.
  const scale = base.spirit + growth.spirit * 4 > base.might + growth.might * 4 ? "spirit" : "might";
  const fb = fallbackFusionSkills(a, b, fam).map((k) => ({ ...k, atoms: k.atoms.map((x) => (x.op === "hit" ? { ...x, scale } : x)) as Atom[] }));
  while (fresh.length < 3) fresh.push(fb[fresh.length]!);
  fresh = fresh.slice(0, 3);
  // One signature among the new skills.
  let sig = false;
  for (const s of [...fresh].sort((x, y) => y.tier - x.tier)) {
    if (s.signature && !sig) sig = true;
    else s.signature = false;
  }
  if (!sig) fresh.sort((x, y) => y.tier - x.tier)[0]!.signature = true;
  const kept = [...inherited(a), ...inherited(b)].map((s, i): SkillDef => {
    const k = solveSkill({ ...structuredClone(s), id: `${id}_k${i}`, signature: false });
    // A skill paid in a resource the fusion lacks is paid in Focus instead.
    if (k.cost?.resource && !res.resource) k.cost = { focus: TIER_FOCUS[k.tier] ?? 10, cooldown: k.cost.cooldown ?? 2 };
    return k;
  });
  const made = fresh.map((k, i) => sizedSkill({ ...k, tier: k.signature ? Math.min(4, Math.max(3, k.tier)) : Math.min(3, k.tier) }, `${id}_${slugOf(k.name, "skill")}_${i}`, !!res.resource));
  let passive: PassiveDef | null = null;
  if (draft?.passive) {
    const atoms = restrictAtoms(draft.passive.atoms, fam, changes, draft.passive.name);
    passive = sizedPassive({ ...draft.passive, atoms }, `${id}_passive`);
  }
  const passives = passive ? [passive] : [...a.passives, ...b.passives].slice(0, 1).map((p) => ({ ...p, id: `${id}_${p.id}` }));
  const pa = a.visual.palette.split(",");
  const pb = b.visual.palette.split(",");
  return {
    def: {
      id,
      name: draft?.name || `${a.name}-${b.name}`,
      base,
      growth,
      ...(res.resource ? { resource: res.resource } : {}),
      passives,
      skills: [...kept, ...made],
      attack: { ...structuredClone(a.attack), id: `${id}_attack` },
      visual: { brief: draft?.brief || `${a.visual.brief}; ${b.visual.brief}`, palette: draft?.palette || [pa[0], pb[1] ?? pa[1], pa[2] ?? pb[2]].filter(Boolean).join(","), rig: a.visual.rig ?? "standing" },
    },
    changes,
  };
}

/* ----------------------------- awakening ----------------------------- */

const STATUS_FOR_SKILL = (s: SkillDef): StatusId => {
  const el = flatAtoms(s.atoms).find((a): a is Extract<Atom, { op: "hit" }> => a.op === "hit")?.element ?? "physical";
  return ELEMENT_STATUS[el];
};

/** The awakened shape of a skill: a tier up (at most 4), a new cut-in, and the change. */
export function awakenedSkill(s: SkillDef, atoms: Atom[], name: string, target: TargetRule = s.target, flavor?: string): SkillDef {
  const cut = CUTINS[(CUTINS.indexOf(s.visual?.cutin ?? "diagonal_band") + 1) % CUTINS.length]!;
  return solveSkill({
    ...structuredClone(s),
    id: `${s.id}_aw`,
    name,
    ...(flavor ? { flavor } : {}),
    target,
    tier: Math.min(4, s.tier + 1),
    atoms: autoAtoms(atoms),
    visual: { ...(s.visual ?? {}), cutin: cut, fx: [...(s.visual?.fx ?? []), "impact_frame"] },
    solved: false,
  });
}

/** Three mutations built from atoms, for when the Architect can't answer. */
export function fallbackAwakenings(s: SkillDef): SkillDef[] {
  const out: SkillDef[] = [];
  const atoms = s.atoms.map((a) => structuredClone(a));
  const hitAt = atoms.findIndex((a) => a.op === "hit");
  if (hitAt >= 0) {
    const twin = atoms.map((a, i) => (i === hitAt && a.op === "hit" ? { ...a, hits: (a.hits ?? 1) + 1 } : a));
    out.push(awakenedSkill(s, twin, `${s.name}: Twice`, s.target, "It lands, and then it lands again."));
  }
  const st = STATUS_FOR_SKILL(s);
  if (s.target.includes("enemy") && !flatAtoms(atoms).some((a) => a.op === "status" && a.status === st)) {
    out.push(awakenedSkill(s, [...atoms.map((a) => ({ ...a, weight: 0.7 }) as Atom), { op: "status", status: st, chance: "auto", turns: 2, weight: 0.3 }], `${s.name}: ${STATUS_RULES[st].name}`, s.target, `Now it leaves ${STATUS_RULES[st].name.toLowerCase()} behind.`));
  }
  if (s.target === "enemy") out.push(awakenedSkill(s, atoms, `${s.name}: Wide`, "all_enemies", "It reaches everyone in front of you."));
  if (s.target === "ally" || s.target === "lowest_hp_ally") out.push(awakenedSkill(s, atoms, `${s.name}: Wide`, "all_allies", "It reaches the whole party."));
  if (s.target.includes("enemy")) out.push(awakenedSkill(s, [...atoms.map((a) => ({ ...a, weight: 0.8 }) as Atom), { op: "on_kill", then: [{ op: "gain", resource: "focus", n: "auto" }], weight: 0.2 }], `${s.name}: Payoff`, s.target, "A finished foe gives something back."));
  if (out.length < 3) out.push(awakenedSkill(s, [...atoms.map((a) => ({ ...a, weight: 0.8 }) as Atom), { op: "haste_self", amount: "auto", weight: 0.2 }], `${s.name}: Quick`, s.target, "Done before they notice."));
  if (out.length < 3) out.push(awakenedSkill(s, [...atoms.map((a) => ({ ...a, weight: 0.8 }) as Atom), { op: "shield", power: "auto", self: true, turns: 2, weight: 0.2 }], `${s.name}: Guard`, s.target, "It guards you as it works."));
  return out.slice(0, 3);
}

/* ----------------------------- test fights ----------------------------- */

export interface SimLine {
  wins: number;
  runs: number;
  hpLeft: number;
}

function simParty(classes: ClassDef[], encounterId: string, runs: number, level = 5): SimLine {
  const enc = ENCOUNTERS[encounterId]!;
  let wins = 0;
  let hp = 0;
  for (let i = 0; i < runs; i++) {
    const start = createBattle({ id: `sim:${encounterId}:${i}`, seed: `forge-sim-${encounterId}-${i}`, party: classes.map((classDef) => ({ classDef, level })), enemies: enc.enemies.map((id) => ({ def: MONSTERS[id]! })) });
    const { state } = advance(advance(start, { enemyPolicy: chooseAction }).state, { enemyPolicy: chooseAction, partyPolicy: chooseAction });
    const party = state.combatants.filter((c) => c.side === "party");
    if (state.outcome === "victory") {
      wins++;
      hp += party.reduce((n, c) => n + c.hp / c.maxHp, 0) / party.length;
    }
  }
  return { wins, runs, hpLeft: wins ? hp / wins : 0 };
}

const SIM_FIGHTS = ["salt_choir", "drowned_shrine"] as const;
const score = (s: SimLine): number => (s.wins / s.runs) * 0.6 + s.hpLeft * 0.4;

let baseline: { line: SimLine; score: number } | null = null;
function baselineSim(runs: number): { line: SimLine; score: number } {
  if (baseline && baseline.line.runs === runs * SIM_FIGHTS.length) return baseline;
  const lines = SIM_FIGHTS.map((e) => simParty([CLASSES.duelist!, CLASSES.warden!, CLASSES.tidecaller!], e, runs));
  const line = { wins: lines.reduce((n, l) => n + l.wins, 0), runs: runs * SIM_FIGHTS.length, hpLeft: lines.reduce((n, l) => n + l.hpLeft, 0) / lines.length };
  baseline = { line, score: score(line) };
  return baseline;
}

/**
 * Test a new class in sim fights beside a Warden and a Tidecaller, against
 * the same fights with a Duelist in its place. Too strong: its skills drop
 * a tier (twice at most), then its stats shrink. Too weak: its skills rise
 * a tier (twice at most). Never back and forth. Returns the class as it
 * will be, and one line.
 */
export function balance(def: ClassDef, notes: string[], runs = 12): { def: ClassDef; sim: string } {
  const base = baselineSim(runs);
  let cls = def;
  let line: SimLine = { wins: 0, runs: 0, hpLeft: 0 };
  let down = 0;
  let cuts = 0;
  let up = 0;
  const retier = (c: ClassDef, d: number): ClassDef => ({
    ...c,
    skills: c.skills.map((s) => {
      const tier = Math.max(1, Math.min(s.signature ? 4 : 3, s.tier + d));
      return tier === s.tier ? s : solveSkill({ ...s, atoms: autoAtoms(s.atoms), tier, solved: false });
    }),
  });
  const shrink = (c: ClassDef, f: number): ClassDef => {
    const scale = (b: ClassDef["base"]) => ({ ...b, hp: Math.round(b.hp * f), might: Math.round(b.might * f), spirit: Math.round(b.spirit * f), guard: Math.round(b.guard * f), will: Math.round(b.will * f) });
    return { ...c, base: scale(c.base), growth: { ...c.growth, hp: round1(c.growth.hp * f), might: round1(c.growth.might * f), spirit: round1(c.growth.spirit * f), guard: round1(c.growth.guard * f), will: round1(c.growth.will * f) } };
  };
  for (let pass = 0; pass < 6; pass++) {
    const lines = SIM_FIGHTS.map((e) => simParty([cls, CLASSES.warden!, CLASSES.tidecaller!], e, runs));
    line = { wins: lines.reduce((n, l) => n + l.wins, 0), runs: runs * SIM_FIGHTS.length, hpLeft: lines.reduce((n, l) => n + l.hpLeft, 0) / lines.length };
    const gap = score(line) - base.score;
    if (pass === 5) break;
    if (gap > 0.15 && !up) {
      if (down < 2 && cls.skills.some((s) => s.tier > 1)) {
        cls = retier(cls, -1);
        down++;
      } else {
        cls = shrink(cls, 0.88);
        cuts++;
      }
    } else if (gap < -0.15 && !down && !cuts && up < 2) {
      cls = retier(cls, 1);
      up++;
    } else break;
  }
  if (down) notes.push(`The test fights found it too strong, so its skills dropped ${down === 1 ? "a tier" : `${down} tiers`}.`);
  if (cuts) notes.push(`It was still too strong, so its health and power shrank ${Math.round((1 - 0.88 ** cuts) * 100)}%.`);
  if (up) notes.push(`The test fights found it weak, so its skills rose ${up === 1 ? "a tier" : `${up} tiers`}.`);
  if (score(line) < base.score - 0.25) notes.push("It still tests weaker than a base class: it may need friends.");
  const pct = (l: SimLine) => `${Math.round((l.wins / l.runs) * 100)}%`;
  return { def: cls, sim: `Test fights: won ${pct(line)} with ${Math.round(line.hpLeft * 100)}% HP left (a Duelist in its place: ${pct(base.line)}, ${Math.round(base.line.hpLeft * 100)}%).` };
}

/* ------------------------------ the sheet ----------------------------- */

const TARGET_WORD: Record<TargetRule, string> = { self: "self", ally: "one ally", all_allies: "all allies", lowest_hp_ally: "the most hurt ally", enemy: "one enemy", all_enemies: "all enemies", random_enemies: "random enemies" };

export function describeAtom(a: Atom): string {
  switch (a.op) {
    case "hit": return `${a.element} hit, power ${a.power}${(a.hits ?? 1) > 1 ? ` ×${a.hits}` : ""}${a.pierce ? `, pierces ${Math.round(a.pierce * 100)}%` : ""}${a.stagger ? `, stagger ${a.stagger}` : ""}`;
    case "heal": return `heal ${a.power}${a.self ? " (self)" : ""}`;
    case "shield": return `shield ${a.power} for ${a.turns ?? 2} turns${a.self ? " (self)" : ""}`;
    case "status": return `${STATUS_RULES[a.status].name} ${a.chance}%${typeof a.stacks === "number" && a.stacks > 1 ? ` ×${a.stacks}` : ""}${a.turns ? `, ${a.turns} turns` : ""}${a.self ? " (self)" : ""}`;
    case "cleanse": return `cleanse ${a.count}${a.self ? " (self)" : ""}`;
    case "delay": return `push their turn back ${a.amount}`;
    case "haste_self": return `your next turn ${a.amount} sooner`;
    case "gain": return `gain ${a.n} ${a.resource === "class" ? "class resource" : "Focus"}`;
    case "drain": return `drain ${a.pct}% of damage`;
    case "execute": return `finishes foes below ${a.below}% HP`;
    case "spend_all_for_power": return `spends all resource, +${a.perStack} power each`;
    case "when": return `if ${a.if.kind.replace(/_/g, " ")}: ${a.then.map(describeAtom).join("; ")}`;
    case "on_break": return `on Break: ${a.then.map(describeAtom).join("; ")}`;
    case "on_kill": return `on a kill: ${a.then.map(describeAtom).join("; ")}`;
  }
}

export interface SheetSkill {
  id: string;
  name: string;
  flavor: string;
  target: string;
  tier: number;
  cost: string;
  signature: boolean;
  lines: string[];
}

export interface ClassSheet {
  id: string;
  name: string;
  level: number;
  stats: { key: string; value: number }[];
  resource: string | null;
  passives: string[];
  attack: string;
  skills: SheetSkill[];
  brief: string;
}

export function skillSheet(s: SkillDef): SheetSkill {
  const c = s.cost ?? {};
  const cost = [typeof c.focus === "number" && c.focus ? `${c.focus} Focus` : "", c.resource ? `${c.resource} resource` : "", c.hpPct ? `${c.hpPct}% HP` : "", c.cooldown ? `cooldown ${c.cooldown}` : ""].filter(Boolean).join(", ") || "free";
  return { id: s.id, name: s.name, flavor: s.flavor ?? "", target: TARGET_WORD[s.target], tier: s.tier, cost, signature: !!s.signature, lines: s.atoms.map(describeAtom) };
}

/** A class with its real numbers at a level, for the preview before you confirm. */
export function classSheet(cls: ClassDef, level = 5): ClassSheet {
  const st = statsAt(cls, level);
  const solved = (s: SkillDef): SkillDef => (s.solved ? s : solveSkill(s));
  const r = cls.resource;
  return {
    id: cls.id,
    name: cls.name,
    level,
    stats: (["hp", "focus", ...STATS] as const).map((k) => ({ key: k, value: st[k] })),
    resource: r ? `${r.name} (max ${r.max}): fills ${r.gain.map((g) => `+${g.n} on ${g.on.replace(/_/g, " ")}`).join(", ")}${r.decay ? `, loses ${r.decay} each turn` : ""}` : null,
    passives: cls.passives.map((p) => `${p.name}: ${p.text} (${p.chance ?? 100}% on ${p.on.replace(/_/g, " ")}: ${p.atoms.map(describeAtom).join("; ")})`),
    attack: describeAtom(solved(cls.attack).atoms[0]!),
    skills: cls.skills.map((s) => skillSheet(solved(s))),
    brief: cls.visual.brief,
  };
}

/* ------------------------------- codex -------------------------------- */

export interface CodexEntry {
  id: string;
  name: string;
  origin: "forged" | "fused";
  parents?: [string, string];
  identity?: string;
  /** Card name the class was made on. */
  card: string;
  def: ClassDef;
  art?: string;
  at: number;
}

export interface Codex {
  v: 1;
  entries: CodexEntry[];
}

export const CODEX_MAX = 200;

export function addToCodex(codex: Codex, e: CodexEntry): Codex {
  const entries = [e, ...codex.entries.filter((x) => x.id !== e.id)].slice(0, CODEX_MAX);
  return { v: 1, entries };
}

/** A codex class brought into a new campaign: rank 1 again. */
export function fromCodex(e: CodexEntry, now = Date.now()): OwnedClass {
  return { def: structuredClone(e.def), origin: "codex", wins: 0, ...(e.parents ? { parents: e.parents } : {}), ...(e.identity ? { identity: e.identity } : {}), ...(e.art ? { art: e.art } : {}), at: now };
}
