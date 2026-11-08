/**
 * The 1-bit theme's battle: the fight runs in the scene's own crawler console (./onebit/). One low-resolution
 * frame buffer holds the windows, the bitmap type, the bars and the prompt; the stage's two-tone shader puts the
 * place, the enemies and the party's faces on the same pixel grid. BATTLE (the viewport) over the CHRONICLE,
 * PARTY over COMMAND (WHAT NOW?), the turn order in the function-key strip. See ./types.ts for the contract.
 */
import type { BattleTheme } from "./types.js";
import { BIT, INK1, PAPER1 } from "./shared.js";
import { stageLayout } from "./onebit/layout.js";
import { ObCard, ObMenu, ObOrder } from "./onebit/hud.js";
import { decorateConsole } from "./onebit/console.js";

export const theme: BattleTheme = {
  skin: {
    colors: {
      ink: INK1, ink2: INK1, panel: INK1, panelHi: INK1, line: PAPER1, gold: PAPER1, goldDim: PAPER1,
      text: PAPER1, textDim: PAPER1, textFaint: PAPER1, hp: PAPER1, hpHi: PAPER1, hpGhost: PAPER1, focus: PAPER1, focusHi: PAPER1,
      shield: PAPER1, poise: PAPER1, poiseEmpty: INK1, heal: PAPER1, crit: PAPER1, weak: PAPER1, resist: PAPER1, miss: PAPER1,
      enemy: PAPER1, ally: PAPER1, break: PAPER1, onArt: PAPER1, onArtDim: PAPER1,
      card: INK1, cardBottom: INK1, menu: INK1, menuBottom: INK1, btnHot: INK1, btnOn: INK1, btnOff: INK1, btnBottom: INK1, btnLineOff: PAPER1,
      strip: INK1, stripBottom: INK1, outline: INK1, backing: INK1,
    },
    fonts: { display: BIT, ui: BIT, number: BIT },
    frame: { corner: "square", size: 0, line: 2, inner: "double", gradient: false, alpha: 1, innerInset: 3, innerAlpha: 0 },
    bar: { cells: 14, sheen: false },
    upper: true,
    post: { kind: "mono", rows: 330, palette: [INK1, PAPER1], scanlines: false },
  },
  layout: stageLayout,
  partyCard: (unit, bust, strength, cutout) => new ObCard(unit, bust, strength, cutout),
  actionMenu: () => new ObMenu(),
  timeline: () => new ObOrder(),
  decorate: decorateConsole,
};
