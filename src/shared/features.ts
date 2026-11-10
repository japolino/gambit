/**
 * Systems that are built, kept, and switched off. The game is one loop first: each day you choose who to see, and
 * what they know is won from them. These three stand beside that loop rather than in it, so they are out of the way
 * until it has been played enough to say whether they are missed. Nothing here is deleted: set one to true and it is
 * back, menu, panel and all.
 *
 *  - board:  the expedition board ("Explore <place>").
 *  - delves: room-by-room delves, and the "delve" card shape (such a card plays as a town).
 *  - forge:  the class panel (fusing classes, forging one from a sentence, awakening skills). Classes themselves stay:
 *            a fight uses the kit read from the card, or a base class.
 *
 * A plain object, so a test of one of these systems can switch it on for itself.
 */
export const FEATURES = { board: false, delves: false, forge: false };

/** A card's sheet as the game plays it with the switches above: no delves, and a delve-shaped card as a town. */
export function gateSheet<T extends { shape: string; modules: { delves: boolean } }>(sheet: T): T {
  if (FEATURES.delves) return sheet;
  if (sheet.shape !== "delve" && !sheet.modules.delves) return sheet;
  return { ...sheet, shape: sheet.shape === "delve" ? "town" : sheet.shape, modules: { ...sheet.modules, delves: false } };
}
