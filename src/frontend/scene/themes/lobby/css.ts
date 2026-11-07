/**
 * The Lobby theme's stylesheet. Layout is laid out on a 1920x1080 design
 * grid: `--u` is one design pixel of the centred stage (`.lb-stage`, a size
 * container capped at a 2.1:1 safe area so an ultrawide window keeps the
 * cluster tight and shows darkened hall at the sides). Phones switch to a
 * 560-unit-wide scrolling column. CSS here is structure and lighting only;
 * every visible object is an SVG drawing from ./art.ts.
 */
const U = (n: number) => `calc(var(--u) * ${n})`;

const SERIF = `"Gambit Garamond", "Palatino Linotype", Georgia, serif`;
const CAPS = `"Gambit Cinzel", "Gambit Garamond", Georgia, serif`;
const FELL = `"Gambit Fell", "Gambit Garamond", Georgia, serif`;
const SHADOW = `0 2px 4px #000, 0 0 10px #000, 0 0 2px #000`;

/** Build the sheet; texture URLs come from ./tex.ts (generated once per page). */
export function lobbyCss(tx: { leather: string; parchment: string; chart: string }): string {
  return `
.lb { position: absolute; inset: 0; overflow: hidden; background: #0E0C0A; color: #F3E8D2; font: 500 16px/1.4 ${SERIF}; font-feature-settings: "lnum"; }
:where(.lb) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; text-align: inherit; -webkit-tap-highlight-color: transparent; }
.lb .art { display: block; width: 100%; height: 100%; overflow: visible; }
.lb button:focus-visible { outline: 1.5px dashed rgba(245,225,164,.85); outline-offset: 6px; }

/* ---------- The hall: painting, grade, light, dust, vignette ---------- */
.lb-bg { position: absolute; inset: -3%; will-change: transform; }
.lb-bg > .world { filter: saturate(.74) sepia(.22) brightness(.82) contrast(1.06); }
.lb-grade { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse 70% 80% at 30% 30%, rgba(120,84,40,.35), rgba(36,28,20,.55)); mix-blend-mode: soft-light; }
.lb-rays { position: absolute; left: -6%; top: 0; width: 70%; height: 100%; pointer-events: none; mix-blend-mode: screen; opacity: .55; will-change: transform; animation: lbRays 9s ease-in-out infinite; }
.lb-dust { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; mix-blend-mode: screen; }
.lb-shade { position: absolute; inset: 0; pointer-events: none;
  background:
    linear-gradient(90deg, rgba(8,6,4,.9) 0%, rgba(8,6,4,.35) 9%, rgba(8,6,4,0) 20%),
    linear-gradient(270deg, rgba(8,6,4,.75) 0%, rgba(8,6,4,0) 14%),
    linear-gradient(0deg, rgba(6,5,4,.95) 0%, rgba(6,5,4,.55) 10%, rgba(6,5,4,0) 24%),
    linear-gradient(180deg, rgba(6,5,4,.88) 0%, rgba(6,5,4,0) 16%),
    radial-gradient(ellipse 75% 85% at 42% 46%, rgba(0,0,0,0) 50%, rgba(0,0,0,.6) 100%); }
/* Warm light pooling up from the floor at the bottom corners. */
.lb-warm { position: absolute; inset: 0; pointer-events: none; mix-blend-mode: screen; background: radial-gradient(ellipse 34% 40% at 6% 104%, rgba(214,150,80,.2), rgba(214,150,80,0)), radial-gradient(ellipse 30% 36% at 96% 104%, rgba(214,150,80,.16), rgba(214,150,80,0)); }

/* ---------- Stage: the centred safe area, one design pixel = --u ---------- */
.lb-stage { position: absolute; inset: 0; container: lbs / size; }
.lb-stage > *, .lb-scene > * { --u: min(100cqw / 1920, 100cqh / 1080); --hc: 30.5cqw; }
.lb-scene { position: absolute; inset: 0; pointer-events: none; }
.lb-scene > * { pointer-events: auto; }
.lb-scene > .lb-glowback { pointer-events: none; }

/* ---------- Badge (top-left) ---------- */
.lb-badge { position: absolute; left: ${U(30)}; top: ${U(20)}; height: ${U(104)}; display: flex; align-items: center; z-index: 6; }
.lb-badge .md { position: relative; width: ${U(104)}; height: ${U(104)}; flex: none; z-index: 2; }
.lb-badge .sh { position: absolute; left: ${U(70)}; top: ${U(62)}; width: ${U(38)}; height: ${U(44)}; z-index: 3; }
.lb-badge .sh b { position: absolute; inset: 0 0 14% 0; display: flex; flex-direction: column; align-items: center; justify-content: center; font: 700 ${U(19)}/.9 ${SERIF}; font-feature-settings: "lnum"; font-variant-numeric: lining-nums; color: #F3E8D2; text-shadow: 0 1px 2px #000; }
.lb-badge .sh b small { font: 800 ${U(7)}/1 ${CAPS}; letter-spacing: .12em; color: #c8aa6e; }
.lb-badge .new { position: absolute; left: ${U(-8)}; top: ${U(-6)}; width: ${U(48)}; height: ${U(48)}; z-index: 4; transform: rotate(-14deg); }
.lb-badge .new b { position: absolute; inset: 0; display: grid; place-items: center; font: 800 ${U(10)}/1 ${CAPS}; letter-spacing: .08em; color: #f6d2c8; text-shadow: 0 1px 1px #2a0503; }
.lb-badge .rib { margin-left: ${U(-30)}; padding: ${U(8)} ${U(90)} ${U(8)} ${U(46)}; background: linear-gradient(90deg, rgba(14,12,10,.92) 0%, rgba(14,12,10,.7) 55%, rgba(14,12,10,0) 100%); }
.lb-badge .rib b { display: block; font: 800 ${U(31)}/1.05 ${CAPS}; letter-spacing: .04em; color: #F5E8C7; text-shadow: ${SHADOW}; white-space: nowrap; max-width: ${U(620)}; overflow: hidden; text-overflow: ellipsis; }
.lb-badge .rib .rule { display: block; height: ${U(10)}; width: ${U(320)}; margin: ${U(5)} 0 ${U(4)}; }
.lb-badge .rib span { display: block; font: 700 ${U(14)}/1 ${SERIF}; letter-spacing: .2em; text-transform: uppercase; color: #b8a27a; text-shadow: 0 1px 2px #000; white-space: nowrap; }

/* ---------- Resource troughs (top-right) ---------- */
.lb-res { position: absolute; right: ${U(44)}; top: ${U(30)}; display: flex; align-items: center; gap: ${U(34)}; z-index: 6; }
.lb-tr { position: relative; width: ${U(196)}; height: ${U(44)}; }
.lb-tr > .art { position: absolute; inset: 0; }
.lb-tr .ic { position: absolute; left: ${U(-26)}; top: ${U(-12)}; width: ${U(64)}; height: ${U(64)}; }
.lb-tr b { position: absolute; left: ${U(40)}; right: ${U(30)}; top: 0; bottom: 0; display: flex; align-items: baseline; justify-content: center; padding-top: ${U(9)}; gap: ${U(4)}; font: 800 ${U(19)}/1 ${CAPS}; color: #F5EFE6; text-shadow: 0 1px 3px #000; white-space: nowrap; }
.lb-tr b small { font: 700 ${U(13)}/1 ${CAPS}; color: #b8a27a; letter-spacing: .06em; }
.lb-tr .cap { position: absolute; left: ${U(42)}; top: calc(100% + ${U(3)}); font: 700 ${U(11)}/1 ${SERIF}; letter-spacing: .24em; text-transform: uppercase; color: #a69272; text-shadow: 0 1px 3px #000, 0 0 6px #000; white-space: nowrap; }
.lb-tr.low b { color: #ffb48a; }

/* ---------- Left rail of gold-leaf objects ---------- */
.lb-rail { position: absolute; left: ${U(36)}; top: ${U(176)}; display: flex; flex-direction: column; gap: ${U(22)}; z-index: 6; }
.lb-rail > button { display: flex; flex-direction: column; align-items: center; width: ${U(108)}; transition: transform .2s cubic-bezier(.22,1,.36,1); }
.lb-rail .ri { width: ${U(70)}; height: ${U(70)}; transition: filter .2s; }
.lb-rail span { margin-top: ${U(4)}; font: 700 ${U(17)}/1.1 ${SERIF}; letter-spacing: .04em; color: #E5D4B3; text-shadow: ${SHADOW}; }
.lb-rail > button:hover, .lb-rail > button[aria-expanded="true"], .lb-rail > button[aria-pressed="true"] { transform: translateY(${U(-3)}); }
.lb-rail > button:hover .ri, .lb-rail > button[aria-expanded="true"] .ri, .lb-rail > button[aria-pressed="true"] .ri { filter: drop-shadow(0 0 ${U(12)} rgba(230,185,90,.75)); }
.lb-themes { position: absolute; left: ${U(150)}; top: ${U(330)}; display: none; flex-direction: column; gap: ${U(6)}; z-index: 9; padding: ${U(14)} ${U(10)}; }
.lb-themes.on { display: flex; }
.lb-themes::before { content: ""; position: absolute; inset: ${U(-30)}; background: radial-gradient(closest-side, rgba(8,6,4,.85), rgba(8,6,4,0)); z-index: -1; }
.lb-themes button { position: relative; width: ${U(230)}; height: ${U(46)}; display: grid; place-items: center; font: 800 ${U(16)}/1 ${CAPS}; letter-spacing: .08em; color: #F5E8C7; text-shadow: 0 1px 2px #000; transition: transform .18s; }
.lb-themes button > .art { position: absolute; inset: 0; z-index: -1; }
.lb-themes button:hover { transform: translateX(${U(6)}); }
.lb-themes button[aria-current="true"] { color: #ffe6a8; }
.lb-themes button[aria-current="true"]::after { content: ""; position: absolute; right: ${U(26)}; width: ${U(10)}; height: ${U(10)}; background: #ffe6a8; clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%); }

/* ---------- The lead, the halo, lockets, nameplate ---------- */
.lb-glowback { position: absolute; left: calc(var(--hc) - ${U(620)}); top: ${U(-120)}; width: ${U(1100)}; height: ${U(1000)}; background: radial-gradient(closest-side, rgba(255,214,150,.28), rgba(255,190,110,.08) 55%, rgba(0,0,0,0)); mix-blend-mode: screen; will-change: transform; }
.lb-hero { position: absolute; left: var(--hc); bottom: ${U(-14)}; width: 0; height: ${U(930)}; z-index: 2; }
.lb-hero .px { position: absolute; inset: 0; will-change: transform; }
.lb-hero .px::before { content: ""; position: absolute; left: ${U(-320)}; width: ${U(640)}; bottom: ${U(-20)}; height: ${U(110)}; background: radial-gradient(closest-side, rgba(0,0,0,.85), rgba(0,0,0,0)); }
.lb-hero .px::after { content: ""; position: absolute; left: ${U(-420)}; width: ${U(840)}; bottom: ${U(-60)}; height: ${U(300)}; background: radial-gradient(closest-side, rgba(214,150,80,.26), rgba(214,150,80,0)); mix-blend-mode: screen; pointer-events: none; z-index: 3; }
.lb-hero-in { position: absolute; inset: 0; animation: lbBreath 4.2s ease-in-out infinite, lbEnter .45s cubic-bezier(.22,1,.36,1); transform-origin: 50% 100%; }
.lb-hero-in > img { position: absolute; bottom: 0; left: 0; height: 100%; width: auto; max-width: none; transform: translateX(-50%); filter: drop-shadow(${U(-3)} ${U(-2)} ${U(4)} rgba(255,214,150,.5)) drop-shadow(0 ${U(18)} ${U(28)} rgba(0,0,0,.85)) saturate(.95) sepia(.06); user-select: none; -webkit-user-drag: none; cursor: pointer; }
.lb-hero-in > img.bust { height: 98%; bottom: -8%; filter: drop-shadow(${U(-3)} ${U(-2)} ${U(5)} rgba(255,214,150,.45)) saturate(.95) sepia(.06);
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 16%, #000 84%, transparent 100%), linear-gradient(180deg, #000 64%, transparent 98%);
  -webkit-mask-composite: source-in; mask-image: linear-gradient(90deg, transparent 0, #000 16%, #000 84%, transparent 100%), linear-gradient(180deg, #000 64%, transparent 98%); mask-composite: intersect; }
.lb-hero-in > img.bust.opaque {
  -webkit-mask-image: radial-gradient(ellipse 50% 58% at 50% 44%, #000 56%, transparent 100%), linear-gradient(180deg, transparent 0, #000 18%, #000 56%, transparent 96%);
  mask-image: radial-gradient(ellipse 50% 58% at 50% 44%, #000 56%, transparent 100%), linear-gradient(180deg, transparent 0, #000 18%, #000 56%, transparent 96%); }
.lb-hero-in > .halo { position: absolute; left: ${U(-280)}; top: ${U(-90)}; width: ${U(560)}; height: ${U(560)}; pointer-events: none; opacity: .9; }
.lb-hero-in > .halo.bust { top: ${U(80)}; }
.lb-hero-in > .ped { position: absolute; left: ${U(-420)}; width: ${U(840)}; bottom: ${U(-14)}; height: ${U(420)}; pointer-events: none; background: radial-gradient(ellipse 50% 62% at 50% 100%, rgba(8,6,4,.95), rgba(8,6,4,.72) 52%, rgba(8,6,4,0) 100%); }
.lb-hero-in > .halo.empty, .lb-hero-in > .halo.arriving { top: ${U(120)}; left: ${U(-330)}; width: ${U(660)}; height: ${U(660)}; }
.lb-hero-in > .halo.arriving { animation: lbPulseO 1.6s ease-in-out infinite; }
.lb .hl1 { animation: lbSpin 240s linear infinite; transform-origin: 240px 240px; }
.lb .hl2 { animation: lbSpin 160s linear infinite reverse; transform-origin: 240px 240px; }
.lb-hero-in > .brk { position: absolute; bottom: ${U(300)}; width: ${U(124)}; height: ${U(200)}; pointer-events: none; }
.lb-hero-in > .brk.l { left: ${U(-330)}; }
.lb-hero-in > .brk.r { left: ${U(206)}; transform: scaleX(-1); }
.lb-lockets { position: absolute; left: calc(var(--hc) - ${U(420)}); top: ${U(250)}; display: flex; flex-direction: column; align-items: center; gap: ${U(10)}; z-index: 5; will-change: transform; }
.lb-lk { position: relative; width: ${U(92)}; height: ${U(110)}; margin-bottom: ${U(16)}; transition: transform .25s cubic-bezier(.22,1,.36,1); }
.lb-lk.on { width: ${U(112)}; height: ${U(134)}; margin-bottom: ${U(14)}; }
.lb-lk:hover { transform: scale(1.06); }
.lb-lk .nm { position: absolute; top: calc(100% - ${U(4)}); left: 50%; transform: translateX(-50%); font: 700 ${U(18)}/1 ${SERIF}; letter-spacing: .05em; color: #c9b48f; text-shadow: ${SHADOW}; white-space: nowrap; }
.lb-lk.on .nm { color: #F5E1A4; font-size: ${U(19)}; }
.lb-talk { position: absolute; left: calc(var(--hc) - ${U(250)}); bottom: ${U(400)}; width: ${U(500)}; height: ${U(80)}; z-index: 5; display: block; transition: transform .2s cubic-bezier(.22,1,.36,1); will-change: transform; }
.lb-talk > .art { position: absolute; inset: 0; }
.lb-talk .nm { position: absolute; left: ${U(50)}; right: ${U(50)}; top: ${U(12)}; text-align: center; font: 800 ${U(29)}/1 ${CAPS}; letter-spacing: .14em; color: #F5E8C7; text-shadow: 0 1px 3px #000, 0 0 14px rgba(223,193,131,.35); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lb-talk .rl { position: absolute; left: ${U(52)}; right: ${U(52)}; top: ${U(47)}; text-align: center; font: 700 ${U(12)}/1 ${SERIF}; letter-spacing: .1em; text-transform: uppercase; color: #DFC183; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lb-talk .q { position: absolute; right: ${U(-8)}; top: ${U(-18)}; width: ${U(50)}; height: ${U(50)}; filter: drop-shadow(0 0 ${U(8)} rgba(255,214,140,.65)); animation: lbPulseO 2.6s ease-in-out infinite; }
button.lb-talk:hover { transform: translateY(${U(-4)}) scale(1.02); }
button.lb-talk:hover > .art { filter: drop-shadow(0 0 ${U(16)} rgba(230,185,90,.55)); }

/* ---------- Right cluster: instruments over place cards ---------- */
.lb-cluster { position: absolute; right: ${U(46)}; top: ${U(118)}; width: ${U(860)}; height: ${U(840)}; z-index: 4; will-change: transform; }
.lb-cluster::before { content: ""; position: absolute; inset: ${U(-140)} ${U(-180)} ${U(-120)} ${U(-200)}; background: radial-gradient(closest-side, rgba(10,8,6,.78), rgba(10,8,6,.45) 60%, rgba(10,8,6,0)); pointer-events: none; z-index: -1; }
.lb-instr { position: absolute; left: 0; right: 0; top: 0; height: ${U(352)}; display: flex; justify-content: space-around; align-items: flex-end; }
.lb-ins { position: relative; width: ${U(236)}; height: ${U(330)}; display: block; transition: transform .2s cubic-bezier(.22,1,.36,1), filter .2s; }
.lb-ins > .art { position: absolute; left: 0; right: 0; top: 0; height: ${U(250)}; transition: filter .2s; }
.lb-ins .pl { position: absolute; left: ${U(-8)}; right: ${U(-8)}; top: ${U(232)}; height: ${U(76)}; display: block; }
.lb-ins .pl > .art { position: absolute; inset: 0; }
.lb-ins .pl b { position: absolute; left: 0; right: 0; top: 12%; text-align: center; font: 800 ${U(19)}/1.15 ${CAPS}; letter-spacing: .04em; color: #1A1208; text-shadow: 0 1px 0 rgba(255,240,200,.55), 0 -1px 0 rgba(40,25,5,.25); white-space: nowrap; }
.lb-ins .pl i { position: absolute; left: 20%; right: 20%; top: 58%; height: 26%; display: grid; place-items: center; font: 700 ${U(11)}/1 ${SERIF}; font-style: normal; letter-spacing: .18em; text-transform: uppercase; color: #D4B475; white-space: nowrap; overflow: hidden; }
.lb-ins.k-wait { transform: translateY(${U(-2)}); }
.lb-ins.k-wait > .art { top: ${U(-34)}; height: ${U(282)}; }
.lb-instr.n4 .lb-ins { width: ${U(198)}; }
.lb-instr.n4 .lb-ins > .art { height: ${U(214)}; top: ${U(22)}; }
.lb-instr.n4 .lb-ins.k-wait > .art { top: ${U(-22)}; height: ${U(258)}; }
.lb-instr.n4 .lb-ins .pl b { font-size: ${U(16)}; }
.lb-instr.n4 .lb-ins .pl i { left: 17%; right: 17%; letter-spacing: .1em; font-size: ${U(10)}; }
.lb-ins:hover, .lb-ins:focus-visible { transform: translateY(${U(-6)}) scale(1.02); }
.lb-ins.k-wait:hover, .lb-ins.k-wait:focus-visible { transform: translateY(${U(-8)}) scale(1.02); }
.lb-ins:hover > .art, .lb-ins:focus-visible > .art { filter: drop-shadow(0 0 ${U(18)} rgba(230,185,90,.55)); }
.lb-ins:active { transform: translateY(${U(2)}) scale(.98); filter: brightness(.85); transition-duration: .08s; }
.lb .sheen { transform: skewX(-20deg); transition: transform .8s cubic-bezier(.22,1,.36,1); }
.lb-ins:hover .sheen, .lb-ins:focus-visible .sheen { transform: skewX(-20deg) translateX(420px); }
.lb-telescope .flare { animation: lbTwinkle 3.6s ease-in-out infinite; transform-origin: 220px 63px; }
.lb .spin { animation: lbSpin 720s linear infinite; transform-origin: 110px 128px; }
.lb .rock { animation: lbRock 6s ease-in-out infinite; transform-origin: 120px 63px; }
.lb .pulse { animation: lbPulseO 3.2s ease-in-out infinite; }
.lb .smoke { animation: lbSmoke 4.5s ease-in-out infinite; }
.lb .spin2 { animation: lbSpin 18s linear infinite; transform-origin: 50px 68px; }
.lb .spin3 { animation: lbSpin 40s linear infinite; transform-origin: 32px 27px; }
.lb .sand { animation: lbPulseO 1.2s linear infinite; }

.lb-cards { position: absolute; left: 0; right: 0; top: ${U(372)}; height: ${U(440)}; display: flex; justify-content: flex-end; align-items: flex-end; gap: ${U(30)}; }
.lb-card { position: relative; display: block; flex: none; transition: transform .2s cubic-bezier(.22,1,.36,1); }
.lb-card.wide { width: ${U(540)}; height: ${U(357)}; }
.lb-card.tall { width: ${U(290)}; height: ${U(392)}; }
.lb-card > .art, .lb-card > .hit { position: absolute; inset: 0; display: block; }
.lb-card > .hit > .art { transition: filter .2s; }
.lb-card .ttl { position: absolute; display: block; pointer-events: none; }
.lb-card .ttl > .art { position: absolute; inset: 0; }
.lb-card .ttl b { position: absolute; inset: 0; display: grid; place-items: center; padding: 0 ${U(24)}; font: 800 ${U(21)}/1.05 ${CAPS}; letter-spacing: .03em; color: #F5E8C7; text-shadow: 0 1px 3px #000; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lb-card.wide .ttl { left: 27.9%; width: 44.3%; top: .6%; height: 9.6%; }
.lb-card.wide .ttl b { color: #1E160C; text-shadow: 0 1px 0 rgba(255,250,230,.6); font-size: ${U(20)}; letter-spacing: .05em; }
.lb-card.tall .ttl { left: 50%; transform: translateX(-50%); top: 76.4%; width: 77%; height: 11%; }
.lb-card.tall .ttl b { font-size: ${U(17)}; white-space: normal; line-height: 1.05; }
.lb-card .gauge { position: absolute; right: 39.4%; top: 77.3%; font: 800 ${U(13)}/1 ${CAPS}; letter-spacing: .12em; color: #E6C687; text-shadow: 0 1px 2px #000; white-space: nowrap; pointer-events: none; }
.lb-card .gauge2 { position: absolute; left: 54.6%; width: 32%; top: 77.6%; text-align: center; font: 800 ${U(11)}/1 ${CAPS}; letter-spacing: .1em; color: #fff3d6; text-shadow: 0 1px 2px #000; pointer-events: none; }
.lb-card .pips { position: absolute; left: 0; right: 0; top: 88.6%; text-align: center; font: 700 ${U(13)}/1 ${CAPS}; letter-spacing: .2em; color: #c8aa6e; text-shadow: 0 1px 2px #000; pointer-events: none; }
.lb-card .cyc { position: absolute; top: calc(49.6% - ${U(26)}); width: ${U(40)}; height: ${U(52)}; z-index: 2; transition: transform .15s, filter .15s; }
.lb-card .cyc.l { left: calc(9.7% - ${U(22)}); }
.lb-card .cyc.r { right: calc(9.7% - ${U(22)}); transform: scaleX(-1); }
.lb-card .cyc:hover, .lb-card .cyc:focus-visible { filter: drop-shadow(0 0 ${U(10)} rgba(230,185,90,.9)); }
.lb-card:hover, .lb-card:focus-within { transform: translateY(${U(-6)}) scale(1.02); }
.lb-card:hover > .hit > .art, .lb-card:focus-within > .hit > .art, button.lb-card:hover > .art, button.lb-card:focus-visible > .art { filter: drop-shadow(0 0 ${U(18)} rgba(230,185,90,.5)); }
.lb-card:active { transform: translateY(${U(2)}) scale(.98); }
.lb-hex { position: relative; flex: none; width: ${U(440)}; height: ${U(372)}; }
.lb-hex > .art { position: absolute; inset: 0; }
.lb-hex svg.map { position: absolute; left: 5%; top: 6%; width: 90%; height: 82%; overflow: visible; }
.lb-hex .ttl { position: absolute; left: 50%; top: ${U(-22)}; transform: translateX(-50%); width: ${U(280)}; height: ${U(46)}; pointer-events: none; }
.lb-hex .ttl > .art { position: absolute; inset: 0; }
.lb-hex .ttl b { position: absolute; inset: 0; display: grid; place-items: center; font: 800 ${U(18)}/1 ${CAPS}; letter-spacing: .06em; color: #F5E8C7; text-shadow: 0 1px 3px #000; }
.lb-hex g polygon { stroke: #3a2a14; stroke-width: 1; filter: saturate(.7) sepia(.3); }
.lb-hex polygon.fog { fill: #b9a47c; opacity: .35; stroke: #8a7550; stroke-dasharray: 2 2; filter: none; }
.lb-hex g.here polygon { stroke: #fff2c4; stroke-width: 2.4; }
.lb-hex g.step, .lb-hex g.goto { cursor: pointer; }
.lb-hex g.step polygon { stroke: #8a6421; stroke-width: 1.6; }
.lb-hex g.goto polygon { stroke: #c8463a; stroke-width: 2; }
.lb-hex g.step:hover polygon, .lb-hex g.step:focus polygon, .lb-hex g.goto:hover polygon, .lb-hex g.goto:focus polygon { stroke: #fff2c4; stroke-width: 3; filter: brightness(1.25); outline: none; }
.lb-hex g:focus { outline: none; }
.lb-hex circle.pin { fill: #8f2219; stroke: #f3e8d2; stroke-width: 1.2; }
.lb-hex circle.you { fill: #f5e1a4; stroke: #2a1c08; stroke-width: 2; }
.lb-hex text { font: 700 8.5px ${SERIF}; fill: #2a1c08; paint-order: stroke; stroke: rgba(240,225,190,.85); stroke-width: 2.4px; pointer-events: none; }

/* Delve: an inked chart table beside a brass orienter */
.lb.delve .lb-bg > .world { filter: blur(1.4px) sepia(.4) saturate(.7) brightness(.78) contrast(1.08); }
.lb-vf { position: absolute; inset: 0; pointer-events: none; display: none; }
.lb.delve .lb-vf { display: block; background: radial-gradient(ellipse 30% 26% at 36% 92%, rgba(255,170,90,.2), rgba(255,170,90,0)), radial-gradient(ellipse 46% 72% at 44% 46%, rgba(0,0,0,0) 28%, rgba(6,4,2,.6) 70%, rgba(6,4,2,.88) 100%); animation: lbTorch 3.2s ease-in-out infinite; }
.lb.rm .lb-vf { animation: none; }
@keyframes lbTorch { 0%, 100% { opacity: 1; } 30% { opacity: .9; } 55% { opacity: .97; } 75% { opacity: .86; } }
.lb-vf i { position: absolute; width: 4cqh; height: 4cqh; border: 0 solid #B68D40; box-shadow: 0 0 6px rgba(0,0,0,.8); }
.lb-vf i::after { content: ""; position: absolute; inset: 5px; border: 0 solid rgba(255,236,190,.45); }
.lb-vf .a { left: 1.4cqh; top: 1.4cqh; border-width: 2px 0 0 2px; } .lb-vf .a::after { border-width: 1px 0 0 1px; }
.lb-vf .b { right: 1.4cqh; top: 1.4cqh; border-width: 2px 2px 0 0; } .lb-vf .b::after { border-width: 1px 1px 0 0; }
.lb-vf .c { left: 1.4cqh; bottom: 1.4cqh; border-width: 0 0 2px 2px; } .lb-vf .c::after { border-width: 0 0 1px 1px; }
.lb-vf .d { right: 1.4cqh; bottom: 1.4cqh; border-width: 0 2px 2px 0; } .lb-vf .d::after { border-width: 0 1px 1px 0; }
.lb.delve .lb-instr { justify-content: space-between; align-items: flex-start; height: ${U(400)}; top: ${U(-10)}; }
.lb-chart { position: relative; flex: none; width: ${U(400)}; height: ${U(400)}; }
.lb-chart canvas { position: absolute; left: 12%; top: 12%; width: 76%; height: 76%; border-radius: 50%; background: #241D15 url("${tx.chart}") center/cover; }
.lb-chart > .art { position: absolute; inset: 0; }
.lb-chart .ttl { position: absolute; left: 50%; bottom: ${U(-14)}; transform: translateX(-50%); width: ${U(230)}; height: ${U(42)}; pointer-events: none; }
.lb-chart .ttl > .art { position: absolute; inset: 0; }
.lb-chart .ttl b { position: absolute; inset: 0; display: grid; place-items: center; font: 800 ${U(16)}/1 ${CAPS}; letter-spacing: .14em; color: #F5E8C7; text-shadow: 0 1px 3px #000; }
.lb-nav { position: relative; flex: none; width: ${U(330)}; height: ${U(330)}; margin-top: ${U(20)}; }
.lb-nav > .art { position: absolute; inset: 0; }
.lb-nav button { position: absolute; width: ${U(66)}; height: ${U(92)}; transition: filter .15s; }
.lb-nav button .art { transition: filter .15s, transform .12s; }
.lb-nav button:hover .art, .lb-nav button:focus-visible .art { filter: drop-shadow(0 0 ${U(14)} rgba(230,185,90,.85)); }
.lb-nav button:active .art { transform: translateY(${U(4)}); }
.lb-nav button[aria-disabled="true"] { opacity: .42; filter: saturate(.4); }
.lb-nav .mv-forward { left: calc(50% - ${U(33)}); top: ${U(14)}; }
.lb-nav .mv-back { left: calc(50% - ${U(33)}); bottom: ${U(14)}; transform: rotate(180deg); }
.lb-nav .mv-left { left: ${U(27)}; top: calc(50% - ${U(46)}); transform: rotate(-90deg); }
.lb-nav .mv-right { right: ${U(27)}; top: calc(50% - ${U(46)}); transform: rotate(90deg); }
.lb-nav .mv-search { left: calc(50% - ${U(40)}); top: calc(50% - ${U(48)}); width: ${U(80)}; height: ${U(94)}; }
.lb-nav .lbl { position: absolute; left: 50%; top: calc(100% + ${U(2)}); transform: translateX(-50%); width: ${U(230)}; height: ${U(42)}; pointer-events: none; }
.lb-nav .lbl > .art { position: absolute; inset: 0; }
.lb-nav .lbl b { position: absolute; inset: 0; display: grid; place-items: center; font: 800 ${U(15)}/1 ${CAPS}; letter-spacing: .1em; color: #F5E8C7; text-shadow: 0 1px 3px #000; }
.lb.delve .lb-cards { top: ${U(440)}; }

/* A wide stage: the cluster spreads across the right half and grows. */
.lb.wide .lb-cluster { zoom: 1.1; top: ${U(92)}; width: ${U(1200)}; }
/* On a wide stage the feed is clear of the nameplate, so it drops below the chin. */
.lb.wide .lb-talk { bottom: ${U(200)}; }
.lb.wide .lb-stage > *, .lb.wide .lb-scene > * { --hc: 34cqw; }
.lb.wide .lb-hero-in > .brk { bottom: ${U(110)}; }
.lb.wide .lb-cards { gap: ${U(40)}; }
.lb.wide .lb-instr { justify-content: space-evenly; }
.lb.wide .lb-ins, .lb.wide .lb-instr.n4 .lb-ins { width: ${U(250)}; }

/* ---------- Bottom-right dock: a dark shelf of portrait buttons ---------- */
.lb-dock { position: absolute; right: ${U(40)}; bottom: ${U(16)}; height: ${U(60)}; display: flex; align-items: center; z-index: 6; padding: 0 ${U(10)}; }
.lb-dock::before { content: ""; position: absolute; inset: ${U(-14)} ${U(-40)} ${U(-16)} ${U(-120)}; background: linear-gradient(90deg, rgba(10,8,6,0), rgba(10,8,6,.75) 25%, rgba(10,8,6,.92)); border-top: 1px solid rgba(212,180,117,.25); z-index: -1; pointer-events: none; }
.lb-dock::after { content: ""; position: absolute; left: ${U(-80)}; right: 0; top: ${U(-6)}; height: 1px; background: linear-gradient(90deg, rgba(140,109,59,0), rgba(200,170,110,.6) 40%, rgba(140,109,59,.2)); pointer-events: none; }
.lb-dk { position: relative; display: flex; align-items: center; gap: ${U(12)}; height: 100%; padding: 0 ${U(22)}; transition: transform .18s; }
.lb-dk::before { content: ""; position: absolute; inset: ${U(6)} ${U(4)}; background: radial-gradient(closest-side, rgba(230,185,90,.22), rgba(230,185,90,0)); opacity: 0; transition: opacity .18s; }
.lb-dk .ic { position: relative; width: ${U(42)}; height: ${U(42)}; flex: none; transition: filter .18s; }
.lb-dk.talk .ic { width: ${U(46)}; height: ${U(46)}; }
.lb-dk span { position: relative; font: 600 ${U(19)}/1 ${SERIF}; letter-spacing: .03em; color: #E8D8B9; text-shadow: ${SHADOW}; white-space: nowrap; }
.lb-dk:hover, .lb-dk:focus-visible { transform: translateY(${U(-3)}); }
.lb-dk:hover::before, .lb-dk:focus-visible::before { opacity: 1; }
.lb-dk:hover .ic, .lb-dk:focus-visible .ic { filter: drop-shadow(0 0 ${U(10)} rgba(230,185,90,.85)); }
.lb-dk:hover span, .lb-dk:focus-visible span { color: #fff3d6; text-shadow: ${SHADOW}, 0 0 12px rgba(230,185,90,.6); }
.lb-dock .sep { display: block; width: 1px; height: ${U(30)}; flex: none; background: linear-gradient(180deg, transparent, #D4B475, transparent); opacity: .9; }

/* ---------- Bottom-left: log drawer, bell ticker, scene dossier ---------- */
.lb-feed { position: absolute; left: ${U(30)}; bottom: ${U(22)}; width: ${U(580)}; display: flex; flex-direction: column; z-index: 6; }
.lb-log { position: relative; display: flex; flex-direction: column; gap: ${U(3)}; padding: ${U(12)} ${U(18)} ${U(12)} ${U(30)}; margin: 0 0 ${U(6)} ${U(14)}; background: linear-gradient(90deg, rgba(10,8,6,.92) 0%, rgba(10,8,6,.75) 80%, rgba(10,8,6,0) 100%); }
.lb-log.none { display: none; }
.lb-log .lc { position: absolute; left: ${U(-2)}; top: ${U(-2)}; width: ${U(22)}; height: ${U(22)}; }
.lb-log::after { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 1px; background: linear-gradient(180deg, #c8aa6e, rgba(200,170,110,0)); }
.lb-log p { margin: 0; font: italic 400 ${U(16)}/1.3 ${FELL}; color: #d8c39e; text-shadow: 0 1px 2px #000; }
.lb-log p:nth-last-child(2) { opacity: .7; } .lb-log p:nth-last-child(3) { opacity: .5; } .lb-log p:nth-last-child(n+4) { opacity: .38; }
.lb-feed.open .lb-log { max-height: ${U(420)}; overflow: auto; }
.lb-feed.open .lb-log p { opacity: .95; }
.lb-ticker { position: relative; display: flex; align-items: center; gap: ${U(10)}; height: ${U(44)}; padding: 0 ${U(34)} 0 ${U(62)}; margin-bottom: ${U(12)}; width: 100%; text-align: left; }
.lb-ticker > .art { position: absolute; inset: 0; z-index: -1; }
.lb-ticker .bell { position: absolute; left: ${U(-6)}; top: ${U(-6)}; width: ${U(56)}; height: ${U(56)}; }
.lb-ticker .tag { flex: none; font: 800 ${U(12)}/1 ${CAPS}; letter-spacing: .14em; color: #E0B866; }
.lb-ticker .txt { flex: 1; min-width: 0; font: 500 ${U(16)}/1 ${SERIF}; color: #e6d3ae; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 1px 2px #000; }
.lb-ticker .more { flex: none; font: 800 ${U(11)}/1 ${CAPS}; letter-spacing: .14em; color: #a69272; }
.lb-ticker .gears { width: ${U(30)}; height: ${U(30)}; flex: none; }
.lb-ticker.busy .txt { font-style: italic; color: #ffe2a8; animation: lbPulseO 1.6s ease-in-out infinite; }
.lb .g1 { transform-origin: 19px 20px; } .lb .g2 { transform-origin: 35px 35px; }
.lb-ticker.busy .g1 { animation: lbSpin 3s linear infinite; } .lb-ticker.busy .g2 { animation: lbSpin 2s linear infinite reverse; }
.lb-ticker:hover .txt { color: #fff3d6; }
.lb-banner { position: relative; width: 100%; height: ${U(196)}; }
.lb-banner > .art { position: absolute; inset: 0; }
.lb-banner .tx { position: absolute; left: 28%; right: 5%; top: 14%; bottom: 12%; display: flex; flex-direction: column; justify-content: center; }
.lb-banner .sub { font: 800 ${U(12)}/1 ${CAPS}; letter-spacing: .26em; color: #c8aa6e; text-transform: uppercase; margin-bottom: ${U(8)}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lb-banner .ds { font: 500 ${U(18)}/1.34 ${SERIF}; color: #F3E8D2; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; text-shadow: 0 1px 2px #000; }
.lb-banner .hk { display: flex; align-items: center; gap: ${U(8)}; margin-top: ${U(9)}; padding-top: ${U(7)}; border-top: 1px solid rgba(200,170,110,.35); font: italic 400 ${U(15)}/1.25 ${FELL}; color: #e6c687; }
.lb-banner .hk > span:last-child { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.lb-banner .hk b { font: 800 ${U(12)}/1 ${CAPS}; font-style: normal; letter-spacing: .1em; color: #F5E8C7; }
.lb-banner .hk .sp { flex: none; width: ${U(28)}; height: ${U(28)}; }
.lb-banner .new { position: absolute; left: ${U(-12)}; top: ${U(-14)}; width: ${U(54)}; height: ${U(54)}; transform: rotate(-12deg); }
.lb-banner .new b { position: absolute; inset: 0; display: grid; place-items: center; font: 800 ${U(11)}/1 ${CAPS}; letter-spacing: .06em; color: #f6d2c8; }

/* ---------- Busy ---------- */
.lb.busy .lb-ins, .lb.busy .lb-card, .lb.busy .lb-dk, .lb.busy .lb-nav button { filter: saturate(.6) brightness(.8); }

/* ---------- Journal: a leather-bound two-page spread ---------- */
.lb-journal { position: absolute; inset: 0; z-index: 30; display: none; place-items: center; background: radial-gradient(ellipse at 50% 45%, rgba(10,8,6,.6), rgba(4,3,2,.92)); }
.lb-journal.on { display: grid; animation: lbFade .3s ease; }
.lb-book { --pad: clamp(14px, 2.4cqh, 30px); position: relative; width: min(94cqw, 1440px, 165cqh); height: min(88cqh, 880px); padding: var(--pad); background: #2a1e15 url("${tx.leather}") 0 0/320px; box-shadow: 0 30px 80px rgba(0,0,0,.85), inset 0 0 0 2px #120c06, inset 0 0 40px rgba(0,0,0,.7); }
.lb-book::before { content: ""; position: absolute; inset: 6px; border: 1px dashed rgba(212,180,117,.42); pointer-events: none; }
.lb-book::after { content: ""; position: absolute; inset: 11px; border: 1px solid rgba(212,180,117,.18); pointer-events: none; }
.lb-book .cn { position: absolute; width: clamp(48px, 9cqh, 96px); height: clamp(48px, 9cqh, 96px); z-index: 3; pointer-events: none; }
.lb-book .cn.tl { left: -6px; top: -6px; } .lb-book .cn.tr { right: -6px; top: -6px; transform: scaleX(-1); } .lb-book .cn.bl { left: -6px; bottom: -6px; transform: scaleY(-1); } .lb-book .cn.br { right: -6px; bottom: -6px; transform: scale(-1,-1); }
.lb-pages { position: relative; height: 100%; display: grid; grid-template-columns: 1fr 1fr; color: #2b1f12; font: 500 clamp(15px, 2cqh, 19px)/1.45 ${SERIF}; }
.lb-pages .pg { position: relative; overflow: auto; display: flex; flex-direction: column; padding: clamp(20px, 4.4cqh, 54px) clamp(22px, 3.6cqw, 70px); background:
    repeating-linear-gradient(180deg, rgba(90,65,40,0) 0 27px, rgba(90,65,40,.12) 27px 28px),
    radial-gradient(ellipse 120% 110% at 50% 50%, rgba(0,0,0,0) 62%, rgba(110,62,20,.42) 100%),
    #e7d7b6 url("${tx.parchment}") 0 0/400px; }
.lb-pages .pg.l { box-shadow: inset -30px 0 40px -30px rgba(15,8,2,.55); }
.lb-pages .pg.r { box-shadow: inset 30px 0 40px -30px rgba(15,8,2,.55); }
.lb-pages .wm { position: absolute; left: 50%; bottom: 6%; width: 52%; aspect-ratio: 1; transform: translateX(-50%); filter: grayscale(1) sepia(1) brightness(.75) contrast(1.2); mix-blend-mode: multiply; opacity: .16; pointer-events: none; }
.lb-pages .wm > .art { width: 100%; height: 100%; }
.lb-pages .orn { flex: none; align-self: center; width: clamp(90px, 14cqh, 140px); aspect-ratio: 1; margin: auto 0 0; padding-top: 1.2em; filter: grayscale(1) sepia(1) brightness(.7) contrast(1.2); mix-blend-mode: multiply; opacity: .17; pointer-events: none; }
.lb-pages .orn > .art { width: 100%; height: 100%; }
.lb-pages .pg > * { position: relative; }
.lb-gutter { position: absolute; top: var(--pad); bottom: var(--pad); left: 50%; width: 80px; transform: translateX(-50%); background: linear-gradient(90deg, rgba(15,8,2,0), rgba(15,8,2,.3) 38%, rgba(15,8,2,.55) 50%, rgba(15,8,2,.3) 62%, rgba(15,8,2,0)); pointer-events: none; z-index: 2; }
.lb-gutter::after { content: ""; position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: rgba(20,10,0,.55); }
.lb-pages h2 { margin: 0; text-align: center; font: 800 clamp(24px, 3.8cqh, 42px)/1.1 ${CAPS}; color: #3a2610; letter-spacing: .08em; }
.lb-pages svg.fl { display: block; width: 70%; height: 14px; margin: .2em auto .7em; }
.lb-pages h3 + svg.fl { width: 100%; margin: 0 0 .5em; height: 12px; }
.lb-pages .thread { margin: 0 auto 1.3em; max-width: 30em; text-align: center; font: italic 400 1.08em/1.4 ${FELL}; color: #5a3c18; }
.lb-pages .thread b { font: 800 .74em/1 ${CAPS}; letter-spacing: .22em; display: block; color: #8a6421; margin-bottom: .4em; font-style: normal; }
.lb-pages .thread span { display: block; font-size: .85em; color: #7d6a50; margin-top: .3em; }
.lb-pages h3 { margin: 1.1em 0 .1em; font: 800 1.08em/1.2 ${CAPS}; letter-spacing: .12em; color: #6a3e14; text-align: center; }
.lb-pages .pg > h3:first-child { margin-top: 0; }
.lb-pages ul { margin: 0; padding: 0 0 0 1.1em; list-style: none; }
.lb-pages li { position: relative; margin: .3em 0; }
.lb-pages li::before { content: ""; position: absolute; left: -1em; top: .45em; width: .55em; height: .55em; background: #8a6421; clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%); }
.lb-pages li.done { color: #7d6a50; text-decoration: line-through; text-decoration-color: rgba(125,106,80,.6); }
.lb-pages li.bond { color: #6a1e14; }
.lb-pages .muted { color: #7d6a50; font-style: italic; }
.lb-pages .pips { display: inline-flex; gap: 3px; margin: 0 .5em; vertical-align: -.1em; }
.lb-pages .pips svg { width: .8em; height: .8em; }
.lb-pages .ledger { margin-top: 1.2em; padding: .2em 1em .8em; border: 3px double rgba(106,62,20,.6); background: rgba(255,248,230,.25); }
.lb-pages .ledger h3 { margin-top: .5em; }
.lb-jx { position: absolute; right: 7%; top: -12px; width: clamp(30px, 4.6cqh, 44px); height: clamp(120px, 18cqh, 180px); z-index: 4; transition: transform .2s, filter .2s; }
.lb-jx:hover, .lb-jx:focus-visible { transform: translateY(6px); filter: drop-shadow(0 0 10px rgba(230,185,90,.7)); }
.lb-jx > .art { position: absolute; inset: 0; width: 100%; height: 100%; }

/* ---------- Shared host overlays, restyled ---------- */
.gs.lobby > .fg { top: 12%; right: 3%; bottom: 10%; width: min(640px, 94%); border: 0; border-radius: 0; padding: 18px; background: #2a1e15 url("${tx.leather}") 0 0/320px; box-shadow: 0 30px 70px rgba(0,0,0,.85), inset 0 0 0 2px #120c06, inset 0 0 0 5px #8a6421, inset 0 0 0 6px #f5e1a4, inset 0 0 30px rgba(0,0,0,.7); font: 500 15px/1.45 ${SERIF}; color: #2b1f12; }
.gs.lobby > .fg header { background: linear-gradient(#b39256, #8c6d36 50%, #694f22); color: #22180b; padding: 10px 14px; box-shadow: inset 0 1px 0 #f5e1a4, 0 3px 8px rgba(0,0,0,.6); }
.gs.lobby > .fg header b { font: 800 18px/1 ${CAPS}; color: #22180b; letter-spacing: .06em; }
.gs.lobby > .fg header .x { color: #22180b; }
.gs.lobby > .fg nav { padding: 10px 6px; }
.gs.lobby > .fg nav button { border-radius: 0; background: #1b140c; color: #e6c687; border: 0; box-shadow: inset 0 0 0 1px #8a6421; font: 800 12px/1.6 ${CAPS}; letter-spacing: .1em; padding: 4px 14px; clip-path: polygon(8px 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 8px 100%, 0 50%); }
.gs.lobby > .fg nav button[aria-selected="true"] { background: linear-gradient(#e2c789, #8c6d36); color: #22180b; }
.gs.lobby > .fg .body { background: #e7d7b6 url("${tx.parchment}") 0 0/400px; padding: 14px 16px; box-shadow: inset 0 0 40px rgba(90,60,25,.5); }
.gs.lobby > .fg .cls { border-radius: 0; }
.gs.lobby > .fg .cls.on { border-color: #8a6421; background: rgba(138,100,33,.14); }
.gs.lobby > .fg .cls .pic, .gs.lobby > .fg .pending .pic { border-radius: 0; box-shadow: 0 0 0 2px #2a1c08, 0 0 0 4px #c59b4e, 0 3px 8px rgba(0,0,0,.5); }
.gs.lobby > .fg .stars { color: #8a6421; }
.gs.lobby > .fg .muted { color: #6d5a40; opacity: 1; }
.gs.lobby > .fg button.go { border-radius: 0; background: linear-gradient(#e2c789, #b39256 40%, #694f22); color: #22180b; font: 800 12px/1.4 ${CAPS}; letter-spacing: .06em; box-shadow: inset 0 1px 0 #fff2c8, 0 2px 4px rgba(0,0,0,.5); clip-path: polygon(6px 0, calc(100% - 6px) 0, 100% 50%, calc(100% - 6px) 100%, 6px 100%, 0 50%); padding: 5px 14px; }
.gs.lobby > .fg button.plain { border-radius: 0; background: #2a1e15; color: #e6c687; border: 0; box-shadow: inset 0 0 0 1px #8a6421; }
.gs.lobby > .fg .pending, .gs.lobby > .fg .opt { border-radius: 0; border-color: #8a6421; background: rgba(138,100,33,.1); }
.gs.lobby > .fg .tag { background: #3a2610; color: #e6c687; border-radius: 0; }
.gs.lobby > .fg .bar { border-radius: 0; background: #3a2610; } .gs.lobby > .fg .bar i { background: linear-gradient(90deg, #a87a2a, #e6c687); }
.gs.lobby > .fg textarea, .gs.lobby > .fg select { border-radius: 0; background: rgba(255,250,235,.5); color: #2b1f12; border-color: #8a6421; }
.gs.lobby > .fg .sheet .sk { border-left-color: #8a6421; }
.gs.lobby > .mw { background: radial-gradient(ellipse at 50% 40%, rgba(30,22,14,.88), rgba(4,3,2,.97)); }
.gs.lobby .mw-title { font: 800 46px/1 ${CAPS}; letter-spacing: .08em; color: #E6C687; text-shadow: 0 0 24px rgba(230,185,90,.4), 0 2px 4px #000; }
.gs.lobby .mw-art { border: 0; box-shadow: 0 0 0 3px #1c1308, 0 0 0 9px #c59b4e, 0 0 0 11px #5c4012, 0 0 0 12px #f5e1a4, 0 24px 60px rgba(0,0,0,.8); }
.gs.lobby .mw-text { font: 500 23px/1.5 ${SERIF}; color: #F3E8D2; }
.gs.lobby .mw-dots i { transform: none; clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%); width: 12px; height: 12px; background: rgba(230,198,135,.3); }
.gs.lobby .mw-dots i.on { background: #e6c687; }
.gs.lobby .mw-hint { font: 800 12px/1 ${CAPS}; color: #a69272; }

/* ---------- Phone: one scrolling column ---------- */
@container lbs (max-width: 760px) {
  .lb-stage > *, .lb-scene > * { --u: calc(100cqw / 560); --hc: 50%; }
}
.lb.phone .lb-stage { overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; }
.lb.phone .lb-scene { position: relative; inset: auto; flex: none; height: max(${U(900)}, 74cqh); }
.lb.phone .lb-hero { left: 52%; height: ${U(620)}; bottom: ${U(-6)}; }
.lb.phone .lb-hero-in > .halo { left: ${U(-230)}; width: ${U(460)}; height: ${U(460)}; top: ${U(-30)}; } .lb.phone .lb-hero-in > .halo.bust { top: ${U(90)}; } .lb.phone .lb-hero-in > .brk { display: none; }
.lb.phone .lb-hero .px::before { left: ${U(-200)}; width: ${U(400)}; }
.lb.phone .lb-glowback { left: ${U(-200)}; }
.lb.phone .lb-badge { left: ${U(12)}; top: ${U(14)}; }
.lb.phone .lb-badge .rib { padding-right: ${U(20)}; }
.lb.phone .lb-badge .rib b { max-width: ${U(380)}; font-size: ${U(30)}; }
.lb.phone .lb-badge .rib .rule { width: ${U(240)}; }
.lb.phone .lb-res { left: ${U(36)}; right: ${U(10)}; top: ${U(140)}; gap: ${U(34)} ${U(50)}; flex-wrap: wrap; justify-content: flex-start; }
.lb.phone .lb-tr { width: ${U(220)}; height: ${U(50)}; }
.lb.phone .lb-tr .ic { width: ${U(70)}; height: ${U(70)}; left: ${U(-28)}; }
.lb.phone .lb-tr b { font-size: ${U(23)}; padding-top: ${U(11)}; }
.lb.phone .lb-tr b small { font-size: ${U(15)}; }
.lb.phone .lb-tr .cap { display: none; }
.lb.phone .lb-rail { left: auto; right: ${U(4)}; top: ${U(300)}; gap: ${U(10)}; }
.lb.phone .lb-rail > button { width: ${U(100)}; }
.lb.phone .lb-rail .ri { width: ${U(70)}; height: ${U(70)}; }
.lb.phone .lb-rail span { font-size: ${U(18)}; }
.lb.phone .lb-themes { left: auto; right: ${U(110)}; top: ${U(300)}; }
.lb.phone .lb-themes button { width: ${U(260)}; height: ${U(56)}; font-size: ${U(19)}; }
.lb.phone .lb-lockets { left: ${U(8)}; top: ${U(300)}; gap: ${U(2)}; }
.lb.phone .lb-lk { width: ${U(92)}; height: ${U(110)}; } .lb.phone .lb-lk.on { width: ${U(108)}; height: ${U(130)}; }
.lb.phone .lb-lk .nm { font-size: ${U(18)}; }
.lb.phone .lb-lk, .lb.phone .lb-lk.on { margin-bottom: ${U(26)}; }
.lb.phone .lb-feed { order: 1; } .lb.phone .lb-cluster { order: 2; } .lb.phone .lb-dock { order: 3; }
.lb.phone .lb-talk { left: calc(52% - ${U(210)}); width: ${U(420)}; height: ${U(74)}; bottom: ${U(30)}; }
.lb.phone .lb-talk .nm { font-size: ${U(27)}; top: ${U(11)}; } .lb.phone .lb-talk .rl { font-size: ${U(13)}; top: ${U(44)}; } .lb.phone .lb-talk .q { right: ${U(-4)}; }
.lb.phone .lb-chart { width: ${U(320)}; height: ${U(320)}; }
.lb.phone .lb-cluster { position: relative; right: auto; top: auto; width: auto; height: auto; flex: none; padding: ${U(30)} ${U(10)} 0; display: flex; flex-direction: column; gap: ${U(40)}; }
.lb.phone .lb-cluster::before { inset: 0; background: linear-gradient(rgba(10,8,6,0), rgba(10,8,6,.78) ${U(80)}); }
.lb.phone .lb-instr { position: relative; height: auto; flex-wrap: wrap; justify-content: center; gap: ${U(40)} ${U(4)}; padding-top: ${U(30)}; }
.lb.phone .lb-ins, .lb.phone .lb-instr.n4 .lb-ins { width: ${U(166)}; height: ${U(232)}; }
.lb.phone .lb-ins > .art, .lb.phone .lb-instr.n4 .lb-ins > .art { top: 0; height: ${U(166)}; }
.lb.phone .lb-ins.k-wait { transform: none; }
.lb.phone .lb-ins.k-wait > .art, .lb.phone .lb-instr.n4 .lb-ins.k-wait > .art { top: ${U(-14)}; height: ${U(180)}; }
.lb.phone .lb-ins .pl { top: ${U(158)}; height: ${U(66)}; left: ${U(-4)}; right: ${U(-4)}; }
.lb.phone .lb-ins .pl b, .lb.phone .lb-instr.n4 .lb-ins .pl b { font-size: ${U(17)}; top: ${U(11)}; }
.lb.phone .lb-ins .pl i, .lb.phone .lb-instr.n4 .lb-ins .pl i { top: ${U(38)}; height: ${U(18)}; font-size: ${U(11)}; left: 10%; right: 10%; letter-spacing: .1em; }
.lb.phone .lb-cards { position: relative; top: auto; height: auto; flex-wrap: wrap; justify-content: center; gap: ${U(50)} ${U(20)}; }
.lb.phone .lb-card.wide { width: ${U(540)}; height: ${U(357)}; }
.lb.phone .lb-card .ttl b { font-size: ${U(21)}; }
.lb.phone .lb-card.tall { width: ${U(340)}; height: ${U(460)}; }
.lb.phone .lb-card .gauge, .lb.phone .lb-card .gauge2, .lb.phone .lb-card .pips { font-size: ${U(15)}; }
.lb.phone .lb-card .cyc { width: ${U(48)}; height: ${U(62)}; }
.lb.phone .lb-hex { width: ${U(540)}; height: ${U(456)}; }
.lb.phone .lb-nav { width: ${U(330)}; height: ${U(330)}; margin: ${U(20)} auto ${U(50)}; }

.lb.phone .lb-dock { position: relative; right: auto; bottom: auto; height: auto; flex: none; flex-wrap: wrap; justify-content: center; padding: ${U(40)} ${U(10)} ${U(10)}; gap: ${U(10)} 0; }
.lb.phone .lb-dk { height: ${U(76)}; } .lb.phone .lb-dk span { font-size: ${U(22)}; } .lb.phone .lb-dk .ic { width: ${U(46)}; height: ${U(46)}; }
.lb.phone .lb-feed { position: relative; left: auto; bottom: auto; width: auto; flex: none; margin: ${U(30)} ${U(14)} ${U(30)}; }
.lb.phone .lb-log p { font-size: ${U(19)}; }
.lb.phone .lb-ticker { height: ${U(56)}; } .lb.phone .lb-ticker .txt { font-size: ${U(19)}; } .lb.phone .lb-ticker .bell { width: ${U(66)}; height: ${U(66)}; }
.lb.phone .lb-ticker .tag, .lb.phone .lb-ticker .more { font-size: ${U(13)}; }
.lb.phone .lb-banner { height: ${U(250)}; }
.lb.phone .lb-banner .tx { left: 30%; }
.lb.phone .lb-banner .ds { font-size: ${U(19)}; -webkit-line-clamp: 4; } .lb.phone .lb-banner .tt { font-size: ${U(24)}; } .lb.phone .lb-banner .sub { font-size: ${U(13)}; }
.lb.phone .lb-book { width: 96cqw; height: 92cqh; padding: 10px; }
.lb.phone .lb-pages { column-count: 1; padding: 22px 18px; }
.lb.phone .lb-gutter, .lb.phone .lb-ribbon { display: none; }
@media (max-width: 720px) { .gs.lobby > .fg { left: 8px; right: 8px; width: auto; top: 8%; bottom: 8%; } }

/* ---------- Motion ---------- */
@keyframes lbSpin { to { transform: rotate(360deg); } }
@keyframes lbRock { 0%, 100% { transform: rotate(-1deg); } 50% { transform: rotate(1deg); } }
@keyframes lbPulseO { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }
@keyframes lbBreath { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(${U(-4)}) scale(1.004); } }
@keyframes lbEnter { from { opacity: 0; translate: ${U(-30)} 0; } to { opacity: 1; translate: 0 0; } }
@keyframes lbFlicker { from { transform: scale(1, 1); } to { transform: scale(.94, 1.06); } }
@keyframes lbSway { 0%, 100% { rotate: -2deg; } 50% { rotate: 2.5deg; } }
@keyframes lbSmoke { 0% { transform: translateY(0); opacity: .9; } 100% { transform: translateY(-14px); opacity: 0; } }
@keyframes lbTwinkle { 0%, 100% { transform: scale(1) rotate(0); opacity: .85; } 50% { transform: scale(1.35) rotate(20deg); opacity: 1; } }
@keyframes lbRays { 0%, 100% { opacity: .5; } 50% { opacity: .66; } }
@keyframes lbFade { from { opacity: 0; } to { opacity: 1; } }
.lb.rm *, .lb.rm *::before, .lb.rm *::after { animation: none !important; transition: none !important; }
`;
}
