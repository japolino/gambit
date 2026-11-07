/**
 * Vendored from Cue:
 *   repo:   visual-novel-preview (D:\Lumiverse\visual-novel-preview)
 *   branch: origin/testing @ ab0fa34 (file last changed at 508d032)
 *   path:   src/backend/runtime/sprites/inset-bridge.ts
 * Changes: Gambit's messages (`inset.compose` with a source URL instead of an
 * image id; `inset.result` {part, chunk, index, total}; `inset.error`);
 * Gambit's layouts; the chunk buffer from ./chunks.ts. Pull upstream fixes
 * by hand.
 *
 * Inset bridge: the backend runs without a canvas, so the logged-in browser
 * composes the NovelAI V5 reference inset: it fetches the reference, fits it
 * into the layout's reference box on a white canvas and draws the mask. Both
 * PNGs come back as ordered base64 chunks (one series per part). The result
 * is checked (PNG, canvas size) and handed back as base64, ready for the
 * request. Never logs the image data.
 */
import type { InsetComposeRequest, ToBackend, ToFrontend } from "../shared/protocol.js";
import { ChunkBuffer } from "./chunks.js";
import { insetLayout, type InsetLayoutId } from "./inset-geometry.js";
import { base64ToBytes, pngSize } from "./png.js";

export type InsetCanvas = { image: string; mask: string };

export type InsetOutcome = { ok: true; canvas: InsetCanvas } | { ok: false; error: string; timedOut?: true };

/** Default wait for a composition (a few hundred ms in practice; the browser may be busy or closed). */
export const INSET_TIMEOUT_MS = 15_000;

const PARTS = ["image", "mask"] as const;
type Part = (typeof PARTS)[number];

type Pending = {
  request: InsetComposeRequest;
  parts: Record<Part, ChunkBuffer | null>;
  timer: ReturnType<typeof setTimeout> | null;
  activeAt: number;
  resolve: (outcome: InsetOutcome) => void;
  cleanup: () => void;
};

type InsetMessage = Extract<ToBackend, { type: "inset.result" } | { type: "inset.error" }>;

let counter = 0;

export class InsetBridge {
  private readonly pending = new Map<string, Pending>();

  constructor(
    private readonly send: (message: Extract<ToFrontend, { type: "inset.compose" }>) => void,
    private readonly timeoutMs = INSET_TIMEOUT_MS,
  ) {}

  /** Ask the browser for a canvas and mask. Never rejects. */
  compose(layout: InsetLayoutId, sourceUrl: string, options: { signal?: AbortSignal } = {}): Promise<InsetOutcome> {
    if (options.signal?.aborted) return Promise.resolve({ ok: false, error: "Cancelled." });
    if (!insetLayout(layout)) return Promise.resolve({ ok: false, error: `Unknown inset layout "${layout}".` });
    counter += 1;
    const requestId = `inset-${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    return new Promise<InsetOutcome>((resolve) => {
      const onAbort = (): void => this.settle(entry, { ok: false, error: "Cancelled." });
      const entry: Pending = {
        request: { requestId, layout, sourceUrl },
        parts: { image: null, mask: null },
        timer: null,
        activeAt: Date.now(),
        resolve,
        cleanup: () => options.signal?.removeEventListener("abort", onAbort),
      };
      this.pending.set(requestId, entry);
      options.signal?.addEventListener("abort", onAbort, { once: true });
      this.arm(entry);
      this.dispatch(entry);
    });
  }

  /** A (re)loaded page lost earlier requests: send the pending ones again under the same id. */
  resend(minIdleMs = 0): number {
    let count = 0;
    for (const entry of [...this.pending.values()]) {
      if (Date.now() - entry.activeAt < minIdleMs) continue;
      entry.parts = { image: null, mask: null };
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

  /** Accept one `inset.result` / `inset.error`; unknown ids are ignored. */
  accept(message: InsetMessage): "ignored" | "buffered" | "settled" {
    if (!message || typeof message.requestId !== "string") return "ignored";
    const entry = this.pending.get(message.requestId);
    if (!entry) return "ignored";
    const invalid = (error = "The inset canvas arrived in an invalid form."): "settled" => {
      this.settle(entry, { ok: false, error });
      return "settled";
    };
    if (message.type === "inset.error") return invalid(String(message.error || "The inset canvas could not be drawn.").slice(0, 500));
    const part = message.part;
    if (part !== "image" && part !== "mask") return invalid();
    if (!ChunkBuffer.valid(message.total)) return invalid("The inset canvas is too large.");
    let buffer = entry.parts[part];
    if (!buffer) entry.parts[part] = buffer = new ChunkBuffer(message.total);
    else if (buffer.total !== message.total) return invalid();
    const put = buffer.put(message.index, message.chunk);
    if (put === "invalid") return invalid();
    if (put === "too_large") return invalid("The inset canvas is too large.");
    const done = PARTS.every((name) => entry.parts[name]?.complete === true);
    if (!done) {
      this.arm(entry);
      return "buffered";
    }
    this.settle(entry, this.assemble(entry));
    return "settled";
  }

  private dispatch(entry: Pending): void {
    try {
      this.send({ type: "inset.compose", request: entry.request });
    } catch (error) {
      this.settle(entry, { ok: false, error: `Could not reach the browser: ${error instanceof Error ? error.message : String(error)}` });
    }
  }

  private assemble(entry: Pending): InsetOutcome {
    const layout = insetLayout(entry.request.layout)!;
    const texts: Record<Part, string> = { image: "", mask: "" };
    for (const part of PARTS) {
      const text = entry.parts[part]!.text();
      if (!text) return { ok: false, error: "The inset canvas arrived in an invalid form." };
      let size: { width: number; height: number } | null = null;
      try {
        // The PNG header is in the first 33 bytes (44 base64 characters).
        size = pngSize(base64ToBytes(text.slice(0, 44)));
      } catch {
        size = null;
      }
      if (!size) return { ok: false, error: `The inset ${part} is not a PNG image.` };
      if (size.width !== layout.canvas.width || size.height !== layout.canvas.height) {
        return { ok: false, error: `The inset ${part} is ${size.width}x${size.height}, expected ${layout.canvas.width}x${layout.canvas.height}.` };
      }
      texts[part] = text;
    }
    return { ok: true, canvas: { image: texts.image, mask: texts.mask } };
  }

  /** (Re)start the inactivity timer: any chunk counts as progress. */
  private arm(entry: Pending): void {
    entry.activeAt = Date.now();
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
      if (this.pending.get(entry.request.requestId) !== entry) return;
      this.settle(entry, { ok: false, error: "The browser did not compose the inset in time.", timedOut: true });
    }, this.timeoutMs);
    (entry.timer as { unref?: () => void }).unref?.();
  }

  private settle(entry: Pending, outcome: InsetOutcome): void {
    if (this.pending.get(entry.request.requestId) !== entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    this.pending.delete(entry.request.requestId);
    entry.parts = { image: null, mask: null };
    entry.cleanup();
    entry.resolve(outcome);
  }
}
