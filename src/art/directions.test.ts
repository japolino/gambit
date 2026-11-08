import { describe, expect, test } from "bun:test";
import type { SkillDef } from "../engine/types.js";
import { cutinAction } from "./directions.js";
import { buildPrompt } from "./specs.js";
import { LOOKS } from "./looks.js";

const skill = (atoms: SkillDef["atoms"], o: Partial<SkillDef> = {}): SkillDef => ({ id: "s", name: "Cinder Lance", target: "enemy" as SkillDef["target"], atoms, tier: 3, ...o });

describe("cut-in direction", () => {
  test("a spirit fire hit is a spell thrust at the viewer, in flames", () => {
    const a = cutinAction(skill([{ op: "hit", element: "fire", scale: "spirit", power: 3 as never }], { visual: { fx: ["glyph_ring", "speed_lines"] } }));
    expect(a.tags).toContain("casting spell");
    expect(a.tags).toContain("fire");
    expect(a.tags).toContain("magic circle");
    expect(a.text).toContain("Cinder Lance");
  });

  test("a might hit is a weapon strike; a heal is light between the hands", () => {
    expect(cutinAction(skill([{ op: "hit", element: "physical", scale: "might", power: 2 as never }])).tags).toContain("weapon swing");
    expect(cutinAction(skill([{ op: "heal", power: 2 as never }])).tags).toContain("healing magic");
    expect(cutinAction(undefined).tags).toContain("fighting stance");
  });

  test("the pose spec asks for a landscape splash with effects allowed", () => {
    const look = Object.values(LOOKS)[0]!;
    const built = buildPrompt({ kind: "pose", character: { id: "a", name: "A", tags: "1girl, red hair", description: "a knight", seed: 1, sex: "girl" }, pose: "attacking, fire", canonical: { imageId: "x" } }, look, { naiAlpha: true });
    expect(built.nai.width).toBeGreaterThan(built.nai.height);
    expect(built.nai.prompt).toContain("foreshortening");
    expect(built.nai.negative).not.toContain("special effects");
    expect(built.nai.characterTags[0]).toContain("attacking, fire");
  });

  test("a Parley CG is shot from the speaker's eyes, the reaction on the person", () => {
    const look = Object.values(LOOKS)[0]!;
    const built = buildPrompt(
      { kind: "cg", direction: "parley", moment: "she catches the lie", tags: "smug, pointing at viewer", cast: [{ character: { id: "a", name: "A", tags: "1girl", description: "a fence", seed: 1, sex: "girl" } }] },
      look,
    );
    expect(built.nai.prompt).toContain("pov");
    expect(built.nai.prompt).not.toContain("pointing at viewer");
    expect(built.nai.characterTags[0]).toContain("pointing at viewer");
    expect(built.gpt.prompt).toContain("POV");
  });
});
