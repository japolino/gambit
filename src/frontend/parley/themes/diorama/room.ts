/**
 * The Diorama talk staged in the shop's 3D room (`.pl.th-diorama.in-room`). The person stands behind the oak
 * counter in the room itself (../../../scene/themes/diorama/room3d.ts) with their brass nameplate on the counter;
 * the till beside them rings up the running offer, its brass plate names the stake, and the hourglass at their
 * elbow runs with their patience, so none of that is printed again here. What stays on screen is what the shop's
 * own scene screen has: the dark, gold-ruled dialogue box at the bottom with its peaked crest (the exchange, the
 * line you write and a rubber stamp to say it, brass keys to take the deal or walk away), plus what you know as
 * index cards lying on the counter and the moments as snapshots laid beside them.
 *
 * `decorate` moves the facts and the moments onto the counter and hands the room what it needs through the shared
 * board (bridge.ts): the person's picture (as the view shows it), the stake's name, the offer and the patience.
 */
import type { ParleyDecor, ParleyThemeCtx } from "../types.js";
import { FELL, GARA, CINZ } from "../../style.js";
import { board } from "../../../scene/themes/diorama/bridge.js";

const svgUrl = (s: string) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;

/** The scene's own narration box: an espresso plaque with a peaked crest and a double gold rule (diorama/art.ts AWNING). */
const BOX = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 300' preserveAspectRatio='none'>
<path d='M0 44 Q6 36 24 34 L470 6 Q500 0 530 6 L976 34 Q994 36 1000 44 L1000 288 Q1000 300 988 300 L12 300 Q0 300 0 288 Z' fill='#120e0b' fill-opacity='.94'/>
<path d='M0 44 Q6 36 24 34 L470 6 Q500 0 530 6 L976 34 Q994 36 1000 44' fill='none' stroke='#e2b763' stroke-width='2.4' vector-effect='non-scaling-stroke'/>
<path d='M12 52 Q18 46 32 44 L470 16 Q500 11 530 16 L968 44 Q982 46 988 52' fill='none' stroke='#e2b763' stroke-opacity='.35' stroke-width='1' vector-effect='non-scaling-stroke'/>
<path d='M2 290 L998 290' stroke='#e2b763' stroke-opacity='.25' stroke-width='1' vector-effect='non-scaling-stroke'/></svg>`;

/** A wooden-handled rubber stamp seen from the side: a turned knob, the handle, the rubber foot. */
const STAMP = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 80'><defs><linearGradient id='w' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#5a3418'/><stop offset='.45' stop-color='#c8915a'/><stop offset='1' stop-color='#4a2a12'/></linearGradient></defs>
<ellipse cx='30' cy='14' rx='15' ry='12' fill='url(#w)'/><ellipse cx='26' cy='9' rx='5' ry='3' fill='#f0c890' opacity='.5'/>
<path d='M24 24 L36 24 L38 48 L22 48 Z' fill='url(#w)'/><rect x='8' y='48' width='44' height='16' rx='2' fill='url(#w)'/><rect x='10' y='64' width='40' height='8' fill='#7a1a12'/><rect x='10' y='64' width='40' height='2' fill='#c84a3a' opacity='.6'/></svg>`;

/** A brass paperweight (a turned dome on a disc) for the stack of what you know. */
const WEIGHT = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 50'><defs><radialGradient id='g' cx='.35' cy='.3' r='.8'><stop offset='0' stop-color='#fff3c8'/><stop offset='.35' stop-color='#d4a24a'/><stop offset='1' stop-color='#5a3410'/></radialGradient></defs>
<ellipse cx='42' cy='42' rx='34' ry='7' fill='#000' opacity='.45'/><ellipse cx='40' cy='38' rx='32' ry='8' fill='#6e4718'/><path d='M12 36 Q14 6 40 6 Q66 6 68 36 Z' fill='url(#g)'/><ellipse cx='40' cy='36' rx='28' ry='5' fill='#8a5a1c' opacity='.6'/></svg>`;

const PAPER = `repeating-linear-gradient(transparent 0 15px, rgba(80,120,190,.22) 15px 16px) 0 26px / 100% 100% no-repeat, linear-gradient(90deg, transparent 0 14px, rgba(200,60,60,.4) 14px 15px, transparent 15px), repeating-linear-gradient(17deg, rgba(120,90,50,.04) 0 1px, transparent 1px 4px), linear-gradient(#f8f0dc, #ece0c2)`;
const BRASS = `linear-gradient(180deg, #fbe7a8, #d4a24a 45%, #9a6a28 80%, #d9ab52)`;

export const ROOM_CSS = `
.pl.th-diorama.in-room { display: block; background: transparent;
  --p-ink: #f4efe6; --p-dim: #c8b08a; --p-faint: #a8926e; --p-soft: #d8c8a8; --p-em: #e8c27a; --p-accent: #e2b763; --p-hot: #ffe9a8;
  --p-edge: rgba(226,183,99,.45); --p-rule: rgba(226,183,99,.25); --p-good: #9fd890; --p-bad: #f08a6a; }
.pl.th-diorama.in-room .scene { position: absolute; inset: 0; background: transparent; overflow: visible; pointer-events: none; }
.pl.th-diorama.in-room .scene > * { pointer-events: auto; }
.pl.th-diorama.in-room .scene::before, .pl.th-diorama.in-room .scene::after { display: none; }
/* The person stands in the room itself, with their nameplate on the counter. */
.pl.th-diorama.in-room .figure, .pl.th-diorama.in-room .plaque { display: none; }
/* What they let slip: a slip of paper pinned up beside them. */
.pl.th-diorama.in-room .tell { pointer-events: none; top: 7%; left: 62%; padding: .5em 1.2em .6em; color: #2b170a; text-shadow: none; max-width: min(30vw, 460px);
  font: italic 400 clamp(17px, 2.2vh, 22px)/1.3 ${FELL}; background: radial-gradient(circle at 50% 7px, #b02a20 0 4px, rgba(0,0,0,0) 4.5px), linear-gradient(#f8f0dc, #ece0c2);
  rotate: 1.5deg; filter: drop-shadow(0 8px 10px rgba(0,0,0,.6)); }

/* The dialogue box: the scene's own espresso plaque, low and centred over the counter's front. */
.pl.th-diorama.in-room .side { position: absolute; left: 50%; bottom: 10px; translate: -50% 0; width: clamp(680px, 58vw, 1060px); height: clamp(230px, 27vh, 290px);
  display: grid; grid-template-rows: auto minmax(0, 1fr) auto; padding: clamp(40px, 4.6vh, 50px) clamp(30px, 3vw, 50px) 10px; border: 0; box-shadow: none;
  background: ${svgUrl(BOX)} center / 100% 100% no-repeat; filter: drop-shadow(0 10px 22px rgba(0,0,0,.75)); color: #f4efe6; }
/* The stake and the patience live on the till and the hourglass, and who you're talking to and about what on
   the brass nameplate on the counter: kept for screen readers, not printed twice. */
.pl.th-diorama.in-room .meter, .pl.th-diorama.in-room .kind { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); margin: 0; padding: 0; }
.pl.th-diorama.in-room .head { position: static; padding: 0; border: 0; }
.pl.th-diorama.in-room .title-row { position: absolute; left: clamp(30px, 3vw, 50px); bottom: 9px; padding: 0; gap: 8px; white-space: nowrap; z-index: 2; }
.pl.th-diorama.in-room .kind { padding: .34em 1.3em .38em; font: 800 13px/1 ${CINZ}; letter-spacing: .1em; text-transform: uppercase; color: #f5d36c; -webkit-line-clamp: 1;
  background: linear-gradient(180deg, #2a1c10, #120c07); box-shadow: inset 0 0 0 1px rgba(226,183,99,.7), 0 3px 6px rgba(0,0,0,.6); }
.pl.th-diorama.in-room .mode { gap: 2px; }
.pl.th-diorama.in-room .mode button { font: 700 11px ${CINZ}; letter-spacing: .06em; color: #d8c8a8; background: linear-gradient(#2a1c10, #120c07); box-shadow: inset 0 0 0 1px rgba(226,183,99,.45); padding: 4px 10px; rotate: 0deg; }
.pl.th-diorama.in-room .mode button.on { color: #2a1404; background: ${BRASS}; box-shadow: 0 2px 4px rgba(0,0,0,.5); }
.pl.th-diorama.in-room .log { padding: 14px 4px 8px; gap: 10px; -webkit-mask-image: linear-gradient(transparent 0, #000 26px); mask-image: linear-gradient(transparent 0, #000 26px); }
.pl.th-diorama.in-room .setting { color: #c8b08a; font: italic 400 16px ${FELL}; }
.pl.th-diorama.in-room .speaker { font: 800 11px ${CINZ}; letter-spacing: .14em; color: #c9a04e; }
.pl.th-diorama.in-room .npc .prose { font: 400 clamp(18px, 2.1vh, 21px)/1.42 ${GARA}; color: #f5ebd6; }
.pl.th-diorama.in-room .npc .prose em { color: #c8b08a; }
.pl.th-diorama.in-room .you { rotate: 0deg; max-width: 82%; padding: 2px 0 2px 14px; background: none; box-shadow: none; border-left: 2px solid rgba(226,183,99,.6); }
.pl.th-diorama.in-room .you::before { display: none; }
.pl.th-diorama.in-room .you .prose { font: italic 400 17px/1.4 ${FELL}; color: #e8d8b0; }
.pl.th-diorama.in-room .you .speaker { text-align: left; color: #c9a04e; }
.pl.th-diorama.in-room .read { border-left: 1px dashed rgba(226,183,99,.4); }
.pl.th-diorama.in-room .die { color: #2a1404; background: radial-gradient(circle at 35% 30%, #fff3c8, #d4a24a 55%, #7a4c18); clip-path: polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%); border-radius: 0; font: 800 15px ${CINZ}; }
.pl.th-diorama.in-room .imm { color: #c8b08a; font: italic 400 15px ${FELL}; }
.pl.th-diorama.in-room .r-crit_success { color: #ffd86a; } .pl.th-diorama.in-room .r-success { color: #9fd890; } .pl.th-diorama.in-room .r-partial { color: #e2c48a; } .pl.th-diorama.in-room .r-fail { color: #a8a090; } .pl.th-diorama.in-room .r-crit_fail { color: #f08a6a; }
.pl.th-diorama.in-room .trn { color: #d8c8a8; }
.pl.th-diorama.in-room .foot { padding: 8px 0 0; border-top: 1px solid rgba(226,183,99,.3); display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 14px; align-items: center; }
.pl.th-diorama.in-room .status { grid-column: 1 / -1; grid-row: 1; min-height: 0; color: #e8c27a; font: italic 400 15px ${FELL}; }
.pl.th-diorama.in-room .status:empty { display: none; }
.pl.th-diorama.in-room .composer { grid-column: 1; grid-row: 2; align-items: stretch; gap: 8px; }
/* The line you write: a strip of ruled stock with a red margin; Say: a rubber stamp. */
.pl.th-diorama.in-room .composer textarea { height: 42px; min-height: 42px; resize: none; background: ${PAPER}; color: #2b170a; box-shadow: inset 0 2px 5px rgba(60,30,10,.35); font: 400 17px/1.4 ${FELL}; padding: 9px 12px 6px 24px; }
.pl.th-diorama.in-room .say { position: relative; min-width: 0; height: 42px; padding: 0 14px 0 36px; border-radius: 4px; font: 800 14px ${CINZ}; letter-spacing: .14em; color: #2a1404;
  background: ${svgUrl(STAMP)} 9px 50% / auto 26px no-repeat, ${BRASS}; box-shadow: inset 0 1px 0 rgba(255,255,255,.5), 0 3px 6px rgba(0,0,0,.6); text-shadow: 0 1px 0 rgba(255,240,200,.6); }
.pl.th-diorama.in-room .say:hover:not(:disabled) { translate: 0 2px; filter: brightness(1.08) drop-shadow(0 0 6px rgba(255,214,80,.7)); }
/* Take it / Walk away: brass keys like the till's. */
.pl.th-diorama.in-room .actions { grid-column: 2; grid-row: 2; flex-direction: row; align-items: stretch; gap: 6px; flex-wrap: nowrap; }
.pl.th-diorama.in-room .actions button { clip-path: none; filter: none; border-radius: 3px; height: 42px; padding: 0 14px; white-space: nowrap; font: 800 12px ${CINZ}; letter-spacing: .06em; text-transform: uppercase; font-style: normal;
  color: #f5d36c; background: linear-gradient(#2e2014, #160e08); box-shadow: inset 0 0 0 1px rgba(226,183,99,.6), 0 2px 4px rgba(0,0,0,.6); }
.pl.th-diorama.in-room .actions .deal { color: #2a1404; background: ${BRASS}; }
.pl.th-diorama.in-room .actions button:hover { color: #fff6b0; filter: drop-shadow(0 0 6px rgba(255,210,40,.7)); }
.pl.th-diorama.in-room .actions .deal:hover { color: #000; }
.pl.th-diorama.in-room .hint { grid-column: 1 / -1; grid-row: 3; text-align: right; padding-left: 215px; color: #8a7a60; font: italic 11.5px ${GARA}; }
.pl.th-diorama.in-room .end-title { color: #f5d36c; }

/* What you know: index cards lying on the counter in perspective, under a brass paperweight; pointing at one lifts it to read. */
.pl.th-diorama.in-room .facts { position: absolute; left: clamp(10px, 2.2vw, 44px); bottom: calc(28vh + 6px); width: clamp(190px, 14vw, 280px); perspective: 900px; z-index: 3; }
.pl.th-diorama.in-room .facts .journal-btn { position: relative; z-index: 3; display: flex; align-items: center; gap: 8px; margin: 0 0 -6px 18px; padding: 0; color: #f5d36c; text-decoration: none;
  font: 800 13px ${CINZ}; letter-spacing: .1em; text-transform: uppercase; text-shadow: 0 1px 2px #000, 0 0 8px #000; }
.pl.th-diorama.in-room .facts .journal-btn::before { content: ""; width: 54px; height: 34px; background: ${svgUrl(WEIGHT)} center / contain no-repeat; }
.pl.th-diorama.in-room .facts .journal { display: grid; margin: 0; padding: 0; list-style: none; background: none; box-shadow: none; transform: rotateX(46deg) rotateZ(-4deg); transform-origin: 50% 100%; transform-style: preserve-3d; }
.pl.th-diorama.in-room .facts .journal li { grid-area: 1 / 1; margin: 0; padding: 20px 10px 8px 20px; min-height: 74px; color: #2b170a; font: 400 15px/1.3 ${FELL}; background: ${PAPER};
  box-shadow: 0 3px 0 #d8c8a4, 0 10px 18px rgba(0,0,0,.55); translate: calc(var(--i, 0) * 16px) calc(var(--i, 0) * -10px); rotate: calc(var(--i, 0) * 3deg - 4deg); transition: transform .25s, translate .25s, rotate .25s; }
.pl.th-diorama.in-room .facts .journal li.used { color: #6a5a48; text-decoration: line-through rgba(168,35,27,.6); }
.pl.th-diorama.in-room .facts .journal li.empty { color: #6a5a48; font-style: italic; }
/* Open (the button, or pointing at the stack): the cards fan out flat enough to read. */
.pl.th-diorama.in-room .facts .journal.open { transform: rotateX(18deg) rotateZ(-2deg); grid-template-columns: 1fr; gap: 6px; }
.pl.th-diorama.in-room .facts .journal.open li { grid-area: auto; translate: 0 0; rotate: calc(var(--i, 0) * 1.2deg - 1deg); min-height: 0; padding: 10px 12px 10px 24px; }
.pl.th-diorama.in-room .facts .journal li:hover { transform: translateZ(40px) scale(1.04); z-index: 2; }
/* The moments: snapshots laid on the counter at the other end. */
.pl.th-diorama.in-room .moments { left: auto; right: clamp(10px, 2.2vw, 44px); bottom: calc(28vh + 6px); gap: 0; perspective: 900px; }
.pl.th-diorama.in-room .moments button { width: clamp(96px, 7.5vw, 140px); height: auto; aspect-ratio: 4 / 3.4; margin-left: -18px; border: 6px solid #fbf7ec; border-bottom-width: 20px; border-radius: 1px;
  transform: rotateX(30deg) rotateZ(-6deg); box-shadow: 0 10px 18px rgba(0,0,0,.6); }
.pl.th-diorama.in-room .moments button:nth-child(2n) { transform: rotateX(30deg) rotateZ(5deg) translateY(-8px); }
.pl.th-diorama.in-room .moments button:hover { transform: rotateX(0) scale(1.15) translateY(-14px); z-index: 2; }

/* A very wide screen shows less counter either side of the plaque: the cards and snapshots move in onto it. */
@media (min-aspect-ratio: 2/1) {
  .pl.th-diorama.in-room .facts { left: 19vw; width: clamp(190px, 10vw, 250px); }
  .pl.th-diorama.in-room .moments { right: 22vw; }
}

@media (max-width: 760px) {
  .pl.th-diorama.in-room .side { width: calc(100% - 12px); height: 50%; bottom: calc(6px + env(safe-area-inset-bottom)); padding: 36px 14px 8px; }
  .pl.th-diorama.in-room .title-row { left: 14px; bottom: 6px; }
  /* The plaque's peak is steep on a phone: the log starts below its shoulders; the switch gets its own line. */
  .pl.th-diorama.in-room .log { padding-top: 26px; -webkit-mask-image: linear-gradient(transparent 0, #000 34px); mask-image: linear-gradient(transparent 0, #000 34px); }
  .pl.th-diorama.in-room .hint { padding-left: 0; margin-bottom: 24px; text-align: left; font-size: 10px; }
  .pl.th-diorama.in-room .composer, .pl.th-diorama.in-room .actions, .pl.th-diorama.in-room .hint { grid-row: auto; }
  .pl.th-diorama.in-room .actions button { flex: 1; height: 36px; }
  .pl.th-diorama.in-room .mode button { font-size: 9.5px; padding: 3px 6px; }
  .pl.th-diorama.in-room .npc .prose { font-size: 16.5px; }
  .pl.th-diorama.in-room .foot { grid-template-columns: 1fr; }
  .pl.th-diorama.in-room .actions { grid-column: 1; grid-row: auto; flex-direction: row; }
  .pl.th-diorama.in-room .say { min-width: 72px; }
  .pl.th-diorama.in-room .facts { left: 8px; bottom: calc(50% + 10px); width: 118px; }
  .pl.th-diorama.in-room .facts .journal:not(.open) li:not(:first-child) { visibility: hidden; }
  .pl.th-diorama.in-room .facts .journal.open { width: min(300px, calc(100vw - 24px)); }
  .pl.th-diorama.in-room .facts .journal li { font-size: 11px; min-height: 56px; padding: 20px 6px 5px 16px; }
  /* No room for the paperweight beside the hourglass: the label is inked on the top card's head instead. */
  .pl.th-diorama.in-room .facts .journal-btn { margin: 0 0 -19px 16px; font-size: 9.5px; color: #8a2a1a; text-shadow: none; }
  .pl.th-diorama.in-room .facts .journal-btn::before { display: none; }
  .pl.th-diorama.in-room .moments { top: auto; bottom: calc(50% + 12px); right: 10px; }
  .pl.th-diorama.in-room .moments button { width: 54px; margin-left: -14px; border-width: 3px; border-bottom-width: 10px; }
  .pl.th-diorama.in-room .tell { top: 3%; left: 50%; max-width: 92%; font-size: 15px; }
}
`;

/** Lay the facts and the moments on the counter, and tell the room who to stand behind it and what the till shows. */
export function decorateRoom(ctx: ParleyThemeCtx): ParleyDecor {
  const bd = board();
  const fig = ctx.scene.querySelector(".fig") as HTMLElement | null;
  // What you know: the button and the list move out of the box onto the counter (the view keeps driving both).
  const facts = document.createElement("div");
  facts.className = "facts";
  const jb = ctx.side.querySelector(".journal-btn");
  const jl = ctx.side.querySelector(".journal");
  if (jb && jl) {
    facts.append(jb, jl);
    ctx.scene.append(facts);
  }
  const number = () => jl?.querySelectorAll("li").forEach((li, i) => (li as HTMLElement).style.setProperty("--i", String(i)));
  number();
  let lastUrl = "";
  let lastMood = "";
  const publishArt = () => {
    const on = ctx.scene.querySelector<HTMLImageElement>("img.face.on[src]") ?? ctx.scene.querySelector<HTMLImageElement>("img.face[src]");
    const url = on?.getAttribute("src") ? on.src : "";
    const framed = !!fig?.classList.contains("framed");
    const mood = fig ? ([...fig.classList].find((c) => c.startsWith("m-")) ?? "") : "";
    if (url === lastUrl && mood === lastMood && framed === bd.parley.framed) return;
    lastUrl = url;
    lastMood = mood;
    bd.parley = { ...bd.parley, url: url || null, framed, mood: mood ? mood.slice(2) : null, ver: bd.parley.ver + 1 };
  };
  const obs = new MutationObserver(publishArt);
  obs.observe(ctx.scene, { subtree: true, attributes: true, attributeFilter: ["src", "class"] });
  publishArt();
  const publishState = () => {
    const v = ctx.root.querySelector(".meter-value");
    const text = (v?.firstChild?.textContent ?? v?.textContent ?? "").trim();
    const m = /(-?\d[\d,]*)\s*(.*)/.exec(text);
    const pips = ctx.root.querySelectorAll(".patience .pip");
    const on = ctx.root.querySelectorAll(".patience .pip.on");
    const label = ctx.root.querySelector(".meter-label")?.textContent?.trim() || null;
    const role = ctx.root.querySelector(".plaque .role")?.textContent?.trim() || null;
    const title = ctx.root.querySelector(".kind")?.textContent?.trim() || null;
    bd.parley = {
      ...bd.parley,
      offer: m ? m[1]!.replace(/,/g, "") : null,
      unit: m ? m[2]!.trim() || null : null,
      label,
      role,
      title,
      patience: on.length,
      patienceMax: pips.length,
      ver: bd.parley.ver + 1,
    };
  };
  queueMicrotask(publishState);
  return {
    update() {
      publishState();
      publishArt();
      number();
    },
    destroy() {
      obs.disconnect();
      facts.remove();
      bd.parley = { url: null, framed: false, offer: null, unit: null, label: null, role: null, title: null, patience: 0, patienceMax: 0, mood: null, ver: bd.parley.ver + 1 };
    },
  };
}
