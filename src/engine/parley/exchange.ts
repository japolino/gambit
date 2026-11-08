/**
 * One Parley exchange, start to finish, in code (docs/DESIGN.md 4.1.2-4.1.5):
 * the Referee's read becomes a tier, verified Leverage and the stat become
 * the bonus, the ask and rapport become the DC, three die faces fixed by
 * (parley seed, exchange index) are rolled, and the result moves the track.
 *
 * Pure and deterministic: the same state, words and read give the same
 * exchange. Editing the words re-judges them but keeps the die faces.
 */
import { d20Tier, seededRng, rollD20 } from "../dice.js";
import { echoesFact, repetition } from "./similarity.js";
import type {
  ArgumentTier,
  BluffCheck,
  Exchange,
  ExchangeRoll,
  Fact,
  Mood,
  ParleyEnd,
  ParleyScenario,
  ParleyState,
  RefereeRead,
  ResultTier,
  SocialStat,
  Tactic,
} from "./types.js";
import { TIER_DICE } from "./types.js";

/** Meta text aimed at the judge, not the person: always read as nonsense (4.1.5). */
export const META_TEXT =
  /\b(ignore (all |any |the |your |previous |prior |above )*(instructions|rules|prompt|messages)|system prompt|as an? (ai|language model)|you are (an? |the )?(ai|language model|referee|judge|classifier)|developer mode|jailbreak|(rate|score|grade|mark|judge) (this|me|it)( argument)? (as )?(compelling|the highest|maximum|max|perfect)|(output|answer|return|respond with) ["']?(compelling|level ?[0-9]))/i;

export const LEVERAGE_CAP = 4;
const PARTIAL_BAND = 4;
/** Lines that claim nothing to be checked: honesty is taken as said, and praise, jokes and abuse are rhetoric, not facts. */
const NEVER_A_CLAIM: readonly Tactic[] = ["candor", "flattery", "humor", "insult"];
const MAX_RAPPORT = 3;

export function statFor(tactic: Tactic): SocialStat {
  if (tactic === "threat" || tactic === "insult") return "menace";
  if (tactic === "bluff") return "guile";
  return "presence";
}

/** 0..1: one number for how good the argument is for *this* listener. */
export function readQuality(read: Pick<RefereeRead, "fit" | "credibility" | "temperament">): number {
  const clamp = (v: number, hi: number) => Math.max(0, Math.min(hi, v)) / hi;
  return 0.4 * clamp(read.fit, 3) + 0.3 * clamp(read.credibility, 3) + 0.3 * clamp(read.temperament, 4);
}

export function tierFromQuality(q: number): ArgumentTier {
  if (q >= 0.82) return 4;
  if (q >= 0.64) return 3;
  if (q >= 0.44) return 2;
  if (q >= 0.26) return 1;
  return 0;
}

const clampTier = (t: number): ArgumentTier => Math.max(0, Math.min(4, Math.round(t))) as ArgumentTier;

export function isNonsense(text: string, read: RefereeRead): boolean {
  return META_TEXT.test(text) || read.tactic === "nonsense" || (read.tacticP.nonsense ?? 0) >= 0.5;
}

/** A haggle offer: the last number in the speech that could be a price here. */
export function parseOffer(text: string, scenario: ParleyScenario): number | null {
  if (scenario.contest.kind !== "haggle") return null;
  const lo = scenario.contest.hardFloor * 0.25;
  const hi = scenario.contest.start * 1.5;
  const nums = [...text.matchAll(/(?<![\w.])(\d{1,6})(?![\w.]*\d)/g)].map((m) => Number(m[1])).filter((n) => n >= lo && n <= hi);
  return nums.length ? nums[nums.length - 1]! : null;
}

export function createParley(scenario: ParleyScenario, seed: string, chatId: string | null = null): ParleyState {
  const c = scenario.contest;
  return {
    id: `${scenario.id}:${seed}`,
    scenarioId: scenario.id,
    seed,
    chatId,
    value: c.start,
    floor: c.floor,
    patience: scenario.npc.stance.patience,
    rapport: 0,
    usedFacts: [],
    caughtBluffs: 0,
    known: [...scenario.known],
    exchanges: [],
    end: null,
  };
}

/** The three die faces of exchange `index`: fixed whatever is said. */
export function exchangeFaces(seed: string, index: number): [number, number, number] {
  const rng = seededRng(`${seed}:x${index}`);
  return [rollD20(rng), rollD20(rng), rollD20(rng)];
}

function useFaces(faces: [number, number, number], tier: ArgumentTier): { used: number[]; natural: number } {
  const used = tier === 2 ? faces.slice(0, 1) : tier === 1 || tier === 3 ? faces.slice(0, 2) : faces.slice();
  const natural = tier < 2 ? Math.min(...used) : Math.max(...used);
  return { used, natural };
}

function dcFor(scenario: ParleyScenario, state: ParleyState, offer: number | null): number {
  const c = scenario.contest;
  let dc = c.dc - state.rapport + 2 * state.caughtBluffs;
  if (offer !== null) {
    const range = Math.max(1, c.start - c.hardFloor);
    if (offer >= state.value) dc -= 6;
    else if (offer < state.floor) dc += 2 + Math.min(3, Math.round((3 * (state.floor - offer)) / range));
    else dc += Math.round((2 * (state.value - offer)) / Math.max(1, state.value - state.floor)) - 1;
  }
  return dc;
}

function moodFor(result: ResultTier, tactic: Tactic, nonsense: boolean, caught: boolean): Mood {
  if (nonsense) return "confused";
  if (caught) return "suspicious";
  if (result === "crit_fail") return "irritated";
  if (result === "fail") return "unmoved";
  if (result === "partial") return "considering";
  if (tactic === "threat") return "afraid";
  if (tactic === "humor") return "amused";
  if (tactic === "bribe" || tactic === "interest") return "tempted";
  return "moved";
}

const factById = (scenario: ParleyScenario, id: string): Fact | undefined => scenario.facts.find((f) => f.id === id);

/**
 * Judge one argument and apply it. Returns the new state (the input is not
 * changed) and the exchange record, which is everything the UI, the
 * narrator and a replay need.
 */
export function applyExchange(scenario: ParleyScenario, prev: ParleyState, text: string, read: RefereeRead): { state: ParleyState; exchange: Exchange } {
  if (prev.end) throw new Error("This Parley is over.");
  const c = scenario.contest;
  const stance = scenario.npc.stance;
  const index = prev.exchanges.length;
  const state: ParleyState = { ...prev, usedFacts: [...prev.usedFacts], known: [...prev.known], exchanges: [...prev.exchanges] };
  const before = { value: prev.value, floor: prev.floor, patience: prev.patience, rapport: prev.rapport };

  // 1. The read becomes a tier.
  const nonsense = isNonsense(text, read);
  const tactic: Tactic = nonsense ? "nonsense" : read.tactic;
  const baseTier = nonsense ? 0 : tierFromQuality(readQuality(read));
  let tier: number = baseTier;
  if (!nonsense) {
    if (stance.hatesTactics?.includes(tactic)) tier -= 1;
    if (stance.likesTactics?.includes(tactic)) tier += 1;
    if (tactic === "insult" && !stance.likesTactics?.includes("insult")) tier = Math.min(tier, 1);
    tier = clampTier(tier);
  }
  // Word overlap, or the meaning-level repeat measured when the line was judged (stored on the read, so replays agree).
  const rep = Math.max(repetition(text, prev.exchanges.map((e) => e.text)), read.meaningRepeat ?? 0);
  if (!nonsense) tier -= rep >= 0.8 ? 2 : rep >= 0.5 ? 1 : 0;

  // 2. Claims, verified in code: known facts are Leverage, the rest are bluffs.
  const leverageFacts: string[] = [];
  let leverage = 0;
  let bluffFact: string | null | undefined;
  if (!nonsense) {
    for (const [id, p] of Object.entries(read.asserts)) {
      const fact = factById(scenario, id);
      if (!fact || p < 0.5) continue;
      if (state.known.includes(id)) {
        leverageFacts.push(id);
        leverage += state.usedFacts.includes(id) ? Math.min(1, fact.leverage) : fact.leverage;
      } else if (bluffFact === undefined) {
        bluffFact = id;
      }
    }
    // Something the player really knows, said in their own words, is Leverage even if the read missed it. It's never a bluff.
    for (const id of state.known) {
      const fact = factById(scenario, id);
      if (!fact || leverageFacts.includes(id) || !echoesFact(text, fact.text, scenario.npc.name)) continue;
      leverageFacts.push(id);
      leverage += state.usedFacts.includes(id) ? Math.min(1, fact.leverage) : fact.leverage;
    }
    if (bluffFact === undefined && !leverageFacts.length && // The claim question says yes to almost any statement about the listener: alone it proves nothing, so the read of the whole line has to lean toward a bluff too.
    ((read.otherClaim >= 0.6 && (read.tacticP.bluff ?? 0) >= 0.25 && !NEVER_A_CLAIM.includes(tactic)) || (tactic === "bluff" && (read.tacticP.bluff ?? 1) >= 0.5))) bluffFact = null;
  }

  let bluff: BluffCheck | null = null;
  if (bluffFact !== undefined) {
    const face = rollD20(seededRng(`${prev.seed}:x${index}:bluff`));
    const guile = scenario.speaker.stats.guile;
    const insight = 10 + stance.insight + 2 * prev.caughtBluffs;
    const caught = face === 1 ? true : face === 20 ? false : face + guile < insight;
    bluff = { fact: bluffFact, face, guile, insight, caught };
    if (caught) {
      tier -= 1;
      state.caughtBluffs += 1;
      state.rapport = Math.max(-MAX_RAPPORT, state.rapport - 2);
    } else {
      const f = bluffFact ? factById(scenario, bluffFact) : undefined;
      leverage += f ? Math.ceil(f.leverage / 2) : 1;
    }
  }
  leverage = Math.min(LEVERAGE_CAP, leverage);
  const finalTier = clampTier(tier);

  // 3. Leverage moves the floor, once per fact (4.1.3).
  for (const id of leverageFacts) {
    if (state.usedFacts.includes(id)) continue;
    state.usedFacts.push(id);
    const shift = factById(scenario, id)?.floorShift ?? 0;
    if (shift) state.floor = Math.max(c.hardFloor, state.floor - shift * (c.start - c.hardFloor));
  }
  if (c.kind === "haggle") state.floor = Math.round(state.floor);

  // 4. Dice: faces fixed by (seed, index); the tier picks which count.
  const offer = parseOffer(text, scenario);
  const faces = exchangeFaces(prev.seed, index);
  const { used, natural } = useFaces(faces, finalTier);
  const stat = statFor(tactic);
  const statBonus = scenario.speaker.stats[stat];
  const dc = dcFor(scenario, { ...prev, rapport: before.rapport }, offer);
  const result = d20Tier(natural, statBonus + leverage, dc, PARTIAL_BAND);
  const roll: ExchangeRoll = { faces, notation: TIER_DICE[finalTier], used, natural, stat, statBonus, leverage, dc, total: natural + statBonus + leverage, result };

  // 5. The result moves the track and spends patience.
  const target = offer !== null ? Math.min(state.value, Math.max(offer, state.floor)) : state.floor;
  const gap = state.value - target;
  const range = c.start - c.hardFloor;
  // A price closes by halves and the player takes a deal. A persuade-style track has to be won outright, so it closes in even steps: with room for one miss before patience runs out.
  const step = c.winAt !== undefined ? range / Math.max(2, stance.patience - 1) : null;
  let value = state.value;
  let patience = state.patience;
  if (result === "crit_success") {
    value = target;
    patience = Math.min(stance.patience, patience + 1);
    state.rapport = Math.min(MAX_RAPPORT, state.rapport + 1);
  } else if (result === "success") {
    value -= step !== null ? Math.min(gap, step) : gap * 0.5;
    patience -= 1;
  } else if (result === "partial") {
    value -= step !== null ? Math.min(gap, step / 2) : gap * 0.25;
    patience -= 1;
  } else if (result === "fail") {
    patience -= 1;
  } else if (nonsense) {
    // Meta text backfires mildly: confused, not offended.
    patience -= 1;
  } else {
    value = Math.min(c.start * 1.25, value + range * 0.1);
    patience -= 2;
    state.rapport = Math.max(-MAX_RAPPORT, state.rapport - 1);
  }
  if (c.kind === "haggle") value = Math.round(value);
  // The last sliver of a gap closes outright, so a track never crawls by ones.
  if ((result === "success" || result === "partial") && value - target <= Math.max(1, range * 0.03)) value = target;
  state.value = value;
  state.patience = Math.max(0, patience);

  let ended: ParleyEnd | null = null;
  if (c.winAt !== undefined && state.value <= c.winAt) ended = { kind: "won" };
  else if (state.patience <= 0) ended = c.kind === "haggle" ? { kind: "final_offer" } : { kind: "refused" };
  if (ended && ended.kind !== "final_offer") state.end = ended;

  const exchange: Exchange = {
    index,
    text,
    read: { ...read, tactic },
    baseTier,
    tier: finalTier,
    repetition: rep,
    nonsense,
    leverageFacts,
    bluff,
    offer,
    roll,
    before,
    after: { value: state.value, floor: state.floor, patience: state.patience, rapport: state.rapport },
    mood: moodFor(result, tactic, nonsense, bluff?.caught === true),
    ended,
  };
  state.exchanges.push(exchange);
  return { state, exchange };
}

/** Haggle: take the current price. Any contest: walk away. */
export function closeParley(scenario: ParleyScenario, prev: ParleyState, how: "deal" | "walk"): ParleyState {
  if (prev.end) return prev;
  if (how === "deal" && scenario.contest.kind !== "haggle") throw new Error("Only a haggle ends in a deal.");
  return { ...prev, end: how === "deal" ? { kind: "deal", value: prev.value } : { kind: "walked" } };
}

/** Rebuild a Parley from its words and reads (after a message is deleted or edited). */
export function replayParley(scenario: ParleyScenario, start: ParleyState, inputs: readonly { text: string; read: RefereeRead; messageId?: string; reply?: string }[]): ParleyState {
  let state: ParleyState = { ...start, value: scenario.contest.start, floor: scenario.contest.floor, patience: scenario.npc.stance.patience, rapport: 0, usedFacts: [], caughtBluffs: 0, exchanges: [], end: null };
  for (const input of inputs) {
    if (state.end) break;
    const r = applyExchange(scenario, state, input.text, input.read);
    if (input.messageId) r.exchange.messageId = input.messageId;
    if (input.reply) r.exchange.reply = input.reply;
    state = r.state;
  }
  return state;
}
