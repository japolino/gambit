/**
 * The Table theme: first person at a candle-lit card table.
 *
 * You sit at a foreshortened walnut table (a canvas projected row by row, with
 * a cloth mat and placement sigils) facing whoever is here, who looms out of
 * the dark behind its far edge. Your actions are a huge fan of inked woodcut
 * cards cropped by the bottom of the screen; the facts you know are a smaller
 * hand held in your other (drawn) hand and play on the person you face.
 * Status hangs on a chalk scoreboard with a glass vigor tube and the thread's
 * slips pinned below it; coin is a stack on the table lit by a skull candle;
 * the journal is a ledger, the classes a deck in a brass case, the theme a
 * gavel. Every layer moves with the mouse at its own depth.
 */
import { BOARD_SKINS } from "../board-skins.js";
import { esc, rng, seedOf, type MenuItem, type SceneView, type ThemeCtx, type ThemeFactory, type ThemeRenderer } from "./contract.js";
import { ARCH_PATH, actionCard, bell, chair, coins, deckCase, factCard, gavel, handBack, handFront, ironTag, ledger, mapSheet, motifFor, openBook, plaque, scoreboard, shadowbox, skullCandle, tentCard, type BoardData } from "./table/art.js";
import { tableCss } from "./table/css.js";
import { beatsHtml, canWrite, isWriting } from "./write.js";
import { TYPEWRITER_CSS, typewriterHtml, wireTypewriter } from "./typewriter.js";
import { Table3D, type PickId } from "./table/three.js";
import { duel } from "./table/duel.js";
import { feltUrl, leatherUrl, MAT, pageUrl, paintTable, paperUrl, project, SIGILS, slateUrl, stoneUrl, type TableGeom } from "./table/tex.js";

/** A prop's place: left edge as a fraction of the stage width, top as a fraction of the height, width as a fraction of H (wide) or W (portrait). */
type Spot = { x: number; y: number; w: number };
type PropId = "skull" | "coins" | "ledger" | "deck" | "bell" | "gavel";
const PROPS: Record<"wide" | "port", Record<PropId, Spot | null>> = {
  wide: {
    deck: { x: 0.032, y: 0.548, w: 0.12 },
    skull: { x: 0.104, y: 0.365, w: 0.15 },
    coins: { x: 0.178, y: 0.552, w: 0.19 },
    ledger: { x: 0.0, y: 0.632, w: 0.235 },
    bell: { x: 0.795, y: 0.548, w: 0.075 },
    gavel: { x: 0.84, y: 0.566, w: 0.155 },
  },
  port: {
    skull: { x: -0.01, y: 0.36, w: 0.15 },
    ledger: { x: 0.0, y: 0.535, w: 0.25 },
    coins: { x: 0.25, y: 0.53, w: 0.23 },
    deck: { x: 0.52, y: 0.535, w: 0.13 },
    bell: null,
    gavel: { x: 0.7, y: 0.54, w: 0.24 },
  },
};
/** Aspect (h/w) of each prop's SVG viewBox. */
const ASPECT: Record<PropId, number> = { skull: 290 / 200, coins: 170 / 260, ledger: 190 / 270, deck: 210 / 200, bell: 110 / 120, gavel: 160 / 250 };
/** Where people sit: x of the stage, height and foot line as fractions of H. Index 0 is the person you face. */
/** More talk cards than this fold into one "The room" card. */
const ROOM_FOLD = 4;

const SEATS = {
  wide: [
    { x: 0.5, h: 0.56, b: 0.63, c: "s0" },
    { x: 0.27, h: 0.4, b: 0.61, c: "l" },
    { x: 0.73, h: 0.4, b: 0.61, c: "r" },
    { x: 0.385, h: 0.31, b: 0.585, c: "l far" },
    { x: 0.615, h: 0.31, b: 0.585, c: "r far" },
  ],
  port: [
    { x: 0.5, h: 0.33, b: 0.545, c: "s0" },
    { x: 0.2, h: 0.21, b: 0.52, c: "l" },
    { x: 0.8, h: 0.21, b: 0.52, c: "r" },
    { x: 0.27, h: 0.17, b: 0.51, c: "l far" },
    { x: 0.6, h: 0.17, b: 0.51, c: "r far" },
  ],
};
/** Parallax depth per layer, px at 1080p for a pointer at the edge. */
const DEPTH = { world: [12, 6], board: [18, 9], people: [26, 12], table: [42, 20], hand: [52, 24], fg: [95, 45] } as const;

/** One card as dealt: a menu item, or the theme's own Roads / Back cards. */
interface Deal {
  key: string;
  motif: string;
  small: string;
  big: string;
  label: string;
  art: string | null;
  run: (() => void) | null;
  fly: boolean;
}

interface Layout {
  W: number;
  H: number;
  port: boolean;
  /** A phone, either way up: the actions are a row of readable cards along the bottom, the narration just above them. */
  row: boolean;
  SW: number;
  SL: number;
  /** Canvas margin around the root so the tabletop can slide with parallax. */
  m: number;
  geo: TableGeom;
}

const ARCH_MASK = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 500" preserveAspectRatio="none"><path d="${ARCH_PATH}" fill="#fff"/></svg>`)}")`;

/** "Talk to Mara" -> ["Talk to", "Mara"]: a small verb line over a big name. */
function split(label: string): [string, string] {
  const m = /^(Talk to|Go to|Travel to|Explore|Look for an?|Leave)\s+(.+)$/i.exec(label);
  return m ? [m[1]!, m[2]!] : ["", label];
}

/** Dust drifting up through the candlelight (CSS-animated, transform and opacity only). */
function motes(): string {
  const r = rng(808);
  return Array.from({ length: 18 }, () => {
    const near = r() < 0.55;
    const x = near ? 0.08 + r() * 0.16 : 0.3 + r() * 0.4;
    const y = 0.32 + r() * 0.3;
    return `<i class="mote" style="left:${(x * 100).toFixed(1)}%;top:${(y * 100).toFixed(1)}%;--t:${(7 + r() * 9).toFixed(1)}s;--d:${(-r() * 12).toFixed(1)}s;--dx:${((r() - 0.5) * 60).toFixed(0)}px;--s:${(1.5 + r() * 2.5).toFixed(1)}px"></i>`;
  }).join("");
}

export const table: ThemeFactory = (ctx: ThemeCtx): ThemeRenderer => {
  const root = ctx.root;
  const paper = paperUrl();
  const tex = { felt: feltUrl(), paper, page: pageUrl(), leather: leatherUrl() };
  const slate = slateUrl();
  const stone = stoneUrl();
  root.innerHTML = `<style>${tableCss(tex)}${TYPEWRITER_CSS}</style>
  <div class="tb">
    <div class="L wl"></div>
    <div class="st bl"><div class="map" hidden><div class="sheet"></div><svg class="hex" role="group" aria-label="The overland map"></svg></div><div class="board"><div class="sb"></div><canvas class="amap" hidden></canvas><div class="thr" tabindex="0" role="note"></div></div></div>
    <div class="st pl"></div>
    <div class="L sh"><div class="shade"></div></div>
    <div class="L tl"><canvas class="tcv"></canvas></div>
    <div class="st ol">
      <div class="tents"></div>
      <div class="prop skull">${skullCandle()}</div>
      <div class="prop coins" role="img"></div>
      <div class="prop bell">${bell()}</div>
    </div>
    <div class="st gl glows"><i class="glow a"></i><i class="glow b"></i><i class="glow c"></i>${motes()}</div>
    <div class="L vig"></div>
    <div class="st ol2">
      <button class="prop ledger" aria-label="Journal (the ledger)">${ledger(tex.leather)}<span class="lab">Ledger</span></button>
      <button class="prop deck" aria-label="Classes (the deck case)">${deckCase()}</button>
      <button class="prop gavel" aria-label="Change the table (theme)" aria-haspopup="true">${gavel()}<span class="lab">Theme</span></button>
    </div>
    <div class="st hl">${typewriterHtml("tb-tw")}<div class="fan"><div class="rail"></div></div><div class="more" aria-hidden="true">›</div>
      <div class="plaque" aria-live="polite">${plaque(stone, 11)}<div class="rib"></div><div class="ptx"></div><button class="tab" aria-expanded="false" aria-label="Show the whole log">LOG</button></div>
    </div>
    <div class="st fl"><div class="fgh">${handBack()}<div class="facts"></div>${handFront()}<div class="empty"></div></div></div>
    <div class="L t3l" hidden></div>
    <div class="st ul"><div class="tags" hidden></div><div class="peek" role="dialog" hidden></div></div>
  </div>`;
  const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector(s) as unknown as T;
  const tb = $<HTMLDivElement>(".tb");
  tb.style.setProperty("--arch", ARCH_MASK);
  $(".wl").append(ctx.world);
  const layers = {
    world: $(".wl"),
    board: $(".bl"),
    people: $(".pl"),
    table: [$(".tl"), $(".ol"), $(".gl"), $(".ol2")],
    hand: $(".hl"),
    fg: $(".fl"),
  };
  const board = $(".board");
  const boardSvg = $(".sb");
  const amap = $<HTMLCanvasElement>(".amap");
  const thr = $(".thr");
  const peopleL = $(".pl");
  const tents = $(".tents");
  const tcv = $<HTMLCanvasElement>(".tcv");
  const mapEl = $(".map");
  const hexSvg = $<SVGSVGElement>(".hex");
  const coinEl = $(".coins");
  const fan = $(".fan");
  const rail = $(".rail");
  const more = $(".more");
  fan.addEventListener("scroll", () => paintMore(), { passive: true });
  const plq = $(".plaque");
  const rib = $(".rib");
  const ptx = $(".ptx");
  const logTab = $<HTMLButtonElement>(".tab");
  const machineEl = $(".tb-tw");
  const write = wireTypewriter(ctx, $<HTMLFormElement>(".tb-tw"));
  const fgh = $(".fgh");
  const factsEl = $(".facts");
  const emptySlip = $(".empty");
  const tags = $(".tags");
  const ul = $(".ul");
  const glowA = $(".glow.a");
  const glowB = $(".glow.b");
  const glowC = $(".glow.c");
  const props: Record<PropId, HTMLElement> = { skull: $(".skull"), coins: coinEl, ledger: $(".ledger"), deck: $(".deck"), bell: $(".bell"), gavel: $(".gavel") };
  $(".sheet").innerHTML = mapSheet(paper, 9);

  const t3l = $(".t3l");
  const peekEl = $(".peek");
  /** The 3D table, when there is WebGL and we're not in a delve. */
  let t3: Table3D | null = null;
  let stage: { setUpdate(fn: null): void } | null = null;
  let x3 = false;
  /** What the camera zoomed in to open, so closing it zooms back out. */
  let opened: "journal" | "classes" | "tags" | "peek" | null = null;
  /** A fight or a talk staged at the table (encounter()): the room only, no scene UI, no picking. */
  let enc: "battle" | "parley" | null = null;
  let fontsReady = false;
  void document.fonts?.ready.then(() => {
    fontsReady = true;
    if (view) render(view);
  });

  let view: SceneView | null = null;
  let L: Layout | null = null;
  let logOpen = false;
  let themesOpen = false;
  let peek: string | null = null;
  let roads = false;
  let room = false;
  const sig: Record<string, string> = {};
  let cards: { el: HTMLButtonElement; label: string; run: (() => void) | null; fact: boolean }[] = [];
  let facts: HTMLButtonElement[] = [];

  /* ------------------------------ Layout ------------------------------ */

  function measure(): Layout | null {
    const W = root.clientWidth;
    const H = root.clientHeight;
    if (!W || !H) return null;
    const port = W / H < 1.15;
    const SW = port ? W : Math.min(W, H * 1.9);
    const SL = (W - SW) / 2;
    const m = Math.round(H * 0.07);
    const cw = W + m * 2;
    const ch = H + Math.round(H * 0.04);
    const yH = port ? H * 0.24 : H * 0.185;
    const yT = port ? H * 0.5 : H * 0.56;
    const geo: TableGeom = { w: cw, h: ch, yH, yT, cx: m + W / 2, backW: port ? W * 1.12 : SW * 0.96, lights: [] };
    return { W, H, port, row: port || H <= 480, SW, SL, m, geo };
  }

  /** Px rect of a prop in stage coordinates. */
  function spot(id: PropId): { x: number; y: number; w: number; h: number } | null {
    const s = PROPS[L!.port ? "port" : "wide"][id];
    if (!s) return null;
    const w = s.w * (L!.port ? L!.W : L!.H);
    return { x: s.x * L!.SW, y: s.y * L!.H, w, h: w * ASPECT[id] };
  }

  function layout(): void {
    const next = measure();
    if (!next) return;
    const same = L && L.W === next.W && L.H === next.H;
    L = next;
    tb.classList.toggle("port", L.port);
    tb.classList.toggle("row", L.row);
    tb.style.setProperty("--sw", `${L.SW}px`);
    for (const st of root.querySelectorAll<HTMLElement>(".st")) {
      st.style.left = `${L.SL}px`;
      st.style.width = `${L.SW}px`;
    }
    // Props.
    for (const id of Object.keys(props) as PropId[]) {
      const r = spot(id);
      const el = props[id];
      el.hidden = !r;
      if (!r) continue;
      Object.assign(el.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px` });
    }
    // Candle pools on the table: under the skull's flames, and over the mat.
    const sk = spot("skull")!;
    const fx = sk.x + sk.w * 0.4;
    const fy = sk.y + sk.w * 0.06;
    const mat = project(L.geo, 0.5, 0.3);
    L.geo.lights = [
      { x: L.m + L.SL + fx, y: sk.y + sk.h * 0.95, r: L.H * 0.42, a: 1 },
      { x: mat.x, y: mat.y, r: L.H * (L.port ? 0.35 : 0.5), a: 0.75 },
    ];
    const ga = L.H * (L.port ? 0.45 : 0.9);
    Object.assign(glowA.style, { left: `${fx - ga / 2}px`, top: `${fy - ga / 2}px`, width: `${ga}px`, height: `${ga}px` });
    const gb = L.H * 0.8;
    Object.assign(glowB.style, { left: `${mat.x - L.m - L.SL - gb / 2}px`, top: `${mat.y - gb * 0.55}px`, width: `${gb}px`, height: `${gb}px` });
    // Tabletop canvas, overhanging the root for parallax.
    Object.assign(tcv.style, { left: `${-L.m}px`, top: "0px", width: `${L.geo.w}px`, height: `${L.geo.h}px` });
    if (!same) paintTable(tcv, L.geo);
    // Scoreboard: its SVG is 350 x 900 with the board between 420 and 800.
    const bw = L.port ? L.W * 0.4 : L.H * 0.34;
    const bh = (bw * 900) / 350;
    Object.assign(board.style, { width: `${bw}px`, left: `${L.SW * (L.port ? 0.985 : 0.955) - bw}px`, top: `${(L.port ? L.H * 0.012 : L.H * 0.055) - (bh * 420) / 900}px` });
    // A lamp somewhere above catches the scoreboard.
    const gc = bw * 2.2;
    Object.assign(glowC.style, { left: `${parseFloat(board.style.left) + bw / 2 - gc / 2}px`, top: `${(L.port ? L.H * 0.012 : L.H * 0.055) + bw * 0.55 - gc / 2}px`, width: `${gc}px`, height: `${gc}px` });
    // Foreground hand, bottom right, overhanging the edge.
    const hw = L.H * 0.56;
    Object.assign(fgh.style, { width: `${hw}px`, height: `${hw}px`, left: `${L.SW - hw * 0.95}px`, top: `${L.H - hw * 0.97}px` });
    t3?.layout(L.W, L.H);
    plqKey = "";
    placePlaque();
    // The frontier map.
    // The frontier map is pinned to the wall on the left, opposite the scoreboard.
    if (L.port) Object.assign(mapEl.style, { left: `${L.W * 0.02}px`, width: `${L.W * 0.54}px`, top: `${L.H * 0.03}px`, height: `${L.H * 0.19}px` });
    else Object.assign(mapEl.style, { left: `${L.SW * 0.012}px`, width: `${L.H * 0.5}px`, top: `${L.H * 0.05}px`, height: `${L.H * 0.31}px` });
    if (view) {
      sig.people = "";
      sig.board = "";
      render(view);
    }
    layoutHand();
    layoutFacts();
  }

  /**
   * The narration lies on the mat as a dark scroll, between the people and
   * your cards, so it never covers a card face. The full log unrolls upward.
   */
  let plqKey = "";
  function placePlaque(): void {
    if (!L) return;
    let box: { x: number; y: number; w: number; h: number };
    const cardsTop = L.H * 0.69;
    // The typewriter stands just behind your cards; the plaque moves up to make it room, and more for a story.
    const slip = view && canWrite(view) ? (L.row ? 84 : Math.max(60, L.H * 0.076)) : 0;
    const story = !!view && isWriting(view);
    let slipBottom: number;
    if (L.row) {
      // Right above the cards, with room for four lines; the whole log opens upward from there.
      slipBottom = L.H - rowCardH(L) - 14;
      const top = slipBottom - slip;
      // On its side the room's labels stand either side of the plaque: a story, tall on the screen, stays between them.
      const w = L.port ? L.W * 0.96 : story ? Math.min(L.SW * 0.56, 460) : Math.min(L.SW * 0.92, 600);
      const closed = L.port ? Math.max(L.H * (story ? 0.3 : 0.2), 118) : Math.max(L.H * (story ? 0.42 : 0.28), 96);
      const h = Math.min(closed, top - 4);
      const y = logOpen ? Math.round(L.H * (L.port ? 0.08 : 0.03)) : top - h;
      box = { x: (L.SW - w) / 2, y, w, h: logOpen ? top - y : h };
    } else {
      let x0: number, x1: number, y0: number;
      if (x3 && t3) {
        const r = t3.matRect(L.W, L.H);
        x0 = r.x0 - L.SL;
        x1 = r.x1 - L.SL;
        y0 = r.y0;
      } else {
        const a = project(L.geo, MAT.u0, MAT.v1);
        const b = project(L.geo, MAT.u1, MAT.v1);
        x0 = a.x - L.m - L.SL;
        x1 = b.x - L.m - L.SL;
        y0 = project(L.geo, 0.5, MAT.v0 + 0.13).y;
      }
      const cx = (x0 + x1) / 2;
      // Never under the fact cards held up on the right.
      const w = Math.min(x1 - x0, L.H * 1.05, 2 * (L.SW - L.H * 0.5 - cx) - 16);
      slipBottom = cardsTop - 2;
      // Not all the way: up by the slip's height, the plaque would be in the way of the name cards on the table's far side.
      const y = logOpen ? L.H * 0.26 : story ? L.H * 0.3 : Math.max(L.H * 0.565, y0) - slip * 0.55;
      box = { x: cx - w / 2, y, w, h: Math.max(L.H * (slip ? 0.085 : 0.11), cardsTop - slip - y) };
    }
    const key = [box.x, box.y, box.w, box.h, slipBottom, slip].map((n) => Math.round(n)).join();
    if (key === plqKey) return;
    plqKey = key;
    Object.assign(plq.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px` });
    // Its page takes the top of that room; the machine runs on down behind the cards.
    const mw = box.w * (L.row ? 1 : 0.96);
    Object.assign(machineEl.style, { left: `${box.x + (box.w - mw) / 2}px`, top: `${slipBottom - slip + (L.row ? 46 : 38)}px`, width: `${mw}px` });
  }

  /** How tall the action cards are on a phone: their labels are real px, so the card must hold them. */
  function rowCardH(l: Layout): number {
    return Math.round(l.port ? Math.max(118, Math.min(176, l.H * 0.215)) : Math.max(92, Math.min(120, l.H * 0.3)));
  }

  /** The row runs off the screen: say so. */
  function paintMore(): void {
    more.classList.toggle("on", !!L?.row && fan.scrollLeft + fan.clientWidth < fan.scrollWidth - 8);
  }

  /** Lay the action cards out as a fan (wide) or a scrolling row (phone): whole cards side by side, none on top of another. */
  function layoutHand(): void {
    if (!L) return;
    const all = cards;
    const n = all.length;
    fan.classList.toggle("scroll", L.row);
    if (L.row) {
      const ch = rowCardH(L);
      const cw = Math.max(100, Math.round(ch * 0.76));
      const fw = Math.max(172, Math.round(cw * 1.5));
      Object.assign(fan.style, { top: `${L.H - ch - 10}px`, height: `${ch + 10}px`, left: `${-L.SL}px`, width: `${L.W}px` });
      Object.assign(more.style, { top: `${L.H - ch - 10}px`, height: `${ch + 10}px`, left: `${L.W - L.SL - 30}px` });
      fan.style.setProperty("--cw", `${cw}px`);
      fan.style.setProperty("--ch", `${ch}px`);
      let x = 8;
      all.forEach((c, i) => {
        const s = c.el.style;
        const w = c.fact ? fw : cw;
        s.setProperty("--cw", `${w}px`);
        s.setProperty("--x", `${x}px`);
        s.setProperty("--y", "4px");
        s.setProperty("--r", "0deg");
        s.setProperty("--z", String(i + 1));
        s.setProperty("--lift", "0px");
        s.setProperty("--hw", "100%");
        s.setProperty("--tw", "92%");
        x += w + 6;
      });
      rail.style.width = `${x + 2}px`;
      paintMore();
      return;
    }
    more.classList.remove("on");
    for (const c of all) c.el.style.removeProperty("--cw");
    // The hand drops a little, off the bottom of the screen, to show the typewriter behind it.
    Object.assign(fan.style, { top: `${view && canWrite(view) ? Math.round(L.H * 0.05) : 0}px`, height: "100%", left: "0px", width: "100%" });
    rail.style.width = "100%";
    const ch = L.H * 0.3;
    const cw = ch * 0.68;
    fan.style.setProperty("--cw", `${cw}px`);
    fan.style.setProperty("--ch", `${ch}px`);
    const span = L.SW * (0.72 - 0.125);
    const step = n > 1 ? Math.min(cw * 0.82, (span - cw) / (n - 1)) : 0;
    const total = cw + step * Math.max(0, n - 1);
    const x0 = L.SW * 0.125 + (span - total) / 2;
    const tw = Math.min(86, ((step * 0.94) / cw) * 100);
    all.forEach((c, i) => {
      const t = n > 1 ? (i / (n - 1)) * 2 - 1 : 0;
      const s = c.el.style;
      s.setProperty("--x", `${x0 + i * step}px`);
      s.setProperty("--y", `${L!.H * 0.7 + t * t * L!.H * 0.05}px`);
      s.setProperty("--r", `${t * Math.min(13, n * 1.6)}deg`);
      s.setProperty("--z", String(i + 1));
      s.setProperty("--lift", `${L!.H * 0.12}px`);
      // Each card answers only on the slice the next card leaves showing.
      s.setProperty("--hw", i === n - 1 ? "100%" : `${step * 1.1}px`);
      s.setProperty("--tw", `${i === n - 1 ? 86 : tw}%`);
    });
  }

  /** The facts held in your other hand, fanned from the thumb. */
  function layoutFacts(): void {
    if (!L || L.row) return;
    const bw = L.H * 0.56;
    const ch = L.H * 0.33;
    const cw = ch * 0.68;
    factsEl.style.setProperty("--cw", `${cw}px`);
    factsEl.style.setProperty("--ch", `${ch}px`);
    const k = facts.length;
    // The cards pivot in the crook of the thumb (art.ts handFront) and lean over the fingers.
    const px = bw * 0.55;
    const py = bw * 0.72;
    facts.forEach((el, i) => {
      // Fanned wide enough that two or three titles read at once.
      const spread = Math.min(52, 18 * (k - 1));
      const a = k > 1 ? -30 + (i / (k - 1)) * spread : 2;
      el.style.setProperty("--x", `${px - cw / 2}px`);
      el.style.setProperty("--y", `${py - ch * 0.92}px`);
      el.style.setProperty("--r", `${a}deg`);
      el.style.setProperty("--z", String(i + 1));
    });
  }

  /* ------------------------------ Playing ----------------------------- */

  /** Throw a copy of the card onto the middle sigil, then act. */
  function play(el: HTMLElement, run: () => void): void {
    if (L && !ctx.reducedMotion && typeof el.animate === "function") {
      const r = el.getBoundingClientRect();
      const u = ul.getBoundingClientRect();
      const fly = document.createElement("div");
      fly.className = "fly";
      fly.innerHTML = el.querySelector(".face")?.outerHTML ?? "";
      Object.assign(fly.style, { width: `${el.offsetWidth}px`, height: `${el.offsetHeight}px` });
      ul.append(fly);
      // Everything in the ui layer's frame: it spans the stage and does not move with parallax.
      const p = x3 && t3 ? ((q) => ({ x: q.x + L!.m, y: q.y }))(t3.screenAt(0, 0.01, -0.82, L.W, L.H)) : project(L.geo, SIGILS[1]!.u, SIGILS[1]!.v);
      const sx = r.left - u.left + r.width / 2 - el.offsetWidth / 2;
      const sy = r.top - u.top + r.height / 2 - el.offsetHeight / 2;
      const ex = p.x - L.m - L.SL - el.offsetWidth / 2;
      const ey = p.y - el.offsetHeight / 2;
      const a = fly.animate(
        [
          { transform: `translate(${sx}px, ${sy}px) rotate(0deg) scale(1.1)`, opacity: 1 },
          { transform: `translate(${(sx + ex) / 2}px, ${Math.min(sy, ey) - L.H * 0.12}px) perspective(800px) rotateX(25deg) scale(.9)`, opacity: 1, offset: 0.45 },
          { transform: `translate(${ex}px, ${ey}px) perspective(800px) rotateX(62deg) rotateZ(4deg) scale(.42)`, opacity: 0.95, offset: 0.85 },
          { transform: `translate(${ex}px, ${ey}px) perspective(800px) rotateX(62deg) rotateZ(4deg) scale(.42)`, opacity: 0 },
        ],
        { duration: 900, easing: "cubic-bezier(.3,.6,.3,1)" },
      );
      a.onfinish = () => fly.remove();
    }
    run();
  }

  function cardHtml(motif: string, seed: number, art: string | null, small: string, big: string, i: number): string {
    const size = big.length > 16 ? "s" : big.length > 9 ? "m" : "";
    return `<span class="hit"></span><span class="face">${actionCard(motif, seed, paper, art)}<span class="ttl ${size}">${small ? `<small>${esc(small)}</small>` : ""}<b>${esc(big)}</b></span>${i < 9 ? `<span class="idx">${i + 1}</span>` : ""}</span>`;
  }

  function factHtml(id: string, text: string, who: string | null): string {
    return `<span class="hit"></span><span class="face">${factCard(seedOf(id), paper)}<span class="ttl"><small>${who ? `Play on ${esc(who)}` : "Known"}</small><b>Fact</b></span><span class="ftx">${esc(text)}</span></span>`;
  }

  /** A card or fact was pointed at: preview it on the plaque ribbon. */
  function setPeek(label: string | null): void {
    peek = label;
    if (view) paintRibbon(view);
    if (L && !L.row && !facts.length) emptySlip.textContent = label ?? (view?.busy ? `${view.busy}…` : "Choose your move");
  }

  function wire(el: HTMLButtonElement, label: string, run: (() => void) | null, fly = true): void {
    el.setAttribute("aria-label", label);
    if (!run) el.setAttribute("aria-disabled", "true");
    el.addEventListener("click", () => run && (fly ? play(el, run) : run()));
    el.addEventListener("pointerenter", () => setPeek(label));
    el.addEventListener("pointerleave", () => setPeek(null));
    el.addEventListener("focus", () => setPeek(label));
    el.addEventListener("blur", () => setPeek(null));
  }

  /* ------------------------------ Pieces ------------------------------ */

  /** Deal the roads out (or put them away). */
  function openRoads(on: boolean): void {
    roads = on;
    room = false;
    setPeek(null);
    if (view) renderHand(view);
    (cards[0]?.el as HTMLElement | undefined)?.focus({ preventScroll: true });
  }

  /** Deal the room's people out as talk cards (or put them away). */
  function openRoom(on: boolean): void {
    room = on;
    roads = false;
    setPeek(null);
    if (view) renderHand(view);
    (cards[0]?.el as HTMLElement | undefined)?.focus({ preventScroll: true });
  }

  function renderHand(v: SceneView): void {
    const menu = ctx.menu(v);
    const hand = ctx.hand(v);
    const lead = ctx.people(v)[0]?.name ?? null;
    const people = new Map(ctx.people(v).map((p) => [p.id, p]));
    const port = !!L?.row;
    // Talk cards carry the person's likeness, posterised; exits carry the place they go to.
    const artOf = (m: MenuItem): string | null => (m.group === "talk" && m.target ? ctx.personArt(v, m.target)?.url ?? null : m.art ?? null);
    // Two or more ways out fold into one Roads card that deals them as a second hand.
    const exits = menu.filter((m) => m.kind === "exit");
    const grouped = !v.delve && exits.length >= 2;
    if (!grouped) roads = false;
    // A crowded room folds its talk cards into one card that deals them as a second hand, the way Roads does.
    const talks = menu.filter((m) => m.group === "talk");
    const crowded = talks.length > ROOM_FOLD;
    if (!crowded) room = false;
    const deal: Deal[] = [];
    const asDeal = (m: MenuItem): Deal => {
      const [small, big] = split(m.label);
      const who = m.group === "talk" && m.target ? people.get(m.target) : null;
      return { key: m.key, motif: motifFor(m.key, m.kind), small, big, label: m.label + (who ? `: ${who.role}` : ""), art: artOf(m), run: m.run, fly: true };
    };
    if (room) {
      deal.push(...talks.map((m) => ({ ...asDeal(m), run: () => ((room = false), m.run()) })));
      deal.push({ key: "stay-room", motif: "move:left", small: "Back to", big: "your hand", label: "Back to your hand (put the faces away)", art: null, run: () => openRoom(false), fly: false });
    } else if (roads) {
      deal.push(...exits.map((m) => ({ ...asDeal(m), run: () => ((roads = false), m.run()) })));
      deal.push({ key: "stay", motif: "move:left", small: "Back to", big: "the table", label: "Stay here (put the roads away)", art: null, run: () => openRoads(false), fly: false });
    } else {
      let folded = false;
      let foldedTalk = false;
      for (const m of menu) {
        if (crowded && m.group === "talk") {
          if (!foldedTalk) deal.push({ key: "room", motif: "talk", small: `${talks.length} people`, big: "The room", label: `Talk to someone: ${talks.map((t) => split(t.label)[1]).join(", ")}`, art: null, run: () => openRoom(true), fly: false });
          foldedTalk = true;
          continue;
        }
        if (grouped && m.kind === "exit") {
          if (!folded) deal.push({ key: "roads", motif: "roads", small: `${exits.length} ways out`, big: "Roads", label: `Roads: ${exits.map((e) => split(e.label)[1]).join(", ")}`, art: null, run: () => openRoads(true), fly: false });
          folded = true;
          continue;
        }
        deal.push(asDeal(m));
      }
    }
    const key = JSON.stringify([port, roads, room, deal.map((d) => [d.key, d.label, d.art]), hand.map((h) => [h.id, !!h.play]), lead]);
    if (key === sig.hand) return;
    sig.hand = key;
    // The card under the pointer may be gone; forget its preview.
    peek = null;
    rail.replaceChildren();
    factsEl.replaceChildren();
    cards = [];
    facts = [];
    deal.forEach((d, i) => {
      const el = document.createElement("button");
      el.className = `card k-${d.key.split(":")[0]}`;
      el.innerHTML = cardHtml(d.motif, seedOf(d.key), d.art, d.small, d.big, i);
      wire(el, d.label, d.run, d.fly);
      el.title = d.label;
      rail.append(el);
      cards.push({ el, label: d.label, run: d.run, fact: false });
    });
    for (const h of hand) {
      const el = document.createElement("button");
      el.className = "card fact";
      el.innerHTML = factHtml(h.id, h.text, h.play ? lead : null);
      wire(el, h.play ? `Play this on ${lead}: ${h.text}` : `${h.text} (nobody here to hear it)`, h.play);
      el.title = h.play ? `Play on ${lead}` : "Nobody here to hear it";
      if (port) {
        rail.append(el);
        cards.push({ el, label: h.text, run: h.play, fact: true });
      } else {
        factsEl.append(el);
        facts.push(el);
      }
    }
    emptySlip.hidden = facts.length > 0 || port;
    emptySlip.textContent = v.busy ? `${v.busy}…` : "Choose your move";
    layoutHand();
    layoutFacts();
  }

  function renderBoard(v: SceneView): void {
    const s = ctx.status(v);
    const b = ctx.box(v);
    const data: BoardData = {
      where: s.where,
      isNew: b.isNew,
      day: s.day,
      time: s.time,
      vigor: s.vigor,
      delve: !!v.delve,
      ...(s.thread ? { thread: { found: s.thread.found.length, total: s.thread.total } } : {}),
      ...(s.supplies ? { supplies: s.supplies } : {}),
      ...(v.delve ? { keys: v.delve.keys } : {}),
    };
    const key = JSON.stringify(data);
    if (key !== sig.board) {
      sig.board = key;
      boardSvg.innerHTML = scoreboard(data, slate, paper);
      thr.hidden = !s.thread;
      if (s.thread) {
        const t = `The thread: ${s.thread.goal}. ${s.thread.found.length} of ${s.thread.total} found.`;
        thr.title = t;
        thr.setAttribute("aria-label", t);
      }
    }
    amap.hidden = !v.delve;
    if (v.delve) {
      const r = amap.getBoundingClientRect();
      const w = Math.max(40, Math.round(r.width || 200));
      const h = Math.max(30, Math.round(r.height || 150));
      if (amap.width !== w || amap.height !== h) {
        amap.width = w;
        amap.height = h;
      }
      ctx.drawAutomap(amap, v.delve, { floor: "rgba(239,234,223,.22)", lit: "rgba(239,234,223,.55)", you: "#ff8a7a" });
    }
  }

  function renderPeople(v: SceneView): void {
    if (!L) return;
    const people = ctx.people(v).slice(0, 5);
    const seats = SEATS[L.port ? "port" : "wide"];
    const arts = people.map((p) => ctx.personArt(v, p.id));
    const key = JSON.stringify([L.W, L.H, people.map((p, i) => [p.id, p.talkable, arts[i]?.url, arts[i]?.cutout]), !!v.delve]);
    if (key === sig.people) return;
    sig.people = key;
    peopleL.replaceChildren();
    tents.replaceChildren();
    if (!people.length && !v.delve) {
      // Nobody here: the chair across from you stays empty.
      const c = document.createElement("div");
      c.className = "chair";
      c.innerHTML = chair();
      const h = L.H * (L.port ? 0.36 : 0.5);
      Object.assign(c.style, { height: `${h}px`, width: `${(h * 240) / 420}px`, left: `${L.SW * 0.5 - (h * 120) / 420}px`, top: `${L.geo.yT - h * 0.82}px` });
      c.firstElementChild?.setAttribute("style", "width:100%;height:100%;overflow:visible");
      peopleL.append(c);
      return;
    }
    people.forEach((p, i) => {
      const seat = seats[i]!;
      const a = arts[i];
      const h = seat.h * L!.H;
      const el = document.createElement("button");
      el.className = `who ${seat.c}`;
      el.style.left = `${seat.x * L!.SW}px`;
      el.style.top = `${seat.b * L!.H - h}px`;
      el.style.height = `${h}px`;
      el.style.zIndex = String(10 - i);
      el.title = `${p.name}, ${p.role}`;
      el.setAttribute("aria-label", p.talkable ? `Talk to ${p.name}, ${p.role}` : `${p.name}, ${p.role}`);
      if (!p.talkable) el.setAttribute("aria-disabled", "true");
      if (a?.cutout) el.innerHTML = `<img src="${esc(a.url)}" alt="" draggable="false">`;
      else el.innerHTML = `<div class="arch">${a ? `<img src="${esc(a.url)}" alt="" draggable="false">` : ""}${shadowbox()}</div>`;
      el.addEventListener("click", () => p.talkable && p.talk());
      el.addEventListener("pointerenter", () => setPeek(p.talkable ? `Talk to ${p.name}` : p.name));
      el.addEventListener("pointerleave", () => setPeek(null));
      peopleL.append(el);
      // A folded name card on the table in front of them.
      const t = document.createElement("button");
      t.className = "tent";
      const tw = L!.port ? L!.W * (i ? 0.2 : 0.26) : L!.H * (i ? 0.11 : 0.14);
      const th = tw * 0.32;
      Object.assign(t.style, { left: `${seat.x * L!.SW}px`, top: `${L!.geo.yT + L!.H * 0.004}px`, width: `${tw}px`, height: `${th}px`, zIndex: String(10 - i) });
      t.innerHTML = `${tentCard()}<span>${esc(p.name)}</span>`;
      t.setAttribute("aria-label", p.talkable ? `Talk to ${p.name}` : p.name);
      t.title = `${p.name}, ${p.role}`;
      if (!p.talkable) t.setAttribute("aria-disabled", "true");
      t.addEventListener("click", () => p.talkable && p.talk());
      if (i < 3) tents.append(t);
    });
  }

  function renderCoins(v: SceneView): void {
    const s = ctx.status(v);
    const key = `${s.coin}|${s.currency}`;
    if (key === sig.coins) return;
    sig.coins = key;
    coinEl.innerHTML = coins(s.coin, s.currency);
    coinEl.setAttribute("aria-label", `${s.coin} ${s.currency}`);
    coinEl.title = `${s.coin} ${s.currency}`;
  }

  function paintRibbon(v: SceneView): void {
    const b = ctx.box(v);
    plq.classList.toggle("peek", !!peek);
    rib.innerHTML = peek ? esc(peek) : `${esc(b.title)}${b.isNew ? `<span class="nw">New</span>` : ""}`;
  }

  function renderPlaque(v: SceneView): void {
    const b = ctx.box(v);
    const story = isWriting(v) ? v.story : [];
    const key = JSON.stringify([b, logOpen, story]);
    paintRibbon(v);
    write.sync(v, ctx.journal.open || ctx.classes.open);
    placePlaque();
    if (key === sig.plaque) return;
    sig.plaque = key;
    const n = b.log.length;
    // Newest last; folded, only the latest two show under the description.
    ptx.innerHTML = `${b.desc ? `<p class="desc">${esc(b.desc)}</p>` : ""}<ol class="log">${b.log.map((l, i) => `<li class="${i === n - 1 ? "now" : i < n - 2 ? "old" : ""}">${esc(l)}</li>`).join("")}</ol>${beatsHtml(story)}${b.busy ? `<p class="busy">${esc(b.busy)}</p>` : ""}`;
    plq.classList.toggle("open", logOpen);
    plq.classList.toggle("story", story.length > 0);
    logTab.setAttribute("aria-expanded", String(logOpen));
    logTab.hidden = n <= 2 && !logOpen;
    if (logOpen || story.length) ptx.scrollTop = ptx.scrollHeight;
  }

  function renderMap(v: SceneView): void {
    const on = !!v.hex && !v.delve;
    mapEl.hidden = !on;
    if (!on) return;
    const key = JSON.stringify([v.hex, v.menu.map((m) => m.id)]);
    if (key === sig.map) return;
    sig.map = key;
    ctx.drawHex(hexSvg, v);
  }

  function renderJournal(v: SceneView): void {
    const open = ctx.journal.open;
    props.ledger.classList.toggle("on", open);
    let book = ul.querySelector<HTMLElement>(".book");
    if (!open || !L) {
      book?.remove();
      sig.journal = "";
      return;
    }
    const s = ctx.status(v);
    const html = ctx.journal.html(v);
    const key = JSON.stringify([html, s.thread, L.W, L.H]);
    if (key === sig.journal && book) return;
    sig.journal = key;
    if (!book) {
      book = document.createElement("div");
      book.className = "book";
      book.setAttribute("role", "dialog");
      book.setAttribute("aria-label", "Journal");
      ul.append(book);
    }
    const bw = L.port ? L.W * 0.96 : Math.min(L.SW * 0.92, L.H * 1.45);
    const bh = L.port ? L.H * 0.8 : Math.min(L.H * 0.84, bw * 0.64);
    Object.assign(book.style, { left: `${(L.SW - bw) / 2}px`, top: `${L.port ? L.H * 0.06 : L.H * 0.04}px`, width: `${bw}px`, height: `${bh}px` });
    // Split the journal's sections across the two pages, the thread first.
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    const sections: string[] = [];
    let cur = "";
    for (const node of [...tmp.childNodes]) {
      if (node.nodeName === "H3" && cur) {
        sections.push(cur);
        cur = "";
      }
      cur += node.nodeType === 1 ? (node as Element).outerHTML : esc(node.textContent ?? "");
    }
    if (cur) sections.push(cur);
    const thread = s.thread
      ? `<h3>The thread</h3><p class="goal">${esc(s.thread.goal)}</p>${s.thread.found.length ? `<ul class="found">${s.thread.found.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<div class="muted">Nothing has come out of it yet.</div>`}<div class="muted">${s.thread.found.length} of ${s.thread.total} found.</div>`
      : "";
    // A phone gets one long page; anything wider gets the two-page spread.
    const half = L.port ? sections.length : Math.ceil(sections.length / 2);
    book.innerHTML = `${openBook(tex.leather, tex.page, L.port)}<div class="pg l"><h2>${esc(s.card || "Ledger")}</h2>${thread}${sections.slice(0, half).join("")}</div>${L.port ? "" : `<div class="pg r">${sections.slice(half).join("")}</div>`}<button class="shut" aria-label="Close the ledger">Close ledger</button>`;
    book.querySelector(".shut")!.addEventListener("click", () => ctx.journal.toggle());
  }

  function renderTags(v: SceneView): void {
    tags.hidden = !themesOpen;
    props.gavel.classList.toggle("on", themesOpen);
    props.gavel.setAttribute("aria-expanded", String(themesOpen));
    if (!themesOpen || !L) {
      tags.replaceChildren();
      return;
    }
    const g3 = x3 && t3 ? t3.screenOf("gavel", L.W, L.H, 0.05) : null;
    const g = g3 ? { x: g3.x - L.SL - L.H * 0.05, y: g3.y, w: L.H * 0.1, h: 0 } : spot("gavel")!;
    const tw = L.port ? L.W * 0.4 : L.H * 0.19;
    const th = tw * 0.32;
    tags.style.setProperty("--tw", `${tw}px`);
    tags.style.setProperty("--th", `${th}px`);
    tags.replaceChildren(
      ...ctx.themes.map((t, i) => {
        const b = document.createElement("button");
        b.innerHTML = `${ironTag(seedOf(t.id))}<span>${esc(t.label)}</span>`;
        b.setAttribute("aria-current", String(t.id === v.theme));
        b.setAttribute("aria-label", `Switch to the ${t.label} theme`);
        const x = Math.min(L!.SW - tw - 6, g.x + g.w * 0.5 - tw * 0.5 - i * th * 0.18);
        const y = g.y - (i + 1) * th * 1.12;
        b.style.setProperty("--x", `${x}px`);
        b.style.setProperty("--y", `${y}px`);
        b.style.setProperty("--r", `${-5 + ((i * 37) % 9) - 4}deg`);
        b.style.setProperty("--ox", `${g.x}px`);
        b.style.setProperty("--oy", `${g.y}px`);
        b.style.setProperty("--d", `${i * 40}ms`);
        b.addEventListener("click", () => {
          themesOpen = false;
          if (t.id !== v.theme) ctx.setTheme(t.id);
          else renderTags(v);
        });
        return b;
      }),
    );
    (tags.querySelector('[aria-current="true"]') as HTMLElement | null)?.focus();
  }

  /* ------------------------------ Render ------------------------------ */

  function render(v: SceneView): void {
    view = v;
    if (!L) layout();
    // A real 3D table whenever there is WebGL (in a delve it stands in a stone chamber
    // with the passage opening behind it); the drawn 2D table without WebGL.
    const want3d = ctx.has3d;
    if (want3d) {
      // In a delve the host's backdrop() would raise its own corridor; the table builds
      // its passage inside its own stage instead, so it only asks for the stage there.
      if (!v.delve) ctx.backdrop(v, { post: "none", custom: true });
      const st = ctx.stage3d();
      if (st && (!t3 || t3.stale(st))) {
        t3?.dispose();
        t3 = new Table3D(st, ctx.reducedMotion);
        t3.onReady = () => (plqKey = "");
        st.setUpdate(frame3d);
        stage = st;
        if (L) t3.layout(L.W, L.H);
      }
    } else ctx.backdrop(v, { post: "none", dolly: 0.2 });
    const was = x3;
    x3 = want3d && !!t3;
    tb.classList.toggle("x3", x3);
    t3l.hidden = !x3;
    if (was !== x3) {
      plqKey = "";
      placePlaque();
    }
    if (x3 && t3) render3d(v, t3);
    tb.classList.toggle("busy", !!v.busy);
    tb.classList.toggle("delve", !!v.delve);
    props.deck.classList.toggle("on", ctx.classes.open);
    renderBoard(v);
    renderPeople(v);
    renderCoins(v);
    renderMap(v);
    renderHand(v);
    renderPlaque(v);
    renderJournal(v);
    renderTags(v);
    if (!facts.length) emptySlip.textContent = peek ?? (v.busy ? `${v.busy}…` : "Choose your move");
  }

  /* ------------------------------ 3D table ----------------------------- */

  /** What each thing in the room does, and what it says when you point at it. */
  function act3d(id: PickId, v: SceneView): { label: string; run: (() => void) | null } {
    const item = (kind: string) => ctx.menu(v).find((m) => m.kind === kind) ?? null;
    if (id.startsWith("person:")) {
      const p = ctx.people(v).find((x) => `person:${x.id}` === id);
      return { label: p ? (p.talkable ? `Talk to ${p.name}` : p.name) : "", run: p?.talkable ? p.talk : null };
    }
    switch (id) {
      case "ledger":
        return { label: "Ledger: your journal", run: () => zoomOpen("ledger", "journal", () => !ctx.journal.open && ctx.journal.toggle()) };
      case "deck":
        return { label: "The deck case: your classes", run: () => zoomOpen("deck", "classes", () => !ctx.classes.open && ctx.classes.toggle()) };
      case "gavel":
        return {
          label: "The gavel: change the table",
          run: () =>
            zoomOpen("gavel", "tags", () => {
              themesOpen = true;
              if (view) renderTags(view);
            }),
        };
      case "bell": {
        const w = item("wait");
        return {
          label: w ? "Ring the bell: wait a while" : "A brass bell",
          run: () => {
            t3?.ringBell();
            w?.run();
          },
        };
      }
      case "skull":
      case "coins":
      case "board": {
        const s = ctx.status(v);
        return { label: id === "skull" ? "The skull candle" : id === "coins" ? `${s.coin} ${s.currency}` : "The scoreboard", run: () => zoomOpen(id, "peek", () => view && showPeek(id, view)) };
      }
    }
    return { label: "", run: null };
  }

  function zoomOpen(id: PickId, what: NonNullable<typeof opened>, then: () => void): void {
    closeAll(false);
    opened = what;
    setPeek(null);
    if (t3) t3.zoomTo(id, then);
    else then();
  }

  /** Back to your seat: close what the zoom opened and glide out. */
  function closeAll(zoomOut = true): void {
    if (opened === "journal" && ctx.journal.open) ctx.journal.toggle();
    if (opened === "classes" && ctx.classes.open) ctx.classes.toggle();
    if (opened === "tags" && themesOpen) {
      themesOpen = false;
      if (view) renderTags(view);
    }
    peekEl.hidden = true;
    opened = null;
    if (zoomOut) t3?.zoomTo(null);
  }

  /** The info and choices of a thing you zoomed in to. */
  function showPeek(id: PickId, v: SceneView): void {
    const s = ctx.status(v);
    const menu = ctx.menu(v);
    const choice = (kind: string) => menu.find((m) => m.kind === kind) ?? null;
    let title = "";
    let body = "";
    const acts: MenuItem[] = [];
    if (id === "skull") {
      title = "The skull candle";
      body = esc("Two stubs of wax burning down in an old crown of bone. It is the only light you trust here.");
      const r = choice("rest");
      if (r) acts.push(r);
    } else if (id === "coins") {
      title = `${s.coin} ${s.currency}`;
      body = esc("Your purse, stacked where everyone at the table can count it.");
      const sh = choice("shop");
      if (sh) acts.push(sh);
    } else {
      title = s.where;
      body = esc(`Day ${s.day}, ${s.time}. Vigor ${Math.round(s.vigor * 100)}%.${s.supplies ? ` Supplies ${s.supplies.now} of ${s.supplies.max}.` : ""}`);
      if (s.thread) body += `<br><br><b>The thread:</b> ${esc(s.thread.goal)}<br>${s.thread.found.length} of ${s.thread.total} found${s.thread.found.length ? `: ${s.thread.found.map(esc).join("; ")}` : "."}`;
    }
    peekEl.innerHTML = `${plaque(stone, 23)}<div class="pk"><h3>${esc(title)}</h3><p>${body}</p><div class="pa">${acts.map((a, i) => `<button class="pkb" data-i="${i}">${esc(a.label)}</button>`).join("")}<button class="pkx">Back to your seat</button></div></div>`;
    peekEl.querySelectorAll<HTMLButtonElement>(".pkb").forEach((b) =>
      b.addEventListener("click", () => {
        const a = acts[Number(b.dataset.i)];
        closeAll();
        a?.run();
      }),
    );
    peekEl.querySelector(".pkx")!.addEventListener("click", () => closeAll());
    peekEl.hidden = false;
    peekEl.querySelector<HTMLButtonElement>(".pkb, .pkx")?.focus({ preventScroll: true });
  }

  /** Keyboard and touch reach every 3D thing through these tags, anchored to it each frame. */
  let tagSig = "";
  const tag3: { id: PickId; el: HTMLButtonElement; dy: number; last: string }[] = [];
  const map3 = document.createElement("canvas");
  let map3Key = "";
  function renderTags3d(v: SceneView): void {
    const people = ctx.people(v).slice(0, 3);
    const ids: [PickId, string, string, number][] = [
      ...people.map((p): [PickId, string, string, number] => [`person:${p.id}`, p.name, "who3", 0.06]),
      ["ledger", "Ledger", "", 0.012],
      ["deck", "Classes", "", 0.012],
      ["gavel", "Theme", "", 0.012],
      ["bell", "Bell", "dim", 0.012],
      ["coins", ctx.status(v).currency, "dim", 0.012],
      ["skull", "Candle", "dim", 0.01],
      ["board", "Board", "dim", 0.01],
    ];
    const acts = ids.map(([id]) => act3d(id, v).label);
    const key = JSON.stringify([ids, acts]);
    if (key === tagSig) return;
    tagSig = key;
    t3l.replaceChildren();
    tag3.length = 0;
    for (const [id, label, cls, dy] of ids) {
      const b = document.createElement("button");
      b.className = `tag3 ${cls}`;
      b.dataset.pick = id;
      b.dataset.short = label;
      // No labels hang in the air: the tag only shows (as what clicking will do) while you point at it.
      b.textContent = act3d(id, v).label || label;
      b.setAttribute("aria-label", act3d(id, v).label || label);
      b.addEventListener("click", () => view && act3d(id, view).run?.());
      b.addEventListener("focus", () => {
        t3?.setHover(id);
        if (view) setPeek(act3d(id, view).label);
      });
      b.addEventListener("blur", () => {
        t3?.setHover(null);
        setPeek(null);
      });
      t3l.append(b);
      tag3.push({ id, el: b, dy, last: "" });
    }
  }

  function render3d(v: SceneView, t: Table3D): void {
    const s = ctx.status(v);
    const b = ctx.box(v);
    void t.setBackdrop(ctx.placeArt(v));
    let map: { canvas: HTMLCanvasElement; key: string } | undefined;
    if (v.delve) {
      const d = v.delve;
      const mk = JSON.stringify([d.grid, d.x, d.y, d.facing]);
      if (mk !== map3Key) {
        map3Key = mk;
        map3.width = 500;
        map3.height = 300;
        ctx.drawAutomap(map3, d, { floor: "rgba(242,239,233,.32)", lit: "#f2efe9", you: "#e63946" });
      }
      map = { canvas: map3, key: mk };
    }
    t.setBoard({ where: s.where, isNew: b.isNew, day: s.day, time: s.time, vigor: s.vigor, ...(s.thread ? { thread: { found: s.thread.found.length, total: s.thread.total } } : {}), ...(s.supplies ? { supplies: s.supplies } : {}), ...(map ? { map } : {}) }, fontsReady);
    t.setCorridor(v.delve ? { view: v.delve.view, wall: ctx.art(v.delve.textures.wall), floor: ctx.art(v.delve.textures.floor) } : null);
    t.setCoins(s.coin, fontsReady, s.currency);
    t.setPeople(ctx.people(v).map((p) => ({ id: p.id, name: p.name, talkable: p.talkable, art: ctx.personArt(v, p.id) })), fontsReady);
    t.setBusy(!!v.busy);
    renderTags3d(v);
    // Whatever the zoom opened was closed some other way: glide back to your seat.
    if ((opened === "journal" && !ctx.journal.open) || (opened === "classes" && !ctx.classes.open) || (opened === "tags" && !themesOpen)) {
      opened = null;
      t.zoomTo(null);
    }
  }

  /** Every frame of the 3D layer: camera, flicker, and the DOM anchored to it. */
  function frame3d(time: number, dt: number): void {
    if (!t3 || !L || !x3) return;
    t3.frame(time, dt, ctx.reducedMotion ? { x: 0, y: 0 } : ctx.pointer());
    for (const g of tag3) {
      const p = t3.screenOf(g.id, L.W, L.H, g.dy);
      if (!p) continue;
      const k = p.on ? `${Math.round(p.x)},${Math.round(p.y)}` : "off";
      if (k === g.last) continue;
      g.last = k;
      const up = g.id.startsWith("person:") ? "0" : "-100%";
      g.el.style.transform = `translate(${p.x.toFixed(0)}px, ${p.y.toFixed(0)}px) translate(-50%, ${up})`;
      g.el.style.visibility = p.on ? "" : "hidden";
    }
    tb.classList.toggle("zoomed", !!t3.zoomed);
    // An open book or class panel owns the screen: the room's labels step back.
    const covered = ctx.journal.open || ctx.classes.open;
    if (t3l.hidden !== covered) t3l.hidden = covered;
    if (!t3.zoomed) placePlaque();
    if (themesOpen && opened === "tags" && view) {
      const g = t3.screenOf("gavel", L.W, L.H, 0.1);
      const k = g ? `${Math.round(g.x)},${Math.round(g.y)}` : "";
      if (g && k !== tags.dataset.at) {
        tags.dataset.at = k;
        renderTags(view);
      }
    }
  }

  function litTag(id: PickId | null): void {
    for (const g of tag3) g.el.classList.toggle("on", g.id === id && !g.id.startsWith("person:"));
  }

  // Pointing and clicking in the room: anything not on a DOM control is a 3D pick.
  const CONTROLS = "button, a, input, textarea, select, .card, .plaque, .tw, .book, .tags, .peek, .map, .fgh, [role=button], [tabindex]";
  let lastPick = 0;
  root.addEventListener("pointermove", (e) => {
    if (!x3 || !t3 || !view || enc) return;
    const el = e.target as Element;
    const tag = el.closest<HTMLElement>("[data-pick]");
    if (tag) {
      t3.setHover(tag.dataset.pick as PickId);
      litTag(tag.dataset.pick as PickId);
      return;
    }
    if (el.closest(CONTROLS)) {
      t3.setHover(null);
      litTag(null);
      return;
    }
    const now = performance.now();
    if (now - lastPick < 45) return;
    lastPick = now;
    const id = t3.pick(e.clientX, e.clientY);
    t3.setHover(id);
    litTag(id);
    tb.classList.toggle("pointing", !!id);
    const lab = id ? act3d(id, view).label : null;
    if (lab !== peek) setPeek(lab);
  });
  root.addEventListener("click", (e) => {
    if (!x3 || !t3 || !view || enc) return;
    if ((e.target as Element).closest(CONTROLS)) return;
    const id = t3.pick(e.clientX, e.clientY);
    if (id) act3d(id, view).run?.();
    else if (t3.zoomed || opened) closeAll();
  });

  /* ------------------------------ Wiring ------------------------------ */

  props.ledger.addEventListener("click", () => ctx.journal.toggle());
  props.deck.addEventListener("click", () => ctx.classes.toggle());
  props.gavel.addEventListener("click", () => {
    themesOpen = !themesOpen;
    if (view) renderTags(view);
  });
  logTab.addEventListener("click", () => {
    logOpen = !logOpen;
    sig.plaque = "";
    layout();
  });
  // Clicking the table itself folds away the theme tags.
  root.addEventListener("pointerdown", (e) => {
    if (themesOpen && !(e.target as Element).closest(".tags, .gavel")) {
      themesOpen = false;
      if (view) renderTags(view);
    }
  });

  const ro = new ResizeObserver(() => layout());
  ro.observe(root);

  // Parallax and candle flicker: transforms and opacity only.
  const last = new Map<HTMLElement, string>();
  const move = (el: HTMLElement, x: number, y: number) => {
    const t = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    if (last.get(el) !== t) {
      el.style.transform = t;
      last.set(el, t);
    }
  };
  let flick = 0;
  const stop = ctx.onFrame((t) => {
    if (!L) return;
    const k = L.H / 1080;
    const p = ctx.reducedMotion ? { x: 0, y: 0 } : ctx.pointer();
    // In 3D the camera leans instead; only your cards and your own hand drift.
    if (x3) {
      move(layers.world, 0, 0);
      move(layers.hand, -p.x * DEPTH.hand[0] * k * (L.port ? 0 : 0.6), -p.y * DEPTH.hand[1] * k * (L.port ? 0 : 0.6));
      move(layers.fg, -p.x * DEPTH.fg[0] * k, -p.y * DEPTH.fg[1] * k);
      return;
    }
    move(layers.world, -p.x * DEPTH.world[0] * k, -p.y * DEPTH.world[1] * k);
    move(layers.board, -p.x * DEPTH.board[0] * k, -p.y * DEPTH.board[1] * k);
    move(layers.people, -p.x * DEPTH.people[0] * k, -p.y * DEPTH.people[1] * k);
    for (const el of layers.table) move(el, -p.x * DEPTH.table[0] * k, -p.y * DEPTH.table[1] * k);
    move(layers.hand, -p.x * DEPTH.hand[0] * k * (L.port ? 0 : 1), -p.y * DEPTH.hand[1] * k * (L.port ? 0 : 1));
    move(layers.fg, -p.x * DEPTH.fg[0] * k, -p.y * DEPTH.fg[1] * k);
    if (ctx.reducedMotion || t - flick < 90) return;
    flick = t;
    const s = t / 1000;
    const f = 0.86 + 0.07 * Math.sin(s * 7.3) + 0.05 * Math.sin(s * 13.7 + 1.3) + (Math.random() - 0.5) * 0.08;
    glowA.style.opacity = f.toFixed(3);
    glowA.style.transform = `scale(${(0.96 + f * 0.05).toFixed(3)})`;
    glowB.style.opacity = (0.75 + (f - 0.86) * 1.4).toFixed(3);
  });

  return {
    boardSkin: BOARD_SKINS.table,
    render,
    encounter(e) {
      if (!e) {
        if (enc) {
          enc = null;
          duel.staged = null;
          tb.classList.remove("enc", "enc-battle", "enc-parley");
          t3?.setEncounter(null);
          if (view) render(view);
        }
        return true;
      }
      // Only the real room can hold it; the drawn 2D table hands the encounter its own backdrop.
      if (!x3 || !t3) return false;
      closeAll();
      setPeek(null);
      enc = e.kind;
      duel.staged = e.kind;
      duel.slate = null;
      duel.patience = null;
      tb.classList.remove("enc-battle", "enc-parley");
      tb.classList.add("enc", `enc-${e.kind}`);
      t3.setEncounter(e.kind);
      return true;
    },
    key(e) {
      if (enc) return false;
      if (e.key === "Escape") {
        if (x3 && (t3?.zoomed || opened)) {
          closeAll();
          return true;
        }
        if (themesOpen) {
          themesOpen = false;
          if (view) renderTags(view);
          return true;
        }
        if (ctx.journal.open) {
          ctx.journal.toggle();
          return true;
        }
        return false;
      }
      if (/^[1-9]$/.test(e.key) && !e.shiftKey) {
        const c = cards[Number(e.key) - 1];
        if (c?.run) {
          c.el.click();
          return true;
        }
      }
      if (e.key === "j" || e.key === "J") {
        ctx.journal.toggle();
        return true;
      }
      return false;
    },
    destroy() {
      if (enc) duel.staged = null;
      stop();
      ro.disconnect();
      // The host drops the custom stage (and our frame hook) when the next theme takes the layer.
      stage?.setUpdate(null);
      t3?.dispose();
      t3 = null;
    },
  };
};
