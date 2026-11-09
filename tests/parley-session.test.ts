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
function session(withReply?: string, end?: ParleyState["end"]) {
  const start = createParley(scenario, "fixed", CHAT);
  const judged = applyExchange(scenario, start, "Hundred, cash, now.", read).state;
  if (withReply) judged.exchanges[0] = { ...judged.exchanges[0]!, reply: withReply };
  if (end) judged.end = end;
  const file = `parley/${encodeURIComponent(judged.id)}.json`;
  const files = new Map<string, unknown>([
    [file, judged],
    [`parley/scene/${scenario.id}.json`, scenario],
    ["parley/current.json", { id: judged.id, chatId: CHAT }],
  ]);
  const sent: ToFrontend[] = [];
  // The chat as the host keeps it: the latest line carries its exchange in its metadata.
  const chat = [
    { id: "m0", role: "user", content: "How much for the net?", metadata: {} },
    { id: "m1", role: "user", content: "Hundred, cash, now.", metadata: { gambit: { parley: { id: judged.id, index: 0 } } } },
  ];
  const spindle = {
    log: { info() {}, warn() {}, error() {} },
    userStorage: {
      getJson: async (p: string, o: { fallback: unknown }) => (files.has(p) ? structuredClone(files.get(p)) : o.fallback),
      setJson: async (p: string, v: unknown) => void files.set(p, structuredClone(v)),
    },
    chat: { getMessages: async () => chat },
  };
  const art = new Proxy({}, { get: () => () => null });
  const parleys = createParleys(spindle as never, (m) => void sent.push(m), art as never);
  const ended: ParleyState[] = [];
  parleys.setEndHook((_u, _s, state) => void ended.push(state));
  /**
   * The chat is about to narrate this exchange: the interceptor briefs it and starts waiting for its reply. The prompt is
   * as a preset builds it: the latest line lifted out of the history into a block of its own, and no line's metadata.
   */
  const prompt = [
    { role: "system", content: "You are the narrator." },
    { role: "user", content: "How much for the net?", __isChatHistory: true, sourceMessageId: "m0" },
    { role: "user", content: "User's input: Hundred, cash, now." },
  ] as never[];
  const brief = () => parleys.intercept(prompt, { chatId: CHAT, userId: USER, generationType: "normal", isDryRun: false, interceptorDeadlineAt: Date.now() + 9000 } as never);
  const saved = () => files.get(file) as ParleyState;
  const replies = () => sent.filter((m): m is Extract<ToFrontend, { type: "parley.reply" }> => m.type === "parley.reply");
  return { parleys, id: judged.id, sent, ended, chat, brief, prompt, saved, replies };
}

describe("briefing the narrator", () => {
  test("the decided exchange is found on the chat's latest line, and its outcome goes last with the prompt left as it was", async () => {
    const s = session();
    const out = (await s.brief()) as { messages: { role: string; content: string }[] };
    expect(out.messages.slice(0, -1)).toEqual(s.prompt as never);
    expect(out.messages.at(-1)!.role).toBe("system");
    expect(out.messages.at(-1)!.content).toContain(scenario.npc.name);
    expect(s.parleys.awaitingIn(CHAT)).toBe(true);
  });

  test("once the line has its reply, only a swipe of that reply narrates it again", async () => {
    const s = session();
    s.chat.push({ id: "m2", role: "assistant", content: '"Fine," she says.', metadata: {} });
    const ctx = (generationType: string) => ({ chatId: CHAT, userId: USER, generationType, isDryRun: false, interceptorDeadlineAt: Date.now() + 9000 }) as never;
    await s.parleys.intercept(s.prompt, ctx("continue"));
    expect(s.parleys.awaitingIn(CHAT)).toBe(false);
    await s.parleys.intercept(s.prompt, ctx("swipe"));
    expect(s.parleys.awaitingIn(CHAT)).toBe(true);
  });
});

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

describe("how a Parley ended reaches the story", () => {
  test("only once the last reply is in, and only once", async () => {
    const s = session(undefined, { kind: "refused" });
    await s.brief();
    expect(s.ended).toEqual([]);
    await s.parleys.onGenerationEnded(CHAT, "\"No,\" she says, and shuts the door.", USER);
    expect(s.ended.map((e) => e.exchanges[0]!.reply)).toEqual(['"No," she says, and shuts the door.']);
    // A swipe writes the reply again; it doesn't happen again.
    await s.brief();
    await s.parleys.onGenerationEnded(CHAT, "\"Never,\" she says.", USER);
    expect(s.ended.length).toBe(1);
  });

  test("a stopped narration still tells it, with the written line", async () => {
    const s = session(undefined, { kind: "refused" });
    await s.brief();
    await s.parleys.onGenerationEnded(CHAT, "", USER);
    expect(s.ended.length).toBe(1);
    expect(s.ended[0]!.exchanges[0]!.reply?.length).toBeGreaterThan(0);
  });

  test("a talk still going tells nothing", async () => {
    const s = session();
    await s.brief();
    await s.parleys.onGenerationEnded(CHAT, "She thinks it over.", USER);
    expect(s.ended).toEqual([]);
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

describe("Gambit's own narrator", () => {
  /** A session on Gambit's narrator, with a model that answers from `script` in turn (an Error fails that call). */
  function narrated(script: (string | Error)[]) {
    const start = createParley(scenario, "fixed", CHAT);
    const files = new Map<string, unknown>([
      [`parley/${encodeURIComponent(start.id)}.json`, start],
      [`parley/scene/${scenario.id}.json`, scenario],
      ["parley/current.json", { id: start.id, chatId: CHAT }],
      ["settings.json", { parleyNarrator: "gambit" }],
    ]);
    const sent: ToFrontend[] = [];
    const posted: { role: string; content: string }[] = [];
    let calls = 0;
    const spindle = {
      log: { info() {}, warn() {}, error() {} },
      userStorage: {
        getJson: async (p: string, o: { fallback: unknown }) => (files.has(p) ? structuredClone(files.get(p)) : o.fallback),
        setJson: async (p: string, v: unknown) => void files.set(p, structuredClone(v)),
      },
      connections: { list: async () => ({ data: [], total: 0 }) },
      generate: {
        quiet: async () => {
          throw new Error("no referee in this test");
        },
        async *quietStream() {
          const next = script[calls++] ?? new Error("nothing left");
          if (next instanceof Error) throw next;
          yield { type: "token", token: next };
        },
      },
      chat: {
        appendMessage: async (_c: string, m: { role: string; content: string }) => (posted.push(m), { id: `m${posted.length}` }),
        updateMessage: async () => {},
      },
    };
    const art = new Proxy({}, { get: () => () => null });
    const parleys = createParleys(spindle as never, (m) => void sent.push(m), art as never, { retryMs: [1, 1] });
    const replies = () => sent.filter((m): m is Extract<ToFrontend, { type: "parley.reply" }> => m.type === "parley.reply" && m.final);
    const saved = () => files.get(`parley/${encodeURIComponent(start.id)}.json`) as ParleyState;
    return { parleys, id: start.id, posted, sent, replies, saved, calls: () => calls };
  }
  const LINE = "Hundred, cash, now.";

  test("a rate limit is tried again, and the real reply reaches the chat", async () => {
    const s = narrated([new Error("Vertex AI stream failed (429)"), '"Fine," she said.']);
    await s.parleys.say(USER, s.id, LINE);
    expect(s.calls()).toBe(2);
    expect(s.replies().at(-1)!.text).toContain("Fine");
    expect(s.posted.map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  test("when every model fails, the stand-in line stays out of the chat", async () => {
    const limited = new Error("Vertex AI stream failed (429)");
    const s = narrated([limited, limited, limited, limited]);
    await s.parleys.say(USER, s.id, LINE);
    expect(s.replies().at(-1)!.text.length).toBeGreaterThan(0);
    expect(s.posted.map((m) => m.role)).toEqual(["user"]);
  });

  test("the story hears the reply, and what it let slip counts in the talk from then on", async () => {
    const s = narrated(['"Those nets came off the Gull," she said.', '"Fine," she said.']);
    const known = new Set<string>();
    const heard: string[] = [];
    s.parleys.setStoryHook({
      heard: async (_u, _c, lines) => {
        heard.push(...lines.map((l) => l.content));
        known.add("stolen_nets");
      },
      known: async () => [...known],
    });
    await s.parleys.say(USER, s.id, LINE);
    await Bun.sleep(5);
    expect(heard).toEqual(['"Those nets came off the Gull," she said.']);
    const pushed = s.sent.filter((m): m is Extract<ToFrontend, { type: "parley.state" }> => m.type === "parley.state").at(-1);
    expect(pushed?.state.known).toContain("stolen_nets");
    await s.parleys.say(USER, s.id, "Those are the stolen nets off the wreck of the Gull. Ninety.");
    const ex = s.saved().exchanges[1]!;
    expect(ex.leverageFacts).toContain("stolen_nets");
    expect(ex.bluff).toBeNull();
  });

  test("an error that isn't a rate limit goes straight to the helper", async () => {
    const s = narrated([new Error("bad request"), '"Well," she said.']);
    await s.parleys.say(USER, s.id, LINE);
    expect(s.calls()).toBe(2);
    expect(s.posted.at(-1)!.content).toContain("Well");
  });
});
