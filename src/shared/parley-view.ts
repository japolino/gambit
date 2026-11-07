/**
 * What the Parley view shows for a mood: which expression of the NPC's
 * portrait (V5 inset variants of the same face), or the neutral portrait.
 * Shared so the backend requests exactly the expressions the view uses.
 */
import type { Mood } from "../engine/parley/types.js";
import type { Expression } from "./art-keys.js";

export const EXPRESSION_FOR_MOOD: Record<Mood, Expression | null> = {
  moved: "sad",
  tempted: "happy",
  amused: "happy",
  considering: null,
  unmoved: null,
  irritated: "angry",
  suspicious: "angry",
  confused: "surprised",
  afraid: "surprised",
};
