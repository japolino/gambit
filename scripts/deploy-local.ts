/**
 * Copy the built extension into a local Lumiverse install for testing.
 *   bun run build && bun scripts/deploy-local.ts [D:/Lumiverse]
 * First time: then use Lumiverse's "Import local extensions" (owner) to
 * register it. Later: restart the extension and refresh the page.
 * The deployed manifest gets `dev_mode: true` so a host update never
 * git-resets this local copy.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const host = process.argv[2] ?? "D:/Lumiverse";
const target = join(host, "data", "extensions", "gambit", "repo");
if (!existsSync(join(host, "data", "extensions"))) {
  console.error(`No extensions folder under ${host}/data`);
  process.exit(1);
}
if (!existsSync("dist/backend.js") || !existsSync("dist/frontend.js")) {
  console.error("Build first: bun run build");
  process.exit(1);
}
mkdirSync(join(target, "dist"), { recursive: true });
cpSync("dist", join(target, "dist"), { recursive: true });
cpSync("package.json", join(target, "package.json"));
const manifest = JSON.parse(readFileSync("spindle.json", "utf8"));
manifest.dev_mode = true;
writeFileSync(join(target, "spindle.json"), JSON.stringify(manifest, null, 2));
mkdirSync(join(host, "data", "extensions", "gambit", "storage"), { recursive: true });
// Effects and sounds: in the repo copy, and in storage where an install would seed them (spindle.json).
if (existsSync("assets")) {
  cpSync("assets", join(target, "assets"), { recursive: true });
  cpSync("assets", join(host, "data", "extensions", "gambit", "storage", "assets"), { recursive: true });
  // The local-only demo set (assets/demo/, git-ignored): its manifest covers the main files plus the demo ones.
  if (existsSync("assets/demo/manifest.json")) {
    cpSync("assets/demo/manifest.json", join(target, "assets", "manifest.json"));
    cpSync("assets/demo/manifest.json", join(host, "data", "extensions", "gambit", "storage", "assets", "manifest.json"));
  }
}
console.log(`Deployed to ${target}`);
