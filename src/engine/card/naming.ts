/**
 * Names Gambit gives (docs/DESIGN.md 4.0, "names"). Code chooses names, the
 * model chooses shape: names come from the bank in name-bank.ts, drawn by the
 * card's seed in the tradition its sheet records, never one the sheet or the
 * world already uses. A model that has to name something is offered drawn
 * candidates, and `fixName` checks its answer: a name the sources give stays,
 * plain words stay, a stock fantasy word is dropped and an invented name is
 * swapped for a candidate. Skills and classes get plain names the same way.
 * None of this ever touches what the card, its lorebook, the persona or the
 * chat named.
 */
import type { Atom, Element, StatusId, TargetRule, TriggerEvent } from "../types.js";
import { TRADITION_IDS, TRADITIONS, type NamingId } from "./name-bank.js";
import { nameWords, normName } from "./names.js";
import type { CardSheet } from "./types.js";

export { TRADITION_IDS, type NamingId };

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

const words = (s: string): string[] => normName(s).split(" ").filter(Boolean);

/* ------------------------------ tradition ------------------------------ */

export const DEFAULT_TRADITION: NamingId = "english";

const UNIQUE_LETTERS: [RegExp, NamingId][] = [
  [/[řěů]/i, "czech"],
  [/[łąęśźżńć]/i, "polish"],
  [/[őű]/i, "hungarian"],
  [/[øåæ]/i, "norse"],
];

/** The tradition a card's setting and its own names point to; the default when they point nowhere. */
export function inferTradition(setting: string, names: readonly string[]): NamingId {
  const score = new Map<NamingId, number>();
  const add = (id: NamingId, n: number) => score.set(id, (score.get(id) ?? 0) + n);
  const t = setting.toLowerCase();
  for (const id of TRADITION_IDS) for (const cue of TRADITIONS[id].cues) if (new RegExp(`\\b${cue}\\b`, "i").test(t)) add(id, 4);
  const own = new Set(names.flatMap(words));
  for (const id of TRADITION_IDS) {
    const tr = TRADITIONS[id];
    for (const n of [...tr.female, ...tr.male, ...tr.surnames, ...tr.places]) if (words(n).every((w) => own.has(w))) add(id, 3);
  }
  for (const [re, id] of UNIQUE_LETTERS) if (names.some((n) => re.test(n))) add(id, 2);
  let best: NamingId = DEFAULT_TRADITION;
  for (const [id, n] of score) if (n > (score.get(best) ?? 0)) best = id;
  return best;
}

/** The sheet's tradition: the one the reader recorded, else what its setting and names point to. */
export function traditionOf(sheet: Pick<CardSheet, "skin" | "tone" | "premise" | "cast" | "places"> & { names?: NamingId }): NamingId {
  if (sheet.names && TRADITIONS[sheet.names]) return sheet.names;
  return inferTradition(`${sheet.skin.genre} ${sheet.tone} ${sheet.premise}`, [...sheet.cast.map((c) => c.name), ...sheet.places.map((p) => p.name)]);
}

/** Everything on the sheet that already has a name, so a draw never repeats one. */
export function sheetNames(sheet: Pick<CardSheet, "cast" | "places" | "player" | "cardName"> & { foes?: { name: string }[] }): string[] {
  return [sheet.cardName, sheet.player.name, ...sheet.cast.map((c) => c.name), ...sheet.places.map((p) => p.name), ...(sheet.foes ?? []).map((f) => f.name)].filter(Boolean);
}

/* -------------------------------- draws -------------------------------- */

export type NameKind = "female" | "male" | "given" | "surname" | "place";

function pool(id: NamingId, kind: NameKind): string[] {
  const t = TRADITIONS[id];
  if (kind === "given") return t.female.flatMap((f, i) => [f, ...(t.male[i] ? [t.male[i]!] : [])]);
  return kind === "female" ? t.female : kind === "male" ? t.male : kind === "surname" ? t.surnames : t.places;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/**
 * `n` names of a kind, the same for the same seed. None shares a word with
 * `taken` (names, or whole texts such as the story so far) or with another
 * drawn name. A tradition that runs out is topped up from the next ones.
 */
export function drawNames(id: NamingId, kind: NameKind, seed: string, n: number, taken: Iterable<string> = []): string[] {
  const used = new Set<string>();
  for (const t of taken) for (const w of nameWords(t)) used.add(w);
  const out: string[] = [];
  const order = [id, ...TRADITION_IDS.filter((x) => x !== id)];
  for (const tr of order) {
    const list = pool(tr, kind);
    const h = hash(`${seed}:${kind}:${tr}`);
    let step = 1 + ((h >>> 8) % (list.length - 1));
    while (gcd(step, list.length) !== 1) step++;
    for (let i = 0; i < list.length && out.length < n; i++) {
      const name = list[(h + i * step) % list.length]!;
      const ws = nameWords(name);
      if (ws.some((w) => used.has(w))) continue;
      out.push(name);
      for (const w of ws) used.add(w);
    }
    if (out.length >= n) break;
  }
  return out;
}

/** Fresh names for this card: drawn in its tradition, never one the sheet has, nor any of `taken`. */
export function freshNames(sheet: Parameters<typeof traditionOf>[0] & Parameters<typeof sheetNames>[0] & { cardKey: string }, kind: NameKind, purpose: string, n: number, taken: Iterable<string> = []): string[] {
  return drawNames(traditionOf(sheet), kind, `${sheet.cardKey}:${purpose}`, n, [...sheetNames(sheet), ...taken]);
}

/* ------------------------------- ban list ------------------------------ */

/** Stock names models reach for. Only names Gambit invents are checked against these. */
const SLOP_NAMES = new Set([
  "vance", "voss", "thorne", "kael", "kaelen", "elara", "lyra", "seraphina", "zephyr", "aria", "silas", "elias", "eldoria",
  "aldric", "alaric", "theron", "lysander", "draven", "riven", "nyx", "vex", "vexis", "kaida", "eldrin", "elowen", "sylas",
  "caelum", "liora", "sable", "ashen", "kestrel", "malakar", "valerius",
]);
const SLOP_NAME_SHAPES = /^(aethel|kael|cael|zeph|eldr|eldor|vael|sylv|thal(ion|ric))|^(val|ald|myth|ast|lum)oria$/;

/** Words that make a name sound generated: dropped from a place, and a skill using one gets a plain name. */
const SLOP_WORDS = /^(whisper\w*|shadow\w*|ember\w*|crystal\w*|moonlit|starlit|veil\w*|glamou?r\w*|eclipse|requiem|litany|symphony|tempest\w*|ethereal|arcane|abyss\w*|celestial|umbral|astral|nexus|aegis|crimson|obsidian|sanguine|spectral|gossamer|verdant|eldritch|elegy|dirge|nocturne|sonata|threnody|reverie|crescendo|lament|oblivion|ascendant|luminous|luminescent|ephemeral|enigma\w*|phantasm\w*|serenade|solace|everlasting|eternity)$/;
/** One stock word glued to another: Shadowfen, Moonvale, Starhaven, Emberfall. */
const SLOP_COMPOUND = /^(shadow|ember|moon|star|crystal|whisper|storm|frost|silver|raven|dusk|dawn|night|mist|sun|thorn|elder|winter|soul|void)(fen|vale|haven|woods?|fall|shade|spire|reach|hollow|mere|crest|song|light|glen|moor|keep|wind|veil|heart|thorn|forge|guard|watch|helm|stone|brook|shard|bane|weaver|caller|bound|born|blade|fire)$/;
/** Moon Vale, Star Haven, Silver Woods. */
const SLOP_PAIR_FIRST = new Set(["moon", "star", "silver", "mist", "misty", "dusk", "twilight", "raven", "storm", "frost", "sun", "night", "soul"]);
const SLOP_PAIR_SECOND = new Set(["vale", "fen", "haven", "woods", "wood", "hollow", "glen", "reach", "spire", "mere", "shade", "fall", "song", "light", "veil", "heart", "weaver", "caller", "spire", "crest"]);

const slopName = (w: string): boolean => SLOP_NAMES.has(w) || SLOP_NAME_SHAPES.test(w) || SLOP_COMPOUND.test(w);
const slopWord = (w: string): boolean => SLOP_WORDS.test(w);

/** A name with a stock fantasy word or name in it. */
export function isSlop(name: string): boolean {
  const ws = words(name);
  return ws.some((w, i) => slopName(w) || slopWord(w) || (SLOP_PAIR_FIRST.has(w) && SLOP_PAIR_SECOND.has(ws[i + 1] ?? "")));
}

/* ------------------------------- checking ------------------------------ */

/** What the sources say, searchable: their text, every word in it, and the words they capitalise mid-sentence (their names). */
export interface Canon {
  text: string;
  words: Set<string>;
  proper: Set<string>;
}

export function canonOf(...texts: string[]): Canon {
  const all = texts.filter(Boolean).join("\n");
  const proper = new Set<string>();
  for (const m of all.matchAll(/\p{Lu}[\p{L}'’-]*/gu)) {
    const before = all.slice(Math.max(0, m.index - 4), m.index);
    if (m.index && !/(^|[.!?…"“”*:\n])\s*$/.test(before)) for (const w of words(m[0])) proper.add(w);
  }
  const text = ` ${normName(all)} `;
  return { text, words: new Set(text.split(" ").filter(Boolean)), proper };
}

/** The sources name this, word for word. */
export const inCanon = (name: string, canon: Canon): boolean => !!normName(name) && canon.text.includes(` ${normName(name)} `);

const JOINERS = new Set(["the", "of", "at", "and", "on", "in", "by", "upon", "under", "over", "above", "below", "beyond", "near", "a", "an", "to", "for", "from", "with", "s"]);

/** Ordinary words a place, group or thing may be called by without a name. */
const PLAIN = new Set(
  `old new high low great little big long short upper lower north south east west northern southern eastern western middle far near deep
  black white grey gray red green blue brown golden yellow dark pale bright broken burnt burned sunken drowned flooded fallen ruined empty lost hidden
  quiet hollow narrow wide steep cold warm wet dry stone iron wooden copper rusty crooked lonely ancient abandoned last first second third
  holy blessed cursed haunted dead sleeping silent rotten salt sweet bitter rough open closed twin three seven hundred hanging leaning standing
  inn tavern alehouse pub arms rest house hall manor tower keep castle fort fortress gate gates wall walls bridge ford well mill market square
  street lane road way path trail crossroads cross chapel church shrine temple abbey priory monastery cloister crypt tomb grave graveyard
  cemetery barrow cave caves cavern mine mines pit quarry tunnel tunnels sewer sewers cellar vault vaults catacombs dungeon ruins ruin
  wood woods forest grove copse thicket orchard garden gardens field fields meadow moor heath marsh bog fen swamp mire lake pond pool river stream
  brook creek falls spring springs bay cove harbour harbor port docks dock pier wharf quay shore beach coast cliff cliffs island isle rock rocks
  hill hills mount mountain peak ridge valley vale dale glen pass gorge canyon desert dunes oasis plain plains steppe farm farmstead barn stable
  stables yard workshop forge smithy bakery brewery shop store stall stalls warehouse lodge camp outpost watchtower lighthouse beacon hut cottage
  shack chamber room rooms parlor parlour library archive school academy college guild office station platform deck ring bay hold hull dome lab
  barracks prison jail gaol asylum hospital infirmary bathhouse baths theatre theater arena pit court courthouse palace throne hearth kitchen
  cafe café bar club hotel motel apartment apartments flat flats block alley rooftop roof subway metro park plaza mall arcade garage factory
  docking engine engines med mess observation hangar habitat colony base bunker
  watch guard guards order brotherhood sisterhood company band crew gang guildhall council circle house family clan kin sons daughters
  league society hand fist eye crown court church faithful lodge party ring syndicate cartel union legion host riders men women folk
  sword blade knife dagger axe spear bow shield helm ring amulet locket pendant charm coin key book letter map lantern lamp cup bell mirror
  cloak coat hat boots gloves scarf ribbon brooch box chest flask bottle pipe whistle compass knife needle thread doll toy stone bone tooth claw
  feather shell bead beads seal sigil token badge medal note journal diary ledger deed
  tankard flagon anchor barrel kettle cauldron plough plow wheel anvil hammer horn harp drum stag boar bear lion swan goose fox hound dog horse
  mare bull ox ram goat cat crow rook owl hawk eagle heron wolf otter eel pike trout oak ash elm willow yew pine birch rowan thorn holly ivy
  rose lily apple pear barley wheat hop vine grape honey bread cheese ale mead wine beer saddle lamb fiddle crossed drowned jolly merry happy
  lucky drunken laughing weeping sleeping painted gilded`.split(/\s+/).filter(Boolean),
);

export type NameUse = "place" | "group" | "thing";

/**
 * A name Gambit was given by a model, made fit to use. The sources' own
 * names stay as they are; so do ordinary words. A stock word (Whispering,
 * Shadow) is dropped. A stock name (Vance, Shadowfen) is swapped for a
 * candidate, and for a place or group so is any made-up word the sources
 * never use, unless the name is built on a candidate already. A place or
 * group left with no name of its own takes a candidate in front. A thing
 * (an item, a kind of foe) only swaps a stock person's name, drops the
 * rest, and comes back empty when nothing is left.
 */
export function fixName(name: string, use: NameUse, canon: Canon, candidates: readonly string[]): string {
  const raw = name.replace(/\s+/g, " ").trim();
  if (!raw || inCanon(raw, canon)) return raw;
  const own = new Set(candidates.flatMap(words));
  // A name built on a candidate did as asked: its other words are the model's to choose.
  const built = raw.split(" ").some((t) => words(t).length && words(t).every((w) => own.has(w)));
  let next = 0;
  const take = (): string | null => (candidates.length ? candidates[next++ % candidates.length]! : null);
  const out: string[] = [];
  let named = false;
  let dropped = false;
  let lastSwapped = false;
  const tokens = raw.split(" ");
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;
    const ws = words(tok.replace(/['’]s$/i, ""));
    if (!ws.length) {
      out.push(tok);
      continue;
    }
    const nextFirst = words(tokens[i + 1] ?? "")[0] ?? "";
    const kind = ws.every((w) => own.has(w))
      ? "own"
      : ws.every((w) => canon.proper.has(w))
        ? "canon"
        : ws.some((w) => (use === "thing" ? SLOP_NAMES.has(w) : slopName(w)))
          ? "swap"
          : ws.some((w) => slopWord(w) || slopName(w)) || (ws.length === 1 && SLOP_PAIR_FIRST.has(ws[0]!) && SLOP_PAIR_SECOND.has(nextFirst))
            ? "drop"
            : ws.every((w) => JOINERS.has(w) || PLAIN.has(w) || canon.words.has(w)) || use === "thing" || built
              ? "keep"
              : "swap";
    if (kind === "drop") {
      dropped = true;
      continue;
    }
    if (kind === "swap") {
      dropped = true;
      if (lastSwapped) continue;
      const c = take();
      lastSwapped = true;
      if (c) {
        out.push(/['’]s$/i.test(tok) ? `${c}'s` : c);
        named = true;
      }
      continue;
    }
    lastSwapped = false;
    if (kind !== "keep") named = true;
    out.push(tok);
  }
  while (out.length && JOINERS.has(normName(out[out.length - 1]!))) out.pop();
  while (out.length > 1 && JOINERS.has(normName(out[0]!)) && normName(out[0]!) !== "the") out.shift();
  if (out.length === 1 && normName(out[0]!) === "the") out.pop();
  let fixed = out.join(" ");
  if (use !== "thing" && dropped && !named) {
    const c = take();
    if (c) fixed = fixed ? `${c} ${fixed.replace(/^the\s+/i, "")}` : c;
  }
  return fixed ? fixed[0]!.toUpperCase() + fixed.slice(1) : "";
}

/* ------------------------------ plain skills ---------------------------- */

const HIT_ONE: Record<Element, string[]> = {
  physical: ["Strike", "Heavy Blow", "Slash", "Jab"],
  fire: ["Fire Bolt", "Flame Burst", "Scorch"],
  frost: ["Ice Shard", "Frostbite", "Cold Snap"],
  storm: ["Lightning Bolt", "Shock", "Spark"],
  water: ["Water Lash", "Splash", "Soak"],
  earth: ["Rock Throw", "Stone Fist", "Stomp"],
  light: ["Light Beam", "Flash", "Holy Bolt"],
  shadow: ["Dark Bolt", "Curse", "Hex"],
  blood: ["Blood Cut", "Bloodletting", "Bite"],
};
const HIT_ALL: Record<Element, string[]> = {
  physical: ["Sweep", "Whirlwind", "Cleave"],
  fire: ["Fire Wave", "Fireball", "Firestorm"],
  frost: ["Frost Wave", "Blizzard", "Hailstorm"],
  storm: ["Thunderclap", "Chain Lightning", "Storm"],
  water: ["Wave", "Flood", "Downpour"],
  earth: ["Quake", "Rockslide", "Landslide"],
  light: ["Flare", "Light Burst", "Blinding Flash"],
  shadow: ["Dark Wave", "Gloom", "Mass Curse"],
  blood: ["Blood Rain", "Blood Spray", "Frenzy"],
};
const MULTI: Record<Element, string> = {
  physical: "Flurry", fire: "Fire Flurry", frost: "Ice Flurry", storm: "Lightning Flurry", water: "Water Flurry",
  earth: "Stone Flurry", light: "Light Flurry", shadow: "Dark Flurry", blood: "Blood Flurry",
};
const STATUS_SKILL: Record<StatusId, string[]> = {
  bleed: ["Rend", "Open Wound"], burn: ["Set Alight", "Firebrand"], poison: ["Poison Dart", "Venom"], frost: ["Chill", "Freeze"],
  stun: ["Stun", "Knockout"], fear: ["Scare", "Threaten"], mark: ["Mark", "Spot the Gap"], vulnerable: ["Expose", "Break Guard"],
  weaken: ["Weaken", "Sap Strength"], slow: ["Hobble", "Slow"], taunt: ["Taunt", "Call Out"], silence: ["Silence", "Gag"],
  guarded: ["Guard Up", "Brace"], regen: ["Second Wind", "Rest"], haste: ["Quicken", "Hurry"],
};
const OP_SKILL: Record<string, [string[], string[]]> = {
  heal: [["Heal", "Patch Up", "Mend"], ["Group Heal", "Rally", "Healing Rain"]],
  shield: [["Shield", "Cover", "Block"], ["Shield Wall", "Close Ranks", "Cover Fire"]],
  cleanse: [["Cleanse", "Shake It Off"], ["Purge", "Clear Heads"]],
  delay: [["Trip", "Knock Back", "Shove"], ["Stampede", "Push Back"]],
  haste_self: [["Quick Step", "Sprint"], ["Quick Step", "Sprint"]],
  drain: [["Drain", "Leech", "Siphon"], ["Mass Drain", "Feast"]],
  execute: [["Finishing Blow", "Coup de Grâce", "Put Down"], ["Finish Them", "Mop Up"]],
  gain: [["Catch Breath", "Focus", "Steady"], ["Catch Breath", "Focus"]],
};

/** The atom that says most about a skill: its heaviest, harm before help when they tie. */
function mainAtom(atoms: readonly Atom[]): Atom | null {
  let best: Atom | null = null;
  for (const a of atoms) if (!best || (a.weight ?? 1) > (best.weight ?? 1)) best = a;
  return best;
}

/** A plain name for what a skill does ("Fire Bolt", "Shield Wall"), not one in `used`. */
export function plainSkillName(atoms: readonly Atom[], target: TargetRule, used: ReadonlySet<string> = new Set()): string {
  const a = mainAtom(atoms);
  const wide = target === "all_enemies" || target === "all_allies" || target === "random_enemies";
  let names: string[];
  if (!a) names = ["Strike"];
  else if (a.op === "hit") names = (a.hits ?? 1) > 1 && !wide ? [MULTI[a.element], ...HIT_ONE[a.element]] : (wide ? HIT_ALL : HIT_ONE)[a.element];
  else if (a.op === "status") names = STATUS_SKILL[a.status];
  else names = OP_SKILL[a.op]?.[wide ? 1 : 0] ?? ["Strike"];
  const taken = new Set([...used].map(normName));
  const free = names.find((n) => !taken.has(normName(n)));
  if (free) return free;
  for (let i = 2; ; i++) if (!taken.has(normName(`${names[0]} ${i}`))) return `${names[0]} ${i}`;
}

/** A skill name a model gave, kept unless it is stock fantasy and not the sources' own; then a plain one from what it does. */
export function fixSkillName(name: string, atoms: readonly Atom[], target: TargetRule, canon: Canon, used: ReadonlySet<string> = new Set()): string {
  return !isSlop(name) || inCanon(name, canon) ? name : plainSkillName(atoms, target, used);
}

const ELEMENT_CLASS: Record<Element, string> = {
  physical: "Fighter", fire: "Fire Mage", frost: "Frost Mage", storm: "Storm Mage", water: "Water Mage",
  earth: "Stone Mage", light: "Priest", shadow: "Dark Mage", blood: "Blood Mage",
};

/** A class name a model gave, or a plain one from its element ("Fire Mage"), or "Healer" for a class that mostly mends. */
export function fixClassName(name: string, element: Element, skills: readonly { atoms: readonly Atom[] }[], canon: Canon): string {
  if (!isSlop(name) || inCanon(name, canon)) return name;
  const helps = skills.filter((s) => ["heal", "shield", "cleanse"].includes(mainAtom(s.atoms)?.op ?? "")).length;
  return helps * 2 > skills.length ? "Healer" : ELEMENT_CLASS[element];
}

const PASSIVE: Record<TriggerEvent, string> = {
  turn_start: "Steady", deal_hit: "Follow Through", take_hit: "Thick Skin", apply_status: "Mean Streak",
  kill: "Second Wind", break: "Press On", crit: "Lucky Break", ally_falls: "Last Stand",
};

/** A passive's name, or a plain one for when it fires. */
export const fixPassiveName = (name: string, on: TriggerEvent, canon: Canon): string => (!isSlop(name) || inCanon(name, canon) ? name : PASSIVE[on]);

/** A resource's name, or "Charge". */
export const fixResourceName = (name: string, canon: Canon): string => (!isSlop(name) || inCanon(name, canon) ? name : "Charge");
