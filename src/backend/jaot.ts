/**
 * The JAOT (just-ahead-of-time) compiler queue (docs/DESIGN.md 4.5): model
 * jobs run by priority, so what the player needs now never waits behind
 * what they might need later.
 *
 *   P0  needed now (the place you just walked into, with nothing ready)
 *   P1  next likely (the World Bible after a read, the "Meanwhile…" montage)
 *   P2  speculative (two hops away)
 *   P3  downtime (night consequences, promotions, codex art)
 *
 * Jobs are keyed: asking for a job already queued or running returns the
 * same promise, and raises its priority if the new ask is more urgent.
 */

export type Priority = 0 | 1 | 2 | 3;

interface Job<T = unknown> {
  key: string;
  priority: Priority;
  seq: number;
  run: () => Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
  promise: Promise<T>;
}

export interface JaotStats {
  queued: { key: string; priority: Priority }[];
  running: string[];
  done: number;
  failed: number;
}

export function createJaot(opts: { concurrency?: number; log?: (m: string) => void } = {}) {
  const limit = Math.max(1, opts.concurrency ?? 2);
  const log = opts.log ?? (() => {});
  const queued: Job[] = [];
  const running = new Map<string, Job>();
  let seq = 0;
  let done = 0;
  let failed = 0;
  const idleWaiters: (() => void)[] = [];

  const next = (): Job | undefined => {
    if (!queued.length) return undefined;
    let best = 0;
    for (let i = 1; i < queued.length; i++) {
      const a = queued[i]!;
      const b = queued[best]!;
      if (a.priority < b.priority || (a.priority === b.priority && a.seq < b.seq)) best = i;
    }
    return queued.splice(best, 1)[0];
  };

  const pump = () => {
    while (running.size < limit) {
      const job = next();
      if (!job) break;
      running.set(job.key, job);
      const t0 = Date.now();
      Promise.resolve()
        .then(job.run)
        .then(
          (v) => {
            done++;
            job.resolve(v);
          },
          (e) => {
            failed++;
            log(`job ${job.key} failed: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200));
            job.reject(e);
          },
        )
        .finally(() => {
          running.delete(job.key);
          const ms = Date.now() - t0;
          if (ms > 2000) log(`P${job.priority} ${job.key} took ${Math.round(ms / 100) / 10} s`);
          pump();
          if (!running.size && !queued.length) idleWaiters.splice(0).forEach((f) => f());
        });
    }
  };

  /** Queue a job, or join the one with the same key. */
  function run<T>(key: string, priority: Priority, fn: () => Promise<T>): Promise<T> {
    const live = running.get(key) ?? queued.find((j) => j.key === key);
    if (live) {
      if (priority < live.priority) live.priority = priority;
      return live.promise as Promise<T>;
    }
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    queued.push({ key, priority, seq: seq++, run: fn, resolve: resolve as (v: unknown) => void, reject, promise } as Job);
    pump();
    return promise;
  }

  /** Whether a job with this key is queued or running. */
  const has = (key: string) => running.has(key) || queued.some((j) => j.key === key);

  const stats = (): JaotStats => ({ queued: queued.map((j) => ({ key: j.key, priority: j.priority })), running: [...running.keys()], done, failed });

  /** Resolves once nothing is queued or running. */
  const idle = (): Promise<void> => (!running.size && !queued.length ? Promise.resolve() : new Promise((r) => idleWaiters.push(r)));

  return { run, has, stats, idle };
}

export type Jaot = ReturnType<typeof createJaot>;
