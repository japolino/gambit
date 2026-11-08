/**
 * Storybook battle: the command window is the book itself. The acting member's skills hang as silk ribbons
 * with brass medallions on the right, under "What will … do?" (as the scene's choices do): a blue silk for
 * a skill, crimson brocade for the signature, grey iron silk for one you cannot use yet (its reason written
 * on it). The page's right half tells the tale: the skill under the pointer (its lore, its cost) with a
 * woodcut drop cap, the hint while you choose a target, and the last blows while the fight plays out. The
 * acting member's name rides the page's rim on the brass nameplate.
 * Keyboard: number keys pick, arrows move, Enter takes, Escape goes back (wired by ./decor.ts).
 * On a phone (GEO.compact) all of that is a plain page: flat ribbons drawn at once (no picture to wait for), each
 * a full tap target with its cost or its reason written on it; choosing a skill tells its lore and lists the targets.
 */
import { CanvasTextMetrics, Container, Graphics, Text, TextStyle } from "pixi.js";
import { ActionMenu, type MenuSkill } from "../../battle/action-menu.js";
import type { Rect } from "../../battle/layout.js";
import { CINZEL, FELL, GARAMOND } from "../shared.js";
import { capTile, medal, nameplate, nib, ribbonArt } from "./art.js";
import { GEO, RIB_GAP, RIB_H } from "./layout.js";
import { ArtSprite } from "./sprite.js";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const INK = 0x261409;
/** The flat ribbons' cloth on a phone (the same silks as the pictures). */
const CLOTH: Record<string, number> = { "sb-pat-do": 0x1c3560, "sb-pat-fight": 0x6e1919, "sb-pat-iron": 0x463c34, "sb-pat-deal": 0x1f4a30 };

type Rib = { c: Container; art: ArtSprite; base: number; enabled: boolean; take: () => void; lore: () => void; x: number };

/** Which emblem a skill wears on its medallion (from its name and lore). */
function iconOf(s: MenuSkill): string {
  const t = `${s.name} ${s.flavor ?? ""}`.toLowerCase();
  if (s.signature) return "star";
  if (/heal|mend|tend|salve|restor|bless|cure|life/.test(t)) return "heart";
  if (/guard|ward|shield|stance|parry|riposte|brace|aegis|cover|protect/.test(t)) return "shield";
  if (/tide|wave|water|drown|surge|flood/.test(t)) return "wave";
  if (/fire|flame|spark|bolt|light|star|burn|hex|curse|spell|arc/.test(t)) return "spark";
  if (/mark|read|opening|study|eye|watch|aim|find/.test(t)) return "eye";
  return "sword";
}

const st = (o: ConstructorParameters<typeof TextStyle>[0]) => new TextStyle(o);

/** Break `text` into lines: the first `capLines` lines are `indent` narrower (beside a drop cap). */
function breakLines(text: string, style: TextStyle, width: number, indent: number, capLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  const room = () => (lines.length < capLines ? width - indent : width);
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && CanvasTextMetrics.measureText(next, style).width > room()) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

export class BookMenu extends ActionMenu {
  private ribs: Rib[] = [];
  private focusI = -1;
  private textBox = new Container();
  private plate = new Container();
  private plateArt = new ArtSprite("plate", () => nameplate(300));
  private plateName = new Text({ text: "", style: st({ fontFamily: GARAMOND, fontWeight: "700", fontSize: 22, fill: 0xffefc7 }) });
  private nibArt = new ArtSprite("nib", nib);
  private tale: string[] = [];
  private taleWho = "";
  private k = 1;
  private t = 0;
  /** The skills last offered, to tell a chosen one's lore on a phone. */
  private offered: MenuSkill[] = [];
  /** Who may be chosen right now, and choosing them (from ./decor.ts). */
  targetsOf: () => { id: string; name: string }[] = () => [];
  tapTarget: (id: string) => void = () => {};

  constructor() {
    super();
    this.removeChildren();
    this.plate.addChild(this.plateArt, this.plateName);
    this.addChild(this.textBox, this.content, this.plate, this.nibArt);
  }

  override place(rect: Rect, ui: number): void {
    this.rect = rect;
    this.ui = ui;
    this.k = GEO.compact ? 1 : Math.max(0.8, GEO.s);
    this.position.set(rect.x, rect.y);
    this.render();
  }

  /** The tale so far (newest last), told by ./decor.ts from the engine's events. */
  narrate(lines: string[], who: string): void {
    this.tale = lines;
    this.taleWho = who;
    if (this.mode.kind === "wait") this.render();
  }

  /* ---------------- drawing ---------------- */

  private setPlate(name: string): void {
    const k = this.k;
    this.plate.visible = !!name && !GEO.compact;
    if (!this.plate.visible) return;
    const fs = Math.round(23 * k);
    this.plateName.style = st({ fontFamily: GARAMOND, fontWeight: "700", fontSize: fs, fill: 0xffefc7, letterSpacing: 0.4, dropShadow: { color: 0x000000, alpha: 0.9, blur: 2, distance: 2, angle: Math.PI / 2 } });
    this.plateName.text = name;
    const h = Math.round(50 * k);
    const w = Math.round(this.plateName.width + h * 2.1);
    const vw = Math.round((w / h) * 52);
    this.plateArt.draw(w + (16 * h) / 52, h, `plate-${vw}`, () => nameplate(vw));
    this.plateArt.position.set((-8 * h) / 52, 0);
    this.plateName.position.set((w - this.plateName.width) / 2, (h - this.plateName.height) / 2);
    this.plate.position.set(GEO.plate.x, GEO.plate.y - h * 0.55);
  }

  /** A paragraph with a woodcut drop cap; returns its height. */
  private paragraph(text: string, x: number, y: number, w: number, size: number, color = INK, italic = false): number {
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean) return 0;
    const style = st({ fontFamily: FELL, fontSize: size, fill: color, fontStyle: italic ? "italic" : "normal", lineHeight: size * 1.32 });
    const lh = size * 1.32;
    const cap = Math.round(lh * 2 - size * 0.18);
    const first = clean[0]!;
    const rest = clean.slice(1);
    const lone = /^\s/.test(rest);
    const gap = lone ? size * 0.32 : 2;
    const lines = breakLines(rest.trimStart(), style, w, cap + gap, 2);
    const tile = new ArtSprite("cap", capTile).draw(cap, cap);
    tile.position.set(x, y + 3);
    const letter = new Text({ text: first.toUpperCase(), style: st({ fontFamily: CINZEL, fontWeight: "800", fontSize: Math.round(cap * 0.62), fill: 0xffe7b0, stroke: { color: 0x2a0606, width: Math.max(2, cap * 0.05) } }) });
    letter.anchor.set(0.5);
    letter.position.set(x + cap / 2, y + 3 + cap * 0.53);
    this.textBox.addChild(tile, letter);
    lines.forEach((ln, i) => {
      const t = new Text({ text: ln, style });
      // The rest of the first word sits against the cap; small caps for it, like the scene's page.
      t.position.set(x + (i < 2 ? cap + gap : 0), y + i * lh + (i < 2 ? size * 0.12 : size * 0.12));
      this.textBox.addChild(t);
    });
    return Math.max(cap + 6, lines.length * lh);
  }

  private line(text: string, x: number, y: number, size: number, color: number, opts: { italic?: boolean; font?: string; weight?: string; maxW?: number; spacing?: number } = {}): Text {
    const t = new Text({ text, style: st({ fontFamily: opts.font ?? FELL, fontSize: size, fill: color, fontStyle: opts.italic ? "italic" : "normal", fontWeight: (opts.weight ?? "400") as "400", letterSpacing: opts.spacing ?? 0, wordWrap: !!opts.maxW, wordWrapWidth: opts.maxW ?? 0, lineHeight: size * 1.3 }) });
    t.position.set(x, y);
    this.textBox.addChild(t);
    return t;
  }

  /** A gilt-ruled ink stamp centred on y; returns its right edge. */
  private stamp(text: string, x: number, y: number, k: number, ink: number): number {
    const size = Math.round(Math.max(10, 12 * k));
    const t = new Text({ text: text.toUpperCase(), style: st({ fontFamily: CINZEL, fontWeight: "700", fontSize: size, fill: ink, letterSpacing: 1.6 }) });
    const px = 8 * k, ph = size + 9 * k;
    const g = new Graphics();
    g.roundRect(x, y - ph / 2, t.width + px * 2, ph, 2).fill({ color: 0xf6e7c4, alpha: 0.55 }).stroke({ width: 1.4, color: 0xb8862f })
      .roundRect(x + 2.5, y - ph / 2 + 2.5, t.width + px * 2 - 5, ph - 5, 1).stroke({ width: 0.7, color: ink, alpha: 0.6 });
    t.position.set(x + px, y - t.height / 2);
    this.textBox.addChild(g, t);
    return x + t.width + px * 2;
  }

  /** The page's text block for the current mode. */
  private tell(kind: "lore" | "target" | "tale", skill?: MenuSkill, hint?: string): void {
    for (const c of this.textBox.removeChildren()) c.destroy({ children: true });
    if (GEO.compact) return this.tellCompact(kind, skill, hint);
    const r = GEO.text;
    const k = this.k;
    const size = Math.round(Math.max(17, 24 * k));
    let y = r.y + 4 * k;
    // Two columns, as on the scene's page: the story now, and "Earlier" in the margin.
    const margin = r.w > 560 * k;
    const mw = margin ? Math.round(r.w * 0.36) : 0;
    const main = r.w - (margin ? mw + 34 * k : 0);
    const pw = Math.min(main, 40 * size);
    if (kind === "lore" && skill) {
      const head = this.line(skill.name, r.x, y, Math.round(size * 1.08), 0x7a1c1c, { weight: "400" });
      // Ink stamps beside the heading: what it costs, and whether it is the signature art.
      let sx = r.x + head.width + 16 * k;
      sx = this.stamp(skill.usable ? `Cost · ${skill.cost}` : "Not yet", sx, y + head.height / 2, k, skill.usable ? 0x7a4c1c : 0x8b1a1a);
      if (skill.signature) this.stamp("Signature art", sx + 8 * k, y + head.height / 2, k, 0x8b1a1a);
      y += head.height + 6 * k;
      const body = skill.usable ? skill.flavor || `${skill.signature ? "The signature art" : "A skill"} of the ${this.mode.kind === "skills" ? this.mode.actor : "party"}${skill.cost && skill.cost !== "Basic" && skill.cost !== "Free" ? `, at the cost of ${skill.cost.toLowerCase()}` : ", free to use"}.` : skill.reason ?? "Not now.";
      this.paragraph(body, r.x, y, pw, size, skill.usable ? INK : 0x5a2a1a, !skill.usable);
    } else if (kind === "target" && skill) {
      y += this.paragraph(`${hint ?? "Choose."}`, r.x, y, pw, size);
      this.line("Click a foe in the picture, or press its number. Escape to choose again.", r.x, y + 6 * k, Math.round(size * 0.7), 0x6b4a2a, { italic: true, maxW: pw });
    } else if (!this.tale.length) {
      this.line(this.mode.kind === "wait" && this.mode.text ? this.mode.text : "The page turns…", r.x, y, size, 0x4a2511, { italic: true });
    } else {
      this.paragraph(this.tale.at(-1)!, r.x, y, pw, size);
    }
    if (!margin) return;
    // The margin: a gilt quill-spindle, then the last few lines of the tale.
    const mx = r.x + r.w - mw;
    const dv = new Graphics();
    const dx = mx - 18 * k;
    dv.poly([dx, r.y + 4, dx + 4 * k, r.y + r.h * 0.5, dx, r.y + r.h - 4, dx - 4 * k, r.y + r.h * 0.5]).fill({ color: 0xc99a52 }).stroke({ width: 0.8, color: 0x6e481f });
    dv.moveTo(dx - 9 * k, r.y + 14).lineTo(dx - 9 * k, r.y + r.h - 14).stroke({ width: 0.8, color: 0x8a5a2a, alpha: 0.5 });
    dv.moveTo(dx + 9 * k, r.y + 14).lineTo(dx + 9 * k, r.y + r.h - 14).stroke({ width: 0.8, color: 0x8a5a2a, alpha: 0.5 });
    dv.circle(dx, r.y + r.h * 0.5, 4.5 * k).fill({ color: 0x8c2a1c }).stroke({ width: 1, color: 0xe9c57a });
    this.textBox.addChild(dv);
    this.line("EARLIER", mx, r.y + 2 * k, Math.round(Math.max(10, 12 * k)), 0x8a5a2a, { font: CINZEL, weight: "800", spacing: 3 });
    let my = r.y + 24 * k;
    const small = Math.round(Math.max(13, 17 * k));
    const earlier = (kind === "tale" ? this.tale.slice(0, -1) : this.tale).slice(-5).reverse();
    if (!earlier.length) this.line("Nothing yet: the first page of the fight.", mx, my, small, 0x8a6a4a, { italic: true, maxW: mw });
    for (const o of earlier) {
      const t = this.line(`❧ ${o}`, mx, my, small, 0x52341e, { italic: true, maxW: mw });
      if (my + t.height > r.y + r.h) {
        t.destroy();
        break;
      }
      my += t.height + 2;
    }
  }

  /** One line that fits `w`: it loses its end rather than shrinking out of reach. */
  private oneLine(text: string, x: number, y: number, w: number, size: number, color: number, opts: { italic?: boolean; font?: string; weight?: string } = {}): Text {
    const t = this.line(text, x, y, size, color, opts);
    let cut = text;
    while (t.width > w && cut.length > 4) {
      cut = cut.slice(0, -1).trimEnd();
      t.text = `${cut}…`;
    }
    return t;
  }

  /** The phone's page. */
  private tellCompact(kind: "lore" | "target" | "tale", skill?: MenuSkill, hint?: string): void {
    const w = this.rect.w;
    if (kind === "tale") {
      // The fight as it plays: as many of the latest lines as the page holds, the newest last and darkest.
      const room = this.rect.h - 4;
      const lines = this.tale.length ? this.tale : [this.mode.kind === "wait" && this.mode.text ? this.mode.text : "The page turns…"];
      const shown: Text[] = [];
      let used = 0;
      for (let i = lines.length - 1; i >= 0; i -= 1) {
        const newest = i === lines.length - 1;
        const t = this.line(lines[i]!, 2, 0, newest ? 17 : 15, newest ? INK : 0x5a3a20, { italic: !newest, maxW: w - 4 });
        if (used + t.height > room && shown.length) {
          t.destroy();
          break;
        }
        used += t.height + 3;
        shown.unshift(t);
      }
      let y = 2;
      for (const t of shown) {
        t.y = y;
        y += t.height + 3;
      }
      return;
    }
    if (kind === "lore" && skill) {
      // Under a finger or the arrow keys: what it is, or why not.
      const text = skill.usable ? `${skill.name}: ${skill.flavor || skill.cost}` : `${skill.name}: ${skill.reason ?? "Not now"}.`;
      this.oneLine(text, 2, 3, w - 4, 15, skill.usable ? INK : 0x8b1a1a, { italic: true });
      return;
    }
    if (kind === "target" && skill) {
      // The chosen skill's lore takes the room the ribbons leave.
      const known = this.offered.find((o) => o.name === skill.name);
      const head = this.oneLine(skill.name, 2, 1, w - 4, 18, 0x7a1c1c);
      if (known?.cost) {
        const cost = this.line(known.cost, 0, 5, 13, 0x7a4c1c, { font: GARAMOND, weight: "600" });
        cost.x = Math.max(head.x + head.width + 10, w - cost.width - 4);
      }
      const body = [known?.flavor, hint].filter(Boolean).join(" ");
      const t = this.line(body, 2, 26, 15, INK, { italic: true, maxW: w - 4 });
      const room = this.compactRibTop() - 28;
      if (t.height > room) t.text = hint ?? "";
      return;
    }
    this.oneLine(this.mode.kind === "skills" ? `What will ${this.mode.actor} do?` : "", 2, 2, w - 4, 17, 0x5a2a10, { italic: true });
  }

  /** Where the ribbons start in the target step: at the foot of the page, with the lore above them. */
  private compactRibTop(rows = 2): number {
    return this.rect.h - rows * RIB_H - (rows - 1) * RIB_GAP;
  }

  /** A flat ribbon: drawn at once, a full tap target, its text at a size that can be read. */
  private flat(x: number, y: number, w: number, h: number, label: string, sub: string, pat: string, icon: string, enabled: boolean, take: () => void, lore: () => void, reason = false): void {
    const c = new Container();
    c.position.set(x, y);
    const md = Math.min(h - 6, 40);
    const x0 = md * 0.5;
    const g = new Graphics();
    const body = [x0, 1, w - 1, 1, w - 13, h / 2, w - 1, h - 1, x0, h - 1];
    g.poly(body).fill({ color: CLOTH[pat] ?? CLOTH["sb-pat-do"]! }).stroke({ width: 1.5, color: enabled ? 0xe0b36a : 0x9a8468 });
    g.rect(x0 + 1, 2, w - x0 - 6, (h - 4) * 0.42).fill({ color: 0xffffff, alpha: 0.06 });
    // The medallion's brass, there before its picture is.
    g.circle(md / 2 + 1, h / 2, md / 2).fill({ color: enabled ? 0xc99a52 : 0x8a7a64 }).stroke({ width: 1, color: 0x3a1a08 });
    g.circle(md / 2 + 1, h / 2, md / 2 - 4).fill({ color: 0x241006 });
    const med = new ArtSprite(`med-${icon}`, () => medal(icon)).draw(md + 4, md + 4);
    med.position.set(-1, (h - md - 4) / 2);
    if (!enabled) med.alpha = 0.6;
    const left = md + 7;
    // Clear of the swallowtail's notch.
    const room = w - left - 18;
    /** Down to `min` of its size, then it loses its end: the text never gets too small to read. */
    const fit = (t: Text, min: number): void => {
      if (t.width <= room) return;
      t.scale.set(Math.max(min, room / t.width));
      let cut = t.text;
      while (t.width > room && cut.length > 3) {
        cut = cut.slice(0, -1).trimEnd();
        t.text = `${cut}…`;
      }
    };
    // Alone on its ribbon a long name (a target's) takes two lines; over a cost it keeps to one.
    const name = new Text({ text: label, style: st({ fontFamily: GARAMOND, fontWeight: "600", fontSize: 16, lineHeight: 17, fill: enabled ? 0xfff4dc : 0xe8dcc6, wordWrap: !sub, wordWrapWidth: room }) });
    if (sub) fit(name, 14 / 16);
    // The highlight for a keyboard, or a finger on a locked skill.
    const ptr = new Graphics().poly(body).stroke({ width: 2.5, color: 0xffd27a });
    ptr.visible = false;
    ptr.label = "ptr";
    c.addChild(g, ptr, med, name);
    if (sub) {
      const t = new Text({ text: sub, style: st({ fontFamily: GARAMOND, fontWeight: "600", fontStyle: reason ? "italic" : "normal", fontSize: 13, fill: reason ? 0xffd9b8 : 0xf3d791 }) });
      fit(t, 12 / 13);
      name.position.set(left, h / 2 - name.height + 2);
      t.position.set(left, h / 2 + 1);
      c.addChild(t);
    } else name.position.set(left, (h - name.height) / 2);
    c.eventMode = "static";
    c.cursor = enabled ? "pointer" : "default";
    c.hitArea = { contains: (px: number, py: number) => px >= 0 && py >= -2 && px <= w && py <= h + 2 };
    const rib: Rib = { c, art: med, base: x, enabled, take, lore, x };
    const idx = this.ribs.length;
    c.on("pointerover", () => this.focus(idx));
    c.on("pointertap", (e) => {
      e.stopPropagation();
      if (enabled) take();
      else this.focus(idx);
    });
    this.ribs.push(rib);
    this.content.addChild(c);
  }

  /** Lay `n` ribbons out in two columns at the foot of a box; returns each one's rectangle. */
  private grid(n: number, r: Rect, fromTop: boolean): Rect[] {
    const rows = Math.ceil(n / 2);
    const gap = RIB_GAP;
    const rh = Math.round(Math.max(44, Math.min(50, (r.h - gap * (rows - 1)) / Math.max(1, rows))));
    const cw = (r.w - gap) / 2;
    const y0 = fromTop ? r.y : r.y + r.h - rows * rh - (rows - 1) * gap;
    return Array.from({ length: n }, (_, i) => ({ x: r.x + (i % 2) * (cw + gap), y: y0 + Math.floor(i / 2) * (rh + gap), w: cw, h: rh }));
  }

  private rubric(text: string, x: number, y: number, w: number): number {
    const k = this.k;
    const size = Math.round(Math.max(18, 28 * k));
    const g = new Graphics();
    const t = new Text({ text, style: st({ fontFamily: FELL, fontStyle: "italic", fontSize: size, fill: 0xfbe8bf, dropShadow: { color: 0x000000, alpha: 1, blur: 8, distance: 0, angle: 0 } }) });
    if (t.width > w * 0.84) t.scale.set((w * 0.84) / t.width);
    const cx = x + w / 2 + 12 * k;
    t.anchor.set(0.5, 0);
    t.position.set(cx, y);
    // A soft dark pool behind it, and gilt rules either side ending in a lozenge.
    g.ellipse(cx, y + t.height / 2, t.width * 0.62, t.height * 0.8).fill({ color: 0x0c0603, alpha: 0.5 });
    const half = t.width / 2 + 10 * k;
    for (const sgn of [-1, 1]) {
      const x0 = cx + sgn * half;
      const x1 = cx + sgn * (half + Math.min(70 * k, (w / 2 - half)));
      const yy = y + t.height * 0.56;
      g.moveTo(x0, yy).lineTo(x1, yy).stroke({ width: 1.4, color: 0xe0b36a, alpha: 0.85 });
      g.poly([x1, yy - 3.5 * k, x1 + sgn * 5 * k, yy, x1, yy + 3.5 * k, x1 - sgn * 5 * k, yy]).fill({ color: 0x9c3b26 }).stroke({ width: 1, color: 0xe0b36a });
    }
    this.content.addChild(g, t);
    return t.height + 8 * k;
  }

  private ribbon(i: number, x: number, y: number, w: number, h: number, label: string, sub: string, pat: string, icon: string, enabled: boolean, take: () => void, lore: () => void, reason = false): void {
    const k = this.k;
    const c = new Container();
    c.position.set(x, y);
    const md = Math.round(h * (GEO.portrait ? 0.98 : 1.14));
    const art = new ArtSprite(`rib-${pat}`, () => ribbonArt(pat)).draw(w - md * 0.45, h);
    art.position.set(md * 0.45, 0);
    const shade = new Graphics();
    const med = new ArtSprite(`med-${icon}`, () => medal(icon)).draw(md, md);
    med.position.set(-4, (h - md) / 2);
    const lsz = Math.round(Math.max(14, Math.min(h * 0.4, 21 * k)));
    const name = new Text({ text: label, style: st({ fontFamily: GARAMOND, fontWeight: "600", fontSize: lsz, fill: enabled ? 0xfdf0d5 : 0xd8cbb4, dropShadow: { color: 0x000000, alpha: 0.85, blur: 1, distance: 2, angle: Math.PI / 2 } }) });
    const numW = i >= 0 ? Math.round(34 * k) : 0;
    const room = w - md - 8 - numW - (i >= 0 ? 26 : 16) * k;
    if (name.width > room) name.scale.set(room / name.width);
    const twoLine = !!sub && h >= 40;
    name.position.set(md + 4, twoLine ? h / 2 - name.height * 0.92 : (h - name.height) / 2);
    c.addChild(art, shade, med, name);
    if (sub) {
      const s = new Text({ text: reason ? sub : sub.toUpperCase(), style: reason ? st({ fontFamily: GARAMOND, fontStyle: "italic", fontSize: Math.round(lsz * 0.68), fill: 0xf1c9a8 }) : st({ fontFamily: CINZEL, fontWeight: "700", fontSize: Math.round(Math.max(9, lsz * 0.52)), fill: 0xe8c372, letterSpacing: 1.2 }) });
      if (s.width > room) s.scale.set(room / s.width);
      s.position.set(md + 5, twoLine ? h / 2 + 1 : (h - s.height) / 2);
      if (!twoLine) s.visible = false;
      c.addChild(s);
    }
    if (i >= 0) {
      const n = new Text({ text: ROMAN[i] ?? `${i + 1}`, style: st({ fontFamily: CINZEL, fontWeight: "800", fontSize: Math.round(Math.max(10, 12 * k)), fill: 0xe0b36a }) });
      n.alpha = 0.8;
      const nx = w - 26 * k - numW;
      n.position.set(nx + 8 * k, (h - n.height) / 2);
      const dots = new Graphics();
      for (let d = h * 0.3; d < h * 0.7; d += 3) dots.circle(nx, d, 0.7).fill({ color: 0xe0b36a, alpha: 0.6 });
      c.addChild(dots, n);
    }
    // The pointer that shows on hover/focus.
    const ptr = new Graphics().poly([0, 0, 16 * k, 8 * k, 0, 16 * k, 4 * k, 8 * k]).fill({ color: 0xffd27a }).stroke({ width: 1, color: 0x3a1a08 });
    ptr.position.set(-26 * k, h / 2 - 8 * k);
    ptr.visible = false;
    ptr.label = "ptr";
    c.addChild(ptr);
    c.alpha = enabled ? 1 : 0.78;
    c.eventMode = "static";
    c.cursor = enabled ? "pointer" : "default";
    c.hitArea = { contains: (px: number, py: number) => px >= -6 && py >= 0 && px <= w && py <= h };
    const rib: Rib = { c, art, base: x, enabled, take, lore, x };
    const idx = this.ribs.length;
    c.on("pointerover", () => this.focus(idx));
    c.on("pointertap", (e) => { e.stopPropagation(); if (enabled) take(); });
    this.ribs.push(rib);
    this.content.addChild(c);
  }

  /** Highlight ribbon i (hover or keyboard) and tell its lore. */
  focus(i: number): void {
    if (i < 0 || i >= this.ribs.length) return;
    this.focusI = i;
    this.ribs.forEach((r, j) => {
      const on = j === i;
      (r.c.getChildByLabel("ptr") as Graphics | null)!.visible = on;
      r.art.tint = on ? 0xfff2dc : 0xffffff;
    });
    this.ribs[i]!.lore();
  }

  /* ---------------- keyboard (from ./decor.ts) ---------------- */

  /** Move the highlight; returns false when the menu has nothing to move through. */
  move(d: number): boolean {
    if (!this.ribs.length) return false;
    const n = this.ribs.length;
    this.focus(((this.focusI < 0 ? (d > 0 ? -1 : 0) : this.focusI) + d + n) % n);
    return true;
  }
  /** Take the highlighted ribbon (or the n-th, 1-based). */
  take(n?: number): boolean {
    const i = n !== undefined ? n - 1 : this.focusI;
    const r = this.ribs[i];
    if (!r?.enabled) return false;
    r.take();
    return true;
  }
  get kind(): "skills" | "target" | "wait" {
    return this.mode.kind;
  }

  protected override render(): void {
    for (const c of this.content.removeChildren()) c.destroy({ children: true });
    this.ribs = [];
    this.focusI = -1;
    const k = this.k;
    const m = this.mode;
    const r = GEO.rib;
    const phone = GEO.compact;
    this.nibArt.visible = false;
    if (m.kind === "wait") {
      this.setPlate(this.taleWho);
      this.tell("tale");
      if (!phone) {
        const ns = Math.round(30 * k);
        this.nibArt.draw(ns, ns);
        this.nibArt.position.set(GEO.text.x + GEO.text.w - ns, GEO.text.y + GEO.text.h - ns * 0.9);
        this.nibArt.visible = true;
      }
      return;
    }
    if (m.kind === "target") {
      this.setPlate(m.skill);
      const skill: MenuSkill = { id: "", name: m.skill, cost: "", usable: true, signature: false };
      const back = () => this.onBack();
      const conf = () => this.onConfirm();
      if (phone) {
        // Every target as a ribbon too (a foe in the picture still takes a tap), and the way back.
        const targets = m.confirm ? [] : this.targetsOf();
        const n = (m.confirm ? 1 : targets.length) + 1;
        const cells = this.grid(n, { x: 0, y: 0, w: r.w, h: this.rect.h }, false);
        let i = 0;
        const cell = () => cells[i++]!;
        if (m.confirm) {
          const b = cell();
          this.flat(b.x, b.y, b.w, b.h, "Confirm", "", "sb-pat-deal", "check", true, conf, () => {});
        }
        for (const t of targets) {
          const b = cell();
          this.flat(b.x, b.y, b.w, b.h, t.name, "", "sb-pat-fight", "sword", true, () => this.tapTarget(t.id), () => {});
        }
        const b = cell();
        this.flat(b.x, b.y, b.w, b.h, "Choose again", "", "sb-pat-iron", "back", true, back, () => {});
      } else {
        const rh = Math.round(Math.max(38, Math.min(54, 52 * k)));
        let y = r.y;
        y += this.rubric("Upon whom?", r.x, y, r.w);
        if (m.confirm) {
          this.ribbon(0, r.x + 24 * k, y, r.w - 24 * k, rh, "Confirm", "", "sb-pat-fight", "check", true, conf, () => {});
          y += rh + 8 * k;
        }
        this.ribbon(m.confirm ? 1 : 0, r.x + 24 * k, y, r.w - 24 * k, rh, "Choose again", "", "sb-pat-iron", "back", true, back, () => {});
      }
      this.tell("target", skill, m.hint);
      return;
    }
    // Skills.
    this.setPlate(m.actor);
    const skills = m.skills;
    if (phone) {
      this.offered = skills;
      const cells = this.grid(skills.length, r, true);
      skills.forEach((s, i) => {
        const b = cells[i]!;
        this.flat(b.x, b.y, b.w, b.h, s.name, s.usable ? s.cost : s.reason ?? "", s.signature ? "sb-pat-fight" : s.usable ? "sb-pat-do" : "sb-pat-iron", iconOf(s), s.usable, () => this.onPick(s.id), () => this.tell("lore", s), !s.usable);
      });
      this.tell("lore");
      return;
    }
    let y = r.y;
    y += this.rubric(`What will ${m.actor} do?`, r.x, y, r.w);
    const gap = Math.round(8 * k);
    const avail = r.y + r.h - y;
    const rh = Math.round(Math.max(36, Math.min(58 * k + 4, (avail - gap * (skills.length - 1)) / Math.max(1, skills.length))));
    // Stacked from the bottom of the column up, like the scene's choices sitting over the page.
    const total = skills.length * rh + (skills.length - 1) * gap;
    y = Math.max(y, r.y + r.h - total);
    skills.forEach((s, i) => {
      this.ribbon(i, r.x + 24 * k, y + i * (rh + gap), r.w - 24 * k, rh, s.name, s.usable ? s.cost : s.reason ?? "", s.signature ? "sb-pat-fight" : s.usable ? "sb-pat-do" : "sb-pat-iron", iconOf(s), s.usable, () => this.onPick(s.id), () => this.tell("lore", s), !s.usable);
    });
    const first = skills.findIndex((s) => s.usable);
    this.tell("lore", skills[Math.max(0, first)]);
  }

  /** Hover drift and the sheen on the highlighted ribbon (called from ./decor.ts each frame). */
  tick(now: number, dt: number): void {
    this.t = now;
    const a = 1 - Math.exp(-dt / 0.08);
    this.ribs.forEach((r, j) => {
      const want = r.x - (j === this.focusI && r.enabled && !GEO.compact ? 12 * this.k : 0);
      r.c.x += (want - r.c.x) * a;
    });
    if (this.nibArt.visible) this.nibArt.y = GEO.text.y + GEO.text.h - this.nibArt.height * 0.9 + Math.sin(now * 5) * 2;
  }
}
