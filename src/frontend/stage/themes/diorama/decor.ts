/**
 * The Diorama battle's dressing on the stage (BattleTheme.decorate):
 *
 *  - every enemy figure becomes a die-cut paper standee: a filter grows a
 *    border of card stock round its silhouette with the card's thickness
 *    showing at the lower right, and warms it to the lamp (lit from above,
 *    darker at the feet);
 *  - its stock nameplate is replaced by a kraft price tag on twine at its
 *    feet: the name inked, HP in a red-ink box, poise as punched holes,
 *    statuses as stickers;
 *  - where each figure stands, how it moves and its picture go on the shared
 *    board (../../../scene/themes/diorama/bridge.ts) so the shop throws its
 *    shadow with the lamp and the footlights, and a blow swings the lamp;
 *  - keys: 1-9 pick a skill tag (or, while aiming, the n-th foe), Enter
 *    confirms, Escape goes back.
 */
import { Container, Filter, GlProgram, Graphics } from "pixi.js";
import type { BattleStage } from "../../battle/stage.js";
import type { EnemyView } from "../../battle/enemy-view.js";
import type { DisplayUnit } from "../../battle/display.js";
import type { StageDecor } from "../types.js";
import { STATUS_STYLE } from "../../theme.js";
import { drawStatusGlyph } from "../../ui.js";
import { board, type EnemyMark } from "../../../scene/themes/diorama/bridge.js";
import { P, CINZEL, FELL, fit, txt } from "./paper.js";
import type { TagMenu } from "./tags.js";
import type { Bunting } from "./bunting.js";

/* ------------------------------ The die-cut paper filter ------------------------------ */

const vertex = /* glsl */ `
in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vFrame;
uniform highp vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
void main(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
  vFrame = aPosition;
}`;

const fragment = /* glsl */ `
in vec2 vTextureCoord;
in vec2 vFrame;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform float uRadius;
uniform vec3 uPaper;
uniform float uWarm;
void main(void) {
  vec4 c = texture(uTexture, vTextureCoord);
  vec2 px = uInputSize.zw;
  float a = 0.0;
  float th = 0.0;
  for (int i = 0; i < 16; i++) {
    float ang = float(i) * 0.39270;
    vec2 d = vec2(cos(ang), sin(ang));
    a = max(a, texture(uTexture, vTextureCoord + d * uRadius * px).a);
    a = max(a, texture(uTexture, vTextureCoord + d * uRadius * 0.55 * px).a);
    th = max(th, texture(uTexture, vTextureCoord + (d * uRadius + vec2(uRadius * 0.45, uRadius * 0.6)) * px).a);
  }
  // Lit from the lamp above: warm at the head, falling to umber at the feet.
  vec3 light = mix(vec3(1.07, 0.99, 0.86), vec3(0.7, 0.58, 0.47), smoothstep(0.25, 1.0, vFrame.y) * uWarm);
  vec4 fig = vec4(c.rgb * light, c.a);
  float pa = smoothstep(0.25, 0.6, a);
  vec4 paperC = vec4(uPaper * light * (0.96 + 0.04 * sin(vTextureCoord.x * 900.0 + vTextureCoord.y * 700.0)), 1.0) * pa;
  vec4 thick = vec4(0.30, 0.20, 0.12, 1.0) * smoothstep(0.25, 0.6, th);
  vec4 under = paperC + thick * (1.0 - paperC.a);
  finalColor = fig + under * (1.0 - fig.a);
}`;

let program: GlProgram | null = null;
class DieCut extends Filter {
  constructor(radius: number) {
    program ??= GlProgram.from({ vertex, fragment, name: "gambit-diorama-diecut" });
    super({
      glProgram: program,
      resources: {
        cut: {
          uRadius: { value: radius, type: "f32" },
          uPaper: { value: new Float32Array([0.93, 0.88, 0.76]), type: "vec3<f32>" },
          uWarm: { value: 1, type: "f32" },
        },
      },
      padding: Math.ceil(radius * 2 + 4),
    });
  }
  set radius(r: number) {
    (this.resources.cut as { uniforms: { uRadius: number } }).uniforms.uRadius = r;
    this.padding = Math.ceil(r * 2 + 4);
  }
}

/* ------------------------------ The miniature's base ------------------------------ */

type Priv = { plate: Container; targetable: boolean; marker: Graphics };
const priv = (v: EnemyView) => v as unknown as Priv;

/** Points along the front half of an ellipse (right to left), shifted down by dy. */
function halfEllipse(rx: number, ry: number, dy: number, n = 24): number[] {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI;
    out.push(Math.cos(a) * rx, Math.sin(a) * ry + dy);
  }
  return out;
}

/**
 * Each paper figure slots into a turned oak base on the counter, like a tabletop miniature: an oval plinth seen
 * from just above (its top catching the footlights, its rim in shade), the name engraved on a brass plate set
 * into the rim, HP as a crimson enamel bar under it, poise as brass studs round the front of the top, statuses as
 * wax seals stuck to the side. A foe you can target lights up in the shop's yellow.
 */
class Base extends Container {
  private g = new Graphics();
  private body = new Container();
  /** The targetable glow: drawn with the base, breathed every frame. */
  private pulse = new Graphics();
  private sig = "";
  private ghost = 1;
  private hp = 1;
  private hold = 0;
  /** The back half of the plinth, drawn behind the figure. */
  readonly behind = new Graphics();
  constructor() {
    super();
    this.addChild(this.pulse, this.body);
    this.body.addChild(this.g);
  }
  draw(u: DisplayUnit, ui: number, hot: boolean, now: number, figW: number, stem = 0, still = false): void {
    this.pulse.visible = hot;
    if (hot) this.pulse.alpha = still ? 0.85 : 0.55 + 0.45 * Math.sin(now * 4.2);
    const next = u.hp / Math.max(1, u.maxHp);
    if (next < this.hp) this.hold = now + 0.45;
    else this.ghost = Math.max(this.ghost, next);
    this.hp = next;
    if (now > this.hold && this.ghost > this.hp) this.ghost = Math.max(this.hp, this.ghost - 0.016 * 0.9);
    const sig = `${u.name}|${u.hp}|${u.shield}|${u.poise}/${u.maxPoise}|${u.broken}|${u.statuses.map((s) => s.id).join(",")}|${ui.toFixed(2)}|${hot}|${this.ghost.toFixed(2)}|${Math.round(figW)}|${Math.round(stem)}`;
    if (sig === this.sig) return;
    this.sig = sig;
    for (const c of this.body.removeChildren()) if (c !== this.g) c.destroy();
    this.body.addChild(this.g);
    const g = this.g;
    g.clear();
    // On a phone a long name in spaced capitals would shrink below reading size: ink it in the narrower hand instead.
    const phone = innerWidth <= 760 || innerHeight <= 480;
    const name = phone ? txt(u.name, { fontFamily: FELL, fontSize: 14, fill: 0x2a1404 }) : txt(u.name.toUpperCase(), { fontFamily: CINZEL, fontWeight: "800", fontSize: Math.round(13 * ui), fill: 0x2a1404, letterSpacing: 1.2 * ui });
    const W = Math.round(Math.max(170 * ui, Math.min(250 * ui, Math.max(figW * 0.95, name.width + 54 * ui))));
    const rx = W / 2;
    const ry = Math.round(W * 0.11);
    const rim = Math.round(40 * ui);
    // The back half of the top, behind the figure's feet.
    const b = this.behind;
    b.clear();
    b.ellipse(0, 0, rx, ry).fill({ color: 0x8a5a30 });
    b.ellipse(0, -ry * 0.15, rx * 0.92, ry * 0.75).fill({ color: 0xb07a44, alpha: 0.6 });
    // A figure that floats (its picture stops short of its feet) stands on a card stem slotted into the base.
    if (stem > 4 * ui) {
      // A thin burnished-brass flight rod with a flared ferrule where it meets the oak.
      const sw = Math.max(2.5, 3.5 * ui);
      b.rect(-sw / 2, -stem - 6 * ui, sw, stem + 6 * ui).fill({ color: 0x6a4a1c });
      b.rect(-sw / 2, -stem - 6 * ui, sw * 0.4, stem + 6 * ui).fill({ color: 0xf0c860, alpha: 0.7 });
      b.ellipse(0, -2 * ui, 7 * ui, 2.6 * ui).fill({ color: P.brassDark });
      b.rect(-5 * ui, -6 * ui, 10 * ui, 4 * ui).fill({ color: P.brass });
      b.ellipse(0, -6 * ui, 5 * ui, 1.8 * ui).fill({ color: P.brassHi });
    }
    // Front: the rim (a band between two half-ellipses), then the top's front half over the feet.
    const front = halfEllipse(rx, ry, 0);
    const lower = halfEllipse(rx, ry, rim);
    const back: number[] = [];
    for (let i = lower.length - 2; i >= 0; i -= 2) back.push(lower[i]!, lower[i + 1]!);
    g.ellipse(4 * ui, rim + ry + 4 * ui, rx * 1.05, ry * 1.2).fill({ color: 0x000000, alpha: 0.35 });
    g.poly([...front, ...back]).fill({ color: 0x5a3418 });
    // Lathe rings on the rim.
    for (let k = 1; k <= 3; k++) g.poly(halfEllipse(rx, ry, (rim * k) / 4), false).stroke({ width: 1, color: k === 2 ? 0x2a1608 : 0xc8915a, alpha: 0.4 });
    // The top's front half catching the footlights.
    g.poly([rx, 0, ...front, -rx, 0]).fill({ color: 0xc08850 });
    g.poly([rx, 0, ...halfEllipse(rx * 0.9, ry * 0.55, 0), -rx * 0.9, 0]).fill({ color: 0xe0aa68, alpha: 0.45 });
    const pg = this.pulse;
    pg.clear();
    if (hot) {
      for (let i = 4; i >= 1; i--) pg.ellipse(0, rim / 2, rx + i * 5 * ui, ry + rim / 2 + i * 5 * ui).stroke({ width: 4 * ui, color: P.glow, alpha: 0.18 * (5 - i) });
      g.ellipse(0, 0, rx, ry).stroke({ width: 2.5 * ui, color: P.glow, alpha: 0.95 });
      // Two gold arrows flanking the nameplate, pointing in at it.
      const ppw = Math.min(W - 24 * ui, name.width + 60 * ui);
      const ay = ry + 3 * ui + (rim - 6 * ui) / 2;
      const aw = 10 * ui;
      for (const sx of [-1, 1]) {
        const ax = sx * (ppw / 2 + 5 * ui);
        pg.poly([ax, ay, ax + sx * aw * 1.3, ay - aw, ax + sx * aw * 1.3, ay + aw]).fill({ color: P.glow }).stroke({ width: 1.5 * ui, color: P.brassDark });
      }
    }
    // Poise: brass studs round the front of the top.
    if (u.maxPoise > 0) {
      const n = u.maxPoise;
      for (let i = 0; i < n; i++) {
        const a = Math.PI * (0.18 + (0.64 * (i + 0.5)) / n);
        const x = -Math.cos(a) * rx * 0.86;
        const y = Math.sin(a) * ry * 0.7;
        const r = Math.max(2, 3.2 * ui);
        if (i < u.poise) g.circle(x, y, r).fill({ color: P.brass }).circle(x - r * 0.3, y - r * 0.3, r * 0.4).fill({ color: P.brassHi, alpha: 0.8 });
        else g.circle(x, y, r).fill({ color: 0x2a1608, alpha: 0.8 });
      }
    }
    // The brass plate on the rim: the name, and HP as crimson enamel.
    const pw = Math.min(W - 24 * ui, name.width + 60 * ui);
    const ph = rim - 6 * ui;
    const px = -pw / 2;
    const py = ry + 3 * ui;
    g.roundRect(px + 2 * ui, py + 2 * ui, pw, ph, 3 * ui).fill({ color: 0x000000, alpha: 0.4 });
    g.roundRect(px, py, pw, ph, 3 * ui).fill({ color: P.brass }).stroke({ width: 1, color: P.brassDark });
    g.rect(px + 2, py + 2, pw - 4, ph * 0.35).fill({ color: P.brassHi, alpha: 0.35 });
    for (const sx of [px + 6 * ui, px + pw - 6 * ui]) g.circle(sx, py + ph / 2, 2 * ui).fill({ color: P.brassDark });
    fit(name, pw - (phone ? 14 : 24 * ui));
    name.anchor.set(0.5, 0);
    name.position.set(0, py + (phone ? 1 : 3 * ui));
    this.body.addChild(name);
    const bx = px + 14 * ui;
    const bw = pw - 28 * ui;
    const bh = Math.max(5, Math.round(7 * ui));
    const by = py + ph - bh - (phone ? 2 : 5 * ui);
    g.rect(bx, by, bw, bh).fill({ color: 0x2a0a06 });
    if (this.ghost > this.hp) g.rect(bx, by, bw * this.ghost, bh).fill({ color: 0xe8a090 });
    g.rect(bx, by, bw * Math.max(0, this.hp), bh).fill({ color: 0xb3261e });
    g.rect(bx, by, bw * Math.max(0, this.hp), bh * 0.35).fill({ color: 0xff8a70, alpha: 0.4 });
    if (u.shield > 0) g.rect(bx, by, bw * Math.min(1, u.shield / Math.max(1, u.maxHp)), bh * 0.45).fill({ color: 0x6a9ae0, alpha: 0.9 });
    if (u.broken) {
      const s = txt("BROKEN", { fontFamily: CINZEL, fontWeight: "800", fontSize: Math.round(12 * ui), fill: P.redInk, letterSpacing: 2 * ui });
      s.anchor.set(0.5);
      s.rotation = -0.1;
      s.position.set(0, -ry - 10 * ui);
      this.body.addChild(s);
    }
    // Statuses: wax seals stuck to the side.
    const ss = Math.round(15 * ui);
    u.statuses.slice(0, 4).forEach((st, i) => {
      const style = STATUS_STYLE[st.id];
      const sx = rx - 4 * ui + i * (ss * 0.7);
      const sy = rim * 0.3 - i * ss * 0.55;
      g.circle(sx + 1, sy + 2, ss / 2 + 2 * ui).fill({ color: 0x000000, alpha: 0.3 });
      g.circle(sx, sy, ss / 2 + 2 * ui).fill({ color: 0x8e1c14 });
      g.circle(sx, sy, ss / 2).fill({ color: 0xf4e6c8 });
      drawStatusGlyph(g, style.glyph, sx - ss * 0.34, sy - ss * 0.34, ss * 0.68, style.color);
    });
  }
}

/* ------------------------------ The decor ------------------------------ */

const bboxOf = new WeakMap<object, [number, number, number, number]>();
function alphaBox(img: CanvasImageSource): [number, number, number, number] {
  const hit = bboxOf.get(img as object);
  if (hit) return hit;
  let box: [number, number, number, number] = [0, 0, 1, 1];
  try {
    const iw = (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width;
    const ih = (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height;
    const k = Math.min(1, 160 / Math.max(1, ih));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(iw * k));
    c.height = Math.max(1, Math.round(ih * k));
    const g = c.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(img, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++)
        if (d[(y * c.width + x) * 4 + 3]! > 40) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    if (x1 >= x0) box = [x0 / c.width, y0 / c.height, (x1 - x0 + 1) / c.width, (y1 - y0 + 1) / c.height];
  } catch {
    /* a tainted picture: the whole image */
  }
  bboxOf.set(img as object, box);
  return box;
}

export function decorate(stage: BattleStage): StageDecor {
  const bd = board();
  const staged = bd.staged === "battle";
  const tags = new Map<string, Base>();
  const cuts = new Map<string, DieCut>();
  const menu = stage.menu as TagMenu;
  const strip = stage.timeline as Bunting;
  strip.still = stage.reduced;
  let lastHp = new Map<string, number>();

  const dress = (id: string, v: EnemyView) => {
    let f = cuts.get(id);
    if (!f) {
      f = new DieCut(6);
      cuts.set(id, f);
    }
    if (!v.body.filters || !(v.body.filters as Filter[]).includes(f)) v.body.filters = [...((v.body.filters as Filter[] | null) ?? []), f];
    let t = tags.get(id);
    if (!t) {
      t = new Base();
      tags.set(id, t);
      v.addChild(t);
      // The back half of the plinth goes under the figure.
      v.addChildAt(t.behind, v.getChildIndex(v.body));
    }
    return { f, t };
  };

  const onKey = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
    if (!stage.app.canvas.isConnected) return;
    if (/^[1-9]$/.test(e.key)) {
      const i = Number(e.key) - 1;
      if (menu.modeKind === "skills") {
        if (menu.pickIndex(i)) e.preventDefault();
      } else if (menu.modeKind === "target") {
        const foes = [...stage.enemies.entries()].filter(([, v]) => v.visible && priv(v).targetable);
        const pick = foes[i];
        if (pick) {
          e.preventDefault();
          (stage as unknown as { tapTarget(id: string): void }).tapTarget(pick[0]);
        }
      }
    } else if (e.key === "Escape" && menu.modeKind === "target") {
      e.preventDefault();
      menu.onBack();
    } else if (e.key === "Enter" && menu.canConfirm) {
      e.preventDefault();
      menu.onConfirm();
    }
  };
  addEventListener("keydown", onKey);

  return {
    resize(_w, _h, layout) {
      for (const f of cuts.values()) f.radius = Math.max(4, 6 * layout.ui);
    },
    event(ev) {
      if (ev.kind === "hit" && ev.amount > 0) {
        const now = performance.now() / 1000;
        bd.shake = now;
        const m = bd.enemies.find((x) => x.id === ev.target);
        if (m) m.hitAt = now;
      }
    },
    update(now) {
      const W = stage.layout.w;
      const H = stage.layout.h;
      const ui = stage.layout.ui;
      menu.tick?.(now);
      const marks: EnemyMark[] = [];
      for (const [id, v] of stage.enemies) {
        const u = stage.units.get(id);
        const { t } = dress(id, v);
        const p = priv(v);
        p.plate.renderable = false;
        const slot = v.slot;
        const sy = slot.floorY - slot.y;
        t.position.set(0, sy);
        t.behind.position.set(0, sy);
        t.visible = t.behind.visible = !!u?.alive && v.visible;
        if (u) {
          const r = v.figure.mesh.texture?.source?.resource as CanvasImageSource | undefined;
          const ok = r && (r instanceof HTMLCanvasElement || r instanceof HTMLImageElement || (typeof ImageBitmap !== "undefined" && r instanceof ImageBitmap));
          const bb = ok ? alphaBox(r) : null;
          const stem = bb ? Math.max(0, 1 - bb[1] - bb[3]) * slot.height * v.body.scale.y : 0;
          t.draw(u, stage.layout.portrait ? ui * 0.72 : ui, p.targetable, now, slot.height * 0.45, stem, stage.reduced);
          const prev = lastHp.get(id);
          if (prev !== undefined && u.hp < prev) bd.shake = performance.now() / 1000;
          lastHp.set(id, u.hp);
        }
        const res = v.figure.mesh.texture?.source?.resource as CanvasImageSource | undefined;
        const image = res && (res instanceof HTMLCanvasElement || res instanceof HTMLImageElement || (typeof ImageBitmap !== "undefined" && res instanceof ImageBitmap)) ? res : null;
        const old = bd.enemies.find((m) => m.id === id);
        marks.push({
          id,
          x: v.x / W,
          y: slot.floorY / H,
          h: (slot.height * v.body.scale.y) / H,
          dx: v.body.x / W,
          dy: v.body.y / H,
          alive: !!u?.alive && v.visible,
          alpha: v.alpha * v.figure.alpha,
          image,
          bbox: image ? alphaBox(image) : [0, 0, 1, 1],
          hot: p.targetable,
          active: p.marker.visible,
          hitAt: old?.hitAt ?? 0,
        });
      }
      if (staged) {
        bd.enemies = marks;
        bd.enemyVer++;
      }
      void lastHp;
    },
    destroy() {
      removeEventListener("keydown", onKey);
      if (bd.enemies.length) bd.enemies = [];
      for (const f of cuts.values()) f.destroy();
      lastHp = new Map();
    },
  };
}
