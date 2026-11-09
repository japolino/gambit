/**
 * Lobby: a gacha-style hub hall in dark-academia gold and ink.
 *
 * One lead stands full height left of centre on an asymmetric stage, an
 * open astrolabe halo turning behind their head; the other people present
 * wait in pocket-watch lockets beside them, and the lead's obsidian-glass
 * nameplate is the way to talk. A floating rail of gold-leaf objects
 * (grimoire, dividers, armillary) opens the Journal, Classes and the theme
 * list. On the right, the do-things actions are brass instruments on bolted
 * cartouches (telescope = look, casket = shop, balance = rest, pocket watch
 * = wait) and the go-to actions are layered place cards (a brass housing
 * holding a fanned dossier of prints, a tall filigree travel card).
 * Resources sit in brass troughs, the log runs as a bell ticker over the
 * gilded scene dossier, and talk lines (with each person's portrait) and
 * any leftover actions sit in the bottom dock. In a delve the instruments
 * become an inked chart table and a brass orienter of WASD paddles; on a
 * frontier the honeycomb is a brass-bound map among the cards.
 */
import { BOARD_SKINS } from "../board-skins.js";
import { esc, seedOf, type DelveView, type MenuItem, type PersonView, type SceneView, type ThemeCtx, type ThemeFactory, type ThemeRenderer } from "./contract.js";
import { beatsHtml, isWriting, wireWrite, writeFormHtml } from "./write.js";
import * as A from "./lobby/art.js";
import { lobbyCss } from "./lobby/css.js";
import { chartGround, chartSketch, hatch, leather, moteSprite, parchment } from "./lobby/tex.js";

/** Which instrument stands for which "do" action. */
const INSTRUMENT: Record<string, { art: (v: SceneView, tag: string | null) => string; sub: (v: SceneView) => string; cls: string }> = {
  search: { art: (_v, tag) => A.telescope(tag), sub: () => "Survey", cls: "lb-telescope" },
  shop: { art: () => A.casket(), sub: () => "Browse wares", cls: "lb-casket" },
  rest: { art: () => A.balance(), sub: () => "Recover vigor", cls: "lb-balance" },
  wait: { art: (v) => A.clock(v.clock.time), sub: (v) => `${v.clock.time} · Day ${v.clock.day}`, cls: "lb-clock" },
};
const INSTRUMENT_ORDER = ["search", "shop", "wait", "rest"];
/** Delve moves: the key printed on each paddle and the way the paddle points. */
const PADDLE: Record<string, [string, number]> = { forward: ["W", 0], right: ["D", 90], back: ["S", 180], left: ["A", -90] };
/** Journal sections that belong on the right-hand page. */
const RIGHT_PAGE = /remember|rumou?r|what you did/i;

export const lobby: ThemeFactory = (ctx: ThemeCtx): ThemeRenderer => {
  const root = ctx.root;
  root.innerHTML = `<style>${lobbyCss({ leather: leather(), parchment: parchment(), chart: chartGround() })}</style>${A.defs()}
<div class="lb${ctx.reducedMotion ? " rm" : ""}">
  <div class="lb-bg"></div>
  <div class="lb-grade"></div>
  <div class="lb-rays">${A.rays()}</div>
  <canvas class="lb-dust"></canvas>
  <div class="lb-shade"></div>
  <div class="lb-warm"></div>
  <div class="lb-vf" aria-hidden="true"><i class="a"></i><i class="b"></i><i class="c"></i><i class="d"></i></div>
  <div class="lb-stage">
    <div class="lb-scene">
      <div class="lb-glowback"></div>
      <div class="lb-hero"><div class="px"><div class="lb-hero-in"></div></div></div>
      <div class="lb-lockets" role="group" aria-label="People here"></div>
      <div class="lb-talkslot"></div>
      <header class="lb-badge"></header>
      <div class="lb-res"></div>
      <nav class="lb-rail" aria-label="System"></nav>
      <div class="lb-themes" role="menu" aria-label="Themes"></div>
    </div>
    <section class="lb-cluster" aria-label="Actions"><div class="lb-instr"></div><div class="lb-cards"></div></section>
    <div class="lb-dock"></div>
    <div class="lb-feed"><div class="lb-log" aria-live="polite"></div><div class="lb-story" aria-live="polite"></div>${writeFormHtml("lb-say")}<button class="lb-ticker" data-a="log"></button><div class="lb-banner"></div></div>
  </div>
  <div class="lb-journal" role="dialog" aria-label="Journal"></div>
</div>`;

  const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector(s) as T;
  const lb = $<HTMLDivElement>(".lb");
  const bg = $<HTMLDivElement>(".lb-bg");
  bg.append(ctx.world);
  const stage = $<HTMLDivElement>(".lb-stage");
  const el = {
    rays: $(".lb-rays"),
    glow: $(".lb-glowback"),
    hero: $(".lb-hero .px"),
    heroIn: $(".lb-hero-in"),
    lockets: $(".lb-lockets"),
    talk: $(".lb-talkslot"),
    badge: $(".lb-badge"),
    res: $(".lb-res"),
    rail: $(".lb-rail"),
    themes: $(".lb-themes"),
    cluster: $(".lb-cluster"),
    instr: $(".lb-instr"),
    cards: $(".lb-cards"),
    dock: $(".lb-dock"),
    feed: $(".lb-feed"),
    log: $(".lb-log"),
    ticker: $(".lb-ticker"),
    banner: $(".lb-banner"),
    journal: $(".lb-journal"),
    story: $(".lb-story"),
  };
  const write = wireWrite(ctx, $<HTMLFormElement>(".lb-say"), { maxRows: 4 });
  const dust = $<HTMLCanvasElement>(".lb-dust");

  /** Pieces that live across section rebuilds: the honeycomb (drawHex wires its own listeners) and the delve chart. */
  const hexSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  hexSvg.setAttribute("class", "map");
  const chartBox = document.createElement("div");
  chartBox.className = "lb-chart";
  chartBox.innerHTML = `<canvas width="420" height="420"></canvas>${A.chartRing()}<span class="ttl">${A.plaque(220, 42)}<b>The Chart</b></span>`;
  const chartCanvas = chartBox.querySelector("canvas")!;
  let hexSig = "";
  let mapSig = "";

  /* ------------------------------ UI state ------------------------------ */
  let view: SceneView | null = null;
  let leadId: string | null = null;
  let lead: PersonView | null = null;
  let cyc = 0;
  let themesOpen = false;
  let logOpen = false;
  let phone = false;
  let wide = false;
  const items = new Map<string, MenuItem>();
  const last = new WeakMap<Element, string>();

  /** Replace a section only when its markup changed: keeps render cheap and idempotent. */
  function put(target: Element, html: string): boolean {
    if (last.get(target) === html) return false;
    last.set(target, html);
    target.innerHTML = html;
    return true;
  }

  /* ------------------------------- Clicks ------------------------------- */
  function act(a: string): void {
    const [k, ...rest] = a.split(":");
    const arg = rest.join(":");
    if (k === "m") items.get(arg)?.run();
    else if (k === "talk") lead?.talk();
    else if (k === "lead") {
      leadId = arg;
      paint();
    } else if (k === "journal") ctx.journal.toggle();
    else if (k === "classes") ctx.classes.toggle();
    else if (k === "themes") {
      themesOpen = !themesOpen;
      paint();
    } else if (k === "theme") {
      themesOpen = false;
      ctx.setTheme(arg as never);
    } else if (k === "cyc") {
      cyc += Number(arg) || 0;
      paint();
    } else if (k === "log") {
      logOpen = !logOpen;
      paint();
    }
  }
  root.addEventListener("click", (e) => {
    const t = (e.target as Element).closest<HTMLElement>("[data-a]");
    if (!t || !root.contains(t)) return;
    e.stopPropagation();
    act(t.dataset.a!);
  });
  root.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement;
    if ((e.key === "Enter" || e.key === " ") && t.getAttribute("role") === "button" && t.dataset.a) {
      e.preventDefault();
      act(t.dataset.a);
    }
  });

  /* ------------------------------- Layout ------------------------------- */
  let unit = 1;
  /** Phone (one scrolling column) and wide (an ultrawide stage: the cluster spreads out). */
  function settle(): boolean {
    const w = stage.clientWidth;
    const h = Math.max(1, stage.clientHeight);
    // A short window (a phone on its side) gets the phone's column too: the design grid would shrink its text to nothing.
    const p = w < 760 || h < 480;
    const wd = !p && w / h >= 2;
    const changed = p !== phone || wd !== wide;
    phone = p;
    wide = wd;
    lb.classList.toggle("phone", p);
    lb.classList.toggle("wide", wd);
    lb.classList.toggle("land", p && w >= 560 && w > h);
    unit = p ? w / 560 : Math.min(w / 1920, h / 1080);
    return changed;
  }
  const ro = new ResizeObserver(() => {
    if (settle()) paint();
    const r = root.getBoundingClientRect();
    dust.width = Math.max(1, Math.round(r.width / 2));
    dust.height = Math.max(1, Math.round(r.height / 2));
    if (ctx.reducedMotion) drawDust(0, 0);
  });
  ro.observe(stage);

  /* --------------------------- Dust and parallax ------------------------ */
  const mote = moteSprite();
  const motes = Array.from({ length: 52 }, (_, i) => {
    const r = (n: number) => (seedOf(`mote${i}:${n}`) % 10000) / 10000;
    return { x: r(1), y: r(2), s: 0.35 + r(3) * 0.9, v: 0.006 + r(4) * 0.016, ph: r(5) * 6.28, a: 0.25 + r(6) * 0.6 };
  });
  function drawDust(t: number, dt: number): void {
    const g = dust.getContext("2d");
    if (!g) return;
    const W = dust.width;
    const H = dust.height;
    g.clearRect(0, 0, W, H);
    const sz = Math.max(4, H / 110);
    for (const m of motes) {
      m.y -= m.v * dt;
      if (m.y < -0.05) m.y = 1.05;
      const x = (m.x + Math.sin(t / 3000 + m.ph) * 0.012) * W;
      const y = m.y * H;
      g.globalAlpha = m.a * (0.6 + 0.4 * Math.sin(t / 900 + m.ph));
      const s = sz * m.s * 2;
      g.drawImage(mote, x - s / 2, y - s / 2, s, s);
    }
    g.globalAlpha = 1;
  }
  const layers: [HTMLElement, number][] = [
    [bg, 10],
    [el.rays, 14],
    [el.glow, 10],
    [el.hero, 16],
    [el.lockets, 20],
    [el.cluster, 24],
  ];
  let px = 9;
  let py = 9;
  const stop = ctx.onFrame((t, dt) => {
    if (ctx.reducedMotion) return;
    drawDust(t, dt);
    const p = phone ? { x: 0, y: 0 } : ctx.pointer();
    if (Math.abs(p.x - px) < 0.001 && Math.abs(p.y - py) < 0.001) return;
    px = p.x;
    py = p.y;
    for (const [node, k] of layers) node.style.transform = `translate3d(${(-px * k * unit).toFixed(1)}px, ${(-py * k * 0.55 * unit).toFixed(1)}px, 0)`;
  });

  /* --------------------------- Figure measuring ------------------------- */
  /**
   * Where a cutout's figure sits in its image: its horizontal centre, and in
   * how many rows it is cropped by both side edges. A figure whose shoulders
   * run off both sides of the picture is a close bust: it is staged with
   * feathered sides instead of standing on the floor.
   */
  const figure = new Map<string, { c: number; cover: number } | null>();
  function measure(url: string): { c: number; cover: number } | null | undefined {
    if (figure.has(url)) return figure.get(url);
    figure.set(url, null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let out = { c: 0.5, cover: 0.5 };
      try {
        const W = 64;
        const H = Math.max(8, Math.round((W * img.height) / Math.max(1, img.width)));
        const c = document.createElement("canvas");
        c.width = W;
        c.height = H;
        const g = c.getContext("2d", { willReadFrequently: true })!;
        g.drawImage(img, 0, 0, W, H);
        const px = g.getImageData(0, 0, W, H).data;
        const solid = (x: number, y: number) => px[(y * W + x) * 4 + 3]! >= 40;
        let sum = 0;
        let n = 0;
        let cropped = 0;
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) if (solid(x, y)) (sum += x), n++;
          if ((solid(0, y) || solid(1, y)) && (solid(W - 1, y) || solid(W - 2, y))) cropped++;
        }
        out = { c: n ? (sum / n + 0.5) / W : 0.5, cover: cropped / H };
      } catch {
        /* tainted or broken: treat it as a standing figure */
      }
      figure.set(url, out);
      ctx.rerender();
    };
    img.onerror = () => {
      figure.set(url, { c: 0.5, cover: 0.5 });
      ctx.rerender();
    };
    img.src = url;
    return undefined;
  }

  /* ------------------------------ Delve chart --------------------------- */
  const ink = hatch();
  /** The automap, hand-inked: hatched floor, double walls, room marks, a brass needle for you. */
  function drawChart(c: HTMLCanvasElement, d: DelveView): void {
    const g = c.getContext("2d");
    if (!g) return;
    const W = c.width;
    const H = c.height;
    g.clearRect(0, 0, W, H);
    const open = (x: number, y: number) => {
      const ch = d.grid[y]?.[x];
      return ch !== undefined && ch !== "?" && ch !== "#";
    };
    let x0 = d.x, x1 = d.x, y0 = d.y, y1 = d.y;
    d.grid.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === "?") return;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }));
    const span = Math.max(x1 - x0 + 3, y1 - y0 + 3, 7);
    const cell = Math.max(8, Math.min(44, Math.floor((Math.min(W, H) * 0.7) / span)));
    const ox = Math.floor(W / 2 - ((x0 + x1 + 1) / 2) * cell);
    const oy = Math.floor(H / 2 - ((y0 + y1 + 1) / 2) * cell);
    const pat = g.createPattern(ink, "repeat");
    for (let y = 0; y < d.grid.length; y++)
      for (let x = 0; x < d.grid[y]!.length; x++) {
        if (!open(x, y)) continue;
        const X = ox + x * cell;
        const Y = oy + y * cell;
        g.fillStyle = "rgba(58,46,33,.92)";
        g.fillRect(X, Y, cell, cell);
        if (pat) (g.fillStyle = pat), g.fillRect(X, Y, cell, cell);
        if (d.grid[y]![x] === "L") (g.fillStyle = "rgba(212,180,117,.16)"), g.fillRect(X, Y, cell, cell);
      }
    const inset = Math.max(2, cell * 0.12);
    g.lineCap = "square";
    for (let y = 0; y < d.grid.length; y++)
      for (let x = 0; x < d.grid[y]!.length; x++) {
        if (!open(x, y)) continue;
        const X = ox + x * cell;
        const Y = oy + y * cell;
        const edges: [boolean, number, number, number, number, number, number][] = [
          [!open(x, y - 1), X, Y, X + cell, Y, 0, inset],
          [!open(x, y + 1), X, Y + cell, X + cell, Y + cell, 0, -inset],
          [!open(x - 1, y), X, Y, X, Y + cell, inset, 0],
          [!open(x + 1, y), X + cell, Y, X + cell, Y + cell, -inset, 0],
        ];
        for (const [wall, ax, ay, bx, by, dx, dy] of edges) {
          if (!wall) continue;
          g.strokeStyle = "#D4B475";
          g.lineWidth = Math.max(1.4, cell * 0.07);
          g.beginPath();
          g.moveTo(ax, ay);
          g.lineTo(bx, by);
          g.stroke();
          g.strokeStyle = "rgba(212,180,117,.45)";
          g.lineWidth = 0.9;
          g.beginPath();
          g.moveTo(ax + dx, ay + dy);
          g.lineTo(bx + dx, by + dy);
          g.stroke();
        }
      }
    for (const r of d.rooms) {
      if (r.cleared && r.kind !== "boss") continue;
      const X = ox + r.x * cell + cell / 2;
      const Y = oy + r.y * cell + cell / 2;
      const s = cell * 0.26;
      g.lineWidth = Math.max(1.2, cell * 0.06);
      if (r.kind === "boss" || r.kind === "fight" || r.kind === "trap") {
        g.strokeStyle = r.kind === "boss" ? "#e0604c" : "#c4544a";
        g.beginPath();
        g.moveTo(X - s, Y - s);
        g.lineTo(X + s, Y + s);
        g.moveTo(X + s, Y - s);
        g.lineTo(X - s, Y + s);
        g.stroke();
      } else if (r.kind === "key" || r.kind === "treasure") {
        g.fillStyle = "#ffd27a";
        g.beginPath();
        g.moveTo(X, Y - s * 1.3);
        g.quadraticCurveTo(X, Y, X + s * 1.3, Y);
        g.quadraticCurveTo(X, Y, X, Y + s * 1.3);
        g.quadraticCurveTo(X, Y, X - s * 1.3, Y);
        g.quadraticCurveTo(X, Y, X, Y - s * 1.3);
        g.fill();
      } else if (r.kind === "rest") {
        g.strokeStyle = "#8fd18a";
        g.beginPath();
        g.arc(X, Y, s, 0, Math.PI * 2);
        g.stroke();
      }
    }
    // You: a brass compass needle, its dark tail behind.
    const cx = ox + d.x * cell + cell / 2;
    const cy = oy + d.y * cell + cell / 2;
    g.save();
    g.translate(cx, cy);
    g.rotate((d.facing * Math.PI) / 2);
    const L = cell * 0.95;
    const w = cell * 0.2;
    const gr = g.createLinearGradient(-w, 0, w, 0);
    gr.addColorStop(0, "#8c6224");
    gr.addColorStop(0.45, "#fff2c2");
    gr.addColorStop(1, "#b68d40");
    g.shadowColor = "rgba(0,0,0,.8)";
    g.shadowBlur = cell * 0.25;
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(0, -L * 0.62);
    g.lineTo(w, 0);
    g.lineTo(0, L * 0.12);
    g.lineTo(-w, 0);
    g.closePath();
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = "#3a2a14";
    g.beginPath();
    g.moveTo(0, L * 0.45);
    g.lineTo(w * 0.8, 0);
    g.lineTo(-w * 0.8, 0);
    g.closePath();
    g.fill();
    g.strokeStyle = "#2a1d0a";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, -L * 0.62);
    g.lineTo(w, 0);
    g.lineTo(0, L * 0.45);
    g.lineTo(-w, 0);
    g.closePath();
    g.stroke();
    g.fillStyle = "#d9b464";
    g.beginPath();
    g.arc(0, 0, cell * 0.12, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  /* ------------------------------- Pieces ------------------------------- */
  const plateSvg = A.plate();
  const haloSvg = A.halo();
  const bracketSvg = A.bracket();
  const dividerRule = `<svg class="rule" viewBox="0 0 320 10" preserveAspectRatio="none" aria-hidden="true"><path d="M0 5 H140" stroke="#c8aa6e" stroke-width="1"/><path d="M180 5 H320" stroke="#c8aa6e" stroke-width="1" opacity=".5"/><path d="M160 0 L166 5 L160 10 L154 5Z" fill="#e6c687"/><circle cx="146" cy="5" r="1.6" fill="#c8aa6e"/><circle cx="174" cy="5" r="1.6" fill="#c8aa6e"/></svg>`;
  const sep = `<i class="sep" aria-hidden="true"></i>`;
  const cornerPiece = `<svg class="cn tl" viewBox="0 0 96 96" aria-hidden="true"><path d="M0 0 H70 L60 10 H10 V60 L0 70Z" fill="url(#lb-brass)" stroke="#1c1308" stroke-width="1.5"/><path d="M14 14 H50 Q30 20 22 30 Q16 38 14 50Z" fill="url(#lb-brass)" stroke="#1c1308" stroke-width="1"/><circle cx="20" cy="20" r="4" fill="url(#lb-coin)" stroke="#1c1308"/></svg>`;
  const pip = (on: boolean, neg: boolean) => `<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 .8 L11.2 6 L6 11.2 L.8 6Z" fill="${on ? (neg ? "#8f2219" : "#6a3e14") : "none"}" stroke="${neg ? "#8f2219" : "#6a3e14"}" stroke-width="1.1"/></svg>`;

  function badge(v: SceneView): string {
    const s = ctx.status(v);
    const b = ctx.box(v);
    const art = ctx.placeArt(v);
    return `<div class="md">${A.medallion(art ? esc(art) : null)}</div>
<div class="sh">${A.shield()}<b><small>Day</small>${s.day}</b></div>
${b.isNew ? `<div class="new">${A.seal()}<b>NEW</b></div>` : ""}
<div class="rib"><b title="${esc(s.where)}">${esc(s.where)}</b>${dividerRule}<span><em class="dy">Day ${s.day} · </em>${esc(s.time)} · ${esc(v.delve ? "Delve" : s.card)}</span></div>`;
  }

  function resources(v: SceneView): string {
    const s = ctx.status(v);
    const out: string[] = [];
    const vig = Math.round(s.vigor * 100);
    out.push(`<div class="lb-tr${vig < 35 ? " low" : ""}" title="Vigor: ${vig} of 100" role="img" aria-label="Vigor ${vig} of 100">${A.trough(s.vigor)}<span class="ic">${A.flask()}</span><b>${vig}<small>/100</small></b><span class="cap">Vigor</span></div>`);
    out.push(`<div class="lb-tr" title="${s.coin} ${esc(s.currency)}" role="img" aria-label="${s.coin} ${esc(s.currency)}">${A.trough(null)}<span class="ic">${A.sovereign()}</span><b>${s.coin.toLocaleString()}<small>${esc(s.currency)}</small></b></div>`);
    if (s.thread) {
      const n = s.thread.found.length;
      out.push(`<div class="lb-tr" title="The thread: ${esc(s.thread.goal)} (${n} of ${s.thread.total} found)" role="img" aria-label="Thread ${n} of ${s.thread.total}: ${esc(s.thread.goal)}">${A.trough(s.thread.total ? n / s.thread.total : 0, "url(#lb-thread)")}<span class="ic">${A.spool()}</span><b>${n}<small>/ ${s.thread.total}</small></b><span class="cap">Thread</span></div>`);
    }
    if (s.supplies) {
      out.push(`<div class="lb-tr${s.supplies.now <= 2 ? " low" : ""}" title="Supplies: ${s.supplies.now} of ${s.supplies.max}" role="img" aria-label="Supplies ${s.supplies.now} of ${s.supplies.max}">${A.trough(s.supplies.max ? s.supplies.now / s.supplies.max : 0, "url(#lb-brassH)")}<span class="ic">${A.satchel()}</span><b>${s.supplies.now}<small>/ ${s.supplies.max}</small></b><span class="cap">Supplies</span></div>`);
    }
    if (v.delve) out.push(`<div class="lb-tr" title="Keys: ${v.delve.keys}" role="img" aria-label="${v.delve.keys} keys">${A.trough(null)}<span class="ic">${A.keyIcon()}</span><b>${v.delve.keys}<small>keys</small></b></div>`);
    return out.join("");
  }

  function rail(v: SceneView): string {
    return `<button data-a="journal" aria-pressed="${ctx.journal.open}" title="Journal (J)"><span class="ri">${A.grimoire()}</span><span>Journal</span></button>
<button data-a="classes" aria-pressed="${ctx.classes.open}" title="Classes (C)"><span class="ri">${A.dividers()}</span><span>Classes</span></button>
<button data-a="themes" aria-expanded="${themesOpen}" aria-haspopup="menu" title="Theme: ${esc(ctx.themes.find((t) => t.id === v.theme)?.label ?? "")}"><span class="ri">${A.armillary()}</span><span>Themes</span></button>`;
  }

  function themeList(v: SceneView): string {
    const pq = A.plaque(230, 46);
    return ctx.themes.map((t) => `<button role="menuitem" data-a="theme:${t.id}" aria-current="${t.id === v.theme}">${pq}${esc(t.label)}</button>`).join("");
  }

  /**
   * The lead in the room: a full figure stands on the floor; a close bust is
   * feathered at its cropped sides and hem so it melts into the hall, with
   * open acanthus brackets at its waist. Either way an open astrolabe halo
   * turns behind the head.
   */
  function heroHtml(v: SceneView): string {
    const halo = (cls: string) => `<div class="halo ${cls}">${haloSvg}</div>`;
    if (!lead) return halo("empty");
    const art = ctx.personArt(v, lead.id, "color");
    if (!art) return halo("arriving");
    const tag = lead.talkable ? `data-a="talk" role="button" tabindex="-1" aria-label="Talk to ${esc(lead.name)}"` : "";
    const brackets = `<div class="ped"></div><div class="brk l">${bracketSvg}</div><div class="brk r">${bracketSvg}</div>`;
    if (art.cutout) {
      const m = measure(art.url);
      if (!m) return halo("arriving");
      if (m.cover < 0.06) return `${halo("")}<img src="${esc(art.url)}" alt="${esc(lead.name)}" style="transform:translateX(${(-m.c * 100).toFixed(1)}%)" ${tag} draggable="false">`;
      // A close bust the host keyed itself has rough edges: feather the original painting instead.
      if (art.keyed && art.source) return `${halo("bust")}<img class="bust opaque" src="${esc(art.source)}" alt="${esc(lead.name)}" ${tag} draggable="false">${brackets}`;
      return `${halo("bust")}<img class="bust" src="${esc(art.url)}" alt="${esc(lead.name)}" ${tag} draggable="false">${brackets}`;
    }
    // Keying failed: the original painting, feathered on every side.
    return `${halo("bust")}<img class="bust opaque" src="${esc(art.source || art.url)}" alt="${esc(lead.name)}" ${tag} draggable="false">${brackets}`;
  }

  function lockets(v: SceneView, people: PersonView[]): string {
    if (people.length < 2) return "";
    return people
      .map((p) => {
        const art = ctx.personArt(v, p.id, "color");
        const on = p.id === lead?.id;
        return `<button class="lb-lk${on ? " on" : ""}" data-a="lead:${esc(p.id)}" aria-pressed="${on}" aria-label="Bring ${esc(p.name)} forward" title="${esc(p.name)}, ${esc(p.role)}">${A.locket(art ? esc(art.url) : null, esc(p.name.slice(0, 1)), on)}<span class="nm">${esc(phone ? p.name.split(/\s+/)[0]! : p.name)}</span></button>`;
      })
      .join("");
  }

  function talkPlaque(v: SceneView): string {
    if (v.delve) return "";
    if (!lead) return `<div class="lb-talk mute">${A.glassPlate()}<span class="nm">Nobody about</span><span class="rl">The hall is quiet</span></div>`;
    const inner = `${A.glassPlate()}<span class="nm" style="--n:${[...lead.name].length}">${esc(lead.name)}</span><span class="rl">${esc(lead.role)}</span>${lead.talkable ? `<span class="q">${A.quill()}</span>` : ""}`;
    return lead.talkable ? `<button class="lb-talk" data-a="talk" aria-label="Talk to ${esc(lead.name)}" title="Talk to ${esc(lead.name)}">${inner}</button>` : `<div class="lb-talk mute">${inner}</div>`;
  }

  function instrument(m: MenuItem, v: SceneView): string {
    const ins = INSTRUMENT[m.kind] ?? INSTRUMENT.search!;
    const t = ctx.status(v).thread;
    const tag = m.kind === "search" && t && t.total ? `${Math.round((t.found.length / t.total) * 100)}%` : null;
    return `<button class="lb-ins k-${esc(m.kind)} ${ins.cls}" data-a="m:${esc(m.key)}" aria-label="${esc(m.label)}">${ins.art(v, tag)}<span class="pl">${plateSvg}<b>${esc(m.label)}</b><i>${esc(ins.sub(v))}</i></span></button>`;
  }

  /** The delve orienter: four brass paddles with ivory WASD inlays around the lantern (search). */
  function orienter(v: SceneView, moves: MenuItem[]): string {
    const d = v.delve!;
    const btn = (m: MenuItem) => {
      const mv = m.target ?? "";
      if (mv === "search") return `<button class="mv-search" data-a="m:${esc(m.key)}" aria-label="${esc(m.label)} (Space)" title="${esc(m.label)} (Space)">${A.lantern()}</button>`;
      const [k, rot] = PADDLE[mv] ?? ["", 0];
      const ok = d.moves.includes(mv as never);
      return `<button class="mv-${esc(mv)}" data-a="m:${esc(m.key)}" aria-label="${esc(m.label)} (${k})" title="${esc(m.label)} (${k})"${ok ? "" : ` aria-disabled="true"`}>${A.paddle(k, rot)}</button>`;
    };
    const search = moves.find((m) => m.target === "search");
    return `<div class="lb-nav">${A.dial()}${moves.map(btn).join("")}<span class="lbl">${A.plaque(230, 42)}<b>${esc(search?.label ?? "Search")}</b></span></div>`;
  }

  function wideCardHtml(m: MenuItem, v: SceneView): string {
    const fight = m.group === "fight";
    const s = ctx.status(v);
    // A fight never reprints the room behind it: it gets the crimson woodcut.
    const art = fight ? null : (m.art ?? (m.key === "leave" ? ctx.placeArt(v) : null) ?? chartSketch(seedOf(m.key)));
    const vig = Math.round(s.vigor * 100);
    return `<button class="lb-card wide" data-a="m:${esc(m.key)}" aria-label="${esc(m.label)}">${A.wideCard(art ? esc(art) : null, fight, fight ? s.vigor : null)}
<span class="ttl"><b>${esc(m.label)}</b></span>
${fight ? `<span class="gauge">VIGOR</span><span class="gauge2">${vig}%</span>` : `<span class="gauge">${m.key === "leave" ? "RETURN TO THE LIGHT" : m.kind === "delve" ? "DESCEND" : "SET OUT"}</span>`}</button>`;
  }

  /** A tall travel card; `list` longer than one gets cycling arrows set into its side bosses. */
  function tallCardHtml(list: MenuItem[], offset: number): string {
    const i = ((offset % list.length) + list.length) % list.length;
    const m = list[i]!;
    const art = m.art ?? chartSketch(seedOf(m.key));
    const name = m.label.replace(/^Go to /, "");
    const many = list.length > 1;
    const arrows = many ? `<button class="cyc l" data-a="cyc:-1" aria-label="Previous destination">${A.sideArrow()}</button><button class="cyc r" data-a="cyc:1" aria-label="Next destination">${A.sideArrow()}</button>` : "";
    return `<div class="lb-card tall"><button class="hit" data-a="m:${esc(m.key)}" aria-label="${esc(m.label)}">${A.tallCard(esc(art), m.kind === "delve" ? "DELVE" : "TRAVEL", many)}</button>
<span class="ttl">${A.plaque(262, 50)}<b>${esc(name)}</b></span>${arrows}${many ? `<span class="pips">${i + 1} / ${list.length}</span>` : ""}</div>`;
  }

  function dockItem(m: MenuItem, v: SceneView, feat = false): string {
    let ic: string;
    if (m.group === "talk") {
      const p = v.people.find((x) => x.id === m.target);
      const art = m.target ? ctx.personArt(v, m.target, "color") : null;
      ic = A.miniPortrait(art ? esc(art.url) : null, esc((p?.name ?? "?").slice(0, 1)));
    } else ic = m.group === "go" ? (m.kind === "delve" || m.key === "leave" ? A.door() : A.rose()) : m.group === "fight" ? A.sabres() : A.rose();
    return `<button class="lb-dk${m.group === "talk" ? " talk" : ""}${feat ? " feat" : ""} g-${esc(m.group)}" data-a="m:${esc(m.key)}"><span class="ic">${ic}</span><span>${esc(m.label)}</span></button>`;
  }

  /** The line of the story to chase: the next open quest step, else the thread. */
  function hook(v: SceneView): string {
    const q = v.journal.quests.find((x) => !x.done);
    const step = q?.steps.find((x) => !x.done);
    if (q && step) return `<b>${esc(q.name)}</b> · ${esc(step.text)}`;
    const t = ctx.status(v).thread;
    return t ? `<b>The thread</b> · ${esc(t.goal)} (${t.found.length}/${t.total})` : "";
  }

  /** The journal: a two-page spread (story on the left, people and deeds on the right). */
  function journal(v: SceneView): string {
    const s = ctx.status(v);
    const tpl = document.createElement("template");
    tpl.innerHTML = ctx.journal.html(v);
    // Affinity as inked diamond pips instead of a bar.
    tpl.content.querySelectorAll<HTMLElement>(".aff").forEach((a) => {
      const i = a.querySelector("i");
      const neg = !!i?.classList.contains("neg");
      const n = Math.max(0, Math.min(5, Math.round((parseFloat(i?.style.width ?? "0") || 0) / 10)));
      a.className = "pips";
      a.innerHTML = Array.from({ length: 5 }, (_, k) => pip(k < n, neg)).join("");
      a.title = `${neg ? "Against you" : "With you"}: ${n} of 5`;
    });
    const left: string[] = [];
    const right: string[] = [];
    let into = left;
    let cur: string[] = [];
    const flush = () => {
      if (!cur.length) return;
      const html = cur.join("");
      into.push(/what you did/i.test(html.slice(0, 80)) ? `<div class="ledger">${html}</div>` : html);
      cur = [];
    };
    for (const n of [...tpl.content.childNodes]) {
      if (n instanceof HTMLElement && n.tagName === "H3") {
        flush();
        into = RIGHT_PAGE.test(n.textContent ?? "") ? right : left;
        cur.push(n.outerHTML + A.fleuron());
      } else if (n instanceof HTMLElement) cur.push(n.outerHTML);
    }
    flush();
    const t = s.thread;
    const thread = t ? `<div class="thread"><b>The Thread · ${t.found.length} of ${t.total}</b>${esc(t.goal)}${t.found.length ? `<span>${t.found.map(esc).join(" · ")}</span>` : ""}</div>` : "";
    return `<div class="lb-book">${cornerPiece}${cornerPiece.replace("cn tl", "cn tr")}${cornerPiece.replace("cn tl", "cn bl")}${cornerPiece.replace("cn tl", "cn br")}
<div class="lb-pages">
  <div class="pg l"><h2>${esc(s.card)}</h2>${A.fleuron()}${thread}${left.join("")}<div class="orn" aria-hidden="true">${A.rose()}</div></div>
  <div class="pg r"><div class="wm" aria-hidden="true">${A.armillary()}</div>${right.join("")}</div>
</div>
<div class="lb-gutter"></div>
<button class="lb-jx" data-a="journal" aria-label="Close the journal" title="Close (J / Esc)">${A.ribbonClose()}</button></div>`;
  }

  /* ------------------------------- Render ------------------------------- */
  function paint(): void {
    const v = view;
    if (!v) return;
    const s = ctx.status(v);
    const b = ctx.box(v);
    const menu = ctx.menu(v);
    items.clear();
    for (const m of menu) items.set(m.key, m);
    lb.classList.toggle("busy", !!b.busy);
    lb.classList.toggle("delve", !!v.delve);

    // The lead: the one chosen from the lockets, else the first you can talk to.
    const people = ctx.people(v);
    lead = people.find((p) => p.id === leadId) ?? people.find((p) => p.talkable) ?? people[0] ?? null;

    put(el.badge, badge(v));
    put(el.res, resources(v));
    put(el.rail, rail(v));
    el.themes.classList.toggle("on", themesOpen);
    put(el.themes, themesOpen ? themeList(v) : "");

    const d = v.delve;
    if (d) {
      put(el.heroIn, "");
      put(el.lockets, "");
      put(el.talk, "");
    } else {
      put(el.heroIn, heroHtml(v));
      put(el.lockets, lockets(v, people));
      put(el.talk, talkPlaque(v));
    }

    // Right cluster.
    const dock: MenuItem[] = [];
    let instr = "";
    let cards = "";
    let wantHex = false;
    if (d) {
      const moves = menu.filter((m) => m.group === "move");
      const leave = menu.filter((m) => m.group !== "move");
      instr = `<span class="chartslot"></span>${orienter(v, moves)}`;
      cards = leave.length ? (phone ? dockItem(leave[0]!, v, true) : wideCardHtml(leave[0]!, v)) : "";
      dock.push(...leave.slice(1));
    } else {
      const doing = menu.filter((m) => m.group === "do").sort((x, y) => INSTRUMENT_ORDER.indexOf(x.kind) - INSTRUMENT_ORDER.indexOf(y.kind));
      const shown = doing.filter((m) => INSTRUMENT[m.kind]).slice(0, 4);
      dock.push(...doing.filter((m) => !shown.includes(m)));
      instr = shown.map((m) => instrument(m, v)).join("");
      el.instr.classList.toggle("n4", shown.length >= 4);
      const fight = menu.find((m) => m.group === "fight");
      const goes = menu.filter((m) => m.group === "go");
      const featured = fight ?? goes[0];
      const rest = fight ? goes : goes.slice(1);
      const parts: string[] = [];
      // A phone lists every way on as a plain row: nothing hidden behind arrows, no card taller than the screen.
      if (featured) parts.push(phone ? dockItem(featured, v, true) : wideCardHtml(featured, v));
      if (v.hex) {
        wantHex = true;
        parts.push(`<div class="lb-hex">${A.chartFrame()}<span class="hexslot"></span><span class="ttl">${A.plaque(280, 46)}<b>${v.hex.wild ? "The Wilds" : "Frontier Chart"}</b></span></div>`);
        dock.push(...rest);
      } else if (rest.length) {
        // A wide stage shows two travel cards: the first fixed, the second cycling the rest.
        if (phone) dock.push(...rest);
        else if (wide && rest.length > 1) parts.push(tallCardHtml([rest[0]!], 0), tallCardHtml(rest.slice(1), cyc));
        else parts.push(tallCardHtml(rest, cyc));
      }
      cards = parts.join("");
      dock.unshift(...menu.filter((m) => m.group === "talk"));
    }
    if (put(el.instr, instr) && d) el.instr.querySelector(".chartslot")?.replaceWith(chartBox);
    if (d) {
      const sig = JSON.stringify([d.grid, d.x, d.y, d.facing, d.rooms]);
      if (sig !== mapSig) {
        mapSig = sig;
        drawChart(chartCanvas, d);
      }
    }
    if (put(el.cards, cards) && wantHex) el.cards.querySelector(".hexslot")?.replaceWith(hexSvg);
    if (wantHex) {
      const sig = JSON.stringify([v.hex, v.menu.map((m) => m.id)]);
      if (sig !== hexSig) {
        hexSig = sig;
        ctx.drawHex(hexSvg, v);
      }
    }
    put(el.dock, dock.map((m) => dockItem(m, v)).join(sep));

    // Feed: older lines in a smoked-glass drawer, the newest on the bell ticker, the dossier below.
    const log = b.log;
    const older = logOpen ? log.slice(0, -1) : log.slice(-4, -1);
    el.feed.classList.toggle("open", logOpen);
    el.log.classList.toggle("none", !older.length);
    put(el.log, older.length ? `<svg class="lc l" viewBox="0 0 20 20" aria-hidden="true"><path d="M1 19 V1 H19" fill="none" stroke="url(#lb-brass)" stroke-width="2"/><circle cx="1.5" cy="1.5" r="1.5" fill="#e6c687"/></svg>${older.map((l) => `<p>${esc(l)}</p>`).join("")}` : "");
    write.sync(v, ctx.journal.open);
    const writing = isWriting(v);
    el.feed.classList.toggle("writing", writing);
    lb.classList.toggle("writing", writing);
    if (put(el.story, writing ? beatsHtml(v.story) : "") && writing) {
      el.story.scrollTop = el.story.scrollHeight;
      // On a phone the page is what scrolls: bring the newest beat up to read.
      if (phone)
        requestAnimationFrame(() => {
          if (lb.classList.contains("land")) $(".lb-say").scrollIntoView({ block: "end" });
          else el.story.lastElementChild?.scrollIntoView({ block: "start" });
        });
    }
    el.ticker.classList.toggle("busy", !!b.busy);
    el.ticker.setAttribute("aria-expanded", String(logOpen));
    el.ticker.setAttribute("aria-label", logOpen ? "Hide the log" : "Show the whole log");
    put(
      el.ticker,
      `${A.tickerFrame()}<span class="bell">${A.bell()}</span>${b.busy ? `<span class="gears">${A.gears()}</span><span class="txt">${esc(b.busy)}</span>` : `<span class="tag">News</span><span class="txt">${esc(log[log.length - 1] ?? "All is quiet in the hall.")}</span>`}${log.length > 1 ? `<span class="more">${logOpen ? "Hide" : `Log · ${log.length}`}</span>` : ""}`,
    );
    const hk = d ? "" : hook(v);
    put(
      el.banner,
      `${A.bannerFrame()}${b.isNew ? `<div class="new">${A.seal()}<b>NEW</b></div>` : ""}<div class="tx"><span class="sub">${d ? "In the delve" : `The scene · ${esc(s.time)}`}</span><span class="ds">${esc(b.desc)}</span>${hk ? `<span class="hk"><span class="sp">${A.spool()}</span><span>${hk}</span></span>` : ""}</div>`,
    );

    el.journal.classList.toggle("on", ctx.journal.open);
    put(el.journal, ctx.journal.open ? journal(v) : "");
  }

  return {
    boardSkin: BOARD_SKINS.lobby,
    render(v) {
      view = v;
      // The resize observer stays quiet in a hidden tab: settle the layout here too.
      settle();
      ctx.backdrop(v, { post: "none", dolly: 0 });
      paint();
    },
    key(e, v) {
      const k = e.key.toLowerCase();
      if (k === "escape") {
        if (ctx.journal.open) ctx.journal.toggle();
        else if (themesOpen || logOpen) {
          themesOpen = logOpen = false;
          paint();
        } else return false;
        return true;
      }
      if (k === "j") return ctx.journal.toggle(), true;
      if (k === "c") return ctx.classes.toggle(), true;
      if ((k === "[" || k === "]") && !v.delve) {
        const people = ctx.people(v);
        if (people.length < 2) return false;
        const i = people.findIndex((p) => p.id === lead?.id);
        leadId = people[(i + (k === "]" ? 1 : -1) + people.length) % people.length]!.id;
        paint();
        return true;
      }
      return false;
    },
    destroy() {
      stop();
      ro.disconnect();
    },
  };
};
