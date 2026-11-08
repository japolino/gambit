/**
 * Size from code (docs/DESIGN.md pillar 3 and 4.0): tiers a model picked
 * become stats, and a framed contest becomes a full Parley scenario with
 * start, floor, DC, and patience from tables. Pure and deterministic.
 */
import type { ContestDef, ContestKind, Fact, Mood, NpcDef, ParleyScenario, Speaker } from "../parley/types.js";
import type { CardSheet, CastMember, ContestFrame, SheetFact, Tier } from "./types.js";

const TEMPERAMENT = [0.1, 0.3, 0.5, 0.7, 0.9] as const;
const INSIGHT = [1, 1, 2, 3, 4] as const;
const PATIENCE = [2, 3, 4, 5, 6] as const;
/** Player social stat bonus per tier. */
const SOCIAL = [0, 1, 2, 3, 4] as const;

export const temperamentOf = (t: Tier): number => TEMPERAMENT[t];
export const insightOf = (t: Tier): number => INSIGHT[t];
export const patienceOf = (t: Tier): number => PATIENCE[t];
export const socialOf = (t: Tier): number => SOCIAL[t];

/** Leverage and floor shift per fact weight (shift only when the fact presses this NPC). */
const LEVERAGE = { 1: 1, 2: 2, 3: 3 } as const;
const FLOOR_SHIFT = { 1: 0, 2: 0.2, 3: 0.45 } as const;

/** Persuade-style tracks: what the meter measures, by kind. */
const TRACK: Record<ContestKind, string> = {
  haggle: "price",
  persuade: "resistance",
  intimidate: "nerve",
  deceive: "doubt",
  seduce: "reserve",
  interrogate: "silence",
};

/** How far talk alone goes, by stake size (persuade-style, on a 100 track): a small or real ask can be talked out of someone, a big one takes something on them. */
const FLOOR_BY_STAKE = { 1: 0, 2: 0, 3: 35, 4: 50 } as const;

const GENERIC_TELLS: Record<Mood, string> = {
  moved: "goes quiet for a moment",
  tempted: "hesitates, weighing it",
  considering: "thinks it over",
  unmoved: "doesn't budge",
  irritated: "frowns",
  suspicious: "narrows their eyes",
  confused: "looks at you blankly",
  afraid: "glances away, uneasy",
  amused: "almost smiles",
};

const STOP = new Set(
  "about after again against their there these those which while would could should being other every never always maybe really still with from into onto over under that this what when where have been were they them then than your yours just like very much some more most only also because".split(" "),
);

/** Rules-only words for a claim: its longer content words, one group each. */
export function keywordsFor(claim: string, given: string[][] = []): string[][] {
  const clean = given.map((g) => g.map((w) => w.toLowerCase().trim()).filter(Boolean)).filter((g) => g.length);
  if (clean.length) return clean.slice(0, 6);
  const words = claim
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 5 && !STOP.has(w));
  return [...new Set(words)].slice(0, 4).map((w) => [w]);
}

export function factFrom(f: SheetFact, targetId: string): Fact {
  const presses = f.about.includes(targetId);
  return {
    id: f.id,
    text: f.text,
    claim: f.claim,
    leverage: presses ? LEVERAGE[f.weight] : Math.max(1, LEVERAGE[f.weight] - 1),
    keywords: keywordsFor(f.claim, f.keywords),
    ...(presses && FLOOR_SHIFT[f.weight] ? { floorShift: FLOOR_SHIFT[f.weight] } : {}),
  };
}

export function speakerFrom(sheet: CardSheet): Speaker {
  const p = sheet.player;
  return { name: p.name || "you", stats: { presence: socialOf(p.social.presence), menace: socialOf(p.social.menace), guile: socialOf(p.social.guile) } };
}

export function npcFrom(sheet: CardSheet, c: CastMember): NpcDef {
  const tells: Partial<Record<Mood, string>> = { ...GENERIC_TELLS, ...c.tells };
  return {
    id: `${sheet.cardKey}:${c.id}`,
    name: c.name,
    role: c.role,
    pronoun: c.pronoun,
    voice: c.voice,
    look: { tags: c.look, description: c.look || `${c.name}, ${c.role}`, sex: c.pronoun === "she" ? "girl" : c.pronoun === "he" ? "boy" : "other", palette: "" },
    stance: {
      temperament: { warmth: temperamentOf(c.temperament.warmth), pride: temperamentOf(c.temperament.pride), greed: temperamentOf(c.temperament.greed), fear: temperamentOf(c.temperament.fear) },
      wants: c.wants,
      fears: c.fears,
      respects: c.respects,
      despises: c.despises,
      likesTactics: c.likesTactics,
      hatesTactics: c.hatesTactics,
      insight: insightOf(c.insight),
      patience: patienceOf(c.patience),
      tells,
      secrets: sheet.facts.filter((f) => !f.known && f.about.includes(c.id)).map((f) => ({ fact: f.id, leverage: LEVERAGE[f.weight] })),
    },
  };
}

/** Start, floor, DC, and patience of a framed contest, from tables. */
export function contestFrom(frame: ContestFrame, c: CastMember, currency: string): ContestDef {
  const prideStep = Math.round((c.temperament.pride - 2) / 2);
  const dc = Math.max(10, Math.min(17, 11 + frame.stakeSize + prideStep));
  if (frame.kind === "haggle") {
    const start = frame.price && frame.price > 0 ? Math.round(frame.price) : 100;
    const share = [0.66, 0.7, 0.74, 0.78, 0.82][c.temperament.greed];
    return { kind: "haggle", track: "price", stake: frame.stake, unit: frame.unit || currency || undefined, start, floor: Math.round(start * share), hardFloor: Math.round(start * 0.5), dc };
  }
  return { kind: frame.kind, track: TRACK[frame.kind], stake: frame.stake, start: 100, floor: FLOOR_BY_STAKE[frame.stakeSize], hardFloor: 0, winAt: 0, dc };
}

/**
 * What could matter in this talk: what is about this person or about nobody in
 * particular, and what is about someone they have to do with. Not every secret on the card.
 */
function factsFor(sheet: CardSheet, c: CastMember, frame: ContestFrame): SheetFact[] {
  const theirs = new Set([c.role, ...c.wants, ...c.fears, ...c.respects, ...c.despises, frame.stake].join(" ").toLowerCase().split(/[^\p{L}\p{N}]+/u));
  const tied = (id: string) => {
    const first = sheet.cast.find((m) => m.id === id)?.name.split(/\s+/)[0]?.toLowerCase();
    return !!first && theirs.has(first);
  };
  return sheet.facts.filter((f) => !f.about.length || f.about.includes(c.id) || f.about.some(tied));
}

const KIND_VERB: Record<ContestKind, string> = {
  haggle: "Haggle with",
  persuade: "Talk round",
  intimidate: "Lean on",
  deceive: "Fool",
  seduce: "Charm",
  interrogate: "Get the truth from",
};

export const chipLabel = (kind: ContestKind, name: string): string => `${KIND_VERB[kind]} ${name}?`;

/** A full Parley scenario for one cast member and one framed contest. */
export function scenarioFromSheet(sheet: CardSheet, frame: ContestFrame, chatId: string | null, sceneId: string, journal: string[]): ParleyScenario | null {
  const c = sheet.cast.find((m) => m.id === frame.castId);
  if (!c) return null;
  const relevant = factsFor(sheet, c, frame);
  const facts = relevant.map((f) => factFrom(f, c.id));
  const startsKnown = relevant.filter((f) => f.known).map((f) => f.id);
  const known = [...new Set([...startsKnown, ...journal.filter((id) => facts.some((f) => f.id === id))])];
  const contest = contestFrom(frame, c, sheet.skin.currency);
  // A wall has to be able to open: never higher than what's on this person can take down, or the talk could not be won at all.
  if (contest.winAt !== undefined) contest.floor = Math.min(contest.floor, Math.round(facts.reduce((sum, f) => sum + (f.floorShift ?? 0), 0) * (contest.start - contest.hardFloor)));
  const secrets = sheet.facts.filter((f) => !f.known && f.about.includes(c.id)).map((f) => f.id);
  return {
    id: sceneId,
    name: `${KIND_VERB[frame.kind]} ${c.name}`,
    blurb: frame.stake,
    setting: frame.setting || sheet.places[0]?.description || sheet.premise,
    npc: { ...npcFrom(sheet, c), voice: c.voice || frame.voice || "" },
    contest,
    facts,
    known,
    speaker: speakerFrom(sheet),
    opening: frame.opening || "…",
    reveals: secrets,
    card: {
      cardKey: sheet.cardKey,
      castId: c.id,
      journalKey: chatId ? `chat/${chatId}` : `card/${sheet.cardKey}`,
      avatar: c.avatarImageId || c.avatarUrl ? { imageId: c.avatarImageId ?? null, url: c.avatarImageId ? `/api/v1/images/${c.avatarImageId}` : (c.avatarUrl ?? null) } : undefined,
    },
  };
}
