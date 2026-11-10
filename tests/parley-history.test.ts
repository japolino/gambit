import { describe, expect, test } from "bun:test";
import { caughtLies, rapportFrom } from "../src/engine/memory/memory.js";
import { PARLEYS } from "../src/engine/content/parleys.js";
import { applyExchange, canPay, createParley, replayParley, startValue } from "../src/engine/parley/exchange.js";
import { historyLines, sceneBlock, stakeLine } from "../src/engine/parley/narrate.js";
import type { ParleyScenario, RefereeRead, Tactic } from "../src/engine/parley/types.js";
import { refereeQuestions } from "../src/meaning/referee.js";
import { rulesRead } from "../src/meaning/rules.js";
import { contestFrom } from "../src/engine/card/sizing.js";
import type { CastMember, ContestFrame } from "../src/engine/card/types.js";

const scenario = (over: Partial<ParleyScenario> = {}): ParleyScenario =>
  ({
    id: "s",
    npc: { name: "Mara", stance: { patience: 4 } },
    contest: { kind: "persuade", track: "resistance", stake: "a place on the night boat", start: 100, floor: 35, hardFloor: 0, winAt: 0, dc: 13 },
    known: [],
    facts: [],
    ...over,
  }) as unknown as ParleyScenario;
const history = (over = {}) => ({ rapport: -1, caughtLies: 0, feel: "wary", remembers: ["caught Wren lying on day 1"], ...over });

describe("a talk starts from the story", () => {
  test("how they feel sets the starting rapport, within its limits", () => {
    expect(rapportFrom(0)).toBe(0);
    expect(rapportFrom(1)).toBe(0);
    expect(rapportFrom(2.5)).toBe(1);
    expect(rapportFrom(-2)).toBe(-1);
    expect(rapportFrom(10)).toBe(3);
    expect(rapportFrom(-10)).toBe(-3);
  });

  test("the rapport and caught lies are there from the first word, and a replay keeps them", () => {
    const s = scenario({ history: history({ rapport: -2, caughtLies: 1 }) });
    const start = createParley(s, "seed");
    expect(start).toMatchObject({ rapport: -2, caughtBluffs: 1 });
    expect(replayParley(s, start, [])).toMatchObject({ rapport: -2, caughtBluffs: 1 });
    expect(createParley(scenario(), "seed")).toMatchObject({ rapport: 0, caughtBluffs: 0 });
  });

  test("old lies make someone hard to talk to, never impossible", () => {
    expect(createParley(scenario({ history: history({ caughtLies: 9 }) }), "seed").caughtBluffs).toBe(2);
  });

  test("an old lie sharpens their eye for the next one; it does not make an honest argument harder", () => {
    const marta = PARLEYS.marta_nets!;
    const read = (tactic: Tactic, over: Partial<RefereeRead> = {}): RefereeRead => ({ tactic, tacticP: { [tactic]: 0.8 }, fit: 1.5, credibility: 1.5, temperament: 2, asserts: {}, otherClaim: 0, by: "rules", ...over });
    const clean = applyExchange(marta, createParley(marta, "seed"), "plain words here", read("logic")).exchange.roll.dc;
    const lied: ParleyScenario = { ...marta, history: history({ rapport: 0, caughtLies: 2 }) };
    // The same honest line against someone who caught two lies before: the same difficulty.
    expect(applyExchange(lied, createParley(lied, "seed"), "plain words here", read("logic")).exchange.roll.dc).toBe(clean);
    // A new lie is easier for them to catch.
    const bluffAt = (s: ParleyScenario) => applyExchange(s, createParley(s, "seed"), "other words entirely", read("bluff", { tacticP: { bluff: 0.9 }, otherClaim: 0.9 })).exchange.bluff!.insight;
    expect(bluffAt(lied)).toBe(bluffAt(marta) + 4);
    // A lie caught in this very talk still counts against every line after it.
    let s = createParley(marta, "seed");
    for (let i = 0; i < 12 && !s.end && !s.exchanges.some((e) => e.bluff?.caught); i++) s = applyExchange(marta, s, `claim number ${i} about nothing`, read("bluff", { tacticP: { bluff: 0.9 }, otherClaim: 0.9 })).state;
    if (!s.end && s.exchanges.some((e) => e.bluff?.caught)) {
      const after = applyExchange(marta, s, "plain words after the lie", read("logic")).exchange.roll.dc;
      expect(after).toBe(marta.contest.dc - s.rapport + 2 * s.caughtBluffs);
      expect(after).toBeGreaterThan(clean);
    }
  });

  test("ground won in an earlier talk is kept: the next one starts there, and never with nothing left to win", () => {
    expect(startValue(scenario())).toBe(100);
    const s = scenario({ history: history({ ground: 50 }) });
    expect(startValue(s)).toBe(50);
    expect(createParley(s, "seed").value).toBe(50);
    expect(replayParley(s, createParley(s, "seed"), []).value).toBe(50);
    // Not below their wall, not at nothing, and never above the top.
    expect(startValue(scenario({ history: history({ ground: 20 }) }))).toBe(35);
    expect(startValue(scenario({ contest: { ...scenario().contest, floor: 0 }, history: history({ ground: 2 }) }))).toBe(10);
    expect(startValue(scenario({ history: history({ ground: 140 }) }))).toBe(100);
    // A price is haggled from the top each time.
    expect(startValue(scenario({ contest: { kind: "haggle", track: "price", stake: "nets", start: 100, floor: 60, hardFloor: 40, dc: 13 } as never, history: history({ ground: 70 }) }))).toBe(100);
    // Whoever voices them knows the talk is picking up, and is told nothing of the kind otherwise.
    expect(historyLines(s).join(" ")).toMatch(/already part of the way to giving in/);
    expect(historyLines(scenario({ history: history() })).join(" ")).not.toMatch(/part of the way/);
  });

  test("someone the card says little of is judged by their place in the scene, not by wants that were never written", () => {
    const blank = scenario({ npc: { name: "Dov", role: "captain of the watch", pronoun: "he", stance: { patience: 4, wants: [], fears: [], respects: [], despises: [], temperament: { warmth: 0.5, pride: 0.5, greed: 0.5, fear: 0.5 } } } as never });
    const fit = refereeQuestions(blank).fit as { instructions: string; criteria: string[] };
    expect(fit.instructions).toMatch(/Nothing is written down about what Dov wants or fears/);
    expect(fit.instructions).toMatch(/captain of the watch/);
    expect(fit.instructions).toMatch(/a place on the night boat/);
    expect(fit.criteria).toHaveLength(4);
    expect((refereeQuestions(PARLEYS.marta_nets!).fit as { instructions: string }).instructions).toMatch(/^How directly does the speech touch what/);
    // Without a model, a line that touches nothing written is neither on target nor off it.
    expect(rulesRead(blank, "I would like you to tell me the truth of it").fit).toBe(1.5);
    expect(rulesRead(PARLEYS.marta_nets!, "zzz qqq xxx").fit).toBe(0.8);
    // The narrator's brief has no empty "wants" line to read as "wants nothing".
    const brief = sceneBlock(blank, createParley(blank, "seed"));
    expect(brief).not.toMatch(/wants: \./);
    expect(brief).not.toMatch(/Respects: \./);
    expect(sceneBlock(PARLEYS.marta_nets!, createParley(PARLEYS.marta_nets!, "seed"))).toMatch(/What she wants: .+\. What she fears: .+\./);
  });

  test("lies are counted per person, however many in one talk", () => {
    const deeds = [
      { day: 1, kind: "caught_lying", target: "mara", name: "Mara", n: 2 },
      { day: 2, kind: "caught_lying", target: "mara", name: "Mara" },
      { day: 2, kind: "caught_lying", target: "tam", name: "Tam" },
      { day: 2, kind: "lied_to", target: "mara", name: "Mara" },
    ] as never;
    expect(caughtLies(deeds, "mara")).toBe(3);
  });

  test("what they carry reaches whoever voices them, and nothing does when there's nothing", () => {
    const lines = historyLines(scenario({ history: history({ caughtLies: 1 }) })).join(" ");
    expect(lines).toContain("caught Wren lying on day 1");
    expect(lines).toContain("feels wary");
    expect(lines).toContain("doesn't take their word");
    expect(historyLines(scenario({ history: history({ feel: "neutral", remembers: [] }) }))).toEqual([]);
    expect(historyLines(scenario())).toEqual([]);
  });
});

describe("the player sees what's on the line", () => {
  test("the stake, and how they stand with you", () => {
    expect(stakeLine(scenario())).toBe("Asking for a place on the night boat");
    expect(stakeLine(scenario({ history: history() }))).toBe("Asking for a place on the night boat · wary of you");
    expect(stakeLine(scenario({ history: history({ feel: "neutral", caughtLies: 1 }) }))).toBe("Asking for a place on the night boat · caught you lying");
  });
});

describe("a deal is paid for", () => {
  const haggle = (over = {}) => ({ kind: "haggle", track: "price", stake: "a net", money: true, start: 60, floor: 40, hardFloor: 20, dc: 12, ...over }) as never;

  test("you can't take a deal you can't pay", () => {
    expect(canPay(scenario({ contest: haggle(), purse: 50 }), 50)).toBe(true);
    expect(canPay(scenario({ contest: haggle(), purse: 50 }), 51)).toBe(false);
    expect(canPay(scenario({ contest: haggle({ money: false }), purse: 0 }), 51)).toBe(true);
    expect(canPay(scenario({ contest: haggle() }), 9999)).toBe(true);
  });

  test("an unnamed price fits the ask, and a price in favors isn't money", () => {
    const who = { temperament: { pride: 2, greed: 2 } } as unknown as CastMember;
    const frame = (over: Partial<ContestFrame>): ContestFrame => ({ castId: "mara", kind: "haggle", stake: "a net", stakeSize: 1, price: null, unit: null, setting: "", opening: "", by: "architect", ...over });
    expect(contestFrom(frame({}), who, "crowns")).toMatchObject({ start: 25, money: true, unit: "crowns" });
    expect(contestFrom(frame({ stakeSize: 3 }), who, "crowns").start).toBe(100);
    expect(contestFrom(frame({ price: 90, unit: "gold" }), who, "crowns")).toMatchObject({ start: 90, money: true, unit: "crowns" });
    expect(contestFrom(frame({ price: 3, unit: "favors" }), who, "crowns")).toMatchObject({ start: 3, money: false, unit: "favors" });
  });
});
