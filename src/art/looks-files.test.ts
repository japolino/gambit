import { describe, expect, test } from "bun:test";
import { registerArt } from "./controller.js";
import { contrast, describedLookId, describeLookPrompt, lookFromInlayArtist, validateLook } from "./look-file.js";
import { stylePath } from "./looks.js";
import { INDEX_PATH } from "./store.js";
import { connection, createFakeHost } from "./testing/fake-host.js";
import type { ToFrontend } from "../shared/protocol.js";

const GOOD = {
  format: "gambit-look",
  v: 1,
  id: "ukiyo-gold",
  label: "Ukiyo-e Gold",
  preferred: "nai",
  nai: { positive: "ukiyo-e, woodblock print, gold leaf, flat color, bold outlines", negative: "3d, photo" },
  gpt: { style: "A ukiyo-e woodblock print with gold leaf accents and bold carved outlines.", avoid: "Avoid photographic realism." },
  ui: { gold: "#d4a017" },
};

describe("look files", () => {
  test("a good file passes and is normalised", () => {
    const r = validateLook({ ...GOOD, id: "Ukiyo-Gold" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.look).toMatchObject({ id: "ukiyo-gold", ui: { gold: "#d4a017" } });
  });

  test("text in the image, bad ids, colours and providers are refused", () => {
    const r = validateLook({ ...GOOD, id: "x", preferred: "dalle", nai: { positive: "ukiyo-e, text, signature", negative: "" }, gpt: { style: "A poster with the words GAMBIT across the top in gold.", avoid: "" }, ui: { gold: "gold" } });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const all = r.errors.join(" ");
      expect(all).toContain('"id"');
      expect(all).toContain('"preferred"');
      expect(all).toContain("nai.positive");
      expect(all).toContain("gpt.style");
      expect(all).toContain("ui.gold");
    }
  });

  test("an Inlay art style becomes a NAI look without weighting syntax in its sentence", () => {
    const f = lookFromInlayArtist({ id: "Soft Water", title: "Soft watercolor", prompt: "1.2::artist:foo::, {watercolor (medium)}, pastel colors, text", negativePrompt: "lowres" });
    expect(f).not.toBeNull();
    expect(f!.id).toBe("inlay-soft-water");
    expect(f!.preferred).toBe("nai");
    expect(f!.nai.positive).not.toMatch(/(^|,)\s*text\s*(,|$)/);
    expect(f!.gpt.style).toContain("watercolor medium, pastel colors");
    expect(f!.gpt.style).not.toContain("foo");
    expect(f!.gpt.style).not.toContain("::");
  });
});

describe("describing a look (M4.5)", () => {
  test("the prompt carries the words and the rules; the id comes from the label", () => {
    const p = describeLookPrompt("ukiyo-e woodblock with gold leaf");
    expect(p.user).toContain("<<<ukiyo-e woodblock with gold leaf>>>");
    expect(p.user).toContain("Never ask for text");
    expect(p.user).toContain("Do not name living artists");
    expect(describedLookId("Ukiyo-e Gold!")).toBe("look-ukiyo-e-gold");
    expect(validateLook({ ...GOOD, id: describedLookId("A very long label that goes on and on past the limit") }).ok).toBe(true);
  });

  test("hard-to-read palette tokens and odd tag counts are warned about, not refused", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    const r = validateLook({ ...GOOD, nai: { positive: "ukiyo-e, gold leaf", negative: "" }, ui: { panel: "#222222", gold: "#2a2a2a" } });
    expect(r.ok).toBe(true);
    expect(r.warnings.join(" ")).toContain('"ui.gold" is hard to see on "ui.panel"');
    expect(r.warnings.join(" ")).toContain("2 tags");
  });

  test("a locked look's palette tokens go to the page with the lock", async () => {
    const fake = createFakeHost({ connections: [connection({ id: "nai", provider: "novelai", model: "nai-diffusion-5-full", is_default: true })] });
    const sent: ToFrontend[] = [];
    const api = registerArt(fake.host, (m) => sent.push(m), { batchMs: 0, sleep: async () => {}, timeoutMs: 0 });
    const checked = validateLook(GOOD);
    if (!checked.ok) throw new Error("bad fixture");
    await api.addLook(checked.look, "user");
    expect(api.lookUi()).toBeNull();
    api.handle({ type: "style.pick", lookId: "ukiyo-gold" });
    await new Promise((r) => setTimeout(r, 5));
    expect(api.lookUi()).toEqual({ gold: "#d4a017" });
    expect(sent.find((m) => m.type === "style.locked")).toMatchObject({ lookId: "ukiyo-gold", ui: { gold: "#d4a017" } });
    await api.dispose();
  });
});

describe("art keyed by look", () => {
  test("Inlay draws in the picked look: an Inlay style by its id, another look by its NAI tags, none under the default", async () => {
    const fake = createFakeHost({ connections: [connection({ id: "nai", provider: "novelai", model: "nai-diffusion-5-full", is_default: true })] });
    const host = { ...fake.host, rpcPool: { read: async () => ({ novelai: [{ id: "Soft Water", title: "Soft watercolor", prompt: "watercolor (medium), pastel colors", negativePrompt: "lowres" }] }) } };
    const api = registerArt(host as never, () => {}, { batchMs: 0, sleep: async () => {}, timeoutMs: 0 });
    const checked = validateLook(GOOD);
    if (!checked.ok) throw new Error("bad fixture");
    await api.addLook(checked.look, "user");
    expect(api.inlayStyle()).toBeNull();
    api.handle({ type: "style.pick", lookId: "ukiyo-gold" });
    await new Promise((r) => setTimeout(r, 5));
    expect(api.inlayStyle()).toEqual({ look: "ukiyo-gold", positive: GOOD.nai.positive, negative: GOOD.nai.negative });
    api.handle({ type: "style.pick", lookId: "inlay-soft-water" });
    await new Promise((r) => setTimeout(r, 5));
    expect(api.inlayStyle()).toEqual({ look: "inlay-soft-water", artist: "Soft Water" });
    api.handle({ type: "style.pick", lookId: "painted_dark_fantasy" });
    await new Promise((r) => setTimeout(r, 5));
    expect(api.inlayStyle()).toBeNull();
    await api.dispose();
  });

  test("switching to an imported look draws again under a new key and keeps the old art", async () => {
    const fake = createFakeHost({ connections: [connection({ id: "nai", provider: "novelai", model: "nai-diffusion-5-full", is_default: true })] });
    const sent: ToFrontend[] = [];
    const api = registerArt(fake.host, (m) => sent.push(m), { batchMs: 0, sleep: async () => {}, timeoutMs: 0 });
    const WOLF = { kind: "monster" as const, monster: { id: "wolf", name: "Ash Wolf", brief: "gaunt wolf", palette: "#333333", rig: "standing" as const } };
    api.request("monster:wolf", WOLF, 1);
    expect((await api.whenDone("monster:wolf")).state).toBe("ready");
    const checked = validateLook(GOOD);
    if (!checked.ok) throw new Error("bad fixture");
    await api.addLook(checked.look, "user");
    api.handle({ type: "style.pick", lookId: "ukiyo-gold" });
    await new Promise((r) => setTimeout(r, 5));
    expect(api.look().id).toBe("ukiyo-gold");
    expect(api.status("monster:wolf")).toBeNull();
    api.request("monster:wolf", WOLF, 1);
    const second = await api.whenDone("monster:wolf");
    expect(second).toMatchObject({ key: "monster:wolf", state: "ready" });
    expect(fake.calls).toHaveLength(2);
    expect(fake.calls[1]!.prompt).toContain("woodblock print");
    // The page only ever sees the bare key.
    const keys = sent.flatMap((m) => (m.type === "art.update" ? m.items.map((i) => i.key) : []));
    expect(keys.every((k) => !k.startsWith("@look:"))).toBe(true);
    await api.dispose();
    const index = Object.keys((fake.files.get(INDEX_PATH) as { entries: object }).entries).sort();
    expect(index).toEqual(["@look:ukiyo-gold|monster:wolf", "monster:wolf"]);
    expect(fake.files.get(stylePath("default"))).toMatchObject({ lookId: "ukiyo-gold" });
  });
});
