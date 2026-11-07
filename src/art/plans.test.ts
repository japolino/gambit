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
    insetOff: new Set(),
    ...over,
  };
}

const labels = (spec: ArtSpec, c: PlanContext, priority: 0 | 1 | 2 | 3 = 1) => plansFor(c, "k", spec, priority).map((p) => `${p.lane}:${p.label}`);

describe("route order", () => {
  test("variants: anime looks try the V5 inset first, painted looks the GPT edit", () => {
    expect(variantMethods(LOOKS.modern_anime, ALL)).toEqual(["v5_inset", "gpt_edit", "nai45_reference", "plain"]);
    expect(variantMethods(LOOKS.painted_dark_fantasy, ALL)).toEqual(["gpt_edit", "v5_inset", "nai45_reference", "plain"]);
    expect(variantMethods(LOOKS.modern_anime, { nai: null, nai45: null, gpt: GPT })).toEqual(["gpt_edit", "plain"]);
    expect(variantMethods(LOOKS.modern_anime, ALL, new Set(["nai-1\u0000nai-diffusion-5-full-inpainting"]))).toEqual(["gpt_edit", "nai45_reference", "plain"]);
    expect(variantMethods(LOOKS.modern_anime, { nai: null, nai45: null, gpt: null })).toEqual([]);
  });

  test("expression plans under an anime look", () => {
    const spec: ArtSpec = { kind: "expression", character: HERO, expression: "angry", canonical: { imageId: "canon" } };
    expect(labels(spec, ctx(ALL, "modern_anime"))).toEqual(["nai:nai-v5-inset-sprite", "gpt:gpt-edit-canonical", "nai:nai45-reference", "nai:nai-v5-dna", "gpt:gpt"]);
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
    expect(labels({ kind: "monster_phase2", monster: monsterBrief({ id: "w", name: "W", visual: { brief: "wolf", palette: "", rig: "standing" } }), phase1: { imageId: "p1" }, change: "burning" }, anchored)[0]).toBe("gpt:gpt-edit-phase1");
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
    expect(await inset!.finish!({ imageId: "canvas", url: "/u", cutout: false })).toMatchObject({ imageId: "crop-canvas" });
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

  test("V4.5 precise reference with the canonical", async () => {
    const plans = plansFor(ctx({ nai: NAI, nai45: { ...NAI, model: "nai-diffusion-4-5-full" }, gpt: null }, "painted_dark_fantasy", { insetOff: new Set(["nai-1\u0000nai-diffusion-5-full-inpainting"]) }), "k", { kind: "expression", character: HERO, expression: "sad", canonical: { imageId: "canon" } }, 1);
    expect(plans[0]!.label).toBe("nai45-reference");
    const call = await plans[0]!.prepare();
    expect(call.model).toBe("nai-diffusion-4-5-full");
    expect(call.parameters).toMatchObject({ resolvedReferenceImages: [{ data: "B64-canon", strength: 0.8, infoExtracted: 1, refType: "character&style" }], referenceFidelity: 1 });
    expect(call.prompt).toContain("white background");
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

  test("older NAI models get a white background instead", () => {
    const b = buildPrompt({ kind: "portrait", character: HERO }, LOOKS.modern_anime, { naiAlpha: false });
    expect(b.nai.prompt).toContain("white background");
    expect(b.nai.characterTags).toEqual(["girl, silver hair, green eyes, leather armor, light smile"]);
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
