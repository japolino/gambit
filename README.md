<div align="center">

# Gambit

**An RPG under your roleplay.**
Deterministic turn-based combat, words that move the dice, fusable classes, and generated art that moves.
A [Lumiverse](https://lumiverse.chat) extension.

[![CI](https://github.com/japolino/gambit/actions/workflows/ci.yml/badge.svg)](https://github.com/japolino/gambit/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fjapolino%2Fgambit%2Fmaster%2Fspindle.json&query=%24.version&label=version&color=c9a227)](spindle.json)
[![Lumiverse](https://img.shields.io/badge/Lumiverse-%E2%89%A5%201.2.4-6b4fbb)](https://lumiverse.chat)
[![Last commit](https://img.shields.io/github/last-commit/japolino/gambit?color=555)](https://github.com/japolino/gambit/commits/master)
<br>
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Bun](https://img.shields.io/badge/Bun-1.4-f9f1e1?logo=bun&logoColor=black)](https://bun.sh)
[![PixiJS](https://img.shields.io/badge/PixiJS-v8-e72264)](https://pixijs.com)
[![three.js](https://img.shields.io/badge/three.js-r171-black?logo=threedotjs)](https://threejs.org)

<img src="docs/media/table-battle.jpg" alt="A battle at the card table: two hooded foes across the table, the party's cards on a rack, skills fanned as cards, turn order chalked on a slate" width="100%">

</div>

## What it is

You roleplay in Lumiverse the way you always do; underneath sits a real game. Gambit plays **the card you have selected**: its characters are the people you bargain with, fight and travel beside, its lorebooks are the map, and your persona is your character sheet.

- **Models judge, code decides.** Models design skills, read your arguments and draw the world. Every number comes from seeded dice and formulas in code, so nothing a model says can save you from a bad roll or cheat you out of a good one.
- **Your words are a stat.** In a Parley (a talk, a haggle, a bluff) what you actually type is scored into a bounded dice modifier, and you see the roll.
- **Real fights.** A turn-based timeline engine with focus, class resources, statuses, signature skills and full-screen cut-ins.
- **Classes you shape.** Fuse two classes, or forge one from a sentence; every new signature skill gets its own illustrated cut-in.
- **Art that moves.** Portraits, figures, places and moments are generated per card and animated as puppets on the stage. The game never waits for art.
- **Six interfaces.** Each scene theme is its own game interface, down to how a fight and a talk look.

## Themes

Every theme carries its look through the scene, the battle and the Parley. Table and Diorama are real three.js rooms, and their fights and talks happen inside them.

| | |
|:-:|:-:|
| <img src="docs/media/diorama-battle.jpg" alt="Diorama battle: paper foes on oak bases on a lit shop counter"><br>**Diorama**: the fight on the shop counter | <img src="docs/media/storybook-battle.jpg" alt="Storybook battle: gilt arches for the party and a turn order of heraldic shields"><br>**Storybook**: a battle told on the book's pages |
| <img src="docs/media/lobby-battle.jpg" alt="Lobby battle: ornate brass cards and engraved skill medallions"><br>**Lobby**: brass cards and skill medallions | <img src="docs/media/command-battle.jpg" alt="Command battle: a crawler fight on a CRT monitor"><br>**Command**: a crawler fight on the monitor |
| <img src="docs/media/onebit-battle.jpg" alt="1-bit battle: a two-colour console with a WHAT NOW? command list"><br>**1-bit**: two colours, one grid | <img src="docs/media/table-parley.jpg" alt="Table Parley: facts held as cards, patience as candles"><br>**Table Parley**: facts in hand, patience as candles |
| <img src="docs/media/storybook-parley.jpg" alt="Storybook Parley: a visual-novel talk with banners for fare and patience"><br>**Storybook Parley**: a visual-novel talk | <img src="docs/media/lobby-parley.jpg" alt="Lobby Parley: a brass balance for the deal"><br>**Lobby Parley**: the deal on a brass balance |

*Screenshots use the preview's code-drawn stand-in art; in play, the art comes from your card.*

## Install

1. In Lumiverse, open the drawer → **Extensions** → **Add Extension**.
2. Paste `https://github.com/japolino/gambit` into **Install from Source** and click **Install**.
3. Review the requested permissions and turn the extension on. It needs Lumiverse 1.2.4 or later.
4. Open a chat and choose **Play with Gambit** in the Gambit drawer.

Gambit uses your Lumiverse connections for text and images.

## Development

Requires [Bun](https://bun.sh) 1.4.

```bash
bun install
bun run verify        # tests, typecheck and build
bun run preview       # standalone preview at http://localhost:4174 (no Lumiverse needed)
```

| Command | What it does |
| --- | --- |
| `bun test` | Engine, art pipeline and UI logic tests |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run build` | Bundles `dist/backend.js` and `dist/frontend.js` |
| `bun run preview` | Scene, battle (`/`), Parley (`/parley`) and cut-in (`/cutin`) harnesses, rebuilt on every request |
| `bun run play` | Plays a battle in the terminal with no models and no art |
| `bun run balance` | Runs every encounter hundreds of times and reports the balance |
| `bun run fx:import` | Indexes the effect sheets and sounds in `assets/` (see [assets/README.md](assets/README.md)) |
| `bun scripts/deploy-local.ts <lumiverse dir>` | Copies a build into a local Lumiverse install |

### Layout

```text
src/
  engine/      rules: combat, Parley, dice, classes (pure, seeded, tested)
  backend/     the Spindle side: card reading, model calls, art queue, storage
  frontend/
    stage/     Pixi battle stage, cut-ins, effects, per-theme battle screens (stage/themes)
    parley/    the Parley view and per-theme Parley screens (parley/themes)
    scene/     the scene screen and its six themes, two of them three.js rooms
  shared/      protocol and types shared by both sides
assets/        effect sheets and sounds, played by slot
looks/         art-direction presets
docs/DESIGN.md the full design document
```

The design, the rules and the roadmap are in [docs/DESIGN.md](docs/DESIGN.md).

## Credits

- Effect animations by [ぴぽや (Pipoya)](https://pipoya.net/sozai/) and sound effects by [効果音ラボ (Sound Effect Lab)](https://soundeffect-lab.info/), used under their terms; see [assets/CREDITS.md](assets/CREDITS.md).
- Fonts: Cinzel, Cormorant Garamond, IM Fell English, Press Start 2P and VT323, under the SIL Open Font License ([licenses/](licenses)).
- Built on [PixiJS](https://pixijs.com) and [three.js](https://threejs.org).
