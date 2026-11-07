/**
 * One small shader per figure for what a tint cannot do: a hit flash (mix
 * toward a colour, brighter than the art), a desaturation (broken, fallen),
 * and the death dissolve (a noise threshold eating the figure with an
 * ember edge). The stage runs on WebGL (mount.ts asks for it), so the
 * filter is GLSL only. It is attached only while one of its effects is on.
 */
import { Filter, GlProgram } from "pixi.js";

const vertex = /* glsl */ `
in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vFrame;
// highp in both stages: default precisions differ by GPU, and a mismatch
// fails to link ("Precisions of uniform 'uInputSize' differ").
uniform highp vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
void main(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
  vFrame = aPosition;
}`;

const fragment = /* glsl */ `
in vec2 vTextureCoord;
in vec2 vFrame;
out vec4 finalColor;
uniform sampler2D uTexture;
// highp: must match the vertex stage's explicit highp.
uniform highp vec4 uInputSize;
uniform vec4 uFlash;
uniform vec3 uEdge;
uniform float uDissolve;
uniform float uGray;
uniform float uSeed;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

void main(void) {
  vec4 c = texture(uTexture, vTextureCoord);
  if (uGray > 0.0) {
    float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
    c.rgb = mix(c.rgb, vec3(l) * 0.85, uGray);
  }
  if (uFlash.a > 0.0) c.rgb = mix(c.rgb, uFlash.rgb * c.a, uFlash.a);
  if (uDissolve > 0.0) {
    vec2 px = vTextureCoord * uInputSize.xy;
    // Grainy noise, biased so the figure burns away from the top down.
    float n = fbm(px * 0.035) * 0.75 + (1.0 - vFrame.y) * 0.35;
    float cut = uDissolve * 1.15 - 0.05;
    if (n < cut) { c = vec4(0.0); }
    else {
      float edge = 1.0 - smoothstep(cut, cut + 0.07, n);
      c.rgb = mix(c.rgb, uEdge * c.a * 1.6, edge);
      c *= 1.0 - uDissolve * 0.25;
    }
  }
  finalColor = c;
}`;

let program: GlProgram | null = null;

export class FigureFilter extends Filter {
  constructor(seed: number) {
    program ??= GlProgram.from({ vertex, fragment, name: "gambit-figure" });
    super({
      glProgram: program,
      resources: {
        figureUniforms: {
          uFlash: { value: new Float32Array([1, 1, 1, 0]), type: "vec4<f32>" },
          uEdge: { value: new Float32Array([1, 0.55, 0.25]), type: "vec3<f32>" },
          uDissolve: { value: 0, type: "f32" },
          uGray: { value: 0, type: "f32" },
          uSeed: { value: seed % 97, type: "f32" },
        },
      },
      padding: 0,
    });
  }

  private get u(): Record<string, unknown> {
    return (this.resources.figureUniforms as { uniforms: Record<string, unknown> }).uniforms;
  }

  set flash(v: { color: number; amount: number }) {
    const f = this.u.uFlash as Float32Array;
    f[0] = ((v.color >> 16) & 255) / 255;
    f[1] = ((v.color >> 8) & 255) / 255;
    f[2] = (v.color & 255) / 255;
    f[3] = v.amount;
  }

  set edge(color: number) {
    const e = this.u.uEdge as Float32Array;
    e[0] = ((color >> 16) & 255) / 255;
    e[1] = ((color >> 8) & 255) / 255;
    e[2] = (color & 255) / 255;
  }

  set dissolve(v: number) { this.u.uDissolve = v; }
  get dissolve(): number { return this.u.uDissolve as number; }
  set gray(v: number) { this.u.uGray = v; }
  get gray(): number { return this.u.uGray as number; }
  get flashAmount(): number { return (this.u.uFlash as Float32Array)[3]!; }
}
