/**
 * Ask the Referee about one argument, through the host (the backend cannot
 * fetch). Order of answerers (docs/DESIGN.md 2, 9):
 *   1. Jev, or any Decision model: `spindle.decisions.evaluate`, one batch,
 *      on the Decision connection picked in the drawer (backend/models.ts).
 *   2. The helper model imitating the typed answers (the "helper" role, JSON).
 *   3. Rules only.
 * A failed answerer is skipped for a while per user, so a missing Decision
 * connection does not cost a timeout on every line.
 *
 * While the Decision model reads, the line is also embedded next to the
 * earlier lines: a near-paraphrase counts as repetition (4.1.2 step 5)
 * even when it shares few words.
 */
import type { SpindleAPI } from "lumiverse-spindle-types";
import type { ParleyScenario, ParleyState, RefereeRead } from "../engine/parley/types.js";
import { meaningRepetition } from "../engine/parley/similarity.js";
import { cosine } from "../meaning/lore-vectors.js";
import { firstJson, readFromAnswers, refereeQuestions, refereeState, typedAnswers, typedPrompt, type Answers } from "../meaning/referee.js";
import { rulesRead } from "../meaning/rules.js";
import { modelsFor } from "./models.js";

const BACKOFF_MS = 3 * 60_000;
const skipUntil = new Map<string, number>();
const skipped = (k: string) => (skipUntil.get(k) ?? 0) > Date.now();
/** The repetition embedding may take this long; it runs alongside the read, so it costs no extra wait. */
const REPEAT_MS = 4000;

export interface JudgeOptions {
  /** Absolute time by which an answer is needed (interceptor deadline). */
  deadline?: number;
  log?: (msg: string) => void;
}

const budget = (deadline: number | undefined, wanted: number): number => (deadline ? Math.max(0, Math.min(wanted, deadline - Date.now() - 500)) : wanted);

/** 0..1: how closely the line repeats an earlier one in meaning; 0 without embeddings. */
async function meaningRepeat(spindle: SpindleAPI, userId: string, text: string, earlier: string[], ms: number): Promise<number> {
  if (!earlier.length || ms < 500) return 0;
  const e = await modelsFor(spindle).embed(userId, [text, ...earlier.slice(-12)], { ms }).catch(() => null);
  const [v, ...rest] = e?.vecs ?? [];
  if (!v) return 0;
  return meaningRepetition(rest.map((x) => (x ? cosine(Array.from(v.q), x) : null)));
}

export async function judge(spindle: SpindleAPI, scenario: ParleyScenario, state: ParleyState, text: string, userId: string, opts: JudgeOptions = {}): Promise<RefereeRead> {
  // The embedding starts with the read and is awaited after it.
  const repeating = meaningRepeat(spindle, userId, text, state.exchanges.map((e) => e.text), budget(opts.deadline, REPEAT_MS)).catch(() => 0);
  const read = await readOnly(spindle, scenario, state, text, userId, opts);
  const repeat = await repeating;
  return repeat > 0 ? { ...read, meaningRepeat: Math.round(repeat * 100) / 100 } : read;
}

async function readOnly(spindle: SpindleAPI, scenario: ParleyScenario, state: ParleyState, text: string, userId: string, opts: JudgeOptions): Promise<RefereeRead> {
  const models = modelsFor(spindle);
  const questions = refereeQuestions(scenario);
  const st = refereeState(scenario, state, text);
  const log = opts.log ?? (() => {});

  const jevKey = `${userId}:jev`;
  const jevMs = budget(opts.deadline, 14_000);
  const conn = await models.decisionConnection(userId);
  if (conn && !skipped(jevKey) && jevMs > 1500) {
    try {
      const result = await spindle.decisions.evaluate({ state: st as never, questions, userId, ...(conn.id ? { connection_id: conn.id } : {}) }, { signal: AbortSignal.timeout(jevMs) });
      log(`referee: answered by ${result.model}`);
      return readFromAnswers(scenario, result.answers as Answers, "jev");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`referee: decision model unavailable (${msg.slice(0, 160)}); using the helper model`);
      if (!/abort|timeout|timed out/i.test(msg)) skipUntil.set(jevKey, Date.now() + BACKOFF_MS);
    }
  }

  const helperKey = `${userId}:helper`;
  const helperMs = budget(opts.deadline, 20_000);
  if (!skipped(helperKey) && helperMs > 2500) {
    try {
      const { system, user } = typedPrompt(st, questions);
      const res = await models.quiet(userId, "helper", {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        parameters: { temperature: 0.1 },
        signal: AbortSignal.timeout(helperMs),
      });
      const raw = firstJson(res);
      if (raw) {
        const answers = typedAnswers(raw, questions);
        if (answers.tactic) return readFromAnswers(scenario, answers, "helper");
      }
      log("referee: helper reply had no usable answers; using rules");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`referee: helper model failed (${msg.slice(0, 160)}); using rules`);
      if (!/abort|timeout|timed out/i.test(msg)) skipUntil.set(helperKey, Date.now() + BACKOFF_MS);
    }
  }
  return rulesRead(scenario, text);
}

/** Forget backoffs (after the user changes connections, or in tests). */
export function resetRefereeBackoff(): void {
  skipUntil.clear();
}
