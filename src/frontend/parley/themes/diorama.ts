/**
 * The Diorama theme's Parley: its stylesheet, scoped under `.pl.th-diorama`, and any structure of its own
 * (`decorate`). This file is the theme's own; see ./types.ts for what a Parley theme may provide.
 */
import type { ParleyTheme } from "./types.js";
import { FELL, GARA } from "../style.js";
import { ROOM_CSS, decorateRoom } from "./diorama/room.js";
import { PHONE_CSS, decoratePhone } from "./diorama/phone.js";

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

export const theme: ParleyTheme = {
  // The flat lamplit counter above is the talk without the room (no WebGL); ROOM_CSS dresses it as paperwork over the shop's 3D room; PHONE_CSS is either one on a phone.
  css: DIORAMA + ROOM_CSS + PHONE_CSS,
  inRoom: true,
  decorate(ctx) {
    const room = ctx.root.classList.contains("in-room") ? decorateRoom(ctx) : {};
    const phone = decoratePhone(ctx);
    return {
      update(state, journal) {
        room.update?.(state, journal);
        phone.update();
      },
      destroy() {
        phone.destroy();
        room.destroy?.();
      },
    };
  },
};
