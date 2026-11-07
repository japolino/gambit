/**
 * The hand-tuned starting classes (docs/DESIGN.md, 4.4). Skills give their
 * shape and weights; the budget solver fills every "auto" at load.
 */
import type { ClassDef } from "../types.js";

export const DUELIST: ClassDef = {
  id: "duelist",
  name: "Duelist",
  base: { hp: 70, focus: 30, might: 14, spirit: 6, guard: 9, will: 7, speed: 16, luck: 12 },
  growth: { hp: 12, focus: 3, might: 2.2, spirit: 0.6, guard: 1.2, will: 0.8, speed: 1, luck: 0.8 },
  resource: { id: "tempo", name: "Tempo", max: 5, start: 0, gain: [{ on: "deal_hit", n: 1 }] },
  passives: [],
  attack: { id: "duelist_cut", name: "Cut", target: "enemy", tier: 0, atoms: [{ op: "hit", element: "physical", scale: "might", power: "auto" }] },
  skills: [
    {
      id: "duelist_riposte", name: "Riposte Stance", flavor: "Blade low, weight back. Come and find out.",
      target: "self", tier: 1, cost: { focus: "auto" }, delay: 0.7,
      atoms: [{ op: "status", status: "guarded", chance: 100, turns: 2 }, { op: "gain", resource: "class", n: "auto", weight: 1 }],
    },
    {
      id: "duelist_flurry", name: "Flurry", flavor: "Three cuts before the first one lands.",
      target: "enemy", tier: 2, cost: { focus: "auto" },
      atoms: [{ op: "hit", element: "physical", scale: "might", power: "auto", hits: 3 }],
    },
    {
      id: "duelist_opening", name: "Find the Opening", flavor: "Every guard has a seam.",
      target: "enemy", tier: 2, cost: { focus: "auto" },
      atoms: [
        { op: "hit", element: "physical", scale: "might", power: "auto", weight: 0.6 },
        { op: "status", status: "vulnerable", chance: "auto", weight: 0.4 },
      ],
    },
    {
      id: "duelist_final_measure", name: "Final Measure", flavor: "All the tempo you built, spent in one bar.",
      target: "enemy", tier: 3, signature: true, cost: { resource: 3, cooldown: 2 },
      atoms: [
        { op: "spend_all_for_power", perStack: "auto", weight: 0.35 },
        { op: "hit", element: "physical", scale: "might", power: "auto", pierce: 0.3, stagger: 2, weight: 0.65 },
      ],
      visual: { cutin: "diagonal_band", fx: ["speed_lines", "impact_frame", "chromatic_split"], palette: "#1a1414,#c8a26a,#f3ede2" },
    },
  ],
  visual: { brief: "lean fencer in a long weathered coat, rapier, half-cape, scarred knuckles", palette: "#2a2320,#c8a26a,#e9e2d4", rig: "standing" },
};

export const WARDEN: ClassDef = {
  id: "warden",
  name: "Warden",
  base: { hp: 95, focus: 25, might: 12, spirit: 7, guard: 15, will: 12, speed: 10, luck: 6 },
  growth: { hp: 16, focus: 2.5, might: 1.8, spirit: 0.8, guard: 2, will: 1.4, speed: 0.6, luck: 0.4 },
  resource: { id: "resolve", name: "Resolve", max: 5, start: 1, gain: [{ on: "take_hit", n: 1 }] },
  passives: [
    { id: "warden_stalwart", name: "Stalwart", text: "When an ally falls, the Warden braces.", on: "ally_falls", atoms: [{ op: "status", status: "guarded", chance: 100, turns: 2 }] },
  ],
  attack: { id: "warden_bash", name: "Shield Bash", target: "enemy", tier: 0, atoms: [{ op: "hit", element: "physical", scale: "might", power: "auto", stagger: 2 }] },
  skills: [
    {
      id: "warden_challenge", name: "Challenge", flavor: "Look at me. Only me.",
      target: "all_enemies", tier: 1, cost: { focus: "auto" },
      atoms: [
        { op: "status", status: "taunt", chance: "auto", weight: 0.7 },
        { op: "status", status: "guarded", chance: 100, turns: 2, self: true, weight: 0 },
      ],
    },
    {
      id: "warden_bulwark", name: "Bulwark", flavor: "The line holds because she does.",
      target: "all_allies", tier: 2, cost: { focus: "auto" },
      atoms: [{ op: "shield", power: "auto" }],
    },
    {
      id: "warden_iron_verdict", name: "Iron Verdict", flavor: "Every blow she absorbed comes back at once.",
      target: "enemy", tier: 3, signature: true, cost: { resource: 3, cooldown: 2 },
      atoms: [
        { op: "hit", element: "physical", scale: "might", power: "auto", stagger: 3, weight: 0.7 },
        { op: "when", if: { kind: "target_broken" }, then: [{ op: "hit", element: "physical", scale: "might", power: "auto" }], weight: 0.3 },
      ],
      visual: { cutin: "diagonal_band", fx: ["impact_frame", "glyph_ring", "speed_lines"], palette: "#141a1f,#8fa3ad,#f1efe9" },
    },
  ],
  visual: { brief: "broad shield-bearer in dented plate and a tabard, tower shield, cropped grey hair", palette: "#1d2328,#8fa3ad,#d9d4c7", rig: "standing" },
};

export const TIDECALLER: ClassDef = {
  id: "tidecaller",
  name: "Tidecaller",
  base: { hp: 75, focus: 40, might: 7, spirit: 15, guard: 9, will: 13, speed: 13, luck: 9 },
  growth: { hp: 11, focus: 4, might: 0.7, spirit: 2.2, guard: 1, will: 1.6, speed: 0.9, luck: 0.6 },
  resource: { id: "tide", name: "Tide", max: 5, start: 1, gain: [{ on: "turn_start", n: 1 }] },
  passives: [],
  attack: { id: "tide_lash", name: "Brine Lash", target: "enemy", tier: 0, atoms: [{ op: "hit", element: "water", scale: "spirit", power: "auto" }] },
  skills: [
    {
      id: "tide_mending", name: "Mending Current", flavor: "The sea gives back, sometimes.",
      target: "lowest_hp_ally", tier: 2, cost: { focus: "auto" },
      atoms: [{ op: "heal", power: "auto", weight: 0.8 }, { op: "cleanse", count: 1 }],
    },
    {
      id: "tide_riptide", name: "Riptide", flavor: "Pulls the floor out from under them.",
      target: "all_enemies", tier: 2, cost: { focus: "auto" },
      atoms: [
        { op: "hit", element: "water", scale: "spirit", power: "auto", weight: 0.7 },
        { op: "delay", amount: "auto", weight: 0.3 },
      ],
    },
    {
      id: "tide_undertow_litany", name: "Undertow Litany", flavor: "She sings the tide backwards, and it remembers who it took.",
      target: "all_enemies", tier: 3, signature: true, cost: { resource: 4, cooldown: 3 },
      atoms: [
        { op: "hit", element: "water", scale: "spirit", power: "auto", weight: 0.6 },
        { op: "delay", amount: "auto", weight: 0.3 },
        { op: "on_break", then: [{ op: "gain", resource: "class", n: "auto" }], weight: 0.1 },
      ],
      visual: { cutin: "diagonal_band", fx: ["ink_wash", "glyph_ring", "speed_lines"], palette: "#1d3b4a,#7fd1c7,#f2efe6" },
    },
  ],
  visual: { brief: "barefoot sea-priestess in salt-stained robes, shell beads, wet dark hair, tidal sigils on her hands", palette: "#13262f,#7fd1c7,#e8efe9", rig: "standing" },
};

export const HEXWRIGHT: ClassDef = {
  id: "hexwright",
  name: "Hexwright",
  base: { hp: 68, focus: 42, might: 6, spirit: 16, guard: 8, will: 12, speed: 14, luck: 10 },
  growth: { hp: 10, focus: 4, might: 0.6, spirit: 2.3, guard: 0.9, will: 1.5, speed: 1, luck: 0.7 },
  resource: { id: "hex", name: "Hex", max: 5, start: 0, gain: [{ on: "apply_status", n: 1 }] },
  passives: [],
  attack: {
    id: "hex_ember", name: "Ember Script", target: "enemy", tier: 0,
    atoms: [{ op: "hit", element: "fire", scale: "spirit", power: "auto", weight: 0.75 }, { op: "status", status: "burn", chance: "auto", weight: 0.25 }],
  },
  skills: [
    {
      id: "hex_witchmark", name: "Witchmark", flavor: "A sigil only the dying can read.",
      target: "enemy", tier: 1, cost: { focus: "auto" },
      atoms: [{ op: "status", status: "mark", chance: 100, weight: 0 }, { op: "status", status: "weaken", chance: "auto" }],
    },
    {
      id: "hex_cinder_rite", name: "Cinder Rite", flavor: "Ash falls up.",
      target: "all_enemies", tier: 2, cost: { focus: "auto" },
      atoms: [{ op: "hit", element: "fire", scale: "spirit", power: "auto", weight: 0.65 }, { op: "status", status: "burn", chance: "auto", weight: 0.35 }],
    },
    {
      id: "hex_frostbind", name: "Frostbind", flavor: "The cold remembers the shape of you.",
      target: "enemy", tier: 2, cost: { focus: "auto" },
      atoms: [{ op: "hit", element: "frost", scale: "spirit", power: "auto", weight: 0.5 }, { op: "status", status: "frost", stacks: 2, chance: "auto", weight: 0.5 }],
    },
    {
      id: "hex_unmaking", name: "Unmaking", flavor: "She reads the mark aloud.",
      target: "enemy", tier: 3, signature: true, cost: { resource: 3, cooldown: 2 },
      atoms: [
        { op: "hit", element: "shadow", scale: "spirit", power: "auto", weight: 0.6 },
        { op: "when", if: { kind: "target_has_status", status: "mark" }, then: [{ op: "hit", element: "shadow", scale: "spirit", power: "auto" }], weight: 0.4 },
      ],
      visual: { cutin: "diagonal_band", fx: ["ember", "glyph_ring", "chromatic_split"], palette: "#1b1020,#c0533a,#efe3d6" },
    },
  ],
  visual: { brief: "gaunt hex-scribe in a soot-black coat, ink-stained fingers, burning script floating around her", palette: "#1b1020,#c0533a,#e6d9cf", rig: "standing" },
};

export const CLASSES: Record<string, ClassDef> = {
  duelist: DUELIST,
  warden: WARDEN,
  tidecaller: TIDECALLER,
  hexwright: HEXWRIGHT,
};
