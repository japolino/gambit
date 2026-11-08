import { describe, expect, test } from "bun:test";
import { beatWorked, CLOCK_STEP, fightTarget, resolveBeat, rollLine, routeBeat, spendClock, threadEnd, type BeatRead } from "../src/engine/story/beat.js";
import { fallbackReply, foeByWords, foeFromAnswers, foeQuestions, parseRead, readFromAnswers, rulesRead, type StoryContext } from "../src/meaning/story.js";

const social = { presence: 2, menace: 1, guile: 3 } as const;
const read: BeatRead = { route: "risk", attempt: "Sneaking past", stat: "guile", difficulty: 1, target: "orla", to: null };
const said = (choice: string, p = 0.9) => ({ type: "choice", choice, confidence: p, probabilities: { [choice]: p } }) as never;

describe("who a line goes for", () => {
  test("a fight somewhere else leaves behind whoever's here, unless the line names them", () => {
    expect(fightTarget({ ...read, route: "fight" }, false)).toBe("orla");
    expect(fightTarget({ ...read, route: "fight", to: "fields" }, false)).toBeNull();
    expect(fightTarget({ ...read, route: "fight", to: "fields" }, true)).toBe("orla");
  });

  const foes = [{ id: "a", name: "Alley Bandit", look: "hooded" }, { id: "b", name: "Crystal Beast" }];
  test("the decision model picks when it's sure, and none is an answer", () => {
    expect(Object.keys((foeQuestions(foes).foe as { criteria: object }).criteria)).toEqual(["a", "b", "none"]);
    expect(foeFromAnswers({ foe: said("a") }, foes)!.name).toBe("Alley Bandit");
    expect(foeFromAnswers({ foe: said("a", 0.2) }, foes)).toBeNull();
    expect(foeFromAnswers({ foe: said("none") }, foes)).toBeNull();
    expect(foeFromAnswers(null, foes)).toBeNull();
  });
  test("without a model, the name in the line", () => {
    expect(foeByWords("A bandit grabs at my purse. I attack him.", foes)!.id).toBe("a");
    expect(foeByWords("I attack the shadows.", foes)).toBeNull();
  });
  test("the plain rules hear where a risky line is going", () => {
    const places = [{ id: "inn", name: "The Inn" }];
    expect(rulesRead("I slip away and head for the inn", [], places)).toMatchObject({ route: "risk", to: "inn" });
    expect(rulesRead("I slip the coin into my sleeve at the inn", [], places)).toMatchObject({ route: "risk", to: null });
  });
});

describe("story beats", () => {
  test("flavor rolls nothing and costs nothing", () => {
    expect(resolveBeat("s", 0, { ...read, route: "flavor" }, social)).toEqual({ roll: null, fallout: "", told: "", caughtBy: null, vigorLoss: 0 });
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
      expect(beatWorked(r.roll)).toBe(!failed);
      expect(r.roll!.add).toBe(3);
      expect(r.roll!.target).toBe(12);
    }
    expect(tiers.size).toBe(5);
  });

  test("what the player reads is never the narrator's instructions", () => {
    for (let i = 0; i < 200; i++) {
      const r = resolveBeat("s", i, read, social);
      expect(r.told).not.toMatch(/show|write|they wrote/i);
      expect(fallbackReply({ place: { name: "Hall", description: "" } } as StoryContext, r.told)).toBe(r.told);
    }
  });

  test("the roll line reads the total", () => {
    expect(rollLine("Sneaking past", { natural: 4, add: 3, target: 12, tier: "fail" })).toBe("Sneaking past: 7 vs 12, failed");
  });
});

describe("routing a line", () => {
  const all = { parley: true, encounters: true };

  test("a line goes where it says when the card has that system", () => {
    expect(routeBeat({ ...read, route: "press" }, all).route).toBe("press");
    expect(routeBeat({ ...read, route: "fight" }, all).route).toBe("fight");
  });

  test("a card with no fights makes violence a risk, not a battle", () => {
    expect(routeBeat({ ...read, route: "fight" }, { parley: true, encounters: false })).toMatchObject({ route: "risk", stat: "menace" });
  });

  test("pressing nobody, or on a card with no talk, is a risk", () => {
    expect(routeBeat({ ...read, route: "press", target: null }, all).route).toBe("risk");
    expect(routeBeat({ ...read, route: "press" }, { parley: false, encounters: true }).route).toBe("risk");
  });

  test("going nowhere in particular is just a line", () => {
    expect(routeBeat({ ...read, route: "travel", to: null }, all).route).toBe("flavor");
  });
});

describe("the clock", () => {
  test("flavor spends one and a risk spends two, and a full clock is one step of the day", () => {
    expect(spendClock(0, "flavor")).toEqual({ spent: 1, steps: 0 });
    expect(spendClock(0, "risk")).toEqual({ spent: 2, steps: 0 });
    expect(spendClock(CLOCK_STEP - 1, "flavor")).toEqual({ spent: 0, steps: 1 });
    expect(spendClock(CLOCK_STEP - 1, "seek")).toEqual({ spent: 1, steps: 1 });
  });

  test("handing off to another system spends nothing here", () => {
    expect(spendClock(1, "press")).toEqual({ spent: 1, steps: 0 });
  });

  test("a thread ends when all of it is found, or when its last day has passed", () => {
    expect(threadEnd(1, 5, 3, 3)).toBeNull();
    expect(threadEnd(5, 5, 3, 3)).toBe("solved");
    expect(threadEnd(1, 5, 4, 3)).toBe("lost");
    expect(threadEnd(5, 5, 4, 3)).toBe("solved");
  });
});

describe("reading a line", () => {
  test("cleans a judge's reply, and refuses a target who isn't here", () => {
    const r = parseRead('sure! {"route":"risk","attempt":"Stealing the key","stat":"nonsense","difficulty":9,"target":"nobody","to":"nowhere"}', ["orla"], ["hall"]);
    expect(r).toEqual({ route: "risk", attempt: "Stealing the key", stat: "guile", difficulty: 1, target: null, to: null });
  });

  test("an unusable reply is null", () => {
    expect(parseRead("no json", [])).toBeNull();
    expect(parseRead('{"attempt":"x"}', [])).toBeNull();
  });

  test("the decision model's answers become a read", () => {
    const r = readFromAnswers({ route: said("press"), stat: said("menace"), difficulty: said("hard"), target: said("orla"), to: said("staying") }, ["orla"], ["hall"]);
    expect(r).toEqual({ route: "press", attempt: "Using force", stat: "menace", difficulty: 2, target: "orla", to: null });
  });

  test("a guess doesn't take over a quiet moment", () => {
    expect(readFromAnswers({ route: said("fight", 0.4) }, [], [])?.route).toBe("flavor");
  });

  test("no route answer, no read", () => {
    expect(readFromAnswers({}, [], [])).toBeNull();
  });

  test("the rules catch each route and leave ordinary lines alone", () => {
    const people = [{ id: "orla", name: "Orla", role: "prince" }];
    const places = [{ id: "docks", name: "The Docks" }];
    expect(rulesRead("I sneaked past him", people)).toMatchObject({ route: "risk", stat: "guile", target: "orla" });
    expect(rulesRead("I threaten Orla", people).route).toBe("press");
    expect(rulesRead("I stab Orla", people).route).toBe("fight");
    expect(rulesRead("I search the desk", people).route).toBe("seek");
    expect(rulesRead("I head to the docks", people, places)).toMatchObject({ route: "travel", to: "docks" });
    expect(rulesRead("I pour the tea and sit down", people).route).toBe("flavor");
  });
});
