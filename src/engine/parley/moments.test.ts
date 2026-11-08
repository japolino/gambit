import { describe, expect, test } from "bun:test";
import { PARLEYS } from "../content/parleys.js";
import { MOMENTS_PER_PARLEY, momentBeat, momentIndexes, parleyMoment } from "./moments.js";
import type { Exchange, ParleyEnd, ResultTier } from "./types.js";

const scenario = Object.values(PARLEYS)[0]!;

function ex(index: number, result: ResultTier, o: { caught?: boolean; ended?: ParleyEnd; mood?: Exchange["mood"] } = {}): Exchange {
  return {
    index,
    text: "line",
    mood: o.mood ?? "considering",
    roll: { result } as Exchange["roll"],
    bluff: o.caught === undefined ? null : ({ caught: o.caught } as Exchange["bluff"]),
    ended: o.ended ?? null,
  } as Exchange;
}

describe("Parley moments", () => {
  test("only the beats that change the talk are moments", () => {
    expect(momentBeat(ex(0, "success"))).toBeNull();
    expect(momentBeat(ex(0, "partial", { caught: false }))).toBeNull();
    expect(momentBeat(ex(0, "crit_success"))).toBe("lands");
    expect(momentBeat(ex(0, "crit_fail"))).toBe("backfires");
    expect(momentBeat(ex(0, "fail", { caught: true }))).toBe("caught");
    expect(momentBeat(ex(0, "success", { ended: { kind: "won" } }))).toBe("won");
    expect(momentBeat(ex(0, "success", { ended: { kind: "deal", value: 3 } }))).toBe("won");
    expect(momentBeat(ex(0, "fail", { ended: { kind: "walked" } }))).toBe("walked");
    // A final offer is not the end.
    expect(momentBeat(ex(0, "success", { ended: { kind: "final_offer" } }))).toBeNull();
  });

  test("a moment names the person, the place, and how they react", () => {
    const m = parleyMoment(scenario, ex(2, "crit_success", { mood: "moved" }))!;
    expect(m.caption).toBe("That one lands.");
    expect(m.tags).toContain("hand on own chest");
    expect(m.moment).toContain(scenario.npc.name);
    const caught = parleyMoment(scenario, ex(3, "fail", { caught: true }))!;
    expect(caught.caption).toBe(`${scenario.npc.name} calls the bluff.`);
    expect(caught.tags).toContain("pointing at viewer");
  });

  test("a Parley draws a few moments, and always its end", () => {
    const exchanges = [0, 1, 2, 3, 4, 5].map((i) => ex(i, "crit_success"));
    exchanges.push(ex(6, "success", { ended: { kind: "won" } }));
    const picked = momentIndexes(scenario, { exchanges });
    expect(picked).toHaveLength(MOMENTS_PER_PARLEY);
    expect(picked.at(-1)).toBe(6);
    expect(picked.slice(0, -1)).toEqual([0, 1, 2]);
    // Indexes are stable as the talk goes on: an early moment keeps its picture.
    expect(momentIndexes(scenario, { exchanges: exchanges.slice(0, 2) })).toEqual([0, 1]);
  });
});
