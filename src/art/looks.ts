/**
 * The four looks a campaign can lock (docs/DESIGN.md, 5.1-5.2), their prompt
 * fragments per provider, and the style lock stored per campaign.
 *
 * Prompt dialects:
 * - "nai": NovelAI V5 Danbooru-style tags, comma separated (the host's V4+
 *   structured prompt takes the same string as the base caption).
 * - "gpt": natural language for GPT Image. Lumiverse's OpenAI provider reads
 *   no negative prompt (D:\Lumiverse\src\image-gen\providers\openai.ts:225-253
 *   builds the body from `prompt` only), so a look's "avoid" text is written
 *   into the prompt itself.
 *
 * Typography is always code (5.3): every look forbids text in the image.
 */
import type { ArtKind } from "../shared/protocol.js";

export type ProviderKind = "nai" | "gpt";

export type LookId = "painted_dark_fantasy" | "ink_wash" | "modern_anime" | "grim_realism";

export interface LookPreset {
  id: LookId;
  label: string;
  /** The provider this look is strongest on (DESIGN 5.1: anime -> NAI V5, realism -> GPT Image). */
  preferred: ProviderKind;
  /** Per-kind provider preference, where it differs from `preferred`. */
  prefer?: Partial<Record<ArtKind, ProviderKind>>;
  nai: { positive: string; negative: string };
  gpt: { style: string; avoid: string };
}

/** Added to every NAI negative: no text in images. */
export const NAI_NO_TEXT = "text, english text, watermark, signature, logo, username, artist name, speech bubble, letters";
/** Added to every GPT prompt: no text in images. */
export const GPT_NO_TEXT = "No text, lettering, numbers, logos, signatures, watermarks, borders, frames or UI elements anywhere in the image.";
/** Base quality negative for NAI (V5 Full; V5 Medium sends no negative, see providers.ts). */
export const NAI_BASE_NEGATIVE = "lowres, worst quality, bad quality, jpeg artifacts, blurry, bad anatomy, bad hands, missing fingers, extra digits";

export const LOOKS: Readonly<Record<LookId, LookPreset>> = {
  painted_dark_fantasy: {
    id: "painted_dark_fantasy",
    label: "Painted Dark Fantasy",
    preferred: "gpt",
    // DESIGN 5.3: monsters on NAI V5 for native alpha; the locked tags keep them painted.
    prefer: { monster: "nai" },
    nai: {
      positive: "painterly, oil painting (medium), dark fantasy, realistic proportions, muted colors, rim lighting, dramatic lighting, visible brush strokes, high contrast, detailed",
      negative: "chibi, cel shading, flat color, simple shading, anime coloring, 3d, photo",
    },
    gpt: {
      style: "Painted dark-fantasy illustration in the manner of premium collectible card-game art: semi-realistic proportions, a muted palette with a single accent colour, strong rim light, visible oil-paint brushwork, dramatic chiaroscuro.",
      avoid: "Avoid chibi or cartoon proportions, flat cel shading, photographic realism and a 3D-render look.",
    },
  },
  ink_wash: {
    id: "ink_wash",
    label: "Ink & Wash",
    preferred: "nai",
    nai: {
      positive: "ink wash painting, sumi-e, traditional media, brush strokes, ink splatter, limited palette, spot color, paper texture, high contrast",
      negative: "3d, photorealistic, cel shading, glossy, vibrant colors, gradient",
    },
    gpt: {
      style: "Ink-and-wash illustration (sumi-e): confident wet brush strokes, ink bleeding into textured rice paper, mostly greys and blacks with one restrained accent colour, generous negative space.",
      avoid: "Avoid glossy digital rendering, photographic realism and saturated colour.",
    },
  },
  modern_anime: {
    id: "modern_anime",
    label: "Modern Anime Illustration",
    preferred: "nai",
    nai: {
      positive: "anime coloring, clean lineart, cel shading, vibrant colors, detailed eyes, dramatic lighting, detailed",
      negative: "realistic, photo, 3d, sketch, monochrome",
    },
    gpt: {
      style: "Modern high-end anime illustration: clean confident lineart, crisp cel shading with soft gradients, vivid but controlled colours, expressive eyes, cinematic lighting, key-visual polish.",
      avoid: "Avoid photographic realism, western comic inking and 3D-render shading.",
    },
  },
  grim_realism: {
    id: "grim_realism",
    label: "Grim Realism",
    preferred: "gpt",
    nai: {
      positive: "realistic, photorealistic, dark fantasy, gritty, desaturated, film grain, dramatic lighting, detailed skin texture",
      negative: "anime, cartoon, cel shading, lineart, chibi",
    },
    gpt: {
      style: "Grim, near-photographic dark-fantasy realism: desaturated earthy palette, torch or overcast light, weathered materials with grime and wear, shallow depth of field, like a still from a prestige fantasy film.",
      avoid: "Avoid anime or cartoon styling, clean digital gloss and bright saturated colour.",
    },
  },
};

export const LOOK_IDS = Object.keys(LOOKS) as LookId[];
export const DEFAULT_LOOK_ID: LookId = "painted_dark_fantasy";

export function lookById(id: unknown): LookPreset | null {
  return typeof id === "string" && Object.hasOwn(LOOKS, id) ? LOOKS[id as LookId] : null;
}

/** Provider order for one kind under a look (first = preferred), before availability. */
export function providerOrder(look: LookPreset, kind: ArtKind): ProviderKind[] {
  const first = look.prefer?.[kind] ?? look.preferred;
  return first === "nai" ? ["nai", "gpt"] : ["gpt", "nai"];
}

/* ------------------------------------------------------------------ */
/* Style probe: the same subject in every look (5.2)                   */
/* ------------------------------------------------------------------ */

export type ProbeSubject = "gate" | "bust";
export const PROBE_SUBJECTS: readonly ProbeSubject[] = ["gate", "bust"];

/** The hub town's gate at dusk, and one character bust. */
export const PROBE_BRIEFS: Readonly<Record<ProbeSubject, { nai: string; gpt: string }>> = {
  gate: {
    nai: "scenery, no humans, town gate, stone archway, wooden door, iron bands, lantern, banner, dusk, sunset, cobblestone road, medieval, fantasy, wide shot",
    gpt: "The gate of a hilltop market town at dusk: a weathered stone archway with iron-banded wooden doors, lit lanterns and hanging banners, a cobbled road leading in. No people.",
  },
  bust: {
    nai: "1boy, solo, upper body, portrait, looking at viewer, short hair, black hair, scar on face, leather coat, scarf, mercenary, fantasy, simple background",
    gpt: "Head-and-shoulders portrait of a travelling sellsword: short dark hair, a scar through one eyebrow, a worn leather coat and a wool scarf, looking at the viewer, plain dark background.",
  },
};

/** Art key of one probe image (statuses go out as `art.update` under these keys). */
export function probeKey(lookId: string, subject: ProbeSubject): string {
  return `style_probe:${lookId}:${subject}`;
}

/* ------------------------------------------------------------------ */
/* Style lock, per campaign                                             */
/* ------------------------------------------------------------------ */

export interface StyleAnchor {
  imageId: string;
  url: string;
}

export interface StyleLock {
  version: 1;
  lookId: LookId;
  lockedAt: number;
  /**
   * The probe images of the chosen look (5.2: "the 2 anchor images"). GPT
   * requests pass one as a style reference: the bust for figures, the gate
   * for places and things.
   */
  anchors: Partial<Record<ProbeSubject, StyleAnchor>>;
}

/** userStorage path of a campaign's style lock. */
export function stylePath(campaignId: string): string {
  return `campaigns/${safeSegment(campaignId)}/style.json`;
}

/** A storage path segment from an id (no separators, no dots-only names). */
export function safeSegment(id: string): string {
  const clean = String(id).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120);
  return clean && !/^_+$/.test(clean) ? clean : "default";
}

export function normalizeStyleLock(value: unknown): StyleLock | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  const look = lookById(r.lookId);
  if (!look) return null;
  const anchors: StyleLock["anchors"] = {};
  const raw = r.anchors && typeof r.anchors === "object" ? (r.anchors as Record<string, unknown>) : {};
  for (const subject of PROBE_SUBJECTS) {
    const a = raw[subject] as Record<string, unknown> | undefined;
    if (a && typeof a.imageId === "string" && a.imageId) anchors[subject] = { imageId: a.imageId, url: `/api/v1/images/${a.imageId}` };
  }
  return { version: 1, lookId: look.id, lockedAt: typeof r.lockedAt === "number" ? r.lockedAt : 0, anchors };
}
