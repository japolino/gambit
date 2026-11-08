/**
 * Storybook battle: where everything sits. The fight is a plate in the book: the painted place fills the
 * window, the dialogue page spans the bottom on its mahogany skirt (as in the scene), the party stand as
 * tall gilt arches rising out of the page's left half (their feet tucked behind its rim, their stats written
 * on the vellum under them), the foes stand in the painting centre-right, the skill ribbons hang on the
 * right under "What will … do?", the page's right half tells the tale (the skill's lore, the last blows), and
 * the order of turns is the chapter header: an astrolabe and a scroll of coins at the top left.
 * Phone: the foes on top, the page below them holding the arches, their stats, then the ribbons.
 */
import type { Rect, StageLayout } from "../../battle/layout.js";

export interface BookGeo {
  portrait: boolean;
  /** Overall scale (1 at 1920×1080). */
  s: number;
  /** The page box (the vellum; the frame overhangs it). */
  page: Rect;
  /** Height of an arch's visible part above the page rim, and the stats band below it. */
  archH: number;
  statsH: number;
  /** In the menu's own coordinates: the ribbon column and the page's text block. */
  rib: Rect;
  text: Rect;
  /** Where the nameplate sits (menu coordinates, its left end and the rim line). */
  plate: { x: number; y: number };
}

/** The geometry of the last layout (one stage at a time). */
export const GEO: BookGeo = {
  portrait: false, s: 1, page: { x: 0, y: 0, w: 1, h: 1 }, archH: 1, statsH: 1,
  rib: { x: 0, y: 0, w: 1, h: 1 }, text: { x: 0, y: 0, w: 1, h: 1 }, plate: { x: 0, y: 0 },
};

const clamp = (lo: number, hi: number, v: number) => Math.max(lo, Math.min(hi, v));
/** The arch's visible height per unit of width (picture 260×400, 90% shown above the rim). */
export const ARCH_RATIO = (400 / 260) * 0.9;

export function bookLayout(w: number, h: number, partyCount: number): StageLayout {
  const n = Math.max(1, partyCount);
  const portrait = w / h < 0.95;
  if (portrait) return phone(w, h, n);
  const s = Math.min(w / 1920, h / 1080);
  const ui = clamp(0.8, 1.4, 1.32 * Math.max(s, 0.6));
  const db = Math.max(12, Math.round(h * 0.022));
  const dh = Math.round(clamp(140, 230, h * 0.2));
  const dw = Math.round(Math.min(w * 0.86, 1900));
  const page: Rect = { x: Math.round((w - dw) / 2), y: h - db - dh, w: dw, h: dh };
  // The party's half of the page.
  const zx = page.x + Math.round(34 * Math.max(s, 0.7));
  const zw = Math.round(dw * 0.4);
  const aw = Math.round(Math.min(zw / (n * 0.92), (h * 0.4) / ARCH_RATIO));
  const archH = Math.round(aw * ARCH_RATIO);
  const step = n > 1 ? Math.min(aw * 1.06, (zw - aw) / (n - 1)) : 0;
  const cardsW = aw + step * (n - 1);
  const cx0 = zx + Math.max(0, (zw - cardsW) / 2);
  const statsBand = Math.round(aw * 0.12 + 34);
  const cards: Rect[] = Array.from({ length: n }, (_, i) => ({ x: Math.round(cx0 + i * step), y: page.y - archH, w: aw, h: archH + statsBand }));
  // The ribbons on the right, over the painting.
  const rw = Math.round(clamp(300, 400, Math.max(w * 0.18, 380 * Math.max(s, 0.8))));
  // On a very wide window the ribbons come in to the page's right end, near the fight, not the window's edge.
  const ribX = Math.min(w - Math.round(w * 0.04) - rw, page.x + page.w - rw + Math.round(30 * s));
  const ribTop = Math.round(h * 0.17);
  const ribBottom = page.y - Math.round(34 * Math.max(s, 0.7));
  // The page's text block: the whole page under the arches' name scrolls (the nameplate sits on the rim past them).
  const px0 = Math.round(zx + zw + 40 * Math.max(s, 0.6));
  const tx0 = page.x + Math.round(56 * Math.max(s, 0.7));
  const tx1 = page.x + dw - Math.round(64 * Math.max(s, 0.7));
  const mx = Math.min(px0, ribX) - 10;
  const my = ribTop - Math.round(60 * Math.max(s, 0.7));
  const menu: Rect = { x: mx, y: my, w: w - mx, h: h - my };
  GEO.portrait = false;
  GEO.s = s;
  GEO.page = page;
  GEO.archH = archH;
  GEO.statsH = dh;
  GEO.rib = { x: ribX - mx, y: ribTop - my, w: rw, h: ribBottom - ribTop };
  const ty = statsBand + Math.round(10 * Math.max(s, 0.65));
  GEO.text = { x: tx0 - mx, y: page.y - my + ty, w: tx1 - tx0, h: dh - ty - Math.round(20 * Math.max(s, 0.65)) };
  GEO.plate = { x: px0 - mx - 18, y: page.y - my };
  // Foes: centre-right of the painting, between the arches and the ribbons.
  const ex0 = Math.round(Math.max(w * 0.3, zx + zw * 0.92));
  const ex1 = ribX - Math.round(16 * s);
  const tlH = Math.round(clamp(76, 134, h * 0.125));
  // Room under the feet for each foe's scroll, gauge and rosettes, clear of the page's rim.
  const floorY = page.y - Math.round(clamp(110, 196, 170 * Math.max(s, 0.62)));
  const top = Math.round(h * 0.06);
  return {
    w, h, portrait: false, ui,
    enemyArea: { x: ex0, y: top, w: ex1 - ex0, h: floorY - top },
    floorY,
    timeline: { x: Math.round(Math.max(w * 0.022, clamp(150, 360, Math.min(w * 0.21, h * 0.34)) * 0.36)), y: Math.round(h * 0.024), w: Math.round(Math.min(w * 0.44, 820 * Math.max(s, 0.75))), h: tlH },
    party: { x: zx, y: page.y - archH, w: zw, h: archH + dh },
    cards,
    menu,
    banner: { x: Math.round((ex0 + ex1) / 2), y: Math.round(h * 0.2) },
  };
}

function phone(w: number, h: number, n: number): StageLayout {
  const ui = clamp(0.85, 1.3, w / 390);
  const s = w / 600;
  const m = Math.round(6 * ui);
  const tl: Rect = { x: m + 2, y: m + 2, w: w - 2 * m - 4, h: Math.round(54 * ui) };
  const page: Rect = { x: m + 8, y: Math.round(h * 0.55), w: w - 2 * m - 16, h: h - Math.round(h * 0.55) - m - 10 };
  const aw = Math.round(Math.min((page.w - 8) / (n * 0.98), (h * 0.15) / ARCH_RATIO));
  const archH = Math.round(aw * ARCH_RATIO);
  const statsH = Math.round(aw * 0.12 + 26);
  const step = n > 1 ? Math.min(aw * 1.08, (page.w - aw) / (n - 1)) : 0;
  const cx0 = page.x + (page.w - (aw + step * (n - 1))) / 2;
  const cards: Rect[] = Array.from({ length: n }, (_, i) => ({ x: Math.round(cx0 + i * step), y: page.y - archH, w: aw, h: archH + statsH }));
  const my = page.y + statsH + Math.round(4 * ui);
  const menu: Rect = { x: 0, y: my, w, h: h - my };
  GEO.portrait = true;
  GEO.s = s;
  GEO.page = page;
  GEO.archH = archH;
  GEO.statsH = statsH;
  const ribTop = Math.round(30 * ui);
  GEO.rib = { x: page.x + 10, y: ribTop, w: page.w - 20, h: menu.h - ribTop - Math.round(16 * ui) - m };
  GEO.text = { x: page.x + 16, y: 0, w: page.w - 32, h: 0 };
  GEO.plate = { x: page.x + 14, y: Math.round(8 * ui) };
  const floorY = Math.round(h * 0.28);
  return {
    w, h, portrait: true, ui,
    enemyArea: { x: 0, y: tl.y + tl.h, w, h: floorY - tl.y - tl.h },
    floorY,
    timeline: tl,
    party: { x: page.x, y: page.y - archH, w: page.w, h: archH + statsH },
    cards,
    menu,
    banner: { x: w / 2, y: Math.round(h * 0.14) },
  };
}
