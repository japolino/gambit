/**
 * One enemy on the field: the puppet figure on its floor spot with a soft
 * contact shadow, and a compact plate under it (name, HP bar with a ghost
 * drain, poise pips, status glyphs). Owns its target brackets and the
 * "acting now" marker; the event player drives the motion.
 */
import { Container, Graphics, Text } from "pixi.js";
import { PuppetFigure } from "../puppet/puppet-figure.js";
import type { FigureSource } from "../puppet/source.js";
import { C, STATUS_STYLE, T } from "../theme.js";
import { caps } from "../skin.js";
import { drawBar, drawPips, drawStatusGlyph, fitText } from "../ui.js";
import type { DisplayUnit } from "./display.js";
import type { EnemySlot } from "./layout.js";

export class EnemyView extends Container {
  readonly id: string;
  figure: PuppetFigure;
  readonly body = new Container();
  private shadow = new Graphics();
  private plate = new Container();
  private plateG = new Graphics();
  private nameText: Text;
  private brackets = new Graphics();
  private marker = new Graphics();
  slot: EnemySlot = { x: 0, y: 0, height: 100, floorY: 0, depth: 0 };
  private unit: DisplayUnit;
  private ghost = 1;
  private ghostHoldUntil = 0;
  private shownHp = 1;
  private ui = 1;
  private targetable = false;
  private active = false;
  private now = 0;

  constructor(unit: DisplayUnit, source: FigureSource, strength: number, cutout = true) {
    super();
    this.id = unit.id;
    this.unit = unit;
    this.figure = new PuppetFigure({ source, kind: unit.rig, key: unit.id, strength, framed: !cutout });
    this.shownHp = unit.hp / Math.max(1, unit.maxHp);
    this.ghost = this.shownHp;
    this.nameText = new Text({ text: caps(unit.name), style: T.name(13, C.onArt) });
    this.nameText.anchor.set(0.5, 0);
    this.plate.addChild(this.plateG, this.nameText);
    this.body.addChild(this.figure);
    this.addChild(this.shadow, this.brackets, this.body, this.marker, this.plate);
    this.eventMode = "static";
    this.cursor = "default";
  }

  /**
   * Swap in a new figure (custom art arrived, or a boss phase). The old one
   * stays under it until the caller fades and drops it (dropFigure).
   */
  replaceFigure(source: FigureSource, kind: DisplayUnit["rig"], strength: number, cutout = true): { fresh: PuppetFigure; old: PuppetFigure } {
    const old = this.figure;
    this.figure = new PuppetFigure({ source, kind, key: this.id, strength, framed: !cutout });
    this.body.addChild(this.figure);
    this.place(this.slot, this.ui);
    // The old figure keeps its own scale for the fade.
    return { fresh: this.figure, old };
  }

  dropFigure(old: PuppetFigure): void {
    if (old === this.figure) return;
    this.body.removeChild(old);
    old.destroy({ children: true });
  }

  /** Displayed scale of the figure (screen px per texture px). */
  get figureScale(): number {
    return this.slot.height / Math.max(1, this.figure.figurePixelHeight);
  }

  /** Face position on screen (for sparks and numbers). */
  get faceGlobal(): { x: number; y: number } {
    const f = this.figure.faceLocal;
    const k = this.figureScale * this.body.scale.y;
    return { x: this.x + this.body.x + f.x * k, y: this.y + this.body.y + f.y * k };
  }

  /** Top of the figure on screen. */
  get topY(): number {
    return this.y + this.body.y - this.slot.height * this.body.scale.y;
  }

  /** Screen width, so the plate stays on screen. */
  private screenW = 0;

  place(slot: EnemySlot, ui: number, screenW = this.screenW): void {
    this.slot = slot;
    this.ui = ui;
    this.screenW = screenW;
    this.position.set(slot.x, slot.y);
    const k = this.figureScale;
    this.figure.scale.set(k);
    const tint = Math.round(255 * (1 - slot.depth * 0.22));
    this.figure.mesh.tint = (tint << 16) | (tint << 8) | tint;
    this.zIndex = Math.round((1 - slot.depth) * 10);
    const fw = Math.min(slot.height * 0.42, 220 * ui);
    this.shadow.clear();
    const sy = slot.floorY - slot.y;
    for (let i = 4; i >= 1; i -= 1) {
      this.shadow.ellipse(0, sy, fw * (0.35 + i * 0.12), fw * (0.07 + i * 0.02)).fill({ color: 0x000000, alpha: 0.12 });
    }
    this.nameText.style = T.name(Math.round(12.5 * ui), C.onArt);
    // The plate sits on the floor under the figure (the huge one keeps it near its chest band).
    const plateY = this.unit.rig === "huge" ? -slot.height * 0.42 : sy + 8 * ui;
    this.plate.position.set(0, plateY);
    const boundsW = Math.max(fw * 1.1, 90 * ui);
    this.hitArea = new (class {
      constructor(private w: number, private top: number, private bottom: number) {}
      contains(x: number, y: number): boolean { return Math.abs(x) <= this.w / 2 && y >= this.top && y <= this.bottom; }
    })(boundsW, -slot.height, sy + 46 * ui);
    this.redraw();
  }

  setUnit(unit: DisplayUnit): void {
    const prev = this.shownHp;
    this.unit = unit;
    const next = unit.hp / Math.max(1, unit.maxHp);
    if (next < prev) this.ghostHoldUntil = this.now + 0.45;
    else this.ghost = Math.max(this.ghost, next);
    this.shownHp = next;
    if (this.nameText.text !== caps(unit.name)) this.nameText.text = caps(unit.name);
    this.redraw();
  }

  setTargetable(on: boolean): void {
    this.targetable = on;
    this.cursor = on ? "pointer" : "default";
    this.drawBrackets(on ? 0.9 : 0);
  }

  setActive(on: boolean): void {
    this.active = on;
    this.marker.visible = on;
  }

  hover(on: boolean): void {
    if (this.targetable) this.drawBrackets(on ? 1 : 0.9, on);
  }

  private drawBrackets(alpha: number, strong = false): void {
    const b = this.brackets;
    b.clear();
    if (alpha <= 0) return;
    const w = Math.max(this.slot.height * 0.36, 70 * this.ui);
    const top = -this.slot.height * (this.unit.rig === "huge" ? 0.85 : 1.02);
    const bottom = this.slot.floorY - this.slot.y + 4;
    const l = 14 * this.ui;
    const color = strong ? C.crit : C.gold;
    const s = { width: strong ? 2 : 1.5, color, alpha };
    for (const [x, y, dx, dy] of [[-w, top, 1, 1], [w, top, -1, 1], [-w, bottom, 1, -1], [w, bottom, -1, -1]] as const) {
      b.moveTo(x, y + dy * l).lineTo(x, y).lineTo(x + dx * l, y).stroke(s);
    }
  }

  private redraw(): void {
    const u = this.unit;
    const ui = this.ui;
    const g = this.plateG;
    g.clear();
    const w = Math.round(Math.min(130, Math.max(84, this.slot.height * 0.42)) * ui);
    fitText(this.nameText, Math.max(w + 12 * ui, Math.min(this.screenW > 0 ? this.screenW * 0.44 : 9999, this.slot.height * 0.9)));
    const half = Math.max(w / 2 + 6 * ui, this.nameText.width / 2 + 4 * ui);
    if (this.screenW > 0) {
      const lo = half + 4 - this.slot.x;
      const hi = this.screenW - half - 4 - this.slot.x;
      this.plate.x = Math.max(lo, Math.min(hi, 0));
    }
    this.nameText.position.set(0, 0);
    const barY = this.nameText.height + 3 * ui;
    const barH = Math.max(3, Math.round(4 * ui));
    g.rect(-w / 2 - 6 * ui, -3 * ui, w + 12 * ui, barY + barH + 22 * ui).fill({ color: 0x000000, alpha: 0.28 });
    drawBar(g, -w / 2, barY, w, barH, this.shownHp, this.ghost, C.hp, C.hpHi, u.shield / Math.max(1, u.maxHp));
    if (u.maxPoise > 0) drawPips(g, 0, barY + barH + 7 * ui, u.poise, u.maxPoise, 6 * ui, C.poise, u.broken);
    const s = 13 * ui;
    u.statuses.slice(0, 6).forEach((st, i) => {
      const style = STATUS_STYLE[st.id];
      drawStatusGlyph(g, style.glyph, -w / 2 + i * (s + 3), barY + barH + 14 * ui, s, style.color);
    });
    if (u.broken) {
      g.rect(-w / 2, barY - 1, w, barH + 2).stroke({ width: 1, color: C.break, alpha: 0.9 });
    }
    // The marker for the enemy acting now: a small inverted chevron above its head.
    const m = this.marker;
    m.clear();
    const top = -this.slot.height * (u.rig === "huge" ? 0.82 : 1.04);
    m.poly([-7 * ui, top - 14 * ui, 7 * ui, top - 14 * ui, 0, top - 4 * ui]).fill({ color: C.enemy }).stroke({ width: 1, color: 0x000000, alpha: 0.7 });
    m.visible = this.active;
    this.plate.visible = u.alive;
  }

  update(now: number, dt: number): void {
    this.now = now;
    for (const f of this.body.children) (f as PuppetFigure).update(now, dt);
    if (now > this.ghostHoldUntil && this.ghost > this.shownHp) {
      this.ghost = Math.max(this.shownHp, this.ghost - dt * 0.9);
      this.redraw();
    }
    if (this.active) this.marker.y = Math.sin(now * 4) * 2;
  }
}
