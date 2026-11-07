/**
 * Pixel bridge: browser-side crops and sheet slices for the backend (which
 * has no canvas). The backend sends `art.pixels` with a job; the browser
 * answers with each resulting PNG as ordered base64 chunks
 * (`art.pixels.chunk`, item i of n) or `art.pixels.error`. Same shape as
 * Cue's inset bridge (see inset-bridge.ts for provenance). Never rejects;
 * never logs image data.
 */
import type { PixelJob, ToBackend, ToFrontend } from "../shared/protocol.js";
import { ChunkBuffer } from "./chunks.js";
import { MAX_SHEET_CELLS } from "./sheet-geometry.js";
import { base64ToBytes, pngSize } from "./png.js";

/** Distributive Omit, so each job variant keeps its own fields. */
export type PixelJobSpec = PixelJob extends infer J ? (J extends PixelJob ? Omit<J, "requestId"> : never) : never;

export interface PixelItem {
  /** Base64 PNG (no prefix). */
  data: string;
  width: number;
  height: number;
  /** The browser's isPreCut on this image. */
  preCut: boolean;
}

export type PixelOutcome = { ok: true; items: PixelItem[] } | { ok: false; error: string; timedOut?: true };

export const PIXELS_TIMEOUT_MS = 30_000;

type PixelMessage = Extract<ToBackend, { type: "art.pixels.chunk" } | { type: "art.pixels.error" }>;

type Pending = {
  job: PixelJob;
  items: number | null;
  buffers: Map<number, { buffer: ChunkBuffer; width?: number; height?: number; preCut?: boolean }>;
  timer: ReturnType<typeof setTimeout> | null;
  activeAt: number;
  resolve: (outcome: PixelOutcome) => void;
};

let counter = 0;

export class PixelBridge {
  private readonly pending = new Map<string, Pending>();

  constructor(
    private readonly send: (message: Extract<ToFrontend, { type: "art.pixels" }>) => void,
    private readonly timeoutMs = PIXELS_TIMEOUT_MS,
  ) {}

  run(spec: PixelJobSpec): Promise<PixelOutcome> {
    counter += 1;
    const requestId = `px-${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const job = { ...spec, requestId } as PixelJob;
    return new Promise<PixelOutcome>((resolve) => {
      const entry: Pending = { job, items: null, buffers: new Map(), timer: null, activeAt: Date.now(), resolve };
      this.pending.set(requestId, entry);
      this.arm(entry);
      this.dispatch(entry);
    });
  }

  resend(minIdleMs = 0): number {
    let count = 0;
    for (const entry of [...this.pending.values()]) {
      if (Date.now() - entry.activeAt < minIdleMs) continue;
      entry.items = null;
      entry.buffers.clear();
      this.arm(entry);
      this.dispatch(entry);
      count += 1;
    }
    return count;
  }

  outstanding(): number {
    return this.pending.size;
  }

  dispose(): void {
    for (const entry of [...this.pending.values()]) this.settle(entry, { ok: false, error: "Cancelled." });
  }

  accept(message: PixelMessage): "ignored" | "buffered" | "settled" {
    if (!message || typeof message.requestId !== "string") return "ignored";
    const entry = this.pending.get(message.requestId);
    if (!entry) return "ignored";
    const invalid = (error = "The browser's image arrived in an invalid form."): "settled" => {
      this.settle(entry, { ok: false, error });
      return "settled";
    };
    if (message.type === "art.pixels.error") return invalid(String(message.error || "The browser could not process the image.").slice(0, 500));
    const { item, items } = message;
    if (!Number.isInteger(items) || items < 1 || items > MAX_SHEET_CELLS) return invalid();
    if (entry.items === null) entry.items = items;
    else if (entry.items !== items) return invalid();
    if (!Number.isInteger(item) || item < 0 || item >= items) return invalid();
    if (!ChunkBuffer.valid(message.total)) return invalid("The image is too large.");
    let slot = entry.buffers.get(item);
    if (!slot) entry.buffers.set(item, (slot = { buffer: new ChunkBuffer(message.total) }));
    else if (slot.buffer.total !== message.total) return invalid();
    if (message.index === 0) {
      slot.width = message.width;
      slot.height = message.height;
      slot.preCut = message.preCut;
    }
    const put = slot.buffer.put(message.index, message.chunk);
    if (put === "invalid") return invalid();
    if (put === "too_large") return invalid("The image is too large.");
    const done = entry.buffers.size === entry.items && [...entry.buffers.values()].every((s) => s.buffer.complete);
    if (!done) {
      this.arm(entry);
      return "buffered";
    }
    this.settle(entry, this.assemble(entry));
    return "settled";
  }

  private assemble(entry: Pending): PixelOutcome {
    const out: PixelItem[] = [];
    for (let i = 0; i < (entry.items ?? 0); i++) {
      const slot = entry.buffers.get(i)!;
      const data = slot.buffer.text();
      if (!data) return { ok: false, error: "The browser's image arrived in an invalid form." };
      let size: { width: number; height: number } | null = null;
      try {
        size = pngSize(base64ToBytes(data.slice(0, 44)));
      } catch {
        size = null;
      }
      if (!size) return { ok: false, error: `Image ${i + 1} is not a PNG.` };
      out.push({ data, width: size.width, height: size.height, preCut: slot.preCut === true });
    }
    return { ok: true, items: out };
  }

  private dispatch(entry: Pending): void {
    try {
      this.send({ type: "art.pixels", job: entry.job });
    } catch (error) {
      this.settle(entry, { ok: false, error: `Could not reach the browser: ${error instanceof Error ? error.message : String(error)}` });
    }
  }

  private arm(entry: Pending): void {
    entry.activeAt = Date.now();
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
      if (this.pending.get(entry.job.requestId) !== entry) return;
      this.settle(entry, { ok: false, error: "The browser did not process the image in time.", timedOut: true });
    }, this.timeoutMs);
    (entry.timer as { unref?: () => void }).unref?.();
  }

  private settle(entry: Pending, outcome: PixelOutcome): void {
    if (this.pending.get(entry.job.requestId) !== entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    this.pending.delete(entry.job.requestId);
    entry.buffers.clear();
    entry.resolve(outcome);
  }
}
