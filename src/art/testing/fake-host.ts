/**
 * In-memory fake of the Spindle host surfaces the art pipeline uses
 * (imageGen, images, userStorage, log) and of the frontend channel. Pattern
 * from Inlay Illustrator (inlay-illustrator, origin/stable @ 6b747bf,
 * src/backend/testing/fake-host.ts): plain data on the returned object, a
 * FIFO of scripted image results, every generate call recorded.
 */
import type { ImageDTO, ImageGenConnectionDTO, ImageGenRequestDTO, ImageGenResultDTO } from "lumiverse-spindle-types";
import type { ArtHost } from "../controller.js";
import { bytesToBase64 } from "../png.js";

export type Scripted = ImageGenResultDTO | Error | ((input: ImageGenRequestDTO, call: number) => ImageGenResultDTO | Promise<ImageGenResultDTO>);

export interface FakeHost {
  host: ArtHost;
  connections: ImageGenConnectionDTO[];
  calls: ImageGenRequestDTO[];
  queue: Scripted[];
  /** Used when the queue is empty: a fresh image id per call. */
  autoImages: boolean;
  files: Map<string, unknown>;
  images: Map<string, Uint8Array>;
  uploads: Array<{ id: string; bytes: Uint8Array; filename?: string }>;
  deleted: string[];
  logs: string[];
}

/** A PNG header of the given size (enough for pngSize / encodedMayBeTransparent). colourType 6 = RGBA, 2 = RGB. */
export function pngHeader(width: number, height: number, colourType = 6): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(57);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  b.set([0, 0, 0, 13], 8);
  b.set([0x49, 0x48, 0x44, 0x52], 12); // IHDR
  const u32 = (at: number, v: number) => b.set([(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255], at);
  u32(16, width);
  u32(20, height);
  b[24] = 8;
  b[25] = colourType;
  // next chunk: IDAT (length 0) so tRNS scanning stops
  u32(33, 0);
  b.set([0x49, 0x44, 0x41, 0x54], 37);
  return b;
}

export function pngBase64(width: number, height: number, colourType = 6): string {
  return bytesToBase64(pngHeader(width, height, colourType));
}

export function connection(over: Partial<ImageGenConnectionDTO> & { id: string; provider: string }): ImageGenConnectionDTO {
  return { name: over.id, api_url: "", model: "", is_default: false, has_api_key: true, default_parameters: {}, metadata: {}, created_at: 0, updated_at: 0, ...over };
}

export function createFakeHost(init: { connections?: ImageGenConnectionDTO[] } = {}): FakeHost {
  let counter = 0;
  const fake: FakeHost = {
    connections: init.connections ?? [],
    calls: [],
    queue: [],
    autoImages: true,
    files: new Map(),
    images: new Map(),
    uploads: [],
    deleted: [],
    logs: [],
    host: null as unknown as ArtHost,
  };
  const host = {
    imageGen: {
      async generate(input: ImageGenRequestDTO): Promise<ImageGenResultDTO> {
        fake.calls.push(input);
        const call = fake.calls.length;
        const next = fake.queue.shift();
        if (next instanceof Error) throw next;
        if (typeof next === "function") return next(input, call);
        if (next) return next;
        if (!fake.autoImages) throw new Error("no scripted image");
        const id = `img-${++counter}`;
        fake.images.set(id, pngHeader(64, 64, 6));
        return { imageDataUrl: "", model: String(input.model ?? ""), provider: "fake", imageId: id, imageUrl: `/api/v1/image-gen/results/${id}` };
      },
      async listConnections() {
        return fake.connections;
      },
      async getConnection(id: string) {
        return fake.connections.find((c) => c.id === id) ?? null;
      },
      async getModels() {
        return [];
      },
    },
    images: {
      async readBinary(id: string) {
        const bytes = fake.images.get(id);
        if (!bytes) throw new Error(`image ${id} not found`);
        return bytes;
      },
      async upload(input: { data: Uint8Array; filename?: string }) {
        const id = `up-${++counter}`;
        fake.images.set(id, input.data);
        fake.uploads.push({ id, bytes: input.data, filename: input.filename });
        return { id, url: `/api/v1/images/${id}` } as unknown as ImageDTO;
      },
      async delete(id: string) {
        fake.deleted.push(id);
        return fake.images.delete(id);
      },
    },
    userStorage: {
      async getJson<T>(path: string, options?: { fallback?: T }) {
        return (fake.files.has(path) ? structuredClone(fake.files.get(path)) : options?.fallback) as T;
      },
      async setJson(path: string, value: unknown) {
        fake.files.set(path, structuredClone(value));
      },
    },
    log: {
      info: (m: string) => fake.logs.push(`info ${m}`),
      warn: (m: string) => fake.logs.push(`warn ${m}`),
      error: (m: string) => fake.logs.push(`error ${m}`),
    },
  };
  fake.host = host as unknown as ArtHost;
  return fake;
}

/** Let pending promises and zero-delay timers run. */
export async function settle(rounds = 20): Promise<void> {
  for (let i = 0; i < rounds; i++) await new Promise((r) => setTimeout(r, 0));
}
