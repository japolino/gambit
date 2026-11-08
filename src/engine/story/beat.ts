/**
 * A story beat: one line the player wrote in the scene, and what code made of it.
 *
 * Writing is the input; the game's systems are where it goes. A model only reads what the line
 * attempts and how hard that is, and `routeBeat` sends it on: flavor passes a little time, a risky
 * line rolls, seeking rolls for something to find, pressing someone opens a Parley, violence opens
 * a fight, and going somewhere moves the scene. The player's words stand: a failed roll changes the
 * fallout, never what they wrote. No beat can grant anything by itself: a claim in the line ("and
 * he gave me his crown") is an attempt at most, and the only effects are the bounded ones here.
 */
import { d20Tier, rollD20, seededRng } from "../dice.js";
import type { Tier } from "../card/types.js";
import type { SocialStat } from "../parley/types.js";

export type BeatTier = "crit_success" | "success" | "partial" | "fail" | "crit_fail";
export type BeatRoute = "flavor" | "risk" | "seek" | "press" | "fight" | "travel";

/** What the judge says about a line. Out-of-range answers are cleaned up by `meaning/story.ts`. */
export interface BeatRead {
  /** Where the line goes. Most lines are flavor: nothing is rolled. */
  route: BeatRoute;
  /** What is being attempted, in a few words. */
  attempt: string;
  stat: SocialStat;
  /** 0 easy, 1 fair, 2 hard, 3 very hard. */
  difficulty: 0 | 1 | 2 | 3;
  /** The cast id of who this is done to or kept from, if they are here. */
  target: string | null;
  /** Travel: a known place's id, or "new" for somewhere the world doesn't have yet. */
  to: string | null;
}

/** What this card and scene can actually do with a line. A line whose system isn't there is a risk, or just flavor. */
export function routeBeat(read: BeatRead, can: { parley: boolean; encounters: boolean }): BeatRead {
  if (read.route === "press" && !(can.parley && read.target)) return { ...read, route: "risk" };
  if (read.route === "fight" && !can.encounters) return { ...read, route: "risk", stat: "menace" };
  if (read.route === "travel" && !read.to) return { ...read, route: "flavor" };
  return read;
}

/** Going off somewhere to fight isn't a fight with whoever's left behind, unless the line says so by name. */
export const fightTarget = (read: BeatRead, namedInLine: boolean): string | null => (read.target && (!read.to || namedInLine) ? read.target : null);

export interface BeatRoll {
  natural: number;
  add: number;
  target: number;
  tier: BeatTier;
}

export interface BeatResult {
  roll: BeatRoll | null;
  /** What the narrator must make true. Instructions for a model, never shown to the player. */
  fallout: string;
  /** The same result in plain words, for the player when no narrator can write it. */
  told: string;
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

const TOLD: Record<BeatTier, string> = {
  crit_success: "It goes better than you could have hoped.",
  success: "It works.",
  partial: "It works, but not cleanly.",
  fail: "It doesn't go unnoticed.",
  crit_fail: "It goes badly, and it won't be forgotten.",
};

const rolls = (route: BeatRoute) => route === "risk" || route === "seek";

export function resolveBeat(seed: string, index: number, read: BeatRead, social: Record<SocialStat, Tier>): BeatResult {
  if (!rolls(read.route)) return { roll: null, fallout: "", told: "", caughtBy: null, vigorLoss: 0 };
  const natural = rollD20(seededRng(`${seed}:beat:${index}`));
  const add = social[read.stat] ?? 0;
  const target = TARGETS[read.difficulty];
  const tier = d20Tier(natural, add, target, PARTIAL);
  const failed = tier === "fail" || tier === "crit_fail";
  return {
    roll: { natural, add, target, tier },
    fallout: `${read.attempt}: ${FALLOUT[tier]}`,
    told: TOLD[tier],
    caughtBy: failed ? read.target : null,
    vigorLoss: tier === "crit_fail" ? 0.1 : 0,
  };
}

/** Did this roll get what it went for? A partial success counts: it works, at a cost. */
export const beatWorked = (r: BeatRoll | null): boolean => !!r && (r.tier === "crit_success" || r.tier === "success" || r.tier === "partial");

/** The small line shown with a beat. */
export function rollLine(attempt: string, r: BeatRoll): string {
  const word = { crit_success: "great success", success: "success", partial: "partly", fail: "failed", crit_fail: "badly failed" }[r.tier];
  return `${attempt}: ${r.natural + r.add} vs ${r.target}, ${word}`;
}

/* ------------------------------- the clock ------------------------------ */

/** A thread has this many days, the first included. */
export const THREAD_DAYS = 3;
/** This much writing is one step of the day (morning to afternoon, and so on). */
export const CLOCK_STEP = 3;
const COST: Record<BeatRoute, number> = { flavor: 1, risk: 2, seek: 2, press: 0, fight: 0, travel: 0 };

/** What a line spends: how far the clock has run, and how many steps of the day that came to. */
export function spendClock(spent: number, route: BeatRoute): { spent: number; steps: number } {
  const total = spent + COST[route];
  return { spent: total % CLOCK_STEP, steps: Math.floor(total / CLOCK_STEP) };
}

export type ThreadEnd = "solved" | "lost";

/** Where a thread stands: over when all of it is found, or when its last day has passed. */
export function threadEnd(found: number, total: number, day: number, deadline: number): ThreadEnd | null {
  if (total > 0 && found >= total) return "solved";
  return day > deadline ? "lost" : null;
}
