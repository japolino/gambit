/**
 * The music player: tracks stream straight from where they're published, crossfade when the moment changes, and sit
 * lower under the night's curtain and under a voice. Off until the player turns it on, because turning it on means
 * this browser talks to another site.
 */
import type { Track } from "../meaning/music.js";

export interface MusicPrefs {
  on: boolean;
  /** 0..1 */
  volume: number;
}

/** What the player needs from an audio element. */
export interface Deck {
  src: string;
  loop: boolean;
  volume: number;
  preload: string;
  play(): Promise<void>;
  pause(): void;
  addEventListener(type: "error", fn: () => void): void;
}

export interface Music {
  prefs(): MusicPrefs;
  setOn(on: boolean): void;
  /** Follows a slider: no change notice, so the slider isn't redrawn under the thumb. */
  setVolume(volume: number): void;
  play(track: Track): void;
  stop(): void;
  /** Lower it (the night's curtain), or bring it back. */
  dim(on: boolean): void;
  /** Lower it while a voice speaks. */
  duck(on: boolean): void;
  now(): Track | null;
  /** Every track played here, newest first: the credits the licence asks for. */
  credits(): string[];
  error(): string | null;
  fail(error: string | null): void;
  onChange(fn: () => void): () => void;
  /** A new track came in. */
  onTrack(fn: (t: Track) => void): () => void;
  destroy(): void;
}

const KEY = "gambit.music";
const CREDITS = "gambit.music.credits";
const STEP_MS = 50;

function safeStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

export function createMusic({ makeDeck = () => new Audio() as Deck, store = safeStorage(), fadeMs = 2400, gesture = onNextGesture }: { makeDeck?: () => Deck; store?: Pick<Storage, "getItem" | "setItem"> | null; fadeMs?: number; gesture?: (fn: () => void) => () => void } = {}): Music {
  let prefs: MusicPrefs = { on: false, volume: 0.35 };
  let credits: string[] = [];
  try {
    const raw = store?.getItem(KEY);
    if (raw) prefs = { ...prefs, ...(JSON.parse(raw) as Partial<MusicPrefs>) };
    const c = store?.getItem(CREDITS);
    if (c) credits = (JSON.parse(c) as string[]).slice(0, 60);
  } catch {
    /* defaults */
  }
  const save = () => {
    try {
      store?.setItem(KEY, JSON.stringify(prefs));
      store?.setItem(CREDITS, JSON.stringify(credits));
    } catch {
      /* private mode */
    }
  };

  const changed = new Set<() => void>();
  const tracked = new Set<(t: Track) => void>();
  const notify = () => changed.forEach((f) => f());

  let current: { deck: Deck; track: Track; level: number; started: boolean } | null = null;
  /** What keeps playing until the next track has really started: a slow stream shouldn't leave a silence. */
  let holding: { deck: Deck; track: Track; level: number }[] = [];
  /** Each fades from where it was, whatever the level does meanwhile. */
  let fading: { deck: Deck; level: number; gain: number }[] = [];
  let dimmed = false;
  let ducked = false;
  let failure: string | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  let waiting: (() => void) | null = null;

  const target = () => prefs.volume * (dimmed ? 0.35 : 1) * (ducked ? 0.45 : 1);
  const clamp = (v: number) => Math.max(0, Math.min(1, v));

  /** One step of every fade; with no fade time it lands at once. */
  function step(): void {
    const by = fadeMs > 0 ? STEP_MS / fadeMs : 1;
    if (current?.started) {
      current.level = clamp(current.level + by);
      current.deck.volume = clamp(current.level * target());
    }
    fading = fading.filter((f) => {
      f.level = clamp(f.level - by);
      f.deck.volume = clamp(f.level * f.gain);
      if (f.level > 0) return true;
      f.deck.pause();
      return false;
    });
    if ((!current?.started || current.level >= 1) && !fading.length) {
      clearInterval(timer);
      timer = undefined;
    }
  }
  function run(): void {
    if (fadeMs <= 0) return step();
    timer ??= setInterval(step, STEP_MS);
  }
  const level = () => {
    if (current) current.deck.volume = clamp(current.level * target());
    for (const h of holding) h.deck.volume = clamp(h.level * target());
  };

  function letGo(): void {
    fading.push(...holding.map((h) => ({ deck: h.deck, level: h.level, gain: h.level > 0 ? h.deck.volume / h.level : 0 })));
    holding = [];
  }

  /** The new track is really playing: only now does the old one go, and only now is it announced. */
  function begin(deck: Deck): void {
    if (current?.deck !== deck || current.started) return;
    current.started = true;
    letGo();
    run();
    const { track } = current;
    tracked.forEach((f) => f(track));
  }

  function start(deck: Deck): void {
    void deck.play().then(
      () => begin(deck),
      () => {
        if (current?.deck !== deck || failure) return;
        // The browser wants a tap first: the next one starts it.
        waiting?.();
        waiting = gesture(() => {
          waiting = null;
          if (current?.deck === deck) start(deck);
        });
      },
    );
  }

  /** Leave the track that's on: one that never started has nothing to fade. */
  function leave(): void {
    if (current?.started) holding.push({ deck: current.deck, track: current.track, level: current.level });
    else current?.deck.pause();
  }

  const music: Music = {
    prefs: () => ({ ...prefs }),
    setOn(on) {
      prefs = { ...prefs, on };
      save();
      if (!on) music.stop();
      notify();
    },
    setVolume(volume) {
      prefs = { ...prefs, volume: clamp(volume) };
      save();
      level();
    },
    play(track) {
      if (!prefs.on) return;
      if (current?.track.url === track.url) return;
      leave();
      // The moment came back before its replacement started: it never stopped.
      const held = holding.find((h) => h.track.url === track.url);
      if (held) {
        holding = holding.filter((h) => h !== held);
        current = { ...held, started: true };
        failure = null;
        run();
        notify();
        return;
      }
      const deck = makeDeck();
      deck.preload = "auto";
      deck.loop = true;
      deck.volume = 0;
      deck.src = track.url;
      deck.addEventListener("error", () => {
        if (current?.deck !== deck) return;
        failure = `"${track.title}" wouldn't play.`;
        notify();
      });
      current = { deck, track, level: 0, started: false };
      failure = null;
      credits = [track.credit, ...credits.filter((c) => c !== track.credit)].slice(0, 60);
      save();
      start(deck);
      notify();
    },
    stop() {
      waiting?.();
      waiting = null;
      leave();
      letGo();
      current = null;
      run();
      notify();
    },
    dim(on) {
      dimmed = on;
      level();
    },
    duck(on) {
      ducked = on;
      level();
    },
    now: () => current?.track ?? null,
    credits: () => [...credits],
    error: () => failure,
    fail(error) {
      failure = error;
      notify();
    },
    onChange(fn) {
      changed.add(fn);
      return () => changed.delete(fn);
    },
    onTrack(fn) {
      tracked.add(fn);
      return () => tracked.delete(fn);
    },
    destroy() {
      waiting?.();
      clearInterval(timer);
      current?.deck.pause();
      holding.forEach((h) => h.deck.pause());
      fading.forEach((f) => f.deck.pause());
      current = null;
      holding = [];
      fading = [];
    },
  };
  return music;
}

function onNextGesture(fn: () => void): () => void {
  const go = () => {
    off();
    fn();
  };
  const off = () => {
    window.removeEventListener("pointerdown", go, true);
    window.removeEventListener("keydown", go, true);
  };
  window.addEventListener("pointerdown", go, true);
  window.addEventListener("keydown", go, true);
  return off;
}
