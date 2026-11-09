/**
 * Ask the art pipeline for everything a battle shows: enemies first (P0),
 * party portraits next (P1), and a boss's second phase as an edit of its
 * first once that exists (P1). Keys match `Combatant.art`, so the stage can
 * swap a placeholder for the real image as soon as it lands.
 */
import type { ArtApi } from "../art/controller.js";
import { cutinAction } from "../art/directions.js";
import { dnaFromClass, monsterBrief, type CharacterDNA, type MonsterBrief } from "../art/specs.js";
import { CLASSES, MONSTERS } from "../engine/content/index.js";
import type { BattleState, Combatant, SkillDef } from "../engine/types.js";
import { actionArtKey, cutinArtKey, isFigureArtKey } from "../shared/art-keys.js";
import type { ToFrontend } from "../shared/protocol.js";
import type { InlayPictures } from "./inlay-pictures.js";

/** Inlay, when it can draw the fight's cut-ins (a fight in a chat), and how to tell the stage. */
export interface CutinPictures {
  inlay: InlayPictures;
  send: (msg: ToFrontend, userId: string) => void;
}

const seedOf = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** The move a fighter's cut-in shows: their signature, else their strongest skill, else their attack. */
export function cutinSkill(state: Pick<BattleState, "skills">, c: Pick<Combatant, "skills" | "attack">): SkillDef | undefined {
  const own = c.skills.map((id) => state.skills[id]).filter((s): s is SkillDef => !!s);
  return own.find((s) => s.signature) ?? [...own].sort((a, b) => b.tier - a.tier)[0] ?? state.skills[c.attack];
}

/**
 * A party member's cut-ins, drawn from their canonical image (figure or
 * portrait) once it exists: the signature move in action (the splash the
 * band shows) and the determined face it falls back to.
 */
function requestCutins(art: ArtApi, state: BattleState, c: Combatant, dna: CharacterDNA, imageId: string, userId: string, viaInlay: boolean): void {
  const action = cutinAction(cutinSkill(state, c));
  if (!viaInlay) art.request(actionArtKey(c.art), { kind: "pose", character: dna, pose: action.tags, poseText: action.text, canonical: { imageId } }, 1, userId);
  art.request(cutinArtKey(c.art), { kind: "expression", character: dna, expression: "determined", canonical: { imageId } }, 2, userId);
}

/**
 * In a chat, Inlay draws the cut-in splash (its Gambit: Cut-in guideline over the chat's cast and the user's preset);
 * `own` draws it with Gambit's pipeline when Inlay cannot. True when Inlay was asked.
 */
function inlayCutin(pictures: CutinPictures | undefined, state: BattleState, c: Combatant, userId: string, own: () => void): boolean {
  const chatId = state.meta?.chatId;
  if (!pictures || !chatId) return false;
  const skill = cutinSkill(state, c);
  const action = cutinAction(skill);
  const key = actionArtKey(c.art);
  const text = `${c.name} unleashes ${skill?.name ?? "a finishing move"}: ${c.name} is ${action.text}.`;
  void pictures.inlay
    .request(userId, { id: key, chatId, direction: "cutin", text })
    .then((pic) => {
      if (pic) pictures.send({ type: "art.update", items: [{ key, state: "ready", url: pic.url, imageId: pic.imageId, cutout: false, via: "inlay" }] }, userId);
      else own();
    })
    .catch(own);
  return true;
}

export function requestBattleArt(art: ArtApi, state: BattleState, userId: string, pictures?: CutinPictures): void {
  for (const c of state.combatants) {
    if (c.side === "enemy") {
      const def = state.meta?.monsters?.[c.defId] ?? MONSTERS[c.defId];
      if (def) {
        // Someone from the card already has a picture of their own (play.ts).
        if (c.art.startsWith("monster:")) art.request(c.art, { kind: "monster", monster: monsterBrief(def) }, 0, userId);
        const into = def.phase2?.into;
        if (into) {
          const key = `monster:${into.id}`;
          const brief: MonsterBrief = { id: into.id, name: into.name, brief: into.visual.brief, palette: into.visual.palette, rig: into.visual.rig };
          void art.whenDone(c.art, userId).then((first) => {
            if (first.state === "ready" && first.imageId) {
              art.request(key, { kind: "monster_phase2", monster: brief, phase1: { imageId: first.imageId }, change: into.visual.brief }, 1, userId);
            } else {
              art.request(key, { kind: "monster", monster: brief }, 1, userId);
            }
          });
        }
      }
    } else {
      // Card art is shown as it is (play.ts sends it); only the rest is drawn.
      const face = state.meta?.faces?.[c.id];
      if (face) {
        // The card's own art is the cut-in's reference: the move drawn in its style.
        const looks = state.meta?.looks?.[c.id];
        const dna = { id: c.id, name: c.name, tags: "", description: looks ? `${c.name}: ${looks}` : c.name, seed: seedOf(c.art), ...(looks ? { booru: looks } : {}) };
        const own = () => {
          const action = cutinAction(cutinSkill(state, c));
          art.request(actionArtKey(c.art), { kind: "pose", character: dna, pose: action.tags, poseText: action.text, canonical: { imageId: face, source: "card" } }, 1, userId);
        };
        if (!inlayCutin(pictures, state, c, userId, own)) own();
        continue;
      }
      // A card character's own figure (play.ts): its cut-in is drawn from it.
      if (isFigureArtKey(c.art)) {
        const looks = state.meta?.looks?.[c.id];
        const dna = { id: c.id, name: c.name, tags: "", description: looks ? `${c.name}: ${looks}` : c.name, seed: seedOf(c.art), ...(looks ? { booru: looks } : {}) };
        const drawn = art.whenDone(c.art, userId);
        const own = () => void drawn.then((f) => f.state === "ready" && f.imageId && requestCutins(art, state, c, dna, f.imageId, userId, false));
        const viaInlay = inlayCutin(pictures, state, c, userId, own);
        void drawn.then((figure) => {
          if (figure.state === "ready" && figure.imageId) requestCutins(art, state, c, dna, figure.imageId, userId, viaInlay);
        });
        continue;
      }
      const cls = CLASSES[c.defId] ?? CLASSES[c.defId.split("~")[0]!] ?? state.meta?.classes?.[c.defId];
      if (cls) {
        const dna = dnaFromClass(cls, { id: c.id, name: c.name, seed: seedOf(c.art) });
        art.request(c.art, { kind: "portrait", character: dna }, 1, userId);
        // The signature cut-in's face: the same character, determined, drawn
        // from the portrait (V5 inset, else GPT edit, else a DNA redraw).
        void art.whenDone(c.art, userId).then((portrait) => {
          if (portrait.state === "ready" && portrait.imageId) requestCutins(art, state, c, dna, portrait.imageId, userId, false);
        });
      }
    }
  }
}
