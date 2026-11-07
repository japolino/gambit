/**
 * Procedural materials for the Lobby theme, painted once on a 2D canvas and
 * cached as data URLs for the life of the page (a theme switch back reuses
 * them). Every texture is seeded, so the hall looks the same each visit.
 */
import { rng } from "../contract.js";

const cache = new Map<string, string>();

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!];
}

function once(key: string, make: () => string): string {
  let u = cache.get(key);
  if (!u) {
    try {
      u = make();
    } catch {
      u = "";
    }
    cache.set(key, u);
  }
  return u;
}

/** Tileable value noise: a small random lattice, smoothly interpolated and wrapped. */
function noiseField(w: number, h: number, cells: number, r: () => number): Float32Array {
  const lat = new Float32Array(cells * cells).map(() => r());
  const out = new Float32Array(w * h);
  const s = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < h; y++) {
    const fy = (y / h) * cells;
    const y0 = Math.floor(fy) % cells;
    const y1 = (y0 + 1) % cells;
    const ty = s(fy - Math.floor(fy));
    for (let x = 0; x < w; x++) {
      const fx = (x / w) * cells;
      const x0 = Math.floor(fx) % cells;
      const x1 = (x0 + 1) % cells;
      const tx = s(fx - Math.floor(fx));
      const a = lat[y0 * cells + x0]! + (lat[y0 * cells + x1]! - lat[y0 * cells + x0]!) * tx;
      const b = lat[y1 * cells + x0]! + (lat[y1 * cells + x1]! - lat[y1 * cells + x0]!) * tx;
      out[y * w + x] = a + (b - a) * ty;
    }
  }
  return out;
}

/** Dark tooled leather: mottled hide, fine pores and a few creases (journal covers, panels). */
export function leather(): string {
  return once("leather", () => {
    const W = 384;
    const [c, g] = canvas(W, W);
    const r = rng(7041);
    const n1 = noiseField(W, W, 6, r);
    const n2 = noiseField(W, W, 24, r);
    const px = g.createImageData(W, W);
    for (let i = 0; i < W * W; i++) {
      const v = n1[i]! * 0.55 + n2[i]! * 0.3 + r() * 0.15;
      px.data[i * 4] = 30 + v * 26;
      px.data[i * 4 + 1] = 21 + v * 17;
      px.data[i * 4 + 2] = 14 + v * 10;
      px.data[i * 4 + 3] = 255;
    }
    g.putImageData(px, 0, 0);
    // Creases: thin dark wandering strokes with a lit lip, drawn wrapped so the tile repeats.
    for (let k = 0; k < 26; k++) {
      let x = r() * W;
      let y = r() * W;
      let a = r() * Math.PI * 2;
      const len = 20 + r() * 60;
      const pts: [number, number][] = [];
      for (let s = 0; s < len; s += 3) {
        a += (r() - 0.5) * 0.5;
        x += Math.cos(a) * 3;
        y += Math.sin(a) * 3;
        pts.push([x, y]);
      }
      for (const [ox, oy] of [[0, 0], [-W, 0], [W, 0], [0, -W], [0, W]] as const) {
        g.beginPath();
        pts.forEach(([px2, py], i) => (i ? g.lineTo(px2 + ox, py + oy) : g.moveTo(px2 + ox, py + oy)));
        g.strokeStyle = "rgba(8,5,3,.45)";
        g.lineWidth = 1.2;
        g.stroke();
        g.translate(0.8, 0.8);
        g.strokeStyle = "rgba(120,90,60,.12)";
        g.stroke();
        g.setTransform(1, 0, 0, 1, 0, 0);
      }
    }
    return c.toDataURL("image/jpeg", 0.86);
  });
}

/** Warm parchment with fibres and faint foxing (the journal pages, the photo paper). */
export function parchment(): string {
  return once("parchment", () => {
    const W = 512;
    const [c, g] = canvas(W, W);
    const r = rng(1913);
    const n = noiseField(W, W, 8, r);
    const px = g.createImageData(W, W);
    for (let i = 0; i < W * W; i++) {
      const v = n[i]! * 0.7 + r() * 0.3;
      px.data[i * 4] = 222 + v * 22;
      px.data[i * 4 + 1] = 204 + v * 20;
      px.data[i * 4 + 2] = 168 + v * 18;
      px.data[i * 4 + 3] = 255;
    }
    g.putImageData(px, 0, 0);
    for (let k = 0; k < 900; k++) {
      const x = r() * W;
      const y = r() * W;
      const a = r() * Math.PI;
      const l = 3 + r() * 12;
      g.strokeStyle = r() < 0.5 ? "rgba(120,92,52,.16)" : "rgba(255,248,230,.22)";
      g.lineWidth = 0.6;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 3, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    for (let k = 0; k < 14; k++) {
      const x = r() * W;
      const y = r() * W;
      const rad = 6 + r() * 40;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, "rgba(150,104,52,.10)");
      gr.addColorStop(0.7, "rgba(150,104,52,.05)");
      gr.addColorStop(1, "rgba(150,104,52,0)");
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    return c.toDataURL("image/jpeg", 0.85);
  });
}

/** Brushed-metal streaks around mid-grey: laid over brass with an overlay blend. */
export function brushed(): string {
  return once("brushed", () => {
    const W = 512;
    const H = 128;
    const [c, g] = canvas(W, H);
    const r = rng(4410);
    g.fillStyle = "#808080";
    g.fillRect(0, 0, W, H);
    for (let k = 0; k < 1400; k++) {
      const y = r() * H;
      const x = r() * W;
      const l = 30 + r() * 220;
      const v = Math.round(90 + r() * 80);
      g.strokeStyle = `rgba(${v},${v},${v},${0.18 + r() * 0.25})`;
      g.lineWidth = 0.5 + r();
      for (const ox of [0, -W]) {
        g.beginPath();
        g.moveTo(x + ox, y);
        g.lineTo(x + l + ox, y + (r() - 0.5) * 0.6);
        g.stroke();
      }
    }
    // Pitting: tiny dark specks of age.
    for (let k = 0; k < 260; k++) {
      g.fillStyle = `rgba(40,30,20,${0.2 + r() * 0.3})`;
      g.fillRect(r() * W, r() * H, 1, 1);
    }
    return c.toDataURL("image/jpeg", 0.8);
  });
}

/** A soft golden mote, blitted many times by the dust layer. */
export function moteSprite(): HTMLCanvasElement {
  const [c, g] = canvas(48, 48);
  const gr = g.createRadialGradient(24, 24, 0, 24, 24, 24);
  gr.addColorStop(0, "rgba(255,236,190,.95)");
  gr.addColorStop(0.25, "rgba(230,198,135,.55)");
  gr.addColorStop(0.6, "rgba(200,160,90,.12)");
  gr.addColorStop(1, "rgba(200,160,90,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 48, 48);
  return c;
}

/**
 * A sepia surveyor's sketch: shown on a travel card while the destination's
 * own painting is still being made (or when there is none).
 */
export function chartSketch(seed: number): string {
  return once(`chart${seed}`, () => {
    const W = 480;
    const H = 360;
    const [c, g] = canvas(W, H);
    const r = rng(seed);
    const bg = g.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.7);
    bg.addColorStop(0, "#5a4630");
    bg.addColorStop(1, "#21180f");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(220,190,130,.12)";
    g.lineWidth = 1;
    for (let x = 0; x < W; x += 40) (g.beginPath(), g.moveTo(x, 0), g.lineTo(x, H), g.stroke());
    for (let y = 0; y < H; y += 40) (g.beginPath(), g.moveTo(0, y), g.lineTo(W, y), g.stroke());
    // A coastline: a wobbling closed shape, hatched along its inside edge.
    const cx = W * (0.4 + r() * 0.2);
    const cy = H * (0.45 + r() * 0.1);
    const pts: [number, number][] = [];
    for (let a = 0; a < Math.PI * 2; a += 0.12) {
      const rad = 110 + Math.sin(a * 3 + r() * 6) * 30 + (r() - 0.5) * 18;
      pts.push([cx + Math.cos(a) * rad * 1.3, cy + Math.sin(a) * rad * 0.8]);
    }
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fillStyle = "rgba(200,170,110,.16)";
    g.fill();
    g.strokeStyle = "rgba(235,210,150,.7)";
    g.lineWidth = 1.6;
    g.stroke();
    for (let k = 0; k < 40; k++) {
      const [x, y] = pts[Math.floor(r() * pts.length)]!;
      g.strokeStyle = "rgba(235,210,150,.25)";
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (cx - x) * 0.08, y + (cy - y) * 0.08);
      g.stroke();
    }
    // Compass rose.
    const rx = W * 0.82;
    const ry = H * 0.22;
    g.save();
    g.translate(rx, ry);
    g.strokeStyle = "rgba(235,210,150,.6)";
    g.beginPath();
    g.arc(0, 0, 30, 0, Math.PI * 2);
    g.stroke();
    for (let i = 0; i < 8; i++) {
      g.rotate(Math.PI / 4);
      g.fillStyle = i % 2 ? "rgba(235,210,150,.35)" : "rgba(235,210,150,.75)";
      g.beginPath();
      g.moveTo(0, -(i % 2 ? 22 : 40));
      g.lineTo(5, 0);
      g.lineTo(-5, 0);
      g.closePath();
      g.fill();
    }
    g.restore();
    // A dotted route and an X.
    g.setLineDash([4, 6]);
    g.strokeStyle = "rgba(220,120,80,.8)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(W * 0.15, H * 0.85);
    g.bezierCurveTo(W * 0.3, H * 0.4, W * 0.5, H * 0.8, cx, cy);
    g.stroke();
    g.setLineDash([]);
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx - 9, cy - 9);
    g.lineTo(cx + 9, cy + 9);
    g.moveTo(cx + 9, cy - 9);
    g.lineTo(cx - 9, cy + 9);
    g.stroke();
    return c.toDataURL("image/jpeg", 0.85);
  });
}

/**
 * The delve chart's ground: dark parchment with brass hairline latitude
 * rings, rhumb lines from the centre and a fine inked grid.
 */
export function chartGround(): string {
  return once("chartGround", () => {
    const W = 512;
    const [c, g] = canvas(W, W);
    const r = rng(2207);
    const n = noiseField(W, W, 8, r);
    const px = g.createImageData(W, W);
    for (let i = 0; i < W * W; i++) {
      const v = n[i]! * 0.7 + r() * 0.3;
      px.data[i * 4] = 30 + v * 14;
      px.data[i * 4 + 1] = 24 + v * 11;
      px.data[i * 4 + 2] = 17 + v * 8;
      px.data[i * 4 + 3] = 255;
    }
    g.putImageData(px, 0, 0);
    g.strokeStyle = "rgba(212,180,117,.16)";
    g.lineWidth = 1;
    for (let x = 0; x <= W; x += 24) (g.beginPath(), g.moveTo(x + 0.5, 0), g.lineTo(x + 0.5, W), g.stroke());
    for (let y = 0; y <= W; y += 24) (g.beginPath(), g.moveTo(0, y + 0.5), g.lineTo(W, y + 0.5), g.stroke());
    g.strokeStyle = "rgba(212,180,117,.22)";
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      g.beginPath();
      g.moveTo(W / 2, W / 2);
      g.lineTo(W / 2 + Math.cos(a) * W, W / 2 + Math.sin(a) * W);
      g.stroke();
    }
    for (const rad of [60, 120, 180, 236]) {
      g.strokeStyle = `rgba(212,180,117,${rad === 236 ? 0.4 : 0.26})`;
      g.lineWidth = rad === 236 ? 1.6 : 1;
      g.beginPath();
      g.arc(W / 2, W / 2, rad, 0, Math.PI * 2);
      g.stroke();
    }
    const v = g.createRadialGradient(W / 2, W / 2, W * 0.25, W / 2, W / 2, W * 0.55);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,.55)");
    g.fillStyle = v;
    g.fillRect(0, 0, W, W);
    return c.toDataURL("image/jpeg", 0.86);
  });
}

/** Ink cross-hatching for walked floor on the delve chart (tileable, transparent). */
export function hatch(): HTMLCanvasElement {
  const [c, g] = canvas(8, 8);
  g.strokeStyle = "rgba(212,180,117,.32)";
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(0, 8);
  g.lineTo(8, 0);
  g.moveTo(-2, 2);
  g.lineTo(2, -2);
  g.moveTo(6, 10);
  g.lineTo(10, 6);
  g.stroke();
  return c;
}
