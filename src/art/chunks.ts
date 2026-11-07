/**
 * Chunked base64 transfer between the browser and the backend. The frontend
 * WebSocket caps one payload at 4 MB (docs/DESIGN.md, 8.1), so PNGs drawn in
 * the browser travel back as ordered base64 chunks and are reassembled here.
 * Pattern ported from Cue (visual-novel-preview, origin/testing @ ab0fa34):
 * src/frontend/sprites/cut-service.ts `chunkBase64` and
 * src/backend/runtime/sprites/inset-bridge.ts `accept` (chunk validation).
 */

/** Characters per chunk: well under the 4 MB message cap with JSON overhead. */
export const ART_CHUNK_CHARS = 2_000_000;
/** Largest decoded image accepted per item. */
export const ART_MAX_ITEM_BYTES = 16 * 1024 * 1024;
export const ART_MAX_ITEM_CHARS = Math.ceil(ART_MAX_ITEM_BYTES / 3) * 4;
export const ART_MAX_CHUNKS = Math.ceil(ART_MAX_ITEM_CHARS / ART_CHUNK_CHARS);

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;
const BASE64_CHUNK = /^[A-Za-z0-9+/=]*$/;

/** Split base64 into ordered chunks of at most `size` characters (at least one chunk). */
export function chunkBase64(data: string, size = ART_CHUNK_CHARS): string[] {
  if (!data) return [""];
  const chunks: string[] = [];
  for (let offset = 0; offset < data.length; offset += size) chunks.push(data.slice(offset, offset + size));
  return chunks;
}

export type ChunkPut = "buffered" | "complete" | "invalid" | "too_large";

/** One item's chunks, in any order. */
export class ChunkBuffer {
  private readonly chunks: Array<string | undefined>;
  private received = 0;
  private chars = 0;

  constructor(readonly total: number) {
    this.chunks = new Array<string | undefined>(total);
  }

  static valid(total: unknown): total is number {
    return typeof total === "number" && Number.isInteger(total) && total >= 1 && total <= ART_MAX_CHUNKS;
  }

  put(index: unknown, chunk: unknown): ChunkPut {
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= this.total) return "invalid";
    if (typeof chunk !== "string" || chunk.length > ART_CHUNK_CHARS || !BASE64_CHUNK.test(chunk)) return "invalid";
    const previous = this.chunks[index];
    if (previous === undefined) this.received += 1;
    this.chars += chunk.length - (previous?.length ?? 0);
    this.chunks[index] = chunk;
    if (this.chars > ART_MAX_ITEM_CHARS) return "too_large";
    return this.complete ? "complete" : "buffered";
  }

  get complete(): boolean {
    return this.received === this.total;
  }

  /** The joined base64, or null when it is not valid base64. */
  text(): string | null {
    const text = this.chunks.join("");
    if (!text || text.length % 4 !== 0 || !BASE64.test(text)) return null;
    return text;
  }
}
