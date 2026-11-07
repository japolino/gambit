/** Parley scene styles: painted dark fantasy, matching the battle stage's theme. */
export const PARLEY_CSS = `
.pl { position: absolute; inset: 0; display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(360px, .8fr);
  color: #ece3cf; font: 15px/1.5 "Cormorant Garamond", "Palatino Linotype", Palatino, Georgia, serif; }
.pl button, .pl textarea { font: inherit; color: inherit; }
.pl .hidden { display: none !important; }

/* scene */
.scene { position: relative; overflow: hidden; background: #0b0a09; }
.plate { position: absolute; inset: -3%; }
.plate-canvas, .plate-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.plate-img { opacity: 0; transition: opacity 1.2s ease; }
.plate.painted .plate-img { opacity: 1; }
.plate { animation: plate-drift 24s ease-in-out infinite alternate; }
@keyframes plate-drift { from { transform: scale(1.02) translateX(-0.6%); } to { transform: scale(1.06) translateX(0.6%); } }
.vignette { position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(120% 90% at 45% 40%, transparent 45%, rgba(8,6,5,.55) 75%, rgba(8,6,5,.92) 100%),
              linear-gradient(to top, rgba(8,6,5,.85), transparent 30%); }
.figure { position: absolute; left: 0; right: 0; bottom: 0; height: 94%; display: flex; justify-content: center; align-items: flex-end; pointer-events: none; }
.fig { position: relative; height: 100%; aspect-ratio: 3 / 4; max-width: 100%; transform-origin: 50% 100%;
  animation: breathe 5.2s ease-in-out infinite; }
@keyframes breathe { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-0.5%) scale(1.008, 1.004); } }
.face { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; object-position: 50% 100%;
  opacity: 0; transition: opacity .55s ease; filter: drop-shadow(0 18px 30px rgba(0,0,0,.55)); }
.face.on { opacity: 1; }
/* An opaque picture (a card's avatar) as a framed portrait: gilt rule, dark mat, the room softened behind it. */
.fig.framed { height: 80%; margin-bottom: 6%; aspect-ratio: 2 / 3; }
.fig.framed { background: radial-gradient(90% 70% at 50% 35%, #2a2119, #0e0b09); border-radius: 4px; }
.fig.framed .face { object-fit: cover; object-position: 50% 22%; border-radius: 4px; filter: none;
  box-shadow: 0 0 0 1px rgba(201,168,101,.7), 0 0 0 7px rgba(18,14,11,.92), 0 0 0 8px rgba(201,168,101,.35), 0 34px 70px rgba(0,0,0,.65); }
.fig.framed::after { content: ""; position: absolute; inset: 0; border-radius: 4px; pointer-events: none;
  background: linear-gradient(to top, rgba(8,6,5,.55), transparent 32%), radial-gradient(120% 80% at 50% 30%, transparent 60%, rgba(8,6,5,.35)); }
.scene:has(.fig.framed) .plate { filter: blur(3px) brightness(.78); transition: filter .8s ease; }
.face:not([src]), .plate-img:not([src]) { display: none; }
.silhouette { position: absolute; left: 18%; right: 18%; bottom: 0; height: 78%; border-radius: 45% 45% 8% 8% / 30% 30% 4% 4%;
  background: radial-gradient(60% 40% at 50% 22%, rgba(201,168,101,.18), rgba(23,19,15,.85) 70%); display: grid; place-items: center;
  align-content: center; gap: 6px; color: rgba(236,227,207,.45); transition: opacity .6s; }
.silhouette span { font-size: 64px; line-height: 1; }
.silhouette small { font: 12px "Segoe UI", system-ui, sans-serif; letter-spacing: .08em; }
.silhouette.gone { opacity: 0; }
.fig.m-irritated { animation: breathe 5.2s ease-in-out infinite, jolt .5s ease-out; }
.fig.m-suspicious { animation: breathe 5.2s ease-in-out infinite, lean-back .9s ease-out; }
.fig.m-afraid { animation: breathe 5.2s ease-in-out infinite, recoil .7s ease-out; }
.fig.m-moved, .fig.m-tempted { animation: breathe 5.2s ease-in-out infinite, lean-in 1.1s ease-out; }
.fig.m-amused, .fig.m-confused { animation: breathe 5.2s ease-in-out infinite, tilt 1s ease-out; }
@keyframes jolt { 0% { translate: 0 0; } 20% { translate: -1.2% 0; } 40% { translate: 1% 0; } 60% { translate: -.6% 0; } 100% { translate: 0 0; } }
@keyframes recoil { 0% { translate: 0 0; scale: 1; } 30% { translate: 0 1%; scale: .985; } 100% { translate: 0 0; scale: 1; } }
@keyframes lean-back { 0% { rotate: 0deg; } 35% { rotate: -1.4deg; } 100% { rotate: 0deg; } }
@keyframes lean-in { 0% { scale: 1; } 40% { scale: 1.025; } 100% { scale: 1; } }
@keyframes tilt { 0% { rotate: 0deg; } 40% { rotate: 1.6deg; } 100% { rotate: 0deg; } }
.plaque { position: absolute; left: 28px; bottom: 26px; text-shadow: 0 2px 10px #000; }
.plaque .who { font-size: 34px; letter-spacing: .02em; }
.plaque .role { font: 12px/1.3 "Segoe UI", system-ui, sans-serif; letter-spacing: .1em; text-transform: uppercase; color: #c9a865; opacity: .85; }
.tell { position: absolute; left: 50%; top: 9%; translate: -50% 0; max-width: min(80%, 560px); text-align: center; font-style: italic;
  font-size: 19px; color: #f1e6cc; text-shadow: 0 2px 12px #000, 0 0 2px #000; opacity: 0; pointer-events: none; }
.tell.show { animation: tell 6s ease forwards; }
@keyframes tell { 0% { opacity: 0; translate: -50% 6px; } 10%, 75% { opacity: 1; translate: -50% 0; } 100% { opacity: 0; } }

/* side */
.side { display: flex; flex-direction: column; min-height: 0; background: linear-gradient(#17130f, #0f0c0a);
  border-left: 1px solid #3c3125; box-shadow: -20px 0 40px rgba(0,0,0,.45); }
.head { padding: 18px 20px 12px; border-bottom: 1px solid #2c241b; position: relative; }
.title-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding-right: 40px; }
.kind { font: 11px/1.3 "Segoe UI", system-ui, sans-serif; letter-spacing: .12em; text-transform: uppercase; color: #9d927f; }
.mode { display: flex; border: 1px solid #3c3125; border-radius: 999px; overflow: hidden; flex: none; }
.mode button { background: none; border: 0; padding: 4px 10px; font: 11px "Segoe UI", system-ui, sans-serif; color: #9d927f; cursor: pointer; }
.mode button.on { background: #c9a865; color: #17130f; }
.meter { margin-top: 12px; display: grid; grid-template-columns: 1fr auto; align-items: end; gap: 4px 12px; }
.meter-label { font: 11px "Segoe UI", system-ui, sans-serif; letter-spacing: .12em; text-transform: uppercase; color: #9d927f; }
.meter-value { grid-column: 1; font-size: 34px; line-height: 1.05; display: flex; align-items: baseline; gap: 10px; }
.delta { font: 600 14px "Segoe UI", system-ui, sans-serif; opacity: 0; }
.delta.show { animation: delta 2.4s ease forwards; }
.delta.down { color: #8fd18a; } .delta.up { color: #e0604c; }
@keyframes delta { 0% { opacity: 0; translate: 0 6px; } 15%, 70% { opacity: 1; translate: 0 0; } 100% { opacity: 0; } }
.bar { grid-column: 1 / -1; height: 6px; border-radius: 3px; background: #2a221a; overflow: hidden; }
.bar .fill { height: 100%; background: linear-gradient(90deg, #7d6a45, #c9a865); transition: width 1s cubic-bezier(.2,.8,.2,1); }
.patience { grid-column: 2; grid-row: 1 / span 2; display: flex; align-items: center; gap: 4px; }
.pl-label { font: 11px "Segoe UI", system-ui, sans-serif; letter-spacing: .12em; text-transform: uppercase; color: #9d927f; margin-right: 4px; }
.pip { width: 9px; height: 9px; border-radius: 50%; border: 1px solid #7d6a45; }
.pip.on { background: #c9a865; border-color: #c9a865; }
.journal-btn { margin-top: 10px; background: none; border: 0; padding: 0; color: #c9a865; cursor: pointer; font: 12px "Segoe UI", system-ui, sans-serif; }
.journal { display: none; margin: 8px 0 0; padding: 10px 12px 10px 26px; background: #120f0c; border: 1px solid #2c241b; border-radius: 8px; font-size: 14px; }
.journal.open { display: block; }
.journal li { margin: 4px 0; }
.journal li.used { color: #9d927f; }
.journal li.empty { list-style: none; margin-left: -14px; color: #9d927f; font-style: italic; }

.log { flex: 1; min-height: 0; overflow: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; scroll-behavior: smooth; }
.setting { font-style: italic; color: #9d927f; font-size: 14px; }
.speaker { font: 11px "Segoe UI", system-ui, sans-serif; letter-spacing: .12em; text-transform: uppercase; color: #9d927f; margin-bottom: 2px; }
.prose p { margin: 0 0 .5em; } .prose p:last-child { margin-bottom: 0; }
.prose em { color: #d8c9a6; }
.npc .prose { font-size: 16px; }
.npc .prose.waiting .dots { display: inline-block; animation: dots 1.2s steps(4) infinite; color: #9d927f; }
@keyframes dots { 0% { opacity: .2; } 50% { opacity: 1; } 100% { opacity: .2; } }
.you { align-self: flex-end; max-width: 88%; background: #221c15; border: 1px solid #3c3125; border-radius: 12px 12px 2px 12px; padding: 8px 12px; }
.you .speaker { text-align: right; color: #c9a865; }
.read { border-left: 2px solid #3c3125; padding: 2px 0 2px 12px; display: grid; gap: 6px; }
.tray { display: flex; align-items: center; gap: 8px; }
.die { width: 34px; height: 34px; display: grid; place-items: center; font: 600 14px "Palatino Linotype", Georgia, serif; color: #17130f;
  background: #d9c08a; clip-path: polygon(50% 0, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%); transition: transform .3s, opacity .3s, background .3s; }
.die.rolling { animation: wobble .21s linear infinite; }
@keyframes wobble { 0% { rotate: -8deg; } 50% { rotate: 8deg; } 100% { rotate: -8deg; } }
.die.kept { background: #ffd27a; transform: scale(1.12); box-shadow: 0 0 12px rgba(255,210,122,.5); }
.die.dropped { opacity: .35; }
.die.nat20 { background: #fff0b0; } .die.nat1 { background: #c4544a; color: #f5e9d6; }
.result { font: 600 12px "Segoe UI", system-ui, sans-serif; letter-spacing: .1em; text-transform: uppercase; opacity: 0; transform: translateX(-4px); transition: all .35s .1s; }
.result.show { opacity: 1; transform: none; }
.r-crit_success { color: #ffd27a; } .r-success { color: #8fd18a; } .r-partial { color: #d9c08a; } .r-fail { color: #9aa3ab; } .r-crit_fail { color: #e0604c; }
.imm { font-style: italic; color: #d8c9a6; font-size: 14px; }
.trn { display: grid; gap: 4px; font: 12px/1.45 "Segoe UI", system-ui, sans-serif; color: #b7ad99; }
.tier { justify-self: start; padding: 1px 8px; border-radius: 999px; border: 1px solid #5a4a36; font-size: 11px; letter-spacing: .04em; }
.tier.t0 { border-color: #c4544a; color: #e0604c; } .tier.t1 { color: #d9a46a; } .tier.t3 { color: #8fd18a; } .tier.t4 { border-color: #ffd27a; color: #ffd27a; }
.why summary { cursor: pointer; color: #c9a865; width: max-content; }
.why pre { white-space: pre-wrap; margin: 4px 0 0; font: inherit; color: #9d927f; }
.pl[data-mode="immersive"] .trn { display: none; }
.pl[data-mode="immersive"] .die.dropped { display: none; }
.pl[data-mode="transparent"] .imm { display: none; }

.foot { padding: 12px 20px 16px; border-top: 1px solid #2c241b; display: grid; gap: 8px; }
.status { min-height: 1.2em; font-style: italic; color: #9d927f; font-size: 14px; }
.hand { display: none; }
.pl.table .hand { display: flex; justify-content: center; gap: 0; padding: 4px 0 2px; min-height: 0; flex-wrap: nowrap; overflow-x: auto; }
.pl.table .fact-card { flex: 0 0 auto; width: 132px; min-height: 92px; margin: 0 -10px; padding: 10px 10px 8px; text-align: left; font: 12px/1.3 Georgia, serif; color: #2a1f14; background: linear-gradient(#f3e6c8, #e2cfa3); border: 1px solid #8a6d3f; border-radius: 8px; box-shadow: 0 6px 14px #0008; transform: rotate(var(--tilt, 0deg)) translateY(6px); transition: transform .15s ease, margin .15s ease; cursor: pointer; }
.pl.table .fact-card:hover, .pl.table .fact-card:focus-visible { transform: rotate(0deg) translateY(-10px) scale(1.06); margin: 0 4px; z-index: 2; }
.pl.table .fact-card.used { opacity: .45; }
.pl.table .scene { background: radial-gradient(ellipse at 50% 110%, #6b3d16 0%, #2a170b 45%, #0c0805 75%); }
.pl.table .scene::after { content: ""; position: absolute; left: -10%; right: -10%; bottom: -2%; height: 22%; background: linear-gradient(#5a3a1e, #2b1a0c); border-top: 3px solid #7a532c; border-radius: 50% 50% 0 0 / 30% 30% 0 0; box-shadow: 0 -30px 60px #ffb35a22 inset; pointer-events: none; }
.pl.table .foot { background: linear-gradient(#1a110a, #120c07); }
.composer { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
.composer textarea { resize: none; background: #0f0c0a; border: 1px solid #3c3125; border-radius: 10px; padding: 9px 12px; font-size: 16px; line-height: 1.35; }
.composer textarea:focus { outline: none; border-color: #c9a865; }
.say { background: #c9a865; color: #17130f; border: 0; border-radius: 10px; padding: 0 18px; font-weight: 600; cursor: pointer; }
.say:disabled, .deal:disabled { opacity: .5; cursor: default; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; }
.actions button, .leave { background: none; border: 1px solid #3c3125; border-radius: 999px; padding: 5px 14px; cursor: pointer; font-size: 14px; color: #d8c9a6; }
.actions button:hover, .leave:hover { border-color: #c9a865; color: #ffd27a; }
.hint { font: 11px "Segoe UI", system-ui, sans-serif; color: #6b6254; }
.end { display: none; text-align: center; padding: 6px 0 2px; }
.end.show { display: grid; gap: 6px; justify-items: center; }
.end-title { font-size: 26px; color: #ffd27a; }
.end-sub { color: #b7ad99; font-size: 14px; }
.reveals { text-align: left; margin: 0; padding-left: 18px; font-size: 14px; }

@media (max-width: 760px) {
  .pl { grid-template-columns: 1fr; grid-template-rows: 40vh minmax(0, 1fr); }
  .side { border-left: 0; border-top: 1px solid #3c3125; }
  .plaque .who { font-size: 24px; }
  .plaque { left: 16px; bottom: 12px; }
  .tell { font-size: 16px; top: 12%; }
  .head { padding: 12px 14px 10px; }
  .meter-value { font-size: 26px; }
  .log { padding: 12px 14px; }
  .foot { padding: 10px 14px calc(12px + env(safe-area-inset-bottom)); }
}
`;
