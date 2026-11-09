/**
 * Writing into the story, the same in every theme: what the box does and the beats it leads to. How they look is the
 * theme's own (a form to style, or, in 1-bit, an invisible field over what it paints).
 */
import { esc, type SceneView, type ThemeCtx } from "./contract.js";

export const WRITE_PROMPT = "What do you do?";

/** A delve and the expedition board have their own controls: there's no line to write there. */
export const canWrite = (v: SceneView): boolean => !v.delve && !v.board;

/** There's a story on screen to read, so the theme gives it the room. */
export const isWriting = (v: SceneView): boolean => canWrite(v) && v.story.length > 0;

/** `data-write` is how the host's "/" key finds the field, whichever theme is up. */
export const writeFormHtml = (cls: string, send = "Write"): string =>
  `<form class="${cls}" hidden><textarea rows="1" data-write aria-label="${WRITE_PROMPT}" aria-keyshortcuts="/" placeholder="${WRITE_PROMPT}" enterkeyhint="send"></textarea><button type="submit">${esc(send)}</button></form>`;

/**
 * The story so far. A line you wrote rolls first; a talk or a fight that's over has no line, and ends on how it came out.
 * Classes to style: .beat, .said, .roll, .found, .told.
 */
export function beatsHtml(story: SceneView["story"]): string {
  return story
    .map((x) => {
      const roll = x.roll ? `<p class="roll">${esc(x.roll)}</p>` : "";
      const told = x.reply
        .split(/\n+/)
        .filter(Boolean)
        .map((p) => `<p class="told">${esc(p)}</p>`)
        .join("");
      return `<div class="beat">${x.said ? `<p class="said">${esc(x.said)}</p>${roll}` : ""}${x.found ? `<p class="found">${esc(x.found)}</p>` : ""}${told}${x.said ? "" : roll}</div>`;
    })
    .join("");
}

export interface WriteBox {
  readonly field: HTMLTextAreaElement;
  /** Send what's in the field, if there's anything and nothing is being prepared. */
  send(): void;
  /** Follow the view: gone where there's no line to write, or while `covered`; locked while something is being prepared. */
  sync(v: SceneView, covered?: boolean): void;
}

export interface WriteOpts {
  /** Let the field grow with what's typed, up to this many lines. */
  maxRows?: number;
  /** The form changed height (0: it's gone), for a theme that lays out around it. */
  onGrow?: (px: number) => void;
  /** The field's text, caret or focus changed, for a theme that draws them itself. */
  onChange?: () => void;
  /** A line was sent. */
  onSend?: () => void;
}

export function wireWrite(ctx: ThemeCtx, form: HTMLFormElement, opts: WriteOpts = {}): WriteBox {
  const field = form.querySelector("textarea") as HTMLTextAreaElement;
  const button = form.querySelector("button") as HTMLButtonElement;
  // The field locks while the reply is written, which takes the focus from it: give it back, so the next line needs no click.
  let again = false;
  let grown = -1;

  function fit(): void {
    if (opts.maxRows && !form.hidden) {
      const cs = getComputedStyle(field);
      const line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
      const frame = field.offsetHeight - field.clientHeight + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      field.style.height = "auto";
      field.style.height = `${Math.min(field.scrollHeight + field.offsetHeight - field.clientHeight, line * opts.maxRows + frame)}px`;
    }
    const h = form.hidden ? 0 : form.offsetHeight;
    if (h !== grown) {
      grown = h;
      opts.onGrow?.(h);
    }
  }

  function send(): void {
    const text = field.value.trim();
    if (!text || field.disabled) return;
    ctx.say(text);
    field.value = "";
    const active = (form.getRootNode() as Document | ShadowRoot).activeElement;
    again = active === field || active === button;
    fit();
    opts.onChange?.();
    opts.onSend?.();
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    send();
  });
  field.addEventListener("keydown", (e) => {
    // Letters and digits are commands in the themes and in the host's page: here they're only letters.
    e.stopPropagation();
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    } else if (e.key === "Escape") field.blur();
  });
  field.addEventListener("input", () => {
    fit();
    opts.onChange?.();
  });
  if (opts.onChange) for (const ev of ["keyup", "click", "select", "focus", "blur"]) field.addEventListener(ev, opts.onChange);

  return {
    field,
    send,
    sync(v, covered = false) {
      form.hidden = !canWrite(v) || covered;
      const busy = !!ctx.box(v).busy;
      field.disabled = button.disabled = busy;
      fit();
      if (!busy && again && !form.hidden) {
        again = false;
        const active = (form.getRootNode() as Document | ShadowRoot).activeElement;
        // Not on a phone: the keyboard would jump back up over the reply they've just got.
        if ((!active || active === document.body) && !matchMedia("(pointer: coarse)").matches) field.focus({ preventScroll: true });
      }
    },
  };
}
