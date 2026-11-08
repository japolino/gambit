/**
 * The Gambit drawer tab: play this chat, pick a voice, and (folded away) the
 * art style, the models, and the demo. Play happens in the scene.
 */
import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import { ENCOUNTERS } from "../../engine/content/index.js";
import { PARLEYS } from "../../engine/content/parleys.js";
import type { CardStatus, ModelsPatch, ModelsState, ParleyNarrator, ParleyViewMode } from "../../shared/protocol.js";
import { CARD_CSS, renderCard, type CardActions } from "./card-panel.js";

const ICON = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2.5l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 7.8l5-.7z"/></svg>`;

const CSS = `
.gb { font: 14px/1.5 system-ui, sans-serif; padding: 14px; display: grid; gap: 18px; }
.gb section { display: grid; gap: 10px; }
.gb h3 { margin: 0; font: 600 12px/1.2 system-ui; letter-spacing: .1em; text-transform: uppercase; opacity: .7; }
.gb .row { display: grid; gap: 8px; }
.gb button { text-align: left; padding: 9px 12px; border-radius: 9px; border: 1px solid var(--lumiverse-border, rgba(127,127,127,.25));
  background: var(--lumiverse-fill-subtle, rgba(127,127,127,.06)); color: inherit; cursor: pointer; font: inherit; }
.gb button:hover:not(:disabled) { border-color: var(--lumiverse-primary, #c8a26a); }
.gb button:disabled { opacity: .5; cursor: default; }
.gb .primary { background: var(--lumiverse-primary, #c8a26a); color: var(--lumiverse-primary-contrast, #111); border-color: transparent; text-align: center; font-weight: 600; }
.gb .empty { padding: 14px; border-radius: 9px; background: var(--lumiverse-fill-subtle, rgba(127,127,127,.06)); text-align: center; opacity: .85; }
.gb .hint { font-size: 13px; opacity: .72; }
.gb .status { font-size: 13px; opacity: .75; }
.gb .status:empty { display: none; }
.gb select, .gb textarea { font: inherit; padding: 8px 10px; border-radius: 9px; border: 1px solid var(--lumiverse-border, rgba(127,127,127,.25));
  background: var(--lumiverse-fill-subtle, rgba(127,127,127,.06)); color: inherit; }
.gb select { flex: 1; min-width: 0; }
.gb .ctl { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.gb .ctl button { text-align: center; }
.gb details { border-top: 1px solid var(--lumiverse-border, rgba(127,127,127,.18)); padding-top: 10px; }
.gb details > summary { cursor: pointer; font-weight: 600; list-style-position: inside; }
.gb details[open] > summary { margin-bottom: 10px; }
.gb .seg { display: flex; border: 1px solid var(--lumiverse-border, rgba(127,127,127,.25)); border-radius: 999px; overflow: hidden; width: max-content; max-width: 100%; }
.gb .seg button { border: 0; border-radius: 0; padding: 5px 12px; background: none; text-align: center; }
.gb .seg button.on { background: var(--lumiverse-primary, #c8a26a); color: var(--lumiverse-primary-contrast, #111); }
.gb .looks { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.gb .look { border-radius: 9px; overflow: hidden; display: grid; background: var(--lumiverse-fill-subtle, rgba(127,127,127,.06)); border: 1px solid var(--lumiverse-border, rgba(127,127,127,.25)); }
.gb .look .pics { display: grid; grid-template-columns: 3fr 2fr; aspect-ratio: 16 / 9; background: rgba(127,127,127,.12); cursor: pointer; }
.gb .look .pics div { background-size: cover; background-position: center; }
.gb .look .name { padding: 6px 9px 2px; font-weight: 600; }
.gb .look .src { font-size: 11px; font-weight: 400; opacity: .6; text-transform: uppercase; letter-spacing: .06em; margin-left: 5px; }
.gb .look.locked { outline: 2px solid var(--lumiverse-primary, #c8a26a); }
.gb .look .acts { display: flex; gap: 4px; padding: 4px 8px 8px; flex-wrap: wrap; }
.gb .look .acts button { padding: 3px 9px; font-size: 13px; border-radius: 999px; }
.gb .lookbar { display: flex; gap: 6px; flex-wrap: wrap; }
.gb .describe { display: flex; gap: 6px; }
.gb .describe textarea { flex: 1; min-width: 0; resize: vertical; }
.gb .check { display: flex; gap: 8px; align-items: center; cursor: pointer; }
.gb input[type="range"] { flex: 1; min-width: 80px; accent-color: var(--lumiverse-primary, #c8a26a); }
.gb .credits { display: grid; gap: 6px; font-size: 12px; opacity: .8; overflow-wrap: anywhere; }
.gb .model-row { display: grid; gap: 6px; }
.gb .model-row .lbl { font-weight: 600; }
.gb .model-row .lbl small { font-weight: 400; opacity: .65; margin-left: 6px; font-size: 13px; }
${CARD_CSS}`;

/** Music in the scene: on or off, how loud, what's playing, and the credits for what has played. */
export interface MusicUi {
  on: boolean;
  volume: number;
  now: string | null;
  credits: string[];
  error: string | null;
  setOn(on: boolean): void;
  setVolume(volume: number): void;
}

/** The voice picker (docs/DESIGN.md 6.4): no voice, the default voice, or one of the user's TTS connections. */
export interface VoiceUi {
  available: boolean;
  /** "" = no voice, "default" = the default TTS connection, else a connection id. */
  choice: string;
  connections: { id: string; name: string }[];
  error: string | null;
  choose(choice: string): void;
  test(): void;
}

export interface Panel {
  setLook(lookId: string | null): void;
  showProbes(looks: { lookId: string; label: string; source?: string; description?: string }[]): void;
  setProbeImage(key: string, url: string): void;
  setStatus(text: string): void;
  setResumable(on: boolean): void;
  /** The open Parley's name (null when none), the view mode, and how many facts the journal holds. */
  setParley(open: string | null, mode: ParleyViewMode, journalSize: number): void;
  setNarrator(mode: ParleyNarrator): void;
  /** Which connection each kind of model call uses (the Models section). */
  setModels(state: ModelsState): void;
  /** The active chat's card status (null while asking), and whether a chat is open at all. */
  setCard(status: CardStatus | null, hasChat: boolean): void;
  setVoice(v: VoiceUi): void;
  setMusic(m: MusicUi): void;
  destroy(): void;
}

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

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
    models: { get(): void; set(patch: ModelsPatch): void };
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
    <section><h3>This chat</h3><div class="card-sec" data-card></div></section>
    <section><h3>Voice</h3><div data-voice></div></section>
    <section><h3>Music</h3><div data-music></div></section>
    <div class="status" data-status></div>
    <details data-looks-sec><summary>Art style</summary><div class="row">
      <div class="hint" data-look-hint>Default style</div>
      <div class="lookbar"><button data-probe>Draw previews</button><button data-match>Match this card</button><button data-import>Import</button><input type="file" accept=".json,application/json" data-import-file hidden></div>
      <div class="describe"><textarea data-describe rows="2" maxlength="800" placeholder="Describe a style…"></textarea><button data-describe-go>Create</button></div>
      <div class="looks" data-looks></div></div></details>
    <details data-models-sec><summary>Models</summary><div class="row" data-models><div class="hint">Loading…</div></div></details>
    <details><summary>Demo and test fights</summary><div class="row">
      <button data-demo>Add the Saltgate demo card</button>
      <button class="primary" data-open>Open the Stage</button>
      <h3>Parley</h3>
      ${Object.values(PARLEYS)
        .map((p) => `<button data-parley="${p.id}" title="${esc(p.blurb)}">${esc(p.name)}</button>`)
        .join("")}
      <div class="ctl"><span>View</span><div class="seg" data-parley-mode><button data-m="immersive">Immersive</button><button data-m="transparent">Transparent</button></div></div>
      <div class="ctl"><span>NPC lines</span><div class="seg" data-parley-narrator><button data-n="gambit">Gambit</button><button data-n="chat">Chat preset</button></div></div>
      <div class="hint" data-parley-hint></div>
      <h3>Encounters</h3>${Object.values(ENCOUNTERS)
        .map((e) => `<button data-enc="${e.id}">${esc(e.name)}${e.boss ? " · boss" : ""}</button>`)
        .join("")}</div></details>`;
  tab.root.appendChild(root);
  const cardEl = root.querySelector<HTMLElement>("[data-card]")!;
  const voiceEl = root.querySelector<HTMLElement>("[data-voice]")!;
  const musicEl = root.querySelector<HTMLElement>("[data-music]")!;
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

  /* ------------------------------- Music ------------------------------- */
  const renderMusic = (m: MusicUi) => {
    const open = musicEl.querySelector<HTMLDetailsElement>("details")?.open ? " open" : "";
    musicEl.innerHTML = `<label class="check"><input type="checkbox" data-music-on ${m.on ? "checked" : ""}> Play music in the scene</label>${
      m.on ? `<div class="ctl"><input type="range" min="0" max="100" value="${Math.round(m.volume * 100)}" aria-label="Music volume" data-music-volume></div>` : ""
    }<div class="hint">${m.on && m.now ? `Now playing: ${esc(m.now)}` : "A model scores each moment from Kevin MacLeod's catalogue. Tracks stream from incompetech.com, so this browser connects to that site while it's on."}</div>${m.error ? `<div class="note">${esc(m.error)}</div>` : ""}${
      m.credits.length ? `<details${open}><summary>Music credits</summary><div class="credits">${m.credits.map((c) => `<div>${esc(c)}</div>`).join("")}</div></details>` : ""
    }`;
    musicEl.querySelector<HTMLInputElement>("[data-music-on]")!.addEventListener("change", (e) => m.setOn((e.target as HTMLInputElement).checked));
    musicEl.querySelector<HTMLInputElement>("[data-music-volume]")?.addEventListener("input", (e) => m.setVolume(Number((e.target as HTMLInputElement).value) / 100));
  };

  /* ------------------------------- Voice ------------------------------- */
  const renderVoice = (v: VoiceUi) => {
    const opt = (value: string, label: string) => `<option value="${esc(value)}"${value === v.choice ? " selected" : ""}>${esc(label)}</option>`;
    // A saved connection that is gone still shows, so the picker never lies about what is set.
    const missing = v.choice && v.choice !== "default" && !v.connections.some((c) => c.id === v.choice) ? opt(v.choice, "Saved voice (not listed)") : "";
    voiceEl.innerHTML = `<div class="ctl"><select data-voice-pick aria-label="Voice" ${v.available ? "" : "disabled"}>${opt("", "No voice")}${opt("default", "Default voice")}${v.connections.map((c) => opt(c.id, c.name)).join("")}${missing}</select>${v.choice ? `<button data-voice-test>Test</button>` : ""}</div>${
      !v.available ? `<div class="hint">Text-to-speech isn't available here.</div>` : v.error ? `<div class="note">${esc(v.error)}</div>` : ""
    }`;
    voiceEl.querySelector<HTMLSelectElement>("[data-voice-pick]")!.addEventListener("change", (e) => v.choose((e.target as HTMLSelectElement).value));
    voiceEl.querySelector("[data-voice-test]")?.addEventListener("click", () => v.test());
  };

  /* ------------------------------ Models ------------------------------- */
  // docs/DESIGN.md 9: a connection and a reasoning switch per role, the Decision model, and embeddings.
  const modelsEl = root.querySelector<HTMLElement>("[data-models]")!;
  root.querySelector("[data-models-sec]")!.addEventListener("toggle", (e) => {
    if ((e.target as HTMLDetailsElement).open) actions.models.get();
  });
  const renderModels = (st: ModelsState) => {
    const opt = (value: string, label: string, on: boolean) => `<option value="${esc(value)}"${on ? " selected" : ""}>${esc(label)}</option>`;
    const named = (c: ModelsState["llm"][number]) => `${c.name}${c.model && c.model !== c.name ? ` (${c.model})` : ""}`;
    const roles: [keyof ModelsState["roles"], string, string][] = [
      ["reader", "Reader", "reads the card"],
      ["narrator", "Narrator", "scenes and replies"],
      ["helper", "Helper", "small background calls"],
    ];
    const def = st.llm.find((c) => c.isDefault);
    const rows = roles.map(([id, label, sub]) => {
      const r = st.roles[id];
      const missing = r.connectionId && !st.llm.some((c) => c.id === r.connectionId);
      return `<div class="model-row"><span class="lbl">${label}<small>${sub}</small></span>
        <select data-role="${id}">${opt("", `Default${def ? `: ${named(def)}` : ""}`, !r.connectionId)}${st.llm.map((c) => opt(c.id, named(c), c.id === r.connectionId)).join("")}${missing ? opt(r.connectionId!, "Removed connection (uses default)", true) : ""}</select>
        <div class="seg" data-reason="${id}" title="Thinking">${(["auto", "on", "off"] as const).map((v) => `<button data-v="${v}" class="${r.reasoning === v ? "on" : ""}">${v === "auto" ? "Auto" : v === "on" ? "Think" : "No thinking"}</button>`).join("")}</div></div>`;
    });
    const dec = `<div class="model-row"><span class="lbl">Decisions<small>quick yes/no checks</small></span><select data-decision>${opt("auto", "Auto", st.decision === "auto")}${opt("off", "Off (rules only)", st.decision === "off")}${st.decisions.map((c) => opt(c.id, `${c.name}${c.isDefault ? " (default)" : ""}`, c.id === st.decision)).join("")}</select></div>`;
    const emb = `<div class="model-row"><span class="lbl">Embeddings<small>search by meaning</small></span><select data-embedding>${opt("auto", "Auto", st.embedding === "auto")}${opt("off", "Off (words only)", st.embedding === "off")}${st.embeddings.map((c) => opt(c.id, `${c.name} (${c.model})${c.isDefault ? ", primary" : ""}`, c.id === st.embedding)).join("")}</select></div>`;
    modelsEl.innerHTML = `${rows.join("")}${dec}${emb}`;
    modelsEl.querySelectorAll<HTMLSelectElement>("[data-role]").forEach((s) => s.addEventListener("change", () => actions.models.set({ role: s.dataset.role as keyof ModelsState["roles"], connectionId: s.value || null })));
    modelsEl.querySelectorAll<HTMLElement>("[data-reason]").forEach((g) =>
      g.querySelectorAll<HTMLButtonElement>("button").forEach((b) => b.addEventListener("click", () => actions.models.set({ role: g.dataset.reason as keyof ModelsState["roles"], reasoning: b.dataset.v as "auto" | "on" | "off" }))),
    );
    modelsEl.querySelector<HTMLSelectElement>("[data-decision]")!.addEventListener("change", (e) => actions.models.set({ decision: (e.target as HTMLSelectElement).value }));
    modelsEl.querySelector<HTMLSelectElement>("[data-embedding]")!.addEventListener("change", (e) => actions.models.set({ embedding: (e.target as HTMLSelectElement).value }));
  };

  /* ------------------------------- Looks ------------------------------- */
  const looksEl = root.querySelector<HTMLElement>("[data-looks]")!;
  const lookHint = root.querySelector<HTMLElement>("[data-look-hint]")!;
  const probeBtn = root.querySelector<HTMLButtonElement>("[data-probe]")!;
  probeBtn.addEventListener("click", () => {
    probeBtn.disabled = true;
    probeBtn.textContent = "Drawing…";
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
      describeGo.textContent = "Create";
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
    looksEl.querySelectorAll<HTMLElement>("[data-look]").forEach((b) => {
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

  return {
    setLook: (id) => {
      locked = id;
      lookHint.textContent = id ? `Using: ${looksEl.querySelector(`[data-look="${globalThis.CSS.escape(id)}"] .name`)?.firstChild?.textContent ?? id}` : "Default style";
      paint();
    },
    showProbes: (looks) => {
      looksEl.innerHTML = looks
        .map((l) => {
          const id = esc(l.lookId);
          const own = l.source === "user" || l.source === "card";
          return `<div class="look" data-look="${id}" title="${esc(l.description ?? "")}"><div class="pics" data-use="${id}"><div data-part="gate"></div><div data-part="bust"></div></div><span class="name">${esc(l.label)}${SOURCE[l.source ?? "preset"] ? `<span class="src">${SOURCE[l.source ?? "preset"]}</span>` : ""}</span><div class="acts"><button data-use="${id}">Use</button><button data-preview="${id}">Preview</button><button data-export="${id}">Export</button>${own ? `<button data-del="${id}">Delete</button>` : ""}</div></div>`;
        })
        .join("");
      looksEl.querySelectorAll<HTMLElement>("[data-use]").forEach((b) => b.addEventListener("click", () => actions.pick(b.dataset.use!)));
      looksEl.querySelectorAll<HTMLElement>("[data-preview]").forEach((b) => b.addEventListener("click", () => actions.probe(b.dataset.preview!)));
      looksEl.querySelectorAll<HTMLElement>("[data-export]").forEach((b) => b.addEventListener("click", () => actions.looks.exportLook(b.dataset.export!)));
      looksEl.querySelectorAll<HTMLElement>("[data-del]").forEach((b) => b.addEventListener("click", () => actions.looks.remove(b.dataset.del!)));
      probeBtn.textContent = "Draw previews";
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
    setModels: (st) => renderModels(st),
    setCard: (st, hasChat) => renderCard(cardEl, st, hasChat, actions.card),
    setVoice: (v) => renderVoice(v),
    setMusic: (m) => renderMusic(m),
    setParley: (open, mode, journalSize) => {
      parleyResume.hidden = !open;
      if (open) parleyResume.textContent = `Resume: ${open}`;
      paintMode(mode);
      parleyHint.textContent = journalSize ? `Journal: ${journalSize} fact${journalSize === 1 ? "" : "s"}` : "";
    },
    destroy: () => {
      removeStyle?.();
      tab.destroy();
    },
  };
}
