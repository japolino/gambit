/**
 * The "This chat" part of the drawer (docs/DESIGN.md 4.0): switch Gambit on
 * for the chat, review the Card Sheet (premise, cast, facts, modules, your
 * sheet), and start a Parley with anyone in the cast.
 */
import type { ModuleId, SourceKind, Tier } from "../../engine/card/types.js";
import { MODULES } from "../../engine/card/types.js";
import type { SocialStat } from "../../engine/parley/types.js";
import type { CardStatus } from "../../shared/protocol.js";

/** Where a cast member's art came from, as the drawer says it. */
const FACE_SOURCE: Record<string, string> = {
  expressions: "Card sprites",
  groups: "Card sprites",
  risu: "Card assets",
  library: "Art from their own card",
  gallery: "Card gallery",
  avatar: "Card avatar",
  inlay: "Inlay reference",
};

export const CARD_CSS = `
.gb .card-sec { display: grid; gap: 8px; }
.gb .switch { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.gb .switch .lbl { font-weight: 600; }
.gb .tog { width: 40px; height: 22px; border-radius: 999px; padding: 0; position: relative; text-align: center; }
.gb .tog::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: currentColor; opacity: .55; transition: left .15s; }
.gb .tog.on { background: var(--lumiverse-primary, #c8a26a); border-color: transparent; }
.gb .tog.on::after { left: 20px; opacity: 1; background: var(--lumiverse-primary-contrast, #111); }
.gb .premise { font-size: 12px; opacity: .85; }
.gb .cast { display: grid; gap: 6px; }
.gb .who { display: grid; grid-template-columns: 36px 1fr auto; gap: 8px; align-items: center; padding: 6px 8px; border-radius: 8px; background: var(--lumiverse-fill-subtle, rgba(127,127,127,.06)); }
.gb .who .av { width: 36px; height: 36px; border-radius: 50%; background: rgba(127,127,127,.25) center/cover; display: grid; place-items: center; font-weight: 600; }
.gb .who .nm { font-weight: 600; font-size: 13px; }
.gb .who .rl { font-size: 11px; opacity: .65; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.gb .who button { padding: 5px 10px; font-size: 12px; text-align: center; }
.gb .stats { display: grid; gap: 4px; }
.gb .stat { display: grid; grid-template-columns: 1fr auto auto auto; gap: 6px; align-items: center; font-size: 12px; }
.gb .stat button { padding: 1px 8px; text-align: center; }
.gb .stat .pips { letter-spacing: 2px; font-size: 11px; min-width: 52px; text-align: center; }
.gb .mods { display: flex; flex-wrap: wrap; gap: 6px; }
.gb .mods button { padding: 3px 9px; font-size: 11px; border-radius: 999px; text-align: center; }
.gb .mods button.on { background: var(--lumiverse-primary, #c8a26a); color: var(--lumiverse-primary-contrast, #111); border-color: transparent; }
.gb .facts { font-size: 11px; display: grid; gap: 3px; max-height: 180px; overflow: auto; }
.gb .facts .f { opacity: .8; }
.gb .facts .src { font-size: 10px; opacity: .55; text-transform: uppercase; letter-spacing: .06em; margin-right: 4px; }
.gb .note { font-size: 11px; opacity: .7; border-left: 2px solid var(--lumiverse-primary, #c8a26a); padding-left: 6px; }
.gb .play { font-weight: 600; text-align: center; padding: 9px; background: var(--lumiverse-primary, #c8a26a); color: var(--lumiverse-primary-contrast, #111); border-color: transparent; }
.gb details > summary { cursor: pointer; font-size: 12px; opacity: .75; }
`;

export interface CardActions {
  enable(on: boolean): void;
  reread(): void;
  talk(castId: string): void;
  social(stat: SocialStat, value: Tier): void;
  module(id: ModuleId, on: boolean): void;
  chips(on: boolean): void;
  play(): void;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const MODULE_LABEL: Record<ModuleId, string> = { parley: "Parley", encounters: "Encounters", places: "Places", delves: "Delves", kits: "Kits", economy: "Economy" };
const SOURCE_LABEL: Record<SourceKind, string> = { card: "card", lore: "lore", persona: "persona", chat: "chat", gambit: "added" };
const pips = (t: number) => "●".repeat(t) + "○".repeat(4 - t);

export function renderCard(root: HTMLElement, s: CardStatus | null, hasChat: boolean, a: CardActions): void {
  if (!hasChat) {
    root.innerHTML = `<div class="hint">Open a chat to play its card with Gambit.</div>`;
    return;
  }
  if (!s) {
    root.innerHTML = `<div class="hint">Checking this chat…</div>`;
    return;
  }
  const sheet = s.sheet;
  const parts: string[] = [];
  parts.push(`<div class="switch"><span class="lbl">Play this chat with Gambit</span><button class="tog${s.enabled ? " on" : ""}" data-enable aria-pressed="${s.enabled}"></button></div>`);
  if (s.error) parts.push(`<div class="note">${esc(s.error)}</div>`);
  if (!s.enabled) {
    parts.push(`<div class="hint">Gambit reads this chat's card, lorebook, and your persona, and turns its people into Parleys you can win or lose. It never changes the card.</div>`);
  } else if (s.reading && !sheet) {
    parts.push(`<div class="hint">Reading the card… (this can take a minute)</div>`);
  } else if (sheet) {
    const sk = sheet.skin;
    parts.push(`<div class="premise">${esc(sheet.premise || sheet.cardName)}${sheet.tone ? ` <span class="hint">· ${esc(sheet.tone)}</span>` : ""}</div>`);
    if (s.reading) parts.push(`<div class="hint">Re-reading the card…</div>`);
    parts.push(`<button class="play" data-play>Enter the scene</button>`);
    if (s.stale) parts.push(`<div class="note">The card changed since Gambit read it. <a href="#" data-reread>Read it again</a></div>`);
    for (const n of sheet.notes) parts.push(`<div class="note">${esc(n)}</div>`);
    parts.push(
      `<h3>Cast</h3><div class="cast">${sheet.cast
        .map((c) => {
          const faceId = c.faces?.base ?? c.avatarImageId;
          const av = faceId ? `/api/v1/images/${faceId}` : c.avatarUrl;
          const moods = Object.keys(c.faces?.expressions ?? {}).length;
          const art = c.faces && c.faces.source !== "avatar" ? `<div class="rl">${esc(FACE_SOURCE[c.faces.source])}${moods ? ` · ${moods} mood${moods === 1 ? "" : "s"}` : ""}</div>` : "";
          return `<div class="who"><div class="av" ${av ? `style="background-image:url('${esc(av)}')"` : ""}>${av ? "" : esc(c.name.slice(0, 1))}</div><div><div class="nm">${esc(c.name)}</div><div class="rl">${esc(c.role)}</div>${art}</div><button data-talk="${esc(c.id)}">Talk</button></div>`;
        })
        .join("")}</div>`,
    );
    const stats: SocialStat[] = ["presence", "menace", "guile"];
    parts.push(
      `<h3>You: ${esc(sheet.player.name)}</h3>${sheet.player.concept ? `<div class="hint">${esc(sheet.player.concept)}</div>` : ""}<div class="stats">${stats
        .map((st) => `<div class="stat"><span>${esc(sk.stats[st])}</span><button data-dec="${st}">−</button><span class="pips">${pips(sheet.player.social[st])}</span><button data-inc="${st}">+</button></div>`)
        .join("")}</div>`,
    );
    parts.push(`<h3>Modules</h3><div class="mods">${MODULES.map((m) => `<button data-mod="${m}" class="${sheet.modules[m] ? "on" : ""}" ${m === "parley" ? "disabled" : ""}>${MODULE_LABEL[m]}</button>`).join("")}</div><div class="hint">Turn a module off to keep it out of play on this card.</div>`);
    const known = sheet.facts.filter((f) => f.known).length;
    parts.push(
      `<details><summary>Facts: ${sheet.facts.length} (${known} you already know)</summary><div class="facts">${sheet.facts
        .map((f) => {
          const about = sheet.cast.find((c) => f.about.includes(c.id))?.name ?? "someone";
          // Secrets stay hidden until play surfaces them; the review only says they exist.
          return `<div class="f"><span class="src">${SOURCE_LABEL[f.evidence.source]}</span>${f.known ? esc(f.text) : `🔒 Something about ${esc(about)}`}</div>`;
        })
        .join("") || `<div class="f">None yet.</div>`}</div></details>`,
    );
    parts.push(`<div class="switch"><span>Offer contests under replies</span><button class="tog${s.chips ? " on" : ""}" data-chips></button></div>`);
    parts.push(`<button data-reread>Read the card again</button>`);
  }
  root.innerHTML = parts.join("");
  root.querySelector("[data-enable]")?.addEventListener("click", () => a.enable(!s.enabled));
  root.querySelector("[data-play]")?.addEventListener("click", () => a.play());
  root.querySelector("[data-chips]")?.addEventListener("click", () => a.chips(!s.chips));
  root.querySelectorAll("[data-reread]").forEach((b) =>
    b.addEventListener("click", (e) => {
      e.preventDefault();
      a.reread();
    }),
  );
  root.querySelectorAll<HTMLButtonElement>("[data-talk]").forEach((b) => b.addEventListener("click", () => a.talk(b.dataset.talk!)));
  root.querySelectorAll<HTMLButtonElement>("[data-mod]").forEach((b) => b.addEventListener("click", () => a.module(b.dataset.mod as ModuleId, !b.classList.contains("on"))));
  if (sheet) {
    root.querySelectorAll<HTMLButtonElement>("[data-inc]").forEach((b) => b.addEventListener("click", () => a.social(b.dataset.inc as SocialStat, Math.min(4, sheet.player.social[b.dataset.inc as SocialStat] + 1) as Tier)));
    root.querySelectorAll<HTMLButtonElement>("[data-dec]").forEach((b) => b.addEventListener("click", () => a.social(b.dataset.dec as SocialStat, Math.max(0, sheet.player.social[b.dataset.dec as SocialStat] - 1) as Tier)));
  }
}
