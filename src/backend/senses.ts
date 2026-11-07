/**
 * Play's cheap classifiers on the backend (docs/DESIGN.md 9): the Decision
 * model and embeddings where they help, the code rules when they are
 * missing, slow, or fail (meaning/senses.ts holds the questions and rules).
 * Everything here runs off the player's path: after a reply, after a fight,
 * when a place is added. The one exception, recall, is bounded by the
 * interceptor's deadline and gives up quietly.
 */
import type { SpindleAPI } from "lumiverse-spindle-types";
import type { Deed } from "../engine/memory/memory.js";
import { mentions } from "../engine/memory/memory.js";
import type { PlaceTraits, WorldPlace } from "../engine/world/places.js";
import { cosine } from "../meaning/lore-vectors.js";
import {
  bestSims,
  factCandidates,
  factQuestions,
  factsSeen,
  moralDeeds,
  noticeCandidates,
  noticeFromAnswers,
  noticeQuestions,
  placeQuestions,
  placeState,
  placeTraits,
  PLACES_PER_ASK,
  questQuestions,
  questsDone,
  reactionQuestions,
  reactionsFromAnswers,
  reactionState,
  recallPick,
  type CompanionLike,
  type FactLike,
  type NoticeCandidate,
  type StepLike,
} from "../meaning/senses.js";
import { modelsFor } from "./models.js";

/** A background classification may take this long; a reply-side one less. */
const DECIDE_MS = 10_000;
const EMBED_MS = 6000;

const cos = (a: readonly number[], b: readonly number[]) => cosine(a, { scale: 1, q: Int8Array.from(b) });

export interface ReplySense {
  /** Notice keys the player's line mentions. */
  mentions: string[];
  /** Hidden facts that came up in the chat. */
  facts: string[];
  /** Promotion keys whose next step the chat accomplished. */
  quests: string[];
  /** Who answered: the Decision model, or code. */
  by: "decision" | "code";
}

export function createSenses(spindle: SpindleAPI, log: (m: string) => void = () => {}) {
  const models = modelsFor(spindle);

  /**
   * Indoor / rest / shop / danger / delve for places still on the word rules,
   * a few places per request. Null when there is no Decision model answer.
   */
  async function classifyPlaces(userId: string, setting: string, places: readonly WorldPlace[]): Promise<Record<string, PlaceTraits> | null> {
    if (!places.length) return {};
    const parts: WorldPlace[][] = [];
    for (let i = 0; i < places.length && parts.length < 4; i += PLACES_PER_ASK) parts.push(places.slice(i, i + PLACES_PER_ASK));
    const results = await Promise.all(parts.map((part) => models.decide(userId, placeState(setting, part), placeQuestions(part), DECIDE_MS, "places")));
    if (results.every((r) => !r)) return null;
    const out: Record<string, PlaceTraits> = {};
    results.forEach((r, i) => r && Object.assign(out, placeTraits(r, parts[i]!)));
    return out;
  }

  /**
   * After a reply, one Decision request for three things: which names the
   * player's line mentions (the code rule finds candidates, the model drops
   * false ones and catches other forms), which hidden facts came up (the
   * closest by meaning when there are embeddings), and which quest steps the
   * chat just accomplished. Without a Decision answer each falls back to its
   * code rule (quests: none; searching the place still completes them).
   */
  async function afterReply(
    userId: string,
    input: { line: string; lines: string[]; known: NoticeCandidate[]; skip: string[]; facts: FactLike[]; steps: StepLike[] },
  ): Promise<ReplySense> {
    const found = input.line ? mentions(input.line, input.known, input.skip) : [];
    const candidates = input.line ? noticeCandidates(input.line, input.known, found) : [];
    // Facts by meaning: each fact's best cosine with a recent line.
    let sims: (number | null)[] | null = null;
    if (input.facts.length && input.lines.length) {
      const e = await models.embed(userId, [...input.facts.map((f) => f.text), ...input.lines], { ms: EMBED_MS });
      if (e) {
        const v = e.vecs.map((x) => (x ? Array.from(x.q) : null));
        sims = bestSims(v.slice(0, input.facts.length), v.slice(input.facts.length), cos);
      }
    }
    const facts = factCandidates(input.facts, sims, input.lines);
    const simOf = sims ? new Map(input.facts.map((f, i) => [f.id, sims![i] ?? -1])) : null;
    const steps = input.steps.slice(0, 4);
    const questions = { ...noticeQuestions(candidates), ...factQuestions(facts), ...questQuestions(steps) };
    const state = { player_line: input.line.slice(-1500), recent_chat: input.lines.map((l) => l.slice(-900)) };
    const answers = Object.keys(questions).length ? await models.decide(userId, state, questions, DECIDE_MS, "after reply") : null;
    return {
      mentions: answers ? noticeFromAnswers(answers, candidates, found) : found,
      facts: factsSeen(facts, answers, simOf, input.lines),
      quests: questsDone(answers, steps),
      by: answers ? "decision" : "code",
    };
  }

  /** -1/0/1 per companion for these deeds, or {} (the warmth rule decides) when there is no answer. */
  async function reactions(userId: string, companions: readonly CompanionLike[], deeds: readonly Deed[]): Promise<Record<string, number>> {
    if (!companions.length || !moralDeeds(deeds).length) return {};
    const answers = await models.decide(userId, reactionState(companions, deeds), reactionQuestions(companions), DECIDE_MS, "reactions");
    const out = reactionsFromAnswers(answers, companions);
    if (Object.keys(out).length) log(`reactions: ${companions.filter((c) => c.id in out).map((c) => `${c.name} ${out[c.id]! > 0 ? "+" : out[c.id]! < 0 ? "-" : "="}`).join(", ")}`);
    return out;
  }

  /**
   * The memories this line is about, by meaning (a few, or none). The
   * query is embedded as a search query, the memories as passages; both are
   * cached, so a long chat embeds each memory once.
   */
  async function recall(userId: string, query: string, memories: readonly string[], ms: number): Promise<string[]> {
    if (!query.trim() || !memories.length || ms < 400) return [];
    const [q, m] = await Promise.all([models.embed(userId, [query.slice(-2000)], { ms, inputType: "query" }), models.embed(userId, [...memories], { ms })]);
    const qv = q?.vecs[0];
    if (!qv || !m || q.key !== m.key) return [];
    const qa = Array.from(qv.q);
    return recallPick(m.vecs.map((v) => (v ? cosine(qa, v) : null))).map((i) => memories[i]!);
  }

  return { classifyPlaces, afterReply, reactions, recall };
}

export type Senses = ReturnType<typeof createSenses>;
