/**
 * Content registry: classes, monsters, encounters, and the demo battle the
 * stage preview and the text harness start from.
 */
import { advance, createBattle } from "../battle.js";
import { chooseAction } from "../ai.js";
import type { BattleState } from "../types.js";
import { CLASSES } from "./classes.js";
import { MONSTERS } from "./monsters.js";

export { CLASSES } from "./classes.js";
export { MONSTERS } from "./monsters.js";

export interface EncounterDef {
  id: string;
  name: string;
  enemies: string[];
  boss?: boolean;
}

export const ENCOUNTERS: Record<string, EncounterDef> = {
  docks_ambush: { id: "docks_ambush", name: "Ambush on the Docks", enemies: ["drowned_thrall", "drowned_thrall", "hexed_hound"] },
  salt_choir: { id: "salt_choir", name: "The Salt Choir", enemies: ["saltwraith", "saltwraith", "lantern_moth"] },
  reef_shallows: { id: "reef_shallows", name: "Reef Shallows", enemies: ["reef_serpent", "drowned_thrall"] },
  ash_patrol: { id: "ash_patrol", name: "Ash Guard Patrol", enemies: ["ash_sergeant", "hexed_hound", "hexed_hound"] },
  drowned_shrine: { id: "drowned_shrine", name: "The Drowned Shrine", enemies: ["bell_acolyte", "lantern_moth"], boss: true },
};

export const DEFAULT_PARTY = ["duelist", "warden", "tidecaller"] as const;
export const DEFAULT_LEVEL = 5;

export function startEncounter(encounterId: string, seed: string, partyIds: readonly string[] = DEFAULT_PARTY, level = DEFAULT_LEVEL): BattleState {
  const enc = ENCOUNTERS[encounterId];
  if (!enc) throw new Error(`Unknown encounter ${encounterId}`);
  const state = createBattle({
    id: `${encounterId}:${seed}`,
    seed,
    party: partyIds.map((id) => ({ classDef: CLASSES[id], level })),
    enemies: enc.enemies.map((id) => ({ def: MONSTERS[id] })),
  });
  // Run enemy turns that come before the first party turn.
  return advance(state, { enemyPolicy: chooseAction }).state;
}

/** The battle the stage preview opens with. */
export function demoBattle(seed = "demo"): BattleState {
  return startEncounter("drowned_shrine", seed);
}
