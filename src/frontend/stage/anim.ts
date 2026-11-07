/**
 * Time on the stage: one clock (seconds, from the Pixi ticker), tweens that
 * resolve a promise when done, and easing curves. Everything that animates
 * goes through a Clock so destroy() can stop it all at once, and so the
 * event player can run sequentially with plain `await`.
 */
import type { Ticker } from "pixi.js";

export type Ease = (t: number) => number;

export const ease = {
  linear: (t: number) => t,
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  inCubic: (t: number) => t * t * t,
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outQuint: (t: number) => 1 - (1 - t) ** 5,
  outBack: (t: number) => {
    const c1 = 1.4;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
  outExpo: (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
} satisfies Record<string, Ease>;

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

type Job = { start: number; dur: number; fn: (t: number) => void; done: () => void; ease: Ease };

export class Clock {
  /** Seconds since the clock started. */
  now = 0;
  /** Seconds of the last frame (capped, so a background tab does not jump). */
  dt = 0;
  /** Playback speed for tweens (the player speeds up while the user taps). */
  speed = 1;
  private jobs = new Set<Job>();
  private waits = new Set<{ until: number; done: () => void }>();
  private frameFns = new Set<(now: number, dt: number) => void>();
  private stopped = false;

  constructor(private ticker: Ticker) {
    ticker.add(this.tick, this);
  }

  private tick(): void {
    if (this.stopped) return;
    const raw = Math.min(0.1, this.ticker.deltaMS / 1000);
    this.dt = raw;
    this.now += raw * this.speed;
    for (const job of [...this.jobs]) {
      const t = clamp01((this.now - job.start) / job.dur);
      job.fn(job.ease(t));
      if (t >= 1) {
        this.jobs.delete(job);
        job.done();
      }
    }
    for (const w of [...this.waits]) {
      if (this.now >= w.until) {
        this.waits.delete(w);
        w.done();
      }
    }
    for (const fn of this.frameFns) fn(this.now, raw);
  }

  /** Run fn(t) every frame for `ms`, t eased 0..1; resolves at the end. */
  tween(ms: number, fn: (t: number) => void, curve: Ease = ease.outCubic): Promise<void> {
    if (this.stopped) return Promise.resolve();
    return new Promise((resolve) => {
      const job: Job = { start: this.now, dur: Math.max(0.001, ms / 1000), fn, done: resolve, ease: curve };
      fn(curve(0));
      this.jobs.add(job);
    });
  }

  wait(ms: number): Promise<void> {
    if (this.stopped || ms <= 0) return Promise.resolve();
    return new Promise((resolve) => this.waits.add({ until: this.now + ms / 1000, done: resolve }));
  }

  /** Called every frame with (now, dt) until the returned function is called. */
  onFrame(fn: (now: number, dt: number) => void): () => void {
    this.frameFns.add(fn);
    return () => this.frameFns.delete(fn);
  }

  /** Finish every running tween and wait at once (skip). */
  flush(): void {
    for (const job of this.jobs) {
      job.fn(job.ease(1));
      job.done();
    }
    this.jobs.clear();
    for (const w of this.waits) w.done();
    this.waits.clear();
  }

  destroy(): void {
    this.flush();
    this.stopped = true;
    this.frameFns.clear();
    this.ticker.remove(this.tick, this);
  }
}

/** Whether the OS asks for reduced motion (re-read on change). */
export function reducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
