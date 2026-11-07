/**
 * Inline SVG artwork for the diorama's props. Every prop is drawn so the
 * bottom of its viewBox is where it touches the counter (its contact shadow
 * is part of the drawing). Gradients and filters live once in DEFS (ids
 * prefixed `dr-`), mounted in an always-rendered <svg> at the theme root, so
 * many copies of a prop can share them.
 */
import { esc } from "../contract.js";

export const DEFS = `<svg class="dr-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
<linearGradient id="dr-brass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe7a8"/><stop offset=".35" stop-color="#d4a24a"/><stop offset=".7" stop-color="#7d5420"/><stop offset="1" stop-color="#c8913c"/></linearGradient>
<linearGradient id="dr-brassH" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6e4718"/><stop offset=".3" stop-color="#f3d68c"/><stop offset=".55" stop-color="#c08a36"/><stop offset="1" stop-color="#5c3a12"/></linearGradient>
<linearGradient id="dr-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a6634"/><stop offset=".5" stop-color="#62391a"/><stop offset="1" stop-color="#3a200d"/></linearGradient>
<linearGradient id="dr-woodH" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a200d"/><stop offset=".35" stop-color="#a06c3a"/><stop offset=".6" stop-color="#6e4220"/><stop offset="1" stop-color="#2c1709"/></linearGradient>
<linearGradient id="dr-walnut" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1c0f07"/><stop offset=".4" stop-color="#5b351b"/><stop offset=".7" stop-color="#3a2110"/><stop offset="1" stop-color="#140904"/></linearGradient>
<linearGradient id="dr-mahog" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7a2e18"/><stop offset=".5" stop-color="#3f160a"/><stop offset="1" stop-color="#1c0904"/></linearGradient>
<linearGradient id="dr-verd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a8a70"/><stop offset=".3" stop-color="#466352"/><stop offset=".75" stop-color="#2f4436"/><stop offset="1" stop-color="#1b281f"/></linearGradient>
<linearGradient id="dr-verdH" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1b281f"/><stop offset=".3" stop-color="#58785f"/><stop offset=".6" stop-color="#3b4f41"/><stop offset="1" stop-color="#16201a"/></linearGradient>
<radialGradient id="dr-porc" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fffdf6"/><stop offset=".55" stop-color="#e9dfcd"/><stop offset="1" stop-color="#9c907e"/></radialGradient>
<radialGradient id="dr-tea" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#ffd27a"/><stop offset=".6" stop-color="#c9822a"/><stop offset="1" stop-color="#7a4210"/></radialGradient>
<radialGradient id="dr-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff2c8" stop-opacity=".95"/><stop offset=".25" stop-color="#ffc66a" stop-opacity=".55"/><stop offset="1" stop-color="#ff9a3a" stop-opacity="0"/></radialGradient>
<radialGradient id="dr-flame" cx=".5" cy=".7" r=".6"><stop offset="0" stop-color="#fffbe8"/><stop offset=".4" stop-color="#ffd36a"/><stop offset="1" stop-color="#ff7a1a" stop-opacity="0"/></radialGradient>
<radialGradient id="dr-shadow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#140700" stop-opacity=".78"/><stop offset=".6" stop-color="#140700" stop-opacity=".35"/><stop offset="1" stop-color="#140700" stop-opacity="0"/></radialGradient>
<linearGradient id="dr-glass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".05"/><stop offset=".25" stop-color="#fff" stop-opacity=".35"/><stop offset=".4" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#fff" stop-opacity=".18"/></linearGradient>
<linearGradient id="dr-redL" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9c2f22"/><stop offset=".6" stop-color="#5e140c"/><stop offset="1" stop-color="#330905"/></linearGradient>
<linearGradient id="dr-greenL" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3f6a44"/><stop offset=".6" stop-color="#1f3a24"/><stop offset="1" stop-color="#0f1d12"/></linearGradient>
<linearGradient id="dr-pages" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4e6c4"/><stop offset="1" stop-color="#b59e72"/></linearGradient>
<linearGradient id="dr-ivory" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff8e4"/><stop offset="1" stop-color="#d9c79c"/></linearGradient>
<radialGradient id="dr-sea" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#9fc2b0"/><stop offset=".6" stop-color="#3f6e6a"/><stop offset="1" stop-color="#14302e"/></radialGradient>
<linearGradient id="dr-thread" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4a0c0a"/><stop offset=".35" stop-color="#e0483a"/><stop offset=".6" stop-color="#a51e18"/><stop offset="1" stop-color="#3a0806"/></linearGradient>
<linearGradient id="dr-day" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fb2d8"/><stop offset="1" stop-color="#f2d9a0"/></linearGradient>
<linearGradient id="dr-night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1530"/><stop offset="1" stop-color="#2c3462"/></linearGradient>
<linearGradient id="dr-dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3a6a"/><stop offset=".6" stop-color="#d0704a"/><stop offset="1" stop-color="#f2b46a"/></linearGradient>
<linearGradient id="dr-cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd59a" stop-opacity=".5"/><stop offset="1" stop-color="#ffb060" stop-opacity="0"/></linearGradient>
<filter id="dr-metal" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" result="n"/><feDiffuseLighting in="n" surfaceScale="1.6" lighting-color="#fff" result="l"><feDistantLight azimuth="235" elevation="55"/></feDiffuseLighting><feComposite in="l" in2="SourceGraphic" operator="in" result="lc"/><feBlend in="SourceGraphic" in2="lc" mode="multiply"/></filter>
<filter id="dr-ol" x="-15%" y="-15%" width="130%" height="130%"><feMorphology in="SourceAlpha" operator="dilate" radius="1.8" result="d"/><feFlood flood-color="#ffe24a"/><feComposite in2="d" operator="in" result="o"/><feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="dr-olh" x="-25%" y="-25%" width="150%" height="150%"><feMorphology in="SourceAlpha" operator="dilate" radius="3" result="d"/><feGaussianBlur in="d" stdDeviation="7" result="b"/><feFlood flood-color="#ffc81e" flood-opacity=".85"/><feComposite in2="b" operator="in" result="glow"/><feFlood flood-color="#fff07a"/><feComposite in2="d" operator="in" result="o"/><feMerge><feMergeNode in="glow"/><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="dr-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="dr-blur8" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>
<pattern id="dr-awning" width="96" height="140" patternUnits="userSpaceOnUse"><rect width="48" height="140" fill="#b8362a"/><rect x="48" width="48" height="140" fill="#efe1c2"/><rect width="96" height="140" fill="url(#dr-fold)"/></pattern>
<linearGradient id="dr-fold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset=".25" stop-color="#fff" stop-opacity=".08"/><stop offset=".5" stop-color="#000" stop-opacity=".2"/><stop offset=".75" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient>
<pattern id="dr-scallop" width="96" height="40" patternUnits="userSpaceOnUse"><path d="M0 0 H48 V12 A24 22 0 0 1 0 12 Z" fill="#b8362a"/><path d="M48 0 H96 V12 A24 22 0 0 1 48 12 Z" fill="#efe1c2"/><path d="M0 0 H96 V12 A24 22 0 0 1 48 12 A24 22 0 0 1 0 12 Z" fill="url(#dr-fold)"/><path d="M0 12 A24 22 0 0 0 48 12 A24 22 0 0 0 96 12" fill="none" stroke="#5a1a10" stroke-width="1.5" opacity=".6"/></pattern>
<pattern id="dr-dentil" width="34" height="40" patternUnits="userSpaceOnUse"><rect width="34" height="40" fill="#24140a"/><rect x="5" y="4" width="22" height="30" fill="#6e4524"/><rect x="5" y="4" width="22" height="4" fill="#a87244"/><rect x="24" y="4" width="3" height="30" fill="#2c180b"/></pattern>
</defs></svg>`;

const shadow = (cx: number, cy: number, rx: number, ry: number) => `<ellipse class="cs" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#dr-shadow)"/>`;

/** An easel in three legs; the painting board is an HTML element laid over it. */
export const EASEL = `<svg viewBox="0 0 300 420" aria-hidden="true">
${shadow(150, 410, 140, 12)}<g class="bd">
<path d="M147 30 L155 30 L176 402 L168 404 Z" fill="#2a160a"/>
<path d="M128 14 L144 14 L58 412 L38 410 Z" fill="url(#dr-woodH)"/><path d="M131 16 L136 16 L52 408 L46 408 Z" fill="#c48a52" opacity=".35"/>
<path d="M156 14 L172 14 L262 410 L242 412 Z" fill="url(#dr-woodH)"/><path d="M160 16 L165 16 L254 408 L248 408 Z" fill="#c48a52" opacity=".3"/>
<rect x="64" y="372" width="172" height="11" rx="3" fill="url(#dr-wood)"/>
<path d="M22 322 L278 322 L286 334 L14 334 Z" fill="#b07a44"/><rect x="14" y="334" width="272" height="18" fill="url(#dr-wood)"/><rect x="14" y="350" width="272" height="3" fill="#1b0d05"/>
<circle cx="40" cy="343" r="4" fill="url(#dr-brass)"/><circle cx="260" cy="343" r="4" fill="url(#dr-brass)"/>
<rect x="118" y="2" width="64" height="22" rx="4" fill="url(#dr-wood)"/><rect x="118" y="2" width="64" height="4" rx="2" fill="#c08a52" opacity=".6"/>
<circle cx="150" cy="13" r="6" fill="url(#dr-brass)"/><circle cx="148" cy="11" r="2" fill="#fff6d0" opacity=".8"/>
</g></svg>`;

/** The cash register: verdigris cast iron and brass, its price flags showing your purse. */
export function register(coin: number, currency: string): string {
  const digits = String(Math.max(0, Math.min(999999, Math.round(coin))));
  const n = digits.length;
  const fw = Math.min(26, 118 / n);
  const x0 = 130 - (n * (fw + 3)) / 2;
  const flags = [...digits].map((ch, i) => {
    const x = x0 + i * (fw + 3);
    return `<g><rect x="${x.toFixed(1)}" y="56" width="${fw.toFixed(1)}" height="34" rx="2" fill="url(#dr-ivory)" stroke="#5a3a12" stroke-width="1.2"/><text x="${(x + fw / 2).toFixed(1)}" y="82" text-anchor="middle" font-family="'Gambit Cinzel', serif" font-weight="800" font-size="${Math.min(26, fw * 1.05).toFixed(1)}" fill="#3a1a08">${ch}</text></g>`;
  });
  const keys: string[] = [];
  for (let row = 0; row < 3; row++) {
    for (let k = 0; k < 7; k++) {
      const x = 46 + k * 28 + row * 3;
      const y = 152 + row * 20;
      keys.push(`<circle cx="${x}" cy="${y + 2}" r="8.5" fill="#0d140f"/><circle cx="${x}" cy="${y}" r="8" fill="url(#dr-brass)"/><circle cx="${x}" cy="${y - 0.5}" r="5.6" fill="url(#dr-ivory)"/><text x="${x}" y="${y + 3}" text-anchor="middle" font-family="Georgia, serif" font-size="7.5" fill="#3a2410">${(k + 1) * (row + 1) * 5 % 100 || 1}</text>`);
    }
  }
  return `<svg viewBox="0 0 260 250" aria-hidden="true">
${shadow(130, 242, 128, 10)}<g class="bd">
<rect x="8" y="220" width="244" height="24" rx="3" fill="url(#dr-verdH)"/><rect x="8" y="220" width="244" height="4" fill="url(#dr-brass)"/>
<g filter="url(#dr-metal)">
<path d="M20 222 L24 120 L236 120 L240 222 Z" fill="url(#dr-verd)"/>
<path d="M40 120 L44 46 Q130 12 216 46 L220 120 Z" fill="url(#dr-verd)"/>
<path d="M24 120 L236 120 L232 136 L28 136 Z" fill="#567a60"/>
</g>
<path d="M58 34 Q130 -8 202 34 Q186 22 130 18 Q74 22 58 34 Z" fill="url(#dr-brass)"/>
<path d="M118 14 Q130 -6 142 14 Q136 8 130 8 Q124 8 118 14 Z" fill="url(#dr-brass)"/><circle cx="130" cy="4" r="4" fill="url(#dr-brass)"/>
<rect x="52" y="48" width="156" height="50" rx="5" fill="#120a04" stroke="url(#dr-brass)" stroke-width="4"/>
${flags.join("")}
<rect x="54" y="50" width="152" height="46" rx="4" fill="url(#dr-glass)"/>
<text x="130" y="112" text-anchor="middle" font-family="'Gambit Cinzel', serif" font-weight="600" font-size="11" letter-spacing="3" fill="#e9c77a">${esc(currency.toUpperCase().slice(0, 14))}</text>
<path d="M30 128 C46 104 60 140 76 118 M184 118 C200 140 214 104 230 128" fill="none" stroke="#c9a04e" stroke-width="2.4" opacity=".8"/>
<path d="M28 196 C44 182 40 210 58 200 M202 200 C220 210 216 182 232 196" fill="none" stroke="#1a2a1f" stroke-width="3"/>
${keys.join("")}
<rect x="30" y="200" width="200" height="18" rx="2" fill="#2a3a2e" stroke="#c9a04e" stroke-width="1.5"/><rect x="112" y="205" width="36" height="7" rx="3" fill="url(#dr-brass)"/>
<path d="M238 160 L250 160 L256 128" fill="none" stroke="url(#dr-brassH)" stroke-width="5" stroke-linecap="round"/><circle cx="256" cy="124" r="6.5" fill="#6b2a14"/><circle cx="254" cy="122" r="2" fill="#f0b090" opacity=".7"/>
<path d="M24 120 L20 222" stroke="#9fc0a4" stroke-width="1.5" opacity=".5"/>
</g></svg>`;
}

/** A porcelain cup of tea: the tea level and the steam are the party's vigor. */
export function teacup(vigor: number): string {
  const v = Math.max(0, Math.min(1, vigor));
  const ty = 50 + (1 - v) * 30;
  const trx = 41 - (1 - v) * 15;
  const steams = v > 0.7 ? 3 : v > 0.4 ? 2 : v > 0.12 ? 1 : 0;
  const steam = [0, 1, 2].slice(0, steams).map((i) => `<path class="steam s${i}" d="M${56 + i * 14} 40 C${46 + i * 14} 26 ${68 + i * 14} 18 ${58 + i * 14} 2" fill="none" stroke="#fff4dc" stroke-width="3.2" stroke-linecap="round" opacity=".55" filter="url(#dr-blur)"/>`).join("");
  return `<svg viewBox="0 0 150 124" aria-hidden="true">
${shadow(72, 114, 66, 9)}<g class="bd">
<ellipse cx="72" cy="104" rx="64" ry="15" fill="#8d806c"/><ellipse cx="72" cy="101" rx="64" ry="14" fill="url(#dr-porc)"/><ellipse cx="72" cy="101" rx="52" ry="10" fill="none" stroke="#2f5288" stroke-width="2" opacity=".75"/><ellipse cx="72" cy="101" rx="34" ry="6" fill="#bfb29c"/>
<path d="M114 58 C140 54 140 84 110 84" fill="none" stroke="#d9cfbd" stroke-width="7"/><path d="M114 58 C134 56 134 80 110 82" fill="none" stroke="#fffdf6" stroke-width="2" opacity=".7"/>
<path d="M30 50 C30 88 52 100 72 100 C92 100 114 88 114 50 Z" fill="url(#dr-porc)"/>
<path d="M33 66 C46 72 98 72 111 66" fill="none" stroke="#2f5288" stroke-width="3" opacity=".8"/><path d="M36 74 C50 79 94 79 108 74" fill="none" stroke="#2f5288" stroke-width="1.2" opacity=".7"/>
<ellipse cx="72" cy="50" rx="42" ry="11" fill="#cfc4b0"/><ellipse cx="72" cy="51" rx="39" ry="9.5" fill="#8d806c"/>
${v > 0.02 ? `<ellipse cx="72" cy="${Math.min(57, ty).toFixed(1)}" rx="${Math.max(10, trx * (ty > 57 ? 0.7 : 1)).toFixed(1)}" ry="${(7.5 - (1 - v) * 3).toFixed(1)}" fill="url(#dr-tea)"/><ellipse cx="64" cy="${(Math.min(57, ty) - 2).toFixed(1)}" rx="12" ry="2" fill="#fff0c0" opacity=".55"/>` : ""}
<ellipse cx="72" cy="50" rx="42" ry="11" fill="none" stroke="#c9a04e" stroke-width="1.6"/>
${steam}
</g></svg>`;
}

const TIME_SAND: Record<string, number> = { morning: 0.85, afternoon: 0.55, evening: 0.28, night: 0.06 };
/** An hourglass on turned spindles; the sand left in the top is the time of day. */
export function hourglass(time: string): string {
  const s = TIME_SAND[time] ?? 0.5;
  const topY = 30 + (1 - s) * 44;
  const pile = 132 - (1 - s) * 40;
  return `<svg viewBox="0 0 90 156" aria-hidden="true">
${shadow(45, 150, 42, 6)}<g class="bd">
<rect x="6" y="138" width="78" height="12" rx="3" fill="url(#dr-wood)"/><ellipse cx="45" cy="138" rx="39" ry="5" fill="#a87244"/>
<rect x="6" y="10" width="78" height="12" rx="3" fill="url(#dr-wood)"/><ellipse cx="45" cy="10" rx="39" ry="5" fill="#b8824e"/>
<path d="M18 22 C18 60 42 66 43 80 C42 94 18 100 18 138 L72 138 C72 100 48 94 47 80 C48 66 72 60 72 22 Z" fill="#cfe2e8" opacity=".18"/>
<path d="M${(20 + (topY - 22) * 0.36).toFixed(1)} ${topY.toFixed(1)} L${(70 - (topY - 22) * 0.36).toFixed(1)} ${topY.toFixed(1)} C66 62 48 68 45 80 C42 68 24 62 ${(20 + (topY - 22) * 0.36).toFixed(1)} ${topY.toFixed(1)} Z" fill="#e3b768"/>
<path d="M20 138 C24 ${pile.toFixed(1)} 40 ${(pile - 6).toFixed(1)} 45 ${(pile - 8).toFixed(1)} C50 ${(pile - 6).toFixed(1)} 66 ${pile.toFixed(1)} 70 138 Z" fill="#d9a85a"/>
${s > 0.05 ? `<line class="sand" x1="45" y1="80" x2="45" y2="${(pile - 8).toFixed(1)}" stroke="#e8c27a" stroke-width="1.6" stroke-dasharray="3 3"/>` : ""}
<path d="M18 22 C18 60 42 66 43 80 C42 94 18 100 18 138 M72 22 C72 60 48 66 47 80 C48 94 72 100 72 138" fill="none" stroke="#f4fbff" stroke-width="1.6" opacity=".55"/>
<path d="M24 30 C24 54 34 62 38 70" fill="none" stroke="#fff" stroke-width="2.5" opacity=".35"/>
${[10, 45, 80].map((x) => `<rect x="${x - 3}" y="20" width="6" height="120" rx="3" fill="url(#dr-woodH)"/><circle cx="${x}" cy="48" r="4.5" fill="url(#dr-wood)"/><circle cx="${x}" cy="112" r="4.5" fill="url(#dr-wood)"/>`).join("")}
</g></svg>`;
}

/** A dagger stabbed through a bounty notice into the counter. */
export const DAGGER = `<svg viewBox="0 0 130 180" aria-hidden="true">
${shadow(68, 170, 56, 7)}<g class="bd">
<path d="M18 96 L104 88 L112 164 Q70 172 24 168 Z" fill="#e6d4a8"/><path d="M18 96 L104 88 L112 164 Q70 172 24 168 Z" fill="url(#dr-pages)" opacity=".45"/>
<path d="M104 88 L112 164 L106 158 Z" fill="#a8916a"/>
<text x="64" y="116" text-anchor="middle" font-family="'Gambit Cinzel', serif" font-weight="800" font-size="15" fill="#4a1a0c" transform="rotate(-4 64 116)">BOUNTY</text>
<g stroke="#5a3a22" stroke-width="1.6" opacity=".7" transform="rotate(-4 64 130)"><line x1="34" y1="128" x2="96" y2="128"/><line x1="34" y1="137" x2="90" y2="137"/><line x1="34" y1="146" x2="94" y2="146"/></g>
<circle cx="88" cy="156" r="8" fill="#8e1c14"/><circle cx="88" cy="156" r="5" fill="#b8352a"/>
<path d="M62 64 L74 64 L69 172 L67 172 Z" fill="#c8ced4"/><path d="M68 64 L74 64 L68.5 170 Z" fill="#7d8790"/><path d="M64 70 L66 70 L67.5 150 Z" fill="#fff" opacity=".6"/>
<rect x="42" y="56" width="52" height="9" rx="4" fill="url(#dr-brass)"/><circle cx="42" cy="60.5" r="5.5" fill="url(#dr-brass)"/><circle cx="94" cy="60.5" r="5.5" fill="url(#dr-brass)"/>
<rect x="61" y="18" width="14" height="40" rx="5" fill="#3a1d10"/>
${[22, 29, 36, 43, 50].map((y) => `<path d="M61 ${y} L75 ${y + 5}" stroke="#7a4a2a" stroke-width="2.4"/>`).join("")}
<circle cx="68" cy="13" r="8" fill="url(#dr-brass)"/><circle cx="66" cy="11" r="2.5" fill="#fff6d0" opacity=".8"/>
</g></svg>`;

/** A brass lantern with a candle (the way into a delve, or out of it). */
export const LANTERN = `<svg viewBox="0 0 110 190" aria-hidden="true">
<circle class="halo" cx="55" cy="110" r="70" fill="url(#dr-glow)"/>
${shadow(55, 182, 46, 7)}<g class="bd">
<path d="M40 20 Q55 -4 70 20" fill="none" stroke="url(#dr-brass)" stroke-width="5"/>
<path d="M30 52 L55 22 L80 52 Z" fill="url(#dr-brass)"/><rect x="26" y="50" width="58" height="9" rx="2" fill="url(#dr-brassH)"/>
<rect x="30" y="59" width="50" height="98" fill="#2a1406" opacity=".55"/>
<rect x="49" y="116" width="12" height="38" rx="2" fill="url(#dr-ivory)"/>
<ellipse class="flame" cx="55" cy="104" rx="9" ry="17" fill="url(#dr-flame)"/><ellipse cx="55" cy="108" rx="3" ry="6" fill="#fff"/>
<rect x="30" y="59" width="50" height="98" fill="url(#dr-glass)"/>
<g fill="url(#dr-brassH)"><rect x="27" y="59" width="6" height="100"/><rect x="77" y="59" width="6" height="100"/><rect x="52" y="59" width="3" height="100" opacity=".7"/></g>
<rect x="22" y="156" width="66" height="12" rx="2" fill="url(#dr-brassH)"/><rect x="18" y="168" width="74" height="10" rx="3" fill="url(#dr-brass)"/>
</g></svg>`;

/** A book lying flat on the counter, its fore-edge toward you; `tone` picks the leather. */
export function book(tone: "red" | "green", title: string): string {
  const L = tone === "red" ? "dr-redL" : "dr-greenL";
  return `<svg viewBox="0 0 220 96" aria-hidden="true">
${shadow(110, 86, 108, 8)}<g class="bd">
<path d="M18 18 L202 18 L216 56 L4 56 Z" fill="url(#${L})"/>
<path d="M28 23 L192 23 L203 51 L17 51 Z" fill="none" stroke="#d9b060" stroke-width="1.6" opacity=".85"/>
<path d="M18 18 L36 18 L28 30 L12 30 Z M202 18 L184 18 L192 30 L208 30 Z" fill="url(#dr-brass)" opacity=".9"/>
<text x="110" y="43" text-anchor="middle" font-family="'Gambit Cinzel', serif" font-weight="800" font-size="13" letter-spacing="2" fill="#e8c578">${esc(title.toUpperCase())}</text>
<rect x="6" y="56" width="208" height="16" fill="url(#dr-pages)"/>
${[59, 62, 65, 68].map((y) => `<line x1="8" y1="${y}" x2="212" y2="${y}" stroke="#9c8458" stroke-width=".7" opacity=".6"/>`).join("")}
<path d="M4 56 L6 56 L6 74 L4 76 Z M216 56 L214 56 L214 74 L216 76 Z" fill="url(#${L})"/>
<path d="M4 74 L216 74 L216 79 L4 79 Z" fill="url(#${L})"/>
<path d="M150 56 L162 56 L162 92 L156 86 L150 92 Z" fill="${tone === "red" ? "#d8b45a" : "#c9473a"}"/>
</g></svg>`;
}

/** A brass-and-walnut globe (the theme switcher). */
export const GLOBE = `<svg viewBox="0 0 130 180" aria-hidden="true">
${shadow(65, 172, 56, 7)}<g class="bd">
<ellipse cx="65" cy="166" rx="46" ry="9" fill="#2a1608"/><path d="M19 158 L111 158 L111 166 Q65 178 19 166 Z" fill="url(#dr-walnut)"/><ellipse cx="65" cy="158" rx="46" ry="9" fill="#7a4a26"/>
<path d="M58 158 L60 128 L70 128 L72 158 Z" fill="url(#dr-brassH)"/><ellipse cx="65" cy="128" rx="14" ry="4" fill="url(#dr-brass)"/>
<g transform="rotate(-20 65 72)">
<circle cx="65" cy="72" r="46" fill="url(#dr-sea)"/>
<path d="M34 50 C44 38 60 42 62 52 C66 62 54 66 58 78 C60 88 48 96 40 90 C30 80 26 62 34 50 Z" fill="#b89b5e"/>
<path d="M74 34 C86 32 100 42 98 56 C96 66 84 62 80 70 C76 78 86 92 76 100 C70 104 66 92 70 82 C72 70 64 62 68 52 C70 44 68 38 74 34 Z" fill="#a88a50"/>
<path d="M30 72 L100 72" stroke="#e8d7a8" stroke-width=".8" opacity=".5"/><ellipse cx="65" cy="72" rx="18" ry="46" fill="none" stroke="#e8d7a8" stroke-width=".8" opacity=".4"/>
<circle cx="50" cy="54" r="16" fill="#fff" opacity=".18"/>
<path d="M65 18 A54 54 0 0 1 65 126" fill="none" stroke="url(#dr-brassH)" stroke-width="6"/><circle cx="65" cy="20" r="3.5" fill="url(#dr-brass)"/><circle cx="65" cy="124" r="3.5" fill="url(#dr-brass)"/>
</g>
</g></svg>`;

const HAND_ANGLE: Record<string, [number, number]> = { morning: [270, 0], afternoon: [90, 0], evening: [180, 180], night: [330, 0] };
/** A pendulum wall clock with a day/night disc in an arched window above the hands. */
export function clock(time: string): string {
  const [hr, mn] = HAND_ANGLE[time] ?? [0, 0];
  const sky = time === "night" ? "dr-night" : time === "evening" ? "dr-dusk" : "dr-day";
  const body = time === "night" || time === "evening"
    ? `<path d="M80 54 a9 9 0 1 0 8 14 a7 7 0 1 1 -8 -14 Z" fill="#f2e6b8"/><circle cx="62" cy="58" r="1.2" fill="#fff"/><circle cx="98" cy="52" r="1.4" fill="#fff"/><circle cx="70" cy="47" r="1" fill="#fff"/>`
    : `<circle cx="80" cy="58" r="9" fill="#ffd66a"/><circle cx="80" cy="58" r="13" fill="#ffd66a" opacity=".3"/>`;
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 * Math.PI) / 180;
    const r0 = i % 3 === 0 ? 38 : 41;
    return `<line x1="${(80 + Math.sin(a) * r0).toFixed(1)}" y1="${(110 - Math.cos(a) * r0).toFixed(1)}" x2="${(80 + Math.sin(a) * 45).toFixed(1)}" y2="${(110 - Math.cos(a) * 45).toFixed(1)}" stroke="#3a2410" stroke-width="${i % 3 === 0 ? 3 : 1.5}"/>`;
  }).join("");
  return `<svg viewBox="0 0 160 300" aria-hidden="true">
<path d="M14 40 Q80 -14 146 40 L146 50 L14 50 Z" fill="url(#dr-wood)"/><path d="M24 40 Q80 0 136 40" fill="none" stroke="#c99a5c" stroke-width="2" opacity=".6"/>
<path d="M70 8 Q80 -6 90 8 Q84 4 80 4 Q76 4 70 8 Z" fill="url(#dr-brass)"/>
<rect x="14" y="48" width="132" height="128" rx="6" fill="url(#dr-walnut)"/><rect x="20" y="54" width="120" height="116" rx="5" fill="none" stroke="#a06a3a" stroke-width="2" opacity=".6"/>
<circle cx="80" cy="110" r="54" fill="url(#dr-brass)"/><circle cx="80" cy="110" r="49" fill="url(#dr-ivory)"/>
<path d="M50 72 A32 32 0 0 1 110 72 L104 80 A24 24 0 0 0 56 80 Z" fill="url(#${sky})"/>
<g clip-path="none">${body}</g>
<path d="M50 72 A32 32 0 0 1 110 72" fill="none" stroke="#7d5420" stroke-width="2"/>
${ticks}
<g transform="rotate(${hr} 80 110)"><path d="M77 112 L80 80 L83 112 Z" fill="#1d1208"/></g>
<g transform="rotate(${mn} 80 110)"><path d="M78.5 112 L80 68 L81.5 112 Z" fill="#1d1208"/></g>
<circle cx="80" cy="110" r="4" fill="url(#dr-brass)"/>
<path d="M26 176 L134 176 L126 268 L34 268 Z" fill="url(#dr-walnut)"/>
<path d="M40 184 L120 184 L114 258 L46 258 Z" fill="#120904"/>
<g class="pend"><line x1="80" y1="184" x2="80" y2="236" stroke="url(#dr-brassH)" stroke-width="3"/><circle cx="80" cy="240" r="12" fill="url(#dr-brass)"/><circle cx="76" cy="236" r="3.5" fill="#fff6d0" opacity=".7"/></g>
<path d="M40 184 L120 184 L114 258 L46 258 Z" fill="url(#dr-glass)"/>
<path d="M34 268 L126 268 L114 286 L46 286 Z" fill="url(#dr-wood)"/><circle cx="80" cy="292" r="6" fill="url(#dr-brass)"/>
</svg>`;
}

/** The quest-thread rack: one spool per revelation, wound red when found. */
export function spoolRack(found: number, total: number): string {
  const n = Math.max(1, Math.min(9, total));
  const W = 40 + n * 46;
  const spools = Array.from({ length: n }, (_, i) => {
    const x = 32 + i * 46;
    const on = i < found;
    const core = on
      ? `<rect x="${x - 13}" y="44" width="26" height="40" fill="url(#dr-thread)"/>${[48, 54, 60, 66, 72, 78].map((y) => `<path d="M${x - 13} ${y} L${x + 13} ${y + 2}" stroke="#ff9a7a" stroke-width=".8" opacity=".55"/>`).join("")}<path d="M${x + 10} 84 C${x + 16} 100 ${x + 6} 108 ${x + 12} 122" fill="none" stroke="#c7261d" stroke-width="2"/>`
      : `<rect x="${x - 8}" y="44" width="16" height="40" fill="#c7a77a"/><rect x="${x - 8}" y="44" width="5" height="40" fill="#e3c9a0" opacity=".6"/>`;
    return `<g class="spool${on ? " on" : ""}">
<line x1="${x}" y1="20" x2="${x}" y2="36" stroke="url(#dr-brassH)" stroke-width="3"/>
<ellipse cx="${x}" cy="40" rx="18" ry="5.5" fill="#6e4220"/><ellipse cx="${x}" cy="39" rx="18" ry="5" fill="#b07a44"/>
${core}
<ellipse cx="${x}" cy="86" rx="18" ry="5.5" fill="#5a341a"/><ellipse cx="${x}" cy="84" rx="18" ry="5" fill="#9a6634"/>
${on ? `<circle cx="${x}" cy="64" r="26" fill="url(#dr-glow)" opacity=".45"/>` : ""}
</g>`;
  });
  return `<svg viewBox="0 0 ${W} 130" aria-hidden="true">
<rect x="0" y="6" width="${W}" height="16" rx="3" fill="url(#dr-wood)"/><rect x="0" y="6" width="${W}" height="3" fill="#c48a52" opacity=".5"/>
<path d="M6 22 L20 22 L6 40 Z M${W - 6} 22 L${W - 20} 22 L${W - 6} 40 Z" fill="#3a200d"/>
${spools.join("")}
</svg>`;
}

/** A hanging brass lamp: chain from the lintel, a fluted shade, a glowing bulb. */
export const LAMP = `<svg viewBox="0 0 160 260" aria-hidden="true">
${Array.from({ length: 8 }, (_, i) => `<ellipse cx="80" cy="${8 + i * 16}" rx="${i % 2 ? 3 : 5}" ry="8" fill="none" stroke="url(#dr-brassH)" stroke-width="3"/>`).join("")}
<circle cx="80" cy="190" r="70" fill="url(#dr-glow)"/>
<rect x="72" y="132" width="16" height="14" rx="3" fill="url(#dr-brass)"/>
<path d="M30 196 Q34 150 80 144 Q126 150 130 196 Z" fill="url(#dr-brassH)"/>
${[44, 58, 72, 88, 102, 116].map((x) => `<path d="M${x} 194 Q${x + (x - 80) * 0.1} 160 ${80 + (x - 80) * 0.4} 148" stroke="#5a3a12" stroke-width="1.3" fill="none" opacity=".6"/>`).join("")}
<ellipse cx="80" cy="196" rx="50" ry="8" fill="#7d5420"/><ellipse cx="80" cy="197" rx="44" ry="6" fill="#fff4cc"/>
<ellipse cx="80" cy="204" rx="16" ry="12" fill="#fffbe8"/>
</svg>`;

const SHORT: Record<string, string> = { forward: "Ahead", back: "Back", left: "Left", right: "Right" };
/** A compass rose lying on the counter: the delve's moves. Each wedge is a button. */
export function compass(labels: { fwd?: string; left?: string; right?: string; back?: string; search?: string }): string {
  const wedge = (key: string, label: string | undefined, d: string, tx: number, ty: number) =>
    label
      ? `<g class="cw" role="button" tabindex="0" data-act="m:move:${key}" aria-label="${esc(label)}"><title>${esc(label)}</title><path d="${d}" fill="url(#dr-brass)" stroke="#3a2410" stroke-width="2"/><text x="${tx}" y="${ty}" text-anchor="middle" font-family="'Gambit Cinzel', serif" font-weight="800" font-size="17" fill="#2a1608">${esc(SHORT[key] ?? label)}</text></g>`
      : "";
  return `<svg viewBox="0 0 340 190" aria-hidden="false">
${shadow(170, 168, 168, 18)}<g class="bd">
<ellipse cx="170" cy="104" rx="166" ry="66" fill="#3a2410"/><ellipse cx="170" cy="98" rx="166" ry="66" fill="url(#dr-brass)"/>
<ellipse cx="170" cy="98" rx="150" ry="58" fill="url(#dr-ivory)"/>
<ellipse cx="170" cy="98" rx="140" ry="53" fill="none" stroke="#7d5420" stroke-width="1.5"/>
<path d="M170 46 L178 92 L230 98 L178 104 L170 150 L162 104 L110 98 L162 92 Z" fill="#c9a04e" opacity=".35"/>
${wedge("forward", labels.fwd, "M126 44 L214 44 L194 74 L146 74 Z", 170, 64)}
${wedge("back", labels.back, "M146 122 L194 122 L216 152 L124 152 Z", 170, 144)}
${wedge("left", labels.left, "M22 98 L82 70 L118 82 L118 114 L82 126 Z", 70, 104)}
${wedge("right", labels.right, "M318 98 L258 70 L222 82 L222 114 L258 126 Z", 270, 104)}
${labels.search ? `<g class="cw" role="button" tabindex="0" data-act="m:move:search" aria-label="${esc(labels.search)}"><ellipse cx="170" cy="98" rx="46" ry="20" fill="#5a1f12" stroke="url(#dr-brass)" stroke-width="3"/><text x="170" y="104" text-anchor="middle" font-family="'Gambit Cinzel', serif" font-weight="800" font-size="16" fill="#f3d68c">${esc(labels.search.length > 12 ? "Search" : labels.search)}</text></g>` : ""}
</g></svg>`;
}

/** One supply jar, full or empty. */
export function jar(full: boolean): string {
  return `<svg viewBox="0 0 40 60" aria-hidden="true">${shadow(20, 56, 18, 4)}<g class="bd">
<path d="M8 18 Q4 20 4 28 L4 50 Q4 56 12 56 L28 56 Q36 56 36 50 L36 28 Q36 20 32 18 Z" fill="#cfe2e8" opacity=".22"/>
${full ? `<path d="M6 26 L34 26 L34 50 Q34 54 28 54 L12 54 Q6 54 6 50 Z" fill="#c78a3a"/><path d="M6 26 L34 26" stroke="#f0c070" stroke-width="2"/>` : ""}
<path d="M8 18 Q4 20 4 28 L4 50 Q4 56 12 56 L28 56 Q36 56 36 50 L36 28 Q36 20 32 18 Z" fill="none" stroke="#e6f4f8" stroke-width="1.4" opacity=".6"/>
<rect x="9" y="8" width="22" height="11" rx="2" fill="#7a4a26"/><rect x="7" y="16" width="26" height="4" rx="1" fill="#c9b28a"/>
<rect x="9" y="26" width="4" height="24" fill="#fff" opacity=".25"/></g></svg>`;
}

/** A sealed letter (any action without a prop of its own). */
export const LETTER = `<svg viewBox="0 0 120 90" aria-hidden="true">${shadow(60, 84, 56, 6)}<g class="bd">
<path d="M6 20 L114 14 L116 80 L8 84 Z" fill="#e6d4a8"/><path d="M6 20 L60 52 L114 14" fill="none" stroke="#a8916a" stroke-width="2"/>
<path d="M8 84 L54 54 M116 80 L66 52" stroke="#c7b48a" stroke-width="1.5"/>
<circle cx="60" cy="52" r="11" fill="#8e1c14"/><circle cx="60" cy="52" r="7" fill="#b8352a"/><path d="M55 52 L65 52 M60 47 L60 57" stroke="#6a1008" stroke-width="1.6"/></g></svg>`;

/** A red wax seal stamped NEW (a place you have not been to before). */
export const SEAL_NEW = `<svg viewBox="0 0 80 80" aria-hidden="true"><path d="M40 4 C52 2 58 10 66 14 C74 20 78 30 76 40 C78 52 70 60 64 68 C56 76 46 78 38 76 C26 78 18 70 12 64 C4 56 2 46 4 36 C4 24 12 16 18 10 C26 4 32 6 40 4 Z" fill="#8e1c14"/><circle cx="40" cy="40" r="26" fill="#b02e22"/><circle cx="40" cy="40" r="22" fill="none" stroke="#6a1008" stroke-width="2"/><text x="40" y="47" text-anchor="middle" font-family="'Gambit Cinzel', serif" font-weight="800" font-size="19" fill="#f3c6a8">NEW</text><ellipse cx="30" cy="28" rx="8" ry="4" fill="#fff" opacity=".2"/></svg>`;

/** A cut-out figure while a person's art is still being prepared. */
export const SILHOUETTE = `<svg viewBox="0 0 200 300" aria-hidden="true"><path d="M100 20 C126 20 138 42 136 66 C134 90 120 104 100 104 C80 104 66 90 64 66 C62 42 74 20 100 20 Z M40 300 C40 200 50 140 100 128 C150 140 160 200 160 300 Z" fill="#1a0f08"/><path d="M100 20 C126 20 138 42 136 66" fill="none" stroke="#e8a860" stroke-width="2" opacity=".5"/></svg>`;

/**
 * A carved mahogany frame with gilt filigree corners, for opaque portraits
 * stood on the counter. Drawn in a w×h viewBox matching the portrait's
 * aspect; the art itself sits in an HTML window at the frame's opening.
 */
export function frame(w: number, h: number): string {
  const b = Math.round(Math.min(w, h) * 0.085);
  const k = Math.min(w, h) / 200;
  const fil = (x: number, y: number, sx: number, sy: number) =>
    `<g transform="translate(${x} ${y}) scale(${sx * k} ${sy * k})"><path d="M0 0 C10 2 16 8 18 18 C12 12 6 12 4 18 C2 10 -2 6 0 0 Z M0 0 C2 10 8 16 18 18" fill="url(#dr-brass)" stroke="#5a3a12" stroke-width=".6"/><circle cx="9" cy="9" r="2.4" fill="#fbe7a8"/></g>`;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
<path fill-rule="evenodd" d="M0 0 H${w} V${h} H0 Z M${b} ${b} V${h - b} H${w - b} V${b} Z" fill="url(#dr-mahog)"/>
<path fill-rule="evenodd" d="M4 4 H${w - 4} V${h - 4} H4 Z M9 9 V${h - 9} H${w - 9} V9 Z" fill="#c08048" opacity=".45"/>
<path fill-rule="evenodd" d="M${b * 0.45} ${b * 0.45} H${w - b * 0.45} V${h - b * 0.45} H${b * 0.45} Z M${b * 0.55} ${b * 0.55} V${h - b * 0.55} H${w - b * 0.55} V${b * 0.55} Z" fill="#1a0804" opacity=".6"/>
<rect x="${b - 4}" y="${b - 4}" width="${w - 2 * b + 8}" height="${h - 2 * b + 8}" fill="none" stroke="url(#dr-brass)" stroke-width="5"/>
<rect x="${b - 0.5}" y="${b - 0.5}" width="${w - 2 * b + 1}" height="${h - 2 * b + 1}" fill="none" stroke="#120602" stroke-width="2"/>
<path d="M0 0 L${b} ${b} M${w} 0 L${w - b} ${b} M0 ${h} L${b} ${h - b} M${w} ${h} L${w - b} ${h - b}" stroke="#1a0804" stroke-width="1.2" opacity=".7"/>
${fil(5, 5, 1, 1)}${fil(w - 5, 5, -1, 1)}${fil(5, h - 5, 1, -1)}${fil(w - 5, h - 5, -1, -1)}
<path d="M${w / 2 - 40 * k} ${b * 0.5} Q${w / 2} ${-b * 0.6} ${w / 2 + 40 * k} ${b * 0.5} Q${w / 2} ${b * 1.1} ${w / 2 - 40 * k} ${b * 0.5} Z" fill="url(#dr-brass)" stroke="#5a3a12" stroke-width="1"/><circle cx="${w / 2}" cy="${b * 0.45}" r="${5 * k}" fill="#8e1c14"/>
</svg>`;
}

/** The pedestal a standee frame is mounted in. */
export const PEDESTAL = `<svg viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">${shadow(100, 34, 98, 7)}<g class="bd"><path d="M20 4 L180 4 L192 22 L8 22 Z" fill="#8a5a30"/><path d="M8 22 L192 22 L192 32 L8 32 Z" fill="url(#dr-wood)"/><path d="M20 4 L180 4" stroke="#d9a060" stroke-width="2" opacity=".6"/></g></svg>`;

/** The narration awning: a dark slate shape pitched at the centre with a gilt ridge. */
export const AWNING = `<svg class="aw-bg" viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true">
<path d="M0 64 Q8 52 30 50 L470 6 Q500 0 530 6 L970 50 Q992 52 1000 64 L1000 284 Q1000 300 984 300 L16 300 Q0 300 0 284 Z" fill="#120e0b" fill-opacity=".9"/>
<path d="M0 64 Q8 52 30 50 L470 6 Q500 0 530 6 L970 50 Q992 52 1000 64" fill="none" stroke="#e2b763" stroke-width="2.4" vector-effect="non-scaling-stroke"/>
<path d="M14 70 Q20 62 36 60 L470 18 Q500 13 530 18 L964 60 Q980 62 986 70" fill="none" stroke="#e2b763" stroke-opacity=".35" stroke-width="1" vector-effect="non-scaling-stroke"/>
</svg>`;

/** Postcard furniture: a stamp and a postmark over the painting. */
export const POSTMARK = `<svg class="pm" viewBox="0 0 60 40" aria-hidden="true"><rect x="36" y="2" width="22" height="26" fill="#efe1c2" stroke="#b8362a" stroke-width="1.5" stroke-dasharray="2 1.5"/><rect x="40" y="6" width="14" height="18" fill="#3f6e6a"/><circle cx="30" cy="20" r="14" fill="none" stroke="#2a1608" stroke-width="1.4" opacity=".6"/><path d="M8 14 Q20 10 32 14 T56 14 M8 20 Q20 16 32 20 T56 20" fill="none" stroke="#2a1608" stroke-width="1.2" opacity=".55"/></svg>`;

/** The slotted wooden block the postcards stand in. */
export const CARD_RACK = `<svg viewBox="0 0 400 50" preserveAspectRatio="none" aria-hidden="true">${shadow(200, 44, 196, 7)}<g class="bd"><path d="M10 8 L390 8 L398 24 L2 24 Z" fill="#9a6634"/><rect x="2" y="24" width="396" height="18" fill="url(#dr-wood)"/>${[70, 150, 230, 310].map((x) => `<rect x="${x}" y="10" width="40" height="5" rx="2" fill="#2a1608"/>`).join("")}<path d="M10 8 L390 8" stroke="#d9a060" stroke-width="2" opacity=".5"/></g></svg>`;

/** A postcard's painted view when the destination has no painting yet: hills, a road, a far tower. */
export function vista(seed: number): string {
  const h1 = 50 + (seed % 17), h2 = 62 + (seed % 11);
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="100" height="100" fill="url(#dr-dusk)"/><circle cx="${30 + (seed % 40)}" cy="38" r="9" fill="#ffe2a0" opacity=".85"/>
<path d="M0 ${h1} Q25 ${h1 - 14} 50 ${h1 - 4} T100 ${h1 - 8} V100 H0 Z" fill="#5a5a6a"/><rect x="${60 + (seed % 20)}" y="${h1 - 26}" width="5" height="22" fill="#2a2a38"/><path d="M${59 + (seed % 20)} ${h1 - 26} L${62.5 + (seed % 20)} ${h1 - 32} L${66 + (seed % 20)} ${h1 - 26} Z" fill="#2a2a38"/>
<path d="M0 ${h2} Q30 ${h2 - 10} 60 ${h2} T100 ${h2 - 4} V100 H0 Z" fill="#3d4a3a"/><path d="M46 100 Q50 ${h2 + 8} 56 ${h2 + 2}" fill="none" stroke="#c9a46a" stroke-width="3" opacity=".7"/></svg>`;
}
