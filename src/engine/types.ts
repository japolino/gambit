/**
 * Core data model of the Gambit engine. Pure data: no host imports, no DOM.
 * The engine runs the same in the backend, the frontend, tests and the
 * balance simulator (docs/DESIGN.md, 4.2-4.4 and 10).
 */

/* ------------------------------------------------------------------ */
/* Stats and elements                                                  */
/* ------------------------------------------------------------------ */

export const STATS = ["might", "spirit", "guard", "will", "speed", "luck"] as const;
export type Stat = (typeof STATS)[number];
export type StatBlock = Record<Stat, number>;

export const ELEMENTS = ["physical", "fire", "frost", "storm", "water", "earth", "light", "shadow", "blood"] as const;
export type Element = (typeof ELEMENTS)[number];

/** Damage taken multiplier per element: 2 weak, 1 normal, 0.5 resist, 0 immune, -1 absorb. */
export type Affinities = Partial<Record<Element, number>>;

/** How the stage animates a figure (docs/DESIGN.md, 5.6). */
export type RigKind = "standing" | "floating" | "serpentine" | "huge";

/* ------------------------------------------------------------------ */
/* Statuses                                                            */
/* ------------------------------------------------------------------ */

export const STATUS_IDS = [
  "bleed", "burn", "poison", "frost", "stun", "fear", "mark", "vulnerable",
  "weaken", "guarded", "regen", "haste", "slow", "taunt", "silence",
] as const;
export type StatusId = (typeof STATUS_IDS)[number];

export interface StatusInstance {
  id: StatusId;
  /** Stacks (damage-over-time potency, or 1 for flags). */
  stacks: number;
  /** Turns of the bearer left. */
  turns: number;
  /** Who applied it (for marks and taunts). */
  source?: string;
}

/* ------------------------------------------------------------------ */
/* Effect atoms (the effect language, 4.3)                             */
/* ------------------------------------------------------------------ */

/** A number the budget solver fills in, or a fixed value. */
export type Mag = number | "auto";

export type Condition =
  | { kind: "target_below_hp"; pct: number }
  | { kind: "target_has_status"; status: StatusId }
  | { kind: "target_broken" }
  | { kind: "target_weak_to"; element: Element }
  | { kind: "self_resource_at_least"; n: number }
  | { kind: "self_below_hp"; pct: number };

export type Atom =
  | { op: "hit"; element: Element; scale: "might" | "spirit"; power: Mag; hits?: number; pierce?: number; stagger?: number; weight?: number }
  | { op: "heal"; power: Mag; self?: boolean; weight?: number }
  | { op: "shield"; power: Mag; turns?: number; self?: boolean; weight?: number }
  | { op: "status"; status: StatusId; chance: Mag; stacks?: Mag; turns?: number; self?: boolean; weight?: number }
  | { op: "cleanse"; count: Mag; self?: boolean; weight?: number }
  | { op: "delay"; amount: Mag; weight?: number }
  | { op: "haste_self"; amount: Mag; weight?: number }
  | { op: "gain"; resource: "focus" | "class"; n: Mag; weight?: number }
  | { op: "drain"; pct: Mag; weight?: number }
  | { op: "execute"; below: Mag; weight?: number }
  | { op: "spend_all_for_power"; perStack: Mag; weight?: number }
  | { op: "when"; if: Condition; then: Atom[]; weight?: number }
  | { op: "on_break"; then: Atom[]; weight?: number }
  | { op: "on_kill"; then: Atom[]; weight?: number };

export type TargetRule =
  | "self" | "ally" | "all_allies" | "lowest_hp_ally"
  | "enemy" | "all_enemies" | "random_enemies";

export interface SkillCost {
  focus?: Mag;
  /** Class resource spent. */
  resource?: number;
  /** Percent of max HP. */
  hpPct?: number;
  /** Own turns before reuse. */
  cooldown?: number;
}

export interface SkillVisual {
  cutin?: "diagonal_band" | "eye_strip" | "full_splash" | "triple_panel" | "shatter";
  fx?: string[];
  /** Comma-separated hex palette. */
  palette?: string;
}

export interface SkillDef {
  id: string;
  name: string;
  flavor?: string;
  target: TargetRule;
  /** For random_enemies. */
  count?: number;
  atoms: Atom[];
  cost?: SkillCost;
  /** Delay multiplier for the user's next turn (1 = normal action). */
  delay?: number;
  /** 0 basic, 1-5 power tier (sets the budget). */
  tier: number;
  signature?: boolean;
  visual?: SkillVisual;
  /** Set by the budget solver: the atoms with every "auto" filled. */
  solved?: boolean;
}

/* ------------------------------------------------------------------ */
/* Classes, resources, passives                                        */
/* ------------------------------------------------------------------ */

export type TriggerEvent = "turn_start" | "deal_hit" | "take_hit" | "apply_status" | "kill" | "break" | "crit" | "ally_falls";

export interface ResourceDef {
  id: string;
  name: string;
  max: number;
  start: number;
  /** How the resource fills. */
  gain: { on: TriggerEvent; n: number }[];
  /** Lost at turn start (0 keeps it). */
  decay?: number;
}

export interface PassiveDef {
  id: string;
  name: string;
  text: string;
  on: TriggerEvent;
  atoms: Atom[];
  /** Targets for the atoms (default self). */
  target?: TargetRule;
  /** Chance 0-100 (default 100). */
  chance?: number;
}

export interface ClassDef {
  id: string;
  name: string;
  /** Stats at level 1 and gained per level. */
  base: StatBlock & { hp: number; focus: number };
  growth: StatBlock & { hp: number; focus: number };
  resource?: ResourceDef;
  passives: PassiveDef[];
  skills: SkillDef[];
  /** Basic attack. */
  attack: SkillDef;
  visual: { brief: string; palette: string; rig?: RigKind };
}

export interface MonsterDef {
  id: string;
  name: string;
  level: number;
  hp: number;
  focus: number;
  stats: StatBlock;
  affinities: Affinities;
  /** Poise before Break. */
  poise: number;
  skills: SkillDef[];
  attack: SkillDef;
  passives?: PassiveDef[];
  /** How it fights. */
  ai: "brute" | "caster" | "support" | "assassin" | "boss";
  /** Can it be talked to (Parley in combat, M2). */
  talks: boolean;
  morale: number;
  visual: { brief: string; palette: string; rig: RigKind };
  /** Second phase, swapped in at the threshold. */
  phase2?: { atHpPct: number; into: Omit<MonsterDef, "phase2"> };
}

/* ------------------------------------------------------------------ */
/* Battle state                                                        */
/* ------------------------------------------------------------------ */

export type Side = "party" | "enemy";

export interface Combatant {
  id: string;
  name: string;
  side: Side;
  /** Class or monster id. */
  defId: string;
  level: number;
  hp: number;
  maxHp: number;
  focus: number;
  maxFocus: number;
  shield: number;
  stats: StatBlock;
  affinities: Affinities;
  poise: number;
  maxPoise: number;
  /** Broken: skips its next turn and takes extra damage. */
  broken: boolean;
  morale: number;
  statuses: StatusInstance[];
  resource?: { id: string; name: string; value: number; max: number; gain: { on: TriggerEvent; n: number }[]; decay: number };
  cooldowns: Record<string, number>;
  /** Skill ids this combatant can use (not counting the basic attack). */
  skills: string[];
  /** Basic attack skill id. */
  attack: string;
  /** Timeline position: acts when this is the lowest. */
  next: number;
  alive: boolean;
  /** Art lookup key (asset id, or a placeholder seed). */
  art: string;
  rig: RigKind;
  phase: 1 | 2;
  ai?: MonsterDef["ai"];
  /** Can be talked to in combat (4.2). */
  talks?: boolean;
  /** Left the fight through Talk instead of falling. */
  left?: TalkOption;
}

/** Combat Talk (4.2): a turn spent on words instead of blows. */
export type TalkOption = "surrender" | "bargain" | "recruit" | "taunt" | "deceive";
export const TALK_OPTIONS: readonly TalkOption[] = ["surrender", "bargain", "recruit", "taunt", "deceive"];

export interface BattleState {
  id: string;
  seed: string;
  /** Count of RNG draws, so a state can be resumed exactly. */
  draws: number;
  turn: number;
  combatants: Combatant[];
  /** Whose turn it is (lowest `next` among the living). */
  active: string | null;
  outcome: "ongoing" | "victory" | "defeat" | "fled";
  /** Skills by id, for every combatant (class + monster skills). */
  skills: Record<string, SkillDef>;
  passives: Record<string, PassiveDef[]>;
  /** Pending second phases by combatant id. */
  phases: Record<string, { atHpPct: number; into: Omit<MonsterDef, "phase2"> }>;
  /** Host-side context (card battles): ignored by the engine. */
  meta?: BattleMeta;
}

/** What a card battle carries for the host and stage; the engine never reads it. */
export interface BattleMeta {
  title?: string;
  /** Chat the fight belongs to. */
  chatId?: string;
  /** Art key of the place it happens in (the battlefield backdrop). */
  backdrop?: string;
  /** Monster defs by id, for art and for a resumed fight's phase 2. */
  monsters?: Record<string, MonsterDef>;
  /** Party portraits by combatant id: Lumiverse image ids of card art. */
  faces?: Record<string, string>;
  /** Delve room the fight is in, to mark it cleared. */
  room?: string;
}

/* ------------------------------------------------------------------ */
/* Actions and events (what the stage animates)                         */
/* ------------------------------------------------------------------ */

export interface Action {
  actor: string;
  /** A skill id, or `talk:<option>` for combat Talk (one target). */
  skill: string;
  /** Chosen target ids (single-target rules use the first). */
  targets: string[];
}

export type BattleEvent =
  | { kind: "turn"; actor: string; turn: number }
  | { kind: "use"; actor: string; skill: string; name: string; targets: string[]; cutin?: SkillVisual; signature?: boolean }
  | { kind: "hit"; source: string; target: string; amount: number; element: Element; crit: boolean; weak: boolean; resisted: boolean; absorbed: boolean; shieldTaken: number }
  | { kind: "miss"; source: string; target: string }
  | { kind: "heal"; target: string; amount: number }
  | { kind: "shield"; target: string; amount: number }
  | { kind: "status_on"; target: string; status: StatusId; stacks: number; turns: number }
  | { kind: "status_off"; target: string; status: StatusId }
  | { kind: "status_tick"; target: string; status: StatusId; amount: number }
  | { kind: "poise"; target: string; poise: number; max: number }
  | { kind: "break"; target: string }
  | { kind: "recover"; target: string }
  | { kind: "delay"; target: string; amount: number }
  | { kind: "resource"; target: string; value: number; max: number }
  | { kind: "focus"; target: string; value: number; max: number }
  | { kind: "skip"; actor: string; reason: "broken" | "stun" | "fear" }
  | { kind: "phase"; target: string; name: string }
  | { kind: "defeat"; target: string }
  | { kind: "passive"; actor: string; name: string }
  | { kind: "talk"; actor: string; target: string; option: TalkOption; ok: boolean; chance: number }
  | { kind: "leave"; target: string; how: TalkOption }
  | { kind: "end"; outcome: BattleState["outcome"] };
