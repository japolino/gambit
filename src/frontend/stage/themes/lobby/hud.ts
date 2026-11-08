/**
 * The Lobby battle's DOM layer over the Pixi canvas (inside the stage host): the hall's vignette and floating
 * dust, the encounter crest and title, the latest beat of the fight as a subtitle, the party cards, the skill
 * medallions and the turn-order lockets (their own classes, mounted here), an ornate nameplate under each enemy
 * (the stock plate is hidden), and astrolabe reticles over whatever can be targeted, which are buttons too. It
 * fades out while a cut-in plays (the cut-in is Pixi, under this layer). The acting member stands in Pixi
 * (./lead.ts).
 */
import type { BattleEvent, BattleState } from "../../../../engine/types.js";
import type { BattleStage } from "../../battle/stage.js";
import type { StageDecor } from "../types.js";
import { defs as lobbyDefs } from "../../../scene/themes/lobby/art.js";
import { moteSprite } from "../../../scene/themes/lobby/tex.js";
import { battleDefs, crest, enemyPlate, reticle } from "./art.js";
import { LobbyCard, statusChip } from "./card.js";
import { HUD_CSS } from "./css.js";
import { lobbyGeom, type LobbyGeom } from "./geom.js";
import { Lead, hallShade } from "./lead.js";
import { LobbyMenu } from "./menu.js";
import { LobbyOrder } from "./order.js";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

type Plate = { el: HTMLElement; name: HTMLElement; fill: HTMLElement; ghost: HTMLElement; shield: HTMLElement; po: HTMLElement; sts: HTMLElement; shown: number; ghostV: number; hold: number; key: string };
type Mark = { el: HTMLButtonElement };

/** Floating dust in the window light. */
function dust(canvas: HTMLCanvasElement, reduced: () => boolean): { frame(now: number): void; resize(w: number, h: number): void } {
  const g = canvas.getContext("2d")!;
  const mote = moteSprite();
  let s = 11;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const motes = Array.from({ length: 46 }, () => ({ x: r(), y: r(), z: 0.3 + r() * 0.7, p: r() * 6.28, v: 0.004 + r() * 0.01 }));
  let W = 1;
  let H = 1;
  return {
    resize(w, h) {
      W = canvas.width = Math.max(1, Math.round(w / 2));
      H = canvas.height = Math.max(1, Math.round(h / 2));
    },
    frame(now) {
      g.clearRect(0, 0, W, H);
      const still = reduced();
      for (const m of motes) {
        const t = still ? 0 : now;
        const x = ((m.x + Math.sin(t * 0.13 + m.p) * 0.02 + t * m.v * 0.25) % 1) * W;
        const y = ((m.y - t * m.v * 0.5 + 10) % 1) * H;
        // Brighter where the shafts fall (upper left).
        const lit = Math.max(0.15, 1 - (x / W) * 0.9 - (y / H) * 0.3);
        const size = (4 + m.z * 9) * (0.6 + 0.4 * Math.sin(t * 0.8 + m.p));
        g.globalAlpha = 0.5 * lit * m.z;
        g.drawImage(mote, x - size / 2, y - size / 2, size, size);
      }
      g.globalAlpha = 1;
    },
  };
}

/** A short line for the log, from an event (or null to skip it). */
function logLine(stage: BattleStage, ev: BattleEvent, last: { skill: string | null }): { html: string; hurt?: boolean } | null {
  const name = (id: string) => `<em class="n">${esc(stage.units.get(id)?.name ?? "Someone")}</em>`;
  switch (ev.kind) {
    case "use":
      last.skill = ev.name;
      return { html: `${name(ev.actor)} — ${esc(ev.name)}` };
    case "hit": {
      const u = stage.units.get(ev.target);
      const tag = ev.crit ? " A critical blow." : ev.weak ? " A weak spot." : ev.resisted ? " Resisted." : "";
      return { html: `${name(ev.target)} takes ${ev.amount}.${tag}`, hurt: u?.side === "party" };
    }
    case "miss": return { html: `${name(ev.source)} misses ${name(ev.target)}.` };
    case "heal": return { html: `${name(ev.target)} recovers ${ev.amount}.` };
    case "shield": return { html: `${name(ev.target)} is shielded for ${ev.amount}.` };
    case "break": return { html: `${name(ev.target)}'s guard breaks.` };
    case "defeat": return { html: `${name(ev.target)} falls.`, hurt: stage.units.get(ev.target)?.side === "party" };
    case "skip": return { html: `${name(ev.actor)} loses the turn.` };
    case "phase": return { html: `${name(ev.target)} becomes ${esc(ev.name)}.` };
    case "end": return { html: ev.outcome === "victory" ? "The field is yours." : ev.outcome === "defeat" ? "The party has fallen." : "The fight is over." };
    default: return null;
  }
}

export function decorateLobby(stage: BattleStage): StageDecor {
  const host = (stage.app.canvas as HTMLCanvasElement).parentElement;
  if (!host) return {};
  const reduced = () => stage.reduced;
  const root = document.createElement("div");
  root.className = "lbb";
  const title = stage.state.meta?.title ?? "A Skirmish";
  root.innerHTML = `<style>${HUD_CSS}</style>${lobbyDefs()}${battleDefs()}
<div class="warm" aria-hidden="true"></div><canvas class="dust" aria-hidden="true"></canvas>
<div class="ttl"><div class="cr">${crest()}</div><div class="rib"><b>${esc(title)}</b><svg viewBox="0 0 320 10" aria-hidden="true"><path d="M0 5 H140 M180 5 H320" stroke="#c8aa6e" stroke-width="1"/><path d="M160 0 L165 5 L160 10 L155 5Z" fill="#DFC183"/><circle cx="146" cy="5" r="1.6" fill="#DFC183"/><circle cx="174" cy="5" r="1.6" fill="#DFC183"/></svg><span class="tsub"></span></div></div>
<div class="sub" aria-live="polite"><p></p></div>
<div class="plates"></div><div class="marks"></div>`;
  const $ = (s: string) => root.querySelector(s) as HTMLElement;
  const ttl = $(".ttl");
  const sub = $(".ttl .tsub");
  const subEl = $("div.sub");
  const subP = $("div.sub p");
  const platesEl = $(".plates");
  const marksEl = $(".marks");
  const motes = dust(root.querySelector(".dust") as HTMLCanvasElement, reduced);

  // The HUD pieces the stage made from this theme.
  const cards = [...stage.cards.values()].filter((c): c is LobbyCard => c instanceof LobbyCard);
  const menu = stage.menu instanceof LobbyMenu ? stage.menu : null;
  const order = stage.timeline instanceof LobbyOrder ? stage.timeline : null;
  if (order) order.nameOf = (id) => stage.units.get(id)?.name ?? stage.state.combatants.find((c) => c.id === id)?.name ?? "";
  for (const c of cards) root.append(c.el);
  if (menu) root.append(menu.el);
  if (order) root.append(order.el);
  host.append(root);

  const lead = new Lead(stage);
  const shade = hallShade(stage);
  const party = () => stage.state.combatants.filter((c) => c.side === "party");
  const firstLead = stage.state.active && stage.units.get(stage.state.active)?.side === "party" ? stage.state.active : (party().find((c) => c.alive)?.id ?? null);
  lead.setActor(firstLead);

  let geom: LobbyGeom = lobbyGeom(stage.app.screen.width, stage.app.screen.height, party().length);
  let turn = stage.state.turn;
  const paintSub = () => {
    const foes = stage.state.combatants.filter((c) => c.side === "enemy" && c.alive).length;
    sub.textContent = `Turn ${Math.max(1, turn)} · ${foes} ${foes === 1 ? "foe" : "foes"} standing`;
  };
  paintSub();

  /* ------------------------- The subtitle (latest beat) ------------------------- */
  const lastSkill = { skill: null as string | null };
  const pushLog = (html: string, hurt = false) => {
    subP.innerHTML = html;
    subP.classList.toggle("hurt", hurt);
    subP.classList.remove("show");
    void subP.offsetWidth;
    subP.classList.add("show");
  };
  pushLog(`<em class="n">${esc(title)}</em> — steel is drawn.`);

  /* ---------------------------- Enemy plates ---------------------------- */
  const plates = new Map<string, Plate>();
  const plateFor = (id: string): Plate => {
    let p = plates.get(id);
    if (p) return p;
    const el = document.createElement("div");
    el.className = "bb-ep";
    el.innerHTML = `<div class="bg">${enemyPlate()}</div><b></b><div class="hp"><i class="gh"></i><i class="fl"></i><i class="sh"></i></div><div class="po"></div><div class="sts"></div>`;
    platesEl.append(el);
    const q = (s: string) => el.querySelector(s) as HTMLElement;
    const u = stage.units.get(id);
    const v = u ? u.hp / Math.max(1, u.maxHp) : 1;
    p = { el, name: q("b"), fill: q(".hp .fl"), ghost: q(".hp .gh"), shield: q(".hp .sh"), po: q(".po"), sts: q(".sts"), shown: v, ghostV: v, hold: 0, key: "" };
    plates.set(id, p);
    return p;
  };

  /* ---------------------------- Target marks ---------------------------- */
  const marks = new Map<string, Mark>();
  const markFor = (id: string, label: string): Mark => {
    let m = marks.get(id);
    if (m) return m;
    const el = document.createElement("button");
    el.type = "button";
    el.className = "bb-tg";
    el.innerHTML = `${reticle(true)}<span>${esc(label)}</span>`;
    el.setAttribute("aria-label", `Target ${label}`);
    el.addEventListener("click", () => stage.enemies.get(id)?.emit("pointertap", { stopPropagation() {} } as never));
    marksEl.append(el);
    m = { el };
    marks.set(id, m);
    return m;
  };

  /* ------------------------------ Keyboard ------------------------------ */
  const onKey = (e: KeyboardEvent) => {
    if (!menu || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = (e.composedPath()[0] ?? e.target) as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (!host.isConnected || host.offsetParent === null) return;
    if (menu.key(e.key)) e.preventDefault();
  };
  window.addEventListener("keydown", onKey);

  const place = () => {
    const g = geom;
    root.classList.toggle("ph", g.portrait);
    root.classList.toggle("side", g.portrait && g.w / g.h >= 0.95);
    root.style.setProperty("--u", `${g.u}px`);
    ttl.style.left = `${g.title.x}px`;
    ttl.style.top = `${g.title.y}px`;
    Object.assign(subEl.style, { left: `${g.sub.x}px`, top: `${g.sub.y}px`, width: `${g.sub.w}px`, height: `${g.sub.h}px` });
    motes.resize(g.w, g.h);
    lead.layout(g);
    shade.width = g.w;
    shade.height = g.h;
  };
  place();

  return {
    resize(w, h) {
      geom = lobbyGeom(w, h, party().length);
      place();
    },
    event(ev: BattleEvent, _state: BattleState) {
      if (ev.kind === "turn") {
        turn = Math.max(turn, ev.turn);
        paintSub();
        if (stage.units.get(ev.actor)?.side === "party") lead.setActor(ev.actor);
      }
      if (ev.kind === "defeat" || ev.kind === "end") paintSub();
      const line = logLine(stage, ev, lastSkill);
      if (line) pushLog(line.html, line.hurt);
    },
    update(now, dt) {
      root.classList.toggle("rm", stage.reduced);
      root.classList.toggle("cut", stage.cutLayer.children.length > 0);
      if (!stage.reduced || Math.floor(now * 4) !== Math.floor((now - dt) * 4)) motes.frame(now);
      lead.update(now, dt);
      const g = geom;
      const px = stage.field.pivot.x;
      const seen = new Set<string>();
      let alive = 0;
      for (const [id, v] of stage.enemies) if (v.visible && stage.units.get(id)?.alive) alive++;
      for (const [id, view] of stage.enemies) {
        view.showPlate = false;
        view.plate.visible = false;
        const u = stage.units.get(id);
        const p = plateFor(id);
        seen.add(id);
        if (!u || !u.alive || !view.visible) {
          p.el.style.opacity = "0";
          const m = marks.get(id);
          if (m) m.el.style.display = "none";
          continue;
        }
        p.el.style.opacity = "1";
        // Plate on the floor under the figure (the stock plate's spot), kept on screen.
        let pw = Math.max(g.portrait ? 200 : 260, u.name.length * 15 + 96);
        // On a phone the plates share the width: each keeps to its share of the screen.
        if (g.portrait) pw = Math.min(pw, Math.round((g.enemyArea.w / Math.max(1, alive) - 6) / (0.62 * g.u)));
        if (p.el.style.getPropertyValue("--pw") !== String(pw)) p.el.style.setProperty("--pw", String(pw));
        const half = (pw / 2) * g.u * (g.portrait ? 0.62 : 1);
        const x = Math.max(half + 4, Math.min(g.enemyArea.x + g.enemyArea.w - half - 4, view.x - px));
        const y = view.y + view.plate.y - 4 * g.u;
        p.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        const v = u.hp / Math.max(1, u.maxHp);
        if (v < p.shown) p.hold = now + 0.45;
        else p.ghostV = Math.max(p.ghostV, v);
        p.shown = v;
        if (now > p.hold && p.ghostV > v) p.ghostV = Math.max(v, p.ghostV - dt * 0.9);
        p.fill.style.width = `${(v * 100).toFixed(2)}%`;
        p.ghost.style.width = `${(p.ghostV * 100).toFixed(2)}%`;
        p.shield.style.width = `${(Math.min(1, u.shield / Math.max(1, u.maxHp)) * 100).toFixed(2)}%`;
        const key = `${u.name}|${u.poise}/${u.maxPoise}|${u.broken}|${u.statuses.map((s) => `${s.id}${s.stacks}.${s.turns}`).join(",")}|${stage.state.active === id}`;
        if (key !== p.key) {
          p.key = key;
          p.name.textContent = u.name;
          p.el.classList.toggle("broken", u.broken);
          p.el.classList.toggle("act", stage.state.active === id);
          p.po.innerHTML = u.broken ? "" : Array.from({ length: Math.min(12, u.maxPoise) }, (_, i) => `<i class="${i < u.poise ? "on" : ""}"></i>`).join("");
          if (u.broken) p.po.innerHTML = `<span class="bk">Broken</span>`;
          p.sts.innerHTML = u.statuses.slice(0, 5).map((s) => statusChip(s.id, s.stacks, s.turns)).join("");
        }
        // A reticle (a button) over each enemy that can be chosen now.
        const can = view.cursor === "pointer";
        const m = can ? markFor(id, u.name) : marks.get(id);
        if (m) {
          m.el.style.display = can ? "" : "none";
          const label = m.el.querySelector("span")!;
          const want = menu?.aiming ?? u.name;
          if (label.textContent !== want) label.textContent = want;
          if (can) {
            // On the figure's centre line (stand-in art can put the face off-centre), over its chest below the face.
            const f = view.faceGlobal;
            const ry = f.y + (g.portrait ? 50 : 90) * g.u;
            m.el.style.transform = `translate3d(${(view.x - px).toFixed(1)}px, ${ry.toFixed(1)}px, 0)`;
          }
        }
      }
      for (const [id, p] of plates) if (!seen.has(id)) { p.el.remove(); plates.delete(id); }
    },
    destroy() {
      window.removeEventListener("keydown", onKey);
      lead.destroy();
      shade.destroy({ texture: true, textureSource: true });
      root.remove();
    },
  };
}
