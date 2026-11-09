import { describe, expect, test } from "bun:test";
import type { ToBackend, ToFrontend } from "../shared/protocol.js";
import { chunkBase64 } from "./chunks.js";
import { registerArt, type ArtApi } from "./controller.js";
import { probeKey, stylePath } from "./looks.js";
import { CACHE_PATH, INDEX_PATH } from "./store.js";
import { connection, createFakeHost, pngBase64, settle, type FakeHost } from "./testing/fake-host.js";

const CONNECTIONS = [
  connection({ id: "nai", provider: "novelai", model: "nai-diffusion-5-full", is_default: true }),
  connection({ id: "gpt", provider: "openai", model: "gpt-image-2.6" }),
];

const WOLF = { kind: "monster" as const, monster: { id: "wolf", name: "Ash Wolf", brief: "gaunt wolf", palette: "#333333", rig: "standing" as const } };

/** A browser that answers canvas work like src/frontend/art/client.ts would (fixed PNG headers). */
function browser(art: () => ArtApi, sent: ToFrontend[], opts: { inset?: boolean; pixels?: boolean } = {}) {
  return (msg: ToFrontend) => {
    sent.push(msg);
    queueMicrotask(() => {
      if (msg.type === "inset.compose" && opts.inset !== false) {
        for (const part of ["image", "mask"] as const) {
          const chunks = chunkBase64(pngBase64(1216, 832), 20);
          chunks.forEach((chunk, index) => art().handle({ type: "inset.result", requestId: msg.request.requestId, part, chunk, index, total: chunks.length }));
        }
      }
      if (msg.type === "art.pixels" && opts.pixels !== false) {
        const job = msg.job;
        const items = job.kind === "crop" ? [pngBase64(job.rect.width, job.rect.height)] : job.kind === "cut" ? [pngBase64(64, 96)] : Array.from({ length: job.count }, () => pngBase64(236, 236));
        items.forEach((data, item) => {
          const chunks = chunkBase64(data, 30);
          chunks.forEach((chunk, index) =>
            art().handle({ type: "art.pixels.chunk", requestId: job.requestId, item, items: items.length, index, total: chunks.length, chunk, ...(index === 0 ? { width: 1, height: 1, preCut: true } : {}) } as ToBackend),
          );
        });
      }
    });
  };
}

function setup(fake: FakeHost, opts: { inset?: boolean; pixels?: boolean } = {}) {
  const sent: ToFrontend[] = [];
  let api: ArtApi;
  api = registerArt(fake.host, browser(() => api, sent, opts), { batchMs: 0, sleep: async () => {}, timeoutMs: 0, insetTimeoutMs: 30, pixelsTimeoutMs: 30 });
  const updates = () => sent.flatMap((m) => (m.type === "art.update" ? m.items : []));
  return { api, sent, updates };
}

describe("registerArt", () => {
  test("a monster on NAI V5: generate call, art.update, index and cache persisted", async () => {
    const fake = createFakeHost({ connections: CONNECTIONS });
    const { api, updates } = setup(fake);
    const first = api.request("monster:wolf", WOLF, 1);
    expect(first.state).toBe("queued");
    const done = await api.whenDone("monster:wolf");
    expect(done).toMatchObject({ state: "ready", imageId: "img-1", url: "/api/v1/image-gen/results/img-1", cutout: true });
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]).toMatchObject({ connection_id: "nai", model: "nai-diffusion-5-full", includeDataUrl: false, parameters: { resolution: "1024x1024", steps: 28 } });
    expect(fake.calls[0]!.prompt).toContain("transparent background");
    expect(updates().map((u) => u.state)).toEqual(["queued", "queued", "running", "ready"]);
    await api.dispose();
    expect(Object.keys((fake.files.get(INDEX_PATH) as { entries: object }).entries)).toEqual(["monster:wolf"]);
    expect(Object.keys((fake.files.get(CACHE_PATH) as { entries: object }).entries)).toHaveLength(1);

    // Restart: the persisted index answers, nothing is generated again.
    const again = setup(fake);
    await again.api.ready();
    expect(again.api.status("monster:wolf")).toMatchObject({ state: "ready", imageId: "img-1" });
    expect(again.api.request("monster:wolf", WOLF, 0).state).toBe("ready");
    expect(fake.calls).toHaveLength(1);
  });

  test("an opaque V5 result is reported as not cut out (header check)", async () => {
    const fake = createFakeHost({ connections: CONNECTIONS });
    fake.queue.push(() => {
      fake.images.set("rgb", new Uint8Array(Buffer.from(pngBase64(64, 64, 2), "base64")));
      return { imageDataUrl: "", model: "m", provider: "novelai", imageId: "rgb" };
    });
    const { api } = setup(fake);
    api.request("monster:wolf", WOLF, 1);
    expect(await api.whenDone("monster:wolf")).toMatchObject({ imageId: "rgb", cutout: false });
  });

  test("Inlay's figure is cut out in the browser, and Inlay's picture is kept", async () => {
    const fake = createFakeHost({ connections: CONNECTIONS });
    const { api, sent } = setup(fake);
    await api.adopt("figure:k", { imageId: "inlay-1", url: "/api/v1/images/inlay-1", via: "inlay" }, undefined, true);
    expect(sent.some((m) => m.type === "art.pixels" && m.job.kind === "cut" && m.job.sourceUrl === "/api/v1/images/inlay-1")).toBe(true);
    expect(api.status("figure:k")).toMatchObject({ state: "ready", imageId: fake.uploads[0]!.id, cutout: true, via: "inlay" });
    expect(fake.deleted).toEqual([]);
  });

  test("after a restart, a picture Inlay drew is still known as Inlay's (its figure is cut once from there)", async () => {
    const fake = createFakeHost({ connections: CONNECTIONS });
    fake.files.set(INDEX_PATH, { version: 1, entries: { "figure:k": { imageId: "inlay-1", url: "/api/v1/images/inlay-1", cutout: false, at: 1, via: "inlay" } } });
    const { api } = setup(fake);
    await api.ready();
    expect(api.status("figure:k")).toMatchObject({ state: "ready", cutout: false, via: "inlay" });
  });

  test("no image connection: failed status and one notice (placeholders)", async () => {
    const fake = createFakeHost({ connections: [] });
    const { api, sent } = setup(fake);
    api.request("monster:wolf", WOLF, 1);
    expect(await api.whenDone("monster:wolf")).toMatchObject({ state: "failed" });
    expect(sent.filter((m) => m.type === "notice")).toHaveLength(1);
    expect(fake.calls).toHaveLength(0);
  });

  test("expression by V5 inset under a locked anime look: canvas, infill, crop, upload", async () => {
    const fake = createFakeHost({ connections: CONNECTIONS });
    fake.files.set(stylePath("camp-1"), { version: 1, lookId: "modern_anime", lockedAt: 1, anchors: {} });
    fake.images.set("canon", new Uint8Array([1, 2, 3]));
    const { api, sent } = setup(fake);
    await api.setCampaign("camp-1");
    expect(api.look().id).toBe("modern_anime");
    api.request("expr:hero:angry", { kind: "expression", character: { id: "hero", name: "Ash", tags: "silver hair", description: "a swordswoman", seed: 77, sex: "girl" }, expression: "angry", canonical: { imageId: "canon" } }, 1);
    const done = await api.whenDone("expr:hero:angry");
    expect(sent.some((m) => m.type === "inset.compose" && m.request.sourceUrl === "/api/v1/images/canon" && m.request.layout === "sprite")).toBe(true);
    expect(fake.calls).toHaveLength(1);
    const call = fake.calls[0]!;
    expect(call.model).toBe("nai-diffusion-5-full-inpainting");
    expect(call.prompt.startsWith("split screen, ")).toBe(true);
    const raw = JSON.parse((call.parameters as Record<string, string>).rawRequestOverride!);
    expect(raw.action).toBe("infill");
    expect(raw.parameters.image).toBe(pngBase64(1216, 832));
    const crop = sent.find((m) => m.type === "art.pixels");
    expect(crop && crop.type === "art.pixels" && crop.job.kind === "cut" ? crop.job.crop : null).toEqual({ x: 608, y: 0, width: 608, height: 832 });
    expect(done).toMatchObject({ state: "ready", imageId: fake.uploads[0]!.id, cutout: true });
    expect(fake.deleted).toEqual(["img-1"]); // the uncropped canvas
  });

  test("no browser for the inset: falls back to the GPT edit of the canonical", async () => {
    const fake = createFakeHost({ connections: CONNECTIONS });
    fake.files.set(stylePath("default"), { version: 1, lookId: "modern_anime", lockedAt: 1, anchors: {} });
    fake.images.set("canon", new Uint8Array([1, 2, 3]));
    const { api } = setup(fake, { inset: false });
    await api.setCampaign(null);
    api.request("expr:hero:sad", { kind: "expression", character: { id: "hero", name: "Ash", tags: "x", description: "y", seed: 1 }, expression: "sad", canonical: { imageId: "canon" } }, 1);
    const done = await api.whenDone("expr:hero:sad");
    expect(done.state).toBe("ready");
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]).toMatchObject({ connection_id: "gpt", parameters: { inputFidelity: "high", background: "transparent", resolvedSourceImages: [{ data: "AQID", mimeType: "image/png" }] } });
  });

  test("style probe: 4 looks x 2 subjects, style.probes, then style.pick stores the anchors", async () => {
    const fake = createFakeHost({ connections: CONNECTIONS });
    const { api, sent } = setup(fake);
    await api.setCampaign("camp-9");
    api.handle({ type: "style.probe" });
    await settle(60);
    expect(fake.calls).toHaveLength(8);
    // anime / ink looks draw on NAI, painted / grim on GPT
    expect(fake.calls.filter((c) => c.connection_id === "nai")).toHaveLength(4);
    expect(sent.filter((m) => m.type === "style.probes").length).toBeGreaterThan(0);
    const lastProbes = [...sent].reverse().find((m) => m.type === "style.probes");
    expect(lastProbes && lastProbes.type === "style.probes" ? lastProbes.looks.map((l) => l.status.state) : []).toEqual(["ready", "ready", "ready", "ready"]);
    api.handle({ type: "style.pick", lookId: "ink_wash" });
    await settle();
    const lock = fake.files.get(stylePath("camp-9")) as { lookId: string; anchors: Record<string, { imageId: string }> };
    expect(lock.lookId).toBe("ink_wash");
    expect(lock.anchors.gate!.imageId).toBe(api.status(probeKey("ink_wash", "gate"))!.imageId!);
    expect(lock.anchors.bust!.imageId).toBe(api.status(probeKey("ink_wash", "bust"))!.imageId!);
    expect(sent.some((m) => m.type === "style.locked" && m.lookId === "ink_wash")).toBe(true);
    // The locked look applies to later requests (ink & wash prefers NAI for places).
    expect(api.look().id).toBe("ink_wash");
    api.request("bg:mill", { kind: "background", location: { id: "mill", name: "Old Mill", description: "ruined" } }, 1);
    await api.whenDone("bg:mill");
    const last = fake.calls[fake.calls.length - 1]!;
    expect(last.connection_id).toBe("nai");
    expect(last.prompt).toContain("ink wash painting");
  });

  test("icon sheet: GPT sheet, sliced in the browser, one key per icon", async () => {
    const fake = createFakeHost({ connections: CONNECTIONS });
    const { api, sent, updates } = setup(fake);
    api.request("icons:set1", { kind: "icon_sheet", icons: [{ key: "icon:potion", brief: "red potion" }, { key: "icon:sword", brief: "short sword" }, { key: "icon:key", brief: "iron key" }] }, 2);
    await api.whenDone("icons:set1");
    await settle(40);
    expect(fake.calls[0]).toMatchObject({ connection_id: "gpt", parameters: { size: "1024x1024", background: "transparent", quality: "medium" } });
    const slice = sent.find((m) => m.type === "art.pixels");
    expect(slice && slice.type === "art.pixels" ? slice.job : null).toMatchObject({ kind: "slice", cols: 4, rows: 4, count: 3, trim: true });
    for (const key of ["icon:potion", "icon:sword", "icon:key"]) expect(api.status(key)).toMatchObject({ state: "ready", cutout: true });
    expect(fake.uploads).toHaveLength(3);
    expect(updates().filter((u) => u.key === "icon:sword").map((u) => u.state)).toEqual(["queued", "ready"]);
  });

  test("frontend art.request upgrades a known key; unknown keys report failed; art.status answers", async () => {
    const fake = createFakeHost({ connections: CONNECTIONS });
    const { api, sent } = setup(fake);
    api.handle({ type: "art.request", key: "nope", priority: 0 });
    api.handle({ type: "art.status", keys: ["nope"] });
    await settle();
    const items = sent.flatMap((m) => (m.type === "art.update" ? m.items : []));
    expect(items.filter((i) => i.key === "nope").every((i) => i.state === "failed")).toBe(true);
    expect(api.handle({ type: "battle.start", encounterId: "x" } as ToBackend)).toBe(false);
  });
});
