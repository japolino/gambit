/**
 * The turn order as a chalk score on the room's hanging slate. The battle
 * chalks it into a canvas; when the fight is staged in the 3D room
 * (scene/themes/table/duel.ts) the room hangs that canvas on its own slate,
 * lit by its candles. Without the room (no WebGL), or on a phone where the
 * slate hangs out of sight, the same chalk is drawn here: a slate in a wooden
 * frame top right, or a narrow slate strip along the top of a phone.
 *
 * Who acts now is circled and arrowed; enemies are in red chalk, your side in
 * white; each line carries that fighter's HP as a chalk tally.
 */
import { Graphics, Sprite, Texture } from "pixi.js";
import { TimelineStrip } from "../../battle/timeline-strip.js";
import type { Rect } from "../../battle/layout.js";
import type { DisplayUnit } from "../../battle/display.js";
import { duel } from "../../../scene/themes/table/duel.js";
import { rng } from "../../../scene/themes/contract.js";
import { slateImage } from "./cards.js";

type Entry = { id: string; enemy: boolean; alive: boolean };

const CHALK = "#f2efe9";
const RED_CHALK = "#ff8a76";

/** Chalk on its own layer, eroded by speckle, then laid on the slate. */
function chalk(g: CanvasRenderingContext2D, draw: (l: CanvasRenderingContext2D) => void, seed: number): void {
  const c = document.createElement("canvas");
  c.width = g.canvas.width;
  c.height = g.canvas.height;
  const l = c.getContext("2d")!;
  l.textBaseline = "alphabetic";
  draw(l);
  l.globalAlpha = 0.4;
  l.translate(1.4, 1);
  draw(l);
  l.setTransform(1, 0, 0, 1, 0, 0);
  l.globalAlpha = 1;
  l.globalCompositeOperation = "destination-out";
  const r = rng(seed);
  const n = Math.round((c.width * c.height) / 48);
  for (let i = 0; i < n; i++) {
    l.fillStyle = `rgba(0,0,0,${0.3 + r() * 0.7})`;
    l.fillRect(r() * c.width, r() * c.height, 1 + r() * 2.2, 0.8 + r() * 1.2);
  }
  g.drawImage(c, 0, 0);
}

export class TableSlate extends TimelineStrip {
  /** The fight's units, for names and HP (set by the theme). */
  units: () => Map<string, DisplayUnit> = () => new Map();
  /** Draw the slate here (true) or hand it to the room (false). */
  local = true;
  portrait = false;
  readonly tall = document.createElement("canvas");
  readonly strip = document.createElement("canvas");
  private sprite = new Sprite();
  private frameG = new Graphics();
  private tallTex: Texture;
  private stripTex: Texture;
  private order: Entry[] = [];
  private sig = "";

  constructor() {
    super();
    this.removeChildren();
    this.tall.width = 600;
    this.tall.height = 720;
    this.strip.width = 1400;
    this.strip.height = 110;
    this.tallTex = Texture.from(this.tall);
    this.stripTex = Texture.from(this.strip);
    this.addChild(this.frameG, this.sprite);
    slateImage(() => this.redraw(true));
  }

  override place(rect: Rect, ui: number): void {
    this.rect = rect;
    this.ui = ui;
    this.position.set(rect.x, rect.y);
    this.redraw(true);
  }

  override set(order: Array<{ id: string; enemy: boolean; alive: boolean }>): void {
    this.order = order.map((o) => ({ id: o.id, enemy: o.enemy, alive: o.alive }));
    this.redraw();
  }

  override update(): void {}

  /** Redraw when the order or anyone's HP changed (cheap to call every frame). */
  redraw(force = false): void {
    const units = this.units();
    const sig = JSON.stringify([this.local, this.portrait, this.order.map((o) => o.id), [...units.values()].map((u) => [u.hp, u.alive])]);
    if (!force && sig === this.sig) return;
    this.sig = sig;
    this.drawTall(units);
    const r = this.rect;
    const g = this.frameG;
    g.clear();
    if (!this.local) {
      // The room hangs it on its slate.
      this.sprite.visible = false;
      duel.slate = this.tall;
      duel.slateVersion++;
      return;
    }
    this.sprite.visible = true;
    if (this.portrait) {
      this.drawStrip(units);
      this.stripTex.source.update();
      this.sprite.texture = this.stripTex;
      this.sprite.position.set(0, 0);
      this.sprite.width = r.w;
      this.sprite.height = r.h;
      g.rect(-4, -4, r.w + 8, r.h + 8).fill({ color: 0x3a2014 }).stroke({ width: 2, color: 0x0a0505 });
      g.rect(-1, -1, r.w + 2, r.h + 2).stroke({ width: 1, color: 0x8a5a3a });
      return;
    }
    this.tallTex.source.update();
    this.sprite.texture = this.tallTex;
    const fw = Math.max(6, r.w * 0.05);
    this.sprite.position.set(0, 0);
    this.sprite.width = r.w;
    this.sprite.height = r.h;
    // Chains up into the dark, a walnut frame with brass corners.
    for (const x of [r.w * 0.18, r.w * 0.82]) {
      for (let y = -r.y; y < 0; y += 9) g.roundRect(x - 3, y, 6, 11, 3).stroke({ width: 2, color: 0x4a4a52 });
    }
    g.rect(-fw, -fw, r.w + fw * 2, r.h + fw * 2).fill({ color: 0x4a2414 }).stroke({ width: 3, color: 0x0a0505 });
    g.rect(-fw * 0.4, -fw * 0.4, r.w + fw * 0.8, r.h + fw * 0.8).stroke({ width: 1.5, color: 0x9a6a3a, alpha: 0.6 });
    for (const [x, y] of [[-fw, -fw], [r.w, -fw], [-fw, r.h], [r.w, r.h]] as const) g.rect(x, y, fw, fw).fill({ color: 0xd8a040 }).stroke({ width: 1.5, color: 0x2a1404 });
  }

  private paintSlate(g: CanvasRenderingContext2D, w: number, h: number): void {
    const img = slateImage(() => this.redraw(true));
    g.clearRect(0, 0, w, h);
    if (img.complete && img.naturalWidth) g.drawImage(img, 0, 0, w, h);
    else {
      g.fillStyle = "#16181b";
      g.fillRect(0, 0, w, h);
    }
  }

  private nameOf(id: string, units: Map<string, DisplayUnit>): string {
    return units.get(id)?.name ?? id;
  }

  /** The tall slate (600 x 720): a brass plate, then the next turns, one a line, with HP. */
  private drawTall(units: Map<string, DisplayUnit>): void {
    const c = this.tall;
    const g = c.getContext("2d")!;
    this.paintSlate(g, c.width, c.height);
    const plate = g.createLinearGradient(0, 30, 0, 100);
    plate.addColorStop(0, "#ffe6a0");
    plate.addColorStop(0.5, "#c08a30");
    plate.addColorStop(1, "#5a3608");
    g.fillStyle = plate;
    g.fillRect(40, 28, 520, 76);
    g.strokeStyle = "#1a0e02";
    g.lineWidth = 4;
    g.strokeRect(40, 28, 520, 76);
    g.fillStyle = "#1e1004";
    g.textAlign = "center";
    g.font = `800 42px "Gambit Cinzel", serif`;
    g.fillText("THE DUEL", 300, 82);
    const rows = this.order.slice(0, 6);
    chalk(
      g,
      (l) => {
        l.lineCap = "round";
        rows.forEach((o, i) => {
          const y = 196 + i * 88 - (i ? 0 : 8);
          const u = units.get(o.id);
          const col = o.enemy ? RED_CHALK : CHALK;
          l.fillStyle = col;
          l.strokeStyle = col;
          l.textAlign = "left";
          const nm = this.nameOf(o.id, units);
          let size = i === 0 ? 70 : 56;
          l.font = `${i === 0 ? 800 : 600} ${size}px "Gambit Fell", serif`;
          while (l.measureText(nm).width > (i === 0 ? 320 : 330) && size > 22) l.font = `${i === 0 ? 800 : 600} ${(size -= 2)}px "Gambit Fell", serif`;
          l.globalAlpha = o.alive ? 1 : 0.4;
          l.fillText(nm, i === 0 ? 110 : 88, y);
          if (!o.alive) {
            l.lineWidth = 4;
            l.beginPath();
            l.moveTo(84, y - 12);
            l.lineTo(440, y - 16);
            l.stroke();
          }
          l.globalAlpha = 1;
          // The order number, or the arrow for who acts now.
          l.textAlign = "center";
          l.font = `700 40px "Gambit Cinzel", serif`;
          if (i === 0) {
            l.lineWidth = 6;
            l.beginPath();
            l.moveTo(36, y - 16);
            l.lineTo(86, y - 16);
            l.moveTo(70, y - 32);
            l.lineTo(88, y - 16);
            l.lineTo(70, y);
            l.stroke();
            l.lineWidth = 4;
            l.beginPath();
            l.ellipse(280, y - 16, 270, 40, -0.02, 0, Math.PI * 2);
            l.stroke();
          } else if (o.enemy) skull(l, 50, y - 18, 17);
          else sword(l, 50, y - 18, 22);
          // HP as a number and a chalk tally bar.
          if (u) {
            l.textAlign = "right";
            l.font = `700 ${i === 0 ? 68 : 54}px "Gambit Fell", serif`;
            l.fillText(String(Math.max(0, Math.round(u.hp))), 560, y);
            const f = Math.max(0, u.hp) / Math.max(1, u.maxHp);
            l.lineWidth = 5;
            l.globalAlpha = 0.9;
            l.beginPath();
            const x0 = i === 0 ? 110 : 88;
            l.moveTo(x0, y + 14);
            l.lineTo(x0 + 330 * f, y + 13);
            l.stroke();
            l.globalAlpha = 1;
          }
        });
        if (!rows.length) {
          l.fillStyle = CHALK;
          l.textAlign = "center";
          l.font = `600 44px "Gambit Fell", serif`;
          l.fillText("The cards are down.", 300, 360);
        }
      },
      911,
    );
  }

  /** The phone's strip (1400 x 110): NOW, then the queue. */
  /**
   * The strip, drawn at its size on screen (three canvas pixels to one) so its text is real px: whoever's up, ringed,
   * then as many of the next as fit whole at a readable size. Names are never squeezed; the rest wait their turn.
   */
  private drawStrip(units: Map<string, DisplayUnit>): void {
    const c = this.strip;
    const S = 3;
    const pxW = Math.max(120, Math.round(this.rect.w));
    const pxH = Math.max(24, Math.round(this.rect.h));
    if (c.width !== pxW * S || c.height !== pxH * S) {
      c.width = pxW * S;
      c.height = pxH * S;
      this.stripTex.source.resize(c.width, c.height, 1);
    }
    const g = c.getContext("2d")!;
    this.paintSlate(g, c.width, c.height);
    chalk(
      g,
      (l) => {
        l.textAlign = "left";
        l.textBaseline = "middle";
        const mid = c.height / 2;
        let x = 10 * S;
        const right = c.width - 6 * S;
        for (let i = 0; i < Math.min(6, this.order.length); i++) {
          const o = this.order[i]!;
          const nm = this.nameOf(o.id, units);
          l.font = `${i ? 600 : 800} ${(i ? 14 : 15) * S}px "Gambit Fell", serif`;
          const w = l.measureText(nm).width;
          const arrow = i ? 16 * S : 0;
          if (i && x + arrow + w > right) break;
          if (i) {
            l.fillStyle = CHALK;
            l.fillText("›", x + 4 * S, mid);
            x += arrow;
            l.font = `600 ${14 * S}px "Gambit Fell", serif`;
          }
          l.fillStyle = l.strokeStyle = o.enemy ? RED_CHALK : CHALK;
          l.globalAlpha = o.alive ? 1 : 0.45;
          l.fillText(nm, x, mid, right - x);
          l.globalAlpha = 1;
          if (i === 0) {
            l.lineWidth = 1.5 * S;
            l.beginPath();
            l.ellipse(x + w / 2, mid, w / 2 + 6 * S, pxH * S * 0.42, 0, 0, Math.PI * 2);
            l.stroke();
            x += 6 * S;
          }
          x += w;
        }
      },
      912,
    );
  }
}

/** A chalk skull: theirs. */
function skull(l: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  l.beginPath();
  l.arc(x, y - r * 0.15, r, Math.PI * 0.85, Math.PI * 2.15);
  l.lineTo(x + r * 0.6, y + r * 0.95);
  l.lineTo(x - r * 0.6, y + r * 0.95);
  l.closePath();
  l.fill();
  const op = l.globalCompositeOperation;
  l.globalCompositeOperation = "destination-out";
  l.beginPath();
  l.arc(x - r * 0.4, y - r * 0.1, r * 0.27, 0, Math.PI * 2);
  l.arc(x + r * 0.4, y - r * 0.1, r * 0.27, 0, Math.PI * 2);
  l.fill();
  l.fillRect(x - r * 0.08, y + r * 0.55, r * 0.16, r * 0.45);
  l.fillRect(x - r * 0.38, y + r * 0.62, r * 0.12, r * 0.4);
  l.fillRect(x + r * 0.26, y + r * 0.62, r * 0.12, r * 0.4);
  l.globalCompositeOperation = op;
}

/** A chalk sword: yours. */
function sword(l: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  l.lineWidth = 5;
  l.beginPath();
  l.moveTo(x - r * 0.75, y + r * 0.75);
  l.lineTo(x + r * 0.85, y - r * 0.85);
  l.moveTo(x - r * 0.62, y + r * 0.12);
  l.lineTo(x - r * 0.12, y + r * 0.62);
  l.stroke();
  l.beginPath();
  l.arc(x - r * 0.85, y + r * 0.85, r * 0.16, 0, Math.PI * 2);
  l.fill();
}
