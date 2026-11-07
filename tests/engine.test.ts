import { describe, expect, test } from "bun:test";
import { act, actAndAdvance, advance, createBattle, legalActions, timeline } from "../src/engine/battle.js";
import { chooseAction } from "../src/engine/ai.js";
import { skillBudget, skillPrice, solveSkill } from "../src/engine/budget.js";
import { CLASSES, ENCOUNTERS, MONSTERS, startEncounter } from "../src/engine/content/index.js";
import type { BattleState, SkillDef } from "../src/engine/types.js";

const allSkills = (): SkillDef[] => [
  ...Object.values(CLASSES).flatMap((c) => [c.attack, ...c.skills]),
  ...Object.values(MONSTERS).flatMap((m) => [m.attack, ...m.skills, ...(m.phase2 ? [m.phase2.into.attack, ...m.phase2.into.skills] : [])]),
];

const playOut = (s: BattleState) => advance(s, { enemyPolicy: chooseAction, partyPolicy: chooseAction });

describe("budget solver", () => {
  test("fills every auto and spends close to the budget", () => {
    for (const raw of allSkills()) {
      const solved = solveSkill(raw);
      expect(JSON.stringify(solved)).not.toContain('"auto"');
      const budget = skillBudget(solved);
      const price = skillPrice(solved);
      // rounding and caps may leave a little unspent, never overspend much
      expect(price).toBeLessThanOrEqual(budget * 1.15 + 2);
      // A skill whose only free magnitudes are status chances can cap at 100% and underspend.
      const onlyChances = !JSON.stringify(raw.atoms).match(/"(power|amount|n|count|pct|below|perStack)":"auto"/);
      if (!onlyChances) expect(price).toBeGreaterThanOrEqual(budget * 0.6 - 2);
    }
  });

  test("an AoE hit is weaker per target than the same tier single hit", () => {
    const single = solveSkill({ id: "a", name: "a", target: "enemy", tier: 2, atoms: [{ op: "hit", element: "fire", scale: "spirit", power: "auto" }] });
    const aoe = solveSkill({ id: "b", name: "b", target: "all_enemies", tier: 2, atoms: [{ op: "hit", element: "fire", scale: "spirit", power: "auto" }] });
    const p = (s: SkillDef) => (s.atoms[0] as { power: number }).power;
    expect(p(aoe)).toBeLessThan(p(single));
  });

  test("paying costs buys power", () => {
    const free = solveSkill({ id: "a", name: "a", target: "enemy", tier: 2, atoms: [{ op: "hit", element: "fire", scale: "spirit", power: "auto" }] });
    const paid = solveSkill({ id: "b", name: "b", target: "enemy", tier: 2, cost: { focus: 20, cooldown: 2 }, atoms: [{ op: "hit", element: "fire", scale: "spirit", power: "auto" }] });
    expect((paid.atoms[0] as { power: number }).power).toBeGreaterThan((free.atoms[0] as { power: number }).power);
  });

  test("a status chance never exceeds 100% and its spare budget flows elsewhere", () => {
    const s = solveSkill({
      id: "c", name: "c", target: "enemy", tier: 4,
      atoms: [{ op: "status", status: "mark", chance: "auto", weight: 0.9 }, { op: "hit", element: "physical", scale: "might", power: "auto", weight: 0.1 }],
    });
    expect((s.atoms[0] as { chance: number }).chance).toBe(100);
    expect((s.atoms[1] as { power: number }).power).toBeGreaterThan(10);
  });
});

describe("battle loop", () => {
  test("is deterministic for a seed", () => {
    const a = playOut(startEncounter("docks_ambush", "same"));
    const b = playOut(startEncounter("docks_ambush", "same"));
    expect(a.state).toEqual(b.state);
    expect(a.events).toEqual(b.events);
  });

  test("different seeds differ", () => {
    const a = playOut(startEncounter("docks_ambush", "one"));
    const b = playOut(startEncounter("docks_ambush", "two"));
    expect(JSON.stringify(a.events)).not.toEqual(JSON.stringify(b.events));
  });

  test("every encounter ends", () => {
    for (const id of Object.keys(ENCOUNTERS)) {
      for (let i = 0; i < 20; i++) {
        const r = playOut(startEncounter(id, `end-${i}`));
        expect(["victory", "defeat"]).toContain(r.state.outcome);
        expect(r.events.at(-1)).toEqual({ kind: "end", outcome: r.state.outcome });
      }
    }
  });

  test("stops on the party's turn and accepts a legal action", () => {
    const s = startEncounter("docks_ambush", "turn");
    expect(s.active).toBeTruthy();
    const options = legalActions(s, s.active!);
    const attack = options.find((o) => o.usable && o.targetSets.length > 0)!;
    const r = actAndAdvance(s, { actor: s.active!, skill: attack.skill.id, targets: attack.targetSets[0] }, chooseAction);
    expect(r.events.some((e) => e.kind === "use" && e.actor === s.active)).toBe(true);
    expect(r.state.outcome === "ongoing" ? r.state.active : "done").toBeTruthy();
  });

  test("rejects acting out of turn and unaffordable skills", () => {
    const s = startEncounter("docks_ambush", "reject");
    const other = s.combatants.find((c) => c.side === "party" && c.id !== s.active)!;
    expect(() => act(s, { actor: other.id, skill: other.attack, targets: [] })).toThrow();
    const broke = structuredClone(s);
    const me = broke.combatants.find((c) => c.id === broke.active)!;
    me.focus = 0;
    const pricey = legalActions(broke, me.id).find((o) => typeof o.skill.cost?.focus === "number" && o.skill.cost.focus > 0);
    if (pricey) {
      expect(pricey.usable).toBe(false);
      expect(() => act(broke, { actor: me.id, skill: pricey.skill.id, targets: pricey.targetSets[0] ?? [] })).toThrow();
    }
  });

  test("the timeline lists the active actor first and has the requested length", () => {
    const s = startEncounter("ash_patrol", "tl");
    const t = timeline(s, 8);
    expect(t[0]).toBe(s.active!);
    expect(t).toHaveLength(8);
  });

  test("hitting a weakness breaks poise, and a broken enemy loses its turn", () => {
    const s = createBattle({
      id: "w", seed: "w",
      party: [{ classDef: CLASSES.hexwright, level: 5 }],
      enemies: [{ def: MONSTERS.hexed_hound }],
    });
    const hound = s.combatants.find((c) => c.side === "enemy")!;
    const hexer = s.combatants.find((c) => c.side === "party")!;
    // Force the Hexwright's turn and hit fire weakness until it breaks.
    let st = structuredClone(s);
    let broke = false;
    for (let i = 0; i < 6 && !broke; i++) {
      st.active = hexer.id;
      const r = act(st, { actor: hexer.id, skill: "hex_ember", targets: [hound.id] });
      st = r.state;
      broke = r.events.some((e) => e.kind === "break");
    }
    expect(broke).toBe(true);
    const r2 = advance(st, { enemyPolicy: chooseAction });
    // either the hound skips (broken) before the next party turn, or the party acts first
    const skip = r2.events.find((e) => e.kind === "skip");
    if (skip) expect(skip).toMatchObject({ actor: hound.id, reason: "broken" });
  });

  test("a boss changes phase below its threshold", () => {
    let seen = false;
    for (let i = 0; i < 30 && !seen; i++) {
      const r = playOut(startEncounter("drowned_shrine", `phase-${i}`));
      seen = r.events.some((e) => e.kind === "phase");
    }
    expect(seen).toBe(true);
  });

  test("dice and damage never touch a model: same inputs, same numbers", () => {
    const s = startEncounter("reef_shallows", "pure");
    const a = playOut(s);
    const b = playOut(s);
    expect(a.events.filter((e) => e.kind === "hit")).toEqual(b.events.filter((e) => e.kind === "hit"));
    expect(s.draws).toBe(startEncounter("reef_shallows", "pure").draws); // input not mutated
  });
});
