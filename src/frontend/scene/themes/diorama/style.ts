/**
 * The diorama's stylesheet. Layout is in container units of the theme root:
 * --S is the stage width (a 1.9:1 box centred in the window, so an
 * ultrawide window gets deep bookcase wings either side), --L its left edge,
 * --u one stage unit (props are sized in it), --ct the counter's top. Props
 * are placed by --x (centre, fraction of the stage), --y (where they touch
 * the counter, fraction of the height) and --w (width in units); the phone
 * layout only re-assigns those three per prop.
 */
export const CSS = `
.dr { position: absolute; inset: 0; overflow: hidden; background: #0b0806; color: #f4efe6;
  --S: min(100cqw, 190cqh); --L: calc((100cqw - var(--S)) / 2); --u: min(calc(var(--S) / 100), calc(100cqh / 52));
  --ct: 58cqh; --edge: .585; --wing: .068;
  font-family: "Gambit Garamond", Georgia, serif; -webkit-tap-highlight-color: transparent; }
.dr button { font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; text-align: inherit; }
.dr .dr-defs { position: absolute; width: 0; height: 0; overflow: hidden; }
.dr .lay { position: absolute; inset: 0; pointer-events: none; }
.dr .lay > * { pointer-events: auto; }
.dr .lay > .np, .dr .np { pointer-events: none; }

/* ---- L0: the place (WebGL room / painting) ---- */
.dr .room { position: absolute; top: 0; bottom: 0; left: var(--L); width: var(--S); overflow: hidden; }
.dr .room > .world { position: absolute; inset: -2%; }
.dr .room > .world { filter: sepia(.12) brightness(.86); }
.dr.out .room > .world { filter: sepia(.28) saturate(.82) brightness(.74) contrast(1.05); }

/* ---- L1: haze over the place ---- */
.dr .haze { position: absolute; top: 0; bottom: 0; left: var(--L); width: var(--S);
  background:
    radial-gradient(ellipse 46% 50% at 42% 34%, rgba(255,186,110,.16), rgba(255,150,60,0) 70%),
    linear-gradient(180deg, rgba(12,6,2,.75), rgba(12,6,2,.15) 26%, rgba(12,6,2,.05) 45%, rgba(12,6,2,.6) 70%), radial-gradient(ellipse 70% 80% at 50% 40%, rgba(0,0,0,0) 30%, rgba(8,4,1,.55) 100%);
  mix-blend-mode: normal; }
.dr .motes { position: absolute; left: calc(var(--L) + var(--S) * .14); width: calc(var(--S) * .62); top: 8cqh; height: 52cqh; }
.dr .motes i { position: absolute; border-radius: 50%; background: radial-gradient(circle, rgba(255,236,170,.9), rgba(255,220,140,0) 70%); opacity: 0; animation: drMote var(--d) linear var(--dl) infinite; }
@keyframes drMote { 0% { transform: translate(0, 0); opacity: 0; } 15% { opacity: var(--o); } 85% { opacity: var(--o); } 100% { transform: translate(var(--dx), -18cqh); opacity: 0; } }
.dr.still .motes i { animation: none; opacity: calc(var(--o) * .7); }

/* ---- L2: people standing behind the counter ---- */
.dr .fig { position: absolute; left: calc(var(--L) + var(--S) * (.5 + var(--o) * var(--spread, var(--sp)))); bottom: calc(100cqh * (1 - var(--edge)) - var(--fh) * var(--fk, 1) * var(--sink, .36)); height: calc(var(--fh) * var(--fk, 1)); translate: -50% 0; transition: transform .25s ease; z-index: var(--z, 1); }
.dr .fig img, .dr .fig svg { height: 100%; width: auto; display: block;
  filter: drop-shadow(0 -2px 3px rgba(255,200,120,.35)) drop-shadow(0 16px 26px rgba(0,0,0,.75)) sepia(.06) brightness(.97); transition: filter .2s; }
.dr .fig.loading svg { opacity: .8; }
.dr button.fig:hover, .dr button.fig:focus-visible { transform: translateY(-6px); outline: none; }
.dr button.fig:hover img, .dr button.fig:focus-visible img, .dr button.fig:hover svg, .dr button.fig:focus-visible svg {
  filter: drop-shadow(0 0 1.5px #ffe650) drop-shadow(0 0 1.5px #ffe650) drop-shadow(0 0 9px rgba(255,210,40,.65)) drop-shadow(0 16px 26px rgba(0,0,0,.7)); }

/* ---- L3: the counter and what rests on it ---- */
.dr .ctrbox { position: absolute; left: calc(var(--L) + var(--S) * .05); width: calc(var(--S) * .9); top: var(--ct); bottom: 0; }
.dr .ctrbox canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.dr .prop { position: absolute; left: calc(var(--L) + var(--S) * var(--x)); bottom: calc(100cqh * (1 - var(--y))); width: calc(var(--u) * var(--w)); translate: -50% 0; transition: transform .2s ease; z-index: var(--z, 2); display: block; }
.dr .prop > svg { display: block; width: 100%; height: auto; overflow: visible; }
.dr .prop.act > svg .bd { filter: url(#dr-ol); }
.dr .prop.act:hover > svg .bd, .dr .prop.act:focus-visible > svg .bd { filter: url(#dr-olh); }
.dr .prop.act:hover, .dr .prop.act:focus-visible { transform: translateY(calc(var(--u) * -.35)); outline: none; }
.dr.busy .prop.act { cursor: progress; }
.dr .tag { position: absolute; left: 50%; top: calc(100% + var(--u) * .15); translate: -50% 0; rotate: var(--tr, -3deg); white-space: nowrap; pointer-events: none;
  font: italic 400 max(16px, calc(var(--u) * 1.02))/1.05 "Gambit Fell", Georgia, serif; color: #2b170a; padding: .22em .75em .3em 1.25em;
  background: var(--tex-paper, #e9dcbc) center / 240px auto, #e9dcbc; clip-path: polygon(.8em 0, 100% 0, 100% 100%, .8em 100%, 0 50%);
  filter: drop-shadow(0 2px 2px rgba(0,0,0,.55)); }
.dr .tag::before { content: ""; position: absolute; left: .55em; top: 50%; width: .32em; height: .32em; margin-top: -.16em; border-radius: 50%; background: #3a2412; }
.dr .tag small { display: block; font: 600 max(13px, calc(var(--u) * .74))/1.2 "Gambit Cinzel", serif; letter-spacing: .06em; font-style: normal; color: #6a3a18; }
.dr .prop.act:hover .tag, .dr .prop.act:focus-visible .tag { color: #000; }

/* The easel and its painting. */
.dr .p-easel { --x: .205; --y: .70; --w: 17; perspective: calc(var(--u) * 60); z-index: 1; }
.dr.hexing .p-easel { --x: .2; --w: 23; }
.dr .p-easel .rig { position: relative; transform: rotateY(16deg) rotateX(3deg); transform-origin: 50% 100%; transform-style: preserve-3d; }
.dr .p-easel .rig > svg { display: block; width: 100%; height: auto; overflow: visible; }
.dr .board { position: absolute; left: 10%; width: 80%; top: 6%; height: 71.5%; background: #2a1a0e; box-shadow: 0 calc(var(--u) * .5) calc(var(--u) * 1.4) rgba(0,0,0,.7), inset 0 0 0 calc(var(--u) * .35) #4a2a14, inset 0 0 0 calc(var(--u) * .55) #b8893e, inset 0 0 calc(var(--u) * 2) rgba(0,0,0,.8); overflow: hidden; display: block; width: 80%; }
.dr .board .pic { position: absolute; inset: calc(var(--u) * .6); background: #1a120a center / cover no-repeat; filter: sepia(.15) contrast(1.04); }
.dr .board .pic::after { content: ""; position: absolute; inset: 0; box-shadow: inset 0 0 calc(var(--u) * 1.6) rgba(20,8,0,.75); background: linear-gradient(115deg, rgba(255,240,210,.14), rgba(255,240,210,0) 40%); }
.dr button.board:hover .pic, .dr button.board:focus-visible .pic { filter: sepia(.1) contrast(1.06) brightness(1.08); }
.dr button.board:focus-visible { outline: none; }
.dr button.board:hover, .dr button.board:focus-visible { box-shadow: 0 0 0 calc(var(--u) * .2) #ffe24a, 0 0 calc(var(--u) * 1.2) rgba(255,210,40,.7), inset 0 0 0 calc(var(--u) * .35) #4a2a14, inset 0 0 0 calc(var(--u) * .55) #b8893e; }
.dr .board .seal { position: absolute; right: 4%; top: 3%; width: 26%; rotate: 12deg; filter: drop-shadow(0 2px 2px rgba(0,0,0,.6)); }
.dr .board .lens { position: absolute; left: 50%; bottom: 6%; translate: -50% 0; font: 600 max(15px, calc(var(--u) * .9))/1 "Gambit Cinzel", serif; color: #fbe7a8; background: rgba(18,10,4,.78); padding: .35em .7em; letter-spacing: .06em; white-space: nowrap; clip-path: polygon(6% 0, 94% 0, 100% 50%, 94% 100%, 6% 100%, 0 50%); }
.dr .board.map { background: var(--tex-paper, #e2d2a8) center / cover, #e2d2a8; }
.dr .board.map svg { position: absolute; inset: 4%; width: 92%; height: 92%; }
.dr .board.map svg polygon { stroke: #5a3a1c; stroke-width: .8; }
.dr .board.map svg polygon.fog { fill: #b8a37a; opacity: .55; }
.dr .board.map svg g.here polygon { stroke: #8e1c14; stroke-width: 2.4; }
.dr .board.map svg g.step, .dr .board.map svg g.goto { cursor: pointer; }
.dr .board.map svg g.step polygon { stroke: #e8b830; stroke-width: 1.8; }
.dr .board.map svg g.goto polygon { stroke: #e8b830; stroke-width: 1.4; stroke-dasharray: 3 2; }
.dr .board.map svg g.step:hover polygon, .dr .board.map svg g.step:focus-visible polygon, .dr .board.map svg g.goto:hover polygon, .dr .board.map svg g.goto:focus-visible polygon { stroke: #ffe24a; stroke-width: 3.4; filter: brightness(1.2); outline: none; }
.dr .board.map svg circle.pin { fill: #8e1c14; stroke: #f3c6a8; stroke-width: 1; }
.dr .board.map svg circle.you { fill: #ffe24a; stroke: #2a1608; stroke-width: 2; }
.dr .board.map svg text { font: italic 9px "Gambit Fell", serif; fill: #2a1608; paint-order: stroke; stroke: #e2d2a8; stroke-width: 2.5px; }
.dr .board.map { --hex-plain: #a9a86a; --hex-wood: #5f7a4a; --hex-hill: #b39466; --hex-water: #5a7f8a; --hex-ruin: #8c7a70; }
.dr .board.auto { background: var(--tex-paper, #e2d2a8) center / cover, #e2d2a8; }
.dr .board.auto canvas { position: absolute; inset: 5%; width: 90%; height: 90%; image-rendering: pixelated; }
.dr .plaque { position: absolute; left: 50%; top: 79.5%; translate: -50% 0; min-width: 52%; max-width: 96%; text-align: center; padding: .28em .9em .32em;
  font: 800 max(15px, calc(var(--u) * .95))/1.1 "Gambit Cinzel", serif; letter-spacing: .05em; color: #2a1404; text-shadow: 0 1px 0 rgba(255,240,190,.6);
  background: linear-gradient(180deg, #fbe7a8, #d4a24a 45%, #9a6a28 80%, #d9ab52); clip-path: polygon(4% 0, 96% 0, 100% 50%, 96% 100%, 4% 100%, 0 50%);
  filter: drop-shadow(0 2px 2px rgba(0,0,0,.7)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none; }
.dr .p-easel .tag { top: 96%; }

/* Postcards in a rack (the ways out). */
.dr .p-cards { --x: .35; --y: .80; --w: calc(var(--n) * 4.9 + 4); z-index: 3; }
.dr .p-cards .row { display: flex; justify-content: center; align-items: flex-end; gap: 0; padding-bottom: calc(var(--u) * 1.1); }
.dr .p-cards .rack { position: absolute; left: 0; right: 0; bottom: 0; height: calc(var(--u) * 2.3); }
.dr .p-cards .rack svg { width: 100%; height: 100%; display: block; }
.dr .card + .card { margin-left: calc(var(--u) * -2.6); }
.dr .card { position: relative; width: calc(var(--u) * 6.7); aspect-ratio: 7 / 9.6; rotate: var(--r); transform-origin: 50% 100%; transition: transform .2s ease;
  background: var(--tex-paper, #efe2c4) center / 300px auto, #efe2c4; padding: calc(var(--u) * .45) calc(var(--u) * .45) 0; display: flex; flex-direction: column;
  filter: drop-shadow(0 calc(var(--u) * .3) calc(var(--u) * .4) rgba(0,0,0,.6)); }
.dr .card .pic { flex: 1; background: #3a2a1a center / cover no-repeat; filter: sepia(.25) contrast(1.05); box-shadow: inset 0 0 calc(var(--u) * .8) rgba(30,14,0,.6); }
.dr .card .pic.none { background: #6a7f86; position: relative; } .dr .card .pic.none svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.dr .card .pm { position: absolute; right: 4%; top: 3%; width: 46%; }
.dr .card b { display: block; padding: .3em .1em .45em; font: italic 400 max(15px, calc(var(--u) * .92))/1.05 "Gambit Fell", serif; color: #2b170a; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dr .card b i { display: block; font: 600 max(11px, calc(var(--u) * .6))/1.2 "Gambit Cinzel", serif; letter-spacing: .12em; color: #8e1c14; font-style: normal; }
.dr .card:hover, .dr .card:focus-visible { transform: translateY(calc(var(--u) * -1.2)) scale(1.05); outline: none; z-index: 2;
  filter: drop-shadow(0 0 1.5px #ffe24a) drop-shadow(0 0 1.5px #ffe24a) drop-shadow(0 0 10px rgba(255,210,40,.7)); }

.dr .p-tea { --x: .47; --y: .745; --w: 6.6; }
.dr.delving .p-tea { --x: .575; } .dr.delving .p-tea .tag { top: 100%; left: 50%; right: auto; translate: -50% 0; }
.dr .p-tea .steam { animation: drSteam 3.6s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 100%; }
.dr .p-tea .steam.s1 { animation-delay: -1.2s; } .dr .p-tea .steam.s2 { animation-delay: -2.4s; }
@keyframes drSteam { 0% { transform: translateY(6px) scaleY(.6); opacity: 0; } 40% { opacity: .6; } 100% { transform: translateY(-14px) scaleY(1.1); opacity: 0; } }
.dr .p-hour { --x: .556; --y: .745; --w: 3.7; }
.dr .p-hour .sand { animation: drSand 1s linear infinite; } @keyframes drSand { to { stroke-dashoffset: -6; } }
.dr .p-fight { --x: .608; --y: .78; --w: 5.4; --tr: 4deg; }
.dr .p-reg { --x: .722; --y: .72; --w: 14.5; }
.dr .p-lantern { --x: .83; --y: .675; --w: 4.8; }
.dr .p-lantern .flame { animation: drFlick 2.4s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 100%; }
.dr .p-lantern .halo { animation: drHalo 2.4s ease-in-out infinite; }
@keyframes drFlick { 0%, 100% { transform: scale(1, 1); } 30% { transform: scale(.9, 1.08); } 60% { transform: scale(1.06, .94); } }
@keyframes drHalo { 50% { opacity: .75; } }
.dr .p-jour { --x: .846; --y: .815; --w: 10.6; --tr: 2deg; z-index: 4; }
.dr .p-cls { --x: .842; --y: .858; --w: 11.6; --tr: -4deg; z-index: 3; }
.dr .p-jour .tag { display: none; }
.dr .p-cls .tag { top: 30%; left: auto; right: 98%; translate: 0 0; }
.dr .p-supp { --x: .175; --y: .79; --w: calc(var(--n) * 1.9); display: flex; gap: 0; z-index: 3; }
.dr .p-supp svg { flex: 1; width: 0; height: auto; }
.dr .p-supp .tag { rotate: 2deg; }
.dr .p-letter { --y: .64; --w: 6; z-index: 1; }
.dr .p-compass { --x: .40; --y: .805; --w: 19; z-index: 3; }
.dr .p-compass .cw { cursor: pointer; }
.dr .p-compass .cw path, .dr .p-compass .cw ellipse { transition: filter .15s; }
.dr .p-compass .cw:hover path, .dr .p-compass .cw:focus-visible path, .dr .p-compass .cw:hover ellipse, .dr .p-compass .cw:focus-visible ellipse { filter: url(#dr-olh); }
.dr .p-compass .cw:focus { outline: none; }

/* Standees: opaque portraits framed and stood on the back of the counter. */
.dr .std { position: absolute; left: calc(var(--L) + var(--S) * (.5 + var(--o) * var(--spread, var(--sp)))); bottom: calc(100cqh * (1 - var(--y, .62))); height: calc(var(--fh) * var(--fk, 1)); aspect-ratio: var(--ar); translate: -50% 0; z-index: 1; transition: transform .25s; }
.dr .std .win { position: absolute; inset: 6.2% 8.6%; background: #241509 center / cover no-repeat; filter: sepia(.18) contrast(1.05); }
.dr .std .win::after { content: ""; position: absolute; inset: 0; box-shadow: inset 0 0 calc(var(--u) * 1.6) rgba(20,10,0,.85); background: linear-gradient(120deg, rgba(255,240,210,.16), rgba(255,240,210,0) 38%); }
.dr .std > svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.dr .std .ped { position: absolute; left: -6%; right: -6%; bottom: calc(var(--u) * -1.2); height: calc(var(--u) * 2); }
.dr .std .ped svg { width: 100%; height: 100%; display: block; }
.dr .std { filter: drop-shadow(0 calc(var(--u) * .8) calc(var(--u) * 1.2) rgba(0,0,0,.6)); }
.dr button.std:hover, .dr button.std:focus-visible { transform: translateY(-6px); outline: none; filter: drop-shadow(0 0 1.5px #ffe650) drop-shadow(0 0 1.5px #ffe650) drop-shadow(0 0 10px rgba(255,210,40,.6)); }
.dr .plate { position: absolute; left: calc(var(--L) + var(--S) * (.5 + var(--o) * var(--spread, var(--sp)))); bottom: calc(100cqh * (1 - var(--py, .64))); translate: -50% 0; z-index: 3; text-align: center; padding: .2em 1.1em .28em;
  font: 800 max(16px, calc(var(--u) * 1.05))/1.05 "Gambit Cinzel", serif; letter-spacing: .06em; color: #2a1404; text-shadow: 0 1px 0 rgba(255,240,190,.6); white-space: nowrap;
  background: linear-gradient(180deg, #fbe7a8, #d4a24a 45%, #9a6a28 80%, #d9ab52); clip-path: polygon(5% 0, 95% 0, 100% 50%, 95% 100%, 5% 100%, 0 50%);
  filter: drop-shadow(0 3px 3px rgba(0,0,0,.75)); transition: transform .2s; }
.dr .plate small { display: block; font: italic 400 max(14px, calc(var(--u) * .8))/1.1 "Gambit Fell", serif; letter-spacing: 0; color: #4a2a10; max-width: calc(var(--u) * 13); white-space: normal; margin: 0 auto; }
.dr button.plate:hover, .dr button.plate:focus-visible { transform: translateY(-3px); outline: none; filter: drop-shadow(0 0 1.5px #ffe24a) drop-shadow(0 0 8px rgba(255,210,40,.8)); }

/* ---- L4: the diorama box: wings, lintel, lamp, wall things ---- */
.dr .wing { position: absolute; top: 0; bottom: 0; width: calc(var(--L) + var(--S) * var(--wing)); background: #120a05 var(--wtex, none) top / auto 100% repeat-x; }
.dr .wing.l { left: 0; background-position: right top; }
.dr .wing.r { right: 0; background-position: left top; }
.dr .wing::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, rgba(5,2,0,.85), rgba(5,2,0,0) 60%); }
.dr .wing.r::after { transform: scaleX(-1); }
.dr .cheek { position: absolute; top: 0; bottom: 0; width: calc(var(--S) * .03); }
.dr .cheek.l { left: calc(var(--L) + var(--S) * var(--wing)); }
.dr .cheek.r { right: calc(var(--L) + var(--S) * var(--wing)); }
.dr .cheek svg { width: 100%; height: 100%; display: block; }
.dr .lintel { position: absolute; left: 0; right: 0; top: 0; height: 7.5cqh; }
.dr .lintel .beam { position: absolute; inset: 0 0 22% 0; background: var(--tex-walnut, #3a2110) center / 900px auto; box-shadow: 0 calc(var(--u) * .4) calc(var(--u) * 1.4) rgba(0,0,0,.85); }
.dr .lintel .beam::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.6), rgba(255,180,110,.1) 70%, rgba(255,200,140,.35) 92%, rgba(0,0,0,.5)); }
.dr .lintel .dent { position: absolute; left: 0; right: 0; bottom: 0; height: 26%; }
.dr .lintel .dent svg { width: 100%; height: 100%; display: block; }
.dr.out .lintel { height: 13cqh; }
.dr .awn { position: absolute; left: 0; right: 0; top: 0; height: 100%; filter: drop-shadow(0 calc(var(--u) * .6) calc(var(--u) * .8) rgba(0,0,0,.75)); }
.dr .awn svg { position: absolute; left: 0; width: 100%; display: block; }
.dr .awn .cloth { top: 0; height: 74%; }
.dr .awn .scal { top: 74%; height: 26%; }
.dr .awn::after { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 74%; background: linear-gradient(180deg, rgba(0,0,0,.45), rgba(0,0,0,0) 50%, rgba(255,220,170,.08)); }
.dr .post { position: absolute; top: 0; bottom: 0; width: calc(var(--S) * .022); background: var(--tex-walnut, #3a2110) center / auto 100%; box-shadow: inset calc(var(--u) * -.6) 0 calc(var(--u) * .8) rgba(0,0,0,.7), inset calc(var(--u) * .3) 0 calc(var(--u) * .4) rgba(255,190,120,.2), 0 0 calc(var(--u) * 2) rgba(0,0,0,.8); }
.dr .post.l { left: calc(var(--L) + var(--S) * var(--wing)); }
.dr .post.r { right: calc(var(--L) + var(--S) * var(--wing)); }
.dr .hang { position: absolute; top: 12cqh; width: calc(var(--u) * 3.6); transform-origin: 50% 0; animation: drSway 6s ease-in-out infinite; filter: drop-shadow(0 calc(var(--u) * .6) calc(var(--u) * .6) rgba(0,0,0,.7)); }
.dr .hang::before { content: ""; position: absolute; left: 50%; bottom: 100%; width: 2px; height: 6cqh; background: #2a1608; }
.dr .hang svg { width: 100%; display: block; } .dr .hang .cs { display: none; }
.dr .hang.l { left: calc(var(--L) + var(--S) * (var(--wing) + .03)); } .dr .hang.r { right: calc(var(--L) + var(--S) * (var(--wing) + .03)); animation-delay: -2s; }
@container (max-aspect-ratio: 4/5) { .dr .hang { display: none; } }
.dr.in .post, .dr.in .awn, .dr.out .beam, .dr.out .dent, .dr.out .cheek { display: none; }
.dr .lamp { position: absolute; left: calc(var(--L) + var(--S) * .285); top: 2cqh; width: calc(var(--u) * 6.4); translate: -50% 0; transform-origin: 50% 0; animation: drSway 7s ease-in-out infinite; }
.dr .lamp svg { width: 100%; display: block; }
@keyframes drSway { 0%, 100% { rotate: -1.2deg; } 50% { rotate: 1.2deg; } }
.dr .cone { position: absolute; left: calc(var(--L) + var(--S) * .285); top: calc(2cqh + var(--u) * 10); width: calc(var(--S) * .5); height: 60cqh; translate: -50% 0; mix-blend-mode: screen; opacity: .55; }
.dr .cone svg { width: 100%; height: 100%; display: block; }
.dr .clock { position: absolute; left: max(calc(var(--L) + var(--S) * .045), calc(var(--u) * 5.2)); top: 9cqh; width: calc(var(--u) * 9.4); translate: -50% 0; filter: drop-shadow(calc(var(--u) * .6) calc(var(--u) * .8) calc(var(--u) * .8) rgba(0,0,0,.8)); }
.dr .clock > svg { width: 100%; display: block; }
.dr .clock .pend { animation: drPend 2s ease-in-out infinite; transform-origin: 80px 184px; }
@keyframes drPend { 0%, 100% { transform: rotate(-9deg); } 50% { transform: rotate(9deg); } }
.dr .ribbon { position: absolute; left: 50%; top: 96%; translate: -50% 0; white-space: nowrap; padding: .26em 1.4em .32em; text-align: center;
  font: 800 max(16px, calc(var(--u) * 1))/1.05 "Gambit Cinzel", serif; letter-spacing: .05em; color: #2a1404;
  background: linear-gradient(180deg, #fbe7a8, #d4a24a 50%, #a8742e); clip-path: polygon(0 0, 100% 0, 92% 50%, 100% 100%, 0 100%, 8% 50%); filter: drop-shadow(0 3px 2px rgba(0,0,0,.7)); }
.dr .ribbon small { display: block; font: italic 400 max(14px, calc(var(--u) * .8))/1.1 "Gambit Fell", serif; letter-spacing: 0; color: #5a3010; }
.dr .spools { position: absolute; right: calc(var(--L) + var(--S) * .12); top: 6.4cqh; width: calc(var(--u) * var(--sw)); display: block; filter: drop-shadow(0 calc(var(--u) * .6) calc(var(--u) * .6) rgba(0,0,0,.75)); }
.dr .spools > svg { width: 100%; display: block; }
.dr .spools .lbl { position: absolute; left: 50%; top: calc(var(--u) * .05); translate: -50% 0; font: 800 max(13px, calc(var(--u) * .78))/1 "Gambit Cinzel", serif; letter-spacing: .1em; color: #fbe7a8; text-shadow: 0 1px 1px #000; white-space: nowrap; }
.dr .spools .goal { position: absolute; right: 2%; top: 100%; max-width: calc(var(--u) * 15); padding: .3em .7em .4em; rotate: 2deg; transform-origin: 80% 0;
  font: italic 400 max(16px, calc(var(--u) * .95))/1.15 "Gambit Fell", serif; color: #2b170a; background: var(--tex-paper, #e9dcbc) center / 240px auto, #e9dcbc;
  filter: drop-shadow(0 3px 3px rgba(0,0,0,.6)); clip-path: polygon(0 0, 100% 0, 100% 92%, 96% 100%, 4% 96%, 0 100%); }
.dr .spools:hover > svg, .dr .spools:focus-visible > svg { filter: drop-shadow(0 0 2px #ffe24a) drop-shadow(0 0 8px rgba(255,210,40,.7)); }
.dr .spools:focus-visible { outline: none; }
.dr .globe { position: absolute; right: max(calc(var(--L) + var(--S) * .005), 6px); bottom: 1cqh; width: calc(var(--u) * 6.4); z-index: 5; filter: drop-shadow(0 0 1.2px rgba(255,226,80,.95)) drop-shadow(0 calc(var(--u) * .4) calc(var(--u) * .6) rgba(0,0,0,.8)); transition: transform .2s; }
.dr .globe > svg { width: 100%; display: block; }
.dr .globe:hover, .dr .globe:focus-visible, .dr .globe[aria-expanded="true"] { transform: translateY(-4px) rotate(-4deg); outline: none; filter: drop-shadow(0 0 2px #ffe650) drop-shadow(0 0 2px #ffe650) drop-shadow(0 0 12px rgba(255,210,40,.7)); }

/* ---- Light over everything in the box ---- */
.dr .vig { position: absolute; inset: 0; pointer-events: none;
  box-shadow: inset 0 calc(var(--u) * 4) calc(var(--u) * 7) rgba(8,4,0,.8), inset 0 calc(var(--u) * -2.5) calc(var(--u) * 5) rgba(8,4,0,.6);
  background: radial-gradient(ellipse 75% 85% at 46% 42%, rgba(0,0,0,0) 52%, rgba(6,3,0,.62) 100%); }
.dr .pool { position: absolute; inset: 0; pointer-events: none; mix-blend-mode: soft-light;
  background: radial-gradient(ellipse 36% 48% at 46% 40%, rgba(255,200,120,.6), rgba(255,160,70,0) 70%), radial-gradient(ellipse 80% 90% at 50% 45%, rgba(0,0,0,0) 40%, rgba(0,0,0,.55)); }

/* ---- The narration awning ---- */
.dr .say { position: absolute; left: calc(var(--L) + var(--S) * .285); width: calc(var(--S) * .43); bottom: 1.4cqh; min-height: 16.5cqh; z-index: 6;
  padding: calc(var(--u) * 2.5) calc(var(--u) * 2.6) calc(var(--u) * 1.1); display: flex; flex-direction: column; }
.dr .say .aw-bg { position: absolute; inset: 0; width: 100%; height: 100%; filter: drop-shadow(0 calc(var(--u) * .6) calc(var(--u) * 1.4) rgba(0,0,0,.7)); }
.dr .say .hd { position: absolute; left: 50%; top: calc(var(--u) * -1.15); translate: -50% 0; display: flex; align-items: center; gap: .5em; white-space: nowrap; }
.dr .say .pill { padding: .3em 1.2em .34em; font: 800 max(16px, calc(var(--u) * .98))/1 "Gambit Cinzel", serif; letter-spacing: .1em; color: #f5d36c; text-transform: uppercase;
  background: var(--tex-walnut, #2c180b) center / 600px auto, #2c180b; clip-path: polygon(6% 0, 94% 0, 100% 50%, 94% 100%, 6% 100%, 0 50%); filter: drop-shadow(0 2px 2px rgba(0,0,0,.6)); }
.dr .say .new { width: calc(var(--u) * 3.2); display: block; rotate: -10deg; }
.dr .say .new svg { width: 100%; display: block; }
.dr .say-in { display: contents; }
.dr .say.writing .txt { max-height: 30cqh; overflow-y: auto; justify-content: flex-start; scrollbar-width: thin; scrollbar-color: #8a6a2c transparent; margin-top: 2.4cqh; -webkit-mask-image: linear-gradient(transparent, #000 1.4em); mask-image: linear-gradient(transparent, #000 1.4em); }
.dr .say.writing { z-index: 8; }
.dr .say .beat { margin-top: .55em; }
.dr .say .beat p { margin: 0 0 .25em; }
.dr .say .said { padding-left: .6em; border-left: 2px solid #e2b763; font: italic 400 max(17px, calc(var(--u) * 1.06))/1.34 "Gambit Fell", Georgia, serif; color: #ffe9b8; }
.dr .say .roll { font: 800 max(12px, calc(var(--u) * .76))/1.3 "Gambit Cinzel", serif; letter-spacing: .08em; color: #f5d36c; }
.dr .say .found { padding-left: .6em; border-left: 2px solid #8fbf7a; font: 600 max(17px, calc(var(--u) * 1.04))/1.34 "Gambit Garamond", Georgia, serif; color: #d6ebc4; }
.dr .say .told { font: 500 max(18px, calc(var(--u) * 1.12))/1.38 "Gambit Garamond", Georgia, serif; color: #f4efe6; }
/* The typewriter: the till's green and brass. Its page stands above it, and its front runs off the bottom of the panel. */
.dr .dr-tw { --tw-a: #1f4a3c; --tw-b: #0c241d; --tw-trim: #d9b35e; --tw-ribbon: #a3341f; --tw-cap: #10231c; --tw-legend: #f5e6b8; position: relative; z-index: 1; flex: none; align-self: center; box-sizing: border-box; width: min(100%, 620px); padding-top: max(42px, calc(var(--tw-page, 42px) - 6px)); margin-top: .3em; margin-bottom: min(-34px, -3.6cqh); }
.dr .dr-tw .tw-m > button { border-color: #2a1808; background: linear-gradient(180deg, #e7c47a, #b78a3a 55%, #8a6426); box-shadow: inset 0 1px 0 rgba(255,244,205,.8), 0 3px 6px rgba(0,0,0,.7); color: #2a1808; }
.dr .dr-tw .tw-m > button:hover:not(:disabled), .dr .dr-tw .tw-m > button:focus-visible { background: linear-gradient(180deg, #fbe3a6, #d0a556 55%, #a27a30); color: #1c0f04; }
.dr .say .txt { position: relative; overflow: hidden; max-height: 26cqh; display: flex; flex-direction: column; justify-content: flex-end; }
.dr .say.open .txt { max-height: 62cqh; overflow-y: auto; justify-content: flex-start; }
.dr .say .desc { margin: 0 0 .35em; font: 500 max(19px, calc(var(--u) * 1.18))/1.38 "Gambit Garamond", Georgia, serif; color: #f4efe6; }
.dr .say .log { list-style: none; margin: 0; padding: 0; font: 400 max(17px, calc(var(--u) * 1.04))/1.36 "Gambit Fell", Georgia, serif; }
.dr .say .log li { color: rgba(244,239,230,.55); padding-left: 1em; text-indent: -1em; }
.dr .say .log li::before { content: "~ "; color: #c9a04e; }
.dr .say .log li:last-child { color: #ffe9b8; }
.dr .say:not(.open) .log li:nth-last-child(n+3) { display: none; }
.dr .say .busyl { display: flex; align-items: center; gap: .6em; font: italic 400 max(18px, calc(var(--u) * 1.1))/1.3 "Gambit Fell", serif; color: #f5d36c; margin-top: .2em; }
.dr .say .busyl svg { width: calc(var(--u) * 2.4); flex: none; animation: drQuill 1.1s ease-in-out infinite; transform-origin: 20% 90%; }
@keyframes drQuill { 0%, 100% { rotate: -6deg; translate: 0 0; } 50% { rotate: 6deg; translate: 3px 1px; } }
.dr .say .busyl i { display: inline-block; animation: drDot 1.2s infinite; } .dr .say .busyl i:nth-child(3) { animation-delay: .2s; } .dr .say .busyl i:nth-child(4) { animation-delay: .4s; }
@keyframes drDot { 50% { opacity: .2; } }
.dr .say .more { position: absolute; right: calc(var(--u) * 1.1); bottom: calc(var(--u) * .5); width: calc(var(--u) * 2.2); height: calc(var(--u) * 2.2); min-width: 32px; min-height: 32px; display: grid; place-items: center; animation: drBob 1.4s ease-in-out infinite; }
.dr .say .more svg { width: 60%; }
.dr .say.open .more svg { rotate: 180deg; }
.dr .say .more:focus-visible { outline: 2px solid #ffe24a; outline-offset: 2px; }
@keyframes drBob { 50% { translate: 0 3px; } }
.dr.still * { animation-play-state: paused !important; }

/* ---- The theme picker: luggage tags hung from the globe ---- */
.dr .pick { position: absolute; right: max(calc(var(--L) + var(--S) * .02), 8px); bottom: calc(var(--u) * 11 + 1cqh); z-index: 9; display: flex; flex-direction: column; align-items: flex-end; gap: calc(var(--u) * .4); }
.dr .pick button { padding: .3em .9em .34em 1.5em; font: italic 400 max(17px, calc(var(--u) * 1.05))/1.1 "Gambit Fell", serif; color: #2b170a; background: var(--tex-paper, #e9dcbc) center / 240px auto, #e9dcbc;
  clip-path: polygon(.9em 0, 100% 0, 100% 100%, .9em 100%, 0 50%); filter: drop-shadow(0 2px 3px rgba(0,0,0,.7)); }
.dr .pick button:nth-child(odd) { rotate: -2deg; } .dr .pick button:nth-child(even) { rotate: 2deg; }
.dr .pick button[aria-checked="true"] { background: linear-gradient(180deg, #fbe7a8, #d4a24a 50%, #a8742e); font-weight: 600; }
.dr .pick button:hover, .dr .pick button:focus-visible { outline: none; filter: drop-shadow(0 0 2px #ffe24a) drop-shadow(0 0 8px rgba(255,210,40,.8)); translate: -6px 0; }

/* ---- The two shared overlays, made part of the shop ---- */
.gs.diorama > .fg { top: 7%; bottom: 7%; left: 50%; right: auto; width: min(760px, 94%); translate: -50% 0; border: 0; border-radius: 0; padding: 14px; z-index: 40;
  background: var(--dr-leather, #4a1a10) center / cover, #4a1a10; box-shadow: 0 30px 80px rgba(0,0,0,.85); font: 500 17px/1.45 "Gambit Garamond", Georgia, serif; color: #2b1a0c; }
.gs.diorama > .fg > * { background: var(--dr-paper, #eadcb8) center / 400px auto, #eadcb8; }
.gs.diorama > .fg header { padding: 14px 18px 8px; }
.gs.diorama > .fg header b { font: 800 26px/1 "Gambit Cinzel", serif; letter-spacing: .12em; color: #5a1a0c; }
.gs.diorama > .fg header .purse { font: italic 17px "Gambit Fell", serif; color: #6a3a18; }
.gs.diorama > .fg header .x { color: #5a1a0c; font-size: 28px; }
.gs.diorama > .fg nav { padding: 0 14px 10px; gap: 6px; }
.gs.diorama > .fg nav button { border: 0; border-radius: 0; padding: .3em 1em .34em 1.4em; font: 600 15px "Gambit Cinzel", serif; letter-spacing: .06em; color: #2b170a; background: rgba(120,70,20,.15); clip-path: polygon(.8em 0, 100% 0, 100% 100%, .8em 100%, 0 50%); }
.gs.diorama > .fg nav button[aria-selected="true"] { background: linear-gradient(180deg, #fbe7a8, #d4a24a 50%, #a8742e); }
.gs.diorama > .fg .body { padding: 4px 18px 18px; }
.gs.diorama > .fg .muted { color: rgba(43,26,12,.65); opacity: 1; }
.gs.diorama > .fg .cls { border-radius: 0; border: 0; border-bottom: 1px solid rgba(106,42,16,.2); }
.gs.diorama > .fg .cls.on { background: rgba(212,162,74,.22); }
.gs.diorama > .fg .cls .pic, .gs.diorama > .fg .pending .pic { border-radius: 0; box-shadow: inset 0 0 0 3px #4a2a14, inset 0 0 0 5px #b8893e, 0 3px 6px rgba(0,0,0,.4); }
.gs.diorama > .fg .tag { border-radius: 0; background: rgba(142,28,20,.15); color: #6a1a0c; }
.gs.diorama > .fg .stars { color: #a8742e; }
.gs.diorama > .fg button.go { border-radius: 0; padding: .35em 1.1em; font: 800 14px "Gambit Cinzel", serif; letter-spacing: .06em; color: #2a1404; background: linear-gradient(180deg, #fbe7a8, #d4a24a 45%, #9a6a28 80%, #d9ab52); clip-path: polygon(6% 0, 94% 0, 100% 50%, 94% 100%, 6% 100%, 0 50%); }
.gs.diorama > .fg button.plain { border-radius: 0; border: 1px solid rgba(106,42,16,.4); background: rgba(255,255,255,.25); color: #2b1a0c; }
.gs.diorama > .fg button:focus-visible { outline: 2px solid #b8893e; outline-offset: 2px; }
.gs.diorama > .fg textarea, .gs.diorama > .fg select { border-radius: 0; background: rgba(255,250,235,.6); color: #2b1a0c; border: 1px solid rgba(106,42,16,.4); }
.gs.diorama > .fg .pending, .gs.diorama > .fg .opt { border-radius: 0; border-color: rgba(106,42,16,.45); background: rgba(212,162,74,.12); }
.gs.diorama > .fg .bar { border-radius: 0; background: rgba(60,30,0,.18); } .gs.diorama > .fg .bar i { background: #8e1c14; }
.gs.diorama > .fg .busyline { color: #6a1a0c; }
.gs.diorama > .mw { background: radial-gradient(ellipse at 50% 40%, rgba(40,22,10,.9), rgba(6,3,1,.98)); }
.gs.diorama .mw-title { font: italic 46px/1 "Gambit Fell", serif; color: #f5d36c; text-shadow: 0 2px 10px rgba(255,180,80,.35); }
.gs.diorama .mw-art { border: 18px solid transparent; border-image: var(--dr-frame) 40 stretch; box-shadow: 0 20px 50px rgba(0,0,0,.8), inset 0 0 30px rgba(20,8,0,.8); filter: sepia(.15); }
.gs.diorama .mw-text { font: 500 23px/1.5 "Gambit Garamond", serif; color: #f4efe6; }
.gs.diorama .mw-dots i { transform: none; width: 12px; height: 12px; border-radius: 50%; background: rgba(142,28,20,.4); } .gs.diorama .mw-dots i.on { background: #b02e22; box-shadow: 0 0 0 2px #f5d36c; }
.gs.diorama .mw-hint { font: 600 14px "Gambit Cinzel", serif; color: #d4a24a; }

/* ---- Phone (portrait): a deeper, narrower box; props in two rows ---- */
@container (max-aspect-ratio: 4/5) {
  .dr { --S: 100cqw; --L: 0px; --u: calc(100cqw / 54); --ct: 50cqh; --edge: .505; --wing: .035; --spread: .18; --fk: .5; }
  .dr .ctrbox { left: calc(var(--S) * -.06); width: calc(var(--S) * 1.12); }
  .dr .lintel { height: 4.5cqh; } .dr.out .lintel { height: 7cqh; }
  .dr .lamp, .dr .cone { display: none; }
  .dr .clock { left: calc(var(--u) * 5.5); top: 4.6cqh; width: calc(var(--u) * 8.6); }
  .dr .clock .ribbon { top: 92%; font-size: 14px; } .dr .clock .ribbon small { font-size: 13px; }
  .dr .spools { right: calc(var(--u) * 1.5); top: 4cqh; }
  .dr .spools .goal { max-width: calc(var(--u) * 22); font-size: 14px; }
  .dr .motes { left: 10%; width: 80%; top: 10cqh; height: 35cqh; }
  .dr .p-easel { --x: .12; --y: .6; --w: 11; } .dr.hexing .p-easel { --x: .25; --w: 22; --y: .62; }
  .dr .p-reg { --x: .865; --y: .605; --w: 12; }
  .dr .p-lantern { --x: .7; --y: .6; --w: 4.4; }
  .dr .p-cards { --x: .205; --y: .74; } .dr .card { width: calc(var(--u) * 7.2); } .dr .card + .card { margin-left: calc(var(--u) * -3); }
  .dr .p-tea { --x: .425; --y: .735; --w: 7.6; } .dr.delving .p-tea { --x: .5; --y: .63; }
  .dr .p-hour { --x: .54; --y: .725; --w: 4.3; }
  .dr .p-fight { --x: .655; --y: .74; --w: 5.8; }
  .dr .p-jour { --x: .87; --y: .745; --w: 11; } .dr .p-cls { --x: .865; --y: .785; --w: 11.8; }
  .dr .p-cls .tag { display: none; }
  .dr .p-supp { --x: .62; --y: .585; } .dr.hexing .p-reg { --x: .88; }
  .dr .p-compass { --x: .3; --y: .735; --w: 26; }
  .dr .p-letter { --y: .6; }
  .dr .p-tea .tag, .dr .p-reg .tag { top: 100%; left: 50%; right: auto; translate: -50% 0; }
  .dr .p-reg .tag { display: none; }
  .dr .p-tea .tag, .dr .p-fight .tag { top: auto; bottom: calc(100% + 2px); }
  .dr .p-hour .tag { top: calc(100% + 2px); }
  .dr .p-tea .tag small { display: none; }
  .dr .plaque { display: none; }
  .dr .board .lens { font-size: 11px; padding: .3em .5em; }
  .dr .tag { font-size: 14px; } .dr .tag small { font-size: 11px; }
  .dr .card b { font-size: 13px; } .dr .card b i { display: none; }
  .dr .plaque { font-size: 13px; }
  .dr .plate { font-size: 14px; --py: .515; } .dr .plate small { display: none; }
  .dr .say { left: 2cqw; width: 96cqw; bottom: 1cqh; min-height: 0; height: 17.5cqh; padding: calc(var(--u) * 3.4) calc(var(--u) * 2.6) calc(var(--u) * 1.4); }
  .dr .say.open { height: auto; max-height: 70cqh; }
  .dr .say .txt { max-height: 100%; }
  .dr .say .desc { font-size: 16px; } .dr .say .log { font-size: 15px; }
  .dr .say .pill { font-size: 14px; }
  .dr .globe { right: auto; left: 1cqw; bottom: 19cqh; width: calc(var(--u) * 5.4); }
  .dr .pick { right: auto; left: 2cqw; bottom: 32cqh; align-items: flex-start; }
}
`;
