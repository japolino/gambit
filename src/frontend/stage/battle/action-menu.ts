/**
 * The action menu for the party member whose turn it is: skills with their
 * costs, unusable ones dimmed with the reason, signature skills marked.
 * Picking a skill switches the menu to targeting (tap a highlighted enemy
 * or ally on the field, or Confirm for self and area skills; Back to
 * choose again). Drawn in Pixi like the rest of the UI.
 */
import { Container, Graphics, Text } from "pixi.js";
import { C, T } from "../theme.js";
import { drawPanel } from "../ui.js";
import type { Rect } from "./layout.js";

export type MenuSkill = {
  id: string;
  name: string;
  cost: string;
  usable: boolean;
  reason?: string;
  signature: boolean;
  flavor?: string;
};

type Mode = { kind: "skills"; actor: string; skills: MenuSkill[] } | { kind: "target"; skill: string; hint: string; confirm: boolean } | { kind: "wait"; text: string };

class Button extends Container {
  private g = new Graphics();
  private hovered = false;
  constructor(private w: number, private h: number, private ui: number, private enabled: boolean, private accent: number, onTap: () => void) {
    super();
    this.addChild(this.g);
    this.eventMode = "static";
    this.cursor = enabled ? "pointer" : "default";
    this.on("pointerover", () => { this.hovered = true; this.draw(); });
    this.on("pointerout", () => { this.hovered = false; this.draw(); });
    this.on("pointertap", () => { if (this.enabled) onTap(); });
    this.draw();
  }
  private draw(): void {
    const g = this.g;
    g.clear();
    const hot = this.hovered && this.enabled;
    drawPanel(g, 0, 0, this.w, this.h, {
      chamfer: 5 * this.ui,
      fill: hot ? 0x2e261d : this.enabled ? 0x221c16 : 0x16130f,
      fillBottom: hot ? 0x1d1812 : 0x141110,
      line: hot ? this.accent : this.enabled ? C.line : 0x3a3127,
      alpha: 0.96,
    });
    if (hot) g.rect(0, 4 * this.ui, 2, this.h - 8 * this.ui).fill({ color: this.accent });
  }
}

export class ActionMenu extends Container {
  onPick: (skillId: string) => void = () => {};
  onBack: () => void = () => {};
  onConfirm: () => void = () => {};
  private bg = new Graphics();
  private content = new Container();
  private rect: Rect = { x: 0, y: 0, w: 300, h: 200 };
  private ui = 1;
  private mode: Mode = { kind: "wait", text: "" };

  constructor() {
    super();
    this.addChild(this.bg, this.content);
  }

  place(rect: Rect, ui: number): void {
    this.rect = rect;
    this.ui = ui;
    this.position.set(rect.x, rect.y);
    this.bg.clear();
    drawPanel(this.bg, 0, 0, rect.w, rect.h, { chamfer: 8 * ui, inner: true, alpha: 0.9, fill: 0x17130f, fillBottom: 0x0e0c0a });
    this.render();
  }

  showSkills(actor: string, skills: MenuSkill[]): void {
    this.mode = { kind: "skills", actor, skills };
    this.render();
  }

  showTarget(skill: string, hint: string, confirm: boolean): void {
    this.mode = { kind: "target", skill, hint, confirm };
    this.render();
  }

  showWait(text: string): void {
    this.mode = { kind: "wait", text };
    this.render();
  }

  private header(title: string, sub: string): number {
    const ui = this.ui;
    const pad = 12 * ui;
    const t = new Text({ text: title, style: T.name(Math.round(16 * ui)) });
    t.position.set(pad, pad - 2 * ui);
    const s = new Text({ text: sub.toUpperCase(), style: T.label(Math.round(8.5 * ui), C.goldDim) });
    s.position.set(this.rect.w - pad - s.width, pad + (t.height - s.height) / 2);
    const rule = new Graphics().rect(pad, pad + t.height + 4 * ui, this.rect.w - 2 * pad, 1).fill({ color: C.gold, alpha: 0.22 });
    this.content.addChild(t, s, rule);
    return pad + t.height + 10 * ui;
  }

  private render(): void {
    for (const c of this.content.removeChildren()) c.destroy({ children: true });
    const ui = this.ui;
    const pad = 12 * ui;
    const { w, h } = this.rect;
    const m = this.mode;
    if (m.kind === "wait") {
      const t = new Text({ text: m.text, style: T.label(Math.round(10 * ui), C.textFaint) });
      t.anchor.set(0.5);
      t.position.set(w / 2, h / 2);
      this.content.addChild(t);
      return;
    }
    if (m.kind === "target") {
      const top = this.header(m.skill, "Choose target");
      const hint = new Text({ text: m.hint, style: T.body(Math.round(12 * ui), C.textDim) });
      hint.position.set(pad, top + 4 * ui);
      this.content.addChild(hint);
      const bh = Math.round(40 * ui);
      const bw = Math.min(160 * ui, (w - 3 * pad) / 2);
      const by = Math.min(h - pad - bh, top + hint.height + 18 * ui);
      this.addButton(pad, by, bw, bh, "Back", "", true, false, C.textDim, () => this.onBack());
      if (m.confirm) this.addButton(pad * 2 + bw, by, bw, bh, "Confirm", "", true, false, C.gold, () => this.onConfirm());
      return;
    }
    const top = this.header(m.actor, "Choose an action");
    const skills = m.skills;
    const cols = w > 520 * ui ? 2 : w > 300 * ui ? 2 : 1;
    const gap = Math.round(6 * ui);
    const rows = Math.ceil(skills.length / cols);
    const bw = (w - 2 * pad - gap * (cols - 1)) / cols;
    const bh = Math.max(34 * ui, Math.min(56 * ui, (h - top - pad - gap * (rows - 1)) / rows));
    skills.forEach((s, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      this.addButton(pad + col * (bw + gap), top + row * (bh + gap), bw, bh, s.name, s.usable ? s.cost : (s.reason ?? ""), s.usable, s.signature, s.signature ? C.crit : C.gold, () => this.onPick(s.id), !s.usable);
    });
  }

  private addButton(x: number, y: number, w: number, h: number, label: string, sub: string, enabled: boolean, signature: boolean, accent: number, onTap: () => void, subIsReason = false): void {
    const ui = this.ui;
    const b = new Button(w, h, ui, enabled, accent, onTap);
    b.position.set(x, y);
    const size = Math.round(Math.min(14.5, h / ui / 3) * ui);
    const name = new Text({ text: label, style: T.name(size) });
    name.alpha = enabled ? 1 : 0.45;
    const inset = 10 * ui + (signature ? 10 * ui : 0);
    const twoLine = h > 40 * ui && sub;
    name.position.set(inset, twoLine ? h / 2 - name.height + 1 * ui : (h - name.height) / 2);
    b.addChild(name);
    if (signature) {
      const d = new Graphics();
      const cx = 10 * ui;
      const cy = name.y + name.height / 2;
      const r = 3.5 * ui;
      d.poly([cx, cy - r, cx + r, cy, cx, cy + r, cx - r, cy]).fill({ color: enabled ? C.crit : C.goldDim });
      b.addChild(d);
    }
    if (sub) {
      const st = new Text({ text: subIsReason ? sub : sub.toUpperCase(), style: subIsReason ? T.body(Math.round(10.5 * ui), C.textFaint) : T.label(Math.round(8.5 * ui), C.goldDim) });
      if (twoLine) st.position.set(inset, h / 2 + 2 * ui);
      else st.position.set(w - st.width - 8 * ui, (h - st.height) / 2);
      if (!twoLine && st.x < name.x + name.width + 6 * ui) st.visible = false;
      b.addChild(st);
    }
    b.hitArea = { contains: (px: number, py: number) => px >= 0 && py >= 0 && px <= w && py <= h };
    this.content.addChild(b);
  }
}
