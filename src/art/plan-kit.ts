/**
 * Building blocks for art plans (routes): the context a plan needs at run
 * time, and the plain (no-reference) NAI and GPT plans every kind falls back
 * to. See queue.ts for how plans run and consistency.ts / plans.ts for how
 * they are ordered.
 */
import type { ArtPriority } from "../shared/protocol.js";
import type { InsetOutcome } from "./inset-bridge.js";
import type { InsetLayoutId, PixelRect } from "./inset-geometry.js";
import type { LookPreset, StyleLock } from "./looks.js";
import { buildGptCall, buildNaiCall, effortFor, gptQualityFor, isMediumRequest, isNaiV5, NAI_V5_MEDIUM, type GptTarget, type ImageData, type NaiTarget, type ProviderSet } from "./providers.js";
import { PlanUnavailable, type GenOutput, type Plan } from "./queue.js";
import { GPT_STYLE_REFERENCE, type BuiltPrompt } from "./specs.js";

/** What plans may call at run time (the controller provides the host-backed versions). */
export interface PlanContext {
  providers: ProviderSet;
  look: LookPreset;
  /** Any look this user has (presets, files, Inlay styles), for probes of a look not in use. */
  lookOf?: (id: string) => LookPreset | null;
  lock: StyleLock | null;
  userId?: string;
  /** Bytes of a stored image as base64 (spindle.images.readBinary). */
  readImage(imageId: string): Promise<ImageData>;
  /** The browser's V5 inset canvas and mask for a reference image. */
  composeInset(layout: InsetLayoutId, sourceUrl: string): Promise<InsetOutcome>;
  /** The browser crops a stored image; the result is stored as a new image. */
  cropImage(source: GenOutput, rect: PixelRect): Promise<GenOutput>;
  /** Cut a figure out of its background in the browser (after an optional crop); the render as drawn when it cannot. */
  cutImage(source: GenOutput, crop?: PixelRect): Promise<GenOutput>;
  /** Inset models NovelAI rejected this session (connection + model). */
  insetOff: Set<string>;
}

export function imageUrl(imageId: string): string {
  // The images route serves generated images and uploads (crops, slices)
  // alike; /api/v1/image-gen/results/ only knows generations.
  return `/api/v1/images/${imageId}`;
}

/** NAI plain generation (V5 Full/Medium by priority; V4.5 targets have no alpha). */
export function naiPlainPlan(target: NaiTarget, built: BuiltPrompt, seed: number, priority: ArtPriority, label = "nai-v5"): Plan {
  const effort = effortFor(priority);
  const medium = isNaiV5(target.model) && isMediumRequest(target.model, effort);
  const call = () =>
    buildNaiCall({
      target,
      prompt: built.nai.prompt,
      negative: built.nai.negative,
      width: built.nai.width,
      height: built.nai.height,
      seed,
      effort,
      characterTags: built.nai.characterTags,
      transparent: built.transparent,
    });
  const preview = call();
  return {
    lane: "nai",
    label: medium ? `${label}-medium` : label,
    cutout: built.transparent && isNaiV5(target.model),
    descriptor: {
      provider: "novelai",
      model: medium ? NAI_V5_MEDIUM : target.model,
      prompt: built.nai.prompt,
      negative: preview.negativePrompt ?? "",
      refs: [],
      seed,
      size: `${built.nai.width}x${built.nai.height}`,
      extra: `chars=${built.nai.characterTags.join("|")};alpha=${built.transparent}`,
    },
    prepare: async () => call(),
  };
}

/**
 * GPT plain generation. With a style anchor, the anchor rides along as the
 * only source image (`/images/edits`, input fidelity low) with a sentence
 * saying it is a style reference (DESIGN 5.2: every GPT request includes an
 * anchor image).
 */
export function gptPlainPlan(ctx: Pick<PlanContext, "readImage">, target: GptTarget, built: BuiltPrompt, priority: ArtPriority, anchorImageId?: string): Plan {
  const prompt = anchorImageId ? `${built.gpt.prompt} ${GPT_STYLE_REFERENCE}` : built.gpt.prompt;
  return {
    lane: "gpt",
    label: anchorImageId ? "gpt-anchored" : "gpt",
    cutout: built.transparent,
    descriptor: {
      provider: "openai",
      model: target.model,
      prompt,
      negative: "",
      refs: anchorImageId ? [anchorImageId] : [],
      seed: null,
      size: built.gpt.size,
      extra: `bg=${built.transparent ? "transparent" : "opaque"};q=${gptQualityFor(priority)};fid=low`,
    },
    prepare: async () => {
      let sources: ImageData[] | undefined;
      if (anchorImageId) {
        try {
          sources = [await ctx.readImage(anchorImageId)];
        } catch (error) {
          throw new PlanUnavailable(`style anchor unreadable (${error instanceof Error ? error.message : String(error)})`);
        }
      }
      return buildGptCall({
        target,
        prompt,
        size: built.gpt.size,
        transparent: built.transparent,
        quality: gptQualityFor(priority),
        sources,
        inputFidelity: sources ? "low" : undefined,
      });
    },
  };
}

/**
 * GPT edit of existing images (expressions and poses from the canonical,
 * phase 2 from phase 1, a scarred place from the original, a fusion from
 * both parents). The first source is what must be preserved.
 */
export function gptEditPlan(
  ctx: Pick<PlanContext, "readImage">,
  target: GptTarget,
  built: BuiltPrompt,
  priority: ArtPriority,
  sourceIds: string[],
  fidelity: "low" | "high",
  label = "gpt-edit",
): Plan {
  return {
    lane: "gpt",
    label,
    cutout: built.transparent,
    descriptor: {
      provider: "openai",
      model: target.model,
      prompt: built.gpt.prompt,
      negative: "",
      refs: sourceIds,
      seed: null,
      size: built.gpt.size,
      extra: `edit;bg=${built.transparent ? "transparent" : "opaque"};q=${gptQualityFor(priority)};fid=${fidelity}`,
    },
    prepare: async () => {
      let sources: ImageData[];
      try {
        sources = await Promise.all(sourceIds.map((id) => ctx.readImage(id)));
      } catch (error) {
        throw new PlanUnavailable(`reference unreadable (${error instanceof Error ? error.message : String(error)})`);
      }
      return buildGptCall({ target, prompt: built.gpt.prompt, size: built.gpt.size, transparent: built.transparent, quality: gptQualityFor(priority), sources, inputFidelity: fidelity });
    },
  };
}

/** Adds the user id to every call a plan prepares (operator-scoped hosts). */
export function withUser(plan: Plan, userId: string | undefined): Plan {
  if (!userId) return plan;
  return { ...plan, prepare: async () => ({ ...(await plan.prepare()), userId }) };
}
