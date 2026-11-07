import { describe, expect, test } from "bun:test";
import { createVoice, prefsFor, speakable, voiceChoice } from "../src/frontend/voice.js";

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe("voice", () => {
  test("speakable strips markdown and trims at a sentence", () => {
    expect(speakable("*She smiles.* ![x](/api/v1/images/1) **Go** [on](http://a)")).toBe("She smiles. Go on");
    const long = "One sentence here. ".repeat(80);
    const out = speakable(long, 100);
    expect(out.length).toBeLessThanOrEqual(100);
    expect(out.endsWith(".")).toBe(true);
  });

  test("off by default, speaks once on, with the chosen connection", async () => {
    const calls: [string, string | undefined][] = [];
    const tts = { speak: async (i: { text: string }, o?: { connectionId?: string }) => void calls.push([i.text, o?.connectionId]), stop: () => {} };
    const store = mem();
    const v = createVoice(tts, store);
    v.say("Hello.");
    await Bun.sleep(1);
    expect(calls).toEqual([]);
    v.set({ on: true, connectionId: "fish" });
    v.say("Hello.");
    await Bun.sleep(1);
    expect(calls).toEqual([["Hello.", "fish"]]);
    expect(createVoice(tts, store).prefs()).toEqual({ on: true, connectionId: "fish" });
  });

  test("a failed line reports the permission, and a new queue replaces the old", async () => {
    let n = 0;
    const tts = { speak: async () => { n++; if (n === 1) throw new Error("Missing permission: media"); }, stop: () => {} };
    const v = createVoice(tts, mem());
    v.set({ on: true });
    v.queue(["a", "b"]);
    await Bun.sleep(1);
    expect(n).toBe(1);
    expect(v.lastError()).toContain("media permission");
    v.queue(["c", "d"]);
    await Bun.sleep(5);
    expect(n).toBe(3);
    expect(v.lastError()).toBeNull();
  });
});

describe("voice picker", () => {
  test("no voice, the default voice, or a connection", () => {
    expect(voiceChoice({ on: false, connectionId: "c1" })).toBe("");
    expect(voiceChoice({ on: true, connectionId: "" })).toBe("default");
    expect(voiceChoice({ on: true, connectionId: "c1" })).toBe("c1");
    expect(prefsFor("")).toEqual({ on: false, connectionId: "" });
    expect(prefsFor("default")).toEqual({ on: true, connectionId: "" });
    expect(prefsFor("c1")).toEqual({ on: true, connectionId: "c1" });
  });
});
