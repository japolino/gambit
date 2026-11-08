/** The battle themes, one per scene theme (each in its own file; see ./types.ts). */
import type { ThemeId } from "../../../shared/scene-view.js";
import type { BattleTheme } from "./types.js";
import { theme as command } from "./command.js";
import { theme as diorama } from "./diorama.js";
import { theme as lobby } from "./lobby.js";
import { theme as onebit } from "./onebit.js";
import { theme as storybook } from "./storybook.js";
import { theme as table } from "./table.js";

export const BATTLE_THEMES: Record<ThemeId, BattleTheme> = { storybook, diorama, lobby, table, onebit, command };
