/**
 * How the expedition board (./board.ts) looks over each stage theme: the
 * tile material, the type, and the ring colours, in the theme's own
 * palette. Rings keep their meaning everywhere (safe, chance, story, the
 * way on); the 1-bit theme tells them apart by stroke pattern instead.
 */
import type { BoardSkin } from "./board.js";

const FELL = '"Gambit Fell", "Gambit Garamond", Georgia, serif';

export const BOARD_SKINS: Record<"storybook" | "diorama" | "lobby" | "table" | "onebit" | "command", BoardSkin> = {
  // Gilt and parchment over a leather-bound page.
  storybook: {
    style: "print",
    font: `16px/1.4 ${FELL}`,
    ink: "#f3e3bd",
    panel: "rgba(42,22,8,.9)",
    edge: "rgba(243,215,145,.4)",
    accent: "#ffd27a",
    back: "#3a1a08",
    backEdge: "#a8742f",
    face: "#f3e6c8",
    faceEdge: "#7a3b16",
    rings: { safe: "#6fb2e6", chance: "#7cc46a", lore: "#c08ae8", goal: "#ffd27a" },
    foe: "#8b1a1a",
    token: "#f7ead0",
    veil: "radial-gradient(ellipse at 50% 45%, rgba(40,20,8,.62), rgba(14,7,3,.94))",
  },
  // Paper craft on a lamplit tabletop.
  diorama: {
    style: "print",
    font: `16px/1.4 ${FELL}`,
    ink: "#fbe7a8",
    panel: "rgba(43,23,10,.9)",
    edge: "rgba(251,231,168,.38)",
    accent: "#ffe24a",
    back: "#5a3418",
    backEdge: "#d4a24a",
    face: "#e9dcbc",
    faceEdge: "#2b170a",
    rings: { safe: "#5fb6f0", chance: "#8fd16a", lore: "#d08cf0", goal: "#ffe24a" },
    foe: "#b3261e",
    token: "#fbe7a8",
    veil: "radial-gradient(ellipse at 50% 50%, rgba(60,32,12,.55), rgba(18,9,3,.93))",
  },
  // Brass and cream, a grand hotel's lobby at night.
  lobby: {
    style: "glass",
    font: `16px/1.4 "Gambit Garamond", "Palatino Linotype", Georgia, serif`,
    ink: "#F5E8C7",
    panel: "rgba(28,19,8,.88)",
    edge: "rgba(200,170,110,.45)",
    accent: "#e6c687",
    back: "#1c1308",
    backEdge: "#c8aa6e",
    face: "#F3E8D2",
    faceEdge: "#8a6421",
    rings: { safe: "#7ab8e8", chance: "#8cc98a", lore: "#c49ae6", goal: "#f5e1a4" },
    foe: "#9a2a22",
    token: "#F5E8C7",
    veil: "radial-gradient(ellipse at 50% 40%, rgba(34,24,11,.6), rgba(10,7,3,.94))",
  },
  // Cards dealt face down on green baize.
  table: {
    style: "card",
    font: `16px/1.4 ${FELL}`,
    ink: "#fff2e0",
    panel: "rgba(16,30,20,.9)",
    edge: "rgba(242,207,122,.4)",
    accent: "#ffcf6a",
    back: "#9c1419",
    backEdge: "#f2cf7a",
    face: "#fbf3e2",
    faceEdge: "#2a1804",
    rings: { safe: "#4aa8ff", chance: "#16b877", lore: "#b46cff", goal: "#ffcf6a" },
    foe: "#2a1804",
    token: "#fff2e0",
    veil: "radial-gradient(ellipse at 50% 45%, rgba(20,82,50,.82), rgba(4,24,14,.96))",
  },
  // Black and white only: dithered backs, rings told apart by their dashes.
  onebit: {
    style: "dither",
    mono: true,
    font: `13px/1.5 "Gambit 8bit", monospace`,
    ink: "#f0eee6",
    panel: "#080707",
    edge: "#f0eee6",
    accent: "#f0eee6",
    back: "#080707",
    backEdge: "#f0eee6",
    face: "#f0eee6",
    faceEdge: "#080707",
    rings: { safe: "#f0eee6", chance: "#f0eee6", lore: "#f0eee6", goal: "#f0eee6" },
    foe: "#f0eee6",
    token: "#f0eee6",
    veil: "#080707",
  },
  // A sixteen-colour terminal.
  command: {
    style: "glyph",
    font: `16px/1.3 "Gambit 8bit", monospace`,
    ink: "#FFFFFF",
    panel: "#0000AA",
    edge: "#AAAAAA",
    accent: "#FFFF55",
    back: "#000000",
    backEdge: "#555555",
    face: "#AAAAAA",
    faceEdge: "#000000",
    rings: { safe: "#55FFFF", chance: "#55FF55", lore: "#FF55FF", goal: "#FFFF55" },
    foe: "#FF5555",
    token: "#FFFFFF",
    veil: "#000000",
  },
};
