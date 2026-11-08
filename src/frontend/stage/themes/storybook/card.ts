/**
 * Storybook battle: a party member is a tall gilt arch rising out of the page, the bust breathing in its
 * velvet niche, its foot tucked behind the page's rim. On the vellum under it: the crimson name scroll on
 * the rim, two phials (vigour in crimson, focus in blue) poured to the member's HP and Focus with the
 * numbers inked beside them, and the class resource as gilt rosettes. Statuses are wax seals pressed on the
 * arch's shoulder. The one acting rises in a gilt halo; a member you may choose wears a diamond badge.
 */
import { Container, FillGradient, Graphics, Text, TextStyle } from "pixi.js";
import { PartyCard } from "../../battle/party-card.js";
import type { DisplayUnit } from "../../battle/display.js";
import type { Rect } from "../../battle/layout.js";
import type { FigureSource } from "../../puppet/source.js";
import type { PuppetFigure } from "../../puppet/puppet-figure.js";
import { STATUS_STYLE } from "../../theme.js";
import { drawStatusGlyph } from "../../ui.js";
import { CINZEL, FELL, GARAMOND } from "../shared.js";
import { ARCH_VB, PHIAL_PATH, archBack, archFront, diamond, halo, phialGlass, phialShadow, pip, scroll, seal, vitalPlate } from "./art.js";
import { GEO } from "./layout.js";
import { ArtSprite } from "./sprite.js";

const WIN = "M36,372 V124 C36,64 78,32 120,32 C162,32 204,64 204,124 V372 Z";

/** A phial: dark glass, the draught (and the ghost of what was just lost), the glass and stopper on top. */
class Phial extends Container {
  private shadow = new ArtSprite("phial-shadow", phialShadow);
  private glass = new ArtSprite("phial-glass", phialGlass);
  private liquid = new Graphics();
  private mask_ = new Graphics();
  private k = 1;
  private grad: FillGradient;
  constructor(private colors: { deep: number; mid: number; top: number; ghost: number }) {
    super();
    this.mask_.svg(`<svg><path d="${PHIAL_PATH}" fill="#fff"/></svg>`);
    this.liquid.mask = this.mask_;
    this.grad = new FillGradient({ type: "linear", start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, colorStops: [{ offset: 0, color: colors.mid }, { offset: 1, color: colors.deep }], textureSpace: "local" });
    this.addChild(this.shadow, this.liquid, this.mask_, this.glass);
  }
  /** Size: the picture's height in px (its width follows). */
  size(h: number): void {
    const w = (h * 40) / 46;
    this.k = h / 46;
    for (const s of [this.shadow, this.glass]) {
      s.draw(w, h);
      s.position.set(-20 * this.k, -22 * this.k);
    }
    this.liquid.scale.set(this.k);
    this.mask_.scale.set(this.k);
  }
  /** Fill to `t` (0..1), with a lighter ghost to `ghost` and a pale shield band `extra` on top. */
  pour(t: number, ghost: number, extra = 0): void {
    const g = this.liquid;
    const top = -8, bottom = 20;
    const y = (v: number) => bottom - (bottom - top) * Math.max(0, Math.min(1, v));
    g.clear();
    if (ghost > t) g.rect(-16, y(ghost), 32, y(t) - y(ghost)).fill({ color: this.colors.ghost, alpha: 0.75 });
    if (t > 0) {
      g.rect(-16, y(t), 32, bottom - y(t) + 2).fill(this.grad);
      g.rect(-16, y(t), 32, 1.6).fill({ color: this.colors.top, alpha: 0.85 });
    }
    if (extra > 0) g.rect(-16, y(Math.min(1, t + extra)), 32, y(t) - y(Math.min(1, t + extra))).fill({ color: 0xd8e6f0, alpha: 0.55 });
  }
}

const style = (o: ConstructorParameters<typeof TextStyle>[0]) => new TextStyle(o);

export class BookCard extends PartyCard {
  private arch = new Container();
  private rim = new Graphics();
  private haloArt = new ArtSprite("halo", halo);
  private back = new ArtSprite("arch-back", () => archBack());
  private front = new ArtSprite("arch-front", archFront);
  private winMask = new Graphics();
  private flashMask = new Graphics();
  private seals = new Container();
  private stats = new Container();
  private scrollArt = new ArtSprite("scroll", () => scroll("talk"));
  private badge = new Container();
  private badgeArt = new ArtSprite("diamond", diamond);
  private badgeText = new Text({ text: "CHOOSE", style: style({ fontFamily: CINZEL, fontWeight: "800", fontSize: 11, fill: 0xffd27a, letterSpacing: 1.6 }) });
  private hp = new Phial({ deep: 0x5e0a12, mid: 0xc2242a, top: 0xff8f78, ghost: 0xf1d9b0 });
  private fo = new Phial({ deep: 0x0d1d4a, mid: 0x2d64b8, top: 0x9fd0ff, ghost: 0xc8dcf0 });
  private hpMax = new Text({ text: "", style: style({ fontFamily: CINZEL, fontSize: 12, fill: 0x7a5a3a, fontWeight: "700" }) });
  private foText = new Text({ text: "", style: style({ fontFamily: CINZEL, fontSize: 18, fill: 0x1d2f6b, fontWeight: "700" }) });
  private pips = new Container();
  private resPlate = new Graphics();
  private vitals = new Container();
  private embers = new Graphics();
  private plateArt = new ArtSprite("vital-plate", vitalPlate);
  private archH = 100;
  private aw = 100;
  private top = 0;
  /** The arch's picture scale; a phone's arch is squat (wide for its height), so the two differ. */
  private kx = 1;
  private ky = 1;
  private hot = false;
  private haloA = 0;
  private sig = "";
  private vitalsH = { py: 0, pH: 10, pw: 10, px: 0 };
  private pipSize = 14;
  /** Reduced motion: no pulsing halo or bobbing badge. */
  private still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  constructor(unit: DisplayUnit, bust: FigureSource, strength: number, cutout = true) {
    super(unit, bust, strength, cutout);
    this.removeChildren();
    this.portrait.mask = this.winMask;
    this.vitals.addChild(this.plateArt, this.hp, this.hpText, this.hpMax, this.fo, this.foText);
    this.haloArt.blendMode = "add";
    this.embers.blendMode = "add";
    this.arch.addChild(this.haloArt, this.embers, this.back, this.portrait, this.winMask, this.front, this.flash, this.flashMask, this.seals, this.vitals);
    this.flash.mask = this.flashMask;
    this.flash.blendMode = "add";
    this.arch.mask = this.rim;
    this.badge.addChild(this.badgeArt, this.badgeText);
    this.badgeText.anchor.set(0.5);
    this.badge.visible = false;
    this.stats.addChild(this.resPlate, this.scrollArt, this.nameText, this.badge, this.resText, this.pips);
    this.addChild(this.arch, this.rim, this.stats);
    this.nameText.anchor.set(0.5);
    this.on("pointerover", () => { this.hot = true; this.redraw(); });
    this.on("pointerout", () => { this.hot = false; this.redraw(); });
  }

  override place(rect: Rect, ui: number): void {
    this.rect = rect;
    this.ui = ui;
    this.position.set(rect.x, rect.y);
    const aw = rect.w;
    const archH = GEO.archH;
    const compact = GEO.compact;
    const ah = compact ? archH / 0.9 : (aw * ARCH_VB.h) / ARCH_VB.w;
    this.aw = aw;
    this.archH = archH;
    this.top = archH - ah * 0.9;
    const kx = aw / ARCH_VB.w;
    const ky = ah / ARCH_VB.h;
    this.kx = kx;
    this.ky = ky;
    for (const s of [this.back, this.front]) {
      s.draw(aw, ah);
      s.position.set(0, this.top);
    }
    const hs = aw * (compact ? 1.45 : 1.9);
    this.haloArt.draw(hs, hs);
    this.haloArt.position.set(aw / 2 - hs / 2, this.top + ah * 0.36 - hs * 0.533);
    for (const m of [this.winMask, this.flashMask]) {
      m.clear().svg(`<svg><path d="${WIN}" fill="#fff"/></svg>`);
      m.scale.set(kx, ky);
      m.position.set(-ARCH_VB.x * kx, this.top - ARCH_VB.y * ky);
    }
    // The rim: the arch is cut at the page's top edge (it stands behind the page).
    this.rim.clear().rect(-aw, -rect.h * 2, aw * 3, archH + rect.h * 2 + 2).fill({ color: 0xffffff });
    this.fitArch();
    // The stats band on the vellum.
    const sh = rect.h - archH;
    const sw = aw * 1.02;
    const sH = (sw * 72) / 200;
    this.scrollArt.draw(sw, sH);
    const ribbonMid = archH + Math.max(2, 4 * ui);
    this.scrollArt.position.set(aw / 2 - sw / 2, ribbonMid - sH * (55 / 72));
    const fs = Math.max(10, Math.round((sw / 200) * 14.5));
    this.nameText.scale.set(1);
    if (compact) {
      // Never smaller than this: a long name loses its end, not its legibility.
      this.nameText.style = style({ fontFamily: GARAMOND, fontWeight: "700", fontSize: 14, fill: 0xfff0cc, stroke: { color: 0x2a0606, width: 3 } });
      let name = this.unit.name;
      this.nameText.text = name;
      while (this.nameText.width > sw * 0.8 && name.length > 3) {
        name = name.slice(0, -1).trimEnd();
        this.nameText.text = `${name}…`;
      }
    } else {
      this.nameText.style = style({ fontFamily: CINZEL, fontWeight: "800", fontSize: fs, fill: 0xfff0cc, letterSpacing: Math.max(1, fs * 0.14), stroke: { color: 0x2a0606, width: Math.max(1.5, fs * 0.16) } });
      this.nameText.text = this.unit.name.toUpperCase();
      if (this.nameText.width > sw * 0.7) this.nameText.scale.set((sw * 0.7) / this.nameText.width);
    }
    this.nameText.position.set(aw / 2, ribbonMid - sH * 0.02);
    const bw = compact ? Math.min(aw, 112) : Math.min(aw * 0.62, 110 * ui);
    this.badgeArt.draw(bw, (bw * 38) / 100);
    this.badgeText.style = style({ fontFamily: CINZEL, fontWeight: "800", fontSize: compact ? 12 : Math.max(9, Math.round(bw * 0.1)), fill: 0xffd27a, letterSpacing: compact ? 0.6 : 1.6 });
    this.badge.position.set(aw / 2 - bw / 2, this.scrollArt.y - (bw * 38) / 100 * 0.35);
    this.badgeText.position.set(bw / 2, (bw * 38) / 100 / 2);
    // Vitals: a brass plate across the arch's foot, above the name scroll (it rises with the arch).
    const pw = Math.round(compact ? aw - 6 : aw * 0.86), pH = compact ? 24 : Math.round(pw * 0.22);
    const px = (aw - pw) / 2, py = Math.round(ribbonMid - sH * 0.34 - pH - Math.max(2, aw * 0.02));
    this.plateArt.draw(pw, pH);
    this.plateArt.position.set(px, py);
    const ph = pH * 0.98;
    this.hp.size(ph);
    this.fo.size(ph);
    this.hp.position.set(px + pw * 0.04 + ph * 0.4, py + pH * 0.52);
    this.fo.position.set(px + pw * 0.52 + ph * 0.4, py + pH * 0.52);
    const big = compact ? 13 : Math.max(11, Math.round(pH * 0.56));
    const ink = { color: 0x120604, width: Math.max(2, big * 0.14) };
    this.hpText.style = style({ fontFamily: CINZEL, fontWeight: "800", fontSize: big, fill: 0xffefc7, stroke: ink });
    this.hpMax.style = style({ fontFamily: CINZEL, fontWeight: "700", fontSize: Math.max(8, Math.round(big * 0.5)), fill: 0xf1b8a0, stroke: ink });
    this.foText.style = style({ fontFamily: CINZEL, fontWeight: "800", fontSize: big, fill: 0xd8e8ff, stroke: ink });
    // The numbers clear of their phials.
    const gapX = ph * 0.52 + Math.max(3, pw * 0.035);
    // Four to a phone: no room for the phials beside the numbers, and the numbers matter more.
    const phials = !compact || pw >= 96;
    this.hp.visible = this.fo.visible = phials;
    this.hpText.position.set(phials ? this.hp.x + gapX : px + 8, py + (pH - big * 1.25) / 2);
    this.foText.position.set(phials ? this.fo.x + gapX : px + pw / 2 + 8, py + (pH - big * 1.25) / 2);
    this.vitalsH = { py, pH, pw, px };
    // Under the scroll, on the vellum: the class resource as rosettes, centred.
    const rs = compact ? 11 : Math.max(10, Math.round(Math.min(18, aw * 0.07)));
    this.resText.style = style({ fontFamily: FELL, fontStyle: "italic", fontSize: compact ? 13 : Math.max(11, Math.round(rs * 0.95)), fill: compact ? 0xf3d791 : 0xe9c57a });
    this.resText.position.set(0, ribbonMid + sH * 0.2 + Math.max(2, 3 * ui));
    this.pipSize = rs;
    this.hitArea = { contains: (x: number, y: number) => x >= 0 && x <= aw && y >= this.top && y <= rect.h };
    void sh;
    // The rosettes, their plate and the seals are placed in redraw: a new size must lay them out again.
    this.sig = "";
    this.redraw();
  }

  private fitArch(): void {
    for (const f of this.portrait.children) this.fitOne(f as PuppetFigure);
  }

  private fitOne(bust: PuppetFigure): void {
    const wx0 = (36 - ARCH_VB.x) * this.kx, wx1 = (204 - ARCH_VB.x) * this.kx;
    const wy0 = this.top + (32 - ARCH_VB.y) * this.ky;
    const wy1 = this.archH;
    const ww = wx1 - wx0, wh = wy1 - wy0;
    if (bust.framed) {
      const s = Math.max(ww / bust.imageW, (wh * 1.05) / bust.imageH);
      bust.scale.set(s);
      bust.position.set(this.aw / 2, wy0 + bust.imageH * s - Math.max(0, bust.imageH * s - wh) * 0.12);
      return;
    }
    // A cut-out: head and shoulders down to the waist, the face a sixth of the window, in its upper third.
    const face = bust.faceLocal;
    const faceH = Math.max(1, bust.faceHeightLocal);
    // A phone's window is short: a closer crop, or the face is lost behind the vitals.
    const s = GEO.compact ? Math.max(ww / bust.imageW, (wh * 0.34) / faceH) : Math.min(wh / (bust.imageH * 0.42), Math.max(wh / (bust.imageH * 1.3), (wh * 0.2) / faceH));
    bust.scale.set(s);
    bust.position.set(this.aw / 2 - face.x * s, wy0 + wh * (GEO.compact ? 0.26 : 0.3) - face.y * s);
  }

  override replaceBust(source: FigureSource, strength: number, cutout: boolean): { fresh: PuppetFigure; old: PuppetFigure } {
    const r = super.replaceBust(source, strength, cutout);
    this.fitArch();
    return r;
  }

  protected override redraw(): void {
    const u = this.unit;
    if (!this.hp) return; // Called from the base constructor, before our parts exist.
    const ui = this.ui;
    this.hp.pour(this.shownHp, this.ghost, u.shield / Math.max(1, u.maxHp));
    this.fo.pour(u.focus / Math.max(1, u.maxFocus), 0);
    this.hpText.text = `${Math.max(0, Math.round(u.hp))}`;
    this.hpMax.text = `/${u.maxHp}`;
    this.hpMax.position.set(this.hpText.x + this.hpText.width + 1, this.hpText.y + this.hpText.height - this.hpMax.height - 1);
    const vh = this.vitalsH;
    this.hpMax.visible = this.hpMax.x + this.hpMax.width < vh.px + vh.pw * 0.49;
    this.foText.text = `${Math.round(u.focus)}`;
    // Class resource: label and rosettes.
    const key = `${u.resource?.value}/${u.resource?.max}|${u.statuses.map((s) => s.id).join(",")}|${u.alive}`;
    if (key !== this.sig) {
      this.sig = key;
      for (const c of this.pips.removeChildren()) c.destroy();
      if (u.resource) {
        const r = u.resource;
        this.resText.text = r.name;
        let n = Math.min(r.max, 10);
        let size = Math.max(9, Math.min(this.pipSize, (this.aw * 0.96 - this.resText.width - 6) / Math.max(1, n) - 1));
        // Rosettes that won't fit under a phone's arch become the plain count.
        if (GEO.compact && this.resText.width + 5 + n * (size + 1) > this.aw - 6) {
          this.resText.text = `${r.name} ${r.value}/${r.max}`;
          n = 0;
          size = 0;
        }
        const total = this.resText.width + 5 + n * (size + 1);
        this.resText.x = (this.aw - total) / 2;
        const x0 = this.resText.x + this.resText.width + 5;
        // A dark bronze plate under the label and rosettes, hanging from the name scroll.
        const ph = Math.max(size, this.resText.height) + 6;
        const py = this.resText.y + this.resText.height / 2 - ph / 2;
        const pad = GEO.compact ? 5 : 9;
        this.resPlate.clear().roundRect(this.resText.x - pad, py, total + pad * 2, ph, ph * 0.3).fill({ color: 0x1a110b, alpha: 0.92 }).stroke({ width: 1, color: 0xd4af37 })
          .roundRect(this.resText.x - pad + 3, py + 3, total + pad * 2 - 6, ph - 6, ph * 0.22).stroke({ width: 0.6, color: 0x8a6a2a, alpha: 0.8 });
        // Two gilt hangers tie the plate to the name scroll above it.
        for (const hx of [this.resText.x + 4, this.resText.x + total - 6]) this.resPlate.rect(hx, py - 7, 2.2, 8).fill({ color: 0xd4af37 }).stroke({ width: 0.5, color: 0x3a1a08 });
        for (let i = 0; i < n; i += 1) {
          const on = r.max > 10 ? i < Math.round((r.value / r.max) * n) : i < r.value;
          const p = new ArtSprite(on ? "pip-on" : "pip-off", () => pip(on)).draw(size, size);
          p.position.set(x0 + i * (size + 1), this.resText.y + this.resText.height / 2 - size / 2);
          this.pips.addChild(p);
        }
      } else {
        this.resText.text = "";
        this.resPlate.clear();
      }
      // Statuses: wax seals down the arch's right shoulder.
      for (const c of this.seals.removeChildren()) c.destroy({ children: true });
      const ss = GEO.compact ? 20 : Math.max(22, Math.round(this.aw * 0.17));
      u.statuses.slice(0, 5).forEach((st, i) => {
        const sty = STATUS_STYLE[st.id];
        const c = new Container();
        c.addChild(new ArtSprite(sty.harmful ? "seal" : "seal-gold", () => (sty.harmful ? seal() : seal().replace(/url\(#sb-wax\)/g, "url(#sb-gold)"))).draw(ss, ss));
        const g = new Graphics();
        drawStatusGlyph(g, sty.glyph, ss * 0.3, ss * 0.3, ss * 0.4, sty.harmful ? 0xffe2c8 : 0x4a2a0e);
        c.addChild(g);
        c.position.set(this.aw - ss * (GEO.compact ? 1.05 : 0.72), this.top + (GEO.compact ? 12 : this.aw * 0.36) + i * (ss * 0.86));
        this.seals.addChild(c);
      });
    }
    this.badge.visible = this.targetable;
    this.badgeText.text = "CHOOSE";
    const dead = !u.alive;
    const dim = dead ? 0x6a6a6a : 0xffffff;
    this.front.tint = this.back.tint = dim;
    this.stats.alpha = dead ? 0.55 : 1;
    this.bust.setGray(dead ? 0.85 : 0);
    this.cursor = this.targetable ? "pointer" : "default";
    this.scrollArt.tint = this.targetable && this.hot ? 0xffe8c0 : 0xffffff;
  }

  override update(now: number, dt: number): void {
    this.now = now;
    for (const f of this.portrait.children) (f as PuppetFigure).update(now, dt);
    const want = this.active ? 1 : 0;
    const a = 1 - Math.exp(-dt / 0.14);
    this.lift += (want - this.lift) * a;
    // The one acting steps forward: the arch rises and grows a little, embers drift up from its halo.
    this.arch.pivot.set(this.aw / 2, this.archH);
    // On a phone the arches stand shoulder to shoulder: the one acting barely steps out of line.
    this.arch.position.set(this.aw / 2, this.archH - this.lift * (GEO.compact ? 3 : 16 * this.ui));
    this.arch.scale.set(1 + this.lift * (GEO.compact ? 0.015 : 0.08));
    const e = this.embers;
    e.clear();
    if (this.lift > 0.05 && !this.still) {
      for (let i = 0; i < 12; i += 1) {
        const t = (now * (0.18 + (i % 4) * 0.05) + i * 0.37) % 1;
        const x = this.aw * (0.15 + ((i * 0.618) % 1) * 0.7) + Math.sin(now * 1.3 + i) * 6;
        const y = this.archH * (0.85 - t * 0.95) + this.top * 0.2;
        e.circle(x, y, 1.2 + (i % 3) * 0.6).fill({ color: i % 2 ? 0xffd27a : 0xffb060, alpha: this.lift * (1 - t) * 0.9 });
      }
    }
    this.haloA += ((this.active ? 1 : this.targetable ? 0.45 : 0) - this.haloA) * a;
    // On a phone the halo reaches the foes' plates just above the arches: fainter, so they stay legible.
    this.haloArt.alpha = this.haloA * (GEO.compact ? 0.5 : 1) * (this.still ? 1 : 0.85 + 0.15 * Math.sin(now * 2.2));
    this.haloArt.visible = this.haloA > 0.01;
    // On a phone it wears the badge at the arch's crown: at its foot it would hide the numbers you are choosing by.
    if (this.targetable) this.badge.y = GEO.compact ? this.top + 6 : this.scrollArt.y - this.badgeArt.height * 0.35 - (this.still ? 0 : (1 + Math.sin(now * 5)) * 2 * this.ui);
    if (now > this.ghostHoldUntil && this.ghost > this.shownHp) {
      this.ghost = Math.max(this.shownHp, this.ghost - dt * 0.9);
      this.redraw();
    }
  }

  override get portraitCentre(): { x: number; y: number } {
    return { x: this.x + this.aw / 2, y: this.y + this.arch.y - this.archH + this.top + (150 - ARCH_VB.y) * this.ky };
  }
}
