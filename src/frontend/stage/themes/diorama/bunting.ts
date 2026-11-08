/**
 * The turn order as paper bunting strung across the top of the shop: a
 * length of twine sagging between two brass hooks, and on it one little
 * card per turn, clipped on with a wooden peg: a photo of who moves, edged
 * in red ink for a foe and blue for a friend. The one moving now hangs
 * lower and bigger with a NOW stamp. The cards slide along the twine and
 * sway when the order changes.
 */
import { Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import { TimelineStrip } from "../../battle/timeline-strip.js";
import type { Rect } from "../../battle/layout.js";
import { CINZEL, P, stock } from "./paper.js";

type Flag = { key: string; c: Container; sprite: Sprite; g: Graphics; x: number; target: number; size: number; swing: number; v: number; drawn: boolean };

export class Bunting extends TimelineStrip {
  protected line = new Graphics();
  protected flags: Flag[] = [];
  private nowStamp: Container | null = null;
  /** Reduced motion: no swinging. */
  still = false;

  constructor() {
    super();
    this.title.visible = false;
    this.addChildAt(this.line, 0);
  }

  /** The twine's height at x (a gentle catenary between the hooks). */
  protected sag(x: number): number {
    const w = Math.max(1, this.rect.w);
    const t = x / w;
    // Low enough at the hooks that the ACTING plate over a card's peg never meets the top of the screen.
    return this.ui * 22 + Math.sin(t * Math.PI) * this.rect.h * 0.22;
  }

  override place(rect: Rect, ui: number): void {
    this.rect = rect;
    this.ui = ui;
    this.position.set(rect.x, rect.y);
    this.bg.clear();
    this.title.visible = false;
    const l = this.line;
    l.clear();
    l.moveTo(0, this.sag(0));
    for (let x = 0; x <= rect.w; x += 12) l.lineTo(x, this.sag(x));
    l.stroke({ width: 2 * ui, color: P.twine });
    l.moveTo(0, this.sag(0) + 2 * ui);
    for (let x = 0; x <= rect.w; x += 12) l.lineTo(x, this.sag(x) + 2 * ui);
    l.stroke({ width: 1.5 * ui, color: 0x000000, alpha: 0.25 });
    for (const x of [0, rect.w]) {
      l.circle(x, this.sag(x), 6 * ui).stroke({ width: 2.5 * ui, color: P.brass });
      l.circle(x, this.sag(x) - 3 * ui, 2 * ui).fill({ color: P.brassHi });
    }
  }

  override set(order: Array<{ id: string; texture: Texture; enemy: boolean; alive: boolean }>): void {
    const ui = this.ui;
    const big = Math.round(this.rect.h * 0.82);
    const small = Math.round(big * 0.66);
    const gap = Math.round(10 * ui);
    const n = order.length;
    const needed = big + (n - 1) * (small + gap);
    const k = Math.min(1, (this.rect.w - 30 * ui) / Math.max(1, needed));
    let x = Math.max(16 * ui, (this.rect.w - needed * k) / 2);
    const old = this.flags;
    const next: Flag[] = [];
    order.forEach((o, i) => {
      const size = Math.max(4, Math.round((i === 0 ? big : small) * k));
      const key = `${o.id}#${order.slice(0, i).filter((p) => p.id === o.id).length}`;
      let f = old.find((c) => c.key === key);
      if (f) old.splice(old.indexOf(f), 1);
      else {
        const c = new Container();
        const g = new Graphics();
        const sprite = new Sprite(o.texture);
        const mask = new Graphics();
        c.addChild(g, sprite, mask);
        sprite.mask = mask;
        if (this.chipFilters.length) sprite.filters = this.chipFilters;
        c.alpha = 0;
        f = { key, c, sprite, g, x: x + 40 * ui, target: x, size, swing: 0.25, v: 0, drawn: false };
        this.addChild(c);
      }
      if (f.size !== size || f.sprite.texture !== o.texture || !f.drawn) {
        f.size = size;
        f.sprite.texture = o.texture;
        this.drawFlag(f, size, o.enemy, i === 0);
        f.swing += i === 0 ? 0.12 : 0.05;
      }
      f.target = x + size / 2;
      f.sprite.tint = o.alive ? 0xffffff : 0x555555;
      next.push(f);
      x += size + gap;
    });
    for (const gone of old) gone.c.destroy({ children: true });
    this.flags = next;
    this.nowStamp?.destroy({ children: true });
    this.nowStamp = null;
    const first = next[0];
    if (first) {
      // A little brass plate riveted to the acting card's peg.
      const c = new Container();
      const t = new Text({ text: "ACTING", style: { fontFamily: CINZEL, fontWeight: "800", fontSize: innerWidth <= 760 || innerHeight <= 480 ? 12 : Math.round(8.5 * ui), fill: 0x2a1404, letterSpacing: 1.2 * ui } });
      t.anchor.set(0.5);
      const g = new Graphics();
      const w = t.width + 12 * ui;
      const h = t.height + 4 * ui;
      g.roundRect(-w / 2 + 1, -h / 2 + 2, w, h, 2 * ui).fill({ color: 0x000000, alpha: 0.4 });
      g.roundRect(-w / 2, -h / 2, w, h, 2 * ui).fill({ color: P.brass }).stroke({ width: 1, color: P.brassDark });
      g.rect(-w / 2 + 2, -h / 2 + 1, w - 4, h * 0.35).fill({ color: P.brassHi, alpha: 0.4 });
      c.addChild(g, t);
      c.position.set(0, -6 * ui);
      first.c.addChild(c);
      this.nowStamp = c;
    }
  }

  /** One card on the twine: a peg at the top, the photo in a paper mount, a coloured ink edge. */
  private drawFlag(f: Flag, size: number, enemy: boolean, now: boolean): void {
    const ui = this.ui;
    const g = f.g;
    g.clear();
    const w = size;
    const h = size * 1.18;
    const x0 = -w / 2;
    const y0 = 8 * ui;
    g.rect(x0 + 3 * ui, y0 + 4 * ui, w, h).fill({ color: 0x000000, alpha: 0.35 });
    // Friends on cream card; foes on charred black card with a crimson wax trim.
    if (enemy) g.rect(x0, y0, w, h).fill({ color: 0x1e1612 }).stroke({ width: 1.5 * ui, color: 0x8e1c14 });
    else g.rect(x0, y0, w, h).fill({ texture: stock(now ? "manila" : "card"), color: 0xffffff, textureSpace: "local" });
    const b = Math.max(2, Math.round(w * 0.08));
    g.rect(x0, y0 + h - b * 1.6, w, b * 1.1).fill({ color: enemy ? 0x8e1c14 : P.ally, alpha: 0.9 });
    if (now) g.ellipse(0, y0 + h / 2, w * 0.95, h * 0.8).fill({ color: 0xffd070, alpha: 0.12 });
    g.rect(x0 + b, y0 + b, w - 2 * b, h - 3 * b).fill({ color: 0x2a1c12 });
    if (now) g.rect(x0 - 2 * ui, y0 - 2 * ui, w + 4 * ui, h + 4 * ui).stroke({ width: 2.5 * ui, color: P.glow, alpha: 0.95 });
    // The wooden peg clipping it to the twine.
    const pw = Math.max(5, 7 * ui);
    g.roundRect(-pw / 2, -4 * ui, pw, 18 * ui, 2 * ui).fill({ color: 0xc89a62 }).stroke({ width: 1, color: 0x6a4420 });
    g.rect(-pw / 2, 4 * ui, pw, 2 * ui).fill({ color: 0x8a8a8a });
    const mask = f.c.children[2] as Graphics;
    mask.clear().rect(x0 + b, y0 + b, w - 2 * b, h - 3 * b).fill({ color: 0xffffff });
    const tex = f.sprite.texture;
    const s = Math.max((w - 2 * b) / Math.max(1, tex.width), (h - 3 * b) / Math.max(1, tex.height));
    f.sprite.scale.set(s);
    f.sprite.position.set(-tex.width * s / 2, y0 + b);
    f.drawn = true;
  }

  override update(dt: number): void {
    const a = 1 - Math.exp(-dt / 0.12);
    for (const f of this.flags) {
      f.x += (f.target - f.x) * a;
      // A damped swing on the peg.
      if (this.still) f.swing = f.v = 0;
      f.v += (-f.swing * 40 - f.v * 4) * dt;
      f.swing += f.v * dt;
      f.c.position.set(f.x, this.sag(f.x) - 4 * this.ui);
      f.c.rotation = f.swing * 0.5;
      f.c.alpha += (1 - f.c.alpha) * a;
    }
  }
}
