/**
 * Parley: every contest of words (docs/DESIGN.md 4.1). The model never
 * decides an outcome. The Referee only *reads* an argument (typed answers
 * with probabilities); code turns that read into dice, rolls them from a
 * seed fixed per exchange, and moves the contest's track.
 */
import type { FaceSet } from "../card/faces.js";
import type { InlayLook } from "../card/inlay.js";

export type Tactic = "interest" | "logic" | "empathy" | "flattery" | "threat" | "bribe" | "bluff" | "humor" | "insult" | "nonsense";
export const TACTICS: readonly Tactic[] = ["interest", "logic", "empathy", "flattery", "threat", "bribe", "bluff", "humor", "insult", "nonsense"];

export type ContestKind = "haggle" | "persuade" | "intimidate" | "deceive" | "seduce" | "interrogate";
export type SocialStat = "presence" | "menace" | "guile";

/** Backfires, Weak, Plain, Good, Compelling (4.1.2 step 4). */
export type ArgumentTier = 0 | 1 | 2 | 3 | 4;
export const TIER_NAMES = ["Backfires", "Weak", "Plain", "Good", "Compelling"] as const;
/** Dice per tier: 3d20 keep lowest .. 3d20 keep highest. */
export const TIER_DICE = ["3d20kl1", "2d20kl1", "1d20", "2d20kh1", "3d20kh1"] as const;

export type ResultTier = "crit_success" | "success" | "partial" | "fail" | "crit_fail";

export type Mood = "moved" | "tempted" | "considering" | "unmoved" | "irritated" | "suspicious" | "confused" | "afraid" | "amused";

/** A true fact of the world. Knowing it (journal) turns a claim into Leverage. */
export interface Fact {
  id: string;
  /** What is true, in the narrator's words. */
  text: string;
  /** How a speaker would bring it up, for the Referee's "does the speech assert this?" question. */
  claim: string;
  /** Leverage it is worth when the player knows it (0-4). */
  leverage: number;
  /** Plain words that reveal it in speech (rules-only fallback). Any one group must match all its words. */
  keywords: string[][];
  /** Using it lowers the contest floor by this share of the range, once. */
  floorShift?: number;
}

export interface Stance {
  temperament: { warmth: number; pride: number; greed: number; fear: number };
  wants: string[];
  fears: string[];
  respects: string[];
  despises: string[];
  /** Tactics this person respects or despises outright (code nudges the tier by one). */
  likesTactics?: Tactic[];
  hatesTactics?: Tactic[];
  insight: number;
  patience: number;
  /** Body language per mood; the immersive read shows these. */
  tells: Partial<Record<Mood, string>>;
  secrets: { fact: string; leverage: number }[];
}

export interface NpcDef {
  id: string;
  name: string;
  /** "fishmonger at the Saltgate market" */
  role: string;
  pronoun: "she" | "he" | "they";
  /** How they talk, for the narrator. */
  voice: string;
  /** Portrait identity (NAI tags + a description for GPT Image). */
  look: { tags: string; description: string; sex: "girl" | "boy" | "other"; palette: string };
  stance: Stance;
}

/**
 * A contest's track. `value` moves from `start` toward `floor` (the best
 * the NPC can give). Leverage can push `floor` further. The player wins
 * when `value` reaches `winAt` (persuade-style contests) or takes a deal
 * (haggle).
 */
export interface ContestDef {
  kind: ContestKind;
  /** What the track measures, for the UI: "price", "resistance", "morale". */
  track: string;
  /** "a coil of tarred net"; "passage through the Salt Gate" */
  stake: string;
  unit?: string;
  start: number;
  floor: number;
  /** Lowest the floor can go with every lever pulled. */
  hardFloor: number;
  /** Persuade-style: reaching this wins. Haggle: absent (the player takes a deal). */
  winAt?: number;
  /** Base DC before the ask and rapport. */
  dc: number;
}

export interface Speaker {
  name: string;
  stats: Record<SocialStat, number>;
}

export interface ParleyScenario {
  id: string;
  name: string;
  blurb: string;
  /** Where it happens, for the narrator and the background. */
  setting: string;
  npc: NpcDef;
  contest: ContestDef;
  facts: Fact[];
  /** Fact ids in the player's journal at the start. */
  known: string[];
  speaker: Speaker;
  /** The NPC's first line, shown before any exchange. */
  opening: string;
  /** Facts written into the journal when the player wins. */
  reveals?: string[];
  /** Built from a Card Sheet (docs/DESIGN.md 4.0) rather than hand-written. */
  card?: {
    cardKey: string;
    castId: string;
    /** The journal this scene reads and writes: one per chat. */
    journalKey: string;
    /** The card's avatar: the NPC's canonical face. */
    avatar?: { imageId: string | null; url: string | null };
    /** Art the user has of this person, by Lumiverse image id; moods without one are drawn from `base`. */
    faces?: FaceSet;
    /** Inlay Illustrator's look for this person (tags, outfit, reference), when Inlay knows them. */
    inlay?: InlayLook;
  };
}

/** What the Referee (or its stand-ins) said about one argument. */
export interface RefereeRead {
  tactic: Tactic;
  tacticP: Partial<Record<Tactic, number>>;
  /** 0..3 expected level: how directly it touches this NPC's wants and fears. */
  fit: number;
  /** 0..3: coherent, specific, in character. */
  credibility: number;
  /** 0..4: 0 backfires on this person, 2 neutral, 4 exactly what moves them. */
  temperament: number;
  /** Probability the speech asserts each fact id. */
  asserts: Record<string, number>;
  /** Probability it asserts some other specific fact about the NPC (a possible bluff). */
  otherClaim: number;
  by: "jev" | "helper" | "rules";
}

export interface ExchangeRoll {
  /** The three die faces fixed for this exchange; the tier decides how many count and which. */
  faces: [number, number, number];
  notation: string;
  used: number[];
  natural: number;
  stat: SocialStat;
  statBonus: number;
  leverage: number;
  dc: number;
  total: number;
  result: ResultTier;
}

export interface BluffCheck {
  /** The fact the player claimed without knowing it, or null for an invented claim. */
  fact: string | null;
  face: number;
  guile: number;
  insight: number;
  caught: boolean;
}

export interface Exchange {
  index: number;
  text: string;
  read: RefereeRead;
  /** Tier from the read alone, then after likes/hates, repetition, and a caught bluff. */
  baseTier: ArgumentTier;
  tier: ArgumentTier;
  repetition: number;
  nonsense: boolean;
  /** Known facts the speech used (verified in code). */
  leverageFacts: string[];
  bluff: BluffCheck | null;
  /** A number the player named (haggle offers). */
  offer: number | null;
  roll: ExchangeRoll;
  before: { value: number; floor: number; patience: number; rapport: number };
  after: { value: number; floor: number; patience: number; rapport: number };
  mood: Mood;
  /** The contest ended with this exchange. */
  ended: ParleyEnd | null;
  /** Chat message that carries this exchange (set once it is posted). */
  messageId?: string;
  /** The NPC's narrated reply, once written (Gambit's narrator or the chat's). */
  reply?: string;
}

export type ParleyEnd = { kind: "won" } | { kind: "final_offer" } | { kind: "deal"; value: number } | { kind: "walked" } | { kind: "refused" };

export interface ParleyState {
  id: string;
  scenarioId: string;
  seed: string;
  /** The chat the narration goes to, if any. */
  chatId: string | null;
  value: number;
  floor: number;
  patience: number;
  rapport: number;
  /** Facts already used as Leverage (their floor shift applies once). */
  usedFacts: string[];
  /** Bluffs the NPC caught: remembered for the whole contest. */
  caughtBluffs: number;
  known: string[];
  exchanges: Exchange[];
  end: ParleyEnd | null;
}
