/**
 * The card's places as a graph, laid out in the shape the reader picked
 * (docs/DESIGN.md 4.0, 4.5, 6.1). The graph stays under the hood: the
 * player moves through scene menus, a lobby, a next-stop strip, or a delve.
 * Pure and seeded: the same sheet and seed always build the same world.
 */
import type { CardSheet, Evidence, ShapeId } from "../card/types.js";
import { fold } from "../card/names.js";

export type HotspotKind = "talk" | "search" | "exit" | "rest" | "shop" | "fight" | "delve" | "wait" | "explore";

export interface Hotspot {
  id: string;
  kind: HotspotKind;
  label: string;
  /** Cast id (talk), place id (exit), foe id (fight). */
  target?: string;
  /** Doing this follows a lead of the thread: the person a missing piece is about, the place it is in, or the way there. */
  lead?: boolean;
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
  /** Indoors (under a roof): set when a Decision model judged the place; else scene code guesses from words. */
  indoor?: boolean;
  /** The flags came from a Decision model (backend/senses.ts), not the word rules. */
  judged?: boolean;
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

/** Where people live: a place like this isn't the delve, even at the bottom of the list. */
const SETTLED = /\b(town|village|city|settlement|surface|market|square|home)\b/i;

/** Where a delve-shaped world's delve goes when nothing says: the deepest of the card's own places that isn't where people live. */
function deepest(places: Readonly<Record<string, WorldPlace>>, start: string): string {
  const ids = Object.keys(places);
  const wild = [...ids].reverse().find((id) => {
    const p = places[id]!;
    return id !== start && !p.added && !p.shop && !SETTLED.test(`${p.name} ${p.description}`);
  });
  return wild ?? ids[ids.length - 1]!;
}

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
const norm = (s: string): string => fold(s).replace(/[^\p{L}\p{M}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim();

const TITLES = new Set(["sir", "lady", "lord", "dame", "sister", "brother", "father", "mother", "captain", "master", "mistress", "doctor", "the", "old", "young"]);

/** The words that name someone in a place's text: their full name, or a name word that isn't a title. */
function nameWords(name: string): string[] {
  const full = norm(name);
  return [full, ...full.split(" ").filter((w) => w.length > 3 && !TITLES.has(w))];
}

/**
 * Who is where: where the reader says they're found, else a person whose words name a place is there, then a person a place's own words name
 * ("the inn (Ysolde, the back room)"), then a person whose words use a word only one place's name has ("monarch of Valeria" for "Valeria
 * Kingdom"); the rest spread from the start, the main cast at the start. A smaller place wins over the start: everyone in a town is of the town.
 */
function placePeople(sheet: Pick<CardSheet, "cast">, places: readonly Pick<WorldPlace, "id" | "name" | "description" | "evidence">[], start: string, seed: number): Record<string, string[]> {
  const ids = places.map((p) => p.id);
  const out: Record<string, string[]> = Object.fromEntries(ids.map((id) => [id, [] as string[]]));
  const says = (text: string, word: string) => ` ${text} `.includes(` ${word} `);
  const texts = Object.fromEntries(places.map((p) => [p.id, norm(`${p.description} ${p.evidence.quote}`)]));
  const names = places.map((p) => {
    const full = norm(p.name);
    const own = full.split(" ").filter((w) => w.length > 3 && !TITLES.has(w) && places.every((q) => q.id === p.id || !norm(q.name).split(" ").includes(w)));
    return { id: p.id, full, own };
  });
  const pick = (ok: (n: (typeof names)[number]) => boolean) => names.find((n) => n.id !== start && ok(n))?.id ?? names.find((n) => n.id === start && ok(n))?.id;
  sheet.cast.forEach((m, i) => {
    const text = norm(`${m.role} ${m.look} ${m.evidence.quote}`);
    const words = nameWords(m.name);
    const at =
      (m.at && ids.includes(m.at) ? m.at : undefined) ??
      pick((n) => n.full.length > 2 && says(text, n.full)) ??
      ids.find((id) => words.some((w) => says(texts[id] ?? "", w))) ??
      pick((n) => n.own.some((w) => says(text, w))) ??
      (m.main || ids.length === 1 ? start : ids[(seed + i * 7) % ids.length]!);
    out[at]!.push(m.id);
  });
  return out;
}

/** A newer read of the card says where its people are: they go there, wherever play had them. Anyone the card doesn't have stays put. */
export function seatCast(world: World, sheet: Pick<CardSheet, "cast">, seed: string): World {
  const list = Object.values(world.places);
  const who = placePeople(sheet, list, world.start, hash(seed));
  const card = new Set(sheet.cast.map((m) => m.id));
  const places = Object.fromEntries(list.map((p) => [p.id, { ...p, people: [...p.people.filter((id) => !card.has(id)), ...(who[p.id] ?? [])] }]));
  return { ...world, places };
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
      if (sheet.modules.delves) places[deepest(places, start)]!.delve = true;
      break;
    }
  }
  // The start is where you can always rest.
  places[start]!.rest = true;
  const who = placePeople(sheet, Object.values(places), start, s);
  for (const id of ids) places[id]!.people = who[id] ?? [];
  return { v: 1, shape, start, places, route };
}

/**
 * Grow a built world by one place (4.5: the Bible's gap-fillers, places the
 * chat went to). It joins the shape: a town or frontier hangs it off the hub,
 * a journey adds it as the next stop, a delve shape goes deeper. `near`
 * links it to a place it sits next to as well. Returns the same world when
 * the place is already there.
 */
export function addPlace(
  world: World,
  sheet: Pick<CardSheet, "modules">,
  place: { id: string; name: string; description: string; evidence: Evidence; added?: boolean },
  near?: string,
): World {
  if (world.places[place.id]) return world;
  const text = `${place.name} ${place.description}`;
  const p: WorldPlace = {
    id: place.id,
    name: place.name,
    description: place.description,
    exits: [],
    people: [],
    rest: REST.test(text),
    shop: sheet.modules.economy && SHOP.test(text),
    danger: sheet.modules.encounters && DANGER.test(text),
    delve: sheet.modules.delves && DELVE.test(text),
    added: place.added ?? !place.evidence.verified,
    evidence: place.evidence,
  };
  const places: Record<string, WorldPlace> = Object.fromEntries(Object.entries(world.places).map(([k, v]) => [k, { ...v, exits: [...v.exits] }]));
  places[p.id] = p;
  const link = (a: string, b: string) => {
    if (a === b || !places[a] || !places[b]) return;
    if (!places[a]!.exits.includes(b)) places[a]!.exits.push(b);
    if (!places[b]!.exits.includes(a)) places[b]!.exits.push(a);
  };
  let shape = world.shape;
  let route = world.route;
  // A one-place scene that gains a second place becomes a small town.
  if (shape === "scene") shape = "town";
  switch (shape) {
    case "town":
    case "frontier":
      link(world.start, p.id);
      break;
    case "journey": {
      const last = route[route.length - 1] ?? world.start;
      link(last, p.id);
      route = [...(route.length ? route : [world.start]), p.id];
      break;
    }
    case "delve": {
      const ids = Object.keys(world.places);
      link(ids[ids.length - 1] ?? world.start, p.id);
      break;
    }
  }
  if (near) link(near, p.id);
  return { ...world, shape, places, route };
}

/** What a Decision model said about a place (meaning/senses.ts); the word rules above are the fallback. */
export interface PlaceTraits {
  indoor: boolean;
  rest: boolean;
  shop: boolean;
  danger: boolean;
  delve: boolean;
}

/** Places whose flags still come from the word rules. */
export const unjudged = (world: World): WorldPlace[] => Object.values(world.places).filter((p) => !p.judged);

/**
 * Judged traits replace the word rules' flags, inside the same limits: the
 * modules gate shops, danger and delves, the start is always a place to
 * rest, and a delve-shaped world keeps a delve somewhere.
 */
export function applyTraits(world: World, sheet: Pick<CardSheet, "modules">, traits: Readonly<Record<string, PlaceTraits>>): World {
  let changed = false;
  const places: Record<string, WorldPlace> = { ...world.places };
  for (const [id, t] of Object.entries(traits)) {
    const p = places[id];
    if (!p) continue;
    changed = true;
    places[id] = {
      ...p,
      indoor: t.indoor,
      rest: t.rest || id === world.start,
      shop: sheet.modules.economy && t.shop,
      danger: sheet.modules.encounters && t.danger,
      delve: sheet.modules.delves && t.delve,
      judged: true,
    };
  }
  if (!changed) return world;
  if (world.shape === "delve" && sheet.modules.delves && !Object.values(places).some((p) => p.delve)) {
    const id = deepest(places, world.start);
    places[id] = { ...places[id]!, delve: true };
  }
  return { ...world, places };
}

/** The menu of a place (6.1): talk, look around, go, rest, shop, fight, delve, wait. */
export function hotspotsOf(world: World, placeId: string, sheet: Pick<CardSheet, "cast" | "modules" | "skin">, present?: readonly string[]): Hotspot[] {
  const p = world.places[placeId];
  if (!p) return [];
  const out: Hotspot[] = [];
  const cast = new Map(sheet.cast.map((m) => [m.id, m]));
  for (const id of present ?? p.people) {
    const m = cast.get(id);
    if (m) out.push({ id: `talk:${id}`, kind: "talk", label: `Talk to ${m.name}`, target: id });
  }
  out.push({ id: "search", kind: "search", label: "Look around" });
  for (const to of p.exits) out.push({ id: `go:${to}`, kind: "exit", label: `Go to ${world.places[to]?.name ?? to}`, target: to });
  if (p.delve && sheet.modules.delves) out.push({ id: "delve", kind: "delve", label: `Explore ${p.name}` });
  if (p.danger && sheet.modules.encounters) out.push({ id: "fight", kind: "fight", label: fightLabel(sheet.skin.fight) });
  if (p.shop) out.push({ id: "shop", kind: "shop", label: "Shop" });
  // The day can always be ended in one step: in a bed where there is one, on the ground where there isn't.
  out.push(p.rest ? { id: "rest", kind: "rest", label: "Rest" } : { id: "roughit", kind: "rest", label: "Sleep rough until morning" });
  out.push({ id: "wait", kind: "wait", label: "Wait a while" });
  return out;
}

/* ------------------------------ scene state ---------------------------- */

/** "Look for a brawl", "Look for an ambush"; a long skin word reads better as plain "fight". */
export const fightLabel = (fight: string | undefined): string => {
  const word = fight?.trim() ?? "";
  if (!word || word.split(/\s+/).length > 2) return "Look for a fight";
  return `Look for ${/^[aeiou]/i.test(word) ? "an" : "a"} ${word}`;
};

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

/** The chat says what time it is: later today, or tomorrow if that time has passed. */
export function clockTo(s: SceneState, time: number): SceneState {
  return tick(s, (time - s.time + TIMES.length) % TIMES.length);
}

/**
 * The chat says who is at this place. Someone here isn't anywhere else; someone gone is at another place they're
 * known at, or next door, so they can still be found.
 */
export function seatPeople(world: World, placeId: string, here: readonly string[], away: readonly string[]): World {
  if (!world.places[placeId] || (!here.length && !away.length)) return world;
  const places: Record<string, WorldPlace> = {};
  for (const [id, p] of Object.entries(world.places)) places[id] = { ...p, people: id === placeId ? p.people.filter((m) => !away.includes(m)) : p.people.filter((m) => !here.includes(m)) };
  const at = places[placeId]!;
  places[placeId] = { ...at, people: [...at.people, ...here.filter((m) => !at.people.includes(m))] };
  for (const m of away) {
    if (Object.values(places).some((p) => p.people.includes(m))) continue;
    const other = at.exits.find((id) => places[id]) ?? Object.keys(places).find((id) => id !== placeId);
    if (other) places[other] = { ...places[other]!, people: [...places[other]!.people, m] };
  }
  return { ...world, places };
}

/** Sleep to the next morning anywhere (a camp in the wild); `vigor` is what the night restores to. */
export function sleepScene(s: SceneState, vigor = 1): SceneState {
  return { ...tick(s, TIMES.length - s.time), vigor: Math.max(s.vigor, vigor) };
}

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

/** A seeded d20 search: finds a hidden fact about someone here, or about the place, when the roll beats the DC. The time it takes runs on the story clock (play.ts). */
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
  const scene = { ...s, searched: [...s.searched, s.placeId], found: factId ? [...s.found, factId] : s.found };
  return { scene, roll, dc, factId };
}

/** The next stop of a journey, if any. */
export function nextStop(world: World, s: SceneState): string | null {
  const i = world.route.indexOf(s.placeId);
  return i >= 0 && i + 1 < world.route.length ? world.route[i + 1]! : null;
}
