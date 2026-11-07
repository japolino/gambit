/**
 * Validate Gambit look files with Gambit's own validator.
 *
 *   bun run .claude/skills/gambit-look/scripts/validate.ts look.json [more.json…] [--repo <gambit repo>]
 *
 * The repo is found from --repo, then GAMBIT_REPO, then this script's place
 * inside a Gambit checkout (.claude/skills/gambit-look/scripts).
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const at = args.indexOf("--repo");
const repoArg = at >= 0 ? args.splice(at, 2)[1] : undefined;
const repo = resolve(repoArg ?? process.env.GAMBIT_REPO ?? join(import.meta.dir, "..", "..", "..", ".."));
const source = join(repo, "src", "art", "look-file.ts");
if (!existsSync(source)) {
  console.error(`Can't find Gambit's validator at ${source}. Pass --repo <path to the gambit repo> or set GAMBIT_REPO.`);
  process.exit(2);
}
if (!args.length) {
  console.error("usage: validate.ts <look.json>... [--repo <gambit repo>]");
  process.exit(2);
}

type Check = { ok: true; look: { id: string; label: string }; warnings: string[] } | { ok: false; errors: string[]; warnings: string[] };
const mod = (await import(pathToFileURL(source).href)) as { validateLook(raw: unknown): Check };

let bad = 0;
for (const path of args) {
  let raw: unknown;
  try {
    raw = JSON.parse(await Bun.file(path).text());
  } catch (err) {
    console.log(`✗ ${path}: not JSON (${err instanceof Error ? err.message : String(err)})`);
    bad++;
    continue;
  }
  const r = mod.validateLook(raw);
  if (r.ok) console.log(`✓ ${path}: ${r.look.label} (${r.look.id})`);
  else {
    bad++;
    console.log(`✗ ${path}`);
    for (const e of r.errors) console.log(`    error: ${e}`);
  }
  for (const w of r.warnings) console.log(`    note: ${w}`);
}
process.exit(bad ? 1 : 0);
