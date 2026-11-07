/**
 * Art keys shared by the backend (which requests art) and the stage (which
 * shows it). A combatant's base key is `Combatant.art`; an NPC's is
 * `npc:<id>`. Expressions hang off a base key as `<key>#<expression>`.
 */

export const EXPRESSIONS = ["happy", "sad", "angry", "surprised", "determined", "hurt"] as const;
export type Expression = (typeof EXPRESSIONS)[number];

export const expressionArtKey = (art: string, expression: Expression): string => `${art}#${expression}`;

/** The determined-expression variant a party member's signature cut-in uses. */
export const cutinArtKey = (art: string): string => expressionArtKey(art, "determined");

/** Whether a key is a cut-in expression (opaque ones get their background keyed out). */
export const isCutinArtKey = (key: string): boolean => key.endsWith("#determined");

/** Whether a key is any expression variant (V5 inset renders are opaque on white). */
export const isExpressionArtKey = (key: string): boolean => EXPRESSIONS.some((e) => key.endsWith(`#${e}`));

export const npcArtKey = (npcId: string): string => `npc:${npcId}`;

/** A card character's own full figure, drawn on-model from their card art and cut out (art kind "figure"). */
export const figureArtKey = (cardKey: string, castId: string): string => `figure:${cardKey}:${castId}`;
export const isFigureArtKey = (key: string): boolean => key.startsWith("figure:");
export const placeArtKey = (placeId: string): string => `place:${placeId}`;
