/**
 * The panel cut-in (docs/DESIGN.md, 5.4) for a painted action splash on a regular signature move: the field
 * drops to dark, a slanted panel snaps open from a line and the picture fills it, pushing in slowly toward the
 * action; speed lines stream behind, the skill name slams across the panel's lower edge, and the panel shuts
 * back to a line. About 1.9 s; a tap or click skips it. The full-screen version (framed.ts) is for ultimates.
 */
import { Container, Graphics, Sprite, Text } from "pixi.js";
import { ease } from "../anim.js";
import { C, FONT_DISPLAY, FONT_UI, mixColor, parsePalette, textStyle } from "../theme.js";
import { buildFx, resolveFx, type FxContext } from "./fx.js";
import type { CutInOptions } from "./cutin.js";

export const PANEL_SECONDS = 1.9;

export async function playPanel(o: CutInOptions): Promise<void> {
  const { w, h, ui, clock } = o;
  const palette = parsePalette(o.visual?.palette, [C.ink, C.gold, 0xf3ede2]);
  const dark = palette[0]!;
  const mid = palette[1] ?? mixColor(dark, 0xffffff, 0.4);
  const light = palette[2] ?? 0xf3ede2;
  const dir = o.enemy ? -1 : 1;
  const total = PANEL_SECONDS;
  const slam = 0.34;
  const ph = Math.round(Math.min(h * 0.74, w * 0.42));
  const pw = Math.round(Math.min(w * 0.9, ph * 1.9));
  const skew = ph * 0.16 * dir;
  const cx = w / 2;
  const cy = h * 0.45;
  const shape = (g: Graphics, grow = 0): Graphics =>
    g.poly([-pw / 2 + skew - grow, -ph / 2 - grow, pw / 2 + skew + grow, -ph / 2 - grow, pw / 2 - skew + grow, ph / 2 + grow, -pw / 2 - skew - grow, ph / 2 + grow]);

  const root = new Container();
  root.eventMode = "static";
  root.cursor = "pointer";
  root.hitArea = { contains: () => true };
  const dim = new Graphics().rect(0, 0, w, h).fill({ color: mixColor(dark, 0x000000, 0.6) });
  const flash = new Graphics().rect(0, 0, w, h).fill({ color: 0xffffff });
  flash.alpha = 0;

  // Speed lines across the whole screen, behind the panel.
  const streaks = new Graphics();
  const lines = Array.from({ length: 46 }, (_, i) => {
    const r = Math.sin(i * 91.7) * 0.5 + 0.5;
    const q = Math.sin(i * 37.3 + 1) * 0.5 + 0.5;
    return { y: (i / 46) * h * 1.2 - h * 0.1, len: w * (0.18 + 0.4 * r), speed: 1.4 + 2.4 * q, phase: r, thick: (0.8 + 2.6 * q) * ui, light: q > 0.72 };
  });

  const panel = new Container();
  panel.position.set(cx, cy);
  const backing = shape(new Graphics(), 7 * ui).fill({ color: mid });
  backing.position.set(-dir * 12 * ui, 10 * ui);
  const border = shape(new Graphics(), 3 * ui).fill({ color: light });
  const mask = shape(new Graphics()).fill({ color: 0xffffff });
  const pic = new Container();
  pic.mask = mask;
  const fill = shape(new Graphics()).fill({ color: dark });
  const sprite = new Sprite(o.portrait);
  const face = o.face ?? { x: 0.5, y: 0.36 };
  sprite.anchor.set(0.5, face.y);
  // Cover the panel (with room for the push-in and the drift).
  const k = Math.max((pw + Math.abs(skew) * 2 + 40 * ui) / o.portrait.width, (ph + 24 * ui) / o.portrait.height) * 1.04;
  // The action centre as near the panel's middle as the picture allows while still covering it.
  const H = o.portrait.height * k;
  sprite.y = Math.min(H * face.y - ph / 2 - 12 * ui, Math.max(ph / 2 + 12 * ui - H * (1 - face.y), 0));
  const shine = new Graphics();
  pic.addChild(fill, sprite, shine);
  const under = new Container();
  const over = new Container();
  pic.addChildAt(under, 1);
  pic.addChild(over);
  panel.addChild(backing, border, pic, mask);

  const nameStyle = textStyle(`cutin-fname-${Math.round(ui * 10)}-${light}-${dark}`, {
    fontFamily: FONT_DISPLAY, fontSize: Math.round(Math.min(58, Math.max(30, w / 22)) * ui), fontWeight: "700", fill: light, letterSpacing: 2 * ui,
    stroke: { color: dark, width: 6 * ui, join: "round" },
    dropShadow: { color: 0x000000, alpha: 0.8, blur: 12, distance: 0 },
  });
  const name = new Text({ text: o.skillName, style: nameStyle });
  name.anchor.set(dir > 0 ? 1 : 0, 0.5);
  const actor = new Text({ text: o.actorName.toUpperCase(), style: textStyle(`cutin-factor-${Math.round(ui * 10)}-${light}`, { fontFamily: FONT_UI, fontSize: Math.round(12 * ui), fontWeight: "700", fill: light, letterSpacing: 4 * ui, stroke: { color: dark, width: 4 * ui, join: "round" } }) });
  actor.anchor.set(dir > 0 ? 1 : 0, 1);
  const plate = new Graphics();
  const nameX = dir > 0 ? Math.min(w - 16 * ui, cx + pw / 2 - skew + 10 * ui) : Math.max(16 * ui, cx - pw / 2 + skew - 10 * ui);
  const nameY = Math.min(h - name.height / 2 - 6 * ui, cy + ph / 2 + 4 * ui);
  name.position.set(nameX, nameY);
  actor.position.set(nameX - dir * 4 * ui, nameY - name.height / 2 + 2 * ui);
  const pad = 18 * ui;
  const pwid = name.width + pad * 2;
  const px = dir > 0 ? nameX - name.width - pad : nameX - pad;
  plate.poly([px + 14 * ui, nameY - name.height * 0.42, px + pwid + 14 * ui, nameY - name.height * 0.42, px + pwid - 14 * ui, nameY + name.height * 0.42, px - 14 * ui, nameY + name.height * 0.42]).fill({ color: dark, alpha: 0.92 });
  plate.rect(px - 14 * ui, nameY + name.height * 0.42, pwid, 2 * ui).fill({ color: mid });
  for (const t of [name, actor, plate]) t.alpha = 0;
  const top = new Container();
  root.addChild(dim, streaks, panel, top, plate, actor, name, flash);
  o.layer.addChild(root);

  const fxCtx: FxContext = {
    w, h, ui, band: { cx, cy, angle: 0, len: pw, thick: ph }, palette: [dark, mid, light], slam, total,
    face: { x: cx, y: cy }, portrait: { texture: o.portrait, sprite }, under, over, top,
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
      const inK = ease.outCubic(Math.min(1, t / 0.14));
      const outK = ease.inCubic(Math.max(0, Math.min(1, (t - (total - 0.22)) / 0.22)));
      dim.alpha = 0.8 * inK * (1 - outK);
      // The panel snaps open from a line, then shuts back to one.
      const open = ease.outExpo(Math.min(1, Math.max(0, (t - 0.04) / 0.2)));
      panel.scale.set(1 + 0.03 * (1 - open), Math.max(0.004, open * (1 - outK)));
      panel.x = cx - dir * (1 - open) * w * 0.08;
      // The picture: in from the side, then a slow push toward the action.
      const settle = ease.outQuint(Math.min(1, t / 0.5));
      sprite.scale.set(k * (1.1 - 0.1 * settle + 0.05 * (t / total)));
      sprite.x = -dir * ((1 - settle) * pw * 0.12 + (t / total) * pw * 0.025);
      // A white flash as it opens, and a glint sweeping over the picture.
      flash.alpha = 0.55 * Math.max(0, 1 - t / 0.16);
      const g = (t - 0.15) / 0.45;
      shine.clear();
      if (g > 0 && g < 1) {
        const sx = -pw * 0.8 + g * pw * 1.6;
        shine.poly([sx, -ph, sx + 60 * ui, -ph, sx - 60 * ui + ph * 0.4, ph, sx - 120 * ui + ph * 0.4, ph]).fill({ color: 0xffffff, alpha: 0.16 * Math.sin(g * Math.PI) });
      }
      // Speed lines.
      streaks.clear();
      for (const l of lines) {
        const p = (l.phase + t * l.speed) % 1;
        const x = dir > 0 ? w * 1.2 - p * (w * 1.6) : -w * 0.2 + p * (w * 1.6);
        streaks.rect(x, l.y, l.len, l.thick).fill({ color: l.light ? light : mid, alpha: (l.light ? 0.5 : 0.28) * inK * (1 - outK) });
      }
      streaks.skew.set(0, -0.08 * dir);
      // Name slam.
      const s = t - slam;
      if (s >= 0) {
        const sk = Math.min(1, s / 0.12);
        name.alpha = sk * (1 - outK);
        plate.alpha = Math.min(1, s / 0.08) * (1 - outK);
        actor.alpha = Math.min(1, Math.max(0, s - 0.06) / 0.2) * (1 - outK);
        name.scale.set(2.1 - 1.1 * ease.outExpo(sk));
        root.x = s < 0.15 ? (Math.random() - 0.5) * 9 * ui * (1 - s / 0.15) : 0;
        root.y = s < 0.15 ? (Math.random() - 0.5) * 5 * ui * (1 - s / 0.15) : 0;
      }
      const gp = sprite.getGlobalPosition();
      fxCtx.face.x = gp.x;
      fxCtx.face.y = gp.y;
      for (const l of layers) l.update(t);
      if (t >= total) {
        stop();
        resolve();
      }
    });
  });
  if (skipped) await clock.tween(140, (k2) => { root.alpha = 1 - k2; });
  root.destroy({ children: true });
}
