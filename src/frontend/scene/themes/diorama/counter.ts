/**
 * The shop counter, painted into one canvas as a real one-point-perspective
 * solid: a foreshortened top plane (oak grain texture-mapped row by row with
 * perspective-correct depth, so the boards crowd together toward the back),
 * chamfered front corners, a lit bullnose lip, a walnut fascia with raised
 * panels, and a dark toe-kick skirt. Repainted only when its box resizes.
 */
import { oak, walnut } from "./textures.js";

/**
 * Geometry as fractions of the canvas box. The far edge spans fl..1-fl at
 * the top of the box; the near edge spans the full width at yN; the fascia
 * runs down to yL; below that is the skirt. zf/zn is the far/near depth
 * ratio (far width = near width * zn / zf), which matches fl.
 */
export const GEO = { fl: 0.1, yN: 0.56, yL: 0.8, cx: 0.026, cy: 0.16, bev: 0.028, zn: 1, zf: 1.25 };

/** Screen y (fraction of the box) of a point at depth d on the top (0 = far edge, 1 = near edge). */
export function depthToY(d: number): number {
  const z = GEO.zf + (GEO.zn - GEO.zf) * d;
  return (GEO.yN * (1 / z - 1 / GEO.zf)) / (1 / GEO.zn - 1 / GEO.zf);
}

export function paintCounter(cv: HTMLCanvasElement, w: number, h: number, dpr: number): void {
  const W = Math.max(2, Math.round(w * dpr));
  const H = Math.max(2, Math.round(h * dpr));
  if (cv.width !== W) cv.width = W;
  if (cv.height !== H) cv.height = H;
  const g = cv.getContext("2d")!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  // Work in device pixels throughout.
  const yN = GEO.yN * H;
  const yL = GEO.yL * H;
  const cx = GEO.cx * W;
  const cyH = GEO.cy * yN;
  const bev = GEO.bev * H;
  const sideX = (y: number) => GEO.fl * W * (1 - y / yN);
  const yc = yN - cyH;
  const top: [number, number][] = [[sideX(0), 0], [W - sideX(0), 0], [W - sideX(yc), yc], [W - cx, yN], [cx, yN], [sideX(yc), yc]];
  const poly = (pts: [number, number][]) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
  };

  /* ---- Top plane: perspective-correct row mapping of the oak boards ---- */
  const tex = oak();
  g.save();
  poly(top);
  g.clip();
  const depthSpan = tex.height * 0.82;
  for (let y = 0; y < yN; y++) {
    const s = (y + 0.5) / yN;
    const invz = 1 / GEO.zf + s * (1 / GEO.zn - 1 / GEO.zf);
    const z = 1 / invz;
    const d = (GEO.zf - z) / (GEO.zf - GEO.zn);
    const sy = Math.min(tex.height - 1, d * depthSpan);
    const xl = sideX(y);
    g.drawImage(tex, 0, sy, tex.width, 1, xl, y, W - xl * 2, 1.6);
  }
  // Far edge falls into the shade behind the counter; the sides darken too.
  let gr = g.createLinearGradient(0, 0, 0, yN);
  gr.addColorStop(0, "rgba(28,10,0,0.78)");
  gr.addColorStop(0.16, "rgba(28,10,0,0.28)");
  gr.addColorStop(0.5, "rgba(28,10,0,0)");
  gr.addColorStop(1, "rgba(28,10,0,0.12)");
  g.fillStyle = gr;
  g.fillRect(0, 0, W, yN);
  gr = g.createLinearGradient(0, 0, W, 0);
  gr.addColorStop(0, "rgba(16,6,0,0.75)");
  gr.addColorStop(0.2, "rgba(16,6,0,0.1)");
  gr.addColorStop(0.8, "rgba(16,6,0,0.1)");
  gr.addColorStop(1, "rgba(16,6,0,0.75)");
  g.fillStyle = gr;
  g.fillRect(0, 0, W, yN);
  // The lamp's pool on the lacquer, and its long specular streak.
  g.globalCompositeOperation = "screen";
  g.save();
  g.translate(W * 0.47, yN * 0.42);
  g.scale(1, (yN * 1.1) / W);
  gr = g.createRadialGradient(0, 0, 0, 0, 0, W * 0.5);
  gr.addColorStop(0, "rgba(255,214,150,0.42)");
  gr.addColorStop(0.45, "rgba(255,180,100,0.14)");
  gr.addColorStop(1, "rgba(255,160,80,0)");
  g.fillStyle = gr;
  g.fillRect(-W, -W, W * 2, W * 2);
  g.restore();
  g.save();
  g.translate(W * 0.44, yN * 0.3);
  g.scale(1, 0.05);
  gr = g.createRadialGradient(0, 0, 0, 0, 0, W * 0.22);
  gr.addColorStop(0, "rgba(255,236,200,0.35)");
  gr.addColorStop(1, "rgba(255,236,200,0)");
  g.fillStyle = gr;
  g.fillRect(-W, -W, W * 2, W * 2);
  g.restore();
  g.globalCompositeOperation = "source-over";
  g.restore();
  // A crisp lit line along the far edge where the top meets the back lip.
  g.strokeStyle = "rgba(255,210,150,0.22)";
  g.lineWidth = Math.max(1, dpr);
  g.beginPath();
  g.moveTo(sideX(1.5), 1.5);
  g.lineTo(W - sideX(1.5), 1.5);
  g.stroke();

  /* ---- Bullnose lip: a bright rounded edge following the chamfers ---- */
  const lip: [number, number][] = [[sideX(yc), yc], [cx, yN], [W - cx, yN], [W - sideX(yc), yc], [W - sideX(yc), yc + bev], [W - cx, yN + bev], [cx, yN + bev], [sideX(yc), yc + bev]];
  g.save();
  poly(lip);
  g.clip();
  g.drawImage(tex, 0, tex.height * 0.5, tex.width, tex.height * 0.1, 0, yc, W, yN + bev - yc);
  gr = g.createLinearGradient(0, yN - bev * 0.2, 0, yN + bev);
  gr.addColorStop(0, "rgba(255,226,170,0.75)");
  gr.addColorStop(0.3, "rgba(255,200,130,0.3)");
  gr.addColorStop(0.75, "rgba(40,16,4,0.35)");
  gr.addColorStop(1, "rgba(20,8,2,0.8)");
  g.fillStyle = gr;
  g.fillRect(0, yc - bev, W, yN + bev * 2 - yc);
  // The chamfer faces of the lip turn away from the light.
  g.fillStyle = "rgba(20,8,2,0.45)";
  g.fillRect(0, 0, cx, H);
  g.fillRect(W - cx, 0, cx, H);
  g.restore();

  /* ---- Fascia: walnut, with raised panels; chamfer facets in shade ---- */
  const wal = walnut();
  const f0 = yN + bev;
  const fc0 = yc + bev;
  const faces: { pts: [number, number][]; dark: number }[] = [
    { pts: [[cx, f0], [W - cx, f0], [W - cx, yL], [cx, yL]], dark: 0.18 },
    { pts: [[sideX(yc), fc0], [cx, f0], [cx, yL], [sideX(yc), yL - cyH]], dark: 0.55 },
    { pts: [[W - cx, f0], [W - sideX(yc), fc0], [W - sideX(yc), yL - cyH], [W - cx, yL]], dark: 0.55 },
  ];
  for (const f of faces) {
    g.save();
    poly(f.pts);
    g.clip();
    g.drawImage(wal, 0, 0, wal.width, wal.height, 0, f0 - cyH, W, yL - f0 + cyH);
    g.fillStyle = `rgba(14,6,2,${f.dark})`;
    g.fillRect(0, 0, W, H);
    // The lip's shadow on the top of the fascia.
    gr = g.createLinearGradient(0, f0, 0, f0 + (yL - f0) * 0.35);
    gr.addColorStop(0, "rgba(0,0,0,0.65)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(0, f0 - cyH, W, yL - f0 + cyH);
    g.restore();
  }
  // Raised panels on the centre face.
  const fh = yL - f0;
  const pn = Math.max(3, Math.round((W - 2 * cx) / (fh * 2.3)));
  const pw = (W - 2 * cx) / pn;
  const m = fh * 0.2;
  for (let i = 0; i < pn; i++) {
    const x0 = cx + i * pw + m * 0.7;
    const x1 = cx + (i + 1) * pw - m * 0.7;
    const y0 = f0 + m * 1.1;
    const y1 = yL - m * 0.8;
    const lw = Math.max(1.5, fh * 0.035);
    // Recessed groove: dark on the lit (top/left) edges, light on the bottom/right.
    g.lineWidth = lw;
    g.strokeStyle = "rgba(0,0,0,0.6)";
    g.beginPath();
    g.moveTo(x0, y1);
    g.lineTo(x0, y0);
    g.lineTo(x1, y0);
    g.stroke();
    g.strokeStyle = "rgba(255,190,120,0.22)";
    g.beginPath();
    g.moveTo(x1, y0);
    g.lineTo(x1, y1);
    g.lineTo(x0, y1);
    g.stroke();
    // Raised field with a soft sheen in the middle.
    gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, "rgba(255,190,120,0.07)");
    gr.addColorStop(0.5, "rgba(255,190,120,0.02)");
    gr.addColorStop(1, "rgba(0,0,0,0.18)");
    g.fillStyle = gr;
    g.fillRect(x0 + lw * 2, y0 + lw * 2, x1 - x0 - lw * 4, y1 - y0 - lw * 4);
    g.strokeStyle = "rgba(255,190,120,0.12)";
    g.lineWidth = Math.max(1, lw * 0.5);
    g.strokeRect(x0 + lw * 2, y0 + lw * 2, x1 - x0 - lw * 4, y1 - y0 - lw * 4);
  }

  /* ---- Base moulding and toe-kick skirt ---- */
  const bm = H * 0.022;
  g.save();
  poly([[sideX(yc), yL - cyH], [cx, yL], [W - cx, yL], [W - sideX(yc), yL - cyH], [W - sideX(yc), H], [sideX(yc), H]]);
  g.clip();
  gr = g.createLinearGradient(0, yL, 0, yL + bm);
  gr.addColorStop(0, "#6e4426");
  gr.addColorStop(0.4, "#3a2213");
  gr.addColorStop(1, "#1a0e07");
  g.fillStyle = gr;
  g.fillRect(0, yL - cyH, W, bm + cyH);
  gr = g.createLinearGradient(0, yL + bm, 0, H);
  gr.addColorStop(0, "#120a05");
  gr.addColorStop(1, "#050302");
  g.fillStyle = gr;
  g.fillRect(0, yL + bm, W, H - yL - bm);
  g.restore();
}
