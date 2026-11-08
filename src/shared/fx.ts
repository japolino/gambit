/**
 * Effect sheets and sounds shipped in the repo's assets/ (indexed by `bun run fx:import` into assets/manifest.json,
 * seeded into extension storage on install and update by spindle.json's storage_seed_files). The backend reads
 * them from storage and sends them to the stage (backend/fx-assets.ts); the stage plays them by slot
 * (frontend/stage/fx-library.ts).
 */

/** Where an effect and a sound play, with the file-name words the import uses to fill an empty slot. */
export const SLOTS = {
  /** A signature cut-in starts: the screen cuts to a grey flash, then black. */
  "cutin.shut": ["shut", "close", "tv", "sceneswitch", "swoosh", "whoosh"],
  /** Electricity crawling over the black, then the cracks webbing out. */
  "cutin.crack": ["crack", "fracture", "lightning", "electron", "electric", "spark"],
  /** The black shatters (the sheet's first frames flash at the break). */
  "cutin.shatter": ["shatter", "glass", "break", "burst", "explosion", "super"],
  /** The picture rushes in through the break (a whoosh). */
  "cutin.rush": ["rush", "whoosh", "swing", "large"],
  /** The picture locks into place. */
  "cutin.slam": ["slam", "heavy", "punch", "blow"],
  /** The speed-line backdrop behind the picture (frames cycled while it holds). */
  "cutin.speed": ["speedline", "speed", "lines", "rush"],
  /** Loops quietly under the picture while it holds. */
  "cutin.aura": ["aura", "charge", "flame", "magic", "energy", "glow"],
  /** Each word of the skill name lands. */
  "cutin.stamp": ["stamp", "text", "impact", "hit", "slam"],
  /** A shimmer runs over the name while the picture holds. */
  "cutin.glint": ["glint", "shakin", "kira", "shine", "sparkle"],
  /** The whiteout at the end of the cut-in. */
  "cutin.whiteout": ["lightburst", "whiteout", "flash", "shine", "light"],
  /** The energy release under the whiteout (layered with its sound). */
  "cutin.burst": ["burst", "release", "flame", "explosion"],
  /** A regular (panel) cut-in snaps open. */
  "cutin.panel": ["panel", "cutin", "switch", "swoosh"],
  /** A physical hit on a target. */
  "hit.slash": ["slash", "sword", "cut", "claw"],
  /** A blunt or generic hit. */
  "hit.impact": ["impact", "punch", "hit", "strike", "blow"],
  /** A magic hit with no element slot of its own. */
  "hit.magic": ["magic", "spell", "swirl"],
  /** Element hits; an empty one falls back to hit.magic. */
  "hit.fire": ["fire", "flame", "burn"],
  "hit.frost": ["frost", "ice", "freeze", "water"],
  "hit.storm": ["storm", "thunder", "electron", "electric", "bolt"],
  "hit.shadow": ["shadow", "dark", "blood", "curse", "claw"],
  "hit.light": ["holy", "light", "flare", "shine"],
  /** A critical hit, on top of the hit itself. */
  "hit.crit": ["crit", "critical", "cross", "heavy", "big"],
  /** A heal landing. */
  "hit.heal": ["heal", "cure", "recover"],
  /** A buff or a shield landing. */
  "hit.buff": ["buff", "statusup", "shield", "barrier"],
  /** A harmful status landing. */
  "hit.debuff": ["debuff", "curse", "poison", "statusdown"],
  /** A miss: the swing whiffs. */
  "hit.miss": ["miss", "dodge", "whiff", "swing"],
  /** A hit taken fully by a shield. */
  "hit.guard": ["guard", "block", "parry", "clash"],
  /** A foe's poise breaks. */
  "hit.break": ["break", "stagger", "shatter"],
  /** A foe falls. */
  "hit.defeat": ["defeat", "ko", "down", "collapse"],
  /** An enemy winds up a move. */
  "use.enemy": ["windup", "roar", "growl"],
  /** A party member's turn begins (empty unless a pack has a fitting cue). */
  "turn.start": ["turn", "cursor", "ready"],
} as const satisfies Record<string, readonly string[]>;

export type FxSlot = keyof typeof SLOTS;

export interface FxSheet {
  /** Path inside assets/, e.g. "fx/pipoya/slash01.png". */
  file: string;
  width: number;
  height: number;
  frameW: number;
  frameH: number;
  /** Frames to play, read left to right, top to bottom (a sheet's last row may be partly empty). */
  frames: number;
  fps: number;
  blend: "add" | "normal" | "screen";
  /** Size on screen relative to the effect's natural size at the stage's UI scale. */
  scale: number;
  /** Site, pack and license, for assets/CREDITS.md. */
  source: string;
}

export interface FxSound {
  file: string;
  /** 0..1. */
  volume: number;
  source: string;
}

export interface FxManifest {
  version: 1;
  effects: Record<string, FxSheet>;
  sounds: Record<string, FxSound>;
  /** Effect and sound ids per slot; null is empty, "none" is switched off. `tint` ("#rrggbb") recolours the sheet and
   * `scale` resizes it for this slot only, so one sheet can serve two slots. */
  slots: Record<string, { fx: string | null; sound: string | null; tint?: string; scale?: number }>;
}
