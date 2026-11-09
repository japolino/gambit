/**
 * The 1-bit Parley: the talk runs in the scene's crawler console. One low-resolution frame buffer (the scene's
 * own, ../../../scene/themes/onebit/fb.ts) behind the view's DOM holds the desktop, every window's chrome
 * (double rules, pinstriped title bars, hard drop shadows), the viewport picture (the place dithered with its
 * light and vignette, the person drawn as 1-bit art and cut out of it by a moat of ink, rising out of black,
 * a numbered name plate in the dark) and the WHAT NOW? prompt with its solid block cursor. The view's own
 * controls and text sit in those windows on the same grid (CSS reads --u, one virtual pixel), in the bitmap
 * face at whole multiples of its 8-pixel cell.
 *
 * Windows, as the scene lays them out: the VIEW over the CHRONICLE (the conversation), the TERMS (stake,
 * bar, patience as hearts) over COMMAND (prompt, the line you type, the deal as a numbered list), and the
 * function-key strip (F1 what you know, F2 the reading mode). Ultrawide: view | chronicle | terms over command.
 *
 * On a phone (the view's .pl-phone) the conversation is the screen: a bar (who, the stake, patience, MORE), the
 * log, and the line you type with the deal under it, on plain boxes at one fixed pixel unit (about 2 CSS px, so the
 * face is 16px). The picture, what you know, the reading mode and the moments wait behind MORE, in a sheet over the
 * log. .pl-short (the keyboard is up, or the screen is short) leaves one thin stake line, the log and the input;
 * a wide short screen (landscape) puts the input and the deal beside the log.
 */
import type { ParleyDecor, ParleyThemeCtx } from "../types.js";
import { BAYER8, Frame, INK, PAPER, type Bits, type Rect } from "../../../scene/themes/onebit/fb.js";
import { loadFont, wrap, type BitFont } from "../../../scene/themes/onebit/font.js";
import { bustBits, personBits, placeField } from "../../../scene/themes/onebit/art.js";
import { screen } from "../../../art/manga.js";
import { ditherUrl } from "../../../art/dither.js";

const C_INK = 0xff070708;
const C_PAPER = 0xffe6eef0;

type Mode = "wide" | "std" | "tall";
interface Lay { mode: Mode; W: number; H: number; view: Rect; log: Rect; head: Rect; foot: Rect; keys: Rect; /** What you know: its own window (null: over the chronicle, when F1 opens it). */ know: Rect | null }
/** The phone's layout: what is shown right now (the sheet and a playing moment change it). */
interface PhoneLay { W: number; H: number; short: boolean; land: boolean; sheet: boolean; playing: boolean; head: Rect; foot: Rect; area: Rect; log: Rect; gut: Rect; view: Rect | null; modeRow: Rect | null; know: Rect | null; knowGut: Rect | null }

/** The scrollbar gutter at the log's right (virtual px): the bitmap arrow fits and it costs about a letter. */
const GUT = 9;
/** Landscape with the keyboard up: under this many rows the deal gives way to the input. */
const LOW_H = 110;

const inner = (r: Rect): Rect => ({ x: r.x + 4, y: r.y + 14, w: r.w - 8, h: r.h - 17 });
const clip = (t: string, n: number) => (t.length > n ? t.slice(0, Math.max(1, n - 1)) + "." : t);
const HALO = 7;

export function decorateParley(ctx: ParleyThemeCtx): ParleyDecor {
  const root = ctx.root;
  const q = <T extends HTMLElement>(s: string) => root.querySelector(s) as T | null;
  const cv = document.createElement("canvas");
  cv.className = "ob-cv";
  cv.setAttribute("aria-hidden", "true");
  root.prepend(cv);
  const g2 = cv.getContext("2d")!;
  // The function keys and the journal window: the view's own buttons and list, moved onto the strip / a window.
  const keys = document.createElement("div");
  keys.className = "ob-keys";
  const jwin = document.createElement("div");
  jwin.className = "ob-jwin";
  root.append(keys, jwin);
  const journalBtn = q<HTMLButtonElement>(".journal-btn");
  const journalList = q<HTMLElement>(".journal");
  const modeSw = q<HTMLElement>(".mode");
  if (journalBtn) keys.append(journalBtn);
  if (modeSw) keys.append(modeSw);
  if (journalList) jwin.append(journalList);

  let font: BitFont | null = null;
  let fb = new Frame(1, 1);
  let img: ImageData | null = null;
  let L: Lay | null = null;
  let u = 2;
  let time = 0;
  let destroyed = false;
  let knowOpened = false;
  let P: PhoneLay | null = null;
  const reduced = ctx.reducedMotion;

  /* ---------------------------------- Layout ---------------------------------- */
  function layout(): Lay {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const wd = Math.max(200, root.clientWidth * dpr), hd = Math.max(200, root.clientHeight * dpr);
    const sc = Math.max(2, Math.min(Math.floor(hd / 290), Math.floor(wd / 190)));
    u = sc / dpr;
    const W = Math.floor(wd / sc), H = Math.floor(hd / sc);
    const mode: Mode = W < 330 ? "tall" : W / H >= 2.15 ? "wide" : "std";
    if (mode === "tall") {
      const m = 4, g = 5, fw = W - 2 * m;
      const keysR = { x: m, y: H - m - 11, w: fw, h: 11 };
      const footH = 112, headH = 64;
      const foot = { x: m, y: keysR.y - g - footH, w: fw, h: footH };
      const viewH = Math.round(H * 0.3);
      const view = { x: m, y: m, w: fw, h: viewH };
      const head = { x: m, y: m + viewH + g, w: fw, h: headH };
      const log = { x: m, y: head.y + headH + g, w: fw, h: foot.y - g - head.y - headH - g };
      return { mode, W, H, view, head, log, foot, keys: keysR, know: null };
    }
    const m = 6, g = 6;
    const keysR = { x: m, y: H - m - 11, w: W - 2 * m, h: 11 };
    const ch = keysR.y - g - m;
    const headH = 58, footH = mode === "wide" ? 118 : 136;
    const lw = Math.round((W - 2 * m - g) * (mode === "wide" ? 0.6 : 0.6));
    const vh = Math.round(ch * (mode === "wide" ? 0.56 : 0.6));
    const x = m + lw + g, rw = W - x - m;
    return {
      mode, W, H, keys: keysR,
      view: { x: m, y: m, w: lw, h: vh },
      log: { x: m, y: m + vh + g, w: lw, h: ch - vh - g },
      head: { x, y: m, w: rw, h: headH },
      foot: { x, y: m + headH + g, w: rw, h: footH },
      know: { x, y: m + headH + footH + 2 * g, w: rw, h: ch - headH - footH - 2 * g },
    };
  }

  const place = (el: HTMLElement | null, r: Rect, top = 14, side = 4, bottom = 3) => {
    if (!el) return;
    el.style.left = `${(r.x + side) * u}px`;
    el.style.top = `${(r.y + top) * u}px`;
    el.style.width = `${(r.w - 2 * side) * u}px`;
    el.style.height = `${(r.h - top - bottom) * u}px`;
  };

  const isPhone = () => root.classList.contains("pl-phone");
  const sheetOpen = () => !!journalList?.classList.contains("open");
  const moving = () => !!q(".moment.show");
  const put = (el: HTMLElement | null, x: number, y: number, w: number, h: number) => {
    if (!el) return;
    el.style.left = `${x * u}px`;
    el.style.top = `${y * u}px`;
    el.style.width = `${w * u}px`;
    el.style.height = `${h * u}px`;
  };
  const unput = (el: HTMLElement | null) => {
    if (!el) return;
    for (const k of ["left", "top", "width", "height", "bottom", "maxHeight"] as const) el.style[k] = "";
  };

  /** One rect per thing the phone shows, from what's open now. The foot is as tall as its content (the end card, a long draft). */
  function phoneSize(): void {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    // One fixed unit: the 8-pixel face lands at about 16px on any phone, whatever its height (never below 14).
    const sc = Math.max(2, Math.round(2 * dpr));
    u = sc / dpr;
    const W = Math.max(100, Math.floor((root.clientWidth * dpr) / sc)), H = Math.max(60, Math.floor((root.clientHeight * dpr) / sc));
    root.style.setProperty("--u", `${u}px`);
    const short = root.classList.contains("pl-short");
    const land = W / H >= 1.6 && W >= 300;
    const sheet = sheetOpen();
    const m = 1, g = 2;
    const fw = W - 2 * m;
    root.classList.toggle("ob-land", land);
    root.classList.toggle("ob-low", land && H < LOW_H);
    root.classList.toggle("ob-more", sheet);
    root.classList.remove("ob-tall", "ob-know");
    const head: Rect = { x: m, y: m, w: fw, h: short ? 16 : 32 };
    const footEl = q<HTMLElement>(".foot");
    const below = head.y + head.h + g;
    let foot: Rect, area: Rect;
    if (land) {
      const cw = Math.max(150, Math.round(W * 0.4));
      foot = { x: W - m - cw, y: below, w: cw, h: H - m - below };
      area = { x: m, y: below, w: foot.x - g - m, h: H - m - below };
      if (footEl) { footEl.style.bottom = ""; footEl.style.maxHeight = ""; }
      put(footEl, foot.x + 1, foot.y + 1, foot.w - 2, foot.h - 2);
    } else {
      // Bottom-anchored and auto-height, so its real height can be read (and a resize observer sees it change).
      if (footEl) {
        footEl.style.left = `${(m + 1) * u}px`;
        footEl.style.width = `${(fw - 2) * u}px`;
        footEl.style.top = "auto";
        footEl.style.height = "auto";
        footEl.style.bottom = `${root.clientHeight - (H - m - 1) * u}px`;
        footEl.style.maxHeight = `${Math.round((H - below) * 0.7) * u}px`;
      }
      const fh = Math.ceil((footEl?.offsetHeight ?? 60) / u) + 2;
      foot = { x: m, y: H - m - fh, w: fw, h: fh };
      area = { x: m, y: below, w: fw, h: foot.y - g - below };
    }
    // Whoever was at the newest line stays there when the log's box changes (the keyboard, the end card).
    const wasEnd = !!logEl && logEl.scrollTop + logEl.clientHeight >= logEl.scrollHeight - 4;
    let view: Rect | null = null, modeRow: Rect | null = null, know: Rect | null = null, knowGut: Rect | null = null;
    let body = area;
    if (sheet) {
      // The sheet over the log: what you know over the reading mode, the picture above them when there's room.
      const rowH = 24;
      const room = area.h - rowH - g;
      const picH = short || room < 130 ? 0 : Math.max(70, Math.min(130, Math.round(room * 0.42)));
      if (picH) view = { x: area.x, y: area.y, w: area.w, h: picH };
      const ky = area.y + (picH ? picH + g : 0);
      know = { x: area.x, y: ky, w: area.w, h: area.y + area.h - rowH - g - ky };
      modeRow = { x: area.x, y: area.y + area.h - rowH, w: area.w, h: rowH };
      knowGut = { x: know.x + know.w - GUT - 3, y: know.y + 14, w: GUT, h: know.h - 17 };
    } else if (!short && !land && H >= 400) {
      // A tall phone can afford a strip of the picture and still read a long scene.
      view = { x: area.x, y: area.y, w: area.w, h: 74 };
      body = { x: area.x, y: area.y + 76, w: area.w, h: area.h - 76 };
    }
    const log = { x: body.x, y: body.y, w: body.w, h: body.h };
    const gut = { x: log.x + log.w - GUT - 1, y: log.y + 1, w: GUT, h: log.h - 2 };
    const playing = moving();
    P = { W, H, short, land, sheet, playing, head, foot, area, log, gut, view, modeRow, know, knowGut };
    L = { mode: "tall", W, H, view: view ?? area, log, head, foot, keys: area, know };
    root.classList.toggle("ob-playing", playing);
    if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
      fb = new Frame(W, H);
      img = null;
    }
    cv.style.width = `${W * u}px`;
    cv.style.height = `${H * u}px`;
    // The DOM on the boxes. The scene takes no room unless the picture is out; a playing moment takes the whole log.
    put(q<HTMLElement>(".head"), head.x + 2, head.y + (short ? 1 : 11), head.w - 4, head.h - (short ? 2 : 12));
    const btnW = 38;
    put(journalBtn, head.x + head.w - btnW - 1, head.y + (short ? 0 : 1), btnW, short ? 16 : 22);
    put(logEl, log.x + 1, log.y + 1, log.w - 2 - GUT - 1, log.h - 2);
    if (wasEnd && logEl) logEl.scrollTop = logEl.scrollHeight;
    if (playing) put(ctx.scene, area.x + 1, area.y + 1, area.w - 2, area.h - 2);
    else if (view) { const vi = inner(view); put(ctx.scene, vi.x, vi.y, vi.w, vi.h); }
    else put(ctx.scene, area.x, area.y, 0, 0);
    if (modeRow) put(modeSw, modeRow.x + 40, modeRow.y + 1, modeRow.w - 41, modeRow.h - 2);
    if (know) put(jwin, know.x + 4, know.y + 14, know.w - 8 - GUT - 1, know.h - 17);
    root.style.setProperty("--ob-jh", "100%");
    lightKey = "";
    paint();
  }

  let wasPhone = false;
  let longAsk = "";
  function size(): void {
    const phone = isPhone();
    if (phone !== wasPhone) {
      wasPhone = phone;
      // The box holds two short lines on a phone: the long prompt would be cut off in it.
      const ask = q<HTMLTextAreaElement>(".composer textarea");
      if (ask) {
        longAsk ||= ask.placeholder;
        ask.placeholder = phone ? `Say something to ${ctx.scenario.npc.name.split(/\s+/)[0]}...` : longAsk;
      }
      if (phone) journalList?.classList.remove("open");
      else {
        P = null;
        root.classList.remove("ob-land", "ob-low", "ob-more", "ob-playing");
        for (const el of [q<HTMLElement>(".foot"), journalBtn, modeSw]) unput(el);
      }
    }
    if (phone) { phoneSize(); return; }
    L = layout();
    root.style.setProperty("--u", `${u}px`);
    root.classList.toggle("ob-tall", L.mode === "tall");
    if (cv.width !== L.W || cv.height !== L.H) {
      cv.width = L.W;
      cv.height = L.H;
      fb = new Frame(L.W, L.H);
      img = null;
    }
    cv.style.width = `${L.W * u}px`;
    cv.style.height = `${L.H * u}px`;
    place(ctx.scene, L.view);
    place(q(".head"), L.head);
    place(q(".log"), L.log);
    place(q(".foot"), L.foot, L.mode === "tall" ? 30 : 32);
    place(keys, L.keys, 1, 1, 1);
    place(jwin, L.know ?? L.log);
    const jr = inner(L.know ?? L.log);
    root.style.setProperty("--ob-jh", `${(Math.floor((jr.h - 4) / 10) * 10 + 4) * u}px`);
    root.classList.toggle("ob-know", !!L.know);
    // With room for it, what you know stands open in its own window (F1 still closes it).
    if (L.know && !knowOpened) { knowOpened = true; journalList?.classList.add("open"); }
    lightKey = "";
    paint();
  }

  /* ------------------------------ The picture ------------------------------ */
  let field: { key: string; f: Float32Array; w: number; h: number } | null = null;
  let person: { key: string; b: Bits; soft: boolean } | null = null;
  let want = "";
  let wantPlace = "";
  const placeholderUrl = (() => {
    let url: string | null = null;
    return () => {
      if (url) return url;
      const c = q<HTMLCanvasElement>("canvas.plate-canvas");
      try { url = c && "toDataURL" in c ? c.toDataURL("image/jpeg", 0.85) : null; } catch { url = null; }
      return url;
    };
  })();

  function sources(): { place: string | null; face: string | null; framed: boolean } {
    const plate = q(".plate");
    const pimg = q<HTMLImageElement>(".plate-img");
    const placeUrl = plate?.classList.contains("painted") && pimg?.getAttribute("src") ? pimg.src : placeholderUrl();
    const faces = [...root.querySelectorAll<HTMLImageElement>("img.face")].filter((i) => i.getAttribute("src"));
    const face = (faces.find((i) => i.classList.contains("on")) ?? faces[0])?.src ?? null;
    return { place: placeUrl, face, framed: !!q(".fig.framed") };
  }

  function refreshArt(): void {
    if (!L || (P && !P.view)) return;
    const vi = inner(L.view);
    const s = sources();
    const PX = 10, PY = 5;
    const fw = vi.w + PX * 2, fh = vi.h + PY * 2;
    if (s.place) {
      const key = `${s.place}|${fw}x${fh}`;
      if (field?.key !== key && wantPlace !== key) {
        wantPlace = key;
        void placeField(s.place, fw, fh).then((f) => { if (wantPlace === key && !destroyed) { field = { key, f, w: fw, h: fh }; paint(); } }).catch(() => {});
      }
    }
    if (s.face) {
      const h = Math.round(vi.h * (s.framed ? 0.8 : 0.9));
      const key = `${s.face}|${s.framed}|${h}`;
      if (person?.key !== key && want !== key) {
        want = key;
        const p = s.framed ? bustBits(s.face, h) : personBits(s.face, true, "body", h);
        void p.then((b) => { if (want === key && !destroyed) { person = { key, b, soft: s.framed }; paint(); } }).catch(() => {});
      }
    }
  }

  let lightKey = "";
  let light = new Float32Array(1);
  function lightFor(w: number, h: number): void {
    const k = `${w}x${h}`;
    if (k === lightKey) return;
    lightKey = k;
    light = new Float32Array(w * h);
    const ss = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const nx = (x / w - 0.5) * 2, ny = (y / h - 0.4) * 2;
      const d = Math.sqrt(nx * nx * 0.85 + ny * ny);
      light[y * w + x] = (1 - 0.92 * ss(0.42, 1.08, d)) * (1 - ss(0.56, 0.97, y / h)) * (1.18 - 0.22 * (nx * 0.7 + ny * 0.5));
    }
  }

  const halos = new WeakMap<Bits, Uint8Array>();
  function haloOf(b: Bits): Uint8Array {
    let d = halos.get(b);
    if (d) return d;
    const W = b.w + HALO * 2, H = b.h + HALO * 2;
    d = new Uint8Array(W * H).fill(HALO + 1);
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

  /** The person stamped into the view: a moat of ink, a rim of light on the lit side, a dark skirt beyond. */
  function figure(b: Bits, x: number, y: number, cr: Rect): void {
    const d = haloOf(b);
    const W = b.w + HALO * 2;
    for (let j = -HALO; j < b.h + HALO; j++) {
      const py = y + j;
      if (py < cr.y || py >= cr.y + cr.h) continue;
      for (let i = -HALO; i < b.w + HALO; i++) {
        const px = x + i;
        if (px < cr.x || px >= cr.x + cr.w) continue;
        const dist = d[(j + HALO) * W + i + HALO]!;
        if (dist === 0) fb.set(px, py, b.pix[j * b.w + i]!);
        else if (dist === 1) {
          const ii = i + HALO, jj = j + HALO;
          const lit = d[jj * W + ii + 1] === 0 || d[(jj + 1) * W + ii] === 0;
          fb.set(px, py, lit || ((px + py) & 1) === 0 ? PAPER : INK);
        } else if (dist <= 4) fb.set(px, py, INK);
        else if (dist <= HALO) {
          const k = py * fb.w + px;
          if (fb.pix[k] === PAPER && BAYER8[(py & 7) * 8 + (px & 7)]! > (dist - 4) * 14) fb.pix[k] = INK;
        }
      }
    }
  }

  /* --------------------------------- Chrome --------------------------------- */
  function win(r: Rect, title: string, tag?: string): number {
    const f = font!;
    fb.fill({ x: r.x + 4, y: r.y + 4, w: r.w, h: r.h }, INK);
    fb.fill(r, INK);
    fb.box(r, PAPER);
    fb.box({ x: r.x + 2, y: r.y + 2, w: r.w - 4, h: r.h - 4 }, PAPER);
    for (const [cx, cy] of [[r.x, r.y], [r.x + r.w - 3, r.y], [r.x, r.y + r.h - 3], [r.x + r.w - 3, r.y + r.h - 3]] as const) fb.fill({ x: cx, y: cy, w: 3, h: 3 }, PAPER);
    const tb = { x: r.x + 3, y: r.y + 3, w: r.w - 6, h: 9 };
    for (let y = tb.y + 1; y < tb.y + tb.h; y += 2) fb.hline(tb.x + 1, y, tb.w - 2, PAPER);
    fb.hline(tb.x, tb.y + tb.h, tb.w, PAPER);
    const st = tag ? clip(tag, Math.max(0, Math.floor((tb.w - title.length * 8 - 8 - 56) / 8))) : "";
    const tagW = st.length > 1 ? st.length * 8 + 6 : 0;
    const room = tb.w - (tagW ? tagW + 8 : 0);
    const t = clip(title.toUpperCase(), Math.max(1, Math.floor((room - 30) / 8)));
    const tw = t.length * 8 + 8;
    const tx = tb.x + Math.floor((room - tw) / 2);
    fb.fill({ x: tx, y: tb.y, w: tw, h: tb.h }, INK);
    fb.text(f, tx + 4, tb.y + 1, t, PAPER);
    if (tagW) {
      const x = tb.x + tb.w - tagW - 3;
      fb.fill({ x: x - 2, y: tb.y, w: tagW + 4, h: tb.h }, INK);
      fb.fill({ x, y: tb.y, w: tagW, h: tb.h }, PAPER);
      fb.text(f, x + 3, tb.y + 1, st, INK);
      return x - 2;
    }
    return tb.x + tb.w;
  }

  function paintView(r: Rect): void {
    const f = font!;
    const npc = ctx.scenario.npc;
    win(r, ctx.scenario.name || npc.name);
    const cr = inner(r);
    lightFor(cr.w, cr.h);
    const breathe = reduced ? 0 : Math.floor(time / 2.6) % 2;
    if (field) fb.dither(cr, field.f, field.w, field.h, 10, 5, light, undefined, 0, screen);
    else fb.tone(cr, 0);
    pillars(cr);
    if (person) {
      const b = person.b;
      const x = cr.x + Math.round(cr.w * 0.5) - (b.w >> 1);
      const y = person.soft ? cr.y + cr.h + 2 - b.h : cr.y + cr.h - Math.round(cr.h * 0.02) - b.h;
      figure(b, x, y - breathe, cr);
    } else if (q(".silhouette:not(.gone)")) {
      const t = "DEVELOPING...";
      const bw = t.length * 8 + 12;
      fb.fill({ x: cr.x + ((cr.w - bw) >> 1), y: cr.y + (cr.h >> 1) - 7, w: bw, h: 14 }, INK);
      fb.box({ x: cr.x + ((cr.w - bw) >> 1), y: cr.y + (cr.h >> 1) - 7, w: bw, h: 14 }, PAPER);
      fb.text(f, cr.x + ((cr.w - bw) >> 1) + 6, cr.y + (cr.h >> 1) - 3, t, PAPER);
    }
    // The floor falls to pure black over everything: the person rises out of the dark.
    const fade0 = Math.round(cr.h * 0.74);
    for (let j = fade0; j < cr.h; j++) {
      const t = (j - fade0) / Math.max(1, cr.h * 0.2);
      const k = Math.min(1, t * t * (3 - 2 * t)) * 64;
      const py = cr.y + j;
      for (let i = 0; i < cr.w; i++) {
        const px = cr.x + i;
        if (BAYER8[(py & 7) * 8 + (px & 7)]! < k) fb.pix[py * fb.w + px] = INK;
      }
    }
    // The name plate in the dark, numbered as the scene numbers whoever is present; the role under it.
    const maxc = Math.floor((cr.w - 10) / 8);
    const t = clip(`1 ${npc.name.toUpperCase()}`, maxc);
    const roleAll = wrap(npc.role ?? "", maxc);
    const roleMax = P ? (cr.h < 80 ? 1 : 2) : L!.mode === "tall" ? 3 : 2;
    const role = roleAll.slice(0, roleMax);
    if (roleAll.length > roleMax) role[roleMax - 1] = `${clip(role[roleMax - 1]!, maxc - 1)}…`;
    const tw = t.length * 8 + 6;
    const tx = cr.x + 4, ty = cr.y + cr.h - 14 - role.length * 10;
    fb.fill({ x: tx - 2, y: ty - 2, w: tw + 4, h: 14 }, INK);
    fb.fill({ x: tx, y: ty, w: tw, h: 10 }, PAPER);
    fb.text(f, tx + 3, ty + 1, t, INK);
    role.forEach((l, j) => {
      fb.fill({ x: tx - 2, y: ty + 11 + j * 10, w: l.length * 8 + 4, h: 10 }, INK);
      fb.text(f, tx, ty + 12 + j * 10, l, PAPER);
    });
  }

  /** Stone pillars at the view's edges, as the battle's and the delve's walls: lit from the left, sinking into dark. */
  function pillars(vi: Rect): void {
    const pw = Math.max(8, Math.round(vi.w * 0.06));
    const bh = 7;
    for (const side of [0, 1]) {
      const x0 = side ? vi.x + vi.w - pw : vi.x;
      for (let y = vi.y; y < vi.y + vi.h; y++) {
        const off = Math.floor((y - vi.y) / bh) % 2 ? 6 : 0;
        const foot = (y - vi.y) / vi.h;
        for (let i = 0; i < pw; i++) {
          const x = x0 + i;
          const k = side ? (pw - 1 - i) / pw : i / pw;
          const face = side ? i : pw - 1 - i;
          const mortar = (y - vi.y) % bh === 0 || (i + off + side * 3) % 13 === 0;
          let lvl = (0.1 + 0.55 * k) * (side ? 0.6 : 1) * (0.55 + 0.45 * Math.min(1, foot * 3)) * (1 - Math.max(0, foot - 0.6) * 2.4);
          if (face === 0) lvl = 0;
          else if (face === 1) lvl = side ? 0.3 : 0.95 * (1 - Math.max(0, foot - 0.6) * 2.4);
          fb.pix[y * fb.w + x] = mortar ? INK : lvl > ((BAYER8[(y & 7) * 8 + (x & 7)]! + 0.5) / 64) ? PAPER : INK;
        }
      }
    }
  }

  function paintFoot(r: Rect): void {
    const f = font!;
    const ended = !!q(".end.show");
    win(r, "Command", ctx.scenario.contest.kind.toUpperCase());
    const cr = inner(r);
    const head = ended ? "FAREWELL." : "WHAT NOW?";
    const big = head.length * 16 + 14 <= cr.w ? 2 : 1;
    const hy = cr.y + 3;
    const hw = fb.text(f, cr.x + 1, hy, head, PAPER, big);
    if (!ended && (reduced || time % 1 < 0.75)) fb.fill({ x: cr.x + 1 + hw + 3, y: hy, w: 5 * big + 2, h: 8 * big - 1 }, PAPER);
    const top = hy + 8 * big + 3;
    fb.hline(cr.x - 1, top, cr.w + 2, PAPER);
    fb.hline(cr.x - 1, top + 2, cr.w + 2, PAPER, 1);
  }

  function paintKeys(r: Rect): void {
    const f = font!;
    fb.fill({ x: r.x + 4, y: r.y + 4, w: r.w, h: r.h }, INK);
    fb.fill(r, INK);
    fb.box(r, PAPER);
    const right = `♦ ${ctx.scenario.contest.stake ?? ""}`.toUpperCase();
    const last = keys.lastElementChild as HTMLElement | null;
    const used = last ? (last.offsetLeft + last.offsetWidth) / u : 0;
    const room = Math.floor((r.w - used - 12) / 8);
    if (room > 8) {
      const t = clip(right, room);
      fb.text(f, r.x + r.w - 3 - t.length * 8, r.y + 2, t, PAPER);
    }
  }

  function paint(): void {
    if (!L || destroyed) return;
    for (let y = 0; y < fb.h; y++) for (let x = 0; x < fb.w; x++) fb.pix[y * fb.w + x] = (x & 3) === 0 && (y & 3) === ((x >> 1) & 2) ? PAPER : INK;
    if (font && P) paintPhone(P);
    else if (font) {
      refreshArt();
      paintView(L.view);
      const logEnd = win(L.log, L.mode === "tall" ? "Log" : "Chronicle", lastRoll());
      win(L.head, "Terms");
      paintFoot(L.foot);
      paintKeys(L.keys);
      const open = !!journalList?.classList.contains("open");
      if (L.know) {
        win(L.know, "What you know");
        if (!open) {
          const t = "F1 TO OPEN";
          const ki = inner(L.know);
          fb.text(font, ki.x + ((ki.w - t.length * 8) >> 1), ki.y + ((ki.h - 8) >> 1), t, PAPER);
        }
        if (open) arrows(journalList, L.know, inner(L.know).x + inner(L.know).w + 1);
      } else if (open) arrows(journalList, L.log, win(L.log, "What you know"));
      if (!(open && !L.know)) arrows(logEl, L.log, logEnd);
    }
    if (!img || img.width !== fb.w || img.height !== fb.h) img = g2.createImageData(fb.w, fb.h);
    const out = new Uint32Array(img.data.buffer);
    const p = fb.pix;
    for (let i = 0; i < p.length; i++) out[i] = p[i] ? C_PAPER : C_INK;
    g2.putImageData(img, 0, 0);
    jwin.classList.toggle("open", !!journalList?.classList.contains("open"));
    queueMicrotask(edges);
  }

  /** The phone's plain window: one rule, no title bar, every row counts. */
  function plainWin(r: Rect): void {
    fb.fill(r, INK);
    fb.box(r, PAPER);
  }

  /** A list's position, in the gutter at its side: a thumb, and an arrow where there's more. */
  function gutter(el: HTMLElement | null, r: Rect): void {
    if (!el || !font) return;
    fb.vline(r.x - 1, r.y, r.h, PAPER, 1);
    const sh = el.scrollHeight, ch = el.clientHeight;
    if (sh <= ch + 2) return;
    const ar = 9;
    const tr = { x: r.x + 1, y: r.y + ar, w: r.w - 2, h: Math.max(4, r.h - 2 * ar) };
    if (el.scrollTop > 2) fb.text(font, r.x, r.y + 1, "▲", PAPER);
    if (el.scrollTop + ch < sh - 2) fb.text(font, r.x, r.y + r.h - ar, "▼", PAPER);
    const t = Math.max(6, Math.round((tr.h * ch) / sh));
    const y = tr.y + Math.round(((tr.h - t) * el.scrollTop) / Math.max(1, sh - ch));
    fb.fill({ x: tr.x + 1, y, w: tr.w - 2, h: t }, PAPER);
  }

  /** Whole words up to n letters, for a name in a narrow bar. */
  function nameFit(t: string, n: number): string {
    if (t.length <= n) return t;
    const fit: string[] = [];
    for (const w of t.split(/\s+/)) {
      if (fit.join(" ").length + (fit.length ? 1 : 0) + w.length > n) break;
      fit.push(w);
    }
    // Never stop on a little word ("MARROW THE").
    while (fit.length > 1 && /^(THE|OF|A|AN|AND|DE|VON|VAN|AT|IN)$/.test(fit[fit.length - 1]!)) fit.pop();
    return fit.join(" ") || clip(t, n);
  }

  function paintPhone(p: PhoneLay): void {
    const f = font!;
    plainWin(p.head);
    if (!p.short) fb.text(f, p.head.x + 3, p.head.y + 2, nameFit(ctx.scenario.npc.name.toUpperCase(), Math.floor((p.head.w - 38 - 7) / 8)), PAPER);
    plainWin(p.foot);
    if (p.view) { refreshArt(); paintView(p.view); }
    if (p.sheet) {
      if (p.know) {
        win(p.know, "What you know");
        if (p.knowGut) gutter(journalList, p.knowGut);
      }
      if (p.modeRow) {
        plainWin(p.modeRow);
        fb.text(f, p.modeRow.x + 3, p.modeRow.y + 8, "SHOW", PAPER);
      }
    } else {
      plainWin(p.log);
      gutter(logEl, p.gut);
    }
  }

  /** Mark a scrolled list so its first or last part line hides under an ink band with an arrow, never cut through. */
  const logEl = q<HTMLElement>(".log");
  let edgeSig = "";
  function edges(): void {
    let sig = "";
    for (const el of [logEl, journalList]) {
      if (!el) continue;
      const up = el.scrollTop > 2, down = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
      el.classList.toggle("ob-up", up);
      el.classList.toggle("ob-down", down);
      sig += `${up ? 1 : 0}${down ? 1 : 0}`;
      clean(el);
    }
    if (sig !== edgeSig) { edgeSig = sig; paint(); }
  }
  /** The arrows in a scrolled list's title bar, left of its tag: ▲ more above, ▼ more below. */
  function arrows(el: HTMLElement | null, r: Rect | null, end: number): void {
    if (!el || !r || !font || !el.offsetParent) return;
    const up = el.classList.contains("ob-up"), down = el.classList.contains("ob-down");
    if (!up && !down) return;
    const y = r.y + 3;
    const x = end - 22;
    fb.fill({ x: x - 2, y, w: 24, h: 9 }, INK);
    fb.fill({ x, y, w: 20, h: 9 }, PAPER);
    if (up) fb.text(font, x + 1, y + 1, "▲", INK);
    if (down) fb.text(font, x + 11, y + 1, "▼", INK);
  }
  /** The latest roll, pinned in the chronicle's title bar: the kept die and its word. */
  function lastRoll(): string | undefined {
    if (!logEl) return undefined;
    const res = [...logEl.querySelectorAll<HTMLElement>(".result.show")].pop();
    if (!res) return undefined;
    const die = res.parentElement?.querySelector<HTMLElement>(".die.kept")?.textContent ?? "";
    const short: Record<string, string> = { crit_success: "CRIT!", success: "SUCCESS", partial: "PARTIAL", fail: "FAIL", crit_fail: "FUMBLE" };
    const kind = [...res.classList].find((c) => c.startsWith("r-"))?.slice(2) ?? "";
    return `${die ? `${L?.mode === "tall" ? "" : "D20 "}${die} ` : ""}${short[kind] ?? (res.textContent ?? "").toUpperCase()}`;
  }
  /** Hide a scrolled list's part-shown line whole (an inline mask to that line's edge), never slice it. */
  function clean(el: HTMLElement | null): void {
    if (!el || !el.offsetParent) return;
    const box = el.getBoundingClientRect();
    const t0 = box.top + el.clientTop, t1 = t0 + el.clientHeight;
    let top = 0, bot = 0;
    const range = document.createRange();
    for (const c of el.children) {
      const r = c.getBoundingClientRect();
      if (r.bottom <= t0 || r.top >= t1 || (r.top >= t0 && r.bottom <= t1)) continue;
      // Line boxes only: each text node's rects are its lines (an element's own box would hide too much).
      const walk = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
      for (let tn = walk.nextNode(); tn; tn = walk.nextNode()) {
        range.selectNodeContents(tn);
        for (const lr of [...range.getClientRects()]) {
          if (lr.height < 1 || lr.height > 60) continue;
          if (lr.top < t0 - 0.5 && lr.bottom > t0 + 0.5) top = Math.max(top, lr.bottom - t0);
          if (lr.top < t1 - 0.5 && lr.bottom > t1 + 0.5) bot = Math.max(bot, t1 - lr.top);
        }
      }
    }
    const m = top || bot ? `linear-gradient(transparent 0 ${top}px, #000 ${top}px calc(100% - ${bot}px), transparent calc(100% - ${bot}px))` : "";
    el.style.setProperty("mask-image", m);
    el.style.setProperty("-webkit-mask-image", m);
  }
  // On a phone the gutter's thumb follows the finger (once a frame).
  let scrollRaf = 0;
  const onScroll = () => {
    edges();
    if (P && !scrollRaf) scrollRaf = requestAnimationFrame(() => { scrollRaf = 0; paint(); });
  };
  logEl?.addEventListener("scroll", onScroll, { passive: true });
  /* When a turn settles, the chronicle shows it from its start: the whole turn if it fits, else from the
     answer's first line (the view itself scrolls to the bottom line). */
  let anchorT = 0;
  /** A finger on the log: leave it where the player has it until their next line. */
  let reading = false;
  let turns = 0;
  logEl?.addEventListener("touchstart", () => { reading = true; }, { passive: true });
  function anchor(): void {
    const el = logEl;
    if (!el || !el.offsetParent || el.querySelector(".prose.waiting")) return;
    const n = el.querySelectorAll(":scope > .you").length;
    if (n !== turns) { turns = n; reading = false; }
    if (P && reading) return;
    const you = [...el.querySelectorAll<HTMLElement>(":scope > .you")].pop();
    if (!you) return;
    const base = el.getBoundingClientRect().top + el.clientTop - el.scrollTop;
    const at = (n: Element) => n.getBoundingClientRect().top - base;
    const max = el.scrollHeight - el.clientHeight;
    const read = you.nextElementSibling;
    let to = max;
    if (at(you) < max - 1 && read && at(read) < max - 1) to = at(read);
    to = Math.max(0, Math.min(max, Math.round(to)));
    if (Math.abs(el.scrollTop - to) > 2) el.scrollTop = to;
  }
  const logMo = new MutationObserver(() => { clearTimeout(anchorT); anchorT = window.setTimeout(anchor, 600); });
  if (logEl) logMo.observe(logEl, { childList: true, subtree: true, characterData: true });
  anchorT = window.setTimeout(anchor, 900);
  journalList?.addEventListener("scroll", onScroll, { passive: true });

  /* ---------------------------------- Life ---------------------------------- */
  const ro = new ResizeObserver(() => size());
  ro.observe(root);
  // The moments' pictures in 1-bit like the view's, at about the size they are shown on the grid.
  function screenMoments(): void {
    for (const img of root.querySelectorAll<HTMLImageElement>(".moments img, .moment img")) {
      const src = img.getAttribute("src");
      if (!src || img.dataset.obSrc === src || img.dataset.obDone === src) continue;
      img.dataset.obSrc = src;
      const rows = img.closest(".moments") ? 48 : Math.round(img.clientHeight / u) || 200;
      void ditherUrl(src, rows).then((d) => {
        if (img.getAttribute("src") !== src) return;
        img.dataset.obDone = d;
        img.src = d;
      });
    }
  }
  const mo = new MutationObserver(() => {
    screenMoments();
    // On a phone the sheet and a playing moment change what's on screen, not only what's painted.
    if (P && (P.sheet !== sheetOpen() || P.playing !== moving())) size();
    else paint();
  });
  mo.observe(ctx.scene, { subtree: true, attributes: true, attributeFilter: ["src", "class"] });
  if (journalList) mo.observe(journalList, { attributes: true, attributeFilter: ["class"] });
  const foot = q(".foot");
  if (foot) mo.observe(foot, { subtree: true, attributes: true, attributeFilter: ["class"] });
  // The view says when it's a phone (pl-phone, pl-short); the foot's height (the end card, status, a long draft) moves the log.
  let phoneKey = "";
  const cmo = new MutationObserver(() => {
    const k = `${isPhone()}${root.classList.contains("pl-short")}`;
    if (k !== phoneKey) { phoneKey = k; size(); }
  });
  cmo.observe(root, { attributes: true, attributeFilter: ["class"] });
  const footRo = new ResizeObserver(() => { if (P && !P.land && foot && Math.ceil((foot as HTMLElement).offsetHeight / u) + 2 !== P.foot.h) size(); });
  if (foot) footRo.observe(foot);
  // The line you type grows with what you've written (up to four lines), then scrolls.
  const draft = q<HTMLTextAreaElement>(".composer textarea");
  const growDraft = () => {
    if (!draft) return;
    if (!P) { draft.style.height = ""; return; }
    const lh = 10 * u, pad = 6 * u;
    draft.style.height = "auto";
    draft.style.height = `${Math.max(2 * lh + pad, Math.min(draft.scrollHeight, (P.short ? 2 : 4) * lh + pad))}px`;
  };
  draft?.addEventListener("input", growDraft);
  // MORE from the keyboard: put the keyboard away first, or the sheet would open in a sliver of screen.
  journalBtn?.addEventListener("pointerdown", () => { if (P) draft?.blur(); });
  const timer = window.setInterval(() => {
    time += 0.25;
    // The cursor blinks at 1 Hz; the person shifts a pixel every few seconds (no motion when reduced).
    if (!reduced) paint();
  }, 250);
  const onKey = (e: KeyboardEvent) => {
    if (!root.isConnected) return;
    const t = e.target as HTMLElement | null;
    if (e.key === "F1") { e.preventDefault(); journalBtn?.click(); return; }
    if (e.key === "F2") { e.preventDefault(); (modeSw?.querySelector("button:not(.on)") as HTMLButtonElement | null)?.click(); return; }
    if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[1-9]$/.test(e.key)) {
      const btns = [...root.querySelectorAll<HTMLButtonElement>(".actions button")].filter((b) => !b.hidden && b.offsetParent);
      const b = btns[Number(e.key) - 1];
      if (b && !b.disabled) { e.preventDefault(); b.click(); }
    }
  };
  window.addEventListener("keydown", onKey);
  void loadFont().then((f) => { font = f; size(); });
  size();
  screenMoments();

  return {
    update() {
      // The view empties the box when a line is sent, without an input event.
      if (P && draft && !draft.value) draft.style.height = "";
      paint();
    },
    destroy() {
      destroyed = true;
      ro.disconnect();
      mo.disconnect();
      cmo.disconnect();
      footRo.disconnect();
      cancelAnimationFrame(scrollRaf);
      clearInterval(timer);
      clearTimeout(anchorT);
      logMo.disconnect();
      window.removeEventListener("keydown", onKey);
    },
  };
}


