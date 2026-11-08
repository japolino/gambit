/**
 * Where the Table's card duel puts things. The enemies stand across the
 * table (their feet under it, cut off at its far lip), placed by projecting
 * the room's own seats through the room's camera (scene/themes/table/duel.ts),
 * so they line up with the 3D table they stand behind. On your side: your
 * party as a row of cards at the bottom left, your skills fanned along the
 * bottom, and your own hand on the right holding the card you're reading.
 */
import type { Rect, StageLayout } from "../../battle/layout.js";
import { duelCamera, EDGE, FLOOR, project, seats } from "../../../scene/themes/table/duel.js";

export interface DuelLayout extends StageLayout {
  /** The table's far edge on screen (px): everything across the table is cut off here. */
  edgeY: number;
  /** The hand holding the card you read (wide only). */
  hold: Rect | null;
  /** The middle of the stage (narrower than the window on an ultrawide). */
  sl: number;
  sw: number;
}

export function duelLayout(w: number, h: number, partyCount: number): DuelLayout {
  const aspect = w / Math.max(1, h);
  const cam = duelCamera("battle", aspect);
  const port = cam.port;
  const edgeY = Math.round(project(cam, aspect, [0, EDGE.y, EDGE.z]).y * h);
  const ui = Math.max(0.85, Math.min(1.6, port ? w / 390 : Math.min(w / 1100, h / 760)));
  const n = Math.max(1, partyCount);
  const banner = { x: w / 2, y: Math.round(h * (port ? 0.06 : 0.08)) };
  if (port) {
    const m = Math.round(8 * ui);
    const timeline: Rect = { x: m, y: m, w: w - 2 * m, h: Math.round(30 * ui) };
    const cw = Math.min((w - 2 * m) / n - 4, 120 * ui);
    const ch = Math.round(Math.min(cw * 1.2, h * 0.15));
    // Below the enemies' name cards on the edge.
    const py = edgeY + Math.round(h * 0.05);
    const gap = (w - 2 * m - cw * n) / Math.max(1, n - 1 || 1);
    const cards = Array.from({ length: n }, (_, i) => ({ x: Math.round(n === 1 ? (w - cw) / 2 : m + i * (cw + Math.min(gap, 10 * ui))), y: py, w: Math.round(cw), h: ch }));
    // Centre the row.
    const rowW = cards[n - 1]!.x + cards[n - 1]!.w - cards[0]!.x;
    const shift = Math.round((w - rowW) / 2 - cards[0]!.x);
    for (const c of cards) c.x += shift;
    const party: Rect = { x: cards[0]!.x, y: py, w: rowW, h: ch };
    const my = py + ch + Math.round(4 * ui);
    const menu: Rect = { x: 0, y: my, w, h: h - my };
    return {
      w, h, portrait: true, ui, edgeY, hold: null, sl: 0, sw: w,
      enemyArea: { x: 0, y: timeline.y + timeline.h, w, h: edgeY - timeline.y - timeline.h },
      floorY: edgeY, timeline, party, cards, menu, banner,
    };
  }
  const sw = Math.min(w, h * 2.15);
  const sl = Math.round((w - sw) / 2);
  // Side by side on a rack, all of each card in view.
  const ch = Math.round(Math.min(h * 0.22, (sw * 0.42) / Math.max(1, n) / 0.72));
  const cw = Math.round(ch * 0.68);
  const step = cw + Math.round(ch * 0.045);
  const px = sl + Math.round(sw * 0.018);
  const py = h - ch - Math.round(h * 0.03);
  const cards = Array.from({ length: n }, (_, i) => ({ x: px + i * step, y: py, w: cw, h: ch }));
  const party: Rect = { x: px, y: py, w: step * (n - 1) + cw, h: ch };
  const holdW = Math.round(h * 0.5);
  const hold: Rect = { x: sl + sw - Math.round(holdW * 0.92), y: h - Math.round(holdW * 0.98), w: holdW, h: holdW };
  const mx = party.x + party.w + Math.round(sw * 0.01);
  const menu: Rect = { x: mx, y: Math.round(h * 0.6), w: hold.x + Math.round(holdW * 0.12) - mx, h: h - Math.round(h * 0.6) };
  // A fallback scoreboard (no room behind the fight), hung top right.
  const tw = Math.round(h * 0.2);
  const timeline: Rect = { x: sl + sw - tw - Math.round(h * 0.03), y: Math.round(h * 0.03), w: tw, h: Math.round(tw * 1.2) };
  const top = Math.round(h * 0.04);
  return {
    w, h, portrait: false, ui, edgeY, hold, sl, sw,
    enemyArea: { x: sl + sw * 0.1, y: top, w: sw * 0.8, h: edgeY - top },
    floorY: edgeY, timeline, party, cards, menu, banner,
  };
}

/** Where each enemy stands across the table: anchor (feet, under the table), height on screen, depth 0 front. */
export function duelSlots(w: number, h: number, rigs: string[]): { x: number; y: number; height: number; floorY: number; depth: number }[] {
  const aspect = w / Math.max(1, h);
  const cam = duelCamera("battle", aspect);
  const s = seats(rigs.length, cam.port);
  return rigs.map((rig, i) => {
    const seat = s[i]!;
    const tall = rig === "huge" ? 2.5 : rig === "floating" ? 1.55 : rig === "serpentine" ? 1.5 : 1.62;
    const lift = rig === "floating" ? 0.12 : 0;
    const foot = project(cam, aspect, [seat.x, FLOOR + lift, seat.z]);
    const head = project(cam, aspect, [seat.x, FLOOR + lift + tall * (cam.port ? 1.08 : 1), seat.z]);
    const depth = Math.min(1, Math.max(0, (-1.5 - seat.z) / 0.25)) * 0.5;
    return { x: foot.x * w, y: foot.y * h, height: (foot.y - head.y) * h, floorY: foot.y * h, depth };
  });
}

/** Where each enemy's name card stands on the table's far edge, and how big (px per room unit). */
export function tentSpots(w: number, h: number, n: number): { x: number; y: number; k: number }[] {
  const aspect = w / Math.max(1, h);
  const cam = duelCamera("battle", aspect);
  return seats(n, cam.port).map((seat) => {
    const p = project(cam, aspect, [seat.x * 0.82, EDGE.y, EDGE.z + 0.1]);
    return { x: p.x * w, y: p.y * h, k: p.k * h };
  });
}
