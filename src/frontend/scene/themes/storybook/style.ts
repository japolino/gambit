/**
 * Storybook: the stylesheet. The stage (`.sb-st`) spans the window and is
 * sized with stage container units: the dialogue page anchors the bottom on
 * a full-width skirt, the cast clusters left of centre, the choices hang on
 * the right. CSS here is structure and light; the materials are the SVG art
 * and canvas textures.
 * It also restyles the host's class panel and "Meanwhile…" overlays.
 */
import { brushwork, leather, parchment } from "./textures.js";

/** A gilt frame as an SVG data URI, for border-image on the host overlays. */
function giltBorder(): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 90 90'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#fff1c2'/><stop offset='.35' stop-color='#d9ad62'/><stop offset='.6' stop-color='#7a4c1c'/><stop offset='1' stop-color='#e6c27a'/></linearGradient></defs><rect x='1' y='1' width='88' height='88' fill='none' stroke='#2a1205' stroke-width='2'/><rect x='4' y='4' width='82' height='82' fill='none' stroke='url(#g)' stroke-width='6'/><rect x='10' y='10' width='70' height='70' fill='none' stroke='#d9ad62' stroke-width='1.2'/><circle cx='12' cy='12' r='7' fill='url(#g)' stroke='#3a1a08'/><circle cx='78' cy='12' r='7' fill='url(#g)' stroke='#3a1a08'/><circle cx='12' cy='78' r='7' fill='url(#g)' stroke='#3a1a08'/><circle cx='78' cy='78' r='7' fill='url(#g)' stroke='#3a1a08'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** The woodcut section rule under journal headings (a line with a fleuron). */
function rule(): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 16'><path d='M0,8 H128 M172,8 H300' stroke='#8a5a2a' stroke-width='1'/><path d='M20,11 H120 M180,11 H280' stroke='#8a5a2a' stroke-width='.5' stroke-dasharray='2 3'/><path d='M150,2 C156,6 158,8 150,14 C142,8 144,6 150,2Z' fill='#8c2a1c'/><path d='M150,8 C140,2 132,4 128,8 C132,12 140,14 150,8Z M150,8 C160,2 168,4 172,8 C168,12 160,14 150,8Z' fill='none' stroke='#8a5a2a' stroke-width='1'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function css(): string {
  const parch = parchment();
  const page = parchment(900, 1200, 13);
  const hide = leather(33, "brown");
  const blood = leather(44, "oxblood");
  return `
.sb { position: absolute; inset: 0; overflow: hidden; background: #120a06; color: #2b170a; font-family: "Gambit Garamond", "Palatino Linotype", Georgia, serif;
  --ink: #2b170a; --gilt: #e9c57a; --cream: #fff0cf; }
.sb button { font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.sb svg { overflow: visible; }
.sb :focus { outline: none; }
.sb .vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.sb :focus-visible { outline: 2px solid #ffd27a; outline-offset: 3px; }

/* ---------- The painted place and its light ---------- */
.sb-bg { position: absolute; inset: -3%; will-change: transform; }
.sb-bg > .world { position: absolute; inset: 0; }
.sb-grade { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse 70% 60% at 62% 30%, rgba(255,214,150,.18), rgba(120,60,20,.18) 70%); mix-blend-mode: soft-light; }
.sb-rays { position: absolute; right: -4%; top: -6%; width: 80%; height: 92%; pointer-events: none; mix-blend-mode: screen; opacity: .6; will-change: transform, opacity; }
.sb-motes { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; mix-blend-mode: screen; }
.sb-vig { position: absolute; inset: 0; pointer-events: none;
  background:
    radial-gradient(ellipse 78% 70% at 50% 40%, transparent 52%, rgba(18,9,4,.55) 80%, rgba(10,5,2,.92) 100%),
    linear-gradient(180deg, rgba(10,5,2,.55), transparent 16%, transparent 58%, rgba(10,5,2,.78) 100%);
  box-shadow: inset 0 0 140px rgba(18,9,4,.85); }
/* ---------- Proscenium corners ---------- */
.sb-corners { position: absolute; inset: 0; pointer-events: none; will-change: transform; }
.sb-corner { position: absolute; width: clamp(150px, min(21cqw, 34cqh), 360px); aspect-ratio: 380 / 260; }
.sb-corner svg { width: 100%; height: 100%; display: block; }
.sb-corner.tl { left: -6px; top: -6px; }
.sb-corner.tr { right: -6px; top: -6px; transform: scaleX(-1); }
.sb-corner.bl { left: -6px; bottom: -6px; transform: scaleY(-1); width: clamp(110px, min(15cqw, 24cqh), 250px); }
.sb-corner.br { right: -6px; bottom: -6px; transform: scale(-1,-1); width: clamp(110px, min(15cqw, 24cqh), 250px); }

/* ---------- The stage ---------- */
.sb-st { position: absolute; top: 0; bottom: 0; left: 0; width: 100%; container-type: size; container-name: stage; }
.sb-ui { pointer-events: none; will-change: transform; }
.sb-ui > * { pointer-events: auto; }
.sb-st { --dw: min(78cqw, 1760px); --dh: clamp(186px, 23.5cqh, 240px); --db: max(24px, 2.6cqh); --fs: clamp(19px, min(3cqh, 1.35cqw), 28px); --fb: -6cqh; --fh: 94cqh; }

/* ---------- The skirt and the name scrolls ---------- */
.sb-skirt { position: absolute; left: 0; right: 0; bottom: 0; pointer-events: none; }
.sb-skirt svg { display: block; }
.sb-tags { position: absolute; inset: 0; pointer-events: none; }
.sb-tags .tag { position: absolute; left: calc(var(--x) * 1cqw); bottom: calc(var(--db) + var(--dh) + 28px); width: clamp(150px, 18.5cqh, 200px); transform: translateX(-50%); pointer-events: auto; transition: filter .25s; }
.sb-tags .tag svg { width: 100%; height: auto; display: block; }
.sb-tags .tag .tk { transform-box: fill-box; transform-origin: 50% 100%; transition: transform .3s cubic-bezier(.3,1.6,.5,1), filter .25s; }
.sb-tags .tag.hot .tk, .sb-tags .tag:hover .tk, .sb-tags .tag:focus-visible .tk { transform: translateY(-4px) scale(1.08); filter: brightness(1.5) drop-shadow(0 0 4px #ffd27a); }
.sb-tags .tag.hot, .sb-tags .tag:hover, .sb-tags .tag:focus-visible { filter: drop-shadow(0 0 10px rgba(255,200,110,.55)); }
.sb-tags .tag:focus-visible { outline: none; }
.sb-tags .tag.mute { cursor: default; }
.sb.busy .sb-tags .tag { filter: saturate(.6) brightness(.85); }

/* ---------- The cast ---------- */
.sb-cast { pointer-events: none; -webkit-mask-image: linear-gradient(180deg, #000 74%, transparent 99%); mask-image: linear-gradient(180deg, #000 74%, transparent 99%); }
.sb-cast .layer { position: absolute; inset: 0; will-change: transform; }
.sb-cast .fig { position: absolute; bottom: var(--fb); left: calc(var(--x) * 1cqw); height: calc(var(--s) * var(--fh)); transform: translateX(-50%); pointer-events: auto; cursor: pointer;
  transition: filter .35s ease; }
.sb-cast .fig.enter { animation: sbRise .7s cubic-bezier(.2,.8,.2,1) both; }
.sb-cast .fig img { height: 100%; width: auto; display: block; user-select: none; -webkit-user-drag: none;
  filter: sepia(.16) saturate(.96) contrast(1.05) drop-shadow(0 -2px 3px rgba(255,214,140,.55)) drop-shadow(-14px 22px 26px rgba(12,5,2,.85)); }
.sb-cast .fig .lit { position: absolute; inset: 0; pointer-events: none; -webkit-mask-size: 100% 100%; mask-size: 100% 100%;
  background: linear-gradient(240deg, rgba(255,214,150,.55), rgba(255,190,120,.12) 38%, rgba(30,14,6,.35) 78%); mix-blend-mode: soft-light; }
.sb-cast .fig.back img { filter: sepia(.24) saturate(.85) brightness(.74) contrast(1.02) drop-shadow(0 -2px 3px rgba(255,214,140,.35)) drop-shadow(-12px 18px 22px rgba(12,5,2,.8)); }
.sb-cast .fig:hover img, .sb-cast .fig.hot img { filter: sepia(.1) saturate(1) brightness(1.06) contrast(1.05) drop-shadow(0 0 3px rgba(255,220,150,.95)) drop-shadow(0 0 22px rgba(255,190,90,.55)) drop-shadow(-14px 22px 26px rgba(12,5,2,.85)); }
.sb-cast .fig.cameo { bottom: calc(var(--db) + var(--dh) - 4cqh); height: calc(var(--s) * 76cqh); aspect-ratio: 260 / 400; }
.sb-cast .fig.cameo > svg { width: 100%; height: 100%; display: block; }
.sb-cast .fig.cameo:hover > svg, .sb-cast .fig.cameo.hot > svg { filter: drop-shadow(0 0 16px rgba(255,200,110,.6)); }
/* ---------- Chapter header ---------- */
.sb-head { position: absolute; top: 2.4cqh; left: max(2.2cqw, calc(min(21cqw, 34cqh) * .42)); height: clamp(76px, 12cqh, 112px); display: flex; align-items: center; filter: drop-shadow(0 10px 14px rgba(0,0,0,.6)); }
.sb-head .astro { width: auto; height: 100%; aspect-ratio: 1; position: relative; z-index: 2; flex: none; }
.sb-head .astro svg { width: 100%; height: 100%; }
.sb-head .scroll { position: relative; height: 82%; margin-left: -6%; display: flex; flex-direction: column; justify-content: center; padding: 0 clamp(26px, 4cqh, 40px) 0 clamp(26px, 4.4cqh, 44px); min-width: clamp(220px, 30cqh, 300px); }
.sb-head .scroll > .band { position: absolute; inset: 0; width: 100%; height: 100%; z-index: -1; }
.sb-head .scroll > .end { position: absolute; right: -2.2%; top: -12%; height: 124%; width: auto; aspect-ratio: 40/110; transform: translateX(50%); }
.sb-head .kick { font: 600 clamp(10px, 1.35cqh, 14px)/1.2 "Gambit Cinzel", serif; letter-spacing: .2em; text-transform: uppercase; color: #7a3b16; white-space: nowrap; }
.sb-head .kick i { font-style: normal; color: #a8742f; padding: 0 .35em; }
.sb-head .ttl { font: italic 400 clamp(20px, 3.3cqh, 34px)/1.05 "Gambit Fell", serif; color: #3a1a08; white-space: nowrap; max-width: 46cqw; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 1px 0 rgba(255,246,220,.6); }

/* ---------- Bookmarks (status) ---------- */
.sb-marks { position: absolute; top: 0; right: calc(min(21cqw, 34cqh) + 1.2cqw); display: flex; gap: clamp(6px, 1cqh, 12px); align-items: flex-start; }
.sb-marks .bm { position: relative; display: block; width: clamp(48px, 7.2cqh, 70px); transform-origin: 50% 0; transition: transform .35s cubic-bezier(.3,1.5,.5,1); }
.sb-marks .bm svg { width: 100%; height: auto; display: block; }
.sb-marks button.bm:hover, .sb-marks button.bm:focus-visible { transform: translateY(5px) rotate(-1.5deg); }
.sb-marks .bm:nth-child(2) { animation-delay: -1.3s; }
.sb-wave { animation: sbWave 2.6s linear infinite; }

/* ---------- The dialogue page ---------- */
.sb-dlg { position: absolute; left: calc(50cqw - var(--dw) / 2); bottom: var(--db); width: var(--dw); height: var(--dh); }
.sb-dlg > .frame { position: absolute; left: -78px; top: -26px; pointer-events: none; }
.sb-dlg > .frame svg { display: block; }
.sb-dlg > .vellum { position: absolute; inset: 0; background: url(${parch}) 0 0 / 100% 100% no-repeat; }
.sb-dlg .page { position: absolute; inset: calc(14px + 2.2cqh) clamp(56px, 6cqh, 70px) clamp(18px, 2.6cqh, 28px) clamp(40px, 5cqh, 58px); overflow-y: auto; scrollbar-width: none; overscroll-behavior: contain;
  -webkit-mask-image: linear-gradient(180deg, transparent 0, #000 18px, #000 100%); mask-image: linear-gradient(180deg, transparent 0, #000 18px, #000 100%); }
.sb-dlg .page::-webkit-scrollbar { display: none; }
.sb-dlg .page { bottom: calc(clamp(18px, 2.6cqh, 28px) + 54px); }
.sb-say { position: absolute; z-index: 3; left: clamp(40px, 5cqh, 58px); right: clamp(56px, 6cqh, 70px); bottom: clamp(14px, 2.2cqh, 24px); display: flex; gap: 8px; align-items: stretch; }
.sb-say[hidden] { display: none; }
.sb-say textarea { flex: 1; min-width: 0; height: 46px; resize: none; padding: 11px 12px; border: 1px solid rgba(74,38,12,.55); border-radius: 3px; background: rgba(255,248,226,.72); color: var(--ink); font-family: inherit; font-style: italic; font-weight: 500; font-size: 17px; line-height: 1.3; }
.sb-say textarea:focus { outline: 2px solid #8a1f1a; outline-offset: 1px; }
.sb-say button { min-width: 72px; height: 46px; border: 1px solid #2a1205; border-radius: 3px; background: #7a1a16; color: #f6e6c0; font-family: inherit; font-weight: 600; font-size: 16px; cursor: pointer; }
.sb-say button:disabled, .sb-say textarea:disabled { opacity: .55; cursor: default; }
/* Once the player is writing, the page is what they came for: it grows, and the rest gives way. */
@container stage (min-width: 761px) and (min-height: 481px) { .sb.writing .sb-st > * { --dh: clamp(260px, 38cqh, 460px); } }
@container stage (max-width: 760px) {
  .sb-dlg .page { bottom: 56px !important; }
  .sb-say { left: 8px; right: 8px; bottom: 6px; }
  .sb-say textarea { font-size: 16px; }
}
@container stage (max-width: 760px) and (min-height: 481px) { .sb.writing .sb-st > * { --dh: 50cqh; --ch: calc(1.5 * (var(--ribh) + 4px) + 8px); } }
@container stage (max-height: 480px) {
  .sb-dlg .page { bottom: 56px !important; }
  .sb-say { left: 10px; right: 10px; bottom: 6px; }
  .sb-say textarea { font-size: 16px; }
}
.sb-dlg .beat { margin-top: .7em; }
.sb-dlg .beat .said { margin: 0 0 .25em; padding-left: .7em; border-left: 2px solid #8a1f1a; font-style: italic; }
.sb-dlg .beat .roll { margin: 0 0 .25em; font-size: .82em; font-weight: 700; color: #7a1a16; }
.sb-dlg .beat .told { margin: 0 0 .4em; }
.sb-dlg .txt { min-height: 100%; font-size: var(--fs); line-height: 1.46; font-weight: 500; color: var(--ink); padding-top: 4px; }
.sb-dlg .txt.two { display: grid; grid-template-columns: minmax(0, 58fr) minmax(240px, 42fr); gap: clamp(14px, 2cqh, 26px); }
.sb-dlg .main { max-width: 46em; }
.sb-dlg .desc { margin: 0 0 .3em; min-height: 2.5em; }
.sb-dlg .desc .dc { float: left; width: 2.4em; height: 2.4em; margin: .2em 1px 0 -.1em; }
.sb-dlg .desc.lone .dc { margin-right: .35em; }
.sb-dlg .desc .fw { font-variant: small-caps; letter-spacing: .04em; font-weight: 600; }
.sb-dlg .desc { line-height: 1.4; color: #261409; }
.sb-dlg .now { margin: .45em 0 0; font-style: italic; font-weight: 600; font-size: .9em; color: #4a2511; }
.sb-dlg .now::before { content: "❧ "; color: #9c3b26; font-style: normal; }
.sb-dlg .fresh { animation: sbInk .9s ease both; }
.sb-dlg .margin { position: relative; overflow-y: auto; scrollbar-width: none; max-height: calc(var(--dh) - 2.2cqh - 36px); padding-left: 34px; font-size: clamp(15px, min(2.1cqh, 1cqw), 19px); line-height: 1.5; color: #52341e; font-style: italic; }
.sb-dlg .margin .dv { position: absolute; left: 0; top: 0; width: 22px; height: 100%; }
.sb-dlg .margin .dvk { position: absolute; left: 0; top: calc(50% - 12px); width: 24px; height: 24px; }
.sb-dlg .margin::-webkit-scrollbar { display: none; }
.sb-dlg .margin .mh { font: 800 clamp(10px, 1.25cqh, 12px)/1 "Gambit Cinzel", serif; letter-spacing: .24em; text-transform: uppercase; color: #8a5a2a; margin: 2px 0 6px; }
.sb-dlg .log { list-style: none; margin: 0; padding: 0; font-style: italic; }
.sb-dlg .log li { position: relative; padding-left: 1.1em; color: #52341e; margin-bottom: .1em; }
.sb-dlg .log li::before { content: "❧"; position: absolute; left: 0; top: 0; color: #9c3b26; font-style: normal; font-size: .9em; }
.sb-dlg .log li:last-child { color: #3a2010; }
.sb-dlg .busy { display: flex; align-items: center; gap: .5em; margin-top: .3em; font-style: italic; color: #7a3b16; font-size: .92em; }
.sb-dlg .busy svg { width: 1.8em; height: 1.8em; animation: sbWrite 1.1s ease-in-out infinite; transform-origin: 10% 90%; }
.sb-dlg .busy .dots i { display: inline-block; width: .3em; height: .3em; margin: 0 .12em; border-radius: 50%; background: #7a3b16; animation: sbDot 1.2s ease-in-out infinite; }
.sb-dlg .busy .dots i:nth-child(2) { animation-delay: .2s; } .sb-dlg .busy .dots i:nth-child(3) { animation-delay: .4s; }
.sb-dlg .nib { position: absolute; right: clamp(22px, 3cqh, 34px); bottom: clamp(12px, 2cqh, 22px); width: clamp(22px, 3.2cqh, 32px); pointer-events: none; animation: sbBob 1.2s ease-in-out infinite; }
.sb-dlg .nib svg { width: 100%; height: auto; display: block; }
.sb.busy .sb-dlg .nib { display: none; }
.sb-dlg .plate { position: absolute; left: clamp(28px, 4cqh, 52px); top: calc(-1 * clamp(22px, 3cqh, 27px)); height: clamp(42px, 5.6cqh, 52px); display: flex; align-items: stretch; filter: drop-shadow(0 6px 8px rgba(0,0,0,.6)); z-index: 3; }
.sb-dlg .plate .cap { width: clamp(36px, 4.8cqh, 46px); flex: none; }
.sb-dlg .plate .cap svg, .sb-dlg .plate .band > svg { width: 100%; height: 100%; display: block; }
.sb-dlg .plate .band { position: relative; display: flex; align-items: center; padding: 0 clamp(12px, 2cqh, 22px); margin: 0 -1px; }
.sb-dlg .plate .band > svg { position: absolute; inset: 0; z-index: -1; }
.sb-dlg .plate .nm { font: 700 clamp(18px, 2.5cqh, 25px)/1 "Gambit Garamond", serif; color: #ffefc7; text-shadow: 0 2px 3px #000; white-space: nowrap; letter-spacing: .02em; }
.sb-dlg .plate .seal { width: clamp(46px, 6.6cqh, 62px); margin: -6px 0 0 -8px; align-self: center; transform: rotate(-12deg); animation: sbStamp .5s cubic-bezier(.3,1.7,.5,1) both; }
.sb-dlg .plate .seal svg { width: 100%; height: auto; display: block; }

/* Index tabs (Journal, Classes, Binding): notched leather on the page's top rim, mirroring the nameplate. */
.sb-dlg .tabs { position: absolute; right: clamp(44px, 5.4cqh, 66px); top: calc(-1 * clamp(19px, 2.3cqh, 23px)); display: flex; gap: clamp(4px, .7cqh, 8px); z-index: 3; }
.sb-dlg .tab { position: relative; display: flex; align-items: center; justify-content: center; gap: 7px; height: clamp(36px, 4.3cqh, 44px); width: clamp(122px, 14cqh, 152px); color: #f3d791;
  font: 800 clamp(11px, 1.3cqh, 13px)/1 "Gambit Cinzel", serif; letter-spacing: .14em; text-transform: uppercase; text-shadow: 0 1px 2px #000;
  filter: drop-shadow(0 6px 6px rgba(0,0,0,.5)); transition: transform .3s cubic-bezier(.3,1.5,.5,1), filter .2s; }
.sb-dlg .tab .tab-art { position: absolute; inset: 0; width: 100%; height: 100%; z-index: -1; }
.sb-dlg .tab .ic { width: 1.6em; height: 1.6em; flex: none; }
.sb-dlg .tab:hover, .sb-dlg .tab:focus-visible { transform: translateY(-4px); filter: brightness(1.15) drop-shadow(0 6px 6px rgba(0,0,0,.5)); }
.sb-dlg .tab:focus-visible { outline: none; filter: brightness(1.2) drop-shadow(0 0 6px #ffd27a); }
.sb-dlg .tab[aria-pressed="true"], .sb-dlg .tab[aria-expanded="true"] { transform: translateY(-6px); filter: brightness(1.25) drop-shadow(0 0 8px rgba(255,200,110,.6)); }

/* ---------- Choices: ribbons ---------- */
.sb-choices { position: absolute; right: 5cqw; width: clamp(300px, 42cqh, 380px); top: 19cqh; bottom: calc(var(--db) + var(--dh) + 44px);
  display: flex; flex-direction: column; justify-content: flex-start; gap: clamp(5px, .9cqh, 10px); overflow-y: auto; overflow-x: visible; scrollbar-width: none; padding: 6px 4px 8px 30px; }
.sb-choices::-webkit-scrollbar { display: none; }
.sb-choices > :first-child { margin-top: auto; }
.sb-choices > :last-child { margin-bottom: auto; }
.sb-choices .rubric { font: italic 400 clamp(19px, 2.6cqh, 27px)/1.2 "Gambit Fell", serif; color: #fbe8bf; text-shadow: 0 2px 12px #000, 0 0 24px #000, 0 0 3px #000; text-align: center; margin: 0 0 4px 24px; padding: 4px 0; display: flex; align-items: center; gap: 10px; justify-content: center; flex: none;
  background: radial-gradient(ellipse 50% 60% at 50% 55%, rgba(12,6,3,.78), rgba(12,6,3,.35) 60%, transparent 75%); }
.sb-choices .rubric::before, .sb-choices .rubric::after { content: ""; flex: 1; height: 10px; background: ${rule()} center / 100% 100% no-repeat; filter: sepia(1) saturate(2) brightness(1.6); opacity: .8; max-width: 70px; }
.sb-choices .rib { position: relative; flex: none; display: flex; align-items: center; gap: 10px; height: clamp(44px, 5cqh, 52px); padding: 0 60px 0 0; translate: var(--dx, 0px) 0; text-align: left; color: #fdf0d5;
  transition: transform .4s cubic-bezier(.3,1.5,.45,1), filter .25s; }
.sb-choices .rib.enter { animation: sbUnfurl .55s cubic-bezier(.2,.9,.3,1.1) both; animation-delay: calc(var(--i) * 45ms); }
.sb-choices .rib .rib-art { position: absolute; inset: 0 0 0 calc(clamp(42px, 5.6cqh, 52px) * .45); width: calc(100% - clamp(42px, 5.6cqh, 52px) * .45); height: 100%; z-index: -1; filter: drop-shadow(0 6px 8px rgba(0,0,0,.55)); }
.sb-choices .rib .med { width: clamp(46px, 6.2cqh, 58px); height: clamp(46px, 6.2cqh, 58px); flex: none; margin-left: -4px; transition: transform .5s cubic-bezier(.3,1.5,.5,1); }
.sb-choices .rib .lb { font: 600 clamp(16px, 2cqh, 20px)/1.1 "Gambit Garamond", serif; text-shadow: 0 2px 2px rgba(0,0,0,.85); line-height: 1.05; min-width: 0; }
.sb-choices .rib .n { position: absolute; right: 30px; padding-left: 10px; border-left: 1px dotted rgba(224,179,106,.6); font: 800 11px/1 "Gambit Cinzel", serif; color: #e0b36a; opacity: .7; }
.sb-choices .rib .sheen { position: absolute; inset: 3px 6px 3px 30px; overflow: hidden; pointer-events: none; z-index: -1; clip-path: polygon(0 50%, 3% 0, 100% 0, 96% 50%, 100% 100%, 3% 100%); }
.sb-choices .rib .sheen::after { content: ""; position: absolute; top: 0; bottom: 0; width: 40%; left: -50%; background: linear-gradient(100deg, transparent, rgba(255,236,190,.38), transparent); transform: skewX(-18deg); }
.sb-choices .rib .ptr { position: absolute; left: -26px; top: 50%; width: 18px; height: 18px; margin-top: -9px; opacity: 0; transform: translateX(8px); transition: opacity .2s, transform .3s; color: #ffd27a; filter: drop-shadow(0 0 6px rgba(255,200,110,.8)); }
.sb-choices .rib:hover, .sb-choices .rib:focus-visible { transform: translateX(-12px) scale(1.03); filter: brightness(1.12); }
.sb-choices .rib:hover .sheen::after, .sb-choices .rib:focus-visible .sheen::after { animation: sbSheen .8s ease; }
.sb-choices .rib:hover .ptr, .sb-choices .rib:focus-visible .ptr { opacity: 1; transform: none; }
.sb-choices .rib:hover .med, .sb-choices .rib:focus-visible .med { transform: rotate(-14deg); }
.sb-choices .rib:active { transform: translateX(-8px) scale(.99); }
.sb-choices .rib:focus-visible { outline: none; filter: brightness(1.15) drop-shadow(0 0 7px #ffd27a); }
.sb.busy .sb-choices .rib { filter: saturate(.6) brightness(.8); }

/* Delve: the compass rose. */
.sb-choices .rose { position: relative; flex: none; width: clamp(200px, 32cqh, 290px); filter: drop-shadow(0 14px 18px rgba(0,0,0,.7)); aspect-ratio: 1; align-self: center; margin-bottom: 4px; }
.sb-choices .rose > svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.sb-choices .rose .mv { position: absolute; width: 17%; aspect-ratio: 1; display: grid; place-items: center; transform: translate(-50%,-50%); color: #2a1205; border-radius: 50%; transition: transform .25s cubic-bezier(.3,1.6,.5,1), filter .2s; }
.sb-choices .rose .mv .ic { width: 52%; height: 52%; stroke-width: 1.4; fill: #fff1c2; color: #3a1a08; filter: drop-shadow(0 1px 1px rgba(0,0,0,.6)); }
.sb-choices .rose .mv span { position: absolute; top: 100%; font: 800 10px/1 "Gambit Cinzel", serif; letter-spacing: .12em; text-transform: uppercase; color: #f6e2b8; text-shadow: 0 1px 3px #000; white-space: nowrap; margin-top: -6px; }
.sb-choices .rose .mv:hover, .sb-choices .rose .mv:focus-visible { transform: translate(-50%,-50%) scale(1.14); filter: drop-shadow(0 0 10px rgba(255,210,120,.9)); }
.sb-choices .rose .mv.c { width: 26%; }
.sb-choices .rose .mv.c .ic { fill: none; color: #3a1a08; stroke-width: 1.8; }

/* ---------- The delve: the corridor as an illustration in a gilt arch ---------- */
.sb-pagebg { position: absolute; inset: 0; display: none; background: radial-gradient(ellipse 70% 72% at 50% 42%, rgba(46,28,16,.35), rgba(16,9,5,.75) 70%, rgba(8,5,3,.97) 100%), url(${hide}) center / 256px, #1b120c; }
.sb-pagebg .wm { position: absolute; top: 10%; width: min(28cqw, 70cqh); height: auto; color: #d9ad62; opacity: .09; }
.sb-pagebg .wm.l { left: -2cqw; } .sb-pagebg .wm.r { right: -2cqw; transform: scaleX(-1); }
.sb-ap { position: absolute; left: 17cqw; width: 60cqw; top: 9cqh; height: 66cqh; display: none; pointer-events: none; }
.sb-ap > div { position: absolute; inset: 0; }
.sb-ap .ink, .sb-ap .torch, .sb-ap .vg { clip-path: inset(0 round 50% 50% 0 0 / 22% 22% 0 0); }
.sb-ap .ink { background: url(${page}) center / cover; mix-blend-mode: multiply; opacity: .45; }
.sb-ap .torch { background: radial-gradient(ellipse 60% 62% at 50% 108%, rgba(255,170,68,.5), rgba(255,150,60,.14) 45%, transparent 72%); mix-blend-mode: screen; }
.sb-ap .fog { background: radial-gradient(ellipse 13% 22% at 50% 46%, rgba(15,8,5,.95), rgba(15,8,5,.75) 45%, rgba(15,8,5,0) 100%); clip-path: inset(0 round 50% 50% 0 0 / 22% 22% 0 0); }
.sb-ap .brush { background: url(${brushwork()}) center / cover; mix-blend-mode: soft-light; opacity: .5; clip-path: inset(0 round 50% 50% 0 0 / 22% 22% 0 0); }
.sb-ap .vg { background: radial-gradient(ellipse 72% 80% at 50% 60%, transparent 45%, rgba(40,20,8,.55) 80%, rgba(18,10,6,.9) 100%); }
.sb-ap .fr { inset: auto; left: -40px; top: -50px; }
.sb-ap .fr svg { display: block; }
.sb[data-mode="delve"] .sb-pagebg, .sb[data-mode="delve"] .sb-ap { display: block; }
.sb[data-mode="delve"] .sb-bg { inset: auto; left: 17cqw; width: 60cqw; top: 9cqh; height: 66cqh; clip-path: inset(0 round 50% 50% 0 0 / 22% 22% 0 0); transform: none !important; }
.sb[data-mode="delve"] .sb-bg > .world { filter: sepia(.45) saturate(.85) contrast(1.12) brightness(1.02); }
.sb[data-mode="delve"] .sb-rays, .sb[data-mode="delve"] .sb-grade { display: none; }
.sb[data-mode="delve"] .sb-vig { background: radial-gradient(ellipse 80% 75% at 50% 42%, transparent 60%, rgba(10,5,2,.6) 100%); box-shadow: inset 0 0 120px rgba(18,9,4,.7); }

/* ---------- Map folio (frontier overland, delve automap) ---------- */
.sb-folio { position: absolute; left: 2.2cqw; top: calc(3.6cqh + clamp(76px, 12cqh, 112px)); width: min(30cqw, 58cqh); height: 46cqh; transform: perspective(1200px) rotateX(8deg) rotateZ(-1.2deg); transform-origin: 50% 100%; filter: drop-shadow(0 18px 20px rgba(0,0,0,.6)); }
.sb-folio > svg.fr { position: absolute; inset: 0; width: 100%; height: 100%; }
.sb-folio .fl-t { position: absolute; top: 5%; left: 0; right: 0; text-align: center; font: italic 400 clamp(15px, 2.2cqh, 22px)/1 "Gambit Fell", serif; color: #5a2a10; }
.sb-folio .hexmap, .sb-folio canvas { position: absolute; left: 6%; right: 6%; top: 15%; bottom: 6%; width: 88%; height: 79%; }
.sb-folio.delve { left: 2cqw; width: min(13.5cqw, 30cqh); height: 30cqh; }
.sb-folio .hexmap { --hex-plain: #c9bf84; --hex-wood: #7f9a5e; --hex-hill: #bf9d6a; --hex-water: #86a7b4; --hex-ruin: #a39087; }
.sb-folio .hexmap polygon { stroke: #6b4a2a; stroke-width: .9; opacity: .92; }
.sb-folio .hexmap polygon.fog { fill: url(#sb-hatch); opacity: .55; stroke: rgba(107,74,42,.3); }
.sb-folio .hexmap g.here polygon { stroke: #8b1a1a; stroke-width: 2.6; }
.sb-folio .hexmap g.step, .sb-folio .hexmap g.goto { cursor: pointer; }
.sb-folio .hexmap g.step polygon { stroke: #a8742f; stroke-width: 1.6; }
.sb-folio .hexmap g.goto polygon { stroke: #8b1a1a; stroke-width: 1.4; stroke-dasharray: 3 2; }
.sb-folio .hexmap g.step:hover polygon, .sb-folio .hexmap g.step:focus polygon, .sb-folio .hexmap g.goto:hover polygon, .sb-folio .hexmap g.goto:focus polygon { filter: brightness(1.18); stroke: #ffd27a; stroke-width: 2.6; outline: none; }
.sb-folio .hexmap circle.pin { fill: url(#sb-wax); stroke: #3e0606; stroke-width: .8; }
.sb-folio .hexmap circle.you { fill: url(#sb-gold); stroke: #3a1a08; stroke-width: 1.4; }
.sb-folio .hexmap text { font: italic 600 8.5px "Gambit Garamond", serif; fill: #3a1a08; paint-order: stroke; stroke: rgba(240,224,190,.85); stroke-width: 2.4px; pointer-events: none; }
.sb-folio.delve canvas { image-rendering: auto; background: repeating-linear-gradient(45deg, rgba(90,58,28,.28) 0 1px, transparent 1px 5px), repeating-linear-gradient(-45deg, rgba(90,58,28,.2) 0 1px, transparent 1px 6px); }
.sb-folio .pin { position: absolute; left: 6%; top: -12px; width: 38px; }
.sb-folio .pin svg { width: 100%; height: auto; display: block; }
.sb-folio .keys { position: absolute; bottom: 4%; left: 0; right: 0; text-align: center; font: 700 12px "Gambit Cinzel", serif; letter-spacing: .14em; color: #5a2a10; }

/* ---------- Theme slip ---------- */
.sb-slip { position: absolute; z-index: 30; display: grid; gap: 6px; padding: 18px 18px 16px; width: 230px; color: var(--ink);
  background: url(${parch}) center / cover; border: 10px solid transparent; border-image: ${giltBorder()} 22 stretch; box-shadow: 0 18px 40px rgba(0,0,0,.7); animation: sbIn .3s ease both; }
.sb-slip h4 { margin: 0 0 4px; font: italic 400 20px/1 "Gambit Fell", serif; text-align: center; color: #5a2a10; }
.sb-slip button { display: flex; align-items: center; gap: 8px; padding: 6px 10px; font: 600 17px/1.1 "Gambit Garamond", serif; text-align: left; color: var(--ink); border-bottom: 1px dashed rgba(122,76,28,.4); }
.sb-slip button::before { content: "❦"; color: #a8742f; }
.sb-slip button[aria-current="true"] { color: #8b1a1a; }
.sb-slip button[aria-current="true"]::before { content: "✦"; color: #8b1a1a; }
.sb-slip button:hover, .sb-slip button:focus-visible { background: rgba(168,116,47,.16); }

/* ---------- The journal: an open book ---------- */
.sb-jr { position: absolute; inset: 0; z-index: 25; display: grid; place-items: center; background: radial-gradient(ellipse at 50% 45%, rgba(20,10,4,.55), rgba(8,4,2,.9)); animation: sbIn .35s ease both; perspective: 1600px; }
.sb-jr .book { position: relative; width: min(1180px, 94cqw); height: min(720px, 90cqh); transform: rotateX(3deg); transform-style: preserve-3d; animation: sbOpen .6s cubic-bezier(.2,.8,.2,1) both; }
.sb-jr .cover { position: absolute; inset: -30px -44px -46px; background: url(${blood}) center / 256px; border-radius: 10px 10px 14px 14px; box-shadow: 0 40px 70px rgba(0,0,0,.85), inset 0 0 40px rgba(0,0,0,.7), inset 0 2px 0 rgba(255,200,160,.2); }
.sb-jr .cover::after { content: ""; position: absolute; inset: 9px; border: 1.5px dashed rgba(217,173,98,.55); border-radius: 6px; }
.sb-jr .bc { position: absolute; width: clamp(56px, 8cqh, 84px); aspect-ratio: 1; z-index: 3; }
.sb-jr .bc svg { width: 100%; height: 100%; display: block; }
.sb-jr .bc.tl { left: -26px; top: -22px; } .sb-jr .bc.tr { right: -26px; top: -22px; transform: scaleX(-1); }
.sb-jr .bc.bl { left: -26px; bottom: -28px; transform: scaleY(-1); } .sb-jr .bc.br { right: -26px; bottom: -28px; transform: scale(-1,-1); }
.sb-jr .stack, .sb-jr .pages { -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'%3E%3Cpath d='M0,1.4 C20,0 40,.4 50,2.6 C60,.4 80,0 100,1.4 V98.6 C80,100 60,99.6 50,97.4 C40,99.6 20,100 0,98.6 Z'/%3E%3C/svg%3E") 0 0 / 100% 100% no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'%3E%3Cpath d='M0,1.4 C20,0 40,.4 50,2.6 C60,.4 80,0 100,1.4 V98.6 C80,100 60,99.6 50,97.4 C40,99.6 20,100 0,98.6 Z'/%3E%3C/svg%3E") 0 0 / 100% 100% no-repeat; }
.sb-jr .stack { position: absolute; box-shadow: 0 2px 3px rgba(0,0,0,.5); }
.sb-jr .stack.s1 { inset: -4px -9px -9px; background: repeating-linear-gradient(180deg, rgba(90,60,30,.22) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(90,60,30,.22) 0 1px, transparent 1px 3px), #d8c39e; }
.sb-jr .stack.s2 { inset: -8px -17px -16px; background: repeating-linear-gradient(180deg, rgba(70,45,20,.25) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(70,45,20,.25) 0 1px, transparent 1px 3px), #bda57d; }
.sb-jr .stack.s3 { inset: -12px -25px -23px; background: repeating-linear-gradient(180deg, rgba(50,30,12,.3) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(50,30,12,.3) 0 1px, transparent 1px 3px), #9e8660; }
.sb-jr .pages { position: absolute; inset: 0; display: grid; grid-template-columns: 1fr 1fr; }
.sb-jr .pg { position: relative; overflow: auto; scrollbar-width: thin; scrollbar-color: #a8742f transparent; padding: clamp(26px, 5cqh, 52px) clamp(28px, 4.4cqw, 64px) clamp(24px, 4cqh, 40px); background: url(${page}) center / cover; color: var(--ink);
  font: 500 clamp(16px, 2.1cqh, 20px)/1.5 "Gambit Garamond", serif; }
.sb-jr .pg.l { box-shadow: inset -70px 0 60px -40px rgba(70,35,10,.7), inset 30px 0 40px -30px rgba(255,248,230,.3), inset 0 0 60px rgba(92,48,18,.35); }
.sb-jr .pg.r { box-shadow: inset 70px 0 60px -40px rgba(70,35,10,.7), inset -30px 0 40px -30px rgba(255,248,230,.3), inset 0 0 60px rgba(92,48,18,.35); }
.sb-jr .spine { position: absolute; top: 1.5%; bottom: 1.5%; left: calc(50% - 50px); width: 100px; pointer-events: none; background: linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(255,246,225,.18) 22%, rgba(45,20,5,.35) 40%, rgba(20,8,0,.75) 50%, rgba(45,20,5,.32) 60%, rgba(255,246,225,.16) 78%, rgba(0,0,0,0) 100%); }
.sb-jr .chron { text-align: center; margin: 0 0 .6em; }
.sb-jr .chron small { display: block; font: 600 12px/1 "Gambit Cinzel", serif; letter-spacing: .26em; color: #8a5a2a; text-transform: uppercase; }
.sb-jr .chron b { display: block; font: italic 400 clamp(26px, 4cqh, 38px)/1.1 "Gambit Fell", serif; color: #5a1a10; margin-top: .15em; }
.sb-jr h3 { margin: 1.1em 0 .5em; padding-bottom: 14px; font: 800 clamp(14px, 1.9cqh, 17px)/1 "Gambit Cinzel", serif; letter-spacing: .2em; text-transform: uppercase; color: #6a1418; text-align: center; background: ${rule()} center bottom / min(100%, 300px) 14px no-repeat; }
.sb-jr h3:first-of-type { margin-top: .2em; }
.sb-jr ul { margin: 0; padding: 0 0 0 1.1em; list-style: none; }
.sb-jr li { position: relative; margin: .25em 0; }
.sb-jr li::before { content: "❧"; position: absolute; left: -1.1em; color: #9c3b26; font-size: .85em; top: .1em; }
.sb-jr li ul li::before { content: "◦"; color: #8a5a2a; }
.sb-jr li.done { color: rgba(43,23,10,.55); text-decoration: line-through; text-decoration-color: rgba(139,26,26,.6); }
.sb-jr li.bond { color: #6a1418; }
.sb-jr .muted { font-style: italic; color: rgba(43,23,10,.58); font-size: .95em; }
.sb-jr b { font-weight: 700; color: #3a1a08; }
.sb-jr .seals { display: inline-flex; align-items: center; gap: 3px; margin: 0 10px; vertical-align: middle; }
.sb-jr .seals svg { width: 19px; height: 19px; filter: drop-shadow(0 1px 1px rgba(60,30,10,.4)); }
.sb-jr .seals em { margin-left: 6px; font-size: .88em; color: #7a3b16; }
.sb-jr .shut { position: absolute; top: -18px; left: calc(50% - 28px); width: 56px; height: clamp(120px, 20cqh, 170px); z-index: 4; filter: drop-shadow(0 6px 6px rgba(0,0,0,.55)); transition: transform .3s cubic-bezier(.3,1.6,.5,1); }
.sb-jr .shut svg { width: 100%; height: 100%; display: block; }
.sb-jr .shut:hover, .sb-jr .shut:focus-visible { transform: translateY(6px); }
.sb-jr .shut:focus-visible { outline: none; filter: drop-shadow(0 0 3px #ffd27a) drop-shadow(0 0 10px rgba(255,200,110,.8)); }

/* ---------- Host overlays restyled into the book ---------- */
.gs.storybook > .fg { top: 6%; right: max(3%, calc(50% - 95cqh + 2%)); bottom: 6%; width: min(600px, calc(100% - 24px)); border: 14px solid transparent; border-image: ${giltBorder()} 22 stretch; border-radius: 0;
  background: url(${page}) center / cover; color: #2b170a; font: 500 15px/1.5 "Gambit Garamond", Georgia, serif; box-shadow: 0 30px 60px rgba(0,0,0,.8), inset 0 0 50px rgba(92,48,18,.4); }
.gs.storybook > .fg header b { font: italic 400 26px/1 "Gambit Fell", serif; color: #5a1a10; }
.gs.storybook > .fg header .x { color: #5a1a10; font-size: 22px; }
.gs.storybook > .fg nav button { border-radius: 0; border: 0; padding: 6px 14px 8px; background: url(${hide}) center / 128px; color: #f3d791; font: 800 11px/1 "Gambit Cinzel", serif; letter-spacing: .14em; text-transform: uppercase; clip-path: polygon(0 0, 100% 0, 100% 78%, 50% 100%, 0 78%); }
.gs.storybook > .fg nav button[aria-selected="true"] { background: url(${blood}) center / 128px; color: #fff1c2; }
.gs.storybook > .fg .cls { border-radius: 0; border-bottom: 1px dashed rgba(122,76,28,.35); }
.gs.storybook > .fg .cls.on { border: 1px solid rgba(168,116,47,.6); background: rgba(217,173,98,.16); }
.gs.storybook > .fg .cls .pic, .gs.storybook > .fg .pending .pic { border-radius: 50% 50% 6px 6px; box-shadow: 0 0 0 2px #a8742f, 0 0 0 4px #3a1a08; }
.gs.storybook > .fg .tag { background: rgba(106,20,24,.12); color: #6a1418; }
.gs.storybook > .fg .stars { color: #a8742f; }
.gs.storybook > .fg button.go { background: radial-gradient(circle at 40% 35%, #c84236, #7a1418); color: #ffe7d0; border-radius: 4px; box-shadow: 0 2px 0 #3e0606; font: 800 12px/1.4 "Gambit Cinzel", serif; letter-spacing: .08em; }
.gs.storybook > .fg button.plain { background: rgba(168,116,47,.14); color: #3a1a08; border: 1px solid rgba(122,76,28,.45); border-radius: 4px; }
.gs.storybook > .fg textarea, .gs.storybook > .fg select { background: rgba(255,250,236,.55); color: #2b170a; border: 1px solid rgba(122,76,28,.5); border-radius: 2px; }
.gs.storybook > .fg .sheet .sk { border-left-color: #a8742f; }
.gs.storybook > .fg .bar { background: rgba(122,76,28,.2); } .gs.storybook > .fg .bar i { background: #a8742f; }
.gs.storybook > .fg .pending { border-color: #a8742f; background: rgba(217,173,98,.14); border-radius: 0; }
.gs.storybook > .fg .pending .changes { color: #6a1418; }
.gs.storybook > .fg .opt { border-color: rgba(122,76,28,.4); border-radius: 0; }
.gs.storybook > .fg .busyline { color: #6a1418; font-style: italic; }
.gs.storybook > .mw { background: radial-gradient(ellipse at 50% 42%, rgba(40,22,10,.7), rgba(8,4,2,.97)), url(${hide}) center / 256px; }
.gs.storybook .mw-title { font: italic 400 clamp(36px, 7cqh, 60px)/1 "Gambit Fell", serif; color: #f3d791; text-shadow: 0 3px 12px #000; }
.gs.storybook .mw-title::before, .gs.storybook .mw-title::after { content: "❦"; font-style: normal; font-size: .5em; vertical-align: middle; padding: 0 .6em; color: #a8742f; }
.gs.storybook .mw-art { filter: sepia(.15); }
.gs.storybook .mw-card { background: url(${page}) center / cover; border: 16px solid transparent; border-image: ${giltBorder()} 22 stretch; padding: 16px 26px 12px; box-shadow: 0 24px 50px rgba(0,0,0,.8), inset 0 0 40px rgba(92,48,18,.4); }
.gs.storybook .mw-card .mw-art { border: 0; border-image: none; box-shadow: 0 0 0 2px #a8742f, 0 0 0 4px #3a1a08, 0 8px 18px rgba(0,0,0,.5); }
.gs.storybook .mw-text { font: italic 500 clamp(20px, 3cqh, 26px)/1.5 "Gambit Garamond", serif; color: #2b170a; }
.gs.storybook .mw-dots i { background: rgba(243,215,145,.3); transform: none; border-radius: 50%; } .gs.storybook .mw-dots i.on { background: #f3d791; box-shadow: 0 0 8px #f3d791; }
.gs.storybook .mw-hint { font: 600 12px/1 "Gambit Cinzel", serif; color: #d9ad62; letter-spacing: .24em; }

/* ---------- Phone: the stage stacks: the header, the cast, the page, the choices. The page and the list always show in full; the book's frame, corners, skirt and light go, because they cost reading room. ---------- */
@container stage (max-width: 760px) {
  /* --rows is how many rows of ribbons there are (../storybook.ts), up to 3.5: the half row says that the list scrolls. */
  .sb-st > * { --ribh: 46px; --dw: calc(100cqw - 12px); --ch: calc(min(var(--rows, 3), 3.5) * (var(--ribh) + 4px) + 8px); --dh: clamp(148px, 30cqh, 230px); --db: var(--ch); --fs: 16.5px; --fb: calc(var(--db) + var(--dh) - 40px); --fh: calc(100cqh - var(--db) - var(--dh) + 20px); }
  .sb-head { top: 4px; left: 4px; height: 50px; filter: none; }
  .sb-head .astro { height: 100%; }
  .sb-head .scroll { min-width: 0; height: 88%; padding: 0 12px 0 18px; max-width: calc(100cqw - 196px); box-sizing: border-box; }
  .sb:has(.sb-marks .bm:nth-child(4)) .sb-head .scroll { max-width: calc(100cqw - 238px); }
  .sb-head .scroll > .end { display: none; }
  .sb-head .ttl { font-size: 18px; max-width: 100%; }
  .sb-head .kick { font-size: 12px; line-height: 1; padding-top: 3px; letter-spacing: .02em; overflow: hidden; text-overflow: ellipsis; }
  .sb-head .kick i { padding: 0 .15em; }
  .sb-marks { right: 4px; gap: 2px; }
  .sb-marks .bm { width: 41px; }
  /* The emblem says what it is (the full words are its label): a word small enough to fit could not be read. */
  .sb-marks .bm svg text:nth-of-type(1) { font-size: 21px; }
  .sb-marks .bm svg text:nth-of-type(2) { display: none; }
  .sb-dlg { left: 6px; }
  .sb-dlg > .frame { display: none; }
  .sb-dlg > .vellum { clip-path: none !important; box-shadow: 0 0 0 2px #d9ad62, 0 0 0 4px #2a1205, 0 4px 10px rgba(0,0,0,.6); }
  .sb-dlg .page { inset: 30px 12px 0 12px; touch-action: pan-y; -webkit-mask-image: linear-gradient(180deg, transparent 0, #000 10px, #000 calc(100% - 14px), transparent 100%); mask-image: linear-gradient(180deg, transparent 0, #000 10px, #000 calc(100% - 14px), transparent 100%); }
  .sb-dlg .txt { padding: 4px 0 14px; }
  .sb-dlg .desc .dc { width: 2.1em; height: 2.1em; }
  .sb-dlg .plate { left: 4px; top: -12px; height: 38px; filter: none; max-width: calc(100cqw - 170px); }
  .sb-dlg .plate .cap { width: 26px; }
  .sb-dlg .plate .band { padding: 0 6px; min-width: 0; }
  .sb-dlg .plate .nm { font-size: 17px; overflow: hidden; text-overflow: ellipsis; }
  .sb-dlg .plate .seal { width: 40px; margin: 0 0 0 -6px; }
  .sb-dlg .tabs { right: 2px; top: -18px; gap: 2px; }
  .sb-dlg .tab { width: 48px; height: 44px; filter: none; }
  .sb-dlg .tab .tl { display: none; }
  .sb-dlg .tab:hover, .sb-dlg .tab:focus-visible, .sb-dlg .tab[aria-pressed="true"], .sb-dlg .tab[aria-expanded="true"] { transform: none; }
  .sb-dlg .nib { display: none; }
  .sb-choices { left: 6px; right: 6px; width: auto; top: auto; bottom: 0; height: var(--ch); padding: 4px 0 4px; margin: 0; display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: var(--ribh); gap: 4px; align-content: start; touch-action: pan-y; overscroll-behavior: contain; }
  .sb-choices > :first-child, .sb-choices > :last-child { margin: 0; }
  .sb-choices .rubric { display: none; }
  .sb-choices .rib { translate: none; height: var(--ribh); gap: 4px; padding: 0 16px 0 0; min-width: 0; }
  .sb-choices .rib.enter { animation: none; }
  .sb-choices .rib .rib-art { inset: 0 0 0 18px; width: calc(100% - 18px); filter: none; }
  .sb-choices .rib .rib-art path:first-child { display: none; }
  .sb-choices .rib .med { width: 42px; height: 42px; margin-left: 0; }
  .sb-choices .rib .lb { font-size: 15px; line-height: 1.08; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
  .sb-choices .rib .n, .sb-choices .rib .ptr, .sb-choices .rib .sheen { display: none; }
  .sb-choices .rib:hover, .sb-choices .rib:focus-visible, .sb-choices .rib:active { transform: none; }
  /* A delve: the compass beside its ribbons, every point of it a full tap target. */
  .sb-choices:has(.rose) { grid-template-columns: 150px 1fr; grid-auto-rows: 46px; }
  .sb-choices .rose { grid-column: 1; grid-row: 1 / span 3; width: 150px; height: 150px; margin: 0; filter: none; }
  .sb-choices .rose > svg text { display: none; }
  .sb-choices .rose .mv { width: 44px; height: 44px; }
  .sb-choices .rose .mv.c { width: 44px; }
  .sb-choices .rose .mv:hover, .sb-choices .rose .mv:focus-visible { transform: translate(-50%,-50%); }
  .sb-choices:has(.rose) .rib { grid-column: 2; }
  .sb[data-mode="delve"] .sb-st > * { --ch: 158px; --dh: clamp(120px, 22cqh, 170px); }
  .sb-folio .pin { display: none; }
  .sb-cast .fig.cameo { bottom: calc(var(--db) + var(--dh) - 8px); height: calc(var(--s) * (100cqh - var(--db) - var(--dh) - 66px)); }
  .sb-tags .tag { width: 150px; min-height: 46px; bottom: calc(var(--db) + var(--dh) + 26px); }
  .sb-tags .tag svg text { font-size: 16.5px; letter-spacing: .5px; }
  /* Three people share the width: narrower scrolls, larger type in them, so it lands at the same size. */
  .sb-tags:has(.tag:nth-child(3)) .tag { width: 31cqw; }
  .sb-tags:has(.tag:nth-child(3)) .tag svg text { font-size: 22px; letter-spacing: 0; }
  .sb-skirt { display: none; }
  .sb-dlg .txt.two { display: flex; flex-direction: column; gap: 6px; }
  /* What came before reads above the narration: scroll up for it (the page opens on the narration's first line). */
  .sb-dlg .margin { order: -1; max-height: none; overflow: visible; padding: 0 0 6px; font-size: 14.5px; border-bottom: 1px dashed rgba(122,76,28,.45); }
  .sb-dlg .margin .dv, .sb-dlg .margin .dvk { display: none; }
  .sb-dlg .margin .mh { font-size: 12px; letter-spacing: .12em; }
  .sb-folio { top: 60px; left: 3cqw; width: 60cqw; height: min(26cqh, calc(100cqh - var(--db) - var(--dh) - 90px)); transform: none; }
  .sb-folio.delve { width: 30cqw; height: 16cqh; top: 60px; }
  .sb-folio .fl-t { font-size: 14px; }
  .sb-folio .hexmap text { font-size: 12px; }
}
/* A short window (landscape on a phone): the page and the choices side by side under a thin header, the cast dropped behind them. */
@container stage (max-height: 480px) and (min-width: 480px) {
  .sb-st > * { --ribh: 46px; --dw: 54cqw; --dh: calc(100cqh - 62px); --db: 4px; --fs: 16.5px; --fb: -6cqh; --fh: 94cqh; --ch: calc(100cqh - 56px); }
  .sb-head { top: 3px; left: 4px; height: 44px; filter: none; }
  .sb-head .astro { height: 100%; }
  .sb-head .scroll { min-width: 0; height: 86%; padding: 0 16px 0 16px; }
  .sb-head .scroll > .end { display: none; }
  .sb-head .ttl { font-size: 17px; }
  .sb-head .kick { font-size: 12px; line-height: 1; padding-top: 3px; letter-spacing: .02em; }
  .sb-marks { right: 4px; gap: 2px; flex-direction: row; }
  .sb-marks .bm { width: 41px; height: 56px; overflow: hidden; }
  .sb-marks .bm svg text:nth-of-type(1) { font-size: 21px; }
  .sb-marks .bm svg text:nth-of-type(2) { display: none; }
  .sb-dlg { left: 6px; }
  .sb-dlg > .frame { display: none; }
  .sb-dlg > .vellum { clip-path: none !important; box-shadow: 0 0 0 2px #d9ad62, 0 0 0 4px #2a1205; }
  .sb-dlg .page { inset: 28px 12px 0 12px; touch-action: pan-y; -webkit-mask-image: linear-gradient(180deg, transparent 0, #000 10px, #000 calc(100% - 14px), transparent 100%); mask-image: linear-gradient(180deg, transparent 0, #000 10px, #000 calc(100% - 14px), transparent 100%); }
  .sb-dlg .txt { padding: 4px 0 14px; }
  .sb-dlg .txt.two { display: flex; flex-direction: column; gap: 6px; }
  .sb-dlg .margin { order: -1; max-height: none; overflow: visible; padding: 0 0 6px; font-size: 14.5px; }
  .sb-dlg .margin .dv, .sb-dlg .margin .dvk { display: none; }
  .sb-dlg .margin .mh { font-size: 12px; letter-spacing: .12em; }
  .sb-dlg .plate { left: 4px; top: -8px; height: 34px; filter: none; }
  .sb-dlg .plate .cap { width: 24px; }
  .sb-dlg .plate .nm { font-size: 16px; }
  .sb-dlg .tabs { right: 2px; top: -14px; gap: 2px; }
  .sb-dlg .tab { width: 48px; height: 44px; filter: none; }
  .sb-dlg .tab .tl { display: none; }
  .sb-dlg .tab:hover, .sb-dlg .tab:focus-visible, .sb-dlg .tab[aria-pressed="true"], .sb-dlg .tab[aria-expanded="true"] { transform: none; }
  .sb-dlg .nib { display: none; }
  .sb-skirt { display: none; }
  .sb-choices { left: calc(54cqw + 16px); right: 6px; width: auto; top: 58px; bottom: 4px; height: auto; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; justify-content: flex-start; overscroll-behavior: contain; touch-action: pan-y; }
  .sb-choices > :first-child, .sb-choices > :last-child { margin: 0; }
  .sb-choices .rubric { display: none; }
  .sb-choices .rib { translate: none; height: var(--ribh); gap: 4px; padding: 0 16px 0 0; }
  .sb-choices .rib.enter { animation: none; }
  .sb-choices .rib .rib-art { inset: 0 0 0 18px; width: calc(100% - 18px); filter: none; }
  .sb-choices .rib .med { width: 42px; height: 42px; margin-left: 0; }
  .sb-choices .rib .lb { font-size: 15px; }
  .sb-choices .rib .n, .sb-choices .rib .ptr, .sb-choices .rib .sheen { display: none; }
  .sb-choices .rib:hover, .sb-choices .rib:focus-visible, .sb-choices .rib:active { transform: none; }
  .sb-choices .rose { flex: none; width: 150px; height: 150px; margin: 0 auto 2px; filter: none; }
  .sb-choices .rose > svg text { display: none; }
  .sb-choices .rose .mv, .sb-choices .rose .mv.c { width: 44px; height: 44px; }
  .sb-choices .rose .mv:hover, .sb-choices .rose .mv:focus-visible { transform: translate(-50%,-50%); }
  .sb-folio { display: none; }
}
/* The corners are outside the stage: a short window drops them too. */
@container (max-height: 480px) {
  .sb-corners, .sb-ap .fr { display: none; }
}
@container (max-width: 760px) or (max-height: 480px) {
  .sb-rays, .sb-motes, .sb-grade { display: none; }
  .sb-vig { box-shadow: none; }
  .sb-slip { width: min(240px, calc(100cqw - 16px)); max-height: calc(100cqh - 16px); overflow-y: auto; box-sizing: border-box; }
  .sb-slip button { min-height: 44px; }
}
/* The classes panel is the host's and sits outside the theme's containers, so this one goes by the window. */
@media (max-width: 760px), (max-height: 480px) {
  .gs.storybook > .fg { font-size: 16px; }
  .gs.storybook > .fg header .x { min-width: 44px; min-height: 44px; }
  .gs.storybook > .fg nav button { min-height: 44px; padding: 6px 12px 10px; font-size: 12px; letter-spacing: .06em; }
  .gs.storybook > .fg button.go, .gs.storybook > .fg button.plain { min-height: 44px; min-width: 56px; font-size: 13px; }
  .gs.storybook > .fg summary { padding: 10px 0; }
  .gs.storybook > .fg .tag { font-size: 12px; }
}
/* Outside the stage (corners, journal, delve aperture) the window itself is the container. */
@container (max-width: 760px) {
  .sb-ap, .sb[data-mode="delve"] .sb-bg { left: 4cqw; width: 92cqw; top: 8cqh; height: 34cqh; }
  .sb-corners { display: none; }
  .sb-jr .book { width: calc(100cqw - 36px); height: calc(100cqh - 40px); }
  .sb-jr .pages { grid-template-columns: 1fr; overflow: auto; background: url(${page}) center / cover; }
  .sb-jr .pg { overflow: visible; box-shadow: none !important; padding: 24px 22px; }
  .sb-jr .pg.l { padding-top: 56px; }
  .sb-jr .spine { display: none; }
  .sb-jr .seals { display: inline-flex; align-items: center; gap: 3px; margin: 0 10px; vertical-align: middle; }
.sb-jr .seals svg { width: 19px; height: 19px; filter: drop-shadow(0 1px 1px rgba(60,30,10,.4)); }
.sb-jr .seals em { margin-left: 6px; font-size: .88em; color: #7a3b16; }
.sb-jr .shut { left: auto; right: 14px; height: 110px; }
}

@keyframes sbRise { from { opacity: 0; translate: 0 24px; } to { opacity: 1; translate: 0 0; } }
@keyframes sbUnfurl { from { opacity: 0; clip-path: inset(0 0 0 100%); } to { opacity: 1; clip-path: inset(0 0 0 -40px); } }
@keyframes sbSheen { from { left: -50%; } to { left: 120%; } }
@keyframes sbBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(5px); } }
@keyframes sbWrite { 0%,100% { transform: rotate(0) translate(0,0); } 25% { transform: rotate(-8deg) translate(2px,-1px); } 50% { transform: rotate(4deg) translate(5px,0); } 75% { transform: rotate(-4deg) translate(8px,-1px); } }
@keyframes sbDot { 0%,100% { opacity: .25; } 50% { opacity: 1; } }
@keyframes sbInk { from { opacity: 0; filter: blur(3px); } to { opacity: 1; filter: none; } }
@keyframes sbStamp { from { opacity: 0; transform: rotate(-12deg) scale(1.8); } to { opacity: 1; transform: rotate(-12deg) scale(1); } }
@keyframes sbWave { from { transform: translateX(0); } to { transform: translateX(20px); } }
@keyframes sbIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes sbOpen { from { opacity: 0; transform: rotateX(18deg) translateY(40px) scale(.94); } to { opacity: 1; transform: rotateX(3deg); } }
.sb.still *, .sb.still *::before, .sb.still *::after { animation: none !important; transition: none !important; }
`;
}
