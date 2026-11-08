import { describe, expect, test } from "bun:test";
import { createParleys } from "../src/backend/parleys.js";
import { PARLEYS } from "../src/engine/content/parleys.js";
import { applyExchange, createParley } from "../src/engine/parley/exchange.js";
import type { ParleyScenario, ParleyState, RefereeRead } from "../src/engine/parley/types.js";
import type { ToFrontend } from "../src/shared/protocol.js";

const USER = "u";
const CHAT = "c";
const scenario: ParleyScenario = { ...PARLEYS.marta_nets!, id: "card_scene", card: { cardKey: "k", castId: "cast1", journalKey: "j" } };
const read: RefereeRead = { tactic: "logic", tacticP: { logic: 0.8 }, fit: 1.5, credibility: 1.5, temperament: 2, asserts: {}, otherClaim: 0, by: "rules" } as unknown as RefereeRead;

/** A session with one judged exchange saved, the way the backend finds it after a line was posted. */
function session(withReply?: string) {
  const start = createParley(scenario, "fixed", CHAT);
  const judged = applyExchange(scenario, start, "Hundred, cash, now.", read).state;
  if (withReply) judged.exchanges[0] = { ...judged.exchanges[0]!, reply: withReply };
  const file = `parley/${encodeURIComponent(judged.id)}.json`;
  const files = new Map<string, unknown>([
    [file, judged],
    [`parley/scene/${scenario.id}.json`, scenario],
    ["parley/current.json", { id: judged.id, chatId: CHAT }],
  ]);
  const sent: ToFrontend[] = [];
  const spindle = {
    log: { info() {}, warn() {}, error() {} },
    userStorage: {
      getJson: async (p: string, o: { fallback: unknown }) => (files.has(p) ? structuredClone(files.get(p)) : o.fallback),
      setJson: async (p: string, v: unknown) => void files.set(p, structuredClone(v)),
    },
  };
  const art = new Proxy({}, { get: () => () => null });
  const parleys = createParleys(spindle as never, (m) => void sent.push(m), art as never);
  const ended: ParleyState[] = [];
  parleys.setEndHook((_u, _s, state) => void ended.push(state));
  /** The chat is about to narrate this exchange: the interceptor briefs it and starts waiting for its reply. */
  const brief = () =>
    parleys.intercept(
      [{ role: "user", content: "Hundred, cash, now.", sourceMessageId: "m1", sourceMessageMetadata: { gambit: { parley: { id: judged.id, index: 0 } } } } as never],
      { chatId: CHAT, userId: USER, generationType: "normal", isDryRun: false, interceptorDeadlineAt: Date.now() + 9000 } as never,
    );
  const saved = () => files.get(file) as ParleyState;
  const replies = () => sent.filter((m): m is Extract<ToFrontend, { type: "parley.reply" }> => m.type === "parley.reply");
  return { parleys, id: judged.id, sent, ended, brief, saved, replies };
}

describe("the end of a narration", () => {
  test("a reply reaches the Parley and is kept", async () => {
    const s = session();
    await s.brief();
    await s.parleys.onGenerationEnded(CHAT, "\"Fine,\" she says.", USER);
    expect(s.replies().at(-1)).toMatchObject({ text: "\"Fine,\" she says.", final: true, index: 0 });
    expect(s.saved().exchanges[0]!.reply).toContain("Fine");
  });

  test("a stopped or failed narration still releases the input, with a written line", async () => {
    const s = session();
    await s.brief();
    await s.parleys.onGenerationEnded(CHAT, "", USER);
    const last = s.replies().at(-1)!;
    expect(last.final).toBe(true);
    expect(last.text.length).toBeGreaterThan(0);
    expect(s.saved().exchanges[0]!.reply).toBe(last.text);
  });

  test("stopping a swipe keeps the reply the exchange already had", async () => {
    const s = session("The old answer.");
    await s.brief();
    await s.parleys.onGenerationEnded(CHAT, undefined, USER);
    expect(s.replies().at(-1)).toMatchObject({ text: "The old answer.", final: true });
    expect(s.saved().exchanges[0]!.reply).toBe("The old answer.");
  });

  test("a later reply in the same chat is not taken for the exchange", async () => {
    const s = session();
    await s.brief();
    await s.parleys.onGenerationEnded(CHAT, "\"Fine,\" she says.", USER);
    const before = s.replies().length;
    s.parleys.onStreamToken(CHAT, "Back in the chat", false, USER);
    await s.parleys.onGenerationEnded(CHAT, "Back in the chat, later on.", USER);
    expect(s.replies().length).toBe(before);
    expect(s.saved().exchanges[0]!.reply).toContain("Fine");
  });
});

describe("closing a Parley", () => {
  test("a deal becomes a deed, once", async () => {
    const s = session();
    await s.parleys.close(USER, s.id, "deal");
    await s.parleys.close(USER, s.id, "deal");
    expect(s.ended.map((e) => e.end?.kind)).toEqual(["deal"]);
    expect(s.saved().end?.kind).toBe("deal");
  });

  test("walking away becomes a deed too", async () => {
    const s = session();
    await s.parleys.close(USER, s.id, "walk");
    expect(s.ended.map((e) => e.end?.kind)).toEqual(["walked"]);
  });

  test("two taps at once end it once", async () => {
    const s = session();
    await Promise.all([s.parleys.close(USER, s.id, "deal"), s.parleys.close(USER, s.id, "walk")]);
    expect(s.ended.map((e) => e.end?.kind)).toEqual(["deal"]);
    expect(s.saved().end?.kind).toBe("deal");
  });
});
