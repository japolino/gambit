/**
 * Starter bestiary for the Saltreach slice (docs/DESIGN.md, 2 and 11).
 * Built from the same effect language as the classes. Visual briefs feed
 * the art pipeline; rig kinds tell the stage how each figure moves.
 */
import type { MonsterDef } from "../types.js";

export const DROWNED_THRALL: MonsterDef = {
  id: "drowned_thrall", name: "Drowned Thrall", level: 5, hp: 225, focus: 0,
  stats: { might: 30, spirit: 5, guard: 14, will: 8, speed: 11, luck: 4 },
  affinities: { storm: 2, water: 0.5, fire: 0.5 },
  poise: 4, ai: "brute", talks: false, morale: 40,
  attack: { id: "thrall_claw", name: "Waterlogged Claw", target: "enemy", tier: 0, atoms: [{ op: "hit", element: "physical", scale: "might", power: "auto" }] },
  skills: [
    {
      id: "thrall_drag", name: "Grasping Drag", target: "enemy", tier: 1,
      atoms: [{ op: "hit", element: "physical", scale: "might", power: "auto", weight: 0.6 }, { op: "status", status: "slow", chance: "auto", weight: 0.4 }],
      cost: { cooldown: 2 },
    },
  ],
  visual: { brief: "bloated drowned dockhand, barnacles on grey skin, kelp in its hair, rope still knotted at the wrist, milky eyes", palette: "#2b3a3a,#6f8f86,#c9d3c4", rig: "standing" },
};

export const HEXED_HOUND: MonsterDef = {
  id: "hexed_hound", name: "Hexed Hound", level: 5, hp: 150, focus: 0,
  stats: { might: 29, spirit: 7, guard: 9, will: 7, speed: 20, luck: 12 },
  affinities: { fire: 2, shadow: 0.5 },
  poise: 3, ai: "assassin", talks: false, morale: 50,
  attack: { id: "hound_bite", name: "Bite", target: "enemy", tier: 0, atoms: [{ op: "hit", element: "physical", scale: "might", power: "auto" }] },
  skills: [
    {
      id: "hound_rend", name: "Rend", target: "enemy", tier: 1, cost: { cooldown: 1 },
      atoms: [{ op: "hit", element: "physical", scale: "might", power: "auto", weight: 0.55 }, { op: "status", status: "bleed", stacks: 2, chance: "auto", weight: 0.45 }],
    },
  ],
  visual: { brief: "gaunt black hound with burn-scar sigils glowing along its ribs, too many teeth, smoke from its jaws", palette: "#151315,#b8452f,#d8c6b5", rig: "standing" },
};

export const SALTWRAITH: MonsterDef = {
  id: "saltwraith", name: "Saltwraith", level: 5, hp: 130, focus: 30,
  stats: { might: 7, spirit: 25, guard: 7, will: 16, speed: 15, luck: 8 },
  affinities: { physical: 0.75, light: 2, water: -1 },
  poise: 3, ai: "caster", talks: true, morale: 60,
  attack: { id: "wraith_touch", name: "Salt Touch", target: "enemy", tier: 0, atoms: [{ op: "hit", element: "water", scale: "spirit", power: "auto" }] },
  skills: [
    {
      id: "wraith_wail", name: "Brine Wail", target: "all_enemies", tier: 2, cost: { cooldown: 3 },
      atoms: [{ op: "hit", element: "shadow", scale: "spirit", power: "auto", weight: 0.45 }, { op: "status", status: "fear", chance: "auto", weight: 0.55 }],
    },
    {
      id: "wraith_curse", name: "Brine Curse", target: "enemy", tier: 1, cost: { cooldown: 1 },
      atoms: [{ op: "status", status: "weaken", chance: "auto" }],
    },
  ],
  visual: { brief: "translucent drowned woman made of crusted salt and seawater, veil of brine, hollow mouth, hem dissolving into mist", palette: "#16252c,#9fc7c9,#f0f1ea", rig: "floating" },
};

export const LANTERN_MOTH: MonsterDef = {
  id: "lantern_moth", name: "Lantern Moth", level: 5, hp: 110, focus: 20,
  stats: { might: 10, spirit: 20, guard: 8, will: 12, speed: 17, luck: 10 },
  affinities: { fire: 2, storm: 2 },
  poise: 2, ai: "support", talks: false, morale: 30,
  attack: { id: "moth_flutter", name: "Dust Flutter", target: "enemy", tier: 0, atoms: [{ op: "hit", element: "light", scale: "spirit", power: "auto" }] },
  skills: [
    { id: "moth_lure", name: "Lure Light", target: "all_allies", tier: 2, cost: { cooldown: 3 }, atoms: [{ op: "status", status: "regen", chance: "auto" }] },
    { id: "moth_dazzle", name: "Dazzle", target: "enemy", tier: 1, cost: { cooldown: 1 }, atoms: [{ op: "status", status: "slow", chance: "auto" }] },
  ],
  visual: { brief: "huge moth with paper-lantern wings lit from within, dusty gold scales, long feathered antennae", palette: "#1c1712,#e2b45a,#f6ecd2", rig: "floating" },
};

export const REEF_SERPENT: MonsterDef = {
  id: "reef_serpent", name: "Reef Serpent", level: 6, hp: 280, focus: 0,
  stats: { might: 32, spirit: 7, guard: 13, will: 9, speed: 12, luck: 6 },
  affinities: { earth: 2, water: 0, storm: 1.5 },
  poise: 5, ai: "brute", talks: false, morale: 60,
  attack: { id: "serpent_crush", name: "Crush", target: "enemy", tier: 0, atoms: [{ op: "hit", element: "physical", scale: "might", power: "auto" }] },
  skills: [
    {
      id: "serpent_coil", name: "Coil", target: "enemy", tier: 2, cost: { cooldown: 3 },
      atoms: [{ op: "hit", element: "physical", scale: "might", power: "auto", weight: 0.65 }, { op: "status", status: "stun", chance: "auto", weight: 0.35 }],
    },
    { id: "serpent_sweep", name: "Tail Sweep", target: "all_enemies", tier: 2, cost: { cooldown: 2 }, atoms: [{ op: "hit", element: "physical", scale: "might", power: "auto" }] },
  ],
  visual: { brief: "long reef serpent with coral growing through its scales, frilled head, bioluminescent spots", palette: "#0f1e24,#d0735a,#9ed8cf", rig: "serpentine" },
};

export const ASH_SERGEANT: MonsterDef = {
  id: "ash_sergeant", name: "Ash Guard Sergeant", level: 6, hp: 250, focus: 20,
  stats: { might: 31, spirit: 10, guard: 17, will: 11, speed: 11, luck: 8 },
  affinities: { frost: 2, fire: 0.5 },
  poise: 5, ai: "brute", talks: true, morale: 70,
  attack: { id: "sergeant_halberd", name: "Halberd Thrust", target: "enemy", tier: 0, atoms: [{ op: "hit", element: "physical", scale: "might", power: "auto", pierce: 0.2 }] },
  skills: [
    { id: "sergeant_rally", name: "Rally", target: "all_allies", tier: 2, cost: { cooldown: 4 }, atoms: [{ op: "status", status: "haste", chance: "auto" }] },
    { id: "sergeant_cleave", name: "Cleave", target: "all_enemies", tier: 2, cost: { cooldown: 2 }, atoms: [{ op: "hit", element: "physical", scale: "might", power: "auto" }] },
  ],
  visual: { brief: "veteran soldier in soot-grey lamellar and an ash-white tabard, salt-iron halberd, burn-scarred jaw", palette: "#1e1d1c,#9b9488,#e4dfd6", rig: "standing" },
};

const ACOLYTE_PHASE2: Omit<MonsterDef, "phase2"> = {
  id: "bell_acolyte_unrung", name: "The Unrung", level: 7, hp: 230, focus: 40,
  stats: { might: 18, spirit: 25, guard: 13, will: 17, speed: 16, luck: 12 },
  affinities: { storm: 2, light: 1.5, water: 0.5 },
  poise: 7, ai: "boss", talks: false, morale: 100,
  attack: { id: "unrung_toll", name: "Dead Toll", target: "enemy", tier: 0, atoms: [{ op: "hit", element: "shadow", scale: "spirit", power: "auto" }] },
  skills: [
    {
      id: "unrung_undertow", name: "Undertow Toll", target: "all_enemies", tier: 4, cost: { cooldown: 2 },
      atoms: [{ op: "hit", element: "water", scale: "spirit", power: "auto", weight: 0.75 }, { op: "delay", amount: "auto", weight: 0.25 }],
    },
    {
      id: "unrung_shatter", name: "Shatter the Bell", target: "enemy", tier: 4, signature: true, cost: { cooldown: 3 },
      atoms: [{ op: "hit", element: "storm", scale: "spirit", power: "auto", weight: 0.7 }, { op: "status", status: "vulnerable", chance: "auto", weight: 0.3 }],
      visual: { cutin: "diagonal_band", fx: ["chromatic_split", "impact_frame", "ink_wash"], palette: "#0c1416,#5fa3a6,#f2efe6" },
    },
  ],
  visual: { brief: "the acolyte split open: a cracked bronze bell where its chest was, drowned hands reaching out of the crack, water pouring upward", palette: "#0c1416,#a8733b,#9fd0cc", rig: "huge" },
};

export const BELL_ACOLYTE: MonsterDef = {
  id: "bell_acolyte", name: "Bell-Drowned Acolyte", level: 6, hp: 270, focus: 40,
  stats: { might: 16, spirit: 22, guard: 14, will: 18, speed: 13, luck: 10 },
  affinities: { storm: 2, light: 2, water: 0.5, shadow: 0.5 },
  poise: 8, ai: "boss", talks: true, morale: 80,
  attack: { id: "acolyte_toll", name: "Bell Toll", target: "enemy", tier: 0, atoms: [{ op: "hit", element: "water", scale: "spirit", power: "auto" }] },
  skills: [
    {
      id: "acolyte_peal", name: "Drowning Peal", target: "all_enemies", tier: 3, cost: { cooldown: 2 },
      atoms: [{ op: "hit", element: "water", scale: "spirit", power: "auto", weight: 0.7 }, { op: "status", status: "slow", chance: "auto", weight: 0.3 }],
    },
    {
      id: "acolyte_hymn", name: "Cracked Hymn", target: "enemy", tier: 3, signature: true, cost: { cooldown: 3 },
      atoms: [{ op: "hit", element: "shadow", scale: "spirit", power: "auto", weight: 0.6 }, { op: "status", status: "fear", chance: "auto", weight: 0.4 }],
      visual: { cutin: "diagonal_band", fx: ["ink_wash", "glyph_ring", "chromatic_split"], palette: "#101a1c,#a8733b,#e9e4d8" },
    },
    { id: "acolyte_choir", name: "Choir of the Drowned", target: "self", tier: 2, cost: { cooldown: 4 }, atoms: [{ op: "status", status: "regen", stacks: 2, chance: 100, weight: 0 }, { op: "shield", power: "auto" }] },
  ],
  visual: { brief: "tall robed acolyte with a bronze bell for a head, robes soaked and dripping, barnacled censer, drowned bell-rope trailing", palette: "#101a1c,#a8733b,#c9d6d0", rig: "standing" },
  phase2: { atHpPct: 35, into: ACOLYTE_PHASE2 },
};

export const MONSTERS: Record<string, MonsterDef> = {
  drowned_thrall: DROWNED_THRALL,
  hexed_hound: HEXED_HOUND,
  saltwraith: SALTWRAITH,
  lantern_moth: LANTERN_MOTH,
  reef_serpent: REEF_SERPENT,
  ash_sergeant: ASH_SERGEANT,
  bell_acolyte: BELL_ACOLYTE,
};
