/**
 * Inlay Illustrator's character library, as Inlay shares it over the shared
 * RPC pool (`inlay_illustrator.characters.<user>.<characterId>`, version 1).
 * Inlay has already worked out who is on a card (custom characters, lorebook
 * people, the card lead), their appearance as image-model tags, their forms
 * and outfits, and an on-model reference image. Gambit reads that instead of
 * guessing, and uses its own face finder when Inlay is not installed.
 */
import { normName, sameName } from "./names.js";

export interface InlayOutfit { id: string; label: string; tags: string; referenceImageId: string | null }
export interface InlayForm {
  id: string;
  label: string;
  gender: string;
  humanlike: boolean;
  tags: string;
  negative: string;
  referenceImageId: string | null;
  defaultOutfitId: string;
  outfits: InlayOutfit[];
}
export interface InlayMember { key: string; kind: "custom" | "lore" | "description"; name: string; aliases: string[]; defaultFormId: string; forms: InlayForm[] }
export interface InlayCharacter { version: 1; characterId: string; updatedAt: string; members: InlayMember[] }

/** What Gambit takes from Inlay for one person: their look as tags and Inlay's reference image. */
export interface InlayLook {
  /** Inlay's character document the person was found in. */
  characterId: string;
  name: string;
  /** Appearance tags of the default form, then the default outfit's. */
  tags: string;
  negative: string;
  sex?: "girl" | "boy" | "other";
  /** Outfit reference first (it shows the outfit worn), else the form's. Lumiverse image id. */
  referenceImageId: string | null;
  outfit?: string;
  /** A custom character, not someone from the card's lorebooks: worth asking whether the lorebook has them now. */
  custom?: boolean;
}

const isMember = (v: unknown): v is InlayMember => {
  const m = v as InlayMember | null;
  return !!m && typeof m.name === "string" && Array.isArray(m.forms) && Array.isArray(m.aliases ?? []);
};

/** A validated library value, or null for anything Gambit does not understand. */
export function parseInlayCharacter(v: unknown): InlayCharacter | null {
  const c = v as InlayCharacter | null;
  if (!c || c.version !== 1 || typeof c.characterId !== "string" || !Array.isArray(c.members)) return null;
  return { ...c, members: c.members.filter(isMember).map((m) => ({ ...m, aliases: (m.aliases ?? []).filter((a) => typeof a === "string") })) };
}

/** The member who is `name`: an exact name or alias wins, else the only loose match. */
export function inlayMemberFor(members: readonly InlayMember[], name: string): InlayMember | null {
  const target = normName(name);
  if (!target) return null;
  const names = (m: InlayMember) => [m.name, ...m.aliases];
  const exact = members.filter((m) => names(m).some((n) => normName(n) === target));
  if (exact.length) return exact[0]!;
  const loose = members.filter((m) => names(m).some((n) => sameName(n, name)));
  return loose.length === 1 ? loose[0]! : null;
}

const SEX: Record<string, InlayLook["sex"]> = { female: "girl", male: "boy" };

export function inlayLookOf(characterId: string, member: InlayMember): InlayLook | null {
  const form = member.forms.find((f) => f.id === member.defaultFormId) ?? member.forms[0];
  if (!form) return null;
  const outfit = form.outfits.find((o) => o.id === form.defaultOutfitId) ?? form.outfits[0];
  const tags = [form.tags, outfit?.tags].filter((t) => t?.trim()).join(", ");
  const look: InlayLook = {
    characterId,
    name: member.name,
    tags,
    negative: form.negative ?? "",
    referenceImageId: outfit?.referenceImageId ?? form.referenceImageId ?? null,
  };
  const sex = SEX[form.gender];
  if (sex) look.sex = sex;
  if (outfit?.label) look.outfit = outfit.label;
  if (member.kind === "custom") look.custom = true;
  return tags || look.referenceImageId ? look : null;
}
