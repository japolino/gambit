/**
 * Entry for the battle stage. The host wiring mounts it inside Gambit's
 * Shadow DOM root and drives it from backend messages:
 *
 *   const stage = mountBattleStage(root, { state, onAction, portraitFor });
 *   await stage.update(state, events);   // a battle.state message
 *   stage.setArt("monster:drowned_thrall", url, { cutout: true });  // an art.update
 *   stage.destroy();
 *
 * Everything renders into one Pixi canvas under `root`; nothing touches
 * document.body. WebGL is requested (the figure shader is GLSL).
 */
import { Application } from "pixi.js";
import type { Action, BattleEvent, BattleState } from "../../engine/types.js";
import { reducedMotion } from "./anim.js";
import { BattleStage, type ArtOptions, type StepResult } from "./battle/stage.js";
import type { ThemeId } from "../../shared/scene-view.js";
import { applyStageSkin, loadSkinFonts } from "./skin.js";
import { C, hex } from "./theme.js";

export type BattleStageOptions = {
  state: BattleState;
  onAction(action: Action): Promise<StepResult> | StepResult;
  portraitFor?(id: string): string | undefined;
  /**
   * The scene theme to dress the fight in (skin.ts). Omitted: the stage's own look, as the colour tokens stand
   * (a caller may have applied a look's tokens, theme.ts applyUiTokens).
   */
  theme?: ThemeId | null;
};

export type BattleStageHandle = {
  update(state: BattleState, events: BattleEvent[]): Promise<void>;
  /**
   * Generated art for an art key (Combatant.art, e.g. "monster:drowned_thrall",
   * "class:duelist", "monster:bell_acolyte_unrung"). Loads it, rebuilds the
   * rig from its alpha and cross-fades from the placeholder; party keys
   * become the card and cut-in portrait. Keys may arrive before their
   * combatant does. `cutout: false` (an opaque image) is shown framed, not
   * warped. Default cutout: true.
   */
  setArt(artKey: string, url: string, opts?: ArtOptions): void;
  destroy(): void;
};

export function mountBattleStage(root: HTMLElement, opts: BattleStageOptions): BattleStageHandle {
  const host = document.createElement("div");
  host.setAttribute("data-gambit-stage", "battle");
  if (opts.theme) applyStageSkin(opts.theme);
  host.style.cssText = `position:relative;width:100%;height:100%;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;background:${hex(C.ink)};`;
  root.appendChild(host);

  const app = new Application();
  let stage: BattleStage | null = null;
  let destroyed = false;
  let observer: ResizeObserver | null = null;
  /** setArt calls made before the stage exists. */
  const pendingArt: Array<[string, string, ArtOptions | undefined]> = [];
  const motion = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  const onMotion = () => stage?.setReduced(reducedMotion());

  const ready = (async () => {
    await loadSkinFonts(opts.theme);
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    await app.init({
      width,
      height,
      preference: "webgl",
      antialias: true,
      background: C.ink,
      resolution: Math.min(2, globalThis.devicePixelRatio || 1),
      autoDensity: true,
    });
    if (destroyed) {
      app.destroy(true, { children: true });
      return;
    }
    const canvas = app.canvas as HTMLCanvasElement;
    canvas.style.cssText = "display:block;width:100%;height:100%;";
    host.appendChild(canvas);
    stage = new BattleStage(app, opts);
    // For debugging from devtools: the host element carries its stage.
    (host as unknown as { gambitStage?: BattleStage }).gambitStage = stage;
    for (const [key, url, o] of pendingArt.splice(0)) stage.setArt(key, url, o);
    observer = new ResizeObserver(() => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      if (w === app.screen.width && h === app.screen.height) return;
      app.renderer.resize(w, h);
      stage?.resize(w, h);
    });
    observer.observe(host);
    motion?.addEventListener("change", onMotion);
  })();

  return {
    async update(state, events) {
      await ready;
      if (stage && !destroyed) await stage.update(state, events);
    },
    setArt(artKey, url, o) {
      if (destroyed) return;
      if (stage) stage.setArt(artKey, url, o);
      else pendingArt.push([artKey, url, o]);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      observer?.disconnect();
      motion?.removeEventListener("change", onMotion);
      void ready.then(() => {
        stage?.destroy();
        if (stage) app.destroy(true, { children: true, texture: true });
        host.remove();
      });
    },
  };
}
