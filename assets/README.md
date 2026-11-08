# Effects and sounds

Sprite-sheet effects and sound effects for the battle stage. They ship with the extension: `spindle.json`
seeds this folder into extension storage on install and update, and the stage plays them by slot.

## Adding files

1. Put sprite sheets (PNG) in `fx/` and sounds (mp3, ogg, wav) in `sfx/`. Subfolders per pack are fine
   (`fx/pipoya/...`). One effect per sheet, frames in a grid, read left to right, top to bottom.
2. Run `bun run fx:import`. It writes `manifest.json` and `CREDITS.md`, and prints:
   - sheets whose frame grid it guessed (check them in the preview, `bun run preview`);
   - slots that are still empty;
   - files no slot uses;
   - files with no `source` yet.
3. Edit `manifest.json` where needed, then run `bun run fx:import` again (your edits are kept):
   - `slots`: which effect and sound play where. `null` is empty, `"none"` switches a slot off.
   - per effect: `frameW`/`frameH` (frame size), `frames`, `fps`, `blend` (`add`, `screen`, `normal`), `scale`.
   - per sound: `volume` (0..1).
   - `source` on every file: site, pack and license. It goes into `CREDITS.md`.
4. To test inside Lumiverse: `bun run build && bun scripts/deploy-local.ts`, then restart the extension.

A file name can set the grid exactly: `slash_192x192.png` (frame size) or `burst_5x2.png` (columns x rows).

## Slots

| Slot | Plays |
| --- | --- |
| `cutin.shut` | the screen shutting before a signature cut-in |
| `cutin.crack` | the black cracking |
| `cutin.shatter` | the shatter and the picture slamming in |
| `cutin.aura` | looping on the move while the picture holds |
| `cutin.stamp` | each word of the skill name landing |
| `cutin.whiteout` | the whiteout at the end |
| `hit.slash` | physical hits |
| `hit.impact` | any hit with no better slot |
| `hit.magic` | elemental hits |
| `hit.crit` | critical hits, on top of the hit |
| `hit.heal` | heals |

The words the import uses to fill each slot from file names are in `src/shared/fx.ts` (`SLOTS`).
