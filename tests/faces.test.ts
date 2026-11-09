import { describe, expect, test } from "bun:test";
import { facesOfCharacter } from "../src/backend/card-faces.js";
import { facesFromLabels, facesFromRisu, groupFor, moodOfLabel } from "../src/engine/card/faces.js";
import { bestNameMatch, sameName } from "../src/engine/card/names.js";

describe("names", () => {
  test("titles, underscores, and dots do not make two people", () => {
    expect(sameName("Prince Corvin", "Corvin")).toBe(true);
    expect(sameName("Tomas_Reyne", "Tomas")).toBe(true);
    expect(sameName("Corvin Ashmere", "Stella Ashmere")).toBe(false);
  });

  test("names in any script match, and Latin accents don't matter", () => {
    expect(sameName("레퍼리드 사단", "레퍼리드 사단")).toBe(true);
    expect(sameName("레퍼리드", "레퍼리드 사단")).toBe(true);
    expect(sameName("레퍼리드 사단", "김철수")).toBe(false);
    expect(sameName("Élodie", "elodie")).toBe(true);
    expect(bestNameMatch("リリム", ["ベスパー", "リリム"], (p) => p)).toBe("リリム");
  });

  test("an ambiguous loose match is no match; an exact one wins", () => {
    const people = ["Ryuzu_Shima", "Ryuzu_Delma", "Ryuzu", "Rem", "Ram"];
    expect(bestNameMatch("Ryuzu", people, (p) => p)).toBe("Ryuzu");
    expect(bestNameMatch("Ryuzu Meyer", ["Ryuzu_Shima", "Ryuzu_Delma"], (p) => p)).toBeNull();
    expect(bestNameMatch("Rem", people, (p) => p)).toBe("Rem");
  });
});

describe("faces from art the user has", () => {
  test("sprite labels map to moods; actions and explicit labels never do", () => {
    expect(moodOfLabel("narcissa_happy")).toBe("happy");
    expect(moodOfLabel("expr_narcissa_crying")).toBe("sad");
    expect(moodOfLabel("Joy")).toBe("happy");
    expect(moodOfLabel("happy_tears")).toBe("happy");
    expect(moodOfLabel("narcissa_neutral")).toBe("neutral");
    expect(moodOfLabel("received_headpat")).toBeNull();
    expect(moodOfLabel("french_kiss")).toBeNull();
    expect(moodOfLabel("nude_happy")).toBeNull();
  });

  test("a card's expression mappings become a face set", () => {
    const f = facesFromLabels({ narcissa_neutral: "n", narcissa_happy: "h", narcissa_laughing: "l", narcissa_scared: "s", narcissa_love: "x" }, "expressions")!;
    expect(f.base).toBe("n");
    expect(f.expressions).toEqual({ happy: "h", hurt: "s" });
  });

  test("a multi-character Risu map gives one person's safe variant", () => {
    const map = {
      "Mira.young": "ey",
      "Mira.young.surprised": "e1",
      "Mira.young.sad": "e2",
      "Mira.young.kiss": "k",
      "Mira.nude": "bad",
      "Mira.nude.happy": "bad1",
      "Mira.nude.sad": "bad2",
      "Mira.nude.angry": "bad3",
      "Mira.old": "eo",
      "Mira.old.happy": "o1",
      "Rem.young": "r",
      "Rem.young.happy": "r1",
      Tomas_Reyne: "s",
    };
    const mira = facesFromRisu(map, "Mira", false)!;
    expect([mira.base, mira.expressions]).toEqual(["ey", { surprised: "e1", sad: "e2" }]);
    expect(Object.values(mira.expressions)).not.toContain("bad1");
    expect(facesFromRisu(map, "Tomas", false)).toEqual({ base: "s", expressions: {}, source: "risu" });
    expect(facesFromRisu(map, "Beatrice", false)).toBeNull();
  });

  test("flat Risu labels belong to the card's one character, or to whoever they name", () => {
    const map = { expr_narcissa_happy: "h", expr_narcissa_angry: "a", gallery_beach: "g" };
    expect(facesFromRisu(map, "Narcissa Roux", false)!.expressions).toEqual({ happy: "h", angry: "a" });
    expect(facesFromRisu({ happy: "h" }, "Anyone", true)!.expressions).toEqual({ happy: "h" });
    expect(facesFromRisu({ happy: "h" }, "Anyone", false)).toBeNull();
  });

  test("Risu assets listed under their file names too are still one person's sprites, and sex positions are no face", () => {
    const map = { "Lilim_Reverse Standing Position.webp": "x", "Lilim_Reverse Standing Position": "x", "Lilim_angry.webp": "a", Lilim_angry: "a", "Lilim_standing.webp": "s", Lilim_standing: "s", "Vesper_joyful.webp": "v", Vesper_joyful: "v" };
    expect(facesFromRisu(map, "Lilim", false)).toEqual({ base: "s", expressions: { angry: "a" }, source: "risu" });
    expect(facesFromRisu(map, "Vesper", false)!.expressions).toEqual({ happy: "v" });
  });

  test("expression groups are found by name", () => {
    const groups = { "Prince Corvin": { neutral: "n", sad: "s" }, Odile: { happy: "o" } };
    expect(facesFromLabels(groupFor(groups, "Corvin")!, "groups")).toEqual({ base: "n", expressions: { sad: "s" }, source: "groups" });
    expect(groupFor(groups, "Brannoc")).toBeNull();
  });
});

describe("faces of a Lumiverse character", () => {
  test("their own card: sprites become moods, the avatar is the base when no neutral sprite exists", () => {
    const narcissa = { id: "n", image_id: "avatar", extensions: { expressions: { enabled: true, mappings: { narcissa_happy: "h", narcissa_sad: "s" } } } };
    expect(facesOfCharacter(narcissa, "Narcissa Roux", true)).toEqual({ base: "avatar", expressions: { happy: "h", sad: "s" }, source: "expressions" });
    expect(facesOfCharacter({ id: "x", image_id: "a", extensions: {} }, "Corvin", true)).toEqual({ base: "a", expressions: {}, source: "avatar" });
  });

  test("someone else on the card: only their group or their named assets, never the card's own sprites or avatar", () => {
    const card = { id: "c", image_id: "avatar", extensions: { expressions: { mappings: { happy: "card-happy" } }, expression_groups: { Odile: { neutral: "o", sad: "os" } } } };
    expect(facesOfCharacter(card, "Odile", false)).toEqual({ base: "o", expressions: { sad: "os" }, source: "groups" });
    expect(facesOfCharacter(card, "Brannoc", false)).toBeNull();
  });
});
