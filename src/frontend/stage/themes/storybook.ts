/**
 * The Storybook theme's battle: a JRPG fight told on the pages of the scene's illuminated book. The painted
 * place fills the window inside gilt acanthus corners; the party stand as tall gilt arches rising out of the
 * dialogue page (their vigour and focus poured in phials on the vellum below), the foes stand in the
 * painting over brocade name scrolls, the skills hang as silk ribbons with brass medallions, the page tells
 * the tale as it plays, and the order of turns is the chapter header's astrolabe and scroll of coins.
 * This file is the theme's own; see ./types.ts for what a battle theme may provide, ./storybook/ for the parts.
 */
import type { BattleTheme } from "./types.js";
import { CINZEL, FELL, GARAMOND } from "./shared.js";
import { bookLayout } from "./storybook/layout.js";
import { BookCard } from "./storybook/card.js";
import { BookMenu } from "./storybook/menu.js";
import { BookTimeline } from "./storybook/timeline.js";
import { decorate } from "./storybook/decor.js";

export const theme: BattleTheme = {
  // The theme marks targets itself (types.ts).
  enemyBrackets: false,
  skin: {
    colors: {
      ink: 0x120804, ink2: 0x1a0d06, panel: 0x24110e, panelHi: 0x3a1a12, line: 0xd4af37, gold: 0xe8c372, goldDim: 0x9a7440,
      text: 0xf3e3bd, textDim: 0xd2b88a, textFaint: 0xa08460, poiseEmpty: 0x5a3a1c,
      card: 0x3a1f0c, cardBottom: 0x1e0f05, menu: 0x2a1608, menuBottom: 0x140904,
      btnHot: 0xf6ead0, btnOn: 0xe8dcc4, btnOff: 0xb8ab94, btnBottom: 0xcdbb98, btnLineOff: 0x5a3a1c, btnText: 0x2c1a11, btnTextDim: 0x6e5239,
      strip: 0x2a1608, stripBottom: 0x170b04, outline: 0x1a0a04, backing: 0x1e0f05, enemy: 0xc0392b, ally: 0x6fb2e6, crit: 0xffd27a,
      hp: 0xc2242a, hpHi: 0xff7a62, focus: 0x2d64b8, focusHi: 0x9fd0ff,
    },
    fonts: { display: FELL, ui: GARAMOND, number: CINZEL },
    frame: { corner: "chamfer", size: 2, line: 1.5, inner: "gilt", gradient: true, alpha: 0.96, innerInset: 4, innerAlpha: 0.8, innerAll: true },
    bar: { cells: 0, sheen: true, trough: 0x0a0402 },
    upper: false,
    grade: 0xf2cc96,
  },
  layout: bookLayout,
  partyCard: (unit, bust, strength, cutout) => new BookCard(unit, bust, strength, cutout),
  actionMenu: () => new BookMenu(),
  timeline: () => new BookTimeline(),
  decorate,
};
