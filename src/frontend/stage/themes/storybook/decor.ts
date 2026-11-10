/**
 * Storybook battle: the book around the fight. Behind the figures: the painting's warm light (god rays, a
 * heavy vignette, drifting motes), the mahogany skirt and the dialogue page across the bottom (the party's
 * arches stand behind its rim). Over everything: the gilt acanthus corners of the plate, moving a little
 * against the pointer. Each foe stands over a brocade name scroll with a gilt gauge (its HP), rosettes for
 * its poise and wax seals for its statuses, instead of the stock plate. The engine's events are told on the
 * page as they play. Keyboard: 1–9 pick a skill (or a target), arrows move, Enter takes, Escape goes back.
 * On a phone (GEO.compact) the page is plain vellum and a foe's plate is drawn flat, both at once: nothing that
 * has to be read waits on a picture, and the corners and rays are gone.
 */
import { Container, FillGradient, Graphics, Sprite, Text, TextStyle, Texture } from "pixi.js";
import type { BattleEvent, BattleState } from "../../../../engine/types.js";
import type { BattleStage } from "../../battle/stage.js";
import type { EnemyView } from "../../battle/enemy-view.js";
import type { StageLayout } from "../../battle/layout.js";
import { STATUS_STYLE } from "../../theme.js";
import { drawStatusGlyph } from "../../ui.js";
import type { StageDecor } from "../types.js";
import { CINZEL, GARAMOND } from "../shared.js";
import { godRays, parchment } from "../../../scene/themes/storybook/textures.js";
import { corner, diamond, floorRing, gauge, page, pip, scroll, seal, skirtArt } from "./art.js";
import { GEO } from "./layout.js";
import { BookMenu } from "./menu.js";
import { BookCard } from "./card.js";
import { ArtSprite, ImageSprite } from "./sprite.js";

let blood: FillGradient | null = null;
const BLOOD = () => (blood ??= new FillGradient({ type: "linear", start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, colorStops: [{ offset: 0, color: 0xff7a62 }, { offset: 0.45, color: 0xc2242a }, { offset: 1, color: 0x5e0a12 }], textureSpace: "local" }));

/** A foe's storybook plate: brocade scroll, name, gilt gauge, poise rosettes, seals. */
class FoePlate extends Container {
  private scrollArt = new ArtSprite("foe-scroll", () => scroll("fight"));
  private nameT = new Text({ text: "", style: new TextStyle({ fontFamily: CINZEL, fontSize: 13 }) });
  private gaugeArt = new ArtSprite("gauge", gauge);
  private fill = new Graphics();
  private marks = new Container();
  private ghost = 1;
  private shown = 1;
  private hold = 0;
  private sig = "";
  private w = 100;
  private gw = 100;
  private gh = 10;
  /** A phone's plate: the dark ground behind its name, gauge and poise, and where the gauge sits. */
  private back = new Graphics();
  private gy = 0;
  constructor(readonly view: EnemyView) {
    super();
    this.nameT.anchor.set(0.5);
    this.addChild(this.back, this.scrollArt, this.nameT, this.gaugeArt, this.fill, this.marks);
  }
  layout(ui: number, slotW = 0): void {
    const v = this.view;
    const compact = GEO.compact;
    this.scrollArt.visible = this.gaugeArt.visible = this.back.visible = !compact;
    this.back.visible = compact;
    if (compact) {
      const pw = Math.round(Math.min(190, Math.max(96, slotW - 6)));
      this.w = this.gw = pw - 12;
      this.gh = 12;
      this.nameT.anchor.set(0.5, 0);
      this.nameT.scale.set(1);
      this.nameT.style = new TextStyle({ fontFamily: GARAMOND, fontWeight: "700", fontSize: 14, fill: 0xfff0cc, align: "center", wordWrap: true, wordWrapWidth: pw - 10, lineHeight: 16 });
      this.nameT.position.set(0, 3);
      this.position.set(0, v.slot.floorY - v.slot.y + 2);
      this.sig = "";
      this.fsig = "";
      return;
    }
    this.nameT.anchor.set(0.5);
    const k = Math.max(0.75, ui * 0.82);
    const base = Math.round(Math.max(150, Math.min(250, v.slot.height * 0.5)) * k);
    const sh = (base * 72) / 200;
    // A foe's name is read across the room: set at a fixed readable size, and the scroll is as long as the name
    // needs (up to its slot), rather than the name shrinking to fit a short scroll.
    const fs = Math.round(Math.max(17, (base / 200) * 18.5));
    this.nameT.style = new TextStyle({ fontFamily: GARAMOND, fontWeight: "700", fontSize: fs, fill: 0xfff0cc, letterSpacing: fs * 0.02, stroke: { color: 0x2a0606, width: Math.max(2, fs * 0.14) } });
    this.scrollGeo = { base, sh, k, max: Math.max(base, slotW > 0 ? slotW : base * 1.5), fs };
    this.fitScroll();
    const gw = base * 0.72, gh = Math.max(12, base * 0.075);
    this.gaugeArt.draw(gw, gh);
    this.gw = gw;
    this.gh = gh;
    this.gaugeArt.position.set(-gw / 2, this.scrollArt.y + sh + 2 * k);
    // The view's own place() puts the plate under the feet; we sit where it sat.
    const sy = v.slot.floorY - v.slot.y;
    this.position.set(0, (v as unknown as { unit?: { rig?: string } }).unit?.rig === "huge" ? -v.slot.height * 0.42 : sy + 10 * ui);
    this.sig = "";
  }
  refresh(u: { name: string; hp: number; maxHp: number; shield: number; poise: number; maxPoise: number; broken: boolean; alive: boolean; statuses: { id: keyof typeof STATUS_STYLE }[] }, now: number): void {
    this.visible = u.alive;
    if (!u.alive) return;
    const t = u.hp / Math.max(1, u.maxHp);
    if (t < this.shown) this.hold = now + 0.45;
    else this.ghost = Math.max(this.ghost, t);
    this.shown = t;
    if (now > this.hold && this.ghost > this.shown) this.ghost = Math.max(this.shown, this.ghost - 0.016);
    if (GEO.compact) {
      if (this.nameT.text !== u.name) this.nameT.text = u.name;
      this.gy = 3 + this.nameT.height + 2;
    } else {
      // In the book's text face, upper and lower case: a long name keeps its size where capitals had to shrink.
      if (this.nameT.text !== u.name) {
        this.nameT.text = u.name;
        this.fitScroll();
      }
    }
    const fsig = `${t.toFixed(3)}|${this.ghost.toFixed(3)}|${u.shield}|${u.broken}|${this.gw}`;
    if (fsig !== this.fsig) this.drawFill(t, u);
    this.fsig = fsig;
    this.marksFor(u);
  }
  private fsig = "";
  private scrollGeo = { base: 150, sh: 54, k: 1, max: 225, fs: 15 };
  /** The scroll sized to the name on it (desktop): as long as the name needs, the name's dark band there before the scroll's picture is. */
  private fitScroll(): void {
    const { base, sh, k, max, fs } = this.scrollGeo;
    this.nameT.scale.set(1);
    const sw = Math.round(Math.max(base, Math.min(this.nameT.width / 0.66, max)));
    this.w = sw;
    this.scrollArt.draw(sw, sh);
    this.scrollArt.position.set(-sw / 2, -sh * (18 / 72) - 4 * k);
    this.nameT.position.set(0, this.scrollArt.y + sh * (55 / 72) - sh * 0.03);
    if (this.nameT.width > sw * 0.72) this.nameT.scale.set((sw * 0.72) / this.nameT.width);
    this.back.visible = true;
    this.back.clear().roundRect(-sw * 0.36, this.nameT.y - fs * 0.85, sw * 0.72, fs * 1.7, 3).fill({ color: 0x4a1216, alpha: 0.92 }).stroke({ width: 1, color: 0xb98a45, alpha: 0.9 });
  }
  private drawFill(t: number, u: { shield: number; maxHp: number; broken: boolean }): void {
    const g = this.fill;
    if (GEO.compact) {
      // A gauge you can read at arm's length: a thick bar in a gilt rule, no picture.
      const gw = this.gw, gh = this.gh, x = -gw / 2, y = this.gy;
      const iw = gw - 4, ih = gh - 4;
      g.clear();
      g.roundRect(x, y, gw, gh, 2).fill({ color: 0x1b0b0e }).stroke({ width: 1, color: u.broken ? 0xffe2a0 : 0xd9ad62 });
      if (this.ghost > t) g.rect(x + 2 + iw * t, y + 2, iw * (this.ghost - t), ih).fill({ color: 0xf1d9b0, alpha: 0.85 });
      if (t > 0) g.rect(x + 2, y + 2, iw * t, ih).fill(BLOOD());
      if (u.shield > 0) g.rect(x + 2 + iw * t, y + 2, Math.min(iw * (1 - t), iw * (u.shield / Math.max(1, u.maxHp))), ih).fill({ color: 0xd8e6f0, alpha: 0.7 });
      return;
    }
    const gx = this.gaugeArt.x, gy = this.gaugeArt.y, gw = this.gw, gh = this.gh;
    const ix = gx + gw * 0.05, iw = gw * 0.9, iy = gy + gh * 0.32, ih = gh * 0.36;
    g.clear();
    if (this.ghost > t) g.rect(ix + iw * t, iy, iw * (this.ghost - t), ih).fill({ color: 0xf1d9b0, alpha: 0.85 });
    if (t > 0) g.rect(ix, iy, iw * t, ih).fill(BLOOD());
    if (u.shield > 0) g.rect(ix + iw * t, iy, Math.min(iw * (1 - t), iw * (u.shield / Math.max(1, u.maxHp))), ih).fill({ color: 0xd8e6f0, alpha: 0.7 });
    if (u.broken) g.rect(ix - 2, iy - 2, iw + 4, ih + 4).stroke({ width: 1.5, color: 0xffe2a0 });
  }
  private marksFor(u: { poise: number; maxPoise: number; broken: boolean; statuses: { id: keyof typeof STATUS_STYLE }[] }): void {
    const gx = this.gaugeArt.x, gy = this.gaugeArt.y, gw = this.gw, gh = this.gh;
    const sig = `${u.poise}/${u.maxPoise}/${u.broken}|${u.statuses.map((s) => s.id).join(",")}`;
    if (sig === this.sig) return;
    this.sig = sig;
    for (const c of this.marks.removeChildren()) c.destroy({ children: true });
    if (GEO.compact) {
      this.marksCompact(u);
      return;
    }
    const ps = Math.max(10, gh * 0.95);
    const n = Math.min(u.maxPoise, 10);
    const y = gy + gh + 3;
    for (let i = 0; i < n; i += 1) {
      const on = i < u.poise && !u.broken;
      const p = new ArtSprite(on ? "pip-on" : "pip-off", () => pip(on)).draw(ps, ps);
      p.position.set(-((n * (ps + 1)) / 2) + i * (ps + 1), y);
      this.marks.addChild(p);
    }
    const ss = Math.max(18, gh * 1.7);
    u.statuses.slice(0, 5).forEach((st, i) => {
      const sty = STATUS_STYLE[st.id];
      const c = new Container();
      c.addChild(new ArtSprite(sty.harmful ? "seal" : "seal-gold", () => (sty.harmful ? seal() : seal().replace(/url\(#sb-wax\)/g, "url(#sb-gold)"))).draw(ss, ss));
      const gl = new Graphics();
      drawStatusGlyph(gl, sty.glyph, ss * 0.3, ss * 0.3, ss * 0.4, sty.harmful ? 0xffe2c8 : 0x4a2a0e);
      c.addChild(gl);
      c.position.set(this.gaugeArt.x + gw + 2 + i * (ss * 0.8), gy + gh / 2 - ss / 2);
      this.marks.addChild(c);
    });
  }
  /** A phone's poise and statuses: one row under the gauge, then the plate's ground behind it all. */
  private marksCompact(u: { poise: number; maxPoise: number; broken: boolean; statuses: { id: keyof typeof STATUS_STYLE }[] }): void {
    const y = this.gy + this.gh + 3;
    const n = Math.min(u.maxPoise, 10);
    const ps = 11, ss = 18;
    const statuses = u.statuses.slice(0, 4);
    const total = n * (ps + 2) + (statuses.length ? 4 + statuses.length * (ss + 1) : 0);
    let x = -total / 2;
    const dots = new Graphics();
    for (let i = 0; i < n; i += 1) {
      const on = i < u.poise && !u.broken;
      dots.circle(x + ps / 2, y + 9 - ps / 2 + 0.5, ps / 2 - 1);
      if (on) dots.fill({ color: 0xe9c57a }).stroke({ width: 1, color: 0x5a3816 });
      else dots.stroke({ width: 1.2, color: 0xb8964e });
      x += ps + 2;
    }
    this.marks.addChild(dots);
    x += statuses.length ? 4 : 0;
    statuses.forEach((st) => {
      const sty = STATUS_STYLE[st.id];
      const c = new Container();
      c.addChild(new ArtSprite(sty.harmful ? "seal" : "seal-gold", () => (sty.harmful ? seal() : seal().replace(/url\(#sb-wax\)/g, "url(#sb-gold)"))).draw(ss, ss));
      const gl = new Graphics();
      drawStatusGlyph(gl, sty.glyph, ss * 0.3, ss * 0.3, ss * 0.4, sty.harmful ? 0xffe2c8 : 0x4a2a0e);
      c.addChild(gl);
      c.position.set(x, y);
      this.marks.addChild(c);
      x += ss + 1;
    });
    const h = y + (n || statuses.length ? 19 : 0) + 2;
    this.back.clear().roundRect(-this.w / 2 - 6, 0, this.w + 12, h, 3).fill({ color: 0x140a05, alpha: 0.82 }).stroke({ width: 1, color: 0x8a6a2a, alpha: 0.9 });
  }
}

/** Plain words for what just happened, for the page. */
function told(ev: BattleEvent, nameOf: (id: string) => string): string | null {
  switch (ev.kind) {
    case "use": return `${nameOf(ev.actor)} ${ev.signature ? "unleashes" : "uses"} ${ev.name}.`;
    case "hit": return `${nameOf(ev.target)} takes ${ev.amount}${ev.crit ? ", a telling blow" : ""}${ev.weak ? ", struck where it is weak" : ev.resisted ? ", and shrugs part of it off" : ""}.`;
    case "miss": return `${nameOf(ev.source)} misses ${nameOf(ev.target)}.`;
    case "heal": return `${nameOf(ev.target)} recovers ${ev.amount}.`;
    case "shield": return `${nameOf(ev.target)} is warded for ${ev.amount}.`;
    case "status_on": return `${nameOf(ev.target)}: ${STATUS_STYLE[ev.status].label.toLowerCase()}${ev.turns ? ` for ${ev.turns} turns` : ""}.`;
    case "status_off": return `${nameOf(ev.target)} is free of ${STATUS_STYLE[ev.status].label.toLowerCase()}.`;
    case "status_tick": return `${STATUS_STYLE[ev.status].label} bites ${nameOf(ev.target)} for ${ev.amount}.`;
    case "break": return `${nameOf(ev.target)}'s guard breaks!`;
    case "recover": return `${nameOf(ev.target)} steadies.`;
    case "skip": return `${nameOf(ev.actor)} cannot act${ev.reason === "stun" ? ", stunned" : ev.reason === "fear" ? ", frozen with fear" : ", reeling"}.`;
    case "phase": return `${nameOf(ev.target)}: ${ev.name}.`;
    case "defeat": return `${nameOf(ev.target)} falls.`;
    case "passive": return `${nameOf(ev.actor)}: ${ev.name}.`;
    case "talk": return `${nameOf(ev.actor)} speaks to ${nameOf(ev.target)}${ev.ok ? ", and is heard" : ", to no avail"}.`;
    case "leave": return `${nameOf(ev.target)} leaves the field.`;
    case "end": return ev.outcome === "victory" ? "The foes are vanquished; the page is yours." : ev.outcome === "defeat" ? "The party has fallen. The tale darkens." : "The fight is over.";
    default: return null;
  }
}

/** A soft dark vignette as a small canvas, stretched over the screen. */
function vignetteTexture(): Texture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 300;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(256, 125, 60, 256, 125, 330);
  r.addColorStop(0, "rgba(18,9,4,0)");
  r.addColorStop(0.55, "rgba(18,9,4,0.05)");
  r.addColorStop(0.82, "rgba(18,9,4,0.55)");
  r.addColorStop(1, "rgba(10,5,2,0.92)");
  g.fillStyle = r;
  g.fillRect(0, 0, 512, 300);
  const top = g.createLinearGradient(0, 0, 0, 300);
  top.addColorStop(0, "rgba(10,5,2,0.6)");
  top.addColorStop(0.18, "rgba(10,5,2,0)");
  top.addColorStop(0.62, "rgba(10,5,2,0)");
  top.addColorStop(1, "rgba(10,5,2,0.7)");
  g.fillStyle = top;
  g.fillRect(0, 0, 512, 300);
  return Texture.from(c);
}

export function decorate(stage: BattleStage): StageDecor {
  const reduced = () => stage.reduced;
  stage.bgShade.visible = false;
  // Light and the book, behind the figures.
  const atmos = new Container();
  const vig = new Sprite(vignetteTexture());
  const rays = new ImageSprite(godRays());
  rays.blendMode = "screen";
  rays.alpha = 0.55;
  const motes = new Graphics();
  motes.blendMode = "screen";
  const skirt = new ArtSprite("skirt", () => "");
  const pageArt = new ArtSprite("page", () => "");
  // A phone's page: flat colour at once, the vellum over it as soon as it decodes, a gilt rule on its edge.
  const flatPage = new Graphics();
  const vellum = new ImageSprite(parchment());
  const pageRim = new Graphics();
  atmos.addChild(rays, vig, motes, skirt, flatPage, pageArt, vellum, pageRim);
  stage.back.addChild(atmos);
  // The proscenium corners, over the fight (under the cut-ins).
  const corners = new Container();
  const cs = ["tl", "tr", "bl", "br"].map((k) => {
    const s = new ArtSprite("corner", corner);
    s.label = k;
    corners.addChild(s);
    return s;
  });
  stage.hud.addChildAt(corners, 0);
  // The ring on the floor under a foe you may strike.
  const rings = new Map<string, Container>();
  // Foes' plates.
  const plates = new Map<string, FoePlate>();
  const targetable = new Set<string>();
  let keyTarget = -1;
  // The stock target brackets (thin corner marks) give way to a brass ring on the floor and a gilt diamond over the head.
  const badges = new Map<string, Container>();
  for (const [id, v] of stage.enemies) {
    const badge = new Container();
    const bArt = new ArtSprite("diamond", diamond);
    const bText = new Text({ text: "STRIKE", style: new TextStyle({ fontFamily: CINZEL, fontWeight: "800", fontSize: 12, fill: 0xffd27a, letterSpacing: 2 }) });
    bText.anchor.set(0.5);
    badge.addChild(bArt, bText);
    badge.visible = false;
    v.addChild(badge);
    badges.set(id, badge);
    const origHover = v.hover.bind(v);
    v.hover = (on: boolean) => {
      origHover(on);
      badge.scale.set(on ? 1.18 : 1);
      bArt.tint = on ? 0xfff2c0 : 0xffffff;
    };
  }
  for (const [id, v] of stage.enemies) {
    v.showPlate = false;
    v.plate.visible = false;
    const p = new FoePlate(v);
    v.addChild(p);
    plates.set(id, p);
    const ring = new ArtSprite("floor-ring", floorRing);
    const ringBox = new Container();
    ringBox.addChild(ring);
    ringBox.visible = false;
    v.addChildAt(ringBox, 0);
    rings.set(id, ringBox);
    const orig = v.setTargetable.bind(v);
    v.setTargetable = (on: boolean) => {
      orig(on);
      if (on) targetable.add(id);
      else targetable.delete(id);
      ringBox.visible = on;
      badges.get(id)!.visible = on;
      keyTarget = -1;
    };
  }
  const menu = stage.menu instanceof BookMenu ? stage.menu : null;
  // A foe's whole slot takes the tap on a phone (the stock area is the width of its body).
  const widen = (v: EnemyView) => {
    if (!GEO.compact || !lastLayout) return;
    const w = lastLayout.enemyArea.w / Math.max(1, stage.enemies.size);
    const top = -v.slot.height, bottom = v.slot.floorY - v.slot.y + 56;
    v.hitArea = { contains: (x: number, y: number) => Math.abs(x) <= w / 2 && y >= top && y <= bottom };
  };
  let lastLayout: StageLayout | null = null;
  for (const v of stage.enemies.values()) {
    const place = v.place.bind(v);
    v.place = (...a: Parameters<EnemyView["place"]>) => {
      place(...a);
      widen(v);
    };
  }
  // Motes of dust in the light.
  const dust = Array.from({ length: 34 }, (_, i) => ({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.8, v: 0.004 + Math.random() * 0.01, p: i * 1.7 }));
  let W = 1, H = 1;
  const par = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = (e: { global: { x: number; y: number } }) => {
    par.tx = (e.global.x / Math.max(1, W) - 0.5) * 2;
    par.ty = (e.global.y / Math.max(1, H) - 0.5) * 2;
  };
  stage.app.stage.on("pointermove", onMove);

  // The tale on the page.
  const foes = stage.state.combatants.filter((c) => c.side === "enemy").map((c) => c.name);
  const tale: string[] = [foes.length > 1 ? `${foes.slice(0, -1).join(", ")} and ${foes.at(-1)} bar the way.` : `${foes[0] ?? "A foe"} bars the way.`];
  let who = "";
  menu?.narrate([...tale], "");
  const nameOf = (id: string) => stage.units.get(id)?.name ?? stage.state.combatants.find((c) => c.id === id)?.name ?? "Someone";

  // Keyboard.
  const targetList = (): string[] => {
    const ids = [...stage.enemies.keys()].filter((id) => targetable.has(id));
    for (const [id, c] of stage.cards) if ((c as unknown as { targetable?: boolean }).targetable) ids.push(id);
    return ids;
  };
  const tap = (id: string) => {
    const t = stage.enemies.get(id) ?? stage.cards.get(id);
    t?.emit("pointertap", { stopPropagation() {} } as never);
  };
  const highlight = (i: number) => {
    const ids = targetList();
    keyTarget = ids.length ? (i + ids.length) % ids.length : -1;
    for (const [id, v] of stage.enemies) v.hover(ids[keyTarget] === id);
  };
  const onKey = (e: KeyboardEvent) => {
    if (!menu || !stage.app.canvas.isConnected || stage.app.canvas.offsetParent === null) return;
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
    const k = e.key;
    let used = true;
    if (menu.kind === "skills") {
      if (/^[1-9]$/.test(k)) used = menu.take(Number(k));
      else if (k === "ArrowDown" || k === "ArrowRight") menu.move(1);
      else if (k === "ArrowUp" || k === "ArrowLeft") menu.move(-1);
      else if (k === "Enter" || k === " ") used = menu.take();
      else used = false;
    } else if (menu.kind === "target") {
      const ids = targetList();
      if (/^[1-9]$/.test(k) && ids[Number(k) - 1]) tap(ids[Number(k) - 1]!);
      else if (k === "ArrowRight" || k === "ArrowDown") highlight(keyTarget + 1);
      else if (k === "ArrowLeft" || k === "ArrowUp") highlight(keyTarget - 1);
      else if (k === "Enter" || k === " ") {
        if (keyTarget >= 0 && ids[keyTarget]) tap(ids[keyTarget]!);
        else used = menu.take(1);
      } else if (k === "Escape" || k === "Backspace") menu.onBack();
      else used = false;
    } else used = false;
    if (used) {
      // Ours: the scene underneath must not also act on it.
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };
  addEventListener("keydown", onKey, true);
  if (menu) {
    menu.targetsOf = () => targetList().map((id) => ({ id, name: nameOf(id) }));
    menu.tapTarget = tap;
  }

  const decor: StageDecor = {
    resize(w: number, h: number, l: StageLayout) {
      W = w;
      H = h;
      lastLayout = l;
      vig.width = w;
      vig.height = h;
      rays.fit(w * 0.8, h * 0.92);
      rays.position.set(w * 0.24, -h * 0.06);
      const p = GEO.page;
      const plainPage = GEO.compact;
      rays.visible = !plainPage;
      skirt.visible = pageArt.visible = !plainPage;
      vellum.visible = pageRim.visible = plainPage;
      if (plainPage) {
        flatPage.clear().rect(p.x, p.y, p.w, p.h).fill({ color: 0xe6d3ab });
        vellum.fit(p.w, p.h);
        vellum.position.set(p.x, p.y);
        pageRim.clear();
        if (l.portrait) pageRim.rect(0, p.y - 3, w, 3).fill({ color: 0x2a1205 }).rect(0, p.y - 2, w, 2).fill({ color: 0xd9ad62 });
        else pageRim.rect(p.x - 3, 0, 3, h).fill({ color: 0x2a1205 }).rect(p.x - 2, 0, 2, h).fill({ color: 0xd9ad62 });
      } else {
        // The page's ground at once (dark cradle, gilt hairline, vellum), so its words can be read before its picture is laid over.
        flatPage.clear().roundRect(p.x - 12, p.y - 10, p.w + 24, p.h + 20, 6).fill({ color: 0x2a140b }).stroke({ width: 1.5, color: 0xb98a45 })
          .rect(p.x, p.y, p.w, p.h).fill({ color: 0xe6d3ab });
        const art = page(p.w, p.h);
        const M = art.pad.x, T = art.pad.top, B = art.pad.bottom;
        pageArt.draw(p.w + 2 * M, p.h + T + B, `page-${p.w}x${p.h}`, () => art.svg);
        pageArt.position.set(p.x - M, p.y - T);
        const skH = Math.round((p.h + (h - p.y - p.h)) * 0.72);
        skirt.draw(w, skH, `skirt-${w}x${skH}-${p.x}`, () => skirtArt(w, skH, p.x, p.x + p.w));
        skirt.position.set(0, h - skH);
      }
      const cw = Math.round(Math.max(l.portrait ? 96 : 150, Math.min(360, Math.min(w * 0.21, h * 0.34))));
      const small = Math.round(cw * 0.7);
      for (const s of cs) {
        const big = s.label === "tl" || s.label === "tr";
        const sw = big ? cw : small;
        const sh = (sw * 260) / 380;
        s.draw(sw, sh);
        s.scale.x = Math.abs(s.scale.x) * (s.label === "tr" || s.label === "br" ? -1 : 1);
        s.scale.y = Math.abs(s.scale.y) * (s.label === "bl" || s.label === "br" ? -1 : 1);
        s.position.set(s.label === "tr" || s.label === "br" ? w + 6 : -6, s.label === "bl" || s.label === "br" ? h + 6 : -6);
        s.visible = !plainPage && (big || !l.portrait);
      }
      const slotW = (l.enemyArea.w * (l.portrait ? 0.98 : 0.86)) / Math.max(1, stage.enemies.size);
      for (const [id, v] of stage.enemies) {
        plates.get(id)?.layout(l.ui, slotW);
        widen(v);
        const r = rings.get(id)!;
        const rw = plainPage ? Math.min(slotW, Math.max(96, v.slot.height * 0.62)) : Math.max(120, v.slot.height * 0.62);
        const rs = r.children[0] as ArtSprite;
        rs.draw(rw, rw).anchor.set(0.5);
        rs.position.set(0, 0);
        const b = badges.get(id)!;
        const bw = plainPage ? Math.round(Math.min(124, Math.max(92, slotW - 4))) : Math.round(Math.max(96, 120 * l.ui * 0.8));
        const bh = (bw * 38) / 100;
        (b.children[0] as ArtSprite).draw(bw, bh).position.set(-bw / 2, -bh / 2);
        const bt = b.children[1] as Text;
        bt.style = new TextStyle({ fontFamily: CINZEL, fontWeight: "800", fontSize: plainPage ? 13 : Math.round(bw * 0.1), fill: 0xffd27a, letterSpacing: 2 });
        b.position.set(0, -v.slot.height * ((v as unknown as { unit?: { rig?: string } }).unit?.rig === "huge" ? 0.86 : 1.04) - bh * 0.6);
        // A tall foe's diamond comes down onto its head rather than off the top of the window.
        const sy = Math.abs(v.scale.y) || 1;
        b.y = Math.max(b.y, (Math.round(16 * l.ui) + bh * 0.6 - v.y) / sy);
        // On a phone a tall foe's head is under the order of turns: the diamond stands at its feet, over its plate.
        if (plainPage) b.y = v.slot.floorY - v.slot.y - bh * 0.5 - 2;
        r.scale.set(1, 0.3);
        r.position.set(0, v.slot.floorY - v.slot.y);
      }
    },
    update(now: number, dt: number) {
      menu?.tick(now, dt);
      for (const [id, p] of plates) {
        const u = stage.units.get(id);
        if (u) p.refresh(u as never, now);
      }
      for (const r of rings.values()) if (r.visible) {
        r.alpha = reduced() ? 0.9 : 0.6 + 0.3 * Math.sin(now * 4);
        if (!reduced()) r.children[0]!.rotation = now * 0.2;
      }
      const a = 1 - Math.exp(-dt / 0.5);
      par.x += ((reduced() ? 0 : par.tx) - par.x) * a;
      par.y += ((reduced() ? 0 : par.ty) - par.y) * a;
      corners.position.set(-par.x * 5, -par.y * 3);
      rays.alpha = reduced() ? 0.5 : 0.48 + 0.08 * Math.sin(now * 0.6);
      motes.clear();
      if (!reduced()) {
        for (const d of dust) {
          d.y -= d.v * dt;
          d.x += Math.sin(now * 0.4 + d.p) * 0.0004;
          if (d.y < -0.02) d.y = 1.02;
          motes.circle(d.x * W + par.x * 10, d.y * H * 0.8, d.r).fill({ color: 0xffd79a, alpha: 0.18 + 0.2 * Math.sin(now + d.p) ** 2 });
        }
      }
    },
    event(ev: BattleEvent, _state: BattleState) {
      if (ev.kind === "turn") {
        who = nameOf(ev.actor);
        return;
      }
      if (ev.kind === "use") who = nameOf(ev.actor);
      const line = told(ev, nameOf);
      if (!line) return;
      tale.push(line);
      if (tale.length > 12) tale.shift();
      menu?.narrate([...tale], who);
    },
    destroy() {
      removeEventListener("keydown", onKey, true);
      stage.app.stage.off("pointermove", onMove);
    },
  };
  void BookCard;
  return decor;
}
