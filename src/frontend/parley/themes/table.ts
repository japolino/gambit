/**
 * The Table theme's Parley: its stylesheet, scoped under `.pl.th-table`, and any structure of its own
 * (`decorate`). This file is the theme's own; see ./types.ts for what a Parley theme may provide.
 *
 * When the scene stages the talk in its 3D room (`inRoom`, the usual case) the talk is a game across the
 * real table (./table/room.ts). Without the room (no WebGL) the flat walnut-and-baize version below stands in.
 */
import type { ParleyTheme } from "./types.js";
import { FELL, GARA } from "../style.js";
import { ROOM_CSS } from "./table/room.js";
import { decorateFlat, decorateRoom } from "./table/stakes.js";

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

export const theme: ParleyTheme = {
  css: TABLE + ROOM_CSS,
  inRoom: true,
  decorate: (ctx) => (ctx.root.classList.contains("in-room") ? decorateRoom(ctx) : decorateFlat(ctx)),
};
