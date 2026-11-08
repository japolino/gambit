/**
 * Scene preview (docs/DESIGN.md 6.1-6.3): the real world builder, delve
 * generator and Scene view, on a made-up harbor card with painted stand-in
 * art. No Lumiverse needed: http://localhost:4174/scene
 *   &encounter=battle  a demo fight on top of the scene, as the game shows it (a theme with a room stages it there;
 *                      otherwise the stage draws its own backdrop and the scene is hidden)
 *   &encounter=parley  the Parley harness (/parley) on top, see-through when the theme stages it in its room
 */
import { clearRoom, enterDelve, generateDelve, stepDelve } from "../src/engine/world/delve.js";
import { buildWorld, moveScene, newScene, TIMES } from "../src/engine/world/places.js";
import { buildHex, cellOf, hexKey, newHex, stepHex } from "../src/engine/world/hex.js";
import { fallbackMeanwhile } from "../src/meaning/fallbacks.js";
import { boardMapKey, buildSceneView, placeKey, wallKey, type PlayRecord } from "../src/shared/scene-build.js";
import { npcArtKey } from "../src/shared/art-keys.js";
import type { ThemeId } from "../src/shared/scene-view.js";
import { mountScene } from "../src/frontend/scene/view.js";
import { mountBattleStage } from "../src/frontend/stage/index.js";
import { demoBattle } from "../src/engine/content/index.js";
import { addToCodex, awakenedSkill, balance, classFromDraft, fallbackAwakenings, fallbackForge, fromCodex, fuseClasses, newBook, rankOf, type Codex } from "../src/engine/forge/forge.js";
import { buildForgeView } from "../src/shared/forge-view.js";
import { baseClassFor } from "../src/engine/card/foes.js";
import { CLASSES } from "../src/engine/content/classes.js";
import { camp as boardCamp, dealBoard, moveTo as boardMove, openLore, skip as boardSkip, winFight, type BoardEvent, type LoreCard } from "../src/engine/world/board.js";
import { boardLore, glimpse } from "../src/meaning/board-deck.js";

// The class panel (M7) on a local book: no model, so every answer is the code fallback.
const book = newBook();
book.classes.card = { def: { ...CLASSES.duelist!, id: "duelist~p_player", name: "Courier" }, origin: "card", wins: 4, at: 0 };
book.classes.hexwright!.wins = 5;
book.catalysts = 2;
book.uses["duelist_flurry"] = 52;
book.uses["duelist_opening"] = 31;
let codex: Codex = { v: 1, entries: [] };
void awakenedSkill;

const ev = { source: "card" as const, quote: "", verified: true };
const sheet = {
  v: 1,
  cardKey: "preview-harbor-0001",
  cardName: "Saltmarsh",
  characterIds: [],
  premise: "A fog-bound harbor town where smugglers and wardens share the same taverns.",
  tone: "moody",
  shape: (new URLSearchParams(location.search).get("shape") ?? "town") as "town",
  modules: { parley: true, encounters: true, places: true, delves: true, kits: true, economy: true },
  skin: { genre: "low fantasy", currency: "crowns", fight: "brawl", stats: { presence: "Presence", menace: "Menace", guile: "Guile" } },
  player: { name: "Wren", concept: "a courier", social: { presence: 2, menace: 1, guile: 3 } },
  cast: [
    { id: "mara", name: "Mara", role: "the harbormaster, usually at the docks", look: "", main: true, pronoun: "she", evidence: ev },
    { id: "tobin", name: "Tobin", role: "keeps The Drowned Lantern", look: "", main: false, pronoun: "he", evidence: ev },
    { id: "ilse", name: "Ilse", role: "a warden off duty, usually at the docks", look: "", main: false, pronoun: "she", evidence: ev },
  ],
  places: [
    { id: "docks", name: "The Docks", description: "Wet planks, gulls, and crates under tarps", evidence: ev },
    { id: "tavern", name: "The Drowned Lantern", description: "A low tavern with rooms to rent and a market stall", evidence: ev },
    { id: "lighthouse", name: "Old Lighthouse", description: "A dead lighthouse on dangerous rocks", evidence: ev },
    { id: "caves", name: "Smugglers' Caves", description: "A cave tunnel and crypt under the cliffs", evidence: ev },
  ],
  facts: [
    { id: "f1", text: "Mara takes a cut from every smuggled crate.", about: ["mara"], weight: 2, known: true, evidence: ev },
    { id: "f2", text: "Tobin hides a ledger under the bar.", about: ["tobin"], weight: 1, known: true, evidence: ev },
    { id: "f3", text: "The lighthouse went dark the night the warden vanished.", about: [], weight: 3, known: true, evidence: ev },
  ],
  notes: [],
} as never;

let r: PlayRecord = (() => {
  const world = buildWorld(sheet, "preview");
  const base: PlayRecord = { v: 1, cardKey: "preview-harbor-0001", world, scene: newScene(world), theme: (new URLSearchParams(location.search).get("theme") ?? "storybook") as ThemeId, log: ["You arrive by the morning ferry."], album: [{ key: "cg:preview.a1", caption: "The ferry docks at dawn.", day: 1 }, { key: "cg:preview.a2", caption: "A deal struck at the fish market.", day: 1 }] };
  base.thread = { goal: "Find out why the lighthouse went dark", revelations: [1, 2, 3, 4].map((i) => ({ id: `rev${i}`, text: `Revelation ${i}` })), by: "fallback" };
  base.revealed = ["rev1"];
  base.memory = {
    deeds: [
      { day: 1, kind: "killed", target: "bandit", name: "Dock Bandit", n: 3, method: "fire", place: "docks" },
      { day: 1, kind: "lied_to", target: "mara", name: "Mara", place: "docks" },
    ],
    nightAt: 0,
    tally: { elements: { fire: 120 }, statuses: {}, talks: 1, hits: 9 },
    adapt: {},
    npc: { mara: { notes: [{ day: 1, text: "Wren lied to them on day 1", tone: -1 }], affinity: -2 }, tobin: { notes: [], affinity: 5.5 } },
    interest: {},
    promoted: [{ key: "name:Old Brannoc", castId: "n_old_brannoc", name: "Old Brannoc", dossier: "A retired lamplighter who knows every smuggler by their boots.", steps: [{ text: "Find his old lamp", where: "lighthouse", done: true }, { text: "Ask Tobin about the night shift", where: "tavern", done: false }], item: { name: "Brannoc's lamp", description: "Never quite goes out." }, day: 1, done: false }],
    recruits: [{ id: "r_thug_1_0", name: "Harbor Thug", foe: "thug", look: "", role: "brute", day: 1 }],
    scars: {},
    items: [],
    rumors: ["The Dock Bandits have started carrying wet hides and buckets of sand."],
  };
  if (world.shape === "frontier") {
    const map = buildHex(world, "preview-hex");
    base.hex = { map, state: newHex(map, cellOf(map, world.start)) };
  }
  return base;
})();

/** Painted stand-in art: a gradient sky, a horizon, and a few shapes. */
function paint(seed: number, kind: "place" | "wall" | "person"): string {
  const c = document.createElement("canvas");
  c.width = kind === "person" ? 400 : 1216;
  c.height = kind === "person" ? 640 : 832;
  const g = c.getContext("2d")!;
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  if (kind === "person") {
    g.fillStyle = `hsl(${seed % 360},30%,40%)`;
    g.beginPath();
    g.ellipse(200, 170, 80, 95, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(90, 270, 220, 370);
    return c.toDataURL();
  }
  if (kind === "wall") {
    g.fillStyle = "#5a5048";
    g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 400; i++) {
      g.fillStyle = `rgba(${rnd() > 0.5 ? "20,16,12" : "120,110,96"},.25)`;
      g.fillRect(rnd() * c.width, rnd() * c.height, 30 + rnd() * 120, 18 + rnd() * 40);
    }
    return c.toDataURL();
  }
  const hue = seed % 360;
  const sky = g.createLinearGradient(0, 0, 0, c.height * 0.5);
  sky.addColorStop(0, `hsl(${hue},40%,22%)`);
  sky.addColorStop(1, `hsl(${(hue + 30) % 360},45%,55%)`);
  g.fillStyle = sky;
  g.fillRect(0, 0, c.width, c.height * 0.5);
  const ground = g.createLinearGradient(0, c.height * 0.45, 0, c.height);
  ground.addColorStop(0, `hsl(${hue},20%,30%)`);
  ground.addColorStop(1, `hsl(${hue},25%,12%)`);
  g.fillStyle = ground;
  g.fillRect(0, c.height * 0.45, c.width, c.height * 0.55);
  for (let i = 0; i < 9; i++) {
    g.fillStyle = `hsla(${hue},15%,${10 + rnd() * 20}%,.9)`;
    const w = 60 + rnd() * 200;
    const h = 80 + rnd() * 260;
    g.fillRect(rnd() * c.width, c.height * 0.46 - h, w, h);
  }
  return c.toDataURL();
}

// ?shadow=1 mounts inside a shadow root, as Lumiverse does.
const host = (() => {
  const h = document.getElementById("host")!;
  if (new URLSearchParams(location.search).get("shadow") !== "1") return h;
  const inner = document.createElement("div");
  inner.style.cssText = "position:absolute;inset:0";
  h.attachShadow({ mode: "open" }).append(inner);
  return inner;
})();
const T = sheet as unknown as { cardKey: string };
// ?crowd=<n> (n > 3): n people at the place, the extras made up here, to check how a theme copes with a big cast.
const CROWD = Number(new URLSearchParams(location.search).get("crowd") ?? 0);
if (CROWD > 3) {
  const names = ["Corvin", "Hesta", "Pell", "Dagny", "Orrin", "Sefa", "Bram", "Lisk", "Vey"];
  for (const name of names.slice(0, CROWD - 3)) (sheet.cast as { id: string }[]).push({ ...sheet.cast[1]!, id: name.toLowerCase(), name, role: "a regular here", main: false });
}
const handle = mountScene(host, buildSceneView(sheet, "preview", r), {
  act(id) {
    const [kind, target] = id.split(":") as [string, string];
    if (kind === "go") r = { ...r, scene: moveScene(r.world, r.scene, { kind: "go", to: target }), log: [...r.log, `You go to ${r.world.places[target]!.name}.`].slice(-6) };
    else if (id === "rest" || id === "camp") {
      if (id === "rest") r = { ...r, scene: moveScene(r.world, r.scene, { kind: "rest" }) };
      handle.meanwhile(r.scene.day, null);
      const vs = fallbackMeanwhile({ cast: (sheet as unknown as { cast: never }).cast, places: Object.values(r.world.places) as never, cardKey: "preview" }, r.scene.day, [{ name: "The Wardens", want: "Find the smugglers' route" }]);
      setTimeout(() => handle.meanwhile(r.scene.day, vs.map((v) => ({ text: v.text, ...(v.where ? { art: placeKey(sheet, v.where) } : {}) }))), 1200);
    }
    else if (id === "wait") r = { ...r, scene: moveScene(r.world, r.scene, { kind: "wait" }), log: [...r.log, `Time passes: ${TIMES[r.scene.time]}.`].slice(-6) };
    else if (id === "explore") dealPreviewBoard();
    else if (id === "delve") {
      const map = generateDelve(`preview:${r.scene.placeId}`);
      r = { ...r, delve: { placeId: r.scene.placeId, map, state: enterDelve(map) }, theme: r.theme === "storybook" ? "onebit" : r.theme };
    } else r = { ...r, log: [...r.log, `(${id}: handled by the backend in Lumiverse)`].slice(-6) };
    refresh();
  },
  step(move) {
    if (!r.delve) return;
    const out = stepDelve(r.delve.map, r.delve.state, move);
    let state = out.state;
    let line = "";
    if (out.event.kind === "blocked") line = out.event.why === "locked" ? "A locked door. You need a key." : "A wall.";
    if (out.event.kind === "found") line = out.event.what === "key" ? "You find a heavy iron key." : out.event.what === "treasure" ? "A cache of crowns." : "Nothing here.";
    if (out.event.kind === "unlocked") line = "The key turns.";
    if (out.event.kind === "room" && out.event.first && ["fight", "boss", "trap", "rest", "event"].includes(out.event.room.kind)) {
      state = clearRoom(r.delve.map, state, out.event.room.id);
      line = out.event.room.kind === "boss" ? "(The boss fight runs on the battle stage.)" : out.event.room.kind === "fight" ? "(A fight runs on the battle stage.)" : "";
    }
    r = { ...r, delve: { ...r.delve, state }, log: line ? [...r.log, line].slice(-6) : r.log };
    refresh();
  },
  leave() {
    r = { ...r, delve: undefined, theme: r.theme === "onebit" ? "storybook" : r.theme };
    refresh();
  },
  theme(t: ThemeId) {
    r = { ...r, theme: t };
    refresh();
  },
  fight() {},
  close() {},
  board(op, cell, tier) {
    const b = r.board;
    if (!b) return;
    let events: BoardEvent[] = [];
    let story: NonNullable<PlayRecord["boardStory"]> | undefined;
    try {
      if (op === "leave") {
        r = { ...r, board: undefined, boardFx: undefined, boardStory: undefined, log: [...r.log, "You turn back."].slice(-6) };
        return refresh();
      }
      let nb = b;
      if (op === "move") ({ board: nb, events } = boardMove(b, cell!));
      if (op === "skip") ({ board: nb, events } = boardSkip(b));
      if (op === "camp") ({ board: nb, events } = boardCamp(b));
      if (op === "lore") {
        const res = openLore(b, (tier ?? 0) as 0 | 1 | 2 | 3);
        nb = res.board;
        events = res.events;
        if (res.card && res.tier) story = { title: res.card.title, text: res.tier === 1 ? glimpse(res.card) : `${res.card.text}

(In Lumiverse the model writes this as a ${res.tier === 3 ? "full" : "partial"} scene.)`, stars: res.tier, ...(res.tier >= 2 ? { art: `cg:preview.${res.card.id}` } : {}) };
        // The CG arrives while you read, as it does in Lumiverse.
        const cgKey = story?.art;
        if (cgKey) setTimeout(() => handle.setArt(cgKey, REAL ? "/localart/place2.png" : paint(cgKey.length * 37, "place"), false), 1500);
      }
      r = { ...r, board: nb, boardFx: previewFx(events), boardStory: story };
      if (nb.done) r = { ...r, board: undefined, boardFx: undefined, boardStory: undefined, log: [...r.log, "You make it across."].slice(-6) };
      const contact = events.find((e) => e.kind === "contact");
      if (contact) {
        // The battle stage runs in Lumiverse; here the fight is won after a beat.
        r = { ...r, log: [...r.log, "(A fight runs on the battle stage.)"].slice(-6) };
        setTimeout(() => {
          if (!r.board) return;
          const w = winFight(r.board);
          r = { ...r, board: w.board, boardFx: [{ text: "The way is clear", kind: "foe" }, ...previewFx(w.events)] };
          refresh();
        }, 1200);
      }
    } catch (err) {
      r = { ...r, log: [...r.log, String((err as Error).message)].slice(-6) };
    }
    refresh();
  },
  hex(q, rr) {
    if (!r.hex) return;
    try {
      const out = stepHex(r.hex.map, r.hex.state, { q, r: rr });
      const scene = moveScene(r.world, r.scene, { kind: "wait" });
      r = { ...r, hex: { ...r.hex, state: out.state }, scene: out.place ? { ...scene, placeId: out.place } : scene, log: [...r.log, out.place ? `You reach ${r.world.places[out.place]!.name}.` : `${r.hex.map.cells[hexKey(q, rr)]!.t}.`].slice(-6) };
    } catch (err) {
      r = { ...r, log: [...r.log, String((err as Error).message)].slice(-6) };
    }
    refresh();
  },
  cite(personId, text) {
    r = { ...r, log: [...r.log, `(Parley with ${personId}, citing: ${text})`].slice(-6) };
    refresh();
  },
  forge(op, arg, arg2, text) {
    const p = book.pending;
    if (op === "use" && arg && book.classes[arg]) book.active = arg;
    if (op === "forge" && text && book.crests > 0) {
      const notes: string[] = [];
      const draft = fallbackForge(text, baseClassFor(text));
      const t = balance(classFromDraft(draft, `preview:${text}`, notes), notes);
      book.pending = { kind: "forge", owned: { def: t.def, origin: "forged", wins: 0, prompt: text, identity: draft.identity, art: `forge:${t.def.id}`, at: Date.now() }, changes: [...draft.changes, ...notes], sim: t.sim };
    }
    if ((op === "fuse" || op === "reroll") && book.catalysts > 0) {
      const [ia, ib] = op === "fuse" ? [arg!, arg2!] : p!.pair!;
      const a = book.classes[ia]!, b = book.classes[ib]!;
      if (rankOf(a.wins) >= 3 && rankOf(b.wins) >= 3 && ia !== ib) {
        book.catalysts--;
        const f = fuseClasses(a.def, b.def, null, `${ia}+${ib}:${op}`);
        const t = balance(f.def, f.changes);
        book.pending = { kind: "fusion", owned: { def: t.def, origin: "fused", wins: 0, parents: [a.def.name, b.def.name], art: `forge:${t.def.id}`, at: Date.now() }, changes: f.changes, sim: t.sim, pair: [ia, ib], rerolled: op === "reroll" };
      }
    }
    if (op === "awaken" && arg) {
      const s = (book.classes[book.active]!.def.skills.find((x) => x.id === arg))!;
      book.pending = { kind: "awaken", skillId: arg, options: fallbackAwakenings(s), changes: ["(Preview: mutations built in code.)"] };
    }
    if (op === "pick" && p?.kind === "awaken") {
      book.awakened[p.skillId!] = p.options![Number(arg)]!;
      book.pending = null;
    }
    if (op === "confirm" && p?.owned) {
      if (p.kind === "forge") book.crests--;
      book.classes[p.owned.def.id] = p.owned;
      book.active = p.owned.def.id;
      codex = addToCodex(codex, { id: p.owned.def.id, name: p.owned.def.name, origin: p.kind === "forge" ? "forged" : "fused", ...(p.owned.parents ? { parents: p.owned.parents } : {}), card: "Saltmarsh", def: p.owned.def, art: p.owned.art!, at: Date.now() });
      book.pending = null;
    }
    if (op === "decline") {
      if (p?.kind === "fusion") book.catalysts++;
      book.pending = null;
    }
    if (op === "take" && arg) {
      const e = codex.entries.find((x) => x.id === arg);
      if (e) book.classes[e.id] ??= fromCodex(e);
    }
    const v = buildForgeView("preview", book, codex, (o) => o.art ?? `class:${o.def.id}`, null);
    handle.forge(v);
    for (const c of v.classes) handle.setArt(c.art!, paint(c.id.length * 53 + c.id.charCodeAt(0) * 7, "person"), true);
    if (v.pending?.art) handle.setArt(v.pending.art, paint(v.pending.art.length * 29, "person"), true);
  },
});

/** The fx a board action leaves (the backend's applyBoard, without the coin and vigor). */
function previewFx(events: BoardEvent[]): NonNullable<PlayRecord["boardFx"]> {
  const out: NonNullable<PlayRecord["boardFx"]> = [];
  for (const e of events) {
    if (e.kind === "flip") out.push({ cell: e.cell, text: "+1 supply", kind: "supply" });
    if (e.kind === "cache") out.push({ text: `+${e.coin} crowns`, kind: "coin" });
    if (e.kind === "forage") out.push({ text: `+${e.got} supplies`, kind: "supply" });
    if (e.kind === "spring") out.push({ text: "Refreshed", kind: "heal" });
    if (e.kind === "hazard") out.push({ text: e.what === "hurt" ? "Hurt" : `-${e.amount} supplies`, kind: "hurt" });
    if (e.kind === "shortcut") out.push({ text: "A view of the way ahead", kind: "info" });
    if (e.kind === "lore") out.push({ cell: e.cell, text: e.card.title, kind: "lore" });
    if (e.kind === "contact") out.push({ text: e.first === "party" ? "You have the jump on them!" : "Ambush!", kind: "foe" });
    if (e.kind === "goal") out.push({ text: e.here === e.of ? "Everyone is here" : `${e.here}/${e.of} at the way on`, kind: "goal" });
  }
  return out;
}

function dealPreviewBoard(): void {
  const extra: LoreCard[] = ["The Drowned Bell", "Smugglers' Stair", "The Wardens", "Fog Season", "Old Lantern Law"].map((t, i) => ({ id: `entry:p${i}`, kind: "entry", ref: `p${i}`, title: t, text: `${t}: an entry from the card's lorebook, as the deck would deal it. The harbor remembers what the town forgets.`, stars: (3 - (i % 3)) as 1 | 2 | 3 }));
  const lore = [...boardLore({ sheet: sheet as never, sources: null, met: new Set(), spent: new Set(), revelation: { id: "r1", text: "The bell rings for the drowned, and someone in town rings it." }, room: 12 }), ...extra].slice(0, 12);
  const party = [{ id: "p_player", name: "Wren" }, { id: "p_mara", name: "Mara" }];
  r = { ...r, board: dealBoard({ seed: `preview:${r.scene.placeId}:${Date.now() % 1000}`, placeId: r.scene.placeId, party, lore, foes: 2 }), boardFx: [{ text: "Blue is safe, green is chance, violet is the story, gold is the way on", kind: "info" }], boardStory: undefined, log: [...r.log, "You set out."].slice(-6) };
  refresh();
}

/**
 * ?real=1: real generated art served by the preview server from the folder in
 * GAMBIT_PREVIEW_ART (place1-4.png, opaque1-2.png, cut1-3.png), so themes can
 * be judged on what they will actually show. Mara is opaque (framed or keyed).
 */
const REAL = new URLSearchParams(location.search).get("real") === "1";
// ?opaque=1: everyone's art is opaque, as on most real cards (each gets keyed or framed).
const REAL_PERSON: Record<string, [string, boolean]> =
  new URLSearchParams(location.search).get("opaque") === "1" ? { mara: ["opaque1", false], tobin: ["opaque2", false], ilse: ["place4", false] } : { mara: ["opaque1", false], tobin: ["cut1", true], ilse: ["cut2", true] };

function refresh(): void {
  const v = buildSceneView(sheet, "preview", r);
  if (new URLSearchParams(location.search).get("busy") === "1") v.busy = "Mara is thinking it over…";
  // ?imageid=1: people carry their own opaque images (served at /api/v1/images/<id>), as on real cards; Ilse's can't be keyed.
  if (new URLSearchParams(location.search).get("imageid") === "1") {
    const ids: Record<string, string> = { mara: "opaque1", tobin: "opaque2", ilse: "place4" };
    v.people = v.people.map((p) => ({ ...p, imageId: ids[p.id] ?? null }));
  }
  handle.setView(v);
  // Stand-in art for every key the view uses.
  Object.values(r.world.places).forEach((p, i) => handle.setArt(placeKey(sheet, p.id), REAL ? `/localart/place${(i % 4) + 1}.png` : paint(p.id.length * 47 + p.id.charCodeAt(0) * 13, "place"), false));
  sheet.cast.forEach((m, i) => {
    const real = REAL_PERSON[m.id] ?? Object.values(REAL_PERSON)[i % 3]!;
    handle.setArt(npcArtKey(`${T.cardKey}:${m.id}`), REAL ? `/localart/${real[0]}.png` : paint(m.id.charCodeAt(0) * 31 + i * 17, "person"), REAL ? real[1] : true);
  });
  // With real art there is no generated wall texture, as in a fresh Lumiverse delve: the layer draws stone.
  if (r.delve && !REAL) handle.setArt(wallKey(sheet, r.delve.placeId), paint(5, "wall"), false);
  for (const t of ["plain", "wood", "hill", "ruin"]) handle.setArt(placeKey(sheet, `wild_${t}`), paint(t.length * 91 + 7, "place"), false);
  // ?map=0 leaves the board without its map (as while it is being drawn).
  handle.setArt("cg:preview.a1", REAL ? "/localart/place1.png" : paint(11, "place"), false);
  handle.setArt("cg:preview.a2", REAL ? "/localart/place4.png" : paint(23, "place"), false);
  if (r.board && new URLSearchParams(location.search).get("map") !== "0") handle.setArt(boardMapKey(sheet, r.board.placeId), REAL ? "/localart/place3.png" : paint(77, "place"), false);
  (window as unknown as { gambitScene: unknown }).gambitScene = { r, v, handle };
}
/*
 * Screenshot switches: ?delve=1 starts inside a delve, ?at=<placeId> starts
 * at a place, ?busy=1 shows the busy state, ?crowd=1 puts all three people there (?crowd=12 makes it twelve), ?journal=1 / ?classes=1 open those panels, ?log=1 fills the log.
 */
{
  const q = new URLSearchParams(location.search);
  const at = q.get("at");
  if (at && r.world.places[at]) r = { ...r, scene: { ...r.scene, placeId: at } };
  if (q.get("crowd") === "1") (r.world.places[r.scene.placeId] as { people: string[] }).people = ["mara", "tobin", "ilse"];
  if (CROWD > 3) (r.world.places[r.scene.placeId] as { people: string[] }).people = sheet.cast.map((m) => m.id);
  if (q.get("log") === "1") r = { ...r, log: ["You arrive by the morning ferry.", "Mara eyes your satchel and says nothing.", "You found: a torn wharf ticket.", "Tobin pours you something that might be rum.", "Time passes: afternoon."] };
  if (q.get("board") === "1") setTimeout(dealPreviewBoard, 0);
  if (q.get("delve") === "1") {
    const map = generateDelve(`preview:${r.scene.placeId}`);
    r = { ...r, delve: { placeId: r.scene.placeId, map, state: enterDelve(map) } };
  }
}
refresh();
{
  const q = new URLSearchParams(location.search);
  const ctx = (document.querySelector(".gs") as unknown as { gambitCtx?: { journal: { toggle(): void }; classes: { toggle(): void } } }).gambitCtx;
  if (q.get("journal") === "1") ctx?.journal.toggle();
  if (q.get("classes") === "1") {
    handle.forge(buildForgeView("preview", book, codex, (o) => o.art ?? `class:${o.def.id}`, null));
    ctx?.classes.toggle();
  }
}

// &encounter=battle|parley: a fight or a talk over the scene, staged in the theme's room when it has one.
{
  const q = new URLSearchParams(location.search);
  const kind = q.get("encounter");
  const theme = (q.get("theme") ?? undefined) as ThemeId | undefined;
  const layer = document.createElement("div");
  layer.style.cssText = "position:absolute;inset:0;z-index:50;";
  if (kind === "battle") {
    const state = demoBattle(q.get("seed") ?? "encounter");
    const staged = handle.encounter({
      kind: "battle",
      enemies: state.combatants.filter((c) => c.side === "enemy").map((c) => ({ id: c.id, name: c.name, art: c.art })),
      party: state.combatants.filter((c) => c.side === "party").map((c) => ({ id: c.id, name: c.name, art: c.art })),
    });
    if (!staged) handle.hide();
    host.append(layer);
    const stage = mountBattleStage(layer, { state, onAction: () => ({ state, events: [] }) as never, theme: theme ?? null });
    // For driving it from devtools or a screenshot script: window.encounter.stage (its host element carries gambitStage).
    Object.assign(globalThis, { encounter: { stage, state, layer, staged } });
  } else if (kind === "parley") {
    const staged = handle.encounter({ kind: "parley", personId: "marrow", name: "Marrow the Ferryman" });
    if (!staged) handle.hide();
    const frame = document.createElement("iframe");
    frame.src = `/parley?${theme ? `theme=${theme}&` : ""}snap=${q.get("snap") ?? "0"}${staged ? "&inroom=1" : ""}`;
    frame.setAttribute("allowtransparency", "true");
    frame.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent;";
    layer.append(frame);
    host.append(layer);
  }
}
