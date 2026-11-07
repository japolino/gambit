/**
 * Image providers: discovering the user's saved connections and building the
 * exact `spindle.imageGen.generate` call for each route. The builders are
 * pure (tests snapshot their output); discovery reads the host.
 *
 * Ported in part from Inlay Illustrator:
 *   repo:   inlay-illustrator (D:\Lumiverse\inlay-illustrator)
 *   branch: origin/stable @ 6b747bf
 *   path:   src/backend/services/images.ts (`buildNovelAIParameters`: V5
 *           Medium request fields, connection rawRequestOverride kept
 *           underneath ours; `isRetryableImageError`, `isConcurrentLockError`)
 *           src/shared/contract/config.ts (V5 Medium model rule)
 *
 * What the host provider reads (D:\Lumiverse\src\image-gen\...):
 * - Lumiverse merges our `parameters` over the connection's
 *   `default_parameters` ONE level deep
 *   (src/spindle/worker-host-image-gen-api.ts:140), so our
 *   `rawRequestOverride` hides the connection's own; we merge it underneath.
 * - `model` is the DTO field (worker-host-image-gen-api.ts:164); `model` is a
 *   protected raw-override key (src/image-gen/types.ts:45-59).
 * NovelAI (providers/novelai.ts):
 *   `resolution` "WxH" (:130), `guidance` -> scale (:143), `sampler` (:144),
 *   `steps` (:145), `seed` (:134, uint), `negativePrompt` (:131, the ONLY
 *   negative the host reads; the DTO's `negativePrompt` is ignored by this
 *   provider), `characterTags [{tags}]` (:169), `resolvedReferenceImages` +
 *   `referenceFidelity` (:219-239, V4.5 only, skipped on V5),
 *   `rawRequestOverride` deep-merged into the outer body (:243-244).
 * OpenAI (providers/openai.ts):
 *   `size` (:233), `quality` (:234), `background` (:237, GPT-image model ids
 *   only, see :285-287), `moderation` (:240), `outputFormat` (:242),
 *   `inputFidelity` -> `input_fidelity` (:185, edits only),
 *   `resolvedSourceImages` [{data, mimeType}] (:132-133) switches to
 *   `/images/edits` multipart with `image` (one) or `image[]` (several)
 *   (:136-137, :205), `rawRequestOverride` (:166 generations, :190 edits;
 *   `image`, `image[]`, `mask` protected). No negative prompt.
 */
import type { ImageGenConnectionDTO, ImageGenRequestDTO, SpindleAPI } from "lumiverse-spindle-types";
import { deepMergeRawOverride, parseRawOverride } from "./nai-inset.js";

/* ------------------------------------------------------------------ */
/* Targets and discovery                                                */
/* ------------------------------------------------------------------ */

export const NAI_V5_FULL = "nai-diffusion-5-full";
/** Inlay contract config.ts:76 (AM 0.9.90): V5 Medium is its own model id. */
export const NAI_V5_MEDIUM = "nai-diffusion-5-full-medium";
export const NAI_V45_FULL = "nai-diffusion-4-5-full";
/** Inlay images.ts:187-188: Medium is 14 steps, Euler Ancestral. */
export const NAI_MEDIUM_STEPS = 14;
export const NAI_FULL_STEPS = 28;
export const NAI_SAMPLER = "k_euler_ancestral";
/** Host default guidance (novelai.ts:143). */
export const NAI_GUIDANCE = 5;

export interface NaiTarget {
  provider: "novelai";
  connectionId: string;
  connectionName: string;
  /** Model this route sends (V5 Full/Curated, or V4.5 for precise reference). */
  model: string;
  /** The connection's own rawRequestOverride, kept underneath ours. */
  connectionOverride: unknown;
}

export interface GptTarget {
  provider: "openai";
  connectionId: string;
  connectionName: string;
  model: string;
  /** Matches the host's GPT-image rule; when false, background/input_fidelity go through rawRequestOverride. */
  gptImageModel: boolean;
  connectionOverride: unknown;
}

export interface ProviderSet {
  /** NovelAI V5 (Full unless the connection names another V5 model). */
  nai: NaiTarget | null;
  /** Same NovelAI account on V4.5 Full, for Precise Reference. */
  nai45: NaiTarget | null;
  gpt: GptTarget | null;
}

export const NO_PROVIDERS: ProviderSet = { nai: null, nai45: null, gpt: null };

export function hasAnyProvider(set: ProviderSet): boolean {
  return !!(set.nai || set.gpt);
}

/** openai.ts:285-287. */
export function isGptImageModel(model: string): boolean {
  return /^(gpt-image|chatgpt-image)/i.test(model);
}

export function isNaiV5(model: string): boolean {
  return /^nai-diffusion-5(?:-|$)/.test(model);
}

function connectionOverride(dto: ImageGenConnectionDTO): unknown {
  const defaults = dto.default_parameters;
  return defaults && typeof defaults === "object" ? (defaults as Record<string, unknown>).rawRequestOverride ?? null : null;
}

function pick<T extends ImageGenConnectionDTO>(list: T[], better: (c: T) => boolean): T | null {
  return list.find((c) => c.is_default && better(c)) ?? list.find(better) ?? list.find((c) => c.is_default) ?? list[0] ?? null;
}

/**
 * The routes this user can draw with, from their saved image connections.
 * - NAI: a `novelai` connection (the default one first, then one already on
 *   V5). Its V5 model is the connection's when that is V5, else V5 Full.
 *   V4.5 precise reference uses the same connection with the V4.5 model.
 * - GPT: an `openai` connection (preferring a GPT-image model id). The user
 *   runs GPT Image through a local proxy configured as an OpenAI connection.
 * Never throws: a host error gives no providers (placeholders everywhere).
 */
export async function discoverProviders(host: Pick<SpindleAPI, "imageGen">, userId?: string): Promise<ProviderSet> {
  let list: ImageGenConnectionDTO[] = [];
  try {
    list = (await host.imageGen.listConnections(userId)) ?? [];
  } catch {
    return NO_PROVIDERS;
  }
  return providersFromConnections(list);
}

export function providersFromConnections(list: ImageGenConnectionDTO[]): ProviderSet {
  const naiList = list.filter((c) => c.provider === "novelai");
  const gptList = list.filter((c) => c.provider === "openai");
  const naiConn = pick(naiList, (c) => isNaiV5(c.model ?? ""));
  const gptConn = pick(gptList, (c) => isGptImageModel(c.model ?? ""));
  const nai: NaiTarget | null = naiConn
    ? { provider: "novelai", connectionId: naiConn.id, connectionName: naiConn.name, model: isNaiV5(naiConn.model ?? "") ? naiConn.model.replace(/-medium$/, "") : NAI_V5_FULL, connectionOverride: connectionOverride(naiConn) }
    : null;
  const nai45: NaiTarget | null = naiConn ? { ...nai!, model: NAI_V45_FULL } : null;
  const gpt: GptTarget | null = gptConn
    ? { provider: "openai", connectionId: gptConn.id, connectionName: gptConn.name, model: gptConn.model || "gpt-image-1", gptImageModel: isGptImageModel(gptConn.model || "gpt-image-1"), connectionOverride: connectionOverride(gptConn) }
    : null;
  return { nai, nai45, gpt };
}

/* ------------------------------------------------------------------ */
/* Common                                                               */
/* ------------------------------------------------------------------ */

export type Effort = "full" | "medium";

/** P0/P1 hero art on V5 Full, P2/P3 speculative work on V5 Medium (DESIGN 5.7). */
export function effortFor(priority: number): Effort {
  return priority <= 1 ? "full" : "medium";
}

/** A reference image's bytes as the providers take them (base64 without prefix). */
export interface ImageData {
  data: string;
  mimeType: string;
}

function stripPrefix(data: string): string {
  return data.replace(/^data:[^;,]+;base64,/, "");
}

/** Our override over the connection's (Inlay images.ts:302-303); an unparseable connection override is dropped. */
function withConnectionOverride(connection: unknown, ours: Record<string, unknown>): string {
  let base: unknown = {};
  try {
    base = parseRawOverride(connection) ?? {};
  } catch {
    base = {};
  }
  return JSON.stringify(deepMergeRawOverride(base, ours));
}

interface CallCommon {
  userId?: string;
  ownerChatId?: string;
}

function common(input: CallCommon): Partial<ImageGenRequestDTO> {
  return {
    // Only ids and URLs go to the frontend (4 MB cap): skip the base64 result (image-generation.md, includeDataUrl).
    includeDataUrl: false,
    ...(input.ownerChatId ? { owner_chat_id: input.ownerChatId } : {}),
    ...(input.userId ? { userId: input.userId } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* NovelAI V5 (and V4.5 precise reference)                              */
/* ------------------------------------------------------------------ */

export interface NaiCallInput extends CallCommon {
  target: NaiTarget;
  prompt: string;
  negative: string;
  width: number;
  height: number;
  seed: number;
  effort: Effort;
  /** V4+ character captions. */
  characterTags?: string[];
  /** Steps override for Full (insets use 14 for speculative work); Medium is always 14. */
  steps?: number;
  /** Asked for a transparent figure (V5 alpha). */
  transparent?: boolean;
  /** V4.5 Precise Reference images (ignored on V5 by the host). */
  references?: ImageData[];
  referenceStrength?: number;
  referenceFidelity?: number;
}

/** Whether this request actually runs V5 Medium (Inlay config.ts:86-89: only V5 Full has the Medium effort). */
export function isMediumRequest(model: string, effort: Effort): boolean {
  return effort === "medium" && model === NAI_V5_FULL;
}

/**
 * NovelAI generate call. Full: host defaults (28 steps, guidance 5, Euler
 * Ancestral, Karras) with our negative. Medium (Inlay images.ts:206-291):
 * model `nai-diffusion-5-full-medium`, 14 steps, Euler Ancestral, empty
 * negatives and NovelAI's Medium request fields.
 */
export function buildNaiCall(input: NaiCallInput): ImageGenRequestDTO {
  const { target } = input;
  const v5 = isNaiV5(target.model);
  const medium = v5 && isMediumRequest(target.model, input.effort);
  const negative = medium ? "" : input.negative.trim();
  const seed = Math.max(0, Math.floor(input.seed)) % 4294967296;
  const chars = (input.characterTags ?? []).map((t) => t.trim()).filter(Boolean);
  const refs = !v5 ? input.references ?? [] : [];

  const parameters: Record<string, unknown> = {
    resolution: `${Math.round(input.width)}x${Math.round(input.height)}`,
    sampler: NAI_SAMPLER,
    steps: medium ? NAI_MEDIUM_STEPS : Math.min(50, Math.max(1, Math.round(input.steps ?? NAI_FULL_STEPS))),
    guidance: NAI_GUIDANCE,
    seed,
    negativePrompt: negative,
  };
  if (chars.length) parameters.characterTags = chars.map((tags) => ({ tags }));
  if (refs.length) {
    parameters.resolvedReferenceImages = refs.map((r) => ({
      data: stripPrefix(r.data),
      strength: clamp01(input.referenceStrength ?? 0.8),
      infoExtracted: 1,
      refType: "character&style",
    }));
    parameters.referenceFidelity = clamp01(input.referenceFidelity ?? 1);
  }

  const inner: Record<string, unknown> = {
    // The host replaces an empty `negativePrompt` with its own default UC (novelai.ts:131-133): send ours as is.
    negative_prompt: negative,
    params_version: v5 ? 4 : 3,
    qualityToggle: true,
    noise_schedule: "karras",
    extra_noise_seed: seed,
    image_format: "png",
  };
  // v4_negative_prompt is built by the host from the same (possibly defaulted) negative: pin it to ours.
  inner.v4_negative_prompt = {
    caption: { base_caption: negative, char_captions: chars.map(() => ({ char_caption: negative, centers: [{ x: 0, y: 0 }] })) },
    legacy_uc: false,
  };
  if (chars.length) {
    // Same as the host's characterPrompts (novelai.ts:179-184) but with our uc (empty on Medium).
    inner.characterPrompts = chars.map((prompt) => ({ prompt, uc: negative, center: { x: 0, y: 0 }, enabled: true }));
  }
  if (v5 && input.transparent) {
    // NovelAI's own client sends this with V5 Medium (Inlay images.ts:287); UNVERIFIED whether Full needs it for alpha.
    inner.straight_alpha = true;
  }
  if (medium) {
    // Inlay images.ts:272-291: Medium drops cfg_rescale / qualityToggle / skip_cfg_above_sigma (left to host defaults).
    delete inner.qualityToggle;
    Object.assign(inner, {
      params_version: 4,
      negative_prompt: "",
      ucPresetId: "heavy",
      qualityPresetId: "standard",
      tag_hint_qt: 1,
      tag_hint_uc_preset: 2,
      normalize_reference_strength_multiple: true,
      straight_alpha: true,
      image_format: "png",
      inpaintImg2ImgStrength: 1,
    });
  }
  parameters.rawRequestOverride = withConnectionOverride(target.connectionOverride, { parameters: inner });

  return {
    connection_id: target.connectionId,
    model: medium ? NAI_V5_MEDIUM : target.model,
    prompt: input.prompt,
    negativePrompt: negative,
    parameters,
    ...common(input),
  };
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1;
}

/* ------------------------------------------------------------------ */
/* GPT Image (OpenAI connection, possibly a local proxy)                */
/* ------------------------------------------------------------------ */

export interface GptCallInput extends CallCommon {
  target: GptTarget;
  prompt: string;
  size: string;
  transparent: boolean;
  quality: "low" | "medium" | "high";
  /** Source / reference images: present means `/images/edits`. */
  sources?: ImageData[];
  /** Edits only: "high" keeps faces and details of the inputs. */
  inputFidelity?: "low" | "high";
}

export function gptQualityFor(priority: number): "medium" | "high" {
  return priority <= 1 ? "high" : "medium";
}

export function buildGptCall(input: GptCallInput): ImageGenRequestDTO {
  const { target } = input;
  const sources = (input.sources ?? []).filter((s) => !!s?.data);
  const background = input.transparent ? "transparent" : "opaque";
  const parameters: Record<string, unknown> = {
    size: input.size,
    quality: input.quality,
    background,
    moderation: "low",
    // A connection default of jpeg/webp would lose the alpha: always PNG (the host sends nothing for png, openai.ts:242).
    outputFormat: "png",
  };
  if (sources.length) {
    parameters.resolvedSourceImages = sources.map((s) => ({ data: stripPrefix(s.data), mimeType: s.mimeType || "image/png" }));
    parameters.inputFidelity = input.inputFidelity ?? "low";
  }
  // The host only sends background / input_fidelity / moderation for GPT-image model ids (openai.ts:185, 236-243).
  // A proxy exposing another model name gets them through the raw override instead (not protected keys).
  const extra: Record<string, unknown> = {};
  if (!target.gptImageModel) {
    extra.background = background;
    extra.moderation = "low";
    if (sources.length) extra.input_fidelity = parameters.inputFidelity;
  }
  const hasConnectionOverride = target.connectionOverride !== null && target.connectionOverride !== undefined && target.connectionOverride !== "";
  if (Object.keys(extra).length || hasConnectionOverride) parameters.rawRequestOverride = withConnectionOverride(target.connectionOverride, extra);

  return {
    connection_id: target.connectionId,
    model: target.model,
    prompt: input.prompt,
    parameters,
    ...common(input),
  };
}

/* ------------------------------------------------------------------ */
/* Errors (Inlay images.ts:337-354)                                      */
/* ------------------------------------------------------------------ */

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") return (error as { message: string }).message;
  return String(error ?? "");
}

/** Is this image error transient (worth retrying the same request)? */
export function isRetryableImageError(error: unknown): boolean {
  const r = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  if (r.name === "AbortError") return false;
  if (r.retryable === false) return false;
  if (r.retryable === true) return true;
  if (error instanceof TypeError) return true;
  const message = errorMessage(error);
  const status = Number(r.status) || Number(/\((\d{3})\)|\bHTTP\s*(\d{3})\b/i.exec(message)?.slice(1).find(Boolean));
  if (status === 408 || status === 425 || status === 429 || status >= 500) return true;
  return /concurrent generation is locked|timed? ?out|fetch failed|network error|econnreset|socket hang up|terminated|temporarily unavailable/i.test(message);
}

/** NovelAI 429 "Concurrent generation is locked": another image is being drawn on the same account. */
export function isConcurrentLockError(error: unknown): boolean {
  return /concurrent generation is locked/i.test(errorMessage(error));
}

export { errorMessage };
