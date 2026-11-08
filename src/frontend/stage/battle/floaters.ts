/**
 * Short-lived effects on the field: damage and heal numbers (crit, weak and
 * resisted each read differently), small status labels, the skill-name
 * plaque, hit sparks, the BREAK flash, screen flashes and shakes, and the
 * end-of-battle banner. Fire-and-forget unless the caller awaits.
 */
import { Container, Graphics, Text } from "pixi.js";
import type { Clock } from "../anim.js";
import { ease } from "../anim.js";
import { C, FONT_DISPLAY, FONT_NUMBER, FONT_UI, textStyle } from "../theme.js";

const numStyle = (size: number, color: number) => textStyle(`fnum${size}-${color}`, {
  fontFamily: FONT_NUMBER, fontSize: size, fontWeight: "700", fill: color,
  stroke: { color: C.outline, width: Math.max(3, size * 0.14), join: "round" },
  dropShadow: { color: 0x000000, alpha: 0.6, blur: 4, distance: 2, angle: Math.PI / 2 },
});
const tagStyle = (size: number, color: number) => textStyle(`ftag${size}-${color}`, {
  fontFamily: FONT_UI, fontSize: size, fontWeight: "700", fill: color, letterSpacing: size * 0.25,
  stroke: { color: C.outline, width: 3, join: "round" },
});
const displayStyle = (size: number, color: number, spacing = 0) => textStyle(`fdisp${size}-${color}-${spacing}`, {
  fontFamily: FONT_DISPLAY, fontSize: size, fontWeight: "700", fill: color, letterSpacing: spacing,
  stroke: { color: C.outline, width: Math.max(2, size * 0.06), join: "round" },
  dropShadow: { color: 0x000000, alpha: 0.7, blur: 8, distance: 0 },
});

export type NumberKind = "damage" | "heal" | "shield" | "tick" | "miss";

export type NumberOpts = { amount: number; kind: NumberKind; crit?: boolean; weak?: boolean; resisted?: boolean; absorbed?: boolean; color?: number };

export class Floaters {
  constructor(private layer: Container, private clock: Clock, private ui: () => number, private reduced: () => boolean) {}

  number(x: number, y: number, o: NumberOpts): void {
    const ui = this.ui();
    const c = new Container();
    c.position.set(x, y);
    let color: number = o.color ?? C.onArt;
    let size = 26;
    let tag = "";
    let tagColor: number = C.onArtDim;
    let text = String(Math.round(o.amount));
    if (o.kind === "heal") { color = C.heal; text = `+${text}`; }
    else if (o.kind === "shield") { color = C.shield; text = `+${text}`; size = 20; tag = "SHIELD"; tagColor = C.shield; }
    else if (o.kind === "miss") { color = C.miss; text = "Miss"; size = 20; }
    else if (o.kind === "tick") { size = 19; }
    if (o.absorbed) { tag = "ABSORBED"; tagColor = C.heal; }
    if (o.resisted) { color = C.resist; size = 21; tag = "RESIST"; tagColor = C.resist; }
    if (o.weak) { color = C.weak; size = 30; tag = "WEAK"; tagColor = C.weak; }
    if (o.crit) { color = C.crit; size = 36; tag = o.weak ? "WEAK · CRITICAL" : "CRITICAL"; tagColor = C.crit; }
    size = Math.round(size * ui);
    const t = new Text({ text, style: numStyle(size, color) });
    t.anchor.set(0.5, 1);
    c.addChild(t);
    if (tag) {
      const tt = new Text({ text: tag, style: tagStyle(Math.round((o.crit ? 13 : 10) * ui), tagColor) });
      tt.anchor.set(0.5, 1);
      tt.y = -t.height + 2 * ui;
      c.addChild(tt);
    }
    this.layer.addChild(c);
    const drift = (Math.random() - 0.5) * 18 * ui;
    const rise = (o.kind === "damage" ? 34 : 26) * ui;
    const reduced = this.reduced();
    void this.clock.tween(reduced ? 700 : 900, (k) => {
      // Damage slams down from large (a hit lands); heals and the rest swell up from small.
      const slam = o.kind === "damage";
      const pop = reduced ? 1 : k < 0.18 ? (slam ? ease.outCubic(k / 0.18) : ease.outBack(k / 0.18)) : 1;
      const grow = reduced ? 1 : slam ? 1.7 - 0.7 * pop : 0.6 + 0.4 * pop;
      c.scale.set((o.crit ? 1.25 : 1) * grow * (o.crit && k < 0.25 && !reduced ? 1.2 - k * 0.8 : 1));
      c.y = y - rise * ease.outCubic(Math.min(1, k * 1.6));
      c.x = x + drift * k;
      c.alpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    }, ease.linear).then(() => c.destroy({ children: true }));
  }

  label(x: number, y: number, text: string, color: number = C.onArt, size = 11): void {
    const ui = this.ui();
    const t = new Text({ text: text.toUpperCase(), style: tagStyle(Math.round(size * ui), color) });
    t.anchor.set(0.5, 1);
    t.position.set(x, y);
    this.layer.addChild(t);
    void this.clock.tween(900, (k) => {
      t.y = y - 16 * ui * ease.outCubic(k);
      t.alpha = k < 0.15 ? k / 0.15 : k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    }, ease.linear).then(() => t.destroy());
  }

  /** The skill-name plaque: a dark band with gold rules. */
  async banner(x: number, y: number, title: string, sub: string, accent: number = C.gold, ms = 900): Promise<void> {
    const ui = this.ui();
    const c = new Container();
    c.position.set(x, y);
    const t = new Text({ text: title, style: displayStyle(Math.round(20 * ui), C.onArt, 1) });
    t.anchor.set(0.5);
    const s = new Text({ text: sub.toUpperCase(), style: tagStyle(Math.round(8.5 * ui), C.onArtDim) });
    s.anchor.set(0.5);
    s.y = -t.height * 0.5 - 6 * ui;
    const w = Math.max(t.width, s.width) + 70 * ui;
    const h = t.height + 8 * ui;
    const g = new Graphics();
    g.rect(-w / 2, -h / 2, w, h).fill({ color: C.backing, alpha: 0.78 });
    g.rect(-w / 2, -h / 2, w, 1).fill({ color: accent, alpha: 0.7 });
    g.rect(-w / 2, h / 2 - 1, w, 1).fill({ color: accent, alpha: 0.7 });
    for (const sx of [-1, 1]) {
      const ex = (sx * w) / 2;
      g.poly([ex, -h / 2, ex + sx * 14 * ui, 0, ex, h / 2]).fill({ color: C.backing, alpha: 0.78 });
    }
    c.addChild(g, s, t);
    this.layer.addChild(c);
    await this.clock.tween(160, (k) => { c.alpha = k; c.scale.set(1, 0.6 + 0.4 * k); });
    await this.clock.wait(ms);
    await this.clock.tween(200, (k) => { c.alpha = 1 - k; });
    c.destroy({ children: true });
  }

  /** Slash sparks at an impact point. */
  spark(x: number, y: number, color: number, power = 1): void {
    if (this.reduced()) return;
    const ui = this.ui();
    const g = new Graphics();
    g.position.set(x, y);
    g.blendMode = "add";
    const n = 7 + Math.round(power * 4);
    const angles = Array.from({ length: n }, () => Math.random() * Math.PI * 2);
    const lens = angles.map(() => (24 + Math.random() * 30) * ui * power);
    this.layer.addChild(g);
    void this.clock.tween(260, (k) => {
      g.clear();
      const a = 1 - k;
      g.circle(0, 0, 10 * ui * power * (0.6 + k)).fill({ color, alpha: 0.35 * a });
      angles.forEach((ang, i) => {
        const r0 = lens[i]! * k * 0.4;
        const r1 = lens[i]! * (0.35 + k);
        g.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0).lineTo(Math.cos(ang) * r1, Math.sin(ang) * r1)
          .stroke({ width: 2 * ui * a + 0.5, color, alpha: a });
      });
    }, ease.outCubic).then(() => g.destroy());
  }

  /** BREAK: letter-spaced title slammed in, a slash through it, a bright edge. */
  async breakFlash(x: number, y: number): Promise<void> {
    const ui = this.ui();
    const c = new Container();
    c.position.set(x, y);
    const t = new Text({ text: "BREAK", style: displayStyle(Math.round(40 * ui), C.break, 10 * ui) });
    t.anchor.set(0.5);
    const g = new Graphics();
    c.addChild(g, t);
    this.layer.addChild(c);
    const reduced = this.reduced();
    await this.clock.tween(reduced ? 120 : 220, (k) => {
      c.scale.set(reduced ? 1 : 1.8 - 0.8 * ease.outExpo(k));
      c.alpha = k;
      g.clear();
      const w = t.width * 0.75 * k;
      g.moveTo(-w, 6 * ui).lineTo(w, -6 * ui).stroke({ width: 2 * ui, color: C.break, alpha: 0.9 });
    }, ease.linear);
    await this.clock.wait(380);
    await this.clock.tween(220, (k) => { c.alpha = 1 - k; c.y = y - 10 * ui * k; });
    c.destroy({ children: true });
  }

  async endBanner(w: number, h: number, title: string, color: number): Promise<void> {
    const ui = this.ui();
    const c = new Container();
    const g = new Graphics().rect(0, h * 0.4, w, h * 0.16).fill({ color: 0x050403, alpha: 0.8 });
    g.rect(0, h * 0.4, w, 1).fill({ color, alpha: 0.6 }).rect(0, h * 0.56 - 1, w, 1).fill({ color, alpha: 0.6 });
    const t = new Text({ text: title.toUpperCase(), style: displayStyle(Math.round(38 * ui), color, 12 * ui) });
    t.anchor.set(0.5);
    t.position.set(w / 2, h * 0.48);
    c.addChild(g, t);
    this.layer.addChild(c);
    await this.clock.tween(500, (k) => { c.alpha = k; t.scale.set(1.15 - 0.15 * k); });
  }
}

/** A brief full-screen colour flash on an overlay graphics. */
export async function screenFlash(overlay: Graphics, clock: Clock, w: number, h: number, color: number, alpha: number, ms: number): Promise<void> {
  overlay.clear().rect(0, 0, w, h).fill({ color });
  await clock.tween(ms, (k) => { overlay.alpha = alpha * (1 - k); }, ease.outCubic);
  overlay.clear();
}

/** Shake a container around its current position. */
export async function shake(target: Container, clock: Clock, magnitude: number, ms: number): Promise<void> {
  const x0 = target.x;
  const y0 = target.y;
  await clock.tween(ms, (k) => {
    const m = magnitude * (1 - k);
    target.x = x0 + (Math.random() - 0.5) * 2 * m;
    target.y = y0 + (Math.random() - 0.5) * 2 * m;
  }, ease.linear);
  target.position.set(x0, y0);
}
