/**
 * 1-bit art for the 1-bit theme: the picture is shrunk to a low resolution,
 * its contrast crushed so shadows go to pure black, and an ordered (Bayer)
 * dither turns the rest into pure black and white. Shown scaled up with
 * nearest-neighbour sampling, every dither cell is a chunky square pixel,
 * the way the old monochrome screens drew, not a fine halftone over a
 * high-resolution image.
 */

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export interface DitherOptions {
  /** Luminance (0-1, as stored) at and below which a pixel is solid black. */
  black?: number;
  /** Luminance at and above which a pixel is solid white. */
  white?: number;
  /** Colours to write, as [r, g, b]. */
  ink?: [number, number, number];
  paper?: [number, number, number];
}

/** In place: every opaque pixel becomes ink or paper; see-through pixels stay see-through. */
export function ditherRGBA(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, opts: DitherOptions = {}): void {
  const lo = opts.black ?? 0.18;
  const hi = opts.white ?? 0.78;
  const ink = opts.ink ?? [0, 0, 0];
  const paper = opts.paper ?? [255, 255, 255];
  const span = Math.max(1e-3, hi - lo);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (rgba[i + 3]! < 128) {
        rgba[i + 3] = 0;
        continue;
      }
      const lum = (0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]!) / 255;
      const l = Math.min(1, Math.max(0, (lum - lo) / span));
      const t = (BAYER4[(y & 3) * 4 + (x & 3)]! + 0.5) / 16;
      const c = l > t ? paper : ink;
      rgba[i] = c[0];
      rgba[i + 1] = c[1];
      rgba[i + 2] = c[2];
      rgba[i + 3] = 255;
    }
  }
}

const cache = new Map<string, Promise<string>>();

/**
 * A 1-bit copy of an image, `rows` pixels tall (the width follows), as a PNG
 * URL. Shown with `image-rendering: pixelated`. Falls back to the original
 * when the image cannot be read (a tainted canvas).
 */
export function ditherUrl(url: string, rows = 220, opts: DitherOptions = {}): Promise<string> {
  const key = `${url}|${rows}|${opts.black ?? ""}|${opts.white ?? ""}`;
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      const h = Math.max(8, Math.min(rows, img.naturalHeight));
      const w = Math.max(8, Math.round((img.naturalWidth / Math.max(1, img.naturalHeight)) * h));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d", { willReadFrequently: true })!;
      g.imageSmoothingQuality = "high";
      g.drawImage(img, 0, 0, w, h);
      try {
        const data = g.getImageData(0, 0, w, h);
        ditherRGBA(data.data, w, h, opts);
        g.putImageData(data, 0, 0);
      } catch {
        return url;
      }
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
      return blob ? URL.createObjectURL(blob) : url;
    })().catch(() => url);
    cache.set(key, p);
  }
  return p;
}
