/**
 * The tube, as a pixel shader over everything drawn inside the glass: the picture can bow outward (a radial
 * barrel; the theme leaves it flat, because a bowed picture is resampled between pixels and its type goes soft:
 * the curve is drawn in the housing's opening instead), each virtual pixel row
 * ends in a dark scanline, bright phosphor bleeds a little light into its neighbours, the glass falls off to black
 * at its very edge (a superellipse, past the one cell of overscan, so no live character is darkened) and a faint
 * window reflection sits on the upper left. GLSL only, like ../../post-filter.ts.
 */
import { Filter, GlProgram } from "pixi.js";

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

const fragment = /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;
uniform highp vec4 uInputClamp;
uniform vec4 uGlass;
uniform float uK;
uniform float uV;
uniform float uGlow;

vec4 at(vec2 screen) {
  vec2 uv = (screen - uOutputFrame.xy) * uInputSize.zw;
  if (uv.x < uInputClamp.x || uv.y < uInputClamp.y || uv.x > uInputClamp.z || uv.y > uInputClamp.w) return vec4(0.0, 0.0, 0.0, 1.0);
  return texture(uTexture, uv);
}

void main(void) {
  vec2 screen = uOutputFrame.xy + vTextureCoord * uInputSize.xy;
  vec2 hv = uGlass.zw * 0.5;
  vec2 mid = uGlass.xy + hv;
  vec2 n = (screen - mid) / hv;
  float r2 = dot(n, n);
  // Sample nearer the centre: the picture swells toward the glass edge. Whole virtual pixels stay whole.
  vec2 src = screen - (screen - mid) * uK * r2;
  vec4 c = at(src);
  if (uGlow > 0.0) {
    vec4 g = at(src + vec2(uV * 1.5, 0.0)) + at(src - vec2(uV * 1.5, 0.0)) + at(src + vec2(0.0, uV * 1.5)) + at(src - vec2(0.0, uV * 1.5));
    c.rgb += max(vec3(0.0), g.rgb * 0.25 - 0.12) * uGlow;
  }
  // Scanline: the last screen row of each virtual pixel row is darker.
  if (uV >= 2.0) {
    float row = mod(src.y - uGlass.y, uV);
    if (row >= uV - 1.0) c.rgb *= 0.68;
    else if (row < 1.0) c.rgb *= 1.04;
  }
  // The tube's dark edge.
  vec2 a = abs(n);
  float d = pow(pow(a.x, 7.0) + pow(a.y, 7.0), 1.0 / 7.0);
  float edge = clamp((d - 0.955) / 0.05, 0.0, 1.0);
  c.rgb *= 1.0 - edge * edge * 0.9;
  // A faint window reflection, upper left.
  vec2 q = (screen - uGlass.xy) / uGlass.zw;
  float refl = smoothstep(0.55, 0.0, length((q - vec2(0.18, 0.08)) * vec2(1.0, 1.4)));
  c.rgb += vec3(0.07) * refl;
  finalColor = vec4(c.rgb, 1.0);
}`;

let program: GlProgram | null = null;

export class CrtFilter extends Filter {
  constructor() {
    program ??= GlProgram.from({ vertex, fragment, name: "gambit-command-crt" });
    super({
      glProgram: program,
      resources: {
        crtUniforms: {
          uGlass: { value: new Float32Array([0, 0, 1, 1]), type: "vec4<f32>" },
          uK: { value: 0.01, type: "f32" },
          uV: { value: 3, type: "f32" },
          uGlow: { value: 0.6, type: "f32" },
        },
      },
      padding: 0,
    });
  }

  /** The glass in screen pixels, one virtual pixel, and whether the tube is curved (flat on a phone). */
  set(glass: { x: number; y: number; w: number; h: number }, v: number, curved: boolean): void {
    const u = (this.resources.crtUniforms as { uniforms: Record<string, unknown> }).uniforms;
    const g = u.uGlass as Float32Array;
    g[0] = glass.x;
    g[1] = glass.y;
    g[2] = Math.max(1, glass.w);
    g[3] = Math.max(1, glass.h);
    u.uV = v;
    u.uK = curved ? 0.01 : 0;
  }
}
