/**
 * Memory and consequence (docs/DESIGN.md 4.6, M6). Pure and seeded.
 *
 *  - The Deed Ledger: code records what you do as tagged events.
 *  - The build profile: how you fight (element mix, favourite statuses,
 *    talk or fight), tallied from battle events.
 *  - Faction adaptation: a group you keep hurting picks a countermeasure from
 *    the atom library, inside a budget, always foreshadowed by a rumour.
 *  - NPCs remember: lies, kindnesses and threats become memories, and
 *    affinity with companions moves with them.
 *  - Notice: mentions, visits and talks raise interest; past a threshold
 *    an entity is promoted (capped at 3 active).
 */
import type { CardSheet } from "../card/types.js";
import type { SheetFoe } from "../card/foes.js";
import { ELEMENTS, STATUS_IDS, type BattleEvent, type BattleState, type Element, type MonsterDef, type StatusId } from "../types.js";
import { solveSkill } from "../budget.js";

/* ------------------------------ the ledger ----------------------------- */

export type DeedKind =
  | "killed" // foes beaten in a fight (n, method = top element)
  | "spared" // talked into yielding
  | "recruited"
  | "bargained"
  | "lost_to" // a fight lost
  | "won_over" // a Parley won
  | "deal"
  | "walked"
  | "refused"
  | "lied_to"
  | "threatened"
  | "charmed"
  | "bribed"
  | "caught" // seen doing something they wrote, on a failed roll
  | "found" // a secret or revelation
  | "visited";

export interface Deed {
  day: number;
  kind: DeedKind;
  /** What it was done to: a foe id, a cast id, a place id, a fact id. */
  target: string;
  name: string;
  n?: number;
  method?: string;
  place?: string;
}

/** How a party fights: totals from the battle events of party members. */
export interface Tally {
  elements: Partial<Record<Element, number>>;
  statuses: Partial<Record<StatusId, number>>;
  talks: number;
  hits: number;
  /** The player's skill uses by skill id (skill awakening, 4.4). */
  uses?: Record<string, number>;
}

export const emptyTally = (): Tally => ({ elements: {}, statuses: {}, talks: 0, hits: 0 });

/** Add a step's events to a tally, counting only what the party did. */
export function tallyEvents(t: Tally, events: readonly BattleEvent[], party: ReadonlySet<string>): Tally {
  const out: Tally = { elements: { ...t.elements }, statuses: { ...t.statuses }, talks: t.talks, hits: t.hits, uses: { ...(t.uses ?? {}) } };
  let lastActor = "";
  for (const e of events) {
    if (e.kind === "use") {
      lastActor = e.actor;
      if (e.actor === "p_player" && !e.skill.startsWith("talk:")) out.uses![e.skill] = (out.uses![e.skill] ?? 0) + 1;
    }
    if (e.kind === "hit" && party.has(e.source)) {
      out.elements[e.element] = (out.elements[e.element] ?? 0) + e.amount;
      out.hits++;
    }
    if (e.kind === "status_on" && party.has(lastActor) && !party.has(e.target)) out.statuses[e.status] = (out.statuses[e.status] ?? 0) + 1;
    if (e.kind === "talk" && party.has(e.actor)) out.talks++;
  }
  return out;
}

const top = <K extends string>(m: Partial<Record<K, number>>): K | null => {
  let best: K | null = null;
  let v = 0;
  for (const [k, n] of Object.entries(m) as [K, number][]) if (n > v) [best, v] = [k, n];
  return best;
};

export interface Profile {
  element: Element | null;
  /** Share of all damage done with that element, 0-1. */
  share: number;
  status: StatusId | null;
  talker: boolean;
}

export function profileOf(t: Tally): Profile {
  const total = Object.values(t.elements).reduce((a, b) => a + (b ?? 0), 0);
  const element = top(t.elements);
  return { element, share: element && total ? (t.elements[element] ?? 0) / total : 0, status: top(t.statuses), talker: t.talks >= Math.max(3, t.hits * 0.15) };
}

/** Deeds from a finished card battle. */
export function deedsFromBattle(state: BattleState, day: number, place: string, foeIdOf: (monsterId: string) => string, tally?: Tally): Deed[] {
  const enemies = state.combatants.filter((c) => c.side === "enemy");
  const out: Deed[] = [];
  const method = tally ? (top(tally.elements) ?? undefined) : undefined;
  if (state.outcome !== "victory") {
    const lead = enemies[0];
    if (lead) out.push({ day, kind: "lost_to", target: foeIdOf(lead.defId ?? lead.id), name: lead.name, place });
    return out;
  }
  const groups = new Map<string, Deed>();
  for (const c of enemies) {
    const kind: DeedKind | null = c.left === "surrender" ? "spared" : c.left === "recruit" ? "recruited" : c.left === "bargain" ? "bargained" : !c.alive ? "killed" : null;
    if (!kind) continue;
    const id = foeIdOf(c.defId ?? c.id);
    const key = `${kind}:${id}`;
    const g = groups.get(key);
    if (g) g.n = (g.n ?? 1) + 1;
    else groups.set(key, { day, kind, target: id, name: c.name, n: 1, place, ...(kind === "killed" && method ? { method } : {}) });
  }
  out.push(...groups.values());
  return out;
}

/** Deeds from a finished Parley with someone on the card: the outcome, and how you spoke. */
export function deedsFromParley(castId: string, name: string, end: string, tactics: readonly string[], bluffed: boolean, day: number, place?: string): Deed[] {
  const out: Deed[] = [];
  const at = place ? { place } : {};
  const kind: DeedKind | null = end === "won" ? "won_over" : end === "deal" ? "deal" : end === "walked" ? "walked" : end === "refused" ? "refused" : null;
  if (kind) out.push({ day, kind, target: castId, name, ...at });
  if (bluffed || tactics.includes("bluff")) out.push({ day, kind: "lied_to", target: castId, name, ...at });
  if (tactics.filter((t) => t === "threat").length) out.push({ day, kind: "threatened", target: castId, name, ...at });
  if (tactics.some((t) => t === "flattery" || t === "empathy" || t === "humor")) out.push({ day, kind: "charmed", target: castId, name, ...at });
  if (tactics.includes("bribe")) out.push({ day, kind: "bribed", target: castId, name, ...at });
  return out;
}

/* --------------------------- faction adaptation ------------------------ */

export interface Adaptation {
  foe: string;
  /** Resist this element from now on (and lose a weakness to it). */
  resist?: Element;
  /** Shake off this status with a cleanse. */
  cleanse?: StatusId;
  rumor: string;
  day: number;
}

/** Hurt this much before a group adapts; at most this many countermeasures each. */
export const ADAPT_AFTER = 6;
export const ADAPT_BUDGET = 2;

const RESIST_RUMOR: Record<Element, string> = {
  physical: "have taken to wearing heavier mail",
  fire: "have started carrying wet hides and buckets of sand",
  frost: "are wearing furs lined with ember-stones",
  storm: "have started grounding themselves with copper chains",
  water: "have oiled their gear against the wet",
  earth: "are bracing their stances, hard to knock down",
  light: "have started wearing smoked-glass visors",
  shadow: "carry lanterns everywhere they go now",
  blood: "have taken to wearing salt-iron charms",
};
const CLEANSE_RUMOR: Partial<Record<StatusId, string>> = {
  bleed: "carry field dressings now, and know how to use them",
  burn: "keep water close at hand",
  poison: "have been buying antidotes by the crate",
  frost: "drink something hot and fierce before a fight",
  fear: "have a new chaplain steadying their nerve",
  stun: "have learned to roll with a blow",
};

const plural = (name: string) => (/s$/i.test(name) ? name : `${name}s`);

/**
 * Who adapts tonight: each group you have killed at least ADAPT_AFTER of
 * gets one new countermeasure against your favourite element (or the status
 * you lean on), up to its budget. Returns only the new ones.
 */
export function adaptations(deeds: readonly Deed[], have: Record<string, Adaptation[]>, profile: Profile, day: number): Adaptation[] {
  const hurt = new Map<string, { n: number; name: string }>();
  for (const d of deeds) if (d.kind === "killed") hurt.set(d.target, { n: (hurt.get(d.target)?.n ?? 0) + (d.n ?? 1), name: d.name });
  const out: Adaptation[] = [];
  for (const [foe, { n, name }] of hurt) {
    const already = have[foe] ?? [];
    if (n < ADAPT_AFTER * (already.length + 1) || already.length >= ADAPT_BUDGET) continue;
    const resisted = new Set(already.map((a) => a.resist).filter(Boolean));
    const cleansed = new Set(already.map((a) => a.cleanse).filter(Boolean));
    const who = `The ${plural(name).replace(/^the\s+/i, "")}`;
    if (profile.element && profile.share >= 0.4 && !resisted.has(profile.element)) {
      out.push({ foe, resist: profile.element, rumor: `${who} ${RESIST_RUMOR[profile.element]}.`, day });
    } else if (profile.status && !cleansed.has(profile.status)) {
      out.push({ foe, cleanse: profile.status, rumor: `${who} ${CLEANSE_RUMOR[profile.status] ?? `have learned to shake off ${profile.status}`}.`, day });
    }
  }
  return out;
}

/** Foes as they stand today: resistances added, weaknesses to those removed. */
export function adaptFoes(foes: readonly SheetFoe[], have: Record<string, Adaptation[]>): SheetFoe[] {
  return foes.map((f) => {
    const list = have[f.id];
    if (!list?.length) return f;
    const resist = list.map((a) => a.resist).filter((e): e is Element => !!e);
    return { ...f, resists: [...new Set([...f.resists, ...resist])].slice(0, 4), weakTo: f.weakTo.filter((e) => !resist.includes(e)) };
  });
}

/** A monster that learned to shake a status off gets a cleanse it can use. */
export function adaptMonster(def: MonsterDef, list: readonly Adaptation[] | undefined): MonsterDef {
  const status = list?.find((a) => a.cleanse)?.cleanse;
  if (!status) return def;
  const skill = solveSkill({ id: `${def.id}_shake`, name: "Shake it off", flavor: `Learned the hard way against ${status}.`, target: "self", tier: 1, atoms: [{ op: "cleanse", count: 1, self: true }], cost: { focus: 0, cooldown: 3 } });
  return { ...def, skills: [...def.skills, skill] };
}

export const isElementId = (s: string): s is Element => (ELEMENTS as readonly string[]).includes(s);
export const isStatusId = (s: string): s is StatusId => (STATUS_IDS as readonly string[]).includes(s);

/* ------------------------------ NPC memory ----------------------------- */

export interface NpcMemory {
  notes: { day: number; text: string; tone: -1 | 0 | 1 }[];
  /** -10..10. Companions' affinity; for everyone else, how warm they are toward you. */
  affinity: number;
}

const TONE: Partial<Record<DeedKind, { tone: -1 | 0 | 1; delta: number; text: (d: Deed, player: string) => string }>> = {
  won_over: { tone: 1, delta: 1, text: (d, p) => `${p} talked them round on day ${d.day}` },
  deal: { tone: 0, delta: 0.5, text: (d, p) => `struck a deal with ${p} on day ${d.day}` },
  walked: { tone: -1, delta: -0.5, text: (d, p) => `${p} walked away from them on day ${d.day}` },
  refused: { tone: -1, delta: -0.5, text: (d, p) => `refused ${p} on day ${d.day}` },
  lied_to: { tone: -1, delta: -2, text: (d, p) => `${p} lied to them on day ${d.day}` },
  threatened: { tone: -1, delta: -1.5, text: (d, p) => `${p} threatened them on day ${d.day}` },
  charmed: { tone: 1, delta: 0.75, text: (d, p) => `${p} was kind to them on day ${d.day}` },
  caught: { tone: -1, delta: -1, text: (d, p) => `caught ${p} at it on day ${d.day}: ${d.method ?? "something they tried"}` },
  bribed: { tone: 0, delta: 0.25, text: (d, p) => `${p} paid them off on day ${d.day}` },
};

/** Fold new deeds into what people remember. Only deeds done to someone on the card count. */
export function remember(mem: Record<string, NpcMemory>, deeds: readonly Deed[], castIds: ReadonlySet<string>, player: string): Record<string, NpcMemory> {
  const out: Record<string, NpcMemory> = Object.fromEntries(Object.entries(mem).map(([k, v]) => [k, { notes: [...v.notes], affinity: v.affinity }]));
  for (const d of deeds) {
    const rule = TONE[d.kind];
    if (!rule || !castIds.has(d.target)) continue;
    const m = (out[d.target] ??= { notes: [], affinity: 0 });
    m.notes = [...m.notes, { day: d.day, text: rule.text(d, player || "You"), tone: rule.tone }].slice(-8);
    m.affinity = Math.max(-10, Math.min(10, m.affinity + rule.delta));
  }
  return out;
}

/**
 * How much the deeds could move a companion either way: mercy counts more
 * than one kill, and a big fight is capped so one battle never swings a bond.
 */
export function reactionWeight(deeds: readonly Deed[]): number {
  let w = 0;
  for (const d of deeds) {
    if (d.kind === "spared" || d.kind === "recruited" || d.kind === "bargained") w += 0.5;
    if (d.kind === "killed") w += 0.1 * (d.n ?? 1);
  }
  return Math.min(1.5, w);
}

/**
 * Companions with warm hearts like mercy and dislike slaughter of those who
 * would talk. `judged` (-1, 0, 1 per companion id, from a Decision model that
 * read who they are: backend/senses.ts) replaces the warmth rule for them.
 */
export function companionsReact(mem: Record<string, NpcMemory>, deeds: readonly Deed[], companions: { id: string; warmth: number }[], judged: Readonly<Record<string, number>> = {}): Record<string, NpcMemory> {
  const out = { ...mem };
  for (const c of companions) {
    let delta = 0;
    if (c.id in judged) delta = Math.sign(judged[c.id]!) * reactionWeight(deeds);
    else
      for (const d of deeds) {
        if (d.kind === "spared" || d.kind === "recruited") delta += c.warmth >= 3 ? 0.5 : c.warmth <= 1 ? -0.25 : 0.25;
        if (d.kind === "killed") delta += c.warmth >= 3 ? -0.1 * (d.n ?? 1) : c.warmth <= 1 ? 0.1 * (d.n ?? 1) : 0;
      }
    if (!delta) continue;
    const m = out[c.id] ?? { notes: [], affinity: 0 };
    out[c.id] = { notes: m.notes, affinity: Math.max(-10, Math.min(10, Math.round((m.affinity + delta) * 100) / 100)) };
  }
  return out;
}

/** Affinity at which a companion unlocks a combo skill and their personal quest. */
export const BOND_AT = 5;

/* -------------------------------- Notice ------------------------------- */

const STOP = new Set(
  "I You He She They We It The A An And But Or So Then When What Where Who Why How This That These Those My Your His Her Their Our Its Yes No Oh Ah Well Okay OK Hey Hi Hello Please Thanks Thank Sir Madam Lady Lord Mr Mrs Ms Miss Doctor Dr Captain Just Maybe Now Not Still Even Also Here There Today Tomorrow Yesterday Monday Tuesday Wednesday Thursday Friday Saturday Sunday God Gods".split(" "),
);

/**
 * Entities a message mentions: known ones by name, and unknown proper names
 * (capitalised words not at the start of a sentence). Keys are
 * `cast:<id>`, `place:<id>`, `name:<Name>`.
 */
export function mentions(text: string, known: { key: string; name: string }[], skip: readonly string[] = []): string[] {
  const out = new Set<string>();
  const low = ` ${text.toLowerCase().replace(/[^a-z0-9' ]+/g, " ")} `;
  for (const k of known) {
    const first = k.name.toLowerCase().replace(/^the\s+/, "").split(/\s+/)[0] ?? "";
    const full = k.name.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9' ]+/g, " ").trim();
    if ((full.length > 2 && low.includes(` ${full} `)) || (first.length > 3 && k.key.startsWith("cast:") && low.includes(` ${first} `))) out.add(k.key);
  }
  const skipLow = new Set([...skip, ...known.map((k) => k.name)].flatMap((s) => s.toLowerCase().split(/\s+/)));
  const re = /(^|[^.!?"“\n]\s)([A-Z][a-z']{2,}(?:\s+[A-Z][a-z']{2,})?)/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const name = m[2]!;
    const words = name.split(/\s+/);
    if (words.some((w) => STOP.has(w) || skipLow.has(w.toLowerCase()))) continue;
    out.add(`name:${name}`);
  }
  return [...out];
}

/** Points per kind of attention. */
export const NOTICE = { mention: 1, visit: 1, talk: 2, search: 1 } as const;
export const PROMOTE_AT = 6;
export const MAX_PROMOTIONS = 3;

export interface QuestStep {
  text: string;
  /** The place where Looking around completes it. */
  where: string;
  done: boolean;
}

export interface Promotion {
  /** The entity key that was promoted. */
  key: string;
  /** The cast id of the person (promoted names join the chat's cast). */
  castId: string | null;
  name: string;
  dossier: string;
  steps: QuestStep[];
  item: { name: string; description: string };
  /** A sub-location added for them, if any. */
  placeId?: string;
  day: number;
  done: boolean;
}

/** Whose interest crossed the line and can be promoted now (cap on active promotions). */
export function readyToPromote(interest: Record<string, number>, promoted: readonly Promotion[], skip: ReadonlySet<string> = new Set()): string[] {
  const active = promoted.filter((p) => !p.done).length;
  if (active >= MAX_PROMOTIONS) return [];
  const taken = new Set(promoted.map((p) => p.key));
  return Object.entries(interest)
    .filter(([k, v]) => v >= PROMOTE_AT && !taken.has(k) && !skip.has(k))
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_PROMOTIONS - active)
    .map(([k]) => k);
}

/* ------------------------------- recruits ------------------------------ */

export interface Recruit {
  id: string;
  name: string;
  /** The foe kind they were (for art and their class). */
  foe: string;
  look: string;
  role: string;
  day: number;
}

export const MAX_PARTY = 4;

/** The card's warmth tier of a cast member, for how they react. */
export const warmthOf = (sheet: Pick<CardSheet, "cast">, id: string): number => sheet.cast.find((c) => c.id === id)?.temperament?.warmth ?? 2;
