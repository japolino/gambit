/**
 * The 1-bit theme's bitmap type. Canvas text is anti-aliased, so instead of
 * drawing the 8x8 pixel face ("Gambit 8bit") with fillText at screen size,
 * each glyph is rendered once at 8x and sampled at the centre of every design
 * pixel: the result is the font's exact 8x8 bit pattern, which the frame
 * buffer then stamps onto the virtual pixel grid at 1x or 2x. A handful of
 * symbols the face lacks (pointer, block cursor, arrows) are drawn here.
 */

/** Eight rows per glyph, most significant bit = leftmost column. */
export type Glyph = Uint8Array;

export interface BitFont {
  glyph(ch: string): Glyph;
  /** False for a letter the face lacks (Hangul, kana, Cyrillic...): its 8x8 sample can't be read, so a console draws it sharp over the frame (fb.ts). */
  has(ch: string): boolean;
}

const EXTRA: Record<string, number[]> = {
  "►": [0x40, 0x60, 0x70, 0x78, 0x70, 0x60, 0x40, 0x00],
  "◄": [0x02, 0x06, 0x0e, 0x1e, 0x0e, 0x06, 0x02, 0x00],
  "▲": [0x00, 0x10, 0x38, 0x7c, 0xfe, 0x00, 0x00, 0x00],
  "▼": [0x00, 0xfe, 0x7c, 0x38, 0x10, 0x00, 0x00, 0x00],
  "█": [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff],
  "•": [0x00, 0x00, 0x18, 0x3c, 0x3c, 0x18, 0x00, 0x00],
  "♦": [0x10, 0x38, 0x7c, 0xfe, 0x7c, 0x38, 0x10, 0x00],
  "♥": [0x6c, 0xfe, 0xfe, 0xfe, 0x7c, 0x38, 0x10, 0x00],
  "■": [0x00, 0x7e, 0x7e, 0x7e, 0x7e, 0x7e, 0x7e, 0x00],
  "×": [0x00, 0xc6, 0x6c, 0x38, 0x6c, 0xc6, 0x00, 0x00],
  "✓": [0x01, 0x03, 0x06, 0x8c, 0xd8, 0x70, 0x20, 0x00],
};

/** Typography the face cannot show, folded to ASCII. */
export function plain(s: string): string {
  return s
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC");
}

let loading: Promise<BitFont> | null = null;

/** Sample the face once (cached for the page). Resolves after the font has loaded. */
export function loadFont(): Promise<BitFont> {
  if (!loading) loading = build();
  return loading;
}

async function build(): Promise<BitFont> {
  const U = 8; // device pixels per design pixel while sampling
  try {
    await document.fonts.load(`${U * 8}px "Gambit 8bit"`);
  } catch {
    /* sample whatever the fallback draws */
  }
  const N = U * 12;
  const c = document.createElement("canvas");
  c.width = N;
  c.height = N;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.font = `${U * 8}px "Gambit 8bit"`;
  g.textBaseline = "top";
  g.fillStyle = "#fff";
  const O = U * 2;
  const raw = (ch: string) => {
    g.clearRect(0, 0, N, N);
    g.fillText(ch, O, O);
    return g.getImageData(0, 0, N, N).data;
  };
  // The cell origin: 'H' touches the top-left of its cell in this face.
  const h = raw("H");
  let ox = N, oy = N;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (h[(y * N + x) * 4 + 3]! > 127) { ox = Math.min(ox, x); oy = Math.min(oy, y); }
  if (ox >= N) { ox = O; oy = O; }
  const sample = (ch: string): Glyph => {
    const d = raw(ch);
    const rows = new Uint8Array(8);
    for (let r = 0; r < 8; r++) {
      let bits = 0;
      for (let col = 0; col < 8; col++) {
        const x = ox + col * U + (U >> 1);
        const y = oy + r * U + (U >> 1);
        if (x < N && y < N && d[(y * N + x) * 4 + 3]! > 127) bits |= 0x80 >> col;
      }
      rows[r] = bits;
    }
    return rows;
  };
  const table = new Map<string, Glyph>();
  for (let code = 32; code < 127; code++) table.set(String.fromCharCode(code), sample(String.fromCharCode(code)));
  for (const [k, rows] of Object.entries(EXTRA)) table.set(k, Uint8Array.from(rows));
  const sampled = new Map<string, Glyph>();
  return {
    glyph: (ch) => table.get(ch) ?? sampled.get(ch) ?? sampled.set(ch, sample(ch)).get(ch)!,
    has: (ch) => table.has(ch),
  };
}

/** Word-wrap to `cols` characters; words longer than a line are cut. */
export function wrap(text: string, cols: number): string[] {
  const out: string[] = [];
  const n = Math.max(1, cols);
  for (const para of plain(text).split(/\n/)) {
    let line = "";
    for (let word of para.split(/\s+/).filter(Boolean)) {
      while (word.length > n) {
        if (line) { out.push(line); line = ""; }
        out.push(word.slice(0, n));
        word = word.slice(n);
      }
      if (!line) line = word;
      else if (line.length + 1 + word.length <= n) line += " " + word;
      else { out.push(line); line = word; }
    }
    out.push(line);
  }
  return out;
}

/** wrap() for story text, keeping each character's emphasis (bit 1: italic, bit 2: bold) to draw it with. */
export function wrapStyled(runs: readonly { text: string; em: boolean; strong: boolean }[], cols: number): { t: string; st: number[] }[] {
  let s = "";
  const st: number[] = [];
  for (const r of runs) {
    const t = plain(r.text);
    s += t;
    for (let i = 0; i < t.length; i++) st.push((r.em ? 1 : 0) | (r.strong ? 2 : 0));
  }
  const n = Math.max(1, cols);
  const out: { t: string; st: number[] }[] = [];
  let line = "";
  let ls: number[] = [];
  for (const m of s.matchAll(/\S+/g)) {
    let w = m[0];
    let ws = st.slice(m.index, m.index + w.length);
    while (w.length > n) {
      if (line) out.push({ t: line, st: ls });
      line = "";
      out.push({ t: w.slice(0, n), st: ws.slice(0, n) });
      w = w.slice(n);
      ws = ws.slice(n);
    }
    if (!line) [line, ls] = [w, ws];
    else if (line.length + 1 + w.length <= n) {
      // The space between two italic words is underlined with them.
      line += " " + w;
      ls = [...ls, ls.at(-1)! & ws[0]!, ...ws];
    } else {
      out.push({ t: line, st: ls });
      [line, ls] = [w, ws];
    }
  }
  out.push({ t: line, st: ls });
  return out;
}

/** 3x5 digits for numbers stamped onto bars (rows of 3 bits). */
export const TINY: Record<string, number[]> = {
  "0": [7, 5, 5, 5, 7], "1": [2, 6, 2, 2, 7], "2": [7, 1, 7, 4, 7], "3": [7, 1, 7, 1, 7], "4": [5, 5, 7, 1, 1],
  "5": [7, 4, 7, 1, 7], "6": [7, 4, 7, 5, 7], "7": [7, 1, 2, 2, 2], "8": [7, 5, 7, 5, 7], "9": [7, 5, 7, 1, 7],
  "/": [1, 1, 2, 4, 4], "%": [5, 1, 2, 4, 5], " ": [0, 0, 0, 0, 0], "-": [0, 0, 7, 0, 0], "+": [0, 2, 7, 2, 0],
};
