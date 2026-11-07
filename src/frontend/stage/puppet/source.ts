/**
 * Figure sources: a canvas (procedural placeholder) or an image URL
 * (generated art), turned into a Pixi texture plus the opaque bbox the rig
 * needs. Reading pixels needs a same-origin (or CORS-clean) image; when the
 * read fails the whole image is the bbox and the rig still works.
 */
import { Texture } from "pixi.js";
import { keyFlatBackground } from "../../art/key-background.js";
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

/** Load a figure image; bbox from a downscaled alpha read (at most 256 px tall). */
export async function sourceFromUrl(url: string): Promise<FigureSource> {
  const img = await loadImage(url);
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
 * cannot be read or has no flat background: use it framed instead.
 */
export async function keyedSourceFromUrl(url: string): Promise<FigureSource | null> {
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
  return sourceFromCanvas(c);
}
