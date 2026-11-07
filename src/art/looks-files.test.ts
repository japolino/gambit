import { describe, expect, test } from "bun:test";
import { registerArt } from "./controller.js";
import { lookFromInlayArtist, validateLook } from "./look-file.js";
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

describe("art keyed by look", () => {
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
