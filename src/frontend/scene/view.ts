/**
 * The Scene view (docs/DESIGN.md 6.1-6.3): the place's painting (3D when it
 * can, flat when it cannot), the people in it, a nameplate dialogue box with
 * what just happened, and the menu of what you can do here. Movement follows
 * the world's shape: plain menus, a lobby of place tiles around the
 * companion, a journey's stops, or a first-person delve with an automap and
 * a command menu. Everything is reachable from the menu, on desktop and
 * phone; the delve also takes arrow keys and WASD.
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
}

export interface SceneHandle {
  readonly chatId: string;
  setView(v: SceneView): void;
  setArt(key: string, url: string, cutout?: boolean): void;
  hide(): void;
  show(): void;
  destroy(): void;
}

/** The themes this build draws; the rest of THEMES arrive with M5. */
export const SCENE_THEMES: { id: ThemeId; label: string }[] = [
  { id: "storybook", label: "Storybook" },
  { id: "onebit", label: "1-bit" },
  { id: "lobby", label: "Lobby" },
  { id: "command", label: "Command" },
];

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
@media (prefers-reduced-motion: reduce) { .gs .flat { transition: none; } .gs .tiles button:hover { transform: none; } }
`;

export function mountScene(root: HTMLElement, first: SceneView, a: SceneActions): SceneHandle {
  const el = document.createElement("div");
  el.className = "gs";
  el.setAttribute("data-gambit-stage", "scene");
  const style = document.createElement("style");
  style.textContent = CSS;
  el.innerHTML = `
    <div class="world"><div class="flat"></div><canvas class="delve2d gone"></canvas><div class="folk"></div><div class="lobbyface gone"></div></div>
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

  function renderWorld(v: SceneView): void {
    const lobby = !v.delve && v.movement === "lobby";
    tiles.classList.toggle("gone", !lobby || !v.tiles.length);
    lobbyface.classList.toggle("gone", !lobby);
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
    const shown = lobby ? [] : v.people.map((p) => ({ p, a: personArt(p) })).filter((x) => x.a);
    if (layer) {
      layer.setPost(POST[v.theme]);
      layer.setDolly(0);
      void layer.showBackdrop(bg);
      void layer.showPeople(shown.map((x) => ({ id: x.p.id, url: x.a!.url, cutout: x.a!.cutout })));
    } else {
      flat.style.backgroundImage = bg ? `url('${bg.replace(/'/g, "%27")}')` : "";
      flat.classList.toggle("dim", lobby);
      folk.innerHTML = shown.map((x) => `<img alt="${esc(x.p.name)}" class="${x.a!.cutout ? "" : "opaque"}" src="${esc(x.a!.url)}">`).join("");
    }
    if (layer && lobby) {
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
      window.removeEventListener("keydown", onKey);
      ro.disconnect();
      layer?.destroy();
      el.remove();
      style.remove();
    },
  };
}
