/**
 * Art made ready to show (Parley and the Scene): opaque art on a flat
 * background (a V5 inset render on white, say) is keyed to a transparent
 * PNG, so a figure can stand on the ground instead of floating in a box.
 * Art that cannot be keyed stays opaque, and the view frames it.
 */
import { figureStats, keyFlatBackground } from "./key-background.js";
import { cutSprite } from "./cutout/index.js";
import { CUTOUT_MODEL_F16_URL, CUTOUT_MODEL_URL } from "./cutout/models.js";

/** The figure cut out by the model, or null when it cannot run or its cut is not clean. */
async function modelCut(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) return null;
    const r = await cutSprite(await res.blob(), { quality: "best", modelUrl: CUTOUT_MODEL_URL, modelUrlF16: CUTOUT_MODEL_F16_URL });
    if (r.quality !== "best" || r.twoFigures || r.scenery) return null;
    return r.png;
  } catch {
    return null;
  }
}

export type FigureStats = ReturnType<typeof figureStats>;
export interface PreparedArt {
  url: string;
  /** True when the art now has a see-through background. */
  cutout: boolean;
  /** Cut by keying out its flat ground, not by the model: the edges may be rough. */
  rough?: true;
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
  if (key) {
    // The segmentation model first (Cue's cut-out): it cuts figures off busy
    // backgrounds too. A cut that kept scenery or looks like two figures is
    // not trusted, and the flat-background key below gets its turn.
    const cut = await modelCut(url);
    if (cut) {
      // Measured on the cut: the picture it came from covers everything, and the view would frame it.
      const drawn = await createImageBitmap(cut);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(drawn, 0, 0, c.width, c.height);
      drawn.close();
      return { url: URL.createObjectURL(cut), cutout: true, stats: figureStats(ctx.getImageData(0, 0, c.width, c.height).data) };
    }
  }
  if (!key || !keyFlatBackground(data.data, c.width, c.height)) return { url, cutout: false, stats: figureStats(data.data) };
  const stats = figureStats(data.data);
  ctx.putImageData(data, 0, 0);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
  return blob ? { url: URL.createObjectURL(blob), cutout: true, rough: true, stats } : { url, cutout: false, stats };
}
