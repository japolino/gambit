/**
 * Storybook Parley: the structure the stylesheet cannot draw. A talk is a visual-novel scene in the
 * scene theme's book: the place fills the window inside gilt acanthus corners, the person stands large
 * left of centre, and the dialogue page (mahogany cradle, scalloped gilt, vellum) spans the bottom on its
 * espresso skirt, exactly as on the scene screen. Here we add that page's art (sized to the window), the
 * chapter-header scroll and astrolabe behind the stake's title, the silk bookmarks that hold the fare and
 * the person's patience, the brass caps of the speaker's nameplate, a gilt arch for an opaque portrait,
 * god rays, motes and a little pointer parallax. The view's own controls stay where they are in the DOM;
 * the stylesheet (../storybook.ts) moves them onto the page.
 */
import type { ParleyDecor, ParleyThemeCtx } from "../types.js";
import { DEFS, DIVIDER, DLG_PAD, PLATE_BAND, SCROLL_BAND, SCROLL_END, astrolabe, COIN, cornerFlourish, dialogueFrame, plateCap, skirt } from "../../../scene/themes/storybook/art.js";
import { godRays, parchment } from "../../../scene/themes/storybook/textures.js";
import { archFront } from "../../../stage/themes/storybook/art.js";

const PHONE = 760;
/** The same test as the view's .pl-phone: a phone gets a plain page, with none of the book's art or light. */
const isPhone = (W: number, H: number) => W <= PHONE || H <= 480;

/** A candle for the patience bookmark (centred, ~34 tall). */
const CANDLE = `<g filter="url(#sb-drop)">
  <path d="M-6,-6 H6 V14 H-6 Z" fill="#f3e6c8" stroke="#8a6a44" stroke-width=".8"/>
  <path d="M-6,-6 C-3,-4 3,-8 6,-6" fill="none" stroke="#d8c39e" stroke-width="1"/>
  <path d="M-10,14 H10 L8,18 H-8 Z" fill="url(#sb-gold)" stroke="#4c2a0e" stroke-width=".8"/>
  <path d="M0,-7 V-10" stroke="#3a1a08" stroke-width="1"/>
  <path class="sbp-flame" d="M0,-22 C4,-17 4,-12 0,-10 C-4,-12 -4,-17 0,-22 Z" fill="#ffd27a" stroke="#ff9a3a" stroke-width=".8"/>
</g>`;

/**
 * A wide silk banner hanging from the top of the book (112 wide, 200 long, pointed tip): gilt-edged, stitched,
 * an emblem near the top and a darker field below it where the HTML sets the label, the value and the gauge.
 */
function banner(pat: string, emblem: string): string {
  const h = 200;
  const body = `M4,-6 H108 V${h - 26} L56,${h} L4,${h - 26} Z`;
  const gilt = `M9,-6 V${h - 29} L56,${h - 7} L103,${h - 29} V-6`;
  const stitch = `M15,-6 V${h - 33} L56,${h - 16} L97,${h - 33} V-6`;
  return `<svg viewBox="0 -6 112 ${h + 12}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <path d="${body}" fill="#000" opacity=".5" transform="translate(3,6)" filter="url(#sb-soft)"/>
    <path d="${body}" fill="url(#${pat})"/>
    <path d="${body}" fill="url(#sb-silk-shade)"/>
    <path d="M22,${h * 0.3} H90 V${h * 0.8} L56,${h * 0.88} L22,${h * 0.8} Z" fill="#160604" opacity=".34"/>
    <path d="${gilt}" fill="none" stroke="#2a1205" stroke-width="4.6"/>
    <path d="${gilt}" fill="none" stroke="url(#sb-gold)" stroke-width="2.8"/>
    <path d="${stitch}" fill="none" stroke="#f6dfae" stroke-width="1.1" stroke-dasharray="3.2 2.4" opacity=".75"/>
    <rect x="4" y="-6" width="104" height="18" fill="#000" opacity=".35"/>
    <g transform="translate(56,${h * 0.15}) scale(1.4)">${emblem}</g>
  </svg>`;
}

/**
 * The scene stays in the document under a talk, hidden, and it holds the same art with the same ids first: ours
 * would point at its hidden copies, and hidden patterns and clip paths paint nothing. Ours get their own ids.
 */
const own = (svg: string) => svg.replace(/(id="|url\(#|href="#)sb-/g, "$1sbp-");

export function decorate(ctx: ParleyThemeCtx): ParleyDecor {
  const { root, scene, scenario } = ctx;
  const reduced = ctx.reducedMotion;
  root.insertAdjacentHTML("afterbegin", own(DEFS.replace('class="sb-defs"', 'class="sb-defs sbp-defs"')));

  // Light over the painting.
  const light = document.createElement("div");
  light.className = "sbp-light";
  light.innerHTML = `<img class="rays" alt="" src="${godRays()}"><canvas class="motes"></canvas><div class="vig"></div>`;
  scene.querySelector(".vignette")?.after(light);

  // The book: skirt, page (cradle, vellum, gilt), the quill divider, the corners.
  const book = document.createElement("div");
  book.className = "sbp-book";
  book.setAttribute("aria-hidden", "true");
  book.innerHTML = own(`<div class="skirt"></div>
    <div class="dlg"><div class="back"></div><div class="vellum" style="background-image:url(${parchment()})"></div><div class="front"></div><div class="dv">${DIVIDER}</div></div>`);
  const corners = document.createElement("div");
  corners.className = "sbp-corners";
  corners.setAttribute("aria-hidden", "true");
  corners.innerHTML = own(["tl", "tr", "bl", "br"].map((c) => `<div class="c ${c}">${cornerFlourish()}</div>`).join(""));

  // The chapter header behind the stake's title: an astrolabe at dusk and a parchment scroll.
  const head = document.createElement("div");
  head.className = "sbp-head";
  head.setAttribute("aria-hidden", "true");
  head.innerHTML = own(`<div class="astro">${astrolabe("evening")}</div><div class="scroll"><div class="band">${SCROLL_BAND}</div><div class="end">${SCROLL_END}</div></div>`);

  // Bookmarks: the stake (amber silk with a coin) and patience (crimson silk with a candle).
  const marks = document.createElement("div");
  marks.className = "sbp-marks";
  marks.setAttribute("aria-hidden", "true");
  marks.innerHTML = own(`<div class="bm stake">${banner("sb-pat-amber", COIN)}</div><div class="bm pat">${banner("sb-pat-crimson", CANDLE)}</div>`);

  root.insertBefore(book, root.querySelector(".side"));
  root.append(corners);
  scene.append(head);
  scene.append(marks);
  const kind = root.querySelector<HTMLElement>(".kind");
  kind?.style.setProperty("--n", String(kind.textContent!.length));

  // The speaker's nameplate: brass caps and an enamel band around the name.
  const plaque = scene.querySelector<HTMLElement>(".plaque");
  if (plaque) {
    const band = document.createElement("div");
    band.className = "sbp-band";
    band.setAttribute("aria-hidden", "true");
    band.innerHTML = own(PLATE_BAND);
    const capL = document.createElement("div");
    capL.className = "sbp-cap l";
    capL.setAttribute("aria-hidden", "true");
    capL.innerHTML = own(plateCap(false));
    const capR = document.createElement("div");
    capR.className = "sbp-cap r";
    capR.setAttribute("aria-hidden", "true");
    capR.innerHTML = own(plateCap(true));
    plaque.prepend(band, capL);
    plaque.append(capR);
  }

  // An opaque portrait stands in a gilt arch, like the scene's cameo.
  const fig = scene.querySelector<HTMLElement>(".fig");
  if (fig) {
    const arch = document.createElement("div");
    arch.className = "sbp-arch";
    arch.setAttribute("aria-hidden", "true");
    arch.innerHTML = own(archFront().replace(/<svg /, '<svg preserveAspectRatio="none" '));
    fig.append(arch);
  }

  // Size the page's art to the window (the stylesheet reads the same numbers from these variables).
  const dlg = book.querySelector<HTMLElement>(".dlg")!;
  let lastKey = "";
  const layout = () => {
    const W = root.clientWidth, H = root.clientHeight;
    if (!W || !H) return;
    if (isPhone(W, H)) {
      // The stylesheet lays out the page; drop the frame's heavy art until a larger window asks for it again.
      if (lastKey) {
        lastKey = "";
        dlg.querySelector(".back")!.innerHTML = "";
        dlg.querySelector(".front")!.innerHTML = "";
        book.querySelector(".skirt")!.innerHTML = "";
      }
      return;
    }
    const dw = Math.round(Math.min(W * 0.84, 1800));
    const dh = Math.round(Math.max(196, Math.min(330, H * 0.31)));
    const db = Math.round(Math.max(14, H * 0.024));
    const dx = Math.round((W - dw) / 2);
    root.style.setProperty("--dw", `${dw}px`);
    root.style.setProperty("--dh", `${dh}px`);
    root.style.setProperty("--db", `${db}px`);
    root.style.setProperty("--dx", `${dx}px`);
    const key = `${W}x${H}`;
    if (key === lastKey) return;
    lastKey = key;
    const { back, front } = dialogueFrame(dw, dh);
    dlg.querySelector(".back")!.innerHTML = own(back);
    dlg.querySelector(".front")!.innerHTML = own(front);
    const skH = Math.round((dh + db) * 0.72);
    book.querySelector(".skirt")!.innerHTML = own(skirt(W, skH, dx, dx + dw));
  };
  const ro = new ResizeObserver(layout);
  ro.observe(root);
  layout();

  // Pointer parallax: the painting drifts, the corners and the cast a little less.
  const onMove = (e: PointerEvent) => {
    if (reduced || isPhone(root.clientWidth, root.clientHeight)) return;
    const r = root.getBoundingClientRect();
    root.style.setProperty("--px", (((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1).toFixed(3));
    root.style.setProperty("--py", (((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1).toFixed(3));
  };
  root.addEventListener("pointermove", onMove);

  // Motes of dust in the light.
  const cv = light.querySelector<HTMLCanvasElement>("canvas.motes")!;
  const g = cv.getContext("2d");
  const dust = Array.from({ length: 40 }, (_, i) => ({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.7, v: 0.006 + Math.random() * 0.012, p: i * 1.37 }));
  let raf = 0;
  let last = performance.now();
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!g || isPhone(root.clientWidth, root.clientHeight)) return;
    const w = (cv.width = cv.clientWidth), h = (cv.height = cv.clientHeight);
    g.clearRect(0, 0, w, h);
    for (const d of dust) {
      d.y -= d.v * dt;
      if (d.y < -0.02) d.y = 1.02;
      const x = (d.x + Math.sin(now / 2500 + d.p) * 0.01) * w;
      g.globalAlpha = 0.18 + 0.22 * Math.sin(now / 1000 + d.p) ** 2;
      g.fillStyle = "#ffd79a";
      g.beginPath();
      g.arc(x, d.y * h * 0.8, d.r, 0, Math.PI * 2);
      g.fill();
    }
  };
  if (!reduced) raf = requestAnimationFrame(tick);

  // The woodcut drop cap on each of the person's replies (re-set when a reply streams in and is redrawn).
  const log = root.querySelector<HTMLElement>(".log");
  const capIt = () => {
    log?.querySelectorAll<HTMLElement>(".npc .prose > p:first-child").forEach((p) => {
      if (p.querySelector(".sbp-dc")) return;
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      const t = walker.nextNode() as Text | null;
      if (!t) return;
      const m = /^(\s*)([A-Za-z])([A-Za-z'’]*)/.exec(t.data);
      if (!m) return;
      const [, lead, letter, restOfWord] = m;
      const cap = document.createElement("span");
      cap.className = `sbp-dc${restOfWord ? "" : " lone"}`;
      cap.textContent = letter!;
      const fw = document.createElement("span");
      fw.className = "sbp-fw";
      fw.textContent = restOfWord!;
      const after = document.createTextNode(t.data.slice(lead!.length + 1 + restOfWord!.length));
      // The cap floats at the paragraph's start even when the first word is inside an <em>.
      p.prepend(cap);
      t.replaceWith(...(restOfWord ? [fw, after] : [after]));
    });
  };
  // A new beat is read from its start: the roll and the tell sit at the top of the page, not under its rim.
  let anchorRaf = 0;
  const anchor = () => {
    // On a phone the view opens a turn at its start.
    if (!log || isPhone(root.clientWidth, root.clientHeight)) return;
    cancelAnimationFrame(anchorRaf);
    anchorRaf = requestAnimationFrame(() => (anchorRaf = requestAnimationFrame(() => {
      const beats = log.querySelectorAll<HTMLElement>(".read");
      const beat = beats[beats.length - 1];
      if (!beat) return;
      // The whole beat when it fits; else from the person's reply; a very long reply keeps its end in view.
      const replies = log.querySelectorAll<HTMLElement>(".npc");
      const reply = replies[replies.length - 1];
      for (const el of [beat, reply]) {
        if (!el) continue;
        const top = el.offsetTop - 18;
        if (log.scrollHeight - top <= log.clientHeight + 2) {
          log.scrollTop = top;
          return;
        }
      }
    })));
  };
  const mo = new MutationObserver(() => {
    capIt();
    anchor();
  });
  if (log) mo.observe(log, { childList: true, subtree: true });
  capIt();

  // The fare on its banner: the number large, its unit small beneath (the view writes "35 crowns").
  const value = root.querySelector<HTMLElement>(".meter-value");
  const splitValue = () => {
    const t = value?.firstChild;
    if (!t || t.nodeType !== Node.TEXT_NODE) return;
    const m = /^\s*([^\s]+)\s+(.+?)\s*$/.exec(t.textContent ?? "");
    if (!m) return;
    const num = document.createElement("span");
    num.className = "sbp-num";
    num.textContent = m[1]!;
    const unit = document.createElement("span");
    unit.className = "sbp-unit";
    unit.textContent = m[2]!;
    t.replaceWith(num, unit);
  };
  const vo = new MutationObserver(splitValue);
  if (value) vo.observe(value, { childList: true });
  splitValue();

  // How many ribbons hang under "What will you do?" (the facts stack above them).
  const actions = root.querySelector<HTMLElement>(".actions");
  const countActions = () => root.style.setProperty("--na", String(actions?.querySelectorAll("button").length ?? 1));
  countActions();
  // The slips' heading keeps a tally of what is still unplayed.
  const hand = root.querySelector<HTMLElement>(".hand");
  const journalBtn = root.querySelector<HTMLElement>(".journal-btn");
  const journal = root.querySelector<HTMLElement>(".journal");
  const tally = () => {
    if (!hand) return;
    const all = hand.querySelectorAll(".fact-card").length;
    const left = hand.querySelectorAll(".fact-card:not(.used)").length;
    hand.dataset.tally = all ? ` · ${left} of ${all} unplayed` : "";
    if (journalBtn) journalBtn.dataset.n = String(all);
  };
  const ho = new MutationObserver(tally);
  if (hand) ho.observe(hand, { childList: true });
  tally();

  // Phone: the drawer closes when you cite a fact (the line goes to your pen) or tap outside it.
  const onDrawerTap = (e: Event) => {
    if (!journal?.classList.contains("open") || !isPhone(root.clientWidth, root.clientHeight)) return;
    const t = e.target as Element;
    if (t.closest(".fact-card") || !t.closest(".journal, .journal-btn, .hand, .mode, .moments, .moment")) journal.classList.remove("open");
  };
  root.addEventListener("click", onDrawerTap);
  // Phone: the talk stops above the end card, however tall its reveals make it.
  const endBox = root.querySelector<HTMLElement>(".foot > .end");
  const endRo = new ResizeObserver(() => root.style.setProperty("--endh", `${Math.ceil(endBox?.offsetHeight ?? 0) + 4}px`));
  if (endBox) endRo.observe(endBox);

  return {
    update(state) {
      countActions();
      // The candle burns down as patience runs out.
      const max = Math.max(1, scenario.npc.stance.patience);
      root.style.setProperty("--patience", String(state.patience / max));
      root.classList.toggle("sbp-over", !!state.end);
    },
    destroy() {
      ro.disconnect();
      mo.disconnect();
      vo.disconnect();
      ho.disconnect();
      endRo.disconnect();
      root.removeEventListener("click", onDrawerTap);
      cancelAnimationFrame(anchorRaf);
      cancelAnimationFrame(raf);
      root.removeEventListener("pointermove", onMove);
    },
  };
}

export { DLG_PAD };
