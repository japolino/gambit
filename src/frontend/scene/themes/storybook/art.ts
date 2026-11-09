/**
 * Storybook: the code-drawn art. Every frame, plate, ribbon and trinket is
 * multi-path SVG built here: gilt acanthus flourishes, the scalloped
 * dialogue frame on its mahogany cradle, the brass nameplate, cameo frames,
 * silk bookmarks, the astrolabe medallion and the icons. Shared gradients,
 * filters and leaf shapes live once in DEFS (one hidden <svg> in the theme
 * root); the pieces reference them by id (all ids start with "sb-").
 */
import { brocade, leather, mahogany, parchment, silk } from "./textures.js";

const f = (n: number) => +n.toFixed(1);

/* ------------------------------------------------------------------ */
/* Shared defs                                                         */
/* ------------------------------------------------------------------ */

/** The acanthus leaf, stem at the origin, pointing +x, about 100×40. */
const LEAF_D =
  "M0,0 C8,-10 22,-16 36,-15 C34,-21 40,-26 49,-24 C49,-30 57,-34 65,-30 C68,-36 78,-37 84,-31 C93,-30 100,-21 97,-13 C94,-19 88,-20 84,-16 C86,-11 82,-6 76,-8 C76,-3 70,0 64,-3 C62,1 54,3 48,0 C44,5 34,6 26,4 C16,6 6,4 0,0 Z";
const LEAF_VEINS = "M2,-1 C22,-8 52,-15 90,-19 M36,-12 L44,-22 M50,-14 L60,-27 M64,-16 L77,-30 M44,-9 L50,-1 M58,-12 L66,-4 M72,-14 L80,-9";
/** A plump curl (the end of a scroll), stem at origin. */
const CURL_D = "M0,0 C4,-16 24,-24 36,-14 C46,-6 42,8 30,9 C21,10 17,1 22,-4 C26,-8 32,-5 31,0 C27,-2 24,1 27,4 C22,6 14,6 10,2 C7,6 3,5 0,0 Z";
const PETAL_D = "M0,0 C5,-8 17,-10 24,0 C17,10 5,8 0,0 Z";

export const DEFS = `<svg class="sb-defs" width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute">
<defs>
  <linearGradient id="sb-gold" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff1c2"/><stop offset=".22" stop-color="#e8c26f"/><stop offset=".46" stop-color="#9c6a2c"/>
    <stop offset=".6" stop-color="#d9ad62"/><stop offset=".78" stop-color="#f6dc98"/><stop offset="1" stop-color="#6e481f"/>
  </linearGradient>
  <linearGradient id="sb-gold-h" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#6e481f"/><stop offset=".25" stop-color="#e2b866"/><stop offset=".5" stop-color="#fff1c2"/>
    <stop offset=".72" stop-color="#b8853b"/><stop offset="1" stop-color="#6e481f"/>
  </linearGradient>
  <linearGradient id="sb-gold-d" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fff3cc"/><stop offset=".3" stop-color="#e3b765"/><stop offset=".55" stop-color="#8f5e25"/>
    <stop offset=".8" stop-color="#d9ad62"/><stop offset="1" stop-color="#5a3816"/>
  </linearGradient>
  <linearGradient id="sb-leaf" x1="0" y1="-1" x2=".9" y2=".6">
    <stop offset="0" stop-color="#fffaea"/><stop offset=".3" stop-color="#f6dc9c"/><stop offset=".62" stop-color="#e0a85c"/><stop offset=".85" stop-color="#c47a3a"/><stop offset="1" stop-color="#8f4a1f"/>
  </linearGradient>
  <linearGradient id="sb-coral" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ffd9bd"/><stop offset=".45" stop-color="#ec8a68"/><stop offset="1" stop-color="#9c3b26"/>
  </linearGradient>
  <linearGradient id="sb-plaque" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#4d2e1c"/><stop offset=".12" stop-color="#3b2316"/><stop offset=".55" stop-color="#170c07"/><stop offset="1" stop-color="#2e1a0f"/>
  </linearGradient>
  <radialGradient id="sb-enamel" cx=".42" cy=".36" r=".7">
    <stop offset="0" stop-color="#4a2a17"/><stop offset=".7" stop-color="#1c0f08"/><stop offset="1" stop-color="#0c0603"/>
  </radialGradient>
  <radialGradient id="sb-berry" cx=".35" cy=".3" r=".7">
    <stop offset="0" stop-color="#fff2c8"/><stop offset=".35" stop-color="#e6a85a"/><stop offset="1" stop-color="#7b3e17"/>
  </radialGradient>
  <radialGradient id="sb-wax" cx=".38" cy=".32" r=".75">
    <stop offset="0" stop-color="#e2574a"/><stop offset=".55" stop-color="#9c1f1c"/><stop offset="1" stop-color="#4c0b0b"/>
  </radialGradient>
  <linearGradient id="sb-fold" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/>
    <stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/>
  </linearGradient>
  <linearGradient id="sb-roll" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#6d4520"/><stop offset=".35" stop-color="#f3dfb2"/><stop offset=".6" stop-color="#d5b47c"/><stop offset="1" stop-color="#5a3517"/>
  </linearGradient>
  <linearGradient id="sb-glass" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#fff" stop-opacity=".05"/><stop offset=".25" stop-color="#fff" stop-opacity=".5"/>
    <stop offset=".4" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity=".18"/>
  </linearGradient>
  <linearGradient id="sb-blood" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ff7a62"/><stop offset=".4" stop-color="#c2242a"/><stop offset="1" stop-color="#5e0a12"/>
  </linearGradient>
  <linearGradient id="sb-silk-shade" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset=".3" stop-color="#fff" stop-opacity=".16"/>
    <stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/>
  </linearGradient>
  <pattern id="sb-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
    <rect width="6" height="6" fill="#d9c49a"/><path d="M0,0 V6" stroke="#7a5a32" stroke-width="1.1" opacity=".55"/>
  </pattern>
  <pattern id="sb-pat-talk" width="64" height="64" patternUnits="userSpaceOnUse"><image href="${brocade("#5a1a1c", "#f0c27a")}" width="64" height="64"/></pattern>
  <pattern id="sb-pat-do" width="256" height="64" patternUnits="userSpaceOnUse"><image href="${silk("#1d2c3c", true, 11)}" width="256" height="64"/></pattern>
  <pattern id="sb-pat-go" width="256" height="64" patternUnits="userSpaceOnUse"><image href="${silk("#1f3326", true, 12)}" width="256" height="64"/></pattern>
  <pattern id="sb-pat-fight" width="64" height="64" patternUnits="userSpaceOnUse"><image href="${brocade("#2a0d0c", "#c4553a", 3)}" width="64" height="64"/></pattern>
  <pattern id="sb-pat-wood" width="512" height="256" patternUnits="userSpaceOnUse"><image href="${mahogany()}" width="512" height="256"/></pattern>
  <pattern id="sb-pat-leather" width="256" height="256" patternUnits="userSpaceOnUse"><image href="${leather()}" width="256" height="256"/></pattern>
  <pattern id="sb-pat-amber" width="64" height="256" patternUnits="userSpaceOnUse"><image href="${silk("#9a5a12", false, 21)}" width="64" height="256"/></pattern>
  <pattern id="sb-pat-crimson" width="64" height="256" patternUnits="userSpaceOnUse"><image href="${silk("#7e1620", false, 22)}" width="64" height="256"/></pattern>
  <pattern id="sb-pat-royal" width="64" height="256" patternUnits="userSpaceOnUse"><image href="${silk("#1d2f6b", false, 23)}" width="64" height="256"/></pattern>
  <pattern id="sb-pat-moss" width="64" height="256" patternUnits="userSpaceOnUse"><image href="${silk("#2f4a22", false, 24)}" width="64" height="256"/></pattern>
  <pattern id="sb-pat-iron" width="64" height="256" patternUnits="userSpaceOnUse"><image href="${silk("#3a3a40", false, 25)}" width="64" height="256"/></pattern>
  <filter id="sb-bevel" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceAlpha" stdDeviation="1.1" result="b"/>
    <feSpecularLighting in="b" surfaceScale="2.6" specularConstant=".95" specularExponent="16" lighting-color="#fff2c8" result="s">
      <feDistantLight azimuth="235" elevation="42"/>
    </feSpecularLighting>
    <feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/>
    <feComposite in="SourceGraphic" in2="s2" operator="arithmetic" k1="0" k2="1" k3=".75" k4="0"/>
  </filter>
  <filter id="sb-drop" x="-20%" y="-20%" width="140%" height="160%">
    <feDropShadow dx="0" dy="2.5" stdDeviation="2.2" flood-color="#160903" flood-opacity=".75"/>
  </filter>
  <filter id="sb-deep" x="-20%" y="-20%" width="140%" height="160%">
    <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#0c0502" flood-opacity=".85"/>
  </filter>
  <filter id="sb-burn" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="14"/></filter>
  <filter id="sb-soft"><feGaussianBlur stdDeviation="2"/></filter>
  <filter id="sb-grade" color-interpolation-filters="sRGB">
    <feColorMatrix type="matrix" values=".98 .14 .03 0 .01  .07 .9 .05 0 0  .04 .1 .72 0 0  0 0 0 1 0"/>
  </filter>
  <g id="sb-leafA">
    <path d="${LEAF_D}" fill="url(#sb-leaf)" stroke="#8c4227" stroke-width="1.15" stroke-linejoin="round"/>
    <path d="${LEAF_VEINS}" fill="none" stroke="#9a4e26" stroke-width=".8" stroke-linecap="round" opacity=".75"/>
    <path d="M6,-3 C20,-11 34,-14 46,-21 C54,-27 62,-28 70,-30" fill="none" stroke="#fff8e4" stroke-width="1.1" stroke-linecap="round" opacity=".8"/>
  </g>
  <g id="sb-curl">
    <path d="${CURL_D}" fill="url(#sb-leaf)" stroke="#8c4227" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M4,-4 C10,-14 22,-18 32,-12" fill="none" stroke="#fff8e4" stroke-width="1" opacity=".75"/>
  </g>
  <g id="sb-petal">
    <path d="${PETAL_D}" fill="url(#sb-coral)" stroke="#7d2a19" stroke-width=".9"/>
    <path d="M3,0 C8,-3 14,-3 19,0" fill="none" stroke="#ffe6d2" stroke-width=".8" opacity=".8"/>
  </g>
  <g id="sb-rosette">
    ${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<use href="#sb-petal" transform="rotate(${a}) translate(4,0) scale(.9)"/>`).join("")}
    ${[22, 112, 202, 292].map((a) => `<path d="M0,0 C3,-5 10,-6 14,0 C10,6 3,5 0,0Z" transform="rotate(${a})" fill="url(#sb-leaf)" stroke="#8c4227" stroke-width=".7"/>`).join("")}
    <circle r="6.2" fill="url(#sb-berry)" stroke="#6b3412" stroke-width=".9"/>
    ${[0, 60, 120, 180, 240, 300].map((a) => `<circle cx="${f(Math.cos((a * Math.PI) / 180) * 3.4)}" cy="${f(Math.sin((a * Math.PI) / 180) * 3.4)}" r=".9" fill="#5a2a0e"/>`).join("")}
  </g>
  <g id="sb-berry-g"><circle r="4" fill="url(#sb-berry)" stroke="#6b3412" stroke-width=".8"/><circle cx="-1.3" cy="-1.4" r="1.1" fill="#fff8e0" opacity=".85"/></g>
  <g id="sb-sprig" fill="currentColor">
    <path d="M60,250 C58,200 66,150 92,104 C110,72 138,52 170,40" fill="none" stroke="currentColor" stroke-width="4"/>
    <path d="M92,104 C70,96 52,78 48,56 C70,60 86,76 92,104Z"/>
    <path d="M78,140 C100,128 124,128 140,140 C120,152 98,152 78,140Z"/>
    <path d="M66,186 C44,176 28,156 26,132 C48,140 62,160 66,186Z"/>
    <path d="M62,222 C84,212 108,214 120,228 C100,238 78,236 62,222Z"/>
    <path d="M118,62 C112,40 118,18 136,6 C142,28 136,48 118,62Z"/>
    <g transform="translate(176,38)">
      ${[0, 51, 103, 154, 206, 257, 309].map((a) => `<path d="M0,0 C8,-14 26,-18 36,0 C26,18 8,14 0,0Z" transform="rotate(${a})"/>`).join("")}
      <circle r="9" fill="none" stroke="currentColor" stroke-width="3"/>
    </g>
    <circle cx="40" cy="90" r="5"/><circle cx="30" cy="104" r="4"/><circle cx="146" cy="110" r="4"/>
  </g>
</defs></svg>`;

/* ------------------------------------------------------------------ */
/* Acanthus corner flourish (the painted-plate corners of the stage)   */
/* ------------------------------------------------------------------ */

const use = (id: string, x: number, y: number, rot = 0, s = 1, flip = false) =>
  `<use href="#${id}" transform="translate(${x},${y}) rotate(${rot}) scale(${s},${flip ? -s : s})"/>`;

/** A gilt stem: dark under-stroke, gold body and a specular hairline. */
const stem = (d: string, w: number) =>
  `<path d="${d}" fill="none" stroke="#3e1b0b" stroke-width="${w + 3}" stroke-linecap="round"/>` +
  `<path d="${d}" fill="none" stroke="url(#sb-gold-d)" stroke-width="${w}" stroke-linecap="round"/>` +
  `<path d="${d}" fill="none" stroke="#fff6d8" stroke-width="${Math.max(0.7, w * 0.22)}" stroke-linecap="round" opacity=".75" transform="translate(-.6,-.8)"/>`;

/**
 * The top-left corner flourish (viewBox 0 0 380 260): two scrolled gilt stems
 * hugging the edges, acanthus leaves along them, a coral rosette at the
 * corner and berries at the tendril tips. Mirror it for the other corners.
 */
export function cornerFlourish(): string {
  const s1 = "M-20,24 C70,2 170,0 238,20 C292,36 312,80 282,102 C258,119 228,104 234,82 C239,65 262,66 266,80";
  const s2 = "M22,-20 C10,50 12,124 34,170 C50,204 84,212 94,192 C102,176 88,162 76,170 C68,176 72,188 80,186";
  const t1 = "M54,36 C96,48 128,70 148,100 C158,116 148,130 136,124";
  const t2 = "M40,60 C54,94 58,120 54,148";
  const t3 = "M150,22 C176,38 196,54 204,74";
  return `<svg viewBox="0 0 380 260" aria-hidden="true" focusable="false"><g filter="url(#sb-deep)"><g filter="url(#sb-bevel)">
    ${stem(t1, 3)}${stem(t2, 3)}${stem(t3, 2.5)}
    ${stem(s1, 7)}${stem(s2, 7)}
    ${use("sb-leafA", 60, 14, -6, 0.9)}${use("sb-leafA", 128, 9, 4, 0.82)}${use("sb-leafA", 196, 18, 16, 0.7)}
    ${use("sb-leafA", 96, 26, 26, 0.72, true)}${use("sb-leafA", 168, 24, 34, 0.6, true)}${use("sb-leafA", 236, 34, 52, 0.55, true)}
    ${use("sb-leafA", 18, 74, 96, 0.86, true)}${use("sb-leafA", 20, 128, 80, 0.72, true)}${use("sb-leafA", 34, 96, 62, 0.66)}
    ${use("sb-leafA", 40, 160, 50, 0.6)}
    ${use("sb-curl", 280, 96, 200, 0.9)}${use("sb-curl", 88, 186, 120, 0.8)}
    ${use("sb-leafA", 130, 104, 120, 0.42)}${use("sb-leafA", 52, 140, 110, 0.4, true)}
    ${use("sb-petal", 70, 50, 30, 1.1)}${use("sb-petal", 52, 66, 70, 1.1)}${use("sb-petal", 84, 44, -10, 0.9)}
    ${use("sb-rosette", 38, 36, 10, 1.6)}
    ${use("sb-berry-g", 136, 124, 0, 1.1)}${use("sb-berry-g", 54, 150, 0, 1)}${use("sb-berry-g", 206, 76, 0, 1)}${use("sb-berry-g", 266, 80, 0, 0.9)}
    ${use("sb-berry-g", 112, 60, 0, 0.8)}${use("sb-berry-g", 64, 104, 0, 0.8)}
    ${use("sb-leafA", 150, 30, 40, 0.5)}${use("sb-leafA", 64, 80, 70, 0.5, true)}${use("sb-leafA", 250, 70, 100, 0.42, true)}
    ${use("sb-petal", 100, 40, 20, 0.8)}${use("sb-petal", 46, 90, 80, 0.8)}${use("sb-petal", 292, 40, 60, 0.7)}
  </g></g></svg>`;
}

/* ------------------------------------------------------------------ */
/* The dialogue frame                                                  */
/* ------------------------------------------------------------------ */

/**
 * A rectangle whose corners are cut by a three-lobed scallop: the corner is
 * notched by a quarter circle of radius c around it, and that notch is
 * itself made of three small convex arcs.
 */
export function scallop(x0: number, y0: number, x1: number, y1: number, c: number): string {
  const corner = (kx: number, ky: number, ux: number, uy: number, vx: number, vy: number) => {
    const pts: [number, number][] = [0, 30, 60, 90].map((deg) => {
      const t = (deg * Math.PI) / 180;
      return [kx + c * (Math.cos(t) * ux + Math.sin(t) * vx), ky + c * (Math.cos(t) * uy + Math.sin(t) * vy)];
    });
    const r = f(c * 0.3);
    return pts.slice(1).map(([x, y]) => `A${r},${r} 0 0 1 ${f(x)},${f(y)}`).join(" ");
  };
  return [
    `M${f(x0 + c)},${f(y0)} L${f(x1 - c)},${f(y0)}`,
    corner(x1, y0, -1, 0, 0, 1),
    `L${f(x1)},${f(y1 - c)}`,
    corner(x1, y1, 0, -1, -1, 0),
    `L${f(x0 + c)},${f(y1)}`,
    corner(x0, y1, 1, 0, 0, -1),
    `L${f(x0)},${f(y0 + c)}`,
    corner(x0, y0, 0, 1, 1, 0),
    "Z",
  ].join(" ");
}

/** The frame's margins around the page box (the svg overhangs the box by these). */
export const DLG_PAD = { x: 78, top: 26, bottom: 46 };

/**
 * The dialogue page at w×h: a mahogany cradle with scrolled volutes, a
 * vellum page with a burnt edge and a botanical watermark, a bevelled
 * double gilt border with a beaded inner track, and filigree in the
 * scalloped corners.
 */
export function dialogueFrame(w: number, h: number): { back: string; front: string; page: string } {
  const { x: M, top: T, bottom: B } = DLG_PAD;
  const c = Math.min(30, h * 0.14);
  const page = scallop(0, 0, w, h, c);
  const inner = scallop(9, 9, w - 9, h - 9, c - 3);
  const tool = scallop(-9, -6, w + 9, h + 11, c + 12);
  const C = c + 16;
  // The cradle: scalloped top corners like the page, flaring into volutes at the foot.
  const cr = `M${-17 + C},-13 L${f(w + 17 - C)},-13 A${f(C * 0.3)},${f(C * 0.3)} 0 0 1 ${f(w + 17 - C * 0.866)},${f(-13 + C * 0.5)}
    A${f(C * 0.3)},${f(C * 0.3)} 0 0 1 ${f(w + 17 - C * 0.5)},${f(-13 + C * 0.866)} A${f(C * 0.3)},${f(C * 0.3)} 0 0 1 ${w + 17},${-13 + C}
    L${w + 17},${h - 26} C${w + 19},${h - 6} ${w + 42},${h - 4} ${w + 58},${h + 8} C${w + 74},${h + 20} ${w + 66},${h + 40} ${w + 46},${h + 40}
    L-46,${h + 40} C-66,${h + 40} -74,${h + 20} -58,${h + 8} C-42,${h - 4} -19,${h - 6} -17,${h - 26}
    L-17,${-13 + C} A${f(C * 0.3)},${f(C * 0.3)} 0 0 1 ${f(-17 + C * 0.5)},${f(-13 + C * 0.866)} A${f(C * 0.3)},${f(C * 0.3)} 0 0 1 ${f(-17 + C * 0.866)},${f(-13 + C * 0.5)}
    A${f(C * 0.3)},${f(C * 0.3)} 0 0 1 ${-17 + C},-13 Z`;
  const volute = (cx: number, cy: number, m: number) =>
    `<g transform="translate(${cx},${cy}) scale(${m},1)">
      <circle r="13" fill="#1a0b05" opacity=".75"/>
      <path d="M13,0 C13,-11 -5,-14 -10,-3 C-13,5 -4,12 3,8 C8,5 6,-2 1,-1 C-2,0 -1,4 2,3" fill="none" stroke="#3e1b0b" stroke-width="5" stroke-linecap="round"/>
      <path d="M13,0 C13,-11 -5,-14 -10,-3 C-13,5 -4,12 3,8 C8,5 6,-2 1,-1 C-2,0 -1,4 2,3" fill="none" stroke="url(#sb-gold-d)" stroke-width="3" stroke-linecap="round"/>
      ${use("sb-leafA", -8, -8, 200, 0.34)}
    </g>`;
  /** Filigree in a scalloped corner, drawn for the top-left and rotated into place. */
  const orn = (x: number, y: number, rot: number) =>
    `<g transform="translate(${x},${y}) rotate(${rot})">
      ${use("sb-leafA", 6, 4, 8, 0.36)}${use("sb-leafA", 4, 6, 82, 0.36, true)}
      ${use("sb-curl", 14, 14, 45, 0.42)}
      ${use("sb-rosette", 6, 6, 0, 0.82)}
    </g>`;
  const open = (cls: string) => `<svg class="${cls}" viewBox="${-M} ${-T} ${w + 2 * M} ${h + T + B}" width="${w + 2 * M}" height="${h + T + B}" aria-hidden="true" focusable="false">`;
  // Behind the vellum (an HTML layer clipped to the page path): the cradle. In front: watermark, burn, gilt.
  const back = `${open("sb-dlg-back")}
  <defs>
    <linearGradient id="sb-cradle-shade" gradientUnits="userSpaceOnUse" x1="0" y1="-14" x2="0" y2="${h + 42}">
      <stop offset="0" stop-color="#ffcf8a" stop-opacity=".2"/><stop offset=".08" stop-color="#000" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".55"/>
    </linearGradient>
  </defs>
  <g filter="url(#sb-deep)">
    <path d="${cr}" fill="url(#sb-pat-wood)"/>
    <path d="${cr}" fill="url(#sb-cradle-shade)" stroke="#120703" stroke-width="2"/>
  </g>
  <path d="${tool}" fill="none" stroke="#c99a52" stroke-width="1" stroke-dasharray="5 3" opacity=".55"/>
  ${volute(w + 46, h + 20, 1)}${volute(-46, h + 20, -1)}
</svg>`;
  const front = `${open("sb-dlg-front")}
  <defs>
    <linearGradient id="sb-dg" gradientUnits="userSpaceOnUse" x1="0" y1="-12" x2="0" y2="${h + 12}">
      <stop offset="0" stop-color="#fff2c4"/><stop offset=".04" stop-color="#d4a556"/><stop offset=".09" stop-color="#7a4c1c"/>
      <stop offset=".5" stop-color="#c79a50"/><stop offset=".92" stop-color="#e6c27a"/><stop offset=".97" stop-color="#8f5e25"/><stop offset="1" stop-color="#4c2e10"/>
    </linearGradient>
    <clipPath id="sb-page-clip"><path d="${page}"/></clipPath>
  </defs>
  <g clip-path="url(#sb-page-clip)">
    <use href="#sb-sprig" transform="translate(${f(w * 0.015)},${f(h * 0.06)}) scale(${f((h * 0.95) / 250)})" style="color:#8c5828" opacity=".1"/>
    <use href="#sb-sprig" transform="translate(${f(w * 0.985)},${f(h * 0.94)}) scale(${f((-h * 0.7) / 250)})" style="color:#8c5828" opacity=".06"/>
    <path d="${page}" fill="none" stroke="#5c2d10" stroke-width="54" opacity=".42" filter="url(#sb-burn)"/>
  </g>
  <path d="${page}" fill="none" stroke="#2a1205" stroke-width="7" opacity=".8"/>
  <g filter="url(#sb-bevel)">
    <path d="${page}" fill="none" stroke="url(#sb-dg)" stroke-width="4"/>
    <path d="${inner}" fill="none" stroke="url(#sb-dg)" stroke-width="1.6"/>
    <path d="${scallop(4.6, 4.6, w - 4.6, h - 4.6, c - 1.4)}" fill="none" stroke="#e9c57a" stroke-width="2.4" stroke-dasharray="0.1 6.4" stroke-linecap="round"/>
  </g>
  <path d="${page}" fill="none" stroke="#fff6d8" stroke-width=".8" opacity=".6" transform="translate(-.5,-.7)"/>
  <g filter="url(#sb-drop)"><g filter="url(#sb-bevel)">
    ${orn(-4, -4, 0)}${orn(w + 4, -4, 90)}${orn(w + 4, h + 4, 180)}${orn(-4, h + 4, 270)}
  </g></g>
</svg>`;
  return { back, front, page };
}

/* ------------------------------------------------------------------ */
/* Nameplate                                                           */
/* ------------------------------------------------------------------ */

/** The nameplate's diamond-filigree end cap (left; mirror for right), 46×52. */
export function plateCap(right: boolean): string {
  return `<svg viewBox="0 0 46 52" aria-hidden="true" focusable="false" preserveAspectRatio="none"><g ${right ? 'transform="translate(46,0) scale(-1,1)"' : ""}>
    <path d="M46,5 L25,5 C18,5 14,9 10,14 L1,26 L10,38 C14,43 18,47 25,47 L46,47 Z" fill="url(#sb-gold)" stroke="#3a1a08" stroke-width="1.2" filter="url(#sb-bevel)"/>
    <path d="M46,11 L27,11 C21,11 18,14 15,18 L9,26 L15,34 C18,38 21,41 27,41 L46,41 Z" fill="url(#sb-plaque)" stroke="#120703" stroke-width="1"/>
    <path d="M1,26 L-6,26 M-6,26 C-10,20 -4,16 -1,20" fill="none" stroke="url(#sb-gold-d)" stroke-width="2" stroke-linecap="round"/>
    <path d="M17,26 L21,21 L25,26 L21,31 Z" fill="url(#sb-coral)" stroke="#e9c57a" stroke-width=".9"/>
    ${[[33, 8], [41, 8], [33, 44], [41, 44]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.7" fill="url(#sb-berry)" stroke="#4c2a0e" stroke-width=".5"/>`).join("")}
    <circle cx="13" cy="26" r="1.6" fill="#fff1c2"/>
  </g></svg>`;
}

/** The nameplate's middle band: stretches horizontally (strokes do not scale). */
export const PLATE_BAND = `<svg viewBox="0 0 100 52" preserveAspectRatio="none" aria-hidden="true" focusable="false">
  <rect x="0" y="5" width="100" height="42" fill="url(#sb-gold)"/>
  <rect x="0" y="11" width="100" height="30" fill="url(#sb-plaque)"/>
  <path d="M0,5.6 H100 M0,46.4 H100" stroke="#3a1a08" stroke-width="1.2" vector-effect="non-scaling-stroke"/>
  <path d="M0,12.4 H100" stroke="#6b4a2a" stroke-width="1" vector-effect="non-scaling-stroke" opacity=".7"/>
  <path d="M0,8 H100 M0,44 H100" stroke="#fff2c8" stroke-width=".8" stroke-dasharray="1 5" vector-effect="non-scaling-stroke" opacity=".5"/>
</svg>`;

/** A red wax seal stamped "New" (a place just added to the world). */
export function waxSeal(text: string): string {
  const blob = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    const r = i % 2 ? 26 : 29;
    return `${f(32 + Math.cos(a) * r)},${f(32 + Math.sin(a) * r)}`;
  });
  return `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><g filter="url(#sb-drop)">
    <polygon points="${blob.join(" ")}" fill="url(#sb-wax)" stroke="#3e0606" stroke-width="1" stroke-linejoin="round"/>
    <circle cx="32" cy="32" r="19" fill="none" stroke="#5e0b0b" stroke-width="2.4"/>
    <circle cx="32" cy="32" r="19" fill="none" stroke="#f08a78" stroke-width=".8" opacity=".55" transform="translate(-.6,-.8)"/>
    <text x="32" y="36.5" text-anchor="middle" font-family="Gambit Cinzel, serif" font-weight="800" font-size="12" fill="#ffd9c8" stroke="#4c0808" stroke-width=".4">${text}</text>
  </g></svg>`;
}

/* ------------------------------------------------------------------ */
/* Icons (24×24, drawn in cream on enamel)                            */
/* ------------------------------------------------------------------ */

export const ICONS: Record<string, string> = {
  talk: `<path d="M5,5 H18 A3,3 0 0 1 21,8 V13 A3,3 0 0 1 18,16 H11 L6.5,20 V16 H5 A3,3 0 0 1 2,13 V8 A3,3 0 0 1 5,5Z"/><path d="M6,9 H17 M6,12 H14"/>`,
  search: `<path d="M2,12 C6,5.5 18,5.5 22,12 C18,18.5 6,18.5 2,12Z"/><circle cx="12" cy="12" r="3.4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>`,
  wait: `<path d="M6,3 H18 M6,21 H18 M7.5,3 C7.5,9 16.5,9 16.5,12 C16.5,15 7.5,15 7.5,21 M16.5,3 C16.5,9 7.5,9 7.5,12 C7.5,15 16.5,15 16.5,21"/><path d="M9.5,19.5 C10.5,17.5 13.5,17.5 14.5,19.5Z" fill="currentColor"/>`,
  rest: `<path d="M14.5,3.5 A8.5,8.5 0 1 0 20.5,17 A6.8,6.8 0 1 1 14.5,3.5Z"/><path d="M19,4 L19.6,5.6 L21.2,6 L19.6,6.6 L19,8.2 L18.4,6.6 L16.8,6 L18.4,5.6Z" fill="currentColor"/>`,
  shop: `<path d="M8,8 C4.5,10 3,14 3,16.5 C3,20 7,21 12,21 C17,21 21,20 21,16.5 C21,14 19.5,10 16,8"/><path d="M8,8 H16 M9,8 L7.5,4 H16.5 L15,8"/><path d="M12,12 V18 M10,13.5 H13.5 A1.5,1.5 0 0 1 13.5,16.5 H10"/>`,
  exit: `<path d="M12,2 V22 M9,22 H15"/><path d="M12,4.5 H19 L21.5,7 L19,9.5 H12"/><path d="M12,11.5 H5 L2.5,14 L5,16.5 H12"/>`,
  delve: `<path d="M4,22 V11 A8,8 0 0 1 20,11 V22 Z"/><path d="M8,22 V12 A4,4 0 0 1 16,12 V22"/><circle cx="14" cy="17" r=".9" fill="currentColor"/>`,
  fight: `<path d="M4,3 L15,14 M3,4 L14,15 M20,3 L9,14 M21,4 L10,15"/><path d="M12.5,16.5 L16.5,12.5 M7.5,12.5 L11.5,16.5 M15,15 L20,20 M9,15 L4,20"/>`,
  forward: `<path d="M12,3 L19,11 H15 V21 H9 V11 H5Z"/>`,
  back: `<path d="M12,21 L19,13 H15 V3 H9 V13 H5Z"/>`,
  left: `<path d="M3,12 L11,5 V9 H21 V15 H11 V19Z"/>`,
  right: `<path d="M21,12 L13,5 V9 H3 V15 H13 V19Z"/>`,
  lantern: `<path d="M9,4 H15 M10,4 V2.5 H14 V4 M7,7 H17 L16,19 H8Z M6,21 H18 M8,7 L9,4 M16,7 L15,4"/><path d="M12,10 C14,12 14,15 12,16 C10,15 10,12 12,10Z" fill="currentColor"/>`,
  journal: `<path d="M4,4 C7,3 10,3.5 12,5.5 C14,3.5 17,3 20,4 V19 C17,18 14,18.5 12,20.5 C10,18.5 7,18 4,19Z M12,5.5 V20.5"/><path d="M6.5,8 C8,7.6 9.5,7.8 10.5,8.6 M6.5,11 C8,10.6 9.5,10.8 10.5,11.6 M13.5,8.6 C14.5,7.8 16,7.6 17.5,8"/>`,
  classes: `<path d="M12,2.5 L20,5.5 V11 C20,16 16.5,19.5 12,21.5 C7.5,19.5 4,16 4,11 V5.5Z"/><path d="M8,8 L16,16 M16,8 L8,16"/><circle cx="12" cy="12" r="2" fill="currentColor"/>`,
  theme: `<path d="M3,6 C7,4 10,5 12,6.5 C14,5 17,4 21,6 C21,12 18,17 12,18.5 C6,17 3,12 3,6Z"/><path d="M6.5,9.5 C7.5,8.5 9,8.5 10,9.5 M14,9.5 C15,8.5 16.5,8.5 17.5,9.5 M9,14 C10.5,15.4 13.5,15.4 15,14"/>`,
  key: `<circle cx="7" cy="12" r="4"/><path d="M11,12 H21 M17,12 V15.5 M20,12 V14.5"/>`,
  close: `<path d="M6,6 L18,18 M18,6 L6,18"/>`,
};

export const icon = (k: string, cls = "") =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[k] ?? ICONS.search}</svg>`;

/**
 * A brass medallion with an enamel centre holding an icon, or (for a road
 * with a painting of where it leads) a little oval vista of that place.
 */
export function medallion(k: string, art: string | null, uid: string): string {
  const rivets = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return `<circle cx="${f(26 + Math.cos(a) * 21.3)}" cy="${f(26 + Math.sin(a) * 21.3)}" r="1.15" fill="#fff1c2" opacity=".85"/>`;
  }).join("");
  const inside = art
    ? `<clipPath id="sb-mc-${uid}"><circle cx="26" cy="26" r="17"/></clipPath>
       <image href="${art}" x="5" y="5" width="42" height="42" preserveAspectRatio="xMidYMid slice" clip-path="url(#sb-mc-${uid})" filter="url(#sb-grade)"/>
       <circle cx="26" cy="26" r="17" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="5" filter="url(#sb-soft)" clip-path="url(#sb-mc-${uid})"/>`
    : `<circle cx="26" cy="26" r="17" fill="url(#sb-enamel)"/>
       <g transform="translate(14,14)" color="#f6dc98" fill="none" stroke="#f6dc98" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[k] ?? ICONS.search}</g>`;
  return `<svg class="med" viewBox="0 0 52 52" aria-hidden="true" focusable="false"><g filter="url(#sb-drop)">
    <circle cx="26" cy="26" r="25" fill="url(#sb-gold)" stroke="#3a1a08" stroke-width="1.2" filter="url(#sb-bevel)"/>
    <circle cx="26" cy="26" r="19" fill="#2a1206" stroke="#6e481f" stroke-width="1"/>
    ${rivets}
    ${inside}
    <circle cx="26" cy="26" r="17.2" fill="none" stroke="#e9c57a" stroke-width="1"/>
    <path d="M14,17 A14,14 0 0 1 30,12.4" fill="none" stroke="#fff" stroke-width="1.4" opacity=".35" stroke-linecap="round"/>
  </g></svg>`;
}

/** A choice ribbon's cloth (360×50, stretched to the button): a pointed head and a swallowtail. */
export function ribbon(pat: string): string {
  const body = "M20,3 H356 L341,25 L356,47 H20 L3,25 Z";
  return `<svg class="rib-art" viewBox="0 0 360 50" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <path d="${body}" fill="#120703" transform="translate(0,3)" opacity=".55" filter="url(#sb-soft)"/>
    <path d="${body}" fill="url(#${pat})"/>
    <path d="${body}" fill="url(#sb-fold)"/>
    <path d="M22,6.5 H349.5 L336.5,25 L349.5,43.5 H22 L7.5,25 Z" fill="none" stroke="#e0b36a" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
    <path d="M24,9.5 H344 L332.5,25 L344,40.5 H24 L11,25 Z" fill="none" stroke="#e0b36a" stroke-width=".8" stroke-dasharray="3 2" vector-effect="non-scaling-stroke" opacity=".7"/>
    <path d="${body}" fill="none" stroke="#1a0904" stroke-width="1.2" vector-effect="non-scaling-stroke"/>
  </svg>`;
}

/* ------------------------------------------------------------------ */
/* Status bookmarks                                                    */
/* ------------------------------------------------------------------ */

/** A silk bookmark hanging from the top of the book (70 wide, h tall), with an emblem and a value. */
export function bookmark(pat: string, h: number, emblem: string, value: string, sub: string): string {
  const body = `M5,-6 H65 V${h} L35,${h - 17} L5,${h} Z`;
  const stitch = `M10,-2 V${h - 11} L35,${h - 26} L60,${h - 11} V-2`;
  return `<svg viewBox="0 -6 70 ${h + 14}" aria-hidden="true" focusable="false">
    <path d="${body}" fill="#000" opacity=".5" transform="translate(3,6)" filter="url(#sb-soft)"/>
    <path d="${body}" fill="url(#${pat})"/>
    <path d="${body}" fill="url(#sb-silk-shade)"/>
    <path d="${stitch}" fill="none" stroke="#f6dfae" stroke-width="1.1" stroke-dasharray="3.2 2.4" opacity=".75"/>
    <rect x="5" y="-6" width="60" height="16" fill="#000" opacity=".35"/>
    <g transform="translate(35,${f(h * 0.36)})">${emblem}</g>
    <text x="35" y="${f(h * 0.36 + 34)}" text-anchor="middle" font-family="Gambit Cinzel, serif" font-weight="800" font-size="19" fill="#fff1cf" stroke="#2a1205" stroke-width="2.4" paint-order="stroke">${value}</text>
    ${sub ? `<text x="35" y="${f(h * 0.36 + 49)}" text-anchor="middle" font-family="Gambit Garamond, serif" font-style="italic" font-weight="700" font-size="11.5" fill="#f6dfae" opacity=".9">${sub}</text>` : ""}
  </svg>`;
}

/** An embossed gold coin with a crown stamp. */
export const COIN = `<g filter="url(#sb-drop)">
  <circle r="17" fill="url(#sb-gold)" stroke="#5a3816" stroke-width="1.2" filter="url(#sb-bevel)"/>
  <circle r="13" fill="none" stroke="#7a4c1c" stroke-width="1.1"/>
  <circle r="13" fill="none" stroke="#fff1c2" stroke-width=".6" stroke-dasharray=".1 2.4" stroke-linecap="round"/>
  <path d="M-7,4 L-8,-4 L-4,-1 L0,-7 L4,-1 L8,-4 L7,4 Z" fill="#a8742f" stroke="#5a3816" stroke-width=".9"/>
  <path d="M-7,6 H7" stroke="#5a3816" stroke-width="1.4"/>
</g>`;

/** A crystal phial filled to `t` (0-1) with a crimson draught; the meniscus wave sways (CSS). */
export function phial(t: number): string {
  const top = -6, bottom = 18;
  const y = f(bottom - (bottom - top) * Math.max(0, Math.min(1, t)));
  return `<g filter="url(#sb-drop)">
    <clipPath id="sb-phial-clip"><path d="M-4,-14 V-7 C-12,-4 -15,3 -15,8 C-15,16 -8,20 0,20 C8,20 15,16 15,8 C15,3 12,-4 4,-7 V-14 Z"/></clipPath>
    <path d="M-4,-14 V-7 C-12,-4 -15,3 -15,8 C-15,16 -8,20 0,20 C8,20 15,16 15,8 C15,3 12,-4 4,-7 V-14 Z" fill="#1b0b0e" fill-opacity=".55"/>
    <g clip-path="url(#sb-phial-clip)">
      <rect x="-16" y="${y}" width="32" height="40" fill="url(#sb-blood)"/>
      <path class="sb-wave" d="M-40,${y} q5,-2.4 10,0 t10,0 t10,0 t10,0 t10,0 t10,0 t10,0 t10,0 V${y + 3} H-40 Z" fill="#ff8f78" opacity=".7"/>
    </g>
    <path d="M-4,-14 V-7 C-12,-4 -15,3 -15,8 C-15,16 -8,20 0,20 C8,20 15,16 15,8 C15,3 12,-4 4,-7 V-14 Z" fill="url(#sb-glass)" stroke="#f6e6c4" stroke-width="1.2"/>
    <rect x="-6" y="-19" width="12" height="6" rx="1.5" fill="url(#sb-gold)" stroke="#4c2a0e" stroke-width=".8"/>
    <path d="M-9,4 C-9,-1 -6,-3 -4,-4" fill="none" stroke="#fff" stroke-width="1.4" opacity=".6" stroke-linecap="round"/>
  </g>`;
}

/** A golden spool wound with thread, the loose end knotted (the quest thread). */
export const SPOOL = `<g filter="url(#sb-drop)">
  <rect x="-15" y="-15" width="30" height="5" rx="1.5" fill="url(#sb-gold)" stroke="#4c2a0e" stroke-width=".8"/>
  <rect x="-15" y="11" width="30" height="5" rx="1.5" fill="url(#sb-gold)" stroke="#4c2a0e" stroke-width=".8"/>
  <rect x="-11" y="-10" width="22" height="21" fill="#c9a5ff" opacity="0"/>
  ${Array.from({ length: 9 }, (_, i) => `<path d="M-11,${-9 + i * 2.3} C-4,${-10.5 + i * 2.3} 4,${-7.5 + i * 2.3} 11,${-9 + i * 2.3}" stroke="${i % 2 ? "#d8b46a" : "#f3d791"}" stroke-width="2.2" fill="none"/>`).join("")}
  <path d="M11,6 C18,8 20,16 14,20 C9,23 6,19 9,17" fill="none" stroke="#f3d791" stroke-width="1.6" stroke-linecap="round"/>
  <circle cx="9" cy="17" r="1.8" fill="#f3d791"/>
</g>`;

/** A leather satchel (frontier supplies). */
export const SATCHEL = `<g filter="url(#sb-drop)">
  <path d="M-10,-10 C-10,-18 10,-18 10,-10" fill="none" stroke="#3a1a08" stroke-width="3"/>
  <path d="M-15,-8 H15 L13,15 H-13 Z" fill="#7a4a24" stroke="#2a1205" stroke-width="1.2"/>
  <path d="M-15,-8 H15 L12,4 H-12 Z" fill="#9a6232" stroke="#2a1205" stroke-width="1"/>
  <rect x="-3" y="0" width="6" height="7" rx="1" fill="url(#sb-gold)" stroke="#3a1a08" stroke-width=".7"/>
  <path d="M-12,-5 H12" stroke="#e8c69a" stroke-width=".7" stroke-dasharray="2 1.6" opacity=".7"/>
</g>`;

/** An iron key (delve keys). */
export const IRONKEY = `<g filter="url(#sb-drop)" fill="none" stroke-linecap="round">
  <circle cx="-7" cy="0" r="7" stroke="#2a2a30" stroke-width="5"/><circle cx="-7" cy="0" r="7" stroke="#b7b4b0" stroke-width="2.6"/>
  <path d="M0,0 H16 M11,0 V6 M15,0 V5" stroke="#2a2a30" stroke-width="5"/><path d="M0,0 H16 M11,0 V6 M15,0 V5" stroke="#cfccc6" stroke-width="2.6"/>
</g>`;

/* ------------------------------------------------------------------ */
/* Chapter header: astrolabe medallion and parchment scroll           */
/* ------------------------------------------------------------------ */

const SKY: Record<string, [string, string, string]> = {
  morning: ["#fff0bf", "#f5b46a", "#8fb3cf"],
  afternoon: ["#fffbe2", "#cfe6f0", "#6f9fc4"],
  evening: ["#ffd08a", "#c9504a", "#3a2350"],
  night: ["#3a4a7a", "#16204a", "#070b1e"],
};

/** The astrolabe: a brass ring of degree ticks around a painted sky for the time of day. */
export function astrolabe(time: string): string {
  const [a, b, c] = SKY[time] ?? SKY.morning!;
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const t = (i / 72) * Math.PI * 2;
    const r0 = i % 6 ? 43.5 : 41;
    return `<line x1="${f(50 + Math.cos(t) * r0)}" y1="${f(50 + Math.sin(t) * r0)}" x2="${f(50 + Math.cos(t) * 46.5)}" y2="${f(50 + Math.sin(t) * 46.5)}"/>`;
  }).join("");
  const rays = Array.from({ length: 12 }, (_, i) => `<path d="M0,-14 L2.6,-22 L0,-30 L-2.6,-22 Z" transform="rotate(${i * 30})"/>`).join("");
  const body =
    time === "night"
      ? `<path d="M58,30 A16,16 0 1 0 70,58 A12.5,12.5 0 1 1 58,30Z" fill="#f6ecc8" stroke="#c9b27a" stroke-width=".8"/>
         ${[[34, 32, 1.4], [42, 62, 1], [30, 50, 0.9], [66, 70, 1.2], [48, 26, 0.8], [26, 66, 1]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff8dc"/>`).join("")}`
      : time === "evening"
        ? `<g transform="translate(50,60)"><g fill="#ffd27a" opacity=".85">${rays}</g><circle r="13" fill="#ffb347" stroke="#e07a3a" stroke-width="1"/></g>
           <rect x="10" y="60" width="80" height="40" fill="#2a1630" opacity=".85"/>
           <path d="M10,60 C30,56 40,62 56,58 C70,55 80,60 90,58" fill="none" stroke="#ffb27a" stroke-width="1.4" opacity=".8"/>`
        : `<g transform="translate(50,${time === "morning" ? 56 : 46})"><g fill="#ffe08a" stroke="#d8913a" stroke-width=".6">${rays}</g>
           <circle r="12" fill="#fff0b0" stroke="#e0a040" stroke-width="1.2"/><circle r="12" fill="none" stroke="#fff" stroke-width="2" opacity=".4" stroke-dasharray="10 60"/></g>
           ${time === "morning" ? `<path d="M8,74 C26,66 40,72 54,68 C70,64 82,70 92,68 V96 H8Z" fill="#6a7e5a" opacity=".8"/>` : ""}`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><g filter="url(#sb-deep)">
    <clipPath id="sb-sky"><circle cx="50" cy="50" r="36"/></clipPath>
    <circle cx="50" cy="50" r="49" fill="url(#sb-gold)" stroke="#3a1a08" stroke-width="1.4" filter="url(#sb-bevel)"/>
    <g stroke="#4c2a0e" stroke-width="1.1">${ticks}</g>
    <circle cx="50" cy="50" r="39" fill="none" stroke="#5a3816" stroke-width="3"/>
    <circle cx="50" cy="50" r="38" fill="none" stroke="#fff1c2" stroke-width=".8" opacity=".7"/>
    <g clip-path="url(#sb-sky)">
      <rect x="0" y="0" width="100" height="100" fill="${c}"/>
      <circle cx="50" cy="${time === "night" ? 30 : 64}" r="52" fill="${b}"/>
      <circle cx="50" cy="${time === "night" ? 20 : 70}" r="30" fill="${a}" opacity=".85"/>
      ${body}
      <path d="M14,50 H86 M50,14 V86" stroke="#e9c57a" stroke-width=".6" opacity=".45"/>
      <circle cx="50" cy="50" r="22" fill="none" stroke="#e9c57a" stroke-width=".6" opacity=".45"/>
    </g>
    <circle cx="50" cy="50" r="36" fill="none" stroke="#2a1205" stroke-width="1.2"/>
    <path d="M50,4 L53,10 L50,16 L47,10 Z" fill="url(#sb-coral)" stroke="#5a2a10" stroke-width=".6"/>
    <path d="M26,22 A34,34 0 0 1 60,15" fill="none" stroke="#fff" stroke-width="2" opacity=".3" stroke-linecap="round"/>
  </g></svg>`;
}

/** The chapter scroll's band (stretches horizontally) and its rolled end. */
export const SCROLL_BAND = `<svg viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
  <path d="M0,16 C120,8 260,22 400,14 L400,90 C260,98 120,84 0,92 Z" fill="#000" opacity=".5" transform="translate(0,6)" filter="url(#sb-soft)"/>
  <clipPath id="sb-scroll-clip"><path d="M0,16 C120,8 260,22 400,14 L400,90 C260,98 120,84 0,92 Z"/></clipPath>
  <image href="${parchment(800, 200, 41)}" x="0" y="0" width="400" height="100" preserveAspectRatio="none" clip-path="url(#sb-scroll-clip)"/>
  <path d="M0,16 C120,8 260,22 400,14 L400,90 C260,98 120,84 0,92 Z" fill="none" stroke="#5c2d10" stroke-width="18" opacity=".35" filter="url(#sb-burn)" clip-path="url(#sb-scroll-clip)"/>
  <path d="M0,22 C120,14 260,28 400,20 M0,86 C120,78 260,92 400,84" fill="none" stroke="#a8742f" stroke-width="1.6" vector-effect="non-scaling-stroke"/>
  <path d="M0,25.5 C120,17.5 260,31.5 400,23.5 M0,82.5 C120,74.5 260,88.5 400,80.5" fill="none" stroke="#a8742f" stroke-width=".7" stroke-dasharray="2 3" vector-effect="non-scaling-stroke"/>
  <path d="M0,16 C120,8 260,22 400,14 L400,90 C260,98 120,84 0,92 Z" fill="none" stroke="#4a2410" stroke-width="1.3" vector-effect="non-scaling-stroke"/>
</svg>`;

export const SCROLL_END = `<svg viewBox="0 0 40 110" preserveAspectRatio="none" aria-hidden="true" focusable="false"><g filter="url(#sb-drop)">
  <path d="M2,12 C10,6 26,6 32,14 L32,92 C26,102 10,102 2,96 Z" fill="url(#sb-roll)" stroke="#4a2410" stroke-width="1.2"/>
  <ellipse cx="17" cy="12" rx="15" ry="6" fill="#e9d2a0" stroke="#4a2410" stroke-width="1.1"/>
  <path d="M17,12 m-9,0 a9,3.6 0 1 0 18,0 a6,2.4 0 1 0 -12,0 a3,1.2 0 1 0 6,0" fill="none" stroke="#7a4c1c" stroke-width=".9"/>
  <path d="M8,20 V88" stroke="#fff6dc" stroke-width="2" opacity=".55"/>
  <circle cx="17" cy="100" r="6" fill="url(#sb-gold)" stroke="#3a1a08" stroke-width="1"/>
  <circle cx="17" cy="4" r="5" fill="url(#sb-gold)" stroke="#3a1a08" stroke-width="1"/>
</g></svg>`;

/* ------------------------------------------------------------------ */
/* Cameo frame for opaque portraits                                    */
/* ------------------------------------------------------------------ */

/**
 * A life-scale gilt arch (viewBox 260×386) holding an opaque portrait: crest
 * on top, beaded bezel, side volutes, a recessed velvet shadow inside, the
 * portrait warmed and vignetted, and a gilt molding at the foot (which tucks
 * behind the dialogue page, like a standing figure's waist).
 */
export function cameo(url: string, uid: string): string {
  const outer = "M18,372 V122 C18,50 68,14 120,14 C172,14 222,50 222,122 V372 Z";
  const win = "M36,372 V124 C36,64 78,32 120,32 C162,32 204,64 204,124 V372 Z";
  const bead = "M41,372 V125 C41,68 81,37 120,37 C159,37 199,68 199,125 V372";
  return `<svg viewBox="-10 -26 260 400" aria-hidden="true" focusable="false">
    <defs>
      <clipPath id="sb-cw-${uid}"><path d="${win}"/></clipPath>
      <radialGradient id="sb-cv-${uid}" cx=".5" cy=".38" r=".66"><stop offset=".5" stop-color="#140a05" stop-opacity="0"/><stop offset="1" stop-color="#140a05" stop-opacity=".8"/></radialGradient>
    </defs>
    <g filter="url(#sb-deep)">
      <path d="${outer}" fill="url(#sb-gold-d)" stroke="#3a1a08" stroke-width="1.5" filter="url(#sb-bevel)"/>
      <path d="M26,372 V123 C26,58 72,22 120,22 C168,22 214,58 214,123 V372" fill="none" stroke="#6e481f" stroke-width="1.2"/>
      <path d="${win}" fill="#1c0d0a"/>
      <g clip-path="url(#sb-cw-${uid})">
        <image href="${url}" x="36" y="14" width="168" height="358" preserveAspectRatio="xMidYMin slice" filter="url(#sb-grade)"/>
        <rect x="36" y="32" width="168" height="340" fill="url(#sb-cv-${uid})"/>
        <path d="${win}" fill="none" stroke="#000" stroke-width="30" opacity=".75" filter="url(#sb-burn)" transform="translate(0,10)"/>
        <path d="M36,32 L204,32 L36,200 Z" fill="#ffd79a" opacity=".07"/>
      </g>
      <path d="${win}" fill="none" stroke="#2a1205" stroke-width="2.4"/>
      <path d="${bead}" fill="none" stroke="#f3d791" stroke-width="3" stroke-dasharray=".1 7" stroke-linecap="round" opacity=".9"/>
    </g>
    <g filter="url(#sb-drop)"><g filter="url(#sb-bevel)">
      ${use("sb-leafA", 116, 8, 200, 0.62)}${use("sb-leafA", 124, 8, -20, 0.62, true)}
      ${use("sb-leafA", 114, 12, 236, 0.42, true)}${use("sb-leafA", 126, 12, -56, 0.42)}
      ${use("sb-curl", 104, -2, 220, 0.5)}${use("sb-curl", 136, -2, -40, 0.5)}
      ${use("sb-rosette", 120, 6, 0, 1.25)}
      ${use("sb-curl", 10, 250, 70, 0.6)}${use("sb-curl", 230, 250, 110, 0.6)}
      ${use("sb-leafA", 14, 150, 80, 0.46)}${use("sb-leafA", 226, 150, 100, 0.46, true)}
    </g></g>
  </svg>`;
}

/**
 * The name scroll every person on stage stands behind (200×58): a curved
 * crimson-and-gold enamel ribbon with the name in tracked caps; `talk` adds
 * a gilt diamond "↑ Talk" badge perched on its top rim.
 */
export function nameScroll(name: string, size: number, talk: boolean, uid: string): string {
  const rib = "M8,24 C60,14 140,14 192,24 L182,37 L192,50 C140,40 60,40 8,50 L18,37 Z";
  return `<svg class="ns-art" viewBox="0 -18 200 72" aria-hidden="true" focusable="false">
    <path d="${rib}" fill="#000" opacity=".55" transform="translate(0,4)" filter="url(#sb-soft)"/>
    <path d="${rib}" fill="url(#sb-pat-talk)"/>
    <path d="${rib}" fill="url(#sb-fold)"/>
    <path d="M12,27 C62,17.5 138,17.5 188,27 M12,47 C62,37.5 138,37.5 188,47" fill="none" stroke="#e0b36a" stroke-width="1.3"/>
    <path d="${rib}" fill="none" stroke="#1a0904" stroke-width="1.1"/>
    <circle cx="16" cy="37" r="2.4" fill="url(#sb-berry)"/><circle cx="184" cy="37" r="2.4" fill="url(#sb-berry)"/>
    <path id="sb-nsp-${uid}" d="M26,40 C70,31 130,31 174,40" fill="none"/>
    <text font-family="Gambit Cinzel, serif" font-weight="800" font-size="${size}" fill="#fff0cc" letter-spacing="${Math.round(size * 16) / 100}" text-anchor="middle" stroke="#2a0606" stroke-width=".6" paint-order="stroke"><textPath href="#sb-nsp-${uid}" startOffset="50%">${name.toUpperCase()}</textPath></text>
    ${talk ? `<g class="tk">
      <path d="M100,-16 L142,-1 L100,14 L58,-1 Z" fill="#000" opacity=".5" transform="translate(0,3)" filter="url(#sb-soft)"/>
      <path d="M100,-16 L142,-1 L100,14 L58,-1 Z" fill="url(#sb-plaque)" stroke="url(#sb-gold-h)" stroke-width="2"/>
      <path d="M100,-12 L134,-1 L100,10 L66,-1 Z" fill="none" stroke="#a8742f" stroke-width=".7"/>
      <path d="M73,0 L78,-5 L83,0 M78,-5 V5" fill="none" stroke="#ffd27a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="106" y="3" text-anchor="middle" font-family="Gambit Cinzel, serif" font-weight="800" font-size="10.5" letter-spacing="1.4" fill="#ffd27a">TALK</text>
    </g>` : ""}
  </svg>`;
}

/** Index tab (system controls): tooled leather with a brass rim and notched points, astride the page's top rim. */
export const TAB = `<svg class="tab-art" viewBox="0 0 160 44" preserveAspectRatio="none" aria-hidden="true" focusable="false">
  <path d="M14,3 H146 L157,22 L146,41 H14 L3,22 Z" fill="#000" opacity=".55" transform="translate(1,4)" filter="url(#sb-soft)"/>
  <path d="M14,3 H146 L157,22 L146,41 H14 L3,22 Z" fill="url(#sb-gold)"/>
  <path d="M17,7.5 H143 L151.5,22 L143,36.5 H17 L8.5,22 Z" fill="url(#sb-pat-leather)"/>
  <path d="M17,7.5 H143 L151.5,22 L143,36.5 H17 L8.5,22 Z" fill="url(#sb-fold)"/>
  <path d="M20,11 H140 L146.5,22 L140,33 H20 L13.5,22 Z" fill="none" stroke="#d9ad62" stroke-width=".8" stroke-dasharray="2 2.4" vector-effect="non-scaling-stroke" opacity=".8"/>
  <path d="M14,3 H146 L157,22 L146,41 H14 L3,22 Z" fill="none" stroke="#2a1205" stroke-width="1.2" vector-effect="non-scaling-stroke"/>
  <path d="M14,4.5 H146" stroke="#fff2c8" stroke-width=".8" vector-effect="non-scaling-stroke" opacity=".6"/>
</svg>`;

/** A brass corner protector for the journal's cover (top-left; rotate for the others). */
export const BRASS_CORNER = `<svg viewBox="0 0 90 90" aria-hidden="true" focusable="false"><g filter="url(#sb-drop)">
  <path d="M0,0 H86 C78,8 66,10 58,14 C46,20 40,28 34,40 C28,52 22,62 14,70 C10,76 4,82 0,86 Z" fill="url(#sb-gold-d)" stroke="#3a1a08" stroke-width="1.4" filter="url(#sb-bevel)"/>
  <path d="M6,6 H66 C56,14 46,18 40,26 C32,36 26,48 18,58 C14,62 10,64 6,66 Z" fill="none" stroke="#6e481f" stroke-width="1.2"/>
  ${use("sb-rosette", 22, 22, 0, 1.1)}
  ${[[50, 8], [8, 50], [34, 9], [9, 34]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="url(#sb-berry)" stroke="#4c2a0e" stroke-width=".5"/>`).join("")}
</g></svg>`;

/** The woodcut drop cap: a gold-and-crimson square with a vine, the letter in its middle. */
export function dropCap(letter: string): string {
  return `<svg class="dc" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><g filter="url(#sb-drop)">
    <rect x="1" y="1" width="62" height="62" fill="url(#sb-gold)" stroke="#3a1a08" stroke-width="1.2" filter="url(#sb-bevel)"/>
    <rect x="5" y="5" width="54" height="54" fill="#6a1418" stroke="#2a0606" stroke-width="1"/>
    <path d="M8,56 C14,44 10,30 18,20 C24,12 34,10 40,8 M56,8 C50,20 54,34 46,44 C40,52 30,54 24,56" fill="none" stroke="#c98f3a" stroke-width="1.4" opacity=".8"/>
    ${[[14, 40], [20, 18], [50, 24], [44, 48], [32, 9], [32, 55]].map(([x, y], i) => `<path d="M0,0 C3,-5 9,-5 11,0 C9,5 3,5 0,0Z" transform="translate(${x},${y}) rotate(${i * 60})" fill="#d9a04a" opacity=".85"/>`).join("")}
    <rect x="5" y="5" width="54" height="54" fill="none" stroke="#f3d791" stroke-width=".8" stroke-dasharray=".1 3.4" stroke-linecap="round"/>
    <text x="32" y="47" text-anchor="middle" font-family="Gambit Cinzel, serif" font-weight="800" font-size="40" fill="#ffe7b0" stroke="#2a0606" stroke-width="1.6" paint-order="stroke">${letter}</text>
  </g></svg>`;
}

/** The page-turn prompt: a gilt quill nib that bobs; while busy it writes. */
export const NIB = `<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false"><g filter="url(#sb-drop)">
  <path d="M20,38 L10,18 C10,10 14,4 20,2 C26,4 30,10 30,18 Z" fill="url(#sb-gold-d)" stroke="#3a1a08" stroke-width="1.2"/>
  <path d="M20,38 V18" stroke="#3a1a08" stroke-width="1.3"/><circle cx="20" cy="16" r="2.4" fill="#3a1a08"/>
  <path d="M14,16 C14,10 16,6 20,4" fill="none" stroke="#fff6d8" stroke-width="1.2" opacity=".7"/>
</g></svg>`;

/** A goose quill (busy: the story is being written). */
export const QUILL = `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><g filter="url(#sb-drop)">
  <path d="M6,58 C20,40 36,18 60,4 C52,20 40,34 22,48 Z" fill="#f4ecdc" stroke="#6b4a2a" stroke-width="1"/>
  <path d="M6,58 L58,6" stroke="#8a6a44" stroke-width="1.2"/>
  ${Array.from({ length: 8 }, (_, i) => `<path d="M${14 + i * 5.5},${50 - i * 5.5} l${4 + i * 0.6},-${2 + i * 0.4}" stroke="#c9b28a" stroke-width=".7"/>`).join("")}
  <path d="M6,58 L2,63 L9,60 Z" fill="#2a1205"/>
</g></svg>`;

/**
 * The compass rose behind the delve moves: a brass bezel with degree ticks
 * around an aged parchment face, inked needles, and the four moves engraved
 * on curved arcs.
 */
export const ROSE = `<svg viewBox="0 0 240 240" aria-hidden="true" focusable="false">
  <defs>
    <clipPath id="sb-rose-face"><circle cx="120" cy="120" r="88"/></clipPath>
    <path id="sb-arc-top" d="M54.4,47.2 A98,98 0 0 1 185.6,47.2"/>
    <path id="sb-arc-bot" d="M49.1,198.8 A106,106 0 0 0 190.9,198.8"/>
    <path id="sb-arc-left" d="M47.2,185.6 A98,98 0 0 1 47.2,54.4"/>
    <path id="sb-arc-right" d="M192.8,54.4 A98,98 0 0 1 192.8,185.6"/>
  </defs>
  <g filter="url(#sb-deep)">
    <circle cx="120" cy="120" r="118" fill="url(#sb-gold)" stroke="#3a1a08" stroke-width="1.6" filter="url(#sb-bevel)"/>
    <g stroke="#4c2a0e" stroke-width="1">${Array.from({ length: 72 }, (_, i) => { const t = (i / 72) * Math.PI * 2; const r0 = i % 9 ? 113 : 110; return `<line x1="${f(120 + Math.cos(t) * r0)}" y1="${f(120 + Math.sin(t) * r0)}" x2="${f(120 + Math.cos(t) * 117)}" y2="${f(120 + Math.sin(t) * 117)}"/>`; }).join("")}</g>
    <circle cx="120" cy="120" r="108.5" fill="none" stroke="#6e481f" stroke-width="1"/>
    <circle cx="120" cy="120" r="89" fill="#2a1205"/>
    <image href="${parchment(400, 400, 77)}" x="32" y="32" width="176" height="176" clip-path="url(#sb-rose-face)" preserveAspectRatio="none"/>
    <circle cx="120" cy="120" r="88" fill="none" stroke="#5c2d10" stroke-width="24" opacity=".35" filter="url(#sb-burn)" clip-path="url(#sb-rose-face)"/>
    <circle cx="120" cy="120" r="74" fill="none" stroke="#8a5a2a" stroke-width=".9"/>
    <circle cx="120" cy="120" r="70" fill="none" stroke="#8a5a2a" stroke-width=".5" stroke-dasharray="1.5 2.5"/>
    ${[45, 135, 225, 315].map((a) => `<path d="M120,120 L126,114 L120,66 L114,114 Z" transform="rotate(${a} 120 120)" fill="#c9a878" stroke="#5a3816" stroke-width=".8"/><path d="M120,120 L120,66 L114,114 Z" transform="rotate(${a} 120 120)" fill="#5a3816" opacity=".55"/>`).join("")}
    <g style="filter: drop-shadow(0 3px 3px rgba(0,0,0,.45))">${[0, 90, 180, 270].map((a) => `<path d="M120,120 L130,110 L120,42 L110,110 Z" transform="rotate(${a} 120 120)" fill="url(#sb-gold-d)" stroke="#3a1a08" stroke-width="1"/><path d="M120,120 L120,42 L110,110 Z" transform="rotate(${a} 120 120)" fill="#3a1a08" opacity=".35"/>`).join("")}</g>
    <g font-family="Gambit Cinzel, serif" font-weight="800" font-size="11.5" letter-spacing="2.6" fill="#2a1608" text-anchor="middle">
      <text><textPath href="#sb-arc-top" startOffset="50%">ADVANCE</textPath></text>
      <text><textPath href="#sb-arc-bot" startOffset="50%">BACK</textPath></text>
      <text><textPath href="#sb-arc-left" startOffset="50%">LEFT</textPath></text>
      <text><textPath href="#sb-arc-right" startOffset="50%">RIGHT</textPath></text>
    </g>
    <circle cx="120" cy="120" r="22" fill="url(#sb-gold)" stroke="#3a1a08" stroke-width="1.4" filter="url(#sb-bevel)"/>
    <path d="M44,64 A92,92 0 0 1 120,26" fill="none" stroke="#fff" stroke-width="3" opacity=".22" stroke-linecap="round"/>
  </g>
</svg>`;

/** The deckled map folio's frame (stretches): parchment under gilt corner brackets. */
export function folio(): string {
  return `<svg viewBox="0 0 400 320" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <path d="M6,8 L120,4 L260,9 L394,5 L397,120 L393,230 L396,314 L280,317 L140,312 L4,316 L7,200 L3,90 Z" fill="#000" opacity=".55" transform="translate(4,8)" filter="url(#sb-soft)"/>
    <clipPath id="sb-folio-clip"><path d="M6,8 L120,4 L260,9 L394,5 L397,120 L393,230 L396,314 L280,317 L140,312 L4,316 L7,200 L3,90 Z"/></clipPath>
    <image href="${parchment(800, 640, 57)}" x="0" y="0" width="400" height="320" preserveAspectRatio="none" clip-path="url(#sb-folio-clip)"/>
    <path d="M6,8 L120,4 L260,9 L394,5 L397,120 L393,230 L396,314 L280,317 L140,312 L4,316 L7,200 L3,90 Z" fill="none" stroke="#5c2d10" stroke-width="30" opacity=".35" filter="url(#sb-burn)" clip-path="url(#sb-folio-clip)"/>
    <path d="M14,16 H386 V306 H14 Z" fill="none" stroke="#8a5a2a" stroke-width="1.2" vector-effect="non-scaling-stroke"/>
    <path d="M18,20 H382 V302 H18 Z" fill="none" stroke="#8a5a2a" stroke-width=".6" vector-effect="non-scaling-stroke" stroke-dasharray="3 3"/>
  </svg>`;
}

/**
 * The under-wing skirt (w×h px): an espresso mahogany plate across the whole
 * window bottom with a double gilt rim that sweeps down from the window edges
 * and tucks behind the dialogue page (which spans x0..x1).
 */
export function skirt(w: number, h: number, x0: number, x1: number): string {
  const top = (k: number) => {
    const y0 = 8 + k, y1 = h * 0.5 + k;
    return `M0,${y0} C${f(x0 * 0.45)},${y0} ${f(x0 * 0.75)},${f(y1 - 6)} ${f(x0 + 60)},${f(y1)} L${f(x1 - 60)},${f(y1)} C${f(w - (w - x1) * 0.75)},${f(y1 - 6)} ${f(w - (w - x1) * 0.45)},${y0} ${w},${y0}`;
  };
  const body = `${top(0)} L${w},${h} L0,${h} Z`;
  return `<svg class="sk-art" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true" focusable="false">
    <defs><linearGradient id="sb-skirt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#140c08" stop-opacity=".55"/><stop offset="1" stop-color="#090503" stop-opacity=".92"/></linearGradient></defs>
    <path d="${body}" fill="#000" opacity=".6" transform="translate(0,-8)" filter="url(#sb-burn)"/>
    <path d="${body}" fill="url(#sb-pat-wood)"/>
    <path d="${body}" fill="url(#sb-skirt)"/>
    <path d="${top(0)}" fill="none" stroke="#2a1205" stroke-width="5"/>
    <path d="${top(0)}" fill="none" stroke="#c89d54" stroke-width="2.4"/>
    <path d="${top(6)}" fill="none" stroke="#c89d54" stroke-width="1"/>
    <path d="${top(10)}" fill="none" stroke="#e9c57a" stroke-width="1.8" stroke-dasharray=".1 7" stroke-linecap="round" opacity=".7"/>
  </svg>`;
}

/** The quill-flourish rule between the narration and the "Earlier" margin (stretches vertically). */
export const DIVIDER = `<svg class="dv" viewBox="0 0 24 200" preserveAspectRatio="none" aria-hidden="true" focusable="false">
  <path d="M12,2 C14.5,50 16,80 16,100 C16,120 14.5,150 12,198 C9.5,150 8,120 8,100 C8,80 9.5,50 12,2 Z" fill="url(#sb-gold)" stroke="#6e481f" stroke-width=".6" vector-effect="non-scaling-stroke"/>
  <path d="M12,8 V192" stroke="#fff2c8" stroke-width=".7" vector-effect="non-scaling-stroke" opacity=".6"/>
  <path d="M5,30 V170 M19,30 V170" stroke="#8a5a2a" stroke-width=".6" stroke-dasharray="1 3" vector-effect="non-scaling-stroke"/>
</svg>`;
export const DIVIDER_KNOT = `<svg class="dvk" viewBox="-14 -14 28 28" aria-hidden="true" focusable="false">
  <path d="M0,-12 C5,-6 5,6 0,12 C-5,6 -5,-6 0,-12Z" fill="#8c2a1c"/>
  <path d="M0,-6 C-8,-12 -12,-4 -6,0 C-12,4 -8,12 0,6 C8,12 12,4 6,0 C12,-4 8,-12 0,-6Z" fill="none" stroke="#8a5a2a" stroke-width="1"/>
  <circle r="2" fill="#f3d791"/>
</svg>`;

/**
 * The delve's illustration aperture (w×h px): a wide gilt arch (a half
 * ellipse on top) framing the corridor like a plate in the book, with a
 * keystone rosette and acanthus at the springing points.
 */
export function aperture(w: number, h: number): string {
  const ry = h * 0.22;
  const arch = (i: number) => `M${i},${h + 4} L${i},${f(ry)} A${f(w / 2 - i)},${f(ry - i)} 0 0 1 ${f(w - i)},${f(ry)} L${f(w - i)},${h + 4}`;
  return `<svg class="ap-art" viewBox="-40 -50 ${w + 80} ${h + 60}" width="${w + 80}" height="${h + 60}" aria-hidden="true" focusable="false">
    <path d="${arch(0)}" fill="none" stroke="#000" stroke-width="30" opacity=".6" filter="url(#sb-burn)"/>
    <g filter="url(#sb-bevel)">
      <path d="${arch(-9)}" fill="none" stroke="#2a1205" stroke-width="20"/>
      <path d="${arch(-9)}" fill="none" stroke="url(#sb-pat-wood)" stroke-width="16"/>
      <path d="${arch(-2)}" fill="none" stroke="url(#sb-gold-h)" stroke-width="5"/>
      <path d="${arch(-16)}" fill="none" stroke="url(#sb-gold-h)" stroke-width="3"/>
      <path d="${arch(-9)}" fill="none" stroke="#f3d791" stroke-width="2.6" stroke-dasharray=".1 8" stroke-linecap="round"/>
    </g>
    <g filter="url(#sb-drop)"><g filter="url(#sb-bevel)">
      <g transform="translate(${f(w / 2)},-12)">
        ${use("sb-leafA", -8, 0, 180, 0.7)}${use("sb-leafA", 8, 0, 0, 0.7)}${use("sb-leafA", -6, 4, 150, 0.5, true)}${use("sb-leafA", 6, 4, 30, 0.5, true)}
        ${use("sb-curl", -14, -10, 220, 0.6)}${use("sb-curl", 14, -10, -40, 0.6)}${use("sb-rosette", 0, 0, 0, 1.7)}
      </g>
      ${[-9, w + 9].map((x, k) => `<g transform="translate(${f(x)},${f(ry)}) scale(${k ? -1 : 1},1)">${use("sb-leafA", 0, 0, 100, 0.55)}${use("sb-leafA", 0, 0, 80, 0.55, true)}${use("sb-curl", 4, -4, 60, 0.6)}${use("sb-berry-g", 0, 0, 0, 1.6)}</g>`).join("")}
    </g></g>
  </svg>`;
}

/** One wax seal of five on the journal's affinity line: gold with a heart (warmth), crimson and cracked (enmity), or a faint ink ring. */
export function affinitySeal(kind: "warm" | "cold" | "none"): string {
  const blob = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const r = i % 2 ? 8.2 : 9.2;
    return `${f(Math.cos(a) * r)},${f(Math.sin(a) * r)}`;
  }).join(" ");
  if (kind === "none") return `<svg viewBox="-10 -10 20 20" aria-hidden="true"><polygon points="${blob}" fill="none" stroke="#8a5a2a" stroke-width=".9" stroke-dasharray="1.5 1.4" opacity=".6"/></svg>`;
  const fill = kind === "warm" ? "url(#sb-gold)" : "url(#sb-wax)";
  const mark = kind === "warm"
    ? `<path d="M0,4 C-6,-1 -4,-6 0,-3 C4,-6 6,-1 0,4Z" fill="#8a4a16" opacity=".8"/>`
    : `<path d="M-4,-5 L-1,-1 L-3,2 L1,5 M2,-5 L1,-2 L4,1" fill="none" stroke="#3e0606" stroke-width="1"/>`;
  return `<svg viewBox="-10 -10 20 20" aria-hidden="true"><polygon points="${blob}" fill="${fill}" stroke="${kind === "warm" ? "#5a3816" : "#3e0606"}" stroke-width=".7"/><circle r="5.6" fill="none" stroke="${kind === "warm" ? "#7a4c1c" : "#5e0b0b"}" stroke-width=".8"/>${mark}</svg>`;
}
