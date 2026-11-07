/**
 * The contract between the Scene host (../view.ts) and a theme.
 *
 * Each theme is its own game interface: it owns every element inside its
 * root (layout, art, materials, how each piece of data is shown, motion).
 * Nothing about layout is shared between themes. The host owns only what is
 * not visual: the scene data, the art cache, the WebGL place layer, the
 * journal and class-panel state, the delve keys, the "Meanwhile…" montage,
 * and a pointer tracker for parallax.
 *
 * A theme is a factory `(ctx) => ThemeRenderer`. The host calls render(v)
 * on every change (and again when art the theme asked for is ready), and
 * destroy() when the theme is switched away. A theme must:
 *  - place `ctx.world` (the painted place / 3D layer) somewhere in its DOM
 *    and call `ctx.backdrop(v, …)` each render;
 *  - offer every item of `ctx.menu(v)`, the people (`ctx.people(v)`), the
 *    status (`ctx.status(v)`), the narration (`ctx.box(v)`), the journal
 *    (`ctx.journal`), the classes panel (`ctx.classes`) and the theme
 *    switcher (`ctx.themes` / `ctx.setTheme`), in its own way;
 *  - work from a phone (~390x800) to an ultrawide window (2560x905);
 *  - honour `ctx.reducedMotion`.
 * A theme styles itself with a <style> element inside its root (it lives in
 * the scene's shadow root). The same stylesheet may restyle the two shared
 * overlays, which are siblings of the theme root: the class panel
 * `.gs > .fg` and the "Meanwhile…" montage `.gs > .mw` (.mw-title, .mw-art,
 * .mw-text, .mw-dots, .mw-hint). Everything leaves with the root on destroy.
 */
import type { DelveMove } from "../../../engine/world/delve.js";
import type { Hotspot } from "../../../engine/world/places.js";
import type { DelveView, SceneView, ThemeId } from "../../../shared/scene-view.js";
import type { PostFx, Stage3D } from "../layer3d.js";
import type { BoardSkin } from "../board.js";

export type { SceneView, ThemeId, DelveView, Hotspot, DelveMove, PostFx, Stage3D };

export interface MenuItem {
  /** Stable id: the hotspot id, `move:<m>`, `leave`, or `fight`. */
  key: string;
  /** What kind of thing it is (delve moves are "move"; leaving a delve is "delve"). */
  kind: Hotspot["kind"] | "move";
  label: string;
  /** talk | do (look, shop, rest, wait) | go (exits, delve entrances) | fight | move (in a delve). */
  group: "talk" | "do" | "go" | "fight" | "move";
  /** The person it talks to, the place it goes to, or the move it makes. */
  target?: string;
  /** Painting of the place an exit goes to, when there is one. */
  art?: string | null;
  run(): void;
}

export interface PersonView {
  id: string;
  name: string;
  role: string;
  /** Can you talk to them here (is there a talk item)? */
  talkable: boolean;
  talk(): void;
}

export interface PersonArt {
  url: string;
  /** True: transparent background, stand them on the ground. False: opaque rectangle, frame it. */
  cutout: boolean;
  /** True when the host keyed opaque art into this cutout (the edges may be rough; a theme may prefer framing `source`). */
  keyed: boolean;
  /** The original art as it came (before keying or dithering). */
  source: string;
}

export interface StatusView {
  /** Place (or delve) name. */
  where: string;
  card: string;
  day: number;
  time: string;
  coin: number;
  currency: string;
  /** Party freshness 0-1. */
  vigor: number;
  /** Frontier overland supplies. */
  supplies?: { now: number; max: number };
  /** The central quest thread. */
  thread?: { found: string[]; total: number; goal: string };
}

export interface BoxView {
  title: string;
  isNew: boolean;
  desc: string;
  /** Latest happenings, newest last. */
  log: string[];
  busy: string | null;
}

export interface HandCard {
  id: string;
  text: string;
  /** Play it on the person you face (a talk citing it); null when nobody is here to hear it. */
  play: (() => void) | null;
}

export interface BackdropOpts {
  /** Post effect on the WebGL layer. */
  post: PostFx;
  /** Camera dolly -1..1 (in close / far). */
  dolly?: number;
  /** Build an indoor place as a little 3D box room. */
  room?: boolean;
  /**
   * Draw the place as a flat image instead of the 3D layer: "plain", or
   * "dither" (1-bit Bayer at `rows` pixel rows). `fit` is background-size.
   * "none": the theme draws the place itself; the world element shows nothing.
   */
  flat?: "plain" | "dither" | "none";
  /**
   * The theme draws the place as its own 3D stage (`ctx.stage3d()`): the
   * host shows the WebGL canvas and leaves the scene to the theme. Ignored
   * in a delve (the corridor takes the layer) and without WebGL.
   */
  custom?: boolean;
  rows?: number;
  fit?: "cover" | "contain";
}

export interface AutomapStyle {
  floor: string;
  /** Lit corridor (L) cells. */
  lit: string;
  you: string;
  /** Room marks: one colour for all (1-bit), or per kind when omitted. */
  mark?: string;
}

export interface ThemeCtx {
  /** The theme's root element (empty when the theme mounts). Fills the scene; `container-type: size`. */
  readonly root: HTMLDivElement;
  /** The place painting / WebGL layer. Put it in your DOM; it follows its box size. */
  readonly world: HTMLDivElement;
  readonly reducedMotion: boolean;
  /** True when the 3D layer is running (false: flat image fallback). */
  readonly has3d: boolean;

  backdrop(v: SceneView, o: BackdropOpts): void;
  /**
   * Your own three.js stage on the host's WebGL layer (null without WebGL).
   * Calling it switches the layer to the custom stage (leaving any built-in
   * room); build models, lights and the camera in `root`, drive them in
   * `setUpdate`, pick with `pick`. Import what you need from "three". When
   * `generation` changes (a delve corridor used the layer meanwhile), the
   * old root was disposed: rebuild. Your textures are yours to dispose in
   * destroy(); geometry and materials under root are disposed for you.
   */
  stage3d(): Stage3D | null;
  /** URL of an art key, if loaded. */
  art(key: string | null | undefined): string | null;
  /** URL of the place painting, if loaded. */
  placeArt(v: SceneView): string | null;
  people(v: SceneView): PersonView[];
  /**
   * A person's art prepared for the theme: opaque art on a flat ground is
   * keyed to a cutout when it can be; "onebit" also dithers it to 1-bit at
   * `rows` rows. null while it is being prepared (render runs again when it lands).
   */
  personArt(v: SceneView, personId: string, mode?: "color" | "onebit", rows?: number): PersonArt | null;
  /** A 1-bit dithered copy of any image URL (cached). */
  dither(url: string, rows: number): Promise<string>;
  menu(v: SceneView): MenuItem[];
  status(v: SceneView): StatusView;
  box(v: SceneView): BoxView;
  hand(v: SceneView): HandCard[];
  /** The honeycomb overland into an <svg> (cells: g.here / g.step / g.goto, polygon.fog, circle.pin / circle.you, text). */
  drawHex(svg: SVGSVGElement, v: SceneView): void;
  drawAutomap(canvas: HTMLCanvasElement, d: DelveView, style: AutomapStyle): void;

  readonly journal: {
    readonly open: boolean;
    toggle(): void;
    /** The journal's contents as HTML (h3, ul/li, .muted, .done, .bond, .aff > i[.neg]); frame and style it. */
    html(v: SceneView): string;
  };
  readonly classes: { readonly open: boolean; toggle(): void };
  readonly themes: readonly { id: ThemeId; label: string }[];
  setTheme(id: ThemeId): void;

  /** Smoothed pointer over the scene, -1..1 both ways (0,0 at centre). */
  pointer(): { x: number; y: number };
  /** Run fn every animation frame while the scene is visible; returns an unsubscribe. */
  onFrame(fn: (t: number, dt: number) => void): () => void;
  /** Ask the host to call render again (e.g. after the theme's own async work). */
  rerender(): void;
}

export interface ThemeRenderer {
  render(v: SceneView): void;
  /** How the expedition board (a shared overlay, ../board.ts) looks over this theme. */
  boardSkin?: BoardSkin;
  /** Theme keys (numbers, letters). Return true when handled. Delve arrows/WASD are the host's. */
  key?(e: KeyboardEvent, v: SceneView): boolean;
  destroy(): void;
}

export type ThemeFactory = (ctx: ThemeCtx) => ThemeRenderer;

export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Seeded PRNG for procedural textures (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string to a 32-bit seed. */
export function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
