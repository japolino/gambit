/**
 * Directions: how a kind of picture is shot, kept apart from who is in it.
 * Two of them are Gambit's own presets (docs/DESIGN.md 5.4, 4.1.6):
 *
 * - Cut-in (combat): a fighter bursting into frame on their signature move,
 *   the way gacha and fighting games splash a character: a dynamic pose,
 *   foreshortening, hair and cloth whipped by the motion, the move's own
 *   effects around them (fire, ice, a magic circle), on an empty ground so
 *   the stage can cut it out and lay it over its band.
 * - Parley moment: the person you are talking to, seen from where you stand
 *   (POV), at the beat that changes the talk: the line that lands, the bluff
 *   they catch, the moment they walk out.
 *
 * Pure: tags for NovelAI, sentences for GPT Image.
 */
import type { Atom, Element, SkillDef } from "../engine/types.js";

export interface Direction {
  /** NovelAI tags for the shot (framing, camera, energy). */
  tags: string;
  /** NovelAI negative tags the shot adds. */
  negative: string;
  /** The same shot in words, for GPT Image. */
  text: string;
}

/* ------------------------------------------------------------------ */
/* Combat cut-in                                                        */
/* ------------------------------------------------------------------ */

export const CUTIN_DIRECTION: Direction = {
  tags: "solo, dynamic pose, action pose, foreshortening, dynamic angle, dutch angle, intense eyes, glaring, wind, floating hair, floating clothes, motion blur, dramatic lighting, splash art, cel shading",
  negative: "scenery, background, multiple views, split screen, border, frame, standing, arms at sides, straight-on, calm",
  text: "A splash-art cut-in of the character in mid-action, like a fighting-game special-move cut-in: a dynamic, foreshortened pose at a slanted angle, an intense glare, hair and clothes whipped by the motion, the move's effects swirling around them. Nothing behind them: no scenery, no floor.",
};

const ELEMENT_FX: Readonly<Record<Element, string>> = {
  physical: "motion lines, speed lines, afterimage",
  fire: "fire, flames, embers, burning",
  frost: "ice, ice crystals, frost, cold breath",
  storm: "lightning, electricity, sparks",
  water: "water, splashing, water drops",
  earth: "rock, flying debris, dust cloud",
  light: "glowing, light particles, holy light, light rays",
  shadow: "dark aura, purple flames, shadow tendrils",
  blood: "red aura, crimson mist",
};

const ELEMENT_WORDS: Readonly<Record<Element, string>> = {
  physical: "speed lines and afterimages",
  fire: "a trail of fire and embers",
  frost: "shards of ice and frost",
  storm: "crackling lightning",
  water: "arcs of splashing water",
  earth: "flying rock and dust",
  light: "rays of holy light",
  shadow: "a dark aura and purple flame",
  blood: "a crimson mist",
};

/** Skill FX ids (stage/cutin/fx.ts) that have a drawn counterpart. */
const FX_TAGS: Readonly<Record<string, string>> = {
  glyph_ring: "magic circle",
  ink_wash: "ink splash",
  ember: "embers",
  impact_frame: "impact",
  chromatic_split: "glowing eyes",
};

function atomsOf(skill: SkillDef): Atom[] {
  const out: Atom[] = [];
  const walk = (atoms: Atom[]) => {
    for (const a of atoms) {
      out.push(a);
      if (a.op === "when") walk(a.then);
    }
  };
  walk(skill.atoms ?? []);
  return out;
}

/** What the move does, as a pose: a strike, a spell, a ward, a healing. */
function moveOf(skill: SkillDef | undefined): { tags: string; text: string; element: Element | null } {
  const atoms = skill ? atomsOf(skill) : [];
  const hit = atoms.find((a): a is Extract<Atom, { op: "hit" }> => a.op === "hit");
  if (hit) {
    return hit.scale === "spirit"
      ? { tags: "casting spell, outstretched arm, reaching towards viewer, open hand, magic", text: "casting a spell with one arm thrust out toward the viewer, open hand first", element: hit.element }
      : { tags: "attacking, lunging, weapon swing, slashing, holding weapon", text: "lunging into a strike, weapon swung through the frame", element: hit.element };
  }
  if (atoms.some((a) => a.op === "heal")) return { tags: "healing magic, glowing hands, hands together, light particles", text: "calling up healing light between their hands", element: "light" };
  if (atoms.some((a) => a.op === "shield")) return { tags: "defensive stance, magic barrier, arm up", text: "bracing behind a flaring magic barrier", element: null };
  return { tags: "fighting stance, clenched fist, aura", text: "dropping into a fighting stance, an aura flaring", element: null };
}

/** The action of a fighter's cut-in, from their signature move: tags, then words. */
export function cutinAction(skill: SkillDef | undefined): { tags: string; text: string } {
  const move = moveOf(skill);
  const fx = [...new Set((skill?.visual?.fx ?? []).map((f) => FX_TAGS[f]).filter((t): t is string => !!t))];
  const tags = [move.tags, move.element ? ELEMENT_FX[move.element] : "", ...fx].filter(Boolean).join(", ");
  const name = skill?.name ? ` (${skill.name})` : "";
  const text = `${move.text}${name}${move.element ? `, with ${ELEMENT_WORDS[move.element]}` : ""}`;
  return { tags, text };
}

/* ------------------------------------------------------------------ */
/* Parley moment                                                        */
/* ------------------------------------------------------------------ */

export const PARLEY_DIRECTION: Direction = {
  tags: "pov, looking at viewer, eye contact, upper body, close-up, conversation, dramatic lighting, depth of field, detailed background, cinematic angle",
  negative: "multiple views, split screen, border, comic, panels, speech bubble, from behind the viewer, full body, wide shot",
  text: "Seen from the viewer's own eyes (POV) across a conversation: the person faces the viewer close up, chest up, with the place soft behind them, lit like a film still at the moment that matters.",
};
