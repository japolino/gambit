/**
 * The Lobby theme's battle: the hub hall's gacha battle screen in dark-academia gold and ink. The acting party
 * member stands tall left of centre with the astrolabe halo behind their head (as the hall's lead does), the
 * enemies stand on the floor to the right over ornate nameplates, the party sits bottom left in brass cards with
 * arched portrait windows, the skills are big engraved brass medallions bottom right (the signature on a
 * sunburst), and the turn order hangs along the top as pocket-watch lockets on chains. The HUD is a DOM layer of
 * the scene's own SVG over the canvas (./lobby/hud.ts); see ./types.ts for what a battle theme may provide.
 */
import type { BattleTheme } from "./types.js";
import { GARAMOND, CINZEL } from "./shared.js";
import { LobbyCard } from "./lobby/card.js";
import { decorateLobby } from "./lobby/hud.js";
import { lobbyLayout } from "./lobby/geom.js";
import { LobbyMenu } from "./lobby/menu.js";
import { LobbyOrder } from "./lobby/order.js";
import { setGeom } from "./lobby/state.js";

export const theme: BattleTheme = {
  // The theme marks targets itself (types.ts).
  enemyBrackets: false,
  skin: {
    colors: {
      ink: 0x0e0c0a, ink2: 0x15110d, panel: 0x14100c, panelHi: 0x1f1913, line: 0xb68d40, gold: 0xdfc183, goldDim: 0xb8a27a,
      text: 0xf5e8c7, textDim: 0xcfc0a0, textFaint: 0xa69272, poiseEmpty: 0x3a3127,
      card: 0x1f1913, cardBottom: 0x0e0c0a, menu: 0x14100c, menuBottom: 0x0e0c0a, btnHot: 0x2e251a, btnOn: 0x1f1913, btnOff: 0x15110d, btnBottom: 0x0e0c0a, btnLineOff: 0x4a3c28,
      strip: 0x14100c, stripBottom: 0x0e0c0a, outline: 0x0a0806, backing: 0x0e0c0a, enemy: 0xd8503a, ally: 0x7fd1c7,
      hp: 0x8f2219, hpHi: 0xd8503a, crit: 0xffd27a,
    },
    fonts: { display: CINZEL, ui: GARAMOND, number: CINZEL },
    frame: { corner: "chamfer", size: 1, line: 1, inner: "gilt", gradient: true, alpha: 0.9, innerInset: 3, innerAlpha: 0.3 },
    bar: { cells: 0, sheen: true },
    upper: true,
    // The hall's warm sepia (the scene grades its painting the same way).
    grade: 0xcdb592,
  },
  layout(w, h, party) {
    setGeom(w, h, party);
    return lobbyLayout(w, h, party);
  },
  partyCard: (unit, bust, strength, cutout) => new LobbyCard(unit, bust, strength, cutout),
  actionMenu: () => new LobbyMenu(),
  timeline: () => new LobbyOrder(),
  decorate: (stage) => decorateLobby(stage),
};
