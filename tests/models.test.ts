import { describe, expect, test } from "bun:test";
import type { DecisionAnswer } from "lumiverse-spindle-types";
import { createLedger } from "../src/backend/ledger.js";
import { companionsReact, reactionWeight, type Deed } from "../src/engine/memory/memory.js";
import { applyExchange, createParley } from "../src/engine/parley/exchange.js";
import { meaningRepetition, MEANING_CEIL, MEANING_FLOOR } from "../src/engine/parley/similarity.js";
import { applyTraits, buildWorld, unjudged } from "../src/engine/world/places.js";
import { PARLEYS } from "../src/engine/content/parleys.js";
import {
  attemptsFor,
  isAbort,
  normalizeSettings,
  patchSettings,
  pickDecision,
  pickEmbedding,
  reasoningOverride,
  roleForKind,
  supportsReasoning,
  type LlmConn,
  type ModelSettings,
} from "../src/meaning/models.js";
import {
  bestSims,
  factCandidates,
  factQuestions,
  factsSeen,
  keywordHit,
  noticeCandidates,
  noticeFromAnswers,
  noticeQuestions,
  placeQuestions,
  placeTraits,
  questQuestions,
  questsDone,
  reactionQuestions,
  reactionsFromAnswers,
  recallPick,
  yes,
} from "../src/meaning/senses.js";

const conn = (id: string, model: string, extra: Partial<LlmConn> = {}): LlmConn => ({ id, name: id, provider: "openai", model, isDefault: false, boundReasoning: null, ...extra });
const CONNS = [conn("def", "gpt-4o-mini", { isDefault: true }), conn("big", "claude-opus-4-1"), conn("fast", "llama-3.1-8b")];
const s = (roles: ModelSettings["roles"] = {}): ModelSettings => ({ v: 1, roles });
const noul = (p: number): DecisionAnswer => ({ type: "noul", noul: p });

describe("model routing", () => {
  test("every ledger kind has a role; unknown kinds are helpers", () => {
    expect(roleForKind("read-world")).toBe("reader");
    expect(roleForKind("bible")).toBe("reader");
    expect(roleForKind("armory")).toBe("reader");
    expect(roleForKind("meanwhile")).toBe("narrator");
    expect(roleForKind("board-scene")).toBe("narrator");
    expect(roleForKind("promote")).toBe("narrator");
    expect(roleForKind("place-from-chat")).toBe("helper");
    expect(roleForKind("something-new")).toBe("helper");
  });

  test("an unset role uses the default connection; the reader thinks only when the model can", () => {
    expect(attemptsFor(s(), "helper", CONNS)).toEqual([{ reasoning: false, key: "default" }]);
    // gpt-4o-mini is not a thinker: the reader does not think on it.
    expect(attemptsFor(s(), "reader", CONNS)).toEqual([{ reasoning: false, key: "default" }]);
    const big = [conn("def", "claude-opus-4-1", { isDefault: true })];
    expect(attemptsFor(s(), "reader", big)).toEqual([
      { reasoning: true, key: "default" },
      { reasoning: false, key: "default" },
    ]);
    expect(attemptsFor(s(), "narrator", big)).toEqual([{ reasoning: false, key: "default" }]);
  });

  test("a picked connection falls back to the default, without and then with reasoning as chosen", () => {
    expect(attemptsFor(s({ reader: { connectionId: "big" } }), "reader", CONNS)).toEqual([
      { connectionId: "big", reasoning: true, key: "big" },
      { connectionId: "big", reasoning: false, key: "big" },
      { reasoning: false, key: "default" },
    ]);
    expect(attemptsFor(s({ narrator: { connectionId: "fast", reasoning: "off" } }), "narrator", CONNS)).toEqual([
      { connectionId: "fast", reasoning: false, key: "fast" },
      { reasoning: false, key: "default" },
    ]);
  });

  test("a removed connection is skipped; an unreadable list trusts the pick", () => {
    expect(attemptsFor(s({ helper: { connectionId: "gone" } }), "helper", CONNS)).toEqual([{ reasoning: false, key: "default" }]);
    expect(attemptsFor(s({ helper: { connectionId: "gone" } }), "helper", null)).toEqual([
      { connectionId: "gone", reasoning: false, key: "gone" },
      { reasoning: false, key: "default" },
    ]);
  });

  test("picking the default connection is the same as no pick", () => {
    expect(attemptsFor(s({ helper: { connectionId: "def" } }), "helper", CONNS)).toEqual([{ reasoning: false, key: "default" }]);
  });

  test("auto stops asking a connection that rejected reasoning; explicit on still tries", () => {
    const pick = s({ reader: { connectionId: "big" } });
    expect(attemptsFor(pick, "reader", CONNS, new Set(["big"]))[0]).toEqual({ connectionId: "big", reasoning: false, key: "big" });
    const on = s({ reader: { connectionId: "big", reasoning: "on" } });
    expect(attemptsFor(on, "reader", CONNS, new Set(["big"]))[0]).toEqual({ connectionId: "big", reasoning: true, key: "big" });
    // "on" asks every role to think, the default fallback too.
    expect(attemptsFor(s({ helper: { reasoning: "on" } }), "helper", CONNS)).toEqual([
      { reasoning: true, key: "default" },
      { reasoning: false, key: "default" },
    ]);
  });

  test("a bound reasoning setting wins over the model-name guess", () => {
    expect(supportsReasoning(conn("x", "gpt-4o-mini", { boundReasoning: true }))).toBe(true);
    expect(supportsReasoning(conn("x", "claude-opus-4-1", { boundReasoning: false }))).toBe(false);
    expect(supportsReasoning(conn("x", "deepseek-reasoner"))).toBe(true);
    expect(supportsReasoning(undefined)).toBe(false);
    expect(reasoningOverride({ reasoning: false, key: "d" })).toEqual({ source: "off" });
    expect(reasoningOverride({ reasoning: true, key: "d" }, conn("x", "m", { boundReasoning: true }))).toEqual({ source: "inherit" });
    expect(reasoningOverride({ reasoning: true, key: "d" })).toEqual({ source: "custom", apiReasoning: true, effort: "auto" });
  });

  test("settings are normalized and patched from the drawer", () => {
    expect(normalizeSettings(null)).toEqual({ v: 1, roles: {} });
    expect(normalizeSettings({ roles: { reader: { connectionId: " big ", reasoning: "maybe" }, bogus: {} }, decision: "off" })).toEqual({ v: 1, roles: { reader: { connectionId: "big" } }, decision: "off" });
    let st = patchSettings(normalizeSettings({}), { role: "narrator", connectionId: "fast" });
    st = patchSettings(st, { role: "narrator", reasoning: "on" });
    expect(st.roles.narrator).toEqual({ connectionId: "fast", reasoning: "on" });
    st = patchSettings(st, { role: "narrator", connectionId: null });
    expect(st.roles.narrator).toEqual({ reasoning: "on" });
    st = patchSettings(st, { decision: "dec1", embedding: "off" });
    expect([st.decision, st.embedding]).toEqual(["dec1", "off"]);
    st = patchSettings(st, { decision: "auto", embedding: null });
    expect([st.decision, st.embedding]).toEqual([undefined, undefined]);
  });

  test("timeouts and cancels are not retried on another connection", () => {
    expect(isAbort(Object.assign(new Error("x"), { name: "AbortError" }))).toBe(true);
    expect(isAbort(new Error("The operation timed out."))).toBe(true);
    expect(isAbort(new Error("401 invalid api key"))).toBe(false);
  });

  test("decision and embedding picks: off, a pick, auto, and a gone pick", () => {
    const dec = [
      { id: "a", provider: "openrouter", model: "x", isDefault: true, hasKey: true },
      { id: "j", provider: "typesafe", model: "jev-1", isDefault: false, hasKey: true },
      { id: "n", provider: "typesafe", model: "jev-2", isDefault: false, hasKey: false },
    ];
    expect(pickDecision("off", dec)).toEqual({ use: false });
    expect(pickDecision(undefined, dec)).toEqual({ use: true, id: "j" });
    expect(pickDecision("a", dec)).toEqual({ use: true, id: "a" });
    expect(pickDecision("gone", dec)).toEqual({ use: true, id: "j" });
    expect(pickDecision(undefined, [])).toEqual({ use: false });
    expect(pickDecision(undefined, null)).toEqual({ use: false });
    const emb = [
      { id: "p", model: "m", dimensions: null, enabled: true, primary: true },
      { id: "q", model: "m2", dimensions: 256, enabled: true, primary: false },
      { id: "z", model: "m3", dimensions: null, enabled: false, primary: false },
    ];
    expect(pickEmbedding(undefined, emb)?.id).toBe("p");
    expect(pickEmbedding("q", emb)?.id).toBe("q");
    expect(pickEmbedding("z", emb)?.id).toBe("p");
    expect(pickEmbedding("off", emb)).toBeNull();
  });

  test("the ledger tells the model which kind it is asking for", async () => {
    const store = new Map<string, unknown>();
    const st = { getJson: async <T>(p: string, o: { fallback: T }) => (store.get(p) as T) ?? o.fallback, setJson: async (p: string, v: unknown) => void store.set(p, v) };
    const kinds: string[] = [];
    const ledger = createLedger(st, (_u, kind) => async () => (kinds.push(kind), { raw: { ok: 1 }, ms: 1 }));
    await ledger.compile("u", "bible", { system: "s", user: "u" }, 10, (r) => r, () => null);
    expect(kinds).toEqual(["bible"]);
  });
});

describe("decision answers", () => {
  test("yes/no reads noul and yes/no choices", () => {
    expect(yes(noul(0.8))).toBe(0.8);
    expect(yes(noul(3))).toBe(1);
    expect(yes({ type: "choice", choice: "yes", confidence: 0.9, probabilities: { yes: 0.9, no: 0.1 } })).toBe(0.9);
    expect(yes(undefined)).toBeNull();
  });

  test("place traits: five questions per place, a place with a gap keeps its code flags", () => {
    const places = [
      { id: "inn", name: "The Gull" },
      { id: "pit", name: "The Pit" },
    ];
    const q = placeQuestions(places);
    expect(Object.keys(q)).toHaveLength(10);
    expect(q.place_0_indoor?.type).toBe("noul");
    const answers = { place_0_indoor: noul(0.9), place_0_rest: noul(0.8), place_0_shop: noul(0.7), place_0_danger: noul(0.1), place_0_delve: noul(0.05), place_1_indoor: noul(0.2) };
    expect(placeTraits(answers, places)).toEqual({ inn: { indoor: true, rest: true, shop: true, danger: false, delve: false } });
  });

  test("judged traits replace the word flags, inside the module limits", () => {
    const sheet = {
      shape: "town" as const,
      cardName: "T",
      cast: [],
      modules: { parley: true, encounters: true, economy: false, delves: true, places: true } as never,
      places: [
        { id: "hub", name: "The Square", description: "A busy square.", evidence: { source: "card" as const, quote: "", verified: true } },
        { id: "gull", name: "The Gull", description: "A friendly place.", evidence: { source: "card" as const, quote: "", verified: true } },
      ],
    };
    const w = buildWorld(sheet as never, "seed");
    expect(w.places.gull!.rest).toBe(false);
    expect(unjudged(w)).toHaveLength(2);
    const j = applyTraits(w, sheet as never, { gull: { indoor: true, rest: true, shop: true, danger: true, delve: false }, hub: { indoor: false, rest: false, shop: false, danger: false, delve: false } });
    expect(j.places.gull).toMatchObject({ indoor: true, rest: true, shop: false, danger: true, judged: true });
    // The start stays a place to rest.
    expect(j.places.hub!.rest).toBe(true);
    expect(unjudged(j)).toHaveLength(0);
    expect(w.places.gull!.judged).toBeUndefined();
  });

  test("notice: the model drops a false name and confirms another form of a known one", () => {
    const known = [
      { key: "cast:mira", name: "Mira" },
      { key: "place:docks", name: "The Docks" },
    ];
    const line = "Gods, I head down to the docks to find Mira's brother. Tomorrow Brannoc pays.";
    const found = ["name:Brannoc", "name:Tomorrow Brannoc"];
    const cands = noticeCandidates(line, known, found);
    expect(cands.map((c) => c.key)).toEqual(["name:Brannoc", "name:Tomorrow Brannoc", "cast:mira", "place:docks"]);
    const q = noticeQuestions(cands);
    expect(String((q.seen_0 as { instructions: string }).instructions)).toContain('"Brannoc"');
    const answers = { seen_0: noul(0.9), seen_1: noul(0.1), seen_2: noul(0.8) };
    // seen_3 unanswered: the code rule had not found it, so it stays out.
    expect(noticeFromAnswers(answers, cands, found)).toEqual(["name:Brannoc", "cast:mira"]);
  });

  test("facts: candidates by meaning, confirmed by the model, else very close meaning or rule words", () => {
    const facts = [
      { id: "f1", text: "The harbourmaster takes bribes from smugglers.", keywords: [["harbourmaster", "bribes"]] },
      { id: "f2", text: "Mira's brother drowned last winter.", keywords: [["brother"]] },
      { id: "f3", text: "The lighthouse is empty.", keywords: [] },
    ];
    const sims = [0.83, 0.62, 0.2];
    const cands = factCandidates(facts, sims, []);
    expect(cands.map((f) => f.id)).toEqual(["f1", "f2"]);
    expect(Object.keys(factQuestions(cands))).toEqual(["fact_0", "fact_1"]);
    expect(factsSeen(cands, { fact_0: noul(0.4), fact_1: noul(0.9) }, null, [])).toEqual(["f2"]);
    const simMap = new Map([
      ["f1", 0.83],
      ["f2", 0.62],
    ]);
    expect(factsSeen(cands, null, simMap, [])).toEqual(["f1"]);
    // No vectors, no model: a multi-word rule group must match one line.
    const lines = ["Everyone knows the harbourmaster takes bribes.", "Her brother?"];
    expect(factCandidates(facts, null, lines).map((f) => f.id)).toEqual(["f1", "f2"]);
    expect(factsSeen(factCandidates(facts, null, lines), null, null, lines)).toEqual(["f1"]);
    expect(keywordHit(facts[1]!, lines, 2)).toBe(false);
  });

  test("best similarity per fact over the chat lines", () => {
    const dot = (a: readonly number[], b: readonly number[]) => a.reduce((x, v, i) => x + v * b[i]!, 0);
    expect(bestSims([[1, 0], null, [0, 1]], [[0.5, 0], [0.2, 0.9], null], dot)).toEqual([0.5, null, 0.9]);
  });

  test("quest steps: only a confident yes completes one", () => {
    const steps = [
      { key: "name:Brannoc", text: "Find the ledger", who: "Brannoc" },
      { key: "cast:mira", text: "Talk to the priest", who: "Mira" },
    ];
    expect(Object.keys(questQuestions(steps))).toEqual(["quest_0", "quest_1"]);
    expect(questsDone({ quest_0: noul(0.9), quest_1: noul(0.6) }, steps)).toEqual(["name:Brannoc"]);
    expect(questsDone(null, steps)).toEqual([]);
  });

  test("companion reactions: a choice per companion; judged ones replace the warmth rule", () => {
    const comps = [
      { id: "a", name: "A", warmth: 1 },
      { id: "b", name: "B", warmth: 4 },
      { id: "c", name: "C", warmth: 2 },
    ];
    const q = reactionQuestions(comps);
    expect(q.react_0?.type).toBe("choice");
    const judged = reactionsFromAnswers(
      {
        react_0: { type: "choice", choice: "approve", confidence: 0.8, probabilities: {} },
        react_1: { type: "choice", choice: "disapprove", confidence: 0.2, probabilities: {} },
      },
      comps,
    );
    // B's answer was too unsure to count.
    expect(judged).toEqual({ a: 1 });
    const deeds: Deed[] = [{ day: 1, kind: "spared", target: "x", name: "X" }];
    expect(reactionWeight(deeds)).toBe(0.5);
    const mem = companionsReact({}, deeds, comps, judged);
    // A (cold) would dislike mercy by the rule; the model said A approves.
    expect(mem.a!.affinity).toBe(0.5);
    expect(mem.b!.affinity).toBe(0.5);
    expect(mem.c!.affinity).toBe(0.25);
    expect(companionsReact({}, deeds, comps, { b: 0 }).b).toBeUndefined();
    expect(reactionWeight([{ day: 1, kind: "killed", target: "x", name: "X", n: 40 }])).toBe(1.5);
  });
});

describe("embedding matchers", () => {
  test("meaning repetition counts only a near-paraphrase", () => {
    expect(meaningRepetition([])).toBe(0);
    expect(meaningRepetition([0.7, null, MEANING_FLOOR])).toBe(0);
    expect(meaningRepetition([MEANING_CEIL + 0.01])).toBe(1);
    expect(meaningRepetition([0.2, (MEANING_FLOOR + MEANING_CEIL) / 2])).toBeCloseTo(0.5, 5);
  });

  test("a stored meaning repeat lowers the tier like word repetition, and replays the same", () => {
    const scenario = Object.values(PARLEYS)[0]!;
    const state = createParley(scenario, "seed", null);
    const read = { tactic: "appeal" as const, tacticP: { appeal: 0.9 }, fit: 3, credibility: 3, temperament: 4, asserts: {}, otherClaim: 0, by: "jev" as const };
    const first = applyExchange(scenario, state, "You owe the harbour your loyalty, think of the families.", read as never);
    const plain = applyExchange(scenario, first.state, "Consider the people who depend on this port and on you.", read as never);
    const again = applyExchange(scenario, first.state, "Consider the people who depend on this port and on you.", { ...read, meaningRepeat: 0.9 } as never);
    expect(again.exchange.repetition).toBe(0.9);
    expect(again.exchange.tier).toBeLessThan(plain.exchange.tier);
  });

  test("recall picks the few close memories, or none", () => {
    expect(recallPick([0.1, 0.2, 0.3])).toEqual([]);
    expect(recallPick([0.62, 0.4, 0.55, 0.58, 0.61])).toEqual([0, 4, 3]);
    expect(recallPick([0.62, 0.4, 0.55], 1)).toEqual([0]);
  });
});
