/**
 * The Command theme: a 1980s home-computer crawler on a CRT on a desk.
 *
 * Inside the tube everything sits on a fixed character grid (48 x 32 cells
 * of 8 x 8 virtual pixels on a wide window, 24-ish columns on a phone) in
 * the EGA palette: a royal blue chassis with black windows cut into it,
 * each rimmed by double white rules that end in chevron caps around inline
 * labels. Left: the first-person viewport (the place art posterised and
 * Bayer-dithered to the palette at the grid's own resolution, or a raycast
 * brick corridor in a delve), with whoever is here docked along its bottom
 * in framed encounter boxes. Right: the roster (one row each, the talk key
 * right-aligned), the automap / overland when there is one, a packed
 * two-row status block, and one scrolling terminal where the log, the
 * narration, the numbered commands and the blinking prompt live together.
 *
 * Around the tube (on a wide window) is the physical object: the monitor's
 * moulded housing with its bezel keys (Journal, Classes, Disks, Colour), a
 * disk file box whose floppies switch themes, the external drive whose lamp
 * is the busy light, a taped quick-reference card and a desk lamp, all on a
 * walnut desk in a dark room lit by the screen.
 *
 * On a phone (geo.phone, either way up) there is no tube: the picture with one label line, a blue status band and
 * the terminal, flat and unframed, its commands rows a thumb can hit and the whole of it scrolling by touch.
 */
import { BOARD_SKINS } from "../board-skins.js";
import { esc, type MenuItem, type PersonView, type SceneView, type ThemeCtx, type ThemeFactory, type ThemeRenderer } from "./contract.js";
import { drawCorridor } from "./command/corridor.js";
import { canvas, coverDraw, cursorUrl, ditherToPalette, frameSvg, loadImage, PALETTE_LABEL, PALETTES, registerOf, scanTile, type PaletteId, type Rgb } from "./command/pixels.js";
import { diskBoxSvg, driveSvg, drawRoom, floppySvg, lampSvg, monitorSvg, refCardSvg } from "./command/props.js";
import { commandCss } from "./command/style.js";
import { beatsHtml, canWrite, isWriting, wireWrite, writeFormHtml } from "./write.js";

/* --------------------------------- Grid --------------------------------- */

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where everything is, in screen pixels and in cells. */
interface Geo {
  tall: boolean;
  /** A phone in either orientation (the same test as Parley's .pl-phone). */
  phone: boolean;
  W: number;
  H: number;
  /** One cell, in screen pixels (a multiple of 8 when it can be: crisp 8x8 glyphs). */
  c: number;
  cols: number;
  rows: number;
  /** The glass (screen) inside the root, and the grid's offset in it. */
  glass: Rect;
  ox: number;
  oy: number;
  /** The monitor housing (wide only), its recessed well and side plastic. */
  mon: Rect | null;
  well: number;
  side: number;
}

const WIDE_COLS = 48;
const WIDE_ROWS = 30;
const VP_COLS = 27;
/** Bezel sizes in cells: plastic at the sides, top and chin, and the recessed well inside it. */
const BEZ = { s: 2, t: 1, b: 2.6, well: 0.75 };

function computeGeo(W: number, H: number): Geo {
  const phone = W <= 760 || H <= 480;
  const tall = phone || W < 720 || W / Math.max(1, H) < 0.95;
  if (phone) {
    const c = W >= 600 && H > 480 ? 24 : W >= 352 ? 16 : 12;
    const cols = Math.floor(W / c);
    const rows = Math.floor(H / c);
    return { tall, phone, W, H, c, cols, rows, glass: { x: 0, y: 0, w: W, h: H }, ox: Math.floor((W - cols * c) / 2), oy: Math.floor((H - rows * c) / 2), mon: null, well: 0, side: 0 };
  }
  if (tall) {
    const c = W >= 600 ? 24 : W >= 352 ? 16 : 12;
    const cols = Math.max(20, Math.floor((W - 4) / c));
    const rows = Math.max(30, Math.floor((H - 4) / c));
    return { tall, phone, W, H, c, cols, rows, glass: { x: 0, y: 0, w: W, h: H }, ox: Math.max(0, Math.floor((W - cols * c) / 2)), oy: Math.max(0, Math.floor((H - rows * c) / 2)), mon: null, well: 0, side: 0 };
  }
  const cols = WIDE_COLS;
  const rows = WIDE_ROWS;
  // One whole cell of overscan all round: nothing live sits under the tube's dark edge.
  const fits = (c: number) => (rows + 2) * c + c * (BEZ.t + BEZ.b + 2 * BEZ.well) <= H * 0.985 && (cols + 2) * c + 2 * (BEZ.s + BEZ.well) * c <= W * 0.97;
  let c = 0;
  for (let k = 64; k >= 16; k -= 8) {
    if (fits(k)) {
      c = k;
      break;
    }
  }
  if (!c) c = Math.max(8, Math.floor(Math.min((H * 0.985) / (rows + 2 + BEZ.t + BEZ.b + 2 * BEZ.well), (W * 0.97) / (cols + 2 + 2 * (BEZ.s + BEZ.well)))));
  const gw = (cols + 2) * c;
  const gh = (rows + 2) * c;
  const well = Math.round(BEZ.well * c);
  const s = Math.round(BEZ.s * c);
  // Spare height goes into a deeper brow and chin, so the set fills the window.
  const spare = Math.max(0, H * 0.985 - (gh + 2 * well + (BEZ.t + BEZ.b) * c));
  const t = Math.round(BEZ.t * c + Math.min(spare * 0.35, c * 1.4));
  const b = Math.round(BEZ.b * c + Math.min(spare * 0.65, c * 2.2));
  const mw = gw + 2 * (s + well);
  const mh = gh + 2 * well + t + b;
  const mon = { x: Math.round((W - mw) / 2), y: Math.max(0, Math.round(H - mh - H * 0.012)), w: mw, h: mh };
  return { tall, phone, W, H, c, cols, rows, glass: { x: mon.x + s + well, y: mon.y + t + well, w: gw, h: gh }, ox: c, oy: c, mon, well, side: s };
}

/** Truncate to n cells. */
const fit = (s: string, n: number): string => (n <= 0 ? "" : s.length <= n ? s : n <= 1 ? s.slice(0, n) : `${s.slice(0, n - 1)}.`);
/** The key that picks menu item i. */
const keyOf = (i: number): string => (i < 9 ? String(i + 1) : i === 9 ? "0" : "");
const TIME_SHORT: Record<string, string> = { dawn: "Dawn", morning: "Morning", noon: "Noon", afternoon: "Afternoon", evening: "Evening", dusk: "Dusk", night: "Night", midnight: "Midnight" };
const DIRS = ["North", "East", "South", "West"];
const PAL_ORDER: PaletteId[] = ["ega", "cga", "mono"];
const BLUE = "#0000AA";

/* -------------------------------- Theme --------------------------------- */

export const command: ThemeFactory = (ctx: ThemeCtx): ThemeRenderer => {
  const root = ctx.root;
  const gs = root.parentElement as HTMLElement | null;
  let pal: PaletteId = (() => {
    try {
      const p = localStorage.getItem("gambit.command.palette") as PaletteId | null;
      return p && PAL_ORDER.includes(p) ? p : "ega";
    } catch {
      return "ega";
    }
  })();

  root.innerHTML = `<style>${commandCss()}</style>
  <div class="cmd">
    <svg class="defs" aria-hidden="true"><defs>
      ${hxPattern("cmdHxPlain", "#00AA00", "#55FF55")}${hxPattern("cmdHxWood", "#000000", "#00AA00")}${hxPattern("cmdHxHill", "#AA5500", "#555555")}${hxPattern("cmdHxWater", "#0000AA", "#5555FF")}${hxPattern("cmdHxRuin", "#555555", "#AAAAAA")}
      <linearGradient id="cmdCap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4e55"/><stop offset=".5" stop-color="#2c2f34"/><stop offset="1" stop-color="#1b1d21"/></linearGradient>
    </defs></svg>
    <canvas class="room"></canvas>
    <div class="prop lamp"></div>
    <div class="mon">
      <div class="glass">
        <div class="scr"><div class="grid"></div></div>
        <svg class="defs" aria-hidden="true"><filter id="cmdBarrel" x="0" y="0" width="1" height="1" filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feImage class="bmap" x="0" y="0" preserveAspectRatio="none" result="m"/><feDisplacementMap in="SourceGraphic" in2="m" scale="31.875" xChannelSelector="R" yChannelSelector="G"/></filter></svg>
        <div class="crt scan"></div><div class="crt vig"></div><div class="crt refl"></div>
      </div>
      <div class="housing-host"></div>
      <div class="keys"></div>
    </div>
    <div class="prop card"></div>
    <div class="prop drive"></div>
    <div class="prop dbox"></div>
    <div class="worldhold"></div>
  </div>`;
  const $ = <T extends Element = HTMLElement>(sel: string, el: ParentNode = root) => el.querySelector(sel) as T;
  const cmd = $(".cmd");
  const roomCv = $<HTMLCanvasElement>(".room");
  const mon = $(".mon");
  const glassEl = $(".glass");
  const grid = $(".grid");
  const keys = $(".keys");
  const housingHost = $(".housing-host");
  const dbox = $(".dbox");
  const drive = $(".drive");
  const card = $(".card");
  const lamp = $(".lamp");
  const refl = $(".crt.refl");
  // The theme draws the place and the corridor itself (backdrop "none"), so the world element sits in a
  // tiny hidden holder: in the DOM as the contract asks, but costing the WebGL layer almost nothing.
  $(".worldhold").append(ctx.world);

  /* ------------------------------ Windows ------------------------------- */

  interface Win {
    el: HTMLDivElement;
    body: HTMLDivElement;
    rect: Rect | null;
    frameKey: string;
    top: HTMLDivElement;
    bottom: HTMLDivElement;
  }
  function makeWin(cls: string): Win {
    const el = document.createElement("div");
    el.className = `w ${cls}`;
    const body = document.createElement("div");
    body.className = "body";
    const top = document.createElement("div");
    top.className = "notch";
    const bottom = document.createElement("div");
    bottom.className = "notch";
    el.append(body, top, bottom);
    grid.append(el);
    return { el, body, rect: null, frameKey: "", top, bottom };
  }
  /** Place a window on the grid, with labels set into its top and bottom rules. */
  function setWin(win: Win, r: Rect | null, top = "", bottom = "", topHtml?: string): void {
    win.el.style.display = r ? "" : "none";
    win.rect = r;
    if (!r) return;
    const c = geo.c;
    Object.assign(win.el.style, { left: `${r.x * c}px`, top: `${r.y * c}px`, width: `${r.w * c}px`, height: `${r.h * c}px` });
    const t = fit(top, geo.phone ? r.w : r.w - 6);
    const b = fit(bottom, geo.phone ? r.w : r.w - 6);
    const key = `${r.w}x${r.h}|${t.length}|${b.length}`;
    if (key !== win.frameKey) {
      win.frameKey = key;
      win.el.querySelector(":scope > .fr")?.remove();
      win.el.insertAdjacentHTML("afterbegin", frameSvg(r.w, r.h, { top: t.length || undefined, bottom: b.length || undefined, fill: true }));
    }
    const place = (n: HTMLDivElement, text: string, row: number, html?: string) => {
      n.style.display = text ? "" : "none";
      if (!text) return;
      const tx = Math.floor((r.w - text.length) / 2);
      Object.assign(n.style, { left: `${tx * c}px`, top: `${row * c}px`, width: `${text.length * c}px` });
      setHtml(n, html ?? esc(text));
    };
    place(win.top, t, 0, t === top ? topHtml : undefined);
    place(win.bottom, b, r.h - 1);
  }

  const html = new WeakMap<Element, string>();
  function setHtml(el: Element, s: string): boolean {
    if (html.get(el) === s) return false;
    html.set(el, s);
    el.innerHTML = s;
    return true;
  }

  const vp = makeWin("vp");
  const ros = makeWin("ros");
  const map = makeWin("map");
  const st = makeWin("st");
  const term = makeWin("term");
  vp.body.remove();
  vp.el.insertAdjacentHTML("beforeend", `<div class="art"><canvas class="place"></canvas></div><div class="enc"></div><div class="focusbox"></div><div class="jr"><div class="in"></div></div>`);
  const artBox = $(".art", vp.el);
  const artCv = $<HTMLCanvasElement>("canvas.place", vp.el);
  const enc = $(".enc", vp.el);
  const focusBox = $(".focusbox", vp.el);
  const jr = $(".jr", vp.el);
  const jrIn = $(".in", jr);
  const jclose = document.createElement("button");
  jclose.className = "jclose";
  jclose.dataset.a = "jr";
  jclose.setAttribute("aria-label", "Close the journal");
  vp.el.append(jclose);
  term.body.innerHTML = `<div class="tx" role="log" aria-live="polite"><div class="in"></div></div><div class="scrollmark up" style="top:0">^</div><div class="scrollmark dn" style="bottom:0">v</div>${writeFormHtml("wr", "Go")}`;
  const tx = $(".tx", term.body);
  const txIn = $(".in", tx);
  const upMark = $(".scrollmark.up", term.body);
  const dnMark = $(".scrollmark.dn", term.body);
  // The commands are its letters and digits, so the line you write is a row of its own, always in sight under the scroll.
  const write = wireWrite(ctx, $<HTMLFormElement>("form.wr", term.body), {
    maxRows: 6,
    onGrow: (px) => {
      tx.style.bottom = `${px}px`;
      dnMark.style.bottom = `${px}px`;
    },
  });
  let seenStory = "";
  map.body.innerHTML = `<canvas class="auto"></canvas><svg class="hex" role="group" aria-label="Overland map"></svg>`;
  const autoCv = $<HTMLCanvasElement>("canvas.auto", map.body);
  const hexSvg = $<SVGSVGElement>("svg.hex", map.body);

  /* ------------------------------ State --------------------------------- */

  let geo = computeGeo(Math.max(1, root.clientWidth), Math.max(1, root.clientHeight));
  let last: SceneView | null = null;
  let items: MenuItem[] = [];
  let people: PersonView[] = [];
  let diskMenu = false;
  let focusId: string | null = null;
  let destroyed = false;
  let layoutKey = "";
  let roomKey = "";
  let followTerm = true;
  const ARTM = 4; // parallax margin around the place art, virtual pixels

  /* ----------------------------- Art cache ------------------------------ */

  const pics = new Map<string, HTMLCanvasElement | null>();
  /** A dithered picture, built once per key; null while it is being made (render runs again when it lands). */
  function pic(key: string, make: () => Promise<HTMLCanvasElement>): HTMLCanvasElement | null {
    if (pics.has(key)) return pics.get(key)!;
    pics.set(key, null);
    make()
      .then((c) => {
        pics.set(key, c);
        if (!destroyed) ctx.rerender();
      })
      .catch(() => {
        // Unreadable art: a black square, never a stuck "loading".
        pics.set(key, canvas(8, 8));
      });
    return null;
  }
  const look = () => (pal === "mono" ? { contrast: 1.4, saturation: 1, lift: 4 } : pal === "cga" ? { contrast: 1.3, saturation: 1.6, lift: 6 } : { contrast: 1.35, saturation: 1.2, lift: 4, spread: 64 });

  /** The place painting at w x h virtual pixels on the palette. */
  /** The scene's register: the handful of inks this place leans on; its people are drawn from the same set. */
  const regs = new Map<string, Promise<Rgb[]>>();
  function registerFor(url: string | null): Promise<Rgb[]> {
    if (!url || pal !== "ega") return Promise.resolve(PALETTES[pal]);
    const key = `${url}|${pal}`;
    let r = regs.get(key);
    if (!r) {
      r = loadImage(url)
        .then((im) => registerOf(im, PALETTES[pal], look(), 6))
        .catch(() => PALETTES[pal]);
      regs.set(key, r);
    }
    return r;
  }

  function placePic(url: string, w: number, h: number): HTMLCanvasElement | null {
    return pic(`place|${url}|${w}x${h}|${pal}`, async () => {
      const im = await loadImage(url);
      const reg = await registerFor(url);
      const c = canvas(w, h);
      const g = c.getContext("2d", { willReadFrequently: true })!;
      g.imageSmoothingQuality = "high";
      coverDraw(g, im, im.naturalWidth, im.naturalHeight, w, h, 0.5, 0.55);
      const d = g.getImageData(0, 0, w, h);
      ditherToPalette(d, reg, look());
      g.putImageData(d, 0, 0);
      return c;
    });
  }

  /** A head-and-shoulders crop of someone on black, dithered with the scene's register (`bg` is the place art it comes from). */
  function portraitPic(url: string, cutout: boolean, bg: string | null, w: number, h: number): HTMLCanvasElement | null {
    return pic(`face|${url}|${cutout}|${bg}|${w}x${h}|${pal}`, async () => {
      const im = await loadImage(url);
      const iw = im.naturalWidth;
      const ih = im.naturalHeight;
      let sx = 0, sy = 0, sw = iw, sh = ih;
      if (cutout) {
        // Find the figure and its head: the opaque box, and the middle of its top rows.
        const ah = 160;
        const aw = Math.max(1, Math.round((iw / ih) * ah));
        const a = canvas(aw, ah);
        const ag = a.getContext("2d", { willReadFrequently: true })!;
        ag.drawImage(im, 0, 0, aw, ah);
        const px = ag.getImageData(0, 0, aw, ah).data;
        let x0 = aw, x1 = 0, y0 = ah, y1 = 0;
        for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) if (px[(y * aw + x) * 4 + 3]! > 100) {
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
        if (x1 <= x0) [x0, x1, y0, y1] = [0, aw - 1, 0, ah - 1];
        let hx = 0, hn = 0;
        const band = y0 + Math.max(2, (y1 - y0) * 0.12);
        for (let y = y0; y < band; y++) for (let x = x0; x <= x1; x++) if (px[(y * aw + x) * 4 + 3]! > 100) {
          hx += x;
          hn++;
        }
        const headX = hn ? hx / hn : (x0 + x1) / 2;
        const k = ih / ah;
        const tallness = (y1 - y0) / Math.max(1, x1 - x0);
        sh = (y1 - y0) * (tallness > 2 ? 0.44 : tallness > 1.4 ? 0.62 : 0.85) * k;
        sw = (sh * w) / h;
        sx = headX * k - sw / 2;
        sy = y0 * k - sh * 0.04;
      } else {
        sw = iw;
        sh = (sw * h) / w;
        if (sh > ih) {
          sh = ih;
          sw = (sh * w) / h;
        }
        sx = (iw - sw) / 2;
        sy = Math.min(ih - sh, ih * 0.02);
      }
      const c = canvas(w, h);
      const g = c.getContext("2d", { willReadFrequently: true })!;
      g.imageSmoothingQuality = "high";
      // Everyone on plain black, as sprite windows were: same ground for keyed and cut-out art.
      g.fillStyle = "#000";
      g.fillRect(0, 0, w, h);
      if (cutout) {
        // Hard-edge the cutout: soft or half-keyed fringe (a keyed bust's leftovers) goes, the figure stays.
        const t = canvas(w, h);
        const tg = t.getContext("2d", { willReadFrequently: true })!;
        tg.imageSmoothingQuality = "high";
        tg.drawImage(im, sx, sy, sw, sh, 0, 0, w, h);
        const td = tg.getImageData(0, 0, w, h);
        for (let i = 3; i < td.data.length; i += 4) td.data[i] = td.data[i]! < 200 ? 0 : 255;
        tg.putImageData(td, 0, 0);
        g.drawImage(t, 0, 0);
      } else g.drawImage(im, sx, sy, sw, sh, 0, 0, w, h);
      const reg = await registerFor(bg);
      const d = g.getImageData(0, 0, w, h);
      ditherToPalette(d, reg, { ...look(), contrast: 1.25, lift: 14 });
      g.putImageData(d, 0, 0);
      return c;
    });
  }

  /** Copy a cached picture into a display canvas (only when it changed). */
  function blit(target: HTMLCanvasElement, src: HTMLCanvasElement | null, w: number, h: number): void {
    if (target.width !== w || target.height !== h) {
      target.width = w;
      target.height = h;
      (target as unknown as { _src?: unknown })._src = undefined;
    }
    const t = target as unknown as { _src?: HTMLCanvasElement | null };
    if (t._src === src) return;
    t._src = src;
    const g = target.getContext("2d")!;
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, h);
    if (src) g.drawImage(src, 0, 0);
  }

  /* ------------------------------ Layout -------------------------------- */

  /** The window rectangles for this view, in cells. */
  function windows(v: SceneView): { vp: Rect; ros: Rect | null; map: Rect | null; st: Rect; term: Rect } {
    const n = people.length;
    const hasMap = !!v.delve || !!v.hex;
    if (geo.phone) return phoneWindows(v, hasMap);
    // Who is here; with nobody, the same box reads the surroundings instead (not in a delve: the map has that).
    // A fixed-size window, like a VRAM region: four rows whether one person is here or four.
    const rosRows = v.delve ? 0 : 4;
    if (!geo.tall) {
      const rx = VP_COLS;
      const rw = geo.cols - VP_COLS;
      let y = 0;
      const rosR = rosRows ? { x: rx, y, w: rw, h: 2 + rosRows } : null;
      if (rosR) y += rosR.h;
      const mapR = hasMap ? { x: rx, y, w: rw, h: v.delve ? 12 : 9 } : null;
      if (mapR) y += mapR.h;
      const stR = { x: rx, y, w: rw, h: 4 };
      y += 4;
      return { vp: { x: 0, y: 0, w: VP_COLS, h: geo.rows }, ros: rosR, map: mapR, st: stR, term: { x: rx, y, w: rw, h: geo.rows - y } };
    }
    const cols = geo.cols;
    let vpH = Math.max(12, Math.min(20, Math.round(geo.rows * 0.34)));
    let mapH = hasMap ? 10 : 0;
    const rosH = rosRows ? 2 + rosRows : 0;
    const spare = geo.rows - vpH - mapH - rosH - 5;
    if (spare < 10) {
      const cut = 10 - spare;
      mapH = hasMap ? Math.max(7, mapH - cut) : 0;
      vpH = Math.max(10, vpH - Math.max(0, cut - 3));
    }
    let y = 0;
    const vpR = { x: 0, y, w: cols, h: vpH };
    y += vpH;
    const rosR = rosH ? { x: 0, y, w: cols, h: rosH } : null;
    y += rosH;
    const mapR = hasMap ? { x: 0, y, w: cols, h: mapH } : null;
    y += mapH;
    const stR = { x: 0, y, w: cols, h: 5 };
    y += 5;
    return { vp: vpR, ros: rosR, map: mapR, st: stR, term: { x: 0, y, w: cols, h: Math.max(6, geo.rows - y) } };
  }

  /**
   * A phone: the picture is a strip, the terminal gets the screen. No "Here" window: whoever is here is on the
   * picture and in the commands. The journal, open, takes the whole screen. Landscape puts the terminal at the right.
   */
  function phoneWindows(v: SceneView, hasMap: boolean): { vp: Rect; ros: Rect | null; map: Rect | null; st: Rect; term: Rect } {
    const { cols, rows } = geo;
    const ST = 5;
    let out: { vp: Rect; ros: Rect | null; map: Rect | null; st: Rect; term: Rect };
    if (geo.W > geo.H) {
      const lw = Math.max(18, Math.round(cols * 0.42));
      const free = rows - ST;
      const mapH = hasMap ? Math.floor(free / 2) : 0;
      const vpH = free - mapH;
      out = { vp: { x: 0, y: 0, w: lw, h: vpH }, ros: null, map: mapH ? { x: 0, y: vpH, w: lw, h: mapH } : null, st: { x: 0, y: free, w: lw, h: ST }, term: { x: lw, y: 0, w: cols - lw, h: rows } };
    } else if (v.delve) {
      // The corridor and its map side by side: walking needs both, and the commands the height.
      const lw = Math.ceil(cols / 2);
      const top = Math.max(7, Math.min(10, Math.round(rows * 0.22)));
      out = { vp: { x: 0, y: 0, w: lw, h: top }, ros: null, map: { x: lw, y: 0, w: cols - lw, h: top }, st: { x: 0, y: top, w: cols, h: ST }, term: { x: 0, y: top + ST, w: cols, h: rows - top - ST } };
    } else {
      const vpH = hasMap ? 5 : Math.max(6, Math.min(10, Math.round(rows * 0.2)));
      const mapH = hasMap ? Math.max(8, Math.min(12, Math.round(rows * 0.28))) : 0;
      let y = vpH;
      const mapR = mapH ? { x: 0, y, w: cols, h: mapH } : null;
      y += mapH;
      out = { vp: { x: 0, y: 0, w: cols, h: vpH }, ros: null, map: mapR, st: { x: 0, y, w: cols, h: ST }, term: { x: 0, y: y + ST, w: cols, h: rows - y - ST } };
    }
    if (ctx.journal.open) out.vp = { x: 0, y: 0, w: cols, h: rows };
    return out;
  }

  /** Resize: grid, monitor, props, room, CRT textures and the overlay variables. */
  function relayout(): void {
    const W = Math.max(1, root.clientWidth);
    const H = Math.max(1, root.clientHeight);
    geo = computeGeo(W, H);
    const { c, glass } = geo;
    const v8 = c / 8;
    cmd.classList.toggle("tall", geo.tall);
    cmd.classList.toggle("phone", geo.phone);
    cmd.style.setProperty("--c", `${c}px`);
    cmd.style.setProperty("--v", `${v8}px`);
    cmd.style.setProperty("--scan", `url("${scanTile(v8)}")`);
    cmd.style.setProperty("--cur", `url("${cursorUrl(Math.round(v8))}") 0 0, default`);
    Object.assign(grid.style, { left: `${geo.ox}px`, top: `${geo.oy}px`, width: `${geo.cols * c}px`, height: `${geo.rows * c}px` });
    if (geo.mon) {
      const m = geo.mon;
      Object.assign(mon.style, { left: `${m.x}px`, top: `${m.y}px`, width: `${m.w}px`, height: `${m.h}px` });
      Object.assign(glassEl.style, { left: `${glass.x - m.x}px`, top: `${glass.y - m.y}px`, width: `${glass.w}px`, height: `${glass.h}px` });
      housingHost.innerHTML = monitorSvg({ w: m.w, h: m.h, gx: glass.x - m.x, gy: glass.y - m.y, gw: glass.w, gh: glass.h, well: geo.well });
      buildKeys();
    } else {
      Object.assign(mon.style, { left: "0px", top: "0px", width: `${W}px`, height: `${H}px` });
      Object.assign(glassEl.style, { left: "0px", top: "0px", width: `${W}px`, height: `${H}px` });
      housingHost.innerHTML = "";
      keys.innerHTML = "";
    }
    cmd.style.setProperty("--vig", `url("${vignette(glass.w, glass.h)}")`);
    barrel(glass.w, glass.h);
    refl.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs>
      <radialGradient id="cmdRf" cx=".18" cy=".1" r=".55"><stop offset="0" stop-color="#fff" stop-opacity=".10"/><stop offset=".6" stop-color="#fff" stop-opacity=".03"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <linearGradient id="cmdRb" x1="0" y1="0" x2="1" y2="1"><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".42" stop-color="#fff" stop-opacity=".035"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
      <path d="M0,0 H70 Q30,8 8,40 L0,62Z" fill="url(#cmdRf)"/><rect width="100" height="100" fill="url(#cmdRb)"/></svg>`;
    placeProps();
    // The host's overlays (class panel, "Meanwhile…") follow the screen.
    if (gs) {
      const vpR = last ? windows(last).vp : { x: 0, y: 0, w: geo.tall ? geo.cols : VP_COLS, h: geo.rows };
      const full = geo.tall;
      const gx = glass.x + geo.ox;
      const gy = glass.y + geo.oy;
      const set = (k: string, val: number) => gs.style.setProperty(k, `${Math.round(val)}px`);
      set("--cmd-c", c);
      set("--cmd-v", v8);
      set("--cmd-vp-l", full ? gx : gx + vpR.x * c);
      set("--cmd-vp-t", full ? gy : gy + vpR.y * c);
      set("--cmd-vp-w", full ? geo.cols * c : vpR.w * c);
      set("--cmd-vp-h", full ? geo.rows * c : vpR.h * c);
      set("--cmd-tube-l", glass.x);
      set("--cmd-tube-t", glass.y);
      set("--cmd-tube-w", glass.w);
      set("--cmd-tube-h", glass.h);
    }
    layoutKey = "";
    scheduleRoom();
  }

  /**
   * The tube's curvature: the whole screen goes through a displacement map
   * that bows it outward (radial, k = 0.008: about 3px at the middle of each
   * edge, twice that at the corners). Offsets are whole pixels, so the 8x8
   * glyphs stay hard-edged; they step, as rasters on curved glass do.
   * Phones get a flat screen (no bezel, and touch targets must not move).
   */
  function barrel(w: number, h: number): void {
    const scr = $(".scr", glassEl);
    const img = $<SVGFEImageElement>("feImage.bmap", glassEl);
    if (geo.tall || w < 8 || h < 8) {
      scr.style.filter = "";
      return;
    }
    const c = canvas(w, h);
    const g = c.getContext("2d")!;
    const im = g.createImageData(w, h);
    const cx = w / 2, cy = h / 2, k = 0.008;
    for (let y = 0; y < h; y++) {
      const v = (y + 0.5 - cy) / cy;
      for (let x = 0; x < w; x++) {
        const u = (x + 0.5 - cx) / cx;
        const r2 = u * u + v * v;
        // Sample from nearer the centre: the picture swells toward the glass edge.
        const dx = Math.round(-(x + 0.5 - cx) * k * r2);
        const dy = Math.round(-(y + 0.5 - cy) * k * r2);
        const i = (y * w + x) * 4;
        im.data[i] = 128 + dx * 8;
        im.data[i + 1] = 128 + dy * 8;
        im.data[i + 2] = 128;
        im.data[i + 3] = 255;
      }
    }
    g.putImageData(im, 0, 0);
    img.setAttribute("width", String(w));
    img.setAttribute("height", String(h));
    img.setAttribute("href", c.toDataURL());
    scr.style.filter = "url(#cmdBarrel)";
  }

  /** The tube's dark edges: a superellipse falloff, drawn small and stretched. */
  function vignette(w: number, h: number): string {
    const cw = Math.max(8, Math.round(w / 8));
    const ch = Math.max(8, Math.round(h / 8));
    const c = canvas(cw, ch);
    const g = c.getContext("2d")!;
    const im = g.createImageData(cw, ch);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const u = (x + 0.5) / cw * 2 - 1;
        const v = (y + 0.5) / ch * 2 - 1;
        const d = Math.pow(Math.pow(Math.abs(u), 7) + Math.pow(Math.abs(v), 7), 1 / 7);
        const edge = Math.max(0, Math.min(1, (d - 0.955) / 0.05));
        const a = edge * edge * 0.9;
        const i = (y * cw + x) * 4;
        im.data[i + 3] = Math.round(Math.min(1, a) * 255);
      }
    }
    g.putImageData(im, 0, 0);
    return c.toDataURL();
  }

  /** The bezel keys: Journal, Classes, Disks, Colour. */
  function buildKeys(): void {
    const m = geo.mon!;
    const c = geo.c;
    const kw = Math.round(c * 2.6);
    const kh = Math.round(c * 1.5);
    const bezelTop = geo.glass.y - m.y + geo.glass.h + geo.well;
    const bh = m.h - bezelTop;
    const lab = c >= 24 ? 16 : 8;
    const cap = (letter: string, word: string, act: string, aria: string) => `<button class="kc" data-a="${act}" aria-label="${aria}">
      <svg viewBox="0 0 ${kw} ${kh}" width="${kw}" height="${kh}" aria-hidden="true">
        <rect x="0" y="3" width="${kw}" height="${kh - 3}" rx="3" fill="#060607"/>
        <rect x="2" y="0" width="${kw - 4}" height="${kh - 6}" rx="3" class="cap" stroke="#000" stroke-width="1"/>
        <path d="M5,1.5 H${kw - 5}" stroke="#7a7e86" stroke-width="1" stroke-opacity=".8"/>
        <path d="M4,${kh - 7} H${kw - 4}" stroke="#000" stroke-width="1" stroke-opacity=".6"/>
        <rect x="${kw - 14}" y="${(kh - 6) / 2 - 3}" width="8" height="6" rx="1" class="lamp2" fill="#2a1a0a" stroke="#000" stroke-width=".6"/>
        <text x="${Math.round(kw * 0.34)}" y="${Math.round((kh - 6) / 2 + lab * 0.45)}" text-anchor="middle" font-family="Gambit 8bit" font-size="${lab}" fill="#e2e5ea">${letter}</text>
      </svg><span class="silk">${word}</span></button>`;
    keys.innerHTML = cap("J", "JOURNAL", "jr", "Journal (J)") + cap("C", "CLASSES", "cls", "Classes (C)") + cap("T", "DISKS", "disks", "Change disk: theme (T)") + cap("M", PALETTE_LABEL[pal], "pal", "Colour mode (M)");
    const total = 4 * kw + 3 * c * 0.5;
    const kTop = Math.round(bezelTop + (bh - kh - 11) / 2 + c * 0.1);
    Object.assign(keys.style, { left: `${Math.round(m.w / 2 - total / 2 + c * 1.5)}px`, top: `${kTop}px` });
  }

  let lampX = 0;
  /**
   * Desk props at foreground scale: they are nearer the eye than the screen,
   * so they are big, cropped by the window's bottom edge, and tucked against
   * the monitor's sides (over its plastic, never over the glass).
   */
  function placeProps(): void {
    const m = geo.mon;
    const c = geo.c;
    const wing = m ? m.x : 0;
    const show = !!m && wing > c * 5;
    for (const el of [dbox, drive, card, lamp]) el.style.display = show ? "" : "none";
    if (!show || !m) return;
    const H = geo.H;
    // Tucked in front of the monitor's plastic, short of the well and the glass.
    const overlap = Math.round(geo.side * 1.15);
    // Disk file box, left, in three-quarter view.
    const right = m.x + overlap;
    const bw = Math.round(Math.min(c * 19, right - c * 0.5));
    const bh = Math.round(bw * 0.62);
    const box = { w: bw, h: bh, fw: Math.round(bw * 0.8), dx: Math.round(bw * 0.2), dy: Math.round(bh * 0.22), ft: Math.round(bh * 0.38) };
    const dw = Math.round(box.fw * 0.84);
    const others = ctx.themes.filter((t) => t.id !== last?.theme);
    const n = others.length;
    const step = Math.round(dw * 0.14);
    const rise = Math.round(dw * 0.3 + step * (n - 1));
    const totalH = bh + rise;
    const bx = right - bw;
    const by = H + Math.round(c * 1.2) - bh;
    Object.assign(dbox.style, { left: `${bx}px`, top: `${by - rise}px`, width: `${bw}px`, height: `${totalH}px` });
    // The disk in use is in the drive, not in the box; the rest stand staggered back to front.
    const disks = others
      .map((t, i) => {
        const k = n > 1 ? 1 - i / (n - 1) : 0;
        const x = Math.round(box.fw * 0.08 + box.dx * k * 0.8);
        const y = Math.round(rise + box.ft - dw * 0.3 - (n - 1 - i) * step - box.dy * k * 0.15);
        const idx = ctx.themes.indexOf(t);
        return `<button class="disk" data-a="disk" data-theme="${t.id}" aria-label="Insert the ${esc(t.label)} disk (theme)" style="left:${x}px;top:${y}px;z-index:${i + 2}">${floppySvg(dw, dw, t.label, idx)}</button>`;
      })
      .join("");
    dbox.innerHTML = `<div style="position:absolute;left:0;top:${rise}px">${diskBoxSvg(box, "back")}</div>${disks}<div class="front" style="position:absolute;left:0;top:${rise}px">${diskBoxSvg(box, "front")}</div>`;
    // External drive, right, its top receding toward the monitor; the printout propped behind it.
    const dvx = m.x + m.w - overlap;
    const dvw = Math.round(Math.min(c * 20, geo.W - dvx - c * 0.5));
    const dvh = Math.round(dvw * 0.42);
    const dvy = H + Math.round(c * 0.9) - dvh;
    Object.assign(drive.style, { left: `${dvx}px`, top: `${dvy}px` });
    drive.innerHTML = driveSvg(dvw, dvh, ctx.themes.find((t) => t.id === last?.theme)?.label ?? "");
    const cw = Math.round(dvw * 0.62);
    const chh = Math.round(cw * 1.02);
    Object.assign(card.style, { left: `${dvx + Math.round(dvw * 0.22)}px`, top: `${dvy - chh + Math.round(dvh * 0.2)}px`, transform: "perspective(900px) rotateX(16deg) rotateZ(2deg)" });
    card.innerHTML = refCardSvg(cw, chh, [["1-0", "commands"], ["J", "journal"], ["C", "classes"], ["T", "change disk"], ["/", "write"], ["M", "colour"], ["ARROWS", "walk"], ["ESC", "close"]]);
    // The lamp stands behind the disk box, leaning in, cropped by the window.
    const lw = Math.round(Math.min(c * 13, Math.max(c * 7, bx + bw * 0.5)));
    const lh = Math.round(lw * 1.9);
    const lx = Math.round(bx - lw * 0.62);
    lamp.style.display = "";
    Object.assign(lamp.style, { left: `${lx}px`, top: `${H - lh + Math.round(c * 0.4)}px` });
    lamp.innerHTML = lampSvg(lw, lh);
    lampX = lx + lw * 0.35;
  }

  let roomTimer = 0;
  function scheduleRoom(): void {
    clearTimeout(roomTimer);
    roomTimer = window.setTimeout(() => {
      const m = geo.mon ?? { x: 0, y: 0, w: geo.W, h: geo.H };
      const key = `${geo.W}x${geo.H}|${m.x},${m.y}|${lampX}`;
      if (key === roomKey) return;
      roomKey = key;
      const deskY = Math.round(Math.min(geo.H * 0.8, m.y + m.h * 0.62));
      drawRoom(roomCv, { W: geo.W + 24, H: geo.H + 24, mon: { ...m, x: m.x + 12, y: m.y + 12 }, deskY: deskY + 12, glow: "rgba(40,60,255,A)", ...(lampX ? { lampX: lampX + 12 } : {}) });
    }, 60);
  }

  /* ------------------------------ Render -------------------------------- */

  function render(v: SceneView): void {
    const first = !last;
    last = v;
    if (first) placeProps();
    ctx.backdrop(v, { post: "none", flat: "none" });
    items = ctx.menu(v);
    people = ctx.people(v);
    const s = ctx.status(v);
    const b = ctx.box(v);
    cmd.classList.toggle("busy", !!b.busy);
    const r = windows(v);
    const lk = JSON.stringify([geo.c, geo.cols, geo.rows, r]);
    if (lk !== layoutKey) {
      layoutKey = lk;
      relayoutOverlaysOnly(r.vp);
    }
    const d = v.delve;
    const dayLine = d ? `Dir: ${DIRS[d.facing] ?? "North"}` : `Day ${s.day} ${TIME_SHORT[s.time] ?? s.time}`;
    const isNew = b.isNew && !d;
    const title = d ? `Delve: ${s.where}` : isNew ? `${s.where} NEW` : s.where;
    const tShown = fit(title, r.vp.w - 6);
    const newHtml = isNew && tShown.endsWith(" NEW") ? `${esc(tShown.slice(0, -4))} <span class="new">NEW</span>` : undefined;
    if (geo.phone) {
      // One label line over the picture: the place at the left, the day (or the way you face) at the right.
      const w = r.vp.w;
      const open = ctx.journal.open;
      const right0 = open ? "" : d ? "" : dayLine;
      const tag = isNew && !open ? " NEW" : "";
      const right = right0 && s.where.length + tag.length + right0.length + 3 > w ? (TIME_SHORT[s.time] ?? s.time) : right0;
      const name = open ? "Journal" : fit(s.where, Math.max(4, w - 2 - tag.length - (right ? right.length + 1 : 0)));
      const pad = " ".repeat(Math.max(0, w - 2 - name.length - tag.length - right.length));
      setWin(vp, r.vp, ` ${name}${tag}${pad}${right} `, "", ` ${esc(name)}${tag ? ` <span class="new">NEW</span>` : ""}${pad}${esc(right)} `);
    } else
    setWin(vp, r.vp, ctx.journal.open ? "Journal" : title, ctx.journal.open ? "" : dayLine, newHtml);
    renderViewport(v, r.vp);
    setWin(ros, r.ros, "Here");
    if (r.ros) renderRoster(v, r.ros);
    setWin(map, r.map, d ? (geo.phone ? `Map ${(DIRS[d.facing] ?? "North").charAt(0)}` : "Map") : "Overland", d ? `Keys: ${d.keys}` : "");
    if (r.map) renderMap(v, r.map);
    setWin(st, r.st);
    renderStatus(v, r.st);
    setWin(term, r.term, diskMenu && !geo.phone ? "Disk" : "");
    renderTerminal(v, r.term);
    // Bezel lamps show what is open; the disk box shows what is in the drive.
    keys.querySelector('[data-a="jr"]')?.classList.toggle("on", ctx.journal.open);
    keys.querySelector('[data-a="cls"]')?.classList.toggle("on", ctx.classes.open);
    keys.querySelector('[data-a="disks"]')?.classList.toggle("on", diskMenu);
  }

  /** Keep the class panel's box on the viewport window. */
  function relayoutOverlaysOnly(vpR: Rect): void {
    if (!gs || geo.tall) return;
    const c = geo.c;
    gs.style.setProperty("--cmd-vp-l", `${Math.round(geo.glass.x + geo.ox + vpR.x * c)}px`);
    gs.style.setProperty("--cmd-vp-t", `${Math.round(geo.glass.y + geo.oy + vpR.y * c)}px`);
    gs.style.setProperty("--cmd-vp-w", `${vpR.w * c}px`);
    gs.style.setProperty("--cmd-vp-h", `${vpR.h * c}px`);
  }

  /* Viewport: place / corridor, encounter boxes, focus box, journal. */
  function renderViewport(v: SceneView, r: Rect): void {
    const c = geo.c;
    const v8 = c / 8;
    // A phone's picture runs to the edges, under its one label line.
    const cw = geo.phone ? r.w : r.w - 2;
    const ch = geo.phone ? r.h - 1 : r.h - 2;
    const open = ctx.journal.open;
    artBox.style.display = open ? "none" : "";
    enc.style.display = open ? "none" : "";
    jr.style.display = open ? "" : "none";
    jclose.style.display = open ? "" : "none";
    if (open) {
      focusBox.style.display = "none";
      renderJournal(v, r);
      return;
    }
    // The picture: the place on the palette, or the corridor.
    const W = cw * 8 + ARTM * 2;
    const H = ch * 8 + ARTM * 2;
    Object.assign(artCv.style, { left: `${-ARTM * v8}px`, top: `${-ARTM * v8}px`, width: `${W * v8}px`, height: `${H * v8}px` });
    if (v.delve) {
      const key = JSON.stringify([v.delve.grid, v.delve.x, v.delve.y, v.delve.facing, v.delve.rooms, W, H, pal]);
      const t = artCv as unknown as { _src?: unknown; _key?: string };
      if (t._key !== key) {
        t._key = key;
        t._src = undefined;
        if (artCv.width !== W || artCv.height !== H) {
          artCv.width = W;
          artCv.height = H;
        }
        drawCorridor(artCv, v.delve, pal);
      }
    } else {
      (artCv as unknown as { _key?: string })._key = undefined;
      const url = ctx.placeArt(v);
      blit(artCv, url ? placePic(url, W, H) : null, W, H);
    }
    // Who is here: framed encounter boxes docked along the bottom.
    const shown = people.slice(0, 3);
    const n = shown.length;
    if (!n) {
      setHtml(enc, "");
    } else {
      // Small picture-in-picture sprite windows docked on the bottom rule, the talk key set into each top rule.
      const bw = Math.min(n === 1 ? 9 : n === 2 ? 8 : 7, Math.floor((cw - (n - 1)) / n), geo.phone ? ch : 99);
      const bh = bw;
      const gap = 1;
      const x0 = geo.phone ? cw - n * bw - (n - 1) * gap : 1 + Math.floor((cw - n * bw - (n - 1) * gap) / 2);
      const y0 = 1 + ch - bh;
      const sig = JSON.stringify([shown.map((p) => p.id), bw, bh, c, items.map((m) => m.key)]);
      if ((enc as unknown as { _sig?: string })._sig !== sig) {
        (enc as unknown as { _sig?: string })._sig = sig;
        enc.innerHTML = shown
          .map((p, i) => {
            const x = x0 + i * (bw + gap);
            const k = keyOf(items.findIndex((m) => m.key === `talk:${p.id}`));
            return `<button class="eb" data-a="talk" data-id="${esc(p.id)}" data-person="${esc(p.id)}" ${p.talkable ? "" : 'aria-disabled="true"'} aria-label="${p.talkable ? `Talk to ${esc(p.name)}` : esc(p.name)}" title="${esc(p.name)}" style="left:${x * c}px;top:${y0 * c}px;width:${bw * c}px;height:${bh * c}px">
              <div style="position:absolute;left:0;top:0;width:${bw * c}px;height:${bh * c}px">${frameSvg(bw, bh, { mat: BLUE, ...(k ? { top: 1, topX: 2 } : {}) })}</div>
              <canvas width="${(bw - 2) * 8}" height="${(bh - 2) * 8}" style="width:${(bw - 2) * c}px;height:${(bh - 2) * c}px"></canvas>
              <span class="ld">...</span>
              ${k ? `<span class="badge" style="left:${2 * c}px">${k}</span>` : ""}</button>`;
          })
          .join("");
        enc.querySelectorAll<HTMLElement>(".eb > div > svg").forEach((s) => s.setAttribute("style", "position:absolute;inset:0;width:100%;height:100%"));
      }
      const bg = ctx.placeArt(v);
      enc.querySelectorAll<HTMLButtonElement>(".eb").forEach((el, i) => {
        const p = shown[i]!;
        const a = ctx.personArt(v, p.id, "color");
        const cv = el.querySelector("canvas")!;
        const src = a ? portraitPic(a.url, a.cutout, bg, cv.width, cv.height) : null;
        el.classList.toggle("wait", !src);
        el.querySelector<HTMLElement>(".ld")!.style.display = src ? "none" : "";
        blit(cv, src, cv.width, cv.height);
      });
    }
    renderFocus();
  }

  /** The big encounter box for whoever is pointed at (roster row, talk command or their box). */
  function renderFocus(): void {
    const v = last;
    const r = vp.rect;
    const p = focusId ? people.find((x) => x.id === focusId) : null;
    if (!v || !r || !p || ctx.journal.open) {
      focusBox.style.display = "none";
      enc.querySelectorAll(".eb.hot").forEach((e) => e.classList.remove("hot"));
      ros.body.querySelectorAll(".row.hot").forEach((e) => e.classList.remove("hot"));
      return;
    }
    const c = geo.c;
    const cw = r.w - 2;
    const ch = r.h - 2;
    const fw = Math.min(cw - 4, 17);
    const strip = people.length ? Math.min(people.length === 1 ? 9 : people.length === 2 ? 8 : 7, Math.floor((cw - (Math.min(3, people.length) - 1)) / Math.min(3, people.length))) : 0;
    const fh = Math.min(ch - 2 - strip, fw + 3);
    if (fh < 8) {
      focusBox.style.display = "none";
      return;
    }
    const x = 1 + Math.floor((cw - fw) / 2);
    const y = 1 + Math.max(1, Math.floor((ch - strip - fh) / 2));
    const label = fit(p.name, fw - 6);
    const known = v.journal.people.find((q) => q.id === p.id);
    const sig = JSON.stringify([p.id, fw, fh, c, label, known?.feel ?? ""]);
    focusBox.style.display = "";
    Object.assign(focusBox.style, { left: `${x * c}px`, top: `${y * c}px`, width: `${fw * c}px`, height: `${fh * c}px` });
    if ((focusBox as unknown as { _sig?: string })._sig !== sig) {
      (focusBox as unknown as { _sig?: string })._sig = sig;
      const pw = fw - 2;
      const ph = fh - 5;
      focusBox.innerHTML = `${frameSvg(fw, fh, { top: label.length })}<div class="notch" style="left:${Math.floor((fw - label.length) / 2) * c}px;top:0;width:${label.length * c}px">${esc(label)}</div>
        <canvas width="${pw * 8}" height="${ph * 8}" style="width:${pw * c}px;height:${ph * c}px"></canvas>
        <div class="role" style="top:${(ph + 1.5) * c}px;height:${3 * c}px">${known ? `<b>${esc(known.feel)}</b> ` : ""}${esc(p.role)}</div>`;
      focusBox.querySelector("svg")!.setAttribute("style", "position:absolute;inset:0;width:100%;height:100%");
    }
    const a = ctx.personArt(v, p.id, "color");
    const cv = focusBox.querySelector("canvas")!;
    blit(cv, a ? portraitPic(a.url, a.cutout, ctx.placeArt(v), cv.width, cv.height) : null, cv.width, cv.height);
    enc.querySelectorAll<HTMLElement>(".eb").forEach((e) => e.classList.toggle("hot", e.dataset.id === p.id));
    ros.body.querySelectorAll<HTMLElement>(".row").forEach((e) => e.classList.toggle("hot", e.dataset.id === p.id));
  }

  function renderJournal(v: SceneView, r: Rect): void {
    const t = v.thread;
    const thread = t
      ? `<h3>The thread ${t.found.length}/${t.total}</h3><div class="goal">${esc(t.goal)}</div>${t.found.length ? `<ul>${t.found.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : `<div class="muted">Nothing found yet.</div>`}`
      : "";
    setHtml(jrIn, thread + ctx.journal.html(v));
    const label = geo.phone ? "Close" : "J:Close";
    const c = geo.c;
    if (geo.phone) {
      Object.assign(jclose.style, { left: "", top: "", width: "" });
      setHtml(jclose, label);
      return;
    }
    Object.assign(jclose.style, { left: `${Math.floor((r.w - label.length) / 2) * c}px`, top: `${(r.h - 1) * c}px`, width: `${label.length * c}px` });
    setHtml(jclose, label);
  }

  /** One table row: label left, a dotted leader, value right, all on the character grid. */
  const lead = (left: string, right: string, w: number) => `<span class="nm">${esc(left)}</span><span class="dots"> ${".".repeat(Math.max(0, w))}</span><span class="k"> ${esc(right)}</span>`;

  function renderRoster(v: SceneView, r: Rect): void {
    const w = r.w - 2;
    if (!people.length) {
      // Nobody here: the box reads the place instead.
      const exits = items.filter((m) => m.group === "go").length;
      const dark = ["night", "midnight"].includes(v.clock.time) ? "DARK" : ["dusk", "evening", "dawn"].includes(v.clock.time) ? "DIM" : "DAY";
      setHtml(ros.body, `<div class="row mute"><span class="nm">Nobody here.</span></div><div class="row">${lead("Exits", String(exits), w)}</div><div class="row">${lead("Light", dark, w)}</div>`);
      return;
    }
    const known = new Map(v.journal.people.map((p) => [p.id, p.feel]));
    const rows = people.map((p) => {
      const i = items.findIndex((m) => m.key === `talk:${p.id}`);
      const k = keyOf(i);
      const feel = known.get(p.id);
      const tag = `[${fit((feel ?? "new").toUpperCase(), 5).replace(/\.$/, "")}]`;
      const name = fit(`${k ? `${k} ` : "  "}${p.name}`, w - tag.length - 2);
      const hot = p.id === focusId;
      return `<button class="row${p.talkable ? "" : " mute"}${hot ? " hot" : ""}" data-a="talk" data-id="${esc(p.id)}" data-person="${esc(p.id)}" title="${esc(p.role)}" aria-label="${p.talkable ? `Talk to ${esc(p.name)}` : esc(p.name)}, ${esc(p.role)}${feel ? `, ${esc(feel)}` : ""}">${lead(name, tag, w)}</button>`;
    });
    setHtml(ros.body, rows.join(""));
  }

  function renderMap(v: SceneView, r: Rect): void {
    const d = v.delve;
    autoCv.style.display = d ? "" : "none";
    hexSvg.style.display = v.hex ? "" : "none";
    if (d) {
      const W = (r.w - 2) * 8;
      const H = (r.h - 2) * 8;
      const key = JSON.stringify([d.grid, d.x, d.y, d.facing, d.rooms, W, H, pal]);
      const t = autoCv as unknown as { _key?: string };
      if (t._key !== key) {
        t._key = key;
        autoCv.width = W;
        autoCv.height = H;
        const g = autoCv.getContext("2d")!;
        g.fillStyle = "#000";
        g.fillRect(0, 0, W, H);
        // A faint cell grid under the map, like graph paper on the screen.
        g.fillStyle = "#0000AA";
        for (let x = 0; x < W; x += 8) for (let y = 0; y < H; y += 8) g.fillRect(x, y, 1, 1);
        const mono = pal === "mono";
        ctx.drawAutomap(autoCv, d, { floor: mono ? "#555555" : "#0000AA", lit: mono ? "#AAAAAA" : "#AA5500", you: "#FFFF55", ...(mono ? { mark: "#FFFFFF" } : {}) });
      }
    } else if (v.hex) {
      const key = JSON.stringify([v.hex.cells.filter((c) => c.seen), v.menu.map((m) => m.id)]);
      const t = hexSvg as unknown as { _key?: string };
      if (t._key !== key) {
        t._key = key;
        ctx.drawHex(hexSvg, v);
      }
    }
  }

  /** Status in plain characters, the way the old screens packed it: two rows, label:value, right-aligned pairs. */
  function renderStatus(v: SceneView, r: Rect): void {
    const s = ctx.status(v);
    const w = r.w - 2;
    const vig = Math.round(Math.max(0, Math.min(1, s.vigor)) * 100);
    const pair = (label: string, value: string, cls = "num") => `<span class="dim">${esc(label)}:</span><span class="${cls}">${esc(value)}</span>`;
    const left1 = `Vig:${vig}%`;
    let cur = s.currency;
    if (left1.length + 1 + String(s.coin).length + 1 + cur.length > w) cur = cur.slice(0, 2);
    const row1 = `<span title="Vigor">${pair("Vig", `${vig}%`, vig <= 30 ? "lo" : "num")}</span><span class="sp"></span><span class="num" title="${esc(`${s.coin} ${s.currency}`)}">${esc(`${s.coin} ${cur}`)}</span>`;
    const left = s.thread ? `<span title="${esc(s.thread.goal)}" aria-label="Thread ${s.thread.found.length} of ${s.thread.total}: ${esc(s.thread.goal)}">${pair("Thread", `${s.thread.found.length}/${s.thread.total}`)}</span>` : `<span>${pair("Day", String(s.day))}</span>`;
    const right = s.supplies ? `<span title="Supplies">${pair("Food", `${s.supplies.now}/${s.supplies.max}`, s.supplies.now <= 1 ? "lo" : "num")}</span>` : s.thread ? `<span>${pair("Day", String(s.day))}</span>` : "";
    const rows = [`<div class="r">${row1}</div>`, `<div class="r">${left}<span class="sp"></span>${right}</div>`];
    // A phone has no bezel: its keys live on a third row.
    if (geo.phone) {
      const hk = (k: string, word: string, act: string, on: boolean) => `<button class="hk${on ? " on" : ""}" data-a="${act}" aria-label="${word} (${k})">${word}</button>`;
      rows.push(`<div class="r keysrow">${hk("J", "Journal", "jr", ctx.journal.open)}${hk("C", "Class", "cls", ctx.classes.open)}${hk("T", "Disk", "disks", diskMenu)}</div>`);
    } else if (geo.tall) {
      const hk = (k: string, word: string, act: string, on: boolean) => `<button class="hk${on ? " on" : ""}" data-a="${act}" aria-label="${word} (${k})">${k} ${word}</button>`;
      rows.push(`<div class="r keysrow">${hk("J", "Jrnl", "jr", ctx.journal.open)}<span class="sp"></span>${hk("C", "Class", "cls", ctx.classes.open)}<span class="sp"></span>${hk("T", "Disk", "disks", diskMenu)}</div>`);
    }
    setHtml(st.body, rows.join(""));
  }

  function renderTerminal(v: SceneView, r: Rect): void {
    const b = ctx.box(v);
    const lines: string[] = [];
    if (diskMenu) {
      lines.push(`<div class="l hd">Insert disk:</div>`);
      ctx.themes.forEach((t, i) => {
        const cur = t.id === v.theme;
        lines.push(`<button class="l ch cmdi${cur ? " cur" : ""}" data-a="disk" data-theme="${t.id}" aria-label="Theme: ${esc(t.label)}"><span class="n">${keyOf(i)}</span>${esc(t.label)}${cur ? " *" : ""}</button>`);
      });
      lines.push(`<button class="l ch cmdi g-go" data-a="pal" aria-label="Colour mode"><span class="n">M</span>Colour: ${PALETTE_LABEL[pal]}</button>`);
      lines.push(`<button class="l ch cmdi g-go" data-a="disks" aria-label="Back"><span class="n">0</span>Back</button>`);
    } else {
      b.log.forEach((l, i) => lines.push(`<div class="l log ch${i === b.log.length - 1 ? " last" : ""}">${esc(l)}</div>`));
      if (b.desc) lines.push(`<div class="l desc">${b.isNew ? `<span class="new">NEW</span> ` : ""}${esc(b.desc)}</div>`);
      if (isWriting(v)) lines.push(beatsHtml(v.story, v.voices, false));
      lines.push(`<div class="l hd"></div>`);
      items.forEach((m, i) => {
        const k = keyOf(i);
        const person = m.group === "talk" && m.target ? ` data-person="${esc(m.target)}"` : "";
        lines.push(`<button class="l ch cmdi g-${m.group}" data-a="cmd" data-i="${i}"${person} aria-label="${esc(m.label)}${k ? ` (${k})` : ""}"><span class="n">${k}</span>${esc(m.label)}</button>`);
      });
    }
    // With the box up, the prompt is the box.
    if (b.busy) lines.push(`<div class="l pr ch" aria-busy="true"><span class="busyt">${esc(b.busy)}</span> <span class="spin">|</span></div>`);
    else if (diskMenu || !canWrite(v)) lines.push(`<div class="l pr ch"><span class="echo"></span><span class="cu"></span></div>`);
    write.sync(v, diskMenu);
    const changed = setHtml(txIn, lines.join(""));
    const story = isWriting(v) && !diskMenu ? JSON.stringify(v.story) : "";
    const newBeat = changed && story && story !== seenStory ? [...txIn.querySelectorAll<HTMLElement>(".beat")].at(-1) : null;
    seenStory = story;
    if (newBeat) {
      // The newest beat is what they came for, from its first line: there may be more of it than the window shows.
      tx.scrollTop = geo.phone ? Math.max(0, newBeat.offsetTop - txIn.offsetTop - 4) : Math.round((newBeat.offsetTop - txIn.offsetTop) / geo.c) * geo.c;
      followTerm = false;
    } else if (geo.phone) {
      // Open at what just happened, to be read down from; a render with nothing new leaves the finger's place alone.
      if (changed) {
        const from = txIn.querySelector<HTMLElement>(".log.last") ?? txIn.querySelector<HTMLElement>(".desc");
        tx.scrollTop = from ? Math.max(0, from.offsetTop - txIn.offsetTop - 4) : 0;
      }
    } else {
      if (changed) followTerm = true;
      if (followTerm) tx.scrollTop = tx.scrollHeight;
    }
    syncMarks();
    void r;
  }

  function syncMarks(): void {
    upMark.style.display = tx.scrollTop > 0 ? "" : "none";
    dnMark.style.display = tx.scrollTop + tx.clientHeight < tx.scrollHeight - 2 ? "" : "none";
    // A phone's More band sits over the last row: at the end of the list it has gone, so nothing stays under it.
  }

  /* ------------------------------ Input --------------------------------- */

  function setFocus(id: string | null): void {
    // On a phone a finger is not a pointer: the talk starts at once, and a big box would only flash over the picture.
    if (geo.phone || id === focusId) return;
    focusId = id;
    renderFocus();
  }

  function onClick(e: MouseEvent): void {
    const t = (e.target as Element | null)?.closest<HTMLElement>("[data-a]");
    if (!t || !root.contains(t)) return;
    const a = t.dataset.a;
    if (a === "cmd") items[Number(t.dataset.i)]?.run();
    else if (a === "talk") {
      const p = people.find((x) => x.id === t.dataset.id);
      if (p?.talkable) p.talk();
    } else if (a === "disk") {
      diskMenu = false;
      const id = t.dataset.theme as SceneView["theme"];
      if (id && id !== last?.theme) ctx.setTheme(id);
      else ctx.rerender();
    } else if (a === "jr") ctx.journal.toggle();
    else if (a === "cls") ctx.classes.toggle();
    else if (a === "disks") {
      diskMenu = !diskMenu;
      ctx.rerender();
    } else if (a === "pal") cyclePalette();
  }

  function cyclePalette(): void {
    pal = PAL_ORDER[(PAL_ORDER.indexOf(pal) + 1) % PAL_ORDER.length]!;
    try {
      localStorage.setItem("gambit.command.palette", pal);
    } catch {
      /* private window: the mode just won't stick */
    }
    if (geo.mon) buildKeys();
    ctx.rerender();
  }

  const overPerson = (e: Event) => {
    const t = (e.target as Element | null)?.closest<HTMLElement>("[data-person]");
    setFocus(t ? t.dataset.person ?? null : null);
    // The command under the pointer echoes at the prompt, as if typed.
    const c = (e.target as Element | null)?.closest<HTMLElement>('[data-a="cmd"]');
    const echo = txIn.querySelector(".echo");
    if (echo) echo.textContent = c ? fit(items[Number(c.dataset.i)]?.label ?? "", 15) : "";
  };
  const leavePerson = (e: Event) => {
    const to = (e as PointerEvent | FocusEvent).relatedTarget as Element | null;
    if (!to || !to.closest?.("[data-person]")) setFocus(null);
  };

  /** Mouse wheel scrolls a window a few whole rows at a time, the way a terminal does. */
  function wheel(el: HTMLElement, e: WheelEvent): void {
    e.preventDefault();
    const c = geo.c;
    el.scrollTop = Math.round((el.scrollTop + Math.sign(e.deltaY) * c * 3) / c) * c;
    if (el === tx) {
      followTerm = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
      syncMarks();
    }
  }
  const onTxWheel = (e: WheelEvent) => wheel(tx, e);
  const onJrWheel = (e: WheelEvent) => wheel(jr, e);
  // Touch scrolling still works natively on a phone.
  tx.style.overflowY = geo.tall ? "auto" : "hidden";
  jr.style.overflowY = geo.tall ? "auto" : "hidden";
  tx.addEventListener("scroll", syncMarks);

  root.addEventListener("click", onClick);
  root.addEventListener("pointerover", overPerson);
  root.addEventListener("pointerout", leavePerson);
  root.addEventListener("focusin", overPerson);
  root.addEventListener("focusout", leavePerson);
  tx.addEventListener("wheel", onTxWheel, { passive: false });
  jr.addEventListener("wheel", onJrWheel, { passive: false });

  /* ------------------------------ Motion -------------------------------- */

  let px = NaN, py = NaN;
  let spinT = 0;
  const SPIN = ["|", "/", "-", "\\"];
  const stopFrame = ctx.onFrame((t) => {
    // The busy spinner on the prompt line.
    if (last?.busy && !ctx.reducedMotion && t - spinT > 110) {
      spinT = t;
      const sp = txIn.querySelector(".spin");
      if (sp) sp.textContent = SPIN[Math.floor(t / 110) % 4]!;
    }
    if (ctx.reducedMotion || geo.phone) return;
    const p = ctx.pointer();
    const qx = Math.round(p.x * 100) / 100;
    const qy = Math.round(p.y * 100) / 100;
    if (qx === px && qy === py) return;
    px = qx;
    py = qy;
    const v8 = geo.c / 8;
    const m = (k: number) => `translate3d(${Math.round(-qx * k)}px, ${Math.round(-qy * k * 0.6)}px, 0)`;
    // The monitor is the still plane. Behind it the wall drifts with the pointer;
    // in front of it the desk props swing the other way, twice as far.
    roomCv.style.transform = m(-8);
    lamp.style.transform = m(-4);
    artCv.style.transform = `translate3d(${Math.round(-qx * ARTM * v8 * 0.8)}px, ${Math.round(-qy * ARTM * v8 * 0.6)}px, 0)`;
    refl.style.transform = `translate3d(${Math.round(qx * 14)}px, ${Math.round(qy * 8)}px, 0)`;
    dbox.style.transform = m(18);
    drive.style.transform = m(18);
    card.style.translate = `${Math.round(-qx * 16)}px ${Math.round(-qy * 9)}px`;
  });

  /* --------------------------- "Meanwhile…" ----------------------------- */

  /** The montage's pictures go through the same palette as the screen. */
  const mo = new MutationObserver(() => {
    gs?.querySelectorAll<HTMLElement>(".mw .mw-art").forEach((el) => {
      const m = /url\(["']?([^"')]+)["']?\)/.exec(el.style.backgroundImage);
      const url = m?.[1];
      if (!url || el.dataset.cmd === url || url.startsWith("data:")) return;
      el.dataset.cmd = url;
      void (async () => {
        const im = await loadImage(url);
        const c = canvas(320, 180);
        const g = c.getContext("2d", { willReadFrequently: true })!;
        coverDraw(g, im, im.naturalWidth, im.naturalHeight, 320, 180);
        const d = g.getImageData(0, 0, 320, 180);
        ditherToPalette(d, PALETTES[pal], look());
        g.putImageData(d, 0, 0);
        const out = c.toDataURL();
        el.dataset.cmd = out;
        el.style.backgroundImage = `url("${out}")`;
      })().catch(() => undefined);
    });
  });
  if (gs) mo.observe(gs, { childList: true, subtree: true, attributes: true, attributeFilter: ["style"] });
  // The class panel closes itself (its own X, outside this screen): a phone's Class key follows it.
  const syncClassKey = () => {
    if (geo.phone) st.body.querySelector('.hk[data-a="cls"]')?.classList.toggle("on", ctx.classes.open);
  };
  gs?.addEventListener("click", syncClassKey);

  /* ------------------------------ Resize -------------------------------- */

  const ro = new ResizeObserver(() => {
    const W = root.clientWidth;
    const H = root.clientHeight;
    if (W === geo.W && H === geo.H) return;
    relayout();
    tx.style.overflowY = geo.tall ? "auto" : "hidden";
    jr.style.overflowY = geo.tall ? "auto" : "hidden";
    if (last) render(last);
  });
  ro.observe(root);
  relayout();

  return {
    boardSkin: BOARD_SKINS.command,
    render,
    key(e, v) {
      const k = e.key.toLowerCase();
      if (k === "escape") {
        if (diskMenu) diskMenu = false;
        else if (ctx.classes.open) ctx.classes.toggle();
        else if (ctx.journal.open) ctx.journal.toggle();
        else return false;
        ctx.rerender();
        return true;
      }
      if (k === "j") return ctx.journal.toggle(), true;
      if (k === "c") return ctx.classes.toggle(), true;
      if (k === "t") {
        diskMenu = !diskMenu;
        ctx.rerender();
        return true;
      }
      if (k === "m") return cyclePalette(), true;
      if (k === "pageup" || k === "pagedown") {
        const el = ctx.journal.open ? jr : tx;
        el.scrollTop += (k === "pageup" ? -1 : 1) * Math.max(geo.c, el.clientHeight - geo.c);
        if (el === tx) followTerm = false;
        syncMarks();
        return true;
      }
      if (/^[0-9]$/.test(k)) {
        const i = k === "0" ? 9 : Number(k) - 1;
        if (diskMenu) {
          if (k === "0") diskMenu = false;
          const t = ctx.themes[i];
          if (t && k !== "0") {
            diskMenu = false;
            if (t.id !== v.theme) ctx.setTheme(t.id);
          }
          ctx.rerender();
          return true;
        }
        const m = items[i];
        if (!m) return false;
        m.run();
        return true;
      }
      return false;
    },
    destroy() {
      destroyed = true;
      stopFrame();
      ro.disconnect();
      mo.disconnect();
      gs?.removeEventListener("click", syncClassKey);
      clearTimeout(roomTimer);
      root.removeEventListener("click", onClick);
      root.removeEventListener("pointerover", overPerson);
      root.removeEventListener("pointerout", leavePerson);
      root.removeEventListener("focusin", overPerson);
      root.removeEventListener("focusout", leavePerson);
      for (const k of ["--cmd-c", "--cmd-v", "--cmd-vp-l", "--cmd-vp-t", "--cmd-vp-w", "--cmd-vp-h", "--cmd-tube-l", "--cmd-tube-t", "--cmd-tube-w", "--cmd-tube-h"]) gs?.style.removeProperty(k);
      pics.clear();
    },
  };
};

/** A two-colour checker for a terrain on the overland (an EGA dither). */
function hxPattern(id: string, a: string, b: string): string {
  return `<pattern id="${id}" width="2" height="2" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="${a}"/><rect width="1" height="1" fill="${b}"/><rect x="1" y="1" width="1" height="1" fill="${b}"/></pattern>`;
}
