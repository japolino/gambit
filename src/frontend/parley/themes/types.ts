/**
 * What a scene theme may provide for Parley (the talk). Each theme owns one file here (./<theme>.ts); nothing in
 * it is shared with another theme. The view (../view.ts) keeps the talk's logic and its DOM: the scene (place
 * plate, the NPC figure, nameplate, tells, moments), the side panel (header with the stake and patience, the
 * log, the input, Say and the deal actions), the journal of facts and the Table hand. A theme decides how it
 * looks and where things go:
 *
 *  - `css`: the theme's stylesheet, scoped under `.pl.th-<id>` (the view adds that class to its root). It may
 *    move, hide, restyle or re-lay-out anything the view builds.
 *  - `decorate`: called once the DOM is built. Add the theme's own structure (diegetic props, SVG artwork,
 *    canvases, a WebGL layer, wrappers) to `ctx.root` / `ctx.scene` / `ctx.side`; read what the talk is doing
 *    through `update`, which runs after every state change. Never remove the view's controls: keyboard and
 *    phone players use them (restyle or reposition them instead).
 *  - `inRoom`: the talk happens inside the theme's 3D scene room (Table, Diorama): the view draws no place
 *    plate or backdrop of its own and its root is see-through, so the room shows behind it; the scene theme
 *    stages the NPC in the room (../../scene/themes/contract.ts ThemeRenderer.encounter).
 *
 * Everything must work from a phone (~390x800) to an ultrawide window (2560x905), and honour reduced motion.
 */
import type { ParleyScenario, ParleyState } from "../../../engine/parley/types.js";

export interface ParleyThemeCtx {
  /** The view's root (`.pl.th-<id>`), its scene (left/top) and its side panel. */
  root: HTMLElement;
  scene: HTMLElement;
  side: HTMLElement;
  scenario: ParleyScenario;
  state: ParleyState;
  reducedMotion: boolean;
}

export interface ParleyDecor {
  /** After every state change, with the facts in the journal. */
  update?(state: ParleyState, journal: string[]): void;
  destroy?(): void;
}

export interface ParleyTheme {
  css: string;
  decorate?(ctx: ParleyThemeCtx): ParleyDecor;
  inRoom?: boolean;
}
