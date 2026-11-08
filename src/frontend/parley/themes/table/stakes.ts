/**
 * The Table talk's structure in the room: the one you face seated by the room's camera, your own hand under
 * the fact cards, the "whole talk" tab on the reply plaque, and the stakes chalked on the room's hanging slate
 * with patience as real candles on its ledge (scene/themes/table/duel.ts carries them to the room, which may be
 * the parent page of this view's frame).
 */
import { factCard, handBack, handFront } from "../../../scene/themes/table/art.js";
import { paperUrl, slateUrl } from "../../../scene/themes/table/tex.js";
import { duel, duelCamera, EDGE, FLOOR, project } from "../../../scene/themes/table/duel.js";
import type { ParleyDecor, ParleyThemeCtx } from "../types.js";

export const svgUrl = (svg: string): string =>
  `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/^<svg /, '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ').replace(/ aria-hidden="true"| class="cardart"/g, ""))}")`;

/** Brass corner filigree for the reply plaque (stretched over it). */
const CORNERS = `<svg viewBox="0 0 400 300" preserveAspectRatio="none">${(
  [
    [0, 0, 1, 1],
    [400, 0, -1, 1],
    [0, 300, 1, -1],
    [400, 300, -1, -1],
  ] as const
)
  .map(
    ([x, y, sx, sy]) =>
      `<g transform="translate(${x} ${y}) scale(${sx} ${sy})" fill="none" stroke="#d8a040" stroke-width="2.4" stroke-linecap="round"><path d="M6,40 L6,6 L40,6"/><path d="M12,58 C12,26 26,12 58,12"/><path d="M16,16 C26,22 30,30 26,40 C22,30 14,28 16,16Z" fill="#d8a040"/><circle cx="6" cy="6" r="4" fill="#ffe6a0" stroke="#5a3608"/></g>`,
  )
  .join("")}</svg>`;

/** A little brass service bell (the deal is struck by ringing it). */
const BELL = `<svg viewBox="0 0 40 40"><ellipse cx="20" cy="34" rx="17" ry="4" fill="#3a2008"/><path d="M5,32 C5,18 11,11 20,11 C29,11 35,18 35,32Z" fill="#d8a040" stroke="#1a0e02" stroke-width="2"/><path d="M10,28 C10,20 14,15 20,14" stroke="#fff2c0" stroke-width="2.4" fill="none" stroke-linecap="round"/><rect x="18" y="5" width="4" height="7" rx="1" fill="#8a5a18" stroke="#1a0e02" stroke-width="1.5"/><ellipse cx="20" cy="5" rx="5" ry="2" fill="#d8a040" stroke="#1a0e02" stroke-width="1.5"/></svg>`;

/** A card back in the house colours: red, a gilt lattice, an inked seal. */
function backSvg(): string {
  const lat = Array.from({ length: 22 }, (_, i) => `M${-100 + i * 18},0 L${100 + i * 18},294 M${300 - i * 18},0 L${100 - i * 18},294`).join(" ");
  return `<svg viewBox="0 0 200 294" preserveAspectRatio="none"><defs><clipPath id="o"><rect x="5" y="5" width="190" height="284" rx="8"/></clipPath></defs>
    <rect x="5" y="5" width="190" height="284" rx="8" fill="#5e0b10"/>
    <g clip-path="url(#o)"><rect x="14" y="14" width="172" height="266" fill="#b81d24"/><path d="${lat}" stroke="#f2cf7a" stroke-width="1.4" opacity=".5"/></g>
    <circle cx="100" cy="147" r="32" fill="#e8dfcf" stroke="#0d0b0e" stroke-width="5"/>
    <path d="M100,123 L106,141 L124,147 L106,153 L100,171 L94,153 L76,147 L94,141Z" fill="#b81d24" stroke="#0d0b0e" stroke-width="3"/>
    <rect x="14" y="14" width="172" height="266" fill="none" stroke="#f2cf7a" stroke-width="2"/>
    <rect x="5" y="5" width="190" height="284" rx="8" fill="none" stroke="#0d0b0e" stroke-width="6"/></svg>`;
}

/** Chalk on its own layer, eroded by speckle, laid on the slate. */
function chalk(g: CanvasRenderingContext2D, draw: (l: CanvasRenderingContext2D) => void, seed: number): void {
  const c = document.createElement("canvas");
  c.width = g.canvas.width;
  c.height = g.canvas.height;
  const l = c.getContext("2d")!;
  draw(l);
  l.globalAlpha = 0.4;
  l.translate(1.4, 1);
  draw(l);
  l.setTransform(1, 0, 0, 1, 0, 0);
  l.globalAlpha = 1;
  l.globalCompositeOperation = "destination-out";
  let a = seed >>> 0;
  const r = () => (a = (a * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 9000; i++) {
    l.fillStyle = `rgba(0,0,0,${0.3 + r() * 0.7})`;
    l.fillRect(r() * c.width, r() * c.height, 1 + r() * 2.2, 0.8 + r() * 1.2);
  }
  g.drawImage(c, 0, 0);
}

export function decorateRoom(ctx: ParleyThemeCtx): ParleyDecor {
  const root = ctx.root;
  root.style.setProperty("--paper", `url("${paperUrl()}")`);
  root.style.setProperty("--slate", `url("${slateUrl()}")`);
  // The fact card without the scene's pen stroke across its foot (it ran through the text).
  root.style.setProperty("--fact", svgUrl(factCard(7, paperUrl()).replace(/<path d="M150,258[^>]*\/>/, "")));
  root.style.setProperty("--back", svgUrl(backSvg()));
  root.style.setProperty("--corners", svgUrl(CORNERS));
  root.style.setProperty("--bell", svgUrl(BELL));
  const hb = document.createElement("div");
  hb.className = "tb-hb";
  hb.setAttribute("aria-hidden", "true");
  hb.innerHTML = handBack();
  const hf = document.createElement("div");
  hf.className = "tb-hf";
  hf.setAttribute("aria-hidden", "true");
  hf.innerHTML = handFront();
  // The whole talk, unrolled from the reply plaque on demand.
  const tx = document.createElement("button");
  tx.type = "button";
  tx.className = "tb-tx";
  const log = ctx.side.querySelector<HTMLElement>(".log");
  const paintTx = (): void => {
    const open = root.classList.contains("tb-full");
    tx.textContent = open ? "Fold it up" : "The whole talk";
    tx.setAttribute("aria-expanded", String(open));
  };
  tx.addEventListener("click", () => {
    root.classList.toggle("tb-full");
    paintTx();
    if (log) log.scrollTop = log.scrollHeight;
  });
  paintTx();
  ctx.side.append(hb, hf, tx);
  // Striking the deal rings the room's bell.
  const deal = ctx.side.querySelector(".actions .deal");
  const ring = (): void => {
    duel.ring++;
  };
  deal?.addEventListener("click", ring);

  /* The stakes, chalked on the room's slate. */
  const slate = document.createElement("canvas");
  slate.width = 600;
  slate.height = 720;
  const slateImg = new Image();
  slateImg.src = slateUrl();
  const head = ctx.side.querySelector<HTMLElement>(".head");
  let sig = "";
  const chalkStakes = (): void => {
    if (duel.staged !== "parley" || !head) return;
    const kind = head.querySelector(".kind")?.textContent ?? "";
    const label = head.querySelector(".meter-label")?.textContent ?? "";
    const value = head.querySelector(".meter-value")?.firstChild?.textContent ?? "";
    const fill = parseFloat((head.querySelector<HTMLElement>(".bar .fill")?.style.width ?? "0").replace("%", "")) / 100 || 0;
    const pips = head.querySelectorAll(".pip").length;
    const lit = head.querySelectorAll(".pip.on").length;
    duel.patience = pips ? { now: lit, max: pips } : null;
    const next = JSON.stringify([kind, label, value, fill, lit, pips, slateImg.complete]);
    if (next === sig) return;
    sig = next;
    const g = slate.getContext("2d")!;
    g.clearRect(0, 0, 600, 720);
    if (slateImg.complete && slateImg.naturalWidth) g.drawImage(slateImg, 0, 0, 600, 720);
    else {
      g.fillStyle = "#16181b";
      g.fillRect(0, 0, 600, 720);
    }
    const [how, ...rest] = kind.split("·").map((x) => x.trim());
    const plate = g.createLinearGradient(0, 30, 0, 100);
    plate.addColorStop(0, "#ffe6a0");
    plate.addColorStop(0.5, "#c08a30");
    plate.addColorStop(1, "#5a3608");
    g.fillStyle = plate;
    g.fillRect(40, 28, 520, 76);
    g.strokeStyle = "#1a0e02";
    g.lineWidth = 4;
    g.strokeRect(40, 28, 520, 76);
    g.fillStyle = "#1e1004";
    g.textAlign = "center";
    g.font = `800 44px "Gambit Cinzel", serif`;
    g.fillText((how || "The talk").toUpperCase(), 300, 82, 490);
    chalk(
      g,
      (l) => {
        l.fillStyle = l.strokeStyle = "#f2efe9";
        l.textAlign = "center";
        l.font = `italic 600 36px "Gambit Fell", serif`;
        l.fillText(rest.join(" · "), 300, 170, 540);
        l.fillStyle = "#c8c2b6";
        l.font = `700 36px "Gambit Cinzel", serif`;
        l.fillText(label.toUpperCase(), 300, 262);
        l.fillStyle = "#f2efe9";
        let size = 124;
        l.font = `800 ${size}px "Gambit Fell", serif`;
        while (l.measureText(value).width > 530 && size > 50) l.font = `800 ${(size -= 4)}px "Gambit Fell", serif`;
        l.fillText(value, 300, 392);
        l.lineWidth = 4;
        l.globalAlpha = 0.6;
        for (let i = 0; i <= 10; i++) {
          l.beginPath();
          l.moveTo(60 + i * 48, i % 5 ? 446 : 434);
          l.lineTo(60 + i * 48, 464);
          l.stroke();
        }
        l.globalAlpha = 1;
        l.lineWidth = 10;
        l.lineCap = "round";
        l.beginPath();
        l.moveTo(60, 455);
        l.lineTo(60 + 480 * Math.max(0, Math.min(1, fill)), 452);
        l.stroke();
        l.fillStyle = "#c8c2b6";
        l.font = `700 36px "Gambit Cinzel", serif`;
        l.fillText("PATIENCE", 300, 522);
        l.font = `italic 600 38px "Gambit Fell", serif`;
        l.fillStyle = "#f2efe9";
        if (pips) l.fillText(`${lit} of ${pips} candles still burn`, 300, 570);
      },
      4242,
    );
    duel.slate = slate;
    duel.slateVersion++;
  };
  slateImg.addEventListener("load", () => {
    sig = "";
    chalkStakes();
  });
  const mo = head ? new MutationObserver(() => chalkStakes()) : null;
  if (head && mo) mo.observe(head, { subtree: true, childList: true, characterData: true, attributes: true });
  void document.fonts?.ready.then(() => {
    sig = "";
    chalkStakes();
  });

  /** Seat the one you face: the room's camera puts the table's far edge here, their feet under it. */
  const seat = (): void => {
    const W = root.clientWidth;
    const H = root.clientHeight;
    if (!W || !H) return;
    const a = W / H;
    const cam = duelCamera("parley", a);
    root.classList.toggle("tb-slate3d", duel.staged === "parley" && !cam.port);
    const edge = project(cam, a, [0, EDGE.y, EDGE.z]).y * H;
    const tent = project(cam, a, [0, 0, -0.98]).y * H;
    const z = -1.4;
    const foot = project(cam, a, [0, FLOOR, z]).y * H;
    const top = project(cam, a, [0, FLOOR + (cam.port ? 1.62 : 1.5), z]).y * H;
    root.style.setProperty("--edge", `${edge.toFixed(1)}px`);
    root.style.setProperty("--tent", `${tent.toFixed(1)}px`);
    root.style.setProperty("--figh", `${(foot - top).toFixed(1)}px`);
    root.style.setProperty("--sink", `${(foot - edge).toFixed(1)}px`);
  };
  seat();
  chalkStakes();
  const ro = new ResizeObserver(seat);
  ro.observe(root);
  return {
    update() {
      chalkStakes();
    },
    destroy() {
      ro.disconnect();
      mo?.disconnect();
      deal?.removeEventListener("click", ring);
      hb.remove();
      hf.remove();
      tx.remove();
      if (duel.slate === slate) duel.slate = null;
      duel.patience = null;
    },
  };
}
