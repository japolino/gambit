import { describe, expect, test } from "bun:test";
import { isPreCut } from "../frontend/art/alpha.js";
import { ART_CHUNK_CHARS, ChunkBuffer, chunkBase64 } from "./chunks.js";
import { stableHash, seed32 } from "./hash.js";
import { fitContain, INSET_LAYOUTS, insetLayoutProblems, insetMaskValue, normalizePixelRect } from "./inset-geometry.js";
import { base64ToBytes, bytesToBase64, encodedMayBeTransparent, pngSize } from "./png.js";
import { alphaBounds, ICON_SHEET_GRID, sheetCells, squareAround } from "./sheet-geometry.js";
import { pngHeader } from "./testing/fake-host.js";

describe("inset geometry", () => {
  test("both layouts are usable (64-px canvas, 8-px mask edges, no overlap)", () => {
    expect(insetLayoutProblems(INSET_LAYOUTS.sprite)).toEqual([]);
    expect(insetLayoutProblems(INSET_LAYOUTS.wide)).toEqual([]);
    expect(INSET_LAYOUTS.wide.canvas.width * INSET_LAYOUTS.wide.canvas.height).toBeLessThanOrEqual(1024 * 1024);
  });

  test("problems are found", () => {
    expect(insetLayoutProblems({ canvas: { width: 1000, height: 832 }, reference: { x: 0, y: 0, width: 600, height: 832 }, repaint: { x: 596, y: 0, width: 404, height: 832 } })).toEqual([
      "canvas sides are not multiples of 64",
      "mask edges are not on 8-px blocks",
      "reference and repaint boxes overlap",
    ]);
  });

  test("an 832x1216 portrait fits the sprite reference box at x 19, 569x832 (Cue doc)", () => {
    expect(fitContain({ width: 832, height: 1216 }, INSET_LAYOUTS.sprite.reference)).toEqual({ x: 19, y: 0, width: 569, height: 832 });
    expect(fitContain({ width: 832, height: 1216 }, INSET_LAYOUTS.wide.reference)).toEqual({ x: 0, y: 24, width: 448, height: 655 });
  });

  test("mask: white in the repaint box only", () => {
    expect(insetMaskValue(INSET_LAYOUTS.sprite, 607, 10)).toBe(0);
    expect(insetMaskValue(INSET_LAYOUTS.sprite, 608, 10)).toBe(255);
    expect(insetMaskValue(INSET_LAYOUTS.sprite, 1215, 831)).toBe(255);
  });

  test("crop rectangles from messages are validated", () => {
    expect(normalizePixelRect({ x: 608, y: 0, width: 608, height: 832 })).toEqual({ x: 608, y: 0, width: 608, height: 832 });
    expect(normalizePixelRect({ x: -1, y: 0, width: 1, height: 1 })).toBeNull();
    expect(normalizePixelRect({ x: 0.5, y: 0, width: 1, height: 1 })).toBeNull();
    expect(normalizePixelRect("x")).toBeNull();
  });
});

describe("icon sheets", () => {
  test("4x4 cells on 1024x1024 with a 4% margin", () => {
    const cells = sheetCells({ width: 1024, height: 1024 }, ICON_SHEET_GRID, 0.04);
    expect(cells).toHaveLength(16);
    expect(cells[0]).toEqual({ x: 10, y: 10, width: 236, height: 236 });
    expect(cells[5]).toEqual({ x: 266, y: 266, width: 236, height: 236 });
    expect(cells[15]).toEqual({ x: 778, y: 778, width: 236, height: 236 });
  });

  test("uneven sizes tile the whole image; count limits cells", () => {
    const cells = sheetCells({ width: 1001, height: 999 }, { cols: 4, rows: 4 }, 0, 6);
    expect(cells).toHaveLength(6);
    expect(cells[3]!.x + cells[3]!.width).toBe(1001);
    expect(sheetCells({ width: 10, height: 10 }, { cols: 0, rows: 4 })).toEqual([]);
  });

  test("alpha bounds and a padded square", () => {
    const w = 10, h = 8;
    const rgba = new Uint8ClampedArray(w * h * 4);
    for (const [x, y] of [[3, 2], [6, 5]]) rgba[(y! * w + x!) * 4 + 3] = 255;
    const b = alphaBounds(rgba, w, h)!;
    expect(b).toEqual({ x: 3, y: 2, width: 4, height: 4 });
    expect(squareAround(b, { width: w, height: h }, 0)).toEqual({ x: 3, y: 2, width: 4, height: 4 });
    expect(alphaBounds(new Uint8ClampedArray(16), 2, 2)).toBeNull();
  });
});

describe("pre-cut detection (Cue kernel)", () => {
  const image = (w: number, h: number, fill: (x: number, y: number) => number) => {
    const rgba = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) rgba[(y * w + x) * 4 + 3] = fill(x, y);
    return rgba;
  };
  test("transparent border and an opaque figure", () => {
    expect(isPreCut(image(40, 60, (x, y) => (x > 10 && x < 30 && y > 10 && y < 50 ? 255 : 0)), 40, 60)).toBe(true);
  });
  test("opaque image, empty image, faint figure, a few transparent rows", () => {
    expect(isPreCut(image(40, 60, () => 255), 40, 60)).toBe(false);
    expect(isPreCut(image(40, 60, () => 0), 40, 60)).toBe(false);
    expect(isPreCut(image(40, 60, (x, y) => (x > 10 && x < 30 && y > 10 && y < 50 ? 200 : 0)), 40, 60)).toBe(false);
    expect(isPreCut(image(40, 60, (_x, y) => (y < 3 ? 0 : 255)), 40, 60)).toBe(false);
  });
});

describe("bytes", () => {
  test("base64 round trip", () => {
    const bytes = new Uint8Array(1000).map((_, i) => (i * 37) & 255);
    for (const n of [0, 1, 2, 3, 999, 1000]) {
      const slice = bytes.subarray(0, n);
      const b64 = bytesToBase64(slice);
      expect(b64).toBe(Buffer.from(slice).toString("base64"));
      expect([...base64ToBytes(b64)]).toEqual([...slice]);
    }
    expect([...base64ToBytes("data:image/png;base64,QUJD")]).toEqual([65, 66, 67]);
  });

  test("PNG size and alpha from the header", () => {
    expect(pngSize(pngHeader(1216, 832))).toEqual({ width: 1216, height: 832 });
    expect(encodedMayBeTransparent(pngHeader(10, 10, 6))).toBe(true);
    expect(encodedMayBeTransparent(pngHeader(10, 10, 2))).toBe(false);
    expect(encodedMayBeTransparent(new Uint8Array([0xff, 0xd8, 0xff]))).toBe(false);
  });

  test("chunks reassemble in any order; bad chunks are refused", () => {
    const data = "QUJD".repeat(10);
    const chunks = chunkBase64(data, 12);
    expect(chunks.length).toBe(4);
    const buf = new ChunkBuffer(chunks.length);
    expect(buf.put(3, chunks[3])).toBe("buffered");
    expect(buf.put(0, chunks[0])).toBe("buffered");
    expect(buf.put(2, chunks[2])).toBe("buffered");
    expect(buf.put(1, chunks[1])).toBe("complete");
    expect(buf.text()).toBe(data);
    expect(new ChunkBuffer(2).put(5, "QUJD")).toBe("invalid");
    expect(new ChunkBuffer(2).put(0, "<script>")).toBe("invalid");
    expect(new ChunkBuffer(1).put(0, "x".repeat(ART_CHUNK_CHARS + 1))).toBe("invalid");
  });

  test("stable hashes and seeds", () => {
    expect(stableHash({ b: 1, a: [1, 2] })).toBe(stableHash({ a: [1, 2], b: 1 }));
    expect(stableHash("a")).not.toBe(stableHash("b"));
    expect(stableHash("x")).toHaveLength(28);
    expect(seed32("monster:wolf")).toBe(seed32("monster:wolf"));
    expect(seed32("x")).toBeLessThan(4294967296);
  });
});
