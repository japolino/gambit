/**
 * What the Scene view shows (docs/DESIGN.md 6.1-6.3): the place, the people
 * in it, the menu, and the movement mode for the world's shape. Built on
 * the backend from the World and the Scene state; the frontend only draws.
 */
import type { Hotspot, TimeOfDay } from "../engine/world/places.js";
import type { DelveMove, Facing, RoomKind } from "../engine/world/delve.js";
import type { ShapeId } from "../engine/card/types.js";

/** Stage themes (6.3): the frame around the art. */
export type ThemeId = "storybook" | "onebit" | "lobby" | "diorama" | "table" | "command";
export const THEMES: readonly { id: ThemeId; label: string }[] = [
  { id: "storybook", label: "Storybook" },
  { id: "onebit", label: "1-bit" },
  { id: "lobby", label: "Lobby" },
  { id: "diorama", label: "Diorama" },
  { id: "table", label: "Table" },
  { id: "command", label: "Command" },
];

export type Movement = "scene" | "lobby" | "stops" | "hex" | "delve" | "board";

/** The expedition board (engine/world/board.ts) as the frontend draws it. Face-down tiles show their ring, not what they are. */
export interface BoardView {
  name: string;
  /** Art key of the place seen from above, drawn for the board: the tiles lie on it, and turning one shows the ground beneath. */
  map: string;
  /** Art key of the place's painting (the board's backdrop while its map is drawn). */
  painting: string;
  cells: {
    k: string;
    q: number;
    r: number;
    ring: "safe" | "chance" | "lore" | "goal";
    open: boolean;
    /** What the tile is, once it is face up (the way in and the way on are always known). */
    kind: "start" | "goal" | "camp" | "spring" | "cache" | "forage" | "hazard" | "shortcut" | "lore" | "quiet" | null;
    used: boolean;
    stars?: number;
    /** A face-up lore tile: what it holds. */
    title?: string;
    lore?: "fact" | "person" | "entry" | "thread";
    /** The member whose move it is can go here. */
    reach: boolean;
  }[];
  foes: { id: string; q: number; r: number }[];
  /** `art`: their cut-out figure (or drawn portrait) key, shown cropped to the face once ready; `imageId` until then. */
  party: { id: string; name: string; q: number; r: number; imageId: string | null; art?: string; active: boolean }[];
  supplies: number;
  cap: number;
  round: number;
  /** All of the party must stand here to finish. */
  goal: string;
  start: string;
  /** A lore tile waits for a depth: its title, kind, stars, and what each depth costs. */
  pending?: { cell: string; title: string; kind: "fact" | "person" | "entry" | "thread"; stars: 1 | 2 | 3; costs: number[] };
  /** A battle with a foe is under way. */
  fight: boolean;
  done: boolean;
  /** The active member stands on an unused camp. */
  camp: { here: boolean; cost: number };
  /** What a lore tile just showed: the glimpse or the scene, until the next action. */
  story?: { title: string; text: string; stars: number; /** A CG of the find (2★ and up), drawn while you read. */ art?: string };
  /** What the last action did, for the pops: a gain or loss at a tile. */
  fx: { cell?: string; text: string; kind: "supply" | "coin" | "hurt" | "heal" | "lore" | "foe" | "goal" | "info" }[];
}

export interface ScenePerson {
  id: string;
  name: string;
  role: string;
  /** Lumiverse image id of their art, when the user has some. */
  imageId: string | null;
  /** Art key Gambit draws them under when they have none. */
  art: string;
  /** Their own full figure, drawn from their card art and cut out (preferred once it is ready). */
  figure?: string;
}

export interface DelveView {
  /** Rows of the automap: unseen cells are '?'. */
  grid: string[];
  x: number;
  y: number;
  facing: Facing;
  keys: number;
  /** Seen rooms and what they hold. */
  rooms: { id: string; x: number; y: number; kind: RoomKind; cleared: boolean }[];
  /** The next four cells straight ahead, nearest first, and the ones to each side of each. */
  view: { ahead: string; left: string; right: string }[];
  /** The room you stand in. */
  room: { kind: RoomKind; cleared: boolean } | null;
  moves: DelveMove[];
  done: boolean;
  /** Art keys of the corridor textures (wall, floor). */
  textures: { wall: string; floor: string };
  name: string;
}

export interface StoryBeat {
  said: string;
  roll: string | null;
  reply: string;
  /** What this line turned up, if anything. */
  found?: string | null;
  /** The reply is still being written. */
  live?: boolean;
}

/** Who the story can name, to tell whose a quote is (frontend/story-text.ts). */
export interface Voices {
  /** The card's cast in its own order (a person's colour is their place here); `here`: in the scene now. */
  cast: { name: string; pronoun: "she" | "he" | "they"; here?: boolean }[];
  /** The player's name, or "" when the story calls them "you". */
  player: string;
}

export interface SceneView {
  chatId: string;
  cardName: string;
  theme: ThemeId;
  shape: ShapeId;
  movement: Movement;
  skin: { currency: string; fight: string; genre: string };
  place: { id: string; name: string; description: string; art: string; added: boolean };
  /** Lobby: the other places as tiles around the companion. */
  tiles: { id: string; name: string; art: string }[];
  /** Journey: the stops, and where you are. */
  route: { id: string; name: string }[];
  /** Frontier: the honeycomb overland (M5). Out in the wild, `place` is the cell's terrain. */
  hex?: {
    cells: { q: number; r: number; placeId: string | null; name: string | null; seen: boolean; here: boolean; terrain: string }[];
    supplies: number;
    max: number;
    wild: boolean;
  };
  /** The central thread from the World Bible, and what has come out of it so far. */
  thread?: { goal: string; found: string[]; total: number; daysLeft?: number; ended?: "solved" | "lost" };
  /** Facts the player knows: the hand of cards in the Table theme (6.1). */
  hand: { id: string; text: string }[];
  /** An indoor place (a shop, inn, room): the Diorama theme builds it as a box room (6.2). */
  indoor: boolean;
  /** The Journal (4.6): deeds, what people remember, rumours, quests, items, companions. */
  journal: {
    deeds: string[];
    rumors: string[];
    people: { id: string; name: string; feel: string; notes: string[] }[];
    quests: { name: string; dossier: string; steps: { text: string; where: string; done: boolean }[]; item: string; done: boolean }[];
    items: { name: string; description: string; from: string }[];
    companions: { id: string; name: string; affinity: number; bonded: boolean; recruit: boolean }[];
    /** The CGs this playthrough drew, newest first: art keys with a caption. */
    album: { key: string; caption: string; day: number }[];
  };
  people: ScenePerson[];
  menu: Hotspot[];
  /** Fights are on for this card (the Encounters module). */
  canFight: boolean;
  clock: { day: number; time: TimeOfDay };
  coin: number;
  /** Party strength carried between fights, 0-1. */
  vigor: number;
  /** Latest happenings, newest last. */
  log: string[];
  /** The story so far in this scene: what the player wrote, any roll, and what happened. Newest last. */
  story: StoryBeat[];
  voices: Voices;
  delve?: DelveView;
  board?: BoardView;
  /** Something is being prepared (a read, an encounter). */
  busy?: string;
}
