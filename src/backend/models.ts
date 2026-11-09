/**
 * Gambit's model calls through the user's Lumiverse connections (docs/DESIGN.md 9).
 *
 *   text       generate.quiet / quietStream with the role's connection and
 *              reasoning (meaning/models.ts), falling back to the default
 *              connection when the picked one fails;
 *   decisions  the Decision connection the user picked (or the best one);
 *   embeddings small texts embedded with the picked embedding connection,
 *              kept as 8-bit vectors in memory (meaning/lore-vectors.ts).
 *
 * Settings live in user storage (models.json). One instance per Spindle
 * API object, shared by every backend module (`modelsFor`).
 */
import type { DecisionAnswer, DecisionQuestion, EmbeddingConnectionDTO, GenerationResponseDTO, LlmMessageDTO, SpindleAPI } from "lumiverse-spindle-types";
import {
  attemptsFor,
  isAbort,
  MODEL_ROLES,
  normalizeSettings,
  patchSettings,
  pickDecision,
  pickEmbedding,
  reasoningOverride,
  type Attempt,
  type DecisionConn,
  type LlmConn,
  type ModelRole,
  type ModelSettings,
  type ReasoningPick,
} from "../meaning/models.js";
import { quantize, textHash, type PackedVec } from "../meaning/lore-vectors.js";
import type { ModelsState } from "../shared/protocol.js";

const SETTINGS = "models.json";
const CONN_TTL = 2 * 60_000;
const BACKOFF_MS = 3 * 60_000;
/** Decision questions per request: a long batch is split and asked in parallel. */
const DECISION_BATCH = 32;
const VEC_CACHE = 4000;

export interface TextRequest {
  messages: LlmMessageDTO[];
  parameters?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface Embedded {
  /** Connection + model key: vectors from different keys are never compared. */
  key: string;
  vecs: (PackedVec | null)[];
}

const errText = (err: unknown) => (err instanceof Error ? err.message : String(err));
const contentOf = (res: unknown): string => (typeof res === "string" ? res : ((res as GenerationResponseDTO | null)?.content ?? ""));

/** Finish reasons that mean the reply was cut off by the model or its provider, not finished. */
export const cutOff = (reason: string | undefined): boolean => !!reason && !/^(stop|end_turn|stop_sequence|length|max_tokens|tool_calls|eos)$/i.test(reason);

export function createModels(spindle: SpindleAPI) {
  const log = (m: string) => {
    try {
      spindle.log.info(`gambit models: ${m}`);
    } catch {
      /* best effort */
    }
  };
  const settingsCache = new Map<string, { at: number; s: ModelSettings }>();
  const llmCache = new Map<string, { at: number; list: LlmConn[] | null }>();
  const decCache = new Map<string, { at: number; list: DecisionConn[] | null }>();
  const embCache = new Map<string, { at: number; list: EmbeddingConnectionDTO[] }>();
  /** `${userId}:${key}`: connections that rejected a reasoning request. */
  const noReasoning = new Set<string>();
  const backoff = new Map<string, number>();
  const vecs = new Map<string, PackedVec>();

  async function settings(userId: string): Promise<ModelSettings> {
    const hit = settingsCache.get(userId);
    if (hit && Date.now() - hit.at < 30_000) return hit.s;
    const s = normalizeSettings(await spindle.userStorage.getJson<unknown>(SETTINGS, { fallback: {}, userId }).catch(() => ({})));
    settingsCache.set(userId, { at: Date.now(), s });
    return s;
  }

  async function llmConns(userId: string): Promise<LlmConn[] | null> {
    const hit = llmCache.get(userId);
    if (hit && Date.now() - hit.at < CONN_TTL) return hit.list;
    let list: LlmConn[] | null;
    try {
      list = (await spindle.connections.list(userId)).map((c) => ({
        id: c.id,
        name: c.name,
        provider: c.provider,
        model: c.model,
        isDefault: !!c.is_default,
        boundReasoning: c.reasoning_bindings ? !!c.reasoning_bindings.settings?.apiReasoning : null,
      }));
    } catch {
      list = null;
    }
    llmCache.set(userId, { at: Date.now(), list });
    return list;
  }

  async function decisionConns(userId: string): Promise<DecisionConn[] | null> {
    const hit = decCache.get(userId);
    if (hit && Date.now() - hit.at < CONN_TTL) return hit.list;
    let list: DecisionConn[] | null;
    try {
      list = spindle.decisions?.listConnections ? (await spindle.decisions.listConnections({ userId })).map((c) => ({ id: c.id, name: c.name, provider: c.provider, model: c.model, isDefault: !!c.is_default, hasKey: !!c.has_api_key })) : null;
    } catch {
      list = null;
    }
    decCache.set(userId, { at: Date.now(), list });
    return list;
  }

  async function embeddingConns(userId: string): Promise<EmbeddingConnectionDTO[]> {
    const hit = embCache.get(userId);
    if (hit && Date.now() - hit.at < CONN_TTL) return hit.list;
    let list: EmbeddingConnectionDTO[] = [];
    try {
      list = spindle.embeddings?.listConnections ? await spindle.embeddings.listConnections({ userId }) : [];
    } catch {
      list = [];
    }
    embCache.set(userId, { at: Date.now(), list });
    return list;
  }

  async function plan(userId: string, role: ModelRole): Promise<{ attempts: Attempt[]; conns: LlmConn[] | null }> {
    const [s, conns] = await Promise.all([settings(userId), llmConns(userId)]);
    const no = new Set([...noReasoning].filter((k) => k.startsWith(`${userId}:`)).map((k) => k.slice(userId.length + 1)));
    return { attempts: attemptsFor(s, role, conns, no), conns };
  }

  const connOf = (conns: LlmConn[] | null, a: Attempt) => (a.connectionId ? conns?.find((c) => c.id === a.connectionId) : conns?.find((c) => c.isDefault));
  const request = (userId: string, a: Attempt, conns: LlmConn[] | null, req: TextRequest) => ({
    type: "quiet" as const,
    messages: req.messages,
    ...(a.connectionId ? { connection_id: a.connectionId } : {}),
    reasoning: reasoningOverride(a, connOf(conns, a)),
    ...(req.parameters ? { parameters: req.parameters } : {}),
    userId,
    ...(req.signal ? { signal: req.signal } : {}),
  });
  const failed = (userId: string, role: ModelRole, a: Attempt, err: unknown, more: boolean) => {
    if (a.reasoning) noReasoning.add(`${userId}:${a.key}`);
    log(`${role}: ${a.connectionId ? `connection ${a.connectionId.slice(0, 8)}` : "the default connection"}${a.reasoning ? " with reasoning" : ""} failed (${errText(err).slice(0, 140)})${more ? "; trying the next" : ""}`);
  };

  /** One quiet call for a role; the text of the first attempt that answers. Throws the last error. */
  async function quiet(userId: string, role: ModelRole, req: TextRequest): Promise<string> {
    const { attempts, conns } = await plan(userId, role);
    let last: unknown = new Error("no connection to try");
    for (const [i, a] of attempts.entries()) {
      if (req.signal?.aborted) throw req.signal.reason ?? new Error("aborted");
      try {
        return contentOf(await spindle.generate.quiet(request(userId, a, conns, req) as never));
      } catch (err) {
        last = err;
        if (req.signal?.aborted || isAbort(err)) throw err;
        failed(userId, role, a, err, i + 1 < attempts.length);
      }
    }
    throw last;
  }

  /**
   * One streamed call for a role. `onToken` sees the text so far. Only an
   * attempt that failed before streaming anything falls back to the next;
   * one that broke mid-answer throws (the caller asks again or falls back).
   */
  async function stream(userId: string, role: ModelRole, req: TextRequest, onToken?: (text: string) => void): Promise<string> {
    const { attempts, conns } = await plan(userId, role);
    let last: unknown = new Error("no connection to try");
    for (const [i, a] of attempts.entries()) {
      if (req.signal?.aborted) throw req.signal.reason ?? new Error("aborted");
      let text = "";
      let got = false;
      try {
        for await (const chunk of spindle.generate.quietStream(request(userId, a, conns, req) as never)) {
          got = true;
          if (chunk.type === "token") text += chunk.token;
          else if (chunk.type === "done") {
            // A model that stopped itself (a safety block, Gemini's PROHIBITED_CONTENT) left half a reply: no reply.
            if (cutOff(chunk.finish_reason)) throw new Error(`the model stopped: ${chunk.finish_reason}`);
            if (chunk.content) text = chunk.content;
          }
          onToken?.(text);
        }
        return text;
      } catch (err) {
        last = err;
        if (got || req.signal?.aborted || isAbort(err)) throw err;
        failed(userId, role, a, err, i + 1 < attempts.length);
      }
    }
    throw last;
  }

  /** The Decision connection to use now, or null (off, none, or backing off after a failure). */
  async function decisionConnection(userId: string): Promise<{ id?: string } | null> {
    if (!spindle.decisions?.evaluate) return null;
    const [s, conns] = await Promise.all([settings(userId), decisionConns(userId)]);
    const p = pickDecision(s.decision, conns);
    return p.use ? (p.id ? { id: p.id } : {}) : null;
  }

  /**
   * Typed answers from the Decision model, or null when there is none, it
   * failed, or it ran past `ms`. Long batches are split. A non-timeout
   * failure backs off for a few minutes so callers go straight to code.
   */
  async function decide(userId: string, state: unknown, questions: Record<string, DecisionQuestion>, ms: number, what = "decision"): Promise<Record<string, DecisionAnswer | undefined> | null> {
    const ids = Object.keys(questions);
    if (!ids.length) return {};
    if ((backoff.get(`${userId}:decide`) ?? 0) > Date.now()) return null;
    const conn = await decisionConnection(userId);
    if (!conn) return null;
    const parts: string[][] = [];
    for (let i = 0; i < ids.length; i += DECISION_BATCH) parts.push(ids.slice(i, i + DECISION_BATCH));
    const t0 = Date.now();
    try {
      const results = await Promise.all(
        parts.map((part) =>
          spindle.decisions.evaluate(
            { state: state as never, questions: Object.fromEntries(part.map((id) => [id, questions[id]!])), userId, ...(conn.id ? { connection_id: conn.id } : {}) },
            { signal: AbortSignal.timeout(ms) },
          ),
        ),
      );
      log(`${what}: ${ids.length} question${ids.length === 1 ? "" : "s"} answered by ${results[0]?.model ?? "?"} in ${Date.now() - t0} ms`);
      return Object.assign({}, ...results.map((r) => r.answers)) as Record<string, DecisionAnswer | undefined>;
    } catch (err) {
      const msg = errText(err);
      log(`${what}: the decision model gave no answer (${msg.slice(0, 140)}); code decides`);
      if (!isAbort(err)) backoff.set(`${userId}:decide`, Date.now() + BACKOFF_MS);
      return null;
    }
  }

  async function embeddingConnection(userId: string): Promise<EmbeddingConnectionDTO | null> {
    const [s, conns] = await Promise.all([settings(userId), embeddingConns(userId)]);
    return pickEmbedding(s.embedding, conns.map((c) => ({ ...c, primary: c.is_primary })));
  }

  /**
   * Small texts as 8-bit vectors, from memory when embedded before. Null when
   * there is no embedding connection or the call fails or runs past `ms`.
   */
  async function embed(userId: string, texts: string[], opts: { ms: number; inputType?: "query" | "passage" }): Promise<Embedded | null> {
    if (!texts.length || !spindle.embeddings?.embed || (backoff.get(`${userId}:embed`) ?? 0) > Date.now()) return null;
    const conn = await embeddingConnection(userId);
    if (!conn) return null;
    const key = `${conn.id}:${conn.model}:${conn.dimensions ?? "n"}`;
    const type = opts.inputType ?? "passage";
    const k = (t: string) => `${key}:${type}:${textHash(t)}`;
    const want = [...new Set(texts.filter((t) => t.trim() && !vecs.has(k(t))))].slice(0, 256);
    if (want.length) {
      try {
        const res = await spindle.embeddings.embed({ texts: want.map((t) => t.slice(0, 8000)), connection_id: conn.id, input_type: type, userId }, { signal: AbortSignal.timeout(opts.ms) });
        want.forEach((t, i) => {
          const v = res.embeddings[i];
          if (v?.length) vecs.set(k(t), quantize(v));
        });
        while (vecs.size > VEC_CACHE) vecs.delete(vecs.keys().next().value!);
      } catch (err) {
        log(`embeddings: ${errText(err).slice(0, 140)}`);
        if (!isAbort(err)) backoff.set(`${userId}:embed`, Date.now() + BACKOFF_MS);
        return null;
      }
    }
    return { key, vecs: texts.map((t) => vecs.get(k(t)) ?? null) };
  }

  /** What the drawer shows: the settings and the connections to pick from. */
  async function state(userId: string): Promise<ModelsState> {
    const [s, llm, dec, emb] = await Promise.all([settings(userId), llmConns(userId), decisionConns(userId), embeddingConns(userId)]);
    return {
      roles: Object.fromEntries(MODEL_ROLES.map((r) => [r, { connectionId: s.roles[r]?.connectionId ?? null, reasoning: s.roles[r]?.reasoning ?? "auto" }])) as ModelsState["roles"],
      decision: s.decision ?? "auto",
      embedding: s.embedding ?? "auto",
      llm: (llm ?? []).map((c) => ({ id: c.id, name: c.name, model: c.model, isDefault: c.isDefault })),
      decisions: (dec ?? []).filter((c) => c.hasKey).map((c) => ({ id: c.id, name: c.name || c.model, model: c.model, isDefault: c.isDefault })),
      embeddings: emb.filter((c) => c.enabled).map((c) => ({ id: c.id, name: c.name, model: c.model, isDefault: c.is_primary })),
    };
  }

  async function update(userId: string, patch: { role?: ModelRole; connectionId?: string | null; reasoning?: ReasoningPick; decision?: string | null; embedding?: string | null }): Promise<ModelsState> {
    const next = patchSettings(await settings(userId), patch);
    await spindle.userStorage.setJson(SETTINGS, next, { userId });
    settingsCache.set(userId, { at: Date.now(), s: next });
    // A new pick gets a fresh chance: forget failures and the cached lists.
    for (const k of [...noReasoning]) if (k.startsWith(`${userId}:`)) noReasoning.delete(k);
    backoff.delete(`${userId}:decide`);
    backoff.delete(`${userId}:embed`);
    llmCache.delete(userId);
    decCache.delete(userId);
    embCache.delete(userId);
    return state(userId);
  }

  return { settings, quiet, stream, decide, decisionConnection, embeddingConnection, embed, state, update };
}

export type Models = ReturnType<typeof createModels>;

const shared = new WeakMap<object, Models>();
/** The one Models of this backend (every module shares its caches and backoffs). */
export function modelsFor(spindle: SpindleAPI): Models {
  let m = shared.get(spindle);
  if (!m) shared.set(spindle, (m = createModels(spindle)));
  return m;
}
