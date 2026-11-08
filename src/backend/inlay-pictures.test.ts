import { describe, expect, test } from "bun:test";
import { inlayPictureId } from "./inlay-pictures.js";

// Inlay's request id rule (inlay-illustrator shared-pictures.ts ID_RE).
const INLAY_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,95}$/u;

describe("Inlay picture ids", () => {
  test("cut-in and moment keys become ids Inlay accepts", () => {
    for (const key of ["figure:88779bca-5029-4a5b-8b89-e339297e0036:stolas#action", "moment:card:552cbc8d:loona:mw72vw1c:573a2656.0", "class:duelist:88779bca.p_player#action", `face:${"x".repeat(140)}#action`]) {
      expect(INLAY_ID.test(inlayPictureId(key))).toBe(true);
    }
  });
  test("a key that already fits is kept; long keys stay distinct", () => {
    expect(inlayPictureId("moment:card:a.1")).toBe("moment:card:a.1");
    expect(inlayPictureId(`face:${"x".repeat(140)}#a`)).not.toBe(inlayPictureId(`face:${"x".repeat(140)}#b`));
  });
});
