/**
 * The Command theme: a 1980s home-computer crawler on a CRT that fills the window.
 *
 * Inside the tube everything sits on a coarse character grid (about 46 x 27 cells of 8 x 8 virtual pixels on a
 * wide window, so a cell is 32px at 1080p; 24-ish columns on a phone) in the EGA palette: a royal blue chassis
 * with black windows cut into it, each rimmed by a white rule that breaks around a label between chevron caps.
 * Left: the first-person viewport (the place art posterised and Bayer-dithered to the palette at the grid's own
 * resolution, or a raycast brick corridor in a delve) with whoever is here docked along its bottom in framed
 * encounter boxes, and under it the narration window, where the log and the place's description (or the story
 * you are writing) are read whole. Right, top to bottom: the roster (one row each: talk key, name, how they
 * feel), the status strip, and the command list with its prompt. The last row of the screen is the key bar
 * (Journal, Classes, Disks, Colour), so every key the bezel has is also on the screen at the screen's own size.
 *
 * Around the tube is the physical object (../../stage/themes/command/shell.ts has its geometry): the monitor's
 * moulded housing with the same keys on its chin, and, where the window leaves room beside it, a disk file box
 * whose floppies switch themes, the external drive whose lamp is the busy light, a taped key card and a desk lamp.
 *
 * On a phone (geo.phone, either way up) there is no tube: the picture with one label line, a blue status band and
 * the terminal, flat and unframed, its commands rows a thumb can hit and the whole of it scrolling by touch.
 */
import { BOARD_SKINS } from "../board-skins.js";
import { esc, type MenuItem, type PersonView, type SceneView, type ThemeCtx, type ThemeFactory, type ThemeRenderer } from "./contract.js";
import { drawCorridor } from "./command/corridor.js";
import { canvas, coverDraw, cursorUrl, frameSvg, loadImage, mangaToPalette, PALETTE_LABEL, PALETTES, registerOf, scanTile, type PaletteId, type Rgb } from "./command/pixels.js";
import { diskBoxSvg, driveSvg, drawRoom, floppySvg, lampSvg, monitorSvg, refCardSvg } from "./command/props.js";
import { commandCss } from "./command/style.js";
import { cardRect, computeGeo, keyCapSvg, keysOrigin, propsGeo, silkSize, type Geo, type Rect } from "../../stage/themes/command/shell.js";
import { beatsHtml, canWrite, isWriting, wireWrite, writeFormHtml } from "./write.js";

/* --------------------------------- Grid --------------------------------- */

/** Word-wrap to n columns, as the screen does (a word longer than the line breaks anywhere). */
function wrapRows(s: string, n: number): number {
  let rows = 0;
  let line = 0;
  for (const word of s.split(/\s+/)) {
    if (!word) continue;
    let w = word.length;
    if (line && line + 1 + w <= n) {
      line += 1 + w;
      continue;
    }
    if (line) rows++;
    while (w > n) {
      rows++;
      w -= n;
    }
    line = w;
  }
  return rows + (line ? 1 : 0);
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
  const narr = makeWin("narr");
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
  // The narration window (a monitor only): the log, the place and the story, read whole, apart from the commands.
  narr.body.innerHTML = `<div class="tx" role="log" aria-live="polite"><div class="in"></div></div><div class="scrollmark up" style="top:0">^</div><div class="scrollmark dn" style="bottom:0">v</div>`;
  const nx = $(".tx", narr.body);
  const nxIn = $(".in", nx);
  const nUp = $(".scrollmark.up", narr.body);
  const nDn = $(".scrollmark.dn", narr.body);
  // The key bar: the last row of the screen, on the blue.
  const hints = document.createElement("div");
  hints.className = "hints";
  hints.setAttribute("role", "toolbar");
  hints.setAttribute("aria-label", "Keys");
  grid.append(hints);
  // The commands are its letters and digits, so the line you write is a row of its own, always in sight under the scroll.
  const write = wireWrite(ctx, $<HTMLFormElement>("form.wr", term.body), {
    maxRows: 6,
    onGrow: (px) => {
      tx.style.bottom = `${px}px`;
      dnMark.style.bottom = `${px}px`;
    },
  });
  let seenStory = "";
  /** Beats seen, and whether the newest was still arriving: a reply that streams in is followed word by word. */
  let seenBeats = 0;
  let wasLive = false;
  /** The reader moved the story themselves while it streamed: it is theirs until the next beat. */
  let heldStory = false;
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
  let roomKey = "";
  let followTerm = true;
  let followNarr = true;
  /** Who the roster lists (their talk commands are its rows, so the command list leaves them out). */
  let rostered = new Set<string>();
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
      const big = canvas(w * 3, h * 3);
      const bg = big.getContext("2d", { willReadFrequently: true })!;
      bg.imageSmoothingQuality = "high";
      coverDraw(bg, im, im.naturalWidth, im.naturalHeight, w * 3, h * 3, 0.5, 0.55);
      const c = canvas(w, h);
      c.getContext("2d")!.putImageData(await mangaToPalette(big, reg, look()), 0, 0);
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
      // Drawn at 3x for the manga treatment.
      const W = w * 3, H = h * 3;
      const big = canvas(W, H);
      const g = big.getContext("2d", { willReadFrequently: true })!;
      g.imageSmoothingQuality = "high";
      if (cutout) {
        // Hard-edge the cutout: soft or half-keyed fringe (a keyed bust's leftovers) goes, the figure stays.
        const t = canvas(W, H);
        const tg = t.getContext("2d", { willReadFrequently: true })!;
        tg.imageSmoothingQuality = "high";
        tg.drawImage(im, sx, sy, sw, sh, 0, 0, W, H);
        const td = tg.getImageData(0, 0, W, H);
        for (let i = 3; i < td.data.length; i += 4) td.data[i] = td.data[i]! < 200 ? 0 : 255;
        tg.putImageData(td, 0, 0);
        g.drawImage(t, 0, 0);
      } else g.drawImage(im, sx, sy, sw, sh, 0, 0, W, H);
      const reg = await registerFor(bg);
      const out = canvas(w, h);
      out.getContext("2d")!.putImageData(await mangaToPalette(big, reg, { ...look(), contrast: 1.25, lift: 14 }, 0), 0, 0);
      // Everyone on plain black, as sprite windows were: same ground for keyed and cut-out art.
      const c = canvas(w, h);
      const cg = c.getContext("2d")!;
      cg.fillStyle = "#000";
      cg.fillRect(0, 0, w, h);
      cg.drawImage(out, 0, 0);
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

  interface Wins {
    vp: Rect;
    ros: Rect | null;
    map: Rect | null;
    st: Rect;
    term: Rect;
    /** The narration window (a monitor); without it the terminal carries the narration too. */
    narr: Rect | null;
  }

  /** "Next: <where the thread's next piece is>", or null when there is no thread, it is over, or nothing is known. */
  function nextLead(v: SceneView): string | null {
    const t = ctx.status(v).thread;
    return t && !t.ended && t.leads.length ? `Next: ${t.leads[0]}` : null;
  }
  /** The status window's rows for that line (two at most: it wraps, it is never cut to a stub). */
  const nextRows = (v: SceneView, cols: number): number => {
    const n = nextLead(v);
    return n ? Math.min(2, wrapRows(n, cols)) : 0;
  };

  /**
   * Keep a beat in view in its scroller. One that arrives whole is read from its first line; one that streams in
   * keeps its newest words on the last row (a reply can run to pages), until the reader scrolls it themselves.
   */
  /** The newest log line when it came after the story's last beat: it is shown under the story, not over it. */
  const tailOf = (v: SceneView, log: readonly string[]): string => (v.logAfter && isWriting(v) ? (log[log.length - 1] ?? "") : "");
  /** The log's lines, the newest marked; with a `tail` that one is left for under the story. */
  const logLines = (log: readonly string[], tail: string, into: string[]): void => {
    const n = tail ? log.length - 1 : log.length;
    for (let i = 0; i < n; i++) into.push(`<div class="l log ch${!tail && i === n - 1 ? " last" : ""}">${esc(log[i]!)}</div>`);
  };
  let narrTail = "";
  let termTail = "";

  function followBeat(sc: HTMLElement, inner: HTMLElement, v: SceneView, changed: boolean, grid: number, pad = 0): boolean {
    const n = isWriting(v) ? v.story.length : 0;
    const live = n > 0 && !!v.story[n - 1]!.live;
    const fresh = n > seenBeats;
    const story = n ? JSON.stringify(v.story) : "";
    const moved = story !== seenStory;
    seenStory = story;
    seenBeats = n;
    if (fresh) heldStory = false;
    const beat = n && changed && (fresh || moved || live) ? [...inner.querySelectorAll<HTMLElement>(".beat")].at(-1) : null;
    const was = wasLive;
    wasLive = live;
    if (!beat || heldStory) return false;
    const top = beat.offsetTop - inner.offsetTop;
    const snap = (y: number) => (grid ? Math.round(y / grid) * grid : Math.max(0, y - 4));
    // `pad`: what lies over the scroller's last rows (a phone's "more" band), so the newest line clears it.
    if (live || (was && !fresh)) sc.scrollTop = Math.max(snap(top), Math.ceil(top + beat.offsetHeight - sc.clientHeight + pad));
    else sc.scrollTop = snap(top);
    return true;
  }

  /** The rows the narration needs to show what just happened, and where you are, whole. */
  function narrationRows(v: SceneView, cols: number): number {
    const b = ctx.box(v);
    if (isWriting(v)) {
      // The newest beat: a row over it, its lines, and a row between the reply's paragraphs.
      const x = v.story[v.story.length - 1]!;
      const rowsOf = (t: string | null | undefined, gap: number) => Math.max(0, (t ? t.split(/\n+/).filter((p) => p.trim()) : []).reduce((n, p) => n + wrapRows(p, cols) + gap, 0) - gap);
      const tail = tailOf(v, b.log);
      return 1 + rowsOf(x.said, 0) + rowsOf(x.roll, 0) + rowsOf(x.found, 0) + rowsOf(x.reply, 1) + (tail ? wrapRows(tail, cols - 1) : 0);
    }
    const lastLog = b.log[b.log.length - 1];
    return (lastLog ? wrapRows(lastLog, cols - 1) : 0) + (b.desc ? wrapRows(`${b.isNew ? "NEW " : ""}${b.desc}`, cols) : 0);
  }

  /**
   * The window rectangles for this view, in cells. A monitor: the viewport over the narration at the left; the
   * roster, the status strip and the commands down the right, which has half the screen so a command's label
   * fits on its row; the key bar on the last row. The narration is as tall as what it has to say (in steps, so
   * the picture does not twitch), and the picture gives it the room.
   */
  function windows(v: SceneView): Wins {
    const n = people.length;
    const hasMap = !!v.delve || !!v.hex;
    if (geo.phone) return phoneWindows(v, hasMap);
    if (!geo.tall) {
      const wr = geo.rows - 1;
      const rw = Math.min(23, Math.max(20, Math.ceil(geo.cols / 2)));
      const lw = geo.cols - rw;
      // The overland is where you walk: it sits under the picture, at the picture's width (a delve's automap is small, and goes right).
      const hexH = v.hex && !v.delve ? 8 : 0;
      const need = narrationRows(v, lw - 2);
      // A long reply is a page to read: the picture gives way to a strip (the people stay in the roster).
      const minVp = hexH ? 9 : isWriting(v) && need > 12 ? 8 : 11;
      const narrH = Math.max(6, Math.min(wr - hexH - minVp, 2 + Math.ceil(need / 2) * 2));
      const vpH = wr - hexH - narrH;
      let y = 0;
      const rosR = v.delve ? null : { x: lw, y, w: rw, h: 2 + Math.max(3, Math.min(6, n)) };
      if (rosR) y += rosR.h;
      const autoR = v.delve ? { x: lw, y, w: rw, h: Math.min(10, wr - 15) } : null;
      if (autoR) y += autoR.h;
      const stR = { x: lw, y, w: rw, h: 4 + nextRows(v, rw - 2) };
      y += stR.h;
      const term = { x: lw, y, w: rw, h: wr - y };
      // The journal, open, takes the left column: it is a page to read, and the commands stay beside it.
      if (ctx.journal.open) return { vp: { x: 0, y: 0, w: lw, h: wr }, ros: rosR, map: autoR, st: stR, term, narr: null };
      return { vp: { x: 0, y: 0, w: lw, h: vpH }, ros: rosR, map: hexH ? { x: 0, y: vpH, w: lw, h: hexH } : autoR, st: stR, term, narr: { x: 0, y: vpH + hexH, w: lw, h: narrH } };
    }
    // A tall window that is not a phone: one column, the terminal carrying the narration and the commands.
    const rosRows = v.delve ? 0 : 4;
    const cols = geo.cols;
    let vpH = Math.max(12, Math.min(20, Math.round(geo.rows * 0.34)));
    let mapH = hasMap ? 10 : 0;
    const rosH = rosRows ? 2 + rosRows : 0;
    const stH = 5 + nextRows(v, cols - 2);
    const spare = geo.rows - vpH - mapH - rosH - stH;
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
    const stR = { x: 0, y, w: cols, h: stH };
    y += stH;
    return { vp: vpR, ros: rosR, map: mapR, st: stR, term: { x: 0, y, w: cols, h: Math.max(6, geo.rows - y) }, narr: null };
  }

  /**
   * A phone: the picture is a strip, the terminal gets the screen. No "Here" window: whoever is here is on the
   * picture and in the commands. The journal, open, takes the whole screen. Landscape puts the terminal at the right.
   */
  function phoneWindows(v: SceneView, hasMap: boolean): Wins {
    const { cols, rows } = geo;
    // Two rows of numbers, the thread's next lead, the keys.
    const ST = 5 + nextRows(v, cols - 1);
    let out: Wins;
    // Side by side only where both halves keep a line's width (a portrait phone with its keyboard up is wider than it is tall, and is not that).
    if (geo.W > geo.H * 1.3 && cols >= 36) {
      const lw = Math.max(18, Math.round(cols * 0.42));
      const free = rows - ST;
      const mapH = hasMap ? Math.floor(free / 2) : 0;
      const vpH = free - mapH;
      out = { vp: { x: 0, y: 0, w: lw, h: vpH }, ros: null, map: mapH ? { x: 0, y: vpH, w: lw, h: mapH } : null, st: { x: 0, y: free, w: lw, h: ST }, term: { x: lw, y: 0, w: cols - lw, h: rows }, narr: null };
    } else if (v.delve) {
      // The corridor and its map side by side: walking needs both, and the commands the height.
      const lw = Math.ceil(cols / 2);
      const top = Math.max(7, Math.min(10, Math.round(rows * 0.22)));
      out = { vp: { x: 0, y: 0, w: lw, h: top }, ros: null, map: { x: lw, y: 0, w: cols - lw, h: top }, st: { x: 0, y: top, w: cols, h: ST }, term: { x: 0, y: top + ST, w: cols, h: rows - top - ST }, narr: null };
    } else {
      // A short screen (the keyboard is up) keeps the place's name and gives the picture's rows to the words.
      const vpH = geo.H < 480 ? 1 : hasMap ? 5 : Math.max(6, Math.min(10, Math.round(rows * 0.2)));
      const mapH = hasMap ? Math.max(8, Math.min(12, Math.round(rows * 0.28))) : 0;
      let y = vpH;
      const mapR = mapH ? { x: 0, y, w: cols, h: mapH } : null;
      y += mapH;
      out = { vp: { x: 0, y: 0, w: cols, h: vpH }, ros: null, map: mapR, st: { x: 0, y, w: cols, h: ST }, term: { x: 0, y: y + ST, w: cols, h: rows - y - ST }, narr: null };
    }
    if (ctx.journal.open) out.vp = { x: 0, y: 0, w: cols, h: rows };
    return out;
  }

  /** Resize: grid, monitor, props, room, CRT textures and the overlay variables. */
  function relayout(): void {
    const W = Math.max(1, root.clientWidth);
    const H = Math.max(1, root.clientHeight);
    geo = computeGeo(W, H);
    rootBox = null;
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
    refl.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs>
      <radialGradient id="cmdRf" cx=".18" cy=".1" r=".55"><stop offset="0" stop-color="#fff" stop-opacity=".10"/><stop offset=".6" stop-color="#fff" stop-opacity=".03"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <linearGradient id="cmdRb" x1="0" y1="0" x2="1" y2="1"><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".42" stop-color="#fff" stop-opacity=".035"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
      <path d="M0,0 H70 Q30,8 8,40 L0,62Z" fill="url(#cmdRf)"/><rect width="100" height="100" fill="url(#cmdRb)"/></svg>`;
    placeProps();
    // The host's overlays follow the screen: the class panel takes every window (it is a page of its own, and at
    // this cell size it needs the columns) and leaves the key bar under it; the montage takes the tube.
    if (gs) {
      const set = (k: string, val: number) => gs.style.setProperty(k, `${Math.round(val)}px`);
      set("--cmd-c", c);
      set("--cmd-v", v8);
      set("--cmd-vp-l", glass.x + geo.ox);
      set("--cmd-vp-t", glass.y + geo.oy);
      set("--cmd-vp-w", geo.cols * c);
      set("--cmd-vp-h", (geo.tall ? geo.rows : geo.rows - 1) * c);
      set("--cmd-tube-l", glass.x);
      set("--cmd-tube-t", glass.y);
      set("--cmd-tube-w", glass.w);
      set("--cmd-tube-h", glass.h);
    }
    scheduleRoom();
  }

  /**
   * The tube's dark edges: a superellipse falloff, drawn small and stretched. The curve of the glass is in the
   * housing's bowed opening and this falloff, not in the picture: the screen used to go through a displacement
   * map, which dropped a pixel row out of some lines of type and put every word on a filtered layer.
   */
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

  /**
   * The bezel keys: Journal, Classes (while the class panel is on), Disks, Colour, each cap printed with its letter and its word at a size that
   * reads. They are for the mouse: the same four are on the screen's key bar, which is where Tab goes.
   */
  let keysWithClasses: boolean | null = null;
  function buildKeys(): void {
    const c = geo.c;
    keysWithClasses = ctx.classes.available;
    const gap = Math.round(silkSize(c) * 0.9);
    const defs: [string, string, string, string][] = [["J", "JOURNAL", "jr", "Journal (J)"], ...(keysWithClasses ? [["C", "CLASSES", "cls", "Classes (C)"] as [string, string, string, string]] : []), ["T", "DISKS", "disks", "Change disk: theme (T)"], ["M", PALETTE_LABEL[pal], "pal", "Colour mode (M)"]];
    const caps = defs.map(([letter, word]) => keyCapSvg(c, letter, word));
    keys.innerHTML = defs.map(([, , act, aria], i) => `<button class="kc" tabindex="-1" data-a="${act}" aria-label="${aria}">${caps[i]!.svg}</button>`).join("");
    const at = keysOrigin(geo, caps.reduce((s, k) => s + k.w, 0) + gap * (caps.length - 1), caps[0]!.h);
    Object.assign(keys.style, { left: `${at.left}px`, top: `${at.top}px`, gap: `${gap}px` });
  }

  let lampX = 0;
  /**
   * The desk props, where the window leaves room beside the tube (shell.ts propsGeo): the disk file box whose
   * floppies switch themes, the drive with the disk in use, the key card and the lamp. The card lies flat: its
   * lines are to be read, and type on a tilted layer goes soft.
   */
  function placeProps(): void {
    // The disk in use is in the drive, not in the box; the rest stand staggered back to front.
    const others = ctx.themes.filter((t) => t.id !== last?.theme);
    const p = propsGeo(geo, others.length);
    const put = (el: HTMLElement, r: Rect | null) => {
      el.style.display = r ? "" : "none";
      if (r) Object.assign(el.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
    };
    put(dbox, p.box);
    if (p.box) {
      const b = p.box;
      const disks = others
        .map((t, i) => `<button class="disk" data-a="disk" data-theme="${t.id}" aria-label="Insert the ${esc(t.label)} disk (theme)" title="Theme: ${esc(t.label)}" style="left:${b.disks[i]!.x}px;top:${b.disks[i]!.y}px;z-index:${i + 2}">${floppySvg(b.disk, b.disk, t.label, ctx.themes.indexOf(t))}</button>`)
        .join("");
      dbox.innerHTML = `<div style="position:absolute;left:0;top:${b.rise}px">${diskBoxSvg(b.geom, "back")}</div>${disks}<div class="front" style="position:absolute;left:0;top:${b.rise}px">${diskBoxSvg(b.geom, "front")}</div>`;
    }
    put(drive, p.drive);
    if (p.drive) drive.innerHTML = driveSvg(p.drive.w, p.drive.h, ctx.themes.find((t) => t.id === last?.theme)?.label ?? "");
    const lines: [string, string][] = [["1-0", "command"], ["J", "journal"], ...(ctx.classes.available ? [["C", "classes"] as [string, string]] : []), ["T", "disks"], ["/", "write"], ["M", "colour"], ["ARROWS", "walk"], ["ESC", "close"]];
    const cr = cardRect(p, lines);
    put(card, cr);
    if (cr) card.innerHTML = refCardSvg(cr.w, cr.h, lines, cr.font);
    put(lamp, p.lamp);
    lampX = 0;
    if (p.lamp) {
      lamp.innerHTML = lampSvg(p.lamp.w, p.lamp.h);
      lampX = p.lamp.x + p.lamp.w * 0.35;
    }
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
    syncSpinner(!!b.busy);
    const r = windows(v);
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
    // The roster's rows are the talk commands: its label says so.
    setWin(ros, r.ros, people.some((p) => p.talkable) ? "Talk to" : "Here");
    rostered = new Set();
    if (r.ros) renderRoster(v, r.ros);
    setWin(map, r.map, d ? (geo.phone ? `Map ${(DIRS[d.facing] ?? "North").charAt(0)}` : "Map") : "Overland", d ? `Keys: ${d.keys}` : "");
    if (r.map) renderMap(v, r.map);
    setWin(st, r.st);
    renderStatus(v, r.st);
    setWin(narr, r.narr);
    if (r.narr) renderNarration(v);
    setWin(term, r.term, diskMenu && !geo.phone ? "Disk" : geo.tall ? "" : "Command");
    renderTerminal(v, !geo.tall);
    renderHints();
    // Bezel lamps show what is open; the disk box shows what is in the drive.
    if (geo.mon && keysWithClasses !== ctx.classes.available) buildKeys();
    keys.querySelector('[data-a="jr"]')?.classList.toggle("on", ctx.journal.open);
    keys.querySelector('[data-a="cls"]')?.classList.toggle("on", ctx.classes.open);
    keys.querySelector('[data-a="disks"]')?.classList.toggle("on", diskMenu);
  }

  /**
   * The key bar on the screen's last row: the bezel's four keys again, in the screen's own type, so they read
   * at any window size and Tab reaches them. A lit key is the panel that is open.
   */
  function renderHints(): void {
    hints.style.display = geo.tall ? "none" : "";
    if (geo.tall) return;
    const c = geo.c;
    Object.assign(hints.style, { left: "0px", top: `${(geo.rows - 1) * c}px`, width: `${geo.cols * c}px`, height: `${c}px` });
    const hk = (k: string, word: string, act: string, on: boolean, aria = word): [number, string] => [k.length + 1 + word.length, `<button class="hk${on ? " on" : ""}" data-a="${act}" aria-label="${aria} (${k})" aria-pressed="${on}"><b>${k}</b> ${word}</button>`];
    // In a delve the arrows walk: that is said here, where the colour key otherwise is (it stays on the bezel and in the disk menu).
    const parts: [number, string][] = [
      ...(last?.delve ? [[11, `<span class="hk note"><b>Arrows</b> Walk</span>`] as [number, string]] : []),
      hk("J", "Journal", "jr", ctx.journal.open),
      ...(ctx.classes.available ? [hk("C", "Classes", "cls", ctx.classes.open)] : []),
      hk("T", "Disks", "disks", diskMenu, "Change disk: theme"),
      ...(last?.delve ? [] : [hk("M", PALETTE_LABEL[pal], "pal", false, "Colour mode")]),
    ];
    const used = parts.reduce((n, p) => n + p[0], 0);
    hints.style.gap = `${Math.max(1, Math.min(2, Math.floor((geo.cols - used) / (parts.length - 1)))) * c}px`;
    setHtml(hints, parts.map((p) => p[1]).join(""));
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
    // Under five cells a face is a smudge: on a strip of a picture the roster alone says who is here.
    const shown = ch >= (geo.phone ? 3 : 7) ? people.slice(0, 3) : [];
    const n = shown.length;
    if (!n) {
      setHtml(enc, "");
    } else {
      // Small picture-in-picture sprite windows docked on the bottom rule, the talk key set into each top rule.
      // Never the picture's whole height: on a monitor two rows of the place show over them.
      const bw = Math.min(n === 1 ? 9 : n === 2 ? 8 : 7, Math.floor((cw - (n - 1)) / n), geo.phone ? ch : Math.max(4, ch - 2));
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
            return `<button class="eb" ${geo.phone ? "" : 'tabindex="-1" '}data-a="talk" data-id="${esc(p.id)}" data-person="${esc(p.id)}" ${p.talkable ? "" : 'aria-disabled="true"'} aria-label="${p.talkable ? `Talk to ${esc(p.name)}` : esc(p.name)}" title="${esc(p.name)}" style="left:${x * c}px;top:${y0 * c}px;width:${bw * c}px;height:${bh * c}px">
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
      ? `<h3>The thread ${t.found.length}/${t.total}${t.ended ? `: ${t.ended === "solved" ? "solved" : "out of time"}` : ""}</h3><div class="goal">${esc(t.goal)}</div>${t.found.length ? `<ul>${t.found.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : `<div class="muted">Nothing found yet.</div>`}`
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
    // On a monitor these rows are the talk commands (the list beside them starts at the next key); whoever does not fit stays a command.
    const shown = geo.tall ? people : people.slice(0, r.h - 2);
    if (!geo.tall) rostered = new Set(shown.filter((p) => p.talkable).map((p) => p.id));
    const rows = shown.map((p) => {
      const i = items.findIndex((m) => m.key === `talk:${p.id}`);
      const k = keyOf(i);
      const feel = known.get(p.id);
      // Someone the thread points at says so in place of how they feel (that stays in the row's tooltip).
      const isLead = items.some((m) => m.lead && m.key === `ask:${p.id}`);
      const tag = isLead ? "[LEAD]" : `[${fit((feel ?? "new").toUpperCase(), 5).replace(/\.$/, "")}]`;
      const name = fit(`${k ? `${k} ` : "  "}${p.name}`, w - tag.length - 2);
      const hot = p.id === focusId;
      return `<button class="row${p.talkable ? "" : " mute"}${hot ? " hot" : ""}" data-a="talk" data-id="${esc(p.id)}" data-person="${esc(p.id)}" title="${esc(p.role)}" aria-label="${p.talkable ? `Talk to ${esc(p.name)}` : esc(p.name)}, ${esc(p.role)}${feel ? `, ${esc(feel)}` : ""}${isLead ? ", a lead of the thread" : ""}">${lead(name, tag, w)}</button>`;
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
    const vigWord = w >= 20 ? "Vigor" : "Vig";
    const left1 = `${vigWord}:${vig}%`;
    let cur = s.currency;
    if (left1.length + 1 + String(s.coin).length + 1 + cur.length > w) cur = cur.slice(0, 2);
    const row1 = `<span title="Vigor">${pair(vigWord, `${vig}%`, vig <= 30 ? "lo" : "num")}</span><span class="sp"></span><span class="num" title="${esc(`${s.coin} ${s.currency}`)}">${esc(`${s.coin} ${cur}`)}</span>`;
    // The thread: how far along it is (or, plainly, that it is over), and under it where its next piece is.
    const th = s.thread;
    const over = th?.ended ? (th.ended === "solved" ? "Solved" : "Out of time") : "";
    const count = th ? over || `${th.found.length}/${th.total}` : "";
    const where = th && th.leads.length ? ` Where to look next: ${th.leads.join("; ")}. ${th.how}` : "";
    const left = th ? `<span title="${esc(`${th.goal}.${where}`)}" aria-label="Thread ${esc(over || `${th.found.length} of ${th.total}`)}: ${esc(th.goal)}">${pair("Thread", count)}</span>` : `<span>${pair("Day", String(s.day))}</span>`;
    const day = `Day:${s.day}`;
    const food = s.supplies ? `Food:${s.supplies.now}/${s.supplies.max}` : "";
    const used = `Thread:${count}`.length + 1;
    const right = s.supplies && used + food.length <= w ? `<span title="Supplies">${pair("Food", `${s.supplies.now}/${s.supplies.max}`, s.supplies.now <= 1 ? "lo" : "num")}</span>` : th && used + day.length <= w ? `<span>${pair("Day", String(s.day))}</span>` : "";
    const rows = [`<div class="r">${row1}</div>`, `<div class="r">${left}<span class="sp"></span>${right}</div>`];
    const next = nextLead(v);
    if (next && th) {
      // The line opens the journal, whose first section lists every lead and how a piece is found.
      const more = th.leads.length > 1 ? `, and ${th.leads.length - 1} more` : "";
      rows.push(`<button class="next" data-a="jr" title="${esc(`Where to look next: ${th.leads.join("; ")}. ${th.how}`)}" aria-label="${esc(`${next}${more}. ${th.how} Opens the journal.`)}" style="max-height:calc(var(--c) * 2)"><span class="dim">Next:</span> ${esc(next.slice(6))}</button>`);
    }
    // A phone has no bezel: its keys live on a third row.
    if (geo.phone) {
      const hk = (k: string, word: string, act: string, on: boolean) => `<button class="hk${on ? " on" : ""}" data-a="${act}" aria-label="${word} (${k})">${word}</button>`;
      rows.push(`<div class="r keysrow">${hk("J", "Journal", "jr", ctx.journal.open)}${ctx.classes.available ? hk("C", "Class", "cls", ctx.classes.open) : ""}${hk("T", "Disk", "disks", diskMenu)}</div>`);
    } else if (geo.tall) {
      const hk = (k: string, word: string, act: string, on: boolean) => `<button class="hk${on ? " on" : ""}" data-a="${act}" aria-label="${word} (${k})">${k} ${word}</button>`;
      rows.push(`<div class="r keysrow">${hk("J", "Jrnl", "jr", ctx.journal.open)}<span class="sp"></span>${ctx.classes.available ? `${hk("C", "Class", "cls", ctx.classes.open)}<span class="sp"></span>` : ""}${hk("T", "Disk", "disks", diskMenu)}</div>`);
    }
    setHtml(st.body, rows.join(""));
  }

  /** The log and the place (and the story being written): the newest thing that happened and where you are, whole. */
  function renderNarration(v: SceneView): void {
    const b = ctx.box(v);
    const lines: string[] = [];
    const tail = tailOf(v, b.log);
    logLines(b.log, tail, lines);
    if (b.desc) lines.push(`<div class="l desc">${b.isNew ? `<span class="new">NEW</span> ` : ""}${esc(b.desc)}</div>`);
    if (isWriting(v)) lines.push(beatsHtml(v.story, v.voices, false));
    if (tail) lines.push(`<div class="l log ch last">${esc(tail)}</div>`);
    const changed = setHtml(nxIn, lines.join(""));
    const newTail = !!tail && tail !== narrTail;
    narrTail = tail;
    // A beat is followed (from its first line, or word by word while it streams in); otherwise the window rests on
    // its last lines (the newest log line and the place) until the wheel moves it, through late fonts and resizes too.
    if (followBeat(nx, nxIn, v, changed, geo.c)) followNarr = false;
    // What happened after the story's last beat is under it: the window goes down to it.
    else if (newTail) nx.scrollTop = nx.scrollHeight;
    else if (!isWriting(v)) {
      if (changed) followNarr = true;
      if (followNarr) nx.scrollTop = nx.scrollHeight;
    }
    syncMarks();
  }

  /**
   * The commands and the prompt. With the narration in its own window (`split`), this is the list alone: the
   * talk commands are the roster's rows, the exits come under a "Go to" heading as bare place names, so a label
   * fits its row. Otherwise (a tall window, a phone) it is the one stream it was: log, place, commands.
   */
  function renderTerminal(v: SceneView, split: boolean): void {
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
      if (!split) {
        const tail = tailOf(v, b.log);
        logLines(b.log, tail, lines);
        if (b.desc) lines.push(`<div class="l desc">${b.isNew ? `<span class="new">NEW</span> ` : ""}${esc(b.desc)}</div>`);
        if (isWriting(v)) lines.push(beatsHtml(v.story, v.voices, false));
        if (tail) lines.push(`<div class="l log ch last">${esc(tail)}</div>`);
        lines.push(`<div class="l hd"></div>`);
      }
      let going = false;
      items.forEach((m, i) => {
        if (split && m.group === "talk" && m.target && rostered.has(m.target)) return;
        const k = keyOf(i);
        const person = m.group === "talk" && m.target ? ` data-person="${esc(m.target)}"` : "";
        // An exit is "Go to <place>": under the heading it is the place alone.
        const exit = split && m.kind === "exit" && m.label.startsWith("Go to ");
        if (exit && !going) lines.push(`<div class="l gh">Go to</div>`);
        going = going || exit;
        // What follows a lead of the thread is set in the key colour, and says so to a pointer or a screen reader.
        lines.push(`<button class="l ch cmdi g-${m.group}${m.lead ? " lead" : ""}" data-a="cmd" data-i="${i}"${person}${m.lead ? ' title="A lead: this follows the thread"' : ""} aria-label="${esc(m.label)}${m.lead ? ", a lead of the thread" : ""}${k ? ` (${k})` : ""}"><span class="n">${k}</span>${esc(exit ? m.label.slice(6) : m.label)}</button>`);
      });
    }
    // With the box up, the prompt is the box.
    if (b.busy) lines.push(`<div class="l pr ch" aria-busy="true"><span class="busyt">${esc(b.busy)}</span> <span class="spin">|</span></div>`);
    else if (diskMenu || !canWrite(v)) lines.push(`<div class="l pr ch"><span class="echo"></span><span class="cu"></span></div>`);
    write.sync(v, diskMenu);
    const changed = setHtml(txIn, lines.join(""));
    if (split) {
      // The list starts at its top: its first commands are the ones most used.
      if (changed) tx.scrollTop = b.busy ? tx.scrollHeight : 0;
      syncMarks();
      return;
    }
    const tail = diskMenu ? "" : tailOf(v, b.log);
    const newTail = !!tail && tail !== termTail;
    termTail = tail;
    if (!diskMenu && followBeat(tx, txIn, v, changed, geo.phone ? 0 : geo.c, geo.phone ? geo.c + 8 : 0)) {
      // The newest beat is what they came for: there may be more of it than the window shows.
      followTerm = false;
    } else if (isWriting(v) && !diskMenu) {
      // A story on screen and nothing new in it: the reader's place is left alone, unless something has happened
      // since its last beat. That line is under the story, and the window opens on it.
      const at = newTail ? txIn.querySelector<HTMLElement>(".log.last") : null;
      if (at) tx.scrollTop = Math.max(0, at.offsetTop - txIn.offsetTop - 4);
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
  }

  function syncMarks(): void {
    upMark.style.display = tx.scrollTop > 0 ? "" : "none";
    dnMark.style.display = tx.scrollTop + tx.clientHeight < tx.scrollHeight - 2 ? "" : "none";
    nUp.style.display = nx.scrollTop > 0 ? "" : "none";
    nDn.style.display = nx.scrollTop + nx.clientHeight < nx.scrollHeight - 2 ? "" : "none";
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
  const onNxWheel = (e: WheelEvent) => {
    wheel(nx, e);
    followNarr = nx.scrollTop + nx.clientHeight >= nx.scrollHeight - 2;
    heldStory = true;
    syncMarks();
  };
  const holdStory = () => {
    heldStory = true;
  };
  tx.addEventListener("wheel", holdStory, { passive: true });
  tx.addEventListener("touchmove", holdStory, { passive: true });
  const onJrWheel = (e: WheelEvent) => wheel(jr, e);
  // Touch scrolling still works natively on a phone.
  tx.style.overflowY = geo.tall ? "auto" : "hidden";
  jr.style.overflowY = geo.tall ? "auto" : "hidden";
  tx.addEventListener("scroll", syncMarks);
  nx.addEventListener("scroll", syncMarks);
  nx.addEventListener("wheel", onNxWheel, { passive: false });

  root.addEventListener("click", onClick);
  root.addEventListener("pointerover", overPerson);
  root.addEventListener("pointerout", leavePerson);
  root.addEventListener("focusin", overPerson);
  root.addEventListener("focusout", leavePerson);
  tx.addEventListener("wheel", onTxWheel, { passive: false });
  jr.addEventListener("wheel", onJrWheel, { passive: false });

  /* ------------------------------ Motion -------------------------------- */

  /**
   * The busy spinner on the prompt line. The frame loop is asked for only while something is being prepared: at
   * rest the theme runs nothing per frame.
   */
  const SPIN = ["|", "/", "-", "\\"];
  let spinT = 0;
  let stopFrame: (() => void) | null = null;
  function syncSpinner(busy: boolean): void {
    if (busy && !stopFrame && !ctx.reducedMotion) {
      stopFrame = ctx.onFrame((t) => {
        if (t - spinT < 110) return;
        spinT = t;
        const sp = txIn.querySelector(".spin");
        if (sp) sp.textContent = SPIN[Math.floor(t / 110) % 4]!;
      });
    } else if (!busy && stopFrame) {
      stopFrame();
      stopFrame = null;
    }
  }

  /**
   * Parallax, straight from the pointer's own events: no easing to wait out, whole pixels, and nothing at all while
   * the pointer rests. The monitor is the still plane, and so is everything with words on it (the screen, the keys,
   * the disks' labels, the card). Behind it the wall and the lamp drift; inside the viewport the picture shifts
   * under its frame; the glass's reflection slides.
   */
  let px = NaN, py = NaN;
  let rootBox: DOMRect | null = null;
  const forgetBox = () => {
    rootBox = null;
  };
  const onParallax = (e: PointerEvent) => {
    if (ctx.reducedMotion || geo.phone || e.pointerType === "touch") return;
    rootBox ??= root.getBoundingClientRect();
    if (!rootBox.width || !rootBox.height) return;
    const qx = Math.round(Math.max(-1, Math.min(1, ((e.clientX - rootBox.left) / rootBox.width) * 2 - 1)) * 50) / 50;
    const qy = Math.round(Math.max(-1, Math.min(1, ((e.clientY - rootBox.top) / rootBox.height) * 2 - 1)) * 50) / 50;
    if (qx === px && qy === py) return;
    px = qx;
    py = qy;
    const v8 = geo.c / 8;
    const m = (k: number) => `translate3d(${Math.round(-qx * k)}px, ${Math.round(-qy * k * 0.6)}px, 0)`;
    roomCv.style.transform = m(-8);
    lamp.style.transform = m(-4);
    artCv.style.transform = `translate3d(${Math.round(-qx * ARTM * v8 * 0.8)}px, ${Math.round(-qy * ARTM * v8 * 0.6)}px, 0)`;
    refl.style.transform = `translate3d(${Math.round(qx * 14)}px, ${Math.round(qy * 8)}px, 0)`;
  };
  root.addEventListener("pointermove", onParallax);
  root.addEventListener("pointerenter", forgetBox);

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
        const big = canvas(960, 540);
        const bg = big.getContext("2d", { willReadFrequently: true })!;
        bg.imageSmoothingQuality = "high";
        coverDraw(bg, im, im.naturalWidth, im.naturalHeight, 960, 540);
        const c = canvas(320, 180);
        c.getContext("2d")!.putImageData(await mangaToPalette(big, PALETTES[pal], look()), 0, 0);
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
  // The face lands after the first layout on a cold page: lines wrap again, so what follows the text is placed again.
  void document.fonts?.ready.then(() => {
    if (!destroyed && last) render(last);
  });

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
        const el = ctx.journal.open ? jr : narr.rect ? nx : tx;
        el.scrollTop += (k === "pageup" ? -1 : 1) * Math.max(geo.c, el.clientHeight - geo.c);
        if (el === tx) followTerm = false;
        if (el === nx) followNarr = nx.scrollTop + nx.clientHeight >= nx.scrollHeight - 2;
        heldStory = true;
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
      stopFrame?.();
      root.removeEventListener("pointermove", onParallax);
      root.removeEventListener("pointerenter", forgetBox);
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
