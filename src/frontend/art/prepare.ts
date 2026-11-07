/**
 * Art made ready to show (Parley and the Scene): opaque art on a flat
 * background (a V5 inset render on white, say) is keyed to a transparent
 * PNG, so a figure can stand on the ground instead of floating in a box.
 * Art that cannot be keyed stays opaque, and the view frames it.
 */
import { figureStats, keyFlatBackground } from "./key-background.js";

export type FigureStats = ReturnType<typeof figureStats>;
export interface PreparedArt {
  url: string;
  /** True when the art now has a see-through background. */
  cutout: boolean;
  stats: FigureStats;
}

const cache = new Map<string, Promise<PreparedArt>>();

export function prepareArt(url: string, key: boolean): Promise<PreparedArt> {
  const id = `${key ? "k" : "-"}|${url}`;
  let p = cache.get(id);
  if (!p) {
    p = prepareArtFresh(url, key).catch(() => ({ url, cutout: false, stats: { coverage: 1, saturation: 1 } }));
    cache.set(id, p);
  }
  return p;
}

/** Uncached: the caller owns (and may revoke) the object URL it gets back. */
export async function prepareArtFresh(url: string, key: boolean): Promise<PreparedArt> {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  let data: ImageData;
  try {
    data = ctx.getImageData(0, 0, c.width, c.height);
  } catch {
    return { url, cutout: false, stats: { coverage: 1, saturation: 1 } };
  }
  if (!key || !keyFlatBackground(data.data, c.width, c.height)) return { url, cutout: false, stats: figureStats(data.data) };
  const stats = figureStats(data.data);
  ctx.putImageData(data, 0, 0);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
  return blob ? { url: URL.createObjectURL(blob), cutout: true, stats } : { url, cutout: false, stats };
}
