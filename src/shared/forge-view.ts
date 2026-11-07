/**
 * What the class panel shows (docs/DESIGN.md 4.4, M7): the class book with
 * ranks, the Forge, fusion, awakening and the codex.
 */
import { applyAwakenings, AWAKEN_AT, classSheet, defOf, FUSE_RANK, MAX_RANK, RANK_WINS, rankOf, skillSheet, type ClassBook, type ClassSheet, type Codex, type OwnedClass, type SheetSkill } from "../engine/forge/forge.js";

export type ForgeOp =
  | "open" // send the panel
  | "use" // arg: class id → fight as it
  | "forge" // text: the description → preview
  | "fuse" // arg, arg2: two class ids → preview
  | "reroll" // the fusion preview, once, for a second catalyst
  | "awaken" // arg: skill id → three options
  | "pick" // arg: option index (awakening)
  | "confirm" // keep the forge or fusion preview
  | "decline" // drop the preview (refunds a fusion's catalyst)
  | "take"; // arg: codex id → into this campaign

export interface ForgeClassView {
  id: string;
  name: string;
  origin: "card" | "base" | "forged" | "fused" | "codex";
  rank: number;
  wins: number;
  /** Wins still needed for the next rank (0 at the top). */
  toNext: number;
  active: boolean;
  identity?: string;
  parents?: [string, string];
  art?: string;
  sheet: ClassSheet;
}

export interface ForgeView {
  chatId: string;
  crests: number;
  catalysts: number;
  fuseRank: number;
  awakenAt: number;
  classes: ForgeClassView[];
  /** Skills of the active class, with how close each is to awakening. */
  skills: { id: string; name: string; uses: number; ready: boolean; awakened: boolean }[];
  pending: {
    kind: "forge" | "fusion" | "awaken";
    sheet?: ClassSheet;
    options?: SheetSkill[];
    changes: string[];
    sim?: string;
    canReroll: boolean;
    art?: string;
  } | null;
  codex: { id: string; name: string; origin: "forged" | "fused"; card: string; parents?: [string, string]; owned: boolean; art?: string }[];
  busy: string | null;
}

const ORDER: Record<string, number> = { card: 0, forged: 1, fused: 2, codex: 3, base: 4 };

/** The panel's view of a class book (the backend and the preview both use it). */
export function buildForgeView(chatId: string, book: ClassBook, codex: Codex, artKey: (o: OwnedClass) => string, busy: string | null): ForgeView {
  const active = book.classes[book.active];
  const activeDef = active ? applyAwakenings(defOf(active), book.awakened) : null;
  const p = book.pending;
  return {
    chatId,
    crests: book.crests,
    catalysts: book.catalysts,
    fuseRank: FUSE_RANK,
    awakenAt: AWAKEN_AT,
    classes: Object.entries(book.classes)
      .sort(([, a], [, b]) => (ORDER[a.origin] ?? 9) - (ORDER[b.origin] ?? 9) || b.wins - a.wins)
      .map(([id, o]) => {
        const rank = rankOf(o.wins);
        const def = id === book.active && activeDef ? activeDef : defOf(o);
        return {
          id,
          name: o.origin === "card" ? `${def.name} (your card kit)` : def.name,
          origin: o.origin,
          rank,
          wins: o.wins,
          toNext: rank >= MAX_RANK ? 0 : rank * RANK_WINS - o.wins,
          active: id === book.active,
          ...(o.identity ? { identity: o.identity } : {}),
          ...(o.parents ? { parents: o.parents } : {}),
          art: artKey(o),
          sheet: classSheet(def),
        };
      }),
    skills: (activeDef?.skills ?? [])
      .filter((s) => !s.id.startsWith("combo_"))
      .map((s) => {
        const orig = Object.entries(book.awakened).find(([, v]) => v.id === s.id)?.[0];
        const uses = book.uses[orig ?? s.id] ?? 0;
        return { id: orig ?? s.id, name: s.name, uses, ready: !orig && uses >= AWAKEN_AT, awakened: !!orig };
      }),
    pending: p
      ? {
          kind: p.kind,
          ...(p.owned ? { sheet: classSheet(p.owned.def), ...(p.owned.art ? { art: p.owned.art } : {}) } : {}),
          ...(p.options ? { options: p.options.map(skillSheet) } : {}),
          changes: p.changes,
          ...(p.sim ? { sim: p.sim } : {}),
          canReroll: p.kind === "fusion" && !p.rerolled && book.catalysts > 0,
        }
      : null,
    codex: codex.entries.map((e) => ({ id: e.id, name: e.name, origin: e.origin, card: e.card, ...(e.parents ? { parents: e.parents } : {}), owned: !!book.classes[e.id], ...(e.art ? { art: e.art } : {}) })),
    busy,
  };
}
