/**
 * Vendored from Cue:
 *   repo:   visual-novel-preview (D:\Lumiverse\visual-novel-preview)
 *   branch: origin/testing @ ab0fa34 (file last changed at 0f11d58)
 *   path:   src/backend/runtime/sprites/novelai-inset.ts
 *           (+ `tagKey` from src/backend/runtime/sprites/prompts.ts)
 * Changes: `compileNovelAiInsetRequest` takes Gambit's request shape
 * (prompt / negativePrompt / parameters); `connectionRawOverride` reads the
 * already-discovered connection instead of Cue's config. Pure. Pull upstream
 * fixes by hand. See Cue docs/SPRITE_MODE.md "NovelAI V5 reference inset".
 *
 * The inset request, as Lumiverse's NovelAI provider receives it
 * (D:\Lumiverse\src\image-gen\providers\novelai.ts):
 *   - `model` goes in the generate DTO's `model` field: `model` is a
 *     PROTECTED_RAW_OVERRIDE_KEYS entry (src/image-gen/types.ts:45-59), so
 *     the override cannot set it.
 *   - `parameters.rawRequestOverride` is deep-merged into the OUTER body
 *     `{input, model, action, parameters}` (novelai.ts:243-244), where
 *     `action` and `parameters.*` are not protected: action "infill" plus
 *     `parameters.image` / `parameters.mask` (base64 PNGs) and the canvas
 *     `width` / `height`.
 *   - the host already sends `add_original_image: true` and
 *     `inpaintImg2ImgStrength: 1` (novelai.ts:153,161).
 */
import type { InsetLayout } from "./inset-geometry.js";

/** NovelAI Diffusion V5 models. */
export const NOVELAI_V5_MODEL = /^nai-diffusion-5(?:-|$)/;
/** Scene prompt prefix of the technique. */
export const NOVELAI_INSET_PROMPT_TAG = "split screen";
/** Added to the negative. */
export const NOVELAI_INSET_NEGATIVE_TAG = "comic";
/** Inpainting model names confirmed by the technique's author. */
const VERIFIED_INPAINTING_MODELS = new Set(["nai-diffusion-5-full-inpainting"]);

export type NovelAiInsetModel = {
  /** The model the inset request sends. */
  model: string;
  /** False when the name is a guess (anything but V5 Full). */
  verified: boolean;
};

/**
 * The inpainting model for an inset, or null when the connection is not
 * NovelAI V5. `<model>-inpainting` (V5 Full: `nai-diffusion-5-full-inpainting`,
 * verified; V5 Curated: `nai-diffusion-5-curated-inpainting`, unverified).
 * V5 Medium (`nai-diffusion-5-full-medium`) maps to the Full inpainting model.
 */
export function novelAiInsetModelFor(provider: string | null | undefined, model: string | null | undefined): NovelAiInsetModel | null {
  if (provider !== "novelai" || !model || !NOVELAI_V5_MODEL.test(model)) return null;
  const base = model.replace(/-medium$/, "");
  const inpainting = base.endsWith("-inpainting") ? base : `${base}-inpainting`;
  return { model: inpainting, verified: VERIFIED_INPAINTING_MODELS.has(inpainting) };
}

/** HTTP statuses that reject the request itself (a wrong model name or body), not a passing condition. */
const REJECTED_STATUSES = new Set([400, 404, 422]);
/** Lumiverse's provider errors: `NovelAI image generate failed (429): ...`. */
const PROVIDER_STATUS = /\bfailed \((\d{3})\)/;

/**
 * Whether an inset generation error means NovelAI rejects the inset request
 * (turn the inset off and use the next consistency route): HTTP 400, 404 or
 * 422, or an error without a status that names the model or the inpainting.
 * Everything else (429 concurrent-generation lock, 5xx, 401/402, network)
 * is not about the inset.
 */
export function novelAiInsetRejected(error: unknown, model: string): boolean {
  const raw = error && typeof error === "object" ? (error as { status?: unknown }).status : undefined;
  const message = error instanceof Error ? error.message : String(error ?? "");
  const status = typeof raw === "number" ? raw : Number(PROVIDER_STATUS.exec(message)?.[1] ?? Number.NaN);
  if (Number.isFinite(status)) return REJECTED_STATUSES.has(status);
  const text = message.toLowerCase();
  return text.includes(model.toLowerCase()) || /\b(?:model|infill|inpaint\w*)\b/.test(text);
}

/** Cue prompts.ts `tagKey`: lower case, underscores as spaces, single spaces. */
export function tagKey(tag: string): string {
  return tag.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
}

/**
 * A tag without NovelAI emphasis, for comparisons: `1.2::split screen::`,
 * `{split_screen}`, `[[Split Screen]]` and `(split screen:1.2)` all give
 * `split screen`.
 */
export function bareTagKey(tag: string): string {
  let text = tag.trim();
  for (let previous = ""; previous !== text;) {
    previous = text;
    text = text
      .replace(/^-?\d+(?:\.\d+)?::/, "")
      .replace(/::$/, "")
      .replace(/^[{[(]+/, "")
      .replace(/[}\])]+$/, "")
      .replace(/:-?\d+(?:\.\d+)?$/, "")
      .trim();
  }
  return tagKey(text);
}

/** Base prompt with `split screen` first (once, in any emphasis). */
export function insetPrompt(prompt: string): string {
  const first = prompt.split(",")[0] ?? "";
  if (bareTagKey(first) === NOVELAI_INSET_PROMPT_TAG) return prompt;
  return prompt.trim() ? `${NOVELAI_INSET_PROMPT_TAG}, ${prompt}` : NOVELAI_INSET_PROMPT_TAG;
}

/** `split screen` (or `split_screen`) as a whole tag, in any emphasis; what opens its group stays. */
const SPLIT_SCREEN_TAG = /(^|,|::|[{[(])\s*split[\s_]+screen\s*(?::-?\d+(?:\.\d+)?)?(?=\s*(?:$|,|::|[}\])]))/gi;
/** What removing it can leave behind: empty groups. */
const EMPTY_GROUPS = [/-?\d+(?:\.\d+)?::\s*::/g, /\{\s*\}|\[\s*\]|\(\s*\)/g];

/**
 * Negative for an inset: without `split screen` (a figure negative forbids
 * it, the inset asks for it), also weighted or bracketed, and with `comic`;
 * `multiple views` and every other tag stay as they are.
 */
export function insetNegative(negative: string): string {
  let text = negative.replace(SPLIT_SCREEN_TAG, "$1");
  for (let previous = ""; previous !== text;) {
    previous = text;
    text = text.replace(/(-?\d+(?:\.\d+)?::|[{[(])\s*,\s*/g, "$1").replace(/\s*,\s*(::|[}\])])/g, "$1");
    for (const empty of EMPTY_GROUPS) text = text.replace(empty, "");
  }
  const kept = text.split(",").map((tag) => tag.trim()).filter(Boolean);
  if (!kept.some((tag) => bareTagKey(tag) === NOVELAI_INSET_NEGATIVE_TAG)) kept.push(NOVELAI_INSET_NEGATIVE_TAG);
  return kept.join(", ");
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function unsafeKey(key: string): boolean {
  return key === "__proto__" || key === "constructor" || key === "prototype";
}

/**
 * Deep merge as Lumiverse's `applyRawOverride` does it: objects merge,
 * arrays and scalars replace, and a nested `null` is written (only a
 * top-level null or undefined source changes nothing).
 */
export function deepMergeRawOverride(target: unknown, source: unknown): unknown {
  if (source === null || source === undefined) return target;
  if (!isObject(source) || !isObject(target)) return source;
  const result: JsonObject = { ...target };
  for (const key of Object.keys(source)) {
    if (unsafeKey(key)) continue;
    const value = source[key];
    result[key] = isObject(result[key]) && isObject(value) ? deepMergeRawOverride(result[key], value) : value;
  }
  return result;
}

/**
 * A `rawRequestOverride` (a JSON string, as Lumiverse takes it, or an
 * object). Empty: null. Throws on invalid JSON or a non-object, like
 * Lumiverse would at generation time.
 */
export function parseRawOverride(value: unknown): JsonObject | null {
  if (value === undefined || value === null) return null;
  if (isObject(value)) return value;
  if (typeof value !== "string") throw new Error("rawRequestOverride must be a JSON object.");
  if (!value.trim()) return null;
  const parsed: unknown = JSON.parse(value);
  if (!isObject(parsed)) throw new Error("rawRequestOverride must be a JSON object.");
  return parsed;
}

/**
 * The inset's `rawRequestOverride`: `noise: 0` (the user's value wins), then
 * the given overrides in order, then the inset itself, which wins for
 * `action`, `parameters.image`, `parameters.mask` and the canvas size.
 */
export function mergeNovelAiRawOverride(
  overrides: readonly unknown[],
  canvas: { image: string; mask: string },
  size: { width: number; height: number },
): string {
  let merged: unknown = { parameters: { noise: 0 } };
  for (const override of overrides) merged = deepMergeRawOverride(merged, parseRawOverride(override));
  merged = deepMergeRawOverride(merged, { action: "infill", parameters: { width: size.width, height: size.height, image: canvas.image, mask: canvas.mask } });
  return JSON.stringify(merged);
}

export type NaiRequestShape = { prompt: string; negativePrompt: string; parameters: JsonObject };

/**
 * Turn a plain NovelAI V5 request into its inset request: canvas resolution,
 * `split screen` first, the negative without `split screen` and with
 * `comic`, no reference images, and the infill override (the request's own
 * `rawRequestOverride`, which already carries the connection's, goes under
 * the infill fields). Steps, guidance, sampler and seed stay.
 */
export function compileNovelAiInsetRequest(input: {
  request: NaiRequestShape;
  layout: InsetLayout;
  canvas: { image: string; mask: string };
}): NaiRequestShape {
  const { request, layout } = input;
  const negativePrompt = insetNegative(request.negativePrompt);
  const own = request.parameters.rawRequestOverride;
  // The plain request's override set `parameters.negative_prompt`/`v4_negative_prompt` for the plain negative: follow the inset negative.
  const ownParsed = parseRawOverride(own);
  const retargeted = ownParsed ? retargetNegative(ownParsed, negativePrompt) : null;
  const parameters: JsonObject = {
    ...request.parameters,
    negativePrompt,
    resolution: `${layout.canvas.width}x${layout.canvas.height}`,
    rawRequestOverride: mergeNovelAiRawOverride(retargeted ? [retargeted] : [], input.canvas, layout.canvas),
  };
  delete parameters.resolvedReferenceImages;
  return { prompt: insetPrompt(request.prompt), negativePrompt, parameters };
}

/** Rewrite the negative fields of a NovelAI override to `negative` (keeping their shape). */
function retargetNegative(override: JsonObject, negative: string): JsonObject {
  const params = isObject(override.parameters) ? { ...override.parameters } : null;
  if (!params) return override;
  if (typeof params.negative_prompt === "string" && params.negative_prompt !== "") params.negative_prompt = negative;
  const v4n = params.v4_negative_prompt;
  if (isObject(v4n) && isObject(v4n.caption) && typeof v4n.caption.base_caption === "string" && v4n.caption.base_caption !== "") {
    const charCaptions = Array.isArray(v4n.caption.char_captions)
      ? v4n.caption.char_captions.map((c) => (isObject(c) ? { ...c, char_caption: negative } : c))
      : v4n.caption.char_captions;
    params.v4_negative_prompt = { ...v4n, caption: { ...v4n.caption, base_caption: negative, char_captions: charCaptions } };
  }
  if (Array.isArray(params.characterPrompts)) {
    params.characterPrompts = params.characterPrompts.map((c) => (isObject(c) && typeof c.uc === "string" && c.uc !== "" ? { ...c, uc: negative } : c));
  }
  return { ...override, parameters: params };
}
