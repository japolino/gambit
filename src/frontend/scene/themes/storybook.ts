/**
 * Storybook: an illuminated fairy-tale stage. The painted place fills the
 * window, framed at the four corners by gilt acanthus like a painted plate.
 * The cast stands large behind a lavish dialogue page (a mahogany cradle, a
 * scalloped gilt border, watermarked vellum, a brass nameplate astride its
 * top rim) which rests on a full-width espresso skirt with a gilt rim, so the
 * page anchors the whole bottom of the window. Every person stands behind a
 * crimson name scroll with a "Talk" diamond; opaque or roughly keyed art is
 * shown life-size in a gilt arch. Choices are silk ribbons with brass
 * medallions; status hangs as silk bookmarks from the top of the book; the
 * chapter header is a scroll with an astrolabe for the time of day; Journal,
 * Classes and the binding (theme) are notched leather index tabs on the
 * page's top rim; the journal opens as a thick two-page book. In a delve
 * the corridor is an illustration framed in a gilt arch on the book's page.
 * Parallax: painting, cast (two depths) and the frame move with the pointer.
 */
import { BOARD_SKINS } from "../board-skins.js";
import { beatsHtml, isWriting, wireWrite, writeFormHtml } from "./write.js";
import { esc, seedOf, rng, type MenuItem, type PersonView, type SceneView, type ThemeCtx, type ThemeFactory, type ThemeRenderer } from "./contract.js";
import {
  BRASS_CORNER, COIN, DEFS, DIVIDER, DIVIDER_KNOT, DLG_PAD, IRONKEY, NIB, PLATE_BAND, QUILL, ROSE, SATCHEL, SCROLL_BAND, SCROLL_END, SPOOL, TAB,
  affinitySeal, aperture, astrolabe, bookmark, cameo, cornerFlourish, dialogueFrame, dropCap, folio, icon, medallion, nameScroll, phial, plateCap, ribbon, skirt, waxSeal,
} from "./storybook/art.js";
import { bustOf, godRays, warmGround } from "./storybook/textures.js";
import { css } from "./storybook/style.js";
import { fitScroll } from "./storybook/scroll-fit.js";

const ROMAN: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
function roman(n: number): string {
  let s = "";
  let x = Math.max(1, Math.floor(n));
  for (const [v, r] of ROMAN) while (x >= v) (s += r), (x -= v);
  return s;
}

/** Where the cast stands (centre x in % of the window, scale), by how many are on stage: clustered left of centre. */
const SLOTS: Record<number, { x: number; s: number }[]> = {
  1: [{ x: 40, s: 1 }],
  2: [{ x: 33, s: 1 }, { x: 52, s: 0.95 }],
  3: [{ x: 38, s: 1 }, { x: 23, s: 0.95 }, { x: 54, s: 0.95 }],
  4: [{ x: 38, s: 1 }, { x: 22, s: 0.94 }, { x: 53, s: 0.95 }, { x: 67, s: 0.92 }],
};
/** With a map folio on the left, the cast steps right. */
const SLOTS_MAP: Record<number, { x: number; s: number }[]> = {
  1: [{ x: 48, s: 1 }],
  2: [{ x: 44, s: 1 }, { x: 61, s: 0.95 }],
  3: [{ x: 46, s: 1 }, { x: 34, s: 0.94 }, { x: 62, s: 0.95 }],
};
const PHONE_SLOTS: Record<number, { x: number; s: number }[]> = {
  1: [{ x: 56, s: 1 }],
  2: [{ x: 40, s: 1 }, { x: 74, s: 0.92 }],
  3: [{ x: 50, s: 1 }, { x: 20, s: 0.88 }, { x: 80, s: 0.88 }],
};

const PATTERN: Record<MenuItem["group"], string> = { talk: "sb-pat-talk", do: "sb-pat-do", go: "sb-pat-go", fight: "sb-pat-fight", move: "sb-pat-do" };

function iconFor(m: MenuItem): string {
  if (m.group === "move") return m.target === "search" ? "lantern" : (m.target ?? "forward");
  if (m.key === "leave") return "exit";
  return m.kind;
}

const POINTER = `<svg class="ptr" viewBox="0 0 18 18" aria-hidden="true"><path d="M2,2 L16,9 L2,16 L6,9 Z" fill="currentColor" stroke="#3a1a08" stroke-width="1"/></svg>`;

/** The journal's closing ribbon: a crimson silk bookmark hanging from the spine. */
const SHUT_RIBBON = `<svg viewBox="0 0 56 170" preserveAspectRatio="none" aria-hidden="true"><path d="M8,0 H48 V170 L28,150 L8,170 Z" fill="url(#sb-pat-crimson)"/><path d="M8,0 H48 V170 L28,150 L8,170 Z" fill="url(#sb-silk-shade)"/><path d="M13,0 V158 L28,143 L43,158 V0" fill="none" stroke="#f6dfae" stroke-width="1" stroke-dasharray="3 2.4" opacity=".75"/><g transform="translate(28,120)" fill="none" stroke="#fff1cf" stroke-width="2.4" stroke-linecap="round"><path d="M-6,-6 L6,6 M6,-6 L-6,6"/></g></svg>`;

export const storybook: ThemeFactory = (ctx: ThemeCtx): ThemeRenderer => {
  const root = ctx.root;
  root.innerHTML = `<style>${css()}</style>
  <div class="sb${ctx.reducedMotion ? " still" : ""}">
    ${DEFS}
    <div class="sb-pagebg"><svg class="wm l" viewBox="0 0 260 260" aria-hidden="true"><use href="#sb-sprig"/></svg><svg class="wm r" viewBox="0 0 260 260" aria-hidden="true"><use href="#sb-sprig"/></svg></div>
    <div class="sb-bg"></div>
    <div class="sb-ap"><div class="ink"></div><div class="brush"></div><div class="fog"></div><div class="torch"></div><div class="vg"></div><div class="fr"></div></div>
    <div class="sb-grade"></div>
    <img class="sb-rays" alt="" src="${godRays()}">
    <div class="sb-st sb-cast"><div class="layer back"></div><div class="layer front"></div></div>
    <div class="sb-vig"></div>
    <canvas class="sb-motes"></canvas>
    <div class="sb-corners">${["tl", "tr", "bl", "br"].map((c) => `<div class="sb-corner ${c}">${cornerFlourish()}</div>`).join("")}</div>
    <div class="sb-st sb-ui">
      <div class="sb-folio" hidden></div>
      <header class="sb-head"></header>
      <div class="sb-marks"></div>
      <nav class="sb-choices" aria-label="What will you do?"></nav>
      <div class="sb-skirt"></div>
      <div class="sb-tags"></div>
      <section class="sb-dlg" aria-label="The story">
        <div class="tabs">
          <button class="tab" data-sys="journal" aria-pressed="false" title="Journal (J)">${TAB}${icon("journal")}<span class="tl">Journal</span></button>
          <button class="tab" data-sys="classes" aria-pressed="false" title="Classes (C)">${TAB}${icon("classes")}<span class="tl">Classes</span></button>
          <button class="tab" data-sys="theme" aria-expanded="false" aria-haspopup="true" title="Change the binding">${TAB}${icon("theme")}<span class="tl">Binding</span></button>
        </div>
        <div class="frame back"></div><div class="vellum"></div><div class="frame front"></div>
        <div class="plate"><span class="cap">${plateCap(false)}</span><span class="band">${PLATE_BAND}<span class="nm"></span></span><span class="cap">${plateCap(true)}</span><span class="seal" hidden></span></div>
        <div class="page" aria-live="polite"><div class="sb-goal" hidden></div><div class="txt"></div></div>
        ${writeFormHtml("sb-say")}
        <div class="nib">${NIB}</div>
      </section>
    </div>
  </div>`;

  const $ = <T extends Element>(s: string) => root.querySelector(s) as T;
  const sb = $<HTMLDivElement>(".sb");
  const bg = $<HTMLDivElement>(".sb-bg");
  bg.append(ctx.world);
  const rays = $<HTMLImageElement>(".sb-rays");
  const motes = $<HTMLCanvasElement>(".sb-motes");
  const castBack = $<HTMLDivElement>(".sb-cast .back");
  const castFront = $<HTMLDivElement>(".sb-cast .front");
  const corners = $<HTMLDivElement>(".sb-corners");
  const ui = $<HTMLDivElement>(".sb-ui");
  const head = $<HTMLElement>(".sb-head");
  const goalEl = $<HTMLElement>(".sb-goal");
  const marks = $<HTMLDivElement>(".sb-marks");
  const choices = $<HTMLElement>(".sb-choices");
  const dlg = $<HTMLElement>(".sb-dlg");
  const frameBack = $<HTMLDivElement>(".sb-dlg .frame.back");
  const frameFront = $<HTMLDivElement>(".sb-dlg .frame.front");
  const vellum = $<HTMLDivElement>(".sb-dlg .vellum");
  const plateName = $<HTMLSpanElement>(".sb-dlg .plate .nm");
  const seal = $<HTMLSpanElement>(".sb-dlg .plate .seal");
  const pageEl = $<HTMLDivElement>(".sb-dlg .page");
  const txt = $<HTMLDivElement>(".sb-dlg .txt");
  const fol = $<HTMLDivElement>(".sb-folio");
  const write = wireWrite(ctx, $<HTMLFormElement>(".sb-say"), { maxRows: 4 });
  const skirtEl = $<HTMLDivElement>(".sb-skirt");
  const tags = $<HTMLDivElement>(".sb-tags");
  const apFrame = $<HTMLDivElement>(".sb-ap .fr");
  const tabJ = $<HTMLButtonElement>('[data-sys="journal"]');
  const tabC = $<HTMLButtonElement>('[data-sys="classes"]');
  const tabT = $<HTMLButtonElement>('[data-sys="theme"]');

  let view: SceneView | null = null;
  let menu: MenuItem[] = [];
  let people: PersonView[] = [];
  let slip: HTMLDivElement | null = null;
  let jr: HTMLDivElement | null = null;
  const seen = { head: "", marks: "", plate: "", txt: "", choices: "", cast: "", folio: "", jr: "" };
  let lastLog: string[] = [];

  /* --------------------------- Events (delegated) --------------------------- */
  function onClick(e: MouseEvent): void {
    const t = e.target as Element;
    // On a phone a tap beside the open slip only closes it (it covers the page: the tap can't have been meant for what's under it).
    if (slip && plainPage() && !t.closest(".sb-slip, [data-sys=theme]")) return closeSlip();
    const act = t.closest<HTMLElement>("[data-act]");
    if (act) return void menu.find((m) => m.key === act.dataset.act)?.run();
    const talk = t.closest<HTMLElement>("[data-talk]");
    if (talk) {
      const p = people.find((x) => x.id === talk.dataset.talk);
      if (p?.talkable) p.talk();
      return;
    }
    const sys = t.closest<HTMLElement>("[data-sys]");
    if (sys) {
      const k = sys.dataset.sys;
      if (k === "journal") ctx.journal.toggle();
      else if (k === "classes") ctx.classes.toggle();
      else if (k === "theme") toggleSlip();
      return;
    }
    const th = t.closest<HTMLElement>("[data-theme]");
    if (th) {
      closeSlip();
      ctx.setTheme(th.dataset.theme as never);
      return;
    }
    if (slip && !t.closest(".sb-slip")) closeSlip();
  }
  sb.addEventListener("click", onClick);
  function onOver(e: PointerEvent): void {
    const f = (e.target as Element).closest<HTMLElement>(".fig, .tag");
    const id = f?.dataset.talk ?? "";
    for (const t of tags.querySelectorAll<HTMLElement>(".tag")) t.classList.toggle("hot", t.dataset.talk === id);
    for (const g of root.querySelectorAll<HTMLElement>(".sb-cast .fig")) g.classList.toggle("hot", g.dataset.talk === id);
  }
  sb.addEventListener("pointerover", onOver);

  function toggleSlip(): void {
    if (slip) return closeSlip();
    const cur = view?.theme;
    slip = document.createElement("div");
    slip.className = "sb-slip";
    slip.setAttribute("role", "menu");
    slip.innerHTML = `<h4>Choose a binding</h4>${ctx.themes.map((t) => `<button role="menuitem" data-theme="${t.id}" aria-current="${t.id === cur}">${esc(t.label)}</button>`).join("")}`;
    const r = tabT.getBoundingClientRect();
    const rr = sb.getBoundingClientRect();
    if (plainPage()) {
      // A phone: over the top of the window, where all of it fits (the stylesheet caps its height).
      slip.style.left = "50%";
      slip.style.top = "8px";
      slip.style.transform = "translateX(-50%)";
    } else {
      slip.style.left = `${Math.max(8, Math.min(rr.width - 250, r.left - rr.left - 40))}px`;
      slip.style.bottom = `${Math.max(8, rr.bottom - r.top + 10)}px`;
    }
    sb.append(slip);
    tabT.setAttribute("aria-expanded", "true");
    (slip.querySelector('[aria-current="true"]') as HTMLElement | null)?.focus();
  }
  function closeSlip(): void {
    slip?.remove();
    slip = null;
    tabT.setAttribute("aria-expanded", "false");
  }

  /* --------------------------- Dialogue frame size -------------------------- */
  let fw = 0, fh = 0;
  /** Phone or short window: the stylesheet drops the page's frame and the skirt, so don't draw them. */
  const plainPage = () => ui.clientWidth <= 760 || ui.clientHeight <= 480;
  const ro = new ResizeObserver(() => {
    const w = Math.round(dlg.clientWidth), h = Math.round(dlg.clientHeight);
    if (!w || !h || (w === fw && h === fh)) return;
    fw = w;
    fh = h;
    if (plainPage()) {
      frameBack.innerHTML = frameFront.innerHTML = "";
      return;
    }
    const fr = dialogueFrame(w, h);
    for (const [elx, html] of [[frameBack, fr.back], [frameFront, fr.front]] as const) {
      elx.style.left = `${-DLG_PAD.x}px`;
      elx.style.top = `${-DLG_PAD.top}px`;
      elx.innerHTML = html;
    }
    vellum.style.clipPath = `path("${fr.page}")`;
    sizeArt();
  });
  ro.observe(dlg);
  let skirtKey = "", apKey = "";
  /** Redraw the size-bound art: the full-width skirt and the delve's arch. */
  function sizeArt(): void {
    const W = Math.round(ui.clientWidth), H = Math.round(Math.min(160, ui.clientHeight * 0.17));
    const x0 = Math.round(dlg.offsetLeft), x1 = Math.round(dlg.offsetLeft + dlg.offsetWidth);
    const k = `${W}|${H}|${x0}|${x1}`;
    if (W && k !== skirtKey && !plainPage()) {
      skirtKey = k;
      skirtEl.innerHTML = skirt(W, H, x0, x1);
    }
    const ab = apFrame.parentElement!;
    const aw = Math.round(ab.clientWidth), ah = Math.round(ab.clientHeight);
    const ak = `${aw}|${ah}`;
    if (aw && ah && ak !== apKey && sb.dataset.mode === "delve") {
      apKey = ak;
      apFrame.innerHTML = aperture(aw, ah);
    }
  }
  const stageRo = new ResizeObserver(() => {
    // The cast's slots depend on the stage shape (phone or wide): rebuild them.
    seen.cast = "";
    sizeArt();
    sizeMotes();
    if (ctx.reducedMotion) drawMotes(0, 0);
    if (view) render(view);
  });
  stageRo.observe(ui);

  /* --------------------------- Light: motes and rays ------------------------ */
  type Mote = { x: number; y: number; vx: number; vy: number; r: number; ph: number };
  const R = rng(seedOf("storybook-motes"));
  const dust: Mote[] = Array.from({ length: 34 }, () => ({ x: R(), y: R(), vx: -0.004 - R() * 0.008, vy: 0.006 + R() * 0.01, r: 0.6 + R() * 1.8, ph: R() * 6.28 }));
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 32;
  {
    const g = sprite.getContext("2d")!;
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, "rgba(255,236,190,1)");
    gr.addColorStop(0.3, "rgba(255,214,150,.55)");
    gr.addColorStop(1, "rgba(255,200,120,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 32, 32);
  }
  function sizeMotes(): void {
    const w = Math.max(1, Math.round(sb.clientWidth / 2)), h = Math.max(1, Math.round(sb.clientHeight / 2));
    if (motes.width !== w || motes.height !== h) {
      motes.width = w;
      motes.height = h;
    }
  }
  sizeMotes();
  function drawMotes(t: number, dt: number): void {
    const g = motes.getContext("2d")!;
    const W = motes.width, H = motes.height;
    g.clearRect(0, 0, W, H);
    for (const m of dust) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.y > 1.05 || m.x < -0.05) {
        m.x = 0.45 + R() * 0.6;
        m.y = -0.05;
      }
      // Brighter inside the shaft of light from the upper right.
      const inRay = Math.max(0, 1 - Math.abs(m.x - (0.95 - m.y * 0.55)) * 3);
      const a = (0.25 + 0.75 * inRay) * (0.55 + 0.45 * Math.sin(t / 700 + m.ph));
      const s = m.r * 6 * (H / 450);
      g.globalAlpha = Math.max(0, a);
      g.drawImage(sprite, m.x * W - s / 2, m.y * H - s / 2, s, s);
    }
    g.globalAlpha = 1;
  }

  /* --------------------------- Parallax ------------------------------------ */
  let px = 9, py = 9;
  const stopFrame = ctx.onFrame((t, dt) => {
    // A phone has no pointer to follow, and its light is gone (the stylesheet).
    if (ctx.reducedMotion || plainPage()) return;
    const p = ctx.pointer();
    if (Math.abs(p.x - px) > 0.0005 || Math.abs(p.y - py) > 0.0005) {
      px = p.x;
      py = p.y;
      bg.style.transform = `translate3d(${(-p.x * 12).toFixed(2)}px, ${(-p.y * 7).toFixed(2)}px, 0)`;
      castBack.style.transform = `translate3d(${(-p.x * 16).toFixed(2)}px, ${(-p.y * 9).toFixed(2)}px, 0)`;
      castFront.style.transform = `translate3d(${(-p.x * 26).toFixed(2)}px, ${(-p.y * 14).toFixed(2)}px, 0)`;
      ui.style.transform = `translate3d(${(p.x * 6).toFixed(2)}px, ${(p.y * 4).toFixed(2)}px, 0)`;
      corners.style.transform = `translate3d(${(p.x * 9).toFixed(2)}px, ${(p.y * 6).toFixed(2)}px, 0)`;
    }
    rays.style.transform = `translate3d(${(-p.x * 20).toFixed(2)}px, ${(-p.y * 8).toFixed(2)}px, 0)`;
    rays.style.opacity = (0.62 + 0.16 * Math.sin(t / 2300)).toFixed(3);
    drawMotes(t, dt);
  });
  if (ctx.reducedMotion) drawMotes(0, 0);

  /* --------------------------- Pieces -------------------------------------- */
  function renderHead(v: SceneView): void {
    const s = ctx.status(v);
    const key = `${s.card}|${s.day}|${s.time}`;
    if (key === seen.head) return;
    seen.head = key;
    head.innerHTML = `<div class="astro" title="${esc(`Day ${s.day}, ${s.time}`)}">${astrolabe(s.time)}</div>
      <div class="scroll">${SCROLL_BAND.replace("<svg ", '<svg class="band" ')}${SCROLL_END.replace("<svg ", '<svg class="end" ')}
        <div class="kick">Chapter ${roman(s.day)}<i>❦</i>${esc(s.time)}</div>
        <div class="ttl">${esc(s.card)}</div>
      </div>`;
  }

  /** What you're after and how long you have: always in view, because that's what makes a line matter. */
  function renderGoal(v: SceneView): void {
    const th = ctx.status(v).thread;
    goalEl.hidden = !th || !!v.delve || !!v.board;
    if (!th) return;
    const left = th.ended === "solved" ? "Solved" : th.ended === "lost" ? "Out of time" : th.daysLeft === undefined ? "" : th.daysLeft === 1 ? "Last day" : `${th.daysLeft} days left`;
    goalEl.innerHTML = `<span class="g">${esc(th.goal)}</span><span class="c">${left ? `<b>${left}</b> · ` : ""}${th.found.length}/${th.total}</span>`;
  }

  function renderMarks(v: SceneView): void {
    const s = ctx.status(v);
    const vig = Math.round(s.vigor * 100);
    const th = s.thread;
    const key = JSON.stringify([s.coin, s.currency, vig, th?.found.length, th?.total, th?.goal, s.supplies, v.delve?.keys]);
    if (key === seen.marks) return;
    seen.marks = key;
    const out: string[] = [];
    out.push(`<div class="bm" role="img" aria-label="${s.coin} ${esc(s.currency)}" title="${s.coin} ${esc(s.currency)}">${bookmark("sb-pat-amber", 118, COIN, String(s.coin), esc(s.currency))}</div>`);
    out.push(`<div class="bm" role="img" aria-label="Vigor ${vig}%" title="Vigor ${vig}%">${bookmark("sb-pat-crimson", 134, phial(s.vigor), `${vig}`, "vigor")}</div>`);
    if (th) {
      const tip = `The thread: ${th.goal} (${th.found.length} of ${th.total} found). Open the journal.`;
      out.push(`<button class="bm" data-sys="journal" aria-label="${esc(tip)}" title="${esc(tip)}">${bookmark("sb-pat-royal", 124, SPOOL, `${th.found.length}/${th.total}`, "thread")}</button>`);
    }
    if (s.supplies) out.push(`<div class="bm" role="img" aria-label="Supplies ${s.supplies.now} of ${s.supplies.max}" title="Supplies ${s.supplies.now} of ${s.supplies.max}">${bookmark("sb-pat-moss", 112, SATCHEL, `${s.supplies.now}/${s.supplies.max}`, "supplies")}</div>`);
    if (v.delve) out.push(`<div class="bm" role="img" aria-label="${v.delve.keys} keys" title="${v.delve.keys} keys">${bookmark("sb-pat-iron", 106, IRONKEY, String(v.delve.keys), "keys")}</div>`);
    marks.innerHTML = out.join("");
  }

  function renderPlate(v: SceneView): void {
    const b = ctx.box(v);
    const key = `${b.title}|${b.isNew}`;
    if (key === seen.plate) return;
    seen.plate = key;
    plateName.textContent = b.title;
    seal.hidden = !b.isNew;
    seal.innerHTML = b.isNew ? waxSeal("NEW") : "";
    if (b.isNew) seal.title = "A new place in your story";
  }

  function renderText(v: SceneView): void {
    const b = ctx.box(v);
    const key = JSON.stringify([b.desc, b.log, b.busy, v.story]);
    write.sync(v);
    sb.classList.toggle("writing", isWriting(v));
    if (key === seen.txt) return;
    seen.txt = key;
    sb.classList.toggle("busy", !!b.busy);
    const desc = b.desc.trim();
    const m = /^([^A-Za-z0-9]*)([A-Za-z0-9])([A-Za-z0-9'’-]*)/.exec(desc);
    const descHtml = m
      ? `<p class="desc${m[3] ? "" : " lone"}">${esc(m[1]!)}${dropCap(esc(m[2]!.toUpperCase()))}<span class="fw"><span class="vh">${esc(m[2]!)}</span>${esc(m[3]!)}</span>${esc(desc.slice(m[0].length))}</p>`
      : `<p class="desc">${esc(desc)}</p>`;
    // The newest happening is set big under the narration; the earlier ones
    // run down the page's margin, oldest first. Lines new since last time ink in.
    const firstNew = b.log.length - countNew(lastLog, b.log);
    lastLog = b.log.slice();
    const last = b.log.length - 1;
    const now = last >= 0 ? `<p class="now${last >= firstNew ? " fresh" : ""}">${esc(b.log[last]!)}</p>` : "";
    const earlier = b.log.slice(0, Math.max(0, last)).map((l, i) => `<li class="${i >= firstNew ? "fresh" : ""}">${esc(l)}</li>`).join("");
    const busy = b.busy ? `<div class="busy" role="status">${QUILL}<span>${esc(b.busy)}</span><span class="dots"><i></i><i></i><i></i></span></div>` : "";
    const beats = beatsHtml(v.story, v.voices);
    txt.classList.toggle("two", !!earlier);
    txt.innerHTML = `<div class="main">${descHtml}${now}${beats}${busy}</div>${earlier ? `<aside class="margin" aria-label="Earlier">${DIVIDER}${DIVIDER_KNOT}<div class="mh">Earlier</div><ol class="log">${earlier}</ol></aside>` : ""}`;
    requestAnimationFrame(() => {
      pageEl.scrollTop = pageEl.scrollHeight;
      // On a phone the page opens on the narration's first line, however long it is; what came before is above it.
      // Once the player is writing, the newest beat is what they came for.
      if (plainPage() && !v.story.length) pageEl.scrollTop = Math.max(0, (txt.querySelector<HTMLElement>(".main")?.offsetTop ?? 0) - 4);
      const mg = txt.querySelector(".margin");
      if (mg) mg.scrollTop = mg.scrollHeight;
    });
  }
  /** How many lines at the end of `next` were not in `prev` (lines are appended, the oldest dropped). */
  function countNew(prev: string[], next: string[]): number {
    if (!prev.length) return next.length;
    for (let k = Math.min(prev.length, next.length); k > 0; k--) {
      if (next.slice(0, k).join("\n") === prev.slice(prev.length - k).join("\n")) return next.length - k;
    }
    return next.length;
  }

  /** Make an element from markup. */
  function el(html: string): HTMLElement {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild as HTMLElement;
  }
  /** Built elements by identity, so a re-render keeps what did not change (and its entrance plays once). */
  const ribCache = new Map<string, HTMLElement>();
  const figCache = new Map<string, HTMLElement>();

  function renderChoices(v: SceneView, onStage: Set<string>): void {
    const items = menu.filter((m) => !(m.group === "talk" && m.target && onStage.has(m.target)));
    const key = JSON.stringify([!!v.delve, items.map((m) => [m.key, m.label, m.art])]);
    if (key === seen.choices) return;
    const active = (root.getRootNode() as Document | ShadowRoot).activeElement as HTMLElement | null;
    const focusKey = active && choices.contains(active) ? active.dataset.act : undefined;
    seen.choices = key;
    const nodes: HTMLElement[] = [el(`<div class="rubric">${v.delve ? "Which way?" : "What will you do?"}</div>`)];
    if (v.delve) {
      const mv = (t: string) => items.find((m) => m.key === `move:${t}`);
      const pos: Record<string, [number, number, string]> = { forward: [50, 18, "Advance"], left: [18, 50, "Left"], right: [82, 50, "Right"], back: [50, 82, "Back"], search: [50, 50, ""] };
      const rose = Object.entries(pos)
        .map(([t, [x, y, short]]) => {
          const m = mv(t);
          return m ? `<button class="mv${t === "search" ? " c" : ""}" data-act="${esc(m.key)}" style="left:${x}%;top:${y}%" aria-label="${esc(m.label)}" title="${esc(m.label)}">${icon(iconFor(m))}<span class="vh">${short}</span></button>` : "";
        })
        .join("");
      nodes.push(el(`<div class="rose">${ROSE}${rose}</div>`));
    }
    const list = v.delve ? items.filter((m) => m.group !== "move") : items;
    const keep = new Map<string, HTMLElement>();
    list.forEach((m, i) => {
      const id = `${m.key}|${m.label}|${m.art ?? ""}|${i}`;
      let b = ribCache.get(id);
      if (b) b.classList.remove("enter");
      else
        b = el(`<button class="rib enter k-${m.group}" data-act="${esc(m.key)}" style="--i:${i}" title="${esc(m.label)}">${ribbon(PATTERN[m.group])}<span class="sheen"></span>${POINTER}${medallion(iconFor(m), m.art ?? null, `r${seedOf(id)}`)}<span class="lb">${esc(m.label)}</span>${i < 9 ? `<span class="n" aria-hidden="true">${roman(i + 1)}</span>` : ""}</button>`);
      // Hand-placed bookmarks: each row sits a little off the straight, along an arc.
      b.style.setProperty("--dx", `${-Math.round(14 * Math.sin((Math.PI * (i + 0.5)) / Math.max(1, list.length)))}px`);
      keep.set(id, b);
      nodes.push(b);
    });
    ribCache.clear();
    for (const [k, b] of keep) ribCache.set(k, b);
    choices.replaceChildren(...nodes);
    // How many rows of two a phone needs; the stylesheet gives the list its height (and the page the rest) from this.
    sb.style.setProperty("--rows", String(Math.max(1, Math.ceil(list.length / 2))));
    if (focusKey) (choices.querySelector(`[data-act="${CSS.escape(focusKey)}"]`) as HTMLElement | null)?.focus();
  }

  function renderCast(v: SceneView): Set<string> {
    people = ctx.people(v);
    const on = new Set<string>();
    // A short window has no room for anyone to stand: nobody is "on stage", so talking to them is a ribbon in the list.
    if (ui.clientHeight <= 480) {
      tags.innerHTML = "";
      castBack.replaceChildren();
      castFront.replaceChildren();
      seen.cast = "";
      return on;
    }
    const phone = plainPage();
    const again = () => ctx.rerender();
    type Shown = { p: PersonView; url: string; cameo: boolean };
    const shown: Shown[] = [];
    for (const p of people) {
      if (shown.length >= (phone ? 3 : v.hex ? 3 : 4)) break;
      const a = ctx.personArt(v, p.id, "color");
      if (!a) continue;
      // Opaque art, and art the host keyed (its edges are rough), is framed
      // life-size in a gilt arch from the original painting.
      if (!a.cutout || a.keyed) {
        shown.push({ p, url: warmGround(a.keyed ? a.source : a.url, again), cameo: true });
        continue;
      }
      // A true cutout that is a bust (cropped across the chest) cannot stand either.
      const bust = bustOf(a.url, again);
      if (bust === null) continue;
      shown.push({ p, url: a.url, cameo: bust });
    }
    for (const s of shown) on.add(s.p.id);
    // Cameos take the leftmost slots (the wing), standing figures the rest; the first standing figure is in front.
    const table = phone ? PHONE_SLOTS : v.hex ? SLOTS_MAP : SLOTS;
    const slots: ({ x: number; s: number } | null)[] = (table[shown.length] ?? table[3] ?? []).slice();
    const byX = slots.map((s, i) => ({ ...s!, i })).sort((a, b) => a.x - b.x);
    const cams = shown.filter((s) => s.cameo), stand = shown.filter((s) => !s.cameo);
    const place = new Map<Shown, { x: number; s: number; front: boolean }>();
    cams.forEach((c, i) => {
      const sl = byX[i];
      if (!sl) return;
      place.set(c, { x: sl.x, s: sl.s, front: false });
      slots[sl.i] = null;
    });
    const rest = slots.filter((s): s is { x: number; s: number } => !!s).sort((a, b) => b.s - a.s);
    stand.forEach((c, i) => place.set(c, { x: rest[i]?.x ?? 40 + i * 12, s: rest[i]?.s ?? 0.8, front: i === 0 }));
    const key = JSON.stringify([phone, !!v.hex, shown.map((s) => [s.p.id, s.p.name, s.url, s.cameo, s.p.talkable, place.get(s)])]);
    if (key === seen.cast) return on;
    seen.cast = key;
    const back: HTMLElement[] = [], front: HTMLElement[] = [];
    const keep = new Map<string, HTMLElement>();
    tags.innerHTML = shown
      .map((s) => {
        const at = place.get(s)!;
        // A phone sets its own size on the scroll, too large for a long name, so there it gives the first word.
        const fit = phone && s.p.name.length > 11 ? { label: s.p.name.split(/\s+/)[0]!, size: 15 } : fitScroll(s.p.name);
        const art = nameScroll(esc(fit.label), fit.size, s.p.talkable, `t${seedOf(s.p.id)}`);
        return s.p.talkable
          ? `<button class="tag" data-talk="${esc(s.p.id)}" style="--x:${at.x}" aria-label="Talk to ${esc(s.p.name)}" title="Talk to ${esc(s.p.name)}, ${esc(s.p.role)}">${art}</button>`
          : `<span class="tag mute" data-talk="${esc(s.p.id)}" style="--x:${at.x}" title="${esc(`${s.p.name}, ${s.p.role}`)}">${art}</span>`;
      })
      .join("");
    shown.forEach((s, i) => {
      const at = place.get(s) ?? { x: 50, s: 0.8, front: false };
      const id = `${s.p.id}|${s.url}|${s.cameo}|${s.p.talkable}`;
      let f = figCache.get(id);
      if (f) f.classList.remove("enter");
      else {
        const u = s.url.replace(/["()\\\s']/g, (c) => encodeURIComponent(c));
        f = el(
          s.cameo
            ? `<div class="fig cameo enter" data-talk="${esc(s.p.id)}" title="${esc(`${s.p.name}, ${s.p.role}`)}">${cameo(esc(s.url), `c${seedOf(id)}`)}</div>`
            : `<div class="fig enter" data-talk="${esc(s.p.id)}" title="${esc(`${s.p.name}, ${s.p.role}`)}"><img src="${esc(s.url)}" alt="${esc(s.p.name)}" draggable="false"><div class="lit" style="-webkit-mask-image:url(&quot;${u}&quot;);mask-image:url(&quot;${u}&quot;)"></div></div>`,
        );
      }
      f.style.setProperty("--x", String(at.x));
      f.style.setProperty("--s", String(at.s));
      f.style.zIndex = at.front ? "2" : "1";
      f.style.animationDelay = `${i * 90}ms`;
      f.classList.toggle("back", !at.front && !s.cameo);
      keep.set(id, f);
      (at.front ? front : back).push(f);
    });
    figCache.clear();
    for (const [k, f] of keep) figCache.set(k, f);
    castBack.replaceChildren(...back);
    castFront.replaceChildren(...front);
    return on;
  }

  function renderFolio(v: SceneView): void {
    const mode = v.delve ? "delve" : v.hex ? "hex" : "";
    const key = mode === "delve" ? JSON.stringify([v.delve!.grid, v.delve!.x, v.delve!.y, v.delve!.facing, v.delve!.rooms, v.delve!.name]) : mode === "hex" ? JSON.stringify([v.hex, v.menu.map((m) => m.id)]) : "";
    if (key === seen.folio) return;
    seen.folio = key;
    fol.hidden = !mode;
    fol.className = `sb-folio ${mode}`;
    if (!mode) {
      fol.innerHTML = "";
      return;
    }
    fol.innerHTML = `${folio().replace("<svg ", '<svg class="fr" ')}<div class="fl-t">${mode === "hex" ? "The Frontier" : esc(v.delve!.name)}</div>${mode === "hex" ? `<svg class="hexmap" role="group" aria-label="Overland map"></svg>` : `<canvas width="300" height="240" role="img" aria-label="Map of the delve"></canvas><span class="pin">${waxSeal("")}</span>`}`;
    if (mode === "hex") ctx.drawHex(fol.querySelector("svg.hexmap") as SVGSVGElement, v);
    else ctx.drawAutomap(fol.querySelector("canvas")!, v.delve!, { floor: "rgba(122,80,40,.32)", lit: "rgba(110,64,28,.78)", you: "#8b1a1a" });
  }

  function renderJournal(v: SceneView): void {
    if (!ctx.journal.open) {
      if (jr) {
        jr.remove();
        jr = null;
        seen.jr = "";
        tabJ.focus();
      }
      return;
    }
    const html = ctx.journal.html(v);
    const key = `${html}|${v.cardName}`;
    if (jr && key === seen.jr) return;
    seen.jr = key;
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    for (const aff of tmp.querySelectorAll<HTMLElement>(".aff")) {
      const i = aff.querySelector("i") as HTMLElement | null;
      const x = (parseFloat(i?.style.width ?? "0") / 5) * (i?.classList.contains("neg") ? -1 : 1);
      const n = Math.min(5, Math.round(Math.abs(x) / 2));
      const word = x >= 6 ? "Sworn" : x >= 3 ? "Warm" : x > 0 ? "Friendly" : x === 0 ? "Undecided" : x > -3 ? "Wary" : "Hostile";
      const seals = Array.from({ length: 5 }, (_, k) => affinitySeal(k < n ? (x > 0 ? "warm" : "cold") : "none")).join("");
      const out = document.createElement("span");
      out.className = "seals";
      out.title = `${word} (${x > 0 ? "+" : ""}${Math.round(x * 10) / 10})`;
      out.innerHTML = `${seals}<em>${word}</em>`;
      aff.replaceWith(out);
    }
    const kids = [...tmp.children];
    const heads = kids.map((k, i) => (k.tagName === "H3" ? i : -1)).filter((i) => i >= 0);
    const cut = heads[3] ?? Math.ceil(kids.length / 2);
    const part = (a: Element[]) => a.map((k) => k.outerHTML).join("");
    const fresh = !jr;
    if (!jr) {
      jr = document.createElement("div");
      jr.className = "sb-jr";
      jr.setAttribute("role", "dialog");
      jr.setAttribute("aria-label", "Journal");
      jr.addEventListener("click", (e) => {
        if (e.target === jr || (e.target as Element).closest(".shut")) ctx.journal.toggle();
      });
      sb.append(jr);
    }
    const s = ctx.status(v);
    jr.innerHTML = `<div class="book">
      <div class="cover"></div><div class="stack s3"></div><div class="stack s2"></div><div class="stack s1"></div>
      ${["tl", "tr", "bl", "br"].map((c) => `<div class="bc ${c}">${BRASS_CORNER}</div>`).join("")}
      <div class="pages">
        <div class="pg l"><div class="chron"><small>The chronicle of</small><b>${esc(s.card)}</b></div>${part(kids.slice(0, cut))}</div>
        <div class="pg r">${part(kids.slice(cut))}</div>
      </div>
      <div class="spine"></div>
      <button class="shut" aria-label="Close the journal" title="Close (Esc)">${SHUT_RIBBON}</button>
    </div>`;
    if (fresh) (jr.querySelector(".shut") as HTMLElement).focus();
  }

  /* --------------------------- Render -------------------------------------- */
  function render(v: SceneView): void {
    view = v;
    const mode = v.delve ? "delve" : "scene";
    if (sb.dataset.mode !== mode) {
      sb.dataset.mode = mode;
      apKey = "";
      requestAnimationFrame(sizeArt);
    }
    ctx.backdrop(v, { post: "paper", dolly: 0, ...(ctx.has3d ? {} : { flat: "plain" as const, fit: "cover" as const }) });
    menu = ctx.menu(v);
    renderHead(v);
    renderMarks(v);
    renderGoal(v);
    renderPlate(v);
    renderText(v);
    const onStage = renderCast(v);
    renderChoices(v, onStage);
    renderFolio(v);
    renderJournal(v);
    tabJ.setAttribute("aria-pressed", String(ctx.journal.open));
    tabC.setAttribute("aria-pressed", String(ctx.classes.open));
  }

  return {
    boardSkin: BOARD_SKINS.storybook,
    render,
    key(e) {
      if (e.key === "Escape") {
        if (slip) return closeSlip(), true;
        if (ctx.journal.open) return ctx.journal.toggle(), true;
        if (ctx.classes.open) return ctx.classes.toggle(), true;
        return false;
      }
      if (ctx.journal.open || slip) return false;
      const k = e.key.toLowerCase();
      if (k === "j") return ctx.journal.toggle(), true;
      if (k === "c") return ctx.classes.toggle(), true;
      if (/^[1-9]$/.test(e.key)) {
        const b = choices.querySelectorAll<HTMLButtonElement>("button.rib")[Number(e.key) - 1];
        if (b) return b.click(), true;
      }
      return false;
    },
    destroy() {
      stopFrame();
      ro.disconnect();
      stageRo.disconnect();
      sb.removeEventListener("click", onClick);
      sb.removeEventListener("pointerover", onOver);
      closeSlip();
    },
  };
};
