---
name: gambit-look
description: Write a Gambit look file (gambit-look.json), the art style Gambit's image models draw a campaign in, from a description of a style or from reference images, and check it with Gambit's own validator. Use when the user asks to make, convert, fix or review a Gambit look, art style, style preset or visual theme, or to turn a picture, an artist's medium or an Inlay/NovelAI style prompt into a look for Gambit.
---

# Gambit look author

A look tells Gambit how to draw everything in a campaign: NovelAI tags, GPT Image style
sentences, which provider each kind of art prefers, and optional palette tokens for the
frames and bars Gambit draws in code. It is a small JSON file the player imports in the
drawer (Gambit → Looks → Import a look file) and can share.

Files beside this one:
- `reference/format.md`: every field, its limits, and what the validator rejects or warns
  about. **Read it before writing JSON.**
- `scripts/validate.ts`: runs Gambit's own validator (`src/art/look-file.ts`) on one or more
  files, plus palette contrast checks.

Examples: the built-in looks in the Gambit repo's `looks/` folder (`ink_wash.json`,
`modern_anime.json`, `grim_realism.json`, `painted_dark_fantasy.json`) all pass the validator.

## Rules that matter most

1. **Style, not subject.** Describe medium, era, linework, shading, palette, lighting and
   texture. Never characters, a scene, or a setting: the same look draws portraits,
   monsters, rooms and icons.
2. **No text in images, ever.** Gambit draws all words in code. No `text`, `signature`,
   `watermark`, `logo`, `speech bubble`, `lettering` tags; no "with the words…" sentences.
   The validator rejects these.
3. **NovelAI wants tags, GPT Image wants sentences.** `nai.positive` is 8–16
   comma-separated Danbooru-style style tags. `gpt.style` is 2–3 sentences ending in a full
   stop. `gpt.avoid` is one sentence starting with "Avoid" (GPT Image has no negative
   prompt, so it goes into the prompt).
4. **Pick the provider by medium.** `"preferred": "nai"` for anime, manga, cel and most
   illustrated styles; `"gpt"` for painterly, photographic, collage or mixed media. Use
   `prefer` only to send one kind of art elsewhere (for example icons to GPT).
5. **No living artists' names** unless the user asks for one and accepts it. Name the
   movement, medium or technique instead ("ukiyo-e woodblock", "1990s OVA cel", "gouache").
6. **Palette tokens must read.** `gold`, `ally`, `enemy` and `accent` sit on `panel` and
   `ink`: keep at least 3:1 contrast. The validator warns below 2.5:1.

## Workflow

### 1. Gather

From what the user gave you, settle:
- the style in a sentence (if they only gave a vibe, propose one and say so);
- reference images, if any: look at them and name what makes the style (medium, edges,
  shading, palette, grain), not what they show;
- whether it should lean NovelAI or GPT Image (ask only if the medium is truly mixed).

Ask at most one short round of questions, only for what you can't infer.

### 2. Write the file

Follow `reference/format.md`. Use an id of lowercase letters, digits, `_` or `-`
(2–48 characters), a 2–4 word `label`, and a one-sentence `description`. Add `ui` tokens
when the style has a clear palette; leave them out otherwise (the defaults apply).

### 3. Validate

Run from the Gambit repo (or pass `--repo <path to the gambit repo>`):

```bash
bun run .claude/skills/gambit-look/scripts/validate.ts path/to/look.json
```

Fix every error. Fix warnings unless there is a reason not to, and say what that reason is.

### 4. Deliver

Write the file where the user asked (default: `looks/<id>.json` in the repo when working
there, otherwise beside their other files). Tell them how to use it: in Lumiverse, open the
Gambit drawer → Looks → Import a look file, then press **Preview** on it to draw its gate
and bust before switching to it. Art is kept per look, so switching back costs nothing.

Inside Gambit itself, the drawer's "Describe a look" box does the same from a sentence,
through the strong model and the same validator. Use this skill when the user wants to
iterate on a look by hand, start from reference images, or keep it in a repo.
