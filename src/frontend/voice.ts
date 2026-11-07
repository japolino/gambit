/**
 * Voice (docs/DESIGN.md 6.4): Gambit's own lines spoken through the host's
 * TTS (ctx.tts, text-to-speech-v1): board story scenes, the Meanwhile
 * montage and Parley replies. Off until the player turns
 * it on; the connection defaults to the user's own TTS connection. The
 * host needs the "media" permission for playback, which the user grants.
 */

interface TtsLike {
  speak(input: { text: string }, options?: { connectionId?: string }): Promise<void>;
  stop(): void;
}

export interface VoicePrefs {
  on: boolean;
  /** A TTS connection id; empty uses the user's default connection. */
  connectionId: string;
}

export interface Voice {
  /** The host has TTS at all. */
  readonly available: boolean;
  prefs(): VoicePrefs;
  set(p: Partial<VoicePrefs>): void;
  /** Speak a line now (stops what was playing). No-op when off. */
  say(text: string): void;
  /** Speak lines one after another; a new say/queue replaces them. */
  queue(lines: string[]): void;
  stop(): void;
  /** Why the last line could not play, if it failed (e.g. the media permission). */
  lastError(): string | null;
  onChange(fn: () => void): () => void;
}

const KEY = "gambit.voice";

/** The drawer's one voice picker: "" is no voice, "default" the user's default TTS connection, else a connection id. */
export type VoiceChoice = string;

export function voiceChoice(p: VoicePrefs): VoiceChoice {
  return !p.on ? "" : p.connectionId || "default";
}

export function prefsFor(choice: VoiceChoice): VoicePrefs {
  return choice === "" ? { on: false, connectionId: "" } : { on: true, connectionId: choice === "default" ? "" : choice };
}

/** Text the way it should be read aloud: no markdown, no stage asterisks, not too long. */
export function speakable(text: string, max = 900): string {
  const t = text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>~]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return end > max * 0.5 ? cut.slice(0, end + 1) : cut;
}

export function createVoice(tts: TtsLike | undefined, store: Pick<Storage, "getItem" | "setItem"> | null = safeStorage()): Voice {
  let prefs: VoicePrefs = { on: false, connectionId: "" };
  try {
    const raw = store?.getItem(KEY);
    if (raw) prefs = { ...prefs, ...(JSON.parse(raw) as Partial<VoicePrefs>) };
  } catch {
    /* defaults */
  }
  let error: string | null = null;
  let gen = 0;
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((f) => f());

  async function play(lines: string[]): Promise<void> {
    const mine = ++gen;
    for (const line of lines) {
      if (mine !== gen || !prefs.on || !tts) return;
      const text = speakable(line);
      if (!text) continue;
      try {
        await tts.speak({ text }, prefs.connectionId ? { connectionId: prefs.connectionId } : undefined);
        if (error) {
          error = null;
          changed();
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (mine === gen) {
          error = /permission|media/i.test(msg) ? "Gambit needs the media permission to speak (Extensions → Gambit → permissions)." : msg;
          changed();
        }
        return;
      }
    }
  }

  return {
    available: !!tts,
    prefs: () => ({ ...prefs }),
    set(p) {
      prefs = { ...prefs, ...p };
      try {
        store?.setItem(KEY, JSON.stringify(prefs));
      } catch {
        /* private mode */
      }
      if (!prefs.on) this.stop();
      changed();
    },
    say(text) {
      void play([text]);
    },
    queue(lines) {
      void play(lines);
    },
    stop() {
      gen++;
      try {
        tts?.stop();
      } catch {
        /* nothing playing */
      }
    },
    lastError: () => error,
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
