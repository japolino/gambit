import { describe, expect, test } from "bun:test";
import { ditherRGBA } from "../src/frontend/art/dither.js";

const fill = (w: number, h: number, v: number, a = 255) => {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < d.length; i += 4) d.set([v, v, v, a], i);
  return d;
};
const share = (d: Uint8ClampedArray, v: number) => {
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] === v && d[i + 1] === v && d[i + 2] === v) n++;
  return n / (d.length / 4);
};

describe("1-bit dither", () => {
  test("only pure black and pure white come out", () => {
    const d = fill(8, 8, 0);
    for (let i = 0; i < d.length; i += 4) d.fill((i / 4) * 4, i, i + 3);
    ditherRGBA(d, 8, 8);
    for (let i = 0; i < d.length; i += 4) expect([0, 255]).toContain(d[i]!);
  });

  test("shadows crush to solid black and highlights to solid white", () => {
    const dark = fill(8, 8, 40);
    ditherRGBA(dark, 8, 8);
    expect(share(dark, 0)).toBe(1);
    const light = fill(8, 8, 250);
    ditherRGBA(light, 8, 8);
    expect(share(light, 255)).toBe(1);
  });

  test("a mid-tone becomes an even pattern, lighter tones more white", () => {
    const mid = fill(8, 8, 128);
    ditherRGBA(mid, 8, 8);
    const lighter = fill(8, 8, 180);
    ditherRGBA(lighter, 8, 8);
    expect(share(mid, 255)).toBeGreaterThan(0.2);
    expect(share(mid, 255)).toBeLessThan(0.8);
    expect(share(lighter, 255)).toBeGreaterThan(share(mid, 255));
  });

  test("see-through pixels stay see-through, so a cut-out keeps its outline", () => {
    const d = fill(4, 4, 128, 0);
    ditherRGBA(d, 4, 4);
    for (let i = 3; i < d.length; i += 4) expect(d[i]).toBe(0);
  });
});
