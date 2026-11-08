/**
 * Your skills as a hand of woodcut cards, fanned along the bottom edge and
 * cropped by it, and your own hand on the right holding the card you are
 * reading (its cost, its flavour, why it can't be played). Pointing at a card
 * lifts it out of the fan and puts it in your hand; clicking plays it. A
 * played card leaves the fan and sits in your hand with what to do next
 * ("tap an enemy"), a "take it back" tab and, for cards that need no target,
 * a red wax seal to press. While the other side moves the fan sinks.
 *
 * On a phone there's no room for a hand: the read card becomes a parchment
 * slip over the fan.
 */
import { Container, Graphics, Sprite, Text, TextStyle } from "pixi.js";
import { ActionMenu, type MenuSkill } from "../../battle/action-menu.js";
import type { Rect } from "../../battle/layout.js";
import { factCard } from "../../../scene/themes/table/art.js";
import { CINZEL, FELL } from "../shared.js";
import { seedOf } from "../../../scene/themes/contract.js";
import { duelCamera, project } from "../../../scene/themes/table/duel.js";
import { BLOOD, CARD_H, CARD_W, PAPER_INK, backTexture, handTextures, motifOf, onCardArt, skillTexture, stripPaper, svgTexture } from "./cards.js";
import type { DuelLayout } from "./layout.js";

const ink = (size: number, o: Partial<ConstructorParameters<typeof TextStyle>[0] & object> = {}) =>
  new TextStyle({ fontFamily: CINZEL, fontWeight: "800", fontSize: size, fill: PAPER_INK, letterSpacing: 1, ...o });
const prose = (size: number, width: number, o: Partial<ConstructorParameters<typeof TextStyle>[0] & object> = {}) =>
  new TextStyle({ fontFamily: FELL, fontSize: size, fill: 0x1c120a, wordWrap: true, wordWrapWidth: width, lineHeight: size * 1.18, ...o });

type FanCard = { c: Container; face: Sprite; skill: MenuSkill; i: number; lift: number; want: number };

export class TableHand extends ActionMenu {
  /** The layout of the fight (set by the theme each resize). */
  duel: DuelLayout | null = null;
  reduced = false;
  protected fan = new Container();
  protected held = new Container();
  protected handBack = new Sprite();
  protected handFront = new Sprite();
  protected cards: FanCard[] = [];
  /** The card you are reading (pointed at or focused); null shows whose turn it is. */
  protected reading: MenuSkill | null = null;
  /** How far the fan has sunk (0 up .. 1 down). */
  protected sink = 1;
  /** Keyboard focus in the fan (-1: none). */
  focusIndex = -1;
  /** The card you just played (choosing its target): the theme lays it on the mat. */
  onPlayed: (skill: MenuSkill | null) => void = () => {};
  private lastSkills: MenuSkill[] = [];
  /** The played card lies on the mat (staged, wide): its controls go there. */
  mat = false;
  private lowered = false;
  private offArt: () => void;

  constructor() {
    super();
    this.removeChild(this.bg);
    this.fan.sortableChildren = true;
    const hands = handTextures();
    this.handBack.texture = hands.back;
    this.handFront.texture = hands.front;
    this.content.addChild(this.fan);
    this.addChild(this.handBack, this.held, this.handFront);
    this.offArt = onCardArt(() => {
      for (const c of this.cards) c.face.texture.source.update();
      this.handBack.texture.source.update();
      this.handFront.texture.source.update();
    });
  }

  override place(rect: Rect, ui: number): void {
    this.rect = rect;
    this.ui = ui;
    this.position.set(0, 0);
    this.render();
  }

  /** The skills on offer now, or null outside the skills mode. */
  get skills(): MenuSkill[] | null {
    return this.mode.kind === "skills" ? this.mode.skills : null;
  }

  override showSkills(actor: string, skills: MenuSkill[]): void {
    this.lastSkills = skills;
    this.onPlayed(null);
    super.showSkills(actor, skills);
  }

  override showTarget(skill: string, hint: string, confirm: boolean): void {
    this.onPlayed(this.lastSkills.find((s) => s.name === skill) ?? null);
    super.showTarget(skill, hint, confirm);
  }

  get modeKind(): string {
    return this.mode.kind;
  }

  /** Choosing a target for a card that can also be played as it is (area, self). */
  get confirmable(): boolean {
    return this.mode.kind === "target" && this.mode.confirm;
  }

  protected override render(): void {
    for (const c of this.fan.removeChildren()) c.destroy({ children: true });
    this.cards = [];
    const d = this.duel;
    const r = this.rect;
    if (!d || r.w < 10) return;
    const m = this.mode;
    if (m.kind === "skills") {
      if (this.reading && !m.skills.some((s) => s.id === this.reading!.id)) this.reading = null;
      this.deal(m.skills, true, false);
    } else {
      this.reading = null;
      // The rest of the hand stays in your fingers, sunk: face up while you aim the card you played, face down while they move.
      if (m.kind === "target") this.deal(this.lastSkills.filter((s) => s.name !== m.skill), false, false);
      else this.deal(this.lastSkills, false, true);
    }
    this.readCard();
  }

  /** Lay the skills out as a held fan. */
  private deal(skills: MenuSkill[], live: boolean, down: boolean): void {
    const d = this.duel!;
    const r = this.rect;
    const n = skills.length;
    if (!n) return;
    const port = d.portrait;
    const ch = port ? Math.min(r.h * 0.98, r.w * 0.235 * (CARD_H / CARD_W)) : Math.min(r.h * 0.92, d.h * 0.3);
    const cw = ch * (CARD_W / CARD_H);
    const R0 = ch * (port ? 2.2 : 2.6);
    const rMid = R0 + ch * 0.5;
    const room = r.w - cw * (port ? 1.3 : 0.9);
    const maxStep = (cw * (port ? 0.95 : 0.9)) / rMid;
    const step = n > 1 ? Math.min(maxStep, Math.asin(Math.min(0.95, room / 2 / rMid)) / ((n - 1) / 2)) : 0;
    const cx = r.x + r.w / 2;
    const baseY = d.h - ch * (port ? 0.0 : 0.02);
    skills.forEach((s, i) => {
      const c = new Container();
      c.pivot.set(cw / 2, ch + R0);
      c.position.set(cx, baseY + R0);
      c.rotation = (i - (n - 1) / 2) * step;
      c.zIndex = i;
      const face = new Sprite(down ? backTexture(3) : skillTexture(motifOf(s.name), seedOf(s.name) % 97));
      face.width = cw;
      face.height = ch;
      c.addChild(face);
      // The title band: the skill's name, inked.
      // Set from the top-left corner, like a real card, so it still reads with the next card over its right side.
      const title = new Text({ text: s.name.toUpperCase(), style: ink(Math.round(cw * 0.1), { wordWrap: true, wordWrapWidth: cw * 0.64, lineHeight: cw * 0.105 }) });
      title.anchor.set(0, 0.5);
      title.position.set(badge0(s.cost) ? cw * 0.27 : cw * 0.1, ch * 0.135);
      if (title.height > ch * 0.17) title.scale.set((ch * 0.17) / title.height);
      const key = new Text({ text: String(i + 1), style: ink(Math.round(cw * 0.075), { fill: 0x7a0c10 }) });
      key.anchor.set(0, 1);
      key.position.set(cw * 0.07, ch * 0.975);
      c.addChild(key);
      c.addChild(title);
      // The cost as a badge in the corner: a steel-blue coin for Focus, a red diamond for the class resource.
      const badge = costBadge(s.cost, cw * 0.1);
      if (badge) {
        // On a phone the next card covers the right edge: the badge sits on the left there.
        badge.position.set(cw * 0.14, ch * 0.085);
        c.addChild(badge);
      }
      // The cost on a torn tag pinned over the woodcut's foot.
      const tag = new Graphics();
      const label = new Text({ text: s.cost.toUpperCase(), style: ink(Math.round(cw * 0.07), { fill: PAPER_INK }) });
      label.anchor.set(0.5, 0.5);
      const tw = Math.min(cw * 0.86, label.width + cw * 0.14);
      const th = label.height + cw * 0.05;
      const ty = ch * 0.84;
      tag.poly([cw / 2 - tw / 2, ty - th / 2 + 2, cw / 2 + tw / 2 - 3, ty - th / 2, cw / 2 + tw / 2, ty + th / 2 - 2, cw / 2 - tw / 2 + 2, ty + th / 2]).fill({ color: 0xe8dcc4 }).stroke({ width: 2, color: PAPER_INK });
      label.position.set(cw / 2, ty + 1);
      fitText(label, tw - 8);
      if (s.usable) c.addChild(tag, label);
      if (s.signature) {
        // A signature skill wears a red seal on its corner.
        const seal = new Graphics().circle(cw * 0.86, ch * 0.93, cw * 0.075).fill({ color: BLOOD }).stroke({ width: 2.5, color: PAPER_INK });
        seal.poly(star(cw * 0.86, ch * 0.93, cw * 0.045, cw * 0.02, 5)).fill({ color: 0xf2cf7a });
        c.addChild(seal);
      }
      if (!s.usable) {
        face.tint = title.tint = 0x8a7f78;
        c.addChild(chained(cw, ch, s.reason ?? "Not now"));
      }
      if (down) for (const ch of c.children) ch.visible = ch === face;
      if (!live) {
        c.eventMode = "none";
        this.fan.addChild(c);
        this.cards.push({ c, face, skill: s, i, lift: 0, want: 0 });
        return;
      }
      c.eventMode = "static";
      c.cursor = s.usable ? "pointer" : "not-allowed";
      const fc: FanCard = { c, face, skill: s, i, lift: 0, want: 0 };
      c.hitArea = { contains: (x: number, y: number) => x >= 0 && x <= cw && y >= -fc.lift * ch * 0.4 && y <= ch + R0 * 0.02 };
      c.on("pointerover", () => this.point(i));
      c.on("pointerout", () => this.point(-1));
      c.on("pointertap", () => {
        if (s.usable) this.onPick(s.id);
        else this.point(i);
      });
      this.fan.addChild(c);
      this.cards.push(fc);
    });
  }

  /** Point at a card (mouse or keyboard): it lifts, and your hand reads it. */
  point(i: number): void {
    for (const c of this.cards) c.want = c.i === i ? 1 : 0;
    const s = this.cards[i]?.skill ?? null;
    if (s === this.reading) return;
    this.reading = s;
    this.readCard();
  }

  /** Your hand at the right, wide screens only. */
  private layHand(): void {
    const d = this.duel!;
    const hold = d.hold;
    this.handBack.visible = this.handFront.visible = !!hold && !this.lowered;
    if (!hold) return;
    for (const s of [this.handBack, this.handFront]) {
      s.position.set(hold.x, hold.y);
      s.width = hold.w;
      s.height = hold.h;
    }
  }

  /** The card in your hand (wide) or the slip over the fan (phone): what you're reading, or what to do now. */
  protected readCard(): void {
    for (const c of this.held.removeChildren()) c.destroy({ children: true });
    const d = this.duel;
    if (!d) return;
    const m = this.mode;
    const ui = this.ui;
    let title = "";
    let line = "";
    let body = "";
    let warn = "";
    const buttons: { label: string; seal: boolean; run: () => void }[] = [];
    if (m.kind === "skills") {
      const s = this.reading;
      if (s) {
        title = s.name;
        line = s.usable ? s.cost : "";
        body = s.flavor ?? "";
        warn = s.usable ? "" : (s.reason ?? "Not now.");
      } else {
        title = `${m.actor}'s turn`;
        body = "Play a card from your hand.";
      }
    } else if (m.kind === "target") {
      title = m.skill;
      line = m.confirm ? "Press the seal to play it" : "Your move";
      body = m.hint;
      buttons.push({ label: "Take it back", seal: false, run: () => this.onBack() });
      if (m.confirm) buttons.push({ label: "Play", seal: true, run: () => this.onConfirm() });
    } else {
      title = m.text;
    }
    // Nothing to read (your turn, no card pointed at; their move): the hand stays down out of the room.
    const idle = (m.kind === "skills" && !this.reading) || (m.kind === "wait" && !m.text);
    this.lowered = !!d.hold && (idle || (m.kind === "target" && this.mat));
    if (idle) {
      this.layHand();
      return;
    }
    if (this.lowered) this.matControls(m.kind === "target" ? m : null);
    else if (d.hold && m.kind === "skills" && this.reading) this.heldSkill(d.hold, this.reading);
    else if (d.hold) this.heldCard(d.hold, title, line, body, warn, buttons);
    else if (m.kind !== "skills" || this.reading) this.slip(title, line, body, warn, buttons, ui);
    this.layHand();
  }

  /** The skill you're reading, as the very card from the fan, held up; its flavour on a slip pinned beside it. */
  private heldSkill(hold: Rect, s: MenuSkill): void {
    const ch = hold.h * 0.8;
    const cw = ch * (CARD_W / CARD_H);
    const c = new Container();
    c.pivot.set(cw * 0.5, ch * 0.92);
    c.position.set(hold.x + hold.w * 0.47, hold.y + hold.h * 0.8);
    c.rotation = -0.13;
    const face = new Sprite(skillTexture(motifOf(s.name), seedOf(s.name) % 97));
    face.width = cw;
    face.height = ch;
    if (!s.usable) face.tint = 0x9a8f88;
    c.addChild(face);
    const t = new Text({ text: s.name.toUpperCase(), style: ink(Math.round(cw * 0.1), { wordWrap: true, wordWrapWidth: cw * 0.64, lineHeight: cw * 0.105 }) });
    t.anchor.set(0, 0.5);
    t.position.set(badge0(s.cost) ? cw * 0.27 : cw * 0.1, ch * 0.135);
    if (t.height > ch * 0.17) t.scale.set((ch * 0.17) / t.height);
    c.addChild(t);
    const badge = costBadge(s.cost, cw * 0.1);
    if (badge) {
      badge.position.set(cw * 0.14, ch * 0.085);
      c.addChild(badge);
    }
    if (!s.usable) c.addChild(chained(cw, ch, s.reason ?? "Not now"));
    this.held.addChild(c);
    // The slip: cost in words, the flavour, and why not.
    const text = [s.flavor ?? "", s.usable ? "" : (s.reason ?? "")].filter(Boolean);
    const sw = Math.min(hold.w * 0.72, cw * 1.25);
    const slip = new Container();
    const head = new Text({ text: s.cost.toUpperCase(), style: ink(Math.round(cw * 0.065), { fill: 0x2c5a8a }) });
    fitText(head, sw - 24);
    head.position.set(12, 8);
    slip.addChild(head);
    let y = head.y + head.height + 4;
    if (text[0] && s.flavor) {
      const f = new Text({ text: s.flavor, style: prose(Math.round(cw * 0.07), sw - 24, { fontStyle: "italic" }) });
      f.position.set(12, y);
      if (f.height > hold.h * 0.34) f.scale.set((hold.h * 0.34) / f.height);
      slip.addChild(f);
      y += f.height + 4;
    }
    if (!s.usable) {
      const wv = new Text({ text: s.reason ?? "Not now.", style: prose(Math.round(cw * 0.068), sw - 24, { fill: 0x9c1419, fontWeight: "700" }) });
      wv.position.set(12, y);
      slip.addChild(wv);
      y += wv.height + 4;
    }
    const h = y + 8;
    const g = new Graphics();
    g.poly([0, 3, sw * 0.4, 0, sw, 4, sw - 2, h - 2, sw * 0.6, h, 2, h - 3]).fill({ color: 0xebe0c8 }).stroke({ width: 2, color: PAPER_INK });
    g.circle(sw / 2, 6, 4).fill({ color: 0xb08a40 }).stroke({ width: 1, color: 0x3a2410 });
    slip.addChildAt(g, 0);
    slip.rotation = 0.03;
    slip.position.set(Math.max(this.rect.x, hold.x - sw * 0.62), hold.y - h * 0.15);
    this.held.addChild(slip);
  }

  /** Aiming a played card: its controls sit on the mat beside it, and the hand drops away. */
  private matControls(m: { skill: string; hint: string; confirm: boolean } | null): void {
    const d = this.duel!;
    if (!m) return;
    const aspect = d.w / Math.max(1, d.h);
    const cam = duelCamera("battle", aspect);
    const p = project(cam, aspect, [0.07, 0.012, -0.55]);
    const ui = Math.max(1, d.h / 900);
    const c = new Container();
    // What you are playing, legible: the card's name and cost (the one on the mat is foreshortened).
    const sk = this.lastSkills.find((x) => x.name === m.skill);
    const head = new Text({ text: `${m.skill.toUpperCase()}${sk ? `  ·  ${sk.cost.toUpperCase()}` : ""}`, style: ink(Math.round(17 * ui), { fill: 0xf2cf7a, dropShadow: { color: 0x000000, blur: 4, distance: 0, alpha: 0.9 } }) });
    c.addChild(head);
    const hint = new Text({ text: m.hint, style: prose(Math.round(19 * ui), 340 * ui, { fontStyle: "italic", fill: 0xf2e6cc, dropShadow: { color: 0x000000, blur: 4, distance: 0, alpha: 0.9 } }) });
    hint.y = head.height + 4 * ui;
    c.addChild(hint);
    let y = hint.y + hint.height + 10 * ui;
    const back = ribbon("Take it back  (Esc)", 15 * ui);
    back.position.set(0, y);
    back.eventMode = "static";
    back.cursor = "pointer";
    back.on("pointertap", (e) => {
      e.stopPropagation();
      this.onBack();
    });
    c.addChild(back);
    if (m.confirm) {
      const seal = waxSeal(30 * ui, "PLAY");
      seal.position.set(back.width + 46 * ui, y + back.height / 2);
      seal.eventMode = "static";
      seal.cursor = "pointer";
      seal.on("pointertap", (e) => {
        e.stopPropagation();
        this.onConfirm();
      });
      c.addChild(seal);
      const k = new Text({ text: "Enter", style: ink(Math.round(11 * ui), { fill: 0xf2e6cc }) });
      k.anchor.set(0.5, 0);
      k.position.set(seal.x, seal.y + 34 * ui);
      c.addChild(k);
      y += 30 * ui;
    }
    c.position.set(Math.round(p.x * d.w), Math.round(p.y * d.h - c.height * 0.5));
    this.held.addChild(c);
  }

  private heldCard(hold: Rect, title: string, line: string, body: string, warn: string, buttons: { label: string; seal: boolean; run: () => void }[]): void {
    const ch = hold.h * 0.78;
    const cw = ch * (CARD_W / CARD_H);
    const c = new Container();
    c.pivot.set(cw * 0.5, ch * 0.92);
    c.position.set(hold.x + hold.w * 0.47, hold.y + hold.h * 0.8);
    c.rotation = -0.13;
    const face = new Sprite(svgTexture("held", stripPaper(factCard(5, "")), CARD_W, CARD_H, 2.2, true));
    face.width = cw;
    face.height = ch;
    c.addChild(face);
    const pad = cw * 0.17;
    const tw = cw * 0.62;
    const t = new Text({ text: title.toUpperCase(), style: ink(Math.round(cw * 0.085), { fill: 0x7a0c10, wordWrap: true, wordWrapWidth: tw * 0.86, lineHeight: cw * 0.095 }) });
    t.position.set(pad, ch * 0.07);
    c.addChild(t);
    let y = t.y + t.height + ch * 0.02;
    if (line) {
      const l = new Text({ text: line.toUpperCase(), style: ink(Math.round(cw * 0.05), { fill: 0x4a3420 }) });
      l.position.set(pad, y);
      fitText(l, cw * 0.74);
      c.addChild(l);
      y += l.height + ch * 0.03;
    }
    y = Math.max(y, ch * 0.27);
    if (body) {
      const b = new Text({ text: body, style: prose(Math.round(cw * 0.066), cw * 0.72, { fontStyle: "italic" }) });
      b.position.set(pad, y);
      const room = ch * (buttons.length ? 0.5 : 0.62) - (y - ch * 0.27);
      if (b.height > room) b.scale.set(Math.max(0.6, room / b.height));
      c.addChild(b);
      y += b.height + ch * 0.03;
    }
    if (warn) {
      const wv = new Text({ text: warn, style: prose(Math.round(cw * 0.064), cw * 0.72, { fill: 0x9c1419, fontWeight: "700" }) });
      wv.position.set(pad, Math.min(y, ch * 0.78));
      c.addChild(wv);
    }
    let bx = pad;
    for (const b of buttons) {
      const btn = b.seal ? waxSeal(cw * 0.15, "PLAY") : paperTab(b.label, cw * 0.055);
      btn.position.set(b.seal ? cw * 0.72 : bx, b.seal ? ch * 0.64 : ch * 0.6);
      if (!b.seal) bx += btn.width + cw * 0.04;
      btn.eventMode = "static";
      btn.cursor = "pointer";
      btn.on("pointertap", (e) => {
        e.stopPropagation();
        b.run();
      });
      c.addChild(btn);
    }
    this.held.addChild(c);
  }

  private slip(title: string, line: string, body: string, warn: string, buttons: { label: string; seal: boolean; run: () => void }[], ui: number): void {
    const r = this.rect;
    const w = r.w - 16 * ui;
    const c = new Container();
    const t = new Text({ text: title.toUpperCase(), style: ink(Math.round(14 * ui), { fill: 0x7a0c10 }) });
    fitText(t, w - 24 * ui);
    t.position.set(12 * ui, 8 * ui);
    const sub = [line, body, warn].filter(Boolean).join(" · ");
    const b = new Text({ text: sub, style: prose(Math.round(12.5 * ui), w - 24 * ui, { fontStyle: "italic" }) });
    b.position.set(12 * ui, t.y + t.height + 2 * ui);
    let h = b.y + b.height + 8 * ui;
    const row = new Container();
    let bx = 0;
    for (const bt of buttons) {
      const btn = bt.seal ? waxSeal(17 * ui, "PLAY") : paperTab(bt.label, 12 * ui);
      btn.position.set(bt.seal ? bx + 17 * ui : bx, bt.seal ? 17 * ui : 2 * ui);
      bx += (bt.seal ? 34 * ui : btn.width) + 12 * ui;
      btn.eventMode = "static";
      btn.cursor = "pointer";
      btn.on("pointertap", (e) => {
        e.stopPropagation();
        bt.run();
      });
      row.addChild(btn);
    }
    if (buttons.length) {
      row.position.set(12 * ui, h);
      h += 40 * ui;
    }
    const g = new Graphics();
    g.poly([0, 3, w * 0.4, 0, w, 4, w - 2, h - 2, w * 0.6, h, 2, h - 3]).fill({ color: 0xe8dcc4 }).stroke({ width: 2.5, color: PAPER_INK });
    g.poly([0, 3, w * 0.4, 0, w, 4, w - 2, h - 2, w * 0.6, h, 2, h - 3]).fill({ color: 0x8a6a3a, alpha: 0.08 });
    c.addChild(g, t, b, row);
    c.position.set(r.x + 8 * ui, r.y + 4 * ui);
    this.held.addChild(c);
  }

  /** Each frame: lift the pointed card, sink the fan while it isn't your move. */
  tick(dt: number): void {
    const k = this.reduced ? 1 : 1 - Math.exp(-dt / 0.09);
    const down = this.mode.kind === "skills" ? 0 : 1;
    this.sink += (down - this.sink) * (this.reduced ? 1 : 1 - Math.exp(-dt / 0.2));
    const d = this.duel;
    const ch = this.cards[0]?.face.height ?? 0;
    for (const c of this.cards) {
      const want = Math.max(c.want, this.focusIndex === c.i ? 1 : 0);
      c.lift += (want - c.lift) * k;
      const base = ch * ((d?.portrait ? 2.2 : 2.6) + 1);
      c.c.pivot.y = base + c.lift * ch * (d?.portrait ? 0.22 : 0.2) - this.sink * ch * 0.12;
      c.c.alpha = 1 - this.sink * 0.3;
      const s = 1 + c.lift * (d?.portrait ? 0.04 : 0.05);
      c.c.scale.set(s);
      c.c.zIndex = c.lift > 0.5 ? 100 : c.i;
    }
  }

  override destroy(options?: Parameters<ActionMenu["destroy"]>[0]): void {
    this.offArt();
    super.destroy(options);
  }
}

function fitText(t: Text, maxW: number): void {
  t.scale.set(1);
  if (maxW > 0 && t.width > maxW) t.scale.set(maxW / t.width);
}

function star(cx: number, cy: number, R: number, r: number, n: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r : R;
    pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  return pts;
}

/** A red wax seal to press: the "play it" control. */
function waxSeal(R: number, word: string): Container {
  const c = new Container();
  const g = new Graphics();
  const pts: number[] = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const rr = R * (1 + (i % 2 ? 0.06 : -0.04) + Math.sin(i * 2.7) * 0.04);
    pts.push(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.poly(pts).fill({ color: 0x9c1419 }).stroke({ width: 3, color: 0x2a0406 });
  g.circle(0, 0, R * 0.72).stroke({ width: 2, color: 0x5a0a0d });
  g.circle(-R * 0.3, -R * 0.35, R * 0.2).fill({ color: 0xff9a8a, alpha: 0.35 });
  const t = new Text({ text: word, style: ink(Math.round(R * 0.5), { fill: 0xffe6c8 }) });
  t.anchor.set(0.5);
  c.addChild(g, t);
  c.hitArea = { contains: (x: number, y: number) => x * x + y * y <= R * R * 1.3 };
  return c;
}

/** A torn paper tab with a word in ink: the "take it back" control. */
function paperTab(label: string, size: number): Container {
  const c = new Container();
  const t = new Text({ text: label.toUpperCase(), style: ink(Math.round(size)) });
  const w = t.width + size * 1.6;
  const h = t.height + size * 0.9;
  const g = new Graphics();
  g.poly([0, 2, w * 0.5, 0, w, 3, w - 3, h, w * 0.4, h - 2, 2, h]).fill({ color: 0xd9c49a }).stroke({ width: 2, color: PAPER_INK });
  g.moveTo(size * 0.5, h / 2).lineTo(size * 0.2, h / 2 - size * 0.25).moveTo(size * 0.5, h / 2).lineTo(size * 0.2, h / 2 + size * 0.25);
  t.position.set(size * 0.8, size * 0.45);
  c.addChild(g, t);
  c.hitArea = { contains: (x: number, y: number) => x >= 0 && y >= 0 && x <= w && y <= h };
  return c;
}

/** The cost as a corner badge: a blue coin with the Focus, or a red diamond with the resource. Null when free. */
function costBadge(cost: string, R: number): Container | null {
  const f = /(\d+)\s*Focus/i.exec(cost);
  const r = /(\d+)\s+(?!Focus)(?!%)([A-Za-z]+)/.exec(cost);
  const c = new Container();
  const g = new Graphics();
  let n = "";
  if (f) {
    g.circle(0, 0, R).fill({ color: 0x2c5a8a }).stroke({ width: 2.5, color: PAPER_INK });
    g.circle(0, 0, R * 0.78).stroke({ width: 1.2, color: 0xbfd8e8, alpha: 0.6 });
    n = f[1]!;
  } else if (r) {
    g.poly([0, -R * 1.15, R * 1.05, 0, 0, R * 1.15, -R * 1.05, 0]).fill({ color: BLOOD }).stroke({ width: 2.5, color: PAPER_INK });
    n = r[1]!;
  } else return null;
  const t = new Text({ text: n, style: ink(Math.round(R * 1.1), { fill: 0xfff4e0, letterSpacing: 0 }) });
  t.anchor.set(0.5);
  c.addChild(g, t);
  return c;
}

/** An unplayable card: chained across, a padlock on the chain, and the reason stamped in red. */
function chained(cw: number, ch: number, reason: string): Container {
  const c = new Container();
  const g = new Graphics();
  const links = 9;
  for (let i = 0; i < links; i++) {
    const t = (i + 0.5) / links;
    const x = cw * (-0.02 + t * 1.04);
    const y = ch * (0.62 - t * 0.3);
    const vert = i % 2 === 0;
    g.ellipse(x, y, vert ? cw * 0.06 : cw * 0.035, vert ? cw * 0.035 : cw * 0.06).stroke({ width: Math.max(2, cw * 0.022), color: 0x2a2826 });
    g.ellipse(x, y, vert ? cw * 0.06 : cw * 0.035, vert ? cw * 0.035 : cw * 0.06).stroke({ width: Math.max(1, cw * 0.009), color: 0x9a968c });
  }
  // The padlock.
  const lx = cw * 0.5;
  const ly = ch * 0.47;
  const lw = cw * 0.16;
  g.roundRect(lx - lw * 0.32, ly - lw * 0.95, lw * 0.64, lw * 0.8, lw * 0.32).stroke({ width: Math.max(2.5, cw * 0.028), color: 0x3a3632 });
  g.roundRect(lx - lw / 2, ly - lw * 0.45, lw, lw * 0.85, 3).fill({ color: 0x8a6a2a }).stroke({ width: 2, color: 0x2a1c0c });
  g.circle(lx, ly, lw * 0.1).fill({ color: 0x1a0d06 });
  g.rect(lx - lw * 0.035, ly, lw * 0.07, lw * 0.22).fill({ color: 0x1a0d06 });
  c.addChild(g);
  // The stamp.
  const word = reason.replace(/\.$/, "").toUpperCase();
  const t = new Text({ text: word, style: ink(Math.round(cw * 0.075), { fill: 0xb0141a, wordWrap: true, wordWrapWidth: cw * 0.8, align: "center", lineHeight: cw * 0.085 }) });
  t.anchor.set(0.5);
  if (t.height > ch * 0.16) t.scale.set((ch * 0.16) / t.height);
  const sw = Math.min(cw * 0.9, t.width + cw * 0.1);
  const sh = t.height + cw * 0.06;
  const st = new Container();
  const b = new Graphics().roundRect(-sw / 2, -sh / 2, sw, sh, 4).fill({ color: 0xf2e6d0, alpha: 0.85 }).stroke({ width: Math.max(2, cw * 0.016), color: 0xb0141a });
  st.addChild(b, t);
  st.position.set(cw / 2, ch * 0.8);
  st.rotation = -0.12;
  c.addChild(st);
  return c;
}

/** A crimson ribbon with a word in gold: the "take it back" control on the mat. */
function ribbon(label: string, size: number): Container {
  const c = new Container();
  const t = new Text({ text: label.toUpperCase(), style: ink(Math.round(size), { fill: 0xf2cf7a }) });
  const w = t.width + size * 2.2;
  const h = t.height + size * 0.9;
  const g = new Graphics();
  g.poly([0, 0, w, 0, w - size * 0.6, h / 2, w, h, 0, h, size * 0.6, h / 2]).fill({ color: 0x7a0c10 }).stroke({ width: 2, color: 0x2a0406 });
  g.rect(size * 0.7, 3, w - size * 1.4, 1).fill({ color: 0xf2cf7a, alpha: 0.5 });
  t.position.set(size * 1.1, size * 0.45);
  c.addChild(g, t);
  c.hitArea = { contains: (x: number, y: number) => x >= 0 && y >= 0 && x <= w && y <= h };
  return c;
}

function badge0(cost: string): boolean {
  return /\d+\s*Focus|\d+\s+[A-Za-z]/.test(cost);
}
