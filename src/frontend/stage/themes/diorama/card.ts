/**
 * A party member as an index card pinned to the counter's front: ruled card
 * stock (a red head rule, blue lines), the member's photograph held in photo corners at a
 * tilt, the name in ink, HP as a red-ink gauge drawn into a ruled box with
 * the number written beside it, Focus in blue pencil, the class resource as
 * punched holes set with brass eyelets, statuses as round stickers. Whose
 * turn it is gets a push-pin and the shop's yellow highlight; a card you can
 * target gets the same highlight, dashed.
 */
import { Container, Graphics } from "pixi.js";
import { PartyCard } from "../../battle/party-card.js";
import type { DisplayUnit } from "../../battle/display.js";
import type { FigureSource } from "../../puppet/source.js";
import type { Rect } from "../../battle/layout.js";
import { STATUS_STYLE } from "../../theme.js";
import { drawStatusGlyph } from "../../ui.js";
import { CINZEL, FELL, P, cutRect, eyelet, fit, inkLine, pin, shadowPoly, stock, txt } from "./paper.js";

let made = 0;

export class PaperCard extends PartyCard {
  /** The photograph: its white border, the portrait window, its corners. Rotated as one. */
  protected photo = new Container();
  protected photoBack = new Graphics();
  protected deco = new Container();
  protected pinG = new Graphics();
  protected labels = new Container();
  protected tilt: number;
  protected seed: number;
  protected win = { x: 0, y: 0, w: 1, h: 1 };
  protected vertical = false;

  constructor(unit: DisplayUnit, bust: FigureSource, strength: number, cutout = true) {
    super(unit, bust, strength, cutout);
    this.seed = 11 + made * 7;
    this.tilt = [-0.018, 0.014, -0.008, 0.02][made % 4]!;
    made += 1;
    // The portrait and its mask move into the photograph so they tilt with it.
    this.removeChild(this.portrait, this.portraitMask);
    this.photo.addChild(this.photoBack, this.portrait, this.portraitMask, this.deco);
    this.addChildAt(this.photo, this.getChildIndex(this.frame) + 1);
    this.addChild(this.labels, this.pinG);
    this.shade.visible = false;
  }

  override place(rect: Rect, ui: number): void {
    this.rect = rect;
    this.ui = ui;
    this.position.set(rect.x, rect.y);
    this.rotation = this.tilt;
    const { w, h } = rect;
    this.vertical = w < h * 1.05;
    const pad = Math.round((this.vertical ? 7 : 12) * ui);
    // The card: ruled index stock with a hand-cut edge and its shadow on the wood.
    const pts = cutRect(0, 0, w, h, this.seed, 1.2 * ui);
    const f = this.frame;
    f.clear();
    shadowPoly(f, pts, ui, 2.2);
    f.poly(pts).fill({ texture: stock("card"), color: 0xffffff, textureSpace: "local" });
    const headY = this.vertical ? h * 0.6 : Math.round(30 * ui);
    for (let y = headY + Math.round(20 * ui); y < h - 6 * ui; y += Math.round(19 * ui)) f.rect(4 * ui, y, w - 8 * ui, Math.max(1, ui * 0.9)).fill({ color: 0x7a9ac8, alpha: 0.38 });
    f.rect(4 * ui, headY, w - 8 * ui, Math.max(1.2, 1.4 * ui)).fill({ color: 0xc8443a, alpha: 0.6 });
    // A worn corner and a thumb smudge.
    f.poly([w - 16 * ui, h, w, h - 16 * ui, w, h]).fill({ color: 0x5a3a1a, alpha: 0.12 });
    f.ellipse(w * 0.82, h * 0.2, 18 * ui, 10 * ui).fill({ color: 0x6a4a2a, alpha: 0.045 });
    // Two brass tacks holding it to the counter front.
    for (const tx of [Math.round(9 * ui), w - Math.round(9 * ui)]) {
      const ty = Math.round(9 * ui);
      const r = Math.max(3, 4.2 * ui);
      f.circle(tx + 1.5 * ui, ty + 2 * ui, r).fill({ color: 0x000000, alpha: 0.35 });
      f.circle(tx, ty, r).fill({ color: P.brass }).stroke({ width: 1, color: P.brassDark });
      f.circle(tx - r * 0.3, ty - r * 0.3, r * 0.4).fill({ color: P.brassHi, alpha: 0.85 });
    }
    // The photograph.
    let pw: number;
    let ph: number;
    if (this.vertical) {
      pw = w - pad * 2;
      ph = Math.round(h * 0.6 - pad * 1.6);
    } else {
      ph = h - pad * 2 - Math.round(6 * ui);
      pw = Math.min(Math.round(w * 0.42), Math.round(ph * 0.86));
    }
    const border = Math.max(3, Math.round(5 * ui));
    const foot = this.vertical ? border : Math.round(border * 2.6);
    this.win = { x: border, y: border, w: pw - border * 2, h: ph - border - foot };
    this.photo.position.set(pad + pw / 2, pad + ph / 2);
    this.photo.pivot.set(pw / 2, ph / 2);
    this.photo.rotation = this.vertical ? -this.tilt * 0.8 : -0.045 - this.tilt;
    const pb = this.photoBack;
    pb.clear();
    pb.rect(2 * ui, 3 * ui, pw, ph).fill({ color: 0x000000, alpha: 0.25 });
    pb.rect(0, 0, pw, ph).fill({ texture: stock("photo"), color: 0xffffff, textureSpace: "local" });
    pb.rect(this.win.x, this.win.y, this.win.w, this.win.h).fill({ color: 0x2a1c12 });
    this.portraitMask.clear().rect(this.win.x, this.win.y, this.win.w, this.win.h).fill({ color: 0xffffff });
    this.fitBust(this.bust, this.win.w + 2 * this.win.x, this.win.h, this.win.x);
    this.bust.x += 0;
    // A sheen across the print.
    for (const c of this.deco.removeChildren()) c.destroy();
    const sheen = new Graphics();
    sheen.poly([this.win.x, this.win.y, this.win.x + this.win.w * 0.55, this.win.y, this.win.x, this.win.y + this.win.h * 0.55]).fill({ color: 0xffffff, alpha: 0.07 });
    this.deco.addChild(sheen);
    // Four black paper photo corners holding the print in (the card itself is tacked to the counter).
    const corners = new Graphics();
    const k = Math.max(10, 16 * ui);
    for (const [x, y, sx, sy] of [[0, 0, 1, 1], [pw, 0, -1, 1], [0, ph, 1, -1], [pw, ph, -1, -1]] as const) {
      corners.poly([x - sx * 2, y - sy * 2, x + sx * k, y - sy * 2, x - sx * 2, y + sy * k]).fill({ color: 0x1a120c, alpha: 0.92 });
      corners.moveTo(x + sx * k, y - sy * 2).lineTo(x - sx * 2, y + sy * k).stroke({ width: 1, color: 0x6a5a48, alpha: 0.6 });
    }
    this.deco.addChild(corners);
    // Type.
    const nameSize = Math.round((this.vertical ? 15 : Math.min(26, h / 7.2 / ui)) * ui);
    this.nameText.style = { fontFamily: FELL, fontSize: nameSize, fill: P.ink };
    this.hpText.style = { fontFamily: FELL, fontSize: Math.round((this.vertical ? 15 : 24) * ui), fill: P.redInk };
    this.resText.style = { fontFamily: CINZEL, fontWeight: "700", fontSize: Math.round((this.vertical ? 7.5 : 9) * ui), fill: P.inkSoft, letterSpacing: 1.5 * ui };
    this.hitArea = { contains: (x: number, y: number) => x >= -4 && y >= -4 && x <= w + 4 && y <= h + 4 };
    this.redraw();
  }

  protected override redraw(): void {
    const u = this.unit;
    if (!this.pinG) return; // the base constructor runs before the fields exist
    const { w, h } = this.rect;
    const ui = this.ui;
    const g = this.info;
    g.clear();
    const pad = Math.round((this.vertical ? 7 : 12) * ui);
    let x0: number;
    let y: number;
    let bw: number;
    if (this.vertical) {
      x0 = pad;
      y = Math.round(h * 0.6) - Math.round(2 * ui);
      bw = w - pad * 2;
      this.nameText.visible = true;
      this.nameText.text = u.name;
      fit(this.nameText, bw);
      this.nameText.position.set(x0, y + 1 * ui);
      y = this.nameText.y + this.nameText.height;
    } else {
      const pw = Math.min(Math.round(w * 0.42), Math.round((h - pad * 2 - 6 * ui) * 0.86));
      x0 = pad + pw + Math.round(16 * ui);
      bw = w - x0 - pad;
      this.nameText.visible = true;
      this.nameText.text = u.name;
      fit(this.nameText, bw);
      this.nameText.position.set(x0, Math.round(30 * ui) - this.nameText.height + 2 * ui);
      y = Math.round(42 * ui);
    }
    // HP: a ruled box filled in red ink, the number written after it.
    this.hpText.text = `${Math.max(0, Math.round(u.hp))}`;
    const hpW = this.hpText.width;
    const boxH = Math.max(7, Math.round((this.vertical ? 8 : 13) * ui));
    const label = (s: string, yy: number): number => {
      if (this.vertical) return x0;
      const t = txt(s, { fontFamily: CINZEL, fontWeight: "700", fontSize: Math.round(9 * ui), fill: P.inkSoft, letterSpacing: 1.5 * ui });
      t.position.set(x0, yy);
      this.labels.addChild(t);
      return x0;
    };
    // Remove the labels added last time (Graphics children).
    for (const c of this.labels.removeChildren()) c.destroy();
    if (!this.vertical) {
      label("HP", y);
      y += Math.round(13 * ui);
    } else y += Math.round(4 * ui);
    const bx = x0;
    const bwHp = bw - hpW - 8 * ui;
    g.rect(bx, y, bwHp, boxH).fill({ color: 0xffffff, alpha: 0.35 });
    if (this.ghost > this.shownHp) g.rect(bx, y, bwHp * this.ghost, boxH).fill({ color: 0xe8a090, alpha: 0.8 });
    g.rect(bx, y, bwHp * Math.max(0, this.shownHp), boxH).fill({ color: P.redInk, alpha: 0.88 });
    // Ink hatching over the fill, for the hand-coloured look.
    for (let hx = bx + 3; hx < bx + bwHp * this.shownHp - 2; hx += 5 * ui) g.moveTo(hx, y + boxH).lineTo(hx + boxH * 0.6, y).stroke({ width: 1, color: 0x6a0e08, alpha: 0.35 });
    if (u.shield > 0) g.rect(bx, y, bwHp * Math.min(1, u.shield / Math.max(1, u.maxHp)), boxH * 0.4).fill({ color: P.blueInk, alpha: 0.7 });
    inkLine(g, bx, y, bx + bwHp, y, 1.2 * ui, P.ink, 0.85, this.seed);
    inkLine(g, bx, y + boxH, bx + bwHp, y + boxH, 1.2 * ui, P.ink, 0.85, this.seed + 1);
    inkLine(g, bx, y, bx, y + boxH, 1.2 * ui, P.ink, 0.85, this.seed + 2);
    inkLine(g, bx + bwHp, y, bx + bwHp, y + boxH, 1.2 * ui, P.ink, 0.85, this.seed + 3);
    for (let i = 1; i < 4; i++) g.rect(bx + (bwHp * i) / 4, y + boxH * 0.55, 1, boxH * 0.45).fill({ color: P.ink, alpha: 0.5 });
    this.hpText.position.set(bx + bwHp + 6 * ui, y + boxH / 2 - this.hpText.height / 2);
    y += boxH + Math.round((this.vertical ? 5 : 9) * ui);
    // Focus: blue pencil.
    if (!this.vertical) {
      label("FOCUS", y);
      y += Math.round(13 * ui);
    }
    const fh = Math.max(4, Math.round((this.vertical ? 5 : 7) * ui));
    const ff = u.focus / Math.max(1, u.maxFocus);
    g.rect(bx, y, bw, fh).stroke({ width: 1, color: P.blueInk, alpha: 0.55 });
    for (let hx = bx + 1; hx < bx + bw * ff; hx += 2.5 * ui) g.moveTo(hx, y + fh).lineTo(hx + fh * 0.8, y).stroke({ width: 1.1 * ui, color: P.blueInk, alpha: 0.75 });
    y += fh + Math.round((this.vertical ? 5 : 10) * ui);
    // The class resource: punched holes, brass where it is filled.
    if (u.resource) {
      const r = u.resource;
      this.resText.text = r.name.toUpperCase();
      this.resText.visible = !this.vertical;
      this.resText.position.set(bx, y);
      const px = this.vertical ? bx + 3 * ui : bx + this.resText.width + 10 * ui;
      const room = bw - (px - bx);
      const cy = this.vertical ? y + 4 * ui : y + this.resText.height / 2;
      if (r.max <= 10) {
        const rr = Math.min((this.vertical ? 3.4 : 5) * ui, room / Math.max(1, r.max) / 3.4);
        for (let i = 0; i < r.max; i++) {
          const cx = px + rr * 1.6 + i * rr * 3.4;
          if (i < r.value) eyelet(g, cx, cy, rr);
          else g.circle(cx, cy, rr).fill({ color: 0x2a1608, alpha: 0.85 }).circle(cx + rr * 0.2, cy + rr * 0.25, rr * 0.75).fill({ color: 0x5a3a1a, alpha: 0.6 });
        }
      } else {
        g.rect(px, cy - 2 * ui, room, 4 * ui).stroke({ width: 1, color: P.brassDark });
        g.rect(px, cy - 2 * ui, room * (r.value / Math.max(1, r.max)), 4 * ui).fill({ color: P.brass });
      }
    } else this.resText.text = "";
    // Statuses: round stickers along the card's top edge.
    const s = Math.round((this.vertical ? 11 : 15) * ui);
    u.statuses.slice(0, 5).forEach((st, i) => {
      const style = STATUS_STYLE[st.id];
      const sx = w - pad - s / 2 - i * (s + 4 * ui);
      const sy = Math.round(8 * ui) + s / 2;
      g.circle(sx + 1, sy + 1.5, s / 2 + 1.5 * ui).fill({ color: 0x000000, alpha: 0.25 });
      g.circle(sx, sy, s / 2 + 1.5 * ui).fill({ color: 0xfffaf0 });
      drawStatusGlyph(g, style.glyph, sx - s * 0.36, sy - s * 0.36, s * 0.72, style.color);
    });
    // Turn and target: the shop's yellow highlight around the card; a push-pin on whose turn it is.
    const gl = this.glow;
    gl.clear();
    this.pinG.clear();
    if (this.active || this.targetable) {
      const color = P.glow;
      for (let i = 4; i >= 1; i--) gl.roundRect(-i * 2.2 * ui, -i * 2.2 * ui, w + i * 4.4 * ui, h + i * 4.4 * ui, 4 * ui + i * 2 * ui).stroke({ width: 2.4 * ui, color, alpha: 0.13 * (5 - i) });
      if (this.targetable && !this.active) {
        for (let dx = 0; dx < w; dx += 14 * ui) gl.rect(dx, -3 * ui, 8 * ui, 2 * ui).fill({ color: P.glow }).rect(dx, h + 1 * ui, 8 * ui, 2 * ui).fill({ color: P.glow });
      } else gl.roundRect(-2 * ui, -2 * ui, w + 4 * ui, h + 4 * ui, 4 * ui).stroke({ width: 2.5 * ui, color, alpha: 0.95 });
    }
    if (this.active) pin(this.pinG, w / 2, Math.round(7 * ui), Math.round(8 * ui));
    this.alpha = u.alive ? 1 : 0.9;
    this.bust.setGray(u.alive ? 0 : 0.85);
    if (!u.alive) {
      // Fallen: crossed out in red pencil.
      inkLine(g, w * 0.08, h * 0.15, w * 0.92, h * 0.85, 3 * ui, P.redInk, 0.75, this.seed + 9);
      inkLine(g, w * 0.92, h * 0.15, w * 0.08, h * 0.85, 3 * ui, P.redInk, 0.75, this.seed + 10);
    }
  }

  override get portraitCentre(): { x: number; y: number } {
    const r = this.rect;
    const pad = (this.vertical ? 7 : 12) * this.ui;
    if (this.vertical) return { x: r.x + r.w / 2, y: r.y + r.h * 0.3 - this.pivot.y };
    const pw = Math.min(r.w * 0.42, (r.h - pad * 2) * 0.86);
    return { x: r.x + pad + pw / 2, y: r.y + r.h * 0.42 - this.pivot.y };
  }
}
