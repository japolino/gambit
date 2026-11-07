import { describe, expect, test } from "bun:test";
import { inlayLookOf, inlayMemberFor, parseInlayCharacter, type InlayMember } from "../src/engine/card/inlay.js";

const form = (over: Record<string, unknown> = {}) => ({
  id: "form_default",
  label: "Tall Owl Demon",
  gender: "male",
  humanlike: true,
  tags: "owl head, four eyes, red eyes",
  negative: "",
  referenceImageId: "img-form",
  defaultOutfitId: "robe",
  outfits: [
    { id: "coat", label: "Tailcoat", tags: "dark purple tailcoat", referenceImageId: null },
    { id: "robe", label: "Dark Red Robe", tags: "small golden crown, dark red silk robe", referenceImageId: "img-robe" },
  ],
  ...over,
});
const member = (name: string, aliases: string[], over: Record<string, unknown> = {}): InlayMember =>
  ({ key: name, kind: "custom", name, aliases, defaultFormId: "form_default", forms: [form(over)] }) as InlayMember;

describe("Inlay's character library", () => {
  test("only version 1 values parse", () => {
    expect(parseInlayCharacter({ version: 2, characterId: "c", members: [] })).toBeNull();
    expect(parseInlayCharacter(null)).toBeNull();
    const ok = parseInlayCharacter({ version: 1, characterId: "c", updatedAt: "", members: [member("Corvin", []), { bad: true }] })!;
    expect(ok.members.map((m) => m.name)).toEqual(["Corvin"]);
  });

  test("people are found by name or alias; a loose match must be the only one", () => {
    const members = [member("Corvin", ["Prince Corvin"]), member("Stella", ["Stella Ashmere"]), member("Cleaver Imp", ["first imp"])];
    expect(inlayMemberFor(members, "Prince Corvin")!.name).toBe("Corvin");
    expect(inlayMemberFor(members, "Stella Ashmere")!.name).toBe("Stella");
    expect(inlayMemberFor(members, "Odile")).toBeNull();
    expect(inlayMemberFor([member("Ryuzu Shima", []), member("Ryuzu Delma", [])], "Ryuzu")).toBeNull();
  });

  test("the look is the default form's tags plus the default outfit's, with the outfit's reference first", () => {
    const look = inlayLookOf("card", member("Corvin", []))!;
    expect(look.tags).toBe("owl head, four eyes, red eyes, small golden crown, dark red silk robe");
    expect(look.referenceImageId).toBe("img-robe");
    expect(look.outfit).toBe("Dark Red Robe");
    expect(look.sex).toBe("boy");
    // No outfit reference: the form's.
    expect(inlayLookOf("card", member("Corvin", [], { defaultOutfitId: "coat" }))!.referenceImageId).toBe("img-form");
  });
});
