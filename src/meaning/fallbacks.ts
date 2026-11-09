/**
 * Code-only answers (docs/DESIGN.md 4.5, "fallbacks"): what Gambit uses when
 * the model is missing, slow, or its answer fails the checks. Seeded and
 * pure, so the same card always gets the same stand-ins.
 */
import { freshNames } from "../engine/card/naming.js";
import { normName as baseNorm } from "../engine/card/names.js";
import type { CardSheet, SheetPlace } from "../engine/card/types.js";

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

type Genre = "fantasy" | "modern" | "scifi" | "horror";

export function genreOf(sheet: Pick<CardSheet, "skin" | "premise" | "tone">): Genre {
  const t = `${sheet.skin.genre} ${sheet.tone} ${sheet.premise}`.toLowerCase();
  if (/\b(space|sci-?fi|cyber|starship|station|android|robot|planet|galax|mech|future)/.test(t)) return "scifi";
  if (/\b(horror|haunt|ghost|eldritch|zombie|undead|occult|cursed|nightmare)/.test(t)) return "horror";
  if (/\b(modern|contemporary|school|office|city|college|university|apartment|police|detective|noir|mafia|idol|slice of life)/.test(t)) return "modern";
  return "fantasy";
}

/** Place names by genre: [name, one line]. {P} takes a real place name and {S} a surname, drawn for the card. */
const PLACES: Record<Genre, [string, string][]> = {
  fantasy: [
    ["The Inn at {P}", "A low inn with rooms to rent where every road meets"],
    ["{P} Market", "A crowded market of stalls, smoke and haggling"],
    ["The Shrine above {P}", "A weathered shrine where travellers leave offerings"],
    ["{P} Watchtower", "A lonely tower over the road, half its stones fallen"],
    ["{P} Wood", "A dark forest where the paths close behind you"],
    ["The Crypt under {P}", "A crypt under the old chapel, flooded and haunted"],
    ["{S}'s Forge", "A forge that never cools, ringing day and night"],
    ["{P} Docks", "Wet planks, barges and gulls at the river's bend"],
  ],
  modern: [
    ["{S}'s Cafe", "A small cafe that stays open later than it should"],
    ["{P} Station", "A busy train station, its board always delayed"],
    ["The Rooftop", "A rooftop above the city lights, out of the wind"],
    ["The Back Alley", "A narrow alley behind the bars, where deals happen"],
    ["The Apartment on {P} Street", "A cramped apartment with a view of the street"],
    ["The Night Market", "Stalls and neon under the overpass"],
    ["The Old {P} Line Tunnel", "A sealed subway tunnel under the city, dark and dripping"],
    ["{P} Park", "A quiet park with a pond and too many crows"],
  ],
  scifi: [
    ["The Docking Ring", "Airlocks, cargo crates and shuttle traffic"],
    ["The Mess Hall", "Long tables, recycled air and the best gossip aboard"],
    ["{S}'s Bazaar", "A market deck of traders and black-market stalls"],
    ["The Med Bay", "White light and quiet machines"],
    ["The Observation Dome", "Glass, stars, and a long way down"],
    ["The Wreck of the {P}", "A dead ship's corridors, cold and drifting"],
    ["The Engine Room", "Heat, noise and warning lights"],
    ["{P} Gardens", "Hydroponic gardens under grow lamps"],
  ],
  horror: [
    ["The Parlor at {S} House", "A dusty parlor with covered furniture and a ticking clock"],
    ["{P} Chapel", "A small chapel whose candles are always lit"],
    ["{P} Graveyard", "Leaning stones and a gate that will not close"],
    ["The Cellar", "A cellar under the house, dark and damp"],
    ["The {S} Arms", "A pub where the locals stop talking when you enter"],
    ["The Woods Path", "A path into the woods that the map does not show"],
    ["The Catacombs under {P}", "Bones in the walls and passages that branch forever"],
    ["{P} Lighthouse", "A dark lighthouse over the rocks"],
  ],
};

const normName = (s: string) => baseNorm(s).replace(/^the\s+/, "").replace(/'/g, "");

/** Up to `n` stand-in places for this genre, each with its own drawn name, none named like one the card already has. */
export function fallbackPlaces(sheet: Pick<CardSheet, "skin" | "premise" | "tone" | "places" | "cardKey" | "cast" | "player" | "cardName" | "names">, n: number, wantDelve = false): SheetPlace[] {
  const genre = genreOf(sheet);
  const start = hash(sheet.cardKey) % PLACES[genre].length;
  const ordered = [...PLACES[genre].slice(start), ...PLACES[genre].slice(0, start)];
  // A delve shape needs somewhere to explore: put the first underground place first.
  if (wantDelve) ordered.sort((a, b) => Number(/crypt|tunnel|wreck|catacomb|cellar/i.test(b[0])) - Number(/crypt|tunnel|wreck|catacomb|cellar/i.test(a[0])));
  const picked = ordered.slice(0, Math.max(0, n));
  const places = freshNames(sheet, "place", "fallback", picked.length);
  const surnames = freshNames(sheet, "surname", "fallback", picked.length, places);
  const have = new Set(sheet.places.map((p) => normName(p.name)));
  return picked
    .map(([template, description], i) => ({ name: template.replace("{P}", places[i] ?? "").replace("{S}", surnames[i] ?? ""), description }))
    .filter((p) => !have.has(normName(p.name)))
    .map(({ name, description }) => ({ id: `x_${normName(name).replace(/ /g, "_")}`, name, description, evidence: { source: "gambit", quote: "", verified: false } }));
}

export interface ThreadDraft {
  goal: string;
  revelations: string[];
}

/** A templated mystery around the card's own people, for a card that gives no goal. */
export function fallbackThread(sheet: Pick<CardSheet, "cast" | "places" | "cardKey" | "premise">): ThreadDraft | null {
  const people = sheet.cast.filter((c) => c.name).map((c) => c.name);
  if (!people.length) return null;
  const h = hash(`${sheet.cardKey}:thread`);
  const a = people[h % people.length]!;
  const b = people[(h + 1) % people.length]!;
  const place = sheet.places[h % Math.max(1, sheet.places.length)]?.name ?? "this place";
  return {
    goal: `Find out what ${a} is keeping from everyone`,
    revelations: [
      `${a} has been meeting someone in secret`,
      `Something was hidden at ${place} long ago`,
      b !== a ? `${b} knows more than they let on` : `${a} is not the only one who knows`,
      `The secret is older than ${a}`,
      `Someone would lose everything if it came out`,
    ],
  };
}

export interface Vignette {
  text: string;
  /** Cast id or place id it shows, when there is one. */
  who?: string;
  where?: string;
}

/** "Meanwhile…" lines from templates: who was where, doing what, while you slept. */
export function fallbackMeanwhile(sheet: Pick<CardSheet, "cast" | "places" | "cardKey">, day: number, factions: { name: string; want: string }[] = []): Vignette[] {
  const h = hash(`${sheet.cardKey}:night:${day}`);
  const DOING = [
    "could not sleep, and walked until dawn",
    "wrote a letter, then burned it",
    "was seen talking quietly with a stranger",
    "counted what was left, twice",
    "sat alone with a drink that went untouched",
    "kept watch, though nobody asked them to",
  ];
  const AT_PLACE = ["the lights burned late", "a door was found open that should have been locked", "someone asked after you by name", "the talk was all of you"];
  const out: Vignette[] = [];
  const cast = sheet.cast.slice(0, 6);
  for (let i = 0; i < Math.min(2, cast.length); i++) {
    const m = cast[(h + i * 3) % cast.length]!;
    out.push({ who: m.id, text: `${m.name} ${DOING[(h + i * 5) % DOING.length]}.` });
  }
  const places = sheet.places;
  if (places.length) {
    const p = places[(h >>> 3) % places.length]!;
    out.push({ where: p.id, text: `At ${p.name.replace(/^The /, "the ")}, ${AT_PLACE[(h >>> 5) % AT_PLACE.length]}.` });
  }
  if (factions.length) {
    const f = factions[(h >>> 7) % factions.length]!;
    out.push({ text: `${f.name} moved a step closer to what they want: ${f.want.replace(/\.$/, "")}.` });
  }
  if (out.length < 3) out.push({ text: "The night was quiet. Too quiet, some would say later." });
  return out.slice(0, 5);
}

/** A place name pulled from a line of roleplay ("they head into the Rusted Anchor"), or null. */
export function placeNameFrom(text: string): string | null {
  const m = /\b(?:to|into|inside|at|reach(?:es|ed)?|enter(?:s|ed)?|arrive(?:s|d)? at)\s+(?:the\s+)?((?:[A-Z][\w'’-]+)(?:\s+(?:of\s+the\s+|of\s+)?[A-Z][\w'’-]+){0,3})/.exec(text);
  const name = m?.[1]?.trim();
  if (!name || name.length < 3 || /^(I|You|He|She|They|We|It)$/.test(name)) return null;
  return /\sthe\s/i.test(m![0]) ? `The ${name}` : name;
}
