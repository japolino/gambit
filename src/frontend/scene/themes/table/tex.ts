/**
 * Procedural canvas textures for the Table theme: walnut planks with a cloth
 * mat (drawn flat, then projected row by row onto the screen like a floor in
 * an old racing game, so the planks, grain and sigils foreshorten for real),
 * and the paper, slate, stone, leather and felt the props are made of.
 * Every texture is seeded and generated once per page, then cached.
 */
import { rng } from "../contract.js";

/* ------------------------------- Noise ---------------------------------- */

/** Seeded 2D value noise with smoothstep interpolation (cheap, good enough for grain). */
function noise2(seed: number): (x: number, y: number) => number {
  const r = rng(seed);
  const N = 256;
  const perm = new Uint8Array(N * 2);
  const val = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    perm[i] = i;
    val[i] = r();
  }
  for (let i = N - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = perm[i]!;
    perm[i] = perm[j]!;
    perm[j] = t;
  }
  for (let i = 0; i < N; i++) perm[N + i] = perm[i]!;
  const at = (x: number, y: number) => val[perm[(perm[x & 255]! + y) & 511]!]!;
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const u = fx * fx * (3 - 2 * fx);
    const w = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  };
}

function fbm(n: (x: number, y: number) => number, x: number, y: number, oct: number): number {
  let s = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    s += a * n(x * f, y * f);
    f *= 2.03;
    a *= 0.5;
  }
  return s / (1 - Math.pow(0.5, oct));
}

const mk = (w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!];
};

const cache = new Map<string, string>();
/** Generate once, keep the data URL for the page's lifetime. */
function once(key: string, make: () => HTMLCanvasElement, type = "image/jpeg"): string {
  let u = cache.get(key);
  if (!u) {
    u = make().toDataURL(type, 0.86);
    cache.set(key, u);
  }
  return u;
}

/* ---------------------------- Flat tabletop ----------------------------- */

/** Size of the flat tabletop texture; u runs across the table, v from the back edge to you. */
export const TOP_W = 1400;
export const TOP_H = 760;
/** The cloth mat on the flat texture, in 0..1 table units. */
export const MAT = { u0: 0.315, u1: 0.685, v0: 0.05, v1: 0.47 };
/** Placement sigils on the mat (table units); played cards land on the middle one. */
export const SIGILS = [
  { u: 0.395, v: 0.12 },
  { u: 0.5, v: 0.12 },
  { u: 0.605, v: 0.12 },
];

const tops = new Map<string, HTMLCanvasElement>();

/** Dark walnut planks running across the table, with seams, joints, knots, nails and (for the 2D table) the mat. */
export function tabletop(withMat = true): HTMLCanvasElement {
  const hit = tops.get(String(withMat));
  if (hit) return hit;
  const W = TOP_W;
  const H = TOP_H;
  const [c, g] = mk(W, H);
  const n = noise2(91);
  const n2 = noise2(17);
  const r = rng(4242);
  const planks = 7;
  const ph = H / planks;
  const plank = Array.from({ length: planks }, () => ({ tone: 0.75 + r() * 0.35, off: r() * 100, joint: 0.15 + r() * 0.7, joint2: r() < 0.5 ? 0.05 + r() * 0.25 : -1 }));
  const knots = Array.from({ length: 16 }, () => ({ x: r() * W, y: r() * H, s: 10 + r() * 18 }));
  const img = g.createImageData(W, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    const p = Math.min(planks - 1, Math.floor(y / ph));
    const pk = plank[p]!;
    const ly = y - p * ph;
    const near = knots.filter((k) => Math.abs(y - k.y) < k.s * 3);
    for (let x = 0; x < W; x++) {
      // Knots bend the grain around them.
      let bend = 0;
      for (const k of near) {
        const dx = (x - k.x) / (k.s * 2.4);
        const dy = (y - k.y) / k.s;
        const q = dx * dx + dy * dy;
        if (q < 9) bend += Math.exp(-q) * 9;
      }
      const warp = fbm(n, x * 0.0035 + pk.off, y * 0.045, 3) * 22 + bend;
      const ring = Math.sin((ly + warp) * 0.62 + pk.off);
      const fine = Math.pow(Math.abs(ring), 0.35);
      const streak = fbm(n2, x * 0.012 + pk.off, y * 0.35, 2);
      let t = (0.38 + 0.42 * fine * (0.6 + streak * 0.7)) * pk.tone;
      // Seams between planks, with a lit bevel on the far lip.
      const edge = Math.min(ly, ph - ly);
      if (edge < 2.2) t *= 0.12;
      else if (ly < 4.5) t *= 1.25;
      else if (ph - ly < 4.5) t *= 0.7;
      // Butt joints where two boards meet.
      const jx = pk.joint * W;
      const jd = Math.abs(x - jx);
      if (jd < 1.8) t *= 0.15;
      else if (jd < 4) t *= 0.8;
      if (pk.joint2 > 0 && Math.abs(x - pk.joint2 * W) < 1.8) t *= 0.15;
      const i = (y * W + x) * 4;
      d[i] = Math.min(255, 22 + t * 92);
      d[i + 1] = Math.min(255, 10 + t * 44);
      d[i + 2] = Math.min(255, 6 + t * 22);
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // Knot hearts.
  for (const k of knots) {
    const gr = g.createRadialGradient(k.x, k.y, 0, k.x, k.y, k.s * 0.8);
    gr.addColorStop(0, "rgba(8,3,1,.9)");
    gr.addColorStop(0.5, "rgba(30,12,5,.5)");
    gr.addColorStop(1, "rgba(30,12,5,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(k.x, k.y, k.s * 1.4, k.s * 0.55, 0, 0, Math.PI * 2);
    g.fill();
  }
  // Nails at each joint.
  for (let p = 0; p < planks; p++) {
    const pk = plank[p]!;
    for (const jx of [pk.joint * W, ...(pk.joint2 > 0 ? [pk.joint2 * W] : [])]) {
      for (const s of [-1, 1]) {
        const nx = jx + s * 9;
        const ny = p * ph + ph * (s < 0 ? 0.3 : 0.7);
        g.fillStyle = "#050201";
        g.beginPath();
        g.arc(nx, ny, 4.2, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "rgba(170,120,80,.55)";
        g.beginPath();
        g.arc(nx - 1.2, ny - 1.2, 1.6, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  // Scratches and ring stains: a table that has seen a lot of games.
  for (let i = 0; i < 220; i++) {
    const x = r() * W;
    const y = r() * H;
    const a = (r() - 0.5) * 0.6;
    const len = 10 + r() * 70;
    g.strokeStyle = `rgba(${r() < 0.5 ? "190,130,90" : "0,0,0"},${0.05 + r() * 0.1})`;
    g.lineWidth = 0.6 + r();
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5 + (r() - 0.5) * 6, x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  for (let i = 0; i < 7; i++) {
    const x = r() * W;
    const y = r() * H;
    const rad = 16 + r() * 18;
    g.strokeStyle = "rgba(0,0,0,.28)";
    g.lineWidth = 2 + r() * 2;
    g.beginPath();
    g.ellipse(x, y, rad * 1.6, rad, 0, r() * 3, r() * 3 + 4.5);
    g.stroke();
  }
  if (withMat) drawMat(g, MAT.u0 * W, MAT.v0 * H, MAT.u1 * W, MAT.v1 * H, r, SIGILS.map((p) => ({ x: p.u * W, y: p.v * H, R: 42 })));
  tops.set(String(withMat), c);
  return c;
}

/** The charcoal-violet cloth mat: frayed edge, double stitched border, corner flourishes, sigils. */
function drawMat(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, r: () => number, sigils: { x: number; y: number; R: number }[]): void {
  // Shadow under the cloth.
  g.save();
  g.shadowColor = "rgba(0,0,0,.85)";
  g.shadowBlur = 18;
  g.shadowOffsetY = 6;
  const edge = (): void => {
    g.beginPath();
    const pts: [number, number][] = [];
    const step = 9;
    for (let x = x0; x <= x1; x += step) pts.push([x, y0 + (r() - 0.5) * 3]);
    for (let y = y0; y <= y1; y += step) pts.push([x1 + (r() - 0.5) * 3, y]);
    for (let x = x1; x >= x0; x -= step) pts.push([x, y1 + (r() - 0.5) * 3]);
    for (let y = y1; y >= y0; y -= step) pts.push([x0 + (r() - 0.5) * 3, y]);
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
  };
  edge();
  g.fillStyle = "#151019";
  g.fill();
  g.restore();
  g.save();
  edge();
  g.clip();
  // Felt nap.
  const img = g.getImageData(x0 - 4, y0 - 4, x1 - x0 + 8, y1 - y0 + 8);
  const d = img.data;
  const n = noise2(303);
  const w = img.width;
  for (let i = 0; i < d.length; i += 4) {
    const px = (i / 4) % w;
    const py = Math.floor(i / 4 / w);
    const k = (r() - 0.5) * 16 + (fbm(n, px * 0.03, py * 0.03, 2) - 0.5) * 30;
    d[i] = Math.max(0, d[i]! + k);
    d[i + 1] = Math.max(0, d[i + 1]! + k * 0.8);
    d[i + 2] = Math.max(0, d[i + 2]! + k * 1.1);
  }
  g.putImageData(img, x0 - 4, y0 - 4);
  g.restore();
  // Double stitched border.
  const bone = "rgba(216,207,194,";
  g.lineCap = "round";
  for (const [inset, dash, a, lw] of [[13, [9, 6], 0.85, 2.4], [24, [4, 5], 0.6, 1.6]] as const) {
    g.setLineDash(dash as unknown as number[]);
    g.strokeStyle = `${bone}${a})`;
    g.lineWidth = lw;
    g.strokeRect(x0 + inset, y0 + inset * 0.8, x1 - x0 - inset * 2, y1 - y0 - inset * 1.6);
  }
  g.setLineDash([]);
  // Corner flourishes: a curl and a thorn at each corner.
  const corners: [number, number, number, number][] = [
    [x0 + 30, y0 + 26, 1, 1],
    [x1 - 30, y0 + 26, -1, 1],
    [x0 + 30, y1 - 26, 1, -1],
    [x1 - 30, y1 - 26, -1, -1],
  ];
  g.strokeStyle = `${bone}.8)`;
  g.lineWidth = 2.2;
  for (const [cx, cy, sx, sy] of corners) {
    g.beginPath();
    g.moveTo(cx, cy + sy * 46);
    g.bezierCurveTo(cx, cy + sy * 10, cx + sx * 10, cy, cx + sx * 46, cy);
    g.moveTo(cx + sx * 8, cy + sy * 8);
    g.bezierCurveTo(cx + sx * 30, cy + sy * 4, cx + sx * 26, cy + sy * 24, cx + sx * 16, cy + sy * 20);
    g.bezierCurveTo(cx + sx * 8, cy + sy * 16, cx + sx * 14, cy + sy * 10, cx + sx * 19, cy + sy * 13);
    g.stroke();
    g.fillStyle = `${bone}.8)`;
    g.beginPath();
    g.moveTo(cx + sx * 4, cy + sy * 4);
    g.lineTo(cx + sx * 12, cy + sy * 2);
    g.lineTo(cx + sx * 2, cy + sy * 12);
    g.fill();
  }
  // Sigils: the placement circles.
  for (const [i, s] of sigils.entries()) {
    const cx = s.x;
    const cy = s.y;
    const R = s.R;
    g.strokeStyle = `${bone}${i === 1 ? 0.85 : 0.6})`;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(cx, cy, R - 9, 0, Math.PI * 2);
    g.stroke();
    // Runic ticks between the rings.
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      const l = k % 3 === 0 ? 9 : 5;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * (R - 9), cy + Math.sin(a) * (R - 9));
      g.lineTo(cx + Math.cos(a) * (R - 9 + l), cy + Math.sin(a) * (R - 9 + l));
      g.stroke();
    }
    // A star of n points inside.
    const pts = i === 1 ? 7 : 5;
    g.lineWidth = 1.8;
    g.beginPath();
    for (let k = 0; k <= pts; k++) {
      // Every second vertex: a {5/2} or {7/2} star in one stroke.
      const a = -Math.PI / 2 + (((k * 2) % pts) / pts) * Math.PI * 2;
      const px = cx + Math.cos(a) * (R - 16);
      const py = cy + Math.sin(a) * (R - 16);
      if (k) g.lineTo(px, py);
      else g.moveTo(px, py);
    }
    g.stroke();
    g.fillStyle = `${bone}.7)`;
    g.beginPath();
    g.arc(cx, cy, 4, 0, Math.PI * 2);
    g.fill();
  }
  // A worn band where hands slide cards across.
  const wear = g.createLinearGradient(0, y1 - 60, 0, y1);
  wear.addColorStop(0, "rgba(60,50,70,0)");
  wear.addColorStop(1, "rgba(60,50,70,.18)");
  g.fillStyle = wear;
  g.fillRect(x0, y1 - 60, x1 - x0, 60);
}

/** The cloth mat on its own (for the 3D table): sigils along its far border, under the people across from you. */
export function matCanvas(): HTMLCanvasElement {
  const hit = tops.get("mat");
  if (hit) return hit;
  const [c, g] = mk(1200, 640);
  g.fillStyle = "#000";
  g.fillRect(0, 0, 1200, 640);
  drawMat(g, 8, 8, 1192, 632, rng(4243), [
    { x: 300, y: 120, R: 70 },
    { x: 600, y: 120, R: 70 },
    { x: 900, y: 120, R: 70 },
  ]);
  tops.set("mat", c);
  return c;
}

/* ---------------------------- Projection -------------------------------- */

export interface TableGeom {
  /** Canvas size in CSS px (the canvas is drawn at 1:1). */
  w: number;
  h: number;
  /** Horizon line, back edge of the table, centre x and the table's width at the back edge. */
  yH: number;
  yT: number;
  cx: number;
  backW: number;
  /** Candle pools, screen px. */
  lights: { x: number; y: number; r: number; a: number }[];
}

/** Screen position of a point on the table (u across 0..1, v from the back edge 0..1). */
export function project(g: TableGeom, u: number, v: number): { x: number; y: number; s: number } {
  const zT = 1 / (g.yT - g.yH);
  const zB = 1 / (g.h - g.yH);
  const z = zT - v * (zT - zB);
  const y = g.yH + 1 / z;
  const s = (y - g.yH) / (g.yT - g.yH);
  return { x: g.cx + (u - 0.5) * g.backW * s, y, s };
}

/** Paint the table in perspective: textured rows, side aprons, back lip, baked candle light. */
export function paintTable(cv: HTMLCanvasElement, geo: TableGeom): void {
  const tex = tabletop();
  if (cv.width !== Math.round(geo.w) || cv.height !== Math.round(geo.h)) {
    cv.width = Math.round(geo.w);
    cv.height = Math.round(geo.h);
  }
  const g = cv.getContext("2d")!;
  const { w, h, yH, yT, cx, backW } = geo;
  g.clearRect(0, 0, w, h);
  // The floor beyond the table, deep in shadow.
  const fl = g.createLinearGradient(0, yT, 0, h);
  fl.addColorStop(0, "#0a0605");
  fl.addColorStop(1, "#020101");
  g.fillStyle = fl;
  g.fillRect(0, yT, w, h - yT);
  const zT = 1 / (yT - yH);
  const zB = 1 / (h - yH);
  g.imageSmoothingEnabled = true;
  for (let y = Math.floor(yT); y < h; y++) {
    const s = (y - yH) / (yT - yH);
    const rw = backW * s;
    const z = 1 / (y + 0.5 - yH);
    const v = (zT - z) / (zT - zB);
    const sy = Math.max(0, Math.min(TOP_H - 1, v * (TOP_H - 1)));
    g.drawImage(tex, 0, sy, TOP_W, 1, cx - rw / 2, y, rw, 1.6);
  }
  // Side aprons: the table's edge thickness where its sides run out of frame.
  const t0 = h * 0.012;
  for (const side of [-1, 1]) {
    const xa = cx + (side * backW) / 2;
    const xb = cx + (side * backW * ((h - yH) / (yT - yH))) / 2;
    g.beginPath();
    g.moveTo(xa, yT);
    g.lineTo(xb, h);
    g.lineTo(xb + side * t0 * 3, h);
    g.lineTo(xa + side * t0 * 0.6, yT + t0);
    g.closePath();
    const ag = g.createLinearGradient(xa, yT, xb, h);
    ag.addColorStop(0, "#1b0d07");
    ag.addColorStop(1, "#0b0503");
    g.fillStyle = ag;
    g.fill();
    g.strokeStyle = "rgba(150,85,45,.55)";
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(xa, yT);
    g.lineTo(xb, h);
    g.stroke();
  }
  // Light: pull everything down into shadow, then lift the candle pools.
  g.save();
  g.globalCompositeOperation = "source-atop";
  const dark = g.createRadialGradient(cx, yT + (h - yT) * 0.4, 0, cx, yT + (h - yT) * 0.4, w * 0.62);
  dark.addColorStop(0, "rgba(0,0,0,0.05)");
  dark.addColorStop(0.45, "rgba(0,0,0,0.45)");
  dark.addColorStop(1, "rgba(0,0,0,0.92)");
  g.fillStyle = dark;
  g.fillRect(0, yT, w, h - yT);
  const back = g.createLinearGradient(0, yT, 0, yT + (h - yT) * 0.35);
  back.addColorStop(0, "rgba(0,0,0,.55)");
  back.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = back;
  g.fillRect(0, yT, w, h - yT);
  for (const L of geo.lights) {
    const lg = g.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
    lg.addColorStop(0, `rgba(255,150,60,${0.55 * L.a})`);
    lg.addColorStop(0.35, `rgba(220,95,30,${0.28 * L.a})`);
    lg.addColorStop(1, "rgba(120,40,10,0)");
    g.globalCompositeOperation = "overlay";
    g.fillStyle = lg;
    g.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
    g.globalCompositeOperation = "lighter";
    const lg2 = g.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r * 0.7);
    lg2.addColorStop(0, `rgba(255,140,50,${0.16 * L.a})`);
    lg2.addColorStop(1, "rgba(255,140,50,0)");
    g.fillStyle = lg2;
    g.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
  }
  g.restore();
  // The back lip catches the candlelight.
  const lip = g.createLinearGradient(cx - backW / 2, 0, cx + backW / 2, 0);
  lip.addColorStop(0, "rgba(120,60,30,.2)");
  lip.addColorStop(0.3, "rgba(230,140,70,.75)");
  lip.addColorStop(0.7, "rgba(200,110,55,.55)");
  lip.addColorStop(1, "rgba(120,60,30,.2)");
  g.fillStyle = lip;
  g.fillRect(cx - backW / 2, yT - 1, backW, 2.2);
  g.fillStyle = "rgba(0,0,0,.65)";
  g.fillRect(cx - backW / 2, yT + 1.2, backW, 2);
}

/* ------------------------------ Materials ------------------------------- */

/** Bone parchment for the cards: fibres, foxing, scorched edges. */
export function paperUrl(): string {
  return once("paper", () => {
    const W = 300;
    const H = 440;
    const [c, g] = mk(W, H);
    const r = rng(77);
    const n = noise2(8);
    const img = g.createImageData(W, H);
    const d = img.data;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const k = (fbm(n, x * 0.02, y * 0.02, 3) - 0.5) * 34 + (r() - 0.5) * 14;
        d[i] = 220 + k;
        d[i + 1] = 210 + k * 0.95;
        d[i + 2] = 192 + k * 0.85;
        d[i + 3] = 255;
      }
    g.putImageData(img, 0, 0);
    for (let i = 0; i < 260; i++) {
      g.strokeStyle = `rgba(${r() < 0.6 ? "120,95,60" : "255,250,235"},${0.08 + r() * 0.12})`;
      g.lineWidth = 0.6;
      const x = r() * W;
      const y = r() * H;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 14, y + (r() - 0.5) * 14);
      g.stroke();
    }
    for (let i = 0; i < 9; i++) {
      const x = r() * W;
      const y = r() * H;
      const rad = 6 + r() * 26;
      const f = g.createRadialGradient(x, y, 0, x, y, rad);
      f.addColorStop(0, "rgba(130,80,30,.0)");
      f.addColorStop(0.8, "rgba(130,80,30,.14)");
      f.addColorStop(1, "rgba(130,80,30,0)");
      g.fillStyle = f;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    const e = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.62);
    e.addColorStop(0, "rgba(90,50,20,0)");
    e.addColorStop(1, "rgba(70,35,12,.55)");
    g.fillStyle = e;
    g.fillRect(0, 0, W, H);
    return c;
  });
}

/** Slate for the scoreboard: dark, with chalk dust, wipe marks and ghosts of old scores. */
export function slateUrl(): string {
  return once("slate", () => {
    const W = 420;
    const H = 520;
    const [c, g] = mk(W, H);
    const r = rng(5150);
    const n = noise2(12);
    const img = g.createImageData(W, H);
    const d = img.data;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const k = (fbm(n, x * 0.015, y * 0.015, 3) - 0.5) * 18 + (r() - 0.5) * 10;
        d[i] = 22 + k;
        d[i + 1] = 25 + k;
        d[i + 2] = 28 + k;
        d[i + 3] = 255;
      }
    g.putImageData(img, 0, 0);
    // Eraser wipes.
    for (let i = 0; i < 14; i++) {
      g.strokeStyle = `rgba(200,205,210,${0.025 + r() * 0.04})`;
      g.lineWidth = 18 + r() * 40;
      g.lineCap = "round";
      const x = r() * W;
      const y = r() * H;
      g.beginPath();
      g.moveTo(x, y);
      g.bezierCurveTo(x + 60, y - 20 + r() * 40, x + 120, y + r() * 40, x + 150 + r() * 80, y + (r() - 0.5) * 50);
      g.stroke();
    }
    // Ghost numerals and tallies.
    g.fillStyle = "rgba(220,220,215,.05)";
    g.font = "64px serif";
    for (let i = 0; i < 6; i++) g.fillText(String(Math.floor(r() * 30)), r() * W, r() * H);
    g.strokeStyle = "rgba(220,220,215,.05)";
    g.lineWidth = 3;
    for (let i = 0; i < 20; i++) {
      const x = r() * W;
      const y = r() * H;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 4, y + 26);
      g.stroke();
    }
    // Dust.
    for (let i = 0; i < 1600; i++) {
      g.fillStyle = `rgba(230,230,225,${r() * 0.12})`;
      g.fillRect(r() * W, r() * H, 1 + r() * 1.5, 1 + r() * 1.5);
    }
    return c;
  });
}

/** Chipped dark stone for the narration plaque. */
export function stoneUrl(): string {
  return once("stone", () => {
    const W = 640;
    const H = 240;
    const [c, g] = mk(W, H);
    const r = rng(616);
    const n = noise2(66);
    const img = g.createImageData(W, H);
    const d = img.data;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const f = fbm(n, x * 0.012, y * 0.02, 4);
        const k = (f - 0.5) * 28 + (r() - 0.5) * 9;
        d[i] = 21 + k;
        d[i + 1] = 21 + k;
        d[i + 2] = 25 + k;
        d[i + 3] = 255;
      }
    g.putImageData(img, 0, 0);
    g.strokeStyle = "rgba(0,0,0,.5)";
    for (let i = 0; i < 12; i++) {
      g.lineWidth = 0.6 + r();
      let x = r() * W;
      let y = r() * H;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += (r() - 0.3) * 28;
        y += (r() - 0.5) * 16;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    return c;
  });
}

/** Oxblood leather for the ledger cover and the open journal. */
export function leatherUrl(): string {
  return once("leather", () => {
    const W = 512;
    const H = 512;
    const [c, g] = mk(W, H);
    const r = rng(2024);
    const n = noise2(404);
    const img = g.createImageData(W, H);
    const d = img.data;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        // Cellular-ish pebble from sharpened noise.
        const f = fbm(n, x * 0.06, y * 0.06, 2);
        const pebble = Math.pow(Math.abs(Math.sin(f * 18)), 0.5);
        const k = (pebble - 0.5) * 22 + (fbm(n, x * 0.008, y * 0.008, 3) - 0.5) * 40 + (r() - 0.5) * 6;
        d[i] = 70 + k;
        d[i + 1] = 24 + k * 0.45;
        d[i + 2] = 20 + k * 0.35;
        d[i + 3] = 255;
      }
    g.putImageData(img, 0, 0);
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = `rgba(0,0,0,${0.1 + r() * 0.2})`;
      g.lineWidth = 0.8;
      const x = r() * W;
      const y = r() * H;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + (r() - 0.5) * 40, y + (r() - 0.5) * 40, x + (r() - 0.5) * 60, y + (r() - 0.5) * 60);
      g.stroke();
    }
    return c;
  });
}

/** Deep green baize for the inside of the class-deck case. */
export function feltUrl(): string {
  return once("felt", () => {
    const W = 320;
    const H = 320;
    const [c, g] = mk(W, H);
    const r = rng(31337);
    const n = noise2(5);
    const img = g.createImageData(W, H);
    const d = img.data;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const k = (fbm(n, x * 0.04, y * 0.04, 3) - 0.5) * 20 + (r() - 0.5) * 18;
        d[i] = 14 + k * 0.4;
        d[i + 1] = 34 + k;
        d[i + 2] = 26 + k * 0.7;
        d[i + 3] = 255;
      }
    g.putImageData(img, 0, 0);
    return c;
  });
}

/** Aged laid paper for the open ledger: chain and laid lines, scorched margins, ink specks near the gutter (left edge). */
export function pageUrl(): string {
  return once("page2", () => {
    const W = 600;
    const H = 760;
    const [c, g] = mk(W, H);
    const r = rng(99);
    const n = noise2(23);
    const img = g.createImageData(W, H);
    const d = img.data;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const k = (fbm(n, x * 0.012, y * 0.012, 4) - 0.5) * 30 + (r() - 0.5) * 9 + (y % 3 === 0 ? -5 : 0);
        d[i] = 201 + k;
        d[i + 1] = 179 + k;
        d[i + 2] = 140 + k * 0.9;
        d[i + 3] = 255;
      }
    g.putImageData(img, 0, 0);
    // Chain lines of the paper mould.
    g.strokeStyle = "rgba(90,60,30,.07)";
    g.lineWidth = 2;
    for (let x = 40; x < W; x += 52) {
      g.beginPath();
      g.moveTo(x + (r() - 0.5) * 3, 0);
      g.lineTo(x + (r() - 0.5) * 3, H);
      g.stroke();
    }
    // Ink specks and a spatter near the gutter.
    for (let i = 0; i < 90; i++) {
      const x = Math.pow(r(), 2.2) * W * 0.35;
      const y = r() * H;
      g.fillStyle = `rgba(30,15,8,${0.15 + r() * 0.45})`;
      g.beginPath();
      g.arc(x, y, 0.5 + r() * 2.2, 0, Math.PI * 2);
      g.fill();
    }
    // Scorched, darkened margins.
    const e = g.createRadialGradient(W * 0.55, H * 0.45, W * 0.25, W * 0.5, H * 0.5, W * 0.95);
    e.addColorStop(0, "rgba(110,82,51,0)");
    e.addColorStop(0.7, "rgba(110,82,51,.35)");
    e.addColorStop(1, "rgba(70,45,22,.9)");
    g.fillStyle = e;
    g.fillRect(0, 0, W, H);
    return c;
  });
}
