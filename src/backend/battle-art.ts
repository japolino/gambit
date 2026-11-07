/**
 * Ask the art pipeline for everything a battle shows: enemies first (P0),
 * party portraits next (P1), and a boss's second phase as an edit of its
 * first once that exists (P1). Keys match `Combatant.art`, so the stage can
 * swap a placeholder for the real image as soon as it lands.
 */
import type { ArtApi } from "../art/controller.js";
import { dnaFromClass, monsterBrief, type MonsterBrief } from "../art/specs.js";
import { CLASSES, MONSTERS } from "../engine/content/index.js";
import type { BattleState } from "../engine/types.js";
import { cutinArtKey } from "../shared/art-keys.js";

const seedOf = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

export function requestBattleArt(art: ArtApi, state: BattleState, userId: string): void {
  for (const c of state.combatants) {
    if (c.side === "enemy") {
      const def = state.meta?.monsters?.[c.defId] ?? MONSTERS[c.defId];
      if (def) {
        art.request(c.art, { kind: "monster", monster: monsterBrief(def) }, 0, userId);
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
      if (state.meta?.faces?.[c.id]) continue;
      const cls = CLASSES[c.defId] ?? CLASSES[c.defId.split("~")[0]!];
      if (cls) {
        const dna = dnaFromClass(cls, { id: c.id, name: c.name, seed: seedOf(c.art) });
        art.request(c.art, { kind: "portrait", character: dna }, 1, userId);
        // The signature cut-in's face: the same character, determined, drawn
        // from the portrait (V5 inset, else GPT edit, else a DNA redraw).
        void art.whenDone(c.art, userId).then((portrait) => {
          if (portrait.state === "ready" && portrait.imageId) {
            art.request(cutinArtKey(c.art), { kind: "expression", character: dna, expression: "determined", canonical: { imageId: portrait.imageId } }, 2, userId);
          }
        });
      }
    }
  }
}
