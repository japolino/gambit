/**
 * The Lobby battle's skills: big brass medallions along the bottom right, each a real button (keyboard and touch)
 * with the skill's glyph engraved in its dial, its name on a bolted plaque and its cost below. A skill that
 * cannot be used now is padlocked and dimmed, with the reason in place of the cost. The signature skill is the
 * largest, on a sunburst with a crimson dial. Choosing a target swaps the row for an obsidian glass plate with
 * the skill, the hint, Back and (for area skills) Confirm.
 */
import { ActionMenu, type MenuSkill } from "../../battle/action-menu.js";
import type { Rect } from "../../battle/layout.js";
import { plaque } from "../../../scene/themes/lobby/art.js";
import { glyphFor, keyRivet, medal, padlock, selRays } from "./art.js";
import { currentGeom } from "./state.js";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export class LobbyMenu extends ActionMenu {
  readonly el: HTMLDivElement;
  /** The skills shown now, for the number keys. */
  private shown: MenuSkill[] = [];
  private skills: MenuSkill[] = [];
  private actor = "";

  constructor() {
    super();
    this.el = document.createElement("div");
    this.el.className = "bb-menu";
    this.el.setAttribute("role", "group");
    this.el.setAttribute("aria-label", "Skills");
  }

  override place(rect: Rect, ui: number): void {
    this.rect = rect;
    this.ui = ui;
    this.position.set(rect.x, rect.y);
    this.bg.clear();
    Object.assign(this.el.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` });
    this.render();
  }

  /** Pick the n-th skill shown (number keys); Escape goes back from targeting. */
  key(k: string): boolean {
    const m = this.mode;
    if ((m.kind === "skills" || m.kind === "target") && /^[1-9]$/.test(k)) {
      const s = this.shown[Number(k) - 1];
      if (s?.usable) this.onPick(s.id);
      return !!s;
    }
    if (m.kind === "target" && (k === "Escape" || k === "Backspace")) {
      this.onBack();
      return true;
    }
    if (m.kind === "target" && k === "Enter" && m.confirm) {
      this.onConfirm();
      return true;
    }
    return false;
  }

  override showSkills(actor: string, skills: MenuSkill[]): void {
    this.actor = actor;
    this.skills = skills;
    super.showSkills(actor, skills);
  }

  /** The skill being aimed now (for the reticles' labels), or null. */
  get aiming(): string | null {
    return this.mode.kind === "target" ? this.mode.skill : null;
  }

  protected override render(): void {
    for (const c of this.content.removeChildren()) c.destroy({ children: true });
    const el = this.el;
    if (!el) return;
    const g = currentGeom();
    const u = g?.u ?? 1;
    const portrait = g?.portrait ?? false;
    el.style.setProperty("--u", `${u}px`);
    el.classList.toggle("ph", portrait);
    const m = this.mode;
    const { w, h } = this.rect;
    if (m.kind === "wait") {
      this.shown = [];
      el.dataset.mode = "wait";
      el.innerHTML = m.text ? `<div class="wait"><b>${esc(m.text)}</b></div>` : `<div class="wait idle"></div>`;
      return;
    }
    // Skills, or targeting: the medallions stay; the one being aimed is lifted, a ribbon above says what to do.
    const aiming = m.kind === "target" ? m : null;
    const skills = this.skills;
    this.shown = skills;
    el.dataset.mode = aiming ? "target" : "skills";
    const n = skills.length;
    const sigs = skills.filter((s) => s.signature).length;
    const gap = (portrait ? 6 : 26) * u;
    const baseN = portrait ? 70 : 150;
    const baseS = portrait ? 84 : 192;
    const slotN = (portrait ? 76 : 176) * u;
    const slotS = (portrait ? 92 : 220) * u;
    const need = (n - sigs) * slotN + sigs * slotS + gap * Math.max(0, n - 1);
    const headH = (portrait ? 28 : 70) * u;
    const fit = Math.min(1, w / need, (h - headH) / ((portrait ? 150 : 300) * u));
    el.style.setProperty("--fit", fit.toFixed(3));
    el.style.setProperty("--dn", `${baseN * u * fit}px`);
    el.style.setProperty("--ds", `${baseS * u * fit}px`);
    el.style.setProperty("--sn", `${slotN * fit}px`);
    el.style.setProperty("--ss", `${slotS * fit}px`);
    el.style.setProperty("--gap", `${gap * fit}px`);
    const head = aiming
      ? `<header class="hd aim"><span class="rb"><span class="bgp">${plaque(400, 44)}</span><b>${esc(aiming.skill)}</b><i>${esc(aiming.hint)}</i></span>
<button type="button" class="bk" aria-label="Back (Escape)"><span class="pa">${plaque(150, 40)}</span><b>Back</b></button>${aiming.confirm ? `<button type="button" class="cf" aria-label="Confirm (Enter)"><span class="pa">${plaque(170, 40)}</span><b>Confirm</b></button>` : ""}</header>`
      : `<header class="hd"><b>${esc(this.actor)}</b><span>Choose a skill</span></header>`;
    el.innerHTML = `<div class="col">${head}<div class="row"></div></div>`;
    el.querySelector(".bk")?.addEventListener("click", () => this.onBack());
    el.querySelector(".cf")?.addEventListener("click", () => this.onConfirm());
    const row = el.querySelector(".row")!;
    skills.forEach((s, i) => {
      const b = document.createElement("button");
      b.type = "button";
      const sel = !!aiming && aiming.skill === s.name;
      b.className = `bb-sk${s.signature ? " sig" : ""}${s.usable ? "" : " off"}${sel ? " sel" : ""}`;
      const sub = s.usable ? s.cost : (s.reason ?? "Not now");
      b.setAttribute("aria-label", `${s.name}${s.signature ? ", signature" : ""}: ${sub}`);
      if (sel) b.setAttribute("aria-pressed", "true");
      if (!s.usable) b.setAttribute("aria-disabled", "true");
      b.innerHTML = `${sel ? `<span class="halo">${selRays()}</span>` : ""}<span class="md">${medal(glyphFor(s.name, s.signature), s.signature)}</span>${s.usable ? "" : `<span class="lock">${padlock()}</span>`}<span class="key">${keyRivet(i + 1)}</span>
<span class="pl${s.name.length > 11 ? " two" : ""}"><span class="pa">${plaque(200, 44)}</span><b>${esc(s.name)}</b></span>
<span class="${s.usable ? "cost" : "why"}">${esc(sub)}</span>${s.signature ? `<span class="sg">Signature</span>` : ""}${s.flavor ? `<span class="tip">${esc(s.flavor)}</span>` : ""}`;
      b.addEventListener("click", () => { if (s.usable) this.onPick(s.id); });
      row.append(b);
    });
    if (aiming) (row.querySelector(".sel") as HTMLElement | null)?.focus({ preventScroll: true });
  }
}
