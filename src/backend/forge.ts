/**
 * The class panel's backend (docs/DESIGN.md 4.4, M7): the class book of a
 * campaign, the Forge (a class from your words, for a Blank Crest), fusion
 * at the Altar (two rank-3 classes and a catalyst), skill awakening, and
 * the codex every campaign shares. Model answers go through the ledger;
 * everything that reaches a battle is sized and tested by code.
 */
import type { SpindleAPI } from "lumiverse-spindle-types";
import type { ArtApi } from "../art/controller.js";
import { dnaFromClass } from "../art/specs.js";
import { baseClassFor } from "../engine/card/foes.js";
import type { CardSheet } from "../engine/card/types.js";
import {
  addToCodex,
  applyAwakenings,
  AWAKEN_AT,
  awakenedSkill,
  balance,
  classFromDraft,
  countUses,
  defOf,
  fallbackAwakenings,
  fallbackForge,
  familiesOf,
  FUSE_RANK,
  fuseClasses,
  fromCodex,
  newBook,
  rankOf,
  restrictAtoms,
  type ClassBook,
  type Codex,
  type FusionDraft,
  type OwnedClass,
} from "../engine/forge/forge.js";
import { CLASSES } from "../engine/content/classes.js";
import type { BattleState, ClassDef, SkillDef } from "../engine/types.js";
import { awakenPrompt, forgePrompt, fusionPrompt, parseAwaken, parseForge, parseFusion } from "../meaning/forge.js";
import { buildForgeView, type ForgeOp, type ForgeView } from "../shared/forge-view.js";
import type { ToFrontend } from "../shared/protocol.js";
import { cardTag, type PlayRecord } from "../shared/scene-build.js";
import type { Ledger } from "./ledger.js";

const CODEX = "codex.json";

export interface ForgeDeps {
  spindle: SpindleAPI;
  send(msg: ToFrontend, userId: string): void;
  art: ArtApi;
  sheetFor(userId: string, chatId: string): Promise<CardSheet | null>;
  compile?: Ledger["compile"];
  load(userId: string, chatId: string): Promise<PlayRecord | null>;
  save(userId: string, chatId: string, r: PlayRecord): Promise<void>;
  aside(chatId: string, text: string): Promise<void>;
  log(m: string): void;
}

const seedOf = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** A campaign's class book; base classes added since it was made appear too. */
export function bookOf(r: PlayRecord): ClassBook {
  const b = (r.forge ??= newBook());
  for (const [id, def] of Object.entries(CLASSES)) b.classes[id] ??= { def, origin: "base", wins: 0, at: Date.now() };
  return b;
}

export function createForge(d: ForgeDeps) {
  const busy = new Set<string>();

  const codexOf = (userId: string) => d.spindle.userStorage.getJson<Codex>(CODEX, { fallback: { v: 1, entries: [] }, userId }).catch(() => ({ v: 1 as const, entries: [] }));
  const saveCodex = (userId: string, c: Codex) => d.spindle.userStorage.setJson(CODEX, c, { userId });

  /** Portrait key of an owned class: its own for made classes; the battle's class portrait for the rest. */
  const artKey = (sheet: CardSheet, o: OwnedClass): string => o.art ?? `class:${o.def.id.split("~")[0]}:${cardTag(sheet.cardKey)}.p_player`;

  function portrait(userId: string, sheet: CardSheet, o: OwnedClass, parents: string[], priority: 1 | 2): void {
    if (!o.art) return;
    const dna = dnaFromClass(o.def, { id: o.def.id, name: sheet.player.name || o.def.name, seed: seedOf(o.def.id) });
    d.art.request(o.art, { kind: "portrait", character: dna, ...(parents.length ? { parents: parents.map((imageId) => ({ imageId })) } : {}) }, priority, userId);
  }

  async function ask<T>(userId: string, kind: string, prompt: { system: string; user: string }, max: number, parse: (raw: Record<string, unknown>) => T | null, fallback: () => T, fresh = false): Promise<{ value: T; by: string }> {
    if (!d.compile) return { value: fallback(), by: "fallback" };
    const res = await d.compile(userId, kind, prompt, max, parse, fallback, { tries: 1, fresh });
    return { value: res.value, by: res.by };
  }

  async function view(userId: string, chatId: string, sheet: CardSheet, r: PlayRecord): Promise<ForgeView> {
    return buildForgeView(chatId, bookOf(r), await codexOf(userId), (o) => artKey(sheet, o), busy.has(`${userId}:${chatId}`) ? "The Architect is working…" : null);
  }

  async function push(userId: string, chatId: string, sheet: CardSheet, r: PlayRecord): Promise<void> {
    d.send({ type: "forge.state", chatId, view: await view(userId, chatId, sheet, r) }, userId);
    // Portraits the panel shows: made classes, and a preview's.
    const book = bookOf(r);
    for (const o of Object.values(book.classes)) if (o.art) portrait(userId, sheet, o, [], 2);
  }

  const warn = (userId: string, chatId: string, text: string) => d.send({ type: "notice", level: "warn", text, chatId }, userId);

  async function fusion(userId: string, sheet: CardSheet, book: ClassBook, a: OwnedClass, b: OwnedClass, salt: string, fresh: boolean): Promise<void> {
    const da = defOf(a);
    const db = defOf(b);
    const fam = familiesOf(da, db);
    const draft = (await ask<FusionDraft | null>(userId, "fusion", fusionPrompt(da, db, fam, sheet.skin.genre), 1400, (raw) => parseFusion(raw, da, db), () => null, fresh)).value;
    const seed = `${da.id}+${db.id}:${salt}`;
    const fused = fuseClasses(da, db, draft, seed);
    const tested = balance(fused.def, fused.changes);
    const owned: OwnedClass = { def: tested.def, origin: "fused", wins: 0, parents: [da.name, db.name], ...(draft?.identity ? { identity: draft.identity } : {}), art: `forge:${tested.def.id}`, at: Date.now() };
    const refs = [a, b].map((o) => d.art.status(artKey(sheet, o), userId)).filter((s) => s?.state === "ready" && s.imageId).map((s) => s!.imageId!);
    portrait(userId, sheet, owned, refs, 1);
    book.pending = { kind: "fusion", owned, changes: fused.changes, sim: tested.sim, rerolled: fresh };
  }

  /** One op from the panel. */
  async function act(userId: string, chatId: string, op: ForgeOp, arg?: string, arg2?: string, text?: string): Promise<void> {
    const sheet = await d.sheetFor(userId, chatId);
    const r = await d.load(userId, chatId);
    if (!sheet || !r) return warn(userId, chatId, "Open this chat's scene first.");
    const book = bookOf(r);
    const k = `${userId}:${chatId}`;
    if (busy.has(k) && op !== "open") return warn(userId, chatId, "Still working on the last one.");
    const work = async (fn: () => Promise<void>) => {
      busy.add(k);
      await push(userId, chatId, sheet, r);
      try {
        await fn();
      } finally {
        busy.delete(k);
      }
    };
    switch (op) {
      case "open":
        break;
      case "use": {
        if (!arg || !book.classes[arg]) return warn(userId, chatId, "No such class.");
        book.active = arg;
        break;
      }
      case "forge": {
        const t = (text ?? "").replace(/\s+/g, " ").trim().slice(0, 600);
        if (book.crests < 1) return warn(userId, chatId, "The Forge needs a Blank Crest. Finishing someone's questline turns one up.");
        if (t.length < 8) return warn(userId, chatId, "Describe the class in a sentence or two.");
        await work(async () => {
          const closest = baseClassFor(t);
          const res = await ask(userId, "forge", forgePrompt(t, sheet.skin.genre), 1600, (raw) => parseForge(raw, t), () => fallbackForge(t, closest));
          const notes = [...res.value.changes];
          const def = classFromDraft(res.value, `${chatId}:${t}`, notes);
          const tested = balance(def, notes);
          const owned: OwnedClass = { def: tested.def, origin: "forged", wins: 0, prompt: t, ...(res.value.identity ? { identity: res.value.identity } : {}), art: `forge:${tested.def.id}`, at: Date.now() };
          book.pending = { kind: "forge", owned, changes: notes, sim: tested.sim };
          portrait(userId, sheet, owned, [], 1);
          d.log(`forge on ${sheet.cardName}: ${def.name} (${res.by})`);
        });
        break;
      }
      case "fuse": {
        const a = arg ? book.classes[arg] : undefined;
        const b = arg2 ? book.classes[arg2] : undefined;
        if (!a || !b || arg === arg2) return warn(userId, chatId, "Pick two different classes.");
        if (rankOf(a.wins) < FUSE_RANK || rankOf(b.wins) < FUSE_RANK) return warn(userId, chatId, `Both classes need rank ${FUSE_RANK}. Win fights with them to raise it.`);
        if (book.catalysts < 1) return warn(userId, chatId, "Fusion needs a catalyst. Bosses and cleared delves leave them behind.");
        book.catalysts--;
        await work(async () => {
          await fusion(userId, sheet, book, a, b, `${chatId}:${Date.now().toString(36)}`, false);
          book.pending!.pair = [arg!, arg2!];
        });
        break;
      }
      case "reroll": {
        const p = book.pending;
        if (p?.kind !== "fusion" || !p.pair || p.rerolled) return warn(userId, chatId, "There is no fusion to reroll.");
        if (book.catalysts < 1) return warn(userId, chatId, "A reroll costs a second catalyst.");
        const [ia, ib] = p.pair;
        const a = book.classes[ia];
        const b = book.classes[ib];
        if (!a || !b) return;
        book.catalysts--;
        await work(async () => {
          await fusion(userId, sheet, book, a, b, `${chatId}:reroll:${Date.now().toString(36)}`, true);
          book.pending!.pair = [ia, ib];
          book.pending!.rerolled = true;
        });
        break;
      }
      case "awaken": {
        const active = book.classes[book.active];
        const cls = active ? defOf(active) : null;
        const skill = cls?.skills.find((s) => s.id === arg);
        if (!cls || !skill || !arg) return warn(userId, chatId, "That skill is not in your active class.");
        if (book.awakened[arg]) return warn(userId, chatId, `${skill.name} has already awakened.`);
        if ((book.uses[arg] ?? 0) < AWAKEN_AT) return warn(userId, chatId, `${skill.name} awakens after ${AWAKEN_AT} uses.`);
        await work(async () => {
          const solved = skill;
          const fam = familiesOf(cls);
          const changes: string[] = [];
          const drafts = (await ask(userId, "awaken", awakenPrompt(solved, cls, fam), 900, (raw) => parseAwaken(raw, solved), () => null)).value;
          const opts: SkillDef[] = (drafts ?? []).map((x) => awakenedSkill(solved, restrictAtoms(x.atoms, fam, changes, x.name), x.name, x.target, x.flavor)).filter((s) => s.atoms.length);
          for (const f of fallbackAwakenings(solved)) if (opts.length < 3 && !opts.some((o) => o.name === f.name)) opts.push(f);
          if (!drafts) changes.push("The Architect could not answer, so these mutations are built in code.");
          book.pending = { kind: "awaken", skillId: arg, options: opts.slice(0, 3), changes };
        });
        break;
      }
      case "pick": {
        const p = book.pending;
        const i = Number(arg);
        if (p?.kind !== "awaken" || !p.skillId || !p.options?.[i]) return warn(userId, chatId, "Nothing to pick.");
        book.awakened[p.skillId] = p.options[i]!;
        book.pending = null;
        await d.aside(chatId, `${sheet.player.name || "You"}'s ${p.options[i]!.name.split(":")[0]} awakens: ${p.options[i]!.name}.`);
        break;
      }
      case "confirm": {
        const p = book.pending;
        if (!p?.owned || (p.kind !== "forge" && p.kind !== "fusion")) return warn(userId, chatId, "Nothing to confirm.");
        if (p.kind === "forge") {
          if (book.crests < 1) return warn(userId, chatId, "The Forge needs a Blank Crest.");
          book.crests--;
        }
        const id = p.owned.def.id;
        book.classes[id] = p.owned;
        book.active = id;
        book.pending = null;
        const codex = await codexOf(userId);
        await saveCodex(userId, addToCodex(codex, { id, name: p.owned.def.name, origin: p.kind === "forge" ? "forged" : "fused", ...(p.owned.parents ? { parents: p.owned.parents } : {}), ...(p.owned.identity ? { identity: p.owned.identity } : {}), card: sheet.cardName, def: p.owned.def, ...(p.owned.art ? { art: p.owned.art } : {}), at: Date.now() }));
        const who = sheet.player.name || "You";
        await d.aside(chatId, p.kind === "forge" ? `${who} forge${sheet.player.name ? "s" : ""} a new way to fight: ${p.owned.def.name}.` : `At the altar, ${p.owned.parents?.join(" and ")} become one: ${p.owned.def.name}.`);
        break;
      }
      case "decline": {
        const p = book.pending;
        if (!p) break;
        if (p.kind === "fusion") book.catalysts++;
        book.pending = null;
        break;
      }
      case "take": {
        const codex = await codexOf(userId);
        const e = codex.entries.find((x) => x.id === arg);
        if (!e) return warn(userId, chatId, "That class is not in the codex.");
        book.classes[e.id] ??= fromCodex(e);
        break;
      }
    }
    await d.save(userId, chatId, r);
    await push(userId, chatId, sheet, r);
  }

  /**
   * What the player fights as. The card's kit is recorded in the book (so it
   * can be fused); the active class gets its awakened skills.
   */
  function playerClass(sheet: CardSheet, r: PlayRecord, cardDef: ClassDef): { def: ClassDef; art?: string } {
    const book = bookOf(r);
    const card = book.classes.card;
    book.classes.card = { def: cardDef, origin: "card", wins: card?.wins ?? 0, at: card?.at ?? Date.now() };
    const active = book.classes[book.active] ?? book.classes.card;
    const def = applyAwakenings(active.origin === "card" ? cardDef : defOf(active), book.awakened);
    return { def, ...(active.art ? { art: active.art } : {}) };
  }

  /** After a card battle: ranks, catalysts, and skills ready to awaken. Lines for the chat. */
  function afterBattle(r: PlayRecord, state: BattleState, boss: boolean): string[] {
    const book = bookOf(r);
    const lines: string[] = [];
    const ready = countUses(book, state.meta?.tally?.uses ?? {});
    if (state.outcome === "victory") {
      const o = book.classes[book.active];
      if (o) {
        const before = rankOf(o.wins);
        o.wins++;
        const after = rankOf(o.wins);
        if (after > before) lines.push(`${o.origin === "card" ? "Your card kit" : defOf(o).name} reaches rank ${after}${after >= FUSE_RANK ? " and can be fused" : ""}.`);
      }
      if (boss) {
        book.catalysts++;
        lines.push("Something glints where the fight ended: a catalyst.");
      }
    }
    const names = new Map((book.classes[book.active] ? defOf(book.classes[book.active]!).skills : []).map((s) => [s.id, s.name]));
    for (const id of ready) lines.push(`${names.get(id) ?? "A skill"} has been used ${AWAKEN_AT} times and can awaken.`);
    return lines;
  }

  return { act, playerClass, afterBattle, bookOf };
}
