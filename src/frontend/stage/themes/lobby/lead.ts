/**
 * The lobby's lead, in the fight: the party member whose turn it is stands tall left of centre, as the hall's
 * lead stands in the scene, in a pool of warm window light with the open astrolabe halo turning behind their head.
 * The party cards (DOM, above the canvas) cover their legs. Drawn in Pixi behind the enemies; the halo is the
 * scene's own SVG rasterised once, the light shafts and the glow are canvas gradients.
 */
import { Container, Sprite, Texture } from "pixi.js";
import type { BattleStage } from "../../battle/stage.js";
import { PuppetFigure } from "../../puppet/puppet-figure.js";
import { defs as lobbyDefs, halo } from "../../../scene/themes/lobby/art.js";
import type { LobbyGeom } from "./geom.js";

/** Rasterise an SVG drawing (with the lobby's material library) into a texture. */
export async function svgTexture(markup: string, vbW: number, vbH: number, pxW: number, pxH: number): Promise<Texture | null> {
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${pxW}" height="${pxH}" viewBox="0 0 ${vbW} ${vbH}">${lobbyDefs()}${markup}</svg>`;
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(doc)}`;
  try {
    await img.decode();
    const c = document.createElement("canvas");
    c.width = pxW;
    c.height = pxH;
    c.getContext("2d")!.drawImage(img, 0, 0, pxW, pxH);
    return Texture.from(c);
  } catch {
    return null;
  }
}

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): Texture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  return Texture.from(c);
}

/** Warm light falling from the upper left, blurred shafts (additive). */
function raysTexture(): Texture {
  return canvasTex(512, 512, (g) => {
    g.filter = "blur(14px)";
    const shaft = (x0: number, x1: number, x2: number, x3: number, a: number) => {
      const gr = g.createLinearGradient(0, 0, 360, 512);
      gr.addColorStop(0, `rgba(255,226,170,${a})`);
      gr.addColorStop(0.6, `rgba(255,206,140,${a * 0.35})`);
      gr.addColorStop(1, "rgba(255,206,140,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x0, -20);
      g.lineTo(x1, -20);
      g.lineTo(x2, 540);
      g.lineTo(x3, 540);
      g.closePath();
      g.fill();
    };
    shaft(40, 90, 330, 230, 0.5);
    shaft(120, 150, 400, 340, 0.35);
    shaft(-10, 20, 170, 110, 0.4);
    shaft(180, 196, 480, 450, 0.22);
  });
}

function glowTexture(): Texture {
  return canvasTex(256, 256, (g) => {
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, "rgba(255,214,150,.55)");
    gr.addColorStop(0.5, "rgba(255,190,110,.16)");
    gr.addColorStop(1, "rgba(255,190,110,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
  });
}

/** A soft oval with a faded foot: how an opaque portrait melts into the hall. */
function featherTexture(): Texture {
  return canvasTex(256, 256, (g) => {
    g.save();
    g.translate(128, 112);
    g.scale(1, 1.2);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 120);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.58, "rgba(255,255,255,1)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(-140, -120, 280, 260);
    g.restore();
    g.globalCompositeOperation = "destination-in";
    const lg = g.createLinearGradient(0, 0, 0, 256);
    lg.addColorStop(0, "rgba(255,255,255,1)");
    lg.addColorStop(0.62, "rgba(255,255,255,1)");
    lg.addColorStop(0.96, "rgba(255,255,255,0)");
    g.fillStyle = lg;
    g.fillRect(0, 0, 256, 256);
  });
}

/** Solid down to the waist, then fading out (a cut-out lead's mask). */
function waistTexture(): Texture {
  return canvasTex(4, 256, (g) => {
    const lg = g.createLinearGradient(0, 0, 0, 256);
    lg.addColorStop(0, "rgba(255,255,255,1)");
    lg.addColorStop(0.44, "rgba(255,255,255,1)");
    lg.addColorStop(0.72, "rgba(255,255,255,0)");
    g.fillStyle = lg;
    g.fillRect(0, 0, 4, 256);
  });
}

export class Lead {
  readonly root = new Container();
  private readonly glow = new Sprite();
  private readonly haloS = new Sprite();
  private readonly rays = new Sprite();
  private readonly figs = new Container();
  private fig: PuppetFigure | null = null;
  private id: string | null = null;
  /** The card bust the lead was made from (art arriving swaps it). */
  private from: unknown = null;
  private geom: LobbyGeom | null = null;
  private fade = 1;
  private leaving: PuppetFigure[] = [];

  constructor(private readonly stage: BattleStage) {
    const app = stage.app.stage;
    app.addChildAt(this.root, app.getChildIndex(stage.field));
    this.glow.texture = glowTexture();
    this.glow.anchor.set(0.5);
    this.glow.blendMode = "add";
    this.haloS.anchor.set(0.5);
    this.haloS.alpha = 0.85;
    this.rays.texture = raysTexture();
    this.rays.blendMode = "add";
    this.rays.alpha = 0.55;
    this.root.addChild(this.glow, this.haloS, this.figs, this.rays);
    void svgTexture(halo(), 480, 480, 768, 768).then((t) => {
      if (t && !this.root.destroyed) {
        this.haloS.texture = t;
        this.place();
      }
    });
  }

  /** Who stands now (a party member's id). */
  setActor(id: string | null): void {
    if (!id || id === this.id) return;
    const u = this.stage.units.get(id);
    if (!u || u.side !== "party") return;
    this.id = id;
    this.build();
  }

  private build(): void {
    const id = this.id;
    const u = id ? this.stage.units.get(id) : undefined;
    if (!id || !u) return;
    const pick = this.stage.art.pick(this.stage.artRequest(u));
    this.from = this.stage.cards.get(id)?.bust ?? null;
    const fig = new PuppetFigure({ source: pick.source, kind: "standing", key: `${id}:lead`, strength: this.stage.reduced ? 0 : 1, framed: !pick.cutout });
    if (fig.framed) {
      for (const c of fig.children) if (c !== fig.mesh) c.visible = false;
      const m = new Sprite(featherTexture());
      m.width = fig.imageW;
      m.height = fig.imageH;
      m.position.set(-fig.imageW / 2, -fig.imageH);
      fig.addChild(m);
      fig.mesh.mask = m;
    } else if (!fig.mesh.mask) {
      // A cut-out stands to the waist: below that it fades out above the party cards instead of being cut by them.
      const m = new Sprite(waistTexture());
      m.width = fig.imageW;
      m.height = fig.imageH;
      m.position.set(-fig.imageW / 2, -fig.imageH);
      fig.addChild(m);
      fig.mesh.mask = m;
    }
    if (this.fig) this.leaving.push(this.fig);
    this.fig = fig;
    this.figs.addChild(fig);
    this.fade = this.stage.reduced ? 1 : 0;
    fig.alpha = this.fade;
    this.place();
  }

  layout(g: LobbyGeom): void {
    this.geom = g;
    this.root.visible = !!g.lead;
    this.place();
  }

  private place(): void {
    const g = this.geom;
    const fig = this.fig;
    if (!g?.lead) return;
    const L = g.lead;
    this.rays.position.set(-g.u * 80, 0);
    this.rays.width = L.x + 700 * g.u;
    this.rays.height = g.h;
    if (!fig) return;
    let k: number;
    if (fig.framed) {
      // An opaque portrait: big, its shoulders sinking behind the cards.
      k = (L.height * 0.86) / fig.imageH;
      fig.position.set(L.x, L.bottom - 40 * g.u);
    } else {
      k = L.height / Math.max(1, fig.figurePixelHeight);
      fig.position.set(L.x, L.bottom);
    }
    fig.scale.set(k);
    const face = fig.faceLocal;
    const fx = fig.x + face.x * k;
    const fy = fig.y + face.y * k;
    const hs = 600 * g.u;
    this.haloS.width = hs;
    this.haloS.height = hs;
    this.haloS.position.set(fx, fy + 40 * g.u);
    this.glow.width = 1100 * g.u;
    this.glow.height = 1000 * g.u;
    this.glow.position.set(fx, fy + 120 * g.u);
  }

  update(now: number, dt: number): void {
    if (!this.root.visible) return;
    const reduced = this.stage.reduced;
    // The card's bust changed (its art arrived): rebuild the lead from it.
    if (this.id && (this.stage.cards.get(this.id)?.bust ?? null) !== this.from) this.build();
    if (!reduced) this.haloS.rotation += dt * 0.025;
    if (this.fade < 1) {
      this.fade = Math.min(1, this.fade + dt / 0.35);
      if (this.fig) this.fig.alpha = this.fade;
      for (const o of this.leaving) o.alpha = Math.min(o.alpha, 1 - this.fade);
    }
    if (this.fade >= 1 && this.leaving.length) {
      for (const o of this.leaving.splice(0)) o.destroy({ children: true });
    }
    const fig = this.fig;
    if (fig) {
      fig.strength = reduced ? 0 : 1;
      fig.update(now, dt);
      const u = this.id ? this.stage.units.get(this.id) : undefined;
      fig.setGray(u && !u.alive ? 0.85 : 0);
    }
    this.rays.alpha = reduced ? 0.5 : 0.48 + Math.sin(now * 0.7) * 0.07;
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}

/**
 * The hall's shadow over the painting: dark margins and a dark floor, drawn in the canvas just above the backdrop
 * and the lead (so the lead sinks into shadow at the foot) but below the enemies and the party cards, whose
 * portraits stay clear. Stretched to the screen; the gradients are proportional, as the CSS ones were.
 */
export function hallShade(stage: BattleStage): Sprite {
  const W = 512;
  const H = 288;
  const tex = canvasTex(W, H, (g) => {
    const lin = (x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) => {
      const gr = g.createLinearGradient(x0, y0, x1, y1);
      for (const [o, c] of stops) gr.addColorStop(o, c);
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
    };
    lin(0, 0, W, 0, [[0, "rgba(8,6,4,.88)"], [0.09, "rgba(8,6,4,.3)"], [0.2, "rgba(8,6,4,0)"]]);
    lin(W, 0, 0, 0, [[0, "rgba(8,6,4,.7)"], [0.12, "rgba(8,6,4,0)"]]);
    lin(0, H, 0, 0, [[0, "rgba(6,5,4,.96)"], [0.18, "rgba(6,5,4,.7)"], [0.44, "rgba(6,5,4,0)"]]);
    lin(0, 0, 0, H, [[0, "rgba(6,5,4,.85)"], [0.18, "rgba(6,5,4,0)"]]);
    g.save();
    g.translate(W / 2, H * 0.42);
    g.scale(1, (H * 0.85) / (W * 0.75));
    const r = W * 0.75;
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
    gr.addColorStop(0.52, "rgba(0,0,0,0)");
    gr.addColorStop(1, "rgba(0,0,0,.55)");
    g.fillStyle = gr;
    g.fillRect(-W, -H * 2, W * 2, H * 4);
    g.restore();
  });
  const s = new Sprite(tex);
  const app = stage.app.stage;
  app.addChildAt(s, app.getChildIndex(stage.field));
  return s;
}
