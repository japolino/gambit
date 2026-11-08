/**
 * A party member as a woodcut card standing on your side of the table: the
 * breathing bust in an arched red window, the name inked on the band under
 * it, HP as a hand-set number in a blood-drop seal and a ruled ink bar, Focus
 * as a second, steel-blue rule, the class resource as red diamonds. On its
 * turn the card rises off the table into the candlelight; when it can be
 * targeted it is ringed in chalk; fallen, it goes grey with a red slash.
 */
import { Graphics, Sprite, Text, TextStyle } from "pixi.js";
import { PartyCard } from "../../battle/party-card.js";
import type { DisplayUnit } from "../../battle/display.js";
import type { Rect } from "../../battle/layout.js";
import type { FigureSource } from "../../puppet/source.js";
import { STATUS_STYLE } from "../../theme.js";
import { drawStatusGlyph, fitText } from "../../ui.js";
import { CINZEL, FELL } from "../shared.js";
import { BLOOD, CARD_H, CARD_W, PAPER_INK, WINDOW, onCardArt, partyBackTexture, partyFrontTexture } from "./cards.js";

let seq = 0;

export class TableCard extends PartyCard {
  protected back = new Sprite();
  protected front = new Sprite();
  protected seal = new Graphics();
  protected maxText: Text;
  private seed = 31 + (seq++ % 7) * 13;
  private offArt: () => void;

  constructor(unit: DisplayUnit, bust: FigureSource, strength: number, cutout: boolean) {
    super(unit, bust, strength, cutout);
    this.back.texture = partyBackTexture(this.seed);
    this.front.texture = partyFrontTexture(this.seed);
    this.removeChild(this.frame, this.shade);
    this.addChildAt(this.back, this.getChildIndex(this.portrait));
    this.addChildAt(this.front, this.getChildIndex(this.portraitMask) + 1);
    this.addChildAt(this.seal, this.getChildIndex(this.hpText));
    this.maxText = new Text({ text: "", style: new TextStyle({ fontFamily: FELL, fontSize: 12, fill: 0xf3e6c8 }) });
    this.addChildAt(this.maxText, this.getChildIndex(this.flash));
    this.offArt = onCardArt(() => {
      this.back.texture.source.update();
      this.front.texture.source.update();
    });
  }

  override place(rect: Rect, ui: number): void {
    this.rect = rect;
    this.ui = ui;
    this.position.set(rect.x, rect.y);
    const { w, h } = rect;
    const sx = w / CARD_W;
    const sy = h / CARD_H;
    for (const s of [this.back, this.front]) {
      s.width = w;
      s.height = h;
    }
    const W = WINDOW;
    const x0 = W.x0 * sx;
    const x1 = W.x1 * sx;
    const top = W.top * sy;
    const spring = W.spring * sy;
    const bottom = W.bottom * sy;
    this.portraitMask.clear().moveTo(x0, bottom).lineTo(x0, spring).quadraticCurveTo(x0, top, w / 2, top).quadraticCurveTo(x1, top, x1, spring).lineTo(x1, bottom).closePath().fill({ color: 0xffffff });
    this.fitBust(this.bust, w, bottom - top, top);
    const big = w > 150;
    this.nameText.style = new TextStyle({ fontFamily: CINZEL, fontWeight: "800", fontSize: Math.round(w * (big ? 0.095 : 0.11)), fill: PAPER_INK, letterSpacing: 1 });
    fitText(this.nameText, w * 0.8);
    this.nameText.anchor.set(0.5, 0.5);
    this.nameText.position.set(w / 2, (W.bottom + 19) * sy);
    this.hpText.style = new TextStyle({ fontFamily: FELL, fontSize: Math.round(w * (big ? 0.15 : 0.17)), fill: 0xfff2e0, stroke: { color: 0x2a0406, width: 3 }, fontWeight: "700" });
    this.hpText.anchor.set(0.5, 0.5);
    this.maxText.style = new TextStyle({ fontFamily: FELL, fontWeight: "700", fontSize: Math.max(13, Math.round(w * 0.11)), fill: 0x2c5a8a });
    this.maxText.anchor.set(1, 0.5);
    this.resText.style = new TextStyle({ fontFamily: CINZEL, fontWeight: "700", fontSize: Math.max(8, Math.round(w * 0.045)), fill: 0x3a2a1a, letterSpacing: 1 });
    this.hitArea = { contains: (x: number, y: number) => x >= 0 && y >= -this.lift * 24 * ui && x <= w && y <= h };
    this.redraw();
  }

  override replaceBust(source: FigureSource, strength: number, cutout: boolean) {
    const r = super.replaceBust(source, strength, cutout);
    this.place(this.rect, this.ui);
    return r;
  }

  protected override redraw(): void {
    const u = this.unit;
    const { w, h } = this.rect;
    if (w < 2) return;
    const sx = w / CARD_W;
    const sy = h / CARD_H;
    const ui = this.ui;
    const g = this.info;
    g.clear();
    // HP: a thick ruled bar under the name band, ghost drain behind the blood.
    const bx = 18 * sx;
    const bw = w - 36 * sx;
    let y = (WINDOW.bottom + 42) * sy;
    const bh = Math.max(6, 14 * sy);
    const frac = Math.max(0, Math.min(1, this.shownHp));
    g.rect(bx, y, bw, bh).fill({ color: 0xe8dcc4 });
    g.rect(bx, y, bw * Math.max(frac, Math.min(1, this.ghost)), bh).fill({ color: 0xe0a080 });
    g.rect(bx, y, bw * frac, bh).fill({ color: frac < 0.3 ? 0xe0302a : BLOOD });
    for (let i = 1; i < 10; i++) g.rect(bx + (bw * i) / 10, y, 1, bh * 0.4).fill({ color: PAPER_INK, alpha: 0.5 });
    if (u.shield > 0) g.rect(bx, y - 3 * sy, bw * Math.min(1, u.shield / Math.max(1, u.maxHp)), 3 * sy).fill({ color: 0xbfd8e8 }).stroke({ width: 1, color: PAPER_INK });
    g.rect(bx, y, bw, bh).stroke({ width: Math.max(1.5, 2.4 * sx), color: PAPER_INK });
    // Focus: the steel rule, its number stamped at the end.
    y += bh + 7 * sy;
    const fh = Math.max(5, 10 * sy);
    const ff = u.focus / Math.max(1, u.maxFocus);
    const fw = bw * 0.72;
    g.rect(bx, y, fw, fh).fill({ color: 0xd8d0bc }).rect(bx, y, fw * ff, fh).fill({ color: 0x2c5a8a }).rect(bx, y, fw, fh).stroke({ width: 1.4, color: PAPER_INK });
    this.maxText.text = `${Math.round(u.focus)}`;
    this.maxText.position.set(bx + bw, y + fh / 2);
    // The class resource as big red diamonds, centred (its name is on the card's tooltip-free face: the diamonds speak).
    y += fh + 7 * sy;
    this.resText.text = "";
    if (u.resource) {
      const r = u.resource;
      const n = Math.min(10, r.max);
      const s = Math.min(15 * sx, (bw / Math.max(1, n)) * 0.78);
      const x0 = w / 2 - ((n - 1) * s * 1.3) / 2;
      for (let i = 0; i < n; i++) {
        const cx = x0 + i * s * 1.3;
        const cy = y + s / 2;
        g.poly([cx, cy - s / 2, cx + s / 2, cy, cx, cy + s / 2, cx - s / 2, cy]).fill({ color: i < r.value ? BLOOD : 0xe8dcc4 }).stroke({ width: 1.4, color: PAPER_INK });
      }
    }
    // The HP seal: a drop of red wax on the window's corner, the number pressed into it.
    const sc = this.seal;
    sc.clear();
    const R = w * (w > 150 ? 0.13 : 0.15);
    const cx = 30 * sx;
    const cy = WINDOW.top * sy + R * 1.75;
    sc.moveTo(cx, cy - R * 1.45).bezierCurveTo(cx + R * 0.7, cy - R * 0.7, cx + R, cy - R * 0.2, cx + R, cy + R * 0.15).arc(cx, cy + R * 0.15, R, 0, Math.PI).bezierCurveTo(cx - R, cy - R * 0.2, cx - R * 0.7, cy - R * 0.7, cx, cy - R * 1.45).closePath();
    sc.fill({ color: frac < 0.3 ? 0xe0302a : 0x9c1419 }).stroke({ width: Math.max(2, 3 * sx), color: 0x2a0406 });
    sc.circle(cx - R * 0.35, cy - R * 0.25, R * 0.18).fill({ color: 0xffb0a0, alpha: 0.45 });
    this.hpText.text = `${Math.max(0, Math.round(u.hp))}`;
    fitText(this.hpText, R * 1.75);
    this.hpText.position.set(cx, cy + R * 0.18);
    // Statuses along the window's top.
    const s = Math.round(Math.max(11, 15 * sx) * Math.min(1.2, ui));
    u.statuses.slice(0, 5).forEach((st, i) => {
      const style = STATUS_STYLE[st.id];
      drawStatusGlyph(g, style.glyph, 24 * sx + i * (s + 2), 28 * sy, s, style.color);
    });
    // Turn glow (candlelight behind the card) and the chalk ring of a target.
    const gl = this.glow;
    gl.clear();
    if (this.active) {
      for (let i = 6; i >= 1; i--) gl.roundRect(-i * 4, -i * 4, w + i * 8, h + i * 8, 10 + i * 3).fill({ color: 0xffb040, alpha: 0.045 * (7 - i) });
      gl.roundRect(-2, -2, w + 4, h + 4, 8).stroke({ width: 3, color: 0xffcf6a, alpha: 0.95 });
    } else if (this.targetable) {
      for (let i = 4; i >= 1; i--) gl.roundRect(-i * 3, -i * 3, w + i * 6, h + i * 6, 10).stroke({ width: 3, color: 0xf2efe9, alpha: 0.12 * (5 - i) });
      gl.roundRect(-3, -3, w + 6, h + 6, 8).stroke({ width: 2.5, color: 0xf2efe9, alpha: 0.95 });
    }
    // Fallen: ash grey, slashed through in red ink.
    if (!u.alive) {
      g.moveTo(w * 0.12, h * 0.1).lineTo(w * 0.88, h * 0.62).stroke({ width: Math.max(4, 10 * sx), color: BLOOD, alpha: 0.85, cap: "round" });
      g.moveTo(w * 0.88, h * 0.1).lineTo(w * 0.12, h * 0.62).stroke({ width: Math.max(4, 10 * sx), color: BLOOD, alpha: 0.85, cap: "round" });
    }
    const tint = u.alive ? 0xffffff : 0x8a8580;
    this.back.tint = this.front.tint = tint;
    this.bust.setGray(u.alive ? 0 : 0.85);
  }

  override update(now: number, dt: number): void {
    this.now = now;
    for (const f of this.portrait.children) (f as { update?(n: number, d: number): void }).update?.(now, dt);
    const want = this.active ? 1 : 0;
    this.lift += (want - this.lift) * (1 - Math.exp(-dt / 0.14));
    this.pivot.y = this.lift * 0.14 * this.rect.h;
    if (now > this.ghostHoldUntil && this.ghost > this.shownHp) {
      this.ghost = Math.max(this.shownHp, this.ghost - dt * 0.9);
      this.redraw();
    }
  }

  override get portraitCentre(): { x: number; y: number } {
    return { x: this.rect.x + this.rect.w / 2, y: this.rect.y + this.rect.h * 0.36 - this.pivot.y };
  }

  override destroy(options?: Parameters<PartyCard["destroy"]>[0]): void {
    this.offArt();
    super.destroy(options);
  }
}
