/**
 * Stylesheets added on top of style.ts:
 *  - CSS2: the round-two pass on the 2.5D build (props at their new scale
 *    and angle, labels on the objects themselves with a caption only on
 *    hover or focus, the easel turned in with its postcards on the ledge,
 *    opaque art hung framed on the back wall, desk wedges for names, a wider
 *    narration, wings turned in toward the stage, the timber-and-net valance).
 *  - CSS3D: the 3D shop's DOM (labels projected onto the objects, the zoom
 *    panel, the narration over the canvas).
 */
const CORD = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 30' preserveAspectRatio='none'><path d='M0 30 L50 2 L100 30' fill='none' stroke='#2a1608' stroke-width='2'/><circle cx='50' cy='3' r='3' fill='#c8963e'/></svg>`)}")`;

export const CSS2 = `
.th > .h2, .th > .h3 { position: absolute; inset: 0; }
.dr .tag { display: none; }
.dr .tip { position: absolute; left: 50%; bottom: 100%; translate: -50% -4px; opacity: 0; transition: opacity .15s; pointer-events: none; white-space: nowrap; z-index: 9;
  font: 800 max(15px, calc(var(--u) * .95))/1 "Gambit Cinzel", serif; letter-spacing: .06em; color: #fff3a0; text-shadow: 0 0 6px rgba(255,200,40,.9), 0 2px 3px #000, 0 0 2px #000; }
.dr .prop.act:hover > .tip, .dr .prop.act:focus-visible > .tip, .dr .card:hover > .tip, .dr .card:focus-visible > .tip { opacity: 1; }
.dr .p-easel { --x: .205; --y: .705; --w: 21; perspective: calc(var(--u) * 42); }
.dr.hexing .p-easel { --w: 24; }
.dr .p-easel .rig { transform: rotateY(24deg) rotateX(4deg); }
.dr .p-easel .rig .edge { position: absolute; left: 10%; top: 6%; height: 71.5%; width: calc(var(--u) * 1); background: linear-gradient(90deg, #1f1108, #3a2312 60%, #2a1709); transform-origin: 0 50%; transform: rotateY(-90deg); }
.dr .board .lens { top: 5%; bottom: auto; }
.dr .board.chart { background: #e2d2a8; }
.dr .board.chart canvas { position: absolute; inset: 2.5%; width: 95%; height: 95%; }
.dr .p-easel .cards { position: absolute; left: 44%; top: 49%; display: flex; align-items: flex-end; transform: translateZ(calc(var(--u) * .8)); }
.dr .p-easel .card { width: calc(var(--u) * 6.2); }
.dr .p-easel .card + .card { margin-left: calc(var(--u) * -2.4); }
.dr .card b { padding: .3em .1em .4em; }
.dr .p-tea { --x: .455; --y: .765; --w: 10.5; }
.dr .p-hour { --x: .56; --y: .75; --w: 5.8; }
.dr .p-fight { --x: .645; --y: .795; --w: 10.5; }
.dr .p-reg { --x: .745; --y: .725; --w: 18.5; }
.dr .p-lantern { --x: .878; --y: .655; --w: 6.4; }
.dr .p-jour { --x: .862; --y: .805; --w: 13; z-index: 4; }
.dr .p-cls { --x: .858; --y: .852; --w: 13.8; z-index: 3; }
.dr.delving .p-tea { --x: .585; }
.dr .p-compass { --x: .395; --y: .825; --w: 23; }
.dr .p-compass .cw { transition: transform .08s; }
.dr .p-compass .cw:active { transform: translateY(3px); }
.dr .p-letter .lbl, .dr .p-supp .lbl { position: absolute; left: 50%; top: 100%; translate: -50% 2px; white-space: nowrap; font: 800 max(14px, calc(var(--u) * .85))/1 "Gambit Cinzel", serif; letter-spacing: .05em; color: #f5d36c; text-shadow: 0 1px 2px #000, 0 0 6px #000; }
.dr .plate { background: none; clip-path: none; padding: .45em 1.7em .7em; filter: drop-shadow(0 3px 3px rgba(0,0,0,.7)); isolation: isolate; }
.dr .plate > svg { position: absolute; inset: 0; width: 100%; height: 100%; z-index: -1; }
.dr .plate b { display: block; font: 800 max(16px, calc(var(--u) * 1.05))/1.05 "Gambit Cinzel", serif; letter-spacing: .06em; color: #231407; text-shadow: 0 1px 0 #fff3c4; }
.dr .plate small { color: #261505; text-shadow: 0 1px 0 rgba(255,243,196,.6); font-style: italic; }
.dr .wallpic { position: absolute; left: calc(var(--L) + var(--S) * (.5 + var(--o) * var(--spread, var(--sp)))); bottom: calc(100cqh * (1 - var(--edge)) + 3cqh); height: calc(var(--fh) * var(--fk, 1)); aspect-ratio: .72; translate: -50% 0; rotate: -1.5deg; z-index: 1; transition: transform .25s;
  filter: drop-shadow(0 calc(var(--u) * 1) calc(var(--u) * 1.5) rgba(0,0,0,.75)); }
.dr .wallpic .win { position: absolute; inset: 6.2% 8.6%; background: #241509 center / cover no-repeat; filter: sepia(.14) contrast(1.05); }
.dr .wallpic .win::after { content: ""; position: absolute; inset: 0; box-shadow: inset 0 0 calc(var(--u) * 1.6) rgba(20,10,0,.85); background: linear-gradient(120deg, rgba(255,240,210,.14), rgba(255,240,210,0) 38%); }
.dr .wallpic > svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.dr .wallpic .cord { position: absolute; left: 20%; right: 20%; bottom: 100%; height: 9%; background: ${CORD} center / 100% 100% no-repeat; }
.dr button.wallpic:hover, .dr button.wallpic:focus-visible { transform: translateY(-4px); outline: none; filter: drop-shadow(0 0 1.5px #ffe650) drop-shadow(0 0 1.5px #ffe650) drop-shadow(0 0 10px rgba(255,210,40,.6)); }
.dr .occ { position: absolute; left: var(--L); width: var(--S); bottom: calc(100cqh * (1 - var(--edge)) - 1px); height: calc(var(--u) * 4.5); z-index: 4; background: linear-gradient(to top, rgba(12,6,2,.78), rgba(12,6,2,0)); }
.dr .fig img { filter: drop-shadow(0 -2px 3px rgba(255,200,120,.3)) drop-shadow(0 18px 34px rgba(0,0,0,.85)) sepia(.06) brightness(.95); }
.dr .say { left: calc(var(--L) + var(--S) * .22); width: calc(var(--S) * .56); padding-top: calc(var(--u) * 2.2); }
.dr .say .desc { font-size: max(20px, calc(var(--u) * 1.2)); }
.dr .say .log { font-size: max(17px, calc(var(--u) * 1.04)); }
.dr.out .lintel { height: 15cqh; }
.dr .awn { filter: drop-shadow(0 calc(var(--u) * .6) calc(var(--u) * .8) rgba(0,0,0,.75)); }
.dr .awn > svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.dr .wing.l { transform-origin: 100% 50%; transform: perspective(900px) rotateY(40deg); }
.dr .wing.r { transform-origin: 0 50%; transform: perspective(900px) rotateY(-40deg); }
.dr.delving .lintel .dent { display: none; }
.dr .globe { right: auto; left: calc(var(--L) + var(--S) * .06); bottom: 21cqh; }
.dr.delving .p-jour { --x: .2; --y: .8; } .dr.delving .p-cls { --x: .195; --y: .835; }
.dr .wing::after { background: linear-gradient(90deg, rgba(3,1,0,.95), rgba(5,2,0,.55) 45%, rgba(5,2,0,0) 85%); }
@container (max-aspect-ratio: 4/5) {
  .dr .p-easel { --x: .15; --y: .6; --w: 13; } .dr.hexing .p-easel { --x: .26; --w: 23; }
  .dr .p-easel .card { width: calc(var(--u) * 6); }
  .dr .p-tea { --x: .42; --y: .735; --w: 9.5; }
  .dr .p-hour { --x: .55; --y: .72; --w: 5.4; }
  .dr .p-fight { --x: .68; --y: .745; --w: 9; }
  .dr .p-reg { --x: .855; --y: .61; --w: 15; }
  .dr .p-jour { --x: .87; --y: .735; --w: 11; } .dr .p-cls { --x: .865; --y: .775; --w: 11.8; }
  .dr .p-compass { --x: .5; --y: .76; --w: 34; }
  .dr .say { left: 2cqw; width: 96cqw; }
  .dr .wing.l, .dr .wing.r { transform: none; }
  .dr .wallpic { bottom: calc(100cqh * (1 - var(--edge)) + 2cqh); }
}
`;

export const CSS3D = `
.dr.d3 { background: #080503; }
.dr.d3 .stage3 { position: absolute; inset: 0; }
.dr.d3 .stage3 > .world { position: absolute; inset: 0; }
.dr.d3 .vig3 { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse 85% 90% at 50% 42%, rgba(0,0,0,0) 55%, rgba(5,2,0,.55)); box-shadow: inset 0 0 6cqh rgba(5,2,0,.6); }
.dr.d3 .labels { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.dr.d3 .labels > * { position: absolute; left: 0; top: 0; pointer-events: auto; will-change: transform; }
.dr.d3 .lb { padding: .35em .7em; white-space: nowrap; font: 800 max(14px, min(1.75cqh, 1.05cqw))/1 "Gambit Cinzel", serif; letter-spacing: .08em; text-transform: uppercase; color: #f5d36c;
  text-shadow: 0 1px 2px #000, 0 0 10px rgba(0,0,0,.95), 0 0 3px #000; transition: color .15s, text-shadow .15s; }
.dr.d3 .lb.hot, .dr.d3 .lb:hover, .dr.d3 .lb:focus-visible { color: #fff6b0; outline: none; text-shadow: 0 0 8px rgba(255,200,40,.95), 0 1px 2px #000, 0 0 3px #000; }
/* The books carry their titles on their spines; their labels only show when pointed at or focused. */
.dr.d3 .lb.quiet:not(.hot):not(:focus-visible) { opacity: 0; }
.dr.d3 .lb.plate { left: 0; bottom: auto; translate: none; z-index: auto; padding: .45em 1.7em .7em; text-transform: none; isolation: isolate; filter: drop-shadow(0 3px 3px rgba(0,0,0,.75)); }
.dr.d3 .lb.plate > svg { position: absolute; inset: 0; width: 100%; height: 100%; z-index: -1; filter: brightness(.3) saturate(1.4) sepia(.3); }
.dr.d3 .lb.plate b { display: block; font: 800 max(16px, min(2cqh, 1.15cqw))/1.05 "Gambit Cinzel", serif; letter-spacing: .06em; color: #f4d47c; text-shadow: 0 1px 1px #000; }
.dr.d3 .lb.plate small { display: block; font: italic 400 max(13px, min(1.5cqh, .9cqw))/1.15 "Gambit Fell", serif; letter-spacing: 0; color: #e2cda4; text-shadow: none; max-width: 15em; white-space: normal; text-align: center; }
.dr.d3 .lb.plate.hot, .dr.d3 .lb.plate:focus-visible { filter: drop-shadow(0 0 2px #ffe24a) drop-shadow(0 0 10px rgba(255,210,40,.85)); }
.dr.d3 .ribbon3 { padding: .3em 1.5em .36em; text-align: center; white-space: nowrap; font: 800 max(16px, min(2cqh, 1.2cqw))/1.05 "Gambit Cinzel", serif; letter-spacing: .05em; color: #2a1404;
  background: linear-gradient(180deg, #fbe7a8, #d4a24a 50%, #a8742e); clip-path: polygon(0 0, 100% 0, 92% 50%, 100% 100%, 0 100%, 8% 50%); filter: drop-shadow(0 3px 2px rgba(0,0,0,.7)); }
.dr.d3 .ribbon3 small { display: block; font: italic 400 max(14px, min(1.6cqh, 1cqw))/1.1 "Gambit Fell", serif; color: #5a3010; }
.dr.d3 .threads3 { max-width: min(19em, 22cqw); text-align: center; }
.dr.d3 .threads3 b { display: block; font: 800 max(14px, min(1.7cqh, 1cqw))/1 "Gambit Cinzel", serif; letter-spacing: .12em; color: #f5d36c; text-shadow: 0 1px 2px #000, 0 0 8px #000; margin-bottom: .35em; }
.dr.d3 .threads3 span { display: block; padding: .35em .8em .45em; rotate: 1.5deg; font: italic 400 max(15px, min(1.8cqh, 1.05cqw))/1.2 "Gambit Fell", serif; color: #2b170a;
  background: var(--tex-paper, #e9dcbc) center / 240px auto, #e9dcbc; clip-path: polygon(0 0, 100% 0, 100% 92%, 96% 100%, 4% 96%, 0 100%); filter: drop-shadow(0 3px 3px rgba(0,0,0,.6)); }
.dr.d3 .threads3:hover b, .dr.d3 .threads3:focus-visible b { color: #fff6b0; } .dr.d3 .threads3:focus-visible { outline: none; }
.dr.d3 .panel { position: absolute; top: 50%; translate: 0 -55%; width: min(30em, 34cqw); max-height: 74cqh; overflow-y: auto; z-index: 7; padding: 1.6em 1.6em 1.2em;
  font: 500 max(17px, min(2cqh, 1.15cqw))/1.45 "Gambit Garamond", Georgia, serif; color: #f4efe6;
  background: linear-gradient(180deg, rgba(30,18,10,.94), rgba(16,10,6,.96)); box-shadow: 0 2cqh 5cqh rgba(0,0,0,.7), inset 0 0 0 1px rgba(226,183,99,.55), inset 0 0 0 5px rgba(16,10,6,.9), inset 0 0 0 6px rgba(226,183,99,.3);
  clip-path: polygon(0 3%, 50% 0, 100% 3%, 100% 100%, 0 100%); animation: drPanel .35s ease; }
.dr.d3 .panel.pl { left: 4cqw; } .dr.d3 .panel.pr { right: 4cqw; }
@keyframes drPanel { from { opacity: 0; translate: 0 -52%; } }
.dr.d3 .panel h4 { margin: .2em 0 .3em; font: 800 1.25em/1.1 "Gambit Cinzel", serif; letter-spacing: .08em; color: #f5d36c; text-align: center; }
.dr.d3 .panel p { margin: 0 0 .8em; } .dr.d3 .panel .muted { color: rgba(244,239,230,.6); font-style: italic; }
.dr.d3 .pb { display: flex; align-items: center; gap: .7em; width: 100%; margin: .45em 0; padding: .55em 1.1em; font: 800 .95em/1.15 "Gambit Cinzel", serif; letter-spacing: .05em; color: #2a1404; text-align: left;
  background: linear-gradient(180deg, #fbe7a8, #d4a24a 45%, #9a6a28 80%, #d9ab52); clip-path: polygon(3% 0, 97% 0, 100% 50%, 97% 100%, 3% 100%, 0 50%); filter: drop-shadow(0 2px 2px rgba(0,0,0,.6)); }
.dr.d3 .pb:hover, .dr.d3 .pb:focus-visible { outline: none; filter: drop-shadow(0 0 2px #ffe24a) drop-shadow(0 0 8px rgba(255,210,40,.8)); }
.dr.d3 .pb.back { justify-content: center; margin-top: .9em; color: #f5d36c; background: rgba(255,255,255,.06); clip-path: none; box-shadow: inset 0 0 0 1px rgba(226,183,99,.5); }
.dr.d3 .pb .th { width: 3.2em; height: 2.2em; flex: none; background: #3a2a1a center / cover; box-shadow: inset 0 0 0 2px #4a2a14; }
.dr.d3 .hexwrap { margin: .4em 0 .8em; background: var(--tex-paper, #e2d2a8) center / cover, #e2d2a8; padding: .4em; --hex-plain: #a9a86a; --hex-wood: #5f7a4a; --hex-hill: #b39466; --hex-water: #5a7f8a; --hex-ruin: #8c7a70; }
.dr.d3 .hexwrap svg { width: 100%; height: auto; max-height: 40cqh; display: block; }
.dr.d3 .hexwrap svg polygon { stroke: #5a3a1c; stroke-width: .8; } .dr.d3 .hexwrap svg polygon.fog { fill: #b8a37a; opacity: .55; }
.dr.d3 .hexwrap svg g.here polygon { stroke: #8e1c14; stroke-width: 2.4; }
.dr.d3 .hexwrap svg g.step, .dr.d3 .hexwrap svg g.goto { cursor: pointer; }
.dr.d3 .hexwrap svg g.step polygon { stroke: #e8b830; stroke-width: 1.8; }
.dr.d3 .hexwrap svg g.step:hover polygon, .dr.d3 .hexwrap svg g.step:focus-visible polygon, .dr.d3 .hexwrap svg g.goto:hover polygon, .dr.d3 .hexwrap svg g.goto:focus-visible polygon { stroke: #ffe24a; stroke-width: 3.4; outline: none; }
.dr.d3 .hexwrap svg circle.pin { fill: #8e1c14; } .dr.d3 .hexwrap svg circle.you { fill: #ffe24a; stroke: #2a1608; stroke-width: 2; }
.dr.d3 .hexwrap svg text { font: italic 9px "Gambit Fell", serif; fill: #2a1608; }
.dr.d3 .say { left: 50%; width: min(62cqw, 1500px); translate: -50% 0; }
.dr.d3 .say .txt { padding: .4em 1.4em .2em; }
.dr.d3 .say .desc { font-size: max(21px, min(2.5cqh, 1.35cqw)); line-height: 1.45; }
.dr.d3 .say .log { font-size: max(18px, min(2.1cqh, 1.15cqw)); line-height: 1.45; }
.dr.d3 .pick { right: 3cqw; bottom: 20cqh; }
@container (max-aspect-ratio: 4/5) {
  .dr.d3 .lb { font-size: 12px; padding: .3em .4em; }
  .dr.d3 .lb.plate { padding: .4em 1.2em .55em; } .dr.d3 .lb.plate b { font-size: 13px; } .dr.d3 .lb.plate small { display: none; }
  .dr.d3 .ribbon3 { font-size: 13px; } .dr.d3 .ribbon3 small { font-size: 12px; }
  .dr.d3 .threads3 span { display: none; }
  .dr.d3 .panel, .dr.d3 .panel.pl, .dr.d3 .panel.pr { left: 3cqw; right: 3cqw; width: auto; top: auto; bottom: 21cqh; translate: none; max-height: 52cqh; font-size: 16px; }
  .dr.d3 .say { width: 96cqw; }
  .dr.d3 .say .desc { font-size: 16px; } .dr.d3 .say .log { font-size: 14px; }
  .dr.d3 .lb { font-size: 11px; letter-spacing: .04em; }
  /* The middle of the counter is too tight for every label on a phone: the cup, glass and dagger carry theirs (napkin, sand, bounty note) and light up when touched. */
  .dr.d3 .lb:is([data-k="tea"], [data-k="hour"], [data-k="fight"], [data-k="easel"]):not(.hot):not(:focus-visible) { opacity: 0; }
}
/* A fight or a talk staged in the shop (room3d.ts encounter): the shop's own labels, narration and panels step aside. */
.dr.d3.enc .labels, .dr.d3.enc .say, .dr.d3.enc .panel, .dr.d3.enc .ovl { display: none; }
.dr.d3 .encplate { position: absolute; left: 0; top: 0; z-index: 2; pointer-events: none; will-change: transform; }
.dr.d3 .encplate small:empty { display: none; }
.dr.d3.enc[data-enc="battle"] .vig3 { background: radial-gradient(ellipse 80% 78% at 50% 46%, rgba(0,0,0,0) 48%, rgba(5,2,0,.7)); }
`;
