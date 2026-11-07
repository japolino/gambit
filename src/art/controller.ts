/**
 * Backend wiring of the art pipeline: one controller for the extension,
 * per-user state (each user has their own connections, NovelAI account lock,
 * storage and browser). Handles the art / style / inset / pixel messages and
 * gives other backend code a small API:
 *
 *   const art = registerArt(spindle, (msg, userId) => spindle.sendToFrontend(msg, userId));
 *   // in onFrontendMessage: if (art.handle(msg, userId)) return;
 *   art.request("monster:wolf", { kind: "monster", monster: monsterBrief(def) }, 1, userId);
 *   art.status("monster:wolf", userId);
 *
 * Statuses go out batched as `art.update`; probes also as `style.probes`.
 */
import type { SpindleAPI } from "lumiverse-spindle-types";
import type { ArtPriority, ArtStatus, ToBackend, ToFrontend } from "../shared/protocol.js";
import { InsetBridge } from "./inset-bridge.js";
import type { PixelRect } from "./inset-geometry.js";
import { DEFAULT_LOOK_ID, LOOKS, LOOK_IDS, lookById, normalizeStyleLock, PROBE_SUBJECTS, probeKey, stylePath, type LookPreset, type StyleLock } from "./looks.js";
import { PixelBridge, type PixelItem } from "./pixel-bridge.js";
import { imageUrl, type PlanContext } from "./plan-kit.js";
import { plansFor } from "./plans.js";
import { base64ToBytes, bytesToBase64, encodedMayBeTransparent, sniffMime } from "./png.js";
import { discoverProviders, errorMessage, hasAnyProvider, NO_PROVIDERS, type ImageData, type ProviderSet } from "./providers.js";
import { ArtQueue, type GenOutput, type Plan } from "./queue.js";
import { ICON_SHEET_GRID, ICON_SHEET_MARGIN } from "./sheet-geometry.js";
import { ICONS_PER_SHEET, type ArtSpec } from "./specs.js";
import { cacheStore, CACHE_PATH, INDEX_PATH, JsonMapStore, type IndexEntry } from "./store.js";

export type ArtHost = Pick<SpindleAPI, "imageGen" | "images" | "userStorage"> & { log?: SpindleAPI["log"] };

export type ArtSend = (msg: ToFrontend, userId?: string) => void;

export interface ArtOptions {
  /** GPT lane concurrency (default 2). */
  gptConcurrency?: number;
  /** Re-read the image connections after this long (default 60 s). */
  providerTtlMs?: number;
  /** Queue overrides (tests). */
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  /** Debounce of status batches (default 40 ms; 0 = send at once). */
  batchMs?: number;
  /** Check the PNG header of transparent results (default true; needs the `images` permission). */
  checkAlpha?: boolean;
  /** Browser waits (defaults 15 s for an inset canvas, 30 s for crops and slices). */
  insetTimeoutMs?: number;
  pixelsTimeoutMs?: number;
}

export interface ArtApi {
  /** Ask for an asset (idempotent per key; a higher priority upgrades a queued job). */
  request(key: string, spec: ArtSpec, priority: ArtPriority, userId?: string): ArtStatus;
  /** Last known status (memory, then the persisted index), or null. */
  status(key: string, userId?: string): ArtStatus | null;
  /** Resolves when the key is ready or failed (also for persisted keys). */
  whenDone(key: string, userId?: string): Promise<ArtStatus>;
  /** Resolves once the persisted index of this user is loaded (status() answers persisted keys after it). */
  ready(userId?: string): Promise<void>;
  /** Route a frontend message; true when it was an art message. */
  handle(msg: ToBackend, userId?: string): boolean;
  /** Load (or clear) the campaign whose style lock applies. */
  setCampaign(campaignId: string | null, userId?: string): Promise<StyleLock | null>;
  /** The locked look of the current campaign, or null before style.pick. */
  styleLock(userId?: string): StyleLock | null;
  /** The look requests use now (the lock's, else the default). */
  look(userId?: string): LookPreset;
  /** Re-read the image connections now. */
  refreshProviders(userId?: string): Promise<ProviderSet>;
  /** Drop a finished key so the next request draws it again. */
  forget(key: string, userId?: string): Promise<void>;
  dispose(): Promise<void>;
}

interface UserState {
  userId: string | undefined;
  queue: ArtQueue;
  cache: JsonMapStore<GenOutput>;
  index: JsonMapStore<IndexEntry>;
  indexMem: Map<string, IndexEntry>;
  indexLoaded: Promise<void>;
  inset: InsetBridge;
  pixels: PixelBridge;
  providers: ProviderSet;
  providersAt: number;
  providersLoading: Promise<ProviderSet> | null;
  campaignId: string;
  lock: StyleLock | null;
  insetOff: Set<string>;
  specs: Map<string, ArtSpec>;
  pending: Map<string, ArtStatus>;
  flushTimer: ReturnType<typeof setTimeout> | null;
  sheetIcons: Map<string, ArtSpec & { kind: "icon_sheet" }>;
  noProviderNoticeSent: boolean;
  /** Requests waiting for the index and the provider discovery before they reach the queue. */
  enqueuing: Map<string, { priority: ArtPriority; done: Promise<void> }>;
  /** Final statuses the queue does not hold (no provider, icons sliced from a sheet). */
  local: Map<string, ArtStatus>;
  /** Sheets being sliced right now (one slice per sheet at a time). */
  slicing: Set<string>;
}

const OWNER = "\u0000owner";

export function registerArt(spindle: ArtHost, send: ArtSend, options: ArtOptions = {}): ArtApi {
  const users = new Map<string, UserState>();
  const log = (level: "info" | "warn" | "error", message: string) => {
    try {
      spindle.log?.[level](`gambit art: ${message}`);
    } catch {
      /* logging is best effort */
    }
  };

  function state(userId?: string): UserState {
    const id = userId ?? OWNER;
    let s = users.get(id);
    if (s) return s;
    const cache = new JsonMapStore<GenOutput>(spindle.userStorage, CACHE_PATH, userId);
    const index = new JsonMapStore<IndexEntry>(spindle.userStorage, INDEX_PATH, userId);
    const created: UserState = {
      userId,
      cache,
      index,
      indexMem: new Map(),
      indexLoaded: Promise.resolve(),
      inset: new InsetBridge((msg) => send(msg, userId), options.insetTimeoutMs),
      pixels: new PixelBridge((msg) => send(msg, userId), options.pixelsTimeoutMs),
      providers: NO_PROVIDERS,
      providersAt: 0,
      providersLoading: null,
      campaignId: "default",
      lock: null,
      insetOff: new Set(),
      specs: new Map(),
      pending: new Map(),
      flushTimer: null,
      sheetIcons: new Map(),
      noProviderNoticeSent: false,
      enqueuing: new Map(),
      local: new Map(),
      slicing: new Set(),
      queue: null as unknown as ArtQueue,
    };
    created.queue = new ArtQueue({
      generate: (call) => spindle.imageGen.generate(call),
      cache: cacheStore(cache),
      onStatus: (status) => onStatus(created, status),
      gptConcurrency: options.gptConcurrency,
      sleep: options.sleep,
      timeoutMs: options.timeoutMs,
      log,
    });
    created.indexLoaded = index.entries().then((entries) => {
      for (const [key, entry] of entries) {
        // Rebuilt from the id: early entries saved crops under a route that does not serve them.
        const fixed = { ...entry, url: imageUrl(entry.imageId) };
        created.indexMem.set(key, fixed);
        created.queue.restore({ key, state: "ready", imageId: fixed.imageId, url: fixed.url, cutout: fixed.cutout });
      }
    });
    users.set(id, created);
    return created;
  }

  /* ---------------- statuses ---------------- */

  function onStatus(s: UserState, status: ArtStatus): void {
    if (status.state === "ready" && status.imageId && status.url) {
      const entry: IndexEntry = { imageId: status.imageId, url: status.url, cutout: status.cutout === true, at: Date.now(), ...(status.via ? { via: status.via } : {}) };
      s.indexMem.set(status.key, entry);
      void s.index.set(status.key, entry);
      const sheet = s.sheetIcons.get(status.key);
      if (sheet) void sliceSheet(s, status.key, sheet, { imageId: status.imageId, url: status.url, cutout: status.cutout === true });
    }
    queueSend(s, status);
  }

  function queueSend(s: UserState, status: ArtStatus): void {
    if (status.state === "ready" || status.state === "failed") {
      if (!s.queue.status(status.key) || s.queue.status(status.key)!.state !== status.state) s.local.set(status.key, status);
    }
    s.pending.set(status.key, status);
    const batchMs = options.batchMs ?? 40;
    if (batchMs <= 0) return flush(s);
    if (!s.flushTimer) {
      s.flushTimer = setTimeout(() => flush(s), batchMs);
      (s.flushTimer as { unref?: () => void }).unref?.();
    }
  }

  function flush(s: UserState): void {
    if (s.flushTimer) clearTimeout(s.flushTimer);
    s.flushTimer = null;
    if (!s.pending.size) return;
    const items = [...s.pending.values()];
    s.pending.clear();
    send({ type: "art.update", items }, s.userId);
    if (items.some((i) => i.key.startsWith("style_probe:"))) sendProbes(s);
  }

  function statusOf(s: UserState, key: string): ArtStatus | null {
    const live = s.queue.status(key);
    if (live && live.state !== "failed") return live;
    const entry = s.indexMem.get(key);
    if (entry) return { key, state: "ready", imageId: entry.imageId, url: entry.url, cutout: entry.cutout, via: entry.via };
    return live ?? s.local.get(key) ?? null;
  }

  /* ---------------- providers ---------------- */

  function ensureProviders(s: UserState, force = false): Promise<ProviderSet> {
    const ttl = options.providerTtlMs ?? 60_000;
    if (!force && s.providersAt && Date.now() - s.providersAt < ttl) return Promise.resolve(s.providers);
    if (!s.providersLoading) {
      s.providersLoading = discoverProviders(spindle, s.userId)
        .then((p) => {
          s.providers = p;
          s.providersAt = Date.now();
          if (!hasAnyProvider(p) && !s.noProviderNoticeSent) {
            s.noProviderNoticeSent = true;
            send({ type: "notice", level: "info", text: "No NovelAI or OpenAI image connection found: Gambit uses placeholder art. Add one in Lumiverse's image settings." }, s.userId);
          }
          if (hasAnyProvider(p)) s.noProviderNoticeSent = false;
          return p;
        })
        .finally(() => {
          s.providersLoading = null;
        });
    }
    return s.providersLoading;
  }

  /* ---------------- plan context ---------------- */

  async function readImage(s: UserState, imageId: string): Promise<ImageData> {
    const bytes = await spindle.images.readBinary(imageId, s.userId);
    return { data: bytesToBase64(bytes), mimeType: sniffMime(bytes) };
  }

  async function upload(s: UserState, item: PixelItem, name: string): Promise<GenOutput> {
    const image = await spindle.images.upload({ data: base64ToBytes(item.data), filename: `gambit-${name}.png`, mime_type: "image/png" }, s.userId);
    return { imageId: image.id, url: imageUrl(image.id), cutout: item.preCut };
  }

  async function cropImage(s: UserState, source: GenOutput, rect: PixelRect): Promise<GenOutput> {
    const outcome = await s.pixels.run({ kind: "crop", sourceUrl: source.url, rect });
    if (!outcome.ok) throw new Error(`crop failed: ${outcome.error}`);
    const stored = await upload(s, outcome.items[0]!, `crop-${source.imageId}`);
    // The uncropped canvas is not used anywhere: delete it (best effort).
    void Promise.resolve(spindle.images.delete(source.imageId, s.userId)).catch(() => undefined);
    return stored;
  }

  function context(s: UserState): PlanContext {
    const look = currentLook(s);
    return {
      providers: s.providers,
      look,
      lock: s.lock,
      userId: s.userId,
      readImage: (id) => readImage(s, id),
      composeInset: (layout, url) => s.inset.compose(layout, url),
      cropImage: (source, rect) => cropImage(s, source, rect),
      insetOff: s.insetOff,
    };
  }

  /** Header check of a result that should be transparent (V5 may ignore the tag). */
  function withAlphaCheck(s: UserState, plan: Plan): Plan {
    if (options.checkAlpha === false || !plan.cutout) return plan;
    return {
      ...plan,
      finish: async (raw) => {
        const out = plan.finish ? await plan.finish(raw) : raw;
        if (!out.cutout) return out;
        try {
          const bytes = await spindle.images.readBinary(out.imageId, s.userId);
          return { ...out, cutout: encodedMayBeTransparent(bytes.subarray(0, 65536)) };
        } catch {
          return out;
        }
      },
    };
  }

  function currentLook(s: UserState): LookPreset {
    return (s.lock && lookById(s.lock.lookId)) || LOOKS[DEFAULT_LOOK_ID];
  }

  /* ---------------- requests ---------------- */

  function request(key: string, spec: ArtSpec, priority: ArtPriority, userId?: string): ArtStatus {
    const s = state(userId);
    s.specs.set(key, spec);
    const prio = Math.max(0, Math.min(3, Math.floor(Number(priority) || 0))) as ArtPriority;
    if (spec.kind === "icon_sheet") s.sheetIcons.set(key, spec);
    const planner = (p: ArtPriority) => plansFor(context(s), key, spec, p).map((plan) => withAlphaCheck(s, plan));
    const live = s.queue.status(key);
    if (live && (live.state === "queued" || live.state === "running")) {
      s.queue.request(key, prio, planner); // upgrades a queued job; a running one is left alone
      return live;
    }
    const known = statusOf(s, key);
    if (known?.state === "ready") {
      if (spec.kind === "icon_sheet" && known.imageId && known.url) void sliceSheet(s, key, spec, { imageId: known.imageId, url: known.url, cutout: known.cutout === true });
      // Send it again: a reloaded page asks for art it already had and has
      // no other way to learn it is ready.
      queueSend(s, known);
      return known;
    }
    const waiting = s.enqueuing.get(key);
    if (waiting) {
      waiting.priority = Math.min(waiting.priority, prio) as ArtPriority;
      return { key, state: "queued" };
    }
    const queued: ArtStatus = { key, state: "queued" };
    queueSend(s, queued);
    if (spec.kind === "icon_sheet") for (const icon of spec.icons.slice(0, ICONS_PER_SHEET)) if (statusOf(s, icon.key)?.state !== "ready") queueSend(s, { key: icon.key, state: "queued" });
    const entry = { priority: prio, done: Promise.resolve() };
    s.enqueuing.set(key, entry);
    entry.done = Promise.all([s.indexLoaded, ensureProviders(s)])
      .then(() => {
        const ready = statusOf(s, key);
        if (ready?.state === "ready") return queueSend(s, ready);
        if (!hasAnyProvider(s.providers)) return queueSend(s, { key, state: "failed", error: "No image connection: placeholder art." });
        s.queue.request(key, entry.priority, planner);
      })
      .catch((error) => queueSend(s, { key, state: "failed", error: errorMessage(error) }))
      .finally(() => {
        if (s.enqueuing.get(key) === entry) s.enqueuing.delete(key);
      });
    return queued;
  }

  async function sliceSheet(s: UserState, sheetKey: string, spec: ArtSpec & { kind: "icon_sheet" }, sheet: GenOutput): Promise<void> {
    if (s.slicing.has(sheetKey)) return;
    s.slicing.add(sheetKey);
    try {
      await sliceSheetNow(s, sheetKey, spec, sheet);
    } finally {
      s.slicing.delete(sheetKey);
    }
  }

  async function sliceSheetNow(s: UserState, sheetKey: string, spec: ArtSpec & { kind: "icon_sheet" }, sheet: GenOutput): Promise<void> {
    const icons = spec.icons.slice(0, ICONS_PER_SHEET);
    const missing = icons.filter((icon) => statusOf(s, icon.key)?.state !== "ready");
    if (!missing.length) return;
    const outcome = await s.pixels.run({ kind: "slice", sourceUrl: sheet.url, cols: ICON_SHEET_GRID.cols, rows: ICON_SHEET_GRID.rows, count: icons.length, margin: ICON_SHEET_MARGIN, trim: sheet.cutout });
    if (!outcome.ok) {
      for (const icon of missing) queueSend(s, { key: icon.key, state: "failed", error: `Icon sheet not sliced yet (${outcome.error}); it is retried when the page reconnects.` });
      return;
    }
    for (let i = 0; i < icons.length; i++) {
      const icon = icons[i]!;
      const item = outcome.items[i];
      if (!item || statusOf(s, icon.key)?.state === "ready") continue;
      try {
        const out = await upload(s, item, `icon-${sheet.imageId}-${i}`);
        onStatus(s, { key: icon.key, state: "ready", imageId: out.imageId, url: out.url, cutout: out.cutout });
      } catch (error) {
        queueSend(s, { key: icon.key, state: "failed", error: `Icon upload failed: ${errorMessage(error)}` });
      }
    }
    log("info", `sliced ${sheetKey} into ${icons.length} icons`);
  }

  /* ---------------- style ---------------- */

  function sendProbes(s: UserState): void {
    send(
      {
        type: "style.probes",
        looks: LOOK_IDS.map((lookId) => ({
          lookId,
          label: LOOKS[lookId].label,
          status: statusOf(s, probeKey(lookId, "gate")) ?? { key: probeKey(lookId, "gate"), state: "queued" },
        })),
      },
      s.userId,
    );
  }

  async function probe(s: UserState): Promise<void> {
    await ensureProviders(s, true);
    for (const lookId of LOOK_IDS) {
      for (const subject of PROBE_SUBJECTS) request(probeKey(lookId, subject), { kind: "style_probe", subject, lookId }, 0, s.userId);
    }
    sendProbes(s);
  }

  async function pick(s: UserState, lookId: string): Promise<void> {
    const look = lookById(lookId);
    if (!look) {
      send({ type: "notice", level: "warn", text: `Unknown look "${lookId}".` }, s.userId);
      return;
    }
    const anchors: StyleLock["anchors"] = {};
    for (const subject of PROBE_SUBJECTS) {
      const st = statusOf(s, probeKey(look.id, subject));
      if (st?.state === "ready" && st.imageId) anchors[subject] = { imageId: st.imageId, url: st.url ?? imageUrl(st.imageId) };
    }
    const lock: StyleLock = { version: 1, lookId: look.id, lockedAt: Date.now(), anchors };
    s.lock = lock;
    await spindle.userStorage.setJson(stylePath(s.campaignId), lock, s.userId ? { userId: s.userId } : undefined);
    send({ type: "style.locked", lookId: look.id }, s.userId);
  }

  async function setCampaign(campaignId: string | null, userId?: string): Promise<StyleLock | null> {
    const s = state(userId);
    s.campaignId = campaignId || "default";
    try {
      const raw = await spindle.userStorage.getJson<unknown>(stylePath(s.campaignId), { fallback: null, ...(userId ? { userId } : {}) });
      s.lock = normalizeStyleLock(raw);
    } catch {
      s.lock = null;
    }
    return s.lock;
  }

  /* ---------------- messages ---------------- */

  function handle(msg: ToBackend, userId?: string): boolean {
    if (!msg || typeof msg !== "object") return false;
    const s = () => state(userId);
    switch (msg.type) {
      case "hello": {
        // A (re)loaded page lost earlier canvas and pixel requests; sheets waiting for a slice try again.
        const st = s();
        st.inset.resend();
        st.pixels.resend();
        for (const [key, spec] of st.sheetIcons) {
          const sheet = statusOf(st, key);
          if (sheet?.state === "ready" && sheet.imageId && sheet.url) void sliceSheet(st, key, spec, { imageId: sheet.imageId, url: sheet.url, cutout: sheet.cutout === true });
        }
        // Looks drawn before the reload: show them again so one can be picked without redrawing.
        void st.indexLoaded.then(() => {
          const drawn = LOOK_IDS.flatMap((lookId) => PROBE_SUBJECTS.map((subject) => statusOf(st, probeKey(lookId, subject)))).filter((x): x is ArtStatus => x?.state === "ready");
          if (!drawn.length) return;
          for (const status of drawn) queueSend(st, status);
          sendProbes(st);
        });
        return false; // the main handler answers hello too
      }
      case "art.request": {
        const st = s();
        const spec = st.specs.get(msg.key);
        if (spec) request(msg.key, spec, msg.priority, userId);
        else
          void st.indexLoaded.then(() =>
            queueSend(st, statusOf(st, msg.key) ?? { key: msg.key, state: "failed", error: "Unknown art key (the backend has not asked for it)." }),
          );
        return true;
      }
      case "art.status": {
        const st = s();
        void st.indexLoaded.then(() => {
          const items = (Array.isArray(msg.keys) ? msg.keys : []).slice(0, 500).map((key) => statusOf(st, key) ?? { key, state: "failed" as const, error: "Unknown art key." });
          send({ type: "art.update", items }, userId);
        });
        return true;
      }
      case "style.probe":
        void probe(s()).catch((error) => log("error", `probe: ${errorMessage(error)}`));
        return true;
      case "style.pick":
        void pick(s(), msg.lookId).catch((error) => {
          log("error", `pick: ${errorMessage(error)}`);
          send({ type: "notice", level: "error", text: `Could not save the look: ${errorMessage(error)}` }, userId);
        });
        return true;
      case "inset.result":
      case "inset.error":
        s().inset.accept(msg);
        return true;
      case "art.pixels.chunk":
      case "art.pixels.error":
        s().pixels.accept(msg);
        return true;
      default:
        return false;
    }
  }

  // Start loading the owner's index right away (user-scoped extensions; operator scope loads per user on first use).
  state(undefined);

  return {
    request,
    status: (key, userId) => statusOf(state(userId), key),
    ready: (userId) => state(userId).indexLoaded,
    whenDone: async (key, userId) => {
      const s = state(userId);
      await s.indexLoaded;
      await s.enqueuing.get(key)?.done;
      const now = statusOf(s, key);
      if (now && (now.state === "ready" || now.state === "failed")) return now;
      return s.queue.wait(key);
    },
    handle,
    setCampaign,
    styleLock: (userId) => state(userId).lock,
    look: (userId) => currentLook(state(userId)),
    refreshProviders: (userId) => ensureProviders(state(userId), true),
    forget: async (key, userId) => {
      const s = state(userId);
      s.queue.forget(key);
      s.indexMem.delete(key);
      s.local.delete(key);
      await s.index.delete(key);
    },
    dispose: async () => {
      for (const s of users.values()) {
        s.queue.dispose();
        s.inset.dispose();
        s.pixels.dispose();
        flush(s);
        await Promise.all([s.cache.flush(), s.index.flush()]);
      }
    },
  };
}
