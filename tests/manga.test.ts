import { describe, expect, test } from "bun:test";
import { mangaKernel, mangaPixels, type Manga } from "../src/frontend/art/manga.js";

/** A w x h picture at 3x (the kernel's input), grey `v` everywhere, `paint` overriding single big pixels. */
const picture = (w: number, h: number, v: number, paint: (x: number, y: number) => number | null = () => null) => {
  const W = w * 3, H = h * 3;
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = paint(x, y) ?? v;
    d.set([c, c, c, 255], (y * W + x) * 4);
  }
  return d;
};

describe("manga art", () => {
  test("a line one big pixel wide survives the shrink to a third", () => {
    const m = mangaKernel(picture(24, 24, 230, (x) => (x === 36 ? 20 : null)), 24, 24);
    const pix = mangaPixels(m);
    for (let y = 4; y < 20; y++) {
      expect(m.line[y * 24 + 12]).toBe(1);
      expect(pix[y * 24 + 12]).toBe(0);
    }
    expect(m.line[12 * 24 + 4]).toBe(0);
  });

  test("a flat area becomes the sparse dot screen", () => {
    for (const v of [40, 128, 220]) {
      const pix = mangaPixels(mangaKernel(picture(16, 16, v), 16, 16));
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) expect(pix[y * 16 + x]).toBe(x % 2 === 0 && y % 2 === 0 ? 0 : 1);
    }
  });

  test("tones step through solid ink, a checker, the dot and paper", () => {
    const at = (t: number) => {
      const m: Manga = { w: 4, h: 4, tone: new Float32Array(16).fill(t), line: new Uint8Array(16), rgba: new Uint8ClampedArray(64) };
      return [...mangaPixels(m)].join("");
    };
    expect(at(0.2)).toBe("0000000000000000");
    expect(at(0.4)).toBe("0101101001011010");
    expect(at(0.6)).toBe("0101111101011111");
    expect(at(0.8)).toBe("1111111111111111");
  });
});
