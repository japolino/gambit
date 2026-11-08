/**
 * Cut-in harness (bun run preview, then /cutin): the battle stage with a
 * cut-in layered over it, for judging the cut-in by eye or by screenshot.
 *   ?img=<url>        the action splash (opaque unless &cutout=1); default a test picture
 *   &at=<seconds>     freeze at that moment (omit to play it through)
 *   &enemy=1          from the enemy side
 *   &none=1           no cut-in, just the battle behind
 *   &ult=1            an ultimate (the full-screen cut-in; otherwise the panel)
 *   &name=<skill>     skill name; &actor=<name>
 *   &capture=1        render offscreen at &w x &h (default 1920x1080) for window.capture(fps): every frame is
 *                     posted to the preview server, which saves it to GAMBIT_CAPTURE_DIR (for a video);
 *                     window.cues(seconds) plays it through once and returns the sounds it fired
 *                     ({ slot, file, volume, t }, t in seconds from the start) for mixing the video's audio
 * window.play(at?) replays it.
 */
import { Application, Assets, Container, Rectangle, Texture } from "pixi.js";
import { demoBattle } from "../src/engine/content/index.js";
import type { ThemeId } from "../src/shared/scene-view.js";
import { mountBattleStage } from "../src/frontend/stage/index.js";
import { Clock } from "../src/frontend/stage/anim.js";
import { playCutIn } from "../src/frontend/stage/cutin/cutin.js";
import { fxLibrary } from "../src/frontend/stage/fx-library.js";

const params = new URLSearchParams(location.search);
const host = document.getElementById("host")!;
const shadow = host.attachShadow({ mode: "open" });
const root = document.createElement("div");
root.style.cssText = "position:absolute;inset:0;";
shadow.appendChild(root);
let state = demoBattle("cutin");
mountBattleStage(root, { state, onAction: () => ({ state, events: [] }) as never, theme: (params.get("theme") as ThemeId | null) ?? null });

const over = document.createElement("div");
over.style.cssText = "position:absolute;inset:0;pointer-events:none;";
shadow.appendChild(over);

function testSplash(): string {
  const c = document.createElement("canvas");
  c.width = 1216;
  c.height = 832;
  const g = c.getContext("2d")!;
  const bg = g.createRadialGradient(400, 300, 40, 600, 420, 900);
  bg.addColorStop(0, "#ffd9f0");
  bg.addColorStop(1, "#6a0f3a");
  g.fillStyle = bg;
  g.fillRect(0, 0, 1216, 832);
  g.fillStyle = "#1c1020";
  g.beginPath();
  g.ellipse(420, 260, 90, 110, 0, 0, Math.PI * 2);
  g.moveTo(250, 832);
  g.quadraticCurveTo(260, 400, 420, 370);
  g.quadraticCurveTo(620, 400, 700, 832);
  g.fill();
  g.beginPath();
  g.ellipse(860, 330, 230, 120, -0.4, 0, Math.PI * 2);
  g.fill();
  return c.toDataURL("image/jpeg");
}

const capturing = params.get("capture") === "1";
const capW = Number(params.get("w") ?? 1920);
const capH = Number(params.get("h") ?? 1080);
const app = new Application();
if (capturing) await app.init({ backgroundAlpha: 0, width: capW, height: capH, antialias: true, resolution: 1, preserveDrawingBuffer: true });
else await app.init({ backgroundAlpha: 0, resizeTo: over, antialias: true, resolution: devicePixelRatio, autoDensity: true });
if (!capturing) over.appendChild(app.canvas);
// Effect sheets and sounds from the repo's assets/.
await fxLibrary.loadFrom("/assets/");
fxLibrary.muted = capturing;
type Cue = { slot: string; file: string; volume: number; t: number };
let cueLog: Cue[] | null = null;
let cutStart = 0;
const layer = new Container();
app.stage.addChild(layer);
const clock = new Clock(app.ticker);
// Sound cues on the cut-in's own clock (a capture steps it by hand).
fxLibrary.now = () => clock.now;
fxLibrary.onSound = (c) => cueLog?.push({ slot: c.slot, file: c.file, volume: c.volume, t: +(c.at - cutStart).toFixed(4) });
const tex: Texture = await Assets.load({ src: params.get("img") ?? testSplash(), loadParser: "loadTextures" });
const cutout = params.get("cutout") === "1";

function options(): Parameters<typeof playCutIn>[0] {
  const w = capturing ? capW : over.clientWidth;
  const h = capturing ? capH : over.clientHeight;
  const ui = Math.max(0.85, Math.min(1.35, Math.min(w / 1100, h / 760)));
  const texture = cutout ? new Texture({ source: tex.source, frame: new Rectangle(0, 0, tex.width, tex.height) }) : tex;
  return {
    layer, clock, w, h, ui,
    portrait: texture, face: cutout ? { x: 0.5, y: 0.36 } : undefined, splash: cutout, framed: !cutout, ultimate: params.get("ult") === "1",
    visual: undefined, skillName: params.get("name") ?? "Towering Demon Form", actorName: params.get("actor") ?? "Corvin", enemy: params.get("enemy") === "1",
  };
}

async function play(at?: number): Promise<void> {
  layer.removeChildren();
  (globalThis as { ready?: boolean }).ready = false;
  if (at !== undefined) {
    // Step frames by hand to the exact moment (a hidden or throttled page barely ticks), then hold.
    // The cut-in may load a font first: wait until it is on the layer.
    app.ticker.stop();
    let ms = app.ticker.lastTime;
    void (async () => {
      while (layer.children.length === 0) await new Promise((r) => setTimeout(r, 20));
      const start = clock.now;
      cutStart = start;
      while (clock.now - start < at) {
        ms += 1000 / 60;
        app.ticker.update(ms);
      }
      app.render();
      (globalThis as { ready?: boolean }).ready = true;
    })();
  } else {
    cutStart = clock.now;
    app.ticker.start();
  }
  await playCutIn(options());
}
/**
 * Play it once, stepping the clock by hand, and post every frame (transparent PNGs) to the preview server; the
 * sounds it fires are logged on the same pass (window.lastCues). Resolves with the frame count.
 */
async function capture(fps = 30, seconds = 2.6): Promise<number> {
  const n = Math.ceil(fps * seconds);
  layer.removeChildren();
  app.ticker.stop();
  let ms = app.ticker.lastTime;
  cueLog = [];
  void playCutIn(options());
  while (layer.children.length === 0) await new Promise((r) => setTimeout(r, 20));
  const start = clock.now;
  cutStart = start;
  for (let i = 0; i < n; i++) {
    while (clock.now - start < i / fps + 1 / 120) {
      ms += 1000 / 60;
      app.ticker.update(ms);
    }
    app.render();
    const canvas = app.renderer.extract.canvas({ target: app.stage, frame: new Rectangle(0, 0, capW, capH) }) as HTMLCanvasElement;
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/png"));
    await fetch(`/capture/${String(i).padStart(4, "0")}.png`, { method: "POST", body: blob });
  }
  (globalThis as { lastCues?: Cue[] }).lastCues = cueLog;
  cueLog = null;
  return n;
}
/** Play it through once (stepped, so every beat fires) and return the sounds it fired. */
async function cues(seconds = 4.6): Promise<Cue[]> {
  const g = globalThis as { ready?: boolean };
  cueLog = [];
  void play(seconds);
  while (!g.ready) await new Promise((r) => setTimeout(r, 5));
  const out = cueLog;
  cueLog = null;
  return out;
}
Object.assign(globalThis, { play, capture, cues, layer, clock });
// &none=1: just the battle (a backdrop for a captured video).
if (!capturing && params.get("none") !== "1") void play(params.has("at") ? Number(params.get("at")) : undefined);
