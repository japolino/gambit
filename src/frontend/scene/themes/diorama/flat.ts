/**
 * The diorama drawn in 2.5D (DOM, SVG and canvas): the fallback when there
 * is no WebGL, and the shop counter laid over the host's 3D corridor in a
 * delve. Whoever is here stands behind a perspective-painted counter (see
 * counter.ts) and is cut off at the waist by it; the actions are props on
 * the counter drawn in three-quarter view (props3d.ts), each labelled on
 * the object itself and outlined in yellow when it can be used: the easel
 * (look around; the ways out are postcards tucked on its ledge; in a delve
 * it holds the chart, on the frontier the overland), the teacup (rest; its
 * level is vigor), the hourglass (wait; its sand is the time of day), a
 * dagger through a bounty note (fight), the register (the purse; the shop),
 * a lantern (into or out of a delve), the compass (a delve's moves), two
 * books (Journal, Classes) and a globe (the theme). The box itself carries
 * a pendulum clock (day and time) and a rack of thread spools (the quest).
 *
 * Layers, back to front, each with its own mouse parallax: the place, a
 * haze with dust motes, the people, the counter and its props, the box's
 * frame, then light, narration and overlays.
 */
import { esc, seedOf, type MenuItem, type SceneView, type ThemeCtx } from "../contract.js";
import * as A from "./art.js";
import * as P from "./props3d.js";
import { cleanCutout, drawChart } from "./chart.js";
import { paintCounter } from "./counter.js";
import { journalHtml, narrationHtml, pickerHtml, tex } from "./shared.js";
import { bookcase, paper, stallStack, texUrl, walnut } from "./textures.js";

export interface Mode {
  /** Take the world layer and show this renderer. */
  activate(): void;
  deactivate(): void;
  render(v: SceneView): void;
  key(e: KeyboardEvent, v: SceneView): boolean;
  destroy(): void;
}

/** The receding inner side of a wing (the bookcase's cheek, seen in perspective). */
const CHEEK = (side: "l" | "r") => `<svg viewBox="0 0 40 1000" preserveAspectRatio="none" aria-hidden="true">
<path d="${side === "l" ? "M0 0 L40 40 L40 960 L0 1000 Z" : "M40 0 L0 40 L0 960 L40 1000 Z"}" fill="url(#dr-walnut)"/>
<path d="${side === "l" ? "M0 0 L40 40 L40 960 L0 1000 Z" : "M40 0 L0 40 L0 960 L40 1000 Z"}" fill="${side === "l" ? "rgba(255,170,90,.10)" : "rgba(0,0,0,.35)"}"/>
${[150, 300, 450, 600, 750, 900].map((y) => `<path d="${side === "l" ? `M0 ${y} L40 ${y + 4}` : `M40 ${y} L0 ${y + 4}`}" stroke="#7a4d2a" stroke-width="5" vector-effect="non-scaling-stroke"/>`).join("")}
</svg>`;
const CONE = `<svg viewBox="0 0 400 500" preserveAspectRatio="none" aria-hidden="true"><path d="M170 0 L230 0 L400 500 L0 500 Z" fill="url(#dr-cone)" filter="url(#dr-blur8)"/></svg>`;
const DENTIL = `<svg aria-hidden="true"><rect width="100%" height="100%" fill="url(#dr-dentil)"/></svg>`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

let chartPaper: HTMLCanvasElement | null = null;

/** People drawn behind the counter; the rest are in the guest book. */
const BEHIND_COUNTER = 4;

export function flatDiorama(ctx: ThemeCtx, host: HTMLElement): Mode {
  host.innerHTML = `<div class="dr${ctx.reducedMotion ? " still" : ""}">
  <div class="lay L0"><div class="room np"></div></div>
  <div class="lay L1 np"><div class="haze np"></div><div class="motes np"></div></div>
  <div class="lay L2"></div>
  <div class="lay L3"><div class="ctrbox"><canvas aria-hidden="true"></canvas></div><div class="desk"></div></div>
  <div class="lay L4"></div>
  <div class="pool np"></div><div class="vig np"></div>
  <div class="say" aria-live="polite"></div>
  <div class="ovl"></div>
</div>`;
  const dr = host.querySelector(".dr") as HTMLDivElement;
  const room = host.querySelector(".room") as HTMLDivElement;
  const L = [...host.querySelectorAll<HTMLDivElement>(".lay")];
  const cast = L[2]!;
  const desk = host.querySelector(".desk") as HTMLDivElement;
  const fore = L[4]!;
  const say = host.querySelector(".say") as HTMLDivElement;
  const ovl = host.querySelector(".ovl") as HTMLDivElement;
  const ctrbox = host.querySelector(".ctrbox") as HTMLDivElement;
  const ctrCanvas = ctrbox.querySelector("canvas") as HTMLCanvasElement;
  let destroyed = false;
  let active = false;

  /* Dust motes drifting up through the lamp's light (seeded, built once). */
  {
    let s = seedOf("diorama-motes");
    const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    host.querySelector(".motes")!.innerHTML = Array.from({ length: 36 }, () => {
      const sz = 3 + rnd() * 6;
      return `<i style="left:${(rnd() * 100).toFixed(1)}%;top:${(30 + rnd() * 70).toFixed(1)}%;width:${sz.toFixed(1)}px;height:${sz.toFixed(1)}px;--d:${(9 + rnd() * 10).toFixed(1)}s;--dl:${(-rnd() * 19).toFixed(1)}s;--dx:${((rnd() - 0.5) * 60).toFixed(0)}px;--o:${(0.25 + rnd() * 0.5).toFixed(2)}"></i>`;
    }).join("");
  }

  /* Textures, generated the first time each is needed. */
  const texSet = new Set<string>();
  function needTex(name: string, make: () => string): void {
    if (texSet.has(name)) return;
    texSet.add(name);
    dr.style.setProperty(name, `url("${make()}")`);
  }

  /* The counter: repainted only when its box changes size. */
  let paintRaf = 0;
  const ro = new ResizeObserver(() => {
    if (paintRaf) return;
    paintRaf = requestAnimationFrame(() => {
      paintRaf = 0;
      const b = ctrbox.getBoundingClientRect();
      if (b.width > 2 && b.height > 2) paintCounter(ctrCanvas, b.width, b.height, Math.min(2, devicePixelRatio || 1));
    });
  });
  ro.observe(ctrbox);

  /* Clicks: every actionable thing carries data-act; the handlers are rebuilt each render. */
  let acts = new Map<string, () => void>();
  let logOpen = false;
  let pickOpen = false;
  /** The guest book's list of the people who don't fit behind the counter. */
  let othersOpen = false;
  let last: SceneView | null = null;
  const rerender = () => {
    if (last && active) render(last);
  };
  const fire = (key: string | undefined) => {
    if (!key) return;
    if (key === "log") {
      logOpen = !logOpen;
      return rerender();
    }
    if (key === "globe") {
      pickOpen = !pickOpen;
      return rerender();
    }
    if (key === "others") {
      othersOpen = !othersOpen;
      pickOpen = false;
      return rerender();
    }
    if (key.startsWith("theme:")) {
      pickOpen = false;
      ctx.setTheme(key.slice(6) as never);
      return;
    }
    if (pickOpen || othersOpen) {
      pickOpen = false;
      othersOpen = false;
      rerender();
    }
    acts.get(key)?.();
  };
  const onClick = (e: MouseEvent) => {
    const t = (e.target as Element).closest<HTMLElement | SVGElement>("[data-act]");
    if (!t || !dr.contains(t)) return;
    e.preventDefault();
    fire(t.dataset.act);
  };
  const onKeydown = (e: KeyboardEvent) => {
    // SVG buttons (the compass paddles) need Enter/Space by hand.
    const t = e.target as Element;
    if ((e.key === "Enter" || e.key === " ") && t instanceof SVGElement && t.dataset.act) {
      e.preventDefault();
      fire(t.dataset.act);
    }
  };
  dr.addEventListener("click", onClick);
  dr.addEventListener("keydown", onKeydown);

  /* Parallax: each layer moves by its depth; transform only. */
  const DEPTH: [number, number][] = [[-12, -8], [-4, -3], [6, 4], [18, 10], [32, 16]];
  let px = 9, py = 9;
  let stopFrame = () => {};
  const startFrame = () => {
    if (ctx.reducedMotion) return;
    stopFrame = ctx.onFrame(() => {
      const p = ctx.pointer();
      if (Math.abs(p.x - px) < 0.002 && Math.abs(p.y - py) < 0.002) return;
      px = p.x;
      py = p.y;
      L.forEach((el, i) => {
        const [fx, fy] = DEPTH[i]!;
        el.style.transform = `translate3d(${(px * fx).toFixed(2)}px, ${(py * fy).toFixed(2)}px, 0)${i === 0 ? " scale(1.04)" : ""}`;
      });
    });
  };

  /** Set innerHTML only when it changed (keeps images, focus and animations alive). */
  const cache = new WeakMap<Element, string>();
  function put(el: Element, html: string): boolean {
    if (cache.get(el) === html) return false;
    cache.set(el, html);
    el.innerHTML = html;
    return true;
  }

  const tip = (label: string) => `<span class="tip" aria-hidden="true">${esc(label)}</span>`;
  /** A prop: a <button> when it does something (with a hover caption), otherwise a plain figure. */
  function prop(cls: string, svg: string, item: MenuItem | null, title: string, extra = ""): string {
    if (item) {
      acts.set(`m:${item.key}`, item.run);
      return `<button class="prop act ${cls}" data-act="m:${esc(item.key)}" aria-label="${esc(item.label)}${title && title !== item.label ? ` (${esc(title)})` : ""}"${extra}>${svg}${tip(item.label)}</button>`;
    }
    return `<div class="prop ${cls}" role="img" aria-label="${esc(title)}" title="${esc(title)}"${extra}>${svg}</div>`;
  }

  function render(v: SceneView): void {
    if (destroyed) return;
    last = v;
    acts = new Map();
    const delve = !!v.delve;
    const hex = !!v.hex;
    const indoor = v.indoor || delve;
    const s = ctx.status(v);
    const box = ctx.box(v);
    const menu = ctx.menu(v);
    dr.className = `dr ${indoor ? "in" : "out"}${delve ? " delving" : ""}${hex ? " hexing" : ""}${box.busy ? " busy" : ""}${ctx.reducedMotion ? " still" : ""}`;
    ctx.backdrop(v, delve ? { post: "none" } : v.indoor ? { post: "none", room: true } : { post: "none" });

    needTex("--tex-walnut", () => texUrl("walnut", walnut));
    needTex("--tex-paper", tex.paperTile);
    if (indoor) {
      needTex("--wb-l", () => texUrl("bookL", () => bookcase(11, "left")));
      needTex("--wb-r", () => texUrl("bookR", () => bookcase(29, "right")));
    } else {
      needTex("--ws-l", () => texUrl("stallL", () => stallStack(13, "left")));
      needTex("--ws-r", () => texUrl("stallR", () => stallStack(41, "right")));
    }

    /* ---------------- The box: wings, lintel, lamp, clock, threads, globe ---------------- */
    const th = s.thread;
    const found = th ? th.found.length : 0;
    const total = th ? Math.max(th.total, found) : 0;
    acts.set("journal", ctx.journal.toggle);
    acts.set("classes", ctx.classes.toggle);
    const wtex = indoor ? ["var(--wb-l)", "var(--wb-r)"] : ["var(--ws-l)", "var(--ws-r)"];
    put(fore, `
<div class="wing l np" style="--wtex:${wtex[0]}"></div><div class="wing r np" style="--wtex:${wtex[1]}"></div>
<div class="cheek l np">${CHEEK("l")}</div><div class="cheek r np">${CHEEK("r")}</div>
<div class="post l np"></div><div class="post r np"></div>
${indoor ? "" : `<div class="hang l np">${P.lantern("")}</div><div class="hang r np">${P.lantern("")}</div>`}
<div class="lintel np"><div class="beam"></div><div class="dent">${DENTIL}</div><div class="awn">${P.valance()}</div></div>
<div class="cone np">${CONE}</div>
<div class="lamp np">${A.LAMP}</div>
<div class="clock" role="img" aria-label="Day ${s.day}, ${esc(s.time)}">${A.clock(s.time)}<div class="ribbon">Day ${s.day}<small>${esc(cap(s.time))}</small></div></div>
${th ? `<button class="spools" data-act="journal" style="--sw:${(3 + Math.min(9, total) * 3.4).toFixed(1)}" aria-label="The thread: ${found} of ${total} found. ${esc(th.goal)}. Open the journal" title="${esc(th.goal)}">${A.spoolRack(found, total)}<span class="lbl">THREADS ${found}/${total}</span><span class="goal">${esc(th.goal)}</span></button>` : ""}
<button class="globe" data-act="globe" aria-haspopup="true" aria-expanded="${pickOpen}" aria-label="Change the theme" title="Theme">${A.GLOBE}</button>`);

    /* ---------------- People: cut-outs behind the counter, opaque art framed on the wall behind ---------------- */
    // Four fit behind the counter; anyone else is in the guest book on the counter.
    const everyone = ctx.people(v);
    const people = everyone.slice(0, BEHIND_COUNTER);
    const others = everyone.slice(BEHIND_COUNTER).filter((p) => p.talkable);
    if (!others.length) othersOpen = false;
    const n = people.length;
    const step = n > 1 ? Math.min(0.155, 0.36 / (n - 1)) : 0;
    const fh = n <= 1 ? 80 : n === 2 ? 74 : 68;
    const castHtml: string[] = [];
    const plates: string[] = [];
    const again = () => !destroyed && ctx.rerender();
    people.forEach((p, i) => {
      const o = i - (n - 1) / 2;
      const pos = `--o:${o};--sp:${step.toFixed(3)}`;
      const art = ctx.personArt(v, p.id);
      const z = n > 2 && i === Math.floor(n / 2) ? 3 : 1 + (i % 2);
      if (p.talkable) acts.set(`p:${p.id}`, p.talk);
      const tagName = p.talkable ? "button" : "div";
      const attrs = p.talkable ? ` data-act="p:${esc(p.id)}" aria-label="Talk to ${esc(p.name)}"` : ` role="img" aria-label="${esc(p.name)}"`;
      plates.push(`<${tagName} class="plate"${attrs} style="${pos}" tabindex="-1">${P.WEDGE}<b>${esc(p.name)}</b><small>${esc(p.role)}</small></${tagName}>`);
      if (art && (!art.cutout || art.keyed)) {
        // Opaque art hangs on the wall behind the counter, framed, at the same depth as the others.
        castHtml.push(`<${tagName} class="wallpic"${attrs} style="${pos};--fh:${n <= 1 ? 44 : 38}cqh"><span class="cord"></span><span class="win" style="background-image:url('${esc(art.source)}')"></span>${A.frame(288, 400)}</${tagName}>`);
        return;
      }
      const clean = art ? cleanCutout(art.url, again) : null;
      const inner = art && clean ? `<img src="${esc(clean)}" alt="" draggable="false">` : A.SILHOUETTE;
      castHtml.push(`<${tagName} class="fig${art && clean ? "" : " loading"}"${attrs} style="${pos};--fh:${fh}cqh;--z:${z}">${inner}</${tagName}>`);
    });
    castHtml.push(`<div class="occ np"></div>`);
    put(cast, castHtml.join(""));

    /* ---------------- Props on the counter ---------------- */
    const used = new Set<string>();
    const take = (pred: (m: MenuItem) => boolean): MenuItem | null => {
      const m = menu.find((x) => !used.has(x.key) && pred(x)) ?? null;
      if (m) used.add(m.key);
      return m;
    };
    for (const p of everyone) if (p.talkable) used.add(`talk:${p.id}`);
    for (const p of others) acts.set(`p:${p.id}`, p.talk);
    const parts: string[] = [];

    // The easel: the place's painting (look around), the overland chart, or the delve's chart.
    const look = delve ? null : take((m) => m.kind === "search" && !hex);
    let board: string;
    if (delve) board = `<div class="board chart"><canvas width="600" height="760"></canvas></div>`;
    else if (hex) board = `<div class="board map"><svg class="hexsvg" role="group" aria-label="The overland"></svg></div>`;
    else {
      const pa = ctx.placeArt(v);
      const pic = `<div class="pic" ${pa ? `style="background-image:url('${esc(pa)}')"` : ""}></div>${box.isNew ? `<span class="seal">${A.SEAL_NEW}</span>` : ""}${look ? `<span class="lens">${esc(look.label)}</span>` : ""}`;
      if (look) acts.set(`m:${look.key}`, look.run);
      board = look ? `<button class="board" data-act="m:${esc(look.key)}" aria-label="${esc(look.label)}: ${esc(s.where)}">${pic}</button>` : `<div class="board" role="img" aria-label="${esc(s.where)}">${pic}</div>`;
    }
    // Postcards tucked on the easel's ledge: the ways out.
    const exits = menu.filter((m) => !used.has(m.key) && m.kind === "exit");
    exits.forEach((m) => used.add(m.key));
    const cards = exits.slice(0, 5).map((m, i) => {
      acts.set(`m:${m.key}`, m.run);
      const name = m.label.replace(/^Go to /i, "");
      const rot = -9 + i * 9;
      return `<button class="card" data-act="m:${esc(m.key)}" style="--r:${rot}deg;--i:${i}" aria-label="${esc(m.label)}"><span class="pic${m.art ? "" : " none"}" ${m.art ? `style="background-image:url('${esc(m.art)}')"` : ""}>${m.art ? "" : A.vista(seedOf(m.key) % 97)}</span>${A.POSTMARK}<b>${esc(name)}</b>${tip(m.label)}</button>`;
    });
    parts.push(`<div class="prop p-easel"><div class="rig"><span class="edge"></span>${A.EASEL}${board}<div class="plaque">${esc(s.where)}</div>${cards.length ? `<div class="cards" style="--n:${cards.length}">${cards.join("")}</div>` : ""}</div></div>`);

    // Tea: rest, and the party's vigor (inked on the napkin).
    const vig = `Vigor ${Math.round(s.vigor * 100)}%`;
    const rest = take((m) => m.kind === "rest");
    parts.push(prop("p-tea", P.teacup(s.vigor, !!rest), rest, vig));
    // Hourglass: wait (its sand is the time of day).
    const wait = take((m) => m.kind === "wait");
    if (wait) parts.push(prop("p-hour", P.hourglass(s.time, wait.label), wait, cap(s.time)));
    // The bounty: a fight.
    const fight = take((m) => m.group === "fight");
    if (fight) parts.push(prop("p-fight", P.dagger(fight.label), fight, fight.label));
    // The register: the purse, and the shop.
    const shop = take((m) => m.kind === "shop");
    parts.push(prop("p-reg", P.register(s.coin, s.currency, shop ? shop.label : null), shop, `${s.coin} ${s.currency}`));
    // The lantern: into a delve, or back out of one.
    const lantern = take((m) => m.kind === "delve" || m.key === "leave");
    if (lantern) parts.push(prop("p-lantern", P.lantern(lantern.key === "leave" ? "Leave" : "Explore"), lantern, lantern.label));
    // The compass: the delve's moves.
    if (delve) {
      const mv = (k: string) => {
        const m = menu.find((x) => x.key === `move:${k}`);
        if (m) {
          used.add(m.key);
          acts.set(`m:${m.key}`, m.run);
        }
        return m?.label;
      };
      parts.push(`<div class="prop p-compass">${P.compass({ fwd: mv("forward"), left: mv("left"), right: mv("right"), back: mv("back"), search: mv("search") }, v.delve!.facing)}</div>`);
    }
    // Supplies on the frontier: a row of jars.
    if (s.supplies) {
      const { now, max } = s.supplies;
      parts.push(`<div class="prop p-supp" style="--n:${max}" role="img" aria-label="Supplies ${now} of ${max}" title="Supplies ${now}/${max}">${Array.from({ length: max }, (_, i) => A.jar(i < now)).join("")}<span class="lbl">SUPPLIES ${now}/${max}</span></div>`);
    }
    // The books: Journal and Classes, titles stamped on their spines.
    parts.push(`<button class="prop act p-cls" data-act="classes" aria-pressed="${ctx.classes.open}" aria-label="Classes">${P.book("green", "Classes")}${tip("Classes")}</button>`);
    parts.push(`<button class="prop act p-jour" data-act="journal" aria-pressed="${ctx.journal.open}" aria-label="Journal">${P.book("red", "Journal")}${tip("Journal")}</button>`);
    if (others.length) parts.push(`<button class="prop p-letter" data-act="others" aria-haspopup="true" aria-expanded="${othersOpen}" aria-label="${others.length} others here" style="--x:0.66;--y:0.6">${A.LETTER}<span class="lbl">${others.length} others here</span></button>`);
    // Anything left over: sealed letters along the back, each with its label.
    menu.filter((m) => !used.has(m.key)).forEach((m, i) => {
      const x = 0.6 - (i % 5) * 0.055;
      parts.push(prop("p-letter", `${A.LETTER}<span class="lbl">${esc(m.label)}</span>`, m, m.label, ` style="--x:${x.toFixed(3)};--y:${i >= 5 ? 0.69 : 0.64}"`));
    });

    const deskChanged = put(desk, plates.join("") + parts.join(""));
    if (hex) {
      const svg = desk.querySelector<SVGSVGElement>(".hexsvg");
      const key = JSON.stringify([v.hex, menu.map((m) => m.key)]);
      if (svg && (deskChanged || svg.dataset.k !== key)) {
        svg.dataset.k = key;
        ctx.drawHex(svg, v);
      }
    }
    if (delve) {
      const c = desk.querySelector<HTMLCanvasElement>(".board.chart canvas");
      chartPaper ??= paper(53, 600, 760, [226, 210, 172]);
      if (c) drawChart(c, v.delve!, chartPaper);
    }

    /* ---------------- Narration and overlays ---------------- */
    put(say, narrationHtml(box, logOpen));
    say.classList.toggle("open", logOpen);
    const ov: string[] = [];
    if (ctx.journal.open) ov.push(journalHtml(ctx, v));
    if (pickOpen) ov.push(pickerHtml(ctx, v));
    if (othersOpen) ov.push(`<div class="pick" role="menu" aria-label="Also here">${others.map((p) => `<button role="menuitem" data-act="p:${esc(p.id)}">Talk to ${esc(p.name)}</button>`).join("")}</div>`);
    put(ovl, ov.join(""));
  }

  return {
    activate() {
      if (active) return;
      active = true;
      host.hidden = false;
      room.append(ctx.world);
      startFrame();
    },
    deactivate() {
      if (!active) return;
      active = false;
      host.hidden = true;
      stopFrame();
      stopFrame = () => {};
    },
    render,
    key(e) {
      if (e.key !== "Escape") return false;
      if (pickOpen || othersOpen) {
        pickOpen = false;
        othersOpen = false;
        rerender();
        return true;
      }
      if (ctx.journal.open) {
        ctx.journal.toggle();
        return true;
      }
      if (logOpen) {
        logOpen = false;
        rerender();
        return true;
      }
      return false;
    },
    destroy() {
      destroyed = true;
      stopFrame();
      ro.disconnect();
      if (paintRaf) cancelAnimationFrame(paintRaf);
      dr.removeEventListener("click", onClick);
      dr.removeEventListener("keydown", onKeydown);
    },
  };
}
