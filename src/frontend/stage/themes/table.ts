/**
 * The Table theme's battle: a card duel across the candle-lit table.
 *
 * The fight is staged in the scene's own 3D room (scene/themes/table.ts
 * encounter()): the canvas is see-through, the enemies stand across the real
 * table, cut off at its far lip, each with a folded name card carrying their
 * HP; the turn order is chalked on the room's hanging slate. Your party is a
 * row of woodcut cards on your side, your skills a hand of cards fanned along
 * the bottom edge, and your own hand holds the card you're reading. Without
 * WebGL the room can't stage it and the painted plate comes back behind the
 * same hand. See ./table/ for the pieces and ./types.ts for the contract.
 */
import type { BattleTheme } from "./types.js";
import { FELL, CINZEL } from "./shared.js";
import { TableCard } from "./table/party.js";
import { TableHand } from "./table/hand.js";
import { TableSlate } from "./table/slate.js";
import { duelLayout } from "./table/layout.js";
import { decorate } from "./table/decor.js";

export const theme: BattleTheme = {
  skin: {
    colors: {
      ink: 0x0b0708, ink2: 0x140c0a, panel: 0x1e1410, panelHi: 0x2a1c14, line: 0xd9b46a, gold: 0xffcf6a, goldDim: 0xb0904a,
      text: 0xf3e6c8, textDim: 0xd8c9a6, textFaint: 0xa89878, poiseEmpty: 0x3a1a1a,
      card: 0xe2d6bd, cardBottom: 0xc8b48c, menu: 0x1e1410, menuBottom: 0x0e0806, btnHot: 0x5a1a14, btnOn: 0x2a1c14, btnOff: 0x160e0a, btnBottom: 0x0e0806, btnLineOff: 0x4a3424,
      strip: 0x1e1410, stripBottom: 0x0e0806, outline: 0x0a0505, backing: 0x140c0a, enemy: 0xff5a4a, ally: 0xf2efe9,
    },
    fonts: { display: FELL, ui: FELL, number: CINZEL },
    frame: { corner: "round", size: 1.2, line: 2, inner: "gilt", gradient: true, alpha: 0.96, innerInset: 6, innerAlpha: 0.85, innerAll: true },
    bar: { cells: 0, sheen: true, trough: 0x0f0505 },
    upper: false,
    grade: 0xd8b898,
  },
  backdrop: "transparent",
  // The theme marks targets itself (crimson and gold brackets, numbered for the keys).
  enemyBrackets: false,
  layout: duelLayout,
  partyCard: (unit, bust, strength, cutout) => new TableCard(unit, bust, strength, cutout),
  actionMenu: () => new TableHand(),
  timeline: () => new TableSlate(),
  decorate,
};
