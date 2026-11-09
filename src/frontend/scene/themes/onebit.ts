/**
 * 1-bit: a monochrome crawler console. The whole screen is composed on ONE
 * low-resolution frame buffer (about 300 virtual rows, scaled up by a whole
 * number of device pixels with nearest-neighbour sampling), so the dithered
 * place, the people, the window chrome, the bitmap type and the cursor all
 * share a single pixel grid; nothing is drawn at native resolution.
 *
 * It is laid out as a workstation of 1-bit windows on a black, dot-matrix
 * desktop: the viewport (the place, dithered with its own torch light and a
 * heavy vignette, the people standing in it cut out by ink moats, numbered
 * name plates on the ledge; or the delve as a raycast stone corridor), the
 * chronicle (narration and log; over the automap / honeycomb out of town),
 * the status readout (time-of-day picture, heart pips, coin, thread beads,
 * supply crates), the WHAT NOW? prompt with an inverse-video cursor bar, and a
 * PC function-key strip for the journal, classes and theme. Invisible buttons sit over everything drawn as a
 * control, so mouse, touch, keyboard and screen readers all work; hover and
 * focus are drawn into the frame buffer as inverse video.
 *
 * A phone keeps the type at one fixed unit (about 2 CSS px, the face at 16px) whatever the screen's height: the
 * windows stack in a page that scrolls, the picture shrinks to what the words leave, every control is 44 CSS px
 * tall, and a corner button and a thumb at the screen's edge say there's more below.
 */
import { BOARD_SKINS } from "../board-skins.js";
import { esc, type MenuItem, type SceneView, type ThemeCtx, type ThemeFactory, type ThemeRenderer } from "./contract.js";
import { loadFont, plain, wrap, type BitFont } from "./onebit/font.js";
import { beatsHtml, canWrite, isWriting, wireWrite, writeFormHtml } from "./write.js";
import { BAYER8, Frame, INK, PAPER, type Bits, type Rect } from "./onebit/fb.js";
import { bustBits, personBits, placeField, textureField } from "./onebit/art.js";
import { Corridor } from "./onebit/corridor.js";
import { drawAutomap, drawHexMap, type HexHit } from "./onebit/maps.js";

/* Phosphor on / off, as 0xAABBGGRR for the ImageData. */
const C_INK = 0xff070708;
const C_PAPER = 0xffe6eef0;
const CSS_INK = "#080707";
const CSS_PAPER = "#f0eee6";

const CSS = `
.ob { position: absolute; inset: 0; background: ${CSS_INK}; overflow: hidden; }
.ob-scroll { position: absolute; inset: 0; overflow-x: hidden; overflow-y: auto; scrollbar-width: none; }
.ob-scroll::-webkit-scrollbar { display: none; }
.ob-cue { position: absolute; right: 0; bottom: 0; width: 44px; height: 44px; margin: 0; padding: 0; border: 2px solid ${CSS_INK}; background: ${CSS_PAPER}; cursor: pointer; z-index: 3; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.ob-cue::after { content: ""; position: absolute; left: 11px; top: 14px; width: 18px; height: 12px; background: ${CSS_INK}; clip-path: polygon(0 0, 100% 0, 50% 100%); }
.ob-cue[hidden], .ob-thumb[hidden] { display: none; }
.ob-thumb { position: absolute; right: 0; width: 4px; background: ${CSS_PAPER}; outline: 1px solid ${CSS_INK}; pointer-events: none; z-index: 3; }
.ob-stage { position: relative; }
.ob-cv { display: block; image-rendering: pixelated; image-rendering: crisp-edges; }
.ob-hits { position: absolute; inset: 0; }
/* Nothing here is drawn at native resolution, the words you type included: the field is there for the keyboard and the
   caret, and the frame buffer paints what's in it. 16px, or a phone zooms in on it. */
.ob-say { position: absolute; z-index: 3; margin: 0; }
.ob-say[hidden] { display: none; }
.ob-say textarea { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; resize: none; overflow: hidden; opacity: 0; font-size: 16px; cursor: text; }
.ob-say button { display: none; }
.ob-hits > * { position: absolute; margin: 0; padding: 0; border: 0; background: transparent; color: transparent; font-size: 0; cursor: pointer; outline: none; -webkit-tap-highlight-color: transparent; }
.ob-hits > .wheel { cursor: default; }
.ob-world { position: absolute; inset: 0; visibility: hidden; pointer-events: none; }
.ob-hexsrc { position: absolute; width: 1px; height: 1px; visibility: hidden; pointer-events: none; }
.ob-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
/* The class panel and "Meanwhile..." live outside the frame buffer: they are
   restyled onto the same grid (--ob-u is one virtual pixel in CSS pixels). */
.gs.onebit > .fg { left: var(--ob-x); top: var(--ob-y); width: var(--ob-w); height: var(--ob-h); right: auto; bottom: auto; z-index: 40;
  background: ${CSS_INK}; color: ${CSS_PAPER}; border: var(--ob-u) solid ${CSS_PAPER}; border-radius: 0;
  box-shadow: inset 0 0 0 var(--ob-u) ${CSS_INK}, inset 0 0 0 calc(var(--ob-u) * 2) ${CSS_PAPER}, calc(var(--ob-u) * 4) calc(var(--ob-u) * 4) 0 0 ${CSS_INK};
  font: var(--ob-f)/1.6 "Gambit 8bit", monospace; -webkit-font-smoothing: none; padding: calc(var(--ob-u) * 2); }
.gs.onebit > .fg header { padding: calc(var(--ob-u) * 2) calc(var(--ob-u) * 3); margin: 0 0 calc(var(--ob-u) * 3); border-bottom: var(--ob-u) solid ${CSS_PAPER};
  background: repeating-linear-gradient(to bottom, ${CSS_INK} 0 var(--ob-u), ${CSS_PAPER} var(--ob-u) calc(var(--ob-u) * 2)); }
.gs.onebit > .fg header b, .gs.onebit > .fg header .purse { background: ${CSS_INK}; color: ${CSS_PAPER}; font-size: var(--ob-f); padding: 0 calc(var(--ob-u) * 3); opacity: 1; }
.gs.onebit > .fg header .x { background: ${CSS_INK}; color: ${CSS_PAPER}; border: var(--ob-u) solid ${CSS_PAPER}; font: var(--ob-f)/1 "Gambit 8bit"; padding: var(--ob-u) calc(var(--ob-u) * 2); }
.gs.onebit > .fg nav { padding: 0 calc(var(--ob-u) * 3) calc(var(--ob-u) * 3); gap: calc(var(--ob-u) * 3); }
.gs.onebit > .fg button, .gs.onebit > .fg select, .gs.onebit > .fg textarea { font: var(--ob-f)/1.4 "Gambit 8bit", monospace; border-radius: 0; }
.gs.onebit > .fg nav button, .gs.onebit > .fg button.plain, .gs.onebit > .fg select, .gs.onebit > .fg textarea { background: ${CSS_INK}; color: ${CSS_PAPER}; border: var(--ob-u) solid ${CSS_PAPER}; padding: var(--ob-u) calc(var(--ob-u) * 3); }
.gs.onebit > .fg nav button[aria-selected="true"], .gs.onebit > .fg button.go { background: ${CSS_PAPER}; color: ${CSS_INK}; border: var(--ob-u) solid ${CSS_PAPER}; padding: var(--ob-u) calc(var(--ob-u) * 3); }
.gs.onebit > .fg button:hover, .gs.onebit > .fg button:focus-visible { background: ${CSS_INK}; color: ${CSS_PAPER}; outline: var(--ob-u) solid ${CSS_PAPER}; outline-offset: var(--ob-u); }
.gs.onebit > .fg nav button[aria-selected="true"]:hover, .gs.onebit > .fg button.go:hover { background: ${CSS_INK}; color: ${CSS_PAPER}; }
.gs.onebit > .fg button:disabled { background: ${CSS_INK}; color: ${CSS_PAPER}; border-style: dashed; text-decoration: line-through; opacity: 1; }
.gs.onebit > .fg .body { padding: 0 calc(var(--ob-u) * 3) calc(var(--ob-u) * 3); scrollbar-color: ${CSS_PAPER} ${CSS_INK}; }
.gs.onebit > .fg .muted, .gs.onebit > .fg details summary { opacity: 1; }
.gs.onebit > .fg .muted { color: ${CSS_PAPER}; }
.gs.onebit > .fg .cls { border-radius: 0; border: var(--ob-u) dashed transparent; grid-template-columns: calc(var(--ob-u) * 20) 1fr auto; }
.gs.onebit > .fg .cls.on { border: var(--ob-u) solid ${CSS_PAPER}; background: ${CSS_INK}; }
.gs.onebit > .fg .pic, .gs.onebit > .fg .cls .pic, .gs.onebit > .fg .pending .pic { border-radius: 0; background-color: ${CSS_INK}; border: var(--ob-u) solid ${CSS_PAPER}; image-rendering: pixelated; width: calc(var(--ob-u) * 20); height: calc(var(--ob-u) * 20); }
.gs.onebit > .fg .tag { background: ${CSS_PAPER}; color: ${CSS_INK}; border-radius: 0; font-size: var(--ob-f); padding: 0 var(--ob-u); }
.gs.onebit > .fg .stars { color: ${CSS_PAPER}; }
.gs.onebit > .fg .bar { border-radius: 0; height: calc(var(--ob-u) * 4); width: calc(var(--ob-u) * 40); background: ${CSS_INK}; border: var(--ob-u) solid ${CSS_PAPER}; }
.gs.onebit > .fg .bar i { background: repeating-linear-gradient(90deg, ${CSS_PAPER} 0 calc(var(--ob-u) * 3), ${CSS_INK} calc(var(--ob-u) * 3) calc(var(--ob-u) * 4)); }
.gs.onebit > .fg .pending, .gs.onebit > .fg .opt { border-radius: 0; border: var(--ob-u) dashed ${CSS_PAPER}; background: ${CSS_INK}; }
.gs.onebit > .fg .pending .changes, .gs.onebit > .fg header b { color: ${CSS_PAPER}; }
.gs.onebit > .fg .sheet .sk, .gs.onebit > .fg .sheet .sk.sig { border-left: calc(var(--ob-u) * 2) solid ${CSS_PAPER}; }
.gs.onebit > .fg .sheet .sk .meta { opacity: 1; font-size: var(--ob-f); }
.gs.onebit > .fg .busyline { color: ${CSS_PAPER}; animation: obBlink 1s steps(1, end) infinite; }
.gs.onebit > .mw { background: repeating-conic-gradient(${CSS_PAPER} 0 25%, ${CSS_INK} 0 50%) 0 0 / calc(var(--ob-u) * 2) calc(var(--ob-u) * 2); animation: none; }
.gs.onebit .mw-in { background: ${CSS_INK}; padding: calc(var(--ob-u) * 8); border: var(--ob-u) solid ${CSS_PAPER}; gap: calc(var(--ob-u) * 5);
  box-shadow: inset 0 0 0 var(--ob-u) ${CSS_INK}, inset 0 0 0 calc(var(--ob-u) * 2) ${CSS_PAPER}, calc(var(--ob-u) * 5) calc(var(--ob-u) * 5) 0 0 ${CSS_INK}; }
.gs.onebit .mw-title { font: calc(var(--ob-f) * 2)/1 "Gambit 8bit", monospace; color: ${CSS_PAPER}; letter-spacing: 0; }
.gs.onebit .mw.waiting .mw-title { animation: obBlink 1s steps(1, end) infinite; }
.gs.onebit .mw-art { border: var(--ob-u) solid ${CSS_PAPER}; box-shadow: none; background-color: ${CSS_INK}; image-rendering: pixelated; }
.gs.onebit .mw-text { font: var(--ob-f)/1.7 "Gambit 8bit", monospace; color: ${CSS_PAPER}; }
.gs.onebit .mw-card, .gs.onebit .mw-list li, .gs.onebit .mw-art::before, .gs.onebit .mw-art.arrived::before { animation: none; }
.gs.onebit .mw-why, .gs.onebit .mw-change, .gs.onebit .mw-kicker, .gs.onebit .mw-list { font-size: 1em; font-weight: 400; letter-spacing: 0; text-transform: none; opacity: 1; line-height: inherit; }
.gs.onebit .mw-change::before { font-size: 1em; }
.gs.onebit .mw-dots i { transform: none; width: calc(var(--ob-u) * 3); height: calc(var(--ob-u) * 3); background: ${CSS_INK}; border: var(--ob-u) solid ${CSS_PAPER}; }
.gs.onebit .mw-dots i.on { background: ${CSS_PAPER}; }
.gs.onebit .mw-hint { font: var(--ob-f)/1 "Gambit 8bit", monospace; opacity: 1; letter-spacing: 0; }
@keyframes obBlink { 50% { visibility: hidden; } }
/* A phone's class panel: every control a thumb's height (the same test as isPhone). */
@media (max-width: 760px), (max-height: 480px) {
  .gs.onebit > .fg button { min-height: 44px; }
  .gs.onebit > .fg .cls { grid-template-columns: calc(var(--ob-u) * 20) minmax(0, 1fr) auto; overflow-wrap: anywhere; }
  .gs.onebit > .fg header .x { min-width: 44px; min-height: 44px; }
  .gs.onebit > .fg details summary { padding: 9px 0; }
  .gs.onebit > .fg .body { touch-action: pan-y; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
}
@media (prefers-reduced-motion: reduce) { .gs.onebit .mw.waiting .mw-title, .gs.onebit > .fg .busyline { animation: none; } }
`;

/* -------------------------------- Pixel art -------------------------------- */
const COIN = [" ###### ", "#......#", " ###### ", "#.#..#.#", " ###### ", "#......#", " ###### ", "        "];
const SCROLL = [" ###### ", "#.#....#", " #.###.#", " #.....#", " #.###.#", " #.....#", "#.####.#", " ###### "];
const GLASS = [
  ["#######", "#.....#", ".#####.", "..###..", "...#...", "..#.#..", ".#...#.", "#.....#", "#######"],
  ["#######", "#.....#", ".#...#.", "..#.#..", "...#...", "..###..", ".#####.", "#.....#", "#######"],
];
const SPIN = ["|", "/", "-", "\\"];
const FACING = ["N", "E", "S", "W"];

/* --------------------------------- Layout ---------------------------------- */
interface Layout {
  mode: "wide" | "std" | "tall";
  W: number;
  H: number;
  view: Rect;
  text: Rect;
  stat: Rect;
  aux: Rect;
  cmd: Rect;
  keys: Rect;
  journal: Rect;
  classes: Rect;
}

interface Hit {
  key: string;
  r: Rect;
  label: string;
  run: () => void;
  tab?: boolean;
  title?: string;
  wheel?: boolean;
}

const inner = (r: Rect): Rect => ({ x: r.x + 4, y: r.y + 14, w: r.w - 8, h: r.h - 17 });
const pad = (r: Rect, n: number): Rect => ({ x: r.x + n, y: r.y + n, w: r.w - 2 * n, h: r.h - 2 * n });

export const onebit: ThemeFactory = (ctx: ThemeCtx): ThemeRenderer => {
  const root = ctx.root;
  root.innerHTML = `<style>${CSS}</style><div class="ob"><div class="ob-scroll"><div class="ob-stage"><canvas class="ob-cv" aria-hidden="true"></canvas><div class="ob-hits"></div>${writeFormHtml("ob-say")}</div></div><div class="ob-world"></div><svg class="ob-hexsrc" aria-hidden="true"></svg><div class="ob-sr" role="region" aria-label="Scene"></div></div>`;
  const ob = root.querySelector(".ob") as HTMLDivElement;
  const scroller = root.querySelector(".ob-scroll") as HTMLDivElement;
  // A phone's page is taller than the screen, and its scrollbar is hidden: say so, and offer a thumb's way down.
  const cue = document.createElement("button");
  cue.type = "button";
  cue.className = "ob-cue";
  cue.hidden = true;
  cue.setAttribute("aria-label", "Scroll down for more");
  const thumb = document.createElement("div");
  thumb.className = "ob-thumb";
  thumb.hidden = true;
  root.querySelector(".ob")!.append(cue, thumb);
  cue.addEventListener("click", () => scroller.scrollBy({ top: Math.round(scroller.clientHeight * 0.7), behavior: ctx.reducedMotion ? "auto" : "smooth" }));
  const paintCue = () => {
    const sh = scroller.scrollHeight, ch = scroller.clientHeight, top = scroller.scrollTop;
    // A window over the page has its own controls in that corner, and the page stays put under it.
    const covered = ctx.journal.open || ctx.classes.open;
    scroller.style.overflowY = isPhone() && ctx.journal.open ? "hidden" : "";
    const over = isPhone() && !covered && sh > ch + 2;
    thumb.hidden = !over;
    cue.hidden = !over || top + ch >= sh - 4;
    if (!over) return;
    thumb.style.height = `${Math.max(24, Math.round((ch * ch) / sh))}px`;
    thumb.style.top = `${Math.round(((ch - Math.max(24, (ch * ch) / sh)) * top) / Math.max(1, sh - ch))}px`;
  };
  scroller.addEventListener("scroll", paintCue, { passive: true });
  const stage = root.querySelector(".ob-stage") as HTMLDivElement;
  const cv = root.querySelector(".ob-cv") as HTMLCanvasElement;
  const hitLayer = root.querySelector(".ob-hits") as HTMLDivElement;
  const sayForm = root.querySelector(".ob-say") as HTMLFormElement;
  const write = wireWrite(ctx, sayForm, { onChange: () => paint() });
  // The field's letters aren't where the painted ones are: put the caret under the painted one that was clicked.
  write.field.addEventListener("click", (e) => {
    const f = write.field;
    if (f.selectionStart !== f.selectionEnd) return;
    const at = (Math.floor(e.offsetY / u / 10) + promptFirst) * promptCols + Math.round(e.offsetX / u / 8);
    f.setSelectionRange(Math.min(at, f.value.length), Math.min(at, f.value.length));
    paint();
  });
  let promptCols = 40;
  let promptFirst = 0;
  /** Lines of the story scrolled back from its end; where the newest beat starts, to show a phone. */
  let chronBack = 0;
  let chronMax = 0;
  let newestBeatY = 0;
  let toNewestBeat = false;
  let seenStory = "";
  const hexSrc = root.querySelector(".ob-hexsrc") as SVGSVGElement;
  const sr = root.querySelector(".ob-sr") as HTMLDivElement;
  (root.querySelector(".ob-world") as HTMLDivElement).append(ctx.world);
  const g2 = cv.getContext("2d")!;
  const host = root.parentElement as HTMLElement | null;

  let font: BitFont | null = null;
  let dead = false;
  let view: SceneView | null = null;
  let fb = new Frame(1, 1);
  let L: Layout | null = null;
  let s = 3; // device pixels per virtual pixel
  let u = 3; // CSS pixels per virtual pixel
  let screenRows = 1;
  let time = 0;
  let hover: string | null = null;
  let focus: string | null = null;
  let flash: { key: string; t: number } | null = null;
  let themeMenu = false;
  let jScroll = 0;
  let jMax = 0;
  let cmdPage = 0;
  /** The prompt's cursor bar: the row it rests on when nothing is hovered or focused. */
  let cursor: string | null = null;
  let par = { x: 0, y: 0 };
  let lastPaint = -1;
  let hits: Hit[] = [];
  let hitSig = "";
  let hexHits: HexHit[] = [];
  let corridorFirst = true;
  const corridor = new Corridor();
  const buttons = new Map<string, HTMLElement>();

  void loadFont().then((f) => {
    font = f;
    if (!dead) paint();
  });

  /* ----------------------------- Async art cache ---------------------------- */
  const got = new Map<string, unknown>();
  const asked = new Set<string>();
  function want<T>(key: string, make: () => Promise<T>): T | null {
    if (got.has(key)) return got.get(key) as T;
    if (!asked.has(key)) {
      asked.add(key);
      make().then(
        (x) => {
          got.set(key, x);
          if (!dead) paint();
        },
        () => undefined,
      );
    }
    return null;
  }
  /** Chessboard distance from a figure, over its box grown by HALO on each side (capped at HALO + 1). */
  const HALO = 7;
  const halos = new WeakMap<Bits, Uint8Array>();
  function haloOf(b: Bits): Uint8Array {
    let d = halos.get(b);
    if (d) return d;
    const W = b.w + HALO * 2, H = b.h + HALO * 2, cap = HALO + 1;
    d = new Uint8Array(W * H).fill(cap);
    for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) if (b.mask[j * b.w + i]) d[(j + HALO) * W + i + HALO] = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = d[y * W + x]!;
      if (x > 0) v = Math.min(v, d[y * W + x - 1]! + 1);
      if (y > 0) {
        v = Math.min(v, d[(y - 1) * W + x]! + 1);
        if (x > 0) v = Math.min(v, d[(y - 1) * W + x - 1]! + 1);
        if (x < W - 1) v = Math.min(v, d[(y - 1) * W + x + 1]! + 1);
      }
      d[y * W + x] = v;
    }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
      let v = d[y * W + x]!;
      if (x < W - 1) v = Math.min(v, d[y * W + x + 1]! + 1);
      if (y < H - 1) {
        v = Math.min(v, d[(y + 1) * W + x]! + 1);
        if (x < W - 1) v = Math.min(v, d[(y + 1) * W + x + 1]! + 1);
        if (x > 0) v = Math.min(v, d[(y + 1) * W + x - 1]! + 1);
      }
      d[y * W + x] = v;
    }
    halos.set(b, d);
    return d;
  }

  /* --------------------------------- Sizing --------------------------------- */
  /** As Parley's .pl-phone: a phone's type stays at one size, however little screen is left. */
  function isPhone(): boolean {
    return root.clientWidth <= 760 || root.clientHeight <= 480;
  }
  function measure(): { W: number; rows: number; s: number; u: number } {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const wd = Math.max(200, root.clientWidth * dpr);
    const hd = Math.max(200, root.clientHeight * dpr);
    const sc = isPhone() ? Math.max(2, Math.round(2 * dpr)) : Math.max(2, Math.min(Math.floor(hd / 290), Math.floor(wd / 190)));
    return { W: Math.floor(wd / sc), rows: Math.floor(hd / sc), s: sc, u: sc / dpr };
  }

  function layout(v: SceneView): Layout {
    const m0 = measure();
    s = m0.s;
    u = m0.u;
    screenRows = m0.rows;
    const W = m0.W;
    let H = m0.rows;
    const aux: "map" | "hex" | null = v.delve ? "map" : v.hex ? "hex" : null;
    // A phone on its side is as short as a keyboard's leftovers: the page scrolls, as upright, in two columns.
    const land = isPhone() && W >= 330 && H < 240;
    const mode: Layout["mode"] = W < 330 || land ? "tall" : W / H >= 2.15 ? "wide" : "std";
    const statH = statusHeight(v);
    const none = { x: -999, y: -999, w: 0, h: 0 };
    const story = isWriting(v);
    if (mode === "wide") {
      const m = 6, g = 6;
      const keys = { x: m, y: H - m - 11, w: W - 2 * m, h: 11 };
      const ch = keys.y - g - m;
      // The viewport takes half the screen; the people stand in it (no separate roster).
      const colB = Math.max(176, Math.min(240, Math.round(W * 0.22)));
      const colC = Math.max(196, Math.min(250, Math.round(W * 0.25)));
      const aw = W - 2 * m - 2 * g - colB - colC;
      const xB = m + aw + g, xC = xB + colB + g;
      // Middle column: the chronicle (over the automap / honeycomb outside town).
      const hD = aux === "map" ? Math.round(ch * 0.68) : aux === "hex" ? Math.round(ch * (story ? 0.36 : 0.58)) : 0;
      const hB = aux ? ch - hD - g : ch;
      return {
        mode, W, H, keys,
        view: { x: m, y: m, w: aw, h: ch },
        text: { x: xB, y: m, w: colB, h: hB },
        aux: aux ? { x: xB, y: m + hB + g, w: colB, h: hD } : none,
        stat: { x: xC, y: m, w: colC, h: statH },
        cmd: { x: xC, y: m + statH + g, w: colC, h: ch - statH - g },
        journal: { x: m + 8, y: m, w: aw + colB - 2, h: ch },
        classes: { x: xB, y: m, w: colB + colC + g, h: ch },
      };
    }
    if (mode === "std") {
      const m = 6, g = 6;
      const keys = { x: m, y: H - m - 11, w: W - 2 * m, h: 11 };
      const ch = keys.y - g - m;
      const lw = Math.round((W - 2 * m - g) * 0.62);
      // With a map, the status sits under the viewport: leave it its full height.
      // A story needs the room to be read in, and the picture gives it up.
      const ah = aux ? Math.min(Math.round(ch * (story ? 0.5 : 0.68)), ch - statH - g) : Math.round(ch * (story ? 0.42 : canWrite(v) ? 0.62 : 0.68));
      const x = m + lw + g, rw = W - x - m;
      const by = m + ah + g, bh = ch - ah - g;
      if (!aux) {
        // Left: the viewport over the chronicle; right: status over the prompt.
        return {
          mode, W, H, keys,
          view: { x: m, y: m, w: lw, h: ah },
          text: { x: m, y: by, w: lw, h: bh },
          stat: { x, y: m, w: rw, h: statH },
          aux: none,
          cmd: { x, y: m + statH + g, w: rw, h: ch - statH - g },
          journal: { x: m, y: m, w: lw, h: ch },
          classes: { x: m + Math.round(lw * 0.38), y: m, w: W - 2 * m - Math.round(lw * 0.38), h: ch },
        };
      }
      // With a map: the viewport over the chronicle and status; right: the map over the prompt.
      const hD = Math.round(ch * 0.46);
      const sw = Math.max(124, Math.min(158, Math.round(lw * 0.42)));
      return {
        mode, W, H, keys,
        view: { x: m, y: m, w: lw, h: ah },
        text: { x: m, y: by, w: lw - sw - g, h: bh },
        stat: { x: m + lw - sw, y: by, w: sw, h: bh },
        aux: { x, y: m, w: rw, h: hD },
        cmd: { x, y: m + hD + g, w: rw, h: ch - hD - g },
        journal: { x: m, y: m, w: lw, h: ch },
        classes: { x: m + Math.round(lw * 0.38), y: m, w: W - 2 * m - Math.round(lw * 0.38), h: ch },
      };
    }
    // Tall (a phone): the frame grows and the page scrolls. One column; two on its side.
    const m = 2, g = 3;
    const lw = land ? Math.round((W - 2 * m - g) * 0.54) : W - 2 * m;
    const rx = land ? m + lw + g : m;
    const fw = land ? W - rx - m : lw;
    let y = m, yL = m;
    const take = (h: number): Rect => {
      const r = { x: rx, y, w: fw, h };
      y += h + g;
      return r;
    };
    const takeL = (h: number): Rect => {
      if (!land) return take(h);
      const r = { x: m, y: yL, w: lw, h };
      yL += h + g;
      return r;
    };
    // The picture gets what the words can spare; a delve's corridor is the game, so it stays large.
    const wantView = Math.round(lw * 0.7);
    const viewR = takeL(v.delve ? (land ? Math.min(wantView, H - 2 * m) : wantView) : Math.min(wantView, Math.round(screenRows * (land ? 0.55 : 0.3))));
    const chars = Math.floor((lw - 8) / 8);
    const b = ctx.box(v);
    const need = Math.min(story ? 120 : 30, wrap(b.desc, chars).length + 1 + b.log.slice(-4).reduce((n, l) => n + wrap(l, chars - 2).length, 0) + (b.busy ? 1 : 0) + (story ? storyLines(v, chars).length : 0));
    const prompt = canWrite(v) ? promptHeight(chars) : 0;
    // On its side the commands stand beside the words: a long story scrolls in its window, rather than run on alone below them.
    const lines = land ? Math.min(need, Math.max(8, Math.floor((screenRows - 19 - prompt) / 10))) : need;
    const textR = takeL(17 + Math.max(4, lines) * 10 + 2 + prompt);
    const items = ctx.menu(v);
    const rm = rowMin();
    const groups = items.filter((it, i) => i > 0 && items[i - 1]!.group !== it.group).length;
    const cmdH = 17 + 22 + items.reduce((n, it) => n + Math.max(rm, wrap(it.label, Math.floor((fw - 21) / 8) - 2).length * 9 + 4), 0) + groups * 3 + 6;
    const cmdR = take(cmdH);
    const auxR = aux ? take(aux === "map" ? 120 : 150) : none;
    const statR = take(statH);
    const keys = { x: rx, y, w: fw, h: rm };
    y += rm + m;
    H = Math.max(H, y, yL);
    const vis = { x: m, y: m, w: W - 2 * m, h: Math.min(H, screenRows) - 2 * m };
    return { mode, W, H, keys, view: viewR, text: textR, cmd: cmdR, aux: auxR, stat: statR, journal: vis, classes: vis };
  }

  /** The tallest a control may be short of on a phone: 44 CSS px, in rows. */
  const rowMin = () => Math.ceil(44 / u);

  function statusHeight(v: SceneView): number {
    const st = ctx.status(v);
    return 17 + 45 + 15 + 11 + (st.thread ? 11 : 0) + (st.supplies ? 14 : 0) + 3;
  }

  /* ---------------------------- Window chrome ----------------------------- */
  function win(r: Rect, title: string, opts: { close?: string; tag?: string } = {}): void {
    const f = font!;
    fb.fill({ x: r.x + 4, y: r.y + 4, w: r.w, h: r.h }, INK); // hard drop shadow on the desktop
    fb.fill(r, INK);
    fb.box(r, PAPER);
    fb.box(pad(r, 2), PAPER);
    for (const [cx, cy] of [[r.x, r.y], [r.x + r.w - 3, r.y], [r.x, r.y + r.h - 3], [r.x + r.w - 3, r.y + r.h - 3]] as const) fb.fill({ x: cx, y: cy, w: 3, h: 3 }, PAPER);
    // Title bar: pinstripes with the name knocked out of them.
    const tb = { x: r.x + 3, y: r.y + 3, w: r.w - 6, h: 9 };
    for (let y = tb.y + 1; y < tb.y + tb.h; y += 2) fb.hline(tb.x + 1, y, tb.w - 2, PAPER);
    fb.hline(tb.x, tb.y + tb.h, tb.w, PAPER);
    const maxc = Math.max(1, Math.floor((tb.w - 30) / 8));
    const t = clip(title.toUpperCase(), maxc);
    const tw = t.length * 8 + 8;
    const tx = tb.x + Math.floor((tb.w - tw) / 2);
    fb.fill({ x: tx, y: tb.y, w: tw, h: tb.h }, INK);
    fb.text(f, tx + 4, tb.y + 1, t, PAPER);
    if (opts.close) {
      const cb = { x: tb.x + 4, y: tb.y, w: 11, h: 9 };
      fb.fill(cb, INK);
      fb.box({ x: cb.x + 1, y: cb.y + 1, w: 9, h: 7 }, PAPER);
      if (opts.close === hover || opts.close === focus) fb.fill({ x: cb.x + 3, y: cb.y + 3, w: 5, h: 3 }, PAPER);
    }
    if (opts.tag) {
      const w = opts.tag.length * 8 + 6;
      const x = tb.x + tb.w - w - 4;
      fb.fill({ x: x - 1, y: tb.y, w: w + 2, h: tb.h }, INK);
      fb.fill({ x, y: tb.y, w, h: tb.h }, PAPER);
      fb.text(f, x + 3, tb.y + 1, opts.tag, INK);
    }
  }

  const clip = (t: string, n: number) => (t.length > n ? t.slice(0, Math.max(1, n - 1)) + "." : t);
  const lit = (key: string) => key === hover || key === focus;
  const flashing = (key: string) => !!flash && flash.key === key && time - flash.t < 0.14;

  /* ------------------------------- Viewport ------------------------------- */
  let lightKey = "";
  let light = new Float32Array(1);
  let ring = new Float32Array(1);
  function lightFor(w: number, h: number): void {
    const k = `${w}x${h}`;
    if (k === lightKey) return;
    lightKey = k;
    light = new Float32Array(w * h);
    ring = new Float32Array(w * h);
    const ss = (a: number, b: number, x: number) => {
      const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const nx = (x / w - 0.5) * 2, ny = (y / h - 0.4) * 2;
      const d = Math.sqrt(nx * nx * 0.85 + ny * ny);
      // A heavy vignette: the upper middle keeps its light, the rim falls to black
      // and the lower third (where people stand) sinks into shadow behind them.
      const vig = 1 - 0.92 * ss(0.42, 1.08, d);
      const floor = 1 - ss(0.56, 0.97, y / h);
      // Light from the upper left.
      const dir = 1.18 - 0.22 * (nx * 0.7 + ny * 0.5);
      light[y * w + x] = vig * floor * dir;
      ring[y * w + x] = ss(0.35, 0.75, d) * (1 - ss(0.95, 1.15, d));
    }
  }

  /**
  * A figure stamped into the view: a moat of solid ink 3 pixels wide round
  * the silhouette and a sparse dithered skirt beyond it, so a 1-bit figure
  * never melts into a 1-bit background. `dim` greys it with a checker mask;
  * `back` darkens it one dither step (standing further off); `ants` runs a
  * marching dotted line round the moat.
  */
  function figure(b: Bits, x: number, y: number, cr: Rect, o: { dim?: boolean; back?: boolean; ants?: boolean; rim?: boolean }): void {
    const d = haloOf(b);
    const W = b.w + HALO * 2;
    const march = Math.floor(time * 8);
    for (let j = -HALO; j < b.h + HALO; j++) {
      const py = y + j;
      if (py < cr.y || py >= cr.y + cr.h) continue;
      for (let i = -HALO; i < b.w + HALO; i++) {
        const px = x + i;
        if (px < cr.x || px >= cr.x + cr.w) continue;
        const dist = d[(j + HALO) * W + i + HALO]!;
        if (dist === 0) {
          let c = b.pix[j * b.w + i]!;
          if (c === PAPER && o.dim && (px + py) & 1) c = INK;
          else if (c === PAPER && o.back && BAYER8[(py & 7) * 8 + (px & 7)]! < 10) c = INK;
          fb.set(px, py, c);
        } else if (dist === 1 && o.rim !== false) {
          // A rim of light round the silhouette: solid on the side the light
          // comes from (upper left), dotted on the shadow side, so even a dark
          // coat on a dark ground keeps its shape.
          const ii = i + HALO, jj = j + HALO;
          const litSide = d[jj * W + ii + 1] === 0 || d[(jj + 1) * W + ii] === 0;
          fb.set(px, py, litSide || ((px + py) & 1) === 0 ? PAPER : INK);
        } else if (dist <= 4) {
          fb.set(px, py, o.ants && dist === 4 && ((px + py + march) & 3) < 2 ? PAPER : INK);
        } else if (dist <= HALO) {
          // The skirt: keep only the faintest of the background's light.
          const k = (py * fb.w + px);
          if (fb.pix[k] === PAPER && BAYER8[(py & 7) * 8 + (px & 7)]! > (dist - 4) * 14) fb.pix[k] = INK;
        }
      }
    }
  }

  /** The box round a picture's drawn pixels. */
  const bounds = new WeakMap<Bits, Rect>();
  function boundsOf(b: Bits): Rect {
    let r = bounds.get(b);
    if (r) return r;
    let x0 = b.w, y0 = b.h, x1 = -1, y1 = -1;
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (b.mask[y * b.w + x]) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    r = x1 < 0 ? { x: 0, y: 0, w: b.w, h: b.h } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    bounds.set(b, r);
    return r;
  }

  /** Targeting brackets: four 10-pixel corners, 2 thick, backed in ink so they read over any dither. */
  function brackets(r: Rect): void {
    const L = 10;
    const corners = [[r.x, r.y, 1, 1], [r.x + r.w - 2, r.y, -1, 1], [r.x, r.y + r.h - 2, 1, -1], [r.x + r.w - 2, r.y + r.h - 2, -1, -1]] as const;
    for (const pass of [INK, PAPER]) {
      const g = pass === INK ? 1 : 0;
      for (const [cx, cy, sx, sy] of corners) {
        fb.fill({ x: (sx > 0 ? cx : cx - L + 2) - g, y: cy - g, w: L + 2 * g, h: 2 + 2 * g }, pass);
        fb.fill({ x: cx - g, y: (sy > 0 ? cy : cy - L + 2) - g, w: 2 + 2 * g, h: L + 2 * g }, pass);
      }
    }
  }

  function paintView(v: SceneView, r: Rect): void {
    const st = ctx.status(v);
    const b = ctx.box(v);
    win(r, v.delve ? `${st.where} : ${FACING[v.delve.facing]}` : st.where, { tag: !v.delve && b.isNew ? "NEW!" : undefined });
    const cr = { x: r.x + 3, y: r.y + 13, w: r.w - 6, h: r.h - 16 };
    lightFor(cr.w, cr.h);
    const tq = Math.floor(time * 6) / 6;
    const flick = ctx.reducedMotion ? 0 : Math.sin(tq * 6) * 0.035 + Math.sin(tq * 17.3 + 1.3) * Math.sin(tq * 3.1) * 0.05;
    if (v.delve) {
      const d = v.delve;
      corridor.aim(d, corridorFirst || ctx.reducedMotion);
      corridorFirst = false;
      const wallUrl = ctx.art(d.textures.wall);
      corridor.setSkin(wallUrl, wallUrl ? want(`tex|${wallUrl}`, () => textureField(wallUrl, 64)) : null);
      const lum = corridor.render(cr.w, cr.h, d, time, 1 + flick * 1.5);
      torch(lum, cr.w, cr.h);
      fb.dither(cr, lum, cr.w, cr.h, 0, 0);
      // Turn / advance pads over the view (mouse and touch; the menu is the keyboard path).
      const third = Math.floor(cr.w / 3);
      const pads: [string, string, Rect][] = [["move:left", "Turn left", { x: cr.x, y: cr.y, w: third, h: cr.h }], ["move:forward", "Advance", { x: cr.x + third, y: cr.y, w: cr.w - 2 * third, h: cr.h }], ["move:right", "Turn right", { x: cr.x + cr.w - third, y: cr.y, w: third, h: cr.h }]];
      const menu = ctx.menu(v);
      for (const [key, label, pr] of pads) {
        const it = menu.find((m) => m.key === key);
        if (it) hits.push({ key: `pad:${key}`, r: pr, label, run: () => press(`pad:${key}`, it.run), tab: false });
      }
      const hv = hover?.startsWith("pad:") ? hover.slice(4) : null;
      if (hv && font) {
        const glyph = hv === "move:left" ? "◄" : hv === "move:right" ? "►" : "▲";
        const pr = pads.find((p) => p[0] === hv)![2];
        const gx = pr.x + Math.floor(pr.w / 2) - 8, gy = cr.y + cr.h - 26;
        fb.fill({ x: gx - 3, y: gy - 3, w: 22, h: 22 }, INK);
        fb.box({ x: gx - 2, y: gy - 2, w: 20, h: 20 }, PAPER);
        fb.text(font, gx, gy, glyph, PAPER, 2);
      }
      if (d.done && font) banner(cr, "VICTORIOUS");
    } else {
      const url = ctx.placeArt(v);
      const PX = 10, PY = 5;
      const fw = cr.w + PX * 2, fh = cr.h + PY * 2;
      const field = url ? want(`place|${url}|${fw}x${fh}`, () => placeField(url, fw, fh)) : null;
      const ox = PX + Math.round(-par.x * PX * 0.7), oy = PY + Math.round(-par.y * PY * 0.7);
      if (field) fb.dither(cr, field, fw, fh, ox, oy, light, ring, flick);
      else {
        const flatF = new Float32Array(cr.w * cr.h).fill(0.42);
        fb.dither(cr, flatF, cr.w, cr.h, 0, 0, light);
        if (font) banner(cr, url ? "DEVELOPING..." : "NO PICTURE");
      }
      // People in the room, each cut out of the scene by a moat of ink. The one
      // in the middle stands nearest; the others a step back, smaller and a
      // shade darker. Whole figures stand on the ground with a pool of shadow;
      // half figures rise out of the dark at the bottom of the view.
      // A crowd is drawn as its first few, plus whoever the prompt's cursor is on; the menu still lists everyone.
      const everyone = ctx.people(v);
      const menu = ctx.menu(v);
      let ppl = everyone.slice(0, MAX_FIGURES);
      const onCursor = menu.find((m) => m.key === cursor);
      const cursorWho = onCursor?.key.startsWith("talk:") ? (onCursor.target ?? onCursor.key.slice(5)) : null;
      const pulled = cursorWho && !ppl.some((p) => p.id === cursorWho) ? everyone.find((p) => p.id === cursorWho) : undefined;
      if (pulled) ppl = [...ppl.slice(0, MAX_FIGURES - 1), pulled];
      const baseH = Math.round(cr.h * (ppl.length > 3 ? 0.66 : 0.8));
      const n0 = ppl.length;
      const front = n0 === 2 ? 0 : Math.floor((n0 - 1) / 2);
      const standing = ppl
        .map((p, i) => {
          const a = ctx.personArt(v, p.id, "color");
          const h = i === front ? baseH : Math.round(baseH * 0.9);
          // Art keyed out of an opaque painting has rough edges, and opaque art
          // that could not be keyed has its own ground: draw the original as a
          // head-and-shoulders silhouette fading into the dark.
          if (a && (a.keyed || !a.cutout)) {
            const src = a.keyed && a.source ? a.source : a.url;
            return { p, bits: want(`bust|${src}|${Math.round(h * 0.82)}`, () => bustBits(src, Math.round(h * 0.82))), i, front: i === front, soft: true };
          }
          const bits = a?.cutout ? want(`body|${a.url}|${h}`, () => personBits(a.url, true, "body", h)) : null;
          return { p, bits, i, front: i === front, soft: false };
        })
        .filter((x): x is { p: (typeof ppl)[number]; bits: Bits; i: number; front: boolean; soft: boolean } => !!x.bits && (x.soft || x.bits.h / x.bits.w >= 1.1));
      const n = standing.length;
      const feet = cr.y + cr.h - Math.max(3, Math.round(cr.h * 0.05));
      // Who is singled out: the figure under the pointer or focus, else the prompt's cursor.
      const explicit = standing.find(({ p }) => lit(`fig:${p.id}`) || lit(`talk:${p.id}`))?.p.id ?? null;
      const curItem = menu.find((m) => m.key === cursor);
      const chosen = explicit ?? (curItem?.key.startsWith("talk:") ? curItem.target ?? curItem.key.slice(5) : null);
      const placed = standing.map((st) => {
        const { bits } = st;
        const slot = n === 1 ? 0.5 : n === 2 ? 0.3 + 0.4 * standing.indexOf(st) : 0.2 + (0.6 * standing.indexOf(st)) / (n - 1);
        const k = st.front ? 1 : 0.6;
        const cx = cr.x + Math.round(cr.w * slot) + Math.round(-par.x * 4 * k);
        const x = cx - (bits.w >> 1);
        const whole = !st.soft && bits.h / bits.w >= 2.2;
        const y = whole ? feet - bits.h : cr.y + cr.h + 2 - bits.h;
        return { ...st, cx, x, y, whole };
      });
      // Back to front.
      const order = [...placed].sort((a, b) => Number(a.front) - Number(b.front));
      for (const f of order) {
        const { p, bits, x, y, cx, whole } = f;
        if (whole) {
          const sw = Math.round(bits.w * 0.45), sh = 3;
          for (let j = -sh; j <= sh; j++) for (let k = -sw; k <= sw; k++) {
            if ((k * k) / (sw * sw) + (j * j) / (sh * sh) > 1) continue;
            const qx = cx + k, qy = feet + j - 1;
            if (qx >= cr.x && qx < cr.x + cr.w && qy < cr.y + cr.h && ((qx + qy) & 1 || Math.abs(k) < sw * 0.6)) fb.set(qx, qy, INK);
          }
        }
        const sel = p.id === chosen;
        figure(bits, x, y, cr, { dim: !!explicit && !sel, back: !f.front && !sel, ants: sel && !!explicit, rim: !f.soft });
        const top = Math.max(cr.y, y);
        if (p.talkable) hits.push({ key: `fig:${p.id}`, r: { x, y: top, w: bits.w, h: Math.min(y + bits.h, cr.y + cr.h) - top }, label: `Talk to ${p.name}`, run: () => press(`fig:${p.id}`, p.talk), tab: false, title: `${p.name}, ${p.role}` });
      }
      // The floor of the view sinks into pure black over everything, so the
      // people rise out of the dark instead of stopping at a line.
      const fade0 = Math.round(cr.h * 0.76);
      for (let j = fade0; j < cr.h; j++) {
        const t = (j - fade0) / Math.max(1, cr.h * 0.2);
        const f = Math.min(1, t * t * (3 - 2 * t)) * 64;
        const py = cr.y + j;
        for (let i = 0; i < cr.w; i++) {
          const px = cr.x + i;
          if (BAYER8[(py & 7) * 8 + (px & 7)]! < f) fb.pix[py * fb.w + px] = INK;
        }
      }
      // Name plates in the dark at the bottom, numbered as in the prompt;
      // targeting brackets round the one singled out, drawn last of all.
      const ty = cr.y + cr.h - 14;
      let sight: Rect | null = null;
      for (const f of placed) {
        const { p, bits, x, y } = f;
        const sel = p.id === chosen;
        const idx = menu.findIndex((m) => m.key === `talk:${p.id}`);
        const label = `${idx >= 0 && idx < 10 ? `${(idx + 1) % 10} ` : ""}${p.name.toUpperCase()}`;
        // A phone's small view draws small people: their names get their share of the width, not the figure's.
        const t = clip(label, Math.max(3, Math.floor((L!.mode === "tall" ? cr.w / Math.max(1, placed.length) - 8 : bits.w + 16) / 8)));
        const tw = t.length * 8 + 6 + (sel ? 10 : 0);
        const tx = Math.max(cr.x + 2, Math.min(cr.x + cr.w - tw - 2, f.cx - (tw >> 1)));
        fb.fill({ x: tx - 2, y: ty - 2, w: tw + 4, h: 14 }, INK);
        fb.fill({ x: tx, y: ty, w: tw, h: 10 }, sel ? INK : PAPER);
        if (sel) fb.box({ x: tx, y: ty, w: tw, h: 10 }, PAPER);
        let ix = tx + 3;
        if (sel) {
          if (blinkOn()) fb.text(font!, ix, ty + 1, "►", PAPER);
          ix += 10;
        }
        fb.text(font!, ix, ty + 1, t, sel ? PAPER : INK);
        if (sel) {
          const bb = boundsOf(bits);
          const left = Math.min(x + bb.x, tx) - 6, right = Math.max(x + bb.x + bb.w, tx + tw) + 6;
          const top = Math.max(cr.y + 3, y + bb.y - 6);
          sight = { x: Math.max(cr.x + 3, left), y: top, w: Math.min(cr.x + cr.w - 3, right) - Math.max(cr.x + 3, left), h: ty + 13 - top };
        }
      }
      if (sight) brackets(sight);
    }
    // Busy: the hourglass turns in the corner.
    if (b.busy) {
      const gx = r.x + 6, gy = r.y + 16;
      fb.fill({ x: gx - 2, y: gy - 2, w: 11, h: 13 }, INK);
      fb.sprite(gx, gy, GLASS[Math.floor(time * 2) % 2]!);
    }
  }

  /**
   * The torch you carry, raised at the lower right of the delve view: a dark
   * haft, a bound head and a living flame, painted as light into the corridor
   * before it is dithered, so it shares the view's pixels.
   */
  function torch(lum: Float32Array, w: number, h: number): void {
    const t = ctx.reducedMotion ? 0 : time;
    const sway = Math.round(-par.x * 6), lift = Math.round(-par.y * 4 + Math.sin(t * 1.7) * 1.5);
    const S = h / 165; // proportions follow the view
    const bx = Math.round(w * 0.95) + sway, by = h + 8;
    const tx = Math.round(w * 0.82) + sway, ty = Math.round(h * 0.66) + lift;
    const put = (x: number, y: number, l: number) => {
      if (x >= 0 && y >= 0 && x < w && y < h) lum[y * w + x] = l;
    };
    // Haft: a tapered dark stick, the edge toward the flame catching its light.
    for (let y = ty + Math.round(8 * S); y < by; y++) {
      const k = (y - ty) / (by - ty);
      const cx = Math.round(tx + (bx - tx) * k);
      const half = Math.round((4 + k * 6) * S);
      for (let x = cx - half - 2; x <= cx + half + 2; x++) {
        if (x < cx - half || x > cx + half) { put(x, y, 0); continue; }
        // Round wood: lit on the side facing the flame, falling to black.
        const a = 1 - (x - (cx - half)) / (2 * half + 1);
        put(x, y, (a * a * 0.9 + ((x * 3 + y) % 9 === 0 ? 0.15 : 0)) * (1 - k * 0.55));
      }
    }
    // Head: rag bound with cord, lit from above.
    const hw = Math.round(8 * S), hh = Math.round(12 * S);
    for (let y = ty - 2; y < ty + hh; y++) for (let x = tx - hw - 1; x <= tx + hw + 1; x++) {
      const out = x < tx - hw || x > tx + hw;
      put(x, y, out ? 0 : (y - ty) % 4 === 0 ? 0.03 : (x + y * 2) % 5 === 0 ? 0.95 : 0.5 - (y - ty) / hh * 0.3);
    }
    // Flame: a teardrop that leans and licks, hottest at its heart.
    const fh = Math.round(52 * S), fw = 13 * S;
    for (let j = -2; j < fh + 2; j++) {
      const dy = Math.max(0, j) / fh;
      // Tongues: the outline ripples as it rises.
      const half = fw * Math.pow(1 - dy, 0.8) * Math.min(1, (dy + 0.1) / 0.25) * (1 + 0.18 * Math.sin(dy * 14 - t * 9));
      const lean = Math.sin(t * 7.3 + dy * 4) * 4 * S * dy + Math.sin(t * 13.1) * 1.5 * S * dy;
      for (let i = -Math.ceil(fw * 1.4 + 6 * S); i <= Math.ceil(fw * 1.4 + 6 * S); i++) {
        const r = Math.abs(i - lean) / Math.max(0.5, half);
        if (r > 1.25 || j >= fh) { if (r <= 1.25) put(tx + i, ty - 2 - j, 0); continue; }
        if (r > 1) { put(tx + i, ty - 2 - j, 0); continue; } // a dark rim so the flame reads against lit stone
        const n = Math.sin(i * 1.3 + j * 0.7 + t * 11) * 0.1;
        // White-hot core, a dithered body, sparse tips.
        put(tx + i, ty - 2 - j, Math.max(0, 1.25 - r * 0.85 - dy * 0.7 + n));
      }
    }
  }

  function banner(cr: Rect, text: string): void {
    const w = text.length * 8 + 12;
    const x = cr.x + Math.floor((cr.w - w) / 2), y = cr.y + Math.floor(cr.h * 0.42);
    fb.fill({ x, y, w, h: 14 }, INK);
    fb.box({ x: x + 1, y: y + 1, w: w - 2, h: 12 }, PAPER);
    fb.text(font!, x + 6, y + 3, text, PAPER);
  }

  /* ------------------------------- Chronicle ------------------------------ */
  function paintText(v: SceneView, r: Rect): void {
    const f = font!;
    win(r, "Chronicle");
    const whole = inner(r);
    const chars = Math.floor(whole.w / 8);
    const pH = canWrite(v) ? promptHeight(chars) : 0;
    const cr = { ...whole, h: whole.h - pH };
    if (pH) paintPrompt(v, { ...whole, y: whole.y + whole.h - pH, h: pH }, chars);
    if (isWriting(v)) return paintStory(v, cr, chars);
    const avail = Math.floor((cr.h + 2) / 10);
    const b = ctx.box(v);
    const desc = wrap(b.desc, chars);
    const entries = b.log.map((l, i, all) => ({ lines: wrap(l, chars - 2), newest: i === all.length - 1 }));
    const busy = b.busy ? 1 : 0;
    const count = () => desc.length + (entries.length ? 1 : 0) + entries.reduce((n, e) => n + e.lines.length, 0) + busy;
    while (count() > avail && entries.length > 1) entries.shift();
    while (count() > avail && desc.length > 1) {
      desc.pop();
      desc[desc.length - 1] = clip(desc[desc.length - 1]! + "...", chars);
    }
    let y = cr.y;
    for (const l of desc) {
      fb.text(f, cr.x, y, l, PAPER);
      y += 10;
    }
    if (entries.length) {
      fb.hline(cr.x, y + 3, cr.w, PAPER, 2);
      y += 10;
    }
    for (const e of entries) {
      e.lines.forEach((l, i) => {
        if (y + 8 > cr.y + cr.h) return;
        if (i === 0) fb.text(f, cr.x, y, e.newest ? "►" : ">", PAPER);
        fb.text(f, cr.x + 16, y, l, PAPER);
        y += 10;
      });
    }
    if (b.busy && y + 8 <= cr.y + cr.h) {
      const t = clip(`${b.busy}`, chars - 3);
      fb.fill({ x: cr.x - 1, y: y - 1, w: t.length * 8 + 26, h: 10 }, PAPER);
      fb.text(f, cr.x, y, SPIN[Math.floor(time * 8) % 4]!, INK);
      fb.text(f, cr.x + 16, y, t, INK);
      if (Math.floor(time * 2) % 2 === 0) fb.fill({ x: cr.x + 16 + t.length * 8 + 1, y, w: 7, h: 8 }, INK);
    }
  }

  /** The story as lines of type. The one thing a line needs to be told apart: what kind of line it is. */
  function storyLines(v: SceneView, chars: number): { t: string; k: "said" | "roll" | "found" | "told" | "gap"; first?: boolean }[] {
    const out: ReturnType<typeof storyLines> = [];
    const add = (text: string, k: "said" | "roll" | "found" | "told", cols: number) => {
      for (const t of wrap(plain(text), cols)) out.push({ t, k });
    };
    for (const x of v.story) {
      out.push({ t: "", k: "gap", first: true });
      if (x.said) {
        add(x.said, "said", chars - 1);
        if (x.roll) add(x.roll, "roll", chars - 1);
      }
      if (x.found) add(x.found, "found", chars - 2);
      for (const p of x.reply.split(/\n+/).filter(Boolean)) add(p, "told", chars);
      if (!x.said && x.roll) add(x.roll, "roll", chars - 1);
    }
    return out;
  }

  function paintStory(v: SceneView, cr: Rect, chars: number): void {
    const f = font!;
    const b = ctx.box(v);
    const lines: { t: string; k: string; first?: boolean }[] = wrap(plain(b.desc), chars).map((t) => ({ t, k: "told" }));
    const newest = b.log[b.log.length - 1];
    if (newest) for (const [i, t] of wrap(plain(newest), chars - 2).entries()) lines.push({ t, k: i ? "log" : "log0" });
    lines.push(...storyLines(v, chars));
    if (b.busy) lines.push({ t: clip(b.busy, chars - 3), k: "busy" });
    const avail = Math.max(1, Math.floor((cr.h + 2) / 10));
    chronMax = Math.max(0, lines.length - avail);
    chronBack = Math.max(0, Math.min(chronMax, chronBack));
    const start = chronMax - chronBack;
    lines.forEach((l, i) => {
      if (l.first) newestBeatY = cr.y + (i - start) * 10;
    });
    for (const [i, l] of lines.slice(start, start + avail).entries()) {
      const y = cr.y + i * 10;
      if (l.k === "said") {
        fb.fill({ x: cr.x, y: y - 1, w: 2, h: 10 }, PAPER);
        fb.text(f, cr.x + 6, y, l.t, PAPER);
      } else if (l.k === "roll") {
        fb.fill({ x: cr.x - 1, y: y - 1, w: l.t.length * 8 + 3, h: 10 }, PAPER);
        fb.text(f, cr.x, y, l.t, INK);
      } else if (l.k === "found") {
        fb.text(f, cr.x, y, "*", PAPER);
        fb.text(f, cr.x + 12, y, l.t, PAPER);
      } else if (l.k === "log0" || l.k === "log") {
        if (l.k === "log0") fb.text(f, cr.x, y, ">", PAPER);
        fb.text(f, cr.x + 16, y, l.t, PAPER);
      } else if (l.k === "busy") {
        fb.fill({ x: cr.x - 1, y: y - 1, w: l.t.length * 8 + 26, h: 10 }, PAPER);
        fb.text(f, cr.x, y, SPIN[Math.floor(time * 8) % 4]!, INK);
        fb.text(f, cr.x + 16, y, l.t, INK);
      } else if (l.t) fb.text(f, cr.x, y, l.t, PAPER);
    }
    if (chronMax) {
      // There's more than the window holds: a thumb in the margin, and the wheel (or Page Up / Down) to move it.
      const th = Math.max(6, Math.round((avail / lines.length) * cr.h));
      const ty = cr.y + Math.round((start / chronMax) * (cr.h - th));
      fb.fill({ x: cr.x + cr.w + 1, y: ty, w: 2, h: th }, PAPER);
      hits.push({ key: "chron:body", r: cr, label: "The story so far", run: () => undefined, tab: false, wheel: true });
    }
  }

  /** How many columns a typed line runs to: a "> " before it and the WRITE key after. */
  const colsFor = (chars: number) => Math.max(8, chars - 2 - 7);
  function promptHeight(chars: number): number {
    const rows = Math.min(3, Math.floor(write.field.value.length / colsFor(chars)) + 1);
    return Math.max(L?.mode === "tall" || isPhone() ? rowMin() : 0, rows * 10) + 5;
  }

  /** The line you're writing, painted: the field over it is invisible. */
  function paintPrompt(v: SceneView, r: Rect, chars: number): void {
    const f = font!;
    const field = write.field;
    const top = r.y + 4;
    const rowsH = r.h - 5;
    fb.hline(r.x - 1, r.y + 1, r.w + 2, PAPER);
    fb.text(f, r.x, top + 1, ">", PAPER);
    const textX = r.x + 11;
    const cols = colsFor(chars);
    const value = field.value;
    const typing = (root.getRootNode() as Document | ShadowRoot).activeElement === field;
    const rows = Math.max(1, Math.floor(rowsH / 10));
    const caret = field.selectionEnd ?? value.length;
    const first = Math.max(0, Math.floor(caret / cols) - rows + 1);
    promptCols = cols;
    promptFirst = first;
    if (!value && !typing) fb.text(f, textX, top + 1, "WHAT DO YOU DO?", PAPER);
    for (let row = 0; row < rows; row++) {
      const from = (first + row) * cols;
      if (from >= value.length && from !== 0) break;
      const shown = value.slice(from, from + cols).replace(/\s/g, " ");
      fb.text(f, textX, top + 1 + row * 10, [...shown].map((c) => plain(c)[0] ?? " ").join(""), PAPER);
    }
    if (typing) {
      // Inverse video for the selection, or a blinking block for the caret.
      const a = field.selectionStart ?? caret;
      const on = a !== caret || ctx.reducedMotion || time % 1 < 0.65;
      if (on) {
        for (let i = a; i <= Math.max(a, caret - (a !== caret ? 1 : 0)); i++) {
          const cy = Math.floor(i / cols) - first;
          if (cy < 0 || cy >= rows) continue;
          const cell = { x: textX + (i % cols) * 8 - 1, y: top + cy * 10, w: 9, h: 10 };
          fb.fill(cell, PAPER);
          const ch = value[i];
          if (ch && ch.trim()) fb.text(f, cell.x + 1, cell.y + 1, plain(ch)[0] ?? " ", INK);
        }
      }
    }
    // The key to send it, inverse video once there's something to send.
    const bw = 44;
    const key = { x: r.x + r.w - bw, y: top, w: bw, h: Math.min(rowsH, 10 + (rowsH > 20 ? rowsH - 10 : 0)) };
    if (value.trim() || lit("say:send")) fb.fill(key, PAPER);
    else fb.box(key, PAPER);
    fb.text(f, key.x + 2, key.y + Math.floor((key.h - 8) / 2), "WRITE", value.trim() || lit("say:send") ? INK : PAPER);
    hits.push({ key: "say:send", r: key, label: "Write it", run: () => write.send() });
    if (ctx.box(v).busy) fb.stipple({ x: r.x - 1, y: top, w: r.w + 2, h: rowsH });
    Object.assign(sayForm.style, { left: `${textX * u}px`, top: `${top * u}px`, width: `${(key.x - textX - 2) * u}px`, height: `${rowsH * u}px` });
  }

  /* -------------------------------- Status -------------------------------- */
  /** The time of day as a little 1-bit picture (40 x 40). */
  function dial(x: number, y: number, tod: string): void {
    const S = 40;
    fb.fill({ x, y, w: S, h: S }, INK);
    const inside = (px: number, py: number) => px > x && py > y && px < x + S - 1 && py < y + S - 1;
    const set = (px: number, py: number, c: number) => {
      if (inside(x + px, y + py)) fb.set(x + px, y + py, c);
    };
    const disc = (cx: number, cy: number, rr: number, c: number, below = 99) => {
      for (let j = -rr; j <= rr; j++) for (let i = -rr; i <= rr; i++) if (i * i + j * j <= rr * rr + rr * 0.6 && cy + j <= below) set(cx + i, cy + j, c);
    };
    const rays = (cx: number, cy: number, r0: number, r1: number, n: number, from = 0, to = Math.PI * 2) => {
      for (let k = 0; k < n; k++) {
        const a = from + ((to - from) * (k + 0.5)) / n;
        fb.line(x + cx + Math.round(Math.cos(a) * r0), y + cy + Math.round(Math.sin(a) * r0), x + cx + Math.round(Math.cos(a) * r1), y + cy + Math.round(Math.sin(a) * r1), PAPER);
      }
    };
    const stars = (pts: number[][]) => pts.forEach(([sx, sy]) => set(sx!, sy!, PAPER));
    const band = (y0: number, y1: number, l0: number, l1: number) => {
      for (let j = y0; j < y1; j++) for (let i = 1; i < S - 1; i++) {
        const l = l0 + ((l1 - l0) * (j - y0)) / Math.max(1, y1 - y0);
        if (l > (BAYER8[((y + j) & 7) * 8 + ((x + i) & 7)]! + 0.5) / 64) set(i, j, PAPER);
      }
    };
    if (tod === "morning") {
      // The sun coming up out of the sea, its road of light on the water.
      band(14, 27, 0, 0.3);
      disc(20, 27, 9, PAPER, 26);
      rays(20, 27, 12, 16, 7, Math.PI * 1.08, Math.PI * 1.92);
      fb.hline(x + 1, y + 27, S - 2, PAPER);
      [[29, 12], [31, 9], [33, 7], [35, 5], [37, 3]].forEach(([yy, hw], k) => {
        fb.hline(x + 20 - hw!, y + yy!, hw! * 2 + 1, PAPER, k ? 2 : 0);
        fb.hline(x + 3 + k * 2, y + yy!, 4, PAPER, 1);
        fb.hline(x + S - 9 - k, y + yy!, 4, PAPER, 1);
      });
    } else if (tod === "afternoon") {
      // High sun, blazing, over a bright dithered field.
      disc(20, 14, 7, PAPER);
      rays(20, 14, 10, 15, 12);
      fb.hline(x + 1, y + 30, S - 2, PAPER);
      band(31, S - 1, 0.55, 0.15);
    } else if (tod === "evening") {
      // A crescent over the last light on the horizon.
      band(20, 31, 0, 0.45);
      disc(25, 12, 8, PAPER);
      disc(29, 9, 7, INK);
      stars([[6, 5], [12, 9], [5, 15], [34, 22], [16, 4], [9, 20]]);
      fb.fill({ x: x + 1, y: y + 31, w: S - 2, h: S - 32 }, INK);
      fb.hline(x + 1, y + 31, S - 2, PAPER);
      for (let i = 2; i < S - 2; i += 4) set(i, 34 + ((i >> 2) & 1) * 2, PAPER);
    } else {
      // Night: a lantern hung on its hook, its glow ringing out into the dark.
      stars([[4, 4], [33, 6], [7, 28], [35, 30], [30, 16], [5, 17], [24, 3]]);
      for (let j = 6; j < S - 2; j++) for (let i = 2; i < S - 2; i++) {
        const dd = Math.hypot(i - 20, j - 22);
        if (dd > 7 && dd < 16 && 0.5 * (1 - (dd - 7) / 9) > (BAYER8[((y + j) & 7) * 8 + ((x + i) & 7)]! + 0.5) / 64) set(i, j, PAPER);
      }
      fb.vline(x + 20, y + 2, 7, PAPER);
      fb.box({ x: x + 17, y: y + 8, w: 7, h: 3 }, PAPER);
      fb.fill({ x: x + 14, y: y + 11, w: 13, h: 2 }, PAPER);
      fb.box({ x: x + 15, y: y + 13, w: 11, h: 15 }, PAPER);
      fb.fill({ x: x + 17, y: y + 15, w: 7, h: 11 }, PAPER);
      fb.vline(x + 20, y + 15, 11, INK);
      fb.fill({ x: x + 19, y: y + 18, w: 3, h: 5 }, INK);
      fb.set(x + 20, y + 19, PAPER);
      fb.fill({ x: x + 14, y: y + 28, w: 13, h: 2 }, PAPER);
    }
    fb.box({ x, y, w: S, h: S }, PAPER);
  }

  const HEART = [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."];
  const CRATE = ["#######", "##...##", "#.#.#.#", "#..#..#", "#.#.#.#", "#######"];
  /**
   * A gauge of chunky pips (hearts, crates), each 7 wide, filled, half or
   * hollow, with the figure set clear of them at the right.
   */
  function pips(x: number, y: number, w: number, frac: number, n: number, art: string[], text: string): void {
    const f = font!;
    const tw = text.length * 8;
    fb.text(f, x + w - tw, y + 1, text, PAPER);
    const room = w - tw - 6;
    const pitch = Math.min(9, Math.floor(room / n));
    const full = Math.round(Math.max(0, Math.min(1, frac)) * n * 2) / 2;
    for (let i = 0; i < n; i++) {
      const px = x + i * pitch;
      const state = i + 1 <= full ? 2 : i + 0.5 <= full ? 1 : 0;
      if (pitch >= 8) {
        for (let r = 0; r < art.length; r++) for (let c = 0; c < 7; c++) {
          if (art[r]![c] !== "#") continue;
          // Hollow: the outline only; half: the left side filled.
          const edge = r === 0 || r === art.length - 1 || c === 0 || c === 6 || art[r - 1]?.[c] !== "#" || art[r + 1]?.[c] !== "#" || art[r]![c - 1] !== "#" || art[r]![c + 1] !== "#";
          const on = state === 2 || (state === 1 && c <= 3) || edge;
          if (on) fb.set(px + c, y + 1 + r, PAPER);
        }
      } else {
        const bw = Math.max(2, pitch - 1);
        if (state === 2) fb.fill({ x: px, y: y + 1, w: bw, h: 6 }, PAPER);
        else if (state === 1) fb.tone({ x: px, y: y + 1, w: bw, h: 6 }, 0.5);
        else fb.box({ x: px, y: y + 1, w: bw, h: 6 }, PAPER);
      }
    }
  }

  function paintStatus(v: SceneView, r: Rect): void {
    const f = font!;
    const st = ctx.status(v);
    win(r, "Status");
    const cr = inner(r);
    const x = cr.x, w = cr.w;
    let y = cr.y + 1;
    dial(x, y, st.time);
    const big = w >= 46 + 6 * 16 ? 2 : 1;
    fb.text(f, x + 46, y + 4, `DAY ${String(st.day).padStart(2, "0")}`, PAPER, big);
    fb.text(f, x + 46, y + 8 + 8 * big, st.time.toUpperCase(), PAPER);
    if (big === 2) fb.hline(x + 46, y + 32, Math.min(w - 46, 96), PAPER, 1);
    y += 44;
    fb.text(f, x, y + 1, "VIG", PAPER);
    pips(x + 28, y, w - 28, st.vigor, 10, HEART, `${Math.round(st.vigor * 100)}%`);
    y += 14;
    const leader = (yy: number, icon: readonly string[], label: string, value: string, key?: string, upto?: number) => {
      const on = key ? lit(key) : false;
      if (on) fb.fill({ x: x - 2, y: yy - 1, w: w + 4, h: 10 }, PAPER);
      fb.sprite(x, yy, icon);
      if (on) fb.invert({ x, y: yy, w: 8, h: 8 });
      const c = on ? INK : PAPER;
      fb.text(f, x + 12, yy, label, c);
      const vx = x + w - value.length * 8;
      fb.text(f, vx, yy, value, c);
      if (upto === undefined) for (let dx = x + 14 + label.length * 8; dx < vx - 3; dx += 3) fb.set(dx, yy + 6, c);
      return c;
    };
    const cur = clip(st.currency.toUpperCase(), Math.max(3, Math.floor((w - 70) / 8)));
    leader(y, COIN, cur, String(st.coin).padStart(5, "0"));
    y += 11;
    if (st.thread) {
      const th = st.thread;
      const found = th.found.length;
      // The thread as beads on a string: one per revelation, filled when found.
      const x0 = x + 14 + 6 * 8 + 4;
      const value = `${found}/${th.total}`;
      const vx = x + w - value.length * 8;
      const pitch = th.total > 0 ? Math.floor((vx - 6 - x0) / th.total) : 0;
      const beads = th.total > 0 && th.total <= 12 && pitch >= 8;
      const c = leader(y, SCROLL, "THREAD", value, "thread", beads ? vx : undefined);
      if (beads) {
        const sp = Math.min(14, pitch);
        for (let i = 0; i < th.total; i++) {
          const bx = x0 + i * sp;
          if (i > 0) fb.hline(bx - sp + 7, y + 3, sp - 8, c, 1);
          if (i < found) fb.fill({ x: bx, y: y + 1, w: 6, h: 6 }, c);
          else fb.box({ x: bx, y: y + 1, w: 6, h: 6 }, c);
        }
      }
      hits.push({ key: "thread", r: L!.mode === "tall" ? { x: x - 2, y: y - 7, w: w + 4, h: rowMin() } : { x: x - 2, y: y - 1, w: w + 4, h: 10 }, label: `Thread ${found} of ${th.total}: ${th.goal}. Open the journal`, title: th.goal, run: () => press("thread", () => !ctx.journal.open && ctx.journal.toggle()) });
      y += 11;
    }
    if (st.supplies) {
      y += 2;
      fb.text(f, x, y + 1, "SUP", PAPER);
      const mx = Math.max(1, st.supplies.max);
      pips(x + 28, y, w - 28, st.supplies.now / mx, Math.min(10, mx), CRATE, `${st.supplies.now}/${st.supplies.max}`);
    }
  }

  /* ------------------------------ Aux window ------------------------------ */
  function paintMap(v: SceneView, r: Rect): void {
    const f = font!;
    const d = v.delve!;
    win(r, "Automap");
    const cr = inner(r);
    const mr = { x: cr.x, y: cr.y, w: cr.w, h: cr.h - 11 };
    drawAutomap(fb, mr, d, blinkOn());
    fb.hline(cr.x, cr.y + cr.h - 11, cr.w, PAPER);
    fb.text(f, cr.x, cr.y + cr.h - 8, `KEYS ${d.keys}`, PAPER);
    const comp = `${FACING[d.facing]}▲`;
    fb.text(f, cr.x + cr.w - comp.length * 8, cr.y + cr.h - 8, comp, PAPER);
  }

  function paintHex(v: SceneView, r: Rect): void {
    const f = font!;
    win(r, "Overland");
    const cr = inner(r);
    const mr = { x: cr.x, y: cr.y, w: cr.w, h: cr.h - 11 };
    hexHits = drawHexMap(fb, mr, hexSrc, hover?.startsWith("hex") ? hover : focus?.startsWith("hex") ? focus : null, blinkOn());
    fb.hline(cr.x, cr.y + cr.h - 11, cr.w, PAPER);
    const sel = hexHits.find((h) => lit(h.key));
    const here = hexHits.find((h) => h.here);
    const label = sel ? `► ${sel.label}` : here ? `■ ${here.label}` : "";
    fb.text(f, cr.x, cr.y + cr.h - 8, clip(label.toUpperCase(), Math.floor(cr.w / 8)), PAPER);
    for (const h of hexHits) {
      if (h.here) continue;
      const el = h.el;
      hits.push({ key: h.key, r: h.rect, label: h.label, run: () => press(h.key, () => el.dispatchEvent(new MouseEvent("click", { bubbles: true }))) });
    }
  }

  /* ------------------------------ WHAT NOW? ------------------------------- */
  const HINT: Record<string, string> = { "move:forward": "W", "move:left": "A", "move:right": "D", "move:back": "S", "move:search": "F" };
  function paintCmd(v: SceneView, r: Rect): void {
    const f = font!;
    const busy = !!ctx.box(v).busy;
    win(r, v.delve ? "Delve" : "Command");
    const cr = inner(r);
    const head = v.delve ? "WHICH WAY?" : "WHAT NOW?";
    const phone = L!.mode === "tall";
    const big = !phone && head.length * 16 + 14 <= cr.w ? 2 : 1;
    const minRow = phone ? rowMin() : 0;
    const items = ctx.menu(v);
    if (!cursor || !items.some((m) => m.key === cursor)) cursor = items[0]?.key ?? null;
    const cmdLit = items.some((m) => lit(m.key) || lit(`pad:${m.key}`) || lit(`fig:${m.target ?? ""}`));
    const chars = Math.floor((cr.w - 12) / 8);
    type Row = { it: MenuItem; i: number; lines: string[]; sep: boolean };
    const rows: Row[] = items.map((it, i) => {
      const num = i < 10 ? `${(i + 1) % 10} ` : "  ";
      const hint = HINT[it.key];
      const lab = it.label.toUpperCase();
      const lines = wrap(num + lab, chars - (hint ? 2 : 0)).map((l, j) => (j ? "  " + l : l));
      return { it, i, lines, sep: i > 0 && items[i - 1]!.group !== it.group };
    });
    // Groups part by air, not rules; the prompt gets as much headroom as the list leaves.
    let rg = 2;
    const rowH = (row: Row) => Math.max(minRow, row.lines.length * 9 + rg);
    const sum = (gap: number) => rows.reduce((n, row) => n + rowH(row) + (row.sep ? gap : 0), 0);
    const head0 = (pd: number[]) => pd[0]! + 8 * big + pd[1]! + pd[2]!;
    const PADS = [[5, 6, 6], [3, 5, 5], [2, 4, 4], [1, 3, 3]];
    let pads = PADS.find((pd) => sum(1) <= cr.h - head0(pd));
    if (!pads) {
      rg = 1;
      pads = PADS.find((pd) => sum(1) <= cr.h - head0(pd)) ?? PADS[3]!;
    }
    const hy = cr.y + pads[0]!;
    const top = hy + 8 * big + pads[1]!;
    const y0 = top + pads[2]!;
    const room = cr.y + cr.h - y0;
    const sepGap = [7, 5, 3, 1].find((gap) => sum(gap) <= room) ?? 3;
    const hw = fb.text(f, cr.x + 1, hy, head, PAPER, big);
    const cur = { x: cr.x + 1 + hw + 3, y: hy, w: 5 * big + 2, h: 8 * big - 1 };
    if (ctx.reducedMotion || busy || time % 1 < 0.65) fb.fill(cur, PAPER);
    fb.hline(cr.x - 1, top, cr.w + 2, PAPER);
    fb.hline(cr.x - 1, top + 2, cr.w + 2, PAPER, 1);
    const base = (row: Row) => rowH(row) + (row.sep ? sepGap : 0);
    // Pages, if the list cannot fit (a "MORE" row turns them).
    const pages: Row[][] = [[]];
    let used = 0;
    const fits = rows.reduce((n, row) => n + base(row), 0) <= room;
    for (const row of rows) {
      const h = base(row);
      if (!fits && used + h > room - 11 && pages[pages.length - 1]!.length) {
        pages.push([]);
        used = 0;
      }
      pages[pages.length - 1]!.push(row);
      used += h;
    }
    if (cmdPage >= pages.length) cmdPage = 0;
    const page = pages[cmdPage]!;
    const need = page.reduce((n, row) => n + base(row), 0);
    // Spare room becomes dramatic spacing between the rows.
    const extra = pages.length > 1 ? 0 : Math.max(0, Math.min(6, Math.floor((room - need) / Math.max(1, page.length))));
    let y = y0;
    for (const row of page) {
      if (row.sep && row !== page[0]) y += sepGap;
      const h = rowH(row) + extra;
      const rr = { x: cr.x - 1, y, w: cr.w + 2, h: h - 1 };
      const key = row.it.key;
      const on = lit(key) || lit(`pad:${key}`) || lit(`fig:${row.it.target ?? ""}`) || (!cmdLit && key === cursor);
      const fl = flashing(key);
      if (on && !fl) fb.fill(rr, PAPER);
      if (fl) fb.box(rr, PAPER);
      const c = on && !fl ? INK : PAPER;
      const ty = phone ? y + Math.floor((h - 1 - (row.lines.length * 9 - 1)) / 2) : y + 2 + (extra >> 1);
      if (on) fb.text(f, cr.x, ty, "►", c);
      row.lines.forEach((l, j) => fb.text(f, cr.x + 11, ty + j * 9, l, c));
      const hint = HINT[key];
      if (hint) {
        const hx = cr.x + cr.w - 10;
        fb.fill({ x: hx - 1, y: ty - 1, w: 10, h: 10 }, c);
        fb.text(f, hx, ty, hint, on && !fl ? PAPER : INK);
      }
      hits.push({ key, r: phone ? { ...rr, h } : rr, label: row.it.label, run: () => press(key, row.it.run) });
      y += h;
    }
    if (pages.length > 1) {
      const mr = { x: cr.x - 1, y: cr.y + cr.h - 10, w: cr.w + 2, h: 10 };
      const on = lit("more");
      if (on) fb.fill(mr, PAPER);
      fb.text(f, cr.x + 11, mr.y + 1, `▼ MORE ${cmdPage + 1}/${pages.length}`, on ? INK : PAPER);
      hits.push({ key: "more", r: mr, label: "More actions", run: () => { cmdPage = (cmdPage + 1) % pages.length; paint(); } });
    }
    if (busy) fb.stipple({ x: cr.x - 1, y: y0, w: cr.w + 2, h: cr.y + cr.h - y0 });
  }

  /* ---------------------------- Function keys ----------------------------- */
  function paintKeys(v: SceneView, r: Rect): void {
    const f = font!;
    fb.fill({ x: r.x + 4, y: r.y + 4, w: r.w, h: r.h }, INK);
    fb.fill(r, INK);
    fb.box(r, PAPER);
    const short = L!.mode === "tall";
    const keys: [string, string, string, boolean, () => void][] = [
      ["F1", "JOURNAL", "fkey:journal", ctx.journal.open, () => ctx.journal.toggle()],
      ["F2", "CLASSES", "fkey:classes", ctx.classes.open, () => ctx.classes.toggle()],
      ["F3", "THEME", "fkey:theme", themeMenu, () => { themeMenu = !themeMenu; paint(); }],
    ];
    // A phone shares the strip out among the keys, in fewer letters if it must.
    if (short && keys.reduce((n, k) => n + k[1].length * 8 + 4, 0) + 4 > r.w) { keys[0][1] = "JRNL"; keys[1][1] = "CLASS"; }
    const share = short ? Math.floor((r.w - 2 - keys.reduce((n, k) => n + k[1].length * 8, 0)) / keys.length) : 0;
    let x = r.x + (short ? 1 : 2);
    for (const [fk, label, key, open, run] of keys) {
      const w = short ? label.length * 8 + share - 1 : fk.length * 8 + 4 + label.length * 8 + 6;
      const kr = short ? { x, y: r.y + 1, w, h: r.h - 2 } : { x, y: r.y + 1, w, h: r.h - 2 };
      const on = lit(key) !== open;
      fb.fill(kr, on ? INK : PAPER);
      let tx = short ? x + Math.floor((w - label.length * 8) / 2) : x + 3;
      if (!short) {
        fb.fill({ x, y: kr.y, w: fk.length * 8 + 4, h: kr.h }, on ? PAPER : INK);
        fb.text(f, x + 2, kr.y + 1, fk, on ? INK : PAPER);
        tx = x + fk.length * 8 + 7;
      }
      fb.text(f, tx, short ? kr.y + Math.floor((kr.h - 8) / 2) : kr.y + 1, label, on ? PAPER : INK);
      if (flashing(key)) fb.invert(kr);
      hits.push({ key, r: short ? { ...kr, y: r.y, h: r.h } : kr, label: `${label.toLowerCase()} (${fk})`, run: () => press(key, run) });
      x += w + (short ? 1 : 6);
    }
    // Right end: the card, and a working light while something is being prepared.
    const st = ctx.status(v);
    const busy = ctx.box(v).busy;
    const right = busy ? `${SPIN[Math.floor(time * 8) % 4]} WORKING` : `♦ ${st.card.toUpperCase()}`;
    const room = Math.floor((r.x + r.w - x - 6) / 8);
    if (room > 8) {
      const t = clip(right, room);
      fb.text(f, r.x + r.w - 3 - t.length * 8, r.y + 2, t, PAPER);
    }
  }

  function paintThemeMenu(v: SceneView): void {
    const f = font!;
    const k = L!.keys;
    const w = Math.max(...ctx.themes.map((t) => t.label.length)) * 8 + 34;
    const h = 17 + ctx.themes.length * 11 + 3;
    const x = Math.min(L!.W - w - 6, k.x + (L!.mode === "tall" ? 120 : 168));
    const r = { x, y: k.y - h - 2, w, h };
    win(r, "Theme", { close: "theme:close" });
    hits.push({ key: "theme:close", r: { x: r.x + 7, y: r.y + 3, w: 11, h: 9 }, label: "Close the theme menu", run: () => { themeMenu = false; paint(); } });
    const cr = inner(r);
    ctx.themes.forEach((t, i) => {
      const key = `theme:${t.id}`;
      const rr = { x: cr.x - 1, y: cr.y + i * 11, w: cr.w + 2, h: 10 };
      const on = lit(key);
      if (on) fb.fill(rr, PAPER);
      const c = on ? INK : PAPER;
      if (t.id === v.theme) fb.text(f, cr.x, rr.y + 1, "✓", c);
      fb.text(f, cr.x + 11, rr.y + 1, t.label.toUpperCase(), c);
      hits.push({ key, r: rr, label: `Theme: ${t.label}${t.id === v.theme ? " (current)" : ""}`, run: () => { themeMenu = false; ctx.setTheme(t.id); } });
    });
  }

  /* -------------------------------- Journal ------------------------------- */
  type JLine = { t: string; k: "h" | "p" | "done" | "gap"; keep?: number };
  let jCache: { key: string; lines: JLine[] } | null = null;
  function journalLines(v: SceneView, chars: number): JLine[] {
    const html = ctx.journal.html(v);
    const st = ctx.status(v);
    const key = `${chars}|${html}|${JSON.stringify(st.thread ?? null)}`;
    if (jCache?.key === key) return jCache.lines;
    const out: JLine[] = [];
    const push = (text: string, k: JLine["k"], indent: number, bullet: string) => {
      const lead = bullet.length + 1;
      wrap(text, chars - indent - lead).forEach((l, i) => out.push({ t: " ".repeat(indent) + (i ? " ".repeat(lead) : bullet + " ") + l, k, keep: indent + lead }));
    };
    if (st.thread) {
      out.push({ t: "THE THREAD", k: "h" });
      push(st.thread.goal, "p", 0, "♦");
      push(`Found ${st.thread.found.length} of ${st.thread.total}.`, "p", 0, " ");
      for (const fnd of st.thread.found) push(fnd, "p", 2, "✓");
      out.push({ t: "", k: "gap" });
    }
    const tpl = document.createElement("template");
    tpl.innerHTML = html;
    const textOf = (el: Element): string => {
      let s = "";
      el.childNodes.forEach((n) => {
        if (n.nodeType === 3) s += n.textContent;
        else if (n instanceof Element) {
          if (n.tagName === "UL") return;
          if (n.classList.contains("aff")) {
            const i = n.querySelector("i");
            const wd = parseFloat(i?.style.width ?? "0") / 5;
            const neg = i?.classList.contains("neg");
            if (wd) s += ` (${neg ? "-" : "+"}${Math.round(wd * 10) / 10}) `;
            return;
          }
          s += textOf(n);
        }
      });
      return s.replace(/\s+/g, " ").trim();
    };
    const walk = (el: Element, depth: number) => {
      for (const c of [...el.children]) {
        if (c.tagName === "H3") {
          if (out.length && out[out.length - 1]!.k !== "gap") out.push({ t: "", k: "gap" });
          out.push({ t: (c.textContent ?? "").toUpperCase(), k: "h" });
        } else if (c.tagName === "UL") walk(c, depth);
        else if (c.tagName === "LI") {
          const done = c.classList.contains("done");
          push(textOf(c) + (c.classList.contains("bond") ? " ♥" : ""), done ? "done" : "p", depth * 2, done ? "[✓]" : depth ? "-" : "•");
          const sub = c.querySelector(":scope > ul");
          if (sub) walk(sub, depth + 1);
        } else if (c.classList.contains("muted") || c.tagName === "DIV" || c.tagName === "P") push(textOf(c), "p", 0, " ");
      }
    };
    walk(tpl.content as unknown as Element, 0);
    jCache = { key, lines: out };
    return out;
  }

  function paintJournal(v: SceneView): void {
    const f = font!;
    const r = L!.journal;
    win(r, "Journal", { close: "journal:close" });
    const phone = L!.mode === "tall";
    const closeHit: Hit = { key: "journal:close", r: phone ? { x: r.x, y: r.y, w: Math.max(30, rowMin()), h: rowMin() } : { x: r.x + 7, y: r.y + 3, w: 11, h: 9 }, label: "Close the journal", run: () => ctx.journal.toggle() };
    hits.push(closeHit);
    const cr = inner(r);
    const tw = cr.w - (phone ? 26 : 12);
    const lines = journalLines(v, Math.floor(tw / 8));
    const vis = Math.floor(cr.h / 10);
    jMax = Math.max(0, lines.length - vis);
    jScroll = Math.max(0, Math.min(jMax, jScroll));
    for (let i = 0; i < vis; i++) {
      const ln = lines[jScroll + i];
      if (!ln) break;
      const y = cr.y + i * 10;
      if (ln.k === "h") {
        fb.fill({ x: cr.x - 1, y: y - 1, w: tw + 1, h: 10 }, PAPER);
        fb.text(f, cr.x + 2, y, `${ln.t}`, INK);
      } else if (ln.t) {
        const w = fb.text(f, cr.x, y, ln.t, PAPER);
        const bx = ln.t.indexOf("[✓]");
        if (ln.k === "done" && bx >= 0) {
          // Done: the tick stamped as an inverse badge; the words stay solid and readable.
          const r0 = { x: cr.x + bx * 8 - 1, y: y - 1, w: 3 * 8 + 2, h: 10 };
          fb.fill(r0, PAPER);
          fb.text(f, cr.x + bx * 8 + 8, y, "✓", INK);
          for (let dx = cr.x + w + 6; dx < cr.x + tw - 4; dx += 3) fb.set(dx, y + 6, PAPER);
        }

      }
    }
    // Scroll bar: a checkered track and a solid thumb, arrows at the ends.
    const sx = cr.x + cr.w - 9;
    fb.tone({ x: sx, y: cr.y + 10, w: 9, h: cr.h - 20 }, 0.5);
    fb.box({ x: sx, y: cr.y, w: 9, h: cr.h }, PAPER);
    const th = Math.max(8, Math.round(((cr.h - 20) * vis) / Math.max(vis, lines.length)));
    const ty = cr.y + 10 + Math.round(jMax ? ((cr.h - 20 - th) * jScroll) / jMax : 0);
    fb.fill({ x: sx, y: ty, w: 9, h: th }, PAPER);
    fb.box({ x: sx, y: ty, w: 9, h: th }, INK);
    for (const [key, yy, glyph, d] of [["journal:up", cr.y, "▲", -4], ["journal:down", cr.y + cr.h - 10, "▼", 4]] as const) {
      const on = lit(key);
      fb.fill({ x: sx, y: yy, w: 9, h: 10 }, on ? PAPER : INK);
      fb.box({ x: sx, y: yy, w: 9, h: 10 }, PAPER);
      fb.text(f, sx, yy + 1, glyph, on ? INK : PAPER);
      const rm = rowMin();
      hits.push({ key, r: phone ? { x: cr.x + cr.w - rm, y: d < 0 ? yy : yy + 10 - rm, w: rm, h: rm } : { x: sx, y: yy, w: 9, h: 10 }, label: d < 0 ? "Scroll the journal up" : "Scroll the journal down", run: () => scrollJournal(phone ? d * 2 : d) });
    }
    hits.push({ key: "journal:body", r: { x: cr.x, y: cr.y, w: tw, h: cr.h }, label: "Journal", run: () => undefined, tab: false, wheel: true });
    // On a phone the text can be dragged, and the close box is big enough to overlap it: it stays on top.
    if (phone) { hits.splice(hits.indexOf(closeHit), 1); hits.push(closeHit); }
  }
  function scrollJournal(d: number): void {
    jScroll = Math.max(0, Math.min(jMax, jScroll + d));
    paint();
  }

  /* --------------------------------- Paint -------------------------------- */
  const blinkOn = () => ctx.reducedMotion || Math.floor(time * 2) % 2 === 0;

  function press(key: string, run: () => void): void {
    flash = { key, t: time };
    run();
  }

  function paint(): void {
    if (dead || !view) return;
    const v = view;
    write.sync(v, ctx.journal.open || ctx.classes.open || themeMenu);
    L = layout(v);
    if (fb.w !== L.W || fb.h !== L.H) {
      fb = new Frame(L.W, L.H);
      cv.width = L.W;
      cv.height = L.H;
    }
    stage.style.width = `${L.W * u}px`;
    stage.style.height = `${L.H * u}px`;
    cv.style.width = `${L.W * u}px`;
    cv.style.height = `${L.H * u}px`;
    const rw = root.clientWidth, rh = root.clientHeight;
    stage.style.left = `${Math.max(0, Math.floor((rw - L.W * u) / 2))}px`;
    stage.style.top = L.mode === "tall" ? "0px" : `${Math.max(0, Math.floor((rh - L.H * u) / 2))}px`;
    placeOverlays();
    paintCue();
    hits = [];
    // The desktop: black glass with a sparse dot matrix, so the windows glow out of the dark.
    for (let y = 0; y < fb.h; y++) for (let x = 0; x < fb.w; x++) fb.pix[y * fb.w + x] = (x & 3) === 0 && (y & 3) === ((x >> 1) & 2) ? PAPER : INK;
    if (!font) {
      fb.present(g2, C_INK, C_PAPER);
      return;
    }
    paintView(v, L.view);
    paintText(v, L.text);
    paintStatus(v, L.stat);
    if (v.delve) paintMap(v, L.aux);
    else if (v.hex) paintHex(v, L.aux);
    paintCmd(v, L.cmd);
    paintKeys(v, L.keys);
    if (ctx.journal.open) paintJournal(v);
    if (themeMenu) paintThemeMenu(v);
    fb.present(g2, C_INK, C_PAPER);
    syncHits();
    lastPaint = time;
    // A phone's page holds the whole story: take them to the newest beat. (Here, not on arrival: the first paints come before the font.)
    if (toNewestBeat) {
      toNewestBeat = false;
      if (L.mode === "tall") scroller.scrollTop = Math.max(0, newestBeatY * u - 8);
    }
  }

  /** The class panel is DOM: aim it at its window on the grid. */
  function placeOverlays(): void {
    if (!host || !L) return;
    const sl = parseFloat(stage.style.left) || 0, stp = parseFloat(stage.style.top) || 0;
    const c = L.classes;
    host.style.setProperty("--ob-u", `${u}px`);
    host.style.setProperty("--ob-f", `${8 * u}px`);
    host.style.setProperty("--ob-x", `${sl + c.x * u}px`);
    host.style.setProperty("--ob-y", `${stp + c.y * u}px`);
    host.style.setProperty("--ob-w", `${c.w * u}px`);
    host.style.setProperty("--ob-h", `${c.h * u}px`);
  }

  /* -------------------------------- Input --------------------------------- */
  function syncHits(): void {
    // Modal windows take the input of what they cover.
    let list = hits;
    if (ctx.journal.open) {
      const j = L!.journal;
      list = list.filter((h) => h.key.startsWith("journal") || h.key.startsWith("fkey") || h.key.startsWith("theme") || !overlaps(h.r, j));
    }
    const sig = list.map((h) => `${h.key}@${h.r.x},${h.r.y},${h.r.w},${h.r.h}|${h.label}|${h.tab === false ? 0 : 1}`).join(";") + `|${u}`;
    if (sig === hitSig) return;
    hitSig = sig;
    const keep = new Set(list.map((h) => h.key));
    for (const [k, el] of buttons) if (!keep.has(k)) { el.remove(); buttons.delete(k); }
    let prev: ChildNode | null = null;
    for (const h of list) {
      let el = buttons.get(h.key);
      if (!el) {
        el = h.wheel ? document.createElement("div") : document.createElement("button");
        el.dataset.key = h.key;
        if (h.wheel) el.className = "wheel";
        else (el as HTMLButtonElement).type = "button";
        buttons.set(h.key, el);
      }
      el.style.left = `${h.r.x * u}px`;
      el.style.top = `${h.r.y * u}px`;
      el.style.width = `${h.r.w * u}px`;
      el.style.height = `${h.r.h * u}px`;
      el.setAttribute("aria-label", h.label);
      if (h.title) el.title = h.title;
      else el.removeAttribute("title");
      if (!h.wheel) el.tabIndex = h.tab === false ? -1 : 0;
      // Tab order follows drawing order. Move a button only when it is out of
      // place: moving a focused element would blur it.
      const want: ChildNode | null = prev ? prev.nextSibling : hitLayer.firstChild;
      if (el !== want) hitLayer.insertBefore(el, want);
      prev = el;
    }
  }
  const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const keyOf = (e: Event) => ((e.target as HTMLElement).closest?.("[data-key]") as HTMLElement | null)?.dataset.key ?? null;

  hitLayer.addEventListener("click", (e) => {
    const k = keyOf(e);
    const h = k ? hits.find((x) => x.key === k) : null;
    if (h && !h.wheel) h.run();
  });
  hitLayer.addEventListener("pointerover", (e) => {
    const k = keyOf(e);
    if (e.pointerType === "touch") return;
    if (k !== hover) {
      hover = k;
      if (k && view && ctx.menu(view).some((m) => m.key === k)) cursor = k;
      paint();
    }
  });
  hitLayer.addEventListener("pointerleave", () => {
    if (hover) { hover = null; paint(); }
  });
  hitLayer.addEventListener("focusin", (e) => {
    focus = keyOf(e);
    paint();
  });
  hitLayer.addEventListener("focusout", () => {
    focus = null;
    paint();
  });
  // A finger on the journal's text scrolls it, a line at a time (it's painted, so the browser can't).
  let dragY: number | null = null;
  let dragOn: string | null = null;
  hitLayer.addEventListener("touchstart", (e) => {
    dragOn = keyOf(e);
    dragY = dragOn === "journal:body" || dragOn === "chron:body" ? e.touches[0]!.clientY : null;
  }, { passive: true });
  hitLayer.addEventListener("touchmove", (e) => {
    if (dragY === null) return;
    e.preventDefault();
    const dy = dragY - e.touches[0]!.clientY;
    const lines = Math.trunc(dy / (10 * u));
    if (!lines) return;
    dragY -= lines * 10 * u;
    if (dragOn === "chron:body") {
      chronBack = Math.max(0, Math.min(chronMax, chronBack - lines));
      paint();
    } else scrollJournal(lines);
  }, { passive: false });
  hitLayer.addEventListener("wheel", (e) => {
    const on = keyOf(e);
    if (on === "chron:body") {
      e.preventDefault();
      chronBack = Math.max(0, Math.min(chronMax, chronBack + (e.deltaY > 0 ? -3 : 3)));
      paint();
      return;
    }
    if (on !== "journal:body") return;
    e.preventDefault();
    scrollJournal(e.deltaY > 0 ? 3 : -3);
  }, { passive: false });

  /* ---------------------- Off-grid overlays, dithered ---------------------- */
  // "Meanwhile..." art and class pictures are host DOM: swap their painted
  // backgrounds for 1-bit copies so they sit on the same palette.
  const mo = new MutationObserver(() => {
    if (!host) return;
    host.querySelectorAll<HTMLElement>(":scope > .mw .mw-art, :scope > .fg .pic").forEach((el) => {
      const m = /url\(["']?([^"')]+)["']?\)/.exec(el.style.backgroundImage);
      if (!m) return;
      const url = m[1]!;
      if (el.dataset.obDone === url || el.dataset.obSrc === url) return;
      el.dataset.obSrc = url;
      const rows = el.classList.contains("mw-art") ? Math.round(screenRows * 0.45) : 24;
      void ctx.dither(url, rows).then((d) => {
        if (el.dataset.obSrc !== url) return;
        el.dataset.obDone = d;
        el.style.backgroundImage = `url("${d}")`;
      });
    });
  });
  if (host) mo.observe(host, { subtree: true, childList: true, attributes: true, attributeFilter: ["style"] });

  const ro = new ResizeObserver(() => {
    hitSig = "";
    paint();
  });
  ro.observe(root);

  /* ------------------------------- Animation ------------------------------ */
  const stop = ctx.onFrame((_t, dt) => {
    time += dt;
    if (!view || !font) return;
    let need = false;
    if (view.delve && corridor.tick(ctx.reducedMotion ? 10 : dt)) need = true;
    if (!ctx.reducedMotion) {
      const p = ctx.pointer();
      const q = { x: Math.round(p.x * 8) / 8, y: Math.round(p.y * 8) / 8 };
      if (q.x !== par.x || q.y !== par.y) { par = q; need = true; }
      // Torch flicker, cursor blink and spinners run at a low, steady frame rate.
      if (time - lastPaint > 1 / 12) need = true;
    }
    if (flash) {
      if (time - flash.t > 0.3) flash = null;
      need = true;
    }
    if (need) paint();
  });

  /* --------------------------------- API ---------------------------------- */
  function updateReader(v: SceneView): void {
    const b = ctx.box(v);
    const st = ctx.status(v);
    sr.innerHTML = `<p>${esc(st.where)}. Day ${st.day}, ${esc(st.time)}. ${st.coin} ${esc(st.currency)}. Vigor ${Math.round(st.vigor * 100)}%.${st.thread ? ` Thread ${st.thread.found.length} of ${st.thread.total}: ${esc(st.thread.goal)}.` : ""}${st.supplies ? ` Supplies ${st.supplies.now} of ${st.supplies.max}.` : ""}</p><p>${esc(b.desc)}</p><p aria-live="polite">${esc(b.log[b.log.length - 1] ?? "")}${b.busy ? ` ${esc(b.busy)}` : ""}</p>${isWriting(v) ? `<div aria-live="polite">${beatsHtml(v.story)}</div>` : ""}${ctx.journal.open ? `<div role="dialog" aria-label="Journal">${ctx.journal.html(v)}</div>` : ""}`;
  }

  return {
    boardSkin: BOARD_SKINS.onebit,
    render(v) {
      const prevJ = view ? ctx.journal.open : false;
      if (view?.delve && !v.delve) corridorFirst = true;
      if (!view || view.place.id !== v.place.id || !!view.delve !== !!v.delve) cmdPage = 0;
      view = v;
      ctx.backdrop(v, { post: "none", flat: "none" });
      if (v.hex) ctx.drawHex(hexSrc, v);
      if (!prevJ && ctx.journal.open) jScroll = 0;
      if (ctx.journal.open && L?.mode === "tall") scroller.scrollTop = 0;
      updateReader(v);
      const told = isWriting(v) ? JSON.stringify(v.story) : "";
      const moved = told !== seenStory;
      seenStory = told;
      if (moved) {
        chronBack = 0;
        toNewestBeat = !!told;
      }
      paint();
    },
    key(e, v) {
      const k = e.key;
      const lower = k.toLowerCase();
      if (themeMenu && k === "Escape") { themeMenu = false; paint(); return true; }
      if (ctx.journal.open) {
        if (k === "Escape" || lower === "j" || k === "F1") { ctx.journal.toggle(); return true; }
        const step = k === "ArrowDown" ? 1 : k === "ArrowUp" ? -1 : k === "PageDown" ? 8 : k === "PageUp" ? -8 : 0;
        if (step) { scrollJournal(step); return true; }
      }
      if (k === "F1" || lower === "j") { ctx.journal.toggle(); return true; }
      if (k === "F2" || lower === "c") { ctx.classes.toggle(); return true; }
      if (k === "F3" || lower === "t") {
        themeMenu = !themeMenu;
        paint();
        if (themeMenu) {
          (buttons.get(`theme:${v.theme}`) as HTMLElement | undefined)?.focus();
          focus = `theme:${v.theme}`; // focus events do not fire in a background window
          paint();
        }
        return true;
      }
      if (k === "Escape" && ctx.classes.open) { ctx.classes.toggle(); return true; }
      if (chronMax && isWriting(v) && (k === "PageUp" || k === "PageDown")) {
        chronBack = Math.max(0, Math.min(chronMax, chronBack + (k === "PageUp" ? 8 : -8)));
        paint();
        return true;
      }
      const items = ctx.menu(v);
      if (/^[0-9]$/.test(k)) {
        const i = k === "0" ? 9 : Number(k) - 1;
        const it = items[i];
        if (it) { press(it.key, it.run); return true; }
        return false;
      }
      // The cursor bar: arrows move it (outside a delve, where they walk), Enter runs it.
      if (!v.delve && (k === "ArrowDown" || k === "ArrowUp")) {
        const keys = items.map((m) => m.key);
        const at = Math.max(0, keys.indexOf(focus && keys.includes(focus) ? focus : cursor ?? keys[0]!));
        const next = keys[(at + (k === "ArrowDown" ? 1 : keys.length - 1)) % keys.length];
        if (next) {
          cursor = next;
          (buttons.get(next) as HTMLElement | undefined)?.focus();
          focus = next;
          paint();
        }
        return true;
      }
      if (k === "Enter" && !(focus && buttons.get(focus))) {
        const it = items.find((m) => m.key === cursor) ?? items[0];
        if (it) { press(it.key, it.run); return true; }
      }
      return false;
    },
    destroy() {
      dead = true;
      stop();
      mo.disconnect();
      ro.disconnect();
      for (const p of ["--ob-u", "--ob-f", "--ob-x", "--ob-y", "--ob-w", "--ob-h"]) host?.style.removeProperty(p);
      ob.remove();
    },
  };
};


/** Figures drawn in the view at once; more than this crowd into one another. */
const MAX_FIGURES = 5;

