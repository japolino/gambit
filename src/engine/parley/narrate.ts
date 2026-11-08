/**
 * Words about a decided exchange: the narrator's outcome block (the prose
 * must match the dice, 4.1.2 step 7), the immersive read strip, and the
 * transparent "Why?" (4.1.4). No model is involved in any of it.
 */
import { readQuality } from "./exchange.js";
import type { Exchange, Mood, ParleyScenario, ParleyState } from "./types.js";
import { TIER_NAMES } from "./types.js";

const RESULT_LABEL = { crit_success: "Critical success", success: "Success", partial: "Partial", fail: "Fail", crit_fail: "Critical fail" } as const;

const GENERIC_TELL: Record<Mood, (n: string, p: string) => string> = {
  moved: (n) => `${n} goes quiet for a moment.`,
  tempted: (n) => `${n}'s eyes flick to the coin.`,
  considering: (n) => `${n} tilts ${"their"} head, weighing it.`,
  unmoved: (n) => `${n} doesn't so much as blink.`,
  irritated: (n) => `${n}'s jaw tightens.`,
  suspicious: (n) => `${n}'s eyes narrow.`,
  confused: (n) => `${n} frowns, puzzled.`,
  afraid: (n) => `${n} takes half a step back.`,
  amused: (n) => `${n} almost smiles.`,
};

const possessive = (p: "she" | "he" | "they") => (p === "she" ? "her" : p === "he" ? "his" : "their");

export function tellFor(scenario: ParleyScenario, mood: Mood): string {
  const own = scenario.npc.stance.tells[mood];
  const name = scenario.npc.name;
  // A tell can be a verb phrase ("almost smiles") or its own sentence ("Her hands go still").
  if (own) return (/^[A-Z]/.test(own) ? `${own}.` : `${name} ${own}.`).replace(/\.\.$/, ".");
  return GENERIC_TELL[mood](name, scenario.npc.pronoun).replace("their", possessive(scenario.npc.pronoun));
}

export function formatValue(scenario: ParleyScenario, v: number): string {
  const c = scenario.contest;
  return c.unit ? `${Math.round(v)} ${c.unit}` : `${Math.round(v)}`;
}

/** Immersive mode: tells and a qualitative line, no numbers. */
export function immersiveRead(scenario: ParleyScenario, ex: Exchange): string {
  const parts = [tellFor(scenario, ex.mood)];
  const pr = scenario.npc.pronoun === "they" ? "They" : scenario.npc.pronoun === "she" ? "She" : "He";
  if (ex.nonsense) parts.push(`${pr} can't make sense of that.`);
  else if (ex.bluff?.caught) parts.push(`${pr} doesn't believe a word of it.`);
  else if (ex.leverageFacts.length) {
    const f = scenario.facts.find((x) => x.id === ex.leverageFacts[0]);
    parts.push(f ? `The bit about ${shortClaim(f.claim)} landed.` : "That landed.");
  } else if (ex.repetition >= 0.5) parts.push(`${pr}'s heard this already.`);
  else if (ex.tier >= 3 && !ex.roll.result.endsWith("fail")) parts.push("That reached them.".replace("them", scenario.npc.pronoun === "she" ? "her" : scenario.npc.pronoun === "he" ? "him" : "them"));
  else if (ex.tier === 0) parts.push("That did not sit well.");
  return parts.join(" ");
}

function shortClaim(claim: string): string {
  const s = claim.replace(/^(that |the fact that )/i, "").replace(/[.!]+$/, "");
  return s.length > 60 ? `${s.slice(0, 57)}…` : s.charAt(0).toLowerCase() + s.slice(1);
}

/** Transparent mode's "Why?": the read, in code's words. */
export function whyText(scenario: ParleyScenario, ex: Exchange): string {
  const r = ex.read;
  const pct = (p: number | undefined) => `${Math.round((p ?? 0) * 100)}%`;
  const lines = [
    `Read by ${r.by === "jev" ? "the Referee (Jev)" : r.by === "helper" ? "the helper model" : "rules only"}: ${r.tactic} (${pct(r.tacticP[r.tactic])}).`,
    `Fit ${r.fit.toFixed(1)}/3, credibility ${r.credibility.toFixed(1)}/3, temperament ${r.temperament.toFixed(1)}/4 → quality ${Math.round(readQuality(r) * 100)}% → ${TIER_NAMES[ex.baseTier]}.`,
  ];
  const stance = scenario.npc.stance;
  if (ex.nonsense) lines.push("Talking to the judge instead of the person reads as nonsense.");
  if (stance.hatesTactics?.includes(r.tactic)) lines.push(`${scenario.npc.name} despises ${r.tactic}: one tier down.`);
  if (stance.likesTactics?.includes(r.tactic)) lines.push(`${scenario.npc.name} respects ${r.tactic}: one tier up.`);
  if (ex.repetition >= 0.5) lines.push(`Repeats an earlier argument (${pct(ex.repetition)} overlap): ${ex.repetition >= 0.8 ? "two tiers" : "one tier"} down.`);
  for (const id of ex.leverageFacts) {
    const f = scenario.facts.find((x) => x.id === id);
    if (f) lines.push(`Leverage from your journal: ${f.text}`);
  }
  if (ex.bluff) lines.push(`Bluff: d20 ${ex.bluff.face} + Guile ${ex.bluff.guile} vs Insight ${ex.bluff.insight} → ${ex.bluff.caught ? "caught (one tier down, rapport −2)" : "believed"}.`);
  return lines.join("\n");
}

/** Transparent mode's dice line. */
export function rollLine(ex: Exchange): string {
  const r = ex.roll;
  const parts = [`${ex.roll.notation} → ${r.natural}`, `${statName(r.stat)} ${signed(r.statBonus)}`];
  if (r.leverage) parts.push(`Leverage ${signed(r.leverage)}`);
  return `${parts.join(" ")} = ${r.total} vs DC ${r.dc}: ${RESULT_LABEL[r.result]}`;
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const statName = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What happened to the track, in words. */
export function effectLine(scenario: ParleyScenario, ex: Exchange): string {
  const c = scenario.contest;
  const n = scenario.npc.name;
  const b = ex.before.value;
  const a = ex.after.value;
  if (c.kind === "haggle") {
    if (a < b) return `${n} comes down from ${formatValue(scenario, b)} to ${formatValue(scenario, a)}.`;
    if (a > b) return `${n} raises the price to ${formatValue(scenario, a)}.`;
    return `${n} holds at ${formatValue(scenario, a)}.`;
  }
  if (a < b) return `${n}'s ${c.track} drops from ${Math.round(b)} to ${Math.round(a)}.`;
  if (a > b) return `${n}'s ${c.track} hardens, from ${Math.round(b)} to ${Math.round(a)}.`;
  return `${n}'s ${c.track} holds at ${Math.round(a)}.`;
}

/** Where this exchange leaves the talk, in so many words: the one thing the narrator's prose can't change. */
function verdict(scenario: ParleyScenario, state: ParleyState, ex: Exchange): string {
  const { npc, contest: c } = scenario;
  const not = npc.pronoun === "they" ? "they do not" : `${npc.pronoun} does not`;
  if (ex.ended?.kind === "final_offer") return `${npc.name} is out of patience and makes a FINAL offer at ${formatValue(scenario, state.value)}: take it or leave it.`;
  if (ex.ended?.kind === "won") return `${npc.name} gives in: the player gets ${c.stake}.`;
  if (ex.ended?.kind === "refused") return `${npc.name} is out of patience and refuses for good: the answer is no, and the talk is over. Whatever softened along the way, ${not} agree, help, or tell the player what to do next.`;
  return `${npc.name} has NOT given in: ${not} agree, promise, or go along with anything, and the player does not get ${c.stake} yet. Softening is fine if the dice allow it; a yes is not.`;
}

/**
 * The block the interceptor injects before the narrator writes. Everything
 * in it is already decided; the narrator only voices it.
 */
export function outcomeBlock(scenario: ParleyScenario, state: ParleyState, ex: Exchange): string {
  const npc = scenario.npc;
  const c = scenario.contest;
  const lines: string[] = [];
  lines.push(`[Gambit · Parley · exchange ${ex.index + 1}. OUTCOME ALREADY DECIDED BY DICE. Narrate it faithfully; do not change it, reverse it, or add numbers that differ.]`);
  lines.push(`Scene: ${scenario.setting}`);
  lines.push(`${npc.name}, ${npc.role}. Contest: ${c.kind} over ${c.stake}.`);
  lines.push(`The player's words read as ${ex.read.tactic}, ${TIER_NAMES[ex.tier].toLowerCase()}. Result: ${RESULT_LABEL[ex.roll.result].toLowerCase()}.`);
  lines.push(effectLine(scenario, ex));
  if (ex.leverageFacts.length) {
    for (const id of ex.leverageFacts) {
      const f = scenario.facts.find((x) => x.id === id);
      if (f) lines.push(`It worked because the player knows: ${f.text}`);
    }
  }
  if (ex.bluff?.caught) lines.push(`${npc.name} sees through the player's claim and will remember the lie.`);
  else if (ex.bluff) lines.push(`${npc.name} believes the player's claim.`);
  if (ex.nonsense) lines.push(`The player's words make no sense to ${npc.name}; ${npc.pronoun} is confused, not offended.`);
  lines.push(`${npc.name}'s mood: ${ex.mood}. Show it through this tell: ${tellFor(scenario, ex.mood)}`);
  lines.push(verdict(scenario, state, ex));
  if (!ex.ended) lines.push(`The negotiation continues; ${npc.name} has ${state.patience} of ${npc.stance.patience} patience left. End on a line that invites the player's next move.`);
  if (npc.voice) lines.push(`Voice: ${npc.voice}`);
  lines.push(...REPLY_RULES(npc.name));
  return lines.join("\n");
}

/** Format rules for the narrator's reply in a Parley: short, this NPC only. */
const REPLY_RULES = (name: string): string[] => [
  `Reply as ${name} only: 1 to 3 short paragraphs, under 180 words, ${name}'s words, tone and body language.`,
  "Do not write the player's words, actions, thoughts or decisions. Do not bring in other characters. No headings, chapter titles or scene breaks.",
];

/** The narrator's standing brief while a Parley is open (before any exchange too). */
export function sceneBlock(scenario: ParleyScenario, state: ParleyState): string {
  const npc = scenario.npc;
  const s = npc.stance;
  return [
    `[Gambit · Parley in progress with ${npc.name}, ${npc.role}. ${scenario.setting}]`,
    `What ${npc.pronoun} wants: ${s.wants.join("; ")}. What ${npc.pronoun} fears: ${s.fears.join("; ")}.`,
    `Respects: ${s.respects.join(", ")}. Despises: ${s.despises.join(", ")}.`,
    `Current ${scenario.contest.track}: ${formatValue(scenario, state.value)}. Patience ${state.patience}/${s.patience}.`,
    ...(npc.voice ? [`Voice: ${npc.voice}`] : []),
    ...REPLY_RULES(npc.name),
  ].join("\n");
}

/**
 * Gambit's own narrator (no chat preset involved): one quiet call that voices
 * the NPC for this exchange only. The conversation so far is replayed as
 * turns so the NPC remembers what was said; the outcome block closes the
 * system prompt, where it carries the most weight.
 */
export function narratorPrompt(scenario: ParleyScenario, state: ParleyState, ex: Exchange): { system: string; messages: { role: "user" | "assistant"; content: string }[] } {
  const npc = scenario.npc;
  const player = scenario.speaker.name === "you" ? `Call the player "you", with no name or gender for them` : `The player is ${scenario.speaker.name}, in the third person`;
  const system = [
    `You are the narrator of a scene in a roleplay game. You voice exactly one character: ${npc.name}, ${npc.role}. Write ${npc.name} in the third person ("${npc.name} frowns"), never "I" outside spoken words. Present tense, vivid but brief. ${player}.`,
    `Setting: ${scenario.setting}`,
    ...(scenario.story ? [`The story so far, as written. This is the same ${npc.name}: the same voice and manner as here, and what happened stands.`, scenario.story] : []),
    sceneBlock(scenario, { ...state, value: ex.before.value, patience: ex.before.patience }),
    "The player's lines arrive as user turns. The game has already decided how each one landed; you only voice the result.",
    "",
    outcomeBlock(scenario, { ...state, value: ex.after.value, patience: ex.after.patience }, ex),
  ].join("\n");
  const messages: { role: "user" | "assistant"; content: string }[] = [{ role: "assistant", content: scenario.opening }];
  for (const prior of state.exchanges.slice(0, ex.index)) {
    messages.push({ role: "user", content: prior.text });
    messages.push({ role: "assistant", content: prior.reply ?? effectLine(scenario, prior) });
  }
  // Said again where the model looks last: prose that turns a no into a yes undoes the whole contest.
  const after = { ...state, value: ex.after.value, patience: ex.after.patience };
  messages.push({ role: "user", content: `${ex.text}\n\n[The game has decided: ${verdict(scenario, after, ex)}]` });
  return { system, messages };
}

/** Curly quotes for a paragraph: some book faces draw a straight quote as a closing one, even where the speech opens. */
export function smartQuotes(text: string): string {
  return text.replace(/(^|[\s([\u2014\u2013-]|(?:^|\s)\*)"/g, "$1\u201c").replace(/"/g, "\u201d");
}

/** Tidy a narrator reply: drop headings and scene breaks, cap the length. */
/** A status line a card's rules asked a model to add: "[HP: 100/100 | Mana: 50/50 | Gold: 0]". The game keeps those numbers itself, and these are invented. */
function isStatusLine(l: string): boolean {
  if (!/\b(hp|mp|mana|stamina|gold|coins?|level|lv|exp|xp|items?|inventory|status)\s*[:=]/i.test(l) || /["“”]/.test(l)) return false;
  return /^\s*[[(【*]/.test(l) || l.includes("|") || (l.length < 120 && /\d+\s*\/\s*\d+/.test(l));
}

export function cleanReply(text: string, maxWords = 260): string {
  const lines = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .split("\n")
    .filter((l) => !/^\s{0,3}#{1,6}\s/.test(l) && !/^\s*([-*_]\s*){3,}$/.test(l) && !isStatusLine(l));
  let out = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const words = out.split(/\s+/);
  if (words.length > maxWords) {
    out = words.slice(0, maxWords).join(" ");
    const stop = Math.max(out.lastIndexOf(". "), out.lastIndexOf('." '), out.lastIndexOf("!"), out.lastIndexOf("?"));
    if (stop > out.length * 0.5) out = out.slice(0, stop + 1);
  }
  return out;
}

/** What someone says when the narrator can't: never the game's numbers, which the Parley's own display already shows. */
const FALLBACK_SAID: Record<string, string> = {
  crit_success: '"...Oh."',
  success: '"Go on."',
  partial: '"Perhaps."',
  fail: '"No."',
};

/** A short reply when no narrator can write one. */
export function fallbackReply(scenario: ParleyScenario, state: ParleyState, ex: Exchange): string {
  const said = scenario.contest.kind === "haggle" ? effectLine(scenario, ex) : (FALLBACK_SAID[ex.roll.result] ?? '"Careful."');
  const parts = [tellFor(scenario, ex.mood), ...(ex.ended ? [] : [said])];
  if (ex.ended?.kind === "final_offer") parts.push(`"${formatValue(scenario, state.value)}. Final. Take it or go."`);
  else if (ex.ended?.kind === "won") parts.push(`"Fine. Have it your way."`);
  else if (ex.ended?.kind === "refused") parts.push(`"We're done here."`);
  return parts.join(" ");
}
