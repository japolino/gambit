/**
 * The skills as manila shipping tags hanging on twine from an oak dowel on
 * a dark oak tag board beside the cards (whose turn it is carved on a plaque
 * above): the skill's name inked big, its cost rubber-stamped in red; a
 * signature skill is a wide crimson leather tag with gold foil and a star; a
 * tag you can't use yet stays readable with what it needs stamped across it.
 * Pointing at a tag slides it out, straightens it and lights it in the
 * shop's yellow; choosing a target swaps the rack for one big tag with what
 * to do, and Back / Confirm tags.
 */
import { Container, Graphics, Text } from "pixi.js";
import { ActionMenu, type MenuSkill } from "../../battle/action-menu.js";
import type { Rect } from "../../battle/layout.js";
import { rng } from "../../../scene/themes/contract.js";
import { CINZEL, FELL, GARA, P, eyelet, fit, stamp, stock, tape, txt } from "./paper.js";

class Tag extends Container {
  private g = new Graphics();
  private glowG = new Graphics();
  private hot = 0;
  private want = 0;
  readonly baseRot: number;
  baseX = 0;
  constructor(
    readonly w: number,
    readonly h: number,
    private ui: number,
    private enabled: boolean,
    private kind: "manila" | "kraft" | "card" | "leather",
    seed: number,
    onTap: () => void,
  ) {
    super();
    const r = rng(seed);
    this.baseRot = (r() - 0.5) * 0.06;
    this.rotation = this.baseRot;
    this.addChild(this.glowG, this.g);
    this.eventMode = "static";
    this.cursor = enabled ? "pointer" : "default";
    this.on("pointerover", () => (this.want = enabled ? 1 : 0));
    this.on("pointerout", () => (this.want = this.held ? 1 : 0));
    this.on("pointertap", (e) => {
      e.stopPropagation();
      if (this.enabled) onTap();
    });
    this.hitArea = { contains: (x: number, y: number) => x >= 0 && y >= 0 && x <= w && y <= h };
    this.draw();
  }
  private held = false;
  /** Keep it slid out and lit (the skill being aimed). */
  hold(): void {
    this.held = true;
    this.want = 1;
  }
  get eyeX(): number {
    return this.h * 0.3;
  }
  private shape(inset = 0): number[] {
    const { w, h } = this;
    const c = h * 0.26;
    return [c + inset, inset, w - inset, inset, w - inset, h - inset, c + inset, h - inset, inset, h - c, inset, c];
  }
  private draw(): void {
    const g = this.g;
    const ui = this.ui;
    g.clear();
    const pts = this.shape();
    g.poly(pts.map((v, i) => v + (i % 2 ? 4 * ui : 2 * ui))).fill({ color: 0x0a0402, alpha: 0.32 });
    const leather = this.kind === "leather";
    g.poly(pts).fill({ texture: stock(this.kind === "leather" ? "kraft" : this.kind), color: leather ? (this.enabled ? 0x8a2418 : 0x6a3a30) : this.enabled ? 0xffffff : 0xdcd2c2, textureSpace: "local" });
    if (leather) {
      // Gold foil: a tooled border and a second fine rule.
      g.poly(this.shape(5 * ui)).stroke({ width: 2 * ui, color: 0xe8b830, alpha: 0.9 });
      g.poly(this.shape(9 * ui)).stroke({ width: 1, color: 0xe8b830, alpha: 0.45 });
    }
    // A reinforcing patch round the eyelet and a fold line.
    const ex = this.eyeX;
    g.circle(ex, this.h / 2, this.h * 0.2).fill({ color: leather ? 0x5a140c : this.kind === "kraft" ? 0xa8804e : 0xd8b878, alpha: 0.9 });
    eyelet(g, ex, this.h / 2, Math.max(2.5, this.h * 0.075));
    g.moveTo(this.h * 0.55, 3 * ui).lineTo(this.h * 0.55, this.h - 3 * ui).stroke({ width: 1, color: 0x6a4a20, alpha: 0.25 });
    g.poly(pts).stroke({ width: 1, color: 0x5a3a14, alpha: 0.45 });
  }
  setGlow(k: number): void {
    const gl = this.glowG;
    gl.clear();
    if (k <= 0.02) return;
    const pts = this.shape(-3 * this.ui);
    for (let i = 3; i >= 1; i--) gl.poly(this.shape(-i * 2.5 * this.ui)).stroke({ width: 3 * this.ui, color: P.glow, alpha: 0.16 * k * (4 - i) });
    gl.poly(pts).stroke({ width: 2 * this.ui, color: P.glow, alpha: 0.9 * k });
  }
  tick(dt: number): void {
    const prev = this.hot;
    this.hot += (this.want - this.hot) * Math.min(1, dt * 14);
    if (Math.abs(this.hot - prev) > 0.002) {
      this.rotation = this.baseRot * (1 - this.hot);
      this.scale.set(1 + this.hot * 0.035);
      this.x = this.baseX + this.hot * 8 * this.ui;
      this.setGlow(this.hot);
    }
  }
}

export class TagMenu extends ActionMenu {
  private lastSkills: MenuSkill[] | null = null;
  protected tags: Tag[] = [];
  protected strings = new Graphics();
  protected dowel = new Graphics();
  private last = 0;

  constructor() {
    super();
    this.addChildAt(this.bg, 0);
    this.addChildAt(this.strings, 1);
    this.addChildAt(this.dowel, 2);
  }

  override place(rect: Rect, ui: number): void {
    this.rect = rect;
    this.ui = ui;
    this.position.set(rect.x, rect.y);
    this.bg.clear();
    this.render();
  }

  /** The dark oak tag board behind the rack, with brass corner brackets. */
  private drawBoard(dowelY: number): void {
    const { w, h } = this.rect;
    const ui = this.ui;
    const b = this.bg;
    b.clear();
    const y0 = dowelY - 14 * ui;
    b.roundRect(5 * ui, y0 + 7 * ui, w, h - y0, 6 * ui).fill({ color: 0x000000, alpha: 0.5 });
    b.roundRect(0, y0, w, h - y0, 6 * ui).fill({ color: 0x3a2312 }).stroke({ width: 2 * ui, color: 0x1a0d05 });
    for (let y = y0 + 9 * ui, i = 0; y < h - 4 * ui; y += 7 * ui, i++) b.rect(4 * ui, y, w - 8 * ui, 1).fill({ color: i % 3 ? 0x5a3a20 : 0x24140a, alpha: 0.5 });
    b.rect(0, y0, w, 3 * ui).fill({ color: 0xc8915a, alpha: 0.35 });
    const k = 16 * ui;
    for (const [x, y, sx, sy] of [[0, y0, 1, 1], [w, y0, -1, 1], [0, h, 1, -1], [w, h, -1, -1]] as const) {
      b.poly([x, y, x + sx * k, y, x, y + sy * k]).fill({ color: P.brass }).stroke({ width: 1, color: P.brassDark });
      b.circle(x + sx * k * 0.3, y + sy * k * 0.3, 1.6 * ui).fill({ color: P.brassDark });
    }
  }

  /** The oak dowel the tags hang from, with brass end caps and two screw eyes. */
  private drawDowel(y: number): void {
    const { w } = this.rect;
    const ui = this.ui;
    const d = this.dowel;
    d.clear();
    const r = 5 * ui;
    d.roundRect(0, y + 5 * ui, w, r * 2, r).fill({ color: 0x000000, alpha: 0.3 });
    d.roundRect(0, y - r, w, r * 2, r).fill({ color: P.oak });
    d.rect(0, y - r * 0.6, w, r * 0.5).fill({ color: 0xd9a060, alpha: 0.45 });
    d.rect(0, y + r * 0.4, w, r * 0.5).fill({ color: 0x3a2010, alpha: 0.4 });
    for (const x of [0, w - 9 * ui]) d.roundRect(x, y - r - 1, 9 * ui, r * 2 + 2, 2 * ui).fill({ color: P.brass }).stroke({ width: 1, color: P.brassDark });
  }

  protected override render(): void {
    for (const c of this.content.removeChildren()) c.destroy({ children: true });
    this.tags = [];
    this.strings.clear();
    this.dowel.clear();
    const ui = this.ui;
    const { w, h } = this.rect;
    const m = this.mode;
    if (m.kind === "skills") this.lastSkills = m.skills;
    const dowelY = Math.round(34 * ui);
    if (m.kind === "wait") {
      if (m.text) {
        const t = txt(m.text, { fontFamily: FELL, fontStyle: "italic", fontSize: Math.round(22 * ui), fill: 0xf2e2c0, dropShadow: { color: 0x000000, alpha: 0.9, blur: 4, distance: 1 } });
        t.anchor.set(0.5);
        t.position.set(w / 2, h * 0.4);
        this.content.addChild(t);
      }
      return;
    }
    this.drawBoard(dowelY);
    this.drawDowel(dowelY);
    // The header: a carved plaque over the board with whose turn it is (or the skill being aimed).
    const title = m.kind === "skills" ? m.actor : m.skill;
    const sub = m.kind === "skills" ? "choose a skill" : "choose a target";
    const head = new Container();
    const tt = txt(title.toUpperCase(), { fontFamily: CINZEL, fontWeight: "800", fontSize: Math.round(17 * ui), fill: 0xf5d36c, letterSpacing: 1.5 * ui });
    const st = txt(`  ·  ${sub}`, { fontFamily: FELL, fontStyle: "italic", fontSize: Math.round(16 * ui), fill: 0xd8c09a });
    const pw = Math.min(w * 0.94, tt.width + st.width + 34 * ui);
    const ph = tt.height + 10 * ui;
    const plaque = new Graphics();
    plaque.roundRect(3 * ui, 4 * ui, pw, ph, 4 * ui).fill({ color: 0x000000, alpha: 0.45 });
    plaque.roundRect(0, 0, pw, ph, 4 * ui).fill({ color: 0x2a170c }).stroke({ width: 1.5 * ui, color: P.brass });
    plaque.roundRect(3 * ui, 3 * ui, pw - 6 * ui, ph - 6 * ui, 3 * ui).stroke({ width: 1, color: P.brass, alpha: 0.4 });
    for (const x of [8 * ui, pw - 8 * ui]) plaque.circle(x, ph / 2, 2.4 * ui).fill({ color: P.brass });
    tt.position.set(17 * ui, 5 * ui);
    fit(tt, pw - 34 * ui);
    st.position.set(tt.x + tt.width, 5 * ui + (tt.height - st.height) / 2 + 1 * ui);
    st.visible = st.x + st.width < pw - 10 * ui;
    head.addChild(plaque, tt, st);
    head.position.set(8 * ui, dowelY - ph - 9 * ui);
    this.content.addChild(head);

    const top = dowelY + Math.round(16 * ui);
    const aiming = m.kind === "target";
    const list = m.kind === "skills" ? m.skills : this.lastSkills?.some((s) => s.name === m.skill) ? this.lastSkills : null;
    if (m.kind === "target" && !list) {
      const big = new Tag(Math.min(w - 20 * ui, 520 * ui), Math.min(h - top - 64 * ui, 92 * ui), ui, false, "kraft", 3, () => {});
      big.position.set(10 * ui, top);
      const hint = txt(m.hint, { fontFamily: FELL, fontStyle: "italic", fontSize: Math.round(19 * ui), fill: P.ink, wordWrap: true, wordWrapWidth: big.w - big.h * 0.7 - 16 * ui });
      hint.position.set(big.h * 0.62, (big.h - hint.height) / 2);
      big.addChild(hint);
      this.hang(big, dowelY);
      const bh = Math.round(54 * ui);
      const bw = Math.round(Math.min(200 * ui, (w - 40 * ui) / 2));
      const by = top + big.h + 12 * ui;
      this.addTag(14 * ui, by, bw, bh, "Back", "", true, false, () => this.onBack(), false, "card", 41, dowelY);
      if (m.confirm) this.addTag(30 * ui + bw, by, bw, bh, "Confirm", "", true, false, () => this.onConfirm(), false, "manila", 42, dowelY);
      return;
    }
    // Standard skills in a grid; the signature skills each get a full-width crimson tag under them. While a
    // skill is being aimed the rack stays up: that tag held out and lit, the rest dimmed, and a row of
    // Back / Confirm tags under them.
    const skills = list!.map((s, i) => ({ s, key: i + 1 }));
    const plain = skills.filter((x) => !x.s.signature);
    const sig = skills.filter((x) => x.s.signature);
    const cols = w > 420 * ui ? 2 : plain.length > 3 && w > 300 * ui ? 2 : 1;
    const gapX = Math.round(16 * ui);
    const gapY = Math.round(9 * ui);
    const rows = Math.ceil(plain.length / cols) + sig.length + (aiming ? 1 : 0);
    const tw2 = (w - 22 * ui - gapX * (cols - 1)) / cols;
    const th = Math.max(40 * ui, Math.min(74 * ui, (h - top - 8 * ui - gapY * (rows - 1)) / rows));
    const after = (s: MenuSkill) => {
      if (!aiming) return;
      const t = this.tags[this.tags.length - 1]!;
      if (s.name === m.skill) t.hold();
      else {
        t.alpha = 0.45;
        t.eventMode = "none";
      }
    };
    const tap = (s: MenuSkill) => (aiming ? () => {} : () => this.onPick(s.id));
    plain.forEach(({ s, key }, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      this.addTag(10 * ui + col * (tw2 + gapX), top + row * (th + gapY), tw2, th, s.name, s.usable ? s.cost : (s.reason ?? ""), s.usable, false, tap(s), !s.usable, "manila", 100 + i * 13, dowelY, aiming ? undefined : key);
      after(s);
    });
    const sigTop = top + Math.ceil(plain.length / cols) * (th + gapY);
    sig.forEach(({ s, key }, i) => {
      this.addTag(10 * ui, sigTop + i * (th + gapY), w - 22 * ui, th, s.name, s.usable ? s.cost : (s.reason ?? ""), s.usable, true, tap(s), !s.usable, "leather", 300 + i * 7, dowelY, aiming ? undefined : key);
      after(s);
    });
    if (m.kind === "target") {
      const y = sigTop + sig.length * (th + gapY);
      const bw = Math.round(Math.min(170 * ui, (w - 40 * ui) / 3));
      this.addTag(10 * ui, y, bw, th, "Back", "esc", true, false, () => this.onBack(), false, "card", 41, dowelY);
      let x = 10 * ui + bw + gapX;
      if (m.confirm) {
        this.addTag(x, y, bw, th, "Confirm", "enter", true, false, () => this.onConfirm(), false, "manila", 42, dowelY);
        x += bw + gapX;
      }
      const hint = txt(m.hint, { fontFamily: FELL, fontStyle: "italic", fontSize: Math.round(Math.min(19 * ui, th * 0.36)), fill: 0xf5d36c, wordWrap: true, wordWrapWidth: Math.max(60 * ui, w - x - 14 * ui) });
      hint.position.set(x + 4 * ui, y + (th - hint.height) / 2);
      this.content.addChild(hint);
    }
  }

  /** Twine from a tag's eyelet up to the dowel. */
  private hang(t: Tag, dowelY: number, red = false): void {
    const ex = t.x - t.pivot.x + t.eyeX;
    const ey = t.y - t.pivot.y + t.h / 2;
    const tx = ex - 14 * this.ui;
    this.strings.moveTo(tx, dowelY).quadraticCurveTo(ex - 22 * this.ui, (dowelY + ey) / 2, ex, ey).stroke({ width: 1.6 * this.ui, color: red ? 0xa8231b : P.twine, alpha: 0.95 });
    this.strings.circle(tx, dowelY + 2 * this.ui, 2.4 * this.ui).fill({ color: red ? 0x7a1810 : 0x8a6a3a });
    this.content.addChild(t);
    this.tags.push(t);
  }

  protected override addButton(x: number, y: number, w: number, h: number, label: string, sub: string, enabled: boolean, signature: boolean, _accent: number, onTap: () => void, subIsReason = false): void {
    this.addTag(x, y, w, h, label, sub, enabled, signature, onTap, subIsReason, "manila", 7, Math.round(34 * this.ui));
  }

  private addTag(x: number, y: number, w: number, h: number, label: string, sub: string, enabled: boolean, signature: boolean, onTap: () => void, subIsReason: boolean, kind: "manila" | "kraft" | "card" | "leather", seed: number, dowelY: number, key?: number): void {
    const ui = this.ui;
    const t = new Tag(w, h, ui, enabled, kind, seed, onTap);
    t.pivot.set(t.eyeX, h / 2);
    t.position.set(x + t.eyeX, y + h / 2);
    t.baseX = t.x;
    const inset = h * 0.62;
    const nameSize = Math.round(Math.min(26 * ui, h * 0.42));
    const leather = kind === "leather";
    const name = txt(label, { fontFamily: FELL, fontSize: nameSize, fill: leather ? (enabled ? 0xf5d36c : 0xd8b878) : enabled ? P.ink : 0x4a3a2a });
    // A narrow tag (a phone) stamps its cost under the name instead of beside it.
    const narrow = !subIsReason && !!sub && w < 250 * ui && h > 44 * ui;
    const stampW = !subIsReason && sub && !narrow ? Math.min(w * 0.36, 130 * ui) : 0;
    fit(name, w - inset - stampW - 14 * ui - (signature ? 20 * ui : 0));
    const twoLine = (subIsReason && sub && h > 44 * ui) || narrow;
    name.position.set(inset, twoLine ? h * 0.1 : (h - name.height) / 2);
    t.addChild(name);
    if (key && key <= 9 && enabled) {
      // The key that picks it, pencilled in the corner.
      const k = txt(String(key), { fontFamily: GARA, fontStyle: "italic", fontSize: Math.round(11 * ui), fill: P.pencil });
      k.alpha = 0.7;
      k.position.set(w - k.width - 5 * ui, h - k.height - 2 * ui);
      t.addChild(k);
    }
    if (sub && !subIsReason) {
      const sz = Math.round(Math.min(12 * ui, h * 0.2));
      const s = stamp(sub, sz, sub.toLowerCase() === "basic" ? 0x7a5a36 : P.redInk, -0.07 + (seed % 5) * 0.025);
      if (narrow) {
        s.scale.set(0.85);
        s.position.set(inset + (s.width * 0.85) / 2 + 2 * ui, h * 0.72);
      } else {
        const sw = (s.width / 2) * 1;
        s.position.set(w - sw - 12 * ui, h / 2);
        if (s.width > stampW + 8 * ui) s.scale.set((stampW + 8 * ui) / s.width);
      }
      t.addChild(s);
    } else if (sub) {
      // Not yet: what it needs, stamped across the tag in red (the name stays readable under it).
      const sz = Math.round(Math.min(12 * ui, h * 0.2));
      const s = stamp(sub, sz, leather ? 0xffb090 : P.redInk, -0.12);
      const room = Math.max(60 * ui, w - name.x - name.width - 24 * ui);
      if (s.width > room) s.scale.set(room / s.width);
      s.position.set(w - (s.width * s.scale.x) / 2 - 14 * ui, h / 2);
      if (s.x - (s.width * s.scale.x) / 2 < name.x + name.width) {
        name.y = h * 0.1;
        s.position.set(inset + (s.width * s.scale.x) / 2 + 4 * ui, h * 0.72);
      }
      t.addChild(s);
    }
    if (signature) {
      // A gold foil star sticker.
      const star = new Graphics();
      const cx = name.x + name.width + 14 * ui;
      const cy = name.y + name.height / 2;
      const R = 9 * ui;
      const pts: number[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? R * 0.45 : R;
        pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      star.poly(pts.map((v, i) => v + (i % 2 ? 1.5 : 1))).fill({ color: 0x000000, alpha: 0.3 });
      star.poly(pts).fill({ color: enabled ? 0xe8b830 : 0xa89060 }).stroke({ width: 1, color: 0x8a5a10 });
      star.circle(cx - R * 0.2, cy - R * 0.25, R * 0.2).fill({ color: 0xffffff, alpha: 0.5 });
      t.addChild(star);
    }
    void Text;
    void CINZEL;
    this.hang(t, dowelY, signature);
  }

  /** Called by the stage every frame through the decor (the base menu has no update). */
  tick(now: number): void {
    const dt = this.last ? Math.min(0.1, now - this.last) : 0.016;
    this.last = now;
    for (const t of this.tags) t.tick(dt);
  }

  /** Pick the n-th usable skill (keyboard). */
  pickIndex(i: number): boolean {
    if (this.mode.kind !== "skills") return false;
    const s = this.mode.skills[i];
    if (!s || !s.usable) return false;
    this.onPick(s.id);
    return true;
  }
  get modeKind(): string {
    return this.mode.kind;
  }
  get canConfirm(): boolean {
    return this.mode.kind === "target" && this.mode.confirm;
  }
}
