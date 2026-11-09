/**
 * Storybook battle: the pictures (multi-path SVG on the scene theme's shared defs: gilt, silk, brocade,
 * mahogany, vellum). Each returns a whole <svg> (./defs.ts picture) ready to rasterise for Pixi; none
 * carries text. The scene's own pieces (dialogue page, name scroll, ribbon, medallion, corners, skirt,
 * nameplate caps) are reused as they are; the arch, the phial glass, the coin bezel and the gauge are
 * drawn here in the same hand.
 */
import { DLG_PAD, PLATE_BAND, ROSE, cornerFlourish, dialogueFrame, medallion, nameScroll, plateCap, ribbon, skirt, waxSeal, SCROLL_BAND, SCROLL_END, NIB } from "../../../scene/themes/storybook/art.js";
import { parchment } from "../../../scene/themes/storybook/textures.js";
import { inner, picture } from "./defs.js";

const f = (n: number) => +n.toFixed(1);
const use = (id: string, x: number, y: number, rot = 0, s = 1, flip = false) =>
  `<use href="#${id}" transform="translate(${x},${y}) rotate(${rot}) scale(${s},${flip ? -s : s})"/>`;

/* ------------------------------------------------------------------ */
/* The party's arches (a cameo with no picture: Pixi puts the bust in) */
/* ------------------------------------------------------------------ */

/** The arch's viewBox: x -10..250, y -26..374 (260×400). */
export const ARCH_VB = { x: -10, y: -26, w: 260, h: 400 };
/** The window (where the bust shows), in viewBox units, as an outline Pixi can trace. */
export const ARCH_WIN = { x0: 36, x1: 204, top: 32, spring: 124, bottom: 372 };
const OUTER = "M18,372 V122 C18,50 68,14 120,14 C172,14 222,50 222,122 V372 Z";
const WIN = "M36,372 V124 C36,64 78,32 120,32 C162,32 204,64 204,124 V372 Z";
const BEAD = "M41,372 V125 C41,68 81,37 120,37 C159,37 199,68 199,125 V372";

/** Behind the bust: the velvet niche, warm at the top, with a soft lamp glow. */
export function archBack(enemyTint = false): string {
  const body = `<radialGradient id="sbx-niche" cx=".5" cy=".3" r=".75"><stop offset="0" stop-color="${enemyTint ? "#5a2418" : "#5a3418"}"/><stop offset=".55" stop-color="#2a140a"/><stop offset="1" stop-color="#0e0604"/></radialGradient>
    <path d="${WIN}" fill="url(#sbx-niche)"/>`;
  return picture(`${ARCH_VB.x} ${ARCH_VB.y} ${ARCH_VB.w} ${ARCH_VB.h}`, body);
}

/** In front of the bust: the gilt arch with its window cut out, beads, inner burn, crest and volutes. */
export function archFront(): string {
  const body = `<clipPath id="sbx-aw"><path d="${WIN}"/></clipPath>
  <g filter="url(#sb-deep)">
    <path d="${OUTER} ${WIN}" fill-rule="evenodd" fill="url(#sb-gold-d)" stroke="#3a1a08" stroke-width="1.5" filter="url(#sb-bevel)"/>
    <path d="M26,372 V123 C26,58 72,22 120,22 C168,22 214,58 214,123 V372" fill="none" stroke="#6e481f" stroke-width="1.2"/>
  </g>
  <g clip-path="url(#sbx-aw)">
    <path d="${WIN}" fill="none" stroke="#120703" stroke-width="34" opacity=".72" filter="url(#sb-burn)" transform="translate(0,6)"/>
    <path d="M36,32 L204,32 L36,180 Z" fill="#ffd79a" opacity=".06"/>
  </g>
  <path d="${WIN}" fill="none" stroke="#2a1205" stroke-width="2.4"/>
  <path d="${BEAD}" fill="none" stroke="#f3d791" stroke-width="3" stroke-dasharray=".1 7" stroke-linecap="round" opacity=".9"/>
  <g filter="url(#sb-drop)"><g filter="url(#sb-bevel)">
    ${use("sb-leafA", 116, 8, 200, 0.62)}${use("sb-leafA", 124, 8, -20, 0.62, true)}
    ${use("sb-leafA", 114, 12, 236, 0.42, true)}${use("sb-leafA", 126, 12, -56, 0.42)}
    ${use("sb-curl", 104, -2, 220, 0.5)}${use("sb-curl", 136, -2, -40, 0.5)}
    ${use("sb-rosette", 120, 6, 0, 1.25)}
    ${use("sb-curl", 10, 250, 70, 0.6)}${use("sb-curl", 230, 250, 110, 0.6)}
    ${use("sb-leafA", 14, 150, 80, 0.46)}${use("sb-leafA", 226, 150, 100, 0.46, true)}
  </g></g>`;
  return picture(`${ARCH_VB.x} ${ARCH_VB.y} ${ARCH_VB.w} ${ARCH_VB.h}`, body);
}

/** The halo behind the one acting now: gilt rays fanning from the arch's crown. */
export function halo(): string {
  const rays = Array.from({ length: 26 }, (_, i) => {
    const a = (-180 + (i + 0.5) * (180 / 26)) * (Math.PI / 180);
    const w = 0.03;
    const r0 = 30, r1 = 140;
    const p = (ang: number, r: number) => `${f(150 + Math.cos(ang) * r)},${f(160 + Math.sin(ang) * r)}`;
    return `<path d="M${p(a - w * 0.3, r0)} L${p(a - w, r1)} L${p(a + w, r1)} L${p(a + w * 0.3, r0)} Z" opacity="${i % 2 ? 0.5 : 1}"/>`;
  }).join("");
  const body = `<radialGradient id="sbx-halo" cx=".5" cy=".53" r=".5"><stop offset="0" stop-color="#fff4cc" stop-opacity="1"/><stop offset=".4" stop-color="#ffd76e" stop-opacity=".55"/><stop offset="1" stop-color="#ffb43c" stop-opacity="0"/></radialGradient>
    <radialGradient id="sbx-fade" cx=".5" cy=".53" r=".47"><stop offset=".35" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>
    <mask id="sbx-hm"><rect width="300" height="300" fill="url(#sbx-fade)"/></mask>
    <circle cx="150" cy="160" r="148" fill="url(#sbx-halo)"/>
    <g fill="#fff6d2" opacity=".9" mask="url(#sbx-hm)">${rays}</g>`;
  return picture("0 0 300 300", body);
}

/* ------------------------------------------------------------------ */
/* The name scroll, the target diamond, phials, pips, seals            */
/* ------------------------------------------------------------------ */

/** The crimson name scroll (200×72 viewBox, the name set over it by Pixi). */
export function scroll(kind: "talk" | "fight" = "talk"): string {
  let s = inner(nameScroll("", 15, false, "x"));
  if (kind === "fight") s = s.replace(/url\(#sb-pat-talk\)/g, "url(#sb-pat-fight)");
  return picture("0 -18 200 72", s);
}

/** The "choose me" diamond perched on a scroll (100×36, no label). */
export function diamond(): string {
  const body = `<path d="M50,2 L96,18 L50,34 L4,18 Z" fill="#000" opacity=".5" transform="translate(0,3)" filter="url(#sb-soft)"/>
    <path d="M50,2 L96,18 L50,34 L4,18 Z" fill="url(#sb-plaque)" stroke="url(#sb-gold-h)" stroke-width="2.4"/>
    <path d="M50,6.5 L86,18 L50,29.5 L14,18 Z" fill="none" stroke="#a8742f" stroke-width=".8"/>
    <circle cx="10" cy="18" r="2" fill="url(#sb-berry)"/><circle cx="90" cy="18" r="2" fill="url(#sb-berry)"/>`;
  return picture("0 0 100 38", body);
}

/** The brass vitals plate across an arch's foot (200×44): a crimson enamel half for vigour, a sapphire half for focus. */
export function vitalPlate(): string {
  const body = `<radialGradient id="sbx-ruby" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#8e2a26"/><stop offset=".6" stop-color="#4e0d0e"/><stop offset="1" stop-color="#260405"/></radialGradient>
    <radialGradient id="sbx-saph" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#2b4a86"/><stop offset=".6" stop-color="#132552"/><stop offset="1" stop-color="#070f28"/></radialGradient>
    <g filter="url(#sb-drop)">
      <path d="M14,2 H186 C194,2 198,8 198,14 V30 C198,36 194,42 186,42 H14 C6,42 2,36 2,30 V14 C2,8 6,2 14,2 Z" fill="url(#sb-gold)" stroke="#3a1a08" stroke-width="1.2" filter="url(#sb-bevel)"/>
      <path d="M15,7 H97 V37 H15 C10,37 7,34 7,29 V15 C7,10 10,7 15,7 Z" fill="url(#sbx-ruby)" stroke="#2a0606" stroke-width="1"/>
      <path d="M103,7 H185 C190,7 193,10 193,15 V29 C193,34 190,37 185,37 H103 Z" fill="url(#sbx-saph)" stroke="#060a1a" stroke-width="1"/>
      <path d="M15,9 H95 M105,9 H185" stroke="#fff" stroke-width="1" opacity=".18"/>
      <path d="M100,4 L105,22 L100,40 L95,22 Z" fill="url(#sb-gold-h)" stroke="#3a1a08" stroke-width=".8"/>
      <circle cx="100" cy="22" r="3" fill="url(#sb-coral)" stroke="#5a2a10" stroke-width=".6"/>
      ${[[10, 5], [190, 5], [10, 39], [190, 39]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#fff1c2"/>`).join("")}
    </g>`;
  return picture("0 0 200 44", body);
}

/** A phial's glass, stopper and highlight, with no draught (Pixi pours it): 40×48 viewBox centred on 0. */
export const PHIAL_PATH = "M-4,-14 V-7 C-12,-4 -15,3 -15,8 C-15,16 -8,20 0,20 C8,20 15,16 15,8 C15,3 12,-4 4,-7 V-14 Z";
export function phialGlass(): string {
  const body = `<path d="${PHIAL_PATH}" fill="url(#sb-glass)" stroke="#f6e6c4" stroke-width="1.2"/>
    <rect x="-6" y="-19" width="12" height="6" rx="1.5" fill="url(#sb-gold)" stroke="#4c2a0e" stroke-width=".8"/>
    <path d="M-9,4 C-9,-1 -6,-3 -4,-4" fill="none" stroke="#fff" stroke-width="1.4" opacity=".6" stroke-linecap="round"/>
    <path d="M6,14 C9,12 10,9 10,7" fill="none" stroke="#fff" stroke-width=".9" opacity=".35" stroke-linecap="round"/>`;
  return picture("-20 -22 40 46", body);
}
/** The dark inside of an empty phial, under the draught. */
export function phialShadow(): string {
  return picture("-20 -22 40 46", `<g filter="url(#sb-drop)"><path d="${PHIAL_PATH}" fill="#1b0b0e" fill-opacity=".7"/></g>`);
}

/** A class-resource pip: a gilt rosette when full, an inked ring when spent. */
export function pip(on: boolean): string {
  const body = on
    ? `<g filter="url(#sb-drop)">${use("sb-rosette", 0, 0, 0, 0.5)}</g>`
    : `<circle r="9" fill="#e6d3ab" fill-opacity=".35" stroke="#8a5a2a" stroke-width="1.2" stroke-dasharray="2 1.8"/><circle r="3" fill="#8a5a2a" opacity=".45"/>`;
  return picture("-15 -15 30 30", body);
}

/** A blank wax seal (statuses wear their glyph on it). */
export function seal(): string {
  return picture("0 0 64 64", inner(waxSeal("")));
}

/* ------------------------------------------------------------------ */
/* The book: page, skirt, corners, nameplate                           */
/* ------------------------------------------------------------------ */

/** The dialogue page at w×h (the art overhangs by DLG_PAD): cradle, vellum, gilt. */
export function page(w: number, h: number): { svg: string; pad: typeof DLG_PAD } {
  const { back, front, page: path } = dialogueFrame(w, h);
  const { x: M, top: T, bottom: B } = DLG_PAD;
  const body = `${inner(back)}
    <clipPath id="sbx-vellum"><path d="${path}"/></clipPath>
    <image href="${parchment()}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" clip-path="url(#sbx-vellum)"/>
    ${inner(front)}`;
  return { svg: picture(`${-M} ${-T} ${w + 2 * M} ${h + T + B}`, body), pad: DLG_PAD };
}

export function skirtArt(w: number, h: number, x0: number, x1: number): string {
  return picture(`0 0 ${w} ${h}`, inner(skirt(w, h, x0, x1)));
}

export function corner(): string {
  return picture("0 0 380 260", inner(cornerFlourish()));
}

/** The brass nameplate (w×52 viewBox units): filigree caps and a dark enamel band. */
export function nameplate(w: number): string {
  const band = inner(PLATE_BAND);
  const body = `<svg x="0" y="0" width="46" height="52" viewBox="0 0 46 52" preserveAspectRatio="none" overflow="visible">${inner(plateCap(false))}</svg>
    <svg x="45" y="0" width="${f(w - 90)}" height="52" viewBox="0 0 100 52" preserveAspectRatio="none">${band}</svg>
    <svg x="${f(w - 46)}" y="0" width="46" height="52" viewBox="0 0 46 52" preserveAspectRatio="none" overflow="visible">${inner(plateCap(true))}</svg>`;
  return picture(`-8 0 ${w + 16} 52`, body);
}

/* ------------------------------------------------------------------ */
/* Skills: ribbons and medallions                                      */
/* ------------------------------------------------------------------ */

/** A choice ribbon's cloth in silk or brocade (360×50, stretched). */
export function ribbonArt(pat: string): string {
  return picture("0 0 360 50", inner(ribbon(pat)), 'preserveAspectRatio="none"');
}

/** Skill emblems for the medallions, drawn like the scene's icons (24×24, stroked). */
export const SKILL_ICONS: Record<string, string> = {
  sword: `<path d="M4,20 L15,9 M15,9 L19,3 L21,5 L15,9 Z"/><path d="M6,14 L10,18 M3,21 L5,19"/>`,
  shield: `<path d="M12,2.5 L20,5.5 V11 C20,16 16.5,19.5 12,21.5 C7.5,19.5 4,16 4,11 V5.5Z"/><path d="M12,6 V18 M7,10 H17"/>`,
  heart: `<path d="M12,20 C4,14 2.5,9.5 4.5,6.5 C6.5,3.5 10.5,4 12,7.5 C13.5,4 17.5,3.5 19.5,6.5 C21.5,9.5 20,14 12,20Z"/>`,
  spark: `<path d="M12,2 L13.8,9.6 L21,12 L13.8,14.4 L12,22 L10.2,14.4 L3,12 L10.2,9.6Z"/>`,
  star: `<path d="M12,2.5 L14.8,8.6 L21.5,9.3 L16.5,13.8 L18,20.4 L12,17 L6,20.4 L7.5,13.8 L2.5,9.3 L9.2,8.6Z"/>`,
  wave: `<path d="M2,14 C5,10 8,10 11,14 C14,18 17,18 22,13"/><path d="M2,9 C5,5 8,5 11,9 C14,13 17,13 22,8"/>`,
  eye: `<path d="M2,12 C6,5.5 18,5.5 22,12 C18,18.5 6,18.5 2,12Z"/><circle cx="12" cy="12" r="3.4"/>`,
  back: `<path d="M10,5 L3,12 L10,19 M3,12 H15 C18.5,12 21,14.5 21,18"/>`,
  check: `<path d="M4,12.5 L9.5,18 L20,6"/>`,
  talk: `<path d="M5,5 H18 A3,3 0 0 1 21,8 V13 A3,3 0 0 1 18,16 H11 L6.5,20 V16 H5 A3,3 0 0 1 2,13 V8 A3,3 0 0 1 5,5Z"/>`,
};

/** A brass medallion with an emblem on enamel (52×52). */
export function medal(icon: string): string {
  // The scene's medallion, its icon swapped for ours.
  const base = inner(medallion("search", null, "x"));
  const at = base.indexOf('<g transform="translate(14,14)"');
  const close = base.indexOf("</g>", at) + 4;
  const g = `<g transform="translate(14,14)" fill="none" stroke="#f6dc98" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${SKILL_ICONS[icon] ?? SKILL_ICONS.sword}</g>`;
  return picture("0 0 52 52", at >= 0 ? base.slice(0, at) + g + base.slice(close) : base);
}

/* ------------------------------------------------------------------ */
/* Turn order: the astrolabe bezel, coins and the parchment scroll     */
/* ------------------------------------------------------------------ */

/** A brass bezel ring (100×100) with degree ticks and an open centre (radius 34) for a face. */
export function bezel(kind: "now" | "ally" | "enemy"): string {
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const t = (i / 60) * Math.PI * 2;
    const r0 = i % 5 ? 44 : 41.5;
    return `<line x1="${f(50 + Math.cos(t) * r0)}" y1="${f(50 + Math.sin(t) * r0)}" x2="${f(50 + Math.cos(t) * 47)}" y2="${f(50 + Math.sin(t) * 47)}"/>`;
  }).join("");
  const enamel = kind === "enemy" ? "#8c1a1c" : kind === "ally" ? "#1d2f6b" : "#3a1a08";
  const body = `<g filter="url(#sb-deep)">
    <path d="M50,1 A49,49 0 1 1 49.9,1 Z M50,16 A34,34 0 1 0 50.1,16 Z" fill-rule="evenodd" fill="url(#sb-gold)" stroke="#3a1a08" stroke-width="1.3" filter="url(#sb-bevel)"/>
    ${kind === "now" ? `<g stroke="#4c2a0e" stroke-width="1">${ticks}</g>` : `<circle cx="50" cy="50" r="42" fill="none" stroke="${enamel}" stroke-width="7"/><circle cx="50" cy="50" r="42" fill="none" stroke="#fff1c2" stroke-width=".8" stroke-dasharray=".1 4.2" stroke-linecap="round"/>`}
    <circle cx="50" cy="50" r="36.2" fill="none" stroke="#5a3816" stroke-width="3.4"/>
    <circle cx="50" cy="50" r="34.6" fill="none" stroke="#fff1c2" stroke-width=".9" opacity=".8"/>
    <path d="M26,22 A34,34 0 0 1 60,15" fill="none" stroke="#fff" stroke-width="2" opacity=".3" stroke-linecap="round"/>
    ${kind === "now" ? `<path d="M50,0 L54,8 L50,16 L46,8 Z" fill="url(#sb-coral)" stroke="#5a2a10" stroke-width=".7"/>` : ""}
  </g>
  <circle cx="50" cy="50" r="34" fill="none" stroke="#000" stroke-width="7" opacity=".45" filter="url(#sb-soft)"/>`;
  return picture("0 0 100 100", body);
}

/** A heraldic crest for the order of turns: a round-bottomed gilt shield for the party, a pointed iron one for foes. */
export const CREST = {
  ally: { outer: "M4,4 H76 V52 C76,79 57,93 40,99 C23,93 4,79 4,52 Z", inner: "M13,13 H67 V51 C67,72 53,83 40,88 C27,83 13,72 13,51 Z" },
  enemy: { outer: "M4,11 Q22,2 40,2 Q58,2 76,11 V50 L40,99 L4,50 Z", inner: "M13,18 Q26,11 40,11 Q54,11 67,18 V48 L40,84 L13,48 Z" },
};
export function crest(kind: "ally" | "enemy"): string {
  const c = CREST[kind];
  const ally = kind === "ally";
  const rivets = ally
    ? `<g fill="#fff1c2" opacity=".85"><circle cx="8.5" cy="8.5" r="1.3"/><circle cx="71.5" cy="8.5" r="1.3"/><circle cx="40" cy="94" r="1.3"/></g>`
    : `<g fill="url(#sb-gold)" stroke="#2a1205" stroke-width=".5"><circle cx="9" cy="14" r="2"/><circle cx="71" cy="14" r="2"/><circle cx="40" cy="92" r="2"/></g>`;
  const body = `<g filter="url(#sb-deep)">
    <path d="${c.outer} ${c.inner}" fill-rule="evenodd" fill="${ally ? "url(#sb-gold)" : "#2c2624"}" stroke="#1a0904" stroke-width="1.4"/>
    <path d="${c.inner}" fill="none" stroke="${ally ? "#f3d078" : "#a62626"}" stroke-width="3.2"/>
    <path d="${c.inner}" fill="none" stroke="${ally ? "#5a3816" : "#d4a24a"}" stroke-width=".8"/>
    ${rivets}
  </g>`;
  return picture("0 0 80 100", body);
}

/** The parchment scroll band and its rolled end (from the chapter header). */
export function scrollBand(): string {
  return picture("0 0 400 100", inner(SCROLL_BAND), 'preserveAspectRatio="none"');
}
export function scrollEnd(): string {
  return picture("0 0 40 110", inner(SCROLL_END), 'preserveAspectRatio="none"');
}

/* ------------------------------------------------------------------ */
/* The enemy gauge, the drop cap tile, the nib                         */
/* ------------------------------------------------------------------ */

/** A gilt-framed gauge (200×22, stretched) with an empty trough; Pixi fills it. */
export function gauge(): string {
  const body = `<path d="M10,3 H190 L198,11 L190,19 H10 L2,11 Z" fill="#000" opacity=".5" transform="translate(0,2)" filter="url(#sb-soft)"/>
    <path d="M10,3 H190 L198,11 L190,19 H10 L2,11 Z" fill="url(#sb-gold)" stroke="#3a1a08" stroke-width="1"/>
    <path d="M12,7 H188 L192,11 L188,15 H12 L8,11 Z" fill="#1b0b0e"/>
    <path d="M10,4.5 H190" stroke="#fff2c8" stroke-width=".7" opacity=".6"/>`;
  return picture("0 0 200 22", body, 'preserveAspectRatio="none"');
}

/** The woodcut drop-cap tile, without its letter (64×64). */
export function capTile(): string {
  const body = `<g filter="url(#sb-drop)">
    <rect x="1" y="1" width="62" height="62" fill="url(#sb-gold)" stroke="#3a1a08" stroke-width="1.2" filter="url(#sb-bevel)"/>
    <rect x="5" y="5" width="54" height="54" fill="#6a1418" stroke="#2a0606" stroke-width="1"/>
    <path d="M8,56 C14,44 10,30 18,20 C24,12 34,10 40,8 M56,8 C50,20 54,34 46,44 C40,52 30,54 24,56" fill="none" stroke="#c98f3a" stroke-width="1.4" opacity=".8"/>
    ${[[14, 40], [20, 18], [50, 24], [44, 48], [32, 9], [32, 55]].map(([x, y], i) => `<path d="M0,0 C3,-5 9,-5 11,0 C9,5 3,5 0,0Z" transform="translate(${x},${y}) rotate(${i * 60})" fill="#d9a04a" opacity=".85"/>`).join("")}
    <rect x="5" y="5" width="54" height="54" fill="none" stroke="#f3d791" stroke-width=".8" stroke-dasharray=".1 3.4" stroke-linecap="round"/>
  </g>`;
  return picture("0 0 64 64", body);
}

export function nib(): string {
  return picture("0 0 40 40", inner(NIB));
}

/** The compass rose face only, for the target ring under a chosen enemy (a brass ring on the floor). */
export function floorRing(): string {
  const ticks = Array.from({ length: 48 }, (_, i) => {
    const t = (i / 48) * Math.PI * 2;
    const r0 = i % 4 ? 88 : 82;
    return `<line x1="${f(100 + Math.cos(t) * r0)}" y1="${f(100 + Math.sin(t) * r0)}" x2="${f(100 + Math.cos(t) * 94)}" y2="${f(100 + Math.sin(t) * 94)}"/>`;
  }).join("");
  const body = `<circle cx="100" cy="100" r="96" fill="none" stroke="url(#sb-gold-h)" stroke-width="5"/>
    <circle cx="100" cy="100" r="78" fill="none" stroke="url(#sb-gold-h)" stroke-width="2"/>
    <g stroke="#ffe7b0" stroke-width="1.6" opacity=".9">${ticks}</g>
    ${[0, 90, 180, 270].map((a) => `<path d="M100,4 L106,18 L100,30 L94,18 Z" transform="rotate(${a} 100 100)" fill="url(#sb-coral)" stroke="#5a2a10" stroke-width=".8"/>`).join("")}`;
  return picture("0 0 200 200", body);
}

export { ROSE };
