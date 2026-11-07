/**
 * The Scene view (docs/DESIGN.md 6.1-6.3): the place's painting (3D when it
 * can, flat when it cannot), the people in it, what just happened, the menu
 * of what you can do here, and movement in the world's shape (plain menus,
 * a lobby of places, a journey's stops, a frontier honeycomb, or a
 * first-person delve with an automap; the delve also takes arrows / WASD).
 *
 * This is the host. Every stage theme is its own game interface in
 * ./themes/<id>.ts, built against ./themes/contract.ts: the host owns the
 * data, the art cache, the WebGL place layer, the journal / class-panel
 * state, the delve keys, the "Meanwhile…" montage and a pointer tracker;
 * the theme owns every pixel.
 */
import type { Hotspot } from "../../engine/world/places.js";
import { fightLabel } from "../../engine/world/places.js";
import type { DelveMove } from "../../engine/world/delve.js";
import type { DelveView, SceneView, ThemeId } from "../../shared/scene-view.js";
import { SceneLayer3D, webglOk } from "./layer3d.js";
import { drawCorridor2D } from "./corridor2d.js";
import { FORGE_CSS, mountForgePanel } from "./forge-panel.js";
import { BOARD_CSS, DEFAULT_SKIN, mountBoard, type BoardOp } from "./board.js";
import { createPuppetDom } from "./puppet-dom.js";
import { PIXEL_FONT_CSS } from "./pixel-font.js";
import { THEME_FONTS_CSS } from "./fonts.js";
import { prepareArt } from "../art/prepare.js";
import { ditherUrl } from "../art/dither.js";
import type { ForgeOp, ForgeView } from "../../shared/forge-view.js";
import { esc, type AutomapStyle, type BackdropOpts, type MenuItem, type PersonArt, type ThemeCtx, type ThemeRenderer } from "./themes/contract.js";
import { THEME_FACTORIES } from "./themes/index.js";

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
  /** The class panel (M7). */
  forge(op: ForgeOp, arg?: string, arg2?: string, text?: string): void;
  /** The expedition board: move, open a lore tile at a depth, camp, hold still, turn back. */
  board(op: BoardOp, cell?: string, tier?: number): void;
}

export type MeanwhileItem = { text: string; art?: string; imageId?: string | null; /** The vignette drawn as its own scene, once ready. */ cg?: string };

export interface SceneHandle {
  readonly chatId: string;
  setView(v: SceneView): void;
  setArt(key: string, url: string, cutout?: boolean, face?: [number, number, number, number] | null): void;
  hide(): void;
  show(): void;
  destroy(): void;
  /** "Meanwhile…": null opens the montage; the vignettes then play in turn. */
  meanwhile(day: number, items: MeanwhileItem[] | null): void;
  /** The class panel's state. */
  forge(v: ForgeView): void;
}

/** The stage themes (6.3). */
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

/** @font-face is ignored inside a shadow root, so the fonts are declared on the page once. */
function ensureFonts(): void {
  if (document.getElementById("gambit-pixel-font")) return;
  const st = document.createElement("style");
  st.id = "gambit-pixel-font";
  st.textContent = PIXEL_FONT_CSS + "\n" + THEME_FONTS_CSS;
  document.head.append(st);
}

const CSS = `
.gs { position: absolute; inset: 0; overflow: hidden; color: #ece3cf; font: 16px/1.45 "Palatino Linotype", Georgia, serif; }
.gs * { box-sizing: border-box; }
.gs > .th { position: absolute; inset: 0; container-type: size; overflow: hidden; }
.gs .world { position: absolute; inset: 0; background: #0b0a09; overflow: hidden; }
.gs .world > .flat { position: absolute; inset: 0; background: #0b0a09 center/cover no-repeat; }
.gs .world.flatmode > canvas:not(.delve2d) { visibility: hidden; }
.gs .world.void { visibility: hidden; }
.gs .world > .delve2d { position: absolute; inset: 0; width: 100%; height: 100%; display: block; image-rendering: pixelated; }
.gs .gone { display: none !important; }
/* Meanwhile… (themes restyle it). */
.gs > .mw { position: absolute; inset: 0; z-index: 50; display: grid; place-items: center; background: radial-gradient(ellipse at 50% 40%, rgba(20,16,12,.86), rgba(5,4,3,.97)); cursor: pointer; animation: mwIn .6s ease; }
.gs .mw-in { display: grid; justify-items: center; gap: 16px; width: min(760px, 90%); }
.gs .mw-title { font: italic 40px/1 "Gambit Fell", "Palatino Linotype", Georgia, serif; color: #e9d4ad; letter-spacing: .03em; }
.gs .mw.waiting .mw-title { animation: mwPulse 1.6s ease-in-out infinite; }
.gs .mw-art { width: 100%; aspect-ratio: 16 / 9; background: #17130f center/cover no-repeat; border: 8px solid #efe2c4; box-shadow: 0 16px 40px rgba(0,0,0,.6); }
.gs .mw-art.none { display: none; }
.gs .mw-text { font: 22px/1.5 "Gambit Fell", "Palatino Linotype", Georgia, serif; text-align: center; color: #f1e6cf; min-height: 3em; margin: 0; }
.gs .mw-card { display: grid; gap: 14px; width: 100%; animation: mwIn .5s ease; }
.gs .album { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; margin: 6px 0 12px; }
.gs .album figure { margin: 0; display: grid; gap: 4px; }
.gs .album img { width: 100%; aspect-ratio: 3 / 2; object-fit: cover; border-radius: 4px; box-shadow: 0 4px 14px rgba(0,0,0,.35); cursor: zoom-in; }
.gs .album img:focus, .gs .album img:hover { outline: 2px solid currentColor; outline-offset: 2px; }
.gs .album figcaption { font-size: .78em; opacity: .8; line-height: 1.3; }
.gs .mw-dots { display: flex; gap: 8px; justify-content: center; margin-top: 10px; } .gs .mw-dots i { width: 8px; height: 8px; transform: rotate(45deg); background: rgba(233,212,173,.3); } .gs .mw-dots i.on { background: #e9d4ad; }
.gs .mw-hint { font-size: 13px; letter-spacing: .14em; text-transform: uppercase; opacity: .6; }
.gs > .fg { z-index: 40; }
@keyframes mwIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes mwPulse { 50% { opacity: .45; } }
@media (prefers-reduced-motion: reduce) { .gs > .mw, .gs .mw-card { animation: none; } }
`;

export function mountScene(root: HTMLElement, first: SceneView, a: SceneActions): SceneHandle {
  ensureFonts();
  const el = document.createElement("div");
  el.className = "gs";
  el.setAttribute("data-gambit-stage", "scene");
  const style = document.createElement("style");
  style.textContent = CSS + FORGE_CSS + BOARD_CSS;
  const th = document.createElement("div");
  th.className = "th";
  el.append(th);
  root.append(style, el);

  // The place painting / 3D layer: a theme puts it where it wants.
  const world = document.createElement("div");
  world.className = "world";
  world.innerHTML = `<div class="flat"></div><canvas class="delve2d gone"></canvas>`;
  const flat = world.querySelector(".flat") as HTMLDivElement;
  const delve2d = world.querySelector(".delve2d") as HTMLCanvasElement;

  const art = new Map<string, { url: string; cutout: boolean; face?: [number, number, number, number] | null }>();
  let journalOpen = false;
  const classes = mountForgePanel(el, (op, x, y, text) => a.forge(op, x, y, text), (key) => art.get(key)?.url ?? null);
  let view = first;
  let destroyed = false;
  // Cue's puppet warp on the people the themes draw as <img> (swapped in after each render, sync or async).
  const puppets = createPuppetDom();
  let puppetQueued = 0;
  const puppetWatch = new MutationObserver(() => {
    if (puppetQueued) return;
    puppetQueued = requestAnimationFrame(() => {
      puppetQueued = 0;
      if (!destroyed) puppets.attach(el);
    });
  });
  puppetWatch.observe(el, { childList: true, subtree: true });
  let hidden = false;
  let layer: SceneLayer3D | null = null;
  const reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const board = mountBoard(el, (op, cell, tier) => a.board(op, cell, tier), reducedMotion, (key) => (key ? art.get(key) ?? null : null));
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
    } catch {
      layer = null;
    }
  }
  const ro = new ResizeObserver(() => {
    layer?.resize();
    if (view.delve && !layer) drawDelve(view.delve);
  });
  ro.observe(world);

  const urlOf = (key: string | undefined | null) => (key ? art.get(key)?.url ?? null : null);
  // Their own cut-out figure first, then the card art (keyed or framed), then a drawn portrait.
  const personSrc = (p: SceneView["people"][number]) => (p.figure ? art.get(p.figure) : undefined) ?? (p.imageId ? { url: `/api/v1/images/${p.imageId}`, cutout: false } : art.get(p.art) ?? null);

  /* ------------------------------ Pointer ------------------------------ */
  const ptr = { tx: 0, ty: 0, x: 0, y: 0 };
  function onMove(e: PointerEvent): void {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    ptr.tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    ptr.ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
  }
  el.addEventListener("pointermove", onMove);
  const frames = new Set<(t: number, dt: number) => void>();
  let raf = 0;
  let last = 0;
  function tick(t: number): void {
    raf = 0;
    if (destroyed || hidden || !frames.size) return;
    const dt = last ? Math.min(0.1, (t - last) / 1000) : 0.016;
    last = t;
    const k = 1 - Math.pow(0.0008, dt);
    ptr.x += (ptr.tx - ptr.x) * k;
    ptr.y += (ptr.ty - ptr.y) * k;
    for (const f of [...frames]) {
      try {
        f(t, dt);
      } catch (err) {
        console.error("[gambit] theme frame", err);
      }
    }
    raf = requestAnimationFrame(tick);
  }
  const kick = () => {
    if (!raf && !destroyed && !hidden && frames.size) {
      last = 0;
      raf = requestAnimationFrame(tick);
    }
  };

  /* ------------------------------ Art prep ----------------------------- */
  const ready = new Map<string, PersonArt>();
  const pending = new Set<string>();
  function preparedArt(src: { url: string; cutout: boolean }, mode: "color" | "onebit", rows: number): PersonArt | null {
    const id = `${mode}|${rows}|${src.url}`;
    const got = ready.get(id);
    if (got) return got;
    if (!pending.has(id)) {
      pending.add(id);
      void (async () => {
        try {
          const keyed = src.cutout ? { url: src.url, cutout: true } : await prepareArt(src.url, true);
          const base = { cutout: keyed.cutout, keyed: !src.cutout && keyed.cutout, source: src.url };
          ready.set(id, { ...base, url: mode === "onebit" ? await ditherUrl(keyed.url, rows) : keyed.url });
        } catch {
          ready.set(id, { url: src.url, cutout: src.cutout, keyed: false, source: src.url });
        }
        pending.delete(id);
        if (!destroyed) renderTheme();
      })();
    }
    return null;
  }

  /* ------------------------------ Data views --------------------------- */
  function menuOf(v: SceneView): MenuItem[] {
    if (v.delve) {
      const d = v.delve;
      const search = d.room && !d.room.cleared && (d.room.kind === "key" || d.room.kind === "treasure");
      const moves: [DelveMove, string][] = [["forward", "Advance"], ["left", "Turn left"], ["right", "Turn right"], ["back", "Step back"], ["search", search ? "Search this room" : "Search"]];
      return [
        ...moves.map(([m, label]): MenuItem => ({ key: `move:${m}`, kind: m === "search" ? "search" : "move", label, group: "move", target: m, run: () => a.step(m) })),
        { key: "leave", kind: "delve", label: d.done ? "Leave, victorious" : "Leave the delve", group: "go", run: () => a.leave() },
      ];
    }
    const groupOf = (k: Hotspot["kind"]): MenuItem["group"] => (k === "talk" ? "talk" : k === "exit" || k === "delve" ? "go" : k === "fight" ? "fight" : "do");
    const tileArt = new Map(v.tiles.map((t) => [t.id, t.art]));
    const order: MenuItem["group"][] = ["talk", "do", "go", "fight"];
    const items = v.menu.map((h): MenuItem => ({
      key: h.id,
      kind: h.kind,
      label: h.label,
      group: groupOf(h.kind),
      ...(h.target ? { target: h.target } : h.kind === "talk" ? { target: h.id.slice(5) } : {}),
      art: h.kind === "exit" && h.target ? urlOf(tileArt.get(h.target)) : null,
      run: () => a.act(h.id),
    }));
    if (v.canFight && !v.menu.some((h) => h.kind === "fight")) items.push({ key: "fight", kind: "fight", label: fightLabel(v.skin.fight), group: "fight", run: () => a.fight() });
    return items.sort((x, y) => order.indexOf(x.group) - order.indexOf(y.group));
  }

  function toggleJournal(): void {
    journalOpen = !journalOpen;
    renderTheme();
  }
  function toggleClasses(): void {
    classes.toggle();
    renderTheme();
  }

  function journalHtml(v: SceneView): string {
    const j = v.journal;
    const list = (items: string[], empty: string) => (items.length ? `<ul>${items.join("")}</ul>` : `<div class="muted">${esc(empty)}</div>`);
    const aff = (x: number) => `<span class="aff"><i class="${x < 0 ? "neg" : ""}" style="${x < 0 ? `right:50%;left:auto;width:${Math.min(50, -x * 5)}%` : `left:50%;width:${Math.min(50, x * 5)}%`}"></i></span>`;
    return [
      `<h3>Companions</h3>`,
      list(j.companions.map((c) => `<li class="${c.bonded ? "bond" : ""}">${esc(c.name)}${c.recruit ? " (recruited)" : ""}${aff(c.affinity)}${c.bonded ? "bonded: combo skill" : ""}</li>`), "Nobody travels with you yet."),
      `<h3>Quests</h3>`,
      list(
        j.quests.map((q) => `<li class="${q.done ? "done" : ""}"><b>${esc(q.name)}</b>: ${esc(q.dossier)}<ul>${q.steps.map((s) => `<li class="${s.done ? "done" : ""}">${esc(s.text)} <span class="muted">(${esc(s.where)})</span></li>`).join("")}</ul></li>`),
        "Nothing has caught your attention yet. Keep asking after people.",
      ),
      `<h3>People remember</h3>`,
      list(j.people.map((p) => `<li><b>${esc(p.name)}</b> (${esc(p.feel)}): ${esc(p.notes.join("; "))}</li>`), "Nobody has made up their mind about you yet."),
      `<h3>Rumours</h3>`,
      list(j.rumors.map((x) => `<li>${esc(x)}</li>`), "No rumours yet."),
      `<h3>Items</h3>`,
      list(j.items.map((x) => `<li><b>${esc(x.name)}</b>: ${esc(x.description)} <span class="muted">(from ${esc(x.from)})</span></li>`), "Nothing special yet."),
      `<h3>What you did</h3>`,
      list(j.deeds.map((d) => `<li>${esc(d)}</li>`), "Nothing yet."),
      `<h3>Album</h3>`,
      (() => {
        const shots = j.album.map((a) => ({ a, url: urlOf(a.key) })).filter((x) => x.url);
        return shots.length
          ? `<div class="album">${shots.map(({ a, url }) => `<figure><img src="${esc(url!)}" alt="${esc(a.caption)}" loading="lazy"><figcaption>Day ${a.day}: ${esc(a.caption)}</figcaption></figure>`).join("")}</div>`
          : `<div class="muted">${j.album.length ? "Being drawn…" : "Key moments will be drawn here."}</div>`;
      })(),
    ].join("");
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
  function drawHex(svg: SVGSVGElement, v: SceneView): void {
    const h = v.hex;
    if (!h) {
      svg.innerHTML = "";
      return;
    }
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
    svg.setAttribute("viewBox", `${(x0 - pad).toFixed(0)} ${(y0 - pad).toFixed(0)} ${(x1 - x0 + pad * 2).toFixed(0)} ${(y1 - y0 + pad * 2).toFixed(0)}`);
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
      parts.push(`<g class="${cls}" data-terrain="${esc(c.seen ? c.terrain : "fog")}"${attrs}><polygon points="${hexPoints(p.x, p.y, size - 0.6)}" ${c.seen ? `style="fill:var(--hex-${esc(c.terrain)},${fill})"` : `class="fog"`}><title>${esc(c.name ?? (c.seen ? c.terrain : "Unknown"))}</title></polygon></g>`);
      if (c.placeId && c.seen) {
        parts.push(`<circle class="pin" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5"/>`);
        if (c.name) labels.push(`<text x="${p.x.toFixed(1)}" y="${(p.y + size * 0.95).toFixed(1)}" text-anchor="middle">${esc(c.name.length > 18 ? `${c.name.slice(0, 17)}…` : c.name)}</text>`);
      }
    }
    const hp = pos(here.q, here.r);
    parts.push(`<circle class="you" cx="${hp.x.toFixed(1)}" cy="${(hp.y - (here.placeId ? 9 : 0)).toFixed(1)}" r="6"/>`);
    svg.innerHTML = parts.join("") + labels.join("");
    svg.querySelectorAll<SVGGElement>("[data-q]").forEach((g) => {
      const go = () => a.hex(Number(g.dataset.q), Number(g.dataset.r));
      g.addEventListener("click", go);
      g.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), go()));
    });
    svg.querySelectorAll<SVGGElement>("[data-go]").forEach((g) => {
      const go = () => a.act(`go:${g.dataset.go}`);
      g.addEventListener("click", go);
      g.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), go()));
    });
  }

  function drawAutomap(canvas: HTMLCanvasElement, d: DelveView, s: AutomapStyle): void {
    const g = canvas.getContext("2d")!;
    const W = canvas.width;
    const H = canvas.height;
    const rows = d.grid.length;
    const cols = d.grid[0]?.length ?? 1;
    let x0 = d.x, x1 = d.x, y0 = d.y, y1 = d.y;
    d.grid.forEach((row, y) => [...row].forEach((c, x) => {
      if (c === "?") return;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }));
    const span = Math.max(x1 - x0 + 3, y1 - y0 + 3, 7);
    const cell = Math.max(2, Math.min(24, Math.floor(Math.min(W, H) / span)));
    const ox = Math.floor(W / 2 - ((x0 + x1 + 1) / 2) * cell);
    const oy = Math.floor(H / 2 - ((y0 + y1 + 1) / 2) * cell);
    g.clearRect(0, 0, W, H);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const c = d.grid[y]![x]!;
        if (c === "?" || c === "#") continue;
        g.fillStyle = c === "L" ? s.lit : s.floor;
        g.fillRect(ox + x * cell, oy + y * cell, cell, cell);
      }
    }
    for (const r of d.rooms) {
      if (r.cleared && r.kind !== "boss") continue;
      g.fillStyle = s.mark ?? (r.kind === "boss" ? "#e0604c" : r.kind === "key" || r.kind === "treasure" ? "#ffd27a" : r.kind === "rest" ? "#8fd18a" : r.kind === "fight" ? "#c4544a" : "transparent");
      g.fillRect(ox + r.x * cell + cell * 0.25, oy + r.y * cell + cell * 0.25, cell * 0.5, cell * 0.5);
    }
    const cx = ox + d.x * cell + cell / 2;
    const cy = oy + d.y * cell + cell / 2;
    const ang = (d.facing * Math.PI) / 2 - Math.PI / 2;
    g.fillStyle = s.you;
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
    drawCorridor2D(delve2d, d.view, { onebit: view.theme === "onebit" || view.theme === "command", wall: urlOf(d.textures.wall) });
  }

  let flatKey = "";
  function backdrop(v: SceneView, o: BackdropOpts): void {
    const d = v.delve;
    // "none": the theme draws the place itself; the world shows nothing (outside a delve).
    world.classList.toggle("void", !d && o.flat === "none");
    delve2d.classList.toggle("gone", !d || !!layer);
    const useFlat = !layer || (!d && !!o.flat);
    world.classList.toggle("flatmode", useFlat);
    flat.classList.toggle("gone", !useFlat || !!d);
    if (d) {
      if (layer) {
        layer.setPost(o.post);
        void layer.showPeople([]);
        void layer.showCorridor(
          { grid: d.grid, x: d.x, y: d.y, facing: d.facing, opened: [], glints: d.rooms.filter((r) => !r.cleared && (r.kind === "key" || r.kind === "treasure")).map((r) => r.id) },
          urlOf(d.textures.wall),
        );
      } else drawDelve(d);
      return;
    }
    const bg = urlOf(v.place.art);
    if (o.custom && layer) {
      world.classList.remove("flatmode");
      flat.classList.add("gone");
      layer.setPost(o.post);
      layer.customStage();
      return;
    }
    if (o.flat === "none") {
      flat.classList.add("gone");
      if (layer) void layer.showBackdrop(null);
      return;
    }
    if (!useFlat && layer) {
      layer.setPost(o.post);
      layer.setDolly(o.dolly ?? 0);
      if (o.room) void layer.showDiorama(bg, { counter: false });
      else void layer.showBackdrop(bg);
      void layer.showPeople([]);
      return;
    }
    flat.style.backgroundSize = o.fit ?? "cover";
    const key = `${bg}|${o.flat}|${o.rows}`;
    if (key === flatKey) return;
    flatKey = key;
    const paint = (u: string | null) => (flat.style.backgroundImage = u ? `url('${u.replace(/'/g, "%27")}')` : "");
    if (bg && o.flat === "dither") {
      paint(null);
      flat.style.imageRendering = "pixelated";
      void ditherUrl(bg, o.rows ?? 160).then((u) => flatKey === key && paint(u));
    } else {
      flat.style.imageRendering = "";
      paint(bg);
    }
  }

  /* ------------------------------ Themes ------------------------------- */
  const ctx: ThemeCtx = {
    root: th,
    world,
    reducedMotion,
    get has3d() {
      return !!layer;
    },
    backdrop,
    stage3d: () => layer?.customStage() ?? null,
    art: urlOf,
    placeArt: (v) => urlOf(v.place.art),
    people: (v) =>
      v.delve
        ? []
        : v.people.map((p) => ({
            id: p.id,
            name: p.name,
            role: p.role,
            talkable: v.menu.some((h) => h.id === `talk:${p.id}`),
            talk: () => a.act(`talk:${p.id}`),
          })),
    personArt(v, id, mode = "color", rows = 120) {
      const p = v.people.find((x) => x.id === id);
      const src = p ? personSrc(p) : null;
      // A real cut-out (alpha) breathes and sways in every theme that shows it as an <img> (puppet-dom.ts).
      if (src?.cutout && mode === "color") puppets.mark(src.url, (src as { face?: [number, number, number, number] | null }).face ?? null);
      return src ? preparedArt(src, mode, rows) : null;
    },
    dither: (url, rows) => ditherUrl(url, rows),
    menu: menuOf,
    status: (v) => ({
      where: v.delve ? v.delve.name : v.place.name,
      card: v.cardName,
      day: v.clock.day,
      time: v.clock.time,
      coin: v.coin,
      currency: v.skin.currency || "coin",
      vigor: v.vigor,
      ...(v.board ? { supplies: { now: v.board.supplies, max: v.board.cap } } : v.hex ? { supplies: { now: v.hex.supplies, max: v.hex.max } } : {}),
      ...(v.thread ? { thread: { found: v.thread.found, total: v.thread.total, goal: v.thread.goal } } : {}),
    }),
    box(v) {
      if (v.delve) {
        const d = v.delve;
        return {
          title: d.name,
          isNew: false,
          desc: d.done ? "Its master is beaten. The way out is open." : d.room ? (d.room.cleared && d.room.kind !== "entrance" ? "You have been here. It is quiet now." : ROOM_TEXT[d.room.kind] ?? "") : "A narrow corridor, cold and quiet.",
          log: v.log,
          busy: v.busy ?? null,
        };
      }
      return { title: v.place.name, isNew: v.place.added, desc: v.place.description, log: v.log, busy: v.busy ?? null };
    },
    hand(v) {
      const lead = v.delve ? undefined : v.people[0];
      const canTalk = !!lead && v.menu.some((h) => h.id === `talk:${lead.id}`);
      return v.hand.map((f) => ({ id: f.id, text: f.text, play: canTalk ? () => a.cite(lead!.id, f.text) : null }));
    },
    drawHex,
    drawAutomap,
    journal: {
      get open() {
        return journalOpen;
      },
      toggle: toggleJournal,
      html: journalHtml,
    },
    classes: {
      get open() {
        return classes.open;
      },
      toggle: toggleClasses,
    },
    themes: SCENE_THEMES,
    setTheme: (id) => a.theme(id),
    pointer: () => ({ x: ptr.x, y: ptr.y }),
    onFrame(fn) {
      frames.add(fn);
      kick();
      return () => frames.delete(fn);
    },
    rerender: () => renderTheme(),
  };

  // For debugging and preview screenshots: the scene element carries the theme context.
  (el as unknown as { gambitCtx?: ThemeCtx }).gambitCtx = ctx;

  let current: { id: ThemeId; r: ThemeRenderer } | null = null;
  function mountTheme(id: ThemeId): void {
    if (current) {
      try {
        current.r.destroy();
      } catch (err) {
        console.error("[gambit] theme destroy", err);
      }
      frames.clear();
    }
    world.remove();
    th.replaceChildren();
    th.className = `th t-${id}`;
    el.classList.remove(...SCENE_THEMES.map((t) => t.id));
    el.classList.add(id);
    flatKey = "";
    const make = THEME_FACTORIES[id] ?? THEME_FACTORIES.storybook;
    current = { id, r: make(ctx) };
  }
  let rendering = false;
  function renderTheme(): void {
    if (destroyed || rendering) return;
    rendering = true;
    try {
      if (!current || current.id !== view.theme) mountTheme(view.theme);
      current!.r.render(view);
    } catch (err) {
      console.error("[gambit] theme render", err);
    }
    try {
      board.set(view, current?.r.boardSkin ?? DEFAULT_SKIN);
    } catch (err) {
      console.error("[gambit] board render", err);
    } finally {
      rendering = false;
    }
  }

  function onKey(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    if (el.classList.contains("gone") || view.busy || e.ctrlKey || e.metaKey || e.altKey) return;
    if (view.board) {
      if (board.key(e)) e.preventDefault();
      return;
    }
    if (current?.r.key?.(e, view)) {
      e.preventDefault();
      return;
    }
    if (!view.delve) return;
    const k = e.key.toLowerCase();
    const move: DelveMove | null = k === "arrowup" || k === "w" ? "forward" : k === "arrowdown" || k === "s" ? "back" : k === "arrowleft" || k === "a" ? "left" : k === "arrowright" || k === "d" ? "right" : k === " " || k === "f" ? "search" : null;
    if (!move) return;
    e.preventDefault();
    a.step(move);
  }
  window.addEventListener("keydown", onKey);

  renderTheme();

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
    const cg = urlOf(item.cg);
    const url = cg ?? (item.imageId ? `/api/v1/images/${item.imageId}` : urlOf(item.art));
    const body = m.box.querySelector(".mw-body")!;
    body.innerHTML = `<div class="mw-card${cg ? " cg" : ""}"><div class="mw-art ${url ? "" : "none"}" ${url ? `style="background-image:url('${esc(url)}')"` : ""}></div><p class="mw-text">${esc(item.text)}</p></div><div class="mw-dots">${m.items!.map((_, i) => `<i class="${i === m.i ? "on" : ""}"></i>`).join("")}</div>`;
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
      if (destroyed) return;
      view = v;
      renderTheme();
    },
    setArt(key, url, cutout = true, face) {
      const prev = art.get(key);
      if (prev?.url === url) return;
      art.set(key, { url, cutout, ...(face !== undefined ? { face } : {}) });
      const v = view;
      const used =
        key === v.place.art ||
        v.tiles.some((t) => t.art === key) ||
        v.people.some((p) => p.art === key || p.figure === key) ||
        key === v.delve?.textures.wall ||
        !!v.board?.party.some((m) => m.art === key) ||
        key === v.board?.map ||
        key === v.board?.story?.art;
      if (used && !destroyed) renderTheme();
      if (mw && (mw.items?.[mw.i]?.art === key || mw.items?.[mw.i]?.cg === key)) paintMeanwhile();
      classes.art(key);
    },
    forge(v) {
      if (!destroyed) classes.set(v);
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
      hidden = true;
      el.classList.add("gone");
    },
    show() {
      hidden = false;
      el.classList.remove("gone");
      layer?.resize();
      kick();
      renderTheme();
    },
    destroy() {
      destroyed = true;
      closeMeanwhile();
      window.removeEventListener("keydown", onKey);
      el.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
      try {
        current?.r.destroy();
      } catch {
        /* already gone */
      }
      frames.clear();
      ro.disconnect();
      puppetWatch.disconnect();
      if (puppetQueued) cancelAnimationFrame(puppetQueued);
      puppets.destroy();
      layer?.destroy();
      classes.destroy();
      board.destroy();
      el.remove();
      style.remove();
    },
  };
}
