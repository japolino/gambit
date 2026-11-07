/**
 * Parametric FX layers for cut-ins (docs/DESIGN.md, 5.4): speed lines, ink
 * wash, embers, a glyph ring, an impact frame and a chromatic split. Each is
 * built from data (palette, band geometry, the slam time) and returns an
 * update(t) the template calls every frame (t in seconds from the start).
 * All drawn in code; no textures.
 */
import { BlurFilter, Container, Graphics, Sprite, type Texture } from "pixi.js";
import { mixColor } from "../theme.js";

export type FxName = "speed_lines" | "ink_wash" | "ember" | "glyph_ring" | "impact_frame" | "chromatic_split";

/** Names from the design's wider list mapped onto the six built here. */
const ALIASES: Readonly<Record<string, FxName>> = {
  speed_lines: "speed_lines", ink_wash: "ink_wash", ember: "ember", embers: "ember", glyph_ring: "glyph_ring",
  impact_frame: "impact_frame", chromatic_split: "chromatic_split",
  water_burst: "ink_wash", smoke_curl: "ink_wash", blood_mist: "ink_wash", lightning_fork: "speed_lines",
  shard_rain: "speed_lines", holy_rays: "glyph_ring", petal_storm: "ember", vignette_flash: "impact_frame",
};

export function resolveFx(names: readonly string[] | undefined): FxName[] {
  const out: FxName[] = [];
  for (const n of names ?? []) {
    const fx = ALIASES[n];
    if (fx && !out.includes(fx)) out.push(fx);
  }
  return out;
}

export type FxContext = {
  /** Screen size. */
  w: number;
  h: number;
  ui: number;
  /** Band centre, angle (radians), length and thickness. */
  band: { cx: number; cy: number; angle: number; len: number; thick: number };
  /** palette[0] dark, [1] mid, [2] light. */
  palette: number[];
  /** Seconds at which the name slams in. */
  slam: number;
  /** Total seconds. */
  total: number;
  /** Where the portrait's face is on screen. */
  face: { x: number; y: number };
  portrait: { texture: Texture; sprite: Sprite };
  /** Layers: behind the portrait (inside the band), in front of it, over everything. */
  under: Container;
  over: Container;
  top: Container;
};

export type FxLayer = { update(t: number): void };

const rand = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

function speedLines(ctx: FxContext): FxLayer {
  const g = new Graphics();
  g.blendMode = "add";
  ctx.over.addChild(g);
  const r = rand(11);
  const lines = Array.from({ length: 34 }, () => ({ y: (r() - 0.5) * ctx.band.thick * 1.1, speed: 1.2 + r() * 2.2, len: 0.15 + r() * 0.35, phase: r(), w: 0.6 + r() * 1.8 }));
  const color = ctx.palette[2] ?? 0xffffff;
  const { len } = ctx.band;
  return {
    update(t) {
      g.clear();
      const fade = Math.min(1, t / 0.12) * (1 - Math.max(0, (t - ctx.total + 0.3) / 0.3));
      for (const l of lines) {
        const x = ((l.phase - t * l.speed) % 1 + 1) % 1;
        const x0 = -len / 2 + x * len * 1.3;
        g.moveTo(x0, l.y).lineTo(x0 + l.len * len * 0.4, l.y).stroke({ width: l.w * ctx.ui, color, alpha: 0.32 * fade });
      }
    },
  };
}

function inkWash(ctx: FxContext): FxLayer {
  const g = new Graphics();
  g.filters = [new BlurFilter({ strength: 6 * ctx.ui, quality: 2 })];
  ctx.under.addChild(g);
  const r = rand(23);
  const ink = mixColor(ctx.palette[0] ?? 0x101010, 0x000000, 0.35);
  const tint = ctx.palette[1] ?? 0x445566;
  const blots = Array.from({ length: 16 }, () => ({
    x: (r() - 0.5) * ctx.band.len * 0.9,
    y: (r() < 0.5 ? -1 : 1) * ctx.band.thick * (0.25 + r() * 0.35),
    r: ctx.band.thick * (0.12 + r() * 0.22),
    at: 0.05 + r() * 0.5,
    tinted: r() < 0.3,
  }));
  return {
    update(t) {
      g.clear();
      const out = Math.max(0, (t - ctx.total + 0.35) / 0.35);
      for (const b of blots) {
        const k = Math.max(0, Math.min(1, (t - b.at) / 0.45));
        if (k <= 0) continue;
        const grow = 1 - (1 - k) ** 3;
        g.circle(b.x, b.y, b.r * (0.3 + grow)).fill({ color: b.tinted ? tint : ink, alpha: (b.tinted ? 0.35 : 0.75) * (1 - out) });
      }
    },
  };
}

function embers(ctx: FxContext): FxLayer {
  const g = new Graphics();
  g.blendMode = "add";
  ctx.over.addChild(g);
  const r = rand(37);
  const hot = mixColor(ctx.palette[1] ?? 0xc0533a, 0xffb060, 0.5);
  const parts = Array.from({ length: 46 }, () => ({
    x: (r() - 0.5) * ctx.band.len, y: (r() - 0.2) * ctx.band.thick * 0.9,
    vx: -40 - r() * 120, vy: -30 - r() * 90, size: 0.8 + r() * 2.2, born: r() * 0.9, life: 0.5 + r() * 0.6, wob: r() * 6,
  }));
  return {
    update(t) {
      g.clear();
      for (const p of parts) {
        const a = t - p.born;
        if (a < 0 || a > p.life) continue;
        const k = a / p.life;
        const x = p.x + (p.vx * a + Math.sin(a * 5 + p.wob) * 6) * ctx.ui;
        const y = p.y + p.vy * a * ctx.ui;
        g.circle(x, y, p.size * ctx.ui * (1 - k * 0.5)).fill({ color: hot, alpha: Math.sin(Math.PI * k) * 0.9 });
      }
    },
  };
}

function glyphRing(ctx: FxContext): FxLayer {
  const c = new Container();
  const g = new Graphics();
  g.blendMode = "add";
  c.addChild(g);
  ctx.top.addChild(c);
  const color = ctx.palette[2] ?? 0xffffff;
  const accent = ctx.palette[1] ?? 0x88aacc;
  const R = Math.min(ctx.band.thick * 0.62, ctx.w * 0.3);
  const r = rand(53);
  const marks = Array.from({ length: 18 }, () => r());
  const draw = () => {
    g.clear();
    g.circle(0, 0, R).stroke({ width: 1.2 * ctx.ui, color, alpha: 0.7 });
    g.circle(0, 0, R * 0.86).stroke({ width: 0.8 * ctx.ui, color: accent, alpha: 0.6 });
    for (let i = 0; i < 18; i += 1) {
      const a = (i / 18) * Math.PI * 2;
      const cx = Math.cos(a) * R * 0.93;
      const cy = Math.sin(a) * R * 0.93;
      const m = marks[i]!;
      const s = R * 0.045;
      // A rune: two strokes whose shape comes from the seed.
      g.moveTo(cx - s * Math.cos(a + m * 3), cy - s * Math.sin(a + m * 3)).lineTo(cx + s * Math.cos(a + m * 3), cy + s * Math.sin(a + m * 3));
      g.moveTo(cx, cy).lineTo(cx + s * Math.cos(a + 1.6 + m), cy + s * Math.sin(a + 1.6 + m));
    }
    g.stroke({ width: 1 * ctx.ui, color, alpha: 0.85 });
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      g.moveTo(Math.cos(a) * R * 1.02, Math.sin(a) * R * 1.02).lineTo(Math.cos(a) * R * 1.12, Math.sin(a) * R * 1.12);
    }
    g.stroke({ width: 1.5 * ctx.ui, color: accent, alpha: 0.8 });
  };
  draw();
  c.position.set(ctx.face.x, ctx.face.y);
  return {
    update(t) {
      const inK = Math.min(1, t / 0.35);
      const out = Math.max(0, (t - ctx.total + 0.3) / 0.3);
      c.position.set(ctx.face.x, ctx.face.y);
      c.rotation = t * 0.5;
      c.scale.set(1.35 - 0.35 * (1 - (1 - inK) ** 3));
      c.alpha = inK * (1 - out) * 0.9;
    },
  };
}

function impactFrame(ctx: FxContext): FxLayer {
  const c = new Container();
  const bg = new Graphics().rect(0, 0, ctx.w, ctx.h).fill({ color: 0xf4efe4 });
  const s = new Sprite(ctx.portrait.texture);
  s.tint = 0x000000;
  c.addChild(bg, s);
  c.visible = false;
  ctx.top.addChild(c);
  return {
    update(t) {
      const a = t - ctx.slam;
      c.visible = a >= 0 && a < 0.11;
      if (c.visible) {
        const src = ctx.portrait.sprite;
        const p = src.getGlobalPosition();
        s.position.set(p.x, p.y);
        s.scale.set(src.worldTransform.a, src.worldTransform.d);
        s.rotation = 0;
        // Second frame inverts: dark ground, pale figure.
        const second = a > 0.055;
        bg.tint = second ? 0x0a0908 : 0xffffff;
        s.tint = second ? 0xf4efe4 : 0x000000;
      }
    },
  };
}

function chromaticSplit(ctx: FxContext): FxLayer {
  const red = new Sprite(ctx.portrait.texture);
  const cyan = new Sprite(ctx.portrait.texture);
  red.tint = 0xff3a2a;
  cyan.tint = 0x2ad8ff;
  red.blendMode = "add";
  cyan.blendMode = "add";
  ctx.portrait.sprite.parent!.addChild(red, cyan);
  return {
    update(t) {
      const src = ctx.portrait.sprite;
      const near = Math.exp(-Math.abs(t - ctx.slam) / 0.09);
      const base = 0.15 + 0.85 * near;
      const d = (3 + 22 * near) * ctx.ui;
      for (const [s, dir] of [[red, -1], [cyan, 1]] as const) {
        s.position.set(src.x + dir * d, src.y);
        s.scale.copyFrom(src.scale);
        s.anchor.copyFrom(src.anchor);
        s.alpha = 0.35 * base * src.alpha;
      }
    },
  };
}

const BUILDERS: Readonly<Record<FxName, (ctx: FxContext) => FxLayer>> = {
  speed_lines: speedLines,
  ink_wash: inkWash,
  ember: embers,
  glyph_ring: glyphRing,
  impact_frame: impactFrame,
  chromatic_split: chromaticSplit,
};

export function buildFx(names: FxName[], ctx: FxContext): FxLayer[] {
  return names.map((n) => BUILDERS[n](ctx));
}
