/**
 * Drawing helpers for the code-rendered UI (docs/DESIGN.md, 5.1: frames,
 * bars, typography are code, never generated). Chamfered panels with a thin
 * gold hairline, flat bars with a ghost drain, diamond pips, and small
 * status glyphs drawn as vector marks.
 */
import { FillGradient, Graphics } from "pixi.js";
import { C } from "./theme.js";

const gradients = new Map<string, FillGradient>();

/** A vertical gradient in shape-local space (cached by its stops). */
export function vgrad(top: number, bottom: number, topAlpha = 1, bottomAlpha = 1): FillGradient {
  const key = `${top}-${bottom}-${topAlpha}-${bottomAlpha}`;
  let g = gradients.get(key);
  if (!g) {
    g = new FillGradient({
      type: "linear",
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: colorWithAlpha(top, topAlpha) },
        { offset: 1, color: colorWithAlpha(bottom, bottomAlpha) },
      ],
      textureSpace: "local",
    });
    gradients.set(key, g);
  }
  return g;
}

function colorWithAlpha(color: number, alpha: number): string {
  return `rgba(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255},${alpha})`;
}

/** Points of a rectangle with its corners cut by `c`. */
export function chamferPoints(x: number, y: number, w: number, h: number, c: number): number[] {
  return [x + c, y, x + w - c, y, x + w, y + c, x + w, y + h - c, x + w - c, y + h, x + c, y + h, x, y + h - c, x, y + c];
}

export type PanelStyle = {
  fill?: number;
  fillBottom?: number;
  alpha?: number;
  line?: number;
  lineAlpha?: number;
  chamfer?: number;
  /** An inner hairline inset (the double-rule look of card frames). */
  inner?: boolean;
};

export function drawPanel(g: Graphics, x: number, y: number, w: number, h: number, s: PanelStyle = {}): Graphics {
  const c = s.chamfer ?? 6;
  const pts = chamferPoints(x, y, w, h, c);
  g.poly(pts).fill(vgrad(s.fill ?? C.panelHi, s.fillBottom ?? C.panel, s.alpha ?? 0.92, s.alpha ?? 0.92));
  g.poly(pts).stroke({ width: 1, color: s.line ?? C.line, alpha: s.lineAlpha ?? 0.9, alignment: 1 });
  if (s.inner) {
    g.poly(chamferPoints(x + 3, y + 3, w - 6, h - 6, Math.max(1, c - 2))).stroke({ width: 1, color: C.gold, alpha: 0.18, alignment: 1 });
  }
  return g;
}

/** A thin bar: track, ghost (recent loss), value, and a top highlight. */
export function drawBar(g: Graphics, x: number, y: number, w: number, h: number, value: number, ghost: number, color: number, hi: number, extra = 0, extraColor: number = C.shield): Graphics {
  const v = Math.max(0, Math.min(1, value));
  const gh = Math.max(v, Math.min(1, ghost));
  g.rect(x, y, w, h).fill({ color: 0x000000, alpha: 0.55 });
  if (gh > v) g.rect(x + w * v, y, w * (gh - v), h).fill({ color: C.hpGhost, alpha: 0.55 });
  if (v > 0) {
    g.rect(x, y, w * v, h).fill(vgrad(hi, color));
    g.rect(x, y, w * v, Math.max(1, h * 0.3)).fill({ color: 0xffffff, alpha: 0.12 });
  }
  if (extra > 0) {
    const e = Math.min(1, extra);
    g.rect(x, y - 2, w * e, 2).fill({ color: extraColor, alpha: 0.95 });
  }
  g.rect(x, y, w, h).stroke({ width: 1, color: 0x000000, alpha: 0.6, alignment: 1 });
  return g;
}

/** Diamond pips (poise): filled up to `value` of `max`. */
export function drawPips(g: Graphics, cx: number, y: number, value: number, max: number, size: number, color: number, broken = false): Graphics {
  const n = Math.max(0, Math.min(12, max));
  const step = size * 1.55;
  const x0 = cx - ((n - 1) * step) / 2;
  for (let i = 0; i < n; i += 1) {
    const x = x0 + i * step;
    const pts = [x, y - size / 2, x + size / 2, y, x, y + size / 2, x - size / 2, y];
    const on = i < value && !broken;
    g.poly(pts).fill({ color: on ? color : C.poiseEmpty, alpha: on ? 1 : 0.85 });
    g.poly(pts).stroke({ width: 1, color: broken ? C.break : 0x000000, alpha: broken ? 0.7 : 0.7 });
  }
  return g;
}

/** A small status glyph in a dark diamond-cornered tile. */
export function drawStatusGlyph(g: Graphics, glyph: string, x: number, y: number, s: number, color: number): Graphics {
  g.poly(chamferPoints(x, y, s, s, s * 0.22)).fill({ color: 0x0b0a09, alpha: 0.85 }).stroke({ width: 1, color, alpha: 0.85 });
  const cx = x + s / 2;
  const cy = y + s / 2;
  const r = s * 0.3;
  const line = { width: Math.max(1.2, s * 0.09), color, cap: "round" as const, join: "round" as const };
  switch (glyph) {
    case "drop":
      g.moveTo(cx, cy - r).quadraticCurveTo(cx + r, cy + r * 0.2, cx, cy + r).quadraticCurveTo(cx - r, cy + r * 0.2, cx, cy - r).fill({ color });
      break;
    case "flame":
      g.moveTo(cx, cy - r * 1.1).quadraticCurveTo(cx + r * 1.1, cy, cx, cy + r).quadraticCurveTo(cx - r * 1.1, cy, cx - r * 0.2, cy - r * 0.3).quadraticCurveTo(cx, cy - r * 0.2, cx, cy - r * 1.1).fill({ color });
      break;
    case "star":
      for (let i = 0; i < 3; i += 1) {
        const a = (i * Math.PI) / 3;
        g.moveTo(cx - Math.cos(a) * r, cy - Math.sin(a) * r).lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      g.stroke(line);
      break;
    case "spiral":
      g.arc(cx, cy, r, 0, Math.PI * 1.5).stroke(line);
      g.circle(cx, cy, r * 0.25).fill({ color });
      break;
    case "eye":
      g.moveTo(cx - r, cy).quadraticCurveTo(cx, cy - r, cx + r, cy).quadraticCurveTo(cx, cy + r, cx - r, cy).stroke(line);
      g.circle(cx, cy, r * 0.3).fill({ color });
      break;
    case "target":
      g.circle(cx, cy, r).stroke(line);
      g.circle(cx, cy, r * 0.3).fill({ color });
      break;
    case "crack":
      g.moveTo(cx - r * 0.2, cy - r).lineTo(cx + r * 0.25, cy - r * 0.2).lineTo(cx - r * 0.25, cy + r * 0.2).lineTo(cx + r * 0.2, cy + r).stroke(line);
      break;
    case "shield":
      g.moveTo(cx - r, cy - r * 0.7).lineTo(cx + r, cy - r * 0.7).lineTo(cx + r * 0.8, cy + r * 0.2).lineTo(cx, cy + r).lineTo(cx - r * 0.8, cy + r * 0.2).closePath().fill({ color, alpha: 0.9 });
      break;
    case "plus":
      g.moveTo(cx - r, cy).lineTo(cx + r, cy).moveTo(cx, cy - r).lineTo(cx, cy + r).stroke(line);
      break;
    case "up":
      g.moveTo(cx - r, cy + r * 0.5).lineTo(cx, cy - r * 0.6).lineTo(cx + r, cy + r * 0.5).stroke(line);
      break;
    case "down":
      g.moveTo(cx - r, cy - r * 0.5).lineTo(cx, cy + r * 0.6).lineTo(cx + r, cy - r * 0.5).stroke(line);
      break;
    default:
      g.moveTo(cx - r, cy).lineTo(cx + r, cy).stroke(line);
  }
  return g;
}
