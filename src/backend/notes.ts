/** The user's edits to Gambit's story notes (meaning/notes.ts), kept per user. */
import type { SpindleAPI } from "lumiverse-spindle-types";
import { NOTE_DEFS, NOTE_FIELDS, parseNoteEdits, type NoteEdits, type NoteId } from "../meaning/notes.js";
import type { NotesState } from "../shared/protocol.js";

const FILE = "notes.json";

export function createNotes(spindle: SpindleAPI) {
  const edits = async (userId: string): Promise<NoteEdits> => parseNoteEdits(await spindle.userStorage.getJson(FILE, { fallback: {}, userId }).catch(() => ({})));
  return {
    edits,
    async state(userId: string): Promise<NotesState> {
      const e = await edits(userId);
      return { fields: NOTE_FIELDS, notes: NOTE_DEFS.map((d) => ({ id: d.id, label: d.label, default: d.text, ...(e[d.id] ? { text: e[d.id] } : {}) })) };
    },
    /** Save one note; empty text (or null) goes back to the default. */
    async set(userId: string, id: NoteId, text: string | null): Promise<void> {
      const e = await edits(userId);
      if (text?.trim()) e[id] = text;
      else delete e[id];
      await spindle.userStorage.setJson(FILE, parseNoteEdits(e), { userId });
    },
  };
}
