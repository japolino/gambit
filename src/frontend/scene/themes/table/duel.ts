/**
 * The Table's encounters: a fight or a talk staged at the card table.
 *
 * The room (three.ts) and the two flat layers drawn over it, the battle's
 * Pixi canvas (../../../stage/themes/table/) and the Parley view
 * (../../../parley/themes/table/), must agree on where the far edge of the
 * table is and where someone sitting behind it stands on screen. They agree
 * by sharing one camera, as pure math: each side projects the same 3D points
 * for its own window size, so nothing has to be measured or passed around
 * (the Parley view can even live in another document).
 *
 * `duel` is a small same-document bus for what the battle tells the room:
 * that the room staged it, the turn order chalked on the hanging slate, the
 * bell to ring and the candle to flare.
 */

export type Vec = [number, number, number];

export interface DuelCam {
  eye: Vec;
  look: Vec;
  /** Vertical field of view, degrees. */
  fov: number;
  port: boolean;
}

/** The table's far lip, where people across the table disappear behind the wood. */
export const EDGE = { y: 0.035, z: -1.1 };
/** The floor under the table, where a standing figure's feet are (hidden by the table). */
export const FLOOR = -0.62;

/** Where you sit and look for a fight or a talk, for a window of this aspect (w / h). */
export function duelCamera(kind: "battle" | "parley", aspect: number): DuelCam {
  const port = aspect < 1.15;
  if (kind === "battle") {
    if (port) return { eye: [0, 0.8, 1.4], look: [0, -0.1, -1.6], fov: 70, port };
    return { eye: [0, 0.5, 1.0], look: [0, 0.2, -1.4], fov: aspect > 2.2 ? 44 : 50, port };
  }
  // A talk: lean in over the mat, the one you face filling the middle.
  if (port) return { eye: [0, 0.7, 1.1], look: [0, -0.2, -1.5], fov: 66, port };
  return { eye: [0, 0.45, 0.7], look: [0, 0.18, -1.4], fov: aspect > 2.2 ? 40 : 46, port };
}

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec): Vec => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** A point in the room on screen, as fractions of the window (0..1 across and down); `k` is screen height per room unit there. */
export function project(cam: DuelCam, aspect: number, p: Vec): { x: number; y: number; k: number } {
  const f = norm(sub(cam.look, cam.eye));
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const d = sub(p, cam.eye);
  const z = Math.max(1e-3, dot(d, f));
  const t = Math.tan((cam.fov * Math.PI) / 360);
  const nx = dot(d, r) / (z * t * aspect);
  const ny = dot(d, u) / (z * t);
  return { x: (nx + 1) / 2, y: (1 - ny) / 2, k: 1 / (2 * z * t) };
}

/** Where the n people across the table stand (room x, z), the middle one a step nearer. */
export function seats(n: number, port: boolean): { x: number; z: number }[] {
  const span = n <= 1 ? 0 : port ? (n === 2 ? 0.36 : 0.5) : Math.min(1.05, 0.42 * (n - 1));
  return Array.from({ length: n }, (_, i) => {
    const t = n <= 1 ? 0 : i / (n - 1) - 0.5;
    const x = t * 2 * span;
    return { x, z: -1.5 - Math.abs(t) * 0.25 };
  });
}

export interface DuelBus {
  /** What the room is staging now (set by the scene's encounter()). */
  staged: null | "battle" | "parley";
  /** What the encounter chalks on the room's hanging slate (the battle's turn order, the talk's stakes). */
  slate: HTMLCanvasElement | null;
  slateVersion: number;
  /** The talk's patience as candles on the table (null: none). */
  patience: { now: number; max: number } | null;
  /** Bumped to ring the bell / flare the candle. */
  ring: number;
  flare: number;
}

/**
 * One bus per window tree: the Parley view may be mounted in a same-origin child frame of the page that runs
 * the room, so the bus lives on the topmost window it can reach.
 */
function bus(): DuelBus {
  const fresh = (): DuelBus => ({ staged: null, slate: null, slateVersion: 0, patience: null, ring: 0, flare: 0 });
  let w: Window & { __gambitTableDuel?: DuelBus } = window;
  try {
    while (w.parent && w.parent !== w) {
      void w.parent.document;
      w = w.parent as typeof w;
    }
  } catch {
    // A cross-origin parent: this window's own bus.
  }
  return (w.__gambitTableDuel ??= fresh());
}

export const duel: DuelBus = typeof window === "undefined" ? { staged: null, slate: null, slateVersion: 0, patience: null, ring: 0, flare: 0 } : bus();
