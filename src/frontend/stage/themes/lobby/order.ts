/**
 * The Lobby battle's turn order: pocket-watch lockets hanging on short chains from a brass rod along the top,
 * the one acting now the largest, on a sunburst, its name engraved beneath; enemies in crimson enamel, the party
 * in sea-green. The faces are the stage's own timeline chips, copied into the lockets.
 */
import type { Texture } from "pixi.js";
import { TimelineStrip } from "../../battle/timeline-strip.js";
import type { Rect } from "../../battle/layout.js";
import { orderLocket, orderRail } from "./art.js";
import { currentGeom } from "./state.js";

type Entry = { id: string; texture: Texture; enemy: boolean; alive: boolean };

const urls = new Map<string, string>();

/** A chip texture as a data URL (cached by its source and frame). */
function chipUrl(t: Texture): string | null {
  const src = t.source as unknown as { uid: number; resource?: CanvasImageSource };
  const fr = t.frame;
  const key = `${src.uid}:${fr.x},${fr.y},${fr.width},${fr.height}`;
  const hit = urls.get(key);
  if (hit) return hit;
  const res = src.resource;
  if (!res) return null;
  try {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    c.getContext("2d")!.drawImage(res, fr.x, fr.y, fr.width, fr.height, 0, 0, 128, 128);
    const url = c.toDataURL("image/jpeg", 0.85);
    if (urls.size > 200) urls.clear();
    urls.set(key, url);
    return url;
  } catch {
    return null;
  }
}

export class LobbyOrder extends TimelineStrip {
  readonly el: HTMLDivElement;
  /** Names for the lockets (set by the HUD from the stage's units). */
  nameOf: (id: string) => string = (id) => id;
  private order: Entry[] = [];

  constructor() {
    super();
    this.el = document.createElement("div");
    this.el.className = "bb-order";
    this.el.setAttribute("role", "list");
    this.el.setAttribute("aria-label", "Turn order");
  }

  override place(rect: Rect, ui: number): void {
    this.rect = rect;
    this.ui = ui;
    this.position.set(rect.x, rect.y);
    this.bg.clear();
    this.title.visible = false;
    Object.assign(this.el.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` });
    this.render();
  }

  override set(order: Entry[]): void {
    this.order = order;
    this.render();
  }

  override update(): void {}

  private render(): void {
    const el = this.el;
    if (!el) return;
    const g = currentGeom();
    const u = g?.u ?? 1;
    const portrait = g?.portrait ?? false;
    const W = this.rect.w / u;
    const H = this.rect.h / u;
    const railY = portrait ? 6 : 14;
    const big = portrait ? 46 : 112;
    const small = portrait ? 36 : 74;
    const gap = portrait ? 5 : 16;
    const n = this.order.length;
    const need = big + (n - 1) * (small + gap) + gap + 24;
    const fit = Math.min(1, W / Math.max(1, need));
    let x = 16 * fit;
    const hooks: Array<{ x: number; y: number }> = [];
    const items: string[] = [];
    this.order.forEach((o, i) => {
      const s = (i === 0 ? big : small) * fit;
      const drop = portrait ? (i === 0 ? 2 : 4) : i === 0 ? 6 : i % 2 ? 22 : 36;
      const top = railY + drop;
      hooks.push({ x: x + s / 2, y: top + 2 });
      const name = this.nameOf(o.id);
      items.push(`<div class="lk${i === 0 ? " now" : ""}${o.enemy ? " foe" : ""}" role="listitem" title="${i === 0 ? "Acting now: " : ""}${name}" style="left:${(x * u).toFixed(1)}px;top:${(top * u).toFixed(1)}px;width:${(s * u).toFixed(1)}px;height:${(s * 1.18 * u).toFixed(1)}px">${orderLocket(chipUrl(o.texture), o.enemy, i === 0, !o.alive)}${i === 0 && !portrait ? `<b>${name}</b>` : ""}</div>`);
      x += s + gap * fit;
    });
    const railW = Math.min(W, x + 10);
    el.innerHTML = `<div class="rl" style="width:${(railW * u).toFixed(1)}px;height:${(H * u).toFixed(1)}px">${orderRail(railW, H, hooks, railY)}</div>${items.join("")}`;
  }
}
