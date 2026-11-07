/**
 * The class panel (docs/DESIGN.md 4.4, M7): your class book with ranks,
 * the Forge, the Altar (fusion), awakening and the codex. Every class and
 * skill is shown with its real numbers before you keep it.
 */
import type { ClassSheet, SheetSkill } from "../../engine/forge/forge.js";
import type { ForgeOp, ForgeView } from "../../shared/forge-view.js";

export type ForgeAct = (op: ForgeOp, arg?: string, arg2?: string, text?: string) => void;

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const FORGE_CSS = `
.gs .fg { position: absolute; top: var(--hud, 56px); right: 12px; width: min(560px, calc(100% - 24px)); bottom: 200px; z-index: 5; display: flex; flex-direction: column; background: rgba(15,12,9,.96); border: 1px solid rgba(201,168,101,.5); border-radius: 12px; font: 13px/1.45 "Segoe UI", system-ui, sans-serif; box-shadow: 0 12px 30px rgba(0,0,0,.5); overflow: hidden; }
.gs .fg header { display: flex; align-items: center; gap: 10px; padding: 10px 12px 6px; }
.gs .fg header b { font-size: 14px; color: #f1d9b0; }
.gs .fg header .purse { margin-left: auto; opacity: .85; }
.gs .fg header .x { background: none; border: 0; color: inherit; font-size: 18px; cursor: pointer; }
.gs .fg nav { display: flex; gap: 4px; padding: 0 10px 8px; flex-wrap: wrap; }
.gs .fg nav button { background: rgba(255,255,255,.06); border: 1px solid rgba(201,168,101,.3); color: inherit; border-radius: 999px; padding: 3px 10px; cursor: pointer; font: inherit; }
.gs .fg nav button[aria-selected="true"] { background: rgba(201,168,101,.28); border-color: #c9a865; }
.gs .fg .body { overflow: auto; padding: 0 12px 12px; flex: 1; }
.gs .fg .muted { opacity: .65; }
.gs .fg .cls { display: grid; grid-template-columns: 48px 1fr auto; gap: 8px; align-items: center; padding: 6px; border-radius: 8px; border: 1px solid transparent; }
.gs .fg .cls.on { border-color: rgba(201,168,101,.6); background: rgba(201,168,101,.08); }
.gs .fg .cls .pic { width: 48px; height: 48px; border-radius: 8px; background: #2a2320 center/cover; }
.gs .fg .cls .nm { font-weight: 600; }
.gs .fg .tag { font-size: 11px; padding: 0 6px; border-radius: 999px; background: rgba(255,255,255,.1); margin-left: 6px; font-weight: 400; }
.gs .fg .stars { color: #c9a865; letter-spacing: 1px; }
.gs .fg button.go { background: #c9a865; color: #1b140c; border: 0; border-radius: 6px; padding: 4px 10px; cursor: pointer; font: 600 12px/1.4 "Segoe UI", system-ui, sans-serif; }
.gs .fg button.go:disabled { opacity: .4; cursor: default; }
.gs .fg button.plain { background: rgba(255,255,255,.08); color: inherit; border: 1px solid rgba(255,255,255,.2); border-radius: 6px; padding: 4px 10px; cursor: pointer; font: inherit; }
.gs .fg details { margin: 2px 0 6px 56px; }
.gs .fg details summary { cursor: pointer; opacity: .75; }
.gs .fg .sheet .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px 10px; margin: 6px 0; }
.gs .fg .sheet .stats span { text-transform: capitalize; }
.gs .fg .sheet .sk { border-left: 2px solid rgba(201,168,101,.5); padding: 2px 0 2px 8px; margin: 6px 0; }
.gs .fg .sheet .sk.sig { border-left-color: #f1d9b0; }
.gs .fg .sheet .sk .meta { font-size: 12px; opacity: .7; }
.gs .fg .sheet ul { margin: 2px 0; padding-left: 16px; }
.gs .fg textarea { width: 100%; box-sizing: border-box; min-height: 80px; background: rgba(255,255,255,.06); color: inherit; border: 1px solid rgba(201,168,101,.4); border-radius: 8px; padding: 8px; font: inherit; resize: vertical; }
.gs .fg select { background: #221b14; color: inherit; border: 1px solid rgba(201,168,101,.4); border-radius: 6px; padding: 4px; font: inherit; max-width: 45%; }
.gs .fg .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 8px 0; }
.gs .fg .bar { display: inline-block; width: 90px; height: 6px; border-radius: 3px; background: rgba(255,255,255,.12); vertical-align: middle; margin: 0 6px; overflow: hidden; }
.gs .fg .bar i { display: block; height: 100%; background: #c9a865; }
.gs .fg .pending { border: 1px solid #c9a865; border-radius: 10px; padding: 10px; margin: 8px 0; background: rgba(201,168,101,.07); }
.gs .fg .pending .head { display: flex; gap: 10px; align-items: center; }
.gs .fg .pending .pic { width: 72px; height: 72px; border-radius: 10px; background: #2a2320 center/cover; flex: none; }
.gs .fg .pending .changes { margin: 6px 0; padding-left: 16px; color: #e8c98e; }
.gs .fg .opt { border: 1px solid rgba(201,168,101,.35); border-radius: 8px; padding: 6px 8px; margin: 6px 0; }
.gs .fg .busyline { padding: 8px 12px; color: #f1d9b0; }
@media (max-width: 720px) { .gs .fg { left: 12px; right: 12px; width: auto; bottom: 330px; } .gs .fg .sheet .stats { grid-template-columns: repeat(2, 1fr); } }
`;

type Tab = "book" | "forge" | "altar" | "awaken" | "codex";
const TABS: { id: Tab; label: string }[] = [
  { id: "book", label: "Classes" },
  { id: "forge", label: "Forge" },
  { id: "altar", label: "Altar" },
  { id: "awaken", label: "Awaken" },
  { id: "codex", label: "Codex" },
];

const ORIGIN: Record<string, string> = { card: "card", base: "base", forged: "forged", fused: "fused", codex: "codex" };

function skillHtml(s: SheetSkill): string {
  return `<div class="sk${s.signature ? " sig" : ""}"><b>${esc(s.name)}</b>${s.signature ? ' <span class="tag">signature</span>' : ""}
    <div class="meta">tier ${s.tier} · ${esc(s.target)} · ${esc(s.cost)}</div>
    ${s.flavor ? `<div class="muted"><i>${esc(s.flavor)}</i></div>` : ""}
    <ul>${s.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div>`;
}

export function sheetHtml(c: ClassSheet): string {
  return `<div class="sheet">
    <div class="stats">${c.stats.map((s) => `<span>${esc(s.key)} <b>${s.value}</b></span>`).join("")}</div>
    <div class="muted">At level ${c.level}. Attack: ${esc(c.attack)}.</div>
    ${c.resource ? `<div><b>Resource</b>: ${esc(c.resource)}</div>` : ""}
    ${c.passives.map((p) => `<div><b>Passive</b>: ${esc(p)}</div>`).join("")}
    ${c.skills.map(skillHtml).join("")}
  </div>`;
}

export function mountForgePanel(host: HTMLElement, act: ForgeAct, artUrl: (key: string) => string | null) {
  const el = document.createElement("div");
  el.className = "fg gone";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Classes");
  host.append(el);
  let view: ForgeView | null = null;
  let tab: Tab = "book";
  let draft = "";
  let open = false;

  const pic = (key?: string) => {
    const u = key ? artUrl(key) : null;
    return u ? ` style="background-image:url('${u.replace(/'/g, "%27")}')"` : "";
  };
  const stars = (n: number) => "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n));

  function pendingHtml(v: ForgeView): string {
    const p = v.pending;
    if (!p) return "";
    if (p.kind === "awaken") {
      return `<div class="pending"><b>Choose how it awakens</b>
        ${p.changes.length ? `<ul class="changes">${p.changes.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}
        ${(p.options ?? []).map((o, i) => `<div class="opt">${skillHtml(o)}<button class="go" data-pick="${i}">Awaken this way</button></div>`).join("")}
        <div class="row"><button class="plain" data-op="decline">Not now</button></div></div>`;
    }
    const s = p.sheet!;
    return `<div class="pending">
      <div class="head"><div class="pic"${pic(p.art)}></div><div><b style="font-size:15px">${esc(s.name)}</b><div class="muted">${p.kind === "forge" ? "From the Forge" : "From the Altar"} · ${esc(s.brief)}</div></div></div>
      ${p.changes.length ? `<div class="muted" style="margin-top:6px">What changed from the request:</div><ul class="changes">${p.changes.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}
      ${p.sim ? `<div class="muted">${esc(p.sim)}</div>` : ""}
      ${sheetHtml(s)}
      <div class="row">
        <button class="go" data-op="confirm">${p.kind === "forge" ? "Keep it (spends the Blank Crest)" : "Fuse"}</button>
        <button class="plain" data-op="decline">${p.kind === "fusion" ? "Decline (the catalyst comes back)" : "Decline"}</button>
        ${p.canReroll ? `<button class="plain" data-op="reroll">Reroll (a second catalyst)</button>` : ""}
      </div></div>`;
  }

  function bodyHtml(v: ForgeView): string {
    switch (tab) {
      case "book":
        return (
          (v.classes.some((c) => c.origin === "card") ? "" : `<p class="muted">Your card kit appears here after your first fight.</p>`) +
          v.classes
            .map(
              (c) => `<div class="cls${c.active ? " on" : ""}"><div class="pic"${pic(c.art)}></div>
              <div><div class="nm">${esc(c.name)}<span class="tag">${ORIGIN[c.origin]}</span></div>
              <div><span class="stars" title="Rank ${c.rank}">${stars(c.rank)}</span> <span class="muted">${c.wins} win${c.wins === 1 ? "" : "s"}${c.toNext ? ` · ${c.toNext} to rank ${c.rank + 1}` : ""}</span></div>
              ${c.parents ? `<div class="muted">${esc(c.parents.join(" + "))}</div>` : c.identity ? `<div class="muted">${esc(c.identity)}</div>` : ""}</div>
              <div>${c.active ? `<span class="muted">In use</span>` : `<button class="go" data-use="${esc(c.id)}">Use</button>`}</div></div>
              <details><summary>Sheet</summary>${sheetHtml(c.sheet)}</details>`,
            )
            .join("")
        );
      case "forge":
        return `<p>Describe a class in your own words. The Architect builds it from the game's effects, the budget sizes it, and test fights check it. You see every number before you keep it.</p>
          <p class="muted">Blank Crests: <b>${v.crests}</b>. Finishing someone's questline turns one up.</p>
          <textarea placeholder="A war-chef. Fights with cleavers, feeds the party between turns, and gets stronger the more varied the meal.">${esc(draft)}</textarea>
          <div class="row"><button class="go" data-forge ${v.crests < 1 || !!v.pending ? "disabled" : ""}>Forge</button>${v.crests < 1 ? `<span class="muted">You need a Blank Crest.</span>` : ""}</div>`;
      case "altar": {
        const ok = v.classes.filter((c) => c.rank >= v.fuseRank);
        const opts = ok.map((c) => `<option value="${esc(c.id)}">${esc(c.name)} (rank ${c.rank})</option>`).join("");
        return `<p>Two classes at rank ${v.fuseRank} or more and a catalyst make a new class: their stats blended with one mutation, a resource from both, two skills from each, and three new skills built only from what the parents use.</p>
          <p class="muted">Catalysts: <b>${v.catalysts}</b>. Bosses and cleared delves leave them behind.</p>
          ${ok.length >= 2 ? `<div class="row"><select data-a>${opts}</select> + <select data-b>${ok.map((c, i) => `<option value="${esc(c.id)}" ${i === 1 ? "selected" : ""}>${esc(c.name)} (rank ${c.rank})</option>`).join("")}</select>
            <button class="go" data-fuse ${v.catalysts < 1 || !!v.pending ? "disabled" : ""}>Fuse</button></div>` : `<p class="muted">You need two classes at rank ${v.fuseRank}. Ranks come from winning fights with a class: switch class in the Classes tab.</p>`}
          <ul>${v.classes.map((c) => `<li>${esc(c.name)}: rank ${c.rank}</li>`).join("")}</ul>`;
      }
      case "awaken":
        return `<p>A skill used ${v.awakenAt} times can awaken: pick one of three mutations, a tier stronger, with a new cut-in.</p>
          ${v.skills.length ? v.skills.map((s) => `<div class="row"><b>${esc(s.name)}</b>${s.awakened ? '<span class="tag">awakened</span>' : `<span class="bar"><i style="width:${Math.min(100, (s.uses / v.awakenAt) * 100)}%"></i></span><span class="muted">${Math.min(s.uses, v.awakenAt)}/${v.awakenAt}</span>${s.ready ? `<button class="go" data-awaken="${esc(s.id)}" ${v.pending ? "disabled" : ""}>Awaken</button>` : ""}`}</div>`).join("") : `<p class="muted">Fight once with your class to see its skills here.</p>`}`;
      case "codex":
        return `<p>Every class you forge or fuse, from every campaign. Bring one into this one: it starts again at rank 1.</p>
          ${v.codex.length ? v.codex.map((e) => `<div class="cls"><div class="pic"${pic(e.art)}></div><div><div class="nm">${esc(e.name)}<span class="tag">${e.origin}</span></div><div class="muted">${e.parents ? esc(e.parents.join(" + ")) + " · " : ""}made on ${esc(e.card)}</div></div><div>${e.owned ? `<span class="muted">In your book</span>` : `<button class="go" data-take="${esc(e.id)}">Take</button>`}</div></div>`).join("") : `<p class="muted">Nothing yet.</p>`}`;
    }
  }

  function render(): void {
    el.classList.toggle("gone", !open);
    if (!open) return;
    const v = view;
    if (!v) {
      el.innerHTML = `<div class="busyline">Opening your classes…</div>`;
      return;
    }
    const scroll = el.querySelector(".body")?.scrollTop ?? 0;
    el.innerHTML = `<header><b>Classes</b><span class="purse">◈ ${v.crests} crest${v.crests === 1 ? "" : "s"} · ✦ ${v.catalysts} catalyst${v.catalysts === 1 ? "" : "s"}</span><button class="x" aria-label="Close" data-close>×</button></header>
      <nav role="tablist">${TABS.map((t) => `<button role="tab" data-tab="${t.id}" aria-selected="${t.id === tab}">${t.label}</button>`).join("")}</nav>
      ${v.busy ? `<div class="busyline">${esc(v.busy)}</div>` : ""}
      <div class="body">${pendingHtml(v)}${bodyHtml(v)}</div>`;
    const body = el.querySelector<HTMLDivElement>(".body")!;
    body.scrollTop = scroll;
    const on = (sel: string, fn: (b: HTMLElement) => void) => el.querySelectorAll<HTMLElement>(sel).forEach((b) => b.addEventListener("click", () => fn(b)));
    on("[data-close]", () => toggle(false));
    on("[data-tab]", (b) => {
      tab = b.dataset.tab as Tab;
      render();
    });
    on("[data-use]", (b) => act("use", b.dataset.use));
    on("[data-op]", (b) => act(b.dataset.op as ForgeOp));
    on("[data-pick]", (b) => act("pick", b.dataset.pick));
    on("[data-awaken]", (b) => act("awaken", b.dataset.awaken));
    on("[data-take]", (b) => act("take", b.dataset.take));
    on("[data-fuse]", () => act("fuse", el.querySelector<HTMLSelectElement>("[data-a]")?.value, el.querySelector<HTMLSelectElement>("[data-b]")?.value));
    const ta = el.querySelector("textarea");
    ta?.addEventListener("input", () => (draft = ta.value));
    // Keys typed here belong to the textarea, not the scene's shortcuts.
    ta?.addEventListener("keydown", (e) => e.stopPropagation());
    on("[data-forge]", () => act("forge", undefined, undefined, draft));
  }

  function toggle(on?: boolean): void {
    open = on ?? !open;
    if (open) act("open");
    render();
  }

  return {
    set(v: ForgeView) {
      view = v;
      render();
    },
    toggle,
    get open() {
      return open;
    },
    /** A portrait landed: redraw if the panel shows it. */
    art(key: string) {
      if (!open || !view) return;
      const shown = view.classes.some((c) => c.art === key) || view.codex.some((c) => c.art === key) || view.pending?.art === key;
      if (shown) render();
    },
    destroy() {
      el.remove();
    },
  };
}
