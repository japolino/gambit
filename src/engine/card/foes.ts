/**
 * Encounters from the card (docs/DESIGN.md 4.0, 4.2, M4). The card names
 * the enemies and their style; code sets every number. A foe is a role,
 * a tier, an element and a few words; `monsterFromFoe` turns it into an
 * engine MonsterDef from role archetypes and the budget solver, the same
 * effect language the hand-written bestiary uses.
 */
import { CLASSES } from "../content/classes.js";
import type { Affinities, Atom, ClassDef, Element, MonsterDef, RigKind, SkillDef, StatBlock, StatusId } from "../types.js";
import { ELEMENTS } from "../types.js";
import type { CardSheet, CastMember, Evidence, FigurePerson, Tier } from "./types.js";

export type FoeRole = "brute" | "assassin" | "caster" | "support" | "boss";
export const FOE_ROLES: readonly FoeRole[] = ["brute", "assassin", "caster", "support", "boss"];
export const RIGS: readonly RigKind[] = ["standing", "floating", "serpentine", "huge"];

/** One kind of enemy the card has, as the reader proposed it. */
export interface SheetFoe {
  id: string;
  name: string;
  /** Visual description for its art. */
  look: string;
  role: FoeRole;
  tier: Tier;
  element: Element;
  weakTo: Element[];
  resists: Element[];
  rig: RigKind;
  /** Can be talked to in combat (people, not mindless things). */
  talks: boolean;
  /** Named signature move, from the card's words. */
  signature?: string;
  /** What it becomes in a second phase (bosses only). */
  phase2?: string;
  /** Cast member this foe is, when the fight is with someone on the sheet. */
  castId?: string;
  evidence: Evidence;
}

const LEVEL = 5;
const TIER_SCALE = [0.6, 0.8, 1, 1.25, 1.55] as const;

interface Archetype {
  hp: number;
  focus: number;
  stats: StatBlock;
  poise: number;
  morale: number;
  ai: MonsterDef["ai"];
}

/** Level-5, tier-2 profiles, matched to the hand-tuned Saltgate bestiary. */
const ARCHETYPES: Record<FoeRole, Archetype> = {
  brute: { hp: 225, focus: 0, stats: { might: 30, spirit: 5, guard: 14, will: 8, speed: 11, luck: 4 }, poise: 4, morale: 40, ai: "brute" },
  assassin: { hp: 150, focus: 0, stats: { might: 29, spirit: 7, guard: 9, will: 7, speed: 20, luck: 12 }, poise: 3, morale: 50, ai: "assassin" },
  caster: { hp: 130, focus: 30, stats: { might: 7, spirit: 25, guard: 7, will: 16, speed: 15, luck: 8 }, poise: 3, morale: 60, ai: "caster" },
  support: { hp: 140, focus: 30, stats: { might: 10, spirit: 20, guard: 10, will: 14, speed: 14, luck: 10 }, poise: 3, morale: 55, ai: "support" },
  boss: { hp: 620, focus: 40, stats: { might: 31, spirit: 27, guard: 16, will: 17, speed: 13, luck: 10 }, poise: 8, morale: 80, ai: "boss" },
};

/** The status each element tends to carry. */
const ELEMENT_STATUS: Record<Element, StatusId> = {
  physical: "weaken", fire: "burn", frost: "frost", storm: "stun", water: "slow",
  earth: "guarded", light: "vulnerable", shadow: "fear", blood: "bleed",
};

const slug = (s: string): string => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "foe";
const isElement = (v: unknown): v is Element => typeof v === "string" && (ELEMENTS as readonly string[]).includes(v);

function scaleStats(s: StatBlock, k: number): StatBlock {
  return { might: Math.round(s.might * k), spirit: Math.round(s.spirit * k), guard: Math.round(s.guard * k), will: Math.round(s.will * k), speed: Math.round(s.speed * Math.sqrt(k)), luck: Math.round(s.luck * k) };
}

function affinitiesOf(foe: SheetFoe): Affinities {
  const a: Affinities = {};
  for (const e of foe.resists) if (isElement(e)) a[e] = 0.5;
  for (const e of foe.weakTo) if (isElement(e)) a[e] = 2;
  // A foe never resists its own weakness, and its element is never its weakness.
  if (a[foe.element] === 2) delete a[foe.element];
  return a;
}

function skillsFor(foe: SheetFoe, id: string, scale: "might" | "spirit"): { attack: SkillDef; skills: SkillDef[] } {
  const el = foe.element;
  const st = ELEMENT_STATUS[el];
  const hit = (weight?: number, extra: Partial<Extract<Atom, { op: "hit" }>> = {}): Atom => ({ op: "hit", element: el, scale, power: "auto", ...(weight ? { weight } : {}), ...extra });
  const statusOf = (weight: number, status: StatusId = st): Atom =>
    status === "guarded" ? { op: "status", status, chance: "auto", self: true, turns: 2, weight } : { op: "status", status, chance: "auto", weight };
  const attack: SkillDef = { id: `${id}_atk`, name: "Strike", target: "enemy", tier: 0, atoms: [hit(undefined, el === "physical" ? {} : {})] };
  const sig = foe.signature?.trim() || "";
  const skills: SkillDef[] = [];
  switch (foe.role) {
    case "brute":
      skills.push({ id: `${id}_heavy`, name: sig || "Crushing Blow", target: "enemy", tier: 1, cost: { cooldown: 2 }, atoms: [hit(0.75, { stagger: 2 }), statusOf(0.25)] });
      break;
    case "assassin":
      skills.push({ id: `${id}_rend`, name: sig || "Rend", target: "enemy", tier: 1, cost: { cooldown: 1 }, atoms: [hit(0.55), { op: "status", status: el === "physical" ? "bleed" : st, stacks: 2, chance: "auto", weight: 0.45 }] });
      skills.push({ id: `${id}_mark`, name: "Mark the Weak", target: "enemy", tier: 1, cost: { cooldown: 3 }, atoms: [{ op: "status", status: "mark", chance: "auto" }] });
      break;
    case "caster":
      skills.push({ id: `${id}_wave`, name: sig || "Surge", target: "all_enemies", tier: 2, cost: { cooldown: 3 }, atoms: [hit(0.5), statusOf(0.5)] });
      skills.push({ id: `${id}_hex`, name: "Hex", target: "enemy", tier: 1, cost: { cooldown: 1 }, atoms: [{ op: "status", status: "weaken", chance: "auto" }] });
      break;
    case "support":
      skills.push({ id: `${id}_mend`, name: sig || "Mend", target: "lowest_hp_ally", tier: 1, cost: { cooldown: 2 }, atoms: [{ op: "heal", power: "auto" }] });
      skills.push({ id: `${id}_ward`, name: "Ward", target: "all_allies", tier: 2, cost: { cooldown: 4 }, atoms: [{ op: "shield", power: "auto", turns: 2 }] });
      break;
    case "boss":
      skills.push({ id: `${id}_sweep`, name: "Sweep", target: "all_enemies", tier: 2, cost: { cooldown: 2 }, atoms: [hit(0.7, { stagger: 1 }), statusOf(0.3)] });
      skills.push({ id: `${id}_sig`, name: sig || "Ruin", target: "enemy", tier: 4, signature: true, cost: { cooldown: 4 }, atoms: [hit(0.8, { stagger: 3 }), { op: "execute", below: "auto", weight: 0.2 }] });
      break;
  }
  return { attack, skills };
}

/** The engine monster for a foe, at a level (default 5). Pure and deterministic. */
export function monsterFromFoe(foe: SheetFoe, level = LEVEL): MonsterDef {
  const a = ARCHETYPES[foe.role];
  const k = TIER_SCALE[foe.tier] * (1 + 0.12 * (level - LEVEL));
  const id = `foe_${slug(foe.id || foe.name)}`;
  const scale: "might" | "spirit" = foe.role === "caster" || foe.role === "support" || (foe.role === "boss" && foe.element !== "physical") ? "spirit" : "might";
  const { attack, skills } = skillsFor(foe, id, scale);
  const def: MonsterDef = {
    id,
    name: foe.name,
    level,
    hp: Math.round((a.hp * k) / 5) * 5,
    focus: a.focus,
    stats: scaleStats(a.stats, k),
    affinities: affinitiesOf(foe),
    poise: Math.max(2, Math.round(a.poise * Math.sqrt(k))),
    ai: a.ai,
    talks: foe.talks,
    morale: a.morale,
    attack,
    skills,
    visual: { brief: foe.look || foe.name, palette: "", rig: foe.rig },
  };
  if (foe.role === "boss") {
    const into: Omit<MonsterDef, "phase2"> = {
      ...def,
      id: `${id}_p2`,
      name: foe.phase2?.trim() ? `${foe.name}, ${foe.phase2.trim()}` : `${foe.name}, Unbound`,
      hp: Math.round((def.hp * 0.6) / 5) * 5,
      stats: scaleStats(def.stats, 1.15),
      poise: def.poise + 2,
      morale: 100,
      attack: { ...attack, id: `${id}_p2_atk` },
      skills: skills.map((s) => ({ ...s, id: `${s.id}_p2`, tier: Math.min(5, s.tier + 1) })),
      visual: { ...def.visual, brief: `${foe.look || foe.name}, ${foe.phase2?.trim() || "transformed, unleashed, wreathed in power"}` },
    };
    def.phase2 = { atHpPct: 50, into };
  }
  return def;
}

/** A foe for a fight with someone on the sheet ("Fight the rival?"): their stance sizes them. */
export function foeFromCast(m: CastMember, skinFight = "fight"): SheetFoe {
  const t = m.temperament;
  const tier = Math.max(1, Math.min(4, Math.round((t.pride + m.insight + (4 - t.fear)) / 3))) as Tier;
  const role: FoeRole = m.insight >= 3 && t.pride < 3 ? "caster" : t.fear >= 3 ? "assassin" : "brute";
  return {
    id: `cast_${m.id}`,
    name: m.name,
    look: m.look,
    role: m.main && tier >= 3 ? "boss" : role,
    tier,
    element: "physical",
    weakTo: [],
    resists: [],
    rig: "standing",
    talks: true,
    castId: m.id,
    evidence: { source: "gambit", quote: `${m.name} in a ${skinFight}`, verified: false },
  };
}

export interface CardEncounter {
  id: string;
  name: string;
  foes: { foe: SheetFoe; def: MonsterDef }[];
  boss: boolean;
}

/** A seeded pick from a list. */
function pick<T>(list: readonly T[], seed: number, i: number): T {
  return list[Math.abs((seed + i * 2654435761) | 0) % list.length]!;
}

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/**
 * An encounter from the card's foes: one lead and up to two others, or a
 * boss with one escort. `lead` forces a foe (a chip that named it).
 */
export function encounterFrom(foes: readonly SheetFoe[], opts: { seed: string; boss?: boolean; lead?: string; level?: number; name?: string; party?: number; kin?: boolean }): CardEncounter | null {
  if (!foes.length) return null;
  const h = hash(opts.seed);
  const bosses = foes.filter((f) => f.role === "boss");
  const rank = foes.filter((f) => f.role !== "boss");
  const forced = opts.lead ? foes.find((f) => f.id === opts.lead || f.castId === opts.lead) : undefined;
  const lead = forced ?? (opts.boss && bosses.length ? pick(bosses, h, 0) : rank.length ? pick(rank, h, 1) : foes[0]!);
  const boss = lead.role === "boss";
  // `kin`: the player went for this foe by name, so what's with it is more of the same, not a stranger off the card's list. Someone from the card comes alone.
  const pool = opts.kin ? [] : rank.filter((f) => f.id !== lead.id && !f.castId);
  const escorts: SheetFoe[] = [];
  // Someone alone with no one at their side doesn't face a squad.
  const count = opts.party === 1 ? (!boss && lead.tier <= 1 ? 1 : 0) : boss ? 1 : lead.tier >= 3 ? 1 : 2;
  for (let i = 0; i < count; i++) {
    const f = pool.length ? pick(pool, h, i + 2) : lead.castId ? null : lead;
    if (f) escorts.push(f.tier > 1 && !boss ? { ...f, tier: (f.tier - 1) as Tier } : f);
  }
  const level = opts.level ?? LEVEL;
  const list = [lead, ...escorts].map((foe) => ({ foe, def: monsterFromFoe(foe, level) }));
  return { id: `enc_${slug(lead.id)}_${h.toString(36).slice(0, 5)}`, name: opts.name ?? (boss || (opts.kin && !escorts.length) ? lead.name : `${lead.name} and company`), foes: list, boss };
}

/* ------------------------------- party -------------------------------- */

/** Words that point a description at a base class (the fallback kit, 4.4). */
const CLASS_WORDS: Record<string, string[]> = {
  duelist: ["sword", "blade", "fencer", "duel", "rapier", "knife", "assassin", "rogue", "thief", "quick", "agile", "dagger", "gun", "shoot"],
  warden: ["shield", "guard", "knight", "soldier", "armor", "armour", "protect", "tank", "bodyguard", "strong", "big", "brute"],
  tidecaller: ["heal", "healer", "priest", "nurse", "doctor", "song", "sing", "water", "sea", "tide", "kind", "gentle", "medic"],
  hexwright: ["magic", "mage", "witch", "spell", "curse", "hex", "occult", "demon", "sorcer", "wizard", "dark", "arcane", "scholar", "book"],
};

/** The base class whose words best fit a description; stable for ties. */
export function baseClassFor(text: string, avoid: ReadonlySet<string> = new Set()): ClassDef {
  const t = text.toLowerCase();
  let best = "duelist";
  let score = -1;
  for (const id of Object.keys(CLASS_WORDS)) {
    if (!CLASSES[id]) continue;
    const s = CLASS_WORDS[id]!.reduce((n, w) => n + (t.includes(w) ? 1 : 0), 0) - (avoid.has(id) ? 0.5 : 0);
    if (s > score) {
      score = s;
      best = id;
    }
  }
  return CLASSES[best]!;
}

export interface PartySlot {
  id: string;
  name: string;
  classDef: ClassDef;
  /** Cast id for a companion; absent for the player. */
  castId?: string;
}

/**
 * The party for this card: the player, then up to two companions from the
 * card's own characters (4.6). Kits come from base classes picked by their
 * descriptions; a varied party is preferred when descriptions tie.
 */
export function partyFromSheet(sheet: Pick<CardSheet, "player" | "cast">, opts: { companions?: number; exclude?: string } = {}): PartySlot[] {
  const used = new Set<string>();
  const slots: PartySlot[] = [];
  const me = baseClassFor(sheet.player.concept, used);
  used.add(me.id);
  // A name reads in the fight log ("Hero takes 17"), which "You" can't.
  slots.push({ id: "p_player", name: sheet.player.name || "Hero", classDef: me });
  const companions = sheet.cast.filter((c) => c.main && c.id !== opts.exclude).slice(0, opts.companions ?? 2);
  for (const c of companions) {
    const cls = baseClassFor(`${c.role} ${c.look} ${c.voice}`, used);
    used.add(cls.id);
    slots.push({ id: `p_${c.id}`, name: c.name, classDef: cls, castId: c.id });
  }
  return slots;
}

/** The player as their figure is drawn: the persona, else what the card says the player is. */
export function playerPerson(sheet: Pick<CardSheet, "player">): FigurePerson {
  const p = sheet.player;
  return { id: "p_player", name: p.name || "the player", role: p.concept, look: p.look ?? "", pronoun: p.pronoun ?? "they" };
}

/* ------------------------------ validation ---------------------------- */

const tierOf = (v: unknown): Tier => {
  const n = Math.round(Number(v));
  return (Number.isFinite(n) ? Math.max(0, Math.min(4, n)) : 2) as Tier;
};
const str = (v: unknown, max = 200): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const elements = (v: unknown): Element[] => (Array.isArray(v) ? v.map((e) => str(e).toLowerCase()).filter(isElement) : []);

/** A foe from model JSON, or null when it is unusable. Every number is clamped. */
export function parseFoe(v: unknown, i: number): SheetFoe | null {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const name = str(o.name, 60);
  if (!name) return null;
  const role = (FOE_ROLES as readonly string[]).includes(str(o.role)) ? (str(o.role) as FoeRole) : "brute";
  const element = isElement(str(o.element).toLowerCase()) ? (str(o.element).toLowerCase() as Element) : "physical";
  const rig = (RIGS as readonly string[]).includes(str(o.rig)) ? (str(o.rig) as RigKind) : "standing";
  const foe: SheetFoe = {
    id: slug(str(o.id) || name) + (i ? "" : ""),
    name,
    look: str(o.look, 300),
    role,
    tier: tierOf(o.tier),
    element,
    weakTo: elements(o.weakTo).filter((e) => e !== element).slice(0, 2),
    resists: elements(o.resists).slice(0, 2),
    rig,
    talks: o.talks !== false,
    evidence: { source: "card", quote: str(o.quote, 300), verified: false },
  };
  const sig = str(o.signature, 40);
  if (sig) foe.signature = sig;
  const p2 = str(o.phase2, 120);
  if (role === "boss" && p2) foe.phase2 = p2;
  return foe;
}

/** Foes the genre implies when the card names none (the fallback, never empty). */
export function fallbackFoes(genre: string): SheetFoe[] {
  const g = genre.toLowerCase();
  const ev: Evidence = { source: "gambit", quote: "", verified: false };
  const f = (id: string, name: string, look: string, role: FoeRole, tier: Tier, element: Element, rig: RigKind = "standing", talks = true): SheetFoe => ({ id, name, look, role, tier, element, weakTo: [], resists: [], rig, talks, evidence: ev });
  if (/sci|space|cyber|future|mech|robot/.test(g)) {
    return [f("security_drone", "Security Drone", "hovering armored security drone with a red sensor eye", "assassin", 1, "storm", "floating", false), f("enforcer", "Corporate Enforcer", "armored enforcer with a shock baton and a mirrored visor", "brute", 2, "physical"), f("netrunner", "Rogue Netrunner", "hacker in a hooded jacket with glowing cables", "caster", 2, "storm")];
  }
  if (/horror|ghost|haunt|occult/.test(g)) {
    return [f("shade", "Hungry Shade", "a smear of shadow with too many hands", "caster", 2, "shadow", "floating", false), f("thing", "The Thing in the Walls", "a pale long-limbed creature crawling out of the plaster", "assassin", 2, "blood", "standing", false)];
  }
  if (/modern|slice|school|romance|office|contemporary|drama/.test(g)) {
    return [f("thug", "Street Thug", "a thug in a hoodie with a bat", "brute", 1, "physical"), f("rival", "Rival", "a sharp-dressed rival with a smug smile", "assassin", 2, "physical")];
  }
  return [f("bandit", "Bandit", "a ragged bandit with a notched blade", "assassin", 1, "physical"), f("brute", "Hired Brute", "a hulking mercenary with a maul", "brute", 2, "physical"), f("hedge_witch", "Hedge Witch", "a cloaked hedge witch with a bone charm", "caster", 2, "shadow")];
}
