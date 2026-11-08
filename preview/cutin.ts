/**
 * Cut-in harness (bun run preview, then /cutin): the battle stage with a
 * cut-in layered over it, for judging the cut-in by eye or by screenshot.
 *   ?img=<url>        the action splash (opaque unless &cutout=1); default a test picture
 *   &at=<seconds>     freeze at that moment (omit to play it through)
 *   &enemy=1          from the enemy side
 *   &ult=1            an ultimate (the full-screen cut-in; otherwise the panel)
 *   &name=<skill>     skill name; &actor=<name>
 * window.play(at?) replays it.
 */
import { Application, Assets, Container, Rectangle, Texture } from "pixi.js";
import { demoBattle } from "../src/engine/content/index.js";
import type { ThemeId } from "../src/shared/scene-view.js";
import { mountBattleStage } from "../src/frontend/stage/index.js";
import { Clock } from "../src/frontend/stage/anim.js";
import { playCutIn } from "../src/frontend/stage/cutin/cutin.js";

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

const app = new Application();
await app.init({ backgroundAlpha: 0, resizeTo: over, antialias: true, resolution: devicePixelRatio, autoDensity: true });
over.appendChild(app.canvas);
const layer = new Container();
app.stage.addChild(layer);
const clock = new Clock(app.ticker);
const tex: Texture = await Assets.load({ src: params.get("img") ?? testSplash(), loadParser: "loadTextures" });
const cutout = params.get("cutout") === "1";

async function play(at?: number): Promise<void> {
  layer.removeChildren();
  (globalThis as { ready?: boolean }).ready = false;
  const w = over.clientWidth;
  const h = over.clientHeight;
  const ui = Math.max(0.85, Math.min(1.35, Math.min(w / 1100, h / 760)));
  const texture = cutout ? new Texture({ source: tex.source, frame: new Rectangle(0, 0, tex.width, tex.height) }) : tex;
  if (at !== undefined) {
    // Step frames by hand to the exact moment (a hidden or throttled page barely ticks), then hold.
    // The cut-in may load a font first: wait until it is on the layer.
    app.ticker.stop();
    let ms = app.ticker.lastTime;
    void (async () => {
      while (layer.children.length === 0) await new Promise((r) => setTimeout(r, 20));
      const start = clock.now;
      while (clock.now - start < at) {
        ms += 1000 / 60;
        app.ticker.update(ms);
      }
      app.render();
      (globalThis as { ready?: boolean }).ready = true;
    })();
  } else app.ticker.start();
  await playCutIn({
    layer, clock, w, h, ui,
    portrait: texture, face: cutout ? { x: 0.5, y: 0.36 } : undefined, splash: cutout, framed: !cutout, ultimate: params.get("ult") === "1",
    visual: undefined, skillName: params.get("name") ?? "Towering Demon Form", actorName: params.get("actor") ?? "Stolas", enemy: params.get("enemy") === "1",
  });
}
Object.assign(globalThis, { play, layer, clock });
void play(params.has("at") ? Number(params.get("at")) : undefined);
