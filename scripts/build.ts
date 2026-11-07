/**
 * Builds the two Spindle bundles. Each must be one self-contained ESM file:
 * the host imports the frontend from a blob URL, so code-split chunks would
 * not resolve (docs/DESIGN.md, 8.1).
 */
const common = { target: "browser" as const, format: "esm" as const, minify: true, splitting: false };

for (const [entry, out] of [
  ["./src/backend.ts", "backend.js"],
  ["./src/frontend.ts", "frontend.js"],
] as const) {
  const result = await Bun.build({ ...common, entrypoints: [entry], naming: out, outdir: "./dist" });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }
  const size = result.outputs.reduce((n, o) => n + o.size, 0);
  console.log(`dist/${out}  ${(size / 1024).toFixed(0)} KB`);
}

export {};
