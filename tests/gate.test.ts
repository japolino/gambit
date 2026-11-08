import { describe, expect, test } from "bun:test";
import { createGate } from "../src/backend/gate.js";

describe("the per-chat action gate", () => {
  test("drops a second action while the first runs", async () => {
    const gate = createGate();
    let release = () => {};
    const ran: string[] = [];
    const first = gate.run("chat", () => new Promise<void>((r) => { ran.push("first"); release = r; }));
    expect(await gate.run("chat", async () => void ran.push("second"))).toBe(false);
    release();
    expect(await first).toBe(true);
    expect(ran).toEqual(["first"]);
  });

  test("lets the next action through once the first is done, even if it failed", async () => {
    const gate = createGate();
    await gate.run("chat", async () => { throw new Error("boom"); }).catch(() => {});
    expect(await gate.run("chat", async () => {})).toBe(true);
  });

  test("keeps chats apart", async () => {
    const gate = createGate();
    let release = () => {};
    const first = gate.run("a", () => new Promise<void>((r) => { release = r; }));
    expect(await gate.run("b", async () => {})).toBe(true);
    release();
    await first;
  });

  test("a hung action stops blocking after the stale time, and finishing late doesn't free its successor", async () => {
    let t = 0;
    const gate = createGate(100, () => t);
    let releaseHung = () => {};
    const hung = gate.run("chat", () => new Promise<void>((r) => { releaseHung = r; }));
    t = 99;
    expect(await gate.run("chat", async () => {})).toBe(false);
    t = 100;
    let releaseNext = () => {};
    const next = gate.run("chat", () => new Promise<void>((r) => { releaseNext = r; }));
    releaseHung();
    await hung;
    expect(await gate.run("chat", async () => {})).toBe(false);
    releaseNext();
    await next;
  });
});
