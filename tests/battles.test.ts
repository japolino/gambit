import { describe, expect, test } from "bun:test";
import { createBattles } from "../src/backend/battles.js";
import { ENCOUNTERS, startEncounter } from "../src/engine/content/index.js";
import type { BattleState } from "../src/engine/types.js";
import type { ToFrontend } from "../src/shared/protocol.js";

const USER = "u";
const ENCOUNTER = Object.keys(ENCOUNTERS)[0]!;

/** A fight in a chat, the way play starts one. */
const fightIn = (chatId: string, seed: string): BattleState => ({ ...startEncounter(ENCOUNTER, seed), meta: { title: "A fight", chatId } } as BattleState);

function setup(files = new Map<string, unknown>()) {
  const sent: ToFrontend[] = [];
  const spindle = {
    userStorage: {
      getJson: async (p: string, o: { fallback: unknown }) => (files.has(p) ? structuredClone(files.get(p)) : o.fallback),
      setJson: async (p: string, v: unknown) => void files.set(p, structuredClone(v)),
    },
  };
  const battles = createBattles(spindle as never, (m) => void sent.push(m));
  const shown = () => sent.flatMap((m) => (m.type === "battle.state" ? [m.state.meta?.chatId ?? null] : []));
  return { battles, sent, shown };
}

describe("fights in two chats at once", () => {
  test("each chat resumes its own running fight", async () => {
    const s = setup();
    await s.battles.startState(USER, fightIn("A", "a"));
    await s.battles.startState(USER, fightIn("B", "b"));
    s.sent.length = 0;
    await s.battles.resume(USER, "A");
    await s.battles.resume(USER, "B");
    await s.battles.resume(USER, "C");
    expect(s.shown()).toEqual(["A", "B"]);
  });

  test("an older save's one fight belongs to the chat it was fought in", async () => {
    const old = fightIn("A", "old");
    const s = setup(new Map<string, unknown>([[`battles/${encodeURIComponent(old.id)}.json`, old], ["battles/current.json", { battleId: old.id }]]));
    await s.battles.resume(USER, "B");
    expect(s.shown()).toEqual([]);
    await s.battles.resume(USER, "A");
    expect(s.shown()).toEqual(["A"]);
  });
});
