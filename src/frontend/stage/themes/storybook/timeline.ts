/**
 * Storybook battle: the order of turns is the chapter header. The one acting now looks out of a brass
 * astrolabe (where the scene shows the time of day); the next turns are heraldic crests along a parchment
 * scroll (a round gilt shield on a royal-blue ribbon for the party, a pointed iron one on a crimson swallowtail
 * for the foes), the next to act a size larger and set lower, sliding along as the order changes.
 */
import { Container, Graphics, Sprite, Text, TextStyle, type Texture } from "pixi.js";
import type { Rect } from "../../battle/layout.js";
import { TimelineStrip } from "../../battle/timeline-strip.js";
import { CINZEL } from "../shared.js";
import { CREST, bezel, crest, scrollBand, scrollEnd } from "./art.js";
import { GEO } from "./layout.js";
import { ArtSprite } from "./sprite.js";

type Coin = { key: string; c: Container; face: Sprite; mask: Graphics; ring: ArtSprite; x: number; target: number; size: number };

export class BookTimeline extends TimelineStrip {
  private band = new ArtSprite("scroll-band", scrollBand);
  private end = new ArtSprite("scroll-end", scrollEnd);
  private coins: Coin[] = [];
  /** The scroll's parchment, there before its picture is: the title on it is dark ink. */
  private flat = new Graphics();
  private kicker = new Text({ text: "ORDER OF TURNS", style: new TextStyle({ fontFamily: CINZEL, fontWeight: "700", fontSize: 11, fill: 0x7a3b16, letterSpacing: 2.4 }) });
  private layer = new Container();
  private nowLayer = new Container();

  constructor() {
    super();
    this.removeChildren();
    this.addChild(this.flat, this.band, this.end, this.kicker, this.layer, this.nowLayer);
  }

  override place(rect: Rect, ui: number): void {
    this.rect = rect;
    this.ui = ui;
    this.position.set(rect.x, rect.y);
    const h = rect.h;
    const bh = h * 0.8;
    const ks = Math.max(11, Math.round(bh * 0.13));
    this.kicker.style = new TextStyle({ fontFamily: CINZEL, fontWeight: "800", fontSize: ks, fill: 0x6a2f10, letterSpacing: ks * 0.2 });
    // On the scroll's top rule, clear of the crests that hang under it.
    this.kicker.position.set(h * 0.7 + h * 0.42, (h - bh) / 2 + bh * 0.12);
    // On a phone the strip is for the faces: no title over them.
    this.kicker.visible = rect.w > 300 && !GEO.compact;
    this.fit(rect.w);
  }

  /** The scroll's length: to the last coin (or the whole strip). */
  private fit(len: number): void {
    const h = this.rect.h;
    const bh = h * 0.8;
    const bx = h * 0.7;
    const ew = (bh * 1.2 * 40) / 110;
    const w = Math.max(this.kicker.visible ? this.kicker.x + this.kicker.width + 20 : 0, Math.min(this.rect.w, len)) ;
    this.band.draw(Math.max(10, w - bx - ew * 0.5), bh);
    this.band.position.set(bx, (h - bh) / 2);
    this.flat.clear();
    if (!GEO.compact) this.flat.roundRect(bx, (h - bh) / 2 + bh * 0.07, Math.max(10, w - bx - ew * 0.5), bh * 0.86, 3).fill({ color: 0xe6d3ab }).stroke({ width: 1, color: 0x8a5a2a });
    this.end.draw(ew, bh * 1.2);
    this.end.position.set(w - ew, (h - bh * 1.2) / 2);
  }

  override set(order: Array<{ id: string; texture: Texture; enemy: boolean; alive: boolean }>): void {
    const h = this.rect.h;
    const big = h;
    const bh = h * 0.8;
    const small = Math.round(bh * (GEO.compact ? 0.86 : this.kicker.visible ? 0.55 : 0.78));
    const gap = Math.round(small * 0.12);
    const start = h * 0.7 + h * 0.42;
    const room = this.rect.w - start - (bh * 1.2 * 40) / 110;
    const k = Math.min(1, room / Math.max(1, (order.length - 1) * (small * 0.8 + gap)));
    const old = this.coins;
    const next: Coin[] = [];
    let x = start;
    order.forEach((o, i) => {
      const now = i === 0;
      const size = now ? big : Math.max(8, Math.round(small * k * (i === 1 && !GEO.compact ? 1.15 : 1)));
      const key = `${o.id}#${order.slice(0, i).filter((p) => p.id === o.id).length}`;
      let coin = old.find((c) => c.key === key);
      if (coin) old.splice(old.indexOf(coin), 1);
      else {
        const c = new Container();
        const face = new Sprite(o.texture);
        const mask = new Graphics();
        const ring = new ArtSprite("bezel", () => bezel("ally"));
        const tail = new Graphics();
        tail.label = "tail";
        const glow = new Graphics();
        glow.label = "glow";
        glow.blendMode = "add";
        c.addChild(glow, tail, face, mask, ring);
        face.mask = mask;
        c.alpha = 0;
        coin = { key, c, face, mask, ring, x: now ? 0 : x + 30 * this.ui, target: x, size };
      }
      (now ? this.nowLayer : this.layer).addChild(coin.c);
      coin.face.texture = o.texture;
      coin.size = size;
      const kind = now ? "now" : o.enemy ? "enemy" : "ally";
      const t = o.texture;
      // The crest is 4:5; its face window is the shield's inner field.
      const cw = now ? size : Math.round(size * 0.8);
      coin.ring.draw(cw, size, `crest-${kind}`, () => (kind === "now" ? bezel("now") : crest(kind)));
      if (now) {
        const r = size * 0.35;
        coin.mask.clear().circle(size / 2, size / 2, r).fill({ color: 0xffffff });
        coin.mask.scale.set(1);
        coin.mask.position.set(0, 0);
        const s = (r * 2.1) / Math.max(1, Math.min(t.width, t.height));
        coin.face.scale.set(s);
        coin.face.position.set(size / 2 - (t.width * s) / 2, size / 2 - (t.height * s) / 2);
      } else {
        const k = size / 100;
        coin.mask.clear().svg(`<svg><path d="${CREST[o.enemy ? "enemy" : "ally"].inner}" fill="#fff"/></svg>`);
        coin.mask.scale.set(k);
        coin.mask.position.set(0, 0);
        const s = (size * 0.8) / Math.max(1, Math.min(t.width, t.height));
        coin.face.scale.set(s);
        coin.face.position.set(cw / 2 - (t.width * s) / 2, size * 0.47 - (t.height * s) / 2);
      }
      coin.face.tint = o.alive ? 0xffffff : 0x555555;
      // Foes hang a crimson swallowtail under their crest; the party a short royal-blue ribbon.
      const tail = coin.c.getChildByLabel("tail") as Graphics | null;
      if (tail) {
        tail.clear();
        if (!now) {
          const w = cw * 0.5, top = size * 0.78, len = size * (o.enemy ? 0.42 : 0.3);
          tail.poly([cw / 2 - w / 2, top, cw / 2 + w / 2, top, cw / 2 + w / 2, top + len, cw / 2, top + len - w * (o.enemy ? 0.5 : 0.25), cw / 2 - w / 2, top + len])
            .fill({ color: o.enemy ? 0x8c1a1c : 0x1d2f6b }).stroke({ width: 1, color: 0xe0b36a });
        }
      }
      // The next to act: a soft gold glow behind its crest.
      const glow = coin.c.getChildByLabel("glow") as Graphics | null;
      if (glow) {
        glow.clear();
        if (i === 1) glow.ellipse(cw / 2, size / 2, cw * 0.75, size * 0.66).fill({ color: 0xffc860, alpha: 0.28 }).ellipse(cw / 2, size / 2, cw * 0.55, size * 0.5).fill({ color: 0xffe0a0, alpha: 0.25 });
      }
      coin.target = now ? 0 : x;
      coin.c.y = now ? 0 : GEO.compact ? h / 2 - size * 0.56 : h / 2 + (this.kicker.visible ? bh * 0.19 : 0) - size / 2 + (i === 1 ? 2 * this.ui : 0);
      next.push(coin);
      if (!now) x += cw + gap;
    });
    for (const gone of old) gone.c.destroy({ children: true });
    this.coins = next;
    this.fit(x + (bh * 1.2 * 40) / 110 + h * 0.1);
  }

  override update(dt: number): void {
    const a = 1 - Math.exp(-dt / 0.09);
    for (const c of this.coins) {
      c.x += (c.target - c.x) * a;
      c.c.x = c.x;
      c.c.alpha += (1 - c.c.alpha) * a;
    }
  }
}
