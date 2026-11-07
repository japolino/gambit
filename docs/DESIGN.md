# Gambit: design document

*Working title. A Lumiverse (Spindle) extension: an RPG where the rules are real, your words count, and the world is drawn while you play.*

Status: M0 to M2 built (engine, art spike, Parley). Version 0.2, 2026-11-06. Revised the same day to be **card-first** (4.0): Gambit plays the card you selected instead of shipping its own world.

---

## 0. The pitch in one paragraph

You play a roleplay in Lumiverse like you always do, but under it sits a real game. Fights run in a turn-based engine that can kill you. Merchants, guards, and bosses can be *talked* to, and what you actually type moves the dice. Classes can be fused, or forged from a sentence you write, and every new skill arrives with its own illustrated cut-in. The world remembers what you did and redraws itself to match. Behind all of it, models do the creative and judgment work: designing, judging, drawing. Code does every bit of arithmetic. Nothing the model says can save you from a bad roll, and nothing it says can cheat you out of a good one.

Gambit plays **the card you have selected**. Its characters are the people you bargain with, fight, and travel beside. Its setting and lorebooks are the map. Your persona is your character sheet. The rules are fixed, but the world, the cast, and even which parts of the game exist come from the card. A cozy café card gets conversations with stakes. A dungeon-crawl card gets the whole game.

---

## 1. Design pillars

1. **Models judge, code decides.** A model may design a skill, read an argument, or pick which story branch fits. It never sets a final number and never declares an outcome. Every outcome comes from seeded dice and formulas in code. This keeps tension in the game. A model that wants to please the player says "yes" to everything, and that kills stakes.
2. **Your words are a stat.** In a social scene the player's typed text is a real input. It is scored, turned into a bounded dice modifier, and shown to the player. A sharp argument beats a high Charisma score with a lazy one. Both together are best.
3. **Shape from the model, size from code.** When a model designs content (skills, classes, monsters, loot), it chooses the *structure*: which effects, which triggers, which targets, plus the name and flavor. Code chooses the *magnitudes* to fit a power budget, then simulates the result to check it.
4. **Never make the player wait at the table.** Heavy generation happens ahead of time and during natural pauses: resting, travel, the screen before a floor. Every asset has an instant placeholder, so the game never blocks on art.
5. **The world accumulates.** Everything generated is kept, reused, and built on. The town you burned stays burned, drawn as an edit of the same painting. The guard you kept talking to becomes a real character.
6. **The card is canon.** Content comes from the selected card, its lorebooks, the persona, and the chat, in that order. Gambit adds only what those leave open, marks what it added, and never edits or contradicts the card. The rules are the same on every card; the shape of the game is not. A card with no fighting never shows a combat screen.

---

## 2. What a session actually feels like

> You open a chat with **Captain Ilse Varga**, a card you downloaded about a smuggler captain in a drowned-coast port. Her card has an avatar, a lorebook about the Tide Guild and the customs fleet, and an opening scene in a dockside tavern. Your persona is a disgraced navigator.
>
> You switch Gambit on for this chat. While you read her greeting, Gambit reads the card. A short sheet appears in the drawer: **Cast:** Ilse, her quartermaster Dov (named in the lorebook), a customs inspector. **Places:** the tavern, the docks, Ilse's ship, the customs house. **Facts** (each with the line it came from): *the Tide Guild fined Ilse twice this month.* **Modules:** Parley, Encounters, Places, Economy. Your navigator gets a sheet built from your persona's description, with numbers sized by code. You adjust one stat and accept.
>
> You keep roleplaying. Ilse wants half your cut to take you upriver. Under her reply a chip appears: **Haggle with Ilse?** You tap it. The Parley scene opens with *her* card art, now with an annoyed expression drawn from her avatar. You type: *"The guild's fined you twice already. Another run with an empty hold and they'll take the ship."* **Ilse's read: Leverage (the fines are real, +2), she doesn't like being reminded.** You get 2d20, keep the higher, plus your Presence: 18 against DC 15. She drops to a third. Your line and her reply land in the chat as normal messages, and the story carries on from there.
>
> Two days upriver the lorebook's customs cutter shows up. The chip says **Fight the boarding party?** The battle uses the card's world: customs marines, a cutter deck, flintlocks. The engine underneath is the same timeline combat. Dov fights beside you using a kit built from the lorebook's description of him. Your navigator's signature move fires a two-second cut-in.
>
> The next week you open a slice-of-life café card. Gambit reads it and switches on **Parley** only: no combat, no map, no loot. Talking the owner into letting you run the late shift is still a real contest, with real dice.

The hand-made Saltgate scenes (Marta, Pell, Vey) ship as a **demo card**, played through the same path as any other card.

---

## 3. The four brains

| Role | Model | Latency budget | Does | Never does |
|---|---|---|---|---|
| **Narrator** | Your chat model (the normal Lumiverse connection), streamed | normal chat | Writes the prose of scenes, NPC dialogue, and battle aftermath, given the decided outcomes | Decides outcomes, edits state |
| **Architect** | Strongest LLM (helper connection, `generate.quiet`, JSON) | seconds to minutes, async | World bible, regions, dungeons, NPC dossiers, quests, skill and class designs, monster designs, consequences | Picks numbers, runs combat |
| **Referee** | Decision model (Jev, typed questions returning probabilities) | under ~2 s, hidden behind dice animation | Scores arguments, classifies intent, NPC reactions, branch selection, "is this claim plausible" | Generates prose |
| **Illustrator** | NAI v5 + GPT Image 2.6 (+ NAI 4.5 for precise reference) | seconds, queued | Portraits, monsters, backgrounds, cut-in poses, icons, edits of existing art | Text or UI (code renders typography) |

**Code** does everything else: dice, formulas, damage, prices, the timeline, validation, budgets, simulation, state, saves.

The Referee follows Warp's proven pattern: the model returns a **probability distribution over typed answers**, and the engine computes from it using its own seeded dice. Without Jev, a helper LLM imitates the typed answers in one batched JSON call. Without any model, rules-only fallbacks keep the game playable.

---

## 4. Core systems

### 4.0 Cards first: where the content comes from

Gambit does not ship a world. It reads one from the card the player selected.

**Sources, in canon order:**
1. **The card:** description, personality, scenario, first message and alternate greetings, example dialogue, creator notes, tags, avatar, and gallery. In a group chat, every member's card.
2. **The lorebooks:** the card's attached books, the persona's book, global books, and the chat's active entries (`world_books.resolveForChat`).
3. **The persona:** name, title, description.
4. **The chat so far.**
5. **Gambit's own additions,** only where 1 to 4 say nothing, each marked as Gambit-added.

**The Card Reader.** When the player turns Gambit on for a chat, the Architect reads those sources and writes a **Card Sheet**: JSON, validated, and frozen in the answer ledger.
- **Cast.** Every named character, with a role and a stance (wants, fears, likes, hates, tells). The model picks a social tier for each, and code turns the tier into stats. The card's main character is always in the cast.
- **Facts, places, factions.** Each fact quotes the span it came from, following Warp living-play's evidence model. Parley Leverage only counts facts the player has met in the chat or in the journal, so a fact buried in the lorebook doesn't help until play surfaces it.
- **Genre skin.** The names of things: stat names, currency, wound and damage words, and what a fight is (a sword duel, a firefight, a netrun, a court case). The engine underneath does not change.
- **Shape and modules.** How the world is laid out, and which parts of the game this card supports (both below).
- **Player sheet.** The persona's stats and kit, proposed from their description and sized by code. The player reviews and edits it before play.

The sheet is stored per card, so every chat with that card starts fast. Campaign state is per chat. When the card changes (`updated_at`), Gambit offers to re-read it and shows what changed.

**Modules, picked per card.** Gambit is a set of modules, not one campaign layout:

| Module | On when the card has… |
|---|---|
| **Parley** | anyone to talk to (almost every card) |
| **Encounters** (combat) | conflict, danger, or enemies |
| **Places and travel** | more than one location |
| **Delves** (room-graph dungeons) | ruins, dungeons, wrecks, stations: anything explored room by room |
| **Kits and fusion** | powers, skills, classes, or gear that matters |
| **Economy** | money, trade, or scarce goods |

The Card Reader proposes the set. The player can switch any module on or off per chat.

**Shapes, not one fixed map.** The world layout is one of a few shapes the reader picks from the card: a **single scene** (one place, many people), a **town**, a **journey** (a line of stops), a **frontier** (a hub plus regions), or a **delve**. Code builds and checks the graph for whichever shape it is (4.5).

**Started by the roleplay.** The player keeps roleplaying in chat. After each reply, one cheap batched Referee call asks whether the scene sets up a contest (talk, fight, explore) and with whom. When it does, a chip appears under the message: "Haggle with Ilse?", "Fight the boarding party?". Nothing opens by itself, and ignoring the chip just keeps the chat going. The drawer also lists the cast, so the player can start a Parley by hand.

**The card's art is the anchor.** Art the user already has always beats art Gambit draws. For each person on the sheet, `backend/card-faces.ts` looks, in order, at:
1. their own card: its expression group for them, its expression sprites, its imported Risu assets, its avatar;
2. the chat's card(s), for people who live in its lorebook or share a multi-character card: the expression group or Risu assets named after them (`Mira.young.surprised`, `Lark_angry`);
3. a card in the user's library with the same name (Brannoc has his own card);
4. a captioned image in the card's gallery.

`engine/card/faces.ts` maps sprite labels to the six moods. It reads emotion words only, and skips actions and explicit variants. Sprites are shown as drawn, never keyed. Moods with no sprite are drawn from the base face with a NovelAI V4.5 character&style reference. The look's style words are left out so the reference sets the style, and there is no text-only fallback, because an off-model face is worse than the card's own. The V5 inset drew blanks from show-style card art. A rendered mood that comes back blank, or greyscale for a colourful character, is rejected in the browser and the base face stays.

An opaque base, such as a card avatar with its own background, is shown as a **framed portrait** (gilt rule, dark mat, the room softened behind it), and every mood shows inside the same frame. The art key carries the reference image, so a new avatar or sprite set never shows old renders. Characters with no art at all get Gambit portraits.

When Inlay Illustrator is installed, Gambit reads its character library over the shared RPC pool (`inlay_illustrator.characters.<user>.<characterId>`): Inlay has already found who is on a card, tagged their appearance from its vision pass, and chosen their outfit and an on-model reference. Those tags ride in every drawn mood's caption (card art included), and Inlay's reference is the base for anyone who has no art of their own. Without Inlay, nothing changes. The look picker (5.2a) gains a **"match the card"** option that builds a look from the avatar's style.

**Never in the way.**
- Gambit is off until the player turns it on for a chat.
- It never edits the card, its lorebooks, or the persona.
- The Card Sheet can be exported as a lorebook, so the narrator can know Gambit's additions even with Gambit off.
- It stands down on chats where Warp is active (12.1).

**How a contest fits the card.** A contest's *shape* comes from the scene and the sheet: its kind, what is at stake, and the track's unit (crowns, credits, favors, minutes of a guard's patience). Its *size* comes from code tables keyed to the stake and the NPC's stance tier: start, floor, DC, and patience. This is pillar 3 applied to Parley. Encounters work the same way: the card names the enemies and their style, and the budget solver sets the numbers.

**Demo content.** Saltgate (Marta, Pell, Vey) ships as a demo card plus lorebook, not as built-in content, and goes through the same Card Reader. Its hand-written scenarios stay as test fixtures for the engine.

### 4.1 Parley: talking as a mechanic

Parley covers every non-combat contest of words: haggling, persuading, intimidating, deceiving, seducing, interrogating, calming a mob, talking down a boss. It also runs *inside* combat (see 4.2).

#### 4.1.1 Every NPC has a hidden stance

The Architect writes it when the NPC is created; it is stored as data:

```json
{
  "id": "npc_marta",
  "temperament": { "warmth": 0.3, "pride": 0.7, "greed": 0.6, "fear": 0.4 },
  "wants":  ["get out from under the tide guild's fines", "respect for her late husband's trade"],
  "fears":  ["the guild auditor", "being seen as a soft touch"],
  "respects": ["directness", "people who know the trade"],
  "despises": ["flattery", "threats from strangers"],
  "insight": 3,
  "patience": 4,
  "tells": { "irritated": "drums her fingers on the scale", "tempted": "glances at the coin purse" },
  "secrets": [{ "fact": "fact_marta_fenced_stolen_nets", "leverage": 3 }]
}
```

#### 4.1.2 One exchange, step by step

1. **The player types** their line as a normal chat message while Parley is active, or in the Parley box.
2. **Claim extraction** (helper LLM, JSON): factual claims in the text, such as "the guild fined you twice". **Code checks each claim against the fact table.**
   - Claim is true and the player knows it (the fact is in their journal): **Leverage**, worth the fact's leverage value.
   - Claim is false or unknown to the player: a **Bluff**, with a separate Guile vs Insight roll. If caught, the NPC remembers it permanently.
   - Claim is unverifiable flavor: ignored.
3. **The Referee reads the argument** with typed questions in one batch:
   - `tactic` (choice): interest, logic, empathy, flattery, threat, bribe, bluff, humor, insult, nonsense.
   - `fit` (score): how directly it touches this NPC's wants and fears.
   - `credibility` (score): coherent, specific, in character?
   - `temperament_match` (score): does this tactic land with *this* person? A threat works on a coward and backfires on a proud veteran.
4. **Code turns the reading into dice**, deterministically from the expected values:

| Argument tier | Dice |
|---|---|
| Backfires | 3d20 keep lowest |
| Weak | 2d20 keep lowest |
| Plain | 1d20 |
| Good | 2d20 keep highest |
| Compelling | 3d20 keep highest |

   Then add `+ the character's stat` (Presence, Menace, or Guile depending on tactic) `+ Leverage (max +4)` against the **DC**. The DC comes from how big the ask is relative to what the NPC would accept, plus rapport.
5. **Repetition decays.** Code compares the argument with earlier ones in the same Parley (n-gram or embedding overlap), and repeated arguments drop a tier. You cannot win by pasting the same speech.
6. **Outcome tiers move the state track** for the contest (price, suspicion, morale, affection) and spend **patience**:

| Result | Haggle effect | Patience |
|---|---|---|
| Critical success | Meets your ask, or drops straight to the floor | +1 back |
| Success | Closes 50% of the gap | −1 |
| Partial | Closes 25% | −1 |
| Fail | No movement | −1 |
| Critical fail | Price +10%, rapport −1 | −2 |

   At 0 patience the NPC makes a final offer.
7. **The Narrator plays the NPC's reply** with the outcome already decided and injected. The prose has to match the dice.

#### 4.1.3 Information is power

**Leverage can move the floor, not just the roll.** No roll can get a price below what the merchant can afford. Knowing she fences stolen nets changes what she can afford to refuse. Exploration, eavesdropping, and earlier conversations write facts into your journal. Those facts are your real ammunition. This is what turns talking into a game rather than a vibe check.

#### 4.1.4 Showing the read to the player

The read is shown in two modes, a player setting:
- **Immersive:** only tells and qualitative strips, e.g. *"She drums her fingers. The bit about the auditor landed."*
- **Transparent:** tiers, dice, DC, and modifiers, with a "Why?" link to the Referee's short reason.

#### 4.1.5 Anti-cheese

- The player's text reaches the Referee wrapped as *in-world speech to be judged*. The Referee can only return typed answers, so the worst a prompt injection can do is earn "Compelling", and that still needs the dice. Meta text ("ignore your instructions") is classified `nonsense` and backfires mildly: the NPC is confused.
- Big wins need **verified Leverage**, and code verifies it, not the model.
- Dice are seeded by `(encounter id, exchange index)`. Swiping the narration re-narrates the same outcome. Editing your argument re-judges the words but keeps the same die faces, so you can polish your speech but cannot fish for rolls.
- The same Parley engine handles every social contest, with different tracks:

| Contest | Track |
|---|---|
| Haggle | price |
| Persuade | resistance |
| Intimidate | morale |
| Deceive | suspicion |
| Seduce | interest |
| Interrogate | secrets revealed |

### 4.2 Combat

**Format: front-view, turn-based, on a visible timeline.**
- Enemies are large illustrated figures; the party appears as portrait cards along the bottom.
- There are no walk-cycle sprites. Image generation cannot produce consistent animation frames, but it is excellent at single large illustrations. Motion comes from code, mainly **Cue's PNG-puppet warp** (5.6): enemies breathe, sway, lunge, recoil with spring physics when hit, tremble when broken, and dissolve on death. The battlefield is a depth-parallax background.
- **Timeline:** every action has a delay cost, speed shortens delay, and the next 8 turns are always visible. Skills that delay, haste, or swap turns become real tactics, and the player always knows what is coming.

**Resources**
- HP.
- **Focus**, the general skill currency.
- One **class resource** with its own rules, such as Rage builds when you take hits, Blood spends HP, Heat overheats, Tempo builds on alternating actions, Debt borrows power now and pays later.

**Poise and Break.** Hitting a weakness, or using a skill tagged `stagger`, drains poise. At zero the enemy is **Broken**: it loses its next turn and takes extra damage. Weaknesses are found by testing, by a Scan action, or from journal facts, and are remembered in the bestiary.

**Morale and Talk.** Every enemy has morale. Losing HP, losing allies, being broken, and intimidation all lower it. Talk costs a turn and opens a combat Parley. The available options depend on the enemy's morale and nature:

| Option | Result |
|---|---|
| Demand surrender | Ends the fight; you get loot, sometimes info |
| Bargain | They leave for coin or an item |
| Recruit | Some enemies can join you |
| Taunt | Draws their attacks |
| Deceive | Makes them waste a turn or turn on an ally |

Some enemies, like mindless beasts and the like, simply cannot be talked to. The bestiary shows this once you have learned it.

**Death.** Three difficulty modes:
- **Story:** lose, retreat, take a consequence.
- **Standard:** a party wipe sends you to the last rest point, and the world advances without you, so consequences fire.
- **Iron:** permadeath for the protagonist, and the campaign ends with an epilogue written about how you died.

The model never rescues anyone.

### 4.3 The effect language (the heart of everything)

Every skill, passive, item effect, status, and enemy ability is a composition of **atoms** from one library written in code. The library starts with about 70 atoms:

| Family | Examples |
|---|---|
| Damage | `hit(element, scale, power)`, `multi_hit(n)`, `pierce`, `true_damage`, `execute(below%)` |
| Defense | `shield`, `block_next`, `counter`, `reflect`, `evade_up` |
| Status | `bleed`, `burn`, `poison`, `frost`, `stun`, `fear`, `charm`, `mark`, `vulnerable`, `silence`, `taunt` |
| Timeline | `delay(target, n)`, `haste`, `swap_turns`, `act_again` |
| Resource | `gain(resource)`, `spend_all_for_scaling`, `drain` |
| Field | `terrain(type, turns)`, `weather`, `aura` |
| Summon/transform | `summon(template)`, `stance(form)`, `transform(turns)` |
| Triggers | `on_hit`, `on_kill`, `on_crit`, `on_break`, `turn_start`, `when_below(hp%)`, `when_ally_falls` |
| Targeting | `single`, `row`, `all`, `random(n)`, `self`, `lowest_hp_ally`, `marked` |
| Costs | `focus(n)`, `hp(%)`, `delay_self`, `cooldown`, `stacks` |

A skill as stored:

```json
{
  "id": "skill_undertow_litany",
  "name": "Undertow Litany",
  "flavor": "She sings the tide backwards, and it remembers who it took.",
  "target": "all_enemies",
  "atoms": [
    { "op": "hit", "element": "water", "scale": "spirit", "weight": 0.6 },
    { "op": "delay", "n": "auto", "weight": 0.3 },
    { "op": "on_break", "then": [{ "op": "gain", "resource": "tempo", "n": "auto" }], "weight": 0.1 }
  ],
  "cost": { "focus": "auto", "cooldown": 3 },
  "tier": 3,
  "visual": { "cutin": "diagonal_band", "fx": ["ink_wash", "water_burst", "glyph_ring"], "palette": "#1d3b4a,#7fd1c7,#f2efe6" }
}
```

**The model writes `weight`s and `"auto"`; code fills in the magnitudes.** The budget solver works like this:
1. Every atom has a point cost per unit of magnitude, with multipliers: AoE ×1.6, conditional trigger ×0.6, self-only ×0.8, and so on.
2. A skill's budget is `tier budget + paid costs`, where Focus, HP, cooldown, and self-delay all buy budget back.
3. The solver splits the budget across atoms by weight and rounds to clean numbers.
4. **Simulation check:** the skill joins a reference kit and runs about 2,000 headless fights against 5 benchmark encounters. If win rate or damage per turn lands outside the tier band (±15%), magnitudes are scaled and the sim runs again. This is deterministic, fast, and takes no model calls. Warp Studio and Worldgen already have the auto-player and balance-script pattern for this.
5. Signature or ultimate skills get +20% budget, and in exchange a hard cooldown or a once-per-fight limit.

Enemies are built from the same language, so a faction that adapts to you (see 4.6) can borrow *your* effect families against you.

### 4.4 Classes, fusion, and the Class Forge

**A class is:** growth curves (stats per level), one class resource, one passive, a skill tree of 8 to 10 skills (unlocked by class rank), weapon affinities, and a **visual brief** (silhouette, palette, motifs, outfit).

**Starting kits come from the card.** The persona and each companion get a kit built from what the card and lorebook say they can do. The Architect maps that onto atoms, and the budget solver and sim size it, the same path as the Class Forge below. About 8 base classes are still hand-tuned in data (Duelist, Warden, Tidecaller, Hexwright, Scout, Brute, Chorister, Alchemist). They are a tested **fallback** used when a description is too thin to build from, and the genre skin renames them to fit the card. They are not a fixed menu every card must use.

**Fusion.** At the Altar, with two classes at rank 3+ and a catalyst item:
- *Code:* growth curves are a weighted blend plus one mutation, rolled seeded.
- *Code:* the resource comes from a **hybrid table**, such as Rage + Blood → Frenzy, or Tempo + Heat → Overdrive. Pairs without an entry inherit one parent's resource with a twist atom.
- *Architect:* name, identity, a passive synergy, and 3 new skills built **only from the union of the parents' atom families**, so fusions feel related to their parents. It keeps 2 skills from each parent.
- *Code:* the budget solver and sim run on the new skills.
- *Illustrator:* fusion portrait, made as a GPT Image edit with both parent portraits as references, plus a cut-in pose per new signature skill.
- The player sees the **full sheet with real numbers** before confirming. Declining refunds the catalyst. You can reroll the fusion once by spending a second catalyst.

**Class Forge.** Rarer and later in the game, at a shrine, with a Blank Crest: the player *describes* a class in their own words.
> "A war-chef. Fights with cleavers, feeds the party between turns, and gets stronger the more varied the meal."

The Architect compiles that into the class schema: resource *Flavor* (gains stacks per distinct food buff), passive, skills, and visual brief. The same validator, budget solver, and sim apply. A request that cannot be built from atoms ("instantly win") gets mapped to the nearest legal thing, and the preview says what was changed.

**The Codex.** A meta collection saved across campaigns (global extension storage), holding every class and fusion you have made, with portraits. Fusing becomes a collection game, and good fusions can start a new campaign.

**Skill awakening.** A skill used 50+ times can awaken. The Architect proposes 3 mutations built from atoms, you pick 1, and it gets a new cut-in variant.

### 4.5 The world: the card's places, compiled just ahead of time

**Structure: the card is the spine, generation fills the gaps.**
- The **Card Sheet** (4.0) is the spine: premise, tone, cast, factions, and places, all quoted from the card and its lorebooks. At campaign start the Architect extends it into a **World Bible** only where the card is silent. It adds a central thread (a goal or mystery with 4 to 6 revelations) only if the card doesn't already give one, and lays the places out in the **shape** the reader picked. This compiles *while the player reviews their sheet and picks a look* (5.2), so the latency is hidden in onboarding.
- **Places.** In every shape except a single scene, places form a graph. Each place has one background painting and 3 to 6 **hotspots**: people, shops, exits, investigations, and hazards. The graph stays under the hood: the player moves through **menus and first-person views, not a map** (6.1). A journey is a line of stops; a frontier is a hub plus regions.
- **Delves** (when that module is on) are room graphs with fog of war. Rooms hold encounters, events, traps, treasure, rest points, and a boss. Worldgen's **map contract** applies: code checks reachability, key-before-lock, and boss reachability, then rebuilds up to N times on failure. A delve only appears where the card has somewhere to explore: the ruin in its lorebook, the derelict ship, the haunted house.
- **New places come from play.** When the chat goes somewhere the sheet doesn't have, the place is added to the graph (a P0 or P1 job), quoted from the chat that introduced it.

**JAOT (just-ahead-of-time) compiler.** A priority queue of compile jobs:

| Priority | When | Examples |
|---|---|---|
| P0 | Needed now; blocks, showing a styled "the fog lifts…" card | The location you just entered for the first time with nothing prepared, which should be rare |
| P1 | Next likely | Adjacent locations, the next dungeon floor, the NPC you are walking toward, the current dungeon's boss |
| P2 | Speculative | Two hops away, likely quest targets |
| P3 | Downtime | Night-phase consequences, Notice promotions, codex art |

**Rest is the big compile window.** Resting at an inn or camp plays a **"Meanwhile…"** montage: 3 to 5 short narrated vignettes of what the world did while you slept. That covers the work while the Architect compiles consequences and the Illustrator catches up.

**Everything is frozen into a ledger** (Worldgen's pattern). Every model answer is stored by question hash, so reloading or replaying rebuilds the same world with zero model calls. Every model output passes a **schema and contract validator**. On failure it retries once, then falls back to code: name tables, templated quests, base monsters. Junk JSON can never break the world.

### 4.6 Memory and consequence

**The Deed Ledger.** Code records facts about what you do as tagged events: `killed(faction:ash_guard, n=7, method:fire)`, `lied_to(npc_marta)`, `spared(boss_acolyte)`, `burned(location:saltreach_docks)`.

**Scars.** In the night phase the Architect reads the ledger diff and proposes **world deltas** inside code limits:
- **Places change.** A location's state flag flips, e.g. `burned`, and its background is redrawn as a **GPT Image edit of the original painting**: the same docks, scorched. You recognize the place you hurt.
- **Factions adapt.** Code computes your **build profile**: damage element mix, favorite statuses, and whether you talk or fight. A faction you keep hurting gains countermeasures picked from the atom library, such as fire resistance, or `cleanse` on bleed. It is limited to a budget, and **always foreshadowed by rumors** ("The Ash Guard have started carrying salt-iron."), so it feels fair rather than spiteful.
- **NPCs remember.** Lies, kindnesses, and threats go into the NPC's memory, change their stance, and get injected into the Narrator's context whenever that NPC is present.

**Notice: the world notices what you notice.** Every entity has an **interest score**. Mentions in your messages, inspecting it, repeat visits, gifts, and time spent all raise it. When the score passes a threshold, a P3 job **promotes** the entity:
- a full dossier and stance,
- a canonical portrait,
- a hidden questline of 2 to 4 steps,
- a small sub-location or sub-dungeon,
- and a unique item tied to them.

The nameless guard you kept bribing turns out to have a story. Code guards a cap of 3 active promotions, so the world never sprawls faster than you can follow.

**Companions.** The card's own characters are the first companions: in a single-character card, that character; in a group chat, the members. Their portraits come from their card art. Recruited NPCs and monsters join the party with a class (base, fused, or forged), a portrait set, and a personality. They talk in chat through the Narrator, using their dossier as context. Affinity is a Parley-adjacent track that changes with your choices, and at high affinity it unlocks combo skills and their personal quest.

### 4.7 Economy and loot

- **Prices** come from a code formula: `base value × regional supply × faction standing × rapport modifier`. Each merchant has a hidden floor derived from cost and need, and Parley works between the list price and the floor.
- **Loot** comes from code tables by tier. Affixes are atoms with small budgets. Named or legendary items get Architect flavor, a unique atom combination, and a generated icon.
- **Trade beyond coin.** In Parley you can offer favors, information (facts from your journal), or items. The Referee scores their *value to this NPC* from its wants, and code converts that into currency-equivalent movement on the price track.

---

## 5. Art direction and asset pipeline

### 5.1 The look

The default is **painted dark-fantasy illustration**: semi-realistic proportions, muted palette with one accent color per region, strong rim light, visible brushwork. Think premium card-game art rather than chibi sprites.

**Every campaign picks its look** from 4 generated candidates at the start (see 5.2), from presets:
- Painted Dark Fantasy (default)
- Ink & Wash
- Modern Anime Illustration (NAI v5's strength)
- Grim Realism (GPT Image's strength)

All UI is drawn in code, not generated:
- frames, bars, rarity borders, damage numbers, typography,
- cut-in bands, speed lines, particles, shaders.

That code layer is what makes it feel like a finished game and keeps it consistent no matter what the image models return.

### 5.2 Style lock: choose your world's look

Onboarding step 2, while the World Bible compiles:
1. The Illustrator renders the **same test subject** (the card's main place, plus a bust of the card's main character made from its avatar) in 4 looks. One of them is "match the card" (4.0).
2. The player picks one. It becomes the **style anchor**: a prompt fragment per provider, a negative prompt, and the 2 anchor images.
3. From then on every GPT Image request includes an anchor image as a style reference, and every NAI request carries the locked style tags. One look for the whole campaign.

**Status (0.1):** the four presets above ship. Painted Dark Fantasy is the default and the first lock. The lock is optional: with none, art uses the default.

### 5.2a Looks are data: presets, your own, and AI-made (planned)

The lock above is the 0.1 shape, not the goal. The goal is the same idea as Cue's theme presets: **a shelf of looks people can use, share, or make their own.** A look is already a small data object in code (`src/art/looks.ts`: label, preferred provider per art kind, NAI tags and negative, GPT style and avoid text). It becomes a file format.

**The look file** (`gambit-look.json`, versioned):
- `id`, `label`, `author`, `description`;
- `preferred` provider, plus a `prefer` map per art kind;
- `nai`: `positive` and `negative` tags;
- `gpt`: `style` and `avoid` sentences (no negative-prompt field on GPT Image, so "avoid" goes into the prompt);
- optional `anchors`: up to two reference images (the gate and the bust), as image ids after import;
- optional `ui`: palette tokens for the code-drawn layer (ink, panel, gold, ally, enemy, accent). The frames, bars and cut-in bands follow them, so an anime look can get brighter chrome than a grim one. Omitted tokens keep the defaults.

**Where looks come from:**
1. **Built-in presets**, the four above, with more added over time. Each is a look file in the bundle.
2. **Your own:** import or export a look file in the drawer, or duplicate a preset and edit its fields there. Saved per user, shown beside the presets.
3. **Inlay's art styles:** Inlay already shares each user's styles over Lumiverse's RPC pool (`inlay_illustrator.artists.<user>`), and Cue reads them for its image prompts. Gambit reads the same list and offers each one as a look: NAI tags as-is, with GPT text written from them.
4. **AI-made looks:** a skill (`gambit-look`, the same shape as the `lumiverse-lorebook` skill) takes a description ("ukiyo-e woodblock with gold leaf", "90s OVA cel, film grain") or reference images. It writes a look file that passes `scripts/validate-look.ts` (schema, tag and sentence checks, no text-in-image terms missing). An in-app version does the same through the strong model (`generation` permission): describe a look in the drawer, get the file, and draw its gate and bust to judge it.

**Switching instead of locking.** A campaign has a current look, not a permanent one:
- art is keyed by look (`<look>/<art key>`), so changing looks keeps the old art and redraws lazily at the normal priorities;
- a character's DNA (5.5) is look-independent, so they stay recognisable across looks;
- the probe (gate and bust) runs for any look on demand, so you can preview a look before switching.

### 5.3 Who draws what

| Asset | Primary | Why | Consistency method |
|---|---|---|---|
| Canonical character portrait (player, companions, promoted NPCs) | NAI v5 for anime looks, GPT Image for painted or real looks | Best first impression | Stored "visual DNA" (locked tags plus description), fixed seed |
| Expressions (6 per character), poses, cut-in poses | **NAI V5 "reference inset"** (Cue's technique): an inpainting request on a split canvas, with the canonical render kept on the left half and the new expression or pose painted on the right | V5 has no character reference, but inpainting next to the original copies identity *and* style. Already built and calibrated in Cue | Inset (inpainting) |
| Same, second route | **GPT Image edits** with the canonical portrait as reference, `input_fidelity: high`, transparent background | For painted or real looks, or when the inset drifts | Reference image |
| Same, third route | NAI v4.5 with precise reference | Last fallback for anime looks | Director reference |
| Monsters and bosses | NAI v5, transparent background (native alpha on V5) | Large, detailed, striking single images | One image per monster |
| Boss phase 2 or corrupted variants | GPT Image edit of phase 1 | Recognizably the same creature, transformed | Reference image |
| Location backgrounds | NAI v5 or GPT, wide format | One per location, reused | Style anchor |
| Scarred or changed locations | **GPT Image edit of the original background** | You recognize the place you changed | Reference image |
| Fusion portraits | GPT Image edit with both parents as references | Blends the two outfits and motifs | Multiple references |
| Item and skill icons | GPT Image **4×4 grid sheets** with the style anchor; code slices them | 16 icons per call, consistent in one sheet | Shared sheet plus anchor |
| Icon placeholders | A curated ~300-icon subset of game-icons.net SVGs (CC BY 3.0, credited), inlined in the bundle and tinted in code | Instant; never wait for an icon | — |

Notes:
- **Expression sheets in one pass.** As an alternative to 6 edits, V5's full-page composition can render one 2×3 expression sheet of the same character, and code slices it. Identity is consistent inside one sheet, so it is cheaper and often more consistent. Both methods should be tried in the art spike (milestone 1).
- **Typography is always code.** Skill names, damage numbers, and cut-in text are rendered in code, never baked into images.
- **Avy's RPG Maker icon packs** were considered. Their style is low-resolution RTP-era and does not match the look, and their terms forbid reposting, so they are left out. Generated icons, with game-icons.net as the instant fallback, cover the need.

### 5.4 Cut-ins

A cut-in is **one generated pose image + a code-rendered template**, made once when a skill is created and replayed forever.

- **Templates** (PixiJS, data-driven):
  - *Diagonal band:* a portrait sweeps across a slanted strip.
  - *Eye strip:* a narrow horizontal crop of the eyes.
  - *Full splash.*
  - *Triple panel:* for combos.
  - *Shatter:* the screen breaks into shards.
- **FX layer library** (about 30, parametric):
  - ink wash, water burst, embers, lightning fork, glyph ring, petal storm,
  - shard rain, smoke curl, blood mist, holy rays,
  - speed lines, chromatic split, impact frame, vignette flash.
- **The Architect picks** template + 2 to 4 FX layers + palette + timing curve + name-slam style, all as data.
- **The Illustrator makes** the pose: the character, transparent, in a dynamic action pose fitting the skill.
- **Code renders** the result at 60 fps.
  - Length is 1.2 to 1.8 s, and tapping skips it.
  - It plays on first use, ultimates, crits, and finishing blows. Otherwise it is a short flash, to avoid fatigue.
- **Before the pose image exists,** the cut-in renders with the canonical portrait. The game never waits.

### 5.6 Making still art move (reuse Cue's puppet stack)

Cue's `testing` branch (235 commits ahead of `main`; see `docs/SPRITE_MODE.md` there) already solves "a static generated image that feels alive". Most of it is **pure, tested modules**, which makes them easy to share:

| Cue module | What it does | Gambit use |
|---|---|---|
| `sprite-puppet-rig.ts` (pure, ~700 lines) | Builds a rig from the cut-out's bounding box and face box: neck pivot, chest band, feet anchor. `puppetMeshPositions()` turns a pose into a 24×36 vertex grid | Feeds a **PixiJS `MeshPlane`** directly, so enemies, party busts, and Parley NPCs breathe, sway, and turn their heads |
| `sprite-puppet-acting.ts` (pure) | Moods (posture, shoulders, breath rate, tremble…), timed gestures (`startle`, `jolt`, `flinch`, `slump`, `lean_in`, `step_back`, `shake`…), and a "voice" that moves the head with typed text | **Parley:** the NPC's body language comes from the read. Irritated is tense and trembling; tempted leans in; a caught lie triggers `startle`, then `step_back`. Their head follows their streamed line. **Combat:** attacks are `lean_in` plus a lunge, hits are `flinch`/`jolt`, broken is `slump` plus `tremble`, charging up is a deep, fast breath |
| `sprite-puppet-physics.ts` (pure) | Damped springs for hair and loose cloth, with squash and stretch on landings | Impacts call `springKick` from the attack direction, so hair and robes whip on every hit; ultimates hit harder |
| `sprite-puppet-fx.ts` (pure) | Expression transitions (soft, pop, melt, flare, blush), arrival focus pulls, weather and light on characters | Boss phase changes use `flare`; death uses `melt`; region weather carries into battle |
| `sprite-puppet-quality.ts` (pure) | Adaptive render scale from frame times | Keeps phones smooth when a 5-enemy fight is on screen |
| `plate-parallax.ts`, `plate-depth-*` | Depth Anything V2 (27 MB ONNX, in a worker) turns a flat background into a 2.5D room the camera can drift through; depth maps are cached per image | **Every location and battlefield** gets subtle parallax. Enemies stand on the floor depth. This adds a lot of "real game" feel for little effort |
| Cut-out pipeline (ISNet-anime + defringe), face detector (YOLOv8n) | Turns any render into a clean transparent figure with a face box. Transparent sources skip the model | V5 and GPT renders already arrive transparent, so only the **face box** is needed for the rig. The cut-out is the fallback for opaque renders |
| `sprite-outline.ts` | Bakes a sticker outline once per image | Optional crisp rim on enemies against busy backgrounds |

**Rig variants Gambit needs to add.** Cue's rig assumes a standing figure with feet planted. Battles also have:
- **floating** (wraiths, eyes): no foot anchor; the whole body bobs and the hem trails,
- **serpentine or blob**: a travelling sine wave through the mesh, with no neck pivot,
- **huge**: bosses that overflow the frame; the anchor sits below the screen and the breathing is slow and heavy.

The Architect tags each monster with its rig type when designing it.

**How to reuse the code.** Extensions are separate bundles, so Gambit cannot import Cue at runtime. **Copy** the pure modules (rig, acting, physics, fx, quality, depth kernel) into `gambit/src/vendor/cue-puppet/` with their tests and a header naming the source commit, the way Cue already vendors Inlay's prompt compiler. Cue keeps its DOM/WebGL renderer, and Gambit writes a thin Pixi renderer around `puppetMeshPositions()`. Pull upstream fixes by hand when Cue improves them.

### 5.7 The queue

- **Speculative work on V5 Medium.** P2/P3 jobs use NAI V5 Medium (`effort: "medium"`, 14 steps, as Inlay `stable` already sends it), and P0/P1 hero art uses V5 Full.
- **Two lanes**, because the providers have different limits:
  - **NAI lane: concurrency 1.** NovelAI rejects concurrent generations ("Concurrent generation is locked"), so this lane needs backoff. Inlay Illustrator's queue already handles this.
  - **GPT lane: concurrency 2 to 3,** configurable.
- **Job priorities** follow 4.5 (P0 to P3). A job can **upgrade** when the player heads toward its asset.
- **Content-hash cache:** `hash(provider, model, prompt, refs, seed, size)` maps to a Lumiverse image id, so nothing is generated twice.
- **Placeholders everywhere:**
  - silhouettes with palette gradients for characters and monsters,
  - blurred palette washes for locations,
  - SVG icons for items.
  - Art fades in when ready.
- **Budget meter in settings:** images per hour, a per-campaign cap, and a "low art" mode that only draws P0/P1.

---

## 6. Presentation inside Lumiverse

> Section 8 lists the exact Spindle surfaces and limits this relies on.

- **Chat stays the story.** The normal chat is where narration happens, and the player can always just roleplay. Gambit injects the state and decided outcomes into the Narrator's context through an interceptor (Warp's pattern).
- **The Stage** is a full-screen game layer: an app mount, or a viewport-sized chromeless float widget as the fallback. Warp's stage and Cue's overlay prove this works. It opens for **Scenes** (6.1), **Combat**, **Parley**, the **Altar**, and **Inventory/Sheet**, and closes back to chat. The chat log stays one tap away as a side or bottom sheet. Battle aftermath and Parley outcomes post into chat as narrated messages.
- **Scene view** replaces a map: the place's painting (flat or in 3D, 6.2), the people in it, and a **menu** of what you can do there, with a slim HUD (party HP, time of day, coin). See 6.1.
- **Mobile first-class.** The battle layout is designed for portrait orientation: enemy art on top, a timeline strip, then the party cards and action dial. Desktop gets a wider layout with the chat docked.
- **Drawer tab** for the Journal (facts, quests, bestiary, codex) and settings.
- **Audio:** hit, UI, and cut-in sounds are synthesized in WebAudio (sfxr-style recipes stored as data), with a few tiny clips inlined. Extensions cannot serve bundled files yet (8.1). Ambient loops and host TTS voices come later.

### 6.1 Scenes and movement: menus, not a map

Decided 2026-11-06 from references the user shared (shop and street scenes with a dialogue box, a portrait lobby ringed by menu tiles, first-person card tables, first-person grid dungeons with command menus, and 1-bit dithered dungeons and battles). Gambit borrows their **mechanics and framing**, not their characters or art.

**Every place is a scene.** A scene is a painting, the people in it as standing portraits, a dialogue box, and a menu:
- **Talk to…** one entry per person present (opens Parley, or just drops a line into chat),
- **Look around / Search** (an investigation with a check),
- **Go to…** one entry per exit,
- **Rest, Shop, Wait** when the place allows them.

Choosing an item can also drop a suggested action into the chat input instead, so the roleplay and the menu never fight. The menu is the one control that works everywhere, on desktop and phone, so **everything is reachable from a menu** whatever movement mode is on.

**Movement modes, per shape** (the player can switch to plain menus at any time):

| Shape | Default movement | Feel |
|---|---|---|
| Single scene | none, just the scene menu | a visual novel |
| Town | a **lobby**: the companion's portrait in the middle, places as tiles around it | a home screen you return to |
| Journey | **next stop** menu with a progress strip, plus events on the road | a road trip |
| Frontier | a **honeycomb** (hex) overland: step one cell per turn, spending time and supplies; cells reveal as you go | expedition |
| Delve | **first-person grid**: step forward, turn left or right, with a command menu beside the view (Advance, Turn, Search, Light a torch, Use) and an automap that fills in as you walk | dungeon crawl |

The command menu in a delve is also the input on phones: no swipe gestures to learn.

**Contests in scenes.** Parley and combat open on top of the scene they start in, so the room stays visible. In the **table** theme (6.3), Parley is framed as a first-person game across a table: the NPC sits opposite, and the player's hand holds **fact cards** from the journal. Playing a fact card cites that fact as Leverage, and code still checks that the player knows it. The player still types what they say, and the Referee still reads it.

### 6.2 The 3D scene layer: 3D rooms built from 2D art

Generated art stays the content. 3D is how it is staged, so a scene feels like a place you are standing in rather than a picture behind a menu. A **three.js** layer renders the environment; Pixi (puppets, cut-ins, FX) and the DOM menus draw on top.

Ways to turn images into 3D, from cheapest to richest:
1. **Depth backdrop.** One painting plus its depth map (Depth Anything V2, already used for Cue's parallax, 5.6) becomes a displaced mesh. The camera can drift, dolly in when you talk, and shake on hits. Every scene gets this for free.
2. **Billboards.** Characters, monsters, and props are transparent cut-outs standing in the 3D space at the right depth, always facing the camera. They light and fog with the scene, and Cue's puppet warp still animates them.
3. **Diorama rooms.** A shop or tavern is a simple box room (floor, walls, counter) with tileable textures, and prop cut-outs set on the counter and shelves. The shopkeeper stands behind the counter. Props can be tapped as menu items.
4. **Grid corridors.** A delve is built from a few generated tileable textures per area (wall, floor, ceiling, door, stairs). The corridor geometry comes from the room graph, so every step is a real 3D move. Monsters are billboards at the end of the hall.
5. **Panoramas** (later). A wide painting wrapped on a cylinder, so you can turn your head in a key location.

**Post-process is part of the look.** A screen shader (dither, halftone, paper grain, CRT, ink) is applied over the whole 3D scene. The 1-bit dither theme is especially useful: it pulls generated art from different providers into one consistent style and hides small mistakes.

**Cost and fallback.** three.js adds roughly 0.6 MB to the single frontend bundle (8.1), loaded only when a scene first opens. With no WebGL, or in "low" mode, every scene falls back to the flat painting with the same menu.

### 6.3 Stage themes

A **stage theme** is the frame around the art: the dialogue box, menu style, font, HUD, post-process shader, and default movement modes. It is separate from the **look** (5.2a), which is how the art itself is drawn, though a theme can suggest a look. Themes ship as data like looks, and a card can suggest one. Planned set:

| Theme | Frame | Pairs well with |
|---|---|---|
| **Storybook** (default) | painted backdrop, standing portraits, nameplate dialogue box | most cards, single scenes |
| **Diorama** | 3D rooms with props and a counter, warm light | shops, taverns, slice of life |
| **Lobby** | big portrait in the middle, menu tiles around it | towns, companion-focused cards |
| **Table** | first-person table, the opponent across from you, cards in hand, candlelight | Parley-heavy cards, gambling, horror |
| **1-bit** | dithered black and white, terminal text, prompts like "Enter the dungeon?" | delves, horror, retro cards |
| **Command** | first-person view with a text command list and party roster | classic dungeon crawls |

---

## 7. State, swipes, and saves

Gambit uses **Warp's event-sourced model**:
- State is never stored directly. It is a **fold of event records** attached to messages, stored per swipe: `metadata.gambit.swipes[i]`.
- Swiping a narration re-narrates the same decided outcome. Branching or deleting messages rewinds state for free.
- **Stage sessions** (a combat, a Parley) are run in the panel and committed as one event batch on the message that closes them. Re-narrating that message never re-runs the battle.
- **Seeded RNG:** `seed = hash(campaign seed, event id)`, so replay is exact.
- **Big data lives in extension storage, not message metadata:** World Bible, ledger of model answers, NPC dossiers, the asset index, and the codex. Messages carry only small events and references.

---

## 8. Lumiverse constraints and what Gambit needs

Surveyed against `D:\Lumiverse` at `8e0f3945`, using the Spindle types at v0.6.79. Short version: **nothing blocks the design**, but several limits decide *how* each part has to be built.

### 8.1 Hard constraints and how Gambit routes around them

| Constraint | Source | What Gambit does |
|---|---|---|
| The backend cannot `fetch`; the install scanner rejects it | `src/spindle/worker-runtime-sandbox.ts:159`, `manager.service.ts:86` | All models go through **host APIs**: `generate.*`, `decisions.*`, `imageGen.*`. No direct provider calls |
| `spindle.cors()` cannot return NovelAI's ZIP or msgpack | `worker-host.ts:4655` | NAI goes only through `spindle.imageGen` using the user's saved NovelAI connection |
| GPT Image 2.6 through the CLI proxy | `src/image-gen/providers/openai.ts` supports `/images/edits` with `image[]`, `background: transparent`, `input_fidelity`, and a custom base URL | The user adds an **OpenAI image connection whose base URL points at the proxy** and whose model id is whatever the proxy exposes. Gambit passes `resolvedSourceImages` itself, because `imageGen.generate` does not gather references for you. The proxy's `/images/edits` support must be checked in M1, with NAI 4.5 precise reference as the fallback |
| NAI V5 skips reference images | `novelai.ts:211` | Identity consistency comes from **Cue's V5 reference inset** (split-canvas inpainting on `nai-diffusion-5-*-inpainting`), then GPT edits, then NAI 4.5 (see 5.3). The frontend composes the inset canvas because the backend has no canvas, as Cue already does |
| img2img and inpaint on NAI are only reachable through `rawRequestOverride` (unverified) | `src/image-gen/types.ts:45` | Not relied on. Spiked in M1 as a bonus path |
| **No URL route for files bundled with an extension** | `src/routes/spindle.routes.ts` | Nothing ships as a static file. FX are **procedural** (shaders and particles drawn in code). SFX are **synthesized** in WebAudio, plus a few tiny clips inlined as base64. The game-icons.net subset (~300 SVGs) is inlined as path strings. Generated art lives in the **image store** and loads by URL |
| The frontend loads as one blob-imported bundle into the main document, in 15 s | `frontend/src/lib/spindle/loader.ts:439, 937` | One self-contained bundle, no code-split chunks. PixiJS fits. Heavy work is lazy, after load |
| No CSS isolation for host-DOM UI | `ui-placement.md` | All Gambit UI renders inside **one Shadow DOM root**, so host CSS and Gambit CSS never collide. Pixi draws to its own canvas |
| WebSocket payload is capped at 4 MB | `src/ws/transport.ts:11` | Backend→frontend messages carry **image ids and URLs**, never image data. Image results come from `/api/v1/image-gen/results/{id}`, and uploads use `/api/v1/images/{id}` |
| Hiding a message does not remove it from the prompt | `chat-mutation.md:267` | Mechanical messages (battle reports, raw dice logs) are **filtered by Gambit's interceptor** before the Narrator sees them, and replaced with a compact digest |
| Interceptors time out after 10 s by default; the max is 300 s | `interceptors.md`, manifest `interceptorTimeoutMs` | Set `interceptorTimeoutMs: 30000`. The Referee normally runs **before** sending (see 8.3), so the interceptor only injects outcomes already decided and finishes fast |
| Decisions calls are capped at 30 s, 256 questions, and 1 MiB | `decisions.md` | The Referee batches all of an exchange's questions into one call. If a call fails, a helper LLM imitates the typed answers, then the rules-only fallback runs |
| Chat metadata writes can race with other extensions | Warp's `UX_REVIEW_FIXES.md` | Gambit uses `compareAndSetMetadata` (CAS) for its namespace, and keeps big data in `userStorage` |
| A full-screen layer needs the `app_manipulation` permission (admin approval) | `ui-placement.md:544` | The Stage uses an **app mount** when approved. Otherwise it falls back to a **chromeless float widget sized to the viewport**, the way Worldgen already works |
| Live Activities are iOS-only and limited to 3 fixed layouts | `live-activities.md` | Optional nicety only, e.g. "Your next region is ready" after a long compile. Not a game surface |
| No slash commands, only palette entries | `commands.md` | Palette entries: "Gambit: Open Stage", "Gambit: Journal", "Gambit: Rest". Input-bar actions provide one-tap access |

### 8.2 Permissions Gambit will request

| Permission | Used for |
|---|---|
| `generation` | Architect and helper calls; triggering narration |
| `decisions` | The Referee (Jev / TypeSafe through the host) |
| `interceptor` | State and outcome injection; hiding mechanical messages from the prompt |
| `image_gen`, `images` | The Illustrator, the asset store, and uploading sliced icon sheets |
| `chats`, `chat_mutation` | Posting narrated outcomes, per-swipe event records, CAS metadata |
| `characters` | **Required:** read the selected card (text, avatar, gallery, attached lorebook ids) for the Card Reader (4.0) |
| `personas` | **Required:** read the active persona for the player sheet |
| `ui_panels` | The float widget and dock panel |
| `app_manipulation` | Optional: the full-screen Stage |
| `world_books` | **Required:** read the card's, persona's, global, and active lorebook entries for the Card Reader; optional export of the Card Sheet as a lorebook |
| `tools` | Optional, see 8.4 |
| `push_notification` | Optional |

Storage and drawer tabs are free.

### 8.3 How a Parley turn flows through Lumiverse

1. The player types in the Parley box on the Stage, or in the normal composer while Parley is active.
2. The frontend sends the text to the backend over messaging. The backend runs claim extraction (`generate.quiet`, JSON) and the Referee (`decisions`) **in parallel**, then rolls seeded dice and writes the exchange event.
3. The frontend plays the read strip and dice animation (about 1.5 s, which hides the Referee's latency) with the decided result.
4. The frontend sends the player's line as a chat message (`composer.send`, or `chat.appendMessage` with `triggerGeneration`).
5. Gambit's interceptor sees that message's stored exchange event and injects: *"OUTCOME (already decided, narrate faithfully): Marta lowers her price to 85; she is irritated by the reminder."* plus Marta's stance and tells.
6. The Narrator writes her reply. A swipe re-narrates the same event.

When the player types in plain chat without opening Parley, a context handler (up to 120 s) can run steps 2 and 5 inline. The dice chip then appears under the reply instead of before it.

### 8.4 Optional: the Narrator asks for checks

A tool registered with `inline_available: true` enters normal generations when the preset allows function calling (`src/services/generate.service.ts:2540`). Gambit can expose `request_check(kind, target, reason)` and `start_encounter(enemy_ids)`. The Narrator may *ask* for a roll or a fight, and code rolls. This is off by default, since Warp's interceptor-only pattern is more predictable across providers, but it is a nice option for models that handle tools well.

### 8.5 Asks to the host (nice to have, not blockers)

Since you maintain a Lumiverse fork, these would each simplify Gambit:
1. **A static asset route for extensions**, e.g. `/api/v1/spindle/{id}/assets/*` serving files from the repo's `assets/` folder. This would let Gambit ship real SFX, music, and FX textures instead of inlining or synthesizing them.
2. **First-class NAI V5 img2img and inpaint parameters** in `imageGen` (source image, strength, mask), instead of `rawRequestOverride`.
3. **Reference gathering on `imageGen.generate`**, so an extension can pass image ids instead of base64 references.
4. **Multimodal embeddings.** `spindle.embeddings.embed` takes text only today. Accepting image ids (and PDF pages) for multimodal models would let Gambit:
   - **reuse art before drawing new art:** search the asset index for "the docks at night" or "Ilse, angry" and skip a generation when a close match exists;
   - **check identity:** compare a new expression or pose against the card's avatar, and redraw when it drifts too far (a cheap check next to Cue's face fingerprinting);
   - **match the card's look:** pick the look preset closest to the avatar's style for "match the card" (5.2a);
   - **pick from the gallery:** choose the card gallery image nearest to the needed mood or pose as the reference;
   - **read setting PDFs:** a rulebook or setting guide the player attaches (for example in a character databank) becomes a Card Reader source, retrieved by chunk instead of pasted whole.

   None of this blocks anything. Without it Gambit uses text embeddings of the art prompts, and the Card Reader reads lorebooks and databank text only.

---

## 9. Failure modes and how the design survives them

| Failure | Defense |
|---|---|
| The model wants to say yes to everything | It never decides; it only returns probabilities and designs, and code rolls |
| Prompt injection in Parley | Typed answers only, capped tiers, Leverage verified in code, dice seeded |
| Generated skills break balance | Budget solver plus headless simulation, and the player previews numbers |
| Generated content is junk or invalid | Schema and contract validators, one retry, then code fallbacks |
| Art is slow | JAOT queue, rest-time compile windows, placeholders everywhere |
| Art is inconsistent | Style anchor, visual DNA, reference-image edits, code-rendered UI |
| The world sprawls faster than the player can follow | Promotion caps, consequence budgets, foreshadowing |
| Swipe or edit abuse | Per-swipe events, seeded dice per exchange |
| No Jev or no image provider | Helper LLM imitates typed answers; rules-only fallback; placeholder-only art mode |
| Costs run away | Budget meter, "low art" mode, ledger cache (no repeat calls) |

---

## 10. Architecture

```
gambit/
  src/
    engine/            pure, deterministic, fully tested, no host imports
      dice.ts            seeded RNG and notation (from Warp)
      ledger.ts          event fold, per-swipe records (from Warp)
      atoms/             effect library, interpreter, budget costs
      budget.ts          magnitude solver
      combat/            timeline, actions, poise, morale, AI policies
      parley/            stance, tracks, tiers, claim verification
      classes/           growth, resources, hybrid table, fusion
      world/             bible, regions, dungeons, map contract
      economy/           prices, loot tables
      consequence/       deed ledger, build profile, adaptation rules
      sim/               headless auto-battler for balance checks
    meaning/           every model question lives here
      referee.ts         typed decision questions (Jev, or helper imitation)
      architect.ts       JSON compile jobs and their validators
      fallbacks.ts       code-only answers for everything
      answers-ledger.ts  frozen answers by question hash (from Worldgen)
    art/
      queue.ts           two lanes, priorities, cache
      providers.ts       NAI / GPT / NAI-4.5 parameter builders (from Inlay)
      style.ts           style anchor, visual DNA
      slicing.ts         sheet slicing, alpha trim
    backend/           Spindle wiring: interceptor, storage, RPC, chat events
    frontend/
      stage/             Pixi renderer: battle, cut-ins, FX library
      scene/             three.js scene layer: depth backdrops, billboards, diorama rooms, grid corridors, post-process (6.2)
      themes/            stage themes as data (6.3)
      ui/                React or DOM panels: sheet, journal, altar, parley
      bridge/            window events for Cue and LumiDoll (optional)
  tests/  scripts/  docs/
```

- **Engine stays pure.** It runs headless in tests and in the balance sim, with no host imports.
- **Branches this is based on** (checked 2026-11-06): Warp `origin/codex/warp-living-play` (newest, 64 commits past `main`), Cue `origin/testing`, Inlay `origin/stable`.
- **From Warp living-play** (ideas and small copied pieces, not a dependency; see 12.1):
  - the evidence-backed fact model with **knowledge access** (`src/living/world.ts`, `knowledge.ts`). This is exactly what Parley's Leverage check needs: "does the player *know* this fact, and from where".
  - saved, seeded outcomes with their evidence,
  - `dice-reveal.ts` ("the animation never changes the saved outcome"),
  - branch and edit invalidation,
  - the `warp-state-v1` publisher, which is alive on this branch.
- **Reuse:** Warp's dice, ledger, and decide patterns; Worldgen's answer ledger, validators, map contract, and balance scripts; Inlay's image parameter builders and NAI queue; Cue's overlay mounting, portrait fingerprinting, **V5 reference inset, puppet rig/acting/physics/fx, depth parallax, and cut-out and face detection** (5.6).
- Add `src/frontend/stage/puppet/` as a Pixi mesh renderer over the shared puppet package, plus Gambit's floating, serpentine, and huge rig variants.

---

## 11. Build plan

| Milestone | Goal | Proves |
|---|---|---|
| **M0 Engine core** | Dice, ledger, atoms, timeline combat, budget solver, sim; text-only harness | The game is fun with no models at all |
| **M1 Art spike** | Style lock flow; portrait → V5 inset vs GPT edits vs V5 sheet; transparent monsters; extract Cue's puppet modules and drive one enemy and one NPC in Pixi (breathe, flinch, slump, dissolve); depth parallax on one battlefield; one cut-in template with 6 FX layers; the queue | The look works, stays consistent, and moves |
| **M2 Parley** | Stance, claim verification, Referee via Jev, tiers, haggle track, chat integration, transparency modes | Talking is a real mechanic and resists cheese |
| **M3 Card Reader** | `characters`, `personas`, `world_books` permissions; the Card Reader and Card Sheet (4.0) with quoted evidence, validators, and a fallback for thin cards; the sheet review and edit in the drawer; per-chat on/off; Parley against the card's own cast (stance from the sheet, portraits and expressions from the card's avatar); contest chips started by the roleplay; contest sizes from code tables; the player sheet from the persona; Saltgate repackaged as a demo card | Parley works on a card nobody wrote content for |
| **M4 Scenes and encounters** | Scene view with menus (6.1); the three.js layer with depth backdrops and billboards (6.2); Storybook and 1-bit themes (6.3); lobby movement for towns; modules and shapes; the genre skin; enemies and kits from the card and lorebook (base classes only as fallback); timeline combat over the scene, desktop and mobile; Talk in combat; one first-person grid delve with a boss and phase 2 where the card has one; look files (5.2a) including "match the card" | A 45-minute session that plays like a game *and* still feels like that card |
| **M4.5 Look skill** | The `gambit-look` skill plus validator, and the in-drawer "describe a look" flow | Anyone can make and share a look |
| **M5 The compiler** | World Bible as an extension of the Card Sheet, places added from play, honeycomb overland for frontiers, diorama rooms and the Table, Lobby, Diorama, and Command themes, JAOT queue, rest "Meanwhile…", answer ledger, fallbacks | The card's world grows without waiting |
| **M6 Memory** | Deed ledger, scars with background edits, faction adaptation, Notice promotions from chat mentions, companions from the card's cast and group members | The world reacts |
| **M7 Forge and Codex** | Class Forge from text, fusion, skill awakening, cross-campaign codex | Long-tail replay |

**Test cards for M3 and M4.** Each milestone is checked on at least four very different cards, with no hand edits: a single-character slice-of-life card, a dark-fantasy scenario card with a lorebook, a sci-fi narrator card, and a group chat. A milestone isn't done if any of them feels like a different game was bolted on.

**M2 status (2026-11-06): playable in Lumiverse.**
- **Built:** the engine (`src/engine/parley/`, tested), three Saltgate scenarios linked by a journal, the Referee with its fallbacks, the Parley scene, and chat integration.
  - Referee order: Jev through `decisions`, preferring a TypeSafe connection; then the helper model imitating typed answers; then rules only.
  - Chat integration: Parley-box lines are posted with `metadata.gambit.parley`. Composer lines are judged inside the interceptor. Edits re-judge with the same faces, and deletes rewind.
- **Change from 4.1.2 step 2:** claims are checked inside the same Referee batch (one yes/no per fact), not by a separate `generate.quiet` extraction call. Code still verifies them against the journal.
- **Narrator modes** ("Who voices the NPC"):
  - **Gambit (default).** One short streamed quiet call voices the NPC with the outcome as the last thing in the system prompt. The player's line and the reply are posted to the chat; the reply goes under the NPC's name, without starting the chat's own generation. This mode exists because long-form chat presets overrode the short-reply rules.
  - **Chat preset.** The chat's model narrates, and the interceptor hands it the outcome.
- **Still open:** lines typed in the normal composer always get the chat's narrator. The host does not yet apply an interceptor `finalResponse`.
- **What M3 changes:** the three scenarios are hand-written for Saltgate and ignore the selected card. M3 replaces them with scenes the Card Reader builds from any card (4.0); Saltgate becomes a demo card.

---

## 12. Open decisions

1. **Relationship to Warp (the biggest decision).** Warp's newest branch (`codex/warp-living-play`; `docs/PLAY_DESIGN.md`, `docs/SEAMLESS_SYSTEMS.md`) is turning Warp into an *invisible* engine under any card:
   - no setup, prose-first, inline dice, no stage or art;
   - its dungeons, arcade, and stat sheets are moving out of the default runtime;
   - but SEAMLESS_SYSTEMS (planned, not built) adds **typed effects, combat, abilities mapped to engine-defined balance categories with code-supplied numbers, and social leverage**. That is Gambit's effect language and Parley under another name.

   So the two products are **complementary but share a core**:
   - Warp is a living world under any roleplay, invisibly.
   - Gambit is an explicit game with a stage, art, cut-ins, fusion, and a generated campaign.

   **Decided (2026-11-06): separate engines.** Gambit owns its rules code. It *copies* a few small, proven pure pieces with a provenance header (Warp's seeded dice; Cue's puppet modules) instead of importing a live shared package. Why:
   - **Warp's core is moving fast in its own direction.** Living-play is at about 800 tests and already has its own bounded effect vocabulary (`src/living/abilities.ts`, fixed 5/15/30 magnitudes). Every fact and cost there must be backed by quoted chat evidence and a receipt. That is right for an invisible engine under any card, and wrong for a game that generates its own campaign and needs tactical math.
   - **A shared package means every change must suit two very different products,** and two busy codebases have to coordinate releases. That cost lands on every change, and so far it buys nothing: neither engine is finished, so there is nothing proven to share yet.
   - **They never run on the same chat.** Both would inject outcomes into the narrator and fight over the reply. Gambit detects Warp active on a chat and stands down, telling the player to switch off one of them. With no shared state at runtime, the only benefit of sharing would be less duplicate code. That isn't worth the coupling.
   - **Revisit after Gambit's M3 vertical slice.** If Gambit's effect atoms, budget solver, and simulator hold up, they are a ready answer to Warp's still-open "broader encounter/effect system". At that point, extracting them is a deliberate move with a proven engine, not a guess.
2. **Party size:** protagonist plus 2 companions (recommended), or a solo protagonist.
3. **Default tone and content ceiling.** Mature themes are a setting. Any adult content layer stays opt-in and out of public defaults.
4. **Desktop-first or mobile-first** for the vertical slice. The recommendation is both layouts designed from day one, with desktop polished first.
5. **Name.** Gambit is a placeholder.
6. **Card-first (decided 2026-11-06).** Gambit plays the selected card instead of shipping its own world (4.0). This changes the M3+ plan: the fixed hub town, 6-room dungeon, and 3 base classes are gone as requirements. They are now shapes, modules, and fallbacks the card may or may not use. It also moves Gambit closer to Warp's "engine under any card" idea, so the stand-down rule in 12.1 matters more, and Warp's evidence model is the first thing worth copying for the Card Reader.
7. **Menus, not a map (decided 2026-11-06).** Navigation is scene menus plus a movement mode per shape (6.1), staged in a three.js layer built from the 2D art (6.2), framed by stage themes (6.3). The region map drawn from the graph is dropped; the graph stays for code checks and the delve automap. Open: whether Pixi's battle stage later moves into three.js too, so there is one renderer instead of two.
8. **Cards with almost nothing in them.** A two-line card gives the reader little to quote. Gambit then leans on the genre the card implies, marks most of the sheet as Gambit-added, and shows that in the review so the player can fix it.
