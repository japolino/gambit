/**
 * Contest chips (docs/DESIGN.md 4.0): when the roleplay sets up a contest,
 * a small button appears under that reply ("Haggle with Ilse?"). Nothing
 * opens by itself; ignoring the chip keeps the chat going. One chip per
 * chat at a time: a newer one replaces the old.
 */
import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import type { ContestChip } from "../../engine/card/types.js";

const CSS = `
.gambit-chip-wrap { margin: 6px 0 2px; display: flex; gap: 6px; align-items: center; }
.gambit-chip { font: 600 12px/1 system-ui, sans-serif; padding: 7px 12px; border-radius: 999px; cursor: pointer;
  border: 1px solid var(--lumiverse-primary, #c8a26a); color: var(--lumiverse-primary, #c8a26a); background: transparent; }
.gambit-chip:hover { background: var(--lumiverse-primary, #c8a26a); color: var(--lumiverse-primary-contrast, #111); }
.gambit-chip-x { font: 12px/1 system-ui; opacity: .5; cursor: pointer; background: none; border: 0; color: inherit; padding: 4px; }
`;

export interface Chips {
  show(chip: ContestChip): void;
  clear(chatId?: string): void;
  destroy(): void;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function createChips(ctx: SpindleFrontendContext, accept: (chip: ContestChip) => void, fallback: (chip: ContestChip) => void): Chips {
  const removeStyle = ctx.dom.addStyle(CSS);
  const shown = new Map<string, Element>();
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const clear = (chatId?: string) => {
    for (const [cid, el] of shown) {
      if (chatId && cid !== chatId) continue;
      try {
        ctx.dom.uninject(el);
      } catch {
        el.remove();
      }
      shown.delete(cid);
    }
  };

  const place = (chip: ContestChip, tries: number) => {
    const bubble = ctx.dom.findMessageElement(chip.messageId);
    if (!bubble) {
      if (tries > 0) {
        const t = setTimeout(() => {
          timers.delete(t);
          place(chip, tries - 1);
        }, 600);
        timers.add(t);
      } else {
        fallback(chip);
      }
      return;
    }
    clear(chip.chatId);
    const el = ctx.dom.inject(bubble, `<div class="gambit-chip-wrap"><button class="gambit-chip" type="button">⚖ ${esc(chip.label)}</button><button class="gambit-chip-x" type="button" title="Dismiss">✕</button></div>`, "beforeend");
    shown.set(chip.chatId, el);
    const btn = el.querySelector<HTMLButtonElement>(".gambit-chip");
    btn?.addEventListener("click", () => {
      // Framing can take a while on a slow model: say so until the Parley opens (or fails) and clears it.
      btn.disabled = true;
      btn.textContent = "⚖ Setting the scene…";
      btn.style.cursor = "progress";
      accept(chip);
    });
    el.querySelector(".gambit-chip-x")?.addEventListener("click", () => clear(chip.chatId));
  };

  return {
    show: (chip) => place(chip, 6),
    clear,
    destroy: () => {
      for (const t of timers) clearTimeout(t);
      clear();
      removeStyle?.();
    },
  };
}
