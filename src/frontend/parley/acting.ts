import type { Mood } from "../../engine/parley/types.js";
import type { PuppetGestureKind } from "../../vendor/cue-puppet/sprite-puppet-acting.js";

/**
 * The read as body language on the puppet (docs/DESIGN.md 5.6): a Cue mood,
 * its intensity, and the gesture that lands it.
 */
export const PUPPET_ACT: Record<Mood, [string | null, number, PuppetGestureKind?]> = {
  moved: ["sad", 2, "nod"],
  tempted: ["smile", 3, "lean_in"],
  considering: ["thinking", 2],
  unmoved: [null, 3],
  irritated: ["angry", 3, "puff"],
  suspicious: ["smug", 2, "turn_away"],
  confused: ["thinking", 4, "wonder"],
  afraid: ["scared", 3, "step_back"],
  amused: ["laughing", 3, "bounce"],
};
