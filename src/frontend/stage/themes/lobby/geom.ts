/**
 * Where everything sits in the Lobby battle, from the stage size. Pure.
 *
 * Wide screens follow the lobby hall on a 1920x1080 design grid (`u` is one design pixel): the title cartouche
 * and the running log top left, the acting party member standing tall left of centre (the lobby's lead), the
 * turn order as pocket-watch lockets hanging along the top right, the enemies on the floor right of the lead,
 * the party's three framed cards bottom left (they cover the lead's legs), and the skill medallions bottom right.
 * Phones stack it: title, lockets, the enemies, the cards, the skills.
 */
import type { Rect, StageLayout } from "../../battle/layout.js";

export type LobbyGeom = {
  w: number;
  h: number;
  portrait: boolean;
  /** One design pixel (1080p = 1). */
  u: number;
  /** The stock UI scale (enemy plates, floating numbers). */
  ui: number;
  title: { x: number; y: number; s: number };
  /** Where the latest beat of the fight is written, as a subtitle. */
  sub: Rect;
  /** The acting party member, standing: centre x, feet y, figure height (wide screens only). */
  lead: { x: number; bottom: number; height: number } | null;
  order: Rect;
  cards: Rect[];
  menu: Rect;
  enemyArea: Rect;
  floorY: number;
  banner: { x: number; y: number };
};

/** Card proportions (the frame is drawn on a 250x364 grid). */
export const CARD_RATIO = 364 / 250;

export function lobbyGeom(w: number, h: number, partyCount: number): LobbyGeom {
  const portrait = w / h < 0.95;
  const n = Math.max(1, partyCount);
  if (portrait) {
    const u = Math.max(0.85, Math.min(1.7, w / 390));
    const ui = u;
    const m = Math.round(8 * u);
    const gap = Math.round(6 * u);
    const cw = (w - 2 * m - gap * (n - 1)) / n;
    const skillsH = Math.round(Math.max(150 * u, Math.min(196 * u, h * 0.24)));
    const ch = Math.round(Math.min(cw * CARD_RATIO, h * 0.23));
    const cardY = h - m - skillsH - gap - ch;
    const cards = Array.from({ length: n }, (_, i) => ({ x: m + i * (cw + gap), y: cardY, w: cw, h: ch }));
    const order: Rect = { x: m, y: Math.round(58 * u), w: w - 2 * m, h: Math.round(58 * u) };
    const top = order.y + order.h + Math.round(4 * u);
    const floorY = Math.round(cardY - 90 * u);
    return {
      w, h, portrait, u, ui,
      title: { x: m, y: Math.round(4 * u), s: u * 0.5 },
      sub: { x: m, y: top + Math.round(4 * u), w: w - 2 * m, h: Math.round(40 * u) },
      lead: null,
      order,
      cards,
      menu: { x: m, y: cardY + ch + gap, w: w - 2 * m, h: skillsH },
      enemyArea: { x: 0, y: top, w, h: Math.max(60, floorY - top) },
      floorY,
      banner: { x: w / 2, y: top + Math.round(26 * u) },
    };
  }
  const u = Math.min(w / 1920, h / 1080);
  const ui = Math.max(0.85, Math.min(1.35, Math.min(w / 1100, h / 760)));
  const cw = Math.round(212 * u);
  const ch = Math.round(cw * CARD_RATIO);
  const gap = Math.round(14 * u);
  const left = Math.round(30 * u);
  const cardY = Math.round(h - 18 * u - ch);
  const cards = Array.from({ length: n }, (_, i) => ({ x: left + i * (cw + gap), y: cardY, w: cw, h: ch }));
  const cardsRight = left + n * cw + (n - 1) * gap;
  const mw = Math.min(Math.round(1080 * u), w - Math.round(30 * u) - (cardsRight + Math.round(40 * u)));
  const menu: Rect = { x: w - Math.round(30 * u) - mw, y: Math.round(h - 392 * u), w: mw, h: Math.round(376 * u) };
  const leadX = Math.round(560 * u);
  const top = Math.round(160 * u);
  // One composition at every width: the enemies stand above the skills, the lockets hang centred over them.
  const enemyX = Math.round(880 * u);
  const floorY = Math.round(h - 432 * u);
  const enemyArea: Rect = { x: enemyX, y: top, w: w - enemyX - Math.round(30 * u), h: floorY - top };
  const ow = Math.round(780 * u);
  const order: Rect = { x: Math.round(Math.min(w - 30 * u - ow, enemyArea.x + enemyArea.w / 2 - ow / 2)), y: 0, w: ow, h: Math.round(150 * u) };
  const subW = Math.round(900 * u);
  const subX = enemyArea.x + enemyArea.w / 2 - subW / 2;
  return {
    w, h, portrait, u, ui,
    title: { x: Math.round(26 * u), y: Math.round(22 * u), s: u },
    sub: { x: Math.round(subX), y: Math.round(182 * u), w: subW, h: Math.round(60 * u) },
    lead: { x: leadX, bottom: Math.round(h + 10 * u), height: Math.round(960 * u) },
    order,
    cards,
    menu,
    enemyArea,
    floorY,
    banner: { x: enemyArea.x + enemyArea.w / 2, y: Math.round(250 * u) },
  };
}

/** The stage's layout from the same geometry. */
export function lobbyLayout(w: number, h: number, partyCount: number): StageLayout {
  const g = lobbyGeom(w, h, partyCount);
  const xs = g.cards.map((c) => c.x);
  const party: Rect = { x: Math.min(...xs), y: g.cards[0]!.y, w: Math.max(...g.cards.map((c) => c.x + c.w)) - Math.min(...xs), h: g.cards[0]!.h };
  return { w, h, portrait: g.portrait, ui: g.ui, enemyArea: g.enemyArea, floorY: g.floorY, timeline: g.order, party, cards: g.cards, menu: g.menu, banner: g.banner };
}
