/**
 * Placeholder art until generated art exists (docs/DESIGN.md, 5.7): every
 * figure, bust and battlefield is painted in code from a seed and a
 * palette, so the puppet always has something to warp and the game never
 * waits on art. Silhouettes, not faces: layered shapes with soft volume,
 * a cool rim light from the upper left, a warm accent (eyes, a sigil, an
 * edge), brush grain. Deterministic per seed.
 */
import { seededRng, type Rng } from "../../engine/dice.js";
import type { RigKind } from "../../engine/types.js";

type Ctx = CanvasRenderingContext2D;

const rgb = (c: number, a = 1): string => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
const shade = (c: number, k: number): number => {
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
  return (f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255);
};
const blend = (a: number, b: number, t: number): number => {
  const ch = (s: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};
const range = (rng: Rng, a: number, b: number): number => a + (b - a) * rng();

function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!];
}

let grainCanvas: HTMLCanvasElement | null = null;
/** A shared 256 px grain tile (soft value noise). */
function grain(): HTMLCanvasElement {
  if (grainCanvas) return grainCanvas;
  const [c, ctx] = canvas(256, 256);
  const img = ctx.createImageData(256, 256);
  const rng = seededRng("gambit-grain");
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + rng() * 145;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  grainCanvas = c;
  return c;
}

/** Overlay grain and short painterly strokes inside what is already drawn. */
function paintTexture(ctx: Ctx, w: number, h: number, rng: Rng, colors: number[], strokes = 140): void {
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = ctx.createPattern(grain(), "repeat")!;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  ctx.lineCap = "round";
  for (let i = 0; i < strokes; i += 1) {
    const x = rng() * w;
    const y = rng() * h;
    const len = range(rng, 6, 18) * (w / 512);
    const a = rng() * Math.PI;
    ctx.strokeStyle = rgb(colors[Math.floor(rng() * colors.length)]!, range(rng, 0.02, 0.06));
    ctx.lineWidth = range(rng, 3, 9) * (w / 512);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + 3, y + Math.sin(a) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.restore();
}

/** Rim light: a wide soft stroke of the silhouette kept on its lit (upper-left) side, inside it. */
function rimLight(ctx: Ctx, path: Path2D, w: number, h: number, color: number, width: number, strength = 0.85): void {
  const [mc, m] = canvas(w, h);
  m.lineJoin = "round";
  m.strokeStyle = rgb(color, strength);
  m.lineWidth = width;
  m.filter = `blur(${Math.max(1, width * 0.18)}px)`;
  m.stroke(path);
  m.filter = "none";
  // Keep only the side that faces the light.
  m.globalCompositeOperation = "destination-in";
  const g = m.createLinearGradient(w * 0.05, h * 0.05, w * 0.75, h * 0.6);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(0.55, "rgba(0,0,0,0.35)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  m.fillStyle = g;
  m.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.drawImage(mc, 0, 0);
  ctx.restore();
}

/** Soft volume: radial light and shadow pools inside the silhouette. */
function volume(ctx: Ctx, x: number, y: number, r: number, color: number, alpha: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgb(color, alpha));
  g.addColorStop(1, rgb(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

function glowDot(ctx: Ctx, x: number, y: number, r: number, color: number, alpha = 1): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
  g.addColorStop(0, rgb(shade(color, 0.6), alpha));
  g.addColorStop(0.18, rgb(color, alpha * 0.8));
  g.addColorStop(1, rgb(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
  ctx.restore();
}

export type FigurePalette = { base: number; mid: number; accent: number };

export function figurePalette(colors: number[]): FigurePalette {
  const base = colors[0] ?? 0x2a2420;
  return { base: shade(base, -0.35), mid: colors[1] ?? shade(base, 0.35), accent: colors[2] ?? colors[1] ?? 0xe8c47a };
}

/* ------------------------------------------------------------------------ */
/* Silhouettes                                                               */
/* ------------------------------------------------------------------------ */

/** A cloaked, hooded standing figure, feet at `foot`. */
function standingPath(w: number, h: number, rng: Rng): { path: Path2D; head: [number, number, number]; chest: [number, number]; hand: [number, number] } {
  const cx = w / 2 + range(rng, -6, 6);
  const top = h * range(rng, 0.06, 0.1);
  const foot = h * 0.97;
  const headR = w * range(rng, 0.085, 0.1);
  const headY = top + headR * 1.25;
  const shW = w * range(rng, 0.2, 0.27);
  const shY = headY + headR * 1.35;
  const hemW = w * range(rng, 0.25, 0.36);
  const waistW = shW * range(rng, 0.62, 0.78);
  const waistY = h * 0.52;
  const p = new Path2D();
  p.moveTo(cx, top);
  // Hood peak leaning a little, down to the shoulders.
  p.bezierCurveTo(cx + headR * 1.25, top + headR * 0.2, cx + headR * 1.35, headY + headR * 0.6, cx + headR * 1.05, shY - headR * 0.35);
  p.bezierCurveTo(cx + shW * 0.7, shY - headR * 0.2, cx + shW * 1.02, shY + headR * 0.1, cx + shW, shY + headR * 0.9);
  p.bezierCurveTo(cx + shW * 0.98, waistY - h * 0.08, cx + waistW, waistY - h * 0.02, cx + waistW * 1.02, waistY);
  // Cloak flares to a ragged hem.
  p.bezierCurveTo(cx + hemW * 0.9, h * 0.72, cx + hemW * 1.02, foot - h * 0.06, cx + hemW, foot);
  const teeth = 5 + Math.floor(rng() * 3);
  for (let i = 1; i <= teeth; i += 1) {
    const x = cx + hemW - (2 * hemW * i) / teeth;
    p.lineTo(x + (hemW / teeth) * 0.5, foot - h * range(rng, 0.0, 0.035));
    p.lineTo(x, foot - h * range(rng, -0.005, 0.01));
  }
  p.bezierCurveTo(cx - hemW * 1.02, foot - h * 0.06, cx - hemW * 0.9, h * 0.72, cx - waistW * 1.02, waistY);
  p.bezierCurveTo(cx - waistW, waistY - h * 0.02, cx - shW * 0.98, waistY - h * 0.08, cx - shW, shY + headR * 0.9);
  p.bezierCurveTo(cx - shW * 1.02, shY + headR * 0.1, cx - shW * 0.7, shY - headR * 0.2, cx - headR * 1.05, shY - headR * 0.35);
  p.bezierCurveTo(cx - headR * 1.3, headY + headR * 0.5, cx - headR * 0.9, top + headR * 0.1, cx, top);
  p.closePath();
  return { path: p, head: [cx, headY, headR], chest: [cx, shY + h * 0.08], hand: [cx + shW * 0.95, waistY - h * 0.02] };
}

/** A wraith: hood and shoulders thinning into tattered tails; no feet. */
function floatingPath(w: number, h: number, rng: Rng): { path: Path2D; head: [number, number, number]; chest: [number, number] } {
  const cx = w / 2;
  const top = h * 0.08;
  const headR = w * range(rng, 0.09, 0.105);
  const headY = top + headR * 1.3;
  const shW = w * range(rng, 0.26, 0.33);
  const shY = headY + headR * 1.5;
  const p = new Path2D();
  p.moveTo(cx, top);
  p.bezierCurveTo(cx + headR * 1.4, top + headR * 0.1, cx + headR * 1.5, headY + headR, cx + headR * 1.2, shY - headR * 0.4);
  p.bezierCurveTo(cx + shW * 0.8, shY - headR * 0.4, cx + shW * 1.15, shY + headR * 0.6, cx + shW * 1.05, shY + h * 0.12);
  const tails = 4 + Math.floor(rng() * 2);
  const bottom = h * 0.9;
  let prevX = cx + shW * 1.05;
  for (let i = 0; i < tails; i += 1) {
    const x0 = cx + shW * (0.9 - (1.8 * (i + 0.5)) / tails);
    const tipY = bottom - h * range(rng, 0, 0.12);
    const tipX = x0 + range(rng, -w * 0.03, w * 0.05);
    p.quadraticCurveTo(prevX - w * 0.02, (shY + tipY) * 0.55, tipX, tipY);
    const nx = cx + shW * (0.9 - (1.8 * (i + 1)) / tails);
    p.quadraticCurveTo(tipX - w * 0.01, tipY - h * 0.2, nx, h * range(rng, 0.62, 0.7));
    prevX = nx;
  }
  p.bezierCurveTo(cx - shW * 1.1, h * 0.5, cx - shW * 1.15, shY + headR * 0.6, cx - shW * 0.8, shY - headR * 0.4);
  p.bezierCurveTo(cx - headR * 1.2, shY - headR * 0.4, cx - headR * 1.5, headY + headR, cx, top);
  p.closePath();
  return { path: p, head: [cx, headY, headR], chest: [cx, shY + h * 0.06] };
}

/** A coiled serpent rising from the floor: the body as a tapered spine. */
function serpentPath(w: number, h: number, rng: Rng): { path: Path2D; head: [number, number, number]; chest: [number, number] } {
  const pts: Array<[number, number, number]> = [];
  const n = 40;
  const amp = w * range(rng, 0.16, 0.22);
  const turns = range(rng, 1.1, 1.5);
  const dir = rng() < 0.5 ? 1 : -1;
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const y = h * (0.95 - 0.78 * t);
    const x = w / 2 + dir * amp * Math.sin(t * Math.PI * turns) * (1 - 0.55 * t) + (t > 0.85 ? dir * w * 0.04 * (t - 0.85) * 6 : 0);
    // Thick at the coil, tapering up the neck, swelling into a frilled head.
    const r = w * (0.17 - 0.1 * t) + (t > 0.84 ? w * 0.085 * Math.sin(((t - 0.84) / 0.16) * Math.PI) : 0);
    pts.push([x, y, r]);
  }
  const p = new Path2D();
  const side = (sign: number) => pts.map(([x, y, r], i) => {
    const [x2, y2] = pts[Math.min(n, i + 1)]!;
    const [x1, y1] = pts[Math.max(0, i - 1)]!;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    return [x + (-dy / len) * r * sign, y + (dx / len) * r * sign] as [number, number];
  });
  const left = side(1);
  const right = side(-1).reverse();
  p.moveTo(left[0]![0], left[0]![1]);
  for (const [x, y] of left) p.lineTo(x, y);
  const [hx, hy, hr] = pts[n]!;
  p.quadraticCurveTo(hx + dir * hr * 1.4, hy - hr * 1.6, right[0]![0], right[0]![1]);
  for (const [x, y] of right) p.lineTo(x, y);
  p.closePath();
  // The coil the body rises from, wound the same way as the body (so the
  // nonzero fill unites them instead of cutting holes).
  const poly = [...left, ...right];
  let area = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const [x0, y0] = poly[i]!;
    const [x1, y1] = poly[(i + 1) % poly.length]!;
    area += x0 * y1 - x1 * y0;
  }
  const ccw = area < 0;
  p.moveTo(w / 2 + w * 0.36, h * 0.93);
  p.ellipse(w / 2, h * 0.93, w * 0.36, h * 0.05, 0, 0, Math.PI * 2, ccw);
  p.moveTo(w / 2 - dir * w * 0.08 + w * 0.26, h * 0.885);
  p.ellipse(w / 2 - dir * w * 0.08, h * 0.885, w * 0.26, h * 0.04, 0, 0, Math.PI * 2, ccw);
  const [cx, cy] = pts[Math.round(n * 0.55)]!;
  return { path: p, head: [hx, hy, hr], chest: [cx, cy] };
}

/** A towering horned bust that runs past the bottom of the frame. */
function hugePath(w: number, h: number, rng: Rng): { path: Path2D; head: [number, number, number]; chest: [number, number] } {
  const cx = w / 2;
  const headR = w * range(rng, 0.095, 0.115);
  const headY = h * 0.3;
  const shW = w * range(rng, 0.42, 0.48);
  const shY = headY + headR * 1.9;
  const hornL = range(rng, 0.9, 1.3);
  const p = new Path2D();
  p.moveTo(cx - headR * 0.6, headY - headR * 0.9);
  // Horns sweep up and out.
  p.bezierCurveTo(cx - headR * 1.6, headY - headR * 1.6, cx - headR * 2.6 * hornL, headY - headR * 3.4 * hornL, cx - headR * 1.9 * hornL, headY - headR * 4.1 * hornL);
  p.bezierCurveTo(cx - headR * 2.2, headY - headR * 2.4, cx - headR * 1.4, headY - headR * 1.4, cx - headR * 1.1, headY - headR * 0.2);
  p.bezierCurveTo(cx - headR * 1.25, headY + headR, cx - headR * 1.6, shY - headR * 0.6, cx - shW * 0.7, shY - headR * 0.3);
  p.bezierCurveTo(cx - shW * 1.05, shY - headR * 0.1, cx - shW * 1.1, shY + h * 0.2, cx - shW * 1.08, h + 4);
  p.lineTo(cx + shW * 1.08, h + 4);
  p.bezierCurveTo(cx + shW * 1.1, shY + h * 0.2, cx + shW * 1.05, shY - headR * 0.1, cx + shW * 0.7, shY - headR * 0.3);
  p.bezierCurveTo(cx + headR * 1.6, shY - headR * 0.6, cx + headR * 1.25, headY + headR, cx + headR * 1.1, headY - headR * 0.2);
  p.bezierCurveTo(cx + headR * 1.4, headY - headR * 1.4, cx + headR * 2.2, headY - headR * 2.4, cx + headR * 1.9 * hornL, headY - headR * 4.1 * hornL);
  p.bezierCurveTo(cx + headR * 2.6 * hornL, headY - headR * 3.4 * hornL, cx + headR * 1.6, headY - headR * 1.6, cx + headR * 0.6, headY - headR * 0.9);
  p.quadraticCurveTo(cx, headY - headR * 1.3, cx - headR * 0.6, headY - headR * 0.9);
  p.closePath();
  return { path: p, head: [cx, headY, headR], chest: [cx, shY + h * 0.14] };
}

/* ------------------------------------------------------------------------ */
/* Figures                                                                   */
/* ------------------------------------------------------------------------ */

export const FIGURE_SIZE: Readonly<Record<RigKind, [number, number]>> = {
  standing: [512, 768],
  floating: [512, 768],
  serpentine: [512, 768],
  huge: [720, 720],
};

/** A full-body figure (transparent) for the puppet. */
export function paintFigure(seed: string, kind: RigKind, colors: number[]): HTMLCanvasElement {
  const rng = seededRng(`figure:${seed}`);
  const pal = figurePalette(colors);
  const [w, h] = FIGURE_SIZE[kind];
  const [c, ctx] = canvas(w, h);
  const shape = kind === "floating" ? floatingPath(w, h, rng)
    : kind === "serpentine" ? serpentPath(w, h, rng)
    : kind === "huge" ? hugePath(w, h, rng)
    : standingPath(w, h, rng);
  const { path, head, chest } = shape;

  // Body: dark base, lighter toward the upper body.
  const body = ctx.createLinearGradient(0, h * 0.1, 0, h);
  body.addColorStop(0, rgb(shade(pal.base, 0.22)));
  body.addColorStop(0.45, rgb(pal.base));
  body.addColorStop(1, rgb(shade(pal.base, -0.45)));
  ctx.fillStyle = body;
  ctx.fill(path);

  // Volume: a lit chest and shoulders, a shadowed hood, a dark core.
  volume(ctx, chest[0] - w * 0.06, chest[1] - h * 0.02, w * 0.3, pal.mid, 0.45);
  volume(ctx, head[0] - head[2] * 0.4, head[1] - head[2] * 0.5, head[2] * 2.2, shade(pal.mid, 0.2), 0.35);
  volume(ctx, chest[0] + w * 0.12, h * 0.75, w * 0.35, 0x000000, 0.45);
  // Folds: long dark strokes down the cloak.
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.filter = "blur(3px)";
  for (let i = 0; i < 5; i += 1) {
    const x = chest[0] + range(rng, -w * 0.22, w * 0.22);
    ctx.strokeStyle = rgb(0x000000, range(rng, 0.18, 0.32));
    ctx.lineWidth = range(rng, 6, 14);
    ctx.beginPath();
    ctx.moveTo(x, chest[1] + range(rng, 0, h * 0.1));
    ctx.bezierCurveTo(x + range(rng, -20, 20), h * 0.6, x + range(rng, -30, 30), h * 0.8, x + range(rng, -40, 40), h);
    ctx.stroke();
  }
  ctx.filter = "none";
  ctx.restore();

  paintTexture(ctx, w, h, rng, [pal.mid, shade(pal.base, -0.5), shade(pal.mid, 0.3)], 220);
  rimLight(ctx, path, w, h, shade(pal.mid, 0.45), w * 0.02, 0.6);
  rimLight(ctx, path, w, h, pal.accent, w * 0.008, 0.45);
  if (kind !== "serpentine") {
    // The face is a void under the hood (after the rim, so it stays dark).
    volume(ctx, head[0] + head[2] * 0.1, head[1] + head[2] * 0.3, head[2] * 0.95, 0x030202, 1);
    volume(ctx, head[0] + head[2] * 0.1, head[1] + head[2] * 0.3, head[2] * 0.7, 0x030202, 0.9);
  }

  // Accents: eyes in the dark, a sigil glow on the chest, a blade for the standing.
  const eyeY = head[1] + head[2] * (kind === "serpentine" ? -0.1 : 0.2);
  const eyeDX = head[2] * (kind === "huge" ? 0.42 : 0.34);
  const eyeR = Math.max(2, head[2] * 0.075);
  glowDot(ctx, head[0] - eyeDX + head[2] * 0.12, eyeY, eyeR, pal.accent, 0.95);
  glowDot(ctx, head[0] + eyeDX + head[2] * 0.12, eyeY, eyeR, pal.accent, 0.95);
  if (rng() < 0.7 && kind !== "serpentine") glowDot(ctx, chest[0], chest[1] + h * 0.03, w * 0.012, pal.accent, 0.35);
  if (kind === "standing" && "hand" in shape) {
    const [hx, hy] = (shape as { hand: [number, number] }).hand;
    ctx.save();
    ctx.lineCap = "round";
    const bladeTop: [number, number] = [hx + w * 0.12, hy - h * 0.38];
    const g = ctx.createLinearGradient(hx, hy, bladeTop[0], bladeTop[1]);
    g.addColorStop(0, rgb(shade(pal.base, -0.3)));
    g.addColorStop(1, rgb(shade(pal.mid, 0.5), 0.95));
    ctx.strokeStyle = g;
    ctx.lineWidth = w * 0.018;
    ctx.beginPath();
    ctx.moveTo(hx - w * 0.02, hy + h * 0.08);
    ctx.lineTo(bladeTop[0], bladeTop[1]);
    ctx.stroke();
    ctx.strokeStyle = rgb(shade(pal.accent, 0.4), 0.5);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(hx + w * 0.01, hy - h * 0.02);
    ctx.lineTo(bladeTop[0] - 1, bladeTop[1] + 2);
    ctx.stroke();
    ctx.restore();
  }
  if (kind === "floating") {
    // The tails fade into nothing.
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    const fade = ctx.createLinearGradient(0, h * 0.55, 0, h * 0.92);
    fade.addColorStop(0, "rgba(0,0,0,0)");
    fade.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, h * 0.5, w, h * 0.5);
    ctx.restore();
  }
  return c;
}

/* ------------------------------------------------------------------------ */
/* Busts (party cards, timeline chips, cut-ins)                              */
/* ------------------------------------------------------------------------ */

const SKIN = [0xc79f84, 0xa77a5e, 0x8a5f46, 0xd8b59b, 0x6e4a38];

/** A head-and-shoulders portrait, cut by the bottom edge, transparent. Faces are lit planes, not features. */
export function paintBust(seed: string, colors: number[], size = 512): HTMLCanvasElement {
  const rng = seededRng(`bust:${seed}`);
  const pal = figurePalette(colors);
  const w = size;
  const h = size;
  const [c, ctx] = canvas(w, h);
  const cx = w * 0.5 + range(rng, -w * 0.03, w * 0.03);
  const headR = w * 0.15;
  const headY = h * 0.38;
  const style = Math.floor(rng() * 3); // 0 hood, 1 long hair, 2 high collar and short hair
  const skin = SKIN[Math.floor(rng() * SKIN.length)]!;

  // Shoulders and cloak.
  const shoulders = new Path2D();
  shoulders.moveTo(cx - w * 0.5, h + 2);
  shoulders.bezierCurveTo(cx - w * 0.48, h * 0.78, cx - w * 0.36, h * 0.66, cx - headR * 0.9, h * 0.62);
  shoulders.lineTo(cx + headR * 0.9, h * 0.62);
  shoulders.bezierCurveTo(cx + w * 0.36, h * 0.66, cx + w * 0.48, h * 0.78, cx + w * 0.5, h + 2);
  shoulders.closePath();
  const cloak = ctx.createLinearGradient(0, h * 0.6, 0, h);
  cloak.addColorStop(0, rgb(shade(pal.base, 0.25)));
  cloak.addColorStop(1, rgb(shade(pal.base, -0.4)));
  ctx.fillStyle = cloak;
  ctx.fill(shoulders);

  // Hair behind the head.
  const hairColor = shade(pal.base, range(rng, -0.4, 0.1));
  if (style === 1) {
    ctx.fillStyle = rgb(hairColor);
    ctx.beginPath();
    ctx.ellipse(cx, headY + headR * 0.6, headR * 1.3, headR * 2.0, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Neck and face: a lit plane on the left, falling into shadow on the right.
  ctx.fillStyle = rgb(shade(skin, -0.45));
  ctx.fillRect(cx - headR * 0.38, headY + headR * 0.5, headR * 0.76, headR * 1.2);
  // Face: a tapered oval (brow wide, jaw narrow), lit from the upper left.
  const face = new Path2D();
  face.moveTo(cx, headY - headR * 1.02);
  face.bezierCurveTo(cx + headR * 0.62, headY - headR * 1.0, cx + headR * 0.84, headY - headR * 0.3, cx + headR * 0.74, headY + headR * 0.25);
  face.bezierCurveTo(cx + headR * 0.62, headY + headR * 0.75, cx + headR * 0.25, headY + headR * 1.08, cx, headY + headR * 1.1);
  face.bezierCurveTo(cx - headR * 0.25, headY + headR * 1.08, cx - headR * 0.62, headY + headR * 0.75, cx - headR * 0.74, headY + headR * 0.25);
  face.bezierCurveTo(cx - headR * 0.84, headY - headR * 0.3, cx - headR * 0.62, headY - headR * 1.0, cx, headY - headR * 1.02);
  const fg = ctx.createLinearGradient(cx - headR * 0.9, headY - headR * 0.6, cx + headR * 0.9, headY + headR * 0.4);
  fg.addColorStop(0, rgb(shade(skin, 0.05)));
  fg.addColorStop(0.4, rgb(shade(skin, -0.12)));
  fg.addColorStop(0.62, rgb(shade(skin, -0.5)));
  fg.addColorStop(1, rgb(shade(skin, -0.78)));
  ctx.fillStyle = fg;
  ctx.fill(face);
  ctx.save();
  ctx.clip(face);
  const soft = (x: number, y: number, rx: number, ry: number, color: number, alpha: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    g.addColorStop(0, rgb(color, alpha));
    g.addColorStop(1, rgb(color, 0));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry));
    ctx.translate(-x, -y);
    ctx.fillStyle = g;
    ctx.fillRect(x - Math.max(rx, ry), y - Math.max(rx, ry), Math.max(rx, ry) * 2, Math.max(rx, ry) * 2);
    ctx.restore();
  };
  const dark = shade(skin, -0.82);
  // Shadow from the hood or hair across the brow.
  const top = ctx.createLinearGradient(0, headY - headR, 0, headY - headR * 0.2);
  top.addColorStop(0, rgb(dark, 0.85));
  top.addColorStop(1, rgb(dark, 0));
  ctx.fillStyle = top;
  ctx.fillRect(cx - headR, headY - headR * 1.1, headR * 2, headR);
  // Eye sockets, the far one deeper; a nose shadow on the dark side; the jaw falls away.
  soft(cx - headR * 0.33, headY - headR * 0.05, headR * 0.26, headR * 0.15, dark, 0.7);
  soft(cx + headR * 0.33, headY - headR * 0.05, headR * 0.26, headR * 0.15, dark, 0.85);
  soft(cx + headR * 0.1, headY + headR * 0.38, headR * 0.12, headR * 0.22, dark, 0.45);
  soft(cx - headR * 0.4, headY + headR * 0.32, headR * 0.28, headR * 0.2, shade(skin, 0.2), 0.35);
  ctx.strokeStyle = rgb(dark, 0.35);
  ctx.lineWidth = headR * 0.035;
  ctx.beginPath();
  ctx.moveTo(cx - headR * 0.16, headY + headR * 0.66);
  ctx.quadraticCurveTo(cx, headY + headR * 0.7, cx + headR * 0.14, headY + headR * 0.65);
  ctx.stroke();
  const jaw = ctx.createLinearGradient(0, headY + headR * 0.6, 0, headY + headR * 1.1);
  jaw.addColorStop(0, rgb(dark, 0));
  jaw.addColorStop(1, rgb(dark, 0.6));
  ctx.fillStyle = jaw;
  ctx.fillRect(cx - headR, headY + headR * 0.6, headR * 2, headR * 0.6);
  ctx.restore();
  // Catchlights: one sharp on the lit eye, one faint in the shadowed one.
  glowDot(ctx, cx - headR * 0.3, headY - headR * 0.04, Math.max(1, headR * 0.022), shade(pal.accent, 0.5), 0.5);
  glowDot(ctx, cx + headR * 0.34, headY - headR * 0.04, Math.max(1, headR * 0.016), shade(pal.accent, 0.3), 0.2);

  // Headwear.
  if (style === 0) {
    const hood = new Path2D();
    hood.moveTo(cx - headR * 1.35, h * 0.66);
    hood.bezierCurveTo(cx - headR * 1.55, headY - headR * 0.6, cx - headR * 0.9, headY - headR * 1.65, cx + headR * 0.2, headY - headR * 1.55);
    hood.bezierCurveTo(cx + headR * 1.3, headY - headR * 1.3, cx + headR * 1.55, headY, cx + headR * 1.35, h * 0.66);
    hood.lineTo(cx + headR * 0.8, h * 0.64);
    hood.bezierCurveTo(cx + headR * 1.0, headY, cx + headR * 0.6, headY - headR * 1.0, cx, headY - headR * 1.05);
    hood.bezierCurveTo(cx - headR * 0.65, headY - headR * 1.0, cx - headR * 1.0, headY, cx - headR * 0.8, h * 0.64);
    hood.closePath();
    const hg = ctx.createLinearGradient(cx - headR * 1.5, 0, cx + headR * 1.5, 0);
    hg.addColorStop(0, rgb(shade(pal.mid, 0.05)));
    hg.addColorStop(1, rgb(shade(pal.base, -0.2)));
    ctx.fillStyle = hg;
    ctx.fill(hood);
  } else {
    const hair = new Path2D();
    hair.moveTo(cx - headR * 0.92, headY + headR * (style === 1 ? 0.9 : 0.1));
    hair.bezierCurveTo(cx - headR * 1.1, headY - headR * 1.3, cx + headR * 0.5, headY - headR * 1.55, cx + headR * 0.95, headY - headR * 0.4);
    hair.bezierCurveTo(cx + headR * 0.5, headY - headR * 0.9, cx - headR * 0.2, headY - headR * 0.75, cx - headR * 0.55, headY - headR * 0.35);
    hair.quadraticCurveTo(cx - headR * 0.75, headY + headR * 0.1, cx - headR * 0.92, headY + headR * (style === 1 ? 0.9 : 0.1));
    ctx.fillStyle = rgb(hairColor);
    ctx.fill(hair);
    if (style === 2) {
      const collar = new Path2D();
      collar.moveTo(cx - headR * 1.2, h * 0.64);
      collar.lineTo(cx - headR * 0.95, headY + headR * 0.55);
      collar.lineTo(cx - headR * 0.4, h * 0.66);
      collar.moveTo(cx + headR * 1.2, h * 0.64);
      collar.lineTo(cx + headR * 0.95, headY + headR * 0.55);
      collar.lineTo(cx + headR * 0.4, h * 0.66);
      ctx.fillStyle = rgb(shade(pal.mid, -0.1));
      ctx.fill(collar);
    }
  }
  // A clasp or pauldron catches the accent.
  glowDot(ctx, cx + range(rng, -headR * 0.4, headR * 0.4), h * 0.7, w * 0.008, pal.accent, 0.6);
  const all = new Path2D();
  all.addPath(shoulders);
  all.ellipse(cx, headY, headR * 1.2, headR * 1.4, 0, 0, Math.PI * 2);
  paintTexture(ctx, w, h, rng, [pal.mid, shade(pal.base, -0.5), skin], 160);
  rimLight(ctx, all, w, h, shade(pal.mid, 0.6), w * 0.03, 0.6);
  return c;
}

/* ------------------------------------------------------------------------ */
/* Battlefield                                                               */
/* ------------------------------------------------------------------------ */

/** A moody battlefield plate: fog, far ruins, a floor, a light shaft, vignette, grain. `floor` is the floor line (0..1 of h). */
export function paintBackground(seed: string, colors: number[], w = 1280, h = 960, floor = 0.62): HTMLCanvasElement {
  return paintBattlefield(seed, colors, w, h, floor).color;
}

/**
 * The battlefield plate and its depth map (white near, black far), painted
 * in one pass so they line up. The stage displaces the plate by the depth
 * as the pointer moves: near pillars slide more than the far ones.
 */
export function paintBattlefield(seed: string, colors: number[], w = 1280, h = 960, floor = 0.62): { color: HTMLCanvasElement; depth: HTMLCanvasElement } {
  const rng = seededRng(`plate:${seed}`);
  const pal = figurePalette(colors);
  const [c, ctx] = canvas(w, h);
  const [rawDepth, dctx] = canvas(w, h);
  const gray = (v: number) => {
    const n = Math.round(Math.max(0, Math.min(1, v)) * 255);
    return `rgb(${n},${n},${n})`;
  };
  // Sky and far fog: the farthest plane.
  dctx.fillStyle = gray(0.12);
  dctx.fillRect(0, 0, w, h);
  // A desaturated, cool-shifted horizon tone from the region's mid colour.
  const fogTone = blend(shade(pal.mid, -0.6), 0x2c3236, 0.45);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, rgb(shade(pal.base, -0.8)));
  sky.addColorStop(floor * 0.7, rgb(shade(fogTone, -0.35)));
  sky.addColorStop(floor, rgb(fogTone));
  sky.addColorStop(1, rgb(shade(pal.base, -0.85)));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Far architecture in three fog layers: arches and broken pillars.
  for (let layer = 0; layer < 3; layer += 1) {
    const depth = 1 - layer / 3;
    // Far layers sit in the fog; near ones are dark silhouettes against it.
    const tone = blend(fogTone, 0x050404, 0.3 + layer * 0.25);
    ctx.fillStyle = rgb(tone, 0.7 + layer * 0.12);
    const baseY = h * floor;
    const count = 4 + layer * 2;
    for (let i = 0; i < count; i += 1) {
      const x = ((i + rng() * 0.6) / count) * w * 1.1 - w * 0.05;
      const pw = w * range(rng, 0.025, 0.05) * (1.4 - depth * 0.5);
      const ph = h * range(rng, 0.25, 0.55) * (0.6 + depth * 0.5);
      ctx.fillRect(x, baseY - ph, pw, ph);
      // Far layer 0.3, near layer 0.62 (the floor at their feet is ~0.35).
      dctx.fillStyle = gray(0.3 + layer * 0.16);
      dctx.fillRect(x, baseY - ph, pw, ph);
      if (rng() < 0.5) {
        ctx.beginPath();
        ctx.arc(x + pw * 2.4, baseY - ph, pw * 2.4, Math.PI, 0);
        ctx.lineWidth = pw * 0.6;
        ctx.strokeStyle = rgb(tone, 0.7 + layer * 0.12);
        ctx.stroke();
        dctx.beginPath();
        dctx.arc(x + pw * 2.4, baseY - ph, pw * 2.4, Math.PI, 0);
        dctx.lineWidth = pw * 0.6;
        dctx.strokeStyle = gray(0.3 + layer * 0.16);
        dctx.stroke();
      }
    }
    const fog = ctx.createLinearGradient(0, h * (floor - 0.35), 0, h * floor);
    fog.addColorStop(0, rgb(fogTone, 0));
    fog.addColorStop(1, rgb(shade(fogTone, 0.15), 0.3));
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, w, h * floor);
  }

  // Floor: a darker plane with a few receding seams.
  const fl = ctx.createLinearGradient(0, h * floor, 0, h);
  fl.addColorStop(0, rgb(shade(fogTone, -0.25)));
  fl.addColorStop(1, rgb(shade(pal.base, -0.9)));
  ctx.fillStyle = fl;
  ctx.fillRect(0, h * floor, w, h * (1 - floor));
  // The floor recedes: far at the horizon, nearest at the bottom edge.
  const fd = dctx.createLinearGradient(0, h * floor, 0, h);
  fd.addColorStop(0, gray(0.35));
  fd.addColorStop(1, gray(1));
  dctx.fillStyle = fd;
  dctx.fillRect(0, h * floor, w, h * (1 - floor));
  ctx.strokeStyle = rgb(shade(pal.mid, -0.2), 0.12);
  ctx.lineWidth = 1;
  for (let i = -6; i <= 6; i += 1) {
    ctx.beginPath();
    ctx.moveTo(w / 2 + i * w * 0.04, h * floor);
    ctx.lineTo(w / 2 + i * w * 0.3, h);
    ctx.stroke();
  }
  for (let i = 1; i < 6; i += 1) {
    const y = h * floor + (h * (1 - floor)) * (i / 6) ** 1.8;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // A shaft of light from above, and a horizon glow in the accent.
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const sx = w * range(rng, 0.3, 0.7);
  const shaft = ctx.createLinearGradient(sx, 0, sx + w * 0.1, h * floor);
  shaft.addColorStop(0, rgb(blend(fogTone, 0xfff4e0, 0.4), 0.16));
  shaft.addColorStop(1, rgb(fogTone, 0));
  ctx.fillStyle = shaft;
  ctx.beginPath();
  ctx.moveTo(sx - w * 0.05, 0);
  ctx.lineTo(sx + w * 0.07, 0);
  ctx.lineTo(sx + w * 0.22, h * floor * 1.05);
  ctx.lineTo(sx - w * 0.12, h * floor * 1.05);
  ctx.closePath();
  ctx.fill();
  const glow = ctx.createRadialGradient(w / 2, h * floor, 0, w / 2, h * floor, w * 0.6);
  glow.addColorStop(0, rgb(pal.accent, 0.12));
  glow.addColorStop(1, rgb(pal.accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Dust motes.
  for (let i = 0; i < 70; i += 1) {
    ctx.fillStyle = rgb(shade(pal.mid, 0.5), range(rng, 0.05, 0.25));
    ctx.beginPath();
    ctx.arc(rng() * w, rng() * h * floor, range(rng, 0.6, 1.8), 0, Math.PI * 2);
    ctx.fill();
  }

  // Grain and vignette.
  ctx.globalAlpha = 0.06;
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = ctx.createPattern(grain(), "repeat")!;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  const vig = ctx.createRadialGradient(w / 2, h * 0.45, h * 0.25, w / 2, h * 0.5, h * 0.95);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.75)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  // Soften the depth edges: hard steps tear the plate when it is displaced.
  const [depth, blurred] = canvas(w, h);
  blurred.filter = `blur(${Math.round(w / 160)}px)`;
  blurred.drawImage(rawDepth, 0, 0);
  blurred.filter = "none";
  return { color: c, depth };
}
