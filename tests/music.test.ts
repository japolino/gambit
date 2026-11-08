/**
 * Music: a model picks from the whole catalogue through its filters, a place keeps its theme, and the player crossfades.
 */
import { describe, expect, test } from "bun:test";
import { createMusicBox, NEEDS_PERMISSION } from "../src/backend/music.js";
import { createMusic, type Deck } from "../src/frontend/music.js";
import { feelQuestions, feelsIn, parseCatalogue, parseFeel, parseTrack, plainWanted, shortlist, trackFromAnswers, trackOf, trackQuestions, wantedFromAnswers, type MusicAsk, type Piece } from "../src/meaning/music.js";

const raw = (title: string, feel: string, instruments = "Piano", length = "00:03:00") => ({ title, filename: `${title}.mp3`, length, instruments, genre: 5, bpm: 90, description: `${title} is a piece.`, feel });
const pieces = parseCatalogue([
  raw("Still Water", "Calming, Relaxed", "Piano, Strings"),
  raw("Iron Gate", "Dark, Suspenseful", "Cellos, Violas"),
  raw("Long Knife", "Dark, Action", "Drums, Percussion"),
  raw("Silly Goose", "Dark, Humorous", "Bum Trumpet"),
  raw("Grey Morning", "Somber, Dark", "Piano"),
]);
const ask: MusicAsk = { moment: "scene", card: { name: "Saltgate", genre: "mystery", premise: "A harbour town.", tone: "dry" }, place: { name: "The Docks", description: "Wet stone." }, time: "night", people: ["Orla"], lines: ["The gulls go quiet."] };

const choose = (choice: string) => ({ type: "choice", choice }) as never;

describe("the catalogue", () => {
  test("keeps what can sit under a scene", () => {
    const list = parseCatalogue([
      raw("Good", "Dark"),
      raw("Good", "Dark"),
      raw("A Sting", "Dark", "Piano", "00:00:31"),
      raw("An Hour Of Drone", "Calming", "Synths", "00:58:54"),
      raw("No Feel", ""),
      { title: "Not Audio", filename: "x.pdf", length: "00:03:00", feel: "Dark" },
    ]);
    expect(list.map((p) => p.title)).toEqual(["Good"]);
    expect(parseCatalogue("nonsense")).toEqual([]);
  });

  test("a track carries the credit the licence asks for, and a safe address", () => {
    const t = trackOf({ title: "Bob's Tune", file: "Bob's Tune.mp3" } as Piece);
    expect(t.url).toBe("https://incompetech.com/music/royalty-free/mp3-royaltyfree/Bob's%20Tune.mp3");
    expect(t.credit).toContain('"Bob\'s Tune" Kevin MacLeod (incompetech.com)');
    expect(t.credit).toContain("By Attribution 4.0");
  });
});

describe("narrowing it down", () => {
  test("the filters are the catalogue's own feels", () => {
    expect(feelsIn(pieces)).toEqual(["Action", "Calming", "Dark", "Humorous", "Relaxed", "Somber", "Suspenseful"]);
    const q = feelQuestions(feelsIn(pieces)) as unknown as { feel: { criteria: Record<string, string> } };
    expect(q.feel.criteria.suspenseful).toBe("Suspenseful");
  });

  test("best matches first; a joke only when one was asked for", () => {
    const dark = shortlist(pieces, { feel: "Dark", also: "Suspenseful", sound: "orchestra" }, new Set(), "s");
    expect(dark[0]!.title).toBe("Iron Gate");
    expect(dark.map((p) => p.title)).not.toContain("Silly Goose");
    expect(dark.map((p) => p.title)).not.toContain("Still Water");
    expect(shortlist(pieces, { feel: "Humorous", also: null, sound: null }, new Set(), "s")[0]!.title).toBe("Silly Goose");
  });

  test("a rare feel still leaves a choice: the next-closest tracks fill the list", () => {
    const list = shortlist(pieces, { feel: "Suspenseful", also: "Somber", sound: "drums" }, new Set(), "s").map((p) => p.title);
    expect(list[0]).toBe("Iron Gate");
    expect(list).toEqual(expect.arrayContaining(["Grey Morning", "Long Knife"]));
    expect(list).not.toContain("Still Water");
  });

  test("what the story already uses stays out, until nothing else is left", () => {
    const used = new Set(["Iron Gate.mp3"]);
    expect(shortlist(pieces, { feel: "Dark", also: "Suspenseful", sound: null }, used, "s").map((p) => p.title)).not.toContain("Iron Gate");
    const all = new Set(pieces.map((p) => p.file));
    expect(shortlist(pieces, { feel: "Dark", also: null, sound: null }, all, "s").length).toBeGreaterThan(0);
  });

  test("a different moment shuffles equals differently", () => {
    const many = parseCatalogue(Array.from({ length: 40 }, (_, i) => raw(`Track ${i}`, "Dark")));
    const a = shortlist(many, { feel: "Dark", also: null, sound: null }, new Set(), "docks").map((p) => p.title);
    const b = shortlist(many, { feel: "Dark", also: null, sound: null }, new Set(), "inn").map((p) => p.title);
    expect(a).toHaveLength(14);
    expect(a).not.toEqual(b);
  });

  test("answers that don't match anything are refused", () => {
    const feels = feelsIn(pieces);
    expect(wantedFromAnswers({ feel: choose("dark"), also: choose("none"), sound: choose("drums") }, feels)).toEqual({ feel: "Dark", also: null, sound: "drums" });
    expect(wantedFromAnswers({ feel: choose("polka") }, feels)).toBeNull();
    expect(wantedFromAnswers(null, feels)).toBeNull();
    expect(parseFeel({ feel: "dark", sound: "nope" }, feels)).toEqual({ feel: "Dark", also: null, sound: null });
    expect(parseFeel({ feel: "polka" }, feels)).toBeNull();
    expect(trackFromAnswers({ track: choose("t1") }, pieces)!.title).toBe(pieces[1]!.title);
    expect(trackFromAnswers({ track: choose("t99") }, pieces)).toBeNull();
    expect(parseTrack({ pick: 2 }, pieces)).toBe(pieces[2]!);
    expect(parseTrack({ pick: "x" }, pieces)).toBeNull();
    expect(Object.keys((trackQuestions(pieces) as unknown as { track: { criteria: object } }).track.criteria)).toHaveLength(pieces.length);
  });

  test("a plain feel for each kind of moment when no model answers", () => {
    expect(plainWanted("fight", ["Action", "Calming"]).feel).toBe("Action");
    expect(plainWanted("night", ["Calming"]).feel).toBe("Calming");
  });
});

describe("the pick", () => {
  function box(over: { cors?: () => Promise<unknown>; decide?: (q: Record<string, unknown>) => Record<string, unknown> | null } = {}) {
    const files = new Map<string, unknown>();
    let reads = 0;
    let time = 1_000_000;
    const logged: string[] = [];
    const music = createMusicBox({
      spindle: {
        cors: async () => {
          reads++;
          return over.cors ? over.cors() : { status: 200, body: JSON.stringify([raw("Iron Gate", "Dark, Suspenseful", "Cellos"), raw("Still Water", "Calming")]) };
        },
        storage: { getJson: async (p: string, o: { fallback: unknown }) => (files.has(p) ? files.get(p) : o.fallback), setJson: async (p: string, v: unknown) => void files.set(p, v) },
      } as never,
      decide: (async (_u: string, _s: unknown, q: Record<string, unknown>) => (over.decide ? over.decide(q) : null)) as never,
      log: (m) => logged.push(m),
      now: () => time,
    });
    return { music, files, logged, reads: () => reads, later: (ms: number) => (time += ms) };
  }

  test("the model chooses the feel, then the track", async () => {
    const seen: string[] = [];
    const { music, logged } = box({
      decide: (q) => {
        seen.push(Object.keys(q).join());
        return q.feel ? { feel: choose("suspenseful"), also: choose("dark"), sound: choose("orchestra") } : { track: choose("t0") };
      },
    });
    const list = (await music.catalogue()) as Piece[];
    expect((await music.pick("u", ask, list, new Set(), "s"))!.title).toBe("Iron Gate");
    expect(seen).toEqual(["feel,also,sound", "track"]);
    expect(logged.at(-1)).toContain("Suspenseful, Dark, orchestra -> Iron Gate");
  });

  test("no model at all still scores the moment", async () => {
    const { music } = box();
    const list = (await music.catalogue()) as Piece[];
    expect(await music.pick("u", ask, list, new Set(), "s")).not.toBeNull();
    expect(await music.pick("u", ask, [], new Set(), "s")).toBeNull();
  });

  test("the catalogue is read once and kept for a month", async () => {
    const { music, reads, files } = box();
    await music.catalogue();
    await music.catalogue();
    expect(reads()).toBe(1);
    expect((files.get("music/catalogue.json") as { pieces: Piece[] }).pieces).toHaveLength(2);
  });

  test("without the permission it says what to do, and doesn't keep asking", async () => {
    const { music, reads, later } = box({ cors: async () => Promise.reject(new Error("Permission denied: cors_proxy — CORS proxy permission not granted")) });
    expect(await music.catalogue()).toBe(NEEDS_PERMISSION);
    expect(await music.catalogue()).toBe(NEEDS_PERMISSION);
    expect(reads()).toBe(1);
    later(61_000);
    await music.catalogue();
    expect(reads()).toBe(2);
  });

  test("a broken answer is an error, not a crash", async () => {
    const { music } = box({ cors: async () => ({ status: 200, body: "<html>" }) });
    expect(typeof (await music.catalogue())).toBe("string");
  });
});

describe("the player", () => {
  function player(on = true) {
    const decks: (Deck & { played: number; paused: number })[] = [];
    const store = new Map<string, string>();
    const music = createMusic({
      fadeMs: 0,
      store: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) },
      gesture: () => () => {},
      makeDeck: () => {
        const d = { src: "", loop: false, volume: 0, preload: "", played: 0, paused: 0, play: async () => void d.played++, pause: () => void d.paused++, addEventListener() {} };
        decks.push(d);
        return d;
      },
    });
    if (on) music.setOn(true);
    return { music, decks, store };
  }
  const a = { title: "A", url: "a.mp3", credit: "credit a" };
  const b = { title: "B", url: "b.mp3", credit: "credit b" };

  test("off until the player turns it on: nothing plays, nothing is contacted", () => {
    const { music, decks } = player(false);
    music.play(a);
    expect(decks).toHaveLength(0);
    expect(music.prefs().on).toBe(false);
  });

  const tick = () => new Promise((r) => setTimeout(r, 1));

  test("a new track fades in and loops while the old one goes; the same track carries on", async () => {
    const { music, decks } = player();
    music.setVolume(0.5);
    music.play(a);
    await tick();
    expect(decks[0]).toMatchObject({ src: "a.mp3", loop: true, played: 1, volume: 0.5 });
    music.play(a);
    expect(decks).toHaveLength(1);
    music.play(b);
    await tick();
    expect(decks).toHaveLength(2);
    expect(decks[0]!.paused).toBe(1);
    expect(music.now()).toBe(b);
  });

  test("a slow track leaves no silence: the old one plays until the new one has started, and only then is it announced", async () => {
    const decks: (Deck & { paused: number; go(): void })[] = [];
    const heard: string[] = [];
    const music = createMusic({
      fadeMs: 0,
      store: null,
      gesture: () => () => {},
      makeDeck: () => {
        let go = () => {};
        const started = new Promise<void>((r) => (go = r));
        const d = { src: "", loop: false, volume: 0, preload: "", paused: 0, go: () => go(), play: () => started, pause: () => void d.paused++, addEventListener() {} };
        decks.push(d);
        return d;
      },
    });
    music.onTrack((t) => heard.push(t.title));
    music.setOn(true);
    music.setVolume(1);
    music.play(a);
    decks[0]!.go();
    await tick();
    music.play(b);
    await tick();
    expect(decks[0]).toMatchObject({ paused: 0, volume: 1 });
    expect(decks[1]!.volume).toBe(0);
    expect(heard).toEqual(["A"]);
    decks[1]!.go();
    await tick();
    expect(decks[0]!.paused).toBe(1);
    expect(decks[1]!.volume).toBe(1);
    expect(heard).toEqual(["A", "B"]);
  });

  test("the moment coming back before its replacement started: the track never stopped", async () => {
    const decks: (Deck & { paused: number; go(): void })[] = [];
    const music = createMusic({
      fadeMs: 0,
      store: null,
      gesture: () => () => {},
      makeDeck: () => {
        let go = () => {};
        const started = new Promise<void>((r) => (go = r));
        const d = { src: "", loop: false, volume: 0, preload: "", paused: 0, go: () => go(), play: () => started, pause: () => void d.paused++, addEventListener() {} };
        decks.push(d);
        return d;
      },
    });
    music.setOn(true);
    music.play(a);
    decks[0]!.go();
    await tick();
    music.play(b);
    music.play(a);
    expect(decks).toHaveLength(2);
    expect(decks[0]!.paused).toBe(0);
    expect(decks[1]!.paused).toBe(1);
    expect(music.now()).toEqual(a);
    music.stop();
    expect(decks[0]!.paused).toBe(1);
  });

  test("the old track fades from where it sat: bringing the level back up as the new one starts doesn't jump it", async () => {
    const { music, decks } = player();
    const volumes: number[] = [];
    music.setVolume(1);
    music.play(a);
    await tick();
    music.dim(true);
    const d = decks[0]!;
    let v = d.volume;
    Object.defineProperty(d, "volume", { get: () => v, set: (x: number) => void (volumes.push(x), (v = x)) });
    music.onTrack(() => music.dim(false));
    music.play(b);
    await tick();
    expect(Math.max(...volumes)).toBeLessThanOrEqual(0.35);
    expect(decks[1]!.volume).toBe(1);
  });

  test("a track that won't load leaves the old one playing and waits for no tap", async () => {
    const decks: (Deck & { paused: number; fail(): void })[] = [];
    let taps = 0;
    let n = 0;
    const music = createMusic({
      fadeMs: 0,
      store: null,
      gesture: () => (taps++, () => {}),
      makeDeck: () => {
        const bad = n++ > 0;
        let onError = () => {};
        const d = {
          src: "",
          loop: false,
          volume: 0,
          preload: "",
          paused: 0,
          fail: () => onError(),
          play: () => (bad ? Promise.resolve().then(() => { onError(); throw new Error("NotSupportedError"); }) : Promise.resolve()),
          pause: () => void d.paused++,
          addEventListener: (_: "error", fn: () => void) => void (onError = fn),
        };
        decks.push(d);
        return d;
      },
    });
    music.setOn(true);
    music.play(a);
    await tick();
    music.play(b);
    await tick();
    expect(music.error()).toContain("B");
    expect(decks[0]!.paused).toBe(0);
    expect(taps).toBe(0);
  });

  test("it sits lower under the curtain and under a voice", async () => {
    const { music, decks } = player();
    music.setVolume(1);
    music.play(a);
    await tick();
    music.dim(true);
    expect(decks[0]!.volume).toBeCloseTo(0.35);
    music.duck(true);
    expect(decks[0]!.volume).toBeCloseTo(0.1575);
    music.dim(false);
    music.duck(false);
    expect(decks[0]!.volume).toBe(1);
  });

  test("every track played is credited, and it remembers the choice", () => {
    const { music, store } = player();
    music.play(a);
    music.play(b);
    music.play(a);
    expect(music.credits()).toEqual(["credit a", "credit b"]);
    expect(JSON.parse(store.get("gambit.music")!)).toMatchObject({ on: true });
    music.setOn(false);
    expect(music.now()).toBeNull();
  });

  test("a track the browser won't start until a tap starts on the next tap", async () => {
    const decks: Deck[] = [];
    let tap: (() => void) | null = null;
    let tries = 0;
    const music = createMusic({
      fadeMs: 0,
      store: null,
      gesture: (fn) => ((tap = fn), () => {}),
      makeDeck: () => {
        const d = { src: "", loop: false, volume: 0, preload: "", play: async () => { if (++tries === 1) throw new Error("NotAllowedError"); }, pause() {}, addEventListener() {} };
        decks.push(d);
        return d;
      },
    });
    music.setOn(true);
    music.play(a);
    await tick();
    expect(tap).not.toBeNull();
    tap!();
    expect(tries).toBe(2);
  });
});
