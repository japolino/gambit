/** The stage themes, each its own interface (see contract.ts). */
import type { ThemeId } from "../../../shared/scene-view.js";
import type { ThemeFactory } from "./contract.js";
import { storybook } from "./storybook.js";
import { lobby } from "./lobby.js";
import { onebit } from "./onebit.js";
import { command } from "./command.js";

export const THEME_FACTORIES: Record<ThemeId, ThemeFactory> = { storybook, lobby, onebit, command };
