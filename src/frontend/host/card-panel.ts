/**
 * The "This chat" part of the drawer (docs/DESIGN.md 4.0): switch Gambit on
 * for the chat, enter the scene, talk to anyone in the cast; your sheet, the
 * facts and the options fold away below.
 */
import type { ModuleId, SourceKind, Tier } from "../../engine/card/types.js";
import { MODULES } from "../../engine/card/types.js";
import type { SocialStat } from "../../engine/parley/types.js";
import type { CardStatus } from "../../shared/protocol.js";

export const CARD_CSS = `
.gb .card-sec { display: grid; gap: 10px; }
.gb .switch { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.gb .switch .lbl { font-weight: 600; }
.gb .tog { width: 42px; height: 24px; flex: none; border-radius: 999px; padding: 0; position: relative; text-align: center; }
.gb .tog::after { content: ""; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: currentColor; opacity: .55; transition: left .15s; }
.gb .tog.on { background: var(--lumiverse-primary, #c8a26a); border-color: transparent; }
.gb .tog.on::after { left: 21px; opacity: 1; background: var(--lumiverse-primary-contrast, #111); }
.gb .premise { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; opacity: .9; }
.gb .cast { display: grid; gap: 6px; }
.gb .who { display: grid; grid-template-columns: 40px 1fr auto; gap: 10px; align-items: center; padding: 7px 9px; border-radius: 9px; background: var(--lumiverse-fill-subtle, rgba(127,127,127,.06)); }
.gb .who .av { width: 40px; height: 40px; border-radius: 50%; background: rgba(127,127,127,.25) center/cover; display: grid; place-items: center; font-weight: 600; }
.gb .who .nm { font-weight: 600; }
.gb .who .rl { font-size: 13px; opacity: .72; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
.gb .who button { padding: 6px 12px; text-align: center; }
.gb .stats { display: grid; gap: 6px; }
.gb .stat { display: grid; grid-template-columns: 1fr auto auto auto; gap: 8px; align-items: center; }
.gb .stat button { padding: 2px 10px; text-align: center; }
.gb .stat .pips { letter-spacing: 2px; min-width: 60px; text-align: center; }
.gb .mods { display: flex; flex-wrap: wrap; gap: 6px; }
.gb .mods button { padding: 5px 12px; border-radius: 999px; text-align: center; }
.gb .mods button.on { background: var(--lumiverse-primary, #c8a26a); color: var(--lumiverse-primary-contrast, #111); border-color: transparent; }
.gb .facts { font-size: 13px; display: grid; gap: 4px; max-height: 220px; overflow: auto; }
.gb .facts .src { font-size: 11px; opacity: .6; text-transform: uppercase; letter-spacing: .06em; margin-right: 5px; }
.gb .note { font-size: 13px; opacity: .85; border-left: 2px solid var(--lumiverse-primary, #c8a26a); padding-left: 8px; }
.gb .play { font-weight: 600; text-align: center; padding: 11px; background: var(--lumiverse-primary, #c8a26a); color: var(--lumiverse-primary-contrast, #111); border-color: transparent; }
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
    root.innerHTML = `<div class="empty">Open a chat to play it with Gambit.</div>`;
    return;
  }
  if (!s) {
    root.innerHTML = `<div class="hint">Checking this chat…</div>`;
    return;
  }
  const sheet = s.sheet;
  const parts: string[] = [];
  parts.push(`<div class="switch"><span class="lbl">Play with Gambit</span><button class="tog${s.enabled ? " on" : ""}" data-enable aria-pressed="${s.enabled}" aria-label="Play this chat with Gambit"></button></div>`);
  if (s.error) parts.push(`<div class="note">${esc(s.error)}</div>`);
  if (s.enabled && s.reading && !sheet) parts.push(`<div class="hint">Reading the card…</div>`);
  if (s.enabled && sheet) {
    const sk = sheet.skin;
    parts.push(`<div class="premise">${esc(sheet.premise || sheet.cardName)}</div>`);
    if (s.reading) parts.push(`<div class="hint">Re-reading the card…</div>`);
    if (s.stale) parts.push(`<div class="note">The card changed. <a href="#" data-reread>Read it again</a></div>`);
    for (const n of sheet.notes) parts.push(`<div class="note">${esc(n)}</div>`);
    parts.push(`<button class="play" data-play>Enter the scene</button>`);
    parts.push(
      `<h3>Cast</h3><div class="cast">${sheet.cast
        .map((c) => {
          const faceId = c.faces?.base ?? c.avatarImageId;
          const av = faceId ? `/api/v1/images/${faceId}` : c.avatarUrl;
          return `<div class="who"><div class="av" ${av ? `style="background-image:url('${esc(av)}')"` : ""}>${av ? "" : esc(c.name.slice(0, 1))}</div><div><div class="nm">${esc(c.name)}</div><div class="rl" title="${esc(c.role)}">${esc(c.role)}</div></div><button data-talk="${esc(c.id)}">Talk</button></div>`;
        })
        .join("")}</div>`,
    );
    const stats: SocialStat[] = ["presence", "menace", "guile"];
    parts.push(
      `<details><summary>You: ${esc(sheet.player.name)}</summary><div class="stats">${stats
        .map((st) => `<div class="stat"><span>${esc(sk.stats[st])}</span><button data-dec="${st}" aria-label="Lower ${esc(sk.stats[st])}">−</button><span class="pips">${pips(sheet.player.social[st])}</span><button data-inc="${st}" aria-label="Raise ${esc(sk.stats[st])}">+</button></div>`)
        .join("")}</div></details>`,
    );
    const known = sheet.facts.filter((f) => f.known).length;
    parts.push(
      `<details><summary>Facts · ${known} of ${sheet.facts.length} known</summary><div class="facts">${
        sheet.facts
          .map((f) => {
            const about = sheet.cast.find((c) => f.about.includes(c.id))?.name ?? "someone";
            // Secrets stay hidden until play surfaces them; the review only says they exist.
            return `<div><span class="src">${SOURCE_LABEL[f.evidence.source]}</span>${f.known ? esc(f.text) : `🔒 Something about ${esc(about)}`}</div>`;
          })
          .join("") || `<div>None yet.</div>`
      }</div></details>`,
    );
    parts.push(
      `<details><summary>Options</summary><div class="row">
        <div class="mods">${MODULES.map((m) => `<button data-mod="${m}" class="${sheet.modules[m] ? "on" : ""}" ${m === "parley" ? "disabled" : ""}>${MODULE_LABEL[m]}</button>`).join("")}</div>
        <div class="switch"><span>Contests under replies</span><button class="tog${s.chips ? " on" : ""}" data-chips aria-label="Contests under replies"></button></div>
        <button data-reread>Read the card again</button></div></details>`,
    );
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
