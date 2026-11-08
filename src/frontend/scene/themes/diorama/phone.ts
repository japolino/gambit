/**
 * The shop on a phone. The props on the counter are too small and too crowded to be the only way to act on a small
 * screen, so they stay as the picture and every action is also a plain list you can scroll (`phoneActsHtml`). Upright:
 * the room, the narration, the list, stacked. On its side: the room over the narration, the list on the right. The 3D
 * canvas is cut down to the strip it shows, which frames the whole shop and draws far fewer pixels. The flat build
 * (no WebGL, or a delve) keeps its full-size picture and lays the same two boxes over the bottom of it.
 *
 * Everything goes through the renderer's own `acts` map and hidden everywhere but a phone, so desktop is untouched.
 */
import { esc, type MenuItem, type SceneView, type ThemeCtx } from "../contract.js";

/** The whole menu, so whatever a place offers shows up, even what has no prop. `overland`: the act that opens the map. */
export function phoneActsHtml(ctx: ThemeCtx, v: SceneView, acts: Map<string, () => void>, overland: string | null): string {
  const s = ctx.status(v);
  const menu = ctx.menu(v);
  const people = ctx.people(v);
  const item = (m: MenuItem, cls: string): string => {
    acts.set(`m:${m.key}`, m.run);
    const who = m.group === "talk" ? people.find((p) => m.key === `talk:${p.id}`) : undefined;
    return `<button class="pa ${cls}" data-act="m:${esc(m.key)}"><span>${esc(m.label)}</span>${who?.role ? `<small>${esc(who.role)}</small>` : ""}</button>`;
  };
  const group = (title: string, cls: string, items: MenuItem[], extra = ""): string =>
    items.length || extra ? `<div class="pg"><h5>${title}</h5><div class="pgrid ${cls}">${extra}${items.map((m) => item(m, cls)).join("")}</div></div>` : "";
  const bits = [`Day ${s.day}`, s.time.charAt(0).toUpperCase() + s.time.slice(1), s.where, `${s.coin} ${s.currency}`, `Vigor ${Math.round(s.vigor * 100)}%`];
  if (s.supplies) bits.push(`Supplies ${s.supplies.now}/${s.supplies.max}`);
  const th = s.thread;
  const found = th ? th.found.length : 0;
  const total = th ? Math.max(th.total, found) : 0;
  const map = overland ? `<button class="pa go" data-act="${esc(overland)}"><span>The overland map</span></button>` : "";
  return `<p class="pstat">${bits.map(esc).join(" · ")}</p>
${group("Move", "move", menu.filter((m) => m.group === "move"))}
${group("Talk", "talk", menu.filter((m) => m.group === "talk"))}
${group("Do here", "do", menu.filter((m) => m.group === "do" || m.group === "fight"))}
${group("Go", "go", menu.filter((m) => m.group === "go"), map)}
${th ? `<button class="pa thread" data-act="journal"><span>Threads ${found}/${total}</span><small>${esc(th.goal)}</small></button>` : ""}
<div class="pgrid books"><button class="pa pbook" data-act="journal">Journal</button><button class="pa pbook" data-act="classes">Classes</button><button class="pa pbook" data-act="globe" aria-haspopup="true">Theme</button></div>`;
}

const COMMON = `
  .dr.d3 .lb:not(.plate), .dr.d3 .labels .st { display: none; }
  .dr.d3 .lb { pointer-events: none; }
  .dr.d3.enc[data-enc="parley"] .encplate { display: none; }
  .dr.d3 .lb.plate { padding: .35em 1.2em .5em; } .dr.d3 .lb.plate b { font-size: 13px; } .dr.d3 .lb.plate small { display: none; }
  .dr .say, .dr.d3 .say { position: relative; left: auto; right: auto; top: auto; bottom: auto; width: auto; height: auto; min-height: 0; translate: none; margin: 0; padding: 8px 14px; display: flex; flex-direction: column;
    background: #120e0b; border-top: 2px solid #e2b763; z-index: 6; overflow: hidden; }
  .dr .say .aw-bg { display: none; }
  .dr .say .txt, .dr.d3 .say .txt { flex: 1 1 auto; min-height: 0; max-height: none; padding: 0; overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; justify-content: flex-start; }
  .dr .say:has(.more) .txt { padding-right: 38px; }
  .dr .say .desc, .dr.d3 .say .desc { flex: none; font-size: 17px; line-height: 1.36; margin-bottom: .3em; }
  .dr .say .log, .dr.d3 .say .log { flex: none; font-size: 16px; line-height: 1.34; }
  .dr .say .log li { color: rgba(244,239,230,.78); }
  .dr .say .more { right: 2px; bottom: 0; width: 44px; height: 44px; min-width: 44px; min-height: 44px; }
  .dr:not(.enc) .phacts { display: block; }
  .dr .phacts { position: relative; grid-row: 3; min-height: 0; overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; padding: 0 8px 22px; background: #120e0b; border-top: 1px solid rgba(226,183,99,.3); z-index: 6;
    -webkit-mask-image: linear-gradient(#000 calc(100% - 16px), transparent); mask-image: linear-gradient(#000 calc(100% - 16px), transparent); font-family: "Gambit Garamond", Georgia, serif; }
  .dr .ovl { grid-row: 4; height: 0; }
  .dr .pstat { position: sticky; top: 0; z-index: 1; margin: 0 -8px 2px; padding: 5px 14px 4px; background: #120e0b; font: 500 13.5px/1.25 "Gambit Garamond", Georgia, serif; color: #c8b08a; }
  .dr .pg { margin-top: 6px; }
  .dr .pg h5 { margin: 0 6px 3px; font: 800 12px/1.2 "Gambit Cinzel", serif; letter-spacing: .1em; text-transform: uppercase; color: #c9a04e; }
  .dr .pgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
  .dr .pgrid.books { grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 8px; }
  .dr .phacts .pa { display: flex; flex-direction: column; justify-content: center; min-height: 46px; padding: 4px 10px; border-radius: 3px; text-align: left; font: 600 16px/1.15 "Gambit Garamond", Georgia, serif; color: #f5ebd6;
    background: linear-gradient(#2e2014, #160e08); box-shadow: inset 0 0 0 1px rgba(226,183,99,.5); }
  .dr .phacts .pa small { display: block; margin-top: 1px; font: italic 400 13px/1.15 "Gambit Fell", Georgia, serif; color: #d8c8a8; }
  .dr .phacts .pa.talk { color: #2a1404; background: linear-gradient(180deg, #fbe7a8, #d4a24a 45%, #9a6a28 80%, #d9ab52); box-shadow: 0 1px 3px rgba(0,0,0,.5); }
  .dr .phacts .pa.talk small { color: #3a2208; }
  .dr .phacts .pa.go { color: #2b170a; background: linear-gradient(#f8f0dc, #e4d4b0); box-shadow: 0 1px 3px rgba(0,0,0,.5); }
  .dr .phacts .pa.move { text-align: center; align-items: center; }
  .dr .phacts .pa.thread { width: 100%; margin-top: 8px; }
  .dr .phacts .pa.pbook { align-items: center; text-align: center; font: 800 12.5px/1.1 "Gambit Cinzel", serif; letter-spacing: .03em; color: #f5d36c; }
  .dr .phacts .pa:active { filter: brightness(1.2); }
  .dr .phacts .pa:focus-visible { outline: 2px solid #ffe24a; outline-offset: 1px; }
  .dr.busy .phacts .pa { opacity: .55; }
  .dr.d3 .panel, .dr.d3 .panel.pl, .dr.d3 .panel.pr { left: 8px; right: 8px; top: auto; bottom: 8px; width: auto; max-height: 66cqh; translate: none; font-size: 16px; touch-action: pan-y; clip-path: none; background: #140c07; }
  .dr.d3 .pb { min-height: 46px; }
  .dr .pick, .dr.d3 .pick { position: absolute; left: auto; right: 8px; top: 8px; bottom: auto; max-height: calc(100cqh - 16px); overflow-y: auto; padding: 4px 6px; }
  .dr .pick button { min-height: 44px; }
  /* The journal: one plain sheet in its leather edge. The open book's gutter would run down the middle of the only column. */
  .dr .tome { width: calc(100cqw - 12px); height: calc(100cqh - 12px); aspect-ratio: auto; box-sizing: border-box; border: 5px solid #4a1d10; border-radius: 8px; background: var(--tex-paper, #e9dcbc) center / 300px auto, #e9dcbc; }
  .dr .tome-art { display: none; }
  .dr .tome .leaf { left: 12px; right: 8px; top: 8px; bottom: 8px; padding: 0 4px 0 0; font-size: 16px; overscroll-behavior: contain; touch-action: pan-y; }
  .dr .tome .cols { column-count: 1; }
  .dr .tome .jh { padding-right: 84px; }
  .dr .tome .leaf h2 { text-align: left; font-size: 24px; letter-spacing: .1em; }
  .dr .tome .thread { max-width: none; margin: 0 0 .5em; text-align: left; }
  .dr .tome .rib { right: 8px; top: 8px; min-width: 76px; min-height: 44px; padding: 0 12px; writing-mode: horizontal-tb; text-align: center; font-size: 14px; border-radius: 3px; clip-path: none; }
  .dr:not(.d3) .spools { display: none; }
`;

export const CSS_PHONE = `
.dr .phacts, .dr.d3.enc .phacts { display: none; }
/* The class panel sits beside the theme's root, outside its size container, so this one goes by the window. */
@media (max-width: 760px), (max-height: 480px) {
  .gs.diorama > .fg { top: 6px; bottom: 6px; width: calc(100% - 12px); padding: 5px; }
  .gs.diorama > .fg header { padding: 6px 4px 6px 12px; align-items: center; }
  .gs.diorama > .fg header b { font-size: 22px; }
  .gs.diorama > .fg header .purse { font-size: 15px; }
  .gs.diorama > .fg header .x { min-width: 44px; min-height: 44px; }
  .gs.diorama > .fg nav { padding: 0 8px 8px; }
  .gs.diorama > .fg nav button { min-height: 44px; }
  .gs.diorama > .fg .body { padding: 4px 10px 14px; touch-action: pan-y; }
  .gs.diorama > .fg button.go, .gs.diorama > .fg button.plain { min-height: 44px; }
  .gs.diorama > .fg summary { min-height: 44px; display: flex; align-items: center; }
}
@container (max-width: 760px) and (max-aspect-ratio: 1/1) {
  ${COMMON}
  .dr.d3:not(.enc), .dr:not(.d3) { display: grid; grid-template-columns: minmax(0, 1fr); }
  .dr.d3:not(.enc) { grid-template-rows: 30cqh minmax(0, auto) minmax(0, 1fr); }
  .dr:not(.d3) { grid-template-rows: minmax(0, 1fr) minmax(0, auto) minmax(0, auto); }
  .dr.d3:not(.enc) .stage3, .dr.d3:not(.enc) .vig3, .dr.d3:not(.enc) .labels { inset: 0 0 auto 0; height: 30cqh; }
  .dr.d3.enc[data-enc="parley"] .stage3, .dr.d3.enc[data-enc="parley"] .vig3 { inset: 0 0 auto 0; height: 30cqh; }
  .dr .say, .dr.d3 .say { grid-row: 2; max-height: 30cqh; }
  .dr:not(.d3) .say { max-height: 24cqh; }
  .dr:not(.d3) .phacts { max-height: 44cqh; }
  /* In a delve the chart is worth seeing: up out from under the list, clear of the corridor's middle. */
  .dr.delving .p-easel { --x: .8; --y: .44; --w: 19; }
  .dr .say.open, .dr.d3 .say.open { max-height: 52cqh; }
}
@container (min-aspect-ratio: 1/1) and ((max-width: 760px) or (max-height: 480px)) {
  ${COMMON}
  .dr.d3:not(.enc), .dr:not(.d3) { display: grid; grid-template-columns: minmax(0, 57fr) minmax(0, 43fr); grid-template-rows: 52cqh minmax(0, 1fr); }
  .dr.d3:not(.enc) .stage3, .dr.d3:not(.enc) .vig3, .dr.d3:not(.enc) .labels { inset: 0 auto auto 0; width: 57cqw; height: 52cqh; }
  .dr.d3.enc[data-enc="parley"] .stage3, .dr.d3.enc[data-enc="parley"] .vig3 { inset: 0 0 auto 0; height: 30cqh; }
  .dr .say, .dr.d3 .say { grid-column: 1; grid-row: 2; }
  .dr .say.open, .dr.d3 .say.open { grid-row: 1 / 3; }
  .dr .phacts { grid-column: 2; grid-row: 1 / 3; border-top: 0; border-left: 2px solid #e2b763; }
  .dr .ovl { grid-column: 1; grid-row: 3; }
  .dr.d3 .panel, .dr.d3 .panel.pl, .dr.d3 .panel.pr { right: auto; width: min(420px, calc(100cqw - 16px)); max-height: calc(100cqh - 16px); bottom: 8px; }
}
`;
