/**
 * The Command theme's stylesheet. Sizes come from variables the theme sets
 * from its character grid: --c (one 8x8 cell in screen pixels) and --v (one
 * virtual pixel, --c / 8). The screen is the 16-colour EGA set; the frame
 * art is SVG and glyph tiles, so the CSS here places things and inverts
 * them, it does not draw them.
 */
import { frameNine, glyph, grilleTile } from "./pixels.js";

const BLUE = "#0000AA";
const CYAN = "#55FFFF";
const YEL = "#FFFF55";
const GREY = "#AAAAAA";
const DARK = "#555555";
const RED = "#FF5555";

export function commandCss(): string {
  const chev = (ink: string) => `url("${glyph("chev", ink)}")`;
  return `
.cmd { position: absolute; inset: 0; overflow: hidden; background: #050508; color: #fff; --c: 24px; --v: 3px;
  font-family: "Gambit 8bit", monospace; font-size: var(--c); line-height: var(--c); -webkit-font-smoothing: none; font-smooth: never;
  --hex-plain: url(#cmdHxPlain); --hex-wood: url(#cmdHxWood); --hex-hill: url(#cmdHxHill); --hex-water: url(#cmdHxWater); --hex-ruin: url(#cmdHxRuin); }
.cmd * { box-sizing: border-box; }
.cmd button { font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; text-align: left; cursor: inherit; letter-spacing: 0; }
.cmd .room { position: absolute; left: -12px; top: -12px; width: calc(100% + 24px); height: calc(100% + 24px); display: block; }
.cmd .defs { position: absolute; width: 0; height: 0; }
.cmd .worldhold { position: absolute; left: 0; top: 0; width: 2px; height: 2px; overflow: hidden; opacity: 0; pointer-events: none; }

/* ------------------------------ Desk props ------------------------------ */
.cmd .prop { position: absolute; will-change: transform; }
.cmd .prop svg { display: block; }
.cmd .lamp { pointer-events: none; z-index: 1; filter: drop-shadow(10px 12px 14px rgba(0,0,0,.7)); }
.cmd .dbox { z-index: 2; }
.cmd .dbox > svg { position: absolute; left: 0; top: 0; }
.cmd .dbox .front { pointer-events: none; z-index: 20; }
.cmd .disk { position: absolute; transform-origin: 50% 100%; transition: transform .18s steps(3); filter: drop-shadow(0 -2px 3px rgba(0,0,0,.55)); }
.cmd .disk:hover, .cmd .disk:focus-visible { transform: translateY(calc(var(--c) * -0.9)) rotate(-2deg); }
.cmd .disk:focus-visible { outline: 2px dashed ${YEL}; outline-offset: 2px; }
.cmd .disk.cur { transform: translateY(calc(var(--c) * -0.4)); }
.cmd .drive { z-index: 2; filter: drop-shadow(6px 10px 10px rgba(0,0,0,.65)); }
.cmd .drive .dled { transition: fill .1s; }
.cmd .drive .dled-bloom { opacity: 0; }
.cmd.busy .drive .dled { fill: #ff2200; animation: cmdLed .35s steps(2) infinite; }
.cmd.busy .drive .dled-bloom { opacity: 1; animation: cmdLed .35s steps(2) infinite; }
.cmd .card { z-index: 3; transform-origin: 50% 100%; }

/* -------------------------------- Monitor ------------------------------- */
.cmd .mon { position: absolute; z-index: 4; filter: drop-shadow(0 calc(var(--c) * .8) calc(var(--c) * 1.2) rgba(0,0,0,.8)); }
.cmd .mon > .housing { position: absolute; left: 0; top: 0; pointer-events: none; z-index: 3; }
.cmd .glass { position: absolute; overflow: hidden; background: ${BLUE}; z-index: 1;
  cursor: var(--cur, default); }
.cmd .glass button, .cmd .glass [role=button] { cursor: var(--cur, pointer); }
.cmd .crt { position: absolute; inset: 0; pointer-events: none; z-index: 30; }
.cmd .crt.scan { background-image: var(--scan), url("${grilleTile()}"); background-size: 100% var(--v), 3px 1px; }
.cmd .crt.vig { background: var(--vig) 0 0 / 100% 100% no-repeat; }
.cmd .crt.refl { will-change: transform; }
.cmd .crt.refl svg { width: 100%; height: 100%; display: block; }
.cmd.tall .glass { cursor: default; }

/* Bezel keys: real buttons set into the plastic. */
.cmd .keys { position: absolute; z-index: 5; display: flex; gap: calc(var(--c) * .5); align-items: center; }
.cmd .kc { position: relative; display: grid; justify-items: center; gap: 3px; color: #8f939b; font-size: 8px; line-height: 8px; cursor: pointer; }
.cmd .kc .silk { color: #9a9ea6; letter-spacing: 0; }
.cmd .kc svg { display: block; transition: transform .06s; }
.cmd .kc:hover svg { transform: translateY(1px); }
.cmd .kc:active svg { transform: translateY(3px); }
.cmd .kc:focus-visible { outline: 2px dashed ${YEL}; outline-offset: 3px; }
.cmd .kc .cap { fill: url(#cmdCap); }
.cmd .kc.on .lamp2 { fill: #ffb030; }

/* ------------------------------ The screen ------------------------------ */
.cmd .scr { position: absolute; inset: 0; }
.cmd .grid { position: absolute; }
.cmd .w { position: absolute; }
.cmd .w > .fr { position: absolute; inset: 0; width: 100%; height: 100%; display: block; image-rendering: pixelated; }
.cmd .w > .body { position: absolute; left: var(--c); top: var(--c); right: var(--c); bottom: var(--c); overflow: hidden; }
.cmd .notch { position: absolute; height: var(--c); white-space: pre; overflow: hidden; color: #fff; z-index: 5; }
.cmd .notch .new { color: #000; background: ${YEL}; animation: cmdBlink 1.1s steps(1) infinite; }
.cmd .glow, .cmd .w { text-shadow: 0 0 calc(var(--v) * 1.3) color-mix(in srgb, currentColor 45%, transparent), 0 0 calc(var(--v) * 3) color-mix(in srgb, currentColor 28%, transparent); }
.cmd .gl { display: inline-block; width: var(--c); height: var(--c); vertical-align: top; background: 0 0 / 100% 100% no-repeat; image-rendering: pixelated; }

/* Viewport: the place, dithered to the palette, and who is here. */
.cmd .vp .art { position: absolute; left: var(--c); top: var(--c); right: var(--c); bottom: var(--c); overflow: hidden; background: #000; }
.cmd .vp .art canvas { position: absolute; image-rendering: pixelated; will-change: transform; }
.cmd .vp .enc { position: absolute; inset: 0; pointer-events: none; will-change: transform; }
.cmd .eb { position: absolute; pointer-events: auto; display: block; }
.cmd .eb > .fr { position: absolute; left: 0; top: 0; width: 100%; display: block; }
.cmd .eb canvas { position: absolute; left: var(--c); top: var(--c); image-rendering: pixelated; }
.cmd .eb .badge { position: absolute; top: 0; width: var(--c); height: var(--c); color: ${YEL}; background: #000; }
.cmd .eb:hover .badge, .cmd .eb:focus-visible .badge, .cmd .eb.hot .badge { background: ${CYAN}; color: #000; text-shadow: none; }
.cmd .eb:focus-visible { outline: none; }
.cmd .eb.wait canvas { visibility: hidden; }
.cmd .eb .ld { position: absolute; left: var(--c); top: calc(var(--c) * 2); color: ${DARK}; animation: cmdBlink .8s steps(1) infinite; }
.cmd .focusbox { position: absolute; pointer-events: none; z-index: 8; }
.cmd .focusbox canvas { position: absolute; left: var(--c); top: var(--c); image-rendering: pixelated; }
.cmd .focusbox .role { position: absolute; left: var(--c); right: var(--c); color: ${GREY}; white-space: normal; overflow: hidden; }
.cmd .focusbox .role b { color: ${YEL}; font-weight: normal; }
.cmd .vp .jr { position: absolute; left: calc(var(--c) * 2); top: calc(var(--c) * 1.5); right: var(--c); bottom: calc(var(--c) * 1.5); overflow: hidden; color: #fff; }
.cmd .jr .in { will-change: transform; }
.cmd .jr h3 { all: unset; display: block; color: #000; background: ${CYAN}; margin: var(--c) 0 calc(var(--c) / 2) calc(var(--c) * -0.5); padding: calc(var(--c) * .25) calc(var(--c) * .5); line-height: var(--c); text-transform: uppercase; text-shadow: none; }
.cmd .jr h3:first-child { margin-top: 0; }
.cmd .jr ul { all: unset; display: block; }
.cmd .jr li { display: block; padding-left: var(--c); position: relative; color: #fff; }
.cmd .jr li::before { content: ""; position: absolute; left: 0; top: 0; width: var(--c); height: var(--c); background: url("${glyph("star", GREY)}") 0 0 / 100% 100%; image-rendering: pixelated; }
.cmd .jr li li::before { background-image: url("${glyph("hollow", DARK)}"); }
.cmd .jr li.done { color: ${DARK}; }
.cmd .jr li.bond { color: ${YEL}; }
.cmd .jr b { font-weight: normal; color: ${CYAN}; }
.cmd .jr .muted { color: ${GREY}; }
.cmd .jr .aff { display: inline-block; position: relative; width: calc(var(--c) * 5); height: var(--c); vertical-align: top; margin: 0 0 0 var(--c); image-rendering: pixelated; }
.cmd .jr .aff i { position: absolute; top: 0; bottom: 0; left: 0 !important; right: auto !important; background: url("${glyph("full", "#55FF55")}") 0 0 / var(--c) var(--c) repeat-x; image-rendering: pixelated; }
.cmd .jr .aff i.neg { background-image: url("${glyph("full", RED)}"); }
.cmd .jr .goal { color: ${YEL}; }
.cmd .jclose { position: absolute; height: var(--c); z-index: 6; color: #000; background: ${CYAN}; white-space: pre; text-shadow: none; }
.cmd .jclose:hover, .cmd .jclose:focus-visible { background: #fff; color: ${BLUE}; outline: none; }

/* Roster: one row each, the talk key right-aligned. */
.cmd .ros .row { display: flex; width: 100%; height: var(--c); white-space: pre; color: #fff; }
.cmd .ros .row .nm { flex: none; }
.cmd .ros .row .dots { flex: 1; overflow: hidden; color: ${DARK}; }
.cmd .ros .row .k { flex: none; color: ${YEL}; }
.cmd .ros .row:hover, .cmd .ros .row:focus-visible, .cmd .ros .row.hot { background: ${CYAN}; color: #000; outline: none; text-shadow: none; }
.cmd .ros .row:hover > *, .cmd .ros .row:focus-visible > *, .cmd .ros .row.hot > * { color: #000; }
.cmd .ros .row.mute { color: ${GREY}; }

/* Status: two packed rows. */
.cmd .st .r { display: flex; height: var(--c); white-space: pre; align-items: flex-start; }
.cmd .st .sp { flex: 1; }
.cmd .st .gap { flex: none; width: var(--c); }
.cmd .st .r > span { display: inline-flex; }
.cmd .st .num { color: #fff; }
.cmd .st .lo { color: ${RED}; }
.cmd .st .dim { color: ${CYAN}; }
.cmd .st .hk { display: block; height: var(--c); line-height: var(--c); color: #000; background: ${CYAN}; text-shadow: none; padding: 0 calc(var(--c) / 2); }
.cmd .st .hk:hover, .cmd .st .hk:focus-visible, .cmd .st .hk.on { background: #fff; color: ${BLUE}; outline: none; }

/* Map window: automap / overland at the grid's own resolution. */
.cmd .map canvas { display: block; width: 100%; height: 100%; image-rendering: pixelated; }
.cmd .map svg.hex { display: block; width: 100%; height: 100%; shape-rendering: crispEdges; }
.cmd svg.hex polygon { stroke: #000; stroke-width: 1.4; }
.cmd svg.hex polygon.fog { fill: #000; stroke: #0000AA; stroke-width: 1; stroke-dasharray: 2 2; }
.cmd svg.hex g.here polygon { stroke: ${YEL}; stroke-width: 2.6; }
.cmd svg.hex g.step, .cmd svg.hex g.goto { cursor: var(--cur, pointer); outline: none; }
.cmd svg.hex g.step polygon { stroke: #fff; stroke-width: 1.2; stroke-dasharray: 3 2; }
.cmd svg.hex g.goto polygon { stroke: ${CYAN}; stroke-width: 1.6; }
.cmd svg.hex g.step:hover polygon, .cmd svg.hex g.step:focus polygon, .cmd svg.hex g.goto:hover polygon, .cmd svg.hex g.goto:focus polygon { fill: #fff; stroke: ${YEL}; stroke-dasharray: none; stroke-width: 2.4; }
.cmd svg.hex circle.pin { fill: #FF55FF; stroke: #000; stroke-width: 1.5; }
.cmd svg.hex circle.you { fill: ${YEL}; stroke: #000; stroke-width: 2; }
.cmd svg.hex text { fill: #fff; font-family: "Gambit 8bit"; font-size: 7px; paint-order: stroke; stroke: #000; stroke-width: 2.5; pointer-events: none; }

/* The terminal: log, narration, commands and the prompt in one stream. */
.cmd .term .body { left: var(--c); }
.cmd .term .tx { position: absolute; inset: 0; overflow: hidden; scrollbar-width: none; }
.cmd .tx::-webkit-scrollbar, .cmd .jr::-webkit-scrollbar { display: none; }
.cmd .vp .jr { scrollbar-width: none; }
.cmd .tx .in { will-change: transform; }
.cmd .tx .l { display: block; padding-left: calc(var(--c) * 2); padding-right: 0; position: relative; white-space: normal; overflow-wrap: anywhere; width: 100%; min-height: var(--c); }
.cmd .tx .l.ch::before { content: ""; position: absolute; left: 0; top: 0; width: var(--c); height: var(--c); background: ${chev("#fff")} 0 0 / 100% 100%; image-rendering: pixelated; }
.cmd .tx .log { color: ${GREY}; padding-left: var(--c); }
.cmd .tx .log.ch::before { background-image: ${chev(GREY)}; }
.cmd .tx .log.last { color: #fff; }
.cmd .tx .desc { color: #fff; padding-left: 0; }
.cmd .tx .desc .new { color: #000; background: ${YEL}; }
.cmd .tx .hd { color: ${DARK}; padding-left: 0; }
.cmd .tx .cmdi { color: #fff; cursor: var(--cur, pointer); text-indent: 0; }
.cmd .tx .cmdi .n { position: absolute; left: 0; top: 0; color: ${YEL}; }
.cmd .tx .cmdi.g-talk { color: ${CYAN}; }
.cmd .tx .cmdi.g-go { color: ${YEL}; }
.cmd .tx .cmdi.g-go .n { color: #fff; }
.cmd .tx .cmdi.g-fight { color: ${RED}; }
.cmd .tx .cmdi.g-move { color: #fff; }
@media (hover: hover) { .cmd .tx .cmdi:hover { background: #fff; color: ${BLUE}; outline: none; text-shadow: none; } .cmd .tx .cmdi:hover .n { color: ${BLUE}; } }
.cmd .tx .cmdi:focus-visible, .cmd .tx .cmdi:active { background: #fff; color: ${BLUE}; outline: none; text-shadow: none; }
.cmd .tx .cmdi:focus-visible .n, .cmd .tx .cmdi:active .n { color: ${BLUE}; }
.cmd .tx .cmdi.cur { color: ${GREY}; }
.cmd.busy .tx .cmdi { color: ${DARK}; pointer-events: none; }
.cmd.busy .tx .cmdi .n { color: ${DARK}; }
.cmd .tx .pr { color: #fff; padding-left: var(--c); }
.cmd .tx .cmdi.ch::before { display: none; }
.cmd .tx .cu { display: inline-block; width: var(--c); height: var(--c); vertical-align: top; background: url("${glyph("full", "#fff")}") 0 0 / 100% 100%; image-rendering: pixelated; animation: cmdBlink 1s steps(1) infinite; }
.cmd .tx .busyt { color: ${YEL}; }
.cmd .tx .echo { color: ${CYAN}; }
.cmd .tx .spin { display: inline-block; width: var(--c); color: ${YEL}; }
.cmd .scrollmark { position: absolute; right: 0; width: var(--c); height: var(--c); z-index: 6; color: ${YEL}; background: #000; text-align: center; pointer-events: none; }

/* ------------------------------- Phones --------------------------------- */
/* No tube: flat bands of plain text. Rows a thumb can hit, nothing over the words, and the terminal scrolls. */
.cmd.phone .crt { display: none; }
.cmd.phone .w { text-shadow: none; }
.cmd.phone .vp > .fr, .cmd.phone .st > .fr, .cmd.phone .term > .fr { display: none; }
.cmd.phone .vp { background: #000; }
.cmd.phone .st { background: ${BLUE}; }
.cmd.phone .term { background: #000; }
.cmd.phone .vp > .notch { background: #000; color: #fff; }
.cmd.phone .vp .art { left: 0; right: 0; top: var(--c); bottom: 0; }
.cmd.phone .vp { z-index: 20; }
.cmd.phone .w.st > .body, .cmd.phone .w.term > .body { left: 0; right: 0; top: 0; bottom: 0; }

/* The status band: two rows of plain text, then keys a thumb can hit. */
.cmd.phone .w.st > .body { padding: 0 6px; }
.cmd.phone .st .dim { color: ${CYAN}; }
.cmd.phone .st .keysrow { display: flex; gap: 6px; height: 44px; margin-top: 4px; align-items: stretch; }
.cmd.phone .st .hk { flex: 1 1 auto; height: 44px; line-height: 44px; padding: 0 4px; text-align: center; touch-action: manipulation; }
.cmd.phone .st .hk:hover { background: ${CYAN}; color: #000; }
.cmd.phone .st .hk.on { background: #fff; color: ${BLUE}; }

/* The terminal: reading first, then one row per command. */
.cmd.phone .term .tx { overflow-y: auto; touch-action: pan-y; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; line-height: calc(var(--c) + 4px); }
.cmd.phone .tx .in { padding: 4px 6px 0; }
.cmd.phone .tx .l { min-height: calc(var(--c) + 4px); }
.cmd.phone .tx .log { color: ${GREY}; }
.cmd.phone .tx .log.last { color: #fff; }
.cmd.phone .tx .desc { margin: 4px 0 8px; }
.cmd.phone .tx .hd { display: none; }
.cmd.phone .tx .cmdi { display: flex; align-items: center; min-height: 44px; padding: 2px 2px 2px calc(var(--c) * 1.75); border-bottom: 1px solid ${BLUE}; touch-action: manipulation; }
.cmd.phone .tx .cmdi .n { top: 50%; left: 2px; transform: translateY(-50%); line-height: var(--c); }
.cmd.phone:not(.busy) .tx .cmdi.g-go .n { color: ${YEL}; }
.cmd.phone .tx .pr { display: none; }
/* Busy: the line says so wherever the finger has scrolled to. */
.cmd.phone .tx .pr[aria-busy] { display: block; position: sticky; bottom: 0; padding: 4px 0 4px var(--c); background: #000; z-index: 1; }
.cmd.phone.busy .scrollmark.dn { display: none !important; }
.cmd.phone .scrollmark { pointer-events: none; }
.cmd.phone .scrollmark.up { right: 2px; }
.cmd.phone .scrollmark.dn { left: 0; right: 0; width: auto; height: calc(var(--c) + 4px); font-size: 0; background: ${YEL}; color: #000; text-shadow: none; }
.cmd.phone .scrollmark.dn::after { content: "v more v"; font-size: var(--c); line-height: calc(var(--c) + 4px); }

/* The journal takes the whole screen on a phone, with a real Close. */
.cmd.phone .vp .jr { left: 6px; right: 6px; top: calc(var(--c) + 6px); bottom: 52px; touch-action: pan-y; overscroll-behavior: contain; line-height: calc(var(--c) + 4px); }
.cmd.phone .jr li { margin-bottom: 6px; }
.cmd.phone .jclose { left: 8px; right: 8px; bottom: 4px; height: 44px; line-height: 44px; text-align: center; touch-action: manipulation; }

@keyframes cmdBlink { 50% { opacity: 0; } }
@keyframes cmdLed { 50% { opacity: .25; } }
@media (prefers-reduced-motion: reduce) { .cmd *, .cmd *::before, .cmd *::after { animation: none !important; transition: none !important; } }

/* ------------------- The host overlays, in this screen ------------------ */
.gs.command > .fg { left: var(--cmd-vp-l, 12px); top: var(--cmd-vp-t, 12px); width: var(--cmd-vp-w, 560px); height: var(--cmd-vp-h, 70%); right: auto; bottom: auto;
  background: #000; color: #fff; border-radius: 0; box-shadow: none; z-index: 40;
  border: var(--cmd-c, 24px) solid transparent; border-image: url("${frameNine()}") 8 fill / var(--cmd-c, 24px) stretch; image-rendering: pixelated;
  font: var(--cmd-c, 24px) / var(--cmd-c, 24px) "Gambit 8bit", monospace; -webkit-font-smoothing: none; overflow: visible; }
.gs.command > .fg * { border-radius: 0 !important; box-shadow: none !important; }
.gs.command > .fg::before { content: "Classes"; position: absolute; top: calc(var(--cmd-c, 24px) * -1); left: 50%; transform: translateX(-50%); color: #fff; white-space: pre; height: var(--cmd-c, 24px);
  padding: 0 var(--cmd-c, 24px); background: url("${glyph("capL", "#fff")}") 0 0 / var(--cmd-c, 24px) var(--cmd-c, 24px) no-repeat, url("${glyph("capR", "#fff")}") 100% 0 / var(--cmd-c, 24px) var(--cmd-c, 24px) no-repeat, #000; image-rendering: pixelated; }
.gs.command > .fg header { padding: 0 0 var(--cmd-c, 24px); gap: var(--cmd-c, 24px); flex-wrap: wrap; }
.gs.command > .fg header { align-items: flex-start; }
.gs.command > .fg header b { display: none; }
.gs.command > .fg header .purse { color: ${CYAN}; opacity: 1; }
.gs.command > .fg header .x { font: inherit; color: #000; background: ${CYAN}; padding: 0 calc(var(--cmd-c, 24px) * .5); cursor: pointer; }
.gs.command > .fg header .x:hover, .gs.command > .fg header .x:focus-visible { background: #fff; color: ${BLUE}; outline: none; }
.gs.command > .fg nav { padding: 0 0 var(--cmd-c, 24px); gap: var(--cmd-c, 24px); }
.gs.command > .fg nav button { font: inherit; background: #000; color: ${GREY}; border: 0; padding: 0; cursor: pointer; }
.gs.command > .fg nav button[aria-selected="true"] { background: ${CYAN}; color: #000; }
.gs.command > .fg nav button:hover, .gs.command > .fg nav button:focus-visible { background: #fff; color: ${BLUE}; outline: none; }
.gs.command > .fg .body { padding: 0; scrollbar-width: none; }
.gs.command > .fg .body::-webkit-scrollbar { display: none; }
.gs.command > .fg p { margin: 0 0 var(--cmd-c, 24px); }
.gs.command > .fg .muted { color: ${GREY}; opacity: 1; }
.gs.command > .fg .cls { grid-template-columns: calc(var(--cmd-c, 24px) * 4) 1fr auto; gap: var(--cmd-c, 24px); padding: 0; margin-bottom: var(--cmd-c, 24px); border: 0; align-items: start; }
.gs.command > .fg .cls.on { background: none; }
.gs.command > .fg .cls.on .nm { background: ${YEL}; color: #000; }
.gs.command > .fg .cls .pic { width: calc(var(--cmd-c, 24px) * 4); height: calc(var(--cmd-c, 24px) * 4); image-rendering: pixelated; background-color: #000; outline: var(--cmd-v, 3px) solid #fff; outline-offset: calc(var(--cmd-v, 3px) * -2); }
.gs.command > .fg .cls .nm { font-weight: normal; color: #fff; display: inline; }
.gs.command > .fg .tag { font-size: inherit; padding: 0; background: none; color: ${DARK}; margin-left: var(--cmd-c, 24px); }
.gs.command > .fg .stars { color: ${YEL}; letter-spacing: 0; font-family: "Gambit 8bit", monospace; }
.gs.command > .fg button.go, .gs.command > .fg button.plain { font: inherit; background: ${CYAN}; color: #000; padding: 0 calc(var(--cmd-c, 24px) * .5); border: 0; cursor: pointer; }
.gs.command > .fg button.plain { background: ${GREY}; }
.gs.command > .fg button.go:hover, .gs.command > .fg button.go:focus-visible, .gs.command > .fg button.plain:hover, .gs.command > .fg button.plain:focus-visible { background: #fff; color: ${BLUE}; outline: none; }
.gs.command > .fg button.go:disabled { background: ${DARK}; color: #000; opacity: 1; }
.gs.command > .fg details { margin: 0 0 var(--cmd-c, 24px) calc(var(--cmd-c, 24px) * 5); }
.gs.command > .fg details summary { color: ${CYAN}; opacity: 1; list-style: none; }
.gs.command > .fg details summary::before { content: "> "; }
.gs.command > .fg .sheet .stats { gap: 0 var(--cmd-c, 24px); grid-template-columns: repeat(2, 1fr); }
.gs.command > .fg .sheet .sk { border-left: var(--cmd-v, 3px) solid ${GREY}; padding: 0 0 0 var(--cmd-c, 24px); }
.gs.command > .fg .sheet .sk.sig { border-left-color: ${YEL}; }
.gs.command > .fg .sheet .sk .meta { font-size: inherit; color: ${DARK}; opacity: 1; }
.gs.command > .fg textarea, .gs.command > .fg select { font: inherit; background: #000; color: ${CYAN}; border: var(--cmd-v, 3px) solid #fff; padding: calc(var(--cmd-c, 24px) * .25); }
.gs.command > .fg .bar { width: calc(var(--cmd-c, 24px) * 5); height: var(--cmd-c, 24px); background: url("${glyph("empty", DARK)}") 0 0 / var(--cmd-c, 24px) var(--cmd-c, 24px) repeat-x; image-rendering: pixelated; }
.gs.command > .fg .bar i { background: url("${glyph("full", "#55FF55")}") 0 0 / var(--cmd-c, 24px) var(--cmd-c, 24px) repeat-x; }
.gs.command > .fg .pending, .gs.command > .fg .opt { border: var(--cmd-v, 3px) solid ${YEL}; background: #000; padding: calc(var(--cmd-c, 24px) * .5); }
.gs.command > .fg .pending .pic { width: calc(var(--cmd-c, 24px) * 4); height: calc(var(--cmd-c, 24px) * 4); }
.gs.command > .fg .pending .changes { color: ${YEL}; }
.gs.command > .fg .busyline { color: #000; background: ${YEL}; padding: 0; }
.gs.command > .fg ul { padding-left: var(--cmd-c, 24px); margin: 0; }

.gs.command > .mw { left: var(--cmd-tube-l, 0); top: var(--cmd-tube-t, 0); width: var(--cmd-tube-w, 100%); height: var(--cmd-tube-h, 100%); right: auto; bottom: auto;
  background: ${BLUE}; animation: none; font-family: "Gambit 8bit", monospace; -webkit-font-smoothing: none; }
.gs.command > .mw .mw-in { width: 82%; gap: var(--cmd-c, 24px); padding: var(--cmd-c, 24px); background: #000;
  border: var(--cmd-c, 24px) solid transparent; border-image: url("${frameNine()}") 8 fill / var(--cmd-c, 24px) stretch; image-rendering: pixelated; }
.gs.command > .mw .mw-title { font: var(--cmd-c, 24px) / var(--cmd-c, 24px) "Gambit 8bit", monospace; color: ${YEL}; letter-spacing: 0; }
.gs.command > .mw .mw-art { border: var(--cmd-v, 3px) solid #fff; box-shadow: none; image-rendering: pixelated; background-color: #000; }
.gs.command > .mw .mw-text { font: var(--cmd-c, 24px) / var(--cmd-c, 24px) "Gambit 8bit", monospace; color: #fff; }
.gs.command > .mw .mw-dots i { transform: none; width: var(--cmd-c, 24px); height: var(--cmd-c, 24px); background: url("${glyph("empty", DARK)}") 0 0 / 100% 100%; image-rendering: pixelated; }
.gs.command > .mw .mw-dots i.on { background-image: url("${glyph("full", YEL)}"); }
.gs.command > .mw .mw-hint { font: var(--cmd-c, 24px) / var(--cmd-c, 24px) "Gambit 8bit", monospace; letter-spacing: 0; text-transform: none; color: ${CYAN}; opacity: 1; animation: cmdBlink 1.1s steps(1) infinite; }

/* The class panel, on a phone: after its own rules above. */
@media (max-width: 760px), (max-height: 480px) {
  .gs.command > .fg { font-size: var(--cmd-c, 16px); line-height: calc(var(--cmd-c, 16px) + 4px); }
  .gs.command > .fg button, .gs.command > .fg summary { min-height: 44px; touch-action: manipulation; }
  .gs.command > .fg header .x, .gs.command > .fg nav button, .gs.command > .fg button.go, .gs.command > .fg button.plain { padding: 0 calc(var(--cmd-c, 16px) * .5); }
  .gs.command > .fg .body { overflow-y: auto; touch-action: pan-y; overscroll-behavior: contain; }
  .gs.command > .fg header { flex-wrap: nowrap; align-items: center; gap: 8px; padding: 0 0 8px; }
  .gs.command > .fg header .purse { margin-left: 0; flex: 1 1 auto; min-width: 0; }
  .gs.command > .fg header .x { flex: none; min-width: 44px; height: 44px; text-align: center; }
  .gs.command > .fg nav { gap: 4px 8px; padding: 0 0 8px; }
  .gs.command > .fg nav button { padding: 0 6px; }
  .gs.command > .fg .cls { grid-template-columns: calc(var(--cmd-c, 16px) * 3) minmax(0, 1fr); gap: 4px 8px; margin-bottom: 8px; }
  .gs.command > .fg .cls .pic { width: calc(var(--cmd-c, 16px) * 3); height: calc(var(--cmd-c, 16px) * 3); }
  .gs.command > .fg .cls > :nth-child(n+3) { grid-column: 2; justify-self: start; }
  .gs.command > .fg details { margin: 0 0 8px calc(var(--cmd-c, 16px) * 3 + 8px); }
  .gs.command > .fg details summary { display: flex; align-items: center; }
  .gs.command > .fg .tag, .gs.command > .fg .sheet .sk .meta { color: ${GREY}; margin-left: calc(var(--cmd-c, 16px) * .5); }
  .gs.command > .fg .sheet .sk { padding-left: 8px; }
  .gs.command > .fg .sheet .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .gs.command > .fg textarea, .gs.command > .fg select { font-size: 16px; line-height: 20px; min-height: 44px; }
}
`;
}
