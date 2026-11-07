/**
 * Inline SVG art for the Table theme: inked woodcut cards and their
 * illustrations, the skull candle, coin stacks, the ledger, the class deck
 * in its brass case, the gavel and bell, the hanging slate scoreboard with
 * its glass vigor tube, the stone narration plaque, the portrait shadowbox
 * and the player's own hand. Everything is drawn here; nothing is loaded.
 *
 * Every function returns markup. Ids inside an SVG are made unique with
 * uid() so many copies can live in one shadow root.
 */
import { esc, rng } from "../contract.js";

export const INK = "#0d0b0e";
export const RED = "#b81d24";
export const DRED = "#5e0b10";
export const BONE = "#e8dfcf";

let n = 0;
/** A fresh id prefix for one SVG's defs. */
export const uid = (p: string): string => `tb${p}${(++n).toString(36)}`;

const f = (x: number): string => x.toFixed(1);

/** A rough closed outline around a rectangle: jittered edge points and a few chipped notches. */
export function notched(x0: number, y0: number, x1: number, y1: number, seed: number, jit = 1.3, chips = 3): string {
  const r = rng(seed);
  const pts: [number, number][] = [];
  const edge = (ax: number, ay: number, bx: number, by: number, nx: number, ny: number): void => {
    const len = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(2, Math.round(len / 13));
    const chipAt = r() < chips / 4 ? 1 + Math.floor(r() * (steps - 2)) : -1;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      if (i === chipAt) {
        const d = 3 + r() * 4;
        const w = 4 + r() * 4;
        const ux = (bx - ax) / len;
        const uy = (by - ay) / len;
        pts.push([x - ux * w, y - uy * w], [x + nx * d, y + ny * d], [x + ux * w, y + uy * w]);
      } else pts.push([x + (r() - 0.5) * jit * 2 * Math.abs(ny) , y + (r() - 0.5) * jit * 2 * Math.abs(nx)]);
    }
  };
  edge(x0, y0, x1, y0, 0, 1);
  edge(x1, y0, x1, y1, -1, 0);
  edge(x1, y1, x0, y1, 0, -1);
  edge(x0, y1, x0, y0, 1, 0);
  return `M${pts.map(([x, y]) => `${f(x)},${f(y)}`).join("L")}Z`;
}

/** Radiating wedges, the woodcut sunburst. */
function burst(cx: number, cy: number, count: number, R: number, fill: string, width = 0.5): string {
  let d = "";
  for (let i = 0; i < count; i++) {
    const a0 = (i / count) * Math.PI * 2;
    const a1 = a0 + (Math.PI / count) * width * 2;
    d += `M${f(cx)},${f(cy)}L${f(cx + Math.cos(a0) * R)},${f(cy + Math.sin(a0) * R)}L${f(cx + Math.cos(a1) * R)},${f(cy + Math.sin(a1) * R)}Z`;
  }
  return `<path d="${d}" fill="${fill}"/>`;
}

/** Shared defs for an illustrated card: hatching and a posterise filter that turns any picture into red/black/bone. */
function cardDefs(id: string): string {
  return `<pattern id="${id}h" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><rect width="1.7" height="5" fill="${INK}"/></pattern>
  <pattern id="${id}x" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><rect width="1.4" height="6" fill="${INK}"/><rect width="6" height="1.2" fill="${INK}"/></pattern>
  <filter id="${id}d" color-interpolation-filters="sRGB">
    <feColorMatrix type="saturate" values="0"/>
    <feComponentTransfer><feFuncR type="linear" slope="1.7" intercept="-0.28"/><feFuncG type="linear" slope="1.7" intercept="-0.28"/><feFuncB type="linear" slope="1.7" intercept="-0.28"/></feComponentTransfer>
    <feComponentTransfer><feFuncR type="discrete" tableValues="0.05 0.72 0.91"/><feFuncG type="discrete" tableValues="0.04 0.11 0.87"/><feFuncB type="discrete" tableValues="0.06 0.14 0.8"/></feComponentTransfer>
  </filter>`;
}

/* ------------------------------ Card motifs ------------------------------ */
// Each motif draws into the illustration panel: 172 x 216 units.

type Motif = (id: string, o: { art?: string | null; seed: number }) => string;

const eye: Motif = (id) => `
  <rect width="172" height="216" fill="${RED}"/>
  ${burst(86, 104, 28, 190, INK, 0.38)}
  <circle cx="86" cy="104" r="76" fill="none" stroke="${INK}" stroke-width="5"/>
  <circle cx="86" cy="104" r="68" fill="none" stroke="${BONE}" stroke-width="2" stroke-dasharray="3 5"/>
  <path d="M6,104 Q86,22 166,104 Q86,186 6,104Z" fill="${BONE}" stroke="${INK}" stroke-width="6"/>
  <path d="M14,110 Q86,176 158,110 Q86,160 14,110Z" fill="url(#${id}h)" opacity=".7"/>
  <path d="M30,96 q14,6 22,2 M40,122 q12,-2 20,6 M128,90 q-10,8 -22,6 M136,118 q-12,-6 -24,2" stroke="${RED}" stroke-width="2" fill="none"/>
  <circle cx="86" cy="104" r="36" fill="${RED}" stroke="${INK}" stroke-width="4"/>
  <g stroke="${INK}" stroke-width="1.6">${Array.from({ length: 20 }, (_, i) => { const a = (i / 20) * Math.PI * 2; return `<line x1="${f(86 + Math.cos(a) * 15)}" y1="${f(104 + Math.sin(a) * 15)}" x2="${f(86 + Math.cos(a) * 33)}" y2="${f(104 + Math.sin(a) * 33)}"/>`; }).join("")}</g>
  <circle cx="86" cy="104" r="15" fill="${INK}"/>
  <circle cx="78" cy="96" r="5" fill="${BONE}"/>
  <g stroke="${INK}" stroke-width="4" stroke-linecap="round">${Array.from({ length: 9 }, (_, i) => { const t = (i + 1) / 10; const x = 6 + 160 * t; const y = 104 - 82 * 2 * t * (1 - t) * 1.0; const a = Math.atan2(-(1 - 2 * t) * 164, 160); const nx = Math.sin(a); return `<line x1="${f(x)}" y1="${f(y)}" x2="${f(x + (x - 86) * 0.12)}" y2="${f(y - 14 - nx * 2)}"/>`; }).join("")}</g>`;

const talk: Motif = (id, o) => {
  if (o.art)
    return `
  <rect width="172" height="216" fill="${RED}"/>
  ${burst(86, 92, 22, 200, INK, 0.3)}
  <clipPath id="${id}w"><path d="M18,216 L18,86 Q18,14 86,14 Q154,14 154,86 L154,216Z"/></clipPath>
  <path d="M18,216 L18,86 Q18,14 86,14 Q154,14 154,86 L154,216Z" fill="${DRED}"/>
  <image href="${esc(o.art)}" x="-4" y="16" width="180" height="250" preserveAspectRatio="xMidYMin slice" filter="url(#${id}d)" clip-path="url(#${id}w)"/>
  <path d="M18,216 L18,86 Q18,14 86,14 Q154,14 154,86 L154,216" fill="none" stroke="${INK}" stroke-width="7"/>
  <path d="M26,216 L26,88 Q26,22 86,22 Q146,22 146,88 L146,216" fill="none" stroke="${BONE}" stroke-width="1.6" stroke-dasharray="2 4"/>
  <path d="M0,176 C30,166 50,186 86,176 C120,166 140,186 172,176 L172,216 L0,216Z" fill="${INK}"/>
  <path d="M10,192 q12,-8 24,0 q12,8 24,0 M114,192 q12,-8 24,0 q12,8 24,0" stroke="${RED}" stroke-width="3" fill="none"/>`;
  // Nobody's likeness: a speaking mouth with its words curling out.
  return `
  <rect width="172" height="216" fill="${RED}"/>
  ${burst(86, 108, 24, 190, INK, 0.34)}
  <path d="M20,112 Q50,70 86,92 Q122,70 152,112 Q120,160 86,150 Q52,160 20,112Z" fill="${BONE}" stroke="${INK}" stroke-width="6"/>
  <path d="M30,112 Q86,96 142,112 Q86,138 30,112Z" fill="${INK}"/>
  <path d="M44,110 l8,9 l8,-9 l8,9 l8,-9 l8,9 l8,-9 l8,9 l8,-9 l8,9" fill="none" stroke="${BONE}" stroke-width="3"/>
  <path d="M30,150 Q86,176 142,150" fill="none" stroke="url(#${id}h)" stroke-width="10"/>
  <path d="M120,60 c20,-20 46,-6 36,12 c-8,14 -26,4 -18,-6 M24,52 c-14,-16 6,-34 22,-24 c12,8 2,24 -8,16" fill="none" stroke="${BONE}" stroke-width="5" stroke-linecap="round"/>`;
};

const rest: Motif = (id) => `
  <rect width="172" height="216" fill="${INK}"/>
  <circle cx="122" cy="52" r="34" fill="${BONE}"/>
  <circle cx="138" cy="42" r="30" fill="${INK}"/>
  ${[[30, 30], [60, 18], [20, 80], [150, 104], [90, 40]].map(([x, y]) => `<path d="M${x},${y! - 6} L${x! + 2},${y! - 2} L${x! + 6},${y} L${x! + 2},${y! + 2} L${x},${y! + 6} L${x! - 2},${y! + 2} L${x! - 6},${y} L${x! - 2},${y! - 2}Z" fill="${BONE}"/>`).join("")}
  <path d="M74,128 c-14,-18 10,-30 0,-48 c-8,-14 16,-22 8,-40 M82,128 c12,-14 -6,-26 6,-40 c10,-12 -4,-22 6,-32" fill="none" stroke="${BONE}" stroke-width="5" stroke-linecap="round" opacity=".9"/>
  <path d="M26,196 Q86,170 146,196 L146,204 Q86,220 26,204Z" fill="${RED}" stroke="${BONE}" stroke-width="3"/>
  <path d="M60,190 L60,140 Q60,128 72,130 L100,128 Q112,128 112,140 L112,190Z" fill="${BONE}" stroke="${INK}" stroke-width="4"/>
  <path d="M60,140 q6,14 0,30 M112,138 q-5,18 0,28 M84,130 q4,20 -2,34" stroke="${INK}" stroke-width="3" fill="none"/>
  <rect x="62" y="150" width="20" height="40" fill="url(#${id}h)" opacity=".6"/>
  <path d="M86,130 q-2,-8 4,-12" stroke="${INK}" stroke-width="3" fill="none"/>
  <path d="M120,192 q22,-4 22,-20 q0,-10 -10,-10 q-8,0 -8,8" fill="none" stroke="${BONE}" stroke-width="4"/>`;

const wait: Motif = (id) => `
  <rect width="172" height="216" fill="${RED}"/>
  ${burst(86, 108, 30, 200, INK, 0.26)}
  <rect x="30" y="16" width="112" height="14" fill="${INK}"/><rect x="30" y="186" width="112" height="14" fill="${INK}"/>
  <rect x="36" y="30" width="8" height="156" fill="${INK}"/><rect x="128" y="30" width="8" height="156" fill="${INK}"/>
  <path d="M50,30 L122,30 Q122,84 92,104 L92,112 Q122,132 122,186 L50,186 Q50,132 80,112 L80,104 Q50,84 50,30Z" fill="${BONE}" stroke="${INK}" stroke-width="5"/>
  <path d="M58,52 L114,52 Q110,80 86,96 Q62,80 58,52Z" fill="${RED}" stroke="${INK}" stroke-width="2"/>
  <path d="M86,104 L86,170" stroke="${RED}" stroke-width="3" stroke-dasharray="4 3"/>
  <path d="M54,184 Q60,152 86,148 Q112,152 118,184Z" fill="${RED}" stroke="${INK}" stroke-width="2"/>
  <path d="M96,40 l-8,18 l10,10 l-6,14" stroke="${INK}" stroke-width="2" fill="none"/>
  <path d="M100,40 Q112,60 108,84" stroke="url(#${id}h)" stroke-width="7" fill="none"/>`;

const fight: Motif = (id) => `
  <rect width="172" height="216" fill="${INK}"/>
  ${burst(86, 108, 16, 200, RED, 0.5)}
  <circle cx="86" cy="108" r="60" fill="${INK}"/>
  <g transform="rotate(-38 86 108)">
    <path d="M80,24 L86,8 L92,24 L94,134 L78,134Z" fill="${BONE}" stroke="${INK}" stroke-width="4"/>
    <path d="M86,14 L86,132" stroke="${INK}" stroke-width="2"/><path d="M88,30 L92,130" stroke="url(#${id}h)" stroke-width="4"/>
    <path d="M58,134 Q86,124 114,134 L114,144 Q86,138 58,144Z" fill="${BONE}" stroke="${INK}" stroke-width="4"/>
    <rect x="80" y="144" width="12" height="40" fill="${RED}" stroke="${INK}" stroke-width="3"/>
    <path d="M80,152 l12,6 M80,162 l12,6 M80,172 l12,6" stroke="${INK}" stroke-width="2"/>
    <circle cx="86" cy="190" r="8" fill="${BONE}" stroke="${INK}" stroke-width="3"/>
  </g>
  <g transform="rotate(38 86 108)">
    <path d="M80,24 L86,8 L92,24 L94,134 L78,134Z" fill="${BONE}" stroke="${INK}" stroke-width="4"/>
    <path d="M86,14 L86,132" stroke="${INK}" stroke-width="2"/>
    <path d="M58,134 Q86,124 114,134 L114,144 Q86,138 58,144Z" fill="${BONE}" stroke="${INK}" stroke-width="4"/>
    <rect x="80" y="144" width="12" height="40" fill="${RED}" stroke="${INK}" stroke-width="3"/>
    <path d="M80,152 l12,6 M80,162 l12,6 M80,172 l12,6" stroke="${INK}" stroke-width="2"/>
    <circle cx="86" cy="190" r="8" fill="${BONE}" stroke="${INK}" stroke-width="3"/>
  </g>
  ${[[40, 170, 7], [128, 176, 9], [70, 200, 5], [112, 30, 6]].map(([x, y, s]) => `<path d="M${x},${y! - s! * 2} Q${x! + s!},${y} ${x},${y! + s!} Q${x! - s!},${y} ${x},${y! - s! * 2}Z" fill="${RED}" stroke="${BONE}" stroke-width="1.5"/>`).join("")}`;

const shop: Motif = (id) => `
  <rect width="172" height="216" fill="${RED}"/>
  ${burst(86, 60, 26, 200, INK, 0.3)}
  <rect x="82" y="34" width="8" height="150" fill="${INK}"/>
  <path d="M50,190 Q86,170 122,190 L122,200 L50,200Z" fill="${INK}"/>
  <path d="M20,52 L152,52" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
  <circle cx="86" cy="40" r="11" fill="${BONE}" stroke="${INK}" stroke-width="4"/>
  <path d="M26,56 L8,118 M26,56 L44,118 M146,56 L128,110 M146,56 L164,110" stroke="${INK}" stroke-width="2.5"/>
  <path d="M2,118 Q26,140 50,118Z" fill="${BONE}" stroke="${INK}" stroke-width="4"/>
  <path d="M122,110 Q146,132 170,110Z" fill="${BONE}" stroke="${INK}" stroke-width="4"/>
  ${[0, 1, 2].map((i) => `<ellipse cx="146" cy="${104 - i * 6}" rx="12" ry="4" fill="${BONE}" stroke="${INK}" stroke-width="2.5"/>`).join("")}
  <path d="M6,124 Q26,136 46,124" stroke="url(#${id}h)" stroke-width="6" fill="none"/>`;

/** A doorway. With the destination's painting, the arch opens onto it, posterised. */
const exit: Motif = (id, o) => `
  <rect width="172" height="216" fill="${INK}"/>
  ${Array.from({ length: 9 }, (_, row) => Array.from({ length: 5 }, (_, c) => `<rect x="${(row % 2 ? -18 : 0) + c * 38 + 2}" y="${row * 24 + 2}" width="34" height="20" fill="none" stroke="${BONE}" stroke-width="1.6" opacity=".55"/>`).join("")).join("")}
  <clipPath id="${id}a"><path d="M36,216 L36,96 Q36,30 86,30 Q136,30 136,96 L136,216Z"/></clipPath>
  <g clip-path="url(#${id}a)">
    ${o.art
      ? `<rect width="172" height="216" fill="${RED}"/><image href="${esc(o.art)}" x="0" y="20" width="172" height="196" preserveAspectRatio="xMidYMid slice" filter="url(#${id}d)"/>`
      : `<rect width="172" height="216" fill="${RED}"/>${burst(86, 120, 20, 150, INK, 0.35)}<circle cx="86" cy="120" r="22" fill="${BONE}" stroke="${INK}" stroke-width="4"/><path d="M36,150 L136,150 L136,216 L36,216Z" fill="${INK}"/><path d="M78,216 L84,150 L88,150 L94,216Z" fill="${BONE}"/>`}
  </g>
  <path d="M36,216 L36,96 Q36,30 86,30 Q136,30 136,96 L136,216" fill="none" stroke="${INK}" stroke-width="10"/>
  <path d="M28,216 L28,96 Q28,20 86,20 Q144,20 144,96 L144,216" fill="none" stroke="${BONE}" stroke-width="3"/>
  <path d="M76,16 L96,16 L92,36 L80,36Z" fill="${BONE}" stroke="${INK}" stroke-width="3"/>`;

const delveIn: Motif = (id) => `
  <rect width="172" height="216" fill="${INK}"/>
  <path d="M20,216 L20,90 Q20,24 86,24 Q152,24 152,90 L152,216Z" fill="${RED}"/>
  ${Array.from({ length: 7 }, (_, i) => { const y = 120 + i * 14; const w = 30 + i * 16; return `<path d="M${86 - w / 2},${y} L${86 + w / 2},${y} L${86 + w / 2 + 6},${y + 12} L${86 - w / 2 - 6},${y + 12}Z" fill="${i % 2 ? BONE : INK}" stroke="${INK}" stroke-width="2"/>`; }).join("")}
  <path d="M50,120 L50,90 Q50,56 86,56 Q122,56 122,90 L122,120Z" fill="${INK}"/>
  <path d="M70,52 Q70,20 86,20 Q102,20 102,52 L98,60 L74,60Z" fill="${BONE}" stroke="${INK}" stroke-width="3"/>
  <circle cx="80" cy="40" r="5" fill="${INK}"/><circle cx="92" cy="40" r="5" fill="${INK}"/>
  <path d="M78,54 L78,60 M84,54 L84,60 M90,54 L90,60" stroke="${INK}" stroke-width="2"/>
  <path d="M20,216 L20,90 Q20,24 86,24 Q152,24 152,90 L152,216" fill="none" stroke="${BONE}" stroke-width="4"/>
  <rect x="20" y="130" width="22" height="86" fill="url(#${id}h)"/>`;

/** Delve moves: a bold arrow over receding flagstones. */
const arrow = (rot: number, turn: boolean): Motif => (id) => `
  <rect width="172" height="216" fill="${INK}"/>
  ${Array.from({ length: 6 }, (_, i) => { const y = 120 + i * i * 3.2 + i * 8; return `<path d="M0,${f(y)} L172,${f(y)}" stroke="${RED}" stroke-width="${1 + i * 0.6}"/>`; }).join("")}
  ${[-1, -0.5, 0, 0.5, 1].map((k) => `<path d="M${86 + k * 18},120 L${86 + k * 160},216" stroke="${RED}" stroke-width="2"/>`).join("")}
  <path d="M0,120 L172,120" stroke="${BONE}" stroke-width="2"/>
  <g transform="rotate(${rot} 86 100)">
  ${turn
    ? `<path d="M58,170 L58,96 Q58,50 104,50 L118,50 L118,26 L160,66 L118,106 L118,82 L104,82 Q90,82 90,98 L90,170Z" fill="${BONE}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M64,166 L64,100" stroke="url(#${id}h)" stroke-width="8"/>`
    : `<path d="M86,18 L140,80 L106,80 L106,184 L66,184 L66,80 L32,80Z" fill="${BONE}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M74,92 L74,178" stroke="url(#${id}h)" stroke-width="10"/>`}
  </g>`;

const lantern: Motif = (id) => `
  <rect width="172" height="216" fill="${INK}"/>
  ${burst(86, 116, 24, 200, RED, 0.4)}
  <circle cx="86" cy="116" r="50" fill="${RED}" opacity=".8"/>
  <path d="M74,40 Q86,20 98,40" fill="none" stroke="${BONE}" stroke-width="5"/>
  <path d="M60,48 L112,48 L104,64 L68,64Z" fill="${BONE}" stroke="${INK}" stroke-width="4"/>
  <path d="M64,64 L108,64 L114,162 L58,162Z" fill="${BONE}" stroke="${INK}" stroke-width="5"/>
  <path d="M70,72 L102,72 L106,154 L66,154Z" fill="#ffcf6a" stroke="${INK}" stroke-width="3"/>
  <path d="M86,140 Q72,120 86,92 Q100,120 86,140Z" fill="${RED}" stroke="${INK}" stroke-width="3"/>
  <path d="M86,72 L86,154 M70,112 L104,112" stroke="${INK}" stroke-width="3"/>
  <path d="M52,162 L120,162 L116,178 L56,178Z" fill="${BONE}" stroke="${INK}" stroke-width="4"/>
  <rect x="56" y="70" width="10" height="90" fill="url(#${id}h)"/>`;

const door: Motif = (id) => `
  <rect width="172" height="216" fill="${RED}"/>
  ${burst(120, 120, 20, 200, INK, 0.3)}
  <path d="M40,216 L40,40 L132,40 L132,216Z" fill="#ffd27a" stroke="${INK}" stroke-width="6"/>
  <path d="M40,40 L96,58 L96,216 L40,216Z" fill="${INK}"/>
  <path d="M46,60 L90,72 M46,110 L90,118 M46,160 L90,166" stroke="${BONE}" stroke-width="2" opacity=".6"/>
  <circle cx="86" cy="134" r="5" fill="${BONE}"/>
  <path d="M132,216 L172,190 L172,216Z" fill="url(#${id}h)"/>`;

/** A crossroads signpost: the card that holds your roads out of here. */
const roads: Motif = (id) => `
  <rect width="172" height="216" fill="${RED}"/>
  ${burst(86, 150, 26, 220, INK, 0.3)}
  <circle cx="86" cy="150" r="26" fill="${BONE}" stroke="${INK}" stroke-width="4"/>
  <path d="M0,150 L172,150 L172,216 L0,216Z" fill="${INK}"/>
  <path d="M70,216 L82,150 L90,150 L102,216Z M0,190 Q40,170 82,152 L84,156 Q44,178 0,204Z M172,184 Q130,168 90,152 L88,156 Q128,174 172,198Z" fill="${BONE}"/>
  <rect x="80" y="26" width="12" height="190" fill="${INK}"/>
  <rect x="80" y="26" width="4" height="190" fill="url(#${id}h)"/>
  <path d="M92,40 L150,36 L166,50 L150,64 L92,62Z" fill="${BONE}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M80,74 L22,72 L6,86 L22,100 L80,98Z" fill="${BONE}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M92,108 L146,114 L160,128 L144,140 L92,134Z" fill="${BONE}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M104,50 l34,-2 M30,86 l40,0 M104,122 l30,4" stroke="${INK}" stroke-width="3" stroke-dasharray="6 3"/>
  <path d="M78,26 Q86,8 94,26Z" fill="${INK}"/>
  <path d="M86,14 c-6,-10 4,-14 8,-8 l10,-2 l-8,6 c2,6 -4,8 -10,4Z" fill="${INK}"/>`;

const MOTIFS: Record<string, Motif> = {
  roads,
  talk,
  search: eye,
  rest,
  wait,
  fight,
  shop,
  exit,
  delve: delveIn,
  "move:forward": arrow(0, false),
  "move:back": arrow(180, false),
  "move:left": (id, o) => `<g transform="translate(172 0) scale(-1 1)">${arrow(0, true)(id, o)}</g>`,
  "move:right": arrow(0, true),
  "move:search": lantern,
  leave: door,
};

/** Which motif a menu item gets. */
export function motifFor(key: string, kind: string): string {
  if (MOTIFS[key]) return key;
  if (key === "leave") return "leave";
  return MOTIFS[kind] ? kind : "search";
}

/**
 * One inked action card (200 x 294): bone parchment with a chipped, heavily
 * inked edge, and a full-bleed woodcut panel under the title.
 */
export function actionCard(motif: string, seed: number, paper: string, art: string | null): string {
  const id = uid("c");
  const out = notched(5, 5, 195, 289, seed, 1.2, 3);
  const panel = notched(14, 76, 186, 282, seed + 7, 0.9, 1);
  const draw = MOTIFS[motif] ?? eye;
  return `<svg viewBox="0 0 200 294" preserveAspectRatio="none" aria-hidden="true" class="cardart"><defs>${cardDefs(id)}
    <clipPath id="${id}o"><path d="${out}"/></clipPath><clipPath id="${id}p"><path d="${panel}"/></clipPath></defs>
    <path d="${out}" fill="${BONE}"/>
    <image href="${paper}" width="200" height="294" preserveAspectRatio="none" clip-path="url(#${id}o)"/>
    <g clip-path="url(#${id}p)"><g transform="translate(14 72)">${draw(id, { art, seed })}</g>
      <image href="${paper}" width="200" height="294" preserveAspectRatio="none" style="mix-blend-mode:multiply" opacity=".45"/></g>
    <path d="${panel}" fill="none" stroke="${INK}" stroke-width="4"/>
    <path d="M16,68 L184,68" stroke="${INK}" stroke-width="2.5" stroke-dasharray="30 3 12 4"/>
    <path d="${out}" fill="none" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
    <path d="${notched(10, 10, 190, 284, seed + 3, 0.7, 0)}" fill="none" stroke="${INK}" stroke-width="1.2" opacity=".55"/>
  </svg>`;
}

/** A fact card: a ruled parchment slip under a red wax seal; the text itself is HTML on top. */
export function factCard(seed: number, paper: string): string {
  const id = uid("f");
  const out = notched(5, 5, 195, 289, seed, 1.6, 4);
  const r = rng(seed);
  return `<svg viewBox="0 0 200 294" preserveAspectRatio="none" aria-hidden="true" class="cardart"><defs>
    <clipPath id="${id}o"><path d="${out}"/></clipPath>
    <radialGradient id="${id}w" cx=".4" cy=".35"><stop offset="0" stop-color="#e0464a"/><stop offset=".6" stop-color="#9c1419"/><stop offset="1" stop-color="#4a0508"/></radialGradient></defs>
    <path d="${out}" fill="#e2d6bd"/>
    <image href="${paper}" width="200" height="294" preserveAspectRatio="none" clip-path="url(#${id}o)"/>
    <g stroke="#5a4a3a" stroke-width=".8" opacity=".45">${Array.from({ length: 11 }, (_, i) => `<line x1="18" x2="182" y1="${86 + i * 17}" y2="${86 + i * 17 + (r() - 0.5) * 2}"/>`).join("")}</g>
    <path d="M30,20 L30,280" stroke="#9c1419" stroke-width="1" opacity=".5"/>
    <path d="M154,22 l10,-8 l14,30 l-6,40 l-12,-24Z" fill="#9c1419" stroke="${INK}" stroke-width="2"/>
    <path d="M${f(150 + r() * 4)},34 c-14,-2 -24,10 -22,22 c2,14 18,20 30,12 c12,-8 12,-28 -8,-34Z" fill="url(#${id}w)" stroke="#3a0406" stroke-width="2"/>
    <path d="M149,44 l4,10 l-8,-6 l10,0 l-8,6Z" fill="none" stroke="#f0b0a0" stroke-width="1.2" opacity=".8"/>
    <path d="M150,258 C130,250 116,236 104,214 L108,212 C120,232 134,246 152,254Z M150,258 l-6,10" fill="${INK}" opacity=".75"/>
    <path d="${out}" fill="none" stroke="#2a1c12" stroke-width="4" stroke-linejoin="round"/>
  </svg>`;
}

/* ------------------------------- Table props ----------------------------- */

/** A bleached skull crowned with two candles; the flames (g.fl) flicker in CSS. */
export function skullCandle(): string {
  const id = uid("s");
  const flame = (x: number, y: number, s: number, cls: string) => `<g class="fl ${cls}" style="transform-origin:${x}px ${y}px">
      <path d="M${x},${y - 46 * s} C${x + 16 * s},${y - 20 * s} ${x + 12 * s},${y} ${x},${y} C${x - 12 * s},${y} ${x - 16 * s},${y - 20 * s} ${x},${y - 46 * s}Z" fill="url(#${id}fo)"/>
      <path d="M${x},${y - 30 * s} C${x + 8 * s},${y - 14 * s} ${x + 6 * s},${y - 2 * s} ${x},${y - 2 * s} C${x - 6 * s},${y - 2 * s} ${x - 8 * s},${y - 14 * s} ${x},${y - 30 * s}Z" fill="#fff6d0"/>
      <ellipse cx="${x}" cy="${y - 3 * s}" rx="${3 * s}" ry="${4 * s}" fill="#5a7cff" opacity=".7"/></g>`;
  return `<svg viewBox="0 0 200 290" aria-hidden="true"><defs>
    <radialGradient id="${id}b" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#f4ead6"/><stop offset=".55" stop-color="#c8b48e"/><stop offset="1" stop-color="#5c4a32"/></radialGradient>
    <linearGradient id="${id}w" x1="0" x2="1"><stop offset="0" stop-color="#fff6e2"/><stop offset=".6" stop-color="#e8d8b8"/><stop offset="1" stop-color="#9c8660"/></linearGradient>
    <radialGradient id="${id}fo" cx=".5" cy=".75" r=".7"><stop offset="0" stop-color="#ffe9a0"/><stop offset=".5" stop-color="#ff9a2e"/><stop offset="1" stop-color="#ff4a00" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}h" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffb35a" stop-opacity=".55"/><stop offset="1" stop-color="#ff7a1a" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}e" cx=".5" cy=".6" r=".6"><stop offset="0" stop-color="#ff7a20" stop-opacity=".55"/><stop offset=".5" stop-color="#2a0c04"/><stop offset="1" stop-color="#050202"/></radialGradient>
    <pattern id="${id}x" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><rect width="1.3" height="4" fill="#1a1008"/></pattern></defs>
    <ellipse cx="100" cy="272" rx="78" ry="13" fill="#000" opacity=".75"/>
    <circle class="halo" cx="96" cy="40" r="70" fill="url(#${id}h)"/>
    <path d="M36,180 C24,118 52,70 100,68 C148,70 176,118 164,180 C161,198 152,206 148,220 L148,240 C142,256 58,256 52,240 L52,220 C48,206 39,198 36,180Z" fill="url(#${id}b)" stroke="${INK}" stroke-width="4"/>
    <path d="M140,96 C160,120 166,160 158,192 C150,206 146,214 144,226 L144,240 C150,220 168,190 162,140 C158,118 152,104 140,96Z" fill="url(#${id}x)" opacity=".85"/>
    <path d="M118,78 l-6,18 l10,10 l-8,16" fill="none" stroke="#3a2a18" stroke-width="2"/>
    <path d="M44,164 C50,142 66,140 86,148 C92,166 84,186 66,188 C50,190 42,180 44,164Z" fill="url(#${id}e)" stroke="${INK}" stroke-width="3"/>
    <path d="M156,164 C150,142 134,140 114,148 C108,166 116,186 134,188 C150,190 158,180 156,164Z" fill="url(#${id}e)" stroke="${INK}" stroke-width="3"/>
    <path d="M100,192 C92,204 90,214 96,216 L100,212 L104,216 C110,214 108,204 100,192Z" fill="#140a05" stroke="${INK}" stroke-width="2"/>
    <path d="M60,226 Q100,236 140,226 L140,246 Q100,252 60,246Z" fill="#d9c9a6" stroke="${INK}" stroke-width="3"/>
    <path d="M70,228 L70,247 M80,230 L80,249 M90,231 L90,250 M100,231 L100,251 M110,231 L110,250 M120,230 L120,249 M130,228 L130,247" stroke="${INK}" stroke-width="2.2"/>
    <path d="M60,236 Q100,242 140,236" stroke="${INK}" stroke-width="1.5" fill="none"/>
    <path d="M40,150 C46,138 62,134 76,138" fill="none" stroke="${INK}" stroke-width="3"/>
    <path d="M160,150 C154,138 138,134 124,138" fill="none" stroke="${INK}" stroke-width="3"/>
    <path d="M58,84 C76,72 92,70 112,72" fill="none" stroke="#fffaf0" stroke-width="3" opacity=".6"/>
    <path d="M62,88 C70,74 92,64 128,72 C114,82 98,86 62,88Z" fill="#f2e6cc"/>
    <path d="M68,92 L68,40 Q78,34 90,40 L90,92 Z" fill="url(#${id}w)" stroke="${INK}" stroke-width="3"/>
    <path d="M68,60 q-4,14 -2,30 M90,52 q5,12 2,28 q-2,14 4,24 M78,92 q-2,10 2,18" stroke="#efe2c4" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M112,96 L112,58 Q120,54 128,58 L128,92 Z" fill="url(#${id}w)" stroke="${INK}" stroke-width="3"/>
    <path d="M112,70 q-6,10 -4,22 q2,8 -2,16 M128,66 q4,10 2,20" stroke="#efe2c4" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M79,40 q-2,-6 1,-10" stroke="${INK}" stroke-width="2.5" fill="none"/><path d="M120,58 q2,-5 -1,-9" stroke="${INK}" stroke-width="2.5" fill="none"/>
    ${flame(80, 32, 1, "a")}${flame(119, 51, 0.8, "b")}
  </svg>`;
}

/** Stacked coins and a slate coaster with the purse chalked on it. */
export function coins(count: number, currency: string): string {
  const id = uid("m");
  const total = Math.max(1, Math.min(26, Math.round(Math.log2(count + 1) * 3.2)));
  const stacks = [Math.ceil(total * 0.5), Math.ceil(total * 0.3), Math.max(0, total - Math.ceil(total * 0.5) - Math.ceil(total * 0.3))];
  const r = rng(count + 3);
  const coin = (x: number, y: number) => `<path d="M${x - 24},${y} L${x - 24},${y + 5} A24 8 0 0 0 ${x + 24},${y + 5} L${x + 24},${y}Z" fill="url(#${id}s)" stroke="#2a1a04" stroke-width="1.2"/><ellipse cx="${x}" cy="${y}" rx="24" ry="8" fill="url(#${id}t)" stroke="#2a1a04" stroke-width="1.2"/><ellipse cx="${x}" cy="${y}" rx="16" ry="5" fill="none" stroke="#8a5a10" stroke-width="1"/>`;
  let body = "";
  const bases: [number, number][] = [[64, 118], [104, 126], [44, 132]];
  stacks.forEach((k, s) => {
    const [bx, by] = bases[s]!;
    for (let j = 0; j < k; j++) body += coin(bx + (r() - 0.5) * 3, by - j * 5.4);
  });
  body += coin(128, 140).replace(/<path[^>]*>/, "");
  const label = count >= 1000 ? `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}k` : String(count);
  return `<svg viewBox="0 0 260 170" aria-hidden="true"><defs>
    <linearGradient id="${id}t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0a8"/><stop offset=".45" stop-color="#e2a83a"/><stop offset="1" stop-color="#7a4a0c"/></linearGradient>
    <linearGradient id="${id}s" x1="0" x2="1"><stop offset="0" stop-color="#6a3e08"/><stop offset=".4" stop-color="#d49a30"/><stop offset="1" stop-color="#4a2a04"/></linearGradient>
    ${chalkFilter(id)}</defs>
    <ellipse cx="80" cy="140" rx="70" ry="16" fill="#000" opacity=".6"/>
    <path d="M150,112 L248,104 L256,150 L156,160Z" fill="#16181b" stroke="#000" stroke-width="2"/>
    <path d="M150,112 L248,104 L256,150 L156,160Z" fill="none" stroke="#3a2a1a" stroke-width="5" opacity=".9"/>
    <text x="203" y="146" text-anchor="middle" font-family="Gambit Fell, serif" font-size="38" fill="#f3d27a" filter="url(#${id}c)" transform="rotate(-4 203 140)">${esc(label)}</text>
    <text x="203" y="102" text-anchor="middle" font-family="Gambit Cinzel, serif" font-weight="800" font-size="11" letter-spacing="2" fill="#c9a86a">${esc(currency.toUpperCase())}</text>
    ${body}
  </svg>`;
}

/** The leather ledger lying on the table: the Journal. */
export function ledger(leather: string): string {
  const id = uid("l");
  return `<svg viewBox="0 0 270 190" aria-hidden="true"><defs>
    <clipPath id="${id}c"><path d="M34,46 L222,22 L256,118 L46,150Z"/></clipPath>
    <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></linearGradient>
    <linearGradient id="${id}b" x1="0" x2="1"><stop offset="0" stop-color="#f6d58a"/><stop offset=".5" stop-color="#b07a26"/><stop offset="1" stop-color="#5a3608"/></linearGradient>
    <radialGradient id="${id}w" cx=".4" cy=".35"><stop offset="0" stop-color="#ff6a5a"/><stop offset=".6" stop-color="#a8141a"/><stop offset="1" stop-color="#4a0508"/></radialGradient></defs>
    <ellipse cx="146" cy="160" rx="124" ry="22" fill="#000" opacity=".7"/>
    <path d="M46,150 L256,118 L258,134 L48,170Z" fill="#2a0e08"/>
    <path d="M46,150 L256,118 L257,128 L47,161Z" fill="#e6d6b0"/>
    <path d="M60,153 L252,124 M60,156 L253,127 M60,159 L254,130" stroke="#8a7650" stroke-width=".7"/>
    <path d="M34,46 L222,22 L256,118 L46,150Z" fill="#4a1810"/>
    <image href="${leather}" x="20" y="10" width="250" height="150" preserveAspectRatio="none" clip-path="url(#${id}c)"/>
    <path d="M34,46 L222,22 L256,118 L46,150Z" fill="url(#${id}g)"/>
    <path d="M56,54 L212,34 L238,112 L64,138Z" fill="none" stroke="#1a0604" stroke-width="3"/>
    <path d="M57,56 L212,36 L238,114 L65,140Z" fill="none" stroke="#c08a50" stroke-width="1" opacity=".5"/>
    <path d="M34,46 L46,150 L36,160 C26,120 24,80 26,52Z" fill="#2a0a06" stroke="${INK}" stroke-width="2"/>
    <path d="M30,70 L40,68 M31,96 L42,94 M33,124 L44,122" stroke="#c9a060" stroke-width="3"/>
    ${[[34, 46, 1, 1], [222, 22, -1, 1], [256, 118, -1, -1], [46, 150, 1, -1]].map(([x, y, sx, sy]) => `<path d="M${x},${y} l${sx! * 22},${-sy! * 2.5 + sy! * 1} l${-sx! * 2},${sy! * 18}Z" fill="url(#${id}b)" stroke="#2a1804" stroke-width="1"/>`).join("")}
    <path d="M168,128 C170,150 162,168 172,184 L178,178 L184,186 C176,166 182,148 178,126Z" fill="#9c1419" stroke="${INK}" stroke-width="1.5"/>
    <ellipse cx="146" cy="86" rx="24" ry="17" fill="url(#${id}w)" stroke="#3a0406" stroke-width="2"/>
    <path d="M136,80 L146,94 L156,80 M146,74 L146,94" stroke="#f0b0a0" stroke-width="2" fill="none" opacity=".75"/>
    <path d="M86,64 L178,52 M90,118 L196,104" stroke="#1a0604" stroke-width="2" stroke-dasharray="6 4" opacity=".7"/>
  </svg>`;
}

/** A brass cage holding a deck of cards with a sun on its back: the class book. */
export function deckCase(): string {
  const id = uid("k");
  return `<svg viewBox="0 0 200 210" aria-hidden="true"><defs>
    <linearGradient id="${id}b" x1="0" x2="1"><stop offset="0" stop-color="#4a2c06"/><stop offset=".3" stop-color="#f2cf7a"/><stop offset=".6" stop-color="#a87020"/><stop offset="1" stop-color="#3a2004"/></linearGradient>
    <linearGradient id="${id}v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe6a0"/><stop offset="1" stop-color="#6a4008"/></linearGradient></defs>
    <ellipse cx="102" cy="194" rx="88" ry="14" fill="#000" opacity=".7"/>
    <path d="M30,80 L150,62 L180,80 L60,100Z" fill="#7a1015" stroke="${INK}" stroke-width="2"/>
    <path d="M44,80 L148,66 L166,80 L62,95Z" fill="none" stroke="#e8c070" stroke-width="1.6"/>
    <circle cx="106" cy="80" r="9" fill="#f0c860" stroke="${INK}" stroke-width="1.5"/>
    ${Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<line x1="${f(106 + Math.cos(a) * 11)}" y1="${f(80 + Math.sin(a) * 6)}" x2="${f(106 + Math.cos(a) * 18)}" y2="${f(80 + Math.sin(a) * 10)}" stroke="#f0c860" stroke-width="1.4"/>`; }).join("")}
    <path d="M30,80 L60,100 L60,180 L30,160Z" fill="#d9ccb0"/>
    <path d="M60,100 L180,80 L180,160 L60,180Z" fill="#cbbd9c"/>
    ${Array.from({ length: 26 }, (_, i) => `<path d="M60,${f(103 + i * 3)} L180,${f(83 + i * 3)}" stroke="${i % 3 ? "#8a7a58" : "#5a4a30"}" stroke-width=".8"/><path d="M30,${f(83 + i * 3)} L60,${f(103 + i * 3)}" stroke="#8a7a58" stroke-width=".6"/>`).join("")}
    <path d="M60,100 L180,80 L180,160 L60,180Z" fill="#000" opacity=".25"/>
    <path d="M26,78 L60,100 L184,78 M60,100 L60,184 M26,78 L26,162 L60,184 L184,162 L184,78" fill="none" stroke="url(#${id}b)" stroke-width="7" stroke-linejoin="round"/>
    <path d="M26,78 L150,58 L184,78" fill="none" stroke="url(#${id}v)" stroke-width="5"/>
    ${[90, 120, 150].map((x) => `<path d="M${x},${f(100 - (x - 60) / 6)} L${x},${f(180 - (x - 60) / 6)}" stroke="url(#${id}v)" stroke-width="4"/>`).join("")}
    <path d="M44,90 L44,172" stroke="url(#${id}v)" stroke-width="3"/>
    <path d="M78,134 L170,119 L170,141 L78,156Z" fill="#2a1a08" stroke="#e8c070" stroke-width="1.5"/>
    <text x="124" y="143" text-anchor="middle" font-family="Gambit Cinzel, serif" font-weight="800" font-size="14" letter-spacing="1.5" fill="#f2cf7a" transform="rotate(-9 124 137)">CLASSES</text>
    ${[[26, 78], [60, 100], [184, 78], [26, 162], [60, 184], [184, 162]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.5" fill="#ffe6a0" stroke="#3a2004" stroke-width="1.5"/>`).join("")}
  </svg>`;
}

/** A gavel resting on its sound block: calls the house to change the table (theme switcher). */
export function gavel(): string {
  const id = uid("g");
  return `<svg viewBox="0 0 250 160" aria-hidden="true"><defs>
    <linearGradient id="${id}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a0603a"/><stop offset=".5" stop-color="#5a2a14"/><stop offset="1" stop-color="#1e0a04"/></linearGradient>
    <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe6a0"/><stop offset=".5" stop-color="#b07a26"/><stop offset="1" stop-color="#4a2a04"/></linearGradient></defs>
    <ellipse cx="128" cy="140" rx="110" ry="16" fill="#000" opacity=".7"/>
    <path d="M60,104 L60,124 A54 14 0 0 0 168,124 L168,104Z" fill="url(#${id}w)" stroke="${INK}" stroke-width="2.5"/>
    <ellipse cx="114" cy="104" rx="54" ry="14" fill="#7a3a1e" stroke="${INK}" stroke-width="2.5"/>
    <ellipse cx="114" cy="104" rx="40" ry="9" fill="none" stroke="#c07a4a" stroke-width="1" opacity=".6"/>
    <path d="M118,86 L234,40 L240,52 L124,98Z" fill="url(#${id}w)" stroke="${INK}" stroke-width="2.5"/>
    <path d="M216,46 L222,58 M200,52 L206,64" stroke="url(#${id}b)" stroke-width="4"/>
    <g transform="rotate(-22 100 82)">
      <rect x="62" y="58" width="78" height="44" rx="4" fill="url(#${id}w)" stroke="${INK}" stroke-width="3"/>
      <rect x="54" y="54" width="12" height="52" rx="3" fill="url(#${id}b)" stroke="${INK}" stroke-width="2"/>
      <rect x="136" y="54" width="12" height="52" rx="3" fill="url(#${id}b)" stroke="${INK}" stroke-width="2"/>
      <rect x="92" y="58" width="18" height="44" fill="url(#${id}b)" opacity=".85"/>
      <path d="M70,64 L132,64" stroke="#e8a070" stroke-width="2" opacity=".5"/>
    </g>
  </svg>`;
}

/** A brass service bell (decoration; it shivers when the house is thinking). */
export function bell(): string {
  const id = uid("e");
  return `<svg viewBox="0 0 120 110" aria-hidden="true"><defs>
    <radialGradient id="${id}d" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff4c0"/><stop offset=".35" stop-color="#e2b04a"/><stop offset=".8" stop-color="#7a4a0c"/><stop offset="1" stop-color="#3a2004"/></radialGradient>
    <linearGradient id="${id}b" x1="0" x2="1"><stop offset="0" stop-color="#2a1a08"/><stop offset=".4" stop-color="#5a4020"/><stop offset="1" stop-color="#120a02"/></linearGradient></defs>
    <ellipse cx="60" cy="100" rx="56" ry="9" fill="#000" opacity=".7"/>
    <path d="M10,84 L10,94 A50 10 0 0 0 110,94 L110,84Z" fill="url(#${id}b)" stroke="${INK}" stroke-width="2"/>
    <ellipse cx="60" cy="84" rx="50" ry="10" fill="#3a2810" stroke="${INK}" stroke-width="2"/>
    <path d="M18,84 C18,46 36,30 60,30 C84,30 102,46 102,84Z" fill="url(#${id}d)" stroke="${INK}" stroke-width="2.5"/>
    <path d="M30,70 C32,50 42,40 56,38" stroke="#fff8d8" stroke-width="4" fill="none" opacity=".7" stroke-linecap="round"/>
    <rect x="56" y="14" width="8" height="18" fill="url(#${id}d)" stroke="${INK}" stroke-width="1.5"/>
    <ellipse cx="60" cy="13" rx="11" ry="5" fill="url(#${id}d)" stroke="${INK}" stroke-width="1.5"/>
  </svg>`;
}

/** A folded place card standing on the table in front of someone: their name, and a way to talk. */
export function tentCard(): string {
  return `<svg viewBox="0 0 200 70" preserveAspectRatio="none" aria-hidden="true">
    <path d="M6,64 L18,8 L182,8 L194,64Z" fill="#0b0a0c" opacity=".6" transform="translate(4 4)"/>
    <path d="M6,64 L18,8 L182,8 L194,64Z" fill="#e2d6bd" stroke="${INK}" stroke-width="3"/>
    <path d="M18,8 L182,8" stroke="#fff6e0" stroke-width="2"/>
    <path d="M14,58 L22,14 L178,14 L186,58Z" fill="none" stroke="${RED}" stroke-width="1.4"/>
  </svg>`;
}

/* ------------------------------ Scoreboard ------------------------------- */

/** Rough chalk: eroded by noise and wobbled at the edges. */
export function chalkFilter(id: string): string {
  return `<filter id="${id}c" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="4" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" result="d"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.55" result="a"/>
    <feComposite in="d" in2="a" operator="in"/>
  </filter>`;
}

export interface BoardData {
  where: string;
  isNew: boolean;
  day: number;
  time: string;
  vigor: number;
  thread?: { found: number; total: number };
  supplies?: { now: number; max: number };
  keys?: number;
  delve: boolean;
}

/** Chalk emblem for the hour. */
function hourGlyph(time: string): string {
  const s = `fill="none" stroke="#efeadf" stroke-width="3" stroke-linecap="round"`;
  if (time === "night") return `<path d="M0,-16 A16 16 0 1 0 12,10 A12 12 0 1 1 0,-16Z" ${s}/><path d="M18,-14 l2,4 l4,1 l-4,2 l-1,4 l-2,-4 l-4,-1 l4,-2Z" ${s} stroke-width="1.6"/>`;
  if (time === "evening") return `<path d="M-20,6 L20,6" ${s}/><path d="M-12,6 A12 12 0 0 1 12,6" ${s}/>${[-60, -30, 0, 30, 60].map((a) => { const r = (a - 90) * Math.PI / 180; return `<line x1="${f(Math.cos(r) * 16)}" y1="${f(6 + Math.sin(r) * 16)}" x2="${f(Math.cos(r) * 22)}" y2="${f(6 + Math.sin(r) * 22)}" ${s} stroke-width="2"/>`; }).join("")}`;
  return `<circle r="${time === "morning" ? 9 : 11}" ${s}/>${Array.from({ length: 8 }, (_, i) => { const r = (i / 8) * Math.PI * 2; return `<line x1="${f(Math.cos(r) * 15)}" y1="${f(Math.sin(r) * 15)}" x2="${f(Math.cos(r) * 21)}" y2="${f(Math.sin(r) * 21)}" ${s} stroke-width="2.2"/>`; }).join("")}${time === "morning" ? `<path d="M-24,12 L24,12" ${s} stroke-width="2"/>` : ""}`;
}

/** A row of chalk tally marks: groups of five, struck through. */
function tally(x: number, y: number, count: number, max: number): string {
  let out = "";
  for (let i = 0; i < max; i++) {
    const g = Math.floor(i / 5);
    const k = i % 5;
    const px = x + g * 40 + k * 7;
    if (i >= count) {
      out += `<circle cx="${px + 1}" cy="${y + 10}" r="1.4" fill="#efeadf" opacity=".35"/>`;
      continue;
    }
    if (k === 4) out += `<line x1="${px - 30}" y1="${y + 16}" x2="${px + 2}" y2="${y + 2}" stroke="#efeadf" stroke-width="2.6" stroke-linecap="round"/>`;
    else out += `<line x1="${px}" y1="${y}" x2="${px + 2}" y2="${y + 20}" stroke="#efeadf" stroke-width="2.6" stroke-linecap="round"/>`;
  }
  return out;
}

/**
 * The hanging scoreboard, viewBox -46 0 350 900: chains (y 0-420), timber
 * frame and slate (420-800), hooks with pinned slips below (800-900), and a
 * glass vigor tube clamped to its left side.
 */
export function scoreboard(b: BoardData, slate: string, paper: string): string {
  const id = uid("b");
  const r = rng(77);
  const chain = (x: number) => Array.from({ length: 22 }, (_, i) => (i % 2 ? `<rect x="${x - 2.5}" y="${i * 19 + 2}" width="5" height="22" rx="2.5" fill="url(#${id}i)" stroke="#000" stroke-width="1.2"/>` : `<ellipse cx="${x}" cy="${i * 19 + 12}" rx="7" ry="12" fill="none" stroke="url(#${id}i)" stroke-width="4"/><ellipse cx="${x}" cy="${i * 19 + 12}" rx="7" ry="12" fill="none" stroke="#000" stroke-width="1" opacity=".6"/>`)).join("");
  const grain = Array.from({ length: 28 }, () => {
    const y = 422 + r() * 376;
    return `<path d="M-6,${f(y)} q80,${f((r() - 0.5) * 6)} 160,${f((r() - 0.5) * 4)} t160,${f((r() - 0.5) * 5)}" stroke="#0a0402" stroke-width="${f(0.6 + r())}" fill="none" opacity=".5"/>`;
  }).join("");
  const name = b.where.toUpperCase();
  const nameFit = name.length > 14 ? ` textLength="196" lengthAdjust="spacingAndGlyphs"` : "";
  const vig = Math.max(0, Math.min(1, b.vigor));
  const tubeTop = 470;
  const tubeH = 290;
  const liq = tubeH * vig;
  const vigCol = vig > 0.5 ? ["#1fa34a", "#7dffa8", "#0e5a26", "#3dff78"] : vig > 0.25 ? ["#c88a12", "#ffd36a", "#6a4204", "#ffb02a"] : ["#a8141a", "#ff6a5a", "#4a0508", "#ff3a2a"];
  const total = Math.max(0, Math.min(8, b.thread?.total ?? 0));
  const found = Math.min(total, b.thread?.found ?? 0);
  const hooks = Array.from({ length: total }, (_, i) => {
    const x = 20 + ((i + 0.5) / total) * 220;
    const tilt = (r() - 0.5) * 16;
    const slip = i < found
      ? `<g transform="rotate(${f(tilt)} ${f(x)} 812)"><rect x="${f(x - 15)}" y="814" width="30" height="46" fill="#e2d6bd"/><image href="${paper}" x="${f(x - 15)}" y="814" width="30" height="46" preserveAspectRatio="none"/><rect x="${f(x - 15)}" y="814" width="30" height="46" fill="none" stroke="${INK}" stroke-width="2"/><path d="M${f(x - 9)},826 l18,0 M${f(x - 9)},834 l14,0 M${f(x - 9)},842 l16,0" stroke="${INK}" stroke-width="1.5"/><circle cx="${f(x + 6)}" cy="851" r="4.5" fill="${RED}" stroke="${INK}" stroke-width="1"/></g>`
      : "";
    return `<path d="M${f(x)},800 l0,8 q0,8 -6,6" fill="none" stroke="url(#${id}i)" stroke-width="3"/>${slip}`;
  }).join("");
  let lower = "";
  if (b.delve) lower = "";
  else if (b.supplies)
    lower = `<text x="28" y="684" font-family="Gambit Cinzel, serif" font-weight="600" font-size="15" letter-spacing="3" fill="#efeadf" filter="url(#${id}c)">SUPPLIES</text>
      <text x="236" y="686" text-anchor="end" font-family="Gambit Fell, serif" font-size="30" fill="#efeadf" filter="url(#${id}c)">${b.supplies.now}<tspan font-size="18" opacity=".7">/${b.supplies.max}</tspan></text>
      <g filter="url(#${id}c)">${tally(30, 700, b.supplies.now, Math.min(20, b.supplies.max))}</g>`;
  else
    lower = `<text x="28" y="690" font-family="Gambit Cinzel, serif" font-weight="600" font-size="15" letter-spacing="3" fill="#efeadf" filter="url(#${id}c)">VIGOR</text>
      <text x="236" y="694" text-anchor="end" font-family="Gambit Fell, serif" font-size="40" fill="${vig > 0.5 ? "#a9f5c0" : vig > 0.25 ? "#ffd98a" : "#ff8a7a"}" filter="url(#${id}c)">${Math.round(vig * 100)}<tspan font-size="22">%</tspan></text>`;
  const thr = b.thread
    ? `<text x="28" y="${b.delve ? 770 : 776}" font-family="Gambit Cinzel, serif" font-weight="600" font-size="15" letter-spacing="3" fill="#efeadf" filter="url(#${id}c)">THREAD</text>
       <text x="236" y="${b.delve ? 772 : 780}" text-anchor="end" font-family="Gambit Fell, serif" font-size="34" fill="#efeadf" filter="url(#${id}c)">${found}<tspan font-size="22" opacity=".8"> / ${b.thread.total}</tspan></text>`
    : "";
  const keys = b.keys ? `<g transform="translate(176 722)" filter="url(#${id}c)">${Array.from({ length: Math.min(4, b.keys) }, (_, i) => `<g transform="translate(${i * 22} 0)"><circle cx="0" cy="0" r="6" fill="none" stroke="#ffd98a" stroke-width="2.4"/><path d="M0,6 L0,22 M0,16 L5,16 M0,20 L4,20" stroke="#ffd98a" stroke-width="2.4"/></g>`).join("")}</g>` : "";
  return `<svg viewBox="-46 0 350 900" aria-hidden="true"><defs>
    <linearGradient id="${id}i" x1="0" x2="1"><stop offset="0" stop-color="#1a1a1c"/><stop offset=".45" stop-color="#6a6a70"/><stop offset="1" stop-color="#0a0a0c"/></linearGradient>
    <linearGradient id="${id}w" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a2a18"/><stop offset=".5" stop-color="#2a150c"/><stop offset="1" stop-color="#140904"/></linearGradient>
    <linearGradient id="${id}p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffeaa8"/><stop offset=".45" stop-color="#d4a03c"/><stop offset=".55" stop-color="#9a6a1c"/><stop offset="1" stop-color="#5a3a08"/></linearGradient>
    <linearGradient id="${id}g" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".05"/><stop offset=".25" stop-color="#fff" stop-opacity=".45"/><stop offset=".4" stop-color="#fff" stop-opacity=".05"/><stop offset=".85" stop-color="#fff" stop-opacity=".15"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></linearGradient>
    <linearGradient id="${id}l" x1="0" x2="1"><stop offset="0" stop-color="${vigCol[2]}"/><stop offset=".45" stop-color="${vigCol[1]}"/><stop offset="1" stop-color="${vigCol[0]}"/></linearGradient>
    <filter id="${id}glow" x="-200%" y="-20%" width="500%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>
    <clipPath id="${id}s"><rect x="-4" y="444" width="268" height="336"/></clipPath>
    ${chalkFilter(id)}</defs>
    ${chain(30)}${chain(230)}
    <g transform="translate(6 10)" opacity=".55"><rect x="-10" y="420" width="290" height="390" fill="#000" filter="url(#${id}glow)"/></g>
    <rect x="-20" y="420" width="300" height="380" fill="url(#${id}w)" stroke="#000" stroke-width="3"/>
    ${grain}
    <rect x="-20" y="420" width="300" height="380" fill="none" stroke="#6a3e22" stroke-width="2" opacity=".6"/>
    <rect x="-4" y="444" width="268" height="336" fill="#000"/>
    <image href="${slate}" x="-4" y="444" width="268" height="336" preserveAspectRatio="none" clip-path="url(#${id}s)"/>
    <rect x="-4" y="444" width="268" height="336" fill="none" stroke="#0a0402" stroke-width="5"/>
    <rect x="-1" y="447" width="262" height="330" fill="none" stroke="#000" stroke-width="2" opacity=".6"/>
    ${[[-20, 420], [280, 420], [-20, 800], [280, 800]].map(([x, y]) => { const sx = x! < 0 ? 1 : -1; const sy = y! < 500 ? 1 : -1; return `<path d="M${x},${y} l${sx * 44},0 l0,${sy * 10} l${-sx * 34},0 l0,${sy * 34} l${-sx * 10},0Z" fill="url(#${id}p)" stroke="#2a1804" stroke-width="1.5"/><circle cx="${x! + sx * 6}" cy="${y! + sy * 6}" r="2.6" fill="#2a1804"/><circle cx="${x! + sx * 30}" cy="${y! + sy * 5}" r="2.2" fill="#2a1804"/><circle cx="${x! + sx * 5}" cy="${y! + sy * 30}" r="2.2" fill="#2a1804"/>`; }).join("")}
    <circle cx="30" cy="420" r="9" fill="url(#${id}i)" stroke="#000" stroke-width="2"/><circle cx="230" cy="420" r="9" fill="url(#${id}i)" stroke="#000" stroke-width="2"/>
    <path d="M22,456 L238,456 L244,462 L244,498 L238,504 L22,504 L16,498 L16,462Z" fill="url(#${id}p)" stroke="#2a1804" stroke-width="2"/>
    <path d="M24,460 L236,460" stroke="#fff6d0" stroke-width="1.5" opacity=".7"/>
    <circle cx="26" cy="480" r="3.2" fill="#3a2404"/><circle cx="234" cy="480" r="3.2" fill="#3a2404"/>
    <path d="M23,477 l6,6 M231,477 l6,6" stroke="#ffeab0" stroke-width="1"/>
    <text x="130" y="488" text-anchor="middle" font-family="Gambit Cinzel, serif" font-weight="800" font-size="${name.length > 18 ? 15 : 19}" letter-spacing="2" fill="#2a1604"${nameFit}>${esc(name)}</text>
    <text x="130" y="489" text-anchor="middle" font-family="Gambit Cinzel, serif" font-weight="800" font-size="${name.length > 18 ? 15 : 19}" letter-spacing="2" fill="#fff0c0" opacity=".25" dy="1"${nameFit}>${esc(name)}</text>
    ${b.isNew ? `<g filter="url(#${id}c)" transform="rotate(-10 236 452)"><ellipse cx="236" cy="452" rx="30" ry="15" fill="none" stroke="#ff8a7a" stroke-width="3"/><text x="236" y="458" text-anchor="middle" font-family="Gambit Cinzel, serif" font-weight="800" font-size="15" fill="#ff8a7a">NEW</text></g>` : ""}
    ${b.delve ? `<g filter="url(#${id}c)">
      <path d="M8,512 q120,-3 244,1 M8,712 q120,3 244,-2 M10,512 q-2,100 1,200 M250,512 q3,100 -1,200" stroke="#efeadf" stroke-width="2.4" fill="none" opacity=".8"/>
      <text x="20" y="742" font-family="Gambit Cinzel, serif" font-weight="600" font-size="15" letter-spacing="3" fill="#efeadf">DAY ${b.day}</text>
      <text x="96" y="742" font-family="Gambit Fell, serif" font-size="20" fill="#f6f2e8">· ${esc(b.time)}</text>
    </g>` : `<g filter="url(#${id}c)">
      <path d="M130,514 q-3,40 2,70 q3,30 -1,56" stroke="#efeadf" stroke-width="3" fill="none"/>
      <path d="M20,652 q60,-4 110,1 q60,4 112,-2" stroke="#efeadf" stroke-width="2.6" fill="none"/>
      <text x="74" y="534" text-anchor="middle" font-family="Gambit Cinzel, serif" font-weight="600" font-size="16" letter-spacing="4" fill="#efeadf">DAY</text>
      <text x="74" y="626" text-anchor="middle" font-family="Gambit Cinzel, serif" font-weight="600" font-size="${b.day > 99 ? 50 : 72}" fill="#f6f2e8">${b.day}</text>
      <text x="190" y="534" text-anchor="middle" font-family="Gambit Cinzel, serif" font-weight="600" font-size="16" letter-spacing="4" fill="#efeadf">HOUR</text>
      <g transform="translate(190 578)">${hourGlyph(b.time)}</g>
      <text x="190" y="634" text-anchor="middle" font-family="Gambit Fell, serif" font-size="${b.time.length > 8 ? 24 : 28}" fill="#f6f2e8">${esc(b.time)}</text>
    </g>`}
    ${lower}${keys}${thr}
    <g>
      <rect x="-44" y="${tubeTop - 14}" width="24" height="${tubeH + 28}" rx="5" fill="#0a0908" stroke="#000" stroke-width="2"/>
      <rect x="-40" y="${tubeTop}" width="16" height="${tubeH}" rx="8" fill="#0c1410"/>
      <rect x="-40" y="${f(tubeTop + tubeH - liq)}" width="16" height="${f(liq)}" rx="7" fill="${vigCol[3]}" opacity=".7" filter="url(#${id}glow)"/>
      <rect x="-40" y="${f(tubeTop + tubeH - liq)}" width="16" height="${f(liq)}" rx="7" fill="url(#${id}l)"/>
      ${liq > 12 ? `<ellipse cx="-32" cy="${f(tubeTop + tubeH - liq + 2)}" rx="8" ry="2.5" fill="${vigCol[1]}"/>${[0.2, 0.45, 0.7].map((k) => `<circle cx="${-34 + k * 6}" cy="${f(tubeTop + tubeH - liq * k)}" r="${1.4 + k}" fill="#fff" opacity=".55"/>`).join("")}` : ""}
      <rect x="-40" y="${tubeTop}" width="16" height="${tubeH}" rx="8" fill="url(#${id}g)" stroke="#9aa0a0" stroke-width="1" stroke-opacity=".5"/>
      ${[0.25, 0.5, 0.75].map((k) => `<line x1="-44" x2="-36" y1="${f(tubeTop + tubeH * k)}" y2="${f(tubeTop + tubeH * k)}" stroke="#d4a03c" stroke-width="1.6"/>`).join("")}
      <rect x="-47" y="${tubeTop - 18}" width="30" height="14" rx="3" fill="url(#${id}p)" stroke="#2a1804" stroke-width="1.5"/>
      <rect x="-47" y="${tubeTop + tubeH + 4}" width="30" height="14" rx="3" fill="url(#${id}p)" stroke="#2a1804" stroke-width="1.5"/>
      <rect x="-22" y="${tubeTop + 30}" width="6" height="10" fill="url(#${id}p)"/><rect x="-22" y="${tubeTop + tubeH - 40}" width="6" height="10" fill="url(#${id}p)"/>
    </g>
    <rect x="10" y="796" width="240" height="7" rx="2" fill="url(#${id}p)" stroke="#2a1804" stroke-width="1"/>
    ${hooks}
  </svg>`;
}

/* ------------------------------ Plaque ---------------------------------- */

/** The chipped stone narration plaque with a painted ribbon across its top (frame only; text is HTML). */
export function plaque(stone: string, seed: number): string {
  const id = uid("q");
  const out = notched(4, 18, 696, 236, seed, 2, 5);
  const r = rng(seed + 1);
  const rib: string[] = [];
  for (let x = 170; x <= 530; x += 12) rib.push(`${x},${f(2 + r() * 4)}`);
  const ribB: string[] = [];
  for (let x = 530; x >= 170; x -= 12) ribB.push(`${x},${f(40 + r() * 5)}`);
  return `<svg viewBox="0 0 700 240" preserveAspectRatio="none" aria-hidden="true"><defs><clipPath id="${id}o"><path d="${out}"/></clipPath>
    <linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2be09a"/><stop offset=".5" stop-color="#16b877"/><stop offset="1" stop-color="#0a6a44"/></linearGradient></defs>
    <path d="${out}" fill="#000" opacity=".7" transform="translate(6 10)"/>
    <path d="${out}" fill="#141518"/>
    <image href="${stone}" width="700" height="240" preserveAspectRatio="none" clip-path="url(#${id}o)"/>
    <path d="${out}" fill="none" stroke="#3a3d45" stroke-width="5"/>
    <path d="${notched(14, 28, 686, 226, seed + 9, 1.2, 2)}" fill="none" stroke="#000" stroke-width="2" opacity=".8"/>
    <path d="M150,10 L170,4 L${rib.join(" L")} L548,0 L536,22 L552,46 L${ribB.join(" L")} L150,44 L162,24Z" fill="url(#${id}r)" stroke="#04140c" stroke-width="2.5"/>
    <path d="M176,12 L520,10" stroke="#9affd0" stroke-width="1.5" opacity=".6"/>
  </svg>`;
}

/* --------------------------- Portrait shadowbox -------------------------- */

/** A dark iron gothic arch for an opaque portrait (380 x 500); the picture sits under it, masked to the arch. */
export const ARCH_PATH = "M40,500 L40,190 Q40,120 100,80 Q150,46 190,20 Q230,46 280,80 Q340,120 340,190 L340,500Z";
export function shadowbox(): string {
  const id = uid("a");
  return `<svg viewBox="0 0 380 500" preserveAspectRatio="none" aria-hidden="true"><defs>
    <linearGradient id="${id}i" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1a1416"/><stop offset=".4" stop-color="#7a5c43"/><stop offset=".55" stop-color="#2a1f1d"/><stop offset="1" stop-color="#0c0809"/></linearGradient>
    <radialGradient id="${id}v" cx=".5" cy=".55" r=".6"><stop offset=".55" stop-color="#070508" stop-opacity="0"/><stop offset="1" stop-color="#070508" stop-opacity=".95"/></radialGradient></defs>
    <path d="${ARCH_PATH}" fill="url(#${id}v)"/>
    <path d="M28,500 L28,186 Q28,112 94,70 Q146,36 190,6 Q234,36 286,70 Q352,112 352,186 L352,500" fill="none" stroke="url(#${id}i)" stroke-width="22"/>
    <path d="M40,500 L40,190 Q40,120 100,80 Q150,46 190,20 Q230,46 280,80 Q340,120 340,190 L340,500" fill="none" stroke="#7a5c43" stroke-width="1.5" opacity=".8"/>
    <path d="M16,500 L16,182 Q16,104 88,60 Q142,26 190,-8 Q238,26 292,60 Q364,104 364,182 L364,500" fill="none" stroke="#000" stroke-width="3"/>
    <path d="M190,-4 L200,22 L190,40 L180,22Z" fill="#7a5c43" stroke="#000" stroke-width="2"/>
    ${[[28, 200], [352, 200], [28, 330], [352, 330]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#2a1f1d" stroke="#000" stroke-width="2"/><circle cx="${x! - 2}" cy="${y! - 2}" r="3" fill="#a08060"/>`).join("")}
    <path d="M28,250 l-14,-10 l0,20Z M352,250 l14,-10 l0,20Z" fill="#2a1f1d" stroke="#000" stroke-width="2"/>
  </svg>`;
}

/* ------------------------------ Player's hand ---------------------------- */

/**
 * Your own left hand, comic-inked, entering from the bottom-right corner and
 * holding your fact cards (viewBox 0 0 400 400). Split in two: the fingers
 * go behind the cards, the thumb, palm heel and sleeve in front of them.
 */
export function handBack(): string {
  const id = uid("h");
  return `<svg viewBox="0 0 400 400" aria-hidden="true"><defs>
    <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e2bc8e"/><stop offset=".55" stop-color="#9a6e58"/><stop offset="1" stop-color="#3a2e39"/></linearGradient>
    <pattern id="${id}x" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)"><rect width="1.8" height="5" fill="#24120a"/></pattern></defs>
    <path d="M236,300 C232,250 236,200 252,170 C262,150 284,138 302,144 C320,150 336,160 346,178 C358,198 362,228 356,258 C352,290 342,320 328,346 L300,384 L240,362Z" fill="url(#${id}s)" stroke="#24120a" stroke-width="5" stroke-linejoin="round"/>
    <path d="M346,178 C358,198 362,228 356,258 C352,290 342,320 328,346 L316,350 C330,320 340,290 344,258 C348,228 344,200 336,184Z" fill="url(#${id}x)" opacity=".8"/>
    <path d="M338,196 q10,4 14,14 M348,236 q8,2 10,10 M344,280 q8,0 10,8" stroke="#24120a" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M300,144 q12,-10 26,-2 q10,6 6,16" stroke="#24120a" stroke-width="3" fill="#c89a74" stroke-linejoin="round"/>
    <path d="M326,160 q12,-4 20,8 q4,10 -4,16" stroke="#24120a" stroke-width="3" fill="#c89a74"/>
  </svg>`;
}

export function handFront(): string {
  const id = uid("h");
  return `<svg viewBox="0 0 400 400" aria-hidden="true"><defs>
    <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0cc9a"/><stop offset=".45" stop-color="#9a6e58"/><stop offset="1" stop-color="#3a2e39"/></linearGradient>
    <linearGradient id="${id}c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a1418"/><stop offset=".5" stop-color="#1c0a0e"/><stop offset="1" stop-color="#070305"/></linearGradient>
    <pattern id="${id}x" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)"><rect width="1.8" height="5" fill="#24120a"/></pattern>
    <pattern id="${id}y" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(50)"><rect width="1.4" height="6" fill="#24120a"/><rect width="6" height="1.2" fill="#24120a"/></pattern></defs>
    <path d="M262,400 C250,370 228,346 208,326 C192,310 176,292 164,274 C154,260 144,246 146,234 C148,220 164,216 176,226 C192,240 208,256 224,268 C240,280 256,288 270,294 C290,304 306,320 316,342 L322,400Z" fill="url(#${id}s)" stroke="#24120a" stroke-width="5" stroke-linejoin="round"/>
    <path d="M152,238 C156,226 170,224 176,232 C172,242 160,246 152,238Z" fill="#f6dcb6" stroke="#24120a" stroke-width="2.5"/>
    <path d="M164,274 C176,292 192,310 208,326 C228,346 250,370 262,400 L240,400 C226,372 206,350 188,330 C176,316 166,300 160,284Z" fill="url(#${id}x)" opacity=".75"/>
    <path d="M196,268 q8,-10 18,-6 M210,298 q16,-4 26,6" stroke="#24120a" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <path d="M232,318 C252,326 270,344 280,366" stroke="#24120a" stroke-width="2" fill="none" opacity=".55"/>
    <path d="M178,236 C190,246 204,258 214,264" stroke="#fff" stroke-width="2.5" fill="none" opacity=".5" stroke-linecap="round"/>
    <path d="M300,330 C318,340 340,346 360,348 L700,330 L700,520 L282,520Z" fill="url(#${id}c)" stroke="#24120a" stroke-width="5" stroke-linejoin="round"/>
    <path d="M276,368 C300,346 340,334 400,326 L700,300 L700,326 L400,350 C346,356 310,368 290,388Z" fill="#7a1015" stroke="#24120a" stroke-width="3"/>
    <path d="M286,372 C310,354 346,342 398,336 L700,310" stroke="#e8c070" stroke-width="2" stroke-dasharray="7 5" fill="none"/>
    <path d="M300,392 C330,376 360,370 400,366 L700,350 L700,520 L296,520Z" fill="url(#${id}y)" opacity=".55"/>
    <circle cx="318" cy="356" r="5" fill="#e8c070" stroke="#24120a" stroke-width="2"/>
  </svg>`;
}

/* ------------------------------ Open ledger ------------------------------ */

/** The open journal: a leather cover with two parchment pages and a stitched gutter (frame only). */
export function openBook(leather: string, page: string, single = false): string {
  const id = uid("j");
  const pages = single
    ? `<path d="M34,40 Q500,20 966,40 L962,610 Q500,590 38,610Z" fill="#d6c4a0"/>
    <image href="${page}" x="34" y="20" width="932" height="600" preserveAspectRatio="none" clip-path="url(#${id}c)" opacity=".95"/>
    <path d="M30,30 L34,40 L38,610 L30,604Z M970,30 L966,40 L962,610 L970,604Z" fill="#b8a47c"/>
    <path d="M900,26 L900,668 L912,654 L924,668 L924,26Z" fill="#9c1419" stroke="#3a0406" stroke-width="2"/>`
    : `<path d="M34,48 Q270,18 496,44 L496,604 Q270,580 38,606Z" fill="#d6c4a0"/>
    <path d="M504,44 Q730,18 966,48 L962,606 Q730,580 504,604Z" fill="#d6c4a0"/>
    <image href="${page}" x="34" y="20" width="462" height="590" preserveAspectRatio="none" clip-path="url(#${id}c)" opacity=".95"/>
    <image href="${page}" x="504" y="20" width="462" height="590" preserveAspectRatio="none" clip-path="url(#${id}c)" opacity=".95"/>
    <path d="M30,36 L34,48 L38,606 L30,600Z M970,36 L966,48 L962,606 L970,600Z" fill="#b8a47c"/>
    <rect x="0" y="0" width="1000" height="640" fill="url(#${id}g)"/>
    <path d="M500,44 L500,604" stroke="#3a2010" stroke-width="2" stroke-dasharray="8 6"/>
    <rect x="470" y="40" width="60" height="566" fill="url(#${id}s)"/>
    <path d="M494,28 C510,170 486,330 496,470 C502,540 512,590 506,650 L512,634 L516,656 L520,638 L524,652 C528,590 518,536 512,470 C502,330 526,170 512,28Z" fill="#1a0a04" opacity=".4" transform="translate(7 6)"/>
    <path d="M494,28 C510,170 486,330 496,470 C502,540 512,590 506,650 L512,634 L516,656 L520,638 L524,652 C528,590 518,536 512,470 C502,330 526,170 512,28Z" fill="#9c1419"/>
    <path d="M503,36 C518,170 494,330 504,470 C510,540 518,590 514,630" stroke="#e8686a" stroke-width="2.5" fill="none" opacity=".55" stroke-linecap="round"/>`;
  return `<svg viewBox="0 0 1000 640" preserveAspectRatio="none" aria-hidden="true"><defs>
    <clipPath id="${id}c"><path d="M8,28 Q500,-6 992,28 L986,628 Q500,600 14,628Z"/></clipPath>
    <linearGradient id="${id}g" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".44" stop-color="#000" stop-opacity="0"/><stop offset=".5" stop-color="#000" stop-opacity=".55"/><stop offset=".56" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
    <linearGradient id="${id}s" x1="0" x2="1"><stop offset="0" stop-color="#140a05" stop-opacity="0"/><stop offset=".5" stop-color="#140a05" stop-opacity=".65"/><stop offset="1" stop-color="#140a05" stop-opacity="0"/></linearGradient></defs>
    <path d="M8,28 Q500,-6 992,28 L986,628 Q500,600 14,628Z" fill="#000" opacity=".8" transform="translate(10 18)"/>
    <image href="${leather}" width="1000" height="640" preserveAspectRatio="none" clip-path="url(#${id}c)"/>
    <path d="M8,28 Q500,-6 992,28 L986,628 Q500,600 14,628Z" fill="none" stroke="#120402" stroke-width="5"/>
    ${pages}
  </svg>`;
}

/** An empty high-backed chair across the table, for when nobody is there to face. */
export function chair(): string {
  const id = uid("r");
  return `<svg viewBox="0 0 240 420" aria-hidden="true"><defs>
    <linearGradient id="${id}w" x1="0" x2="1"><stop offset="0" stop-color="#1a0a05"/><stop offset=".35" stop-color="#5a2a16"/><stop offset=".6" stop-color="#2a1208"/><stop offset="1" stop-color="#0a0402"/></linearGradient>
    <linearGradient id="${id}v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a0c12"/><stop offset="1" stop-color="#1a0204"/></linearGradient>
    <pattern id="${id}d" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M9,2 L16,9 L9,16 L2,9Z" fill="none" stroke="#8a2a2a" stroke-width="1" opacity=".5"/></pattern></defs>
    <path d="M30,420 L30,90 Q30,40 70,30 L80,8 L92,30 Q120,18 148,30 L160,8 L170,30 Q210,40 210,90 L210,420Z" fill="url(#${id}w)" stroke="#000" stroke-width="4"/>
    <path d="M56,420 L56,104 Q56,70 86,62 Q120,52 154,62 Q184,70 184,104 L184,420Z" fill="url(#${id}v)" stroke="#000" stroke-width="3"/>
    <path d="M56,420 L56,104 Q56,70 86,62 Q120,52 154,62 Q184,70 184,104 L184,420Z" fill="url(#${id}d)"/>
    ${[70, 100, 130, 160].map((x) => `<circle cx="${x}" cy="${x === 70 || x === 160 ? 92 : 80}" r="3.5" fill="#c9a060" stroke="#000"/>`).join("")}
    <path d="M80,8 L86,-10 L92,8 M160,8 L154,-10 L148,8" fill="#5a2a16" stroke="#000" stroke-width="2"/>
    <circle cx="86" cy="-12" r="7" fill="#5a2a16" stroke="#000" stroke-width="2"/><circle cx="154" cy="-12" r="7" fill="#5a2a16" stroke="#000" stroke-width="2"/>
    <path d="M40,100 L40,410 M200,100 L200,410" stroke="#8a4a26" stroke-width="2" opacity=".5"/>
  </svg>`;
}

/** An iron tag for the theme switcher (200 x 64). */
export function ironTag(seed: number): string {
  const out = notched(4, 6, 196, 60, seed, 1.4, 2);
  return `<svg viewBox="0 0 200 64" preserveAspectRatio="none" aria-hidden="true">
    <path d="${out}" fill="#16171a" stroke="#000" stroke-width="3"/>
    <path d="${notched(10, 12, 190, 54, seed + 1, 0.8, 0)}" fill="none" stroke="#b07a26" stroke-width="2"/>
    <circle cx="18" cy="33" r="6" fill="#030205" stroke="#b07a26" stroke-width="2"/>
  </svg>`;
}

/** A parchment sheet for the frontier map (fills its box). */
export function mapSheet(paper: string, seed: number): string {
  const id = uid("p");
  const out = notched(4, 4, 596, 296, seed, 2.4, 6);
  return `<svg viewBox="0 0 600 300" preserveAspectRatio="none" aria-hidden="true"><defs><clipPath id="${id}o"><path d="${out}"/></clipPath></defs>
    <path d="${out}" fill="#d8c8a4"/>
    <image href="${paper}" width="600" height="300" preserveAspectRatio="none" clip-path="url(#${id}o)"/>
    <path d="${out}" fill="none" stroke="#3a2412" stroke-width="3"/>
    <path d="${notched(16, 14, 584, 286, seed + 2, 1, 0)}" fill="none" stroke="#5a3a1a" stroke-width="1.5" opacity=".6"/>
    <g transform="translate(548 52)" stroke="#5a2a10" fill="none" stroke-width="1.5"><circle r="22"/><path d="M0,-30 L5,0 L0,30 L-5,0Z M-30,0 L0,5 L30,0 L0,-5Z" fill="#7a1015" fill-opacity=".6"/></g>
    <text x="300" y="282" text-anchor="middle" font-family="Gambit Cinzel, serif" font-weight="800" font-size="16" letter-spacing="6" fill="#5a2a10" opacity=".8">THE FRONTIER</text>
    ${[[18, 18], [582, 18], [18, 282], [582, 282]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="#2a2a2e" stroke="#000" stroke-width="2"/><circle cx="${x! - 2}" cy="${y! - 2}" r="2.5" fill="#9a9aa0"/>`).join("")}
  </svg>`;
}
