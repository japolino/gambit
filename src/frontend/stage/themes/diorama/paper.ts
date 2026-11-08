/**
 * Paper-craft materials for the Diorama battle, drawn in Pixi: card stock,
 * kraft and manila textures (the same laid-paper generator the scene's shop
 * uses), masking tape, a brass eyelet, twine, a push-pin, rubber-stamp ink,
 * and the type. Everything is generated once per page and cached.
 */
import { Container, Graphics, Sprite, Text, Texture, type TextStyleOptions } from "pixi.js";
import { paper } from "../../../scene/themes/diorama/textures.js";
import { rng } from "../../../scene/themes/contract.js";

export const FELL = '"Gambit Fell", "Gambit Garamond", Georgia, serif';
export const GARA = '"Gambit Garamond", "Palatino Linotype", Georgia, serif';
export const CINZEL = '"Gambit Cinzel", "Gambit Garamond", Georgia, serif';

/** Ink and paper colours. */
export const P = {
  ink: 0x24140a,
  inkSoft: 0x5a3e24,
  inkFaint: 0x8a6e50,
  red: 0xa8231b,
  redInk: 0xb3261e,
  blueInk: 0x2c4f8a,
  pencil: 0x6b6258,
  card: 0xf3ead2,
  kraft: 0xc9a274,
  manila: 0xe8cf94,
  brass: 0xc8963e,
  brassHi: 0xfbe7a8,
  brassDark: 0x6e4718,
  oak: 0x8a5a30,
  twine: 0xc8a46a,
  glow: 0xffe066,
  ally: 0x2f5f9a,
};

const texCache = new Map<string, Texture>();
function cached(key: string, make: () => HTMLCanvasElement): Texture {
  let t = texCache.get(key);
  if (!t || t.destroyed) {
    t = Texture.from(make());
    texCache.set(key, t);
  }
  return t;
}

export type Stock = "card" | "kraft" | "manila" | "photo";
const TONES: Record<Stock, [number, number, number]> = {
  card: [244, 236, 214],
  kraft: [200, 162, 114],
  manila: [232, 206, 146],
  photo: [250, 247, 238],
};
/** A sheet of paper stock (512², fibres and laid lines), to fill shapes with. */
export function stock(kind: Stock): Texture {
  return cached(`stock:${kind}`, () => paper(kind === "kraft" ? 71 : kind === "manila" ? 23 : 41, 512, 512, TONES[kind]));
}

/** A strip of masking tape: translucent, with torn ends and a little crinkle. */
export function tapeTexture(): Texture {
  return cached("tape", () => {
    const c = document.createElement("canvas");
    c.width = 160;
    c.height = 44;
    const g = c.getContext("2d")!;
    const r = rng(9);
    g.beginPath();
    g.moveTo(6, 2);
    for (let y = 2; y <= 42; y += 4) g.lineTo(2 + r() * 7, y);
    for (let x = 6; x <= 154; x += 8) g.lineTo(x, 42 - r() * 1.5);
    for (let y = 42; y >= 2; y -= 4) g.lineTo(152 + r() * 7, y);
    for (let x = 154; x >= 6; x -= 8) g.lineTo(x, 2 + r() * 1.5);
    g.closePath();
    g.fillStyle = "rgba(236,222,180,0.82)";
    g.fill();
    g.save();
    g.clip();
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(${r() > 0.5 ? "255,250,230" : "150,120,70"},${0.05 + r() * 0.08})`;
      g.fillRect(r() * 160, r() * 44, 1 + r() * 10, 1);
    }
    const sh = g.createLinearGradient(0, 0, 0, 44);
    sh.addColorStop(0, "rgba(255,255,255,0.18)");
    sh.addColorStop(1, "rgba(120,90,40,0.12)");
    g.fillStyle = sh;
    g.fillRect(0, 0, 160, 44);
    g.restore();
    return c;
  });
}

/** A strip of tape laid across a point at an angle. */
export function tape(x: number, y: number, len: number, thick: number, angle: number): Sprite {
  const s = new Sprite(tapeTexture());
  s.anchor.set(0.5);
  s.width = len;
  s.height = thick;
  s.position.set(x, y);
  s.rotation = angle;
  return s;
}

/** A soft drop shadow under a polygon (the paper sits on wood under a lamp: offset down and a little right). */
export function shadowPoly(g: Graphics, pts: number[], ui: number, lift = 1): void {
  const dx = 2.5 * ui * lift;
  const dy = 5 * ui * lift;
  for (let i = 3; i >= 1; i--) {
    const k = i * 1.6 * ui * lift;
    const p = pts.map((v, j) => v + (j % 2 ? dy : dx) + (j % 2 ? k * 0.4 : 0));
    g.poly(p).fill({ color: 0x0a0402, alpha: 0.13 });
    void k;
  }
}

/** A brass eyelet (a punched hole with a ring). */
export function eyelet(g: Graphics, x: number, y: number, r: number): void {
  g.circle(x, y, r * 1.55).fill({ color: P.brassDark });
  g.circle(x, y, r * 1.4).fill({ color: P.brass });
  g.circle(x - r * 0.35, y - r * 0.4, r * 0.7).fill({ color: P.brassHi, alpha: 0.45 });
  g.circle(x, y, r).fill({ color: 0x1a0d05 });
}

/** A push-pin seen from above: a red bead with a highlight and a little shadow. */
export function pin(g: Graphics, x: number, y: number, r: number, color = 0xb02a20): void {
  g.ellipse(x + r * 0.5, y + r * 0.7, r * 1.05, r * 0.8).fill({ color: 0x000000, alpha: 0.35 });
  g.circle(x, y, r).fill({ color });
  g.circle(x, y, r * 0.72).fill({ color: 0xffffff, alpha: 0.08 });
  g.circle(x - r * 0.35, y - r * 0.38, r * 0.32).fill({ color: 0xffffff, alpha: 0.55 });
}

/** A hand-drawn rule: a line with a tiny wobble. */
export function inkLine(g: Graphics, x0: number, y0: number, x1: number, y1: number, width: number, color: number, alpha = 1, seed = 1): void {
  const r = rng(seed);
  const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 18));
  g.moveTo(x0, y0);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const j = i === n ? 0 : (r() - 0.5) * width * 0.9;
    g.lineTo(x0 + (x1 - x0) * t + j * 0.3, y0 + (y1 - y0) * t + j);
  }
  g.stroke({ width, color, alpha, cap: "round", join: "round" });
}

/** A rectangle drawn with slightly uneven edges, as if cut by hand (returns its points). */
export function cutRect(x: number, y: number, w: number, h: number, seed: number, wob = 1.2): number[] {
  const r = rng(seed);
  const j = () => (r() - 0.5) * wob * 2;
  return [x + j(), y + j(), x + w + j(), y + j(), x + w + j(), y + h + j(), x + j(), y + h + j()];
}

/** Text in the theme's type. */
export function txt(text: string, o: TextStyleOptions): Text {
  return new Text({ text, style: { fontFamily: FELL, fill: P.ink, ...o } });
}

/** Shrink a text to fit a width. */
export function fit(t: Text, w: number): void {
  t.scale.set(1);
  if (t.width > w && w > 0) t.scale.set(w / t.width);
}

/** A rubber stamp: letters in red ink, a ruled box, a little uneven. */
export function stamp(text: string, size: number, color = P.redInk, angle = -0.06): Container {
  const c = new Container();
  const t = txt(text.toUpperCase(), { fontFamily: CINZEL, fontWeight: "800", fontSize: size, fill: color, letterSpacing: size * 0.12 });
  t.alpha = 0.86;
  const padX = size * 0.45;
  const padY = size * 0.18;
  const box = new Graphics();
  box.roundRect(-padX, -padY, t.width + padX * 2, t.height + padY * 2, size * 0.18).stroke({ width: Math.max(1.2, size * 0.1), color, alpha: 0.78 });
  c.addChild(box, t);
  c.pivot.set(t.width / 2, t.height / 2);
  c.rotation = angle;
  return c;
}
