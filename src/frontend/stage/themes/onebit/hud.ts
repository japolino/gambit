/**
 * The 1-bit battle's HUD pieces. They draw nothing themselves: the console (./console.ts) paints every frame,
 * bar, number and line of type into the one frame buffer. These keep the state the stage hands them (the
 * public methods the stage and the event player call) and say when the console must repaint. The party card
 * keeps only its portrait (the shared breathing bust, dithered by the stage's shader on the same grid), masked
 * to its square window in the PARTY readout.
 */
import { PartyCard } from "../../battle/party-card.js";
import { ActionMenu, type MenuSkill } from "../../battle/action-menu.js";
import { TimelineStrip } from "../../battle/timeline-strip.js";
import type { DisplayUnit } from "../../battle/display.js";
import type { Rect } from "../../battle/layout.js";
import type { FigureSource } from "../../puppet/source.js";
import type { Texture } from "pixi.js";

/** Set by the console: something it draws changed. */
export const dirty = { fn: () => {} };
const touch = () => dirty.fn();

export class ObCard extends PartyCard {
  /** The portrait window inside the row (screen px, relative to the row). */
  pic: Rect = { x: 0, y: 0, w: 10, h: 10 };

  constructor(unit: DisplayUnit, bust: FigureSource, strength: number, cutout: boolean) {
    super(unit, bust, strength, cutout);
    for (const t of [this.nameText, this.hpText, this.resText]) t.visible = false;
    // A grey wash is not 1-bit: the console inverts the row instead.
    this.flash.renderable = false;
  }

  get state(): { unit: DisplayUnit; hp: number; ghost: number; active: boolean; targetable: boolean } {
    return { unit: this.unit, hp: this.shownHp, ghost: this.ghost, active: this.active, targetable: this.targetable };
  }

  /** The console says where the portrait window sits (screen px, relative to the row). */
  setPic(pic: Rect): void {
    this.pic = pic;
    this.place(this.rect, this.ui);
  }

  override place(rect: Rect, ui: number): void {
    this.rect = rect;
    this.ui = ui;
    this.position.set(rect.x, rect.y);
    const p = this.pic;
    this.frame.clear();
    this.shade.clear();
    this.info.clear();
    this.glow.clear();
    this.portraitMask.clear().rect(p.x, p.y, p.w, p.h).fill({ color: 0xffffff });
    this.fitPic(this.bust);
    this.hitArea = { contains: (x: number, y: number) => x >= 0 && y >= 0 && x <= rect.w && y <= rect.h };
    this.redraw();
  }

  private fitPic(bust: PartyCard["bust"]): void {
    const p = this.pic;
    if (bust.framed) {
      const k = Math.max(p.w / bust.imageW, p.h / bust.imageH);
      bust.scale.set(k);
      bust.position.set(p.x + p.w / 2, p.y + bust.imageH * k - Math.max(0, bust.imageH * k - p.h) * 0.15);
      return;
    }
    // The face takes about two fifths of the window, a little above its middle.
    const face = bust.faceLocal;
    const faceH = Math.max(1, bust.faceHeightLocal);
    const k = Math.min(p.h / (bust.imageH * 0.32), Math.max(p.h / (bust.imageH * 1.1), (p.h * 0.4) / faceH));
    bust.scale.set(k);
    bust.position.set(p.x + p.w / 2 - face.x * k, p.y + p.h * 0.44 - face.y * k);
  }

  override replaceBust(source: FigureSource, strength: number, cutout: boolean) {
    const r = super.replaceBust(source, strength, cutout);
    this.fitPic(r.fresh);
    return r;
  }

  protected override redraw(): void {
    this.alpha = 1;
    this.bust.setGray(this.unit.alive ? 0 : 0.85);
    touch();
  }

  override update(now: number, dt: number): void {
    this.now = now;
    for (const f of this.portrait.children) (f as PartyCard["bust"]).update(now, dt);
    // No lift: the row is a fixed slot on the grid; the console inverts it instead.
    this.pivot.y = 0;
    if (now > this.ghostHoldUntil && this.ghost > this.shownHp) {
      this.ghost = Math.max(this.shownHp, this.ghost - dt * 0.9);
      touch();
    }
  }

  override get portraitCentre(): { x: number; y: number } {
    return { x: this.rect.x + this.pic.x + this.pic.w / 2, y: this.rect.y + this.pic.y + this.pic.h * 0.45 };
  }
}

export type ObMenuMode =
  | { kind: "skills"; actor: string; skills: MenuSkill[] }
  | { kind: "target"; skill: string; hint: string; confirm: boolean }
  | { kind: "wait"; text: string };

export class ObMenu extends ActionMenu {
  menuRect: Rect = { x: 0, y: 0, w: 1, h: 1 };

  get current(): ObMenuMode {
    return this.mode as ObMenuMode;
  }

  override place(rect: Rect, ui: number): void {
    this.menuRect = rect;
    this.rect = rect;
    this.ui = ui;
    this.bg.clear();
    touch();
  }

  protected override render(): void {
    for (const c of this.content.removeChildren()) c.destroy({ children: true });
    touch();
  }
}

export type OrderEntry = { id: string; enemy: boolean; alive: boolean };

export class ObOrder extends TimelineStrip {
  order: OrderEntry[] = [];

  constructor() {
    super();
    this.title.visible = false;
  }

  override place(rect: Rect, ui: number): void {
    this.rect = rect;
    this.ui = ui;
    this.bg.clear();
    touch();
  }

  override set(order: Array<{ id: string; texture: Texture; enemy: boolean; alive: boolean }>): void {
    this.order = order.map((o) => ({ id: o.id, enemy: o.enemy, alive: o.alive }));
    touch();
  }

  override update(_dt: number): void {}
}
