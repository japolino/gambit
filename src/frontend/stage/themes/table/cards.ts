/**
 * The Table battle's card stock: woodcut cards drawn as SVG in the scene's own
 * hand (../../../scene/themes/table/art.ts: the same chipped bone parchment,
 * red-and-ink sunbursts and motifs), rasterised once into Pixi textures.
 *
 * Skill cards reuse the scene's action-card motifs where one fits (crossed
 * blades, the eye, the hourglass, the candle, the scales, the speaking mouth)
 * and add a few the scene never needed (a shield, a star of power, a heart, a
 * skull). Party cards are a parchment frame with an arched window, built in
 * two layers so the breathing bust sits between the sunburst and the ink.
 */
import { Texture } from "pixi.js";
import { actionCard, notched, INK, RED, DRED, BONE } from "../../../scene/themes/table/art.js";
import { paperUrl, slateUrl } from "../../../scene/themes/table/tex.js";

export { INK, RED, DRED, BONE };
export const PAPER_INK = 0x0d0b0e;
export const BLOOD = 0xb81d24;

const f = (x: number): string => x.toFixed(1);

/** Card art is drawn in a 200 x 294 box; textures are rasterised at this scale. */
export const CARD_W = 200;
export const CARD_H = 294;
const RES = 2.2;

const cache = new Map<string, Texture>();
const waiting = new Set<() => void>();
let pending = 0;

/** Called once more art has landed (cards redraw with their real faces). */
export function onCardArt(fn: () => void): () => void {
  waiting.add(fn);
  return () => waiting.delete(fn);
}

let paperImg: Promise<HTMLImageElement> | null = null;
/** The scene's parchment, decoded once, laid over card art by multiplying (cheaper than embedding it in every SVG). */
function paper(): Promise<HTMLImageElement> {
  paperImg ??= new Promise((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(i);
    i.src = paperUrl();
  });
  return paperImg;
}

/** An SVG string as a texture (filled in when the browser has decoded it); `papered` multiplies the parchment over its inked shapes. */
export function svgTexture(key: string, svg: string, w = CARD_W, h = CARD_H, res = RES, papered = false): Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = Math.round(w * res);
  c.height = Math.round(h * res);
  const tex = Texture.from(c);
  cache.set(key, tex);
  const src = svg.replace(/^<svg /, `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${c.width}" height="${c.height}" `);
  const img = new Image();
  pending++;
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(src)}`;
  void Promise.all([img.decode(), papered ? paper() : null])
    .then(([, p]) => {
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0, c.width, c.height);
      if (p && p.naturalWidth) {
        g.globalCompositeOperation = "multiply";
        g.globalAlpha = 0.9;
        g.drawImage(p, 0, 0, c.width, c.height);
        g.globalAlpha = 1;
        g.globalCompositeOperation = "destination-in";
        g.drawImage(img, 0, 0, c.width, c.height);
        g.globalCompositeOperation = "source-over";
      }
      tex.source.update();
      for (const fn of [...waiting]) fn();
    })
    .catch(() => console.warn("[gambit] table card art failed", key))
    .finally(() => pending--);
  return tex;
}

export const artPending = (): boolean => pending > 0;

/** The scene's card SVGs with their embedded parchment removed (svgTexture lays it on instead). */
export function stripPaper(svg: string): string {
  return svg.replace(/ aria-hidden="true"| class="cardart"/g, "").replace(/<image href=""[^>]*\/>/g, "");
}

/* ------------------------------ Skill cards ------------------------------ */

export type SkillMotif = "fight" | "search" | "wait" | "rest" | "talk" | "shop" | "guard" | "power" | "mend" | "bane";

/** Which woodcut a skill gets, from its name and flavour. */
export function motifOf(name: string, flavor = ""): SkillMotif {
  const s = `${name} ${flavor}`.toLowerCase();
  if (/\b(heal|mend|salve|bless|pray|tend|restore|cure|bind|life)/.test(s)) return "mend";
  if (/\b(stance|guard|ward|parry|riposte|shield|block|brace|bulwark|cover|wall|defen)/.test(s)) return "guard";
  if (/\b(curse|hex|poison|venom|rot|doom|bleed|drain|blight|fear)/.test(s)) return "bane";
  if (/\b(tide|wave|storm|flame|fire|frost|bolt|spark|light|call|surge|spell|star|burn|thunder|void)/.test(s)) return "power";
  if (/\b(opening|study|mark|read|scan|spot|aim|focus|eye|insight)/.test(s)) return "search";
  if (/\b(wait|tempo|measure|breath|patience|time|delay|haste|quick)/.test(s)) return "wait";
  if (/\b(taunt|shout|cry|roar|parley|demand|plea|talk)/.test(s)) return "talk";
  if (/\b(rest|recover|calm)/.test(s)) return "rest";
  if (/\b(trade|bribe|coin|pay|price)/.test(s)) return "shop";
  return "fight";
}

function burst(cx: number, cy: number, count: number, R: number, fill: string, width = 0.5): string {
  let d = "";
  for (let i = 0; i < count; i++) {
    const a0 = (i / count) * Math.PI * 2;
    const a1 = a0 + (Math.PI / count) * width * 2;
    d += `M${f(cx)},${f(cy)}L${f(cx + Math.cos(a0) * R)},${f(cy + Math.sin(a0) * R)}L${f(cx + Math.cos(a1) * R)},${f(cy + Math.sin(a1) * R)}Z`;
  }
  return `<path d="${d}" fill="${fill}"/>`;
}

const hatch = (id: string): string =>
  `<pattern id="${id}h" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><rect width="1.7" height="5" fill="${INK}"/></pattern>`;

/** The motifs the scene has no card for; each fills the 172 x 216 panel. */
const EXTRA: Record<"guard" | "power" | "mend" | "bane", (id: string) => string> = {
  guard: (id) => `
  <rect width="172" height="216" fill="${RED}"/>
  ${burst(86, 104, 26, 200, INK, 0.32)}
  <path d="M86,22 L146,44 Q150,128 86,196 Q22,128 26,44Z" fill="${BONE}" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>
  <path d="M86,36 L134,54 Q136,124 86,180 Z" fill="${RED}" stroke="${INK}" stroke-width="3"/>
  <path d="M86,36 L38,54 Q36,124 86,180Z" fill="url(#${id}h)" opacity=".55"/>
  <path d="M86,30 L86,190 M32,92 L140,92" stroke="${INK}" stroke-width="5"/>
  <circle cx="86" cy="92" r="16" fill="${BONE}" stroke="${INK}" stroke-width="4"/>
  <circle cx="86" cy="92" r="6" fill="${RED}" stroke="${INK}" stroke-width="2"/>
  ${[[52, 60], [120, 60], [60, 140], [112, 140]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5" fill="${INK}"/>`).join("")}`,
  power: (id) => `
  <rect width="172" height="216" fill="${INK}"/>
  ${burst(86, 106, 36, 210, RED, 0.42)}
  <circle cx="86" cy="106" r="58" fill="${INK}" stroke="${BONE}" stroke-width="3" stroke-dasharray="4 4"/>
  <path d="${Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2 - Math.PI / 2; const r = i % 2 ? 22 : 54; return `${i ? "L" : "M"}${f(86 + Math.cos(a) * r)},${f(106 + Math.sin(a) * r)}`; }).join("")}Z" fill="${BONE}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  <path d="${Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2 - Math.PI / 2; const r = i % 2 ? 9 : 24; return `${i ? "L" : "M"}${f(86 + Math.cos(a) * r)},${f(106 + Math.sin(a) * r)}`; }).join("")}Z" fill="${RED}" stroke="${INK}" stroke-width="3"/>
  <path d="M30,200 Q60,170 86,186 Q112,170 142,200" fill="none" stroke="${BONE}" stroke-width="4"/>
  <path d="M40,30 l6,12 M132,26 l-6,14 M20,120 l12,-2 M152,126 l-12,-2" stroke="${BONE}" stroke-width="4" stroke-linecap="round"/>
  <rect x="64" y="96" width="10" height="40" fill="url(#${id}h)" opacity=".5"/>`,
  mend: (id) => `
  <rect width="172" height="216" fill="${RED}"/>
  ${burst(86, 96, 24, 200, INK, 0.3)}
  <path d="M86,176 C40,140 18,112 22,80 C26,52 60,40 86,70 C112,40 146,52 150,80 C154,112 132,140 86,176Z" fill="${BONE}" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>
  <path d="M86,160 C52,132 36,110 38,86 C40,72 52,64 64,66" fill="none" stroke="url(#${id}h)" stroke-width="12"/>
  <path d="M78,90 L94,90 L94,104 L108,104 L108,120 L94,120 L94,134 L78,134 L78,120 L64,120 L64,104 L78,104Z" fill="${RED}" stroke="${INK}" stroke-width="3"/>
  <path d="M30,204 Q86,186 142,204" fill="none" stroke="${INK}" stroke-width="6"/>
  ${[[34, 30], [138, 34], [150, 160], [20, 166]].map(([x, y]) => `<path d="M${x},${y! - 7} L${x! + 2},${y! - 2} L${x! + 7},${y} L${x! + 2},${y! + 2} L${x},${y! + 7} L${x! - 2},${y! + 2} L${x! - 7},${y} L${x! - 2},${y! - 2}Z" fill="${BONE}"/>`).join("")}`,
  bane: (id) => `
  <rect width="172" height="216" fill="${INK}"/>
  ${burst(86, 100, 20, 200, RED, 0.36)}
  <path d="M86,30 C126,30 146,58 144,92 C142,116 132,126 128,138 L124,160 L48,160 L44,138 C40,126 30,116 28,92 C26,58 46,30 86,30Z" fill="${BONE}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M50,96 C50,80 62,74 74,80 C80,90 78,104 66,110 C56,112 50,106 50,96Z M122,96 C122,80 110,74 98,80 C92,90 94,104 106,110 C116,112 122,106 122,96Z" fill="${INK}"/>
  <path d="M80,118 L86,108 L92,118 L88,126 L84,126Z" fill="${INK}"/>
  <path d="M56,160 L56,182 M70,160 L70,186 M86,160 L86,188 M102,160 L102,186 M116,160 L116,182" stroke="${INK}" stroke-width="5"/>
  <path d="M50,150 L122,150" stroke="${INK}" stroke-width="4"/>
  <path d="M40,40 Q60,60 50,90" fill="none" stroke="url(#${id}h)" stroke-width="10"/>
  <path d="M30,196 Q86,176 142,196" fill="none" stroke="${RED}" stroke-width="5"/>`,
};

let nid = 0;
function extraCard(motif: keyof typeof EXTRA, seed: number): string {
  const id = `tbd${(++nid).toString(36)}`;
  const out = notched(5, 5, 195, 289, seed, 1.2, 3);
  const panel = notched(14, 76, 186, 282, seed + 7, 0.9, 1);
  return `<svg viewBox="0 0 200 294" preserveAspectRatio="none"><defs>${hatch(id)}
    <clipPath id="${id}o"><path d="${out}"/></clipPath><clipPath id="${id}p"><path d="${panel}"/></clipPath></defs>
    <path d="${out}" fill="${BONE}"/>
    <g clip-path="url(#${id}p)"><g transform="translate(14 72)">${EXTRA[motif](id)}</g></g>
    <path d="${panel}" fill="none" stroke="${INK}" stroke-width="4"/>
    <path d="M16,68 L184,68" stroke="${INK}" stroke-width="2.5" stroke-dasharray="30 3 12 4"/>
    <path d="${out}" fill="none" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
    <path d="${notched(10, 10, 190, 284, seed + 3, 0.7, 0)}" fill="none" stroke="${INK}" stroke-width="1.2" opacity=".55"/>
  </svg>`;
}

/** A skill card's face (title band empty: the name is set in Pixi over it). */
export function skillTexture(motif: SkillMotif, seed: number): Texture {
  const key = `skill:${motif}:${seed}`;
  if (cache.has(key)) return cache.get(key)!;
  const svg = motif in EXTRA ? extraCard(motif as keyof typeof EXTRA, seed) : stripPaper(actionCard(motif, seed, "", null));
  return svgTexture(key, svg, CARD_W, CARD_H, RES, true);
}

/** The back of a card: red, with a gilt lattice and an inked sunburst seal (fallen party members, the house's cards). */
export function backTexture(seed = 3): Texture {
  const id = "tbback";
  const out = notched(5, 5, 195, 289, seed, 1.2, 3);
  const lat = Array.from({ length: 22 }, (_, i) => `M${-100 + i * 18},0 L${100 + i * 18},294 M${300 - i * 18},0 L${100 - i * 18},294`).join(" ");
  return svgTexture(
    `back:${seed}`,
    `<svg viewBox="0 0 200 294" preserveAspectRatio="none"><defs><clipPath id="${id}o"><path d="${out}"/></clipPath></defs>
    <path d="${out}" fill="${DRED}"/>
    <g clip-path="url(#${id}o)"><rect x="12" y="12" width="176" height="270" fill="${RED}"/><path d="${lat}" stroke="#f2cf7a" stroke-width="1.4" opacity=".55"/>
      ${burst(100, 147, 24, 70, INK, 0.4)}<circle cx="100" cy="147" r="34" fill="${BONE}" stroke="${INK}" stroke-width="5"/>
      <path d="M100,123 L106,141 L124,147 L106,153 L100,171 L94,153 L76,147 L94,141Z" fill="${RED}" stroke="${INK}" stroke-width="3"/></g>
    <rect x="12" y="12" width="176" height="270" fill="none" stroke="#f2cf7a" stroke-width="2"/>
    <path d="${out}" fill="none" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/></svg>`,
  );
}

/* ------------------------------ Party cards ------------------------------ */

/** The arched window the bust shows through, in card units (200 x 294). */
export const WINDOW = { x0: 16, x1: 184, top: 16, spring: 74, bottom: 196 };

/** Under the bust: parchment, the red window with its sunburst. */
export function partyBackTexture(seed: number): Texture {
  const key = `pback:${seed}`;
  if (cache.has(key)) return cache.get(key)!;
  const id = `tbp${seed}`;
  const out = notched(5, 5, 195, 289, seed, 1.3, 3);
  const w = WINDOW;
  const arch = `M${w.x0},${w.bottom} L${w.x0},${w.spring} Q${w.x0},${w.top} 100,${w.top} Q${w.x1},${w.top} ${w.x1},${w.spring} L${w.x1},${w.bottom}Z`;
  return svgTexture(
    key,
    `<svg viewBox="0 0 200 294" preserveAspectRatio="none"><defs>${hatch(id)}<clipPath id="${id}o"><path d="${out}"/></clipPath><clipPath id="${id}a"><path d="${arch}"/></clipPath></defs>
    <path d="${out}" fill="${BONE}"/>
    <g clip-path="url(#${id}a)"><rect width="200" height="294" fill="${RED}"/>${burst(100, 120, 30, 220, INK, 0.36)}
      <circle cx="100" cy="112" r="62" fill="${DRED}" stroke="${INK}" stroke-width="4"/>
      <path d="M0,170 C40,160 60,180 100,170 C140,160 160,180 200,170 L200,220 L0,220Z" fill="${INK}" opacity=".6"/></g>
  </svg>`,
    CARD_W,
    CARD_H,
    RES,
    true,
  );
}

/** Over the bust: the window's heavy ink frame, the name band's rules and the chipped outline. */
export function partyFrontTexture(seed: number): Texture {
  const key = `pfront:${seed}`;
  if (cache.has(key)) return cache.get(key)!;
  const out = notched(5, 5, 195, 289, seed, 1.3, 3);
  const w = WINDOW;
  const arch = `M${w.x0},${w.bottom} L${w.x0},${w.spring} Q${w.x0},${w.top} 100,${w.top} Q${w.x1},${w.top} ${w.x1},${w.spring} L${w.x1},${w.bottom}Z`;
  const inner = `M${w.x0 + 7},${w.bottom} L${w.x0 + 7},${w.spring + 2} Q${w.x0 + 7},${w.top + 7} 100,${w.top + 7} Q${w.x1 - 7},${w.top + 7} ${w.x1 - 7},${w.spring + 2} L${w.x1 - 7},${w.bottom}`;
  return svgTexture(
    key,
    `<svg viewBox="0 0 200 294" preserveAspectRatio="none">
    <path d="${arch}" fill="none" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>
    <path d="${inner}" fill="none" stroke="${BONE}" stroke-width="1.6" stroke-dasharray="2 4" opacity=".8"/>
    <path d="M14,${w.bottom + 4} L186,${w.bottom + 4}" stroke="${INK}" stroke-width="4"/>
    <path d="M18,${w.bottom + 34} L182,${w.bottom + 34}" stroke="${INK}" stroke-width="1.6" stroke-dasharray="26 3 10 4" opacity=".8"/>
    <path d="M96,${w.top - 9} l4,-5 l4,5 l-4,5Z" fill="${RED}" stroke="${INK}" stroke-width="1.5"/>
    <path d="${out}" fill="none" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
    <path d="${notched(10, 10, 190, 284, seed + 3, 0.7, 0)}" fill="none" stroke="${INK}" stroke-width="1.2" opacity=".5"/>
  </svg>`,
  );
}

/* ------------------------------ The hand ------------------------------ */

const SK = { lit: "#f0c99a", mid: "#c8906a", shade: "#7a4a3e", deep: "#3a2430", ink: "#1a0c08" };

/** Your own hand, holding the card you are looking at: fingers behind it, the thumb and cuff in front. Warm on the candle side. */
export function handTextures(): { back: Texture; front: Texture } {
  const defs = (id: string) => `<linearGradient id="${id}k" x1="0" y1="0" x2="1" y2=".4"><stop offset="0" stop-color="${SK.lit}"/><stop offset=".55" stop-color="${SK.mid}"/><stop offset="1" stop-color="${SK.shade}"/></linearGradient>`;
  const finger = (x0: number, y0: number, x1: number, y1: number, w: number) => {
    const a = Math.atan2(y1 - y0, x1 - x0);
    const nx = -Math.sin(a) * (w / 2);
    const ny = Math.cos(a) * (w / 2);
    return `<path d="M${f(x0 + nx)},${f(y0 + ny)} L${f(x1 + nx * 0.86)},${f(y1 + ny * 0.86)} A${f(w * 0.43)},${f(w * 0.43)} 0 0 0 ${f(x1 - nx * 0.86)},${f(y1 - ny * 0.86)} L${f(x0 - nx)},${f(y0 - ny)}Z" fill="url(#hk)" stroke="${SK.ink}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M${f(x0 + (x1 - x0) * 0.55 - nx * 0.6)},${f(y0 + (y1 - y0) * 0.55 - ny * 0.6)} q${f(nx * 0.6)},${f(ny * 0.6 + 4)} ${f(nx * 1.2)},${f(ny * 1.2)}" stroke="${SK.ink}" stroke-width="2" fill="none" opacity=".6"/>`;
  };
  const palm = "M150,400 C140,360 134,330 136,300 C138,280 146,262 160,252 C190,240 230,240 262,262 C276,290 286,330 292,400Z";
  const back = `<svg viewBox="0 0 400 400"><defs>${defs("h")}</defs>
    <path d="${palm}" fill="#000" opacity=".4" transform="translate(-8 10)"/>
    ${finger(262, 280, 288, 150, 34)}${finger(232, 262, 248, 110, 38)}${finger(200, 258, 204, 104, 40)}${finger(168, 268, 156, 128, 38)}
    <path d="${palm}" fill="url(#hk)" stroke="${SK.ink}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M232,266 C260,300 276,350 282,400 L300,400 L300,250Z" fill="${SK.shade}" opacity=".7"/>
    <path d="M158,300 C190,288 226,290 258,306" stroke="${SK.ink}" stroke-width="2.4" fill="none" opacity=".6"/></svg>`;
  const thumb = "M150,400 C142,380 128,362 118,340 C108,318 92,302 76,290 C62,280 58,266 68,258 C80,250 98,256 112,268 C132,284 152,300 168,318 C182,336 190,366 192,400Z";
  const front = `<svg viewBox="0 0 400 400"><defs>${defs("h")}
    <linearGradient id="cf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a1418"/><stop offset=".6" stop-color="#22080c"/><stop offset="1" stop-color="#0a0305"/></linearGradient></defs>
    <path d="${thumb}" fill="#000" opacity=".3" transform="translate(-6 8)"/>
    <path d="${thumb}" fill="url(#hk)" stroke="${SK.ink}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M168,318 C182,336 190,366 192,400 L210,400 L200,300Z" fill="${SK.shade}" opacity=".8"/>
    <g transform="rotate(38 82 266)"><rect x="70" y="258" width="26" height="17" rx="7" fill="#f6e2c8" stroke="${SK.ink}" stroke-width="2.6"/></g>
    <path d="M70,268 C70,256 82,250 94,256" stroke="#fff3dc" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".7"/>
    <path d="M104,312 C118,326 130,348 132,372" stroke="${SK.ink}" stroke-width="2.2" fill="none" opacity=".6"/>
    <path d="M130,388 C170,366 240,350 400,334 L420,334 L420,420 L120,420Z" fill="#d9c49a" stroke="${SK.ink}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M140,380 C180,360 250,346 400,328" stroke="#fffaf0" stroke-width="2.4" fill="none" opacity=".7"/>
    <path d="M190,412 C230,388 290,374 420,362 L420,440 L190,440Z" fill="url(#cf)" stroke="${SK.ink}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M200,406 C240,386 296,374 420,366" stroke="#e8c070" stroke-width="2.2" stroke-dasharray="7 5" fill="none"/>
    <circle cx="262" cy="384" r="5" fill="#e8c070" stroke="${SK.ink}" stroke-width="2"/></svg>`;
  return { back: svgTexture("hand:back", back, 400, 400, 1.6), front: svgTexture("hand:front", front, 400, 400, 1.6) };
}

/* ------------------------------ Slate ------------------------------ */

let slateImg: HTMLImageElement | null = null;
/** The scene's slate texture as an image (decoded once). */
export function slateImage(then: () => void): HTMLImageElement {
  if (!slateImg) {
    slateImg = new Image();
    slateImg.src = slateUrl();
  }
  if (!slateImg.complete) slateImg.addEventListener("load", then, { once: true });
  return slateImg;
}
