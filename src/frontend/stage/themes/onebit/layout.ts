/**
 * The 1-bit battle's layout, on the same virtual pixel grid as the scene's console (one virtual pixel = `u`
 * screen px; the art shader is set to the same cell, so figures, frames and type share one grid). The fight
 * keeps the scene's workstation: the viewport (the enemies standing in the dark, the battle messages printed
 * over it) with the party as a deck of three cards under it, the WHAT NOW? prompt over the turn order in the
 * right column, and the function-key strip along the bottom (the log, the next to act). Pure.
 */
import type { Rect as FRect } from "../../../scene/themes/onebit/fb.js";
import type { Rect, StageLayout } from "../../battle/layout.js";

export type ObMode = "wide" | "std" | "tall";

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

/** Virtual pixel size: about 290 rows, and never fewer than 190 columns (a phone). */
export function cellSize(w: number, h: number): number {
  return Math.max(2, Math.min(Math.floor(h / 290), Math.floor(w / 190)));
}

export function obLayout(w: number, h: number, n: number): ObLayout {
  const u = cellSize(w, h);
  const W = Math.max(120, Math.floor(w / u));
  const H = Math.max(120, Math.floor(h / u));
  const mode: ObMode = W < 330 ? "tall" : W / H >= 2.15 ? "wide" : "std";
  const party = Math.max(1, n);
  if (mode === "tall") {
    const m = 4, g = 5, fw = W - 2 * m;
    const keys = { x: m, y: H - m - 11, w: fw, h: 11 };
    // The party as three rows in a plain box (no title bar: every row of the phone counts).
    const rowH = 25;
    const partyH = 4 + n * rowH + (n - 1) * 2 + 4;
    const cmdH = Math.max(110, Math.min(150, Math.round(H * 0.33)));
    const cmd = { x: m, y: keys.y - g - cmdH, w: fw, h: cmdH };
    const pr = { x: m, y: cmd.y - g - partyH, w: fw, h: partyH };
    const view = { x: m, y: m, w: fw, h: pr.y - g - m };
    return finish({ u, W, H, mode, view, order: null, party: pr, cmd, keys }, party, rowH);
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
  const pi = o.mode === "tall" ? { x: o.party.x + 4, y: o.party.y + 3, w: o.party.w - 8, h: o.party.h - 6 } : inner(o.party);
  const rows: FRect[] = [];
  const pics: FRect[] = [];
  if (o.mode === "tall") {
    for (let i = 0; i < n; i += 1) {
      const r = { x: pi.x, y: pi.y + i * (rowH + 2), w: pi.w, h: rowH };
      rows.push(r);
      pics.push({ x: r.x + 1, y: r.y + 1, w: rowH - 2, h: rowH - 2 });
    }
    const vi = inner(o.view);
    return { ...o, rows, pics, plateY: vi.y + vi.h - 22 };
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
  const vi = inner(ob.view);
  // The figures stand in the viewport's upper part, feet sinking into the dark band above the plates.
  // Below the message strip at the top of the view (console.ts CAP_H).
  const top = vi.y + (ob.mode === "tall" ? 38 : 27);
  const pw = pillarW(vi.w);
  const area = { x: vi.x + pw, y: top, w: vi.w - 2 * pw, h: ob.plateY - top };
  const floorY = (ob.plateY - 2) * u;
  const ui = Math.max(0.85, Math.min(1.35, u / 2.2));
  return {
    w, h, portrait: ob.mode === "tall", ui,
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
