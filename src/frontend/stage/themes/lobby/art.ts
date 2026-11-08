/**
 * SVG artwork for the Lobby battle, in the scene's material library (../../../scene/themes/lobby/art.ts: the
 * `lb-` gradients, textures and filters, mounted once by the HUD). Every piece here is a string of paths the
 * HUD drops into the DOM: the party member's framed card (an arched portrait window cut through brushed brass),
 * the skill medallions with their engraved glyphs, the turn-order lockets, the enemy nameplate, the target
 * reticle and the encounter crest.
 */
import { raysPath, star4 } from "../../../scene/themes/lobby/art.js";

const f = (n: number) => +n.toFixed(2);
const DARK = "#1c1308";

/** Extra gradients and clips for the battle pieces (ids prefixed `lbb-`). */
export function battleDefs(): string {
  return `<svg class="lbb-defs" width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden"><defs>
<radialGradient id="lbb-dial" cx=".45" cy=".38" r=".75"><stop offset="0" stop-color="#3a2f24"/><stop offset=".55" stop-color="#1a1410"/><stop offset="1" stop-color="#070605"/></radialGradient>
<radialGradient id="lbb-enamel" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="#4a3820"/><stop offset=".45" stop-color="#2e2316"/><stop offset="1" stop-color="#0e0b08"/></radialGradient>
<radialGradient id="lbb-crim" cx=".42" cy=".36" r=".72"><stop offset="0" stop-color="#b8402c"/><stop offset=".5" stop-color="#6a160c"/><stop offset="1" stop-color="#220604"/></radialGradient>
<radialGradient id="lbb-gemT" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#e8fff8"/><stop offset=".3" stop-color="#6fd0c4"/><stop offset=".75" stop-color="#1d5a5c"/><stop offset="1" stop-color="#0a2224"/></radialGradient>
<radialGradient id="lbb-gemR" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#ffe2d6"/><stop offset=".3" stop-color="#e0503c"/><stop offset=".75" stop-color="#7a140c"/><stop offset="1" stop-color="#2a0604"/></radialGradient>
<radialGradient id="lbb-winvig" cx=".5" cy=".4" r=".72"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".72"/></radialGradient>
<linearGradient id="lbb-winfoot" x1="0" y1="0" x2="0" y2="1"><stop offset=".6" stop-color="#0b0907" stop-opacity="0"/><stop offset="1" stop-color="#0b0907" stop-opacity=".92"/></linearGradient>
<linearGradient id="lbb-ribbon" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a4430"/><stop offset=".45" stop-color="#3a2c1e"/><stop offset="1" stop-color="#1a130c"/></linearGradient>
<linearGradient id="lbb-ribbonR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a2018"/><stop offset=".45" stop-color="#3e0e0a"/><stop offset="1" stop-color="#1c0605"/></linearGradient>
<clipPath id="lbb-ordclip"><circle cx="50" cy="66" r="35"/></clipPath>
</defs></svg>`;
}

/** A small rivet. */
const rivet = (x: number, y: number, r = 2.6) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${DARK}"/><circle cx="${f(x - r * 0.12)}" cy="${f(y - r * 0.12)}" r="${f(r * 0.78)}" fill="url(#lb-brass)"/><circle cx="${f(x - r * 0.3)}" cy="${f(y - r * 0.3)}" r="${f(r * 0.25)}" fill="#fff6d6" opacity=".8"/>`;

/** A C-scroll of filigree (left end; mirror for the right). */
const scroll = (x: number, y: number, s = 1) =>
  `<path d="M${x},${y} c${-8 * s},${-1 * s} ${-13 * s},${-9 * s} ${-7 * s},${-15 * s} c${4 * s},${-4 * s} ${10 * s},${-1 * s} ${8 * s},${4 * s} c${-1 * s},${3 * s} ${-5 * s},${3 * s} ${-5 * s},0" fill="none" stroke="${DARK}" stroke-width="${f(4 * s)}" stroke-linecap="round"/>` +
  `<path d="M${x},${y} c${-8 * s},${-1 * s} ${-13 * s},${-9 * s} ${-7 * s},${-15 * s} c${4 * s},${-4 * s} ${10 * s},${-1 * s} ${8 * s},${4 * s} c${-1 * s},${3 * s} ${-5 * s},${3 * s} ${-5 * s},0" fill="none" stroke="url(#lb-brass)" stroke-width="${f(2.2 * s)}" stroke-linecap="round"/>` +
  `<path d="M${x},${y} c${-8 * s},${1 * s} ${-13 * s},${9 * s} ${-7 * s},${15 * s} c${4 * s},${4 * s} ${10 * s},${1 * s} ${8 * s},${-4 * s}" fill="none" stroke="url(#lb-brass)" stroke-width="${f(1.6 * s)}" stroke-linecap="round" opacity=".85"/>`;

/** An acanthus corner bracket (top-left; it reaches outside the frame). */
const acanthus = `<path d="M-14 -14 C6 -18 26 -8 32 8 C24 2 14 2 8 8 C10 16 4 26 -8 32 C0 20 -4 6 -14 -14Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width="1"/>
<path d="M-8 -8 C6 -8 18 0 24 6 M-8 -8 C-6 6 -2 16 -4 24" fill="none" stroke="#5c4012" stroke-width=".9"/>
<path d="M30 6 c8 -4 14 4 8 10 c-4 4 -9 0 -6 -4" fill="none" stroke="${DARK}" stroke-width="3.6"/><path d="M30 6 c8 -4 14 4 8 10 c-4 4 -9 0 -6 -4" fill="none" stroke="url(#lb-brass)" stroke-width="2"/>
<path d="M6 30 c-4 8 4 14 10 8 c4 -4 0 -9 -4 -6" fill="none" stroke="${DARK}" stroke-width="3.6"/><path d="M6 30 c-4 8 4 14 10 8 c4 -4 0 -9 -4 -6" fill="none" stroke="url(#lb-brass)" stroke-width="2"/>
<circle cx="-4" cy="-4" r="4.6" fill="url(#lb-coin)" stroke="${DARK}" stroke-width=".8"/>`;

/* ------------------------------- Party card ------------------------------ */

/** The arched portrait window of the card (on the 250x364 card grid). */
export const CARD_WINDOW = { x: 16, y: 14, w: 218, h: 238 };
const WINDOW = "M16 252 V78 C16 34 60 14 125 14 C190 14 234 34 234 78 V252Z";
const OUTER = "M10 0 H92 Q125 -20 158 0 H240 Q250 0 250 10 V354 Q250 364 240 364 H158 Q125 380 92 364 H10 Q0 364 0 354 V10 Q0 0 10 0Z";
/** The HP trough and focus groove (card grid), for the HUD's fills. */
export const CARD_HP = { x: 30, y: 286, w: 190, h: 20 };
export const CARD_FOCUS = { x: 30, y: 312, w: 190, h: 7 };

/**
 * A party member's card: brushed brass with an arched window cut clean through (the breathing bust shows there),
 * a keystone gem over the arch, acanthus corners, a bronze ribbon across the window's foot for the name, and an
 * obsidian-and-leather panel below with the HP trough and the focus groove.
 */
export function cardFrame(initial: string): string {
  return `<svg viewBox="0 0 250 364" class="art" aria-hidden="true" overflow="visible">
<g filter="url(#lb-sh)">
  <path d="${OUTER} ${WINDOW}" fill="url(#lb-plate)" fill-rule="evenodd" stroke="${DARK}" stroke-width="2.4"/>
  <path d="${OUTER} ${WINDOW}" fill="url(#lb-brush)" fill-rule="evenodd" opacity=".55" style="mix-blend-mode:overlay"/>
  <path d="M12 3.4 H90 M160 3.4 H238" stroke="#fff2c8" stroke-width="1.1" opacity=".6"/>
  <path d="M5 12 V352 M245 12 V352" stroke="#4a3714" stroke-width="1" opacity=".7"/>
  <path d="M7.5 14 V350" stroke="#fff2c8" stroke-width=".8" opacity=".35"/>
  <path d="M16 268 H234 V346 Q234 352 228 352 H22 Q16 352 16 346Z" fill="url(#lb-obs)" stroke="#2a1c08" stroke-width="1.6"/>
  <path d="M16 268 H234 V346 Q234 352 228 352 H22 Q16 352 16 346Z" fill="url(#lb-hide)" opacity=".42"/>
  <path d="M21 273 H229 V343 Q229 347 225 347 H25 Q21 347 21 343Z" fill="none" stroke="#c8aa6e" stroke-width=".8" opacity=".45"/>
  <path d="${WINDOW}" fill="none" stroke="${DARK}" stroke-width="5"/>
  <path d="M21 250 V80 C21 39 63 19 125 19 C187 19 229 39 229 80 V250" fill="none" stroke="#f5e1a4" stroke-width="1" opacity=".5"/>
  <path d="M11 252 V76 C11 28 58 8 125 8 C192 8 239 28 239 76 V252" fill="none" stroke="#4a3714" stroke-width="1.2" opacity=".8"/>
  <path d="M${CARD_HP.x - 6} ${CARD_HP.y + 10} a10 10 0 0 1 10 -10 H${CARD_HP.x + CARD_HP.w - 4} a10 10 0 0 1 0 20 H${CARD_HP.x + 4} a10 10 0 0 1 -10 -10Z" fill="#090706" stroke="${DARK}" stroke-width="3"/>
  <path d="M${CARD_HP.x - 6} ${CARD_HP.y + 10} a10 10 0 0 1 10 -10 H${CARD_HP.x + CARD_HP.w - 4} a10 10 0 0 1 0 20 H${CARD_HP.x + 4} a10 10 0 0 1 -10 -10Z" fill="none" stroke="url(#lb-brass)" stroke-width="1.6"/>
  <path d="M${CARD_FOCUS.x - 2} ${CARD_FOCUS.y - 1.5} H${CARD_FOCUS.x + CARD_FOCUS.w + 2} V${CARD_FOCUS.y + CARD_FOCUS.h + 1.5} H${CARD_FOCUS.x - 2}Z" fill="#090706" stroke="#5c4012" stroke-width="1"/>
  <g transform="translate(-1 -1) scale(.95)">${acanthus}</g><g transform="translate(251 -1) scale(-.95 .95)">${acanthus}</g>
  <g transform="translate(-1 365) scale(.95 -.95)">${acanthus}</g><g transform="translate(251 365) scale(-.95 -.95)">${acanthus}</g>
  ${rivet(8, 130, 2.6)}${rivet(242, 130, 2.6)}${rivet(8, 208, 2.6)}${rivet(242, 208, 2.6)}
  <g transform="translate(125 6)">
    <path d="${raysPath(0, 0, 10, 26, 14, 0.55)}" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".6"/>
    <circle r="12" fill="${DARK}"/><circle r="10.5" fill="url(#lb-brass)"/><circle r="8" fill="url(#lbb-gemT)" stroke="${DARK}" stroke-width=".8"/>
    <ellipse cx="-2.6" cy="-3" rx="2.6" ry="1.8" fill="#fff" opacity=".7"/>
  </g>
  <g transform="translate(125 358)">
    <path d="M-20 0 L0 -8 L20 0 L0 8Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".8"/><circle r="3.4" fill="url(#lb-coin)" stroke="${DARK}" stroke-width=".6"/>
  </g>
  <g transform="translate(32 46)">
    <circle r="19" fill="${DARK}"/><circle r="17.4" fill="url(#lb-brass)"/><circle r="13.6" fill="#1b140c" stroke="#f5e1a4" stroke-opacity=".5" stroke-width=".8"/>
    <text x="0" y="1" text-anchor="middle" dominant-baseline="central" font-family="Gambit Cinzel, serif" font-weight="800" font-size="15" fill="#e6c687">${initial}</text>
  </g>
</g>
<g filter="url(#lb-sh2)">
  <path d="M-14 232 L-4 236 L-4 270 L-14 274 L-8 253Z M264 232 L254 236 L254 270 L264 274 L258 253Z" fill="#1a130c" stroke="url(#lb-brass)" stroke-width="1"/>
  <path d="M-4 234 H254 V272 H-4Z" fill="url(#lbb-ribbon)" stroke="url(#lb-brass)" stroke-width="1.6"/>
  <path d="M0 238.5 H250 M0 267.5 H250" stroke="#c8aa6e" stroke-width=".8" opacity=".55"/>
  <path d="M0 235.6 H250" stroke="#fff2c8" stroke-width=".8" opacity=".35"/>
</g>
</svg>`;
}

/** The shading inside the portrait window (its own layer, so the active card's glow stays outside). */
export function cardWindowShade(): string {
  return `<svg viewBox="0 0 250 364" class="art" aria-hidden="true"><path d="${WINDOW}" fill="url(#lbb-winvig)"/><path d="${WINDOW}" fill="url(#lbb-winfoot)"/></svg>`;
}

/** Corner brackets that close in around a card or a figure that can be targeted. */
export function brackets(color = "#f5e1a4"): string {
  const c = (t: string) => `<g transform="${t}"><path d="M0 34 V0 H34" fill="none" stroke="${DARK}" stroke-width="7" stroke-linecap="square"/><path d="M0 34 V0 H34" fill="none" stroke="${color}" stroke-width="3.4"/><path d="${star4(0, 0, 9, 0.18)}" fill="#fff8dc"/></g>`;
  return `<svg viewBox="0 0 100 100" class="art" aria-hidden="true" preserveAspectRatio="none" overflow="visible">${c("translate(0 0)")}${c("translate(100 0) scale(-1 1)")}${c("translate(0 100) scale(1 -1)")}${c("translate(100 100) scale(-1 -1)")}</svg>`;
}

/* ------------------------------ Skill glyphs ----------------------------- */

/** Engraved glyphs on a 100x100 grid: filled shapes, or strokes (marked). */
const GLYPHS: Record<string, { d: string; stroke?: number }> = {
  blade: { d: "M24 82 L72 24 L82 16 L78 28 L30 86Z M16 70 Q26 74 32 86 L27 88 Q22 79 12 74Z M18 92 L10 100 M14 92 a5 5 0 1 0 0.1 0" },
  flurry: { d: "M14 66 Q48 40 88 18 Q60 46 18 74Z M10 82 Q46 58 90 38 Q62 64 14 90Z M22 48 Q50 26 84 6 Q60 32 26 56Z" },
  shield: { d: "M50 10 L84 22 V48 Q84 76 50 92 Q16 76 16 48 V22Z M50 20 L74 29 V48 Q74 68 50 80Z" },
  eye: { d: "M8 50 Q50 12 92 50 Q50 88 8 50Z M50 30 a20 20 0 1 0 0.1 0Z M50 42 a8 8 0 1 1 -0.1 0Z" },
  cross: { d: "M42 12 H58 V42 H88 V58 H58 V88 H42 V58 H12 V42 H42Z" },
  wave: { d: "M6 42 Q20 26 34 42 T62 42 T90 42 M6 62 Q20 46 34 62 T62 62 T90 62 M14 80 Q26 68 38 80 T62 80 T86 80", stroke: 7 },
  flame: { d: "M50 8 C62 30 82 42 76 66 C72 82 60 92 50 92 C38 92 24 82 24 64 C24 50 34 44 36 30 C44 40 44 50 50 54 C56 42 52 26 50 8Z M50 62 C56 70 58 78 50 84 C42 78 44 70 50 62Z" },
  scales: { d: "M48 10 H52 V84 H48Z M30 86 H70 V92 H30Z M14 26 H86 V31 H14Z M20 31 L8 58 H32Z M80 31 L68 58 H92Z M4 58 Q20 72 36 58Z M64 58 Q80 72 96 58Z" },
  star: { d: `${star4(50, 50, 44, 0.16)} ${star4(50, 50, 26, 0.3)}` },
  hourglass: { d: "M22 8 H78 V16 H72 Q72 40 54 50 Q72 60 72 84 H78 V92 H22 V84 H28 Q28 60 46 50 Q28 40 28 16 H22Z" },
  crossed: { d: "M14 20 L22 12 L86 76 L88 88 L76 86Z M86 20 L78 12 L14 76 L12 88 L24 86Z" },
  snow: { d: "M47 6 H53 V94 H47Z M10 28 L13 23 L90 72 L87 77Z M10 72 L87 23 L90 28 L13 77Z", stroke: 0 },
  bolt: { d: "M58 4 L22 54 H46 L38 96 L80 40 H54Z" },
};

/** Which glyph a skill is engraved with, from its name. */
export function glyphFor(name: string, signature: boolean): string {
  const n = name.toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/verdict|judg|measure|balance/, "scales"],
    [/shield|guard|stance|parry|riposte|bulwark|wall|stalwart|block|ward/, "shield"],
    [/flurry|frenzy|barrage|volley|flurr/, "flurry"],
    [/opening|mark|study|eye|sight|aim|witch/, "eye"],
    [/mend|heal|tend|salve|restore|rally|cure/, "cross"],
    [/tide|wave|brine|current|undertow|surf|drown|rip/, "wave"],
    [/ember|cinder|fire|flame|burn|script|rite/, "flame"],
    [/frost|ice|snow|bind/, "snow"],
    [/challenge|duel|taunt/, "crossed"],
    [/bolt|shock|storm|unmak/, "bolt"],
    [/wait|time|delay/, "hourglass"],
    [/cut|slash|strike|blade|thrust|lunge|lash|bash/, "blade"],
  ];
  for (const [re, g] of rules) if (re.test(n)) return g;
  return signature ? "star" : "blade";
}

function engrave(glyph: string, cx: number, cy: number, size: number): string {
  const g = GLYPHS[glyph] ?? GLYPHS.blade!;
  const k = size / 100;
  const t = (dx: number, dy: number) => `translate(${f(cx - size / 2 + dx)} ${f(cy - size / 2 + dy)}) scale(${f(k)})`;
  if (g.stroke) {
    return `<path d="${g.d}" transform="${t(1.6, 2.4)}" fill="none" stroke="#000" stroke-width="${g.stroke}" stroke-linecap="round" opacity=".7"/><path d="${g.d}" transform="${t(0, 0)}" fill="none" stroke="url(#lb-brass)" stroke-width="${g.stroke}" stroke-linecap="round"/><path d="${g.d}" transform="${t(-0.6, -0.8)}" fill="none" stroke="#fff6d6" stroke-width="${f(g.stroke * 0.25)}" stroke-linecap="round" opacity=".55"/>`;
  }
  return `<path d="${g.d}" transform="${t(1.6, 2.4)}" fill="#000" fill-rule="evenodd" opacity=".7"/><path d="${g.d}" transform="${t(0, 0)}" fill="url(#lb-brass)" fill-rule="evenodd" stroke="${DARK}" stroke-width="${f(1.2 / k)}"/>`;
}

/**
 * A skill medallion (200x200): a knurled brass bezel with a degree ring around an obsidian dial and the skill's
 * glyph engraved in gold. A signature skill gets a sunburst behind, a crimson enamel dial and a crown bow.
 */
/** Faint astrolabe engraving inside a plain medallion (rings, a rete, crosshairs). */
function astro(): string {
  let d = "";
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    d += `M${f(100 + Math.cos(a) * 56)} ${f(100 + Math.sin(a) * 56)}L${f(100 + Math.cos(a) * 62)} ${f(100 + Math.sin(a) * 62)}`;
  }
  return `<g fill="none" stroke="#c89d54" opacity=".3"><circle cx="100" cy="100" r="62" stroke-width=".9"/><circle cx="100" cy="100" r="44" stroke-width=".7" stroke-dasharray="3 3"/><circle cx="100" cy="88" r="30" stroke-width=".7"/><path d="M100 38 V162 M38 100 H162" stroke-width=".6"/><path d="${d}" stroke-width=".8"/></g>`;
}

export function medal(glyph: string, signature: boolean): string {
  let knurl = "";
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    knurl += `M${f(100 + Math.cos(a) * 91)} ${f(100 + Math.sin(a) * 91)}L${f(100 + Math.cos(a) * 98)} ${f(100 + Math.sin(a) * 98)}`;
  }
  let ticks = "";
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const l = i % 5 === 0 ? 7 : 3;
    ticks += `M${f(100 + Math.cos(a) * 85)} ${f(100 + Math.sin(a) * 85)}L${f(100 + Math.cos(a) * (85 - l))} ${f(100 + Math.sin(a) * (85 - l))}`;
  }
  return `<svg viewBox="0 0 200 200" class="art" aria-hidden="true" overflow="visible">
${signature ? `<g class="sun"><path d="${raysPath(100, 100, 86, 138, 32, 0.5)}" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".7"/><path d="${raysPath(100, 100, 86, 124, 16, 0.4)}" fill="#fff2c8" opacity=".35"/></g>` : ""}
${signature ? `<g><path d="M86 6 Q100 -14 114 6Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width="1"/><ellipse cx="100" cy="-6" rx="10" ry="8" fill="none" stroke="${DARK}" stroke-width="6"/><ellipse cx="100" cy="-6" rx="10" ry="8" fill="none" stroke="url(#lb-brass)" stroke-width="3.4"/></g>` : ""}
<g filter="url(#lb-sh2)">
  <circle cx="100" cy="100" r="99" fill="${DARK}"/>
  <circle cx="100" cy="100" r="94.5" fill="none" stroke="url(#lb-brass)" stroke-width="9"/>
  <path d="${knurl}" stroke="#3a2808" stroke-width="1" opacity=".6"/>
  <circle cx="100" cy="100" r="89.5" fill="url(#lbb-dial)" stroke="#2a1c08" stroke-width="1.6"/>
  <circle cx="100" cy="100" r="89.5" fill="url(#lb-hide)" opacity=".3"/>
  <path d="${ticks}" stroke="#d8b467" stroke-width="1.2" opacity=".8"/>
  <circle cx="100" cy="100" r="74" fill="none" stroke="#c8aa6e" stroke-width=".9" opacity=".55"/>
  ${[45, 135, 225, 315].map((a) => { const x = f(100 + Math.cos((a * Math.PI) / 180) * 80); const y = f(100 + Math.sin((a * Math.PI) / 180) * 80); return `<circle cx="${x}" cy="${y}" r="4.2" fill="${DARK}"/><circle cx="${x}" cy="${y}" r="3.2" fill="${signature ? "url(#lbb-gemR)" : "url(#lb-coin)"}"/>`; }).join("")}
  ${signature ? `<circle cx="100" cy="100" r="70" fill="url(#lbb-crim)" stroke="url(#lb-brass)" stroke-width="2.4"/><path d="${raysPath(100, 100, 30, 66, 24, 0.6)}" fill="#ffcf8a" opacity=".16"/>` : `<circle cx="100" cy="100" r="68" fill="url(#lbb-enamel)"/>${astro()}`}
  ${engrave(glyph, 100, 100, signature ? 118 : 112)}
  <path d="M30 76 A72 72 0 0 1 84 26" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="7" stroke-linecap="round"/>
  <circle cx="100" cy="100" r="98" fill="none" stroke="#fff2c8" stroke-width=".8" opacity=".35"/>
</g>
${signature ? `<path d="${star4(150, 40, 14, 0.12)}" fill="#fff" class="glint"/>` : ""}
</svg>`;
}

/** A diamond brass rivet with the skill's number key, set into the medallion's bezel. */
export function keyRivet(n: number): string {
  return `<svg viewBox="0 0 30 30" class="art" aria-hidden="true"><g filter="url(#lb-sh2)"><path d="M15 1 L29 15 L15 29 L1 15Z" fill="${DARK}"/><path d="M15 3 L27 15 L15 27 L3 15Z" fill="url(#lb-brass)"/><path d="M15 6.5 L23.5 15 L15 23.5 L6.5 15Z" fill="#1b140c" stroke="#f5e1a4" stroke-opacity=".5" stroke-width=".6"/>
<text x="15" y="15.6" text-anchor="middle" dominant-baseline="central" font-family="Gambit Cinzel, serif" font-weight="800" font-size="10.5" fill="#F5E8C7">${n}</text></g></svg>`;
}

/** The turning sunburst behind the skill being aimed. */
export function selRays(): string {
  return `<svg viewBox="0 0 200 200" class="art" aria-hidden="true" overflow="visible"><path d="${raysPath(100, 100, 70, 128, 28, 0.5)}" fill="url(#lb-brass)" opacity=".85"/><path d="${raysPath(100, 100, 70, 112, 14, 0.4)}" fill="#fff2c8" opacity=".4"/></svg>`;
}

/** The small brass cost tag under a medallion is HTML; this is the padlock laid over a skill you cannot use. */
export function padlock(): string {
  return `<svg viewBox="0 0 40 46" class="art" aria-hidden="true"><g filter="url(#lb-sh2)">
<path d="M10 20 V13 A10 10 0 0 1 30 13 V20" fill="none" stroke="${DARK}" stroke-width="7"/><path d="M10 20 V13 A10 10 0 0 1 30 13 V20" fill="none" stroke="url(#lb-brass)" stroke-width="4"/>
<rect x="4" y="19" width="32" height="24" rx="3" fill="url(#lb-plate)" stroke="${DARK}" stroke-width="1.4"/>
<path d="M20 26 a3.4 3.4 0 1 1 -0.1 0 M18.6 30 H21.4 L22.4 37 H17.6Z" fill="${DARK}"/>
</g></svg>`;
}

/* ----------------------------- Turn-order locket ----------------------------- */

/**
 * A pocket-watch locket holding a face (a data URL), its enamel ring crimson for an enemy and sea-green for the
 * party; the one acting now has a sunburst behind it.
 */
export function orderLocket(img: string | null, enemy: boolean, now: boolean, dead: boolean): string {
  let knurl = "";
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    knurl += `M${f(50 + Math.cos(a) * 41)} ${f(66 + Math.sin(a) * 41)}L${f(50 + Math.cos(a) * 45)} ${f(66 + Math.sin(a) * 45)}`;
  }
  const enamel = enemy ? "#8f2219" : "#2f6f6a";
  return `<svg viewBox="0 0 100 118" class="art" aria-hidden="true" overflow="visible">
${now ? `<path d="${raysPath(50, 66, 46, 72, 24, 0.55)}" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".5" opacity=".95"/>` : ""}
<g filter="url(#lb-sh2)">
<ellipse cx="50" cy="8" rx="8" ry="6.5" fill="none" stroke="${DARK}" stroke-width="5"/><ellipse cx="50" cy="8" rx="8" ry="6.5" fill="none" stroke="url(#lb-brass)" stroke-width="3"/>
<rect x="43.5" y="14" width="13" height="9" rx="2" fill="url(#lb-cylH)" stroke="${DARK}" stroke-width=".7"/>
<circle cx="50" cy="66" r="36" fill="url(#lb-slate)"/>
${img ? `<image href="${img}" x="15" y="31" width="70" height="70" preserveAspectRatio="xMidYMid slice" clip-path="url(#lbb-ordclip)"${dead ? ' filter="url(#lb-sepia)" opacity=".55"' : ""}/>` : ""}
<circle cx="50" cy="66" r="36" fill="url(#lb-vig)" opacity=".8"/>
<circle cx="50" cy="66" r="43" fill="none" stroke="${DARK}" stroke-width="10"/>
<circle cx="50" cy="66" r="43" fill="none" stroke="url(#lb-brass)" stroke-width="7"/>
<path d="${knurl}" stroke="#3a2808" stroke-width=".8" opacity=".55"/>
<circle cx="50" cy="66" r="37.6" fill="none" stroke="${enamel}" stroke-width="3"/>
<circle cx="50" cy="66" r="36" fill="none" stroke="#f5e1a4" stroke-width=".7" opacity=".55"/>
<path d="M22 54 A31 31 0 0 1 58 36" fill="none" stroke="#fff" stroke-opacity=".26" stroke-width="5" stroke-linecap="round"/>
<circle cx="50" cy="110" r="4.4" fill="${enemy ? "url(#lbb-gemR)" : "url(#lbb-gemT)"}" stroke="${DARK}" stroke-width="1"/>
${dead ? `<path d="M26 44 L74 90 M74 44 L26 90" stroke="#1a0604" stroke-width="5" opacity=".8"/><path d="M26 44 L74 90 M74 44 L26 90" stroke="#c4544a" stroke-width="2" opacity=".85"/>` : ""}
</g></svg>`;
}

/** The brass rod the lockets hang from, with finials and a chain down to each locket (design units, w x h). */
export function orderRail(w: number, h: number, hooks: Array<{ x: number; y: number }>, railY: number): string {
  const ends = `<circle cx="10" cy="${railY}" r="9" fill="url(#lb-coin)" stroke="${DARK}" stroke-width="1.2"/><path d="${star4(10, railY, 14, 0.14)}" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".5"/>`;
  const endR = `<circle cx="${w - 10}" cy="${railY}" r="9" fill="url(#lb-coin)" stroke="${DARK}" stroke-width="1.2"/><path d="${star4(w - 10, railY, 14, 0.14)}" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".5"/>`;
  let chains = "";
  for (const h of hooks) {
    const n = Math.max(1, Math.round((h.y - railY) / 7));
    for (let i = 0; i <= n; i++) {
      const y = railY + ((h.y - railY) * i) / n;
      const ry = i % 2 ? 1.1 : 3.2;
      chains += `<ellipse cx="${f(h.x)}" cy="${f(y)}" rx="${f(i % 2 ? 3.2 : 1.6)}" ry="${f(ry)}" fill="none" stroke="${DARK}" stroke-width="2.4"/><ellipse cx="${f(h.x)}" cy="${f(y)}" rx="${f(i % 2 ? 3.2 : 1.6)}" ry="${f(ry)}" fill="none" stroke="url(#lb-brass)" stroke-width="1.3"/>`;
    }
  }
  return `<svg viewBox="0 0 ${f(w)} ${f(h)}" class="rail" aria-hidden="true" overflow="visible" preserveAspectRatio="none"><g filter="url(#lb-sh2)">
${chains}
<path d="M10 ${railY - 3.5} H${f(w - 10)} V${railY + 3.5} H10Z" fill="url(#lb-cyl)" stroke="${DARK}" stroke-width="1"/>
<path d="M10 ${railY - 2} H${f(w - 10)}" stroke="#fff6d6" stroke-width=".9" opacity=".6"/>
${ends}${endR}
</g></svg>`;
}

/* ------------------------------- Enemy plate ------------------------------- */

/** An enemy's nameplate: an obsidian cartouche with crimson enamel ends and an HP trough below (260x64). */
export function enemyPlate(): string {
  const d = "M24 2 H236 L256 22 L236 42 H24 L4 22Z";
  return `<svg viewBox="0 0 260 64" class="art" aria-hidden="true" preserveAspectRatio="none" overflow="visible"><g filter="url(#lb-sh2)">
${scroll(4, 22, 0.9)}<g transform="translate(260 0) scale(-1 1)">${scroll(4, 22, 0.9)}</g>
<path d="${d}" fill="#0c0a08" fill-opacity=".9" stroke="${DARK}" stroke-width="3"/>
<path d="M26 6 H234 L250 22 L234 38 H26 L10 22Z" fill="none" stroke="#DFC183" stroke-width="1" opacity=".8"/>
<path d="M4 22 L24 2 L30 8 L16 22 L30 36 L24 42Z M256 22 L236 2 L230 8 L244 22 L230 36 L236 42Z" fill="url(#lbb-crim)" stroke="url(#lb-brass)" stroke-width="1"/>
<path d="M40 50 H220 A6 6 0 0 1 220 62 H40 A6 6 0 0 1 40 50Z" fill="#090706" stroke="url(#lb-brass)" stroke-width="1.4"/>
</g></svg>`;
}

/* ------------------------------ Target reticle ----------------------------- */

/** An astrolabe reticle that turns over whatever can be chosen. */
export function reticle(enemy: boolean): string {
  let ticks = "";
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const l = i % 9 === 0 ? 12 : 5;
    ticks += `M${f(100 + Math.cos(a) * 88)} ${f(100 + Math.sin(a) * 88)}L${f(100 + Math.cos(a) * (88 - l))} ${f(100 + Math.sin(a) * (88 - l))}`;
  }
  const c = enemy ? "#e0604c" : "#7fd1c7";
  return `<svg viewBox="0 0 200 200" class="art" aria-hidden="true" overflow="visible">
<g class="r1"><circle cx="100" cy="100" r="92" fill="none" stroke="${DARK}" stroke-width="5"/><circle cx="100" cy="100" r="92" fill="none" stroke="url(#lb-brass)" stroke-width="2.6"/><path d="${ticks}" stroke="#f5e1a4" stroke-width="1.6"/></g>
<g class="r2"><circle cx="100" cy="100" r="70" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="14 8"/>
<path d="M100 2 L108 18 H92Z M100 198 L92 182 H108Z M2 100 L18 92 V108Z M198 100 L182 108 V92Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width="1"/></g>
<path d="${star4(100, 100, 12, 0.14)}" fill="${c}" opacity=".9"/>
</svg>`;
}

/* ------------------------------ Encounter crest ----------------------------- */

/** The encounter's diamond crest: a double brass diamond on slate around crossed sabres. */
export function crest(): string {
  const tick = `<path d="M45 0 L49 6 L45 10 L41 6Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".6"/>`;
  const blade = `<path d="M10 54 L46 10 L50 8 L48 13 L13 57Z" fill="#e9e0cc" stroke="${DARK}" stroke-width=".8"/><path d="M6 48 Q12 52 17 60 L14 61 Q9 55 4 51Z" fill="url(#lb-brass)" stroke="${DARK}" stroke-width=".7"/><path d="M8 57 L2 63" stroke="#5a2a1a" stroke-width="3.5" stroke-linecap="round"/>`;
  return `<svg viewBox="0 0 90 90" class="art" aria-hidden="true"><g filter="url(#lb-sh2)">
<path d="M45 3 L87 45 L45 87 L3 45Z" fill="url(#lbb-crim)" stroke="${DARK}" stroke-width="5"/>
<path d="M45 3 L87 45 L45 87 L3 45Z" fill="none" stroke="url(#lb-brass)" stroke-width="3.4"/>
<path d="${raysPath(45, 45, 4, 34, 16, 0.5)}" fill="#ffcf8a" opacity=".18"/>
<g transform="translate(23 22) scale(.68)">${blade}<g transform="translate(64 0) scale(-1 1)">${blade}</g></g>
<path d="M45 10 L80 45 L45 80 L10 45Z" fill="none" stroke="#c8aa6e" stroke-width="1.6"/>
${tick}<g transform="rotate(90 45 45)">${tick}</g><g transform="rotate(180 45 45)">${tick}</g><g transform="rotate(270 45 45)">${tick}</g>
</g></svg>`;
}
