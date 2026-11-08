/**
 * What a scene theme may provide for the battle stage. Each theme owns one file here (./<theme>.ts); nothing in
 * it is shared with another theme. The stage keeps the rules, the figures and their animation, the effects, the
 * floating numbers and the cut-ins (../battle/*); a theme decides how the fight is laid out and dressed:
 *
 *  - `skin`: palette, type, frame and bar material, picture post-process (../skin.ts). Required.
 *  - `layout`: where everything goes for a screen size (default ../battle/layout.ts computeLayout). Return the
 *    same shape; the enemy area, the party cards, the turn strip and the menu may go anywhere.
 *  - `partyCard` / `actionMenu` / `timeline`: the theme's own HUD pieces. Return a subclass of the stock class
 *    (../battle/party-card.ts, action-menu.ts, timeline-strip.ts): the stage and the event player call their
 *    public methods (place, setUnit, setActive, setTargetable, update, portraitCentre, bust, flash, replaceBust,
 *    showSkills, showTarget, showWait, onPick/onBack/onConfirm, set). Override the drawing (their members are
 *    protected) freely; keep those methods working.
 *  - `backdrop`: "plate" (default: the painted plate behind the fight) or "transparent": nothing is drawn behind
 *    the fight and the canvas is see-through, for a theme that stages the fight in its 3D scene room (the room
 *    shows through; ../../scene/themes/contract.ts ThemeRenderer.encounter).
 *  - `decorate`: called once the stage is built, with the stage itself. Add anything (diegetic props, frames,
 *    a scoreboard, a hand drawn over the cards, extra layers) to its containers: `stage.back` (behind the
 *    figures), `stage.field` (the figures), `stage.hud`, `stage.fxLayer`, `stage.floatLayer`, `stage.cutLayer`, or
 *    `stage.app.stage` itself. Return hooks for resize, per-frame update and teardown.
 *
 * Everything must work from a phone (~390x800) to an ultrawide window (2560x905), and honour reduced motion
 * (`stage.reduced`). The theme is chosen by the scene the fight happens in (../skin.ts applyStageSkin).
 */
import type { BattleEvent, BattleState } from "../../../engine/types.js";
import type { BattleStage } from "../battle/stage.js";
import type { StageLayout } from "../battle/layout.js";
import type { PartyCard } from "../battle/party-card.js";
import type { ActionMenu } from "../battle/action-menu.js";
import type { TimelineStrip } from "../battle/timeline-strip.js";
import type { DisplayUnit } from "../battle/display.js";
import type { FigureSource } from "../puppet/source.js";
import type { StageSkin } from "../skin.js";

export interface StageDecor {
  /** After every layout (the screen size changed). */
  resize?(w: number, h: number, layout: StageLayout): void;
  /** Every frame (seconds). */
  update?(now: number, dt: number): void;
  /** Each engine event as it starts playing (in order, during the animation), for a combat log. */
  event?(ev: BattleEvent, state: BattleState): void;
  destroy?(): void;
}

export interface BattleTheme {
  skin: StageSkin;
  backdrop?: "plate" | "transparent";
  /** false: no nameplate under each enemy (the theme shows names and HP itself; also EnemyView.showPlate). */
  enemyPlates?: boolean;
  /** false: no hairline target corners around each enemy (the theme marks targets itself). */
  enemyBrackets?: boolean;
  layout?(w: number, h: number, party: number): StageLayout;
  partyCard?(unit: DisplayUnit, bust: FigureSource, strength: number, cutout: boolean): PartyCard;
  actionMenu?(): ActionMenu;
  timeline?(): TimelineStrip;
  decorate?(stage: BattleStage): StageDecor;
}
