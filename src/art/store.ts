/**
 * Persistence for the art pipeline in `spindle.userStorage` (per user):
 * - `art/cache.json`: content hash -> final image (the queue's cache), so no
 *   picture is generated twice, across restarts.
 * - `art/index.json`: art key -> last ready image, so `status(key)` answers
 *   after a restart without the spec.
 * Writes are debounced and serialized; a failed read starts empty.
 */
import type { SpindleAPI } from "lumiverse-spindle-types";
import type { ArtCacheStore, GenOutput } from "./queue.js";

export type StorageLike = Pick<SpindleAPI["userStorage"], "getJson" | "setJson">;

export const CACHE_PATH = "art/cache.json";
export const INDEX_PATH = "art/index.json";

interface FileShape<V> {
  version: 1;
  entries: Record<string, V>;
}

export class JsonMapStore<V> {
  private data: Map<string, V> | null = null;
  private loading: Promise<Map<string, V>> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private writing: Promise<void> = Promise.resolve();
  private dirty = false;

  constructor(
    private readonly storage: StorageLike,
    private readonly path: string,
    private readonly userId?: string,
    private readonly debounceMs = 250,
  ) {}

  private load(): Promise<Map<string, V>> {
    if (this.data) return Promise.resolve(this.data);
    if (!this.loading) {
      this.loading = (async () => {
        let file: FileShape<V> | null = null;
        try {
          file = await this.storage.getJson<FileShape<V> | null>(this.path, { fallback: null, ...(this.userId ? { userId: this.userId } : {}) });
        } catch {
          file = null;
        }
        const entries = file && typeof file === "object" && file.entries && typeof file.entries === "object" ? file.entries : {};
        this.data = new Map(Object.entries(entries));
        return this.data;
      })();
    }
    return this.loading;
  }

  async get(key: string): Promise<V | null> {
    return (await this.load()).get(key) ?? null;
  }

  async set(key: string, value: V): Promise<void> {
    (await this.load()).set(key, value);
    this.schedule();
  }

  async delete(key: string): Promise<void> {
    if ((await this.load()).delete(key)) this.schedule();
  }

  async entries(): Promise<Array<[string, V]>> {
    return [...(await this.load()).entries()];
  }

  private schedule(): void {
    this.dirty = true;
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.debounceMs);
    (this.timer as { unref?: () => void }).unref?.();
  }

  /** Write now if anything changed (also used by tests and on dispose). */
  flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.writing = this.writing.then(async () => {
      if (!this.dirty || !this.data) return;
      this.dirty = false;
      const file: FileShape<V> = { version: 1, entries: Object.fromEntries(this.data) };
      try {
        await this.storage.setJson(this.path, file, this.userId ? { userId: this.userId } : undefined);
      } catch {
        this.dirty = true; // try again with the next change
      }
    });
    return this.writing;
  }
}

export interface IndexEntry extends GenOutput {
  at: number;
}

/** The queue's cache over a JsonMapStore. */
export function cacheStore(store: JsonMapStore<GenOutput>): ArtCacheStore {
  return {
    get: (hash) => store.get(hash),
    set: (hash, value) => store.set(hash, { imageId: value.imageId, url: value.url, cutout: value.cutout, ...(value.via ? { via: value.via } : {}), ...(value.face !== undefined ? { face: value.face } : {}) }),
  };
}

/** In-memory cache (tests, or when storage is unavailable). */
export function memoryCache(seed: Record<string, GenOutput> = {}): ArtCacheStore & { entries: Map<string, GenOutput> } {
  const entries = new Map(Object.entries(seed));
  return {
    entries,
    get: async (hash) => entries.get(hash) ?? null,
    set: async (hash, value) => {
      entries.set(hash, value);
    },
  };
}
