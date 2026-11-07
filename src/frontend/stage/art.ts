/**
 * Art for each combatant, by art key (Combatant.art): a generated image
 * once the host has sent one (setArt), else a placeholder painted from the
 * art seed and the class or monster palette. Enemies get a full figure for
 * the puppet; party members get a bust (cards, cut-ins). Timeline chips and
 * cut-ins crop the face from either. A key can be set before its combatant
 * appears (a phase-2 form); it is used when it does. Opaque images
 * (cutout: false) are shown framed rather than warped.
 */
import { cutinArtKey, isCutinArtKey } from "../../shared/art-keys.js";
import { Rectangle, Texture } from "pixi.js";
import { CLASSES, MONSTERS } from "../../engine/content/index.js";
import type { RigKind } from "../../engine/types.js";
import { paintBattlefield, paintBust, paintFigure } from "./placeholder.js";
import { keyedSourceFromUrl, sourceFromCanvas, sourceFromUrl, type FigureSource } from "./puppet/source.js";
import { buildFigureRig } from "./puppet/rig-build.js";
import { parsePalette } from "./theme.js";

/** Palette of a class or monster id; a hash-picked muted palette for unknown ids (generated content). */
export function paletteFor(defId: string, art: string): number[] {
  const known = CLASSES[defId]?.visual.palette ?? MONSTERS[defId]?.visual.palette ?? MONSTERS[defId.replace(/_unrung$/, "")]?.visual.palette;
  if (known) return parsePalette(known);
  for (const m of Object.values(MONSTERS)) if (m.phase2?.into.id === defId) return parsePalette(m.phase2.into.visual.palette);
  let h = 0;
  for (const ch of art) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hues = [[0x1d2328, 0x8fa3ad, 0xd9d4c7], [0x241a1c, 0xa8533b, 0xe6d9cf], [0x13262f, 0x6fb3a9, 0xe8efe9], [0x1e1a12, 0xb89252, 0xf0e4c8]];
  return hues[h % hues.length]!;
}

export type ArtRequest = { id: string; defId: string; art: string; rig: RigKind; side: "party" | "enemy" };

/** What to draw for a combatant: the source and whether it is a transparent cut-out. */
export type ArtPick = { source: FigureSource; cutout: boolean; custom: boolean };

/** `asked` is the cutout flag the host sent; `cutout` turns true when the stage keyed the background itself. */
type Custom = { url: string; asked: boolean; cutout: boolean; source: FigureSource | null; promise: Promise<FigureSource | null> };

/** A square-ish crop around the face of a source (chips), or a taller one led by the face (cut-ins). */
function faceCrop(pick: ArtPick, kind: RigKind, tall: boolean): { texture: Texture; face: { x: number; y: number } } {
  const f = pick.source;
  if (!pick.cutout) {
    // An opaque picture: the upper middle, where a portrait's face usually is.
    const side = Math.min(f.width, f.height) * (tall ? 1 : 0.6);
    const x = (f.width - side) / 2;
    const y = tall ? 0 : Math.max(0, f.height * 0.12);
    const h = tall ? Math.min(f.height, side * 1.2) : side;
    return { texture: new Texture({ source: f.texture.source, frame: new Rectangle(x, y, side, h) }), face: { x: 0.5, y: tall ? 0.35 : 0.5 } };
  }
  const rig = buildFigureRig(kind, f.bbox, f.width, f.height);
  const cx = rig.face.x * f.width;
  const cy = rig.face.y * f.height;
  if (tall) {
    const top = Math.max(0, (rig.bbox[1] - 0.02) * f.height);
    const height = Math.min(f.height - top, Math.max(rig.face.h * f.height * 6, f.height * 0.55));
    return { texture: new Texture({ source: f.texture.source, frame: new Rectangle(0, top, f.width, height) }), face: { x: rig.face.x, y: (cy - top) / height } };
  }
  const side = Math.min(f.width, f.height, Math.max(rig.face.w * f.width * 2.6, rig.face.h * f.height * 2.6, f.width * 0.3));
  const x = Math.max(0, Math.min(f.width - side, cx - side / 2));
  const y = Math.max(0, Math.min(f.height - side, cy - side * 0.45));
  return { texture: new Texture({ source: f.texture.source, frame: new Rectangle(x, y, side, side) }), face: { x: 0.5, y: 0.45 } };
}

export class ArtStore {
  private figures = new Map<string, FigureSource>();
  private busts = new Map<string, FigureSource>();
  private crops = new Map<string, { texture: Texture; face: { x: number; y: number } }>();
  private custom = new Map<string, Custom>();

  /**
   * Set the generated image for an art key. Resolves with the loaded source
   * (null when it fails); the same URL again is a no-op.
   */
  setArt(key: string, url: string, cutout = true): Promise<FigureSource | null> {
    const prev = this.custom.get(key);
    if (prev && prev.url === url && prev.asked === cutout) return prev.promise;
    const entry: Custom = { url, asked: cutout, cutout, source: null, promise: Promise.resolve(null) };
    // An opaque cut-in face (V5 inset on white) is keyed so it stands in the band.
    const load = !cutout && isCutinArtKey(key)
      ? keyedSourceFromUrl(url).then((keyed) => {
          if (keyed) entry.cutout = true;
          return keyed ?? sourceFromUrl(url);
        })
      : sourceFromUrl(url);
    entry.promise = load.then((src) => {
      if (this.custom.get(key) === entry) entry.source = src;
      return src;
    }).catch(() => null);
    this.custom.set(key, entry);
    return entry.promise;
  }

  /** Whether a loaded custom image exists for a key. */
  hasCustom(key: string): boolean {
    return !!this.custom.get(key)?.source;
  }

  /** The placeholder figure (sync), keyed by art + rig. */
  figure(req: ArtRequest): FigureSource {
    const key = `${req.art}|${req.rig}`;
    let src = this.figures.get(key);
    if (!src) {
      src = sourceFromCanvas(paintFigure(req.art, req.rig, paletteFor(req.defId, req.art)));
      this.figures.set(key, src);
    }
    return src;
  }

  /** The placeholder bust (party cards and cut-ins), with its alpha bbox for the puppet. */
  bustSource(req: ArtRequest): FigureSource {
    let src = this.busts.get(req.art);
    if (!src) {
      src = sourceFromCanvas(paintBust(req.art, paletteFor(req.defId, req.art)));
      this.busts.set(req.art, src);
    }
    return src;
  }

  /** What to draw for an enemy figure or a party portrait now: custom art once loaded, else the placeholder. */
  pick(req: ArtRequest): ArtPick {
    const c = this.custom.get(req.art);
    if (c?.source) return { source: c.source, cutout: c.cutout, custom: true };
    return { source: req.side === "party" ? this.bustSource(req) : this.figure(req), cutout: true, custom: false };
  }

  private crop(req: ArtRequest, tall: boolean): { texture: Texture; face: { x: number; y: number } } {
    const p = this.pick(req);
    const key = `${req.art}|${req.side}|${tall ? "t" : "s"}|${p.custom ? this.custom.get(req.art)!.url : "ph"}`;
    let out = this.crops.get(key);
    if (!out) {
      out = req.side === "party" && !p.custom
        ? tall
          ? { texture: p.source.texture, face: { x: 0.5, y: 0.4 } }
          : { texture: new Texture({ source: p.source.texture.source, frame: new Rectangle(p.source.width * 0.22, p.source.height * 0.12, p.source.width * 0.56, p.source.width * 0.56) }), face: { x: 0.5, y: 0.5 } }
        : faceCrop(p, req.side === "party" ? "standing" : req.rig, tall);
      this.crops.set(key, out);
    }
    return out;
  }

  /** The cut-in portrait and where its face is (0..1). */
  cutin(req: ArtRequest): { texture: Texture; face: { x: number; y: number } } {
    // A party member's determined expression, once drawn, outranks the portrait.
    const fierce = cutinArtKey(req.art);
    if (req.side === "party" && this.hasCustom(fierce)) return this.crop({ ...req, art: fierce }, true);
    return this.crop(req, true);
  }

  /** A square face crop for timeline chips. */
  chip(req: ArtRequest): Texture {
    return this.crop(req, false).texture;
  }

  /** The battlefield plate and its depth map (same size, aligned). */
  background(seed: string, colors: number[]): { color: Texture; depth: Texture } {
    const { color, depth } = paintBattlefield(seed, colors);
    return { color: Texture.from(color), depth: Texture.from(depth) };
  }

  destroy(): void {
    for (const f of this.figures.values()) f.texture.destroy(true);
    for (const b of this.busts.values()) b.texture.destroy(true);
    for (const c of this.custom.values()) c.source?.texture.destroy(true);
    this.figures.clear();
    this.busts.clear();
    this.crops.clear();
    this.custom.clear();
  }
}
