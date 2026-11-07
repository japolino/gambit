/**
 * The Gambit drawer tab: start a fight, resume one, see what the art
 * pipeline is doing. Small on purpose; play happens on the Stage.
 */
import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import { ENCOUNTERS } from "../../engine/content/index.js";

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
.gb .look[disabled] { opacity: .5; cursor: default; }
.gb .hint { font-size: 11px; opacity: .6; }
`;

export interface Panel {
  setLook(lookId: string | null): void;
  showProbes(looks: { lookId: string; label: string }[]): void;
  setProbeImage(key: string, url: string): void;
  setStatus(text: string): void;
  setResumable(on: boolean): void;
  destroy(): void;
}

export function createPanel(
  ctx: SpindleFrontendContext,
  actions: { start(encounterId: string): void; open(): void; probe(): void; pick(lookId: string): void },
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
    <div class="row"><button class="primary" data-open>Open the Stage</button><div class="status" data-status></div></div>
    <div class="row"><h3>Look</h3><div class="hint" data-look-hint>No look chosen yet: art uses the default.</div>
      <button data-probe>Draw the four looks</button><div class="looks" data-looks></div></div>
    <div class="row"><h3>Encounters</h3>${Object.values(ENCOUNTERS)
      .map((e) => `<button data-enc="${e.id}">${e.name}${e.boss ? " ✦" : ""}<span class="sub">${e.enemies.length} foe${e.enemies.length === 1 ? "" : "s"}${e.boss ? " · boss" : ""}</span></button>`)
      .join("")}</div>`;
  tab.root.appendChild(root);
  const status = root.querySelector<HTMLElement>("[data-status]")!;
  const openBtn = root.querySelector<HTMLButtonElement>("[data-open]")!;
  openBtn.addEventListener("click", () => actions.open());
  root.querySelectorAll<HTMLButtonElement>("[data-enc]").forEach((b) => b.addEventListener("click", () => actions.start(b.dataset.enc!)));

  const looksEl = root.querySelector<HTMLElement>("[data-looks]")!;
  const lookHint = root.querySelector<HTMLElement>("[data-look-hint]")!;
  const probeBtn = root.querySelector<HTMLButtonElement>("[data-probe]")!;
  probeBtn.addEventListener("click", () => {
    probeBtn.disabled = true;
    probeBtn.textContent = "Drawing… (this can take a few minutes)";
    actions.probe();
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
      b.disabled = !probeUrls.has(`style_probe:${id}:gate`);
    });
  };

  return {
    setLook: (id) => {
      locked = id;
      lookHint.textContent = id ? `Locked: ${looksEl.querySelector(`[data-look="${id}"] .name`)?.textContent ?? id}. New art follows this look.` : "No look chosen yet: art uses the default.";
      paint();
    },
    showProbes: (looks) => {
      looksEl.innerHTML = looks
        .map((l) => `<button class="look" data-look="${l.lookId}"><div class="pics"><div data-part="gate"></div><div data-part="bust"></div></div><span class="name">${l.label}</span></button>`)
        .join("");
      looksEl.querySelectorAll<HTMLButtonElement>("[data-look]").forEach((b) => b.addEventListener("click", () => actions.pick(b.dataset.look!)));
      probeBtn.textContent = "Draw again";
      probeBtn.disabled = false;
      paint();
    },
    setProbeImage: (key, url) => {
      probeUrls.set(key, url);
      paint();
    },
    setStatus: (t) => (status.textContent = t),
    setResumable: (on) => (openBtn.textContent = on ? "Resume the fight" : "Open the Stage"),
    destroy: () => {
      removeStyle?.();
      tab.destroy();
    },
  };
}
