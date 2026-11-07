/**
 * A battle figure drawn as Cue's PNG puppet in Pixi: one Mesh whose vertex
 * positions come from puppetMeshPositions (via figureMeshPositions, which
 * adds Gambit's rig variants), animated every frame from Cue's pose,
 * acting (moods, gestures), physics (springs) and transitions (shifts).
 *
 * Combat maps onto the acting (docs/DESIGN.md, 5.6): attack = lean_in plus
 * a lunge the stage tweens on the container; hit = flinch + jolt and a
 * spring kick from the attacker's side scaled by damage; broken = a slumped,
 * trembling mood; boss phase = the flare shift; death = the dissolve shader.
 *
 * The container's origin is the figure's anchor (bbox bottom-centre), so
 * the stage places it on the floor line and scales it to a height.
 *
 * An opaque image (no alpha cut-out, e.g. a render on white) is `framed`:
 * the whole rectangle would warp like rubber, so it is shown still, as a
 * card with a hairline frame and a soft vignette. The container-level
 * motion (lunge, knock-back) and the shader (flash, dissolve) still apply.
 */
import { Container, Graphics, Mesh, MeshGeometry, type Texture } from "pixi.js";
import type { RigKind } from "../../../engine/types.js";
import type { SpriteFaceBox } from "../../../vendor/cue-puppet/shims.js";
import {
  PUPPET_GESTURE_S,
  PUPPET_NEUTRAL_MOOD,
  easeMood,
  type PuppetGestureKind,
  type PuppetMood,
} from "../../../vendor/cue-puppet/sprite-puppet-acting.js";
import { PUPPET_SHIFT, type PuppetShiftKind } from "../../../vendor/cue-puppet/sprite-puppet-fx.js";
import {
  PUPPET_BODY_SPRING,
  PUPPET_HAIR_SPRING,
  puppetSpring,
  springKick,
  springStep,
} from "../../../vendor/cue-puppet/sprite-puppet-physics.js";
import { puppetGrid, puppetPhase, puppetPose, type PuppetGrid } from "../../../vendor/cue-puppet/sprite-puppet-rig.js";
import { FigureFilter } from "./figure-filter.js";
import { buildFigureRig, type FigureRig } from "./rig-build.js";
import type { FigureSource } from "./source.js";
import { VARIANT_BREATH_RATE, figureMeshPositions } from "./variants.js";

/** Battle moods on top of Cue's expression moods. */
export const BATTLE_MOODS = {
  neutral: { ...PUPPET_NEUTRAL_MOOD },
  /** Waiting to act: a little drawn up, quicker breath. */
  ready: { ...PUPPET_NEUTRAL_MOOD, breathRate: 1.2, posture: 0.2, shoulders: 0.1, energy: 1.2 },
  /** Broken: slumped, head down, trembling, ragged breath. */
  broken: { ...PUPPET_NEUTRAL_MOOD, breathRate: 1.5, breathDepth: 1.3, swayAmp: 0.5, posture: -1, shoulders: 0.3, pitch: 0.8, tremble: 0.9, energy: 0.6 },
  /** Badly hurt. */
  wounded: { ...PUPPET_NEUTRAL_MOOD, breathRate: 1.3, breathDepth: 1.2, posture: -0.4, pitch: 0.3, tremble: 0.25, energy: 0.8 },
  /** Charging a big move: deep, fast breath, drawn up. */
  charging: { ...PUPPET_NEUTRAL_MOOD, breathRate: 1.7, breathDepth: 1.6, posture: 0.6, shoulders: 0.5, tremble: 0.3, energy: 1.4 },
} satisfies Record<string, PuppetMood>;
export type BattleMood = keyof typeof BATTLE_MOODS;

type Gesture = { kind: PuppetGestureKind; start: number; gain: number; side: number };

const GRID: Record<"full" | "lite", PuppetGrid> = { full: puppetGrid(24, 36), lite: puppetGrid(16, 24) };

export type PuppetFigureOptions = {
  source: FigureSource;
  kind: RigKind;
  /** Stable key (combatant id) for the motion phase. */
  key: string;
  /** Motion strength (1 = Cue's amplitudes); 0 = still (reduced motion). */
  strength?: number;
  face?: SpriteFaceBox | null;
  /** Fewer vertices (party busts, small figures). */
  lite?: boolean;
  /** An opaque image: no warp, drawn as a framed card. */
  framed?: boolean;
};

export class PuppetFigure extends Container {
  readonly mesh: Mesh<MeshGeometry>;
  readonly figure: FigureRig;
  readonly kind: RigKind;
  readonly framed: boolean;
  /** Pixel size of the texture. */
  readonly imageW: number;
  readonly imageH: number;
  strength: number;
  private grid: PuppetGrid;
  private positions: Float32Array<ArrayBuffer>;
  private phase: number;
  private mood: PuppetMood = { ...PUPPET_NEUTRAL_MOOD };
  private targetMood: PuppetMood = { ...PUPPET_NEUTRAL_MOOD };
  private gestures: Gesture[] = [];
  private shift: { kind: PuppetShiftKind; start: number; gain: number } | null = null;
  private body = puppetSpring();
  private hair = puppetSpring();
  private breathClock = 0;
  private swayClock = 0;
  private gaze = 0;
  private gazeTarget = 0;
  private now = 0;
  private fx: FigureFilter | null = null;

  constructor(opts: PuppetFigureOptions) {
    super();
    this.kind = opts.kind;
    this.framed = !!opts.framed;
    this.strength = opts.strength ?? 1;
    this.imageW = opts.source.width;
    this.imageH = opts.source.height;
    this.phase = puppetPhase(opts.key);
    this.figure = buildFigureRig(this.framed ? "standing" : opts.kind, this.framed ? [0, 0, 1, 1] : opts.source.bbox, this.imageW, this.imageH, opts.face);
    this.grid = GRID[opts.lite ? "lite" : "full"];
    this.positions = new Float32Array(this.grid.uv.length);
    this.writePositions();
    const geometry = new MeshGeometry({
      positions: this.positions,
      uvs: this.grid.uv,
      indices: new Uint32Array(this.grid.indices),
    });
    this.mesh = new Mesh({ geometry, texture: opts.source.texture });
    const r = this.figure.rig;
    this.mesh.position.set(-r.cx * this.imageW, -r.by * this.imageH);
    this.addChild(this.mesh);
    if (this.framed) this.addFrame();
  }

  /** Card frame for an opaque image: chamfer mask, a soft vignette, a double hairline. */
  private addFrame(): void {
    const W = this.imageW;
    const H = this.imageH;
    const x = -W / 2;
    const y = -H;
    const c = Math.min(W, H) * 0.04;
    const pts = (i: number) => [x + c + i, y + i, x + W - c - i, y + i, x + W - i, y + c + i, x + W - i, y + H - c - i, x + W - c - i, y + H - i, x + c + i, y + H - i, x + i, y + H - c - i, x + i, y + c + i];
    const mask = new Graphics().poly(pts(0)).fill({ color: 0xffffff });
    this.mesh.mask = mask;
    const vignette = new Graphics();
    const band = Math.min(W, H) * 0.012;
    for (let i = 0; i < 9; i += 1) vignette.poly(pts(i * band)).stroke({ width: band, color: 0x000000, alpha: 0.42 * (1 - i / 9), alignment: 0 });
    const frame = new Graphics();
    const line = Math.max(1, H * 0.003);
    frame.poly(pts(0)).stroke({ width: line * 1.5, color: 0xc9a865, alpha: 0.85, alignment: 1 });
    frame.poly(pts(line * 4)).stroke({ width: line, color: 0xc9a865, alpha: 0.35, alignment: 1 });
    this.addChild(mask, vignette, frame);
  }

  /** Figure height in texture pixels (bbox height). */
  get figurePixelHeight(): number {
    return this.figure.rig.figH * this.imageH;
  }

  /** The face centre relative to the anchor, in local (unscaled) pixels. */
  get faceLocal(): { x: number; y: number } {
    const r = this.figure.rig;
    return { x: (this.figure.face.x - r.cx) * this.imageW, y: (this.figure.face.y - r.by) * this.imageH };
  }

  /** The face box height in local (unscaled) pixels. */
  get faceHeightLocal(): number {
    return this.figure.face.h * this.imageH;
  }

  setTexture(texture: Texture): void {
    this.mesh.texture = texture;
  }

  setMood(mood: BattleMood | PuppetMood): void {
    this.targetMood = typeof mood === "string" ? { ...BATTLE_MOODS[mood] } : { ...mood };
  }

  gesture(kind: PuppetGestureKind, gain = 1, side = 1): void {
    this.gestures.push({ kind, start: this.now, gain, side });
  }

  playShift(kind: PuppetShiftKind, gain = 1): void {
    this.shift = { kind, start: this.now, gain };
  }

  /** The anchor's velocity changed (image heights per second, y up): the loose parts trail. */
  kick(dvx: number, dvy: number): void {
    springKick(this.body, dvx, dvy);
    springKick(this.hair, dvx * 1.3, dvy * 1.1);
  }

  /** -1..1: where the figure looks (image space, + = its right). */
  lookAt(gaze: number): void {
    this.gazeTarget = Math.max(-1, Math.min(1, gaze));
  }

  /** The effects shader, attached on first use. */
  get shader(): FigureFilter {
    if (!this.fx) {
      this.fx = new FigureFilter(Math.floor(this.phase * 1000));
    }
    if (!this.filters || (this.filters as unknown[]).length === 0) this.filters = [this.fx];
    return this.fx;
  }

  /** Set the effects without attaching the shader for a zero. */
  setGray(v: number): void {
    if (v > 0 || this.fx) this.shader.gray = v;
  }

  setFlash(color: number, amount: number): void {
    if (amount > 0 || this.fx) this.shader.flash = { color, amount };
  }

  setDissolve(v: number, edge?: number): void {
    if (v > 0 || this.fx) {
      const fx = this.shader;
      fx.dissolve = v;
      if (edge !== undefined) fx.edge = edge;
    }
  }

  /** Detach the shader when nothing in it is on (saves a render target). */
  private relaxEffects(): void {
    if (this.fx && this.filters && this.fx.flashAmount <= 0.001 && this.fx.dissolve <= 0 && this.fx.gray <= 0.001) {
      this.filters = [];
    }
  }

  update(now: number, dt: number): void {
    this.now = now;
    easeMood(this.mood, this.targetMood, 1 - Math.exp(-dt / 0.25));
    const rate = VARIANT_BREATH_RATE[this.kind];
    this.breathClock += dt * this.mood.breathRate * rate;
    this.swayClock += dt * this.mood.swayRate;
    this.gaze += (this.gazeTarget - this.gaze) * (1 - Math.exp(-dt / 0.3));
    springStep(this.body, dt, PUPPET_BODY_SPRING);
    springStep(this.hair, dt, PUPPET_HAIR_SPRING);
    this.gestures = this.gestures.filter((g) => now - g.start < PUPPET_GESTURE_S[g.kind]);
    if (this.shift && now - this.shift.start > PUPPET_SHIFT[this.shift.kind].duration + 0.5) this.shift = null;
    this.writePositions();
    this.mesh.geometry.getBuffer("aPosition").update();
    this.relaxEffects();
  }

  private writePositions(): void {
    const r = this.figure.rig;
    const strength = this.framed ? 0 : this.strength;
    const pose = puppetPose({
      time: this.now,
      phase: this.phase,
      figH: r.figH,
      faceW: r.faceW,
      breathing: 1,
      sway: 1,
      head: 1,
      talk: 0,
      reaction: null,
      strength,
      clocks: { breath: this.breathClock, sway: this.swayClock },
      acting: 1,
      mood: this.mood,
      gaze: this.gaze,
      side: this.phase > 0.5 ? 1 : -1,
      gestures: this.gestures.map((g) => ({ kind: g.kind, age: this.now - g.start, gain: g.gain, side: g.side })),
      physics: { bodyX: this.body.x, bodyY: this.body.y, hairX: this.hair.x, hairY: this.hair.y, windX: 0 },
      shift: this.shift ? { kind: this.shift.kind, age: this.now - this.shift.start, gain: this.shift.gain } : null,
    });
    figureMeshPositions(r, pose, this.grid, this.kind, { time: this.now, phase: this.phase, strength }, this.imageW, this.imageH, this.positions);
  }
}
