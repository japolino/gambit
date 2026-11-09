import { describe, expect, test } from "bun:test";
import { storyHtml, storyRuns, type Voices } from "../src/frontend/story-text.js";
import { wrapStyled } from "../src/frontend/scene/themes/onebit/font.js";

const voices: Voices = {
  cast: [
    { name: "Ysolde", pronoun: "she" },
    { name: "Rook", pronoun: "she" },
    { name: "Captain Hollis", pronoun: "he" },
  ],
  player: "Tobin",
};
const html = (t: string, o = {}) => storyHtml(t, { voices, ...o }).join("\n");
/** Who speaks each quote, in order: a cast name, "you", or null. */
const who = (t: string, o = {}) =>
  storyRuns(t, { voices, ...o })
    .flatMap((p) => p.flatMap((r, i) => (r.said && p[i - 1]?.said?.n !== r.said.n ? [r.said.who] : [])))
    .map((w) => (typeof w === "number" ? voices.cast[w]!.name : w));

describe("markdown", () => {
  test("italic, bold and both, with stars or underscores", () => {
    expect(html("*a* **b** ***c*** _d_ __e__")).toBe("<em>a</em> <strong>b</strong> <strong><em>c</em></strong> <em>d</em> <strong>e</strong>");
  });

  test("what isn't a marker stays as written", () => {
    expect(html("snake_case and 5 * 3 and a lone *star")).toBe("snake_case and 5 * 3 and a lone *star");
  });

  test("the model's words are text, never markup", () => {
    expect(html('<img src=x onerror=boom> & *<b>*')).toBe("&lt;img src=x onerror=boom&gt; &amp; <em>&lt;b&gt;</em>");
  });

  test("while it streams, an open marker runs to the end and a half-written one doesn't show", () => {
    expect(html("She *leans", { streaming: true })).toBe("She <em>leans</em>");
    expect(html("She leans *", { streaming: true })).toBe("She leans ");
    expect(html("She **leans", { streaming: true })).toBe("She <strong>leans</strong>");
    expect(html("She *leans")).toBe("She *leans");
  });
});

describe("dialogue", () => {
  test("straight and curly quotes are speech; a book face curls them", () => {
    expect(html('"Hi," and \u201cbye\u201d')).toBe('<span class="q">&quot;Hi,&quot;</span> and <span class="q">\u201cbye\u201d</span>');
    expect(html('"Hi."', { curly: true })).toBe('<span class="q">\u201cHi.\u201d</span>');
  });

  test("a quote still open at the end of a paragraph runs to its end", () => {
    expect(html('He says, "Wait')).toBe('He says, <span class="q">&quot;Wait</span>');
  });

  test("a tag after the quote names who says it", () => {
    expect(who('Rook nods. "Fine," Ysolde says.')).toEqual(["Ysolde"]);
    expect(who('"Up!" Captain Hollis snaps.')).toEqual(["Captain Hollis"]);
  });

  test("else the subject of the sentence before it, and the next quote carries it on", () => {
    expect(who('Ysolde smiles at Rook. "Welcome." "Sit."')).toEqual(["Ysolde", "Ysolde"]);
    expect(who('"Fine." Rook grins. "Two."')).toEqual([null, "Rook"]);
  });

  test("a paragraph that opens on speech follows the narration that ends the one before", () => {
    expect(who('Ysolde leans in close.\n\n"First, a bath."')).toEqual(["Ysolde"]);
  });

  test("a pronoun is the nearest person named before it who takes it", () => {
    expect(who('Hollis turns from Ysolde. He frowns. "Papers."')).toEqual(["Captain Hollis"]);
    expect(who('Ysolde leans past Hollis. "Coin," she purrs.')).toEqual(["Ysolde"]);
  });

  test("no one it could be is no one's, and names inside quotes are only spoken", () => {
    expect(who('The wolf-woman sniffs. "I saw him first, Ysolde."')).toEqual([null]);
    expect(who('"They left," she says.')).toEqual([null]);
  });

  test("the box's speaker takes what no one is named for; a pronoun that fits them too", () => {
    expect(who('"Sixty crowns."', { speaker: "Ysolde" })).toEqual(["Ysolde"]);
    expect(who('"Sixty," she says.', { speaker: "Ysolde" })).toEqual(["Ysolde"]);
  });

  test("the only one here a pronoun fits", () => {
    const here: Voices = { ...voices, cast: voices.cast.map((c) => ({ ...c, here: c.name === "Rook" })) };
    expect(who('"Out," she growls.', { voices: here })).toEqual(["Rook"]);
  });

  test("the player by name, as I or as you", () => {
    expect(who('Tobin grins. "A room."')).toEqual(["you"]);
    expect(who('I lean on the bar. "A room, Ysolde."')).toEqual(["you"]);
    expect(who('You laugh. "Never."')).toEqual(["you"]);
  });

  test("each speaker wears their own colour, cycling through six; the player theirs", () => {
    expect(html('"Hi," Rook says. "Hi," Tobin says.')).toBe('<span class="q v2">&quot;Hi,&quot;</span> Rook says. <span class="q vy">&quot;Hi,&quot;</span> Tobin says.');
  });
});

test("1-bit type keeps each character's emphasis through the wrap", () => {
  const [runs] = storyRuns("plain *slanted words* and **bold**");
  expect(wrapStyled(runs!, 14)).toEqual([
    { t: "plain slanted", st: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1] },
    { t: "words and bold", st: [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 2, 2, 2, 2] },
  ]);
});
