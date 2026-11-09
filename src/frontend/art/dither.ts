/**
 * 1-bit art for the 1-bit theme's pictures outside its frame buffer (the
 * Meanwhile and scene pictures, class pictures): the manga conversion
 * (manga.ts) at a low resolution, shown scaled up with nearest-neighbour
 * sampling so every pixel is a chunky square, the way the old monochrome
 * screens drew.
 */
import { mangaOf, mangaPixels } from "./manga.js";

const cache = new Map<string, Promise<string>>();

/**
 * A 1-bit copy of an image, `rows` pixels tall (the width follows), as a PNG
 * URL. Shown with `image-rendering: pixelated`. Falls back to the original
 * when the image cannot be read (a tainted canvas).
 */
export function ditherUrl(url: string, rows = 220): Promise<string> {
  const key = `${url}|${rows}`;
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      const h = Math.max(8, Math.min(rows, img.naturalHeight));
      const w = Math.max(8, Math.round((img.naturalWidth / Math.max(1, img.naturalHeight)) * h));
      const m = await mangaOf(img, 0, 0, img.naturalWidth, img.naturalHeight, w, h);
      const bits = mangaPixels(m);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d")!;
      const data = g.createImageData(w, h);
      for (let i = 0; i < bits.length; i++) {
        const v = bits[i] ? 255 : 0;
        data.data[i * 4] = data.data[i * 4 + 1] = data.data[i * 4 + 2] = v;
        data.data[i * 4 + 3] = m.rgba[i * 4 + 3]! < 128 ? 0 : 255;
      }
      g.putImageData(data, 0, 0);
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
      return blob ? URL.createObjectURL(blob) : url;
    })().catch(() => url);
    cache.set(key, p);
  }
  return p;
}
