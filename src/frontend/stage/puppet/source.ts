/**
 * Figure sources: a canvas (procedural placeholder) or an image URL
 * (generated art), turned into a Pixi texture plus the opaque bbox the rig
 * needs. Reading pixels needs a same-origin (or CORS-clean) image; when the
 * read fails the whole image is the bbox and the rig still works.
 */
import { Texture } from "pixi.js";
import { keyFlatBackground } from "../../art/key-background.js";
import { mangaColor, mangaOf } from "../../art/manga.js";
import type { PostSkin } from "../skin.js";
import { alphaBBox, type AlphaBox } from "./rig-build.js";

export type FigureSource = { texture: Texture; bbox: AlphaBox; width: number; height: number };

export function sourceFromCanvas(canvas: HTMLCanvasElement): FigureSource {
  const ctx = canvas.getContext("2d", { willReadFrequently: false })!;
  let bbox: AlphaBox = [0, 0, 1, 1];
  try {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    bbox = alphaBBox(data, canvas.width, canvas.height) ?? bbox;
  } catch {
    /* tainted: keep the full box */
  }
  return { texture: Texture.from(canvas), bbox, width: canvas.width, height: canvas.height };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image failed: ${url}`));
    img.src = url;
  });
}

/**
 * Art for the pixel themes' shader (../post-filter.ts): the image through the manga treatment
 * (../../art/manga.ts) `rows` tall, the tone (grey for 1-bit, the colour pulled toward it for a palette)
 * with the ink lines in black. The shader's grid is fixed in rows, so the art is made at about the rows it
 * fills on screen: a line much thinner than a cell would fall between the shader's taps. Sampled nearest,
 * so a line stays black.
 */
async function mangaCanvas(img: CanvasImageSource, iw: number, ih: number, post: PostSkin, rows: number): Promise<HTMLCanvasElement> {
  const h = Math.max(8, Math.min(rows, Math.round(ih / 3)));
  const w = Math.max(8, Math.round((iw / ih) * h));
  const m = await mangaOf(img, 0, 0, iw, ih, w, h);
  const d = post.kind === "mono" ? Uint8ClampedArray.from(m.rgba) : mangaColor(m, 0.35);
  for (let i = 0; i < w * h; i++) {
    const v = m.line[i] ? 0 : m.tone[i]! * 255;
    if (post.kind === "mono" || m.line[i]) d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.putImageData(new ImageData(d, w, h), 0, 0);
  return c;
}

function postSource(c: HTMLCanvasElement): FigureSource {
  const src = sourceFromCanvas(c);
  src.texture.source.scaleMode = "nearest";
  return src;
}

/** A pixel theme's shader and the rows the art will fill on its grid (the art is prepared for it). */
export type PostPrep = { post: PostSkin; rows: number };

/**
 * Load a figure image; bbox from a downscaled alpha read (at most 256 px tall). With `prep` (a pixel theme)
 * the picture is prepared for its shader.
 */
export async function sourceFromUrl(url: string, prep?: PostPrep | null): Promise<FigureSource> {
  const img = await loadImage(url);
  if (prep) return postSource(await mangaCanvas(img, img.naturalWidth, img.naturalHeight, prep.post, prep.rows));
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  let bbox: AlphaBox = [0, 0, 1, 1];
  try {
    const k = Math.min(1, 256 / height);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(width * k));
    c.height = Math.max(1, Math.round(height * k));
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    bbox = alphaBBox(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height, 24, 1) ?? bbox;
  } catch {
    /* tainted canvas: full box */
  }
  return { texture: Texture.from(img), bbox, width, height };
}

/**
 * Load an opaque image and key out its flat background (an inset render on
 * white), so it can stand in a cut-in like a cut-out. Null when the image
 * cannot be read or has no flat background: use it framed instead. `prep` as in sourceFromUrl.
 */
export async function keyedSourceFromUrl(url: string, prep?: PostPrep | null): Promise<FigureSource | null> {
  const img = await loadImage(url);
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  try {
    const data = ctx.getImageData(0, 0, c.width, c.height);
    if (!keyFlatBackground(data.data, c.width, c.height)) return null;
    ctx.putImageData(data, 0, 0);
  } catch {
    return null;
  }
  return prep ? postSource(await mangaCanvas(c, c.width, c.height, prep.post, prep.rows)) : sourceFromCanvas(c);
}
