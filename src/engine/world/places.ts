/**
 * The card's places as a graph, laid out in the shape the reader picked
 * (docs/DESIGN.md 4.0, 4.5, 6.1). The graph stays under the hood: the
 * player moves through scene menus, a lobby, a next-stop strip, or a delve.
 * Pure and seeded: the same sheet and seed always build the same world.
 */
import type { CardSheet, Evidence, ShapeId } from "../card/types.js";

export type HotspotKind = "talk" | "search" | "exit" | "rest" | "shop" | "fight" | "delve" | "wait";

export interface Hotspot {
  id: string;
  kind: HotspotKind;
  label: string;
  /** Cast id (talk), place id (exit), foe id (fight). */
  target?: string;
}

export interface WorldPlace {
  id: string;
  name: string;
  description: string;
  /** Exits: place ids reachable in one move. */
  exits: string[];
  /** Cast ids usually found here. */
  people: string[];
  rest: boolean;
  shop: boolean;
  /** Danger here: fights can start from the menu. */
  danger: boolean;
  /** An entrance to a room-by-room delve. */
  delve: boolean;
  /** Added by Gambit (not quoted from the card). */
  added: boolean;
  evidence: Evidence;
}

export interface World {
  v: 1;
  shape: ShapeId;
  start: string;
  places: Record<string, WorldPlace>;
  /** Visit order for a journey (the next-stop strip). */
  route: string[];
}

const REST = /\b(inn|tavern|home|house|camp|bedroom|room|quarters|apartment|hotel|lodge|palace|manor|mansion|castle|hideout|base|ship)\b/i;
const SHOP = /\b(shop|market|store|merchant|bazaar|bar|tavern|inn|cafe|café|smith|forge|stall|mall|pharmacy|club)\b/i;
const DANGER = /\b(ruin|ruins|ruined|dungeon|cave|caves|crypt|wreck|forest|woods|wild|wilds|wilderness|jungle|battle|battlefield|front|street|streets|alley|alleys|slums?|docks|sewers?|swamp|desert|wasteland|pit|arena|hell|abyss|tower|tomb|catacombs?|mines?|graveyard|cemetery|danger|dangerous|warzone|lawless)\b/i;
const DELVE = /\b(ruin|ruins|dungeon|cave|caves|crypt|wreck|derelict|station|tunnel|tunnels|catacomb|catacombs|mine|labyrinth|maze|tomb|vault|basement|sewer|sewers|undercroft|dungeons|haunted)\b/i;

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
const norm = (s: string): string => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** Who is where: a person whose words name a place is there; the rest spread from the start, the main cast at the start. */
function placePeople(sheet: Pick<CardSheet, "cast">, ids: string[], names: Record<string, string>, start: string, seed: number): Record<string, string[]> {
  const out: Record<string, string[]> = Object.fromEntries(ids.map((id) => [id, [] as string[]]));
  sheet.cast.forEach((m, i) => {
    const text = norm(`${m.role} ${m.look} ${m.evidence.quote}`);
    const named = ids.find((id) => id !== start && names[id] && norm(names[id]!).length > 2 && text.includes(norm(names[id]!)));
    const at = named ?? (m.main || ids.length === 1 ? start : ids[(seed + i * 7) % ids.length]!);
    out[at]!.push(m.id);
  });
  return out;
}

/** The world for this card, in its shape. Never empty: a card with no places gets one scene. */
export function buildWorld(sheet: Pick<CardSheet, "shape" | "places" | "cast" | "modules" | "cardName">, seed: string): World {
  const s = hash(seed);
  const evAdded: Evidence = { source: "gambit", quote: "", verified: false };
  const raw = sheet.places.length
    ? sheet.places.map((p) => ({ id: p.id, name: p.name, description: p.description, evidence: p.evidence, added: !p.evidence.verified && p.evidence.source === "gambit" }))
    : [{ id: "here", name: sheet.cardName ? `${sheet.cardName}'s scene` : "Here", description: "Where the story is.", evidence: evAdded, added: true }];
  let shape = sheet.shape;
  if (raw.length === 1 && shape !== "delve") shape = "scene";

  const places: Record<string, WorldPlace> = {};
  for (const p of raw) {
    const text = `${p.name} ${p.description}`;
    places[p.id] = {
      id: p.id,
      name: p.name,
      description: p.description,
      exits: [],
      people: [],
      rest: REST.test(text),
      shop: sheet.modules.economy && SHOP.test(text),
      danger: sheet.modules.encounters && DANGER.test(text),
      delve: sheet.modules.delves && DELVE.test(text),
      added: p.added,
      evidence: p.evidence,
    };
  }
  const ids = raw.map((p) => p.id);
  const start = ids[0]!;
  const link = (a: string, b: string) => {
    if (a === b) return;
    if (!places[a]!.exits.includes(b)) places[a]!.exits.push(b);
    if (!places[b]!.exits.includes(a)) places[b]!.exits.push(a);
  };
  let route: string[] = [];
  switch (shape) {
    case "scene":
      break;
    case "town":
    case "frontier":
      // A hub with everything one step away (the lobby); frontier regions also touch their neighbours.
      for (const id of ids.slice(1)) link(start, id);
      if (shape === "frontier") for (let i = 1; i + 1 < ids.length; i++) link(ids[i]!, ids[i + 1]!);
      break;
    case "journey":
      route = ids;
      for (let i = 0; i + 1 < ids.length; i++) link(ids[i]!, ids[i + 1]!);
      break;
    case "delve": {
      // The way in, then the delve itself (room by room in delve.ts).
      for (let i = 0; i + 1 < ids.length; i++) link(ids[i]!, ids[i + 1]!);
      const deepest = ids[ids.length - 1]!;
      if (sheet.modules.delves) places[deepest]!.delve = true;
      break;
    }
  }
  // The start is where you can always rest; a delve shape always has a delve somewhere.
  places[start]!.rest = true;
  if (shape === "delve" && sheet.modules.delves && !ids.some((id) => places[id]!.delve)) places[ids[ids.length - 1]!]!.delve = true;
  const names = Object.fromEntries(ids.map((id) => [id, places[id]!.name]));
  const who = placePeople(sheet, ids, names, start, s);
  for (const id of ids) places[id]!.people = who[id] ?? [];
  return { v: 1, shape, start, places, route };
}

/** The menu of a place (6.1): talk, look around, go, rest, shop, fight, delve, wait. */
export function hotspotsOf(world: World, placeId: string, sheet: Pick<CardSheet, "cast" | "modules" | "skin">, present?: readonly string[]): Hotspot[] {
  const p = world.places[placeId];
  if (!p) return [];
  const out: Hotspot[] = [];
  const cast = new Map(sheet.cast.map((m) => [m.id, m]));
  for (const id of present ?? p.people) {
    const m = cast.get(id);
    if (m && sheet.modules.parley) out.push({ id: `talk:${id}`, kind: "talk", label: `Talk to ${m.name}`, target: id });
  }
  out.push({ id: "search", kind: "search", label: "Look around" });
  for (const to of p.exits) out.push({ id: `go:${to}`, kind: "exit", label: `Go to ${world.places[to]?.name ?? to}`, target: to });
  if (p.delve && sheet.modules.delves) out.push({ id: "delve", kind: "delve", label: `Explore ${p.name}` });
  if (p.danger && sheet.modules.encounters) out.push({ id: "fight", kind: "fight", label: fightLabel(sheet.skin.fight) });
  if (p.shop) out.push({ id: "shop", kind: "shop", label: "Shop" });
  if (p.rest) out.push({ id: "rest", kind: "rest", label: "Rest" });
  out.push({ id: "wait", kind: "wait", label: "Wait a while" });
  return out;
}

/* ------------------------------ scene state ---------------------------- */

/** "Look for a brawl"; a long skin word reads better as plain "fight". */
export const fightLabel = (fight: string | undefined): string => (fight && fight.trim().split(/\s+/).length <= 2 ? `Look for a ${fight.trim()}` : "Look for a fight");

export const TIMES = ["morning", "afternoon", "evening", "night"] as const;
export type TimeOfDay = (typeof TIMES)[number];

/** Where the player is in a chat's world (stored per chat). */
export interface SceneState {
  v: 1;
  placeId: string;
  visited: string[];
  day: number;
  /** Index into TIMES. */
  time: number;
  coin: number;
  /** Places searched today (a search per place per day). */
  searched: string[];
  /** Fact ids found by searching. */
  found: string[];
  /** Party HP carried between fights, as a fraction (1 = fresh). */
  vigor: number;
}

export function newScene(world: World, coin = 50): SceneState {
  return { v: 1, placeId: world.start, visited: [world.start], day: 1, time: 0, coin, searched: [], found: [], vigor: 1 };
}

const tick = (s: SceneState, n = 1): SceneState => {
  let time = s.time + n;
  let day = s.day;
  let searched = s.searched;
  while (time >= TIMES.length) {
    time -= TIMES.length;
    day += 1;
    searched = [];
  }
  return { ...s, time, day, searched };
};

export type SceneMove =
  | { kind: "go"; to: string }
  | { kind: "rest" }
  | { kind: "wait" };

/** Apply a move. Throws on an illegal one (no exit there). */
export function moveScene(world: World, s: SceneState, move: SceneMove): SceneState {
  switch (move.kind) {
    case "go": {
      const here = world.places[s.placeId];
      if (!here?.exits.includes(move.to)) throw new Error("There is no way there from here.");
      const visited = s.visited.includes(move.to) ? s.visited : [...s.visited, move.to];
      return { ...tick(s), placeId: move.to, visited };
    }
    case "rest": {
      if (!world.places[s.placeId]?.rest) throw new Error("This is no place to rest.");
      // Sleep to the next morning; rest restores the party.
      const steps = TIMES.length - s.time;
      return { ...tick(s, steps), vigor: 1 };
    }
    case "wait":
      return tick(s);
  }
}

/** A seeded d20 search: finds a hidden fact about someone here, or about the place, when the roll beats the DC. */
export function searchScene(world: World, s: SceneState, sheet: Pick<CardSheet, "facts" | "player">, seed: string): { scene: SceneState; roll: number; dc: number; factId: string | null } {
  if (s.searched.includes(s.placeId)) throw new Error("You have already searched here today.");
  const p = world.places[s.placeId]!;
  const hidden = sheet.facts.filter((f) => !f.known && !s.found.includes(f.id));
  const here = hidden.filter((f) => f.about.some((id) => p.people.includes(id)) || norm(f.text).includes(norm(p.name)));
  const pool = here.length ? here : hidden;
  const wits = Math.max(sheet.player.social.guile ?? 2, 0);
  const roll = (hash(`${seed}:${s.day}:${s.time}:${s.placeId}`) % 20) + 1;
  const dc = 10 + (pool[0]?.weight ?? 1) * 2;
  const hit = pool.length > 0 && roll + wits >= dc;
  const factId = hit ? pool[0]!.id : null;
  const scene = { ...tick(s), searched: [...s.searched, s.placeId], found: factId ? [...s.found, factId] : s.found };
  return { scene, roll, dc, factId };
}

/** The next stop of a journey, if any. */
export function nextStop(world: World, s: SceneState): string | null {
  const i = world.route.indexOf(s.placeId);
  return i >= 0 && i + 1 < world.route.length ? world.route[i + 1]! : null;
}
