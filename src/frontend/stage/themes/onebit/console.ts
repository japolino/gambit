/**
 * The 1-bit battle console: the whole fight's interface painted into ONE low-resolution frame buffer (the
 * scene's own, ../../../scene/themes/onebit/fb.ts, with its bitmap face), shown over the stage as a single
 * nearest-neighbour sprite. The stage's art shader is set to the same cell, so the dithered enemies, the
 * party's dithered faces, the window chrome, the bars and every letter share one pixel grid.
 *
 * What it paints, in the scene's own workstation:
 *  - BATTLE, the viewport: a hole in the buffer where the place and the enemies show through, sunk in a
 *    dithered vignette that falls to pure black at the foot, where numbered plates (name, cell bar, poise,
 *    statuses) float; the last lines of the fight are captioned over the picture, the way an old crawler
 *    printed its battle messages; targeting draws four hard corner brackets round a figure.
 *  - CHRONICLE: the fight as sentences (from the engine's events as they play).
 *  - PARTY: one row per member, the bust in a square window, name, HP and Focus as cell bars with numbers,
 *    the class resource as diamonds, statuses as knocked-out tags; inverse video for whoever is acting.
 *  - COMMAND: WHAT NOW? with a solid block cursor, the skills as a numbered list (costs right-aligned,
 *    unusable ones marked and their reason given); targeting turns it into WHICH ONE? with the targets listed.
 *  - The function-key strip: the turn order.
 * Invisible buttons over everything drawn as a control (the scene's way), so mouse, touch, keyboard and
 * screen readers all reach it; digits, arrows, Enter and Esc work as in the scene.
 */
import { Sprite, Texture, type Container } from "pixi.js";
import type { BattleEvent, BattleState } from "../../../../engine/types.js";
import type { BattleStage } from "../../battle/stage.js";
import type { EnemyView } from "../../battle/enemy-view.js";
import type { DisplayUnit } from "../../battle/display.js";
import { PostFilter } from "../../post-filter.js";
import { SKIN } from "../../skin.js";
import { STATUS_STYLE } from "../../theme.js";
import type { StageDecor } from "../types.js";
import { Frame, INK, PAPER, bayer, type Rect } from "../../../scene/themes/onebit/fb.js";
import { loadFont, wrap, type BitFont } from "../../../scene/themes/onebit/font.js";
import { inner, pillarW, type ObLayout, type ObStageLayout } from "./layout.js";
import { ObCard, ObMenu, ObOrder, dirty } from "./hud.js";
import { MoatFilter } from "./moat.js";

/** See-through: the stage (place, figures, portraits) shows where the buffer holds this. */
const HOLE = 3;
/** The message strip at the top of the viewport (virtual px; ./layout.ts capTop keeps the figures below it). */
const capH = (tall: boolean) => (tall ? 35 : 24);
const C_INK = 0xff070708;
const C_PAPER = 0xffe6eef0;

const GLASS = [
  ["#######", "#.....#", ".#####.", "..###..", "...#...", "..#.#..", ".#...#.", "#.....#", "#######"],
  ["#######", "#.....#", ".#...#.", "..#.#..", "...#...", "..###..", ".#####.", "#.....#", "#######"],
];

const ABBR: Record<string, string> = {
  bleed: "BLD", burn: "BRN", poison: "PSN", frost: "FRZ", stun: "STN", fear: "FEAR", mark: "MRK", vulnerable: "VUL",
  weaken: "WKN", guarded: "GRD", regen: "RGN", haste: "HST", slow: "SLW", taunt: "TNT", silence: "SIL",
};

const STATE_WORD: Record<string, string> = {
  bleed: "bleeding", burn: "burning", poison: "poisoned", frost: "frozen", stun: "stunned", fear: "afraid", mark: "marked",
  vulnerable: "exposed", weaken: "weakened", guarded: "on guard", regen: "regenerating", haste: "hastened", slow: "slowed",
  taunt: "taunting", silence: "silenced",
};

interface Hit {
  key: string;
  r: Rect;
  label: string;
  run: () => void;
}

interface Item {
  key: string;
  num: string;
  label: string;
  right: string;
  note?: string;
  enabled: boolean;
  sig?: boolean;
  run: () => void;
  aria: string;
}

const clip = (t: string, n: number) => (t.length > n ? t.slice(0, Math.max(1, n - 1)) + "." : t);
const short = (name: string) => name.toUpperCase();

export function decorateConsole(stage: BattleStage): StageDecor {
  const reduced = () => stage.reduced;
  let L: ObLayout = (stage.layout as ObStageLayout).ob;
  let font: BitFont | null = null;
  let fb = new Frame(L.W, L.H);
  let canvas = document.createElement("canvas");
  let g2 = canvas.getContext("2d")!;
  let img: ImageData | null = null;
  let tex: Texture | null = null;
  const sprite = new Sprite();
  sprite.roundPixels = true;
  stage.hud.addChildAt(sprite, 0);
  // A soft light behind the figures (inside the place's layer, so the place's dither prints it): the vault
  // above their heads reads lit, and the ink moat around their hoods shows against it.
  const glowCv = document.createElement("canvas");
  glowCv.width = glowCv.height = 128;
  const gg = glowCv.getContext("2d")!;
  const grad = gg.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,0.34)");
  grad.addColorStop(0.6, "rgba(255,255,255,0.14)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  gg.fillStyle = grad;
  gg.fillRect(0, 0, 128, 128);
  const glowTex = Texture.from(glowCv);
  const glow = new Sprite(glowTex);
  glow.blendMode = "add";
  stage.back.addChild(glow);
  let desk = new Uint8Array(0);
  let vig = new Uint8Array(0);

  let time = 0;
  let isDirty = true;
  let tick = -1;
  let sig = "";
  let hover: string | null = null;
  let focus: string | null = null;
  let cursor = 0;
  let cursorMode = "";
  let flash: { key: string; t: number } | null = null;
  const rowFlash = new Map<string, number>();
  let turn = 0;
  let endTitle: string | null = null;
  let logOpen = false;
  const toggleLog = () => { logOpen = !logOpen; isDirty = true; };
  const log: string[] = [];
  let caption: string[] = [];
  let captionAt = -99;
  let hits: Hit[] = [];
  let hitSig = "";
  dirty.fn = () => { isDirty = true; };

  const menu = stage.menu as ObMenu;
  const order = stage.timeline as ObOrder;
  const cards = () => [...stage.cards.values()] as ObCard[];
  const name = (id: string) => stage.units.get(id)?.name ?? stage.state.combatants.find((c) => c.id === id)?.name ?? "Someone";
  const enemyIds = () => [...stage.enemies.keys()];
  const enemyNo = (id: string) => enemyIds().indexOf(id) + 1;
  const allyNo = (id: string) => "ABCDEFG"[[...stage.cards.keys()].indexOf(id)] ?? "?";

  /* ----------------------------- The stage's own parts ----------------------------- */
  // The plates, brackets, markers and soft shadows the stage draws are not on the grid: the console draws its own.
  // Each figure cut out of the place by an ink moat (as the scene's people are), then put on the grid.
  const moat = new MoatFilter();
  const quiet = (v: EnemyView) => {
    for (const k of ["plate", "brackets", "marker", "shadow"] as const) (v[k] as Container).renderable = false;
    const art = (stage as unknown as { post?: PostFilter | null }).post;
    if (art && v.body.filters?.[0] !== moat) v.body.filters = [moat, art];
  };
  for (const v of stage.enemies.values()) quiet(v);
  stage.bgShade.visible = false;
  // Numbers, labels and the screen flash go through the same two-tone shader, on the same cell.
  const post = SKIN.post!;
  const numbers = new PostFilter(post, 1);
  stage.floatLayer.filters = [numbers];
  stage.flash.filters = [numbers];
  // The fight's plaques become captions in the viewport; the end title a window.
  stage.floaters.banner = async (_x, _y, _title, _sub, _accent, ms = 900) => { await stage.clock.wait(ms + 360); };
  stage.floaters.endBanner = async () => { await stage.clock.wait(500); };

  /* ---------------------------------- DOM layer ---------------------------------- */
  const host = (stage.app.canvas as HTMLCanvasElement).parentElement;
  const layer = document.createElement("div");
  layer.setAttribute("role", "group");
  layer.setAttribute("aria-label", "Battle");
  layer.style.cssText = "position:absolute;inset:0;pointer-events:none;";
  const live = document.createElement("div");
  live.setAttribute("aria-live", "polite");
  live.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;";
  layer.append(live);
  host?.append(layer);
  const buttons = new Map<string, HTMLButtonElement>();
  const keyOf = (e: Event) => ((e.target as HTMLElement).closest?.("[data-key]") as HTMLElement | null)?.dataset.key ?? null;
  layer.addEventListener("click", (e) => {
    const k = keyOf(e);
    hits.find((h) => h.key === k)?.run();
  });
  layer.addEventListener("pointerover", (e) => { const k = keyOf(e); if (k !== hover) { hover = k; isDirty = true; } });
  layer.addEventListener("pointerout", (e) => { if (keyOf(e) === hover) { hover = null; isDirty = true; } });
  layer.addEventListener("focusin", (e) => { focus = keyOf(e); isDirty = true; });
  layer.addEventListener("focusout", () => { focus = null; isDirty = true; });

  function syncHits(): void {
    const u = L.u;
    const s = hits.map((h) => `${h.key}@${h.r.x},${h.r.y},${h.r.w},${h.r.h}|${h.label}`).join(";") + `|${u}`;
    if (s === hitSig) return;
    hitSig = s;
    const keep = new Set(hits.map((h) => h.key));
    for (const [k, el] of buttons) if (!keep.has(k)) { el.remove(); buttons.delete(k); }
    let prev: ChildNode | null = live;
    for (const h of hits) {
      let el = buttons.get(h.key);
      if (!el) {
        el = document.createElement("button");
        el.type = "button";
        el.dataset.key = h.key;
        el.style.cssText = "position:absolute;margin:0;padding:0;border:0;background:transparent;color:transparent;font-size:0;cursor:pointer;outline:none;pointer-events:auto;-webkit-tap-highlight-color:transparent;";
        buttons.set(h.key, el);
      }
      el.style.left = `${h.r.x * u}px`;
      el.style.top = `${h.r.y * u}px`;
      el.style.width = `${h.r.w * u}px`;
      el.style.height = `${h.r.h * u}px`;
      el.setAttribute("aria-label", h.label);
      const want: ChildNode | null = prev ? prev.nextSibling : layer.firstChild;
      if (el !== want) layer.insertBefore(el, want);
      prev = el;
    }
  }

  /* ----------------------------------- Input ----------------------------------- */
  const press = (key: string, run: () => void) => {
    flash = { key, t: time };
    isDirty = true;
    run();
  };
  const tapEnemy = (id: string) => stage.enemies.get(id)?.emit("pointertap", { stopPropagation() {} } as never);
  const tapCard = (id: string) => stage.cards.get(id)?.emit("pointertap", { stopPropagation() {} } as never);

  function items(): { prompt: string; tag: string; note: string; list: Item[]; busy: boolean; wait: string } {
    const m = menu.current;
    if (m.kind === "skills") {
      const list: Item[] = m.skills.map((s, i) => {
        const num = i < 9 ? `${i + 1}` : " ";
        const cost = s.cost.replace(/Focus/g, "FP").replace(/ · /g, " ").toUpperCase();
        return {
          key: `skill:${s.id}`, num: s.usable ? num : "×", label: s.name.toUpperCase(), right: s.usable ? cost : "", note: s.usable ? undefined : (s.reason ?? "Not now"),
          enabled: s.usable, sig: s.signature, run: () => menu.onPick(s.id),
          aria: `${s.name}${s.usable ? `, ${s.cost}` : `, unavailable: ${s.reason ?? ""}`}`,
        };
      });
      return { prompt: "WHAT NOW?", tag: short(m.actor), note: "", list, busy: false, wait: "" };
    }
    if (m.kind === "target") {
      const back: Item = { key: "back", num: "ESC", label: "BACK", right: "", enabled: true, run: () => menu.onBack(), aria: "Back" };
      if (m.confirm) {
        const ok: Item = { key: "confirm", num: "↵", label: "CONFIRM", right: "", enabled: true, run: () => menu.onConfirm(), aria: `Confirm ${m.skill}` };
        return { prompt: "CONFIRM?", tag: m.skill.toUpperCase(), note: m.hint, list: [ok, back], busy: false, wait: "" };
      }
      const list: Item[] = [];
      for (const [id, v] of stage.enemies) {
        if (!v["targetable"]) continue;
        const u = stage.units.get(id);
        list.push({ key: `t:${id}`, num: `${enemyNo(id)}`, label: name(id).toUpperCase(), right: u ? `${Math.round((u.hp / Math.max(1, u.maxHp)) * 100)}%` : "", enabled: true, run: () => tapEnemy(id), aria: `Target ${name(id)}` });
      }
      for (const c of cards()) {
        if (!c.state.targetable) continue;
        const u = c.state.unit;
        list.push({ key: `t:${c.id}`, num: allyNo(c.id), label: u.name.toUpperCase(), right: `${Math.max(0, Math.round(u.hp))}HP`, enabled: true, run: () => tapCard(c.id), aria: `Target ${u.name}` });
      }
      list.push(back);
      return { prompt: "WHICH ONE?", tag: m.skill.toUpperCase(), note: "", list, busy: false, wait: "" };
    }
    return { prompt: "", tag: "", note: "", list: [], busy: m.text === "", wait: m.text };
  }

  /** The key of the command row the bar is on (the pointer or focus first), as paintCmd highlights it. */
  function selection(): string | null {
    const it = items();
    const enabled = it.list.filter((x) => x.enabled);
    const mode = `${menu.current.kind}:${it.tag}`;
    if (mode !== cursorMode) { cursorMode = mode; cursor = 0; }
    if (cursor >= enabled.length) cursor = 0;
    if (hover && (hover.startsWith("t:") || enabled.some((x) => x.key === hover))) return hover;
    if (focus && (focus.startsWith("t:") || enabled.some((x) => x.key === focus))) return focus;
    return enabled[cursor]?.key ?? null;
  }

  function onKey(e: KeyboardEvent): void {
    if (!layer.isConnected || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (t && t.tagName === "BUTTON" && !layer.contains(t)) return;
    const k = e.key;
    if (k === "F1" || (logOpen && k === "Escape")) {
      e.preventDefault();
      press("log", toggleLog);
      return;
    }
    const it = items();
    const list = it.list.filter((x) => x.enabled);
    if (!list.length) return;
    let hit: Item | undefined;
    if (k === "ArrowDown" || k === "ArrowUp") {
      cursor = (cursor + (k === "ArrowDown" ? 1 : list.length - 1)) % list.length;
      hover = null;
      isDirty = true;
      e.preventDefault();
      return;
    }
    if (k === "Enter" || k === " ") {
      if (t && layer.contains(t)) return;
      hit = list[Math.min(cursor, list.length - 1)];
    } else if (k === "Escape" || k === "Backspace") hit = list.find((x) => x.key === "back");
    else if (/^[1-9]$/.test(k)) hit = list.find((x) => x.num === k);
    else if (/^[a-g]$/i.test(k)) hit = list.find((x) => x.num === k.toUpperCase());
    if (hit) {
      e.preventDefault();
      press(hit.key, hit.run);
    }
  }
  window.addEventListener("keydown", onKey);

  /* ---------------------------------- Narration ---------------------------------- */
  const say = (line: string, cap = true) => {
    log.push(line);
    if (log.length > 60) log.splice(0, log.length - 60);
    if (cap) { caption.push(line); captionAt = time; }
    if (caption.length > 3) caption.splice(0, caption.length - 3);
    live.textContent = line;
    isDirty = true;
  };
  /** Shorter forms of long messages, for a message strip too narrow for the whole line (the log keeps it whole). */
  const shortOf = new Map<string, string>();
  const foes = stage.state.combatants.filter((c) => c.side === "enemy").map((c) => c.name);
  if (foes.length > 1) shortOf.set(`${foes.slice(0, -1).join(", ")} and ${foes[foes.length - 1]} draw near!`, `${foes.length} foes draw near!`);
  say(foes.length > 1 ? `${foes.slice(0, -1).join(", ")} and ${foes[foes.length - 1]} draw near!` : `${foes[0] ?? "Something"} draws near!`);

  function event(ev: BattleEvent, final: BattleState): void {
    const n = (id: string) => stage.units.get(id)?.name ?? final.combatants.find((c) => c.id === id)?.name ?? "Someone";
    switch (ev.kind) {
      case "turn":
        turn = ev.turn;
        isDirty = true;
        return;
      case "use":
        caption = [];
        say(`${n(ev.actor)} uses ${ev.name}!`);
        return;
      case "hit": {
        rowFlash.set(ev.target, time);
        if (ev.absorbed) say(`${n(ev.target)} drinks it in.`);
        else if (ev.shieldTaken > 0 && ev.amount === 0) say(`${n(ev.target)}'s guard holds (${ev.shieldTaken}).`);
        else say(`${ev.crit ? "Critical! " : ""}${n(ev.target)} takes ${ev.amount}${ev.weak ? ", a weak spot" : ev.resisted ? ", resisted" : ""}.`);
        return;
      }
      case "miss": say(`It misses ${n(ev.target)}.`); return;
      case "heal": rowFlash.set(ev.target, time); say(`${n(ev.target)} recovers ${ev.amount} HP.`); return;
      case "shield": say(`${n(ev.target)} gains a guard of ${ev.amount}.`); return;
      case "status_on": say(`${n(ev.target)} is ${STATE_WORD[ev.status] ?? STATUS_STYLE[ev.status].label.toLowerCase()}.`); return;
      case "status_tick":
        say(ev.status === "regen" ? `${n(ev.target)} regains ${ev.amount}.` : `${n(ev.target)} suffers ${ev.amount} (${STATUS_STYLE[ev.status].label.toLowerCase()}).`);
        return;
      case "break": say(`${n(ev.target)} is BROKEN!`); return;
      case "recover": say(`${n(ev.target)} steadies.`); return;
      case "delay": say(`${n(ev.target)} is ${ev.amount >= 0 ? "delayed" : "hastened"}.`); return;
      case "skip": say(`${n(ev.actor)} ${ev.reason === "broken" ? "is broken" : ev.reason === "stun" ? "is stunned" : "freezes in fear"} and loses the turn.`); return;
      case "phase": caption = []; say(`${n(ev.target)} becomes ${ev.name}!`); return;
      case "defeat": say(stage.enemies.has(ev.target) ? `${n(ev.target)} is defeated.` : `${n(ev.target)} falls!`); return;
      case "passive": say(`${n(ev.actor)}: ${ev.name}.`); return;
      case "talk": {
        const words: Record<string, string> = { surrender: "Yield!", bargain: "Name your price.", recruit: "Join us.", taunt: "Over here!", deceive: "A ruse..." };
        caption = [];
        say(`${n(ev.actor)}: "${words[ev.option] ?? "..."}" (${ev.chance}%)`);
        say(ev.ok ? "It works." : "Refused.");
        return;
      }
      case "leave": say(`${n(ev.target)} ${ev.how === "surrender" ? "surrenders" : ev.how === "bargain" ? "takes the coin and goes" : "joins you"}.`); return;
      case "end":
        endTitle = ev.outcome === "victory" ? "VICTORY" : ev.outcome === "defeat" ? "DEFEAT" : "WITHDRAWN";
        say(ev.outcome === "victory" ? "The way is clear." : ev.outcome === "defeat" ? "The party has fallen." : "You slip away.");
        return;
    }
  }

  /* ------------------------------------ Sizing ------------------------------------ */
  function size(): void {
    L = (stage.layout as ObStageLayout).ob;
    const u = L.u;
    if (!tex || fb.w !== L.W || fb.h !== L.H) {
      fb = new Frame(L.W, L.H);
      canvas = document.createElement("canvas");
      canvas.width = L.W;
      canvas.height = L.H;
      g2 = canvas.getContext("2d")!;
      img = null;
      tex?.destroy(true);
      tex = Texture.from(canvas);
      tex.source.scaleMode = "nearest";
      sprite.texture = tex;
      // The desktop: black glass with a sparse dot matrix, as the scene.
      desk = new Uint8Array(L.W * L.H);
      for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) desk[y * L.W + x] = (x & 3) === 0 && (y & 3) === ((x >> 1) & 2) ? PAPER : INK;
    }
    sprite.scale.set(u);
    sprite.position.set(0, 0);
    // The art shaders on this grid.
    const cellH = u * post.rows;
    const s = stage as unknown as Record<string, PostFilter | null | undefined>;
    for (const k of ["post", "postBack", "postBust"]) s[k]?.fit(cellH);
    // The place lit as the scene's viewport is (the stage sinks it for its own HUD); the vignette darkens it here.
    const pb = s.postBack as unknown as { resources: { postUniforms: { uniforms: { uGain: number } } } } | undefined;
    if (pb) pb.resources.postUniforms.uniforms.uGain = 1.08;
    numbers.fit(cellH);
    moat.width = 3 * u;
    // The place covers the viewport, its floor on the plates' band.
    const vi = inner(L.view);
    const plate = (stage as unknown as { plate?: Container }).plate;
    const tx = stage.bg.texture;
    if (plate && tx.width > 1) {
      const vx = vi.x * u, vy = vi.y * u, vw = vi.w * u, vh = vi.h * u;
      const floor = 0.62, fy = (L.plateY - 2) * u;
      const k = Math.max(vw / tx.width, (fy - vy) / (floor * tx.height), (vy + vh - fy) / ((1 - floor) * tx.height)) * 1.06;
      plate.scale.set(k);
      plate.position.set(vx + (vw - tx.width * k) / 2, fy - floor * tx.height * k);
    }
    // Light from above: a wide soft pool whose centre sits at the top of the view.
    glow.width = vi.w * u * 1.3;
    glow.height = (L.plateY - vi.y) * u * 1.4;
    glow.position.set(vi.x * u - vi.w * u * 0.15, vi.y * u - glow.height * 0.42);
    // The viewport's darkness, as a threshold per pixel: a heavy vignette, light from the upper left,
    // and the foot falling to pure black where the plates float.
    vig = new Uint8Array(vi.w * vi.h);
    const ss = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const fade0 = L.plateY - (L.mode === "tall" ? 20 : 34), fade1 = L.plateY - 3;
    for (let y = 0; y < vi.h; y++) for (let x = 0; x < vi.w; x++) {
      const nx = (x / vi.w - 0.5) * 2, ny = (y / vi.h - 0.34) * 2;
      const d = Math.sqrt(nx * nx * 0.8 + ny * ny * 0.9);
      const py = vi.y + y;
      const foot = ss(fade0, fade1, py);
      const dark = Math.max(0.92 * ss(0.72, 1.22, d) + 0.08 * Math.max(0, nx * 0.6 + ny * 0.4), foot);
      vig[y * vi.w + x] = Math.round(Math.min(1, dark) * 255);
    }
    for (const c of cards()) {
      const i = [...stage.cards.values()].indexOf(c);
      const row = L.rows[i], pic = L.pics[i];
      if (row && pic) c.setPic({ x: (pic.x - row.x + 1) * u, y: (pic.y - row.y + 1) * u, w: (pic.w - 2) * u, h: (pic.h - 2) * u });
    }
    for (const v of stage.enemies.values()) quiet(v);
    isDirty = true;
  }

  /* --------------------------------- Painting --------------------------------- */
  function win(r: Rect, title: string, tag?: string): void {
    const f = font!;
    fb.fill({ x: r.x + 4, y: r.y + 4, w: r.w, h: r.h }, INK);
    fb.fill(r, INK);
    fb.box(r, PAPER);
    fb.box({ x: r.x + 2, y: r.y + 2, w: r.w - 4, h: r.h - 4 }, PAPER);
    for (const [cx, cy] of [[r.x, r.y], [r.x + r.w - 3, r.y], [r.x, r.y + r.h - 3], [r.x + r.w - 3, r.y + r.h - 3]] as const) fb.fill({ x: cx, y: cy, w: 3, h: 3 }, PAPER);
    const tb = { x: r.x + 3, y: r.y + 3, w: r.w - 6, h: 9 };
    for (let y = tb.y + 1; y < tb.y + tb.h; y += 2) fb.hline(tb.x + 1, y, tb.w - 2, PAPER);
    fb.hline(tb.x, tb.y + tb.h, tb.w, PAPER);
    const st = tag ? clip(tag, Math.max(0, Math.floor((tb.w - 40) / 2 / 8) - 1)) : "";
    const tagW = st.length > 1 ? st.length * 8 + 6 : 0;
    const room = tb.w - (tagW ? tagW + 8 : 0);
    const t = clip(title.toUpperCase(), Math.max(1, Math.floor((room - 30) / 8)));
    const tw = t.length * 8 + 8;
    const tx = tb.x + Math.floor((room - tw) / 2);
    fb.fill({ x: tx, y: tb.y, w: tw, h: tb.h }, INK);
    fb.text(f, tx + 4, tb.y + 1, t, PAPER);
    if (tagW) {
      const x = tb.x + tb.w - tagW - 3;
      fb.fill({ x: x - 2, y: tb.y, w: tagW + 4, h: tb.h }, INK);
      fb.fill({ x, y: tb.y, w: tagW, h: tb.h }, PAPER);
      fb.text(f, x + 3, tb.y + 1, st, INK);
    }
  }

  /** A bar of cells: filled up to `v`, a checkered ghost to `ghost`, hollow beyond. */
  function cells(x: number, y: number, w: number, h: number, v: number, ghost: number, c: number): void {
    fb.box({ x, y, w, h }, c);
    const iw = w - 4, n = Math.max(1, Math.floor((iw + 1) / 3));
    const cw = (iw + 1) / n;
    for (let i = 0; i < n; i++) {
      const cx = x + 2 + Math.round(i * cw), ww = Math.max(1, Math.round((i + 1) * cw) - Math.round(i * cw) - 1);
      const at = (i + 0.5) / n;
      if (at <= v) fb.fill({ x: cx, y: y + 2, w: ww, h: h - 4 }, c);
      else if (at <= ghost) for (let yy = y + 2; yy < y + h - 2; yy++) for (let xx = cx; xx < cx + ww; xx++) if ((xx + yy) & 1) fb.set(xx, yy, c);
    }
  }

  /** Diamonds for poise and class resources: filled, or an outline. */
  const DIA_ON = ["  #  ", " ### ", "#####", " ### ", "  #  "];
  const DIA_OFF = ["  #  ", " # # ", "#   #", " # # ", "  #  "];
  function mark(x: number, y: number, art: readonly string[], c: number): void {
    art.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === "#") fb.set(x + i, y + j, c); });
  }
  function pips(x: number, y: number, v: number, max: number, c: number, cap = 8): number {
    const n = Math.min(max, cap);
    if (max <= cap) for (let i = 0; i < n; i++) mark(x + i * 7, y + 1, i < v ? DIA_ON : DIA_OFF, c);
    if (max > cap && font) {
      mark(x, y + 1, v > 0 ? DIA_ON : DIA_OFF, c);
      const t = `${v}/${max}`;
      fb.text(font, x + 7, y, t, c);
      return 7 + t.length * 8;
    }
    return n * 7;
  }

  function tags(x: number, y: number, u: DisplayUnit, room: number, c: number): void {
    const f = font!;
    let cx = x;
    for (const st of u.statuses) {
      const t = ABBR[st.id] ?? st.id.slice(0, 3).toUpperCase();
      const w = t.length * 8 + 3;
      if (cx + w > x + room) break;
      fb.fill({ x: cx, y: y - 1, w, h: 10 }, c);
      fb.text(f, cx + 2, y, t, c === PAPER ? INK : PAPER);
      cx += w + 2;
    }
  }

  function paintView(): void {
    const f = font!;
    const r = L.view;
    win(r, "Battle", turn ? `TURN ${turn}` : undefined);
    const vi = inner(r);
    // The hole, sunk in its dithered dark.
    for (let y = 0; y < vi.h; y++) {
      const py = vi.y + y;
      for (let x = 0; x < vi.w; x++) {
        const px = vi.x + x;
        const d = vig[y * vi.w + x]! / 255;
        fb.pix[py * fb.w + px] = d > bayer(px, py) ? INK : HOLE;
      }
    }
    pillars(vi);
    // The battle messages, printed in their own strip across the top of the view (the figures stand below it).
    const fresh = menu.current.kind === "wait" || time - captionAt < 3;
    const lines = caption.length && fresh ? caption : idleCaption();
    const pwv = pillarW(vi.w);
    const chars = Math.floor((vi.w - 2 * pwv - 8) / 8);
    const one = lines.length === 1 && lines[0]!.length * 16 <= vi.w - 2 * pwv - 8;
    const tall = L.mode === "tall";
    const CAP_H = capH(tall);
    // Small type keeps whole messages: the last lines that fit, each message from its start.
    const room = tall ? 3 : 2;
    const shown: string[] = [];
    if (one) shown.push(lines[0]!);
    else for (const l of [...lines].reverse()) {
      let w = wrap(l, chars);
      if (w.length > room && shortOf.has(l)) w = wrap(shortOf.get(l)!, chars);
      if (shown.length + w.length > room) { if (!shown.length) shown.push(...w.slice(0, room)); break; }
      shown.unshift(...w);
    }
    fb.fill({ x: vi.x, y: vi.y, w: vi.w, h: CAP_H }, INK);
    fb.hline(vi.x + pwv, vi.y + CAP_H - 1, vi.w - 2 * pwv, PAPER, 1);
    let y = vi.y + 3;
    for (const l of shown) {
      const sc = one ? 2 : 1;
      fb.text(f, vi.x + pwv + 4, y + (one ? 1 : 0), l, PAPER, sc);
      y += 8 * sc + 3;
    }
    y = vi.y + CAP_H;
    const capBottom = y;
    const picked = selection();
    const u = L.u;
    const ids = enemyIds();
    const m = menu.current;
    const slotW = Math.floor((vi.w * 0.86) / Math.max(1, ids.length));
    ids.forEach((id, i) => {
      const v = stage.enemies.get(id)!;
      const unit = stage.units.get(id);
      if (!unit || !unit.alive || !v.visible) return;
      const cx = Math.round(v.x / u);
      const targetable = !!v["targetable"];
      const key = `t:${id}`;
      const on = hover === key || focus === key;
      const active = id === stage.state.active && !targetable;
      // The target the prompt's bar (or the pointer) is on gets hard corner brackets, pulsing; the other
      // choices only their numbered plates, so the eye goes to one figure.
      const chosen = targetable && picked === key;
      if (targetable) {
        const top = Math.max(capBottom + 3, Math.round(v.topY / u) - 4);
        const bot = L.plateY - 3;
        const half = Math.max(18, Math.min(Math.round(slotW / 2) - 3, Math.round((v.slot.height * 0.3) / u)));
        if (chosen) {
          const inset = !reduced() ? (Math.floor(time * 4) % 2) * 2 : 0;
          bracket(cx - half + inset, top + inset, cx + half - inset, bot - inset, 3);
        }
        hits.push({ key, r: { x: cx - half, y: top, w: half * 2, h: L.plateY + 12 - top }, label: `Target ${unit.name}`, run: () => press(key, () => tapEnemy(id)) });
      }
      // The plate: number and name, then the cell bar and the poise diamonds.
      const pw = Math.max(64, Math.min(slotW - 4, 8 * (unit.name.length + 2) + 6));
      const px = Math.max(vi.x + 1, Math.min(vi.x + vi.w - pw - 1, cx - Math.floor(pw / 2)));
      const py = L.plateY;
      const inv = on || active || chosen;
      const room = Math.floor((pw - 16) / 8);
      const full = unit.name.toUpperCase();
      const noun = full.split(/[\s-]+/).pop() ?? full;
      const label = `${i + 1} ` + clip(full.length <= room ? full : noun, room);
      fb.fill({ x: px, y: py, w: pw, h: 11 }, inv ? PAPER : INK);
      fb.box({ x: px, y: py, w: pw, h: 11 }, PAPER);
      fb.fill({ x: px + 1, y: py + 1, w: 10, h: 9 }, inv ? INK : PAPER);
      fb.text(f, px + 2, py + 2, `${i + 1}`, inv ? PAPER : INK);
      fb.text(f, px + 14, py + 2, label.slice(2), inv ? INK : PAPER);
      const ghost = (v["ghost"] as number) ?? unit.hp / unit.maxHp;
      const shown = (v["shownHp"] as number) ?? unit.hp / unit.maxHp;
      const by = py + 13;
      const tall = L.mode === "tall";
      const poiseW = unit.maxPoise > 6 ? 9 + `${unit.poise}/${unit.maxPoise}`.length * 8 : unit.maxPoise > 0 ? unit.maxPoise * 7 + 2 : 0;
      cells(px, by, pw - poiseW, tall ? 5 : 6, shown, ghost, PAPER);
      if (unit.maxPoise > 0) {
        if (unit.broken) fb.text(f, px + pw - poiseW + 1, by - 1, "BRK", PAPER);
        else pips(px + pw - poiseW + 2, by - 1, unit.poise, unit.maxPoise, PAPER, 6);
      }
      if (!tall && unit.statuses.length) tags(px, by + 9, unit, pw, PAPER);
    });
    if (endTitle) {
      const sc = endTitle.length * 24 + 24 < vi.w ? 3 : 2;
      const w = endTitle.length * 8 * sc + 20, h = 8 * sc + 18;
      const br = { x: vi.x + Math.floor((vi.w - w) / 2), y: vi.y + Math.floor((L.plateY - vi.y - h) / 2), w, h };
      fb.fill({ x: br.x + 3, y: br.y + 3, w, h }, INK);
      fb.fill(br, INK);
      fb.box(br, PAPER);
      fb.box({ x: br.x + 2, y: br.y + 2, w: w - 4, h: h - 4 }, PAPER);
      fb.text(f, br.x + 10, br.y + 9, endTitle, PAPER, sc);
    }
  }

  function idleCaption(): string[] {
    const m = menu.current;
    if (m.kind === "skills") return [`What will ${m.actor} do?`];
    if (m.kind === "target") return [m.confirm ? `${m.skill}: ${m.hint}` : `${m.skill}: choose a target.`];
    return [];
  }

  function bracket(x0: number, y0: number, x1: number, y1: number, t: number): void {
    const l = 9;
    const arm = (x: number, y: number, dx: number, dy: number) => {
      // Ink backing so a corner reads over bright dither, then the paper stroke.
      fb.fill({ x: Math.min(x, x + dx * l) - 1, y: dy > 0 ? y - 1 : y - t, w: l + 2, h: t + 2 }, INK);
      fb.fill({ x: dx > 0 ? x - 1 : x - t, y: Math.min(y, y + dy * l) - 1, w: t + 2, h: l + 2 }, INK);
      fb.fill({ x: Math.min(x, x + dx * (l - 1)), y: dy > 0 ? y : y - t + 1, w: l, h: t }, PAPER);
      fb.fill({ x: dx > 0 ? x : x - t + 1, y: Math.min(y, y + dy * (l - 1)), w: t, h: l }, PAPER);
    };
    arm(x0, y0, 1, 1);
    arm(x1, y0, -1, 1);
    arm(x0, y1, 1, -1);
    arm(x1, y1, -1, -1);
  }

  /** The whole fight as sentences: a window over the viewport (F1 / LOG), newest at the foot. */
  function paintLog(): void {
    if (!logOpen) return;
    const f = font!;
    const vr = L.view;
    const r = { x: vr.x + 10, y: vr.y + 16, w: vr.w - 20, h: vr.h - 26 };
    win(r, "Chronicle", "ESC");
    const ci = inner(r);
    const chars = Math.floor((ci.w - 12) / 8);
    const rows = Math.max(1, Math.floor((ci.h - 4) / 10));
    const lines: { t: string; first: boolean; last: boolean }[] = [];
    log.forEach((l, i) => wrap(l, chars).forEach((t, j) => lines.push({ t, first: j === 0, last: i === log.length - 1 })));
    const show = lines.slice(-rows);
    let y = ci.y + 3;
    for (const l of show) {
      if (l.first) fb.text(f, ci.x + 1, y, l.last ? "►" : ">", PAPER);
      fb.text(f, ci.x + 11, y, l.t, PAPER);
      y += 10;
    }
    hits.push({ key: "log:close", r, label: "Close the chronicle", run: () => press("log:close", toggleLog) });
  }

  /** Stone pillars at the viewport's edges: the crawler's corridor walls, lit from the left, falling into dark. */
  function pillars(vi: Rect): void {
    const pw = pillarW(vi.w);
    const bh = 7;
    for (const side of [0, 1]) {
      const x0 = side ? vi.x + vi.w - pw : vi.x;
      for (let y = vi.y; y < vi.y + vi.h; y++) {
        const row = Math.floor((y - vi.y) / bh);
        const off = row % 2 ? 6 : 0;
        const foot = (y - vi.y) / vi.h;
        for (let i = 0; i < pw; i++) {
          const x = x0 + i;
          // 0 at the wall's outer edge, 1 at its face toward the room.
          const k = side ? (pw - 1 - i) / pw : i / pw;
          const face = side ? i : pw - 1 - i;
          const mortar = (y - vi.y) % bh === 0 || (i + off + side * 3) % 13 === 0;
          // The face nearest the room is lit; the wall darkens outward and sinks into the floor's dark.
          let lvl = (0.1 + 0.55 * k) * (side ? 0.6 : 1) * (0.55 + 0.45 * Math.min(1, foot * 3)) * (1 - Math.max(0, foot - 0.6) * 2.4);
          if (face === 0) lvl = 0;
          else if (face === 1) lvl = side ? 0.3 : 0.95 * (1 - Math.max(0, foot - 0.6) * 2.4);
          fb.pix[y * fb.w + x] = mortar ? INK : lvl > bayer(x, y) ? PAPER : INK;
        }
      }
    }
  }

  function paintParty(): void {
    const f = font!;
    const r = L.party;
    if (L.mode === "tall") {
      fb.fill({ x: r.x + 4, y: r.y + 4, w: r.w, h: r.h }, INK);
      fb.fill(r, INK);
      fb.box(r, PAPER);
      fb.box({ x: r.x + 2, y: r.y + 2, w: r.w - 4, h: r.h - 4 }, PAPER);
    } else win(r, "Party");
    const list = cards();
    const sel = selection();
    list.forEach((c, i) => {
      const row = L.rows[i], pic = L.pics[i];
      if (!row || !pic) return;
      const { unit, hp, ghost, active, targetable } = c.state;
      const key = `t:${c.id}`;
      const on = hover === key || focus === key || (targetable && sel === key);
      const fl = rowFlash.get(c.id);
      const flashing = fl !== undefined && time - fl < 0.16;
      const inv = active !== flashing;
      const fg = inv ? INK : PAPER;
      if (i > 0 && L.mode !== "tall") fb.vline(row.x - 2, row.y - 1, row.h + 2, PAPER);
      if (inv) fb.fill(row, PAPER);
      // The portrait window (the bust is drawn over it by the stage).
      fb.fill(pic, INK);
      fb.box(pic, PAPER);
      if (inv) fb.box({ x: pic.x - 1, y: pic.y - 1, w: pic.w + 2, h: pic.h + 2 }, INK);
      const res = unit.resource;
      if (targetable) {
        const ants = reduced() ? 0 : Math.floor(time * 6) % 4;
        for (let k = 0; k < row.w; k++) if (((k + ants) >> 1) & 1) { fb.set(row.x + k, row.y - 1, PAPER); fb.set(row.x + row.w - 1 - k, row.y + row.h, PAPER); }
        for (let k = 0; k < row.h; k++) if (((k + ants) >> 1) & 1) { fb.set(row.x - 1, row.y + row.h - 1 - k, PAPER); fb.set(row.x + row.w, row.y + k, PAPER); }
        hits.push({ key, r: row, label: `Target ${unit.name}`, run: () => press(key, () => tapCard(c.id)) });
      }
      if (on) fb.box({ x: row.x, y: row.y, w: row.w, h: row.h }, fg);
      if (!unit.alive) { fb.fill({ x: pic.x + 2, y: pic.y + pic.h - 11, w: 34, h: 10 }, INK); fb.text(f, pic.x + 3, pic.y + pic.h - 10, "DOWN", PAPER); }
      if (targetable) {
        fb.fill({ x: pic.x + 1, y: pic.y + 1, w: 10, h: 10 }, PAPER);
        fb.text(f, pic.x + 2, pic.y + 2, allyNo(c.id), INK);
      }
      if (L.mode === "tall") {
        // A row: the face; the name with the class resource; HP and FP bars with their numbers.
        const x = pic.x + pic.w + 3, w = row.x + row.w - x - 2;
        fb.text(f, x, row.y + 1, clip(unit.name.toUpperCase(), Math.floor((w - (res ? Math.min(res.max, 6) * 7 + 4 : 0)) / 8)), fg);
        if (res) pips(x + w - Math.min(res.max, 6) * 7, row.y + 1, res.value, res.max, fg, 6);
        const hpT = `${Math.max(0, Math.round(unit.hp))}/${unit.maxHp}`;
        const fpT = `${Math.max(0, Math.round(unit.focus))}/${unit.maxFocus}`;
        const tw = Math.max(hpT.length, fpT.length) * 4 + 2;
        cells(x, row.y + 10, w - tw, 6, hp, ghost, fg);
        fb.tiny(x + w - hpT.length * 4 + 1, row.y + 11, hpT, fg);
        cells(x, row.y + 17, w - tw, 6, unit.focus / Math.max(1, unit.maxFocus), 0, fg);
        fb.tiny(x + w - fpT.length * 4 + 1, row.y + 18, fpT, fg);
        return;
      }
      // A card: the face on the left; name, HP and FP (numbers over cell bars), the class resource and statuses.
      const x = pic.x + pic.w + 4;
      const w = row.x + row.w - x - 2;
      const chars = Math.floor(w / 8);
      let y = row.y + 2;
      fb.text(f, x, y, clip(unit.name.toUpperCase(), chars), fg);
      y += 10;
      const num = (v: number, max: number) => `${Math.max(0, Math.round(v))}/${max}`;
      const line = (lab: string, t: string, v: number, gh: number) => {
        fb.text(f, x, y, lab, fg);
        fb.text(f, Math.max(x + 18, x + w - t.length * 8), y, t, fg);
        y += 9;
        cells(x, y, w, 5, v, gh, fg);
        y += 7;
      };
      line("HP", num(unit.hp, unit.maxHp), hp, ghost);
      if (unit.shield > 0) fb.hline(x, y - 8, Math.max(2, Math.round(w * Math.min(1, unit.shield / unit.maxHp))), fg);
      line("FP", num(unit.focus, unit.maxFocus), unit.focus / Math.max(1, unit.maxFocus), 0);
      let end = x;
      if (res) {
        fb.text(f, x, y, res.name.toUpperCase().slice(0, 3), fg);
        end = x + 26 + pips(x + 26, y, res.value, res.max, fg);
      }
      tags(end + 4, y, unit, x + w - end - 4, fg);
    });
  }

  /** The turn order, top to bottom: who acts now, then who follows. */
  function paintOrder(): void {
    if (!L.order) return;
    const f = font!;
    const r = L.order;
    win(r, "Turn order");
    const oi = inner(r);
    const rows = Math.floor((oi.h - 2) / 10);
    const chars = Math.floor((oi.w - 4) / 8);
    order.order.slice(0, rows).forEach((o, i) => {
      const y = oi.y + 2 + i * 10;
      const now = i === 0;
      const right = now ? "NOW" : o.enemy ? "FOE" : "";
      const t = clip(`${i + 1} ${name(o.id).toUpperCase()}`, chars - (right ? 4 : 0));
      if (now) fb.fill({ x: oi.x - 1, y: y - 1, w: oi.w + 2, h: 10 }, PAPER);
      const c = now ? INK : PAPER;
      fb.text(f, oi.x + 1, y, t, c);
      if (right) fb.text(f, oi.x + oi.w - right.length * 8, y, right, c);
    });
  }

  function paintCmd(): void {
    const f = font!;
    const r = L.cmd;
    const it = items();
    win(r, "Command", it.tag || undefined);
    const cr = inner(r);
    if (!it.list.length) {
      // Waiting: the hourglass while the fight plays, or the last word.
      const msg = it.busy ? "" : it.wait.toUpperCase();
      const cy = cr.y + Math.floor(cr.h / 2) - 8;
      if (it.busy || !msg) {
        fb.sprite(cr.x + Math.floor(cr.w / 2) - 7, cy - 4, GLASS[reduced() ? 0 : Math.floor(time * 2) % 2]!, 2);
        fb.text(f, cr.x + Math.floor(cr.w / 2) - 12, cy + 18, ".".repeat(1 + (reduced() ? 2 : Math.floor(time * 3) % 3)), PAPER);
      } else {
        const ls = wrap(msg, Math.floor((cr.w - 4) / 8));
        ls.forEach((l, j) => fb.text(f, cr.x + Math.floor((cr.w - l.length * 8) / 2), cy + j * 10, l, PAPER));
      }
      return;
    }
    const big = it.prompt.length * 16 + 14 <= cr.w ? 2 : 1;
    const hy = cr.y + 4;
    const hw = fb.text(f, cr.x + 1, hy, it.prompt, PAPER, big);
    const cur = { x: cr.x + 1 + hw + 3, y: hy, w: 5 * big + 2, h: 8 * big - 1 };
    if (reduced() || time % 1 < 0.75) fb.fill(cur, PAPER);
    let top = hy + 8 * big + 4;
    fb.hline(cr.x - 1, top, cr.w + 2, PAPER);
    fb.hline(cr.x - 1, top + 2, cr.w + 2, PAPER, 1);
    let y = top + 5;
    const chars = Math.floor((cr.w - 12) / 8);
    if (it.note) {
      for (const l of wrap(it.note, chars + 1)) { fb.text(f, cr.x + 1, y, l, PAPER); y += 9; }
      y += 4;
    }
    const mode = `${menu.current.kind}:${it.tag}`;
    if (mode !== cursorMode) { cursorMode = mode; cursor = 0; }
    const enabled = it.list.filter((x) => x.enabled);
    if (cursor >= enabled.length) cursor = 0;
    const lit = it.list.some((x) => hover === x.key || focus === x.key);
    type Row = { item: Item; lines: string[] };
    const rows: Row[] = it.list.map((item) => {
      const head = `${item.num.padEnd(item.num.length > 1 ? item.num.length : 1)}${item.sig ? "♦" : " "}${item.label}`;
      const rightW = item.right ? item.right.length + 1 : 0;
      const ls = wrap(head, chars - rightW - (rightW ? 1 : 0)).map((l, j) => (j ? "  " + l : l));
      if (item.note) ls.push(...wrap(`[${item.note}]`, chars - 2).map((l) => "  " + l));
      return { item, lines: ls };
    });
    const room = cr.y + cr.h - y;
    const need = rows.reduce((n, row) => n + row.lines.length * 9 + 3, 0);
    const extra = Math.max(0, Math.min(6, Math.floor((room - need) / Math.max(1, rows.length))));
    for (const row of rows) {
      const h = row.lines.length * 9 + 3 + extra;
      if (y + h > cr.y + cr.h + 1) break;
      const rr = { x: cr.x - 1, y, w: cr.w + 2, h: h - 1 };
      const k = row.item.key;
      const sel = row.item.enabled && (hover === k || focus === k || (!lit && enabled[cursor] === row.item));
      const fl = !!flash && flash.key === k && time - flash.t < 0.14;
      if (sel && !fl) fb.fill(rr, PAPER);
      if (fl) fb.box(rr, PAPER);
      const c = sel && !fl ? INK : PAPER;
      const ty = y + 2 + (extra >> 1);
      if (sel) fb.text(f, cr.x, ty, "►", c);
      row.lines.forEach((l, j) => fb.text(f, cr.x + 10, ty + j * 9, l, c));
      if (row.item.right) fb.text(f, cr.x + cr.w - row.item.right.length * 8, ty, row.item.right, c);
      if (row.item.enabled) hits.push({ key: k, r: rr, label: row.item.aria, run: () => press(k, row.item.run) });
      y += h;
    }
    void top;
  }

  function paintKeys(): void {
    const f = font!;
    const r = L.keys;
    fb.fill({ x: r.x + 4, y: r.y + 4, w: r.w, h: r.h }, INK);
    fb.fill(r, INK);
    fb.box(r, PAPER);
    const tall = L.mode === "tall";
    // F1 (or a tap): the chronicle.
    const fk = tall ? "" : "F1";
    const label = tall ? "LOG" : "CHRONICLE";
    const kw = (fk ? fk.length * 8 + 4 : 0) + label.length * 8 + 6;
    const kr = { x: r.x + 2, y: r.y + 1, w: kw, h: r.h - 2 };
    const on = (hover === "log" || focus === "log") !== logOpen;
    fb.fill(kr, on ? INK : PAPER);
    let tx = kr.x + 3;
    if (fk) {
      fb.fill({ x: kr.x, y: kr.y, w: fk.length * 8 + 4, h: kr.h }, on ? PAPER : INK);
      fb.text(f, kr.x + 2, kr.y + 1, fk, on ? INK : PAPER);
      tx = kr.x + fk.length * 8 + 7;
    }
    fb.text(f, tx, kr.y + 1, label, on ? PAPER : INK);
    hits.push({ key: "log", r: kr, label: "Chronicle (F1)", run: () => press("log", toggleLog) });
    // Right end: who acts next (a phone, without the turn-order window, names the next two).
    const room = Math.floor((r.x + r.w - (kr.x + kw) - 10) / 8);
    let t = "";
    for (const o of order.order.slice(1, 4)) {
      const next = `${t || "NEXT"} ► ${name(o.id).toUpperCase()}`;
      if (next.length > room) break;
      t = next;
    }
    if (t) fb.text(f, r.x + r.w - 3 - t.length * 8, r.y + 2, t, PAPER);
  }

  function paint(): void {
    hits = [];
    fb.pix.set(desk);
    if (font) {
      paintView();
      paintParty();
      paintCmd();
      paintOrder();
      paintKeys();
      paintLog();
    }
    if (!img || img.width !== fb.w || img.height !== fb.h) img = g2.createImageData(fb.w, fb.h);
    const out = new Uint32Array(img.data.buffer);
    const p = fb.pix;
    for (let i = 0; i < p.length; i++) out[i] = p[i] === HOLE ? 0 : p[i] ? C_PAPER : C_INK;
    g2.putImageData(img, 0, 0);
    tex?.source.update();
    syncHits();
  }

  /** What the console shows that the stage changes without telling it (the enemies' bars). */
  function signature(): string {
    let s = `${stage.state.active}|${menu.current.kind}`;
    for (const [id, v] of stage.enemies) {
      const u = stage.units.get(id);
      s += `|${id}:${v.visible ? 1 : 0}:${Math.round(((v["shownHp"] as number) ?? 0) * 200)}:${Math.round(((v["ghost"] as number) ?? 0) * 200)}:${u?.poise}:${u?.broken ? 1 : 0}:${u?.statuses.length}:${v["targetable"] ? 1 : 0}:${Math.round(v.x)}:${Math.round(v.topY)}`;
    }
    return s;
  }

  void loadFont().then((f) => { font = f; isDirty = true; });
  size();

  return {
    resize() { size(); },
    update(now) {
      time = now;
      const s = signature();
      if (s !== sig) { sig = s; isDirty = true; }
      const m = menu.current;
      const animated = m.kind === "target" || (m.kind === "wait" && m.text === "") || [...rowFlash.values()].some((t) => time - t < 0.3) || (!!flash && time - flash.t < 0.3);
      const t = Math.floor(time * (animated && !reduced() ? 8 : 2));
      if (t !== tick) { tick = t; if (!reduced() || animated) isDirty = true; }
      if (isDirty) { isDirty = false; paint(); }
    },
    event,
    destroy() {
      window.removeEventListener("keydown", onKey);
      layer.remove();
      dirty.fn = () => {};
      tex?.destroy(true);
      glow.destroy();
      glowTex.destroy(true);
    },
  };
}
