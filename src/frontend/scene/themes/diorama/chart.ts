/**
 * Two canvas passes the diorama needs at runtime:
 *  - drawChart: the delve's map as a cartographer's chart on the easel
 *    (laid paper, a faint grid, inked walls with hatching, washed floors,
 *    room marks, a brass pin where you stand with an arrow for your facing,
 *    a compass rose, and burnt fog at the edges). Drawn by the theme so the
 *    map fills its canvas instead of floating small in it.
 *  - cleanCutout: a keyed figure's alpha eroded and its rim darkened toward
 *    the room's warm brown, so no pale matte fringe shows against the shop.
 */
import type { DelveView } from "../contract.js";

export function drawChart(c: HTMLCanvasElement, d: DelveView, paperTex: HTMLCanvasElement): void {
  const W = c.width, H = c.height;
  const g = c.getContext("2d")!;
  g.drawImage(paperTex, 0, 0, W, H);
  let x0 = d.x, x1 = d.x, y0 = d.y, y1 = d.y;
  d.grid.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === "?") return;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }));
  const span = Math.max(x1 - x0 + 2, y1 - y0 + 2, 5);
  const cell = Math.min(96, Math.floor(Math.min(W * 0.84, H * 0.74) / span));
  const ox = Math.round(W / 2 - ((x0 + x1 + 1) / 2) * cell);
  const oy = Math.round(H * 0.53 - ((y0 + y1 + 1) / 2) * cell);
  const at = (x: number, y: number) => d.grid[y]?.[x] ?? "?";
  const floor = (ch: string) => ch !== "?" && ch !== "#";

  // A faint surveyor's grid over the whole sheet.
  g.strokeStyle = "rgba(110,70,30,0.14)";
  g.lineWidth = 1;
  for (let x = ((ox % cell) + cell) % cell; x < W; x += cell) {
    g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); g.stroke();
  }
  for (let y = ((oy % cell) + cell) % cell; y < H; y += cell) {
    g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke();
  }
  // Washed floors, hatched walls.
  for (let y = 0; y < d.grid.length; y++) {
    for (let x = 0; x < (d.grid[y]?.length ?? 0); x++) {
      const ch = at(x, y);
      const px = ox + x * cell, py = oy + y * cell;
      if (floor(ch)) {
        g.fillStyle = ch === "L" ? "rgba(196,140,64,0.34)" : "rgba(150,104,52,0.22)";
        g.fillRect(px, py, cell, cell);
      } else if (ch === "#") {
        let near = false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (floor(at(x + dx, y + dy))) near = true;
        if (!near) continue;
        g.save();
        g.beginPath();
        g.rect(px, py, cell, cell);
        g.clip();
        g.fillStyle = "rgba(90,58,28,0.22)";
        g.fillRect(px, py, cell, cell);
        g.strokeStyle = "rgba(58,32,12,0.6)";
        g.lineWidth = Math.max(1, cell / 28);
        for (let k = -cell; k < cell * 2; k += Math.max(4, cell / 6)) {
          g.beginPath(); g.moveTo(px + k, py); g.lineTo(px + k - cell, py + cell); g.stroke();
        }
        g.restore();
      }
    }
  }
  // Inked wall lines wherever a floor meets rock or the unknown.
  g.strokeStyle = "rgba(42,22,8,0.9)";
  g.lineWidth = Math.max(2, cell / 14);
  g.lineCap = "round";
  for (let y = 0; y < d.grid.length; y++) {
    for (let x = 0; x < (d.grid[y]?.length ?? 0); x++) {
      if (!floor(at(x, y))) continue;
      const px = ox + x * cell, py = oy + y * cell;
      const side = (nx: number, ny: number, ax: number, ay: number, bx: number, by: number) => {
        if (floor(at(nx, ny))) return;
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
      };
      side(x, y - 1, px, py, px + cell, py);
      side(x, y + 1, px, py + cell, px + cell, py + cell);
      side(x - 1, y, px, py, px, py + cell);
      side(x + 1, y, px + cell, py, px + cell, py + cell);
    }
  }
  // Room marks.
  for (const r of d.rooms) {
    if (r.cleared && r.kind !== "boss") continue;
    const cx = ox + r.x * cell + cell / 2, cy = oy + r.y * cell + cell / 2, s = cell * 0.24;
    g.lineWidth = Math.max(2, cell / 16);
    if (r.kind === "boss" || r.kind === "fight") {
      g.strokeStyle = "#8e1c14";
      g.beginPath(); g.moveTo(cx - s, cy - s); g.lineTo(cx + s, cy + s); g.moveTo(cx + s, cy - s); g.lineTo(cx - s, cy + s); g.stroke();
      if (r.kind === "boss") { g.beginPath(); g.arc(cx, cy, s * 1.5, 0, Math.PI * 2); g.stroke(); }
    } else if (r.kind === "key" || r.kind === "treasure") {
      g.fillStyle = "#c9932e"; g.beginPath(); g.arc(cx, cy, s * 0.8, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#5a3a12"; g.stroke();
    } else if (r.kind === "rest") {
      g.strokeStyle = "#2f6a3a"; g.beginPath(); g.arc(cx, cy, s, 0, Math.PI * 2); g.stroke();
    } else if (r.kind === "trap") {
      g.strokeStyle = "#8e1c14"; g.beginPath(); g.moveTo(cx, cy - s); g.lineTo(cx + s, cy + s); g.lineTo(cx - s, cy + s); g.closePath(); g.stroke();
    }
  }
  // Where you stand: an inked arrow for your facing, a brass pin through the chart.
  const cx = ox + d.x * cell + cell / 2, cy = oy + d.y * cell + cell / 2;
  const ang = (d.facing * Math.PI) / 2 - Math.PI / 2;
  g.fillStyle = "#8e1c14";
  g.beginPath();
  g.moveTo(cx + Math.cos(ang) * cell * 0.46, cy + Math.sin(ang) * cell * 0.46);
  g.lineTo(cx + Math.cos(ang + 2.5) * cell * 0.36, cy + Math.sin(ang + 2.5) * cell * 0.36);
  g.lineTo(cx + Math.cos(ang - 2.5) * cell * 0.36, cy + Math.sin(ang - 2.5) * cell * 0.36);
  g.closePath();
  g.fill();
  const pr = Math.max(7, cell * 0.16);
  g.fillStyle = "rgba(40,20,4,0.45)";
  g.beginPath(); g.ellipse(cx + pr * 0.9, cy + pr * 0.5, pr * 1.1, pr * 0.5, 0, 0, Math.PI * 2); g.fill();
  const pg = g.createRadialGradient(cx - pr * 0.4, cy - pr * 0.4, 1, cx, cy, pr);
  pg.addColorStop(0, "#fff2c0"); pg.addColorStop(0.4, "#d4a24a"); pg.addColorStop(1, "#6e4718");
  g.fillStyle = pg;
  g.beginPath(); g.arc(cx, cy, pr, 0, Math.PI * 2); g.fill();
  // A compass rose in the corner.
  const rx = W - 70, ry = 74, rr = 46;
  g.save();
  g.translate(rx, ry);
  for (let i = 0; i < 8; i++) {
    g.rotate(Math.PI / 4);
    g.fillStyle = i % 2 ? "rgba(90,58,28,0.55)" : "rgba(142,28,20,0.75)";
    g.beginPath(); g.moveTo(0, -rr * (i % 2 ? 0.6 : 1)); g.lineTo(rr * 0.12, 0); g.lineTo(-rr * 0.12, 0); g.closePath(); g.fill();
  }
  g.restore();
  g.strokeStyle = "rgba(90,58,28,0.6)";
  g.lineWidth = 1.5;
  g.beginPath(); g.arc(rx, ry, rr * 0.7, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#5a160c";
  g.font = "bold 22px 'Gambit Cinzel', Georgia, serif";
  g.textAlign = "center";
  g.fillText("N", rx, ry - rr - 6);
  // Burnt, foxed edges: the unknown.
  const fog = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.68);
  fog.addColorStop(0, "rgba(90,48,14,0)");
  fog.addColorStop(0.75, "rgba(90,48,14,0.28)");
  fog.addColorStop(1, "rgba(40,18,4,0.8)");
  g.fillStyle = fog;
  g.fillRect(0, 0, W, H);
}

const cleanCache = new Map<string, string | "pending">();
/** A cut-out with its fringe cleaned (cached; null until ready, then `done` is called). */
export function cleanCutout(url: string, done: () => void): string | null {
  const hit = cleanCache.get(url);
  if (hit === "pending") return null;
  if (hit) return hit;
  cleanCache.set(url, "pending");
  const img = new Image();
  img.onload = () => {
    try {
      const w = img.width, h = img.height;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d", { willReadFrequently: true })!;
      g.drawImage(img, 0, 0);
      const id = g.getImageData(0, 0, w, h);
      const d = id.data;
      const a = new Uint8Array(w * h);
      for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3]!;
      // Separable min filter: the eroded alpha (r) and a wider "near the rim" mask (R).
      const erode = (src: Uint8Array, r: number) => {
        const t = new Uint8Array(src.length), o = new Uint8Array(src.length);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          let m = 255;
          for (let k = -r; k <= r; k++) { const v = src[y * w + Math.min(w - 1, Math.max(0, x + k))]!; if (v < m) m = v; }
          t[y * w + x] = m;
        }
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          let m = 255;
          for (let k = -r; k <= r; k++) { const v = t[Math.min(h - 1, Math.max(0, y + k)) * w + x]!; if (v < m) m = v; }
          o[y * w + x] = m;
        }
        return o;
      };
      const k = Math.max(1, Math.round(w / 520));
      const e1 = erode(a, k);
      const e2 = erode(e1, k * 2);
      for (let i = 0; i < a.length; i++) {
        const j = i * 4;
        d[j + 3] = e1[i]!;
        if (e2[i]! < 250 && e1[i]! > 0) {
          // Near the rim: pull the colour toward the room's warm brown.
          const t = 0.55 * (1 - e2[i]! / 255);
          d[j] = d[j]! * (1 - t) + 42 * t;
          d[j + 1] = d[j + 1]! * (1 - t) + 26 * t;
          d[j + 2] = d[j + 2]! * (1 - t) + 14 * t;
        }
      }
      g.putImageData(id, 0, 0);
      c.toBlob((b) => {
        cleanCache.set(url, b ? URL.createObjectURL(b) : url);
        done();
      }, "image/png");
    } catch {
      cleanCache.set(url, url);
      done();
    }
  };
  img.onerror = () => {
    cleanCache.set(url, url);
    done();
  };
  img.src = url;
  return null;
}
