import { describe, expect, test } from "bun:test";
import { toBase64 } from "./fx-assets.js";

describe("toBase64", () => {
  test("matches the platform encoder at every padding length and across the line buffer", () => {
    for (const n of [0, 1, 2, 3, 4, 5, 100, 65536 * 3 + 7]) {
      const b = new Uint8Array(n);
      for (let i = 0; i < n; i++) b[i] = (i * 131 + 7) & 255;
      expect(toBase64(b)).toBe(Buffer.from(b).toString("base64"));
    }
  });
});
