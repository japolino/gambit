/**
 * Where the Diorama battle puts things. When the shop staged the fight, the
 * figures stand on the counter top (the room publishes where it lands on
 * screen: ../../../scene/themes/diorama/bridge.ts `band`), between the
 * easel and the till; the party's index cards are pinned along the counter's
 * front, the skill tags hang beside them, and the turn order is a string of
 * paper bunting across the top. Without the room (no WebGL) the same paper
 * pieces sit over the painted plate in the same places.
 */
import type { Rect, StageLayout } from "../../battle/layout.js";
import { board } from "../../../scene/themes/diorama/bridge.js";

export function dioramaLayout(w: number, h: number, partyCount: number): StageLayout {
  const portrait = w / h < 0.95;
  const ui = Math.max(0.85, Math.min(1.5, portrait ? w / 390 : Math.min(w / 1100, h / 760)));
  const n = Math.max(1, partyCount);
  const bd = board();
  const band = bd.staged === "battle" ? bd.band : null;
  if (portrait) {
    const m = Math.round(8 * ui);
    const gap = Math.round(7 * ui);
    const timeline: Rect = { x: 0, y: 0, w, h: Math.round(54 * ui) };
    // The figures' feet: a little behind the middle of the counter top.
    const floorY = Math.round(band ? h * (band.back + (band.front - band.back) * 0.55) : h * 0.4);
    const areaTop = timeline.y + timeline.h * 1.3;
    const enemyArea: Rect = band ? { x: w * band.left, y: areaTop, w: w * (band.right - band.left), h: floorY - areaTop } : { x: 0, y: areaTop, w, h: floorY - areaTop };
    // Room under the feet for the price tags, then the cards and the skill tags down to the bottom edge.
    const tagsY = floorY + Math.round(70 * ui);
    const cardH = Math.round(Math.min(150 * ui, h * 0.19));
    const party: Rect = { x: m, y: tagsY, w: w - 2 * m, h: cardH };
    const cardW = (party.w - gap * (n - 1)) / n;
    const cards = Array.from({ length: n }, (_, i) => ({ x: party.x + i * (cardW + gap), y: party.y, w: cardW, h: cardH }));
    const menuY = party.y + party.h + gap;
    const menu: Rect = { x: m, y: menuY, w: w - 2 * m, h: Math.max(140, h - menuY - m) };
    return { w, h, portrait, ui, enemyArea, floorY, timeline, party, cards, menu, banner: { x: w / 2, y: Math.round(areaTop + 40 * ui) } };
  }
  const m = Math.round(14 * ui);
  const gap = Math.round(14 * ui);
  const timeline: Rect = { x: Math.round(w * 0.14), y: 0, w: Math.round(w * 0.72), h: Math.round(78 * ui) };
  const floorY = Math.round(band ? h * (band.back + (band.front - band.back) * 0.55) : h * 0.6);
  // Below the bunting's cards, so a tall figure's head never meets them.
  const areaTop = Math.round(timeline.h * 1.75);
  const enemyArea: Rect = band ? { x: w * band.left, y: areaTop, w: w * (band.right - band.left), h: floorY - areaTop } : { x: w * 0.12, y: areaTop, w: w * 0.76, h: floorY - areaTop };
  // The HUD starts below the price tags that hang from the counter's lip.
  const bottomY = Math.max(Math.round(h * 0.69), floorY + Math.round(78 * ui));
  const bottomH = h - bottomY - m;
  // Cards and the tag board keep their proportions on a very wide screen: the two sit together as one console
  // centred along the counter's front instead of stretching to the edges.
  const partyW = Math.round(Math.min(w * 0.56, n * Math.min(380 * ui, bottomH * 1.45) + (n - 1) * gap));
  const menuW = Math.round(Math.min(w - partyW - 2 * m - gap * 2 - 6 * ui, 720 * ui));
  const x0 = Math.max(m + Math.round(6 * ui), Math.round((w - partyW - gap * 2 - menuW) / 2));
  const party: Rect = { x: x0, y: bottomY, w: partyW, h: bottomH };
  const cardW = (party.w - gap * (n - 1)) / n;
  const cards = Array.from({ length: n }, (_, i) => ({ x: party.x + i * (cardW + gap), y: party.y, w: cardW, h: bottomH }));
  const menuX = party.x + party.w + gap * 2;
  const menu: Rect = { x: menuX, y: bottomY - Math.round(14 * ui), w: menuW, h: bottomH + Math.round(14 * ui) };
  return { w, h, portrait, ui, enemyArea, floorY, timeline, party, cards, menu, banner: { x: w / 2, y: Math.round(areaTop + 46 * ui) } };
}
