import { describe, expect, test } from "bun:test";
import type { InlayStyle } from "../art/look-file.js";
import { CLOTHED, createInlayPictures, inlayPictureId } from "./inlay-pictures.js";

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

describe("Inlay pictures in a chat without adult scenes", () => {
  test("pictures are asked for clothed there, in words and in a look's negatives; an adult scene's own pictures aren't", async () => {
    const published: { id: string; text: string; style?: { negative?: string } }[] = [];
    const spindle = {
      userStorage: { getJson: async (_p: string, o: { fallback: unknown }) => o.fallback, setJson: async () => {} },
      rpcPool: {
        sync: (_e: string, v: { pictures: typeof published }) => void published.push(...v.pictures.filter((p) => !published.some((x) => x.id === p.id))),
        read: async () => ({ version: 1, pictures: Object.fromEntries(published.map((p) => [p.id, { status: "ready", imageId: p.id }])) }),
      },
    };
    const pictures = createInlayPictures(spindle as never, () => {});
    pictures.useStyle(() => ({ look: "ink_wash", positive: "ink wash painting", negative: "3d" }));
    pictures.useAdult(async (_u, chatId) => chatId === "adult");
    await pictures.request("u", { id: "cg:marsh", chatId: "plain", direction: "scene", text: "Fog over the marsh." });
    await pictures.request("u", { id: "cg:tavern", chatId: "adult", direction: "scene", text: "A rowdy tavern." });
    await pictures.request("u", { id: "scene:1", chatId: "plain", direction: "intimate", text: "The two of them." });
    const sent = Object.fromEntries(published.map((p) => [p.id.replace(/^look:ink_wash_/, ""), p]));
    expect(sent["cg:marsh"]).toMatchObject({ text: `Fog over the marsh. ${CLOTHED}`, style: { negative: "3d, nsfw, nude, naked, nipples, sex, explicit" } });
    expect(sent["cg:tavern"]).toMatchObject({ text: "A rowdy tavern.", style: { negative: "3d" } });
    expect(sent["scene:1"]).toMatchObject({ text: "The two of them.", style: { negative: "3d" } });
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
    pictures.useAdult(async () => true);
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
