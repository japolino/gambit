/**
 * Standalone stage preview (bun run preview): mounts the battle stage in a
 * Shadow DOM root, the way the host wiring will, and plays a full battle
 * against the real engine in the browser. ?enc=<encounter id>&seed=<seed>.
 */
import { actAndAdvance } from "../src/engine/battle.js";
import { chooseAction } from "../src/engine/ai.js";
import { ENCOUNTERS, demoBattle, startEncounter } from "../src/engine/content/index.js";
import type { BattleState } from "../src/engine/types.js";
import type { ThemeId } from "../src/shared/scene-view.js";
import { mountBattleStage, type BattleStageHandle } from "../src/frontend/stage/index.js";
import { fxLibrary } from "../src/frontend/stage/fx-library.js";

// Effects and sounds from the repo's assets/ (bun run fx:import).
void fxLibrary.loadFrom("/assets/");

const params = new URLSearchParams(location.search);
const encounter = params.get("enc") ?? "drowned_shrine";
const seed = params.get("seed") ?? Math.random().toString(36).slice(2, 8);

const select = document.getElementById("enc") as HTMLSelectElement;
for (const e of Object.values(ENCOUNTERS)) {
  const o = document.createElement("option");
  o.value = e.id;
  o.textContent = e.name;
  o.selected = e.id === encounter;
  select.appendChild(o);
}
const go = (enc: string, s: string) => { location.search = `?enc=${encodeURIComponent(enc)}&seed=${encodeURIComponent(s)}`; };
select.onchange = () => go(select.value, seed);
(document.getElementById("reseed") as HTMLButtonElement).onclick = () => go(select.value, Math.random().toString(36).slice(2, 8));
(document.getElementById("info") as HTMLElement).textContent = `seed ${seed}`;

const host = document.getElementById("host")!;
const shadow = host.attachShadow({ mode: "open" });
const root = document.createElement("div");
root.style.cssText = "position:absolute;inset:0;";
shadow.appendChild(root);

let state: BattleState = encounter === "drowned_shrine" && !params.get("seed") ? demoBattle(seed) : startEncounter(encounter, seed);
let stage: BattleStageHandle | null = null;
stage = mountBattleStage(root, {
  theme: (params.get("theme") as ThemeId | null) ?? null,
  state,
  onAction(action) {
    const result = actAndAdvance(state, action, chooseAction);
    state = result.state;
    return result;
  },
});

/** Test images for setArt: a transparent figure (cut-out) and an opaque picture on white. */
function testImage(kind: "cutout" | "opaque", hue: number): string {
  const c = document.createElement("canvas");
  c.width = 400;
  c.height = 600;
  const g = c.getContext("2d")!;
  if (kind === "opaque") {
    g.fillStyle = "#f4f1ea";
    g.fillRect(0, 0, 400, 600);
  }
  const grad = g.createLinearGradient(0, 80, 0, 580);
  grad.addColorStop(0, `hsl(${hue} 45% 55%)`);
  grad.addColorStop(1, `hsl(${hue} 50% 18%)`);
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(200, 150, 62, 72, 0, 0, Math.PI * 2);
  g.moveTo(90, 580);
  g.quadraticCurveTo(80, 260, 200, 230);
  g.quadraticCurveTo(320, 260, 310, 580);
  g.fill();
  g.fillStyle = "#fff6d8";
  g.fillRect(170, 140, 14, 6);
  g.fillRect(216, 140, 14, 6);
  return c.toDataURL(kind === "opaque" ? "image/jpeg" : "image/png");
}
(document.getElementById("arttest") as HTMLButtonElement).onclick = () => {
  stage?.setArt("monster:lantern_moth", testImage("cutout", 40), { cutout: true });
  stage?.setArt("monster:bell_acolyte_unrung", testImage("cutout", 190), { cutout: true });
  stage?.setArt("class:warden", testImage("opaque", 210), { cutout: false });
};

// For poking at it from the console.
Object.assign(globalThis, { gambit: { get state() { return state; }, stage, fx: fxLibrary } });
