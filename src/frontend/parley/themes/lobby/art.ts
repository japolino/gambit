/**
 * Artwork for the Lobby Parley (a gacha story scene in the hall's gold and ink). Two kinds:
 *  - DOM drawings that use the scene's material library (`lb-` defs, mounted by the theme): the dialogue frame,
 *    drawn at the box's real size so its corners never stretch; the talk crest.
 *  - Self-contained SVG backgrounds (their own gradients) for the controls the view rewrites as text (the choice
 *    plates, the Say seal, the quill before your lines), so a repaint never strips them.
 */
import { raysPath, star4 } from "../../../scene/themes/lobby/art.js";

const f = (n: number) => +n.toFixed(2);
const DARK = "#1c1308";

const BRASS = `<stop offset='0' stop-color='#6b4f22'/><stop offset='.2' stop-color='#B68D40'/><stop offset='.42' stop-color='#FFF2C2'/><stop offset='.55' stop-color='#d9b464'/><stop offset='.78' stop-color='#8C6224'/><stop offset='1' stop-color='#2A1B08'/>`;
const DEFS = `<defs><linearGradient id='b' x1='0' y1='0' x2='1' y2='1'>${BRASS}</linearGradient><linearGradient id='bv' x1='0' y1='0' x2='0' y2='1'>${BRASS}</linearGradient>
<linearGradient id='p' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#e2c789'/><stop offset='.12' stop-color='#B39256'/><stop offset='.5' stop-color='#8C6D36'/><stop offset='.88' stop-color='#694F22'/><stop offset='1' stop-color='#3f2e10'/></linearGradient>
<linearGradient id='o' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#221c16'/><stop offset='1' stop-color='#0b0907'/></linearGradient>
<radialGradient id='c' cx='.4' cy='.35' r='.75'><stop offset='0' stop-color='#c8463a'/><stop offset='.6' stop-color='#8f2219'/><stop offset='1' stop-color='#3a0a06'/></radialGradient></defs>`;

/** A self-contained SVG as a CSS url(). */
const url = (vb: string, body: string, ratio = "none", extra = "") =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='${vb}' preserveAspectRatio='${ratio}'>${DEFS.replace("</defs>", `${extra}</defs>`)}${body}</svg>`)}")`;

/** A choice plate (the deal actions): a brass cartouche with an obsidian face and enamel end studs. */
export function choiceBg(crimson: boolean, hot = false): string {
  const d = "M30 3 H450 L477 32 L450 61 H30 L3 32Z";
  const stud = crimson ? "url(#c)" : "url(#b)";
  return url("0 0 480 64", `<path d='${d}' fill='url(#p)' stroke='${DARK}' stroke-width='2'/>
<path d='M34 9 H446 L467 32 L446 55 H34 L13 32Z' fill='${hot ? "#2a2014" : "#100d0a"}' fill-opacity='.94' stroke='#f0d79a' stroke-opacity='.55' stroke-width='1.2'/>
<path d='M38 13 H442 L459 32 L442 51 H38 L21 32Z' fill='none' stroke='#5c4012' stroke-width='1'/>
<path d='M32 5.4 H448' stroke='#fff2c8' stroke-width='1' opacity='.6'/>
<circle cx='21' cy='32' r='6' fill='${stud}' stroke='${DARK}' stroke-width='1'/><circle cx='459' cy='32' r='6' fill='${stud}' stroke='${DARK}' stroke-width='1'/>
<path d='M200 55 H280' stroke='#DFC183' stroke-width='1.2'/><path d='M240 51 L244 55 L240 59 L236 55Z' fill='#DFC183'/>`);
}

/** The Say button: a round brass seal with a knurled rim and a sunburst. */
export function sealBg(): string {
  let k = "";
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    k += `M${f(40 + Math.cos(a) * 34)} ${f(40 + Math.sin(a) * 34)}L${f(40 + Math.cos(a) * 38)} ${f(40 + Math.sin(a) * 38)}`;
  }
  return url("0 0 80 80", `<circle cx='40' cy='40' r='39' fill='${DARK}'/><circle cx='40' cy='40' r='36' fill='url(#b)'/><path d='${k}' stroke='#3a2808' stroke-width='.8' opacity='.6'/>
<circle cx='40' cy='40' r='30' fill='url(#p)' stroke='${DARK}' stroke-width='1.2'/><path d='${raysPath(40, 40, 22, 29, 24, 0.5)}' fill='#fff2c8' opacity='.35'/><circle cx='40' cy='40' r='22' fill='none' stroke='#5c4012' stroke-width='1'/>
<path d='M14 30 A27 27 0 0 1 34 13' fill='none' stroke='#fff' stroke-opacity='.45' stroke-width='3' stroke-linecap='round'/>`, "xMidYMid meet");
}

/** A small quill (your lines). */
export function quillBg(): string {
  return url("0 0 40 40", `<path d='M34 3 C20 6 10 16 7 32 L9 33 C12 22 18 14 26 9 C20 16 15 24 12 33 L14 34 C18 22 26 12 36 5Z' fill='url(#b)' stroke='${DARK}' stroke-width='.8'/><path d='M5 36 L12 30' stroke='${DARK}' stroke-width='2' stroke-linecap='round'/>`, "xMidYMid meet");
}

/** A d20 seen face-on in brass, for the dice. */
export function dieBg(kept: boolean): string {
  return url("0 0 60 60", `<path d='M30 2 L54 16 V44 L30 58 L6 44 V16Z' fill='${kept ? "url(#b)" : "#3a3024"}' stroke='${DARK}' stroke-width='2'/>
<path d='M30 10 L46 40 H14Z' fill='${kept ? "#fff2c8" : "#4a3e30"}' fill-opacity='${kept ? ".35" : "1"}' stroke='${kept ? "#5c4012" : "#2a2016"}' stroke-width='1'/>
<path d='M30 2 L30 10 M54 16 L46 40 M6 16 L14 40 M30 58 L14 40 M30 58 L46 40 M6 44 L14 40 M54 44 L46 40' stroke='${kept ? "#5c4012" : "#2a2016"}' stroke-width='1'/>`, "xMidYMid meet");
}

/** A patience stud: a gold star (kept) or a dark one (spent). */
export function studBg(on: boolean): string {
  return url("0 0 40 40", `<path d='${star4(20, 20, 18, 0.26)}' fill='${on ? "url(#b)" : "#2a2218"}' stroke='${DARK}' stroke-width='1.4'/><circle cx='20' cy='20' r='4' fill='${on ? "#fff2c8" : "#3a3024"}'/>`, "xMidYMid meet");
}

/** The talk's crest: a double brass diamond on crimson around a pair of theatre masks. */
export function crest(): string {
  const tick = `<path d="M45 0 L49 6 L45 10 L41 6Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".6"/>`;
  return `<svg viewBox="0 0 90 90" class="art" aria-hidden="true"><g filter="url(#lb-sh2)">
<path d="M45 3 L87 45 L45 87 L3 45Z" fill="url(#lb-crim)" stroke="${DARK}" stroke-width="5"/>
<path d="M45 3 L87 45 L45 87 L3 45Z" fill="none" stroke="url(#lb-brass)" stroke-width="3.4"/>
<path d="${raysPath(45, 45, 4, 34, 16, 0.5)}" fill="#ffcf8a" opacity=".16"/>
<g transform="translate(25 26) scale(1.02)">
<path d="M17 6 Q30 4 37 8 Q38 22 30 30 Q24 34 19 28 Q15 20 17 6Z" fill="#8a6421" stroke="${DARK}" stroke-width=".8"/>
<path d="M22 14 q3 2 6 0 M30 13 q2 2 4 0" stroke="${DARK}" stroke-width="1.6" fill="none"/><path d="M24 25 Q28 21 32 25" stroke="${DARK}" stroke-width="1.6" fill="none"/>
<path d="M3 11 Q12 7 23 10 Q25 24 18 32 Q12 37 7 31 Q2 22 3 11Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".9"/>
<path d="M7 17 q2.5 -2.5 5 0 M15 17 q2.5 -2.5 5 0" stroke="${DARK}" stroke-width="1.8" fill="none"/><path d="M9 24 Q13.5 30 18 24" stroke="${DARK}" stroke-width="1.8" fill="none"/>
</g>
<path d="M45 10 L80 45 L45 80 L10 45Z" fill="none" stroke="#c8aa6e" stroke-width="1.6"/>
${tick}<g transform="rotate(90 45 45)">${tick}</g><g transform="rotate(180 45 45)">${tick}</g><g transform="rotate(270 45 45)">${tick}</g>
</g></svg>`;
}

/** An acanthus leaf for a frame corner (top-left; mirror for the others). */
const leaf = `<path d="M-12 -12 C10 -16 30 -6 36 10 C27 3 16 3 9 9 C11 18 5 30 -7 36 C0 22 -3 8 -12 -12Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width="1"/>
<path d="M-7 -7 C7 -7 20 0 27 7 M-7 -7 C-5 7 -2 18 -4 27" fill="none" stroke="#5c4012" stroke-width=".9"/>
<path d="M34 5 c7 -3 12 4 7 9 c-3 3 -8 0 -6 -4" fill="none" stroke="url(#lb-brass)" stroke-width="2.2"/>
<path d="M5 34 c-3 7 4 12 9 7 c3 -3 0 -8 -4 -6" fill="none" stroke="url(#lb-brass)" stroke-width="2.2"/>
<circle cx="-3" cy="-3" r="4.8" fill="url(#lb-coin)" stroke="${DARK}" stroke-width=".8"/>`;

/**
 * The dialogue box at its real size (px): obsidian and leather under a brushed-brass rim, beaded rails, acanthus
 * corners, a sunburst crest on the top rail, and a gilt rule above the line you write.
 */
export function dialogFrame(W: number, H: number, inputTop: number): string {
  const w = Math.max(120, W);
  const h = Math.max(80, H);
  let beads = "";
  for (let x = 30; x <= w - 30; x += 11) beads += `<circle cx="${f(x)}" cy="12" r="1.15" fill="#c8aa6e"/><circle cx="${f(x)}" cy="${f(h - 12)}" r="1.15" fill="#c8aa6e"/>`;
  const iy = f(Math.min(h - 30, Math.max(40, inputTop)));
  return `<svg viewBox="-16 -16 ${f(w + 32)} ${f(h + 32)}" width="${f(w + 32)}" height="${f(h + 32)}" class="frame" aria-hidden="true" style="position:absolute;left:-16px;top:-16px">
<g filter="url(#lb-sh)">
<defs><linearGradient id="lpb-ink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e0b09" stop-opacity=".8"/><stop offset="1" stop-color="#0a0806" stop-opacity=".95"/></linearGradient></defs>
<rect x="6" y="6" width="${f(w - 12)}" height="${f(h - 12)}" fill="url(#lpb-ink)"/>
<rect x="6" y="6" width="${f(w - 12)}" height="${f(h - 12)}" fill="url(#lb-hide)" opacity=".16"/>
<rect x="6" y="6" width="${f(w - 12)}" height="${f(h - 12)}" fill="url(#lb-vig)" opacity=".55"/>
<path d="M28 ${iy} H${f(w - 28)}" stroke="#c8aa6e" stroke-width="1" opacity=".45"/>
<path d="M${f(w / 2 - 6)} ${iy} l6 -5 l6 5 l-6 5Z" fill="#DFC183" opacity=".8"/>
<rect x="2.5" y="2.5" width="${f(w - 5)}" height="${f(h - 5)}" fill="none" stroke="${DARK}" stroke-width="10"/>
<rect x="2.5" y="2.5" width="${f(w - 5)}" height="${f(h - 5)}" fill="none" stroke="url(#lb-brassH)" stroke-width="6"/>
<rect x="-1" y="-1" width="${f(w + 2)}" height="${f(h + 2)}" fill="none" stroke="#f5e1a4" stroke-width=".9" opacity=".45"/>
<rect x="8" y="8" width="${f(w - 16)}" height="${f(h - 16)}" fill="none" stroke="#5c4012" stroke-width="1.6"/>
${beads}
<g transform="translate(${f(w / 2)} 2)"><path d="${raysPath(0, 0, 9, 30, 16, 0.5)}" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".6"/><circle r="10" fill="${DARK}"/><circle r="8.4" fill="url(#lb-coin)"/><path d="${star4(0, 0, 6, 0.2)}" fill="#fff6d6"/></g>
${leaf}<g transform="translate(${f(w)} 0) scale(-1 1)">${leaf}</g><g transform="translate(0 ${f(h)}) scale(1 -1)">${leaf}</g><g transform="translate(${f(w)} ${f(h)}) scale(-1 -1)">${leaf}</g>
</g></svg>`;
}

/**
 * The haggle's balance (240x210, DOM, lobby defs): a brass column on a stepped plinth, a beam with scrolled ends
 * that tips with the deal (the HUD rotates `.beam` and hangs `.pan-l` / `.pan-r` from its ends), their price in
 * coins on the left pan, your purse on the right.
 */
export function balanceRig(): string {
  const coin = (x: number, y: number) => `<ellipse cx="${x}" cy="${y}" rx="9" ry="3.6" fill="url(#lb-coin)" stroke="#6a4a14" stroke-width=".7"/>`;
  const pan = (cls: string, load: string) => `<g class="${cls}">
<path d="M0 0 L-24 54 M0 0 L24 54 M0 0 L0 50" stroke="#6a4a14" stroke-width="1" fill="none"/>
<path d="M0 0 L-24 54 M0 0 L24 54" stroke="url(#lb-brass)" stroke-width=".6" fill="none" stroke-dasharray="2 1.5"/>
<circle cx="0" cy="0" r="3.4" fill="url(#lb-coin)" stroke="${DARK}" stroke-width=".8"/>
${load}
<path d="M-34 54 Q0 76 34 54Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width="1.2"/>
<path d="M-30 56 Q0 70 30 56" fill="none" stroke="#fff6d6" stroke-width=".8" opacity=".6"/>
</g>`;
  return `<svg viewBox="0 0 240 210" class="art" aria-hidden="true" overflow="visible"><g filter="url(#lb-sh2)">
<path d="M70 202 H170 L160 190 H80Z" fill="url(#lb-plate)" stroke="${DARK}" stroke-width="1.2"/>
<path d="M86 190 H154 L146 178 H94Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width="1"/>
<path d="M116 178 V52 H124 V178Z" fill="url(#lb-cylH)" stroke="${DARK}" stroke-width="1"/>
<path d="M112 120 H128 M112 150 H128" stroke="${DARK}" stroke-width="1.6"/>
<g transform="translate(120 46)"><path d="${raysPath(0, 0, 8, 26, 16, 0.5)}" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".5" opacity=".9"/></g>
<g class="beam" style="transform-origin: 120px 46px">
<path d="M22 43 H218 V49 H22Z" fill="url(#lb-cyl)" stroke="${DARK}" stroke-width="1"/>
<path d="M24 44.6 H216" stroke="#fff6d6" stroke-width=".8" opacity=".6"/>
<path d="M22 46 c-8 -2 -12 -10 -6 -14 c4 -3 9 0 7 4" fill="none" stroke="url(#lb-brass)" stroke-width="2.2"/>
<path d="M218 46 c8 -2 12 -10 6 -14 c-4 -3 -9 0 -7 4" fill="none" stroke="url(#lb-brass)" stroke-width="2.2"/>
<path d="M120 46 L114 62 H126Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".8"/>
</g>
<circle cx="120" cy="46" r="7" fill="${DARK}"/><circle cx="120" cy="46" r="5.6" fill="url(#lb-coin)"/>
<path d="${star4(120, 22, 14, 0.12)}" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".5"/><circle cx="120" cy="22" r="3" fill="url(#lb-coin)"/>
${pan("pan-l", `${coin(-10, 51)}${coin(6, 52)}${coin(-2, 47)}${coin(8, 46.5)}${coin(-8, 43)}`)}
${pan("pan-r", `<path d="M-10 52 Q-12 40 0 38 Q12 40 10 52Z" fill="#5a3a1c" stroke="${DARK}" stroke-width=".8"/><path d="M-6 40 Q0 34 6 40" fill="none" stroke="url(#lb-brass)" stroke-width="1.4"/>`)}
</g></svg>`;
}

/** A patience jewel hanging on a short chain: lit amber glass, or smoked and cracked once spent. */
export function jewelBg(on: boolean): string {
  const glow = `<radialGradient id='gl' cx='.45' cy='.4' r='.7'><stop offset='0' stop-color='#fff2b8' stop-opacity='.9'/><stop offset='.5' stop-color='#ffb04a' stop-opacity='.4'/><stop offset='1' stop-color='#a03a08' stop-opacity='0'/></radialGradient>`;
  return url("0 0 40 60", `<path d='M20 0 V14' stroke='#6a4a14' stroke-width='2' stroke-dasharray='3 2'/>
<path d='M13 14 H27 L25 19 H15Z' fill='url(#b)' stroke='${DARK}' stroke-width='.8'/>
<path d='M20 19 L33 34 L20 58 L7 34Z' fill='${on ? "#e8902e" : "#26201b"}' stroke='${DARK}' stroke-width='1.4'/>
${on ? `<path d='M20 19 L33 34 L20 58 L7 34Z' fill='url(#gl)'/><path d='M20 23 L27 34 L20 36 Z' fill='#fff6d0' opacity='.75'/>` : `<path d='M14 28 L22 40 L18 47 M22 40 L28 36' fill='none' stroke='#5a4a3a' stroke-width='1'/>`}
<path d='M7 34 H33' stroke='${on ? "#ffe2a8" : "#3a3024"}' stroke-width='.8' opacity='.7'/>`, "xMidYMid meet", glow);
}

/** A short hanging chain (a deal plaque hangs from the balance). */
export function chainBg(): string {
  let s = "";
  for (let i = 0; i < 6; i++) {
    const y = 4 + i * 8;
    s += i % 2 ? `<ellipse cx='6' cy='${y}' rx='1.6' ry='4' fill='none' stroke='url(#bv)' stroke-width='1.6'/>` : `<ellipse cx='6' cy='${y}' rx='3.4' ry='4' fill='none' stroke='url(#bv)' stroke-width='1.6'/>`;
  }
  return url("0 0 12 48", s, "xMidYMid meet");
}

/** A brass photo mount for a moment print (tilted by CSS): corner brackets and a riveted rail. */
export function printBg(): string {
  const c = (t: string) => `<g transform='${t}'><path d='M0 0 H22 L0 22Z' fill='url(#b)' stroke='${DARK}' stroke-width='1'/><circle cx='5' cy='5' r='2' fill='#fff2c8'/></g>`;
  return url("0 0 160 112", `<rect x='1' y='1' width='158' height='110' fill='none' stroke='${DARK}' stroke-width='4'/><rect x='2.5' y='2.5' width='155' height='107' fill='none' stroke='url(#b)' stroke-width='3'/>
${c("translate(0 0)")}${c("translate(160 0) scale(-1 1)")}${c("translate(0 112) scale(1 -1)")}${c("translate(160 112) scale(-1 -1)")}`);
}

/** The two view modes as engraved icons: a mask (immersive) and a loupe (the dice maths). */
export function maskIcon(): string {
  return url("0 0 40 40", `<circle cx='20' cy='20' r='19' fill='${DARK}'/><circle cx='20' cy='20' r='17' fill='url(#b)'/><circle cx='20' cy='20' r='13.5' fill='#1b140c'/>
<path d='M11 14 Q20 11 29 14 Q30 25 20 30 Q10 25 11 14Z' fill='url(#b)'/><path d='M14 18 q2.5 -2 5 0 M21 18 q2.5 -2 5 0' stroke='${DARK}' stroke-width='1.6' fill='none'/><path d='M15.5 23 Q20 27 24.5 23' stroke='${DARK}' stroke-width='1.6' fill='none'/>`, "xMidYMid meet");
}
export function loupeIcon(): string {
  return url("0 0 40 40", `<circle cx='20' cy='20' r='19' fill='${DARK}'/><circle cx='20' cy='20' r='17' fill='url(#b)'/><circle cx='20' cy='20' r='13.5' fill='#1b140c'/>
<circle cx='18' cy='18' r='6.5' fill='none' stroke='url(#b)' stroke-width='2.4'/><path d='M23 23 L29 29' stroke='url(#b)' stroke-width='3.2' stroke-linecap='round'/><text x='18' y='19' text-anchor='middle' dominant-baseline='central' font-family='Georgia,serif' font-size='7' font-weight='700' fill='#e6c687'>20</text>`, "xMidYMid meet");
}

/**
 * The balance's pedestal: an obsidian plaque in a brass rim that the fare and the patience jewels are set into, with
 * two brass rings on its foot that the deal's chains hang from (x 88 and 332 of 420). Inline (it uses the page's
 * lobby defs); stretched to the meter.
 */
export function pedestal(): string {
  const ring = (x: number) => `<circle cx="${x}" cy="146" r="6.5" fill="none" stroke="${DARK}" stroke-width="5"/><circle cx="${x}" cy="146" r="6.5" fill="none" stroke="url(#lb-brass)" stroke-width="2.8"/>`;
  return `<svg viewBox="0 0 420 152" class="art" aria-hidden="true" preserveAspectRatio="none" overflow="visible"><g filter="url(#lb-sh2)">
<path d="M150 0 H270 L262 8 H158Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width="1"/>
<path d="M18 8 H402 L418 24 V124 L402 140 H18 L2 124 V24Z" fill="#0c0a08" fill-opacity=".93" stroke="${DARK}" stroke-width="3"/>
<path d="M20 12 H400 L413 25 V123 L400 136 H20 L7 123 V25Z" fill="none" stroke="url(#lb-brass)" stroke-width="3"/>
<path d="M24 18 H396 L407 28 V120 L396 130 H24 L13 120 V28Z" fill="none" stroke="#DFC183" stroke-width=".7" opacity=".55"/>
${ring(88)}${ring(332)}
</g></svg>`;
}
