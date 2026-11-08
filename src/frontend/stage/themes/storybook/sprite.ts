/**
 * Storybook battle: a Sprite that shows one of the theme's SVG pictures at a size, rasterised for that size
 * (crisp after every resize). Until the picture is ready it shows nothing (or the previous size, stretched).
 */
import { Sprite, Texture } from "pixi.js";
import { imageTexture, svgTexture } from "./defs.js";

export class ArtSprite extends Sprite {
  private seq = 0;
  private want = { w: 0, h: 0 };
  private timer: ReturnType<typeof setTimeout> | undefined;
  private drawn = false;

  constructor(private key: string, private make: () => string) {
    super(Texture.EMPTY);
  }

  /** Show the picture at w×h (CSS px). The same size again is a no-op. */
  draw(w: number, h: number, key = this.key, make = this.make): this {
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
    if (this.want.w === w && this.want.h === h && key === this.key && this.texture !== Texture.EMPTY) return this;
    this.key = key;
    this.make = make;
    this.want = { w, h };
    const n = ++this.seq;
    if (this.texture !== Texture.EMPTY) {
      this.width = w;
      this.height = h;
    }
    // A window being dragged asks for many sizes: rasterise only the one it settles on.
    clearTimeout(this.timer);
    const go = () => {
      void svgTexture(key, w, h, make).then((t) => {
        if (n !== this.seq || this.destroyed) return;
        this.texture = t;
        this.width = this.want.w;
        this.height = this.want.h;
      }).catch((e) => console.warn("[gambit] storybook art failed", key, e));
    };
    this.timer = setTimeout(go, this.drawn ? 90 : 30);
    this.drawn = true;
    return this;
  }
}

/** A sprite of a canvas texture (a blob URL from the scene's textures), sized on demand. */
export class ImageSprite extends Sprite {
  private size = { w: 0, h: 0 };
  constructor(url: string) {
    super(Texture.EMPTY);
    void imageTexture(url).then((t) => {
      if (this.destroyed) return;
      this.texture = t;
      if (this.size.w) this.setSize(this.size.w, this.size.h);
    });
  }
  fit(w: number, h: number): this {
    this.size = { w, h };
    if (this.texture !== Texture.EMPTY) this.setSize(w, h);
    return this;
  }
}
