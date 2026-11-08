/**
 * Effect sheets and sounds shipped in the repo's assets/ (indexed by `bun run fx:import` into assets/manifest.json,
 * seeded into extension storage on install and update by spindle.json's storage_seed_files). The backend reads
 * them from storage and sends them to the stage (backend/fx-assets.ts); the stage plays them by slot
 * (frontend/stage/fx-library.ts).
 */

/** Where an effect and a sound play, with the file-name words the import uses to fill an empty slot. */
export const SLOTS = {
  /** The screen shuts before a signature cut-in. */
  "cutin.shut": ["shut", "close", "tv", "swoosh", "whoosh"],
  /** The black cracking before it shatters. */
  "cutin.crack": ["crack", "fracture", "lightning", "spark"],
  /** The screen shatters and the picture slams in. */
  "cutin.shatter": ["shatter", "glass", "break", "burst", "explosion"],
  /** Loops on the move while the picture holds. */
  "cutin.aura": ["aura", "charge", "flame", "magic", "energy", "glow"],
  /** Each word of the skill name lands. */
  "cutin.stamp": ["stamp", "hit", "punch", "impact", "slam"],
  /** The whiteout at the end of the cut-in. */
  "cutin.whiteout": ["flash", "whiteout", "shine", "light"],
  /** A physical hit on a target. */
  "hit.slash": ["slash", "sword", "cut", "claw"],
  /** A blunt or generic hit. */
  "hit.impact": ["impact", "punch", "hit", "strike", "blow"],
  /** A magic hit. */
  "hit.magic": ["magic", "spell", "fire", "ice", "thunder", "dark", "holy"],
  /** A critical hit, on top of the hit itself. */
  "hit.crit": ["crit", "critical", "heavy", "big"],
  /** A heal or a buff landing. */
  "hit.heal": ["heal", "cure", "buff", "recover", "sparkle"],
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
  /** Effect and sound ids per slot; null is empty, "none" is switched off. */
  slots: Record<string, { fx: string | null; sound: string | null }>;
}
