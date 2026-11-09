/**
 * Storybook: procedural canvas textures (parchment, mahogany, tooled
 * leather, silk and brocade, god rays). Each is painted once per page load
 * from a fixed seed and handed out as an object URL, so the theme never
 * ships an image file and never repaints a texture on render.
 */
import { rng } from "../contract.js";

const cache = new Map<string, string>();

/** A canvas as an object URL (synchronously, so callers can use it at once). */
function toUrl(c: HTMLCanvasElement): string {
  const data = c.toDataURL("image/png");
  try {
    const bin = atob(data.slice(data.indexOf(",") + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
  } catch {
    return data;
  }
}

function once(key: string, paint: () => HTMLCanvasElement): string {
  let u = cache.get(key);
  if (!u) {
    u = toUrl(paint());
    cache.set(key, u);
  }
  return u;
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!];
}

/** Tileable value noise: a lattice of `period` cells, smoothstep-blended. */
function noise2(seed: number, period: number): (x: number, y: number) => number {
  const r = rng(seed);
  const g = new Float32Array(period * period).map(() => r());
  const at = (i: number, j: number) => g[(((j % period) + period) % period) * period + (((i % period) + period) % period)]!;
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/** Fractal noise over a w×h tile that wraps on both axes (base lattice `cells` across). */
function fbm(seed: number, cells: number, octaves: number): (x: number, y: number) => number {
  const layers = Array.from({ length: octaves }, (_, o) => noise2(seed + o * 101, cells << o));
  return (x, y) => {
    let s = 0, amp = 0.5, norm = 0;
    for (let o = 0; o < octaves; o++) {
      const f = cells << o;
      s += layers[o]!(x * f, y * f) * amp;
      norm += amp;
      amp *= 0.5;
    }
    return s / norm;
  };
}

/**
 * Aged vellum: warm cream mottled with fractal noise, paper fibres,
 * foxing spots and a burnt-umber edge. Not tiled: it is stretched over one
 * page (the dialogue page, the journal's leaves).
 */
export function parchment(w = 1200, h = 360, seed = 7): string {
  return once(`parch:${w}x${h}:${seed}`, () => {
    const [c, g] = canvas(w, h);
    const r = rng(seed);
    const n = fbm(seed, 6, 5);
    const fine = fbm(seed + 9, 48, 2);
    const img = g.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h;
        const m = n(u, v * (h / w) * 1.0 + 0.0);
        const f = fine(u, v);
        // Distance to the nearest edge, for the darker burnt rim.
        const e = Math.min(u, 1 - u, (v * h) / w, ((1 - v) * h) / w) * (w / h);
        const burn = Math.max(0, 1 - e * 5.5);
        const t = 0.62 * m + 0.25 * f + 0.55 * burn * burn;
        const i = (y * w + x) * 4;
        d[i] = 246 - t * 52;
        d[i + 1] = 233 - t * 70;
        d[i + 2] = 200 - t * 98;
        d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    // Fibres: short, faint, slightly curved strokes in two inks.
    for (let k = 0; k < (w * h) / 900; k++) {
      const x = r() * w, y = r() * h, len = 6 + r() * 22, a = r() * Math.PI;
      g.strokeStyle = r() > 0.5 ? `rgba(120,78,36,${0.05 + r() * 0.07})` : `rgba(255,250,232,${0.1 + r() * 0.12})`;
      g.lineWidth = 0.6 + r() * 0.6;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + (r() - 0.5) * 4, y + Math.sin(a) * len * 0.5 + (r() - 0.5) * 4, x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
    // Foxing: soft rust spots, a few large and faint, many tiny.
    for (let k = 0; k < 70; k++) {
      const x = r() * w, y = r() * h, rad = r() < 0.15 ? 10 + r() * 26 : 1 + r() * 4;
      const sp = g.createRadialGradient(x, y, 0, x, y, rad);
      sp.addColorStop(0, `rgba(150,92,40,${rad > 8 ? 0.08 : 0.22})`);
      sp.addColorStop(1, "rgba(150,92,40,0)");
      g.fillStyle = sp;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // A last warm light from the upper left, as if lamplit.
    const lamp = g.createRadialGradient(w * 0.3, -h * 0.4, 0, w * 0.3, -h * 0.4, w * 0.9);
    lamp.addColorStop(0, "rgba(255,246,220,.28)");
    lamp.addColorStop(1, "rgba(255,246,220,0)");
    g.fillStyle = lamp;
    g.fillRect(0, 0, w, h);
    return c;
  });
}

/** Mahogany for the dialogue cradle: long ring lines bent by noise, tiling horizontally. */
export function mahogany(seed = 21): string {
  return once(`wood:${seed}`, () => {
    const W = 512, H = 256;
    const [c, g] = canvas(W, H);
    const warp = fbm(seed, 4, 4);
    const pores = fbm(seed + 3, 64, 2);
    const img = g.createImageData(W, H);
    const d = img.data;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const u = x / W, v = y / H;
        const ring = Math.sin((v * 22 + warp(u, v) * 7) * Math.PI);
        const grain = 0.5 + 0.5 * ring;
        const p = pores(u, v * 0.25);
        const t = grain * 0.55 + p * 0.45;
        const i = (y * W + x) * 4;
        d[i] = 46 + t * 52;
        d[i + 1] = 20 + t * 22;
        d[i + 2] = 11 + t * 10;
        d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  });
}

/** Tooled leather: dark brown with a pebbled grain and soft creases; tiles both ways. */
export function leather(seed = 33, hue: "brown" | "oxblood" = "brown"): string {
  return once(`leather:${seed}:${hue}`, () => {
    const S = 256;
    const [c, g] = canvas(S, S);
    const big = fbm(seed, 3, 4);
    const peb = fbm(seed + 5, 40, 2);
    const img = g.createImageData(S, S);
    const d = img.data;
    const [br, bg, bb] = hue === "brown" ? [62, 34, 20] : [78, 22, 20];
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const u = x / S, v = y / S;
        const p = peb(u, v);
        const pebble = Math.pow(Math.abs(p - 0.5) * 2, 0.6);
        const t = big(u, v) * 0.6 + (1 - pebble) * 0.5;
        const i = (y * S + x) * 4;
        d[i] = br * (0.55 + t * 0.7);
        d[i + 1] = bg * (0.55 + t * 0.7);
        d[i + 2] = bb * (0.55 + t * 0.7);
        d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  });
}

/**
 * Woven silk for bookmarks and ribbons: a fine twill of the base colour with
 * a sheen running along the threads. `across` weaves for horizontal ribbons.
 */
export function silk(hex: string, across = false, seed = 5): string {
  return once(`silk:${hex}:${across}:${seed}`, () => {
    const W = across ? 256 : 64, H = across ? 64 : 256;
    const [c, g] = canvas(W, H);
    const r = rng(seed);
    g.fillStyle = hex;
    g.fillRect(0, 0, W, H);
    // Twill: diagonal hairlines, alternating light and dark.
    for (let k = -H; k < W + H; k += 2) {
      g.strokeStyle = (k / 2) % 2 ? "rgba(255,240,220,.07)" : "rgba(0,0,0,.12)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(k, 0);
      g.lineTo(k + H * 0.35, H);
      g.stroke();
    }
    // Thread slubs.
    for (let k = 0; k < 120; k++) {
      g.fillStyle = r() > 0.5 ? "rgba(255,235,210,.08)" : "rgba(0,0,0,.1)";
      if (across) g.fillRect(r() * W, r() * H, 3 + r() * 10, 1);
      else g.fillRect(r() * W, r() * H, 1, 3 + r() * 10);
    }
    return c;
  });
}

/**
 * Brocade: silk with a woven damask motif (a lily in a lozenge) in a lighter
 * thread, for the talk ribbons and the journal's endpapers.
 */
export function brocade(ground: string, thread: string, seed = 8): string {
  return once(`brocade:${ground}:${thread}:${seed}`, () => {
    const S = 64;
    const [c, g] = canvas(S, S);
    g.fillStyle = ground;
    g.fillRect(0, 0, S, S);
    for (let k = 0; k < S * 2; k += 2) {
      g.strokeStyle = (k / 2) % 2 ? "rgba(255,240,220,.05)" : "rgba(0,0,0,.12)";
      g.beginPath();
      g.moveTo(k, 0);
      g.lineTo(k - S, S);
      g.stroke();
    }
    g.fillStyle = thread;
    g.globalAlpha = 0.32;
    const lily = (cx: number, cy: number, s: number) => {
      g.beginPath();
      g.moveTo(cx, cy - 10 * s);
      g.bezierCurveTo(cx + 4 * s, cy - 5 * s, cx + 3 * s, cy + 1 * s, cx, cy + 3 * s);
      g.bezierCurveTo(cx - 3 * s, cy + 1 * s, cx - 4 * s, cy - 5 * s, cx, cy - 10 * s);
      g.moveTo(cx, cy + 1 * s);
      g.bezierCurveTo(cx + 8 * s, cy - 6 * s, cx + 11 * s, cy + 1 * s, cx + 6 * s, cy + 5 * s);
      g.bezierCurveTo(cx + 6 * s, cy + 2 * s, cx + 3 * s, cy + 2 * s, cx, cy + 3 * s);
      g.moveTo(cx, cy + 1 * s);
      g.bezierCurveTo(cx - 8 * s, cy - 6 * s, cx - 11 * s, cy + 1 * s, cx - 6 * s, cy + 5 * s);
      g.bezierCurveTo(cx - 6 * s, cy + 2 * s, cx - 3 * s, cy + 2 * s, cx, cy + 3 * s);
      g.rect(cx - 4 * s, cy + 4 * s, 8 * s, 1.6 * s);
      g.fill();
    };
    lily(16, 18, 1);
    lily(48, 50, 1);
    g.globalAlpha = 0.18;
    g.strokeStyle = thread;
    g.lineWidth = 1;
    for (const [x, y] of [[48, 18], [16, 50]] as const) {
      g.beginPath();
      g.moveTo(x, y - 6);
      g.lineTo(x + 6, y);
      g.lineTo(x, y + 6);
      g.lineTo(x - 6, y);
      g.closePath();
      g.stroke();
    }
    g.globalAlpha = 1;
    return c;
  });
}

/** Warm shafts of light falling from the upper right, blurred soft. */
export function godRays(seed = 4): string {
  return once(`rays:${seed}`, () => {
    const W = 1024, H = 640;
    const [c, g] = canvas(W, H);
    const r = rng(seed);
    const ox = W * 0.92, oy = -H * 0.25;
    g.filter = "blur(14px)";
    g.globalCompositeOperation = "lighter";
    for (let k = 0; k < 9; k++) {
      const a = Math.PI * (0.58 + r() * 0.2);
      const spread = 0.02 + r() * 0.05;
      const len = H * (1.4 + r() * 0.6);
      const grad = g.createLinearGradient(ox, oy, ox + Math.cos(a) * len, oy + Math.sin(a) * len);
      const alpha = 0.1 + r() * 0.16;
      grad.addColorStop(0, `rgba(255,214,140,${alpha})`);
      grad.addColorStop(0.55, `rgba(255,196,120,${alpha * 0.5})`);
      grad.addColorStop(1, "rgba(255,190,110,0)");
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(ox, oy);
      g.lineTo(ox + Math.cos(a - spread) * len, oy + Math.sin(a - spread) * len);
      g.lineTo(ox + Math.cos(a + spread) * len, oy + Math.sin(a + spread) * len);
      g.closePath();
      g.fill();
    }
    return c;
  });
}

/** Cache of portraits with near-white edge grounds tinted to warm sepia (see warmGround). */
const grounds = new Map<string, string | Promise<string>>();

/**
 * An opaque portrait whose flat ground is near white would glare out of a
 * candlelit book. Flood from the border through light, unsaturated pixels and
 * blend them into a warm sepia vignette. Returns the original URL until the
 * pass has run (then calls `done`).
 */
export function warmGround(url: string, done: () => void): string {
  const got = grounds.get(url);
  if (typeof got === "string") return got;
  if (!got) {
    const p = new Promise<string>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const W = Math.min(1600, img.naturalWidth), H = Math.round((img.naturalHeight / img.naturalWidth) * W);
          const [c, g] = canvas(W, H);
          g.drawImage(img, 0, 0, W, H);
          const im = g.getImageData(0, 0, W, H);
          const d = im.data;
          const light = (i: number) => {
            const r = d[i]!, gg = d[i + 1]!, b = d[i + 2]!;
            const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
            return mx > 222 && (mx - mn) / Math.max(1, mx) < 0.1;
          };
          const seen = new Uint8Array(W * H);
          const stack: number[] = [];
          for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
          for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
          let count = 0;
          while (stack.length) {
            const p = stack.pop()!;
            if (seen[p] || !light(p * 4)) continue;
            seen[p] = 1;
            count++;
            const x = p % W, y = (p / W) | 0;
            if (x > 0) stack.push(p - 1);
            if (x < W - 1) stack.push(p + 1);
            if (y > 0) stack.push(p - W);
            if (y < H - 1) stack.push(p + W);
          }
          if (count < W * H * 0.04) return resolve(url);
          for (let p = 0; p < W * H; p++) {
            if (!seen[p]) continue;
            const x = p % W, y = (p / W) | 0;
            const dx = x / W - 0.5, dy = y / H - 0.38;
            const t = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 1.7);
            const i = p * 4;
            d[i] = 200 - t * 142;
            d[i + 1] = 168 - t * 130;
            d[i + 2] = 120 - t * 96;
          }
          g.putImageData(im, 0, 0);
          resolve(toUrl(c));
        } catch {
          resolve(url);
        }
      };
      img.onerror = () => resolve(url);
      img.src = url;
    });
    grounds.set(url, p);
    void p.then((u) => {
      grounds.set(url, u);
      done();
    });
  }
  return url;
}

/** Cache of "is this cutout a bust" answers (see bustOf). */
const busts = new Map<string, boolean | Promise<boolean>>();

/**
 * Is this cutout a bust (cropped across the chest by its frame, so nearly
 * the whole bottom row is solid)? A bust cannot stand on the stage; it
 * belongs in a cameo. null until the image has been measured (then `done`).
 */
export function bustOf(url: string, done: () => void): boolean | null {
  const got = busts.get(url);
  if (typeof got === "boolean") return got;
  if (!got) {
    const p = new Promise<boolean>((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const W = 96, H = Math.max(8, Math.round((img.naturalHeight / img.naturalWidth) * W));
          const [, g] = canvas(W, H);
          g.drawImage(img, 0, 0, W, H);
          const d = g.getImageData(0, H - 3, W, 2).data;
          let solid = 0;
          for (let i = 3; i < d.length; i += 4) if (d[i]! > 160) solid++;
          resolve(solid / (W * 2) > 0.82);
        } catch {
          resolve(false);
        }
      };
      img.onerror = () => resolve(false);
      img.src = url;
    });
    busts.set(url, p);
    void p.then((b) => {
      busts.set(url, b);
      done();
    });
  }
  return null;
}

/**
 * Loose sepia brushwork over a transparent ground: laid over the delve's
 * corridor (overlay blend) so the 3D view reads as an ink-and-wash plate.
 */
export function brushwork(seed = 61): string {
  return once(`brush:${seed}`, () => {
    const W = 900, H = 600;
    const [c, g] = canvas(W, H);
    const r = rng(seed);
    g.lineCap = "round";
    for (let k = 0; k < 900; k++) {
      const x = r() * W, y = r() * H, len = 30 + r() * 120, a = (r() - 0.5) * 0.7 + (r() < 0.5 ? 0 : Math.PI / 2);
      const light = r() < 0.45;
      g.strokeStyle = light ? `rgba(255,236,200,${0.05 + r() * 0.1})` : `rgba(70,40,18,${0.06 + r() * 0.12})`;
      g.lineWidth = 2 + r() * 9;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + (r() - 0.5) * 20, y + Math.sin(a) * len * 0.5 + (r() - 0.5) * 20, x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
    return c;
  });
}
