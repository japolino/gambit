/**
 * The rules-only reader: Parley still works with no Decision connection and
 * no helper model (docs/DESIGN.md 9). Keyword cues for the tactic, word
 * overlap with the listener's wants and fears for fit, length and detail for
 * credibility, likes and hates for temperament, keyword groups for facts.
 * Crude on purpose: it keeps the game playable, not clever.
 */
import { words } from "../engine/parley/similarity.js";
import { META_TEXT } from "../engine/parley/exchange.js";
import type { ParleyScenario, RefereeRead, Tactic } from "../engine/parley/types.js";

const CUES: [Tactic, RegExp][] = [
  ["threat", /\b(or else|i('| wi)ll (hurt|kill|break|burn|report|tell)|you('| wi)ll regret|watch yourself|threat|guards?|knife|blade|throat|bleed|ruin you)\b/i],
  ["bribe", /\b(coin|crowns?|gold|silver|pay you|buy you|a drink|a round|for your trouble|on me|tip)\b/i],
  ["insult", /\b(idiot|fool|stupid|hag|thief|liar|coward|worthless|pathetic|drunk(ard)?)\b/i],
  ["flattery", /\b(finest|beautiful|lovely|best (in|on)|so (wise|skilled)|admire|impressive|handsome|pretty)\b/i],
  ["humor", /\b(ha(ha)+|joke|kidding|laugh|funny)\b|😂|😄/i],
  ["empathy", /\b(i understand|must be hard|i'm sorry|sorry for|lost|grief|i know how|rough (season|time)|struggl)/i],
  ["candor", /\b(the (whole |honest )?truth|honest(ly)?|i admit|i confess|i was wrong|i stole|my fault)\b/i],
  ["interest", /\b(deal|bargain|trade|profit|business|regular customer|buy (more|again|in bulk)|on the spot|cash|you gain|good for you)\b/i],
  ["logic", /\b(because|since|therefore|the law|the rules?|writ|papers|evidence|market price|fair price|worth)\b/i],
];

function tacticOf(text: string, stance: ParleyScenario["npc"]["stance"]): { tactic: Tactic; tacticP: Partial<Record<Tactic, number>> } {
  if (META_TEXT.test(text)) return { tactic: "nonsense", tacticP: { nonsense: 0.95 } };
  const hits = CUES.filter(([, re]) => re.test(text)).map(([t]) => t);
  if (!hits.length) return { tactic: words(text).length < 3 ? "nonsense" : "logic", tacticP: {} };
  // When several fit, prefer what this listener reacts to (likes, then hates), else the first cue.
  const tactic = hits.find((t) => stance.likesTactics?.includes(t)) ?? hits.find((t) => stance.hatesTactics?.includes(t)) ?? hits[0]!;
  return { tactic, tacticP: { [tactic]: 0.6 } };
}

function overlap(text: string, phrases: string[]): number {
  const w = new Set(words(text).filter((x) => x.length > 3));
  let hits = 0;
  for (const p of phrases) if (words(p).some((x) => x.length > 3 && w.has(x))) hits++;
  return hits;
}

export function factMentioned(text: string, groups: string[][]): boolean {
  const w = new Set(words(text));
  const stem = (x: string) => [...w].some((y) => y === x || y.startsWith(x));
  return groups.some((g) => g.every(stem));
}

export function rulesRead(scenario: ParleyScenario, text: string): RefereeRead {
  const s = scenario.npc.stance;
  const { tactic, tacticP } = tacticOf(text, s);
  const asserts: Record<string, number> = {};
  for (const f of scenario.facts) asserts[f.id] = factMentioned(text, f.keywords) ? 0.8 : 0;
  const n = words(text).length;
  const touched = overlap(text, [...s.wants, ...s.fears]) + Object.values(asserts).filter((p) => p >= 0.5).length;
  const fit = Math.min(3, touched >= 3 ? 3 : touched === 2 ? 2.4 : touched === 1 ? 1.8 : 0.8);
  const specific = /\d/.test(text) ? 0.5 : 0;
  const credibility = Math.min(3, (n < 4 ? 0.5 : n < 10 ? 1.3 : n < 40 ? 2 : 2.2) + specific);
  let temperament = 2;
  if (s.likesTactics?.includes(tactic)) temperament = 3.2;
  if (s.hatesTactics?.includes(tactic)) temperament = 0.8;
  if (tactic === "threat") temperament += s.temperament.fear >= 0.6 ? 1 : s.temperament.pride >= 0.6 ? -1 : 0;
  if (tactic === "insult") temperament = Math.min(temperament, 0.6);
  if (tactic === "nonsense") temperament = 0.5;
  return { tactic, tacticP, fit, credibility, temperament: Math.max(0, Math.min(4, temperament)), asserts, otherClaim: 0, by: "rules" };
}
