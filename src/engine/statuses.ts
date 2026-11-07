/**
 * The status library. Every status's rules live here as data plus a few
 * small functions; the battle loop asks this module what a status does.
 */
import type { StatusId } from "./types.js";

export interface StatusRule {
  name: string;
  /** "dot" ticks damage at the bearer's turn start; "hot" heals. */
  kind: "dot" | "hot" | "flag" | "modifier";
  /** Max stacks. */
  maxStacks: number;
  /** Default turns when applied without a duration. */
  turns: number;
  /** Percent of max HP per stack per tick (dot/hot). */
  pctPerStack?: number;
  /** Budget value of one stack for the default duration (budget solver). */
  value: number;
  /** Is it good for the bearer (cleanse removes only bad ones). */
  good: boolean;
  text: string;
}

export const STATUS_RULES: Record<StatusId, StatusRule> = {
  bleed:      { name: "Bleed",      kind: "dot", maxStacks: 5, turns: 3, pctPerStack: 3, value: 6, good: false, text: "Loses 3% max HP per stack each turn." },
  burn:       { name: "Burn",       kind: "dot", maxStacks: 3, turns: 2, pctPerStack: 5, value: 7, good: false, text: "Loses 5% max HP per stack each turn." },
  poison:     { name: "Poison",     kind: "dot", maxStacks: 5, turns: 5, pctPerStack: 2, value: 5, good: false, text: "Loses 2% max HP per stack each turn; lingers." },
  frost:      { name: "Frost",      kind: "modifier", maxStacks: 3, turns: 3, value: 5, good: false, text: "Turns come 15% slower per stack; at 3 stacks, frozen solid (stunned)." },
  stun:       { name: "Stun",       kind: "flag", maxStacks: 1, turns: 1, value: 14, good: false, text: "Loses its next turn." },
  fear:       { name: "Fear",       kind: "modifier", maxStacks: 1, turns: 2, value: 7, good: false, text: "Deals 20% less damage; 30% chance to freeze up." },
  mark:       { name: "Mark",       kind: "modifier", maxStacks: 1, turns: 3, value: 5, good: false, text: "Takes 20% more damage." },
  vulnerable: { name: "Vulnerable", kind: "modifier", maxStacks: 1, turns: 2, value: 7, good: false, text: "Takes 25% more damage." },
  weaken:     { name: "Weaken",     kind: "modifier", maxStacks: 1, turns: 2, value: 7, good: false, text: "Deals 25% less damage." },
  guarded:    { name: "Guarded",    kind: "modifier", maxStacks: 1, turns: 2, value: 7, good: true,  text: "Takes 30% less damage." },
  regen:      { name: "Regen",      kind: "hot", maxStacks: 3, turns: 3, pctPerStack: 5, value: 7, good: true, text: "Heals 5% max HP per stack each turn." },
  haste:      { name: "Haste",      kind: "modifier", maxStacks: 1, turns: 3, value: 8, good: true,  text: "Turns come 25% sooner." },
  slow:       { name: "Slow",       kind: "modifier", maxStacks: 1, turns: 3, value: 6, good: false, text: "Turns come 30% later." },
  taunt:      { name: "Taunt",      kind: "flag", maxStacks: 1, turns: 2, value: 4, good: false, text: "Must target whoever taunted it." },
  silence:    { name: "Silence",    kind: "flag", maxStacks: 1, turns: 2, value: 9, good: false, text: "Can only use its basic attack." },
};

export const statusName = (id: StatusId): string => STATUS_RULES[id].name;
