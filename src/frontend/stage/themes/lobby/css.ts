/**
 * The Lobby battle HUD's stylesheet (a DOM layer over the Pixi canvas, inside the stage host). `--u` is one
 * design pixel of the 1920x1080 grid (geom.ts); a party card sizes its insides by `--k`, one unit of its
 * 250x364 frame. Structure and light only: every visible object is SVG from ./art.ts and the scene's art.
 */
import { CINZEL as CAPS, GARAMOND as SERIF } from "../shared.js";

const U = (n: number) => `calc(var(--u) * ${n})`;
const K = (n: number) => `calc(var(--k) * ${n} * var(--tk))`;
const SHADOW = "0 2px 4px #000, 0 0 10px #000, 0 0 2px #000";
const STAR = "polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%)";
const DIAMOND = "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)";

export const HUD_CSS = `
.lbb { position: absolute; inset: 0; pointer-events: none; z-index: 2; color: #F3E8D2; font: 500 16px/1.3 ${SERIF}; font-feature-settings: "lnum"; --tk: 1; transition: opacity .22s ease; -webkit-user-select: none; user-select: none; }
.lbb.ph { --tk: 1.3; }
.lbb.cut { opacity: 0; }
.lbb button { font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; text-align: center; }
.lbb button:focus-visible { outline: 2px dashed rgba(245,225,164,.9); outline-offset: 4px; }
.lbb .art { display: block; width: 100%; height: 100%; overflow: visible; }

/* ---------- The hall's light over the fight ---------- */
.lbb .sh { position: absolute; inset: 0;
  background:
    linear-gradient(90deg, rgba(8,6,4,.88) 0%, rgba(8,6,4,.3) 9%, rgba(8,6,4,0) 20%),
    linear-gradient(270deg, rgba(8,6,4,.7) 0%, rgba(8,6,4,0) 12%),
    linear-gradient(0deg, rgba(6,5,4,.96) 0%, rgba(6,5,4,.7) 18%, rgba(6,5,4,0) 44%),
    linear-gradient(180deg, rgba(6,5,4,.85) 0%, rgba(6,5,4,0) 18%),
    radial-gradient(ellipse 75% 85% at 50% 42%, rgba(0,0,0,0) 52%, rgba(0,0,0,.55) 100%); }
.lbb .warm { position: absolute; inset: 0; mix-blend-mode: screen; background: radial-gradient(ellipse 34% 40% at 6% 104%, rgba(214,150,80,.2), rgba(214,150,80,0)), radial-gradient(ellipse 30% 36% at 96% 104%, rgba(214,150,80,.16), rgba(214,150,80,0)); }
.lbb .dust { position: absolute; inset: 0; width: 100%; height: 100%; mix-blend-mode: screen; }

/* ---------- Title cartouche and the subtitle ---------- */
.lbb .ttl { position: absolute; display: flex; align-items: center; transform-origin: 0 0; }
.ttl .cr { position: relative; z-index: 2; width: ${U(100)}; height: ${U(100)}; flex: none; }
.ttl .rib { margin-left: ${U(-30)}; padding: ${U(8)} ${U(90)} ${U(8)} ${U(46)}; background: linear-gradient(90deg, rgba(14,12,10,.92) 0%, rgba(14,12,10,.7) 55%, rgba(14,12,10,0) 100%); }
.ttl .rib b { display: block; font: 800 ${U(31)}/1.05 ${CAPS}; letter-spacing: .04em; color: #F5E8C7; text-shadow: ${SHADOW}; white-space: nowrap; }
.ttl .rib svg { display: block; width: ${U(320)}; height: ${U(10)}; margin: ${U(5)} 0 ${U(4)}; overflow: visible; }
.ttl .rib span { display: block; font: 700 ${U(14)}/1 ${SERIF}; letter-spacing: .2em; text-transform: uppercase; color: #b8a27a; text-shadow: 0 1px 2px #000; white-space: nowrap; }
.lbb.ph .ttl .cr { width: ${U(52)}; height: ${U(52)}; }
.lbb.ph .bb-card .turn { display: none; }
.lbb.ph .ttl .rib { padding: ${U(4)} ${U(40)} ${U(4)} ${U(36)}; }
.lbb.ph .ttl .rib b { font-size: ${U(20)}; }
.lbb.ph .ttl .rib svg { display: none; }
.lbb.ph .ttl .rib span { font-size: ${U(11)}; margin-top: ${U(2)}; }
.lbb .sub { position: absolute; display: flex; justify-content: center; align-items: center; pointer-events: none; }
.lbb .sub p { margin: 0; padding: ${U(8)} ${U(80)}; font: italic 500 ${U(25)}/1.25 ${SERIF}; color: #F5E8C7; text-shadow: ${SHADOW}; white-space: nowrap; opacity: 0;
  background: linear-gradient(90deg, rgba(10,8,6,0), rgba(10,8,6,.8) 20%, rgba(10,8,6,.8) 80%, rgba(10,8,6,0)); }
.lbb .sub p::before, .lbb .sub p::after { content: ""; display: block; height: 1px; margin: 0 ${U(-40)}; background: linear-gradient(90deg, rgba(223,193,131,0), rgba(223,193,131,.75) 30%, rgba(223,193,131,.75) 70%, rgba(223,193,131,0)); }
.lbb .sub p::before { margin-bottom: ${U(6)}; } .lbb .sub p::after { margin-top: ${U(6)}; }
.lbb .sub p.show { animation: bbSub 5.5s ease forwards; }
.lbb.rm .sub p.show { animation: none !important; opacity: 1; }
.lbb .sub p em { font-style: normal; font-family: ${CAPS}; font-weight: 800; font-size: .8em; letter-spacing: .08em; color: #DFC183; }
.lbb .sub p.hurt em.n { color: #ffb48a; }
.lbb.ph .sub p { font-size: ${U(14)}; padding: ${U(4)} ${U(30)}; }
@keyframes bbSub { 0% { opacity: 0; transform: translateY(${U(6)}); } 7%, 82% { opacity: 1; transform: none; } 100% { opacity: 0; } }

/* ---------- Party cards ---------- */
.bb-card { position: absolute; left: 0; top: 0; pointer-events: none; will-change: transform; }
.bb-card.tgt { pointer-events: auto; cursor: pointer; }
.bb-card .fr, .bb-card .ws { position: absolute; inset: 0; transition: filter .3s; }
.bb-card.on .fr { filter: drop-shadow(0 0 ${K(3)} rgba(255,226,160,.95)) brightness(1.12); }
.bb-card:not(.on):not(.dead) .ws { opacity: 1; }
.bb-card.on .ws { opacity: .45; }
.bb-card.dead .fr { filter: grayscale(.8) brightness(.55); }
.bb-card .nm { position: absolute; display: flex; align-items: center; justify-content: center; padding: 0 6%; font: 800 ${K(21)}/1 ${CAPS}; letter-spacing: .08em; text-transform: uppercase; color: #F5E8C7; text-shadow: 0 1px 2px #000, 0 0 10px rgba(0,0,0,.8); white-space: nowrap; }
.bb-card.on .nm { color: #FFE7AE; }
.bb-card .hp { position: absolute; border-radius: 999px; overflow: hidden; }
.bb-card .hp i, .bb-ep .hp i { position: absolute; left: 0; top: 0; bottom: 0; display: block; }
.bb-card .hp .gh, .bb-ep .hp .gh { background: #f1d9b0; opacity: .6; }
.bb-card .hp .fl, .bb-ep .hp .fl { background: linear-gradient(180deg, #ffb48a 0%, #d8503a 38%, #8f2219 78%, #4a0d08 100%); box-shadow: inset 0 1px 0 rgba(255,236,210,.45); }
.bb-card .hp .sh, .bb-ep .hp .sh { top: auto; height: 26%; background: linear-gradient(90deg, #9fd8ff, #e8f6ff); }
.bb-card .hp .num { position: absolute; right: 5%; top: 50%; transform: translateY(-52%); font: 800 ${K(17)}/1 ${CAPS}; color: #fff6e0; text-shadow: 0 1px 2px #000, 0 0 4px #000, 0 0 8px #000; }
.bb-card .hp .num small { font-size: .62em; color: #d8c49a; margin-left: .1em; }
.bb-card .fo { position: absolute; overflow: hidden; }
.bb-card .fo .fl { display: block; height: 100%; background: linear-gradient(180deg, #d6f2ff 0%, #6fb6d8 45%, #23506a 100%); }
.bb-card .res { position: absolute; display: flex; align-items: center; justify-content: space-between; gap: ${K(6)}; }
.bb-card .res > span:first-child { font: 700 ${K(12.5)}/1 ${SERIF}; letter-spacing: .22em; text-transform: uppercase; color: #b8a27a; white-space: nowrap; }
.bb-card .res .studs { display: flex; gap: ${K(3)}; align-items: center; }
.bb-card .res .studs > i { width: ${K(18)}; height: ${K(18)}; clip-path: ${STAR}; background: #3a3127; }
.bb-card .res .studs > i.on { background: radial-gradient(circle at 40% 35%, #fff6d0 0%, #f0c86a 40%, #a87a2a 80%); }
.bb-card .res em { position: relative; display: block; width: ${K(110)}; height: ${K(6)}; background: #0b0907; }
.bb-card .res em i { position: absolute; left: 0; top: 0; bottom: 0; background: #e2b65c; }
.bb-card .sts { position: absolute; display: flex; flex-direction: column; gap: ${K(5)}; align-items: center; }
.bb-st { position: relative; display: block; width: ${U(30)}; height: ${U(30)}; flex: none; }
.bb-card .bb-st { width: ${K(30)}; height: ${K(30)}; }
.bb-st svg { display: block; width: 100%; height: 100%; filter: drop-shadow(0 2px 2px #000); }
.bb-st b { position: absolute; inset: 0; display: grid; place-items: center; font: 800 calc(var(--u) * 13)/1 ${CAPS}; color: #fff; text-shadow: 0 1px 2px #000, 0 0 3px #000; }
.bb-card .bb-st b { font-size: ${K(13)}; }
.bb-st small { position: absolute; right: -12%; bottom: -12%; font: 800 calc(var(--u) * 11)/1 ${CAPS}; color: #F5E8C7; text-shadow: 0 1px 2px #000, 0 0 3px #000; }
.bb-card .brk { position: absolute; inset: -3.5%; opacity: 0; transition: opacity .2s; }
.bb-card.tgt .brk { opacity: 1; animation: bbPulse .9s ease-in-out infinite alternate; }
.bb-card.tgt:hover .brk, .bb-card.tgt:focus-visible .brk { filter: drop-shadow(0 0 ${K(8)} rgba(127,209,199,.9)); }
.bb-card .turn { position: absolute; left: 50%; bottom: calc(100% + ${K(20)}); transform: translateX(-50%); opacity: 0; transition: opacity .25s; white-space: nowrap; }
.bb-card.on .turn { opacity: 1; }
.bb-card .turn span { display: block; padding: ${K(5)} ${K(18)}; font: 800 ${K(13)}/1 ${CAPS}; letter-spacing: .24em; text-transform: uppercase; color: #1E160B; background: linear-gradient(180deg, #fff2c2, #d9b464 45%, #8c6224); clip-path: polygon(8% 0, 92% 0, 100% 50%, 92% 100%, 60% 100%, 50% 140%, 40% 100%, 8% 100%, 0 50%); filter: drop-shadow(0 2px 3px #000); }
.bb-card .fallen { position: absolute; left: 0; right: 0; top: 34%; display: flex; justify-content: center; opacity: 0; }
.bb-card.dead .fallen { opacity: 1; }
.bb-card .fallen span { padding: ${K(6)} ${K(20)}; font: 800 ${K(22)}/1 ${CAPS}; letter-spacing: .2em; text-transform: uppercase; color: #f0c8b8; background: linear-gradient(90deg, rgba(42,6,4,0), rgba(42,6,4,.92) 18%, rgba(42,6,4,.92) 82%, rgba(42,6,4,0)); text-shadow: 0 1px 2px #000; transform: rotate(-8deg); }

/* ---------- Skills ---------- */
.bb-menu { position: absolute; pointer-events: none; }
.bb-menu .col { position: absolute; right: 0; bottom: ${U(4)}; display: flex; flex-direction: column; align-items: flex-end; gap: ${U(10)}; }
.bb-menu.ph .col { left: 0; align-items: center; gap: ${U(4)}; }
.bb-menu .hd { position: relative; margin-right: ${U(10)}; display: flex; align-items: baseline; justify-content: flex-end; gap: ${U(18)}; white-space: nowrap; }
.bb-menu .hd b { font: 800 ${U(40)}/1 ${CAPS}; letter-spacing: .05em; color: #F5E8C7; text-shadow: ${SHADOW}, 0 0 18px rgba(223,193,131,.3); }
.bb-menu .hd span { font: 700 ${U(15)}/1 ${SERIF}; letter-spacing: .26em; text-transform: uppercase; color: #c8aa6e; text-shadow: ${SHADOW}; }
.bb-menu .row { position: relative; display: flex; align-items: flex-end; gap: var(--gap); }
.bb-sk { pointer-events: auto; position: relative; width: var(--sn); display: flex; flex-direction: column; align-items: center; }
.bb-sk.sig { width: var(--ss); }
.bb-sk .md { position: relative; display: block; width: var(--dn); height: var(--dn); transition: transform .18s cubic-bezier(.22,1,.36,1), filter .18s; }
.bb-sk.sig .md { width: var(--ds); height: var(--ds); }
.bb-sk:not(.off):hover .md, .bb-sk:not(.off):focus-visible .md { transform: translateY(${U(-8)}) scale(1.05); filter: drop-shadow(0 0 ${U(16)} rgba(255,206,120,.85)); }
.bb-sk:not(.off):active .md { transform: scale(.95); }
.bb-sk.off { cursor: not-allowed; }
.bb-sk.off .md { filter: grayscale(.8) brightness(.48) contrast(.9); }
.bb-sk .lock { position: absolute; top: calc(var(--dn) * .3); left: 50%; width: calc(var(--dn) * .3); height: calc(var(--dn) * .345); transform: translateX(-50%); }
.bb-sk.sig .lock { top: calc(var(--ds) * .33); }
.bb-sk .md .sun { transform-origin: 100px 100px; animation: bbSpin 60s linear infinite; }
.bb-sk .md .glint { transform-origin: 150px 40px; animation: bbGlint 3.2s ease-in-out infinite; }
.bb-sk .key { position: absolute; z-index: 2; top: calc(var(--dn) * -.07); left: 50%; width: calc(var(--fit) * ${U(30)}); height: calc(var(--fit) * ${U(30)}); transform: translateX(-50%); }
.bb-sk.sig .key { top: calc(var(--ds) * -.12); }
.bb-sk .md { z-index: 1; }
.bb-sk .halo { position: absolute; z-index: 0; top: calc(var(--dn) * -.32 - ${U(14)}); left: 50%; width: calc(var(--dn) * 1.64); height: calc(var(--dn) * 1.64); transform: translateX(-50%); pointer-events: none; }
.bb-sk.sig .halo { top: calc(var(--ds) * -.32 - ${U(14)}); width: calc(var(--ds) * 1.64); height: calc(var(--ds) * 1.64); }
.bb-sk .halo .art { animation: bbSpin 30s linear infinite; }
.bb-sk.sel .md { transform: translateY(${U(-14)}) scale(1.06); filter: drop-shadow(0 0 ${U(18)} rgba(255,206,120,.9)); }
.bb-menu[data-mode="target"] .bb-sk:not(.sel):not(.off) .md { filter: brightness(.72); }
.lbb .bb-sk:focus-visible, .lbb .bb-tg:focus-visible, .lbb .bb-card:focus-visible { outline: none; }
.bb-sk .tip { position: absolute; z-index: 5; bottom: calc(100% + ${U(16)}); left: 50%; transform: translateX(-50%); width: ${U(300)}; padding: ${U(12)} ${U(16)}; font: italic 500 ${U(17)}/1.3 ${SERIF}; color: #F3E8D2; text-align: center; background: rgba(10,8,6,.95); box-shadow: 0 0 0 1px #b68d40, 0 0 0 3px #1c1308, 0 0 0 4px rgba(245,225,164,.5), 0 12px 24px #000; opacity: 0; pointer-events: none; transition: opacity .15s; }
.bb-sk:hover .tip, .bb-sk:focus-visible .tip { opacity: 1; }
.bb-menu.ph .bb-sk .tip { display: none; }
.bb-menu .hd.aim { align-items: center; gap: ${U(14)}; }
.bb-menu .hd.aim .rb { position: relative; display: flex; align-items: baseline; gap: ${U(16)}; padding: ${U(10)} ${U(56)}; isolation: isolate; }
.bb-menu .hd.aim .rb .bgp { position: absolute; inset: 0; z-index: -1; }
.bb-menu .hd.aim .rb b { font-size: ${U(28)}; color: #FFE7AE; }
.bb-menu .hd.aim .rb i { font: italic 600 ${U(19)}/1 ${SERIF}; color: #e8dcc0; text-shadow: ${SHADOW}; }
.bb-menu .hd.aim button { position: relative; pointer-events: auto; height: ${U(46)}; padding: 0 ${U(30)}; display: grid; place-items: center; transition: transform .15s; }
.bb-menu .hd.aim button .pa { position: absolute; inset: 0; }
.bb-menu .hd.aim button b { position: relative; font: 800 ${U(16)}/1 ${CAPS}; letter-spacing: .14em; text-transform: uppercase; color: #F5E8C7; text-shadow: 0 1px 2px #000; }
.bb-menu .hd.aim .cf b { color: #FFE2A8; }
.bb-menu .hd.aim button:hover, .bb-menu .hd.aim button:focus-visible { outline: none; transform: translateY(${U(-2)}); filter: drop-shadow(0 0 ${U(10)} rgba(255,206,120,.7)); }
.bb-menu.ph .hd.aim { flex-wrap: wrap; justify-content: center; gap: ${U(6)}; }
.bb-menu.ph .hd.aim .rb { padding: ${U(6)} ${U(30)}; }
.bb-menu.ph .hd.aim .rb b { font-size: ${U(15)}; } .bb-menu.ph .hd.aim .rb i { font-size: ${U(12)}; }
.bb-menu.ph .hd.aim button { height: ${U(34)}; padding: 0 ${U(18)}; } .bb-menu.ph .hd.aim button b { font-size: ${U(11)}; }
.bb-sk .pl { position: relative; width: 116%; min-height: calc(var(--fit) * ${U(50)}); padding: calc(var(--fit) * ${U(9)}) 0; margin-top: calc(var(--fit) * ${U(-14)}); display: grid; place-items: center; }
.bb-sk .pl .pa { position: absolute; inset: 0; }
.bb-sk .pl b { position: relative; max-width: 80%; text-align: center; font: 800 calc(var(--fit) * ${U(16)})/1.08 ${CAPS}; letter-spacing: .05em; text-transform: uppercase; color: #F5E8C7; text-shadow: 0 1px 2px #000; }
.bb-sk.sig .pl b { color: #FFE2A8; font-size: calc(var(--fit) * ${U(17)}); }
.bb-sk .pl.two b { font-size: calc(var(--fit) * ${U(14)}); }
.bb-sk .cost, .bb-sk .why { margin-top: calc(var(--fit) * ${U(5)}); min-height: calc(var(--fit) * ${U(18)}); font: 700 calc(var(--fit) * ${U(14)})/1.15 ${SERIF}; letter-spacing: .16em; text-transform: uppercase; color: #e1cd9e; text-shadow: ${SHADOW}; }
.bb-sk .why { letter-spacing: .02em; text-transform: none; font-style: italic; font-weight: 600; font-size: calc(var(--fit) * ${U(16)}); color: #f0a08a; }
.bb-sk .sg { position: absolute; top: calc(var(--ds) * .82); left: 50%; transform: translateX(-50%); padding: ${U(3)} ${U(12)}; font: 800 calc(var(--fit) * ${U(11)})/1 ${CAPS}; letter-spacing: .26em; text-transform: uppercase; color: #ffe2c8; background: linear-gradient(180deg, #8f2219, #4a0d08); box-shadow: 0 0 0 1px #c8aa6e, 0 2px 4px #000; white-space: nowrap; }
.bb-menu.ph .hd b { font-size: ${U(20)}; }
.bb-menu.ph .hd span { font-size: ${U(10)}; }
.bb-menu.ph .bb-sk .pl { height: auto; min-height: ${U(34)}; margin-top: ${U(-6)}; }
.bb-menu.ph .bb-sk .pl b { font-size: ${U(10.5)}; line-height: 1.05; max-width: 92%; }
.bb-menu.ph .bb-sk .pl .pa { top: 10%; bottom: 10%; }
.bb-menu.ph .bb-sk .cost, .bb-menu.ph .bb-sk .why { font-size: ${U(10)}; letter-spacing: .06em; }
.bb-menu.ph .bb-sk .sg { display: none; }
.bb-menu .wait { position: absolute; inset: 0; display: grid; place-items: center; }
.bb-menu .wait b { font: 800 ${U(64)}/1 ${CAPS}; letter-spacing: .12em; text-transform: uppercase; color: #FFE7AE; text-shadow: ${SHADOW}, 0 0 30px rgba(255,190,100,.55); }
.bb-menu.ph .wait b { font-size: ${U(30)}; }

/* ---------- Turn order ---------- */
.bb-order { position: absolute; pointer-events: none; }
.bb-order .rl { position: absolute; left: 0; top: 0; }
.bb-order .rl svg { display: block; width: 100%; height: 100%; }
.bb-order .lk { position: absolute; pointer-events: auto; transition: left .3s cubic-bezier(.22,1,.36,1); }
.bb-order .lk b { position: absolute; top: 100%; left: 50%; transform: translateX(-50%); margin-top: ${U(2)}; font: 800 ${U(16)}/1 ${CAPS}; letter-spacing: .08em; color: #F5E1A4; white-space: nowrap; text-shadow: ${SHADOW}; }
.bb-order .lk.foe b { color: #ffb8a4; }

/* ---------- Enemy plates and target reticles ---------- */
.bb-ep { position: absolute; left: 0; top: 0; width: calc(var(--pw, 260) * var(--u)); height: ${U(64)}; margin-left: calc(var(--pw, 260) * var(--u) / -2); pointer-events: none; will-change: transform; transition: opacity .3s; }
.lbb.ph .bb-ep { width: calc(var(--pw, 260) * var(--u) * .62); height: ${U(40)}; margin-left: calc(var(--pw, 260) * var(--u) * -.31); }
.bb-ep .bg { position: absolute; inset: 0; }
.bb-ep b { position: absolute; left: 13%; right: 13%; top: 0; height: 68.75%; display: grid; place-items: center; font: 800 ${U(17)}/1 ${CAPS}; letter-spacing: .07em; text-transform: uppercase; color: #F5E8C7; white-space: nowrap; text-shadow: 0 1px 2px #000; }
.lbb.ph .bb-ep b { display: block; line-height: ${U(27)}; text-align: center; overflow: hidden; text-overflow: ellipsis; font-size: ${U(10)}; letter-spacing: .03em; }
.lbb.ph .bb-ep .po i { width: ${U(9)}; height: ${U(9)}; }
.bb-ep.act b { color: #ffcf9a; }
.bb-ep .hp { position: absolute; left: 15.6%; width: 68.8%; top: 79.5%; height: 15.6%; border-radius: 999px; overflow: hidden; background: #0b0907; }
.bb-ep .po { position: absolute; top: 100%; left: 50%; transform: translateX(-50%); margin-top: ${U(5)}; display: flex; gap: ${U(4)}; }
.bb-ep .po i { width: ${U(13)}; height: ${U(13)}; clip-path: ${DIAMOND}; background: #3a3127; }
.bb-ep .po i.on { background: radial-gradient(circle at 40% 35%, #fff6d0, #e2c27a 45%, #8a6421); }
.bb-ep.broken .po i { background: #ffe2a0; opacity: .5; }
.bb-ep .bk { position: absolute; top: 100%; left: 50%; transform: translateX(-50%); margin-top: ${U(3)}; font: 800 ${U(13)}/1 ${CAPS}; letter-spacing: .24em; color: #ffe2a0; text-shadow: ${SHADOW}; }
.bb-ep .sts { position: absolute; left: 100%; top: ${U(6)}; margin-left: ${U(4)}; display: flex; gap: ${U(3)}; }
.lbb .bb-tg { position: absolute; left: 0; top: 0; width: ${U(170)}; height: ${U(170)}; margin: ${U(-85)} 0 0 ${U(-85)}; pointer-events: auto; will-change: transform; }
.lbb.ph .bb-tg { width: ${U(110)}; height: ${U(110)}; margin: ${U(-55)} 0 0 ${U(-55)}; }
.bb-tg .r1 { transform-origin: 100px 100px; animation: bbSpin 24s linear infinite; }
.bb-tg .r2 { transform-origin: 100px 100px; animation: bbSpin 14s linear infinite reverse; }
.bb-tg:hover .art, .bb-tg:focus-visible .art { filter: drop-shadow(0 0 ${U(10)} rgba(255,140,110,.9)); }
.bb-tg span { position: absolute; top: 100%; left: 50%; transform: translateX(-50%); white-space: nowrap; padding: ${U(3)} ${U(14)}; font: 800 ${U(14)}/1 ${CAPS}; letter-spacing: .14em; text-transform: uppercase; color: #ffe2d6; background: linear-gradient(90deg, rgba(42,6,4,0), rgba(42,6,4,.9) 20%, rgba(42,6,4,.9) 80%, rgba(42,6,4,0)); text-shadow: 0 1px 2px #000; opacity: 0; transition: opacity .15s; }
.bb-tg:hover span, .bb-tg:focus-visible span { opacity: 1; }
.bb-tg { transition: opacity .15s; }
.marks:has(.bb-tg:hover, .bb-tg:focus-visible) .bb-tg:not(:hover):not(:focus-visible) { opacity: .55; }

/* ---------- Phones: real text in real rows. Nothing under 12px, nothing to tap under 44 ---------- */
.lbb.ph .warm, .lbb.ph .sh { opacity: .75; }
.lbb.ph .ttl { max-width: calc(100% - 16px); }
.lbb.side .ttl { display: none; }
.lbb.ph .ttl .cr { width: ${U(26)}; height: ${U(26)}; }
.lbb.ph .ttl .rib { display: flex; align-items: baseline; gap: ${U(8)}; margin-left: ${U(-8)}; padding: ${U(3)} ${U(16)} ${U(3)} ${U(14)}; }
.lbb.ph .ttl .rib b { font-size: max(15px, ${U(16)}); }
.lbb.ph .ttl .rib span { margin: 0; font-size: max(12px, ${U(13)}); letter-spacing: .02em; text-transform: none; color: #cdb88f; }
.lbb.ph .sub p { max-width: 100%; box-sizing: border-box; padding: ${U(2)} ${U(16)}; font-size: max(13px, ${U(15)}); line-height: 1.2; text-align: center; white-space: normal; }
.lbb.ph .sub p em { font-size: max(12px, .85em); }
.lbb.ph .sub p::before, .lbb.ph .sub p::after { margin-left: 0; margin-right: 0; }
.lbb.ph .sub p::before { margin-bottom: 2px; } .lbb.ph .sub p::after { margin-top: 2px; }

/* A party member: a window on their face, their name across its foot, then HP, focus and the class resource as a panel. */
.lbb.ph .bb-card { --pn: ${U(48)}; box-shadow: inset 0 0 0 1px #8c6d36, 0 2px 6px rgba(0,0,0,.6); }
.lbb.ph .bb-card::before { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: var(--pn); background: linear-gradient(180deg, #17120c, #0c0a07); box-shadow: 0 -1px 0 #8c6d36; }
.lbb.ph .bb-card.on { box-shadow: inset 0 0 0 2px #FFE2A8, 0 0 12px rgba(255,214,140,.65); }
.lbb.ph .bb-card .fr, .lbb.ph .bb-card .ws, .lbb.ph .bb-card .glow { display: none; }
.lbb.ph .bb-card.dead { box-shadow: inset 0 0 0 1px #4a3c28; }
.lbb.ph .bb-card .nm { left: 2px !important; width: auto !important; right: 2px; top: auto !important; bottom: var(--pn); height: auto !important; padding: 1px 2px; justify-content: center; font-size: max(12px, ${U(12)}); letter-spacing: 0; line-height: 1.1; overflow: hidden; background: linear-gradient(0deg, rgba(10,8,6,.92), rgba(10,8,6,.55) 75%, rgba(10,8,6,0)); }
.lbb.ph .bb-card .hp { left: 4px !important; right: 4px; width: auto !important; top: auto !important; bottom: calc(var(--pn) - ${U(20)}); height: ${U(17)} !important; border-radius: 2px; background: #2a0f0a; box-shadow: inset 0 0 0 1px rgba(200,170,110,.5); }
.lbb.ph .bb-card .hp .num { right: 4px; font-size: max(12px, ${U(13)}); }
.lbb.ph .bb-card .hp .num small { font-size: max(12px, ${U(12)}); color: #f0e0bc; }
.lbb.ph .bb-card .fo { left: 4px !important; right: 4px; width: auto !important; top: auto !important; bottom: calc(var(--pn) - ${U(25)}); height: ${U(3)} !important; background: #0b0907; }
.lbb.ph .bb-card .res { left: 4px !important; right: 4px; width: auto !important; top: auto !important; bottom: 3px; height: ${U(16)} !important; gap: 3px; }
.lbb.ph .bb-card .res > span:first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; font-size: max(12px, ${U(13)}); letter-spacing: 0; text-transform: none; color: #cdb88f; }
.lbb.ph .bb-card .res .studs { flex: 0 1 auto; min-width: 0; gap: 1px; }
.lbb.ph .bb-card .res .studs > i { flex: 0 1 ${U(11)}; width: ${U(11)}; min-width: 4px; height: ${U(11)}; }
.lbb.ph .bb-card .res em { width: ${U(44)}; height: 5px; }
.lbb.ph .bb-card .sts { left: auto !important; right: 3px; top: 3px !important; width: auto !important; height: auto !important; flex-direction: row; gap: 1px; }
.lbb.ph .bb-card .bb-st { width: ${U(20)}; height: ${U(20)}; }
.lbb.ph .bb-card .bb-st b { font-size: max(12px, ${U(12)}); }
.lbb.ph .bb-st small { font-size: 12px; }
.lbb.ph .bb-card .brk { inset: -2px; }
.lbb.ph .bb-card .fallen { top: 12%; }
.lbb.ph .bb-card .fallen span { padding: 2px 8px; font-size: max(13px, ${U(14)}); letter-spacing: .04em; transform: none; }

/* Skills: a heading, then rows of two, the signature across both. The medallion stays as the row's icon. */
.bb-menu.ph .col { inset: 0; gap: ${U(4)}; align-items: stretch; }
.bb-menu.ph .hd { flex: none; margin: 0; justify-content: flex-start; align-items: baseline; gap: ${U(8)}; white-space: nowrap; }
.bb-menu.ph .hd b { font-size: max(15px, ${U(16)}); text-shadow: none; }
.bb-menu.ph .hd span { font-size: max(12px, ${U(13)}); letter-spacing: .02em; text-transform: none; text-shadow: none; }
.bb-menu.ph .row { flex: 1 1 0; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-auto-rows: minmax(${U(50)}, auto); align-content: start; align-items: stretch; gap: ${U(4)}; overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; pointer-events: auto; }
.bb-menu.ph .bb-sk, .bb-menu.ph .bb-sk.sig { width: auto; display: grid; grid-template-columns: ${U(38)} minmax(0, 1fr); grid-template-rows: auto auto; column-gap: ${U(5)}; align-content: center; align-items: start; padding: ${U(3)} ${U(5)} ${U(3)} ${U(3)}; text-align: left; background: linear-gradient(180deg, rgba(34,26,16,.96), rgba(16,12,8,.96)); box-shadow: inset 0 0 0 1px rgba(200,170,110,.6); }
.bb-menu.ph .bb-sk.sig { grid-column: 1 / -1; box-shadow: inset 0 0 0 1.5px #DFC183; }
.bb-menu.ph:not(.many) .bb-sk.off { background: rgba(14,11,8,.92); box-shadow: inset 0 0 0 1px rgba(120,100,70,.5); }
.bb-menu.ph .bb-sk .md, .bb-menu.ph .bb-sk.sig .md, .bb-menu.ph .bb-sk.sel .md, .bb-menu.ph .bb-sk:not(.off):hover .md, .bb-menu.ph .bb-sk:not(.off):focus-visible .md { grid-column: 1; grid-row: 1 / span 2; align-self: center; width: ${U(38)}; height: ${U(38)}; transform: none; }
.bb-menu.ph .bb-sk .lock, .bb-menu.ph .bb-sk.sig .lock { left: ${U(14)}; top: 50%; width: ${U(14)}; height: ${U(16)}; transform: translateY(-50%); z-index: 2; }
.bb-menu.ph .bb-sk .key, .bb-menu.ph .bb-sk .halo { display: none; }
.bb-menu.ph .bb-sk .pl { grid-column: 2; grid-row: 1; width: auto; min-height: 0; margin: 0; padding: 0; display: block; }
.bb-menu.ph .bb-sk .pl .pa { display: none; }
.bb-menu.ph .bb-sk .pl b, .bb-menu.ph .bb-sk.sig .pl b, .bb-menu.ph .bb-sk .pl.two b { display: block; width: 100%; max-width: none; margin: 0; text-align: left; font-size: max(13px, ${U(14)}); line-height: 1.08; letter-spacing: 0; text-transform: none; text-shadow: none; }
.bb-menu.ph .bb-sk .cost, .bb-menu.ph .bb-sk .why { grid-column: 2; grid-row: 2; margin: 1px 0 0; min-height: 0; font-size: max(13px, ${U(14)}); line-height: 1.1; letter-spacing: 0; text-transform: none; text-shadow: none; }
.bb-menu.ph .bb-sk.off .pl b { color: #b8a68a; }
.bb-menu.ph .bb-sk.sel { box-shadow: inset 0 0 0 2px #FFE2A8, 0 0 10px rgba(255,214,140,.55); }
/* Choosing a target: what you're aiming and what to do, Back and Confirm at thumb size; the others stay in the list below. */
.bb-menu.ph .hd.aim { flex-wrap: nowrap; justify-content: flex-start; align-items: stretch; gap: ${U(4)}; white-space: normal; }
.bb-menu.ph .hd.aim .rb { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; gap: 1px; padding: 0 ${U(6)}; background: rgba(14,11,8,.92); box-shadow: inset 0 0 0 1px rgba(200,170,110,.6); }
.bb-menu.ph .hd.aim .rb .bgp { display: none; }
.bb-menu.ph .hd.aim .rb b { font-size: max(13px, ${U(14)}); line-height: 1.1; }
.bb-menu.ph .hd.aim .rb i { font-size: max(13px, ${U(13)}); line-height: 1.1; text-shadow: none; }
.bb-menu.ph .hd.aim button { flex: none; height: 46px; min-width: 66px; padding: 0 ${U(10)}; background: linear-gradient(180deg, #2c2214, #17110a); box-shadow: inset 0 0 0 1.5px #DFC183; }
.bb-menu.ph .hd.aim button .pa { display: none; }
.bb-menu.ph .hd.aim button b { font-size: 13px; letter-spacing: .03em; }
.bb-menu.ph[data-mode="target"] .bb-sk:not(.sel):not(.off) .md { filter: none; }
.bb-menu.ph[data-mode="target"] .bb-sk.off { display: none; }

/* Foes: their names in the readable face, with room for them on the plate. */
.lbb.ph .bb-ep b { left: 9%; right: 9%; font: 700 max(13px, ${U(14)})/${U(27)} ${SERIF}; letter-spacing: 0; text-transform: none; }
.lbb.ph .bb-ep .bk { font-size: max(12px, ${U(12)}); letter-spacing: .06em; }
.lbb.ph .bb-ep .sts { left: auto; right: 0; top: 100%; margin: ${U(2)} 0 0; }
.lbb.ph .bb-ep .bb-st b { font-size: 12px; }
.lbb.ph .bb-ep .bb-st { width: ${U(20)}; height: ${U(20)}; }
.lbb.ph .bb-tg span { font-size: 13px; letter-spacing: .03em; opacity: 1; }

@keyframes bbSpin { to { transform: rotate(360deg); } }
@keyframes bbPulse { from { opacity: .55; } to { opacity: 1; } }
@keyframes bbGlint { 0%, 100% { opacity: .2; transform: scale(.6); } 50% { opacity: 1; transform: scale(1.1); } }
.lbb.rm *, .lbb.rm *::before { animation: none !important; transition: none !important; }
`;
