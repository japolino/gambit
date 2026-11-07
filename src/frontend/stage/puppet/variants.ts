/**
 * Gambit's rig variants on top of Cue's standing puppet (docs/DESIGN.md,
 * 5.6). Pure. Cue's rig assumes feet planted on a floor; battles also have
 *
 * - floating (wraiths, eyes): no foot anchor; the whole body bobs and the
 *   hem trails the bob and ripples;
 * - serpentine (eels, coils, blobs): a travelling sine wave runs up the
 *   body; no neck pivot, so head tilt, nod and turn are dropped;
 * - huge (bosses past the frame): the anchor sits below the screen and the
 *   breath is slow, deep and heavy, the sway small.
 *
 * Each variant adjusts the pose and adds a displacement after Cue's
 * puppetDisplace; the vendored math is untouched. Units as in the rig:
 * image heights from the anchor, x right, y up.
 */
import type { RigKind } from "../../../engine/types.js";
import { puppetMeshPositions, type PuppetGrid, type PuppetPose, type PuppetRig } from "../../../vendor/cue-puppet/sprite-puppet-rig.js";

const TAU = Math.PI * 2;
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Breath clock rate per variant (the huge breathe slowly). */
export const VARIANT_BREATH_RATE: Readonly<Record<RigKind, number>> = { standing: 1, floating: 0.9, serpentine: 1.1, huge: 0.6 };

/** Amplitudes (figure heights). */
export const VARIANT_AMPLITUDE = {
  floatBob: 0.016,
  floatDrift: 0.008,
  hemRipple: 0.01,
  serpentWave: 0.02,
  hugeBreath: 1.9,
} as const;

/** The pose a variant wants from Cue's pose (a new object). */
export function variantPose(kind: RigKind, pose: PuppetPose): PuppetPose {
  switch (kind) {
    case "serpentine":
      return { ...pose, tilt: 0, nod: 0, turn: 0, bob: 0, hairX: 0, hairY: 0 };
    case "huge":
      return {
        ...pose,
        lift: pose.lift * VARIANT_AMPLITUDE.hugeBreath,
        widen: pose.widen * 1.5,
        sway: pose.sway * 0.45,
        tilt: pose.tilt * 0.6,
        bob: pose.bob * 0.6,
      };
    default:
      return pose;
  }
}

export type VariantMotion = {
  /** Seconds. */
  time: number;
  /** 0..1 per actor (puppetPhase). */
  phase: number;
  /** Overall strength (0 = still). */
  strength: number;
};

/** A variant's displacement of (x, y), added into `out` (image heights, y up). */
export function variantDisplace(kind: RigKind, rig: PuppetRig, m: VariantMotion, x: number, y: number, out: [number, number]): [number, number] {
  if (!m.strength) return out;
  const figH = rig.figH;
  const s = m.strength;
  const t = m.time + m.phase * 29.3;
  if (kind === "floating") {
    const w = TAU / 3.4;
    const bob = VARIANT_AMPLITUDE.floatBob * figH * Math.sin(w * t);
    // The hem lags the body by a beat and ripples sideways.
    const hem = 1 - smoothstep(0, 0.5 * figH, y);
    const lagged = VARIANT_AMPLITUDE.floatBob * figH * Math.sin(w * (t - 0.45));
    out[0] += s * (VARIANT_AMPLITUDE.floatDrift * figH * Math.sin((TAU * t) / 6.1)
      + VARIANT_AMPLITUDE.hemRipple * figH * hem * hem * Math.sin(TAU * 0.8 * t + (y / figH) * 9));
    out[1] += s * (bob + (lagged - bob) * hem);
  } else if (kind === "serpentine") {
    const k = Math.max(0, y) / figH;
    const weight = smoothstep(0, 0.25, k) * (0.35 + 0.65 * Math.min(1.2, k));
    const phase = TAU * (k * 1.25 - t / 2.6);
    out[0] += s * VARIANT_AMPLITUDE.serpentWave * figH * Math.sin(phase) * weight;
    out[1] += s * 0.25 * VARIANT_AMPLITUDE.serpentWave * figH * Math.cos(phase) * weight;
  }
  return out;
}

/**
 * Pixel positions (x, y down, in the image's own pixels) of the grid under a
 * pose: Cue's puppetMeshPositions, converted from its clip space, plus the
 * variant's displacement.
 */
export function figureMeshPositions(
  rig: PuppetRig, pose: PuppetPose, grid: PuppetGrid, kind: RigKind, motion: VariantMotion,
  width: number, height: number, out: Float32Array<ArrayBuffer> = new Float32Array(grid.uv.length),
): Float32Array<ArrayBuffer> {
  puppetMeshPositions(rig, variantPose(kind, pose), grid, out);
  const extra = kind === "floating" || kind === "serpentine";
  const scratch: [number, number] = [0, 0];
  const { uv } = grid;
  for (let i = 0; i < out.length; i += 2) {
    let px = (out[i]! + 1) * 0.5 * width;
    let py = (1 - out[i + 1]!) * 0.5 * height;
    if (extra) {
      scratch[0] = 0;
      scratch[1] = 0;
      variantDisplace(kind, rig, motion, (uv[i]! - rig.cx) * rig.aspect, rig.by - uv[i + 1]!, scratch);
      px += (scratch[0] / rig.aspect) * width;
      py -= scratch[1] * height;
    }
    out[i] = px;
    out[i + 1] = py;
  }
  return out;
}
