import { describe, expect, test } from "bun:test";
import { keyFlatBackground } from "./key-background.js";

/** A w x h white image with a dark w/2 square in the middle, and a white dot inside it. */
function picture(w: number, h: number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const inside = x >= w / 4 && x < (3 * w) / 4 && y >= h / 4 && y < (3 * h) / 4;
      const v = inside ? 40 : 250;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
  }
  // A white collar inside the figure: not reachable from the border.
  const c = ((h / 2) * w + w / 2) * 4;
  d[c] = d[c + 1] = d[c + 2] = 250;
  return d;
}

const alpha = (d: Uint8ClampedArray, w: number, x: number, y: number) => d[(y * w + x) * 4 + 3];

describe("keyFlatBackground", () => {
  test("clears the flat border colour and keeps the figure", () => {
    const d = picture(16, 16);
    expect(keyFlatBackground(d, 16, 16)).toBe(true);
    expect(alpha(d, 16, 0, 0)).toBe(0);
    expect(alpha(d, 16, 15, 15)).toBe(0);
    expect(alpha(d, 16, 6, 6)).toBe(255);
  });

  test("background colour inside the figure survives", () => {
    const d = picture(16, 16);
    keyFlatBackground(d, 16, 16);
    expect(alpha(d, 16, 8, 8)).toBe(255);
  });

  test("a busy border is left alone", () => {
    const d = picture(16, 16);
    for (let i = 0; i < d.length; i += 8) d[i] = d[i + 1] = d[i + 2] = 0; // stripes everywhere
    const before = d.slice();
    expect(keyFlatBackground(d, 16, 16)).toBe(false);
    expect(d).toEqual(before);
  });
});
