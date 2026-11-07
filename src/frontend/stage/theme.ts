/**
 * The stage's look in one place: colours, type and the few text styles the
 * battle UI uses. Painted dark fantasy: warm near-blacks, parchment text,
 * one muted gold for frames, colour only where it carries meaning (HP,
 * Focus, elements, statuses). Fonts are system stacks (extensions cannot
 * serve font files, docs/DESIGN.md 8.1).
 */
import { TextStyle, type TextStyleOptions } from "pixi.js";
import type { Element, StatusId } from "../../engine/types.js";

export const FONT_DISPLAY = '"Cormorant Garamond", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';
export const FONT_UI = '"Segoe UI", "Helvetica Neue", system-ui, -apple-system, Roboto, sans-serif';
export const FONT_NUMBER = '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';

export const C = {
  ink: 0x0b0a09,
  ink2: 0x151210,
  panel: 0x17130f,
  panelHi: 0x231d17,
  line: 0x5a4a36,
  gold: 0xc9a865,
  goldDim: 0x7d6a45,
  text: 0xece3cf,
  textDim: 0x9d927f,
  textFaint: 0x6b6254,
  hp: 0xb8382e,
  hpHi: 0xe0604c,
  hpGhost: 0xf1d9b0,
  focus: 0x4a8db0,
  focusHi: 0x7cc0dc,
  shield: 0x9fb8c8,
  poise: 0xd9c08a,
  poiseEmpty: 0x3a3227,
  heal: 0x8fd18a,
  crit: 0xffd27a,
  weak: 0xffb05e,
  resist: 0x9aa3ab,
  miss: 0xb7b0a3,
  enemy: 0xc4544a,
  ally: 0x6fa7c2,
  break: 0xffe2a0,
} as const;

export const ELEMENT_COLOR: Readonly<Record<Element, number>> = {
  physical: 0xe9dfcc,
  fire: 0xff9a4a,
  frost: 0x9fd8ff,
  storm: 0xc9b8ff,
  water: 0x6fd3c7,
  earth: 0xc7a46a,
  light: 0xfff0b0,
  shadow: 0xb08cd8,
  blood: 0xe0545a,
};

export const STATUS_STYLE: Readonly<Record<StatusId, { color: number; glyph: string; label: string; harmful: boolean }>> = {
  bleed: { color: 0xc8393f, glyph: "drop", label: "Bleed", harmful: true },
  burn: { color: 0xff8a3d, glyph: "flame", label: "Burn", harmful: true },
  poison: { color: 0x8fbf4a, glyph: "drop", label: "Poison", harmful: true },
  frost: { color: 0x9fd8ff, glyph: "star", label: "Frost", harmful: true },
  stun: { color: 0xf2d26b, glyph: "spiral", label: "Stun", harmful: true },
  fear: { color: 0x9b7fc4, glyph: "eye", label: "Fear", harmful: true },
  mark: { color: 0xe86a5a, glyph: "target", label: "Mark", harmful: true },
  vulnerable: { color: 0xe6a15a, glyph: "crack", label: "Vulnerable", harmful: true },
  weaken: { color: 0xa08b74, glyph: "down", label: "Weaken", harmful: true },
  guarded: { color: 0x9fb8c8, glyph: "shield", label: "Guarded", harmful: false },
  regen: { color: 0x8fd18a, glyph: "plus", label: "Regen", harmful: false },
  haste: { color: 0x7cc0dc, glyph: "up", label: "Haste", harmful: false },
  slow: { color: 0x7d8796, glyph: "down", label: "Slow", harmful: true },
  taunt: { color: 0xd46a4a, glyph: "target", label: "Taunt", harmful: false },
  silence: { color: 0x8a8fa8, glyph: "bar", label: "Silence", harmful: true },
};

export function hex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/** Parse "#1d3b4a,#7fd1c7,#f2efe6" into numbers; falls back to a muted default. */
export function parsePalette(palette: string | undefined, fallback: number[] = [0x2a2420, 0x8a7458, 0xe8dcc4]): number[] {
  if (!palette) return fallback;
  const out = palette.split(",").map((p) => p.trim().replace(/^#/, "")).filter((p) => /^[0-9a-f]{6}$/i.test(p)).map((p) => parseInt(p, 16));
  return out.length ? out : fallback;
}

export function mixColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

const cache = new Map<string, TextStyle>();

/** Shared text styles (cached by key so Pixi reuses glyph work). */
export function textStyle(key: string, opts: TextStyleOptions): TextStyle {
  let style = cache.get(key);
  if (!style) {
    style = new TextStyle(opts);
    cache.set(key, style);
  }
  return style;
}

export const T = {
  name: (size: number) => textStyle(`name${size}`, { fontFamily: FONT_DISPLAY, fontSize: size, fill: C.text, fontWeight: "600", letterSpacing: 0.5 }),
  label: (size: number, color: number = C.textDim) => textStyle(`label${size}-${color}`, { fontFamily: FONT_UI, fontSize: size, fill: color, letterSpacing: 1.2, fontWeight: "600" }),
  body: (size: number, color: number = C.text) => textStyle(`body${size}-${color}`, { fontFamily: FONT_UI, fontSize: size, fill: color }),
  num: (size: number, color: number = C.text) => textStyle(`num${size}-${color}`, { fontFamily: FONT_NUMBER, fontSize: size, fill: color, fontWeight: "700" }),
};
