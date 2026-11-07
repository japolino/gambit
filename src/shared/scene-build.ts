/**
 * What the Scene view shows, built from the chat's play record and the Card
 * Sheet (docs/DESIGN.md 6.1). Pure: the backend sends it, the preview page
 * and the tests build it the same way.
 */
import type { CardSheet } from "../engine/card/types.js";
import { roomAt, type DelveMap, type DelveState } from "../engine/world/delve.js";
import { hotspotsOf, TIMES, type SceneState, type World } from "../engine/world/places.js";
import { npcArtKey, placeArtKey } from "./art-keys.js";
import type { DelveView, Movement, SceneView, ThemeId } from "./scene-view.js";

export interface PlayRecord {
  v: 1;
  cardKey: string;
  world: World;
  scene: SceneState;
  theme: ThemeId;
  log: string[];
  delve?: { placeId: string; map: DelveMap; state: DelveState };
  /** The battle running for this chat, if any. */
  battleId?: string;
}

export const cardTag = (cardKey: string) => cardKey.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase();
const tag = cardTag;
const MOVEMENT: Record<string, Movement> = { scene: "scene", town: "lobby", journey: "stops", frontier: "lobby", delve: "scene" };

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
  const cast = new Map(sheet.cast.map((c) => [c.id, c]));
  const people = p.people
    .map((id) => cast.get(id))
    .filter((m): m is NonNullable<typeof m> => !!m)
    .map((m) => ({ id: m.id, name: m.name, role: m.role, imageId: m.faces?.base ?? m.avatarImageId ?? null, art: npcArtKey(`${sheet.cardKey}:${m.id}`) }));
  const movement: Movement = r.delve ? "delve" : (MOVEMENT[r.world.shape] ?? "scene");
  const others = Object.values(r.world.places).filter((q) => q.id !== p.id);
  return {
    chatId,
    cardName: sheet.cardName,
    theme: r.theme,
    shape: r.world.shape,
    movement,
    skin: { currency: sheet.skin.currency, fight: sheet.skin.fight, genre: sheet.skin.genre },
    place: { id: p.id, name: p.name, description: p.description, art: placeKey(sheet, p.id), added: p.added },
    tiles: movement === "lobby" ? others.filter((q) => p.exits.includes(q.id)).map((q) => ({ id: q.id, name: q.name, art: placeKey(sheet, q.id) })) : [],
    route: r.world.route.map((id) => ({ id, name: r.world.places[id]?.name ?? id })),
    people,
    menu: r.delve ? [] : hotspotsOf(r.world, p.id, sheet),
    canFight: sheet.modules.encounters !== false,
    clock: { day: r.scene.day, time: TIMES[r.scene.time]! },
    coin: r.scene.coin,
    vigor: r.scene.vigor,
    log: r.log,
    ...(r.delve ? { delve: delveView(sheet, r)! } : {}),
    ...(busy ? { busy } : {}),
  };
}
