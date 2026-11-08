/**
 * The Table's talk, staged in the scene's 3D room (`.pl.th-table.in-room`).
 *
 * The talk is a game across the table. The one you face sits behind its far
 * edge (seated by the room's own camera, scene/themes/table/duel.ts, so the
 * wood hides their lower half exactly where the 3D table does), with a folded
 * name card standing on the edge in front of them. What's at stake hangs on
 * the chalk slate on the right (the price in chalk, patience as a row of
 * candles that go out); what has been said is a parchment transcript pinned
 * on the left; what you know is a hand of fact cards held in your own hand,
 * bottom right; what you say is written on a slip on the mat and sealed with
 * red wax. Every control of the view stays a real button or field, only
 * dressed and moved.
 */
import { FELL, GARA, CINZ } from "../../style.js";

const R = ".pl.th-table.in-room";

export const ROOM_CSS = `
${R} { display: block; container-type: size; background: transparent; --edge: 62cqh; --tent: 66cqh; --figh: 96cqh; --sink: 30cqh; }
${R} .scene { position: absolute; inset: 0; overflow: visible; background: transparent; pointer-events: none; }
${R} .scene::after { content: none; }
${R} .scene > * { pointer-events: auto; }
${R} .scene > .figure { pointer-events: none; }

/* The one you face, seated behind the far edge: the wood hides them below it. */
${R} .figure { position: absolute; left: 0; right: 0; top: 0; bottom: auto; height: var(--edge); overflow: hidden; display: block; }
${R} .fig { position: absolute; left: 50%; bottom: calc(var(--sink) * -1); height: var(--figh); max-width: none; translate: -50% 0; }
${R} .face { filter: brightness(.86) sepia(.16) contrast(1.08) drop-shadow(0 0 1.5px #000) drop-shadow(0 0 2px #000); }
${R} .fig.framed { height: calc(var(--figh) * .78); margin: 0; background: none; }
${R} .fig.framed .face { border-radius: 48% 48% 4px 4px / 26% 26% 4px 4px; box-shadow: 0 0 0 .6cqh #0a0707, 0 0 0 1.1cqh #5a4232, 0 0 0 1.4cqh #0a0707, 0 3cqh 6cqh rgba(0,0,0,.8); }
${R} .fig.framed::after { border-radius: 48% 48% 4px 4px / 26% 26% 4px 4px; }
${R} .figure::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 26%; background: linear-gradient(rgba(5,3,6,0), rgba(5,3,6,.72)); pointer-events: none; }
${R} .silhouette { background: radial-gradient(60% 40% at 50% 22%, rgba(255,160,80,.16), rgba(10,7,8,.92) 70%); }

/* The folded name card on the edge in front of them. */
${R} .plaque { position: absolute; left: 50%; top: var(--tent); bottom: auto; translate: -50% -100%; z-index: 3; min-width: 0; width: max-content; max-width: 46cqw;
  padding: 1.1cqh 3.2cqh .9cqh; text-align: center; color: #0d0b0e; text-shadow: none; border-radius: 0;
  background: var(--paper) center / cover, #e2d6bd; transform: perspective(60cqh) rotateX(14deg); transform-origin: 50% 100%;
  box-shadow: inset 0 0 0 .45cqh #e2d6bd, inset 0 0 0 .7cqh #b81d24, 0 1.4cqh 1.6cqh rgba(0,0,0,.75); clip-path: polygon(1.5% 0, 98.5% 0, 100% 100%, 0 100%); }
${R} .plaque::before, ${R} .plaque::after { content: none; }
${R} .plaque .who { font: 800 3.3cqh/1.05 ${CINZ}; letter-spacing: .06em; text-transform: uppercase; }
${R} .plaque .role { display: block; font: 600 1.35cqh/1.3 ${GARA}; letter-spacing: .14em; text-transform: uppercase; color: #5a1a10; margin-top: .3cqh; text-shadow: none; }
${R} .tell { top: 3cqh; font: italic 400 2.4cqh/1.3 ${FELL}; color: #ffe8c0; text-shadow: 0 0 1cqh #000, 0 0 .3cqh #000; max-width: 38cqw; }
/* Moments: photographs dropped on the table at your left. */
${R} .moments { left: max(2cqw, calc(50cqw - 90cqh)); right: auto; top: auto; bottom: 4cqh; gap: 1.6cqh; }
${R} .moments { transform: perspective(70cqh) rotateX(22deg); transform-origin: 50% 100%; }
${R} .moments button { width: 11cqh; height: 13cqh; padding: 1cqh; border: 0; border-radius: 0; background: radial-gradient(circle at .9cqh .9cqh, #f2cf7a .35cqh, #6a4410 .5cqh, transparent .6cqh), radial-gradient(circle at calc(100% - .9cqh) .9cqh, #f2cf7a .35cqh, #6a4410 .5cqh, transparent .6cqh), #c8b89e; box-shadow: inset 0 0 0 .25cqh #6a5032, inset 0 0 1.4cqh rgba(60,36,12,.6), 0 1cqh 1.6cqh rgba(0,0,0,.8); rotate: -6deg; }
${R} .moments button:nth-child(even) { rotate: 5deg; translate: 0 -1cqh; }
${R} .moments button img { filter: sepia(.6) contrast(1.05) brightness(.9); box-shadow: inset 0 0 1cqh #000; }

/* The side panel dissolves: each of its parts is laid somewhere on or over the table. */
${R} .side, ${R} .foot { display: contents; }

/* What's at stake: the chalk slate hanging on the right. */
${R} .head { position: absolute; z-index: 4; right: 3cqw; top: 5cqh; width: min(25cqw, 46cqh); margin: 0; padding: 2.4cqh 2.4cqh 1.8cqh; border: 0; border-radius: 2px;
  background: var(--slate) center / cover, #16181b; color: #f2efe9; transform: rotate(1.4deg);
  box-shadow: 0 0 0 1.1cqh #4a2414, 0 0 0 1.3cqh #0a0505, 0 0 0 1.45cqh #9a6a3a, 0 0 0 1.65cqh #0a0505, 0 3cqh 5cqh rgba(0,0,0,.85), inset 0 0 3cqh rgba(0,0,0,.65); }
${R} .head::before { content: ""; position: absolute; left: 14%; right: 14%; bottom: calc(100% + 1.6cqh); height: 30cqh;
  background: repeating-linear-gradient(transparent 0 .5cqh, #3a3a42 .5cqh 1.6cqh, transparent 1.6cqh 2cqh) left / .6cqh 100% no-repeat, repeating-linear-gradient(transparent 0 .5cqh, #3a3a42 .5cqh 1.6cqh, transparent 1.6cqh 2cqh) right / .6cqh 100% no-repeat; }
${R}.tb-slate3d .head:not(:focus-within) { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; box-shadow: none; }
${R}.tb-slate3d .head:focus-within { top: auto; bottom: 30cqh; right: 3cqw; transform: none; }
${R} .head, ${R} .head button { text-shadow: 0 0 1px rgba(255,255,255,.6), 0 0 .8cqh rgba(255,255,255,.12); }
${R} .title-row { padding-right: 0; gap: 1cqh; }
${R} .kind { font: 600 1.55cqh/1.25 ${FELL}; letter-spacing: .04em; text-transform: none; color: rgba(242,239,233,.78); }
${R} .mode { border: 0; gap: .6cqh; }
${R} .mode button { font: 600 1.3cqh ${FELL}; padding: .2cqh .5cqh; color: rgba(242,239,233,.55); border-bottom: 2px solid transparent; background: none; }
${R} .mode button.on { color: #f2efe9; background: none; border-bottom-color: rgba(242,239,233,.85); }
${R} .meter { margin-top: 1.4cqh; }
${R} .meter-label { font: 600 1.6cqh ${FELL}; letter-spacing: .08em; text-transform: uppercase; color: rgba(242,239,233,.7); }
${R} .meter-value { font: 700 6.4cqh/1 ${FELL}; color: #f7f5ee; }
${R} .delta { font: 700 2cqh ${FELL}; }
${R} .delta.down { color: #b6f0a8; } ${R} .delta.up { color: #ff9a8a; }
/* The bar as a chalk line drawn along a ruler of tally marks. */
${R} .bar { height: 1.1cqh; border-radius: 0; background: repeating-linear-gradient(90deg, rgba(242,239,233,.45) 0 2px, transparent 2px 10%) bottom / 100% 45% no-repeat; overflow: visible; }
${R} .bar .fill { height: .5cqh; margin-top: .1cqh; border-radius: 2px; background: #f2efe9; box-shadow: 0 0 .5cqh rgba(255,255,255,.35); }
/* Patience: a row of candles; each one lost is snuffed. */
${R} .patience { gap: .9cqh; align-items: flex-end; }
${R} .pl-label { font: 600 1.4cqh ${FELL}; letter-spacing: .06em; text-transform: none; color: rgba(242,239,233,.7); align-self: center; }
${R} .pip { position: relative; width: 1.1cqh; height: 3.2cqh; border: 0; border-radius: .25cqh .25cqh .15cqh .15cqh; background: linear-gradient(90deg, #cfc2a6, #fff6e0 40%, #a89878); box-shadow: 0 .3cqh .4cqh rgba(0,0,0,.6); }
${R} .pip::after { content: ""; position: absolute; left: 50%; bottom: 100%; width: 1.5px; height: .6cqh; translate: -50% 0; background: #1a1010; }
${R} .pip.on { background: linear-gradient(90deg, #e8dcc4, #fffaf0 40%, #c8b48c); border: 0; box-shadow: 0 .3cqh .4cqh rgba(0,0,0,.6), 0 -1cqh 2cqh rgba(255,170,60,.45); }
${R} .pip.on::before { content: ""; position: absolute; left: 50%; bottom: calc(100% + .3cqh); width: 1.1cqh; height: 2cqh; translate: -50% 0; border-radius: 50% 50% 50% 50% / 62% 62% 38% 38%;
  background: radial-gradient(ellipse 40% 50% at 50% 72%, #fffbe0, #ffd27a 45%, #ff8a24 70%, rgba(255,110,20,0) 72%); animation: tbcandle 1.3s ease-in-out infinite alternate; transform-origin: 50% 100%; }
${R} .pip:not(.on) { height: 2.2cqh; background: linear-gradient(90deg, #8a8070, #b8ac94 40%, #6a6050); }
${R} .pip:not(.on)::before { content: ""; position: absolute; left: 50%; bottom: calc(100% + .4cqh); width: .5cqh; height: 1.8cqh; translate: -50% 0; background: radial-gradient(ellipse at 50% 100%, rgba(200,200,200,.35), transparent 70%); }
@keyframes tbcandle { 0% { scale: 1 1; } 40% { scale: .92 1.08; } 100% { scale: 1.05 .94; } }
${R} .journal-btn { margin-top: 1.4cqh; font: italic 600 1.6cqh ${FELL}; color: #f2efe9; text-decoration: underline wavy rgba(242,239,233,.5); text-underline-offset: .4cqh; }
${R} .journal { margin-top: 1cqh; padding: 1.4cqh 1.6cqh 1.4cqh 2.6cqh; font: 1.6cqh/1.3 ${FELL}; color: #1c120a; text-shadow: none; background: var(--paper) center / cover, #e2d6bd; border: 0; border-radius: 0; box-shadow: 0 1cqh 2cqh rgba(0,0,0,.7); }
${R} .journal li::marker { content: "♦  "; color: #b81d24; }
${R} .journal li.used { color: #7a6a4a; text-decoration: line-through rgba(122,12,16,.6); }

/* What has just been said: a dark plaque with brass corners on the left of the one you face (only the last
   exchange); the whole talk unrolls from it on demand. */
${R} .log { position: absolute; z-index: 3; left: max(2.5cqw, calc(50cqw - 88cqh)); top: 6cqh; width: min(29cqw, 54cqh); height: auto; max-height: min(calc(var(--edge) - 10cqh), 36cqh); margin: 0;
  padding: 2.6cqh 2.6cqh 2.2cqh 2.8cqh; transform: none; color: var(--p-ink); text-shadow: none;
  background: var(--corners) center / 100% 100% no-repeat, radial-gradient(120% 90% at 30% 0, rgba(70,40,24,.5), rgba(0,0,0,0) 60%), rgba(16,11,10,.985);
  box-shadow: inset 0 0 0 .25cqh rgba(216,160,64,.55), inset 0 0 3cqh rgba(0,0,0,.7), 0 2cqh 3cqh rgba(0,0,0,.85);
  --p-ink: #ece6d8; --p-dim: #b8a888; --p-faint: #8a7a60; --p-em: #f0c070; --p-soft: #d8c9a6; --p-edge: rgba(216,160,64,.4); --p-rule: rgba(216,160,64,.25);
  scrollbar-color: #8a6a3a transparent; }
${R} .log { -webkit-mask-image: none; mask-image: none; }
${R}:not(.tb-full) .log > :not(:nth-last-child(-n+3)) { display: none; }
${R}:not(.tb-full) .log > .setting:nth-last-child(-n+3) { display: none; }
${R}.tb-full .log { top: 4cqh; max-height: calc(100cqh - 30cqh); width: min(34cqw, 64cqh); z-index: 9; }
${R} .tb-tx { position: absolute; z-index: 10; left: calc(max(2.5cqw, calc(50cqw - 88cqh)) + min(29cqw, 54cqh) - 15cqh); top: 3.6cqh; width: 15cqh; padding: .7cqh 0 .6cqh;
  font: 800 1.25cqh ${CINZ}; letter-spacing: .1em; text-transform: uppercase; color: #1e1004; border: 0; cursor: pointer;
  background: linear-gradient(#ffe6a0, #c08a30 55%, #6a4410); box-shadow: 0 0 0 .2cqh #1a0e02, 0 .5cqh .8cqh rgba(0,0,0,.7); clip-path: polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%); }
${R}.tb-full .tb-tx { top: 1.6cqh; left: calc(max(2.5cqw, calc(50cqw - 88cqh)) + min(34cqw, 64cqh) - 15cqh); }
${R} .tb-tx:hover, ${R} .tb-tx:focus-visible { filter: brightness(1.2); }
${R} .setting { font: italic 1.75cqh/1.35 ${FELL}; color: #b8a888; }
${R} .speaker { font: 800 1.25cqh ${CINZ}; letter-spacing: .14em; color: #e8a060; }
${R} .npc .prose { font: 2.2cqh/1.4 ${FELL}; color: #ece6d8; }
${R} .npc .prose em { color: #f0c070; }
/* What you said: a card laid face up on the transcript. */
${R} .you { align-self: flex-end; max-width: 90%; color: #1c120a; background: var(--paper) center / cover, #f4ecd8; --p-ink: #1c120a; border: 0; border-radius: 3px; padding: 1cqh 1.4cqh;
  box-shadow: inset 0 0 0 .25cqh #f4ecd8, inset 0 0 0 .4cqh #b81d24, 0 .5cqh 1cqh rgba(60,30,10,.45); transform: rotate(.6deg); }
${R} .you .speaker { color: #b81d24; }
${R} .you .prose { font: 1.9cqh/1.35 ${FELL}; color: #1c120a; }
${R} .read { border-left: 2px solid rgba(216,160,64,.4); }
${R} .imm { font: italic 1.75cqh/1.35 ${FELL}; color: #e0c090; }
${R} .trn { color: #c8b898; }
${R} .result { font: 800 1.2cqh ${CINZ}; }
${R} .r-crit_success { color: #ffd27a; } ${R} .r-success { color: #9ad88a; } ${R} .r-partial { color: #d9c08a; } ${R} .r-fail { color: #a8a098; } ${R} .r-crit_fail { color: #ff7a64; }
${R} .die { width: 3.6cqh; height: 3.6cqh; font: 700 1.6cqh ${FELL}; }

/* What you know: fact cards held face up in your own hand, bottom right. */
${R} .tb-hb, ${R} .tb-hf, ${R} .hand { position: absolute; right: max(0px, calc(50cqw - 92cqh)); bottom: -3cqh; width: 60cqh; height: 60cqh; pointer-events: none; }
${R} .tb-hb { z-index: 5; } ${R} .hand { z-index: 6; } ${R} .tb-hf { z-index: 7; }
${R} .tb-hb svg, ${R} .tb-hf svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
${R}:has(.hand:empty) .tb-hb, ${R}:has(.hand:empty) .tb-hf { display: none; }
${R} .hand { display: block; padding: 0; overflow: visible; min-height: 0; background: none; }
${R} .fact-card { position: absolute; left: 30%; bottom: 26%; width: 36%; height: auto; min-height: 0; aspect-ratio: 200 / 294; margin: 0; padding: 8.8cqh 2cqh 1.2cqh 3.6cqh; z-index: 2; overflow: hidden;
  display: flex; flex-direction: column; justify-content: flex-start; align-items: flex-start;
  font: italic 1.6cqh/1.22 ${FELL}; color: #1c120a; text-align: left; text-wrap: pretty; border: 0; border-radius: 0; background: var(--fact) center / 100% 100% no-repeat; box-shadow: none;
  transform-origin: 50% 230%; transform: rotate(calc(var(--tilt, 0deg) * 2.1 - 6deg)); filter: drop-shadow(-.4cqh .8cqh .8cqh rgba(0,0,0,.6)); pointer-events: auto; transition: transform .18s ease, filter .18s; }
${R} .fact-card::before { content: "I know this"; position: absolute; left: 17%; top: 8%; font: 800 1.15cqh/1 ${CINZ}; letter-spacing: .1em; color: #7a0c10; text-transform: uppercase; }
${R} .fact-card:hover, ${R} .fact-card:focus-visible { z-index: 3; transform: rotate(calc(var(--tilt, 0deg) * 2.1 - 6deg)) translateY(-12%) scale(1.22); filter: drop-shadow(0 1.4cqh 1.6cqh rgba(0,0,0,.75)) drop-shadow(0 0 1cqh rgba(255,150,60,.5)); }
/* Played already: still face up, with a red PLAYED stamp. */
${R} .fact-card.used { z-index: 1; opacity: 1; color: #6a5a44; background: var(--fact) center / 100% 100% no-repeat; translate: 0 5%; filter: brightness(.74) drop-shadow(-.4cqh .8cqh .8cqh rgba(0,0,0,.6)); }
${R} .fact-card.used::after { content: "Played"; position: absolute; left: 7%; top: auto; bottom: 6%; padding: .25cqh .7cqh; rotate: -6deg; font: 800 1.5cqh/1 ${CINZ}; letter-spacing: .12em; text-transform: uppercase;
  color: rgba(156,20,25,.85); border: .35cqh solid rgba(156,20,25,.8); border-radius: .4cqh; mix-blend-mode: multiply; }

/* What you say: written on a slip lying on the mat, sealed with red wax. */
${R} .composer { position: absolute; z-index: 4; left: 50%; bottom: 4cqh; translate: -62% 0; width: min(42cqw, 78cqh); display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 1.6cqh;
  padding: 1.6cqh 1.6cqh 1.6cqh 2.6cqh; background: var(--paper) center / 100% 100%, #e2d6bd; transform: perspective(90cqh) rotateX(16deg) rotate(-.6deg); transform-origin: 50% 100%;
  box-shadow: inset 0 0 0 .3cqh #e2d6bd, inset 0 0 0 .45cqh rgba(42,24,4,.6), 0 1.6cqh 2.4cqh rgba(0,0,0,.85); }
${R} .composer textarea { background: transparent; border: 0; border-bottom: 1px dashed rgba(42,24,4,.45); border-radius: 0; box-shadow: none; padding: .4cqh .2cqh; color: #1c120a; font: 2.1cqh/1.3 ${FELL}; }
${R} .composer textarea::placeholder { color: #7a6a4a; font-style: italic; }
${R} .composer textarea:focus { border-bottom-color: #b81d24; }
${R} .say { width: 8cqh; height: 8cqh; padding: 0; border-radius: 50%; display: grid; place-items: center; font: 800 1.6cqh ${CINZ}; letter-spacing: .08em; color: #ffe6c8; text-shadow: 0 1px 1px #2a0406;
  background: radial-gradient(circle at 36% 30%, #e0464a, #9c1419 55%, #4a0508); box-shadow: 0 0 0 .3cqh #5a0a0d, inset 0 0 0 .9cqh rgba(0,0,0,.18), 0 .6cqh 1cqh rgba(0,0,0,.6); clip-path: polygon(50% 0, 62% 4%, 74% 3%, 82% 12%, 94% 18%, 96% 32%, 100% 46%, 96% 60%, 98% 74%, 88% 84%, 80% 96%, 64% 96%, 50% 100%, 36% 97%, 22% 96%, 14% 86%, 3% 76%, 4% 60%, 0 46%, 5% 32%, 6% 18%, 18% 12%, 26% 3%, 38% 4%); }
${R} .say:hover:not(:disabled) { filter: brightness(1.15); }
/* The deal and walking away: paper tabs pinned beside the slip. */
${R} .actions { position: absolute; z-index: 4; left: 50%; bottom: calc(4cqh + 12.5cqh); translate: -62% 0; width: min(42cqw, 78cqh); display: flex; gap: 1.4cqh; transform: perspective(90cqh) rotateX(16deg); transform-origin: 50% 100%; }
${R} .actions button { position: relative; padding: 1cqh 2.2cqh .9cqh 5.6cqh; border: 0; border-radius: .6cqh; font: 800 1.5cqh ${CINZ}; letter-spacing: .08em; text-transform: uppercase; color: #1e1004;
  background: linear-gradient(#ffe6a0, #d8a040 45%, #7a4a10); box-shadow: inset 0 0 0 .2cqh #1a0e02, inset 0 .3cqh 0 rgba(255,255,255,.45), 0 .7cqh 1.2cqh rgba(0,0,0,.7); text-shadow: 0 1px 0 rgba(255,240,200,.6); }
${R} .actions .deal::before { content: ""; position: absolute; left: 1.4cqh; top: 50%; translate: 0 -50%; width: 3.2cqh; height: 3.2cqh; background: var(--bell) center / contain no-repeat; }
${R} .actions .walk { padding-left: 2.4cqh; color: #ffe6c8; text-shadow: 0 1px 1px #2a0406; background: radial-gradient(circle at 35% 30%, #c8282c, #8a1016 55%, #4a0508); box-shadow: inset 0 0 0 .2cqh #2a0406, inset 0 0 0 .5cqh rgba(242,207,122,.35), 0 .7cqh 1.2cqh rgba(0,0,0,.7); border-radius: 0; clip-path: polygon(1.2cqh 0, calc(100% - 1.2cqh) 0, 100% 50%, calc(100% - 1.2cqh) 100%, 1.2cqh 100%, 0 50%); padding-left: 2.8cqh; padding-right: 2.8cqh; }
${R} .actions button:hover { filter: brightness(1.12); color: inherit; }
${R} .status { position: absolute; z-index: 4; left: 50%; bottom: calc(4cqh + 19cqh); translate: -62% 0; width: min(42cqw, 78cqh); font: italic 1.8cqh ${FELL}; color: #ffe8c0; text-shadow: 0 0 .8cqh #000, 0 0 .3cqh #000; }
/* The note about where your words go: kept for screen readers, out of the room. */
${R} .hint { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
${R} .end.show { position: absolute; z-index: 8; left: 50%; top: calc(var(--edge) + 3cqh); translate: -50% 0; width: min(40cqw, 70cqh); padding: 2.6cqh 3cqh; color: #1c120a;
  background: var(--paper) center / 100% 100%, #e2d6bd; box-shadow: inset 0 0 0 .4cqh #e2d6bd, inset 0 0 0 .6cqh #b81d24, 0 2cqh 3cqh rgba(0,0,0,.85); }
${R} .end-title { font: 800 3.4cqh ${CINZ}; color: #7a0c10; }
${R} .end-sub, ${R} .reveals { color: #3a2a1a; font: 1.8cqh/1.35 ${FELL}; }
${R} .leave { font: 800 1.5cqh ${CINZ}; color: #ffe6c8; background: #8a1016; border: 0; border-radius: 0; padding: .9cqh 2.4cqh; box-shadow: inset 0 0 0 .4cqh #f2cf7a; }

/* A phone: the face up top, the transcript under the edge, your cards in a row, the slip at the bottom. */
@container (aspect-ratio < 1.15) {
  ${R} .head { left: 2.5cqw; right: 2.5cqw; top: 1.2cqh; width: auto; padding: 1cqh 1.6cqh; transform: none; display: grid; grid-template-columns: 1fr auto; gap: 0 1.6cqh; align-items: center;
    box-shadow: 0 0 0 .6cqh #4a2414, 0 0 0 .75cqh #0a0505, 0 1.6cqh 3cqh rgba(0,0,0,.8); }
  ${R} .head::before { content: none; }
  ${R} .title-row { grid-column: 1 / -1; }
  ${R} .kind { font-size: 1.45cqh; }
  ${R} .meter { grid-column: 1 / -1; margin-top: .4cqh; }
  ${R} .meter-value { font-size: 3.4cqh; }
  ${R} .pip { height: 2.2cqh; width: .9cqh; }
  ${R} .pip:not(.on) { height: 1.5cqh; }
  ${R} .pip.on::before { height: 1.5cqh; width: .9cqh; }
  ${R} .journal-btn { margin-top: .4cqh; font-size: 1.45cqh; }
  ${R} .tell { top: 13cqh; max-width: 90cqw; font-size: 1.9cqh; }
  ${R} .plaque { max-width: 80cqw; padding: .6cqh 2cqh .5cqh; }
  ${R} .plaque .who { font-size: 2.3cqh; }
  ${R} .plaque .role { display: none; }
  ${R} .log { left: 3cqw; right: 3cqw; width: auto; top: calc(var(--tent) + 1.2cqh); max-height: calc(100cqh - var(--tent) - 34cqh); transform: none; padding: 3.4cqh 2cqh 1.4cqh 2.2cqh; }
  ${R}.tb-full .log { top: 9cqh; width: auto; max-height: calc(100cqh - 36cqh); }
  ${R} .tb-tx { left: auto; right: 5cqw; top: calc(var(--tent) + 1.2cqh); width: 13cqh; font-size: 1.1cqh; }
  ${R}:not(.tb-full) .log > :not(:last-child) { display: none; }
  ${R} .log { padding-top: 3.4cqh; }
  ${R}.tb-full .tb-tx { top: 7cqh; left: auto; right: 3cqw; }
  ${R} .title-row, ${R} .journal-btn { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  ${R} .head { padding: .8cqh 1.6cqh; }
  ${R} .meter { margin-top: 0; }
  ${R} .npc .prose { font-size: 1.85cqh; }
  ${R} .you .prose { font-size: 1.75cqh; }
  ${R} .tb-hb, ${R} .tb-hf { display: none; }
  ${R} .hand { left: 0; right: 0; width: auto; bottom: 14cqh; height: 17cqh; display: flex; justify-content: center; }
  ${R} .fact-card { position: relative; left: auto; bottom: auto; width: 25cqw; margin: 0 -.6cqw; padding: 8.4cqw 1.6cqw .8cqw 3.6cqw; font-size: 1.2cqh; transform: rotate(var(--tilt, 0deg)); transform-origin: 50% 100%; }
  ${R} .fact-card::before { font-size: .9cqh; }
  ${R} .fact-card.used::after { font-size: 1.5cqh; }
  ${R} .fact-card:hover, ${R} .fact-card:focus-visible { transform: translateY(-30%) scale(1.5); }
  ${R} .composer { left: 3cqw; right: 3cqw; translate: none; width: auto; bottom: 5cqh; padding: 1cqh 1cqh 1cqh 1.8cqh; gap: 1cqh; transform: none; }
  ${R} .composer textarea { font-size: 1.8cqh; }
  ${R} .say { width: 6.2cqh; height: 6.2cqh; font-size: 1.3cqh; }
  ${R} .actions { left: 3cqw; right: 3cqw; translate: none; width: auto; bottom: .8cqh; justify-content: center; }
  ${R} .actions { transform: none; }
  ${R} .actions button { padding: .6cqh 1.6cqh; font-size: 1.25cqh; }
  ${R} .actions .deal { padding-left: 4.4cqh; }
  ${R} .actions .deal::before { left: 1.1cqh; width: 2.4cqh; height: 2.4cqh; }
  ${R} .status, ${R} .hint { display: none; }
  ${R} .moments { bottom: auto; top: 2.2cqh; left: 36cqw; flex-direction: row; gap: .8cqh; z-index: 6; transform: none; }
  ${R} .moments button { width: 4.4cqh; height: 5cqh; padding: .4cqh; rotate: 0deg; translate: none; }
  ${R} .moments button:nth-child(even) { rotate: 0deg; translate: none; }
  ${R} .end.show { top: 20cqh; width: 90cqw; }
}
@media (prefers-reduced-motion: reduce) { ${R} .pip.on::before { animation: none; } ${R} .fact-card { transition: none; } }
`;
