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

export type Movement = "scene" | "lobby" | "stops" | "hex" | "delve";

export interface ScenePerson {
  id: string;
  name: string;
  role: string;
  /** Lumiverse image id of their art, when the user has some. */
  imageId: string | null;
  /** Art key Gambit draws them under when they have none. */
  art: string;
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
  thread?: { goal: string; found: string[]; total: number };
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
  delve?: DelveView;
  /** Something is being prepared (a read, an encounter). */
  busy?: string;
}
