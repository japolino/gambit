/**
 * The few types and constants the vendored puppet modules import from Cue's
 * sprite layer (src/frontend/stage/sprite-layer.ts), shared sprite contract
 * (src/shared/sprites.ts) and config (src/config.ts), copied from Cue
 * origin/testing @ ab0fa34. Only what the puppet modules and their tests
 * read; the definitions are unchanged (the expression fallback table is
 * trimmed to ids a battle can meet). Vendored; Gambit does not depend on
 * Cue at runtime.
 */

/* ------------------------------------------------------------------------ */
/* src/shared/sprites.ts                                                     */
/* ------------------------------------------------------------------------ */

export const SPRITE_HOT_SET = [
  "idle",
  "smile",
  "laughing",
  "sad",
  "crying_with_eyes_open",
  "angry",
  "surprised",
  "embarrassed",
  "worried",
  "thinking",
  "smug",
  "scared",
] as const;
export type SpriteHotExpression = (typeof SPRITE_HOT_SET)[number];

/** Nearest hot-set expression for the catalogue ids the puppet modules meet (Cue keeps the full catalogue). */
export const SPRITE_EXPRESSION_FALLBACK: Readonly<Record<string, SpriteHotExpression>> = {
  idle: "idle", speak: "idle", smile: "smile", laugh: "laughing", think: "thinking", sad: "sad",
  angry: "angry", surprise: "surprised", wave: "smile", shy: "embarrassed", listen: "idle",
  contempl: "thinking", default: "idle", standing: "idle", acting_coy: "embarrassed",
  acting_cute: "smile", admiring: "smile", angry_smiling: "angry", annoyed: "angry",
  blushing_shyly: "embarrassed", bored: "idle", bridling: "angry", childlike_whining: "sad",
  chuunibyou: "smug", confused: "thinking", contemptuous: "smug", coughing: "worried",
  cozy: "smile", crazy_smiling: "smug", crying_with_eyes_closed: "crying_with_eyes_open",
  crying_with_eyes_open: "crying_with_eyes_open", curious: "thinking", depressed: "sad",
  determined: "smug", disappointed: "sad", disgusted: "angry", dozing_off: "idle",
  embarrassed: "embarrassed", enraged: "angry", eureka: "surprised", evil_smiling: "smug",
  excited: "laughing", exhausted: "sad", fidgeting_shyly: "embarrassed", flustered: "embarrassed",
  forced_smiling: "worried", full_face_blush: "embarrassed", giggling: "laughing", grudging: "angry",
  guilty: "worried", happy_smiling: "smile", happy_tears: "crying_with_eyes_open",
  head_bump: "embarrassed", indifferent: "idle", jealous: "angry", joyful: "laughing",
  laughing: "laughing", looking_away_shyly: "embarrassed", melancholic: "sad", nervous: "worried",
  nervous_pouting: "worried", overwhelmed: "worried", play_dumb: "smile", playful_winking: "smug",
  pleading: "worried", pouting: "angry", proud: "smug", relieved: "smile", scared: "scared",
  scared_screaming: "scared", serious: "idle", shocked: "surprised", sleepy: "idle",
  smiling: "smile", smirk: "smug", smug: "smug", sniggering: "smug", spacey: "idle",
  stretching: "idle", stupefied: "surprised", surprised: "surprised", suspicious: "thinking",
  taunting: "smug", teary_pouting: "crying_with_eyes_open", thinking: "thinking",
  tormented: "crying_with_eyes_open", worried: "worried",
};

const HOT_SET: ReadonlySet<string> = new Set(SPRITE_HOT_SET);

export function isSpriteHotExpression(value: unknown): value is SpriteHotExpression {
  return typeof value === "string" && HOT_SET.has(value);
}

/** Nearest hot-set expression; unknown or empty ids map to "idle". */
export function spriteFallbackExpression(expression: string | null | undefined): SpriteHotExpression {
  if (!expression) return "idle";
  if (isSpriteHotExpression(expression)) return expression;
  return SPRITE_EXPRESSION_FALLBACK[expression] ?? "idle";
}

export const SPRITE_MOTIONS = [
  "none", "hop", "bounce", "shake", "tremble", "step_back", "lean_in", "nod", "turn_away", "sink",
] as const;
export type SpriteMotion = (typeof SPRITE_MOTIONS)[number];

export const SPRITE_EMOTES = [
  "none", "sweat", "anger", "heart", "sparkle", "exclaim", "question", "ellipsis", "music", "gloom", "blush",
] as const;
export type SpriteEmote = (typeof SPRITE_EMOTES)[number];

/** Normalized face box: [x, y, width, height], 0..1 of the whole image. */
export type SpriteFaceBox = [number, number, number, number];

/** The fields of Cue's SpriteImageView the geometry reads. */
export type SpriteImageView = {
  /** Opaque bounding box of the cut-out, normalized 0..1: [x, y, width, height]. */
  bbox?: [number, number, number, number];
  /** Pixel size of the cut-out image. */
  width?: number;
  height?: number;
  /** Detected face, normalized 0..1 to the whole image: [x, y, width, height]. */
  face?: SpriteFaceBox | null;
};

/* ------------------------------------------------------------------------ */
/* src/config.ts                                                             */
/* ------------------------------------------------------------------------ */

export const SPRITE_TRANSITION_STYLES = ["expressive", "soft", "classic"] as const;
export type VisualNovelSpriteTransitions = (typeof SPRITE_TRANSITION_STYLES)[number];

/* ------------------------------------------------------------------------ */
/* src/frontend/stage/sprite-layer.ts                                        */
/* ------------------------------------------------------------------------ */

export const SPRITE_DEFAULT_SIZE = { width: 832, height: 1216 } as const;

export type SpriteGeometry = {
  /** Image aspect (width / height). */
  aspect: number;
  /** Image height per figure height: 1 / bbox height. */
  scale: number;
  /** Image height per figure width: 1 / (bbox width * aspect). */
  fit: number;
  /** Bbox centre x and bottom y, normalized. */
  cx: number;
  by: number;
  /** Bbox width and height, normalized. */
  bw: number;
  bh: number;
};

const finite = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/** Geometry to bottom-anchor and size one cut-out. */
export function spriteGeometry(image: Pick<SpriteImageView, "bbox" | "width" | "height">): SpriteGeometry {
  const width = finite(image.width, 0) > 0 ? image.width! : SPRITE_DEFAULT_SIZE.width;
  const height = finite(image.height, 0) > 0 ? image.height! : SPRITE_DEFAULT_SIZE.height;
  const aspect = width / height;
  let [x, y, w, h] = Array.isArray(image.bbox) && image.bbox.length === 4
    ? image.bbox.map((v, i) => finite(v, i < 2 ? 0 : 1))
    : [0, 0, 1, 1];
  x = clamp01(x ?? 0);
  y = clamp01(y ?? 0);
  w = Math.max(0.05, Math.min(1 - x, w ?? 1));
  h = Math.max(0.05, Math.min(1 - y, h ?? 1));
  return { aspect, scale: 1 / h, fit: 1 / (w * aspect), cx: x + w / 2, by: y + h, bw: w, bh: h };
}

/**
 * Where the face is, relative to the figure's anchor (bbox bottom-centre):
 * `dx` = face centre x in image widths (not mirrored), `top` / `bottom` =
 * face top and bottom above the anchor in image heights, `w` = face width in
 * image widths.
 */
export type SpriteFaceSpot = {
  dx: number;
  top: number;
  bottom: number;
  w: number;
  /** "detected": the face detector's box; "estimate": the framing rule (no box known). */
  source: "detected" | "estimate";
};

/** Cheek line (blush centre) as a share of the face box height, from its top. */
export const SPRITE_CHEEK_LINE = 0.62;

/**
 * Face estimate when no box is known, from the framing (fitted on 275 face
 * boxes of 26 sets): a figure that ends above the image bottom is full body
 * (cheeks at 84.5% of its height, face 14.8% of it wide); a figure cut by
 * the bottom edge has a larger head, more so the narrower it is (cheeks at
 * 70-78%, face 22% wide). Figure aspect = bbox width / height in pixels.
 */
export function estimateSpriteFace(geometry: SpriteGeometry): { cheek: number; faceW: number; faceH: number } {
  const fullBody = geometry.by < 0.99;
  if (fullBody) return { cheek: 0.845, faceW: 0.148, faceH: 0.126 };
  const figureAspect = (geometry.bw * geometry.aspect) / geometry.bh;
  return { cheek: Math.min(0.78, Math.max(0.7, 0.775 - (figureAspect - 0.36) * 0.2)), faceW: 0.22, faceH: 0.2 };
}

/** The face spot of an image: its detected face box, else the framing estimate. */
export function spriteFaceSpot(image: Pick<SpriteImageView, "bbox" | "width" | "height" | "face">, geometry = spriteGeometry(image)): SpriteFaceSpot {
  const face = image.face;
  if (Array.isArray(face) && face.length === 4 && face.every((value) => Number.isFinite(value)) && face[2] > 0 && face[3] > 0) {
    const [x, y, w, h] = face;
    return { dx: x + w / 2 - geometry.cx, top: geometry.by - y, bottom: geometry.by - (y + h), w, source: "detected" };
  }
  const estimate = estimateSpriteFace(geometry);
  // Figure units -> image heights (bh) and image widths (bh / aspect).
  const cheek = estimate.cheek * geometry.bh;
  const faceH = estimate.faceH * geometry.bh;
  return {
    dx: 0,
    top: cheek + SPRITE_CHEEK_LINE * faceH,
    bottom: cheek - (1 - SPRITE_CHEEK_LINE) * faceH,
    w: (estimate.faceW * geometry.bh) / geometry.aspect,
    source: "estimate",
  };
}
