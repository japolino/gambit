import { describe, expect, test } from "bun:test";
import { InsetBridge } from "../../art/inset-bridge.js";
import { PixelBridge } from "../../art/pixel-bridge.js";
import { pngHeader } from "../../art/testing/fake-host.js";
import type { ToBackend, ToFrontend } from "../../shared/protocol.js";
import { registerArtFrontend } from "./client.js";

/** Wires the browser client to the backend bridges in memory (canvas work stubbed: bun has no canvas). */
function wire() {
  const handlers: Array<(p: unknown) => void> = [];
  const toBackend: ToBackend[] = [];
  let inset!: InsetBridge;
  let pixels!: PixelBridge;
  const deliver = (msg: ToFrontend) => handlers.forEach((h) => h(msg));
  inset = new InsetBridge((m) => deliver(m), 200);
  pixels = new PixelBridge((m) => deliver(m), 200);
  const fetched: string[] = [];
  const dispose = registerArtFrontend({
    sendToBackend: (m) => {
      toBackend.push(m);
      if (m.type === "inset.result" || m.type === "inset.error") inset.accept(m);
      if (m.type === "art.pixels.chunk" || m.type === "art.pixels.error") pixels.accept(m);
    },
    onBackendMessage: (h) => {
      handlers.push(h);
      return () => handlers.splice(handlers.indexOf(h), 1);
    },
    fetchImage: async (url) => {
      fetched.push(url);
      if (url.includes("missing")) throw new Error("The image could not be loaded (404).");
      return new Blob([new Uint8Array([1, 2, 3])]);
    },
    compose: async (_ref, layout) => ({ image: new Blob([pngHeader(layout.canvas.width, layout.canvas.height)]), mask: new Blob([pngHeader(layout.canvas.width, layout.canvas.height)]) }),
    crop: async (_blob, rect) => ({ png: new Blob([pngHeader(rect.width, rect.height)]), width: rect.width, height: rect.height, preCut: false }),
    slice: async (_blob, _grid, count) => Array.from({ length: count }, (_, i) => ({ png: new Blob([pngHeader(100 + i, 100 + i)]), width: 100 + i, height: 100 + i, preCut: true })),
  });
  return { inset, pixels, toBackend, fetched, dispose };
}

describe("art frontend client <-> backend bridges", () => {
  test("inset canvas round trip", async () => {
    const w = wire();
    const outcome = await w.inset.compose("wide", "/api/v1/image-gen/results/canon");
    expect(outcome.ok).toBe(true);
    expect(w.fetched).toEqual(["/api/v1/image-gen/results/canon"]);
    expect(w.toBackend.map((m) => (m.type === "inset.result" ? m.part : m.type))).toEqual(["image", "mask"]);
  });

  test("inset error from the browser settles with the message", async () => {
    const w = wire();
    expect(await w.inset.compose("sprite", "/api/v1/image-gen/results/missing")).toEqual({ ok: false, error: "The image could not be loaded (404)." });
  });

  test("crop and slice round trips report sizes and preCut", async () => {
    const w = wire();
    const crop = await w.pixels.run({ kind: "crop", sourceUrl: "/api/v1/image-gen/results/x", rect: { x: 608, y: 0, width: 608, height: 832 } });
    expect(crop).toMatchObject({ ok: true, items: [{ width: 608, height: 832, preCut: false }] });
    const slice = await w.pixels.run({ kind: "slice", sourceUrl: "/api/v1/image-gen/results/s", cols: 4, rows: 4, count: 3, margin: 0.04, trim: true });
    expect(slice.ok && slice.items.map((i) => [i.width, i.preCut])).toEqual([[100, true], [101, true], [102, true]]);
  });

  test("invalid jobs are refused in the browser", async () => {
    const w = wire();
    expect(await w.pixels.run({ kind: "crop", sourceUrl: "/api/v1/image-gen/results/x", rect: { x: -5, y: 0, width: 1, height: 1 } })).toEqual({ ok: false, error: "Invalid crop rectangle." });
    expect(await w.pixels.run({ kind: "slice", sourceUrl: "/api/v1/image-gen/results/x", cols: 100, rows: 100, count: 1, margin: 0, trim: false })).toEqual({ ok: false, error: "Invalid sheet grid." });
  });

  test("no browser: the bridge times out instead of hanging", async () => {
    const bridge = new InsetBridge(() => {}, 10);
    expect(await bridge.compose("sprite", "/x")).toMatchObject({ ok: false, timedOut: true });
  });

  test("a wrong-size canvas is refused by the backend", async () => {
    const handlers: Array<(p: unknown) => void> = [];
    const bridge = new InsetBridge((m) => handlers.forEach((h) => h(m)), 200);
    registerArtFrontend({
      sendToBackend: (m) => (m.type === "inset.result" || m.type === "inset.error" ? bridge.accept(m) : undefined),
      onBackendMessage: (h) => (handlers.push(h), () => {}),
      fetchImage: async () => new Blob([new Uint8Array([1])]),
      compose: async () => ({ image: new Blob([pngHeader(10, 10)]), mask: new Blob([pngHeader(10, 10)]) }),
    });
    expect(await bridge.compose("sprite", "/x")).toEqual({ ok: false, error: "The inset image is 10x10, expected 1216x832." });
  });
});
