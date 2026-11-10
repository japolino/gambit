/**
 * The Lobby theme's Parley: a gacha story scene in the hall's dark-academia gold and ink. The person you talk to
 * stands tall left of centre in the place's painting, the open astrolabe halo turning behind their head and the
 * window light falling across them, their name on an obsidian-glass plaque across their chest (as the hall's lead
 * stands in the scene). The haggle is a brass balance at the top right (their price in coins on one pan, your
 * purse on the other; the beam tips as the deal moves), with the fare engraved beside it and patience as amber
 * jewels hanging under it; the deal itself hangs from the balance on chains, as brass plaques. The talk runs in a
 * tall brass-rimmed dialogue box along the bottom, in large type; what you know is a readable list of dossier
 * slips in the box's right-hand column (click one to cite it), the moments are prints in brass mounts on the
 * wall, and the line you write is sent by a brass Say (the scene's Write, so the two read as one game).
 *
 * The view's side panel, header and footer are dissolved (`display: contents`) so their pieces sit where a story
 * scene puts them; every control stays the view's own element, reachable by keyboard. Scoped `.pl.th-lobby`.
 */
import type { ParleyTheme } from "./types.js";
import { GARA, CINZ } from "../style.js";
import { VOICES } from "../../scene/themes/lobby/css.js";
import { defs as lobbyDefs, halo, rays } from "../../scene/themes/lobby/art.js";
import { moteSprite, parchment } from "../../scene/themes/lobby/tex.js";
import { balanceRig, chainBg, choiceBg, crest, dialogFrame, dieBg, jewelBg, loupeIcon, maskIcon, pedestal, printBg, quillBg, sealBg } from "./lobby/art.js";

const SHADOW = "0 2px 4px #000, 0 0 10px #000, 0 0 2px #000";
const SR = "position: absolute !important; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;";

const css = (paper: string) => `
.pl.th-lobby { display: block; --p-font: 500 18px/1.45 ${GARA}; --p-ui: ${CINZ}; --p-prose: ${GARA};
  --p-ink: #F3E8D2; --p-dim: #b8a27a; --p-faint: #8a7a5c; --p-soft: #d8c9a8; --p-em: #E3CC8A;
  --p-accent: #DFC183; --p-accent-ink: #1E160B; --p-hot: #FFE2A8; --p-edge: rgba(200,170,110,.45); --p-rule: rgba(200,170,110,.2);
  --p-scene: #0E0C0A; --p-well: rgba(8,6,4,.72); --p-bubble: transparent; --p-sunk: rgba(8,6,4,.6); --p-track: #090706;
  --p-fill: linear-gradient(180deg, #ffe7a8, #d9b464 45%, #8c6224); --p-radius: 0; --p-bubble-radius: 0; --p-text-shadow: ${SHADOW};
  --p-die: #d9b464; --p-die-ink: #1E160B; --p-die-kept: #FFE2A8;
  /* The dialogue box, anchored right so a wide window keeps readable lines; the person stands at --hx. */
  --bxr: 3%; --bxw: min(83%, 1560px); --bxl: calc(100% - var(--bxr) - var(--bxw)); --bxb: 2.4%; --bxh: 30%;
  --hx: 27%;
  background: #0E0C0A; font-feature-settings: "lnum"; }
.th-lobby .side, .th-lobby .head, .th-lobby .foot { display: contents; }
.th-lobby .scene { position: absolute; inset: 0; }

/* ---------- The place, graded like the hall, and its light ---------- */
.th-lobby .plate-canvas, .th-lobby .plate-img { filter: saturate(.74) sepia(.22) brightness(.8) contrast(1.06); }
.th-lobby .vignette { background:
    linear-gradient(90deg, rgba(8,6,4,.9) 0%, rgba(8,6,4,.3) 10%, rgba(8,6,4,0) 22%),
    linear-gradient(270deg, rgba(8,6,4,.75) 0%, rgba(8,6,4,0) 16%),
    linear-gradient(0deg, rgba(6,5,4,.95) 0%, rgba(6,5,4,.72) 22%, rgba(6,5,4,0) 48%),
    linear-gradient(180deg, rgba(6,5,4,.85) 0%, rgba(6,5,4,0) 18%),
    radial-gradient(ellipse 50% 70% at var(--hx) 34%, rgba(214,150,80,.14), rgba(0,0,0,0) 70%),
    radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 35%, rgba(8,6,4,.6) 80%, rgba(5,4,3,.9) 100%); }
.th-lobby .lp-rays { position: absolute; left: -6%; top: 0; width: 70%; height: 100%; pointer-events: none; mix-blend-mode: screen; opacity: .55; animation: lpRays 9s ease-in-out infinite; }
.th-lobby .art { display: block; width: 100%; height: 100%; overflow: visible; }
.th-lobby .lp-dust { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; mix-blend-mode: screen; }
.th-lobby .lp-glow { position: absolute; left: var(--hx); top: -12%; width: 60%; aspect-ratio: 1.1; translate: -50% 0; pointer-events: none; mix-blend-mode: screen; background: radial-gradient(closest-side, rgba(255,214,150,.26), rgba(255,190,110,.07) 55%, rgba(0,0,0,0)); }
.th-lobby .lp-halo { position: absolute; left: var(--hx); top: -5%; height: 66%; aspect-ratio: 1; translate: -50% 0; pointer-events: none; opacity: .9; }
.th-lobby .lp-halo .hl1 { transform-origin: 240px 240px; animation: lpSpin 240s linear infinite; }
.th-lobby .lp-halo .hl2 { transform-origin: 240px 240px; animation: lpSpin 160s linear infinite reverse; }
.th-lobby .lp-halo .flare { transform-origin: 240px 16px; animation: lpFlare 4s ease-in-out infinite; }
@keyframes lpSpin { to { transform: rotate(360deg); } }
@keyframes lpRays { 0%, 100% { opacity: .5; } 50% { opacity: .62; } }
@keyframes lpFlare { 0%, 100% { opacity: .5; transform: scale(.7); } 50% { opacity: 1; transform: scale(1.1); } }

/* ---------- The person, standing tall left of centre ---------- */
.th-lobby .figure { left: calc(var(--hx) - 34%); right: auto; width: 68%; height: 97%; bottom: -1%; }
.th-lobby .face { filter: drop-shadow(-3px -2px 4px rgba(255,214,150,.45)) drop-shadow(0 20px 30px rgba(0,0,0,.85)) saturate(.95) sepia(.06); }
.th-lobby .fig.framed { height: 90%; margin-bottom: 0; aspect-ratio: 3 / 4; background: none; border-radius: 0; }
.th-lobby .fig.framed .face { object-fit: cover; object-position: var(--face, 50% 20%); border-radius: 0; box-shadow: none;
  filter: drop-shadow(-3px -2px 5px rgba(255,214,150,.4)) saturate(.95) sepia(.06);
  -webkit-mask-image: radial-gradient(ellipse 50% 58% at 50% 42%, #000 58%, transparent 100%), linear-gradient(180deg, transparent 0, #000 12%, #000 60%, transparent 94%);
  -webkit-mask-composite: source-in; mask-image: radial-gradient(ellipse 50% 58% at 50% 42%, #000 58%, transparent 100%), linear-gradient(180deg, transparent 0, #000 12%, #000 60%, transparent 94%); mask-composite: intersect; }
.th-lobby .fig.framed::after { display: none; }
.th-lobby .silhouette { color: rgba(223,193,131,.6); font-family: ${CINZ}; background: radial-gradient(60% 40% at 50% 22%, rgba(223,193,131,.16), rgba(14,12,10,.85) 70%); }

/* ---------- Their name, across their chest on obsidian glass ---------- */
.th-lobby .plaque { left: var(--hx); translate: -50% 0; translate: round(-50%, 1px) 0; bottom: 37%; z-index: 6; min-width: 420px; max-width: min(640px, 46%); padding: 14px 70px 17px; text-align: center; isolation: isolate; text-shadow: none; }
.th-lobby .plaque .lp-tab { position: absolute; inset: 0; z-index: -1; }
.th-lobby .plaque .who { font: 800 32px/1.05 ${CINZ}; letter-spacing: .1em; text-transform: uppercase; color: #F5E8C7; text-shadow: 0 1px 3px #000, 0 0 14px rgba(223,193,131,.35); }
.th-lobby .plaque .role { margin-top: 7px; font: 700 12.5px/1.3 ${GARA}; letter-spacing: .14em; text-transform: uppercase; color: #DFC183; opacity: 1; }
.th-lobby .tell { left: 60%; top: 12%; max-width: min(36%, 560px); font: italic 500 24px/1.35 ${GARA}; color: #F5E8C7; text-shadow: ${SHADOW}; }

/* ---------- The dialogue box (its frame drawn by decorate at its real size) ---------- */
.th-lobby .lp-box { position: absolute; left: var(--bxl); right: var(--bxr); bottom: var(--bxb); height: var(--bxh); z-index: 3; pointer-events: none; }
.th-lobby .log { position: absolute; z-index: 4; left: calc(var(--bxl) + 46px); right: calc(var(--bxr) + 46px); top: calc(100% - var(--bxb) - var(--bxh) + 26px); bottom: calc(var(--bxb) + 92px); padding: 16px 8px 18px 0 !important; gap: 12px; }
.th-lobby .setting { font: italic 500 17px/1.4 ${GARA}; color: #a69272; }
.th-lobby .speaker { font: 800 13px/1.3 ${CINZ}; letter-spacing: .2em; text-transform: uppercase; color: #DFC183; margin-bottom: 3px; }
.th-lobby .npc .prose { font: 500 22px/1.42 ${GARA}; color: #FFF6E5; text-shadow: 0 1px 2px #000; }
.th-lobby .npc .prose em { color: #c7b89e; }
.th-lobby .you { align-self: stretch; max-width: none; position: relative; padding: 0 0 0 44px; background: none; border: 0; }
.th-lobby .you::before { content: ""; position: absolute; left: 6px; top: 2px; width: 28px; height: 28px; background: ${quillBg()} center / contain no-repeat; }
.th-lobby .you .speaker { text-align: left; color: #FFE2A8; }
.th-lobby .you .prose { font: italic 500 19px/1.4 ${GARA}; color: #d8c9a8; }
.pl.th-lobby { ${VOICES} }
.th-lobby .you .prose em { font-style: normal; }
.th-lobby .read { border-left: 0; padding: 2px 0 2px 44px; position: relative; }
.th-lobby .die { width: 46px; height: 46px; clip-path: none; background: ${dieBg(false)} center / contain no-repeat; font: 800 16px/1 ${CINZ}; color: #e8dcc0; text-shadow: 0 1px 2px #000; padding-top: 3px; }
.th-lobby .die.kept { background-image: ${dieBg(true)}; color: #1E160B; text-shadow: 0 1px 0 rgba(255,246,214,.6); transform: scale(1.12); box-shadow: none; filter: drop-shadow(0 0 8px rgba(255,210,122,.55)); }
.th-lobby .die.nat20 { background-color: transparent; filter: drop-shadow(0 0 14px rgba(255,226,140,.95)); }
.th-lobby .die.nat1 { background-color: transparent; color: #ffd6cc; filter: drop-shadow(0 0 8px rgba(196,84,74,.9)); }
.th-lobby .result { font: 800 14px ${CINZ}; letter-spacing: .2em; }
.th-lobby .r-crit_success { color: #FFE2A8; } .th-lobby .r-success { color: #c8e0a0; } .th-lobby .r-partial { color: #DFC183; } .th-lobby .r-fail { color: #a8a08e; } .th-lobby .r-crit_fail { color: #f0806c; }
.th-lobby .imm { font: italic 500 18px/1.4 ${GARA}; color: #E3CC8A; }
.th-lobby .trn { font: 14px/1.45 ${GARA}; color: #cfc0a0; }
.th-lobby .tier { border-radius: 0; font: 700 11px ${CINZ}; letter-spacing: .12em; border-color: rgba(200,170,110,.5); }
.th-lobby .why summary { color: #DFC183; }
.th-lobby .status { position: absolute; z-index: 5; right: calc(var(--bxr) + 46px); bottom: calc(var(--bxb) + 88px); max-width: 60%; font: italic 500 16px ${GARA}; color: #cfc0a0; text-shadow: ${SHADOW}; }
.th-lobby .composer { position: absolute; z-index: 5; left: calc(var(--bxl) + 38px); right: calc(var(--bxr) + 38px); bottom: calc(var(--bxb) + 18px); height: 64px; grid-template-columns: 1fr 72px; gap: 18px; align-items: center; }
.th-lobby .composer textarea { height: 54px; border: 0; border-radius: 0; background: rgba(6,5,4,.55); box-shadow: inset 0 2px 10px rgba(0,0,0,.8), inset 0 -1px 0 rgba(223,193,131,.4); padding: 13px 16px; font: italic 500 19px/1.35 ${GARA}; color: #F5E8C7; }
.th-lobby .composer textarea:focus { outline: none; box-shadow: inset 0 2px 10px rgba(0,0,0,.8), inset 0 -2px 0 #FFE2A8; }
.th-lobby .composer textarea::placeholder { color: #8a7a5c; }
.th-lobby .say { width: 72px; height: 72px; padding: 0; border-radius: 50%; background: ${sealBg()} center / contain no-repeat; font: 800 14px/1 ${CINZ}; letter-spacing: .14em; text-transform: uppercase; color: #1E160B; text-shadow: 0 1px 0 rgba(255,246,214,.6); filter: drop-shadow(0 6px 8px rgba(0,0,0,.7)); transition: transform .15s, filter .15s; }
.th-lobby .say:hover:not(:disabled), .th-lobby .say:focus-visible { outline: none; transform: scale(1.06) rotate(-6deg); filter: drop-shadow(0 0 12px rgba(255,206,120,.75)); }
/* Who voices the replies stays for screen readers; the scene does not print it. */
.th-lobby .hint { ${SR} }

/* ---------- The view mode as two engraved bosses on the box's top rail ---------- */
.th-lobby .mode { position: static; flex: none; display: flex; gap: 10px; border: 0; border-radius: 0; overflow: visible; }
.th-lobby .mode button { width: 40px; height: 40px; padding: 0; font-size: 0; color: transparent; background: ${maskIcon()} center / contain no-repeat; filter: brightness(.6) drop-shadow(0 3px 4px #000); transition: filter .15s, transform .15s; }
.th-lobby .mode button[data-m="transparent"] { background-image: ${loupeIcon()}; }
.th-lobby .mode button.on { background-color: transparent; filter: drop-shadow(0 0 8px rgba(255,214,140,.85)) drop-shadow(0 3px 4px #000); }
.th-lobby .mode button:hover, .th-lobby .mode button:focus-visible { outline: none; transform: translateY(-2px); filter: drop-shadow(0 0 10px rgba(255,214,140,.9)); }

/* ---------- Top left: the talk's crest and title ---------- */
.th-lobby .lp-crest { position: absolute; z-index: 6; left: 28px; top: 20px; width: 100px; height: 100px; pointer-events: none; }
.th-lobby .title-row { position: absolute; z-index: 5; left: 98px; top: 32px; padding: 10px 90px 10px 30px; display: flex; align-items: center; gap: 22px; max-width: min(900px, 56%); background: linear-gradient(90deg, rgba(14,12,10,.92) 0%, rgba(14,12,10,.7) 55%, rgba(14,12,10,0) 100%); }
.th-lobby .kind { font: 800 28px/1.08 ${CINZ}; letter-spacing: .04em; text-transform: uppercase; color: #F5E8C7; text-shadow: ${SHADOW}; }

/* ---------- Top right: the balance, the fare, patience as hanging jewels ---------- */
.th-lobby .meter { position: absolute; z-index: 5; right: 40px; top: 4px; width: 420px; margin: 0; padding: 206px 30px 26px; display: flex; flex-direction: column; align-items: center; gap: 0; isolation: isolate; }
.th-lobby .lp-scale { position: absolute; left: 50%; top: 0; width: 220px; height: 193px; translate: -50% 0; pointer-events: none; }
.th-lobby .lp-ped { position: absolute; left: 0; right: 0; top: 186px; bottom: 0; z-index: -1; pointer-events: none; }
.th-lobby .lp-scale .beam { transition: transform 1.2s cubic-bezier(.3,1.4,.5,1); }
.th-lobby .lp-scale .pan-l, .th-lobby .lp-scale .pan-r { transition: transform 1.2s cubic-bezier(.3,1.4,.5,1); }
.th-lobby .lp-phname { display: none; }
.th-lobby .meter-label { font: 700 13px/1 ${GARA}; letter-spacing: .3em; text-transform: uppercase; color: #b8a27a; text-shadow: ${SHADOW}; }
.th-lobby .meter-value { margin-top: 4px; font: 800 42px/1.05 ${CINZ}; color: #FFF6E5; text-shadow: ${SHADOW}, 0 0 18px rgba(255,200,120,.3); white-space: nowrap; }
.th-lobby .delta { font: 800 16px ${CINZ}; letter-spacing: .06em; }
.th-lobby .bar { ${SR} }
.th-lobby .patience { margin-top: 8px; display: flex; align-items: flex-start; gap: 4px; }
.th-lobby .pl-label { align-self: center; font: 700 12px/1 ${GARA}; letter-spacing: .26em; color: #b8a27a; margin-right: 10px; text-shadow: ${SHADOW}; }
.th-lobby .pip { width: 26px; height: 39px; border: 0; border-radius: 0; background: ${jewelBg(false)} center top / contain no-repeat; }
.th-lobby .pip.on { background-image: ${jewelBg(true)}; filter: drop-shadow(0 0 6px rgba(255,170,80,.7)); }

/* ---------- The deal: brass plaques hanging from the balance on chains ---------- */
.th-lobby .actions { position: absolute; z-index: 6; right: 40px; width: 420px; top: calc(var(--mh, 352px) + 24px); flex-direction: column; align-items: center; gap: 22px; }
.th-lobby .actions button { position: relative; width: 380px; height: 64px; padding: 0 40px; border: 0; border-radius: 0; background: ${choiceBg(false)} center / 100% 100% no-repeat; font: 800 19px/1 ${CINZ}; letter-spacing: .1em; text-transform: uppercase; color: #F5E8C7; text-shadow: 0 1px 2px #000; filter: drop-shadow(0 8px 10px rgba(0,0,0,.6)); transition: transform .16s cubic-bezier(.22,1,.36,1), filter .16s; transform-origin: 50% -30px; }
.th-lobby .actions button::before, .th-lobby .actions button::after { content: ""; position: absolute; top: -26px; width: 12px; height: 30px; background: ${chainBg()} center / contain no-repeat; }
.th-lobby .actions button::before { left: calc(18% - 6px); } .th-lobby .actions button::after { right: calc(18% - 6px); }
.th-lobby .actions .walk { background-image: ${choiceBg(true)}; color: #f0c8b8; }
.th-lobby .actions button:hover:not(:disabled), .th-lobby .actions button:focus-visible { outline: none; filter: drop-shadow(0 0 14px rgba(255,206,120,.6)); background-image: ${choiceBg(false, true)}; color: #FFE7AE; }
.th-lobby .actions .walk:hover:not(:disabled), .th-lobby .actions .walk:focus-visible { background-image: ${choiceBg(true, true)}; color: #ffe2d6; }
.th-lobby .end { position: absolute; z-index: 8; left: 50%; top: 40%; translate: -50% -50%; translate: round(-50%, 1px) round(-50%, 1px); min-width: 520px; max-width: 80%; padding: 34px 60px 30px; background: rgba(10,8,6,.92); box-shadow: 0 0 0 2px #1c1308, 0 0 0 5px #b68d40, 0 0 0 6px #f5e1a4, 0 30px 80px #000; }
.th-lobby .end-title { font: 800 34px/1.1 ${CINZ}; letter-spacing: .06em; color: #FFE7AE; text-shadow: ${SHADOW}; }
.th-lobby .end-sub { font: italic 18px ${GARA}; color: #d8c9a8; }
.th-lobby .leave { margin-top: 10px; min-width: 300px; height: 60px; border: 0; border-radius: 0; background: ${choiceBg(false)} center / 100% 100% no-repeat; font: 800 18px ${CINZ}; letter-spacing: .14em; text-transform: uppercase; color: #F5E8C7; padding: 0 50px; }
.th-lobby .leave:hover, .th-lobby .leave:focus-visible { outline: none; background-image: ${choiceBg(false, true)}; color: #FFE7AE; }

/* ---------- What you know: dossier slips fanned over the dialogue ---------- */
.th-lobby:not(.pl-phone) .journal-btn, .th-lobby:not(.pl-phone) .journal { display: none !important; }
.th-lobby .hand { position: absolute; z-index: 2; display: flex; justify-content: flex-end; align-items: flex-end; right: calc(var(--bxr) + 40px); bottom: calc(var(--bxb) + var(--bxh) - 16px); max-width: 52%; padding: 0 0 0 24px; }
.th-lobby .fact-card { position: relative; flex: 0 0 auto; width: 216px; min-height: 104px; margin: 0 -5px; padding: 14px 16px 12px 20px; text-align: left; border: 0; border-radius: 0; cursor: pointer;
  font: 500 15px/1.3 ${GARA}; color: #2b1d0e; background: linear-gradient(180deg, rgba(242,232,213,.55), rgba(184,166,142,.35)), url("${paper}") center / 256px;
  box-shadow: inset 0 0 0 6px rgba(0,0,0,0), inset 0 0 0 7px rgba(94,67,25,.45), 0 0 0 1px #6a4a14, 0 0 0 3px rgba(28,19,8,.9), 0 12px 22px rgba(0,0,0,.75); transform: rotate(var(--tilt, 0deg)) translateY(-10px); transition: transform .18s cubic-bezier(.22,1,.36,1), margin .18s; }
.th-lobby .fact-card::before { content: ""; position: absolute; right: -3px; top: -3px; width: 26px; height: 26px; background: linear-gradient(225deg, #fff2c2, #d9b464 40%, #8c6224); clip-path: polygon(0 0, 100% 0, 100% 100%, 78% 100%, 78% 22%, 0 22%); filter: drop-shadow(0 1px 1px #000); }
.th-lobby .fact-card:hover, .th-lobby .fact-card:focus-visible { outline: none; z-index: 2; margin: 0 6px; transform: rotate(0deg) translateY(-30px) scale(1.05); box-shadow: 0 0 0 1px #DFC183, 0 0 0 3px rgba(28,19,8,.9), 0 0 18px rgba(255,206,120,.55), 0 16px 26px rgba(0,0,0,.8); }
.th-lobby .fact-card.used { color: rgba(43,29,14,.42); filter: sepia(.4) brightness(.72); transform: rotate(var(--tilt, 0deg)) translateY(2px); }
.th-lobby .fact-card.used::after { content: "Played"; position: absolute; left: -4px; top: 8px; padding: 3px 14px 3px 10px; font: 800 10px/1 ${CINZ}; letter-spacing: .2em; text-transform: uppercase; color: #ffe2c8; background: linear-gradient(180deg, #8f2219, #4a0d08); clip-path: polygon(0 0, 100% 0, calc(100% - 8px) 50%, 100% 100%, 0 100%); }

/* ---------- Moments: prints in brass mounts on the wall ---------- */
.th-lobby .moment { z-index: 20; }
.th-lobby .moments { z-index: 4; left: 50%; right: auto; top: 0; bottom: auto; padding-top: 17vh; flex-direction: row; gap: 34px; }
.th-lobby .moments button { position: relative; width: 168px; height: 118px; padding: 8px; border: 0; border-radius: 0; overflow: visible; background: #120e0a; box-shadow: inset 0 0 0 2px #3a2a14, 0 14px 22px rgba(0,0,0,.75); transform: rotate(-4deg); transition: transform .18s; }
.th-lobby .moments button:nth-child(2n) { transform: rotate(3deg) translateY(12px); }
.th-lobby .moments button::after { content: ""; position: absolute; inset: -4px; background: ${printBg()} center / 100% 100% no-repeat; pointer-events: none; }
.th-lobby .moments button:hover, .th-lobby .moments button:focus-visible { outline: none; transform: rotate(0) scale(1.06); }
.th-lobby .moments button::before { content: ""; position: absolute; left: 50%; bottom: calc(100% - 2px); width: 3px; height: 40vh; translate: -50% 0; background: linear-gradient(90deg, #6a4a14, #f5e1a4 50%, #6a4a14); box-shadow: 0 0 2px #000; }
.th-lobby .moments img { filter: sepia(.2) contrast(1.05); }
.th-lobby .moment .cap { font: italic 500 30px/1.3 ${GARA}; color: #F5E8C7; left: 8%; right: 8%; bottom: 8%; text-align: center; }
.th-lobby .moment::before { background: linear-gradient(transparent 58%, rgba(10,8,6,.92)); }

/* ---------- Not a phone: the talk is what the screen is for ----------
   A taller box so several replies are in view, the conversation in large type at a readable measure on the left,
   and what you know as a straight, readable list on the right (the fan of tilted slips could not be read, and
   hid under the box). The controls carry their words. */
.pl.th-lobby:not(.pl-phone) { --bxw: min(90%, 1680px); --bxh: 42%; --hw: clamp(280px, 26%, 470px); }
.th-lobby:not(.pl-phone) .plaque { bottom: calc(var(--bxb) + var(--bxh) + 16px); }
/* An opaque portrait stands whole above the box, so the nameplate sits under the chin and never across the face. */
.th-lobby:not(.pl-phone) .figure:has(.fig.framed) { top: 7%; bottom: calc(var(--bxb) + var(--bxh) + 62px); height: auto; }
.th-lobby:not(.pl-phone) .fig.framed { height: 100%; aspect-ratio: 4 / 5; margin-bottom: 0; }
/* The prints hang between the person and the balance at every width. */
.th-lobby:not(.pl-phone) .moments { left: auto; right: 548px; }
.th-lobby:not(.pl-phone) .title-row { max-width: min(900px, 56%, calc(100% - 610px)); }
.th-lobby:not(.pl-phone) .log { gap: 14px; padding-right: 14px !important; scrollbar-width: thin; scrollbar-color: #b68d40 rgba(0,0,0,.35); }
.th-lobby:not(.pl-phone):has(.hand .fact-card) .log { right: calc(var(--bxr) + 46px + var(--hw) + 30px); }
.th-lobby:not(.pl-phone) .log > * { max-width: 44em; }
.th-lobby:not(.pl-phone) .setting { font-size: 19px; color: #b8a27a; }
.th-lobby:not(.pl-phone) .speaker { font-size: 14px; margin-bottom: 4px; }
.th-lobby:not(.pl-phone) .npc .prose { font-size: 24px; line-height: 1.45; }
.th-lobby:not(.pl-phone) .you .prose { font-size: 21px; line-height: 1.42; }
.th-lobby:not(.pl-phone) .imm { font-size: 20px; }
.th-lobby:not(.pl-phone) .trn { font-size: 17px; }
.th-lobby:not(.pl-phone) .tier { font-size: 13px; }
.th-lobby:not(.pl-phone) .result { font-size: 16px; }
.th-lobby:not(.pl-phone) .status { font-size: 19px; color: #FFE2A8; right: auto; left: calc(var(--bxl) + 46px); bottom: calc(var(--bxb) + 96px); }
.th-lobby:not(.pl-phone) .hand { z-index: 4; right: calc(var(--bxr) + 40px); width: var(--hw); max-width: none; top: calc(100% - var(--bxb) - var(--bxh) + 34px); bottom: calc(var(--bxb) + 100px); box-sizing: border-box; padding: 0 8px 4px 22px; flex-direction: column; justify-content: flex-start; align-items: stretch; gap: 9px; overflow-y: auto; border-left: 1px solid rgba(200,170,110,.35); scrollbar-width: thin; scrollbar-color: #b68d40 rgba(0,0,0,.35); }
.th-lobby:not(.pl-phone) .hand:empty { display: none; }
.th-lobby:not(.pl-phone) .hand:not(:empty)::before { content: "What you know: click one to cite it"; flex: none; padding: 2px 0 3px; font: 800 13px/1.2 ${CINZ}; letter-spacing: .14em; text-transform: uppercase; color: #DFC183; }
.th-lobby:not(.pl-phone) .fact-card, .th-lobby:not(.pl-phone) .fact-card.used { flex: none; width: auto; min-height: 0; margin: 0; padding: 11px 16px 12px 18px; font: 500 18px/1.3 ${GARA}; transform: none; transition: box-shadow .16s, filter .16s; }
.th-lobby:not(.pl-phone) .fact-card:hover, .th-lobby:not(.pl-phone) .fact-card:focus-visible { margin: 0; transform: none; filter: brightness(1.08); box-shadow: 0 0 0 2px #FFE2A8, 0 0 0 4px rgba(28,19,8,.9), 0 0 18px rgba(255,206,120,.6), 0 10px 18px rgba(0,0,0,.7); }
.th-lobby:not(.pl-phone) .fact-card:active { filter: brightness(.9); }
.th-lobby:not(.pl-phone) .fact-card.used { color: rgba(43,29,14,.72); filter: sepia(.35) brightness(.78); padding-right: 84px; }
.th-lobby:not(.pl-phone) .fact-card.used::after { left: auto; right: -4px; top: 8px; padding: 4px 10px 4px 16px; font-size: 12px; letter-spacing: .12em; clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 8px 50%); }
.th-lobby:not(.pl-phone) .composer { height: 66px; grid-template-columns: 1fr 148px; gap: 14px; }
.th-lobby:not(.pl-phone) .composer textarea { height: 58px; padding: 13px 18px; font-size: 21px; line-height: 1.4; background: rgba(6,5,4,.7); box-shadow: inset 0 0 0 1px rgba(200,170,110,.5), inset 0 2px 10px rgba(0,0,0,.8); }
.th-lobby:not(.pl-phone) .composer textarea:focus { box-shadow: inset 0 0 0 1.5px #FFE2A8, 0 0 12px rgba(230,198,135,.4); }
.th-lobby:not(.pl-phone) .composer textarea::placeholder { color: #a69272; }
.th-lobby:not(.pl-phone) .say { width: 148px; height: 58px; border-radius: 4px; border: 1px solid #1c1308; background: linear-gradient(180deg, #e6c687 0%, #b68d40 48%, #8c6224 100%); box-shadow: inset 0 1px 0 rgba(255,242,194,.8), 0 3px 8px rgba(0,0,0,.7); font-size: 20px; letter-spacing: .16em; filter: none; transition: filter .15s; }
.th-lobby:not(.pl-phone) .say:hover:not(:disabled), .th-lobby:not(.pl-phone) .say:focus-visible { transform: none; background: linear-gradient(180deg, #fff2c2 0%, #d4b475 48%, #a0752c 100%); filter: drop-shadow(0 0 10px rgba(255,206,120,.6)); outline: 1.5px dashed rgba(245,225,164,.85); outline-offset: 3px; }
.th-lobby:not(.pl-phone) .say:hover:not(:disabled):not(:focus-visible) { outline: 0; }
.th-lobby:not(.pl-phone) .say:active:not(:disabled) { filter: brightness(.85); }
/* The view mode says what each boss does. */
.th-lobby:not(.pl-phone) .mode { gap: 8px; }
.th-lobby:not(.pl-phone) .mode button { width: auto; height: 42px; padding: 0 14px 0 46px; background-position: 6px center; background-size: 32px; background-color: rgba(10,8,6,.6); box-shadow: inset 0 0 0 1px rgba(200,170,110,.35); filter: none; }
.th-lobby:not(.pl-phone) .mode button::after { font: 800 13px/1 ${CINZ}; letter-spacing: .1em; text-transform: uppercase; color: #b8a27a; white-space: nowrap; }
.th-lobby:not(.pl-phone) .mode button[data-m="immersive"]::after { content: "Story only"; }
.th-lobby:not(.pl-phone) .mode button[data-m="transparent"]::after { content: "Show dice"; }
.th-lobby:not(.pl-phone) .mode button.on { background-color: rgba(60,44,20,.85); box-shadow: inset 0 0 0 1.5px #DFC183, 0 0 10px rgba(255,214,140,.35); filter: none; }
.th-lobby:not(.pl-phone) .mode button.on::after { color: #FFE7AE; }
.th-lobby:not(.pl-phone) .mode button:hover, .th-lobby:not(.pl-phone) .mode button:focus-visible { transform: none; filter: none; box-shadow: inset 0 0 0 1.5px #FFE2A8; }
.th-lobby:not(.pl-phone) .mode button:hover::after, .th-lobby:not(.pl-phone) .mode button:focus-visible::after { color: #FFF1CC; }
.th-lobby:not(.pl-phone) .meter-label { font-size: 15px; }
.th-lobby:not(.pl-phone) .pl-label { font-size: 14px; }
.th-lobby:not(.pl-phone) .plaque .role { font-size: 14px; letter-spacing: .1em; }
.th-lobby:not(.pl-phone) .actions button { font-size: 20px; }
@media (min-aspect-ratio: 2/1) { .pl.th-lobby:not(.pl-phone) { --bxw: 74%; --hx: 21%; } }
@media (min-width: 761px) and (max-height: 960px) { .pl.th-lobby:not(.pl-phone) { --bxh: 46%; } }
/* A short window: the balance's drawing goes (the fare, patience and the deal stay), so the deal clears the box. */
@media (min-width: 761px) and (max-height: 900px) {
  .th-lobby:not(.pl-phone) .lp-scale { display: none; }
  .th-lobby:not(.pl-phone) .meter { top: 12px; padding-top: 24px; padding-bottom: 20px; }
  .th-lobby:not(.pl-phone) .lp-ped { top: 0; }
  .th-lobby:not(.pl-phone) .meter-value { font-size: 36px; }
  .th-lobby:not(.pl-phone) .actions { top: calc(var(--mh, 170px) + 20px); gap: 16px; }
  .th-lobby:not(.pl-phone) .actions button { height: 54px; font-size: 18px; }
  .th-lobby:not(.pl-phone) .actions button::before, .th-lobby:not(.pl-phone) .actions button::after { top: -20px; height: 24px; }
  .th-lobby:not(.pl-phone) .moments { padding-top: 13vh; }
  .th-lobby:not(.pl-phone) .moments button { width: 132px; height: 94px; }
}
/* ---------- Phones (view.ts sets pl-phone, pl-short, --pl-h): the talk comes first ----------
   Real rows instead of a stage: a compact bar (name, fare, patience, what you know), a band of the person, the deal,
   the talk, the input. The brass box and its ornaments go, so no text runs under them; the balance, the crest, the
   plaque and the fan of slips go too. What you know, the moments, the view mode and the deal all live behind the bar's
   one button (a sheet over the talk), so nothing is out of reach at any height. Sized by the grid, so it follows
   --pl-h when the keyboard opens. */
.pl.th-lobby.pl-phone { --bar: 56px; --band: clamp(56px, calc(var(--pl-h, 664px) * .16), 108px); --hx: 50%; overflow: hidden;
  display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: var(--bar) var(--band) auto minmax(0, 1fr) auto auto auto; }
.th-lobby.pl-phone .title-row { display: contents; }
.th-lobby.pl-phone .lp-crest, .th-lobby.pl-phone .lp-rays, .th-lobby.pl-phone .lp-dust, .th-lobby.pl-phone .lp-scale, .th-lobby.pl-phone .lp-ped, .th-lobby.pl-phone .tell { display: none; }
/* The person: head and shoulders in the band, the rest behind the talk's panel. */
.th-lobby.pl-phone .figure { left: 0; width: 100%; top: calc(var(--bar) - 2px); bottom: auto; height: calc(var(--band) * 2.7); }
/* An opaque picture (most real cards) has its face mid-frame: smaller, from the top, so the face lands in the band. */
.th-lobby.pl-phone .figure:has(.fig.framed) { height: calc(var(--band) * 1.75); align-items: flex-start; }
.th-lobby.pl-phone .fig.framed { height: 100%; }
.th-lobby.pl-phone .lp-halo { top: calc(var(--bar) - var(--band) * .2); height: calc(var(--band) * 1.5); }
.th-lobby.pl-phone .lp-glow { width: 110%; top: calc(var(--bar) - var(--band) * .4); }
.th-lobby.pl-phone .plaque { ${SR} }
/* The bar: their name, then the fare and patience on one line; the button on the right. */
.th-lobby.pl-phone .meter { position: relative; z-index: 6; grid-column: 1 / -1; grid-row: 1; right: auto; top: auto; width: auto; min-width: 0; margin: 0; padding: 0 96px 0 12px; isolation: auto;
  display: grid; grid-template-columns: auto auto minmax(0, 1fr); align-content: center; align-items: center; gap: 1px 8px;
  background: linear-gradient(180deg, #17120c, #0c0a07); box-shadow: 0 1px 0 #c89d54, 0 3px 0 #0c0a07, 0 4px 0 rgba(200,157,84,.45), 0 8px 14px rgba(0,0,0,.6); }
.th-lobby.pl-phone .lp-phname { display: block; grid-column: 1 / -1; font: 800 14px/1.2 ${CINZ}; letter-spacing: .05em; text-transform: uppercase; color: #F5E8C7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.th-lobby.pl-phone .meter-label { grid-column: 1; font: 700 12px/1 ${GARA}; letter-spacing: .1em; color: #b8a27a; text-shadow: none; }
.th-lobby.pl-phone .meter-value { grid-column: 2; margin: 0; font: 800 17px/1.15 ${CINZ}; text-shadow: none; }
.th-lobby.pl-phone .delta { font-size: 13px; }
.th-lobby.pl-phone .patience { grid-column: 3; grid-row: auto; margin: 0; gap: 1px; align-items: center; min-width: 0; overflow: hidden; }
.th-lobby.pl-phone .pl-label { ${SR} }
.th-lobby.pl-phone .pip { flex: none; width: 11px; height: 17px; }
.th-lobby.pl-phone .journal-btn { display: block; position: relative; z-index: 7; grid-column: 2; grid-row: 1; align-self: center; justify-self: end; box-sizing: border-box; width: 84px; height: 44px; margin: 0 6px 0 0; padding: 2px 6px; font: 700 13px/1.1 ${GARA}; color: #FFE2A8; background: linear-gradient(180deg, #2a2013, #15100a); border: 1px solid #c89d54; cursor: pointer; }
.th-lobby.pl-phone:has(.journal.open) .journal-btn { font-size: 0; background: linear-gradient(180deg, #e7c98a, #a67d38); }
.th-lobby.pl-phone:has(.journal.open) .journal-btn::after { content: "Close"; font: 800 14px/1 ${CINZ}; color: #1E160B; }
/* The talk's panel: a plain dark ground with a brass rule on top, so the text meets nothing. */
.th-lobby.pl-phone .lp-box { position: relative; z-index: 3; left: auto; right: auto; bottom: auto; height: auto; grid-column: 1 / -1; grid-row: 3 / -1; background: linear-gradient(180deg, #120e09, #090705); box-shadow: 0 -1px 0 #c89d54, 0 -3px 0 #0c0a07, 0 -4px 0 rgba(200,157,84,.45); }
.th-lobby.pl-phone .lp-box > * { display: none; }
.th-lobby.pl-phone .actions { position: relative; z-index: 6; grid-column: 1 / -1; grid-row: 3; right: auto; left: auto; top: auto; bottom: auto; width: auto; flex-direction: row; align-items: stretch; gap: 6px; padding: 8px 8px 2px; }
.th-lobby.pl-phone .actions button { flex: 1 1 0; width: auto; min-width: 0; height: 46px; padding: 0 16px; font-size: 12.5px; line-height: 1.1; letter-spacing: .03em; transform: none; }
.th-lobby.pl-phone .actions .deal { flex-grow: 1.5; }
.th-lobby.pl-phone .actions button::before, .th-lobby.pl-phone .actions button::after { display: none; }
.th-lobby.pl-phone .log { position: relative; z-index: 4; grid-column: 1 / -1; grid-row: 4; inset: auto; min-height: 0; gap: 10px; padding: 14px 14px 22px !important;
  -webkit-mask-image: linear-gradient(transparent 0, #000 14px, #000 calc(100% - 18px), transparent 100%) !important; mask-image: linear-gradient(transparent 0, #000 14px, #000 calc(100% - 18px), transparent 100%) !important; }
.th-lobby.pl-phone .setting { font-size: 16px; line-height: 1.35; }
.th-lobby.pl-phone .speaker { font-size: 12px; letter-spacing: .14em; margin-bottom: 2px; }
.th-lobby.pl-phone .npc .prose { font-size: 18px; line-height: 1.38; }
.th-lobby.pl-phone .you { padding-left: 26px; }
.th-lobby.pl-phone .you::before { left: 0; top: 0; width: 20px; height: 20px; }
.th-lobby.pl-phone .you .prose { font-size: 17px; line-height: 1.36; }
.th-lobby.pl-phone .read { padding: 0 0 0 26px; }
.th-lobby.pl-phone .tray { gap: 6px; }
.th-lobby.pl-phone .die { width: 34px; height: 34px; font-size: 13px; }
.th-lobby.pl-phone .result { font-size: 13px; letter-spacing: .1em; }
.th-lobby.pl-phone .imm { font-size: 16px; line-height: 1.36; }
.th-lobby.pl-phone .trn { font-size: 15px; }
.th-lobby.pl-phone .tier { font-size: 12px; letter-spacing: .06em; }
.th-lobby.pl-phone .why summary { padding: 8px 0; }
.th-lobby.pl-phone .status { position: relative; z-index: 5; grid-column: 1 / -1; grid-row: 5; right: auto; bottom: auto; max-width: none; min-height: 0; padding: 0 14px 4px; font-size: 15px; line-height: 1.25; }
.th-lobby.pl-phone .status:empty { display: none; }
.th-lobby.pl-phone .composer { position: relative; z-index: 5; grid-column: 1 / -1; grid-row: 6; left: auto; right: auto; bottom: auto; height: auto; grid-template-columns: minmax(0, 1fr) 52px; gap: 8px; padding: 0 8px calc(8px + env(safe-area-inset-bottom)); }
.th-lobby.pl-phone .composer textarea { box-sizing: border-box; display: block; width: 100%; height: 52px; padding: 6px 10px; line-height: 1.25; background: #050403; box-shadow: inset 0 0 0 1px rgba(200,157,84,.55); }
.th-lobby.pl-phone .composer textarea:focus { box-shadow: inset 0 0 0 1.5px #FFE2A8; }
.th-lobby.pl-phone .composer textarea::placeholder { color: #a69272; }
.th-lobby.pl-phone .say { width: 52px; height: 52px; font-size: 12px; letter-spacing: .08em; }
/* The end: a card docked under the talk, so the last reply can still be read above it. */
.th-lobby.pl-phone .end { position: relative; z-index: 8; grid-column: 1 / -1; grid-row: 7; left: auto; top: auto; translate: none; min-width: 0; max-width: none; margin: 4px 8px calc(8px + env(safe-area-inset-bottom)); padding: 12px 14px; }
.th-lobby.pl-phone .end-title { font-size: 19px; }
.th-lobby.pl-phone .end-sub { font-size: 16px; }
.th-lobby.pl-phone .reveals { max-height: calc(var(--pl-h, 664px) * .28); overflow-y: auto; font-size: 15px; }
.th-lobby.pl-phone .leave { box-sizing: border-box; min-width: 0; width: 100%; height: 50px; margin-top: 4px; padding: 0 20px; font-size: 16px; }
.th-lobby.pl-phone .moment .cap { left: 16px; right: 16px; bottom: 16px; font-size: 20px; }

/* ---------- The sheet behind the bar's button: moments, the view mode, what you know, the deal ---------- */
.th-lobby.pl-phone .journal, .th-lobby.pl-phone .hand, .th-lobby.pl-phone .moments, .th-lobby.pl-phone .mode, .th-lobby.pl-phone .kind { display: none; }
.pl.th-lobby.pl-phone:has(.journal.open) { --mo: 0px; grid-template-rows: var(--bar) var(--mo) auto auto minmax(0, 1fr) auto auto auto auto; }
.pl.th-lobby.pl-phone:has(.journal.open):has(.moments button) { --mo: 64px; }
.th-lobby.pl-phone .journal.open { display: flex; position: relative; z-index: 7; grid-column: 1 / -1; grid-row: 2 / 7; flex-direction: column; justify-content: center; margin: 0; padding: 0; list-style: none; background: #0e0b07; border: 0; border-radius: 0; }
.th-lobby.pl-phone .journal.open li { display: none; }
.th-lobby.pl-phone .journal.open li.empty { display: block; margin: 0; padding: 0 14px; text-align: center; font: italic 500 16px/1.35 ${GARA}; color: #cfc0a0; }
.th-lobby.pl-phone:has(.journal.open) .moments { display: flex; position: absolute; z-index: 8; left: 0; right: 0; top: calc(var(--bar) + 6px); bottom: auto; flex-direction: row; gap: 6px; padding: 0 8px; overflow-x: auto; touch-action: pan-x; }
.th-lobby.pl-phone .moments button, .th-lobby.pl-phone .moments button:nth-child(2n) { flex: none; width: 76px; height: 56px; padding: 3px; transform: none; }
.th-lobby.pl-phone .moments button::before { display: none; }
.th-lobby.pl-phone:has(.journal.open) .kind { display: block; position: relative; z-index: 8; grid-column: 1 / -1; grid-row: 3; padding: 10px 14px 6px; font: 700 13px/1.25 ${CINZ}; letter-spacing: .03em; color: #DFC183; text-shadow: none; }
.th-lobby.pl-phone:has(.journal.open) .mode { display: flex; position: relative; z-index: 8; grid-column: 1 / -1; grid-row: 4; gap: 6px; margin: 0; padding: 0 8px 8px; }
.th-lobby.pl-phone:has(.journal.open) .mode button { flex: 1 1 0; box-sizing: border-box; width: auto; height: 44px; padding: 0 4px 0 34px; font: 700 12.5px/1 ${CINZ}; color: #cfc0a0; background-position: 6px center; background-size: 24px; background-repeat: no-repeat; filter: none; box-shadow: inset 0 0 0 1px rgba(200,157,84,.4); transform: none; text-align: left; }
.th-lobby.pl-phone:has(.journal.open) .mode button.on { color: #FFE7AE; box-shadow: inset 0 0 0 2px #DFC183; background-color: rgba(223,193,131,.14); }
.th-lobby.pl-phone:has(.journal.open) .hand { display: flex; position: relative; z-index: 8; grid-column: 1 / -1; grid-row: 5; left: auto; right: auto; bottom: auto; max-width: none; min-height: 0; flex-direction: column; align-items: stretch; justify-content: flex-start; gap: 6px; padding: 2px 8px 8px; overflow-y: auto; touch-action: pan-y; overscroll-behavior: contain; }
.th-lobby.pl-phone .hand:not(:empty)::before { content: "Tap one to cite it in what you say"; flex: none; font: italic 500 15px/1.2 ${GARA}; color: #b8a27a; }
.th-lobby.pl-phone .fact-card, .th-lobby.pl-phone .fact-card:hover, .th-lobby.pl-phone .fact-card:focus-visible { flex: none; box-sizing: border-box; width: 100%; height: auto; min-height: 48px; margin: 0; padding: 12px 14px; font-size: 16px; line-height: 1.28; transform: none; }
.th-lobby.pl-phone .fact-card::before { width: 14px; height: 14px; }
.th-lobby.pl-phone .fact-card.used { color: rgba(43,29,14,.85); filter: sepia(.25) brightness(.8); transform: none; }
/* "Played" floats at the top right, so the fact's text wraps round it instead of running under it. */
.th-lobby.pl-phone .fact-card.used::after { display: none; }
.th-lobby.pl-phone .fact-card.used::before { content: "Played"; position: static; float: right; width: auto; height: auto; margin: -4px -6px 2px 8px; padding: 4px 6px 4px 12px; font: 800 12px/1 ${CINZ}; letter-spacing: .04em; text-transform: uppercase; color: #ffe2c8; background: linear-gradient(180deg, #8f2219, #4a0d08); clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 7px 50%); filter: none; }
.th-lobby.pl-phone:has(.journal.open) .actions { z-index: 8; grid-row: 6; padding: 6px 8px; }
.th-lobby.pl-phone:has(.journal.open) .status { grid-row: 7; }
.th-lobby.pl-phone:has(.journal.open) .composer { grid-row: 8; padding-top: 6px; }
.th-lobby.pl-phone:has(.journal.open) .end { grid-row: 9; }
.th-lobby.pl-phone:has(.journal.open) .log { visibility: hidden; grid-row: 2 / 6; }

/* ---------- Short (the keyboard is open, or a small screen): the talk, the input, one line for the stakes ---------- */
.pl.th-lobby.pl-short { --bar: 44px; grid-template-rows: var(--bar) minmax(0, 1fr) auto auto auto; }
.th-lobby.pl-short .figure, .th-lobby.pl-short .lp-halo, .th-lobby.pl-short .lp-glow, .th-lobby.pl-short .lp-phname, .th-lobby.pl-short .actions { display: none; }
.th-lobby.pl-short .journal-btn { height: 40px; margin-right: 2px; padding: 0 4px; font-size: 12px; }
.th-lobby.pl-short .lp-box { grid-row: 2 / -1; }
.th-lobby.pl-short .log { grid-row: 2; padding-top: 10px !important; padding-bottom: 14px !important; }
.th-lobby.pl-short .status { grid-row: 3; }
.th-lobby.pl-short .composer { grid-row: 4; padding-bottom: 6px; }
.th-lobby.pl-short .end { grid-row: 5; margin-bottom: 6px; padding: 8px 12px; }
/* Open while short: everything but the input, which comes back with the slip you tap. */
.pl.th-lobby.pl-short:has(.journal.open) { grid-template-rows: var(--bar) var(--mo) auto minmax(0, 1fr) auto; }
.th-lobby.pl-short .journal.open { grid-row: 2 / -1; }
.th-lobby.pl-short:has(.journal.open) .kind, .th-lobby.pl-short:has(.journal.open) .composer, .th-lobby.pl-short:has(.journal.open) .status { display: none; }
.th-lobby.pl-short:has(.journal.open) .mode { grid-row: 3; padding-top: 6px; }
.th-lobby.pl-short:has(.journal.open) .hand { grid-row: 4; }
.th-lobby.pl-short:has(.journal.open) .actions { display: flex; grid-row: 5; }
.th-lobby.pl-short:has(.journal.open) .end { grid-row: 5; }
.th-lobby.pl-short:has(.journal.open) .log { grid-row: 2 / -1; }

/* ---------- Landscape: the talk and the input left, the stakes and the deal in a column right ---------- */
@media (min-width: 600px) {
  .pl.th-lobby.pl-short { --side: 250px; grid-template-columns: minmax(0, 1fr) var(--side); grid-template-rows: minmax(0, 1fr) auto auto auto; }
  .th-lobby.pl-short .lp-box { grid-row: 1 / -1; box-shadow: none; }
  .th-lobby.pl-short .log, .th-lobby.pl-short .status, .th-lobby.pl-short .composer, .th-lobby.pl-short .end { grid-column: 1; }
  .th-lobby.pl-short .log { grid-row: 1; }
  .th-lobby.pl-short .status { grid-row: 2; }
  .th-lobby.pl-short .composer { grid-row: 3; }
  .th-lobby.pl-short .end { grid-row: 4; }
  .th-lobby.pl-short .meter { position: absolute; left: auto; right: 0; top: 0; width: var(--side); height: 54px; box-sizing: border-box; padding: 0 8px 0 12px; }
  .th-lobby.pl-short .lp-phname { display: block; }
  .th-lobby.pl-short .journal-btn { position: absolute; right: 0; top: 60px; width: calc(var(--side) - 16px); height: 44px; margin: 0 8px; font-size: 14px; }
  .th-lobby.pl-short .actions, .th-lobby.pl-short:has(.journal.open) .actions { display: flex; position: absolute; grid-area: auto; right: 0; top: 110px; width: var(--side); flex-direction: column; gap: 6px; padding: 0 8px; }
  .th-lobby.pl-short .actions button { flex: none; width: 100%; height: 46px; }
  /* The sheet takes the talk's side only; the right column stays as it is. */
  .pl.th-lobby.pl-short:has(.journal.open) { grid-template-rows: var(--mo) auto minmax(0, 1fr); }
  .th-lobby.pl-short .journal.open { grid-column: 1; grid-row: 1 / -1; }
  .th-lobby.pl-short:has(.journal.open) .moments { top: 6px; right: var(--side); }
  .th-lobby.pl-short:has(.journal.open) .mode { grid-column: 1; grid-row: 2; }
  .th-lobby.pl-short:has(.journal.open) .hand { grid-column: 1; grid-row: 3; display: grid; grid-template-columns: 1fr 1fr; align-content: start; }
  .th-lobby.pl-short .hand:not(:empty)::before { grid-column: 1 / -1; }
  .th-lobby.pl-short:has(.journal.open) .log { grid-column: 1; grid-row: 1 / -1; }
  .th-lobby.pl-short:has(.journal.open) .end { grid-column: 1; grid-row: 3; }
}
@media (prefers-reduced-motion: reduce) {
  .th-lobby .lp-rays, .th-lobby .lp-halo .hl1, .th-lobby .lp-halo .hl2, .th-lobby .lp-halo .flare { animation: none; }
  .th-lobby .lp-scale .beam, .th-lobby .lp-scale .pan-l, .th-lobby .lp-scale .pan-r { transition: none; }
}
`;

/** Floating dust in the window light (a canvas over the place). */
function dust(canvas: HTMLCanvasElement, reduced: boolean): () => void {
  const g = canvas.getContext("2d");
  if (!g) return () => {};
  const mote = moteSprite();
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const motes = Array.from({ length: 40 }, () => ({ x: r(), y: r(), z: 0.3 + r() * 0.7, p: r() * 6.28, v: 0.004 + r() * 0.01 }));
  let raf = 0;
  const draw = (ms: number) => {
    const t = reduced ? 0 : ms / 1000;
    const W = (canvas.width = Math.max(1, Math.round(canvas.clientWidth / 2)));
    const H = (canvas.height = Math.max(1, Math.round(canvas.clientHeight / 2)));
    g.clearRect(0, 0, W, H);
    for (const m of motes) {
      const x = ((m.x + Math.sin(t * 0.13 + m.p) * 0.02 + t * m.v * 0.25) % 1) * W;
      const y = ((m.y - t * m.v * 0.5 + 10) % 1) * H;
      const lit = Math.max(0.15, 1 - (x / W) * 0.9 - (y / H) * 0.3);
      const size = (4 + m.z * 9) * (0.6 + 0.4 * Math.sin(t * 0.8 + m.p));
      g.globalAlpha = 0.5 * lit * m.z;
      g.drawImage(mote, x - size / 2, y - size / 2, size, size);
    }
    g.globalAlpha = 1;
    if (!reduced) raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(raf);
}

/** The obsidian-glass name plaque (the scene's lead nameplate, with its gold-leaf scrolls). */
function glassTab(): string {
  const d = "M30 3 H390 L417 39 L390 75 H30 L3 39Z";
  const scroll = (x: number, s: number) => `<g transform="translate(${x} 39) scale(${s} 1)"><path d="M0 0 c-12 -1 -20 -12 -11 -21 c6 -6 14 -2 12 5 c-1 4 -6 4 -6 0" fill="none" stroke="#1c1308" stroke-width="5" stroke-linecap="round"/><path d="M0 0 c-12 -1 -20 -12 -11 -21 c6 -6 14 -2 12 5 c-1 4 -6 4 -6 0" fill="none" stroke="url(#lb-brass)" stroke-width="2.8" stroke-linecap="round"/><path d="M0 0 c-12 1 -20 12 -11 21 c6 6 14 2 12 -5" fill="none" stroke="url(#lb-brass)" stroke-width="2" stroke-linecap="round"/></g>`;
  return `<svg viewBox="-34 0 488 78" class="art" aria-hidden="true" preserveAspectRatio="none"><g filter="url(#lb-sh2)">
${scroll(4, 1)}${scroll(416, -1)}
<path d="${d}" fill="#0c0a08" fill-opacity=".92" stroke="#1c1308" stroke-width="3"/>
<path d="M32 7 H388 L412 39 L388 71 H32 L8 39Z" fill="none" stroke="#DFC183" stroke-width="1.2"/>
<path d="M35 11 H385 L407 39 L385 67 H35 L13 39Z" fill="none" stroke="#DFC183" stroke-width=".7" opacity=".55"/>
<path d="M36 10 H384" stroke="#fff" stroke-width="5" opacity=".06"/>
<path d="M160 71 H260" stroke="#DFC183" stroke-width="1.2"/><path d="M210 66 L215 71 L210 76 L205 71Z" fill="#DFC183"/>
</g></svg>`;
}

export const theme: ParleyTheme = {
  css: css(parchment()),
  decorate(ctx) {
    const { root, scene, scenario } = ctx;
    const mk = (cls: string, html = "", tag = "div") => {
      const e = document.createElement(tag);
      e.className = cls;
      e.setAttribute("aria-hidden", "true");
      e.innerHTML = html;
      return e;
    };
    root.insertAdjacentHTML("afterbegin", lobbyDefs());
    // The place's light: a glow and the halo behind the person, shafts and dust in front of the painting.
    const figure = scene.querySelector(".figure");
    scene.insertBefore(mk("lp-glow"), figure);
    scene.insertBefore(mk("lp-halo", halo()), figure);
    const dustEl = mk("lp-dust", "", "canvas") as HTMLCanvasElement;
    scene.querySelector(".vignette")?.after(mk("lp-rays", rays()), dustEl);
    const stopDust = dust(dustEl, ctx.reducedMotion);
    scene.querySelector(".plaque")?.prepend(mk("lp-tab", glassTab()));
    root.append(mk("lp-crest", crest()));
    // The balance, tipping with the deal.
    const scale = mk("lp-scale", balanceRig());
    const meterEl = root.querySelector<HTMLElement>(".meter");
    meterEl?.prepend(scale, mk("lp-ped", pedestal()));
    // Phones: the name rides in the compact bar. The plaque stays for screen readers, so this copy is hidden from them.
    const phName = mk("lp-phname");
    phName.textContent = scenario.npc.name;
    meterEl?.querySelector(".meter-label")?.before(phName);
    // Phones: playing a slip closes the sheet first, so the input it fills is there to take the focus.
    root.querySelector(".hand")?.addEventListener("click", (e) => {
      if (root.classList.contains("pl-phone") && (e.target as Element).closest(".fact-card")) root.querySelector(".journal")?.classList.remove("open");
    }, true);
    // The deal hangs from the pedestal's rings, however tall the meter grows.
    const hang = () => {
      if (meterEl) root.style.setProperty("--mh", `${Math.round(meterEl.offsetTop + meterEl.offsetHeight)}px`);
    };
    const beam = scale.querySelector<SVGGElement>(".beam");
    const panL = scale.querySelector<SVGGElement>(".pan-l");
    const panR = scale.querySelector<SVGGElement>(".pan-r");
    const c = scenario.contest;
    const tip = (value: number) => {
      const span = Math.max(1, c.start - c.hardFloor);
      const q = Math.max(0, Math.min(1, (value - c.hardFloor) / span));
      const deg = (0.5 - q) * 24;
      const a = (deg * Math.PI) / 180;
      if (beam) beam.style.transform = `rotate(${deg.toFixed(2)}deg)`;
      panL?.setAttribute("transform", `translate(${(120 - 98 * Math.cos(a)).toFixed(2)} ${(46 - 98 * Math.sin(a)).toFixed(2)})`);
      panR?.setAttribute("transform", `translate(${(120 + 98 * Math.cos(a)).toFixed(2)} ${(46 + 98 * Math.sin(a)).toFixed(2)})`);
    };
    tip(ctx.state.value);
    // The dialogue box, drawn at its real size.
    const box = mk("lp-box");
    root.append(box);
    let lastKey = "";
    const draw = () => {
      const w = Math.round(box.clientWidth);
      const h = Math.round(box.clientHeight);
      const composer = root.querySelector(".composer") as HTMLElement | null;
      const inputTop = composer && composer.offsetParent ? composer.getBoundingClientRect().top - box.getBoundingClientRect().top - 10 : h - 86;
      const key = `${w}x${h}:${Math.round(inputTop)}`;
      if (key === lastKey || w < 10) return;
      lastKey = key;
      box.innerHTML = dialogFrame(w, h, inputTop);
    };
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(draw) : null;
    ro?.observe(box);
    requestAnimationFrame(() => {
      draw();
      hang();
    });
    return {
      update(state) {
        tip(state.value);
        draw();
        hang();
      },
      destroy() {
        ro?.disconnect();
        stopDust();
      },
    };
  },
};
