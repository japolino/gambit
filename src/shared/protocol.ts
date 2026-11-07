/**
 * Messages between Gambit's backend and frontend (spindle.sendToFrontend /
 * ctx.sendToBackend). Never put image bytes in these: the WebSocket caps a
 * payload at 4 MB, so send image ids and URLs (docs/DESIGN.md, 8.1).
 *
 * Sections are owned by area; add new message types inside your section.
 */
import type { Action, BattleEvent, BattleState } from "../engine/types.js";

/* ---------------------------- art ---------------------------------- */

export type ArtKind = "portrait" | "expression" | "pose" | "monster" | "monster_phase2" | "background" | "background_variant" | "icon_sheet" | "style_probe";
export type ArtPriority = 0 | 1 | 2 | 3;

/** What the frontend shows for an asset key at any moment. */
export interface ArtStatus {
  key: string;
  state: "queued" | "running" | "ready" | "failed";
  /** Displayable URL once ready (an /api/v1/... path). */
  url?: string;
  imageId?: string;
  /** Transparent figure? (monsters, poses) */
  cutout?: boolean;
  /** The route that drew it (a plan label such as "nai-v5-inset"), for logs and debugging. */
  via?: string;
  error?: string;
}

/** The backend asks the browser to compose a V5 inset canvas (no canvas in the backend). */
export interface InsetComposeRequest {
  requestId: string;
  layout: "sprite" | "wide";
  /** Image to place as the reference half. */
  sourceUrl: string;
}

/**
 * Browser pixel work the backend cannot do (no canvas): crop an inset render
 * to its repainted part, or slice an icon sheet into icons. Each resulting
 * PNG comes back as `art.pixels.chunk` messages (item i of n, chunk j of m)
 * and the backend stores it with `spindle.images.upload`.
 */
export type PixelJob =
  | { requestId: string; kind: "crop"; sourceUrl: string; rect: { x: number; y: number; width: number; height: number } }
  | {
      requestId: string;
      kind: "slice";
      sourceUrl: string;
      cols: number;
      rows: number;
      /** Cells to return, row-major from the top left (<= cols*rows). */
      count: number;
      /** Share of a cell cut away on each side. */
      margin: number;
      /** Trim each icon to its opaque pixels (transparent sheets) and pad to a square. */
      trim: boolean;
    };

/** Style-probe key of one look and subject (also sent as `art.update` items). */
export type StyleProbeKey = `style_probe:${string}:${"gate" | "bust"}`;

/* ---------------------------- frontend -> backend ------------------ */

export type ToBackend =
  | { type: "hello" }
  /** The Stage opened: close the side drawer so it does not cover the fight. */
  | { type: "stage.opened" }
  // battle
  | { type: "battle.start"; encounterId: string; seed?: string }
  | { type: "battle.act"; battleId: string; action: Action }
  // art
  | { type: "art.request"; key: string; priority: ArtPriority }
  | { type: "art.status"; keys: string[] }
  | { type: "style.probe" }
  | { type: "style.pick"; lookId: string }
  | { type: "inset.result"; requestId: string; part: "image" | "mask"; chunk: string; index: number; total: number }
  | { type: "inset.error"; requestId: string; error: string }
  | {
      type: "art.pixels.chunk";
      requestId: string;
      /** Which resulting image (0-based) of `items`. */
      item: number;
      items: number;
      /** Chunk of this image's base64 PNG. */
      index: number;
      total: number;
      chunk: string;
      /** Sent with chunk 0: the image's size and whether it is already transparent (isPreCut). */
      width?: number;
      height?: number;
      preCut?: boolean;
    }
  | { type: "art.pixels.error"; requestId: string; error: string };

/* ---------------------------- backend -> frontend ------------------ */

export type ToFrontend =
  | { type: "welcome"; version: string; styleLook: string | null }
  // battle
  | { type: "battle.state"; state: BattleState; events: BattleEvent[] }
  | { type: "battle.error"; error: string }
  // art
  | { type: "art.update"; items: ArtStatus[] }
  | { type: "style.probes"; looks: { lookId: string; label: string; status: ArtStatus }[] }
  | { type: "style.locked"; lookId: string }
  | { type: "inset.compose"; request: InsetComposeRequest }
  | { type: "art.pixels"; job: PixelJob }
  | { type: "notice"; level: "info" | "warn" | "error"; text: string };
