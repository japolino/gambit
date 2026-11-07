/**
 * Builds combatants from class and monster definitions. Skills are passed
 * through the budget solver here, so the battle loop only ever sees numbers.
 */
import { solveSkill } from "./budget.js";
import type { BattleState, ClassDef, Combatant, MonsterDef, PassiveDef, SkillDef, StatBlock } from "./types.js";
import { STATS } from "./types.js";

export interface PartySpec {
  classDef: ClassDef;
  level: number;
  id?: string;
  name?: string;
  art?: string;
}

export interface EnemySpec {
  def: MonsterDef;
  id?: string;
  /** Name suffix for duplicates ("A", "B"...). */
  tag?: string;
}

export function statsAt(cls: ClassDef, level: number): StatBlock & { hp: number; focus: number } {
  const out = {} as StatBlock & { hp: number; focus: number };
  for (const s of STATS) out[s] = Math.round(cls.base[s] + cls.growth[s] * (level - 1));
  out.hp = Math.round(cls.base.hp + cls.growth.hp * (level - 1));
  out.focus = Math.round(cls.base.focus + cls.growth.focus * (level - 1));
  return out;
}

function register(state: Pick<BattleState, "skills">, skills: SkillDef[]): string[] {
  const ids: string[] = [];
  for (const s of skills) {
    if (!state.skills[s.id]) state.skills[s.id] = s.solved ? s : solveSkill(s);
    ids.push(s.id);
  }
  return ids;
}

export function makeMember(state: Pick<BattleState, "skills" | "passives">, spec: PartySpec): Combatant {
  const cls = spec.classDef;
  const st = statsAt(cls, spec.level);
  const id = spec.id ?? `p_${cls.id}`;
  const [attack] = register(state, [cls.attack]);
  const skills = register(state, cls.skills);
  state.passives[id] = cls.passives;
  return {
    id,
    name: spec.name ?? cls.name,
    side: "party",
    defId: cls.id,
    level: spec.level,
    hp: st.hp,
    maxHp: st.hp,
    focus: Math.round(st.focus * 0.6),
    maxFocus: st.focus,
    shield: 0,
    stats: { might: st.might, spirit: st.spirit, guard: st.guard, will: st.will, speed: st.speed, luck: st.luck },
    affinities: {},
    poise: 0,
    maxPoise: 0,
    broken: false,
    morale: 100,
    statuses: [],
    resource: cls.resource
      ? { id: cls.resource.id, name: cls.resource.name, value: cls.resource.start, max: cls.resource.max, gain: cls.resource.gain, decay: cls.resource.decay ?? 0 }
      : undefined,
    cooldowns: {},
    skills,
    attack,
    next: 0,
    alive: true,
    art: spec.art ?? `class:${cls.id}`,
    rig: cls.visual.rig ?? "standing",
    phase: 1,
  };
}

export function makeEnemy(state: Pick<BattleState, "skills" | "passives" | "phases">, spec: EnemySpec, index: number): Combatant {
  const d = spec.def;
  const id = spec.id ?? `e${index}_${d.id}`;
  const [attack] = register(state, [d.attack]);
  const skills = register(state, d.skills);
  state.passives[id] = (d.passives ?? []) as PassiveDef[];
  if (d.phase2) {
    register(state, [d.phase2.into.attack]);
    register(state, d.phase2.into.skills);
    state.phases[id] = d.phase2;
  }
  return {
    id,
    name: spec.tag ? `${d.name} ${spec.tag}` : d.name,
    side: "enemy",
    defId: d.id,
    level: d.level,
    hp: d.hp,
    maxHp: d.hp,
    focus: d.focus,
    maxFocus: d.focus,
    shield: 0,
    stats: { ...d.stats },
    affinities: { ...d.affinities },
    poise: d.poise,
    maxPoise: d.poise,
    broken: false,
    morale: d.morale,
    statuses: [],
    cooldowns: {},
    skills,
    attack,
    next: 0,
    alive: true,
    art: `monster:${d.id}`,
    rig: d.visual.rig,
    phase: 1,
    ai: d.ai,
  };
}
