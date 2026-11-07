/**
 * Text harness: play a battle in the terminal with no models and no art
 * (milestone M0: "the game is fun with no models at all").
 *   bun run play                       # the boss, interactive
 *   bun run play docks_ambush seed42   # another encounter / seed
 *   bun run play salt_choir x --auto   # watch the AI play both sides
 */
import { createInterface } from "node:readline/promises";
import { actAndAdvance, advance, legalActions, timeline } from "../src/engine/battle.js";
import { chooseAction } from "../src/engine/ai.js";
import { ENCOUNTERS, startEncounter } from "../src/engine/content/index.js";
import { statusName } from "../src/engine/statuses.js";
import type { BattleEvent, BattleState, Combatant } from "../src/engine/types.js";

const [encounterId = "drowned_shrine", seed = String(Date.now()), flag] = process.argv.slice(2);
const auto = flag === "--auto" || process.argv.includes("--auto");
if (!ENCOUNTERS[encounterId]) {
  console.error(`Unknown encounter. Try: ${Object.keys(ENCOUNTERS).join(", ")}`);
  process.exit(1);
}

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

const bar = (v: number, max: number, w = 14) => {
  const n = max > 0 ? Math.round((v / max) * w) : 0;
  return "█".repeat(n) + dim("░".repeat(w - n));
};

function line(c: Combatant): string {
  if (!c.alive) return dim(`  ✝ ${c.name}`);
  const st = c.statuses.map((s) => `${statusName(s.id)}${s.stacks > 1 ? "×" + s.stacks : ""}(${s.turns})`).join(" ");
  const poise = c.maxPoise ? ` poise ${"◆".repeat(c.poise)}${dim("◇".repeat(c.maxPoise - c.poise))}${c.broken ? red(" BROKEN") : ""}` : "";
  const res = c.resource ? ` ${c.resource.name} ${c.resource.value}/${c.resource.max}` : "";
  const focus = c.side === "party" ? ` FP ${c.focus}/${c.maxFocus}` : "";
  const shield = c.shield ? ` +${c.shield}🛡` : "";
  return `  ${c.name.padEnd(22)} ${bar(c.hp, c.maxHp)} ${String(c.hp).padStart(3)}/${c.maxHp}${shield}${focus}${res}${poise} ${dim(st)}`;
}

function show(s: BattleState): void {
  console.log("");
  console.log(bold("Enemies"));
  for (const c of s.combatants.filter((x) => x.side === "enemy")) console.log(line(c));
  console.log(bold("Party"));
  for (const c of s.combatants.filter((x) => x.side === "party")) console.log(line(c));
  const names = timeline(s, 8).map((id) => s.combatants.find((c) => c.id === id)?.name.split(" ")[0] ?? id);
  console.log(dim(`Next: ${names.join(" › ")}`));
}

function narrate(s: BattleState, events: BattleEvent[]): void {
  const name = (id: string) => s.combatants.find((c) => c.id === id)?.name ?? id;
  for (const e of events) {
    switch (e.kind) {
      case "use": console.log(`${bold(name(e.actor))} uses ${yellow(e.name)}${e.signature ? " ✦" : ""}`); break;
      case "hit":
        if (e.absorbed) console.log(`   ${name(e.target)} ${green("absorbs")} the ${e.element}!`);
        else console.log(`   ${name(e.target)} takes ${red(String(e.amount))}${e.shieldTaken ? dim(` (+${e.shieldTaken} shielded)`) : ""}${e.crit ? yellow(" CRIT") : ""}${e.weak ? yellow(" WEAK") : ""}${e.resisted ? dim(" resisted") : ""}`);
        break;
      case "heal": if (e.amount > 0) console.log(`   ${name(e.target)} heals ${green(String(e.amount))}`); break;
      case "shield": console.log(`   ${name(e.target)} gains a ${e.amount} shield`); break;
      case "status_on": console.log(dim(`   ${name(e.target)}: ${statusName(e.status)}${e.stacks > 1 ? " ×" + e.stacks : ""}`)); break;
      case "status_tick": console.log(dim(`   ${name(e.target)} ${e.amount > 0 ? "suffers " + e.amount : "regains " + -e.amount} from ${statusName(e.status)}`)); break;
      case "break": console.log(red(`   ${name(e.target)} is BROKEN!`)); break;
      case "skip": console.log(dim(`${name(e.actor)} loses the turn (${e.reason}).`)); break;
      case "phase": console.log(red(bold(`\n   ${name(e.target)} transforms: ${e.name}!\n`))); break;
      case "defeat": console.log(red(`   ${name(e.target)} falls.`)); break;
      case "passive": console.log(dim(`   (${name(e.actor)}: ${e.name})`)); break;
      case "delay": console.log(dim(`   ${name(e.target)} is pushed back.`)); break;
      case "end": console.log(bold(`\n=== ${e.outcome.toUpperCase()} ===`)); break;
    }
  }
}

let state = startEncounter(encounterId, seed);
console.log(bold(`\n${ENCOUNTERS[encounterId].name}`) + dim(`  (seed ${seed})`));

if (auto) {
  const r = advance(state, { enemyPolicy: chooseAction, partyPolicy: chooseAction });
  narrate(r.state, r.events);
  show(r.state);
  process.exit(0);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
while (state.outcome === "ongoing" && state.active) {
  show(state);
  const me = state.combatants.find((c) => c.id === state.active)!;
  const options = legalActions(state, me.id);
  console.log(bold(`\n${me.name}'s turn`));
  options.forEach((o, i) => {
    const cost = [o.skill.cost?.focus ? `${o.skill.cost.focus} FP` : "", o.skill.cost?.resource ? `${o.skill.cost.resource} ${me.resource?.name}` : ""].filter(Boolean).join(", ");
    const label = `${i + 1}. ${o.skill.name}${o.skill.signature ? " ✦" : ""}${cost ? dim(` [${cost}]`) : ""}`;
    console.log(o.usable ? label : dim(`${label} — ${o.reason}`));
  });
  const pick = Number(await rl.question("> ")) - 1;
  const option = options[pick];
  if (!option?.usable) continue;
  let targets: string[] = [];
  if (option.targetSets.length > 1) {
    option.targetSets.forEach((set, i) => console.log(`  ${i + 1}. ${state.combatants.find((c) => c.id === set[0])?.name}`));
    const t = Number(await rl.question("target> ")) - 1;
    targets = option.targetSets[t] ?? option.targetSets[0];
  } else targets = option.targetSets[0] ?? [];
  const r = actAndAdvance(state, { actor: me.id, skill: option.skill.id, targets }, chooseAction);
  narrate(r.state, r.events);
  state = r.state;
}
show(state);
rl.close();
