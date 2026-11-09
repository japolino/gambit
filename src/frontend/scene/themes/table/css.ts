/**
 * The Table theme's stylesheet. Layout positions are set in px from the
 * layout pass in ../table.ts (one source of truth with the projected
 * tabletop); this sheet owns materials, type, motion and states. It also
 * restyles the two host overlays (.gs > .fg class panel, .gs > .mw montage).
 */
import { BONE, INK, RED } from "./art.js";
import { speakerVars } from "../../../story-text.js";

/** Who speaks, in chalk on the stone and the baize: cream for anyone, mint for the player, then the cast. */
export const VOICES = speakerVars("#f7e7bf", "#9fe3cf", ["#8fcff2", "#f5a3b5", "#bfe596", "#d3b4f5", "#f8c27a", "#f3ee8a"]);
/** The same in ink, on the player's white cards: sepia for anyone, dark mint for the player, then the cast. */
export const CARD_VOICES = speakerVars("#5a3416", "#1d6b5a", ["#1f5f8a", "#9a2a4a", "#3f6b25", "#6a3fa0", "#a0600a", "#7a6a0a"]);

/** A brass frame with filigree corners, used as border-image for the overlays. */
function brassFrame(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe6a0"/><stop offset=".4" stop-color="#b07a26"/><stop offset=".7" stop-color="#5a3608"/><stop offset="1" stop-color="#d4a03c"/></linearGradient></defs>
  <rect x="3" y="3" width="90" height="90" fill="none" stroke="#000" stroke-width="6"/>
  <rect x="5" y="5" width="86" height="86" fill="none" stroke="url(#g)" stroke-width="7"/>
  <rect x="12" y="12" width="72" height="72" fill="none" stroke="#2a1804" stroke-width="2"/>
  ${[[0, 0, 1, 1], [96, 0, -1, 1], [0, 96, 1, -1], [96, 96, -1, -1]].map(([x, y, sx, sy]) => `<path d="M${x! + sx! * 2},${y! + sy! * 2} l${sx! * 26},0 q${-sx! * 4},${sy! * 10} ${-sx! * 14},${sy! * 10} q${-sx! * 2},${sy! * 2} 0,${sy! * 4} q${-sx! * 10},0 ${-sx! * 12},${sy! * 12} l0,0 Z" fill="url(#g)" stroke="#2a1804" stroke-width="1.5"/><circle cx="${x! + sx! * 9}" cy="${y! + sy! * 9}" r="3.5" fill="#ffe6a0" stroke="#2a1804"/>`).join("")}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function tableCss(tex: { felt: string; paper: string; page: string; leather: string }): string {
  const frame = brassFrame();
  return `
.tb { position: absolute; inset: 0; overflow: hidden; background: #030205; color: ${BONE}; font: 16px/1.4 "Gambit Garamond", "Palatino Linotype", Georgia, serif; -webkit-tap-highlight-color: transparent; }
.tb button { font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; }
.tb button:focus { outline: none; }
.tb [hidden] { display: none !important; }
.tb .L, .tb .st { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; will-change: transform; }
.tb .st > *, .tb .L > * { pointer-events: auto; }
.tb .glows > *, .tb .vig, .tb .shade { pointer-events: none !important; }

/* Layer 0: the place, pushed back into the dark. */
.tb .wl { overflow: hidden; }
.tb .wl > .world { inset: -5% -4% -2% -4%; filter: brightness(.4) contrast(1.25) saturate(.72) sepia(.3) blur(1.2px); }
.tb.delve .wl > .world { filter: brightness(.62) contrast(1.2) saturate(.8) sepia(.25); inset: -4%; }
.tb .shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(3,2,5,.88) 0%, rgba(3,2,5,.35) 30%, rgba(3,2,5,0) 48%), radial-gradient(ellipse 36% 46% at 50% 40%, rgba(255,140,60,.07), transparent 70%); }

/* Layer 1: the hanging scoreboard. */
.tb .board { position: absolute; transform: perspective(900px) rotateY(-12deg) rotateZ(1.5deg); transform-origin: 50% 46%; filter: brightness(1.2) drop-shadow(0 18px 22px rgba(0,0,0,.8)); }
.tb .board > svg { display: block; width: 100%; height: auto; }
.tb .board .amap { position: absolute; left: 14.9%; top: 56.9%; width: 69.7%; height: 21.8%; image-rendering: pixelated; }
.tb .board .thr { position: absolute; left: 0; width: 88%; margin-left: 12%; top: 84%; height: 16%; border-radius: 0; }

/* Layer 2: the people across the table. */
.tb .who { position: absolute; display: block; transform: translateX(-50%); transform-origin: 50% 100%; transition: filter .25s, transform .25s; filter: brightness(.55) contrast(1.1) sepia(.15) drop-shadow(-3px -1px 0 rgba(255,150,70,.35)) drop-shadow(0 0 2px #000) drop-shadow(0 16px 26px #000); }
.tb .who.s0 { filter: brightness(.86) contrast(1.08) sepia(.12) drop-shadow(-3px -1px 0 rgba(255,150,70,.5)) drop-shadow(0 0 2px #000) drop-shadow(0 16px 26px #000); }
.tb .who.l { transform: translateX(-50%) perspective(900px) rotateY(14deg) rotateZ(-2deg); }
.tb .who.r { transform: translateX(-50%) perspective(900px) rotateY(-14deg) rotateZ(2deg); }
.tb .who:hover, .tb .who:focus-visible { filter: brightness(1.02) contrast(1.06) sepia(.08) drop-shadow(-3px -1px 0 rgba(255,170,80,.75)) drop-shadow(0 0 2px #000) drop-shadow(0 16px 26px #000); }
.tb .who:focus-visible { filter: brightness(1.05) drop-shadow(0 0 3px #ffcf6a) drop-shadow(0 0 10px #ff8a24) drop-shadow(0 16px 26px #000); }
.tb .who > img { display: block; height: 100%; width: auto; user-select: none; -webkit-user-drag: none; }
.tb .who .arch { position: relative; height: 100%; aspect-ratio: 380 / 500; }
.tb .who .arch > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 15%; -webkit-mask: var(--arch) 0 0 / 100% 100% no-repeat; mask: var(--arch) 0 0 / 100% 100% no-repeat; }
.tb .who .arch > svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.tb .who[aria-disabled="true"] { cursor: default; }
.tb .chair { position: absolute; pointer-events: none !important; filter: drop-shadow(0 20px 30px #000); opacity: .9; }

/* Layer 3: the tabletop and what rests on it. */
.tb .tcv { position: absolute; display: block; pointer-events: none !important; }
.tb .prop { position: absolute; display: block; transition: transform .2s, filter .2s; filter: drop-shadow(0 6px 6px rgba(0,0,0,.6)); }
.tb .prop > svg { display: block; width: 100%; height: auto; overflow: visible; }
.tb button.prop:hover, .tb button.prop:focus-visible { transform: translateY(-4%) rotate(-1.5deg); filter: drop-shadow(0 0 2px #ffcf6a) drop-shadow(0 0 14px rgba(255,138,36,.75)) drop-shadow(0 10px 10px rgba(0,0,0,.6)); }
.tb .prop .lab { position: absolute; left: 50%; bottom: -1.2cqh; transform: translateX(-50%); white-space: nowrap; font: 800 max(10px, 1.25cqh)/1 "Gambit Cinzel", serif; letter-spacing: .22em; color: #d9b46a; text-shadow: 0 1px 0 #000, 0 0 6px #000, 0 0 12px #000; pointer-events: none; }
.tb .prop.on .lab { color: #ffe6a0; }
.tb .prop.on { filter: drop-shadow(0 0 3px #ffcf6a) drop-shadow(0 0 16px rgba(255,138,36,.8)); }
.tb .skull .fl { animation: tbFlame 1.6s ease-in-out infinite; transform-box: view-box; }
.tb .skull .fl.b { animation-duration: 1.25s; animation-delay: -.4s; }
.tb.busy .skull .fl { animation-duration: .45s; }
.tb.busy .bell { animation: tbShiver .9s ease-in-out infinite; }
@keyframes tbFlame { 0%,100% { transform: scale(1,1) skewX(0); } 25% { transform: scale(.94,1.1) skewX(3deg); } 50% { transform: scale(1.05,.92) skewX(-2deg); } 75% { transform: scale(.97,1.06) skewX(2deg); } }
@keyframes tbShiver { 0%,100% { transform: rotate(0); } 20% { transform: rotate(-3deg); } 40% { transform: rotate(3deg); } 60% { transform: rotate(-2deg); } }
.tb .tent { position: absolute; display: grid; place-items: center; transform: translateX(-50%); transition: transform .2s, filter .2s; filter: drop-shadow(0 4px 4px rgba(0,0,0,.7)); }
.tb .tent > svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.tb .tent > span { position: relative; font: 800 max(11px, 1.55cqh)/1 "Gambit Cinzel", serif; letter-spacing: .14em; color: ${INK}; text-transform: uppercase; margin-top: 6%; white-space: nowrap; }
.tb .tent:hover, .tb .tent:focus-visible { transform: translateX(-50%) translateY(-12%); filter: drop-shadow(0 0 2px #ffcf6a) drop-shadow(0 0 10px rgba(255,138,36,.8)); }
.tb .tent[aria-disabled="true"] { opacity: .7; cursor: default; }

/* The frontier map, spread out on the table. */
.tb .map { position: absolute; transform: perspective(900px) rotateY(13deg) rotateZ(-1.5deg); transform-origin: 0 50%; filter: brightness(1.45) contrast(1.05) drop-shadow(0 18px 20px rgba(0,0,0,.85)); }
.tb .map > .sheet { position: absolute; inset: 0; width: 100%; height: 100%; }
.tb .map > .hex { position: absolute; left: 5%; top: 8%; width: 82%; height: 84%; overflow: visible; }
.tb .hex polygon { stroke: #2a1c10; stroke-width: 1.2; transition: filter .15s; }
.tb .hex polygon.fog { fill: rgba(60,40,24,.35); stroke: rgba(42,28,16,.35); stroke-dasharray: 2 2; }
.tb .hex g.step, .tb .hex g.goto { cursor: pointer; }
.tb .hex g.step polygon { stroke: ${RED}; stroke-width: 2; stroke-dasharray: 4 2; }
.tb .hex g.goto polygon { stroke: #6a3a10; stroke-width: 2; }
.tb .hex g.here polygon { stroke: ${INK}; stroke-width: 3; }
.tb .hex g.step:hover polygon, .tb .hex g.goto:hover polygon, .tb .hex g:focus-visible polygon { filter: brightness(1.35); stroke-width: 3; }
.tb .hex g:focus { outline: none; }
.tb .hex g:focus-visible polygon { stroke: #ff8a24; }
.tb .hex circle.pin { fill: ${INK}; stroke: #e2d6bd; stroke-width: 1.5; }
.tb .hex circle.you { fill: ${RED}; stroke: ${INK}; stroke-width: 2.5; }
.tb .hex text { font: italic 10px "Gambit Fell", serif; fill: #1a0e06; paint-order: stroke; stroke: rgba(226,214,189,.8); stroke-width: 2.5px; pointer-events: none; }
.tb { --hex-plain: #b4a274; --hex-wood: #6c7444; --hex-hill: #9c8456; --hex-water: #4c6672; --hex-ruin: #84766a; }

/* Layer 4: candlelight and the dark around it. */
.tb .glow { position: absolute; border-radius: 50%; mix-blend-mode: screen; will-change: opacity, transform; }
.tb .glow.a { background: radial-gradient(circle, rgba(255,160,70,.42) 0%, rgba(255,110,30,.16) 35%, rgba(255,80,0,0) 70%); }
.tb .mote { position: absolute; width: var(--s); height: var(--s); border-radius: 50%; background: rgba(255,214,160,.85); box-shadow: 0 0 4px rgba(255,170,80,.9); opacity: 0; animation: tbMote var(--t) linear infinite; animation-delay: var(--d); }
@keyframes tbMote { 0% { transform: translate(0, 0); opacity: 0; } 15% { opacity: .75; } 70% { opacity: .5; } 100% { transform: translate(var(--dx), -22cqh); opacity: 0; } }
.tb .glow.c { background: radial-gradient(circle, rgba(255,170,90,.22) 0%, rgba(255,120,40,.08) 40%, rgba(255,80,0,0) 70%); }
.tb .glow.b { background: radial-gradient(circle, rgba(255,150,60,.2) 0%, rgba(255,100,20,.07) 45%, rgba(255,80,0,0) 70%); }
.tb .vig { position: absolute; inset: 0; background:
  linear-gradient(90deg, rgba(3,2,5,.96) calc(50% - var(--sw) * .52), rgba(3,2,5,.6) calc(50% - var(--sw) * .5), rgba(3,2,5,0) calc(50% - var(--sw) * .42), rgba(3,2,5,0) calc(50% + var(--sw) * .42), rgba(3,2,5,.6) calc(50% + var(--sw) * .5), rgba(3,2,5,.96) calc(50% + var(--sw) * .52)),
  radial-gradient(ellipse calc(var(--sw) * .7) 75% at 50% 44%, rgba(8,5,10,0) 40%, rgba(8,5,10,.45) 72%, rgba(3,2,5,.9) 100%); }

/* Layer 5: your hand of cards. */
.tb .fan { position: absolute; inset: 0; pointer-events: none; }
.tb .fan.scroll { pointer-events: auto; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
.tb .fan.scroll::-webkit-scrollbar { display: none; }
.tb .fan .rail { position: absolute; left: 0; top: 0; height: 100%; }
/*
 * Hit-testing never moves. The button and its face take no pointer events;
 * a fixed .hit strip does: the slice of the card the next one leaves showing
 * (--hw). If the button rose on hover, or a raised card's whole box or
 * enlarged face caught the pointer, cards would flicker and steal hover from
 * their neighbours. While hovered, the strip reaches up so the pointer can
 * follow the lifted card.
 */
.tb .card { position: absolute; left: 0; top: 0; width: var(--cw); height: var(--ch); pointer-events: none; transform-origin: 50% 100%; transform: translate(var(--x), var(--y)) rotate(var(--r)); transition: filter .2s; z-index: var(--z); filter: drop-shadow(-4px 8px 10px rgba(0,0,0,.75)); }
.tb .card .face { position: absolute; inset: 0; display: block; transform-origin: 50% 100%; transition: transform .24s cubic-bezier(.2,.8,.3,1.2); pointer-events: none; }
.tb .card .hit { position: absolute; left: 0; top: 0; bottom: 0; width: var(--hw, 100%); pointer-events: auto; }
.tb .card:hover .hit { top: calc(var(--lift) * -1 - 4%); }
.tb .card[aria-disabled="true"] .hit { cursor: default; }
.tb .card svg.cardart { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.tb .card:hover, .tb .card:focus-visible, .tb .card.sel { z-index: 80; filter: drop-shadow(0 0 3px #ffcf6a) drop-shadow(0 0 18px rgba(255,140,40,.75)) drop-shadow(0 16px 18px rgba(0,0,0,.8)); }
/* Straighten (undo the fan's tilt), rise and grow, in screen space. */
.tb .card:hover .face, .tb .card:focus-visible .face, .tb .card.sel .face { transform: rotate(calc(var(--r) * -1)) translateY(calc(var(--lift) * -1)) scale(1.12); }
.tb .fan.scroll .card:hover .face, .tb .fan.scroll .card:focus-visible .face { transform: rotate(calc(var(--r) * -1)) translateY(calc(var(--lift) * -.4)) scale(1.04); }
.tb .card .ttl { position: absolute; left: 7%; top: 4.2%; width: var(--tw, 86%); height: 18.5%; overflow: hidden; display: flex; flex-direction: column; justify-content: center; color: ${INK}; text-transform: uppercase; line-height: .95; pointer-events: none; }
.tb .card .ttl small { font: 800 calc(var(--ch) * .044)/1 "Gambit Cinzel", serif; letter-spacing: .1em; color: ${RED}; }
.tb .card .ttl b { font: 800 calc(var(--ch) * .074)/.95 "Gambit Cinzel", serif; letter-spacing: .02em; }
.tb .card .ttl.m b { font-size: calc(var(--ch) * .058); }
.tb .card .ttl.s b { font-size: calc(var(--ch) * .046); }
.tb .card:hover .ttl, .tb .card:focus-visible .ttl, .tb .card.sel .ttl { width: 86%; }
.tb .card .idx { position: absolute; right: 6%; bottom: 13%; font: 800 calc(var(--ch) * .05)/1 "Gambit Cinzel", serif; color: ${BONE}; text-shadow: 0 0 3px #000, 0 0 6px #000; opacity: 0; transition: opacity .2s; }
.tb .card:hover .idx, .tb .card:focus-visible .idx { opacity: .9; }
.tb.busy .card { filter: brightness(.7) drop-shadow(-4px 8px 10px rgba(0,0,0,.75)); }
.tb .card.fact .ftx { position: absolute; left: 17%; right: 9%; top: 27%; bottom: 8%; font: italic calc(var(--ch) * .056)/1.2 "Gambit Fell", serif; color: #1c120a; overflow: hidden; pointer-events: none; text-wrap: pretty; }
.tb .card.fact .ttl { width: 62%; }
.tb .card.fact .ttl small { color: #6a4a2a; }
.tb .card.fact .ttl b { font-size: calc(var(--ch) * .06); color: #7a0c10; }
.tb .card[aria-disabled="true"] { cursor: default; }
.tb .card[aria-disabled="true"] .face { filter: grayscale(.6) brightness(.8); }

/* The narration plaque over the middle of the hand. */
.tb .plaque { position: absolute; z-index: 70; pointer-events: auto; }
.tb .plaque > svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.tb .plaque .rib { position: absolute; left: 22%; right: 22%; top: 0; height: 18%; display: flex; align-items: center; justify-content: center; gap: .6em; font: 800 max(12px, 1.75cqh)/1 "Gambit Cinzel", serif; letter-spacing: .14em; color: #021a0e; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 1px 0 rgba(160,255,210,.5); }
.tb .plaque.peek .rib { color: #1a0204; }
.tb .plaque .rib .nw { font: 800 max(10px, 1.2cqh)/1 "Gambit Cinzel", serif; color: #fff2e0; background: ${RED}; padding: .3em .5em .2em; transform: rotate(-4deg); box-shadow: 0 0 0 2px #3a0406; }
.tb .plaque .ptx { position: absolute; left: 4.5%; right: 9%; top: 23%; bottom: 9%; overflow: hidden; font-size: max(13px, 1.95cqh); line-height: 1.38; color: #e8e4dc; display: flex; flex-direction: column; justify-content: center; gap: .15em; }
.tb .plaque.open .ptx { overflow-y: auto; justify-content: flex-start; scrollbar-width: thin; scrollbar-color: #4a4d55 transparent; }
.tb .plaque .desc { margin: 0 0 .2em; font-style: italic; color: #b9b2a6; }
.tb .plaque .log { margin: 0; padding: 0; list-style: none; }
.tb .plaque .log li { padding-left: 1.1em; position: relative; color: #a7a198; }
.tb .plaque .log li::before { content: ""; position: absolute; left: .2em; top: .55em; width: .38em; height: .38em; background: #6a6d75; transform: rotate(45deg); }
.tb .plaque .log li.now { color: #f4efe6; }
.tb .plaque .log li.now::before { background: #16b877; box-shadow: 0 0 6px #16b877; }
.tb .plaque:not(.open) .log li.old { display: none; }
.tb .plaque .busy { margin: .1em 0 0; color: #ffcf6a; font-style: italic; }
.tb .plaque .busy::after { content: "…"; display: inline-block; width: 1.2em; overflow: hidden; vertical-align: bottom; animation: tbDots 1.2s steps(4) infinite; clip-path: inset(0 100% 0 0); }
@keyframes tbDots { to { clip-path: inset(0 0 0 0); } }
.tb .plaque .tab { position: absolute; right: 1.6%; bottom: 12%; width: 6%; height: 54%; display: grid; place-items: center; font: 800 max(9px, 1.1cqh)/1 "Gambit Cinzel", serif; letter-spacing: .2em; writing-mode: vertical-rl; color: #9aa0aa; background: linear-gradient(90deg, #1c1e22, #2a2d33 40%, #121316); clip-path: polygon(0 6%, 30% 0, 100% 4%, 100% 96%, 30% 100%, 0 94%); }
.tb .plaque .tab:hover, .tb .plaque .tab:focus-visible { color: #fff; background: linear-gradient(90deg, #0e5a36, #16b877 40%, #0a3a24); }

/* Layer 6: your other hand, holding what you know. */
.tb .fgh { position: absolute; pointer-events: none; }
.tb .fgh > svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; overflow: visible; }
.tb .fgh > svg:last-of-type { z-index: 2; }
.tb .fgh .facts { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
.tb .fgh .empty { z-index: 1; }
.tb .fgh .card { transform-origin: 50% 92%; transform: translate(var(--x), var(--y)) rotate(var(--r)); }
.tb .fgh .card .face { transform-origin: 50% 92%; }
.tb .fgh .card:hover .hit { top: calc(var(--ch) * -.42); }
.tb .fgh .card:hover .face, .tb .fgh .card:focus-visible .face { transform: translateY(calc(var(--ch) * -.42)) scale(1.3); }
.tb .fgh .empty { position: absolute; left: 36%; top: 26%; width: 40%; transform: rotate(8deg); font: 800 max(12px, 1.7cqh)/1.15 "Gambit Cinzel", serif; letter-spacing: .08em; color: ${BONE}; padding: 1.4em 1em; background: #141518; clip-path: polygon(0 8%, 6% 0, 94% 4%, 100% 0, 98% 92%, 92% 100%, 4% 96%, 0 100%); text-align: center; pointer-events: none; box-shadow: inset 0 0 0 3px #3a3d45; }

/* The theme switcher: iron tags fanned out above the gavel. */
.tb .tags { position: absolute; z-index: 90; pointer-events: none; }
.tb .tags button { position: absolute; left: 0; top: 0; pointer-events: auto; display: grid; place-items: center; width: var(--tw); height: var(--th); transform: translate(var(--x), var(--y)) rotate(var(--r)); transition: transform .2s, filter .2s; filter: drop-shadow(0 6px 8px rgba(0,0,0,.8)); animation: tbDeal .3s ease both; animation-delay: var(--d); }
.tb .tags button > svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.tb .tags button > span { position: relative; font: 800 max(11px, 1.5cqh)/1 "Gambit Cinzel", serif; letter-spacing: .16em; color: #e8c070; text-transform: uppercase; }
.tb .tags button[aria-current="true"] > span { color: #fff2c0; text-shadow: 0 0 8px #ff8a24; }
.tb .tags button:hover, .tb .tags button:focus-visible { transform: translate(var(--x), calc(var(--y) - 8px)) rotate(var(--r)) scale(1.08); filter: drop-shadow(0 0 3px #ffcf6a) drop-shadow(0 0 12px rgba(255,138,36,.8)); }
@keyframes tbDeal { from { opacity: 0; transform: translate(var(--ox), var(--oy)) rotate(0) scale(.6); } }

/* The open ledger (Journal). */
.tb .book { position: absolute; z-index: 95; pointer-events: auto; animation: tbOpen .35s cubic-bezier(.2,.8,.3,1) both; filter: drop-shadow(0 30px 40px #000); }
.tb .book > svg { position: absolute; inset: 0; width: 100%; height: 100%; }
@keyframes tbOpen { from { opacity: 0; transform: perspective(1200px) rotateX(40deg) translateY(12%) scale(.85); } }
.tb .book .pg { position: absolute; top: 9%; bottom: 8%; overflow-y: auto; color: #2a1a0e; font-size: max(14px, 2.05cqh); line-height: 1.35; scrollbar-width: thin; scrollbar-color: #8a6a40 transparent; padding-right: .6em; }
.tb .book .pg.l { left: 6.5%; right: 54%; }
.tb .book .pg.r { left: 54%; right: 6.5%; }
.tb .book h2 { margin: 0 0 .3em; font: 800 max(20px, 3.2cqh)/1.05 "Gambit Cinzel", serif; letter-spacing: .06em; color: #5a0a0e; }
.tb .book h3 { margin: .9em 0 .3em; font: 800 max(12px, 1.6cqh)/1 "Gambit Cinzel", serif; letter-spacing: .2em; text-transform: uppercase; color: #7a0c10; border-bottom: 1.5px solid rgba(122,12,16,.35); padding-bottom: .25em; }
/* Ledger entries, not web bullets: an inked dash per entry, a box or a tick per step. */
.tb .book ul { margin: 0; padding-left: 0; list-style: none; }
.tb .book li { margin: .25em 0; padding-left: 1.3em; position: relative; }
.tb .book li::before { content: "—"; position: absolute; left: 0; color: #7a0c10; }
.tb .book li li::before { content: "☐"; font-size: .95em; color: #4a2a14; }
.tb .book li li.done::before { content: "✓"; color: #9c1419; font-weight: 800; }
.tb .book .muted { color: #6a5640; font-style: italic; }
.tb .book .done { text-decoration: line-through; text-decoration-color: rgba(122,12,16,.6); color: #6a5640; }
.tb .book .bond { color: #1a5a2a; }
/* Regard as ink tally strokes: the faint strokes are the scale, the inked ones how far it has gone. */
.tb .book .aff { display: inline-block; position: relative; width: 84px; height: 1em; margin: 0 .5em; vertical-align: -.15em; background: rgba(42,26,14,.18); transform: skewX(-16deg); -webkit-mask: repeating-linear-gradient(90deg, #000 0 3px, transparent 3px 8px); mask: repeating-linear-gradient(90deg, #000 0 3px, transparent 3px 8px); }
.tb .book .aff i { position: absolute; top: 0; bottom: 0; background: #2a160a; }
.tb .book .aff i.neg { background: #9c1419; }
.tb .book .goal { font: italic max(14px, 2cqh)/1.3 "Gambit Fell", serif; color: #3a1a0a; }
.tb .book .found li { font-family: "Gambit Fell", serif; }
/* Closing the ledger: a silk tab sticking out of the top edge, not a web close button. */
.tb .book .shut { position: absolute; right: 7%; top: -3.5%; height: 9%; padding: 0 1.1em 1.2em; display: grid; place-items: center; font: 800 max(10px, 1.2cqh)/1 "Gambit Cinzel", serif; letter-spacing: .22em; color: #f6e2c0; background: linear-gradient(90deg, #5a0a0e, #9c1419 30%, #b8242a 50%, #7a1015); clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 72%, 0 100%); filter: drop-shadow(0 4px 4px rgba(0,0,0,.6)); }
.tb .book .shut:hover, .tb .book .shut:focus-visible { color: #fff; filter: brightness(1.2) drop-shadow(0 0 8px #ff8a24); }
/* Candlelight falls across the open book from the skull on your left. */
.tb .book::after { content: ""; position: absolute; inset: 2% 1.5%; pointer-events: none; background: radial-gradient(ellipse 70% 80% at 18% 12%, rgba(255,190,110,.18), rgba(255,150,60,0) 55%), radial-gradient(ellipse 80% 90% at 95% 100%, rgba(10,4,2,.55), rgba(10,4,2,0) 60%); mix-blend-mode: multiply; }
.tb .book .pg { color: #2a160a; text-shadow: 0 0 .5px rgba(42,22,10,.6); }
.tb .book li { font-family: "Gambit Fell", serif; }
.tb .book h3::before { content: "❦  "; color: #9c1419; letter-spacing: 0; }

/* A card thrown onto the mat. */
.tb .fly { position: absolute; left: 0; top: 0; z-index: 99; pointer-events: none; }

/* Visible keyboard focus everywhere, shaped by drop-shadows rather than a box. */
.tb .plaque .tab:focus-visible { outline: 2px solid #ffcf6a; outline-offset: 2px; }

/* Phone / portrait. */
.tb.port .fgh { display: none; }
.tb.port .glow.b { opacity: .35 !important; }
.tb.port .board { transform: perspective(700px) rotateY(-8deg) rotateZ(1.5deg); }
.tb.port .prop .lab { font-size: max(9px, 1.25cqw * 2.2); bottom: -1.6cqh; }
.tb.port .plaque .ptx { font-size: max(12px, 3.3cqw); left: 5%; right: 12%; }
.tb.port .plaque .rib { font-size: max(11px, 3.2cqw); left: 18%; right: 18%; }
.tb.port .plaque .tab { width: 9%; }
.tb.port .book .pg.l { left: 7%; right: 12%; top: 7%; bottom: 7%; }

/* The class panel, restyled as the lid of the deck case: green baize in a brass frame. */
.gs > .fg { left: 50%; right: auto; top: 5%; bottom: 24%; width: min(640px, 94%); transform: translateX(-50%); border-radius: 0; border: 22px solid transparent; border-image: ${frame} 30 stretch; background: #0e1f17 url("${tex.felt}") center / 320px; box-shadow: 0 30px 60px #000, inset 0 0 60px rgba(0,0,0,.7); font: 15px/1.45 "Gambit Garamond", Georgia, serif; color: #efe6d2; }
.gs > .fg header { padding: 6px 6px 8px; border-bottom: 1px dashed rgba(232,192,112,.35); }
.gs > .fg header b { font: 800 22px/1 "Gambit Cinzel", serif; letter-spacing: .12em; color: #f2cf7a; text-transform: uppercase; }
.gs > .fg header .purse { font-family: "Gambit Fell", serif; color: #e8c070; }
.gs > .fg header .x { width: 34px; height: 34px; border-radius: 50%; color: #fff2e0; background: radial-gradient(circle at 40% 35%, #e0464a, #9c1419 60%, #4a0508); box-shadow: inset 0 0 0 2px rgba(58,4,6,.7); font: 800 18px/1 "Gambit Cinzel", serif; }
.gs > .fg nav { padding: 10px 4px 10px; gap: 6px; }
.gs > .fg nav button { border-radius: 0; border: 0; padding: 8px 14px 6px; font: 800 12px/1 "Gambit Cinzel", serif; letter-spacing: .14em; text-transform: uppercase; color: #2a1a0e; background: url("${tex.paper}") center / cover; clip-path: polygon(0 8%, 8% 0, 92% 4%, 100% 0, 98% 100%, 4% 96%); box-shadow: none; }
.gs > .fg nav button[aria-selected="true"] { color: #fff2e0; background: #7a1015; }
.gs > .fg .body { padding: 2px 6px 10px; scrollbar-width: thin; scrollbar-color: #8a6a30 transparent; }
.gs > .fg .cls { border-radius: 0; background: rgba(0,0,0,.22); border: 0; box-shadow: inset 0 0 0 1px rgba(232,192,112,.18); margin: 4px 0; }
.gs > .fg .cls.on { background: rgba(232,192,112,.12); box-shadow: inset 0 0 0 2px #c9a865; }
.gs > .fg .cls .pic, .gs > .fg .pending .pic { border-radius: 0; box-shadow: 0 0 0 2px #0d0b0e, 0 0 0 4px #b07a26; }
.gs > .fg .cls .nm { font: 800 14px/1.2 "Gambit Cinzel", serif; letter-spacing: .06em; color: #f2e6cc; }
.gs > .fg .tag { border-radius: 0; background: #7a1015; color: #fff2e0; font: 600 10px/1.6 "Gambit Cinzel", serif; letter-spacing: .1em; }
.gs > .fg .stars { color: #f2cf7a; }
.gs > .fg button.go { border-radius: 0; background: linear-gradient(180deg, #f6d58a, #b07a26 55%, #6a4008); color: #1b0e04; font: 800 12px/1.4 "Gambit Cinzel", serif; letter-spacing: .08em; box-shadow: 0 2px 0 #2a1804; }
.gs > .fg button.plain { border-radius: 0; background: rgba(0,0,0,.35); border: 1px solid rgba(232,192,112,.4); font-family: "Gambit Cinzel", serif; font-size: 12px; }
.gs > .fg button:focus-visible { outline: 2px solid #ffcf6a; outline-offset: 2px; }
.gs > .fg textarea, .gs > .fg select { border-radius: 0; background: rgba(0,0,0,.35); border-color: rgba(232,192,112,.45); }
.gs > .fg .pending, .gs > .fg .opt { border-radius: 0; border-color: #b07a26; background: rgba(0,0,0,.25); }
.gs > .fg .bar { border-radius: 0; } .gs > .fg .bar i { background: #16b877; }
.gs > .fg .sheet .sk { border-left-color: #9c1419; }

/* Meanwhile… : the house turns a card while you sleep. */
.gs > .mw { background: radial-gradient(ellipse 50% 50% at 50% 42%, rgba(60,24,10,.85), rgba(3,2,5,.98) 75%); }
.gs > .mw .mw-title { font: 800 54px/1 "Gambit Cinzel", serif; letter-spacing: .14em; text-transform: uppercase; color: #f2cf7a; text-shadow: 0 0 24px rgba(255,138,36,.6), 0 3px 0 #000; }
.gs > .mw .mw-art { border: 18px solid transparent; border-image: ${frame} 30 stretch; box-shadow: 0 24px 50px #000; filter: sepia(.25) contrast(1.1); }
.gs > .mw .mw-text { font: italic 24px/1.45 "Gambit Fell", serif; color: #efe6d2; }
.gs.table { ${VOICES} }
.gs > .mw .mw-text em, .tb .plaque .said em { font-style: normal; }
.gs > .mw .mw-dots i { background: rgba(242,207,122,.25); } .gs > .mw .mw-dots i.on { background: #f2cf7a; box-shadow: 0 0 8px #ff8a24; }
.gs > .mw .mw-hint { font: 800 12px/1 "Gambit Cinzel", serif; letter-spacing: .3em; color: #b8a47c; }

/* A fight or a talk staged at the table: only the room stays; the encounter draws its own hand over it. */
.tb.enc > :not(.wl):not(.vig) { display: none !important; }
.tb.enc .vig { background:
  linear-gradient(90deg, rgba(3,2,5,.8) 0, rgba(3,2,5,0) 12%, rgba(3,2,5,0) 88%, rgba(3,2,5,.8) 100%),
  radial-gradient(ellipse 80% 85% at 50% 42%, rgba(8,5,10,0) 52%, rgba(3,2,5,.75) 100%); }
/* The 3D table: the WebGL stage replaces the drawn table, props, people and board. */
.tb.x3 .tl, .tb.x3 .ol, .tb.x3 .gl, .tb.x3 .pl, .tb.x3 .sh, .tb.x3 .ol2, .tb.x3 .board { display: none !important; }
.tb.x3 .wl > .world { inset: 0; filter: none; }
.tb.x3 .vig { background:
  linear-gradient(90deg, rgba(3,2,5,.85) 0, rgba(3,2,5,0) 14%, rgba(3,2,5,0) 86%, rgba(3,2,5,.85) 100%),
  radial-gradient(ellipse 75% 80% at 50% 44%, rgba(8,5,10,0) 50%, rgba(3,2,5,.7) 100%); }
.tb.pointing { cursor: pointer; }
.tb .t3l { pointer-events: none; z-index: 1; }
.tb .tag3 { position: absolute; left: 0; top: 0; pointer-events: auto; padding: .45em .7em; font: 800 max(10px, 1.25cqh)/1 "Gambit Cinzel", serif; letter-spacing: .22em; text-transform: uppercase; color: #d9b46a; white-space: nowrap; text-shadow: 0 1px 0 #000, 0 0 6px #000, 0 0 12px #000; transition: opacity .2s, color .2s; will-change: transform; }
.tb .tag3 { opacity: 0; padding: .5em .8em .45em; letter-spacing: .14em; color: #1b0e04; text-shadow: none; background: linear-gradient(180deg, #f3e6c8, #d9c49a); border-radius: 2px; box-shadow: 0 0 0 1px #5a3a14, 0 4px 8px rgba(0,0,0,.8); margin-top: -.6em; }
.tb .tag3.on, .tb .tag3:focus-visible { opacity: 1; }
.tb .tag3:hover, .tb .tag3:focus-visible { opacity: 1; color: #000; box-shadow: 0 0 0 1px #5a3a14, 0 0 14px #ff8a24; }
.tb .tag3:focus-visible { outline: 2px solid #ffcf6a; outline-offset: 2px; }
.tb .tag3.who3 { background: none; box-shadow: none; opacity: 0; min-width: 12cqh; height: 5cqh; margin-top: -2.5cqh; }
.tb .tag3.who3:focus-visible { opacity: 1; color: transparent; text-shadow: none; }
.tb.zoomed .tag3 { opacity: 0 !important; pointer-events: none; }
.tb.zoomed .plaque, .tb.zoomed .tw { opacity: 0; pointer-events: none; }
/* The typewriter: black enamel and a gold line, behind your cards; up in front of them while you're at it. */
.tb .tb-tw { position: absolute; transition: opacity .3s; }
.tb .tb-tw:focus-within { z-index: 71; }
.tb.row .tw-page textarea { font-size: 16px; }
/* The story, on the stone. */
.tb .plaque.story .ptx { overflow-y: auto; justify-content: flex-start; scrollbar-width: thin; scrollbar-color: #4a4d55 transparent; }
.tb .plaque.story .ptx > * { flex: none; }
.tb .plaque .beat { margin-top: .5em; }
.tb .plaque .beat p { margin: 0 0 .22em; }
.tb .plaque .said { padding-left: .6em; border-left: 2px solid ${RED}; font-style: italic; color: #e2d3b4; }
.tb .plaque .roll { font: 800 .74em/1.3 "Gambit Cinzel", serif; letter-spacing: .08em; color: #ffcf6a; }
.tb .plaque .found { padding-left: .6em; border-left: 2px solid #16b877; color: #bfe8cf; }
.tb .plaque .told { color: #f4efe6; }
.tb:not(.row) .plaque:not(.open):not(.story) .ptx { top: 20%; bottom: 5%; line-height: 1.3; }
.tb:not(.row) .plaque:not(.open):not(.story) .rib { font-size: max(11px, 1.4cqh); }
/* The narration lies on the mat: tilted back into the table's perspective, pinned with two brass tacks. */
.tb.x3:not(.port):not(.row) .plaque:not(.open):not(.story) { transform: perspective(1100px) rotateX(14deg); transform-origin: 50% 100%; filter: drop-shadow(0 14px 12px rgba(0,0,0,.9)); }
.tb.x3 .plaque .ptx { color: #ece6d8; }
.tb.x3:not(.port):not(.row) .plaque .ptx { font-size: max(15px, 2.1cqh); }
.tb.x3 .plaque::before, .tb.x3 .plaque::after { content: ""; position: absolute; z-index: 2; top: 5.5%; width: max(9px, 1.1cqh); aspect-ratio: 1; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff2c0, #d8a040 45%, #5a3608 80%); box-shadow: 0 2px 3px rgba(0,0,0,.8); }
.tb.x3 .plaque::before { left: 21%; }
.tb.x3 .plaque::after { right: 21%; }
.tb .plaque { transition: opacity .3s; }
.tb .plaque .desc { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: none; }
.tb .peek { position: absolute; z-index: 92; left: 55%; top: 14%; width: min(460px, 40%); min-height: 28%; pointer-events: auto; animation: tbOpen .3s ease both; filter: drop-shadow(0 20px 30px #000); }
.tb .peek > svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.tb .peek .pk { position: relative; padding: 13% 9% 8%; }
.tb .peek h3 { margin: 0 0 .5em; font: 800 max(15px, 2.4cqh)/1.1 "Gambit Cinzel", serif; letter-spacing: .08em; color: #f2cf7a; text-transform: uppercase; }
.tb .peek p { margin: 0 0 1em; font-size: max(13px, 1.9cqh); line-height: 1.4; color: #e8e4dc; }
.tb .peek .pa { display: flex; flex-wrap: wrap; gap: .6em; }
.tb .peek button { padding: .55em 1em .45em; font: 800 max(11px, 1.35cqh)/1 "Gambit Cinzel", serif; letter-spacing: .14em; text-transform: uppercase; color: #1b0e04; background: linear-gradient(180deg, #f6d58a, #b07a26 55%, #6a4008); clip-path: polygon(0 10%, 5% 0, 95% 5%, 100% 0, 98% 100%, 3% 94%); }
.tb .peek button.pkx { color: #e8c070; background: #1a1c20; }
.tb .peek button:hover, .tb .peek button:focus-visible { filter: brightness(1.2) drop-shadow(0 0 6px #ff8a24); }
.tb.port .peek { left: 4%; width: 92%; top: 6%; }

/* A phone, either way up: labels in real px (the cards are sized to hold them), whole cards in a row that scrolls. */
.tb .more { display: none; }
.tb.row .more.on { display: grid; position: absolute; z-index: 69; width: 30px; place-items: center; font: 800 28px/1 "Gambit Fell", serif; color: #ffe6a0; text-shadow: 0 0 6px #000; background: linear-gradient(90deg, rgba(0,0,0,0), rgba(0,0,0,.8)); pointer-events: none; }
.tb.row .fgh { display: none; }
.tb.row .fan.scroll { touch-action: pan-x; overscroll-behavior: contain; }
.tb.row .card { filter: drop-shadow(0 3px 4px rgba(0,0,0,.75)); }
.tb.row .card .ttl { left: 4%; right: 4%; width: auto; top: 3%; height: auto; min-height: 30%; padding: 3px 3px 4px; gap: 1px; overflow: visible; text-align: center; background: #e8dcc4; box-shadow: 0 1px 0 ${INK}; line-height: 1.05; }
.tb.row .card .ttl small { font-size: 12px; line-height: 1.05; letter-spacing: 0; }
.tb.row .card .ttl b, .tb.row .card .ttl.m b, .tb.row .card .ttl.s b { font-size: 13px; line-height: 1.08; letter-spacing: 0; }
.tb.row .card .ttl.s b { font-size: 12px; }
.tb.row .card .idx { display: none; }
.tb.row .card.fact .ttl { left: 4%; right: 4%; width: auto; min-height: 0; padding: 3px 6px; background: #efe6d2; box-shadow: none; text-align: left; }
.tb.row .card.fact .ttl b { font-size: 13px; }
.tb.row .card.fact .ftx { left: 8%; right: 5%; top: 32%; bottom: auto; font: italic 13px/1.22 "Gambit Fell", serif; text-align: left; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4; }
.tb.row .plaque .rib { left: 14%; right: 14%; font-size: 13px; letter-spacing: .08em; }
.tb.row .plaque .ptx { left: 4.5%; right: 48px; top: 21%; bottom: 7%; font-size: 15px; line-height: 1.3; justify-content: flex-start; overflow-y: auto; touch-action: pan-y; overscroll-behavior: contain; }
.tb.row .plaque .desc { white-space: normal; overflow: visible; }
.tb.row .plaque .tab { right: 1.5%; top: 21%; bottom: 7%; width: 40px; height: auto; font-size: 12px; letter-spacing: .1em; }
/* No pointer to hover with: the room's working props say what they are, and are big enough to hit. */
.tb.row .tag3:not(.dim):not(.who3) { opacity: 1; font-size: 0; padding: 8px 9px 7px; letter-spacing: 0; margin-top: -6px; }
.tb.row .tag3:not(.dim):not(.who3)::before { content: attr(data-short); font: 800 12px/1 "Gambit Cinzel", serif; letter-spacing: .04em; }
.tb.row .tag3:not(.who3)::after { content: ""; position: absolute; inset: -9px -2px; }
.tb.row:has(.plaque.open) .tag3 { display: none; }
.tb.row .tag3.who3 { min-width: 96px; height: 44px; margin-top: -22px; }
.tb.row .book .shut { font-size: 12px; letter-spacing: .08em; }
.tb.row .tags button > span { font-size: 12px; letter-spacing: .08em; }

@media (prefers-reduced-motion: reduce) {
  .tb .skull .fl, .tb .mote, .tb.busy .bell, .tb .tags button, .tb .book, .tb .plaque .busy::after { animation: none !important; }
  .tb .card, .tb .card .face, .tb .who, .tb .prop, .tb .plaque { transition: none !important; }
}
`;
}
