/**
 * Balance report: the default party fights every encounter N times with the
 * same AI on both sides (docs/DESIGN.md, 4.3 "Simulation check").
 *   bun run balance            # 300 runs each
 *   bun run balance 1000 hexwright,warden,tidecaller
 */
import { simulateEncounter } from "../src/engine/sim.js";
import { DEFAULT_PARTY, ENCOUNTERS } from "../src/engine/content/index.js";

const runs = Number(process.argv[2] ?? 300);
const party = process.argv[3]?.split(",") ?? [...DEFAULT_PARTY];
console.log(`party: ${party.join(", ")}  runs: ${runs}`);
for (const id of Object.keys(ENCOUNTERS)) {
  const r = simulateEncounter(id, runs, party);
  console.log(
    `${id.padEnd(16)} win ${(r.winRate * 100).toFixed(0).padStart(3)}%  rounds ${r.avgRounds.toFixed(1).padStart(5)}  party HP left ${(r.avgHpLeft * 100).toFixed(0).padStart(3)}%  deaths/fight ${r.avgDeaths.toFixed(2)}`,
  );
}
