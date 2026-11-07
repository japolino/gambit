/**
 * Browser side of the art pipeline: answers the backend's canvas work.
 * - `inset.compose`: fetch the reference, draw the V5 inset canvas and mask,
 *   reply with `inset.result` chunks per part (or `inset.error`).
 *   Ported from Cue (visual-novel-preview, origin/testing @ ab0fa34, file
 *   last changed at 7b1c360): src/frontend/sprites/inset-service.ts.
 * - `art.pixels`: crop an image or slice an icon sheet, reply with each PNG
 *   as `art.pixels.chunk` messages (or `art.pixels.error`).
 *
 * Usage (frontend entry):
 *   const disposeArt = registerArtFrontend({ sendToBackend: ctx.sendToBackend, onBackendMessage: ctx.onBackendMessage });
 * Never logs image data. Duplicate requests for an in-flight id are ignored.
 */
import { chunkBase64 } from "../../art/chunks.js";
import { insetLayout, normalizePixelRect, type InsetLayout } from "../../art/inset-geometry.js";
import { bytesToBase64 } from "../../art/png.js";
import { validGrid } from "../../art/sheet-geometry.js";
import type { InsetComposeRequest, PixelJob, ToBackend } from "../../shared/protocol.js";
import { composeInset, cropImageBlob, sliceSheet, type PixelResult } from "./canvas.js";

/** Largest source image fetched for canvas work. */
export const ART_SOURCE_MAX_BYTES = 32 * 1024 * 1024;

export interface ArtFrontendDeps {
  sendToBackend: (message: ToBackend) => void;
  onBackendMessage: (handler: (payload: unknown) => void) => () => void;
  /** Fetch image bytes (same origin; generated images are served by /api/v1/image-gen/results/{id}). */
  fetchImage?: (url: string) => Promise<Blob>;
  /** Overrides for tests. */
  compose?: (reference: Blob, layout: InsetLayout) => Promise<{ image: Blob; mask: Blob }>;
  crop?: typeof cropImageBlob;
  slice?: typeof sliceSheet;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
}

async function defaultFetch(url: string): Promise<Blob> {
  if (!/^\/api\/v1\//.test(url)) throw new Error("Only Lumiverse image URLs can be used for art work.");
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`The image could not be loaded (${res.status}).`);
  return res.blob();
}

export function registerArtFrontend(deps: ArtFrontendDeps): () => void {
  const fetchImage = deps.fetchImage ?? defaultFetch;
  const compose = deps.compose ?? composeInset;
  const crop = deps.crop ?? cropImageBlob;
  const slice = deps.slice ?? sliceSheet;
  const controller = new AbortController();
  const inFlight = new Set<string>();

  const source = async (url: string): Promise<Blob> => {
    const blob = await fetchImage(url);
    if (blob.size > ART_SOURCE_MAX_BYTES) throw new Error("The source image is too large.");
    return blob;
  };

  const handleInset = async (request: InsetComposeRequest): Promise<void> => {
    try {
      const layout = insetLayout(request.layout);
      if (!layout) throw new Error(`Unknown inset layout "${String(request.layout)}".`);
      const image = await source(request.sourceUrl);
      if (controller.signal.aborted) return;
      const canvas = await compose(image, layout);
      if (controller.signal.aborted) return;
      for (const part of ["image", "mask"] as const) {
        const chunks = chunkBase64(await blobToBase64(canvas[part]));
        if (controller.signal.aborted) return;
        chunks.forEach((chunk, index) => deps.sendToBackend({ type: "inset.result", requestId: request.requestId, part, chunk, index, total: chunks.length }));
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      deps.sendToBackend({ type: "inset.error", requestId: request.requestId, error: (error instanceof Error ? error.message : String(error)) || "The inset canvas could not be drawn." });
    }
  };

  const handlePixels = async (job: PixelJob): Promise<void> => {
    try {
      const image = await source(job.sourceUrl);
      if (controller.signal.aborted) return;
      let results: PixelResult[];
      if (job.kind === "crop") {
        const rect = normalizePixelRect(job.rect);
        if (!rect) throw new Error("Invalid crop rectangle.");
        results = [await crop(image, rect)];
      } else if (job.kind === "slice") {
        const grid = { cols: job.cols, rows: job.rows };
        if (!validGrid(grid)) throw new Error("Invalid sheet grid.");
        results = await slice(image, grid, Math.max(1, Math.min(job.count, job.cols * job.rows)), Number(job.margin) || 0, job.trim === true);
      } else {
        throw new Error("Unknown pixel job.");
      }
      if (!results.length) throw new Error("Nothing to return.");
      for (let item = 0; item < results.length; item++) {
        const r = results[item]!;
        const chunks = chunkBase64(await blobToBase64(r.png));
        if (controller.signal.aborted) return;
        chunks.forEach((chunk, index) =>
          deps.sendToBackend({
            type: "art.pixels.chunk",
            requestId: job.requestId,
            item,
            items: results.length,
            index,
            total: chunks.length,
            chunk,
            ...(index === 0 ? { width: r.width, height: r.height, preCut: r.preCut } : {}),
          }),
        );
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      deps.sendToBackend({ type: "art.pixels.error", requestId: job.requestId, error: (error instanceof Error ? error.message : String(error)) || "The image could not be processed." });
    }
  };

  const once = (id: string, work: () => Promise<void>): void => {
    if (controller.signal.aborted || inFlight.has(id)) return;
    inFlight.add(id);
    void work().finally(() => inFlight.delete(id));
  };

  const off = deps.onBackendMessage((payload) => {
    const msg = payload as { type?: string; request?: InsetComposeRequest; job?: PixelJob };
    if (msg?.type === "inset.compose" && msg.request?.requestId) once(msg.request.requestId, () => handleInset(msg.request!));
    else if (msg?.type === "art.pixels" && msg.job?.requestId) once(msg.job.requestId, () => handlePixels(msg.job!));
  });

  return () => {
    controller.abort();
    off();
  };
}

export { isPreCut, mayBeTransparent } from "./alpha.js";
