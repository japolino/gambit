/**
 * The Command theme's physical set for a fight or a talk: the same dark room, CRT monitor housing, disk file box,
 * external drive, printout and desk lamp the scene stands on (../../../scene/themes/command/props.ts), so an
 * encounter never leaves the monitor. The screen inside the glass is the caller's: the battle draws it in its
 * Pixi canvas, the Parley in DOM. Layers: `back` (room and lamp) goes under the screen, `front` (the housing, whose
 * glass is a hole, and the desk props) over it. On a phone there is no monitor: the screen is the whole window.
 *
 * The geometry here is the theme's one geometry (the scene imports it): the monitor fills the window's height
 * behind a thin bezel, and the character grid is coarse, about 25 rows whatever the window, so every word on it
 * reads from across a room. The desk props are what is left over: they overlap the monitor's lower corners, shrink
 * with the window and go when there is no room for them to be read.
 */
import { diskBoxSvg, driveSvg, drawRoom, floppySvg, lampSvg, monitorSvg, refCardSvg } from "../../../scene/themes/command/props.js";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Geo {
  tall: boolean;
  /** A phone in either orientation (the same test as Parley's .pl-phone): no monitor, and each screen lays itself out for a thumb. */
  phone: boolean;
  W: number;
  H: number;
  /** One cell in screen pixels (a multiple of 4 on a monitor, of 8 when the window allows: crisp 8x8 glyphs). */
  c: number;
  cols: number;
  rows: number;
  /** The glass in host pixels; the grid starts at (glass.x + ox, glass.y + oy). */
  glass: Rect;
  ox: number;
  oy: number;
  mon: Rect | null;
  well: number;
  side: number;
}

/** The fewest rows and columns a monitor's grid has: the cell is the biggest that still fits them. */
export const MIN_ROWS = 25;
export const MIN_COLS = 40;
/** The widest the tube gets for its height (a wide-screen CRT): past this the window's spare width is desk. */
const MAX_ASPECT = 1.78;
const MAX_COLS = 46;
/** Bezel sizes in cells: plastic at the sides, the brow and the chin (which holds the keys), and the recessed well inside it. */
const BEZ = { s: 0.9, t: 0.6, b: 1.9, well: 0.5 };

export function computeGeo(W: number, H: number): Geo {
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
  // One whole cell of overscan all round: nothing live sits under the tube's dark edge.
  const over = BEZ.t + BEZ.b + 2 * BEZ.well + 2;
  const sides = 2 + 2 * (BEZ.s + BEZ.well);
  const availH = H * 0.985;
  const availW = W * 0.985;
  const raw = Math.min(availH / (MIN_ROWS + over), availW / (MIN_COLS + sides));
  const c = raw >= 16 ? Math.floor(raw / 4) * 4 : Math.max(8, Math.floor(raw));
  const cols0 = Math.max(MIN_COLS, Math.floor(availW / c - sides));
  // A window much taller than it is wide for its columns gets a squarer tube, not an endless one.
  const rows = Math.max(MIN_ROWS - 2, Math.min(Math.floor(availH / c - over), Math.round(cols0 * 0.82)));
  const cols = Math.min(cols0, MAX_COLS, Math.round(rows * MAX_ASPECT));
  const gw = (cols + 2) * c;
  const gh = (rows + 2) * c;
  const well = Math.round(BEZ.well * c);
  const s = Math.round(BEZ.s * c);
  // Spare height goes into the brow and the chin (up to a point), so the set fills the window.
  const spare = Math.max(0, Math.min(c * 3, availH - (gh + 2 * well + (BEZ.t + BEZ.b) * c)));
  const t = Math.round(BEZ.t * c + spare * 0.3);
  const b = Math.round(BEZ.b * c + spare * 0.7);
  const mw = gw + 2 * (s + well);
  const mh = gh + 2 * well + t + b;
  const mon = { x: Math.round((W - mw) / 2), y: Math.max(0, Math.round((H - mh) / 2)), w: mw, h: mh };
  return { tall, phone, W, H, c, cols, rows, glass: { x: mon.x + s + well, y: mon.y + t + well, w: gw, h: gh }, ox: c, oy: c, mon, well, side: s };
}

/* ------------------------------ Desk props ------------------------------ */

/** Where the desk props stand, in host pixels (null: no room for that one). */
export interface PropsGeo {
  /** The disk file box (left): its box, the rise the standing disks need above it, and each disk's place inside it. */
  box: { x: number; y: number; w: number; h: number; rise: number; geom: { w: number; h: number; fw: number; dx: number; dy: number; ft: number }; disk: number; disks: { x: number; y: number }[] } | null;
  drive: Rect | null;
  /** Where the quick-reference printout can go (its left edge and width; cardRect sizes it for its lines). */
  card: { x: number; w: number } | null;
  lamp: Rect | null;
}

/**
 * The props stand in front of the monitor's lower corners: over its plastic and the first sliver of the glass's
 * blank overscan, never over a live cell. They take the width the window leaves beside the tube, so on a 16:9
 * window they are small and on an ultrawide one they are the desk; under a readable size each one goes.
 */
export function propsGeo(geo: Geo, diskCount: number): PropsGeo {
  const m = geo.mon;
  const none: PropsGeo = { box: null, drive: null, card: null, lamp: null };
  if (!m) return none;
  const c = geo.c;
  const H = geo.H;
  // The reach of a prop from the window's edge: the wing, the bezel and well, and a third of a cell of overscan.
  const reach = geo.glass.x + Math.round(c * 0.35);
  const out: PropsGeo = { ...none };
  if (reach >= 150 && diskCount > 0) {
    const bw = Math.round(Math.min(c * 13, 440, reach - 4));
    const bh = Math.round(bw * 0.56);
    const geom = { w: bw, h: bh, fw: Math.round(bw * 0.8), dx: Math.round(bw * 0.2), dy: Math.round(bh * 0.22), ft: Math.round(bh * 0.38) };
    const dw = Math.round(geom.fw * 0.88);
    // Each disk shows its whole label over the one in front of it.
    const step = Math.round(dw * 0.2);
    const rise = Math.round(dw * 0.26 + step * (diskCount - 1));
    const bx = reach - bw;
    const by = H + Math.round(bh * 0.2) - bh;
    const disks = Array.from({ length: diskCount }, (_, i) => {
      const k = diskCount > 1 ? 1 - i / (diskCount - 1) : 0;
      return { x: Math.round(geom.fw * 0.06 + geom.dx * k * 0.8), y: Math.round(rise + geom.ft - dw * 0.26 - (diskCount - 1 - i) * step - geom.dy * k * 0.15) };
    });
    out.box = { x: bx, y: by - rise, w: bw, h: bh + rise, rise, geom, disk: dw, disks };
    // The lamp leans in from beyond the box, where there is a wing for it to stand in.
    if (m.x >= c * 6) {
      const lw = Math.round(Math.min(c * 11, Math.max(c * 6, m.x * 0.7)));
      const lh = Math.round(lw * 1.9);
      out.lamp = { x: Math.round(bx - lw * 0.8), y: H - lh + Math.round(c * 0.4), w: lw, h: lh };
    }
  }
  const dvx = geo.glass.x + geo.glass.w - Math.round(c * 0.35);
  const room = geo.W - dvx - 4;
  if (room >= 150) {
    const dvw = Math.round(Math.min(c * 13, 440, room));
    const dvh = Math.round(dvw * 0.42);
    const dvy = H + Math.round(dvh * 0.12) - dvh;
    out.drive = { x: dvx, y: dvy, w: dvw, h: dvh };
    out.card = { x: dvx + Math.round(dvw * 0.1), w: Math.round(dvw * 0.86) };
  }
  return out;
}

/**
 * The card for these lines, above the drive: its type as big as its longest line allows, and no card at all
 * under 13px (the same keys are on the screen, at the screen's size).
 */
export function cardRect(p: PropsGeo, lines: [string, string][]): (Rect & { font: number }) | null {
  if (!p.card || !p.drive) return null;
  const chars = Math.max(...lines.map(([k]) => k.length)) + 1 + Math.max(...lines.map(([, t]) => t.length));
  const font = Math.min(20, Math.floor((p.card.w * 0.8) / chars));
  if (font < 13) return null;
  const h = Math.round(font * 1.7 * (lines.length + 2.4));
  return { x: p.card.x, y: p.drive.y - h + Math.round(p.drive.h * 0.22), w: p.card.w, h, font };
}

/** The bezel's legend type: half a cell, never under 13px. */
export const silkSize = (c: number): number => Math.max(13, Math.round(c * 0.5));

/**
 * One bezel key: a wide cap with its letter and its word printed on it at a size that reads (the letter alone
 * said nothing, and the word under it was 8px). `lamp` adds the little indicator the scene lights when its panel is open.
 */
export function keyCapSvg(c: number, letter: string, word: string, lamp = true): { svg: string; w: number; h: number } {
  const f = silkSize(c);
  const kh = Math.max(Math.round(c * 1.15), f + 10);
  const kw = Math.round((letter.length + 1 + word.length) * f + f * 1.2 + (lamp ? f : 0));
  const ty = Math.round((kh - 5) / 2 + f * 0.42);
  const svg = `<svg viewBox="0 0 ${kw} ${kh}" width="${kw}" height="${kh}" aria-hidden="true">
    <rect x="0" y="3" width="${kw}" height="${kh - 3}" rx="3" fill="#060607"/>
    <rect x="1.5" y="0.5" width="${kw - 3}" height="${kh - 5}" rx="3" class="cap" fill="#2c2f34" stroke="#000" stroke-width="1"/>
    <path d="M5,1.5 H${kw - 5}" stroke="#7a7e86" stroke-width="1" stroke-opacity=".8"/>
    <text x="${Math.round(f * 0.6)}" y="${ty}" font-family="Gambit 8bit" font-size="${f}" fill="#ffe27a">${letter}</text>
    <text x="${Math.round(f * 0.6 + (letter.length + 1) * f)}" y="${ty}" font-family="Gambit 8bit" font-size="${f}" fill="#e2e5ea">${word}</text>
    ${lamp ? `<rect x="${kw - Math.round(f * 0.95)}" y="${Math.round((kh - 5) / 2 - 3)}" width="${Math.round(f * 0.5)}" height="6" rx="1" class="lamp2" fill="#2a1a0a" stroke="#000" stroke-width=".6"/>` : ""}
  </svg>`;
  return { svg, w: kw, h: kh };
}

/** Where the row of bezel keys starts: centred in the chin, between the badge and the knobs. */
export function keysOrigin(geo: Geo, total: number, kh: number): { left: number; top: number } {
  const m = geo.mon!;
  const bezelTop = geo.glass.y - m.y + geo.glass.h + geo.well;
  const bh = m.h - bezelTop;
  return { left: Math.round(m.w / 2 - total / 2), top: Math.round(bezelTop + (bh - kh) / 2) };
}

const OTHER_DISKS = ["Storybook", "Lobby", "1-bit"];

/**
 * The props' SVG with ids of its own. The scene's copy of the same props is still in the page (hidden) while a
 * fight or a talk is up, and a paint server found there first does not paint: the disks' stickers came out black.
 */
const own = (svg: string): string => svg.replace(/\bid="([\w-]+)"/g, 'id="$1-x"').replace(/url\(#([\w-]+)\)/g, "url(#$1-x)");

const CSS = `
.cmdx-back, .cmdx-front { position: absolute; inset: 0; pointer-events: none; overflow: hidden; font-family: "Gambit 8bit", monospace; }
.cmdx-back { z-index: 0; background: #050508; }
.cmdx-front { z-index: 3; }
.cmdx-back .room { position: absolute; left: -12px; top: -12px; width: calc(100% + 24px); height: calc(100% + 24px); display: block; }
.cmdx-back .lamp, .cmdx-front .prop { position: absolute; }
.cmdx-back .lamp { filter: drop-shadow(10px 12px 14px rgba(0,0,0,.7)); }
.cmdx-front svg { display: block; }
.cmdx-front .mon { position: absolute; }
.cmdx-front .mon > svg { position: absolute; left: 0; top: 0; }
.cmdx-front .keys { position: absolute; display: flex; align-items: center; }
.cmdx-front .kc { display: block; padding: 0; margin: 0; border: 0; background: none; }
.cmdx-front button.kc { pointer-events: auto; cursor: pointer; }
.cmdx-front button.kc:hover svg { transform: translateY(1px); }
.cmdx-front button.kc:active svg { transform: translateY(3px); }
.cmdx-front button.kc:focus-visible { outline: 2px dashed #FFFF55; outline-offset: 3px; }
.cmdx-front .legend { color: #b9b4a6; white-space: pre; }
.cmdx-front .legend b { font-weight: normal; color: #ffe27a; }
.cmdx-front .dbox > div, .cmdx-front .disk { position: absolute; }
.cmdx-front .disk { filter: drop-shadow(0 -2px 3px rgba(0,0,0,.55)); }
.cmdx-front .drive { filter: drop-shadow(6px 10px 10px rgba(0,0,0,.65)); }
.cmdx-front .drive .dled-bloom { opacity: 0; }
.cmdx-front.busy .drive .dled { fill: #ff2200; animation: cmdxLed .35s steps(2) infinite; }
.cmdx-front.busy .drive .dled-bloom { opacity: 1; animation: cmdxLed .35s steps(2) infinite; }
@keyframes cmdxLed { 50% { opacity: .25; } }
@media (prefers-reduced-motion: reduce) { .cmdx-front *, .cmdx-back * { animation: none !important; } }
`;

export interface ShellOpts {
  /** The label on the disk in the drive. */
  drive: string;
  /** The taped printout's key list. */
  card: [string, string][];
  /**
   * The bezel's keys for this screen: [key, word, run?]. With `run` it is a real key (a button); without, the pair
   * is printed on the plastic as a legend, so nothing that does nothing looks like it can be pressed.
   */
  keys: [string, string, (() => void)?][];
}

export interface Shell {
  geo: Geo;
  back: HTMLElement;
  front: HTMLElement;
  /** Recompute for the host's size; returns the new geometry. */
  layout(W: number, H: number): Geo;
  /** Pointer over the window, -1..1 (the room drifts behind the still monitor). */
  parallax(x: number, y: number): void;
  /** The drive's busy lamp. */
  busy(on: boolean): void;
  destroy(): void;
}

/** Build the set into `host`: `back` becomes its first child, `front` its last. */
export function mountShell(host: HTMLElement, o: ShellOpts): Shell {
  const back = document.createElement("div");
  back.className = "cmdx-back";
  back.setAttribute("aria-hidden", "true");
  back.innerHTML = `<style>${CSS}</style><canvas class="room"></canvas><div class="lamp"></div>`;
  const front = document.createElement("div");
  front.className = "cmdx-front";
  front.innerHTML = `<div class="mon"></div><div class="prop dbox" aria-hidden="true"></div><div class="prop drive" aria-hidden="true"></div><div class="prop card" aria-hidden="true"></div>`;
  host.prepend(back);
  host.append(front);
  const q = <T extends HTMLElement>(el: HTMLElement, s: string) => el.querySelector(s) as T;
  const room = q<HTMLCanvasElement>(back, ".room");
  const lamp = q(back, ".lamp");
  const mon = q(front, ".mon");
  const dbox = q(front, ".dbox");
  const drive = q(front, ".drive");
  const card = q(front, ".card");
  let geo = computeGeo(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight));
  let roomKey = "";
  let roomTimer = 0;
  let lampX = 0;

  function keysHtml(c: number): string {
    const f = silkSize(c);
    const gap = Math.round(f * 0.9);
    const parts = o.keys.map(([letter, word, run], i) => {
      if (run) {
        const k = keyCapSvg(c, letter, word, false);
        return { html: `<button type="button" class="kc" data-k="${i}" aria-label="${word} (${letter})">${k.svg}</button>`, w: k.w, h: k.h };
      }
      return { html: `<span class="legend" style="font-size:${f}px;line-height:${f}px"><b>${letter}</b> ${word}</span>`, w: (letter.length + 1 + word.length) * f, h: f };
    });
    const total = parts.reduce((s, p) => s + p.w, 0) + gap * (parts.length - 1);
    const at = keysOrigin(geo, total, Math.max(...parts.map((p) => p.h), f));
    return `<div class="keys" style="left:${at.left}px;top:${at.top}px;gap:${gap}px">${parts.map((p) => p.html).join("")}</div>`;
  }

  function props(): void {
    const p = propsGeo(geo, OTHER_DISKS.length);
    const put = (el: HTMLElement, r: Rect | null) => {
      el.style.display = r ? "" : "none";
      if (r) Object.assign(el.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
    };
    put(dbox, p.box);
    if (p.box) {
      const b = p.box;
      const disks = OTHER_DISKS.map((label, i) => `<div class="disk" style="left:${b.disks[i]!.x}px;top:${b.disks[i]!.y}px;z-index:${i + 2}">${floppySvg(b.disk, b.disk, label, i)}</div>`).join("");
      dbox.innerHTML = own(`<div style="left:0;top:${b.rise}px">${diskBoxSvg(b.geom, "back")}</div>${disks}<div style="left:0;top:${b.rise}px;z-index:20">${diskBoxSvg(b.geom, "front")}</div>`);
    }
    put(drive, p.drive);
    if (p.drive) drive.innerHTML = own(driveSvg(p.drive.w, p.drive.h, o.drive));
    const cr = cardRect(p, o.card);
    put(card, cr);
    // The card lies flat: its lines are to be read, and type on a tilted layer goes soft.
    if (cr) card.innerHTML = own(refCardSvg(cr.w, cr.h, o.card, cr.font));
    put(lamp, p.lamp);
    lampX = 0;
    if (p.lamp) {
      lamp.innerHTML = own(lampSvg(p.lamp.w, p.lamp.h));
      lampX = p.lamp.x + p.lamp.w * 0.35;
    }
  }

  function scheduleRoom(): void {
    clearTimeout(roomTimer);
    roomTimer = window.setTimeout(() => {
      const m = geo.mon ?? { x: 0, y: 0, w: geo.W, h: geo.H };
      const key = `${geo.W}x${geo.H}|${m.x},${m.y}|${lampX}`;
      if (key === roomKey) return;
      roomKey = key;
      const deskY = Math.round(Math.min(geo.H * 0.8, m.y + m.h * 0.62));
      drawRoom(room, { W: geo.W + 24, H: geo.H + 24, mon: { ...m, x: m.x + 12, y: m.y + 12 }, deskY: deskY + 12, glow: "rgba(40,60,255,A)", ...(lampX ? { lampX: lampX + 12 } : {}) });
    }, 30);
  }

  function layout(W: number, H: number): Geo {
    geo = computeGeo(Math.max(1, W), Math.max(1, H));
    const m = geo.mon;
    back.style.display = m ? "" : "none";
    if (m) {
      const g = geo.glass;
      Object.assign(mon.style, { display: "", left: `${m.x}px`, top: `${m.y}px`, width: `${m.w}px`, height: `${m.h}px` });
      mon.innerHTML = own(monitorSvg({ w: m.w, h: m.h, gx: g.x - m.x, gy: g.y - m.y, gw: g.w, gh: g.h, well: geo.well })) + keysHtml(geo.c);
      mon.querySelector("svg.housing")?.setAttribute("aria-hidden", "true");
    } else {
      mon.style.display = "none";
      mon.innerHTML = "";
    }
    props();
    if (m) scheduleRoom();
    return geo;
  }

  // The bezel's real keys.
  const onKeyClick = (e: MouseEvent) => {
    const b = (e.target as Element | null)?.closest<HTMLElement>("button.kc");
    if (b) o.keys[Number(b.dataset.k)]?.[2]?.();
  };
  front.addEventListener("click", onKeyClick);

  return {
    get geo() {
      return geo;
    },
    back,
    front,
    layout,
    parallax(x, y) {
      const qx = Math.round(x * 100) / 100;
      const qy = Math.round(y * 100) / 100;
      const t = (k: number) => `translate3d(${Math.round(-qx * k)}px, ${Math.round(-qy * k * 0.6)}px, 0)`;
      // The monitor is the still plane, and so is everything with words on it (the disks' labels, the card): only
      // the wall and the lamp behind it drift, by whole pixels, straight from the pointer.
      room.style.transform = t(-8);
      lamp.style.transform = t(-4);
    },
    busy(on) {
      front.classList.toggle("busy", on);
    },
    destroy() {
      clearTimeout(roomTimer);
      front.removeEventListener("click", onKeyClick);
      back.remove();
      front.remove();
    },
  };
}
