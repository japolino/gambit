/**
 * The flat first-person corridor (docs/DESIGN.md 6.1, 6.2 fallback): with no
 * WebGL, a delve is drawn the old way, as nested frames from the cells ahead
 * and their sides. Same menu, same automap.
 */
type Cell = { ahead: string; left: string; right: string };

const wallImages = new Map<string, HTMLImageElement>();
function wallImage(url: string | null): HTMLImageElement | null {
  if (!url) return null;
  let img = wallImages.get(url);
  if (!img) {
    img = new Image();
    img.src = url;
    wallImages.set(url, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

export function drawCorridor2D(canvas: HTMLCanvasElement, view: Cell[], o: { onebit: boolean; wall: string | null }): void {
  const g = canvas.getContext("2d");
  if (!g) return;
  const W = canvas.width;
  const H = canvas.height;
  const ink = o.onebit ? "#0c0b0a" : "#050404";
  const line = o.onebit ? "#e8e2d0" : "rgba(201,168,101,.55)";
  g.fillStyle = ink;
  g.fillRect(0, 0, W, H);
  // Frame i is the near edge of cell i ahead; it shrinks with distance.
  const frame = (i: number) => {
    const k = 1 / (1 + i * 0.85);
    const w = W * k;
    const h = H * k;
    return { x: (W - w) / 2, y: (H - h) / 2, w, h };
  };
  const tex = wallImage(o.wall);
  const shade = (i: number) => Math.max(0.12, 1 - i * 0.22);
  const fillWall = (pts: [number, number][], i: number, side: boolean) => {
    g.save();
    g.beginPath();
    g.moveTo(pts[0]![0], pts[0]![1]);
    for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
    g.closePath();
    if (o.onebit) {
      g.fillStyle = ink;
      g.fill();
      g.strokeStyle = line;
      g.lineWidth = 1;
      g.stroke();
    } else {
      g.clip();
      if (tex) {
        const xs = pts.map((p) => p[0]);
        const ys = pts.map((p) => p[1]);
        g.drawImage(tex, Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      } else {
        g.fillStyle = "#4a423a";
        g.fillRect(0, 0, W, H);
      }
      g.fillStyle = `rgba(5,4,4,${1 - shade(i) * (side ? 0.8 : 1)})`;
      g.fillRect(0, 0, W, H);
    }
    g.restore();
  };
  // Floor and ceiling bands fade into the dark.
  if (!o.onebit) {
    const fl = g.createLinearGradient(0, H / 2, 0, H);
    fl.addColorStop(0, "#050404");
    fl.addColorStop(1, "#3a332c");
    g.fillStyle = fl;
    g.fillRect(0, H / 2, W, H / 2);
    const ce = g.createLinearGradient(0, 0, 0, H / 2);
    ce.addColorStop(0, "#1a1714");
    ce.addColorStop(1, "#050404");
    g.fillStyle = ce;
    g.fillRect(0, 0, W, H / 2);
  }
  const n = Math.min(view.length, 5);
  // Draw far to near so near walls cover far ones.
  for (let i = n - 1; i >= 0; i--) {
    const c = view[i]!;
    const a = frame(i);
    const b = frame(i + 1);
    if (i > 0 && (c.ahead === "#" || c.ahead === "?")) {
      fillWall([[a.x, a.y], [a.x + a.w, a.y], [a.x + a.w, a.y + a.h], [a.x, a.y + a.h]], i, false);
      continue;
    }
    if (c.ahead === "L") {
      g.fillStyle = o.onebit ? ink : "#5c3e26";
      g.fillRect(b.x, b.y, b.w, b.h);
      g.strokeStyle = o.onebit ? line : "#c9a865";
      g.strokeRect(b.x + b.w * 0.1, b.y + b.h * 0.05, b.w * 0.8, b.h * 0.95);
    }
    const sideWall = (s: string) => s === "#" || s === "?";
    if (sideWall(c.left)) fillWall([[a.x, a.y], [b.x, b.y], [b.x, b.y + b.h], [a.x, a.y + a.h]], i, true);
    else if (o.onebit) {
      g.strokeStyle = line;
      g.strokeRect(a.x, b.y, b.x - a.x, b.h);
    }
    if (sideWall(c.right)) fillWall([[a.x + a.w, a.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [a.x + a.w, a.y + a.h]], i, true);
    else if (o.onebit) {
      g.strokeStyle = line;
      g.strokeRect(b.x + b.w, b.y, a.x + a.w - b.x - b.w, b.h);
    }
  }
}
