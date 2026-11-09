/**
 * Cue's puppet warp for the scene's people (docs/DESIGN.md 5.6, 6.3): every
 * theme draws people as <img> elements from ctx.personArt(); a real cut-out
 * figure (alpha, not keyed) is swapped for a <canvas> of the same class and
 * style that shows the figure breathing, swaying and turning its head, from
 * the same vendored rig the battle stage uses (vendor/cue-puppet).
 *
 * One shared WebGL renderer (three.js) draws each figure's grid mesh and
 * copies it into that figure's 2D canvas, at most ~30 times a second, only
 * while the canvas is on screen. The <img> stays in the DOM, hidden, so a
 * theme's handlers on it still work (clicks are forwarded). Canvas is a
 * replaced element, so the theme's object-fit and sizing apply unchanged.
 * Off with reduced motion, or when WebGL is missing.
 */
import { BufferAttribute, BufferGeometry, LinearFilter, Mesh, MeshBasicMaterial, OrthographicCamera, Scene, SRGBColorSpace, Texture, WebGLRenderer } from "three";
import type { SpriteFaceBox } from "../../vendor/cue-puppet/shims.js";
import { easeMood, PUPPET_GESTURE_S, PUPPET_NEUTRAL_MOOD, puppetMoodFor, type PuppetGestureKind, type PuppetMood } from "../../vendor/cue-puppet/sprite-puppet-acting.js";
import { puppetGrid, puppetMeshPositions, puppetPhase, puppetPose, type PuppetGrid } from "../../vendor/cue-puppet/sprite-puppet-rig.js";
import { alphaBBox, buildFigureRig, type AlphaBox, type FigureRig } from "../stage/puppet/rig-build.js";

/** Tallest canvas drawn (px), for GPU memory. Below it a canvas is as tall as it is shown, in device pixels, and never above the picture's own. */
const MAX_H = 2048;
/** Before the canvas is laid out. */
const FIRST_H = 640;
const FRAME_MS = 33;
const GRID: PuppetGrid = puppetGrid(16, 24);

/** cut: the picture has real transparency (a figure, not a framed painting). */
type Loaded = { img: HTMLImageElement; tex: Texture; figure: FigureRig; w: number; h: number; cut: boolean };

type Live = {
  img: HTMLImageElement;
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  load: Loaded | null;
  phase: number;
  /** follow(): the URL being shown, and the observer that watches the <img>. */
  url?: string;
  watch?: MutationObserver;
  clocks: { breath: number; sway: number };
  visible: boolean;
  /** Acting (act()): the mood shown, eased toward the one asked for. */
  mood: PuppetMood;
};

export interface PuppetDom {
  /** A figure URL the host knows is a real cut-out (alpha), with its face box when known. */
  mark(url: string, face?: SpriteFaceBox | null): void;
  /** Swap marked <img> elements under root for puppets (call after each theme render). */
  attach(root: HTMLElement): void;
  /**
   * Keep a puppet canvas beside an <img> whose src and classes change (Parley's
   * crossfading faces): the canvas mirrors its classes and shows whatever it
   * shows, warped, when that is a cut-out; an opaque picture is left to the <img>.
   */
  follow(img: HTMLImageElement): void;
  /**
   * Body language for every puppet here: a mood (a Cue expression id: angry,
   * scared, smile, thinking…; null is calm) at intensity 1..5, eased in, and
   * an optional one-shot gesture (startle, lean_in, step_back…).
   */
  act(expression: string | null, intensity?: number, gesture?: PuppetGestureKind): void;
  /** Talking (0..1): the head bobs and tilts with the line. */
  talk(level: number): void;
  destroy(): void;
}

const NONE: PuppetDom = { mark() {}, attach() {}, follow() {}, act() {}, talk() {}, destroy() {} };

export function createPuppetDom(): PuppetDom {
  if (typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return NONE;
  // Made on the first puppet, so a view with no cut-outs opens no WebGL context.
  let renderer: WebGLRenderer | null = null;
  let noGl = false;
  const gl = (): WebGLRenderer | null => {
    if (renderer || noGl) return renderer;
    try {
      renderer = new WebGLRenderer({ alpha: true, antialias: true, premultipliedAlpha: false, preserveDrawingBuffer: true });
      renderer.setClearColor(0x000000, 0);
    } catch {
      noGl = true;
    }
    return renderer;
  };
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 2);
  camera.position.z = 1;
  const scene = new Scene();
  const geometry = new BufferGeometry();
  const positions = new Float32Array((GRID.uv.length / 2) * 3);
  const clip = new Float32Array(GRID.uv.length);
  const uv = new Float32Array(GRID.uv.length);
  for (let i = 0; i < GRID.uv.length; i += 2) {
    uv[i] = GRID.uv[i]!;
    uv[i + 1] = 1 - GRID.uv[i + 1]!;
  }
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new BufferAttribute(uv, 2));
  geometry.setIndex(new BufferAttribute(new Uint16Array(GRID.indices), 1));
  const material = new MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const faces = new Map<string, SpriteFaceBox | null>();
  const loads = new Map<string, Promise<Loaded | null>>();
  let live: Live[] = [];
  let raf = 0;
  /** Acting shared by every puppet here (one character per Parley). */
  let target: PuppetMood = { ...PUPPET_NEUTRAL_MOOD };
  let gestures: { kind: PuppetGestureKind; at: number; side: number }[] = [];
  let talkTo = 0;
  let talkNow = 0;
  let last = 0;
  let destroyed = false;
  const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver((entries) => {
    for (const e of entries) {
      const l = live.find((x) => x.canvas === e.target);
      if (l) l.visible = e.isIntersecting;
    }
  }) : null;

  const abs = (url: string) => new URL(url, location.href).href;

  function load(url: string): Promise<Loaded | null> {
    let p = loads.get(url);
    if (!p) {
      p = new Promise<Loaded | null>((resolve) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => {
          const w = img.naturalWidth;
          const h = img.naturalHeight;
          if (!w || !h) return resolve(null);
          let bbox: AlphaBox = [0, 0, 1, 1];
          let cut = false;
          try {
            const k = Math.min(1, 256 / h);
            const c = document.createElement("canvas");
            c.width = Math.max(1, Math.round(w * k));
            c.height = Math.max(1, Math.round(h * k));
            const cg = c.getContext("2d")!;
            cg.drawImage(img, 0, 0, c.width, c.height);
            const data = cg.getImageData(0, 0, c.width, c.height).data;
            bbox = alphaBBox(data, c.width, c.height, 24, 1) ?? bbox;
            let clear = 0;
            for (let i = 3; i < data.length; i += 4) if (data[i]! < 24) clear++;
            cut = clear / (data.length / 4) > 0.03;
          } catch {
            /* unreadable: the whole image is the box */
          }
          const tex = new Texture(img);
          tex.colorSpace = SRGBColorSpace;
          tex.minFilter = tex.magFilter = LinearFilter;
          tex.needsUpdate = true;
          resolve({ img, tex, figure: buildFigureRig("standing", bbox, w, h, faces.get(url) ?? null), w, h, cut });
        };
        img.onerror = () => resolve(null);
        img.src = url;
      });
      loads.set(url, p);
    }
    return p;
  }

  function draw(l: Live, now: number): void {
    const ren = gl();
    if (!l.load || !ren) return;
    const r = l.load.figure.rig;
    const pose = puppetPose({
      time: now,
      phase: l.phase,
      figH: r.figH,
      faceW: r.faceW,
      breathing: 1,
      sway: 1,
      head: 1,
      talk: talkNow,
      reaction: null,
      strength: 1,
      clocks: l.clocks,
      acting: 1,
      mood: l.mood,
      gaze: 0,
      side: l.phase > 0.5 ? 1 : -1,
      gestures: gestures.map((g) => ({ kind: g.kind, age: now - g.at, gain: 1, side: g.side })),
      physics: { bodyX: 0, bodyY: 0, hairX: 0, hairY: 0, windX: 0 },
      shift: null,
    });
    puppetMeshPositions(r, pose, GRID, clip);
    for (let i = 0, j = 0; i < clip.length; i += 2, j += 3) {
      positions[j] = clip[i]!;
      positions[j + 1] = clip[i + 1]!;
      positions[j + 2] = 0;
    }
    geometry.attributes.position!.needsUpdate = true;
    material.map = l.load.tex;
    material.needsUpdate = true;
    const { width, height } = l.canvas;
    ren.setSize(width, height, false);
    ren.render(scene, camera);
    l.g.clearRect(0, 0, width, height);
    l.g.drawImage(ren.domElement, 0, 0, width, height);
  }

  function tick(t: number): void {
    raf = 0;
    if (destroyed) return;
    live = live.filter((l) => {
      if (l.canvas.isConnected) return true;
      io?.unobserve(l.canvas);
      l.watch?.disconnect();
      return false;
    });
    if (!live.length) return;
    raf = requestAnimationFrame(tick);
    if (t - last < FRAME_MS || document.hidden) return;
    const dt = Math.min(0.1, (t - last) / 1000);
    last = t;
    const now = t / 1000;
    gestures = gestures.filter((g) => now - g.at < PUPPET_GESTURE_S[g.kind]);
    talkNow += (talkTo - talkNow) * Math.min(1, dt * 6);
    for (const l of live) {
      easeMood(l.mood, target, Math.min(1, dt * 2.5));
      // A livelier mood breathes and sways faster (the clocks run at its rates).
      l.clocks.breath += dt * l.mood.breathRate;
      l.clocks.sway += dt * l.mood.swayRate;
      if (l.visible) draw(l, now);
    }
  }

  /**
   * The canvas takes the box the theme gives its <img> (theme rules often
   * select img, which a canvas doesn't match), and that many device pixels.
   * False when nothing changed.
   */
  const fit = (l: Live): boolean => {
    if (!l.load) return false;
    const off = l.img.style.display === "none";
    if (off) l.img.style.display = "";
    const w = l.img.offsetWidth, shown = l.img.offsetHeight;
    if (off) l.img.style.display = "none";
    if (shown) {
      l.canvas.style.width = `${w}px`;
      l.canvas.style.height = `${shown}px`;
    }
    const h = Math.max(1, Math.round(Math.min(l.load.h, MAX_H, shown ? shown * (window.devicePixelRatio || 1) : FIRST_H)));
    if (h === l.canvas.height) return false;
    l.canvas.height = h;
    l.canvas.width = Math.max(1, Math.round((l.load.w * h) / l.load.h));
    return true;
  };
  // The box a theme shows a figure in can change without a new render (sizes in container units).
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver((entries) => {
    for (const e of entries) for (const l of live) if (l.img.parentElement === e.target && fit(l)) draw(l, performance.now() / 1000);
  }) : null;
  const run = (l: Live) => {
    live.push(l);
    io?.observe(l.canvas);
    if (l.img.parentElement) ro?.observe(l.img.parentElement);
    draw(l, performance.now() / 1000);
    if (!raf) raf = requestAnimationFrame(tick);
  };

  function swap(img: HTMLImageElement, loaded: Loaded): void {
    if (!img.isConnected || img.dataset.puppet === "on" || !gl()) return;
    const canvas = document.createElement("canvas");
    canvas.className = img.className;
    const style = img.getAttribute("style");
    if (style) canvas.setAttribute("style", style);
    for (const a of ["alt", "title", "role", "aria-label", "tabindex"]) {
      const v = img.getAttribute(a);
      if (v !== null) canvas.setAttribute(a === "alt" ? "aria-label" : a, v);
    }
    canvas.dataset.puppet = "canvas";
    canvas.addEventListener("click", () => img.click());
    img.dataset.puppet = "on";
    img.style.display = "none";
    img.after(canvas);
    const g = canvas.getContext("2d");
    if (!g) return;
    const l: Live = { img, canvas, g, load: loaded, phase: puppetPhase(img.currentSrc || img.src), clocks: { breath: Math.random() * 3, sway: Math.random() * 5 }, visible: true, mood: { ...target } };
    fit(l);
    run(l);
  }

  return {
    mark(url, face) {
      faces.set(abs(url), face ?? null);
    },
    attach(root) {
      if (destroyed) return;
      for (const img of root.querySelectorAll<HTMLImageElement>("img:not([data-puppet])")) {
        const src = img.getAttribute("src");
        if (!src) continue;
        const url = abs(src);
        if (!faces.has(url)) continue;
        img.dataset.puppet = "pending";
        void load(url).then((loaded) => {
          if (loaded) {
            delete img.dataset.puppet;
            swap(img, loaded);
          }
        });
      }
    },
    follow(img) {
      if (destroyed || img.dataset.puppet || !img.parentElement) return;
      img.dataset.puppet = "follow";
      const canvas = document.createElement("canvas");
      canvas.dataset.puppet = "canvas";
      canvas.hidden = true;
      canvas.setAttribute("aria-hidden", "true");
      const g = canvas.getContext("2d");
      if (!g) return;
      img.after(canvas);
      const l: Live = { img, canvas, g, load: null, phase: Math.random(), clocks: { breath: Math.random() * 3, sway: Math.random() * 5 }, visible: true, url: "", mood: { ...target } };
      const plain = () => {
        l.load = null;
        canvas.hidden = true;
        img.style.visibility = "";
      };
      const sync = () => {
        canvas.className = img.className;
        const src = img.getAttribute("src");
        const url = src ? abs(src) : "";
        if (url === l.url) return;
        l.url = url;
        if (!url) return plain();
        void load(url).then((loaded) => {
          if (l.url !== url || destroyed) return;
          if (!loaded?.cut || !gl()) return plain();
          l.load = loaded;
          l.phase = puppetPhase(url);
          fit(l);
          canvas.hidden = false;
          img.style.visibility = "hidden";
          draw(l, performance.now() / 1000);
        });
      };
      l.watch = new MutationObserver(sync);
      l.watch.observe(img, { attributes: true, attributeFilter: ["class", "src"] });
      sync();
      run(l);
    },
    act(expression, intensity = 3, gesture) {
      target = expression ? puppetMoodFor(expression, intensity) : { ...PUPPET_NEUTRAL_MOOD };
      if (gesture) gestures.push({ kind: gesture, at: performance.now() / 1000, side: Math.random() < 0.5 ? -1 : 1 });
    },
    talk(level) {
      talkTo = Math.max(0, Math.min(1, level));
    },
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      io?.disconnect();
      ro?.disconnect();
      for (const l of live) l.watch?.disconnect();
      live = [];
      for (const p of loads.values()) void p.then((l) => l?.tex.dispose());
      geometry.dispose();
      material.dispose();
      renderer?.dispose();
      renderer?.forceContextLoss();
    },
  };
}
