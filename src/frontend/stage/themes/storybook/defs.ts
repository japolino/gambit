/**
 * Storybook (battle and Parley): the scene theme's SVG art made usable outside its own DOM. The scene draws
 * its frames against one hidden <defs> block (../../../scene/themes/storybook/art.ts DEFS) whose silk,
 * brocade, mahogany and leather patterns are canvas textures handed out as blob URLs. A picture rasterised
 * for Pixi, or an SVG used as a CSS background, cannot see that block nor load blob URLs, so here we:
 *  - cut DEFS into its named pieces and give each picture only the pieces it references (transitively);
 *  - swap blob URLs for data URLs (once, cached) so the picture is self-contained;
 *  - rasterise a picture to a canvas at a pixel size and hand it to Pixi as a texture (cached by key).
 * Text is never drawn in these pictures (an SVG image cannot use the page's web fonts): Pixi or HTML sets it.
 */
import { Texture } from "pixi.js";
import { DEFS } from "../../../scene/themes/storybook/art.js";

let pieces: Map<string, string> | null = null;

/** The DEFS block cut into its top-level elements, by id. */
function defPieces(): Map<string, string> {
  if (pieces) return pieces;
  pieces = new Map();
  const body = DEFS.slice(DEFS.indexOf("<defs>") + 6, DEFS.lastIndexOf("</defs>"));
  let i = 0;
  while (i < body.length) {
    const open = body.indexOf("<", i);
    if (open < 0) break;
    // One top-level element: walk its tags, counting depth.
    let depth = 0;
    let j = open;
    let end = -1;
    while (j < body.length) {
      const lt = body.indexOf("<", j);
      if (lt < 0) break;
      const gt = body.indexOf(">", lt);
      const tag = body.slice(lt, gt + 1);
      if (tag.startsWith("</")) depth -= 1;
      else if (!tag.endsWith("/>")) depth += 1;
      j = gt + 1;
      if (depth === 0) {
        end = j;
        break;
      }
    }
    if (end < 0) break;
    const el = body.slice(open, end);
    const id = /\sid="([^"]+)"/.exec(el)?.[1];
    if (id) pieces.set(id, el);
    i = end;
  }
  return pieces;
}

/** The defs a fragment needs (its url(#…) and href="#…" references, and theirs). */
export function defsFor(fragment: string): string {
  const all = defPieces();
  const want = new Set<string>();
  const scan = (s: string) => {
    for (const m of s.matchAll(/(?:url\(#|href="#)([\w-]+)/g)) {
      const id = m[1]!;
      if (want.has(id) || !all.has(id)) continue;
      want.add(id);
      scan(all.get(id)!);
    }
  };
  scan(fragment);
  return want.size ? `<defs>${[...want].map((id) => all.get(id)).join("")}</defs>` : "";
}

/** The inside of an <svg>…</svg> string (drops the outer tag). */
export function inner(svg: string): string {
  const a = svg.indexOf(">", svg.indexOf("<svg")) + 1;
  return svg.slice(a, svg.lastIndexOf("</svg>"));
}

/** A whole picture: `body` in a viewBox, with the defs it uses. */
export function picture(viewBox: string, body: string, attrs = ""): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${viewBox}" ${attrs}>${defsFor(body)}${body}</svg>`;
}

/** A self-contained picture with only gradients and filters (no textures) as a CSS url(). */
export function cssUrl(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const dataUrls = new Map<string, Promise<string>>();

/** blob: URLs in `s` swapped for data: URLs. */
export async function inlineBlobs(s: string): Promise<string> {
  const blobs = [...new Set(s.match(/blob:[^"')\s]+/g) ?? [])];
  if (!blobs.length) return s;
  const map = await Promise.all(
    blobs.map((b) => {
      let p = dataUrls.get(b);
      if (!p) {
        // Through an <img> and a canvas (the textures are canvases to begin with): quicker than fetch().
        p = new Promise<string>((res) => {
          const img = new Image();
          img.onload = () => {
            const c = document.createElement("canvas");
            c.width = img.naturalWidth;
            c.height = img.naturalHeight;
            c.getContext("2d")!.drawImage(img, 0, 0);
            res(c.toDataURL("image/png"));
          };
          img.onerror = () => res(b);
          img.src = b;
        });
        dataUrls.set(b, p);
      }
      return p.then((d) => [b, d] as const);
    }),
  );
  let out = s;
  for (const [b, d] of map) out = out.split(b).join(d);
  return out;
}

/** Draw a picture onto a canvas of w×h device pixels. */
export async function rasterise(svg: string, w: number, h: number): Promise<HTMLCanvasElement> {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  const raw = await inlineBlobs(svg);
  const head = raw.slice(0, raw.indexOf(">"));
  const src = raw.replace("<svg ", `<svg width="${W}" height="${H}" ${head.includes("preserveAspectRatio") ? "" : 'preserveAspectRatio="none" '}`);
  const img = new Image();
  img.decoding = "async";
  const url = URL.createObjectURL(new Blob([src], { type: "image/svg+xml" }));
  try {
    img.src = url;
    await img.decode();
  } finally {
    URL.revokeObjectURL(url);
  }
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  c.getContext("2d")!.drawImage(img, 0, 0, W, H);
  return c;
}

/**
 * Rasterising a picture with its gilt bevels and soft shadows is real work on the main thread: one at a time,
 * with a breath between, so the fight keeps animating while its book is gilded.
 */
let chain: Promise<unknown> = Promise.resolve();
function queued<T>(job: () => Promise<T>): Promise<T> {
  const run = chain.then(() => new Promise((r) => setTimeout(r, 0))).then(job);
  chain = run.catch(() => undefined);
  return run;
}

const textures = new Map<string, Promise<Texture>>();
const order: string[] = [];

/** Device pixels per CSS pixel for the art (crisp on a 2x screen, capped). */
export const artRes = (): number => Math.min(2, globalThis.devicePixelRatio || 1);

/**
 * A texture of `make()` at w×h CSS pixels, cached by key and size. `make` runs only on a miss.
 * Old entries beyond a few hundred are forgotten (not destroyed: a sprite may still show one).
 */
export function svgTexture(key: string, w: number, h: number, make: () => string): Promise<Texture> {
  const res = artRes();
  const k = `${key}@${Math.round(w)}x${Math.round(h)}x${res}`;
  let t = textures.get(k);
  if (!t) {
    t = queued(() => rasterise(make(), w * res, h * res)).then((c) => {
      const tex = Texture.from(c);
      tex.source.resolution = res;
      return tex;
    });
    t.catch(() => textures.delete(k));
    textures.set(k, t);
    order.push(k);
    if (order.length > 400) textures.delete(order.shift()!);
  }
  return t;
}

/** A texture from an image URL (a canvas texture's blob URL), cached. */
const images = new Map<string, Promise<Texture>>();
export function imageTexture(url: string): Promise<Texture> {
  let t = images.get(url);
  if (!t) {
    t = new Promise<Texture>((res, rej) => {
      const img = new Image();
      img.onload = () => res(Texture.from(img));
      img.onerror = rej;
      img.src = url;
    });
    images.set(url, t);
  }
  return t;
}
