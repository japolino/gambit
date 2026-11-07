/**
 * The answer ledger (docs/DESIGN.md 4.5): every model answer Gambit builds
 * the world from is stored by a hash of the question, so reloading or
 * replaying rebuilds the same world with zero model calls. Every answer goes
 * through a validator; a failed one is asked once more, then code falls back
 * (name tables, templates, base monsters). Junk JSON never breaks the world.
 */

type Raw = Record<string, unknown>;
export type AskModel = (prompt: { system: string; user: string }, maxTokens: number) => Promise<{ raw: Raw | null; ms: number; why?: string }>;

export interface LedgerStore {
  getJson<T>(path: string, opts: { fallback: T; userId: string }): Promise<T>;
  setJson(path: string, value: unknown, opts: { userId: string }): Promise<void>;
}

export interface Compiled<T> {
  value: T;
  /** Where the value came from: a stored answer, a fresh one (after `tries` asks), or code. */
  by: "ledger" | "model" | "fallback";
  tries: number;
  why?: string;
}

/** 64-bit FNV-1a, as hex: two 32-bit lanes with different offsets. */
export function questionHash(...parts: (string | number)[]): string {
  const s = parts.join("\u0001");
  let a = 2166136261;
  let b = 0x9747b28c;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 16777619);
    b = Math.imul(b ^ c, 16777619) ^ (b >>> 13);
  }
  return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
}

const kindSegment = (k: string) => k.replace(/[^a-z0-9_-]/gi, "_").slice(0, 40) || "answer";

export function createLedger(store: LedgerStore, ask: (userId: string) => AskModel, log: (m: string) => void = () => {}) {
  const path = (kind: string, hash: string) => `ledger/${kindSegment(kind)}/${hash}.json`;

  /**
   * Ask the model for one validated answer.
   * - `parse` turns raw JSON into the value, or null when it is unusable;
   * - `fallback` is the code answer when two asks fail;
   * - `fresh` skips a stored answer (a deliberate re-read) but still stores the new one.
   */
  async function compile<T>(
    userId: string,
    kind: string,
    prompt: { system: string; user: string },
    maxTokens: number,
    parse: (raw: Raw) => T | null,
    fallback: (why: string) => T,
    opts: { fresh?: boolean; tries?: number } = {},
  ): Promise<Compiled<T>> {
    const hash = questionHash(kind, prompt.system, prompt.user, maxTokens);
    if (!opts.fresh) {
      const stored = await store.getJson<{ raw?: Raw } | null>(path(kind, hash), { fallback: null, userId }).catch(() => null);
      if (stored?.raw) {
        const value = safeParse(parse, stored.raw);
        if (value !== null) return { value, by: "ledger", tries: 0 };
      }
    }
    const tries = Math.max(1, opts.tries ?? 2);
    let why = "no answer";
    for (let i = 1; i <= tries; i++) {
      const res = await ask(userId)(prompt, maxTokens);
      if (!res.raw) {
        why = res.why ?? "no readable JSON";
        log(`${kind}: ask ${i} failed (${why})`);
        continue;
      }
      const value = safeParse(parse, res.raw);
      if (value === null) {
        why = "the answer did not pass the checks";
        log(`${kind}: ask ${i} gave an unusable answer`);
        continue;
      }
      await store.setJson(path(kind, hash), { at: Date.now(), kind, raw: res.raw }, { userId }).catch(() => {});
      return { value, by: "model", tries: i };
    }
    return { value: fallback(why), by: "fallback", tries, why };
  }

  return { compile, path };
}

function safeParse<T>(parse: (raw: Raw) => T | null, raw: Raw): T | null {
  try {
    return parse(raw);
  } catch {
    return null;
  }
}

export type Ledger = ReturnType<typeof createLedger>;
