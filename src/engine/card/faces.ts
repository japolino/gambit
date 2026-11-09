/**
 * Faces from art the user already has (docs/DESIGN.md 4.0, card art anchor):
 * a card's expression sprites, its per-character expression groups, imported
 * Risu assets ("Mira.young.surprised"), or a library card of the same name.
 * Pure: the backend fetches the maps, this decides which image is which mood.
 *
 * Only emotion labels are read. Actions and explicit variants ("kiss",
 * "nude") are never chosen, so a Parley face is always a plain reaction.
 */
import type { Expression } from "../../shared/art-keys.js";
import { bestNameMatch, normName } from "./names.js";

export type FaceSource = "expressions" | "groups" | "risu" | "library" | "avatar" | "gallery" | "inlay";

export interface FaceSet {
  /** The neutral face: the reference for anything drawn new. */
  base?: string;
  /** Mood -> Lumiverse image id. */
  expressions: Partial<Record<Expression, string>>;
  source: FaceSource;
  /** The library card the art came from, when not the chat's card. */
  characterId?: string;
}

const NEUTRAL = new Set(["neutral", "default", "idle", "normal", "calm", "base", "standard", "plain", "indifferent", "blank", "rest", "stand", "standing"]);

/** Emotion words, most specific first. Anything else (actions, outfits, poses) is not a face. */
const MOODS: Record<string, Expression> = {
  happy_tears: "happy", happy: "happy", joy: "happy", joyful: "happy", smiling: "happy", smile: "happy", laughing: "happy", laugh: "happy", amused: "happy", amusement: "happy", cheerful: "happy", excited: "happy", excitement: "happy", relieved: "happy", relief: "happy", delighted: "happy", grin: "happy", grinning: "happy",
  sad: "sad", sadness: "sad", crying: "sad", cry: "sad", tears: "sad", grief: "sad", disappointed: "sad", disappointment: "sad", gloomy: "sad", depressed: "sad", guilty: "sad", remorse: "sad", sorrow: "sad", lonely: "sad", melancholy: "sad",
  angry: "angry", anger: "angry", annoyed: "angry", annoyance: "angry", mad: "angry", furious: "angry", rage: "angry", irritated: "angry", disgust: "angry", disgusted: "angry", pouting: "angry", pout: "angry", glare: "angry", glaring: "angry", frustrated: "angry",
  surprised: "surprised", surprise: "surprised", shocked: "surprised", shock: "surprised", stupefied: "surprised", startled: "surprised", realization: "surprised", astonished: "surprised", confused: "surprised", confusion: "surprised", curious: "surprised", curiosity: "surprised",
  determined: "determined", determination: "determined", serious: "determined", proud: "determined", pride: "determined", confident: "determined", smug: "determined", smirk: "determined", smirking: "determined", focused: "determined", resolute: "determined", suspicious: "determined", thinking: "determined",
  hurt: "hurt", pain: "hurt", scared: "hurt", fear: "hurt", afraid: "hurt", frightened: "hurt", nervous: "hurt", tormented: "hurt", worried: "hurt", anxious: "hurt", anxiety: "hurt", terrified: "hurt", embarrassed: "hurt", embarrassment: "hurt", pleading: "hurt",
};

/** Words that rule a whole key out, whatever mood it names. */
const UNSAFE = /\b(nude|naked|nsfw|lewd|sex|sexy|erotic|xxx|topless|bottomless|underwear|lingerie|bath|bathing|cum|ahegao|aroused|lust|lustful|horny|yuri|yaoi|hentai|bdsm|position|cowgirl|doggy|missionary|spooning|paizuri|handjob|footjob|job|blowjob|fellatio|deepthroat|fingering|masturbation|ejaculated|ejaculation|penis|vagina|condom|pee)\b/;

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif|bmp)$/i;

const words = (label: string): string[] => normName(label.replace(/([a-z])([A-Z])/g, "$1 $2")).split(" ").filter(Boolean);

/** Which mood a sprite label names ("narcissa_happy", "Joy", "happy_tears"), "neutral", or null. */
export function moodOfLabel(label: string): Expression | "neutral" | null {
  const w = words(label);
  if (!w.length || UNSAFE.test(w.join(" "))) return null;
  // Two-word labels first ("happy_tears"), then the last word, then any word.
  const last2 = w.slice(-2).join("_");
  if (MOODS[last2]) return MOODS[last2]!;
  const last = w[w.length - 1]!;
  if (NEUTRAL.has(last)) return "neutral";
  if (MOODS[last]) return MOODS[last]!;
  for (const x of w) if (MOODS[x]) return MOODS[x]!;
  for (const x of w) if (NEUTRAL.has(x)) return "neutral";
  return null;
}

/** A flat label -> image map (Lumiverse expressions, one expression group) as faces. */
export function facesFromLabels(map: Readonly<Record<string, unknown>>, source: FaceSource): FaceSet | null {
  const out: FaceSet = { expressions: {}, source };
  for (const [label, id] of Object.entries(map)) {
    if (typeof id !== "string" || !id) continue;
    const mood = moodOfLabel(label);
    if (mood === "neutral") out.base ??= id;
    else if (mood && !out.expressions[mood]) out.expressions[mood] = id;
  }
  return out.base || Object.keys(out.expressions).length ? out : null;
}

/**
 * Faces for one person from a Risu asset map. Two layouts are understood:
 *   - "Name.variant.emotion" / "Name.variant" / "Name" (multi-character cards):
 *     the person is matched by the first segment; the safe variant with the
 *     most emotions wins; "Name.variant" or "Name" is the base.
 *   - flat labels ("expr_narcissa_happy"), read as one person's sprites only
 *     when `single` (the card has one character) or the label names them.
 */
export function facesFromRisu(map: Readonly<Record<string, unknown>>, name: string, single: boolean): FaceSet | null {
  // Importers may list an asset by its file name too ("Lilim_angry.webp"): that dot is no "person.variant".
  const byKey = new Map<string, string>();
  for (const [k, v] of Object.entries(map)) {
    const key = k.replace(IMAGE_EXT, "");
    if (typeof v === "string" && v && !byKey.has(key)) byKey.set(key, v);
  }
  const entries = [...byKey];
  const dotted = entries.filter(([k]) => k.includes("."));
  if (dotted.length >= entries.length / 2) {
    const people = [...new Set(entries.map(([k]) => k.split(".")[0]!))];
    const who = bestNameMatch(name, people, (p) => p);
    if (!who) return null;
    const mine = entries.filter(([k]) => k === who || k.startsWith(`${who}.`));
    const variants = new Map<string, { base?: string; faces: [string, string][] }>();
    let bare: string | undefined;
    for (const [k, id] of mine) {
      const parts = k.split(".");
      if (parts.length === 1) {
        bare = id;
        continue;
      }
      const v = parts[1]!;
      if (UNSAFE.test(words(v).join(" "))) continue;
      const slot = variants.get(v) ?? { faces: [] };
      if (parts.length === 2) slot.base = id;
      else slot.faces.push([parts.slice(2).join("_"), id]);
      variants.set(v, slot);
    }
    let best: FaceSet | null = null;
    for (const slot of variants.values()) {
      const f = facesFromLabels(Object.fromEntries(slot.faces), "risu") ?? { expressions: {}, source: "risu" as const };
      f.base = slot.base ?? f.base ?? bare;
      if (!best || Object.keys(f.expressions).length > Object.keys(best.expressions).length) best = f;
    }
    if (!best && bare) best = { base: bare, expressions: {}, source: "risu" };
    return best && (best.base || Object.keys(best.expressions).length) ? best : null;
  }
  const nameW = new Set(words(name));
  const flat = entries.filter(([k]) => single || words(k).some((w) => nameW.has(w)));
  return facesFromLabels(Object.fromEntries(flat), "risu");
}

/** The group in `expression_groups` that is this person, if any. */
export function groupFor(groups: Readonly<Record<string, unknown>>, name: string): Record<string, unknown> | null {
  const key = bestNameMatch(name, Object.keys(groups), (k) => k);
  const g = key ? groups[key] : null;
  return g && typeof g === "object" ? (g as Record<string, unknown>) : null;
}

/** Every image id a face set uses, base first (for references and prefetch). */
export const faceIds = (f: FaceSet): string[] => [...new Set([f.base, ...Object.values(f.expressions)].filter((x): x is string => !!x))];
