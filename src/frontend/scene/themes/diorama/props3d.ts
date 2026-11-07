/**
 * The counter's props drawn as solids seen from the shop's camera: a little
 * above the counter and looking down at it (~25°), each turned in toward the
 * middle of the counter. Every prop shows its top and one side as well as
 * its front, sits on its own contact shadow, and carries its own label on
 * the object itself (a brass plate, an inked note, a stamped spine), so no
 * prop needs a paper tag. Gradients and filters come from DEFS in art.ts.
 */
import { esc } from "../contract.js";

const shadow = (cx: number, cy: number, rx: number, ry: number) => `<ellipse class="cs" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#dr-shadow)"/>`;
const pts = (p: [number, number][]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
/** Fit a label into a width: a font size in viewBox units. */
const fit = (text: string, width: number, max: number, k = 0.68) => Math.min(max, width / Math.max(1, text.length * k));

/**
 * The cash register in three-quarter view: its front turned toward the
 * middle of the counter, its left side wall and top receding back-left.
 * The price flags show the purse. With a shop here the drawer stands open
 * with coins in it, and the brass plate on the base names the action.
 */
export function register(coin: number, currency: string, shop: string | null): string {
  const D: [number, number] = [-58, -24];
  const back = (p: [number, number], k = 1): [number, number] => [p[0] + D[0] * k, p[1] + D[1] * k];
  const side = (x: number, y0: number, y1: number, k = 1) => pts([[x, y1], [x, y0], back([x, y0], k), back([x, y1], k)]);
  const top = (x0: number, x1: number, y: number, k = 1) => pts([[x0, y], [x1, y], back([x1, y], k), back([x0, y], k)]);
  const digits = String(Math.max(0, Math.min(999999, Math.round(coin))));
  const n = digits.length;
  const fw = Math.min(30, 132 / n);
  const x0 = 186 - (n * (fw + 3)) / 2;
  const flags = [...digits].map((ch, i) => {
    const x = x0 + i * (fw + 3);
    return `<rect x="${x.toFixed(1)}" y="70" width="${fw.toFixed(1)}" height="40" rx="2" fill="url(#dr-ivory)" stroke="#5a3a12" stroke-width="1.4"/><rect x="${x.toFixed(1)}" y="70" width="${fw.toFixed(1)}" height="8" fill="#000" opacity=".18"/><text x="${(x + fw / 2).toFixed(1)}" y="101" text-anchor="middle" font-family="'Gambit Cinzel', serif" font-weight="800" font-size="${Math.min(30, fw * 1.05).toFixed(1)}" fill="#3a1a08">${ch}</text>`;
  });
  // Keys on the sloped deck: foreshortened ellipses, back rows smaller and higher.
  const keys: string[] = [];
  for (let row = 0; row < 3; row++) {
    for (let k = 0; k < 6; k++) {
      const x = 112 + k * 30 + row * 4;
      const y = 150 + row * 19;
      const rx = 9.5 + row * 0.6, ry = 6 + row * 0.6;
      keys.push(`<ellipse cx="${x}" cy="${y + 3}" rx="${rx}" ry="${ry}" fill="#0d140f"/><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#dr-brass)"/><ellipse cx="${x}" cy="${y - 0.6}" rx="${rx - 2.6}" ry="${ry - 2}" fill="url(#dr-ivory)"/>`);
    }
  }
  const plate = (shop ?? "Merchant").toUpperCase();
  const drawer = shop
    ? `<polygon points="${pts([[104, 222], [292, 222], [300, 252], [96, 252]])}" fill="#2a1a0c"/>
<g>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<ellipse cx="${118 + i * 21 + (i % 2) * 6}" cy="${236 + (i % 3) * 3}" rx="9" ry="4" fill="url(#dr-brass)" stroke="#5a3a12" stroke-width=".8"/>`).join("")}<ellipse cx="160" cy="232" rx="5" ry="2" fill="#fff6d0" opacity=".8"/><ellipse cx="236" cy="240" rx="5" ry="2" fill="#fff6d0" opacity=".7"/></g>
<polygon points="${pts([[96, 252], [300, 252], [300, 274], [96, 274]])}" fill="url(#dr-verd)"/><rect x="176" y="258" width="44" height="9" rx="4" fill="url(#dr-brass)"/>`
    : `<rect x="100" y="222" width="196" height="24" rx="2" fill="#2a3a2e" stroke="#c9a04e" stroke-width="1.6"/><rect x="176" y="229" width="44" height="9" rx="4" fill="url(#dr-brass)"/>`;
  return `<svg viewBox="0 0 330 300" aria-hidden="true">
${shadow(170, 286, 160, 16)}<g class="bd">
<polygon points="${side(92, 248, 284)}" fill="#162a24"/><polygon points="${top(92, 312, 248)}" fill="#3b5a48"/>
<rect x="92" y="248" width="220" height="36" fill="url(#dr-verdH)"/><rect x="92" y="248" width="220" height="5" fill="url(#dr-brass)"/>
<g filter="url(#dr-metal)">
<polygon points="${side(100, 128, 250)}" fill="#162a24"/>
<polygon points="${top(100, 300, 128)}" fill="#51735c"/>
<path d="M100 250 L100 128 L300 128 L300 250 Z" fill="url(#dr-verd)"/>
<polygon points="${side(128, 46, 128, 0.55)}" fill="#1b3029"/>
<polygon points="${top(128, 272, 46, 0.55)}" fill="#5f8468"/>
<path d="M128 128 L128 46 L272 46 L272 128 Z" fill="url(#dr-verd)"/>
</g>
<path d="M${back([100, 140])[0] + 6} ${back([100, 140])[1] + 10} C70 150 84 170 64 182 C82 190 72 212 ${back([100, 230])[0] + 8} ${back([100, 230])[1] + 2}" fill="none" stroke="#2a483f" stroke-width="4"/>
<path d="M${back([100, 140])[0] + 6} ${back([100, 140])[1] + 10} C70 150 84 170 64 182 C82 190 72 212 ${back([100, 230])[0] + 8} ${back([100, 230])[1] + 2}" fill="none" stroke="#b89246" stroke-width="1.2" opacity=".55"/>
<polyline points="${pts([[100, 250], [100, 128], back([100, 128])])}" fill="none" stroke="#b89246" stroke-width="2.4"/>
<polyline points="${pts([[128, 128], [128, 46], back([128, 46], 0.55), [272 + D[0] * 0.55, 46 + D[1] * 0.55]])}" fill="none" stroke="#b89246" stroke-width="2"/>
<path d="M136 46 Q200 2 264 46 Q248 30 200 26 Q152 30 136 46 Z" fill="url(#dr-brass)"/>
<path d="M188 22 Q200 2 212 22 Q206 16 200 16 Q194 16 188 22 Z" fill="url(#dr-brass)"/><circle cx="200" cy="10" r="5" fill="url(#dr-brass)"/>
<rect x="138" y="62" width="124" height="56" rx="5" fill="#120a04" stroke="url(#dr-brass)" stroke-width="4"/>
${flags.join("")}
<rect x="140" y="64" width="120" height="52" rx="4" fill="url(#dr-glass)"/>
<text x="200" y="124" text-anchor="middle" font-family="'Gambit Cinzel', serif" font-weight="600" font-size="9.5" letter-spacing="2.5" fill="#e9c77a">${esc(currency.toUpperCase().slice(0, 16))}</text>
<path d="M104 136 L296 136" stroke="#c9a04e" stroke-width="2"/>
${keys.join("")}
<path d="M104 210 C130 198 126 220 150 212 M296 210 C270 198 274 220 250 212" fill="none" stroke="#c9a04e" stroke-width="2" opacity=".75"/>
${drawer}
<rect x="${200 - Math.min(96, plate.length * 6.4 + 22)}" y="${shop ? 276 : 256}" width="${Math.min(192, plate.length * 12.8 + 44)}" height="24" rx="3" fill="url(#dr-brass)" stroke="#5a3a12" stroke-width="1.2"/>
<text x="200" y="${shop ? 294 : 274}" text-anchor="middle" font-family="'Gambit Cinzel', serif" font-weight="800" font-size="${fit(plate, 176, 17, 0.8).toFixed(1)}" letter-spacing="1.5" fill="#261505">${esc(plate)}</text>
<path d="M300 170 L316 170 L322 140" fill="none" stroke="url(#dr-brassH)" stroke-width="6" stroke-linecap="round"/><circle cx="322" cy="134" r="8" fill="#6b2a14"/><circle cx="320" cy="132" r="2.5" fill="#f0b090" opacity=".7"/>
</g></svg>`;
}

/**
 * A cup of tea on a saucer on a folded napkin, seen from above: the mouth
 * is a foreshortened ellipse showing the tea inside (its level and the steam
 * are the party's vigor). The napkin is inked with the vigor; the cup's
 * gilt band says REST when resting is possible here.
 */
export function teacup(vigor: number, rest: boolean): string {
  const v = Math.max(0, Math.min(1, vigor));
  const lvl = 1 - v;
  const ty = 66 + lvl * 16, trx = 46 - lvl * 14, tr = 15 - lvl * 5;
  const steams = v > 0.7 ? 3 : v > 0.4 ? 2 : v > 0.12 ? 1 : 0;
  const steam = [0, 1, 2].slice(0, steams).map((i) => `<path class="steam s${i}" d="M${76 + i * 16} 56 C${64 + i * 16} 40 ${90 + i * 16} 28 ${78 + i * 16} 6" fill="none" stroke="#fff4dc" stroke-width="4" stroke-linecap="round" opacity=".55" filter="url(#dr-blur)"/>`).join("");
  const pct = `VIGOR ${Math.round(v * 100)}%`;
  return `<svg viewBox="0 0 210 190" aria-hidden="true">
${shadow(102, 168, 100, 20)}<g class="bd">
<polygon points="${pts([[18, 128], [188, 112], [206, 168], [6, 182]])}" fill="#d9ccb0"/><polygon points="${pts([[6, 182], [206, 168], [206, 174], [6, 188]])}" fill="#a8987a"/>
<path d="M18 128 L188 112" stroke="#fffaf0" stroke-width="2" opacity=".7"/><path d="M36 136 L176 124 M30 172 L192 160" stroke="#b8a888" stroke-width="1" opacity=".7" stroke-dasharray="4 3"/>
<text transform="matrix(1 -.09 0 .62 104 176)" text-anchor="middle" font-family="'Gambit Cinzel', serif" font-weight="800" font-size="20" letter-spacing="1" fill="#3a1a08">${pct}</text>
<ellipse cx="102" cy="140" rx="80" ry="28" fill="#8d806c"/><ellipse cx="102" cy="136" rx="80" ry="27" fill="url(#dr-porc)"/><ellipse cx="102" cy="136" rx="64" ry="20" fill="none" stroke="#2f5288" stroke-width="2.2" opacity=".75"/><ellipse cx="102" cy="137" rx="40" ry="12" fill="#bfb29c"/>
<path d="M150 82 C182 78 184 120 146 122" fill="none" stroke="#cfc4b0" stroke-width="9"/><path d="M150 84 C176 82 176 116 146 118" fill="none" stroke="#fffdf6" stroke-width="2.5" opacity=".7"/>
<path d="M54 66 C54 112 78 134 102 134 C126 134 150 112 150 66 Z" fill="url(#dr-porc)"/>
<path d="M57 90 C74 102 130 102 147 90" fill="none" stroke="#c9a04e" stroke-width="${rest ? 9 : 3}" opacity=".9"/>
${rest ? `<text transform="matrix(1 0 0 .9 102 101)" text-anchor="middle" font-family="'Gambit Cinzel', serif" font-weight="800" font-size="13" letter-spacing="3" fill="#3a1a08">REST</text>` : ""}
<path d="M60 108 C78 118 126 118 144 108" fill="none" stroke="#2f5288" stroke-width="1.6" opacity=".7"/>
<ellipse cx="102" cy="66" rx="48" ry="18" fill="#e8dfcc"/><ellipse cx="102" cy="67" rx="45" ry="16" fill="#9a8d78"/>
<path d="M57 67 C57 82 147 82 147 67" fill="#b8ab94" opacity=".7"/>
${v > 0.02 ? `<ellipse cx="102" cy="${ty.toFixed(1)}" rx="${trx.toFixed(1)}" ry="${tr.toFixed(1)}" fill="url(#dr-tea)"/><ellipse cx="102" cy="${ty.toFixed(1)}" rx="${(trx - 3).toFixed(1)}" ry="${(tr - 3).toFixed(1)}" fill="none" stroke="#f3d79a" stroke-width="1.6" opacity=".5"/><ellipse cx="88" cy="${(ty - 4).toFixed(1)}" rx="13" ry="3" fill="#fff0c0" opacity=".55"/>` : ""}
<ellipse cx="102" cy="66" rx="48" ry="18" fill="none" stroke="#c9a04e" stroke-width="2"/>
${steam}
</g></svg>`;
}

const TIME_SAND: Record<string, number> = { morning: 0.85, afternoon: 0.55, evening: 0.28, night: 0.06 };
/** An hourglass seen from above: elliptical caps, the sand left in the top is the time of day, WAIT carved in its base. */
export function hourglass(time: string, label: string | null): string {
  const s = TIME_SAND[time] ?? 0.5;
  const topY = 46 + (1 - s) * 50;
  const pile = 176 - (1 - s) * 52;
  const word = (label ?? time).toUpperCase().replace(/ A WHILE$/, "");
  return `<svg viewBox="0 0 130 230" aria-hidden="true">
${shadow(64, 210, 62, 13)}<g class="bd">
<ellipse cx="64" cy="200" rx="60" ry="16" fill="#3a200d"/><path d="M4 180 L124 180 L124 200 A60 16 0 0 1 4 200 Z" fill="url(#dr-wood)"/><ellipse cx="64" cy="180" rx="60" ry="16" fill="#b8824e"/>
<text x="64" y="199" text-anchor="middle" font-family="'Gambit Cinzel', serif" font-weight="800" font-size="${fit(word, 96, 14).toFixed(1)}" letter-spacing="1.5" fill="#2a1408">${esc(word)}</text>
<path d="M26 40 C26 86 60 96 61 112 C60 128 26 138 26 182 L102 182 C102 138 68 128 67 112 C68 96 102 86 102 40 Z" fill="#cfe2e8" opacity=".18"/>
<path d="M${(28 + (topY - 40) * 0.42).toFixed(1)} ${topY.toFixed(1)} L${(100 - (topY - 40) * 0.42).toFixed(1)} ${topY.toFixed(1)} C94 90 68 98 64 112 C60 98 34 90 ${(28 + (topY - 40) * 0.42).toFixed(1)} ${topY.toFixed(1)} Z" fill="#e3b768"/>
<ellipse cx="64" cy="${topY.toFixed(1)}" rx="${(36 - (topY - 40) * 0.42).toFixed(1)}" ry="6" fill="#f0cf86"/>
<path d="M28 182 C32 ${pile.toFixed(1)} 56 ${(pile - 8).toFixed(1)} 64 ${(pile - 10).toFixed(1)} C72 ${(pile - 8).toFixed(1)} 96 ${pile.toFixed(1)} 100 182 Z" fill="#d9a85a"/>
${s > 0.05 ? `<line class="sand" x1="64" y1="112" x2="64" y2="${(pile - 10).toFixed(1)}" stroke="#e8c27a" stroke-width="2" stroke-dasharray="3 3"/>` : ""}
<path d="M26 40 C26 86 60 96 61 112 C60 128 26 138 26 182 M102 40 C102 86 68 96 67 112 C68 128 102 138 102 182" fill="none" stroke="#f4fbff" stroke-width="2" opacity=".55"/>
<path d="M34 52 C34 80 48 92 54 102" fill="none" stroke="#fff" stroke-width="3.5" opacity=".35"/>
${[14, 64, 114].map((x, i) => `<rect x="${x - 4}" y="34" width="8" height="150" rx="4" fill="url(#dr-woodH)" ${i === 1 ? 'opacity=".55"' : ""}/>`).join("")}
<path d="M4 18 L124 18 L124 34 A60 14 0 0 1 4 34 Z" fill="url(#dr-wood)"/><ellipse cx="64" cy="18" rx="60" ry="14" fill="#c4925c"/><ellipse cx="64" cy="18" rx="46" ry="9" fill="none" stroke="#7a4a26" stroke-width="1.5"/>
</g></svg>`;
}

/** A dagger driven into the counter at an angle through a bounty note; the note is inked with the fight. */
export function dagger(label: string): string {
  const line = label.toUpperCase();
  return `<svg viewBox="0 0 220 200" aria-hidden="true">
${shadow(110, 180, 104, 14)}<g class="bd">
<polygon points="${pts([[14, 112], [196, 96], [214, 176], [4, 192]])}" fill="#e6d4a8"/>
<polygon points="${pts([[14, 112], [196, 96], [214, 176], [4, 192]])}" fill="url(#dr-pages)" opacity=".4"/>
<path d="M196 96 L214 176 L204 170 Z" fill="#a8916a"/><path d="M4 192 L24 186 L14 112 Z" fill="#c9b48a" opacity=".6"/>
<text transform="matrix(1 -.085 .06 .78 104 138)" text-anchor="middle" font-family="'Gambit Cinzel', serif" font-weight="800" font-size="26" letter-spacing="2" fill="#5a160c">BOUNTY</text>
<text transform="matrix(1 -.085 .06 .78 108 166)" text-anchor="middle" font-family="'Gambit Fell', serif" font-style="italic" font-size="${fit(line, 170, 20, 0.5).toFixed(1)}" fill="#2a1608">${esc(label)}</text>
<circle cx="182" cy="166" r="11" fill="#8e1c14"/><circle cx="182" cy="166" r="7" fill="#b8352a"/>
<g transform="rotate(28 92 150)">
<path d="M86 34 L100 34 L94 154 L92 154 Z" fill="#c8ced4"/><path d="M93 34 L100 34 L93.5 152 Z" fill="#7d8790"/><path d="M89 40 L91 40 L92.5 130 Z" fill="#fff" opacity=".6"/>
<path d="M62 24 L124 24 L128 34 L58 34 Z" fill="url(#dr-brass)"/><circle cx="60" cy="29" r="7" fill="url(#dr-brass)"/><circle cx="126" cy="29" r="7" fill="url(#dr-brass)"/>
<rect x="85" y="-24" width="16" height="50" rx="6" fill="#3a1d10"/>
${[-20, -12, -4, 4, 12, 20].map((y) => `<path d="M85 ${y} L101 ${y + 6}" stroke="#7a4a2a" stroke-width="2.6"/>`).join("")}
<circle cx="93" cy="-30" r="10" fill="url(#dr-brass)"/><circle cx="90" cy="-33" r="3" fill="#fff6d0" opacity=".8"/>
</g>
<ellipse cx="135" cy="160" rx="5" ry="2.5" fill="#1a0a04"/>
</g></svg>`;
}

/** A brass lantern; its base band names where it leads (into a delve, or out). */
export function lantern(word: string): string {
  const w = word.toUpperCase();
  return `<svg viewBox="0 0 130 230" aria-hidden="true">
<circle class="halo" cx="65" cy="120" r="84" fill="url(#dr-glow)"/>
${shadow(65, 214, 60, 12)}<g class="bd">
<path d="M48 26 Q65 -2 82 26" fill="none" stroke="url(#dr-brass)" stroke-width="6"/>
<path d="M30 62 L65 28 L100 62 Z" fill="url(#dr-brass)"/><ellipse cx="65" cy="62" rx="38" ry="9" fill="url(#dr-brassH)"/>
<polygon points="${pts([[32, 66], [80, 66], [80, 176], [32, 176]])}" fill="#2a1406" opacity=".5"/>
<polygon points="${pts([[80, 66], [100, 60], [100, 168], [80, 176]])}" fill="#2a1406" opacity=".35"/>
<rect x="52" y="128" width="14" height="44" rx="2" fill="url(#dr-ivory)"/>
<ellipse class="flame" cx="59" cy="114" rx="10" ry="19" fill="url(#dr-flame)"/><ellipse cx="59" cy="118" rx="3.5" ry="7" fill="#fff"/>
<polygon points="${pts([[32, 66], [80, 66], [80, 176], [32, 176]])}" fill="url(#dr-glass)"/>
<polygon points="${pts([[80, 66], [100, 60], [100, 168], [80, 176]])}" fill="#fff" opacity=".08"/>
<g fill="url(#dr-brassH)"><rect x="28" y="64" width="7" height="114"/><rect x="77" y="64" width="7" height="114"/><polygon points="${pts([[97, 60], [103, 58], [103, 170], [97, 172]])}"/></g>
<path d="M14 178 L80 178 L116 166 L116 186 L80 200 L14 200 Z" fill="url(#dr-brass)"/><path d="M80 178 L116 166 L116 186 L80 200 Z" fill="#6e4718" opacity=".55"/>
<text x="47" y="195" text-anchor="middle" font-family="'Gambit Cinzel', serif" font-weight="800" font-size="${fit(w, 60, 14, 0.78).toFixed(1)}" fill="#261505">${esc(w)}</text>
</g></svg>`;
}

/**
 * A book lying flat, its spine toward you: the stamped spine (the title in
 * gold leaf), the foreshortened leather cover on top, the page block at the
 * end. `tone` picks the leather.
 */
export function book(tone: "red" | "green", title: string): string {
  const L = tone === "red" ? "dr-redL" : "dr-greenL";
  const t = title.toUpperCase();
  return `<svg viewBox="0 0 260 120" aria-hidden="true">
${shadow(128, 106, 126, 12)}<g class="bd">
<polygon points="${pts([[40, 14], [226, 8], [246, 50], [16, 58]])}" fill="url(#${L})"/>
<polygon points="${pts([[54, 20], [214, 15], [230, 46], [32, 52]])}" fill="none" stroke="#d9b060" stroke-width="1.6" opacity=".8"/>
<polygon points="${pts([[226, 8], [236, 8], [256, 48], [246, 50]])}" fill="url(#dr-pages)"/>
${[0, 1, 2, 3].map((i) => `<line x1="${229 + i * 2}" y1="${9}" x2="${248 + i * 2}" y2="${49}" stroke="#9c8458" stroke-width=".6"/>`).join("")}
<polygon points="${pts([[246, 50], [256, 48], [256, 84], [246, 92]])}" fill="url(#dr-pages)"/>
<path d="M16 58 L246 50 L246 92 L16 100 Q8 79 16 58 Z" fill="url(#${L})"/>
<path d="M16 58 L246 50 L246 60 L16 68 Z" fill="#fff" opacity=".1"/><path d="M16 92 L246 84 L246 92 L16 100 Z" fill="#000" opacity=".3"/>
${[34, 62, 200, 226].map((x) => `<path d="M${x} ${58 - (x - 16) * 0.035} L${x} ${100 - (x - 16) * 0.035}" stroke="#d9b060" stroke-width="2.2"/>`).join("")}
<text transform="matrix(1 -.035 0 1 131 87)" text-anchor="middle" font-family="'Gambit Cinzel', serif" font-weight="800" font-size="${fit(t, 150, 24, 0.82).toFixed(1)}" letter-spacing="3" fill="#f0cf7a" stroke="#3a1a08" stroke-width=".6">${esc(t)}</text>
</g></svg>`;
}

/**
 * A heavy brass tabletop compass in perspective: thick housing, an inked
 * dial under a glass dome (the needle shows which way you face), and four
 * brass paddles around it, each a button for a move. The dome is Search.
 */
export function compass(labels: { fwd?: string; left?: string; right?: string; back?: string; search?: string }, facing: number): string {
  const paddle = (key: string, label: string | undefined, face: [number, number][], top: [number, number][], tx: number, ty: number, word: string, size: number) =>
    label
      ? `<g class="cw" role="button" tabindex="0" data-act="m:move:${key}" aria-label="${esc(label)}"><title>${esc(label)}</title><polygon points="${pts(top)}" fill="url(#dr-brass)" stroke="#3a2410" stroke-width="1.6"/><polygon points="${pts(face)}" fill="#7d5420" stroke="#3a2410" stroke-width="1.6"/><text x="${tx}" y="${ty}" text-anchor="middle" font-family="'Gambit Cinzel', serif" font-weight="800" font-size="${size}" fill="#2a1608">${word}</text></g>`
      : "";
  const ang = (facing * Math.PI) / 2;
  const nx = Math.sin(ang), ny = -Math.cos(ang);
  const needle = `<path d="M${(200 + nx * 82).toFixed(1)} ${(118 + ny * 30).toFixed(1)} L${(200 - ny * 7).toFixed(1)} ${(118 + nx * 3).toFixed(1)} L${(200 - nx * 60).toFixed(1)} ${(118 - ny * 22).toFixed(1)} L${(200 + ny * 7).toFixed(1)} ${(118 - nx * 3).toFixed(1)} Z" fill="#8e1c14"/><path d="M200 118 L${(200 - ny * 7).toFixed(1)} ${(118 + nx * 3).toFixed(1)} L${(200 - nx * 60).toFixed(1)} ${(118 - ny * 22).toFixed(1)} Z" fill="#1a2a3a"/>`;
  return `<svg viewBox="0 0 400 260" aria-hidden="false">
${shadow(200, 214, 196, 34)}
${paddle("forward", labels.fwd, [[162, 52], [238, 52], [238, 60], [162, 60]], [[170, 22], [230, 22], [238, 52], [162, 52]], 200, 46, "AHEAD", 15)}
<g class="bd">
<path d="M40 118 L40 146 A160 62 0 0 0 360 146 L360 118 Z" fill="#6e4718"/><path d="M40 132 A160 62 0 0 0 360 132" fill="none" stroke="#c9a04e" stroke-width="2" opacity=".6"/>
<ellipse cx="200" cy="118" rx="160" ry="62" fill="url(#dr-brass)"/>
<ellipse cx="200" cy="118" rx="140" ry="52" fill="#5a3a12"/>
<ellipse cx="200" cy="121" rx="134" ry="49" fill="url(#dr-ivory)"/>
${Array.from({ length: 32 }, (_, i) => {
  const a = (i / 32) * Math.PI * 2;
  const r0 = i % 4 === 0 ? 0.86 : 0.93;
  return `<line x1="${(200 + Math.cos(a) * 128 * r0).toFixed(1)}" y1="${(121 + Math.sin(a) * 46 * r0).toFixed(1)}" x2="${(200 + Math.cos(a) * 128).toFixed(1)}" y2="${(121 + Math.sin(a) * 46).toFixed(1)}" stroke="#5a3a12" stroke-width="${i % 4 === 0 ? 2.4 : 1}"/>`;
}).join("")}
<path d="M200 78 L210 116 L290 121 L210 126 L200 164 L190 126 L110 121 L190 116 Z" fill="#c9a04e" opacity=".35"/>
<text x="200" y="88" text-anchor="middle" font-family="'Gambit Cinzel', serif" font-weight="800" font-size="12" fill="#8e1c14">N</text>
${needle}<circle cx="200" cy="118" r="5" fill="url(#dr-brass)"/>
</g>
${labels.search ? `<g class="cw dome" role="button" tabindex="0" data-act="m:move:search" aria-label="${esc(labels.search)}"><title>${esc(labels.search)}</title><ellipse cx="200" cy="118" rx="134" ry="49" fill="#fff" opacity=".04"/><path d="M92 104 Q200 58 308 104" fill="none" stroke="#fff" stroke-width="5" opacity=".35" stroke-linecap="round"/><path d="M120 150 Q200 168 280 150" fill="none" stroke="#fff" stroke-width="2" opacity=".2"/><text x="200" y="152" text-anchor="middle" font-family="'Gambit Cinzel', serif" font-weight="800" font-size="16" letter-spacing="3" fill="#3a1a08">SEARCH</text></g>` : ""}
${paddle("left", labels.left, [[6, 128], [56, 136], [56, 146], [6, 140]], [[2, 100], [52, 102], [56, 136], [6, 128]], 30, 124, "LEFT", 14)}
${paddle("right", labels.right, [[344, 136], [394, 128], [394, 140], [344, 146]], [[348, 102], [398, 100], [394, 128], [344, 136]], 370, 124, "RIGHT", 14)}
${paddle("back", labels.back, [[148, 236], [252, 236], [252, 250], [148, 250]], [[156, 186], [244, 186], [252, 236], [148, 236]], 200, 220, "BACK", 20)}
</svg>`;
}

/** A desk wedge for a person's name: a brass sloped face on a walnut block. Text is laid over it in HTML. */
export const WEDGE = `<svg viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true">${shadow(100, 54, 98, 7)}
<polygon points="0,52 200,52 192,58 8,58" fill="#1a0e06"/><polygon points="10,6 190,6 200,52 0,52" fill="url(#dr-brass)"/>
<polygon points="10,6 190,6 191,10 9,10" fill="#fff3c4" opacity=".7"/><polygon points="0,52 200,52 199,48 1,48" fill="#5a3a12" opacity=".6"/>
<circle cx="14" cy="29" r="2.4" fill="#5a3a12"/><circle cx="186" cy="29" r="2.4" fill="#5a3a12"/></svg>`;

/**
 * The outdoor proscenium: a weathered timber beam, a tarred canvas valance
 * with a ragged hem, and fishing nets swagged under it with cork floats and
 * one glass float. Drawn wide and sliced to the window, so it never stretches.
 */
export function valance(): string {
  const hem: string[] = [];
  let x = 0;
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  hem.push(`M0 0 L2800 0 L2800 78`);
  for (x = 2800; x > 0; x -= 30 + r() * 40) hem.push(`L${x.toFixed(0)} ${(70 + r() * 22).toFixed(0)}`);
  hem.push("L0 80 Z");
  const nets: string[] = [];
  for (let i = 0; i < 7; i++) {
    const x0 = i * 420 - 60 + r() * 60, x1 = x0 + 360 + r() * 80, sag = 52 + r() * 30;
    const mx = (x0 + x1) / 2;
    for (let k = 0; k < 6; k++) nets.push(`<path d="M${x0} ${70 + k * 3} Q${mx} ${70 + sag + k * 9} ${x1} ${70 + k * 3}" fill="none" stroke="#a89878" stroke-width="1.2" opacity="${0.5 - k * 0.05}"/>`);
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      const px = x0 + (x1 - x0) * t;
      const py = 70 + sag * 4 * t * (1 - t) * 1.6;
      nets.push(`<path d="M${(px - 10).toFixed(0)} 70 L${px.toFixed(0)} ${py.toFixed(0)} M${(px + 10).toFixed(0)} 70 L${px.toFixed(0)} ${py.toFixed(0)}" stroke="#a89878" stroke-width="1" opacity=".35"/>`);
    }
    for (let k = 1; k < 5; k++) {
      const t = k / 5;
      const px = x0 + (x1 - x0) * t;
      const py = 70 + sag * 4 * t * (1 - t) * 1.65 + 6;
      nets.push(k === 2 && i % 3 === 1
        ? `<circle cx="${px.toFixed(0)}" cy="${(py + 6).toFixed(0)}" r="13" fill="#3f7a6e" opacity=".85"/><circle cx="${(px - 4).toFixed(0)}" cy="${(py + 2).toFixed(0)}" r="4" fill="#d8f4ea" opacity=".7"/><path d="M${(px - 13).toFixed(0)} ${(py + 6).toFixed(0)} Q${px.toFixed(0)} ${(py + 14).toFixed(0)} ${(px + 13).toFixed(0)} ${(py + 6).toFixed(0)}" stroke="#a89878" fill="none" stroke-width="1.4"/>`
        : `<ellipse cx="${px.toFixed(0)}" cy="${py.toFixed(0)}" rx="9" ry="6" fill="#b8874e"/><ellipse cx="${(px - 2).toFixed(0)}" cy="${(py - 2).toFixed(0)}" rx="4" ry="2" fill="#e8c08a" opacity=".6"/>`);
    }
  }
  return `<svg viewBox="0 0 2800 170" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
<defs><linearGradient id="dr-tar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f1c18"/><stop offset=".7" stop-color="#2e2a22"/><stop offset="1" stop-color="#14120e"/></linearGradient></defs>
<path d="${hem.join(" ")}" fill="url(#dr-tar)"/>
${Array.from({ length: 40 }, (_, i) => `<path d="M${i * 70 + 20} 20 Q${i * 70 + 34} 50 ${i * 70 + 26} 80" stroke="#000" stroke-width="10" opacity=".22" fill="none"/><path d="M${i * 70 + 44} 22 Q${i * 70 + 54} 46 ${i * 70 + 48} 74" stroke="#7a705a" stroke-width="3" opacity=".18" fill="none"/>`).join("")}
${nets.join("")}
<rect x="0" y="0" width="2800" height="30" fill="#3a2414"/><rect x="0" y="0" width="2800" height="30" fill="url(#dr-wood)" opacity=".8"/><rect x="0" y="26" width="2800" height="5" fill="#120a04"/>
${Array.from({ length: 28 }, (_, i) => `<circle cx="${i * 100 + 40}" cy="15" r="5" fill="#3a3a3a"/><circle cx="${i * 100 + 39}" cy="14" r="2" fill="#8a8a8a"/>`).join("")}
</svg>`;
}
