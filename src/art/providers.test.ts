import { describe, expect, test } from "bun:test";
import { buildGptCall, buildNaiCall, discoverProviders, effortFor, isRetryableImageError, isConcurrentLockError, providersFromConnections, type GptTarget, type NaiTarget } from "./providers.js";
import { compileNovelAiInsetRequest, insetNegative, insetPrompt, novelAiInsetModelFor, novelAiInsetRejected } from "./nai-inset.js";
import { INSET_LAYOUTS } from "./inset-geometry.js";
import { connection, createFakeHost } from "./testing/fake-host.js";

const NAI: NaiTarget = { provider: "novelai", connectionId: "nai-1", connectionName: "NAI", model: "nai-diffusion-5-full", connectionOverride: null };
const GPT: GptTarget = { provider: "openai", connectionId: "gpt-1", connectionName: "Proxy", model: "gpt-image-2.6", gptImageModel: true, connectionOverride: null };

describe("discovery", () => {
  test("picks NovelAI (V5, default first) and an OpenAI GPT-image connection", async () => {
    const fake = createFakeHost({
      connections: [
        connection({ id: "nai-old", provider: "novelai", model: "nai-diffusion-4-5-full" }),
        connection({ id: "nai-v5", provider: "novelai", model: "nai-diffusion-5-curated", default_parameters: { rawRequestOverride: '{"parameters":{"cfg_rescale":0.2}}' } }),
        connection({ id: "dalle", provider: "openai", model: "dall-e-3" }),
        connection({ id: "proxy", provider: "openai", model: "gpt-image-2.6", api_url: "http://127.0.0.1:8317/v1" }),
        connection({ id: "gem", provider: "google_gemini", model: "x", is_default: true }),
      ],
    });
    const set = await discoverProviders(fake.host);
    expect(set.nai).toMatchObject({ connectionId: "nai-v5", model: "nai-diffusion-5-curated", connectionOverride: '{"parameters":{"cfg_rescale":0.2}}' });
    expect(set.nai45).toMatchObject({ connectionId: "nai-v5", model: "nai-diffusion-4-5-full" });
    expect(set.gpt).toMatchObject({ connectionId: "proxy", model: "gpt-image-2.6", gptImageModel: true });
  });

  test("a NovelAI connection on V4.5 still draws V5 Full; none -> empty set", async () => {
    expect(providersFromConnections([connection({ id: "n", provider: "novelai", model: "nai-diffusion-4-5-full" })]).nai?.model).toBe("nai-diffusion-5-full");
    expect(providersFromConnections([])).toEqual({ nai: null, nai45: null, gpt: null });
    const broken = createFakeHost();
    broken.host.imageGen.listConnections = async () => {
      throw new Error("permission denied");
    };
    expect(await discoverProviders(broken.host)).toEqual({ nai: null, nai45: null, gpt: null });
  });

  test("effort by priority", () => {
    expect([0, 1, 2, 3].map(effortFor)).toEqual(["full", "full", "medium", "medium"]);
  });
});

describe("NovelAI call shapes", () => {
  test("V5 Full portrait (P0/P1): host params + override with our negative", () => {
    const call = buildNaiCall({
      target: NAI,
      prompt: "1girl, painterly, solo, transparent background",
      negative: "lowres, text",
      width: 832,
      height: 1216,
      seed: 1234,
      effort: "full",
      characterTags: ["girl, silver hair"],
      transparent: true,
    });
    const { rawRequestOverride, ...params } = call.parameters as Record<string, unknown>;
    expect({ ...call, parameters: params }).toEqual({
      connection_id: "nai-1",
      model: "nai-diffusion-5-full",
      prompt: "1girl, painterly, solo, transparent background",
      negativePrompt: "lowres, text",
      includeDataUrl: false,
      parameters: {
        resolution: "832x1216",
        sampler: "k_euler_ancestral",
        steps: 28,
        guidance: 5,
        seed: 1234,
        negativePrompt: "lowres, text",
        characterTags: [{ tags: "girl, silver hair" }],
      },
    });
    expect(JSON.parse(rawRequestOverride as string)).toEqual({
      parameters: {
        negative_prompt: "lowres, text",
        params_version: 4,
        qualityToggle: true,
        noise_schedule: "karras",
        extra_noise_seed: 1234,
        image_format: "png",
        v4_negative_prompt: { caption: { base_caption: "lowres, text", char_captions: [{ char_caption: "lowres, text", centers: [{ x: 0, y: 0 }] }] }, legacy_uc: false },
        characterPrompts: [{ prompt: "girl, silver hair", uc: "lowres, text", center: { x: 0, y: 0 }, enabled: true }],
        straight_alpha: true,
      },
    });
  });

  test("V5 Medium monster (P2/P3): medium model, 14 steps, empty negatives, Medium fields (Inlay stable)", () => {
    const call = buildNaiCall({ target: NAI, prompt: "no humans, monster", negative: "lowres", width: 1024, height: 1024, seed: 7, effort: "medium", transparent: true });
    expect(call.model).toBe("nai-diffusion-5-full-medium");
    expect(call.negativePrompt).toBe("");
    expect(call.parameters).toMatchObject({ resolution: "1024x1024", steps: 14, sampler: "k_euler_ancestral", negativePrompt: "" });
    const inner = JSON.parse((call.parameters as Record<string, string>).rawRequestOverride!).parameters;
    expect(inner).toEqual({
      negative_prompt: "",
      params_version: 4,
      noise_schedule: "karras",
      extra_noise_seed: 7,
      image_format: "png",
      v4_negative_prompt: { caption: { base_caption: "", char_captions: [] }, legacy_uc: false },
      straight_alpha: true,
      ucPresetId: "heavy",
      qualityPresetId: "standard",
      tag_hint_qt: 1,
      tag_hint_uc_preset: 2,
      normalize_reference_strength_multiple: true,
      inpaintImg2ImgStrength: 1,
    });
  });

  test("Medium only exists for V5 Full: Curated stays Full", () => {
    const call = buildNaiCall({ target: { ...NAI, model: "nai-diffusion-5-curated" }, prompt: "x", negative: "n", width: 64, height: 64, seed: 1, effort: "medium" });
    expect(call.model).toBe("nai-diffusion-5-curated");
    expect((call.parameters as Record<string, unknown>).steps).toBe(28);
  });

  test("the connection's own rawRequestOverride is kept underneath ours", () => {
    const call = buildNaiCall({ target: { ...NAI, connectionOverride: '{"parameters":{"cfg_rescale":0.3,"noise_schedule":"exponential"}}' }, prompt: "x", negative: "n", width: 64, height: 64, seed: 1, effort: "full" });
    const inner = JSON.parse((call.parameters as Record<string, string>).rawRequestOverride!).parameters;
    expect(inner.cfg_rescale).toBe(0.3);
    expect(inner.noise_schedule).toBe("karras");
  });

  test("V4.5 Precise Reference: resolvedReferenceImages + referenceFidelity (novelai.ts:219-238)", () => {
    const call = buildNaiCall({
      target: { ...NAI, model: "nai-diffusion-4-5-full" },
      prompt: "1girl",
      negative: "lowres",
      width: 832,
      height: 1216,
      seed: 5,
      effort: "full",
      references: [{ data: "data:image/png;base64,QUJD", mimeType: "image/png" }],
    });
    expect(call.model).toBe("nai-diffusion-4-5-full");
    expect(call.parameters).toMatchObject({
      resolvedReferenceImages: [{ data: "QUJD", strength: 0.8, infoExtracted: 1, refType: "character&style" }],
      referenceFidelity: 1,
    });
    const inner = JSON.parse((call.parameters as Record<string, string>).rawRequestOverride!).parameters;
    expect(inner.params_version).toBe(3);
    expect(inner.straight_alpha).toBeUndefined();
  });

  test("V5 drops reference images (the host would skip them anyway)", () => {
    const call = buildNaiCall({ target: NAI, prompt: "x", negative: "n", width: 64, height: 64, seed: 1, effort: "full", references: [{ data: "QUJD", mimeType: "image/png" }] });
    expect((call.parameters as Record<string, unknown>).resolvedReferenceImages).toBeUndefined();
  });

  test("V5 inset: inpainting model, split screen, canvas size, infill override over ours", () => {
    const layout = INSET_LAYOUTS.sprite;
    const base = buildNaiCall({ target: NAI, prompt: "1girl, solo, white background", negative: "lowres, split screen, multiple views", width: 1216, height: 832, seed: 9, effort: "full", characterTags: ["girl, red hair, angry"] });
    const compiled = compileNovelAiInsetRequest({ request: { prompt: base.prompt, negativePrompt: base.negativePrompt!, parameters: base.parameters! }, layout, canvas: { image: "IMG", mask: "MASK" } });
    expect(compiled.prompt).toBe("split screen, 1girl, solo, white background");
    expect(compiled.negativePrompt).toBe("lowres, multiple views, comic");
    expect(compiled.parameters).toMatchObject({ resolution: "1216x832", negativePrompt: "lowres, multiple views, comic", characterTags: [{ tags: "girl, red hair, angry" }] });
    const raw = JSON.parse(compiled.parameters.rawRequestOverride as string);
    expect(raw.action).toBe("infill");
    expect(raw.parameters).toMatchObject({ noise: 0, width: 1216, height: 832, image: "IMG", mask: "MASK", negative_prompt: "lowres, multiple views, comic", params_version: 4, extra_noise_seed: 9 });
    expect(raw.parameters.v4_negative_prompt.caption.base_caption).toBe("lowres, multiple views, comic");
    expect(raw.parameters.characterPrompts[0].uc).toBe("lowres, multiple views, comic");
    expect(novelAiInsetModelFor("novelai", "nai-diffusion-5-full")).toEqual({ model: "nai-diffusion-5-full-inpainting", verified: true });
    expect(novelAiInsetModelFor("novelai", "nai-diffusion-5-full-medium")?.model).toBe("nai-diffusion-5-full-inpainting");
    expect(novelAiInsetModelFor("novelai", "nai-diffusion-5-curated")).toEqual({ model: "nai-diffusion-5-curated-inpainting", verified: false });
    expect(novelAiInsetModelFor("openai", "nai-diffusion-5-full")).toBeNull();
  });

  test("inset prompt helpers (Cue)", () => {
    expect(insetPrompt("1.2::split screen::, 1girl")).toBe("1.2::split screen::, 1girl");
    expect(insetNegative("{split_screen}, comic, lowres")).toBe("comic, lowres");
    expect(novelAiInsetRejected(new Error("NovelAI image generate failed (400): bad"), "m")).toBe(true);
    expect(novelAiInsetRejected(new Error("NovelAI image generate failed (429): Concurrent generation is locked"), "m")).toBe(false);
    expect(novelAiInsetRejected(new Error("unknown model nai-diffusion-5-full-inpainting"), "nai-diffusion-5-full-inpainting")).toBe(true);
  });
});

describe("GPT Image call shapes", () => {
  test("generation, transparent figure", () => {
    expect(buildGptCall({ target: GPT, prompt: "A wolf.", size: "1024x1024", transparent: true, quality: "high" })).toEqual({
      connection_id: "gpt-1",
      model: "gpt-image-2.6",
      prompt: "A wolf.",
      includeDataUrl: false,
      parameters: { size: "1024x1024", quality: "high", background: "transparent", moderation: "low", outputFormat: "png" },
    });
  });

  test("edit with the canonical: resolvedSourceImages + inputFidelity high (-> /images/edits, image field)", () => {
    expect(
      buildGptCall({ target: GPT, prompt: "Same character, angry.", size: "1024x1536", transparent: true, quality: "medium", sources: [{ data: "data:image/png;base64,QUJD", mimeType: "image/png" }], inputFidelity: "high", userId: "u1" }),
    ).toEqual({
      connection_id: "gpt-1",
      model: "gpt-image-2.6",
      prompt: "Same character, angry.",
      includeDataUrl: false,
      userId: "u1",
      parameters: {
        size: "1024x1536",
        quality: "medium",
        background: "transparent",
        moderation: "low",
        outputFormat: "png",
        resolvedSourceImages: [{ data: "QUJD", mimeType: "image/png" }],
        inputFidelity: "high",
      },
    });
  });

  test("a proxy model id the host does not recognise gets background / input_fidelity via rawRequestOverride", () => {
    const call = buildGptCall({ target: { ...GPT, model: "my-proxy-image", gptImageModel: false }, prompt: "x", size: "1024x1024", transparent: true, quality: "high", sources: [{ data: "QUJD", mimeType: "image/png" }], inputFidelity: "high" });
    expect(JSON.parse((call.parameters as Record<string, string>).rawRequestOverride!)).toEqual({ background: "transparent", moderation: "low", input_fidelity: "high" });
  });

  test("background stays opaque for places", () => {
    expect(buildGptCall({ target: GPT, prompt: "x", size: "1536x1024", transparent: false, quality: "high" }).parameters).toMatchObject({ background: "opaque" });
  });
});

describe("errors", () => {
  test("retryable and lock classification (Inlay)", () => {
    expect(isConcurrentLockError(new Error("NovelAI image generate failed (429): Concurrent generation is locked"))).toBe(true);
    expect(isRetryableImageError(new Error("NovelAI image generate failed (500): oops"))).toBe(true);
    expect(isRetryableImageError(new Error("fetch failed"))).toBe(true);
    expect(isRetryableImageError(new Error("OpenAI image generate failed (400): bad request"))).toBe(false);
    expect(isRetryableImageError(Object.assign(new Error("x"), { retryable: false }))).toBe(false);
  });
});
