/**
 * The battle stage dressed in the scene theme the player chose (src/shared/scene-view.ts ThemeId), so a fight
 * looks like the rest of that theme: its palette and type (kept consistent with the expedition board's skins,
 * ../scene/board-skins.ts), the material of its frames and bars, and for the two pixel themes a shader that
 * puts the art (backdrop, figures, effects, cut-ins) on their pixel grid and palette (post-filter.ts).
 * No theme (a battle outside a chat, the preview) keeps the stage's own painted dark fantasy, which a look's
 * palette tokens may retint (theme.ts applyUiTokens).
 */
import type { ThemeId } from "../../shared/scene-view.js";
import { THEME_FONTS_CSS } from "../scene/fonts.js";
import { PIXEL_FONT_CSS } from "../scene/pixel-font.js";
import { C, DEFAULTS, mixColor, setFonts, type Colors } from "./theme.js";

/** How frames and panels are built. */
export interface FrameSkin {
  /** Corner treatment: cut corners, rounded, or square. `size` scales the default corner. */
  corner: "chamfer" | "round" | "square";
  size: number;
  /** Outer rule width (px before the UI scale). */
  line: number;
  /** An inner rule: a faint gilt hairline, a full double rule (a DOS box), or none. */
  inner: "gilt" | "double" | "none";
  /** Panels fill with a vertical gradient (false: flat colour). */
  gradient: boolean;
  /** Panel opacity. */
  alpha: number;
  /** The gilt inner rule's inset (px), opacity, and whether every panel gets it (not just the main ones). */
  innerInset: number;
  innerAlpha: number;
  innerAll?: boolean;
  /** A hard drop shadow this many px down (die-cut card stock). */
  shadow?: number;
  /** A diagonal glass reflection. */
  sheen?: boolean;
}

export interface BarSkin {
  /** Bars split into cells (block characters, pixel segments); 0 = continuous. */
  cells: number;
  /** A sheen on the top third of a filled bar. */
  sheen: boolean;
  /** A dark rule around the trough, for bars on a busy fill. */
  trough?: number;
}

/** The art's pixel treatment: two-tone dither (1-bit) or a small palette (the 16-colour terminal). */
export interface PostSkin {
  kind: "mono" | "palette";
  /** About this many virtual pixel rows on the screen. */
  rows: number;
  palette: number[];
  /** Darken every other virtual row. */
  scanlines: boolean;
}

export interface StageSkin {
  colors: Partial<Colors>;
  fonts: { display: string; ui: string; number: string };
  frame: FrameSkin;
  bar: BarSkin;
  /** Labels in capitals (bitmap fonts read better that way). */
  upper: boolean;
  /** A colour cast over the backdrop (multiplied), so the place reads in the theme's light. */
  grade?: number;
  post?: PostSkin;
}

import { BATTLE_THEMES } from "./themes/index.js";
import type { BattleTheme } from "./themes/types.js";
import { COMMAND_ART } from "./themes/shared.js";

/** Each theme's skin (its own file under ./themes). */
export const STAGE_SKINS = Object.fromEntries(Object.entries(BATTLE_THEMES).map(([id, t]) => [id, t.skin])) as Record<ThemeId, StageSkin>;

const BASE_FRAME: FrameSkin = { corner: "chamfer", size: 1, line: 1, inner: "gilt", gradient: true, alpha: 0.92, innerInset: 3, innerAlpha: 0.18 };
const BASE_BAR: BarSkin = { cells: 0, sheen: true };

/** The skin in force (read by ui.ts while drawing). */
export const SKIN: { theme: ThemeId | null; frame: FrameSkin; bar: BarSkin; upper: boolean; grade: number; post: PostSkin | null } = {
  theme: null, frame: BASE_FRAME, bar: BASE_BAR, upper: false, grade: 0xffffff, post: null,
};

/** The terminal theme's picture palette as the player set it in the scene (EGA, CGA or mono). */
function commandPalette(): number[] {
  try {
    const p = localStorage.getItem("gambit.command.palette");
    if (p && COMMAND_ART[p]) return COMMAND_ART[p]!;
  } catch {
    // Storage blocked: the default.
  }
  return COMMAND_ART.ega!;
}

/**
 * Dress the stage for a scene theme. Call before the stage is built; it resets the colours, the type and the
 * cached text styles. Null puts the stage's own look back (then apply the look's tokens, theme.ts applyUiTokens).
 */
export function applyStageSkin(theme: ThemeId | null | undefined): StageSkin | null {
  Object.assign(C, DEFAULTS);
  const skin = theme ? STAGE_SKINS[theme] : undefined;
  if (!skin) {
    SKIN.theme = null;
    SKIN.frame = BASE_FRAME;
    SKIN.bar = BASE_BAR;
    SKIN.upper = false;
    SKIN.grade = 0xffffff;
    SKIN.post = null;
    setFonts();
    return null;
  }
  Object.assign(C, skin.colors);
  if (skin.colors.line === undefined) C.line = mixColor(C.gold, C.panel, 0.55);
  if (skin.colors.btnText === undefined) C.btnText = C.text;
  if (skin.colors.btnTextDim === undefined) C.btnTextDim = C.goldDim;
  if (skin.colors.onArt === undefined) C.onArt = C.text;
  if (skin.colors.onArtDim === undefined) C.onArtDim = C.textDim;
  SKIN.theme = theme!;
  SKIN.frame = skin.frame;
  SKIN.bar = skin.bar;
  SKIN.upper = skin.upper;
  SKIN.grade = skin.grade ?? 0xffffff;
  SKIN.post = skin.post ? { ...skin.post, palette: theme === "command" ? commandPalette() : skin.post.palette } : null;
  setFonts(skin.fonts);
  return skin;
}

/** The battle theme in force (its layout, HUD pieces and decoration), or null for the stage's own look. */
export function currentBattleTheme(): BattleTheme | null {
  return SKIN.theme ? BATTLE_THEMES[SKIN.theme] : null;
}

/** Labels as the skin wants them (capitals for the bitmap fonts). */
export const caps = (s: string): string => (SKIN.upper ? s.toUpperCase() : s);

/** The theme fonts on the page (@font-face is ignored inside a shadow root), loaded before text is set. */
export async function loadSkinFonts(theme: ThemeId | null | undefined): Promise<void> {
  const skin = theme ? STAGE_SKINS[theme] : undefined;
  if (!skin) return;
  if (!document.getElementById("gambit-pixel-font") && !document.getElementById("gambit-stage-fonts")) {
    const st = document.createElement("style");
    st.id = "gambit-stage-fonts";
    st.textContent = PIXEL_FONT_CSS + "\n" + THEME_FONTS_CSS;
    document.head.append(st);
  }
  const first = (stack: string) => stack.split(",")[0]!.trim();
  try {
    await Promise.race([
      Promise.all([...new Set([skin.fonts.display, skin.fonts.ui, skin.fonts.number].map(first))].flatMap((f) => [document.fonts.load(`16px ${f}`), document.fonts.load(`bold 16px ${f}`)])),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch {
    // The fallbacks in the stack.
  }
}
