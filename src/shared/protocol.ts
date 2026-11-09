/**
 * Messages between Gambit's backend and frontend (spindle.sendToFrontend /
 * ctx.sendToBackend). Never put image bytes in these: the WebSocket caps a
 * payload at 4 MB, so send image ids and URLs (docs/DESIGN.md, 8.1).
 *
 * Sections are owned by area; add new message types inside your section.
 */
import type { Action, BattleEvent, BattleState } from "../engine/types.js";
import type { Exchange, ParleyScenario, ParleyState, SocialStat } from "../engine/parley/types.js";
import type { CardSheet, ContestChip, ModuleId, Tier } from "../engine/card/types.js";
import type { DelveMove } from "../engine/world/delve.js";
import type { NoteId } from "../meaning/notes.js";
import type { SceneView, ThemeId } from "./scene-view.js";
import type { ForgeOp, ForgeView } from "./forge-view.js";
import type { FxManifest } from "./fx.js";
import type { MusicMoment, Track } from "../meaning/music.js";
/** A look's palette tokens for the code-drawn layer (5.2a). */
export type LookUi = Partial<Record<"ink" | "panel" | "gold" | "ally" | "enemy" | "accent", string>>;

/* ---------------------------- card --------------------------------- */

/** What the drawer shows for the active chat (docs/DESIGN.md 4.0). */
export interface CardStatus {
  chatId: string;
  /** Gambit is switched on for this chat. */
  enabled: boolean;
  /** The Card Reader is reading right now. */
  reading: boolean;
  sheet: CardSheet | null;
  /** The card changed since the sheet was read. */
  stale: boolean;
  /** Contest chips under replies are on. */
  chips: boolean;
  /** Adult scenes after fights are on (opt-in, off by default). */
  adult: boolean;
  error?: string;
}

/* ---------------------------- story notes ---------------------------- */

/** The notes Gambit adds to the chat's own generations, with the user's edits (meaning/notes.ts). */
export interface NotesState {
  /** The fields a note can use, in words. */
  fields: string;
  notes: { id: NoteId; label: string; default: string; /** The user's edit, when there is one. */ text?: string }[];
}

/* ---------------------------- models -------------------------------- */

/** Which connection each kind of model call uses (docs/DESIGN.md 9; meaning/models.ts). */
export type ModelRoleId = "reader" | "narrator" | "helper";
export type ReasoningChoice = "auto" | "on" | "off";
export interface ModelConnOption {
  id: string;
  name: string;
  model: string;
  /** The default LLM connection, or the primary embedding connection. */
  isDefault: boolean;
}
export interface ModelsState {
  roles: Record<ModelRoleId, { connectionId: string | null; reasoning: ReasoningChoice }>;
  /** "auto", "off", or a decision connection id. */
  decision: string;
  /** "auto", "off", or an embedding connection id. */
  embedding: string;
  llm: ModelConnOption[];
  decisions: ModelConnOption[];
  embeddings: ModelConnOption[];
}
export interface ModelsPatch {
  role?: ModelRoleId;
  connectionId?: string | null;
  reasoning?: ReasoningChoice;
  decision?: string | null;
  embedding?: string | null;
}

/* ---------------------------- parley -------------------------------- */

/** How the Referee's read is shown (docs/DESIGN.md 4.1.4). */
export type ParleyViewMode = "immersive" | "transparent";

/** Who voices the NPC: Gambit's own short narrator, or the chat's preset and model. */
export type ParleyNarrator = "gambit" | "chat";

/** Stored on the chat message that carries an exchange: metadata.gambit.parley. */
export interface ParleyMessageMeta {
  id: string;
  index: number;
}

/* ---------------------------- art ---------------------------------- */

export type ArtKind = "portrait" | "expression" | "pose" | "monster" | "monster_phase2" | "background" | "background_variant" | "icon_sheet" | "style_probe" | "figure" | "cg" | "map";
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
  /** A figure cut out in the browser: its face (normalized x, y, w, h), for portrait crops and tokens. */
  face?: [number, number, number, number] | null;
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
  /**
   * Cut a figure out of its plain background with the segmentation model
   * (frontend/art/cutout, from Cue), optionally after a crop. The first cut
   * in a browser downloads the model, so the backend waits longer for it.
   */
  | { requestId: string; kind: "cut"; sourceUrl: string; crop?: { x: number; y: number; width: number; height: number }; face?: boolean }
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

/** What a browser cut-out found: the figure's box and face (normalized 0..1), and its checks. */
export interface CutMeta {
  bbox: [number, number, number, number];
  face?: [number, number, number, number] | null;
  /** "best": the model made the mask; "basic": no model could run (flood fill only). */
  quality: "best" | "basic";
  twoFigures: boolean;
  scenery?: boolean;
}

/** Style-probe key of one look and subject (also sent as `art.update` items). */
export type StyleProbeKey = `style_probe:${string}:${"gate" | "bust"}`;

/* ---------------------------- frontend -> backend ------------------ */

export type ToBackend =
  | { type: "hello" }
  /** The window shows this chat now (or no chat): send its running fight and open Parley again, for the drawer's Resume. */
  | { type: "resume"; chatId: string | null }
  /** The stage wants the effect sheets and sounds (shared/fx.ts). */
  | { type: "fx.get" }
  /** The Stage opened: close the side drawer so it does not cover the fight. */
  | { type: "stage.opened" }
  // battle
  | { type: "battle.start"; encounterId: string; seed?: string }
  | { type: "battle.act"; battleId: string; action: Action }
  // parley
  | { type: "parley.start"; scenarioId: string; chatId: string | null }
  | { type: "parley.say"; parleyId: string; text: string }
  | { type: "parley.close"; parleyId: string; how: "deal" | "walk" }
  | { type: "parley.view"; mode: ParleyViewMode }
  | { type: "parley.narrator"; mode: ParleyNarrator }
  | { type: "journal.reset"; chatId: string | null }
  // card
  /** What's on screen changed, and music is on: which track goes with it? */
  | { type: "music.want"; chatId: string; moment: MusicMoment; about?: string }
  | { type: "card.status"; chatId: string }
  | { type: "card.enable"; chatId: string; on: boolean }
  | { type: "card.read"; chatId: string }
  | { type: "card.edit"; chatId: string; social?: Partial<Record<SocialStat, Tier>>; modules?: Partial<Record<ModuleId, boolean>> }
  | { type: "card.talk"; chatId: string; castId: string; kind?: ContestChip["kind"]; chipId?: string }
  | { type: "card.chips"; chatId: string; on: boolean }
  | { type: "card.adult"; chatId: string; on: boolean }
  // story notes: the words Gambit adds to the chat's generations, editable
  | { type: "notes.get" }
  | { type: "notes.set"; id: NoteId; text: string | null }
  | { type: "card.demo" }
  // models: which connection each kind of call uses
  | { type: "models.get" }
  | { type: "models.set"; patch: ModelsPatch }
  // art
  | { type: "scene.open"; chatId: string }
  | { type: "scene.act"; chatId: string; hotspot: string }
  /** A line the player wrote in the scene (engine/story/beat.ts). */
  | { type: "scene.say"; chatId: string; text: string }
  | { type: "scene.theme"; chatId: string; theme: ThemeId }
  | { type: "delve.step"; chatId: string; move: DelveMove }
  | { type: "delve.leave"; chatId: string }
  | { type: "hex.step"; chatId: string; q: number; r: number }
  /** The expedition board: move to a tile, open a lore tile at a depth (0 passes), camp, hold still, or turn back. */
  | { type: "board.act"; chatId: string; op: "move" | "lore" | "camp" | "skip" | "leave"; cell?: string; tier?: number }
  | { type: "play.fight"; chatId: string; lead?: string; boss?: boolean }
  // classes (M7): the book, the Forge, fusion, awakening, the codex
  | { type: "forge.act"; chatId: string; op: ForgeOp; arg?: string; arg2?: string; text?: string }
  | { type: "art.request"; key: string; priority: ArtPriority }
  | { type: "art.status"; keys: string[] }
  /** Draw the gate and bust of every preset, or of one look. */
  | { type: "style.probe"; lookId?: string }
  | { type: "style.pick"; lookId: string }
  | { type: "look.list" }
  | { type: "look.import"; json: string }
  | { type: "look.export"; lookId: string }
  | { type: "look.delete"; lookId: string }
  /** Ask the strong model for a look that fits this chat's card (5.2a). */
  | { type: "look.match"; chatId: string }
  /** "Describe a look" (5.2a): words in, a validated look file out. */
  | { type: "look.describe"; text: string }
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
      /** Sent with chunk 0 of a cut: what the cut-out found. */
      cut?: CutMeta;
    }
  | { type: "art.pixels.error"; requestId: string; error: string };

/* ---------------------------- backend -> frontend ------------------ */

export type ToFrontend =
  | { type: "welcome"; version: string; styleLook: string | null; ui?: LookUi | null }
  /** Effects and sounds: the manifest (null when the install has none), then each file it uses, as base64 in parts under the 4 MB message cap. */
  | { type: "fx.manifest"; manifest: FxManifest | null }
  | { type: "fx.file"; file: string; mime: string; part: number; parts: number; data: string }
  // battle
  | { type: "battle.state"; state: BattleState; events: BattleEvent[] }
  /** battleId: the fight it is about; without one, a fight that could not start. */
  | { type: "battle.error"; error: string; battleId?: string }
  // parley
  | { type: "parley.state"; state: ParleyState; scenario: ParleyScenario; journal: string[]; view: ParleyViewMode; narrator: ParleyNarrator; resumed?: boolean }
  /** A decided exchange: play the read and the dice. */
  | { type: "parley.exchange"; parleyId: string; state: ParleyState; exchange: Exchange; narrated: boolean }
  /** The Referee is reading a line typed in the normal composer. */
  | { type: "parley.judging"; parleyId: string; text: string }
  /** The NPC's narrated reply to exchange `index` (or a code-written one without a chat). */
  | { type: "parley.reply"; parleyId: string; index: number; text: string; final: boolean }
  /** About a running Parley (parleyId), or one that could not start in a chat. */
  | ({ type: "parley.error"; error: string } & ({ parleyId: string } | { chatId: string | null }))
  | { type: "parley.view"; mode: ParleyViewMode }
  | { type: "parley.narrator"; mode: ParleyNarrator }
  // card
  | { type: "card.status"; status: CardStatus }
  /** The roleplay just set up a contest: offer it under that reply. */
  | { type: "card.chip"; chip: ContestChip }
  /** Framing a contest the player asked for (the Parley follows). */
  | { type: "card.starting"; chatId: string; castName: string }
  // models
  | { type: "models.state"; state: ModelsState }
  | { type: "notes.state"; state: NotesState }
  // art
  | { type: "scene.state"; view: SceneView }
  /** A beat's reply as it is written, until the next scene.state carries it. */
  | { type: "scene.story"; chatId: string; text: string; said: string; roll: string | null }
  | { type: "forge.state"; chatId: string; view: ForgeView }
  /** Drop a suggested action into the chat input (6.1: the menu and the roleplay never fight). */
  | { type: "scene.suggest"; chatId: string; text: string }
  /** "Meanwhile…" (4.5): sent with null vignettes and the day behind you when the night starts, then again with the scenes and what changed by morning. */
  | { type: "scene.meanwhile"; chatId: string; day: number; vignettes: { text: string; why?: string; change?: string; art?: string; imageId?: string | null; cg?: string }[] | null; today?: string[]; morning?: string[] }
  /** An adult scene read page by page: null pages while it's written, empty when it could not be, then the pages (cg: an art key that arrives by art.update). */
  | { type: "scene.afterglow"; chatId: string; title: string; pages: { text: string; cg?: string }[] | null }
  /** The track for a moment; null with the reason when there's no music to be had. */
  | { type: "music.track"; chatId: string; moment: MusicMoment; about?: string; track: Track | null; error?: string }
  | { type: "art.update"; items: ArtStatus[] }
  | { type: "style.probes"; looks: { lookId: string; label: string; status: ArtStatus; source?: "preset" | "user" | "inlay" | "card"; description?: string }[] }
  /** A look file to save (export). */
  | { type: "look.file"; lookId: string; json: string }
  | { type: "style.locked"; lookId: string; ui?: LookUi | null }
  | { type: "inset.compose"; request: InsetComposeRequest }
  | { type: "art.pixels"; job: PixelJob }
  /** chatId: about that chat only (a window on another chat ignores it). */
  | { type: "notice"; level: "info" | "warn" | "error"; text: string; chatId?: string };
