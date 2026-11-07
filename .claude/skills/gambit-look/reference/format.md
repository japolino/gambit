# The look file (`gambit-look`, version 1)

Source of truth: `src/art/look-file.ts` (`validateLook`). This page mirrors it.

```json
{
  "format": "gambit-look",
  "v": 1,
  "id": "ukiyo_gold",
  "label": "Ukiyo-e Gold",
  "author": "Your name",
  "description": "Woodblock prints with gold leaf and flat colour.",
  "preferred": "nai",
  "prefer": { "icon_sheet": "gpt" },
  "nai": {
    "positive": "ukiyo-e, woodblock print, flat color, bold outlines, gold leaf, limited palette, paper texture, traditional media",
    "negative": "3d, photorealistic, gradient, glossy, lens flare"
  },
  "gpt": {
    "style": "A Japanese woodblock print in the ukiyo-e tradition: bold carved outlines, flat areas of colour, visible paper grain, and accents of real gold leaf.",
    "avoid": "Avoid gradients, photographic lighting and glossy digital rendering."
  },
  "ui": { "ink": "#14110e", "panel": "#221b14", "gold": "#d9b45a", "ally": "#6fa8a0", "enemy": "#c4544a", "accent": "#e8dcc4" }
}
```

## Fields

| Field | Required | Rules |
|---|---|---|
| `format` | no | If present, exactly `"gambit-look"`. |
| `v` | no | If present, exactly `1`. |
| `id` | yes | 2–48 characters: `a-z`, `0-9`, `_`, `-`; starts with a letter or digit. Lowercased on import. |
| `label` | yes | 1–60 characters. Shown in the drawer. |
| `author` | no | Up to 80 characters kept. |
| `description` | no | Up to 400 characters kept. Shown as a tooltip. |
| `preferred` | yes | `"nai"` or `"gpt"`: the provider every kind of art tries first. |
| `prefer` | no | Map of art kind → `"nai"` or `"gpt"`. Kinds: `portrait`, `expression`, `pose`, `monster`, `monster_phase2`, `background`, `background_variant`, `icon_sheet`, `style_probe`. |
| `nai.positive` | yes | Comma-separated tags, at most 700 characters. Warned outside 5–24 tags; 8–16 is best. |
| `nai.negative` | no | At most 700 characters. |
| `gpt.style` | yes | 30–800 characters, written as sentences (warned if it doesn't end with `.` or `!`). |
| `gpt.avoid` | no | At most 500 characters. |
| `anchors` | no | `{ "gate"?: imageId, "bust"?: imageId }`: Lumiverse image ids of reference images. Only meaningful inside one Lumiverse install; leave out of shared files. |
| `ui` | no | Any of `ink`, `panel`, `gold`, `ally`, `enemy`, `accent` as `#rrggbb`. Unknown tokens are ignored with a warning. |

## Rejected (errors)

- Missing or malformed `id`, `label`, `preferred`, `nai.positive`, `gpt.style`.
- A `prefer` key that is not an art kind, or a value other than `nai`/`gpt`.
- Text in the image: tags such as `text`, `english text`, `signature`, `watermark`, `logo`,
  `title`, `caption`, `subtitles`, `username`, `artist name`, `letters`, `lettering`,
  `typography`, `speech bubble`; or a GPT sentence that asks for words, a caption, a title,
  a label, lettering, "written on", typography or a logo.
- A `ui` value that is not `#rrggbb`.

## Warned (fix unless there's a reason)

- `nai.positive` reads like a sentence (no commas, more than six words).
- `nai.positive` has fewer than 5 or more than 24 tags.
- `gpt.style` doesn't read as sentences.
- A `ui` foreground (`gold`, `ally`, `enemy`, `accent`) below 2.5:1 contrast on `panel` or `ink`.

## What each part drives

- **NovelAI** (V4.5 / V5): `nai.positive` is appended to every subject's tags;
  `nai.negative` joins Gambit's own negatives (text, watermark, bad anatomy…). Danbooru
  style tags work best: medium (`watercolor (medium)`, `oil painting (medium)`), shading
  (`cel shading`, `soft shading`), palette (`limited palette`, `muted colors`), lighting
  (`rim lighting`, `chiaroscuro`), texture (`paper texture`, `film grain`).
- **GPT Image**: `gpt.style` opens every prompt; `gpt.avoid` closes it.
- **The code-drawn layer**: `ui` tokens tint frames, HP bars and cut-in bands: `ink`
  (outlines and darkest fills), `panel` (panel backgrounds), `gold` (frames and headings),
  `ally` and `enemy` (sides), `accent` (highlights).
- **The probe**: Gambit draws a "gate" (a landscape) and a "bust" (a portrait) for any look
  on demand, so a look can be judged before a campaign switches to it.
