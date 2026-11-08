/**
 * A party member's card along the bottom: a breathing bust (a lite puppet,
 * masked to the portrait window), name, HP with a ghost drain, Focus, the
 * class resource as pips, and status glyphs. Lifts and glows while it is
 * that member's turn; flashes and shakes when hit; greys out when fallen.
 */
import { Container, Graphics, Text } from "pixi.js";
import { PuppetFigure } from "../puppet/puppet-figure.js";
import type { FigureSource } from "../puppet/source.js";
import { C, STATUS_STYLE, T } from "../theme.js";
import { caps, SKIN } from "../skin.js";
import { chamferPoints, drawBar, drawPanel, drawStatusGlyph, vgrad, fitText } from "../ui.js";
import type { DisplayUnit } from "./display.js";
import type { Rect } from "./layout.js";

export class PartyCard extends Container {
  readonly id: string;
  readonly portrait = new Container();
  bust: PuppetFigure;
  protected frame = new Graphics();
  protected portraitMask = new Graphics();
  protected shade = new Graphics();
  protected info = new Graphics();
  protected glow = new Graphics();
  readonly flash = new Graphics();
  protected nameText: Text;
  protected hpText: Text;
  protected resText: Text;
  rect: Rect = { x: 0, y: 0, w: 100, h: 100 };
  protected unit: DisplayUnit;
  protected ui = 1;
  protected ghost = 1;
  protected ghostHoldUntil = 0;
  protected shownHp = 1;
  protected now = 0;
  protected active = false;
  protected targetable = false;
  /** Lift while active (eased). */
  protected lift = 0;

  constructor(unit: DisplayUnit, bust: FigureSource, strength: number, cutout = true) {
    super();
    this.id = unit.id;
    this.unit = unit;
    this.bust = new PuppetFigure({ source: bust, kind: "standing", key: `${unit.id}:bust`, strength, lite: true, framed: !cutout });
    this.portrait.addChild(this.bust);
    this.portrait.mask = this.portraitMask;
    this.nameText = new Text({ text: caps(unit.name), style: T.name(13, C.onArt) });
    this.hpText = new Text({ text: "", style: T.num(12) });
    this.resText = new Text({ text: "", style: T.label(9) });
    this.addChild(this.glow, this.frame, this.portrait, this.portraitMask, this.shade, this.info, this.nameText, this.hpText, this.resText, this.flash);
    this.shownHp = unit.hp / Math.max(1, unit.maxHp);
    this.ghost = this.shownHp;
    this.eventMode = "static";
  }

  place(rect: Rect, ui: number): void {
    this.rect = rect;
    this.ui = ui;
    this.position.set(rect.x, rect.y);
    const { w, h } = rect;
    const ph = Math.round(h * (w > 180 ? 0.56 : 0.5));
    const pad = Math.round(4 * ui);
    this.frame.clear();
    drawPanel(this.frame, 0, 0, w, h, { chamfer: 7 * ui, inner: true, fill: C.card, fillBottom: C.cardBottom });
    this.portraitMask.clear().poly(chamferPoints(pad, pad, w - 2 * pad, ph, 5 * ui)).fill({ color: 0xffffff });
    this.fitBust(this.bust, w, ph, pad);
    this.shade.clear().rect(pad, pad + ph * 0.55, w - 2 * pad, ph * 0.45).fill(vgrad(0x000000, 0x000000, 0, 0.75));
    // On light card stock the name gets a paper ribbon across the portrait foot, in the theme's ink.
    const light = luma(C.card) > 0.5;
    this.nameText.style = T.name(Math.round((w > 180 ? 15 : 12.5) * ui), light ? C.text : C.onArt);
    fitText(this.nameText, w - 2 * pad - 8 * ui);
    this.nameText.position.set(pad + 4 * ui, pad + ph - this.nameText.height - 2 * ui);
    if (light) {
      this.shade.clear().rect(pad, this.nameText.y - 2 * ui, w - 2 * pad, this.nameText.height + 4 * ui).fill({ color: C.panelHi });
      this.shade.rect(pad, this.nameText.y - 2 * ui, w - 2 * pad, 1).fill({ color: C.line });
    }
    this.hpText.style = T.num(Math.round((w > 180 ? 13 : 11) * ui));
    this.resText.style = T.label(Math.round(8.5 * ui), C.textDim);
    this.hitArea = { contains: (x: number, y: number) => x >= 0 && y >= 0 && x <= w && y <= h };
    this.redraw();
  }

  /** Swap the portrait (custom art); the old one stays until the caller fades and drops it. */
  replaceBust(source: FigureSource, strength: number, cutout: boolean): { fresh: PuppetFigure; old: PuppetFigure } {
    const old = this.bust;
    this.bust = new PuppetFigure({ source, kind: "standing", key: `${this.id}:bust`, strength, lite: true, framed: !cutout });
    this.portrait.addChild(this.bust);
    this.place(this.rect, this.ui);
    this.redraw();
    return { fresh: this.bust, old };
  }

  dropBust(old: PuppetFigure): void {
    if (old === this.bust) return;
    this.portrait.removeChild(old);
    old.destroy({ children: true });
  }

  protected fitBust(bust: PuppetFigure, w: number, ph: number, pad: number): void {
    if (bust.framed) {
      // An opaque picture: cover the window, kept to its upper part.
      const k = Math.max((w - 2 * pad) / bust.imageW, ph / bust.imageH);
      bust.scale.set(k);
      bust.position.set(w / 2, pad + bust.imageH * k - Math.max(0, bust.imageH * k - ph) * 0.15);
      return;
    }
    // Frame on the rig's face box, not a fixed image height: generated busts
    // put the head anywhere from the top fifth to the middle. The face takes
    // about a third of the window, sitting a little above its middle.
    const face = bust.faceLocal;
    const faceH = Math.max(1, bust.faceHeightLocal);
    const k = Math.min(ph / (bust.imageH * 0.35), Math.max(ph / (bust.imageH * 1.2), (ph * 0.3) / faceH));
    bust.scale.set(k);
    bust.position.set(w / 2 - face.x * k, pad + ph * 0.42 - face.y * k);
  }

  setUnit(unit: DisplayUnit): void {
    const next = unit.hp / Math.max(1, unit.maxHp);
    if (next < this.shownHp) this.ghostHoldUntil = this.now + 0.45;
    else this.ghost = Math.max(this.ghost, next);
    this.shownHp = next;
    this.unit = unit;
    this.redraw();
  }

  setActive(on: boolean): void {
    this.active = on;
    this.redraw();
  }

  setTargetable(on: boolean): void {
    this.targetable = on;
    this.cursor = on ? "pointer" : "default";
    this.redraw();
  }

  protected redraw(): void {
    const u = this.unit;
    const { w, h } = this.rect;
    const ui = this.ui;
    const pad = Math.round(4 * ui);
    const ph = Math.round(h * (w > 180 ? 0.56 : 0.5));
    const g = this.info;
    g.clear();
    let y = pad + ph + Math.round(6 * ui);
    const bw = w - 2 * pad - 4 * ui;
    const x = pad + 2 * ui;
    const barH = Math.max(4, Math.round((w > 180 ? 7 : 5) * ui));
    this.hpText.text = `${Math.max(0, Math.round(u.hp))}`;
    this.hpText.position.set(w - pad - 2 * ui - this.hpText.width, y - 1);
    g.rect(x, y + this.hpText.height * 0.5 - 0.5, 0, 0);
    const label = this.hpText.height;
    drawBar(g, x, y + label * 0.5 - barH / 2, bw - this.hpText.width - 6 * ui, barH, this.shownHp, this.ghost, C.hp, C.hpHi, u.shield / Math.max(1, u.maxHp));
    y += label + Math.round(3 * ui);
    drawBar(g, x, y, bw, Math.max(3, barH - 2), u.focus / Math.max(1, u.maxFocus), 0, C.focus, C.focusHi, 0, C.shield, true);
    y += Math.max(3, barH - 2) + Math.round(5 * ui);
    if (u.resource) {
      const r = u.resource;
      this.resText.text = r.name.toUpperCase();
      this.resText.position.set(x, y - 2 * ui);
      const px = x + this.resText.width + 6 * ui;
      const room = bw - (px - x);
      if (r.max <= 8) {
        const s = Math.min(8 * ui, room / Math.max(1, r.max) - 3);
        for (let i = 0; i < r.max; i += 1) {
          const cx = px + i * (s + 3) + s / 2;
          const cy = y + this.resText.height / 2 - 2 * ui;
          const pts = [cx, cy - s / 2, cx + s / 2, cy, cx, cy + s / 2, cx - s / 2, cy];
          g.poly(pts).fill({ color: i < r.value ? C.gold : C.poiseEmpty }).stroke({ width: 1, color: i < r.value ? 0x000000 : C.goldDim, alpha: 0.8 });
        }
      } else {
        drawBar(g, px, y + 1, room, 4 * ui, r.value / Math.max(1, r.max), 0, C.goldDim, C.gold);
      }
    } else this.resText.text = "";
    const s = Math.round(12 * ui);
    u.statuses.slice(0, 5).forEach((st, i) => {
      const style = STATUS_STYLE[st.id];
      drawStatusGlyph(g, style.glyph, pad + 3 * ui + i * (s + 2), pad + 3 * ui, s, style.color);
    });
    // Turn glow and target hint.
    const gl = this.glow;
    gl.clear();
    if ((this.active || this.targetable) && SKIN.frame.corner === "square") {
      // No glow on a pixel grid: a solid rule outside the frame.
      const color = this.active ? C.gold : C.ally;
      gl.rect(-3, -3, w + 6, h + 6).stroke({ width: 2, color, alignment: 1 });
    } else if (this.active || this.targetable) {
      const color = this.active ? C.gold : C.ally;
      for (let i = 3; i >= 1; i -= 1) {
        gl.poly(chamferPoints(-i * 2, -i * 2, w + i * 4, h + i * 4, 7 * ui + i)).stroke({ width: 2, color, alpha: 0.12 * (4 - i) });
      }
      gl.poly(chamferPoints(0, 0, w, h, 7 * ui)).stroke({ width: 1.5, color, alpha: 0.95 });
    }
    this.alpha = u.alive ? 1 : 0.92;
    this.bust.setGray(u.alive ? 0 : 0.85);
  }

  update(now: number, dt: number): void {
    this.now = now;
    for (const f of this.portrait.children) (f as PuppetFigure).update(now, dt);
    const want = this.active ? 1 : 0;
    this.lift += (want - this.lift) * (1 - Math.exp(-dt / 0.12));
    this.pivot.y = this.lift * 6 * this.ui;
    if (now > this.ghostHoldUntil && this.ghost > this.shownHp) {
      this.ghost = Math.max(this.shownHp, this.ghost - dt * 0.9);
      this.redraw();
    }
  }

  /** Centre of the portrait on screen (for numbers and sparks). */
  get portraitCentre(): { x: number; y: number } {
    return { x: this.rect.x + this.rect.w / 2, y: this.rect.y + this.rect.h * 0.28 - this.pivot.y };
  }
}

/** Perceived lightness of a colour, 0..1. */
function luma(c: number): number {
  return (0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255)) / 255;
}
