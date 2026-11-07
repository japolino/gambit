/**
 * Checks look files (docs/DESIGN.md 5.2a): schema, sizes, tags, sentences,
 * and that nothing asks for text in the image.
 *
 *   bun run scripts/validate-look.ts looks/*.json
 *   bun run scripts/validate-look.ts --presets   # writes the built-in looks to looks/
 */
import { fileFromLook, validateLook } from "../src/art/look-file.js";
import { LOOKS, LOOK_IDS } from "../src/art/looks.js";

const args = process.argv.slice(2);
if (args[0] === "--presets") {
  for (const id of LOOK_IDS) {
    const file = fileFromLook(LOOKS[id], { author: "Gambit", description: `Built-in look: ${LOOKS[id].label}.` });
    await Bun.write(`looks/${id}.json`, `${JSON.stringify(file, null, 2)}\n`);
    console.log(`looks/${id}.json`);
  }
  process.exit(0);
}
if (!args.length) {
  console.error("usage: bun run scripts/validate-look.ts <look.json>... | --presets");
  process.exit(2);
}
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
  const r = validateLook(raw);
  if (r.ok) console.log(`✓ ${path}: ${r.look.label} (${r.look.id})`);
  else {
    bad++;
    console.log(`✗ ${path}`);
    for (const e of r.errors) console.log(`    ${e}`);
  }
  for (const w of r.warnings) console.log(`    note: ${w}`);
}
process.exit(bad ? 1 : 0);
