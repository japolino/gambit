/**
 * The Command theme's physical set for a fight or a talk: the same dark room, walnut desk, CRT monitor housing,
 * disk file box, external drive, printout and desk lamp the scene stands on (../../../scene/themes/command/props.ts),
 * so an encounter never leaves the monitor. The screen inside the glass is the caller's: the battle draws it in its
 * Pixi canvas, the Parley in DOM. Layers: `back` (room and lamp) goes under the screen, `front` (the housing, whose
 * glass is a hole, and the desk props) over it. On a phone there is no monitor: the screen is the whole window.
 *
 * The grid is the scene's: 48 x 30 cells of 8 x 8 virtual pixels on a wide window, a 16 px cell on a phone.
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
  W: number;
  H: number;
  /** One cell in screen pixels (a multiple of 8 when it can be). */
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

export const WIDE_COLS = 48;
export const WIDE_ROWS = 30;
const BEZ = { s: 2, t: 1, b: 2.6, well: 0.75 };

/** The scene's own geometry (../../../scene/themes/command.ts computeGeo), so the monitor does not move when a fight starts. */
export function computeGeo(W: number, H: number): Geo {
  const tall = W < 720 || W / Math.max(1, H) < 0.95;
  if (tall) {
    const c = W >= 600 ? 24 : W >= 352 ? 16 : 12;
    const cols = Math.max(20, Math.floor((W - 4) / c));
    const rows = Math.max(30, Math.floor((H - 4) / c));
    return { tall, W, H, c, cols, rows, glass: { x: 0, y: 0, w: W, h: H }, ox: Math.max(0, Math.floor((W - cols * c) / 2)), oy: Math.max(0, Math.floor((H - rows * c) / 2)), mon: null, well: 0, side: 0 };
  }
  const cols = WIDE_COLS;
  const rows = WIDE_ROWS;
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
  const spare = Math.max(0, H * 0.985 - (gh + 2 * well + (BEZ.t + BEZ.b) * c));
  const t = Math.round(BEZ.t * c + Math.min(spare * 0.35, c * 1.4));
  const b = Math.round(BEZ.b * c + Math.min(spare * 0.65, c * 2.2));
  const mw = gw + 2 * (s + well);
  const mh = gh + 2 * well + t + b;
  const mon = { x: Math.round((W - mw) / 2), y: Math.max(0, Math.round(H - mh - H * 0.012)), w: mw, h: mh };
  return { tall, W, H, c, cols, rows, glass: { x: mon.x + s + well, y: mon.y + t + well, w: gw, h: gh }, ox: c, oy: c, mon, well, side: s };
}

const OTHER_DISKS = ["Storybook", "Diorama", "Lobby", "Table", "1-bit"];

const CSS = `
.cmdx-back, .cmdx-front { position: absolute; inset: 0; pointer-events: none; overflow: hidden; font-family: "Gambit 8bit", monospace; }
.cmdx-back { z-index: 0; background: #050508; }
.cmdx-front { z-index: 3; }
.cmdx-back .room { position: absolute; left: -12px; top: -12px; width: calc(100% + 24px); height: calc(100% + 24px); display: block; }
.cmdx-back .lamp, .cmdx-front .prop { position: absolute; will-change: transform; }
.cmdx-back .lamp { filter: drop-shadow(10px 12px 14px rgba(0,0,0,.7)); }
.cmdx-front svg { display: block; }
.cmdx-front .mon { position: absolute; filter: drop-shadow(0 18px 26px rgba(0,0,0,.8)); }
.cmdx-front .mon > svg { position: absolute; left: 0; top: 0; }
.cmdx-front .keys { position: absolute; display: flex; align-items: center; }
.cmdx-front .kc { display: grid; justify-items: center; gap: 3px; font: 8px/8px "Gambit 8bit", monospace; color: #9a9ea6; }
.cmdx-front .dbox > div, .cmdx-front .disk { position: absolute; }
.cmdx-front .disk { filter: drop-shadow(0 -2px 3px rgba(0,0,0,.55)); }
.cmdx-front .drive { filter: drop-shadow(6px 10px 10px rgba(0,0,0,.65)); }
.cmdx-front .drive .dled-bloom { opacity: 0; }
.cmdx-front.busy .drive .dled { fill: #ff2200; animation: cmdxLed .35s steps(2) infinite; }
.cmdx-front.busy .drive .dled-bloom { opacity: 1; animation: cmdxLed .35s steps(2) infinite; }
.cmdx-front .card { transform-origin: 50% 100%; }
@keyframes cmdxLed { 50% { opacity: .25; } }
@media (prefers-reduced-motion: reduce) { .cmdx-front *, .cmdx-back * { animation: none !important; } }
`;

export interface ShellOpts {
  /** The label on the disk in the drive. */
  drive: string;
  /** The taped printout's key list. */
  card: [string, string][];
  /** The bezel keys' silk-screen words (decorative here: the screen has its own commands). */
  keys: [string, string][];
}

export interface Shell {
  geo: Geo;
  back: HTMLElement;
  front: HTMLElement;
  /** Recompute for the host's size; returns the new geometry. */
  layout(W: number, H: number): Geo;
  /** Pointer over the window, -1..1 (the desk props swing against the still monitor). */
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
  front.setAttribute("aria-hidden", "true");
  front.innerHTML = `<div class="prop dbox"></div><div class="mon"></div><div class="prop card"></div><div class="prop drive"></div>`;
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

  function keysHtml(m: Rect, c: number): string {
    const kw = Math.round(c * 2.6);
    const kh = Math.round(c * 1.5);
    const bezelTop = geo.glass.y - m.y + geo.glass.h + geo.well;
    const bh = m.h - bezelTop;
    const lab = c >= 24 ? 16 : 8;
    const caps = o.keys
      .map(([letter, word]) => `<div class="kc"><svg viewBox="0 0 ${kw} ${kh}" width="${kw}" height="${kh}">
        <rect x="0" y="3" width="${kw}" height="${kh - 3}" rx="3" fill="#060607"/>
        <rect x="2" y="0" width="${kw - 4}" height="${kh - 6}" rx="3" fill="#2c2f34" stroke="#000"/>
        <path d="M5,1.5 H${kw - 5}" stroke="#7a7e86" stroke-opacity=".8"/>
        <rect x="${kw - 14}" y="${(kh - 6) / 2 - 3}" width="8" height="6" rx="1" fill="#2a1a0a" stroke="#000" stroke-width=".6"/>
        <text x="${Math.round(kw * 0.34)}" y="${Math.round((kh - 6) / 2 + lab * 0.45)}" text-anchor="middle" font-family="Gambit 8bit" font-size="${lab}" fill="#e2e5ea">${letter}</text>
      </svg><span>${word}</span></div>`)
      .join("");
    const total = o.keys.length * kw + (o.keys.length - 1) * c * 0.5;
    const top = Math.round(bezelTop + (bh - kh - 11) / 2 + c * 0.1);
    return `<div class="keys" style="left:${Math.round(m.w / 2 - total / 2 + c * 1.5)}px;top:${top}px;gap:${c * 0.5}px">${caps}</div>`;
  }

  function props(): void {
    const m = geo.mon;
    const c = geo.c;
    const show = !!m && m.x > c * 5;
    for (const el of [dbox, drive, card, lamp]) el.style.display = show ? "" : "none";
    lampX = 0;
    if (!show || !m) return;
    const H = geo.H;
    const overlap = Math.round(geo.side * 1.15);
    const right = m.x + overlap;
    const bw = Math.round(Math.min(c * 19, right - c * 0.5));
    const bh = Math.round(bw * 0.62);
    const box = { w: bw, h: bh, fw: Math.round(bw * 0.8), dx: Math.round(bw * 0.2), dy: Math.round(bh * 0.22), ft: Math.round(bh * 0.38) };
    const dw = Math.round(box.fw * 0.84);
    const n = OTHER_DISKS.length;
    const step = Math.round(dw * 0.14);
    const rise = Math.round(dw * 0.3 + step * (n - 1));
    const bx = right - bw;
    const by = H + Math.round(c * 1.2) - bh;
    Object.assign(dbox.style, { left: `${bx}px`, top: `${by - rise}px`, width: `${bw}px`, height: `${bh + rise}px` });
    const disks = OTHER_DISKS.map((label, i) => {
      const k = n > 1 ? 1 - i / (n - 1) : 0;
      const x = Math.round(box.fw * 0.08 + box.dx * k * 0.8);
      const y = Math.round(rise + box.ft - dw * 0.3 - (n - 1 - i) * step - box.dy * k * 0.15);
      return `<div class="disk" style="left:${x}px;top:${y}px;z-index:${i + 2}">${floppySvg(dw, dw, label, i)}</div>`;
    }).join("");
    dbox.innerHTML = `<div style="left:0;top:${rise}px">${diskBoxSvg(box, "back")}</div>${disks}<div style="left:0;top:${rise}px;z-index:20">${diskBoxSvg(box, "front")}</div>`;
    const dvx = m.x + m.w - overlap;
    const dvw = Math.round(Math.min(c * 20, geo.W - dvx - c * 0.5));
    const dvh = Math.round(dvw * 0.42);
    const dvy = H + Math.round(c * 0.9) - dvh;
    Object.assign(drive.style, { left: `${dvx}px`, top: `${dvy}px` });
    drive.innerHTML = driveSvg(dvw, dvh, o.drive);
    const cw = Math.round(dvw * 0.62);
    const chh = Math.round(cw * 1.02);
    Object.assign(card.style, { left: `${dvx + Math.round(dvw * 0.22)}px`, top: `${dvy - chh + Math.round(dvh * 0.2)}px`, transform: "perspective(900px) rotateX(16deg) rotateZ(2deg)" });
    card.innerHTML = refCardSvg(cw, chh, o.card);
    const lw = Math.round(Math.min(c * 13, Math.max(c * 7, bx + bw * 0.5)));
    const lh = Math.round(lw * 1.9);
    const lx = Math.round(bx - lw * 0.62);
    Object.assign(lamp.style, { left: `${lx}px`, top: `${H - lh + Math.round(c * 0.4)}px` });
    lamp.innerHTML = lampSvg(lw, lh);
    lampX = lx + lw * 0.35;
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
      mon.innerHTML = monitorSvg({ w: m.w, h: m.h, gx: g.x - m.x, gy: g.y - m.y, gw: g.w, gh: g.h, well: geo.well }) + keysHtml(m, geo.c);
    } else {
      mon.style.display = "none";
      mon.innerHTML = "";
    }
    props();
    if (m) scheduleRoom();
    return geo;
  }

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
      room.style.transform = t(-8);
      lamp.style.transform = t(-4);
      dbox.style.transform = t(18);
      drive.style.transform = t(18);
      card.style.translate = `${Math.round(-qx * 16)}px ${Math.round(-qy * 9)}px`;
    },
    busy(on) {
      front.classList.toggle("busy", on);
    },
    destroy() {
      clearTimeout(roomTimer);
      back.remove();
      front.remove();
    },
  };
}
