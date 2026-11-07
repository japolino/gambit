/**
 * Finds the art the user already has of each person on a Card Sheet
 * (docs/DESIGN.md 4.0, card art anchor), in this order:
 *   1. their own card (the chat's card, or a group member): expression
 *      groups by name, its expression sprites, its Risu assets, its avatar;
 *   2. the chat's card(s), for someone who lives only in its lorebook or in
 *      a multi-character card: expression groups and Risu assets by name;
 *   3. a card in the user's library with the same name ("Brannoc" has a card);
 *   4. Inlay Illustrator's reference image for them, when Inlay knows them;
 *   5. a captioned gallery image on the chat's card.
 * Host reads only; no model calls. faces.ts decides which image is which mood.
 */
import type { CharacterDTO, SpindleAPI } from "lumiverse-spindle-types";
import { facesFromLabels, facesFromRisu, groupFor, type FaceSet } from "../engine/card/faces.js";
import { bestNameMatch } from "../engine/card/names.js";
import type { CardSheet, CastMember } from "../engine/card/types.js";
import type { InlayLibrary } from "./inlay-library.js";

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Faces from one Lumiverse character for `name`. `own`: the character is this person, so its flat sprites and avatar count. */
export function facesOfCharacter(dto: Pick<CharacterDTO, "id" | "image_id" | "extensions">, name: string, own: boolean): FaceSet | null {
  const ex = obj(dto.extensions);
  const group = groupFor(obj(ex.expression_groups), name);
  let f = group ? facesFromLabels(group, "groups") : null;
  if (!f && own) f = facesFromLabels(obj(obj(ex.expressions).mappings), "expressions");
  if (!f) f = facesFromRisu(obj(ex.risu_asset_map), name, own);
  if (own && dto.image_id) {
    if (!f) f = { base: dto.image_id, expressions: {}, source: "avatar" };
    // The avatar is the card's chosen face: prefer it as the reference when no neutral sprite exists.
    else f.base ??= dto.image_id;
  }
  return f;
}

export function createFaceFinder(spindle: SpindleAPI, log: (m: string) => void, inlay?: InlayLibrary) {
  const get = async (id: string, userId: string) => {
    try {
      return await spindle.characters.get(id, userId);
    } catch {
      return null;
    }
  };

  /** A library card of the same name that is not one of the chat's cards. */
  async function libraryCard(userId: string, name: string, exclude: ReadonlySet<string>): Promise<CharacterDTO | null> {
    try {
      const res = await spindle.characters.list({ search: name, limit: 25, userId });
      const candidates = (res?.data ?? []).filter((c) => !exclude.has(c.id));
      return bestNameMatch(name, candidates, (c) => c.name);
    } catch {
      return null;
    }
  }

  async function facesFor(userId: string, sheet: CardSheet, member: CastMember): Promise<FaceSet | null> {
    const cards = (await Promise.all(sheet.characterIds.map((id) => get(id, userId)))).filter((c): c is CharacterDTO => !!c);
    const own = member.characterId ? cards.find((c) => c.id === member.characterId) ?? (await get(member.characterId, userId)) : null;
    if (own) return facesOfCharacter(own, member.name, true);

    for (const card of cards) {
      const f = facesOfCharacter(card, member.name, false);
      if (f) return f;
    }

    const lib = await libraryCard(userId, member.name, new Set(sheet.characterIds));
    if (lib) {
      const f = facesOfCharacter(lib, member.name, true);
      if (f) return { ...f, source: "library", characterId: lib.id };
    }

    const look = inlay ? await inlay.lookFor(userId, member.name, [member.characterId, ...sheet.characterIds]).catch(() => null) : null;
    if (look?.referenceImageId) return { base: look.referenceImageId, expressions: {}, source: "inlay", characterId: look.characterId };

    if (spindle.characters.getGallery) {
      for (const card of cards) {
        try {
          const items = await spindle.characters.getGallery(card.id, userId);
          const hit = bestNameMatch(member.name, items.filter((i) => i.caption?.trim()), (i) => i.caption);
          if (hit) return { base: hit.image_id, expressions: {}, source: "gallery" };
        } catch {
          /* no gallery on this host or card */
        }
      }
    }
    return null;
  }

  /** Every cast member's faces, written onto the sheet (members with none keep none). */
  async function attachFaces(userId: string, sheet: CardSheet): Promise<CardSheet> {
    const found = await Promise.all(sheet.cast.map((m) => facesFor(userId, sheet, m).catch(() => null)));
    const cast: CastMember[] = sheet.cast.map((m, i) => {
      const f = found[i];
      const { faces: _old, ...rest } = m;
      return f ? { ...rest, faces: f } : rest;
    });
    const summary = cast.filter((m) => m.faces).map((m) => `${m.name} (${m.faces!.source}, ${Object.keys(m.faces!.expressions).length} moods)`);
    if (summary.length) log(`faces: ${summary.join(", ")}`);
    return { ...sheet, cast };
  }

  return { facesFor, attachFaces };
}
