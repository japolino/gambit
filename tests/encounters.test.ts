import { describe, expect, test } from "bun:test";
import { act, advance, createBattle, talkOptions } from "../src/engine/battle.js";
import { chooseAction } from "../src/engine/ai.js";
import { CLASSES } from "../src/engine/content/index.js";
import { baseClassFor, encounterFrom, fallbackFoes, foeFromCast, monsterFromFoe, parseFoe, partyFromSheet, type SheetFoe } from "../src/engine/card/foes.js";
import type { BattleState } from "../src/engine/types.js";

const ev = { source: "card" as const, quote: "", verified: false };
const foe = (over: Partial<SheetFoe> = {}): SheetFoe => ({ id: "imp", name: "Butcher Imp", look: "small red imp with a cleaver", role: "brute", tier: 2, element: "fire", weakTo: ["frost"], resists: ["fire", "shadow"], rig: "standing", talks: true, evidence: ev, ...over });

function battleOf(foes: SheetFoe[], seed = "s1"): BattleState {
  const enc = encounterFrom(foes, { seed })!;
  const s = createBattle({ id: enc.id, seed, party: [{ classDef: CLASSES.duelist!, level: 5 }, { classDef: CLASSES.warden!, level: 5 }], enemies: enc.foes.map((f) => ({ def: f.def })) });
  return advance(s, { enemyPolicy: chooseAction }).state;
}

describe("foes from the card", () => {
  test("code sizes a foe from its role and tier; the model never picks a number", () => {
    const low = monsterFromFoe(foe({ tier: 1 }));
    const high = monsterFromFoe(foe({ tier: 4 }));
    expect(high.hp).toBeGreaterThan(low.hp);
    expect(high.stats.might).toBeGreaterThan(low.stats.might);
    const m = monsterFromFoe(foe());
    expect(m.affinities).toEqual({ frost: 2, fire: 0.5, shadow: 0.5 });
    expect(m.attack.atoms[0]).toMatchObject({ op: "hit", element: "fire" });
  });

  test("bosses get a signature and a second phase", () => {
    const b = monsterFromFoe(foe({ role: "boss", tier: 3, signature: "Hellfire Waltz", phase2: "wreathed in black flame" }));
    expect(b.skills.some((s) => s.name === "Hellfire Waltz" && s.signature)).toBe(true);
    expect(b.phase2?.into.name).toContain("wreathed in black flame");
  });

  test("model JSON is clamped and cleaned", () => {
    const f = parseFoe({ name: "Gate Hound", role: "wizard", tier: 99, element: "Fire", weakTo: ["fire", "frost", "nope"], rig: "tentacle" }, 0)!;
    expect([f.role, f.tier, f.element, f.rig]).toEqual(["brute", 4, "fire", "standing"]);
    expect(f.weakTo).toEqual(["frost"]);
    expect(parseFoe({ role: "brute" }, 0)).toBeNull();
  });

  test("an encounter is a lead plus escorts, a boss comes with one, and seeds repeat", () => {
    const foes = [foe(), foe({ id: "hound", name: "Hellhound", role: "assassin" }), foe({ id: "duke", name: "The Duke", role: "boss", tier: 3 })];
    const a = encounterFrom(foes, { seed: "x" })!;
    expect(a.foes.length).toBe(3);
    expect(a.foes[0]!.foe.role).not.toBe("boss");
    const b = encounterFrom(foes, { seed: "x", boss: true })!;
    expect(b.boss).toBe(true);
    expect(b.foes.map((f) => f.foe.name)).toEqual(["The Duke", expect.any(String)]);
    expect(encounterFrom(foes, { seed: "x" })).toEqual(a);
  });

  test("a fight with someone on the sheet uses them as the lead", () => {
    const m = { id: "rusk", name: "Rusk", role: "imp assassin", pronoun: "he", voice: "", look: "red imp in a coat", main: false, temperament: { warmth: 1, pride: 3, greed: 3, fear: 1 }, wants: [], fears: [], respects: [], despises: [], likesTactics: [], hatesTactics: [], insight: 2, patience: 1, tells: {}, evidence: ev } as never;
    const f = foeFromCast(m);
    const enc = encounterFrom([f, ...fallbackFoes("fantasy")], { seed: "y", lead: "rusk" })!;
    expect(enc.foes[0]!.foe.name).toBe("Rusk");
    expect(enc.foes.every((x, i) => i === 0 || !x.foe.castId)).toBe(true);
  });

  test("the genre fallback is never empty", () => {
    for (const g of ["sci-fi", "horror", "slice of life", "dark fantasy", ""]) expect(fallbackFoes(g).length).toBeGreaterThan(1);
  });

  test("card foes fight to a finish in the engine", () => {
    const s = advance(battleOf([foe(), foe({ id: "w", name: "Witch", role: "caster", element: "shadow" })]), { enemyPolicy: chooseAction, partyPolicy: chooseAction }).state;
    expect(s.outcome === "victory" || s.outcome === "defeat").toBe(true);
  });
});

describe("the party from the sheet", () => {
  test("descriptions pick base classes, and a party prefers variety", () => {
    expect(baseClassFor("a gentle healer who sings").id).toBe("tidecaller");
    expect(baseClassFor("an occult scholar of old grimoires").id).toBe("hexwright");
    const party = partyFromSheet({
      player: { personaId: null, name: "Juniper", concept: "a scrappy night-shift maid", social: { presence: 1, menace: 1, guile: 2 }, edited: false },
      cast: [{ id: "corvin", name: "Corvin", role: "noble and occult scholar", look: "", voice: "", main: true } as never],
    });
    expect(party.map((p) => p.name)).toEqual(["Juniper", "Corvin"]);
    expect(party[1]!.classDef.id).toBe("hexwright");
    expect(new Set(party.map((p) => p.classDef.id)).size).toBe(2);
  });
});

describe("combat Talk", () => {
  test("options follow morale and nature; mindless foes can only be taunted", () => {
    const s = battleOf([foe({ talks: false })]);
    const actor = s.active!;
    const target = s.combatants.find((c) => c.side === "enemy" && c.alive)!;
    const opts = talkOptions(s, actor, target.id);
    expect(opts.filter((o) => o.usable).map((o) => o.option)).toEqual(["taunt"]);
  });

  test("a shaken foe can be talked out of the fight, and the battle can end in words", () => {
    let s = battleOf([foe({ tier: 0 })], "talk");
    for (const c of s.combatants) if (c.side === "enemy") c.morale = 0;
    const lead = s.combatants.find((c) => c.side === "enemy")!;
    const others = s.combatants.filter((c) => c.side === "enemy" && c.id !== lead.id);
    for (const o of others) o.alive = false;
    const chance = talkOptions(s, s.active!, lead.id).find((o) => o.option === "surrender")!;
    expect(chance.usable).toBe(true);
    expect(chance.chance).toBeGreaterThan(50);
    // Try until it lands (seeded): each attempt costs a turn.
    let guard = 0;
    while (s.outcome === "ongoing" && guard++ < 20) {
      if (!s.active) s = advance(s, { enemyPolicy: chooseAction }).state;
      if (s.outcome !== "ongoing" || !s.active) break;
      const r = act(s, { actor: s.active, skill: "talk:surrender", targets: [lead.id] });
      s = r.state;
      if (r.events.some((e) => e.kind === "leave")) break;
    }
    const left = s.combatants.find((c) => c.id === lead.id)!;
    expect(left.left).toBe("surrender");
    expect(s.outcome).toBe("victory");
  });

  test("an unusable option is refused", () => {
    const s = battleOf([foe({ talks: false })]);
    const t = s.combatants.find((c) => c.side === "enemy" && c.alive)!;
    expect(() => act(s, { actor: s.active!, skill: "talk:bargain", targets: [t.id] })).toThrow();
  });
});
