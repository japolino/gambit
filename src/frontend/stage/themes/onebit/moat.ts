/**
 * The scene's ink moat for the battle's figures: every enemy is cut out of the place by a band of solid ink a
 * few virtual pixels wide, with a broken rim of paper on the lit (upper left) side, before the stage's two-tone
 * shader puts it on the grid. A 1-bit figure then never melts into a 1-bit background. GLSL, run before the
 * stage's own art shader on each enemy's body.
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
uniform highp vec4 uInputClamp;
uniform float uMoat;

float alphaAt(vec2 off) {
  vec2 uv = clamp(vTextureCoord + off * uInputSize.zw, uInputClamp.xy, uInputClamp.zw);
  return texture(uTexture, uv).a;
}

void main(void) {
  vec4 c = texture(uTexture, vTextureCoord);
  if (c.a > 0.5) { finalColor = c; return; }
  // Nearest covered pixel within the moat, sampled on two rings of 12 directions.
  float near = 0.0;
  float lit = 0.0;
  for (int i = 0; i < 12; i++) {
    float a = float(i) * 0.5235988;
    vec2 d = vec2(cos(a), sin(a));
    float inner = alphaAt(d * uMoat * 0.5);
    float outer = alphaAt(d * uMoat);
    near = max(near, max(inner, outer * 0.75));
    // The light comes from the upper left: the rim shows where the figure lies down and to the right.
    if (d.x > 0.3 && d.y > 0.3) lit = max(lit, alphaAt(d * uMoat * 0.22));
  }
  if (lit > 0.5 && near > 0.5) { finalColor = vec4(vec3(0.82), 1.0); return; }
  if (near > 0.5) { finalColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  if (near > 0.2) { finalColor = vec4(0.0, 0.0, 0.0, 0.55); return; }
  finalColor = c;
}`;

let program: GlProgram | null = null;

export class MoatFilter extends Filter {
  constructor() {
    program ??= GlProgram.from({ vertex, fragment, name: "gambit-onebit-moat" });
    super({
      glProgram: program,
      resources: { moatUniforms: { uMoat: { value: 9, type: "f32" } } },
      padding: 14,
    });
  }

  /** Moat width in screen px (about three virtual pixels). */
  set width(px: number) {
    (this.resources.moatUniforms as { uniforms: { uMoat: number } }).uniforms.uMoat = px;
    this.padding = Math.ceil(px) + 2;
  }
}
