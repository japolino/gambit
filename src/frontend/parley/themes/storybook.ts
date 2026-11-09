/**
 * The Storybook theme's Parley: a visual-novel conversation in the scene theme's illuminated book. The place
 * fills the window inside gilt acanthus corners; the person stands large left of centre, waist-deep behind
 * the dialogue page (mahogany cradle, scalloped gilt, vellum) that spans the bottom on its espresso skirt,
 * their name on the brass nameplate astride its rim. On the page: the conversation on the left with a
 * woodcut drop cap, a quill-spindle, and your pen on the right (a ruled line to write on). The deal and the
 * way out hang as silk ribbons with brass medallions over the painting ("What will you do?"); the fare and
 * the person's patience hang as silk bookmarks from the top of the book (a coin and a candle); the stake is
 * the chapter scroll with its astrolabe; Immersive/Transparent and "What you know" are leather index tabs on
 * the page's rim, the facts opening on a parchment folio. The view's controls are moved, never removed.
 * This file is the theme's own; see ./types.ts for what a Parley theme may provide, ./storybook/ for its parts.
 */
import type { ParleyTheme } from "./types.js";
import { FELL, GARA, CINZ } from "../style.js";
import { brocade, leather, parchment, silk } from "../../scene/themes/storybook/textures.js";
import { capTile, medal, seal } from "../../stage/themes/storybook/art.js";
import { cssUrl, picture } from "../../stage/themes/storybook/defs.js";
import { decorate } from "./storybook/decor.js";

/** The gilt edges and fold shading of a ribbon (self-contained; the cloth is a separate layer). */
const RIB_EDGE = cssUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 50" preserveAspectRatio="none">
  <linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient>
  <path d="M20,3 H356 L341,25 L356,47 H20 L3,25 Z" fill="url(#f)"/>
  <path d="M22,6.5 H349.5 L336.5,25 L349.5,43.5 H22 L7.5,25 Z" fill="none" stroke="#e0b36a" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
  <path d="M24,9.5 H344 L332.5,25 L344,40.5 H24 L11,25 Z" fill="none" stroke="#e0b36a" stroke-width=".8" stroke-dasharray="3 2" vector-effect="non-scaling-stroke" opacity=".7"/>
  <path d="M20,3 H356 L341,25 L356,47 H20 L3,25 Z" fill="none" stroke="#1a0904" stroke-width="1.2" vector-effect="non-scaling-stroke"/></svg>`);
/** The index tab's gilt rim (over tooled leather). */
const TAB_EDGE = cssUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 44" preserveAspectRatio="none">
  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1c2"/><stop offset=".3" stop-color="#d9ad62"/><stop offset=".6" stop-color="#7a4c1c"/><stop offset="1" stop-color="#e6c27a"/></linearGradient>
  <path d="M14,3 H146 L157,22 L146,41 H14 L3,22 Z M17,7.5 L8.5,22 L17,36.5 H143 L151.5,22 L143,7.5 Z" fill-rule="evenodd" fill="url(#g)"/>
  <path d="M20,11 H140 L146.5,22 L140,33 H20 L13.5,22 Z" fill="none" stroke="#d9ad62" stroke-width=".8" stroke-dasharray="2 2.4" vector-effect="non-scaling-stroke" opacity=".8"/>
  <path d="M14,3 H146 L157,22 L146,41 H14 L3,22 Z" fill="none" stroke="#2a1205" stroke-width="1.2" vector-effect="non-scaling-stroke"/></svg>`);
/** A spent patience seal: blackened wax, cracked through. */
const PIP_OFF = cssUrl(picture("-16 -16 32 32", `<path d="M0,-12 C5,-13 9,-9 12,-5 C14,0 12,6 9,9 C5,13 -2,13 -6,11 C-11,8 -13,3 -12,-3 C-11,-8 -6,-12 0,-12 Z" fill="#241010" stroke="#0c0403" stroke-width="1.2"/>
  <circle r="7" fill="none" stroke="#3d1a16" stroke-width="1.4"/>
  <path d="M-3,-12 L-1,-5 L-5,0 L-1,4 L-3,12 M-1,4 L5,7" fill="none" stroke="#000" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M-2,-11 L0,-5 L-4,0 L0,4" fill="none" stroke="#6a4030" stroke-width=".6" opacity=".7"/>`));
/** A d20 in dark bronze with gilt facet lines (the number is the die's own text, set over it). */
const D20 = (core: string) => cssUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">
  <radialGradient id="c" cx=".5" cy=".55" r=".5"><stop offset="0" stop-color="${core}"/><stop offset="1" stop-color="#1e130c"/></radialGradient>
  <path d="M50,0 L93,25 L93,75 L50,100 L7,75 L7,25 Z" fill="url(#c)"/>
  <g fill="none" stroke="#e6c267" stroke-width="3" stroke-linejoin="round"><path d="M50,22 L80,70 L20,70 Z"/><path d="M50,0 L50,22 M93,25 L80,70 M93,75 L80,70 M50,100 L80,70 M50,100 L20,70 M7,75 L20,70 M7,25 L20,70 M7,25 L50,22 M93,25 L50,22"/></g>
  <path d="M50,1.5 L91.5,25.8 L91.5,74.2 L50,98.5 L8.5,74.2 L8.5,25.8 Z" fill="none" stroke="#f3d078" stroke-width="3"/></svg>`);
/** A white plume with a gilt nib, aslant: the pen in the quill strip. */
const QUILL = cssUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
  <g transform="rotate(-35 20 20)">
    <path d="M20,1 C28,6 29,18 23,30 L20,33 L17,30 C11,18 12,6 20,1 Z" fill="#f8f1e2" stroke="#6b4a2a" stroke-width=".9"/>
    <path d="M20,3 V31" stroke="#a88a62" stroke-width=".9"/>
    <path d="M20,9 L25,6 M20,13 L26,10 M20,17 L26,15 M20,21 L25,20 M20,9 L15,6 M20,13 L14,10 M20,17 L14,15 M20,21 L15,20" stroke="#cbb89a" stroke-width=".6"/>
    <path d="M18,30 H22 L21.5,35 L20,39 L18.5,35 Z" fill="#e3b85e" stroke="#5a3816" stroke-width=".8"/>
    <path d="M20,33.5 V37" stroke="#5a3816" stroke-width=".6"/></g></svg>`);
/** The fleuron at the middle of the gilt rule over your pen. */
const FLEURON = cssUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-30 -8 60 16"><g fill="#a8742f" stroke="#5a3816" stroke-width=".6">
  <path d="M0,-6 L5,0 L0,6 L-5,0 Z"/><circle cx="-9" r="1.8"/><circle cx="9" r="1.8"/>
  <path d="M-12,0 C-16,-5 -22,-5 -26,0 C-22,3 -17,2 -14,-1" fill="none" stroke="#a8742f" stroke-width="1.2"/>
  <path d="M12,0 C16,-5 22,-5 26,0 C22,3 17,2 14,-1" fill="none" stroke="#a8742f" stroke-width="1.2"/></g></svg>`);
const GILT = "#d9ad62";
const RIB_CLIP = "polygon(14px 6%, 100% 6%, calc(100% - 15px) 50%, 100% 94%, 14px 94%, 2px 50%)";
const TAB_CLIP = "polygon(9% 6%, 91% 6%, 98% 50%, 91% 94%, 9% 94%, 2% 50%)";

/** The book's geometry, set in px by ./storybook/decor.ts (defaults for the first paint). */
const GEO = `--dw: 1600px; --dh: 300px; --db: 24px; --dx: 160px;
  --cw: clamp(150px, min(21cqw, 34cqh), 360px); --hh: clamp(70px, 11cqh, 108px); --hx: max(2.2cqw, calc(var(--cw) * .42));
  --bw: clamp(100px, 13cqh, 132px); --bh: calc(var(--bw) * 1.9); --br: calc(var(--cw) + 1.6cqw);
  --rw: clamp(300px, 40cqh, 400px); --rh: clamp(44px, 5.2cqh, 54px); --fs: clamp(16px, 2.15cqh, 24px);
  --sx: max(4cqw, calc(var(--dx) + 24px)); --na: 2;`;

function css(): string {
  const folio = parchment(900, 1200, 13);
  const slip = parchment(420, 90, 21);
  const hide = leather(33, "brown");
  const cloth = {
    deal: silk("#1f3326", true, 12),
    walk: brocade("#5a1a1c", "#f0c27a"),
    say: brocade("#2a0d0c", "#c4553a", 3),
  };
  const P = ".pl.th-storybook";
  const Ph = `${P}.pl-phone`;
  const S = `${P}.pl-short`;
  return `
${P} { ${GEO}
  --p-font: 500 var(--fs)/1.45 ${GARA}; --p-ui: ${CINZ}; --p-prose: ${FELL};
  --p-ink: #2b170a; --p-dim: #7a5a3a; --p-faint: #8a6a4a; --p-soft: #52341e; --p-em: #6b2a12;
  --p-accent: #8b1a1a; --p-accent-ink: #fff0cf; --p-hot: #ffd27a; --p-edge: rgba(122,74,30,.45); --p-rule: rgba(122,74,30,.35);
  --p-die: linear-gradient(135deg, #fff1c2, #d9ad62 45%, #8a5a2a); --p-die-ink: #3a1a08; --p-die-kept: linear-gradient(135deg, #fff8dc, #ffd27a 45%, #b8862f);
  display: block; container-type: size; overflow: hidden; background: #120a06; color: var(--p-ink); }
${P} svg { overflow: visible; }

/* ---------- The painting, its light, the cast ---------- */
${P} .scene { position: absolute; inset: 0; background: #120a06; }
${P} .plate { inset: -4%; translate: calc(var(--px, 0) * -10px) calc(var(--py, 0) * -6px); transition: translate .6s ease-out; }
${P} .plate-canvas, ${P} .plate-img { filter: sepia(.2) saturate(.92) contrast(1.04) brightness(.92); }
${P} .vignette { z-index: 2; background: radial-gradient(ellipse 78% 70% at 46% 40%, transparent 50%, rgba(18,9,4,.55) 80%, rgba(10,5,2,.92) 100%), linear-gradient(180deg, rgba(10,5,2,.5), transparent 16%, transparent 56%, rgba(10,5,2,.8) 100%); box-shadow: inset 0 0 140px rgba(18,9,4,.85); }
${P} .sbp-light { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
${P} .sbp-light .rays { position: absolute; right: -4%; top: -6%; width: 80%; height: 92%; mix-blend-mode: screen; opacity: .55; }
${P} .sbp-light .motes { position: absolute; inset: 0; width: 100%; height: 100%; mix-blend-mode: screen; }
${P} .figure { z-index: 1; left: 0; right: 32cqw; bottom: -30cqh; height: 128cqh; translate: calc(var(--px, 0) * -4px) 0; transition: translate .6s ease-out; }
${P} .face { filter: sepia(.14) drop-shadow(-14px 22px 24px rgba(12,5,2,.8)); }
/* An opaque portrait stands in a gilt arch, its foot behind the page. */
${P} .fig.framed { height: 78cqh; aspect-ratio: 260 / 400; margin-bottom: calc(var(--db) + var(--dh) + 24cqh); background: none; border-radius: 0; }
${P} .fig.framed::before { content: ""; position: absolute; inset: 0; clip-path: inset(14.5% 17.7% .5% 17.7% round 50% 50% 0 0 / 27% 27% 0 0); background: radial-gradient(80% 60% at 50% 30%, #5a3418, #120604); }
${P} .fig.framed .face { border-radius: 0; box-shadow: none; object-position: 50% 18%; clip-path: inset(14.5% 17.7% .5% 17.7% round 50% 50% 0 0 / 27% 27% 0 0); filter: sepia(.18) saturate(.9) contrast(1.04); }
${P} .fig.framed::after { clip-path: inset(14.5% 17.7% .5% 17.7% round 50% 50% 0 0 / 27% 27% 0 0); border-radius: 0; background: radial-gradient(90% 70% at 50% 40%, transparent 55%, rgba(12,5,2,.7)); }
${P} .sbp-arch { display: none; position: absolute; inset: 0; z-index: 2; pointer-events: none; }
${P} .fig.framed .sbp-arch { display: block; }
${P} .sbp-arch svg { width: 100%; height: 100%; display: block; }
${P} .silhouette { background: radial-gradient(60% 40% at 50% 22%, rgba(233,197,122,.25), rgba(42,18,6,.85) 70%); color: rgba(255,240,207,.5); font-family: ${FELL}; }

/* ---------- The proscenium corners ---------- */
${P} .sbp-corners { position: absolute; inset: 0; z-index: 8; pointer-events: none; translate: calc(var(--px, 0) * -5px) calc(var(--py, 0) * -3px); transition: translate .6s ease-out; }
${P} .sbp-corners .c { position: absolute; width: var(--cw); aspect-ratio: 380 / 260; }
${P} .sbp-corners .c svg { width: 100%; height: 100%; display: block; }
${P} .sbp-corners .tl { left: -6px; top: -6px; } ${P} .sbp-corners .tr { right: -6px; top: -6px; transform: scaleX(-1); }
${P} .sbp-corners .bl { left: -6px; bottom: -6px; transform: scaleY(-1); width: calc(var(--cw) * .7); }
${P} .sbp-corners .br { right: -6px; bottom: -6px; transform: scale(-1,-1); width: calc(var(--cw) * .7); }

/* ---------- The book: skirt and page ---------- */
${P} .sbp-book { position: absolute; inset: 0; z-index: 3; pointer-events: none; }
${P} .sbp-book .skirt { position: absolute; left: 0; right: 0; bottom: 0; }
${P} .sbp-book .skirt svg { display: block; }
${P} .sbp-book .dlg { position: absolute; left: var(--dx); bottom: var(--db); width: var(--dw); height: var(--dh); }
${P} .sbp-book .dlg > .back, ${P} .sbp-book .dlg > .front { position: absolute; left: -78px; top: -26px; }
${P} .sbp-book .dlg svg { display: block; }
${P} .sbp-book .vellum { position: absolute; inset: 0; background-size: 100% 100%; }
${P} .sbp-book .dv { display: none; }

/* ---------- The side panel dissolves onto the page ---------- */
${P} .side { display: contents; }
${P} .head, ${P} .title-row, ${P} .meter, ${P} .foot { display: contents; }

/* The conversation fills the page above your pen; scrolled lines fade under the rim rather than being cut. */
${P} .log { position: absolute; z-index: 4; left: calc(var(--dx) + 60px); width: calc(var(--dw) - 120px); bottom: calc(var(--db) + 84px); top: calc(100cqh - var(--db) - var(--dh) + 24px); height: auto;
  padding: 18px 8px 6px 0; gap: .45em; font-size: var(--fs); scrollbar-width: none; overscroll-behavior: contain;
  -webkit-mask-image: linear-gradient(transparent, #000 14px, #000 calc(100% - 8px), transparent); mask-image: linear-gradient(transparent, #000 14px, #000 calc(100% - 8px), transparent); }
${P} .log > * { max-width: min(100%, 64em); }
${P} .log::-webkit-scrollbar { display: none; }
${P} .setting { font: italic 400 .8em/1.4 ${FELL}; color: #6b4a2a; }
${P} .speaker { font: 800 clamp(10px, 1.2cqh, 12px)/1 ${CINZ}; letter-spacing: .24em; text-transform: uppercase; color: #8a5a2a; margin-bottom: .3em; }
${P} .npc .prose { font: 400 1em/1.42 ${FELL}; color: #261409; }
${P} .npc .prose em { color: #7a1c1c; }
${P} .log > .npc:last-child .prose { font-size: 1.04em; color: #23140b; }
/* The woodcut drop cap (./storybook/decor.ts sets it), tight against the rest of its word, which goes in small caps. */
${P} .npc .prose > p:first-child { display: flow-root; }
${P} .sbp-dc { float: left; width: 1.62em; height: 1.62em; margin: .1em 1px 0 0; display: grid; place-items: center; padding-top: .06em;
  font: 800 1.5em/1 ${CINZ}; font-style: normal; color: #ffe7b0; text-shadow: 0 1px 0 #2a0606, 0 0 3px #2a0606; background: ${cssUrl(capTile())} center / 100% 100% no-repeat; }
${P} .sbp-dc.lone { margin-right: .3em; }
${P} .sbp-fw { font-variant: small-caps; letter-spacing: .04em; font-weight: 600; }
${P} .you { align-self: stretch; max-width: none; background: none; border: 0; border-left: 2px solid rgba(139,26,26,.45); border-radius: 0; padding: .1em 0 .1em .8em; box-shadow: none; }
${P} .you .speaker { text-align: left; color: #8b1a1a; }
${P} .you .prose { font: italic 500 .84em/1.4 ${GARA}; color: #4a2511; }
${P} .read { border-left: 2px dotted #a8742f; padding-left: .8em; gap: 4px; font-size: .8em; }
/* On a desktop page the roll and its tell share one row, so a whole beat fits the page at once. */
${P}:not(.pl-phone) .read { display: flex; flex-wrap: wrap; align-items: center; column-gap: 14px; row-gap: 4px; }
${P}:not(.pl-phone) .read > * { flex: 1 1 100%; }
${P}:not(.pl-phone) .read > .tray, ${P}:not(.pl-phone) .read > .imm { flex: 0 1 auto; }
${P}:not(.pl-phone) .read > .imm { flex: 1 1 320px; line-height: 1.3; }
${P} .tray { gap: 10px; }
${P} .die { width: 38px; height: 38px; padding-top: 3px; font: 700 16px/1 ${CINZ}; color: #fff5d6; text-shadow: 0 1px 2px #000; background: ${D20("#3a2416")} center / 100% 100% no-repeat; filter: drop-shadow(0 2px 2px rgba(40,20,5,.55)); }
${P} .die.kept { box-shadow: none; transform: scale(1.08); background: ${D20("#8a2a1e")} center / 100% 100% no-repeat; filter: drop-shadow(0 0 6px rgba(184,134,11,.85)); }
${P} .die.nat20 { background: ${D20("#c0392b")} center / 100% 100% no-repeat; }
${P} .die.nat1 { background: ${D20("#120806")} center / 100% 100% no-repeat; color: #e0645a; }
${P} .result { display: inline-flex; align-items: center; height: 24px; padding: 0 12px; font: 800 12px/1 ${CINZ}; letter-spacing: .16em; color: #f3d078; background: #6e1919;
  box-shadow: 0 0 0 1px #e6c267, 0 0 0 2.5px #2a0a06, 0 2px 4px rgba(40,10,5,.4); clip-path: polygon(0 0, 100% 0, calc(100% - 8px) 50%, 100% 100%, 0 100%); padding-right: 20px; }
${P} .r-crit_success { color: #ffe08a; background: #7a1414; } ${P} .r-success { color: #f3d078; background: #2c4a26; } ${P} .r-partial { color: #f3d078; background: #5a3a16; } ${P} .r-fail { color: #e8d6b6; background: #4a3a30; } ${P} .r-crit_fail { color: #ffb0a0; background: #2a0a06; }
${P} .imm { font: italic 400 .98em/1.4 ${FELL}; color: #4a2511; }
${P} .trn { font: 13px/1.45 ${GARA}; color: #52341e; }
${P} .tier { border-color: #a8742f; border-radius: 2px; font-family: ${CINZ}; font-size: 10px; letter-spacing: .1em; }
${P} .tier.t0 { border-color: #8b1a1a; color: #8b1a1a; } ${P} .tier.t1 { color: #8a4a1a; } ${P} .tier.t3 { color: #2f6b2a; } ${P} .tier.t4 { border-color: #9a6a00; color: #9a6a00; }
${P} .why summary { color: #8b1a1a; }

/* Your pen: a quill strip across the foot of the page, under a gilt rule with a fleuron. */
${P} .composer { position: absolute; z-index: 4; left: calc(var(--dx) + 54px); width: calc(var(--dw) - 114px); bottom: calc(var(--db) + 22px); height: 54px;
  grid-template-columns: 40px 1fr auto; gap: 12px; align-items: center; }
${P} .composer::before { content: ""; width: 40px; height: 40px; background: ${QUILL} center / contain no-repeat; filter: drop-shadow(0 2px 2px rgba(60,30,10,.4)); }
${P} .composer::after { content: ""; position: absolute; left: 0; right: 0; top: -16px; height: 14px; pointer-events: none;
  background: ${FLEURON} center / 60px 14px no-repeat, linear-gradient(90deg, transparent, #a8742f 6%, #a8742f calc(50% - 34px), transparent calc(50% - 33px), transparent calc(50% + 33px), #a8742f calc(50% + 34px), #a8742f 94%, transparent) center / 100% 1.5px no-repeat; }
${P} .composer textarea { height: 46px; min-height: 0; padding: 11px 14px 0; font: italic 400 clamp(16px, 2cqh, 20px)/1.25 ${FELL}; color: #2b170a; border: 0; border-radius: 3px; overflow-y: auto; scrollbar-width: none;
  background: linear-gradient(rgba(110,70,30,.16), rgba(255,246,220,.22)); box-shadow: inset 0 2px 5px rgba(80,45,15,.35), inset 0 0 0 1px rgba(122,74,30,.28), 0 1px 0 rgba(255,250,235,.55); }
${P} .composer textarea:focus { outline: none; box-shadow: inset 0 2px 5px rgba(80,45,15,.35), inset 0 0 0 1.5px #b8862f, 0 0 0 3px rgba(255,210,122,.35); }
${P} .composer textarea::placeholder { color: #8f6e4e; }
${P} .composer textarea:disabled::placeholder { color: transparent; }
${P} .status { position: absolute; z-index: 5; left: calc(var(--dx) + 124px); bottom: calc(var(--db) + 22px); height: 54px; display: flex; align-items: center; pointer-events: none; font: italic 400 clamp(16px, 1.9cqh, 19px)/1.2 ${FELL}; color: #7a3b16; min-height: 0; }
${P} .status.muted { visibility: hidden; }
${P} .say { position: relative; z-index: 0; height: 48px; min-width: 132px; padding: 0 26px 0 54px; border: 0; border-radius: 0; background: none; color: #fdf0d5;
  font: 600 clamp(16px, 2cqh, 20px)/1 ${GARA}; text-shadow: 0 2px 2px rgba(0,0,0,.85); text-transform: none; letter-spacing: .02em; box-shadow: none; filter: drop-shadow(0 6px 8px rgba(0,0,0,.45)); }
${P} .say::after { content: ""; position: absolute; inset: 0 0 0 22px; z-index: -1; clip-path: ${RIB_CLIP}; background: ${RIB_EDGE} 0 0 / 100% 100%, url(${cloth.say}) 0 0 / 64px 64px; }
${P} .say::before { content: ""; position: absolute; left: -4px; top: 50%; width: 54px; aspect-ratio: 1; translate: 0 -50%; background: ${cssUrl(medal("talk"))} center / contain no-repeat; transition: rotate .5s cubic-bezier(.3,1.5,.5,1); }
${P} .say:hover:not(:disabled)::before, ${P} .say:focus-visible::before { rotate: -14deg; }
${P} .say:hover:not(:disabled), ${P} .say:focus-visible { filter: brightness(1.12) drop-shadow(0 6px 8px rgba(0,0,0,.45)); }
/* Where your words go is said by the view; on the page it would read as a disclaimer, so only a screen reader hears it. */
${P} .hint { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
${P} .end.show { position: absolute; z-index: 5; left: calc(var(--dx) + 60px); width: calc(var(--dw) - 120px); bottom: calc(var(--db) + 18px); display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-start; gap: 6px 22px;
  padding: 28px 0 0; background: linear-gradient(rgba(239,224,189,0), rgba(239,224,189,.96) 26px); text-align: left; }
${P} .end .reveals { flex: 1 0 100%; }
${P} .end-title { font: 400 clamp(24px, 3.2cqh, 34px)/1.1 ${FELL}; color: #8b1a1a; }
${P} .end-sub { font: italic 400 .9em ${FELL}; color: #52341e; }
${P} .reveals { font-size: .85em; }

/* The deal and the way out: silk ribbons over the painting, on the right. */
${P} .actions { position: absolute; z-index: 5; right: var(--sx); bottom: calc(var(--db) + var(--dh) + 34px); width: var(--rw); flex-direction: column; flex-wrap: nowrap; gap: clamp(6px, 1cqh, 10px); }
${P} .actions::before { content: "What will you do?"; font: italic 400 clamp(20px, 2.7cqh, 28px)/1.2 ${FELL}; color: #fbe8bf; text-align: center; padding: 4px 0 6px 24px;
  text-shadow: 0 2px 12px #000, 0 0 24px #000, 0 0 3px #000; background: radial-gradient(ellipse 50% 60% at 55% 55%, rgba(12,6,3,.78), rgba(12,6,3,.3) 60%, transparent 75%); }
${P} .actions button, ${P} .leave { position: relative; z-index: 0; display: flex; align-items: center; height: var(--rh); padding: 0 40px 0 calc(var(--rh) + 10px); border: 0; border-radius: 0; background: none; text-align: left;
  font: 600 clamp(16px, 2cqh, 20px)/1.1 ${GARA}; letter-spacing: .01em; text-transform: none; color: #fdf0d5; text-shadow: 0 2px 2px rgba(0,0,0,.85); clip-path: none;
  filter: drop-shadow(0 6px 8px rgba(0,0,0,.55)); transition: translate .4s cubic-bezier(.3,1.5,.45,1), filter .25s; }
${P} .actions button::after, ${P} .leave::after { content: ""; position: absolute; inset: 0 0 0 calc(var(--rh) * .45); z-index: -1; clip-path: ${RIB_CLIP}; background: ${RIB_EDGE} 0 0 / 100% 100%, url(${cloth.walk}) 0 0 / 64px 64px; }
${P} .actions .deal::after { background: ${RIB_EDGE} 0 0 / 100% 100%, url(${cloth.deal}) 0 0 / 256px 64px; }
${P} .actions button::before, ${P} .leave::before { content: ""; position: absolute; left: -4px; top: 50%; width: calc(var(--rh) * 1.12); aspect-ratio: 1; translate: 0 -50%; background: ${cssUrl(medal("back"))} center / contain no-repeat; transition: rotate .5s cubic-bezier(.3,1.5,.5,1); }
${P} .actions .deal::before { background-image: ${cssUrl(medal("check"))}; }
${P} .actions button:hover, ${P} .actions button:focus-visible, ${P} .leave:hover, ${P} .leave:focus-visible { translate: -12px 0; filter: brightness(1.14) drop-shadow(0 0 7px rgba(255,210,122,.7)); color: #fff; }
${P} .actions button:hover::before, ${P} .actions button:focus-visible::before, ${P} .leave:hover::before { rotate: -14deg; }
${P} .actions button:focus-visible, ${P} .say:focus-visible, ${P} .leave:focus-visible { outline: none; }
${P} .actions button:disabled { filter: saturate(.5) brightness(.8) drop-shadow(0 6px 8px rgba(0,0,0,.55)); }
${P} .leave { margin-top: 0; min-width: 180px; }

/* What you know: wax-sealed parchment slips stacked over the painting above the deal; a slip cites its fact in your next line. */
${P} .hand { display: flex; position: absolute; z-index: 5; right: var(--sx); width: calc(var(--rw) + 40px); top: calc(var(--bh) + 12px);
  bottom: calc(var(--db) + var(--dh) + 34px + clamp(36px, 4.4cqh, 46px) + var(--na) * (var(--rh) + clamp(6px, 1cqh, 10px)) + 8px);
  flex-direction: column; align-items: stretch; gap: 5px; overflow-y: auto; scrollbar-width: none; padding: 4px 4px 4px 16px; filter: drop-shadow(0 6px 8px rgba(0,0,0,.6)); }
${P} .hand::-webkit-scrollbar { display: none; }
${P} .hand::before { content: "What you know" attr(data-tally); margin-top: auto; text-align: right; padding-right: 4px; font: italic 400 clamp(17px, 2.2cqh, 22px)/1.2 ${FELL}; color: #fbe8bf; text-shadow: 0 2px 10px #000, 0 0 3px #000; }
${P} .fact-card { position: relative; flex: none; min-height: clamp(38px, 4.2cqh, 46px); padding: 5px 14px 5px clamp(44px, 5cqh, 52px); border: 0; border-radius: 0; text-align: left; cursor: pointer;
  font: 600 clamp(13.5px, 1.45cqh, 16px)/1.18 ${GARA}; color: #23140b; background: url(${slip}) center / cover;
  clip-path: polygon(0 4%, 3% 0, 22% 3%, 41% 0, 63% 2%, 82% 0, 100% 3%, 99% 34%, 100% 66%, 98% 100%, 76% 97%, 55% 100%, 33% 97%, 12% 100%, 1% 97%, 0 62%);
  transition: translate .3s cubic-bezier(.3,1.5,.5,1), filter .2s; }
${P} .fact-card::before { content: ""; position: absolute; left: 6px; top: 50%; width: clamp(32px, 3.8cqh, 40px); aspect-ratio: 1; translate: 0 -50%; background: ${cssUrl(seal())} center / contain no-repeat; transition: rotate .4s cubic-bezier(.3,1.5,.5,1); }
${P} .fact-card:hover, ${P} .fact-card:focus-visible { translate: -12px 0; outline: none; filter: brightness(1.07); box-shadow: inset 0 0 0 2px #d9ad62, inset 0 0 18px rgba(255,210,122,.55); }
${P} .fact-card:hover::before, ${P} .fact-card:focus-visible::before { rotate: -18deg; }
${P} .fact-card.used { order: 1; padding-right: 70px; color: #6a4a2a; filter: saturate(.7) brightness(.92); }
${P} .fact-card.used::after { content: "Used"; position: absolute; right: 10px; top: 50%; translate: 0 -50%; rotate: -10deg; padding: 1px 7px; border: 2px solid rgba(139,26,26,.75); border-radius: 2px;
  font: 800 11px/1.3 ${CINZ}; letter-spacing: .16em; text-transform: uppercase; color: rgba(139,26,26,.85); }
/* A very wide window has room for the facts beside the deal rather than above it. */
@container (min-aspect-ratio: 2/1) {
  ${P}:not(.pl-phone) .hand { right: calc(var(--sx) + var(--rw) + 28px); top: 16cqh; bottom: calc(var(--db) + var(--dh) + 34px); }
}

/* ---------- The speaker's nameplate astride the page's rim ---------- */
${P} .plaque { position: absolute; z-index: 5; left: calc(var(--dx) + 44px); bottom: calc(var(--db) + var(--dh) - 26px); height: clamp(44px, 5.6cqh, 54px); display: flex; align-items: center; gap: .6em;
  padding: 0 calc(clamp(44px, 5.6cqh, 54px) * .95); border: 0; background: none; box-shadow: none; translate: none; text-align: left; white-space: nowrap; max-width: calc(var(--dw) * .58); filter: drop-shadow(0 6px 8px rgba(0,0,0,.6)); }
${P} .plaque::before, ${P} .plaque::after { content: none; }
${P} .sbp-band { position: absolute; inset: 0 calc(clamp(44px, 5.6cqh, 54px) * .86); z-index: -1; }
${P} .sbp-band svg, ${P} .sbp-cap svg { width: 100%; height: 100%; display: block; }
${P} .sbp-cap { position: absolute; top: 0; bottom: 0; width: calc(clamp(44px, 5.6cqh, 54px) * .9); z-index: -1; }
${P} .sbp-cap.l { left: 0; } ${P} .sbp-cap.r { right: 0; }
${P} .plaque .who { font: 700 clamp(19px, 2.6cqh, 27px)/1 ${GARA}; color: #ffefc7; text-shadow: 0 2px 3px #000; letter-spacing: .02em; }
${P} .plaque .role { font: italic 500 clamp(13px, 1.6cqh, 16px)/1 ${GARA}; letter-spacing: .01em; text-transform: none; color: #e9c57a; opacity: 1; margin: 0; max-width: none; overflow: hidden; }
${P} .plaque .role::before { content: "· "; color: #a8742f; }
${P} .tell { z-index: 5; top: 15cqh; left: 40cqw; font: italic 400 clamp(19px, 2.6cqh, 27px)/1.3 ${FELL}; color: #fbe8bf; padding: .4em 1.4em;
  text-shadow: 0 2px 12px #000, 0 0 3px #000; background: radial-gradient(ellipse 50% 60% at 50% 55%, rgba(12,6,3,.75), rgba(12,6,3,.25) 65%, transparent 78%); }

/* ---------- The chapter header: the stake ---------- */
${P} .sbp-head { position: absolute; z-index: 5; top: 2.4cqh; left: var(--hx); height: var(--hh); display: flex; align-items: center; pointer-events: none; filter: drop-shadow(0 10px 14px rgba(0,0,0,.6)); }
${P} .sbp-head .astro { height: 100%; aspect-ratio: 1; position: relative; z-index: 2; flex: none; }
${P} .sbp-head .astro svg { width: 100%; height: 100%; display: block; }
${P} .sbp-head .scroll { position: relative; height: 82%; margin-left: -6%; width: clamp(280px, 30cqw, 520px); }
${P} .sbp-head .scroll .band { position: absolute; inset: 0; } ${P} .sbp-head .scroll .band svg { width: 100%; height: 100%; display: block; }
${P} .sbp-head .scroll .end { position: absolute; right: -2%; top: -12%; height: 124%; aspect-ratio: 40 / 110; translate: 50% 0; }
${P} .sbp-head .scroll .end svg { width: 100%; height: 100%; display: block; }
/* The title sits between the scroll's rules, in two lines at most: a long one (--n: its length) gets smaller type. */
${P} .kind { position: absolute; z-index: 6; top: calc(2.4cqh + var(--hh) * .27); left: calc(var(--hx) + var(--hh) * .96 + 26px); width: calc(clamp(280px, 30cqw, 520px) - 70px); height: calc(var(--hh) * .52);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; align-content: center; padding: 0;
  font: italic 400 max(13px, min(clamp(17px, 2.5cqh, 26px), calc((clamp(280px, 30cqw, 520px) - 70px) * 2 / (var(--n, 1) * .42))))/1 ${FELL}; letter-spacing: 0; text-transform: none; color: #3a1a08; text-shadow: 0 1px 0 rgba(255,246,220,.6); background: none; box-shadow: none; border-radius: 0; }
${P} .kind::first-letter { text-transform: uppercase; }

/* ---------- Bookmarks: the fare and the person's patience ---------- */
${P} .sbp-marks { position: absolute; z-index: 5; top: 0; right: var(--br); display: flex; flex-direction: row-reverse; gap: 14px; pointer-events: none; }
${P} .sbp-marks .bm { width: var(--bw); height: var(--bh); filter: drop-shadow(0 8px 10px rgba(0,0,0,.5)); }
${P} .sbp-marks .bm svg { width: 100%; height: 100%; display: block; }
${P} .sbp-marks .bm svg g[transform] { transform-box: fill-box; }
${P} .meter-label, ${P} .meter-value, ${P} .bar, ${P} .patience { position: absolute; z-index: 6; right: var(--br); width: var(--bw); box-sizing: border-box; text-align: center; }
${P} .meter-label { top: calc(var(--bh) * .37); font: 800 clamp(10px, 1.2cqh, 13px)/1 ${CINZ}; letter-spacing: .2em; text-transform: uppercase; color: #f6dfae; text-shadow: 0 1px 2px #000; }
${P} .meter-value { top: calc(var(--bh) * .44); display: flex; flex-direction: column; align-items: center; gap: 0; font: 400 clamp(16px, 2.2cqh, 23px)/1.05 ${FELL}; color: #fff1cf; text-shadow: 0 2px 3px #000, 0 0 2px #000; padding: 0 calc(var(--bw) * .16); }
${P} .sbp-num { font: 700 clamp(22px, 2.7cqh, 30px)/1 ${CINZ}; color: #fff4d6; }
${P} .sbp-unit { font: italic 600 clamp(12px, 1.35cqh, 15px)/1.2 ${GARA}; color: #f6dfae; }
${P} .delta { font: italic 600 .62em ${FELL}; }
${P} .delta.down { color: #b8f0a8; } ${P} .delta.up { color: #ffb0a0; }
/* The fare's gauge stands upright in the banner's field, filling from the bottom. */
${P} .bar { top: calc(var(--bh) * .74); left: auto; right: calc(var(--br) + var(--bw) / 2 - var(--bh) * .1); width: calc(var(--bh) * .2); height: 10px; rotate: -90deg; border-radius: 5px; background: rgba(0,0,0,.55); box-shadow: 0 0 0 1.5px ${GILT}, 0 0 0 2.5px #2a1205, inset 0 1px 2px #000; overflow: hidden; }
${P} .bar .fill { background: linear-gradient(90deg, #7a4c1c, #e9c57a 55%, #fff1c2); }
${P} .patience { right: calc(var(--br) + var(--bw) + 14px); top: calc(var(--bh) * .37); display: flex; flex-wrap: wrap; justify-content: center; align-content: flex-start; gap: 4px; padding: 0 calc(var(--bw) * .18); }
${P} .patience .pl-label { flex: 0 0 100%; margin: 0 0 6px; font: 800 clamp(10px, 1.2cqh, 13px)/1 ${CINZ}; letter-spacing: .2em; color: #f6dfae; text-shadow: 0 1px 2px #000; }
${P} .pip { width: clamp(15px, 1.8cqh, 19px); height: clamp(15px, 1.8cqh, 19px); border: 0; border-radius: 0; background: ${PIP_OFF} center / contain no-repeat; }
${P} .pip.on { background: ${cssUrl(seal())} center / contain no-repeat; box-shadow: none; }
${P} .sbp-marks .pat .sbp-flame { transform-box: fill-box; transform-origin: 50% 100%; scale: 1 calc(.35 + var(--patience, 1) * .65); animation: sbpFlicker 1.6s ease-in-out infinite alternate; }
@keyframes sbpFlicker { from { rotate: -4deg; } to { rotate: 4deg; } }

/* ---------- Index tabs on the rim: the view mode, and what you know ---------- */
${P} .mode { position: absolute; z-index: 6; right: calc(var(--dx) + 70px); bottom: calc(var(--db) + var(--dh) - 16px); display: flex; gap: 6px; border: 0; border-radius: 0; overflow: visible; background: none; }
${P} .mode button, ${P} .journal-btn { position: relative; z-index: 0; height: 30px; width: auto; padding: 0 18px; border: 0; border-radius: 0; color: #f3d791;
  font: 800 11px/1 ${CINZ}; letter-spacing: .14em; text-transform: uppercase; text-shadow: 0 1px 2px #000; background: none;
  filter: drop-shadow(0 4px 5px rgba(0,0,0,.5)); transition: translate .3s cubic-bezier(.3,1.5,.5,1), filter .2s; cursor: pointer; }
${P} .mode button::after, ${P} .journal-btn::after { content: ""; position: absolute; inset: 0; z-index: -1; clip-path: ${TAB_CLIP}; background: ${TAB_EDGE} 0 0 / 100% 100%, url(${hide}) center / 160px; }
${P} .mode button.on { translate: 0 -4px; color: #fff3cf; filter: brightness(1.25) drop-shadow(0 0 8px rgba(255,200,110,.55)); background: none; }
${P} .mode button:hover, ${P} .journal-btn:hover, ${P} .mode button:focus-visible, ${P} .journal-btn:focus-visible { translate: 0 -4px; filter: brightness(1.15) drop-shadow(0 4px 5px rgba(0,0,0,.5)); outline: none; }
${P} .mode button:focus-visible, ${P} .journal-btn:focus-visible { color: #fff; text-decoration: underline 1px #ffd27a; text-underline-offset: 3px; }
/* The facts are slips over the painting, so on a desktop the journal's tab and list are not needed (a phone docks them). */
${P} .journal-btn { display: none; position: absolute; z-index: 6; margin: 0; }
${P} .journal-btn::before { content: none; }
${P} .journal { display: none; }
${P} .journal li { position: relative; margin: .35em 0; }
${P} .journal li::before { content: "❧"; position: absolute; left: -1.2em; color: #9c3b26; }
${P} .journal li.used { color: #8a6a4a; text-decoration: line-through rgba(139,26,26,.4); }
${P} .journal li.empty { margin-left: 0; color: #7a5a3a; font-style: italic; }
${P} .journal li.empty::before { content: ""; }

/* ---------- Moments ---------- */
/* Moments: illuminated plates pinned in the left margin, tilted, with gilt corner mounts; the caption shows on hover. */
${P} .moments { z-index: 6; left: calc(var(--hx) + 10px); right: auto; top: calc(2.4cqh + var(--hh) + 26px); bottom: auto; flex-direction: column; gap: clamp(14px, 2.4cqh, 26px); }
${P} .moments button { position: relative; width: clamp(110px, 16cqh, 180px); height: auto; aspect-ratio: 18 / 13; padding: 7px; border: 0; border-radius: 0; overflow: visible; rotate: -3deg;
  background: url(${slip}) center / cover; box-shadow: 0 0 0 1px #6a4a22, 0 12px 20px rgba(0,0,0,.65); transition: rotate .4s cubic-bezier(.3,1.5,.5,1), scale .4s; }
${P} .moments button:nth-child(even) { rotate: 2deg; }
${P} .moments img { box-shadow: 0 0 0 1px #2a1205; }
${P} .moments button::after { content: ""; position: absolute; inset: -3px; pointer-events: none;
  background: linear-gradient(135deg, ${GILT} 0 11px, #5a3816 11px 12.5px, transparent 13px) 0 0 / 30px 30px no-repeat, linear-gradient(225deg, ${GILT} 0 11px, #5a3816 11px 12.5px, transparent 13px) 100% 0 / 30px 30px no-repeat,
    linear-gradient(45deg, ${GILT} 0 11px, #5a3816 11px 12.5px, transparent 13px) 0 100% / 30px 30px no-repeat, linear-gradient(315deg, ${GILT} 0 11px, #5a3816 11px 12.5px, transparent 13px) 100% 100% / 30px 30px no-repeat; }
${P} .moments button::before { content: attr(title); position: absolute; left: 12%; right: 12%; bottom: -9px; padding: 2px 8px; pointer-events: none; z-index: 2;
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis; text-align: center; font: italic 400 clamp(10px, 1.2cqh, 12px)/1.35 ${FELL}; color: #f3d791; background: #2a170c; box-shadow: 0 0 0 1px ${GILT}, 0 2px 4px rgba(0,0,0,.6); }
${P} .moments button:nth-child(even) img { object-view-box: inset(6% 14% 22% 6%); }
${P} .moments button:hover, ${P} .moments button:focus-visible { rotate: 0deg; scale: 1.05; outline: none; box-shadow: 0 0 0 2px #ffd27a, 0 0 16px rgba(255,210,122,.7); }
${P} .moments button:hover::before, ${P} .moments button:focus-visible::before { white-space: normal; }
${P} .moment { z-index: 30; }
${P} .moment::before { background: linear-gradient(transparent 58%, rgba(30,10,2,.85)); box-shadow: inset 0 0 0 10px #2a1205, inset 0 0 0 13px ${GILT}, inset 0 0 0 14px #fff1c2, inset 0 0 120px rgba(0,0,0,.6); }
${P} .moment .cap { font: italic 400 clamp(22px, 3.4cqh, 34px)/1.25 ${FELL}; color: #fbe8bf; left: 6cqw; right: 6cqw; bottom: 6cqh; }

/* ---------- Phone: a leather bar (who, the stake, the fare, patience), the person's head in a strip of the painting, then the page: the talk fills it, the deal and your pen at its foot. The book's art goes: reading comes first. ---------- */
${Ph} { --bar: 52px; --fig: clamp(0px, calc(100cqh - 470px), 116px); --top: calc(var(--bar) + var(--fig)); --ribh: 44px; --pen: 52px; --fs: 17px; --dfoot: 60px; }
${Ph}:has(.moments button) { --dfoot: 132px; }
${Ph} .sbp-corners, ${Ph} .sbp-light, ${Ph} .sbp-head, ${Ph} .sbp-marks, ${Ph} .sbp-book .skirt, ${Ph} .sbp-book .back, ${Ph} .sbp-book .front, ${Ph} .sbp-band, ${Ph} .sbp-cap, ${Ph} .plaque .role, ${Ph} .tell, ${Ph} .bar, ${Ph} .mode, ${Ph} .moments, ${Ph} .hand, ${Ph} .actions::before, ${Ph} .composer::before, ${Ph} .composer::after { display: none; }
${Ph} .plate { inset: 0 0 auto 0; height: calc(var(--top) + 8px); translate: none; transition: none; animation: none; }
${Ph} .vignette { inset: var(--bar) 0 auto 0; height: var(--fig); box-shadow: none; background: linear-gradient(rgba(10,5,2,.4), transparent 30%, transparent 72%, rgba(10,5,2,.6)); }
${Ph} .figure { inset: var(--bar) 0 auto 0; height: var(--fig); overflow: hidden; translate: none; transition: none; justify-content: center; align-items: flex-start; }
${Ph} .fig { flex: none; height: calc(var(--fig) * 3); margin-top: calc(var(--fig) * -.14); }
${Ph} .face { object-position: 50% 0; }
${Ph} .fig.framed { height: var(--fig); width: min(70cqw, calc(var(--fig) * 2.2)); aspect-ratio: auto; margin: 0; box-shadow: -2px 0 0 #d9ad62, 2px 0 0 #d9ad62; }
${Ph} .fig.framed::before, ${Ph} .fig.framed .sbp-arch { display: none; }
${Ph} .fig.framed .face, ${Ph} .fig.framed::after { clip-path: none; object-position: 50% 18%; }
/* The bar. */
${Ph} .sbp-book::before { content: ""; position: absolute; inset: 0 0 auto 0; height: var(--bar); background: url(${hide}) center / 160px; box-shadow: inset 0 -2px 0 ${GILT}, inset 0 -3px 0 #2a1205, 0 2px 4px rgba(0,0,0,.5); }
${Ph} .plaque { left: 10px; right: auto; top: 5px; bottom: auto; height: 22px; width: calc(100cqw - 196px); max-width: none; padding: 0; display: block; filter: none; z-index: 6; }
${Ph} .plaque .who { display: block; font: 700 16px/22px ${GARA}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
${Ph} .kind { display: block; left: 10px; top: 27px; width: calc(100cqw - 196px); height: 20px; padding: 0; font: italic 400 13.5px/20px ${FELL}; color: #e9c57a; text-shadow: 0 1px 2px #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
${Ph} .meter { position: absolute; z-index: 6; right: 62px; top: 4px; margin: 0; display: grid; grid-template-columns: auto auto; justify-content: end; align-items: baseline; gap: 1px 5px; }
${Ph} .meter-label, ${Ph} .meter-value, ${Ph} .patience { position: static; width: auto; text-align: right; padding: 0; }
${Ph} .meter-label { font: italic 600 13px/22px ${GARA}; letter-spacing: 0; text-transform: none; color: #e9c57a; }
${Ph} .meter-label::first-letter { text-transform: uppercase; }
${Ph} .meter-value { grid-column: auto; flex-direction: row; align-items: baseline; gap: 3px; font-size: 15px; line-height: 22px; }
${Ph} .sbp-num { font-size: 16px; } ${Ph} .sbp-unit { font-size: 13px; }
${Ph} .patience { grid-column: 1 / -1; grid-row: auto; display: flex; flex-wrap: nowrap; justify-content: flex-end; align-items: center; gap: 2px; }
${Ph} .patience .pl-label { flex: none; margin: 0 4px 0 0; font: italic 600 13px/20px ${GARA}; letter-spacing: 0; text-transform: none; color: #e9c57a; }
${Ph} .pip { width: 13px; height: 13px; }
/* The one compact control: what you know, the moments and the view mode open from it. */
${Ph} .journal-btn { display: block; left: auto; right: 6px; top: 4px; bottom: auto; width: 52px; height: 44px; padding: 0; font-size: 0; letter-spacing: 0; filter: none; }
${Ph} .journal-btn::before { content: "Facts\\A" attr(data-n); display: block; white-space: pre; font: 800 12px/1.2 ${CINZ}; letter-spacing: .02em; color: #f3d791; }
${Ph}:has(.journal.open) .journal-btn::before { content: "Close"; }
${Ph} .journal-btn:hover, ${Ph} .journal-btn:focus-visible { translate: none; }
/* The page. */
${Ph} .sbp-book .dlg { left: 0; right: 0; top: var(--top); bottom: 0; width: auto; height: auto; box-shadow: inset 0 2px 0 ${GILT}; }
${Ph} .log { left: 12px; right: 12px; width: auto; top: var(--top); bottom: calc(var(--ribh) + var(--pen) + 8px); height: auto; padding: 16px 4px 12px 2px; scroll-padding-bottom: 12px; font-size: var(--fs); }
${Ph} .speaker { font-size: 12px; letter-spacing: .12em; }
${Ph} .setting { font-size: 15px; }
${Ph} .you .prose { font-size: 15.5px; }
${Ph} .read { font-size: 15px; }
${Ph} .die { width: 34px; height: 34px; font-size: 14px; }
${Ph} .trn { font-size: 14px; }
${Ph} .tier { font-size: 12px; letter-spacing: .04em; }
${Ph} .why summary { padding: 6px 0; }
${Ph} .actions { left: 8px; right: 8px; width: auto; top: auto; bottom: calc(var(--pen) + 4px); height: var(--ribh); flex-direction: row; gap: 6px; --rh: var(--ribh); }
${Ph} .actions button { flex: 1 1 0; min-width: 0; height: 100%; padding: 0 14px 0 calc(var(--rh) + 2px); font: 600 14.5px/1.05 ${GARA}; white-space: normal; filter: none; }
${Ph} .actions .deal { flex-grow: 1.4; }
${Ph} .actions button::before { width: var(--rh); left: 0; }
${Ph} .actions button:hover, ${Ph} .actions button:focus-visible { translate: none; }
${Ph} .composer { left: 8px; right: 8px; width: auto; bottom: 3px; height: 48px; grid-template-columns: 1fr auto; gap: 6px; }
${Ph} .composer textarea { box-sizing: border-box; height: 46px; padding: 4px 10px; line-height: 1.2; white-space: normal; }
${Ph} .status { left: 18px; right: 110px; bottom: 3px; height: 48px; font-size: 15px; line-height: 1.1; }
${Ph} .say { min-width: 88px; height: 46px; padding: 0 14px 0 46px; font-size: 16px; filter: none; }
${Ph} .say::before { width: 44px; left: 0; }
${Ph} .say::after { left: 18px; }
/* The end card takes the foot of the page; the log stops above it (./storybook/decor.ts measures it). */
${Ph} .end.show { left: 0; right: 0; width: auto; bottom: 0; max-height: 62cqh; overflow-y: auto; padding: 14px 14px 8px; gap: 4px 12px; background: linear-gradient(rgba(239,224,189,.2), #e9d8b0 12px); box-shadow: inset 0 2px 0 ${GILT}; }
${Ph}:has(.end.show) .log { bottom: var(--endh, 130px); }
${Ph} .end-title { font-size: 22px; flex: 1 0 100%; }
${Ph} .end-sub { font-size: 15px; flex: 1 0 100%; }
${Ph} .leave { --rh: 44px; flex: 1 0 100%; min-width: 0; height: 44px; font-size: 16px; filter: none; }
${Ph} .leave::before { width: 44px; left: 0; }
${Ph} .leave:hover, ${Ph} .leave:focus-visible { translate: none; }
/* The drawer, over the talk, leaving your pen in view: the facts (a tap cites one and closes it), the moments, the view mode. */
${Ph} .journal.open { display: block; position: absolute; z-index: 20; left: 6px; right: 6px; top: calc(var(--bar) + 4px); bottom: calc(var(--pen) + 6px); margin: 0; padding: 48px 18px 12px; overflow: auto; list-style: none; border: 0; border-radius: 0; font: italic 400 16px/1.4 ${FELL}; color: #2b170a;
  background: url(${folio}) center / cover; box-shadow: 0 0 0 2px #8a5a2a, 0 0 0 4px #2a1205, 0 8px 18px rgba(0,0,0,.7); }
${Ph} .journal.open li:not(.empty) { display: none; }
${Ph}:has(.journal.open) .hand { display: flex; left: 14px; right: 14px; width: auto; top: calc(var(--bar) + 12px); bottom: calc(var(--pen) + 6px + var(--dfoot)); z-index: 21; padding: 0; gap: 6px; filter: none; }
${Ph}:has(.journal.open) .hand::before { margin: 0 0 4px; text-align: left; padding: 0; color: #5a2a10; text-shadow: none; font-size: 18px; }
${Ph} .fact-card { min-height: 46px; padding: 6px 12px 6px 44px; font: 600 15px/1.2 ${GARA}; }
${Ph} .fact-card::before { width: 32px; }
${Ph} .fact-card.used { padding-right: 74px; }
${Ph} .fact-card.used::after { font-size: 12px; letter-spacing: .08em; }
${Ph} .fact-card:hover, ${Ph} .fact-card:focus-visible { translate: none; }
${Ph}:has(.journal.open) .mode { display: flex; position: absolute; z-index: 21; left: 14px; right: 14px; top: auto; bottom: calc(var(--pen) + 12px); gap: 6px; }
${Ph}:has(.journal.open) .mode button { flex: 1 1 0; height: 44px; padding: 0 6px; font-size: 12px; letter-spacing: .04em; }
${Ph} .mode button:hover, ${Ph} .mode button:focus-visible, ${Ph} .mode button.on { translate: none; }
${Ph} .mode button:not(.on) { filter: brightness(.72); }
${Ph}:has(.journal.open) .moments:has(button) { display: flex; position: absolute; z-index: 21; left: 14px; right: 14px; top: auto; bottom: calc(var(--pen) + 64px); height: 68px; flex-direction: row; gap: 8px; overflow-x: auto; scrollbar-width: none; }
${Ph} .moments button { flex: none; width: 92px; height: 64px; aspect-ratio: auto; padding: 3px; rotate: none; box-shadow: 0 0 0 1px #6a4a22; }
${Ph} .moments button:nth-child(even) { rotate: none; }
${Ph} .moments button::before, ${Ph} .moments button::after { display: none; }
${Ph} .moments button:hover, ${Ph} .moments button:focus-visible { scale: 1; }
${Ph} .moment .cap { left: 18px; right: 18px; bottom: 20px; font-size: 19px; }
/* The keyboard is open, or the screen is short: one thin line for the stakes, the talk, your pen. */
${S} { --bar: 30px; --fig: 0px; --ribh: 36px; --pen: 50px; --fs: 16px; }
${S} .kind, ${S} .figure, ${S} .plate, ${S} .vignette, ${S} .patience .pl-label, ${S} .meter-label { display: none; }
${S} .plaque { top: 4px; width: calc(100cqw - 190px); }
${S} .plaque .who { font-size: 14px; }
${S} .meter { right: 8px; top: 3px; gap: 0 8px; align-items: center; }
${S} .patience { grid-column: auto; }
${S} .pip { width: 12px; height: 12px; }
${S} .log { padding-top: 14px; padding-bottom: 8px; }
${S} .actions { right: 62px; --rh: 34px; }
${S} .actions button { font-size: 13.5px; padding-left: 36px; padding-right: 12px; }
${S} .journal-btn { top: auto; right: 6px; bottom: calc(var(--pen) + 4px); width: 50px; height: 36px; }
${S} .journal-btn::before { content: "Facts"; font-size: 12px; letter-spacing: 0; }
${S}:has(textarea:focus) .journal.open, ${S}:has(textarea:focus) .hand, ${S}:has(textarea:focus) .mode, ${S}:has(textarea:focus) .moments { display: none !important; }
/* A narrow short screen with the keyboard really open gets only the talk and your pen (without it, the deal must stay in reach). */
@container (max-width: 599.98px) {
  ${S}:has(textarea:focus) > * { --ribh: 0px; }
  ${S}:has(textarea:focus) .actions, ${S}:has(textarea:focus) .journal-btn { display: none; }
}
/* Landscape: the row of ribbons goes up into the bar, beside the stakes. */
@container (min-width: 600px) {
  ${S} > * { --bar: 40px; --ribh: 0px; --top: 40px; --dfoot: 60px; }
  ${S} .plaque { top: 9px; width: calc(100cqw - 600px); }
  ${S} .meter { right: 416px; top: 7px; }
  ${S} .actions { left: auto; right: 62px; top: 3px; bottom: auto; width: 346px; height: 34px; }
  ${S} .journal-btn { top: 3px; bottom: auto; height: 34px; }
  ${S}:has(.journal.open) .mode { right: 50%; }
  ${S}:has(.journal.open) .moments:has(button) { left: calc(50% + 8px); bottom: calc(var(--pen) + 12px); height: 44px; }
  ${S} .moments button { width: 62px; height: 44px; }
}

@media (prefers-reduced-motion: reduce) {
  ${P} .plate, ${P} .figure, ${P} .sbp-corners { translate: none !important; transition: none; }
  ${P} .sbp-marks .pat .sbp-flame { animation: none; }
  ${P} .sbp-light .motes { display: none; }
}
`;
}

let cached = "";
export const theme: ParleyTheme = {
  get css() {
    return (cached ||= css());
  },
  decorate,
};
