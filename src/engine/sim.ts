/**
 * Headless auto-battler for balance checks. The same AI plays both sides,
 * so numbers compare encounters and skills, not player skill.
 */
import { advance } from "./battle.js";
import { chooseAction } from "./ai.js";
import { DEFAULT_PARTY, startEncounter } from "./content/index.js";

export interface SimReport {
  runs: number;
  winRate: number;
  /** Turns divided by the number of combatants: roughly "rounds". */
  avgRounds: number;
  /** Average party HP fraction left after a win. */
  avgHpLeft: number;
  avgDeaths: number;
}

export function simulateEncounter(encounterId: string, runs: number, party: readonly string[] = DEFAULT_PARTY, level?: number): SimReport {
  let wins = 0, rounds = 0, hpLeft = 0, deaths = 0;
  for (let i = 0; i < runs; i++) {
    const start = startEncounter(encounterId, `sim-${encounterId}-${i}`, party, level);
    const { state } = advance(start, { enemyPolicy: chooseAction, partyPolicy: chooseAction });
    const members = state.combatants.filter((c) => c.side === "party");
    rounds += state.turn / state.combatants.length;
    deaths += members.filter((c) => !c.alive).length;
    if (state.outcome === "victory") {
      wins++;
      hpLeft += members.reduce((n, c) => n + c.hp / c.maxHp, 0) / members.length;
    }
  }
  return { runs, winRate: wins / runs, avgRounds: rounds / runs, avgHpLeft: wins ? hpLeft / wins : 0, avgDeaths: deaths / runs };
}
