/**
 * Character consistency (docs/DESIGN.md, 5.3): from a canonical portrait to
 * its expressions and cut-in poses. Two routes, ordered by the look's
 * provider and what the user has:
 *   (a) NovelAI V5 reference inset (Cue's technique: the canonical on the
 *       left of a split canvas, the new picture inpainted on the right,
 *       copying identity and style; see nai-inset.ts / inset-geometry.ts),
 *   (b) GPT Image edit with the canonical as the source image and
 *       `input_fidelity: "high"`, transparent background.
 * Then a plain V5 render from the character's tags (Inlay's character
 * tags when there) and fixed seed, so an expression is never left undrawn.
 * No V4.5 reference: it gave flat, off-model figures.
 */
import type { ArtPriority } from "../shared/protocol.js";
import { insetLayout, type InsetLayoutId } from "./inset-geometry.js";
import { compileNovelAiInsetRequest, novelAiInsetModelFor, novelAiInsetRejected } from "./nai-inset.js";
import { gptEditPlan, gptPlainPlan, imageUrl, naiPlainPlan, type PlanContext } from "./plan-kit.js";
import { buildNaiCall, isNaiV5, type NaiTarget, type ProviderSet } from "./providers.js";
import { PlanUnavailable, type Plan } from "./queue.js";
import { buildPrompt, type ArtSpec, type BuiltPrompt } from "./specs.js";
import type { LookPreset } from "./looks.js";

export type VariantMethod = "v5_inset" | "gpt_edit" | "nai45_reference" | "plain";

export type VariantSpec = Extract<ArtSpec, { kind: "expression" } | { kind: "pose" }>;

/** Key under which an inset model is switched off after NovelAI rejects it. */
export function insetOffKey(target: Pick<NaiTarget, "connectionId">, model: string): string {
  return `${target.connectionId}\u0000${model}`;
}

/**
 * Route order for a variant: anime-leaning looks (NAI preferred) and the
 * user's own art try the V5 inset first, painted and real looks (GPT
 * preferred) the GPT edit first. No V4.5 reference: a plain render from
 * their tags comes last. Routes the user cannot run are left out.
 */
export function variantMethods(look: LookPreset, providers: ProviderSet, insetOff: ReadonlySet<string> = new Set(), fromCard = false): VariantMethod[] {
  const inset = providers.nai && isNaiV5(providers.nai.model) ? novelAiInsetModelFor("novelai", providers.nai.model) : null;
  const insetOk = !!(inset && providers.nai && !insetOff.has(insetOffKey(providers.nai, inset.model)));
  // No V4.5 reference: from a Gambit render (a figure) the V5 inset keeps the
  // person; otherwise a plain V5 render from their tags (Inlay's when there).
  const order: VariantMethod[] = look.preferred === "nai" || fromCard ? ["v5_inset", "gpt_edit"] : ["gpt_edit", "v5_inset"];
  const out = order.filter((m) => (m === "v5_inset" ? insetOk : !!providers.gpt));
  if (providers.nai || providers.gpt) out.push("plain");
  return out;
}

/** The inset layout for a variant: expressions keep the portrait framing, poses need room. */
export function insetLayoutFor(spec: VariantSpec): InsetLayoutId {
  return spec.kind === "pose" ? "wide" : "sprite";
}

/** V5 reference inset plan (needs the browser for the canvas and the crop). */
export function insetPlan(ctx: PlanContext, spec: VariantSpec, built: BuiltPrompt, seed: number, priority: ArtPriority): Plan | null {
  const target = ctx.providers.nai;
  const inset = target ? novelAiInsetModelFor("novelai", target.model) : null;
  if (!target || !inset) return null;
  const layoutId = insetLayoutFor(spec);
  const layout = insetLayout(layoutId)!;
  // Speculative work at the technique author's 14 steps; hero art at the host's 28.
  const steps = priority <= 1 ? 28 : 14;
  const plain = () =>
    buildNaiCall({
      target,
      prompt: built.nai.prompt,
      negative: built.nai.negative,
      width: layout.canvas.width,
      height: layout.canvas.height,
      seed,
      effort: "full",
      steps,
      characterTags: built.nai.characterTags,
    });
  const placeholder = compileNovelAiInsetRequest({
    request: { prompt: built.nai.prompt, negativePrompt: plain().negativePrompt ?? "", parameters: {} },
    layout,
    canvas: { image: "", mask: "" },
  });
  const canonicalId = spec.canonical.imageId;
  return {
    lane: "nai",
    label: `nai-v5-inset-${layoutId}`,
    cutout: false,
    descriptor: {
      provider: "novelai",
      model: inset.model,
      prompt: placeholder.prompt,
      negative: placeholder.negativePrompt,
      refs: [canonicalId],
      seed,
      size: `${layout.repaint.width}x${layout.repaint.height}`,
      extra: `inset=${layoutId};steps=${steps};chars=${built.nai.characterTags.join("|")}`,
    },
    prepare: async () => {
      const composed = await ctx.composeInset(layoutId, imageUrl(canonicalId));
      if (!composed.ok) throw new PlanUnavailable(`no inset canvas (${composed.error})`);
      const base = plain();
      const compiled = compileNovelAiInsetRequest({
        request: { prompt: base.prompt, negativePrompt: base.negativePrompt ?? "", parameters: base.parameters ?? {} },
        layout,
        canvas: composed.canvas,
      });
      return { ...base, model: inset.model, prompt: compiled.prompt, negativePrompt: compiled.negativePrompt, parameters: compiled.parameters };
    },
    // The render is the whole canvas: keep only the repainted part, cut out of its white.
    finish: async (raw) => ctx.cutImage(raw, layout.repaint),
    rejects: (error) => {
      if (!novelAiInsetRejected(error, inset.model)) return false;
      ctx.insetOff.add(insetOffKey(target, inset.model));
      return true;
    },
  };
}

/** All plans for an expression or pose, in route order. */
export function variantPlans(ctx: PlanContext, spec: VariantSpec, seed: number, priority: ArtPriority): Plan[] {
  const methods = variantMethods(ctx.look, ctx.providers, ctx.insetOff, spec.canonical.source === "card");
  const plans: Plan[] = [];
  const canonical = spec.canonical.imageId;
  for (const method of methods) {
    if (method === "v5_inset") {
      const built = buildPrompt(spec, ctx.look, { naiAlpha: true, inset: true });
      const plan = insetPlan(ctx, spec, built, seed, priority);
      if (plan) plans.push(plan);
    } else if (method === "gpt_edit" && ctx.providers.gpt) {
      plans.push(gptEditPlan(ctx, ctx.providers.gpt, buildPrompt(spec, ctx.look), priority, [canonical], "high", "gpt-edit-canonical"));
    } else if (method === "plain") {
      const order = ctx.look.preferred === "nai" ? (["nai", "gpt"] as const) : (["gpt", "nai"] as const);
      for (const p of order) {
        if (p === "nai" && ctx.providers.nai) plans.push(naiPlainPlan(ctx.providers.nai, buildPrompt(spec, ctx.look, { naiAlpha: true }), seed, priority, "nai-v5-dna"));
        if (p === "gpt" && ctx.providers.gpt) plans.push(gptPlainPlan(ctx, ctx.providers.gpt, buildPrompt(spec, ctx.look, { standalone: true }), priority, ctx.lock?.anchors.bust?.imageId));
      }
    }
  }
  return plans;
}
