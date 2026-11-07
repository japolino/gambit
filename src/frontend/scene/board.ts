/**
 * The expedition board (engine/world/board.ts): a honeycomb dealt face
 * down on a map of the place drawn from above (art kind "map"), with the
 * place's painting as the room around it. Turning a tile lifts it off the
 * map, so the ground under it shows; until the map is drawn the tiles have
 * faces of their own. Shared by every theme the way the
 * class panel and "Meanwhile…" are: the host mounts it, the theme hands it
 * a skin (colours, tile material, type) and may restyle `.gs > .bd`.
 *
 * Motion carries the game: tiles are dealt in from the middle, a turned
 * tile swells as it flips and lets off a ring and sparks, gains pop up
 * where they happened, tokens hop from tile to tile, foes bob, and what
 * you can reach glows. Everything respects reduced motion.
 */
import type { BoardView, SceneView } from "../../shared/scene-view.js";
import { esc } from "./themes/contract.js";

export type BoardOp = "move" | "lore" | "camp" | "skip" | "leave";

export interface BoardSkin {
  /** Tile material: a card dealt on cloth, a printed hex, 1-bit dither, a phosphor glyph, glass. */
  style: "card" | "print" | "dither" | "glyph" | "glass";
  /** No colour to tell rings apart (1-bit): rings differ by stroke pattern. */
  mono?: boolean;
  font: string;
  /** HUD text and panels. */
  ink: string;
  panel: string;
  edge: string;
  accent: string;
  /** Face-down back and face-up front of a tile. */
  back: string;
  backEdge: string;
  face: string;
  faceEdge: string;
  /** Ring colours: safe, chance, story, the way on. */
  rings: { safe: string; chance: string; lore: string; goal: string };
  foe: string;
  token: string;
  /** Behind the board, over the place painting. */
  veil: string;
}

export const DEFAULT_SKIN: BoardSkin = {
  style: "print",
  font: '15px/1.4 "Palatino Linotype", Georgia, serif',
  ink: "#efe4cc",
  panel: "rgba(22,17,12,.86)",
  edge: "rgba(233,212,173,.35)",
  accent: "#e9c46a",
  back: "#2c241c",
  backEdge: "#5b4a36",
  face: "#e8dcc0",
  faceEdge: "#8a7556",
  rings: { safe: "#5fa8e8", chance: "#6cc36a", lore: "#b27ce8", goal: "#f2c14e" },
  foe: "#c8433a",
  token: "#f4ead2",
  veil: "radial-gradient(ellipse at 50% 45%, rgba(10,8,6,.6), rgba(6,5,4,.93))",
};

export const BOARD_CSS = `
.gs > .bd { position: absolute; inset: 0; z-index: 30; display: grid; grid-template-rows: auto 1fr auto; background: #0b0a09; color: var(--ink); font: var(--font); animation: bdIn .45s ease; }
.gs > .bd.gone { display: none; }
.bd .bd-back { position: absolute; inset: -12px; z-index: -1; background: #0b0a09 center / cover no-repeat; filter: blur(2px) brightness(.7) saturate(.9); transform: scale(1.04); transition: background-image .6s; }
.bd .bd-back::after { content: ""; position: absolute; inset: 0; background: var(--veil); opacity: .7; }
.bd { isolation: isolate; overflow: hidden; }
.bd .comb-edge polygon { fill: color-mix(in srgb, var(--back) 70%, #000); stroke: color-mix(in srgb, var(--back) 60%, #000); stroke-width: 10; stroke-linejoin: round; }
.bd .comb-shadow { filter: blur(10px); opacity: .7; }
.bd image.bd-map { opacity: 0; transition: opacity 1.2s ease; }
.bd.has-map image.bd-map { opacity: 1; }
.bd.has-map .face .hx { fill: color-mix(in srgb, var(--face) 10%, transparent); stroke: color-mix(in srgb, var(--faceEdge) 55%, transparent); stroke-width: 1.5; }
.bd.has-map .used .face .hx { fill: rgba(0,0,0,.18); }
.bd.has-map .face .ring { opacity: .55; stroke-width: 2.5; }
.bd.has-map .face .ico { stroke: #fff; filter: drop-shadow(0 1px 2px rgba(0,0,0,.9)); }
.bd.has-map .face .ico .fill { fill: #fff; }
.bd.has-map .face .ico-disc { display: block; }
.bd .ico-disc { display: none; fill: rgba(0,0,0,.42); }
.bd.has-map .back .hx { fill-opacity: .84; }
.bd .tok image { pointer-events: none; }
.bd .bd-top, .bd .bd-bot { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; padding: 10px 16px; }
.bd .bd-top { justify-content: space-between; }
.bd .bd-name { font-size: 1.25em; letter-spacing: .02em; }
.bd .bd-name small { display: block; font-size: .62em; opacity: .7; letter-spacing: .14em; text-transform: uppercase; }
.bd .bd-sup { display: flex; align-items: center; gap: 6px; }
.bd .bd-sup b { min-width: 2ch; text-align: right; font-variant-numeric: tabular-nums; }
.bd .bd-pips { display: flex; gap: 3px; }
.bd .bd-pips i { width: 9px; height: 14px; border-radius: 2px; background: var(--edge); transition: background .3s, transform .3s; }
.bd .bd-pips i.on { background: var(--accent); }
.bd .bd-pips i.new { animation: bdPip .6s ease; }
.bd .bd-party { display: flex; gap: 6px; flex-wrap: wrap; }
.bd .bd-chip { display: flex; align-items: center; gap: 6px; padding: 3px 10px 3px 3px; border-radius: 999px; background: var(--panel); border: 1px solid var(--edge); opacity: .7; transition: opacity .2s, border-color .2s; }
.bd .bd-chip.on { opacity: 1; border-color: var(--accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent); }
.bd .bd-chip span { width: 24px; height: 24px; border-radius: 50%; background: var(--token) center/cover; display: grid; place-items: center; color: #1a130c; font-weight: bold; font-size: 13px; }
.bd .bd-stage { position: relative; min-height: 0; }
.bd svg.bd-svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.bd .bd-bot { justify-content: center; background: linear-gradient(transparent, rgba(0,0,0,.35)); }
.bd .bd-say { flex: 1 1 100%; text-align: center; min-height: 1.4em; opacity: .92; font-style: italic; }
.bd button { font: inherit; color: var(--ink); background: var(--panel); border: 1px solid var(--edge); border-radius: 6px; padding: 6px 14px; cursor: pointer; transition: border-color .15s, transform .15s; }
.bd button:hover:not(:disabled), .bd button:focus-visible { border-color: var(--accent); transform: translateY(-1px); outline: none; }
.bd button:disabled { opacity: .45; cursor: default; }
.bd .bd-legend { display: flex; gap: 12px; font-size: .8em; opacity: .75; }
.bd .bd-legend i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; border: 2px solid; margin-right: 4px; vertical-align: -1px; }
.bd .bd-toasts { position: absolute; left: 50%; top: 8px; transform: translateX(-50%); display: grid; gap: 6px; justify-items: center; pointer-events: none; z-index: 3; }
.bd .bd-toast { padding: 5px 14px; border-radius: 999px; background: var(--panel); border: 1px solid var(--edge); animation: bdToast 2.6s ease both; white-space: nowrap; }
.bd .bd-toast.foe { border-color: var(--foe); color: #fff; background: color-mix(in srgb, var(--foe) 55%, #000); }
.bd .bd-toast.goal, .bd .bd-toast.coin { border-color: var(--accent); }
.bd .bd-busy { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(0,0,0,.35); z-index: 4; font-style: italic; }
.bd .bd-busy span { padding: 8px 18px; border-radius: 8px; background: var(--panel); border: 1px solid var(--edge); animation: bdPulse 1.4s ease-in-out infinite; }
.bd .bd-card { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(520px, calc(100% - 32px)); max-height: calc(100% - 24px); overflow: auto; display: grid; gap: 12px; padding: 18px 20px; border-radius: 12px; background: var(--panel); backdrop-filter: blur(10px); border: 1px solid var(--accent); box-shadow: 0 18px 50px rgba(0,0,0,.6), 0 0 0 100vmax rgba(0,0,0,.35); z-index: 5; animation: bdCard .35s cubic-bezier(.2,1.4,.4,1) both; }
.bd .bd-card h3 { margin: 0; font-size: 1.3em; font-weight: normal; }
.bd .bd-cg { margin: -18px -20px 0; aspect-ratio: 16 / 9; background: rgba(0,0,0,.25) center / cover no-repeat; border-radius: 12px 12px 0 0; position: relative; overflow: hidden; }
.bd .bd-cg:not(.on)::after { content: "Drawing…"; position: absolute; inset: 0; display: grid; place-items: center; font-size: .75em; letter-spacing: .16em; text-transform: uppercase; opacity: .55; animation: bdPulse 1.6s ease-in-out infinite; }
.bd .bd-cg.on { animation: bdCgIn .6s ease both; }
@keyframes bdCgIn { from { opacity: 0; filter: blur(8px); } to { opacity: 1; filter: none; } }
@keyframes bdPulse { 50% { opacity: .25; } }
.bd .bd-card .k { font-size: .75em; letter-spacing: .16em; text-transform: uppercase; color: var(--rlore); }
.bd .bd-card .stars { color: var(--accent); letter-spacing: .2em; }
.bd .bd-card p { margin: 0; white-space: pre-wrap; }
.bd .bd-card .row { display: flex; flex-wrap: wrap; gap: 8px; }
.bd .bd-card .row button { flex: 1 1 140px; display: grid; gap: 2px; text-align: left; }
.bd .bd-card .row button small { opacity: .75; font-size: .8em; }
.bd .bd-card .row button.pass { flex: 0 0 auto; text-align: center; }
/* the board */
.bd .cell { cursor: default; }
.bd .cell .deal { animation: bdDeal .55s cubic-bezier(.2,1.3,.4,1) both; animation-delay: var(--dl, 0s); }
.bd .cell .tile { transform-box: fill-box; transform-origin: center; }
.bd .hx { stroke-width: 2.5; }
.bd .back .hx { fill: var(--back); stroke: var(--backEdge); }
.bd .face .hx { fill: var(--face); stroke: var(--faceEdge); }
.bd .used .face .hx { fill: color-mix(in srgb, var(--face) 72%, var(--back)); }
.bd .ring { fill: none; stroke-width: 4; opacity: .95; }
.bd .ring.safe { stroke: var(--rsafe); } .bd .ring.chance { stroke: var(--rchance); } .bd .ring.lore { stroke: var(--rlore); } .bd .ring.goal { stroke: var(--rgoal); stroke-width: 5; }
.bd.mono .ring.chance { stroke-dasharray: 6 5; } .bd.mono .ring.lore { stroke-dasharray: 2 4; stroke-width: 5; } .bd.mono .ring.goal { stroke-width: 7; }
.bd .back .glint { fill: none; stroke: color-mix(in srgb, var(--backEdge) 70%, #fff); stroke-width: 1.2; opacity: .5; }
.bd .ico { fill: none; stroke: var(--faceEdge); stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
.bd .ico .fill { fill: var(--faceEdge); stroke: none; }
.bd .face .ico.lore { stroke: var(--rlore); } .bd .face .ico.lore .fill { fill: var(--rlore); }
.bd .face .ico.goal { stroke: var(--rgoal); } .bd .face .ico.goal .fill { fill: var(--rgoal); }
.bd .stars-s { fill: var(--accent); font: bold 11px/1 sans-serif; text-anchor: middle; }
.bd .ttl { fill: var(--ink); font: 10px/1 sans-serif; text-anchor: middle; paint-order: stroke; stroke: rgba(0,0,0,.75); stroke-width: 3px; pointer-events: none; }
.bd .cell.reach { cursor: pointer; }
.bd .cell.reach .glow { fill: none; stroke: var(--accent); stroke-width: 3; stroke-dasharray: 8 6; animation: bdMarch 1.2s linear infinite; opacity: .9; }
.bd .cell.reach:hover .tile, .bd .cell.reach:focus-visible .tile { transform: scale(1.08); }
.bd .cell.reach:focus-visible { outline: none; }
.bd .cell .tile { transition: transform .18s ease; }
.bd .bang { fill: var(--accent); font: bold 22px/1 sans-serif; text-anchor: middle; animation: bdBang 1.1s ease-in-out infinite; pointer-events: none; }
.bd .tok { transition: transform .38s cubic-bezier(.3,1.4,.5,1); pointer-events: none; }
.bd .tok .hop { animation: bdHop .38s ease; }
.bd .tok circle.base { fill: var(--token); stroke: rgba(0,0,0,.6); stroke-width: 2; }
.bd .tok.on circle.base { stroke: var(--accent); stroke-width: 3.5; }
.bd .tok.on .bob { animation: bdBob 1.6s ease-in-out infinite; }
.bd .tok text { fill: #1a130c; font: bold 15px/1 sans-serif; text-anchor: middle; dominant-baseline: central; }
.bd .foe { transition: transform .5s ease; pointer-events: none; }
.bd .foe .bob { animation: bdBob 1.3s ease-in-out infinite; }
.bd .foe path.body { fill: var(--foe); stroke: rgba(0,0,0,.7); stroke-width: 2; }
.bd .foe circle.eye { fill: #fff3c4; }
.bd .wave { fill: none; stroke: var(--accent); stroke-width: 4; transform-box: fill-box; transform-origin: center; animation: bdWave .7s ease-out both; pointer-events: none; }
.bd .spark { fill: var(--accent); animation: bdSpark .8s ease-out both; pointer-events: none; }
.bd .pop { fill: var(--ink); font: bold 17px/1 sans-serif; text-anchor: middle; paint-order: stroke; stroke: rgba(0,0,0,.8); stroke-width: 4px; animation: bdPop 1.3s ease-out both; pointer-events: none; }
.bd .pop.supply { fill: var(--rchance); } .bd .pop.lore { fill: var(--rlore); } .bd .pop.hurt, .bd .pop.foe { fill: #ff8a7a; } .bd .pop.coin, .bd .pop.goal { fill: var(--accent); } .bd .pop.heal { fill: var(--rsafe); }
/* materials */
.bd[data-style="card"] .back .hx { fill: url(#bd-lattice); }
.bd[data-style="card"] .back .glint { stroke: var(--backEdge); stroke-width: 2.2; opacity: .85; }
.bd[data-style="card"] .tile, .bd[data-style="glass"] .tile { filter: drop-shadow(0 4px 3px rgba(0,0,0,.45)); }
.bd[data-style="glass"] .back .hx { fill: url(#bd-glass); }
.bd[data-style="glass"] .back .glint { stroke: var(--backEdge); opacity: .55; }
.bd[data-style="glass"] .bd-card, .bd[data-style="glass"] .bd-chip, .bd[data-style="glass"] button { border-style: double; border-width: 3px; }
.bd[data-style="dither"] .bd-back { filter: grayscale(1) contrast(1.4) brightness(.35); }
.bd[data-style="dither"] image.bd-map { filter: grayscale(1) contrast(1.6); }
.bd[data-style="dither"] svg, .bd[data-style="glyph"] svg { shape-rendering: crispEdges; }
.bd[data-style="dither"] .back .hx { fill: url(#bd-dith); }
.bd[data-style="dither"] .back .glint { display: none; }
.bd[data-style="glyph"] .back .hx { fill: url(#bd-scan); }
.bd[data-style="glyph"] .bd-back { filter: brightness(.3) saturate(.4); }
.bd[data-style="dither"] button, .bd[data-style="dither"] .bd-card, .bd[data-style="dither"] .bd-chip, .bd[data-style="dither"] .bd-toast, .bd[data-style="dither"] .bd-pips i,
.bd[data-style="glyph"] button, .bd[data-style="glyph"] .bd-card, .bd[data-style="glyph"] .bd-chip, .bd[data-style="glyph"] .bd-toast, .bd[data-style="glyph"] .bd-pips i { border-radius: 0; }
.bd[data-style="glyph"] .bd-card, .bd[data-style="glyph"] button { border: 3px double var(--edge); box-shadow: 6px 6px 0 #000; }
.bd[data-style="glyph"] .bd-card { backdrop-filter: none; }
.bd.mono .foe circle.eye { fill: var(--back); }
.bd.mono .pop { fill: var(--ink) !important; }
.bd.mono .bd-toast.foe { background: var(--ink); color: var(--back); }
.bd.mono .bd-card { backdrop-filter: none; box-shadow: 0 0 0 100vmax rgba(0,0,0,.6); }
.bd.mono .tok text { fill: var(--back); }
.bd.mono .face .ico.goal, .bd.mono .face .ico.lore { stroke: var(--faceEdge); }
.bd.mono .face .ico.goal .fill, .bd.mono .face .ico.lore .fill { fill: var(--faceEdge); }
.bd.mono .stars-s { fill: var(--faceEdge); }
@keyframes bdIn { from { opacity: 0; } }
@keyframes bdDeal { from { transform: translate(var(--fx, 0px), var(--fy, 0px)) scale(.2) rotate(-40deg); opacity: 0; } }
@keyframes bdMarch { to { stroke-dashoffset: -28; } }
@keyframes bdBang { 0%, 100% { transform: translateY(0); opacity: .85; } 50% { transform: translateY(-5px); opacity: 1; } }
@keyframes bdHop { 40% { transform: translateY(-18px) scale(1.08); } }
@keyframes bdBob { 50% { transform: translateY(-4px); } }
@keyframes bdWave { from { transform: scale(.3); opacity: 1; } to { transform: scale(1.6); opacity: 0; } }
@keyframes bdSpark { from { transform: translate(0, 0) scale(1); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(.2); opacity: 0; } }
@keyframes bdPop { 0% { transform: translateY(0) scale(.6); opacity: 0; } 15% { transform: translateY(-8px) scale(1.15); opacity: 1; } 70% { opacity: 1; } 100% { transform: translateY(-44px) scale(1); opacity: 0; } }
@keyframes bdToast { 0% { opacity: 0; transform: translateY(-8px); } 10%, 80% { opacity: 1; transform: none; } 100% { opacity: 0; } }
@keyframes bdPip { 40% { transform: scaleY(1.5); } }
@keyframes bdPulse { 50% { opacity: .6; } }
@keyframes bdCard { from { transform: translate(-50%, -46%) scale(.92); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .gs > .bd, .bd *, .bd .cell .deal { animation: none !important; transition: none !important; } }
`;

const S = 46; // hex outer radius in SVG units
/** Tile materials: a 1-bit dither, a card back's lattice, a lacquered gradient, terminal scanlines. */
const DEFS = `<defs>
<pattern id="bd-dith" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" style="fill:var(--back)"/><rect width="1" height="1" style="fill:var(--backEdge)"/><rect x="2" y="2" width="1" height="1" style="fill:var(--backEdge)"/></pattern>
<pattern id="bd-lattice" width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="11" height="11" style="fill:var(--back)"/><path d="M0 0H11M0 0V11" style="stroke:var(--backEdge);stroke-width:1.3;opacity:.5"/><circle cx="5.5" cy="5.5" r="1.2" style="fill:var(--backEdge);opacity:.35"/></pattern>
<linearGradient id="bd-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:color-mix(in srgb, var(--back) 62%, var(--backEdge))"/><stop offset=".55" style="stop-color:var(--back)"/><stop offset="1" style="stop-color:color-mix(in srgb, var(--back) 85%, #000)"/></linearGradient>
<pattern id="bd-scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" style="fill:var(--back)"/><rect width="4" height="1" style="fill:var(--backEdge);opacity:.55"/></pattern>
</defs>`;
const R3 = Math.sqrt(3);
const NS = "http://www.w3.org/2000/svg";
const ctr = (q: number, r: number) => ({ x: S * 1.5 * q, y: S * R3 * (r + q / 2) });
const hexPts = (s: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${(s * Math.cos(a)).toFixed(1)},${(s * Math.sin(a)).toFixed(1)}`;
  }).join(" ");

/** Line icons for what a face-up tile is, drawn in a ~30-unit box around the middle. */
function icon(kind: NonNullable<BoardView["cells"][number]["kind"]>, lore?: string): string {
  switch (kind) {
    case "start":
      return `<path d="M-11 12V-2a11 11 0 0 1 22 0v14M-15 12h30"/>`;
    case "goal":
      return `<path d="M-8 14V-14M-8 -13h16l-5 6 5 6H-8"/><path class="fill" d="M-8 -13h16l-5 6 5 6H-8z" opacity=".35"/>`;
    case "camp":
      return `<path d="M-15 11L0 -12 15 11ZM0 -12V11M-5 11L0 3 5 11"/>`;
    case "spring":
      return `<path d="M0 -13C6 -4 10 1 10 6a10 10 0 0 1-20 0c0-5 4-10 10-19Z"/><path d="M-4 6a4 4 0 0 0 4 4"/>`;
    case "cache":
      return `<path d="M-13 -2h26v13h-26ZM-13 -2c0-8 26-8 26 0M-2 3h4"/>`;
    case "forage":
      return `<circle cx="-5" cy="4" r="5"/><circle cx="6" cy="6" r="4"/><path d="M-5 -1C-4 -8 2 -12 8 -12C6 -6 2 -3 -5 -1"/>`;
    case "hazard":
      return `<path d="M0 -13L13 11H-13Z"/><path d="M0 -4v7M0 7v.5"/>`;
    case "shortcut":
      return `<path d="M-14 0C-8 -9 8 -9 14 0C8 9 -8 9 -14 0Z"/><circle cx="0" cy="0" r="4"/>`;
    case "quiet":
      return `<path d="M-6 6c-3-1-3-6 0-6s3 5 0 6M5 -2c-3-1-3-6 0-6s3 5 0 6" opacity=".7"/>`;
    case "lore":
      if (lore === "person") return `<circle cx="0" cy="-5" r="6"/><path d="M-11 13c0-7 5-10 11-10s11 3 11 10"/>`;
      if (lore === "fact") return `<circle cx="-6" cy="0" r="5"/><path d="M-1 0h14M9 0v5M13 0v4"/>`;
      if (lore === "thread") return `<path d="M0 0c3 0 4 3 2 5s-7 1-7-4 5-9 10-8 9 6 7 11-8 9-13 7"/>`;
      return `<path d="M0 -9C-5 -12 -11 -12 -14 -10V10C-11 8 -5 8 0 11C5 8 11 8 14 10V-10C11 -12 5 -12 0 -9ZM0 -9V11"/>`;
  }
}

const KIND_NAME: Record<string, string> = { start: "The way in", goal: "The way on", camp: "A camp", spring: "A spring", cache: "A cache", forage: "Forage", hazard: "A hazard", shortcut: "A lookout", quiet: "Quiet ground", lore: "Lore" };
const RING_NAME: Record<string, string> = { safe: "safe", chance: "chance", lore: "story", goal: "the way on" };
const LORE_NAME: Record<string, string> = { fact: "A secret", person: "Someone", entry: "From the lorebook", thread: "The larger story" };
const TIER_NAME = ["", "Glimpse", "Scene", "Discover"];
const TIER_HINT: Record<string, string[]> = {
  fact: ["", "A rumour of it", "Most of it, written", "Learn it for good (use it when you talk)"],
  person: ["", "Signs of them", "A sight of them, written", "They stay on your mind"],
  entry: ["", "Its first line", "A scene from it", "A scene, kept in the journal"],
  thread: ["", "A hint", "Part of the larger story", "A piece of the larger story"],
};

export interface BoardHandle {
  set(v: SceneView, skin: BoardSkin): void;
  /** Board keys: 1-3 open a lore tile, Esc passes, Space holds still, C makes camp. True when handled. */
  key(e: KeyboardEvent): boolean;
  destroy(): void;
}

export type BoardArt = (key: string | undefined) => { url: string; face?: [number, number, number, number] | null } | null;

export function mountBoard(host: HTMLElement, act: (op: BoardOp, cell?: string, tier?: number) => void, reducedMotion: boolean, artOf: BoardArt = () => null): BoardHandle {
  const el = document.createElement("div");
  el.className = "bd gone";
  el.setAttribute("role", "region");
  el.setAttribute("aria-label", "Expedition board");
  el.innerHTML = `
    <div class="bd-top"><div class="bd-name"></div><div class="bd-party"></div><div class="bd-sup" title="Supplies: turning a tile earns one; story tiles spend them"><span>Supplies</span><div class="bd-pips"></div><b></b></div></div>
    <div class="bd-back"></div>
    <div class="bd-stage"><svg class="bd-svg" xmlns="${NS}">${DEFS}<g class="comb"></g><g class="cells"></g><g class="foes"></g><g class="toks"></g><g class="fx"></g></svg><div class="bd-toasts"></div></div>
    <div class="bd-bot"><div class="bd-say"></div><button class="b-skip" title="Space">Hold still</button><button class="b-camp" title="C">Make camp</button><button class="b-leave">Turn back</button>
      <div class="bd-legend"><span><i class="l-safe"></i>safe</span><span><i class="l-chance"></i>chance</span><span><i class="l-lore"></i>story</span><span><i class="l-goal"></i>way on</span></div></div>`;
  host.append(el);
  const $ = <T extends Element>(s: string) => el.querySelector(s) as T;
  const svg = $<SVGSVGElement>("svg");
  const gCells = $<SVGGElement>("g.cells");
  const gComb = $<SVGGElement>("g.comb");
  const back = $<HTMLDivElement>(".bd-back");
  let mapUrl = "";
  let backUrl = "";
  /** Natural sizes of portrait images, for face crops. */
  const dims = new Map<string, { w: number; h: number } | "loading">();
  const gFoes = $<SVGGElement>("g.foes");
  const gToks = $<SVGGElement>("g.toks");
  const gFx = $<SVGGElement>("g.fx");
  const stage = $<HTMLDivElement>(".bd-stage");
  const toasts = $<HTMLDivElement>(".bd-toasts");
  $<HTMLButtonElement>(".b-skip").onclick = () => !busy && act("skip");
  $<HTMLButtonElement>(".b-camp").onclick = () => !busy && act("camp");
  $<HTMLButtonElement>(".b-leave").onclick = () => !busy && act("leave");

  let ident = "";
  let last: BoardView | null = null;
  let busy = false;
  let fxSig = "";
  let storySeen = "";
  const cellEls = new Map<string, SVGGElement>();
  const tokEls = new Map<string, SVGGElement>();
  const foeEls = new Map<string, SVGGElement>();
  let card: HTMLDivElement | null = null;
  let busyEl: HTMLDivElement | null = null;

  const svgEl = (tag: string, attrs: Record<string, string> = {}, html = "") => {
    const n = document.createElementNS(NS, tag) as SVGElement;
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (html) n.innerHTML = html;
    return n;
  };

  function fit(b: BoardView): void {
    const xs = b.cells.map((c) => ctr(c.q, c.r));
    const minX = Math.min(...xs.map((p) => p.x)) - S * 1.3;
    const maxX = Math.max(...xs.map((p) => p.x)) + S * 1.3;
    const minY = Math.min(...xs.map((p) => p.y)) - S * 1.4;
    const maxY = Math.max(...xs.map((p) => p.y)) + S * 1.2;
    svg.setAttribute("viewBox", `${minX.toFixed(0)} ${minY.toFixed(0)} ${(maxX - minX).toFixed(0)} ${(maxY - minY).toFixed(0)}`);
  }

  /** The inner look of a tile, face down (its ring) or face up (what it is). */
  function tileHtml(c: BoardView["cells"][number], up: boolean): string {
    const ring = `<polygon class="ring ${c.ring}" points="${hexPts(S - 7)}"/>`;
    if (!up) return `<g class="back"><polygon class="hx" points="${hexPts(S - 2)}"/><polygon class="glint" points="${hexPts(S - 14)}"/>${ring}</g>`;
    const k = c.kind ?? "quiet";
    const stars = c.stars ? `<text class="stars-s" y="${S - 15}">${"★".repeat(c.stars)}</text>` : "";
    const cls = k === "lore" ? "lore" : k === "goal" ? "goal" : "";
    return `<g class="face"><polygon class="hx" points="${hexPts(S - 2)}"/>${ring}<circle class="ico-disc" cy="-3" r="19"/><g class="ico ${cls}" transform="translate(0 -3)">${icon(k, c.lore)}</g>${stars}</g>`;
  }

  function label(c: BoardView["cells"][number]): string {
    if (!c.open && c.kind !== "goal") return `Face-down tile, ${RING_NAME[c.ring]}`;
    return `${c.title ?? KIND_NAME[c.kind ?? "quiet"]}${c.used ? ", spent" : ""}`;
  }

  function build(b: BoardView): void {
    gCells.replaceChildren();
    gFoes.replaceChildren();
    gToks.replaceChildren();
    gFx.replaceChildren();
    cellEls.clear();
    tokEls.clear();
    foeEls.clear();
    fit(b);
    // The board itself: a thick slab under the comb, and the map clipped to the comb's outline.
    const xs = b.cells.map((c) => ctr(c.q, c.r));
    const minX = Math.min(...xs.map((p) => p.x)) - S;
    const maxX = Math.max(...xs.map((p) => p.x)) + S;
    const minY = Math.min(...xs.map((p) => p.y)) - S;
    const maxY = Math.max(...xs.map((p) => p.y)) + S;
    const polys = b.cells.map((c) => {
      const p = ctr(c.q, c.r);
      return `<polygon points="${hexPts(S + 1)}" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})"/>`;
    });
    const side = Math.max(maxX - minX, maxY - minY);
    gComb.innerHTML = `<clipPath id="bd-comb">${polys.join("")}</clipPath><g class="comb-edge comb-shadow" transform="translate(0 14)">${polys.join("")}</g><g class="comb-edge" transform="translate(0 6)">${polys.join("")}</g><image class="bd-map" x="${((minX + maxX) / 2 - side / 2).toFixed(0)}" y="${((minY + maxY) / 2 - side / 2).toFixed(0)}" width="${side.toFixed(0)}" height="${side.toFixed(0)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#bd-comb)"/>`;
    mapUrl = "";
    for (const c of b.cells) {
      const p = ctr(c.q, c.r);
      const g = svgEl("g", { class: "cell", transform: `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`, "data-k": c.k }) as SVGGElement;
      const d = Math.max(Math.abs(c.q), Math.abs(c.r), Math.abs(c.q + c.r));
      // Dealt from the middle outward, each tile flying in from the centre.
      g.innerHTML = `<g class="deal" style="--dl:${(d * 0.09 + ((c.q * 7 + c.r * 13) & 3) * 0.03).toFixed(2)}s;--fx:${(-p.x * 0.6).toFixed(0)}px;--fy:${(-p.y * 0.6).toFixed(0)}px"><g class="tile">${tileHtml(c, c.open || c.kind === "goal")}</g><polygon class="glow" points="${hexPts(S - 1)}" style="display:none"/></g>`;
      g.addEventListener("click", () => {
        if (!busy && g.classList.contains("reach")) act("move", c.k);
      });
      g.addEventListener("keydown", (e) => {
        if ((e.key === "Enter" || e.key === " ") && g.classList.contains("reach") && !busy) {
          e.preventDefault();
          e.stopPropagation();
          act("move", c.k);
        }
      });
      gCells.append(g);
      cellEls.set(c.k, g);
    }
  }

  /** Turn a tile over: it swells to twice its size at the edge-on moment, then settles face up, with a ring and sparks. */
  function flip(c: BoardView["cells"][number]): void {
    const g = cellEls.get(c.k);
    const tile = g?.querySelector(".tile") as SVGGElement | null;
    if (!g || !tile) return;
    if (reducedMotion || !tile.animate) {
      tile.innerHTML = tileHtml(c, true);
      return;
    }
    gCells.append(g); // on top while it swells
    tile.animate([{ transform: "scale(1, 1)" }, { transform: "scale(0.02, 2)", offset: 0.5 }, { transform: "scale(1, 1)" }], { duration: 700, easing: "ease-in-out" });
    setTimeout(() => {
      tile.innerHTML = tileHtml(c, true);
      burst(c);
    }, 350);
  }

  function at(k: string): { x: number; y: number } | null {
    const c = last?.cells.find((x) => x.k === k);
    return c ? ctr(c.q, c.r) : null;
  }

  function burst(c: BoardView["cells"][number]): void {
    if (reducedMotion) return;
    const p = ctr(c.q, c.r);
    const g = svgEl("g", { transform: `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})` });
    const col = c.ring === "lore" ? "var(--rlore)" : c.ring === "goal" ? "var(--rgoal)" : c.ring === "safe" ? "var(--rsafe)" : "var(--rchance)";
    g.innerHTML = `<circle class="wave" r="${S}" style="stroke:${col}"/>${Array.from({ length: 8 }, (_, i) => {
      const a = (Math.PI / 4) * i + 0.3;
      return `<path class="spark" d="M0 -4L3 0 0 4 -3 0Z" style="--dx:${(Math.cos(a) * S * 1.3).toFixed(0)}px;--dy:${(Math.sin(a) * S * 1.3).toFixed(0)}px;fill:${col}"/>`;
    }).join("")}`;
    gFx.append(g);
    setTimeout(() => g.remove(), 900);
  }

  function pop(k: string | undefined, text: string, kind: string, i: number): void {
    const p = k ? at(k) : null;
    if (!p) {
      const t = document.createElement("div");
      t.className = `bd-toast ${kind}`;
      t.textContent = text;
      t.style.animationDelay = `${i * 0.25}s`;
      toasts.append(t);
      setTimeout(() => t.remove(), 3000 + i * 250);
      return;
    }
    if (reducedMotion) return;
    const n = svgEl("text", { class: `pop ${kind}`, x: p.x.toFixed(0), y: (p.y - S * 0.5).toFixed(0), style: `animation-delay:${(0.35 + i * 0.15).toFixed(2)}s` });
    n.textContent = text;
    gFx.append(n);
    setTimeout(() => n.remove(), 1800 + i * 150);
  }

  function tokPos(b: BoardView, i: number): { x: number; y: number } {
    const m = b.party[i]!;
    const p = ctr(m.q, m.r);
    const here = b.party.filter((x) => x.q === m.q && x.r === m.r);
    if (here.length < 2) return p;
    const j = here.indexOf(m);
    const off = [
      [-0.3, -0.12],
      [0.3, -0.12],
      [0, 0.32],
    ][j] ?? [0, 0];
    return { x: p.x + off[0]! * S, y: p.y + off[1]! * S };
  }

  /** A token's picture: their figure cropped to the face once it is drawn, else their card art. */
  function paintToken(g: SVGGElement, m: BoardView["party"][number], imageUrl: (id: string) => string): void {
    const pic = g.querySelector(".pic") as SVGGElement;
    const text = g.querySelector("text") as SVGTextElement;
    const fig = artOf(m.art);
    const url = fig?.url ?? (m.imageId ? imageUrl(m.imageId) : "");
    const r = S * 0.33;
    const sig = `${url}|${fig?.face?.join(",") ?? ""}`;
    if (pic.dataset.sig === sig) return;
    if (!url) {
      pic.innerHTML = "";
      text.style.display = "";
      pic.dataset.sig = sig;
      return;
    }
    text.style.display = "none";
    const face = fig?.face;
    const d = dims.get(url);
    if (face && d && d !== "loading") {
      // Crop on the face: a square a little larger than the face box, in the image's own pixels.
      const cx = (face[0] + face[2] / 2) * d.w;
      const cy = (face[1] + face[3] / 2) * d.h;
      const side = Math.max(face[2] * d.w, face[3] * d.h) * 1.7;
      pic.innerHTML = `<svg x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}" viewBox="${(cx - side / 2).toFixed(1)} ${(cy - side / 2).toFixed(1)} ${side.toFixed(1)} ${side.toFixed(1)}" overflow="hidden"><image href="${esc(url)}" width="${d.w}" height="${d.h}"/></svg>`;
      pic.dataset.sig = sig;
      return;
    }
    pic.innerHTML = `<image href="${esc(url)}" x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}" preserveAspectRatio="xMidYMin slice"/>`;
    pic.dataset.sig = sig;
    if (face && !d) {
      dims.set(url, "loading");
      const img = new Image();
      img.onload = () => {
        dims.set(url, { w: img.naturalWidth, h: img.naturalHeight });
        pic.dataset.sig = "";
        if (last) paintToken(g, m, imageUrl);
      };
      img.src = url;
    }
  }

  function drawPieces(b: BoardView, imageUrl: (id: string) => string): void {
    // Party tokens: portrait or initial; the one whose move it is bobs and glows.
    const keep = new Set<string>();
    b.party.forEach((m, i) => {
      keep.add(m.id);
      let g = tokEls.get(m.id);
      const pos = tokPos(b, i);
      if (!g) {
        g = svgEl("g", { class: "tok" }) as SVGGElement;
        const clip = `cl-${m.id.replace(/[^a-z0-9_-]/gi, "")}`;
        g.innerHTML = `<g class="hop"><g class="bob"><circle class="base" r="${(S * 0.36).toFixed(0)}"/><clipPath id="${clip}"><circle r="${(S * 0.33).toFixed(0)}"/></clipPath><g class="pic" clip-path="url(#${clip})"></g><text>${esc(m.name.slice(0, 1).toUpperCase())}</text></g></g>`;
        g.style.transform = `translate(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px)`;
        gToks.append(g);
        tokEls.set(m.id, g);
      } else {
        const t = `translate(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px)`;
        if (g.style.transform !== t) {
          g.style.transform = t;
          const hop = g.querySelector(".hop") as SVGGElement;
          hop.style.animation = "none";
          void hop.getBoundingClientRect();
          hop.style.animation = "";
        }
      }
      paintToken(g, m, imageUrl);
      g.classList.toggle("on", m.active);
      if (m.active) gToks.append(g);
    });
    for (const [id, g] of tokEls) if (!keep.has(id)) (g.remove(), tokEls.delete(id));
    // Foes: horned shapes that bob where they lurk.
    const fk = new Set<string>();
    for (const f of b.foes) {
      fk.add(f.id);
      const p = ctr(f.q, f.r);
      let g = foeEls.get(f.id);
      if (!g) {
        g = svgEl("g", { class: "foe" }) as SVGGElement;
        g.innerHTML = `<g class="bob"><path class="body" d="M-16 12C-18 0 -14 -10 -9 -13L-12 -22 -3 -15C0 -16 3 -16 6 -15L13 -22 10 -12C15 -8 18 2 16 12C8 16 -8 16 -16 12Z"/><circle class="eye" cx="-5" cy="-3" r="2.6"/><circle class="eye" cx="5" cy="-3" r="2.6"/></g>`;
        gFoes.append(g);
        foeEls.set(f.id, g);
      }
      g.style.transform = `translate(${p.x.toFixed(1)}px, ${(p.y + 2).toFixed(1)}px)`;
    }
    for (const [id, g] of foeEls) if (!fk.has(id)) (g.remove(), foeEls.delete(id));
  }

  function chipStyle(m: BoardView["party"][number], imageUrl: (id: string) => string): string {
    const fig = artOf(m.art);
    if (fig?.face) {
      const [fx, fy, fw, fh] = fig.face;
      const z = 1 / Math.max(0.05, fw * 1.6);
      const px = Math.min(100, Math.max(0, ((fx + fw / 2) * z - 0.5) / Math.max(0.001, z - 1) * 100));
      const py = Math.min(100, Math.max(0, ((fy + fh / 2) * z - 0.5) / Math.max(0.001, z - 1) * 100));
      return `background-image:url('${esc(fig.url)}');background-size:${(z * 100).toFixed(0)}% auto;background-position:${px.toFixed(0)}% ${py.toFixed(0)}%`;
    }
    const url = fig?.url ?? (m.imageId ? imageUrl(m.imageId) : "");
    return url ? `background-image:url('${esc(url)}')` : "";
  }

  function hud(v: SceneView, b: BoardView, imageUrl: (id: string) => string): void {
    $<HTMLDivElement>(".bd-name").innerHTML = `<small>Expedition · round ${b.round}</small>${esc(b.name)}`;
    const pips = $<HTMLDivElement>(".bd-pips");
    const before = last?.supplies ?? b.supplies;
    pips.innerHTML = Array.from({ length: b.cap }, (_, i) => `<i class="${i < b.supplies ? "on" : ""}${i < b.supplies && i >= before ? " new" : ""}"></i>`).join("");
    $<HTMLElement>(".bd-sup b").textContent = String(b.supplies);
    $<HTMLDivElement>(".bd-party").innerHTML = b.party
      .map((m) => `<div class="bd-chip ${m.active ? "on" : ""}"><span style="${chipStyle(m, imageUrl)}">${chipStyle(m, imageUrl) ? "" : esc(m.name.slice(0, 1).toUpperCase())}</span>${m.active ? (m.name === "You" ? "Your move" : `${esc(m.name)}'s move`) : esc(m.name)}</div>`)
      .join("");
    $<HTMLDivElement>(".bd-say").textContent = v.log[v.log.length - 1] ?? "";
    const campB = $<HTMLButtonElement>(".b-camp");
    campB.classList.toggle("gone", !b.camp.here);
    campB.textContent = `Make camp (${b.camp.cost} supplies)`;
    campB.disabled = busy || b.supplies < b.camp.cost;
    $<HTMLButtonElement>(".b-skip").disabled = busy || !!b.pending || b.fight;
    $<HTMLButtonElement>(".b-leave").disabled = busy || b.fight;
  }

  function cells(b: BoardView): void {
    const prev = new Map((last?.cells ?? []).map((c) => [c.k, c]));
    let first: HTMLElement | null = null;
    for (const c of b.cells) {
      const g = cellEls.get(c.k);
      if (!g) continue;
      const was = prev.get(c.k);
      const up = c.open || c.kind === "goal";
      const wasUp = was ? was.open || was.kind === "goal" : up;
      if (up && !wasUp) flip(c);
      else if (was && (was.used !== c.used || was.title !== c.title || was.kind !== c.kind)) (g.querySelector(".tile") as SVGGElement).innerHTML = tileHtml(c, up);
      g.classList.toggle("reach", c.reach && !busy);
      g.classList.toggle("used", c.used);
      const glow = g.querySelector(".glow") as SVGElement;
      glow.style.display = c.reach && !busy ? "" : "none";
      if (c.reach && !busy) {
        g.setAttribute("tabindex", "0");
        g.setAttribute("role", "button");
        if (!first) first = g as unknown as HTMLElement;
      } else {
        g.removeAttribute("tabindex");
        g.removeAttribute("role");
      }
      g.setAttribute("aria-label", label(c));
      // A story tile you left for later, and the way on, call to you.
      const want = (c.open && c.kind === "lore" && !c.used) || (c.kind === "goal" && !b.party.every((m) => `${m.q},${m.r}` === c.k));
      let bang = g.querySelector(".bang");
      if (want && !bang) {
        bang = svgEl("text", { class: "bang", y: String(-S * 0.62) });
        bang.textContent = c.kind === "goal" ? "⚑" : "!";
        g.querySelector(".deal")!.append(bang);
      } else if (!want && bang) bang.remove();
    }
  }

  function loreCard(b: BoardView): void {
    const p = b.pending;
    const sig = p ? `${p.cell}|${b.supplies}|${busy}` : "";
    if (!p) {
      if (card?.dataset.kind === "lore") (card.remove(), (card = null));
      return;
    }
    if (card?.dataset.sig === sig) return;
    card?.remove();
    card = document.createElement("div");
    card.className = "bd-card";
    card.dataset.kind = "lore";
    card.dataset.sig = sig;
    card.setAttribute("role", "dialog");
    const hints = TIER_HINT[p.kind] ?? TIER_HINT.entry!;
    card.innerHTML = `<div class="k">${esc(LORE_NAME[p.kind] ?? "Lore")} <span class="stars">${"★".repeat(p.stars)}</span></div><h3>${esc(p.title)}</h3><p>How far do you look into it? You have ${b.supplies} supplies.</p>
      <div class="row">${p.costs.map((cost, i) => `<button data-t="${i + 1}" ${busy || b.supplies < cost ? "disabled" : ""}><b>${i + 1}. ${TIER_NAME[i + 1]}</b><small>${esc(hints[i + 1] ?? "")} · ${cost} suppl${cost === 1 ? "y" : "ies"}</small></button>`).join("")}<button class="pass" data-t="0">Leave it for now</button></div>`;
    card.querySelectorAll<HTMLButtonElement>("button").forEach((btn) => (btn.onclick = () => !busy && act("lore", undefined, Number(btn.dataset.t))));
    stage.append(card);
    (card.querySelector("button:not(:disabled)") as HTMLButtonElement | null)?.focus();
  }

  function storyCard(b: BoardView): void {
    const s = b.story;
    if (!s || b.pending) return;
    const sig = `${s.title}|${s.text.length}|${s.text.slice(0, 40)}`;
    if (sig === storySeen) return;
    storySeen = sig;
    card?.remove();
    card = document.createElement("div");
    card.className = "bd-card";
    card.dataset.kind = "story";
    card.setAttribute("role", "dialog");
    card.innerHTML = `${s.art ? `<div class="bd-cg" data-key="${esc(s.art)}"></div>` : ""}<div class="k">What you find <span class="stars">${"★".repeat(s.stars)}</span></div><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p><div class="row"><button class="pass">Go on</button></div>`;
    paintCg();
    const close = () => {
      card?.remove();
      card = null;
    };
    (card.querySelector("button") as HTMLButtonElement).onclick = close;
    stage.append(card);
    (card.querySelector("button") as HTMLButtonElement).focus();
  }

  /** The story card's CG fades in when it is drawn (it is usually still drawing as you read). */
  function paintCg(): void {
    const box = card?.querySelector<HTMLElement>(".bd-cg");
    if (!box || box.classList.contains("on")) return;
    const url = artOf(box.dataset.key)?.url;
    if (!url) return;
    box.style.backgroundImage = `url('${url.replace(/'/g, "%27")}')`;
    box.classList.add("on");
  }

  function effects(b: BoardView): void {
    const sig = JSON.stringify([b.fx, b.round, b.supplies, b.party.map((m) => `${m.q},${m.r}`), b.foes.length]);
    if (sig === fxSig) return;
    fxSig = sig;
    b.fx.forEach((f, i) => pop(f.cell, f.text, f.kind, i));
  }

  function skinVars(skin: BoardSkin): void {
    const st = el.style;
    st.setProperty("--font", skin.font);
    st.setProperty("--ink", skin.ink);
    st.setProperty("--panel", skin.panel);
    st.setProperty("--edge", skin.edge);
    st.setProperty("--accent", skin.accent);
    st.setProperty("--back", skin.back);
    st.setProperty("--backEdge", skin.backEdge);
    st.setProperty("--face", skin.face);
    st.setProperty("--faceEdge", skin.faceEdge);
    st.setProperty("--rsafe", skin.rings.safe);
    st.setProperty("--rchance", skin.rings.chance);
    st.setProperty("--rlore", skin.rings.lore);
    st.setProperty("--rgoal", skin.rings.goal);
    st.setProperty("--foe", skin.foe);
    st.setProperty("--token", skin.token);
    st.setProperty("--veil", skin.veil);
    el.classList.toggle("mono", !!skin.mono);
    el.dataset.style = skin.style;
    for (const r of ["safe", "chance", "lore", "goal"] as const) (el.querySelector(`.l-${r}`) as HTMLElement).style.borderColor = skin.rings[r];
  }

  return {
    set(v, skin) {
      const b = v.board;
      if (!b) {
        el.classList.add("gone");
        last = null;
        ident = "";
        card?.remove();
        card = null;
        return;
      }
      el.classList.remove("gone");
      skinVars(skin);
      busy = !!v.busy;
      const imageUrl = (id: string) => `/api/v1/images/${id}`;
      const id = `${b.name}|${b.start}|${b.goal}|${b.cells.length}`;
      if (id !== ident) {
        ident = id;
        last = null;
        fxSig = "";
        build(b);
      }
      // The map once it is drawn; the place's painting behind the board meanwhile and after.
      const map = artOf(b.map)?.url ?? "";
      if (map !== mapUrl) {
        mapUrl = map;
        const img = gComb.querySelector("image.bd-map");
        if (img) img.setAttribute("href", map);
      }
      el.classList.toggle("has-map", !!map);
      const painting = artOf(b.painting)?.url ?? "";
      if (painting !== backUrl) {
        backUrl = painting;
        back.style.backgroundImage = painting ? `url('${painting.replace(/'/g, "%27")}')` : "";
      }
      cells(b);
      last = b;
      drawPieces(b, imageUrl);
      hud(v, b, imageUrl);
      effects(b);
      loreCard(b);
      paintCg();
      storyCard(b);
      if (busy && !busyEl) {
        busyEl = document.createElement("div");
        busyEl.className = "bd-busy";
        busyEl.innerHTML = "<span></span>";
        stage.append(busyEl);
      }
      if (busyEl) {
        if (busy) (busyEl.firstElementChild as HTMLElement).textContent = v.busy ?? "";
        else (busyEl.remove(), (busyEl = null));
      }
    },
    key(e) {
      const b = last;
      if (!b || el.classList.contains("gone") || busy) return false;
      const k = e.key.toLowerCase();
      if (card?.dataset.kind === "story" && (k === "enter" || k === "escape" || k === " ")) {
        card.remove();
        card = null;
        return true;
      }
      if (b.pending) {
        if (k === "escape" || k === "0") return (act("lore", undefined, 0), true);
        const t = Number(k);
        if (t >= 1 && t <= b.pending.stars && b.supplies >= (b.pending.costs[t - 1] ?? 99)) return (act("lore", undefined, t), true);
        return false;
      }
      if (k === " " && !(e.target instanceof Element && e.target.closest?.(".cell"))) return (act("skip"), true);
      if (k === "c" && b.camp.here && b.supplies >= b.camp.cost) return (act("camp"), true);
      return false;
    },
    destroy() {
      el.remove();
    },
  };
}
