import { expect, test } from "bun:test";
import { cutOff } from "../src/backend/models.js";
import { writeWithRetry } from "../src/backend/writing.js";

test("half a reply from a stream that was cut off is not a reply: the helper is asked, else nothing", async () => {
  const cut = async (_u: string, role: string, _r: unknown, on?: (t: string) => void) => {
    if (role === "helper") throw new Error("helper down");
    on?.("Her coils tighten sharply around his waist, the");
    throw new Error("the model stopped: SAFETY");
  };
  const opts = { retryMs: [], log: () => {} };
  expect(await writeWithRetry({ stream: cut } as never, "u", () => ({}) as never, () => {}, opts)).toBe("");
  const helped = async (_u: string, role: string, _r: unknown, on?: (t: string) => void) => {
    if (role === "helper") return "A whole reply.";
    return cut(_u, role, _r, on);
  };
  expect(await writeWithRetry({ stream: helped } as never, "u", () => ({}) as never, () => {}, opts)).toBe("A whole reply.");
});

test("a safety stop is a cut-off; a normal or length stop isn't", () => {
  expect(["SAFETY", "PROHIBITED_CONTENT", "content_filter"].map(cutOff)).toEqual([true, true, true]);
  expect(["stop", "length", "end_turn", undefined].map(cutOff)).toEqual([false, false, false, false]);
});
