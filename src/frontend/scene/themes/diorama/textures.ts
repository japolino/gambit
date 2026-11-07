/**
 * Procedural canvas textures for the diorama theme: honey-oak counter grain,
 * a walnut bookcase and a market-stall stack for the side wings, and laid
 * paper for tags, postcards and the journal. Each is generated once per page
 * (seeded, so it never changes between renders) and cached at module level.
 */
import { rng } from "../contract.js";

/** 2D value noise on a seeded 256² lattice (smooth, cheap, tileable at 256). */
function valueNoise(seed: number): (x: number, y: number) => number {
  const r = rng(seed);
  const N = 256;
  const g = new Float32Array(N * N);
  for (let i = 0; i < g.length; i++) g[i] = r();
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const x0 = xi & 255, x1 = (xi + 1) & 255, y0 = (yi & 255) * N, y1 = ((yi + 1) & 255) * N;
    const a = g[y0 + x0]!, b = g[y0 + x1]!, c = g[y1 + x0]!, d = g[y1 + x1]!;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

function fbm(n: (x: number, y: number) => number, x: number, y: number, oct: number): number {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    s += n(x * f, y * f) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return s / norm;
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!];
}

/**
 * Plank wood in plane space: long axis is X (the counter's length), boards
 * stacked in Y (the counter's depth). Grain is stretched along X with growth
 * rings warped by low-frequency noise, per-board tint, seams, butt joints and
 * a few knots. `tone` picks honey oak (counter top) or dark walnut (casework).
 */
export function plankTexture(seed: number, w: number, h: number, boards: number, tone: "oak" | "walnut"): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  const img = g.createImageData(w, h);
  const d = img.data;
  const n1 = valueNoise(seed);
  const n2 = valueNoise(seed + 17);
  const r = rng(seed + 5);
  const ph = h / boards;
  const pal = tone === "oak"
    ? { dark: [104, 58, 24], mid: [179, 116, 61], light: [214, 158, 96] }
    : { dark: [30, 17, 9], mid: [66, 39, 21], light: [104, 66, 38] };
  const tints = Array.from({ length: boards }, () => 0.86 + r() * 0.24);
  const joints = Array.from({ length: boards }, () => [r() * w * 0.4 + w * 0.05, r() * w * 0.4 + w * 0.55]);
  const knots = Array.from({ length: boards * 2 }, (_, i) => ({ b: i % boards, x: r() * w, y: (0.25 + r() * 0.5) * ph, rx: 10 + r() * 22, ry: 4 + r() * 6 }));
  for (let y = 0; y < h; y++) {
    const b = Math.min(boards - 1, Math.floor(y / ph));
    const yy = y - b * ph;
    for (let x = 0; x < w; x++) {
      // Growth rings: bands along X, warped so they meander like flat-sawn oak.
      let ry = yy + fbm(n1, x * 0.0035 + b * 9.1, yy * 0.012 + b * 3.3, 3) * 46;
      for (const k of knots) {
        if (k.b !== b) continue;
        const dx = (x - k.x) / (k.rx * 3), dy = (yy - k.y) / (k.ry * 3);
        const dd = dx * dx + dy * dy;
        if (dd < 1) ry += (1 - dd) * 18 * Math.sign(yy - k.y);
      }
      const rings = 0.5 + 0.5 * Math.sin(ry * 0.42);
      const fine = n2(x * 0.012, y * 0.85);
      const streak = fbm(n2, x * 0.0015 + 40, y * 0.07, 2);
      let t = 0.32 + rings * 0.28 + (fine - 0.5) * 0.36 + (streak - 0.5) * 0.5;
      t = clamp01(t) * tints[b]!;
      let R = t < 0.5 ? mix(pal.dark[0]!, pal.mid[0]!, t * 2) : mix(pal.mid[0]!, pal.light[0]!, (t - 0.5) * 2);
      let G = t < 0.5 ? mix(pal.dark[1]!, pal.mid[1]!, t * 2) : mix(pal.mid[1]!, pal.light[1]!, (t - 0.5) * 2);
      let B = t < 0.5 ? mix(pal.dark[2]!, pal.mid[2]!, t * 2) : mix(pal.mid[2]!, pal.light[2]!, (t - 0.5) * 2);
      // Knot cores.
      for (const k of knots) {
        if (k.b !== b) continue;
        const dx = (x - k.x) / k.rx, dy = (yy - k.y) / k.ry;
        const dd = dx * dx + dy * dy;
        if (dd < 1) {
          const s = 0.45 + 0.55 * dd;
          R *= s; G *= s; B *= s;
        }
      }
      // Board seams (a dark groove with a lit lower lip) and butt joints.
      let shade = 1;
      if (yy < 1.6) shade = 0.35;
      else if (yy < 3.2) shade = 1.12;
      else if (yy > ph - 1.5) shade = 0.55;
      const jx = joints[b]!;
      if (Math.abs(x - jx[0]!) < 1.2 || Math.abs(x - jx[1]!) < 1.2) shade *= 0.45;
      const i = (y * w + x) * 4;
      d[i] = Math.min(255, R * shade);
      d[i + 1] = Math.min(255, G * shade);
      d[i + 2] = Math.min(255, B * shade);
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

let oakCache: HTMLCanvasElement | null = null;
let walnutCache: HTMLCanvasElement | null = null;
/** The counter top's honey oak (1280×420, four boards). */
export function oak(): HTMLCanvasElement {
  return (oakCache ??= plankTexture(0x0a7c11, 1280, 420, 4, "oak"));
}
/** Dark walnut for casework: the counter's fascia, the lintel, the wings' frames. */
export function walnut(): HTMLCanvasElement {
  return (walnutCache ??= plankTexture(0x3b2e19, 900, 300, 3, "walnut"));
}

/* ------------------------------------------------------------------ */

const BOOK_HUES: [number, number, number][] = [
  [108, 34, 28], [46, 62, 44], [36, 48, 74], [92, 64, 34], [120, 86, 44], [68, 30, 46], [44, 34, 26], [138, 104, 62], [74, 82, 58], [96, 40, 30],
];

function shadeRgb(c: [number, number, number], k: number, a = 1): string {
  return `rgba(${Math.round(Math.min(255, c[0] * k))},${Math.round(Math.min(255, c[1] * k))},${Math.round(Math.min(255, c[2] * k))},${a})`;
}

/** One book spine standing on a shelf at (x, base): gradient body, gilt bands, a label, a lit top edge. */
function book(g: CanvasRenderingContext2D, r: () => number, x: number, base: number, w: number, h: number, lean = 0): void {
  const col = BOOK_HUES[Math.floor(r() * BOOK_HUES.length)]!;
  g.save();
  g.translate(x + (lean > 0 ? 0 : w), base);
  g.rotate(lean);
  g.translate(lean > 0 ? 0 : -w, 0);
  const gr = g.createLinearGradient(0, 0, w, 0);
  gr.addColorStop(0, shadeRgb(col, 0.55));
  gr.addColorStop(0.35, shadeRgb(col, 1.15));
  gr.addColorStop(0.7, shadeRgb(col, 0.9));
  gr.addColorStop(1, shadeRgb(col, 0.45));
  g.fillStyle = gr;
  g.fillRect(0, -h, w, h);
  // Gilt bands and a title label.
  const gold = "rgba(214,170,92,0.85)";
  const bands = r() < 0.7;
  if (bands) {
    g.fillStyle = gold;
    for (const fy of [0.08, 0.13, 0.86, 0.91]) g.fillRect(1, -h + h * fy, w - 2, Math.max(1, h * 0.012));
  }
  if (r() < 0.6) {
    g.fillStyle = r() < 0.5 ? "rgba(32,22,14,0.75)" : "rgba(222,204,160,0.55)";
    g.fillRect(w * 0.18, -h * 0.68, w * 0.64, h * 0.16);
    g.fillStyle = gold;
    for (let i = 0; i < 3; i++) g.fillRect(w * 0.28, -h * 0.64 + i * h * 0.04, w * 0.44, 1);
  }
  // Worn top edge catching the overhead light.
  g.fillStyle = "rgba(255,226,170,0.18)";
  g.fillRect(0, -h, w, 2);
  g.restore();
}

function jar(g: CanvasRenderingContext2D, r: () => number, x: number, base: number, w: number, h: number): void {
  const tint = [[180, 120, 60], [90, 130, 90], [150, 70, 50], [200, 170, 90]][Math.floor(r() * 4)]!;
  g.save();
  g.beginPath();
  g.moveTo(x + w * 0.15, base);
  g.quadraticCurveTo(x, base, x, base - h * 0.2);
  g.lineTo(x, base - h * 0.78);
  g.quadraticCurveTo(x, base - h * 0.88, x + w * 0.25, base - h * 0.88);
  g.lineTo(x + w * 0.75, base - h * 0.88);
  g.quadraticCurveTo(x + w, base - h * 0.88, x + w, base - h * 0.78);
  g.lineTo(x + w, base - h * 0.2);
  g.quadraticCurveTo(x + w, base, x + w * 0.85, base);
  g.closePath();
  const gr = g.createLinearGradient(x, 0, x + w, 0);
  gr.addColorStop(0, `rgba(${tint[0]! * 0.4},${tint[1]! * 0.4},${tint[2]! * 0.4},0.95)`);
  gr.addColorStop(0.5, `rgba(${tint[0]},${tint[1]},${tint[2]},0.85)`);
  gr.addColorStop(1, `rgba(${tint[0]! * 0.3},${tint[1]! * 0.3},${tint[2]! * 0.3},0.95)`);
  g.fillStyle = gr;
  g.fill();
  // Glass highlight and a cork.
  g.fillStyle = "rgba(255,240,210,0.35)";
  g.fillRect(x + w * 0.2, base - h * 0.75, w * 0.1, h * 0.5);
  g.fillStyle = "#6b4a2c";
  g.fillRect(x + w * 0.22, base - h, w * 0.56, h * 0.13);
  g.restore();
}

function scrolls(g: CanvasRenderingContext2D, r: () => number, x: number, base: number, w: number): void {
  const n = 3 + Math.floor(r() * 3);
  const rad = w / 5;
  for (let i = 0; i < n; i++) {
    const cx = x + rad + (i % 3) * rad * 1.8;
    const cy = base - rad - Math.floor(i / 3) * rad * 1.7;
    const gr = g.createRadialGradient(cx - rad * 0.3, cy - rad * 0.3, 1, cx, cy, rad);
    gr.addColorStop(0, "#e8d6ae");
    gr.addColorStop(0.7, "#b89a68");
    gr.addColorStop(1, "#5a4228");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(cx, cy, rad, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(90,60,30,.6)";
    g.beginPath();
    g.arc(cx, cy, rad * 0.45, 0, Math.PI * 1.6);
    g.stroke();
  }
}

/**
 * A tall walnut bookcase front: shelves of books (some leaning, some lying
 * in stacks), jars and scroll piles, lit warmly from the top inner corner
 * and falling into shadow toward its outer edge. `side` sets which edge
 * faces the room (the lit one).
 */
export function bookcase(seed: number, side: "left" | "right"): HTMLCanvasElement {
  const W = 520, H = 1400;
  const [c, g] = canvas(W, H);
  const r = rng(seed);
  const wal = walnut();
  g.drawImage(wal, 0, 0, wal.width, wal.height, 0, 0, W, H);
  g.fillStyle = "rgba(14,8,4,0.72)";
  g.fillRect(0, 0, W, H);
  const shelfH = 210;
  const frame = 26;
  for (let top = 40; top < H; top += shelfH) {
    const base = top + shelfH - 24;
    // Back of the bay, darker deeper in.
    const bay = g.createLinearGradient(0, top, 0, base);
    bay.addColorStop(0, "rgba(4,2,1,0.85)");
    bay.addColorStop(1, "rgba(20,12,6,0.4)");
    g.fillStyle = bay;
    g.fillRect(frame, top, W - frame * 2, base - top);
    let x = frame + 4;
    while (x < W - frame - 20) {
      const roll = r();
      if (roll < 0.08 && x < W - frame - 90) {
        jar(g, r, x + 4, base, 44 + r() * 18, 70 + r() * 50);
        x += 70;
      } else if (roll < 0.13 && x < W - frame - 110) {
        scrolls(g, r, x, base, 100);
        x += 104;
      } else if (roll < 0.2 && x < W - frame - 120) {
        // A stack of books lying flat.
        let y = base;
        const sw = 90 + r() * 30;
        for (let i = 0; i < 3 + Math.floor(r() * 3); i++) {
          const bh = 14 + r() * 10;
          const bw = sw - r() * 20;
          const col = BOOK_HUES[Math.floor(r() * BOOK_HUES.length)]!;
          const gr = g.createLinearGradient(0, y - bh, 0, y);
          gr.addColorStop(0, shadeRgb(col, 1.2));
          gr.addColorStop(1, shadeRgb(col, 0.5));
          g.fillStyle = gr;
          g.fillRect(x + (sw - bw) / 2, y - bh, bw, bh);
          g.fillStyle = "rgba(214,170,92,0.5)";
          g.fillRect(x + (sw - bw) / 2 + 4, y - bh / 2, bw - 8, 1);
          y -= bh;
        }
        x += sw + 6;
      } else {
        const bw = 16 + r() * 22;
        const bh = 105 + r() * (shelfH - 150);
        const lean = r() < 0.08 ? 0.22 * (r() < 0.5 ? 1 : -1) : 0;
        book(g, r, x, base, bw, bh, lean);
        x += bw + (lean ? 26 : 1 + r() * 2);
      }
    }
    // The shelf board: lit front edge, shadow cast down onto the books below.
    const sb = g.createLinearGradient(0, base, 0, base + 24);
    sb.addColorStop(0, "#7a4d2a");
    sb.addColorStop(0.18, "#4a2d18");
    sb.addColorStop(1, "#1d110a");
    g.fillStyle = sb;
    g.fillRect(0, base, W, 24);
    const sh = g.createLinearGradient(0, top, 0, top + 60);
    sh.addColorStop(0, "rgba(0,0,0,0.75)");
    sh.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = sh;
    g.fillRect(frame, top, W - frame * 2, 60);
  }
  // Uprights.
  for (const fx of [0, W - frame]) {
    const up = g.createLinearGradient(fx, 0, fx + frame, 0);
    up.addColorStop(0, "#1a0f08");
    up.addColorStop(0.5, "#5a361d");
    up.addColorStop(1, "#1a0f08");
    g.fillStyle = up;
    g.fillRect(fx, 0, frame, H);
  }
  // Light: warm from the room side and the top; shadow at the outer edge and the floor.
  const lit = g.createLinearGradient(side === "left" ? W : 0, 0, side === "left" ? 0 : W, 0);
  lit.addColorStop(0, "rgba(255,170,90,0.10)");
  lit.addColorStop(0.55, "rgba(0,0,0,0.25)");
  lit.addColorStop(1, "rgba(0,0,0,0.78)");
  g.fillStyle = lit;
  g.fillRect(0, 0, W, H);
  const vert = g.createLinearGradient(0, 0, 0, H);
  vert.addColorStop(0, "rgba(0,0,0,0.25)");
  vert.addColorStop(0.35, "rgba(0,0,0,0)");
  vert.addColorStop(1, "rgba(0,0,0,0.7)");
  g.fillStyle = vert;
  g.fillRect(0, 0, W, H);
  return c;
}

/**
 * The outdoor wing: a market stall's stack of crates, barrels and sacks,
 * with rope and a net hung over it. Same lighting as the bookcase.
 */
export function stallStack(seed: number, side: "left" | "right"): HTMLCanvasElement {
  const W = 520, H = 1400;
  const [c, g] = canvas(W, H);
  const r = rng(seed);
  const oakT = oak();
  g.fillStyle = "#0d0805";
  g.fillRect(0, 0, W, H);
  // Crates, bottom up, staggered.
  let y = H;
  while (y > 260) {
    const ch = 170 + r() * 70;
    let x = -r() * 60;
    while (x < W) {
      const cw = 190 + r() * 120;
      const isBarrel = r() < 0.25;
      if (isBarrel) {
        const bw = cw * 0.7;
        const gr = g.createLinearGradient(x, 0, x + bw, 0);
        gr.addColorStop(0, "#2a170b");
        gr.addColorStop(0.45, "#8a5630");
        gr.addColorStop(1, "#24140a");
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(x + bw * 0.1, y);
        g.quadraticCurveTo(x - bw * 0.06, y - ch / 2, x + bw * 0.1, y - ch);
        g.lineTo(x + bw * 0.9, y - ch);
        g.quadraticCurveTo(x + bw * 1.06, y - ch / 2, x + bw * 0.9, y);
        g.closePath();
        g.fill();
        g.strokeStyle = "rgba(20,12,6,.6)";
        for (let i = 1; i < 6; i++) {
          g.beginPath();
          g.moveTo(x + (bw * i) / 6, y - 2);
          g.lineTo(x + (bw * i) / 6, y - ch + 2);
          g.stroke();
        }
        for (const fy of [0.15, 0.3, 0.7, 0.85]) {
          g.fillStyle = "#3b3530";
          g.fillRect(x + bw * 0.04, y - ch * fy - 4, bw * 0.92, 8);
          g.fillStyle = "rgba(220,200,170,.25)";
          g.fillRect(x + bw * 0.04, y - ch * fy - 4, bw * 0.92, 2);
        }
        x += bw + 8;
        continue;
      }
      g.save();
      g.beginPath();
      g.rect(x, y - ch, cw, ch);
      g.clip();
      g.drawImage(oakT, r() * 600, r() * 200, 400, 140, x, y - ch, cw, ch);
      g.fillStyle = "rgba(40,24,12,0.45)";
      g.fillRect(x, y - ch, cw, ch);
      g.restore();
      // Slats and frame.
      g.strokeStyle = "rgba(18,10,4,0.85)";
      g.lineWidth = 3;
      for (let i = 1; i < 4; i++) {
        g.beginPath();
        g.moveTo(x, y - (ch * i) / 4);
        g.lineTo(x + cw, y - (ch * i) / 4);
        g.stroke();
      }
      g.lineWidth = 14;
      g.strokeStyle = "#3a2312";
      g.strokeRect(x + 7, y - ch + 7, cw - 14, ch - 14);
      g.lineWidth = 10;
      g.beginPath();
      g.moveTo(x + 10, y - 10);
      g.lineTo(x + cw - 10, y - ch + 10);
      g.stroke();
      // A stencilled mark.
      g.fillStyle = "rgba(20,12,6,0.55)";
      g.font = `bold ${Math.round(ch * 0.2)}px Georgia, serif`;
      g.fillText(["SALT", "No.7", "RUM", "TAR", "⚓"][Math.floor(r() * 5)]!, x + cw * 0.22, y - ch * 0.4);
      x += cw + 6;
    }
    y -= ch + 4;
  }
  // Sacks on top.
  for (let i = 0; i < 4; i++) {
    const sx = r() * (W - 160), sw = 140 + r() * 60;
    const gr = g.createRadialGradient(sx + sw * 0.4, y - 60, 10, sx + sw / 2, y, sw);
    gr.addColorStop(0, "#c9b28a");
    gr.addColorStop(1, "#4a3b28");
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(sx + sw / 2, y + 10, sw / 2, 80, 0, Math.PI, 0);
    g.fill();
  }
  // A net draped over the top.
  g.strokeStyle = "rgba(170,150,110,0.35)";
  g.lineWidth = 1.5;
  for (let i = -10; i < 30; i++) {
    g.beginPath();
    g.moveTo(i * 30, 0);
    g.quadraticCurveTo(i * 30 + 60, 300, i * 30 + 20, 600);
    g.stroke();
    g.beginPath();
    g.moveTo(i * 30 + 300, 0);
    g.quadraticCurveTo(i * 30 + 200, 300, i * 30 + 260, 600);
    g.stroke();
  }
  const lit = g.createLinearGradient(side === "left" ? W : 0, 0, side === "left" ? 0 : W, 0);
  lit.addColorStop(0, "rgba(255,170,90,0.08)");
  lit.addColorStop(0.55, "rgba(0,0,0,0.3)");
  lit.addColorStop(1, "rgba(0,0,0,0.8)");
  g.fillStyle = lit;
  g.fillRect(0, 0, W, H);
  const vert = g.createLinearGradient(0, 0, 0, H);
  vert.addColorStop(0, "rgba(0,0,0,0.5)");
  vert.addColorStop(0.35, "rgba(0,0,0,0)");
  vert.addColorStop(1, "rgba(0,0,0,0.7)");
  g.fillStyle = vert;
  g.fillRect(0, 0, W, H);
  return c;
}

/** Laid paper: cream with fibres, chain lines and foxing. */
export function paper(seed: number, w: number, h: number, tone: [number, number, number] = [236, 222, 190]): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  const img = g.createImageData(w, h);
  const d = img.data;
  const n = valueNoise(seed);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const blot = fbm(n, x * 0.012, y * 0.012, 4);
      const fibre = n(x * 0.9 + 100, y * 0.08);
      const chain = Math.abs(((x % 34) - 17)) < 0.8 ? 0.97 : 1;
      const k = (0.9 + (blot - 0.5) * 0.18 + (fibre - 0.5) * 0.07) * chain;
      const i = (y * w + x) * 4;
      d[i] = tone[0] * k;
      d[i + 1] = tone[1] * k * (0.99 + (blot - 0.5) * 0.04);
      d[i + 2] = tone[2] * k * (0.97 + (blot - 0.5) * 0.08);
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // Darker, warmer edges.
  const e = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  e.addColorStop(0, "rgba(120,80,30,0)");
  e.addColorStop(1, "rgba(120,80,30,0.32)");
  g.fillStyle = e;
  g.fillRect(0, 0, w, h);
  return c;
}

const urlCache = new Map<string, string>();
/** A texture as a data URL, generated once per key. */
export function texUrl(key: string, make: () => HTMLCanvasElement, type: "image/jpeg" | "image/png" = "image/jpeg"): string {
  let u = urlCache.get(key);
  if (!u) {
    u = make().toDataURL(type, 0.9);
    urlCache.set(key, u);
  }
  return u;
}

/** Tooled leather for the journal's cover: pebbled grain, rubbed lighter at the middle. */
export function leather(seed: number, w: number, h: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  const img = g.createImageData(w, h);
  const d = img.data;
  const n = valueNoise(seed);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const pebble = n(x * 0.35, y * 0.35);
      const mottle = fbm(n, x * 0.01 + 50, y * 0.01, 4);
      const k = 0.55 + mottle * 0.6 + (pebble - 0.5) * 0.18;
      const i = (y * w + x) * 4;
      d[i] = 92 * k;
      d[i + 1] = 34 * k;
      d[i + 2] = 22 * k;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const e = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.7);
  e.addColorStop(0, "rgba(255,200,150,0.08)");
  e.addColorStop(1, "rgba(0,0,0,0.5)");
  g.fillStyle = e;
  g.fillRect(0, 0, w, h);
  return c;
}
