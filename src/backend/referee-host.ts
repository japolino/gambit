/**
 * Ask the Referee about one argument, through the host (the backend cannot
 * fetch). Order of answerers (docs/DESIGN.md 2, 9):
 *   1. Jev, or any Decision model: `spindle.decisions.evaluate`, one batch.
 *   2. The helper model imitating the typed answers (`generate.quiet`, JSON).
 *   3. Rules only.
 * A failed answerer is skipped for a while per user, so a missing Decision
 * connection does not cost a timeout on every line.
 */
import type { GenerationResponseDTO, SpindleAPI } from "lumiverse-spindle-types";
import type { ParleyScenario, ParleyState, RefereeRead } from "../engine/parley/types.js";
import { firstJson, readFromAnswers, refereeQuestions, refereeState, typedAnswers, typedPrompt, type Answers } from "../meaning/referee.js";
import { rulesRead } from "../meaning/rules.js";

const BACKOFF_MS = 3 * 60_000;
const skipUntil = new Map<string, number>();
const skipped = (k: string) => (skipUntil.get(k) ?? 0) > Date.now();

export interface JudgeOptions {
  /** Absolute time by which an answer is needed (interceptor deadline). */
  deadline?: number;
  log?: (msg: string) => void;
}

/** A Jev (TypeSafe) Decision connection when the user has one, else the default (undefined). */
const preferred = new Map<string, { id: string | undefined; at: number }>();
export async function preferredConnection(spindle: SpindleAPI, userId: string): Promise<string | undefined> {
  const hit = preferred.get(userId);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.id;
  let id: string | undefined;
  try {
    const list = await spindle.decisions.listConnections({ userId });
    id = list.find((c) => c.provider === "typesafe" && c.has_api_key)?.id ?? list.find((c) => /jev/i.test(c.model) && c.has_api_key)?.id;
  } catch {
    id = undefined;
  }
  preferred.set(userId, { id, at: Date.now() });
  return id;
}

const budget = (deadline: number | undefined, wanted: number): number => (deadline ? Math.max(0, Math.min(wanted, deadline - Date.now() - 500)) : wanted);

export async function judge(spindle: SpindleAPI, scenario: ParleyScenario, state: ParleyState, text: string, userId: string, opts: JudgeOptions = {}): Promise<RefereeRead> {
  const questions = refereeQuestions(scenario);
  const st = refereeState(scenario, state, text);
  const log = opts.log ?? (() => {});

  const jevKey = `${userId}:jev`;
  const jevMs = budget(opts.deadline, 14_000);
  if (!skipped(jevKey) && jevMs > 1500 && spindle.decisions?.evaluate) {
    try {
      const connection_id = await preferredConnection(spindle, userId);
      const result = await spindle.decisions.evaluate({ state: st as never, questions, userId, ...(connection_id ? { connection_id } : {}) }, { signal: AbortSignal.timeout(jevMs) });
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
      const res = (await spindle.generate.quiet({
        type: "quiet",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        reasoning: { source: "off" },
        parameters: { temperature: 0.1 },
        userId,
        signal: AbortSignal.timeout(helperMs),
      } as never)) as GenerationResponseDTO | string;
      const raw = firstJson(typeof res === "string" ? res : (res?.content ?? ""));
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
