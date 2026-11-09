/**
 * The adult scene after a fight (opt-in per chat). The chat writes it as an ordinary reply, under the user's own preset
 * (its jailbreak, length, prose and voices): Gambit posts the player's choice as their line and adds one note at the
 * prompt's end (meaning/notes.ts, both editable). The reply is then read like a visual novel, page by page, with up
 * to three pictures Inlay draws.
 */
export const SCENE_PICTURES = 3;
/** A paragraph shorter than this joins the next one on its page. */
const SHORT_WORDS = 25;

export interface ScenePage {
  text: string;
  /** This page closes a moment that gets its own picture. */
  picture: boolean;
}

/**
 * A reply as pages: its paragraphs, a short one joined to the next. The pictures fall at the ends of its first,
 * second and last thirds (fewer for a short scene), so they follow the scene as it goes on.
 */
export function scenePages(reply: string): ScenePage[] {
  const paras = reply
    .split(/\n\s*\n/)
    // A preset's headings ("## Response", "### Chapter 1") and markdown emphasis aren't the story's words.
    .map((p) => p.split("\n").filter((l) => !/^\s*#{1,6}\s/.test(l)).join(" "))
    .map((p) => p.replace(/(\*\*|\*|__)(?=\S)([^*_]+?)\1/g, "$2").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const pages: string[] = [];
  let held = "";
  for (const p of paras) {
    const text = held ? `${held} ${p}` : p;
    if (text.split(" ").length < SHORT_WORDS) held = text;
    else {
      pages.push(text);
      held = "";
    }
  }
  if (held) pages.length ? (pages[pages.length - 1] += ` ${held}`) : pages.push(held);
  const n = pages.length;
  const k = Math.min(SCENE_PICTURES, n);
  const at = new Set(Array.from({ length: k }, (_, i) => Math.ceil((n * (i + 1)) / k) - 1));
  return pages.map((text, i) => ({ text, picture: at.has(i) }));
}

/** What each picture is drawn from: the pages since the last picture, up to and including its own. */
export function pictureMoments(pages: readonly ScenePage[]): { page: number; text: string }[] {
  const out: { page: number; text: string }[] = [];
  let from = 0;
  pages.forEach((p, i) => {
    if (!p.picture) return;
    out.push({ page: i, text: pages.slice(from, i + 1).map((x) => x.text).join("\n\n") });
    from = i + 1;
  });
  return out;
}
