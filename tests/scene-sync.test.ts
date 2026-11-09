import { describe, expect, test } from "bun:test";
import type { DecisionAnswer } from "lumiverse-spindle-types";
import { clockTo, newScene, seatPeople, TIMES, type World } from "../src/engine/world/places.js";
import { sceneFromAnswers, whenQuestion, whoQuestions } from "../src/meaning/bible.js";

const place = (id: string, people: string[]) => ({ id, name: id, description: "", exits: [], people, indoor: true, rest: false, shop: false, danger: false, delve: false });
const world = (): World => ({ shape: "town", start: "hall", places: { hall: place("hall", ["ann", "bo"]), yard: place("yard", ["cy"]) } }) as unknown as World;
const said = (choice: string, p: number): DecisionAnswer => ({ type: "choice", choice, confidence: p, probabilities: { [choice]: p } }) as unknown as DecisionAnswer;

const people = [
  { id: "ann", name: "Ann Vale", here: true },
  { id: "bo", name: "Bo", here: false },
  { id: "cy", name: "Cy Rook", here: false },
];

describe("the scene follows the chat", () => {
  test("the time question doesn't offer the time it already is", () => {
    const q = whenQuestion("night").when as unknown as { criteria: Record<string, string> };
    expect(Object.keys(q.criteria).sort()).toEqual(["afternoon", "evening", "morning", "same"]);
    expect(whenQuestion("morning").when).toBeDefined();
  });

  test("it only asks about people named in the chat's words: someone here it doesn't mention stays", () => {
    const q = whoQuestions(people, [{ content: "Cy Rook kicked the door in." }]);
    expect(Object.keys(q)).toEqual(["here_cy"]);
  });

  test("a name inside another word isn't the person", () => {
    const q = whoQuestions(people, [{ content: "They rowboat over the Bosphorus." }]);
    expect(Object.keys(q)).toEqual([]);
  });

  test("someone only talked about doesn't leave", () => {
    const r = sceneFromAnswers({ time: "morning", people }, { here_ann: said("unsaid", 0.9) });
    expect(r).toEqual({ here: [], away: [] });
  });

  test("only sure answers change anything", () => {
    const now = { time: "morning", people };
    const sure = sceneFromAnswers(now, { when: said("night", 0.9), here_ann: said("away", 0.8), here_cy: said("here", 0.8) });
    expect(sure).toEqual({ time: "night", here: ["cy"], away: ["ann"] });
    const unsure = sceneFromAnswers(now, { when: said("night", 0.5), here_ann: said("away", 0.5), here_cy: said("here", 0.5) });
    expect(unsure).toEqual({ here: [], away: [] });
  });

  test("what it already shows changes nothing", () => {
    const r = sceneFromAnswers({ time: "morning", people }, { when: said("same", 0.9), here_ann: said("here", 0.9), here_bo: said("away", 0.9) });
    expect(r).toEqual({ here: [], away: [] });
  });

  test("the clock goes forward, into tomorrow if that hour has passed", () => {
    const s = newScene(world());
    const night = clockTo(s, TIMES.indexOf("night"));
    expect([night.day, night.time]).toEqual([1, 3]);
    const next = clockTo({ ...night, searched: ["hall"] }, TIMES.indexOf("morning"));
    expect([next.day, next.time, next.searched]).toEqual([2, 0, []]);
  });

  test("someone who arrives leaves where they were", () => {
    const w = seatPeople(world(), "hall", ["cy"], []);
    expect(w.places.hall!.people).toEqual(["ann", "bo", "cy"]);
    expect(w.places.yard!.people).toEqual([]);
  });

  test("someone who leaves goes next door, and nobody else moves", () => {
    const w0 = { shape: "town", start: "hall", places: { hall: { ...place("hall", ["ann", "bo"]), exits: ["cellar"] }, yard: place("yard", ["cy"]), cellar: place("cellar", []) } } as unknown as World;
    const w = seatPeople(w0, "hall", [], ["ann"]);
    expect(w.places.hall!.people).toEqual(["bo"]);
    expect(w.places.cellar!.people).toEqual(["ann"]);
    expect(w.places.yard!.people).toEqual(["cy"]);
  });

  test("nothing said, nothing changed", () => {
    const w = world();
    expect(seatPeople(w, "hall", [], [])).toBe(w);
  });
});
