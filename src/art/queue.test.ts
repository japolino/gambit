import { describe, expect, test } from "bun:test";
import type { ImageGenRequestDTO } from "lumiverse-spindle-types";
import type { ArtStatus } from "../shared/protocol.js";
import { ArtQueue, descriptorHash, lockDelayMs, PlanUnavailable, type GenerateResult, type Lane, type Plan } from "./queue.js";
import { memoryCache } from "./store.js";
import { settle } from "./testing/fake-host.js";

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
}

function plan(lane: Lane, label: string, over: Partial<Plan> = {}): Plan {
  return {
    lane,
    label,
    cutout: false,
    descriptor: { provider: lane, model: "m", prompt: label, negative: "", refs: [], seed: 1, size: "1x1" },
    prepare: async () => ({ prompt: label }) as ImageGenRequestDTO,
    ...over,
  };
}

function setup(opts: { gptConcurrency?: number; generate?: (call: ImageGenRequestDTO) => Promise<GenerateResult> } = {}) {
  const calls: string[] = [];
  const pending: Array<{ prompt: string; d: ReturnType<typeof deferred<GenerateResult>> }> = [];
  const statuses: ArtStatus[] = [];
  const sleeps: number[] = [];
  const cache = memoryCache();
  const queue = new ArtQueue({
    cache,
    gptConcurrency: opts.gptConcurrency,
    onStatus: (s) => statuses.push(s),
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    timeoutMs: 0,
    generate:
      opts.generate ??
      ((call) => {
        calls.push(call.prompt);
        const d = deferred<GenerateResult>();
        pending.push({ prompt: call.prompt, d });
        return d.promise;
      }),
  });
  const finish = (prompt: string, id = `id-${prompt}`) => {
    const i = pending.findIndex((p) => p.prompt === prompt);
    if (i < 0) throw new Error(`no pending call ${prompt}`);
    pending.splice(i, 1)[0]!.d.resolve({ imageId: id, imageUrl: `/u/${id}` });
  };
  return { queue, calls, pending, statuses, sleeps, cache, finish };
}

describe("ArtQueue", () => {
  test("NAI lane runs one at a time; GPT lane runs two by default", async () => {
    const t = setup();
    for (const k of ["n1", "n2", "n3"]) t.queue.request(k, 2, () => [plan("nai", k)]);
    for (const k of ["g1", "g2", "g3"]) t.queue.request(k, 2, () => [plan("gpt", k)]);
    await settle();
    expect(t.calls.sort()).toEqual(["g1", "g2", "n1"]);
    expect(t.queue.load().active).toEqual({ nai: 1, gpt: 2 });
    t.finish("n1");
    t.finish("g1");
    await settle();
    expect(t.calls).toContain("n2");
    expect(t.calls).toContain("g3");
    expect(t.queue.load().active).toEqual({ nai: 1, gpt: 2 });
  });

  test("higher priority first, FIFO within a priority, upgrade on request", async () => {
    const t = setup();
    t.queue.request("busy", 3, () => [plan("nai", "busy")]);
    await settle();
    t.queue.request("a", 3, () => [plan("nai", "a")]);
    t.queue.request("b", 2, () => [plan("nai", "b")]);
    t.queue.request("c", 2, () => [plan("nai", "c")]);
    t.queue.request("d", 3, () => [plan("nai", "d")]);
    await settle();
    // d is upgraded to P0 when the player heads toward it.
    t.queue.request("d", 0, () => [plan("nai", "d")]);
    const order: string[] = [];
    for (let i = 0; i < 5; i++) {
      const head = t.pending[0]!.prompt;
      order.push(head);
      t.finish(head);
      await settle();
    }
    expect(order).toEqual(["busy", "d", "b", "c", "a"]);
  });

  test("ready statuses carry the image; waiters resolve", async () => {
    const t = setup();
    const s0 = t.queue.request("k", 1, () => [plan("gpt", "k", { cutout: true })]);
    expect(s0.state).toBe("queued");
    const done = t.queue.wait("k");
    await settle();
    t.finish("k", "img-9");
    const final = await done;
    // `via` names the plan that drew it (here labelled "k").
    expect(final).toEqual({ key: "k", state: "ready", imageId: "img-9", url: "/u/img-9", cutout: true, via: "k" });
    expect(t.statuses.map((s) => s.state)).toEqual(["queued", "running", "ready"]);
  });

  test("content-hash cache: a second key with the same picture does not generate", async () => {
    const t = setup();
    t.queue.request("k1", 1, () => [plan("nai", "same")]);
    await settle();
    t.finish("same", "img-1");
    await settle();
    t.queue.request("k2", 1, () => [plan("nai", "same")]);
    await settle();
    expect(t.calls).toEqual(["same"]);
    expect(t.queue.status("k2")).toMatchObject({ state: "ready", imageId: "img-1" });
  });

  test("cache persisted across queue instances (restart): no generation", async () => {
    const p = plan("nai", "x");
    const cache = memoryCache({ [descriptorHash(p.descriptor)]: { imageId: "old", url: "/u/old", cutout: false } });
    const calls: string[] = [];
    const q = new ArtQueue({ cache, onStatus: () => {}, timeoutMs: 0, generate: async (c) => (calls.push(c.prompt), { imageId: "new" }) });
    q.request("k", 0, () => [p]);
    await settle();
    expect(calls).toEqual([]);
    expect(q.status("k")).toMatchObject({ state: "ready", imageId: "old" });
  });

  test("a later plan already cached is used at enqueue", async () => {
    const first = plan("nai", "inset");
    const second = plan("gpt", "edit");
    const cache = memoryCache({ [descriptorHash(second.descriptor)]: { imageId: "edit-old", url: "/u/e", cutout: true } });
    const calls: string[] = [];
    const q = new ArtQueue({ cache, onStatus: () => {}, timeoutMs: 0, generate: async (c) => (calls.push(c.prompt), { imageId: "x" }) });
    q.request("k", 1, () => [first, second]);
    await settle();
    expect(calls).toEqual([]);
    expect(q.status("k")?.imageId).toBe("edit-old");
  });

  test("NovelAI concurrent lock: waits 2, 4, 6 s and keeps the lane", async () => {
    let n = 0;
    const t = setup({
      generate: async () => {
        n += 1;
        if (n <= 3) throw new Error("NovelAI image generate failed (429): Concurrent generation is locked");
        return { imageId: "ok" };
      },
    });
    t.queue.request("k", 0, () => [plan("nai", "k")]);
    t.queue.request("other", 0, () => [plan("nai", "other")]);
    await settle();
    expect(t.sleeps.slice(0, 3)).toEqual([2000, 4000, 6000]);
    expect(t.queue.status("k")?.state).toBe("ready");
    expect(n).toBe(5); // 3 locked + k + other (other only started after k)
    expect([1, 2, 3, 4, 5, 6, 9].map(lockDelayMs)).toEqual([2000, 4000, 6000, 8000, 10000, 10000, 10000]);
  });

  test("transient errors retry with 1, 2, 4 s, then the plan fails over", async () => {
    const seen: string[] = [];
    const t = setup({
      generate: async (c) => {
        seen.push(c.prompt);
        if (c.prompt === "a") throw Object.assign(new Error("NovelAI image generate failed (503): busy"), {});
        return { imageId: "b-img" };
      },
    });
    t.queue.request("k", 1, () => [plan("nai", "a"), plan("gpt", "b")]);
    await settle(40);
    expect(t.sleeps).toEqual([1000, 2000, 4000]);
    expect(seen).toEqual(["a", "a", "a", "a", "b"]);
    expect(t.queue.status("k")).toMatchObject({ state: "ready", imageId: "b-img" });
  });

  test("non-retryable error and rejected route go straight to the next plan", async () => {
    const seen: string[] = [];
    const t = setup({
      generate: async (c) => {
        seen.push(c.prompt);
        if (c.prompt === "inset") throw new Error("NovelAI image generate failed (400): unknown model");
        if (c.prompt === "edit") throw new Error("OpenAI image generate failed (401): bad key");
        return { imageId: "last" };
      },
    });
    let rejected = false;
    t.queue.request("k", 1, () => [
      plan("nai", "inset", { rejects: () => (rejected = true) }),
      plan("gpt", "edit"),
      plan("nai", "plain"),
    ]);
    await settle(40);
    expect(rejected).toBe(true);
    expect(t.sleeps).toEqual([]);
    expect(seen).toEqual(["inset", "edit", "plain"]);
    expect(t.queue.status("k")?.imageId).toBe("last");
  });

  test("PlanUnavailable (no browser canvas) skips without generating", async () => {
    const seen: string[] = [];
    const t = setup({ generate: async (c) => (seen.push(c.prompt), { imageId: "g" }) });
    t.queue.request("k", 1, () => [
      plan("nai", "inset", {
        prepare: async () => {
          throw new PlanUnavailable("no canvas");
        },
      }),
      plan("gpt", "edit"),
    ]);
    await settle();
    expect(seen).toEqual(["edit"]);
  });

  test("all plans failing reports failed with the last error", async () => {
    const t = setup({ generate: async () => Promise.reject(new Error("OpenAI image generate failed (400): nope")) });
    t.queue.request("k", 1, () => [plan("gpt", "only")]);
    await settle();
    expect(t.queue.status("k")).toMatchObject({ state: "failed" });
    expect(t.queue.status("k")?.error).toContain("only: OpenAI image generate failed (400)");
  });

  test("finish turns the raw render into the final image (inset crop) and that is cached", async () => {
    const t = setup({ generate: async () => ({ imageId: "canvas" }) });
    const p = plan("nai", "inset", { finish: async () => ({ imageId: "cropped", url: "/u/cropped", cutout: false }) });
    t.queue.request("k", 1, () => [p]);
    await settle();
    expect(t.queue.status("k")?.imageId).toBe("cropped");
    expect(t.cache.entries.get(descriptorHash(p.descriptor))?.imageId).toBe("cropped");
  });

  test("timeout on NAI holds the lane until the abandoned request settles", async () => {
    const slow = deferred<GenerateResult>();
    let n = 0;
    const started: string[] = [];
    const q = new ArtQueue({
      cache: memoryCache(),
      onStatus: () => {},
      timeoutMs: 5,
      maxRetries: 0,
      sleep: () => new Promise(() => {}), // the cap never fires in this test
      generate: (c) => {
        started.push(c.prompt);
        n += 1;
        return n === 1 ? slow.promise : Promise.resolve({ imageId: "fast" });
      },
    });
    q.request("a", 0, () => [plan("nai", "a")]);
    q.request("b", 1, () => [plan("nai", "b")]);
    await new Promise((r) => setTimeout(r, 30));
    expect(q.status("a")?.state).toBe("failed");
    expect(started).toEqual(["a"]); // b waits: NovelAI is still drawing a
    slow.resolve({ imageId: "late" });
    await settle();
    expect(started).toEqual(["a", "b"]);
    expect(q.status("b")?.state).toBe("ready");
  });
});
