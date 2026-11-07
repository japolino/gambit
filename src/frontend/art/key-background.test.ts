import { describe, expect, test } from "bun:test";
import { figureStats, keyFlatBackground, usableExpression } from "./key-background.js";

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

describe("usableExpression", () => {
  const img = (w: number, h: number, px: (x: number, y: number) => [number, number, number]) => {
    const d = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const [r, g, b] = px(x, y);
      d.set([r, g, b, 255], (y * w + x) * 4);
    }
    return d;
  };
  const inBox = (x: number, y: number) => x > 10 && x < 30 && y > 8 && y < 52;

  test("a blank render keys away to nothing and is rejected", () => {
    const d = img(40, 60, () => [254, 254, 255]);
    keyFlatBackground(d, 40, 60);
    expect(usableExpression(figureStats(d))).toBe(false);
  });

  test("a colourful figure on a flat ground is kept", () => {
    const d = img(40, 60, (x, y) => (inBox(x, y) ? [230, 90, 160] : [255, 255, 255]));
    expect(keyFlatBackground(d, 40, 60)).toBe(true);
    const s = figureStats(d);
    expect(s.coverage).toBeGreaterThan(0.2);
    expect(usableExpression(s, { saturation: 0.6 })).toBe(true);
  });

  test("a grey figure of a colourful character is rejected; a grey character's is not", () => {
    const d = img(40, 60, (x, y) => (inBox(x, y) ? [20, 20, 22] : [255, 255, 255]));
    keyFlatBackground(d, 40, 60);
    const s = figureStats(d);
    expect(usableExpression(s, { saturation: 0.6 })).toBe(false);
    expect(usableExpression(s, { saturation: 0.05 })).toBe(true);
    // Measured on a real card: muted art at 0.165 against lost renders at 0 and 0.004.
    expect(usableExpression({ coverage: 0.5, saturation: 0.004 }, { saturation: 0.165 })).toBe(false);
    expect(usableExpression({ coverage: 0.5, saturation: 0.12 }, { saturation: 0.165 })).toBe(true);
  });
});
