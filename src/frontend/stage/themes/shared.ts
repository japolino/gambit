/** Type stacks and palettes the battle themes share (kept in step with the scene's board skins). */
export const FELL = '"Gambit Fell", "Gambit Garamond", Georgia, serif';
export const GARAMOND = '"Gambit Garamond", "Palatino Linotype", Georgia, serif';
export const CINZEL = '"Gambit Cinzel", "Gambit Garamond", Georgia, serif';
export const BIT = '"Gambit 8bit", "Gambit Pixel", monospace';

/** The EGA palette, and the low-intensity half the terminal theme keeps its pictures to (command/pixels.ts). */
export const EGA = [0x000000, 0x0000aa, 0x00aa00, 0x00aaaa, 0xaa0000, 0xaa00aa, 0xaa5500, 0xaaaaaa, 0x555555, 0x5555ff, 0x55ff55, 0x55ffff, 0xff5555, 0xff55ff, 0xffff55, 0xffffff];
export const COMMAND_ART: Record<string, number[]> = {
  ega: [0, 2, 3, 4, 5, 6, 7, 8, 15].map((i) => EGA[i]!),
  cga: [0x000000, 0x55ffff, 0xff55ff, 0xffffff],
  mono: [0x000000, 0x555555, 0xaaaaaa, 0xffffff],
};

export const INK1 = 0x080707;
export const PAPER1 = 0xf0eee6;
