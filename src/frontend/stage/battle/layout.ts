/**
 * Where everything sits on the battle stage, from the stage size. Pure.
 * Portrait phones (docs/DESIGN.md, 6): enemy art on top, the timeline
 * strip, the party cards, then the action menu. Wide screens: enemies
 * across the top two thirds with the timeline over them, party cards
 * bottom left, the action menu bottom right.
 */
import type { RigKind } from "../../../engine/types.js";

export type Rect = { x: number; y: number; w: number; h: number };

export type EnemySlot = {
  /** Anchor (bbox bottom-centre) on screen. */
  x: number;
  y: number;
  /** Displayed figure height (px). */
  height: number;
  /** Where the ground shadow goes (floating figures hover over it). */
  floorY: number;
  /** 0 front .. 1 back: drawn behind and a little darker. */
  depth: number;
};

export type StageLayout = {
  w: number;
  h: number;
  portrait: boolean;
  /** Scale for type and UI (1 at a 390 px wide phone). */
  ui: number;
  enemyArea: Rect;
  floorY: number;
  timeline: Rect;
  party: Rect;
  cards: Rect[];
  menu: Rect;
  /** Centre of the skill-name banner. */
  banner: { x: number; y: number };
  /** The foes live inside a picture frame (a terminal's screen, a console's window) and stay in it. Everywhere else they fill the stage. */
  framed?: boolean;
};

export function computeLayout(w: number, h: number, partyCount: number): StageLayout {
  const portrait = w / h < 0.95;
  const ui = Math.max(0.85, Math.min(1.35, (portrait ? w / 390 : Math.min(w / 1100, h / 760)) ));
  const m = Math.round(10 * ui);
  const gap = Math.round(8 * ui);
  const n = Math.max(1, partyCount);
  if (portrait) {
    const enemyH = Math.round(h * 0.45);
    const timeline: Rect = { x: m, y: enemyH + Math.round(4 * ui), w: w - 2 * m, h: Math.round(42 * ui) };
    const cardH = Math.round(Math.min(132 * ui, h * 0.16));
    const party: Rect = { x: m, y: timeline.y + timeline.h + gap, w: w - 2 * m, h: cardH };
    const cardW = (party.w - gap * (n - 1)) / n;
    const cards = Array.from({ length: n }, (_, i) => ({ x: party.x + i * (cardW + gap), y: party.y, w: cardW, h: cardH }));
    const menuY = party.y + party.h + gap;
    const menu: Rect = { x: m, y: menuY, w: w - 2 * m, h: Math.max(120, h - menuY - m) };
    return {
      w, h, portrait, ui,
      enemyArea: { x: 0, y: 0, w, h: enemyH },
      // Room under the floor for the enemy plates (name, HP, poise, statuses).
      floorY: Math.round(enemyH - 54 * ui),
      timeline, party, cards, menu,
      banner: { x: w / 2, y: Math.round(enemyH * 0.12) },
    };
  }
  const enemyH = Math.round(h * 0.64);
  const timeline: Rect = { x: Math.round(w * 0.2), y: m, w: Math.round(w * 0.6), h: Math.round(44 * ui) };
  const bottomY = enemyH + gap;
  const bottomH = h - bottomY - m;
  const party: Rect = { x: m, y: bottomY, w: Math.round(w * 0.56), h: bottomH };
  const cardW = (party.w - gap * (n - 1)) / n;
  const cards = Array.from({ length: n }, (_, i) => ({ x: party.x + i * (cardW + gap), y: party.y, w: cardW, h: bottomH }));
  const menu: Rect = { x: party.x + party.w + gap, y: bottomY, w: w - party.w - 2 * m - gap, h: bottomH };
  return {
    w, h, portrait, ui,
    enemyArea: { x: 0, y: timeline.y + timeline.h, w, h: enemyH - timeline.y - timeline.h },
    floorY: Math.round(enemyH * 0.93),
    timeline, party, cards, menu,
    banner: { x: w / 2, y: Math.round(timeline.y + timeline.h + 34 * ui) },
  };
}

/** Front-to-back order of slots for n enemies: the middle stands forward. */
function depthOf(i: number, n: number): number {
  if (n <= 2) return 0;
  const mid = (n - 1) / 2;
  return Math.min(1, Math.abs(i - mid) / Math.max(1, mid)) * 0.8;
}

/** How far past the space above the floor a foe stands, by how many there are: a lone foe fills the screen and can run off the top of it. */
const REACH = [1.55, 1.38, 1.22, 1.08] as const;
/** How much of a standing foe goes below the floor line: their feet are behind the page, like the party's. */
const TUCK = 0.14;
/** How much of a figure may run off the top of the screen: a hat or a horn, never the face. */
const OVER_TOP = 0.07;

/** Slots for enemies (in combatant order), sized by rig kind. */
export function enemySlots(layout: StageLayout, rigs: RigKind[]): EnemySlot[] {
  const area = layout.enemyArea;
  const n = rigs.length;
  const free = !layout.framed;
  const hugeIndex = rigs.indexOf("huge");
  const weights = rigs.map((r) => (r === "huge" ? 2.2 : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  const usable = area.w * (free ? 1 : layout.portrait ? 0.98 : 0.86);
  const left = area.x + (area.w - usable) / 2;
  let cursor = left;
  return rigs.map((rig, i) => {
    const slotW = (usable * weights[i]!) / total;
    const x = cursor + slotW / 2;
    cursor += slotW;
    const depth = hugeIndex >= 0 ? (i === hugeIndex ? 0 : 0.5) : depthOf(i, n);
    const room = layout.floorY - area.y;
    const reach = REACH[Math.min(n, REACH.length) - 1] ?? 1;
    const base = free ? Math.min(room * reach, slotW * 3.4) : Math.min(room * 0.92, slotW * (layout.portrait ? 2.6 : 2.2));
    const k = 1 - depth * 0.18;
    const floorY = layout.floorY - depth * room * 0.06;
    if (rig === "huge") {
      // The anchor sits below the floor; the figure towers over the field.
      if (!free) return { x, y: layout.floorY + room * 0.3, height: room * 1.15, floorY, depth };
      const y = layout.floorY + room * 0.38;
      return { x, y, height: Math.min(room * 1.6, y / (1 - OVER_TOP)), floorY, depth };
    }
    const floats = rig === "floating";
    // Measured from the top of the screen, so a tall stage and a short one crop the same. On a phone the order of turns runs across the top: faces stay under it.
    const ceiling = layout.portrait ? area.y : 0;
    const fits = free ? (floorY - ceiling) / (1 - OVER_TOP + (floats ? 0.1 : -TUCK)) : Infinity;
    const height = Math.min(base * k * (rig === "serpentine" ? 0.92 : 1), fits);
    const hover = floats ? height * 0.1 : 0;
    const tuck = free && !floats ? height * TUCK : 0;
    return { x, y: floorY - hover + tuck, height, floorY, depth };
  });
}
