/**
 * Pieces both diorama renderers share (the 3D shop and its 2D fallback):
 * the journal as an open leather tome, the theme picker, the narration
 * awning, and the textures they use.
 */
import { esc, type SceneView, type ThemeCtx } from "../contract.js";
import { AWNING } from "./art.js";
import { leather, paper, texUrl } from "./textures.js";

/** A gilded frame for the "Meanwhile…" paintings (border-image source). */
export const MW_FRAME = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#fbe7a8'/><stop offset='.4' stop-color='#b8863a'/><stop offset='.7' stop-color='#6e4718'/><stop offset='1' stop-color='#d9ab52'/></linearGradient></defs><rect width='120' height='120' fill='url(#g)'/><rect x='10' y='10' width='100' height='100' fill='none' stroke='#4a2a0c' stroke-width='3'/><rect x='30' y='30' width='60' height='60' fill='#3a1d08'/><circle cx='20' cy='20' r='6' fill='#fbe7a8'/><circle cx='100' cy='20' r='6' fill='#fbe7a8'/><circle cx='20' cy='100' r='6' fill='#fbe7a8'/><circle cx='100' cy='100' r='6' fill='#fbe7a8'/></svg>`)}")`;

export const QUILL = `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M36 2 C22 6 12 16 8 30 L12 31 C16 20 24 10 36 2 Z" fill="#efe1c2"/><path d="M36 2 C26 10 18 20 12 31" stroke="#8a6a3a" stroke-width="1" fill="none"/><path d="M8 30 L5 38 L11 32 Z" fill="#2a1608"/></svg>`;
export const TRIANGLE = `<svg viewBox="0 0 20 16" aria-hidden="true"><path d="M2 2 L18 2 L10 14 Z" fill="#ffd84a" stroke="#7a5420" stroke-width="1.4"/></svg>`;

/** Textures as data URLs (generated once per page). */
export const tex = {
  paperTile: () => texUrl("paper", () => paper(77, 384, 384)),
  /** One full page of paper, big enough never to tile on a journal page. */
  page: () => texUrl("page", () => paper(91, 900, 1200)),
  leather: () => texUrl("leather", () => leather(31, 600, 420)),
};

/** The narration under its pitched awning: description, then the log (newest last); the busy quill. */
export function narrationHtml(box: ReturnType<ThemeCtx["box"]>, logOpen: boolean): string {
  return `${AWNING}
<div class="txt"><p class="desc">${esc(box.desc)}</p>${box.log.length ? `<ol class="log">${box.log.map((l) => `<li>${esc(l)}</li>`).join("")}</ol>` : ""}${box.busy ? `<div class="busyl">${QUILL}<span>${esc(box.busy)}</span><i>.</i><i>.</i><i>.</i></div>` : ""}</div>
${box.log.length > 2 ? `<button class="more" data-act="log" aria-expanded="${logOpen}" aria-label="${logOpen ? "Fold the log away" : "Read the whole log"}">${TRIANGLE}</button>` : ""}`;
}

export function pickerHtml(ctx: ThemeCtx, v: SceneView): string {
  return `<div class="pick" role="menu" aria-label="Theme">${ctx.themes.map((t) => `<button role="menuitemradio" aria-checked="${t.id === v.theme}" data-act="theme:${t.id}">${esc(t.label)}</button>`).join("")}</div>`;
}

/** Stepped page edges on one side of the tome: many leaves, alternately lit and shaded. */
function stack(side: "l" | "r" | "b"): string {
  const out: string[] = [];
  for (let i = 0; i < 8; i++) {
    const k = i * 3;
    const col = i % 2 ? "#8c7654" : "#d8c7a6";
    if (side === "l") out.push(`<path d="M${44 - k} ${60 + k * 0.4} Q${44 - k - 3} 330 ${44 - k} ${618 + k * 0.6}" fill="none" stroke="${col}" stroke-width="3"/>`);
    if (side === "r") out.push(`<path d="M${956 + k} ${60 + k * 0.4} Q${956 + k + 3} 330 ${956 + k} ${618 + k * 0.6}" fill="none" stroke="${col}" stroke-width="3"/>`);
    if (side === "b") out.push(`<path d="M${50 + k} ${620 + k * 0.9} Q280 ${604 + k} 500 ${628 + k} Q720 ${604 + k} ${950 - k} ${620 + k * 0.9}" fill="none" stroke="${col}" stroke-width="2.6"/>`);
  }
  return out.join("");
}

/**
 * The journal as an open leather tome: a stitched oxblood cover larger than
 * the book block, fanned page stacks at the edges, two pages whose top and
 * bottom edges curve down into the spine, one untiled sheet of paper per
 * page, a gutter shadow, and a ribbon to close it. The host's journal HTML
 * flows in two ruled columns over the pages.
 */
/** A faint compass rose inked in the corner of the left page. */
const ROSE = `<circle r="70"/><circle r="56" stroke-width="1"/><path d="M0 -92 L12 -12 L0 0 L-12 -12 Z M0 92 L12 12 L0 0 L-12 12 Z M-92 0 L-12 -12 L0 0 L-12 12 Z M92 0 L12 -12 L0 0 L12 12 Z" fill="#3a1c08"/><path d="M-50 -50 L-6 -6 M50 -50 L6 -6 M-50 50 L-6 6 M50 50 L6 6"/>`;

/** Wrap each heading and what follows it in a section, so a heading never ends a column alone. */
function sections(html: string): string {
  const parts = html.split(/(?=<h3[\s>])/);
  return parts.map((p) => (p.startsWith("<h3") ? `<section class="js">${p}</section>` : p)).join("");
}

export function journalHtml(ctx: ThemeCtx, v: SceneView): string {
  const th = v.thread;
  const found = th ? th.found.length : 0;
  const total = th ? Math.max(th.total, found) : 0;
  const thread = th ? `<p class="thread">${esc(th.goal)} <b>(${found}/${total})</b>${th.found.length ? `<br><span>${th.found.map(esc).join(" · ")}</span>` : ""}</p>` : "";
  const page = tex.page();
  const lea = tex.leather();
  const L = "M58 54 Q280 30 497 62 L497 614 Q280 592 58 610 Z";
  const R = "M503 62 Q720 30 942 54 L942 610 Q720 592 503 614 Z";
  return `<div class="book" role="dialog" aria-label="Journal"><div class="tome">
<svg class="tome-art" viewBox="0 0 1000 660" preserveAspectRatio="none" aria-hidden="true">
<defs><clipPath id="drj-c"><rect x="0" y="0" width="1000" height="660" rx="26"/></clipPath><clipPath id="drj-l"><path d="${L}"/></clipPath><clipPath id="drj-r"><path d="${R}"/></clipPath>
<linearGradient id="drj-g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a1c08" stop-opacity="0"/><stop offset=".42" stop-color="#3a1c08" stop-opacity=".18"/><stop offset=".5" stop-color="#1a0a02" stop-opacity=".6"/><stop offset=".58" stop-color="#3a1c08" stop-opacity=".18"/><stop offset="1" stop-color="#3a1c08" stop-opacity="0"/></linearGradient>
<radialGradient id="drj-v" cx=".5" cy=".5" r=".7"><stop offset=".6" stop-color="#5a3010" stop-opacity="0"/><stop offset="1" stop-color="#5a3010" stop-opacity=".35"/></radialGradient></defs>
<g clip-path="url(#drj-c)"><image href="${lea}" x="0" y="0" width="1000" height="660" preserveAspectRatio="none"/><rect width="1000" height="660" fill="#2b150e" opacity=".35"/></g>
<rect x="12" y="12" width="976" height="636" rx="18" fill="none" stroke="#d9b060" stroke-width="2.4" stroke-dasharray="7 5" opacity=".85"/>
<rect x="5" y="5" width="990" height="650" rx="24" fill="none" stroke="#120604" stroke-width="3"/>
${stack("l")}${stack("r")}${stack("b")}
<g clip-path="url(#drj-l)"><image href="${page}" x="58" y="30" width="440" height="590" preserveAspectRatio="none"/></g>
<g clip-path="url(#drj-r)"><image href="${page}" x="503" y="30" width="440" height="590" preserveAspectRatio="none" transform="translate(1446 0) scale(-1 1)"/></g>
<path d="${L}" fill="url(#drj-v)"/><path d="${R}" fill="url(#drj-v)"/>
<rect x="420" y="30" width="160" height="600" fill="url(#drj-g)"/>
<g opacity=".09" transform="translate(150 470)" fill="none" stroke="#3a1c08" stroke-width="2">${ROSE}</g><path d="${L}" fill="none" stroke="#6e5434" stroke-width="1.4"/><path d="${R}" fill="none" stroke="#6e5434" stroke-width="1.4"/>
</svg>
<button class="rib" data-act="journal" aria-label="Close the journal">Close</button>
<div class="leaf"><div class="cols"><header class="jh"><h2>Journal</h2>${thread}</header>${sections(ctx.journal.html(v))}</div></div>
</div></div>`;
}

/** CSS for the tome (both renderers). */
export const JOURNAL_CSS = `
.dr .book { position: absolute; inset: 0; z-index: 8; display: grid; place-items: center; background: radial-gradient(ellipse at 50% 55%, rgba(10,5,2,.45), rgba(5,2,0,.88)); }
.dr .tome { position: relative; width: min(94cqw, calc(86cqh * 1.52)); aspect-ratio: 1000 / 660; filter: drop-shadow(0 2cqh 4cqh rgba(0,0,0,.85)); }
.dr .tome-art { position: absolute; inset: 0; width: 100%; height: 100%; }
.dr .tome .leaf { position: absolute; left: 7.2%; right: 7.2%; top: 9.5%; bottom: 9.5%; overflow-y: auto; padding: 0 1.4% 0 0; color: #24150b; scrollbar-width: thin; scrollbar-color: rgba(110,75,45,.5) transparent;
  font: 500 max(17px, min(1.9cqh, 1.15cqw))/1.5 "Gambit Garamond", Georgia, serif; }
.dr .tome .jh { break-inside: avoid; margin-bottom: .4em; }
.dr .tome .js { break-inside: avoid; }
.dr .tome .leaf h2 { margin: 0 0 .15em; text-align: center; font: 800 max(26px, min(3.6cqh, 2.2cqw))/1 "Gambit Cinzel", serif; letter-spacing: .16em; color: #5a1a0c; }
.dr .tome .thread { margin: 0 auto .6em; max-width: 92%; text-align: center; font: italic 400 1.08em/1.3 "Gambit Fell", serif; color: #5a1a0c; }
.dr .tome .thread span { font-size: .9em; color: #6a3a18; }
.dr .tome .cols { column-count: 2; column-gap: 15%; column-fill: balance;
  background-image: repeating-linear-gradient(180deg, transparent 0 calc(1.5em - 1px), rgba(110,75,45,.18) calc(1.5em - 1px) 1.5em); background-attachment: local; }
.dr .tome .cols h3 { margin: .6em 0 .2em; font: 800 1.02em/1.2 "Gambit Cinzel", serif; letter-spacing: .1em; color: #6a1a0c; break-after: avoid; }
.dr .tome .cols h3::after { content: ""; display: block; height: .5em; margin-top: .1em; background: url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 10' preserveAspectRatio='none'><path d='M2 6 Q60 1 100 5 T198 4' fill='none' stroke='#6a1a0c' stroke-width='1.6' stroke-linecap='round'/><circle cx='100' cy='5' r='2.4' fill='#6a1a0c'/></svg>`)}") left center / 70% 100% no-repeat; }
.dr .tome .cols ul { list-style: none; margin: 0; padding-left: 1.5em; }
.dr .tome .cols li { position: relative; margin: 0 0 .1em; break-inside: avoid; }
.dr .tome .cols li::before { content: ""; position: absolute; left: -1.35em; top: .42em; width: .95em; height: .6em; background: url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 14'><path d='M2 8 C6 2 10 12 14 6 S20 4 22 7' fill='none' stroke='#5a1a0c' stroke-width='2.2' stroke-linecap='round'/><circle cx='21' cy='7' r='2.2' fill='#5a1a0c'/></svg>`)}") center / contain no-repeat; }
.dr .tome .cols li li::before { top: .3em; width: .8em; height: .8em; background-image: url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><path d='M3 4 Q10 2 17 3 Q18 10 16 17 Q9 18 3 16 Q2 10 3 4 Z' fill='none' stroke='#3a2410' stroke-width='1.6'/></svg>`)}"); }
.dr .tome .cols li li.done::before { background-image: url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><path d='M3 4 Q10 2 17 3 Q18 10 16 17 Q9 18 3 16 Q2 10 3 4 Z' fill='none' stroke='#3a2410' stroke-width='1.6'/><path d='M5 10 L9 15 L18 1' fill='none' stroke='#8e1c14' stroke-width='2.6' stroke-linecap='round'/></svg>`)}"); }
.dr .tome .cols .muted { color: rgba(36,21,11,.62); font-style: italic; }
.dr .tome .cols .done { color: rgba(36,21,11,.6); text-decoration: line-through; text-decoration-color: rgba(142,28,20,.55); }
.dr .tome .cols .bond { color: #6a3a00; }
.dr .tome .cols .aff { position: relative; display: inline-block; width: 5.2em; height: .9em; margin: 0 .5em; vertical-align: -.1em;
  background: url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 104 18' preserveAspectRatio='none'><path d='M2 10 Q30 8 52 9 T102 9' fill='none' stroke='#6e5434' stroke-width='1.2'/><path d='M52 2 L52 16' stroke='#3a2410' stroke-width='1.6'/><path d='M27 6 L27 13 M77 6 L77 13' stroke='#6e5434' stroke-width='1'/></svg>`)}") center / 100% 100% no-repeat; }
.dr .tome .cols .aff i { position: absolute; top: 18%; bottom: 18%; background: url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 10' preserveAspectRatio='none'><path d='M1 6 Q10 1 20 5 T39 4 L39 7 Q28 10 20 8 T1 7 Z' fill='#2f6a3a'/></svg>`)}") center / 100% 100%; }
.dr .tome .cols .aff i.neg { background-image: url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 10' preserveAspectRatio='none'><path d='M1 6 Q10 1 20 5 T39 4 L39 7 Q28 10 20 8 T1 7 Z' fill='#8e1c14'/></svg>`)}"); }
.dr .tome .rib { position: absolute; right: 12%; top: -1.2%; z-index: 2; padding: 2.4cqh .7em 3.6cqh; writing-mode: vertical-rl; font: 800 max(14px, 1.7cqh)/1 "Gambit Cinzel", serif; letter-spacing: .1em; color: #fbe7a8;
  background: linear-gradient(90deg, #5a0e08, #b02e22 40%, #6a120c); clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 90%, 0 100%); filter: drop-shadow(0 3px 3px rgba(0,0,0,.6)); }
.dr .tome .rib:hover, .dr .tome .rib:focus-visible { outline: none; filter: drop-shadow(0 0 2px #ffe24a) drop-shadow(0 0 8px rgba(255,210,40,.8)); }
@container (max-aspect-ratio: 4/5) {
  .dr .tome { width: 98cqw; aspect-ratio: auto; height: 90cqh; }
  .dr .tome .leaf { left: 9%; right: 9%; top: 7%; bottom: 7%; font-size: 16px; }
  .dr .tome .cols { column-count: 1; }
}
`;
