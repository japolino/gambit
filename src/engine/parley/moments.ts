/**
 * Parley moments (docs/DESIGN.md 4.1.6): the few exchanges worth a picture.
 * Most lines only move the track; a moment is the beat that changes the
 * talk: a line that lands hard, one that blows up in your face, a bluff they
 * catch, the end. Each is drawn as the person seen from where you stand,
 * reacting, in the place (art/directions.ts PARLEY_DIRECTION).
 *
 * Pure and deterministic: the backend picks which exchanges to draw and the
 * view captions them from the same answer.
 */
import type { Exchange, Mood, ParleyScenario, ParleyState } from "./types.js";

export type MomentBeat = "lands" | "backfires" | "caught" | "won" | "walked";

export interface ParleyMoment {
  beat: MomentBeat;
  /** A few words under the picture. */
  caption: string;
  /** NovelAI tags: their face and body at this beat. */
  tags: string;
  /** The beat in words, for GPT Image and the record. */
  moment: string;
}

/** Most pictures one Parley draws (the end always gets one). */
export const MOMENTS_PER_PARLEY = 4;

const MOOD_TAGS: Readonly<Record<Mood, string>> = {
  moved: "surprised, parted lips, hand on own chest, softened eyes",
  tempted: "smirk, leaning forward, hand on own chin, half-closed eyes",
  considering: "thinking, hand on own chin, looking at viewer",
  unmoved: "expressionless, crossed arms, looking down at viewer",
  irritated: "annoyed, frown, clenched teeth",
  suspicious: "narrowed eyes, raised eyebrow, frown",
  confused: "confused, head tilt, raised eyebrow",
  afraid: "scared, wide-eyed, sweat, leaning back",
  amused: "laughing, closed eyes, hand over own mouth",
};

const BEAT_TAGS: Readonly<Record<MomentBeat, string>> = {
  lands: "",
  backfires: "angry, glaring, shaded face, looking down at viewer, from below",
  caught: "smug, pointing at viewer, leaning forward, narrowed eyes",
  won: "smile, reaching towards viewer, open hand, relieved",
  walked: "turning away, looking back, over shoulder, from side",
};

/** Which beat an exchange is, or null for an ordinary line. */
export function momentBeat(ex: Exchange): MomentBeat | null {
  const end = ex.ended?.kind;
  if (end === "won" || end === "deal") return "won";
  if (end === "walked" || end === "refused") return "walked";
  if (ex.bluff?.caught) return "caught";
  if (ex.roll.result === "crit_success") return "lands";
  if (ex.roll.result === "crit_fail") return "backfires";
  return null;
}

function captionOf(beat: MomentBeat, name: string, ex: Exchange): string {
  switch (beat) {
    case "lands":
      return "That one lands.";
    case "backfires":
      return "It blows up in your face.";
    case "caught":
      return `${name} calls the bluff.`;
    case "won":
      return ex.ended?.kind === "deal" ? "A deal." : `${name} gives in.`;
    case "walked":
      return `${name} is done talking.`;
  }
}

/** The moment an exchange makes, or null when it is not one. */
export function parleyMoment(scenario: ParleyScenario, ex: Exchange): ParleyMoment | null {
  const beat = momentBeat(ex);
  if (!beat) return null;
  const npc = scenario.npc;
  // A caught bluff or a blow-up shows their reaction to you; otherwise their mood leads.
  const tags = [beat === "lands" || beat === "won" ? MOOD_TAGS[ex.mood] : "", BEAT_TAGS[beat]].filter(Boolean).join(", ");
  const tell = npc.stance.tells?.[ex.mood];
  const what: Record<MomentBeat, string> = {
    lands: `the speaker's words hit home and ${npc.name} is ${ex.mood}`,
    backfires: `the speaker's words backfire and ${npc.name} turns on them`,
    caught: `${npc.name} catches the speaker in a lie`,
    won: ex.ended?.kind === "deal" ? `${npc.name} agrees to the deal over ${scenario.contest.stake}` : `${npc.name} gives in over ${scenario.contest.stake}`,
    walked: `${npc.name} ends the talk and turns to leave`,
  };
  return {
    beat,
    caption: captionOf(beat, npc.name, ex),
    tags,
    moment: `${npc.name}, ${npc.role}, at ${scenario.setting.replace(/\.$/, "")}: ${what[beat]}${tell ? ` (${tell.replace(/\.$/, "")})` : ""}`,
  };
}

/** Exchanges of a Parley that get a picture, oldest first (capped; the end always counts). */
export function momentIndexes(scenario: ParleyScenario, state: Pick<ParleyState, "exchanges">): number[] {
  const all = state.exchanges.filter((ex) => parleyMoment(scenario, ex)).map((ex) => ex.index);
  const last = state.exchanges.at(-1);
  const end = last?.ended && last.ended.kind !== "final_offer" && all.includes(last.index) ? last.index : null;
  const picked = all.filter((i) => i !== end).slice(0, end === null ? MOMENTS_PER_PARLEY : MOMENTS_PER_PARLEY - 1);
  return end === null ? picked : [...picked, end];
}
