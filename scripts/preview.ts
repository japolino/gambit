/**
 * Stage preview server: bundles preview/main.ts (the stage plus the real
 * engine) and serves it with preview/index.html at http://localhost:4174
 * (PORT overrides). The bundle is rebuilt on each page load, so a refresh
 * picks up edits. No Lumiverse needed.
 */
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const port = Number(process.env.PORT ?? 4174);

async function bundle(): Promise<Response> {
  const result = await Bun.build({
    entrypoints: [join(root, "preview/main.ts")],
    target: "browser",
    format: "esm",
    splitting: false,
    sourcemap: "inline",
    minify: process.env.MINIFY === "1",
  });
  if (!result.success) {
    const text = result.logs.map((l) => String(l)).join("\n");
    console.error(text);
    return new Response(`console.error(${JSON.stringify(text)})`, { headers: { "content-type": "text/javascript" } });
  }
  return new Response(await result.outputs[0]!.text(), { headers: { "content-type": "text/javascript", "cache-control": "no-store" } });
}

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/main.js") return bundle();
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(Bun.file(join(root, "preview/index.html")), { headers: { "content-type": "text/html", "cache-control": "no-store" } });
    }
    return new Response("not found", { status: 404 });
  },
});

console.log(`Gambit stage preview: http://localhost:${port}`);
