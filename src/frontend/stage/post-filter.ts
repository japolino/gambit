/**
 * The pixel themes' picture treatment (skin.ts PostSkin): the art layers (backdrop, figures, effects, cut-ins)
 * snapped to one screen-wide grid of fat pixels, then cut to two tones (1-bit: the figures on the manga screens,
 * the rest ordered-dithered, 4x4 Bayer) or dithered to a small palette (the terminal's EGA half), with optional
 * scanlines. Generated art comes in already
 * through the manga treatment (puppet/source.ts mangaCanvas), its ink lines kept in solid ink. The HUD is drawn natively in the theme and
 * is not filtered, so type stays sharp. GLSL only (the stage asks for WebGL).
 */
import { Filter, GlProgram } from "pixi.js";
import type { PostSkin } from "./skin.js";

const vertex = /* glsl */ `
in vec2 aPosition;
out vec2 vTextureCoord;
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;
uniform vec4 uOutputTexture;
void main(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}`;

const MAX = 16;

const fragment = /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;
uniform highp vec4 uInputClamp;
uniform float uCell;
uniform float uMono;
uniform float uScreens;
uniform float uScan;
uniform float uCount;
uniform float uGain;
uniform vec3 uPal[${MAX}];

// 4x4 ordered dither threshold in (0, 1), built from the 2x2 one (no arrays: GLSL ES 1).
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer(vec2 p) { return bayer2(0.5 * p) * 0.25 + bayer2(p) + 1.0 / 32.0; }

// The manga screens (src/frontend/art/manga.ts SCREEN): checker cells at .28, the sparse dot at .68, the rest at .5.
float screen2(vec2 p) {
  vec2 m = mod(p, 2.0);
  return abs(m.x - m.y) > 0.5 ? 0.28 : (m.x < 0.5 ? 0.68 : 0.5);
}

void main(void) {
  // Screen position (logical px) so every filtered layer shares one grid.
  vec2 screen = uOutputFrame.xy + vTextureCoord * uInputSize.xy;
  vec2 cell = floor(screen / uCell);
  // Nine taps across the cell. Art prepared for this shader (puppet/source.ts mangaCanvas) carries its ink lines in
  // black: a cell is ink when a third of its taps are near black, so a line is not lost between cell centres.
  vec4 c = vec4(0.0);
  vec4 rest = vec4(0.0);
  float ink = 0.0;
  for (int j = 0; j < 3; j++) {
    for (int i = 0; i < 3; i++) {
      vec2 p = (cell + (vec2(float(i), float(j)) + 0.5) / 3.0) * uCell;
      vec4 s = texture(uTexture, clamp((p - uOutputFrame.xy) * uInputSize.zw, uInputClamp.xy, uInputClamp.zw));
      c += s;
      if (s.a > 0.5 && max(s.r, max(s.g, s.b)) < 0.06 * s.a) ink += 1.0;
      else rest += s;
    }
  }
  c /= 9.0;
  float t = bayer(cell);
  // Hard pixel edges: coverage is dithered too.
  if (c.a < t * 0.9 + 0.05) { finalColor = vec4(0.0); return; }
  bool line = ink >= 3.0;
  vec3 rgb = rest.a > 0.0 ? rest.rgb / rest.a * uGain : vec3(0.0);
  vec3 outc;
  if (uMono > 0.5) {
    float l = dot(rgb, vec3(0.299, 0.587, 0.114));
    // A little contrast so midtones keep shape.
    l = clamp((l - 0.5) * 1.25 + 0.5, 0.0, 1.0);
    outc = !line && l > (uScreens > 0.5 ? screen2(cell) : t) ? uPal[1] : uPal[0];
  } else {
    vec3 d = line ? vec3(0.0) : rgb + (t - 0.5) * 0.34;
    float best = 1e9;
    outc = uPal[0];
    for (int i = 0; i < ${MAX}; i++) {
      if (float(i) >= uCount) break;
      vec3 e = d - uPal[i];
      float dist = dot(e * e, vec3(0.3, 0.59, 0.11));
      if (dist < best) { best = dist; outc = uPal[i]; }
    }
  }
  if (uScan > 0.5 && mod(cell.y, 2.0) > 0.5) outc *= 0.78;
  finalColor = vec4(outc, 1.0);
}`;

let program: GlProgram | null = null;

export class PostFilter extends Filter {
  /**
   * `gain` scales the picture before it is quantized (below 1 sinks a backdrop under the figures). `screens`: 1-bit
   * tones go to the manga screens (figures, cut-ins), else to the Bayer dither (soft light, effects, the backdrop).
   */
  constructor(post: PostSkin, gain = 1, screens = false) {
    program ??= GlProgram.from({ vertex, fragment, name: "gambit-post" });
    const pal = new Float32Array(MAX * 3);
    post.palette.slice(0, MAX).forEach((c, i) => {
      pal[i * 3] = ((c >> 16) & 255) / 255;
      pal[i * 3 + 1] = ((c >> 8) & 255) / 255;
      pal[i * 3 + 2] = (c & 255) / 255;
    });
    super({
      glProgram: program,
      resources: {
        postUniforms: {
          uCell: { value: 3, type: "f32" },
          uMono: { value: post.kind === "mono" ? 1 : 0, type: "f32" },
          uScreens: { value: screens ? 1 : 0, type: "f32" },
          uScan: { value: post.scanlines ? 1 : 0, type: "f32" },
          uGain: { value: gain, type: "f32" },
          uCount: { value: Math.min(MAX, post.palette.length), type: "f32" },
          uPal: { value: pal, type: "vec3<f32>", size: MAX },
        },
      },
      padding: 0,
    });
    this.rows = post.rows;
  }

  private rows: number;

  /** Fit the grid to the screen height: about `rows` fat pixels, at least 2 px each. */
  fit(height: number): void {
    const u = (this.resources.postUniforms as { uniforms: Record<string, unknown> }).uniforms;
    u.uCell = Math.max(2, Math.round(height / this.rows));
  }
}
