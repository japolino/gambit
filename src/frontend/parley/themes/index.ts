/** The Parley themes, one per scene theme (each in its own file; see ./types.ts). */
import type { ThemeId } from "../../../shared/scene-view.js";
import type { ParleyTheme } from "./types.js";
import { theme as command } from "./command.js";
import { theme as lobby } from "./lobby.js";
import { theme as onebit } from "./onebit.js";
import { theme as storybook } from "./storybook.js";

export const PARLEY_THEMES: Record<ThemeId, ParleyTheme> = { storybook, lobby, onebit, command };
