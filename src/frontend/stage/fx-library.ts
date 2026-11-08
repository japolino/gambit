/**
 * Effect sheets and sounds from assets/ (src/shared/fx.ts), played by slot. The backend sends the manifest and the
 * files in parts (backend/fx-assets.ts); sheets are sliced into frames once, sounds decoded once. A slot with no
 * file plays nothing, so the stage works the same without assets.
 *
 *   fxLibrary.play("hit.slash", { layer, clock, x, y, ui })   an effect at a point, with its sound
 *   fxLibrary.loop("cutin.aura", {...})                      until stop() is called
 *   fxLibrary.sound("cutin.stamp")                            the slot's sound alone
 */
import { Container, Rectangle, Sprite, Texture } from "pixi.js";
import type { FxManifest, FxSheet, FxSlot } from "../../shared/fx.js";
import type { Clock } from "./anim.js";

type Parts = { mime: string; parts: (string | undefined)[]; got: number };

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
  alpha?: number;
};

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

  /** Ask the backend once. */
  request(send: (msg: { type: "fx.get" }) => void): void {
    if (this.asked) return;
    this.asked = true;
    send({ type: "fx.get" });
  }

  /** Load straight from a URL holding assets/ (the standalone preview serves the repo's at /assets/). */
  async loadFrom(base: string): Promise<void> {
    this.asked = true;
    const m = (await fetch(`${base}manifest.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null)) as FxManifest | null;
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

  private slot(slot: FxSlot): { sheet: FxSheet | null; frames: Texture[] | null; sound: string | null; soundVol: number } {
    const m = this.manifest;
    const s = m?.slots[slot];
    const sheet = s?.fx && s.fx !== "none" ? m!.effects[s.fx] ?? null : null;
    const snd = s?.sound && s.sound !== "none" ? m!.sounds[s.sound] ?? null : null;
    return { sheet, frames: sheet ? this.frames.get(sheet.file) ?? null : null, sound: snd?.file ?? null, soundVol: snd?.volume ?? 0.8 };
  }

  /** Whether the slot has a loaded effect or sound. */
  has(slot: FxSlot): boolean {
    const s = this.slot(slot);
    return !!s.frames || (!!s.sound && this.audioData.has(s.sound));
  }

  /** Play the slot's sound (if any). */
  sound(slot: FxSlot, gain = 1): void {
    const s = this.slot(slot);
    if (!s.sound || this.muted) return;
    void this.playSound(s.sound, s.soundVol * gain);
  }

  private async playSound(file: string, vol: number): Promise<void> {
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
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = Math.max(0, Math.min(1, vol * this.volume));
      src.connect(g).connect(this.ctx.destination);
      src.start();
    } catch {
      // No audio (blocked autoplay, undecodable file): the effect still plays.
    }
  }

  /** Play the slot's effect once at a point (and its sound); resolves when the last frame has shown. */
  play(slot: FxSlot, at: FxPlace): Promise<void> {
    if (!at.silent) this.sound(slot);
    const s = this.slot(slot);
    if (!s.frames || !s.sheet) return Promise.resolve();
    const { sprite, step } = this.mount(s.sheet, s.frames, at);
    const fps = s.sheet.fps * (at.speed ?? 1);
    const start = at.clock.now;
    return new Promise((resolve) => {
      const stop = at.clock.onFrame((now) => {
        const i = Math.floor((now - start) * fps);
        if (i >= s.frames!.length || sprite.destroyed) {
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
    if (!at.silent) this.sound(slot);
    const s = this.slot(slot);
    if (!s.frames || !s.sheet) return { sprite: null, stop: () => {} };
    const { sprite, step } = this.mount(s.sheet, s.frames, at);
    const fps = s.sheet.fps * (at.speed ?? 1);
    const start = at.clock.now;
    const off = at.clock.onFrame((now) => {
      if (sprite.destroyed) return off();
      step(Math.floor((now - start) * fps) % s.frames!.length);
    });
    return { sprite, stop: () => { off(); if (!sprite.destroyed) sprite.destroy(); } };
  }

  private mount(sheet: FxSheet, frames: Texture[], at: FxPlace): { sprite: Sprite; step: (i: number) => void } {
    const sprite = new Sprite(frames[0]!);
    sprite.anchor.set(0.5);
    sprite.position.set(at.x, at.y);
    sprite.rotation = at.rotation ?? 0;
    const k = sheet.scale * (at.scale ?? 1) * at.ui;
    sprite.scale.set(at.flip ? -k : k, k);
    sprite.blendMode = sheet.blend === "normal" ? "normal" : sheet.blend;
    sprite.alpha = at.alpha ?? 1;
    at.layer.addChild(sprite);
    return { sprite, step: (i) => { sprite.texture = frames[Math.max(0, Math.min(frames.length - 1, i))]!; } };
  }
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
