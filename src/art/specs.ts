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
import { CUTIN_DIRECTION, PARLEY_DIRECTION } from "./directions.js";

/* ------------------------------------------------------------------ */
/* Spec types                                                           */
/* ------------------------------------------------------------------ */

export interface ImageRef {
  imageId: string;
  /** "card": art the user brought (a card's avatar or sprite), not Gambit's own render. */
  source?: "card";
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
  /** Appearance tags from the user's own character library (Inlay Illustrator); used even for card art, where `tags` is prose. */
  booru?: string;
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
    /** A combat cut-in (art/directions.ts CUTIN_DIRECTION): `pose` is the move as tags, `poseText` in words. */
    | { kind: "pose"; character: CharacterDNA; pose: string; poseText?: string; canonical: ImageRef }
    | { kind: "monster"; monster: MonsterBrief }
    | { kind: "monster_phase2"; monster: MonsterBrief; phase1: ImageRef; change: string }
    | { kind: "background"; location: LocationBrief }
    | { kind: "background_variant"; location: LocationBrief; original: ImageRef; change: string }
    | { kind: "icon_sheet"; icons: IconBrief[] }
    | { kind: "style_probe"; subject: ProbeSubject; lookId: string }
    /** A character's own full figure, drawn from their tags (Inlay's character tags when there), transparent: what scenes, tokens and cut-ins show. */
    | { kind: "figure"; character: CharacterDNA }
    /** A moment as a wide illustration (a CG): who is in it (with their figures as references), where, and what happens. */
    /** `direction: "parley"`: a Parley moment, the one person seen from the speaker's eyes (art/directions.ts). */
    | { kind: "cg"; moment: string; tags?: string; cast: { character: CharacterDNA; ref?: ImageRef }[]; location?: LocationBrief; direction?: "event" | "parley" }
    /** A place seen from above as a tabletop map, for the expedition board (its painting rides along as a style reference). */
    | { kind: "map"; location: LocationBrief; painting?: ImageRef }
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

/** Tags of a body that doesn't stand on two legs: "standing", "head to toe" and "arms at sides" would give it human ones. */
const NOT_ON_TWO_LEGS = /\b(lamia|naga|snake|serpent|scylla|mermaid|merfolk|fish tail|centaur|taur|arachne|drider|spider|slime|ghost|no legs|legless)\b/i;
export const standsOnTwoLegs = (tags: string): boolean => !NOT_ON_TWO_LEGS.test(tags);

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
  pose: { width: 1216, height: 832 },
  monster: { width: 1024, height: 1024 },
  monster_phase2: { width: 1024, height: 1024 },
  background: { width: 1216, height: 832 },
  background_variant: { width: 1216, height: 832 },
  icon_sheet: { width: 1024, height: 1024 },
  style_probe: { width: 832, height: 1216 },
  figure: { width: 832, height: 1216 },
  cg: { width: 1216, height: 832 },
  map: { width: 1024, height: 1024 },
};

/** GPT Image sizes (openai.ts capability options). */
const GPT_SIZE: Readonly<Record<ArtKind, string>> = {
  portrait: "1024x1536",
  expression: "1024x1536",
  pose: "1536x1024",
  monster: "1024x1024",
  monster_phase2: "1024x1024",
  background: "1536x1024",
  background_variant: "1536x1024",
  icon_sheet: "1024x1024",
  style_probe: "1024x1536",
  figure: "1024x1536",
  cg: "1536x1024",
  map: "1024x1024",
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
    case "figure":
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
  // Drawn from the user's own art (a card's avatar or sprite): the reference
  // carries the style and the identity. The look's style words fought it (an
  // oil-painting look against a cartoon card gave an off-model ink figure).
  const fromCard = (spec.kind === "expression" || spec.kind === "pose") && spec.canonical.source === "card";
  const style = fromCard ? "" : look.nai.positive;
  const baseNeg = (extra: string) => join(NAI_BASE_NEGATIVE, fromCard ? "" : look.nai.negative, extra, bg.neg, NAI_NO_TEXT);
  const gptTail = sentences(fromCard ? "Match the reference image's art style exactly." : look.gpt.style, transparent ? GPT_TRANSPARENT : "", fromCard ? "" : look.gpt.avoid, GPT_NO_TEXT);
  const naiSize = NAI_SIZE[spec.kind];
  const out = (prompt: string, negative: string, characterTags: string[], gpt: string): BuiltPrompt => ({
    kind: spec.kind,
    transparent,
    nai: { prompt, negative, characterTags, width: naiSize.width, height: naiSize.height },
    gpt: { prompt: gpt, size: GPT_SIZE[spec.kind] },
  });

  switch (spec.kind) {
    case "pose": {
      // A combat cut-in: the move bursting out of the frame (CUTIN_DIRECTION).
      const c = spec.character;
      const charCaption = join(c.sex ?? "other", c.booru || (fromCard ? "" : c.tags), spec.pose);
      const prompt = join(countTag(c.sex), style, CUTIN_DIRECTION.tags, naiPaletteTags(c.palette), bg.pos);
      const negative = baseNeg(CUTIN_DIRECTION.negative);
      const action = spec.poseText || spec.pose;
      const subject = opts.standalone
        ? `${CUTIN_DIRECTION.text} The character is ${action}. ${c.description}`
        : `The same character as in the reference image, as a cut-in: ${CUTIN_DIRECTION.text} They are ${action}. Keep their face, outfit and colours exactly. ${c.description}`;
      return out(prompt, negative, [charCaption], sentences(subject, gptPaletteSentence(c.palette), gptTail));
    }
    case "portrait":
    case "expression": {
      const c = spec.character;
      const lead = c.sex ?? "other";
      const mood = spec.kind === "expression" ? EXPRESSION_TAGS[spec.expression] : "light smile";
      // A card's look is prose from the reader, not tags; the reference shows who they are.
      // Library tags (Inlay) are real tags and keep the details on-model.
      const charCaption = join(lead, c.booru || (fromCard ? "" : c.tags), mood);
      const prompt = join(countTag(c.sex), style, FIGURE_FRAMING, naiPaletteTags(c.palette), bg.pos);
      const negative = baseNeg(FIGURE_NEGATIVE);
      const subject =
        spec.kind === "portrait"
          ? spec.parents?.length
            ? `A single new character who fuses the two reference characters: blend their outfits, colours and motifs into one coherent design. ${c.description}`
            : `Character portrait, three-quarter length, standing and facing the viewer: ${c.description}`
          : opts.standalone
            ? `Character portrait, three-quarter length, standing and facing the viewer, ${EXPRESSION_TEXT[spec.expression]}: ${c.description}`
            : `The same character as in the reference image, same outfit, framing and pose, now ${EXPRESSION_TEXT[spec.expression]}. ${c.description}`;
      return out(prompt, negative, [charCaption], sentences(subject, gptPaletteSentence(c.palette), gptTail));
    }
    case "figure": {
      // The character's own standing figure, whole and transparent (V5 alpha), so
      // later variants get a clean V5 reference for the inset.
      const c = spec.character;
      // Library tags (Inlay: the character tag, then head, eyes, body, outfit) say who they are.
      const charCaption = join(c.sex ?? "other", c.booru || c.tags.slice(0, 260), "light smile");
      const legs = standsOnTwoLegs(`${c.booru ?? ""} ${c.tags}`);
      const prompt = join(countTag(c.sex), style, legs ? "solo, full body, standing, centered, front view, straight-on, facing viewer, looking at viewer, arms at sides" : "solo, full body, centered, front view, facing viewer, looking at viewer", naiPaletteTags(c.palette), bg.pos);
      const negative = baseNeg(join(FIGURE_NEGATIVE.replace(", cropped, out of frame", ""), "cropped, out of frame, cowboy shot, upper body, portrait, close-up"));
      const subject = legs ? `A full-body standing figure from head to toe, facing the viewer, arms relaxed: ${c.description}` : `The whole of this character's body in view, facing the viewer: ${c.description}`;
      return out(prompt, negative, [charCaption], sentences(subject, gptPaletteSentence(c.palette), gptTail));
    }
    case "cg": {
      // An event illustration: wide, with a background, the characters acting in it.
      const where = spec.location ? `${spec.location.name}, ${spec.location.description}` : "";
      const counts = spec.cast.map((x) => countTag(x.character.sex)).filter((t) => t !== "solo focus");
      const parley = spec.direction === "parley";
      const shot = parley ? PARLEY_DIRECTION.tags : "cinematic composition, detailed background, dynamic angle, event illustration";
      const prompt = join(counts.join(", ") || "no humans", style, parley ? "" : spec.tags, shot, where, spec.location?.timeOfDay);
      const negative = baseNeg(join("multiple views, split screen, border, comic, panels, text, speech bubble", parley ? PARLEY_DIRECTION.negative : ""));
      // A Parley moment's tags are the person's own reaction: they ride in their caption.
      const captions = spec.cast.map((x, i) => join(x.character.sex ?? "other", x.character.booru || x.character.tags.slice(0, 200), parley && i === 0 ? spec.tags : ""));
      const people = spec.cast.map((x) => `${x.character.name}: ${x.character.description}`).join(" ");
      const lead = parley ? `${PARLEY_DIRECTION.text} The moment: ${spec.moment}.` : `A cinematic illustration of a story moment: ${spec.moment}.`;
      return out(prompt, negative, captions, sentences(lead, where ? `Setting: ${where}.` : "", people, spec.cast.some((x) => x.ref) ? "Keep each character exactly as in their reference image." : "", gptTail));
    }
    case "map": {
      const l = spec.location;
      const prompt = join("no humans, scenery", style, "map, top-down view, from above, overhead view, tabletop game board, terrain, paths", l.name, l.description, naiPaletteTags(l.palette), "detailed, full frame");
      const negative = baseNeg("1girl, 1boy, people, person, character, text, letters, compass rose, grid, hexagons, border, frame, perspective, horizon, sky");
      const subject = `A top-down map of this place as a game board seen straight from above, no people, no text, no grid: ${l.name}: ${l.description}.${spec.painting ? " Match the attached painting's art style and palette." : ""}`;
      return out(prompt, negative, [], sentences(subject, gptPaletteSentence(l.palette), gptTail));
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
      const subjectLook = look.id === spec.lookId ? look : (LOOKS[spec.lookId as keyof typeof LOOKS] ?? look);
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
