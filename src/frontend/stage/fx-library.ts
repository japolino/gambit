/**
 * Effect sheets and sounds from assets/ (src/shared/fx.ts), played by slot. The backend sends the manifest and the
 * files in parts (backend/fx-assets.ts); sheets are sliced into frames once, sounds decoded once. A slot with no
 * file plays nothing, so the stage works the same without assets.
 *
 *   fxLibrary.play("hit.slash", { layer, clock, x, y, ui })   an effect at a point, with its sound
 *   fxLibrary.loop("cutin.aura", {...})                      until stop() is called
 *   fxLibrary.sound("cutin.stamp")                            the slot's sound alone (stop() for long ones)
 *   fxLibrary.sheet("cutin.speed")                            the slot's frames, for code that drives its own sprite
 * The standalone preview prefers assets/demo/manifest.json (local-only extra files, see assets/README.md).
 */
import { Container, Rectangle, Sprite, Texture } from "pixi.js";
import type { FxManifest, FxSheet, FxSlot } from "../../shared/fx.js";
import type { Clock } from "./anim.js";

type Parts = { mime: string; parts: (string | undefined)[]; got: number };
type Live = { src: AudioBufferSourceNode | null; g: GainNode | null; stopped: boolean };

export type FxPlace = {
  layer: Container;
  clock: Clock;
  x: number;
  y: number;
  /** The stage's UI scale. */
  ui: number;
  /** Extra size factor on top of the sheet's own scale. */
  scale?: number;
  rotation?: number;
  /** Mirror horizontally (an enemy's move goes the other way). */
  flip?: boolean;
  /** Playback speed factor. */
  speed?: number;
  /** Skip the slot's sound. */
  silent?: boolean;
  /** Extra gain on the slot's sound. */
  gain?: number;
  alpha?: number;
  /** Play only frames [from, to) of the sheet. */
  frames?: [number, number];
  /** Override the sheet's blend. */
  blend?: FxSheet["blend"];
  /** Fade the frame's edges out (default true for additive sheets: a glow clipped at the cell edge shows a square). */
  soft?: boolean;
  tint?: number;
};

export type SoundHandle = { stop: (fadeMs?: number) => void };
const NO_SOUND: SoundHandle = { stop: () => {} };
/** A sound fired (for preview capture logs): the slot, its file, the final 0..1 volume, and when (seconds, page clock). */
export type SoundCue = { slot: FxSlot; file: string; volume: number; at: number };

class FxLibrary {
  private manifest: FxManifest | null = null;
  private asked = false;
  private incoming = new Map<string, Parts>();
  private frames = new Map<string, Texture[]>();
  private audio = new Map<string, AudioBuffer>();
  private audioData = new Map<string, ArrayBuffer>();
  private ctx: AudioContext | null = null;
  /** 0..1, for every sound. */
  volume = 0.8;
  muted = false;
  /** Called for every sound that would play (also when muted), e.g. to log cues for a capture. */
  onSound: ((cue: SoundCue) => void) | null = null;
  /** A clock for the same-sound guard and the cue log (the preview's capture steps its own). */
  now: () => number = () => (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
  /** When each file last started, so a burst of hits does not stack the same sound. */
  private lastStart = new Map<string, number>();

  /** Ask the backend once. */
  request(send: (msg: { type: "fx.get" }) => void): void {
    if (this.asked) return;
    this.asked = true;
    send({ type: "fx.get" });
  }

  /** Load straight from a URL holding assets/ (the standalone preview serves the repo's at /assets/). */
  async loadFrom(base: string): Promise<void> {
    this.asked = true;
    const get = (name: string) => fetch(`${base}${name}`).then((r) => (r.ok ? r.json() : null)).catch(() => null) as Promise<FxManifest | null>;
    const m = (await get("demo/manifest.json")) ?? (await get("manifest.json"));
    this.manifest = m;
    if (!m) return;
    const used = new Set<string>();
    for (const s of Object.values(m.slots)) {
      if (s.fx && s.fx !== "none" && m.effects[s.fx]) used.add(m.effects[s.fx]!.file);
      if (s.sound && s.sound !== "none" && m.sounds[s.sound]) used.add(m.sounds[s.sound]!.file);
    }
    await Promise.all([...used].map(async (file) => {
      const r = await fetch(`${base}${file}`).catch(() => null);
      if (!r?.ok) return;
      const bytes = new Uint8Array(await r.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const ext = file.split(".").pop()!.toLowerCase();
      const mime = ext === "png" ? "image/png" : ext === "mp3" ? "audio/mpeg" : ext === "ogg" ? "audio/ogg" : ext === "m4a" ? "audio/mp4" : "audio/wav";
      await this.accept(file, mime, btoa(bin));
    }));
  }

  /** Feed backend messages here; returns true when the message was an fx one. */
  receive(msg: { type: string; [k: string]: unknown }): boolean {
    if (msg.type === "fx.manifest") {
      this.manifest = (msg.manifest as FxManifest | null) ?? null;
      return true;
    }
    if (msg.type !== "fx.file") return false;
    const file = msg.file as string;
    const parts = msg.parts as number;
    let p = this.incoming.get(file);
    if (!p || p.parts.length !== parts) {
      p = { mime: msg.mime as string, parts: new Array(parts), got: 0 };
      this.incoming.set(file, p);
    }
    const i = msg.part as number;
    if (p.parts[i] === undefined) p.got++;
    p.parts[i] = msg.data as string;
    if (p.got === parts) {
      this.incoming.delete(file);
      void this.accept(file, p.mime, p.parts.join(""));
    }
    return true;
  }

  private async accept(file: string, mime: string, b64: string): Promise<void> {
    if (mime.startsWith("image/")) {
      const img = new Image();
      img.src = `data:${mime};base64,${b64}`;
      await img.decode().catch(() => null);
      if (!img.naturalWidth) return;
      const base = Texture.from(img);
      for (const sheet of Object.values(this.manifest?.effects ?? {})) {
        if (sheet.file !== file) continue;
        this.frames.set(file, slice(base, sheet));
      }
    } else if (mime.startsWith("audio/")) {
      const bin = atob(b64);
      const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      this.audioData.set(file, buf.buffer);
    }
  }

  private slot(slot: FxSlot): { sheet: FxSheet | null; frames: Texture[] | null; sound: string | null; soundVol: number; tint?: number; size: number } {
    const m = this.manifest;
    const s = m?.slots[slot];
    const sheet = s?.fx && s.fx !== "none" ? m!.effects[s.fx] ?? null : null;
    const snd = s?.sound && s.sound !== "none" ? m!.sounds[s.sound] ?? null : null;
    const tint = s?.tint && /^#[0-9a-f]{6}$/i.test(s.tint) ? parseInt(s.tint.slice(1), 16) : undefined;
    return { sheet, frames: sheet ? this.frames.get(sheet.file) ?? null : null, sound: snd?.file ?? null, soundVol: snd?.volume ?? 0.8, tint, size: s?.scale && s.scale > 0 ? s.scale : 1 };
  }

  /** Whether the slot names a sound (loaded or still arriving). */
  hasSound(slot: FxSlot): boolean {
    return !!this.slot(slot).sound;
  }

  /** Whether the slot has a loaded effect sheet. */
  hasSheet(slot: FxSlot): boolean {
    return !!this.slot(slot).frames;
  }

  /** Whether the slot has a loaded effect or sound. */
  has(slot: FxSlot): boolean {
    const s = this.slot(slot);
    return !!s.frames || (!!s.sound && this.audioData.has(s.sound));
  }

  /** Play the slot's sound (if any); stop() fades it out (for long ones like an aura). */
  sound(slot: FxSlot, gain = 1): SoundHandle {
    const s = this.slot(slot);
    if (!s.sound) return NO_SOUND;
    if (gain <= 0) return NO_SOUND;
    const now = this.now();
    // The same file again within 70 ms (a multi-hit ripple) is one sound, not a stack.
    if (now - (this.lastStart.get(s.sound) ?? -1e9) < 0.07) return NO_SOUND;
    this.lastStart.set(s.sound, now);
    const vol = Math.max(0, Math.min(1, s.soundVol * gain * this.volume));
    this.onSound?.({ slot, file: s.sound, volume: vol, at: now });
    if (this.muted || vol <= 0) return NO_SOUND;
    const live: Live = { src: null, g: null, stopped: false };
    void this.playSound(s.sound, vol, live);
    return {
      stop: (fadeMs = 120) => {
        live.stopped = true;
        const ctx = this.ctx;
        if (!ctx || !live.src || !live.g) return;
        try {
          const t = ctx.currentTime;
          live.g.gain.cancelScheduledValues(t);
          live.g.gain.setValueAtTime(live.g.gain.value, t);
          live.g.gain.linearRampToValueAtTime(0, t + fadeMs / 1000);
          live.src.stop(t + fadeMs / 1000 + 0.02);
        } catch {
          // Already stopped.
        }
      },
    };
  }

  private async playSound(file: string, vol: number, live: Live): Promise<void> {
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === "suspended") await this.ctx.resume().catch(() => {});
      let buf = this.audio.get(file);
      if (!buf) {
        const data = this.audioData.get(file);
        if (!data) return;
        buf = await this.ctx.decodeAudioData(data.slice(0));
        this.audio.set(file, buf);
      }
      if (live.stopped) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = vol;
      src.connect(g).connect(this.ctx.destination);
      src.start();
      live.src = src;
      live.g = g;
    } catch {
      // No audio (blocked autoplay, undecodable file): the effect still plays.
    }
  }

  /** The slot's frames and sheet, for code that drives its own sprite (null when the slot has none loaded). */
  sheet(slot: FxSlot): { frames: Texture[]; sheet: FxSheet } | null {
    const s = this.slot(slot);
    return s.frames && s.sheet ? { frames: s.frames, sheet: s.sheet } : null;
  }

  /** Play the slot's effect once at a point (and its sound); resolves when the last frame has shown. */
  play(slot: FxSlot, at: FxPlace): Promise<void> {
    if (!at.silent) this.sound(slot, at.gain ?? 1);
    const s = this.slot(slot);
    if (!s.frames || !s.sheet) return Promise.resolve();
    const from = Math.max(0, Math.min(s.frames.length - 1, at.frames?.[0] ?? 0));
    const end = Math.min(s.frames.length, Math.max(from + 1, at.frames?.[1] ?? s.frames.length));
    const { sprite, step } = this.mount(s.sheet, s.frames, { tint: s.tint, ...at, scale: (at.scale ?? 1) * s.size });
    step(from);
    const fps = s.sheet.fps * (at.speed ?? 1);
    const start = at.clock.now;
    return new Promise((resolve) => {
      const stop = at.clock.onFrame((now) => {
        const i = from + Math.floor((now - start) * fps);
        if (i >= end || sprite.destroyed) {
          stop();
          if (!sprite.destroyed) sprite.destroy();
          resolve();
          return;
        }
        step(i);
      });
    });
  }

  /** Loop the slot's effect at a point until stop(); move it with the returned sprite. */
  loop(slot: FxSlot, at: FxPlace): { sprite: Sprite | null; stop: () => void } {
    const snd = at.silent ? NO_SOUND : this.sound(slot, at.gain ?? 1);
    const s = this.slot(slot);
    if (!s.frames || !s.sheet) return { sprite: null, stop: () => snd.stop() };
    const { sprite, step } = this.mount(s.sheet, s.frames, { tint: s.tint, ...at, scale: (at.scale ?? 1) * s.size });
    const fps = s.sheet.fps * (at.speed ?? 1);
    const start = at.clock.now;
    const off = at.clock.onFrame((now) => {
      if (sprite.destroyed) return off();
      step(Math.floor((now - start) * fps) % s.frames!.length);
    });
    return { sprite, stop: () => { snd.stop(); off(); if (!sprite.destroyed) sprite.destroy(); } };
  }

  private mount(sheet: FxSheet, frames: Texture[], at: FxPlace): { sprite: Sprite; step: (i: number) => void } {
    const sprite = new Sprite(frames[0]!);
    if (at.soft ?? (at.blend ?? sheet.blend) !== "normal") {
      // A soft oval over the cell, as an alpha mask: the frame's edges fade to nothing.
      const m = new Sprite(softEdge());
      m.anchor.set(0.5);
      m.width = sheet.frameW;
      m.height = sheet.frameH;
      sprite.addChild(m);
      sprite.mask = m;
    }
    sprite.anchor.set(0.5);
    sprite.position.set(at.x, at.y);
    sprite.rotation = at.rotation ?? 0;
    const k = sheet.scale * (at.scale ?? 1) * at.ui;
    sprite.scale.set(at.flip ? -k : k, k);
    const blend = at.blend ?? sheet.blend;
    sprite.blendMode = blend === "normal" ? "normal" : blend;
    sprite.alpha = at.alpha ?? 1;
    if (at.tint !== undefined) sprite.tint = at.tint;
    at.layer.addChild(sprite);
    return { sprite, step: (i) => { sprite.texture = frames[Math.max(0, Math.min(frames.length - 1, i))]!; } };
  }
}

let edgeTex: Texture | null = null;
/** A white oval, opaque in the middle and clear at the rim (drawn once). */
function softEdge(): Texture {
  if (edgeTex) return edgeTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.62, "rgba(255,255,255,1)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  edgeTex = Texture.from(c);
  return edgeTex;
}

function slice(base: Texture, sheet: FxSheet): Texture[] {
  const cols = Math.max(1, Math.floor(sheet.width / sheet.frameW));
  const out: Texture[] = [];
  for (let i = 0; i < sheet.frames; i++) {
    const x = (i % cols) * sheet.frameW;
    const y = Math.floor(i / cols) * sheet.frameH;
    if (y + sheet.frameH > base.height) break;
    out.push(new Texture({ source: base.source, frame: new Rectangle(x, y, sheet.frameW, sheet.frameH) }));
  }
  return out;
}

/** One library per page: the files arrive once and every stage uses them. */
export const fxLibrary = new FxLibrary();
