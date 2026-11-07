/**
 * The Scene view (docs/DESIGN.md 6.1-6.3): the place's painting (3D when it
 * can, flat when it cannot), the people in it, a nameplate dialogue box with
 * what just happened, and the menu of what you can do here. Movement follows
 * the world's shape: plain menus, a lobby of place tiles around the
 * companion, a journey's stops, or a first-person delve with an automap and
 * a command menu. Everything is reachable from the menu, on desktop and
 * phone; the delve also takes arrow keys and WASD.
 *
 * M5: frontier cards walk a honeycomb overland; the Table theme seats the
 * person you face across a table with what you know as a hand of cards;
 * the Diorama theme builds indoor places as little 3D rooms; resting plays
 * the "Meanwhile…" montage over the scene.
 */
import { fightLabel, type Hotspot } from "../../engine/world/places.js";
import type { DelveMove } from "../../engine/world/delve.js";
import type { DelveView, SceneView, ThemeId } from "../../shared/scene-view.js";
import { SceneLayer3D, webglOk, type PostFx } from "./layer3d.js";
import { drawCorridor2D } from "./corridor2d.js";

export interface SceneActions {
  act(hotspot: string): void;
  step(move: DelveMove): void;
  leave(): void;
  theme(theme: ThemeId): void;
  fight(): void;
  close(): void;
  /** Step to a neighbouring overland cell. */
  hex(q: number, r: number): void;
  /** Table theme: play a fact card on someone (talk to them, citing it). */
  cite(personId: string, text: string): void;
}

export type MeanwhileItem = { text: string; art?: string; imageId?: string | null };

export interface SceneHandle {
  readonly chatId: string;
  setView(v: SceneView): void;
  setArt(key: string, url: string, cutout?: boolean): void;
  hide(): void;
  show(): void;
  destroy(): void;
  /** "Meanwhile…": null opens the montage; the vignettes then play in turn. */
  meanwhile(day: number, items: MeanwhileItem[] | null): void;
}

/** The stage themes (6.3), all drawn as of M5. */
export const SCENE_THEMES: { id: ThemeId; label: string }[] = [
  { id: "storybook", label: "Storybook" },
  { id: "diorama", label: "Diorama" },
  { id: "lobby", label: "Lobby" },
  { id: "table", label: "Table" },
  { id: "onebit", label: "1-bit" },
  { id: "command", label: "Command" },
];
const TERRAIN_FILL: Record<string, string> = { plain: "#6f7d4a", wood: "#3d5a33", hill: "#8f7c55", water: "#2d4c66", ruin: "#6b5d5a" };
const HEX_DIRS: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

const POST: Record<ThemeId, PostFx> = { storybook: "paper", onebit: "dither", lobby: "paper", diorama: "paper", table: "paper", command: "scan" };
const KIND_ICON: Record<Hotspot["kind"], string> = { talk: "💬", search: "🔍", exit: "➜", rest: "☾", shop: "⚖", fight: "⚔", delve: "▼", wait: "⌛" };
const ONEBIT_ICON: Record<Hotspot["kind"], string> = { talk: ">", search: "?", exit: "»", rest: "z", shop: "$", fight: "!", delve: "v", wait: "." };
const ROOM_TEXT: Record<string, string> = {
  entrance: "The way you came in.",
  fight: "Signs of a struggle.",
  boss: "The heart of the place.",
  key: "Something glints here.",
  rest: "A quiet corner, safe enough to rest.",
  treasure: "Something glints here.",
  trap: "Scorch marks and a sprung plate.",
  event: "A long-abandoned chamber.",
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const CSS = `
.gs { position: absolute; inset: 0; overflow: hidden; color: #ece3cf; font: 15px/1.45 "Cormorant Garamond", "Palatino Linotype", Georgia, serif; }
.gs * { box-sizing: border-box; }
.gs .world { position: absolute; inset: 0; background: #0b0a09; }
.gs .flat { position: absolute; inset: 0; background: #0b0a09 center/cover no-repeat; transition: background-image .4s; }
.gs .flat.dim { filter: brightness(.55); }
.gs .folk { position: absolute; left: 0; right: 0; bottom: 30%; height: 62%; display: flex; justify-content: center; align-items: flex-end; gap: 2%; pointer-events: none; }
.gs .folk img { max-height: 100%; max-width: 30%; object-fit: contain; filter: drop-shadow(0 8px 18px rgba(0,0,0,.6)); }
.gs .folk img.opaque { border-radius: 10px; -webkit-mask-image: radial-gradient(ellipse 70% 72% at 50% 44%, #000 62%, transparent 100%); mask-image: radial-gradient(ellipse 70% 72% at 50% 44%, #000 62%, transparent 100%); }
.gs .hud { position: absolute; top: max(10px, env(safe-area-inset-top)); left: 12px; right: 60px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; pointer-events: none; }
.gs .chip { pointer-events: auto; background: rgba(11,10,9,.62); border: 1px solid rgba(201,168,101,.35); border-radius: 999px; padding: 4px 11px; font: 12px/1.3 "Segoe UI", system-ui, sans-serif; backdrop-filter: blur(6px); white-space: nowrap; }
.gs .chip b { color: #c9a865; font-weight: 600; }
.gs .vig { display: inline-block; width: 60px; height: 6px; border-radius: 3px; background: rgba(255,255,255,.12); vertical-align: middle; margin-left: 6px; overflow: hidden; }
.gs .vig i { display: block; height: 100%; background: linear-gradient(90deg,#b8382e,#e0604c); }
.gs select.chip { color: inherit; appearance: none; cursor: pointer; }
.gs .route { position: absolute; top: var(--hud, 52px); left: 12px; right: 12px; display: flex; align-items: center; gap: 0; font: 11px/1.2 "Segoe UI", system-ui, sans-serif; pointer-events: none; }
.gs .route .stop { display: grid; justify-items: center; gap: 3px; flex: 0 0 auto; max-width: 90px; text-align: center; opacity: .6; }
.gs .route .stop i { width: 10px; height: 10px; border-radius: 50%; border: 2px solid #c9a865; background: #0b0a09; }
.gs .route .stop.here { opacity: 1; } .gs .route .stop.here i { background: #c9a865; }
.gs .route .stop.past i { background: #7d6a45; }
.gs .route .leg { flex: 1; height: 2px; background: rgba(201,168,101,.35); margin-bottom: 14px; }
.gs .box { position: absolute; left: 12px; right: 12px; bottom: max(12px, env(safe-area-inset-bottom)); display: grid; grid-template-columns: 1fr minmax(220px, 300px); gap: 10px; align-items: end; }
.gs .say { position: relative; background: linear-gradient(180deg, rgba(23,19,15,.92), rgba(11,10,9,.94)); border: 1px solid rgba(201,168,101,.5); border-radius: 12px; padding: 18px 16px 12px; min-height: 104px; box-shadow: 0 10px 30px rgba(0,0,0,.45); }
.gs .plate { position: absolute; top: -13px; left: 14px; background: #c9a865; color: #17130f; font: 600 13px/1 "Segoe UI", system-ui, sans-serif; padding: 6px 12px; border-radius: 6px; letter-spacing: .02em; }
.gs .plate .new { font-weight: 400; opacity: .7; margin-left: 6px; }
.gs .desc { opacity: .9; }
.gs .log { margin-top: 6px; font-size: 13px; opacity: .78; display: grid; gap: 2px; max-height: 84px; overflow: auto; }
.gs .log div:last-child { opacity: 1; color: #f1d9b0; }
.gs .busy { margin-top: 6px; font-size: 13px; color: #c9a865; }
.gs .menu { background: rgba(11,10,9,.86); border: 1px solid rgba(201,168,101,.4); border-radius: 12px; padding: 8px; display: grid; gap: 4px; max-height: 46vh; overflow: auto; }
.gs .menu button, .gs .cmd button, .gs .tiles button { font: 14px/1.2 "Segoe UI", system-ui, sans-serif; color: #ece3cf; background: rgba(255,255,255,.04); border: 1px solid transparent; border-radius: 8px; padding: 9px 10px; text-align: left; cursor: pointer; display: flex; gap: 8px; align-items: center; min-height: 40px; }
.gs .menu button:hover, .gs .menu button:focus-visible, .gs .cmd button:hover, .gs .cmd button:focus-visible { border-color: rgba(201,168,101,.7); background: rgba(201,168,101,.12); outline: none; }
.gs .menu .ic { width: 18px; text-align: center; opacity: .8; }
.gs .menu .sep { height: 1px; background: rgba(201,168,101,.2); margin: 3px 2px; }
.gs .tiles { position: absolute; top: var(--hud, 56px); left: 12px; right: 12px; bottom: 210px; display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 160px)); grid-auto-rows: 96px; gap: 10px; justify-content: space-between; align-content: start; pointer-events: none; }
.gs .tiles button { pointer-events: auto; position: relative; padding: 0; overflow: hidden; border: 1px solid rgba(201,168,101,.45); background: #17130f center/cover; align-items: flex-end; min-height: 0; box-shadow: 0 6px 18px rgba(0,0,0,.5); }
.gs .tiles button span { width: 100%; padding: 6px 8px; background: linear-gradient(0deg, rgba(11,10,9,.92), rgba(11,10,9,0)); font-size: 13px; }
.gs .tiles button:hover { border-color: #c9a865; transform: translateY(-2px); }
.gs .lobbyface { position: absolute; left: 50%; bottom: 190px; transform: translateX(-50%); height: 58%; pointer-events: none; }
.gs .lobbyface img { height: 100%; object-fit: contain; filter: drop-shadow(0 10px 24px rgba(0,0,0,.7)); }
.gs .lobbyface img.opaque { border-radius: 14px; -webkit-mask-image: radial-gradient(ellipse 70% 72% at 50% 44%, #000 62%, transparent 100%); mask-image: radial-gradient(ellipse 70% 72% at 50% 44%, #000 62%, transparent 100%); }
.gs .delve2d { position: absolute; inset: 0; width: 100%; height: 100%; display: block; image-rendering: pixelated; }
.gs .automap { position: absolute; top: var(--hud, 52px); right: 12px; width: 150px; height: 150px; background: rgba(11,10,9,.78); border: 1px solid rgba(201,168,101,.45); border-radius: 10px; image-rendering: pixelated; }
.gs .cmd { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.gs .cmd button { justify-content: center; text-align: center; }
.gs .cmd .wide { grid-column: span 3; }
.gs .gone { display: none !important; }
@media (max-width: 720px) {
  .gs .box { grid-template-columns: 1fr; }
  .gs .menu { max-height: 34vh; }
  .gs .tiles { bottom: 330px; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); grid-auto-rows: 70px; }
  .gs .lobbyface { bottom: 320px; height: 36%; }
  .gs .automap { width: 110px; height: 110px; }
  .gs .say { min-height: 84px; }
}
/* 1-bit: black and white, terminal text, square frames. */
.gs.onebit { font: 14px/1.45 "Consolas", "Courier New", ui-monospace, monospace; color: #e8e2d0; }
.gs.onebit .say, .gs.onebit .menu, .gs.onebit .automap { background: #0c0b0a; border: 2px solid #e8e2d0; border-radius: 0; box-shadow: none; }
.gs.onebit .plate { background: #e8e2d0; color: #0c0b0a; border-radius: 0; font-family: inherit; }
.gs.onebit .chip { background: #0c0b0a; border: 1px solid #e8e2d0; border-radius: 0; font-family: inherit; }
.gs.onebit .chip b, .gs.onebit .busy, .gs.onebit .log div:last-child { color: #e8e2d0; }
.gs.onebit .menu button, .gs.onebit .cmd button, .gs.onebit .tiles button { font-family: inherit; border-radius: 0; }
.gs.onebit .menu button:hover, .gs.onebit .menu button:focus-visible, .gs.onebit .cmd button:hover, .gs.onebit .cmd button:focus-visible { background: #e8e2d0; color: #0c0b0a; }
.gs.onebit .flat, .gs.onebit .tiles button, .gs.onebit .folk img, .gs.onebit .lobbyface img { filter: grayscale(1) contrast(1.9) brightness(1.05); }
.gs.onebit .vig i { background: #e8e2d0; }
/* Command: a classic crawler's blue panels. */
.gs.command { font: 14px/1.4 "Consolas", "Courier New", ui-monospace, monospace; }
.gs.command .say, .gs.command .menu, .gs.command .automap { background: linear-gradient(180deg, #1b2a5a, #0f1838); border: 2px solid #c8d2f0; border-radius: 4px; }
.gs.command .plate { background: #c8d2f0; color: #0f1838; border-radius: 2px; font-family: inherit; }
.gs.command .menu button, .gs.command .cmd button { font-family: inherit; }
.gs.command .menu button:hover, .gs.command .cmd button:hover { background: rgba(200,210,240,.18); border-color: #c8d2f0; }
/* Honeycomb overland (frontier). */
.gs .hexwrap { position: absolute; top: var(--hud, 56px); right: 12px; width: min(460px, 48vw); height: min(340px, 44vh); background: rgba(11,10,9,.72); border: 1px solid rgba(201,168,101,.45); border-radius: 12px; backdrop-filter: blur(4px); }
.gs .hexwrap svg { width: 100%; height: 100%; display: block; }
.gs .hexwrap polygon { stroke: rgba(11,10,9,.85); stroke-width: 1.2; }
.gs .hexwrap .fog { fill: #17130f; }
.gs .hexwrap .step { cursor: pointer; }
.gs .hexwrap .step:hover polygon, .gs .hexwrap .step:focus-visible polygon { stroke: #f1d9b0; stroke-width: 2.4; }
.gs .hexwrap .here polygon { stroke: #c9a865; stroke-width: 3; }
.gs .hexwrap .goto { cursor: pointer; }
.gs .hexwrap text { font: 600 9px "Segoe UI", system-ui, sans-serif; fill: #ece3cf; paint-order: stroke; stroke: rgba(11,10,9,.9); stroke-width: 3px; pointer-events: none; }
.gs .hexwrap .pin { fill: #c9a865; stroke: #17130f; stroke-width: 1.5; }
.gs .hexwrap .you { fill: #f1d9b0; stroke: #17130f; stroke-width: 1.5; }
.gs .hexwrap .key { position: absolute; left: 10px; bottom: 6px; font: 11px "Segoe UI", system-ui, sans-serif; opacity: .75; pointer-events: none; }
/* Table: the person you face across a table, and your hand of fact cards. */
.gs .tabletop { position: absolute; left: -6%; right: -6%; bottom: 0; height: 40%; background: radial-gradient(ellipse at 50% 0%, #6e4a26 0%, #3d2713 55%, #1c1209 100%); border-top: 4px solid #8a6436; border-radius: 50% 50% 0 0 / 22% 22% 0 0; box-shadow: 0 -40px 90px rgba(255,180,90,.18) inset, 0 -8px 40px rgba(0,0,0,.6); pointer-events: none; }
.gs .tabletop::before { content: ""; position: absolute; left: 50%; top: 10%; width: 18px; height: 34px; margin-left: -9px; border-radius: 4px 4px 2px 2px; background: linear-gradient(#f3e3c0, #cdb68a); box-shadow: 0 -16px 30px 10px rgba(255,190,100,.35); }
.gs .hand { position: absolute; left: 12px; right: 12px; bottom: calc(max(12px, env(safe-area-inset-bottom)) + 150px); display: flex; justify-content: center; pointer-events: none; }
.gs .hand button { pointer-events: auto; flex: 0 0 auto; width: 128px; min-height: 86px; margin: 0 -9px; padding: 9px 9px 7px; text-align: left; font: 12px/1.3 Georgia, serif; color: #2a1f14; background: linear-gradient(#f3e6c8, #dcc79a); border: 1px solid #8a6d3f; border-radius: 8px; box-shadow: 0 6px 14px rgba(0,0,0,.55); transform: rotate(var(--tilt, 0deg)) translateY(8px); transition: transform .15s ease, margin .15s ease; cursor: pointer; }
.gs .hand button:hover, .gs .hand button:focus-visible { transform: rotate(0deg) translateY(-12px) scale(1.06); margin: 0 4px; z-index: 2; outline: none; }
.gs .hand button[disabled] { cursor: default; opacity: .6; }
.gs .hand .none { pointer-events: none; font: italic 13px Georgia, serif; opacity: .7; }
.gs.table .lobbyface { bottom: 34%; height: 50%; }
.gs.table .say, .gs.table .menu { background: linear-gradient(180deg, rgba(40,26,14,.94), rgba(20,13,7,.96)); border-color: rgba(214,170,100,.55); }
/* Diorama: warm, close, a little toy-like. */
.gs.diorama .say, .gs.diorama .menu { background: linear-gradient(180deg, rgba(48,32,20,.92), rgba(26,18,11,.95)); border-color: rgba(230,180,110,.5); }
.gs.diorama .plate { background: #e3b26a; }
.gs.diorama .flat { filter: sepia(.25) saturate(1.1); }
/* Meanwhile… */
.gs .mw { position: absolute; inset: 0; z-index: 5; display: grid; place-items: center; background: radial-gradient(ellipse at 50% 40%, rgba(20,16,12,.86), rgba(5,4,3,.97)); cursor: pointer; animation: mwIn .6s ease; }
.gs .mw-in { display: grid; justify-items: center; gap: 16px; width: min(640px, 90vw); }
.gs .mw-title { font: italic 34px/1 "Cormorant Garamond", Georgia, serif; color: #e9d4ad; letter-spacing: .03em; }
.gs .mw.waiting .mw-title { animation: mwPulse 1.6s ease-in-out infinite; }
.gs .mw-art { width: 100%; aspect-ratio: 16 / 9; border-radius: 12px; background: #17130f center/cover no-repeat; box-shadow: 0 16px 40px rgba(0,0,0,.6); }
.gs .mw-art.none { display: none; }
.gs .mw-text { font: 19px/1.5 "Cormorant Garamond", Georgia, serif; text-align: center; color: #f1e6cf; min-height: 3em; margin: 0; }
.gs .mw-card { display: grid; gap: 14px; width: 100%; animation: mwIn .5s ease; }
.gs .mw-dots { display: flex; gap: 6px; } .gs .mw-dots i { width: 7px; height: 7px; border-radius: 50%; background: rgba(233,212,173,.3); } .gs .mw-dots i.on { background: #e9d4ad; }
.gs .mw-hint { font: 12px "Segoe UI", system-ui, sans-serif; opacity: .55; }
@keyframes mwIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes mwPulse { 50% { opacity: .45; } }
@media (max-width: 720px) {
  .gs .hexwrap { left: 12px; right: 12px; width: auto; height: 32vh; }
  .gs .hand { bottom: 320px; }
  .gs .hand button { width: 104px; min-height: 76px; font-size: 11px; }
}
.gs.onebit .hexwrap { filter: grayscale(1) contrast(1.6); border-radius: 0; background: #0c0b0a; border: 2px solid #e8e2d0; }
@media (prefers-reduced-motion: reduce) { .gs .flat { transition: none; } .gs .tiles button:hover { transform: none; } .gs .mw, .gs .mw-card { animation: none; } .gs .hand button { transition: none; } }
`;

export function mountScene(root: HTMLElement, first: SceneView, a: SceneActions): SceneHandle {
  const el = document.createElement("div");
  el.className = "gs";
  el.setAttribute("data-gambit-stage", "scene");
  const style = document.createElement("style");
  style.textContent = CSS;
  el.innerHTML = `
    <div class="world"><div class="flat"></div><canvas class="delve2d gone"></canvas><div class="folk"></div><div class="tabletop gone"></div><div class="lobbyface gone"></div></div>
    <div class="hexwrap gone"><svg role="group" aria-label="The overland"></svg><div class="key"></div></div>
    <div class="hand gone"></div>
    <div class="tiles gone"></div>
    <div class="route gone"></div>
    <canvas class="automap gone" width="150" height="150"></canvas>
    <div class="hud"></div>
    <div class="box"><div class="say"><div class="plate"></div><div class="desc"></div><div class="log"></div><div class="busy gone"></div></div><div class="menu" role="menu"></div></div>`;
  root.append(style, el);
  const $ = <T extends HTMLElement>(sel: string) => el.querySelector(sel) as T;
  const world = $<HTMLDivElement>(".world");
  const flat = $<HTMLDivElement>(".flat");
  const folk = $<HTMLDivElement>(".folk");
  const lobbyface = $<HTMLDivElement>(".lobbyface");
  const delve2d = $<HTMLCanvasElement>(".delve2d");
  const automap = $<HTMLCanvasElement>(".automap");
  const tiles = $<HTMLDivElement>(".tiles");
  const route = $<HTMLDivElement>(".route");
  const hud = $<HTMLDivElement>(".hud");
  const plate = $<HTMLDivElement>(".plate");
  const desc = $<HTMLDivElement>(".desc");
  const log = $<HTMLDivElement>(".log");
  const busy = $<HTMLDivElement>(".busy");
  const menu = $<HTMLDivElement>(".menu");
  const hexwrap = $<HTMLDivElement>(".hexwrap");
  const hexsvg = hexwrap.querySelector("svg") as SVGSVGElement;
  const hexkey = $<HTMLDivElement>(".hexwrap .key");
  const hand = $<HTMLDivElement>(".hand");
  const tabletop = $<HTMLDivElement>(".tabletop");

  const art = new Map<string, { url: string; cutout: boolean }>();
  let view = first;
  let destroyed = false;
  let layer: SceneLayer3D | null = null;
  const low = (() => {
    try {
      return localStorage.getItem("gambit.scene.low") === "1";
    } catch {
      return false;
    }
  })();
  if (!low && webglOk()) {
    try {
      layer = new SceneLayer3D(world);
      // Clicking someone standing in the room talks to them, when you can.
      layer.onPick = (id) => {
        if (view.menu.some((h) => h.id === `talk:${id}`)) a.act(`talk:${id}`);
      };
      // For debugging from devtools: the scene element carries its 3D layer.
      (el as unknown as { gambitLayer?: SceneLayer3D }).gambitLayer = layer;
      // The 3D layer draws the room; the DOM keeps the menus and HUD.
      flat.classList.add("gone");
      folk.classList.add("gone");
    } catch {
      layer = null;
    }
  }
  const ro = new ResizeObserver(() => {
    layer?.resize();
    if (view.delve && !layer) drawDelve(view.delve);
  });
  ro.observe(el);

  const urlOf = (key: string | undefined | null) => (key ? art.get(key)?.url ?? null : null);
  const personArt = (p: SceneView["people"][number]) => (p.imageId ? { url: `/api/v1/images/${p.imageId}`, cutout: false } : art.get(p.art) ?? null);

  function onKey(e: KeyboardEvent): void {
    if (!view.delve || view.busy) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    const k = e.key.toLowerCase();
    const move: DelveMove | null = k === "arrowup" || k === "w" ? "forward" : k === "arrowdown" || k === "s" ? "back" : k === "arrowleft" || k === "a" ? "left" : k === "arrowright" || k === "d" ? "right" : k === " " || k === "f" ? "search" : null;
    if (!move) return;
    e.preventDefault();
    a.step(move);
  }
  window.addEventListener("keydown", onKey);

  function renderHud(v: SceneView): void {
    const themes = SCENE_THEMES.map((t) => `<option value="${t.id}" ${t.id === v.theme ? "selected" : ""}>${t.label}</option>`).join("");
    hud.innerHTML = `
      <span class="chip"><b>${esc(v.cardName)}</b> · ${esc(v.delve ? v.delve.name : v.place.name)}</span>
      <span class="chip">Day ${v.clock.day} · ${esc(v.clock.time)}</span>
      <span class="chip">${v.coin} ${esc(v.skin.currency || "coin")}</span>
      <span class="chip" title="How fresh the party is">Vigor<span class="vig"><i style="width:${Math.round(v.vigor * 100)}%"></i></span></span>
      ${v.hex ? `<span class="chip" title="Each step on the overland eats a day's supplies; rest in a town to refill">Supplies <b>${v.hex.supplies}/${v.hex.max}</b></span>` : ""}
      ${v.thread ? `<span class="chip" title="${esc(`${v.thread.goal}${v.thread.found.length ? `\n\n${v.thread.found.map((f) => `• ${f}`).join("\n")}` : ""}`)}">🧵 <b>${v.thread.found.length}/${v.thread.total}</b></span>` : ""}
      <select class="chip" aria-label="Scene theme">${themes}</select>`;
    hud.querySelector("select")!.addEventListener("change", (e) => a.theme((e.target as HTMLSelectElement).value as ThemeId));
    // What sits under the HUD starts below it, however many rows it wraps to.
    requestAnimationFrame(() => el.style.setProperty("--hud", `${hud.offsetTop + hud.offsetHeight + 8}px`));
  }

  function renderMenu(v: SceneView): void {
    const icons = v.theme === "onebit" ? ONEBIT_ICON : KIND_ICON;
    if (v.delve) {
      const d = v.delve;
      const search = d.room && !d.room.cleared && (d.room.kind === "key" || d.room.kind === "treasure");
      menu.innerHTML = `<div class="cmd">
        <span></span><button data-move="forward" aria-label="Step forward">▲ Advance</button><span></span>
        <button data-move="left" aria-label="Turn left">⟲ Left</button><button data-move="back" aria-label="Step back">▼ Back</button><button data-move="right" aria-label="Turn right">Right ⟳</button>
        <button class="wide" data-move="search">${search ? "✦ Search this room" : "🔍 Search"}</button>
        <button class="wide" data-leave>${d.done ? "Leave, victorious" : "Leave the delve"}</button></div>`;
      menu.querySelectorAll<HTMLButtonElement>("[data-move]").forEach((b) => b.addEventListener("click", () => a.step(b.dataset.move as DelveMove)));
      menu.querySelector("[data-leave]")!.addEventListener("click", () => a.leave());
      return;
    }
    const groups: Hotspot["kind"][][] = [["talk"], ["search", "shop", "rest", "wait"], ["exit", "delve"], ["fight"]];
    const parts: string[] = [];
    for (const g of groups) {
      const items = v.menu.filter((h) => g.includes(h.kind));
      if (!items.length) continue;
      if (parts.length) parts.push(`<div class="sep"></div>`);
      for (const h of items) parts.push(`<button role="menuitem" data-spot="${esc(h.id)}"><span class="ic">${icons[h.kind]}</span>${esc(h.label)}</button>`);
    }
    if (v.canFight && !v.menu.some((h) => h.kind === "fight")) {
      parts.push(`<div class="sep"></div><button role="menuitem" data-fight><span class="ic">${icons.fight}</span>${esc(fightLabel(v.skin.fight))}</button>`);
    }
    menu.innerHTML = parts.join("");
    menu.querySelectorAll<HTMLButtonElement>("[data-spot]").forEach((b) => b.addEventListener("click", () => a.act(b.dataset.spot!)));
    menu.querySelector("[data-fight]")?.addEventListener("click", () => a.fight());
  }

  function renderBox(v: SceneView): void {
    if (v.delve) {
      const d = v.delve;
      plate.innerHTML = `${esc(d.name)}${d.keys ? `<span class="new">🗝 ${d.keys}</span>` : ""}`;
      desc.textContent = d.done ? "Its master is beaten. The way out is open." : d.room ? (d.room.cleared && d.room.kind !== "entrance" ? "You have been here. It is quiet now." : ROOM_TEXT[d.room.kind] ?? "") : v.theme === "onebit" ? "A corridor. Go on?" : "A narrow corridor, cold and quiet.";
    } else {
      plate.innerHTML = `${esc(v.place.name)}${v.place.added ? `<span class="new">new</span>` : ""}`;
      desc.textContent = v.place.description;
    }
    log.innerHTML = v.log.map((l) => `<div>${esc(l)}</div>`).join("");
    // After layout (the box may have just been shown): newest line in view.
    requestAnimationFrame(() => (log.scrollTop = log.scrollHeight));
    busy.textContent = v.busy ?? "";
    busy.classList.toggle("gone", !v.busy);
  }

  function hexPoints(cx: number, cy: number, size: number): string {
    const out: string[] = [];
    for (let i = 0; i < 6; i++) {
      const ang = ((60 * i - 30) * Math.PI) / 180;
      out.push(`${(cx + size * Math.cos(ang)).toFixed(1)},${(cy + size * Math.sin(ang)).toFixed(1)}`);
    }
    return out.join(" ");
  }

  /** The honeycomb overland: seen cells in their terrain, fog elsewhere; neighbours are steps, known places are trips. */
  function drawHex(v: SceneView): void {
    const h = v.hex!;
    const size = 20;
    const pos = (q: number, r: number) => ({ x: size * Math.sqrt(3) * (q + r / 2), y: size * 1.5 * r });
    const here = h.cells.find((c) => c.here)!;
    const near = new Set(HEX_DIRS.map(([dq, dr]) => `${here.q + dq},${here.r + dr}`));
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const c of h.cells) {
      if (!c.seen) continue;
      const p = pos(c.q, c.r);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    const pad = size * 2.2;
    hexsvg.setAttribute("viewBox", `${(x0 - pad).toFixed(0)} ${(y0 - pad).toFixed(0)} ${(x1 - x0 + pad * 2).toFixed(0)} ${(y1 - y0 + pad * 2).toFixed(0)}`);
    const goes = new Set(v.menu.filter((m) => m.kind === "exit").map((m) => m.target));
    const parts: string[] = [];
    const labels: string[] = [];
    for (const c of h.cells) {
      const p = pos(c.q, c.r);
      const step = c.seen && near.has(`${c.q},${c.r}`) && c.terrain !== "water";
      const trip = !step && c.placeId && c.seen && goes.has(c.placeId);
      const cls = c.here ? "here" : step ? "step" : trip ? "goto" : "";
      const fill = c.seen ? TERRAIN_FILL[c.terrain] ?? "#555" : "";
      const attrs = step ? ` data-q="${c.q}" data-r="${c.r}" tabindex="0" role="button" aria-label="Step ${c.name ? `to ${esc(c.name)}` : `into ${esc(c.terrain)}`}"` : trip ? ` data-go="${esc(c.placeId!)}" tabindex="0" role="button" aria-label="Travel to ${esc(c.name ?? "")}"` : "";
      parts.push(`<g class="${cls}"${attrs}><polygon points="${hexPoints(p.x, p.y, size - 0.6)}" ${c.seen ? `style="fill:${fill}"` : `class="fog"`}><title>${esc(c.name ?? (c.seen ? c.terrain : "Unknown"))}</title></polygon></g>`);
      if (c.placeId && c.seen) {
        parts.push(`<circle class="pin" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5"/>`);
        if (c.name) labels.push(`<text x="${p.x.toFixed(1)}" y="${(p.y + size * 0.95).toFixed(1)}" text-anchor="middle">${esc(c.name.length > 18 ? `${c.name.slice(0, 17)}…` : c.name)}</text>`);
      }
    }
    const hp = pos(here.q, here.r);
    parts.push(`<circle class="you" cx="${hp.x.toFixed(1)}" cy="${(hp.y - (here.placeId ? 9 : 0)).toFixed(1)}" r="6"/>`);
    hexsvg.innerHTML = parts.join("") + labels.join("");
    hexkey.textContent = h.wild ? "Out in the wild. Step to a lit cell, or make camp." : "Step to a neighbouring cell, or tap a place to travel there.";
    hexsvg.querySelectorAll<SVGGElement>("[data-q]").forEach((g) => {
      const go = () => a.hex(Number(g.dataset.q), Number(g.dataset.r));
      g.addEventListener("click", go);
      g.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), go()));
    });
    hexsvg.querySelectorAll<SVGGElement>("[data-go]").forEach((g) => {
      const go = () => a.act(`go:${g.dataset.go}`);
      g.addEventListener("click", go);
      g.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), go()));
    });
  }

  /** Table: what you know as a hand of cards; playing one on the person across the table starts a Parley citing it. */
  function drawHand(v: SceneView): void {
    const lead = v.people[0];
    const canTalk = !!lead && v.menu.some((h) => h.id === `talk:${lead.id}`);
    if (!v.hand.length) {
      hand.innerHTML = `<span class="none">You hold no cards yet. Look around; people let things slip.</span>`;
      return;
    }
    hand.innerHTML = v.hand
      .map((f, i) => `<button data-fact="${esc(f.id)}" style="--tilt:${((i - (v.hand.length - 1) / 2) * 5).toFixed(1)}deg" ${canTalk ? `title="Play this on ${esc(lead!.name)}"` : `disabled title="Nobody here to play it on"`}>${esc(f.text)}</button>`)
      .join("");
    hand.querySelectorAll<HTMLButtonElement>("[data-fact]").forEach((b) =>
      b.addEventListener("click", () => {
        const f = v.hand.find((x) => x.id === b.dataset.fact);
        if (f && lead) a.cite(lead.id, f.text);
      }),
    );
  }

  function renderWorld(v: SceneView): void {
    const table = !v.delve && v.theme === "table";
    const lobby = !v.delve && (v.movement === "lobby" || table);
    const hexOn = !v.delve && !!v.hex && !table;
    // An indoor place in the Diorama theme: people stand in the 3D room, not as the lobby portrait.
    const room = !!layer && !v.delve && v.theme === "diorama" && v.indoor;
    hexwrap.classList.toggle("gone", !hexOn);
    if (hexOn) drawHex(v);
    hand.classList.toggle("gone", !table);
    tabletop.classList.toggle("gone", !table);
    if (table) drawHand(v);
    tiles.classList.toggle("gone", !lobby || table || !v.tiles.length);
    lobbyface.classList.toggle("gone", !lobby || room);
    route.classList.toggle("gone", !!v.delve || v.movement !== "stops" || v.route.length < 2);
    automap.classList.toggle("gone", !v.delve);
    delve2d.classList.toggle("gone", !v.delve || !!layer);
    if (lobby) {
      tiles.innerHTML = v.tiles.map((t) => `<button data-go="${esc(t.id)}" style="${urlOf(t.art) ? `background-image:url('${esc(urlOf(t.art)!)}')` : ""}"><span>${esc(t.name)}</span></button>`).join("");
      tiles.querySelectorAll<HTMLButtonElement>("[data-go]").forEach((b) => b.addEventListener("click", () => a.act(`go:${b.dataset.go}`)));
      const lead = v.people[0];
      const la = lead ? personArt(lead) : null;
      lobbyface.innerHTML = la ? `<img alt="${esc(lead!.name)}" class="${la.cutout ? "" : "opaque"}" src="${esc(la.url)}">` : "";
    }
    if (v.movement === "stops" && v.route.length >= 2) {
      const here = v.route.findIndex((r) => r.id === v.place.id);
      route.innerHTML = v.route.map((r, i) => `${i ? `<span class="leg"></span>` : ""}<span class="stop ${i === here ? "here" : i < here ? "past" : ""}"><i></i>${esc(r.name)}</span>`).join("");
    }
    if (v.delve) {
      drawAutomap(v.delve);
      if (layer) {
        layer.setPost(POST[v.theme]);
        void layer.showCorridor(
          { grid: v.delve.grid, x: v.delve.x, y: v.delve.y, facing: v.delve.facing, opened: [], glints: v.delve.rooms.filter((r) => !r.cleared && (r.kind === "key" || r.kind === "treasure")).map((r) => r.id) },
          urlOf(v.delve.textures.wall),
        );
      } else drawDelve(v.delve);
      return;
    }
    const bg = urlOf(v.place.art);
    const shown = lobby && !room ? [] : v.people.map((p) => ({ p, a: personArt(p) })).filter((x) => x.a);
    if (layer) {
      layer.setPost(POST[v.theme]);
      layer.setDolly(table ? 0.5 : 0);
      if (room) void layer.showDiorama(bg, { counter: v.menu.some((h) => h.kind === "shop") });
      else void layer.showBackdrop(bg);
      void layer.showPeople(shown.map((x) => ({ id: x.p.id, url: x.a!.url, cutout: x.a!.cutout })));
    } else {
      flat.style.backgroundImage = bg ? `url('${bg.replace(/'/g, "%27")}')` : "";
      flat.classList.toggle("dim", lobby);
      folk.innerHTML = shown.map((x) => `<img alt="${esc(x.p.name)}" class="${x.a!.cutout ? "" : "opaque"}" src="${esc(x.a!.url)}">`).join("");
    }
    if (layer && lobby && !table && !room) {
      // The lobby keeps its tiles readable over the 3D room.
      layer.setDolly(-0.4);
    }
  }

  function drawAutomap(d: DelveView): void {
    const g = automap.getContext("2d")!;
    const W = automap.width;
    const H = automap.height;
    const rows = d.grid.length;
    const cols = d.grid[0]?.length ?? 1;
    // Fit what has been seen (plus a margin), not the whole grid.
    let x0 = d.x, x1 = d.x, y0 = d.y, y1 = d.y;
    d.grid.forEach((row, y) => [...row].forEach((c, x) => {
      if (c === "?") return;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }));
    const span = Math.max(x1 - x0 + 3, y1 - y0 + 3, 7);
    const cell = Math.max(2, Math.min(16, Math.floor(Math.min(W, H) / span)));
    const ox = Math.floor(W / 2 - ((x0 + x1 + 1) / 2) * cell);
    const oy = Math.floor(H / 2 - ((y0 + y1 + 1) / 2) * cell);
    void cols;
    void rows;
    const onebit = view.theme === "onebit";
    g.clearRect(0, 0, W, H);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const c = d.grid[y]![x]!;
        if (c === "?" || c === "#") continue;
        g.fillStyle = c === "L" ? (onebit ? "#e8e2d0" : "#a8743e") : onebit ? "#8a857a" : "rgba(201,168,101,.45)";
        g.fillRect(ox + x * cell, oy + y * cell, cell, cell);
      }
    }
    for (const r of d.rooms) {
      if (r.cleared && r.kind !== "boss") continue;
      g.fillStyle = r.kind === "boss" ? "#e0604c" : r.kind === "key" || r.kind === "treasure" ? "#ffd27a" : r.kind === "rest" ? "#8fd18a" : r.kind === "fight" ? "#c4544a" : "transparent";
      if (onebit) g.fillStyle = "#e8e2d0";
      g.fillRect(ox + r.x * cell + cell * 0.25, oy + r.y * cell + cell * 0.25, cell * 0.5, cell * 0.5);
    }
    // You: a triangle pointing your way.
    const cx = ox + d.x * cell + cell / 2;
    const cy = oy + d.y * cell + cell / 2;
    const ang = (d.facing * Math.PI) / 2 - Math.PI / 2;
    g.fillStyle = onebit ? "#ffffff" : "#ece3cf";
    g.beginPath();
    g.moveTo(cx + Math.cos(ang) * cell * 0.7, cy + Math.sin(ang) * cell * 0.7);
    g.lineTo(cx + Math.cos(ang + 2.5) * cell * 0.55, cy + Math.sin(ang + 2.5) * cell * 0.55);
    g.lineTo(cx + Math.cos(ang - 2.5) * cell * 0.55, cy + Math.sin(ang - 2.5) * cell * 0.55);
    g.closePath();
    g.fill();
  }

  function drawDelve(d: DelveView): void {
    const r = delve2d.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width / 2));
    const h = Math.max(1, Math.round(r.height / 2));
    if (delve2d.width !== w || delve2d.height !== h) {
      delve2d.width = w;
      delve2d.height = h;
    }
    drawCorridor2D(delve2d, d.view, { onebit: view.theme === "onebit", wall: urlOf(d.textures.wall) });
  }

  function render(v: SceneView): void {
    view = v;
    el.classList.remove("storybook", "onebit", "lobby", "diorama", "table", "command");
    el.classList.add(v.theme);
    renderHud(v);
    renderBox(v);
    renderMenu(v);
    renderWorld(v);
  }
  render(first);

  /* ----------------------------- Meanwhile… ---------------------------- */
  let mw: { day: number; items: MeanwhileItem[] | null; i: number; box: HTMLDivElement; timer: number } | null = null;
  function closeMeanwhile(): void {
    if (!mw) return;
    clearTimeout(mw.timer);
    mw.box.remove();
    mw = null;
  }
  function openMeanwhile(day: number): void {
    closeMeanwhile();
    const box = document.createElement("div");
    box.className = "mw waiting";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "Meanwhile");
    box.innerHTML = `<div class="mw-in"><div class="mw-title">Meanwhile…</div><div class="mw-body"></div><div class="mw-hint">Night falls on day ${day - 1}</div></div>`;
    box.addEventListener("click", () => {
      if (!mw?.items) return;
      if (mw.i + 1 < mw.items.length) {
        mw.i++;
        paintMeanwhile();
      } else closeMeanwhile();
    });
    el.append(box);
    mw = { day, items: null, i: 0, box, timer: 0 };
    // Nothing came back: never leave the player stuck behind the curtain.
    mw.timer = window.setTimeout(() => !mw?.items && closeMeanwhile(), 45_000);
  }
  function paintMeanwhile(): void {
    if (!mw?.items) return;
    const m = mw;
    const item = m.items![m.i];
    if (!item) return closeMeanwhile();
    m.box.classList.remove("waiting");
    const url = item.imageId ? `/api/v1/images/${item.imageId}` : urlOf(item.art);
    const body = m.box.querySelector(".mw-body")!;
    body.innerHTML = `<div class="mw-card"><div class="mw-art ${url ? "" : "none"}" ${url ? `style="background-image:url('${esc(url)}')"` : ""}></div><p class="mw-text">${esc(item.text)}</p></div><div class="mw-dots" style="justify-content:center;margin-top:10px">${m.items!.map((_, i) => `<i class="${i === m.i ? "on" : ""}"></i>`).join("")}</div>`;
    m.box.querySelector(".mw-hint")!.textContent = m.i + 1 < m.items!.length ? "Tap to continue" : "Tap to wake";
    clearTimeout(m.timer);
    m.timer = window.setTimeout(() => {
      if (mw !== m) return;
      if (m.i + 1 < m.items!.length) {
        m.i++;
        paintMeanwhile();
      } else closeMeanwhile();
    }, 5200);
  }

  return {
    chatId: first.chatId,
    setView(v) {
      if (!destroyed) render(v);
    },
    setArt(key, url, cutout = true) {
      const prev = art.get(key);
      if (prev?.url === url) return;
      art.set(key, { url, cutout });
      const v = view;
      const used = key === v.place.art || v.tiles.some((t) => t.art === key) || v.people.some((p) => p.art === key) || key === v.delve?.textures.wall;
      if (used && !destroyed) renderWorld(v);
      if (mw && mw.items?.[mw.i]?.art === key) paintMeanwhile();
    },
    meanwhile(day, items) {
      if (destroyed) return;
      if (!items) {
        openMeanwhile(day);
        return;
      }
      if (!mw || mw.day !== day) openMeanwhile(day);
      mw!.items = items;
      mw!.i = 0;
      paintMeanwhile();
    },
    hide() {
      el.classList.add("gone");
    },
    show() {
      el.classList.remove("gone");
      layer?.resize();
      requestAnimationFrame(() => (log.scrollTop = log.scrollHeight));
    },
    destroy() {
      destroyed = true;
      closeMeanwhile();
      window.removeEventListener("keydown", onKey);
      ro.disconnect();
      layer?.destroy();
      el.remove();
      style.remove();
    },
  };
}
