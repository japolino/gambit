/**
 * Asset specs -> prompts (pure). An `ArtSpec` says what to draw; `buildPrompt`
 * turns it into the NovelAI tag dialect and the GPT natural-language dialect
 * under the locked look, with the size and transparency each provider gets.
 *
 * Sources of the briefs: `MonsterDef.visual` / `ClassDef.visual`
 * (src/engine/types.ts), a character's stored "visual DNA" (locked tags,
 * description, seed: docs/DESIGN.md 5.3), and location briefs from the world
 * compiler.
 *
 * Transparency:
 * - NAI V5 draws a real alpha channel when the prompt asks for a
 *   `transparent background` (V5's custom VAE, NovelAI's V5 release notes;
 *   Cue relies on the same tag, visual-novel-preview origin/testing
 *   src/backend/runtime/sprites/prompts.ts `SPRITE_ALPHA_FRAMING_TAGS`). The
 *   bare `background` negative tag is left out then (it contradicts the
 *   positive tag). Older NAI models get `simple background, white background`.
 * - GPT Image: `background: "transparent"` (providers.ts) plus a sentence.
 *
 * Figure framing (portraits, expressions) is Cue's validated sprite framing
 * (same file, `SPRITE_FRAMING_TAGS`, prompt version sprite-prompt-v2), with
 * Cue's measured expression tags (`SPRITE_EXPRESSION_TAGS`) for smile, sad
 * and angry.
 */
import type { ClassDef, MonsterDef, RigKind } from "../engine/types.js";
import type { ArtKind } from "../shared/protocol.js";
import { GPT_NO_TEXT, LOOKS, NAI_BASE_NEGATIVE, NAI_NO_TEXT, PROBE_BRIEFS, type LookPreset, type ProbeSubject } from "./looks.js";

/* ------------------------------------------------------------------ */
/* Spec types                                                           */
/* ------------------------------------------------------------------ */

export interface ImageRef {
  imageId: string;
}

/** Stored per character: what keeps them the same person in every image. */
export interface CharacterDNA {
  id: string;
  name: string;
  /** Locked NAI identity tags (hair, eyes, build, outfit), no count or framing tags. */
  tags: string;
  /** Natural-language description of the same, for GPT Image. */
  description: string;
  /** Fixed seed for every render of this character. */
  seed: number;
  /** NAI V4+ character caption lead tag. */
  sex?: "girl" | "boy" | "other";
  /** Comma-separated hex palette (as in the engine's visual briefs). */
  palette?: string;
}

export interface MonsterBrief {
  id: string;
  name: string;
  brief: string;
  palette: string;
  rig: RigKind;
}

export interface LocationBrief {
  id: string;
  name: string;
  description: string;
  timeOfDay?: string;
  weather?: string;
  palette?: string;
}

export interface IconBrief {
  /** Art key the sliced icon is published under. */
  key: string;
  brief: string;
}

export type ExpressionId = "happy" | "sad" | "angry" | "surprised" | "determined" | "hurt";
export const EXPRESSIONS: readonly ExpressionId[] = ["happy", "sad", "angry", "surprised", "determined", "hurt"];

interface SpecBase {
  /** Overrides the seed derived from the key (characters use their DNA seed). */
  seed?: number;
}

export type ArtSpec = SpecBase &
  (
    | { kind: "portrait"; character: CharacterDNA; /** Fusion: both parents' portraits as references (GPT edit). */ parents?: ImageRef[] }
    | { kind: "expression"; character: CharacterDNA; expression: ExpressionId; canonical: ImageRef }
    | { kind: "pose"; character: CharacterDNA; pose: string; canonical: ImageRef }
    | { kind: "monster"; monster: MonsterBrief }
    | { kind: "monster_phase2"; monster: MonsterBrief; phase1: ImageRef; change: string }
    | { kind: "background"; location: LocationBrief }
    | { kind: "background_variant"; location: LocationBrief; original: ImageRef; change: string }
    | { kind: "icon_sheet"; icons: IconBrief[] }
    | { kind: "style_probe"; subject: ProbeSubject; lookId: string }
  );

/** Most icons one GPT sheet holds (4x4, DESIGN 5.3). */
export const ICONS_PER_SHEET = 16;

/* ------------------------------------------------------------------ */
/* From engine definitions                                              */
/* ------------------------------------------------------------------ */

export function monsterBrief(def: Pick<MonsterDef, "id" | "name" | "visual">): MonsterBrief {
  return { id: def.id, name: def.name, brief: def.visual.brief, palette: def.visual.palette, rig: def.visual.rig };
}

/** Phase 2 brief of a monster (its `phase2.into.visual`), or null. */
export function monsterPhase2Brief(def: Pick<MonsterDef, "id" | "name" | "phase2">): MonsterBrief | null {
  const into = def.phase2?.into;
  return into ? { id: `${def.id}:phase2`, name: into.name || def.name, brief: into.visual.brief, palette: into.visual.palette, rig: into.visual.rig } : null;
}

/**
 * Starting DNA for a character of a class. Without Architect-written tags,
 * the class brief serves both dialects (V5 reads natural language in its
 * captions; locked tags should replace it when the Architect writes them).
 */
export function dnaFromClass(
  cls: Pick<ClassDef, "id" | "name" | "visual">,
  who: { id: string; name: string; seed: number; tags?: string; description?: string; sex?: CharacterDNA["sex"] },
): CharacterDNA {
  return {
    id: who.id,
    name: who.name,
    tags: who.tags ?? cls.visual.brief,
    description: who.description ?? `${who.name}, a ${cls.name}: ${cls.visual.brief}`,
    seed: who.seed,
    sex: who.sex,
    palette: cls.visual.palette,
  };
}

/* ------------------------------------------------------------------ */
/* Colour words from hex palettes                                       */
/* ------------------------------------------------------------------ */

/** A basic colour name for a hex colour, or null when it does not parse. */
export function colorName(hex: string): string | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return null;
  const h6 = m[1]!.length === 3 ? m[1]!.split("").map((c) => c + c).join("") : m[1]!;
  const r = parseInt(h6.slice(0, 2), 16) / 255, g = parseInt(h6.slice(2, 4), 16) / 255, b = parseInt(h6.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (l < 0.12) return "black";
  if (l > 0.9 && s < 0.5) return "white";
  if (s < 0.15) return "grey";
  let hue = 0;
  if (d) hue = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  if (hue < 0) hue += 360;
  if (hue < 15 || hue >= 345) return l < 0.35 ? "dark red" : "red";
  if (hue < 40) return l < 0.4 ? "brown" : "orange";
  if (hue < 65) return l < 0.4 ? "olive" : "yellow";
  if (hue < 160) return "green";
  if (hue < 195) return "aqua";
  if (hue < 255) return "blue";
  if (hue < 290) return "purple";
  return "pink";
}

/** Distinct colour names of a comma-separated hex palette, in order. */
export function paletteNames(palette: string | undefined, max = 3): string[] {
  const out: string[] = [];
  for (const part of (palette ?? "").split(",")) {
    const name = colorName(part);
    if (name && !out.includes(name)) out.push(name);
    if (out.length >= max) break;
  }
  return out;
}

function naiPaletteTags(palette: string | undefined): string {
  return paletteNames(palette, 2).map((n) => `${n} theme`).join(", ");
}

function gptPaletteSentence(palette: string | undefined): string {
  const names = paletteNames(palette, 3);
  return names.length ? `Dominant colours: ${names.join(", ")}.` : "";
}

/* ------------------------------------------------------------------ */
/* Kind tables                                                          */
/* ------------------------------------------------------------------ */

/** Cue sprite-prompt-v2 framing, with V5's transparent background (or white for older models / insets). */
const FIGURE_FRAMING = "solo, standing, centered, front view, straight-on, facing viewer, looking at viewer, cowboy shot";
const FIGURE_NEGATIVE = "scenery, shadow, drop shadow, gradient background, multiple people, multiple girls, multiple boys, 2girls, 2boys, multiple views, split screen, border, from below, from above, dutch angle, cropped, out of frame";

const EXPRESSION_TAGS: Readonly<Record<ExpressionId, string>> = {
  // Cue SPRITE_EXPRESSION_TAGS (measured on Anima 2.9B, Oct 2026):
  happy: "smile, open mouth, happy",
  sad: "sad, frown, tearing up",
  angry: "angry, v-shaped eyebrows, frown, clenched teeth, arms at sides",
  // Gambit additions (common Danbooru tags, unmeasured):
  surprised: "surprised, open mouth, wide-eyed",
  determined: "serious, determined, closed mouth, v-shaped eyebrows",
  hurt: "pain, wince, clenched teeth, sweat, one eye closed",
};

const EXPRESSION_TEXT: Readonly<Record<ExpressionId, string>> = {
  happy: "smiling openly, happy",
  sad: "sad, frowning, on the verge of tears",
  angry: "angry, brows drawn down, teeth clenched, arms at the sides",
  surprised: "surprised, eyes wide, mouth open",
  determined: "serious and determined, mouth closed, brows set",
  hurt: "wincing in pain, teeth clenched, one eye squeezed shut, sweating",
};

const RIG_TAGS: Readonly<Record<RigKind, string>> = {
  standing: "full body, standing",
  floating: "full body, floating, levitation",
  serpentine: "full body, coiled",
  huge: "upper body, giant, towering",
};

const RIG_TEXT: Readonly<Record<RigKind, string>> = {
  standing: "Full body, standing on the ground, the whole creature in frame.",
  floating: "Full body, floating in the air with nothing below it, the whole creature in frame.",
  serpentine: "Full body, coiled, the whole creature in frame.",
  huge: "A towering giant seen from the waist or chest up, filling the frame.",
};

/** NovelAI resolutions (W x H) per kind; all at or under Opus' free 1 MP. */
const NAI_SIZE: Readonly<Record<ArtKind, { width: number; height: number }>> = {
  portrait: { width: 832, height: 1216 },
  expression: { width: 832, height: 1216 },
  pose: { width: 832, height: 1216 },
  monster: { width: 1024, height: 1024 },
  monster_phase2: { width: 1024, height: 1024 },
  background: { width: 1216, height: 832 },
  background_variant: { width: 1216, height: 832 },
  icon_sheet: { width: 1024, height: 1024 },
  style_probe: { width: 832, height: 1216 },
};

/** GPT Image sizes (openai.ts capability options). */
const GPT_SIZE: Readonly<Record<ArtKind, string>> = {
  portrait: "1024x1536",
  expression: "1024x1536",
  pose: "1024x1536",
  monster: "1024x1024",
  monster_phase2: "1024x1024",
  background: "1536x1024",
  background_variant: "1536x1024",
  icon_sheet: "1024x1024",
  style_probe: "1024x1536",
};

/** Kinds that ask for a transparent figure. */
export function wantsTransparency(spec: ArtSpec): boolean {
  switch (spec.kind) {
    case "portrait":
    case "expression":
    case "pose":
    case "monster":
    case "monster_phase2":
    case "icon_sheet":
      return true;
    default:
      return false;
  }
}

/* ------------------------------------------------------------------ */
/* Prompt building                                                      */
/* ------------------------------------------------------------------ */

export interface BuiltPrompt {
  kind: ArtKind;
  transparent: boolean;
  nai: {
    prompt: string;
    negative: string;
    /** V4+ character captions (host `characterTags`, novelai.ts:169). */
    characterTags: string[];
    width: number;
    height: number;
  };
  gpt: { prompt: string; size: string };
}

export interface BuildOptions {
  /** The NAI model draws alpha (V5). False: white background for transparent kinds. */
  naiAlpha?: boolean;
  /** Building for a V5 reference inset: opaque white framing (the canvas is white). */
  inset?: boolean;
  /** GPT text for a variant drawn without its canonical image (DNA only). */
  standalone?: boolean;
}

function join(...parts: Array<string | undefined | false>): string {
  return parts
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .map((p) => p.trim().replace(/^,+|,+$/g, ""))
    .join(", ");
}

function sentences(...parts: Array<string | undefined | false>): string {
  return parts.filter((p): p is string => typeof p === "string" && p.trim().length > 0).map((p) => p.trim()).join(" ");
}

function countTag(sex: CharacterDNA["sex"]): string {
  return sex === "boy" ? "1boy" : sex === "other" ? "1other" : sex === "girl" ? "1girl" : "solo focus";
}

function backgroundTags(transparent: boolean, opts: BuildOptions): { pos: string; neg: string } {
  if (!transparent) return { pos: "", neg: "" };
  if (opts.inset || !opts.naiAlpha) return { pos: "simple background, white background, no shadow", neg: "background" };
  return { pos: "transparent background, no shadow", neg: "" };
}

const GPT_TRANSPARENT = "Isolated on a fully transparent background: no floor, no shadow, no scenery.";

/** Prompts for one spec under one look. */
export function buildPrompt(spec: ArtSpec, look: LookPreset, opts: BuildOptions = {}): BuiltPrompt {
  const transparent = wantsTransparency(spec);
  const bg = backgroundTags(transparent, opts);
  const style = look.nai.positive;
  const baseNeg = (extra: string) => join(NAI_BASE_NEGATIVE, look.nai.negative, extra, bg.neg, NAI_NO_TEXT);
  const gptTail = sentences(look.gpt.style, transparent ? GPT_TRANSPARENT : "", look.gpt.avoid, GPT_NO_TEXT);
  const naiSize = NAI_SIZE[spec.kind];
  const out = (prompt: string, negative: string, characterTags: string[], gpt: string): BuiltPrompt => ({
    kind: spec.kind,
    transparent,
    nai: { prompt, negative, characterTags, width: naiSize.width, height: naiSize.height },
    gpt: { prompt: gpt, size: GPT_SIZE[spec.kind] },
  });

  switch (spec.kind) {
    case "portrait":
    case "expression":
    case "pose": {
      const c = spec.character;
      const lead = c.sex ?? "other";
      const mood = spec.kind === "expression" ? EXPRESSION_TAGS[spec.expression] : spec.kind === "pose" ? "" : "light smile";
      const framing = spec.kind === "pose" ? "solo, full body, dynamic pose, action pose" : FIGURE_FRAMING;
      const poseTags = spec.kind === "pose" ? spec.pose : "";
      const charCaption = join(lead, c.tags, mood, poseTags);
      const prompt = join(countTag(c.sex), style, framing, naiPaletteTags(c.palette), bg.pos);
      const negative = baseNeg(join(FIGURE_NEGATIVE, spec.kind === "pose" ? "motion lines, speed lines, special effects" : ""));
      const subject =
        spec.kind === "portrait"
          ? spec.parents?.length
            ? `A single new character who fuses the two reference characters: blend their outfits, colours and motifs into one coherent design. ${c.description}`
            : `Character portrait, three-quarter length, standing and facing the viewer: ${c.description}`
          : opts.standalone
            ? spec.kind === "expression"
              ? `Character portrait, three-quarter length, standing and facing the viewer, ${EXPRESSION_TEXT[spec.expression]}: ${c.description}`
              : `Full-body character in a dynamic action pose: ${spec.pose}. ${c.description}`
            : spec.kind === "expression"
              ? `The same character as in the reference image, same outfit, framing and pose, now ${EXPRESSION_TEXT[spec.expression]}. ${c.description}`
              : `The same character as in the reference image, full body in a dynamic action pose: ${spec.pose}. Keep their face, outfit and colours exactly. ${c.description}`;
      return out(prompt, negative, [charCaption], sentences(subject, gptPaletteSentence(c.palette), gptTail));
    }
    case "monster":
    case "monster_phase2": {
      const m = spec.monster;
      const change = spec.kind === "monster_phase2" ? spec.change : "";
      const prompt = join("no humans, solo, monster, creature", style, m.brief, change, RIG_TAGS[m.rig], "centered", naiPaletteTags(m.palette), bg.pos);
      const negative = baseNeg(join("human, 1girl, 1boy, scenery, multiple views, cropped, out of frame, border"));
      const subject =
        spec.kind === "monster_phase2"
          ? `Transform the creature in the reference image into its second phase: ${spec.change}. It must stay recognisably the same creature: silhouette, colours and key features carry over. ${m.name}: ${m.brief}.`
          : `A fantasy creature, ${m.name}: ${m.brief}.`;
      return out(prompt, negative, [], sentences(subject, RIG_TEXT[m.rig], gptPaletteSentence(m.palette), gptTail));
    }
    case "background":
    case "background_variant": {
      const l = spec.location;
      const change = spec.kind === "background_variant" ? spec.change : "";
      const prompt = join("scenery, no humans", style, l.name, l.description, change, l.timeOfDay, l.weather, naiPaletteTags(l.palette), "detailed background, wide shot");
      const negative = baseNeg("1girl, 1boy, people, person, character, multiple views");
      const where = sentences(
        `${l.name}: ${l.description}`,
        l.timeOfDay ? `Time of day: ${l.timeOfDay}.` : "",
        l.weather ? `Weather: ${l.weather}.` : "",
      );
      const subject =
        spec.kind === "background_variant"
          ? `Edit the location in the reference image so that ${spec.change}. Keep the same place, viewpoint and composition so it is clearly recognisable. ${where}`
          : `A wide establishing view of a location for a game background, with no people in it. ${where}`;
      return out(prompt, negative, [], sentences(subject, gptPaletteSentence(l.palette), gptTail));
    }
    case "icon_sheet": {
      const icons = spec.icons.slice(0, ICONS_PER_SHEET);
      const list = icons.map((icon, i) => `${i + 1}) ${icon.brief}`).join("; ");
      const prompt = join("no humans, icon, item, object focus, grid, still life", style, bg.pos);
      const negative = baseNeg("1girl, 1boy, scenery, grid lines, border, frame");
      const subject = `A sheet of ${icons.length} fantasy game item and skill icons arranged in a 4 by 4 grid of equal square cells, row by row from top left. Each icon is one single object centred in its own cell with clear empty space around it, no grid lines and nothing crossing into another cell. Icons in order: ${list}.`;
      return out(prompt, negative, [], sentences(subject, gptTail));
    }
    case "style_probe": {
      const brief = PROBE_BRIEFS[spec.subject];
      const subjectLook = LOOKS[spec.lookId as keyof typeof LOOKS] ?? look;
      const prompt = join(spec.subject === "bust" ? "1boy" : "", subjectLook.nai.positive, brief.nai);
      const negative = join(NAI_BASE_NEGATIVE, subjectLook.nai.negative, spec.subject === "gate" ? "1girl, 1boy, people" : "multiple views", NAI_NO_TEXT);
      const gpt = sentences(brief.gpt, subjectLook.gpt.style, subjectLook.gpt.avoid, GPT_NO_TEXT);
      const size = spec.subject === "gate" ? NAI_SIZE.background : NAI_SIZE.style_probe;
      return {
        kind: spec.kind,
        transparent: false,
        nai: { prompt, negative, characterTags: [], width: size.width, height: size.height },
        gpt: { prompt: gpt, size: spec.subject === "gate" ? GPT_SIZE.background : GPT_SIZE.style_probe },
      };
    }
  }
}

/** The sentence added to a GPT prompt when a style anchor image rides along as reference. */
export const GPT_STYLE_REFERENCE =
  "The attached image is a style reference only: match its art style, palette, brushwork and lighting, but do not copy its subject, composition or background.";
