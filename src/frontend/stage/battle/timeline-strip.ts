/**
 * The turn order strip: the next 8 actors as face chips (docs/DESIGN.md,
 * 4.2: "the next 8 turns are always visible"). The first chip is the one
 * acting now, larger, with a gold frame; allies are edged in blue-grey,
 * enemies in red. Chips slide when the order changes.
 */
import { Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import { C, T } from "../theme.js";
import type { Filter } from "pixi.js";
import { SKIN } from "../skin.js";
import { chamferPoints, drawPanel } from "../ui.js";
import type { Rect } from "./layout.js";

type Chip = { key: string; c: Container; sprite: Sprite; frame: Graphics; x: number; target: number };

export class TimelineStrip extends Container {
  private bg = new Graphics();
  private title: Text;
  private chips: Chip[] = [];
  private rect: Rect = { x: 0, y: 0, w: 100, h: 40 };
  private ui = 1;
  /** Filters for the chip portraits (a pixel theme's picture treatment). */
  chipFilters: Filter[] = [];

  constructor() {
    super();
    this.title = new Text({ text: "TURN ORDER", style: T.label(9, C.textDim) });
    this.addChild(this.bg, this.title);
  }

  place(rect: Rect, ui: number): void {
    this.rect = rect;
    this.ui = ui;
    this.position.set(rect.x, rect.y);
    this.bg.clear();
    drawPanel(this.bg, 0, 0, rect.w, rect.h, { chamfer: 5 * ui, alpha: 0.78, fill: C.strip, fillBottom: C.stripBottom });
    this.title.style = T.label(Math.round(8 * ui), C.textDim);
    this.title.visible = rect.w > 360;
    this.title.position.set(8 * ui, (rect.h - this.title.height) / 2);
  }

  /** Show `order` (ids, first = now) with each actor's chip texture and side. */
  set(order: Array<{ id: string; texture: Texture; enemy: boolean; alive: boolean }>): void {
    const ui = this.ui;
    const h = this.rect.h;
    const big = h - 8 * ui;
    const small = Math.round(big * 0.78);
    const gap = Math.round(5 * ui);
    const start = this.title.visible ? this.title.x + this.title.width + 10 * ui : 6 * ui;
    const room = this.rect.w - start - 6 * ui;
    const n = order.length;
    const needed = big + (n - 1) * (small + gap) + gap;
    const k = Math.min(1, room / needed);
    const old = this.chips;
    const next: Chip[] = [];
    let x = start;
    order.forEach((o, i) => {
      // Clamped: the first layout can run while the host is still tiny.
      const size = Math.max(1, Math.round((i === 0 ? big : small) * k));
      const key = `${o.id}#${order.slice(0, i).filter((p) => p.id === o.id).length}`;
      let chip = old.find((c) => c.key === key);
      if (chip) old.splice(old.indexOf(chip), 1);
      else {
        const c = new Container();
        const sprite = new Sprite(o.texture);
        const frame = new Graphics();
        const mask = new Graphics();
        c.addChild(sprite, mask, frame);
        sprite.mask = mask;
        if (this.chipFilters.length) sprite.filters = this.chipFilters;
        c.alpha = 0;
        chip = { key, c, sprite, frame, x: x + 30 * ui, target: x };
        this.addChild(c);
      }
      chip.sprite.texture = o.texture;
      chip.target = x;
      const mask = chip.c.children[1] as Graphics;
      const cut = SKIN.frame.corner === "square" ? 0 : size * 0.18;
      mask.clear().poly(chamferPoints(0, 0, size, size, cut)).fill({ color: 0xffffff });
      // Set the scale outright: the width setter keeps the old scale's sign,
      // so one negative size would mirror the chip out of its mask for good.
      chip.sprite.scale.set(size / Math.max(1, o.texture.width), size / Math.max(1, o.texture.height));
      const edge = i === 0 ? C.gold : o.enemy ? C.enemy : C.ally;
      chip.frame.clear();
      chip.frame.poly(chamferPoints(0, 0, size, size, cut)).stroke({ width: i === 0 ? 2 : 1.25, color: edge, alpha: i === 0 ? 1 : 0.85 });
      if (o.enemy) chip.frame.rect(size * 0.2, size - 2, size * 0.6, 2).fill({ color: C.enemy });
      // The one acting now: a second rule outside, so it stands apart from the queue.
      if (i === 0) chip.frame.poly(chamferPoints(-3, -3, size + 6, size + 6, cut ? cut + 2 : 0)).stroke({ width: 1.5, color: C.gold, alpha: 0.9 });
      chip.c.y = (h - size) / 2;
      chip.sprite.tint = o.alive ? 0xffffff : 0x555555;
      next.push(chip);
      x += size + gap;
    });
    for (const gone of old) gone.c.destroy({ children: true });
    this.chips = next;
  }

  update(dt: number): void {
    const a = 1 - Math.exp(-dt / 0.09);
    for (const chip of this.chips) {
      chip.x += (chip.target - chip.x) * a;
      chip.c.x = chip.x;
      chip.c.alpha += (1 - chip.c.alpha) * a;
    }
  }
}
