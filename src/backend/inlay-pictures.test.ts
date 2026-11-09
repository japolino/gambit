import { describe, expect, test } from "bun:test";
import type { InlayStyle } from "../art/look-file.js";
import { createInlayPictures, inlayPictureId } from "./inlay-pictures.js";

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

describe("Inlay pictures under a look", () => {
  test("a picked look's style goes with the request, and the picture is kept under the look", async () => {
    const asked: { id: string; style?: unknown }[] = [];
    let published: { id: string; style?: unknown }[] = [];
    const files = new Map<string, unknown>();
    const spindle = {
      userStorage: { getJson: async (p: string, o: { fallback: unknown }) => files.get(p) ?? o.fallback, setJson: async (p: string, v: unknown) => void files.set(p, structuredClone(v)) },
      rpcPool: {
        sync: (_e: string, v: { pictures: { id: string; style?: unknown }[] }) => {
          published = v.pictures;
          for (const p of v.pictures) if (!asked.some((a) => a.id === p.id)) asked.push(p);
        },
        read: async () => ({ version: 1, pictures: Object.fromEntries(published.map((p) => [p.id, { status: "ready", imageId: `img-${asked.findIndex((a) => a.id === p.id)}` }])) }),
      },
    };
    const pictures = createInlayPictures(spindle as never, () => {});
    let style: InlayStyle | null = null;
    pictures.useStyle(() => style);
    const req = { id: "figure:wren", chatId: "chat-1", direction: "figure" as const, text: "Wren alone." };
    expect((await pictures.request("u", req))?.imageId).toBe("img-0");
    style = { look: "ink_wash", positive: "ink wash painting", negative: "3d" };
    expect((await pictures.request("u", req))?.imageId).toBe("img-1");
    style = { look: "inlay-soft", artist: "Soft Water" };
    expect((await pictures.request("u", req))?.imageId).toBe("img-2");
    expect(asked.map((a) => a.style)).toEqual([undefined, { positive: "ink wash painting", negative: "3d" }, { artist: "Soft Water" }]);
    // Back under a look drawn before: its picture is kept.
    style = null;
    expect((await pictures.request("u", req))?.imageId).toBe("img-0");
    expect(asked).toHaveLength(3);
  });
});
