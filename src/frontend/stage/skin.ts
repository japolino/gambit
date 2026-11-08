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

const FELL = '"Gambit Fell", "Gambit Garamond", Georgia, serif';
const GARAMOND = '"Gambit Garamond", "Palatino Linotype", Georgia, serif';
const CINZEL = '"Gambit Cinzel", "Gambit Garamond", Georgia, serif';
const BIT = '"Gambit 8bit", "Gambit Pixel", monospace';

/** The EGA palette, and the low-intensity half the terminal theme keeps its pictures to (command/pixels.ts). */
const EGA = [0x000000, 0x0000aa, 0x00aa00, 0x00aaaa, 0xaa0000, 0xaa00aa, 0xaa5500, 0xaaaaaa, 0x555555, 0x5555ff, 0x55ff55, 0x55ffff, 0xff5555, 0xff55ff, 0xffff55, 0xffffff];
const COMMAND_ART: Record<string, number[]> = {
  ega: [0, 2, 3, 4, 5, 6, 7, 8, 15].map((i) => EGA[i]!),
  cga: [0x000000, 0x55ffff, 0xff55ff, 0xffffff],
  mono: [0x000000, 0x555555, 0xaaaaaa, 0xffffff],
};

const INK1 = 0x080707;
const PAPER1 = 0xf0eee6;

export const STAGE_SKINS: Record<ThemeId, StageSkin> = {
  // A leather-bound book: mahogany covers with deep cut corners and a gilt inner rule; the choices are vellum pages.
  storybook: {
    colors: {
      ink: 0x120804, ink2: 0x1a0d06, panel: 0x24110e, panelHi: 0x3a1a12, line: 0xd4af37, gold: 0xe8c372, goldDim: 0x9a7440,
      text: 0xf3e3bd, textDim: 0xd2b88a, textFaint: 0xa08460, poiseEmpty: 0x5a3a1c,
      card: 0x3a1f0c, cardBottom: 0x1e0f05, menu: 0x2a1608, menuBottom: 0x140904,
      btnHot: 0xf6ead0, btnOn: 0xe8dcc4, btnOff: 0xb8ab94, btnBottom: 0xcdbb98, btnLineOff: 0x5a3a1c, btnText: 0x2c1a11, btnTextDim: 0x6e5239,
      strip: 0x2a1608, stripBottom: 0x170b04, outline: 0x1a0a04, backing: 0x1e0f05, enemy: 0xc0392b, ally: 0x6fb2e6, crit: 0xb8862a,
    },
    fonts: { display: FELL, ui: FELL, number: CINZEL },
    frame: { corner: "chamfer", size: 2, line: 1.5, inner: "gilt", gradient: true, alpha: 0.96, innerInset: 4, innerAlpha: 0.8, innerAll: true },
    bar: { cells: 0, sheen: true, trough: 0x0a0402 },
    upper: false,
    grade: 0xf2cc96,
  },
  // Paper craft under a desk lamp: the one light theme. Kraft card stock with dark ink, rounded die-cut panels on hard shadows.
  diorama: {
    colors: {
      ink: 0x140c05, ink2: 0x1c1007, panel: 0xc8a97e, panelHi: 0xe0c69c, line: 0xf4e3c1, gold: 0x8a4a12, goldDim: 0x7a5a36,
      text: 0x2b2118, textDim: 0x4a3a28, textFaint: 0x6e5a40, poiseEmpty: 0xb89a70,
      card: 0xd8bc8e, cardBottom: 0xbf9f72, menu: 0xc8a97e, menuBottom: 0xb3946a, btnHot: 0xf4e3c1, btnOn: 0xe6d2b5, btnOff: 0xb8a07c, btnBottom: 0xd4bc98, btnLineOff: 0x8a7050,
      btnText: 0x2b2118, btnTextDim: 0x6a4a28, onArt: 0xfbe7a8, onArtDim: 0xe0c48a,
      strip: 0xc8a97e, stripBottom: 0xb3946a, outline: 0x1a0d05, backing: 0x22130a, enemy: 0xb3261e, ally: 0x2a6fb0, hpGhost: 0xf0d080, crit: 0xc0501a,
    },
    fonts: { display: FELL, ui: FELL, number: FELL },
    frame: { corner: "round", size: 1.8, line: 2, inner: "none", gradient: true, alpha: 1, innerInset: 3, innerAlpha: 0, shadow: 5 },
    bar: { cells: 0, sheen: false, trough: 0x2b2118 },
    upper: false,
    grade: 0xffcc80,
  },
  // A grand hotel lobby at night: cool obsidian glass, square, brass hairlines, cream capitals.
  lobby: {
    colors: {
      ink: 0x07090c, ink2: 0x0c1016, panel: 0x0a0d12, panelHi: 0x151b24, line: 0xc5a059, gold: 0xf3e5ab, goldDim: 0xc2b59b,
      text: 0xf4efe6, textDim: 0xcfc6b2, textFaint: 0xb0a68c, poiseEmpty: 0x2a3038,
      card: 0x10151c, cardBottom: 0x07090c, menu: 0x0a0d12, menuBottom: 0x07090c, btnHot: 0x1e2632, btnOn: 0x121821, btnOff: 0x0b0e13, btnBottom: 0x090c10, btnLineOff: 0x4a4434,
      strip: 0x0a0d12, stripBottom: 0x07090c, outline: 0x05070a, backing: 0x0a0d12, enemy: 0xc0453a, ally: 0x8ab8e0,
    },
    fonts: { display: GARAMOND, ui: GARAMOND, number: CINZEL },
    frame: { corner: "square", size: 0, line: 1, inner: "none", gradient: true, alpha: 0.86, innerInset: 3, innerAlpha: 0, sheen: true },
    bar: { cells: 0, sheen: false },
    upper: true,
    grade: 0x98a4b8,
  },
  // A candle-lit card table: baize panels, the party as red card backs with a gold inner border, troughs under the bars.
  table: {
    colors: {
      ink: 0x04130b, ink2: 0x081c12, panel: 0x133824, panelHi: 0x1c4a30, line: 0xf2cf7a, gold: 0xffcf6a, goldDim: 0xb0904a,
      text: 0xfff2e0, textDim: 0xe0d0b0, textFaint: 0xa8b098, poiseEmpty: 0x3a1a1a,
      card: 0x9c1419, cardBottom: 0x5a0a0d, menu: 0x133824, menuBottom: 0x081e12, btnHot: 0x2a6a40, btnOn: 0x1c4a30, btnOff: 0x0e2616, btnBottom: 0x0e2a18, btnLineOff: 0x3a5a3c,
      strip: 0x133824, stripBottom: 0x081e12, outline: 0x061008, backing: 0x081c12, enemy: 0xff5a4a, ally: 0x4aa8ff,
    },
    fonts: { display: FELL, ui: FELL, number: CINZEL },
    frame: { corner: "round", size: 1.2, line: 2, inner: "gilt", gradient: true, alpha: 0.96, innerInset: 6, innerAlpha: 0.85, innerAll: true },
    bar: { cells: 0, sheen: true, trough: 0x0f0505 },
    upper: false,
    grade: 0x9cc8a4,
  },
  // Black and white only, on one pixel grid: square frames with a double rule, bitmap type, cell bars.
  onebit: {
    colors: {
      ink: INK1, ink2: INK1, panel: INK1, panelHi: INK1, line: PAPER1, gold: PAPER1, goldDim: 0xb8b6ae,
      text: PAPER1, textDim: 0xd8d6ce, textFaint: 0x9a9890, hp: PAPER1, hpHi: PAPER1, hpGhost: 0x8a8880, focus: PAPER1, focusHi: PAPER1,
      shield: PAPER1, poise: PAPER1, poiseEmpty: INK1, heal: PAPER1, crit: PAPER1, weak: PAPER1, resist: 0xb8b6ae, miss: 0x8a8880,
      enemy: PAPER1, ally: PAPER1, break: PAPER1,
      card: INK1, cardBottom: INK1, menu: INK1, menuBottom: INK1, btnHot: 0x2a2a28, btnOn: INK1, btnOff: INK1, btnBottom: INK1, btnLineOff: 0x5a5a56,
      strip: INK1, stripBottom: INK1, outline: INK1, backing: INK1,
    },
    fonts: { display: BIT, ui: BIT, number: BIT },
    frame: { corner: "square", size: 0, line: 2, inner: "double", gradient: false, alpha: 1, innerInset: 3, innerAlpha: 0 },
    bar: { cells: 14, sheen: false },
    upper: true,
    post: { kind: "mono", rows: 330, palette: [INK1, PAPER1], scanlines: false },
  },
  // A sixteen-colour terminal: a blue chassis, black windows in double white rules, EGA type colours.
  command: {
    colors: {
      ink: 0x000000, ink2: 0x000000, panel: 0x000000, panelHi: 0x000000, line: 0xffffff, gold: 0xffff55, goldDim: 0xaaaaaa,
      text: 0xffffff, textDim: 0x55ffff, textFaint: 0xaaaaaa, hp: 0xaa0000, hpHi: 0xff5555, hpGhost: 0xffff55, focus: 0x0000aa, focusHi: 0x55ffff,
      shield: 0x55ffff, poise: 0xffff55, poiseEmpty: 0x555555, heal: 0x55ff55, crit: 0xffff55, weak: 0xff55ff, resist: 0xaaaaaa, miss: 0xaaaaaa,
      enemy: 0xff5555, ally: 0x55ffff, break: 0xffff55,
      card: 0x000000, cardBottom: 0x000000, menu: 0x0000aa, menuBottom: 0x0000aa, btnHot: 0x00aaaa, btnOn: 0x000000, btnOff: 0x000000, btnBottom: 0x000000, btnLineOff: 0x555555,
      strip: 0x0000aa, stripBottom: 0x0000aa, outline: 0x000000, backing: 0x000000,
    },
    fonts: { display: BIT, ui: BIT, number: BIT },
    frame: { corner: "square", size: 0, line: 1, inner: "double", gradient: false, alpha: 1, innerInset: 3, innerAlpha: 0 },
    bar: { cells: 16, sheen: false },
    upper: true,
    post: { kind: "palette", rows: 360, palette: COMMAND_ART.ega!, scanlines: true },
  },
};

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
