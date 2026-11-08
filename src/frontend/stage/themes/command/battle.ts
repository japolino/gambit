/**
 * The Command theme's fight: a turn-based crawler battle on the same 1980s monitor the scene stands on. The
 * stage's canvas becomes the tube: a royal blue chassis on a rigid 8x8 character grid, with black windows cut
 * into it, each rimmed by one white rule that breaks around a label between chevron caps (the scene's frames).
 *
 *   wide (48 x 30 cells)                         phone (one column)
 *   +-- Foes ------------+-- Party -----+          VIEW, LOG, NEXT, PARTY, COMMAND
 *   | first-person view  | 4 fixed rows |
 *   | (the foes, the     +-- Next ------+
 *   |  place, dithered)  | turn chips   |
 *   +--------------------+-- <actor> ---+
 *   | combat log         | numbered     |
 *   | (scrolls)  > _     | commands     |
 *   +--------------------+--------------+
 *
 * The party is a roster (portrait, name, HP in block cells, Focus, the class resource), the commands a numbered
 * list (keys 1-0, arrows and Enter, Esc to go back; targets are numbered too), and every event the engine plays
 * is typed into the log as it lands. Around the glass is the physical set (./shell.ts); over everything inside
 * the glass, a CRT shader (./crt.ts). The figures, effects, numbers and cut-ins are the stage's own.
 */
import { Container, Graphics, Rectangle, Sprite, Text, TextStyle, Texture, type FederatedPointerEvent } from "pixi.js";
import type { BattleEvent, BattleState } from "../../../../engine/types.js";
import type { BattleStage } from "../../battle/stage.js";
import type { StageLayout, Rect as PxRect } from "../../battle/layout.js";
import { PartyCard } from "../../battle/party-card.js";
import { ActionMenu } from "../../battle/action-menu.js";
import { TimelineStrip } from "../../battle/timeline-strip.js";
import type { DisplayUnit } from "../../battle/display.js";
import type { PuppetFigure } from "../../puppet/puppet-figure.js";
import { STATUS_STYLE } from "../../theme.js";
import type { StageDecor } from "../types.js";
import { BIT } from "../shared.js";
import { drawCorridor } from "../../../scene/themes/command/corridor.js";
import type { PaletteId } from "../../../scene/themes/command/pixels.js";
import { computeGeo, mountShell, type Geo, type Rect } from "./shell.js";
import { CrtFilter } from "./crt.js";

/* ------------------------------- Palette -------------------------------- */

const BLUE = 0x0000aa;
const CYAN = 0x55ffff;
const YEL = 0xffff55;
const WHITE = 0xffffff;
const GREY = 0xaaaaaa;
const DARK = 0x555555;
const LRED = 0xff5555;
const GREEN = 0x55ff55;
const MAG = 0xff55ff;
const RED = 0xaa0000;

/* -------------------------------- Type ---------------------------------- */

const styles = new Map<string, TextStyle>();
/** The 8x8 face at one cell per character. */
function ts(size: number, fill: number): TextStyle {
  const key = `${size}|${fill}`;
  let s = styles.get(key);
  if (!s) {
    s = new TextStyle({ fontFamily: BIT, fontSize: size, fill, lineHeight: size, padding: 2 });
    styles.set(key, s);
  }
  return s;
}
const advances = new Map<number, number>();
/** One character's advance at `size` (the face is monospaced; measured once). */
function adv(size: number): number {
  let a = advances.get(size);
  if (!a) {
    const t = new Text({ text: "0000000000", style: ts(size, WHITE) });
    a = Math.max(1, t.width / 10);
    t.destroy();
    advances.set(size, a);
  }
  return a;
}
/** Truncate to n characters. */
const fit = (s: string, n: number): string => (n <= 0 ? "" : s.length <= n ? s : n <= 1 ? s.slice(0, n) : `${s.slice(0, n - 1)}.`);
const keyOf = (i: number): string => (i < 9 ? String(i + 1) : i === 9 ? "0" : "");
/** Word-wrap to n columns. */
function wrap(s: string, n: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of s.split(/\s+/)) {
    if (!word) continue;
    if (!line) line = word;
    else if (line.length + 1 + word.length <= n) line += ` ${word}`;
    else {
      out.push(line);
      line = word;
    }
    while (line.length > n) {
      out.push(line.slice(0, n));
      line = line.slice(n);
    }
  }
  if (line) out.push(line);
  return out.length ? out : [""];
}

/* ------------------------------- Windows -------------------------------- */

type WinId = "view" | "party" | "order" | "term";
type Wins = Record<WinId, Rect>;
type Plan = { wins: Wins; viewSplit: number; termSplit: number };

/** Party rows: two character rows each, in a fixed block for four whether two or four are fighting (a VRAM region). */
const ROW = 2;
const slotsFor = (n: number) => Math.max(4, Math.min(6, n));
/** Foe rows in the view's foot: two each (name, then HP) for one or two foes, one each beyond. */
const foeRowsFor = (n: number) => (n <= 2 ? 2 * Math.max(1, n) : Math.min(6, n));
const MENU_ROWS = 7;

/**
 * The scene's own split: the view on the left the full height of the tube, its foot a roster of the foes; on the
 * right the party, the turn order in one line, and one terminal where the log scrolls above the commands.
 */
function planFor(geo: Geo, n: number, foes: number): Plan {
  const party = 2 + ROW * slotsFor(n);
  const fr = foeRowsFor(foes);
  if (!geo.tall) {
    const vw = 27;
    const rw = geo.cols - vw;
    const view = { x: 0, y: 0, w: vw, h: geo.rows };
    const term = { x: vw, y: party + 3, w: rw, h: geo.rows - party - 3 };
    return {
      wins: { view, party: { x: vw, y: 0, w: rw, h: party }, order: { x: vw, y: party, w: rw, h: 3 }, term },
      viewSplit: view.h - 2 - fr,
      termSplit: Math.max(3, term.h - 2 - MENU_ROWS),
    };
  }
  const cols = geo.cols;
  const partyH = 2 + ROW * Math.max(3, Math.min(6, n));
  let viewH = Math.max(14, Math.round(geo.rows * 0.4));
  let termH = geo.rows - viewH - partyH - 3;
  if (termH < MENU_ROWS + 5) {
    viewH = Math.max(12, viewH - (MENU_ROWS + 5 - termH));
    termH = geo.rows - viewH - partyH - 3;
  }
  const view = { x: 0, y: 0, w: cols, h: viewH };
  const term = { x: 0, y: viewH + partyH + 3, w: cols, h: termH };
  return {
    wins: { view, party: { x: 0, y: viewH, w: cols, h: partyH }, order: { x: 0, y: viewH + partyH, w: cols, h: 3 }, term },
    viewSplit: view.h - 2 - fr,
    termSplit: Math.max(3, term.h - 2 - MENU_ROWS),
  };
}

/** Rows a..b (window-relative, inclusive) inside a window's side rules, in host pixels. */
function band(geo: Geo, r: Rect, a: number, b: number): PxRect {
  const c = geo.c;
  return { x: geo.glass.x + geo.ox + (r.x + 1) * c, y: geo.glass.y + geo.oy + (r.y + a) * c, w: (r.w - 2) * c, h: (b - a + 1) * c };
}
/** A window's inside (inset one cell), in host pixels. */
const inner = (geo: Geo, r: Rect): PxRect => band(geo, r, 1, r.h - 2);
const uiOf = (geo: Geo) => Math.max(0.8, geo.c / 20);
/** How many foes the fight opened with (the layout runs before the decoration; set when the theme builds). */
const foeCount = { n: 2 };

/** Where everything goes (themes/types.ts layout). */
export function commandLayout(w: number, h: number, partyCount: number): StageLayout {
  const geo = computeGeo(w, h);
  const p = planFor(geo, partyCount, foeCount.n);
  const c = geo.c;
  const ui = uiOf(geo);
  const pic = band(geo, p.wins.view, 1, p.viewSplit - 1);
  const party = inner(geo, p.wins.party);
  const n = Math.max(1, partyCount);
  const cards = Array.from({ length: n }, (_, i) => ({ x: party.x, y: party.y + i * ROW * c, w: party.w, h: ROW * c }));
  // Headroom over the foes for the numbers that rise off them, so they stay inside the view.
  const head = Math.round(Math.min(pic.h * 0.18, 2 * c));
  return {
    w, h, portrait: geo.tall, ui,
    enemyArea: { x: pic.x + c * 0.5, y: pic.y + head, w: pic.w - c, h: pic.h - head },
    floorY: Math.round(pic.y + pic.h - c * 0.4),
    timeline: inner(geo, p.wins.order),
    party,
    cards,
    menu: band(geo, p.wins.term, p.termSplit + 1, p.wins.term.h - 2),
    // The stage's skill ribbon is replaced by a boxed line in the view (Banner, below): its spot is off the glass.
    banner: { x: -10000, y: -10000 },
  };
}

/* ------------------------------ Party row ------------------------------- */

/** Three-letter status tags, as the old rosters packed conditions into a column. */
const STATUS_TAG: Record<string, string> = { bleed: "BLD", burn: "BRN", poison: "PSN", frost: "FRZ", stun: "STN", fear: "FEA", mark: "MRK", vulnerable: "VUL", weaken: "WEK", guarded: "GRD", regen: "REG", haste: "HST", slow: "SLW", taunt: "TNT", silence: "SIL" };

/**
 * One party member as two roster rows, all on the character grid: number, name and HP; then HP in block cells,
 * Focus and the class resource as filled and hollow blocks. The one acting is in inverse video. No portrait: at
 * this size a dithered bust is noise (the old rosters were text).
 */
export class CommandCard extends PartyCard {
  /** 1-based roster number (the decoration sets it). */
  slotNo = 0;
  private rows: Text[] = [];
  private blink = 0;
  private cell = 24;

  get isTargetable(): boolean {
    return this.targetable;
  }

  override place(rect: PxRect, ui: number): void {
    this.rect = rect;
    this.ui = ui;
    this.position.set(rect.x, rect.y);
    const c = (this.cell = Math.max(8, Math.round(rect.h / ROW)));
    this.frame.clear();
    this.portrait.visible = false;
    this.portraitMask.clear();
    this.shade.clear();
    this.nameText.visible = false;
    this.hpText.visible = false;
    this.resText.visible = false;
    for (const t of this.rows) t.destroy();
    this.rows = [0, 1, 2].map(() => {
      const t = new Text({ text: "", style: ts(c, WHITE) });
      this.addChild(t);
      return t;
    });
    this.hitArea = new Rectangle(0, 0, rect.w, rect.h);
    this.redraw();
  }

  protected override redraw(): void {
    if (!this.rows.length) return;
    const u = this.unit;
    const c = this.cell;
    const v = c / 8;
    const a = adv(c);
    const cols = Math.max(8, Math.floor(this.rect.w / a));
    const g = this.info;
    g.clear();
    const dead = !u.alive;
    const low = u.hp / Math.max(1, u.maxHp) < 0.3;
    // Row 0: number and name; HP (or a condition tag) at the right.
    const st = u.statuses[0];
    const right = dead ? "DEAD" : `${Math.max(0, Math.round(u.hp))}${st ? ` ${STATUS_TAG[st.id] ?? st.id.slice(0, 3).toUpperCase()}` : `/${u.maxHp}`}`;
    // The acting member is the inverse row: no marker column, so a ten-letter name still fits.
    const lead = `${this.slotNo || ""} `;
    const name = fit(u.name.toUpperCase(), cols - lead.length - right.length - 1);
    const [r0, r0r, r1] = this.rows as [Text, Text, Text];
    r0.text = `${lead}${name}`;
    r0.style = ts(c, this.active ? 0x000000 : dead ? DARK : WHITE);
    r0.position.set(0, 0);
    r0r.text = right;
    r0r.style = ts(c, this.active ? 0x000000 : dead ? LRED : st ? (STATUS_STYLE[st.id].harmful ? MAG : CYAN) : low ? LRED : WHITE);
    r0r.position.set((cols - right.length) * a, 0);
    // The face fills its cell: the inverse bar reaches a virtual pixel past it so the letters keep an edge.
    if (this.active) g.rect(-c / 8, -c / 8, cols * a + c / 4, c + c / 4).fill({ color: CYAN });
    // Row 1: HP in block cells (the recent loss in yellow), Focus, then the class resource as blocks.
    const res = u.resource;
    const pips = res ? Math.min(res.max, 6) : 0;
    const foc = ` F${String(Math.round(u.focus)).padStart(2, "0")}`;
    const n = Math.max(4, cols - 2 - foc.length - (pips ? pips + 1 : 0));
    const val = Math.max(0, Math.min(1, this.shownHp));
    const ghost = Math.max(val, Math.min(1, this.ghost));
    const x0 = 2 * a;
    for (let i = 0; i < n; i++) {
      const at = (i + 0.5) / n;
      const x = x0 + i * a + v;
      const y = c + v;
      const w = a - 2 * v;
      const h = c - 2 * v;
      if (at <= val && !dead) g.rect(x, y, w, h).fill({ color: low ? LRED : GREEN });
      else if (at <= ghost && !dead) g.rect(x, y, w, h).fill({ color: YEL });
      else g.rect(x + w / 2 - v, y + h / 2 - v, 2 * v, 2 * v).fill({ color: DARK });
    }
    if (u.shield > 0 && !dead) g.rect(x0 + v, c, Math.min(1, u.shield / Math.max(1, u.maxHp)) * n * a - 2 * v, v).fill({ color: CYAN });
    r1.text = foc;
    r1.style = ts(c, dead ? DARK : CYAN);
    r1.position.set(x0 + n * a, c);
    if (res && pips) {
      const px = x0 + (n + foc.length + 1) * a;
      const on = res.max > pips ? Math.round((res.value / res.max) * pips) : res.value;
      for (let i = 0; i < pips; i++) {
        const x = px + i * a;
        if (i < on && !dead) g.rect(x + 2 * v, c + 2 * v, a - 4 * v, c - 4 * v).fill({ color: MAG });
        else g.rect(x + 2 * v, c + 2 * v, a - 4 * v, c - 4 * v).stroke({ width: v, color: DARK, alignment: 1 });
      }
    }
    this.drawMarks();
    this.alpha = 1;
  }

  /** Target brackets (blinking) around the rows. */
  private drawMarks(): void {
    const gl = this.glow;
    gl.clear();
    if (!this.targetable || this.blink % 2) return;
    const c = this.cell;
    const v = c / 8;
    const { w, h } = this.rect;
    const l = c * 0.8;
    for (const [x, y, dx, dy] of [[0, 0, 1, 1], [w, 0, -1, 1], [0, h, 1, -1], [w, h, -1, -1]] as const) {
      gl.rect(x - (dx < 0 ? v : 0), y - (dy < 0 ? v : 0), dx * l, v).fill({ color: YEL });
      gl.rect(x - (dx < 0 ? v : 0), y - (dy < 0 ? v : 0), v, dy * l).fill({ color: YEL });
    }
  }

  override update(now: number, dt: number): void {
    this.now = now;
    this.pivot.y = 0;
    const b = Math.floor(now * 3);
    if (this.targetable && b !== this.blink) {
      this.blink = b;
      this.drawMarks();
    }
    if (now > this.ghostHoldUntil && this.ghost > this.shownHp) {
      this.ghost = Math.max(this.shownHp, this.ghost - dt * 0.9);
      this.redraw();
    }
  }

  override get portraitCentre(): { x: number; y: number } {
    return { x: this.rect.x + this.rect.w * 0.4, y: this.rect.y + this.cell * 0.5 };
  }
}

/* ------------------------------ Commands -------------------------------- */

type Target = { id: string; name: string; hp: string };

/** The numbered command list: skills, then targets, typed like the scene's terminal. */
export class CommandMenu extends ActionMenu {
  /** Hooks the decoration wires up. */
  setLabel: (top: string, bottom: string) => void = () => {};
  targets: () => Target[] = () => [];
  chooseTarget: (id: string) => void = () => {};
  onMode: (kind: "skills" | "target" | "wait") => void = () => {};
  /** Who is acting while the menu waits (the decoration follows the turns). */
  busyName: () => string = () => "";
  private sel = 0;
  private rowsShown: Array<{ run: () => void; enabled: boolean }> = [];
  private cell = 24;

  override place(rect: PxRect, ui: number): void {
    this.rect = rect;
    this.ui = ui;
    this.position.set(rect.x, rect.y);
    this.bg.clear();
    this.render();
  }

  override showSkills(actor: string, skills: Parameters<ActionMenu["showSkills"]>[1]): void {
    const first = this.mode.kind !== "skills" || this.mode.actor !== actor;
    if (first) this.sel = Math.max(0, skills.findIndex((s) => s.usable));
    super.showSkills(actor, skills);
  }

  override showTarget(skill: string, hint: string, confirm: boolean): void {
    this.sel = 0;
    super.showTarget(skill, hint, confirm);
  }

  protected override render(): void {
    for (const ch of this.content.removeChildren()) ch.destroy({ children: true });
    this.rowsShown = [];
    const { w, h } = this.rect;
    // The grid cell is the type size: derive it from the layout's ui (cell = 20 * ui) but keep it whole.
    const c = (this.cell = Math.max(8, Math.round((this.ui * 20) / 8) * 8));
    const rowsFit = Math.max(1, Math.floor(h / c));
    const a = adv(c);
    const cols = Math.max(4, Math.floor(w / a));
    const m = this.mode;
    this.onMode(m.kind);
    const line = (row: number, text: string, color: number, opts: { run?: () => void; enabled?: boolean; key?: string; keyColor?: number; right?: string; rightColor?: number } = {}) => {
      if (row >= rowsFit) return;
      const holder = new Container();
      holder.position.set(0, row * c);
      const idx = opts.run ? this.rowsShown.length : -1;
      const hot = idx >= 0 && idx === this.sel;
      const g = new Graphics();
      if (hot) g.rect(0, 0, cols * a, c).fill({ color: opts.enabled === false ? DARK : WHITE });
      holder.addChild(g);
      const keyW = opts.key !== undefined ? 2 : 0;
      if (opts.key !== undefined) {
        const k = new Text({ text: opts.key, style: ts(c, hot ? BLUE : (opts.keyColor ?? YEL)) });
        holder.addChild(k);
      }
      const rightTxt = opts.right ?? "";
      const body = new Text({ text: fit(text, cols - keyW - (rightTxt ? rightTxt.length + 1 : 0)), style: ts(c, hot ? BLUE : color) });
      body.x = keyW * a;
      holder.addChild(body);
      if (rightTxt) {
        const r = new Text({ text: rightTxt, style: ts(c, hot ? BLUE : (opts.rightColor ?? GREY)) });
        r.x = (cols - rightTxt.length) * a;
        holder.addChild(r);
      }
      if (opts.run) {
        const run = opts.run;
        const enabled = opts.enabled !== false;
        this.rowsShown.push({ run, enabled });
        holder.eventMode = "static";
        holder.cursor = enabled ? "pointer" : "default";
        holder.hitArea = new Rectangle(0, 0, cols * a, c);
        holder.on("pointerover", () => {
          if (this.sel !== idx) {
            this.sel = idx;
            this.render();
          }
        });
        holder.on("pointertap", (e: FederatedPointerEvent) => {
          e.stopPropagation();
          if (enabled) run();
        });
      }
      this.content.addChild(holder);
    };
    if (m.kind === "wait") {
      const who = this.busyName();
      this.setLabel(m.text ? "" : who || "Wait", "");
      if (m.text) wrap(m.text, cols).forEach((t, i) => line(i, t, YEL));
      else wrap(who ? `${who} acts...` : "...", cols).forEach((t, i) => line(i, t, GREY));
      return;
    }
    if (m.kind === "target") {
      this.setLabel(m.skill, "Esc:Back");
      line(0, fit(m.hint, cols), CYAN);
      let row = 1;
      if (m.confirm) {
        line(row++, "Confirm", WHITE, { key: "1", run: () => this.onConfirm() });
      } else {
        const targets = this.targets();
        // A name too long for its row runs on to an indented second row (when the window has the rows for it).
        const roomy = targets.length * 2 + 2 <= rowsFit;
        targets.forEach((t, i) => {
          const avail = cols - 2 - (t.hp ? t.hp.length + 1 : 0);
          const parts = roomy && t.name.length > avail ? wrap(t.name, avail) : [t.name];
          line(row++, parts[0]!, WHITE, { key: keyOf(i), run: () => this.chooseTarget(t.id), right: t.hp, rightColor: GREY });
          if (parts.length > 1) line(row++, fit(`    ${parts.slice(1).join(" ")}`, cols), WHITE);
        });
      }
      line(row, "Back", GREY, { key: "0", keyColor: WHITE, run: () => this.onBack() });
      return;
    }
    const skills = m.skills;
    this.sel = Math.min(this.sel, Math.max(0, skills.length - 1));
    const cur = skills[this.sel];
    this.setLabel(m.actor, cur ? (cur.usable ? cur.cost : (cur.reason ?? "")) : "");
    skills.forEach((s, i) => {
      const cost = s.usable ? shortCost(s.cost) : shortReason(s.reason ?? "");
      // The signature mark gives way when it alone would cut the name (the yellow still marks it while usable).
      const avail = cols - 2 - (cost ? cost.length + 1 : 0);
      const mark = s.signature && !(s.name.length + 1 > avail && s.name.length <= avail) ? "*" : "";
      line(i, `${mark}${s.name}`, !s.usable ? DARK : s.signature ? YEL : WHITE, {
        key: keyOf(i),
        keyColor: s.usable ? YEL : DARK,
        run: () => this.onPick(s.id),
        enabled: s.usable,
        right: cost,
        rightColor: s.usable ? CYAN : LRED,
      });
    });
    const flavor = cur?.flavor;
    if (flavor && skills.length + 2 <= rowsFit) {
      wrap(flavor, cols).slice(0, rowsFit - skills.length - 1).forEach((t, i) => line(skills.length + 1 + i, t, DARK));
    }
  }

  /** Keyboard: digits pick, arrows move the cursor, Enter runs it, Esc goes back. */
  key(e: KeyboardEvent): boolean {
    const m = this.mode;
    if (m.kind === "wait") return false;
    const k = e.key;
    if (k === "Escape" || k === "Backspace") {
      if (m.kind === "target") {
        this.onBack();
        return true;
      }
      return false;
    }
    if (k === "ArrowDown" || k === "ArrowUp") {
      const n = this.rowsShown.length;
      if (!n) return true;
      this.sel = (this.sel + (k === "ArrowDown" ? 1 : -1) + n) % n;
      this.render();
      return true;
    }
    if (k === "Enter" || k === " ") {
      const r = this.rowsShown[this.sel];
      if (r?.enabled) r.run();
      return true;
    }
    if (/^[0-9]$/.test(k)) {
      if (m.kind === "target" && k === "0") {
        this.onBack();
        return true;
      }
      const i = k === "0" ? 9 : Number(k) - 1;
      const r = this.rowsShown[i];
      if (r?.enabled) r.run();
      return !!r;
    }
    return false;
  }
}

/** Why a skill is greyed out, in the cost column: "Ready in 2 turns" -> "CD2", "Needs 3 Tide" -> "3TID". */
function shortReason(reason: string): string {
  let m = /Ready in (\d+)/i.exec(reason);
  if (m) return `CD${m[1]}`;
  m = /Needs (\d+) Focus/i.exec(reason);
  if (m) return `${m[1]}F`;
  m = /Needs (\d+) (\S+)/i.exec(reason);
  if (m) return `${m[1]}${m[2]!.slice(0, 3).toUpperCase()}`;
  if (/silenc/i.test(reason)) return "SIL";
  if (/wounded/i.test(reason)) return "HP";
  if (/no target/i.test(reason)) return "N/T";
  return reason ? "X" : "";
}

/** "10 Focus · CD 2" -> "10F": the right-hand column is a few characters. */
function shortCost(cost: string): string {
  if (/^basic$/i.test(cost)) return "";
  if (/^free$/i.test(cost)) return "";
  const m = /(\d+)\s*Focus/i.exec(cost);
  if (m) return `${m[1]}F`;
  const hp = /(\d+)%\s*HP/i.exec(cost);
  if (hp) return `${hp[1]}%HP`;
  const r = /^(\d+)\s+(\S)/.exec(cost);
  if (r) return `${r[1]}${r[2]!.toUpperCase()}`;
  return "";
}

/* ------------------------------ Turn order ------------------------------ */

/** The next to act as one line of tags (TID > A > WAR > B): the one acting now inverse, the party cyan, foes red. */
export class CommandTimeline extends TimelineStrip {
  /** A short tag for a combatant (the decoration sets it). */
  labelOf: (id: string) => string = (id) => id.slice(0, 3).toUpperCase();
  private line = new Container();
  private last: Array<{ id: string; enemy: boolean; alive: boolean }> = [];

  override place(rect: PxRect, ui: number): void {
    this.rect = rect;
    this.ui = ui;
    this.position.set(rect.x, rect.y);
    this.bg.clear();
    this.title.visible = false;
    if (!this.line.parent) this.addChild(this.line);
    this.paint();
  }

  override set(order: Array<{ id: string; texture: Texture; enemy: boolean; alive: boolean }>): void {
    this.last = order.map((o) => ({ id: o.id, enemy: o.enemy, alive: o.alive }));
    this.paint();
  }

  /** Repaint (after the tags change). */
  paint(): void {
    for (const ch of this.line.removeChildren()) ch.destroy();
    const c = Math.max(8, Math.round(this.rect.h));
    const a = adv(c);
    const cols = Math.floor(this.rect.w / a);
    const g = new Graphics();
    this.line.addChild(g);
    let col = 0;
    let stop = false;
    this.last.forEach((o, i) => {
      if (stop) return;
      const tag = this.labelOf(o.id);
      const need = tag.length + (i ? 1 : 0);
      if (col + need > cols) {
        stop = true;
        return;
      }
      if (i) {
        const sep = new Text({ text: ">", style: ts(c, DARK) });
        sep.x = col * a;
        this.line.addChild(sep);
        col += 1;
      }
      if (i === 0) g.rect(col * a - c / 8, -c / 8, tag.length * a + c / 4, c + c / 4).fill({ color: YEL });
      const t = new Text({ text: tag, style: ts(c, i === 0 ? 0x000000 : !o.alive ? DARK : o.enemy ? LRED : CYAN) });
      t.x = col * a;
      this.line.addChild(t);
      col += tag.length;
    });
  }

  override update(): void {}
}

/* ------------------------------- Chassis -------------------------------- */

/** The blue strap and the black windows with their single white rule and notched labels (../../../scene/themes/command/pixels.ts frameSvg). */
class Chassis extends Container {
  private g = new Graphics();
  private labels = new Container();
  private geo: Geo | null = null;
  private wins: Wins | null = null;
  private text: Partial<Record<WinId, { top: string; bottom: string; topColor?: number }>> = {};
  private splits: Partial<Record<WinId, { row: number; label: string; color: number }>> = {};

  constructor() {
    super();
    this.addChild(this.g, this.labels);
  }

  set(id: WinId, top: string, bottom = "", topColor?: number): void {
    const cur = this.text[id];
    if (cur && cur.top === top && cur.bottom === bottom && cur.topColor === topColor) return;
    this.text[id] = { top, bottom, ...(topColor !== undefined ? { topColor } : {}) };
    this.draw();
  }

  /** A rule across window `id` at its row `row`, with a label in it (a divider between two parts of one window). */
  split(id: WinId, row: number, label: string, color = WHITE): void {
    const cur = this.splits[id];
    if (cur && cur.row === row && cur.label === label && cur.color === color) return;
    this.splits[id] = { row, label, color };
    this.draw();
  }

  layout(geo: Geo, wins: Wins): void {
    this.geo = geo;
    this.wins = wins;
    this.draw();
  }

  private draw(): void {
    const geo = this.geo;
    const wins = this.wins;
    if (!geo || !wins) return;
    const g = this.g;
    g.clear();
    for (const ch of this.labels.removeChildren()) ch.destroy();
    const c = geo.c;
    const v = c / 8;
    const gl = geo.glass;
    g.rect(gl.x, gl.y, gl.w, gl.h).fill({ color: BLUE });
    const ox = gl.x + geo.ox;
    const oy = gl.y + geo.oy;
    const a = adv(c);
    const M = 3;
    for (const id of Object.keys(wins) as WinId[]) {
      const r = wins[id];
      const x = ox + r.x * c;
      const y = oy + r.y * c;
      const W = r.w * c;
      const H = r.h * c;
      g.rect(x + (M + 1) * v, y + (M + 1) * v, W - (2 * M + 2) * v, H - (2 * M + 2) * v).fill({ color: 0x000000 });
      const t = this.text[id];
      const rule = (yy: number, label: string, row: number, color: number) => {
        const shown = fit(label, r.w - 6);
        if (!shown) {
          g.rect(x + M * v, yy, W - 2 * M * v, v).fill({ color: WHITE });
          return;
        }
        const tw = Math.ceil((shown.length * a) / c);
        const tx = Math.floor((r.w - tw) / 2);
        const ax = x + (tx - 1) * c;
        const bx = x + (tx + tw + 1) * c;
        g.rect(x + M * v, yy, ax - (x + M * v), v).fill({ color: WHITE });
        g.rect(bx, yy, x + W - M * v - bx, v).fill({ color: WHITE });
        g.rect(ax, y + row * c, bx - ax, c).fill({ color: 0x000000 });
        const cap: [number, number][] = [[1, 0], [2, 1], [3, 2], [4, 3], [4, 4], [3, 5], [2, 6], [1, 7]];
        for (const [px, py] of cap) {
          g.rect(ax + (px + 1) * v, y + row * c + py * v, v, v).fill({ color: WHITE });
          g.rect(bx - (2 + px) * v, y + row * c + py * v, v, v).fill({ color: WHITE });
        }
        const txt = new Text({ text: shown, style: ts(c, color) });
        txt.position.set(x + tx * c + (tw * c - shown.length * a) / 2, y + row * c);
        this.labels.addChild(txt);
      };
      rule(y + M * v, t?.top ?? "", 0, t?.topColor ?? WHITE);
      const sp = this.splits[id];
      if (sp && sp.row > 0 && sp.row < r.h - 1) rule(y + sp.row * c + 3 * v, sp.label, sp.row, sp.color);
      rule(y + H - (M + 1) * v, t?.bottom ?? "", r.h - 1, GREY);
      g.rect(x + M * v, y + M * v, v, H - 2 * M * v).fill({ color: WHITE });
      g.rect(x + W - (M + 1) * v, y + M * v, v, H - 2 * M * v).fill({ color: WHITE });
    }
  }
}

/* --------------------------------- Log ---------------------------------- */

type LogLine = { text: string; color: number; epoch: number };

/** The scrolling terminal under the view: every event typed in as it plays, older turns fading to grey, a prompt at the foot. */
class Log extends Container {
  private lines: LogLine[] = [];
  private rows: Text[] = [];
  private cursorG = new Graphics();
  private rect: PxRect = { x: 0, y: 0, w: 10, h: 10 };
  private c = 24;
  epoch = 0;
  prompt = "";
  waiting = false;

  constructor() {
    super();
    this.addChild(this.cursorG);
  }

  layout(rect: PxRect, c: number): void {
    this.rect = rect;
    this.c = c;
    this.position.set(rect.x, rect.y);
    for (const t of this.rows) t.destroy();
    const n = Math.max(1, Math.floor(rect.h / c));
    this.rows = Array.from({ length: n }, (_, i) => {
      const t = new Text({ text: "", style: ts(c, GREY) });
      t.y = i * c;
      this.addChild(t);
      return t;
    });
    this.render();
  }

  private cols(): number {
    return Math.max(8, Math.floor(this.rect.w / adv(this.c)) - 2);
  }

  add(text: string, color: number): void {
    this.lines.push({ text, color, epoch: this.epoch });
    if (this.lines.length > 200) this.lines.splice(0, this.lines.length - 200);
    this.render();
  }

  render(): void {
    const n = this.rows.length;
    const cols = this.cols();
    // Wrapped at the window's width as it stands, newest last.
    const wrapped: LogLine[] = [];
    for (let i = this.lines.length - 1; i >= 0 && wrapped.length < n; i--) {
      const l = this.lines[i]!;
      const parts = wrap(l.text, cols);
      for (let j = parts.length - 1; j >= 0; j--) wrapped.unshift({ text: `${j === 0 ? (l.epoch === this.epoch ? ">" : " ") : " "} ${parts[j]}`, color: l.color, epoch: l.epoch });
    }
    const shown = wrapped.slice(-(n - 1));
    const a = adv(this.c);
    this.rows.forEach((t, i) => {
      const l = shown[i];
      if (l) {
        t.text = l.text;
        t.style = ts(this.c, l.epoch === this.epoch ? l.color : l.epoch === this.epoch - 1 ? GREY : DARK);
      } else if (i === shown.length) {
        t.text = `> ${this.prompt}`;
        t.style = ts(this.c, CYAN);
      } else t.text = "";
    });
    const pr = this.rows[Math.min(shown.length, n - 1)];
    this.cursorG.clear();
    if (pr && this.waiting) this.cursorG.rect((2 + this.prompt.length) * a, pr.y, a, this.c - this.c / 8).fill({ color: WHITE });
  }

  blink(on: boolean): void {
    this.cursorG.visible = on;
  }
}

/* ------------------------------ Foe plates ------------------------------ */

/** A name in n characters: whole, else its last words that fit (BELL-DROWNED ACOLYTE -> ACOLYTE), else cut. */
function shortName(s: string, n: number): string {
  if (s.length <= n) return s;
  const words = s.split(/\s+/);
  for (let i = 1; i < words.length; i++) {
    const tail = words.slice(i).join(" ");
    if (tail.length <= n) return tail;
  }
  return fit(s, n);
}

/** Under each foe, in the view's black foot band: a letter and the name cut to its column, then HP in block cells. */
class FoePlates extends Container {
  private sig = "";
  /** The roster in the view's foot (`area`), and a letter over each foe's head. */
  draw(stage: BattleStage, c: number, area: PxRect, pic: PxRect, targets: ReadonlySet<string>): void {
    const foes = stage.state.combatants.filter((x) => x.side === "enemy");
    const parts: string[] = [];
    for (const f of foes) {
      const u = stage.units.get(f.id);
      const v = stage.enemies.get(f.id);
      parts.push(`${f.id}:${u?.hp}:${u?.alive}:${u?.broken}:${u?.name}:${v ? `${Math.round(v.x)},${Math.round(v.topY)}` : ""}:${v?.visible}:${targets.has(f.id)}`);
    }
    const sig = `${c}|${area.x},${area.y},${area.w},${area.h}|${parts.join(";")}`;
    if (sig === this.sig) return;
    this.sig = sig;
    for (const ch of this.removeChildren()) ch.destroy();
    const a = adv(c);
    const vv = c / 8;
    const cols = Math.max(8, Math.floor(area.w / a));
    const two = foes.length <= 2;
    const g = new Graphics();
    this.addChild(g);
    foes.forEach((f, i) => {
      const u = stage.units.get(f.id);
      if (!u) return;
      const letter = String.fromCharCode(65 + i);
      const y = area.y + (two ? 2 * i : i) * c;
      const hpTxt = u.alive ? String(Math.max(0, Math.round(u.hp))) : "DEAD";
      const barOne = Math.min(8, Math.floor(cols / 3));
      const nameCols = two ? cols - 2 - (u.broken && u.alive ? 7 : 0) : cols - 3 - barOne;
      const name = new Text({ text: `${letter} ${shortName(u.name.toUpperCase(), nameCols)}`, style: ts(c, !u.alive ? DARK : u.broken ? YEL : WHITE) });
      name.position.set(area.x, y);
      this.addChild(name);
      if (u.broken && u.alive && two) {
        const tag = new Text({ text: "BROKEN", style: ts(c, 0x000000) });
        tag.position.set(area.x + (cols - 6) * a, y);
        g.rect(tag.x, y, 6 * a, c).fill({ color: YEL });
        this.addChild(tag);
      }
      // HP: block cells then the number (two-row form), or the bar alone at the right (one-row form).
      const barCols = two ? cols - 2 - hpTxt.length - 1 : barOne;
      const bx = two ? area.x + 2 * a : area.x + (cols - barCols) * a;
      const by = two ? y + c : y;
      const val = Math.max(0, Math.min(1, u.hp / Math.max(1, u.maxHp)));
      for (let k = 0; k < barCols; k++) {
        const on = (k + 0.5) / barCols <= val && u.alive;
        const x = bx + k * a + vv;
        if (on) g.rect(x, by + vv, a - 2 * vv, c - 2 * vv).fill({ color: u.broken ? YEL : LRED });
        else g.rect(x + a / 2 - vv, by + c / 2 - vv, 2 * vv, 2 * vv).fill({ color: DARK });
      }
      if (two) {
        const hp = new Text({ text: hpTxt, style: ts(c, u.alive ? GREY : DARK) });
        hp.position.set(area.x + (cols - hpTxt.length) * a, y + c);
        this.addChild(hp);
      }
      // The same letter over the foe, so the roster, the targets and the picture line up.
      const view = stage.enemies.get(f.id);
      if (view && view.visible && u.alive) {
        const tag = new Text({ text: letter, style: ts(c, 0x000000) });
        const tx = Math.round(view.x - a / 2);
        const ty = Math.max(pic.y + vv, Math.round(view.topY - c * 1.1));
        g.rect(tx - vv, ty, a + 2 * vv, c).fill({ color: LRED });
        tag.position.set(tx, ty);
        this.addChild(tag);
        // A foe you can pick gets heavy corner brackets a cell long, on the grid, so they hold against the brick.
        if (targets.has(f.id)) {
          const bottom = pic.y + pic.h - c * 0.5;
          const top = Math.max(pic.y + c * 0.25, ty - c * 0.25);
          const hw = Math.max(c * 2, Math.round(((bottom - top) * 0.3) / a) * a);
          const x0 = Math.max(pic.x + vv, Math.round(view.x - hw));
          const x1 = Math.min(pic.x + pic.w - vv, Math.round(view.x + hw));
          const t = 2 * vv;
          for (const [x, y, dx, dy] of [[x0, top, 1, 1], [x1, top, -1, 1], [x0, bottom, 1, -1], [x1, bottom, -1, -1]] as const) {
            g.rect(dx > 0 ? x : x - c, dy > 0 ? y : y - t, c, t).fill({ color: YEL });
            g.rect(dx > 0 ? x : x - t, dy > 0 ? y : y - c, t, c).fill({ color: YEL });
          }
        }
      }
    });
  }
}

/* ------------------------------- Banner --------------------------------- */

/** Who did what, boxed in a double rule across the foot of the picture, on the grid; gone after a moment. */
class Banner extends Container {
  private until = 0;
  show(text: string, color: number, c: number, area: PxRect, now: number, ms = 1300): void {
    for (const ch of this.removeChildren()) ch.destroy();
    const a = adv(c);
    const v = c / 8;
    const maxCols = Math.max(6, Math.floor(area.w / a));
    const shown = fit(text.toUpperCase(), maxCols - 2);
    const w = (shown.length + 2) * a;
    const x = Math.round(area.x + (area.w - w) / 2);
    // At the foot of the picture: the damage figures rise from the foes' heads at the top.
    const y = Math.round(area.y + area.h - c * 2);
    const g = new Graphics();
    g.rect(x, y - c * 0.5, w, c * 2).fill({ color: 0x000000 });
    for (const inset of [v, v * 3]) g.rect(x + inset, y - c * 0.5 + inset, w - 2 * inset, c * 2 - 2 * inset).stroke({ width: v, color: WHITE, alignment: 1 });
    const t = new Text({ text: shown, style: ts(c, color) });
    t.position.set(x + a, y);
    this.addChild(g, t);
    this.visible = true;
    this.until = now + ms / 1000;
  }
  tick(now: number): void {
    if (this.visible && now > this.until) this.visible = false;
  }
}

/* ------------------------------ Decoration ------------------------------ */

/** A straight corridor, standing at its mouth: the hall a fight with no painted place of its own is fought in. */
const HALL = {
  grid: ["#####", "##.##", "#...#", "#...#", "##.##", "##.##", "##.##", "#####"],
  x: 2, y: 6, facing: 0, keys: 0, rooms: [], view: [], room: null, moves: [], done: false, textures: { wall: "", floor: "" }, name: "",
} as unknown as Parameters<typeof drawCorridor>[1];

/** One step down the palette's grey ramp (white to grey, grey to dark, dark to black): the hall sits back so the foes stand out of it. */
function dim(cv: HTMLCanvasElement): void {
  const g = cv.getContext("2d", { willReadFrequently: true });
  if (!g) return;
  const im = g.getImageData(0, 0, cv.width, cv.height);
  const d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]!, gg = d[i + 1]!, b = d[i + 2]!;
    if (r !== gg || gg !== b) continue;
    const to = r >= 250 ? 170 : r >= 160 ? 85 : 0;
    d[i] = d[i + 1] = d[i + 2] = to;
  }
  g.putImageData(im, 0, 0);
}

/** The colour mode the player set on the monitor (the scene's M key). */
function paletteId(): PaletteId {
  try {
    const p = localStorage.getItem("gambit.command.palette");
    if (p === "cga" || p === "mono" || p === "ega") return p;
  } catch {
    // Storage blocked.
  }
  return "ega";
}

const CARD_KEYS: [string, string][] = [["1-0", "command"], ["ARROWS", "select"], ["ENTER", "confirm"], ["ESC", "back"], ["TAP", "target"]];
const BEZEL_KEYS: [string, string][] = [["J", "JOURNAL"], ["C", "CLASSES"], ["T", "DISKS"], ["M", "EGA"]];

const nameOf = (stage: BattleStage, id: string): string => stage.units.get(id)?.name ?? stage.state.combatants.find((c) => c.id === id)?.name ?? "?";
const isParty = (stage: BattleStage, id: string): boolean => (stage.units.get(id)?.side ?? stage.state.combatants.find((c) => c.id === id)?.side) === "party";

const TALK_WORDS = { surrender: "Yield!", bargain: "Name your price.", recruit: "Join us.", taunt: "Over here!", deceive: "A ruse..." } as const;
const LEAVE_WORDS = { surrender: "surrenders", bargain: "takes the coin and goes", recruit: "joins you", taunt: "withdraws", deceive: "is gone" } as const;

/** One engine event as a log line (or none). */
function lineFor(stage: BattleStage, ev: BattleEvent): [string, number] | null {
  const n = (id: string) => nameOf(stage, id);
  switch (ev.kind) {
    case "use":
      return [`${n(ev.actor)}: ${ev.name}!`, isParty(stage, ev.actor) ? CYAN : LRED];
    case "hit":
      if (ev.absorbed) return [`${n(ev.target)} drinks it in.`, GREEN];
      if (ev.amount === 0 && ev.shieldTaken > 0) return [`${n(ev.target)} blocks ${ev.shieldTaken}.`, CYAN];
      return [`${n(ev.target)} takes ${ev.amount}${ev.crit ? ", critical" : ""}${ev.weak ? ", weak spot" : ""}${ev.resisted ? ", resisted" : ""}.`, ev.crit ? YEL : isParty(stage, ev.target) ? LRED : WHITE];
    case "miss":
      return [`${n(ev.source)} misses ${n(ev.target)}.`, GREY];
    case "heal":
      return [`${n(ev.target)} heals ${ev.amount}.`, GREEN];
    case "shield":
      return [`${n(ev.target)} is warded for ${ev.amount}.`, CYAN];
    case "status_on": {
      const s = STATUS_STYLE[ev.status];
      return [`${n(ev.target)}: ${s.label}${ev.stacks > 1 ? ` x${ev.stacks}` : ""}.`, s.harmful ? MAG : CYAN];
    }
    case "status_tick": {
      const s = STATUS_STYLE[ev.status];
      return [`${s.label}: ${n(ev.target)} ${ev.status === "regen" ? "+" : "-"}${ev.amount}.`, ev.status === "regen" ? GREEN : MAG];
    }
    case "status_off":
      return null;
    case "break":
      return [`${n(ev.target)} is BROKEN!`, YEL];
    case "recover":
      return [`${n(ev.target)} recovers.`, GREY];
    case "delay":
      return [`${n(ev.target)} is ${ev.amount >= 0 ? "delayed" : "hastened"}.`, GREY];
    case "skip":
      return [`${n(ev.actor)} is ${ev.reason === "broken" ? "broken" : ev.reason === "stun" ? "stunned" : "frozen in fear"}.`, GREY];
    case "phase":
      return [`${n(ev.target)} becomes ${ev.name}!`, MAG];
    case "defeat":
      return isParty(stage, ev.target) ? [`${n(ev.target)} falls!`, LRED] : [`${n(ev.target)} is slain!`, YEL];
    case "passive":
      return [`${n(ev.actor)}: ${ev.name}.`, GREY];
    case "talk":
      return [`${n(ev.actor)}: "${TALK_WORDS[ev.option]}" (${ev.chance}%) ${ev.ok ? "It works." : "Refused."}`, ev.ok ? GREEN : GREY];
    case "leave":
      return [`${n(ev.target)} ${LEAVE_WORDS[ev.how]}.`, YEL];
    case "end":
      return [ev.outcome === "victory" ? "*** VICTORY ***" : ev.outcome === "defeat" ? "*** THE PARTY HAS FALLEN ***" : "*** WITHDRAWN ***", ev.outcome === "victory" ? YEL : LRED];
    default:
      return null;
  }
}

export function decorateCommand(stage: BattleStage): StageDecor {
  const app = stage.app;
  const canvas = app.canvas as HTMLCanvasElement;
  const host = canvas.parentElement as HTMLElement;
  // The canvas becomes the screen between the room (behind) and the housing and desk props (in front).
  canvas.style.position = "relative";
  canvas.style.zIndex = "1";
  const shell = mountShell(host, { drive: "Command", card: CARD_KEYS, keys: BEZEL_KEYS });
  // The see-through backdrop keeps the canvas clear outside the glass; the plate comes back, inside the view only.
  stage.back.visible = true;
  stage.bgShade.visible = false;

  const foes = stage.state.combatants.filter((c) => c.side === "enemy");
  const foeIds = foes.map((c) => c.id);
  foeCount.n = foes.length;
  const partyIds = stage.state.combatants.filter((c) => c.side === "party").map((c) => c.id);

  const tube = new Container();
  const chassis = new Chassis();
  const view = new Container();
  const viewMask = new Graphics();
  const log = new Log();
  const banner = new Banner();
  banner.visible = false;
  const crt = new CrtFilter();
  app.stage.addChildAt(tube, 0);
  tube.addChild(chassis, view, viewMask);
  view.addChild(stage.back, stage.field);
  view.mask = viewMask;
  tube.addChild(log, stage.hud, stage.fxLayer, banner, stage.floatLayer, stage.flash, stage.cutLayer);
  tube.filters = [crt];

  // With no painting of the place to fight in, the fight happens where crawlers fought: down a brick corridor.
  const corridor = stage.state.meta?.backdrop ? null : new Sprite();
  if (corridor) {
    stage.back.visible = false;
    view.addChildAt(corridor, 0);
  }
  let corridorKey = "";
  const drawHall = (geo: Geo, r: PxRect) => {
    if (!corridor) return;
    const v = geo.c / 8;
    const W = Math.max(8, Math.round(r.w / v));
    const H = Math.max(8, Math.round(r.h / v));
    const key = `${W}x${H}`;
    if (key !== corridorKey) {
      corridorKey = key;
      const cv = document.createElement("canvas");
      cv.width = W;
      cv.height = H;
      drawCorridor(cv, HALL, paletteId());
      dim(cv);
      const old = corridor.texture;
      const tex = Texture.from(cv);
      tex.source.scaleMode = "nearest";
      corridor.texture = tex;
      if (old && old !== Texture.EMPTY) old.destroy(true);
    }
    corridor.position.set(r.x, r.y);
    corridor.scale.set(r.w / W, r.h / H);
  };
  // The foes' roster in the view's foot, under a divider, and a letter over each foe.
  const foePlates = new FoePlates();
  tube.addChildAt(foePlates, tube.getChildIndex(log));

  const menu = stage.menu;
  const timeline = stage.timeline;
  let geo = shell.geo;
  let plan = planFor(geo, partyIds.length, foes.length);
  const targetable = new Set<string>();
  for (const [id, v] of stage.enemies) {
    const orig = v.setTargetable.bind(v);
    v.setTargetable = (on: boolean) => {
      if (on) targetable.add(id);
      else targetable.delete(id);
      orig(on);
    };
  }
  partyIds.forEach((id, i) => {
    const card = stage.cards.get(id);
    if (card instanceof CommandCard) card.slotNo = i + 1;
  });
  const letterOf = (id: string) => {
    const i = foeIds.indexOf(id);
    return i >= 0 ? String.fromCharCode(65 + i) : "";
  };
  if (timeline instanceof CommandTimeline) {
    timeline.labelOf = (id) => letterOf(id) || nameOf(stage, id).replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
    timeline.paint();
  }
  let acting = "";
  let turn = stage.state.turn;
  if (menu instanceof CommandMenu) {
    menu.setLabel = (top) => chassis.split("term", plan.termSplit, top, YEL);
    menu.targets = () => {
      const out: Target[] = [];
      for (const c of stage.state.combatants) {
        const u = stage.units.get(c.id);
        const card = stage.cards.get(c.id);
        const on = targetable.has(c.id) || (card instanceof CommandCard && card.isTargetable);
        const l = letterOf(c.id);
        // The roster beside it shows the foes' HP: the list keeps the whole name instead.
        if (on && u) out.push({ id: c.id, name: l ? `${l} ${u.name}` : u.name, hp: l ? "" : `${Math.max(0, Math.round(u.hp))}` });
      }
      return out;
    };
    menu.chooseTarget = (id) => {
      const t = stage.enemies.get(id) ?? stage.cards.get(id);
      t?.emit("pointertap", { stopPropagation() {} } as unknown as FederatedPointerEvent);
    };
    menu.busyName = () => acting;
    menu.onMode = (kind) => {
      shell.busy(kind === "wait" && stage.state.outcome === "ongoing");
      const waiting = kind !== "wait";
      // A new page of the log starts when an order is given: what the foes did since stays lit while you choose.
      if (!waiting && log.waiting) log.epoch++;
      log.waiting = waiting;
      log.prompt = "";
      log.render();
    };
  }

  // Window labels.
  const kinds = [...new Set(foes.map((f) => f.name))];
  const foeTitle = kinds.length === 1 ? (foes.length > 1 ? `${foes.length} x ${kinds[0]}` : kinds[0]!) : `${foes.length} Foes`;
  const setTitles = () => {
    chassis.set("view", `${foeTitle} - Turn ${Math.max(1, turn)}`, "", LRED);
    chassis.set("party", "Party");
    chassis.set("order", "Order");
    chassis.set("term", "");
  };
  setTitles();
  log.add(`${foes.length > 1 ? `${foes.length} foes bar` : `${foes[0]?.name ?? "A foe"} bars`} the way!`, YEL);

  const pic = () => band(geo, plan.wins.view, 1, plan.viewSplit - 1);
  function relayout(w: number, h: number): void {
    geo = shell.layout(w, h);
    plan = planFor(geo, partyIds.length, foes.length);
    chassis.layout(geo, plan.wins);
    chassis.split("view", plan.viewSplit, "Foes", LRED);
    const vr = pic();
    viewMask.clear().rect(vr.x, vr.y, vr.w, vr.h).fill({ color: 0xffffff });
    drawHall(geo, vr);
    log.layout(band(geo, plan.wins.term, 1, plan.termSplit - 1), geo.c);
    tube.filterArea = new Rectangle(geo.glass.x, geo.glass.y, geo.glass.w, geo.glass.h);
    crt.set(geo.glass, geo.c / 8, !geo.tall);
    if (menu instanceof CommandMenu) menu.place(stage.layout.menu, stage.layout.ui);
  }

  const onMove = (e: PointerEvent) => {
    if (stage.reduced) return;
    const r = host.getBoundingClientRect();
    shell.parallax(((e.clientX - r.left) / Math.max(1, r.width) - 0.5) * 2, ((e.clientY - r.top) / Math.max(1, r.height) - 0.5) * 2);
  };
  host.addEventListener("pointermove", onMove);
  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    if (!host.isConnected || !host.offsetParent || e.ctrlKey || e.metaKey || e.altKey) return;
    if (menu instanceof CommandMenu && menu.key(e)) e.preventDefault();
  };
  window.addEventListener("keydown", onKey);

  // The layout ran before the foes were counted: lay the stage out again now that the foot roster's size is known.
  stage.resize(app.screen.width, app.screen.height);
  relayout(app.screen.width, app.screen.height);
  let now = 0;
  return {
    resize(w, h) {
      relayout(w, h);
    },
    update(t) {
      now = t;
      log.blink(stage.reduced || Math.floor(t * 2) % 2 === 0);
      banner.tick(t);
      foePlates.draw(stage, geo.c, band(geo, plan.wins.view, plan.viewSplit + 1, plan.wins.view.h - 2), pic(), targetable);
    },
    event(ev: BattleEvent, _state: BattleState) {
      if (ev.kind === "turn") {
        turn = ev.turn;
        acting = nameOf(stage, ev.actor);
        setTitles();
        return;
      }
      if (ev.kind === "use") {
        const party = isParty(stage, ev.actor);
        banner.show(`${nameOf(stage, ev.actor)}: ${ev.name}`, party ? CYAN : LRED, geo.c, pic(), now, stage.reduced ? 900 : 1300);
      }
      if (ev.kind === "phase") banner.show(`${nameOf(stage, ev.target)} becomes ${ev.name}`, MAG, geo.c, pic(), now, 1600);
      const l = lineFor(stage, ev);
      if (l) log.add(l[0], l[1]);
    },
    destroy() {
      host.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", onKey);
      shell.destroy();
    },
  };
}
