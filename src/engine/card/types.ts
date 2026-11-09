/**
 * The Card Sheet: what Gambit read from the selected card (docs/DESIGN.md
 * 4.0). The Architect proposes it; code validates it, checks every quote
 * against the sources, and sizes every number. Nothing here is a number a
 * model chose: models pick tiers (0..4), code turns tiers into stats.
 */
import type { Mood, SocialStat, Tactic } from "../parley/types.js";
import type { FaceSet } from "./faces.js";
import type { SheetFoe } from "./foes.js";
import type { CardKit } from "./kits.js";

export type ModuleId = "parley" | "encounters" | "places" | "delves" | "kits" | "economy";
export const MODULES: readonly ModuleId[] = ["parley", "encounters", "places", "delves", "kits", "economy"];

export type ShapeId = "scene" | "town" | "journey" | "frontier" | "delve";
export const SHAPES: readonly ShapeId[] = ["scene", "town", "journey", "frontier", "delve"];

/** Where a piece of the sheet came from, in canon order (4.0). */
export type SourceKind = "card" | "lore" | "persona" | "chat" | "gambit";

/** 0 very low, 1 low, 2 middling, 3 high, 4 very high. */
export type Tier = 0 | 1 | 2 | 3 | 4;

export interface Evidence {
  source: SourceKind;
  /** The span the model quoted (empty for Gambit's own additions). */
  quote: string;
  /** Code found the quote in the sources. Unverified quotes count as Gambit-added. */
  verified: boolean;
}

export interface CastMember {
  id: string;
  name: string;
  role: string;
  pronoun: "she" | "he" | "they";
  voice: string;
  /** Visual description, for portraits when the card has no art of them. */
  look: string;
  /** The card's own character (or a group member) rather than someone it mentions. */
  main: boolean;
  /** Lumiverse character id when this person is a card. */
  characterId?: string;
  /** The card's avatar, the canonical image of this person (4.0). */
  avatarImageId?: string | null;
  avatarUrl?: string | null;
  /** Art the user already has of this person: sprites, a group, Risu assets, a library card (faces.ts). */
  faces?: FaceSet;
  temperament: { warmth: Tier; pride: Tier; greed: Tier; fear: Tier };
  wants: string[];
  fears: string[];
  respects: string[];
  despises: string[];
  likesTactics: Tactic[];
  hatesTactics: Tactic[];
  insight: Tier;
  patience: Tier;
  tells: Partial<Record<Mood, string>>;
  evidence: Evidence;
}

export interface SheetFact {
  id: string;
  /** What is true, in the narrator's words. */
  text: string;
  /** How a speaker would bring it up. */
  claim: string;
  /** Cast ids it is about (pressure on them). */
  about: string[];
  /** 1 minor, 2 real pressure, 3 damning. */
  weight: 1 | 2 | 3;
  /** Rules-only fallback words (any group matching all its words). */
  keywords: string[][];
  /** The player has already met this in the greeting, the chat, or their persona. */
  known: boolean;
  evidence: Evidence;
}

export interface SheetPlace {
  id: string;
  name: string;
  description: string;
  evidence: Evidence;
}

/** The names of things on this card (4.0, genre skin). The engine underneath does not change. */
export interface GenreSkin {
  genre: string;
  currency: string;
  stats: Record<SocialStat, string>;
  /** What a fight is called here: "duel", "firefight", "court case". */
  fight: string;
}

export interface PlayerSheet {
  personaId: string | null;
  name: string;
  /** Who they are, one line, from the persona. */
  concept: string;
  social: Record<SocialStat, Tier>;
  /** The player changed it in the review: a re-read keeps their numbers. */
  edited: boolean;
}

export interface CardSheet {
  v: 1;
  /** Character id, or the sorted member ids of a group chat. */
  cardKey: string;
  characterIds: string[];
  cardName: string;
  /** Newest `updated_at` of the cards read, to notice edits. */
  cardUpdatedAt: number;
  readAt: number;
  by: "architect" | "fallback";
  premise: string;
  tone: string;
  skin: GenreSkin;
  cast: CastMember[];
  facts: SheetFact[];
  places: SheetPlace[];
  modules: Record<ModuleId, boolean>;
  /** The player switched modules by hand: a re-read keeps their choice. */
  modulesEdited?: boolean;
  shape: ShapeId;
  player: PlayerSheet;
  /** Things the reader could not do, shown in the review. */
  notes: string[];
  /** When the cast's existing art was last looked up (card-faces.ts). */
  facesAt?: number;
  /** The card's enemies and the party's kits (meaning/armory.ts), read the first time a fight is needed. */
  foes?: SheetFoe[];
  kits?: CardKit[];
  armoryBy?: "architect" | "fallback";
}

/* ------------------------------ sources ------------------------------ */

export interface SourceCard {
  id: string;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMes: string;
  alternateGreetings: string[];
  mesExample: string;
  creatorNotes: string;
  tags: string[];
  imageId: string | null;
  avatarUrl: string | null;
  updatedAt: number;
}

export interface SourceLore {
  /** Entry comment or first key, to label it. */
  title: string;
  content: string;
  scope: "card" | "persona" | "chat" | "global";
  /** The entry's trigger keys (primary and secondary), for ranking and lookup. */
  keys?: string[];
  /** Always-on in the host's prompt. */
  constant?: boolean;
  /** The host has it active in this chat right now (keyword or vector match). */
  active?: boolean;
  /** The book's own order, lower first. */
  order?: number;
  /** The book it is from, for the vector cache. */
  bookId?: string;
  /** How close it is in meaning to the chat, 0..1 (meaning/lore-vectors.ts semanticScores), when the user has an embedding model. */
  semantic?: number;
}

export interface SourceMessage {
  name: string;
  isUser: boolean;
  content: string;
}

/** Everything the Card Reader may read, already fetched and with macros resolved. */
export interface CardSources {
  cards: SourceCard[];
  persona: { id: string | null; name: string; title: string; description: string };
  lore: SourceLore[];
  chat: SourceMessage[];
}

/* ------------------------------ scenes ------------------------------- */

/** The shape of one contest, framed from the scene (4.0: shape from the model, size from code). */
export interface ContestFrame {
  castId: string;
  kind: "haggle" | "persuade" | "intimidate" | "deceive" | "seduce" | "interrogate";
  /** What is at stake: "passage upriver", "the late shift". */
  stake: string;
  /** 1 small, 2 real, 3 big, 4 huge. */
  stakeSize: 1 | 2 | 3 | 4;
  /** Haggle: the asking price, if one was named. */
  price: number | null;
  unit: string | null;
  setting: string;
  opening: string;
  /** How they talk, read off the story, for someone the card never gave a voice. */
  voice?: string;
  /** Winning this bears on the story's central thread. */
  aboutThread?: boolean;
  by: "architect" | "fallback";
}

/** A contest the roleplay just set up, offered as a chip under the reply (4.0). */
export interface ContestChip {
  id: string;
  chatId: string;
  messageId: string;
  castId: string;
  castName: string;
  kind: ContestFrame["kind"];
  label: string;
  p: number;
}
