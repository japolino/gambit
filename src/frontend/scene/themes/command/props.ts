/**
 * The physical things around the Command theme's screen: the room and desk
 * (a procedural canvas), the monitor's moulded plastic housing, the disk
 * file box whose floppies switch themes, the external drive whose light is
 * the busy indicator, the taped quick-reference card and a desk lamp in the
 * foreground. All SVG or canvas, drawn at the size they are shown.
 */
import { rng, seedOf } from "../contract.js";
import { canvas } from "./pixels.js";

/* --------------------------------- Noise -------------------------------- */

/** Value noise, smooth enough for grain and plastic. */
function noise2(seed: number) {
  const r = rng(seed);
  const N = 256;
  const p = Float32Array.from({ length: N * N }, () => r());
  const at = (x: number, y: number) => p[((y & (N - 1)) * N + (x & (N - 1)))]!;
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

let grain = "";
/** A tileable speckle for moulded ABS plastic (used as an SVG pattern). */
export function plasticGrain(): string {
  if (grain) return grain;
  const c = canvas(160, 160);
  const g = c.getContext("2d")!;
  const im = g.createImageData(160, 160);
  const r = rng(seedOf("abs-plastic"));
  for (let i = 0; i < im.data.length; i += 4) {
    const v = r();
    const on = v > 0.5;
    im.data[i] = im.data[i + 1] = im.data[i + 2] = on ? 255 : 0;
    im.data[i + 3] = Math.floor(Math.abs(v - 0.5) * 2 * 26);
  }
  g.putImageData(im, 0, 0);
  grain = c.toDataURL();
  return grain;
}

let paper = "";
/** Cheap card stock: warm fibres and blotches. */
export function paperGrain(): string {
  if (paper) return paper;
  const c = canvas(256, 256);
  const g = c.getContext("2d")!;
  const n = noise2(seedOf("card-stock"));
  const im = g.createImageData(256, 256);
  const r = rng(77);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const i = (y * 256 + x) * 4;
      const v = n(x / 22, y / 22) * 0.6 + n(x / 5, y / 5) * 0.25 + r() * 0.15;
      im.data[i] = 236 + v * 18;
      im.data[i + 1] = 214 + v * 16;
      im.data[i + 2] = 132 + v * 26;
      im.data[i + 3] = 255;
    }
  }
  g.putImageData(im, 0, 0);
  // Fibres.
  g.globalAlpha = 0.12;
  g.strokeStyle = "#7a5a20";
  for (let k = 0; k < 160; k++) {
    const x = r() * 256, y = r() * 256, a = r() * Math.PI;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * (4 + r() * 10), y + Math.sin(a) * (4 + r() * 10));
    g.stroke();
  }
  paper = c.toDataURL();
  return paper;
}

/* --------------------------------- Room --------------------------------- */

export interface RoomGeom {
  W: number;
  H: number;
  /** The monitor housing box. */
  mon: { x: number; y: number; w: number; h: number };
  /** Where the desk's back edge meets the wall. */
  deskY: number;
  /** The screen's glow colour. */
  glow: string;
  /** Where the lamp's light falls (x, in the same pixels). */
  lampX?: number;
}

/**
 * The dark room: a painted wall picking up the lamp's warm cone and the
 * screen's blue cast, and a walnut desk top in perspective with the
 * monitor's shadow on it. Drawn at half resolution (it is all soft).
 */
export function drawRoom(c: HTMLCanvasElement, o: RoomGeom): void {
  const s = 0.5;
  const W = Math.max(2, Math.round(o.W * s));
  const H = Math.max(2, Math.round(o.H * s));
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const n = noise2(seedOf("walnut"));
  const im = g.createImageData(W, H);
  const dy = o.deskY * s;
  const mx = (o.mon.x + o.mon.w / 2) * s;
  const r = rng(5);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      let R: number, G: number, B: number;
      if (y < dy) {
        // Wall: plaster with a faint vertical panel seam every so often.
        const v = n(x / 40, y / 40) * 0.5 + n(x / 6, y / 6) * 0.3 + r() * 0.2;
        const seam = Math.abs(((x / s) % 340) - 2) < 1.5 ? -6 : 0;
        R = 13 + v * 9 + seam;
        G = 14 + v * 9 + seam;
        B = 20 + v * 10 + seam;
      } else {
        // Desk: grain runs left-right, compressed with distance.
        const depth = (y - dy) / Math.max(1, H - dy);
        const zz = 1 / (0.25 + depth);
        const warp = n(x / 90, y / 14) * 6;
        const ring = Math.sin((y * zz * 0.9 + warp * 3 + n(x / 30, y / 4) * 2) * 1.3);
        const v = ring * 0.5 + 0.5;
        const k = n(x / 7, y * zz) * 0.35;
        R = 34 + v * 22 + k * 20;
        G = 20 + v * 12 + k * 10;
        B = 12 + v * 6 + k * 5;
      }
      im.data[i] = R;
      im.data[i + 1] = G;
      im.data[i + 2] = B;
      im.data[i + 3] = 255;
    }
  }
  g.putImageData(im, 0, 0);
  // The desk's back edge catches a little light.
  g.fillStyle = "rgba(255,210,150,.10)";
  g.fillRect(0, dy, W, 1.5);
  g.fillStyle = "rgba(0,0,0,.5)";
  g.fillRect(0, dy - 3, W, 3);
  // Screen glow on the wall and desk.
  const sg = g.createRadialGradient(mx, (o.mon.y + o.mon.h * 0.45) * s, 10, mx, (o.mon.y + o.mon.h * 0.45) * s, Math.max(W, H) * 0.55);
  sg.addColorStop(0, o.glow.replace("A", "0.30"));
  sg.addColorStop(0.45, o.glow.replace("A", "0.10"));
  sg.addColorStop(1, o.glow.replace("A", "0"));
  g.globalCompositeOperation = "lighter";
  g.fillStyle = sg;
  g.fillRect(0, 0, W, H);
  // The lamp's warm cone from the upper left.
  const lx = o.lampX !== undefined ? o.lampX * s : W * 0.06, ly = H * 0.12;
  const lg = g.createRadialGradient(lx, ly + H * 0.5, 5, lx, ly + H * 0.5, W * 0.32);
  lg.addColorStop(0, "rgba(255,170,80,.30)");
  lg.addColorStop(0.5, "rgba(255,140,60,.10)");
  lg.addColorStop(1, "rgba(255,140,60,0)");
  g.fillStyle = lg;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = "source-over";
  // The monitor's contact shadow on the desk.
  const sh = g.createRadialGradient(mx, (o.mon.y + o.mon.h) * s, 4, mx, (o.mon.y + o.mon.h) * s, (o.mon.w * s) / 1.4);
  sh.addColorStop(0, "rgba(0,0,0,.75)");
  sh.addColorStop(1, "rgba(0,0,0,0)");
  g.save();
  g.translate(0, (o.mon.y + o.mon.h) * s);
  g.scale(1, 0.18);
  g.translate(0, -(o.mon.y + o.mon.h) * s);
  g.fillStyle = sh;
  g.fillRect(0, 0, W, H * 6);
  g.restore();
  // Room vignette: the corners fall off to black.
  const vg = g.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.62);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,.88)");
  g.fillStyle = vg;
  g.fillRect(0, 0, W, H);
  // On a very wide window the outer quarters fall away so the desk cluster holds the eye.
  if (W > H * 2) {
    for (const [x0, x1] of [[0, W * 0.25], [W, W * 0.75]] as const) {
      const eg = g.createLinearGradient(x0, 0, x1, 0);
      eg.addColorStop(0, "rgba(0,0,0,.92)");
      eg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = eg;
      g.fillRect(Math.min(x0, x1), 0, W * 0.25, H);
    }
  }
}

/* -------------------------------- Monitor ------------------------------- */

export interface MonitorGeom {
  w: number;
  h: number;
  /** The glass inside the housing. */
  gx: number;
  gy: number;
  gw: number;
  gh: number;
  /** Width of the recessed well sloping from the plastic down to the glass. */
  well: number;
}

/**
 * The monitor housing: a warm charcoal ABS shell with a speckled finish and
 * a lit top edge, a deep recessed well of four sloping planes (top darkest,
 * bottom catching the most light) that picks up the screen's blue spill,
 * the tube's rounded corners, a cooling grille, the badge, two knobs and the
 * power lamp. The glass itself is a hole, so the screen shows through it.
 * Nothing is printed on it smaller than can be read: the chin's legends are
 * the keys' own (../../../stage/themes/command/shell.ts keyCapSvg).
 */
export function monitorSvg(m: MonitorGeom): string {
  const { w, h, gx, gy, gw, gh, well } = m;
  const R = Math.min(w, h) * 0.04;
  const rr = Math.max(6, Math.min(gw, gh) * 0.035);
  const ex = gx - well, ey = gy - well, ew = gw + well * 2, eh = gh + well * 2;
  const shell = `M${R},0 H${w - R} Q${w},0 ${w},${R} V${h - R} Q${w},${h} ${w - R},${h} H${R} Q0,${h} 0,${h - R} V${R} Q0,0 ${R},0Z`;
  const hole = `M${gx},${gy} H${gx + gw} V${gy + gh} H${gx}Z`;
  // The tube's face: each edge bows out to the opening at its middle and falls back toward the corners, which is
  // where the glass's curve is seen. It is drawn here, in the mask, so the picture itself is never warped.
  const bow = Math.max(3, Math.min(gw, gh) * 0.012);
  const round =
    `M${gx + rr},${gy + bow} Q${gx + gw / 2},${gy - bow} ${gx + gw - rr},${gy + bow} Q${gx + gw - bow},${gy + bow} ${gx + gw - bow},${gy + rr} ` +
    `Q${gx + gw + bow},${gy + gh / 2} ${gx + gw - bow},${gy + gh - rr} Q${gx + gw - bow},${gy + gh - bow} ${gx + gw - rr},${gy + gh - bow} ` +
    `Q${gx + gw / 2},${gy + gh + bow} ${gx + rr},${gy + gh - bow} Q${gx + bow},${gy + gh - bow} ${gx + bow},${gy + gh - rr} ` +
    `Q${gx - bow},${gy + gh / 2} ${gx + bow},${gy + rr} Q${gx + bow},${gy + bow} ${gx + rr},${gy + bow}Z`;
  const P = (pts: number[][]) => pts.map((p) => p.join(",")).join(" ");
  const top = P([[ex, ey], [ex + ew, ey], [gx + gw, gy], [gx, gy]]);
  const bot = P([[ex, ey + eh], [ex + ew, ey + eh], [gx + gw, gy + gh], [gx, gy + gh]]);
  const left = P([[ex, ey], [gx, gy], [gx, gy + gh], [ex, ey + eh]]);
  const right = P([[ex + ew, ey], [gx + gw, gy], [gx + gw, gy + gh], [ex + ew, ey + eh]]);
  const chin = gy + gh + well;
  const by = chin + (h - chin) * 0.5;
  const vents = Array.from({ length: 26 }, (_, i) => {
    const x = w * 0.5 - 13 * 15 + i * 15;
    const vy = Math.max(3, ey * 0.22);
    const vh = Math.max(3, ey * 0.3);
    return `<rect x="${x}" y="${vy}" width="8" height="${vh}" rx="1.5" fill="#060605"/><rect x="${x}" y="${vy + vh}" width="8" height="1" fill="#fff" opacity=".08"/>`;
  }).join("");
  const kr = Math.max(7, (h - chin) * 0.18);
  const knob = (cx: number, a: number) => {
    const ticks = Array.from({ length: 20 }, (_, i) => {
      const t = (i / 20) * Math.PI * 2;
      return `<line x1="${cx + Math.cos(t) * kr * 0.84}" y1="${by + Math.sin(t) * kr * 0.84}" x2="${cx + Math.cos(t) * kr}" y2="${by + Math.sin(t) * kr}" stroke="#000" stroke-opacity=".6" stroke-width="1.2"/>`;
    }).join("");
    return `<g><ellipse cx="${cx + 2}" cy="${by + kr * 0.5}" rx="${kr * 1.15}" ry="${kr * 0.9}" fill="#000" opacity=".55"/><circle cx="${cx}" cy="${by}" r="${kr * 1.14}" fill="url(#cmdWell)"/>
      <circle cx="${cx}" cy="${by}" r="${kr}" fill="url(#cmdKnob)"/>${ticks}<circle cx="${cx}" cy="${by}" r="${kr * 0.62}" fill="url(#cmdKnobTop)"/>
      <line x1="${cx}" y1="${by}" x2="${cx + Math.cos(a) * kr * 0.55}" y2="${by + Math.sin(a) * kr * 0.55}" stroke="#e0dccf" stroke-width="2" stroke-linecap="round"/></g>`;
  };
  // The desk props stand over the chin's corners: the badge and the knobs sit inside them.
  const inset = gw * 0.035;
  const badgeH = Math.max(18, kr * 1.7);
  const fs = Math.max(10, Math.round(badgeH * 0.5));
  const badgeW = Math.max(fs * 7.4, gw * 0.09);
  const spill = (id: string, x1: number, y1: number, x2: number, y2: number) =>
    `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="#2a5cff" stop-opacity=".26"/><stop offset=".55" stop-color="#2a5cff" stop-opacity=".07"/><stop offset="1" stop-color="#2a5cff" stop-opacity="0"/></linearGradient>`;
  return `<svg class="housing" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
  <defs>
    <linearGradient id="cmdShell" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#46423c"/><stop offset=".05" stop-color="#34312c"/><stop offset=".5" stop-color="#262421"/><stop offset="1" stop-color="#141311"/></linearGradient>
    <linearGradient id="cmdSide" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset=".07" stop-color="#000" stop-opacity="0"/><stop offset=".93" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></linearGradient>
    ${spill("cmdSpT", 0, gy, 0, ey)}${spill("cmdSpB", 0, gy + gh, 0, ey + eh)}${spill("cmdSpL", gx, 0, ex, 0)}${spill("cmdSpR", gx + gw, 0, ex + ew, 0)}
    <radialGradient id="cmdKnob" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#57534c"/><stop offset=".6" stop-color="#2a2824"/><stop offset="1" stop-color="#0e0d0c"/></radialGradient>
    <radialGradient id="cmdKnobTop" cx=".4" cy=".3" r=".9"><stop offset="0" stop-color="#47433d"/><stop offset="1" stop-color="#1b1a18"/></radialGradient>
    <radialGradient id="cmdWell" cx=".5" cy=".5" r=".5"><stop offset=".7" stop-color="#050505"/><stop offset="1" stop-color="#2c2a26"/></radialGradient>
    <linearGradient id="cmdPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4d0c4"/><stop offset=".45" stop-color="#99958b"/><stop offset=".55" stop-color="#7f7b73"/><stop offset="1" stop-color="#b2aea4"/></linearGradient>
    <radialGradient id="cmdLed" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff2c0"/><stop offset=".35" stop-color="#ff5a1a"/><stop offset="1" stop-color="#ff3300" stop-opacity="0"/></radialGradient>
    <pattern id="cmdGrain" width="160" height="160" patternUnits="userSpaceOnUse"><image href="${plasticGrain()}" width="160" height="160"/></pattern>
    <filter id="cmdBloom" x="-2" y="-2" width="5" height="5"><feGaussianBlur stdDeviation="${Math.max(2, kr * 0.5)}"/></filter>
  </defs>
  <path d="${shell} ${hole}" fill="url(#cmdShell)" fill-rule="evenodd"/>
  <path d="${shell} ${hole}" fill="url(#cmdGrain)" fill-rule="evenodd"/>
  <path d="${shell} ${hole}" fill="url(#cmdSide)" fill-rule="evenodd"/>
  <path d="M${R},1 H${w - R}" stroke="#fff" stroke-opacity=".18" stroke-width="1.5"/>
  <path d="M1,${R} V${h - R}" stroke="#fff" stroke-opacity=".06" stroke-width="1"/>
  ${vents}
  <rect x="${ex - 3}" y="${ey - 3}" width="${ew + 6}" height="${eh + 6}" rx="${rr}" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="3"/>
  <path d="M${ex},${ey + eh + 2} H${ex + ew}" stroke="#fff" stroke-opacity=".12" stroke-width="1.5"/>
  <polygon points="${top}" fill="#0f0f12"/><polygon points="${bot}" fill="#24242a"/><polygon points="${left}" fill="#18181c"/><polygon points="${right}" fill="#18181c"/>
  <polygon points="${top}" fill="url(#cmdSpT)"/><polygon points="${bot}" fill="url(#cmdSpB)"/><polygon points="${left}" fill="url(#cmdSpL)"/><polygon points="${right}" fill="url(#cmdSpR)"/>
  <path d="M${ex},${ey} L${gx},${gy} M${ex + ew},${ey} L${gx + gw},${gy} M${ex},${ey + eh} L${gx},${gy + gh} M${ex + ew},${ey + eh} L${gx + gw},${gy + gh}" stroke="#000" stroke-opacity=".5" stroke-width="1"/>
  <path d="${hole} ${round}" fill="#050505" fill-rule="evenodd"/>
  <path d="${round}" fill="none" stroke="#000" stroke-width="2.5"/>
  <g transform="translate(${gx + inset} ${by})">
    <rect x="0" y="${-badgeH / 2}" width="${badgeW}" height="${badgeH}" rx="2" fill="url(#cmdPlate)" stroke="#1a1a1a" stroke-width="1"/>
    <rect x="3" y="${-badgeH / 2 + 3}" width="${badgeW - 6}" height="${badgeH - 6}" rx="1" fill="none" stroke="#5c5a54" stroke-width=".8"/>
    <text x="${badgeW / 2 + 0.8}" y="${fs * 0.42 + 1}" text-anchor="middle" font-family="Gambit 8bit" font-size="${fs}" fill="#fff" fill-opacity=".35">GAMBIT</text>
    <text x="${badgeW / 2}" y="${fs * 0.42}" text-anchor="middle" font-family="Gambit 8bit" font-size="${fs}" fill="#1b1b1c">GAMBIT</text>
  </g>
  ${knob(gx + gw - inset - kr * 7.4, -2.2)}
  ${knob(gx + gw - inset - kr * 4.5, -0.9)}
  <g transform="translate(${gx + gw - inset - kr * 1.4} ${by})">
    <rect x="${-kr * 1.1}" y="${-kr * 0.8}" width="${kr * 2.2}" height="${kr * 1.6}" rx="2" fill="#0b0b0a" stroke="#45413b" stroke-width="1"/>
    <rect x="${-kr * 0.9}" y="${-kr * 0.62}" width="${kr * 1.8}" height="${kr * 0.7}" rx="1.5" fill="#2c2a26"/>
    <circle cx="0" cy="${kr * 0.42}" r="${kr * 0.9}" fill="url(#cmdLed)" filter="url(#cmdBloom)"/>
    <circle cx="0" cy="${kr * 0.42}" r="${Math.max(1.6, kr * 0.2)}" fill="#ffd2a0"/>
  </g>
</svg>`;
}

/* ---------------------------- Floppy disk box ---------------------------- */

const DISK_TINT = ["#c8402f", "#2f6fc8", "#e0b43a", "#3f9a4e", "#9a4fc0", "#e07a2f", "#3fb0b0"];

/** One 5.25" floppy (w x h): a black paper jacket, reinforced hub, write-protect notch, and a worn sticker printed with `label`. */
export function floppySvg(w: number, h: number, label: string, i: number): string {
  const tint = DISK_TINT[i % DISK_TINT.length]!;
  // The sticker is the disk's name and the reason to click it: a fifth of the jacket, its type as big as fits.
  const lw = w * 0.92;
  const lh = h * 0.19;
  const fs = Math.max(8, Math.floor(Math.min(lh * 0.6, lw / (label.length + 0.6))));
  const r = rng(seedOf(label));
  const smudges = Array.from({ length: 4 }, () => `<ellipse cx="${r() * lw}" cy="${lh * (0.3 + r() * 0.6)}" rx="${3 + r() * 8}" ry="${1.5 + r() * 3}" fill="#5a4a30" opacity="${0.06 + r() * 0.1}"/>`).join("");
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
    <defs><linearGradient id="fj${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a2a2b"/><stop offset=".45" stop-color="#1a1a1a"/><stop offset="1" stop-color="#0c0c0c"/></linearGradient>
    <pattern id="fg${i}" width="160" height="160" patternUnits="userSpaceOnUse"><image href="${plasticGrain()}" width="160" height="160"/></pattern>
    <pattern id="fp${i}" width="256" height="256" patternUnits="userSpaceOnUse"><image href="${paperGrain()}" width="256" height="256"/></pattern></defs>
    <rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" fill="url(#fj${i})" stroke="#000"/>
    <rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" fill="url(#fg${i})"/>
    <path d="M1,1 H${w - 1}" stroke="#6a6a6e" stroke-width="1"/>
    <path d="M1.5,1 V${h - 1}" stroke="#3a3a3e" stroke-width="1"/>
    <rect x="${w - 4}" y="${h * 0.28}" width="4" height="${h * 0.08}" fill="#000"/>
    <circle cx="${w / 2}" cy="${h * 0.6}" r="${w * 0.17}" fill="#0a0a0a" stroke="#2c2c2e" stroke-width="1.2"/>
    <circle cx="${w / 2}" cy="${h * 0.6}" r="${w * 0.12}" fill="#4a3826" stroke="#6a5236" stroke-width="1"/>
    <circle cx="${w / 2}" cy="${h * 0.6}" r="${w * 0.075}" fill="#050505"/>
    <rect x="${w * 0.45}" y="${h * 0.8}" width="${w * 0.1}" height="${h * 0.17}" rx="${w * 0.05}" fill="#050505" stroke="#2a2a2c"/>
    <g transform="translate(${(w - lw) / 2} ${h * 0.012}) rotate(${((r() - 0.5) * 1.2).toFixed(2)})">
      <rect width="${lw}" height="${lh}" fill="url(#fp${i})"/>
      <rect width="${lw}" height="${lh * 0.16}" fill="${tint}"/>
      ${smudges}
      <text x="${lw / 2}" y="${lh * 0.2 + (lh * 0.8 + fs * 0.78) / 2}" text-anchor="middle" font-family="Gambit 8bit" font-size="${fs}" fill="#1a130b">${label.toUpperCase()}</text>
    </g>
  </svg>`;
}

/** The disk file box in three-quarter view. */
export interface BoxGeom {
  w: number;
  h: number;
  /** Front face width, and the depth offset (up and to the right, toward the monitor). */
  fw: number;
  dx: number;
  dy: number;
  /** Top of the front face. */
  ft: number;
}

/** The box as the back layer (inside walls) and the front layer (front face, side wall, rim) the disks stand between. */
export function diskBoxSvg(g: BoxGeom, part: "back" | "front", sticker = "THEMES"): string {
  const { w, h, fw, dx, dy, ft } = g;
  // The sticker says what the disks in the box are for, at a size that reads.
  const sf = Math.max(8, Math.floor(Math.min((fw * 0.74) / (sticker.length + 0.5), (h - ft) * 0.2)));
  const defs = `<defs>
    <linearGradient id="dbF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8bca2"/><stop offset=".15" stop-color="#b3a78c"/><stop offset="1" stop-color="#6f6652"/></linearGradient>
    <linearGradient id="dbS" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8d836c"/><stop offset="1" stop-color="#5f5745"/></linearGradient>
    <linearGradient id="dbI" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4434"/><stop offset="1" stop-color="#1c1912"/></linearGradient>
    <pattern id="dbG" width="160" height="160" patternUnits="userSpaceOnUse"><image href="${plasticGrain()}" width="160" height="160"/></pattern>
  </defs>`;
  if (part === "back") {
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${defs}
      <polygon points="${dx},${ft - dy} ${fw + dx},${ft - dy} ${fw + dx},${h} ${dx},${h}" fill="url(#dbI)"/>
      <polygon points="0,${ft} ${dx},${ft - dy} ${dx},${h} 0,${h}" fill="#2a261c"/>
      <path d="M${dx},${ft - dy} H${fw + dx}" stroke="#d8ccb0" stroke-width="2"/>
      <path d="M0,${ft} L${dx},${ft - dy}" stroke="#a89c80" stroke-width="2"/>
    </svg>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${defs}
    <polygon points="${fw},${ft} ${fw + dx},${ft - dy} ${fw + dx},${h - dy} ${fw},${h}" fill="url(#dbS)"/>
    <polygon points="${fw},${ft} ${fw + dx},${ft - dy} ${fw + dx},${h - dy} ${fw},${h}" fill="url(#dbG)"/>
    <path d="M${fw + dx},${ft - dy} V${h}" stroke="#d8ccb0" stroke-width="2"/>
    <rect x="0" y="${ft}" width="${fw}" height="${h - ft}" fill="url(#dbF)"/>
    <rect x="0" y="${ft}" width="${fw}" height="${h - ft}" fill="url(#dbG)"/>
    <path d="M0,${ft + 1} H${fw} L${fw + dx},${ft - dy + 1}" stroke="#ece2c8" stroke-width="2.5" fill="none"/>
    <path d="M${fw},${ft} V${h}" stroke="#4e4738" stroke-width="2"/>
    <rect x="${fw * 0.08}" y="${ft + (h - ft) * 0.12}" width="${fw * 0.84}" height="${(h - ft) * 0.05}" fill="#000" opacity=".25"/>
    <g transform="translate(${fw * 0.5} ${ft + (h - ft) * 0.42})">
      <rect x="${-fw * 0.4}" y="${-sf * 0.95}" width="${fw * 0.8}" height="${sf * 1.9}" fill="#e9dfc4" stroke="#7a705a"/>
      <text x="0" y="${sf * 0.4}" text-anchor="middle" font-family="Gambit 8bit" font-size="${sf}" fill="#3a2a1a">${sticker}</text>
    </g>
  </svg>`;
}

/* ------------------------------ Disk drive ------------------------------- */

/**
 * The external 5.25" drive in three-quarter view (its top and left side
 * recede toward the monitor): slot, a chunky latch casting a shadow, the
 * inserted disk's edge with its label, and a red busy lamp (class "dled").
 */
export function driveSvg(w: number, h: number, inserted = ""): string {
  const pf = Math.max(8, Math.round(h * 0.085));
  const dx = w * 0.14;
  const dy = h * 0.3;
  const fx = dx;
  const fy = dy;
  const fw = w - dx;
  const fh = h - dy;
  const sy = fy + fh * 0.42;
  const P = (pts: number[][]) => pts.map((p) => p.join(",")).join(" ");
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
    <defs>
      <linearGradient id="dvT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34353a"/><stop offset="1" stop-color="#4c4e54"/></linearGradient>
      <linearGradient id="dvS" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0d0e10"/><stop offset="1" stop-color="#1e1f23"/></linearGradient>
      <linearGradient id="dvF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#303238"/><stop offset="1" stop-color="#15161a"/></linearGradient>
      <linearGradient id="dvLv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a6d74"/><stop offset=".2" stop-color="#43464c"/><stop offset="1" stop-color="#1c1d21"/></linearGradient>
      <radialGradient id="dvL" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd0b0"/><stop offset=".35" stop-color="#ff2200"/><stop offset="1" stop-color="#ff2200" stop-opacity="0"/></radialGradient>
      <pattern id="dvG" width="160" height="160" patternUnits="userSpaceOnUse"><image href="${plasticGrain()}" width="160" height="160"/></pattern>
      <pattern id="dvP" width="256" height="256" patternUnits="userSpaceOnUse"><image href="${paperGrain()}" width="256" height="256"/></pattern>
      <filter id="dvB" x="-2" y="-2" width="5" height="5"><feGaussianBlur stdDeviation="${h * 0.05}"/></filter>
    </defs>
    <polygon points="${P([[fx, fy], [w, fy], [w - dx, 0], [0, 0]])}" fill="url(#dvT)"/>
    <polygon points="${P([[fx, fy], [w, fy], [w - dx, 0], [0, 0]])}" fill="url(#dvG)"/>
    ${Array.from({ length: 9 }, (_, i) => `<path d="M${w * 0.24 + i * w * 0.07},${fy * 0.2} l${-dx * 0.55},${fy * 0.55}" stroke="#000" stroke-opacity=".4" stroke-width="2.5"/>`).join("")}
    <polygon points="${P([[0, 0], [fx, fy], [fx, h], [0, h - dy * 0.2]])}" fill="url(#dvS)"/>
    <rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" fill="url(#dvF)"/>
    <rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" fill="url(#dvG)"/>
    <path d="M${fx},${fy} H${w} M${fx},${fy} L0,0" stroke="#7a7d84" stroke-width="1.2"/>
    <rect x="${fx + fw * 0.08}" y="${sy - fh * 0.07}" width="${fw * 0.68}" height="${fh * 0.14}" rx="2" fill="#050506" stroke="#3a3d42"/>
    ${inserted
      ? `<rect x="${fx + fw * 0.12}" y="${sy - fh * 0.03}" width="${fw * 0.6}" height="${fh * 0.05}" fill="#141416"/>
      <rect x="${fx + fw * 0.15}" y="${sy - fh * 0.028}" width="${fw * 0.26}" height="${fh * 0.042}" fill="url(#dvP)"/>
      <text x="${fx + fw * 0.28}" y="${sy + fh * 0.01}" text-anchor="middle" font-family="Gambit 8bit" font-size="${Math.max(6, Math.round(fh * 0.05))}" fill="#2b2218">${inserted.toUpperCase()}</text>`
      : `<rect x="${fx + fw * 0.12}" y="${sy - fh * 0.01}" width="${fw * 0.6}" height="${fh * 0.02}" fill="#000"/>`}
    <rect x="${fx + fw * 0.44}" y="${sy + fh * 0.12}" width="${fw * 0.12}" height="${fh * 0.08}" fill="#000" opacity=".5"/>
    <rect x="${fx + fw * 0.44}" y="${sy - fh * 0.2}" width="${fw * 0.1}" height="${fh * 0.34}" rx="3" fill="url(#dvLv)" stroke="#0a0a0b"/>
    <rect x="${fx + fw * 0.45}" y="${sy - fh * 0.19}" width="${fw * 0.08}" height="${fh * 0.035}" rx="1.5" fill="#9a9da4" opacity=".7"/>
    <rect class="dled-bloom" x="${fx + fw * 0.79}" y="${sy - fh * 0.12}" width="${fw * 0.14}" height="${fh * 0.24}" fill="url(#dvL)" filter="url(#dvB)"/>
    <rect class="dled" x="${fx + fw * 0.83}" y="${sy - fh * 0.03}" width="${fw * 0.06}" height="${fh * 0.06}" fill="#3a0a04" stroke="#000"/>
    <text x="${fx + fw * 0.08}" y="${fy + fh * 0.86}" font-family="Gambit 8bit" font-size="${pf}" fill="#9a9da4" fill-opacity=".8">DRIVE A:</text>
  </svg>`;
}

/* ------------------------------ Desk lamp ------------------------------- */

/** A desk lamp leaning in from the left edge, cropped by the window: base, two arms, a shade with a hot bulb. */
export function lampSvg(w: number, h: number): string {
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
    <defs>
      <linearGradient id="lpM" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0d0e10"/><stop offset=".55" stop-color="#3a3c40"/><stop offset=".7" stop-color="#6a6c70"/><stop offset="1" stop-color="#151618"/></linearGradient>
      <linearGradient id="lpS" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b3a2a"/><stop offset=".6" stop-color="#0d1f16"/><stop offset="1" stop-color="#050a07"/></linearGradient>
      <radialGradient id="lpB" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fffbe8"/><stop offset=".3" stop-color="#ffd890" stop-opacity=".9"/><stop offset="1" stop-color="#ff9a40" stop-opacity="0"/></radialGradient>
      <filter id="lpG" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="${w * 0.04}"/></filter>
    </defs>
    <path d="M${w * 0.05},${h} L${w * 0.12},${h * 0.93} H${w * 0.62} L${w * 0.7},${h}Z" fill="#0b0c0e"/>
    <ellipse cx="${w * 0.37}" cy="${h * 0.93}" rx="${w * 0.25}" ry="${h * 0.02}" fill="#2a2c30"/>
    <path d="M${w * 0.34},${h * 0.93} L${w * 0.58},${h * 0.52}" stroke="url(#lpM)" stroke-width="${w * 0.045}" stroke-linecap="round"/>
    <path d="M${w * 0.58},${h * 0.52} L${w * 0.28},${h * 0.16}" stroke="url(#lpM)" stroke-width="${w * 0.04}" stroke-linecap="round"/>
    <circle cx="${w * 0.58}" cy="${h * 0.52}" r="${w * 0.04}" fill="#1a1b1e" stroke="#555" stroke-width="1"/>
    <path d="M${w * 0.47},${h * 0.62} L${w * 0.55},${h * 0.52}" stroke="#8a8c90" stroke-width="1.2"/>
    <g transform="rotate(28 ${w * 0.28} ${h * 0.16})">
      <path d="M${w * 0.16},${h * 0.1} L${w * 0.4},${h * 0.1} L${w * 0.66},${h * 0.3} L${w * -0.1},${h * 0.3}Z" fill="url(#lpS)" stroke="#000" stroke-width="1.5"/>
      <path d="M${w * 0.16},${h * 0.1} L${w * 0.4},${h * 0.1}" stroke="#4a8a6a" stroke-width="1.5" stroke-opacity=".6"/>
      <ellipse cx="${w * 0.28}" cy="${h * 0.3}" rx="${w * 0.38}" ry="${h * 0.025}" fill="#fff4d0" opacity=".9"/>
      <ellipse cx="${w * 0.28}" cy="${h * 0.31}" rx="${w * 0.42}" ry="${h * 0.08}" fill="url(#lpB)" filter="url(#lpG)"/>
    </g>
  </svg>`;
}

/* -------------------------- Quick-reference card ------------------------ */

/** The key card: a torn-off length of tractor-feed printout, folded once, in tired ribbon ink. */
export function refCardSvg(w: number, h: number, lines: [string, string][], font = 13): string {
  const lh = Math.round(font * 1.7);
  const y0 = Math.round(font * 2.6);
  const keyW = Math.max(...lines.map(([k]) => k.length)) + 1;
  const holes = Array.from({ length: Math.floor(h / 14) }, (_, i) => `<circle cx="${w * 0.045}" cy="${10 + i * 14}" r="2.6" fill="#1a120a" opacity=".85"/><circle cx="${w * 0.955}" cy="${10 + i * 14}" r="2.6" fill="#1a120a" opacity=".85"/>`).join("");
  const rows = lines
    .map(([k, t], i) => `<text x="${w * 0.12}" y="${y0 + lh * (i + 1.2)}" font-family="Gambit 8bit" font-size="${font}" fill="#2b2218">${k}</text><text x="${w * 0.12 + keyW * font}" y="${y0 + lh * (i + 1.2)}" font-family="Gambit 8bit" font-size="${font}" fill="#2b2218" fill-opacity=".8">${t.toUpperCase()}</text>`)
    .join("");
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
    <defs><pattern id="rcP" width="256" height="256" patternUnits="userSpaceOnUse"><image href="${paperGrain()}" width="256" height="256"/></pattern>
    <linearGradient id="rcF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".47" stop-color="#000" stop-opacity=".16"/><stop offset=".5" stop-color="#fff" stop-opacity=".25"/><stop offset=".53" stop-color="#000" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".1"/></linearGradient>
    <filter id="rcS" x="-.2" y="-.2" width="1.4" height="1.4"><feDropShadow dx="4" dy="6" stdDeviation="5" flood-color="#000" flood-opacity=".75"/></filter></defs>
    <path d="M${w * 0.02},${h * 0.03} L${w * 0.98},0 L${w * 0.985},${h} L${w * 0.015},${h * 0.985}Z" fill="url(#rcP)" filter="url(#rcS)"/>
    <path d="M${w * 0.02},${h * 0.03} L${w * 0.98},0 L${w * 0.985},${h} L${w * 0.015},${h * 0.985}Z" fill="url(#rcF)"/>
    <path d="M${w * 0.09},0 V${h} M${w * 0.91},0 V${h}" stroke="#8a7a5a" stroke-width=".8" stroke-dasharray="1 2"/>
    ${holes}
    <text x="${w * 0.12}" y="${Math.round(font * 2.1)}" font-family="Gambit 8bit" font-size="${font}" fill="#2b2218">KEYS</text>
    <path d="M${w * 0.12},${y0} H${w * 0.88}" stroke="#2b2218" stroke-opacity=".6" stroke-dasharray="2 1"/>
    ${rows}
  </svg>`;
}
