/**
 * The battle loop (docs/DESIGN.md, 4.2). Pure and deterministic: every
 * function takes a state and returns a new one plus the events the stage
 * animates. Randomness comes only from the battle seed and a draw counter.
 *
 * Turn order is a timeline: each combatant has a `next` time, the lowest
 * acts, and acting pushes it back by a delay that speed shortens.
 */
import { seededRng } from "./dice.js";
import { makeEnemy, makeMember, type EnemySpec, type PartySpec } from "./combatant.js";
import { STATUS_RULES } from "./statuses.js";
import { TALK_OPTIONS } from "./types.js";
import type {
  Action, Atom, BattleEvent, BattleState, Combatant, Condition, PassiveDef, SkillDef, StatusId, TalkOption, TargetRule, TriggerEvent,
} from "./types.js";

export const BASE_DELAY = 100;

/* ------------------------------------------------------------------ */
/* Basics                                                              */
/* ------------------------------------------------------------------ */

export const rand = (s: BattleState): number => seededRng(`${s.seed}#${s.draws++}`)();

const clone = <T>(v: T): T => structuredClone(v);
const byId = (s: BattleState, id: string): Combatant | undefined => s.combatants.find((c) => c.id === id);
const living = (s: BattleState, side?: Combatant["side"]): Combatant[] => s.combatants.filter((c) => c.alive && (!side || c.side === side));
const foes = (s: BattleState, c: Combatant): Combatant[] => living(s, c.side === "party" ? "enemy" : "party");
const friends = (s: BattleState, c: Combatant): Combatant[] => living(s, c.side);
const has = (c: Combatant, id: StatusId): boolean => c.statuses.some((x) => x.id === id);
const stacksOf = (c: Combatant, id: StatusId): number => c.statuses.find((x) => x.id === id)?.stacks ?? 0;
const hpPct = (c: Combatant): number => (c.maxHp > 0 ? (c.hp / c.maxHp) * 100 : 0);

export const speedFactor = (c: Combatant): number => Math.max(0.3, (c.stats.speed + 20) / 40);

export function delayMult(c: Combatant): number {
  let m = 1;
  if (has(c, "haste")) m *= 0.75;
  if (has(c, "slow")) m *= 1.3;
  m *= 1 + 0.15 * stacksOf(c, "frost");
  return m;
}

export const turnDelay = (c: Combatant, skillDelay = 1): number => Math.round((BASE_DELAY * skillDelay * delayMult(c)) / speedFactor(c));

/* ------------------------------------------------------------------ */
/* Setup                                                               */
/* ------------------------------------------------------------------ */

export interface BattleSetup {
  id: string;
  seed: string;
  party: PartySpec[];
  enemies: EnemySpec[];
}

export function createBattle(setup: BattleSetup): BattleState {
  const state: BattleState = {
    id: setup.id, seed: setup.seed, draws: 0, turn: 0, combatants: [], active: null, outcome: "ongoing",
    skills: {}, passives: {}, phases: {},
  };
  for (const p of setup.party) state.combatants.push(makeMember(state, p));
  const counts = new Map<string, number>();
  for (const e of setup.enemies) counts.set(e.def.id, (counts.get(e.def.id) ?? 0) + 1);
  const seen = new Map<string, number>();
  setup.enemies.forEach((e, i) => {
    const n = seen.get(e.def.id) ?? 0;
    seen.set(e.def.id, n + 1);
    const tag = e.tag ?? ((counts.get(e.def.id) ?? 0) > 1 ? String.fromCharCode(65 + n) : undefined);
    state.combatants.push(makeEnemy(state, { ...e, tag }, i));
  });
  for (const c of state.combatants) c.next = Math.round(turnDelay(c) * (0.45 + 0.55 * rand(state)));
  return state;
}

/* ------------------------------------------------------------------ */
/* Timeline                                                            */
/* ------------------------------------------------------------------ */

function order(a: Combatant, b: Combatant): number {
  return a.next - b.next || b.stats.speed - a.stats.speed || (a.id < b.id ? -1 : 1);
}

function pickNext(s: BattleState): Combatant | undefined {
  return living(s).sort(order)[0];
}

/** The next `n` actors, assuming nothing changes (for the timeline strip). */
export function timeline(state: BattleState, n = 8): string[] {
  const sim = living(state).map((c) => ({ c, next: c.next }));
  const out: string[] = [];
  if (state.active) {
    out.push(state.active);
    const a = sim.find((x) => x.c.id === state.active);
    if (a) a.next += turnDelay(a.c);
  }
  while (out.length < n && sim.length > 0) {
    sim.sort((a, b) => a.next - b.next || b.c.stats.speed - a.c.stats.speed || (a.c.id < b.c.id ? -1 : 1));
    const x = sim[0];
    out.push(x.c.id);
    x.next += turnDelay(x.c);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Legal actions                                                       */
/* ------------------------------------------------------------------ */

export interface ActionOption {
  skill: SkillDef;
  targetSets: string[][];
  usable: boolean;
  reason?: string;
}

function costOf(skill: SkillDef): { focus: number; resource: number; hpPct: number } {
  const c = skill.cost ?? {};
  return { focus: typeof c.focus === "number" ? c.focus : 0, resource: c.resource ?? 0, hpPct: c.hpPct ?? 0 };
}

function taunter(s: BattleState, c: Combatant): Combatant | undefined {
  const t = c.statuses.find((x) => x.id === "taunt");
  const src = t?.source ? byId(s, t.source) : undefined;
  return src?.alive ? src : undefined;
}

function candidateSets(s: BattleState, c: Combatant, rule: TargetRule): string[][] {
  switch (rule) {
    case "enemy": {
      const forced = taunter(s, c);
      return (forced ? [forced] : foes(s, c)).map((t) => [t.id]);
    }
    case "ally":
      return friends(s, c).map((t) => [t.id]);
    default:
      return [[]];
  }
}

export function legalActions(state: BattleState, actorId: string): ActionOption[] {
  const c = byId(state, actorId);
  if (!c || !c.alive) return [];
  const out: ActionOption[] = [];
  for (const id of [c.attack, ...c.skills]) {
    const skill = state.skills[id];
    if (!skill) continue;
    const cost = costOf(skill);
    let reason: string | undefined;
    if ((c.cooldowns[id] ?? 0) > 0) reason = `Ready in ${c.cooldowns[id]} turn${c.cooldowns[id] === 1 ? "" : "s"}`;
    else if (id !== c.attack && has(c, "silence")) reason = "Silenced";
    else if (cost.focus > c.focus) reason = `Needs ${cost.focus} Focus`;
    else if (cost.resource > (c.resource?.value ?? 0)) reason = `Needs ${cost.resource} ${c.resource?.name ?? "resource"}`;
    else if (cost.hpPct > 0 && c.hp <= Math.ceil((c.maxHp * cost.hpPct) / 100)) reason = "Too wounded";
    const targetSets = candidateSets(state, c, skill.target);
    if (!reason && targetSets.length === 0) reason = "No target";
    out.push({ skill, targetSets, usable: !reason, reason });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Statuses, resources, triggers                                       */
/* ------------------------------------------------------------------ */

interface Ctx {
  events: BattleEvent[];
  depth: number;
}

function applyStatus(s: BattleState, t: Combatant, id: StatusId, stacks: number, turns: number | undefined, source: string, ctx: Ctx): void {
  if (!t.alive) return;
  const rule = STATUS_RULES[id];
  const existing = t.statuses.find((x) => x.id === id);
  const dur = turns ?? rule.turns;
  if (existing) {
    existing.stacks = Math.min(rule.maxStacks, existing.stacks + stacks);
    existing.turns = Math.max(existing.turns, dur);
    existing.source = source;
  } else {
    t.statuses.push({ id, stacks: Math.min(rule.maxStacks, stacks), turns: dur, source });
  }
  const now = t.statuses.find((x) => x.id === id)!;
  ctx.events.push({ kind: "status_on", target: t.id, status: id, stacks: now.stacks, turns: now.turns });
  if (id === "frost" && now.stacks >= 3) {
    removeStatus(t, "frost", ctx);
    applyStatus(s, t, "stun", 1, 1, source, ctx);
  }
}

function removeStatus(t: Combatant, id: StatusId, ctx: Ctx): void {
  const before = t.statuses.length;
  t.statuses = t.statuses.filter((x) => x.id !== id);
  if (t.statuses.length !== before) ctx.events.push({ kind: "status_off", target: t.id, status: id });
}

function gainResource(c: Combatant, n: number, ctx: Ctx): void {
  if (!c.resource || n === 0) return;
  const v = Math.max(0, Math.min(c.resource.max, c.resource.value + n));
  if (v === c.resource.value) return;
  c.resource.value = v;
  ctx.events.push({ kind: "resource", target: c.id, value: v, max: c.resource.max });
}

function trigger(s: BattleState, c: Combatant, on: TriggerEvent, ctx: Ctx): void {
  if (!c.alive && on !== "kill") return;
  for (const g of c.resource?.gain ?? []) if (g.on === on) gainResource(c, g.n, ctx);
  if (ctx.depth > 0) return; // passives never trigger passives
  for (const p of s.passives[c.id] ?? []) {
    if (p.on !== on) continue;
    if ((p.chance ?? 100) < 100 && rand(s) * 100 >= (p.chance ?? 100)) continue;
    runPassive(s, c, p, ctx);
  }
}

function runPassive(s: BattleState, c: Combatant, p: PassiveDef, ctx: Ctx): void {
  const sub: Ctx = { events: ctx.events, depth: ctx.depth + 1 };
  ctx.events.push({ kind: "passive", actor: c.id, name: p.name });
  const targets = resolveTargets(s, c, p.target ?? "self", [], 1);
  const hit: HitCtx = freshHit();
  targets.forEach((t, i) => runAtoms(s, c, t, p.atoms, sub, hit, i === 0));
}

/* ------------------------------------------------------------------ */
/* Damage                                                              */
/* ------------------------------------------------------------------ */

interface HitCtx {
  dealt: number;
  broke: boolean;
  killed: boolean;
  bonusPower: number;
  drainPct: number;
  selfHaste: number;
}
const freshHit = (): HitCtx => ({ dealt: 0, broke: false, killed: false, bonusPower: 0, drainPct: 0, selfHaste: 0 });

function checkOutcome(s: BattleState, ctx: Ctx): void {
  if (s.outcome !== "ongoing") return;
  if (living(s, "enemy").length === 0) s.outcome = "victory";
  else if (living(s, "party").length === 0) s.outcome = "defeat";
  if (s.outcome !== "ongoing") s.active = null;
}

/** Close a step: the "end" event, once, after everything else that happened. */
function seal(s: BattleState, ctx: Ctx): void {
  if (s.outcome !== "ongoing" && !ctx.events.some((e) => e.kind === "end")) ctx.events.push({ kind: "end", outcome: s.outcome });
}

function moraleHit(c: Combatant, n: number): void {
  c.morale = Math.max(0, Math.min(100, c.morale - n));
}

function kill(s: BattleState, t: Combatant, src: Combatant | undefined, ctx: Ctx): void {
  t.hp = 0;
  t.alive = false;
  t.shield = 0;
  t.statuses = [];
  ctx.events.push({ kind: "defeat", target: t.id });
  for (const f of friends(s, t)) {
    moraleHit(f, 20);
    trigger(s, f, "ally_falls", ctx);
  }
  if (src) trigger(s, src, "kill", ctx);
}

function maybePhase(s: BattleState, t: Combatant, ctx: Ctx): void {
  const ph = s.phases[t.id];
  if (!ph || !t.alive || hpPct(t) > ph.atHpPct) return;
  const d = ph.into;
  delete s.phases[t.id];
  t.name = d.name;
  t.defId = d.id;
  t.stats = { ...d.stats };
  t.affinities = { ...d.affinities };
  t.maxHp = d.hp;
  t.hp = d.hp;
  t.poise = d.poise;
  t.maxPoise = d.poise;
  t.broken = false;
  t.statuses = [];
  t.skills = d.skills.map((x) => x.id);
  t.attack = d.attack.id;
  t.ai = d.ai;
  t.rig = d.visual.rig;
  t.phase = 2;
  t.art = `monster:${d.id}`;
  s.passives[t.id] = d.passives ?? [];
  ctx.events.push({ kind: "phase", target: t.id, name: d.name });
}

/** Damage after shields; returns HP actually lost. Used by hits and ticks. */
function loseHp(s: BattleState, t: Combatant, amount: number, src: Combatant | undefined, ctx: Ctx): number {
  const before = hpPct(t);
  const lost = Math.min(t.hp, amount);
  t.hp -= lost;
  const after = hpPct(t);
  for (const line of [50, 25]) if (before > line && after <= line) moraleHit(t, 15);
  if (t.hp <= 0) kill(s, t, src, ctx);
  else maybePhase(s, t, ctx);
  return lost;
}

/** Expected damage before randomness (the AI and the design preview use it). */
export function estimateHit(src: Combatant, t: Combatant, atom: Extract<Atom, { op: "hit" }>, bonusPower = 0): number {
  const power = (typeof atom.power === "number" ? atom.power : 0) + bonusPower;
  const a = Math.max(1, src.stats[atom.scale]);
  const defStat = atom.element === "physical" ? t.stats.guard : t.stats.will;
  const d = Math.max(0, defStat * (1 - (atom.pierce ?? 0)));
  let dmg = (power * a * a) / (a + d) / 10;
  const aff = t.affinities[atom.element] ?? 1;
  dmg *= aff >= 2 ? 1.5 : aff;
  if (has(t, "vulnerable")) dmg *= 1.25;
  if (has(t, "mark")) dmg *= 1.2;
  if (has(t, "guarded")) dmg *= 0.7;
  if (t.broken) dmg *= 1.5;
  if (has(src, "weaken")) dmg *= 0.75;
  if (has(src, "fear")) dmg *= 0.8;
  return dmg * (atom.hits ?? 1);
}

function doHit(s: BattleState, src: Combatant, t: Combatant, atom: Extract<Atom, { op: "hit" }>, ctx: Ctx, hit: HitCtx): void {
  const hits = atom.hits ?? 1;
  for (let h = 0; h < hits && t.alive && s.outcome === "ongoing"; h++) {
    const single = { ...atom, hits: 1 };
    let dmg = estimateHit(src, t, single, hit.bonusPower);
    dmg *= 0.92 + 0.16 * rand(s);
    const crit = rand(s) * 100 < 5 + src.stats.luck * 0.5;
    if (crit) dmg *= 1.5;
    const aff = t.affinities[atom.element] ?? 1;
    const weak = aff >= 2;
    if (aff < 0) {
      const heal = Math.max(1, Math.round(Math.abs(dmg))); // estimateHit already applied the (negative) affinity
      t.hp = Math.min(t.maxHp, t.hp + heal);
      ctx.events.push({ kind: "hit", source: src.id, target: t.id, amount: 0, element: atom.element, crit: false, weak: false, resisted: false, absorbed: true, shieldTaken: 0 });
      ctx.events.push({ kind: "heal", target: t.id, amount: heal });
      continue;
    }
    let amount = aff === 0 ? 0 : Math.max(1, Math.round(dmg));
    const shieldTaken = Math.min(t.shield, amount);
    t.shield -= shieldTaken;
    amount -= shieldTaken;
    ctx.events.push({ kind: "hit", source: src.id, target: t.id, amount, element: atom.element, crit, weak, resisted: aff > 0 && aff < 1, absorbed: false, shieldTaken });
    if (aff === 0) continue;
    hit.dealt += loseHp(s, t, amount, src, ctx);
    trigger(s, src, "deal_hit", ctx);
    if (crit) trigger(s, src, "crit", ctx);
    if (t.alive) trigger(s, t, "take_hit", ctx);
    else hit.killed = true;
    // Poise: weaknesses stagger twice as hard.
    if (t.alive && t.maxPoise > 0 && !t.broken) {
      const p = (atom.stagger ?? 1) * (weak ? 2 : 1);
      t.poise = Math.max(0, t.poise - p);
      ctx.events.push({ kind: "poise", target: t.id, poise: t.poise, max: t.maxPoise });
      if (t.poise === 0) {
        t.broken = true;
        hit.broke = true;
        moraleHit(t, 10);
        ctx.events.push({ kind: "break", target: t.id });
        trigger(s, src, "break", ctx);
      }
    }
  }
  checkOutcome(s, ctx);
}

/* ------------------------------------------------------------------ */
/* Atoms                                                               */
/* ------------------------------------------------------------------ */

function conditionHolds(s: BattleState, src: Combatant, t: Combatant, cond: Condition): boolean {
  switch (cond.kind) {
    case "target_below_hp": return t.alive && hpPct(t) <= cond.pct;
    case "target_has_status": return has(t, cond.status);
    case "target_broken": return t.broken;
    case "target_weak_to": return (t.affinities[cond.element] ?? 1) >= 2;
    case "self_resource_at_least": return (src.resource?.value ?? 0) >= cond.n;
    case "self_below_hp": return hpPct(src) <= cond.pct;
  }
}

const n = (v: number | "auto" | undefined, d = 0): number => (typeof v === "number" ? v : d);

function runAtoms(s: BattleState, src: Combatant, t: Combatant, atoms: Atom[], ctx: Ctx, hit: HitCtx, first: boolean): void {
  // Spend-all atoms charge the hits that follow, wherever they sit in the list.
  for (const a of atoms) {
    if (a.op === "spend_all_for_power" && first && src.resource) {
      hit.bonusPower += src.resource.value * n(a.perStack);
      gainResource(src, -src.resource.value, ctx);
    }
  }
  for (const a of atoms) {
    if (s.outcome !== "ongoing" && a.op !== "heal") return;
    switch (a.op) {
      case "hit":
        if (t.alive) doHit(s, src, t, a, ctx, hit);
        break;
      case "heal": {
        const who = a.self ? src : t;
        if ((a.self && !first) || !who.alive) break;
        const amount = Math.round((n(a.power) * (src.stats.spirit * 0.6 + 10)) / 10);
        const got = Math.min(amount, who.maxHp - who.hp);
        who.hp += got;
        ctx.events.push({ kind: "heal", target: who.id, amount: got });
        break;
      }
      case "shield": {
        const who = a.self ? src : t;
        if ((a.self && !first) || !who.alive) break;
        const amount = Math.round((n(a.power) * (src.stats.guard * 0.5 + src.stats.spirit * 0.3 + 10)) / 10);
        who.shield += amount;
        ctx.events.push({ kind: "shield", target: who.id, amount });
        break;
      }
      case "status": {
        const who = a.self ? src : t;
        if ((a.self && !first) || !who.alive) break;
        if (rand(s) * 100 < n(a.chance)) {
          applyStatus(s, who, a.status, n(a.stacks, 1), a.turns, src.id, ctx);
          trigger(s, src, "apply_status", ctx);
        }
        break;
      }
      case "cleanse": {
        const who = a.self ? src : t;
        if ((a.self && !first) || !who.alive) break;
        const bad = who.statuses.filter((x) => !STATUS_RULES[x.id].good).slice(0, n(a.count, 1));
        for (const b of bad) removeStatus(who, b.id, ctx);
        break;
      }
      case "delay":
        if (t.alive && t.id !== src.id) {
          t.next += n(a.amount);
          ctx.events.push({ kind: "delay", target: t.id, amount: n(a.amount) });
        }
        break;
      case "haste_self":
        if (first) hit.selfHaste += n(a.amount);
        break;
      case "gain":
        if (!first) break;
        if (a.resource === "focus") {
          src.focus = Math.min(src.maxFocus, src.focus + n(a.n));
          ctx.events.push({ kind: "focus", target: src.id, value: src.focus, max: src.maxFocus });
        } else gainResource(src, n(a.n), ctx);
        break;
      case "drain":
        hit.drainPct = Math.max(hit.drainPct, n(a.pct));
        break;
      case "execute":
        if (t.alive && hpPct(t) <= n(a.below)) {
          const amount = t.hp;
          ctx.events.push({ kind: "hit", source: src.id, target: t.id, amount, element: "physical", crit: true, weak: false, resisted: false, absorbed: false, shieldTaken: 0 });
          loseHp(s, t, amount, src, ctx);
          hit.killed = true;
          checkOutcome(s, ctx);
        }
        break;
      case "spend_all_for_power":
        break;
      case "when":
        if (conditionHolds(s, src, t, a.if)) runAtoms(s, src, t, a.then, ctx, hit, first);
        break;
      case "on_break":
        if (hit.broke) runAtoms(s, src, t, a.then, ctx, hit, first);
        break;
      case "on_kill":
        if (hit.killed) runAtoms(s, src, t, a.then, ctx, hit, first);
        break;
    }
  }
}

function resolveTargets(s: BattleState, c: Combatant, rule: TargetRule, chosen: string[], count: number): Combatant[] {
  const pickLiving = (pool: Combatant[]): Combatant | undefined => {
    const want = chosen.map((id) => pool.find((p) => p.id === id)).find(Boolean);
    return want ?? pool.slice().sort((a, b) => hpPct(a) - hpPct(b))[0];
  };
  switch (rule) {
    case "self": return [c];
    case "ally": { const t = pickLiving(friends(s, c)); return t ? [t] : []; }
    case "all_allies": return friends(s, c);
    case "lowest_hp_ally": { const t = friends(s, c).sort((a, b) => hpPct(a) - hpPct(b))[0]; return t ? [t] : []; }
    case "enemy": {
      const forced = taunter(s, c);
      const t = forced ?? pickLiving(foes(s, c));
      return t ? [t] : [];
    }
    case "all_enemies": return foes(s, c);
    case "random_enemies": {
      const out: Combatant[] = [];
      for (let i = 0; i < Math.max(1, count); i++) {
        const pool = foes(s, c);
        if (pool.length === 0) break;
        out.push(pool[Math.floor(rand(s) * pool.length)]);
      }
      return out;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Turns                                                               */
/* ------------------------------------------------------------------ */

/** Start-of-turn upkeep. Returns false when the turn is lost. */
function startTurn(s: BattleState, c: Combatant, ctx: Ctx): boolean {
  for (const k of Object.keys(c.cooldowns)) if (c.cooldowns[k] > 0) c.cooldowns[k]--;
  if (c.resource?.decay) gainResource(c, -c.resource.decay, ctx);
  c.shield = Math.floor(c.shield / 2);
  trigger(s, c, "turn_start", ctx);
  for (const st of [...c.statuses]) {
    const rule = STATUS_RULES[st.id];
    if (rule.kind === "dot") {
      const amount = Math.max(1, Math.round((c.maxHp * (rule.pctPerStack ?? 0) * st.stacks) / 100));
      ctx.events.push({ kind: "status_tick", target: c.id, status: st.id, amount });
      const src = st.source ? byId(s, st.source) : undefined;
      loseHp(s, c, amount, src, ctx);
      checkOutcome(s, ctx);
      if (!c.alive) return false;
    } else if (rule.kind === "hot") {
      const amount = Math.min(c.maxHp - c.hp, Math.round((c.maxHp * (rule.pctPerStack ?? 0) * st.stacks) / 100));
      if (amount > 0) {
        c.hp += amount;
        ctx.events.push({ kind: "status_tick", target: c.id, status: st.id, amount: -amount });
      }
    }
  }
  if (c.broken) {
    ctx.events.push({ kind: "skip", actor: c.id, reason: "broken" });
    c.broken = false;
    c.poise = c.maxPoise;
    ctx.events.push({ kind: "recover", target: c.id });
    ctx.events.push({ kind: "poise", target: c.id, poise: c.poise, max: c.maxPoise });
    return false;
  }
  if (has(c, "stun")) {
    removeStatus(c, "stun", ctx);
    ctx.events.push({ kind: "skip", actor: c.id, reason: "stun" });
    return false;
  }
  if (has(c, "fear") && rand(s) < 0.3) {
    ctx.events.push({ kind: "skip", actor: c.id, reason: "fear" });
    return false;
  }
  return true;
}

function endTurn(s: BattleState, c: Combatant, skillDelay: number, selfHaste: number, ctx: Ctx): void {
  if (!c.alive) return;
  c.next += Math.max(10, turnDelay(c, skillDelay) - selfHaste);
  for (const st of c.statuses) st.turns--;
  for (const st of c.statuses.filter((x) => x.turns <= 0)) removeStatus(c, st.id, ctx);
}

function perform(s: BattleState, action: Action, ctx: Ctx): void {
  const c = byId(s, action.actor);
  const skill = s.skills[action.skill];
  if (!c || !skill) throw new Error(`Unknown actor or skill: ${action.actor} / ${action.skill}`);
  const cost = costOf(skill);
  if (cost.focus) {
    c.focus -= cost.focus;
    ctx.events.push({ kind: "focus", target: c.id, value: c.focus, max: c.maxFocus });
  }
  if (cost.resource) gainResource(c, -cost.resource, ctx);
  if (cost.hpPct) c.hp = Math.max(1, c.hp - Math.ceil((c.maxHp * cost.hpPct) / 100));
  if (skill.cost?.cooldown) c.cooldowns[skill.id] = skill.cost.cooldown + 1;

  const targets = resolveTargets(s, c, skill.target, action.targets, skill.count ?? 1);
  ctx.events.push({
    kind: "use", actor: c.id, skill: skill.id, name: skill.name, targets: targets.map((t) => t.id),
    cutin: skill.visual, signature: skill.signature, tier: skill.tier,
  });
  const hit = freshHit();
  targets.forEach((t, i) => runAtoms(s, c, t, skill.atoms, ctx, hit, i === 0));
  if (hit.drainPct > 0 && c.alive && hit.dealt > 0) {
    const amount = Math.min(c.maxHp - c.hp, Math.round((hit.dealt * hit.drainPct) / 100));
    if (amount > 0) {
      c.hp += amount;
      ctx.events.push({ kind: "heal", target: c.id, amount });
    }
  }
  endTurn(s, c, skill.delay ?? 1, hit.selfHaste, ctx);
  checkOutcome(s, ctx);
}

/* ------------------------------------------------------------------ */
/* Public steps                                                        */
/* ------------------------------------------------------------------ */

export interface StepResult {
  state: BattleState;
  events: BattleEvent[];
}

export type Policy = (state: BattleState, actorId: string) => Action;

/**
 * Run turns until a party member must choose (state.active is set) or the
 * battle ends. Enemies act through `enemyPolicy`; with `partyPolicy` the
 * party acts too (the simulator).
 */
export function advance(input: BattleState, opts: { enemyPolicy: Policy; partyPolicy?: Policy; maxTurns?: number }): StepResult {
  const s = clone(input);
  const ctx: Ctx = { events: [], depth: 0 };
  const limit = opts.maxTurns ?? 400;
  let guard = 0;
  while (s.outcome === "ongoing" && guard++ < limit) {
    if (s.active) {
      if (!opts.partyPolicy) break;
      const actor = s.active;
      s.active = null;
      perform(s, opts.partyPolicy(s, actor), ctx);
      continue;
    }
    const c = pickNext(s);
    if (!c) break;
    s.turn++;
    ctx.events.push({ kind: "turn", actor: c.id, turn: s.turn });
    const acts = startTurn(s, c, ctx);
    if (s.outcome !== "ongoing") break;
    if (!acts) {
      endTurn(s, c, 1, 0, ctx);
      continue;
    }
    if (c.side === "party" && !opts.partyPolicy) {
      s.active = c.id;
      break;
    }
    const policy = c.side === "party" ? opts.partyPolicy! : opts.enemyPolicy;
    perform(s, policy(s, c.id), ctx);
  }
  if (guard >= limit && s.outcome === "ongoing") s.outcome = "fled";
  seal(s, ctx);
  return { state: s, events: ctx.events };
}

/* ------------------------------------------------------------------ */
/* Combat Talk (4.2)                                                   */
/* ------------------------------------------------------------------ */

export interface TalkChoice {
  option: TalkOption;
  label: string;
  /** Percent chance it works, from the target's morale and state. */
  chance: number;
  usable: boolean;
  reason?: string;
}

const TALK_LABEL: Record<TalkOption, string> = {
  surrender: "Demand surrender",
  bargain: "Bargain",
  recruit: "Recruit",
  taunt: "Taunt",
  deceive: "Deceive",
};

const clampPct = (n: number): number => Math.max(5, Math.min(95, Math.round(n)));

/** What the active party member can say to a target, with the odds code computed. */
export function talkOptions(state: BattleState, actorId: string, targetId: string): TalkChoice[] {
  const c = byId(state, actorId);
  const t = byId(state, targetId);
  if (!c || !t || !t.alive || t.side === c.side) return [];
  const fear = 100 - t.morale;
  const wit = (c.stats.will + c.stats.luck) / 2;
  const allies = living(state, t.side).length;
  const boss = t.ai === "boss";
  const talks = t.talks !== false;
  const choice = (option: TalkOption, chance: number, reason?: string): TalkChoice => ({ option, label: TALK_LABEL[option], chance: clampPct(chance), usable: !reason, ...(reason ? { reason } : {}) });
  const mute = talks ? undefined : "It cannot be reasoned with";
  return [
    choice("surrender", fear * 0.9 - 25 + (t.broken ? 20 : 0) + (allies <= 1 ? 15 : 0) + wit * 0.3 - (boss ? 30 : 0), mute ?? (t.morale > 70 ? "Too sure of winning" : undefined)),
    choice("bargain", fear * 0.7 - 10 + wit * 0.4 - (boss ? 25 : 0), mute ?? (boss ? "Not for sale" : undefined)),
    choice("recruit", fear * 0.6 - 25 + wit * 0.5, mute ?? (boss ? "Never" : t.morale > 40 ? "Not shaken enough" : undefined)),
    choice("taunt", 70 + wit * 0.5),
    choice("deceive", 35 + wit - t.stats.will * 0.8, mute),
  ];
}

function performTalk(s: BattleState, c: Combatant, option: TalkOption, targetId: string, ctx: Ctx): void {
  const t = byId(s, targetId);
  const opt = talkOptions(s, c.id, targetId).find((o) => o.option === option);
  if (!t || !opt || !opt.usable) throw new Error(opt?.reason ?? "Nothing to say to that.");
  const ok = rand(s) * 100 < opt.chance;
  ctx.events.push({ kind: "talk", actor: c.id, target: t.id, option, ok, chance: opt.chance });
  if (ok) {
    switch (option) {
      case "surrender":
      case "bargain":
      case "recruit":
        t.alive = false;
        t.left = option;
        t.statuses = [];
        ctx.events.push({ kind: "leave", target: t.id, how: option });
        for (const f of friends(s, t)) moraleHit(f, 15);
        break;
      case "taunt":
        applyStatus(s, t, "taunt", 1, 2, c.id, ctx);
        moraleHit(t, 5);
        break;
      case "deceive":
        t.next += 60;
        ctx.events.push({ kind: "delay", target: t.id, amount: 60 });
        moraleHit(t, 10);
        break;
    }
  } else {
    // A failed demand steadies them a little; a failed lie is noticed.
    t.morale = Math.min(100, t.morale + (option === "deceive" ? 10 : 5));
  }
  endTurn(s, c, 1, 0, ctx);
  checkOutcome(s, ctx);
}

/** The active party member acts. Throws on an illegal action. */
export function act(input: BattleState, action: Action): StepResult {
  if (input.outcome !== "ongoing") throw new Error("The battle is over.");
  if (input.active !== action.actor) throw new Error(`It is not ${action.actor}'s turn.`);
  if (action.skill.startsWith("talk:")) {
    const option = action.skill.slice(5) as TalkOption;
    if (!(TALK_OPTIONS as readonly string[]).includes(option)) throw new Error(`Unknown talk option ${option}.`);
    const s = clone(input);
    const ctx: Ctx = { events: [], depth: 0 };
    s.active = null;
    const actor = byId(s, action.actor)!;
    performTalk(s, actor, option, action.targets[0] ?? "", ctx);
    seal(s, ctx);
    return { state: s, events: ctx.events };
  }
  const option = legalActions(input, action.actor).find((o) => o.skill.id === action.skill);
  if (!option) throw new Error(`Unknown skill ${action.skill}.`);
  if (!option.usable) throw new Error(option.reason ?? "Not usable.");
  const single = option.skill.target === "enemy" || option.skill.target === "ally";
  if (single && action.targets.length > 0 && !option.targetSets.some((set) => set[0] === action.targets[0])) {
    throw new Error("Illegal target.");
  }
  const s = clone(input);
  const ctx: Ctx = { events: [], depth: 0 };
  s.active = null;
  perform(s, action, ctx);
  seal(s, ctx);
  return { state: s, events: ctx.events };
}

/** act() then advance() to the next decision, with the events of both. */
export function actAndAdvance(input: BattleState, action: Action, enemyPolicy: Policy): StepResult {
  const a = act(input, action);
  const b = advance(a.state, { enemyPolicy });
  return { state: b.state, events: [...a.events, ...b.events] };
}

export const combatant = byId;
export const livingOf = living;
export const hpPercent = hpPct;
