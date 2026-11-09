/**
 * What the Scene view shows, built from the chat's play record and the Card
 * Sheet (docs/DESIGN.md 6.1). Pure: the backend sends it, the preview page
 * and the tests build it the same way.
 */
import type { CardSheet } from "../engine/card/types.js";
import { roomAt, type DelveMap, type DelveState } from "../engine/world/delve.js";
import { fightLabel, hotspotsOf, TIMES, type Hotspot, type SceneState, type World } from "../engine/world/places.js";
import { hexKey, SUPPLY_MAX, TERRAIN_NAME, type HexMap, type HexState, type Terrain } from "../engine/world/hex.js";
import type { Thread } from "../meaning/bible.js";
import type { Adaptation, Deed, NpcMemory, Promotion, Recruit, Tally } from "../engine/memory/memory.js";
import { BOND_AT } from "../engine/memory/memory.js";
import type { ThreadEnd } from "../engine/story/beat.js";
import type { Scar } from "../meaning/night.js";
import type { ClassBook } from "../engine/forge/forge.js";

/** What the chat's world remembers (4.6, M6). */
export interface MemoryRecord {
  deeds: Deed[];
  /** Deeds before this index were read by a night phase already. */
  nightAt: number;
  tally: Tally;
  adapt: Record<string, Adaptation[]>;
  npc: Record<string, NpcMemory>;
  interest: Record<string, number>;
  promoted: Promotion[];
  recruits: Recruit[];
  scars: Record<string, Scar>;
  items: { name: string; description: string; from: string }[];
  rumors: string[];
  /** The last few montages, as written: tomorrow's narrator and tomorrow's night build on them. */
  nights?: { day: number; lines: string[] }[];
}

export const newMemory = (): MemoryRecord => ({ deeds: [], nightAt: 0, tally: { elements: {}, statuses: {}, talks: 0, hits: 0 }, adapt: {}, npc: {}, interest: {}, promoted: [], recruits: [], scars: {}, items: [], rumors: [] });

/** The art key of a place, following its scar when it has one (the edited painting). */
export function placeArt(sheet: CardSheet, r: PlayRecord, placeId: string): string {
  const scar = r.memory?.scars[placeId];
  return scar ? `${placeKey(sheet, placeId)}~${scar.flag}` : placeKey(sheet, placeId);
}
import { figureArtKey, npcArtKey, placeArtKey } from "./art-keys.js";
import type { BoardView, DelveView, Movement, SceneView, ThemeId } from "./scene-view.js";
import { type Board, CAMP_COST, key as boardKey, reachable, SUPPLY_CAP as BOARD_SUPPLY_CAP, TIER_COST } from "../engine/world/board.js";

export interface DayTalk {
  day: number;
  where: string;
  who: string;
  /** What the player said, in order. */
  said: string[];
  /** Their last answer. */
  reply: string;
  ended: string;
}

export interface PlayRecord {
  v: 1;
  cardKey: string;
  world: World;
  scene: SceneState;
  theme: ThemeId;
  log: string[];
  /** Lines written in the scene, and what came of them. */
  story?: { said: string; roll: string | null; reply: string; found?: string | null; day?: number; where?: string; /** The adult scene this beat is (play.ts SceneMeta id). */ scene?: string }[];
  /** How far the clock has run toward the next step of the day (engine/story/beat.ts). */
  spent?: number;
  /** The last day of the thread, and how it came out. */
  deadline?: number;
  threadEnd?: ThreadEnd;
  /** The montage has shown how the thread ended. */
  threadTold?: boolean;
  /** What was said in recent Parleys and how they ended: the night and the next day's narrator hold to it. */
  talks?: DayTalk[];
  /** The track each moment was given: a place keeps its theme. */
  music?: Record<string, string>;
  /** How many beats this chat has had: each rolls its own die, however many are kept. */
  beats?: number;
  delve?: { placeId: string; map: DelveMap; state: DelveState };
  /** The battle running for this chat, if any. */
  battleId?: string;
  /** Frontier cards: the honeycomb overland and where you stand on it. */
  hex?: { map: HexMap; state: HexState };
  /** When the World Bible last merged into this world (its `at`). */
  bibleAt?: number;
  /** The central thread, copied from the Bible, and the revelation ids found so far. */
  thread?: Thread;
  revealed?: string[];
  memory?: MemoryRecord;
  /** The class book (M7): classes, ranks, crests, catalysts, awakenings. */
  forge?: ClassBook;
  /** An expedition board under way (engine/world/board.ts), and what its last action did. */
  board?: Board;
  boardFx?: BoardView["fx"];
  boardStory?: BoardView["story"];
  /** CGs drawn for key moments (art keys), newest last. */
  album?: { key: string; caption: string; day: number }[];
  /** Lore ids opened on boards so far, so new boards deal fresh ones. */
  loreSpent?: string[];
  /** The adult scene a fight just offered (opt-in per chat): who with, and how the fight went. Gone once the scene moves on. */
  afterglow?: Afterglow;
  /** Adult scenes' lines by chat message id, so a swipe of one is written as the scene again (play.ts SceneMeta). */
  sceneLines?: Record<string, { id: string; partner: string; castId: string | null; won: boolean; look?: string }>;
}

export interface Afterglow {
  name: string;
  /** The card person they are, when they are one. */
  castId: string | null;
  won: boolean;
  /** How they look, for someone the card doesn't have. */
  look: string;
  day: number;
  placeId: string;
}

/** Where you stand: a place id, or the overland cell when it is not a place. */
export function spotOf(r: PlayRecord): string {
  return wildCell(r) && r.hex ? `wild:${r.hex.state.q},${r.hex.state.r}` : r.scene.placeId;
}

/** The offered adult scene still stands: same day, same spot. */
export function afterglowHere(r: PlayRecord): boolean {
  return !!r.afterglow && r.afterglow.day === r.scene.day && r.afterglow.placeId === spotOf(r);
}

/** The menu item an offered adult scene adds: the fight's winner sets the tone. */
export function afterglowLabel(a: Afterglow): string {
  return a.won ? `Claim ${a.name}` : `Give in to ${a.name}`;
}

const INDOOR = /(inn|tavern|shop|store|room|rooms|bar|cafe|café|parlou?r|hall|kitchen|library|office|apartment|bedroom|chamber|study|salon|lounge|club|pub|smithy|forge|bakery|apothecary|mess|quarters|house|home|manor|mansion|palace|castle)/i;
export const WILD_TEXT: Record<Terrain, string> = {
  plain: "Open country under a wide sky, the road a faint line through the grass",
  wood: "Close trees and deep shade, the path half lost",
  hill: "Windy hilltops with a long view of the land around",
  water: "Water",
  ruin: "Broken walls and old stones, overgrown and watchful",
};

/** The overland cell you stand on, when it is not a place. */
export function wildCell(r: PlayRecord): Terrain | null {
  if (!r.hex) return null;
  const c = r.hex.map.cells[hexKey(r.hex.state.q, r.hex.state.r)];
  return c && !c.place ? c.t : null;
}

/** The menu for where you are: a place's hotspots, or the wild's (camp, forage, fight). */
export function menuFor(sheet: CardSheet, r: PlayRecord): Hotspot[] {
  if (r.delve || r.board) return [];
  const t = wildCell(r);
  if (!t) {
    const out = hotspotsOf(r.world, r.scene.placeId, sheet);
    if (afterglowHere(r)) out.unshift({ id: "afterglow", kind: "talk", label: afterglowLabel(r.afterglow!) });
    const p = r.world.places[r.scene.placeId];
    // Out of doors, a place can be crossed on an expedition board; a delve has its own crawl.
    if (p && sheet.modules.places !== false && !p.delve && (p.danger || !(p.indoor ?? INDOOR.test(`${p.name} ${p.description}`)))) {
      const at = out.findIndex((h) => h.kind === "search");
      out.splice(at + 1, 0, { id: "explore", kind: "explore", label: `Explore ${p.name}` });
    }
    return out;
  }
  const out: Hotspot[] = [{ id: "forage", kind: "search", label: "Forage for supplies" }];
  if (afterglowHere(r)) out.unshift({ id: "afterglow", kind: "talk", label: afterglowLabel(r.afterglow!) });
  if (t !== "water") out.push({ id: "explore", kind: "explore", label: `Explore the ${TERRAIN_NAME[t].toLowerCase()}` });
  if (sheet.modules.encounters && (t === "wood" || t === "ruin" || t === "hill")) out.push({ id: "fight", kind: "fight", label: fightLabel(sheet.skin.fight) });
  out.push({ id: "camp", kind: "rest", label: "Make camp" }, { id: "wait", kind: "wait", label: "Wait a while" });
  return out;
}

export const cardTag = (cardKey: string) => cardKey.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase();
const tag = cardTag;
const MOVEMENT: Record<string, Movement> = { scene: "scene", town: "lobby", journey: "stops", frontier: "hex", delve: "scene" };

export function placeKey(sheet: CardSheet, placeId: string): string {
  return placeArtKey(`${tag(sheet.cardKey)}.${placeId}`);
}

/** Art key of a delve's tileable wall texture. */
export const wallKey = (sheet: CardSheet, placeId: string) => `tex:${tag(sheet.cardKey)}.${placeId}.wall`;

export function delveView(sheet: CardSheet, r: PlayRecord): DelveView | undefined {
  const d = r.delve;
  if (!d) return undefined;
  const { map, state } = d;
  const seen = new Set(state.seen);
  const grid = map.grid.map((row, y) => [...row].map((c, x) => (!seen.has(`${x},${y}`) ? "?" : c === "L" && state.opened.includes(`${x},${y}`) ? "." : c)).join(""));
  const cellAt = (x: number, y: number) => map.grid[y]?.[x] ?? "#";
  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];
  const f = state.facing;
  const lf = (f + 3) % 4;
  const rt = (f + 1) % 4;
  const view: DelveView["view"] = [];
  for (let i = 0; i <= 4; i++) {
    const x = state.x + DX[f]! * i;
    const y = state.y + DY[f]! * i;
    const c = cellAt(x, y);
    const open = state.opened.includes(`${x},${y}`);
    view.push({ ahead: c === "L" && open ? "." : c, left: cellAt(x + DX[lf]!, y + DY[lf]!), right: cellAt(x + DX[rt]!, y + DY[rt]!) });
    if (c === "#") break;
  }
  const here = roomAt(map, state.x, state.y);
  return {
    grid,
    x: state.x,
    y: state.y,
    facing: state.facing,
    keys: state.keys,
    rooms: map.rooms.filter((rm) => seen.has(rm.id)).map((rm) => ({ id: rm.id, x: rm.x, y: rm.y, kind: rm.kind, cleared: state.cleared.includes(rm.id) })),
    view,
    room: here ? { kind: here.kind, cleared: state.cleared.includes(here.id) } : null,
    moves: ["forward", "back", "left", "right", "search"],
    done: state.done,
    textures: { wall: wallKey(sheet, d.placeId), floor: "" },
    name: r.world.places[d.placeId]?.name ?? "The delve",
  };
}

export function buildSceneView(sheet: CardSheet, chatId: string, r: PlayRecord, busy?: string): SceneView {
  const p = r.world.places[r.scene.placeId]!;
  const wild = wildCell(r);
  const cast = new Map(sheet.cast.map((c) => [c.id, c]));
  const people = (wild ? [] : p.people)
    .map((id) => cast.get(id))
    .filter((m): m is NonNullable<typeof m> => !!m)
    .map((m) => ({ id: m.id, name: m.name, role: m.role, imageId: m.faces?.base ?? m.avatarImageId ?? null, art: npcArtKey(`${sheet.cardKey}:${m.id}`), figure: figureArtKey(sheet.cardKey, m.id) }));
  const movement: Movement = r.board ? "board" : r.delve ? "delve" : r.hex ? "hex" : (MOVEMENT[r.world.shape] ?? "scene");
  const others = Object.values(r.world.places).filter((q) => q.id !== p.id);
  return {
    chatId,
    cardName: sheet.cardName,
    theme: r.theme,
    shape: r.world.shape,
    movement,
    skin: { currency: sheet.skin.currency, fight: sheet.skin.fight, genre: sheet.skin.genre },
    place: wild
      ? { id: `wild_${wild}`, name: TERRAIN_NAME[wild], description: WILD_TEXT[wild], art: placeKey(sheet, `wild_${wild}`), added: true }
      : { id: p.id, name: p.name, description: r.memory?.scars[p.id] ? `${p.description}. ${r.memory.scars[p.id]!.note}` : p.description, art: placeArt(sheet, r, p.id), added: p.added },
    tiles: movement === "lobby" ? others.filter((q) => p.exits.includes(q.id)).map((q) => ({ id: q.id, name: q.name, art: placeArt(sheet, r, q.id) })) : [],
    route: r.world.route.map((id) => ({ id, name: r.world.places[id]?.name ?? id })),
    people,
    menu: menuFor(sheet, r),
    canFight: sheet.modules.encounters !== false,
    clock: { day: r.scene.day, time: TIMES[r.scene.time]! },
    coin: r.scene.coin,
    vigor: r.scene.vigor,
    log: r.log,
    story: r.story ?? [],
    ...(r.delve ? { delve: delveView(sheet, r)! } : {}),
    ...(r.board ? { board: boardView(sheet, r) } : {}),
    ...(r.hex ? { hex: hexView(r) } : {}),
    ...(r.thread ? { thread: { goal: r.thread.goal, found: r.thread.revelations.filter((x) => r.revealed?.includes(x.id)).map((x) => x.text), total: r.thread.revelations.length, ...(r.deadline !== undefined ? { daysLeft: Math.max(0, r.deadline - r.scene.day + 1) } : {}), ...(r.threadEnd ? { ended: r.threadEnd } : {}) } } : {}),
    hand: sheet.facts.filter((f) => f.known || r.scene.found.includes(f.id)).map((f) => ({ id: f.id, text: f.text })),
    // A Decision model's verdict when the place was judged (backend/senses.ts), else the word rule.
    indoor: !wild && !r.delve && (p.indoor ?? (p.shop || INDOOR.test(`${p.name} ${p.description}`))),
    journal: journalView(sheet, r),
    ...(busy ? { busy } : {}),
  };
}

/** Art key of a place seen from above as a board map (art kind "map"). */
export const boardMapKey = (sheet: CardSheet, placeId: string) => `map:${tag(sheet.cardKey)}.${placeId}`;

/** The board as the frontend sees it: rings on face-down tiles, the rest once they are turned. */
export function boardView(sheet: CardSheet, r: PlayRecord): BoardView {
  const b = r.board!;
  const reach = reachable(b);
  const m = b.party[b.active];
  const here = m ? b.cells[boardKey(m.q, m.r)] : undefined;
  const cast = new Map(sheet.cast.map((c) => [c.id, c]));
  const pend = b.pending ? b.cells[b.pending]?.lore : undefined;
  return {
    name: b.placeId.startsWith("wild_") ? (TERRAIN_NAME[b.placeId.slice(5) as Terrain] ?? "The wild") : (r.world.places[b.placeId]?.name ?? "The way"),
    map: boardMapKey(sheet, b.placeId),
    painting: b.placeId.startsWith("wild_") ? placeKey(sheet, b.placeId) : placeArt(sheet, r, b.placeId),
    cells: Object.entries(b.cells).map(([k, c]) => {
      const known = c.open || c.kind === "goal";
      return {
        k,
        q: c.q,
        r: c.r,
        ring: c.ring,
        open: c.open,
        kind: known ? c.kind : null,
        used: c.used,
        ...(c.open && c.stars ? { stars: c.stars } : {}),
        ...(c.open && c.lore ? { title: c.lore.title, lore: c.lore.kind, stars: c.lore.stars } : {}),
        reach: reach.has(k),
      };
    }),
    foes: b.foes.map((f) => ({ id: f.id, q: f.q, r: f.r })),
    party: b.party.map((p, i) => {
      const c = cast.get(p.id.replace(/^p_/, ""));
      const card = c?.faces?.base ?? c?.avatarImageId ?? null;
      return { id: p.id, name: p.name, q: p.q, r: p.r, imageId: card, ...(c ? { art: figureArtKey(sheet.cardKey, c.id) } : {}), active: i === b.active && !b.done };
    }),
    supplies: b.supplies,
    cap: BOARD_SUPPLY_CAP,
    round: b.round,
    goal: b.goal,
    start: b.start,
    ...(pend && b.pending ? { pending: { cell: b.pending, title: pend.title, kind: pend.kind, stars: pend.stars, costs: [TIER_COST[1], TIER_COST[2], TIER_COST[3]].slice(0, pend.stars) } } : {}),
    fight: !!b.fight,
    done: b.done,
    camp: { here: !!here && here.kind === "camp" && !here.used && !b.pending && !b.fight, cost: CAMP_COST },
    ...(r.boardStory ? { story: r.boardStory } : {}),
    fx: r.boardFx ?? [],
  };
}

function hexView(r: PlayRecord): NonNullable<SceneView["hex"]> {
  const { map, state } = r.hex!;
  // Places the world added later are known of before you reach them.
  const seen = new Set([...state.seen, ...Object.values(map.cells).filter((c) => c.place && c.known).map((c) => hexKey(c.q, c.r))]);
  return {
    cells: Object.values(map.cells).map((c) => ({
      q: c.q,
      r: c.r,
      placeId: c.place ?? null,
      name: c.place && seen.has(hexKey(c.q, c.r)) ? (r.world.places[c.place]?.name ?? null) : null,
      seen: seen.has(hexKey(c.q, c.r)),
      here: c.q === state.q && c.r === state.r,
      terrain: c.t,
    })),
    supplies: state.supplies,
    max: SUPPLY_MAX,
    wild: !!wildCell(r),
  };
}

export const feel = (a: number) => (a >= BOND_AT ? "devoted" : a >= 2 ? "warm" : a <= -5 ? "hostile" : a <= -2 ? "wary" : "neutral");

/** The Journal: what you did, what people remember, rumours, quests, items, and your companions. */
function journalView(sheet: CardSheet, r: PlayRecord): SceneView["journal"] {
  const m = r.memory;
  const album = (r.album ?? []).slice(-24).reverse();
  if (!m) return { deeds: [], rumors: [], people: [], quests: [], items: [], companions: [], album };
  const name = (id: string) => sheet.cast.find((c) => c.id === id)?.name ?? m.promoted.find((p) => p.castId === id)?.name ?? id;
  const main = sheet.cast.filter((c) => c.main);
  return {
    deeds: m.deeds.slice(-12).reverse().map((d) => `Day ${d.day}: ${d.kind.replace(/_/g, " ")} ${d.name}${d.n && d.n > 1 ? ` (${d.n})` : ""}${d.method ? `, with ${d.method}` : ""}`),
    rumors: m.rumors.slice(-6).reverse(),
    people: Object.entries(m.npc)
      .filter(([, v]) => v.notes.length)
      .map(([id, v]) => ({ id, name: name(id), feel: feel(v.affinity), notes: v.notes.slice(-3).map((n) => n.text) })),
    quests: m.promoted.map((p) => ({ name: p.name, dossier: p.dossier, steps: p.steps.map((s) => ({ text: s.text, where: r.world.places[s.where]?.name ?? s.where, done: s.done })), item: p.item.name, done: p.done })),
    items: m.items,
    companions: [
      ...main.map((c) => ({ id: c.id, name: c.name, affinity: m.npc[c.id]?.affinity ?? 0, bonded: (m.npc[c.id]?.affinity ?? 0) >= BOND_AT, recruit: false })),
      ...m.recruits.map((x) => ({ id: x.id, name: x.name, affinity: m.npc[x.id]?.affinity ?? 0, bonded: (m.npc[x.id]?.affinity ?? 0) >= BOND_AT, recruit: true })),
    ],
    album,
  };
}
