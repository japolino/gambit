/**
 * The 1-bit battle's layout, on the same virtual pixel grid as the scene's console (one virtual pixel = `u`
 * screen px; the art shader is set to the same cell, so figures, frames and type share one grid). The fight
 * keeps the scene's workstation: the viewport (the enemies standing in the dark, the battle messages printed
 * over it) with the party as a deck of three cards under it, the WHAT NOW? prompt over the turn order in the
 * right column, and the function-key strip along the bottom (the log, the next to act). A phone drops the
 * chrome for room: plain boxes, three small party cards with no faces, and command rows a thumb can hit
 * (ROW virtual px, 44 CSS px at the phone's unit of 2). Pure.
 */
import type { Rect as FRect } from "../../../scene/themes/onebit/fb.js";
import type { Rect, StageLayout } from "../../battle/layout.js";

/** tall: a phone upright. land: a phone on its side. Both are "compact" (see isCompact). */
export type ObMode = "wide" | "std" | "tall" | "land";

/** A compact screen's command row and party card, and the strip's height (virtual px). */
export const ROW = 22;
const CARD = 38;
export const isCompact = (mode: ObMode): boolean => mode === "tall" || mode === "land";

export interface ObLayout {
  u: number;
  W: number;
  H: number;
  mode: ObMode;
  view: FRect;
  /** The turn order as a numbered list (none on a phone: the key strip names the next two). */
  order: FRect | null;
  party: FRect;
  cmd: FRect;
  keys: FRect;
  /** One card per party member, and its portrait window. */
  rows: FRect[];
  pics: FRect[];
  /** The band at the foot of the viewport where the enemy plates float in the dark. */
  plateY: number;
}

export type ObStageLayout = StageLayout & { ob: ObLayout };

/** Window interior under the title bar (as the scene's console). */
export const inner = (r: FRect): FRect => ({ x: r.x + 4, y: r.y + 14, w: r.w - 8, h: r.h - 17 });

/** The stone pillars framing the viewport, left and right (virtual px). */
export const pillarW = (w: number): number => Math.max(8, Math.round(w * 0.07));

/** Where the picture shows inside the viewport's window: compact windows have a plain rule and no title bar. */
export const viewIn = (o: Pick<ObLayout, "mode" | "view">): FRect =>
  isCompact(o.mode) ? { x: o.view.x + 2, y: o.view.y + 2, w: o.view.w - 4, h: o.view.h - 4 } : inner(o.view);

/** Virtual pixel size: about 290 rows, and never fewer than 190 columns (a phone). */
export function cellSize(w: number, h: number): number {
  return Math.max(2, Math.min(Math.floor(h / 290), Math.floor(w / 190)));
}

export function obLayout(w: number, h: number, n: number): ObLayout {
  const u = cellSize(w, h);
  const W = Math.max(120, Math.floor(w / u));
  const H = Math.max(120, Math.floor(h / u));
  // A short screen is a phone on its side, however wide: the desktop's two stacked columns don't fit it.
  const mode: ObMode = W < 330 ? "tall" : H < 220 ? "land" : W / H >= 2.15 ? "wide" : "std";
  const party = Math.max(1, n);
  if (isCompact(mode)) {
    const m = 1, g = 2;
    const partyRows = party <= 3 ? 1 : Math.ceil(party / 2);
    const partyH = partyRows * CARD + (partyRows - 1) * g + 4;
    // The head line, and five skills on one page when the screen allows it (more than that page with a MORE row).
    const cmdWant = 15 + 5 * ROW;
    if (mode === "land") {
      const lw = Math.round((W - 2 * m - g) * 0.52), x = m + lw + g, rw = W - x - m;
      const keys = { x, y: H - m - ROW, w: rw, h: ROW };
      const pr = { x: m, y: H - m - partyH, w: lw, h: partyH };
      const view = { x: m, y: m, w: lw, h: pr.y - g - m };
      const cmd = { x, y: m, w: rw, h: keys.y - g - m };
      return finish({ u, W, H, mode, view, order: null, party: pr, cmd, keys }, party, CARD);
    }
    const fw = W - 2 * m;
    const keys = { x: m, y: H - m - ROW, w: fw, h: ROW };
    const room = keys.y - 2 * g - partyH - m;
    // The foes keep at least this much: enough to see them and to hit them.
    const viewMin = 76;
    const cmdH = Math.max(15 + 3 * ROW, Math.min(cmdWant, room - viewMin));
    const cmd = { x: m, y: keys.y - g - cmdH, w: fw, h: cmdH };
    const pr = { x: m, y: cmd.y - g - partyH, w: fw, h: partyH };
    const view = { x: m, y: m, w: fw, h: pr.y - g - m };
    return finish({ u, W, H, mode, view, order: null, party: pr, cmd, keys }, party, CARD);
  }
  const m = 6, g = 6;
  const keys = { x: m, y: H - m - 11, w: W - 2 * m, h: 11 };
  const ch = keys.y - g - m;
  // Left: the viewport over the party deck. Right: the prompt over the turn order.
  const lw = Math.round((W - 2 * m - g) * (mode === "wide" ? 0.68 : 0.64));
  const x = m + lw + g, rw = W - x - m;
  const rowH = mode === "wide" ? 54 : 56;
  const partyH = 17 + rowH + 3;
  const orderH = 17 + Math.min(8, Math.max(4, Math.floor((ch * 0.36 - 20) / 10))) * 10 + 3;
  return finish({
    u, W, H, mode, keys,
    view: { x: m, y: m, w: lw, h: ch - partyH - g },
    party: { x: m, y: m + ch - partyH, w: lw, h: partyH },
    cmd: { x, y: m, w: rw, h: ch - orderH - g },
    order: { x, y: m + ch - orderH, w: rw, h: orderH },
  }, party, rowH);
}

function finish(o: Omit<ObLayout, "rows" | "pics" | "plateY">, n: number, rowH: number): ObLayout {
  const compact = isCompact(o.mode);
  const pi = compact ? { x: o.party.x + 2, y: o.party.y + 2, w: o.party.w - 4, h: o.party.h - 4 } : inner(o.party);
  const rows: FRect[] = [];
  const pics: FRect[] = [];
  if (compact) {
    const cols = n <= 3 ? n : 2, g = 2;
    const cw = Math.floor((pi.w - g * (cols - 1)) / cols);
    for (let i = 0; i < n; i += 1) {
      const r = { x: pi.x + (i % cols) * (cw + g), y: pi.y + Math.floor(i / cols) * (rowH + g), w: cw, h: rowH };
      rows.push(r);
      // No faces: a window with nothing in it, so the stage's bust stays out of the way.
      pics.push({ x: r.x + 1, y: r.y + 1, w: 2, h: 2 });
    }
    const vi = viewIn(o);
    return { ...o, rows, pics, plateY: vi.y + vi.h - 21 };
  }
  const gap = 3;
  const cw = Math.floor((pi.w - gap * (n - 1)) / n);
  for (let i = 0; i < n; i += 1) {
    const r = { x: pi.x + i * (cw + gap), y: pi.y + 1, w: cw, h: rowH };
    rows.push(r);
    const s = Math.min(rowH - 4, Math.floor(cw * 0.3));
    pics.push({ x: r.x + 2, y: r.y + 2, w: s, h: s });
  }
  const vi = inner(o.view);
  const plateY = vi.y + vi.h - 26;
  return { ...o, rows, pics, plateY };
}

/** The stage's layout (screen px) from the console's. */
export function stageLayout(w: number, h: number, n: number): ObStageLayout {
  const ob = obLayout(w, h, n);
  const u = ob.u;
  const px = (r: { x: number; y: number; w: number; h: number }): Rect => ({ x: r.x * u, y: r.y * u, w: r.w * u, h: r.h * u });
  const compact = isCompact(ob.mode);
  const vi = viewIn(ob);
  // The figures stand in the viewport's upper part, feet sinking into the dark band above the plates.
  // Below the message strip at the top of the view (console.ts CAP_H); on a phone it only lies over them while it speaks.
  // Headroom on a phone when it can be spared: a damage number rises off the figure's head and shouldn't leave the view.
  const top = vi.y + (compact ? (vi.h >= 100 ? 14 : 2) : 27);
  const pw = compact ? 0 : pillarW(vi.w);
  const area = { x: vi.x + pw, y: top, w: vi.w - 2 * pw, h: ob.plateY - top };
  const floorY = (ob.plateY - 2) * u;
  // The console paints the HUD itself: `ui` only sizes the numbers and tags that fly off the figures. 12px at least on a phone.
  const ui = compact ? 1.35 : Math.max(0.85, Math.min(1.35, u / 2.2));
  return {
    w, h, portrait: compact, ui,
    framed: true,
    enemyArea: px(area),
    floorY,
    timeline: px(ob.keys),
    party: px(ob.party),
    cards: ob.rows.map(px),
    menu: px(ob.cmd),
    banner: { x: (vi.x + vi.w / 2) * u, y: (vi.y + 20) * u },
    ob,
  };
}
