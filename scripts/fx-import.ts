/**
 * Index the effect sheets and sounds in assets/ into assets/manifest.json.
 *   bun run fx:import
 *
 * assets/fx/   sprite sheets (PNG): one effect per sheet, frames in a grid, read left to right, top to bottom.
 * assets/sfx/  sounds (mp3, ogg, wav).
 *
 * Each sheet's frame grid is guessed from its size (a strip of square frames, or the largest common frame size that
 * divides it). A guess can be wrong: fix frameW/frameH in the manifest, and the next import keeps your fix. A name
 * like `slash_192x192.png` or `burst_5x2.png` (columns x rows) sets the grid exactly.
 *
 * `slots` says what plays where (see SLOTS in src/shared/fx.ts). The import fills an empty slot from file names
 * (slash, impact, shatter...), never overwrites a slot you set, and lists files that nothing uses yet.
 * Credits: give each effect and sound a `source` (site, pack, license) and the import rewrites assets/CREDITS.md.
 *
 * assets/demo/ (git-ignored) holds extra files for a local demo only. When it exists, the import also writes
 * assets/demo/manifest.json: everything above plus the demo files (ids prefixed `demo_`, paths `demo/...`), with
 * its own slots (seeded from the main manifest, then kept like the main ones) and assets/demo/CREDITS.md. The
 * standalone preview reads the demo manifest first; assets/manifest.json never mentions demo files.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import { SLOTS, type FxManifest, type FxSheet, type FxSound } from "../src/shared/fx.js";

const root = join(import.meta.dir, "..");
const assets = join(root, "assets");
const fxDir = join(assets, "fx");
const sfxDir = join(assets, "sfx");
const demo = join(assets, "demo");
mkdirSync(fxDir, { recursive: true });
mkdirSync(sfxDir, { recursive: true });

const walk = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? walk(p) : [p];
      })
    : [];
const rel = (p: string) => relative(assets, p).replace(/\\/g, "/");
/** A stable id from the file's path inside its folder: lower case, words joined by _. */
const idOf = (p: string, base: string, prefix: string) =>
  prefix + relative(base, p).replace(/\\/g, "/").replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

function pngSize(file: string): { w: number; h: number } | null {
  const b = readFileSync(file);
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47 || b.toString("ascii", 12, 16) !== "IHDR") return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

const COMMON = [512, 480, 400, 384, 320, 300, 256, 240, 200, 192, 160, 150, 128, 120, 100, 96, 80, 64, 48, 32];
function guessGrid(name: string, w: number, h: number): { frameW: number; frameH: number; guessed: boolean } {
  const px = name.match(/(\d{2,4})x(\d{2,4})/);
  if (px && w % +px[1]! === 0 && h % +px[2]! === 0) return { frameW: +px[1]!, frameH: +px[2]!, guessed: false };
  const grid = name.match(/(?:^|[^\d])(\d{1,2})x(\d{1,2})(?:[^\d]|$)/);
  if (grid && w % +grid[1]! === 0 && h % +grid[2]! === 0) return { frameW: w / +grid[1]!, frameH: h / +grid[2]!, guessed: false };
  if (w % h === 0) return { frameW: h, frameH: h, guessed: true };
  if (h % w === 0) return { frameW: w, frameH: w, guessed: true };
  const size = COMMON.find((s) => w % s === 0 && h % s === 0);
  return size ? { frameW: size, frameH: size, guessed: true } : { frameW: w, frameH: h, guessed: true };
}

const read = (file: string): FxManifest | null => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null);
type Roots = { fx: string; sfx: string; prefix: string }[];

/** Index the files under `roots`, keeping what `old` set (grids, fps, blend, scale, volume, sources, slots). */
function build(old: FxManifest, roots: Roots, notes: string[]): { m: FxManifest; usedFx: Set<string>; usedSfx: Set<string> } {
  const next: FxManifest = { version: 1, effects: {}, sounds: {}, slots: {} };
  for (const r of roots) {
    for (const file of walk(r.fx).filter((f) => extname(f).toLowerCase() === ".png").sort()) {
      const id = idOf(file, r.fx, r.prefix);
      const size = pngSize(file);
      if (!size) {
        notes.push(`skipped ${rel(file)}: not a readable PNG`);
        continue;
      }
      const prev = old.effects[id];
      const keep = prev && prev.file === rel(file) && prev.width === size.w && prev.height === size.h;
      const g = keep ? { frameW: prev.frameW, frameH: prev.frameH, guessed: false } : guessGrid(basename(file), size.w, size.h);
      const cols = Math.max(1, Math.floor(size.w / g.frameW));
      const rows = Math.max(1, Math.floor(size.h / g.frameH));
      const sheet: FxSheet = {
        file: rel(file), width: size.w, height: size.h, frameW: g.frameW, frameH: g.frameH,
        frames: keep ? Math.min(prev.frames, cols * rows) : cols * rows,
        fps: prev?.fps ?? 30, blend: prev?.blend ?? "add", scale: prev?.scale ?? 1, source: prev?.source ?? "",
      };
      next.effects[id] = sheet;
      if (g.guessed) notes.push(`${rel(file)}: guessed ${cols}x${rows} frames of ${g.frameW}x${g.frameH}; check it in the preview`);
    }
    for (const file of walk(r.sfx).filter((f) => [".mp3", ".ogg", ".wav", ".m4a"].includes(extname(f).toLowerCase())).sort()) {
      const id = idOf(file, r.sfx, r.prefix);
      const prev = old.sounds[id];
      const sound: FxSound = { file: rel(file), volume: prev?.volume ?? 0.8, source: prev?.source ?? "" };
      next.sounds[id] = sound;
    }
  }
  // Slots: keep what was set (if its files still exist), else guess from names.
  const pick = <T>(pool: Record<string, T>, words: readonly string[], used: Set<string>): string | null => {
    const ids = Object.keys(pool);
    for (const w of words) {
      const hit = ids.find((id) => id.includes(w) && !used.has(id)) ?? ids.find((id) => id.includes(w));
      if (hit) return hit;
    }
    return null;
  };
  const usedFx = new Set<string>();
  const usedSfx = new Set<string>();
  for (const [slot, words] of Object.entries(SLOTS)) {
    const prev = old.slots[slot];
    // "none" turns a slot off for good; null is just empty and gets filled when a matching file appears.
    const fx = prev?.fx === "none" ? "none" : prev?.fx && next.effects[prev.fx] ? prev.fx : pick(next.effects, words, usedFx);
    const sound = prev?.sound === "none" ? "none" : prev?.sound && next.sounds[prev.sound] ? prev.sound : pick(next.sounds, words, usedSfx);
    if (fx && fx !== "none") usedFx.add(fx);
    if (sound && sound !== "none") usedSfx.add(sound);
    next.slots[slot] = { fx: fx ?? null, sound: sound ?? null, ...(prev?.tint ? { tint: prev.tint } : {}), ...(prev?.scale ? { scale: prev.scale } : {}) };
  }
  return { m: next, usedFx, usedSfx };
}

function credits(file: string, m: FxManifest, intro: string): void {
  const credit = (kind: string, rows: [string, { file: string; source: string }][]) =>
    rows.length ? [`## ${kind}`, "", ...rows.map(([, v]) => `- \`${v.file}\` - ${v.source || "**source missing: add it in the manifest**"}`), ""] : [];
  writeFileSync(file, ["# Effect and sound credits", "", intro, "", ...credit("Effects", Object.entries(m.effects)), ...credit("Sounds", Object.entries(m.sounds))].join("\n"));
}

function report(label: string, r: { m: FxManifest; usedFx: Set<string>; usedSfx: Set<string> }, notes: string[]): void {
  const { m } = r;
  const bytes = [...Object.values(m.effects), ...Object.values(m.sounds)].reduce((n, e) => n + statSync(join(assets, e.file)).size, 0);
  const unused = [...Object.keys(m.effects).filter((id) => !r.usedFx.has(id)), ...Object.keys(m.sounds).filter((id) => !r.usedSfx.has(id))];
  const empty = Object.entries(m.slots).filter(([, s]) => !s.fx && !s.sound).map(([k]) => k);
  const missing = [...Object.values(m.effects), ...Object.values(m.sounds)].filter((e) => !e.source).length;
  console.log(`${label}: ${Object.keys(m.effects).length} effects, ${Object.keys(m.sounds).length} sounds, ${(bytes / 1048576).toFixed(1)} MB`);
  for (const n of notes) console.log(`  ! ${n}`);
  if (empty.length) console.log(`  empty slots: ${empty.join(", ")}`);
  if (unused.length) console.log(`  not used by any slot: ${unused.join(", ")}`);
  if (missing) console.log(`  ${missing} file(s) have no source yet; the credits mark them`);
}

const out = join(assets, "manifest.json");
const empty: FxManifest = { version: 1, effects: {}, sounds: {}, slots: {} };
const notes: string[] = [];
const base = build(read(out) ?? empty, [{ fx: fxDir, sfx: sfxDir, prefix: "" }], notes);
writeFileSync(out, JSON.stringify(base.m, null, 2) + "\n");
credits(join(assets, "CREDITS.md"), base.m, "Generated by `bun run fx:import` from the `source` fields in assets/manifest.json.");
report("assets/manifest.json", base, notes);

// The local-only demo set, layered over the main one.
if (existsSync(demo)) {
  const demoOut = join(demo, "manifest.json");
  const prev = read(demoOut);
  // Seed from the main manifest; the demo's own settings win where it has them.
  const seed: FxManifest = {
    version: 1,
    effects: { ...base.m.effects, ...(prev?.effects ?? {}) },
    sounds: { ...base.m.sounds, ...(prev?.sounds ?? {}) },
    slots: { ...base.m.slots, ...(prev?.slots ?? {}) },
  };
  const dnotes: string[] = [];
  const d = build(seed, [{ fx: fxDir, sfx: sfxDir, prefix: "" }, { fx: join(demo, "fx"), sfx: join(demo, "sfx"), prefix: "demo_" }], dnotes);
  writeFileSync(demoOut, JSON.stringify(d.m, null, 2) + "\n");
  credits(join(demo, "CREDITS.md"), d.m, "Local demo set (assets/demo/, not in git). Generated by `bun run fx:import` from assets/demo/manifest.json.");
  report("assets/demo/manifest.json", d, dnotes);
}
