/**
 * The Diorama theme's battle: the fight happens in the shop. When the scene's 3D shop staged it
 * (../../scene/themes/diorama/room3d.ts `encounter`) the canvas is see-through and the foes stand on the oak
 * counter as die-cut paper standees lit by a row of footlights; otherwise the same paper pieces sit over the
 * painted plate. The HUD is the shop's stationery: the party as index cards pinned along the counter's front
 * (./diorama/card.ts), the skills as manila shipping tags hanging from a dowel (./diorama/tags.ts), the turn
 * order as paper bunting across the top (./diorama/bunting.ts), each foe's stats on a kraft price tag
 * (./diorama/decor.ts). See ./types.ts for what a battle theme may provide.
 */
import type { BattleTheme } from "./types.js";
import { FELL } from "./shared.js";
import { board } from "../../scene/themes/diorama/bridge.js";
import { dioramaLayout } from "./diorama/layout.js";
import { PaperCard } from "./diorama/card.js";
import { TagMenu } from "./diorama/tags.js";
import { Bunting } from "./diorama/bunting.js";
import { decorate } from "./diorama/decor.js";

export const theme: BattleTheme = {
  skin: {
    colors: {
      ink: 0x140c05, ink2: 0x1c1007, panel: 0xc8a97e, panelHi: 0xe0c69c, line: 0xf4e3c1, gold: 0xe8b830, goldDim: 0x7a5a36,
      text: 0x2b2118, textDim: 0x4a3a28, textFaint: 0x6e5a40, poiseEmpty: 0xb89a70,
      card: 0xd8bc8e, cardBottom: 0xbf9f72, menu: 0xc8a97e, menuBottom: 0xb3946a, btnHot: 0xf4e3c1, btnOn: 0xe6d2b5, btnOff: 0xb8a07c, btnBottom: 0xd4bc98, btnLineOff: 0x8a7050,
      btnText: 0x2b2118, btnTextDim: 0x6a4a28, onArt: 0xfbe7a8, onArtDim: 0xe0c48a,
      strip: 0xc8a97e, stripBottom: 0xb3946a, outline: 0x1a0d05, backing: 0x22130a, enemy: 0xb3261e, ally: 0x2f5f9a, hpGhost: 0xf0d080, crit: 0xffe066,
    },
    fonts: { display: FELL, ui: FELL, number: FELL },
    frame: { corner: "round", size: 1.8, line: 2, inner: "none", gradient: true, alpha: 1, innerInset: 3, innerAlpha: 0, shadow: 5 },
    bar: { cells: 0, sheen: false, trough: 0x2b2118 },
    upper: false,
    grade: 0xffcc80,
  },
  // See-through only while the shop has staged this fight (read when the stage is built, right after the scene
  // was asked to stage it); without WebGL the painted plate stays.
  get backdrop() {
    return board().staged === "battle" ? "transparent" : "plate";
  },
  layout: dioramaLayout,
  partyCard: (unit, bust, strength, cutout) => new PaperCard(unit, bust, strength, cutout),
  actionMenu: () => new TagMenu(),
  timeline: () => new Bunting(),
  decorate,
};
