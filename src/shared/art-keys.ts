/**
 * Art keys shared by the backend (which requests art) and the stage (which
 * shows it). A combatant's base key is `Combatant.art`.
 */

/** The determined-expression variant a party member's signature cut-in uses. */
export const cutinArtKey = (art: string): string => `${art}#determined`;

/** Whether a key is a cut-in expression (opaque ones get their background keyed out). */
export const isCutinArtKey = (key: string): boolean => key.endsWith("#determined");
