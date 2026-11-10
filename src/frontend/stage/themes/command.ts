/**
 * The Command theme's battle: a turn-based crawler fight on the scene's own CRT monitor (./command/battle.ts):
 * the view with the foes, a party roster, the turn order, a numbered command list and a scrolling combat log on
 * a blue EGA chassis, the tube's scanlines, glow and dark edge as a shader, the monitor and its desk props around it.
 * This file is the theme's own; see ./types.ts for what a battle theme may provide.
 */
import type { BattleTheme } from "./types.js";
import { BIT, COMMAND_ART } from "./shared.js";
import { CommandCard, CommandMenu, CommandTimeline, commandLayout, decorateCommand } from "./command/battle.js";

export const theme: BattleTheme = {
  skin: {
    colors: {
      ink: 0x000000, ink2: 0x000000, panel: 0x000000, panelHi: 0x000000, line: 0xffffff, gold: 0xffff55, goldDim: 0xaaaaaa,
      text: 0xffffff, textDim: 0x55ffff, textFaint: 0xaaaaaa, hp: 0xaa0000, hpHi: 0xff5555, hpGhost: 0xffff55, focus: 0x0000aa, focusHi: 0x55ffff,
      shield: 0x55ffff, poise: 0xffff55, poiseEmpty: 0x555555, heal: 0x55ff55, crit: 0xffff55, weak: 0xff55ff, resist: 0xaaaaaa, miss: 0xaaaaaa,
      enemy: 0xff5555, ally: 0x55ffff, break: 0xffff55,
      card: 0x000000, cardBottom: 0x000000, menu: 0x000000, menuBottom: 0x000000, btnHot: 0xffffff, btnOn: 0x000000, btnOff: 0x000000, btnBottom: 0x000000, btnLineOff: 0x555555,
      strip: 0x000000, stripBottom: 0x000000, outline: 0x000000, backing: 0x000000,
    },
    fonts: { display: BIT, ui: BIT, number: BIT },
    frame: { corner: "square", size: 0, line: 1, inner: "none", gradient: false, alpha: 1, innerInset: 3, innerAlpha: 0 },
    bar: { cells: 12, sheen: false },
    upper: true,
    post: { kind: "palette", rows: 360, palette: COMMAND_ART.ega!, scanlines: false },
  },
  // The canvas is clear outside the glass, so the room and the monitor (DOM, ./command/shell.ts) show around it.
  backdrop: "transparent",
  // The foes are named and measured in the view's foot band (./command/battle.ts FoePlates).
  enemyPlates: false,
  enemyBrackets: false,
  layout: commandLayout,
  partyCard: (unit, bust, strength, cutout) => new CommandCard(unit, bust, strength, cutout),
  actionMenu: () => new CommandMenu(),
  timeline: () => new CommandTimeline(),
  decorate: decorateCommand,
};
