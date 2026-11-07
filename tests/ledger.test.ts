import { describe, expect, test } from "bun:test";
import { createLedger, questionHash } from "../src/backend/ledger.js";

function store() {
  const files = new Map<string, unknown>();
  return {
    files,
    getJson: async <T>(p: string, o: { fallback: T }) => (files.has(p) ? (structuredClone(files.get(p)) as T) : o.fallback),
    setJson: async (p: string, v: unknown) => void files.set(p, structuredClone(v)),
  };
}
const P = { system: "s", user: "u" };

describe("the answer ledger", () => {
  test("a stored answer is reused with no model call; a fresh read asks again", async () => {
    const st = store();
    let calls = 0;
    const ledger = createLedger(st, () => async () => (calls++, { raw: { n: calls }, ms: 1 }));
    const parse = (r: Record<string, unknown>) => (typeof r.n === "number" ? r.n : null);
    const a = await ledger.compile("u", "k", P, 100, parse, () => -1);
    const b = await ledger.compile("u", "k", P, 100, parse, () => -1);
    expect([a.by, a.value, b.by, b.value, calls]).toEqual(["model", 1, "ledger", 1, 1]);
    const c = await ledger.compile("u", "k", P, 100, parse, () => -1, { fresh: true });
    expect([c.by, c.value, calls]).toEqual(["model", 2, 2]);
    // The fresh answer replaced the stored one.
    expect((await ledger.compile("u", "k", P, 100, parse, () => -1)).value).toBe(2);
  });

  test("an unusable answer is asked once more, then code falls back", async () => {
    const st = store();
    const answers = [{ junk: true }, { n: 7 }];
    let calls = 0;
    const ledger = createLedger(st, () => async () => ({ raw: answers[calls++] ?? null, ms: 1 }));
    const parse = (r: Record<string, unknown>) => (typeof r.n === "number" ? r.n : null);
    const ok = await ledger.compile("u", "k2", P, 100, parse, () => -1);
    expect([ok.by, ok.value, ok.tries]).toEqual(["model", 7, 2]);
    const none = createLedger(store(), () => async () => ({ raw: null, ms: 1, why: "timeout" }));
    const fb = await none.compile("u", "k3", P, 100, parse, (why) => why.length);
    expect(fb.by).toBe("fallback");
    expect(fb.value).toBe("timeout".length);
  });

  test("a parser that throws counts as unusable, and different questions never share an answer", async () => {
    const ledger = createLedger(store(), () => async () => ({ raw: { n: 1 }, ms: 1 }));
    const r = await ledger.compile("u", "k", P, 100, () => { throw new Error("bad"); }, () => 0);
    expect(r.by).toBe("fallback");
    expect(questionHash("a", "b")).not.toBe(questionHash("ab", ""));
    expect(questionHash("x")).toHaveLength(16);
  });
});
