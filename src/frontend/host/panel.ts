/**
 * The Gambit drawer tab: start a fight, resume one, see what the art
 * pipeline is doing. Small on purpose; play happens on the Stage.
 */
import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import { ENCOUNTERS } from "../../engine/content/index.js";
import { PARLEYS } from "../../engine/content/parleys.js";
import type { CardStatus, ParleyNarrator, ParleyViewMode } from "../../shared/protocol.js";
import { CARD_CSS, renderCard, type CardActions } from "./card-panel.js";

const ICON = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2.5l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 7.8l5-.7z"/></svg>`;

const CSS = `
.gb { font: 13px/1.45 system-ui, sans-serif; padding: 12px; display: grid; gap: 14px; }
.gb h3 { margin: 0 0 6px; font: 600 11px/1 system-ui; letter-spacing: .12em; text-transform: uppercase; opacity: .6; }
.gb .row { display: grid; gap: 6px; }
.gb button { text-align: left; padding: 9px 11px; border-radius: 8px; border: 1px solid var(--lumiverse-border, rgba(127,127,127,.25));
  background: var(--lumiverse-fill-subtle, rgba(127,127,127,.06)); color: inherit; cursor: pointer; font: inherit; }
.gb button:hover { border-color: var(--lumiverse-primary, #c8a26a); }
.gb button .sub { display: block; font-size: 11px; opacity: .6; }
.gb .primary { background: var(--lumiverse-primary, #c8a26a); color: var(--lumiverse-primary-contrast, #111); border-color: transparent; text-align: center; font-weight: 600; }
.gb .status { font-size: 12px; opacity: .7; min-height: 1em; }
.gb .looks { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.gb .look { padding: 0; overflow: hidden; display: grid; text-align: left; }
.gb .look .pics { display: grid; grid-template-columns: 3fr 2fr; aspect-ratio: 16 / 9; background: rgba(127,127,127,.12); }
.gb .look .pics div { background-size: cover; background-position: center; }
.gb .look .name { padding: 6px 8px; font-size: 12px; }
.gb .look.locked { outline: 2px solid var(--lumiverse-primary, #c8a26a); }
.gb .look .src { font-size: 10px; opacity: .55; text-transform: uppercase; letter-spacing: .06em; margin-left: 4px; }
.gb .look .acts { display: flex; gap: 4px; padding: 0 6px 6px; flex-wrap: wrap; }
.gb .look .acts button { padding: 2px 7px; font-size: 11px; border-radius: 999px; }
.gb .look .pics { cursor: pointer; }
.gb .lookbar { display: flex; gap: 6px; flex-wrap: wrap; }
.gb .lookbar button { padding: 6px 10px; font-size: 12px; }
.gb .describe { display: flex; gap: 6px; align-items: stretch; margin-top: 6px; }
.gb .describe textarea { flex: 1; min-width: 0; resize: vertical; font: inherit; font-size: 12px; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--lumiverse-border, rgba(255,255,255,.2)); background: var(--lumiverse-fill-subtle, rgba(255,255,255,.05)); color: inherit; }
.gb .describe button { padding: 6px 10px; font-size: 12px; white-space: nowrap; }
.gb .hint { font-size: 11px; opacity: .6; }
.gb .seg { display: flex; border: 1px solid var(--lumiverse-border, rgba(127,127,127,.25)); border-radius: 999px; overflow: hidden; width: max-content; }
.gb .seg button { border: 0; border-radius: 0; padding: 4px 12px; font-size: 12px; background: none; text-align: center; }
.gb .seg button.on { background: var(--lumiverse-primary, #c8a26a); color: var(--lumiverse-primary-contrast, #111); }
${CARD_CSS}`;

export interface Panel {
  setLook(lookId: string | null): void;
  showProbes(looks: { lookId: string; label: string; source?: string; description?: string }[]): void;
  setProbeImage(key: string, url: string): void;
  setStatus(text: string): void;
  setResumable(on: boolean): void;
  /** The open Parley's name (null when none), the view mode, and how many facts the journal holds. */
  setParley(open: string | null, mode: ParleyViewMode, journalSize: number): void;
  setNarrator(mode: ParleyNarrator): void;
  /** The active chat's card status (null while asking), and whether a chat is open at all. */
  setCard(status: CardStatus | null, hasChat: boolean): void;
  destroy(): void;
}

export function createPanel(
  ctx: SpindleFrontendContext,
  actions: {
    start(encounterId: string): void;
    open(): void;
    probe(lookId?: string): void;
    pick(lookId: string): void;
    looks: { list(): void; importJson(json: string): void; exportLook(lookId: string): void; remove(lookId: string): void; match(): void; describe(text: string): void };
    parley(scenarioId: string): void;
    resumeParley(): void;
    setParleyMode(mode: ParleyViewMode): void;
    setNarrator(mode: ParleyNarrator): void;
    card: CardActions;
    demo(): void;
  },
): Panel {
  const tab = ctx.ui.registerDrawerTab({
    id: "gambit",
    title: "Gambit",
    shortName: "Gambit",
    description: "Fight, talk, and fuse classes in an RPG under your roleplay",
    keywords: ["rpg", "battle", "combat", "game"],
    iconSvg: ICON,
  });
  const removeStyle = ctx.dom.addStyle(CSS);
  const root = document.createElement("div");
  root.className = "gb";
  root.innerHTML = `
    <button class="primary" data-parley-resume hidden>Resume the Parley</button>
    <div class="row"><h3>This chat</h3><div class="card-sec" data-card></div><div class="status" data-status></div></div>
    <details data-looks-sec><summary>Looks: how the art is drawn</summary><div class="row" style="padding-top:8px">
      <div class="hint" data-look-hint>No look chosen yet: art uses the default.</div>
      <div class="lookbar"><button data-probe>Draw the presets</button><button data-match>Match this card</button><button data-import>Import a look file</button><input type="file" accept=".json,application/json" data-import-file hidden></div>
      <div class="describe"><textarea data-describe rows="2" maxlength="800" placeholder="Describe a look: &quot;ukiyo-e woodblock with gold leaf&quot;, &quot;90s OVA cel, film grain&quot;…"></textarea><button data-describe-go>Make this look</button></div>
      <div class="hint">Art is kept per look: switching back shows what was drawn before, and the new look is drawn as it is needed.</div>
      <div class="looks" data-looks></div></div></details>
    <details><summary>Saltgate demo, encounters, and art</summary><div class="gb" style="padding:8px 0 0">
    <div class="row"><button data-demo>Add the Saltgate demo card to my library<span class="sub">A small harbor town with a lorebook, played through the Card Reader like any card</span></button>
      <button class="primary" data-open>Open the Stage</button></div>
    <div class="row"><h3>Parley</h3>
      ${Object.values(PARLEYS)
        .map((p) => `<button data-parley="${p.id}">${p.name}<span class="sub">${p.blurb}</span></button>`)
        .join("")}
      <div class="seg" data-parley-mode><button data-m="immersive">Immersive</button><button data-m="transparent">Transparent</button></div>
      <div class="hint">Who voices the NPC</div>
      <div class="seg" data-parley-narrator><button data-n="gambit">Gambit (short replies)</button><button data-n="chat">Chat preset</button></div>
      <div class="hint" data-parley-hint>Words move the dice. Open a chat first and the narrator plays them.</div></div>
    <div class="row"><h3>Encounters</h3>${Object.values(ENCOUNTERS)
      .map((e) => `<button data-enc="${e.id}">${e.name}${e.boss ? " ✦" : ""}<span class="sub">${e.enemies.length} foe${e.enemies.length === 1 ? "" : "s"}${e.boss ? " · boss" : ""}</span></button>`)
      .join("")}</div></div></details>`;
  tab.root.appendChild(root);
  const cardEl = root.querySelector<HTMLElement>("[data-card]")!;
  root.querySelector("[data-demo]")?.addEventListener("click", () => actions.demo());
  renderCard(cardEl, null, false, actions.card);
  const status = root.querySelector<HTMLElement>("[data-status]")!;
  const openBtn = root.querySelector<HTMLButtonElement>("[data-open]")!;
  openBtn.addEventListener("click", () => actions.open());
  root.querySelectorAll<HTMLButtonElement>("[data-enc]").forEach((b) => b.addEventListener("click", () => actions.start(b.dataset.enc!)));
  root.querySelectorAll<HTMLButtonElement>("[data-parley]").forEach((b) => b.addEventListener("click", () => actions.parley(b.dataset.parley!)));
  const parleyResume = root.querySelector<HTMLButtonElement>("[data-parley-resume]")!;
  parleyResume.addEventListener("click", () => actions.resumeParley());
  const parleyHint = root.querySelector<HTMLElement>("[data-parley-hint]")!;
  const modeBtns = [...root.querySelectorAll<HTMLButtonElement>("[data-parley-mode] button")];
  modeBtns.forEach((b) => b.addEventListener("click", () => actions.setParleyMode(b.dataset.m as ParleyViewMode)));
  const paintMode = (m: ParleyViewMode) => modeBtns.forEach((b) => b.classList.toggle("on", b.dataset.m === m));
  paintMode("immersive");
  const narratorBtns = [...root.querySelectorAll<HTMLButtonElement>("[data-parley-narrator] button")];
  narratorBtns.forEach((b) => b.addEventListener("click", () => actions.setNarrator(b.dataset.n as ParleyNarrator)));
  const paintNarrator = (m: ParleyNarrator) => narratorBtns.forEach((b) => b.classList.toggle("on", b.dataset.n === m));
  paintNarrator("gambit");

  const looksEl = root.querySelector<HTMLElement>("[data-looks]")!;
  const lookHint = root.querySelector<HTMLElement>("[data-look-hint]")!;
  const probeBtn = root.querySelector<HTMLButtonElement>("[data-probe]")!;
  probeBtn.addEventListener("click", () => {
    probeBtn.disabled = true;
    probeBtn.textContent = "Drawing… (a few minutes)";
    actions.probe();
  });
  root.querySelector("[data-looks-sec]")!.addEventListener("toggle", (e) => {
    if ((e.target as HTMLDetailsElement).open) actions.looks.list();
  });
  root.querySelector("[data-match]")!.addEventListener("click", () => actions.looks.match());
  const describeBox = root.querySelector<HTMLTextAreaElement>("[data-describe]")!;
  const describeGo = root.querySelector<HTMLButtonElement>("[data-describe-go]")!;
  describeGo.addEventListener("click", () => {
    const text = describeBox.value.trim();
    if (!text) return describeBox.focus();
    describeGo.disabled = true;
    describeGo.textContent = "Writing…";
    actions.looks.describe(text);
    // The look list comes back when the look is saved; the button frees up then (or after a while).
    setTimeout(() => {
      describeGo.disabled = false;
      describeGo.textContent = "Make this look";
    }, 20000);
  });
  const importFile = root.querySelector<HTMLInputElement>("[data-import-file]")!;
  root.querySelector("[data-import]")!.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", () => {
    const f = importFile.files?.[0];
    if (!f) return;
    void f.text().then((t) => actions.looks.importJson(t));
    importFile.value = "";
  });
  let locked: string | null = null;
  const probeUrls = new Map<string, string>();
  const paint = () => {
    looksEl.querySelectorAll<HTMLButtonElement>("[data-look]").forEach((b) => {
      const id = b.dataset.look!;
      b.classList.toggle("locked", id === locked);
      for (const part of ["gate", "bust"]) {
        const url = probeUrls.get(`style_probe:${id}:${part}`);
        const cell = b.querySelector<HTMLElement>(`[data-part="${part}"]`);
        if (cell && url) cell.style.backgroundImage = `url("${url}")`;
      }
    });
  };
  const SOURCE: Record<string, string> = { preset: "", user: "yours", inlay: "Inlay", card: "card" };
  const escHtml = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

  return {
    setLook: (id) => {
      locked = id;
      lookHint.textContent = id ? `In use: ${looksEl.querySelector(`[data-look="${globalThis.CSS.escape(id)}"] .name`)?.firstChild?.textContent ?? id}. New art follows this look.` : "No look chosen yet: art uses the default.";
      paint();
    },
    showProbes: (looks) => {
      looksEl.innerHTML = looks
        .map((l) => {
          const id = escHtml(l.lookId);
          const own = l.source === "user" || l.source === "card";
          return `<div class="look" data-look="${id}" title="${escHtml(l.description ?? "")}"><div class="pics" data-use="${id}"><div data-part="gate"></div><div data-part="bust"></div></div><span class="name">${escHtml(l.label)}${SOURCE[l.source ?? "preset"] ? `<span class="src">${SOURCE[l.source ?? "preset"]}</span>` : ""}</span><div class="acts"><button data-use="${id}">Use</button><button data-preview="${id}">Preview</button><button data-export="${id}">Export</button>${own ? `<button data-del="${id}">Delete</button>` : ""}</div></div>`;
        })
        .join("");
      looksEl.querySelectorAll<HTMLElement>("[data-use]").forEach((b) => b.addEventListener("click", () => actions.pick(b.dataset.use!)));
      looksEl.querySelectorAll<HTMLElement>("[data-preview]").forEach((b) => b.addEventListener("click", () => actions.probe(b.dataset.preview!)));
      looksEl.querySelectorAll<HTMLElement>("[data-export]").forEach((b) => b.addEventListener("click", () => actions.looks.exportLook(b.dataset.export!)));
      looksEl.querySelectorAll<HTMLElement>("[data-del]").forEach((b) => b.addEventListener("click", () => actions.looks.remove(b.dataset.del!)));
      probeBtn.textContent = "Draw the presets";
      probeBtn.disabled = false;
      paint();
    },
    setProbeImage: (key, url) => {
      probeUrls.set(key, url);
      paint();
    },
    setStatus: (t) => (status.textContent = t),
    setResumable: (on) => (openBtn.textContent = on ? "Resume the fight" : "Open the Stage"),
    setNarrator: (m) => paintNarrator(m),
    setCard: (st, hasChat) => renderCard(cardEl, st, hasChat, actions.card),
    setParley: (open, mode, journalSize) => {
      parleyResume.hidden = !open;
      if (open) parleyResume.textContent = `Resume: ${open}`;
      paintMode(mode);
      parleyHint.textContent = `Words move the dice. Open a chat first and the narrator plays them.${journalSize ? ` Journal: ${journalSize} fact${journalSize === 1 ? "" : "s"} learned.` : ""}`;
    },
    destroy: () => {
      removeStyle?.();
      tab.destroy();
    },
  };
}
