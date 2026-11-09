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

**The Card Reader.** When the player turns Gambit on for a chat, the Architect reads those sources and writes a **Card Sheet**: JSON, validated, and frozen in the answer ledger. A people read that comes back with no facts at all is asked once more (live, the same card gave 0 and then 8), and the second answer counts if it has some.

**A card isn't always a person.** Many cards are a game, a narrator or a setting. The reader names those under `not_people`, and code keeps them out of the cast, so a card's rules never reach the narrator as someone's role and a game never joins the party. A person the reader forgot still goes back in; a card it left out stays out only when the reader said so, its text says it runs a game, or its name reads as a title. With nobody else read, the card stays as a neutral stand-in, without its rules. Cards can also ask for status lines at the end of every reply: the narrator is told prose only, and `cleanReply` cuts any that slip through.

**A player with no persona has no name.** Gambit never makes one up or guesses a gender. The narrator writes them as "you", a fight calls them "Hero" because a log can't read "You takes 17", and prompts say "the player". Someone fighting alone, with no companions or recruits, faces fewer foes than a party would.

**The card says how the player is written.** When the card asks for second or third person, the reader records it on the sheet (`player.person`) and the story narrator follows it; otherwise a named player is written in third person and an unnamed one as "you". The narrator is told who the player is and what they are after, and that the people in the scene know only what they can see and what the story has shown them, never the player's past, secrets or aims. The purse starts with what the persona or card says the player has (`player.coin`), else 50.

**The story and the game stay together.** A line can do more than one thing: a risky escape moves the scene as well as rolling, and a fail still gets them out, noticed, while only a disaster stops them. A fight the line takes somewhere happens there, against the foe it names and that foe's own kind. Someone from the card fights as their own figure. After a line, the scene also follows the narration to a place the world already has. Parleys and fights leave their result on the page, with a narrated aftermath for a fight, so coming back never drops to the old text. A line written while something else plays out (a walk that ends the day, the night being written) waits and plays after it; taps and clicks in that time are dropped. Keys pressed in a fight or a talk on top are commands, so the box doesn't take the focus back when the scene returns.

**Names Gambit gives are real names, drawn by code.** Pillar 3 holds for names too: code chooses them, the model chooses shape. The name bank (`src/engine/card/name-bank.ts`) holds real given names (by sex), surnames and small real places in 17 naming traditions: English, Irish, Welsh, Norse, German, Czech, Polish, Hungarian, Occitan, Basque, Castilian, Italian, Arabic, Persian, Yoruba, Japanese and Chinese. The card read records the tradition that fits the card on the sheet (`names`). When it doesn't, code infers it from the card's setting words and its own names, and a card with neither gets English. `src/engine/card/naming.ts` draws names from the card's seed, so the same card always gets the same ones. A draw never repeats a word of any name on the sheet, in the world or in the story so far. Wherever a model must name something new, it is given a few drawn names and asked to use one: the Bible's places and factions, a place the chat goes to without naming it, a promotion's sub-place, a boss the card leaves unnamed. The story, Parley and board narrators get drawn names for anyone new, and are told to call the people present only by the names the sheet gives them (a narrator once named the card's Ysolde "Sslia"). Code then checks every name it was given (`fixName`). A name the sources give stays, and so do plain words ("The Old Mill"). A stock fantasy word (Whispering, Shadow, Ember, Crystal, Moon Vale) is dropped. A stock name (Vance, Voss, Thorne, Kael, Elara, Lyra, Seraphina, Shadowfen, Eldoria, Aethel-) or a made-up word becomes a drawn name, so "The Whispering Woods" turns into "Lhota Woods". Skills and classes get the same treatment. They are named in plain words for what they do ("Shield Bash", "Hip Throw", "Sweet Talk", "Fire Bolt"). A stock word (veil, glamour, whisper, eclipse, requiem, litany, arcane, celestial, crimson…) in a skill Gambit made means the skill is renamed from its effects ("Fire Wave", "Group Heal"), and the skill itself is kept. Forged and fused classes are treated the same way ("Fire Mage", "Healer"). The ban list applies only to what Gambit invents. A name that the card, its lorebook, the persona, the chat or the player's own Forge text uses is never changed.

**Re-reads keep ids.** A fresh read can name people differently, so `mergeEdits` keeps each person's old id, matched by name, and chats in progress still know them. Sheets read before these rules are repaired as they load (`repairSheet`).

**Big lorebooks** (`src/meaning/lore-pick.ts`). The read has room for about 30,000 characters, card first. Gambit fetches every enabled entry (up to 1,000 per book, 10 books, global books included) and ranks them: entries the host has active in this chat right now, then always-on entries, then entries whose keys the chat names, then entries close to the chat in meaning, then entries the card or the persona name, then the book's own order. "Close in meaning" uses the user's primary embedding model in Lumiverse (the `embeddings` permission, `src/meaning/lore-vectors.ts`): each entry is embedded once and kept at 8 bits per dimension in `lore-vec/<model>/<book>.bin`, and each read embeds the recent chat as the query. A read spends at most 10 seconds embedding entries and ranks with what it has; the rest are embedded in the background and saved as they land, so the next read has them. A connection that fails a request with several texts (NVIDIA's Nemotron embed model did, live) is sent one entry per request from then on, and five failures in a row stop the fill until the next read. The outcome of the last run is in `lore-vec/last.json`. Without the permission or a model it ranks by keywords alone. A global book's entry only counts when the chat uses it (the host has it active, or the chat names its keys); the rest are left out of the read, since global books apply to every chat. About two thirds of the room goes to the top entries in full, then short excerpts, and the rest are listed by name under "also in the lorebook", so the reader knows who and what exists even when it can't read them. When the chat keeps mentioning someone or somewhere the sheet doesn't have and Notice promotes them (4.6), the promotion is written from their lorebook entry, as canon, instead of being invented.

- **Cast.** The card's character(s) and up to 11 more named people, the ones most likely to matter first; 2 or 3 of them get a full stance at once (wants, fears, likes, hates, tells), and the rest when play reaches them. The model picks a social tier for each, and code turns the tier into stats. The card's main character is always in the cast. Themes draw a crowd as its first few people and keep everyone reachable: the Table folds a crowded room into one "The room" card, the Diorama keeps four behind the counter and the rest in a guest book, and 1-bit draws five figures plus whoever the cursor is on.
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

`engine/card/faces.ts` maps sprite labels to the six moods. It reads emotion words only, and skips actions and explicit variants. Sprites are shown as drawn, never keyed. Moods with no sprite are drawn from the character's figure (5.3a) with the V5 inset, or as a plain V5 render from their tags. Gambit does not use the NovelAI V4.5 reference: it gave flat, off-model results. A rendered mood that comes back blank, or greyscale for a colourful character, is rejected in the browser and the base face stays.

An opaque base, such as a card avatar with its own background, is shown as a **framed portrait** (gilt rule, dark mat, the room softened behind it), and every mood shows inside the same frame. The browser's face finder (the cut-out's YOLOv8 face model) finds the face in a picture that will be framed, and every frame, in Parley and in the scene, crops round it, so a full figure's high head stays in; a frame is never taller than the room above the story box. The art key carries the reference image, so a new avatar or sprite set never shows old renders. Characters with no art at all get Gambit portraits.

When Inlay Illustrator is installed, Gambit reads its character library over the shared RPC pool (`inlay_illustrator.characters.<user>.<characterId>`), and asks Inlay to profile anyone missing (5.3a): Inlay has already found who is on a card, tagged their appearance from its vision pass, and chosen their outfit and an on-model reference. Those tags ride in every drawn mood's caption (card art included), and Inlay's reference is the base for anyone who has no art of their own. Without Inlay, nothing changes. The look picker (5.2a) gains a **"match the card"** option that builds a look from the avatar's style.

**Never in the way.**
- Gambit is off until the player turns it on for a chat.
- It never edits the card, its lorebooks, or the persona.
- The Card Sheet can be exported as a lorebook, so the narrator can know Gambit's additions even with Gambit off.
- It stands down on chats where Warp is active (12.1).

**How a contest fits the card.** A contest's *shape* comes from the scene and the sheet: its kind, what is at stake, and the track's unit (crowns, credits, favors, minutes of a guard's patience). Its *size* comes from code tables keyed to the stake and the NPC's stance tier: start, floor, DC, and patience. A price the NPC already offered in the story (free included) is never below the floor, so the talk can reach it. This is pillar 3 applied to Parley. Encounters work the same way: the card names the enemies and their style, and the budget solver sets the numbers.

**Demo content.** Saltgate (Marta, Pell, Vey) ships as a demo card plus lorebook, not as built-in content, and goes through the same Card Reader. Its hand-written scenarios stay as test fixtures for the engine.

### 4.1 Parley: talking as a mechanic

Parley covers every non-combat contest of words: haggling, persuading, intimidating, deceiving, seducing, interrogating, calming a mob, talking down a boss. It also runs *inside* combat (see 4.2).

**Talking is not a contest.** "Talk to someone" puts you in the write box, addressed to them, and the narrator answers in the story. A Parley opens only when a line presses them for something they'd rather not give, or from an explicit chip or drawer button, and its first line says what's on the line.

**A talk starts from the story and leaves something behind.** How they feel about you sets the starting rapport, they carry what they remember into how they read and voice you, and a lie they caught counts against later talks (one they never caught doesn't). A won talk gives you what was at stake, as an item the story holds to; a deal is also paid for from your purse when it's priced in your money, and you can't take one you can't pay. A price named in another coin is counted in the sheet's currency, ten coppers to a silver and ten silvers to a gold, and never less than one coin. The thread's next revelation comes out only if the talk was about the thread.

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
   - `tactic` (choice): interest, logic, empathy, candor, flattery, threat, bribe, bluff, humor, insult, nonsense. Candor is telling the plain truth or simply asking. A bluff is a claim made up to pressure someone, so the Referee reads the story just before the talk, the talk so far with the NPC's replies, who the speaker is (their persona), and the facts they know: what those show to be true, the speaker's own past as their persona has it, and a guess drawn from what the NPC said are no bluff. Only a line rolled as a bluff counts as a lie in memory.
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
5. **Repetition decays.** Code compares the argument with earlier ones in the same Parley (word n-gram overlap, `src/engine/parley/similarity.ts`), and repeated arguments drop a tier. With an embedding connection the line is also embedded next to the earlier ones while the Referee reads it (`backend/referee-host.ts`): a near-paraphrase (cosine 0.86 and up) counts as repetition too, and the measure is stored on the read so a replay gives the same tier. You cannot win by pasting the same speech, or by rewording it.
6. **Outcome tiers move the state track** for the contest (price, suspicion, morale, affection) and spend **patience**:

| Result | Haggle effect | Patience |
|---|---|---|
| Critical success | Meets your ask, or drops straight to the floor | +1 back |
| Success | Closes 50% of the gap | −1 |
| Partial | Closes 25% | −1 |
| Fail | No movement | −1 |
| Critical fail | Price +10%, rapport −1 | −2 |

   At 0 patience the NPC makes a final offer. Other contests have to be won outright, so their track closes in even steps instead, sized by the NPC's patience to leave room for one miss, and at 0 patience the NPC refuses.
7. **The Narrator plays the NPC's reply** with the outcome already decided and injected. The prose has to match the dice.

#### 4.1.3 Information is power

**Leverage can move the floor, not just the roll.** No roll can get a price below what the merchant can afford. Knowing she fences stolen nets changes what she can afford to refuse. Exploration, eavesdropping, and earlier conversations write facts into your journal. A talk's replies are part of the story too: a fact the NPC lets slip is noticed like one met in the chat, marked known on the sheet, and counts as Leverage from the next line on. Those facts are your real ammunition. This is what turns talking into a game rather than a vibe check. In a contest framed from a card, a small or real ask can be talked out of someone; a big one has a floor that only Leverage takes down, and that floor is never higher than what the facts on that person can remove, so no talk is unwinnable from the start. A talk only brings the facts that matter to it: about this person, about nobody in particular, or about someone they have to do with.

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

#### 4.1.6 Moments

A few exchanges get a picture: the beat that changes the talk.

- **Beats** (`engine/parley/moments.ts`): a critical success (*it lands*), a critical failure (*it blows up*), a caught bluff, and the end (a win, a deal, a walk-out). A final offer is not the end.
- **At most four per Parley**, and the end always gets one. Which exchanges count is fixed, so an early moment keeps its picture as the talk goes on.
- **The Parley direction** (`art/directions.ts`): the person seen from the speaker's own eyes (POV), chest up, eye contact, the place soft behind them, lit like a film still. Their reaction (the mood, or the beat's gesture: pointing at you, glaring down, turning away) rides in their own caption, so it stays on them.
- Drawn as a CG (`kind: "cg", direction: "parley"`) from their tags (Inlay's when there); their figure goes along as the reference for a GPT edit.
- **In the view:** the newest beat's picture flashes in over the scene with its caption and a slow push-in, then fades back after a few seconds or a click. Every moment stays as a thumbnail in the corner to see again.

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

**Some cards don't kill or rob the loser.** The reader says what losing means on the card (`skin.defeat`): beaten back (the default), or **claimed**, where the winner keeps the loser instead of hurting them, as monster girls do in Monster Girl Encyclopedia-style worlds. A claimed loss costs no coin: the party comes round unhurt where the winner lives, and the narrator shows what the winner wants with them.

**Adult scenes after fights** are opt-in per chat (the drawer's Options, off by default). After a fight with someone who can be talked to, win or lose, the scene's menu offers one ("Claim Rook", "Give in to Rook") until the scene moves on. Taking it posts the player's line ("*Tobin claims Rook.*") and the chat writes the scene as an ordinary reply, under the user's own preset: its jailbreak, length, prose and voices. Gambit only adds a note at the prompt's end saying what this reply is. The player reads the reply page by page, like a visual novel (forward, back, Escape to close). Pictures fall at the ends of its first, second and last thirds, at most three, and Inlay draws each from the pages since the last one with its "Gambit: Intimate" guideline over the chat's cast and the user's Atelier preset; without Inlay the pages stay words. The first picture sets the place: the others are asked for once it is in, with it as their base, and Inlay draws them into it (on NovelAI, an infill that repaints the people and keeps a frame of the first picture's place, light and palette), so one scene doesn't move from a forest floor to a cabin to a tent. Where it can't, they are drawn on their own. Each picture's text starts with who and where (mid-scene pages say "she", and Inlay finds people by name); a long one loses its start, not the end the picture shows. The pictures go into the reply itself after the paragraph their page ends with, the way Inlay places its illustrations, so a swipe still swipes the scene. A swipe rewrites the scene; the person remembers it once.

**Gambit's notes are a suffix.** Everything Gambit adds to the chat's own generations (the Parley outcome, what people remember, the adult scene's note) goes at the prompt's very end, before a preset's assistant prefill (`backend/suffix.ts`). The prompt before them is the one a normal reply sends, so the provider's prompt cache still matches it, and a prefill stays last. The adult scene's lines and notes are templates the user can edit in the drawer's **Story notes** (`meaning/notes.ts`): only edits are stored, and an emptied one goes back to the default.

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
  "id": "skill_drag_under",
  "name": "Drag Under",
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

**Starting kits come from the card.** The persona and each companion get a kit built from what the card and lorebook say they can do. The Architect maps that onto atoms, and the budget solver and sim size it, the same path as the Class Forge below. About 8 base classes are still hand-tuned in data (Duelist, Warden, Sea Priest, Witch, Scout, Brute, Chorister, Alchemist). They are a tested **fallback** used when a description is too thin to build from, and the genre skin renames them to fit the card. They are not a fixed menu every card must use.

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

**The night answers the day.** When the day ends, by resting or because the clock ran out, a **"Meanwhile…"** montage plays. The curtain opens at once on the day behind you, in plain lines, while one pass reads what you wrote, what you rolled and what you did, decides what changes, and writes 3 to 5 short scenes that show it. A scene can name what you did that led to it and make one thing true: someone remembers, a place is marked, someone goes somewhere, or a rumour starts. Code checks each change against fixed limits. The last card says what is different by morning, and the next day's narrator and the next night both build on it.

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

### 5.2a Looks are data: presets, your own, and AI-made (built in M4 and M4.5)

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
| A card character's **figure** (art kind `figure`) | NAI V5, transparent, full body, from the character's tags (Inlay's character tag, body and outfit tags when Inlay knows them) under the look's style tags; no reference image | The card's avatar is a framed picture; the figure is the same person standing, transparent, for scenes, board tokens, Parley and cut-ins | Character tags, fixed seed |
| **CGs** (art kind `cg`) | NAI V5 with one character caption per person (their Inlay tags); a GPT Image edit with their figures first when GPT is connected | A wide illustration of a key moment | Character tags per person |
| Expedition **board map** (art kind `map`) | GPT Image edit of the place's painting when GPT is there, else V5 top-down | The board lies on the place seen from above | The painting as a style reference |

Notes:
- **Expression sheets in one pass.** As an alternative to 6 edits, V5's full-page composition can render one 2×3 expression sheet of the same character, and code slices it. Identity is consistent inside one sheet, so it is cheaper and often more consistent. Both methods should be tried in the art spike (milestone 1).
- **Typography is always code.** Skill names, damage numbers, and cut-in text are rendered in code, never baked into images.
- **Avy's RPG Maker icon packs** were considered. Their style is low-resolution RTP-era and does not match the look, and their terms forbid reposting, so they are left out. Generated icons, with game-icons.net as the instant fallback, cover the need.

### 5.3a Figures, the cut-out, and CGs

**In a chat, Inlay draws anything of a character.** Figures and CGs go to Inlay as pictures on request, like Parley moments and cut-ins do, so they get what its in-chat pictures get: the person's form and outfit, the user's parser, artist, fixed tags and negatives. Under a look picked in the drawer, Inlay draws them in that look instead of its own artist: an Inlay style offered as a look by its id, any other look by its NAI style tags. Its stored settings don't change, the default look leaves Inlay's own style, and the pictures are keyed by look like the rest of the art, so another look draws them again. A figure is asked for by name, with the whole of their body in view, on a white ground; it is never told to stand, because a lamia has no legs to stand on. Before it shows, the browser cuts it out with the cut-out model, like Gambit's own figures (Inlay's picture is kept), so it stands in scenes, Parley and fights instead of being framed. A figure of Inlay's still on its white ground (no browser could cut it) is cut the next time it is asked for, once a run. Gambit's own drawing, below, is what happens without Inlay, or without a chat, or when Inlay fails. It then tries Inlay once more on the next run, and the figure on screen stays until a new one is in. When someone's figure changes, what was drawn from it (their moods, their action picture, their cut-in) is drawn again.

- **Figures, not frames.** Everyone on the card who appears in a scene is drawn once as a full V5 figure with a transparent background, from their tags. No reference image is used. Scenes and the board show the figure when it is ready (card art meanwhile). Moods, poses and cut-in poses are then drawn *from the figure* with the V5 reference inset.
- **Where the tags come from.**
  1. **Inlay's character library**: character tag, head, eyes, body, outfit.
  2. **Inlay, on request**: when the library lacks someone, Gambit publishes `gambit.inlay.wanted.<user>` with the card and the people, each with a description from the card. Then it reads `inlay_illustrator.profiles.<user>`. Inlay matches each person to a lorebook entry, or makes a custom character from the description. It runs its own text analysis, including the model's knowledge of a known character's Danbooru tag. Gambit polls the library until the profiles appear, for up to five minutes.
  3. **The reader model**: without Inlay, or when Inlay finds nothing, a reader call (`meaning/figure-tags.ts`, ledger kind `figure-tags`) writes the character tag, sex and appearance tags from the card text. A miss is retried after five minutes.
- **Figures move.** In every DOM theme, a figure that is a real cut-out is swapped for a canvas showing it through Cue's puppet rig (`frontend/scene/puppet-dom.ts`). It breathes, sways and turns its head, on one shared WebGL renderer, only while on screen, and not under reduced motion.
  - **Parley:** a canvas follows the face's crossfading images and warps the ones that are cut-outs.
    - The read drives the acting (`frontend/parley/acting.ts`). Irritated is angry with a huff; afraid is scared with a step back; tempted smiles and leans in; amused laughs; suspicious turns away; confused wonders.
    - A caught bluff is a startle, then a step back.
    - The head moves with the reply while it streams in.
  - **3D themes:** in the diorama room and at the table, a cut-out person's plane becomes the rig's grid mesh (`frontend/scene/puppet-mesh.ts`), lit and shadowed as before.
  - The battle stage has its own renderer over the rig.
- **Tags change, the figure follows.** Gambit keeps a print of the tags each figure was drawn from (`art/figure-prints.json`). When someone's tags change, their figure is drawn again: Inlay profiled them, or the reader added their character tag. When Inlay's tags have no Danbooru character tag ("name (series)"), the reader's character tag and leading traits (species, size, build) go in front. Without the character tag, V5 draws a generic person from the traits, such as a tall demon for a small imp. Scenes and Parley ask for figures through the same prints (`backend/figure-prints.ts`). In Parley, a card person with no art of their own, such as a lorebook character, stands as their figure, not a separately drawn portrait. Their mood images are keyed by their tags, so new tags bring new moods.
- **The cut-out runs in the browser.** ISNet-anime (fp16, 88 MB) on onnxruntime-web, WebGPU with a WASM fallback, in a worker, with a YOLOv8 anime face detector for the face box. It is vendored from Cue (`src/frontend/art/cutout`) with Cue's model store names, so a model Cue already downloaded on the same Lumiverse is reused. The backend asks for a cut with a pixel job (`art.pixels`, kind `cut`); a cut that comes back basic, with two figures, or with scenery falls back to the crop. No ComfyUI connection is needed.
- **CGs for key moments.** A 2★ or 3★ story tile on the board, each Meanwhile vignette that shows someone or somewhere, the end of a Parley, and a promotion are each drawn as a wide CG with the people in it (their figures as references) at the place it happens. The story card and the montage show the CG when it is ready; finished CGs are posted to the chat as a picture with its caption, and the Journal keeps the last 24 in an **Album**.
- **The board's map.** The board lies on the place seen from above (art kind `map`), with the place's painting as the room around it; turned tiles show the map under them.

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
  - **The cut-in direction** (`art/directions.ts`): splash art like a fighting-game special move. A dynamic, foreshortened pose at a slanted angle, an intense glare, hair and clothes whipped by the motion, the move's effects around them, nothing behind them.
  - **The action comes from the move** (`cutinAction`): a spirit hit is a spell thrust at the viewer, a might hit a weapon strike, a heal is light between the hands, a shield a flaring barrier. The element adds its effects (fire and embers, ice, lightning), and the skill's FX ids add theirs (a glyph ring is a magic circle).
  - **Which move:** the fighter's signature, else their strongest skill, else their attack (`cutinSkill`).
  - **Drawn from the fighter's own image** (figure, portrait, or card art) with the V5 inset's wide layout, landscape (key `<art>#action`). The stage keys out the white ground.
  - **On the band**, the splash is shown whole and taller than the band, so it bursts out of it, punching in a little large and settling. Without one, the determined face crop is used.
  - **Painted splashes** (Inlay draws one with its own backdrop) get their own two templates:
    - *Panel* (`cutin/panel.ts`, 1.9 s): for a regular signature. The field dims, a slanted panel snaps open from a line with the picture pushing in, speed lines stream behind, and the name slams onto a plate across the lower edge.
    - *Full screen* (`cutin/framed.ts`, 2.45 s): reserved for ultimates (a tier-5 signature or the *Shatter* template; card kits stop at tier 4, so nothing reaches it yet). The screen shuts to a slit, cracks race out from the move and the black shatters, then the picture slams in full height with a colour split. The name stamps word by word onto a black wedge. It holds in a tunnel of ribbons, arcs and embers with a flare on the move, then ends on an ink impact frame and a whiteout with the name burned in. Its colours come from the picture's dominant hue.
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
- **Audio:** hit, UI, and cut-in sounds are synthesized in WebAudio (sfxr-style recipes stored as data), with a few tiny clips inlined. Extensions cannot serve bundled files yet (8.1). Voices come from the host's TTS (6.4). Music is off until the player turns it on: a model reads the moment (a place by day or night, a talk, a fight, the night's montage), picks a feel and a sound, code narrows Kevin MacLeod's published catalogue with them, and the model picks a track from what's left (`src/meaning/music.ts`). A moment keeps its track, so a place has a theme. Tracks stream from incompetech.com; none are bundled. The catalogue is read through the host's CORS proxy (the `cors_proxy` permission) and kept for a month. The drawer lists the full credit for each track, as the licence asks.

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

**Expedition boards** (`src/engine/world/board.ts`, `src/meaning/board-deck.ts`, `src/frontend/scene/board.ts`). Any outdoor or dangerous place that is not a delve, and any wild overland cell, offers **Explore**: a small honeycomb (radius 3, about 30 tiles, a few edge tiles cut so no two outlines match) dealt face down over the place's painting. Each face-down tile shows a coloured ring for what kind of thing it is, not what it is: blue is safe (a camp, a spring), green is chance (a cache, food, a hazard, a lookout that turns its neighbours, or quiet ground), violet is the story, gold is the way on. The way in is at the bottom; the way on is near the top and needs the **whole party** standing on it.
- **Turns.** The player and up to two companions are separate tokens. One member moves per turn, anywhere across tiles already turned (foes block the way), stopping on a face-down tile at the edge or on a foe. Turning a tile earns a supply (12 at most). After the last member, the foes roam.
- **The story deck.** Violet tiles are the card's own world: facts the player has not met (stars from their weight), people they have not spoken to, the central thread's next revelation, and the lorebook entries ranked highest for this chat (4.0), dealt in turn so no kind crowds the others out. Lore opened on earlier boards is held back while fresh lore is left. A story tile is opened at a depth that costs supplies: **1 star** (1 supply) is a glimpse written by code; **2 stars** (3) is a short scene the model writes from the source; **3 stars** (6) is a full discovery that also changes something: a fact becomes known (Parley Leverage), a person draws Notice toward promotion, an entry goes into the journal, a revelation is found. A tile you pass on stays violet to come back to. Scenes are posted to the chat as asides and shown on the board.
- **Foes.** Step onto a foe and the party acts first in the battle; let one step onto you and it is an ambush, so the foes act first. Winning clears the foe and the member's move carries on; losing ends the board and sends the party back, as any lost fight does (4.2).
- **The crossing.** With everyone on the way on, leftover supplies become coin and the board closes; turning back closes it with nothing lost but time.
- **Presentation.** Tiles are dealt in from the middle; a turned tile swells as it flips and lets off a ring and sparks; gains pop up where they happen; tokens hop, foes bob, reachable tiles glow, and a pulsing mark calls back to story tiles left for later and to the way on. The board is a shared overlay like the class panel, skinned by each theme (cards dealt on baize in Table, dithered backs and dashed rings in 1-bit, a sixteen-colour grid in Command), and it works by mouse, touch and keyboard (1 to 3 open a tile, Esc passes, Space holds still, C makes camp).

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

**Pixel art keeps its lines.** A figure's detail is its line art, which a plain dither at low resolution averages into a dark blob. So the 1-bit and Command themes convert art manga-style (`src/frontend/art/manga.ts`, run in a worker): ink lines are found at three times the output size and kept in solid ink, the tone is local contrast, and then it goes to three screentones (1-bit: solid ink, a checker, a sparse dot, paper) or to the palette's ordered dither (Command, lines in its darkest colour). This holds everywhere those themes show art: places, people, portraits, Parley moments, Meanwhile and scene pictures, and the battle stage (whose shader keeps a cell inked when a third of it is line).

**Cost and fallback.** three.js adds roughly 0.6 MB to the single frontend bundle (8.1), loaded only when a scene first opens. With no WebGL, or in "low" mode, every scene falls back to the flat painting with the same menu.

### 6.3 Stage themes

A **stage theme** is the whole game interface around the art: layout, materials, how each piece of data is shown (status as a hanging scoreboard, a pocket watch, a page corner...), the dialogue, the menus, motion and lighting. It is separate from the **look** (5.2a), which is how the art itself is drawn, though a theme can suggest a look. A card can suggest a theme.

Each theme is its own interface in code, not a reskin: `src/frontend/scene/themes/<id>.ts` (plus a folder of art, textures and styles) built against `themes/contract.ts`. The Scene host (`scene/view.ts`) owns only what isn't visual: the scene data, the art cache, the WebGL layer, the journal and class-panel state, the delve keys, the "Meanwhile…" montage and a pointer tracker for parallax. Themes draw everything themselves: multi-path SVG, procedural canvas textures, pixel frame buffers, and, through `ctx.stage3d()`, their own three.js stage on the host layer (Table and Diorama are real 3D rooms with lit, clickable props and a camera that glides in). Every theme must reach every action, person and system control by mouse, touch and keyboard, from a phone to an ultrawide window, and keep a 2D fallback when there is no WebGL. The set:

| Theme | Frame | Pairs well with |
|---|---|---|
| **Storybook** (default) | the speaker large behind a carved, gilt dialogue page; ribbons for choices; bookmarks for status | most cards, single scenes |
| **Diorama** | a 3D shop room: people behind a counter, actions as lit props on it (register, hourglass, teacup, books) | shops, taverns, slice of life |
| **Lobby** | one big figure, brass instruments and layered place cards, resource troughs, a news ticker | towns, companion-focused cards |
| **Table** | a 3D candle-lit card table: the person across from you, a fanned hand of action and fact cards, a hanging chalk scoreboard | Parley-heavy cards, gambling, horror |
| **1-bit** | one low-res 1-bit frame buffer: scene and people in ink lines and screentones, bitmap type, "WHAT NOW?" prompt | delves, horror, retro cards |
| **Command** | a character-grid EGA screen inside a CRT on a desk, a command terminal, floppy disks as the theme switcher | classic dungeon crawls |

**Story text reads like the chat.** Every box Gambit writes the story into (the scene's story, a Parley's replies and your lines, the "Meanwhile…" cards, the adult-scene reader) goes through one renderer, `src/frontend/story-text.ts`. It shows `*italic*`, `**bold**` and `***both***` (or underscores) from text escaped first, so a model can't write markup; while a reply streams, a marker not closed yet runs to the end instead of flashing as a star. Words in quotes, straight or curly, are dialogue, coloured per speaker. Who speaks a quote: a tag after it when the quote doesn't end its sentence (`"Fine," she says`); else the subject of the nearest sentence before it in the paragraph, carried on to the next quote when no one new is named (a paragraph that opens on speech looks at the narration ending the one before); else the box's own speaker (the NPC in a Parley, the player in their own line). A pronoun means the nearest person named before it with that pronoun (the card's cast pronouns), else the box's speaker if it fits, else the only one in the scene it fits; "I" and "you" are the player. Anything else is plain dialogue. Each theme sets a small palette (`speakerVars`: anyone's dialogue, the player's, six for the cast in card order). 1-bit has two colours, so speech stays plain there; italic is underlined and bold set in reverse.

---

### 6.4 Voice

Gambit's own lines can be spoken through the host's TTS (`ctx.tts`, `text-to-speech-v1`): board story scenes as their card opens, the Meanwhile montage, and each Parley reply once it is written. The drawer's Voice picker is always there, chat or no chat: **No voice** (the default), **Default voice** (their own default TTS connection), or any of their TTS connections, with a Test button. The setting is kept per browser. Playback needs the `media` permission, which the user grants; without it the drawer says so and nothing else changes. Markdown and stage asterisks are stripped before speaking, and a long scene is cut at a sentence.

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
| `decisions` | The Referee (Jev / TypeSafe through the host), and the play classifiers in 9.1 |
| `embeddings` | Lorebook ranking (4.0), fact matching, Parley repetition, memory recall (9.1) |
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
| `media` | Optional: host TTS playback for Voice (6.4) |

Storage and drawer tabs are free.

### 8.3 How a Parley turn flows through Lumiverse

1. The player types in the Parley box on the Stage, or in the normal composer while Parley is active.
2. The frontend sends the text to the backend over messaging. The backend runs claim extraction (`generate.quiet`, JSON) and the Referee (`decisions`) **in parallel**, then rolls seeded dice and writes the exchange event.
3. The frontend plays the read strip and dice animation (about 1.5 s, which hides the Referee's latency) with the decided result.
4. The frontend sends the player's line as a chat message (`composer.send`, or `chat.appendMessage` with `triggerGeneration`).
5. Gambit's interceptor reads the chat's latest line (not the prompt: the host doesn't pass a line's metadata to an interceptor, and a preset may lift the latest line into a block of its own), finds the exchange stored on it, and injects at the prompt's end: *"OUTCOME (already decided, narrate faithfully): Marta lowers her price to 85; she is irritated by the reminder."* plus Marta's stance and tells.
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

   None of this blocks anything. Today Gambit embeds text only, to rank lorebook entries by meaning (4.0), and the Card Reader reads lorebook text only.

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
| No Jev or no image provider | Helper LLM imitates typed answers (Referee, contest chips); the play classifiers fall back to their word rules; placeholder-only art mode |
| A picked connection fails | Each call falls back to the default connection (and drops reasoning first if reasoning was on); timeouts are not retried (9.1) |
| Costs run away | Budget meter, "low art" mode, ledger cache (no repeat calls) |

### 9.1 Which connection does what

Settings live in user storage (`models.json`) and in the drawer under **Models** (`src/meaning/models.ts` pure routing, `src/backend/models.ts` the calls).

- **Text roles.** Every text call has a role. *Reader*: card read, World Bible, armory, looks, class forging and awakening. *Narrator*: Gambit's Parley replies, board and lore scenes, Meanwhile, the night, promotions. *Helper*: place from the chat, contest framing, typed answers when no Decision model answers. Ledger kinds map to roles (`roleForKind`). Each role picks a connection (default: the default connection) and reasoning: **Auto** (default) thinks for the Reader when its connection has reasoning bound on, or its model name is a known thinker, and never for the others; **Think** and **No thinking** force it. Attempts in order: the picked connection, the same without reasoning if reasoning was on, then the default connection. A connection that rejects reasoning is asked without it from then on (until the settings change). Timeouts and cancels are never retried elsewhere; a stream that broke mid-answer is not either.
- **Decision model.** Auto (default) prefers a TypeSafe/Jev connection, then the default Decision connection, then any with a key; or a picked one; or off. A failed request backs off for three minutes so play goes straight to code.
- **Play classifiers on the Decision model**, each with its old rule as the fallback (`src/meaning/senses.ts`, `src/backend/senses.ts`), all off the player's path:
  - *Places*: indoor, rest, shop, danger, delve, asked once per place (six places per request) in the background when the world is built or grows; the flags are stored on the place (`judged`, `indoor`) and the word regexes stay as the fallback (`applyTraits`, still gated by the modules; the start is always restful).
  - *After a reply*, one request: which names the player's line mentions (the `mentions` rule proposes, the model drops false ones and catches other forms), which hidden card facts came up (they count as known for Leverage), and which quest steps the chat accomplished (searching the place still completes steps too).
  - *Companions' reactions* to a fight's deeds, one choice per companion read against who they are; the warmth rule covers anyone unanswered.
- **Embeddings.** Auto (the primary embedding connection), a picked one, or off. Used for lorebook ranking (4.0), facts (each hidden fact against the recent lines: the closest go to the Decision model; without one, cosine 0.8 and up counts), Parley repetition (4.1.2), and recall: memories the narrator's note leaves out (people elsewhere, older notes and rumours, other places' scars) that the player's latest line is about join the note before the reply, within 2.5 s of the interceptor's deadline. Small texts are cached as 8-bit vectors in memory.

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
      scene/themes/      stage themes, one interface each, on a shared host contract (6.3)
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

**M4 status (2026-11-07): built and played in Lumiverse on one card.**
- **World and movement** (`src/engine/world/`): the card's places become a World by shape (scene, town hub, journey line, frontier, delve). Each place has a menu: Talk, Look around (a Guile check that can turn up a hidden fact, which then counts as known for Parley Leverage), exits, Rest, Shop, Wait, and Fight where the place is dangerous. Moves spend the clock (morning to night, days); Look around runs the same clock as a written search (two of the three units that make a part of the day), and Wait takes a whole part, and every move, find and fight posts a short narrated aside to the chat without starting the character's reply. Shop drops a suggested line into the chat input instead.
- **Scene view** (`src/frontend/scene/`): a three.js layer shows the place's painting on a mesh displaced by its depth: a guess at once (floor near, horizon far), then Depth Anything V2's estimate when it is ready (vendored from Cue, `src/frontend/art/depth`, run in a worker and kept per painting in the browser), with the people present as billboards (card art soft-edged, generated portraits for the rest). The camera drifts and leans toward the pointer. A screen pass carries the theme: paper grain for Storybook, ordered dither for 1-bit, scanlines for Command. Towns use a lobby (the companion in the middle, places as tiles), journeys a stop strip. With no WebGL, or `gambit.scene.low`, the same view runs flat.
- **Delves:** a generated grid (every seed checked: all rooms reachable, the key before the lock, the boss behind it) walked in first person through real 3D corridors with a torch fog, an automap, and a command menu (arrow keys and WASD too). Fight and boss rooms start card battles; traps, rests, keys and caches resolve in code.
- **Card battles:** the Architect's second read (`src/meaning/armory.ts`) names the card's foes (role, tier, element, weak points, whether they talk, a boss's second phase) and a kit per party member as effect atoms; code sizes everything. They are fought over the scene's own painting, with vigor carried between fights, coin paid out, rooms cleared, and defeat sending the party back to the start. **Talk in combat**: surrender, bargain, recruit, taunt and deceive, with chances from morale, Break and allies left.
- **Looks are files** (`src/art/look-file.ts`, `scripts/validate-look.ts`, `looks/`): import and export in the drawer, Inlay's art styles offered as looks, and "Match this card" (the strong model writes a look file for the card; the validator checks it; its previews draw before you switch). Art is keyed by look, so switching looks keeps the old art and draws the new look as needed.
- **Checked live:** the scene, Look around, Talk into a Parley and back, and two card battles (one lost, one won) on a scene-shaped card. The delve, the lobby, the journey strip and the 1-bit and flat fallbacks are checked in the local preview (`bun run preview`, `/scene`) and in tests (`tests/play.test.ts`, `tests/world.test.ts`).
- **Still open:** the four-card check below (only one real card has been played); the shop itself (it only suggests a line for now).

**M4.5 status (2026-11-07): built; checked in tests and once in Lumiverse.**
- **Describe a look** in the drawer (Looks section): a sentence such as "1990s anime OVA cel, film grain, muted teal and amber" goes to the strong model through the answer ledger. The prompt asks for style only and no living artists' names. The answer must pass the same validator as an imported file; a failed one is asked once more, and there is no code fallback for taste. The look is saved as yours, and its gate and bust previews draw at once.
- **The validator** (`src/art/look-file.ts`) also warns about NovelAI tag counts outside 5 to 24, and about palette tokens under 2.5:1 contrast on the panel and ink colours.
- **Palette tokens now apply:** a locked look's `ui` tokens go to the page with the lock, and retint the battle stage's code-drawn layer: ink, panels, gold frames and their dimmer shades, the ally and enemy colours, and the cut-in bands of skills without their own palette. A look without tokens, like every preset, keeps the stock colours.
- **The `gambit-look` skill** (`.claude/skills/gambit-look/` in this repo, picked up by Claude Code when working here) writes a look file from a description or from reference images. It carries the format reference and a validator script that runs Gambit's own `validateLook`. To use it elsewhere, copy the folder into `~/.claude/skills/` and pass `--repo` to the script.
- **Checked live:** a described look ("90s OVA Cel") came back from the model with all six palette tokens, passed the validator, and drew both previews in its style.
- **Still open:** reference images as input to the in-app flow (the skill takes them; the drawer takes words only), and palette tokens for the scene view, which keeps its own colours.

**M5 status (2026-11-07): built; checked in tests, the local preview, and once in Lumiverse.**
- **Answer ledger** (`src/backend/ledger.ts`): every Architect answer the world is built from is stored by a hash of the question (`ledger/<kind>/<hash>.json`). Each answer passes a validator; a failed one is asked once more, then code falls back. The card read, the armory, the World Bible, "match the card", "Meanwhile…" and places from the chat all go through it, so re-reading an unchanged card costs no model call.
- **JAOT queue** (`src/backend/jaot.ts`): model jobs run by priority (P0 needed now, P1 next likely, P2 speculative, P3 downtime), two at a time. A job asked for twice is joined, and a more urgent ask raises its priority.
- **World Bible** (`src/meaning/bible.ts`): compiled at P1 right after the card read, so it lands while the player reviews the sheet. It adds places only up to what the shape needs (town 4, frontier 5, journey 4, a delve needs somewhere to explore), a central thread with 4 to 6 revelations only when the card has no goal, and the factions the card implies. Quoted places count as the card's; the rest show as "new". A chat's world grows when the Bible lands, without waiting, and searching turns up the thread's revelations once the card's own secrets are found.
- **Places from play:** the reply detector asks one more typed question in the same call, "where is the scene now?" A known place picked with p ≥ 0.6 moves the scene there. "Somewhere new" asks for the place's name, a line, and the quote that put the scene there; the quote must be in the chat, and a place the chat doesn't name gets one of the drawn names (4.0). The place is then added to the graph next to where you were.
- **Honeycomb overland** (`src/engine/world/hex.ts`): frontier cards walk a seeded hex map with the start in the middle. The map guarantees every place is reachable, carving through water if needed. Three steps are one part of the day (morning to afternoon, and so on), so a place two or three cells away costs part of a day and the far side of the map most of one; each part of the day on the road eats a supply. Cells reveal as you go (two rings from a hill). In the wild you can forage, make camp (it costs supplies) or fight. Menu "Go to" walks the path. Places added later are known on the map at once.
- **The end of a day plays "Meanwhile…"** (`src/meaning/meanwhile.ts`): 3 to 5 scenes that answer the day and carry its consequences, shown over the scene with their CGs and posted to the chat as one aside with what changed. They are compiled while the curtain is up: the narrator first, then the helper, then templates that echo what you did.
- **Themes** (all six now draw):
  - **Diorama** builds indoor places as a little 3D room: the painting on the back wall, plaster and planks tinted from it, a counter with the keeper behind it where the place sells things, and warm light. Clicking a person in the room talks to them.
  - **Table** seats the person you face across a candlelit table, with what you know as a hand of fact cards. Playing a card opens a Parley with them, the fact already cited in your line. The Parley itself also shows the hand in this theme.
- **Fallbacks** (`src/meaning/fallbacks.ts`): genre tables for places, each named with a real place name or surname from the name bank (4.0), a templated thread around the card's own people, templated "Meanwhile…" lines, and a regex for a place named in the last line.
- **Checked live** on one card: the frontier overland, the Bible landing as "the world grows", a step into generated woods, a camp, and the montage with generated art. Vertex was rate-limited during the check, so the Bible and the montage ran on their code fallbacks there. The model paths are covered by tests (`tests/compiler.test.ts`, `tests/ledger.test.ts`).
- **Still open:** checking a model-written Bible, places from the chat, and the montage live once the provider has quota again.

**M6 status (2026-11-07): built; checked in tests and once in Lumiverse.**
- **Deed ledger** (`src/engine/memory/memory.ts`): code turns what happens into tagged deeds. Battles report kills, spares, recruits and the method (element) from a per-battle tally of the party's events; Parleys report how they ended (won over, a deal, walked away, refused) and how you played it (a lie, a threat, charm, a bribe) against the person you talked to. Each deed carries the day and the place.
- **Night phase** (`src/meaning/night.ts`), run at P3 when you rest:
  - **Scars.** The Architect proposes at most one place change a night, only for a place where something happened that day, with a flag from a fixed list (burned, wrecked, bloodied, guarded, quiet, celebrating, abandoned, flooded). The place's art is redrawn as an edit of its original painting and keyed by the flag, and the place's description gains a line. With no model, a place where three or more fell is marked "bloodied", or "burned" if fire did it.
  - **People remember.** Up to three people the day's deeds touched get a one-line memory. Code also keeps a score per person (-10 to 10) that those deeds move. When that person is in the scene, an interceptor note tells the chat's narrator what they remember.
  - "Overnight, X changed" is posted to the chat as an aside.
- **Factions adapt** in code: the build profile (element mix, favourite statuses, talk versus fight) picks countermeasures for a foe kind you have beaten six or more times, two at most, each announced first as a rumour. A monster that keeps getting the same status learns a cleanse.
- **Notice:** names in your messages, visits, talks and searches raise an interest score. At 6 a P3 job promotes the person or place: role, look, a dossier, a 2 to 4 step questline at real places, sometimes a small sub-place, and a unique item. Code caps it at three promotions. A promoted name becomes a person in the cast. Searching at a step's place finishes the step, and the last step gives the item.
- **Companions:** the card's cast are the first companions. Recruits from battles join the party with a base kit. Affinity moves with how you treat people: a warm companion likes mercy and dislikes a body count, a cold one the reverse. At 5 a companion is bonded, which unlocks a tier-3 combo skill in battle and their personal quest.
- **Journal** in the scene's HUD: companions with affinity bars, quests and their steps, what people remember, rumours, items and the deeds.
- **Checked live** on one card: search, rest with the night phase, and the journal. Promotions, scars and adaptations are covered by `tests/memory.test.ts`.
- **Still open:** a scar redrawn by the model live (Vertex was rate-limited), group chats with more than one member as companions, and recruited monsters getting their own portrait set.

**M7 status (2026-11-07): built; checked in tests, the local preview, and once in Lumiverse.**
- **The class book** (`src/engine/forge/forge.ts`), one per campaign: the card's kit (recorded at your first fight), the base classes, and every class you make. You pick the class you fight as in the class panel (⚒ Classes in the scene's HUD). Each win raises the class in use: a rank every two wins, up to 5, and the player fights at level 4 + rank.
- **The Forge:** describe a class in your own words. The Architect answers in shapes only: element, the stats it leans on, a resource and what fills it, a passive, 4 or 5 skills as atoms, a look, and what it had to change from the request. Code then:
  - keeps a class within a tier room of 10 across its skills, with one signature, and says which skills it lowered;
  - sizes every skill with the budget solver and runs passives at a chance that fits their trigger;
  - tests the class in sim fights beside a Warden and a Sea Priest, against the same fights with a Duelist. Too strong, its skills drop up to two tiers and then its health and power shrink; too weak, its skills rise up to two tiers.

  You see the full sheet with real numbers, the changes and the test result before you keep it. Keeping it spends a Blank Crest: you start with one, and every finished questline gives another. With no model, the closest base class is renamed from your words.
- **Fusion at the Altar:** two classes at rank 3 and a catalyst. Bosses and cleared delves leave catalysts.
  - Code blends the stats evenly and adds one seeded mutation toward a stat a parent was strong in.
  - The resource comes from a hybrid table (Tempo and Resolve make Momentum, Hex and Tide make Foresight…). A pair without an entry keeps one parent's resource with a trigger from the other.
  - The fusion keeps the two strongest skills of each parent and gets three new ones that may only use the parents' effects, elements and statuses; anything else is dropped or remapped, and the preview says so.
  - Its portrait is drawn as a GPT edit with both parents' portraits as references.
  - Declining gives the catalyst back; one reroll costs a second catalyst.
- **Awakening:** the battle tally counts the player's skill uses. At 50 a skill can awaken: three mutations (from the Architect, or code ones: an extra hit, a status rider, wider targets, a kill reward), each a tier up with a new cut-in template. The awakened skill replaces the original from then on.
- **The codex** (`codex.json` in the user's storage) keeps every class you forge or fuse, from every campaign, with its portrait. "Take" brings one into the current campaign at rank 1.
- **Checked live** on one card: the Forge with the live model ("a war-chef…" became a forged class, with its portrait drawn and its changes explained), the test fights trimming it, keeping it, and the codex. Fusion, rerolls, awakening, ranks and catalysts are covered by `tests/forge.test.ts`, and each was clicked through in the preview.
- **Changes from 4.4:** the Forge and the Altar live in the class panel, gated by Blank Crests and catalysts, instead of at a shrine and an altar place. Fusion does not yet draw a cut-in pose per new signature skill; the cut-in uses the class portrait's "determined" face like every class.
- **Still open:** a fight as a made class live (no fight was on offer in the card used), and the four-card check.

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
