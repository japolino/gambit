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
   - `slots`: which effect and sound play where. `null` is empty, `"none"` switches a slot off. A slot can also
     set `tint` (`"#rrggbb"`) and `scale` for its effect only, so one sheet can serve two slots (fire uses the
     orange spark burst, recoloured and enlarged).
   - per effect: `frameW`/`frameH` (frame size), `frames`, `fps`, `blend` (`add`, `screen`, `normal`), `scale`.
   - per sound: `volume` (0..1).
   - `source` on every file: site, pack and license. It goes into `CREDITS.md`.
4. To test inside Lumiverse: `bun run build && bun scripts/deploy-local.ts`, then restart the extension.

A file name can set the grid exactly: `slash_192x192.png` (frame size) or `burst_5x2.png` (columns x rows).

## Local demo files

`assets/demo/` (git-ignored) holds extra sheets and sounds for a local demo only, with the same `fx/` and `sfx/`
layout. When it exists, `bun run fx:import` also writes `assets/demo/manifest.json`: the main set plus the demo files
(ids start `demo_`), with its own slots (seeded from the main manifest; edit them there, the next import keeps your
edits) and `assets/demo/CREDITS.md`. The standalone preview reads the demo manifest first. A public install never
sees demo files; `assets/manifest.json` never names them.

## Slots

| Slot | Plays |
| --- | --- |
| `cutin.shut` | an ultimate cut-in starting: the cut to a grey flash and black |
| `cutin.crack` | electricity crawling over the black, then the lightning web |
| `cutin.shatter` | the black shattering (the sheet's first frames flash at the break) |
| `cutin.rush` | the picture rushing in through the break |
| `cutin.slam` | the picture locking into place |
| `cutin.speed` | the speed-line backdrop behind the picture (frames cycled) |
| `cutin.aura` | a quiet bed under the picture while it holds (stopped on the way out) |
| `cutin.stamp` | the skill name landing (also the panel cut-in's name) |
| `cutin.glint` | the glassy top of the break, and the shimmer on the fighter's name |
| `cutin.whiteout` | the whiteout at the end |
| `cutin.burst` | the energy release under the whiteout (sound layered with it) |
| `cutin.panel` | a regular (panel) cut-in snapping open |
| `hit.slash` | physical hits |
| `hit.impact` | blunt hits, earth, and any hit with no better slot |
| `hit.magic` | magic hits whose element slot is empty (an element slot missing its sheet or sound borrows this one's) |
| `hit.fire`, `hit.frost`, `hit.storm`, `hit.shadow`, `hit.light` | element hits (water uses frost, blood uses shadow) |
| `hit.crit` | critical hits, on top of the hit |
| `hit.heal` | heals |
| `hit.buff` | shields and helpful statuses |
| `hit.debuff` | harmful statuses |
| `hit.miss` | misses |
| `hit.guard` | a hit the shield took whole |
| `hit.break` | a foe's poise breaking |
| `hit.defeat` | a foe falling |
| `use.enemy` | an enemy winding up a move |
| `turn.start` | a party member's turn beginning |

A run of hits from one strike plays later hits' sounds softer, the same sound twice within 70 ms plays once, and a
party-wide heal or buff plays its sound once. The words the import uses to fill each slot from file names are in
`src/shared/fx.ts` (`SLOTS`).
