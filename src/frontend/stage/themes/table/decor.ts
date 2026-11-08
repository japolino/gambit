/**
 * The Table battle's own additions to the stage. When the scene staged the
 * fight in its 3D room (duel.staged), the enemies stand across the real
 * table: placed through the room's camera, cut off at the table's far lip,
 * warmed by its candles, each with a folded name card on the table in front
 * of them carrying their HP, poise and statuses. The turn order goes up on
 * the room's slate; hits flare the candle and the bell rings when a turn is
 * played. Without the room (no WebGL) the painted plate comes back and the
 * enemies keep the stage's own plates.
 *
 * Keyboard: 1-9 play a card (or, choosing a target, pick the n-th target),
 * arrows walk the hand, Enter plays, Esc takes it back.
 */
import { Container, Graphics, PerspectiveMesh, Sprite, Text, TextStyle, type Texture } from "pixi.js";
import type { BattleStage } from "../../battle/stage.js";
import type { DisplayUnit } from "../../battle/display.js";
import type { StageDecor } from "../types.js";
import { STATUS_STYLE } from "../../theme.js";
import { drawStatusGlyph, vgrad } from "../../ui.js";
import { duel, duelCamera, project } from "../../../scene/themes/table/duel.js";
import { seedOf } from "../../../scene/themes/contract.js";
import { CINZEL, FELL } from "../shared.js";
import { BLOOD, CARD_H, CARD_W, PAPER_INK, backTexture, motifOf, skillTexture } from "./cards.js";
import type { TableHand } from "./hand.js";
import { duelSlots, phoneTentW, spreadTents, tentSpots, type DuelLayout } from "./layout.js";
import type { TableSlate } from "./slate.js";

type Tent = { id: string; c: Container; g: Graphics; name: Text; hp: Text; sig: string; w: number; h: number };

export function decorate(stage: BattleStage): StageDecor {
  const staged = duel.staged === "battle";
  const hand = stage.menu as TableHand;
  const slate = stage.timeline as TableSlate;
  slate.units = () => stage.units;
  if (!staged) {
    // No room behind the fight: the painted plate after all.
    stage.back.visible = true;
    stage.bgShade.visible = true;
  }
  let L = stage.layout as DuelLayout;
  const app = stage.app;

  /* The far edge of the table hides everyone's lower half. */
  const mask = new Graphics();
  const shade = new Graphics();
  shade.zIndex = 1000;
  if (staged) {
    app.stage.addChild(mask);
    stage.field.mask = mask;
    stage.field.addChild(shade);
  }

  /* The party's rack: a walnut card stand with brass pegs, behind the cards. */
  const rack = new Graphics();
  stage.hud.addChildAt(rack, 0);
  function drawRack(): void {
    rack.clear();
    if (L.tiles || !L.cards.length) return;
    const c0 = L.cards[0]!;
    const c1 = L.cards[L.cards.length - 1]!;
    const pad = Math.round(c0.h * 0.06);
    const x = c0.x - pad;
    const w = c1.x + c1.w - c0.x + pad * 2;
    const y = c0.y + c0.h * 0.58;
    const hh = L.h - y + 4;
    rack.roundRect(x + 6, y + 8, w, hh, 10).fill({ color: 0x000000, alpha: 0.4 });
    rack.roundRect(x, y, w, hh, 10).fill(vgrad(0x5a3820, 0x2a170c, 1, 1)).stroke({ width: 2, color: 0x1a0d06 });
    rack.rect(x + 4, y + 5, w - 8, 3).fill({ color: 0xc89060, alpha: 0.35 });
    for (let i = 0; i < 9; i++) rack.rect(x + 8, y + 14 + i * (hh / 9), w - 16, 1).fill({ color: 0x1a0d06, alpha: 0.25 });
    for (const c of L.cards) {
      const px = c.x + c.w / 2;
      rack.circle(px, c.y + c.h + Math.min(10, (L.h - c.y - c.h) * 0.5), 4).fill({ color: 0xb08a40 }).stroke({ width: 1, color: 0x3a2410 });
    }
  }

  /* Name cards on the table's edge. */
  const tentLayer = new Container();
  app.stage.addChildAt(tentLayer, app.stage.getChildIndex(stage.field) + 1);
  const tents = new Map<string, Tent>();
  const enemyIds = () => [...stage.enemies.keys()];

  function buildTents(): void {
    for (const t of tents.values()) t.c.destroy({ children: true });
    tents.clear();
    if (!staged) return;
    const ids = enemyIds();
    const spots = tentSpots(L.w, L.h, ids.length);
    // A phone: the name decides the card's size, and the cards stand side by side.
    const phoneW = phoneTentW(L.w, ids.length);
    const xs = L.tiles ? spreadTents(spots.map((p) => p.x), phoneW, L.w) : null;
    ids.forEach((id, i) => {
      const s = spots[i]!;
      const w = L.tiles ? phoneW : Math.min(s.k * 0.46, (L.w / Math.max(1, ids.length)) * 0.92);
      const h = L.tiles ? 72 : Math.max(50, s.k * 0.12);
      const c = new Container();
      c.position.set(xs ? xs[i]! : s.x, s.y);
      const g = new Graphics();
      const name = new Text({ text: "", style: new TextStyle({ fontFamily: CINZEL, fontWeight: "800", fontSize: L.tiles ? 13 : Math.round(h * 0.3), fill: PAPER_INK, letterSpacing: L.tiles ? 0 : 1, ...(L.tiles ? { lineHeight: 15 } : {}) }) });
      name.anchor.set(0.5, 0.5);
      const hp = new Text({ text: "", style: new TextStyle({ fontFamily: FELL, fontWeight: "700", fontSize: Math.round(h * 0.4), fill: 0xfff2e0, stroke: { color: 0x2a0406, width: 3 } }) });
      hp.anchor.set(0.5, 0.5);
      c.addChild(g, name, hp);
      c.eventMode = "static";
      c.on("pointertap", () => target(id));
      c.on("pointerover", () => stage.enemies.get(id)?.hover(true));
      c.on("pointerout", () => stage.enemies.get(id)?.hover(false));
      c.hitArea = { contains: (x: number, y: number) => Math.abs(x) <= w / 2 && y >= -h * 1.4 && y <= 4 };
      tentLayer.addChild(c);
      tents.set(id, { id, c, g, name, hp, sig: "", w, h });
    });
  }

  function drawTent(t: Tent, u: DisplayUnit | undefined, hot: boolean): void {
    if (!u) return;
    const sig = JSON.stringify([u.hp, u.maxHp, u.alive, u.poise, u.broken, u.shield, u.statuses.map((s) => s.id), hot, u.name]);
    if (sig === t.sig) return;
    t.sig = sig;
    const { g, w, h } = t;
    g.clear();
    t.c.alpha = u.alive ? 1 : 0.55;
    t.c.cursor = hot ? "pointer" : "default";
    // A folded card standing on the edge: the face leans back, so its top is a little narrower.
    const top = -h;
    const face = [-w / 2, 0, w / 2, 0, w * 0.47, top, -w * 0.47, top];
    g.ellipse(0, 2, w * 0.55, h * 0.12).fill({ color: 0x000000, alpha: 0.5 });
    if (hot) for (let i = 4; i >= 1; i--) g.poly(face.map((v, k) => v * (1 + (k % 2 ? 0.06 : 0.03) * i))).fill({ color: 0xffb040, alpha: 0.07 });
    g.poly(face).fill({ color: 0xe2d6bd }).stroke({ width: 2.5, color: PAPER_INK });
    g.poly(face.map((v, k) => (k % 2 ? v * 0.9 - 2 : v * 0.92))).stroke({ width: 2, color: BLOOD });
    // The HP ruled across the bottom; the number in a wax drop on the right.
    const frac = Math.max(0, u.hp) / Math.max(1, u.maxHp);
    const bx = L.tiles ? -w * 0.4 : -w * 0.38;
    const bw = L.tiles ? w * 0.8 : w * 0.56;
    const by = L.tiles ? -h * 0.37 : -h * 0.3;
    const bh = Math.max(4, h * 0.13);
    g.rect(bx, by, bw, bh).fill({ color: 0xd8ccb0 }).rect(bx, by, bw * frac, bh).fill({ color: frac < 0.3 ? 0xe0302a : BLOOD }).rect(bx, by, bw, bh).stroke({ width: 1.5, color: PAPER_INK });
    if (u.shield > 0) g.rect(bx, by - 3, bw * Math.min(1, u.shield / Math.max(1, u.maxHp)), 3).fill({ color: 0xbfd8e8 });
    // Poise as inked diamonds under the bar; broken, they crack red.
    const n = Math.min(10, u.maxPoise);
    const ps = Math.min(h * 0.12, (bw / Math.max(1, n)) * 0.7);
    for (let i = 0; i < n; i++) {
      const cx = bx + ps / 2 + i * ps * 1.45;
      const cy = by + bh + ps * 0.9;
      g.poly([cx, cy - ps / 2, cx + ps / 2, cy, cx, cy + ps / 2, cx - ps / 2, cy]).fill({ color: u.broken ? 0xe0302a : i < u.poise ? PAPER_INK : 0xe2d6bd }).stroke({ width: 1, color: PAPER_INK });
    }
    // A phone: the drop rides above the card's corner, clear of the name and on the screen.
    const R = L.tiles ? 22 : h * 0.36;
    const sx = L.tiles ? w * 0.5 - R * 0.75 : w * 0.33;
    const sy = L.tiles ? -h - R * 0.4 : -h * 0.42;
    g.circle(sx, sy, R).fill({ color: 0x9c1419 }).stroke({ width: 2.5, color: 0x2a0406 });
    t.hp.text = `${Math.max(0, Math.round(u.hp))}`;
    t.hp.scale.set(1);
    if (t.hp.width > R * 1.8) t.hp.scale.set((R * 1.8) / t.hp.width);
    t.hp.position.set(sx, sy + 1);
    t.name.text = u.name.toUpperCase();
    t.name.scale.set(1);
    if (L.tiles) {
      // Narrow: the name takes the card's whole width (two lines if it must), the HP drop rides the corner.
      t.name.style.wordWrap = true;
      const nameW = w * 0.92;
      t.name.style.wordWrapWidth = nameW;
      t.name.style.align = "center";
      const fit = Math.min(1, (h * 0.5) / t.name.height, nameW / t.name.width);
      t.name.scale.set(fit);
      t.name.position.set(0, -h * 0.68);
    } else {
      if (t.name.width > w * 0.62) t.name.scale.set((w * 0.62) / t.name.width);
      t.name.position.set(-w * 0.1, -h * 0.66);
    }
    // Statuses float just above the card.
    const s = Math.round(h * 0.28);
    u.statuses.slice(0, 6).forEach((st, i) => {
      const style = STATUS_STYLE[st.id];
      drawStatusGlyph(g, style.glyph, -w * 0.45 + i * (s + 3), top - s - 4, s, style.color);
    });
    if (!u.alive) g.moveTo(-w * 0.45, -h * 0.2).lineTo(w * 0.45, -h * 0.85).stroke({ width: 5, color: BLOOD, cap: "round" });
  }

  /* The aim: crimson and gold brackets round every enemy you may target, numbered for the keys. */
  const reticle = new Graphics();
  tentLayer.addChild(reticle);
  const numbers: Text[] = [];
  let clock = 0;
  function drawReticle(dt: number): void {
    clock += dt;
    reticle.clear();
    const pool = [...stage.enemies.entries(), ...stage.cards.entries()].filter(([, o]) => o.cursor === "pointer").map(([id]) => id);
    let k = 0;
    const pulse = stage.reduced ? 1 : 0.75 + 0.25 * Math.sin(clock * 5);
    pool.forEach((id, i) => {
      const v = stage.enemies.get(id);
      if (!v) return;
      const sl = v.slot;
      const top = sl.y - sl.height * 1.02;
      const bot = staged ? Math.min(L.edgeY - 4, sl.y) : sl.y;
      const hw = Math.max(40, sl.height * 0.19);
      const x0 = sl.x - hw;
      const x1 = sl.x + hw;
      const arm = Math.min(hw * 0.5, (bot - top) * 0.2);
      const grow = stage.reduced ? 0 : (1 - pulse) * 10;
      const corners: [number, number, number, number][] = [
        [x0 - grow, top - grow, 1, 1], [x1 + grow, top - grow, -1, 1], [x0 - grow, bot + grow, 1, -1], [x1 + grow, bot + grow, -1, -1],
      ];
      for (const [x, y, dx, dy] of corners) {
        reticle.moveTo(x + dx * arm, y).lineTo(x, y).lineTo(x, y + dy * arm).stroke({ width: 11, color: 0x5a0a0d, alpha: 0.9 * pulse, cap: "round", join: "round" });
        reticle.moveTo(x + dx * arm, y).lineTo(x, y).lineTo(x, y + dy * arm).stroke({ width: 5, color: 0xf2cf7a, alpha: pulse, cap: "round", join: "round" });
      }
      // The key to press, on a wax disc above the head (a phone has no keys to press).
      if (L.tiles) return;
      const nx = sl.x;
      const ny = top - 24;
      reticle.circle(nx, ny, 17).fill({ color: 0x9c1419, alpha: 0.95 }).stroke({ width: 2.5, color: 0xf2cf7a });
      let t = numbers[k];
      if (!t) {
        t = new Text({ text: "", style: new TextStyle({ fontFamily: CINZEL, fontWeight: "800", fontSize: 19, fill: 0xfff2e0 }) });
        t.anchor.set(0.5);
        tentLayer.addChild(t);
        numbers.push(t);
      }
      t.text = String(i + 1);
      t.position.set(nx, ny + 1);
      t.visible = true;
      k++;
    });
    for (let j = k; j < numbers.length; j++) numbers[j]!.visible = false;
    // The tents of the targetable breathe with the aim.
    for (const tt of tents.values()) tt.c.scale.set(pool.includes(tt.id) && !stage.reduced ? 1 + (pulse - 0.75) * 0.12 : 1);
  }

  /** Tap a target (tents, keys) as if its figure was tapped. */
  function target(id: string): void {
    const v = stage.enemies.get(id);
    const c = stage.cards.get(id);
    const o = v ?? c;
    if (o && o.cursor === "pointer") o.emit("pointertap", { stopPropagation() {} } as never);
  }

  function placeAll(): void {
    L = stage.layout as DuelLayout;
    hand.duel = L;
    hand.mat = staged && !L.tiles;
    hand.reduced = stage.reduced;
    slate.local = !staged || L.tiles;
    slate.portrait = L.tiles;
    slate.redraw(true);
    hand.place(L.menu, L.ui);
    drawRack();
    if (!staged) return;
    mask.clear().rect(-50, -50, L.w + 100, L.edgeY + 50).fill({ color: 0xffffff });
    // The lamp is over the table: the bodies behind it fall into its shadow toward the wood.
    shade.clear().rect(-20, L.edgeY - L.h * 0.16, L.w + 40, L.h * 0.16 + 2).fill(vgrad(0x050306, 0x050306, 0, 0.62));
    const ids = enemyIds();
    const slots = duelSlots(L.w, L.h, ids.map((id) => stage.units.get(id)?.rig ?? "standing"));
    ids.forEach((id, i) => stage.enemies.get(id)?.place(slots[i]!, L.ui, L.w));
    buildTents();
  }

  /* Cards laid on the mat: yours face up on your half, theirs on the far half, as each side plays. */
  const matLayer = new Container();
  app.stage.addChildAt(matLayer, app.stage.getChildIndex(stage.field) + 1);
  backTexture(5);
  type MatCard = { mesh: PerspectiveMesh; tex: Texture; near: boolean; t: number; x: number; z: number; rot: number; fade: number };
  const mat: { near: MatCard | null; far: MatCard | null } = { near: null, far: null };

  /** A card's face as laid on the mat: yours the woodcut you played, theirs the house's red back. */
  function faceTexture(name: string, enemy: boolean): { tex: Texture; own: boolean } {
    if (enemy) return { tex: backTexture(5), own: false };
    const base = skillTexture(motifOf(name), seedOf(name) % 97);
    // Your card keeps its title on the mat: render face and inked name once into a texture of its own.
    const c = new Container();
    const face = new Sprite(base);
    face.width = CARD_W;
    face.height = CARD_H;
    const t = new Text({ text: name.toUpperCase(), style: new TextStyle({ fontFamily: CINZEL, fontWeight: "800", fontSize: 21, fill: PAPER_INK, letterSpacing: 1, wordWrap: true, wordWrapWidth: CARD_W * 0.66, lineHeight: 22 }) });
    t.anchor.set(0, 0.5);
    t.position.set(CARD_W * 0.1, CARD_H * 0.135);
    if (t.height > CARD_H * 0.17) t.scale.set((CARD_H * 0.17) / t.height);
    c.addChild(face, t);
    try {
      const tex = app.renderer.generateTexture({ target: c, resolution: 2 });
      c.destroy({ children: true });
      return { tex, own: true };
    } catch {
      c.destroy({ children: true });
      return { tex: base, own: false };
    }
  }

  function layCard(near: boolean, name: string | null, enemy = !near): void {
    const key = near ? "near" : "far";
    const old = mat[key];
    if (old) old.fade = -1;
    mat[key] = null;
    if (!name || !staged || L.tiles) return;
    const { tex, own } = faceTexture(name, enemy);
    const mesh = new PerspectiveMesh({ texture: tex, verticesX: 8, verticesY: 8 });
    if (own) mesh.on("destroyed", () => tex.destroy(true));
    matLayer.addChild(mesh);
    const r = (seedOf(name) % 100) / 100;
    mat[key] = { mesh, tex, near, t: 0, x: near ? -0.2 + r * 0.12 : 0.16 + r * 0.12, z: near ? -0.5 : -0.88, rot: (r - 0.5) * 0.22 + (near ? -0.05 : 0.08), fade: 1 };
  }

  function placeCard(m: MatCard, dt: number): void {
    m.t = Math.min(1, m.t + dt / (stage.reduced ? 0.01 : 0.32));
    const k = 1 - Math.pow(1 - m.t, 3);
    const slide = (1 - k) * (m.near ? 0.35 : -0.25);
    const aspect = L.w / Math.max(1, L.h);
    const cam = duelCamera("battle", aspect);
    const hw = 0.12;
    const hh = 0.17;
    const c = Math.cos(m.rot);
    const s = Math.sin(m.rot);
    const pts = ([[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]] as const).map(([x, z]) => {
      const p = project(cam, aspect, [m.x + x * c - z * s, 0.012, m.z + slide + x * s + z * c]);
      return [p.x * L.w, p.y * L.h] as const;
    });
    m.mesh.setCorners(pts[0]![0], pts[0]![1], pts[1]![0], pts[1]![1], pts[2]![0], pts[2]![1], pts[3]![0], pts[3]![1]);
    m.mesh.alpha = m.fade < 0 ? m.mesh.alpha : Math.min(1, k * 1.4);
  }
  hand.onPlayed = (skill) => layCard(true, skill?.name ?? null);

  /* Keyboard. */
  let focus = -1;
  const onKey = (e: KeyboardEvent): void => {
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const mode = hand.modeKind;
    const digit = /^[1-9]$/.test(e.key) ? Number(e.key) - 1 : -1;
    if (mode === "skills") {
      const skills = hand.skills ?? [];
      if (digit >= 0 && skills[digit]) {
        focus = digit;
        hand.focusIndex = focus;
        if (skills[digit]!.usable) hand.onPick(skills[digit]!.id);
        else hand.point(digit);
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        focus = (Math.max(0, focus) + (e.key === "ArrowRight" ? 1 : skills.length - 1)) % Math.max(1, skills.length);
        if (focus < 0 || focus >= skills.length) focus = 0;
        hand.focusIndex = focus;
        hand.point(focus);
      } else if ((e.key === "Enter" || e.key === " ") && skills[focus]?.usable) hand.onPick(skills[focus]!.id);
      else return;
    } else if (mode === "target") {
      const pool = [...stage.enemies.entries(), ...stage.cards.entries()].filter(([, o]) => o.cursor === "pointer").map(([id]) => id);
      if (digit >= 0 && pool[digit]) target(pool[digit]!);
      else if (e.key === "Enter" && hand.confirmable) hand.onConfirm();
      else if (e.key === "Escape" || e.key === "Backspace") hand.onBack();
      else return;
    } else return;
    e.preventDefault();
  };
  window.addEventListener("keydown", onKey);

  placeAll();

  return {
    resize() {
      placeAll();
    },
    update(_now, dt) {
      hand.reduced = stage.reduced;
      hand.tick(dt);
      slate.redraw();
      drawReticle(dt);
      if (!staged) return;
      // Candle-warm figures (place() greys the far ones; this keeps them in the room's light).
      for (const v of stage.enemies.values()) {
        const k = Math.round(255 * (1 - v.slot.depth * 0.3));
        v.figure.mesh.tint = (k << 16) | (Math.round(k * 0.86) << 8) | Math.round(k * 0.72);
      }
      for (const m of [mat.near, mat.far]) if (m) placeCard(m, dt);
      for (const ch of [...matLayer.children]) {
        const own = mat.near?.mesh === ch || mat.far?.mesh === ch;
        if (own) continue;
        ch.alpha -= dt * 3;
        if (ch.alpha <= 0) {
          ch.destroy();
        }
      }
      for (const t of tents.values()) {
        const v = stage.enemies.get(t.id);
        drawTent(t, stage.units.get(t.id), v?.cursor === "pointer");
      }
    },
    event(ev) {
      if (!staged) return;
      if (ev.kind === "use") layCard(!stage.enemies.has(ev.actor), ev.name);
      if (ev.kind === "turn" && stage.cards.has(ev.actor)) {
        layCard(true, null);
        layCard(false, null);
      }
      if (ev.kind === "hit" && ev.amount > 0) duel.flare++;
      if (ev.kind === "turn" && stage.cards.has(ev.actor)) duel.ring++;
      if (ev.kind === "end") duel.ring++;
    },
    destroy() {
      window.removeEventListener("keydown", onKey);
      if (staged) {
        stage.field.mask = null;
        mask.destroy();
      }
      if (duel.slate === slate.tall) duel.slate = null;
      rack.destroy();
      tentLayer.destroy({ children: true });
      matLayer.destroy({ children: true });
    },
  };
}
