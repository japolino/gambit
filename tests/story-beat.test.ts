import { describe, expect, test } from "bun:test";
import { resolveBeat, rollLine, type BeatRead } from "../src/engine/story/beat.js";
import { parseRead, rulesRead } from "../src/meaning/story.js";

const social = { presence: 2, menace: 1, guile: 3 } as const;
const read: BeatRead = { stakes: true, attempt: "Sneaking past", stat: "guile", difficulty: 1, target: "orla" };

describe("story beats", () => {
  test("a line with no stakes rolls nothing and costs nothing", () => {
    expect(resolveBeat("s", 0, { ...read, stakes: false }, social)).toEqual({ roll: null, fallout: "", caughtBy: null, vigorLoss: 0 });
  });

  test("the same line at the same point always rolls the same", () => {
    expect(resolveBeat("s", 3, read, social)).toEqual(resolveBeat("s", 3, read, social));
  });

  test("only failing gets you noticed, and every tier is reachable", () => {
    const tiers = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const r = resolveBeat("s", i, read, social);
      tiers.add(r.roll!.tier);
      const failed = r.roll!.tier === "fail" || r.roll!.tier === "crit_fail";
      expect(r.caughtBy).toBe(failed ? "orla" : null);
      expect(r.roll!.add).toBe(3);
      expect(r.roll!.target).toBe(12);
    }
    expect(tiers.size).toBe(5);
  });

  test("the roll line reads the total", () => {
    expect(rollLine("Sneaking past", { natural: 4, add: 3, target: 12, tier: "fail" })).toBe("Sneaking past: 7 vs 12, failed");
  });
});

describe("reading a line", () => {
  test("cleans a judge's reply, and refuses a target who isn't here", () => {
    const r = parseRead('sure! {"stakes":true,"attempt":"Stealing the key","stat":"nonsense","difficulty":9,"target":"nobody"}', ["orla"]);
    expect(r).toEqual({ stakes: true, attempt: "Stealing the key", stat: "guile", difficulty: 1, target: null });
  });

  test("an unusable reply is null", () => {
    expect(parseRead("no json", [])).toBeNull();
    expect(parseRead('{"attempt":"x"}', [])).toBeNull();
  });

  test("the rules catch plain risk and leave ordinary lines alone", () => {
    const people = [{ id: "orla", name: "Orla", role: "prince" }];
    expect(rulesRead("I sneaked past him", people)).toMatchObject({ stakes: true, stat: "guile", target: "orla" });
    expect(rulesRead("I pour the tea and sit down", people).stakes).toBe(false);
  });
});
