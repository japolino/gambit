/**
 * Spec -> ordered plans (routes) for every art kind (docs/DESIGN.md, 5.3):
 *
 * | kind                | routes, in order                                              |
 * |---------------------|---------------------------------------------------------------|
 * | portrait            | look's provider, then the other (GPT with the bust anchor)    |
 * | portrait + parents  | GPT edit of both parents (fusion), then plain                  |
 * | expression, pose    | consistency.ts (V5 inset / GPT edit / V4.5 ref / plain DNA)   |
 * | monster             | look's per-kind provider (NAI V5 alpha by default), the other |
 * | monster_phase2      | GPT edit of phase 1 (fidelity high), then plain                |
 * | background          | look's provider, then the other (GPT with the gate anchor)    |
 * | background_variant  | GPT edit of the original (fidelity high), then plain           |
 * | icon_sheet          | GPT only (gate anchor); none -> placeholder icons              |
 * | style_probe         | the probed look's provider, then the other; no anchor          |
 * | figure              | consistency.ts from the card art, then cut out in the browser  |
 * | cg                  | V4.5 reference on the cast's figures / GPT edit, then plain    |
 * | map                 | GPT edit of the painting, then the look's provider             |
 *
 * The seed is the spec's, else the character DNA's, else derived from the key.
 */
import type { ArtPriority } from "../shared/protocol.js";
import { variantPlans } from "./consistency.js";
import { seed32 } from "./hash.js";
import { lookById, providerOrder } from "./looks.js";
import { gptEditPlan, gptPlainPlan, naiPlainPlan, withUser, type PlanContext } from "./plan-kit.js";
import type { Plan } from "./queue.js";
import { buildPrompt, type ArtSpec } from "./specs.js";
import { buildNaiCall } from "./providers.js";

export function seedFor(key: string, spec: ArtSpec): number {
  if (typeof spec.seed === "number" && Number.isFinite(spec.seed)) return Math.abs(Math.floor(spec.seed)) % 4294967296;
  if ("character" in spec && spec.character && Number.isFinite(spec.character.seed)) return Math.abs(Math.floor(spec.character.seed)) % 4294967296;
  return seed32(key);
}

/** Plain routes in the look's provider order for this kind. */
function plainPlans(ctx: PlanContext, spec: ArtSpec, seed: number, priority: ArtPriority, anchor?: string): Plan[] {
  const look = spec.kind === "style_probe" ? (ctx.lookOf?.(spec.lookId) ?? lookById(spec.lookId) ?? ctx.look) : ctx.look;
  const out: Plan[] = [];
  for (const p of providerOrder(look, spec.kind)) {
    if (p === "nai" && ctx.providers.nai) out.push(naiPlainPlan(ctx.providers.nai, buildPrompt(spec, look, { naiAlpha: true }), seed, priority));
    if (p === "gpt" && ctx.providers.gpt) {
      const built = buildPrompt(spec, look);
      if (anchor) out.push(gptPlainPlan(ctx, ctx.providers.gpt, built, priority, anchor));
      out.push(gptPlainPlan(ctx, ctx.providers.gpt, built, priority));
    }
  }
  return out;
}

/**
 * A CG: drawn from the cast's tags (one caption per person, Inlay's
 * character tags when there). A GPT edit with their figures comes first
 * when GPT is connected.
 */
function cgPlans(ctx: PlanContext, spec: Extract<ArtSpec, { kind: "cg" }>, seed: number, priority: ArtPriority): Plan[] {
  const refs = spec.cast.flatMap((x) => (x.ref ? [x.ref.imageId] : [])).slice(0, 2);
  const out: Plan[] = [];
  if (refs.length && ctx.providers.gpt) out.push(gptEditPlan(ctx, ctx.providers.gpt, buildPrompt(spec, ctx.look), priority, refs, "high", "gpt-cg-cast"));
  out.push(...plainPlans(ctx, spec, seed, priority));
  return out;
}

/** Every route for a spec, best first. Empty when no connection can draw it. */
export function plansFor(ctx: PlanContext, key: string, spec: ArtSpec, priority: ArtPriority): Plan[] {
  const seed = seedFor(key, spec);
  const bust = ctx.lock?.anchors.bust?.imageId;
  const gate = ctx.lock?.anchors.gate?.imageId;
  let plans: Plan[];
  switch (spec.kind) {
    case "portrait":
      plans = [];
      if (spec.parents?.length && ctx.providers.gpt) {
        plans.push(gptEditPlan(ctx, ctx.providers.gpt, buildPrompt(spec, ctx.look), priority, spec.parents.map((p) => p.imageId), "high", "gpt-fusion"));
      }
      plans.push(...plainPlans(ctx, spec.parents?.length ? { ...spec, parents: undefined } : spec, seed, priority, bust));
      break;
    case "expression":
    case "pose":
      plans = variantPlans(ctx, spec, seed, priority);
      break;
    case "figure":
      // Drawn fresh from their tags (Inlay's character tags when there), transparent on V5.
      plans = plainPlans(ctx, spec, seed, priority);
      break;
    case "cg":
      plans = cgPlans(ctx, spec, seed, priority);
      break;
    case "map":
      plans = [];
      if (spec.painting && ctx.providers.gpt) plans.push(gptEditPlan(ctx, ctx.providers.gpt, buildPrompt(spec, ctx.look), priority, [spec.painting.imageId], "low", "gpt-map-from-painting"));
      plans.push(...plainPlans(ctx, spec, seed, priority, gate));
      break;
    case "monster":
      plans = plainPlans(ctx, spec, seed, priority, gate);
      break;
    case "monster_phase2":
      plans = [];
      if (ctx.providers.gpt) plans.push(gptEditPlan(ctx, ctx.providers.gpt, buildPrompt(spec, ctx.look), priority, [spec.phase1.imageId], "high", "gpt-edit-phase1"));
      plans.push(...plainPlans(ctx, { kind: "monster", monster: { ...spec.monster, brief: `${spec.monster.brief}, ${spec.change}` }, seed: spec.seed }, seed, priority, gate));
      break;
    case "background":
      plans = plainPlans(ctx, spec, seed, priority, gate);
      break;
    case "background_variant":
      plans = [];
      if (ctx.providers.gpt) plans.push(gptEditPlan(ctx, ctx.providers.gpt, buildPrompt(spec, ctx.look), priority, [spec.original.imageId], "high", "gpt-edit-original"));
      plans.push(...plainPlans(ctx, { kind: "background", location: { ...spec.location, description: `${spec.location.description}, ${spec.change}` }, seed: spec.seed }, seed, priority, gate));
      break;
    case "icon_sheet":
      plans = ctx.providers.gpt
        ? [...(gate ? [gptPlainPlan(ctx, ctx.providers.gpt, buildPrompt(spec, ctx.look), priority, gate)] : []), gptPlainPlan(ctx, ctx.providers.gpt, buildPrompt(spec, ctx.look), priority)]
        : [];
      break;
    case "style_probe":
      plans = plainPlans(ctx, spec, seed, priority);
      break;
  }
  return plans.map((p) => withUser(p, ctx.userId));
}
