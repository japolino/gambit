/**
 * The words Gambit adds to a chat's own generations, as templates the user can edit (the drawer's "Story notes"):
 * the player's line that starts an adult scene, and the note at the prompt's end that says what the reply is.
 * Only edits are stored; an empty or missing one is the default, so new defaults reach everyone who never edited.
 */
export type NoteId = "scene.win.line" | "scene.win.note" | "scene.loss.line" | "scene.loss.note";

export interface NoteDef {
  id: NoteId;
  label: string;
  text: string;
}

export const NOTE_DEFS: readonly NoteDef[] = [
  { id: "scene.win.line", label: "Adult scene, you won: your line", text: "*{{player}} claims {{partner}}.*" },
  {
    id: "scene.win.note",
    label: "Adult scene, you won: note at the end of the prompt",
    text: [
      "[Game engine note, not part of the story. Never mention it.]",
      "This reply is the intimate scene that follows the fight. {{player}} won the fight against {{partner}}, and {{partner}} is theirs to claim.",
      "{{look}}",
      "Write the scene itself, in character and true to this world. Everyone in it is an adult, and however it started, both of them want it by the time it happens.",
    ].join("\n"),
  },
  { id: "scene.loss.line", label: "Adult scene, you lost: your line", text: "*{{player}} gives in to {{partner}}.*" },
  {
    id: "scene.loss.note",
    label: "Adult scene, you lost: note at the end of the prompt",
    text: [
      "[Game engine note, not part of the story. Never mention it.]",
      "This reply is the intimate scene that follows the fight. {{partner}} won the fight and claims {{player}}: not hurt, kept.",
      "{{look}}",
      "Write the scene itself, in character and true to this world. Everyone in it is an adult, and however it started, both of them want it by the time it happens.",
    ].join("\n"),
  },
];

export const NOTE_FIELDS = "{{player}} your name (\"you\" without one), {{partner}} who you fought, {{look}} how they look when the card doesn't say";

export type NoteEdits = Partial<Record<NoteId, string>>;

/** The template in use: the user's edit, else the default. */
export function noteText(id: NoteId, edits: NoteEdits): string {
  return edits[id]?.trim() || NOTE_DEFS.find((d) => d.id === id)!.text;
}

/** A template filled in. A line left empty by a missing field goes. */
export function fillNote(template: string, fields: { player: string; partner: string; look?: string }): string {
  const look = fields.look ? `${fields.partner} looks like this: ${fields.look}.` : "";
  return template
    .split("\n")
    .map((line) => {
      const out = line.replace(/\{\{player\}\}/g, fields.player || "you").replace(/\{\{partner\}\}/g, fields.partner).replace(/\{\{look\}\}/g, look);
      return line.includes("{{look}}") && !look && !out.trim() ? null : out;
    })
    .filter((l): l is string => l !== null)
    .join("\n");
}

/** Stored edits, cleaned: known ids, non-empty strings, capped. */
export function parseNoteEdits(raw: unknown): NoteEdits {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: NoteEdits = {};
  for (const d of NOTE_DEFS) {
    const v = o[d.id];
    if (typeof v === "string" && v.trim()) out[d.id] = v.slice(0, 4000);
  }
  return out;
}
