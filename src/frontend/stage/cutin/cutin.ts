/**
 * The diagonal-band cut-in (docs/DESIGN.md, 5.4): the field dims, a slanted
 * band in the skill's palette sweeps across, the actor's portrait slides
 * through it, the skill name slams in, and the skill's FX layers play
 * around it. Data-driven from SkillVisual (palette, fx). About 1.5 s; a
 * tap or click skips it. Other templates fall back to this one for now.
 * With an action splash (the fighter's signature move drawn from their own
 * image) the whole figure bursts out of the band instead of a cropped face.
 */
import { Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import type { SkillVisual } from "../../../engine/types.js";
import { ease, type Clock } from "../anim.js";
import { C, FONT_DISPLAY, FONT_UI, mixColor, parsePalette, textStyle } from "../theme.js";
import { vgrad } from "../ui.js";
import { buildFx, resolveFx, type FxContext } from "./fx.js";
import { playFramed } from "./framed.js";
import { playPanel } from "./panel.js";

export { FRAMED_SECONDS } from "./framed.js";

export type CutInOptions = {
  layer: Container;
  clock: Clock;
  w: number;
  h: number;
  ui: number;
  portrait: Texture;
  /** Face centre in the portrait texture (0..1). */
  face?: { x: number; y: number };
  /** The portrait is a whole action splash: shown entire, bursting out of the band. */
  splash?: boolean;
  /** The portrait is an opaque, painted action splash: shown in the panel cut-in (panel.ts), or full screen (framed.ts) for an ultimate. */
  framed?: boolean;
  /** An ultimate (a tier-5 signature, or the "shatter" template; card kits stop at tier 4 today): the full-screen cut-in. */
  ultimate?: boolean;
  visual: SkillVisual | undefined;
  skillName: string;
  actorName: string;
  /** The actor is an enemy (the band comes from the other side). */
  enemy?: boolean;
};

export const CUTIN_SECONDS = 1.5;

export async function playCutIn(o: CutInOptions): Promise<void> {
  if (o.framed) return o.ultimate ? playFramed(o) : playPanel({ ...o, face: { x: 0.5, y: 0.36 } });
  const { w, h, ui, clock } = o;
  // A skill's own palette, else the look's ink and gold (5.2a).
  const palette = parsePalette(o.visual?.palette, [C.ink, C.gold, 0xf3ede2]);
  const dark = palette[0]!;
  const mid = palette[1] ?? mixColor(dark, 0xffffff, 0.4);
  const light = palette[2] ?? 0xf3ede2;
  const dir = o.enemy ? -1 : 1;
  const angle = dir * -0.2;
  const thick = Math.min(h * 0.36, Math.max(h * 0.24, w * 0.5));
  const len = Math.hypot(w, h) * 1.3;
  const total = CUTIN_SECONDS;
  const slam = 0.42;

  const root = new Container();
  root.eventMode = "static";
  root.cursor = "pointer";
  root.hitArea = { contains: () => true };
  const dim = new Graphics().rect(0, 0, w, h).fill({ color: 0x000000 });
  const band = new Container();
  band.position.set(w / 2, h * 0.46);
  band.rotation = angle;
  const bg = new Graphics();
  bg.rect(-len / 2, -thick / 2, len, thick).fill(vgrad(mixColor(dark, mid, 0.35), dark, 0.97, 0.97));
  bg.rect(-len / 2, -thick / 2 - 3 * ui, len, 2 * ui).fill({ color: light, alpha: 0.85 });
  bg.rect(-len / 2, thick / 2 + 1 * ui, len, 2 * ui).fill({ color: light, alpha: 0.85 });
  bg.rect(-len / 2, -thick / 2 - 9 * ui, len, 1).fill({ color: mid, alpha: 0.6 });
  bg.rect(-len / 2, thick / 2 + 8 * ui, len, 1).fill({ color: mid, alpha: 0.6 });
  const under = new Container();
  const masked = new Container();
  const mask = new Graphics().rect(-len / 2, -thick / 2, len, thick).fill({ color: 0xffffff });
  masked.mask = mask;
  const holder = new Container();
  holder.rotation = -angle;
  const sprite = new Sprite(o.portrait);
  const face = o.face ?? { x: 0.5, y: 0.38 };
  // A splash fits whole, taller than the band (it breaks out above and below); a face crop fills the band.
  const k = o.splash
    ? Math.min((thick * 1.9) / o.portrait.height, (w * 0.62) / o.portrait.width)
    : (thick * 1.55) / o.portrait.height;
  sprite.scale.set(k);
  sprite.anchor.set(face.x, face.y);
  holder.addChild(sprite);
  const over = new Container();
  masked.addChild(over);
  if (o.splash) band.addChild(bg, under, masked, mask, holder);
  else {
    masked.addChildAt(holder, 0);
    band.addChild(bg, under, masked, mask);
  }
  const top = new Container();

  const nameStyle = textStyle(`cutin-name-${Math.round(ui * 10)}-${light}`, {
    fontFamily: FONT_DISPLAY, fontSize: Math.round(Math.min(46, w / 11) * ui), fontWeight: "700", fill: light, letterSpacing: 2 * ui,
    stroke: { color: dark, width: 5 * ui, join: "round" },
    dropShadow: { color: 0x000000, alpha: 0.75, blur: 10, distance: 0 },
  });
  const name = new Text({ text: o.skillName, style: nameStyle });
  name.anchor.set(dir > 0 ? 1 : 0, 0.5);
  const actor = new Text({ text: o.actorName.toUpperCase(), style: textStyle(`cutin-actor-${Math.round(ui * 10)}`, { fontFamily: FONT_UI, fontSize: Math.round(10 * ui), fontWeight: "700", fill: C.onArtDim, letterSpacing: 3 * ui }) });
  actor.anchor.set(dir > 0 ? 1 : 0, 1);
  const nameX = dir > 0 ? w - 18 * ui : 18 * ui;
  const nameY = h * 0.46 + thick * 0.5 + 34 * ui;
  name.position.set(nameX, nameY);
  actor.position.set(nameX, nameY - name.height / 2 - 2 * ui);
  name.alpha = 0;
  actor.alpha = 0;
  root.addChild(dim, band, top, actor, name);
  o.layer.addChild(root);

  const fxCtx: FxContext = {
    w, h, ui, band: { cx: w / 2, cy: h * 0.46, angle, len, thick }, palette: [dark, mid, light], slam, total,
    face: { x: w / 2, y: h * 0.46 }, portrait: { texture: o.portrait, sprite }, under, over, top,
  };
  const layers = buildFx(resolveFx(o.visual?.fx), fxCtx);

  let skipped = false;
  root.on("pointertap", () => { skipped = true; });
  const start = clock.now;
  await new Promise<void>((resolve) => {
    const stop = clock.onFrame((now) => {
      const t = now - start;
      if (skipped && t < total - 0.2) {
        stop();
        resolve();
        return;
      }
      const inK = ease.outCubic(Math.min(1, t / 0.18));
      const outK = ease.inCubic(Math.max(0, Math.min(1, (t - (total - 0.25)) / 0.25)));
      dim.alpha = 0.62 * inK * (1 - outK);
      band.x = w / 2 - dir * (1 - inK) * w * 1.2 + dir * outK * w * 1.3;
      // Portrait: in fast, then a slow drift across the band.
      const drift = ease.outQuint(Math.min(1, t / 0.4));
      holder.x = dir * (len * 0.16 * (1 - drift) - w * 0.04 * (t / total)) - dir * w * 0.12;
      sprite.alpha = Math.min(1, t / 0.12);
      // A splash punches in a little large and settles.
      if (o.splash) sprite.scale.set(k * (1 + 0.14 * (1 - ease.outCubic(Math.min(1, t / 0.3)))));
      // Name slam.
      const s = t - slam;
      if (s >= 0) {
        const sk = Math.min(1, s / 0.12);
        name.alpha = sk * (1 - outK);
        actor.alpha = Math.min(1, s / 0.25) * (1 - outK);
        name.scale.set(2.3 - 1.3 * ease.outExpo(sk));
        root.x = s < 0.15 ? (Math.random() - 0.5) * 8 * ui * (1 - s / 0.15) : 0;
      }
      const g = sprite.getGlobalPosition();
      fxCtx.face.x = g.x;
      fxCtx.face.y = g.y;
      for (const l of layers) l.update(t);
      if (t >= total) {
        stop();
        resolve();
      }
    });
  });
  if (skipped) await clock.tween(140, (k) => { root.alpha = 1 - k; });
  root.destroy({ children: true });
}
