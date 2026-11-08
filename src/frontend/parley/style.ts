/**
 * Parley scene styles. The base sheet is the painted dark fantasy look (the
 * default, no theme), written against custom properties for the shared
 * parts: panel, ink, accent, edges, fonts, radii, shadows. Each scene theme
 * (`.pl.th-<id>`, src/shared/scene-view.ts ThemeId) then sets those and
 * re-dresses the frames, the nameplate, the buttons, the meters, the input,
 * the moments and the journal in its own material, consistent with the
 * expedition board's skin (../scene/board-skins.ts):
 *
 *   storybook  vellum page in a mahogany cradle, gilt scallops, crimson scroll
 *   onebit     1-bit windows on a dot-matrix desktop, dithered art, 8x8 type
 *   lobby      obsidian glass with brass hairlines over the hall, gold leaf
 *   diorama    paper on an oak counter under a hanging lamp, a shop's price tag
 *   table      candle-lit walnut, green baize, chalk slate and woodcut cards
 *   command    EGA screen: blue chassis, black windows, double rules, scanlines
 *
 * The pixel themes' dither filters (#pl-mono, #pl-ega) are inline SVG that
 * view.ts adds to the root; fonts are declared on the page by view.ts.
 */

const svg = (s: string): string => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' ${s}</svg>`)}")`;

const FELL = `"Gambit Fell", "Gambit Garamond", Georgia, serif`;
const GARA = `"Gambit Garamond", "Palatino Linotype", Georgia, serif`;
const CINZ = `"Gambit Cinzel", "Gambit Garamond", Georgia, serif`;
const BIT = `"Gambit 8bit", monospace`;
const VT = `"Gambit Pixel", "Gambit 8bit", monospace`;

/* ------------------------------------------------------------------ */
/* Base: the painted default. Every value here is today's look.        */
/* ------------------------------------------------------------------ */
const BASE = `
.pl { --p-cols: minmax(0, 1.2fr) minmax(360px, .8fr);
  --p-font: 15px/1.5 "Cormorant Garamond", "Palatino Linotype", Palatino, Georgia, serif; --p-ui: "Segoe UI", system-ui, sans-serif; --p-prose: inherit;
  --p-ink: #ece3cf; --p-dim: #9d927f; --p-faint: #6b6254; --p-soft: #b7ad99; --p-em: #d8c9a6;
  --p-accent: #c9a865; --p-accent-ink: #17130f; --p-hot: #ffd27a; --p-edge: #3c3125; --p-rule: #2c241b;
  --p-scene: #0b0a09; --p-panel: linear-gradient(#17130f, #0f0c0a); --p-panel-shadow: -20px 0 40px rgba(0,0,0,.45);
  --p-well: #0f0c0a; --p-bubble: #221c15; --p-sunk: #120f0c; --p-track: #2a221a; --p-fill: linear-gradient(90deg, #7d6a45, #c9a865);
  --p-radius: 10px; --p-pill: 999px; --p-bubble-radius: 12px 12px 2px 12px; --p-text-shadow: 0 2px 10px #000;
  --p-good: #8fd18a; --p-bad: #e0604c; --p-die: #d9c08a; --p-die-ink: #17130f; --p-die-kept: #ffd27a;
  position: absolute; inset: 0; display: grid; grid-template-columns: var(--p-cols);
  color: var(--p-ink); font: var(--p-font); }
.pl button, .pl textarea { font: inherit; color: inherit; }
.pl .hidden { display: none !important; }

/* scene */
.scene { position: relative; overflow: hidden; background: var(--p-scene); }
.plate { position: absolute; inset: -3%; }
.plate-canvas, .plate-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.plate-img { opacity: 0; transition: opacity 1.2s ease; }
.plate.painted .plate-img { opacity: 1; }
.plate { animation: plate-drift 24s ease-in-out infinite alternate; }
@keyframes plate-drift { from { transform: scale(1.02) translateX(-0.6%); } to { transform: scale(1.06) translateX(0.6%); } }
.vignette { position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(120% 90% at 45% 40%, transparent 45%, rgba(8,6,5,.55) 75%, rgba(8,6,5,.92) 100%),
              linear-gradient(to top, rgba(8,6,5,.85), transparent 30%); }
.figure { position: absolute; left: 0; right: 0; bottom: 0; height: 94%; display: flex; justify-content: center; align-items: flex-end; pointer-events: none; }
.fig { position: relative; height: 100%; aspect-ratio: 3 / 4; max-width: 100%; transform-origin: 50% 100%;
  animation: breathe 5.2s ease-in-out infinite; }
@keyframes breathe { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-0.5%) scale(1.008, 1.004); } }
.face { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; object-position: 50% 100%;
  opacity: 0; transition: opacity .55s ease; filter: drop-shadow(0 18px 30px rgba(0,0,0,.55)); }
.face.on { opacity: 1; }
/* An opaque picture (a card's avatar) as a framed portrait: gilt rule, dark mat, the room softened behind it. */
.fig.framed { height: 80%; margin-bottom: 6%; aspect-ratio: 2 / 3; }
.fig.framed { background: radial-gradient(90% 70% at 50% 35%, #2a2119, #0e0b09); border-radius: 4px; }
.fig.framed .face { object-fit: cover; object-position: 50% 22%; border-radius: 4px; filter: none;
  box-shadow: 0 0 0 1px rgba(201,168,101,.7), 0 0 0 7px rgba(18,14,11,.92), 0 0 0 8px rgba(201,168,101,.35), 0 34px 70px rgba(0,0,0,.65); }
.fig.framed::after { content: ""; position: absolute; inset: 0; border-radius: 4px; pointer-events: none;
  background: linear-gradient(to top, rgba(8,6,5,.55), transparent 32%), radial-gradient(120% 80% at 50% 30%, transparent 60%, rgba(8,6,5,.35)); }
.scene:has(.fig.framed) .plate { filter: blur(3px) brightness(.78); transition: filter .8s ease; }
.face:not([src]), .plate-img:not([src]) { display: none; }
/* The puppet canvas beside each face (scene/puppet-dom.ts follow()) carries the face's classes but has no src. */
canvas.face:not([hidden]) { display: block; }
.silhouette { position: absolute; left: 18%; right: 18%; bottom: 0; height: 78%; border-radius: 45% 45% 8% 8% / 30% 30% 4% 4%;
  background: radial-gradient(60% 40% at 50% 22%, rgba(201,168,101,.18), rgba(23,19,15,.85) 70%); display: grid; place-items: center;
  align-content: center; gap: 6px; color: rgba(236,227,207,.45); transition: opacity .6s; }
.silhouette span { font-size: 64px; line-height: 1; }
.silhouette small { font: 12px var(--p-ui); letter-spacing: .08em; }
.silhouette.gone { opacity: 0; }
.fig.m-irritated { animation: breathe 5.2s ease-in-out infinite, jolt .5s ease-out; }
.fig.m-suspicious { animation: breathe 5.2s ease-in-out infinite, lean-back .9s ease-out; }
.fig.m-afraid { animation: breathe 5.2s ease-in-out infinite, recoil .7s ease-out; }
.fig.m-moved, .fig.m-tempted { animation: breathe 5.2s ease-in-out infinite, lean-in 1.1s ease-out; }
.fig.m-amused, .fig.m-confused { animation: breathe 5.2s ease-in-out infinite, tilt 1s ease-out; }
@keyframes jolt { 0% { translate: 0 0; } 20% { translate: -1.2% 0; } 40% { translate: 1% 0; } 60% { translate: -.6% 0; } 100% { translate: 0 0; } }
@keyframes recoil { 0% { translate: 0 0; scale: 1; } 30% { translate: 0 1%; scale: .985; } 100% { translate: 0 0; scale: 1; } }
@keyframes lean-back { 0% { rotate: 0deg; } 35% { rotate: -1.4deg; } 100% { rotate: 0deg; } }
@keyframes lean-in { 0% { scale: 1; } 40% { scale: 1.025; } 100% { scale: 1; } }
@keyframes tilt { 0% { rotate: 0deg; } 40% { rotate: 1.6deg; } 100% { rotate: 0deg; } }
.plaque { position: absolute; left: 28px; bottom: 26px; text-shadow: var(--p-text-shadow); }
.plaque .who { font-size: 34px; letter-spacing: .02em; }
.plaque .role { font: 12px/1.3 var(--p-ui); letter-spacing: .1em; text-transform: uppercase; color: var(--p-accent); opacity: .85; }
.tell { position: absolute; left: 50%; top: 9%; translate: -50% 0; max-width: min(80%, 560px); text-align: center; font-style: italic;
  font-size: 19px; color: #f1e6cc; text-shadow: 0 2px 12px #000, 0 0 2px #000; opacity: 0; pointer-events: none; }
.tell.show { animation: tell 6s ease forwards; }
@keyframes tell { 0% { opacity: 0; translate: -50% 6px; } 10%, 75% { opacity: 1; translate: -50% 0; } 100% { opacity: 0; } }

/* side */
.side { display: flex; flex-direction: column; min-height: 0; background: var(--p-panel);
  border-left: 1px solid var(--p-edge); box-shadow: var(--p-panel-shadow); }
.head { padding: 18px 20px 12px; border-bottom: 1px solid var(--p-rule); position: relative; }
.title-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding-right: 40px; }
.kind { font: 11px/1.3 var(--p-ui); letter-spacing: .12em; text-transform: uppercase; color: var(--p-dim); }
.mode { display: flex; border: 1px solid var(--p-edge); border-radius: var(--p-pill); overflow: hidden; flex: none; }
.mode button { background: none; border: 0; padding: 4px 10px; font: 11px var(--p-ui); color: var(--p-dim); cursor: pointer; }
.mode button.on { background: var(--p-accent); color: var(--p-accent-ink); }
.meter { margin-top: 12px; display: grid; grid-template-columns: 1fr auto; align-items: end; gap: 4px 12px; }
.meter-label { font: 11px var(--p-ui); letter-spacing: .12em; text-transform: uppercase; color: var(--p-dim); }
.meter-value { grid-column: 1; font-size: 34px; line-height: 1.05; display: flex; align-items: baseline; gap: 10px; }
.delta { font: 600 14px var(--p-ui); opacity: 0; }
.delta.show { animation: delta 2.4s ease forwards; }
.delta.down { color: var(--p-good); } .delta.up { color: var(--p-bad); }
@keyframes delta { 0% { opacity: 0; translate: 0 6px; } 15%, 70% { opacity: 1; translate: 0 0; } 100% { opacity: 0; } }
.bar { grid-column: 1 / -1; height: 6px; border-radius: 3px; background: var(--p-track); overflow: hidden; }
.bar .fill { height: 100%; background: var(--p-fill); transition: width 1s cubic-bezier(.2,.8,.2,1); }
.patience { grid-column: 2; grid-row: 1 / span 2; display: flex; align-items: center; gap: 4px; }
.pl-label { font: 11px var(--p-ui); letter-spacing: .12em; text-transform: uppercase; color: var(--p-dim); margin-right: 4px; }
.pip { width: 9px; height: 9px; border-radius: 50%; border: 1px solid #7d6a45; }
.pip.on { background: var(--p-accent); border-color: var(--p-accent); }
.journal-btn { margin-top: 10px; background: none; border: 0; padding: 0; color: var(--p-accent); cursor: pointer; font: 12px var(--p-ui); }
.journal { display: none; margin: 8px 0 0; padding: 10px 12px 10px 26px; background: var(--p-sunk); border: 1px solid var(--p-rule); border-radius: 8px; font-size: 14px; }
.journal.open { display: block; }
.journal li { margin: 4px 0; }
.journal li.used { color: var(--p-dim); }
.journal li.empty { list-style: none; margin-left: -14px; color: var(--p-dim); font-style: italic; }

.log { flex: 1; min-height: 0; overflow: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; scroll-behavior: smooth; }
.setting { font-style: italic; color: var(--p-dim); font-size: 14px; }
.speaker { font: 11px var(--p-ui); letter-spacing: .12em; text-transform: uppercase; color: var(--p-dim); margin-bottom: 2px; }
.prose p { margin: 0 0 .5em; } .prose p:last-child { margin-bottom: 0; }
.prose em { color: var(--p-em); }
.npc .prose { font-size: 16px; font-family: var(--p-prose); }
.npc .prose.waiting .dots { display: inline-block; animation: dots 1.2s steps(4) infinite; color: var(--p-dim); }
@keyframes dots { 0% { opacity: .2; } 50% { opacity: 1; } 100% { opacity: .2; } }
.you { align-self: flex-end; max-width: 88%; background: var(--p-bubble); border: 1px solid var(--p-edge); border-radius: var(--p-bubble-radius); padding: 8px 12px; }
.you .speaker { text-align: right; color: var(--p-accent); }
.read { border-left: 2px solid var(--p-edge); padding: 2px 0 2px 12px; display: grid; gap: 6px; }
.tray { display: flex; align-items: center; gap: 8px; }
.die { width: 34px; height: 34px; display: grid; place-items: center; font: 600 14px "Palatino Linotype", Georgia, serif; color: var(--p-die-ink);
  background: var(--p-die); clip-path: polygon(50% 0, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%); transition: transform .3s, opacity .3s, background .3s; }
.die.rolling { animation: wobble .21s linear infinite; }
@keyframes wobble { 0% { rotate: -8deg; } 50% { rotate: 8deg; } 100% { rotate: -8deg; } }
.die.kept { background: var(--p-die-kept); transform: scale(1.12); box-shadow: 0 0 12px rgba(255,210,122,.5); }
.die.dropped { opacity: .35; }
.die.nat20 { background: #fff0b0; } .die.nat1 { background: #c4544a; color: #f5e9d6; }
.result { font: 600 12px var(--p-ui); letter-spacing: .1em; text-transform: uppercase; opacity: 0; transform: translateX(-4px); transition: all .35s .1s; }
.result.show { opacity: 1; transform: none; }
.r-crit_success { color: #ffd27a; } .r-success { color: #8fd18a; } .r-partial { color: #d9c08a; } .r-fail { color: #9aa3ab; } .r-crit_fail { color: #e0604c; }
.imm { font-style: italic; color: var(--p-em); font-size: 14px; }
.trn { display: grid; gap: 4px; font: 12px/1.45 var(--p-ui); color: var(--p-soft); }
.tier { justify-self: start; padding: 1px 8px; border-radius: var(--p-pill); border: 1px solid #5a4a36; font-size: 11px; letter-spacing: .04em; }
.tier.t0 { border-color: #c4544a; color: #e0604c; } .tier.t1 { color: #d9a46a; } .tier.t3 { color: #8fd18a; } .tier.t4 { border-color: #ffd27a; color: #ffd27a; }
.why summary { cursor: pointer; color: var(--p-accent); width: max-content; }
.why pre { white-space: pre-wrap; margin: 4px 0 0; font: inherit; color: var(--p-dim); }
.pl[data-mode="immersive"] .trn { display: none; }
.pl[data-mode="immersive"] .die.dropped { display: none; }
.pl[data-mode="transparent"] .imm { display: none; }

.foot { padding: 12px 20px 16px; border-top: 1px solid var(--p-rule); display: grid; gap: 8px; }
.status { min-height: 1.2em; font-style: italic; color: var(--p-dim); font-size: 14px; }
.hand { display: none; }
.pl.table .hand { display: flex; justify-content: center; gap: 0; padding: 4px 0 2px; min-height: 0; flex-wrap: nowrap; overflow-x: auto; }
.pl.table .fact-card { flex: 0 0 auto; width: 132px; min-height: 92px; margin: 0 -10px; padding: 10px 10px 8px; text-align: left; font: 12px/1.3 Georgia, serif; color: #2a1f14; background: linear-gradient(#f3e6c8, #e2cfa3); border: 1px solid #8a6d3f; border-radius: 8px; box-shadow: 0 6px 14px #0008; transform: rotate(var(--tilt, 0deg)) translateY(6px); transition: transform .15s ease, margin .15s ease; cursor: pointer; }
.pl.table .fact-card:hover, .pl.table .fact-card:focus-visible { transform: rotate(0deg) translateY(-10px) scale(1.06); margin: 0 4px; z-index: 2; }
.pl.table .fact-card.used { opacity: .45; }
.pl.table .scene { background: radial-gradient(ellipse at 50% 110%, #6b3d16 0%, #2a170b 45%, #0c0805 75%); }
.pl.table .scene::after { content: ""; position: absolute; left: -10%; right: -10%; bottom: -2%; height: 22%; background: linear-gradient(#5a3a1e, #2b1a0c); border-top: 3px solid #7a532c; border-radius: 50% 50% 0 0 / 30% 30% 0 0; box-shadow: 0 -30px 60px #ffb35a22 inset; pointer-events: none; }
.pl.table .foot { background: linear-gradient(#1a110a, #120c07); }
.composer { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
.composer textarea { resize: none; background: var(--p-well); border: 1px solid var(--p-edge); border-radius: var(--p-radius); padding: 9px 12px; font-size: 16px; line-height: 1.35; }
.composer textarea:focus { outline: none; border-color: var(--p-accent); }
.say { background: var(--p-accent); color: var(--p-accent-ink); border: 0; border-radius: var(--p-radius); padding: 0 18px; font-weight: 600; cursor: pointer; }
.say:disabled, .deal:disabled { opacity: .5; cursor: default; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; }
.actions button, .leave { background: none; border: 1px solid var(--p-edge); border-radius: var(--p-pill); padding: 5px 14px; cursor: pointer; font-size: 14px; color: var(--p-em); }
.actions button:hover, .leave:hover { border-color: var(--p-accent); color: var(--p-hot); }
.hint { font: 11px var(--p-ui); color: var(--p-faint); }
.end { display: none; text-align: center; padding: 6px 0 2px; }
.end.show { display: grid; gap: 6px; justify-items: center; }
.end-title { font-size: 26px; color: var(--p-hot); }
.end-sub { color: var(--p-soft); font-size: 14px; }
.reveals { text-align: left; margin: 0; padding-left: 18px; font-size: 14px; }

/* Moments (4.1.6): the beat that changes the talk, as a still over the scene, then a thumbnail. */
.moment { position: absolute; inset: 0; z-index: 5; opacity: 0; pointer-events: none; transition: opacity .7s ease; background: #000; cursor: pointer; }
.moment.show { opacity: 1; pointer-events: auto; }
.moment img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.moment.show img { animation: moment-push 9s ease-out forwards; }
@keyframes moment-push { from { transform: scale(1.12); } to { transform: scale(1.0); } }
.moment::before { content: ""; position: absolute; inset: 0; z-index: 1; background: linear-gradient(transparent 62%, #000c); pointer-events: none; }
.moment .cap { position: absolute; z-index: 2; left: 28px; right: 28px; bottom: 26px; font-size: 26px; font-style: italic; color: #f3e6c8; text-shadow: 0 2px 12px #000; letter-spacing: .01em; }
.moment.show .cap { animation: moment-cap .9s .35s ease both; }
@keyframes moment-cap { from { opacity: 0; translate: 0 10px; } to { opacity: 1; translate: 0 0; } }
.moment.show::after { content: ""; position: absolute; inset: 0; z-index: 3; background: #fff; pointer-events: none; animation: moment-flash .5s ease-out forwards; }
@keyframes moment-flash { from { opacity: .55; } to { opacity: 0; } }
.moments { position: absolute; right: 18px; bottom: 22px; z-index: 4; display: flex; gap: 6px; }
.moments button { width: 52px; height: 36px; padding: 0; border: 1px solid #c9a86599; border-radius: 4px; overflow: hidden; background: #000; cursor: pointer; box-shadow: 0 3px 10px #000a; }
.moments button:hover { border-color: #ffd27a; }
.moments img { width: 100%; height: 100%; object-fit: cover; display: block; }

@media (max-width: 760px) {
  .moment .cap { font-size: 18px; left: 16px; right: 16px; bottom: 14px; }
  .moments { right: 10px; bottom: 10px; }
  .pl { grid-template-columns: 1fr; grid-template-rows: 40vh minmax(0, 1fr); }
  .side { border-left: 0; border-top: 1px solid var(--p-edge); }
  .plaque .who { font-size: 24px; }
  .plaque { left: 16px; bottom: 12px; }
  .tell { font-size: 16px; top: 12%; }
  .head { padding: 12px 14px 10px; }
  .meter-value { font-size: 26px; }
  .log { padding: 12px 14px; }
  .foot { padding: 10px 14px calc(12px + env(safe-area-inset-bottom)); }
}
`;

/* ------------------------------------------------------------------ */
/* Shared by every theme: a capped panel width so an ultrawide window  */
/* keeps readable lines, and themed focus rings.                       */
/* ------------------------------------------------------------------ */
const THEMED = `
.pl[class*="th-"] { --p-cols: minmax(0, 1fr) minmax(360px, min(42%, 620px)); }
.pl[class*="th-"] .kind { min-width: 0; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.pl[class*="th-"] :focus-visible { outline: 2px solid var(--p-hot); outline-offset: 2px; }
.pl[class*="th-"] .log { scrollbar-width: thin; scrollbar-color: var(--p-edge) transparent; }
@media (max-width: 760px) { .pl[class*="th-"] { --p-cols: minmax(0, 1fr); grid-template-columns: minmax(0, 1fr); } .pl[class*="th-"] .side { min-width: 0; } }
`;

/* ------------------------------------------------------------------ */
/* Storybook: vellum page in a mahogany cradle, gilt scallops,         */
/* a crimson name scroll and gilt acanthus at the plate's corners.     */
/* ------------------------------------------------------------------ */
const corner = (fx: boolean, fy: boolean): string => {
  const t = `${fx ? "translate(120 0) scale(-1 1)" : ""} ${fy ? "translate(0 120) scale(1 -1)" : ""}`.trim();
  return svg(`viewBox='0 0 120 120'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#fff1c2'/><stop offset='.35' stop-color='#d9ad62'/><stop offset='.7' stop-color='#7a4c1c'/><stop offset='1' stop-color='#e9c57a'/></linearGradient></defs>
<g transform='${t}' fill='none' stroke='url(#g)' stroke-linecap='round'>
<path d='M7 116V24Q7 7 24 7H116' stroke-width='5'/><path d='M15 104V30Q15 15 30 15H104' stroke-width='1.4'/>
<path d='M24 66C24 38 38 24 66 24' stroke-width='2.4'/>
<path d='M30 32C40 18 60 24 54 38C49 48 36 44 40 36' stroke-width='2.4'/>
<path d='M66 24C76 14 92 16 96 28C88 23 79 27 76 34' stroke-width='2'/><path d='M24 66C14 76 16 92 28 96C23 88 27 79 34 76' stroke-width='2'/>
<path d='M44 24C50 16 58 14 64 16' stroke-width='1.2'/><path d='M24 44C16 50 14 58 16 64' stroke-width='1.2'/>
</g><g transform='${t}'><circle cx='24' cy='24' r='5.5' fill='url(#g)' stroke='#4a2a0e' stroke-width='.8'/><circle cx='104' cy='15' r='2.4' fill='url(#g)'/><circle cx='15' cy='104' r='2.4' fill='url(#g)'/></g>`);
};
const GILT = "#d9ad62";
const VELLUM = `linear-gradient(90deg, rgba(42,24,16,.55), rgba(42,24,16,.16) 9px, rgba(42,24,16,0) 26px), radial-gradient(ellipse 80% 60% at 50% 30%, rgba(255,250,232,.55), rgba(255,250,232,0) 70%), repeating-linear-gradient(90deg, rgba(120,80,40,.035) 0 1px, transparent 1px 5px), repeating-linear-gradient(0deg, rgba(120,80,40,.03) 0 1px, transparent 1px 7px), linear-gradient(#f6e8c6, #ecd9ae)`;
const MAHOGANY = `repeating-linear-gradient(92deg, rgba(0,0,0,.18) 0 2px, transparent 2px 9px, rgba(255,200,150,.05) 9px 11px, transparent 11px 17px), linear-gradient(#4a1f0b, #2a1205)`;
const STORYBOOK = `
.pl.th-storybook { --p-font: 500 16px/1.5 ${GARA}; --p-ui: ${CINZ}; --p-prose: ${FELL};
  --p-ink: #2b170a; --p-dim: #7a5a3a; --p-faint: #8a6a4a; --p-soft: #52341e; --p-em: #6b2a12;
  --p-accent: #8b1a1a; --p-accent-ink: #fff0cf; --p-hot: #b8860b; --p-edge: rgba(122,74,30,.45); --p-rule: rgba(122,74,30,.35);
  --p-scene: #120a06; --p-well: rgba(255,250,236,.7); --p-bubble: #fff6e2; --p-sunk: rgba(255,248,228,.6); --p-track: #d8c39e;
  --p-fill: linear-gradient(90deg, #7a4c1c, #d9ad62 55%, #fff1c2); --p-radius: 3px; --p-bubble-radius: 3px; --p-text-shadow: none;
  --p-good: #2f6b2a; --p-bad: #8b1a1a; --p-die: linear-gradient(135deg, #fff1c2, #d9ad62 45%, #8a5a2a); --p-die-ink: #3a1a08; --p-die-kept: linear-gradient(135deg, #fff8dc, #ffd27a 45%, #b8862f);
  background: #120a06; }
.th-storybook .plate-canvas, .th-storybook .plate-img { filter: sepia(.18) saturate(.92) brightness(.9); }
.th-storybook .vignette { background: radial-gradient(120% 90% at 45% 40%, transparent 50%, rgba(30,12,4,.55) 78%, rgba(18,8,3,.92) 100%), linear-gradient(to top, rgba(18,8,3,.8), transparent 28%); }
.th-storybook .scene::after { content: ""; position: absolute; inset: 6px; z-index: 6; pointer-events: none;
  --k: clamp(64px, 17vh, 132px);
  background: ${corner(false, false)} left top / var(--k) var(--k) no-repeat, ${corner(true, false)} right top / var(--k) var(--k) no-repeat,
    ${corner(false, true)} left bottom / var(--k) var(--k) no-repeat, ${corner(true, true)} right bottom / var(--k) var(--k) no-repeat;
  filter: drop-shadow(0 2px 3px rgba(0,0,0,.7)); }
.th-storybook .face { filter: drop-shadow(0 16px 26px rgba(20,8,2,.6)); }
.th-storybook .fig.framed { background: radial-gradient(90% 70% at 50% 35%, #3a1d0c, #120804); border-radius: 48% 48% 4px 4px / 22% 22% 4px 4px; }
.th-storybook .fig.framed .face, .th-storybook .fig.framed::after { border-radius: 48% 48% 4px 4px / 22% 22% 4px 4px; }
.th-storybook .fig.framed .face { box-shadow: 0 0 0 2px #e9c57a, 0 0 0 7px #3a1a08, 0 0 0 9px #b8862f, 0 0 0 10px #fff1c2, 0 30px 60px rgba(0,0,0,.7); }
.th-storybook .silhouette { background: radial-gradient(60% 40% at 50% 22%, rgba(233,197,122,.25), rgba(42,18,6,.85) 70%); color: rgba(255,240,207,.5); font-family: ${FELL}; }

/* The crimson name scroll. */
.th-storybook .plaque { left: clamp(20px, 3vw, 44px); bottom: clamp(18px, 4vh, 34px); z-index: 3; padding: 7px 34px 8px; text-align: center; color: #fff0cf;
  background: linear-gradient(#b3302a, #8b1a1a 45%, #5e0d0d); border-top: 2px solid #e9c57a; border-bottom: 2px solid #e9c57a;
  box-shadow: 0 0 0 1px #3e0606, 0 10px 22px rgba(0,0,0,.6); }
.th-storybook .plaque::before, .th-storybook .plaque::after { content: ""; position: absolute; top: -6px; bottom: -6px; width: 16px; border-radius: 8px;
  background: linear-gradient(90deg, #3e0606, #a3241f 40%, #e0645a 55%, #6e1010); box-shadow: inset 0 0 0 1px #e9c57a, 0 4px 8px rgba(0,0,0,.5); }
.th-storybook .plaque::before { left: -8px; } .th-storybook .plaque::after { right: -8px; }
.th-storybook .plaque .who { font: 400 clamp(22px, 4.2vh, 34px)/1.05 ${FELL}; text-shadow: 0 2px 2px rgba(0,0,0,.6); }
.th-storybook .plaque .role { font: 600 11px/1.3 ${CINZ}; letter-spacing: .2em; color: #f3d791; opacity: 1; max-width: 34ch; margin: 2px auto 0; }
.th-storybook .tell { font: italic 400 21px/1.3 ${FELL}; color: #fbe8bf; }

/* The page: vellum in a mahogany cradle, with a gilt scalloped border. */
.th-storybook .side { position: relative; background: ${VELLUM} padding-box, ${MAHOGANY} border-box; border: 14px solid transparent; border-left-width: 16px;
  box-shadow: inset 0 0 0 1px rgba(90,50,20,.35), inset 0 0 40px rgba(120,70,20,.25), -16px 0 40px rgba(0,0,0,.55); }
.th-storybook .side::before { content: ""; position: absolute; inset: 7px; pointer-events: none; z-index: 1; border: 1.5px solid ${GILT};
  background: radial-gradient(circle at 50% 100%, transparent 4px, ${GILT} 4px 5.4px, transparent 5.8px) 0 1px / 14px 7px repeat-x,
    radial-gradient(circle at 50% 0, transparent 4px, ${GILT} 4px 5.4px, transparent 5.8px) 0 calc(100% - 1px) / 14px 7px repeat-x,
    radial-gradient(circle at 100% 50%, transparent 4px, ${GILT} 4px 5.4px, transparent 5.8px) 1px 0 / 7px 14px repeat-y,
    radial-gradient(circle at 0 50%, transparent 4px, ${GILT} 4px 5.4px, transparent 5.8px) calc(100% - 1px) 0 / 7px 14px repeat-y; }
.th-storybook .side::after { content: ""; position: absolute; left: 50%; top: -14px; translate: -50% 0; width: 92px; height: 12px; z-index: 2; pointer-events: none;
  background: linear-gradient(#fff1c2, #c99a4a 50%, #7a4c1c); border-radius: 0 0 6px 6px; box-shadow: 0 2px 4px rgba(0,0,0,.5); }
.th-storybook .head { padding: 22px 26px 12px; border-bottom: 0; background: ${svg(`viewBox='0 0 300 16' preserveAspectRatio='none'><path d='M0 8H128M172 8H300' stroke='#8a5a2a' stroke-width='1'/><path d='M150 2C156 8 156 8 150 14C144 8 144 8 150 2Z' fill='#8b1a1a'/><circle cx='136' cy='8' r='2' fill='#a8742f'/><circle cx='164' cy='8' r='2' fill='#a8742f'/>`)} center bottom / 100% 14px no-repeat; }
.th-storybook .title-row { padding-right: 34px; }
.th-storybook .kind { font: 600 10.5px/1.25 ${CINZ}; letter-spacing: .12em; color: #4a2a0e; padding: 5px 12px 4px;
  background: linear-gradient(#fff1c2, #d9ad62 45%, #a8742f); border-radius: 2px; box-shadow: 0 0 0 1px #6b4214, inset 0 1px 0 rgba(255,255,255,.6), 0 2px 4px rgba(60,30,10,.35); text-shadow: 0 1px 0 rgba(255,240,200,.7); }
.th-storybook .mode { border: 1px solid #7a4a1e; border-radius: 3px; background: rgba(90,42,16,.08); }
.th-storybook .mode button { font: 600 10px ${CINZ}; letter-spacing: .12em; color: #7a4a1e; padding: 5px 10px; }
.th-storybook .mode button.on { background: linear-gradient(#a3241f, #6e1010); color: #fbe0a8; }
.th-storybook .meter-label, .th-storybook .pl-label, .th-storybook .speaker { font: 600 10.5px ${CINZ}; letter-spacing: .2em; color: #8a5a2a; }
.th-storybook .meter-value { font: 400 36px/1 ${FELL}; color: #3a1a08; }
.th-storybook .delta { font: italic 600 16px ${FELL}; }
.th-storybook .bar { height: 8px; border-radius: 4px; box-shadow: inset 0 1px 2px rgba(60,30,10,.5), 0 1px 0 rgba(255,250,230,.8); }
.th-storybook .pip { width: 11px; height: 11px; border: 1px solid #8a5a2a; }
.th-storybook .pip.on { background: radial-gradient(circle at 35% 30%, #e0645a, #8b1a1a 55%, #4a0808); border-color: #3e0606; box-shadow: 0 1px 1px rgba(0,0,0,.35); }
.th-storybook .journal-btn { font: italic 400 15px ${FELL}; color: #8b1a1a; }
.th-storybook .journal-btn::before { content: "❧ "; }
.th-storybook .journal { border-radius: 2px; border-color: rgba(122,74,30,.4); list-style: none; padding-left: 14px; font-size: 15px; }
.th-storybook .journal li::before { content: "❧ "; color: #9c3b26; }
.th-storybook .journal li.empty { margin-left: 0; }
.th-storybook .journal li.empty::before { content: ""; }
.th-storybook .log { padding: 14px 26px; }
.th-storybook .setting { font: italic 400 15px/1.45 ${FELL}; color: #6b4a2a; }
.th-storybook .npc .prose { font-size: 17.5px; line-height: 1.45; color: #261409; }
/* A boxed illuminated initial; its paragraph contains the float, so the next paragraph never wraps around it. */
.th-storybook .npc .prose > p:first-child { display: flow-root; }
.th-storybook .npc .prose > p:first-child::first-letter { float: left; font: normal 400 1.75em/1 ${FELL}; color: #F9F4E8; background: #7A1C1C; border: 1px solid #D4AF37;
  padding: .14em .2em .08em; margin: .1em .3em 0 0; text-shadow: 0 1px 0 #3e0606; }
.th-storybook .npc .prose em { color: #6b2a12; }
.th-storybook .you { border: 1px solid rgba(168,116,47,.6); box-shadow: 0 2px 6px rgba(80,40,10,.18), inset 0 0 0 3px #fff6e2, inset 0 0 0 4px rgba(168,116,47,.35); }
.th-storybook .you .speaker { color: #8b1a1a; }
.th-storybook .read { border-left: 2px dotted #a8742f; }
.th-storybook .die { font: 400 15px ${FELL}; filter: drop-shadow(0 1px 1px rgba(60,30,10,.5)); }
.th-storybook .die.kept { box-shadow: none; filter: drop-shadow(0 0 5px rgba(184,134,11,.8)); }
.th-storybook .die.nat1 { background: linear-gradient(135deg, #e0645a, #8b1a1a); color: #fff0cf; }
.th-storybook .result { font: 600 11px ${CINZ}; letter-spacing: .16em; }
.th-storybook .r-crit_success { color: #9a6a00; } .th-storybook .r-success { color: #2f6b2a; } .th-storybook .r-partial { color: #7a5a2a; } .th-storybook .r-fail { color: #6b5a4a; } .th-storybook .r-crit_fail { color: #8b1a1a; }
.th-storybook .imm { font: italic 400 15px ${FELL}; color: #4a2511; }
.th-storybook .trn { font: 13px/1.45 ${GARA}; }
.th-storybook .tier { border-color: #a8742f; border-radius: 2px; font-family: ${CINZ}; font-size: 10px; letter-spacing: .1em; }
.th-storybook .tier.t0 { border-color: #8b1a1a; color: #8b1a1a; } .th-storybook .tier.t1 { color: #8a4a1a; } .th-storybook .tier.t3 { color: #2f6b2a; } .th-storybook .tier.t4 { border-color: #9a6a00; color: #9a6a00; }
.th-storybook .foot { padding: 10px 26px 20px; border-top: 1px solid rgba(122,74,30,.35); }
.th-storybook .status { font-family: ${FELL}; color: #6b4a2a; }
.th-storybook .composer textarea { font: 400 17px/1.4 ${FELL}; color: #2b170a; border-color: rgba(122,74,30,.55);
  background: repeating-linear-gradient(transparent 0 calc(1.4em - 1px), rgba(122,74,30,.18) calc(1.4em - 1px) 1.4em) 0 9px / 100% 100% local, rgba(255,250,236,.65); }
.th-storybook .composer textarea:focus { border-color: #8b1a1a; box-shadow: 0 0 0 2px rgba(139,26,26,.15); }
.th-storybook .composer textarea::placeholder { color: #9a7a5a; font-style: italic; }
.th-storybook .say { font: 600 12px ${CINZ}; letter-spacing: .18em; text-transform: uppercase; color: #3a1a08; border-radius: 999px; padding: 0 20px;
  background: radial-gradient(circle at 40% 30%, #fff8dc, #e9c57a 40%, #a8742f 80%, #6b4214); box-shadow: 0 0 0 1px #6b4214, inset 0 0 0 3px rgba(255,241,194,.55), 0 3px 6px rgba(60,30,10,.4); }
.th-storybook .actions button, .th-storybook .leave { font: 600 11px ${CINZ}; letter-spacing: .14em; text-transform: uppercase; color: #fbe8bf; border: 0; border-radius: 0; padding: 7px 22px;
  background: linear-gradient(#a3241f, #6e1010); clip-path: polygon(0 0, 100% 0, calc(100% - 9px) 50%, 100% 100%, 0 100%, 9px 50%); }
.th-storybook .actions .deal { background: linear-gradient(#3f6e3a, #1f4a1f); }
.th-storybook .actions button:hover, .th-storybook .leave:hover { color: #fff; filter: brightness(1.15); }
.th-storybook .hint { font: italic 13px ${GARA}; color: #8a6a4a; }
.th-storybook .end-title { font: 400 30px ${FELL}; color: #8b1a1a; }
.th-storybook .moments button { border: 2px solid #d9ad62; border-radius: 2px; box-shadow: 0 0 0 1px #3a1a08, 0 3px 10px #000a; }
.th-storybook .moment .cap { font: italic 400 28px/1.25 ${FELL}; color: #fbe8bf; }
.th-storybook .moment::before { background: linear-gradient(transparent 58%, rgba(30,10,2,.85)); box-shadow: inset 0 0 0 6px #2a1205, inset 0 0 0 8px #d9ad62; }
@media (max-width: 760px) {
  .th-storybook .side { border-width: 10px; }
  .th-storybook .kind { -webkit-line-clamp: 1; }
  .th-storybook .side::before { inset: 5px; }
  .th-storybook .head { padding: 16px 18px 10px; }
  .th-storybook .log { padding: 10px 18px; }
  .th-storybook .foot { padding: 8px 18px calc(14px + env(safe-area-inset-bottom)); }
  .th-storybook .plaque { left: 50%; translate: -50% 0; bottom: 12px; padding: 4px 24px 5px; white-space: nowrap; max-width: calc(100% - 60px); }
  .th-storybook .plaque .who { font-size: 21px; overflow: hidden; text-overflow: ellipsis; }
  .th-storybook .scene::after { --k: 64px; }
  .th-storybook .moments { top: 16px; bottom: auto; right: 50%; translate: 50% 0; }
  .th-storybook .plaque .role { display: none; }
}
`;

/* ------------------------------------------------------------------ */
/* 1-bit: windows on a dot-matrix desktop, all ink and paper.          */
/* ------------------------------------------------------------------ */
const INK = "#080707";
const PAPER = "#f0eee6";
const DOTS = svg(`width='6' height='6' shape-rendering='crispEdges'><rect width='6' height='6' fill='${INK}'/><rect x='0' y='0' width='1' height='1' fill='${PAPER}'/><rect x='3' y='3' width='1' height='1' fill='${PAPER}' fill-opacity='.0'/>`);
const CHECK = `repeating-conic-gradient(${INK} 0 25%, ${PAPER} 0 50%) 0 0 / 4px 4px`;
const SPARSE = svg(`width='4' height='4' shape-rendering='crispEdges'><rect width='4' height='4' fill='${INK}'/><rect width='2' height='2' fill='${PAPER}'/>`);
const STRIPES = `repeating-linear-gradient(${PAPER} 0 2px, ${INK} 2px 4px)`;
/** A striped Mac-style title bar with the title knocked out in ink, `chars` 8x8 cells wide. */
const titleBar = (label: string, chars: number) =>
  `content: "${label}"; position: absolute; left: 0; right: 0; top: 0; height: 20px; z-index: 2; font: 16px/20px ${BIT}; text-align: center; color: ${PAPER};
  background: linear-gradient(${INK}, ${INK}) center / ${chars * 16 + 24}px 100% no-repeat, linear-gradient(${INK}, ${INK}) 0 0 / 100% 3px no-repeat, linear-gradient(${INK}, ${INK}) 0 100% / 100% 3px no-repeat, ${STRIPES}; border-bottom: 2px solid ${PAPER};`;
const ONEBIT = `
.pl.th-onebit { --p-font: 20px/1.15 ${VT}; --p-ui: ${BIT}; --p-prose: ${VT};
  --p-ink: ${PAPER}; --p-dim: ${PAPER}; --p-faint: ${PAPER}; --p-soft: ${PAPER}; --p-em: ${PAPER};
  --p-accent: ${PAPER}; --p-accent-ink: ${INK}; --p-hot: ${PAPER}; --p-edge: ${PAPER}; --p-rule: ${PAPER};
  --p-scene: ${INK}; --p-panel: ${INK}; --p-panel-shadow: none; --p-well: ${INK}; --p-bubble: ${INK}; --p-sunk: ${INK}; --p-track: ${INK}; --p-fill: ${PAPER};
  --p-radius: 0; --p-pill: 0; --p-bubble-radius: 0; --p-text-shadow: none; --p-good: ${PAPER}; --p-bad: ${PAPER};
  --p-die: ${INK}; --p-die-ink: ${PAPER}; --p-die-kept: ${PAPER};
  background: ${DOTS} 0 0 / 6px 6px; padding: 10px; gap: 10px; -webkit-font-smoothing: none; font-smooth: never; }
.th-onebit *, .th-onebit *::before, .th-onebit *::after { text-shadow: none !important; }
.th-onebit .scene { border: 2px solid ${PAPER}; box-shadow: 0 0 0 2px ${INK}; padding-top: 20px; }
.th-onebit .scene::before { ${titleBar("VIEW", 4)} }
.th-onebit .plate { inset: 22px 0 0; animation: none; }
.th-onebit .plate-canvas, .th-onebit .plate-img { filter: brightness(.78) contrast(1.15) url(#pl-mono); image-rendering: pixelated; }
.th-onebit .plate-img { transition: opacity 1.2s steps(4); }
.th-onebit .scene:has(.fig.framed) .plate { filter: none; }
.th-onebit .vignette { background: radial-gradient(ellipse 72% 78% at 48% 46%, transparent 0 84%, ${INK} 84% 100%), linear-gradient(to top, ${INK} 0 6%, transparent 6%); }
.th-onebit .vignette::before { content: ""; position: absolute; inset: 0; background: ${CHECK};
  -webkit-mask: radial-gradient(ellipse 72% 78% at 48% 46%, transparent 0 70%, #000 70% 100%); mask: radial-gradient(ellipse 72% 78% at 48% 46%, transparent 0 70%, #000 70% 100%);
  mix-blend-mode: darken; }
.th-onebit .vignette::after { content: ""; position: absolute; left: 0; right: 0; bottom: 6%; height: 10%; background: ${SPARSE} 0 0 / 4px 4px; mix-blend-mode: darken; }
.th-onebit .fig, .th-onebit .fig[class*="m-"] { animation: breathe-1bit 5.2s steps(2) infinite; }
@keyframes breathe-1bit { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
/* Each figure is cut out of the place by an ink moat. */
.th-onebit .face { filter: url(#pl-mono) drop-shadow(3px 0 0 ${INK}) drop-shadow(-3px 0 0 ${INK}) drop-shadow(0 -3px 0 ${INK}); image-rendering: pixelated; transition: opacity .4s steps(3); }
.th-onebit .fig.framed { background: ${INK}; border-radius: 0; outline: 2px solid ${PAPER}; outline-offset: 6px; }
.th-onebit .fig.framed .face { border-radius: 0; box-shadow: none; filter: url(#pl-mono); }
.th-onebit .fig.framed::after { display: none; }
.th-onebit .silhouette { border-radius: 45% 45% 0 0 / 30% 30% 0 0; background: ${CHECK}; color: ${INK}; }
.th-onebit .silhouette span, .th-onebit .silhouette small { background: ${PAPER}; padding: 2px 6px; font-family: ${BIT}; }
.th-onebit .silhouette span { font-size: 48px; }
.th-onebit .silhouette small { font-size: 8px; text-transform: uppercase; }
.th-onebit .plaque { left: 14px; bottom: 14px; z-index: 3; background: ${PAPER}; color: ${INK}; border: 2px solid ${INK}; outline: 2px solid ${PAPER}; padding: 6px 10px 5px; max-width: calc(100% - 40px); }
.th-onebit .plaque .who { font: 16px/1.2 ${BIT}; text-transform: uppercase; letter-spacing: 0; }
.th-onebit .plaque .who::before { content: "1 "; display: inline-block; background: ${INK}; color: ${PAPER}; padding: 0 2px 0 4px; margin-right: 8px; }
.th-onebit .plaque .role { font: 18px/1 ${VT}; letter-spacing: 0; text-transform: none; color: ${INK}; opacity: 1; margin-top: 4px; }
.th-onebit .tell { font: 20px/1.1 ${VT}; font-style: normal; color: ${PAPER}; background: ${INK}; border: 2px solid ${PAPER}; padding: 6px 10px; top: calc(20px + 7%); }
.th-onebit .tell.show { animation: tell-1bit 6s steps(1) forwards; }
@keyframes tell-1bit { 0% { opacity: 0; } 4%, 80% { opacity: 1; } 100% { opacity: 0; } }

.th-onebit .side { border: 0; background: none; box-shadow: none; gap: 10px; }
.th-onebit .head { background: ${INK}; border: 2px solid ${PAPER}; border-bottom: 0; padding: 32px 14px 10px; box-shadow: 0 0 0 2px ${INK}; }
.th-onebit .head::before { ${titleBar("PARLEY", 6)} }
.th-onebit .log { background: ${INK}; border: 2px solid ${PAPER}; border-top: 1px dashed ${PAPER}; margin-top: -10px; padding: 12px 14px; gap: 10px; box-shadow: 0 0 0 2px ${INK}; scroll-behavior: auto; scrollbar-color: ${PAPER} ${INK}; }
.th-onebit .foot { background: ${INK}; border: 2px solid ${PAPER}; padding: 30px 12px 12px; position: relative; box-shadow: 0 0 0 2px ${INK}; }
.th-onebit .foot::before { ${titleBar("WHAT NOW?", 9)} }
.th-onebit .title-row { padding-right: 0; }
.th-onebit .kind, .th-onebit .meter-label, .th-onebit .pl-label, .th-onebit .speaker { font: 8px/1.4 ${BIT}; letter-spacing: 0; }
.th-onebit .kind { font-size: 8px; }
.th-onebit .mode { border: 2px solid ${PAPER}; }
.th-onebit .mode button { font: 8px/1 ${BIT}; padding: 5px 6px; text-transform: uppercase; }
.th-onebit .mode button.on { background: ${PAPER}; color: ${INK}; }
.th-onebit .meter-value { font: 32px/1 ${BIT}; }
.th-onebit .delta { font: 16px/1 ${BIT}; background: ${PAPER}; color: ${INK}; padding: 2px 4px; }
.th-onebit .delta.down::before { content: "-"; display: none; }
.th-onebit .delta.show { animation: delta-1bit 2.4s steps(1) forwards; }
@keyframes delta-1bit { 0% { opacity: 0; } 6%, 80% { opacity: 1; } 100% { opacity: 0; } }
.th-onebit .bar { height: 12px; border: 2px solid ${PAPER}; border-radius: 0; background: ${SPARSE} 0 0 / 4px 4px; padding: 2px; box-sizing: border-box; }
.th-onebit .bar .fill { transition: width 1s steps(10); }
.th-onebit .pip { width: 10px; height: 10px; border-radius: 0; border: 2px solid ${PAPER}; }
.th-onebit .journal-btn { font: 8px/1 ${BIT}; text-transform: uppercase; color: ${PAPER}; border: 2px solid ${PAPER}; padding: 5px 8px 4px; }
.th-onebit .journal-btn::before { content: "F1"; background: ${PAPER}; color: ${INK}; padding: 2px 3px 1px; margin-right: 8px; }
.th-onebit .journal-btn:hover { background: ${PAPER}; color: ${INK}; }
.th-onebit .journal { border: 2px solid ${PAPER}; list-style: none; padding: 8px 10px; font-size: 18px; }
.th-onebit .journal li::before { content: ""; display: inline-block; width: 6px; height: 6px; background: ${PAPER}; margin: 0 8px 2px 0; }
.th-onebit .journal li.used { text-decoration: line-through; }
.th-onebit .journal li.empty { margin-left: 0; font-style: normal; }
.th-onebit .journal li.empty::before { display: none; }
.th-onebit .setting { font-style: normal; font-size: 18px; border: 1px dashed ${PAPER}; padding: 4px 8px; }
.th-onebit .npc .prose { font-size: 20px; line-height: 1.15; }
.th-onebit .npc .prose em, .th-onebit .prose em { font-style: normal; text-decoration: underline; text-underline-offset: 3px; }
.th-onebit .npc .speaker::before { content: ""; display: inline-block; width: 8px; height: 8px; background: ${PAPER}; margin-right: 6px; vertical-align: -1px; }
.th-onebit .you { border: 2px solid ${PAPER}; padding: 6px 10px; }
.th-onebit .you .prose::before { content: "> "; }
.th-onebit .read { border-left: 2px dotted ${PAPER}; }
.th-onebit .die { width: 42px; height: 30px; clip-path: none; border: 2px solid ${PAPER}; font: 16px/1 ${BIT}; transition: none; }
.th-onebit .die.rolling { animation: wobble-1bit .2s steps(1) infinite; }
@keyframes wobble-1bit { 0% { background: ${INK}; color: ${PAPER}; } 50% { background: ${PAPER}; color: ${INK}; } }
.th-onebit .die.kept { transform: none; box-shadow: 0 0 0 2px ${INK}, 0 0 0 4px ${PAPER}; color: ${INK}; }
.th-onebit .die.dropped { opacity: 1; border-style: dashed; color: ${PAPER}; text-decoration: line-through; }
.th-onebit .die.nat20 { background: ${PAPER}; } .th-onebit .die.nat1 { background: ${CHECK}; color: ${INK}; }
.th-onebit .result { font: 8px/1 ${BIT}; letter-spacing: 0; color: ${PAPER}; transition: opacity .3s steps(2); transform: none; }
.th-onebit .result.r-crit_success, .th-onebit .result.r-crit_fail { background: ${PAPER}; color: ${INK}; padding: 3px 4px; }
.th-onebit .result.r-crit_fail { text-decoration: line-through; }
.th-onebit .imm { font-style: normal; font-size: 18px; }
.th-onebit .trn { font: 18px/1.1 ${VT}; }
.th-onebit .tier { border: 2px solid ${PAPER}; color: ${PAPER}; font: 8px/1 ${BIT}; padding: 3px 4px; text-transform: uppercase; }
.th-onebit .tier.t0 { border-style: dashed; } .th-onebit .tier.t4 { background: ${PAPER}; color: ${INK}; }
.th-onebit .why summary { font: 8px/1.6 ${BIT}; text-transform: uppercase; list-style: none; }
.th-onebit .why summary::before { content: "[+] "; } .th-onebit .why[open] summary::before { content: "[-] "; }
.th-onebit .status { font-style: normal; font-size: 18px; }
.th-onebit .status:not(:empty)::after { content: ""; display: inline-block; width: 10px; height: 16px; margin-left: 4px; background: ${PAPER}; vertical-align: -2px; animation: caret-1bit 1s steps(1) infinite; }
@keyframes caret-1bit { 50% { opacity: 0; } }
.th-onebit .composer textarea { border: 2px solid ${PAPER}; font: 20px/1.1 ${VT}; padding: 6px 8px; caret-color: ${PAPER}; }
.th-onebit .composer textarea::placeholder { color: ${PAPER}; opacity: 1; }
.th-onebit .composer textarea:focus { box-shadow: inset 0 0 0 2px ${PAPER}; }
/* The default button: paper, ringed. */
.th-onebit .say { font: 16px/1 ${BIT}; font-weight: 400; background: ${PAPER}; color: ${INK}; border: 2px solid ${INK}; padding: 0 12px; text-transform: uppercase; box-shadow: 0 0 0 2px ${PAPER}, 0 0 0 4px ${INK}, 0 0 0 6px ${PAPER}; margin: 6px; }
.th-onebit .say:hover:not(:disabled) { background: ${INK}; color: ${PAPER}; }
.th-onebit .say:disabled, .th-onebit .deal:disabled { opacity: 1; background: ${CHECK}; color: ${INK}; }
.th-onebit .actions { gap: 12px; }
.th-onebit .actions button, .th-onebit .leave { font: 8px/1 ${BIT}; text-transform: uppercase; border: 2px solid ${PAPER}; color: ${PAPER}; padding: 6px 8px; box-shadow: 3px 3px 0 ${PAPER}; }
.th-onebit .actions button:active, .th-onebit .leave:active { box-shadow: none; translate: 3px 3px; }
.th-onebit .actions button::before, .th-onebit .leave::before { content: "["; margin-right: 6px; } .th-onebit .actions button::after, .th-onebit .leave::after { content: "]"; margin-left: 6px; }
.th-onebit .actions button:hover, .th-onebit .leave:hover { background: ${PAPER}; color: ${INK}; border-color: ${PAPER}; }
.th-onebit .hint { font: 16px/1 ${VT}; }
.th-onebit .end-title { font: 16px/1.3 ${BIT}; text-transform: uppercase; background: ${PAPER}; color: ${INK}; padding: 4px 8px; }
.th-onebit .moments { right: 14px; bottom: 14px; }
.th-onebit .moments button { border: 2px solid ${PAPER}; border-radius: 0; box-shadow: 0 0 0 2px ${INK}; }
.th-onebit .moments img, .th-onebit .moment img { filter: url(#pl-mono); image-rendering: pixelated; }
.th-onebit .moment { transition: opacity .3s steps(3); }
.th-onebit .moment.show img { animation: none; }
.th-onebit .moment::before { background: linear-gradient(transparent 0 78%, ${INK} 78%); }
.th-onebit .moment .cap { font: 16px/1.3 ${BIT}; font-style: normal; text-transform: uppercase; color: ${PAPER}; left: 16px; right: 16px; bottom: 16px; }
.th-onebit .moment.show .cap { animation: tell-1bit 99s steps(1) both; }
.th-onebit .moment.show::after { animation: flash-1bit .24s steps(1) forwards; }
@keyframes flash-1bit { 0% { opacity: 1; } 50% { opacity: 1; background: ${INK}; } 100% { opacity: 0; } }
@media (max-width: 760px) {
  .pl.th-onebit { padding: 6px; gap: 6px; grid-template-rows: 38vh minmax(0, 1fr); }
  .th-onebit .side { gap: 6px; }
  .th-onebit .head { padding: 28px 10px 8px; }
  .th-onebit .log { padding: 10px; margin-top: -6px; }
  .th-onebit .foot { padding: 28px 10px calc(10px + env(safe-area-inset-bottom)); }
  .th-onebit .meter-value { font-size: 16px; }
  .th-onebit .plaque { left: 8px; bottom: 8px; }
  .th-onebit .plaque .role { display: none; }
  .th-onebit .moments { top: 30px; bottom: auto; right: 10px; }
}
`;

/* ------------------------------------------------------------------ */
/* Lobby: obsidian glass with brass hairlines floating over the hall.  */
/* ------------------------------------------------------------------ */
const OBS = "#08090C";
const BRASS = "#C5A059";
const GOLD = "#D4AF37";
/** A 1px gold double hairline, inset, on obsidian. */
const HAIRLINE = `inset 0 0 0 1px rgba(212,175,55,.6), inset 0 0 0 3px rgba(8,9,12,.92), inset 0 0 0 4px rgba(212,175,55,.26)`;
const SHEEN = `linear-gradient(115deg, rgba(255,255,255,0) 0 36%, rgba(255,255,255,.05) 45%, rgba(255,255,255,0) 55%)`;
const LOBBY = `
.pl.th-lobby { --p-side: min(40%, 600px); --p-cols: minmax(0, 1fr) var(--p-side);
  --p-font: 500 16px/1.5 ${GARA}; --p-ui: ${CINZ}; --p-prose: ${GARA};
  --p-ink: #ECE6D6; --p-dim: #a09a8c; --p-faint: #7a756b; --p-soft: #c9c2b2; --p-em: #E3CC8A;
  --p-accent: ${BRASS}; --p-accent-ink: ${OBS}; --p-hot: ${GOLD}; --p-edge: rgba(212,175,55,.4); --p-rule: rgba(212,175,55,.16);
  --p-scene: #0d0b09; --p-well: rgba(3,4,6,.7); --p-bubble: rgba(255,255,255,.035); --p-sunk: rgba(3,4,6,.6); --p-track: #040507;
  --p-fill: ${BRASS}; --p-radius: 2px; --p-bubble-radius: 2px; --p-text-shadow: none;
  --p-die: ${BRASS}; --p-die-ink: ${OBS}; --p-die-kept: #E3C77A;
  background: #0d0b09; }
.th-lobby .scene { grid-column: 1 / -1; grid-row: 1; }
/* The hall itself stays the theme's warm sepia; only the glass is cold. */
.th-lobby .plate-canvas, .th-lobby .plate-img { filter: saturate(.72) sepia(.24) brightness(.78) contrast(1.06); }
.th-lobby .vignette { background:
    linear-gradient(90deg, rgba(8,6,4,.9) 0%, rgba(8,6,4,.3) 10%, rgba(8,6,4,0) 22%),
    linear-gradient(0deg, rgba(6,5,4,.95) 0%, rgba(6,5,4,.5) 12%, rgba(6,5,4,0) 28%),
    linear-gradient(180deg, rgba(6,5,4,.82) 0%, rgba(6,5,4,0) 16%),
    radial-gradient(ellipse 50% 70% at 30% 34%, rgba(214,150,80,.12), rgba(0,0,0,0) 70%),
    radial-gradient(ellipse 80% 90% at 34% 46%, rgba(0,0,0,0) 50%, rgba(0,0,0,.58) 100%); }
.th-lobby .figure { right: var(--p-side); }
.th-lobby .face { filter: drop-shadow(0 20px 34px rgba(0,0,0,.65)); }
.th-lobby .fig.framed { border-radius: 2px; background: #0d0f14; }
.th-lobby .fig.framed .face, .th-lobby .fig.framed::after { border-radius: 2px; }
.th-lobby .fig.framed .face { box-shadow: 0 0 0 1px rgba(212,175,55,.75), 0 0 0 6px rgba(8,9,12,.92), 0 0 0 7px rgba(212,175,55,.3), 0 34px 70px rgba(0,0,0,.75); }
.th-lobby .silhouette { color: rgba(212,175,55,.5); font-family: ${GARA}; background: radial-gradient(60% 40% at 50% 22%, rgba(197,160,89,.14), rgba(8,9,12,.85) 70%); }
/* The obsidian-glass nameplate. */
.th-lobby .plaque { left: clamp(20px, 3vw, 48px); bottom: clamp(18px, 4vh, 40px); z-index: 3; padding: 10px 24px 11px; min-width: 200px; max-width: calc(100% - var(--p-side) - 60px);
  background: ${SHEEN}, rgba(8,9,12,.82); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); border-radius: 2px; box-shadow: ${HAIRLINE}, 0 18px 40px rgba(0,0,0,.6); }
.th-lobby .plaque .who { font: 700 clamp(22px, 4.4vh, 34px)/1.1 ${GARA}; color: #EADFBF; letter-spacing: .01em; }
.th-lobby .plaque .role { font: 600 10.5px/1.3 ${CINZ}; letter-spacing: .22em; color: ${BRASS}; opacity: 1; margin-top: 3px; }
.th-lobby .plaque .role::before { content: "◆ "; color: ${GOLD}; font-size: 8px; vertical-align: 1px; }
.th-lobby .tell { left: calc((100% - var(--p-side)) / 2); font: italic 500 20px/1.35 ${GARA}; color: #EEE8DA; }
.th-lobby .moments { right: calc(var(--p-side) + 24px); }
/* The glass panel: obsidian at 85% over the hall, a gold double hairline, one diagonal sheen. */
.th-lobby .side { grid-column: 2; grid-row: 1; position: relative; z-index: 2; margin: clamp(10px, 2.4vh, 22px) clamp(10px, 1.4vw, 22px) clamp(10px, 2.4vh, 22px) 0; border-radius: 2px;
  background: ${SHEEN}, rgba(8,9,12,.85); -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px);
  border: 0; box-shadow: ${HAIRLINE}, 0 30px 80px rgba(0,0,0,.7); }
.th-lobby .side::after { content: "◆"; position: absolute; left: 50%; top: -6px; translate: -50% 0; font-size: 10px; line-height: 1; color: ${GOLD}; }
.th-lobby .head { padding: 20px 24px 12px; border-bottom: 1px solid rgba(212,175,55,.16); }
.th-lobby .kind, .th-lobby .meter-label, .th-lobby .pl-label, .th-lobby .speaker { font: 600 10px/1.35 ${CINZ}; letter-spacing: .18em; color: ${BRASS}; }
.th-lobby .mode { border: 1px solid rgba(212,175,55,.4); border-radius: 2px; }
.th-lobby .mode button { font: 600 9.5px ${CINZ}; letter-spacing: .14em; text-transform: uppercase; color: #a09a8c; padding: 6px 10px; }
.th-lobby .mode button.on { background: ${OBS}; color: ${GOLD}; box-shadow: inset 0 0 0 1px ${GOLD}, inset 0 0 0 3px ${OBS}, inset 0 0 0 4px rgba(212,175,55,.45); }
.th-lobby .meter-value { font: 700 38px/1 ${GARA}; color: #EADFBF; }
.th-lobby .delta { font: 600 13px ${CINZ}; letter-spacing: .08em; }
.th-lobby .bar { height: 6px; border-radius: 0; border: 1px solid rgba(212,175,55,.4); box-shadow: inset 0 2px 3px rgba(0,0,0,.8); }
.th-lobby .pip { width: 8px; height: 8px; border-radius: 0; rotate: 45deg; margin: 0 2px; border: 1px solid rgba(212,175,55,.6); }
.th-lobby .pip.on { background: ${BRASS}; border-color: ${GOLD}; }
.th-lobby .journal-btn { font: 600 10px ${CINZ}; letter-spacing: .16em; text-transform: uppercase; color: ${BRASS}; }
.th-lobby .journal-btn::before { content: "◇ "; }
.th-lobby .journal { border: 0; border-radius: 2px; list-style: none; padding-left: 14px; box-shadow: ${HAIRLINE}; }
.th-lobby .journal li::before { content: "◆"; font-size: 7px; color: ${BRASS}; margin-right: 8px; vertical-align: 2px; }
.th-lobby .journal li.empty { margin-left: 0; } .th-lobby .journal li.empty::before { content: none; }
.th-lobby .log { padding: 16px 24px; }
.th-lobby .setting { font: italic 500 15px ${GARA}; color: #938d80; }
.th-lobby .npc .prose { font-size: 17px; }
.th-lobby .npc .prose em { color: #E3CC8A; }
.th-lobby .you { border-color: rgba(212,175,55,.3); }
.th-lobby .you .speaker { color: ${GOLD}; }
.th-lobby .read { border-left: 1px solid rgba(212,175,55,.35); }
.th-lobby .die { font: 700 15px ${GARA}; }
.th-lobby .die.kept { box-shadow: none; transform: none; }
.th-lobby .result { font: 600 10.5px ${CINZ}; letter-spacing: .18em; }
.th-lobby .r-crit_success { color: #E3C77A; } .th-lobby .r-partial { color: ${BRASS}; } .th-lobby .r-fail { color: #8f949c; }
.th-lobby .imm { font: italic 500 15px ${GARA}; color: #cfc6b0; }
.th-lobby .trn { font: 13px/1.45 ${GARA}; }
.th-lobby .tier { border-radius: 2px; font: 600 9.5px ${CINZ}; letter-spacing: .12em; border-color: rgba(212,175,55,.4); }
.th-lobby .foot { padding: 12px 24px 18px; border-top: 1px solid rgba(212,175,55,.16); }
.th-lobby .status { font: italic 15px ${GARA}; color: #938d80; }
.th-lobby .composer textarea { border-color: rgba(212,175,55,.3); font: 500 17px/1.35 ${GARA}; box-shadow: inset 0 2px 8px rgba(0,0,0,.6); }
.th-lobby .composer textarea:focus { border-color: ${GOLD}; }
.th-lobby .composer textarea::placeholder { color: #8a857b; font-style: italic; }
.th-lobby .say { color: ${OBS}; background: ${BRASS}; font: 600 11px ${CINZ}; letter-spacing: .2em; text-transform: uppercase; padding: 0 20px; box-shadow: inset 0 1px 0 rgba(255,255,255,.28), inset 0 -1px 0 rgba(0,0,0,.25), 0 6px 16px rgba(0,0,0,.5); }
.th-lobby .say:hover:not(:disabled) { background: #D1AE68; }
.th-lobby .actions button, .th-lobby .leave { border-radius: 2px; border: 0; box-shadow: ${HAIRLINE}; background: rgba(8,9,12,.6); font: 600 10px ${CINZ}; letter-spacing: .16em; text-transform: uppercase; color: ${BRASS}; padding: 8px 14px; }
.th-lobby .actions button:hover, .th-lobby .leave:hover { color: #EADFBF; background: rgba(197,160,89,.1); }
.th-lobby .hint { font: italic 13px ${GARA}; color: #7a756b; }
.th-lobby .end-title { font: 700 30px ${GARA}; color: #EADFBF; }
.th-lobby .moments button { border: 1px solid rgba(212,175,55,.7); border-radius: 2px; box-shadow: 0 0 0 3px rgba(8,9,12,.8), 0 0 0 4px rgba(212,175,55,.3), 0 6px 14px #000a; }
.th-lobby .moment .cap { font: italic 500 28px/1.3 ${GARA}; color: #EEE8DA; }
.th-lobby .moment::before { background: linear-gradient(transparent 58%, rgba(8,9,12,.9)); }
@media (max-width: 760px) {
  .pl.th-lobby { --p-side: 0px; }
  .th-lobby .scene { grid-column: 1; grid-row: 1; }
  .th-lobby .side { grid-column: 1; grid-row: 2; margin: -14px 8px 8px; }
  .th-lobby .figure { right: 0; }
  .th-lobby .tell { left: 50%; }
  .th-lobby .moments { right: 10px; top: 10px; bottom: auto; }
  .th-lobby .plaque { left: 12px; bottom: 24px; max-width: calc(100% - 24px); min-width: 0; padding: 7px 16px 8px; }
  .th-lobby .plaque .role { display: none; }
  .th-lobby .head { padding: 16px 16px 10px; }
  .th-lobby .log { padding: 12px 16px; }
  .th-lobby .foot { padding: 10px 16px calc(14px + env(safe-area-inset-bottom)); }
}
`;

/* ------------------------------------------------------------------ */
/* Diorama: paper on an oak counter under a hanging lamp; the          */
/* nameplate is the shop's price tag on its twine.                     */
/* ------------------------------------------------------------------ */
const OAK = `repeating-linear-gradient(90deg, rgba(60,30,10,.22) 0 1px, transparent 1px 7px, rgba(255,220,160,.06) 7px 9px, transparent 9px 15px), repeating-linear-gradient(90deg, transparent 0 41px, rgba(40,18,4,.25) 41px 43px, transparent 43px 97px), linear-gradient(#9a6a3a, #6b4423 60%, #4a2c14)`;
const PAPER_D = `radial-gradient(ellipse 90% 50% at 50% 0, rgba(255,222,150,.35), rgba(255,222,150,0) 70%), repeating-linear-gradient(17deg, rgba(120,90,50,.035) 0 1px, transparent 1px 4px), repeating-linear-gradient(103deg, rgba(120,90,50,.03) 0 1px, transparent 1px 5px), linear-gradient(#f1e6cb, #e4d4b0)`;
const DIORAMA = `
.pl.th-diorama { --p-font: 500 16px/1.5 ${GARA}; --p-ui: ${GARA}; --p-prose: ${FELL};
  --p-ink: #2b170a; --p-dim: #7a5a3a; --p-faint: #8a6e50; --p-soft: #5a3e24; --p-em: #7a3b16;
  --p-accent: #8a4b1a; --p-accent-ink: #fbe7a8; --p-hot: #b8640b; --p-edge: rgba(107,68,35,.45); --p-rule: rgba(107,68,35,.3);
  --p-scene: #0b0806; --p-well: #fffaf0; --p-bubble: #fffaf0; --p-sunk: rgba(255,250,240,.6); --p-track: #c89b5e;
  --p-fill: linear-gradient(#ffe86a, #f2c62a); --p-radius: 2px; --p-bubble-radius: 1px; --p-text-shadow: none;
  --p-good: #2f6b2a; --p-bad: #a3241f; --p-die: linear-gradient(145deg, #edc98a, #c08e52 60%, #8a5a2a); --p-die-ink: #3a1e08; --p-die-kept: linear-gradient(145deg, #fff3b0, #ffe24a 55%, #d4a24a);
  background: #0b0806; }
.th-diorama .plate-canvas, .th-diorama .plate-img { filter: sepia(.16) saturate(.9) brightness(.84); }
.th-diorama .vignette { background:
    radial-gradient(ellipse 46% 52% at 50% 18%, rgba(255,186,110,.22), rgba(255,150,60,0) 70%),
    linear-gradient(180deg, rgba(12,6,2,.7), rgba(12,6,2,.12) 26%, rgba(12,6,2,.04) 50%, rgba(12,6,2,.5) 80%),
    radial-gradient(ellipse 72% 82% at 50% 40%, rgba(0,0,0,0) 34%, rgba(8,4,1,.6) 100%); }
/* The hanging lamp: a shade at the top with a warm pool of light. */
.th-diorama .scene::before { content: ""; position: absolute; left: 50%; top: 0; width: 70px; height: 34px; translate: -50% 0; z-index: 3; pointer-events: none;
  background: radial-gradient(ellipse 40% 30% at 50% 100%, #fff6c8, #ffcf6a 50%, rgba(255,160,60,0) 100%) 50% 100% / 60px 16px no-repeat,
    linear-gradient(90deg, #1a0e05 0 46%, #3a2410 46% 54%, #1a0e05 54%) 50% 0 / 2px 14px no-repeat,
    linear-gradient(#5a3a1e, #2b1a0c) 50% 12px / 70px 18px no-repeat;
  clip-path: polygon(48.5% 0, 51.5% 0, 51.5% 35%, 90% 35%, 100% 88%, 0 88%, 10% 35%, 48.5% 35%);
  filter: drop-shadow(0 6px 12px rgba(255,180,90,.55)); }
/* The oak counter they stand behind. */
.th-diorama .scene::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 15%; z-index: 2; pointer-events: none;
  background: linear-gradient(rgba(255,214,150,.45), rgba(255,214,150,0) 4px) 0 0 / 100% 6px no-repeat, linear-gradient(rgba(0,0,0,0) 0 14px, rgba(20,10,3,.35) 14px 16px, rgba(0,0,0,0) 16px), ${OAK};
  border-top: 2px solid #c08a52; box-shadow: 0 -12px 22px rgba(0,0,0,.45); }
.th-diorama .face { filter: drop-shadow(0 14px 18px rgba(30,14,4,.55)) sepia(.06); }
.th-diorama .fig.framed { border-radius: 2px; background: #2b1a0c; }
.th-diorama .fig.framed .face, .th-diorama .fig.framed::after { border-radius: 1px; }
.th-diorama .fig.framed .face { box-shadow: 0 0 0 10px #f1e6cb, 0 0 0 11px rgba(107,68,35,.5), 0 18px 30px rgba(0,0,0,.6); }
.th-diorama .fig.framed { margin-bottom: 9%; }
.th-diorama .silhouette { background: radial-gradient(60% 40% at 50% 22%, rgba(255,214,150,.25), rgba(43,23,10,.85) 70%); color: rgba(251,231,168,.55); font-family: ${FELL}; }
/* The price tag, tied with twine. */
.th-diorama .plaque { left: clamp(22px, 4vw, 60px); bottom: 5%; z-index: 4; padding: 8px 18px 9px 34px; color: #2b170a; rotate: -2.5deg; transform-origin: 0 50%;
  background: radial-gradient(circle at 15px 50%, #2b1a0c 0 4px, rgba(0,0,0,0) 4.5px), ${PAPER_D};
  clip-path: polygon(14px 0, 100% 0, 100% 100%, 14px 100%, 0 50%); filter: drop-shadow(0 6px 6px rgba(0,0,0,.5)); }
.th-diorama .plaque::before { content: ""; position: absolute; left: 2px; top: 50%; width: 15px; height: 1px; background: #c8a46a; }
.th-diorama .plaque .who { font: 400 clamp(20px, 4vh, 30px)/1.05 ${FELL}; color: #2b170a; }
.th-diorama .plaque .role { font: italic 500 13px/1.25 ${GARA}; letter-spacing: 0; text-transform: none; color: #6b4423; opacity: 1; max-width: 30ch; }
.th-diorama .tell { font: italic 400 20px/1.3 ${FELL}; color: #fbe7a8; top: 15%; }
.th-diorama .moments { bottom: 4%; z-index: 4; }
/* The panel: a paper sheet set in an oak frame, lit from above. */
.th-diorama .side { background: ${PAPER_D} padding-box, ${OAK} border-box; border: 12px solid transparent; border-left-width: 14px;
  box-shadow: inset 0 0 0 1px rgba(80,50,20,.3), inset 0 10px 24px rgba(80,50,20,.18), -14px 0 34px rgba(0,0,0,.55); }
.th-diorama .head { padding: 16px 22px 12px; border-bottom: 1px dashed rgba(107,68,35,.45); }
.th-diorama .title-row { padding-right: 34px; }
.th-diorama .kind { font: italic 500 14px ${FELL}; letter-spacing: .02em; text-transform: none; color: #6b4423; }
.th-diorama .meter-label, .th-diorama .pl-label, .th-diorama .speaker { font: 700 10.5px ${GARA}; letter-spacing: .16em; color: #8a5a2a; }
.th-diorama .mode { border: 0; border-radius: 0; gap: 4px; overflow: visible; }
.th-diorama .mode button { font: 600 12px ${GARA}; color: #6b4423; padding: 3px 10px; background: rgba(255,250,240,.7); box-shadow: 0 1px 2px rgba(60,30,10,.3); }
.th-diorama .mode button.on { background: linear-gradient(#fff07a, #ffe24a); color: #3a2208; rotate: -2deg; box-shadow: 0 2px 4px rgba(60,30,10,.35); }
.th-diorama .meter-value { font: 400 36px/1 ${FELL}; color: #2b170a; }
.th-diorama .delta { font: italic 600 16px ${FELL}; }
/* A wooden ruler with a strip of yellow paper laid along it. */
.th-diorama .bar { height: 14px; border-radius: 1px; padding: 3px 0; box-sizing: border-box;
  background: repeating-linear-gradient(90deg, rgba(60,30,10,.6) 0 1px, transparent 1px 8px) 0 0 / 100% 4px repeat-x, repeating-linear-gradient(90deg, rgba(60,30,10,.7) 0 1px, transparent 1px 40px) 0 0 / 100% 7px repeat-x, linear-gradient(#e2b878, #c08e52);
  box-shadow: 0 1px 2px rgba(60,30,10,.4); }
.th-diorama .bar .fill { box-shadow: 0 1px 1px rgba(60,30,10,.35); opacity: .92; }
.th-diorama .pip { width: 11px; height: 11px; border: 1px dashed #8a5a2a; }
.th-diorama .pip.on { background: radial-gradient(circle at 35% 30%, #e0b874, #8a5a2a 70%); border: 1px solid #5a3418; }
.th-diorama .journal-btn { font: italic 500 15px ${FELL}; color: #8a4b1a; text-decoration: underline dotted; text-underline-offset: 3px; }
.th-diorama .journal { background: #fffaf0; border: 0; border-radius: 0; box-shadow: 0 2px 5px rgba(60,30,10,.25); list-style: square; }
.th-diorama .log { padding: 14px 22px; }
.th-diorama .setting { font: italic 400 15px ${FELL}; color: #6b4a2a; }
.th-diorama .npc .prose { font-size: 17.5px; line-height: 1.42; color: #261409; }
.th-diorama .npc .prose em { color: #7a3b16; }
.th-diorama .you { position: relative; padding: 10px 14px 9px; border: 0; rotate: .6deg; box-shadow: 0 2px 5px rgba(60,30,10,.28); }
.th-diorama .you::before { content: ""; position: absolute; left: 50%; top: -7px; width: 54px; height: 14px; translate: -50% 0; rotate: -3deg; background: rgba(230,210,160,.75); box-shadow: 0 1px 1px rgba(60,30,10,.15); }
.th-diorama .you .speaker { color: #8a4b1a; }
.th-diorama .read { border-left: 2px dashed rgba(107,68,35,.45); }
.th-diorama .die { clip-path: none; border-radius: 6px; width: 30px; height: 30px; font: 400 16px ${FELL}; box-shadow: inset 0 -2px 0 rgba(60,30,10,.35), 0 2px 3px rgba(60,30,10,.4); }
.th-diorama .die.kept { box-shadow: inset 0 -2px 0 rgba(120,80,10,.35), 0 0 12px rgba(255,214,80,.75); }
.th-diorama .die.nat1 { background: linear-gradient(145deg, #e0645a, #8b1a1a); color: #fbe7a8; }
.th-diorama .result { font: 700 11px ${GARA}; letter-spacing: .14em; }
.th-diorama .r-crit_success { color: #9a6a00; } .th-diorama .r-success { color: #2f6b2a; } .th-diorama .r-partial { color: #7a5a2a; } .th-diorama .r-fail { color: #6b5a4a; } .th-diorama .r-crit_fail { color: #a3241f; }
.th-diorama .imm { font: italic 400 15px ${FELL}; color: #5a3418; }
.th-diorama .trn { font: 13px/1.45 ${GARA}; }
.th-diorama .tier { border-radius: 1px; border-color: rgba(107,68,35,.6); font: 600 11px ${GARA}; }
.th-diorama .tier.t0 { border-color: #a3241f; color: #a3241f; } .th-diorama .tier.t1 { color: #8a4a1a; } .th-diorama .tier.t3 { color: #2f6b2a; } .th-diorama .tier.t4 { border-color: #9a6a00; color: #9a6a00; }
.th-diorama .foot { padding: 10px 22px 18px; border-top: 1px dashed rgba(107,68,35,.45); }
.th-diorama .status { font-family: ${FELL}; color: #6b4a2a; }
/* An index card to write on. */
.th-diorama .composer textarea { border: 0; font: 400 17px/1.4 ${FELL}; color: #2b170a; padding-left: 30px; box-shadow: 0 2px 5px rgba(60,30,10,.3);
  background: linear-gradient(90deg, transparent 21px, rgba(200,60,60,.45) 21px 22px, transparent 22px), repeating-linear-gradient(transparent 0 calc(1.4em - 1px), rgba(80,120,190,.25) calc(1.4em - 1px) 1.4em) 0 9px / 100% 100% local, #fffaf0; }
.th-diorama .composer textarea:focus { box-shadow: 0 2px 5px rgba(60,30,10,.3), 0 0 0 2px rgba(255,214,80,.6); }
.th-diorama .composer textarea::placeholder { color: #a08a6a; font-style: italic; }
.th-diorama .say { background: ${OAK}; color: #fbe7a8; font: 400 18px ${FELL}; padding: 0 18px; border-radius: 3px; box-shadow: inset 0 1px 0 rgba(255,220,160,.35), inset 0 -2px 0 rgba(0,0,0,.3), 0 3px 6px rgba(60,30,10,.45); text-shadow: 0 1px 1px #000; }
.th-diorama .say:hover:not(:disabled) { filter: brightness(1.12); }
.th-diorama .actions button, .th-diorama .leave { font: italic 500 15px ${FELL}; color: #3a2208; border: 0; border-radius: 0; padding: 5px 14px 5px 24px;
  background: radial-gradient(circle at 10px 50%, #6b4423 0 2.5px, rgba(0,0,0,0) 3px), linear-gradient(#fffaf0, #efe2c4); clip-path: polygon(8px 0, 100% 0, 100% 100%, 8px 100%, 0 50%); filter: drop-shadow(0 2px 2px rgba(60,30,10,.35)); }
.th-diorama .actions .deal { background: radial-gradient(circle at 10px 50%, #6b4423 0 2.5px, rgba(0,0,0,0) 3px), linear-gradient(#fff07a, #ffe24a); }
.th-diorama .actions button:hover, .th-diorama .leave:hover { color: #000; filter: drop-shadow(0 3px 4px rgba(60,30,10,.45)) brightness(1.04); }
.th-diorama .hint { font: italic 13px ${GARA}; color: #8a6e50; }
.th-diorama .end-title { font: 400 30px ${FELL}; color: #8a4b1a; }
.th-diorama .moments button { border: 3px solid #fffaf0; border-bottom-width: 9px; border-radius: 1px; rotate: -2deg; box-shadow: 0 4px 8px #000a; }
.th-diorama .moments button:nth-child(2n) { rotate: 2.5deg; }
.th-diorama .moment .cap { font: italic 400 26px/1.3 ${FELL}; color: #fbe7a8; }
@media (max-width: 760px) {
  .th-diorama .side { border-width: 8px; }
  .th-diorama .head { padding: 12px 14px 10px; }
  .th-diorama .log { padding: 12px 14px; }
  .th-diorama .foot { padding: 10px 14px calc(14px + env(safe-area-inset-bottom)); }
  .th-diorama .plaque .role { display: none; }
  .th-diorama .plaque { left: 14px; padding: 6px 14px 7px 30px; }
  .th-diorama .moments { top: 12px; bottom: auto; right: 12px; }
}
`;

/* ------------------------------------------------------------------ */
/* Table: candle-lit walnut, green baize, a chalk slate and woodcut    */
/* cards (the hand of facts stays as it was, now in woodcut).          */
/* ------------------------------------------------------------------ */
const WALNUT = `repeating-linear-gradient(88deg, rgba(0,0,0,.2) 0 2px, transparent 2px 11px, rgba(255,190,120,.05) 11px 13px, transparent 13px 23px), linear-gradient(#4a2c16, #2a170b)`;
const BAIZE = `radial-gradient(ellipse 90% 60% at 50% 0, rgba(255,190,110,.12), rgba(0,0,0,0) 70%), repeating-conic-gradient(rgba(0,0,0,.06) 0 25%, rgba(255,255,255,.025) 0 50%) 0 0 / 3px 3px, linear-gradient(#173a26, #0f2a1b)`;
const CARD_BACK = `repeating-linear-gradient(45deg, rgba(242,207,122,.28) 0 1px, transparent 1px 7px), repeating-linear-gradient(-45deg, rgba(242,207,122,.28) 0 1px, transparent 1px 7px), linear-gradient(#b0181e, #7a0e13)`;
const SLATE = `radial-gradient(ellipse 60% 40% at 30% 30%, rgba(255,255,255,.05), rgba(255,255,255,0)), linear-gradient(#2c3230, #1d2220)`;
const TABLE = `
.pl.th-table { --p-font: 400 16px/1.5 ${FELL}; --p-ui: ${GARA}; --p-prose: ${FELL};
  --p-ink: #fff2e0; --p-dim: #bfae8c; --p-faint: #8f8466; --p-soft: #d8c9a6; --p-em: #ffd9a0;
  --p-accent: #ffcf6a; --p-accent-ink: #2a1804; --p-hot: #ffcf6a; --p-edge: rgba(242,207,122,.35); --p-rule: rgba(242,207,122,.2);
  --p-well: rgba(8,16,11,.6); --p-bubble: #fbf3e2; --p-sunk: rgba(8,16,11,.55); --p-track: rgba(255,255,255,.08);
  --p-fill: linear-gradient(90deg, rgba(255,255,255,.55), rgba(255,255,255,.88)); --p-radius: 4px; --p-bubble-radius: 6px; --p-text-shadow: none;
  --p-good: #8fd18a; --p-bad: #ff7a64; --p-die: linear-gradient(140deg, #fffaf0, #e8dcc0 50%, #b9a782); --p-die-ink: #2a1804; --p-die-kept: linear-gradient(140deg, #fffaf0, #ffe7a8 50%, #e0b450); }
.th-table .plate-canvas, .th-table .plate-img { filter: sepia(.2) brightness(.72) contrast(1.05); }
.th-table .vignette { background: radial-gradient(ellipse 70% 60% at 50% 78%, rgba(255,170,80,.16), rgba(255,140,40,0) 70%), radial-gradient(120% 90% at 50% 46%, transparent 40%, rgba(8,5,2,.6) 72%, rgba(6,3,1,.95) 100%);
  animation: candle 3.4s ease-in-out infinite alternate; }
@keyframes candle { 0% { opacity: .92; } 30% { opacity: 1; } 55% { opacity: .86; } 80% { opacity: .98; } 100% { opacity: .9; } }
.th-table .scene::after { height: 20%; background: ${WALNUT}; border-top: 3px solid #8a5a2e; box-shadow: 0 -30px 60px #ffb35a22 inset, 0 -2px 0 rgba(255,200,130,.25); }
.th-table .face { filter: drop-shadow(0 18px 30px rgba(0,0,0,.65)) sepia(.08); }
.th-table .fig.framed .face { box-shadow: 0 0 0 1px #2a1804, 0 0 0 5px #fbf3e2, 0 0 0 6px #2a1804, 0 0 0 8px #fbf3e2, 0 0 0 9px rgba(42,24,4,.6), 0 30px 60px rgba(0,0,0,.7); border-radius: 6px; }
.th-table .fig.framed { border-radius: 6px; }
.th-table .silhouette { font-family: ${FELL}; }
/* A brass plaque screwed to the table's edge. */
.th-table .plaque { left: 50%; translate: -50% 0; bottom: 4%; z-index: 3; text-align: center; padding: 6px 26px 7px; min-width: 180px; width: max-content; max-width: min(92%, 560px);
  background: linear-gradient(#f6dc96, #c99a46 45%, #8a6020); border-radius: 3px; color: #2a1804; text-shadow: 0 1px 0 rgba(255,240,200,.6);
  box-shadow: 0 0 0 1px #4a2e0a, inset 0 1px 0 rgba(255,255,255,.55), 0 6px 14px rgba(0,0,0,.6); }
.th-table .plaque::before, .th-table .plaque::after { content: ""; position: absolute; top: 50%; width: 6px; height: 6px; margin-top: -3px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #fff2c0, #7a5418); box-shadow: 0 0 0 1px #4a2e0a; }
.th-table .plaque::before { left: 9px; } .th-table .plaque::after { right: 9px; }
.th-table .plaque .who { font: 400 clamp(20px, 3.8vh, 30px)/1.05 ${FELL}; }
.th-table .plaque .role { font: 700 11px/1.3 ${GARA}; letter-spacing: .16em; color: #2a1804; text-shadow: 0 1px 0 rgba(255,236,180,.45); opacity: 1; margin: 1px auto 0; }
.th-table .tell { font: italic 400 21px/1.3 ${FELL}; color: #ffe8c0; }
.th-table .moments { bottom: auto; top: 18px; }
/* Green baize on a walnut rail. */
.th-table .side { background: ${BAIZE} padding-box, ${WALNUT} border-box; border: 0; border-left: 12px solid transparent; box-shadow: inset 6px 0 14px rgba(0,0,0,.45), -12px 0 30px rgba(0,0,0,.5); }
/* The chalk scoreboard. */
.th-table .head { margin: 12px 14px 4px; padding: 14px 16px 12px; border: 6px solid transparent; border-radius: 3px;
  background: ${SLATE} padding-box, ${WALNUT} border-box; box-shadow: 0 6px 14px rgba(0,0,0,.5), inset 0 0 18px rgba(0,0,0,.5); color: #f3f1ea; }
.th-table .head, .th-table .head button { text-shadow: 0 0 1px rgba(255,255,255,.55), 0 0 6px rgba(255,255,255,.12); }
.th-table .title-row { padding-right: 30px; }
.th-table .kind, .th-table .meter-label, .th-table .pl-label { font: 400 13px ${FELL}; letter-spacing: .08em; text-transform: none; color: rgba(243,241,234,.72); }
.th-table .mode { border: 1px dashed rgba(243,241,234,.5); border-radius: 3px; }
.th-table .mode button { font: 400 13px ${FELL}; color: rgba(243,241,234,.7); }
.th-table .mode button.on { background: rgba(243,241,234,.85); color: #1d2220; text-shadow: none; }
.th-table .meter-value { font: 400 38px/1 ${FELL}; color: #f7f5ee; }
.th-table .bar { height: 7px; border-radius: 4px; }
.th-table .bar .fill { border-radius: 4px; }
.th-table .pip { width: 11px; height: 11px; border: 1.5px solid rgba(243,241,234,.65); }
.th-table .pip.on { background: rgba(243,241,234,.88); border-color: rgba(243,241,234,.9); box-shadow: 0 0 3px rgba(255,255,255,.35); }
.th-table .journal-btn { font: italic 400 14px ${FELL}; color: #ffe7a8; }
.th-table .journal { background: #fbf3e2; color: #2a1804; border: 0; border-radius: 3px; text-shadow: none; box-shadow: inset 0 0 0 3px #fbf3e2, inset 0 0 0 4px #2a1804; }
.th-table .journal li.used, .th-table .journal li.empty { color: #7a6a4a; }
.th-table .log { padding: 12px 18px; }
.th-table .setting { font-style: italic; color: #bfae8c; font-size: 15px; }
.th-table .speaker { font: 600 10.5px ${GARA}; letter-spacing: .16em; color: #e8c06a; }
.th-table .npc .prose { font-size: 17.5px; line-height: 1.42; }
/* What you say: a card laid face up, woodcut-ruled. */
.th-table .you { color: #2a1804; border: 0; padding: 9px 14px; box-shadow: inset 0 0 0 3px #fbf3e2, inset 0 0 0 4px #2a1804, 0 4px 10px rgba(0,0,0,.5); }
.th-table .you .speaker { color: #9c1419; }
.th-table .you .prose em { color: #7a3b16; }
.th-table .read { border-left: 2px solid rgba(242,207,122,.3); }
.th-table .die { font: 400 15px ${FELL}; filter: drop-shadow(0 2px 2px rgba(0,0,0,.55)); }
.th-table .die.kept { box-shadow: none; filter: drop-shadow(0 0 8px rgba(255,207,106,.7)); }
.th-table .die.nat1 { background: linear-gradient(140deg, #e0645a, #9c1419); color: #fff2e0; }
.th-table .result { font: 600 11px ${GARA}; letter-spacing: .16em; }
.th-table .imm { font: italic 400 15px ${FELL}; }
.th-table .trn { font: 13px/1.45 ${GARA}; }
.th-table .tier { border-color: rgba(242,207,122,.45); border-radius: 3px; font-family: ${GARA}; }
.pl.th-table .foot { background: linear-gradient(rgba(10,22,14,.4), rgba(6,14,9,.75)); border-top: 1px solid rgba(242,207,122,.2); padding: 8px 18px 16px; }
.th-table .status { color: #bfae8c; }
.th-table .composer textarea { background: rgba(4,10,6,.55); border-color: rgba(242,207,122,.3); font: 400 17px/1.35 ${FELL}; box-shadow: inset 0 2px 6px rgba(0,0,0,.5); }
.th-table .composer textarea::placeholder { color: #8f8466; font-style: italic; }
/* Say plays a card: the red back. */
.th-table .say { background: ${CARD_BACK}; color: #fff2e0; font: 400 18px ${FELL}; border-radius: 6px; padding: 0 18px; box-shadow: inset 0 0 0 2px #7a0e13, inset 0 0 0 3px #f2cf7a, 0 4px 10px rgba(0,0,0,.5); text-shadow: 0 1px 2px #000; }
.th-table .say:hover:not(:disabled) { filter: brightness(1.12); }
.th-table .actions button, .th-table .leave { border-radius: 5px; font: 400 15px ${FELL}; color: #2a1804; border: 0; padding: 5px 16px; background: #fbf3e2; box-shadow: inset 0 0 0 2px #fbf3e2, inset 0 0 0 3px #2a1804, 0 3px 6px rgba(0,0,0,.45); }
.th-table .actions .walk { background: ${CARD_BACK}; color: #fff2e0; box-shadow: inset 0 0 0 2px #7a0e13, inset 0 0 0 3px #f2cf7a, 0 3px 6px rgba(0,0,0,.45); }
.th-table .actions button:hover, .th-table .leave:hover { filter: brightness(1.1); color: inherit; }
.th-table .actions .walk:hover { color: #fff; }
.th-table .hint { color: #8f8466; font: italic 12.5px ${GARA}; }
.th-table .end-title { font: 400 30px ${FELL}; color: #ffcf6a; }
/* The hand of facts, as inked woodcut cards. */
.pl.th-table .fact-card { width: 138px; min-height: 96px; padding: 12px 12px 10px 14px; font: 13px/1.3 ${FELL}; background: #fbf3e2; border: 0; border-radius: 7px;
  box-shadow: inset 0 0 0 3px #fbf3e2, inset 0 0 0 4px #2a1804, inset 0 0 0 6px #fbf3e2, inset 0 0 0 7px rgba(42,24,4,.5), 0 8px 16px #000a; position: relative; }
.pl.th-table .fact-card::before { content: "♦"; position: absolute; left: 7px; top: 4px; font-size: 10px; color: #9c1419; }
.pl.th-table .fact-card.used { opacity: 1; color: transparent; background: ${CARD_BACK}; box-shadow: inset 0 0 0 3px #7a0e13, inset 0 0 0 4px #f2cf7a, 0 6px 12px #0009; }
.pl.th-table .fact-card.used::before { content: none; }
@media (max-height: 720px) {
  .pl.th-table .fact-card { width: 118px; min-height: 0; height: 66px; overflow: hidden; padding: 9px 10px 6px 12px; font-size: 11.5px; line-height: 1.22; }
  .pl.th-table .hand { padding: 4px 0 12px; }
}
.th-table .moments button { border: 2px solid #fbf3e2; border-radius: 4px; box-shadow: 0 0 0 1px #2a1804, 0 4px 10px #000a; }
.th-table .moment .cap { font: italic 400 28px/1.3 ${FELL}; color: #ffe8c0; }
@media (max-width: 760px) {
  .th-table .side { border-left: 0; border-top: 0; }
  .th-table .head { margin: 8px 8px 2px; padding: 10px 12px 8px; }
  .th-table .log { padding: 10px 14px; }
  .pl.th-table .foot { padding: 8px 14px calc(12px + env(safe-area-inset-bottom)); }
  .th-table .plaque { bottom: 6px; padding: 4px 22px 5px; }
  .th-table .plaque .role { display: none; }
  .th-table .moments { top: 10px; }
  .pl.th-table { grid-template-rows: 34vh minmax(0, 1fr); }
  .th-table .meter-value { font-size: 28px; }
  .pl.th-table .hand { padding: 4px 0 12px; }
  .pl.th-table .fact-card { width: 96px; min-height: 0; height: 58px; overflow: hidden; margin: 0 -8px; padding: 8px 8px 5px 10px; font-size: 10.5px; line-height: 1.2; }
}
`;

/* ------------------------------------------------------------------ */
/* Command: an EGA screen, royal blue chassis, black windows rimmed by */
/* double white rules that end in chevron caps around inline labels.   */
/* ------------------------------------------------------------------ */
const BLUE = "#0000AA";
const CYAN = "#55FFFF";
const YEL = "#FFFF55";
const MAG = "#FF55FF";
const GREY = "#AAAAAA";
const DARK = "#555555";
const RED = "#FF5555";
const GREEN = "#55FF55";
const chev = (right: boolean, ink = "#fff") => {
  const pts: [number, number][] = [[1, 0], [2, 1], [3, 2], [4, 3], [4, 4], [3, 5], [2, 6], [1, 7]];
  const rects = pts.map(([x, y]) => `<rect x='${right ? 7 - x - 1 : x + 1}' y='${y}' width='1' height='1'/>`).join("");
  return svg(`width='8' height='8' viewBox='0 0 8 8' shape-rendering='crispEdges' fill='${ink}'>${rects}`);
};
/** An inline label on a window's top rule: black knock-out, chevron caps either side. */
const label = (text: string, top: string, left = "16px") =>
  `content: "${text}"; position: absolute; top: ${top}; left: ${left}; z-index: 7; height: 16px; padding: 0 20px; font: 16px/16px ${BIT}; color: ${CYAN}; background: ${chev(false)} 0 50% / 16px 16px no-repeat, ${chev(true)} 100% 50% / 16px 16px no-repeat, #000; white-space: nowrap;`;
const SCAN = `repeating-linear-gradient(rgba(0,0,0,0) 0 1px, rgba(0,0,0,.35) 1px 2px)`;
const COMMAND = `
.pl.th-command { --p-font: 20px/1.2 ${VT}; --p-ui: ${BIT}; --p-prose: ${VT};
  --p-ink: #FFFFFF; --p-dim: ${GREY}; --p-faint: ${DARK}; --p-soft: ${GREY}; --p-em: ${CYAN};
  --p-accent: ${CYAN}; --p-accent-ink: #000; --p-hot: ${YEL}; --p-edge: #fff; --p-rule: ${DARK};
  --p-scene: #000; --p-panel: ${BLUE}; --p-panel-shadow: none; --p-well: #000; --p-bubble: #000; --p-sunk: #000; --p-track: ${BLUE};
  --p-fill: repeating-linear-gradient(90deg, ${YEL} 0 12px, transparent 12px 16px); --p-radius: 0; --p-pill: 0; --p-bubble-radius: 0; --p-text-shadow: none;
  --p-good: ${GREEN}; --p-bad: ${RED}; --p-die: #000; --p-die-ink: #fff; --p-die-kept: ${YEL};
  background: ${BLUE}; padding: 8px; gap: 8px; -webkit-font-smoothing: none; font-smooth: never; }
.th-command .scene, .th-command .head, .th-command .log, .th-command .foot { text-shadow: 0 0 2px color-mix(in srgb, currentColor 45%, transparent), 0 0 7px color-mix(in srgb, currentColor 22%, transparent); }
/* The CRT: scanlines over everything, a faint roll. */
.pl.th-command::after { content: ""; position: absolute; inset: 0; z-index: 50; pointer-events: none; background: ${SCAN};
  box-shadow: inset 0 0 120px rgba(0,0,0,.35); }
.th-command .scene { background: #000; }
.th-command .scene::after { content: ""; position: absolute; inset: 4px; z-index: 6; pointer-events: none; border: 6px double #fff; }
.th-command .scene::before { ${label("VIEW", "0")} }
.th-command .plate { inset: 0; animation: none; }
.th-command .plate-canvas, .th-command .plate-img { filter: saturate(1.4) contrast(1.15) url(#pl-ega); image-rendering: pixelated; }
.th-command .scene:has(.fig.framed) .plate { filter: brightness(.55); }
.th-command .vignette { background: linear-gradient(to top, #000 0 7%, rgba(0,0,0,0) 7%), ${svg(`width='4' height='4' shape-rendering='crispEdges'><rect width='2' height='2' fill='#000'/><rect x='2' y='2' width='2' height='2' fill='#000'/>`)} 0 0 / 4px 4px;
  -webkit-mask: radial-gradient(ellipse 74% 80% at 50% 45%, transparent 0 80%, #000 80%); mask: radial-gradient(ellipse 74% 80% at 50% 45%, transparent 0 80%, #000 80%); }
.th-command .fig, .th-command .fig[class*="m-"] { animation: breathe-cmd 5.2s steps(2) infinite; }
@keyframes breathe-cmd { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
.th-command .face { filter: saturate(1.3) url(#pl-ega); image-rendering: pixelated; transition: opacity .3s steps(3); }
.th-command .fig.framed { background: #000; border-radius: 0; outline: 6px double #fff; outline-offset: 6px; }
.th-command .fig.framed .face { border-radius: 0; box-shadow: none; filter: saturate(1.3) url(#pl-ega); }
.th-command .fig.framed::after { display: none; }
.th-command .silhouette { border-radius: 0; background: repeating-linear-gradient(${BLUE} 0 2px, #000 2px 4px); color: ${CYAN}; font-family: ${BIT}; }
.th-command .silhouette small { font: 8px ${BIT}; color: ${YEL}; text-transform: uppercase; }
/* The encounter box: a framed window docked on the viewport's floor. */
.th-command .plaque { left: 18px; bottom: 18px; z-index: 7; background: #000; border: 6px double #fff; padding: 10px 14px 8px; max-width: calc(100% - 140px); }
.th-command .plaque .who { font: 16px/1.2 ${BIT}; color: ${YEL}; text-transform: uppercase; letter-spacing: 0; }
.th-command .plaque .role { font: 20px/1 ${VT}; color: ${CYAN}; text-transform: none; letter-spacing: 0; opacity: 1; margin-top: 4px; }
.th-command .tell { font: 20px/1.1 ${VT}; font-style: normal; color: ${YEL}; background: #000; border: 2px solid ${YEL}; padding: 4px 10px; top: 28px; }
.th-command .tell.show { animation: tell-cmd 6s steps(1) forwards; }
@keyframes tell-cmd { 0% { opacity: 0; } 3%, 82% { opacity: 1; } 100% { opacity: 0; } }
.th-command .moments { right: 18px; bottom: 18px; z-index: 7; }

/* Two windows on the right: the talk (header + log) and the command line. */
.th-command .side { background: none; border: 0; box-shadow: none; gap: 8px; }
.th-command .head { background: #000; border: 6px double #fff; border-bottom: 2px solid ${DARK}; padding: 18px 14px 10px; }
.th-command .head::before { ${label("PARLEY", "-11px")} }
.th-command .log { background: #000; border: 6px double #fff; border-top: 0; margin-top: -8px; padding: 12px 14px; gap: 10px; scroll-behavior: auto; scrollbar-color: ${CYAN} #000; }
.th-command .foot { background: #000; border: 6px double #fff; border-top: 0; position: relative; padding: 16px 14px 12px;
  background-image: linear-gradient(#fff, #fff), linear-gradient(#000, #000), linear-gradient(#fff, #fff); background-size: 100% 2px; background-position: 0 0, 0 2px, 0 4px; background-repeat: no-repeat; }
.th-command .foot::before { ${label("COMMAND", "-6px")} }
.th-command .title-row { padding-right: 0; }
.th-command .kind, .th-command .meter-label, .th-command .pl-label, .th-command .speaker { font: 8px/1.5 ${BIT}; letter-spacing: 0; color: ${CYAN}; }
.th-command .kind { color: ${GREY}; }
.th-command .mode { border: 0; gap: 8px; }
.th-command .mode button { font: 8px/1 ${BIT}; color: ${GREY}; padding: 4px 4px; text-transform: uppercase; }
.th-command .mode button.on { background: ${CYAN}; color: #000; text-shadow: none; }
.th-command .meter-value { font: 32px/1 ${BIT}; color: ${YEL}; }
.th-command .delta { font: 16px/1 ${BIT}; }
.th-command .delta.show { animation: tell-cmd 2.4s steps(1) forwards; }
.th-command .bar { height: 16px; border-radius: 0; border: 2px solid ${GREY}; background: #000; padding: 2px; box-sizing: border-box; }
.th-command .bar .fill { transition: width 1s steps(12); }
.th-command .pip { width: 10px; height: 10px; border-radius: 0; border: 2px solid ${DARK}; }
.th-command .pip.on { background: ${MAG}; border-color: ${MAG}; }
.th-command .journal-btn { font: 8px/1 ${BIT}; color: ${CYAN}; text-transform: uppercase; padding: 4px 0; }
.th-command .journal-btn::before { content: "F1"; background: ${GREY}; color: #000; padding: 2px 3px; margin-right: 8px; text-shadow: none; }
.th-command .journal-btn:hover { color: ${YEL}; }
.th-command .journal { border: 2px solid ${DARK}; list-style: none; padding: 6px 10px; font-size: 20px; }
.th-command .journal li::before { content: "* "; color: ${MAG}; }
.th-command .journal li.used { color: ${DARK}; }
.th-command .journal li.empty { margin-left: 0; font-style: normal; } .th-command .journal li.empty::before { content: ""; }
.th-command .setting { font-style: normal; color: ${GREY}; font-size: 20px; }
.th-command .npc .speaker { color: ${YEL}; }
.th-command .npc .prose { font-size: 21px; line-height: 1.15; }
.th-command .prose em { font-style: normal; color: ${CYAN}; }
.th-command .you { align-self: stretch; max-width: none; border: 0; padding: 0; }
.th-command .you .speaker { text-align: left; color: ${GREEN}; }
.th-command .you .prose { color: ${GREEN}; }
.th-command .you .prose::before { content: "> "; }
.th-command .read { border-left: 2px solid ${DARK}; }
.th-command .die { width: 42px; height: 30px; clip-path: none; border: 2px solid #fff; font: 16px/1 ${BIT}; transition: none; }
.th-command .die.rolling { animation: roll-cmd .14s steps(1) infinite; }
@keyframes roll-cmd { 0% { color: ${CYAN}; } 50% { color: ${MAG}; } }
.th-command .die.kept { transform: none; box-shadow: none; color: #000; border-color: ${YEL}; text-shadow: none; }
.th-command .die.dropped { opacity: 1; color: ${DARK}; border-color: ${DARK}; }
.th-command .die.nat20 { background: #fff; border-color: #fff; } .th-command .die.nat1 { background: ${RED}; border-color: ${RED}; color: #000; }
.th-command .result { font: 8px/1 ${BIT}; letter-spacing: 0; transition: opacity .2s steps(2); transform: none; }
.th-command .r-crit_success { color: ${YEL}; } .th-command .r-success { color: ${GREEN}; } .th-command .r-partial { color: ${CYAN}; } .th-command .r-fail { color: ${GREY}; } .th-command .r-crit_fail { color: ${RED}; }
.th-command .imm { font-style: normal; color: ${GREY}; font-size: 19px; }
.th-command .trn { font: 19px/1.1 ${VT}; color: ${GREY}; }
.th-command .tier { border: 2px solid ${GREY}; font: 8px/1 ${BIT}; padding: 3px 4px; text-transform: uppercase; }
.th-command .tier.t0 { border-color: ${RED}; color: ${RED}; } .th-command .tier.t1 { color: ${MAG}; } .th-command .tier.t3 { color: ${GREEN}; } .th-command .tier.t4 { border-color: ${YEL}; color: ${YEL}; }
.th-command .why summary { font: 8px/1.6 ${BIT}; color: ${CYAN}; text-transform: uppercase; }
.th-command .why pre { color: ${GREY}; }
.th-command .status { font-style: normal; color: ${YEL}; font-size: 20px; }
.th-command .status:not(:empty)::after { content: "_"; animation: caret-cmd 1s steps(1) infinite; }
@keyframes caret-cmd { 50% { opacity: 0; } }
.th-command .composer textarea { border: 0; border-left: 2px solid ${DARK}; font: 21px/1.15 ${VT}; color: ${GREEN}; padding: 4px 10px; caret-color: ${GREEN}; }
.th-command .composer textarea::placeholder { color: ${GREY}; opacity: 1; }
.th-command .composer textarea:focus { border-left-color: ${GREEN}; }
.th-command .say { font: 16px/1 ${BIT}; font-weight: 400; background: ${CYAN}; color: #000; padding: 0 14px; text-transform: uppercase; box-shadow: 4px 4px 0 ${DARK}; text-shadow: none; }
.th-command .say:hover:not(:disabled) { background: ${YEL}; }
.th-command .say:disabled, .th-command .deal:disabled { opacity: 1; background: ${DARK}; color: ${GREY}; }
.th-command .actions { gap: 12px; }
.th-command .actions button, .th-command .leave { font: 8px/1 ${BIT}; text-transform: uppercase; background: ${GREY}; color: #000; border: 0; padding: 6px 10px; box-shadow: 4px 4px 0 ${DARK}; text-shadow: none; }
.th-command .actions button:hover, .th-command .leave:hover { background: #fff; color: #000; }
.th-command .hint { font: 18px/1 ${VT}; color: ${GREY}; }
.th-command .end-title { font: 16px/1.3 ${BIT}; color: ${YEL}; text-transform: uppercase; }
.th-command .end-sub { color: ${CYAN}; }
.th-command .moments button { border: 2px solid #fff; border-radius: 0; box-shadow: 4px 4px 0 #000; }
.th-command .moments img, .th-command .moment img { filter: saturate(1.3) url(#pl-ega); image-rendering: pixelated; }
.th-command .moment.show img { animation: none; }
.th-command .moment { transition: opacity .2s steps(2); }
.th-command .moment::before { background: none; }
.th-command .moment .cap { left: 20px; right: auto; max-width: calc(100% - 40px); bottom: 20px; font: 16px/1.4 ${BIT}; font-style: normal; text-transform: uppercase; color: ${YEL}; background: #000; border: 6px double #fff; padding: 8px 12px; text-shadow: none; }
.th-command .moment.show .cap { animation: tell-cmd 99s steps(1) both; }
.th-command .moment.show::after { background: ${CYAN}; animation: flash-cmd .2s steps(1) forwards; }
@keyframes flash-cmd { 0% { opacity: .9; } 50% { opacity: .9; background: ${MAG}; } 100% { opacity: 0; } }
@media (max-width: 760px) {
  .pl.th-command { padding: 6px; gap: 6px; grid-template-rows: 38vh minmax(0, 1fr); }
  .th-command .side { gap: 6px; }
  .th-command .head { padding: 16px 10px 8px; }
  .th-command .log { padding: 10px; }
  .th-command .foot { padding: 14px 10px calc(10px + env(safe-area-inset-bottom)); }
  .th-command .meter-value { font-size: 16px; }
  .th-command .plaque { left: 12px; bottom: 12px; max-width: calc(100% - 24px); padding: 8px 10px 6px; }
  .th-command .plaque .role { display: none; }
  .th-command .moments { top: 20px; bottom: auto; right: 14px; }
}
`;

/* ------------------------------------------------------------------ */
/* Reduced motion: no drift, breathing, wobble or flicker; the        */
/* lines that fade in and out still fade, without moving.              */
/* ------------------------------------------------------------------ */
const CALM = `
@media (prefers-reduced-motion: reduce) {
  .pl .plate, .pl .fig, .pl .fig[class*="m-"], .pl .die.rolling, .pl .vignette, .pl .moment.show img, .pl .moment.show::after,
  .pl .status::after, .pl .npc .prose.waiting .dots { animation: none !important; }
  .pl .moment.show::after { opacity: 0; }
  .pl .tell.show { animation-name: calm-fade; }
  .pl .delta.show { animation-name: calm-fade; }
  .pl .moment.show .cap { animation: none; }
  .pl .bar .fill, .pl .plate-img, .pl .face, .pl .fact-card { transition: none; }
  @keyframes calm-fade { 0% { opacity: 0; } 8%, 80% { opacity: 1; } 100% { opacity: 0; } }
}
`;

/* Last, so it wins over each theme's log padding: room under the newest line, and (outside the pixel themes) a soft top edge. */
const LOG_EDGE = `
.pl[class*="th-"] .log { padding-bottom: 22px; scroll-padding-bottom: 22px; }
.pl[class*="th-"]:not(.th-onebit):not(.th-command) .log { padding-top: 18px; -webkit-mask-image: linear-gradient(transparent 0, #000 18px); mask-image: linear-gradient(transparent 0, #000 18px); }
`;

export const PARLEY_CSS = BASE + THEMED + STORYBOOK + ONEBIT + LOBBY + DIORAMA + TABLE + COMMAND + LOG_EDGE + CALM;
