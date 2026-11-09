import { describe, expect, test } from "bun:test";
import { caughtLies, rapportFrom } from "../src/engine/memory/memory.js";
import { canPay, createParley, replayParley } from "../src/engine/parley/exchange.js";
import { historyLines, stakeLine } from "../src/engine/parley/narrate.js";
import type { ParleyScenario } from "../src/engine/parley/types.js";
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
