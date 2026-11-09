/**
 * The Command theme's Parley: the talk happens on the scene's own monitor (../../stage/themes/command/shell.ts)
 * and runs in its terminal. The screen switches to the 72-column text mode (one 8x8 face, a finer cell, so prose
 * reads at about thirty characters a line), and every glyph on it sits on that one grid:
 *
 *  - VIEW (left): the place, dithered to the screen's palette, with the person you are talking to standing in it
 *    (a cut-out, dithered on the same register and edged in black), their nameplate docked at its foot; an opaque
 *    picture is shown in its own framed window instead. What you know opens over it as a window, like the scene's
 *    journal. A moment swaps the whole view to its picture, dithered too.
 *  - the status window (right, top): the stake and its track in block cells, patience as blocks, the journal key.
 *  - the terminal (right, the rest): the talk scrolling, your lines echoed after the prompt, rolls as one line, and
 *    under a divider the prompt itself and the numbered deal and walk-away commands.
 *
 * Structure and art are built in `decorate`; the stylesheet only places and inverts. This file is the theme's
 * own; see ./types.ts for what a Parley theme may provide.
 *
 * On a phone (.pl-phone) there is no monitor and no character-grid layout: it is a DOS screen in one column, a thin
 * strip of the view, a blue status band, the terminal (nearly all of the screen), then the deal commands and the
 * prompt at the thumb. What you know, the moments and the mode switch sit behind the status band's Know key.
 */
import type { ParleyTheme, ParleyThemeCtx, ParleyDecor } from "./types.js";
import { BIT } from "../style.js";
import { mountShell, type Geo, type Rect } from "../../stage/themes/command/shell.js";
import { canvas, coverDraw, ditherToPalette, frameSvg, glyph, grilleTile, PALETTES, registerOf, scanTile, type PaletteId, type Rgb } from "../../scene/themes/command/pixels.js";
import { VOICES } from "../../scene/themes/command/style.js";

const BLUE = "#0000AA";
const CYAN = "#55FFFF";
const YEL = "#FFFF55";
const MAG = "#FF55FF";
const GREY = "#AAAAAA";
const DARK = "#555555";
const RED = "#FF5555";
const GREEN = "#55FF55";
const F = `var(--c) / var(--lh, var(--c)) ${BIT}`;

const COMMAND = `
.pl.th-command { display: block; padding: 0; background: #050508; color: #fff; font: ${F};
  -webkit-font-smoothing: none; font-smooth: never; overflow: hidden; letter-spacing: 0;
  --p-ink: #fff; --p-dim: ${GREY}; --p-faint: ${DARK}; --p-hot: ${YEL}; --p-accent: ${CYAN}; --p-edge: #fff; }
.th-command * { letter-spacing: 0; }
.th-command .cmdp-screen { position: absolute; overflow: hidden; background: ${BLUE}; z-index: 1; }
.th-command .cmdp-scr { position: absolute; inset: 0; }
.th-command .cmdp-grid { position: absolute; text-shadow: 0 0 calc(var(--v) * 1.3) color-mix(in srgb, currentColor 45%, transparent), 0 0 calc(var(--v) * 3) color-mix(in srgb, currentColor 28%, transparent); }
.th-command .cmdp-w { position: absolute; pointer-events: none; }
.th-command .cmdp-w > .fr, .th-command .cmdp-plate > .fr { position: absolute; inset: 0; width: 100%; height: 100%; display: block; image-rendering: pixelated; }
.th-command .notch { position: absolute; height: var(--c); line-height: var(--c); white-space: pre; overflow: hidden; color: #fff; z-index: 8; pointer-events: none; }
.th-command .cmdp-crt { position: absolute; inset: 0; pointer-events: none; z-index: 30; }
.th-command .cmdp-crt.scan { background-image: var(--scan), url("${grilleTile()}"); background-size: 100% var(--v), 3px 1px; }
.th-command .cmdp-crt.vig { background: var(--vig) 0 0 / 100% 100% no-repeat; }

/* VIEW: the place and the person. */
.th-command .scene { position: absolute; background: #000; overflow: hidden; z-index: 2; }
.th-command .plate, .th-command .vignette, .th-command .figure, .th-command .plaque { display: none; }
.th-command .cmdp-place, .th-command .cmdp-fig { position: absolute; image-rendering: pixelated; }
.th-command .cmdp-place { will-change: transform; }
.th-command .cmdp-figwrap { position: absolute; inset: 0; animation: cmdpBob 2.6s steps(1) infinite; pointer-events: none; }
.th-command .cmdp-figwrap.jolt { animation: cmdpJolt .36s steps(4) 1; }
.th-command .cmdp-win { position: absolute; }
.th-command .cmdp-win > .fr { position: absolute; inset: 0; width: 100%; height: 100%; }
.th-command .cmdp-plate { position: absolute; z-index: 3; }
.th-command .cmdp-plate .role { position: absolute; color: ${GREY}; white-space: normal; overflow: hidden; }
.th-command .cmdp-ld { position: absolute; color: ${DARK}; animation: cmdpBlink .8s steps(1) infinite; }
@keyframes cmdpBob { 50% { transform: translateY(calc(var(--v) * -1)); } }
@keyframes cmdpJolt { 25% { transform: translateX(calc(var(--v) * -2)); } 50% { transform: translateX(calc(var(--v) * 2)); } 75% { transform: translateX(calc(var(--v) * -1)); } }
@keyframes cmdpBlink { 50% { opacity: 0; } }
.th-command .tell { position: absolute; z-index: 6; left: 50%; top: var(--c); translate: -50% 0; max-width: calc(100% - var(--c) * 2); text-align: left;
  font: ${F}; font-style: normal; color: #000; background: ${YEL}; padding: 0 var(--c); text-shadow: none; }
.th-command .tell.show { animation: cmdpTell 6s steps(1) forwards; }
@keyframes cmdpTell { 0% { opacity: 0; } 3%, 82% { opacity: 1; } 100% { opacity: 0; } }
/* The moments: numbered tabs in the view's top corner; a tab (or the beat landing) swaps the view to its picture. */
.th-command .moments { position: absolute; z-index: 7; right: 0; left: auto; top: 0; bottom: auto; gap: 0; counter-reset: mom; }
.th-command .moments button { width: calc(var(--c) * 3); height: var(--c); border: 0; border-radius: 0; box-shadow: none; background: #000; color: ${CYAN}; font: ${F}; padding: 0; counter-increment: mom; }
.th-command .moments button::before { content: "[" counter(mom) "]"; }
.th-command .moments button img { display: none; }
.th-command .moments button:hover, .th-command .moments button:focus-visible { background: ${CYAN}; color: #000; outline: none; text-shadow: none; }
.th-command .moment { z-index: 9; transition: opacity .2s steps(2); }
.th-command .moment img { image-rendering: pixelated; }
.th-command .moment.show img { animation: none; }
.th-command .moment::before { background: none; }
.th-command .moment.show::after { background: ${CYAN}; animation: cmdpFlash .2s steps(1) forwards; }
@keyframes cmdpFlash { 0% { opacity: .9; } 50% { opacity: .9; background: ${MAG}; } 100% { opacity: 0; } }
.th-command .moment .cap { left: var(--c); right: var(--c); bottom: var(--c); font: ${F}; font-style: normal; color: ${YEL}; background: #000; padding: var(--c); text-shadow: none; outline: var(--v) solid #fff; outline-offset: calc(var(--v) * -3); }
.th-command .moment.show .cap { animation: none; }
/* What you know: a window over the view, like the scene's journal. */
.th-command .journal { position: absolute; z-index: 8; margin: 0; padding: calc(var(--c) * 2) calc(var(--c) * 2) var(--c); list-style: none; background: #000; border: 0; border-radius: 0;
  font: ${F}; color: #fff; overflow: hidden; }
.th-command .journal.open { display: block; }
.th-command .journal::before { content: ""; position: absolute; inset: 0; background: var(--jframe) 0 0 / 100% 100% no-repeat; image-rendering: pixelated; pointer-events: none; }
.th-command .journal::after { content: "What you know"; position: absolute; top: 0; left: 50%; translate: -50% 0; color: ${YEL}; background: #000; padding: 0 var(--c); }
.th-command .journal li { margin: 0 0 var(--c); padding-left: calc(var(--c) * 2); position: relative; }
.th-command .journal li::before { content: ""; position: absolute; left: 0; top: 0; width: var(--c); height: var(--c); background: url("${glyph("star", YEL)}") 0 0 / 100% 100%; image-rendering: pixelated; }
.th-command .journal li.used { color: ${DARK}; }
.th-command .journal li.used::before { background-image: url("${glyph("star", DARK)}"); }
.th-command .journal li.empty { color: ${GREY}; font-style: normal; margin-left: 0; padding-left: 0; }
.th-command .journal li.empty::before { display: none; }

/* The side panel's parts sit in the status and terminal windows. */
.th-command .side { display: contents; }
.th-command .head, .th-command .log, .th-command .foot { position: absolute; z-index: 2; background: none; border: 0; box-shadow: none; margin: 0; padding: 0; }
.th-command .head { overflow: hidden; display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-auto-rows: var(--c); column-gap: var(--c); align-items: start; }
.th-command .title-row, .th-command .meter { display: contents; }
.th-command .kind { grid-row: 1 / span 2; grid-column: 1 / -1; height: calc(var(--c) * 2); font: ${F}; text-transform: none; color: ${GREY}; white-space: normal; overflow: hidden; text-overflow: clip;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.th-command .kind::first-letter { text-transform: uppercase; }
.th-command .meter-label { grid-row: 3; grid-column: 1; font: ${F}; text-transform: capitalize; color: ${CYAN}; }
.th-command .meter-label::after { content: ":"; }
.th-command .meter-value { grid-row: 3; grid-column: 2; justify-self: end; font: ${F}; color: ${YEL}; gap: var(--c); }
.th-command .delta { font: ${F}; }
.th-command .delta.show { animation: cmdpTell 2.4s steps(1) forwards; }
.th-command .delta.down { color: ${GREEN}; } .th-command .delta.up { color: ${RED}; }
.th-command .bar { grid-row: 4; grid-column: 1 / -1; height: var(--c); border-radius: 0; border: 0; padding: 0; background: url("${glyph("half", DARK)}") 0 0 / var(--c) var(--c) repeat-x; image-rendering: pixelated; }
.th-command .bar .fill { height: 100%; background: url("${glyph("full", YEL)}") 0 0 / var(--c) var(--c) repeat-x; transition: width .6s steps(8); }
.th-command .patience { grid-row: 5; grid-column: 1 / -1; display: flex; gap: 0; align-items: flex-start; }
.th-command .pl-label { font: ${F}; text-transform: none; color: ${CYAN}; margin: 0 var(--c) 0 0; }
.th-command .pl-label::after { content: ":"; }
.th-command .pip { width: var(--c); height: var(--c); border: 0; border-radius: 0; background: url("${glyph("half", DARK)}") 0 0 / 100% 100%; image-rendering: pixelated; }
.th-command .pip.on { background: url("${glyph("full", MAG)}") 0 0 / 100% 100%; }
.th-command .journal-btn { grid-row: 6; grid-column: 1; margin: 0; justify-self: start; max-width: 100%; overflow: hidden; text-align: left; font: ${F}; color: ${CYAN}; text-transform: none; padding: 0; white-space: nowrap; }
.th-command .journal-btn::before { content: "J "; color: ${YEL}; }
.th-command .journal-btn:hover, .th-command .journal-btn:focus-visible { background: #fff; color: ${BLUE}; outline: none; text-shadow: none; }
.th-command .mode { grid-row: 6; grid-column: 2; justify-self: end; border: 0; border-radius: 0; gap: var(--c); overflow: visible; }
.th-command .mode button { font-size: 0; color: ${DARK}; padding: 0; width: calc(var(--c) * 3); height: var(--c); overflow: hidden; white-space: nowrap; }
.th-command .mode button::after { font: ${F}; content: "IMM"; }
.th-command .mode button + button::after { content: "TRN"; }
/* The face fills its cell top to bottom: the inverse cell grows a virtual pixel all round so the letters keep a cyan edge. */
.th-command .mode button.on { background: ${CYAN}; color: #000; text-shadow: none; box-shadow: 0 0 0 var(--v) ${CYAN}; position: relative; z-index: 1; }
.th-command .mode button:hover, .th-command .mode button:focus-visible { background: #fff; color: ${BLUE}; outline: none; }

/* The terminal: the talk, then the prompt. One face, one size: hierarchy is colour. */
.th-command .log { overflow-x: hidden; overflow-y: auto; display: block; scrollbar-width: none; scroll-behavior: auto; padding-bottom: 0; }
.th-command .log::-webkit-scrollbar { display: none; }
.th-command .log > * { margin: 0 0 var(--c); }
.th-command .setting { font: ${F}; font-style: normal; color: ${GREY}; }
.th-command .speaker { font: ${F}; text-transform: none; color: ${CYAN}; margin: 0; }
.th-command .npc .speaker { float: left; margin-right: var(--c); }
.th-command .npc .speaker::after { content: ":"; }
.th-command .prose, .th-command .npc .prose { font: ${F}; color: #fff; }
.th-command .prose p { margin: 0; }
.th-command .prose em { font-style: normal; color: ${GREY}; }
.pl.th-command { ${VOICES} }
.th-command .npc .prose.waiting .dots { color: ${DARK}; }
.th-command .you { align-self: stretch; max-width: none; border: 0; border-radius: 0; padding: 0; background: none; }
.th-command .you .speaker { display: none; }
.th-command .you .prose { color: ${GREEN}; }
.th-command .you .prose p:first-child::before { content: "> "; }
.th-command .read { border: 0; padding: 0; gap: 0; display: grid; }
.th-command .tray { gap: var(--c); min-height: var(--c); flex-wrap: nowrap; }
.th-command .die { display: flex; width: auto; height: var(--c); padding: 0; clip-path: none; background: none; color: #fff; font: ${F}; transition: none; transform: none; }
.th-command .die::before { content: "["; color: ${DARK}; } .th-command .die::after { content: "]"; color: ${DARK}; }
.th-command .die.rolling { animation: cmdpRoll .14s steps(1) infinite; }
@keyframes cmdpRoll { 50% { color: ${MAG}; } }
.th-command .die.kept { transform: none; box-shadow: none; background: none; color: ${YEL}; text-shadow: inherit; }
.th-command .die.dropped { opacity: 1; color: ${DARK}; }
.th-command .die.nat20 { color: #fff; background: ${YEL}; color: #000; } .th-command .die.nat1 { color: #000; background: ${RED}; }
.th-command .result { font: ${F}; text-transform: uppercase; white-space: nowrap; transition: opacity .2s steps(2); transform: none; }
.th-command .r-crit_success { color: ${YEL}; } .th-command .r-success { color: ${GREEN}; } .th-command .r-partial { color: ${CYAN}; } .th-command .r-fail { color: ${GREY}; } .th-command .r-crit_fail { color: ${RED}; }
/* The read is narration, not a line anyone says: set in two cells under the roll. */
.th-command .imm { font: ${F}; font-style: normal; color: ${GREY}; padding-left: calc(var(--c) * 2); }
.th-command .trn { font: ${F}; color: ${GREY}; gap: 0; }
.th-command .tier { border: 0; border-radius: 0; padding: 0; font: ${F}; color: #000; background: ${GREY}; text-transform: none; }
.th-command .tier.t0 { background: ${RED}; } .th-command .tier.t1 { background: ${MAG}; } .th-command .tier.t3 { background: ${GREEN}; } .th-command .tier.t4 { background: ${YEL}; }
.th-command .why summary { font: ${F}; color: ${CYAN}; }
.th-command .why pre { font: ${F}; color: ${GREY}; }

.th-command .foot { display: grid; grid-auto-rows: min-content; gap: 0; align-content: start; }
.th-command .status { height: var(--c); min-height: 0; font: ${F}; font-style: normal; color: ${YEL}; white-space: nowrap; overflow: hidden; }
.th-command .status:not(:empty)::after { content: "_"; animation: cmdpBlink 1s steps(1) infinite; }
.th-command .composer { grid-template-columns: calc(var(--c) * 2) 1fr auto; gap: 0; align-items: start; }
.th-command .composer::before { content: ">"; color: ${GREEN}; font: ${F}; }
.th-command .composer textarea { grid-column: 2; border: 0; border-radius: 0; background: #000; padding: 0; margin: 0; height: calc(var(--c) * 2); font: ${F}; color: ${GREEN};
  caret-color: ${GREEN}; overflow: hidden; }
.th-command .composer textarea::placeholder { color: transparent; }
.th-command .composer textarea:placeholder-shown:not(:focus) { background: url("${glyph("full", GREEN)}") 0 0 / var(--c) var(--c) no-repeat; animation: cmdpBlink 1s steps(1) infinite; }
.th-command .composer textarea:focus { outline: none; }
.th-command .say { grid-column: 3; height: var(--c); font-size: 0; font-weight: normal; background: none; color: ${CYAN}; padding: 0 0 0 var(--c); border-radius: 0; text-transform: none; text-shadow: none; box-shadow: none; }
.th-command .say::after { content: "[RET]"; font: ${F}; }
.th-command .say:hover:not(:disabled), .th-command .say:focus-visible { background: #fff; color: ${BLUE}; outline: none; }
.th-command .say:disabled, .th-command .deal:disabled { opacity: 1; background: none; color: ${DARK}; }
.th-command .actions { display: grid; gap: 0; justify-items: start; }
.th-command .actions button, .th-command .leave { font: ${F}; background: none; color: ${YEL}; border: 0; border-radius: 0; padding: 0; box-shadow: none; text-transform: none; text-align: left; white-space: normal; max-width: 100%; }
.th-command .actions button::before { content: attr(data-k) " "; color: #fff; }
.th-command .actions .walk { color: ${RED}; }
.th-command .actions button:hover, .th-command .actions button:focus-visible, .th-command .leave:hover { background: #fff; color: ${BLUE}; outline: none; text-shadow: none; }
.th-command .hint { display: none; }
.th-command .end { padding: 0; justify-items: start; text-align: left; }
.th-command .end.show { display: grid; gap: 0; }
.th-command .end-title { font: ${F}; color: #000; background: ${YEL}; padding: 0 var(--c); text-transform: uppercase; }
.th-command .end-sub, .th-command .reveals { font: ${F}; color: ${CYAN}; }
.th-command :focus-visible { outline: var(--v) dashed ${YEL}; outline-offset: 0; }
@media (max-width: 760px) { .th-command .composer textarea { font-size: max(16px, var(--c)); } }
@media (prefers-reduced-motion: reduce) { .th-command *, .th-command *::before, .th-command *::after { animation: none !important; transition: none !important; } .th-command .moment.show::after { display: none; } }
`;

/** Phones: readable and tappable first. One column of DOS bands, no monitor, frames, CRT layers or glow. */
const PL = ".pl.th-command.pl-phone";
const PHONE = `
${PL} { --lh: calc(var(--c) + 4px); background: #000; }
${PL} .cmdx-back, ${PL} .cmdx-front, ${PL} .cmdp-w, ${PL} .cmdp-crt, ${PL} .tell, ${PL} .kind { display: none; }
${PL} .cmdp-screen { background: #000; }
${PL} .cmdp-grid { display: flex; flex-direction: column; text-shadow: none; }

/* The view: a strip across the top, the person's head in the place. */
${PL} .scene { position: relative; flex: 0 0 var(--strip, 0px); min-height: 0; }
${PL} .cmdp-figwrap { animation: none; }
${PL} .cmdp-win { display: none; }
${PL} .cmdp-plate { left: 0; bottom: 0; background: #000; color: ${YEL}; padding: 0 8px; white-space: nowrap; max-width: 100%; overflow: hidden; }

/* Fare, patience and the Know key: one blue band. */
${PL} .head { position: relative; flex: none; background: ${BLUE}; padding: 4px 8px 0; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; grid-template-rows: var(--lh) var(--lh) 8px; column-gap: var(--c); align-items: center; }
${PL} .meter-label { grid-row: 1; grid-column: 1; color: ${CYAN}; }
${PL} .meter-value { grid-row: 1; grid-column: 2; justify-self: start; color: #fff; white-space: nowrap; }
${PL} .patience { grid-row: 2; grid-column: 1 / 3; align-items: center; }
${PL} .pl-label { color: ${CYAN}; }
${PL} .pip { background-color: #000; }
${PL} .bar { grid-row: 3; grid-column: 1 / -1; align-self: end; height: 4px; margin: 0 -8px; background: #000; }
${PL} .bar .fill { background: ${YEL}; }
${PL} .journal-btn { grid-row: 1 / span 2; grid-column: 3; align-self: center; height: 36px; min-width: 44px; padding: 0 6px; font-size: 0; background: ${CYAN}; color: #000; text-align: center; touch-action: manipulation; }
${PL} .journal-btn::before { display: none; }
${PL} .journal-btn::after { content: "Know " attr(data-n); font: ${F}; line-height: 36px; }

/* The terminal: nearly all of the screen. */
${PL} .log { position: relative; flex: 1 1 0; min-height: 0; background: #000; padding: 8px 10px 14px; }
${PL} .log > * { margin: 0 0 calc(var(--lh) * .75); }
${PL} .npc .speaker { float: none; margin: 0; }
${PL} .npc .speaker::after { content: none; }
${PL} .prose p + p { margin-top: calc(var(--lh) * .5); }
${PL} .imm { padding-left: 0; }
${PL} .tray { flex-wrap: wrap; min-height: var(--lh); height: auto; }
${PL} .die { height: var(--lh); }
${PL} .result { white-space: normal; }
${PL} .cmdp-more { position: absolute; z-index: 5; right: 4px; height: var(--lh); padding: 0 4px; color: #000; background: ${YEL}; pointer-events: none; display: none; }
${PL} .cmdp-more.show { display: block; }

/* The commands and the prompt, at the thumb. They sit above the input so the input never moves under a finger. */
${PL} .foot { position: relative; flex: none; display: flex; flex-direction: column; gap: 8px; background: ${BLUE}; padding: 8px; max-height: 70%; overflow-y: auto; }
${PL} .status { height: auto; white-space: normal; color: ${YEL}; }
${PL} .status:empty { display: none; }
${PL} .hand { display: none; }
${PL} .actions { order: -1; display: flex; gap: 8px; align-items: stretch; }
${PL} .actions button, ${PL} .leave { min-height: 44px; flex: 2 1 0; min-width: 0; padding: 2px 6px; text-align: center; white-space: normal; background: #000; color: ${RED}; touch-action: manipulation; }
${PL} .actions .deal { flex: 3 1 0; background: ${YEL}; color: #000; }
${PL} .actions button::before { content: none; }
${PL} .actions button:disabled { background: #000; color: ${GREY}; }
${PL} .composer { order: 1; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: stretch; }
${PL} .composer::before { content: none; }
${PL} .composer textarea { grid-column: 1; height: 44px; line-height: 18px; padding: 4px 6px; box-sizing: border-box; overflow-y: auto; background: #000; }
${PL} .composer textarea::placeholder { color: ${GREY}; }
${PL} .composer textarea:placeholder-shown:not(:focus) { background: #000; animation: none; }
${PL} .say { grid-column: 2; height: 44px; min-width: 64px; padding: 0 8px; text-align: center; background: ${CYAN}; color: #000; touch-action: manipulation; }
${PL} .say::after { content: "Say"; line-height: 44px; }
${PL} .say:disabled { background: #000; color: ${GREY}; }

/* The end card. */
${PL} .end { padding: 0; }
${PL} .end.show { display: flex; flex-direction: column; gap: 8px; align-items: stretch; }
${PL} .end-title { padding: 4px 8px; text-transform: none; }
${PL} .end-sub, ${PL} .reveals { color: #fff; }
${PL} .reveals { margin: 0; padding-left: var(--c); }
${PL} .leave { flex: none; background: ${CYAN}; color: #000; }

/* What you know, the moments and the mode switch: a sheet over the whole screen. */
${PL} .cmdp-sheet { position: absolute; inset: 0; z-index: 30; display: none; flex-direction: column; background: #000; color: #fff; }
${PL} .cmdp-sheet.open { display: flex; }
${PL} .sh-top { flex: none; display: flex; align-items: center; justify-content: space-between; gap: var(--c); background: ${BLUE}; padding: 0 0 0 8px; color: ${YEL}; }
${PL} .sh-x { height: 44px; padding: 0 12px; border: 0; font: ${F}; background: ${CYAN}; color: #000; touch-action: manipulation; }
${PL} .sh-who { flex: none; padding: 8px 10px 0; color: ${GREY}; }
${PL} .sh-who b { display: block; font-weight: normal; color: ${YEL}; }
${PL} .journal { position: static; display: block; flex: 1 1 0; min-height: 0; overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; padding: 12px 10px; background: none; }
${PL} .journal::before, ${PL} .journal::after { content: none; }
${PL} .journal li { margin: 0 0 12px; padding-left: calc(var(--c) * 1.5); }
${PL} .journal li::before { width: var(--c); height: var(--c); top: 2px; }
${PL} .journal li.used { color: ${GREY}; }
${PL} .journal li.empty { padding-left: 0; }
${PL} .moments { position: static; flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 10px; background: ${BLUE}; }
${PL} .moments:empty { display: none; }
${PL} .moments::before { content: "Moments"; color: ${CYAN}; margin-right: 4px; }
${PL} .moments button { width: 56px; height: 44px; background: ${CYAN}; color: #000; touch-action: manipulation; }
${PL} .moments button::before { content: counter(mom); }
${PL} .mode { flex: none; display: flex; gap: 8px; padding: 8px; background: ${BLUE}; }
${PL} .mode button { flex: 1 1 0; width: auto; height: 44px; font: ${F}; color: #fff; background: #000; touch-action: manipulation; overflow: hidden; }
${PL} .mode button::after { content: none; }
${PL} .mode button.on { background: ${CYAN}; color: #000; box-shadow: none; }

/* A moment plays over the whole screen (moved out of the strip in decorate). */
${PL} .moment .cap { left: 8px; right: 8px; bottom: 8px; padding: 8px; outline: none; }

/* The keyboard is open or the screen is short: one thin line for the stakes, the talk, the prompt. */
${PL}.pl-short .scene, ${PL}.pl-short .meter-label, ${PL}.pl-short .pl-label { display: none; }
${PL}.pl-short .head { padding: 0 0 0 8px; grid-template-rows: 32px 3px; }
${PL}.pl-short .meter-value { grid-row: 1; grid-column: 1; }
${PL}.pl-short .patience { grid-row: 1; grid-column: 2; }
${PL}.pl-short .bar { grid-row: 2; height: 3px; margin: 0 0 0 -8px; }
${PL}.pl-short .journal-btn { grid-row: 1; height: 32px; }
${PL}.pl-short .journal-btn::after { line-height: 32px; }
${PL}.pl-short .log { padding: 4px 10px 10px; }
${PL}.pl-short .foot { padding: 6px 8px; gap: 6px; }
${PL}.pl-short .foot:has(textarea:focus) .actions { display: none; }
${PL}.pl-short:not(.cmdp-land) .moment { display: none; }
/* Landscape: the commands stay on the prompt's row, which has the width for them. */
${PL}.cmdp-land .foot { flex-direction: row; align-items: stretch; flex-wrap: wrap; }
${PL}.cmdp-land .status { flex: 1 0 100%; }
${PL}.cmdp-land .composer { order: 0; flex: 1 1 36%; min-width: 200px; }
${PL}.cmdp-land .actions { order: 1; flex: 1 1 50%; }
${PL}.cmdp-land .foot:has(textarea:focus) .actions { display: flex; }
${PL}.cmdp-land .end { flex: 1 0 100%; }
`;

/* -------------------------------- Layout -------------------------------- */

type WinId = "view" | "stat" | "term";
type Wins = Record<WinId, Rect>;
/** The text grid inside the glass: the monitor's own cell divided down to the 72-column mode. */
interface Text80 {
  t: number;
  cols: number;
  rows: number;
}

function textGrid(geo: Geo): Text80 {
  const t = geo.tall ? Math.max(8, Math.min(16, Math.floor(geo.W / 32))) : Math.max(8, Math.round((geo.c * 2) / 3 / 8) * 8);
  return { t, cols: Math.floor((geo.cols * geo.c) / t), rows: Math.floor((geo.rows * geo.c) / t) };
}

/** The scene's own split: the view on the left, status and terminal on the right (a column on a phone). */
function windowsFor(g: Text80, tall: boolean): Wins {
  if (!tall) {
    const vw = Math.round(g.cols * 0.56);
    const rw = g.cols - vw;
    return { view: { x: 0, y: 0, w: vw, h: g.rows }, stat: { x: vw, y: 0, w: rw, h: 8 }, term: { x: vw, y: 8, w: rw, h: g.rows - 8 } };
  }
  const viewH = Math.max(16, Math.round(g.rows * 0.4));
  return { view: { x: 0, y: 0, w: g.cols, h: viewH }, stat: { x: 0, y: viewH, w: g.cols, h: 8 }, term: { x: 0, y: viewH + 8, w: g.cols, h: Math.max(12, g.rows - viewH - 8) } };
}
const FOOT_ROWS = 5;

const fit = (s: string, n: number): string => (n <= 0 ? "" : s.length <= n ? s : n <= 1 ? s.slice(0, n) : `${s.slice(0, n - 1)}.`);
const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
/** Word-wrap to n columns. */
function wrapText(s: string, n: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of s.split(/\s+/)) {
    if (!word) continue;
    if (!line) line = word;
    else if (line.length + 1 + word.length <= n) line += ` ${word}`;
    else {
      out.push(line);
      line = word;
    }
  }
  if (line) out.push(line);
  return out;
}

function paletteId(): PaletteId {
  try {
    const p = localStorage.getItem("gambit.command.palette");
    if (p === "cga" || p === "mono" || p === "ega") return p;
  } catch {
    // Storage blocked.
  }
  return "ega";
}
const lookOf = (pal: PaletteId) => (pal === "mono" ? { contrast: 1.4, saturation: 1, lift: 4 } : pal === "cga" ? { contrast: 1.3, saturation: 1.6, lift: 6 } : { contrast: 1.35, saturation: 1.2, lift: 4, spread: 64 });

/** The tube's curve as a displacement map (the scene's own, ../../scene/themes/command.ts barrel). */
function barrelMap(w: number, h: number): string {
  const c = canvas(w, h);
  const g = c.getContext("2d")!;
  const im = g.createImageData(w, h);
  const cx = w / 2, cy = h / 2, k = 0.008;
  for (let y = 0; y < h; y++) {
    const v = (y + 0.5 - cy) / cy;
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5 - cx) / cx;
      const r2 = u * u + v * v;
      const i = (y * w + x) * 4;
      im.data[i] = 128 + Math.round(-(x + 0.5 - cx) * k * r2) * 8;
      im.data[i + 1] = 128 + Math.round(-(y + 0.5 - cy) * k * r2) * 8;
      im.data[i + 2] = 128;
      im.data[i + 3] = 255;
    }
  }
  g.putImageData(im, 0, 0);
  return c.toDataURL();
}

/** The glass edge's falloff (the scene's vignette). */
function vignette(w: number, h: number): string {
  const cw = Math.max(8, Math.round(w / 8));
  const ch = Math.max(8, Math.round(h / 8));
  const c = canvas(cw, ch);
  const g = c.getContext("2d")!;
  const im = g.createImageData(cw, ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const u = ((x + 0.5) / cw) * 2 - 1;
      const v = ((y + 0.5) / ch) * 2 - 1;
      const d = Math.pow(Math.pow(Math.abs(u), 7) + Math.pow(Math.abs(v), 7), 1 / 7);
      const edge = Math.max(0, Math.min(1, (d - 0.955) / 0.05));
      im.data[(y * cw + x) * 4 + 3] = Math.round(edge * edge * 0.9 * 255);
    }
  }
  g.putImageData(im, 0, 0);
  return c.toDataURL();
}

/** The opaque box of a cut-out at low resolution (fractions of the image), and the middle of its top rows. */
function figureBox(im: HTMLImageElement): { x0: number; y0: number; x1: number; y1: number; head: number } {
  const ah = 160;
  const aw = Math.max(1, Math.round((im.naturalWidth / im.naturalHeight) * ah));
  const a = canvas(aw, ah);
  const ag = a.getContext("2d", { willReadFrequently: true })!;
  ag.drawImage(im, 0, 0, aw, ah);
  const px = ag.getImageData(0, 0, aw, ah).data;
  let x0 = aw, x1 = 0, y0 = ah, y1 = 0;
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) if (px[(y * aw + x) * 4 + 3]! > 100) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  if (x1 <= x0) [x0, x1, y0, y1] = [0, aw - 1, 0, ah - 1];
  let hx = 0, hn = 0;
  const band = y0 + Math.max(2, (y1 - y0) * 0.12);
  for (let y = y0; y < band; y++) for (let x = x0; x <= x1; x++) if (px[(y * aw + x) * 4 + 3]! > 100) {
    hx += x;
    hn++;
  }
  return { x0: x0 / aw, x1: (x1 + 1) / aw, y0: y0 / ah, y1: (y1 + 1) / ah, head: (hn ? hx / hn : (x0 + x1) / 2) / aw };
}

/* ------------------------------ Decoration ------------------------------ */

function decorate(ctx: ParleyThemeCtx): ParleyDecor {
  const root = ctx.root;
  const scene = ctx.scene;
  const npc = ctx.scenario.npc;
  const contest = ctx.scenario.contest;
  const head = root.querySelector<HTMLElement>(".head")!;
  const log = root.querySelector<HTMLElement>(".log")!;
  const foot = root.querySelector<HTMLElement>(".foot")!;
  const journal = root.querySelector<HTMLElement>(".journal")!;
  const hint = root.querySelector<HTMLElement>(".hint");
  const plateImg = scene.querySelector<HTMLImageElement>(".plate-img")!;
  const plateCanvas = scene.querySelector<HTMLCanvasElement>(".plate-canvas");
  const moment = scene.querySelector<HTMLElement>(".moment")!;
  const momentTabs = scene.querySelector<HTMLElement>(".moments")!;
  const modeSwitch = head.querySelector<HTMLElement>(".mode")!;
  const titleRow = head.querySelector<HTMLElement>(".title-row")!;
  const journalBtn = head.querySelector<HTMLElement>(".journal-btn")!;
  const input = foot.querySelector<HTMLTextAreaElement>("textarea")!;
  const placeholder = input.placeholder;
  const fig = scene.querySelector<HTMLElement>(".fig")!;
  const faces = [...fig.querySelectorAll<HTMLImageElement>("img.face")];

  // Where the words go is a fact the player should keep: on the screen it was a line of small print, here it is
  // on the printout taped by the drive (and the hint stays in the DOM for screen readers).
  const local = /no chat/i.test(hint?.textContent ?? "");
  const shell = mountShell(root, {
    drive: "Command",
    card: [["TYPE", "speak"], ["ENTER", "say"], ["J", "what you know"], ["F2 F3", "deal / walk"], ["CHAT", local ? "not posted" : "talk is posted"]],
    keys: [["J", "JOURNAL"], ["C", "CLASSES"], ["T", "DISKS"], ["M", "EGA"]],
  });
  hint?.setAttribute("style", "position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)");
  const screen = document.createElement("div");
  screen.className = "cmdp-screen";
  screen.innerHTML = `<svg class="defs" aria-hidden="true" style="position:absolute;width:0;height:0"><filter id="cmdpBarrel" x="0" y="0" width="1" height="1" filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feImage class="bmap" x="0" y="0" preserveAspectRatio="none" result="m"/><feDisplacementMap in="SourceGraphic" in2="m" scale="31.875" xChannelSelector="R" yChannelSelector="G"/></filter></svg>
    <div class="cmdp-scr"><div class="cmdp-grid"></div></div><div class="cmdp-crt scan"></div><div class="cmdp-crt vig"></div>`;
  shell.back.after(screen);
  const scr = screen.querySelector<HTMLElement>(".cmdp-scr")!;
  const grid = screen.querySelector<HTMLElement>(".cmdp-grid")!;
  const bmap = screen.querySelector("feImage")!;
  const wins: Record<WinId, HTMLDivElement> = { view: document.createElement("div"), stat: document.createElement("div"), term: document.createElement("div") };
  for (const w of Object.values(wins)) {
    w.className = "cmdp-w";
    grid.append(w);
  }
  grid.append(scene, head, log, foot);

  // The view's own pieces: the dithered place, the person (standing in it, or in a window), their nameplate.
  const place = document.createElement("canvas");
  place.className = "cmdp-place";
  const figWrap = document.createElement("div");
  figWrap.className = "cmdp-figwrap";
  figWrap.setAttribute("role", "img");
  figWrap.setAttribute("aria-label", `${npc.name}, ${npc.role}`);
  const figCv = document.createElement("canvas");
  figCv.className = "cmdp-fig";
  const figWin = document.createElement("div");
  figWin.className = "cmdp-win";
  const loading = document.createElement("span");
  loading.className = "cmdp-ld";
  loading.textContent = "LOADING...";
  figWrap.append(figWin, figCv, loading);
  const plate = document.createElement("div");
  plate.className = "cmdp-plate";
  scene.prepend(place, figWrap);
  scene.append(plate, journal);
  // Phones: the sheet behind the Know key, and a mark that says the talk goes on below the fold.
  const sheet = document.createElement("div");
  sheet.className = "cmdp-sheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-label", "What you know");
  sheet.innerHTML = `<div class="sh-top"><span>What you know</span><button type="button" class="sh-x">Close</button></div>
    <div class="sh-who"><b>${esc(npc.name)}</b>${esc(npc.role)}</div>`;
  sheet.querySelector(".sh-x")!.addEventListener("click", () => journal.classList.remove("open"));
  const more = document.createElement("div");
  more.className = "cmdp-more";
  more.setAttribute("aria-hidden", "true");
  more.textContent = "v";
  grid.append(sheet, more);
  // The deal and walk-away commands read as numbered commands.
  root.querySelectorAll<HTMLElement>(".actions button").forEach((b, i) => (b.dataset.k = `F${i + 2}`));

  let geo: Geo = shell.geo;
  let tg: Text80 = textGrid(geo);
  let w: Wins = windowsFor(tg, geo.tall);
  let destroyed = false;
  let pal: PaletteId = paletteId();
  let exchanges = ctx.state.exchanges.length;
  const reduced = ctx.reducedMotion;
  const T = () => tg.t;
  const isPhone = () => root.classList.contains("pl-phone");
  /** On a phone, the strip's size in CSS pixels (0 when there is no strip); the art is two CSS pixels to its pixel. */
  let strip = { w: 0, h: 0 };
  const PHONE_V = 2;

  /** A window frame with labels in its rules. */
  function frame(el: HTMLElement, r: Rect, top: string, bottom = "", topColor = "#fff"): void {
    const c = T();
    Object.assign(el.style, { left: `${r.x * c}px`, top: `${r.y * c}px`, width: `${r.w * c}px`, height: `${r.h * c}px` });
    const t = fit(top, r.w - 4);
    const b = fit(bottom, r.w - 4);
    const notch = (text: string, row: number, color: string) => (text ? `<div class="notch" style="left:${Math.floor((r.w - text.length) / 2) * c}px;top:${row * c}px;width:${text.length * c}px;color:${color}">${esc(text)}</div>` : "");
    el.innerHTML = frameSvg(r.w, r.h, { top: t.length || undefined, bottom: b.length || undefined, fill: true }) + notch(t, 0, topColor) + notch(b, r.h - 1, GREY);
  }

  const inner = (r: Rect) => ({ x: (r.x + 1) * T(), y: (r.y + 1) * T(), w: (r.w - 2) * T(), h: (r.h - 2) * T() });
  const put = (el: HTMLElement, b: { x: number; y: number; w: number; h: number }) => Object.assign(el.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` });

  /* The picture: the place and the person on one register. */
  let reg: Rgb[] = PALETTES[pal];
  let regKey = "";
  function plateSource(): (CanvasImageSource & { width: number; height: number }) | null {
    if (plateImg.getAttribute("src") && plateImg.complete && plateImg.naturalWidth) return plateImg as unknown as HTMLImageElement & { width: number; height: number };
    return plateCanvas && plateCanvas.width ? plateCanvas : null;
  }
  const ARTM = 4;
  /** The nameplate's rows at the view's foot (name in its rule, the role under it). */
  let roleLines: string[] = [];
  const plateRows = () => roleLines.length + 2;
  function drawPlace(): void {
    const r = w.view;
    const phone = isPhone();
    if (phone && !strip.h) return;
    const v = phone ? PHONE_V : T() / 8;
    const W = (phone ? Math.ceil(strip.w / PHONE_V) : (r.w - 2) * 8) + ARTM * 2;
    const H = (phone ? Math.ceil(strip.h / PHONE_V) : (r.h - 2) * 8) + ARTM * 2;
    const src = plateSource();
    Object.assign(place.style, { left: `${-ARTM * v}px`, top: `${-ARTM * v}px`, width: `${W * v}px`, height: `${H * v}px` });
    if (place.width !== W || place.height !== H) {
      place.width = W;
      place.height = H;
    }
    const g = place.getContext("2d", { willReadFrequently: true })!;
    g.fillStyle = "#000";
    g.fillRect(0, 0, W, H);
    if (!src) return;
    const sw = src instanceof HTMLImageElement ? src.naturalWidth : src.width;
    const sh = src instanceof HTMLImageElement ? src.naturalHeight : src.height;
    const key = `${src instanceof HTMLImageElement ? src.src : "painted"}|${pal}`;
    if (key !== regKey) {
      regKey = key;
      reg = pal === "ega" ? registerOf(src, PALETTES.ega, lookOf(pal), 6) : PALETTES[pal];
    }
    g.imageSmoothingQuality = "high";
    coverDraw(g, src, sw, sh, W, H, 0.5, 0.55);
    const d = g.getImageData(0, 0, W, H);
    // The place sits a step back behind the person before it is dithered.
    for (let i = 0; i < d.data.length; i += 4) {
      d.data[i] = d.data[i]! * 0.8;
      d.data[i + 1] = d.data[i + 1]! * 0.8;
      d.data[i + 2] = d.data[i + 2]! * 0.8;
    }
    ditherToPalette(d, reg, lookOf(pal));
    g.putImageData(d, 0, 0);
  }

  /** The face shown now: the img with "on", else the first with a src. */
  const faceImg = () => faces.find((f) => f.classList.contains("on") && f.complete && f.naturalWidth) ?? faces.find((f) => f.getAttribute("src") && f.complete && f.naturalWidth) ?? null;
  let figKey = "";
  function drawFigure(force = false): void {
    const im = faceImg();
    loading.style.display = im ? "none" : "";
    if (!im) return;
    const framed = fig.classList.contains("framed");
    const r = w.view;
    const c = T();
    const phone = isPhone();
    if (phone && !strip.h) return;
    const v = phone ? PHONE_V : c / 8;
    const cw = r.w - 2;
    const ch = r.h - 2;
    const free = ch - plateRows();
    const key = `${im.src}|${framed}|${cw}x${ch}|${c}|${pal}|${regKey}|${free}|${phone ? `${strip.w}x${strip.h}` : ""}`;
    if (!force && key === figKey) return;
    figKey = key;
    let W: number, H: number, ox: number, oy: number;
    const g0 = (cv: HTMLCanvasElement) => cv.getContext("2d", { willReadFrequently: true })!;
    if (phone) {
      // The strip has room for a head: head and shoulders, the whole height of the strip, in the middle.
      figWin.style.display = "none";
      const sw8 = Math.ceil(strip.w / v);
      H = Math.ceil(strip.h / v);
      const iw = im.naturalWidth;
      const ih = im.naturalHeight;
      if (framed) {
        W = Math.min(sw8, Math.round(H * 1.1));
        figCv.width = W;
        figCv.height = H;
        const fg = g0(figCv);
        fg.fillStyle = "#000";
        fg.fillRect(0, 0, W, H);
        fg.imageSmoothingQuality = "high";
        coverDraw(fg, im, iw, ih, W, H, 0.5, 0.15);
      } else {
        const b = figureBox(im);
        const bw = (b.x1 - b.x0) * iw;
        const bh = (b.y1 - b.y0) * ih;
        const tallness = bh / Math.max(1, bw);
        const k = H / (bh * (tallness > 2 ? 0.4 : tallness > 1.4 ? 0.55 : 0.8));
        W = Math.min(sw8, Math.round(bw * k) + 4);
        figCv.width = W;
        figCv.height = H;
        const fg = g0(figCv);
        fg.clearRect(0, 0, W, H);
        fg.imageSmoothingQuality = "high";
        fg.drawImage(im, b.head * iw - W / 2 / k, b.y0 * ih, W / k, H / k, 0, 0, W, H);
      }
      ox = Math.round((sw8 - W) / 2) * v;
      oy = 0;
    } else if (framed) {
      // An opaque picture: its own window, with the place showing round it.
      const fw = Math.min(cw - 4, Math.round(free * 0.8));
      const fh = Math.min(free - 2, fw + 2);
      const fx = Math.floor((cw - fw) / 2);
      const fy = Math.max(1, Math.floor((free - fh) / 2));
      figWin.style.display = "";
      put(figWin, { x: fx * c, y: fy * c, w: fw * c, h: fh * c });
      figWin.innerHTML = frameSvg(fw, fh, {});
      figWin.querySelector("svg")!.setAttribute("style", "position:absolute;inset:0;width:100%;height:100%");
      W = (fw - 2) * 8;
      H = (fh - 2) * 8;
      ox = (fx + 1) * c;
      oy = (fy + 1) * c;
      figCv.width = W;
      figCv.height = H;
      const g = g0(figCv);
      g.fillStyle = "#000";
      g.fillRect(0, 0, W, H);
      g.imageSmoothingQuality = "high";
      coverDraw(g, im, im.naturalWidth, im.naturalHeight, W, H, 0.5, 0.2);
    } else {
      // A cut-out stands in the place, feet on the nameplate, about three quarters of the view tall.
      figWin.style.display = "none";
      const b = figureBox(im);
      const iw = im.naturalWidth;
      const ih = im.naturalHeight;
      const bw = (b.x1 - b.x0) * iw;
      const bh = (b.y1 - b.y0) * ih;
      H = Math.round(free * 8 * 0.92);
      const k = H / bh;
      W = Math.min(cw * 8, Math.round(bw * k) + 4);
      ox = Math.round((cw * 8 - W) / 2) * v;
      oy = (free * 8 - H) * v;
      figCv.width = W;
      figCv.height = H;
      const g = g0(figCv);
      g.clearRect(0, 0, W, H);
      g.imageSmoothingQuality = "high";
      const sx = b.head * iw - W / 2 / k;
      g.drawImage(im, sx, b.y0 * ih, W / k, H / k, 0, 0, W, H);
    }
    const g = g0(figCv);
    const d = g.getImageData(0, 0, W, H);
    ditherToPalette(d, reg, { ...lookOf(pal), contrast: 1.25, lift: 14 });
    if (!framed) {
      // A one-pixel black edge so the figure stands off the place, as sprites did.
      const a = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) a[i] = d.data[i * 4 + 3]! > 0 ? 1 : 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (a[i]) continue;
        if ((x > 0 && a[i - 1]) || (x < W - 1 && a[i + 1]) || (y > 0 && a[i - W]) || (y < H - 1 && a[i + W])) {
          d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = 0;
          d.data[i * 4 + 3] = 255;
        }
      }
    }
    g.putImageData(d, 0, 0);
    Object.assign(figCv.style, { left: `${ox}px`, top: `${oy}px`, width: `${W * v}px`, height: `${H * v}px` });
  }

  /** The nameplate docked at the view's foot: the name set into its rule, the role under it. */
  function buildPlate(): void {
    if (isPhone()) {
      roleLines = [];
      Object.assign(plate.style, { left: "", top: "", width: "", height: "" });
      plate.textContent = npc.name;
      return;
    }
    const r = w.view;
    const c = T();
    const cw = r.w - 2;
    roleLines = wrapText(npc.role, cw - 2).slice(0, 3);
    const ph = plateRows();
    const label = fit(npc.name, cw - 4);
    put(plate, { x: 0, y: (r.h - 2 - ph) * c, w: cw * c, h: ph * c });
    plate.innerHTML = `${frameSvg(cw, ph, { top: label.length, mat: "#000" })}<div class="notch" style="left:${Math.floor((cw - label.length) / 2) * c}px;top:0;width:${label.length * c}px;color:${YEL}">${esc(label)}</div>
      <div class="role" style="left:${c}px;right:${c}px;top:${c}px;height:${roleLines.length * c}px">${roleLines.map(esc).join("<br>")}</div>`;
    plate.querySelector("svg")!.setAttribute("style", "position:absolute;inset:0;width:100%;height:100%");
    put(loading, { x: c, y: c, w: 10 * c, h: c });
  }

  function titles(): void {
    if (isPhone()) return;
    frame(wins.view, w.view, ctx.scenario.name, "", CYAN);
    frame(wins.stat, w.stat, `${contest.kind.charAt(0).toUpperCase()}${contest.kind.slice(1)} - Exchange ${exchanges + 1}`);
    frame(wins.term, w.term, "Parley");
    // The divider between the talk and the prompt, labelled like the scene's command rule.
    const t = w.term;
    const c = T();
    const row = t.h - 2 - FOOT_ROWS;
    const label = "Command";
    const svgW = t.w * 8;
    const v = 1;
    const tx = Math.floor((t.w - label.length) / 2);
    const a0 = (tx - 1) * 8;
    const b0 = (tx + label.length + 1) * 8;
    const rule = `<svg viewBox="0 0 ${svgW} 8" preserveAspectRatio="none" shape-rendering="crispEdges" style="position:absolute;left:0;top:${row * c}px;width:${t.w * c}px;height:${c}px;display:block"><rect x="3" y="3" width="${a0 - 3}" height="${v}" fill="#fff"/><rect x="${b0}" y="3" width="${svgW - 3 - b0}" height="${v}" fill="#fff"/></svg>`;
    wins.term.insertAdjacentHTML("beforeend", rule + `<div class="notch" style="left:${tx * c}px;top:${row * c}px;width:${label.length * c}px;color:${YEL}">${label}</div>`);
  }

  /** Where the view's parts live: in the view on a wide screen, in the sheet (or over everything) on a phone. */
  function placeParts(phone: boolean): void {
    if (phone) {
      sheet.append(journal, momentTabs, modeSwitch);
      grid.append(moment, sheet, more);
    } else {
      titleRow.append(modeSwitch);
      scene.insertBefore(momentTabs, plate);
      scene.insertBefore(moment, plate);
      scene.append(journal);
      for (const el of [sheet, more]) el.classList.remove("open", "show");
    }
  }

  function syncKnow(): void {
    journalBtn.dataset.n = /\((\d+)\)/.exec(journalBtn.textContent ?? "")?.[1] ?? "";
  }

  /** Is there more of the talk below the fold? (Phones: the log has no visible scrollbar until it moves.) */
  function syncMore(): void {
    if (!isPhone()) return;
    const below = log.scrollHeight - log.clientHeight - log.scrollTop > 8;
    more.classList.toggle("show", below);
    if (below) more.style.top = `${log.offsetTop + log.clientHeight - more.offsetHeight - 4}px`;
  }

  function layoutPhone(): void {
    const W = root.clientWidth;
    const H = root.clientHeight;
    geo = shell.layout(W, H);
    const c = W >= 420 ? 16 : 14;
    tg = { t: c, cols: Math.floor(W / c), rows: Math.floor(H / c) };
    w = windowsFor(tg, true);
    root.style.setProperty("--c", `${c}px`);
    root.style.setProperty("--v", `${c / 8}px`);
    root.classList.toggle("cmdp-land", root.classList.contains("pl-short") && W > H * 1.4 && H >= 280);
    scr.style.filter = "";
    put(screen, { x: 0, y: 0, w: W, h: H });
    put(grid, { x: 0, y: 0, w: W, h: H });
    for (const el of [scene, head, log, foot, journal]) Object.assign(el.style, { left: "", top: "", width: "", height: "" });
    placeParts(true);
    // The picture gets a strip while there are lines to spare; the talk keeps the rest.
    const stripH = root.classList.contains("pl-short") || H < 520 ? 0 : H < 620 ? 72 : Math.round(Math.min(120, H * 0.15));
    strip = { w: W, h: stripH };
    root.style.setProperty("--strip", `${stripH}px`);
    place.style.transform = "";
    input.placeholder = "Say something...";
    syncKnow();
    buildPlate();
    drawPlace();
    drawFigure(true);
    syncMore();
  }

  function layout(): void {
    if (isPhone()) {
      layoutPhone();
      return;
    }
    root.classList.remove("cmdp-land");
    input.placeholder = placeholder;
    root.style.removeProperty("--strip");
    placeParts(false);
    geo = shell.layout(root.clientWidth, root.clientHeight);
    tg = textGrid(geo);
    w = windowsFor(tg, geo.tall);
    const c = T();
    const v = c / 8;
    root.style.setProperty("--c", `${c}px`);
    root.style.setProperty("--v", `${v}px`);
    screen.style.setProperty("--scan", `url("${scanTile(geo.c / 8)}")`);
    put(screen, geo.glass);
    const gx = Math.floor((geo.glass.w - tg.cols * c) / 2);
    const gy = Math.floor((geo.glass.h - tg.rows * c) / 2);
    Object.assign(grid.style, { left: `${gx}px`, top: `${gy}px`, width: `${tg.cols * c}px`, height: `${tg.rows * c}px` });
    titles();
    put(scene, inner(w.view));
    put(head, inner(w.stat));
    const t = inner(w.term);
    put(log, { x: t.x, y: t.y, w: t.w, h: t.h - (FOOT_ROWS + 1) * c });
    put(foot, { x: t.x, y: t.y + t.h - FOOT_ROWS * c, w: t.w, h: FOOT_ROWS * c });
    const vr = w.view;
    const jw = Math.min(vr.w - 4, 34);
    const jh = Math.min(vr.h - 6, 22);
    const jx = Math.floor((vr.w - 2 - jw) / 2);
    put(journal, { x: jx * c, y: 2 * c, w: jw * c, h: jh * c });
    journal.style.setProperty("--jframe", `url("data:image/svg+xml,${encodeURIComponent(frameSvg(jw, jh, { top: 15 }).replace("<svg ", "<svg xmlns='http://www.w3.org/2000/svg' "))}")`);
    if (!geo.tall && geo.glass.w > 8) {
      screen.style.setProperty("--vig", `url("${vignette(geo.glass.w, geo.glass.h)}")`);
      bmap.setAttribute("width", String(geo.glass.w));
      bmap.setAttribute("height", String(geo.glass.h));
      bmap.setAttribute("href", barrelMap(geo.glass.w, geo.glass.h));
      scr.style.filter = "url(#cmdpBarrel)";
    } else {
      screen.style.setProperty("--vig", "none");
      scr.style.filter = "";
    }
    buildPlate();
    drawPlace();
    drawFigure(true);
  }

  /* Updates as the talk goes. */
  const redraw = () => {
    if (destroyed) return;
    drawPlace();
    drawFigure(true);
  };
  plateImg.addEventListener("load", redraw);
  const onFace = () => drawFigure();
  for (const f of faces) f.addEventListener("load", onFace);
  let lastMood = "";
  const mo = new MutationObserver(() => {
    drawFigure();
    const mood = [...fig.classList].find((x) => x.startsWith("m-")) ?? "";
    if (mood && mood !== lastMood && !reduced) {
      figWrap.classList.remove("jolt");
      void figWrap.offsetWidth;
      figWrap.classList.add("jolt");
    }
    lastMood = mood;
  });
  mo.observe(fig, { attributes: true, attributeFilter: ["class", "src"], subtree: true });

  // The moments' pictures go through the screen's palette too (the full view and the tabs alike).
  const doneEl = new WeakMap<HTMLImageElement, string>();
  const ditherImg = (img: HTMLImageElement) => {
    const url = img.getAttribute("src");
    if (!url || doneEl.get(img) === url) return;
    const run = () => {
      if (!img.naturalWidth || img.getAttribute("src") !== url) return;
      const r = w.view;
      const W = isPhone() ? Math.ceil(root.clientWidth / PHONE_V) : (r.w - 2) * 8;
      const H = isPhone() ? Math.ceil(root.clientHeight / PHONE_V) : (r.h - 2) * 8;
      const c = canvas(W, H);
      const g = c.getContext("2d", { willReadFrequently: true })!;
      coverDraw(g, img, img.naturalWidth, img.naturalHeight, W, H);
      try {
        const d = g.getImageData(0, 0, W, H);
        ditherToPalette(d, reg, lookOf(pal));
        g.putImageData(d, 0, 0);
        const out = c.toDataURL();
        doneEl.set(img, out);
        img.src = out;
      } catch {
        // A cross-origin picture cannot be read back: hidden rather than shown off-palette.
        img.style.visibility = "hidden";
      }
    };
    doneEl.set(img, url);
    if (img.complete) run();
    else img.addEventListener("load", run, { once: true });
  };
  const mm = new MutationObserver(() => [moment, momentTabs].forEach((el) => el.querySelectorAll<HTMLImageElement>("img").forEach(ditherImg)));
  for (const el of [moment, momentTabs]) mm.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ["src"] });

  const onMove = (e: PointerEvent) => {
    if (reduced || isPhone()) return;
    const r = root.getBoundingClientRect();
    const x = ((e.clientX - r.left) / Math.max(1, r.width) - 0.5) * 2;
    const y = ((e.clientY - r.top) / Math.max(1, r.height) - 0.5) * 2;
    shell.parallax(x, y);
    const v = T() / 8;
    place.style.transform = `translate3d(${Math.round(-x * ARTM * v * 0.8)}px, ${Math.round(-y * ARTM * v * 0.6)}px, 0)`;
  };
  root.addEventListener("pointermove", onMove);
  // J opens what you know (not while typing); F2 and F3 are the deal and the walk-away, as the screen labels them.
  const onKey = (e: KeyboardEvent) => {
    if (!root.isConnected || e.ctrlKey || e.metaKey || e.altKey) return;
    const actions = [...root.querySelectorAll<HTMLButtonElement>(".actions button")];
    const fk = /^F([2-9])$/.exec(e.key);
    if (fk) {
      const b = actions[Number(fk[1]) - 2];
      if (b && !b.disabled) {
        e.preventDefault();
        b.click();
      }
      return;
    }
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (e.key.toLowerCase() === "j") {
      journal.classList.toggle("open");
      e.preventDefault();
    } else if (e.key === "Escape" && journal.classList.contains("open")) {
      journal.classList.remove("open");
      e.preventDefault();
    }
  };
  window.addEventListener("keydown", onKey);
  const ro = new ResizeObserver(() => {
    if (root.clientWidth !== geo.W || root.clientHeight !== geo.H) layout();
  });
  ro.observe(root);
  // view.ts says when this is a phone layout, and may say it after this first layout, or with the size unchanged.
  let phoneKey = "";
  const phoneNow = () => `${root.classList.contains("pl-phone")}|${root.classList.contains("pl-short")}`;
  const cls = new MutationObserver(() => {
    const k = phoneNow();
    if (k !== phoneKey) {
      phoneKey = k;
      layout();
    }
  });
  cls.observe(root, { attributes: true, attributeFilter: ["class"] });
  const jo = new MutationObserver(() => sheet.classList.toggle("open", journal.classList.contains("open")));
  jo.observe(journal, { attributes: true, attributeFilter: ["class"] });
  log.addEventListener("scroll", syncMore, { passive: true });
  const lo = new MutationObserver(syncMore);
  lo.observe(log, { subtree: true, childList: true, characterData: true });
  const lr = new ResizeObserver(syncMore);
  lr.observe(log);
  phoneKey = phoneNow();
  layout();
  // A face can land before its load listener sees it (cached, or set while the figure is hidden): look again until it shows.
  const poll = window.setInterval(() => {
    if (destroyed) return;
    drawFigure();
    if (faceImg()) window.clearInterval(poll);
  }, 400);
  // Fonts land after the first layout on a cold page.
  void document.fonts?.ready.then(() => !destroyed && layout());

  return {
    update(state) {
      const n = state.exchanges.length;
      syncKnow();
      shell.busy(!!root.querySelector(".status")?.textContent);
      if (n !== exchanges) {
        exchanges = n;
        titles();
      }
      const p = paletteId();
      if (p !== pal) {
        pal = p;
        regKey = "";
        redraw();
      }
    },
    destroy() {
      destroyed = true;
      window.clearInterval(poll);
      mo.disconnect();
      mm.disconnect();
      ro.disconnect();
      cls.disconnect();
      jo.disconnect();
      lo.disconnect();
      lr.disconnect();
      log.removeEventListener("scroll", syncMore);
      plateImg.removeEventListener("load", redraw);
      for (const f of faces) f.removeEventListener("load", onFace);
      root.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", onKey);
      shell.destroy();
      screen.remove();
    },
  };
}

export const theme: ParleyTheme = { css: COMMAND + PHONE, decorate };
