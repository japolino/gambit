/**
 * Where the pieces of a thread are, and what to do next about it.
 *
 * What someone knows is won from them: a piece that names a person is theirs to give, in a talk (or, beaten, in a
 * fight). A piece that names only a place is found by searching it. A piece that names nobody and nowhere is given
 * to someone who would know, so every piece has a face or a place to go to. The player is told where the missing
 * pieces are (`threadLeads`) and the one thing to do next (`threadNext`), never what a piece says.
 */

export interface ThreadPiece {
  id: string;
  text: string;
}

/** The people and places a thread can point at, and where each person is now (a place id, or none). */
export interface ThreadWorld {
  cast: readonly { id: string; name: string; at?: string; pronoun?: string }[];
  places: readonly { id: string; name: string }[];
}

/** Words of a name that don't tell one person from another. */
const TITLES = new Set(["the", "of", "a", "an", "and", "sister", "brother", "father", "mother", "captain", "lord", "lady", "sir", "dame", "king", "queen", "prince", "princess", "doctor", "master", "mistress", "old", "young", "saint", "elder", "miss", "von", "van", "de", "la", "le"]);

const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasWord = (text: string, word: string) => new RegExp(`(^|[^\\p{L}\\p{N}])${escape(word)}($|[^\\p{L}\\p{N}])`, "iu").test(text);
const hash = (s: string) => [...s].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261) >>> 0;

/** A person is named by any telling word of their name ("Orla" for "Sister Orla Venn"). */
function namesPerson(text: string, name: string): boolean {
  const words = name.split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}'-]/gu, ""));
  const telling = words.filter((w) => w.length >= 3 && !TITLES.has(w.toLowerCase()));
  return (telling.length ? telling : [name.trim()]).some((w) => !!w && hasWord(text, w));
}

/** A place is named in full, with or without its "The". */
function namesPlace(text: string, name: string): boolean {
  const bare = name.trim().replace(/^the\s+/i, "");
  return bare.length >= 3 && hasWord(text, bare);
}

/**
 * Who holds a piece and where it belongs: the people it names (who can be found) and the places it names. A piece
 * that names neither is given to someone who can be found, always the same one for the same words, or with nobody
 * to give it to, to a place. Only in a world with neither is a piece loose (both lists empty).
 */
export function anchorsOf(text: string, w: ThreadWorld): { cast: string[]; places: string[] } {
  const cast = w.cast.filter((c) => c.at && namesPerson(text, c.name)).map((c) => c.id);
  const places = w.places.filter((p) => namesPlace(text, p.name)).map((p) => p.id);
  if (cast.length || places.length) return { cast, places };
  const found = w.cast.filter((c) => c.at);
  if (found.length) return { cast: [found[hash(text) % found.length]!.id], places: [] };
  return { cast: [], places: w.places.length ? [w.places[hash(text) % w.places.length]!.id] : [] };
}

const missing = (pieces: readonly ThreadPiece[], revealed: readonly string[]) => pieces.filter((p) => !revealed.includes(p.id));

/** The piece winning this person over (or beating them) gives: the first missing one that is theirs. */
export function pieceFrom(pieces: readonly ThreadPiece[], revealed: readonly string[], w: ThreadWorld, castId: string): ThreadPiece | undefined {
  return missing(pieces, revealed).find((p) => anchorsOf(p.text, w).cast.includes(castId));
}

/** Everyone who holds a missing piece. */
export function holders(pieces: readonly ThreadPiece[], revealed: readonly string[], w: ThreadWorld): Set<string> {
  return new Set(missing(pieces, revealed).flatMap((p) => anchorsOf(p.text, w).cast));
}

/**
 * The piece a search of this place turns up: the first missing one that belongs to the place and to nobody.
 * `people`: talks are off on this card, so what the people here know is found here too.
 */
export function pieceHere(pieces: readonly ThreadPiece[], revealed: readonly string[], w: ThreadWorld, placeId: string, people = false): ThreadPiece | undefined {
  const here = new Set(w.cast.filter((c) => c.at === placeId).map((c) => c.id));
  return missing(pieces, revealed).find((p) => {
    const a = anchorsOf(p.text, w);
    if (a.cast.length) return people && a.cast.some((id) => here.has(id));
    return a.places.includes(placeId);
  });
}

/** The piece a search here turns up: the one that belongs here, else one that is loose (a world with nobody and nowhere). */
export function pieceAt(pieces: readonly ThreadPiece[], revealed: readonly string[], w: ThreadWorld, placeId: string, people = false): ThreadPiece | undefined {
  return (
    pieceHere(pieces, revealed, w, placeId, people) ??
    missing(pieces, revealed).find((p) => {
      const a = anchorsOf(p.text, w);
      return !a.cast.length && !a.places.length;
    })
  );
}

export interface ThreadLead {
  /** In plain words: "Sister Orla Venn, at the Chapel", "The Old Mill", or where anything can turn up. */
  text: string;
  castId?: string;
  placeId?: string;
}

/** Where each missing piece can be found, in the order they come out, without saying what it is. */
export function threadLeads(pieces: readonly ThreadPiece[], revealed: readonly string[], w: ThreadWorld): ThreadLead[] {
  const placeName = (id: string | undefined) => w.places.find((p) => p.id === id)?.name;
  const out: ThreadLead[] = [];
  const add = (lead: ThreadLead) => {
    if (!out.some((x) => x.text === lead.text)) out.push(lead);
  };
  for (const p of missing(pieces, revealed)) {
    const a = anchorsOf(p.text, w);
    const who = w.cast.find((c) => c.id === a.cast[0]);
    if (who) add({ text: `${who.name}${placeName(who.at) ? `, at ${placeName(who.at)}` : ""}`, castId: who.id, ...(who.at ? { placeId: who.at } : {}) });
    else if (a.places[0]) add({ text: placeName(a.places[0])!, placeId: a.places[0] });
    else add({ text: "Anywhere you search" });
  }
  return out;
}

/** "what she knows", "what they know". */
export const whatTheyKnow = (pronoun: string | undefined): string => (/^(she|he|it)$/i.test(pronoun ?? "") ? `what ${pronoun!.toLowerCase()} knows` : "what they know");

/** What to do next about the thread, as one action in plain words, and the menu action that does it. */
export interface ThreadNext {
  text: string;
  /** The menu action that does it: `ask:<cast>`, `search`, `go:<place>`, or the action that ends the day. */
  act?: string;
}

/**
 * The one next step: what can be done here and now comes first (ask someone here, search this place), then the way
 * to the first missing piece that hasn't been tried today, then ending the day when today has nothing left to give.
 */
export function threadNext(
  pieces: readonly ThreadPiece[],
  revealed: readonly string[],
  w: ThreadWorld,
  at: {
    here: string;
    /** Places searched today: one search a day each. */
    searched: ReadonlySet<string>;
    /** People already asked today: one try a day each. */
    asked: ReadonlySet<string>;
    /** The card has talks: a person's piece is won from them. Without, it is found where they are. */
    talks: boolean;
    /** The first step from here toward a place (itself when it is next door), or null when there is no way. */
    hop(to: string): string | null;
    /** The action that ends the day here, if there is one. */
    sleep?: string;
  },
): ThreadNext | null {
  const left = missing(pieces, revealed).map((p) => anchorsOf(p.text, w));
  if (!left.length) return null;
  const person = (id: string) => w.cast.find((c) => c.id === id);
  const place = (id: string | undefined) => w.places.find((p) => p.id === id)?.name ?? "there";
  /** Where a piece is got, and how: from someone (asked, or with talks off searched for where they are), or by searching a place. */
  const ways = (a: { cast: string[]; places: string[] }): { to: string; ask?: string }[] => {
    const people = a.cast.map(person).filter((c): c is NonNullable<typeof c> => !!c?.at);
    if (people.length) return people.map((c) => (at.talks ? { to: c.at!, ask: c.id } : { to: c.at! }));
    return a.places.length ? a.places.map((to) => ({ to })) : [{ to: at.here }];
  };
  const open = (way: { to: string; ask?: string }) => (way.ask ? !at.asked.has(way.ask) : !at.searched.has(way.to));
  const all = left.flatMap(ways).filter(open);
  // Here and now.
  const now = all.find((x) => x.to === at.here);
  if (now?.ask) return { text: `Ask ${person(now.ask)!.name} ${whatTheyKnow(person(now.ask)!.pronoun)}`, act: `ask:${now.ask}` };
  if (now) return { text: `Search ${place(at.here)}`, act: "search" };
  // Somewhere else: the first piece that hasn't been tried today and has a way to it.
  for (const way of all) {
    const step = at.hop(way.to);
    if (!step) continue;
    const then = way.ask ? `ask ${person(way.ask)!.name}` : "search it";
    return { text: step === way.to ? `Go to ${place(way.to)} and ${then}` : `Go to ${place(way.to)}, by way of ${place(step)}, and ${then}`, act: `go:${step}` };
  }
  return { text: "Nothing more to find today. End the day and try again tomorrow", ...(at.sleep ? { act: at.sleep } : {}) };
}

/** How many days a thread has, the first included: enough for a piece a day and one to spare, and never under three. */
export const threadDays = (pieces: number): number => Math.max(3, pieces + 1);

/** How a piece is found, for the player. One line, the same in every theme. */
export const THREAD_HOW = "What someone knows, you win from them: ask, and make your case. They give way sooner if they like you, or if you have found something on them; beaten in a fight they give it up too, and remember it. One try a day each. A piece that belongs to a place is found by searching it.";
