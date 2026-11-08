/**
 * A story beat: one line the player wrote in the scene, and what code made of it.
 *
 * The player's words stand. A model only reads what the line attempts and how hard that is;
 * code rolls, and a failed roll changes the fallout, never what the player wrote. No beat can
 * grant anything by itself: a claim in the line ("and he gave me his crown") is an attempt at
 * most, and the only effects are the bounded ones in `resolveBeat`.
 */
import { d20Tier, rollD20, seededRng } from "../dice.js";
import type { Tier } from "../card/types.js";
import type { SocialStat } from "../parley/types.js";

export type BeatTier = "crit_success" | "success" | "partial" | "fail" | "crit_fail";

/** What the judge says about a line. Out-of-range answers are cleaned up by `meaning/story.ts`. */
export interface BeatRead {
  /** Is the outcome uncertain and does it matter? Most lines: no, and nothing is rolled. */
  stakes: boolean;
  /** What is being attempted, in a few words. */
  attempt: string;
  stat: SocialStat;
  /** 0 easy, 1 fair, 2 hard, 3 very hard. */
  difficulty: 0 | 1 | 2 | 3;
  /** The cast id of who this is done to or kept from, if they are here. */
  target: string | null;
}

export interface BeatRoll {
  natural: number;
  add: number;
  target: number;
  tier: BeatTier;
}

export interface BeatResult {
  roll: BeatRoll | null;
  /** What the narrator must make true. Empty without a roll. */
  fallout: string;
  /** Whoever noticed now remembers it. */
  caughtBy: string | null;
  /** Lost from the party's strength, 0-1. */
  vigorLoss: number;
}

const TARGETS = [9, 12, 15, 18] as const;
const PARTIAL = 3;

const FALLOUT: Record<BeatTier, string> = {
  crit_success: "It goes better than they could have hoped, and nobody suspects a thing.",
  success: "It works, with no cost.",
  partial: "It works, but at a small cost or complication: something is left behind, or takes longer, or someone is half aware.",
  fail: "What they wrote still happened, but it did not go unnoticed or unpunished: someone saw, or something went wrong because of it. Show that consequence now.",
  crit_fail: "What they wrote still happened, but it goes badly: they are caught in the act or hurt by it, and it will not be forgotten.",
};

export function resolveBeat(seed: string, index: number, read: BeatRead, social: Record<SocialStat, Tier>): BeatResult {
  if (!read.stakes) return { roll: null, fallout: "", caughtBy: null, vigorLoss: 0 };
  const natural = rollD20(seededRng(`${seed}:beat:${index}`));
  const add = social[read.stat] ?? 0;
  const target = TARGETS[read.difficulty];
  const tier = d20Tier(natural, add, target, PARTIAL);
  const failed = tier === "fail" || tier === "crit_fail";
  return {
    roll: { natural, add, target, tier },
    fallout: `${read.attempt}: ${FALLOUT[tier]}`,
    caughtBy: failed ? read.target : null,
    vigorLoss: tier === "crit_fail" ? 0.1 : 0,
  };
}

/** The small line shown with a beat. */
export function rollLine(attempt: string, r: BeatRoll): string {
  const word = { crit_success: "great success", success: "success", partial: "partly", fail: "failed", crit_fail: "badly failed" }[r.tier];
  return `${attempt}: ${r.natural + r.add} vs ${r.target}, ${word}`;
}
