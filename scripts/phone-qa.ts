/**
 * Phone QA: Gambit's screens under real mobile emulation (touch, mobile viewport, DPR 2) in headless Chrome.
 * Start `bun run preview` first, then:
 *   bun run qa:phone <outDir> <what> [themes] [sizes]
 *     what:   parley | battle | scene
 *     themes: comma list, or all (default)
 *     sizes:  comma list of the names below (default bars,small,keys)
 *     BASE=http://localhost:4174 picks the preview server; QA_WAIT=2 doubles the waits on a busy machine.
 * Saves <outDir>/<theme>-<what>-<size>.jpg and one JSON line per shot in <outDir>/report.jsonl, prints what fails
 * the Parley minimums below, and exits 1 if anything did. Pixi screens can't be measured from the DOM: look at them.
 */
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const [outDir, what = "parley", themesArg, sizesArg] = process.argv.slice(2);
if (!outDir) throw new Error("usage");
const BASE = process.env.BASE ?? "http://localhost:4174";
const ALL = ["storybook", "diorama", "lobby", "table", "onebit", "command"];
const THREE_D = new Set(["table", "diorama"]);
const themes = themesArg && themesArg !== "all" ? themesArg.split(",") : ALL;
const SIZES: Record<string, [number, number]> = {
  bars: [390, 664], // a 390x844 phone, minus the browser's bars
  small: [360, 560], // a small Android with its bars
  keys: [390, 360], // the bars phone with the keyboard open
  land: [780, 340], // landscape with bars
};
const sizes = (sizesArg ?? "bars,small,keys").split(",");
mkdirSync(outDir, { recursive: true });

const prof = mkdtempSync(join(tmpdir(), "phoneqa-"));
const chrome = Bun.spawn(["C:/Program Files/Google/Chrome/Application/chrome.exe", "--headless=new", "--disable-gpu-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--hide-scrollbars", "--no-first-run", `--user-data-dir=${prof}`, "--window-size=900,900", "--remote-debugging-port=0", "about:blank"], { stdout: "ignore", stderr: "ignore" });
// Chrome picks a free port and writes it in its own profile, so runs at the same time never share a browser.
async function target(): Promise<string> {
  for (let i = 0; i < 100; i++) {
    try {
      const port = readFileSync(join(prof, "DevToolsActivePort"), "utf8").split(/\s+/)[0]!;
      const l = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()) as { type: string; webSocketDebuggerUrl: string }[];
      const p = l.find((t) => t.type === "page");
      if (p) return p.webSocketDebuggerUrl;
    } catch {}
    await Bun.sleep(150);
  }
  throw new Error("no chrome");
}
const ws = new WebSocket(await target());
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map<number, (v: any) => void>();
ws.onmessage = (e) => {
  const m = JSON.parse(String(e.data));
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)!(m.result ?? m.error);
    pending.delete(m.id);
  }
};
const send = (method: string, params: object = {}) => new Promise<any>((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });

/** Runs in the page: what a phone player gets. Looks through iframes and shadow roots. */
const MEASURE = `(() => {
  const docs = [];
  const walk = (root) => { docs.push(root); for (const el of root.querySelectorAll('*')) { if (el.shadowRoot) walk(el.shadowRoot); if (el.tagName === 'IFRAME') { try { if (el.contentDocument) walk(el.contentDocument); } catch {} } } };
  walk(document);
  const q = (s) => { for (const d of docs) { const e = d.querySelector(s); if (e) return e; } return null; };
  const frameOf = (el) => { const d = el.ownerDocument; return d && d.defaultView && d.defaultView.frameElement ? d.defaultView.frameElement.getBoundingClientRect() : { left: 0, top: 0 }; };
  const W = innerWidth, H = innerHeight;
  const out = { w: W, h: H };
  const log = q('.pl .log');
  if (log) {
    const r = log.getBoundingClientRect();
    const win = log.ownerDocument.defaultView;
    const body = log.querySelector('.prose p') || log.querySelector('.prose') || log;
    const lh = parseFloat(win.getComputedStyle(body).lineHeight) || parseFloat(win.getComputedStyle(body).fontSize) * 1.3;
    const fs = parseFloat(win.getComputedStyle(body).fontSize);
    // Sample the log's on-screen area: how much of it can really be read (not covered, not off screen).
    let hit = 0, n = 0, visTop = 1e9, visBot = -1e9;
    const dw = log.getRootNode();
    const pe = win.getComputedStyle(log).pointerEvents;
    const relax = log.ownerDocument.createElement('style');
    relax.textContent = '.pl .log, .pl .log * { pointer-events: auto !important; }';
    dw.appendChild(relax);
    for (let y = r.top + 2; y < r.bottom; y += 6) for (const fx of [0.2, 0.5, 0.8]) {
      n++;
      const x = r.left + r.width * fx;
      const vh = win.innerHeight, vw = win.innerWidth;
      if (y < 0 || y >= vh || x < 0 || x >= vw) continue;
      const top = dw.elementFromPoint(x, y);
      if (top && (top === log || log.contains(top))) { hit++; visTop = Math.min(visTop, y); visBot = Math.max(visBot, y); }
    }
    relax.remove();
    const seenH = visBot > visTop ? visBot - visTop : 0;
    out.log = { pe, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), visibleH: Math.round(seenH), share: +(hit / Math.max(n, 1)).toFixed(2), lineH: Math.round(lh), font: Math.round(fs * 10) / 10, lines: +(seenH / lh).toFixed(1), scrollH: log.scrollHeight, scrolls: log.scrollHeight > log.clientHeight + 2, overflowY: win.getComputedStyle(log).overflowY };
  }
  // Controls: can they be seen and tapped?
  const controls = [];
  for (const [name, sel] of [['input', '.pl textarea, .pl form input'], ['say', '.pl form button'], ['deal', '.pl .actions button'], ['walk', '.pl .actions button:last-child'], ['journal', '.pl .journal-btn, .pl [class*="journal"] button, .pl button[class*="journal"]']]) {
    const e = q(sel);
    if (!e) { controls.push({ name, missing: true }); continue; }
    const f = frameOf(e), r = e.getBoundingClientRect();
    const win = e.ownerDocument.defaultView;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const inView = r.width > 0 && r.height > 0 && r.top >= -1 && r.bottom <= win.innerHeight + 1 && r.left >= -1 && r.right <= win.innerWidth + 1;
    const top = inView ? e.getRootNode().elementFromPoint(cx, cy) : null;
    controls.push({ name, w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.top + f.top), inView, tappable: !!top && (top === e || e.contains(top) || top.contains(e)) });
  }
  out.controls = controls;
  // Small text and small targets across the screen.
  let tiny = [], small = [];
  for (const d of docs) {
    if (!d.querySelectorAll) continue;
    for (const e of d.querySelectorAll('button, a, input, textarea, summary, [role=button]')) {
      const r = e.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const cs = e.ownerDocument.defaultView.getComputedStyle(e);
      if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
      if (r.bottom < 0 || r.top > H) continue;
      if (Math.min(r.width, r.height) < 36) small.push((e.innerText || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 18) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    }
    const tw = d.createTreeWalker ? d.createTreeWalker(d.body || d, NodeFilter.SHOW_TEXT) : null;
    if (tw) { let node; const seen = new Set(); while ((node = tw.nextNode())) { const t = node.textContent.trim(); if (t.length < 3) continue; const p = node.parentElement; if (!p || seen.has(p)) continue; seen.add(p); const cs = p.ownerDocument.defaultView.getComputedStyle(p); const fs = parseFloat(cs.fontSize); const r = p.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > H || cs.visibility === 'hidden' || +cs.opacity === 0) continue; if (r.width <= 1 && r.height <= 1) continue; if (fs < 12 && !/^(STYLE|SCRIPT)$/.test(p.tagName)) tiny.push(t.slice(0, 22) + ' ' + fs.toFixed(1)); } }
  }
  out.smallTargets = small.slice(0, 14);
  out.tinyText = tiny.slice(0, 14);
  const de = document.documentElement;
  out.pageScrollsX = de.scrollWidth > W + 1;
  out.pageScrollsY = de.scrollHeight > H + 1;
  return JSON.stringify(out);
})()`;

/** What a phone player must get in a Parley: lines of conversation they can read, at a readable size, and the controls. */
const MIN_LINES: Record<string, number> = { bars: 9, small: 7, keys: 4, land: 4 };
const MIN_FONT = 14;
let failed = 0;
function problems(size: string, l: any): string[] {
  const out: string[] = [];
  if (!l.log) return ["no conversation log"];
  if (l.log.lines < (MIN_LINES[size] ?? 4)) out.push(`only ${l.log.lines} lines (min ${MIN_LINES[size] ?? 4})`);
  if (l.log.font < MIN_FONT) out.push(`log font ${l.log.font}px (min ${MIN_FONT})`);
  if (l.log.scrolls && !/auto|scroll/.test(l.log.overflowY)) out.push("log cannot scroll");
  if (l.log.pe === "none") out.push("log ignores touch");
  const need = size === "keys" || size === "land" ? ["input", "say"] : ["input", "say", "deal", "walk"];
  for (const c of l.controls ?? []) {
    if (!need.includes(c.name)) continue;
    if (c.missing || !c.inView || !c.tappable) out.push(`${c.name} blocked`);
    else if (c.h < 32) out.push(`${c.name} only ${c.h}px tall`);
  }
  if (l.pageScrollsX) out.push("page scrolls sideways");
  return out;
}

const urlFor = (t: string): string => {
  if (what === "parley") return THREE_D.has(t) ? `${BASE}/scene?theme=${t}&encounter=parley&snap=1` : `${BASE}/parley?theme=${t}&snap=1`;
  if (what === "battle") return `${BASE}/scene?theme=${t}&encounter=battle`;
  return `${BASE}/scene?theme=${t}`;
};

for (const t of themes) {
  for (const s of sizes) {
    const [w, h] = SIZES[s]!;
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 2, mobile: true });
    await send("Page.navigate", { url: urlFor(t) });
    await Bun.sleep((THREE_D.has(t) ? 16000 : what === "parley" ? 3500 : 9000) * Number(process.env.QA_WAIT ?? 1));
    const m = await send("Runtime.evaluate", { expression: MEASURE, returnByValue: true });
    const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 72 });
    const name = `${t}-${what}-${s}`;
    writeFileSync(join(outDir, `${name}.jpg`), Buffer.from(shot.data, "base64"));
    const line = m.result?.value ?? JSON.stringify({ error: m });
    appendFileSync(join(outDir, "report.jsonl"), `{"shot":"${name}","m":${line}}\n`);
    let l: any = {};
    try { l = JSON.parse(line); } catch {}
    const bad = what === "parley" ? problems(s, l) : [];
    if (bad.length) failed++;
    console.log(`${bad.length ? "FAIL" : "ok  "} ${name}`, l.log ? `lines ${l.log.lines} font ${l.log.font}` : "", bad.join("; "));
  }
}
ws.close();
chrome.kill();
await Bun.sleep(400);
try { rmSync(prof, { recursive: true, force: true }); } catch {}
if (failed) console.log(`${failed} shot(s) under the minimums`);
process.exit(failed ? 1 : 0);
