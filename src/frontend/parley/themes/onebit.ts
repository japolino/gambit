/**
 * The 1-bit theme's Parley: the talk in the scene's crawler console. ./onebit/console.ts paints the desktop,
 * the window chrome, the viewport picture and the WHAT NOW? prompt into one frame buffer behind the view and
 * lays the view's windows out on its grid; this sheet (scoped under `.pl.th-onebit`) sets their contents in the
 * bitmap face at whole multiples of its cell (`--u` is one virtual pixel), ink and paper only, no greys.
 * See ./types.ts for what a Parley theme may provide.
 */
import type { ParleyTheme } from "./types.js";
import { svg, BIT } from "../style.js";
import { decorateParley } from "./onebit/console.js";

const INK = "#080707";
const PAPER = "#f0eee6";
const U = "var(--u, 2px)";
const px = (n: number) => `calc(${U} * ${n})`;
/** A pixel diamond, full and hollow (the other side's patience), drawn on its own 7x7 grid. */
const DIA_FULL = ["...#...", "..###..", ".#####.", "#######", ".#####.", "..###..", "...#..."];
const DIA_EMPTY = ["...#...", "..#.#..", ".#...#.", "#.....#", ".#...#.", "..#.#..", "...#..."];
const heart = (full: boolean) => svg(`width='7' height='7' viewBox='0 0 7 7' shape-rendering='crispEdges'>${(full ? DIA_FULL : DIA_EMPTY)
  .flatMap((row, y) => [...row].map((c, x) => (c === "#" ? `<rect x='${x}' y='${y}' width='1' height='1' fill='${PAPER}'/>` : ""))).join("")}`);

const ONEBIT = `
.pl.th-onebit { --p-ink: ${PAPER}; --p-dim: ${PAPER}; --p-faint: ${PAPER}; --p-soft: ${PAPER}; --p-em: ${PAPER}; --p-accent: ${PAPER}; --p-accent-ink: ${INK};
  --p-hot: ${PAPER}; --p-edge: ${PAPER}; --p-rule: ${PAPER}; --p-scene: transparent; --p-panel: transparent; --p-panel-shadow: none; --p-well: ${INK};
  --p-radius: 0; --p-pill: 0; --p-text-shadow: none;
  display: block; background: ${INK}; color: ${PAPER}; font: ${px(8)}/${px(10)} ${BIT}; -webkit-font-smoothing: none; font-smooth: never; letter-spacing: 0; }
.th-onebit *, .th-onebit *::before, .th-onebit *::after { text-shadow: none !important; box-shadow: none; border-radius: 0 !important; }
.th-onebit .ob-cv { position: absolute; left: 0; top: 0; z-index: 0; image-rendering: pixelated; image-rendering: crisp-edges; pointer-events: none; }
.th-onebit .side { display: contents; }
.th-onebit .scene, .th-onebit .head, .th-onebit .log, .th-onebit .foot, .th-onebit .ob-keys, .th-onebit .ob-jwin {
  position: absolute; z-index: 1; margin: 0; padding: 0; border: 0; background: transparent; box-shadow: none; min-width: 0; }
.th-onebit button, .th-onebit textarea { font: ${px(8)}/${px(10)} ${BIT}; letter-spacing: 0; color: ${PAPER}; }
.th-onebit :focus-visible { outline: ${px(1)} solid ${PAPER}; outline-offset: ${px(1)}; }

/* VIEW: the picture is painted into the console; the view keeps its elements for screen readers and moments. */
.th-onebit .scene { overflow: hidden; background: transparent; }
.th-onebit .plate, .th-onebit .vignette, .th-onebit .figure, .th-onebit .plaque { opacity: 0 !important; pointer-events: none; animation: none; }
.th-onebit .tell { left: ${px(2)}; top: ${px(2)}; translate: none; max-width: calc(100% - ${px(4)}); text-align: left; font: ${px(8)}/${px(10)} ${BIT};
  font-style: normal; color: ${PAPER}; background: ${INK}; padding: ${px(1)} ${px(2)}; }
.th-onebit .tell.show { animation: ob-tell 6s steps(1) forwards; }
@keyframes ob-tell { 0% { opacity: 0; } 4%, 82% { opacity: 1; } 100% { opacity: 0; } }
.th-onebit .moments { right: calc(${px(3)} + 6%); top: ${px(5)}; bottom: auto; gap: ${px(6)}; }
.th-onebit .moments button:not(:last-child) { display: none; }
.th-onebit .moments button { position: relative; width: ${px(72)}; height: ${px(48)}; border: ${px(1)} solid ${PAPER}; outline: ${px(1)} solid ${INK}; box-shadow: 0 0 0 ${px(2)} ${PAPER} !important; background: ${INK}; }
.th-onebit .moments button::after { content: "MOMENT ►"; position: absolute; left: 0; right: 0; bottom: 0; padding: ${px(1)} ${px(2)} 0; background: ${INK}; color: ${PAPER}; font: ${px(8)}/${px(9)} ${BIT}; text-align: left; white-space: nowrap; overflow: hidden; }
.th-onebit .moments img, .th-onebit .moment img { filter: url(#pl-mono); image-rendering: pixelated; }
.th-onebit .moment { background: ${INK}; transition: opacity .3s steps(3); }
.th-onebit .moment.show img { animation: none; }
.th-onebit .moment::before { background: linear-gradient(transparent 0 76%, ${INK} 76%); }
.th-onebit .moment .cap { font: ${px(8)}/${px(10)} ${BIT}; font-style: normal; color: ${PAPER}; left: ${px(4)}; right: ${px(4)}; bottom: ${px(4)}; }
.th-onebit .moment.show .cap { animation: ob-tell 99s steps(1) both; }
.th-onebit .moment.show::after { animation: ob-flash .24s steps(1) forwards; }
@keyframes ob-flash { 0% { opacity: 1; background: ${PAPER}; } 50% { opacity: 1; background: ${INK}; } 100% { opacity: 0; } }

/* TERMS: what is at stake, as big as the scene's DAY readout; patience as hearts. */
.th-onebit .head { display: flex; flex-direction: column; gap: ${px(2)}; overflow: hidden; padding: ${px(1)} ${px(1)} 0; box-sizing: border-box; }
.th-onebit .title-row { display: none; }
.th-onebit .kind { display: block; -webkit-line-clamp: unset; white-space: nowrap; overflow: hidden; text-overflow: clip; font: ${px(8)}/${px(9)} ${BIT}; text-transform: uppercase; letter-spacing: 0; color: ${PAPER}; }
.th-onebit .meter { margin: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: ${px(2)} ${px(4)}; align-items: center; }
.th-onebit .meter-label { display: block; grid-column: 1; grid-row: 1; font: ${px(8)}/${px(9)} ${BIT}; text-transform: uppercase; letter-spacing: 0; color: ${PAPER}; }
.th-onebit .meter-value { grid-column: 1 / -1; grid-row: 2; font: ${px(16)}/${px(16)} ${BIT}; text-transform: uppercase; gap: ${px(4)}; white-space: nowrap; overflow: hidden; }
.th-onebit .delta { font: ${px(8)}/${px(10)} ${BIT}; background: ${PAPER}; color: ${INK}; padding: 0 ${px(1)}; align-self: center; }
.th-onebit .delta.show { animation: ob-delta 2.4s steps(1) forwards; }
@keyframes ob-delta { 0% { opacity: 0; } 6%, 82% { opacity: 1; } 100% { opacity: 0; } }
.th-onebit .bar { position: relative; overflow: visible; border-radius: 0; grid-column: 1 / -1; grid-row: 3; height: ${px(7)}; box-sizing: border-box; padding: ${px(1)}; background: ${INK}; outline: ${px(1)} solid ${PAPER}; outline-offset: 0; margin: 0 ${px(1)} 0 ${px(36)}; }
.th-onebit .bar::before { content: "DEAL"; position: absolute; left: ${px(-36)}; top: 50%; transform: translateY(-50%); font: ${px(8)}/${px(9)} ${BIT}; color: ${PAPER}; }
.th-onebit .bar .fill { background: repeating-linear-gradient(90deg, ${PAPER} 0 ${px(2)}, transparent ${px(2)} ${px(3)}); transition: width 1s steps(10); }
.th-onebit .patience { grid-column: 2; grid-row: 1; gap: ${px(1)}; align-self: center; display: flex; align-items: center; }
.th-onebit .patience .pl-label { display: inline; font: ${px(8)}/${px(9)} ${BIT}; text-transform: uppercase; letter-spacing: 0; color: ${PAPER}; margin: 0 ${px(3)} 0 0; }
.th-onebit .pip { width: ${px(7)}; height: ${px(7)}; border: 0; margin-right: ${px(1)}; background: ${heart(false)} 0 0 / 100% 100% no-repeat; image-rendering: pixelated; }
.th-onebit .pip.on { background: ${heart(true)} 0 0 / 100% 100% no-repeat; }

/* The function-key strip: F1 what you know, F2 the reading mode. */
.th-onebit .ob-keys { display: flex; align-items: stretch; gap: ${px(6)}; }
.th-onebit .journal-btn, .th-onebit .mode { margin: 0; border: 0; padding: 0; display: flex; align-items: stretch; background: ${PAPER}; color: ${INK}; cursor: pointer; }
.th-onebit .journal-btn { font: ${px(8)}/${px(9)} ${BIT}; text-transform: uppercase; padding: 0 ${px(3)} 0 0; }
.th-onebit .journal-btn::before { content: "F1"; background: ${INK}; color: ${PAPER}; padding: 0 ${px(2)}; margin-right: ${px(3)}; }
.th-onebit .journal-btn:hover, .th-onebit .journal-btn:focus-visible { background: ${INK}; color: ${PAPER}; outline: ${px(1)} solid ${PAPER}; outline-offset: -${px(1)}; }
.th-onebit .mode { gap: 0; background: ${INK}; border: 0; }
.th-onebit .mode::before { content: "F2"; background: ${INK}; color: ${PAPER}; padding: 0 ${px(2)}; font: ${px(8)}/${px(9)} ${BIT}; }
.th-onebit .mode button { font: ${px(8)}/${px(9)} ${BIT}; text-transform: uppercase; padding: 0 ${px(3)}; background: ${INK}; color: ${PAPER}; border: 0; }
.th-onebit .mode button.on { background: ${PAPER}; color: ${INK}; }

/* What you know: a window over the chronicle. */
.th-onebit .ob-jwin { display: none; z-index: 3; }
.th-onebit .ob-jwin.open { display: block; }
/* Whole lines only: the list's height is a whole number of 10-pixel lines (set by the console). */
.th-onebit .ob-jwin .journal { height: var(--ob-jh, 100%); }
.th-onebit .journal { display: none; margin: 0; padding: ${px(2)} ${px(2)} ${px(2)} ${px(2)}; border: 0; background: ${INK}; height: 100%; box-sizing: border-box; overflow-y: auto; list-style: none; font: ${px(8)}/${px(10)} ${BIT}; scrollbar-color: ${PAPER} ${INK}; }
.th-onebit .journal.open { display: block; }
.th-onebit .journal li { margin: 0; padding: 0; }
.th-onebit .journal li::before { content: "> "; }
.th-onebit .journal li.used::before { content: "✓ "; }
.th-onebit .journal li.used { text-decoration: none; }
.th-onebit .journal li.empty::before { content: ""; }

/* CHRONICLE: the conversation, as the scene prints its log. */
.th-onebit .log { overflow-y: auto; padding: ${px(2)} ${px(2)} ${px(6)} !important; box-sizing: border-box; display: flex; flex-direction: column; gap: ${px(5)}; margin: 0;
  scrollbar-width: thin; scrollbar-color: ${PAPER} ${INK}; scroll-behavior: auto; }
.th-onebit .setting { font: ${px(8)}/${px(10)} ${BIT}; font-style: normal; border: 0; padding: 0 0 ${px(3)}; border-bottom: ${px(1)} dashed ${PAPER}; color: ${PAPER}; }
.th-onebit .speaker { font: ${px(8)}/${px(9)} ${BIT}; text-transform: uppercase; letter-spacing: 0; color: ${INK}; background: ${PAPER}; display: inline-block; padding: 0 ${px(2)}; margin-bottom: ${px(2)}; }
.th-onebit .npc .speaker::before { content: "1 "; }
.th-onebit .prose, .th-onebit .npc .prose { font: ${px(8)}/${px(10)} ${BIT}; color: ${PAPER}; }
.th-onebit .prose p { margin: 0 0 ${px(3)}; }
/* Two colours tell no speakers apart: speech stays plain. Italic is underlined and bold set in reverse, as in the scene. */
.th-onebit .prose em { font-style: normal; text-decoration: underline; text-decoration-thickness: ${px(1)}; text-underline-offset: ${px(1)}; }
.th-onebit .prose strong { font-weight: 400; color: ${INK}; background: ${PAPER}; }
.th-onebit .you { border: 0; background: none; padding: 0; margin: 0; }
.th-onebit .you .speaker { display: none; }
.th-onebit .you .prose::before { content: "> "; }
.th-onebit .read { border: 0; padding: 0 0 0 ${px(4)}; margin: 0; gap: ${px(3)}; }
.th-onebit .tray { gap: ${px(2)}; }
.th-onebit .die { width: auto; min-width: ${px(18)}; height: ${px(11)}; padding: 0 ${px(2)}; clip-path: none; font: ${px(8)}/${px(11)} ${BIT}; background: ${INK}; color: ${PAPER}; outline: ${px(1)} solid ${PAPER}; transition: none; transform: none; }
.th-onebit .die.rolling { animation: ob-roll .2s steps(1) infinite; }
@keyframes ob-roll { 0% { background: ${INK}; color: ${PAPER}; } 50% { background: ${PAPER}; color: ${INK}; } }
.th-onebit .die.kept, .th-onebit .die.nat20 { background: ${PAPER}; color: ${INK}; transform: none; }
.th-onebit .die.dropped { opacity: 1; outline-style: dashed; }
.th-onebit .die.nat1 { background: ${INK}; color: ${PAPER}; outline-style: double; outline-width: ${px(3)}; }
.th-onebit .result { font: ${px(8)}/${px(11)} ${BIT}; letter-spacing: 0; color: ${PAPER}; transform: none; transition: opacity .3s steps(2); }
.th-onebit .result.r-crit_success { background: ${PAPER}; color: ${INK}; padding: 0 ${px(2)}; }
.th-onebit .result.r-crit_fail::before { content: "!! "; }
.th-onebit .imm, .th-onebit .trn, .th-onebit .roll, .th-onebit .why pre { font: ${px(8)}/${px(10)} ${BIT}; font-style: normal; color: ${PAPER}; }
.th-onebit .tier { font: ${px(8)}/${px(9)} ${BIT}; text-transform: uppercase; padding: 0 ${px(2)}; border: 0; outline: ${px(1)} solid ${PAPER}; color: ${PAPER}; }
.th-onebit .tier.t4 { background: ${PAPER}; color: ${INK}; }
.th-onebit .why summary { font: ${px(8)}/${px(10)} ${BIT}; text-transform: uppercase; list-style: none; color: ${PAPER}; }
.th-onebit .why summary::before { content: "[+] "; } .th-onebit .why[open] summary::before { content: "[-] "; }
.th-onebit .dots { animation: ob-blink 1s steps(1) infinite; }

/* A scrolled list's cut-off line is hidden whole by the console (an inline mask to the line's edge); the arrows sit in its title bar. */

/* COMMAND: under the painted WHAT NOW?, the line you type, then the deal as a numbered list. */
.th-onebit .foot { display: flex; flex-direction: column; gap: ${px(4)}; overflow-y: auto; box-sizing: border-box; padding: 0 ${px(1)} ${px(2)}; }
.th-onebit .status { font: ${px(8)}/${px(10)} ${BIT}; font-style: normal; color: ${PAPER}; min-height: 0; }
.th-onebit .status:empty { display: none; }
.th-onebit .status:not(:empty)::after { content: ""; display: inline-block; width: ${px(5)}; height: ${px(8)}; margin-left: ${px(2)}; background: ${PAPER}; vertical-align: top; animation: ob-blink 1s steps(1) infinite; }
@keyframes ob-blink { 50% { opacity: 0; } }
.th-onebit .composer { position: relative; display: block; }
.th-onebit .composer::before { content: ">"; position: absolute; left: ${px(2)}; top: ${px(2)}; font: ${px(8)}/${px(10)} ${BIT}; pointer-events: none; }
.th-onebit .composer textarea { background: ${INK}; border: 0; outline: ${px(1)} solid ${PAPER}; outline-offset: 0; padding: ${px(2)} ${px(2)} ${px(2)} ${px(11)}; caret-color: ${PAPER}; color: ${PAPER}; resize: none; min-height: ${px(34)}; width: 100%; box-sizing: border-box; padding-bottom: ${px(12)}; }
.th-onebit .composer textarea::placeholder { color: ${PAPER}; opacity: 1; }
.th-onebit .composer textarea:focus { outline-width: ${px(2)}; }
.th-onebit .say { position: absolute; right: ${px(1)}; bottom: ${px(1)}; height: ${px(10)}; margin: 0; background: ${PAPER}; color: ${INK}; border: 0; padding: 0 ${px(2)}; text-transform: uppercase; cursor: pointer; }
.th-onebit .say::after { content: " ↵"; }
.th-onebit .say:hover:not(:disabled), .th-onebit .say:focus-visible { background: ${INK}; color: ${PAPER}; outline: ${px(1)} solid ${PAPER}; outline-offset: -${px(1)}; }
.th-onebit .say:disabled, .th-onebit .deal:disabled { opacity: 1; cursor: default; }
.th-onebit .say:disabled { background: ${INK}; color: ${PAPER}; outline: ${px(1)} dashed ${PAPER}; outline-offset: -${px(1)}; }
.th-onebit .actions { display: flex; flex-direction: column; gap: ${px(1)}; counter-reset: ob-act; }
.th-onebit .actions button, .th-onebit .leave { counter-increment: ob-act; display: block; width: 100%; text-align: left; text-transform: uppercase; background: ${INK}; color: ${PAPER};
  border: 0; padding: ${px(1)} ${px(1)} ${px(1)} ${px(33)}; text-indent: ${px(-32)}; cursor: pointer; }
.th-onebit .actions button::before { content: "  " counter(ob-act) " "; white-space: pre; }
.th-onebit .leave::before { content: "  ↵ "; white-space: pre; }
.th-onebit .actions button:hover:not(:disabled), .th-onebit .actions button:focus-visible, .th-onebit .leave:hover, .th-onebit .leave:focus-visible { background: ${PAPER}; color: ${INK}; outline: 0; }
.th-onebit .actions button:hover:not(:disabled)::before, .th-onebit .actions button:focus-visible::before { content: "► " counter(ob-act) " "; }
.th-onebit .leave:hover::before, .th-onebit .leave:focus-visible::before { content: "► ↵ "; }
.th-onebit .actions button:disabled::before { content: "  × "; }
.th-onebit .hint { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.th-onebit .end { padding: 0; }
.th-onebit .end.show { justify-items: stretch; gap: ${px(3)}; text-align: left; }
.th-onebit .end-title { font: ${px(16)}/${px(16)} ${BIT}; text-transform: uppercase; color: ${PAPER}; }
.th-onebit .end-sub, .th-onebit .reveals { font: ${px(8)}/${px(10)} ${BIT}; color: ${PAPER}; }
.th-onebit .reveals { list-style: none; padding: 0; }
.th-onebit .reveals li::before { content: "+ "; }
.pl.th-onebit.ob-tall .moments { right: ${px(2)}; top: ${px(2)}; gap: ${px(3)}; }
.pl.th-onebit.ob-tall .moments button { width: ${px(68)}; height: ${px(30)}; }
.pl.th-onebit.ob-tall .kind { display: none; }
.pl.th-onebit.ob-tall .meter { grid-template-columns: minmax(0, 1fr); }
.pl.th-onebit.ob-tall .patience { grid-column: 1; grid-row: auto; }
.pl.th-onebit.ob-tall .ob-keys { gap: ${px(3)}; }
.pl.th-onebit.ob-tall .journal-btn, .pl.th-onebit.ob-tall .mode button { font-size: 0; }
.pl.th-onebit.ob-tall .journal-btn::after { content: "FACTS"; font-size: ${px(8)}; }
.pl.th-onebit.ob-tall .journal-btn::before, .pl.th-onebit.ob-tall .mode::before { content: none; }
.pl.th-onebit.ob-tall .journal-btn { padding: 0 ${px(3)}; }
.pl.th-onebit.ob-tall .mode button:first-child::after { content: "STORY"; font-size: ${px(8)}; }
.pl.th-onebit.ob-tall .mode button:last-child::after { content: "DICE"; font-size: ${px(8)}; }

/* The phone (.pl-phone; rects from ./onebit/console.ts phoneSize): the log is the screen. One bar, the talk, the input
   and the deal; the rest behind MORE. Text is the 16px face set half a pixel tighter: a few more words a line, and the letters still don't touch. */
.pl.th-onebit.pl-phone .log, .pl.th-onebit.pl-phone .journal, .pl.th-onebit.pl-phone .composer textarea, .pl.th-onebit.pl-phone .end-sub, .pl.th-onebit.pl-phone .reveals, .pl.th-onebit.pl-phone .status { letter-spacing: calc(${U} * -0.5); }
.pl.th-onebit.pl-phone .ob-keys { display: contents; }
.pl.th-onebit.pl-phone .tell { display: none; }
.pl.th-onebit.pl-phone .log { padding: ${px(2)} ${px(3)} ${px(8)} !important; gap: ${px(5)}; scrollbar-width: none; }
.pl.th-onebit.pl-phone .log::-webkit-scrollbar { display: none; }
.pl.th-onebit.pl-phone.ob-more .log { visibility: hidden; }
.pl.th-onebit.pl-phone .you { align-self: stretch; max-width: none; margin: 0; }
.pl.th-onebit.pl-phone .scene { z-index: 2; }
.pl.th-onebit.pl-phone.ob-playing .scene { z-index: 6; }
/* The bar: who (painted), the stake, patience and how the deal stands. */
.pl.th-onebit.pl-phone .head { gap: 0; padding: 0; overflow: hidden; }
.pl.th-onebit.pl-phone .meter { grid-template-columns: auto minmax(0, 1fr) auto; gap: ${px(2)} ${px(3)}; align-items: center; }
.pl.th-onebit.pl-phone .meter-label { grid-column: 1; grid-row: 1; font: ${px(8)}/${px(10)} ${BIT}; }
.pl.th-onebit.pl-phone .meter-value { grid-column: 2 / -1; grid-row: 1; font: ${px(8)}/${px(10)} ${BIT}; gap: ${px(3)}; margin-right: ${px(39)}; }
.pl.th-onebit.pl-phone .bar { grid-column: 1 / 3; grid-row: 2; height: ${px(6)}; margin: 0; padding: ${px(1)}; }
.pl.th-onebit.pl-phone .bar::before { content: none; }
.pl.th-onebit.pl-phone .patience { grid-column: 3; grid-row: 2; }
.pl.th-onebit.pl-phone .patience .pl-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.pl.th-onebit.pl-phone .journal-btn { position: absolute; z-index: 2; padding: 0; overflow: hidden; white-space: nowrap; color: transparent; background: ${PAPER}; touch-action: manipulation; }
.pl.th-onebit.pl-phone .journal-btn::before { content: none; }
.pl.th-onebit.pl-phone .journal-btn::after { content: "MORE"; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: ${PAPER}; color: ${INK}; font: ${px(8)}/${px(10)} ${BIT}; }
.pl.th-onebit.pl-phone.ob-more .journal-btn::after { content: "BACK"; }
/* The sheet behind MORE. */
.pl.th-onebit.pl-phone .ob-jwin .journal { height: 100%; padding: ${px(1)} ${px(3)} ${px(4)} ${px(1)}; scrollbar-width: none; touch-action: pan-y; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
.pl.th-onebit.pl-phone .ob-jwin .journal::-webkit-scrollbar { display: none; }
.pl.th-onebit.pl-phone .journal li { margin: 0 0 ${px(4)}; padding-left: ${px(10)}; text-indent: ${px(-10)}; }
.pl.th-onebit.pl-phone .mode { position: absolute; z-index: 2; display: flex; gap: ${px(1)}; border: 0; background: ${INK}; }
.pl.th-onebit.pl-phone:not(.ob-more) .mode { display: none; }
.pl.th-onebit.pl-phone .mode::before { content: none; }
.pl.th-onebit.pl-phone .mode button { position: relative; flex: 1 1 0; padding: 0; overflow: hidden; white-space: nowrap; color: transparent; border: ${px(1)} solid ${PAPER}; touch-action: manipulation; }
.pl.th-onebit.pl-phone .mode button::after { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: ${INK}; color: ${PAPER}; font: ${px(8)}/${px(10)} ${BIT}; }
.pl.th-onebit.pl-phone .mode button.on::after { background: ${PAPER}; color: ${INK}; }
.pl.th-onebit.pl-phone .mode button:first-child::after { content: "STORY"; }
.pl.th-onebit.pl-phone .mode button:last-child::after { content: "DICE"; }
.pl.th-onebit.pl-phone .moments { right: ${px(2)}; top: ${px(2)}; gap: ${px(3)}; }
.pl.th-onebit.pl-phone .moments button { width: ${px(68)}; height: ${px(30)}; }
/* The line you type, Say beside it; the deal under them, two big buttons. */
.pl.th-onebit.pl-phone .foot { overflow-y: auto; gap: ${px(2)}; padding: ${px(1)}; touch-action: pan-y; }
.pl.th-onebit.pl-phone .status { padding: 0 ${px(1)}; }
.pl.th-onebit.pl-phone .composer:not(.hidden) { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: ${px(2)}; align-items: stretch; flex: none; }
.pl.th-onebit.pl-phone .composer textarea { min-height: 0; height: ${px(26)}; padding: ${px(3)} ${px(2)} ${px(3)} ${px(10)}; line-height: ${px(10)}; outline: 0; border: ${px(1)} solid ${PAPER}; }
.pl.th-onebit.pl-phone .composer textarea:focus { outline: ${px(1)} solid ${PAPER}; outline-offset: 0; }
.pl.th-onebit.pl-phone .composer::before { left: ${px(2)}; top: ${px(4)}; }
.pl.th-onebit.pl-phone .say { position: static; height: auto; min-height: 44px; min-width: 56px; padding: 0 ${px(3)}; touch-action: manipulation; }
.pl.th-onebit.pl-phone .say::after { content: none; }
.pl.th-onebit.pl-phone .actions { flex-direction: row; gap: ${px(2)}; flex: none; }
.pl.th-onebit.pl-phone .actions button, .pl.th-onebit.pl-phone .leave { display: flex; align-items: center; justify-content: center; flex: 1 1 0; width: auto; min-height: 44px; padding: ${px(1)} ${px(2)}; text-indent: 0; text-align: center; line-height: ${px(10)}; border: ${px(1)} solid ${PAPER}; touch-action: manipulation; }
.pl.th-onebit.pl-phone .actions .deal { flex: 1.7 1 0; }
.pl.th-onebit.pl-phone .actions button::before, .pl.th-onebit.pl-phone .leave::before { content: none !important; }
.pl.th-onebit.pl-phone .actions button:disabled { border-style: dashed; }
.pl.th-onebit.pl-phone .leave { width: 100%; flex: none; background: ${PAPER}; color: ${INK}; }
.pl.th-onebit.pl-phone .end { flex: none; }
.pl.th-onebit.pl-phone .end.show { gap: ${px(3)}; padding: ${px(1)}; }
.pl.th-onebit.pl-phone .end-title { font: ${px(8)}/${px(10)} ${BIT}; background: ${PAPER}; color: ${INK}; padding: ${px(1)} ${px(2)}; }
/* Short: the thin stake line, the log, the input. MORE still reaches the deal (it takes the input's place). */
.pl.th-onebit.pl-phone.pl-short .meter { grid-template-columns: auto auto minmax(0, 1fr); gap: 0 ${px(4)}; height: 100%; align-content: center; }
.pl.th-onebit.pl-phone.pl-short .meter-label, .pl.th-onebit.pl-phone.pl-short .bar { display: none; }
.pl.th-onebit.pl-phone.pl-short .meter-value { grid-column: 1; grid-row: 1; margin: 0; }
.pl.th-onebit.pl-phone.pl-short .patience { grid-column: 2; grid-row: 1; }
.pl.th-onebit.pl-phone.pl-short .head { padding-right: ${px(39)}; }
.pl.th-onebit.pl-phone.pl-short:not(.ob-land) .actions { display: none; }
.pl.th-onebit.pl-phone.pl-short.ob-more:not(.ob-land) .actions:not(.hidden) { display: flex; }
.pl.th-onebit.pl-phone.pl-short.ob-more:not(.ob-land) .composer { display: none; }
.pl.th-onebit.pl-phone.ob-land .actions { flex-direction: column; }
.pl.th-onebit.pl-phone.ob-land.ob-low .actions { display: none; }
.pl.th-onebit.pl-phone.ob-land .actions button { flex: none; }
@media (prefers-reduced-motion: reduce) {
  .th-onebit .die.rolling, .th-onebit .dots, .th-onebit .status::after { animation: none !important; }
}
`;

export const theme: ParleyTheme = { css: ONEBIT, decorate: decorateParley };
