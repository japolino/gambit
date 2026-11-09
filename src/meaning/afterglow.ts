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
  /** The reply's paragraph (split on blank lines) this page ends with, for putting its picture after it. */
  end: number;
}

/**
 * What in a reply isn't the story, though a card's preset may ask for it: code, style and script blocks, HTML and the
 * card's own tags (Risu image tags, status blocks), comments and macros.
 */
const NOT_PROSE = /```[\s\S]*?(?:```|$)|<(style|script|details)\b[\s\S]*?(?:<\/\1\s*>|$)|<!--[\s\S]*?(?:-->|$)|<[^<>]*>|\{\{[\s\S]*?\}\}|!\[[^\]]*\]\([^)]*\)/gi;
/** A line that opens a menu of what to do next ("Options for User:"): it and everything after it are not the story. */
const MENU = /^[\s*_#>[(]*(?:options?|choices?|actions?|what (?:will|do|does|should) \S+ do(?: next)?|선택지|선택)\b[^.!?\n:]{0,40}:[\s*_\])]*$|^\s*(?:#{1,6}\s*|\*\*|\[)(?:options?|choices?|actions?|선택지|선택)\b[^.!?\n]{0,40}$/i;
/** A line of a table, status block or rule. */
const NOT_A_LINE = /^\s*(?:#{1,6}\s|\||[-*_=]{3,}\s*$)|\|.*\|/;

/**
 * The reply as the reader reads it: everything that isn't the story is masked, with its whitespace kept, so the reply
 * still splits into the same paragraphs (withPictures places pictures by those).
 */
function prose(reply: string): string {
  const masked = reply.replace(NOT_PROSE, (m) => m.replace(/\S/g, "\0"));
  const lines = masked.split("\n");
  const menu = lines.findIndex((l) => MENU.test(l.replace(/\0/g, "")));
  return lines.map((l, i) => (menu >= 0 && i >= menu) || NOT_A_LINE.test(l) ? l.replace(/\S/g, "\0") : l).join("\n");
}

/** A paragraph as the reader shows it, without markdown emphasis. */
const readable = (p: string): string =>
  p
    .replace(/\0+/g, " ")
    .replace(/(\*\*|\*|__)(?=\S)([^*_]+?)\1/g, "$2")
    .replace(/\s+/g, " ")
    .replace(/^[\s*_]+$/, "")
    .trim();

const paragraphs = (reply: string): string[] => reply.split(/\n\s*\n/);

/**
 * A reply as pages: its paragraphs, a short one joined to the next. The pictures fall at the ends of its first,
 * second and last thirds (fewer for a short scene), so they follow the scene as it goes on.
 */
export function scenePages(reply: string): ScenePage[] {
  const pages: { text: string; end: number }[] = [];
  let held = "";
  paragraphs(prose(reply)).forEach((raw, i) => {
    const p = readable(raw);
    if (!p) return;
    const text = held ? `${held} ${p}` : p;
    if (text.split(" ").length < SHORT_WORDS) held = text;
    else {
      pages.push({ text, end: i });
      held = "";
    }
  });
  if (held) {
    const last = paragraphs(reply).length - 1;
    if (pages.length) pages[pages.length - 1] = { text: `${pages[pages.length - 1]!.text} ${held}`, end: last };
    else pages.push({ text: held, end: last });
  }
  const n = pages.length;
  const k = Math.min(SCENE_PICTURES, n);
  const at = new Set(Array.from({ length: k }, (_, i) => Math.ceil((n * (i + 1)) / k) - 1));
  return pages.map((p, i) => ({ ...p, picture: at.has(i) }));
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

/** Inlay reads at most 2000 characters of a picture's text. */
const PICTURE_TEXT = 1900;

/**
 * A picture's text: who and where first (mid-scene pages say "she" and "him", and Inlay finds people by name), then the
 * moment. A long moment loses its start, not its end: the picture is of where the moment has got to.
 */
export function pictureText(who: string, moment: string): string {
  const room = PICTURE_TEXT - who.length - 2;
  return `${who}\n\n${moment.length > room ? moment.slice(-room).replace(/^\S*\s+/, "") : moment}`;
}

/** The reply with its pictures in it, each after the paragraph its page ends with, the way Inlay places illustrations. */
export function withPictures(reply: string, pages: readonly ScenePage[], pictures: readonly { page: number; url: string; alt: string }[]): string {
  const after = new Map<number, string[]>();
  for (const p of pictures) {
    const end = pages[p.page]?.end;
    if (end === undefined) continue;
    after.set(end, [...(after.get(end) ?? []), `![${p.alt.replace(/[[\]\n]/g, " ")}](${p.url})`]);
  }
  // Split keeping the reply's own breaks, so nothing but the pictures changes in it.
  const parts = reply.split(/(\n\s*\n)/);
  return parts.map((part, j) => (j % 2 === 0 && after.has(j / 2) ? `${part}\n\n${after.get(j / 2)!.join("\n\n")}` : part)).join("");
}
