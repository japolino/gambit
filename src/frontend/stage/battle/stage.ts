/**
 * The battle stage: one Pixi canvas with the battlefield plate, the enemy
 * puppets on the floor, the timeline strip, the party cards and the action
 * menu (docs/DESIGN.md, 4.2 and 6). It shows a BattleState, lets the
 * active party member choose an action, and plays the engine's events as
 * an animation queue (player.ts). Rules come from the engine
 * (legalActions, timeline); the stage never computes an outcome.
 */
import { Application, Container, DisplacementFilter, Graphics, Sprite } from "pixi.js";
import { legalActions, timeline } from "../../../engine/battle.js";
import type { Action, BattleEvent, BattleState, SkillDef, TargetRule } from "../../../engine/types.js";
import { puppetQuality, puppetQualityFrame, puppetRenderScale } from "../../../vendor/cue-puppet/sprite-puppet-quality.js";
import { Clock, ease, reducedMotion } from "../anim.js";
import { ArtStore, paletteFor, type ArtRequest } from "../art.js";
import { C } from "../theme.js";
import { vgrad } from "../ui.js";
import { ActionMenu, type MenuSkill } from "./action-menu.js";
import { displayFromState, type DisplayUnit } from "./display.js";
import { EnemyView } from "./enemy-view.js";
import { Floaters } from "./floaters.js";
import { computeLayout, enemySlots, type StageLayout } from "./layout.js";
import { PartyCard } from "./party-card.js";
import { playEvents } from "./player.js";
import { TimelineStrip } from "./timeline-strip.js";

export type StepResult = { state: BattleState; events: BattleEvent[] };

export type StageOptions = {
  state: BattleState;
  onAction(action: Action): Promise<StepResult> | StepResult;
  portraitFor?(id: string): string | undefined;
};

/** Options for a generated image (setArt). */
export type ArtOptions = { cutout?: boolean };

/** Motion strength for puppets (Cue's amplitudes are tuned for calm VN scenes). */
const ENEMY_STRENGTH = 1.6;
const BUST_STRENGTH = 1.1;

const TARGET_HINT: Readonly<Record<TargetRule, string>> = {
  self: "Targets yourself.",
  ally: "Tap an ally.",
  all_allies: "Affects the whole party.",
  lowest_hp_ally: "Goes to the most wounded ally.",
  enemy: "Tap an enemy.",
  all_enemies: "Strikes every enemy.",
  random_enemies: "Strikes enemies at random.",
};

export class BattleStage {
  readonly clock: Clock;
  readonly art: ArtStore;
  readonly bg = new Sprite();
  /** The plate and its depth map, moved and displaced together. */
  private readonly plate = new Container();
  readonly bgShade = new Graphics();
  readonly field = new Container();
  readonly hud = new Container();
  readonly fxLayer = new Container();
  readonly cutLayer = new Container();
  readonly flash = new Graphics();
  readonly timeline = new TimelineStrip();
  readonly menu = new ActionMenu();
  readonly floaters: Floaters;
  readonly enemies = new Map<string, EnemyView>();
  readonly cards = new Map<string, PartyCard>();
  units = new Map<string, DisplayUnit>();
  state: BattleState;
  layout: StageLayout;
  reduced = reducedMotion();
  /** Signature skills already cut in this battle. */
  readonly cutinsPlayed = new Set<string>();
  /** The order the timeline strip shows (updated between syncs). */
  order: string[] = [];
  private selection: { skill: SkillDef; targets: string[]; auto: boolean } | null = null;
  private busy = false;
  private queue: Promise<void> = Promise.resolve();
  private quality = puppetQuality();
  private baseResolution: number;
  private parallax = { x: 0, y: 0, tx: 0, ty: 0 };
  private depthMap!: Sprite;
  private depthFx!: DisplacementFilter;
  private destroyed = false;
  private bgSeed: string;

  constructor(readonly app: Application, private opts: StageOptions) {
    this.state = opts.state;
    this.clock = new Clock(app.ticker);
    this.art = new ArtStore();
    this.baseResolution = app.renderer.resolution;
    this.layout = computeLayout(app.screen.width, app.screen.height, this.party().length);
    this.floaters = new Floaters(this.fxLayer, this.clock, () => this.layout.ui, () => this.reduced);
    this.field.sortableChildren = true;
    app.stage.addChild(this.plate, this.field, this.bgShade, this.hud, this.fxLayer, this.flash, this.cutLayer);
    this.hud.addChild(this.timeline, this.menu);
    this.bgSeed = `${opts.state.id}`;
    const accent = paletteFor(this.enemiesOf(opts.state)[0]?.defId ?? "", this.bgSeed);
    const plate = this.art.background(this.bgSeed, accent);
    this.bg.texture = plate.color;
    // Depth parallax: the depth map rides on the plate (same frame) and
    // displaces it, so near pillars and floor slide more than the far fog.
    this.depthMap = new Sprite(plate.depth);
    this.depthMap.renderable = false;
    this.plate.addChild(this.bg, this.depthMap);
    this.depthFx = new DisplacementFilter({ sprite: this.depthMap, scale: 0 });
    this.plate.filters = [this.depthFx];
    this.units = displayFromState(opts.state);
    this.build();
    this.menu.onPick = (id) => this.pick(id);
    this.menu.onBack = () => this.cancelTarget();
    this.menu.onConfirm = () => this.confirm();
    app.stage.eventMode = "static";
    app.stage.hitArea = app.screen;
    app.stage.on("pointertap", () => { if (this.busy) this.clock.speed = 2.5; });
    app.stage.on("pointermove", (e) => {
      this.parallax.tx = (e.global.x / Math.max(1, this.layout.w) - 0.5) * 2;
      this.parallax.ty = (e.global.y / Math.max(1, this.layout.h) - 0.5) * 2;
    });
    this.clock.onFrame((now, dt) => this.frame(now, dt));
    this.resize(app.screen.width, app.screen.height);
    this.sync(opts.state);
  }

  private party(state = this.state) { return state.combatants.filter((c) => c.side === "party"); }
  private enemiesOf(state = this.state) { return state.combatants.filter((c) => c.side === "enemy"); }

  artRequest(u: { id: string; defId: string; art: string; rig: DisplayUnit["rig"]; side: "party" | "enemy" }): ArtRequest {
    return { id: u.id, defId: u.defId, art: u.art, rig: u.rig, side: u.side };
  }

  private strength(base: number): number {
    return this.reduced ? 0 : base;
  }

  private build(): void {
    for (const c of this.enemiesOf()) {
      const u = this.units.get(c.id)!;
      const req = this.artRequest(u);
      const pick = this.art.pick(req);
      const view = new EnemyView(u, pick.source, this.strength(ENEMY_STRENGTH), pick.cutout);
      view.on("pointertap", (e) => { e.stopPropagation(); this.tapTarget(c.id); });
      view.on("pointerover", () => view.hover(true));
      view.on("pointerout", () => view.hover(false));
      this.enemies.set(c.id, view);
      this.field.addChild(view);
    }
    for (const c of this.party()) {
      const u = this.units.get(c.id)!;
      const req = this.artRequest(u);
      const pick = this.art.pick(req);
      const card = new PartyCard(u, pick.source, this.strength(BUST_STRENGTH), pick.cutout);
      card.on("pointertap", (e) => { e.stopPropagation(); this.tapTarget(c.id); });
      this.cards.set(c.id, card);
      this.hud.addChild(card);
    }
    // The older per-combatant hook feeds the same path as setArt.
    if (this.opts.portraitFor) {
      for (const c of this.state.combatants) {
        const url = this.opts.portraitFor(c.id);
        if (url) this.setArt(c.art, url, { cutout: true });
      }
    }
  }

  /**
   * A generated image for an art key (Combatant.art) arrived: load it, and
   * cross-fade every combatant drawn from that key onto it (enemy puppets,
   * party portraits, timeline chips, later cut-ins). A key set before its
   * combatant appears (a phase-2 form) is used when it does.
   */
  setArt(key: string, url: string, opts: ArtOptions = {}): void {
    if (key === this.state.meta?.backdrop) {
      // A card battle is fought in the scene's own painting (6.1).
      void this.art.setArt(key, url, false).then((src) => {
        if (!src || this.destroyed) return;
        this.bg.texture = src.texture;
        this.plate.filters = [];
        this.resize(this.app.screen.width, this.app.screen.height);
      });
      return;
    }
    void this.art.setArt(key, url, opts.cutout ?? true).then((src) => {
      if (src && !this.destroyed) this.applyArt(key);
    });
  }

  private applyArt(key: string): void {
    const fade = (fresh: { alpha: number }, old: { alpha: number }, drop: () => void) => {
      fresh.alpha = 0;
      void this.clock.tween(this.reduced ? 120 : 450, (k) => { fresh.alpha = k; old.alpha = 1 - k; }, ease.inOutCubic).then(drop);
    };
    for (const u of this.units.values()) {
      if (u.art !== key) continue;
      const pick = this.art.pick(this.artRequest(u));
      const view = this.enemies.get(u.id);
      if (view) {
        const { fresh, old } = view.replaceFigure(pick.source, u.rig, this.strength(ENEMY_STRENGTH), pick.cutout);
        fresh.setMood(u.broken ? "broken" : u.hp / u.maxHp < 0.3 ? "wounded" : "neutral");
        fade(fresh, old, () => view.dropFigure(old));
      }
      const card = this.cards.get(u.id);
      if (card) {
        const { fresh, old } = card.replaceBust(pick.source, this.strength(BUST_STRENGTH), pick.cutout);
        fade(fresh, old, () => card.dropBust(old));
      }
    }
    this.refreshTimeline();
  }

  resize(w: number, h: number): void {
    if (this.destroyed) return;
    this.layout = computeLayout(w, h, this.party().length);
    const l = this.layout;
    // The plate covers the screen with its floor line on the stage floor.
    const tex = this.bg.texture;
    const pw = tex.width;
    const ph = tex.height;
    const floor = 0.62;
    const s = Math.max(w / pw, l.floorY / (floor * ph), (h - l.floorY) / ((1 - floor) * ph)) * 1.04;
    this.plate.scale.set(s);
    this.plate.position.set((w - pw * s) / 2, l.floorY - floor * ph * s);
    this.bgShade.clear();
    const shadeTop = l.portrait ? l.enemyArea.h * 0.86 : l.floorY - 20 * l.ui;
    this.bgShade.rect(0, shadeTop, w, h - shadeTop).fill(vgrad(0x070605, 0x070605, 0, l.portrait ? 0.92 : 0.78));
    const enemies = this.enemiesOf();
    const slots = enemySlots(l, enemies.map((c) => this.units.get(c.id)?.rig ?? c.rig));
    enemies.forEach((c, i) => this.enemies.get(c.id)?.place(slots[i]!, l.ui, w));
    this.party().forEach((c, i) => this.cards.get(c.id)?.place(l.cards[i]!, l.ui));
    this.timeline.place(l.timeline, l.ui);
    this.menu.place(l.menu, l.ui);
    this.app.stage.hitArea = this.app.screen;
    this.refreshTimeline();
  }

  private frame(now: number, dt: number): void {
    for (const v of this.enemies.values()) v.update(now, dt);
    for (const c of this.cards.values()) c.update(now, dt);
    this.timeline.update(dt);
    // A little depth: the plate drifts against the pointer, the field less.
    const p = this.parallax;
    const a = 1 - Math.exp(-dt / 0.6);
    p.x += ((this.reduced ? 0 : p.tx) - p.x) * a;
    p.y += ((this.reduced ? 0 : p.ty) - p.y) * a;
    this.plate.pivot.set(p.x * 6 * this.layout.ui, p.y * 3 * this.layout.ui);
    // Displacement is in screen pixels around depth 0.5: near moves one way, far the other.
    if (this.plate.filters?.length) this.depthFx.scale.set(p.x * -28 * this.layout.ui, p.y * -12 * this.layout.ui);
    this.field.pivot.set(p.x * -4 * this.layout.ui, 0);
    if (puppetQualityFrame(this.quality, performance.now())) {
      const res = this.baseResolution * puppetRenderScale(this.quality);
      this.app.renderer.resize(this.app.screen.width, this.app.screen.height, res);
    }
  }

  setReduced(on: boolean): void {
    this.reduced = on;
    for (const v of this.enemies.values()) v.figure.strength = this.strength(ENEMY_STRENGTH);
    for (const c of this.cards.values()) c.bust.strength = this.strength(BUST_STRENGTH);
  }

  /* ---------------------------------------------------------------- */
  /* State                                                             */
  /* ---------------------------------------------------------------- */

  /** Show a state as is (after a batch of events, or a fresh mount). */
  sync(state: BattleState): void {
    this.state = state;
    this.units = displayFromState(state);
    for (const [id, u] of this.units) this.refreshUnit(id, u);
    this.order = state.outcome === "ongoing" ? timeline(state, 8) : [];
    this.refreshTimeline();
    for (const [id, v] of this.enemies) {
      const u = this.units.get(id);
      v.visible = !!u?.alive;
      v.setActive(id === state.active);
      v.figure.setMood(u?.broken ? "broken" : u && u.hp / u.maxHp < 0.3 ? "wounded" : "neutral");
    }
    for (const [id, c] of this.cards) c.setActive(id === state.active);
    this.showMenu();
  }

  refreshUnit(id: string, u = this.units.get(id)): void {
    if (!u) return;
    this.enemies.get(id)?.setUnit(u);
    this.cards.get(id)?.setUnit(u);
  }

  refreshTimeline(): void {
    const order = this.order.map((id) => {
      const u = this.units.get(id);
      const c = this.state.combatants.find((x) => x.id === id);
      const src = u ?? (c ? { id, defId: c.defId, art: c.art, rig: c.rig, side: c.side } : null);
      if (!src) return null;
      return { id, texture: this.art.chip(this.artRequest(src)), enemy: src.side === "enemy", alive: u?.alive ?? true };
    }).filter((x): x is NonNullable<typeof x> => !!x);
    this.timeline.set(order);
  }

  /** The strip after `actor` starts a turn: drop everyone before its first slot. */
  advanceOrder(actor: string): void {
    const i = this.order.indexOf(actor);
    this.order = i >= 0 ? this.order.slice(i) : [actor, ...this.order];
    this.refreshTimeline();
  }

  /* ---------------------------------------------------------------- */
  /* Choosing an action                                                */
  /* ---------------------------------------------------------------- */

  private activeMember(): DisplayUnit | null {
    const id = this.state.active;
    const u = id ? this.units.get(id) : undefined;
    return u && u.side === "party" && this.state.outcome === "ongoing" ? u : null;
  }

  private costLabel(skill: SkillDef, resourceName?: string): string {
    const c = skill.cost ?? {};
    const parts: string[] = [];
    if (typeof c.focus === "number" && c.focus > 0) parts.push(`${c.focus} Focus`);
    if (c.resource) parts.push(`${c.resource} ${resourceName ?? "Res"}`);
    if (c.hpPct) parts.push(`${c.hpPct}% HP`);
    if (c.cooldown) parts.push(`CD ${c.cooldown}`);
    return parts.length ? parts.join(" · ") : skill.tier === 0 ? "Basic" : "Free";
  }

  showMenu(): void {
    this.selection = null;
    this.clearTargets();
    if (this.state.outcome !== "ongoing") {
      this.menu.showWait(this.state.outcome === "victory" ? "Victory." : this.state.outcome === "defeat" ? "The party has fallen." : "The battle is over.");
      return;
    }
    const u = this.activeMember();
    if (!u || this.busy) {
      this.menu.showWait(this.busy ? "" : "Waiting…");
      return;
    }
    const options = legalActions(this.state, u.id);
    const skills: MenuSkill[] = options.map((o) => ({
      id: o.skill.id,
      name: o.skill.name,
      cost: this.costLabel(o.skill, u.resource?.name),
      usable: o.usable,
      reason: o.reason,
      signature: !!o.skill.signature,
      flavor: o.skill.flavor,
    }));
    this.menu.showSkills(u.name, skills);
  }

  private pick(skillId: string): void {
    const u = this.activeMember();
    if (!u || this.busy) return;
    const option = legalActions(this.state, u.id).find((o) => o.skill.id === skillId);
    if (!option?.usable) return;
    const sets = option.targetSets;
    const auto = sets.length === 1 && sets[0]!.length === 0;
    const rule = option.skill.target;
    let targets: string[];
    if (!auto) targets = sets.map((s) => s[0]!).filter(Boolean);
    else {
      const living = this.state.combatants.filter((c) => c.alive);
      if (rule === "self") targets = [u.id];
      else if (rule === "all_allies" || rule === "lowest_hp_ally") targets = living.filter((c) => c.side === "party").map((c) => c.id);
      else targets = living.filter((c) => c.side === "enemy").map((c) => c.id);
    }
    this.selection = { skill: option.skill, targets, auto };
    this.clearTargets();
    for (const id of targets) {
      this.enemies.get(id)?.setTargetable(true);
      this.cards.get(id)?.setTargetable(true);
    }
    this.menu.showTarget(option.skill.name, TARGET_HINT[rule] ?? "Choose a target.", auto);
  }

  private clearTargets(): void {
    for (const v of this.enemies.values()) v.setTargetable(false);
    for (const c of this.cards.values()) c.setTargetable(false);
  }

  private cancelTarget(): void {
    this.showMenu();
  }

  private tapTarget(id: string): void {
    const sel = this.selection;
    if (!sel || this.busy || !sel.targets.includes(id)) return;
    void this.submit({ actor: this.state.active!, skill: sel.skill.id, targets: sel.auto ? [] : [id] });
  }

  private confirm(): void {
    const sel = this.selection;
    if (!sel || this.busy) return;
    void this.submit({ actor: this.state.active!, skill: sel.skill.id, targets: [] });
  }

  private async submit(action: Action): Promise<void> {
    this.busy = true;
    this.selection = null;
    this.clearTargets();
    this.menu.showWait("");
    try {
      const result = await this.opts.onAction(action);
      await this.play(result.state, result.events);
    } catch (err) {
      this.busy = false;
      void this.floaters.banner(this.layout.banner.x, this.layout.banner.y, "Not now", err instanceof Error ? err.message : String(err), C.enemy, 1200);
      this.showMenu();
    }
  }

  /* ---------------------------------------------------------------- */
  /* Playing events                                                    */
  /* ---------------------------------------------------------------- */

  /** Play events toward `state` (queued behind any batch already playing). */
  update(state: BattleState, events: BattleEvent[]): Promise<void> {
    this.queue = this.queue.then(() => this.play(state, events));
    return this.queue;
  }

  private async play(state: BattleState, events: BattleEvent[]): Promise<void> {
    if (this.destroyed) return;
    this.busy = true;
    this.showMenu();
    try {
      await playEvents(this, events, state);
    } finally {
      this.clock.speed = 1;
      this.busy = false;
      if (!this.destroyed) this.sync(state);
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.clock.destroy();
    this.art.destroy();
  }
}
