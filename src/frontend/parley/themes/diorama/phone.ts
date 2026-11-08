/**
 * The Diorama talk on a phone (`.pl-phone`, `.pl-short`: ../../view.ts). Reading comes first: the room (or, with no
 * WebGL, the painted plate) keeps a strip at the top, 30% of the height, and everything under it is one plain panel:
 * a compact bar (who, the stake, patience, a Notes button), the conversation, the line you write, and the deal keys.
 * The plaque's peak, the cards on the counter, the snapshots and the mode switch all cost reading space, so the last
 * three live in a sheet behind Notes. With the keyboard open (`.pl-short`) the strip and the bar's name go too.
 *
 * `decoratePhone` builds the bar's parts and the sheet, and moves the view's own controls into the sheet while the
 * root is `.pl-phone` (and back when it isn't, say a window dragged wider). The view keeps driving them: the sheet is
 * open exactly when the view's journal list is, so its button and `&journal=1` still work.
 */
import type { ParleyThemeCtx } from "../types.js";
import { FELL, GARA, CINZ } from "../../style.js";

const svgUrl = (s: string) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
const STAMP = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 80'><defs><linearGradient id='w' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#5a3418'/><stop offset='.45' stop-color='#c8915a'/><stop offset='1' stop-color='#4a2a12'/></linearGradient></defs><ellipse cx='30' cy='14' rx='15' ry='12' fill='url(#w)'/><path d='M24 24 L36 24 L38 48 L22 48 Z' fill='url(#w)'/><rect x='8' y='48' width='44' height='16' rx='2' fill='url(#w)'/><rect x='10' y='64' width='40' height='8' fill='#7a1a12'/></svg>`;
const BRASS = `linear-gradient(180deg, #fbe7a8, #d4a24a 45%, #9a6a28 80%, #d9ab52)`;
const DARK = `linear-gradient(#2e2014, #160e08)`;
const RULED = `repeating-linear-gradient(transparent 0 20px, rgba(80,120,190,.22) 20px 21px) 0 3px / 100% 100% local, linear-gradient(90deg, transparent 0 14px, rgba(200,60,60,.4) 14px 15px, transparent 15px), linear-gradient(#f8f0dc, #ece0c2)`;

/** Doubled class names: this has to beat the desktop sheets and style.ts's shared tail, whatever their order. */
const P = `.pl.pl.th-diorama.pl-phone`;
const R = `${P}.in-room`;
const S = `.pl.pl.th-diorama.pl-short`;

export const PHONE_CSS = `
.th-diorama .ph-who, .th-diorama .ph-more, .th-diorama .ph-sheet { display: none; }
${P} { display: block; --ph-top: calc(var(--pl-h, 100%) * .3); }
/* The strip: the room shows through it (or, without the room, the plate and figure stand in it). */
${P} .scene { position: absolute; left: 0; right: 0; top: 0; bottom: auto; height: var(--ph-top); overflow: hidden; }
${R} .scene { overflow: visible; }
${P} .plaque, ${P} .facts { display: none; }
${P} .tell { top: 8px; left: 50%; max-width: 92%; font-size: 15px; z-index: 3; }
${P} .moment { position: fixed; inset: 0; z-index: 8; }
${P} .moment .cap { left: 14px; right: 14px; bottom: 18px; font-size: 19px; }
/* The panel: everything under the strip. No plaque peak, no frame: a brass rule and the whole width to read in. */
${P} .side { position: absolute; left: 0; right: 0; top: var(--ph-top); bottom: 0; width: auto; height: auto; translate: none; min-width: 0;
  display: grid; grid-template-rows: auto minmax(0, 1fr) auto; padding: 0; border: 0; border-top: 2px solid #c08a52; box-shadow: 0 -6px 16px rgba(0,0,0,.45); filter: none; }
${R} .side { background: #120e0b; border-top-color: #e2b763; color: #f4efe6; }
/* The bar: name over stake and patience; Notes at the end. */
${P} .head { position: static; display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "who more" "meter more"; align-items: center; column-gap: 10px; min-height: 44px; padding: 1px 6px 1px 14px; border: 0; border-bottom: 1px solid var(--p-rule); }
${P} .title-row { display: none; }
${P} .ph-who { display: block; grid-area: who; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font: 800 14px/1.25 ${CINZ}; letter-spacing: .04em; color: #6b4423; }
${R} .ph-who { color: #f5d36c; }
${P} .meter { position: static; grid-area: meter; display: flex; align-items: center; gap: 6px; width: auto; height: auto; margin: 0; padding: 0; overflow: visible; clip-path: none; min-width: 0; }
${P} .meter-label { flex: none; font: 600 13px/1.25 ${GARA}; letter-spacing: 0; text-transform: none; color: var(--p-dim); }
${P} .meter-value { grid-column: auto; flex: none; display: flex; align-items: baseline; gap: 6px; font: 700 15px/1.25 ${GARA}; color: inherit; }
${R} .meter-value { color: #f5ebd6; }
${P} .delta { font: italic 600 14px/1.25 ${FELL}; }
${P} .bar { display: none; }
${P} .patience { grid-column: auto; grid-row: auto; flex: none; display: flex; align-items: center; gap: 3px; margin-left: auto; padding-left: 6px; }
${P} .patience .pl-label { display: none; }
${P} .pip { width: 9px; height: 9px; border-radius: 50%; }
${R} .pip { border: 1px solid #c9a04e; }
${R} .pip.on { background: #e2b763; border-color: #e2b763; }
${P} .ph-more { display: flex; grid-area: more; align-items: center; justify-content: center; gap: 5px; min-width: 76px; height: 44px; margin: 0; padding: 0 10px; cursor: pointer; border: 0; border-radius: 3px; white-space: nowrap;
  font: 800 12.5px/1 ${CINZ}; letter-spacing: .06em; color: #f5d36c; background: ${DARK}; box-shadow: inset 0 0 0 1px rgba(226,183,99,.6); }
${P} .ph-more b { min-width: 16px; padding: 2px 3px; border-radius: 2px; font-weight: 800; color: #2a1404; background: ${BRASS}; }
/* The conversation: nothing on top of it, a short fade at its top edge, comfortable type. */
${P} .log { padding: 10px 14px 16px; gap: 10px; scroll-padding-bottom: 16px; -webkit-mask-image: linear-gradient(transparent 0, #000 8px); mask-image: linear-gradient(transparent 0, #000 8px); }
${P} .setting { font-size: 15px; }
${P} .speaker { font-size: 12px; letter-spacing: .1em; }
${P} .npc .prose { font-size: 17px; line-height: 24px; }
${R} .npc .prose { font: 400 17px/24px ${GARA}; }
${P} .you { max-width: 92%; rotate: 0deg; }
${P} .you::before { display: none; }
${P} .you .prose { font-size: 16px; line-height: 22px; }
${R} .you .prose { font: italic 400 16px/22px ${FELL}; }
${P} .imm { font-size: 15px; }
${P} .result { font-size: 12px; }
${P} .trn { font-size: 13px; }
${P} .tier { font-size: 12px; }
/* The foot: the line you write and Say, then the deal keys. The hint moved to the sheet; it's reading, not a control. */
${P} .foot { display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; padding: 6px 8px calc(8px + env(safe-area-inset-bottom)); border: 0; border-top: 1px solid var(--p-rule); }
${P} .status { grid-column: 1; grid-row: auto; min-height: 0; font-size: 14px; }
${P} .status:empty { display: none; }
${P} .composer { grid-column: 1; grid-row: auto; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: stretch; gap: 6px; }
${P} .composer textarea { box-sizing: border-box; width: 100%; height: 48px; min-height: 48px; margin: 0; padding: 3px 8px 3px 20px; resize: none; color: #2b170a; font: 400 16px/21px ${FELL}; background: ${RULED}; box-shadow: inset 0 2px 4px rgba(60,30,10,.3); border: 0; }
${P} .composer textarea:focus { height: 68px; }
${P} .say { position: relative; min-width: 76px; height: auto; min-height: 48px; padding: 0 10px 0 30px; border-radius: 3px; font: 800 14px ${CINZ}; letter-spacing: .1em; color: #2a1404;
  background: ${svgUrl(STAMP)} 7px 50% / auto 24px no-repeat, ${BRASS}; box-shadow: inset 0 1px 0 rgba(255,255,255,.5), 0 2px 4px rgba(0,0,0,.5); text-shadow: 0 1px 0 rgba(255,240,200,.6); }
${P} .actions { grid-column: 1; grid-row: auto; display: flex; flex-direction: row; flex-wrap: nowrap; align-items: stretch; gap: 6px; }
${P} .actions button { flex: 1 1 auto; min-width: 0; height: auto; min-height: 44px; padding: 2px 8px; clip-path: none; filter: none; border: 0; border-radius: 3px; white-space: normal; font: 800 12.5px/1.15 ${CINZ}; font-style: normal; letter-spacing: .04em; text-transform: uppercase; color: #f5d36c; background: ${DARK}; box-shadow: inset 0 0 0 1px rgba(226,183,99,.6); }
${P} .actions .deal { flex-grow: 2; color: #2a1404; background: ${BRASS}; }
${P} .foot > .hint { display: none; }
/* The end card: a scroll of its own if what it reveals is long, the Leave button big. */
${P} .end.show { max-height: calc(var(--pl-h, 100vh) * .55); overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; }
${P} .end-title { font-size: 24px; }
${P} .end-sub, ${P} .reveals { font-size: 15px; }
${R} .end-sub { color: #d8c8a8; }
${P} .leave { min-height: 44px; min-width: 150px; padding: 4px 18px; clip-path: none; filter: none; border-radius: 3px; font: 800 14px ${CINZ}; letter-spacing: .08em; text-transform: uppercase; color: #2a1404; background: ${BRASS}; border: 0; }
/* Notes: what you know, the snapshots, the Immersive/Transparent switch, the note about the chat. */
${P} .ph-sheet:has(.journal.open) { display: flex; }
${P} .ph-sheet { position: absolute; left: 0; right: 0; top: 47px; bottom: 0; z-index: 4; flex-direction: column; gap: 12px; padding: 10px 14px calc(14px + env(safe-area-inset-bottom)); overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; background: #f1e6cb; color: #2b170a; }
${R} .ph-sheet { background: #120e0b; color: #f4efe6; }
${P} .ph-sheet-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
${P} .ph-sheet .journal-btn { position: static; display: block; min-height: 44px; margin: 0; padding: 0; flex: 1 1 auto; text-align: left; text-decoration: none; text-shadow: none; font: 800 15px/1.2 ${CINZ}; letter-spacing: .05em; text-transform: none; color: #8a4b1a; background: none; border: 0; }
${R} .ph-sheet .journal-btn { color: #f5d36c; }
${P} .ph-sheet .journal-btn::before { display: none; }
${P} .ph-close { flex: none; min-width: 76px; min-height: 44px; padding: 0 12px; cursor: pointer; border: 0; border-radius: 3px; font: 800 13px ${CINZ}; letter-spacing: .06em; color: #f5d36c; background: ${DARK}; box-shadow: inset 0 0 0 1px rgba(226,183,99,.6); }
${P} .ph-sheet .journal { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; transform: none; background: none; box-shadow: none; border: 0; font: 400 16px/1.35 ${GARA}; color: inherit; }
${P} .ph-sheet .journal li { grid-area: auto; margin: 0; padding: 8px 10px; min-height: 0; translate: none; rotate: 0deg; font: inherit; color: #2b170a; background: rgba(255,250,240,.75); box-shadow: 0 1px 2px rgba(60,30,10,.25); }
${R} .ph-sheet .journal li { color: #f5ebd6; background: rgba(226,183,99,.08); box-shadow: inset 0 0 0 1px rgba(226,183,99,.28); }
${P} .ph-sheet .journal li.used { color: #6a5a48; text-decoration: line-through rgba(168,35,27,.6); }
${R} .ph-sheet .journal li.used { color: #a8a090; text-decoration-color: rgba(240,138,106,.7); }
${P} .ph-sheet .journal li.empty { font-style: italic; }
${P} .ph-sheet .moments { position: static; inset: auto; display: flex; flex-wrap: wrap; gap: 8px; perspective: none; }
${P} .ph-sheet .moments:empty { display: none; }
${P} .ph-sheet .moments button { width: 88px; height: 66px; margin: 0; padding: 0; border: 2px solid #fbf7ec; border-radius: 1px; transform: none; rotate: 0deg; box-shadow: 0 2px 5px rgba(0,0,0,.5); aspect-ratio: auto; }
${P} .ph-sheet .moments button:nth-child(2n), ${P} .ph-sheet .moments button:hover { transform: none; rotate: 0deg; }
${P} .ph-label { font: 800 12px/1.2 ${CINZ}; letter-spacing: .1em; text-transform: uppercase; color: #8a5a2a; }
${R} .ph-label { color: #c9a04e; }
${P} .ph-moments-wrap:has(.moments:empty) { display: none; }
${P} .ph-moments-wrap, ${P} .ph-mode-wrap { display: grid; gap: 6px; }
${P} .ph-sheet .mode { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; overflow: visible; border: 0; border-radius: 0; }
${P} .ph-sheet .mode button { min-height: 44px; padding: 0 8px; rotate: 0deg; border: 0; border-radius: 3px; font: 700 13px ${CINZ}; letter-spacing: .04em; color: #f5d36c; background: ${DARK}; box-shadow: inset 0 0 0 1px rgba(226,183,99,.45); }
${P} .ph-sheet .mode button.on { color: #2a1404; background: ${BRASS}; box-shadow: 0 2px 4px rgba(0,0,0,.4); }
${P} .ph-sheet .hint { padding: 0; text-align: left; font: italic 14px/1.35 ${GARA}; color: #6b4a2a; margin: 0; }
${R} .ph-sheet .hint { color: #c8b08a; }

/* The keyboard is open, or the screen is short: the conversation and the line you write, plus one thin line for the stake. */
${S} { --ph-top: 0px; }
${S} .scene > :not(.moment) { display: none; }
${S} .side { border-top: 0; }
${S} .head { display: block; min-height: 0; padding: 3px 14px; }
${S} .ph-who, ${S} .ph-more { display: none; }
${S} .meter { min-height: 22px; }
${S} .ph-sheet:has(.journal.open) { display: none; }
${S} .log { padding-top: 6px; padding-bottom: 10px; }
${S} .actions { display: none; }
${S} .composer textarea:focus { height: 48px; }
/* A phone on its side has room for the deal keys and Notes on the lines it already has; and no line longer than a page's. */
@media (min-width: 600px) {
  ${S} .head { display: flex; align-items: center; gap: 12px; padding: 2px 6px 2px 14px; }
  ${S} .ph-who { display: block; flex: 0 1 auto; order: -1; }
  ${S} .meter { flex: 1 1 auto; }
  ${S} .patience { margin-left: 8px; }
  ${S} .ph-more { display: flex; flex: none; height: 44px; }
  ${S} .ph-sheet { top: 47px; }
  ${S} .ph-sheet:has(.journal.open) { display: flex; }
  ${S} .log { padding-left: max(14px, calc((100% - 660px) / 2)); padding-right: max(14px, calc((100% - 660px) / 2)); }
  ${S} .foot { grid-template-columns: minmax(0, 1fr) auto; }
  ${S} .status { grid-column: 1 / -1; }
  ${S} .actions { display: flex; grid-column: 2; flex-wrap: nowrap; }
  ${S} .actions button { flex: 0 0 auto; min-height: 48px; max-width: 170px; }
  ${S} .end { grid-column: 1 / -1; }
}
`;

/** Build the bar's parts and the sheet; hold the view's controls in the sheet while the root is `.pl-phone`. */
export function decoratePhone(ctx: ParleyThemeCtx): { update(): void; destroy(): void } {
  const { root, side, scene } = ctx;
  const head = side.querySelector<HTMLElement>(".head");
  const jb = root.querySelector<HTMLButtonElement>(".journal-btn");
  const jl = root.querySelector<HTMLElement>(".journal");
  const mode = side.querySelector<HTMLElement>(".mode");
  const strip = scene.querySelector<HTMLElement>(".moments");
  const hint = side.querySelector<HTMLElement>(".hint");
  if (!head || !jb || !jl || !mode || !strip || !hint) return { update() {}, destroy() {} };

  const who = document.createElement("div");
  who.className = "ph-who";
  who.textContent = ctx.scenario.npc.name;
  const more = document.createElement("button");
  more.type = "button";
  more.className = "ph-more";
  more.setAttribute("aria-haspopup", "dialog");
  more.addEventListener("click", () => jb.click());
  head.append(who, more);

  const sheet = document.createElement("div");
  sheet.className = "ph-sheet";
  const top = document.createElement("div");
  top.className = "ph-sheet-head";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "ph-close";
  close.textContent = "Close";
  close.addEventListener("click", () => jb.click());
  top.append(close);
  const label = (text: string) => {
    const d = document.createElement("div");
    d.className = "ph-label";
    d.textContent = text;
    return d;
  };
  const momentsWrap = document.createElement("div");
  momentsWrap.className = "ph-moments-wrap";
  momentsWrap.append(label("Moments"));
  const modeWrap = document.createElement("div");
  modeWrap.className = "ph-mode-wrap";
  modeWrap.append(label("How the talk reads"));
  sheet.append(top, momentsWrap, modeWrap);
  side.append(sheet);

  // Each control goes back exactly where the view (or the room's counter) had it.
  const homes = [jb, jl, mode, strip, hint].map((el) => ({ el, parent: el.parentElement, next: el.nextSibling }));
  let inSheet = false;
  const place = () => {
    const phone = root.classList.contains("pl-phone");
    if (phone === inSheet) return;
    inSheet = phone;
    if (phone) {
      for (const h of homes) {
        h.parent = h.el.parentElement;
        h.next = h.el.nextSibling;
      }
      top.prepend(jb);
      top.after(jl);
      momentsWrap.append(strip);
      modeWrap.append(mode);
      sheet.append(hint);
    } else {
      for (const h of [...homes].reverse()) h.parent?.insertBefore(h.el, h.next && h.next.parentNode === h.parent ? h.next : null);
    }
  };
  const paint = () => {
    const n = [...jl.querySelectorAll("li")].filter((li) => !li.classList.contains("empty")).length;
    const label = more.firstChild;
    if (!label) more.append("Notes ", Object.assign(document.createElement("b"), { textContent: String(n) }));
    else more.querySelector("b")!.textContent = String(n);
    more.setAttribute("aria-label", `Notes: what you know (${n}), moments and how the talk reads`);
    more.setAttribute("aria-expanded", String(jl.classList.contains("open")));
  };
  const watch = new MutationObserver(() => {
    place();
    paint();
  });
  watch.observe(root, { attributes: true, attributeFilter: ["class"] });
  watch.observe(jl, { attributes: true, attributeFilter: ["class"] });
  place();
  paint();
  return {
    update: paint,
    destroy() {
      watch.disconnect();
      who.remove();
      more.remove();
      if (inSheet) {
        root.classList.remove("pl-phone");
        place();
      }
      sheet.remove();
    },
  };
}
