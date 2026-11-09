import { describe, expect, test } from "bun:test";
import { variantMethods } from "./consistency.js";
import { LOOKS, providerOrder } from "./looks.js";
import type { PlanContext } from "./plan-kit.js";
import { plansFor, seedFor } from "./plans.js";
import type { GptTarget, NaiTarget, ProviderSet } from "./providers.js";
import { buildPrompt, colorName, dnaFromClass, monsterBrief, type ArtSpec, type CharacterDNA } from "./specs.js";

const NAI: NaiTarget = { provider: "novelai", connectionId: "nai-1", connectionName: "NAI", model: "nai-diffusion-5-full", connectionOverride: null };
const GPT: GptTarget = { provider: "openai", connectionId: "gpt-1", connectionName: "Proxy", model: "gpt-image-2.6", gptImageModel: true, connectionOverride: null };
const ALL: ProviderSet = { nai: NAI, nai45: { ...NAI, model: "nai-diffusion-4-5-full" }, gpt: GPT };

const HERO: CharacterDNA = { id: "hero", name: "Ash", tags: "silver hair, green eyes, leather armor", description: "a lean swordswoman with silver hair and green eyes in worn leather armour", seed: 4242, sex: "girl", palette: "#8a1c1c,#2b2b2b" };

function ctx(providers: ProviderSet, lookId: keyof typeof LOOKS = "painted_dark_fantasy", over: Partial<PlanContext> = {}): PlanContext {
  return {
    providers,
    look: LOOKS[lookId],
    lock: null,
    readImage: async (id) => ({ data: `B64-${id}`, mimeType: "image/png" }),
    composeInset: async () => ({ ok: true, canvas: { image: "IMG", mask: "MASK" } }),
    cropImage: async (src) => ({ ...src, imageId: `crop-${src.imageId}` }),
    cutImage: async (src) => ({ ...src, imageId: `cut-${src.imageId}`, cutout: true }),
    insetOff: new Set(),
    ...over,
  };
}

const labels = (spec: ArtSpec, c: PlanContext, priority: 0 | 1 | 2 | 3 = 1) => plansFor(c, "k", spec, priority).map((p) => `${p.lane}:${p.label}`);

describe("route order", () => {
  test("variants: anime looks try the V5 inset first, painted looks the GPT edit", () => {
    expect(variantMethods(LOOKS.modern_anime, ALL)).toEqual(["v5_inset", "gpt_edit", "plain"]);
    expect(variantMethods(LOOKS.painted_dark_fantasy, ALL)).toEqual(["gpt_edit", "v5_inset", "plain"]);
    expect(variantMethods(LOOKS.modern_anime, { nai: null, nai45: null, gpt: GPT })).toEqual(["gpt_edit", "plain"]);
    expect(variantMethods(LOOKS.modern_anime, ALL, new Set(["nai-1\u0000nai-diffusion-5-full-inpainting"]))).toEqual(["gpt_edit", "plain"]);
    expect(variantMethods(LOOKS.modern_anime, { nai: null, nai45: null, gpt: null })).toEqual([]);
  });

  test("expression plans under an anime look", () => {
    const spec: ArtSpec = { kind: "expression", character: HERO, expression: "angry", canonical: { imageId: "canon" } };
    expect(labels(spec, ctx(ALL, "modern_anime"))).toEqual(["nai:nai-v5-inset-sprite", "gpt:gpt-edit-canonical", "nai:nai-v5-dna", "gpt:gpt"]);
  });

  test("no V4.5 reference anywhere: card art leads with the V5 inset, then a plain render from tags", () => {
    expect(variantMethods(LOOKS.painted_dark_fantasy, ALL, new Set(), true)).toEqual(["v5_inset", "gpt_edit", "plain"]);
    const spec: ArtSpec = { kind: "expression", character: HERO, expression: "sad", canonical: { imageId: "avatar", source: "card" } };
    expect(labels(spec, ctx(ALL, "modern_anime"))).toEqual(["nai:nai-v5-inset-sprite", "gpt:gpt-edit-canonical", "nai:nai-v5-dna", "gpt:gpt"]);
    expect(labels(spec, ctx({ nai: null, nai45: null, gpt: null }, "modern_anime"))).toEqual([]);
  });

  test("pose uses the wide inset; portrait follows the look; monster prefers NAI under the default look", () => {
    expect(labels({ kind: "pose", character: HERO, pose: "lunging thrust", canonical: { imageId: "c" } }, ctx(ALL, "modern_anime"))[0]).toBe("nai:nai-v5-inset-wide");
    expect(labels({ kind: "portrait", character: HERO }, ctx(ALL))).toEqual(["gpt:gpt", "nai:nai-v5"]);
    const wolf: ArtSpec = { kind: "monster", monster: { id: "wolf", name: "Ash Wolf", brief: "a gaunt wolf with ember eyes", palette: "#333333,#ff6600", rig: "standing" } };
    expect(labels(wolf, ctx(ALL), 3)).toEqual(["nai:nai-v5-medium", "gpt:gpt"]);
    expect(providerOrder(LOOKS.grim_realism, "monster")).toEqual(["gpt", "nai"]);
  });

  test("with a style anchor, GPT plans try anchored first; edits and fusion use their sources", () => {
    const anchored = ctx(ALL, "painted_dark_fantasy", { lock: { version: 1, lookId: "painted_dark_fantasy", lockedAt: 1, anchors: { bust: { imageId: "bust", url: "/b" }, gate: { imageId: "gate", url: "/g" } } } });
    expect(labels({ kind: "portrait", character: HERO }, anchored)).toEqual(["gpt:gpt-anchored", "gpt:gpt", "nai:nai-v5"]);
    expect(plansFor(anchored, "k", { kind: "background", location: { id: "l", name: "Market", description: "stalls" } }, 1)[0]!.descriptor.refs).toEqual(["gate"]);
    expect(labels({ kind: "portrait", character: HERO, parents: [{ imageId: "p1" }, { imageId: "p2" }] }, anchored)[0]).toBe("gpt:gpt-fusion");
    expect(labels({ kind: "monster_phase2", monster: monsterBrief({ id: "w", name: "W", talks: false, visual: { brief: "wolf", palette: "", rig: "standing" } }), phase1: { imageId: "p1" }, change: "burning" }, anchored)[0]).toBe("gpt:gpt-edit-phase1");
    expect(labels({ kind: "icon_sheet", icons: [{ key: "i1", brief: "a potion" }] }, ctx({ nai: NAI, nai45: null, gpt: null }))).toEqual([]);
  });
});

describe("plan preparation (the exact generate calls)", () => {
  test("V5 inset: canvas from the browser, inpainting model, crop on finish", async () => {
    const composed: string[] = [];
    const c = ctx(ALL, "modern_anime", { composeInset: async (layout, url) => (composed.push(`${layout} ${url}`), { ok: true, canvas: { image: "IMG", mask: "MASK" } }) });
    const [inset] = plansFor(c, "k", { kind: "expression", character: HERO, expression: "happy", canonical: { imageId: "canon" } }, 2);
    const call = await inset!.prepare();
    expect(composed).toEqual(["sprite /api/v1/images/canon"]);
    expect(call.model).toBe("nai-diffusion-5-full-inpainting");
    expect(call.prompt.startsWith("split screen, 1girl, anime coloring")).toBe(true);
    expect(call.prompt).toContain("white background");
    expect(call.prompt).not.toContain("transparent background");
    expect(call.parameters).toMatchObject({ resolution: "1216x832", steps: 14, seed: 4242, characterTags: [{ tags: "girl, silver hair, green eyes, leather armor, smile, open mouth, happy" }] });
    const raw = JSON.parse((call.parameters as Record<string, string>).rawRequestOverride!);
    expect(raw).toMatchObject({ action: "infill", parameters: { image: "IMG", mask: "MASK", width: 1216, height: 832, noise: 0 } });
    expect(await inset!.finish!({ imageId: "canvas", url: "/u", cutout: false })).toMatchObject({ imageId: "cut-canvas", cutout: true });
    expect(inset!.descriptor.refs).toEqual(["canon"]);
  });

  test("no canvas -> PlanUnavailable", async () => {
    const c = ctx(ALL, "modern_anime", { composeInset: async () => ({ ok: false, error: "closed", timedOut: true }) });
    const [inset] = plansFor(c, "k", { kind: "expression", character: HERO, expression: "happy", canonical: { imageId: "canon" } }, 1);
    await expect(inset!.prepare()).rejects.toThrow("no inset canvas");
  });

  test("an inset NovelAI rejects switches the inset off for the session", () => {
    const c = ctx(ALL, "modern_anime");
    const [inset] = plansFor(c, "k", { kind: "expression", character: HERO, expression: "happy", canonical: { imageId: "canon" } }, 1);
    expect(inset!.rejects!(new Error("NovelAI image generate failed (429): Concurrent generation is locked"))).toBe(false);
    expect(inset!.rejects!(new Error("NovelAI image generate failed (404): not found"))).toBe(true);
    expect(c.insetOff.has("nai-1\u0000nai-diffusion-5-full-inpainting")).toBe(true);
  });

  test("GPT edit of the canonical: source bytes, fidelity high, transparent", async () => {
    const [edit] = plansFor(ctx(ALL), "k", { kind: "expression", character: HERO, expression: "sad", canonical: { imageId: "canon" } }, 0);
    const call = await edit!.prepare();
    expect(call.parameters).toMatchObject({ background: "transparent", inputFidelity: "high", quality: "high", size: "1024x1536", resolvedSourceImages: [{ data: "B64-canon", mimeType: "image/png" }] });
    expect(call.prompt).toContain("The same character as in the reference image");
  });

  test("a figure is a plain transparent V5 render from its tags, with no reference image", async () => {
    const tagged = { ...HERO, booru: "some character (series), red eyes, long coat" };
    const plans = plansFor(ctx({ nai: NAI, nai45: { ...NAI, model: "nai-diffusion-4-5-full" }, gpt: null }, "modern_anime"), "k", { kind: "figure", character: tagged }, 1);
    expect(plans.map((p) => p.label)).toEqual(["nai-v5"]);
    const call = await plans[0]!.prepare();
    expect(call.parameters).not.toHaveProperty("resolvedReferenceImages");
    expect(call.prompt).toContain("full body");
    expect(JSON.stringify(call)).toContain("some character (series)");
  });

  test("user id rides on every call", async () => {
    const [p] = plansFor(ctx(ALL, "painted_dark_fantasy", { userId: "u-7" }), "k", { kind: "background", location: { id: "l", name: "Gate", description: "stone" } }, 1);
    expect((await p!.prepare()).userId).toBe("u-7");
  });
});

describe("prompts", () => {
  test("V5 transparent monster tags; no text anywhere", () => {
    const b = buildPrompt({ kind: "monster", monster: { id: "w", name: "Ash Wolf", brief: "gaunt wolf, ember eyes", palette: "#222222,#ff6600", rig: "floating" } }, LOOKS.modern_anime, { naiAlpha: true });
    expect(b.transparent).toBe(true);
    expect(b.nai.prompt).toContain("transparent background");
    expect(b.nai.prompt).toContain("floating");
    expect(b.nai.prompt).toContain("orange theme");
    expect(b.nai.negative).toContain("watermark");
    expect(b.nai.negative.split(", ")).not.toContain("background");
    expect(b.gpt.prompt).toContain("transparent background");
    expect(b.gpt.prompt).toContain("No text");
    expect(b.nai).toMatchObject({ width: 1024, height: 1024 });
  });

  test("a foe who is a person is drawn as one; a creature stays a creature", () => {
    const foe = (brief: string, talks: boolean) => buildPrompt({ kind: "monster", monster: monsterBrief({ id: "f", name: "Foe", talks, visual: { brief, palette: "", rig: "standing" } }) }, LOOKS.modern_anime, { naiAlpha: true });
    const knight = foe("A proud noblewoman encased in polished silver plate armor", true);
    expect(knight.nai.prompt).toStartWith("1girl, solo");
    expect(knight.nai.prompt).not.toContain("no humans");
    expect(knight.nai.negative).not.toContain("1girl");
    expect(foe("guild thief with twin daggers and a hooded cloak", true).nai.prompt).toStartWith("1other, solo");
    expect(foe("a talking dragon with emerald scales", true).nai.prompt).toStartWith("no humans, solo, monster, creature");
    expect(foe("bloated drowned dockhand, barnacles on grey skin", false).nai.prompt).toStartWith("no humans");
  });

  test("older NAI models get a white background instead", () => {
    const b = buildPrompt({ kind: "portrait", character: HERO }, LOOKS.modern_anime, { naiAlpha: false });
    expect(b.nai.prompt).toContain("white background");
    expect(b.nai.characterTags).toEqual(["girl, silver hair, green eyes, leather armor, light smile"]);
  });

  test("an expression drawn from a card's own art leaves the style to the reference", () => {
    const spec: ArtSpec = { kind: "expression", character: { ...HERO, tags: "an ancient owl demon of the high nobility." }, expression: "sad", canonical: { imageId: "avatar", source: "card" } };
    const b = buildPrompt(spec, LOOKS.painted_dark_fantasy, { naiAlpha: false });
    expect(b.nai.prompt).not.toContain("oil painting");
    expect(b.nai.negative).not.toContain("anime coloring");
    expect(b.nai.negative).toContain("watermark");
    expect(b.nai.characterTags[0]).not.toContain("owl demon");
    expect(b.nai.characterTags[0]).toContain("sad");
    expect(b.gpt.prompt).toContain("Match the reference image's art style exactly.");
    // Gambit's own characters still get the look.
    expect(buildPrompt({ ...spec, canonical: { imageId: "c" } }, LOOKS.painted_dark_fantasy, { naiAlpha: false }).nai.prompt).toContain("oil painting");
  });

  test("library tags (Inlay) ride on a card expression, where the reader's prose does not", () => {
    const spec: ArtSpec = { kind: "expression", character: { ...HERO, tags: "an ancient owl demon of the high nobility.", booru: "owl head, four eyes, red eyes, dark red silk robe" }, expression: "sad", canonical: { imageId: "avatar", source: "card" } };
    const caption = buildPrompt(spec, LOOKS.painted_dark_fantasy, { naiAlpha: false }).nai.characterTags[0]!;
    expect(caption).toContain("four eyes");
    expect(caption).toContain("dark red silk robe");
    expect(caption).not.toContain("high nobility");
    expect(caption).toContain("sad");
  });

  test("backgrounds are opaque and wide; probes use the probed look", () => {
    const bg = buildPrompt({ kind: "background", location: { id: "l", name: "Old Mill", description: "a ruined watermill", timeOfDay: "dusk" } }, LOOKS.ink_wash);
    expect(bg.transparent).toBe(false);
    expect(bg.gpt.size).toBe("1536x1024");
    const probe = buildPrompt({ kind: "style_probe", subject: "gate", lookId: "grim_realism" }, LOOKS.modern_anime);
    expect(probe.nai.prompt).toContain("photorealistic");
    expect(probe.gpt.prompt).toContain("Grim");
  });

  test("seeds: spec, then DNA, then key", () => {
    expect(seedFor("k", { kind: "portrait", character: HERO, seed: 9 })).toBe(9);
    expect(seedFor("k", { kind: "portrait", character: HERO })).toBe(4242);
    expect(seedFor("k", { kind: "background", location: { id: "l", name: "a", description: "b" } })).toBe(seedFor("k", { kind: "background", location: { id: "x", name: "y", description: "z" } }));
  });

  test("palette colour names and class DNA", () => {
    expect(["#ff0000", "#00ff00", "#0000ff", "#111111", "#ffffff", "#808080", "#8a1c1c"].map(colorName)).toEqual(["red", "green", "blue", "black", "white", "grey", "dark red"]);
    const dna = dnaFromClass({ id: "knight", name: "Knight", visual: { brief: "heavy plate armor, tower shield", palette: "#888888" } }, { id: "p", name: "Bram", seed: 1, sex: "boy" });
    expect(dna).toMatchObject({ tags: "heavy plate armor, tower shield", palette: "#888888" });
  });
});
