/**
 * The Diorama theme's three parts talk through this small shared board: the
 * scene's 3D shop (room3d.ts) stages a fight or a talk, the battle theme
 * (../../../stage/themes/diorama/*) draws its HUD and figures over the room,
 * and the Parley theme (../../../parley/themes/diorama/*) draws its paper
 * objects over it. Each reads what the others publish:
 *
 *  - the room publishes where its counter top lands on screen (`band`), so
 *    the battle stands its figures on it, and whether it staged an encounter;
 *  - the battle publishes where each enemy stands, how it moves and its art,
 *    so the room lights it and casts its shadow on the counter and wall;
 *  - the talk publishes the person's picture and the running offer, so the
 *    room stands them behind the counter and rings the offer up on the till.
 *
 * It lives on the highest same-origin window (the preview runs the talk in a
 * same-origin iframe over the scene), else on this window.
 */

/** Screen fractions (0..1 of the viewport) of the counter top in the encounter framing. */
export interface RoomBand {
  /** Counter top's back and front edge at the middle (y). */
  back: number;
  front: number;
  /** Where the counter ends at the depth the figures stand (x). */
  left: number;
  right: number;
  /** Aspect the band was measured at (w/h). */
  aspect: number;
}

export interface EnemyMark {
  id: string;
  /** Feet (bottom centre), as viewport fractions. */
  x: number;
  y: number;
  /** Figure height as a fraction of the viewport height. */
  h: number;
  /** Body offset while it lunges or recoils (viewport fractions). */
  dx: number;
  dy: number;
  alive: boolean;
  /** 0..1 how visible (fades and dissolves). */
  alpha: number;
  /** Its picture (a canvas or an image) for the cast shadow, when the stage can lend it. */
  image: CanvasImageSource | null;
  /** The opaque bounding box of the image as [x, y, w, h] fractions, so the shadow matches the figure. */
  bbox: [number, number, number, number];
  /** Being targeted (lit), acting now. */
  hot: boolean;
  active: boolean;
  /** A hit just landed (seconds timestamp), for a light flash. */
  hitAt: number;
}

export interface Board {
  /** What the room staged: a fight, a talk, or nothing. */
  staged: "battle" | "parley" | null;
  band: RoomBand | null;
  enemies: EnemyMark[];
  /** Bumped by the battle whenever `enemies` changes shape. */
  enemyVer: number;
  /** A strike landed somewhere (seconds), for the lamp to jolt. */
  shake: number;
  parley: { url: string | null; framed: boolean; offer: string | null; unit: string | null; label: string | null; role: string | null; title: string | null; patience: number; patienceMax: number; mood: string | null; ver: number };
}

type Host = { __gambitDiorama?: Board };

export function board(): Board {
  // The highest same-origin window above this one (touching a cross-origin parent throws; stop there).
  let win: Window = window;
  try {
    while (win.parent && win.parent !== win && win.parent.document) win = win.parent;
  } catch {
    /* cross-origin parent */
  }
  const w = win as unknown as Host;
  return (w.__gambitDiorama ??= {
    staged: null,
    band: null,
    enemies: [],
    enemyVer: 0,
    shake: 0,
    parley: { url: null, framed: false, offer: null, unit: null, label: null, role: null, title: null, patience: 0, patienceMax: 0, mood: null, ver: 0 },
  });
}
