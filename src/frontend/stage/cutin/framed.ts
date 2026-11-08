/**
 * The framed cut-in (docs/DESIGN.md, 5.4) for a painted action splash on an ultimate. About 4.3 s; a tap or click
 * skips it. Beats (seconds), each with its slot's sheet and sound from assets/ (fx-library.ts, src/shared/fx.ts):
 *   0.00  hard cut to a grey flash with thin needles raining down the middle; it drains to black by 0.33
 *         (cutin.shut);
 *   0.45  a forked bolt crawls up from the bottom edge (cutin.crack); 0.72 a blue lightning web flashes over the
 *         whole black in three steps, densest across the middle, white-hot at its joints, and holds, flickering
 *         (cutin.crack again, cut short at the break);
 *   1.38  the black breaks into chunks blown past the camera, a star flash on the break (cutin.shatter, with the
 *         cutin.glint sound for the glassy top); behind them a blue speed-line backdrop (cutin.speed sheet, else
 *         drawn) races at -15 deg;
 *   1.42  the picture bursts through from 185% with its colour channels split and a smear (cutin.rush), locking
 *         at 1.74 (cutin.slam) under a quiet aura bed (cutin.aura); lines and needles stream over it;
 *   1.69  the skill name slams down the left as one stacked block landing on the lock, words 1.5 frames apart, each
 *         with a cyan/magenta split snapping shut (cutin.stamp, on the lock); then the fighter's name slams across
 *         the bottom with a lingering chromatic split (cutin.glint);
 *   hold  the picture trembles and pushes in slowly; a flare pulses on the action;
 *   3.72  the picture whips toward the camera, blurring, into a white burst (cutin.whiteout and cutin.burst, then
 *         cutin.shut softly under it); the name blows out with it; black needles strobe through the white, which
 *         clears back to the battle by 4.27.
 * The web and the lines stay blue (the house look of the move); the flare takes the picture's own dominant hue.
 * Inlay's cut-in guideline puts the face in the upper-left third and the move reaching out right of centre, which
 * is where the flare sits by default. With no assets loaded every beat still plays from code, silently.
 */
import { BlurFilter, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { ease } from "../anim.js";
import { FONT_UI, mixColor, textStyle } from "../theme.js";
import { buildFx, resolveFx, type FxContext } from "./fx.js";
import type { CutInOptions } from "./cutin.js";
import { fxLibrary, type SoundHandle } from "../fx-library.js";
import type { FxSlot } from "../../../shared/fx.js";

/** The beats (seconds from the start). */
const T = {
  grey: 0.1, black: 0.33, bolt: 0.45, web: 0.72, shatter: 1.38, slam: 1.42, lock: 1.74,
  stamp: 1.69, wordGap: 0.05, exit: 3.72, white: 3.94, clear: 4.04, end: 4.27,
};
export const FRAMED_SECONDS = T.end;

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const span = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a));
const HEAVY = `"Arial Black", "Segoe UI Black", "Helvetica Neue", Impact, ${FONT_UI}, sans-serif`;
/** The move's house colours: the lightning web and the speed lines. */
const BLUE = { wide: 0x1144ff, body: 0x2277ff, deep: 0x000a24, lines: [0x0055cc, 0x00aaff, 0x66ffff, 0xffffff] };

/** A deterministic random stream (the same cut-in looks the same each time). */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hsl(h: number, s: number, l: number): number {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return (Math.round((r + m) * 255) << 16) | (Math.round((g + m) * 255) << 8) | Math.round((b + m) * 255);
}

export type CutinPalette = { mid: number; outer: number; hi: number; deep: number };
const palettes = new WeakMap<object, CutinPalette>();
/** The picture's dominant saturated hue, as a triad: hot mid glow, a hue-shifted outer wash, a highlight, a deep shade. */
export function paletteFromArt(tex: Texture): CutinPalette {
  const key = tex.source as object;
  const known = palettes.get(key);
  if (known) return known;
  let hue = 340;
  try {
    const res = (tex.source as { resource?: CanvasImageSource }).resource;
    if (res) {
      const c = document.createElement("canvas");
      c.width = 48;
      c.height = 33;
      const g = c.getContext("2d", { willReadFrequently: true })!;
      g.drawImage(res, 0, 0, 48, 33);
      const d = g.getImageData(0, 0, 48, 33).data;
      const bins = new Array<number>(36).fill(0);
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i]! / 255, gg = d[i + 1]! / 255, b = d[i + 2]! / 255;
        const max = Math.max(r, gg, b), min = Math.min(r, gg, b);
        const l = (max + min) / 2;
        const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
        if (s < 0.35 || l < 0.15 || l > 0.85) continue;
        let h = max === r ? ((gg - b) / (max - min)) % 6 : max === gg ? (b - r) / (max - min) + 2 : (r - gg) / (max - min) + 4;
        h = (h * 60 + 360) % 360;
        bins[Math.floor(h / 10) % 36]! += s * (1 - Math.abs(l - 0.5));
      }
      let best = 0;
      for (let i = 1; i < 36; i++) if (bins[i]! + bins[(i + 35) % 36]! * 0.5 + bins[(i + 1) % 36]! * 0.5 > bins[best]! + bins[(best + 35) % 36]! * 0.5 + bins[(best + 1) % 36]! * 0.5) best = i;
      if (bins.some((v) => v > 0)) hue = best * 10 + 5;
    }
  } catch {
    // A tainted or unreadable picture: keep the default crimson.
  }
  const p = { mid: hsl(hue, 1, 0.52), outer: hsl(hue - 70, 1, 0.5), hi: hsl(hue + 8, 1, 0.8), deep: hsl(hue - 30, 0.9, 0.12) };
  palettes.set(key, p);
  return p;
}

const canvasTextures = new Map<string, Texture>();
/** White textures drawn once: the picture's mask (soft left edge, `right` ramp on the right), a radial glow, a vertical smear. */
function softTexture(kind: "feather" | "glow" | "smear", right = 0.025, left = 0.16, lean = 0): Texture {
  const key = kind === "feather" ? `feather-${right.toFixed(3)}-${left.toFixed(2)}-${lean.toFixed(3)}` : kind;
  let t = canvasTextures.get(key);
  if (t) return t;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  if (kind === "glow") {
    const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    r.addColorStop(0, "rgba(255,255,255,1)");
    r.addColorStop(0.22, "rgba(255,255,255,0.6)");
    r.addColorStop(0.55, "rgba(255,255,255,0.14)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 256, 256);
  } else if (kind === "smear") {
    // A tall streak: bright core fading up and down, with fine vertical striations.
    const v = g.createLinearGradient(0, 0, 0, 256);
    v.addColorStop(0, "rgba(255,255,255,0)");
    v.addColorStop(0.35, "rgba(255,255,255,0.85)");
    v.addColorStop(0.5, "rgba(255,255,255,1)");
    v.addColorStop(0.65, "rgba(255,255,255,0.85)");
    v.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = v;
    g.fillRect(0, 0, 256, 256);
    g.globalCompositeOperation = "destination-out";
    for (let x = 0; x < 256; x += 3) {
      g.fillStyle = `rgba(0,0,0,${(Math.sin(x * 12.9898) * 0.5 + 0.5) * 0.3})`;
      g.fillRect(x, 0, 1 + (x % 2), 256);
    }
  } else {
    const img = g.createImageData(256, 256);
    const sm = (a: number) => a * a * (3 - 2 * a);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const u = (x + 0.5) / 256;
        const v = (y + 0.5) / 256;
        // `lean` slants the right edge across the height, so that once the sprite is skewed it stands upright.
        const edge = 1 - Math.abs(lean) / 2 + lean * (v - 0.5);
        const a = clamp01(u / left) * clamp01((edge - u) / right) * clamp01(Math.min(v, 1 - v) / 0.025);
        const i = (y * 256 + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(255 * sm(a));
      }
    }
    g.putImageData(img, 0, 0);
  }
  t = Texture.from(c);
  canvasTextures.set(key, t);
  return t;
}

/** A jagged polyline from a to b (midpoint displacement), as a flat [x, y, ...] list. */
function bolt(ax: number, ay: number, bx: number, by: number, rough: number, depth: number, r: () => number): number[] {
  let pts = [ax, ay, bx, by];
  let amp = rough;
  for (let d = 0; d < depth; d++) {
    const next: number[] = [];
    for (let i = 0; i < pts.length - 2; i += 2) {
      const x0 = pts[i]!, y0 = pts[i + 1]!, x1 = pts[i + 2]!, y1 = pts[i + 3]!;
      const dx = x1 - x0, dy = y1 - y0;
      const l = Math.hypot(dx, dy) || 1;
      const off = (r() - 0.5) * 2 * amp;
      next.push(x0, y0, (x0 + x1) / 2 + (-dy / l) * off, (y0 + y1) / 2 + (dx / l) * off);
    }
    next.push(pts[pts.length - 2]!, pts[pts.length - 1]!);
    pts = next;
    amp *= 0.55;
  }
  return pts;
}

type WebEdge = { pts: number[]; ring: number; weight: number };
/**
 * A lightning web over the whole screen: nodes scattered densely around the action point and thinly to the edges,
 * each joined to its nearest neighbours by jagged bolts, with spurs off the screen. `ring` (0..2) is the reveal step.
 */
function webEdges(cx: number, cy: number, w: number, h: number, r: () => number): WebEdge[] {
  const nodes: { x: number; y: number; d: number }[] = [];
  const diag = Math.hypot(w, h);
  for (let i = 0; i < 110; i++) {
    // Nearly half the nodes fill the middle of the screen (where the eye is), the rest scatter out from the centre.
    let x: number, y: number;
    if (i < 48) {
      x = w * (0.22 + r() * 0.56);
      y = h * (0.2 + r() * 0.6);
    } else {
      const a = r() * Math.PI * 2;
      const k = Math.pow(r(), 0.6);
      x = cx + Math.cos(a) * k * w * 0.7;
      y = cy + Math.sin(a) * k * h * 0.7;
    }
    nodes.push({ x, y, d: Math.hypot(x - cx, y - cy) / (diag * 0.5) });
  }
  nodes.push({ x: cx, y: cy, d: 0 });
  const out: WebEdge[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!;
    const near = nodes.map((m, j) => ({ j, d: Math.hypot(m.x - n.x, m.y - n.y) })).filter((e) => e.j !== i).sort((a, b) => a.d - b.d).slice(0, 3);
    for (const e of near) {
      const key = i < e.j ? `${i}-${e.j}` : `${e.j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const m = nodes[e.j]!;
      const ring = Math.min(2, Math.floor(((n.d + m.d) / 2) * 3.2));
      out.push({ pts: bolt(n.x, n.y, m.x, m.y, e.d * 0.13, 3, r), ring, weight: 1 - Math.min(1, (n.d + m.d) / 2) * 0.6 });
    }
  }
  // Long chords straight across the middle, so no big dark cell is left where the eye sits.
  for (let i = 0; i < 8; i++) {
    const ax = w * (0.18 + r() * 0.17), ay = h * (0.2 + r() * 0.6);
    const bx = w * (0.65 + r() * 0.17), by = h * (0.2 + r() * 0.6);
    out.push({ pts: bolt(ax, ay, bx, by, Math.hypot(bx - ax, by - ay) * 0.1, 4, r), ring: 1, weight: 0.75 });
  }
  // Spurs from the outer nodes off past the edges.
  for (const n of nodes) {
    if (n.d < 0.45 || r() < 0.35) continue;
    const a = Math.atan2(n.y - cy, n.x - cx) + (r() - 0.5) * 0.8;
    const len = diag * (0.15 + r() * 0.2);
    out.push({ pts: bolt(n.x, n.y, n.x + Math.cos(a) * len, n.y + Math.sin(a) * len, len * 0.2, 4, r), ring: 2, weight: 0.4 });
  }
  return out;
}

/** A polyline drawn as one tapered filled strip (so joints never double up under an additive blend). */
function taper(g: Graphics, pts: number[], w0: number, w1: number, color: number, alpha: number): void {
  const n = pts.length / 2;
  if (n < 2) return;
  const left: number[] = [];
  const right: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = pts[i * 2]!, y = pts[i * 2 + 1]!;
    const j = Math.min(n - 1, i + 1), k0 = Math.max(0, i - 1);
    const dx = pts[j * 2]! - pts[k0 * 2]!, dy = pts[j * 2 + 1]! - pts[k0 * 2 + 1]!;
    const dl = Math.hypot(dx, dy) || 1;
    const u = i / (n - 1);
    const half = (w0 + (w1 - w0) * u) / 2;
    left.push(x - (dy / dl) * half, y + (dx / dl) * half);
    right.unshift(x + (dy / dl) * half, y - (dx / dl) * half);
  }
  g.poly([...left, ...right]).fill({ color, alpha });
}

type Line = { y: number; len: number; speed: number; phase: number; thick: number; color: number; alpha: number };
/** Tapered wedges streaming along x, flickering in thickness every other frame. */
function drawLines(g: Graphics, list: Line[], t: number, width: number, dir: number, alpha: number, frame: number, r: () => number): void {
  g.clear();
  if (alpha <= 0.01) return;
  for (const s of list) {
    const p = (s.phase + t * s.speed) % 1;
    const len = s.len * width;
    const x = dir > 0 ? width * 0.7 - p * width * 1.9 : -width * 0.7 + p * width * 1.9 - len;
    const flick = frame % 2 === 0 ? 0.5 + r() * 1 : 1;
    const half = (s.thick * flick) / 2;
    g.poly([x, s.y, x + len * 0.55, s.y - half, x + len, s.y, x + len * 0.55, s.y + half]).fill({ color: s.color, alpha: alpha * s.alpha });
  }
}

export async function playFramed(o: CutInOptions): Promise<void> {
  const { w, h, ui, clock } = o;
  const pal = paletteFromArt(o.portrait);
  const dir = o.enemy ? -1 : 1;
  const total = T.end;
  const diag = Math.hypot(w, h);
  const portrait = h > w * 1.05;
  const r = rng(o.skillName.length * 977 + o.actorName.length * 31);
  const sx = (v: number) => (dir > 0 ? v : w - v);

  const root = new Container();
  root.eventMode = "static";
  root.cursor = "pointer";
  root.hitArea = { contains: () => true };

  // --- The picture's placement ------------------------------------------------------------------------------
  const tw = o.portrait.width;
  const th = o.portrait.height;
  const k = Math.max((w * 0.72) / tw, (h * 1.18) / th);
  const artW = tw * k;
  const artH = th * k;
  const focus = o.face ?? { x: 0.42, y: 0.32 };
  let artCX: number;
  if (artW >= w) artCX = Math.max(w - artW / 2, Math.min(artW / 2, w * 0.5 - (focus.x - 0.5) * artW));
  else artCX = dir > 0 ? Math.min(w * 0.6, w - 30 * ui - artW / 2) : Math.max(w * 0.4, 30 * ui + artW / 2);
  const artCY = artH >= h ? Math.max(h - artH / 2, Math.min(artH / 2, h * 0.52)) : h * 0.52;
  const actionU = dir > 0 ? 0.62 : 0.38;
  const fp = { x: artCX + (actionU - 0.5) * artW, y: artCY };

  // --- 1. The cover: grey flash draining to black ----------------------------------------------------------
  const cover = new Graphics().rect(-w * 0.1, -h * 0.1, w * 1.2, h * 1.2).fill({ color: 0xffffff });
  // Needles raining down the middle third: white on the dark, white and black over the picture, black on the white.
  type Needle = { x: number; len: number; v: number; phase: number; wid: number; a: number; dark: boolean };
  const needles: Needle[] = Array.from({ length: 34 }, () => ({
    x: w * (0.3 + r() * 0.4), len: h * (0.08 + r() * 0.34), v: h * (2.2 + r() * 2.4), phase: r(), wid: (0.8 + r() * 1.8) * ui, a: 0.35 + r() * 0.6, dark: r() < 0.5,
  }));
  const rain = new Graphics();
  const drawRain = (t: number, alpha: number, mixed: boolean) => {
    rain.clear();
    if (alpha <= 0.01) return;
    for (const n of needles) {
      if (r() < 0.25) continue;
      const y = (((n.phase * (h + n.len) + t * n.v) % (h + n.len)) + h + n.len) % (h + n.len) - n.len;
      rain.poly([n.x, y, n.x + n.wid, y + n.len * 0.5, n.x, y + n.len, n.x - n.wid, y + n.len * 0.5]).fill({ color: mixed && n.dark ? 0x101018 : 0xffffff, alpha: n.a * alpha });
    }
  };

  // --- 2. The web: a precursor bolt, then the full web in three steps ---------------------------------------
  const webBox = new Container();
  const webGlow = [new Graphics(), new Graphics(), new Graphics()];
  const webMid = [new Graphics(), new Graphics(), new Graphics()];
  const webCore = [new Graphics(), new Graphics(), new Graphics()];
  const edges = webEdges((fp.x + w / 2) / 2, (fp.y + h / 2) / 2, w, h, r);
  for (const e of edges) {
    taper(webGlow[e.ring]!, e.pts, 11 * ui * e.weight + 3 * ui, 3 * ui, BLUE.wide, 0.65);
    taper(webMid[e.ring]!, e.pts, 3.6 * ui * e.weight + 1 * ui, 1 * ui, BLUE.body, 0.9);
    taper(webCore[e.ring]!, e.pts, 1.5 * ui * e.weight + 0.5 * ui, 0.4 * ui, 0xffffff, 1);
  }
  const glowBox = new Container();
  glowBox.addChild(...webGlow);
  glowBox.filters = [new BlurFilter({ strength: 8 * ui, quality: 3 })];
  glowBox.blendMode = "add";
  const coreBox = new Container();
  coreBox.addChild(...webMid, ...webCore);
  coreBox.blendMode = "add";
  // White-hot stars where the main bolts meet.
  const nodes = edges.filter((e) => e.ring <= 1 && e.weight > 0.55).slice(0, 18).map((e) => {
    const s = new Sprite(softTexture("glow"));
    s.anchor.set(0.5);
    s.position.set(e.pts[0]!, e.pts[1]!);
    s.tint = 0x88ccff;
    s.blendMode = "add";
    s.width = s.height = diag * (0.03 + r() * 0.025);
    return { s, ring: e.ring, phase: r() * 6 };
  });
  const hot = new Sprite(softTexture("glow"));
  hot.anchor.set(0.5);
  hot.position.set(fp.x, fp.y);
  hot.blendMode = "add";
  hot.tint = BLUE.body;
  const crawl = new Graphics();
  crawl.blendMode = "add";
  const crawlGlow = new Graphics();
  crawlGlow.blendMode = "add";
  crawlGlow.filters = [new BlurFilter({ strength: 4 * ui, quality: 2 })];
  const crawlPts = bolt(sx(w * 0.5), h + 4 * ui, sx(w * 0.48), h * 0.55, h * 0.06, 5, r);
  const crawlForks = [0.3, 0.5, 0.65, 0.8].map((u) => {
    const i = Math.floor((crawlPts.length / 2 - 1) * u) * 2;
    const a = -Math.PI / 2 + (r() < 0.5 ? -1 : 1) * (0.6 + r() * 0.6);
    const len = h * (0.04 + r() * 0.06);
    return { u, pts: bolt(crawlPts[i]!, crawlPts[i + 1]!, crawlPts[i]! + Math.cos(a) * len, crawlPts[i + 1]! + Math.sin(a) * len, len * 0.3, 3, r) };
  });
  webBox.addChild(glowBox, coreBox, ...nodes.map((n) => n.s), hot, crawlGlow, crawl);

  // --- 3. The scene behind the break: speed-line backdrop, the picture, its flare ---------------------------
  const scene = new Container();
  const navy = new Graphics().rect(-w * 0.1, -h * 0.1, w * 1.2, h * 1.2).fill({ color: BLUE.deep });
  const tunnel = new Container();
  tunnel.position.set(w / 2, h / 2);
  tunnel.rotation = -0.26 * dir;
  const speed = fxLibrary.sheet("cutin.speed");
  const speedSprite = (alpha: number, blend: "normal" | "add", tint: number) => {
    if (!speed) return null;
    const s = new Sprite(speed.frames[0]!);
    s.anchor.set(0.5);
    s.width = diag * 1.25;
    s.height = diag * 1.25 * 0.62;
    s.blendMode = blend;
    s.tint = tint;
    s.alpha = alpha;
    return s;
  };
  // The sheet's white core band reads as a wash at full size: pull it toward the deep blue of the reference look.
  const speedBack = speedSprite(1, "normal", 0x6a8cff);
  const speedScaleY = speedBack?.scale.y ?? 1;
  if (speedBack) tunnel.addChild(speedBack);
  const lines = new Graphics();
  lines.blendMode = "add";
  tunnel.addChild(lines);
  const lineList: Line[] = Array.from({ length: speedBack ? 34 : 80 }, () => ({
    y: (r() - 0.5) * diag, len: 0.3 + r() * 0.6, speed: 2.2 + r() * 2.6, phase: r(), thick: (1 + r() * (speedBack ? 4 : 12)) * ui,
    color: BLUE.lines[Math.floor(r() * BLUE.lines.length)]!, alpha: speedBack ? 0.4 + r() * 0.4 : 0.45 + r() * 0.45,
  }));

  // The picture: colour channels as two additive copies (split on the slam), masked by a soft-edged sheet whose
  // wide left ramp lets the speed lines through behind the name.
  const art = new Container();
  art.position.set(artCX, artCY);
  const pivot = { x: (focus.x - 0.5) * artW, y: (focus.y - 0.5) * artH };
  const pic = new Container();
  pic.pivot.set(pivot.x, pivot.y);
  pic.position.set(pivot.x, pivot.y);
  const chan = [0xff0000, 0x00ffff].map((tint) => {
    const s = new Sprite(o.portrait);
    s.anchor.set(0.5);
    s.scale.set(k);
    s.tint = tint;
    s.blendMode = "add";
    return s;
  });
  const picBase = new Graphics().rect(-artW / 2 - 4, -artH / 2 - 4, artW + 8, artH + 8).fill({ color: 0x000000 });
  pic.addChild(picBase, ...chan);
  const smear = new BlurFilter({ strengthX: 0, strengthY: 0, quality: 3 });
  pic.filters = [smear];
  // The mask is skewed with the lines; its right edge is slanted back in the texture so it lands upright on screen,
  // inside the picture's own (upright) edge, and fades softly there instead of showing a hard seam.
  const lean = portrait ? 0 : Math.round(Math.sin(0.32) * (artH / artW) * 100) / 100;
  const feather = new Sprite(softTexture("feather", portrait ? Math.round(Math.min(0.15, Math.max(0.03, (90 * ui) / artW)) * 200) / 200 : 0.08, portrait ? 0.12 : 0.34, lean));
  feather.anchor.set(0.5);
  feather.width = artW * 1.04;
  feather.height = artH * 1.04;
  feather.skew.x = -0.32 * dir;
  if (dir < 0) feather.scale.x *= -1;
  art.addChild(pic, feather);
  art.mask = feather;
  // The flare on the action: a pulsing haze and burst, a white core and a turning lens cross.
  const flare = new Container();
  flare.position.set((actionU - 0.5) * artW, 0);
  const haze = new Sprite(softTexture("glow"));
  const burst = new Sprite(softTexture("glow"));
  const core = new Sprite(softTexture("glow"));
  for (const [s, c] of [[haze, pal.outer], [burst, pal.mid], [core, 0xffffff]] as const) {
    s.anchor.set(0.5);
    s.blendMode = "add";
    s.tint = c;
  }
  const cross = new Graphics();
  cross.blendMode = "add";
  cross.poly([-w * 0.2, 0, 0, -2.5 * ui, w * 0.2, 0, 0, 2.5 * ui]).fill({ color: 0xffffff, alpha: 0.9 });
  cross.poly([0, -h * 0.13, 1.6 * ui, 0, 0, h * 0.13, -1.6 * ui, 0]).fill({ color: 0xffffff, alpha: 0.9 });
  cross.poly([-w * 0.07, -w * 0.07, w * 0.003, -w * 0.003, w * 0.07, w * 0.07, -w * 0.003, w * 0.003]).fill({ color: 0xffffff, alpha: 0.45 });
  flare.addChild(haze, burst, core, cross);
  art.addChild(flare);
  // Lines streak over the picture too, so it sits inside the motion: the sheet faintly, and drawn streaks.
  const fgTunnel = new Container();
  fgTunnel.position.set(w / 2, h / 2);
  fgTunnel.rotation = tunnel.rotation;
  const speedOver = speedSprite(0.26, "add", 0x9fb8ff);
  if (speedOver) fgTunnel.addChild(speedOver);
  const fgLines = new Graphics();
  fgLines.blendMode = "add";
  fgTunnel.addChild(fgLines);
  const fgList: Line[] = Array.from({ length: 14 }, () => ({
    y: (r() - 0.5) * diag, len: 0.2 + r() * 0.35, speed: 3 + r() * 2.5, phase: r(), thick: (1 + r() * 2.5) * ui, color: r() < 0.5 ? 0xffffff : BLUE.lines[2]!, alpha: 0.35 + r() * 0.3,
  }));
  scene.addChild(navy, tunnel, art, fgTunnel);

  // --- 4. The shards: the black breaking into chunks blown past the camera ---------------------------------
  const shardBox = new Container();
  shardBox.filters = [new BlurFilter({ strength: 2 * ui, quality: 2 })];
  const shards = Array.from({ length: portrait ? 50 : 70 }, () => {
    const mid = r() < 0.3;
    const size = mid ? diag * (0.035 + r() * 0.035) : diag * (0.015 + r() * r() * 0.06);
    const g = new Graphics();
    const n = r() < 0.5 ? 3 : r() < 0.7 ? 4 : 5;
    const pts: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 1.1;
      const rr = size * (0.45 + r() * 0.55);
      pts.push(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.poly(pts).fill({ color: 0x050814 });
    g.poly(pts).stroke({ color: 0x2255aa, width: Math.max(1, 1.2 * ui), alpha: 0.6 });
    const x0 = mid ? w * (0.35 + r() * 0.3) : fp.x + (r() - 0.5) * w * 0.9;
    const y0 = mid ? h * (0.35 + r() * 0.3) : fp.y + (r() - 0.5) * h * 0.9;
    const a = Math.atan2(y0 - fp.y, x0 - fp.x) + (r() - 0.5) * 0.4;
    g.position.set(x0, y0);
    return { g, x0, y0, vx: Math.cos(a), vy: Math.sin(a), v: diag * (0.7 + r() * 0.9), spin: (r() - 0.5) * 10, tumble: 8 + r() * 14, grow: 1.2 + r() * 1.8, phase: r() * 6 };
  });
  for (const s of shards) shardBox.addChild(s.g);

  // --- 5. The name: the skill's words slammed as one stacked block on the left, the fighter's name across the
  //        bottom, both over a soft ink corner (the lines show through it).
  const words = o.skillName.split(/\s+/).filter(Boolean);
  const heroIdx = words.length <= 1 ? 0 : words.reduce((best, wd, i) => (i > 0 && wd.length > words[best]!.length ? i : best), 1);
  const sizeOf = (i: number) => Math.min(h * (i === heroIdx ? 0.165 : 0.12), w * (portrait ? 0.2 : 0.115));
  const ink = new Sprite(softTexture("glow"));
  ink.anchor.set(0.5);
  ink.tint = 0x000000;
  ink.width = w * (portrait ? 1.8 : 1.1);
  ink.height = h * 1.3;
  ink.position.set(sx(w * (portrait ? 0.1 : 0.04)), h * 0.98);
  const stampStyle = (size: number) => textStyle(`cutin-stamp-${Math.round(size)}`, {
    fontFamily: HEAVY, fontSize: Math.round(size), fontWeight: "900", fill: 0xffffff, letterSpacing: size * 0.01,
    stroke: { color: 0x000000, width: Math.max(6, size * 0.14), join: "round" },
    dropShadow: { color: 0x000000, alpha: 0.9, blur: Math.max(4, size * 0.08), distance: Math.max(3, size * 0.05), angle: Math.PI / 3 },
  });
  const stamps = words.map((word, i) => {
    const t = new Text({ text: word.toUpperCase(), style: stampStyle(sizeOf(i)) });
    t.anchor.set(dir > 0 ? 0 : 1, 0.5);
    t.skew.x = -0.1 * dir;
    return t;
  });
  const widest = Math.max(1, ...stamps.map((s) => s.width));
  const fit = Math.min(1, (w * (portrait ? 0.84 : 0.42)) / widest);
  for (const s of stamps) s.scale.set(fit);
  const subSize = Math.round(Math.max(15 * ui, Math.min(h * 0.095, w * (portrait ? 0.1 : 0.058))));
  const subY = h - subSize * 1.0;
  let y = portrait ? h * 0.8 : subY - subSize * 0.7 - sizeOf(words.length - 1) * fit * 0.5;
  const ys: number[] = [];
  for (let i = words.length - 1; i >= 0; i--) {
    ys[i] = y;
    if (i > 0) y -= (sizeOf(i) * 0.5 + sizeOf(i - 1) * 0.5) * fit * 0.94;
  }
  stamps.forEach((s, i) => s.position.set(sx(w * (portrait ? 0.05 : 0.03) + i * w * 0.012), ys[i]!));
  // Each word lands from a tall smear, with a white ghost expanding off it.
  const smears = stamps.map((s) => {
    const m = new Sprite(softTexture("smear"));
    m.anchor.set(dir > 0 ? 0 : 1, 0.5);
    m.width = s.width * 0.92;
    m.height = h * 0.7;
    m.position.set(s.x, s.y);
    m.alpha = 0;
    return m;
  });
  // Each word lands with a cyan and a magenta copy split either side of it, snapping together.
  const ghosts = stamps.map((s) => [0x00ffff, 0xff0055].map((tint) => {
    const g = new Text({ text: s.text, style: s.style });
    g.anchor.copyFrom(s.anchor);
    g.skew.x = s.skew.x;
    g.position.copyFrom(s.position);
    g.tint = tint;
    g.blendMode = "add";
    g.alpha = 0;
    return g;
  }));
  // The fighter's name across the bottom: slammed whole, with a chromatic split that lingers.
  const subStyle = textStyle(`cutin-sub-${subSize}`, {
    fontFamily: HEAVY, fontSize: subSize, fontWeight: "900", fill: 0xffffff, letterSpacing: subSize * 0.12,
    stroke: { color: 0x000000, width: Math.max(5, subSize * 0.17), join: "round" },
  });
  const subText = o.actorName.toUpperCase();
  const sub = new Text({ text: subText, style: subStyle });
  sub.anchor.set(0.5);
  const subX = portrait ? w / 2 : sx(w * 0.56);
  sub.position.set(subX, subY);
  const subFit = Math.min(1, (w * 0.8) / Math.max(1, sub.width));
  sub.scale.set(subFit);
  const shimmer = [0x00ffff, 0xff00ff].map((tint) => {
    const c = new Text({ text: subText, style: subStyle });
    c.anchor.set(0.5);
    c.scale.set(subFit);
    c.position.copyFrom(sub.position);
    c.tint = tint;
    c.blendMode = "add";
    c.alpha = 0;
    return c;
  });
  const subGlow = new Text({ text: subText, style: subStyle });
  subGlow.anchor.set(0.5);
  subGlow.position.copyFrom(sub.position);
  subGlow.blendMode = "add";
  subGlow.alpha = 0;
  const subAt = T.stamp + Math.max(0, words.length - 1) * T.wordGap + 0.03;
  const nameBox = new Container();
  nameBox.pivot.set(w / 2, h / 2);
  nameBox.position.set(w / 2, h / 2);
  nameBox.addChild(...smears, ...ghosts.flat(), ...stamps, ...shimmer, sub, subGlow);

  // --- 6. The ending: white, black needles -----------------------------------------------------------------
  const white = new Graphics().rect(-w * 0.1, -h * 0.1, w * 1.2, h * 1.2).fill({ color: 0xffffff });
  white.alpha = 0;
  const endRain = new Graphics();

  const sheets = new Container();
  const top = new Container();
  root.addChild(cover, scene, webBox, rain, shardBox, sheets, ink, nameBox, white, endRain, top);
  o.layer.addChild(root);

  const fxCtx: FxContext = {
    w, h, ui, band: { cx: w / 2, cy: h / 2, angle: tunnel.rotation, len: diag, thick: h }, palette: [pal.deep, pal.mid, pal.hi], slam: T.slam, total,
    face: { x: fp.x, y: fp.y }, portrait: { texture: o.portrait, sprite: chan[0]! }, under: sheets, over: sheets, top,
  };
  const layers = buildFx(resolveFx(o.visual?.fx), fxCtx);

  let skipped = false;
  root.on("pointertap", () => { skipped = true; });
  // One-shot beats: each slot's sound (and sheet, where given), once.
  const fired = new Set<string>();
  const once = (key: string, fn: () => void) => {
    if (fired.has(key)) return;
    fired.add(key);
    fn();
  };
  const sheetAt = (slot: FxSlot, x: number, y: number, size: number, extra: { frames?: [number, number]; speed?: number; blend?: "add" | "normal" | "screen"; silent?: boolean; alpha?: number } = {}) =>
    void fxLibrary.play(slot, { layer: sheets, clock, x, y, ui: 1, scale: size, flip: dir < 0, ...extra });
  /** A sheet's scale that covers the screen (its frames are drawn for 640x480). */
  const cover640 = Math.max(w / 640, h / 480);
  let aura: SoundHandle | null = null;
  let crackle: SoundHandle | null = null;
  const start = clock.now;
  let frame = 0;
  await new Promise<void>((resolve) => {
    const stop = clock.onFrame((now) => {
      const t = now - start;
      frame++;
      if (skipped && t < total - 0.2) {
        stop();
        resolve();
        return;
      }
      // --- Sounds and sheets on the beats.
      once("shut", () => fxLibrary.sound("cutin.shut"));
      if (t >= T.bolt) once("crack", () => fxLibrary.sound("cutin.crack", 0.8));
      if (t >= T.web) once("web", () => { crackle = fxLibrary.sound("cutin.crack", 1); });
      if (t >= T.shatter) once("trim", () => crackle?.stop(90));
      if (t >= T.shatter) {
        once("shatter", () => {
          sheetAt("cutin.shatter", fp.x, fp.y, cover640 * 0.75, { frames: [0, 5], speed: 1.6, blend: "add", alpha: 0.7 });
          // The glassy top end of the break.
          fxLibrary.sound("cutin.glint", 0.6);
        });
      }
      if (t >= T.slam) once("rush", () => fxLibrary.sound("cutin.rush"));
      if (t >= T.lock) once("slam", () => fxLibrary.sound("cutin.slam"));
      if (t >= T.lock + 0.04) once("aura", () => { aura = fxLibrary.sound("cutin.aura", 0.9); });
      if (t >= T.lock) once("stamp", () => fxLibrary.sound("cutin.stamp"));
      if (t >= subAt) once("glint", () => fxLibrary.sound("cutin.glint", 0.85));
      if (t >= T.exit) {
        once("exit", () => {
          aura?.stop(200);
          fxLibrary.sound("cutin.burst");
          sheetAt("cutin.whiteout", w / 2, h / 2, cover640 * 1.15, { speed: 1.5 });
        });
      }
      if (t >= T.exit + 0.07) once("out", () => fxLibrary.sound("cutin.shut", 0.5));

      // --- 1. Grey flash draining to black; needles raining (then over the picture while it holds).
      const g = t < T.grey ? 0.62 : t < T.black ? 0.62 * (1 - span(t, T.grey, T.black)) ** 1.5 : 0;
      cover.tint = mixColor(0x000000, 0xffffff, g);
      cover.visible = t < T.shatter + 0.12;
      cover.alpha = 1 - span(t, T.shatter, T.shatter + 0.12);
      const holdRain = t >= T.lock ? 0.55 * span(t, T.lock, T.lock + 0.2) * (1 - span(t, T.exit, T.exit + 0.1)) : 0;
      const preRain = t < T.shatter ? 1 : 1 - span(t, T.shatter, T.shatter + 0.2);
      drawRain(t, Math.max(preRain, holdRain), t >= T.lock);
      rain.visible = t < T.exit + 0.1;

      // --- 2. Crawl, then the web in three steps, flickering, fading through the break.
      crawl.clear();
      crawlGlow.clear();
      if (t >= T.bolt && t < T.web + 0.1) {
        const p = span(t, T.bolt, T.web - 0.05);
        const n = Math.max(2, Math.floor((crawlPts.length / 2) * p));
        const part = crawlPts.slice(0, n * 2);
        const blink = frame % 3 === 0 ? 0.55 : 1;
        taper(crawlGlow, part, 8 * ui, 2 * ui, 0x4466ff, 0.7);
        taper(crawl, part, 2.5 * ui, 0.8 * ui, 0xffffff, blink);
        for (const f of crawlForks) {
          if (p < f.u) continue;
          taper(crawlGlow, f.pts, 5 * ui, 1 * ui, 0x4466ff, 0.6);
          taper(crawl, f.pts, 1.4 * ui, 0.3 * ui, 0xffffff, blink);
        }
      }
      webBox.visible = t >= T.bolt && t < T.shatter + 0.3;
      if (webBox.visible) {
        const steps = t < T.web ? 0 : t < T.web + 0.067 ? 1 : t < T.web + 0.133 ? 2 : 3;
        for (let i = 0; i < 3; i++) webGlow[i]!.visible = webMid[i]!.visible = webCore[i]!.visible = i < steps;
        const flick = frame % 2 === 0 ? 0.8 + r() * 0.2 : 1;
        const out = 1 - span(t, T.shatter, T.shatter + 0.28);
        coreBox.alpha = flick * out * (frame % 7 === 0 && t > T.shatter ? 0.3 : 1);
        glowBox.alpha = (0.85 + 0.25 * Math.sin(t * 40)) * out;
        const jit = t >= T.web ? 1.5 * ui : 0;
        coreBox.position.set((r() - 0.5) * jit, (r() - 0.5) * jit);
        glowBox.position.copyFrom(coreBox.position);
        for (const nd of nodes) {
          nd.s.visible = nd.ring < steps;
          nd.s.alpha = out * (0.6 + 0.4 * Math.sin(t * 30 + nd.phase));
          nd.s.position.x += 0;
        }
        const gk = span(t, T.web, T.shatter);
        hot.visible = t >= T.web;
        hot.width = hot.height = h * (0.3 + 0.4 * gk * gk) * (1 + (r() - 0.5) * 0.3);
        hot.alpha = (0.4 + 0.35 * gk) * out;
      }

      // --- 3. The scene: speed lines from the break; the picture bursting through it.
      scene.visible = t >= T.shatter && t < T.white + 0.08;
      if (scene.visible) {
        const fi = speed ? Math.floor(t * speed.sheet.fps) % speed.frames.length : 0;
        for (const s of [speedBack, speedOver]) {
          if (!s || !speed) continue;
          s.texture = speed.frames[fi]!;
          // A flick of thickness every other frame, the way hand-drawn lines strobe.
          s.scale.y = speedScaleY * (frame % 2 === 0 ? 1 : 1.05);
          s.x = -dir * ((t * diag * 0.9) % (diag * 0.05));
        }
        drawLines(lines, lineList, t, diag, dir, 1, frame, r);
        const picIn = span(t, T.slam, T.slam + 0.05);
        art.visible = t >= T.slam;
        art.alpha = picIn;
        const over = picIn * (1 - span(t, T.exit, T.exit + 0.1));
        fgTunnel.alpha = over;
        drawLines(fgLines, fgList, t, diag, dir, over, frame, r);
        // Slam 185% -> 100% as the shards clear, smear and channel split decaying; tremble and a slow push while it
        // holds; then a violent whip toward the camera on the way out.
        const slamK = ease.outCubic(span(t, T.slam, T.lock));
        const push = span(t, T.lock, T.exit);
        const whip = ease.inCubic(span(t, T.exit, T.white));
        pic.scale.set((1.85 - 0.85 * slamK + 0.06 * push) * (1 + 1.4 * whip));
        const split = (t < T.slam ? 0 : t < T.lock ? 18 * (1 - slamK) + 2 : 2 * Math.exp(-(t - T.lock) * 6)) * ui + whip * 25 * ui;
        const jit = split > 0.5 * ui ? (r() - 0.5) * 4 * ui * Math.min(1, split / (16 * ui)) : 0;
        chan[0]!.position.set(-split * dir + jit, split * 0.3);
        chan[1]!.position.set(split * dir - jit, -split * 0.3);
        smear.strengthX = 16 * (1 - slamK) * ui + whip * 24 * ui;
        smear.strengthY = whip * 24 * ui;
        smear.enabled = smear.strengthX > 0.3 || smear.strengthY > 0.3;
        const holding = t >= T.lock && t < T.exit;
        const trem = holding ? 2.5 * ui : 0;
        art.x = artCX + (r() - 0.5) * 2 * trem;
        art.y = artCY - 10 * ui * push + (r() - 0.5) * 2 * trem;
        // The flare pulses at 15 Hz and its cross turns.
        const flareK = (1 + 0.7 * (1 - slamK)) * (1 + 0.2 * Math.sin(t * Math.PI * 2 * 15));
        haze.width = haze.height = h * 0.75 * (1 + 0.7 * (1 - slamK));
        haze.alpha = 0.35 + 0.15 * Math.sin(t * 9);
        burst.width = burst.height = h * 0.34 * flareK;
        burst.alpha = 0.5 + 0.3 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 7.5));
        core.width = core.height = h * 0.12 * flareK;
        cross.rotation = -0.21 + t * 1.05;
        cross.scale.set(flareK, flareK);
        flare.alpha = 1 - whip;
      }

      // --- 4. Shards blown past the camera, tumbling, gone within 0.4 s.
      const sp = span(t, T.shatter, T.shatter + 0.4);
      shardBox.visible = t >= T.shatter && sp < 1;
      if (shardBox.visible) {
        const e = t - T.shatter;
        const d0 = ease.outExpo(sp);
        for (const s of shards) {
          const d = s.v * 0.55 * d0 + s.v * e * 0.6;
          s.g.x = s.x0 + s.vx * d;
          s.g.y = s.y0 + s.vy * d;
          s.g.rotation = s.spin * e;
          const z = 1 + s.grow * sp;
          s.g.scale.set(z * (0.25 + 0.75 * Math.abs(Math.cos(e * s.tumble + s.phase))), z);
          s.g.alpha = 1 - span(sp, 0.55, 1);
        }
      }

      // --- 5. Name: the block slams (words two frames apart), then the fighter's name.
      ink.visible = t >= T.stamp - 0.04;
      ink.alpha = 0.78 * ease.outCubic(span(t, T.stamp - 0.04, T.stamp + 0.1));
      nameBox.visible = t >= T.stamp;
      let bump = 0;
      stamps.forEach((s, i) => {
        const at = T.stamp + i * T.wordGap;
        const p = span(t, at, at + 0.1);
        const e = ease.outBack(p);
        s.visible = t >= at;
        s.alpha = Math.min(1, p * 3);
        s.scale.set(fit * (1.6 - 0.6 * e), fit * (2.4 - 1.4 * e));
        const m = smears[i]!;
        const ms = span(t, at, at + 0.13);
        m.visible = t >= at && ms < 1;
        m.alpha = 0.7 * (1 - ms);
        m.scale.y = (h * 0.7 / 256) * (1 - 0.75 * ms);
        // The split copies ride the slam (same scale) and close from 9 px to nothing over ~5 frames.
        const gp = span(t, at, at + 0.17);
        ghosts[i]!.forEach((gh, k) => {
          gh.visible = t >= at && gp < 1;
          gh.alpha = 0.7 * (1 - ease.outCubic(gp)) * Math.min(1, p * 3);
          gh.scale.copyFrom(s.scale);
          gh.x = s.x + (k === 0 ? -1 : 1) * 9 * ui * (1 - ease.outExpo(gp));
        });
      });
      const lockAt = T.stamp + Math.max(0, words.length - 1) * T.wordGap + 0.1;
      if (t >= lockAt && t < lockAt + 0.12) bump = 6 * (1 - (t - lockAt) / 0.12);
      // The fighter's name: in from 150%, its cyan and magenta copies split wide and pull in, then keep a small
      // live split while the picture holds.
      const sp2 = span(t, subAt, subAt + 0.12);
      sub.visible = t >= subAt;
      sub.alpha = Math.min(1, sp2 * 3);
      sub.scale.set(subFit * (1.5 - 0.5 * ease.outCubic(sp2)));
      const live = t >= subAt ? 1 - span(t, T.exit, T.exit + 0.1) : 0;
      shimmer.forEach((c, i) => {
        c.visible = live > 0;
        const off = (i === 0 ? -1 : 1) * ((14 * (1 - ease.outCubic(span(t, subAt, subAt + 0.35)))) + 2.5 + Math.sin(t * 23 + i) * 1.2) * ui;
        c.x = sub.x + off;
        c.scale.copyFrom(sub.scale);
        c.alpha = live * (0.35 + 0.5 * (1 - span(t, subAt, subAt + 0.4)));
      });
      const gp = span(t, subAt + 0.1, subAt + 0.45);
      subGlow.visible = t >= subAt + 0.1 && gp < 1;
      subGlow.scale.set(sub.scale.x * (1 + 0.15 * gp));
      subGlow.alpha = 0.7 * (1 - gp);
      // Shake: the break, the lock, and the name block landing.
      let shake = bump;
      if (t >= T.lock && t < T.lock + 0.25) shake = Math.max(shake, 10 * (1 - (t - T.lock) / 0.25) ** 2);
      if (t >= T.shatter && t < T.shatter + 0.15) shake = Math.max(shake, 8 * (1 - (t - T.shatter) / 0.15));
      root.x = shake ? (r() - 0.5) * 2 * shake * ui : 0;
      root.y = shake ? (r() - 0.5) * 2 * shake * ui : 0;

      // --- 6. Exit: white floods in (over the burst sheet), needles strobe on it, the name ghosts out; then clear.
      white.alpha = t < T.clear ? ease.inCubic(span(t, T.exit + 0.05, T.white)) : 1 - ease.outCubic(span(t, T.clear, total));
      // The name is blown past the camera with the picture, gone before the white is full.
      const ghost = span(t, T.exit, T.exit + 0.1);
      nameBox.alpha = (1 - ghost) ** 2;
      nameBox.scale.set(1 + 0.8 * ease.inCubic(ghost));
      ink.alpha *= 1 - ghost;
      endRain.visible = t >= T.exit + 0.1 && t < T.clear + 0.06;
      if (endRain.visible) {
        endRain.clear();
        for (const n of needles) {
          if (r() < 0.15) continue;
          const yy = (((n.phase * h + t * n.v * 0.6) % (h + n.len)) + h + n.len) % (h + n.len) - n.len;
          endRain.poly([n.x, yy, n.x + n.wid * 1.3, yy + n.len * 0.9, n.x, yy + n.len * 1.8, n.x - n.wid * 1.3, yy + n.len * 0.9]).fill({ color: 0x0a0a0a, alpha: n.a * (1 - span(t, T.clear - 0.02, T.clear + 0.06)) });
        }
      }
      sheets.alpha = 1 - span(t, T.clear, total);
      root.alpha = 1 - span(t, total - 0.06, total);
      for (const l of layers) l.update(t);
      if (t >= total) {
        stop();
        resolve();
      }
    });
  });
  (aura as SoundHandle | null)?.stop(140);
  (crackle as SoundHandle | null)?.stop(140);
  if (skipped) await clock.tween(140, (k2) => { root.alpha = 1 - k2; });
  root.destroy({ children: true });
}
