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
import type { EncounterView } from "./themes/contract.js";
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
  say(text: string): void;
  step(move: DelveMove): void;
  leave(): void;
  theme(theme: ThemeId): void;
  fight(): void;
  close(): void;
  /** The montage is over: the day is back on screen. */
  nightEnd?(): void;
  /** Step to a neighbouring overland cell. */
  hex(q: number, r: number): void;
  /** Table theme: play a fact card on someone (talk to them, citing it). */
  cite(personId: string, text: string): void;
  /** The class panel (M7). */
  forge(op: ForgeOp, arg?: string, arg2?: string, text?: string): void;
  /** The expedition board: move, open a lore tile at a depth, camp, hold still, turn back. */
  board(op: BoardOp, cell?: string, tier?: number): void;
}

export type AfterglowPage = { text: string; /** Art key of the picture this page closes, once drawn. */ cg?: string };
export type MeanwhileItem = { text: string; /** What the player did that led here. */ why?: string; /** What this scene just made true. */ change?: string; art?: string; imageId?: string | null; /** The vignette drawn as its own scene, once ready. */ cg?: string };

export interface SceneHandle {
  readonly chatId: string;
  setView(v: SceneView): void;
  setArt(key: string, url: string, cutout?: boolean, face?: [number, number, number, number] | null): void;
  hide(): void;
  show(): void;
  /** Ask the current theme to stage a fight or talk in its room (true: staged; keep the scene visible). */
  encounter(e: EncounterView | null): boolean;
  destroy(): void;
  /** "Meanwhile…": null opens the montage on the day behind you; the scenes then play in turn, and what changed closes it. */
  meanwhile(day: number, items: MeanwhileItem[] | null, words?: { today?: string[]; morning?: string[] }): void;
  /** An adult scene read page by page: null opens it while it's written, empty closes it, pages show it. */
  afterglow(title: string, pages: AfterglowPage[] | null): void;
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
/* The scene itself, under a fight or a talk. Hidden, not unlaid: its 3D layers keep their size for when it comes back, and nothing in it (a board at z-index 30) can sit over the encounter. */
.gs.gone { visibility: hidden; }
/* Meanwhile… (themes restyle it). What's written sits inside .mw-text, so it takes each theme's face and colour. */
.gs > .mw { position: absolute; inset: 0; z-index: 50; container-type: size; overflow: hidden; display: grid; place-items: center; background: radial-gradient(ellipse at 50% 40%, rgba(20,16,12,.86), rgba(5,4,3,.97)); cursor: pointer; animation: mwIn .6s ease; }
.gs .mw-in { display: grid; justify-items: center; gap: 14px; width: min(880px, 92%); max-height: 100%; }
.gs .mw-body { width: 100%; min-height: 0; }
.gs .mw-day, .gs .mw-morning { width: min(720px, 100%); margin: 0 auto; }
.gs .mw-title { font: italic 40px/1 "Gambit Fell", "Palatino Linotype", Georgia, serif; color: #e9d4ad; letter-spacing: .03em; }
.gs .mw.waiting .mw-title { animation: mwPulse 1.6s ease-in-out infinite; }
.gs .mw-art { position: relative; overflow: hidden; width: 100%; aspect-ratio: 16 / 9; max-height: 50cqh; background: #17130f center/cover no-repeat; border: 8px solid #efe2c4; box-shadow: 0 16px 40px rgba(0,0,0,.6); }
/* The picture drifts while it's up, and comes up from dark when a scene's own drawing arrives. */
.gs .mw-art::before { content: ""; position: absolute; inset: 0; background: inherit; animation: mwDrift 18s ease-out both; }
.gs .mw-art.arrived::before { animation: mwDrift 18s ease-out both, mwArrive 1.4s ease-out both; }
.gs .mw-art.none { display: none; }
.gs .mw-text { font: 22px/1.45 "Gambit Fell", "Palatino Linotype", Georgia, serif; text-align: center; color: #f1e6cf; min-height: 3em; margin: 0; }
.gs .mw-why, .gs .mw-change, .gs .mw-kicker { display: block; font-size: .64em; line-height: 1.3; letter-spacing: .1em; text-transform: uppercase; opacity: .82; }
.gs .mw-why { margin-bottom: .6em; }
.gs .mw-change { margin-top: .75em; opacity: 1; font-weight: 700; letter-spacing: .06em; }
.gs .mw-change::before { content: "◆ "; font-size: .8em; }
.gs .mw-kicker { margin-bottom: .7em; }
.gs .mw-list { list-style: none; margin: 0; padding: 0; display: grid; gap: .45em; font-size: .94em; line-height: 1.32; }
.gs .mw-list li { animation: mwIn .7s ease both; }
.gs .mw-list li:nth-child(2) { animation-delay: .5s; } .gs .mw-list li:nth-child(3) { animation-delay: 1s; } .gs .mw-list li:nth-child(4) { animation-delay: 1.5s; } .gs .mw-list li:nth-child(5) { animation-delay: 2s; } .gs .mw-list li:nth-child(6) { animation-delay: 2.5s; }
.gs .mw-card { display: grid; gap: 14px; width: 100%; animation: mwIn .5s ease; }
.gs .album { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; margin: 6px 0 12px; }
.gs .album figure { margin: 0; display: grid; gap: 4px; }
.gs .album img { width: 100%; aspect-ratio: 3 / 2; object-fit: cover; border-radius: 4px; box-shadow: 0 4px 14px rgba(0,0,0,.35); cursor: zoom-in; }
.gs .album img:focus, .gs .album img:hover { outline: 2px solid currentColor; outline-offset: 2px; }
.gs .album figcaption { font-size: .78em; opacity: .8; line-height: 1.3; }
.gs > .zoom { position: absolute; inset: 0; z-index: 60; display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 16px; box-sizing: border-box; background: rgba(6,5,8,.92); cursor: zoom-out; }
.gs > .zoom img { flex: 1 1 auto; min-height: 0; width: 100%; object-fit: contain; }
.gs > .zoom p { flex: none; margin: 0; max-width: 72ch; max-height: 22%; overflow: auto; text-align: center; color: #ece3cf; font-size: 15px; line-height: 1.35; }
.gs .mw-dots { display: flex; gap: 8px; justify-content: center; margin-top: 2px; } .gs .mw-dots i { width: 8px; height: 8px; transform: rotate(45deg); background: rgba(233,212,173,.3); } .gs .mw-dots i.on { background: #e9d4ad; }
.gs .mw-hint { font-size: 13px; letter-spacing: .14em; text-transform: uppercase; opacity: .6; }
/* Short screens keep the picture and the words. */
@container (max-height: 620px) { .gs .mw:not(.waiting) .mw-title { display: none; } }
/* Wide screens set them side by side. */
@container (min-aspect-ratio: 3 / 2) {
  .gs .mw-in { width: min(1240px, 92%); }
  .gs .mw-card:has(.mw-art:not(.none)) { grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); align-items: center; gap: 24px; }
  .gs .mw-card:has(.mw-art:not(.none)) .mw-text { text-align: left; max-height: 76cqh; overflow-y: auto; scrollbar-width: thin; }
  .gs .mw-art { max-height: 70cqh; }
}
.gs > .fg { z-index: 40; }
@keyframes mwIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes mwPulse { 50% { opacity: .45; } }
@keyframes mwDrift { from { transform: scale(1.02); } to { transform: scale(1.1) translate(-1%, -1%); } }
@keyframes mwArrive { from { filter: brightness(.3); } to { filter: none; } }
@media (prefers-reduced-motion: reduce) { .gs > .mw, .gs .mw-card, .gs .mw-list li, .gs .mw-art::before, .gs .mw-art.arrived::before { animation: none; } }
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
      run: () => act(h.id),
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
          ? `<div class="album">${shots.map(({ a, url }) => `<figure><img src="${esc(url!)}" alt="${esc(a.caption)}" loading="lazy" tabindex="0" role="button"><figcaption>Day ${a.day}: ${esc(a.caption)}</figcaption></figure>`).join("")}</div>`
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
            talk: () => act(`talk:${p.id}`),
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
      ...(v.thread ? { thread: { found: v.thread.found, total: v.thread.total, goal: v.thread.goal, ...(v.thread.daysLeft !== undefined ? { daysLeft: v.thread.daysLeft } : {}), ...(v.thread.ended ? { ended: v.thread.ended } : {}) } } : {}),
    }),
    say: (text) => a.say(text),
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
    // Seen from the window, anything inside a shadow root is the host: ask for what really has the key.
    const t = e.composedPath()[0] as HTMLElement | null;
    if (mw?.items && !el.classList.contains("gone") && (e.key === " " || e.key === "Enter")) {
      e.preventDefault();
      nextMeanwhile();
      return;
    }
    if (vn && !el.classList.contains("gone") && [" ", "Enter", "ArrowRight", "ArrowLeft", "Escape"].includes(e.key)) {
      e.preventDefault();
      if (e.key === "Escape") closeScene();
      else stepScene(e.key === "ArrowLeft" ? -1 : 1);
      return;
    }
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    if (el.classList.contains("gone") || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "/" && !journalOpen && !mw) {
      // Every theme's keys are its commands, so typing takes a key of its own to start. A reply on its way doesn't stop you.
      const field = writeField();
      if (field) {
        e.preventDefault();
        field.focus();
        return;
      }
    }
    if (view.busy) return;
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

  /* ------------------ Back to the box, after what took the screen ------------------ */
  // A talk, a fight or a night takes the screen away. Whoever was writing comes back still writing;
  // anyone using the keys as commands keeps them as commands.
  const writeField = () => [...el.querySelectorAll<HTMLElement>("[data-write]")].find((f) => f.offsetParent);

  /* ------------------ "Talk to someone" is writing to them ------------------ */
  // No contest starts here: that takes a line that presses them.
  function act(id: string): void {
    if (id.startsWith("talk:")) writeTo(view.menu.find((h) => h.id === id)?.label.replace(/^Talk to /, "") ?? "");
    a.act(id);
  }
  function writeTo(name: string): void {
    const field = writeField() as HTMLTextAreaElement | undefined;
    if (!field || !name) return;
    field.value = `To ${name}: ${field.value.replace(/^To [^:\n]{1,60}: /, "")}`;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }
  let wasWriting = false;
  function noteWriting(): void {
    const active = (el.getRootNode() as Document | ShadowRoot).activeElement as HTMLElement | null;
    if (!active?.hasAttribute?.("data-write")) return;
    wasWriting = true;
    // Nothing typed from here on should land in a box nobody can see.
    active.blur();
  }
  function backToWriting(): void {
    if (!wasWriting || mw || el.classList.contains("gone")) return;
    wasWriting = false;
    requestAnimationFrame(() => writeField()?.focus({ preventScroll: true }));
  }

  /* ---------------------- A picture from the album, large ---------------------- */
  // Here and not in the themes: every theme shows the album, and the journal stays open under it.
  let zoom: HTMLDivElement | null = null;
  function closeZoom(): void {
    zoom?.remove();
    zoom = null;
    window.removeEventListener("keydown", onZoomKey, true);
  }
  function onZoomKey(e: KeyboardEvent): void {
    // Ahead of the overlay and the theme, whose Esc would close more than the picture.
    e.stopImmediatePropagation();
    e.preventDefault();
    if (e.key === "Escape" || e.key === "Enter" || e.key === " ") closeZoom();
  }
  function openZoom(thumb: HTMLImageElement): void {
    closeZoom();
    zoom = document.createElement("div");
    zoom.className = "zoom";
    const big = document.createElement("img");
    big.src = thumb.src;
    big.alt = thumb.alt;
    const caption = document.createElement("p");
    caption.textContent = thumb.closest("figure")?.querySelector("figcaption")?.textContent ?? thumb.alt;
    zoom.append(big, caption);
    el.append(zoom);
    window.addEventListener("keydown", onZoomKey, true);
  }
  const albumShot = (t: EventTarget | null) => (t instanceof HTMLImageElement && t.closest(".album") ? t : null);
  // In the capture phase, so a theme's own click handling doesn't see it: a click here is about the picture.
  function onZoomClick(e: MouseEvent): void {
    const shot = albumShot(e.target);
    if (!zoom && !shot) return;
    e.stopPropagation();
    if (zoom) closeZoom();
    else openZoom(shot!);
  }
  function onShotKey(e: KeyboardEvent): void {
    const shot = albumShot(e.target);
    if (!shot || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    e.stopPropagation();
    openZoom(shot);
  }
  el.addEventListener("click", onZoomClick, true);
  el.addEventListener("keydown", onShotKey);

  renderTheme();

  /* ----------------------------- Meanwhile… ---------------------------- */
  // The day stays up long enough to read even when the night is written at once.
  const MW_DAY_MS = 4500;
  // A scene waits this long past its reading time for its own drawing.
  const MW_DRAWING_MS = 20_000;
  type Montage = { day: number; items: MeanwhileItem[] | null; morning: string[]; i: number; box: HTMLDivElement; timer: number; openedAt: number; since: number };
  let mw: Montage | null = null;
  const readingMs = (text: string) => Math.max(6500, 1800 + text.length * 50);
  function closeMeanwhile(over = true): void {
    if (!mw) return;
    clearTimeout(mw.timer);
    mw.box.remove();
    mw = null;
    if (over) a.nightEnd?.();
    backToWriting();
  }
  function nextMeanwhile(): void {
    if (!mw?.items) return;
    if (mw.i < mw.items.length) {
      mw.i++;
      paintMeanwhile();
    } else closeMeanwhile();
  }
  function openMeanwhile(day: number, today: string[] = []): void {
    closeMeanwhile(false);
    const box = document.createElement("div");
    box.className = "mw waiting";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "Meanwhile");
    const lines = today.length ? `<ul class="mw-list">${today.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : `<p class="mw-quiet">A quiet day.</p>`;
    box.innerHTML = `<div class="mw-in"><div class="mw-title">Meanwhile…</div><div class="mw-body"><div class="mw-card mw-day"><div class="mw-text"><span class="mw-kicker">The day behind you</span>${lines}</div></div></div><div class="mw-hint">The world moves</div></div>`;
    box.addEventListener("click", nextMeanwhile);
    noteWriting();
    el.append(box);
    mw = { day, items: null, morning: [], i: 0, box, timer: 0, openedAt: Date.now(), since: 0 };
    // Nothing came back: never leave the player stuck behind the curtain.
    mw.timer = window.setTimeout(() => !mw?.items && closeMeanwhile(), 120_000);
  }
  const meanwhileUrl = (item: MeanwhileItem | undefined): string | null => (item ? (urlOf(item.cg) ?? (item.imageId ? `/api/v1/images/${item.imageId}` : urlOf(item.art))) : null);
  /** A scene's picture turned up while it's on screen: it comes in without touching the words or the clock. */
  function meanwhileArt(): void {
    const item = mw?.items?.[mw.i];
    const art = mw?.box.querySelector<HTMLElement>(".mw-art");
    const url = meanwhileUrl(item);
    if (!mw || !item || !art || !url) return;
    art.classList.remove("none", "arrived");
    art.style.backgroundImage = `url('${url}')`;
    void art.offsetWidth;
    art.classList.add("arrived");
    // Long enough to look at what just came in.
    if (urlOf(item.cg)) mw.since = Math.max(mw.since, Date.now() - Math.max(0, readingMs(item.text) - 5000));
  }
  function waitMeanwhile(m: Montage): void {
    clearTimeout(m.timer);
    const item = m.items?.[m.i];
    if (!item) return; // The morning waits for a tap.
    const tick = () => {
      if (mw !== m || m.items?.[m.i] !== item) return;
      const up = Date.now() - m.since;
      const read = readingMs(item.text);
      if (up >= read && (!item.cg || urlOf(item.cg) || up >= read + MW_DRAWING_MS)) return nextMeanwhile();
      m.timer = window.setTimeout(tick, 500);
    };
    m.timer = window.setTimeout(tick, 500);
  }
  function paintMeanwhile(): void {
    if (!mw?.items) return;
    const m = mw;
    m.box.classList.remove("waiting");
    const body = m.box.querySelector(".mw-body")!;
    const dots = [...m.items!, null].map((_, i) => `<i class="${i === m.i ? "on" : ""}"></i>`).join("");
    const item = m.items![m.i];
    if (!item) {
      const lines = m.morning.length ? `<ul class="mw-list">${m.morning.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : "<p>Nothing you can point to has changed. Not yet.</p>";
      body.innerHTML = `<div class="mw-card mw-morning"><div class="mw-text"><span class="mw-kicker">By morning · Day ${m.day}</span>${lines}</div></div><div class="mw-dots">${dots}</div>`;
      m.box.querySelector(".mw-hint")!.textContent = "Tap to wake";
      waitMeanwhile(m);
      return;
    }
    m.since = Date.now();
    const url = meanwhileUrl(item);
    body.innerHTML = `<div class="mw-card"><div class="mw-art ${url ? "" : "none"}" ${url ? `style="background-image:url('${esc(url)}')"` : ""}></div><div class="mw-text">${item.why ? `<span class="mw-why">${esc(item.why)}</span>` : ""}${esc(item.text)}${item.change ? `<span class="mw-change">${esc(item.change)}</span>` : ""}</div></div><div class="mw-dots">${dots}</div>`;
    m.box.querySelector(".mw-hint")!.textContent = "Tap to continue";
    // The next picture is ready before the cut.
    const next = meanwhileUrl(m.items![m.i + 1]);
    if (next) new Image().src = next;
    waitMeanwhile(m);
  }

  /* ------------------------- A scene read page by page ------------------------- */
  // The montage's card, read at your own pace: forward and back, every picture kept.
  type SceneRead = { title: string; pages: AfterglowPage[] | null; i: number; box: HTMLDivElement };
  let vn: SceneRead | null = null;
  function closeScene(): void {
    if (!vn) return;
    vn.box.remove();
    vn = null;
    backToWriting();
  }
  function openScene(title: string): SceneRead {
    closeScene();
    const box = document.createElement("div");
    box.className = "mw vn waiting";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", title || "Scene");
    box.innerHTML = `<div class="mw-in"><div class="mw-title"></div><div class="mw-body"><div class="mw-card mw-day"><div class="mw-text"><p class="mw-quiet">Writing…</p></div></div></div><div class="mw-hint"></div></div>`;
    box.addEventListener("click", () => stepScene(1));
    noteWriting();
    el.append(box);
    vn = { title, pages: null, i: 0, box };
    return vn;
  }
  /** The picture a page shows: its own, else the last one before it, so a picture stays up while its moment goes on. */
  function sceneArt(s: SceneRead): string | null {
    for (let i = s.i; i >= 0; i--) {
      const key = s.pages![i]?.cg;
      if (key) return urlOf(key) ?? null;
    }
    return null;
  }
  function paintScene(): void {
    const s = vn;
    if (!s?.pages) return;
    const page = s.pages[s.i]!;
    const url = sceneArt(s);
    s.box.classList.remove("waiting");
    s.box.querySelector(".mw-title")!.textContent = s.title;
    const dots = s.pages.map((_, i) => `<i class="${i === s.i ? "on" : ""}"></i>`).join("");
    s.box.querySelector(".mw-body")!.innerHTML = `<div class="mw-card"><div class="mw-art ${url ? "" : "none"}" ${url ? `style="background-image:url('${esc(url)}')"` : ""}></div><div class="mw-text">${esc(page.text)}</div></div><div class="mw-dots">${dots}</div>`;
    s.box.querySelector(".mw-hint")!.textContent = s.i < s.pages.length - 1 ? "Tap to continue" : "Tap to close";
  }
  function stepScene(by: number): void {
    const s = vn;
    if (!s?.pages) return;
    const next = s.i + by;
    if (next >= s.pages.length) return closeScene();
    s.i = Math.max(0, next);
    paintScene();
  }

  return {
    chatId: first.chatId,
    afterglow(title, pages) {
      if (destroyed) return;
      if (!pages) {
        openScene(title);
        return;
      }
      if (!pages.length) return closeScene();
      const s = vn ?? openScene(title);
      s.title = title;
      s.pages = pages;
      s.i = 0;
      paintScene();
    },
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
      if (mw && (mw.items?.[mw.i]?.art === key || mw.items?.[mw.i]?.cg === key)) meanwhileArt();
      if (vn?.pages?.some((p) => p.cg === key)) paintScene();
      classes.art(key);
    },
    forge(v) {
      if (!destroyed) classes.set(v);
    },
    meanwhile(day, items, words) {
      if (destroyed) return;
      if (!items) {
        openMeanwhile(day, words?.today);
        return;
      }
      if (!mw || mw.day !== day) openMeanwhile(day, words?.today);
      const m = mw!;
      m.items = items;
      m.morning = words?.morning ?? [];
      m.i = 0;
      clearTimeout(m.timer);
      m.timer = window.setTimeout(() => mw === m && paintMeanwhile(), Math.max(0, MW_DAY_MS - (Date.now() - m.openedAt)));
    },
    encounter(e) {
      if (destroyed || !current?.r.encounter) return false;
      try {
        return current.r.encounter(e) === true;
      } catch (err) {
        console.warn("[gambit] theme could not stage the encounter", err);
        return false;
      }
    },
    hide() {
      closeZoom();
      noteWriting();
      hidden = true;
      el.classList.add("gone");
    },
    show() {
      hidden = false;
      el.classList.remove("gone");
      layer?.resize();
      kick();
      renderTheme();
      backToWriting();
    },
    destroy() {
      destroyed = true;
      closeMeanwhile();
      closeScene();
      closeZoom();
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
