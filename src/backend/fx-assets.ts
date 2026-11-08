/**
 * The effect sheets and sounds in assets/ (src/shared/fx.ts), read from extension storage, where spindle.json's
 * storage_seed_files copies the repo's assets/ on install and update. The stage asks once ("fx.get"); the
 * manifest goes first, then each file its slots use, as base64 in parts under the 4 MB message cap. Files are read
 * and encoded once and kept.
 */
import type { SpindleAPI } from "lumiverse-spindle-types";
import { ART_CHUNK_CHARS, chunkBase64 } from "../art/chunks.js";
import type { FxManifest } from "../shared/fx.js";
import type { ToFrontend } from "../shared/protocol.js";

const MIME: Record<string, string> = { png: "image/png", mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav", m4a: "audio/mp4" };
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function toBase64(b: Uint8Array): string {
  const out: string[] = [];
  let line = "";
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i]! << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    line += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + (i + 1 < b.length ? B64[(n >> 6) & 63]! : "=") + (i + 2 < b.length ? B64[n & 63]! : "=");
    if (line.length >= 65536) {
      out.push(line);
      line = "";
    }
  }
  out.push(line);
  return out.join("");
}

export function createFxAssets(spindle: SpindleAPI, send: (msg: ToFrontend, userId: string) => void, log: (m: string) => void) {
  let manifest: Promise<FxManifest | null> | null = null;
  const files = new Map<string, Promise<string | null>>();

  const loadManifest = () =>
    (manifest ??= spindle.storage
      .getJson<FxManifest | null>("assets/manifest.json", { fallback: null })
      .then((m) => (m && m.version === 1 ? m : null))
      .catch(() => null));

  const loadFile = (file: string) => {
    let f = files.get(file);
    if (!f) {
      f = spindle.storage.readBinary(`assets/${file}`).then(toBase64).catch((e) => {
        log(`fx: cannot read assets/${file}: ${String(e)}`);
        return null;
      });
      files.set(file, f);
    }
    return f;
  };

  /** Send the manifest and the files its slots use. */
  async function serve(userId: string): Promise<void> {
    const m = await loadManifest();
    send({ type: "fx.manifest", manifest: m }, userId);
    if (!m) return;
    const used = new Set<string>();
    for (const s of Object.values(m.slots)) {
      if (s.fx && s.fx !== "none" && m.effects[s.fx]) used.add(m.effects[s.fx]!.file);
      if (s.sound && s.sound !== "none" && m.sounds[s.sound]) used.add(m.sounds[s.sound]!.file);
    }
    for (const file of used) {
      const mime = MIME[file.split(".").pop()?.toLowerCase() ?? ""];
      const data = mime ? await loadFile(file) : null;
      if (!mime || data === null) continue;
      const parts = chunkBase64(data, ART_CHUNK_CHARS);
      parts.forEach((part, i) => send({ type: "fx.file", file, mime, part: i, parts: parts.length, data: part }, userId));
    }
  }

  return { serve };
}
