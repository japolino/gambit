import { describe, expect, test } from "bun:test";
import { beatWorked, CLOCK_STEP, fightTarget, resolveBeat, rollLine, routeBeat, spendClock, threadEnd, type BeatRead } from "../src/engine/story/beat.js";
import { fallbackReply, foeByWords, foeFromAnswers, foeQuestions, judgePrompt, narratorPrompt, parseRead, readFromAnswers, routeQuestions, routeState, rulesRead, saysAttack, stands, type StoryContext } from "../src/meaning/story.js";

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
    expect(r).toEqual({ route: "press", attempt: "Forcing", stat: "menace", difficulty: 2, target: "orla", to: null });
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

describe("what the playtest turned up", () => {
  const said = (choice: string, p = 0.9) => ({ type: "choice", choice, probabilities: { [choice]: p } }) as never;

  test("a roll is called what the line attempts, not what stat it uses", () => {
    const read = (route: string, stat: string, line: string) => readFromAnswers({ route: said(route), stat: said(stat) }, [], [], line)?.attempt;
    expect(read("risk", "guile", `I laugh. "Deserter? Sister, I sell salt and lamp oil."`)).toBe("Lying");
    expect(read("risk", "guile", "I keep to the shadows along the wall")).toBe("Sneaking");
    expect(read("press", "presence", `I lean in close. "Free, you said? Then warm it with me."`)).toBe("Persuading");
    expect(read("press", "presence", "I flirt with her until she gives me the key")).toBe("Charming");
    expect(read("risk", "menace", "I put my shoulder to the door")).toBe("Forcing");
  });
  const ctx: StoryContext = { premise: "", tone: "", player: { name: "Tam", concept: "" }, place: { name: "Quay", description: "" }, time: "dusk", people: [], places: [], goal: null, recent: [], memory: null };

  test("unsure it's a journey but sure where to: the scene goes too", () => {
    expect(readFromAnswers({ route: said("travel", 0.4), to: said("new") }, [], [])).toMatchObject({ route: "travel", to: "new" });
    expect(readFromAnswers({ route: said("flavor"), to: said("docks", 0.3) }, [], ["docks"])).toMatchObject({ route: "flavor" });
    expect(readFromAnswers({ route: said("flavor"), to: said("staying") }, [], ["docks"])).toMatchObject({ route: "flavor", to: null });
    expect(parseRead(`{"route":"flavor","to":"new"}`, [], [])?.route).toBe("travel");
  });

  describe("asking someone for what they keep back", () => {
    const orla = { id: "orla", name: "Orla", role: "prince" };
    const holding: StoryContext = { ...ctx, people: [orla], goal: "Find the warden", holds: [{ id: "orla", name: "Orla" }] };
    const yes = (p: number) => ({ type: "noul", noul: p }) as never;

    test("the reader is only asked when someone here holds a piece, and is told who and about what", () => {
      expect(routeQuestions(ctx).asks).toBeUndefined();
      expect(routeQuestions({ ...ctx, people: [orla] }).asks).toBeUndefined();
      const q = routeQuestions(holding).asks!;
      expect(q.type).toBe("noul");
      expect(q.instructions).toMatch(/ask Orla for what they know/);
      expect(q.instructions).toMatch(/Find the warden/);
      expect(q.instructions).toMatch(/However politely/);
      expect(routeState(holding, "x")).toMatchObject({ the_player_is_after: "Find the warden", keeping_it_back: ["Orla"] });
      expect(routeState(ctx, "x").keeping_it_back).toBeUndefined();
      expect(judgePrompt(holding, "x").system).toMatch(/"asks": true\|false/);
      expect(judgePrompt(holding, "x").system).toMatch(/asks: true when the line asks Orla for what they know/);
      expect(judgePrompt(ctx, "x").system).not.toMatch(/asks/);
    });

    test("a gentle question is still an ask: the read says so without calling it pressing", () => {
      const r = readFromAnswers({ route: said("flavor"), target: said("orla"), asks: yes(0.8) }, ["orla"], []);
      expect(r).toMatchObject({ route: "flavor", target: "orla", asks: true });
      expect(readFromAnswers({ route: said("flavor"), target: said("orla"), asks: yes(0.4) }, ["orla"], [])?.asks).toBeUndefined();
      expect(readFromAnswers({ route: said("flavor"), target: said("orla") }, ["orla"], [])?.asks).toBeUndefined();
      expect(parseRead(`{"route":"flavor","target":"orla","asks":true}`, ["orla"])?.asks).toBe(true);
      expect(parseRead(`{"route":"flavor","target":"orla","asks":"yes"}`, ["orla"])?.asks).toBeUndefined();
    });

    test("without a model: a question about knowing, put to someone who holds a piece", () => {
      const people = [orla, { id: "tam", name: "Tam", role: "guard" }];
      expect(rulesRead("To Orla: You mind answering me about it? About whatever is going on, I guess", people, [], ["orla"])).toMatchObject({ route: "flavor", target: "orla", asks: true });
      // Not a question, not about knowing, or put to someone who holds nothing: only a line.
      expect(rulesRead("To Orla: I tell you about the road north.", people, [], ["orla"]).asks).toBeUndefined();
      expect(rulesRead("To Orla: Is the tea still warm?", people, [], ["orla"]).asks).toBeUndefined();
      expect(rulesRead("To Tam: What is going on here?", people, [], ["orla"]).asks).toBeUndefined();
      expect(rulesRead("To Orla: What is going on here?", people).asks).toBeUndefined();
    });
  });

  test("saying in so many words that you attack is an attack, and only then", () => {
    expect(saysAttack("Whatever is down there making these men sick, I attack it")).toBe(true);
    expect(saysAttack("I draw and attack")).toBe(true);
    expect(saysAttack("I don't attack him")).toBe(false);
    expect(saysAttack("I will not attack")).toBe(false);
    expect(saysAttack("They attack the gate")).toBe(false);
  });

  test("what was won long ago still stands for the narrator", () => {
    const old = { text: "", reply: "You won the argument. The king presses his signet ring into your palm." };
    const filler = Array.from({ length: 8 }, (_, i) => ({ text: `line ${i}`, reply: `reply ${i}` }));
    const c = { ...ctx, recent: [old, { text: "I look", reply: "Dust.", found: "A hidden door" }, ...filler] };
    expect(stands(c)).toEqual([old.reply, "A hidden door"]);
    const brief = narratorPrompt(c, "I hold up the ring.", "", "flavor");
    expect(brief.user).toContain("signet ring");
    expect(brief.system).toContain("never say it's missing");
    expect(stands({ ...ctx, recent: filler.slice(0, 6) })).toEqual([]);
  });
});
