/**
 * Hand-built SVG artwork for the Lobby theme: brass instruments, gold-leaf
 * rail objects, lockets, frames, plaques and the candle-lit still life.
 * Shared gradients, filters and clip paths live in DEFS (ids prefixed
 * `lb-`); every other piece references them, so each drawing stays a
 * string of paths that the renderer can drop into the DOM.
 *
 * Gradients use objectBoundingBox units, so never stroke a perfectly
 * horizontal or vertical line with one (a zero-height box draws nothing):
 * those lines use flat colours.
 */
import { brushed, parchment, leather } from "./tex.js";

const f = (n: number) => +n.toFixed(2);
const DARK = "#1c1308";
const INK = "#2a1d0a";

/* ------------------------------ Generators ------------------------------ */

/** A toothed gear outline around (cx, cy). */
export function gearPath(cx: number, cy: number, r: number, teeth: number, depth: number): string {
  const pts: string[] = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const at = (rad: number, ang: number) => `${f(cx + Math.cos(ang) * rad)},${f(cy + Math.sin(ang) * rad)}`;
    pts.push(at(r - depth, a), at(r - depth, a + step * 0.18), at(r, a + step * 0.3), at(r, a + step * 0.62), at(r - depth, a + step * 0.74));
  }
  return `M${pts.join("L")}Z`;
}

/** A sunburst of alternating long and short rays. */
export function raysPath(cx: number, cy: number, r0: number, r1: number, n: number, short = 0.62): string {
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const len = i % 2 ? r0 + (r1 - r0) * short : r1;
    const w = (Math.PI / n) * 0.55;
    parts.push(`M${f(cx + Math.cos(a - w) * r0)},${f(cy + Math.sin(a - w) * r0)}L${f(cx + Math.cos(a) * len)},${f(cy + Math.sin(a) * len)}L${f(cx + Math.cos(a + w) * r0)},${f(cy + Math.sin(a + w) * r0)}Z`);
  }
  return parts.join("");
}

/** A four-pointed star (studs, glints, lens flares). */
export function star4(cx: number, cy: number, r: number, waist = 0.22): string {
  const w = r * waist;
  return `M${f(cx)},${f(cy - r)}Q${f(cx + w)},${f(cy - w)} ${f(cx + r)},${f(cy)}Q${f(cx + w)},${f(cy + w)} ${f(cx)},${f(cy + r)}Q${f(cx - w)},${f(cy + w)} ${f(cx - r)},${f(cy)}Q${f(cx - w)},${f(cy - w)} ${f(cx)},${f(cy - r)}Z`;
}

/** A hanging chain of alternating face-on and edge-on links along a quadratic curve. */
export function chain(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, n: number, size = 4): string {
  let s = "";
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1;
    const y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1;
    const dx = 2 * (1 - t) * (cx - x0) + 2 * t * (x1 - cx);
    const dy = 2 * (1 - t) * (cy - y0) + 2 * t * (y1 - cy);
    const ang = f((Math.atan2(dy, dx) * 180) / Math.PI);
    const ry = i % 2 ? size * 0.22 : size * 0.58;
    s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${size}" ry="${f(ry)}" transform="rotate(${ang} ${f(x)} ${f(y)})" fill="none" stroke="${DARK}" stroke-width="${f(size * 0.75)}"/>`;
    s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${size}" ry="${f(ry)}" transform="rotate(${ang} ${f(x)} ${f(y)})" fill="none" stroke="url(#lb-brass)" stroke-width="${f(size * 0.42)}"/>`;
  }
  return s;
}

/** A small rivet / boss. */
const rivet = (x: number, y: number, r = 2.6) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${DARK}"/><circle cx="${x - r * 0.12}" cy="${y - r * 0.12}" r="${f(r * 0.78)}" fill="url(#lb-brass)"/><circle cx="${f(x - r * 0.3)}" cy="${f(y - r * 0.3)}" r="${f(r * 0.25)}" fill="#fff6d6" opacity=".8"/>`;

/** A C-scroll of filigree, drawn for the left end; mirror it for the right. */
const scroll = (x: number, y: number, s = 1) =>
  `<path d="M${x},${y} c${-8 * s},${-1 * s} ${-13 * s},${-9 * s} ${-7 * s},${-15 * s} c${4 * s},${-4 * s} ${10 * s},${-1 * s} ${8 * s},${4 * s} c${-1 * s},${3 * s} ${-5 * s},${3 * s} ${-5 * s},0" fill="none" stroke="${DARK}" stroke-width="${f(4 * s)}" stroke-linecap="round"/>` +
  `<path d="M${x},${y} c${-8 * s},${-1 * s} ${-13 * s},${-9 * s} ${-7 * s},${-15 * s} c${4 * s},${-4 * s} ${10 * s},${-1 * s} ${8 * s},${4 * s} c${-1 * s},${3 * s} ${-5 * s},${3 * s} ${-5 * s},0" fill="none" stroke="url(#lb-brass)" stroke-width="${f(2.2 * s)}" stroke-linecap="round"/>` +
  `<path d="M${x},${y} c${-8 * s},${1 * s} ${-13 * s},${9 * s} ${-7 * s},${15 * s} c${4 * s},${4 * s} ${10 * s},${1 * s} ${8 * s},${-4 * s}" fill="none" stroke="url(#lb-brass)" stroke-width="${f(1.6 * s)}" stroke-linecap="round" opacity=".85"/>`;

/* --------------------------------- Defs --------------------------------- */

const brassStops = `<stop offset="0" stop-color="#6b4f22"/><stop offset=".2" stop-color="#B68D40"/><stop offset=".42" stop-color="#FFF2C2"/><stop offset=".55" stop-color="#d9b464"/><stop offset=".78" stop-color="#8C6224"/><stop offset="1" stop-color="#2A1B08"/>`;
const cylStops = `<stop offset="0" stop-color="#3e2a0c"/><stop offset=".12" stop-color="#8f6a2c"/><stop offset=".3" stop-color="#f7e3a8"/><stop offset=".42" stop-color="#d6ae5c"/><stop offset=".7" stop-color="#8a6421"/><stop offset=".9" stop-color="#5c4012"/><stop offset="1" stop-color="#2a1c08"/>`;

/** The shared material library, mounted once per theme root (hidden). */
export function defs(): string {
  return `<svg class="lb-defs" width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden"><defs>
<linearGradient id="lb-brass" x1="0" y1="0" x2="1" y2="1">${brassStops}</linearGradient>
<linearGradient id="lb-brassH" x1="0" y1="0" x2="1" y2="0">${brassStops}</linearGradient>
<linearGradient id="lb-cyl" x1="0" y1="0" x2="0" y2="1">${cylStops}</linearGradient>
<linearGradient id="lb-cylH" x1="0" y1="0" x2="1" y2="0">${cylStops}</linearGradient>
<linearGradient id="lb-plate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2c789"/><stop offset=".1" stop-color="#B39256"/><stop offset=".5" stop-color="#8C6D36"/><stop offset=".9" stop-color="#694F22"/><stop offset="1" stop-color="#3f2e10"/></linearGradient>
<linearGradient id="lb-plateB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e0c486"/><stop offset=".12" stop-color="#A3824A"/><stop offset=".55" stop-color="#8f6f38"/><stop offset=".92" stop-color="#6b5226"/><stop offset="1" stop-color="#3f2e10"/></linearGradient>
<linearGradient id="lb-bronze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4d3f2c"/><stop offset=".5" stop-color="#3A3024"/><stop offset="1" stop-color="#1a140d"/></linearGradient>
<linearGradient id="lb-obs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1F1B18"/><stop offset="1" stop-color="#0E0C0A"/></linearGradient>
<linearGradient id="lb-wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a2c18"/><stop offset=".6" stop-color="#2b170b"/><stop offset="1" stop-color="#160b05"/></linearGradient>
<linearGradient id="lb-wax" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6e5a44"/><stop offset=".35" stop-color="#f6e7c6"/><stop offset=".6" stop-color="#e9d2a6"/><stop offset="1" stop-color="#5e4a34"/></linearGradient>
<linearGradient id="lb-ray" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe9b8" stop-opacity=".9"/><stop offset=".55" stop-color="#ffd890" stop-opacity=".25"/><stop offset="1" stop-color="#ffd890" stop-opacity="0"/></linearGradient>
<linearGradient id="lb-fadeGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="lb-thread" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1d4a4c"/><stop offset=".4" stop-color="#5fb7b0"/><stop offset=".7" stop-color="#d8c27a"/><stop offset="1" stop-color="#2a3a2c"/></linearGradient>
<linearGradient id="lb-vigor" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a2a0c"/><stop offset=".7" stop-color="#e87a3e"/><stop offset="1" stop-color="#ffd27a"/></linearGradient>
<linearGradient id="lb-sheen" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff8dc" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<radialGradient id="lb-glass" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#f6f1e2"/><stop offset=".18" stop-color="#a6c1c2"/><stop offset=".6" stop-color="#26363c"/><stop offset="1" stop-color="#090e10"/></radialGradient>
<radialGradient id="lb-ember"><stop offset="0" stop-color="#fff3c4"/><stop offset=".3" stop-color="#ffd27a"/><stop offset=".62" stop-color="#e87a3e" stop-opacity=".7"/><stop offset="1" stop-color="#e87a3e" stop-opacity="0"/></radialGradient>
<radialGradient id="lb-amber" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#ffe2a8"/><stop offset=".45" stop-color="#e87a3e"/><stop offset="1" stop-color="#5a1f08"/></radialGradient>
<radialGradient id="lb-coin" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#fff2be"/><stop offset=".45" stop-color="#e2b65c"/><stop offset=".85" stop-color="#a87a2a"/><stop offset="1" stop-color="#6a4a14"/></radialGradient>
<radialGradient id="lb-slate" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#2c241d"/><stop offset="1" stop-color="#0E0C0A"/></radialGradient>
<radialGradient id="lb-vig" cx=".5" cy=".45" r=".62"><stop offset=".55" stop-color="#0e0c0a" stop-opacity="0"/><stop offset="1" stop-color="#0e0c0a" stop-opacity=".92"/></radialGradient>
<radialGradient id="lb-flameG" cx=".5" cy=".75" r=".7"><stop offset="0" stop-color="#fffbe6"/><stop offset=".35" stop-color="#ffe08a"/><stop offset=".75" stop-color="#f08a3a"/><stop offset="1" stop-color="#b8401a" stop-opacity="0"/></radialGradient>
<radialGradient id="lb-crim" cx=".5" cy=".5" r=".7"><stop offset="0" stop-color="#c2361f"/><stop offset=".45" stop-color="#6a120a"/><stop offset="1" stop-color="#1a0604"/></radialGradient>
<linearGradient id="lb-slash" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#fff3d6" stop-opacity="0"/><stop offset=".5" stop-color="#fff3d6" stop-opacity=".8"/><stop offset="1" stop-color="#fff3d6" stop-opacity="0"/></linearGradient>
<radialGradient id="lb-seal" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#c8463a"/><stop offset=".6" stop-color="#8f2219"/><stop offset="1" stop-color="#4a0d08"/></radialGradient>
<pattern id="lb-brush" patternUnits="userSpaceOnUse" width="512" height="128"><image href="${brushed()}" width="512" height="128" preserveAspectRatio="none"/></pattern>
<pattern id="lb-paper" patternUnits="userSpaceOnUse" width="256" height="256"><image href="${parchment()}" width="256" height="256" preserveAspectRatio="none"/></pattern>
<pattern id="lb-hide" patternUnits="userSpaceOnUse" width="192" height="192"><image href="${leather()}" width="192" height="192" preserveAspectRatio="none"/></pattern>
<mask id="lb-fadeR" maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#lb-fadeGrad)"/></mask>
<filter id="lb-sh" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="14" stdDeviation="10" flood-color="#000" flood-opacity=".75"/></filter>
<filter id="lb-sepia" x="0" y="0" width="100%" height="100%"><feColorMatrix type="matrix" values=".39 .77 .19 0 0 .35 .69 .17 0 0 .27 .53 .13 0 0 0 0 0 1 0"/><feComponentTransfer><feFuncR type="linear" slope=".7"/><feFuncG type="linear" slope=".66"/><feFuncB type="linear" slope=".6"/></feComponentTransfer></filter>
<filter id="lb-sh2" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="3" stdDeviation="2.6" flood-color="#000" flood-opacity=".8"/></filter>
<filter id="lb-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="lb-blur3" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="lb-blur12" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="12"/></filter>
<clipPath id="lb-lockclip"><circle cx="50" cy="68" r="36.5"/></clipPath>
<clipPath id="lb-diaclip"><path d="M45 10 L80 45 L45 80 L10 45Z"/></clipPath>
<clipPath id="lb-plateclip"><path d="${PLATE}"/></clipPath>
<clipPath id="lb-troughclip"><path d="M22 9 H156 A11 11 0 0 1 156 31 H22 A11 11 0 0 1 22 9Z"/></clipPath>
<clipPath id="lb-miniclip"><circle cx="20" cy="20" r="17"/></clipPath>
</defs></svg>`;
}

/* ------------------------------ Instruments ----------------------------- */

/** Look around: a stepped brass refracting telescope on a tripod. */
export function telescope(tag: string | null = null): string {
  return `<svg viewBox="0 0 240 220" class="art" aria-hidden="true">
<ellipse cx="116" cy="212" rx="72" ry="6" fill="#000" opacity=".55" filter="url(#lb-blur3)"/>
<g filter="url(#lb-sh)">
  <path d="M112 132 L120 132 L127 207 L119 208Z" fill="url(#lb-bronze)" stroke="${DARK}" stroke-width=".8"/>
  <path d="M108 129 L116 134 L67 207 L58 205Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".9"/>
  <path d="M112 134 L120 129 L172 205 L163 207Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".9"/>
  <path d="M110 135 L74 196" stroke="#fff2c4" stroke-width=".7" opacity=".55"/>
  <ellipse cx="62" cy="206" rx="6" ry="2.6" fill="url(#lb-cyl)"/><ellipse cx="168" cy="206" rx="6" ry="2.6" fill="url(#lb-cyl)"/><ellipse cx="123" cy="208" rx="5" ry="2.2" fill="url(#lb-cyl)"/>
  <path d="M83 176 Q114 189 147 176" fill="none" stroke="${DARK}" stroke-width="3.2"/><path d="M83 176 Q114 189 147 176" fill="none" stroke="url(#lb-brass)" stroke-width="1.6"/>
  ${rivet(114, 182, 4)}
  <ellipse cx="114" cy="131" rx="13" ry="5" fill="url(#lb-cyl)" stroke="${DARK}" stroke-width=".8"/>
  <rect x="109" y="106" width="10" height="26" fill="url(#lb-cylH)" stroke="${DARK}" stroke-width=".8"/>
  <path d="${gearPath(114, 119, 6, 10, 1.8)}" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".6"/>
  <path d="M99 114 Q98 96 105 90 L109 90 L109 106 L119 106 L119 90 L123 90 Q130 96 129 114 Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".9"/>
  <g transform="translate(114 95) rotate(-17)">
    <rect x="-119" y="-7.5" width="9" height="15" rx="2" fill="url(#lb-cyl)" stroke="${DARK}" stroke-width=".7"/>
    <rect x="-111" y="-5" width="18" height="10" fill="url(#lb-cyl)" stroke="${DARK}" stroke-width=".6"/>
    <rect x="-95" y="-9" width="5" height="18" rx="1" fill="url(#lb-cyl)" stroke="${DARK}" stroke-width=".7"/>
    <rect x="-90" y="-7.5" width="46" height="15" fill="url(#lb-cyl)" stroke="${DARK}" stroke-width=".6"/>
    <rect x="-46" y="-11.5" width="6" height="23" rx="1" fill="url(#lb-cyl)" stroke="${DARK}" stroke-width=".7"/>
    <rect x="-41" y="-10.5" width="60" height="21" fill="url(#lb-cyl)" stroke="${DARK}" stroke-width=".6"/>
    <path d="M-36 3 q5 -7 10 0 t10 0 t10 0 t10 0 t10 0" fill="none" stroke="#5c4012" stroke-width=".9" opacity=".85"/>
    <rect x="18" y="-14.5" width="7" height="29" rx="1.2" fill="url(#lb-cyl)" stroke="${DARK}" stroke-width=".7"/>
    <rect x="24" y="-13.5" width="64" height="27" fill="url(#lb-cyl)" stroke="${DARK}" stroke-width=".6"/>
    <rect x="40" y="-13.5" width="2.4" height="27" fill="#4a3210" opacity=".7"/><rect x="72" y="-13.5" width="2.4" height="27" fill="#4a3210" opacity=".7"/>
    <path d="${star4(57, 4, 5)}" fill="#5c4012" opacity=".8"/><path d="${star4(57, 3.4, 4)}" fill="#f5e1a4" opacity=".5"/>
    <path d="M87 -15.5 L110 -20 L110 20 L87 15.5Z" fill="url(#lb-cyl)" stroke="${DARK}" stroke-width=".7"/>
    <ellipse cx="110" cy="0" rx="4.5" ry="20" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".7"/>
    <ellipse cx="111" cy="0" rx="3" ry="16.5" fill="url(#lb-glass)"/>
    <ellipse cx="111.6" cy="-7" rx="1.1" ry="5" fill="#fff" opacity=".75"/>
    <rect x="30" y="-23.5" width="42" height="6.5" fill="url(#lb-cyl)" stroke="${DARK}" stroke-width=".5"/>
    <rect x="38" y="-17.5" width="3" height="4.5" fill="#6a4a14"/><rect x="62" y="-17.5" width="3" height="4.5" fill="#6a4a14"/>
    <ellipse cx="72" cy="-20.2" rx="1.6" ry="3.6" fill="url(#lb-glass)"/>
    <path d="${gearPath(-28, 14, 7, 11, 2)}" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".6"/><circle cx="-28" cy="14" r="2.2" fill="${DARK}"/>
    <rect x="-7" y="-13" width="14" height="26" rx="2.5" fill="url(#lb-cyl)" stroke="${DARK}" stroke-width=".8"/>
    ${rivet(0, 0, 3)}
  </g>
  ${chain(59, 120, 50, 146, 47, 158, 8, 3.2)}
  ${tag ? `<g transform="rotate(-7 47 180)"><path d="M31 162 H63 L68 168 V192 L63 198 H31 L26 192 V168Z" fill="${DARK}" transform="translate(1.2 1.6)"/><path d="M31 162 H63 L68 168 V192 L63 198 H31 L26 192 V168Z" fill="url(#lb-plate)" stroke="${DARK}" stroke-width="1"/><path d="M31 162 H63 L68 168 V192 L63 198 H31 L26 192 V168Z" fill="url(#lb-brush)" opacity=".5" style="mix-blend-mode:overlay"/><path d="M33 166 H61 L64 170 V190 L61 194 H33 L30 190 V170Z" fill="none" stroke="#4a3714" stroke-width=".8"/><circle cx="47" cy="167" r="2.2" fill="${DARK}"/><text x="47" y="186" text-anchor="middle" font-family="Gambit Cinzel, serif" font-weight="800" font-size="12" fill="#1E160B">${tag}</text></g>` : `<circle cx="47" cy="170" r="11" fill="${DARK}"/><circle cx="47" cy="170" r="10" fill="url(#lb-brass)"/><circle cx="47" cy="170" r="7.6" fill="#241a0e"/><circle cx="47" cy="170" r="1.9" fill="#e6c687"/>`}
</g>
<g class="flare"><circle cx="220" cy="63" r="10" fill="url(#lb-ember)" opacity=".7" filter="url(#lb-glow)"/><path d="${star4(220, 63, 11, 0.12)}" fill="#fff8dc"/></g>
</svg>`;
}

const ROMAN: [string, number][] = [["XII", 0], ["III", 90], ["VI", 180], ["IX", 270]];
const TIME_ANGLE: Record<string, number> = { morning: 240, afternoon: 60, evening: 210, night: 330 };

/**
 * Wait a while: a tilted open-work astronomical watch. Eccentric orbital
 * rings and a moon aperture inside the bezel, chunky raised numerals on a
 * turning enamel ring, a glowing hourglass at the heart, and a heavy curb
 * chain draping from the bow down its left side.
 */
export function clock(time: string): string {
  const cx = 110;
  const cy = 128;
  const P = (r: number, deg: number) => [cx + Math.sin((deg * Math.PI) / 180) * r, cy - Math.cos((deg * Math.PI) / 180) * r] as const;
  let ticks = "";
  for (let i = 0; i < 60; i++) {
    const big = i % 5 === 0;
    const [x0, y0] = P(64, i * 6);
    const [x1, y1] = P(big ? 70 : 67, i * 6);
    ticks += `<line x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}" stroke="#d8b467" stroke-width="${big ? 1.8 : 0.7}"/>`;
  }
  let numerals = "";
  for (const [t, deg] of ROMAN) {
    const [x, y] = P(74, deg);
    const txt = (fill: string, dx: number, dy: number, extra = "") =>
      `<text x="${f(x + dx)}" y="${f(y + dy)}" transform="rotate(${deg} ${f(x)} ${f(y)})" text-anchor="middle" dominant-baseline="central" font-family="Gambit Cinzel, serif" font-weight="800" font-size="15" fill="${fill}"${extra}>${t}</text>`;
    numerals += txt("#0a0703", 0.9, 1.3) + txt("url(#lb-brass)", 0, 0, ` stroke="#2a1d0a" stroke-width=".35"`);
  }
  for (const deg of [30, 60, 120, 150, 210, 240, 300, 330]) {
    const [x, y] = P(74, deg);
    numerals += `<circle cx="${f(x)}" cy="${f(y)}" r="1.6" fill="#e6c687"/>`;
  }
  for (const deg of [45, 135, 225, 315]) {
    const [x, y] = P(74, deg);
    numerals += `<path d="${star4(x, y, 5)}" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".3"/>`;
  }
  let spokes = "";
  for (let i = 0; i < 6; i++) {
    const a = i * 60 + 30;
    const [x0, y0] = P(24, a);
    const [c1x, c1y] = P(36, a + 26);
    const [c2x, c2y] = P(46, a - 18);
    const [x1, y1] = P(56, a);
    const d = `M${f(x0)},${f(y0)}C${f(c1x)},${f(c1y)} ${f(c2x)},${f(c2y)} ${f(x1)},${f(y1)}`;
    spokes += `<path d="${d}" fill="none" stroke="${DARK}" stroke-width="3.4"/><path d="${d}" fill="none" stroke="url(#lb-brass)" stroke-width="1.8"/>`;
  }
  const ang = TIME_ANGLE[time] ?? 0;
  return `<svg viewBox="0 0 220 270" class="art" aria-hidden="true">
<circle cx="${cx}" cy="${cy}" r="76" fill="url(#lb-ember)" opacity=".38" filter="url(#lb-glow)" class="pulse"/>
<g filter="url(#lb-sh)">
  ${chain(100, 14, -46, 120, 4, 286, 30, 5.4)}
  <g transform="rotate(-8 ${cx} ${cy})">
  <ellipse cx="110" cy="19" rx="14" ry="12" fill="none" stroke="${DARK}" stroke-width="8"/><ellipse cx="110" cy="19" rx="14" ry="12" fill="none" stroke="url(#lb-brass)" stroke-width="5"/>
  <path d="M100 13 A14 12 0 0 1 116 8" fill="none" stroke="#fff6d6" stroke-width="1" opacity=".7"/>
  <rect x="100" y="28" width="20" height="12" rx="2.5" fill="url(#lb-cylH)" stroke="${DARK}" stroke-width=".8"/>
  <path d="M103 29v10M106 29v10M109 29v10M112 29v10M115 29v10M118 29v10" stroke="#5c4012" stroke-width=".7"/>
  <rect x="104" y="39" width="12" height="5" fill="url(#lb-cylH)" stroke="${DARK}" stroke-width=".6"/>
  <circle cx="${cx}" cy="${cy}" r="58" fill="#0b0907" opacity=".72"/>
  <circle cx="${cx}" cy="${cy}" r="88" fill="none" stroke="${DARK}" stroke-width="16"/>
  <circle cx="${cx}" cy="${cy}" r="88" fill="none" stroke="url(#lb-brass)" stroke-width="11"/>
  <circle cx="${cx}" cy="${cy}" r="88" fill="none" stroke="url(#lb-brush)" stroke-width="11" opacity=".4" style="mix-blend-mode:overlay"/>
  <circle cx="${cx}" cy="${cy}" r="93.2" fill="none" stroke="#fff6d6" stroke-width=".9" opacity=".6"/>
  <circle cx="${cx}" cy="${cy}" r="83" fill="none" stroke="#2a1c08" stroke-width="1.4"/>
  <g class="spin">
    <circle cx="${cx}" cy="${cy}" r="72.5" fill="none" stroke="url(#lb-obs)" stroke-width="17"/>
    <circle cx="${cx}" cy="${cy}" r="81" fill="none" stroke="#c59b4e" stroke-width="1"/><circle cx="${cx}" cy="${cy}" r="64" fill="none" stroke="#c59b4e" stroke-width="1"/>
    ${ticks}${numerals}
  </g>
  <circle cx="${cx}" cy="${cy}" r="56" fill="none" stroke="${DARK}" stroke-width="5.5"/><circle cx="${cx}" cy="${cy}" r="56" fill="none" stroke="url(#lb-brass)" stroke-width="3.4"/>
  ${spokes}
  <ellipse cx="116" cy="122" rx="47" ry="40" transform="rotate(15 116 122)" fill="none" stroke="${DARK}" stroke-width="3"/><ellipse cx="116" cy="122" rx="47" ry="40" transform="rotate(15 116 122)" fill="none" stroke="url(#lb-brass)" stroke-width="1.7"/>
  <circle cx="160" cy="132" r="3.4" fill="url(#lb-coin)" stroke="${DARK}" stroke-width=".6"/>
  <circle cx="100" cy="138" r="31" transform="rotate(-22 100 138)" fill="none" stroke="#e6c687" stroke-width="1.1" stroke-dasharray="2.4 2.6"/>
  <circle cx="72" cy="150" r="2.6" fill="url(#lb-seal)"/>
  <ellipse cx="130" cy="110" rx="22" ry="17" transform="rotate(-22 130 110)" fill="none" stroke="url(#lb-brass)" stroke-width="1.3"/>
  <circle cx="146" cy="100" r="2.2" fill="url(#lb-glass)"/>
  <path d="M90 170 A20 20 0 0 1 130 170 Z" fill="#0c1726" stroke="${DARK}" stroke-width="3"/><path d="M90 170 A20 20 0 0 1 130 170 Z" fill="none" stroke="url(#lb-brass)" stroke-width="1.8"/>
  <circle cx="104" cy="161" r="7" fill="#f3e8d2"/><circle cx="107.5" cy="159" r="6.4" fill="#0c1726"/>
  <circle cx="118" cy="160" r=".9" fill="#f3e8d2"/><circle cx="123" cy="165" r=".7" fill="#f3e8d2"/><circle cx="114" cy="166" r=".6" fill="#f3e8d2"/>
  <g transform="rotate(${ang} ${cx} ${cy})"><path d="M${cx} ${cy + 10} L${cx - 2.8} ${cy - 20} L${cx} ${cy - 52} L${cx + 2.8} ${cy - 20}Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".7"/><path d="${star4(cx, cy - 54, 6)}" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".5"/></g>
  <circle cx="${cx}" cy="${cy}" r="22" fill="none" stroke="${DARK}" stroke-width="5"/><circle cx="${cx}" cy="${cy}" r="22" fill="#120e0a" fill-opacity=".55" stroke="url(#lb-brass)" stroke-width="3"/>
  <circle cx="${cx}" cy="${cy}" r="15" fill="url(#lb-ember)" opacity=".85"/>
  <rect x="97" y="103" width="26" height="5" rx="1.8" fill="url(#lb-cyl)" stroke="${DARK}" stroke-width=".6"/><rect x="97" y="148" width="26" height="5" rx="1.8" fill="url(#lb-cyl)" stroke="${DARK}" stroke-width=".6"/>
  <rect x="98.5" y="108" width="2.6" height="40" fill="url(#lb-cylH)"/><rect x="118.9" y="108" width="2.6" height="40" fill="url(#lb-cylH)"/>
  <path d="M103.5 108 C103.5 121 108.5 124 110 128 C111.5 124 116.5 121 116.5 108 Z M103.5 148 C103.5 135 108.5 132 110 128 C111.5 132 116.5 135 116.5 148Z" fill="#cfe6e8" fill-opacity=".16" stroke="#fff8e6" stroke-opacity=".6" stroke-width=".8"/>
  <path d="M105.5 115 C106.5 121 109 124.5 110 126.8 C111 124.5 113.5 121 114.5 115 Z" fill="#ffcf74"/>
  <rect x="109.6" y="127" width=".9" height="15" fill="#ffe2a0" class="sand"/>
  <path d="M104.6 147.6 Q110 136 115.4 147.6Z" fill="#ffc862"/>
  <path d="M44 106 A68 68 0 0 1 122 58" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="7" stroke-linecap="round"/>
  </g>
</g>
<path d="${star4(40, 82, 9, 0.12)}" fill="#fff" class="flare"/><path d="${star4(56, 60, 4.5, 0.15)}" fill="#fff8dc" opacity=".85"/>
</svg>`;
}

/** Rest: a symmetrical apothecary balance, an ember pan and an incense pan. */
export function balance(): string {
  const pan = (x: number, inner: string) => `
    ${[-25, 0, 25].map((dx) => `<path d="M${x} 72 L${x + dx} 150" stroke="#e6c687" stroke-width="1.4" stroke-dasharray="3 1.6"/><path d="M${x + 0.8} 72 L${x + dx + 0.8} 150" stroke="#6a4a14" stroke-width="1.1" stroke-dasharray="3 1.6" stroke-dashoffset="2.3"/>`).join("")}
    ${inner}
    <path d="M${x - 30} 150 Q${x} 188 ${x + 30} 150Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".9"/>
    <path d="M${x - 22} 158 Q${x} 176 ${x + 20} 157" fill="none" stroke="#fff2c4" stroke-width=".8" opacity=".5"/>
    <ellipse cx="${x}" cy="150" rx="30" ry="5.5" fill="url(#lb-cyl)" stroke="${DARK}" stroke-width=".7"/>
    <ellipse cx="${x}" cy="150" rx="25.5" ry="3.4" fill="#241a0e"/>`;
  return `<svg viewBox="0 0 240 230" class="art" aria-hidden="true">
<ellipse cx="120" cy="222" rx="70" ry="6" fill="#000" opacity=".55" filter="url(#lb-blur3)"/>
<g filter="url(#lb-sh)">
  <path d="M60 222 L180 222 L169 207 L71 207Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".9"/>
  <path d="M64 219 L176 219" stroke="#5c4012" stroke-width="1"/>
  <rect x="71" y="202" width="98" height="6" fill="url(#lb-cyl)" stroke="${DARK}" stroke-width=".6"/>
  <path d="M84 202 L156 202 L147 189 L93 189Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".8"/>
  ${scroll(78, 214, 0.8)}<g transform="translate(240 0) scale(-1 1)">${scroll(78, 214, 0.8)}</g>
  <path d="M114.5 190 L113 74 L127 74 L125.5 190Z" fill="url(#lb-cylH)" stroke="${DARK}" stroke-width=".8"/>
  <path d="M117 186V80M120 186V80M123 186V80" stroke="#5c4012" stroke-width=".6" opacity=".7"/>
  <ellipse cx="120" cy="178" rx="12" ry="6" fill="url(#lb-cyl)" stroke="${DARK}" stroke-width=".7"/>
  <ellipse cx="120" cy="130" rx="9.5" ry="10.5" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".8"/>
  <path d="${star4(120, 130, 5.5)}" fill="#5c4012" opacity=".7"/>
  <ellipse cx="120" cy="94" rx="8.5" ry="4.5" fill="url(#lb-cyl)" stroke="${DARK}" stroke-width=".7"/>
  <path d="${raysPath(120, 38, 9, 26, 20)}" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".5"/>
  <circle cx="120" cy="38" r="9.5" fill="url(#lb-coin)" stroke="${DARK}" stroke-width=".8"/>
  <path d="M116 36 Q120 40 124 36 M117 41 Q120 43 123 41" fill="none" stroke="#6a4a14" stroke-width=".7"/>
  <rect x="117.5" y="47" width="5" height="27" fill="url(#lb-cylH)"/>
  <g class="rock">
    <g transform="translate(0 -12)">${pan(44, `<circle cx="44" cy="146" r="13" fill="url(#lb-ember)" opacity=".85" filter="url(#lb-glow)" class="pulse"/><path d="M30 149 Q34 141 38 147 Q41 139 46 146 Q50 140 53 147 Q56 142 58 149Z" fill="#ff9a4a"/><circle cx="38" cy="146.5" r="2.4" fill="#ffd27a"/><circle cx="47" cy="145" r="2.8" fill="#fff0b0"/><circle cx="53" cy="147" r="2" fill="#ffd27a"/>`)}</g>
    <g transform="translate(0 12)">${pan(196, `<path d="M190 149 L196 130 L202 149Z" fill="#6b4a36" stroke="${DARK}" stroke-width=".6"/><circle cx="196" cy="129" r="2" fill="#ffb060"/><g class="smoke"><path d="M196 127 c-6 -8 6 -14 0 -22 c-5 -7 5 -12 1 -20" fill="none" stroke="#f3e8d2" stroke-opacity=".35" stroke-width="2.2" stroke-linecap="round"/><path d="M197 120 c5 -8 -4 -12 2 -20" fill="none" stroke="#f3e8d2" stroke-opacity=".22" stroke-width="1.6" stroke-linecap="round"/></g>`)}</g>
    <path d="${raysPath(120, 63, 9, 23, 16)}" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".5"/>
    <g transform="rotate(9 120 63)">
      <path d="M34 62 Q78 56 120 59 Q162 56 206 62 L206 67 Q162 63 120 67 Q78 63 34 67Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".8"/>
      <path d="M40 61.5 Q80 57.5 118 59.6" fill="none" stroke="#fff6d6" stroke-width=".8" opacity=".75"/>
      ${scroll(36, 64.5, 0.75)}<g transform="translate(240 0) scale(-1 1)">${scroll(36, 64.5, 0.75)}</g>
      <circle cx="44" cy="70" r="3" fill="none" stroke="url(#lb-brass)" stroke-width="1.6"/><circle cx="196" cy="70" r="3" fill="none" stroke="url(#lb-brass)" stroke-width="1.6"/>
    </g>
    ${rivet(120, 63, 7)}
  </g>
</g>
<path d="${star4(124, 38, 8, 0.12)}" fill="#fff" class="flare"/><path d="${star4(60, 150, 4, 0.15)}" fill="#fff8dc" opacity=".8"/>
</svg>`;
}

/**
 * Shop: an iron-bound casket seen three-quarters on, its barrel lid cracked
 * open on a seam of gold light, with an engraved escutcheon and filigree
 * corner brackets.
 */
export function casket(): string {
  const coin = (x: number, y: number, r: number) =>
    `<ellipse cx="${x}" cy="${y + 1.6}" rx="${r}" ry="${f(r * 0.42)}" fill="#5a3c0e"/><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${f(r * 0.42)}" fill="url(#lb-coin)" stroke="#6a4a14" stroke-width=".5"/><ellipse cx="${x}" cy="${y}" rx="${f(r * 0.62)}" ry="${f(r * 0.24)}" fill="none" stroke="#8a6421" stroke-width=".5"/>`;
  const gem = (x: number, y: number, s: number, c0: string, c1: string, c2: string) =>
    `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-7 -2 L-4 -6 H4 L7 -2 L0 7Z" fill="${c1}" stroke="${c2}" stroke-width=".8"/><path d="M-7 -2 H7 M-4 -6 L-2 -2 L0 7 L2 -2 L4 -6 M-2 -2 L0 -6 L2 -2" fill="none" stroke="${c2}" stroke-width=".5" opacity=".8"/><path d="M-4 -6 L-2 -2 H-7Z" fill="${c0}" opacity=".85"/></g>`;
  // Front face corners (left is nearer the viewer) and the right end.
  const front = "M34 122 L152 134 L152 200 L34 188Z";
  const side = "M152 134 L206 114 L206 178 L152 200Z";
  const lidFront = "M36 108 L154 120 C158 102 152 88 142 84 L52 72 C40 76 34 92 36 108Z";
  const lidSide = "M154 120 L208 100 C212 84 204 72 194 68 L142 84 C152 88 158 102 154 120Z";
  const filigree = (x: number, y: number, sx: number, sy: number) =>
    `<g transform="translate(${x} ${y}) scale(${sx} ${sy})"><path d="M0 0 H22 Q14 4 12 10 Q8 6 4 8 Q6 12 10 14 Q4 16 0 22Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".7"/><path d="M3 3 Q10 4 12 8 M3 3 Q4 10 8 12" fill="none" stroke="#5c4012" stroke-width=".6"/>${rivet(4, 4, 1.6)}</g>`;
  return `<svg viewBox="0 0 240 220" class="art" aria-hidden="true">
<ellipse cx="124" cy="206" rx="92" ry="8" fill="#000" opacity=".6" filter="url(#lb-blur3)"/>
<ellipse cx="110" cy="104" rx="84" ry="40" fill="url(#lb-ember)" opacity=".75" filter="url(#lb-glow)" class="pulse"/>
<g filter="url(#lb-sh)">
  <path d="${side}" fill="#1a0e07" stroke="${DARK}" stroke-width="1"/>
  <path d="${side}" fill="url(#lb-hide)" opacity=".25"/>
  <path d="M158 140 L200 124 M158 160 L200 144 M158 180 L200 164" stroke="#0e0804" stroke-width=".7" opacity=".7"/>
  <path d="${front}" fill="url(#lb-wood)" stroke="${DARK}" stroke-width="1"/>
  <path d="${front}" fill="url(#lb-hide)" opacity=".3"/>
  <path d="M42 136 Q90 140 146 146 M42 152 Q96 158 146 162 M42 170 Q88 172 146 180" fill="none" stroke="#120904" stroke-width=".6" opacity=".75"/>
  <path d="M41 129 L146 140 L146 194 L41 183Z" fill="none" stroke="#c8aa6e" stroke-width=".7" opacity=".55"/>
  <path d="M34 122 L152 134 L206 114 L94 104Z" fill="#2a1408"/>
  <path d="M40 120 L150 131 L200 114 L96 106Z" fill="url(#lb-ember)" opacity=".95"/>
  ${coin(84, 116, 8)}${coin(104, 118, 7)}${coin(124, 120, 8)}${coin(146, 118, 6)}
  <path d="M34 122 L152 134 L152 141 L34 129Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".6"/>
  <path d="M152 134 L206 114 L206 121 L152 141Z" fill="#8a6421" stroke="${DARK}" stroke-width=".6"/>
  <path d="M34 182 L152 194 L152 200 L34 188Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".6"/>
  <path d="M60 125 L68 126 L68 192 L60 191Z M118 131 L126 132 L126 198 L118 197Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".6"/>
  <path d="M62 130 V188 M120 136 V194" stroke="#fff2c4" stroke-width=".6" opacity=".55"/>
  ${rivet(64, 140, 1.8)}${rivet(64, 178, 1.8)}${rivet(122, 146, 1.8)}${rivet(122, 186, 1.8)}
  <path d="M170 128 L176 126 L176 188 L170 190Z" fill="#8a6421" stroke="${DARK}" stroke-width=".6"/>
  ${filigree(34, 129, 1, 1)}${filigree(152, 141, -1, 1)}${filigree(34, 188, 1, -1)}${filigree(152, 200, -1, -1)}
  <path d="M80 140 Q84 132 93 134 Q102 132 106 140 L106 162 Q106 176 93 182 Q80 176 80 162Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".9"/>
  <path d="M84 143 Q88 138 93 139 Q98 138 102 143 L102 161 Q102 172 93 177 Q84 172 84 161Z" fill="none" stroke="#5c4012" stroke-width=".7"/>
  <path d="M80 140 Q72 136 74 128 Q78 132 84 133 M106 140 Q114 136 112 128 Q108 132 102 133" fill="none" stroke="url(#lb-brass)" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M86 168 Q93 172 100 168 M88 148 Q93 145 98 148" fill="none" stroke="#5c4012" stroke-width=".6"/>
  <circle cx="93" cy="155" r="3.4" fill="${DARK}"/><path d="M91.6 156 L90.6 164 H95.4 L94.4 156Z" fill="${DARK}"/>
  <path d="M38 108 L152 120 L152 133 L36 121Z" fill="#fff3b8" opacity=".9" filter="url(#lb-blur3)"/>
  <path d="${lidSide}" fill="#20120a" stroke="${DARK}" stroke-width="1"/>
  <path d="M160 112 Q190 96 200 86 M162 100 Q186 86 196 76" fill="none" stroke="#0e0804" stroke-width=".6" opacity=".8"/>
  <path d="${lidFront}" fill="url(#lb-wood)" stroke="${DARK}" stroke-width="1"/>
  <path d="${lidFront}" fill="url(#lb-hide)" opacity=".3"/>
  <path d="M44 100 Q96 96 148 108 M46 88 Q98 84 146 96" fill="none" stroke="#120904" stroke-width=".6" opacity=".7"/>
  <path d="M36 108 L154 120" stroke="url(#lb-brassH)" stroke-width="5"/>
  <path d="M52 72 L142 84 M142 84 L194 68" stroke="#d9b464" stroke-width="2"/>
  <path d="M60 111 L68 112 L69 78 L61 76Z M118 117 L126 118 L128 86 L120 84Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".6"/>
  ${rivet(64, 96, 1.8)}${rivet(123, 103, 1.8)}
  <path d="M90 111 L98 112 L98 124 L94 128 L90 124Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".7"/>
  <path d="M70 118 L54 66 M100 121 L96 58 M130 124 L144 64" stroke="#fff3b8" stroke-width="5" opacity=".14" filter="url(#lb-blur3)"/>
  ${coin(40, 200, 10)}${coin(60, 205, 8)}${coin(192, 196, 9)}${coin(212, 202, 7)}${coin(176, 207, 7)}
  ${gem(156, 204, 1.1, "#d8fff4", "#2f9c86", "#0e3a33")}${gem(80, 206, 1, "#ffd6cf", "#b83a2e", "#4a0d08")}${gem(26, 196, 0.8, "#e6deff", "#5a48a8", "#1e1440")}
  <path d="M100 206 q6 -4 12 0 q6 4 12 0" fill="none" stroke="#f3e8d2" stroke-width="2.4" stroke-dasharray=".1 4.2" stroke-linecap="round"/>
</g>
<path d="${star4(108, 116, 9, 0.14)}" fill="#fff8dc" class="flare"/><path d="${star4(194, 192, 4, 0.15)}" fill="#fff8dc" opacity=".8"/>
</svg>`;
}

/* ------------------------------- Rail icons ------------------------------ */

/** Journal: an angled grimoire with brass clasps and a hanging ribbon. */
export function grimoire(): string {
  return `<svg viewBox="0 0 64 64" class="art" aria-hidden="true"><g filter="url(#lb-sh2)">
<path d="M33 52 L32 63 L35.5 59.5 L39 63 L38 52Z" fill="#8f2219" stroke="#3a0a06" stroke-width=".6"/>
<path d="M44 7 L49 9.5 L55 51 L50 49.5Z" fill="#efe2c4" stroke="${DARK}" stroke-width=".6"/>
<path d="M46 10 L51.5 50 M48 10.5 L53.2 50.4" stroke="#b8a27a" stroke-width=".5"/>
<path d="M8 12 L44 7 L50 49.5 L15 56Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width="1"/>
<path d="M8 12 L15 56 L12 57 L5 13Z" fill="#6a4a14" stroke="${DARK}" stroke-width=".6"/>
<path d="M14 16.5 L40.5 12.6 L45 45.5 L19 50.6Z" fill="#2a1f12" stroke="#f5e1a4" stroke-width=".7" stroke-opacity=".6"/>
<path d="${raysPath(30, 31, 4, 11, 12)}" fill="url(#lb-brass)" opacity=".9"/>
<path d="M23.5 31.6 Q30 25 36.5 30.4 Q30 37 23.5 31.6Z" fill="#2a1f12" stroke="url(#lb-brass)" stroke-width="1.2"/><circle cx="30" cy="31" r="2" fill="#e6c687"/>
<path d="M8 12 L15 11 L9 19Z M44 7 L45 14 L38 8Z M15 56 L14 49 L21 55Z M50 49.5 L43 50.5 L49 43Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".7"/>
</g></svg>`;
}

/** Classes: crossed astronomical dividers and a ritual dagger over a sunburst. */
export function dividers(): string {
  return `<svg viewBox="0 0 64 64" class="art" aria-hidden="true"><g filter="url(#lb-sh2)">
<path d="${raysPath(32, 30, 8, 27, 16)}" fill="url(#lb-brass)" opacity=".55"/>
<circle cx="32" cy="30" r="9" fill="#2a1f12" stroke="url(#lb-brass)" stroke-width="1.2"/>
<path d="M30.4 24 L13 58 L15.6 58.6 L33 26Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".7"/>
<path d="M33.6 24 L51 58 L48.4 58.6 L31 26Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".7"/>
<path d="M21 44 Q32 49 43 44" fill="none" stroke="url(#lb-brass)" stroke-width="1.3"/>
<path d="M32 22 L35 30 L32 60 L29 30Z" fill="#e9e0cc" stroke="${DARK}" stroke-width=".7"/><path d="M32 23 L32 59" stroke="#8c8270" stroke-width=".6"/>
<path d="M23 19 Q32 23 41 19 L41 21.5 Q32 25 23 21.5Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".6"/>
<rect x="30.2" y="9" width="3.6" height="11" fill="#5a2a1a" stroke="${DARK}" stroke-width=".5"/>
<circle cx="32" cy="7" r="3.4" fill="url(#lb-coin)" stroke="${DARK}" stroke-width=".6"/>
${rivet(32, 24, 2.6)}
</g></svg>`;
}

/** Theme switcher: a three-ringed armillary sphere on a stand. */
export function armillary(): string {
  return `<svg viewBox="0 0 64 64" class="art" aria-hidden="true"><g filter="url(#lb-sh2)">
<path d="M20 61 L44 61 L40 55 L24 55Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".7"/>
<rect x="30" y="46" width="4" height="10" fill="url(#lb-cylH)" stroke="${DARK}" stroke-width=".5"/>
<path d="M18 46 Q32 54 46 46" fill="none" stroke="url(#lb-brass)" stroke-width="2.2"/>
<g class="spin3">
<ellipse cx="32" cy="27" rx="19" ry="6.5" fill="none" stroke="${DARK}" stroke-width="3.6"/><ellipse cx="32" cy="27" rx="19" ry="6.5" fill="none" stroke="url(#lb-brass)" stroke-width="2"/>
<ellipse cx="32" cy="27" rx="19" ry="6.5" transform="rotate(-32 32 27)" fill="none" stroke="${DARK}" stroke-width="3.2"/><ellipse cx="32" cy="27" rx="19" ry="6.5" transform="rotate(-32 32 27)" fill="none" stroke="url(#lb-brass)" stroke-width="1.7"/>
</g>
<circle cx="32" cy="27" r="19" fill="none" stroke="${DARK}" stroke-width="3.8"/><circle cx="32" cy="27" r="19" fill="none" stroke="url(#lb-brass)" stroke-width="2.3"/>
<path d="M32 3 L32 51" stroke="#c59b4e" stroke-width="1.2"/>
<circle cx="32" cy="27" r="6.5" fill="url(#lb-coin)" stroke="${DARK}" stroke-width=".7"/>
<path d="${star4(32, 4, 4)}" fill="#f5e1a4"/>
</g></svg>`;
}

/* ----------------------------- Resource icons ---------------------------- */

/** Vigor: a brass-caged alchemical flask of glowing amber. */
export function flask(): string {
  return `<svg viewBox="0 0 48 48" class="art" aria-hidden="true"><g filter="url(#lb-sh2)">
<circle cx="24" cy="31" r="15" fill="url(#lb-ember)" opacity=".55" filter="url(#lb-glow)" class="pulse"/>
<rect x="19.5" y="7" width="9" height="12" fill="#d8ecec" fill-opacity=".25" stroke="#fff6e0" stroke-opacity=".7" stroke-width=".8"/>
<circle cx="24" cy="31" r="13.5" fill="url(#lb-amber)" stroke="#fff6e0" stroke-opacity=".7" stroke-width=".9"/>
<path d="M11 30 Q24 25 37 30" fill="none" stroke="#ffe7b0" stroke-width=".8" opacity=".8"/>
<ellipse cx="24" cy="31" rx="13.5" ry="4" fill="none" stroke="url(#lb-brass)" stroke-width="1.8"/>
<path d="M24 17.5 Q14 31 24 44.5 M24 17.5 Q34 31 24 44.5" fill="none" stroke="url(#lb-brass)" stroke-width="1.3"/>
<rect x="18" y="16" width="12" height="3.2" rx="1" fill="url(#lb-cyl)" stroke="${DARK}" stroke-width=".5"/>
<rect x="19" y="2.5" width="10" height="5.5" rx="1.5" fill="url(#lb-cyl)" stroke="${DARK}" stroke-width=".6"/>
<path d="M17 25 A9 9 0 0 1 22 20.5" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.6" stroke-linecap="round"/>
</g></svg>`;
}

/** Coin: a heavy embossed sovereign with a star. */
export function sovereign(): string {
  let beads = "";
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    beads += `<circle cx="${f(22 + Math.cos(a) * 14.6)}" cy="${f(23 + Math.sin(a) * 14.6)}" r=".75" fill="#7a5620"/>`;
  }
  return `<svg viewBox="0 0 48 48" class="art" aria-hidden="true"><g filter="url(#lb-sh2)">
<ellipse cx="26" cy="27" rx="17" ry="17" fill="#5a3c0e"/>
<path d="M9 23 A17 17 0 0 0 43 27" fill="none" stroke="#3a2608" stroke-width="2"/>
<circle cx="22" cy="23" r="17" fill="url(#lb-coin)" stroke="#8a6421" stroke-width="1"/>
<circle cx="22" cy="23" r="12.6" fill="none" stroke="#8a6421" stroke-width=".9"/>${beads}
<path d="${raysPath(22, 23, 3, 10, 16, 0.55)}" fill="#a8782a"/>
<path d="${star4(22, 23, 7)}" fill="#fff0bd" stroke="#8a6421" stroke-width=".5"/>
<path d="M10 17 A13 13 0 0 1 19 9" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="1.4" stroke-linecap="round"/>
</g></svg>`;
}

/** Thread: a wax-sealed spool of fate thread. */
export function spool(): string {
  let wraps = "";
  for (let y = 13; y <= 35; y += 2.2) wraps += `<path d="M13.5 ${f(y)} Q24 ${f(y + 2.2)} 34.5 ${f(y)}" fill="none" stroke="#0e2a2a" stroke-opacity=".45" stroke-width=".55"/>`;
  return `<svg viewBox="0 0 48 48" class="art" aria-hidden="true"><g filter="url(#lb-sh2)">
<circle cx="24" cy="24" r="16" fill="#5fb7b0" opacity=".28" filter="url(#lb-glow)" class="pulse"/>
<ellipse cx="24" cy="38" rx="15" ry="5" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".8"/>
<rect x="13" y="11" width="22" height="27" fill="url(#lb-thread)"/>${wraps}
<ellipse cx="24" cy="11" rx="15" ry="5" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".8"/>
<ellipse cx="24" cy="11" rx="4" ry="1.5" fill="${DARK}"/>
<path d="M34 30 Q42 34 40 42 Q39 46 44 46" fill="none" stroke="#9fe0d6" stroke-width="1.1"/>
<path d="M30 21.5 q4.5 -2 7.5 1.5 q2.5 3.5 0 7 q-3.5 3.5 -7.5 1.5 q-3.5 -2.5 -2.5 -6.5 q.8 -3 2.5 -3.5Z" fill="url(#lb-seal)" stroke="#3a0a06" stroke-width=".6"/>
<path d="${star4(33, 27, 3.4)}" fill="#e8a296" opacity=".8"/>
</g></svg>`;
}

/** Supplies: a buckled leather satchel. */
export function satchel(): string {
  return `<svg viewBox="0 0 48 48" class="art" aria-hidden="true"><g filter="url(#lb-sh2)">
<path d="M12 18 Q24 2 36 18" fill="none" stroke="#3a2416" stroke-width="3.6"/>
<path d="M7 19 H41 L39 43 Q24 46 9 43Z" fill="#6b4226" stroke="#1a0f08" stroke-width="1"/>
<path d="M7 19 H41 L40 25 Q24 33 8 25Z" fill="#82532f" stroke="#1a0f08" stroke-width=".8"/>
<path d="M9 21 H39" stroke="#c89a62" stroke-width=".6" stroke-dasharray="1.6 1.4" opacity=".7"/>
<rect x="20" y="25" width="8" height="8" rx="1.2" fill="none" stroke="url(#lb-brass)" stroke-width="2"/>
<rect x="23" y="20" width="2" height="14" fill="#3a2416"/>
</g></svg>`;
}

/** Delve keys: an ornate iron-and-brass key. */
export function keyIcon(): string {
  return `<svg viewBox="0 0 48 48" class="art" aria-hidden="true"><g filter="url(#lb-sh2)">
<circle cx="14" cy="16" r="9" fill="none" stroke="${DARK}" stroke-width="5"/><circle cx="14" cy="16" r="9" fill="none" stroke="url(#lb-brass)" stroke-width="3"/>
<path d="${star4(14, 16, 5)}" fill="url(#lb-brass)"/>
<path d="M20 22 L40 42" stroke="${DARK}" stroke-width="5" stroke-linecap="round"/><path d="M20 22 L40 42" stroke="url(#lb-brass)" stroke-width="3" stroke-linecap="round"/>
<path d="M33 35 L29 39 L32 42 L36 38 M37 39 L34 42 L36 44" fill="none" stroke="url(#lb-brass)" stroke-width="2.6"/>
</g></svg>`;
}

/** The working indicator: twin meshing gears. */
export function gears(): string {
  return `<svg viewBox="0 0 48 48" class="art" aria-hidden="true"><g filter="url(#lb-sh2)">
<g class="g1"><path d="${gearPath(19, 20, 14, 12, 3.4)}" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".8"/><circle cx="19" cy="20" r="6" fill="none" stroke="#5c4012" stroke-width="1.6"/><circle cx="19" cy="20" r="2.2" fill="${DARK}"/></g>
<g class="g2"><path d="${gearPath(35, 35, 9, 9, 2.6)}" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".8"/><circle cx="35" cy="35" r="2" fill="${DARK}"/></g>
</g></svg>`;
}

/** Bell for the news ticker. */
export function bell(): string {
  return `<svg viewBox="0 0 40 40" class="art" aria-hidden="true"><g filter="url(#lb-sh2)">
<circle cx="20" cy="20" r="17" fill="#1b140c" stroke="url(#lb-brass)" stroke-width="2"/>
<path d="M12 27 Q13 14 20 12 Q27 14 28 27Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".7"/>
<rect x="10.5" y="26" width="19" height="3" rx="1.2" fill="url(#lb-cyl)"/>
<circle cx="20" cy="31" r="2" fill="url(#lb-coin)"/><rect x="18.6" y="8" width="2.8" height="4.5" fill="url(#lb-cylH)"/>
<path d="M15 24 Q15.5 17 19 15" fill="none" stroke="#fff6d6" stroke-width=".9" opacity=".7"/>
</g></svg>`;
}

/** Talk: comedy and tragedy masks. */
export function masks(): string {
  return `<svg viewBox="0 0 40 40" class="art" aria-hidden="true"><g filter="url(#lb-sh2)">
<path d="M17 6 Q30 4 37 8 Q38 22 30 30 Q24 34 19 28 Q15 20 17 6Z" fill="#8a6421" stroke="${DARK}" stroke-width=".8"/>
<path d="M22 14 q3 2 6 0 M30 13 q2 2 4 0" stroke="${DARK}" stroke-width="1.6" fill="none"/><path d="M24 25 Q28 21 32 25" stroke="${DARK}" stroke-width="1.6" fill="none"/>
<path d="M3 11 Q12 7 23 10 Q25 24 18 32 Q12 37 7 31 Q2 22 3 11Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".9"/>
<path d="M7 17 q2.5 -2.5 5 0 M15 17 q2.5 -2.5 5 0" stroke="${DARK}" stroke-width="1.8" fill="none"/><path d="M9 24 Q13.5 30 18 24" stroke="${DARK}" stroke-width="1.8" fill="none"/>
<path d="M5 13 Q10 10 15 11" stroke="#fff6d6" stroke-width=".8" fill="none" opacity=".7"/>
<path d="M3 11 Q-1 16 1 22 M23 10 Q27 6 31 2" stroke="#8f2219" stroke-width="1.4" fill="none"/>
</g></svg>`;
}

/** Travel: a compass rose. */
export function rose(): string {
  return `<svg viewBox="0 0 40 40" class="art" aria-hidden="true"><g filter="url(#lb-sh2)">
<circle cx="20" cy="20" r="15" fill="#1b140c" stroke="url(#lb-brass)" stroke-width="2"/>
<path d="${raysPath(20, 20, 3, 16, 8, 0.6)}" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".4"/>
<circle cx="20" cy="20" r="2.4" fill="url(#lb-coin)"/>
</g></svg>`;
}

/** Leave / exit: an arched doorway. */
export function door(): string {
  return `<svg viewBox="0 0 40 40" class="art" aria-hidden="true"><g filter="url(#lb-sh2)">
<path d="M8 37 V16 Q8 4 20 3 Q32 4 32 16 V37Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".9"/>
<path d="M12 37 V17 Q12 8 20 7 Q28 8 28 17 V37Z" fill="#1b140c"/>
<path d="M14 37 V18 Q14 10 20 9.5 V37Z" fill="url(#lb-ember)" opacity=".7"/>
</g></svg>`;
}

/** Quill for the talk plaque. */
export function quill(): string {
  return `<svg viewBox="0 0 40 40" class="art" aria-hidden="true"><g filter="url(#lb-sh2)">
<path d="M6 36 Q14 22 34 3 Q36 12 30 18 Q24 24 15 27Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".8"/>
<path d="M8 34 Q20 18 33 5" fill="none" stroke="${DARK}" stroke-width=".9"/>
<path d="M17 25 L22 22 M20 21 L26 18 M23 17 L29 13" stroke="${DARK}" stroke-width=".6"/>
<path d="M4 38 L8 32 L10 34Z" fill="#f3e8d2"/>
</g></svg>`;
}

/** Crossed sabres, for the danger card. */
export function sabres(): string {
  const blade = `<path d="M10 54 L46 10 L50 8 L48 13 L13 57Z" fill="#e9e0cc" stroke="${DARK}" stroke-width=".8"/><path d="M12 56 L48 11" stroke="#9a907c" stroke-width=".6"/><path d="M6 48 Q12 52 17 60 L14 61 Q9 55 4 51Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".7"/><path d="M8 57 L2 63" stroke="#5a2a1a" stroke-width="3.5" stroke-linecap="round"/><circle cx="1.5" cy="63.5" r="2.4" fill="url(#lb-coin)"/>`;
  return `<svg viewBox="-4 0 72 68" class="art" aria-hidden="true"><g filter="url(#lb-sh2)">${blade}<g transform="translate(64 0) scale(-1 1)">${blade}</g></g></svg>`;
}

/* --------------------------------- Plates -------------------------------- */

/** The cartouche outline (also its clip path). */
const PLATE = "M18 4 H222 Q226 4 228 8 L236 22 Q238 30 238 38 Q238 46 236 54 L228 68 Q226 72 222 72 H18 Q14 72 12 68 L4 54 Q2 46 2 38 Q2 30 4 22 L12 8 Q14 4 18 4Z";

/**
 * An instrument's nameplate: one bolted cartouche of brushed brass, the name
 * engraved on its upper bevel and a recessed enamel slot along the bottom
 * for the sub-label (the HTML lays the text into those two places).
 */
export function plate(): string {
  const slot = "M44 44 H196 L204 54 L196 64 H44 L36 54Z";
  return `<svg viewBox="-18 0 276 76" class="art" aria-hidden="true" preserveAspectRatio="none"><g filter="url(#lb-sh2)">
${scroll(4, 38, 1.1)}<g transform="translate(240 0) scale(-1 1)">${scroll(4, 38, 1.1)}</g>
<path d="${PLATE}" fill="url(#lb-plateB)" stroke="${DARK}" stroke-width="1.4"/>
<path d="${PLATE}" fill="url(#lb-brush)" opacity=".6" style="mix-blend-mode:overlay"/>
<path d="M20 7.4 H220" stroke="#fff2c8" stroke-width="1.1" opacity=".7"/>
<path d="M22 11 H218 L226 24 V52 L218 66 H22 L14 52 V24Z" fill="none" stroke="#f0d79a" stroke-width="1" opacity=".35" transform="translate(0 1)"/>
<path d="M22 11 H218 L226 24 V52 L218 66 H22 L14 52 V24Z" fill="none" stroke="#4a3714" stroke-width="1.3"/>
<path d="${slot}" fill="#16130E"/>
<path d="M44 45.4 H196" stroke="#000" stroke-width="2.4" opacity=".85"/>
<path d="${slot}" fill="none" stroke="#2a1d0a" stroke-width="1.2"/>
<path d="M44 64.8 H196" stroke="#f0d79a" stroke-width="1" opacity=".5"/>
${rivet(22, 17, 2.4)}${rivet(218, 17, 2.4)}${rivet(22, 59, 2.4)}${rivet(218, 59, 2.4)}
<g clip-path="url(#lb-plateclip)"><rect class="sheen" x="-120" y="0" width="70" height="76" fill="url(#lb-sheen)" transform="skewX(-20)"/></g>
</g></svg>`;
}

/** A small chamfered header plaque (card titles, the talk plaque). */
export function plaque(w = 260, h = 44): string {
  const c = h / 2;
  const d = `M${c} 2 H${w - c} L${w - 3} ${c} L${w - c} ${h - 2} H${c} L3 ${c}Z`;
  return `<svg viewBox="-16 0 ${w + 32} ${h}" class="art" aria-hidden="true" preserveAspectRatio="none"><g filter="url(#lb-sh2)">
${scroll(4, c, h / 50)}<g transform="translate(${w} 0) scale(-1 1)">${scroll(4, c, h / 50)}</g>
<path d="${d}" fill="url(#lb-plate)" stroke="${DARK}" stroke-width="1.4"/>
<path d="${d}" fill="url(#lb-brush)" opacity=".5" style="mix-blend-mode:overlay"/>
<path d="M${c + 6} 7 H${w - c - 6} L${w - 10} ${c} L${w - c - 6} ${h - 7} H${c + 6} L10 ${c}Z" fill="#1b140c" fill-opacity=".86" stroke="#f0d79a" stroke-opacity=".45" stroke-width="1"/>
<path d="M${c} 4 H${w - c}" stroke="#fff2c8" stroke-width=".9" opacity=".55"/>
</g></svg>`;
}

/** The recessed resource trough (capsule) with a fill level (0-1) and a star stud. */
export function trough(level: number | null, fill = "url(#lb-vigor)"): string {
  const w = 134 * Math.max(0, Math.min(1, level ?? 0));
  return `<svg viewBox="0 0 180 40" class="art" aria-hidden="true" preserveAspectRatio="none">
<path d="M20 4 H158 A16 16 0 0 1 158 36 H20 A16 16 0 0 1 20 4Z" fill="#0b0907" fill-opacity=".9" stroke="${DARK}" stroke-width="3"/>
<path d="M20 4 H158 A16 16 0 0 1 158 36 H20 A16 16 0 0 1 20 4Z" fill="url(#lb-hide)" fill-opacity=".35" stroke="url(#lb-brass)" stroke-width="1.8"/>
${level != null ? `<g clip-path="url(#lb-troughclip)"><rect x="22" y="9" width="${f(w)}" height="22" fill="${fill}" opacity=".55"/><rect x="22" y="9" width="${f(w)}" height="3" fill="#fff" opacity=".25"/></g>` : ""}
<path d="M22 9 H156 A11 11 0 0 1 156 31 H22 A11 11 0 0 1 22 9Z" fill="none" stroke="#000" stroke-opacity=".7" stroke-width="2"/>
<path d="M24 32.5 H154" stroke="#f5e1a4" stroke-opacity=".22" stroke-width="1"/>
<path d="${star4(165, 20, 6)}" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".6"/>
</svg>`;
}

/* --------------------------------- Badge --------------------------------- */

/** The place medallion: a double-bordered brass diamond around the place painting, compass watermark on top. */
export function medallion(art: string | null): string {
  const tick = `<path d="M45 0 L49 6 L45 10 L41 6Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".6"/>`;
  return `<svg viewBox="0 0 90 90" class="art" aria-hidden="true"><g filter="url(#lb-sh2)">
<path d="M45 3 L87 45 L45 87 L3 45Z" fill="#120e0a" stroke="${DARK}" stroke-width="5"/>
<path d="M45 3 L87 45 L45 87 L3 45Z" fill="none" stroke="url(#lb-brass)" stroke-width="3.4"/>
<g clip-path="url(#lb-diaclip)"><rect x="0" y="0" width="90" height="90" fill="url(#lb-slate)"/>${art ? `<image href="${art}" x="0" y="0" width="90" height="90" preserveAspectRatio="xMidYMid slice"/>` : ""}<rect width="90" height="90" fill="url(#lb-vig)"/></g>
<path d="${raysPath(45, 45, 3, 26, 8, 0.55)}" fill="none" stroke="#f3e8d2" stroke-opacity=".45" stroke-width=".8"/>
<circle cx="45" cy="45" r="13" fill="none" stroke="#f3e8d2" stroke-opacity=".35" stroke-width=".7"/>
<path d="M45 10 L80 45 L45 80 L10 45Z" fill="none" stroke="#c8aa6e" stroke-width="1.6"/>
<path d="M45 13.5 L76.5 45 L45 76.5 L13.5 45Z" fill="none" stroke="#5c4012" stroke-width=".8"/>
${tick}<g transform="rotate(90 45 45)">${tick}</g><g transform="rotate(180 45 45)">${tick}</g><g transform="rotate(270 45 45)">${tick}</g>
</g></svg>`;
}

/** The small bronze shield carrying the day number. */
export function shield(): string {
  return `<svg viewBox="0 0 34 40" class="art" aria-hidden="true"><g filter="url(#lb-sh2)">
<path d="M3 4 H31 V20 Q31 32 17 38 Q3 32 3 20Z" fill="url(#lb-bronze)" stroke="${DARK}" stroke-width="2.4"/>
<path d="M3 4 H31 V20 Q31 32 17 38 Q3 32 3 20Z" fill="none" stroke="url(#lb-brass)" stroke-width="1.6"/>
<path d="M6.5 7 H27.5 V20 Q27.5 29.5 17 34.5 Q6.5 29.5 6.5 20Z" fill="none" stroke="#c8aa6e" stroke-opacity=".5" stroke-width=".7"/>
</g></svg>`;
}

/** A wax seal (NEW). */
export function seal(): string {
  return `<svg viewBox="0 0 50 50" class="art" aria-hidden="true"><g filter="url(#lb-sh2)">
<path d="M25 2 Q31 4 34 3 Q38 7 43 9 Q44 14 48 18 Q46 24 48 30 Q44 35 43 40 Q37 42 33 47 Q28 45 22 48 Q18 44 12 43 Q9 38 4 35 Q6 29 2 24 Q6 19 5 13 Q10 10 13 5 Q19 6 25 2Z" fill="url(#lb-seal)" stroke="#3a0a06" stroke-width=".8"/>
<circle cx="25" cy="25" r="15" fill="none" stroke="#4a0d08" stroke-width="1.6"/><circle cx="25" cy="25" r="15" fill="none" stroke="#e07a6c" stroke-opacity=".35" stroke-width=".7" transform="translate(.6 .6)"/>
</g></svg>`;
}

/* --------------------------------- Locket -------------------------------- */

/** A pocket-watch locket holding a head-crop of a person's art (or an engraved initial). */
export function locket(art: string | null, initial: string, active: boolean): string {
  let knurl = "";
  for (let i = 0; i < 56; i++) {
    const a = (i / 56) * Math.PI * 2;
    knurl += `<line x1="${f(50 + Math.cos(a) * 41.5)}" y1="${f(68 + Math.sin(a) * 41.5)}" x2="${f(50 + Math.cos(a) * 45.5)}" y2="${f(68 + Math.sin(a) * 45.5)}" stroke="#3a2808" stroke-width=".7" opacity=".55"/>`;
  }
  return `<svg viewBox="0 0 100 120" class="art" aria-hidden="true"><g filter="url(#lb-sh2)">
${active ? `<circle cx="50" cy="68" r="51" fill="none" stroke="#e6c687" stroke-width="1.5" stroke-dasharray="2.5 4.5" class="spin2"/>` : ""}
<ellipse cx="50" cy="9" rx="8.5" ry="7" fill="none" stroke="${DARK}" stroke-width="5"/><ellipse cx="50" cy="9" rx="8.5" ry="7" fill="none" stroke="url(#lb-brass)" stroke-width="3"/>
<rect x="43.5" y="15" width="13" height="9" rx="2" fill="url(#lb-cylH)" stroke="${DARK}" stroke-width=".7"/>
<path d="M46 16v7M49 16v7M52 16v7M55 16v7" stroke="#5c4012" stroke-width=".6"/>
<circle cx="50" cy="68" r="37" fill="url(#lb-slate)"/>
${art ? `<image href="${art}" x="-30" y="22" width="160" height="256" preserveAspectRatio="xMidYMin slice" clip-path="url(#lb-lockclip)"/>` : `<text x="50" y="70" text-anchor="middle" dominant-baseline="central" font-family="Gambit Cinzel, serif" font-weight="800" font-size="34" fill="#c8aa6e" opacity=".8">${initial}</text>`}
<circle cx="50" cy="68" r="37" fill="url(#lb-vig)"/>
<circle cx="50" cy="68" r="43.5" fill="none" stroke="${DARK}" stroke-width="10"/>
<circle cx="50" cy="68" r="43.5" fill="none" stroke="url(#lb-brass)" stroke-width="7"/>${knurl}
<circle cx="50" cy="68" r="38.6" fill="none" stroke="#f5e1a4" stroke-width="1" opacity=".7"/>
<circle cx="50" cy="68" r="37.4" fill="none" stroke="#2a1c08" stroke-width="1.2"/>
<path d="M22 56 A31 31 0 0 1 60 38" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="5" stroke-linecap="round"/>
</g></svg>`;
}

/* ------------------------------- Place cards ----------------------------- */

const corner = (x: number, y: number, sx: number, sy: number) =>
  `<path transform="translate(${x} ${y}) scale(${sx} ${sy})" d="M0 0 L30 0 L0 30Z" fill="#17110a" stroke="#c8aa6e" stroke-width=".8" stroke-opacity=".7"/>`;

/**
 * A crimson-and-ink woodcut for a fight: crossed sabres behind a skull
 * crest, a slash of light, hatching and embers. Drawn into the given box.
 */
function combatScene(x: number, y: number, w: number, h: number): string {
  let hatch = "";
  for (let i = -20; i < 64; i++) hatch += `M${i * 7} 200 L${i * 7 + 120} 0 `;
  let embers = "";
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    const ex = f(r() * 380);
    const ey = f(40 + r() * 160);
    embers += `<circle cx="${ex}" cy="${ey}" r="${f(0.8 + r() * 2.2)}" fill="${r() > 0.5 ? "#ffcf7a" : "#ff7a3a"}" opacity="${f(0.5 + r() * 0.5)}"/>`;
  }
  const blade = `<path d="M10 54 L46 10 L50 8 L48 13 L13 57Z" fill="#efe6d2" stroke="#1a0604" stroke-width=".8"/><path d="M12 56 L48 11" stroke="#9a907c" stroke-width=".6"/><path d="M6 48 Q12 52 17 60 L14 61 Q9 55 4 51Z" fill="url(#lb-brass)" stroke="#1a0604" stroke-width=".7"/><path d="M8 57 L2 63" stroke="#3a120a" stroke-width="3.5" stroke-linecap="round"/><circle cx="1.5" cy="63.5" r="2.4" fill="url(#lb-coin)"/>`;
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 380 200" preserveAspectRatio="xMidYMid slice" overflow="hidden">
  <rect width="380" height="200" fill="url(#lb-crim)"/>
  <path d="${raysPath(190, 104, 34, 260, 28, 0.55)}" fill="#f0a060" opacity=".16"/>
  <path d="M40 200 L118 200 L340 0 L286 0Z" fill="url(#lb-slash)" opacity=".55"/>
  <path d="${hatch}" stroke="#0a0302" stroke-width="1.3" opacity=".32"/>
  <path d="M0 160 Q60 140 120 158 T240 150 T380 156 V200 H0Z" fill="#120403" opacity=".85"/>
  <path d="M0 176 Q80 160 170 176 T380 170 V200 H0Z" fill="#070101"/>
  <g transform="translate(120 34) scale(2.2)">${blade}<g transform="translate(64 0) scale(-1 1)">${blade}</g></g>
  <g transform="translate(190 102)">
    <path d="M-34 -42 H34 V4 Q34 34 0 48 Q-34 34 -34 4Z" fill="url(#lb-brass)" stroke="#1a0604" stroke-width="1.4"/>
    <path d="M-28 -36 H28 V3 Q28 29 0 41 Q-28 29 -28 3Z" fill="#2a0906" stroke="#5c4012" stroke-width="1"/>
    <path d="M-28 -36 H28 V3 Q28 29 0 41 Q-28 29 -28 3Z" fill="url(#lb-hide)" opacity=".25"/>
    <path d="M-15 -8 Q-16 -26 0 -27 Q16 -26 15 -8 Q15 0 9 3 V10 H-9 V3 Q-15 0 -15 -8Z" fill="#efe2c4" stroke="#1a0604" stroke-width="1"/>
    <ellipse cx="-6.5" cy="-11" rx="4.4" ry="5" fill="#1a0604"/><ellipse cx="6.5" cy="-11" rx="4.4" ry="5" fill="#1a0604"/>
    <circle cx="-6" cy="-11" r="1.3" fill="#ff8a3a"/><circle cx="7" cy="-11" r="1.3" fill="#ff8a3a"/>
    <path d="M0 -4 L-2.6 1 H2.6Z" fill="#1a0604"/>
    <path d="M-7 4 V10 M-3.5 4 V10 M0 4 V10 M3.5 4 V10 M7 4 V10" stroke="#1a0604" stroke-width=".9"/>
    <path d="M-14 22 L14 30 M-14 30 L14 22" stroke="#efe2c4" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M-34 -42 H34" stroke="#fff2c4" stroke-width="1" opacity=".6"/>
  </g>
  <g filter="url(#lb-sh2)">${embers}</g>
  <rect width="380" height="200" fill="url(#lb-vig)"/>
</svg>`;
}

/** What fills a print: the given painting, or the fight woodcut when there is none. */
function printFill(art: string | null, x: number, y: number, w: number, h: number, extra = ""): string {
  return art
    ? `<image href="${art}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"${extra}/>`
    : `<g${extra}>${combatScene(x, y, w, h)}</g>`;
}

/** The tilted inner photograph: paper border, the painting, a tint, corner mounts. */
function photo(x: number, y: number, w: number, h: number, art: string | null, tilt: number, tint: string | null, label: string | null): string {
  const cx = x + w / 2;
  const cy = y + h / 2;
  return `<g transform="rotate(${tilt} ${cx} ${cy})">
  <rect x="${x + 6}" y="${y + 10}" width="${w}" height="${h}" fill="#000" opacity=".65" filter="url(#lb-blur3)"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#lb-paper)"/>
  <rect x="${x + 8}" y="${y + 8}" width="${w - 16}" height="${h - 16}" fill="#120e0a"/>
  ${printFill(art, x + 8, y + 8, w - 16, h - 16)}
  ${tint ? `<rect x="${x + 8}" y="${y + 8}" width="${w - 16}" height="${h - 16}" fill="${tint}" style="mix-blend-mode:multiply" opacity=".75"/>` : ""}
  <rect x="${x + 8}" y="${y + 8}" width="${w - 16}" height="${h - 16}" fill="url(#lb-vig)"/>
  ${label ? `<rect x="${x + 8}" y="${y + 8}" width="${w - 16}" height="26" fill="#0e0c0a" opacity=".78"/><text x="${cx}" y="${y + 22}" text-anchor="middle" dominant-baseline="central" font-family="Gambit Cinzel, serif" font-weight="800" font-size="12" letter-spacing="3" fill="#e6c687">${label}</text>` : ""}
  ${corner(x, y, 1, 1)}${corner(x + w, y, -1, 1)}${corner(x, y + h, 1, -1)}${corner(x + w, y + h, -1, -1)}
</g>`;
}

/** A sepia-toned print fanned out behind the main photograph, as in a dossier. */
function photoBack(x: number, y: number, w: number, h: number, art: string | null, tilt: number): string {
  return `<g transform="rotate(${tilt} ${x + w / 2} ${y + h / 2})">
  <rect x="${x + 4}" y="${y + 8}" width="${w}" height="${h}" fill="#000" opacity=".55" filter="url(#lb-blur3)"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#lb-paper)"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#5a3c18" opacity=".35"/>
  ${printFill(art, x + 7, y + 7, w - 14, h - 14, ' filter="url(#lb-sepia)" opacity=".85"')}
  <rect x="${x + 7}" y="${y + 7}" width="${w - 14}" height="${h - 14}" fill="url(#lb-vig)"/>
</g>`;
}

/** A toothed brass rack running down the card's left rail. */
function rack(x: number, y0: number, y1: number): string {
  let d = `M${x - 12} ${y0} H${x}`;
  for (let y = y0; y + 9 <= y1; y += 9) d += ` L${x} ${y + 1} L${x + 4} ${y + 3} L${x + 4} ${y + 6} L${x} ${y + 8}`;
  d += ` L${x} ${y1} H${x - 12}Z`;
  return `<path d="${d}" fill="url(#lb-brassH)" stroke="${DARK}" stroke-width="1"/><path d="M${x - 9} ${y0 + 4} V${y1 - 4}" stroke="#fff2c8" stroke-width=".8" opacity=".55"/>`;
}

/** A spoked gear with a riveted hub. */
function wheel(cx: number, cy: number, r: number, teeth: number): string {
  const spokes = [0, 60, 120].map((a) => `<path d="M${f(cx + Math.cos((a * Math.PI) / 180) * r * 0.62)} ${f(cy + Math.sin((a * Math.PI) / 180) * r * 0.62)} L${f(cx - Math.cos((a * Math.PI) / 180) * r * 0.62)} ${f(cy - Math.sin((a * Math.PI) / 180) * r * 0.62)}" stroke="#5c4012" stroke-width="${f(r * 0.12)}"/>`).join("");
  return `<path d="${gearPath(cx, cy, r, teeth, r * 0.2)}" fill="url(#lb-brass)" stroke="${DARK}" stroke-width="1.1"/><circle cx="${cx}" cy="${cy}" r="${f(r * 0.66)}" fill="#1b140c" fill-opacity=".55" stroke="#5c4012" stroke-width="${f(r * 0.1)}"/>${spokes}${rivet(cx, cy, f(r * 0.2))}`;
}

/**
 * The wide card: a brass housing whose left rail carries a gear rack, two
 * sepia prints fanned behind the main tilted photograph, a vigor gauge, and
 * a parchment ribbon wrapped over the top bar (the HTML writes its title).
 */
export function wideCard(art: string | null, danger: boolean, gauge: number | null): string {
  const back = "M14 0 H466 L480 14 V286 L466 300 H14 L0 286 V14Z";
  const gw = 170 * Math.max(0, Math.min(1, gauge ?? 0));
  return `<svg viewBox="-40 -34 560 370" class="art" aria-hidden="true">
<g filter="url(#lb-sh)">
  <path d="${back}" fill="url(#lb-plate)" stroke="${DARK}" stroke-width="2.4"/>
  <path d="${back}" fill="url(#lb-brush)" opacity=".5" style="mix-blend-mode:overlay"/>
  <path d="M16 3.5 H464" stroke="#fff2c8" stroke-width="1.2" opacity=".55"/>
  <path d="M22 13 H458 L467 22 V278 L458 287 H22 L13 278 V22Z" fill="url(#lb-obs)" stroke="#2a1c08" stroke-width="2"/>
  <path d="M22 13 H458 L467 22 V278 L458 287 H22 L13 278 V22Z" fill="url(#lb-hide)" opacity=".4"/>
  <path d="M27 19 H453 L461 27 V273 L453 281 H27 L19 273 V27Z" fill="none" stroke="#c8aa6e" stroke-width=".9" opacity=".55"/>
  ${rivet(471, 9, 3)}${rivet(471, 291, 3)}${rivet(240, 294, 2.4)}
  ${photoBack(58, 40, 368, 196, art, 3.6)}${photoBack(40, 48, 376, 194, art, -5)}
  ${photo(46, 34, 388, 206, art, -1.5, danger ? "#9a1c12" : null, danger ? "DANGER &#183; I" : null)}
  ${gauge != null ? `<path d="M266 255 H446 A10 10 0 0 1 446 275 H266 A10 10 0 0 1 266 255Z" fill="#0b0907" stroke="url(#lb-brass)" stroke-width="1.6"/><rect x="268" y="258" width="${f(gw)}" height="14" rx="7" fill="url(#lb-vigor)" opacity=".85"/><rect x="270" y="259" width="${f(Math.max(0, gw - 4))}" height="3" rx="1.5" fill="#fff" opacity=".3"/>` : ""}
  ${chain(394, 298, 420, 336, 470, 292, 16, 3.6)}
  ${rack(-4, 10, 290)}
  ${wheel(14, 92, 25, 14)}${wheel(30, 140, 14, 9)}${wheel(8, 236, 32, 16)}
  <path d="M96 -16 H124 V22 L110 14 L96 22Z" fill="#b39a6c" stroke="#3a2c14" stroke-width=".9"/>
  <path d="M384 -16 H356 V22 L370 14 L384 22Z" fill="#b39a6c" stroke="#3a2c14" stroke-width=".9"/>
  <path d="M116 -14 L124 -16 L124 -6Z M364 -14 L356 -16 L356 -6Z" fill="#6b5430"/>
  <path d="M116 -28 Q240 -36 364 -28 L364 10 Q240 2 116 10Z" fill="#D9C296" stroke="#3a2c14" stroke-width="1.1"/>
  <path d="M116 -28 Q240 -36 364 -28 L364 10 Q240 2 116 10Z" fill="url(#lb-paper)" opacity=".55" style="mix-blend-mode:multiply"/>
  <path d="M122 -23 Q240 -31 358 -23 M122 5 Q240 -3 358 5" fill="none" stroke="#8a7448" stroke-width=".9"/>
  <path d="M118 -27 Q240 -35 362 -27" fill="none" stroke="#fff6dc" stroke-width=".8" opacity=".8"/>
</g>
</svg>`;
}

/** An acanthus corner bracket, drawn for the top-left; it reaches outside the card. */
const acanthus = `<path d="M-14 -14 C6 -18 26 -8 32 8 C24 2 14 2 8 8 C10 16 4 26 -8 32 C0 20 -4 6 -14 -14Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width="1"/>
<path d="M-8 -8 C6 -8 18 0 24 6 M-8 -8 C-6 6 -2 16 -4 24" fill="none" stroke="#5c4012" stroke-width=".9"/>
<path d="M30 6 c8 -4 14 4 8 10 c-4 4 -9 0 -6 -4" fill="none" stroke="${DARK}" stroke-width="3.6"/><path d="M30 6 c8 -4 14 4 8 10 c-4 4 -9 0 -6 -4" fill="none" stroke="url(#lb-brass)" stroke-width="2"/>
<path d="M6 30 c-4 8 4 14 10 8 c4 -4 0 -9 -4 -6" fill="none" stroke="${DARK}" stroke-width="3.6"/><path d="M6 30 c-4 8 4 14 10 8 c4 -4 0 -9 -4 -6" fill="none" stroke="url(#lb-brass)" stroke-width="2"/>
<circle cx="-4" cy="-4" r="4.6" fill="url(#lb-coin)" stroke="${DARK}" stroke-width=".8"/>`;

/**
 * The tall travel card: filigree frame with crests, acanthus corners that
 * break its silhouette, a die-cut brass crest badge over the painting, and
 * side bosses that the HTML's cycling arrows sit on.
 */
export function tallCard(art: string, ribbon: string, arrows: boolean): string {
  const back = "M0 30 Q0 0 30 0 H106 Q140 -22 174 0 H250 Q280 0 280 30 V370 Q280 400 250 400 H174 Q140 422 106 400 H30 Q0 400 0 370Z";
  const crest = `<path d="M140 -14 C120 -14 112 -2 100 4 C112 4 122 8 140 6 C158 8 168 4 180 4 C168 -2 160 -14 140 -14Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".8"/><circle cx="140" cy="-6" r="6" fill="url(#lb-seal)" stroke="${DARK}" stroke-width=".8"/><circle cx="138" cy="-8" r="1.6" fill="#fff" opacity=".6"/>`;
  const boss = (x: number) => `<circle cx="${x}" cy="200" r="20" fill="${DARK}"/><circle cx="${x}" cy="200" r="18" fill="url(#lb-brass)"/><circle cx="${x}" cy="200" r="13" fill="#1b140c" stroke="#c8aa6e" stroke-width=".8"/>`;
  return `<svg viewBox="-36 -36 352 476" class="art" aria-hidden="true">
<g filter="url(#lb-sh)">
  <path d="${back}" fill="url(#lb-plate)" stroke="${DARK}" stroke-width="2.4"/>
  <path d="${back}" fill="url(#lb-brush)" opacity=".5" style="mix-blend-mode:overlay"/>
  <path d="M16 18 Q16 14 22 14 H258 Q264 14 264 20 V380 Q264 386 258 386 H22 Q16 386 16 380Z" fill="url(#lb-obs)" stroke="#2a1c08" stroke-width="2"/>
  <path d="M16 18 Q16 14 22 14 H258 Q264 14 264 20 V380 Q264 386 258 386 H22 Q16 386 16 380Z" fill="url(#lb-hide)" opacity=".4"/>
  <path d="M22 22 H258 V378 H22Z" fill="none" stroke="#c8aa6e" stroke-width=".9" opacity=".5"/>
  ${crest}<g transform="translate(0 400) scale(1 -1)">${crest}</g>
  ${scroll(100, 4, 1.1)}<g transform="translate(280 0) scale(-1 1)">${scroll(100, 4, 1.1)}</g>
  ${photo(28, 30, 224, 292, art, 1.8, null, null)}
  ${arrows ? boss(-2) + boss(282) : rivet(8, 200, 3) + rivet(272, 200, 3)}
  <g transform="translate(-2 -2) scale(1.4)">${acanthus}</g><g transform="translate(282 -2) scale(-1.4 1.4)">${acanthus}</g>
  <g transform="translate(-2 402) scale(1.4 -1.4)">${acanthus}</g><g transform="translate(282 402) scale(-1.4 -1.4)">${acanthus}</g>
  <g transform="translate(36 40)">
    <path d="${raysPath(0, 0, 17, 34, 16)}" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".7"/>
    <circle r="21" fill="${DARK}"/><circle r="19.5" fill="url(#lb-brass)"/><circle r="15" fill="#1b140c" stroke="#f5e1a4" stroke-opacity=".5" stroke-width=".8"/>
    <path d="${raysPath(0, 0, 2.5, 12, 8, 0.55)}" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".4"/>
    <path d="M-30 26 H30 L25 34 L30 42 H-30 L-25 34Z" fill="url(#lb-bronze)" stroke="url(#lb-brass)" stroke-width="1.6"/>
    <text x="0" y="34.5" text-anchor="middle" dominant-baseline="central" font-family="Gambit Cinzel, serif" font-weight="800" font-size="8.5" letter-spacing="1.5" fill="#f3e8d2">${ribbon}</text>
  </g>
</g>
</svg>`;
}

/** A brass scroll that curls into an arrowhead (the travel card's cyclers); it points left. */
export function sideArrow(): string {
  return `<svg viewBox="0 0 44 56" class="art" aria-hidden="true"><g filter="url(#lb-sh2)">
<path d="M3 28 L22 10 L22 20 Q34 20 38 9 Q42 31 22 36 L22 46Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width="1.3"/>
<path d="M8 27 L20 16" stroke="#fff6d6" stroke-width="1" opacity=".7"/>
<path d="M38 9 c3 -5 -4 -8 -6 -3" fill="none" stroke="url(#lb-brass)" stroke-width="2"/>
</g></svg>`;
}

/** A chart frame for the frontier honeycomb: a brass-bound parchment map. */
export function chartFrame(): string {
  return `<svg viewBox="0 0 420 340" class="art" aria-hidden="true" preserveAspectRatio="none"><g filter="url(#lb-sh)">
<path d="M12 0 H408 L420 12 V328 L408 340 H12 L0 328 V12Z" fill="url(#lb-plate)" stroke="${DARK}" stroke-width="2.4"/>
<path d="M12 0 H408 L420 12 V328 L408 340 H12 L0 328 V12Z" fill="url(#lb-brush)" opacity=".5" style="mix-blend-mode:overlay"/>
<rect x="14" y="14" width="392" height="312" fill="url(#lb-paper)" stroke="#2a1c08" stroke-width="2"/>
<rect x="14" y="14" width="392" height="312" fill="url(#lb-vig)" opacity=".55"/>
<rect x="20" y="20" width="380" height="300" fill="none" stroke="#6a4f22" stroke-width="1"/>
${rivet(7, 7, 3)}${rivet(413, 7, 3)}${rivet(7, 333, 3)}${rivet(413, 333, 3)}
</g></svg>`;
}

/* ------------------------------ Narration -------------------------------- */

/**
 * The gilded dossier banner: baroque molding with acanthus corners, and on
 * its left an engraved gold-on-ink tarot plate (the all-seeing eye under a
 * crescent, over harbour waves) instead of a copy of the place painting.
 */
export function bannerFrame(): string {
  const leaf = `<path d="M-10 -10 C8 -14 26 -6 32 8 C24 2 14 2 8 8 C10 16 4 26 -6 32 C0 20 -2 8 -10 -10Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width="1"/>
<path d="M-6 -6 C6 -6 18 0 24 6 M-6 -6 C-4 6 -2 16 -4 24" fill="none" stroke="#5c4012" stroke-width=".9"/>
<path d="M30 4 c6 -2 10 4 6 8 c-3 3 -7 0 -5 -3" fill="none" stroke="url(#lb-brass)" stroke-width="2"/>
<circle cx="-2" cy="-2" r="4.2" fill="url(#lb-coin)" stroke="${DARK}" stroke-width=".8"/>`;
  let beads = "";
  for (let x = 20; x <= 480; x += 9) beads += `<circle cx="${x}" cy="11.5" r="1.05" fill="#c8aa6e"/><circle cx="${x}" cy="148.5" r="1.05" fill="#c8aa6e"/>`;
  let stars = "";
  for (const [x, y, r] of [[34, 30, 1.2], [100, 34, 1], [92, 58, 0.8], [40, 64, 0.9], [28, 92, 0.7], [108, 96, 0.8]] as const) stars += `<circle cx="${x}" cy="${y}" r="${r}" fill="#e6c687"/>`;
  const ink = `fill="none" stroke="#d8b467" stroke-linecap="round"`;
  return `<svg viewBox="-14 -14 528 188" class="art" aria-hidden="true" preserveAspectRatio="none">
<g filter="url(#lb-sh)">
<rect x="6" y="6" width="488" height="148" fill="#0f0d0b"/>
<rect x="6" y="6" width="488" height="148" fill="url(#lb-hide)" opacity=".6"/>
<rect x="6" y="6" width="488" height="148" fill="url(#lb-vig)" opacity=".6"/>
<g>
  <rect x="18" y="17" width="100" height="126" fill="#0b0907" stroke="${DARK}" stroke-width="3"/>
  <rect x="18" y="17" width="100" height="126" fill="none" stroke="url(#lb-brass)" stroke-width="2"/>
  <rect x="23" y="22" width="90" height="116" fill="none" stroke="#c8aa6e" stroke-width=".7" opacity=".55"/>
  <path d="${raysPath(68, 70, 16, 44, 32, 0.55)}" ${ink} stroke-width=".5" opacity=".55"/>
  <circle cx="68" cy="70" r="15" ${ink} stroke-width="1"/>
  <path d="M52 70 Q68 56 84 70 Q68 84 52 70Z" fill="#0b0907" stroke="#e6c687" stroke-width="1.3"/>
  <circle cx="68" cy="70" r="5.5" fill="url(#lb-coin)"/><circle cx="68" cy="70" r="2.2" fill="#0b0907"/>
  <path d="M60 40 A9 9 0 1 0 74 32 A7 7 0 1 1 60 40Z" fill="#e6c687" opacity=".9"/>
  ${stars}
  <path d="M28 108 q6 -4 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 M28 116 q6 -4 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 M28 124 q6 -4 12 0 t12 0 t12 0 t12 0 t12 0 t12 0" ${ink} stroke-width=".8" opacity=".7"/>
  <path d="M68 92 L64 106 H72Z" fill="#d8b467" opacity=".8"/>
  <text x="68" y="132.5" text-anchor="middle" dominant-baseline="central" font-family="Gambit Cinzel, serif" font-weight="800" font-size="7" letter-spacing="2" fill="#c8aa6e">THE SCENE</text>
</g>
<rect x="2.5" y="2.5" width="495" height="155" fill="none" stroke="${DARK}" stroke-width="10"/>
<rect x="2.5" y="2.5" width="495" height="155" fill="none" stroke="url(#lb-brass)" stroke-width="6.5"/>
<rect x="-1" y="-1" width="502" height="162" fill="none" stroke="#f5e1a4" stroke-width=".8" opacity=".45"/>
<rect x="7.5" y="7.5" width="485" height="145" fill="none" stroke="#5c4012" stroke-width="1.6"/>
${beads}
${leaf}<g transform="translate(500 0) scale(-1 1)">${leaf}</g><g transform="translate(0 160) scale(1 -1)">${leaf}</g><g transform="translate(500 160) scale(-1 -1)">${leaf}</g>
</g></svg>`;
}

/** The log ticker's dark-bronze trough. */
export function tickerFrame(): string {
  return `<svg viewBox="0 0 500 40" class="art" aria-hidden="true" preserveAspectRatio="none">
<path d="M10 3 H490 L497 10 V30 L490 37 H10 L3 30 V10Z" fill="#0b0907" fill-opacity=".86" stroke="${DARK}" stroke-width="3"/>
<path d="M10 3 H490 L497 10 V30 L490 37 H10 L3 30 V10Z" fill="none" stroke="#8a6d3b" stroke-width="1.3"/>
<path d="M12 7 H488" stroke="#000" stroke-opacity=".7" stroke-width="2"/>
<path d="M12 33.5 H488" stroke="#c8aa6e" stroke-opacity=".25" stroke-width="1"/>
</svg>`;
}

/* ------------------------------- Delve dial ------------------------------ */

/**
 * The delve orienter's body: a knurled brass bezel, a pierced openwork ring,
 * a leather dial with degree marks and a slowly turning compass rose.
 */
export function dial(): string {
  let ticks = "";
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const l = i % 9 === 0 ? 10 : 5;
    ticks += `<line x1="${f(150 + Math.cos(a) * 122)}" y1="${f(150 + Math.sin(a) * 122)}" x2="${f(150 + Math.cos(a) * (122 - l))}" y2="${f(150 + Math.sin(a) * (122 - l))}" stroke="#d8b467" stroke-width="${i % 9 ? 0.8 : 1.6}"/>`;
  }
  let knurl = "";
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    knurl += `<line x1="${f(150 + Math.cos(a) * 141)}" y1="${f(150 + Math.sin(a) * 141)}" x2="${f(150 + Math.cos(a) * 147)}" y2="${f(150 + Math.sin(a) * 147)}" stroke="#3a2808" stroke-width=".9" opacity=".6"/>`;
  }
  let holes = "";
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.PI / 16;
    const x = 150 + Math.cos(a) * 92;
    const y = 150 + Math.sin(a) * 92;
    holes += `<circle cx="${f(x)}" cy="${f(y)}" r="5.2" fill="#070504" stroke="url(#lb-brass)" stroke-width="1.6"/>`;
  }
  return `<svg viewBox="0 0 300 300" class="art" aria-hidden="true"><g filter="url(#lb-sh)">
<circle cx="150" cy="150" r="141" fill="none" stroke="${DARK}" stroke-width="20"/>
<circle cx="150" cy="150" r="141" fill="none" stroke="url(#lb-brass)" stroke-width="14"/>
<circle cx="150" cy="150" r="141" fill="none" stroke="url(#lb-brush)" stroke-width="14" opacity=".45" style="mix-blend-mode:overlay"/>${knurl}
<circle cx="150" cy="150" r="148.5" fill="none" stroke="#fff6d6" stroke-width=".9" opacity=".55"/>
<circle cx="150" cy="150" r="132" fill="url(#lb-obs)"/>
<circle cx="150" cy="150" r="132" fill="url(#lb-hide)" opacity=".5"/>
${ticks}
<circle cx="150" cy="150" r="104" fill="none" stroke="url(#lb-brass)" stroke-width="5"/>
<circle cx="150" cy="150" r="80" fill="none" stroke="url(#lb-brass)" stroke-width="3"/>${holes}
<ellipse cx="150" cy="150" rx="100" ry="58" transform="rotate(24 150 150)" fill="none" stroke="#c8aa6e" stroke-width="1" stroke-dasharray="6 4" opacity=".7"/>
<g class="spin" style="transform-origin:150px 150px"><path d="${raysPath(150, 150, 12, 76, 16, 0.55)}" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".8" opacity=".85"/></g>
<circle cx="150" cy="150" r="30" fill="#120e0a" stroke="url(#lb-brass)" stroke-width="3"/>
${[45, 135, 225, 315].map((d) => `<g transform="rotate(${d} 150 150)">${rivet(150, 22, 4)}</g>`).join("")}
</g>
<path d="${star4(66, 52, 10, 0.1)}" fill="#fff" class="flare"/>
</svg>`;
}

/** The round brass rim around the delve automap. */
export function chartRing(): string {
  let ticks = "";
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    ticks += `<line x1="${f(150 + Math.cos(a) * 118)}" y1="${f(150 + Math.sin(a) * 118)}" x2="${f(150 + Math.cos(a) * 124)}" y2="${f(150 + Math.sin(a) * 124)}" stroke="#2a1c08" stroke-width="1"/>`;
  }
  return `<svg viewBox="0 0 300 300" class="art" aria-hidden="true"><g filter="url(#lb-sh)">
<circle cx="150" cy="150" r="112" fill="url(#lb-vig)" opacity=".7"/>
<circle cx="150" cy="150" r="128" fill="none" stroke="${DARK}" stroke-width="30"/>
<circle cx="150" cy="150" r="128" fill="none" stroke="url(#lb-brass)" stroke-width="24"/>${ticks}
<circle cx="150" cy="150" r="114" fill="none" stroke="#2a1c08" stroke-width="3"/>
<circle cx="150" cy="150" r="141" fill="none" stroke="#f5e1a4" stroke-width="1" opacity=".5"/>
${[0, 90, 180, 270].map((d) => `<g transform="rotate(${d} 150 150)"><path d="${star4(150, 10, 12)}" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".8"/></g>`).join("")}
</g></svg>`;
}

/** A brass arrow lever for one delve move (pointing up; rotate it). */
export function arrow(): string {
  return `<svg viewBox="0 0 60 60" class="art" aria-hidden="true"><g filter="url(#lb-sh2)">
<path d="M30 4 L54 34 L40 34 L40 56 L20 56 L20 34 L6 34Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width="1.6"/>
<path d="M30 11 L46 30 L35 30 L35 51 L25 51 L25 30 L14 30Z" fill="#1b140c" fill-opacity=".55"/>
<path d="M30 6 L52 33" stroke="#fff2c4" stroke-width="1" opacity=".6"/>
</g></svg>`;
}

/** A hooded lantern (search in a delve). */
export function lantern(): string {
  return `<svg viewBox="0 0 60 70" class="art" aria-hidden="true"><g filter="url(#lb-sh2)">
<circle cx="30" cy="40" r="20" fill="url(#lb-ember)" opacity=".7" filter="url(#lb-glow)" class="pulse"/>
<ellipse cx="30" cy="8" rx="7" ry="6" fill="none" stroke="url(#lb-brass)" stroke-width="2.4"/>
<path d="M16 22 L44 22 L38 14 L22 14Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".9"/>
<rect x="18" y="22" width="24" height="32" fill="#ffd890" fill-opacity=".55" stroke="url(#lb-brass)" stroke-width="2"/>
<path d="M30 30 Q36 38 30 46 Q24 38 30 30Z" fill="url(#lb-flameG)"/>
<path d="M24 22 V54 M36 22 V54" stroke="#6a4a14" stroke-width="1.4"/>
<path d="M14 54 H46 L42 62 H18Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".9"/>
</g></svg>`;
}

/* --------------------------- Lead staging pieces -------------------------- */

/**
 * An open astrolabe halo that stands behind the lead's head: thin rings,
 * dashed orbits tilted off-axis, a degree ring and a compass burst at the
 * apex. Open line-work, never a closed frame.
 */
export function halo(): string {
  let ticks = "";
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const l = i % 6 === 0 ? 10 : 4;
    ticks += `<line x1="${f(240 + Math.cos(a) * 214)}" y1="${f(240 + Math.sin(a) * 214)}" x2="${f(240 + Math.cos(a) * (214 - l))}" y2="${f(240 + Math.sin(a) * (214 - l))}" stroke="#d8b467" stroke-width="${i % 6 ? 0.7 : 1.4}"/>`;
  }
  let dots = "";
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.26;
    dots += `<circle cx="${f(240 + Math.cos(a) * 190)}" cy="${f(240 + Math.sin(a) * 190)}" r="${i % 3 ? 1.6 : 3}" fill="${i % 3 ? "#d8b467" : "url(#lb-coin)"}"/>`;
  }
  return `<svg viewBox="0 0 480 480" class="art" aria-hidden="true">
<circle cx="240" cy="240" r="170" fill="url(#lb-ember)" opacity=".16"/>
<g class="hl1">
  <circle cx="240" cy="240" r="226" fill="none" stroke="url(#lb-brass)" stroke-width="1.6"/>
  <circle cx="240" cy="240" r="219" fill="none" stroke="#c8aa6e" stroke-width=".6" opacity=".7"/>${ticks}
</g>
<circle cx="240" cy="240" r="190" fill="none" stroke="#e6c687" stroke-width="1" stroke-dasharray="3 6" opacity=".8"/>${dots}
<g class="hl2">
  <ellipse cx="240" cy="240" rx="214" ry="118" transform="rotate(25 240 240)" fill="none" stroke="url(#lb-brass)" stroke-width="1.4" stroke-dasharray="10 5"/>
  <ellipse cx="240" cy="240" rx="200" ry="84" transform="rotate(-38 240 240)" fill="none" stroke="#c8aa6e" stroke-width="1" opacity=".75"/>
  <circle cx="${f(240 + Math.cos(0.44) * 214 * 0.906)}" cy="${f(240 + 118 * 0.62)}" r="4" fill="url(#lb-glass)" stroke="#e6c687" stroke-width=".8"/>
</g>
<circle cx="240" cy="240" r="148" fill="none" stroke="#c8aa6e" stroke-width=".8" opacity=".5"/>
<path d="${raysPath(240, 16, 6, 34, 16, 0.5)}" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".5"/>
<circle cx="240" cy="16" r="7" fill="url(#lb-coin)" stroke="${DARK}" stroke-width=".8"/>
<path d="${star4(240, 16, 16, 0.1)}" fill="#fff" opacity=".9" class="flare"/>
<path d="${star4(240, 464, 9)}" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".5"/>
<path d="${star4(16, 240, 7)}" fill="url(#lb-brass)" opacity=".8"/><path d="${star4(464, 240, 7)}" fill="url(#lb-brass)" opacity=".8"/>
</svg>`;
}

/** An open, asymmetrical acanthus bracket (left side; mirror it for the right). */
export function bracket(): string {
  const stem = "M14 196 C6 150 14 100 42 66 C62 42 92 30 116 38 C100 40 86 48 80 60 C94 54 108 60 110 72 C96 66 82 74 76 88";
  return `<svg viewBox="0 0 130 210" class="art" aria-hidden="true"><g filter="url(#lb-sh2)">
<path d="${stem}" fill="none" stroke="${DARK}" stroke-width="7" stroke-linecap="round"/>
<path d="${stem}" fill="none" stroke="url(#lb-brass)" stroke-width="3.8" stroke-linecap="round"/>
<path d="M18 150 C8 140 2 124 8 110 C14 122 22 128 30 130 C24 136 20 142 18 150Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".9"/>
<path d="M22 140 C34 126 52 128 58 140 C44 136 34 142 28 152Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".9"/>
<path d="M32 104 C46 92 62 96 66 108 C54 104 42 110 36 118Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".9"/>
<path d="M46 74 C40 60 46 48 56 44 C54 56 58 64 64 70 C58 70 52 72 46 74Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".9"/>
<path d="M14 196 c-10 4 -12 -10 -2 -10 c5 0 6 6 2 7" fill="none" stroke="url(#lb-brass)" stroke-width="2.6"/>
<circle cx="116" cy="38" r="5" fill="url(#lb-coin)" stroke="${DARK}" stroke-width=".8"/>
<path d="${star4(112, 34, 6, 0.12)}" fill="#fff" opacity=".85"/>
</g></svg>`;
}

/** The lead's nameplate: dark obsidian glass with double champagne hairlines and brass studs. */
export function glassPlate(): string {
  const d = "M30 3 H390 L417 39 L390 75 H30 L3 39Z";
  return `<svg viewBox="-24 0 468 78" class="art" aria-hidden="true" preserveAspectRatio="none"><g filter="url(#lb-sh2)">
${scroll(2, 39, 1.2)}<g transform="translate(420 0) scale(-1 1)">${scroll(2, 39, 1.2)}</g>
<path d="${d}" fill="#0c0a08" fill-opacity=".88" stroke="#1c1308" stroke-width="3"/>
<path d="M32 7 H388 L412 39 L388 71 H32 L8 39Z" fill="none" stroke="#DFC183" stroke-width="1.2"/>
<path d="M35 11 H385 L407 39 L385 67 H35 L13 39Z" fill="none" stroke="#DFC183" stroke-width=".7" opacity=".55"/>
<path d="M36 10 H384" stroke="#fff" stroke-width="5" opacity=".06"/>
<path d="${star4(4, 39, 9)}" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".6"/><path d="${star4(416, 39, 9)}" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".6"/>
<path d="M160 71 H260" stroke="#DFC183" stroke-width="1.2"/><path d="M210 66 L215 71 L210 76 L205 71Z" fill="#DFC183"/>
</g></svg>`;
}

/** A small gold-rimmed portrait medallion (dock talk buttons). */
export function miniPortrait(art: string | null, initial: string): string {
  return `<svg viewBox="0 0 40 40" class="art" aria-hidden="true"><g filter="url(#lb-sh2)">
<circle cx="20" cy="20" r="18" fill="url(#lb-slate)"/>
${art ? `<image href="${art}" x="-17" y="-1.5" width="74" height="119" preserveAspectRatio="xMidYMin slice" clip-path="url(#lb-miniclip)"/>` : `<text x="20" y="21" text-anchor="middle" dominant-baseline="central" font-family="Gambit Cinzel, serif" font-weight="800" font-size="16" fill="#c8aa6e">${initial}</text>`}
<circle cx="20" cy="20" r="17.6" fill="none" stroke="${DARK}" stroke-width="3.4"/>
<circle cx="20" cy="20" r="17.6" fill="none" stroke="url(#lb-brass)" stroke-width="1.8"/>
<path d="M8 15 A13 13 0 0 1 18 7" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.6" stroke-linecap="round"/>
</g></svg>`;
}

/** One articulated brass paddle of the delve orienter, with an ivory key inlay kept upright. */
export function paddle(letter: string, rot: number): string {
  return `<svg viewBox="0 0 60 84" class="art" aria-hidden="true"><g filter="url(#lb-sh2)">
<path d="M30 2 L52 28 Q46 32 40 31 L40 66 Q40 76 30 78 Q20 76 20 66 L20 31 Q14 32 8 28Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width="1.4"/>
<path d="M30 7 L48 28" stroke="#fff6d6" stroke-width="1" opacity=".7"/>
<path d="M24 34 V64 M36 34 V64" stroke="#5c4012" stroke-width=".8" opacity=".7"/>
<ellipse cx="30" cy="46" rx="10" ry="11.5" fill="#efe6d2" stroke="${DARK}" stroke-width="1.2"/>
<ellipse cx="28" cy="43" rx="4" ry="4.5" fill="#fff" opacity=".5"/>
<text x="30" y="47" transform="rotate(${-rot} 30 46)" text-anchor="middle" dominant-baseline="central" font-family="Gambit Cinzel, serif" font-weight="800" font-size="13" fill="#1E160B">${letter}</text>
${rivet(30, 68, 3.6)}
</g></svg>`;
}

/** A woodcut-style section rule for the journal. */
export function fleuron(): string {
  return `<svg class="fl" viewBox="0 0 300 16" preserveAspectRatio="none" aria-hidden="true"><path d="M0 8 Q75 5 128 8" fill="none" stroke="#6a3e14" stroke-width="1.2"/><path d="M172 8 Q225 11 300 8" fill="none" stroke="#6a3e14" stroke-width="1.2"/><path d="M150 1 C156 5 156 11 150 15 C144 11 144 5 150 1Z" fill="#6a3e14"/><path d="M128 8 C134 2 142 4 144 8 C142 12 134 14 128 8Z M172 8 C166 2 158 4 156 8 C158 12 166 14 172 8Z" fill="none" stroke="#6a3e14" stroke-width="1"/><circle cx="120" cy="8" r="1.6" fill="#6a3e14"/><circle cx="180" cy="8" r="1.6" fill="#6a3e14"/></svg>`;
}

/** The journal's ribbon bookmark, which closes the book (a gold cross woven into its tail). */
export function ribbonClose(): string {
  return `<svg viewBox="0 0 44 180" class="art" aria-hidden="true"><g filter="url(#lb-sh2)">
<path d="M0 0 H44 V180 L22 160 L0 180Z" fill="#8f2219"/>
<path d="M0 0 H14 V176 L0 180Z" fill="#000" opacity=".18"/>
<path d="M4 0 V172 M40 0 V172" stroke="#e6c687" stroke-opacity=".6" stroke-width="1.2"/>
<circle cx="22" cy="134" r="12" fill="none" stroke="#e6c687" stroke-width="1.4"/>
<path d="M16 128 L28 140 M28 128 L16 140" stroke="#f5e1a4" stroke-width="2.4" stroke-linecap="round"/>
</g></svg>`;
}

/** Window light: soft shafts falling from the upper left. */
export function rays(): string {
  return `<svg viewBox="0 0 1000 600" class="art" aria-hidden="true" preserveAspectRatio="none"><g filter="url(#lb-blur12)">
<path d="M120 -40 L210 -40 L640 640 L430 640Z" fill="url(#lb-ray)" opacity=".55"/>
<path d="M250 -40 L300 -40 L760 640 L650 640Z" fill="url(#lb-ray)" opacity=".35"/>
<path d="M20 -40 L80 -40 L360 640 L250 640Z" fill="url(#lb-ray)" opacity=".4"/>
<path d="M340 -40 L370 -40 L900 640 L840 640Z" fill="url(#lb-ray)" opacity=".2"/>
</g></svg>`;
}
