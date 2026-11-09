/**
 * Which of the user's Lumiverse connections each Gambit model call uses
 * (docs/DESIGN.md 9). Pure: the backend (backend/models.ts) loads the
 * settings and the connection lists and walks the attempts this builds.
 *
 * Every text call has a role:
 *   reader    careful structured reads (card read, World Bible, armory,
 *             looks, class forging); may think first;
 *   narrator  prose (Parley replies, board and lore scenes, Meanwhile,
 *             promotions, the night);
 *   helper    small background answers (place from the chat, contest
 *             framing, typed answers when no Decision model answers).
 * A role with no connection picked uses the default connection; a picked
 * connection that is gone or fails falls back to the default.
 */

export type ModelRole = "reader" | "narrator" | "helper";
export const MODEL_ROLES: readonly ModelRole[] = ["reader", "narrator", "helper"];

/** Reasoning per role: auto (reader thinks when its model can; the rest do not), always on, or off. */
export type ReasoningPick = "auto" | "on" | "off";

export interface RoleChoice {
  /** A connection id; empty or missing means the default connection. */
  connectionId?: string | null;
  reasoning?: ReasoningPick;
}

export interface ModelSettings {
  v: 1;
  roles: Partial<Record<ModelRole, RoleChoice>>;
  /** Decision model: "auto" (a TypeSafe/Jev connection, else the default one), "off", or a decision connection id. */
  decision?: string;
  /** Embeddings: "auto" (the primary embedding connection), "off", or an embedding connection id. */
  embedding?: string;
}

export const defaultModelSettings = (): ModelSettings => ({ v: 1, roles: {} });

/** An LLM connection as routing sees it (the host's ConnectionProfileDTO, trimmed). */
export interface LlmConn {
  id: string;
  name: string;
  provider: string;
  model: string;
  isDefault: boolean;
  /** The connection's bound reasoning switch: true/false when it has a binding, null when it has none. */
  boundReasoning: boolean | null;
}

/** One way to make a call: a connection (undefined = the host's default) and whether to think. */
export interface Attempt {
  connectionId?: string;
  reasoning: boolean;
  /** Key for "this connection rejected reasoning" memory: the id, or "default". */
  key: string;
}

/** The ledger kind of a compiled answer -> its role. Unknown kinds are helpers. */
const KIND_ROLE: Record<string, ModelRole> = {
  "read-world": "reader",
  "read-people": "reader",
  bible: "reader",
  armory: "reader",
  "match-look": "reader",
  "describe-look": "reader",
  "figure-tags": "reader",
  forge: "reader",
  awaken: "reader",
  meanwhile: "narrator",
  afterglow: "narrator",
  "night-plain": "helper",
  promote: "narrator",
  "board-scene": "narrator",
  "lore-scene": "narrator",
  "place-from-chat": "helper",
  frame: "helper",
  typed: "helper",
};

export function roleForKind(kind: string): ModelRole {
  return KIND_ROLE[kind] ?? "helper";
}

/**
 * Model names that think when asked. Only a guess for connections with no
 * bound reasoning setting; a model that rejects reasoning is remembered and
 * asked without it from then on (backend/models.ts).
 */
const THINKERS = /(claude-(3[.-]7|sonnet-4|opus-4|haiku-4|4)|gemini-(2\.5|3)|deepseek-(r1|reasoner|v3\.[12])|\bo[134](-|$)|gpt-5|qwq|qwen3|thinking|reason|glm-4\.[5-9]|kimi-k2|grok-[34]|magistral)/i;

export function supportsReasoning(c: LlmConn | undefined): boolean {
  if (!c) return false;
  if (c.boundReasoning !== null) return c.boundReasoning;
  return THINKERS.test(c.model);
}

const isPick = (v: unknown): v is ReasoningPick => v === "auto" || v === "on" || v === "off";

/** Whatever is stored, as valid settings (unknown fields dropped). */
export function normalizeSettings(raw: unknown): ModelSettings {
  const out = defaultModelSettings();
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const roles = o.roles && typeof o.roles === "object" ? (o.roles as Record<string, unknown>) : {};
  for (const r of MODEL_ROLES) {
    const c = roles[r] && typeof roles[r] === "object" ? (roles[r] as Record<string, unknown>) : null;
    if (!c) continue;
    const id = typeof c.connectionId === "string" && c.connectionId.trim() ? c.connectionId.trim() : undefined;
    const reasoning = isPick(c.reasoning) ? c.reasoning : undefined;
    if (id || reasoning) out.roles[r] = { ...(id ? { connectionId: id } : {}), ...(reasoning ? { reasoning } : {}) };
  }
  if (typeof o.decision === "string" && o.decision.trim()) out.decision = o.decision.trim();
  if (typeof o.embedding === "string" && o.embedding.trim()) out.embedding = o.embedding.trim();
  return out;
}

/** Settings with a patch from the drawer applied (null or "" clears a field). */
export function patchSettings(s: ModelSettings, patch: { role?: ModelRole; connectionId?: string | null; reasoning?: ReasoningPick; decision?: string | null; embedding?: string | null }): ModelSettings {
  const next: ModelSettings = { v: 1, roles: { ...s.roles }, ...(s.decision ? { decision: s.decision } : {}), ...(s.embedding ? { embedding: s.embedding } : {}) };
  if (patch.role && MODEL_ROLES.includes(patch.role)) {
    const cur = { ...(next.roles[patch.role] ?? {}) };
    if ("connectionId" in patch) {
      if (patch.connectionId) cur.connectionId = patch.connectionId;
      else delete cur.connectionId;
    }
    if (patch.reasoning && isPick(patch.reasoning)) cur.reasoning = patch.reasoning;
    next.roles[patch.role] = cur;
  }
  if ("decision" in patch) {
    if (patch.decision && patch.decision !== "auto") next.decision = patch.decision;
    else delete next.decision;
  }
  if ("embedding" in patch) {
    if (patch.embedding && patch.embedding !== "auto") next.embedding = patch.embedding;
    else delete next.embedding;
  }
  return normalizeSettings(next);
}

/**
 * The attempts for one call, in order: the role's connection (or the default)
 * with reasoning as chosen; the same without reasoning when it was on; then
 * the default connection when the role had its own. `conns` null means the
 * list could not be read: a picked id is then trusted as it is. `noReasoning`
 * holds keys of connections that already rejected a reasoning request;
 * "auto" skips reasoning on those, an explicit "on" still tries it.
 */
export function attemptsFor(settings: ModelSettings, role: ModelRole, conns: readonly LlmConn[] | null, noReasoning: ReadonlySet<string> = new Set()): Attempt[] {
  const choice = settings.roles[role] ?? {};
  const pick = choice.reasoning ?? "auto";
  const def = conns?.find((c) => c.isDefault);
  const wanted = choice.connectionId ? (conns ? conns.find((c) => c.id === choice.connectionId) : ({ id: choice.connectionId, name: "", provider: "", model: "", isDefault: false, boundReasoning: null } as LlmConn)) : undefined;
  const think = (c: LlmConn | undefined, key: string): boolean => {
    if (pick === "off") return false;
    if (pick === "on") return true;
    return role === "reader" && supportsReasoning(c) && !noReasoning.has(key);
  };
  const out: Attempt[] = [];
  const push = (a: Attempt) => {
    if (!out.some((x) => x.connectionId === a.connectionId && x.reasoning === a.reasoning)) out.push(a);
  };
  const tryConn = (c: LlmConn | undefined, id: string | undefined) => {
    const key = id ?? "default";
    const r = think(c, key);
    push({ ...(id ? { connectionId: id } : {}), reasoning: r, key });
    if (r) push({ ...(id ? { connectionId: id } : {}), reasoning: false, key });
  };
  // A picked connection that is the default is just the default.
  if (wanted && !(def && wanted.id === def.id)) tryConn(wanted, wanted.id);
  tryConn(def, undefined);
  return out;
}

/** The host's per-request reasoning override for an attempt. A bound setting is respected when thinking. */
export function reasoningOverride(a: Attempt, conn?: LlmConn): { source: "off" } | { source: "inherit" } | { source: "custom"; apiReasoning: true; effort: "auto" } {
  if (!a.reasoning) return { source: "off" };
  if (conn?.boundReasoning) return { source: "inherit" };
  return { source: "custom", apiReasoning: true, effort: "auto" };
}

/** An error that means the caller gave up (a deadline or a cancel), so no fallback is tried. */
export function isAbort(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name ?? "";
  const msg = err instanceof Error ? err.message : String(err);
  return name === "AbortError" || name === "TimeoutError" || /abort|timed? ?out/i.test(msg);
}

/* ------------------------------ decisions ----------------------------- */

export interface DecisionConn {
  name?: string;
  id: string;
  provider: string;
  model: string;
  isDefault: boolean;
  hasKey: boolean;
}

/**
 * Which Decision connection to use: `{ use: false }` when off or there is
 * none; otherwise an id (undefined = the host's default). "auto" prefers a
 * TypeSafe/Jev connection, then the default, then any with a key.
 */
export function pickDecision(setting: string | undefined, conns: readonly DecisionConn[] | null): { use: boolean; id?: string } {
  if (setting === "off") return { use: false };
  if (setting && setting !== "auto") {
    if (!conns) return { use: true, id: setting };
    const c = conns.find((x) => x.id === setting);
    if (c) return { use: true, id: c.id };
  }
  if (!conns) return { use: false };
  const keyed = conns.filter((c) => c.hasKey);
  const best = keyed.find((c) => c.provider === "typesafe") ?? keyed.find((c) => /jev/i.test(c.model)) ?? keyed.find((c) => c.isDefault) ?? keyed[0];
  return best ? { use: true, id: best.id } : { use: false };
}

export interface EmbedConn {
  id: string;
  model: string;
  dimensions: number | null;
  enabled: boolean;
  primary: boolean;
}

/** The embedding connection to use: null when off or there is none. A picked one that is gone falls back to the primary. */
export function pickEmbedding<C extends EmbedConn>(setting: string | undefined, conns: readonly C[]): C | null {
  if (setting === "off") return null;
  const picked = setting && setting !== "auto" ? conns.find((c) => c.id === setting && c.enabled) : undefined;
  return picked ?? conns.find((c) => c.primary && c.enabled) ?? null;
}
