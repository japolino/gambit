/**
 * Children are never foes and never in an adult scene (engine/card/child.ts): a narrow check on the words a sheet
 * already has, which leaves adults described as young or little alone.
 */
import { describe, expect, test } from "bun:test";
import { isChild } from "../src/engine/card/child.js";
import type { CardSheet } from "../src/engine/card/types.js";
import { parseArmory } from "../src/meaning/armory.js";

/** The Leporid Division card's battalion, as the card has it. */
const LEPORID =
  "- The Recruit Maturation Battalion: This unit takes the one-month-old offspring and breaks them into perfect soldiers. Through a harrowing regime of live-fire exercises, brutal physical conditioning, and intense sexual desensitization... the recruits are molded into fearless, breeding-obsessed killing machines ready to die and reproduce for the Leporid Division.\n- The Shock Battalion: grown rabbit-girl soldiers who storm the trenches.";

describe("who is a child", () => {
  test("an age under 18, or the plain words for a child, a baby, or someone months old", () => {
    for (const t of ["a 12-year-old squire", "Mina (9)", "age: 15", "the one-month-old offspring", "three weeks old", "an infant prince", "the village children", "생후 3개월", "6개월 된 새끼", "마을 아이들", "어린이", "12살 소녀", "子供の兵士", "孩子"]) expect([t, isChild(t)]).toEqual([t, true]);
  });

  test("adults called young, little or kid, and words that only contain the word, are not", () => {
    for (const t of ["young woman", "youthful knight", "little sister (24)", "a soldier the squad calls 'kid'", "Old Man Hale, 70 years old", "a mother who guards her children", "Children of the Forest", "child-bearing hips", "baby blue eyes", "아이템 상인", "아이돌 가수", "3세대 기사", "25세 여성"]) expect([t, isChild(t)]).toEqual([t, false]);
  });
});

describe("the armory", () => {
  const sheet = {
    cardKey: "k", cardName: "레퍼리드 사단", premise: "", tone: "", skin: { genre: "military", currency: "", fight: "firefight", stats: {} },
    player: { name: "Hero", concept: "a soldier" }, places: [], facts: [], cast: [],
  } as unknown as CardSheet;

  test("never makes a foe of a child, even one the card only calls a recruit next to its words", () => {
    const raw = {
      foes: [
        { id: "maturation_recruit", name: "Maturation Recruit", look: "Young rabbit-girl shock soldier in scuffed tactical gear and knee pads", role: "assassin", quote: "Through a harrowing regime of live-fire exercises, brutal physical conditioning, and intense sexual desensitization... the recruits are molded into fearless, breeding-obsessed killing machines" },
        { id: "shock_trooper", name: "Shock Trooper", look: "a young woman in a plate carrier", role: "brute", quote: "grown rabbit-girl soldiers who storm the trenches" },
      ],
    };
    expect(parseArmory(raw, sheet, () => true, LEPORID).foes.map((f) => f.id)).toEqual(["shock_trooper"]);
  });
});
