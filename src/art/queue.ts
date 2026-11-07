/**
 * The art queue (docs/DESIGN.md, 5.7). Pure scheduling: the host's
 * `imageGen.generate`, the cache store, sleep and the clock are injected, so
 * every rule here is unit-tested without Lumiverse.
 *
 * - Two lanes: "nai" (concurrency 1: NovelAI allows one generation per
 *   account) and "gpt" (configurable, default 2).
 * - Priorities P0 (now) .. P3 (speculative); FIFO within a priority. A queued
 *   job requested again at a higher priority is upgraded.
 * - A job is an ordered list of plans (routes): e.g. V5 inset, then GPT
 *   edit, then V4.5 precise reference. A plan that cannot be prepared or is
 *   rejected moves the job to the next plan (possibly in the other lane).
 * - Content-hash cache: hash(provider, model, prompt, negative, refs, seed,
 *   size, extra) -> final image, persisted by the injected store, so nothing
 *   is generated twice across restarts. Checked for every plan before it
 *   runs (and for all plans at enqueue).
 * - NovelAI "Concurrent generation is locked": wait 2, 4, 6, 8, 10 s (then
 *   10 s) and retry, holding the lane (Inlay Illustrator origin/stable
 *   6b747bf, src/backend/services/images.ts:26-27, 621-625).
 * - Transient errors (429, 5xx, network, timeouts): retry with 1, 2, 4 s.
 * - A request we stopped waiting for (timeout) keeps the NAI lane closed
 *   until it settles, at most 60 s (Inlay images.ts:28-30), so the next
 *   request does not run into the account lock.
 */
import type { ImageGenRequestDTO } from "lumiverse-spindle-types";
import type { ArtPriority, ArtStatus } from "../shared/protocol.js";
import { stableHash } from "./hash.js";
import { errorMessage, isConcurrentLockError, isRetryableImageError } from "./providers.js";

export type Lane = "nai" | "gpt";
export const LANES: readonly Lane[] = ["nai", "gpt"];

/** What makes two generations the same picture. Reference images by id, never bytes. */
export interface PlanDescriptor {
  provider: string;
  model: string;
  prompt: string;
  negative: string;
  refs: string[];
  seed: number | null;
  size: string;
  /** Anything else that changes the picture (route, transparency, effort). */
  extra?: string;
}

export function descriptorHash(d: PlanDescriptor): string {
  return stableHash({ v: 1, provider: d.provider, model: d.model, prompt: d.prompt, negative: d.negative, refs: d.refs, seed: d.seed, size: d.size, extra: d.extra ?? "" });
}

export interface GenOutput {
  imageId: string;
  url: string;
  /** Transparent figure (expected, or checked). */
  cutout: boolean;
  /** The plan label that drew it. */
  via?: string;
  /** A figure cut out in the browser: its face (normalized x, y, w, h), null when none was found. */
  face?: [number, number, number, number] | null;
}

/** Thrown by `Plan.prepare` when the route cannot run now (no canvas, missing reference): next plan. */
export class PlanUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanUnavailable";
  }
}

export interface Plan {
  lane: Lane;
  /** For logs and status errors, e.g. "nai-v5-inset". */
  label: string;
  descriptor: PlanDescriptor;
  cutout: boolean;
  /** Build the generate call (may read reference bytes or ask the browser for a canvas). */
  prepare(): Promise<ImageGenRequestDTO>;
  /** Turn the raw result into the final image (e.g. crop an inset render). Errors fail the plan. */
  finish?(raw: GenOutput): Promise<GenOutput>;
  /** True when this error means the provider rejects this route for good (skip retries, next plan). */
  rejects?(error: unknown): boolean;
}

/** Builds a job's plans for its current priority (effort and quality follow the priority). */
export type Planner = (priority: ArtPriority) => Plan[];

export interface ArtCacheStore {
  get(hash: string): Promise<GenOutput | null>;
  set(hash: string, value: GenOutput): Promise<void>;
}

export interface GenerateResult {
  imageId?: string;
  imageUrl?: string;
}

export interface QueueOptions {
  generate: (call: ImageGenRequestDTO) => Promise<GenerateResult>;
  cache: ArtCacheStore;
  onStatus: (status: ArtStatus) => void;
  sleep?: (ms: number) => Promise<void>;
  /** GPT lane concurrency (default 2). */
  gptConcurrency?: number;
  /** Retries for transient errors per plan (default 3). */
  maxRetries?: number;
  /** Lock waits per plan before giving up (default 12). */
  maxLockWaits?: number;
  /** Per-call timeout, 0 = none (default 180 s). */
  timeoutMs?: number;
  /** Longest the NAI lane stays closed for a request we stopped waiting for (default 60 s). */
  abandonedHoldMs?: number;
  log?: (level: "info" | "warn" | "error", message: string) => void;
}

export const LOCK_STEP_MS = 2000;
export const LOCK_MAX_MS = 10_000;
export const RETRY_DELAYS_MS = [1000, 2000, 4000];

/** Wait after the n-th lock (1-based): 2, 4, 6, 8, 10, 10 ... s. */
export function lockDelayMs(attempt: number): number {
  return Math.min(LOCK_MAX_MS, LOCK_STEP_MS * Math.max(1, attempt));
}

type JobState = "checking" | "queued" | "running" | "ready" | "failed";

interface Job {
  key: string;
  priority: ArtPriority;
  seq: number;
  planner: Planner;
  planIndex: number;
  lane: Lane;
  state: JobState;
  lastError?: string;
  waiters: Array<(status: ArtStatus) => void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class ArtQueue {
  private readonly jobs = new Map<string, Job>();
  private readonly statuses = new Map<string, ArtStatus>();
  private readonly active: Record<Lane, number> = { nai: 0, gpt: 0 };
  private readonly holds: Record<Lane, Promise<void> | null> = { nai: null, gpt: null };
  private readonly concurrency: Record<Lane, number>;
  private seq = 0;
  private disposed = false;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly opts: QueueOptions) {
    this.concurrency = { nai: 1, gpt: Math.max(1, Math.floor(opts.gptConcurrency ?? 2)) };
    this.sleep = opts.sleep ?? defaultSleep;
  }

  setGptConcurrency(n: number): void {
    this.concurrency.gpt = Math.max(1, Math.floor(n));
    this.pump();
  }

  /** Current status of a key (memory only; the controller adds the persisted index). */
  status(key: string): ArtStatus | null {
    return this.statuses.get(key) ?? null;
  }

  /** Lane load, for diagnostics and tests. */
  load(): { active: Record<Lane, number>; queued: number } {
    let queued = 0;
    for (const job of this.jobs.values()) if (job.state === "queued" || job.state === "checking") queued++;
    return { active: { ...this.active }, queued };
  }

  /**
   * Ask for an asset. A new key is queued (after a cache check of all its
   * plans); a queued key is upgraded to a higher priority; a running or
   * finished key is left alone. Returns the status right now.
   */
  request(key: string, priority: ArtPriority, planner: Planner): ArtStatus {
    const existing = this.jobs.get(key);
    if (existing && (existing.state === "queued" || existing.state === "checking" || existing.state === "running")) {
      if (priority < existing.priority) {
        existing.priority = priority;
        this.pump();
      }
      return this.statuses.get(key)!;
    }
    const known = this.statuses.get(key);
    if (known?.state === "ready") return known;

    let plans: Plan[];
    try {
      plans = planner(priority);
    } catch (error) {
      return this.emit({ key, state: "failed", error: `No way to draw this: ${errorMessage(error)}` });
    }
    if (!plans.length) return this.emit({ key, state: "failed", error: "No image connection can draw this asset." });

    const job: Job = { key, priority, seq: this.seq++, planner, planIndex: 0, lane: plans[0]!.lane, state: "checking", waiters: [] };
    this.jobs.set(key, job);
    const status = this.emit({ key, state: "queued" });
    void this.checkCache(job, plans);
    return status;
  }

  /** Resolves when the key is ready or failed. */
  wait(key: string): Promise<ArtStatus> {
    const s = this.statuses.get(key);
    const job = this.jobs.get(key);
    if (!job || (s && (s.state === "ready" || s.state === "failed"))) return Promise.resolve(s ?? { key, state: "failed", error: "Unknown asset." });
    return new Promise((resolve) => job.waiters.push(resolve));
  }

  /** Mark a key ready without generating (e.g. restored from the persisted index). */
  restore(status: ArtStatus): void {
    if (!this.jobs.has(status.key)) this.statuses.set(status.key, status);
  }

  /** Forget a finished key so the next request plans it again (regeneration uses a new seed upstream). */
  forget(key: string): void {
    const job = this.jobs.get(key);
    if (job && (job.state === "running" || job.state === "queued" || job.state === "checking")) return;
    this.jobs.delete(key);
    this.statuses.delete(key);
  }

  dispose(): void {
    this.disposed = true;
  }

  /* ---------------------------------------------------------------- */

  private emit(status: ArtStatus): ArtStatus {
    this.statuses.set(status.key, status);
    try {
      this.opts.onStatus(status);
    } catch {
      /* a status listener must not break the queue */
    }
    if (status.state === "ready" || status.state === "failed") {
      const job = this.jobs.get(status.key);
      if (job) {
        const waiters = job.waiters.splice(0);
        for (const w of waiters) w(status);
      }
    }
    return status;
  }

  private async checkCache(job: Job, plans: Plan[]): Promise<void> {
    for (const plan of plans) {
      let hit: GenOutput | null = null;
      try {
        hit = await this.opts.cache.get(descriptorHash(plan.descriptor));
      } catch {
        hit = null;
      }
      if (hit) {
        job.state = "ready";
        this.emit({ key: job.key, state: "ready", imageId: hit.imageId, url: hit.url, cutout: hit.cutout, ...(hit.face !== undefined ? { face: hit.face } : {}) });
        return;
      }
    }
    if (job.state === "checking") job.state = "queued";
    this.pump();
  }

  private pump(): void {
    if (this.disposed) return;
    for (const lane of LANES) {
      while (!this.holds[lane] && this.active[lane] < this.concurrency[lane]) {
        const job = this.next(lane);
        if (!job) break;
        this.start(job);
      }
    }
  }

  private next(lane: Lane): Job | null {
    let best: Job | null = null;
    for (const job of this.jobs.values()) {
      if (job.state !== "queued" || job.lane !== lane) continue;
      if (!best || job.priority < best.priority || (job.priority === best.priority && job.seq < best.seq)) best = job;
    }
    return best;
  }

  private start(job: Job): void {
    const lane = job.lane;
    job.state = "running";
    this.active[lane] += 1;
    this.emit({ key: job.key, state: "running" });
    void this.runPlan(job, lane).finally(() => {
      this.active[lane] -= 1;
      this.pump();
    });
  }

  /** Runs the job's current plan in its lane. On failure moves to the next plan (re-queued, maybe in the other lane). */
  private async runPlan(job: Job, lane: Lane): Promise<void> {
    const plans = job.planner(job.priority);
    const plan = plans[job.planIndex];
    if (!plan || plan.lane !== lane) {
      // The plan list changed under us (priority upgrade with other routes): re-route.
      return this.advance(job, plans, plan ? null : "No route left.", true);
    }
    const log = this.opts.log;
    try {
      const hash = descriptorHash(plan.descriptor);
      const cached = await this.opts.cache.get(hash).catch(() => null);
      if (cached) {
        job.state = "ready";
        this.emit({ key: job.key, state: "ready", imageId: cached.imageId, url: cached.url, cutout: cached.cutout, via: cached.via, ...(cached.face !== undefined ? { face: cached.face } : {}) });
        return;
      }
      const call = await plan.prepare();
      const raw = await this.generateWithRetries(plan, lane, call);
      const final = { ...(plan.finish ? await plan.finish(raw) : raw), via: plan.label };
      await this.opts.cache.set(hash, final).catch((error) => log?.("warn", `art cache write failed: ${errorMessage(error)}`));
      job.state = "ready";
      log?.("info", `art ${job.key} drawn by ${plan.label}${job.planIndex ? ` (route ${job.planIndex + 1} of ${plans.length})` : ""}`);
      this.emit({ key: job.key, state: "ready", imageId: final.imageId, url: final.url, cutout: final.cutout, via: final.via, ...(final.face !== undefined ? { face: final.face } : {}) });
    } catch (error) {
      const message = `${plan.label}: ${errorMessage(error)}`;
      log?.(error instanceof PlanUnavailable ? "info" : "warn", `art ${job.key} ${message}`);
      job.lastError = message;
      return this.advance(job, plans, message, false);
    }
  }

  private advance(job: Job, plans: Plan[], error: string | null, sameIndex: boolean): void {
    if (!sameIndex) job.planIndex += 1;
    const next = plans[job.planIndex];
    if (!next) {
      job.state = "failed";
      this.emit({ key: job.key, state: "failed", error: job.lastError ?? error ?? "Image generation failed." });
      return;
    }
    job.lane = next.lane;
    job.state = "queued";
    this.emit({ key: job.key, state: "queued" });
  }

  private async generateWithRetries(plan: Plan, lane: Lane, call: ImageGenRequestDTO): Promise<GenOutput> {
    const maxRetries = this.opts.maxRetries ?? 3;
    const maxLocks = this.opts.maxLockWaits ?? 12;
    let retries = 0;
    let locks = 0;
    for (;;) {
      if (this.disposed) throw new Error("The art queue stopped.");
      // A retry after a timeout must not overlap the request NovelAI is still drawing.
      const hold = this.holds[lane];
      if (hold) await hold;
      try {
        const result = await this.callOnce(lane, call);
        const imageId = typeof result?.imageId === "string" ? result.imageId : "";
        if (!imageId) throw Object.assign(new Error("The image provider returned no image."), { retryable: true });
        const url = typeof result.imageUrl === "string" && result.imageUrl ? result.imageUrl : `/api/v1/image-gen/results/${imageId}`;
        return { imageId, url, cutout: plan.cutout };
      } catch (error) {
        if (plan.rejects?.(error)) throw error;
        if (isConcurrentLockError(error)) {
          locks += 1;
          if (locks > maxLocks) throw error;
          this.opts.log?.("info", `NovelAI is busy with another image; retrying in ${lockDelayMs(locks) / 1000} s`);
          await this.sleep(lockDelayMs(locks));
          continue;
        }
        if (isRetryableImageError(error) && retries < maxRetries) {
          const delay = RETRY_DELAYS_MS[Math.min(retries, RETRY_DELAYS_MS.length - 1)]!;
          retries += 1;
          await this.sleep(delay);
          continue;
        }
        throw error;
      }
    }
  }

  private async callOnce(lane: Lane, call: ImageGenRequestDTO): Promise<GenerateResult> {
    const timeoutMs = this.opts.timeoutMs ?? 180_000;
    const pending = this.opts.generate(call);
    if (!timeoutMs) return pending;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    try {
      return await Promise.race([
        pending,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            timedOut = true;
            reject(Object.assign(new Error(`Image generation timed out after ${Math.round(timeoutMs / 1000)} s.`), { retryable: true }));
          }, timeoutMs);
          (timer as { unref?: () => void }).unref?.();
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
      if (timedOut && lane === "nai") this.holdLane(lane, pending);
    }
  }

  /** NovelAI keeps drawing an image we stopped waiting for: keep the lane closed until it settles (capped). */
  private holdLane(lane: Lane, pending: Promise<unknown>): void {
    const settled = pending.then(() => undefined, () => undefined);
    const cap = this.sleep(this.opts.abandonedHoldMs ?? 60_000);
    const hold = Promise.race([settled, cap]).then(() => {
      if (this.holds[lane] === hold) this.holds[lane] = null;
      this.pump();
    });
    this.holds[lane] = hold;
  }
}
