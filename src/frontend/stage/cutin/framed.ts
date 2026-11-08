/**
 * The framed cut-in (docs/DESIGN.md, 5.4) for a painted action splash (Inlay
 * paints one with its own backdrop). About 2.45 s; a tap or click skips it.
 *   0.00  the screen shuts like an old set turning off: black shutters slam to a white slit that snaps shut;
 *   0.16  cracks race out from the action point in three steps, tapering, light leaking from a hot core;
 *   0.46  the black shatters into tumbling shards that fly past the camera over a white burst, and the
 *         picture slams in from 155% with its colour channels split, the camera shaking;
 *   0.54  a black wedge cuts into the lower corner and the skill name stamps onto it word by word (the
 *         key word largest), the fighter's tag last;
 *   hold  the picture fills the screen (a blurred, tinted echo of it fills any sides it leaves), trembling
 *         and pushing in, in a tunnel of flickering speed ribbons, energy arcs sweeping across it, embers
 *         and bokeh streaming through, a flare and lens cross on the action; a pulse at mid-hold;
 *   1.95  an accent impact frame, then pure white with black spikes converging on the action, the name
 *         burned in black; the white clears back to the battle as the words split apart.
 * Colours come from the picture itself (its dominant saturated hue), so the effects match the painting.
 * Inlay's cut-in guideline puts the face in the upper-left third and the move reaching out right of centre,
 * which is where the focus and the flare sit by default.
 */
import { BlurFilter, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { ease } from "../anim.js";
import { FONT_DISPLAY, FONT_UI, mixColor, textStyle } from "../theme.js";
import { THEME_FONTS_CSS } from "../../scene/fonts.js";
import { buildFx, resolveFx, type FxContext } from "./fx.js";
import type { CutInOptions } from "./cutin.js";

export const FRAMED_SECONDS = 2.45;

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const inQuad = (t: number): number => t * t;
const inExpo = (t: number): number => (t <= 0 ? 0 : 2 ** (10 * t - 10));
const span = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a));
const TITLE_FONT = `"Gambit Cinzel", ${FONT_DISPLAY}`;

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

/** The theme fonts on the page (@font-face is ignored inside a shadow root), loaded before the name is set. */
async function titleFont(px: number): Promise<void> {
  if (!document.getElementById("gambit-pixel-font") && !document.getElementById("gambit-cutin-fonts")) {
    const st = document.createElement("style");
    st.id = "gambit-cutin-fonts";
    st.textContent = THEME_FONTS_CSS;
    document.head.append(st);
  }
  try {
    await Promise.race([document.fonts.load(`800 ${Math.round(px)}px "Gambit Cinzel"`), new Promise((r) => setTimeout(r, 300))]);
  } catch {
    // Falls back to the display serif.
  }
}

const canvasTextures = new Map<string, Texture>();
/** White textures drawn once: the picture's mask (a soft, wide left edge; `right` is the right edge's ramp) or a soft radial glow. */
function softTexture(kind: "feather" | "glow", right = 0.025): Texture {
  const key = kind === "feather" ? `feather-${right.toFixed(3)}` : kind;
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
  } else {
    const img = g.createImageData(256, 256);
    const sm = (a: number) => a * a * (3 - 2 * a);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const u = (x + 0.5) / 256;
        const v = (y + 0.5) / 256;
        const a = clamp01(u / 0.16) * clamp01((1 - u) / right) * clamp01(Math.min(v, 1 - v) / 0.025);
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

const inks = new WeakMap<object, { poster: Texture; ink: Texture } | null>();
/**
 * The picture as ink for the impact frames: `poster` is three tones (shadows black, highlights white, the rest
 * clear so the flash colour shows through) and `ink` is the shadows alone. Null when the picture cannot be read.
 */
function inkOf(tex: Texture): { poster: Texture; ink: Texture } | null {
  const key = tex.source as object;
  if (inks.has(key)) return inks.get(key)!;
  let out: { poster: Texture; ink: Texture } | null = null;
  try {
    const res = (tex.source as { resource?: CanvasImageSource }).resource;
    if (res) {
      const W = Math.min(640, tex.width);
      const H = Math.round((W / tex.width) * tex.height);
      const src = document.createElement("canvas");
      src.width = W;
      src.height = H;
      const g = src.getContext("2d", { willReadFrequently: true })!;
      g.drawImage(res, 0, 0, W, H);
      const d = g.getImageData(0, 0, W, H);
      const poster = new ImageData(W, H);
      const ink = new ImageData(W, H);
      for (let i = 0; i < d.data.length; i += 4) {
        const l = (0.299 * d.data[i]! + 0.587 * d.data[i + 1]! + 0.114 * d.data[i + 2]!) / 255;
        if (l < 0.3) {
          poster.data[i] = 8;
          poster.data[i + 1] = 2;
          poster.data[i + 2] = 10;
          poster.data[i + 3] = 255;
          ink.data[i + 3] = 255;
        } else if (l > 0.72) {
          poster.data[i] = poster.data[i + 1] = poster.data[i + 2] = 255;
          poster.data[i + 3] = 255;
        }
      }
      const mk = (img: ImageData) => {
        const c = document.createElement("canvas");
        c.width = W;
        c.height = H;
        c.getContext("2d")!.putImageData(img, 0, 0);
        return Texture.from(c);
      };
      out = { poster: mk(poster), ink: mk(ink) };
    }
  } catch {
    out = null;
  }
  inks.set(key, out);
  return out;
}

/** Jagged branches from a point to past the screen edges (midpoint displacement), with forks. */
function crackPaths(x0: number, y0: number, reach: number, r: () => number): { pts: number[]; depth: number }[] {
  const out: { pts: number[]; depth: number }[] = [];
  const branch = (ax: number, ay: number, ang: number, len: number, depth: number, segs: number) => {
    const pts = [ax, ay];
    let x = ax;
    let y = ay;
    for (let i = 1; i <= segs; i++) {
      const a = ang + (r() - 0.5) * 0.9;
      x += Math.cos(a) * (len / segs);
      y += Math.sin(a) * (len / segs);
      pts.push(x, y);
      if (depth === 0 && i > 3 && i < segs - 3 && r() < 0.22) branch(x, y, ang + (r() < 0.5 ? -1 : 1) * (0.52 + r() * 0.35), len * (0.2 + r() * 0.25), 1, 10);
    }
    out.push({ pts, depth });
  };
  const n = 8;
  for (let i = 0; i < n; i++) branch(x0, y0, (i / n) * Math.PI * 2 + r() * 0.5, reach * (0.75 + r() * 0.5), 0, 28);
  return out;
}

type Line = { y: number; len: number; speed: number; phase: number; thick: number; color: number; alpha: number };
/** Tapered wedges streaming along x, flickering in thickness every other frame. */
function drawLines(g: Graphics, list: Line[], t: number, width: number, dir: number, ui: number, alpha: number, frame: number, r: () => number): void {
  g.clear();
  if (alpha <= 0.01) return;
  for (const s of list) {
    const p = (s.phase + t * s.speed) % 1;
    const len = s.len * width;
    const x = dir > 0 ? width * 0.7 - p * width * 1.9 : -width * 0.7 + p * width * 1.9 - len;
    const flick = frame % 2 === 0 ? 0.6 + r() * 0.8 : 1;
    const half = (s.thick * ui * flick) / 2;
    g.poly([x, s.y, x + len * 0.55, s.y - half, x + len, s.y, x + len * 0.55, s.y + half]).fill({ color: s.color, alpha: alpha * s.alpha });
  }
}

/** A tapered strip along a quadratic curve, between u0 and u1 (0..1); width peaks mid-window. */
function strip(g: Graphics, p0: number[], p1: number[], p2: number[], u0: number, u1: number, width: number, color: number, alpha: number, teeth = 0, seed = 0): void {
  const n = teeth ? 34 : 22;
  const top: number[] = [];
  const bot: number[] = [];
  for (let i = 0; i <= n; i++) {
    const u = u0 + (u1 - u0) * (i / n);
    const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
    const x = a * p0[0]! + b * p1[0]! + c * p2[0]!;
    const y = a * p0[1]! + b * p1[1]! + c * p2[1]!;
    const dx = 2 * (1 - u) * (p1[0]! - p0[0]!) + 2 * u * (p2[0]! - p1[0]!);
    const dy = 2 * (1 - u) * (p1[1]! - p0[1]!) + 2 * u * (p2[1]! - p1[1]!);
    const dl = Math.hypot(dx, dy) || 1;
    const jag = teeth ? (i % 2 ? 1 + teeth : 1 - teeth * 0.6) * (0.75 + 0.5 * (Math.sin(i * 12.9898 + seed * 78.233) * 0.5 + 0.5)) : 1;
    const half = (width / 2) * Math.sin(Math.PI * (i / n)) * jag;
    top.push(x - (dy / dl) * half, y + (dx / dl) * half);
    bot.unshift(x + (dy / dl) * half, y - (dx / dl) * half);
  }
  g.poly([...top, ...bot]).fill({ color, alpha });
}

export async function playFramed(o: CutInOptions): Promise<void> {
  const { w, h, ui, clock } = o;
  const pal = paletteFromArt(o.portrait);
  const night = mixColor(pal.deep, 0x000000, 0.55);
  const dir = o.enemy ? -1 : 1;
  const total = FRAMED_SECONDS;
  const T = { shut: 0.14, dark: 0.18, shatter: 0.46, slamEnd: 0.74, wedge: 0.54, stamp: 0.58, pulse: 1.35, impact: 1.95, white: 1.99, clear: 2.12 };
  const r = rng(o.skillName.length * 977 + o.actorName.length * 31);

  // --- Title sizes (decided first: the font is loaded before anything is drawn) -----------------------------
  const words = o.skillName.split(/\s+/).filter(Boolean);
  const heroIdx = words.length <= 1 ? 0 : words.reduce((best, wd, i) => (i > 0 && wd.length > (words[best]!.length) ? i : best), 1);
  const sizeOf = (i: number) => h * (i === heroIdx ? 0.15 : i === 0 && words.length > 1 ? 0.085 : 0.105);
  await titleFont(sizeOf(heroIdx));

  const root = new Container();
  root.eventMode = "static";
  root.cursor = "pointer";
  root.hitArea = { contains: () => true };

  // --- The picture's placement ------------------------------------------------------------------------------
  const tw = o.portrait.width;
  const th = o.portrait.height;
  const k = Math.max((w * 0.72) / tw, (h * 1.22) / th);
  const artW = tw * k;
  const artH = th * k;
  const focus = o.face ?? { x: 0.42, y: 0.32 };
  let artCX: number;
  if (artW >= w) artCX = Math.max(w - artW / 2, Math.min(artW / 2, w * 0.5 - (focus.x - 0.5) * artW));
  else artCX = dir > 0 ? Math.min(w * 0.6, w - 30 * ui - artW / 2) : Math.max(w * 0.4, 30 * ui + artW / 2);
  const artCY = artH >= h ? Math.max(h - artH / 2, Math.min(artH / 2, h * 0.54)) : h * 0.54;
  // The action point: right of centre in Inlay's composition (mirrored for the other side).
  const actionU = dir > 0 ? 0.62 : 0.38;
  const fp = { x: artCX + (actionU - 0.5) * artW, y: artCY };

  // --- The cut-in scene (revealed when the black shatters) ---------------------------------------------------
  const scene = new Container();
  const voidBg = new Graphics().rect(-w * 0.1, -h * 0.1, w * 1.2, h * 1.2).fill({ color: night });
  // A blurred, tinted echo of the picture fills the sides with its colour.
  const echo = new Sprite(o.portrait);
  echo.anchor.set(0.5);
  echo.scale.set(Math.max((w * 1.15) / tw, (h * 1.15) / th));
  echo.position.set(w / 2, h / 2);
  echo.tint = mixColor(pal.mid, 0x000000, 0.2);
  echo.alpha = 0.5;
  echo.blendMode = "add";
  echo.filters = [new BlurFilter({ strength: 32 * ui, quality: 4 })];
  // Speed ribbons at -18 deg, and two wide counter-diagonal ribbons on the flanks.
  const tunnel = new Container();
  tunnel.position.set(w / 2, h / 2);
  tunnel.rotation = -0.31 * dir;
  const lines = new Graphics();
  lines.blendMode = "add";
  tunnel.addChild(lines);
  const diag = Math.hypot(w, h);
  const lineList: Line[] = [
    ...Array.from({ length: 21 }, () => ({ y: (r() - 0.5) * diag, len: 0.4 + r() * 0.5, speed: 1.3 + r() * 1.6, phase: r(), thick: 8 + r() * 20, color: r() < 0.6 ? pal.mid : pal.outer, alpha: 0.35 + r() * 0.3 })),
    ...Array.from({ length: 65 }, () => ({ y: (r() - 0.5) * diag, len: 0.15 + r() * 0.45, speed: 2 + r() * 2.6, phase: r(), thick: 2 + r() * 3, color: r() < 0.55 ? pal.hi : 0xffffff, alpha: 0.5 + r() * 0.4 })),
  ];
  const flanks = new Graphics();
  flanks.blendMode = "add";
  // Energy arcs sweeping across the picture, a bright window running along each.
  const arcs = Array.from({ length: 3 }, (_, i) => {
    const sx = (v: number) => (dir > 0 ? v : w - v);
    return {
      p0: [sx(w * (0.22 + i * 0.06)), h * 1.12], p1: [sx(w * (0.35 + i * 0.12)), h * (0.35 - i * 0.12)], p2: [sx(w * (0.96 - i * 0.03)), h * (0.08 + i * 0.1)],
      speed: 0.9 + i * 0.35, phase: i * 0.33, width: (16 + i * 6) * ui,
    };
  });
  const arcGlow = new Graphics();
  arcGlow.blendMode = "add";
  arcGlow.filters = [new BlurFilter({ strength: 6 * ui, quality: 2 })];
  const arcCore = new Graphics();
  arcCore.blendMode = "add";

  // The picture: colour channels as three additive copies (split on the slam), masked by a soft-edged sheet.
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
  const feather = new Sprite(softTexture("feather", Math.round(Math.min(0.15, Math.max(0.03, (90 * ui) / artW)) * 200) / 200));
  feather.anchor.set(0.5);
  feather.width = artW * 1.04;
  feather.height = artH * 1.04;
  feather.skew.x = -0.32 * dir;
  if (dir < 0) feather.scale.x *= -1;
  art.addChild(pic, feather);
  art.mask = feather;
  // Flare on the action: violet haze, crimson burst, a white lens cross.
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
  cross.rotation = -0.21;
  cross.poly([-w * 0.275, 0, 0, -3 * ui, w * 0.275, 0, 0, 3 * ui]).fill({ color: 0xffffff, alpha: 0.95 });
  cross.poly([0, -h * 0.175, 2 * ui, 0, 0, h * 0.175, -2 * ui, 0]).fill({ color: 0xffffff, alpha: 0.95 });
  flare.addChild(haze, burst, core, cross);

  // Embers and bokeh, behind and in front.
  type Mote = { x: number; y: number; v: number; size: number; front: boolean; big: boolean };
  // Rising at 65 degrees, drifting toward the far side.
  const vx = Math.cos(65 * (Math.PI / 180)) * dir;
  const vy = -Math.sin(65 * (Math.PI / 180));
  const motes: Mote[] = [
    ...Array.from({ length: 6 }, () => ({ x: r() * w, y: r() * h, v: (500 + r() * 200) * ui, size: (24 + r() * 24) * ui, front: true, big: true })),
    ...Array.from({ length: 29 }, () => ({ x: r() * w, y: r() * h, v: (180 + r() * 260) * ui, size: (6 + r() * 10) * ui, front: r() < 0.5, big: false })),
  ];
  const motesBack = new Graphics();
  const motesFront = new Graphics();
  const bokeh = new Graphics();
  motesBack.blendMode = motesFront.blendMode = bokeh.blendMode = "add";
  bokeh.filters = [new BlurFilter({ strength: 6 * ui, quality: 2 })];
  const drawMotes = (t: number, alpha: number) => {
    motesBack.clear();
    motesFront.clear();
    bokeh.clear();
    if (alpha <= 0.01) return;
    for (const m of motes) {
      const x = (((m.x + vx * m.v * t) % (w * 1.2)) + w * 1.2) % (w * 1.2) - w * 0.1;
      const y = (((m.y + vy * m.v * t) % (h * 1.2)) + h * 1.2) % (h * 1.2) - h * 0.1;
      const L = m.size;
      const W = m.size * (m.big ? 0.22 : 0.18);
      const nx = -vy, ny = vx;
      const pts = [x - vx * L, y - vy * L, x + nx * W, y + ny * W, x + vx * L, y + vy * L, x - nx * W, y - ny * W];
      if (m.big) bokeh.poly(pts).fill({ color: pal.mid, alpha: 0.7 * alpha });
      else {
        const g = m.front ? motesFront : motesBack;
        g.poly(pts.map((v, i) => (i % 2 === 0 ? x + (v - x) * 1.8 : y + (v - y) * 1.8))).fill({ color: pal.mid, alpha: 0.45 * alpha });
        g.poly(pts).fill({ color: 0xffffff, alpha: 0.9 * alpha });
      }
    }
  };

  // The wedge (doubled edge) and the name stamped on it.
  const sx = (v: number) => (dir > 0 ? v : w - v);
  const wedge = new Graphics();
  const A = [sx(0), h * 0.12];
  const B = [sx(w * 0.46), h];
  wedge.poly([A[0]!, A[1]!, B[0]!, B[1]!, sx(0), h]).fill({ color: 0x000000, alpha: 0.97 });
  {
    const ex = B[0]! - A[0]!, ey = B[1]! - A[1]!;
    const el = Math.hypot(ex, ey);
    // Outward normal (away from the wedge, toward the picture).
    let nx = ey / el, ny = -ex / el;
    if (nx * dir < 0) { nx = -nx; ny = -ny; }
    const line = (off: number, width: number, color: number) => {
      wedge.moveTo(A[0]! + nx * off - (ex / el) * 40 * ui, A[1]! + ny * off - (ey / el) * 40 * ui).lineTo(B[0]! + nx * off + (ex / el) * 40 * ui, B[1]! + ny * off + (ey / el) * 40 * ui).stroke({ color, width });
    };
    line(2.5 * ui, 5 * ui, pal.mid);
    line(9.75 * ui, 1.5 * ui, 0xffffff);
  }
  const stamps = words.map((word, i) => {
    const size = sizeOf(i);
    const t = new Text({
      text: word.toUpperCase(),
      style: textStyle(`cutin-w-${Math.round(size)}-${i === 0 && words.length > 1 ? 1 : 0}-${pal.deep}`, {
        fontFamily: TITLE_FONT, fontSize: Math.round(size), fontWeight: "800", fill: 0xffffff, letterSpacing: i === 0 && words.length > 1 ? 3 * ui : 0.5 * ui,
        stroke: { color: 0x000000, width: Math.max(5, size * 0.12), join: "round" },
        dropShadow: { color: mixColor(pal.deep, 0x000000, 0.3), alpha: 1, blur: 0, distance: Math.max(3, size * 0.07), angle: Math.PI / 4 },
      }),
    });
    t.anchor.set(dir > 0 ? 0 : 1, 0.5);
    t.skew.x = -0.18 * dir;
    t.rotation = -0.07 * dir;
    return t;
  });
  // Fit the widest word to the wedge.
  const widest = Math.max(1, ...stamps.map((s) => s.width));
  const fit = Math.min(1, (w * 0.44) / widest);
  for (const s of stamps) s.scale.set(fit);
  const rest = stamps.map(() => fit);
  // Stack from the bottom up, indented to follow the wedge.
  let y = h - sizeOf(words.length - 1) * fit * 0.62;
  const ys: number[] = [];
  for (let i = words.length - 1; i >= 0; i--) {
    ys[i] = y;
    if (i > 0) y -= (sizeOf(i) * 0.5 + sizeOf(i - 1) * 0.5) * fit * 1.02;
  }
  stamps.forEach((s, i) => {
    const indent = w * (i === words.length - 1 && words.length > 2 ? 0.085 : i === heroIdx ? 0.04 : 0.045);
    s.position.set(sx(indent), ys[i]!);
  });
  const baseX = stamps.map((s) => s.x);
  const tagSize = Math.round(Math.max(11 * ui, Math.min(h * 0.026, 24)));
  const tag = new Text({ text: o.actorName.toUpperCase(), style: textStyle(`cutin-tag-${tagSize}`, { fontFamily: FONT_UI, fontSize: tagSize, fontWeight: "800", fill: 0xffffff, letterSpacing: tagSize * 0.3 }) });
  tag.anchor.set(dir > 0 ? 0 : 1, 0.5);
  const tagBox = new Graphics();
  const tagY = (ys[0] ?? h * 0.8) - sizeOf(0) * fit * 0.62 - tagSize * 0.9;
  const tagX = sx(w * 0.045);
  const tagW = tag.width + tagSize * 1.4;
  const tagH = tagSize * 1.7;
  const tx0 = dir > 0 ? tagX : tagX - tagW;
  tagBox.poly([tx0 + tagH * 0.3, tagY - tagH / 2, tx0 + tagW + tagH * 0.3, tagY - tagH / 2, tx0 + tagW, tagY + tagH / 2, tx0, tagY + tagH / 2]).fill({ color: pal.mid });
  const tagBaseX = tagX + dir * tagSize * 0.75;
  tag.position.set(tagBaseX, tagY);
  const nameBox = new Container();
  nameBox.addChild(tagBox, tag, ...stamps);

  const fx = new Container();
  scene.addChild(voidBg, echo, flanks, tunnel, motesBack, art, arcGlow, arcCore, motesFront, bokeh, fx, wedge);
  art.addChild(flare);
  flare.position.set((actionU - 0.5) * artW, (0.5 - 0.5) * artH);

  // --- Pre-roll: shutters, cracks, shards -----------------------------------------------------------------
  const pre = new Container();
  const shutTop = new Graphics().rect(0, 0, w, h / 2 + 2).fill({ color: 0x000000 });
  const shutBot = new Graphics().rect(0, 0, w, h / 2 + 2).fill({ color: 0x000000 });
  const slit = new Graphics();
  slit.rect(-w / 2, -14 * ui, w, 28 * ui).fill({ color: pal.mid, alpha: 0.45 });
  slit.rect(-w / 2, -6 * ui, w, 12 * ui).fill({ color: pal.hi, alpha: 0.6 });
  slit.rect(-w / 2, -2 * ui, w, 4 * ui).fill({ color: 0xffffff });
  const cast = new Graphics().rect(0, 0, w, h).fill({ color: pal.mid });
  cast.blendMode = "multiply";
  slit.position.set(w / 2, h / 2);
  slit.blendMode = "add";
  const black = new Graphics().rect(0, 0, w, h).fill({ color: 0x000000 });
  const cracks = crackPaths(fp.x, fp.y, diag * 0.8, r);
  const maxR = diag * 0.8;
  const crackGlow = new Graphics();
  crackGlow.filters = [new BlurFilter({ strength: 8 * ui, quality: 3 })];
  crackGlow.blendMode = "add";
  const crackCore = new Graphics();
  const hot = new Sprite(softTexture("glow"));
  hot.anchor.set(0.5);
  hot.position.set(fp.x, fp.y);
  hot.blendMode = "add";
  hot.tint = pal.hi;
  /** A branch as one filled shape, tapering from `w0` to a point, so joints never double up. */
  const taper = (g: Graphics, pts: number[], n: number, w0: number, color: number, alpha: number) => {
    const left: number[] = [];
    const right: number[] = [];
    for (let i = 0; i < n; i++) {
      const x = pts[i * 2]!, y = pts[i * 2 + 1]!;
      const j = Math.min(n - 1, i + 1), k0 = Math.max(0, i - 1);
      const dx = pts[j * 2]! - pts[k0 * 2]!, dy = pts[j * 2 + 1]! - pts[k0 * 2 + 1]!;
      const dl = Math.hypot(dx, dy) || 1;
      const u = i / Math.max(1, n - 1);
      const half = (w0 * (1 - u) ** 1.6 + 0.25 * ui) / 2;
      left.push(x - (dy / dl) * half, y + (dx / dl) * half);
      right.unshift(x + (dy / dl) * half, y - (dx / dl) * half);
    }
    g.poly([...left, ...right]).fill({ color, alpha });
  };
  const drawCracks = (reveal: number, pulse: number) => {
    crackGlow.clear();
    crackCore.clear();
    for (const c of cracks) {
      const n = Math.max(2, Math.floor((c.pts.length / 2) * reveal));
      const startF = 1 - Math.min(1, Math.hypot(c.pts[0]! - fp.x, c.pts[1]! - fp.y) / maxR);
      const w0 = (c.depth ? 4 * startF + 1 : 14) * ui;
      taper(crackGlow, c.pts, n, w0 * 2.6, pal.mid, 0.85 * pulse);
      taper(crackCore, c.pts, n, w0, 0xffffff, Math.min(1, pulse));
    }
  };
  const darkLayer = new Container();
  darkLayer.addChild(black, crackGlow, crackCore, hot);
  // The burst behind the shards, and the shards: a fan around the action point with a hole in the middle.
  const burstWhite = new Graphics().rect(-w * 0.1, -h * 0.1, w * 1.2, h * 1.2).fill({ color: 0xffffff });
  const shardBox = new Container();
  const shardCount = 26;
  const R = diag * 1.2;
  const hole = h * 0.06;
  const shards = Array.from({ length: shardCount }, (_, i) => {
    const a0 = (i / shardCount) * Math.PI * 2 + (r() - 0.5) * 0.08;
    const a1 = ((i + 1) / shardCount) * Math.PI * 2 + (r() - 0.5) * 0.08;
    const mid = (a0 + a1) / 2;
    const g = new Graphics();
    const i0 = [Math.cos(a0) * hole, Math.sin(a0) * hole];
    const i1 = [Math.cos(a1) * hole, Math.sin(a1) * hole];
    g.poly([i0[0]!, i0[1]!, Math.cos(a0) * R, Math.sin(a0) * R, Math.cos(a1) * R, Math.sin(a1) * R, i1[0]!, i1[1]!]).fill({ color: 0x050208 });
    // The edges burn: an accent glow under an accent rim, the inner edge white-hot.
    const outline = [i0[0]!, i0[1]!, Math.cos(a0) * R, Math.sin(a0) * R, Math.cos(a1) * R, Math.sin(a1) * R, i1[0]!, i1[1]!];
    g.poly(outline).stroke({ color: pal.mid, width: 10 * ui, alpha: 0.45, join: "miter" });
    g.poly(outline).stroke({ color: pal.mid, width: 3 * ui, join: "miter" });
    g.moveTo(i0[0]!, i0[1]!).lineTo(i1[0]!, i1[1]!).stroke({ color: 0xffffff, width: 3 * ui });
    // Tumble about the shard's own middle, not the action point.
    const cxm = (i0[0]! + i1[0]! + Math.cos(a0) * R * 0.5 + Math.cos(a1) * R * 0.5) / 4;
    const cym = (i0[1]! + i1[1]! + Math.sin(a0) * R * 0.5 + Math.sin(a1) * R * 0.5) / 4;
    g.pivot.set(cxm, cym);
    g.position.set(fp.x + cxm, fp.y + cym);
    return { g, ang: mid, cx: cxm, cy: cym, spin: (r() - 0.5) * 3, speed: 1 + r() * 0.8, tumble: 6 + r() * 10 };
  });
  for (const s of shards) shardBox.addChild(s.g);
  pre.addChild(cast, darkLayer, burstWhite, shardBox, shutTop, shutBot, slit);

  // --- The ending: impact frame, white, spikes ------------------------------------------------------------
  const impact = new Container();
  impact.addChild(new Graphics().rect(-w * 0.1, -h * 0.1, w * 1.2, h * 1.2).fill({ color: pal.mid }));
  const inked = inkOf(o.portrait);
  /** The ink as the picture sits at the end of its push, with the picture's own soft edges. */
  const inkSprite = (tex: Texture, alpha: number) => {
    const box = new Container();
    box.position.set(artCX - (focus.x - 0.5) * artW * 0.08, artCY - (focus.y - 0.5) * artH * 0.08);
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.width = artW * 1.08;
    s.height = artH * 1.08;
    const m = new Sprite(feather.texture);
    m.anchor.set(0.5);
    m.width = artW * 1.12;
    m.height = artH * 1.12;
    m.skew.x = feather.skew.x;
    if (dir < 0) m.scale.x *= -1;
    box.addChild(s, m);
    box.mask = m;
    box.alpha = alpha;
    return box;
  };
  if (inked) impact.addChild(inkSprite(inked.poster, 1));
  const whiteInk = inked ? inkSprite(inked.ink, 0.15) : null;
  const white = new Graphics().rect(-w * 0.1, -h * 0.1, w * 1.2, h * 1.2).fill({ color: 0xffffff });
  const spikes = new Graphics();
  const spikeList = Array.from({ length: 44 }, (_, i) => {
    const a = (i / 44) * Math.PI * 2 + (r() - 0.5) * 0.12;
    const d0 = diag * (0.06 + r() * 0.14);
    return { a, d0, d1: d0 + diag * (0.3 + r() * 0.2), wid: (i % 2 ? 2 + r() * 2 : 8 + r() * 14) * ui };
  });
  const top = new Container();
  root.addChild(scene, pre, impact, white, ...(whiteInk ? [whiteInk] : []), spikes, nameBox, top);
  o.layer.addChild(root);

  const fxCtx: FxContext = {
    w, h, ui, band: { cx: w / 2, cy: h / 2, angle: -0.31 * dir, len: diag, thick: h }, palette: [pal.deep, pal.mid, pal.hi], slam: T.shatter, total,
    face: { x: fp.x, y: fp.y }, portrait: { texture: o.portrait, sprite: chan[0]! }, under: fx, over: fx, top,
  };
  const layers = buildFx(resolveFx(o.visual?.fx), fxCtx);

  let skipped = false;
  root.on("pointertap", () => { skipped = true; });
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
      // 1. Shutters slam shut; the slit ignites as they meet and snaps closed.
      const sh = ease.inCubic(span(t, 0, T.shut));
      shutTop.y = -h / 2 - 2 + sh * (h / 2 + 2);
      shutBot.y = h - sh * (h / 2 + 2);
      shutTop.visible = shutBot.visible = t < T.dark;
      cast.visible = t < T.dark;
      cast.alpha = 0.65 * sh;
      slit.visible = t >= T.shut - 0.005 && t < T.dark + 0.03;
      slit.scale.x = 1 - ease.inCubic(span(t, T.shut + 0.01, T.dark + 0.03));
      // 2. Cracks in three steps, pulsing, a hot core leaking light.
      darkLayer.visible = t >= T.shut && t < T.shatter;
      if (darkLayer.visible) {
        const reveal = t < T.dark ? 0 : t < 0.24 ? 0.34 : t < 0.3 ? 0.67 : 1;
        drawCracks(reveal, 0.85 + 0.25 * Math.sin(t * 47));
        const g = span(t, T.dark, T.shatter);
        hot.width = hot.height = (20 + 120 * g * g) * ui * 2 * (1 + (r() - 0.5) * 0.5);
        hot.alpha = 0.6 + 0.4 * g;
      }
      // 3. Shatter: shards fly out (tumbling) over a white burst; the scene is behind.
      const sp = span(t, T.shatter, T.shatter + 0.3);
      shardBox.visible = t >= T.shatter && sp < 1;
      burstWhite.visible = shardBox.visible;
      burstWhite.alpha = 0.95 * (1 - ease.outCubic(span(t, T.shatter + 0.03, T.shatter + 0.12)));
      if (shardBox.visible) {
        for (const s of shards) {
          const d = (0.5 * sp + 0.9 * sp * sp) * R * 0.8 * s.speed;
          s.g.x = fp.x + s.cx + Math.cos(s.ang) * d;
          s.g.y = fp.y + s.cy + Math.sin(s.ang) * d;
          s.g.rotation = s.spin * sp;
          s.g.scale.set((0.35 + 0.65 * Math.abs(Math.cos(sp * s.tumble))) * (1 + 0.6 * sp), 1 + 0.6 * sp);
        }
      }
      scene.visible = t >= T.shatter;
      // The picture: slam 155% -> 100%, split channels decaying, then a trembling push to 108%; a pulse mid-hold.
      const slamK = ease.outExpo(span(t, T.shatter, T.slamEnd));
      const push = span(t, T.slamEnd, T.impact);
      pic.scale.set(1.55 - 0.55 * slamK + 0.08 * push);
      const pulse = t >= T.pulse ? Math.exp(-(t - T.pulse) * 14) : 0;
      const split = (t < T.shatter ? 0 : Math.exp(-(t - T.shatter) * 14) * 24 + pulse * 6) * ui;
      const jit = split > 0.5 * ui ? (r() - 0.5) * 5 * ui * Math.min(1, split / (20 * ui)) : 0;
      chan[0]!.position.set(-split * dir * 0.97 + jit, split * 0.25);
      chan[1]!.position.set(split * dir * 0.97 - jit, -split * 0.25);
      const holding = t >= T.slamEnd && t < T.impact;
      art.x = artCX + (holding ? (r() - 0.5) * 6 * ui : 0);
      art.y = artCY - 10 * ui * push + (holding ? (r() - 0.5) * 6 * ui : 0);
      const flareK = (1 + 0.8 * (1 - slamK)) * (1 + 0.8 * pulse);
      haze.width = haze.height = h * 0.9 * flareK;
      haze.alpha = 0.45;
      burst.width = burst.height = h * 0.44 * flareK * (1 + 0.18 * Math.sin(t * Math.PI * 2 * 20));
      burst.alpha = 0.85;
      core.width = core.height = h * 0.16 * flareK;
      cross.scale.set((0.9 + 0.1 * Math.sin(t * 31)) * flareK, flareK);
      flare.alpha = t < T.shatter ? 0 : 1;
      // Echo, tunnel, flanks, arcs, motes.
      const live = t < T.shatter ? 0 : 1 - span(t, T.impact, T.white);
      echo.alpha = 0.5 * live;
      drawLines(lines, lineList, t, diag, dir, ui, live, frame, r);
      flanks.clear();
      if (live > 0) {
        for (const fx0 of [0.12, 0.9]) {
          const cx = sx(w * fx0) + dir * -(t * 40 * ui);
          const fw = w * 0.14;
          const ang = 55 * (Math.PI / 180) * dir;
          const dx = Math.cos(ang) * h, dy = Math.sin(ang) * h;
          const nx = -Math.sin(ang) * fw / 2, ny = Math.cos(ang) * fw / 2;
          flanks.poly([cx - dx + nx, h / 2 - dy + ny, cx + dx + nx, h / 2 + dy + ny, cx + dx - nx, h / 2 + dy - ny, cx - dx - nx, h / 2 - dy - ny]).fill({ color: pal.mid, alpha: 0.18 * live });
        }
      }
      arcGlow.clear();
      arcCore.clear();
      const arcIn = span(t, T.shatter + 0.1, T.slamEnd + 0.1);
      if (live > 0 && arcIn > 0) {
        for (const a of arcs) {
          const u0 = ((a.phase + t * a.speed) % 1.6) - 0.35;
          const u1 = u0 + 0.38;
          const lo = Math.max(0, u0), hi = Math.min(1, u1);
          if (hi - lo < 0.02) continue;
          const seed = Math.floor(t * 30);
          strip(arcGlow, a.p0, a.p1, a.p2, lo, hi, a.width * 2.2, pal.outer, 0.6 * live * arcIn);
          strip(arcCore, a.p0, a.p1, a.p2, lo, hi, a.width * 1.1, pal.mid, 0.85 * live * arcIn, 0.55, seed);
          strip(arcCore, a.p0, a.p1, a.p2, lo, hi, 7 * ui, 0xffffff, 0.95 * live * arcIn, 0.4, seed + 1);
          strip(arcCore, a.p0, a.p1, a.p2, 0, 1, a.width * 0.35, pal.outer, 0.12 * live * arcIn);
        }
      }
      drawMotes(t, live);
      // The wedge slides in; the words stamp (220% -> 100%), the tag slides in with a flicker.
      wedge.x = -dir * w * 0.35 * (1 - ease.outCubic(span(t, T.wedge, T.wedge + 0.12)));
      wedge.visible = t >= T.wedge;
      nameBox.visible = t >= T.stamp;
      let landed = -1;
      stamps.forEach((s, i) => {
        const at = T.stamp + i * 0.08;
        const p = span(t, at, at + 0.07);
        s.alpha = t < at ? 0 : 1;
        s.scale.set(rest[i]! * (2.2 - 1.2 * inQuad(p)));
        if (p >= 1) landed = i;
      });
      const tagAt = T.stamp + words.length * 0.08 + 0.03;
      const tp = span(t, tagAt, tagAt + 0.12);
      tagBox.alpha = tag.alpha = tp;
      tag.x = tagBaseX + (tp > 0 && tp < 1 ? Math.sin(t * 90) * 10 * ui * (1 - tp) : 0);
      // Shake: the slam, and a bump as each word lands.
      let shake = 0;
      if (t >= T.shatter && t < T.shatter + 0.25) shake = 9 * (1 - (t - T.shatter) / 0.25) ** 2;
      for (let i = 0; i <= landed; i++) {
        const at = T.stamp + i * 0.08 + 0.07;
        if (t >= at && t < at + 0.07) shake = Math.max(shake, 4 * (1 - (t - at) / 0.07));
      }
      root.x = shake ? (r() - 0.5) * 2 * shake * ui : 0;
      root.y = shake ? (r() - 0.5) * 2 * shake * ui : 0;
      // The end: an accent impact frame, pure white with black spikes converging on the action, the name burned
      // in black; then the white clears as the words split apart.
      impact.visible = t >= T.impact && t < T.white;
      if (whiteInk) whiteInk.alpha = t >= T.white && t < T.clear ? 0.15 : 0;
      white.alpha = t < T.white ? 0 : 1 - ease.outCubic(span(t, T.clear, total));
      scene.visible = scene.visible && t < T.white;
      spikes.clear();
      if (t >= T.impact && t < T.clear) {
        for (const s of spikeList) {
          if (r() < 0.3) continue;
          const ca = Math.cos(s.a), sa = Math.sin(s.a);
          const nx = -sa * s.wid / 2, ny = ca * s.wid / 2;
          const x0 = fp.x + ca * s.d0, y0 = fp.y + sa * s.d0;
          const x1 = fp.x + ca * s.d1, y1 = fp.y + sa * s.d1;
          // Sharp toward the action, thick at the outside.
          spikes.poly([x0, y0, x1 + nx, y1 + ny, x1 - nx, y1 - ny]).fill({ color: t < T.white ? 0xffffff : 0x000000 });
        }
      }
      const burned = t >= T.white;
      for (const s of stamps) s.tint = burned ? 0x111111 : 0xffffff;
      tagBox.tint = burned ? 0x111111 : 0xffffff;
      if (t >= T.clear - 0.06) {
        const out = ease.inCubic(span(t, T.clear - 0.06, T.clear + 0.02));
        stamps.forEach((s, i) => {
          s.x = baseX[i]! + (i % 2 === 0 ? 1 : -1) * 220 * ui * out;
        });
        nameBox.alpha = 1 - span(t, T.clear - 0.03, T.clear + 0.02);
      }
      root.alpha = 1 - span(t, total - 0.12, total);
      for (const l of layers) l.update(t);
      if (t >= total) {
        stop();
        resolve();
      }
    });
  });
  if (skipped) await clock.tween(140, (k2) => { root.alpha = 1 - k2; });
  root.destroy({ children: true });
}
