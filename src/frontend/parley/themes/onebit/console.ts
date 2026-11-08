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
 * Phone: one column.
 */
import type { ParleyDecor, ParleyThemeCtx } from "../types.js";
import { BAYER8, Frame, INK, PAPER, type Bits, type Rect } from "../../../scene/themes/onebit/fb.js";
import { loadFont, wrap, type BitFont } from "../../../scene/themes/onebit/font.js";
import { bustBits, personBits, placeField } from "../../../scene/themes/onebit/art.js";

const C_INK = 0xff070708;
const C_PAPER = 0xffe6eef0;

type Mode = "wide" | "std" | "tall";
interface Lay { mode: Mode; W: number; H: number; view: Rect; log: Rect; head: Rect; foot: Rect; keys: Rect; /** What you know: its own window (null: over the chronicle, when F1 opens it). */ know: Rect | null }

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

  function size(): void {
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
    if (!L) return;
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
    if (field) fb.dither(cr, field.f, field.w, field.h, 10, 5, light);
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
    const roleMax = L!.mode === "tall" ? 3 : 2;
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
    if (font) {
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
  logEl?.addEventListener("scroll", edges, { passive: true });
  /* When a turn settles, the chronicle shows it from its start: the whole turn if it fits, else from the
     answer's first line (the view itself scrolls to the bottom line). */
  let anchorT = 0;
  function anchor(): void {
    const el = logEl;
    if (!el || !el.offsetParent || el.querySelector(".prose.waiting")) return;
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
  journalList?.addEventListener("scroll", edges, { passive: true });

  /* ---------------------------------- Life ---------------------------------- */
  const ro = new ResizeObserver(() => size());
  ro.observe(root);
  const mo = new MutationObserver(() => paint());
  mo.observe(ctx.scene, { subtree: true, attributes: true, attributeFilter: ["src", "class"] });
  if (journalList) mo.observe(journalList, { attributes: true, attributeFilter: ["class"] });
  const foot = q(".foot");
  if (foot) mo.observe(foot, { subtree: true, attributes: true, attributeFilter: ["class"] });
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

  return {
    update() { paint(); },
    destroy() {
      destroyed = true;
      ro.disconnect();
      mo.disconnect();
      clearInterval(timer);
      clearTimeout(anchorT);
      logMo.disconnect();
      window.removeEventListener("keydown", onKey);
    },
  };
}


