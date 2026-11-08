/**
 * The Lobby battle's party card. The breathing bust stays in Pixi (the stage's puppet, its hit flash and shake),
 * seen through the arched window of a DOM card drawn in the scene's brass: the frame, the name ribbon, the HP
 * trough with its ghost drain, the focus groove, the class resource as star studs, statuses as enamel buttons.
 * The DOM card follows the Pixi card every frame (lift, shake), and turns into a button while the card can be
 * targeted, so a keyboard can choose an ally too.
 */
import { PartyCard } from "../../battle/party-card.js";
import type { DisplayUnit } from "../../battle/display.js";
import type { Rect } from "../../battle/layout.js";
import type { PuppetFigure } from "../../puppet/puppet-figure.js";
import type { FigureSource } from "../../puppet/source.js";
import { STATUS_STYLE, hex } from "../../theme.js";
import { vgrad } from "../../ui.js";
import { CARD_FOCUS, CARD_HP, CARD_WINDOW, brackets, cardFrame, cardWindowShade } from "./art.js";

const pct = (n: number, of: number) => `${((n / of) * 100).toFixed(3)}%`;

/** A small enamel status button (in the status colour) with the status's initial and stacks. */
export function statusChip(id: keyof typeof STATUS_STYLE, stacks: number, turns: number): string {
  const s = STATUS_STYLE[id];
  const c = hex(s.color);
  const tip = `${s.label}${stacks > 1 ? ` ×${stacks}` : ""}${turns > 0 ? `, ${turns} turn${turns === 1 ? "" : "s"}` : ""}`;
  return `<i class="bb-st${s.harmful ? " bad" : ""}" title="${tip}" style="--c:${c}"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#1c1308"/><circle cx="20" cy="20" r="16.6" fill="none" stroke="url(#lb-brass)" stroke-width="2.6"/><circle cx="20" cy="20" r="13.4" fill="${c}"/><circle cx="20" cy="20" r="13.4" fill="url(#lb-vig)" opacity=".7"/><path d="M10 15 A11 11 0 0 1 20 9" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="2.4" stroke-linecap="round"/></svg><b>${s.label.charAt(0)}</b>${stacks > 1 ? `<small>${stacks}</small>` : ""}</i>`;
}

export class LobbyCard extends PartyCard {
  readonly el: HTMLButtonElement;
  private readonly nm: HTMLElement;
  private readonly hpFill: HTMLElement;
  private readonly hpGhost: HTMLElement;
  private readonly hpShield: HTMLElement;
  private readonly hpNum: HTMLElement;
  private readonly foFill: HTMLElement;
  private readonly res: HTMLElement;
  private readonly sts: HTMLElement;
  /** Card grid unit in px (the frame is drawn on 250x364). */
  private k = 1;

  constructor(unit: DisplayUnit, bust: FigureSource, strength: number, cutout: boolean) {
    super(unit, bust, strength, cutout);
    this.nameText.visible = false;
    this.hpText.visible = false;
    this.resText.visible = false;
    const el = document.createElement("button");
    el.type = "button";
    el.className = "bb-card";
    el.tabIndex = -1;
    el.setAttribute("aria-label", unit.name);
    el.innerHTML = `<div class="glow" aria-hidden="true"></div>
<div class="ws">${cardWindowShade()}</div>
<div class="fr">${cardFrame(unit.name.charAt(0).toUpperCase())}</div>
<div class="sts"></div>
<b class="nm"></b>
<div class="hp"><i class="gh"></i><i class="fl"></i><i class="sh"></i><span class="num"></span></div>
<div class="fo"><i class="fl"></i></div>
<div class="res"></div>
<div class="brk">${brackets()}</div>
<div class="turn" aria-hidden="true"><span>Your turn</span></div>
<div class="fallen" aria-hidden="true"><span>Fallen</span></div>`;
    const q = (s: string) => el.querySelector(s) as HTMLElement;
    this.el = el;
    this.nm = q(".nm");
    this.hpFill = q(".hp .fl");
    this.hpGhost = q(".hp .gh");
    this.hpShield = q(".hp .sh");
    this.hpNum = q(".hp .num");
    this.foFill = q(".fo .fl");
    this.res = q(".res");
    this.sts = q(".sts");
    // Lay the HUD's pieces onto the frame's grid.
    const at = (n: HTMLElement, r: { x: number; y: number; w: number; h: number }) => Object.assign(n.style, { left: pct(r.x, 250), top: pct(r.y, 364), width: pct(r.w, 250), height: pct(r.h, 364) });
    at(q(".hp"), CARD_HP);
    at(q(".fo"), CARD_FOCUS);
    at(this.nm, { x: 0, y: 234, w: 250, h: 38 });
    at(this.res, { x: 24, y: 324, w: 202, h: 20 });
    at(this.sts, { x: 196, y: 40, w: 34, h: 190 });
    el.addEventListener("click", () => {
      if (this.targetable) this.emit("pointertap", { stopPropagation() {} } as never);
    });
  }

  override place(rect: Rect, ui: number): void {
    this.rect = rect;
    this.ui = ui;
    this.position.set(rect.x, rect.y);
    const k = rect.w / 250;
    this.k = k;
    const win = { x: CARD_WINDOW.x * k, y: CARD_WINDOW.y * k, w: CARD_WINDOW.w * k, h: CARD_WINDOW.h * k };
    // Behind the bust: the lobby's warm slate, darker at the foot.
    this.frame.clear().rect(win.x, win.y, win.w, win.h).fill(vgrad(0x4a3a2a, 0x0b0907));
    this.frame.ellipse(win.x + win.w / 2, win.y + win.h * 0.32, win.w * 0.46, win.h * 0.3).fill({ color: 0xffd28a, alpha: 0.08 });
    this.portraitMask.clear().rect(win.x, win.y, win.w, win.h).fill({ color: 0xffffff });
    this.shade.clear();
    this.info.clear();
    this.glow.clear();
    for (const f of this.portrait.children) this.fitInto(f as PuppetFigure, win);
    this.hitArea = { contains: (x: number, y: number) => x >= 0 && y >= 0 && x <= rect.w && y <= rect.h };
    const s = this.el.style;
    s.width = `${rect.w}px`;
    s.height = `${rect.h}px`;
    s.setProperty("--k", `${k}px`);
    this.redraw();
  }

  /** Fit a bust into the arched window: an opaque picture covers it; a cut-out is framed on its face. */
  private fitInto(bust: PuppetFigure, win: { x: number; y: number; w: number; h: number }): void {
    if (bust.framed) {
      const s = Math.max(win.w / bust.imageW, win.h / bust.imageH) * 1.04;
      bust.scale.set(s);
      bust.position.set(win.x + win.w / 2, win.y + bust.imageH * s - Math.max(0, bust.imageH * s - win.h) * 0.2);
      for (const c of bust.children) if (c !== bust.mesh && c !== bust.mesh.mask) c.visible = false;
      return;
    }
    const face = bust.faceLocal;
    const faceH = Math.max(1, bust.faceHeightLocal);
    const s = Math.min(win.h / (bust.imageH * 0.26), Math.max(win.h / (bust.imageH * 1.1), (win.h * 0.33) / faceH));
    bust.scale.set(s);
    bust.position.set(win.x + win.w / 2 - face.x * s, win.y + win.h * 0.38 - face.y * s);
  }

  override setTargetable(on: boolean): void {
    super.setTargetable(on);
    this.el.tabIndex = on ? 0 : -1;
  }

  protected override redraw(): void {
    const u = this.unit;
    const el = this.el;
    if (!el) return;
    this.nm.textContent = u.name;
    const hp = Math.max(0, Math.round(u.hp));
    this.hpFill.style.width = `${(this.shownHp * 100).toFixed(2)}%`;
    this.hpGhost.style.width = `${(Math.max(this.shownHp, this.ghost) * 100).toFixed(2)}%`;
    this.hpShield.style.width = `${(Math.min(1, u.shield / Math.max(1, u.maxHp)) * 100).toFixed(2)}%`;
    this.hpNum.innerHTML = `${hp}<small>/${u.maxHp}</small>`;
    this.foFill.style.width = `${((u.focus / Math.max(1, u.maxFocus)) * 100).toFixed(2)}%`;
    const r = u.resource;
    if (r) {
      const studs = r.max <= 10 ? Array.from({ length: r.max }, (_, i) => `<i class="${i < r.value ? "on" : ""}"></i>`).join("") : `<em><i style="width:${((r.value / Math.max(1, r.max)) * 100).toFixed(1)}%"></i></em>`;
      this.res.innerHTML = `<span>${r.name}</span><span class="studs">${studs}</span>`;
    } else this.res.innerHTML = `<span>Focus ${Math.round(u.focus)}</span>`;
    this.sts.innerHTML = u.statuses.slice(0, 5).map((s) => statusChip(s.id, s.stacks, s.turns)).join("");
    el.classList.toggle("on", this.active);
    el.classList.toggle("tgt", this.targetable);
    el.classList.toggle("dead", !u.alive);
    el.classList.toggle("low", u.alive && u.hp / Math.max(1, u.maxHp) < 0.3);
    el.setAttribute("aria-label", `${u.name}: ${hp} of ${u.maxHp} health${this.targetable ? ", choose as target" : ""}`);
    this.alpha = 1;
    this.bust.setGray(u.alive ? 0 : 0.85);
    // The one acting is lit; the others wait a little in shadow.
    this.bust.mesh.tint = this.active || this.targetable || !u.alive ? 0xffffff : 0xc4bbae;
  }

  override update(now: number, dt: number): void {
    super.update(now, dt);
    // A taller lift than the stock card's, and the DOM card follows (lift and shake).
    this.pivot.y = this.lift * 26 * this.k;
    this.el.style.transform = `translate3d(${this.x.toFixed(1)}px, ${(this.y - this.pivot.y).toFixed(1)}px, 0)`;
  }

  override get portraitCentre(): { x: number; y: number } {
    const k = this.k;
    return { x: this.rect.x + this.rect.w / 2, y: this.rect.y + (CARD_WINDOW.y + CARD_WINDOW.h * 0.45) * k - this.pivot.y };
  }
}
