/**
 * Plays the engine's BattleEvent[] on the stage, one after another. Each
 * kind has a short animation; the player waits only for its "hold" (how
 * long before the next event may start), so a multi-target strike lands
 * as a quick ripple and a single hit takes about 250-600 ms. Tapping the
 * stage fast-forwards. The display copy is updated per event so bars move
 * with each hit; the stage syncs to the final state afterwards.
 */
import { Graphics } from "pixi.js";
import type { BattleEvent, BattleState } from "../../../engine/types.js";
import { ease } from "../anim.js";
import { playCutIn } from "../cutin/cutin.js";
import { C, ELEMENT_COLOR, STATUS_STYLE, parsePalette } from "../theme.js";
import { applyEvent } from "./display.js";
import { screenFlash, shake } from "./floaters.js";
import type { BattleStage } from "./stage.js";

type Point = { x: number; y: number };

/** Where a combatant is on screen: an enemy's face, or a card's portrait. */
function anchorOf(stage: BattleStage, id: string): Point | null {
  const e = stage.enemies.get(id);
  if (e) return e.faceGlobal;
  const c = stage.cards.get(id);
  if (c) return c.portraitCentre;
  return null;
}

/** Where numbers rise from: above an enemy's head, or over a card. */
function numberSpot(stage: BattleStage, id: string): Point | null {
  const e = stage.enemies.get(id);
  if (e) {
    const f = e.faceGlobal;
    return { x: f.x + (Math.random() - 0.5) * 16, y: Math.max(e.topY + 40 * stage.layout.ui, f.y - 10) };
  }
  const c = stage.cards.get(id);
  if (c) return { x: c.portraitCentre.x, y: c.portraitCentre.y + 10 };
  return null;
}

async function enemyLunge(stage: BattleStage, id: string): Promise<void> {
  const v = stage.enemies.get(id);
  if (!v) return;
  v.figure.gesture("lean_in", 1.6);
  v.figure.kick(0, -0.35);
  if (stage.reduced) return;
  const lift = v.slot.height * 0.03;
  await stage.clock.tween(170, (k) => {
    v.body.scale.set(1 + 0.08 * k);
    v.body.y = lift * k;
  }, ease.outCubic);
  void stage.clock.tween(280, (k) => {
    v.body.scale.set(1.08 - 0.08 * k);
    v.body.y = lift * (1 - k);
  }, ease.inOutCubic);
}

function streak(stage: BattleStage, from: Point, to: Point, color: number): void {
  if (stage.reduced) return;
  const g = new Graphics();
  g.blendMode = "add";
  stage.fxLayer.addChild(g);
  void stage.clock.tween(170, (k) => {
    g.clear();
    const head = ease.outCubic(k);
    const tail = Math.max(0, head - 0.35);
    const x0 = from.x + (to.x - from.x) * tail;
    const y0 = from.y + (to.y - from.y) * tail;
    const x1 = from.x + (to.x - from.x) * head;
    const y1 = from.y + (to.y - from.y) * head;
    g.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: 3 * stage.layout.ui, color, alpha: 0.8 * (1 - k * 0.5) });
  }, ease.linear).then(() => g.destroy());
}

function hitReaction(stage: BattleStage, ev: Extract<BattleEvent, { kind: "hit" }>): void {
  const u = stage.units.get(ev.target);
  const frac = u ? Math.min(1, ev.amount / Math.max(1, u.maxHp)) : 0.1;
  const from = anchorOf(stage, ev.source);
  const to = anchorOf(stage, ev.target);
  const side = from && to ? Math.sign(to.x - from.x) || 1 : 1;
  const color = ELEMENT_COLOR[ev.element] ?? C.text;
  const power = (ev.crit ? 1.4 : 1) * (ev.weak ? 1.2 : 1);
  const e = stage.enemies.get(ev.target);
  if (e) {
    const f = e.figure;
    f.gesture("jolt", 0.7 + frac * 1.6 * power, side);
    f.gesture("flinch", 0.6 + frac * 1.4 * power, side);
    f.kick(side * (0.2 + frac * 1.1 * power), 0.12 + frac * 0.3);
    if (!stage.reduced) {
      const push = side * (6 + frac * 30) * stage.layout.ui * power;
      void stage.clock.tween(300, (k) => { e.body.x = push * Math.sin(Math.PI * k) * (1 - k * 0.3); }, ease.outCubic);
    }
    void stage.clock.tween(240, (k) => f.setFlash(ev.absorbed ? C.heal : 0xfff4e0, (1 - k) * 0.8), ease.outCubic);
  }
  const card = stage.cards.get(ev.target);
  if (card) {
    card.bust.gesture("flinch", 0.8 + frac * 2, side);
    card.bust.kick(side * (0.25 + frac), 0.2);
    if (!stage.reduced) void shake(card, stage.clock, (4 + frac * 14) * stage.layout.ui, 240);
    const g = card.flash;
    g.clear().rect(0, 0, card.rect.w, card.rect.h).fill({ color: C.hp });
    void stage.clock.tween(320, (k) => { g.alpha = 0.45 * (1 - k); }, ease.outCubic);
  }
  if (to) stage.floaters.spark(to.x, to.y, color, power * (0.8 + frac));
  if (ev.crit && !stage.reduced) void shake(stage.field, stage.clock, 6 * stage.layout.ui, 220);
}

async function onEvent(stage: BattleStage, ev: BattleEvent, next: BattleEvent | undefined, final: BattleState): Promise<number> {
  const l = stage.layout;
  switch (ev.kind) {
    case "turn": {
      stage.advanceOrder(ev.actor);
      for (const [id, v] of stage.enemies) v.setActive(id === ev.actor);
      for (const [id, c] of stage.cards) c.setActive(id === ev.actor);
      return 120;
    }
    case "use": {
      const actor = stage.units.get(ev.actor);
      if (!actor) return 0;
      const enemy = actor.side === "enemy";
      const signature = ev.signature && !stage.cutinsPlayed.has(ev.skill);
      if (signature && !stage.reduced) {
        stage.cutinsPlayed.add(ev.skill);
        const req = stage.artRequest(actor);
        const portrait = stage.art.cutin(req);
        await playCutIn({
          layer: stage.cutLayer, clock: stage.clock, w: l.w, h: l.h, ui: l.ui,
          portrait: portrait.texture, face: portrait.face, visual: ev.cutin, skillName: ev.name, actorName: actor.name, enemy,
        });
      } else if (ev.signature) {
        // Later uses (and reduced motion): a short flash in the skill's colour.
        const pal = parsePalette(ev.cutin?.palette);
        void screenFlash(stage.flash, stage.clock, l.w, l.h, pal[1] ?? C.gold, stage.reduced ? 0.12 : 0.28, 260);
      }
      void stage.floaters.banner(l.banner.x, l.banner.y, ev.name, actor.name, enemy ? C.enemy : C.gold, 650);
      const from = anchorOf(stage, ev.actor);
      if (enemy) {
        stage.enemies.get(ev.actor)?.figure.lookAt(0);
        await enemyLunge(stage, ev.actor);
      } else {
        const card = stage.cards.get(ev.actor);
        card?.bust.gesture("lean_in", 1.4);
        if (from) {
          for (const t of ev.targets) {
            const to = anchorOf(stage, t);
            const isEnemy = stage.enemies.has(t);
            if (to && isEnemy) streak(stage, { x: from.x, y: from.y - 30 * l.ui }, to, C.gold);
          }
        }
      }
      return enemy ? 120 : 200;
    }
    case "hit": {
      hitReaction(stage, ev);
      applyEvent(stage.units, ev, final);
      stage.refreshUnit(ev.target);
      const spot = numberSpot(stage, ev.target);
      if (spot) {
        if (ev.shieldTaken > 0 && ev.amount === 0) stage.floaters.label(spot.x, spot.y, `Blocked ${ev.shieldTaken}`, C.shield);
        else if (!ev.absorbed) stage.floaters.number(spot.x, spot.y, { amount: ev.amount, kind: "damage", crit: ev.crit, weak: ev.weak, resisted: ev.resisted });
        else stage.floaters.label(spot.x, spot.y, "Absorbed", C.heal);
      }
      const sameStrike = next && (next.kind === "hit" || next.kind === "miss") && next.source === ev.source;
      const ripple = next && (next.kind === "poise" || next.kind === "status_on") ? 90 : 0;
      return sameStrike ? 130 : ripple || (ev.crit ? 420 : 300);
    }
    case "miss": {
      const spot = numberSpot(stage, ev.target);
      if (spot) stage.floaters.number(spot.x, spot.y, { amount: 0, kind: "miss" });
      stage.enemies.get(ev.target)?.figure.gesture("step_back", 1.2);
      stage.cards.get(ev.target)?.bust.gesture("step_back", 1.2);
      return 240;
    }
    case "heal":
    case "shield": {
      applyEvent(stage.units, ev, final);
      stage.refreshUnit(ev.target);
      const spot = numberSpot(stage, ev.target);
      if (spot) stage.floaters.number(spot.x, spot.y, { amount: ev.amount, kind: ev.kind });
      const c = stage.cards.get(ev.target);
      if (c) {
        const g = c.flash;
        g.clear().rect(0, 0, c.rect.w, c.rect.h).fill({ color: ev.kind === "heal" ? C.heal : C.shield });
        void stage.clock.tween(400, (k) => { g.alpha = 0.3 * (1 - k); });
      }
      const fig = stage.enemies.get(ev.target)?.figure;
      if (fig) void stage.clock.tween(300, (k) => fig.setFlash(ev.kind === "heal" ? C.heal : C.shield, 0.4 * (1 - k)));
      return next?.kind === ev.kind ? 90 : 220;
    }
    case "status_on": {
      applyEvent(stage.units, ev, final);
      stage.refreshUnit(ev.target);
      const spot = numberSpot(stage, ev.target);
      const style = STATUS_STYLE[ev.status];
      if (spot) stage.floaters.label(spot.x, spot.y - 22 * l.ui, style.label, style.color);
      return next?.kind === "status_on" ? 80 : 160;
    }
    case "status_off": {
      applyEvent(stage.units, ev, final);
      stage.refreshUnit(ev.target);
      return 40;
    }
    case "status_tick": {
      applyEvent(stage.units, ev, final);
      stage.refreshUnit(ev.target);
      const spot = numberSpot(stage, ev.target);
      const style = STATUS_STYLE[ev.status];
      if (spot) stage.floaters.number(spot.x, spot.y, { amount: ev.amount, kind: ev.status === "regen" ? "heal" : "tick", color: style.color });
      if (ev.status !== "regen") stage.enemies.get(ev.target)?.figure.gesture("flinch", 0.7);
      return 280;
    }
    case "poise": {
      applyEvent(stage.units, ev, final);
      stage.refreshUnit(ev.target);
      return 30;
    }
    case "break": {
      applyEvent(stage.units, ev, final);
      stage.refreshUnit(ev.target);
      const v = stage.enemies.get(ev.target);
      const at = anchorOf(stage, ev.target) ?? { x: l.w / 2, y: l.floorY / 2 };
      if (v) {
        v.figure.gesture("slump", 1.6);
        v.figure.setMood("broken");
        v.figure.kick(0, -0.6);
      }
      void screenFlash(stage.flash, stage.clock, l.w, l.h, C.break, stage.reduced ? 0.15 : 0.35, 300);
      if (!stage.reduced) void shake(stage.field, stage.clock, 8 * l.ui, 260);
      await stage.floaters.breakFlash(at.x, Math.max(80 * l.ui, at.y - 30 * l.ui));
      return 80;
    }
    case "recover": {
      applyEvent(stage.units, ev, final);
      stage.refreshUnit(ev.target);
      stage.enemies.get(ev.target)?.figure.setMood("neutral");
      stage.enemies.get(ev.target)?.figure.gesture("puff", 1);
      const spot = numberSpot(stage, ev.target);
      if (spot) stage.floaters.label(spot.x, spot.y, "Recovered", C.poise);
      return 300;
    }
    case "delay": {
      const spot = numberSpot(stage, ev.target);
      if (spot) stage.floaters.label(spot.x, spot.y - 22 * l.ui, ev.amount >= 0 ? "Delayed" : "Hastened", C.focusHi);
      return 200;
    }
    case "resource":
    case "focus": {
      applyEvent(stage.units, ev, final);
      stage.refreshUnit(ev.target);
      return 0;
    }
    case "skip": {
      const spot = numberSpot(stage, ev.actor);
      const text = ev.reason === "broken" ? "Broken" : ev.reason === "stun" ? "Stunned" : "Frozen in fear";
      if (spot) stage.floaters.label(spot.x, spot.y - 10 * l.ui, text, ev.reason === "broken" ? C.break : C.textDim, 13);
      stage.enemies.get(ev.actor)?.figure.gesture("tremble", 1.2);
      stage.cards.get(ev.actor)?.bust.gesture("tremble", 1.2);
      return 520;
    }
    case "phase": {
      const v = stage.enemies.get(ev.target);
      if (v) {
        v.figure.playShift("flare", 1.4);
        await stage.clock.tween(260, (k) => v.figure.setFlash(0xffb070, k * 0.95), ease.inCubic);
        applyEvent(stage.units, ev, final);
        const u = stage.units.get(ev.target)!;
        const req = stage.artRequest(u);
        const pick = stage.art.pick(req);
        const { fresh: fig, old } = v.replaceFigure(pick.source, u.rig, v.figure.strength, pick.cutout);
        v.dropFigure(old);
        fig.playShift("flare", 1.4);
        stage.resize(l.w, l.h);
        stage.refreshUnit(ev.target);
        void screenFlash(stage.flash, stage.clock, l.w, l.h, 0xffe0b0, stage.reduced ? 0.2 : 0.6, 500);
        if (!stage.reduced) void shake(stage.field, stage.clock, 10 * l.ui, 400);
        void stage.clock.tween(500, (k) => fig.setFlash(0xffb070, 0.95 * (1 - k)), ease.outCubic);
      } else applyEvent(stage.units, ev, final);
      await stage.floaters.banner(l.banner.x, l.banner.y + 30 * l.ui, ev.name, "A second shape", C.enemy, 700);
      return 120;
    }
    case "defeat": {
      applyEvent(stage.units, ev, final);
      stage.refreshUnit(ev.target);
      const v = stage.enemies.get(ev.target);
      if (v) {
        v.setActive(false);
        v.figure.gesture("slump", 2);
        await stage.clock.tween(stage.reduced ? 350 : 750, (k) => v.figure.setDissolve(k, 0xffa860), ease.inOutCubic);
        v.visible = false;
        return 60;
      }
      const c = stage.cards.get(ev.target);
      const spot = numberSpot(stage, ev.target);
      if (spot) stage.floaters.label(spot.x, spot.y, "Fallen", C.hp, 13);
      c?.bust.gesture("slump", 2);
      return 450;
    }
    case "passive": {
      const spot = numberSpot(stage, ev.actor);
      if (spot) stage.floaters.label(spot.x, spot.y - 34 * l.ui, ev.name, C.gold, 10);
      return 220;
    }
    case "end": {
      for (const v of stage.enemies.values()) v.setActive(false);
      for (const c of stage.cards.values()) c.setActive(false);
      const title = ev.outcome === "victory" ? "Victory" : ev.outcome === "defeat" ? "Defeat" : "Withdrawn";
      await stage.clock.wait(250);
      await stage.floaters.endBanner(l.w, l.h, title, ev.outcome === "victory" ? C.gold : C.hp);
      return 0;
    }
  }
}

export async function playEvents(stage: BattleStage, events: BattleEvent[], final: BattleState): Promise<void> {
  for (let i = 0; i < events.length; i += 1) {
    const hold = await onEvent(stage, events[i]!, events[i + 1], final);
    if (hold > 0) await stage.clock.wait(hold);
  }
  await stage.clock.wait(120);
}
