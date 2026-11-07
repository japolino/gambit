/**
 * The 3D scene layer (docs/DESIGN.md 6.2): generated 2D art staged in
 * three.js. Two rooms:
 *  - backdrop: the place's painting on a displaced mesh (a depth guess from
 *    the image: floor near, horizon far), with the people present standing
 *    in it as billboards; the camera drifts and leans toward the pointer;
 *  - corridor: a delve's grid built as real walls, floor and ceiling from
 *    tileable textures, so every step is a 3D move, lit by a torch fog.
 * A screen pass over both carries the theme's post-process (6.3): ordered
 * dither for 1-bit, paper grain and vignette for Storybook, scanlines for
 * Command. With no WebGL the caller keeps its flat DOM fallback.
 *  - diorama (M5): an indoor place as a box room, its painting on the back
 *    wall, plaster and plank textures tinted from it, a counter when it
 *    sells things, warm light, and the people standing in it.
 * Clicking a person in the room calls `onPick` with their id.
 *  - custom: a theme's own 3D stage (Table, Diorama): the theme builds its
 *    models, lights and camera in a group it owns (`customStage()`), and the
 *    layer just renders it; leaving the mode disposes the group.
 */
import {
  AmbientLight,
  BoxGeometry,
  CylinderGeometry,
  DataTexture,
  MeshLambertMaterial,
  PointLight,
  Raycaster,
  CanvasTexture,
  Color,
  DoubleSide,
  Fog,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
  NoToneMapping,
  type Intersection,
  type Object3D,
} from "three";
import { plateDepthFor } from "../art/depth/plate-depth-service.js";

/** A theme's own 3D stage on the layer (see SceneLayer3D.customStage). */
export interface Stage3D {
  /** Your scene graph. Disposed (geometry and materials) when the layer leaves custom mode. */
  readonly root: Group;
  /** Changes whenever `root` was recreated (e.g. after a delve corridor used the layer): rebuild then. */
  readonly generation: number;
  /** The scene: set fog / background / environment only (reset when custom mode ends). */
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  /** Enable shadowMap, tone mapping, exposure as needed (reset when custom mode ends). */
  readonly renderer: WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  /** Called every frame before rendering; drive the camera and animation here. */
  setUpdate(fn: ((t: number, dt: number) => void) | null): void;
  /** Raycast from a client point against these objects (recursive); nearest hit or null. */
  pick(clientX: number, clientY: number, objects: Object3D[]): Intersection | null;
  /** Load an image URL as an sRGB texture (cached; the layer disposes it). */
  texture(url: string): Promise<Texture | null>;
}

export type PostFx = "none" | "dither" | "paper" | "scan";

export interface Billboard {
  id: string;
  url: string;
  /** A cut-out with alpha; opaque art is shown with soft edges. */
  cutout: boolean;
}

export interface CorridorView {
  grid: string[];
  x: number;
  y: number;
  facing: 0 | 1 | 2 | 3;
  opened: string[];
  /** Room cells with something to show (a glint), as "x,y". */
  glints: string[];
}

const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

/** Can this browser draw the 3D layer? */
export function webglOk(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

/**
 * A depth guess for a painting: the bottom is near, the horizon (about 45%
 * down) far, a ceiling slightly nearer again, and bright detail a touch
 * forward. Good enough for a gentle parallax; a real depth model can
 * replace it later without changing the mesh.
 */
function depthFor(img: HTMLImageElement): CanvasTexture {
  const w = 96;
  const h = Math.max(32, Math.round((w * img.height) / Math.max(1, img.width)));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.filter = "blur(3px)";
  g.drawImage(img, 0, 0, w, h);
  const px = g.getImageData(0, 0, w, h);
  const horizon = 0.45;
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    const floor = v > horizon ? Math.pow((v - horizon) / (1 - horizon), 1.3) : 0;
    const ceil = v < horizon * 0.5 ? (horizon * 0.5 - v) / (horizon * 0.5) * 0.35 : 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const lum = (px.data[i]! * 0.3 + px.data[i + 1]! * 0.59 + px.data[i + 2]! * 0.11) / 255;
      const d = Math.min(1, floor * 0.85 + ceil + lum * 0.12);
      px.data[i] = px.data[i + 1] = px.data[i + 2] = Math.round(d * 255);
      px.data[i + 3] = 255;
    }
  }
  g.filter = "none";
  g.putImageData(px, 0, 0);
  const t = new CanvasTexture(c);
  t.minFilter = t.magFilter = LinearFilter;
  return t;
}

/** Opaque portrait art, faded out at the edges so it stands in the room. */
function softEdged(img: HTMLImageElement): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext("2d")!;
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = "destination-in";
  const grad = g.createRadialGradient(c.width / 2, c.height * 0.42, c.width * 0.18, c.width / 2, c.height * 0.5, c.width * 0.62);
  grad.addColorStop(0, "rgba(0,0,0,1)");
  grad.addColorStop(0.75, "rgba(0,0,0,.85)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  // Fade the bottom out. destination-out only touches the strip it draws
  // (destination-in would clear everything outside it).
  g.globalCompositeOperation = "destination-out";
  const bottom = g.createLinearGradient(0, c.height * 0.78, 0, c.height);
  bottom.addColorStop(0, "rgba(0,0,0,0)");
  bottom.addColorStop(1, "rgba(0,0,0,1)");
  g.fillStyle = bottom;
  g.fillRect(0, c.height * 0.78, c.width, c.height * 0.22);
  g.globalCompositeOperation = "source-over";
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** The painting's average colour, to tint the room's plaster and wood. */
function averageColor(img: HTMLImageElement): [number, number, number] {
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, 16, 16);
  const d = g.getImageData(0, 0, 16, 16).data;
  let r = 0, gg = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) {
    r += d[i]!;
    gg += d[i + 1]!;
    b += d[i + 2]!;
  }
  const n = d.length / 4;
  return [r / n, gg / n, b / n];
}

/** Plaster walls and plank floors for a diorama room, tinted toward the painting. */
function roomTexture(kind: "plaster" | "planks" | "beams", tint: [number, number, number], seed = 3): CanvasTexture {
  const s = 128;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  let r = seed;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  const mix = (a: number[], t: number) => a.map((v, i) => Math.round(v * (1 - t) + tint[i]! * t));
  const base = mix(kind === "plaster" ? [176, 160, 134] : kind === "planks" ? [104, 72, 44] : [52, 38, 26], kind === "plaster" ? 0.35 : 0.15);
  g.fillStyle = `rgb(${base.join(",")})`;
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < 700; i++) {
    const k = (rnd() - 0.5) * (kind === "plaster" ? 22 : 30);
    g.fillStyle = `rgba(${base.map((v) => Math.max(0, Math.min(255, v + k))).join(",")},.55)`;
    g.fillRect(rnd() * s, rnd() * s, kind === "planks" ? 8 + rnd() * 20 : 2 + rnd() * 3, kind === "planks" ? 1 + rnd() : 2 + rnd() * 3);
  }
  if (kind !== "plaster") {
    g.strokeStyle = "rgba(20,12,6,.8)";
    g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      g.beginPath();
      g.moveTo(0, i * 32);
      g.lineTo(s, i * 32);
      g.stroke();
      const x = (i * 53) % s;
      g.beginPath();
      g.moveTo(x, i * 32);
      g.lineTo(x, i * 32 + 32);
      g.stroke();
    }
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Procedural stand-ins until the generated tileable textures land. */
function proceduralTexture(kind: "wall" | "floor" | "ceil" | "door", seed = 7): CanvasTexture {
  const s = 256;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  let r = seed;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  const base = { wall: [78, 70, 61], floor: [60, 54, 47], ceil: [34, 31, 28], door: [92, 62, 38] }[kind];
  const rgb = (k: number, a = 1) => `rgba(${base.map((v) => Math.max(0, Math.min(255, Math.round(v + k)))).join(",")},${a})`;
  g.fillStyle = rgb(0);
  g.fillRect(0, 0, s, s);
  // Grain: soft speckle at two scales, so close walls don't read as flat colour.
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = rgb((rnd() - 0.5) * 40, 0.35);
    const w = 1 + rnd() * (i < 400 ? 14 : 3);
    g.fillRect(rnd() * s, rnd() * s, w, w * (0.5 + rnd()));
  }
  /** One dressed stone: a lit top-left bevel, a shadowed bottom-right, a little face variation. */
  const stone = (x: number, y: number, w: number, h: number) => {
    g.fillStyle = rgb((rnd() - 0.5) * 22, 0.55);
    g.fillRect(x + 3, y + 3, w - 6, h - 6);
    g.fillStyle = "rgba(255,235,200,.13)";
    g.fillRect(x + 2, y + 2, w - 4, 3);
    g.fillRect(x + 2, y + 2, 3, h - 4);
    g.fillStyle = "rgba(0,0,0,.35)";
    g.fillRect(x + 2, y + h - 5, w - 4, 3);
    g.fillRect(x + w - 5, y + 2, 3, h - 4);
    // A chip or crack now and then.
    if (rnd() < 0.35) {
      g.strokeStyle = "rgba(0,0,0,.4)";
      g.lineWidth = 1.2;
      g.beginPath();
      let px = x + 6 + rnd() * (w - 12);
      let py = y + 4;
      g.moveTo(px, py);
      for (let k = 0; k < 4; k++) g.lineTo((px += (rnd() - 0.5) * 10), (py += h / 5));
      g.stroke();
    }
  };
  g.strokeStyle = "rgba(12,10,8,.85)";
  if (kind === "wall") {
    // Ashlar courses of uneven height, joints staggered, deep mortar.
    const rows = [0, 58, 104, 166, 210, 256];
    for (let i = 0; i < rows.length - 1; i++) {
      const y0 = rows[i]!;
      const h = rows[i + 1]! - y0;
      let x = i % 2 ? -40 : 0;
      while (x < s) {
        const w = 60 + Math.floor(rnd() * 50);
        stone(x, y0, w, h);
        // Tile the overhang so the texture wraps cleanly.
        if (x < 0) stone(x + s, y0, w, h);
        if (x + w > s) stone(x - s, y0, w, h);
        g.fillStyle = "rgba(12,10,8,.9)";
        g.fillRect(x - 2, y0, 4, h);
        x += w;
      }
      g.fillStyle = "rgba(12,10,8,.9)";
      g.fillRect(0, y0 - 2, s, 4);
    }
  } else if (kind === "floor") {
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) stone(x * 128, y * 128, 128, 128);
    g.lineWidth = 5;
    for (let i = 0; i <= 2; i++) {
      g.beginPath();
      g.moveTo(0, i * 128);
      g.lineTo(s, i * 128);
      g.moveTo(i * 128, 0);
      g.lineTo(i * 128, s);
      g.stroke();
    }
  } else if (kind === "ceil") {
    g.lineWidth = 4;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.moveTo(0, i * 64);
      g.lineTo(s, i * 64);
      g.stroke();
    }
  } else if (kind === "door") {
    g.lineWidth = 5;
    for (let i = 1; i < 5; i++) {
      g.beginPath();
      g.moveTo((i * s) / 5, 0);
      g.lineTo((i * s) / 5, s);
      g.stroke();
    }
    g.fillStyle = "#2b2420";
    g.fillRect(s * 0.1, s * 0.25, s * 0.8, 14);
    g.fillRect(s * 0.1, s * 0.7, s * 0.8, 14);
    g.fillStyle = "#c9a865";
    g.beginPath();
    g.arc(s * 0.78, s * 0.5, 11, 0, Math.PI * 2);
    g.fill();
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const POST_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const POST_FRAG = `
varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform vec2 res;
uniform float mode; // 0 none, 1 dither, 2 paper, 3 scan
uniform float time;
uniform vec3 ink;
uniform vec3 paper;
float bayer4(vec2 p){
  int i = int(mod(p.x, 4.0)) + int(mod(p.y, 4.0)) * 4;
  float m[16];
  m[0]=0.0; m[1]=8.0; m[2]=2.0; m[3]=10.0; m[4]=12.0; m[5]=4.0; m[6]=14.0; m[7]=6.0;
  m[8]=3.0; m[9]=11.0; m[10]=1.0; m[11]=9.0; m[12]=15.0; m[13]=7.0; m[14]=13.0; m[15]=5.0;
  float r = 0.0;
  for (int k = 0; k < 16; k++) if (k == i) r = m[k];
  return (r + 0.5) / 16.0;
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  vec2 d = vUv - 0.5;
  vec3 col = c;
  if (mode > 0.5 && mode < 1.5) {
    // Chunky: about 150 dither cells top to bottom, each sampled once, so a
    // cell is a big square pixel; shadows crushed to pure black.
    float cell = max(3.0, floor(res.y / 150.0));
    vec2 blk = floor(vUv * res / cell);
    vec3 s = texture2D(tDiffuse, (blk + 0.5) * cell / res).rgb;
    // Linear to display brightness, then the same crush as the canvas dither (art/dither.ts).
    float l = pow(dot(s, vec3(0.299, 0.587, 0.114)), 1.0 / 2.2);
    l = clamp((l - 0.18) / 0.6, 0.0, 1.0);
    col = l > bayer4(blk) ? paper : ink;
  } else if (mode > 1.5 && mode < 2.5) {
    float grain = hash(floor(vUv * res)) * 0.035 - 0.0175;
    col = (c * vec3(1.03, 1.0, 0.92) + grain) * (1.0 - dot(d, d) * 1.2);
  } else if (mode > 2.5) {
    float line = 0.86 + 0.14 * sin(vUv.y * res.y * 1.6);
    col = c * line * (1.0 - dot(d, d) * 0.9) * vec3(0.92, 1.04, 0.95);
  }
  gl_FragColor = vec4(max(col, 0.0), 1.0);
  #include <colorspace_fragment>
}`;

const BACKDROP_VERT = `
varying vec2 vUv;
uniform sampler2D depth;
uniform float amount;
void main(){
  vUv = uv;
  float d = texture2D(depth, uv).r;
  vec3 p = position + vec3(0.0, 0.0, d * amount);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const BACKDROP_FRAG = `
varying vec2 vUv;
uniform sampler2D map;
uniform float shade;
void main(){
  vec4 c = texture2D(map, vUv);
  gl_FragColor = vec4(c.rgb * shade, 1.0);
  #include <colorspace_fragment>
}`;

export class SceneLayer3D {
  readonly canvas: HTMLCanvasElement;
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(42, 1, 0.05, 100);
  private target: WebGLRenderTarget;
  private post: { scene: Scene; camera: OrthographicCamera; mat: ShaderMaterial };
  private mode: "backdrop" | "corridor" | "diorama" | "custom" | "none" = "none";
  private custom: { root: Group; update: ((t: number, dt: number) => void) | null; gen: number } | null = null;
  private customGen = 0;
  private lastFrame = 0;
  private dioramaKey = "";
  private standZ = -1.4;
  private ray = new Raycaster();
  /** A person in the room was clicked. */
  onPick: ((id: string) => void) | null = null;
  private room = new Group();
  private people = new Group();
  private backdrop: Mesh | null = null;
  private plane = { w: 16, h: 9 };
  private pointer = new Vector2();
  private look = new Vector2();
  private dolly = 0;
  private raf = 0;
  private t0 = performance.now();
  private textures = new Map<string, Texture>();
  private loading = new Map<string, Promise<Texture | null>>();
  private corridor: { key: string; pos: { x: number; y: number; yaw: number }; goal: { x: number; y: number; yaw: number } } | null = null;
  private wallUrl: string | null = null;
  private disposed = false;

  constructor(private host: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.canvas = this.renderer.domElement;
    this.canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";
    host.prepend(this.canvas);
    this.scene.background = new Color(0x0b0a09);
    this.scene.add(this.room, this.people);
    this.target = new WebGLRenderTarget(2, 2);
    const mat = new ShaderMaterial({
      vertexShader: POST_VERT,
      fragmentShader: POST_FRAG,
      uniforms: {
        tDiffuse: { value: this.target.texture },
        res: { value: new Vector2(2, 2) },
        mode: { value: 0 },
        time: { value: 0 },
        ink: { value: new Color(0x000000) },
        paper: { value: new Color(0xffffff) },
      },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new Mesh(new PlaneGeometry(2, 2), mat);
    const ps = new Scene();
    ps.add(quad);
    this.post = { scene: ps, camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1), mat };
    host.addEventListener("pointermove", this.onPointer);
    this.canvas.addEventListener("click", this.onClick);
    this.resize();
    const loop = () => {
      if (this.disposed) return;
      this.frame();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private onPointer = (e: PointerEvent) => {
    const r = this.host.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / Math.max(1, r.width) - 0.5) * 2, ((e.clientY - r.top) / Math.max(1, r.height) - 0.5) * 2);
  };

  private onClick = (e: MouseEvent) => {
    if (!this.onPick || (this.mode !== "backdrop" && this.mode !== "diorama")) return;
    const r = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new Vector2(((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1, -(((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1)), this.camera);
    const hit = this.ray.intersectObjects(this.people.children, false)[0];
    const id = hit?.object.userData.id as string | undefined;
    if (id) this.onPick(id);
  };

  setPost(fx: PostFx): void {
    this.post.mat.uniforms.mode!.value = { none: 0, dither: 1, paper: 2, scan: 3 }[fx];
  }

  /** Lean the camera in (a conversation) or back out. */
  setDolly(amount: number): void {
    this.dolly = amount;
  }

  private texture(url: string, transform?: (img: HTMLImageElement) => Texture): Promise<Texture | null> {
    const key = `${transform ? "t:" : ""}${url}`;
    const hit = this.textures.get(key);
    if (hit) return Promise.resolve(hit);
    let p = this.loading.get(key);
    if (!p) {
      p = loadImage(url)
        .then((img) => {
          const t = transform ? transform(img) : new Texture(img);
          if (!transform) t.colorSpace = SRGBColorSpace;
          t.needsUpdate = true;
          (t as Texture & { userData: Record<string, unknown> }).userData = { w: img.width, h: img.height };
          this.textures.set(key, t);
          return t;
        })
        .catch(() => null);
      this.loading.set(key, p);
    }
    return p;
  }

  private clearRoom(): void {
    for (const g of [this.room, this.people]) {
      for (const child of [...g.children]) {
        g.remove(child);
        const m = child as Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        for (const mt of mats) mt.dispose();
      }
    }
    this.backdrop = null;
    this.scene.fog = null;
    this.dropCustom();
  }

  /** Leave the theme's custom stage: dispose its graph and undo its renderer settings. */
  private dropCustom(): void {
    const c = this.custom;
    if (!c) return;
    this.custom = null;
    this.scene.remove(c.root);
    c.root.traverse((o) => {
      const m = o as Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mt of mats) mt.dispose();
    });
    this.renderer.shadowMap.enabled = false;
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.scene.environment = null;
    this.scene.background = new Color(0x0b0a09);
    this.scene.fog = null;
  }

  /** Switch to (or stay in) the theme's own 3D stage. */
  customStage(): Stage3D {
    if (this.mode !== "custom" || !this.custom) {
      this.clearRoom();
      this.corridor = null;
      this.mode = "custom";
      const root = new Group();
      this.scene.add(root);
      this.custom = { root, update: null, gen: ++this.customGen };
    }
    const c = this.custom;
    const layer = this;
    return {
      root: c.root,
      generation: c.gen,
      scene: this.scene,
      camera: this.camera,
      renderer: this.renderer,
      canvas: this.canvas,
      setUpdate(fn) {
        if (layer.custom === c) c.update = fn;
      },
      pick(clientX, clientY, objects) {
        const r = layer.canvas.getBoundingClientRect();
        layer.ray.setFromCamera(new Vector2(((clientX - r.left) / Math.max(1, r.width)) * 2 - 1, -(((clientY - r.top) / Math.max(1, r.height)) * 2 - 1)), layer.camera);
        return layer.ray.intersectObjects(objects, true)[0] ?? null;
      },
      texture: (url) => this.texture(url),
    };
  }

  /** The place's painting, displaced by its depth (a guess at once, the model's estimate when ready). */
  async showBackdrop(url: string | null): Promise<void> {
    if (this.mode !== "backdrop") {
      this.clearRoom();
      this.corridor = null;
      this.mode = "backdrop";
      this.scene.background = new Color(0x0b0a09);
      this.camera.fov = 42;
      this.camera.updateProjectionMatrix();
    }
    if (!url) return;
    const [map, img] = await Promise.all([this.texture(url), loadImage(url).catch(() => null)]);
    if (!map || !img || this.disposed || this.mode !== "backdrop") return;
    const depth = await this.texture(url, (i) => depthFor(i));
    const aspect = img.width / Math.max(1, img.height);
    this.plane = { w: 9 * aspect, h: 9 };
    const geo = new PlaneGeometry(this.plane.w, this.plane.h, 128, 72);
    const mat = new ShaderMaterial({
      vertexShader: BACKDROP_VERT,
      fragmentShader: BACKDROP_FRAG,
      uniforms: { map: { value: map }, depth: { value: depth }, amount: { value: 2.2 }, shade: { value: 1 } },
    });
    if (this.backdrop) {
      this.room.remove(this.backdrop);
      this.backdrop.geometry.dispose();
      (this.backdrop.material as ShaderMaterial).dispose();
    }
    this.backdrop = new Mesh(geo, mat);
    this.room.add(this.backdrop);
    this.resize();
    void this.realDepth(url, mat);
  }

  /**
   * The painting's real depth (Depth Anything V2 in a worker, vendored from
   * Cue) replaces the guess once it is estimated; the guess stays when the
   * model cannot run here. Estimated once per painting and kept in the
   * browser store.
   */
  private async realDepth(url: string, mat: ShaderMaterial): Promise<void> {
    const key = `d:${url}`;
    let t = this.textures.get(key);
    if (!t) {
      const map = await plateDepthFor(url).catch(() => null);
      if (!map || this.disposed) return;
      // The model says 0 = nearest; the mesh lifts by brightness (1 = nearest). Rows bottom-up for the texture.
      const data = new Uint8Array(map.width * map.height * 4);
      for (let y = 0; y < map.height; y++) {
        const row = (map.height - 1 - y) * map.width;
        for (let x = 0; x < map.width; x++) {
          const v = 255 - map.depth[y * map.width + x]!;
          const i = (row + x) * 4;
          data[i] = data[i + 1] = data[i + 2] = v;
          data[i + 3] = 255;
        }
      }
      t = new DataTexture(data, map.width, map.height);
      t.minFilter = t.magFilter = LinearFilter;
      t.needsUpdate = true;
      this.textures.set(key, t);
    }
    if (this.disposed || this.backdrop?.material !== mat) return;
    mat.uniforms.depth!.value = t;
  }

  /**
   * An indoor place as a little box room (6.2 "diorama rooms"): the painting
   * fills the back wall, so the room is still recognisably that place.
   */
  async showDiorama(url: string | null, opts: { counter: boolean }): Promise<void> {
    const key = `${url ?? ""}|${opts.counter}`;
    if (this.mode !== "diorama") {
      this.clearRoom();
      this.corridor = null;
      this.mode = "diorama";
      this.dioramaKey = "";
    }
    if (this.dioramaKey === key) return;
    this.dioramaKey = key;
    const [map, img] = url ? await Promise.all([this.texture(url), loadImage(url).catch(() => null)]) : [null, null];
    if (this.disposed || this.mode !== "diorama" || this.dioramaKey !== key) return;
    for (const child of [...this.room.children]) {
      this.room.remove(child);
      (child as Mesh).geometry?.dispose?.();
    }
    const tint = img ? averageColor(img) : ([120, 96, 70] as [number, number, number]);
    this.scene.background = new Color(0x0b0806);
    this.scene.fog = new Fog(0x0b0806, 6, 12);
    this.camera.fov = 50;
    this.camera.updateProjectionMatrix();
    const W = 6.4, H = 3.4, D = 5;
    const lam = (t: Texture, rx = 1, ry = 1) => {
      const tt = t.clone();
      tt.needsUpdate = true;
      tt.repeat.set(rx, ry);
      return new MeshLambertMaterial({ map: tt, side: DoubleSide });
    };
    const plaster = roomTexture("plaster", tint, 5);
    const planks = roomTexture("planks", tint, 9);
    const beams = roomTexture("beams", tint, 13);
    // Back wall: the painting, cropped to the wall's shape.
    const back = new Mesh(new PlaneGeometry(W, H), map ? new MeshBasicMaterial({ map: map.clone() }) : lam(plaster, 3, 2));
    if (map && img) {
      const m = (back.material as MeshBasicMaterial).map!;
      m.needsUpdate = true;
      const ia = img.width / Math.max(1, img.height);
      const wa = W / H;
      if (ia > wa) {
        m.repeat.set(wa / ia, 1);
        m.offset.set((1 - wa / ia) / 2, 0);
      } else {
        m.repeat.set(1, ia / wa);
        m.offset.set(0, (1 - ia / wa) / 2);
      }
    }
    back.position.set(0, H / 2, -D / 2);
    const left = new Mesh(new PlaneGeometry(D, H), lam(plaster, 3, 2));
    left.rotation.y = Math.PI / 2;
    left.position.set(-W / 2, H / 2, 0);
    const right = left.clone();
    right.rotation.y = -Math.PI / 2;
    right.position.x = W / 2;
    const floor = new Mesh(new PlaneGeometry(W, D), lam(planks, 4, 3));
    floor.rotation.x = -Math.PI / 2;
    const ceil = new Mesh(new PlaneGeometry(W, D), lam(beams, 4, 3));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = H;
    this.room.add(back, left, right, floor, ceil);
    this.standZ = -1.2;
    if (opts.counter) {
      // A counter across the room; whoever keeps the place stands behind it.
      const wood = lam(roomTexture("planks", tint, 21), 3, 1);
      const counter = new Mesh(new BoxGeometry(4.4, 0.86, 0.7), wood);
      counter.position.set(0, 0.43, -0.55);
      const top = new Mesh(new BoxGeometry(4.6, 0.08, 0.86), lam(roomTexture("beams", tint, 31), 3, 1));
      top.position.set(0, 0.9, -0.55);
      this.room.add(counter, top);
      for (const [x, h] of [[-1.6, 0.26], [-1.35, 0.18], [1.4, 0.3], [1.65, 0.22]] as const) {
        const prop = new Mesh(new CylinderGeometry(0.06, 0.07, h, 10), new MeshLambertMaterial({ color: new Color(`rgb(${tint.map((v) => Math.round(v * 0.6 + 40)).join(",")})`) }));
        prop.position.set(x, 0.94 + h / 2, -0.5);
        this.room.add(prop);
      }
      this.standZ = -1.6;
    }
    // Warm light: a lamp over the counter and a low fill.
    const lamp = new PointLight(0xffc27a, 22, 12, 1.4);
    lamp.position.set(0, H - 0.4, 0.4);
    const fill = new AmbientLight(0x8a7866, 2.3);
    this.room.add(lamp, fill);
  }

  /** People standing in the room, spread across the middle ground. */
  async showPeople(list: Billboard[]): Promise<void> {
    const want = list.map((b) => `${b.id}|${b.url}`).join(";");
    if ((this.people.userData.key as string | undefined) === want) return;
    this.people.userData.key = want;
    for (const child of [...this.people.children]) {
      this.people.remove(child);
      (child as Mesh).geometry.dispose();
      ((child as Mesh).material as MeshBasicMaterial).dispose();
    }
    const n = list.length;
    const loaded = await Promise.all(list.map((b) => this.texture(b.url, b.cutout ? undefined : (i) => softEdged(i))));
    if (this.disposed || (this.people.userData.key as string) !== want) return;
    const shown = loaded.filter((t): t is Texture => !!t);
    shown.forEach((tex, i) => {
      const ud = (tex as Texture & { userData: { w: number; h: number } }).userData;
      const mesh = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
      // Sized and spread each frame from what the camera sees (frame()).
      mesh.userData = { id: list[loaded.indexOf(tex)]?.id, sway: i * 1.7, i, n: shown.length, ar: ud.w / Math.max(1, ud.h), z: 1.5 + (i % 2) * 0.3 };
      this.people.add(mesh);
    });
  }

  /** A delve as real geometry: rebuilt when the seen map changes, the camera tweened between cells. */
  async showCorridor(v: CorridorView, wallUrl: string | null): Promise<void> {
    const key = `${v.grid.join("/")}|${v.opened.join(";")}|${v.glints.join(";")}|${wallUrl ?? ""}`;
    const yaw = -v.facing * (Math.PI / 2);
    if (this.mode !== "corridor") {
      this.clearRoom();
      this.mode = "corridor";
      this.corridor = null;
    }
    if (!this.corridor) this.corridor = { key: "", pos: { x: v.x, y: v.y, yaw }, goal: { x: v.x, y: v.y, yaw } };
    else {
      // Turn the short way round.
      let goalYaw = yaw;
      const cur = this.corridor.pos.yaw;
      while (goalYaw - cur > Math.PI) goalYaw -= Math.PI * 2;
      while (goalYaw - cur < -Math.PI) goalYaw += Math.PI * 2;
      this.corridor.goal = { x: v.x, y: v.y, yaw: goalYaw };
    }
    if (this.corridor.key === key) return;
    this.corridor.key = key;
    let wallTex: Texture = proceduralTexture("wall");
    if (wallUrl) {
      const t = await this.texture(wallUrl);
      if (t) {
        t.wrapS = t.wrapT = RepeatWrapping;
        wallTex = t;
      }
    }
    if (this.disposed || this.mode !== "corridor") return;
    this.wallUrl = wallUrl;
    for (const child of [...this.room.children]) {
      this.room.remove(child);
      (child as Mesh).geometry?.dispose();
    }
    this.scene.fog = new Fog(0x050404, 0.2, 4.2);
    this.camera.fov = 60;
    this.camera.updateProjectionMatrix();
    this.scene.background = new Color(0x050404);
    // Lit by the torch you carry (a flickering point light at the camera) over a cold dim fill.
    const wallMat = new MeshLambertMaterial({ map: wallTex, side: DoubleSide });
    const floorMat = new MeshLambertMaterial({ map: proceduralTexture("floor", 11) });
    const ceilMat = new MeshLambertMaterial({ map: proceduralTexture("ceil", 23) });
    const doorMat = new MeshLambertMaterial({ map: proceduralTexture("door", 5), side: DoubleSide });
    const torch = new PointLight(0xffa860, 4.2, 5.5, 1.1);
    torch.userData.torch = true;
    this.room.add(torch, new AmbientLight(0x8090b8, 0.55));
    const glintMat = new MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.85 });
    const at = (x: number, y: number) => v.grid[y]?.[x] ?? "#";
    const solid = (x: number, y: number) => {
      const c = at(x, y);
      return c === "#" || c === "?";
    };
    const wallGeo = new PlaneGeometry(1, 1);
    const flatGeo = new PlaneGeometry(1, 1);
    for (let y = 0; y < v.grid.length; y++) {
      for (let x = 0; x < (v.grid[y]?.length ?? 0); x++) {
        if (solid(x, y)) continue;
        const floor = new Mesh(flatGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(x, 0, y);
        const ceil = new Mesh(flatGeo, ceilMat);
        ceil.rotation.x = Math.PI / 2;
        ceil.position.set(x, 1, y);
        this.room.add(floor, ceil);
        for (let d = 0; d < 4; d++) {
          if (!solid(x + DX[d]!, y + DY[d]!)) continue;
          const w = new Mesh(wallGeo, wallMat);
          w.position.set(x + DX[d]! * 0.5, 0.5, y + DY[d]! * 0.5);
          w.rotation.y = -d * (Math.PI / 2);
          this.room.add(w);
        }
        if (at(x, y) === "L" && !v.opened.includes(`${x},${y}`)) {
          // A locked door fills the cell's middle, across the hall.
          const horizontal = !solid(x, y - 1) || !solid(x, y + 1);
          const door = new Mesh(wallGeo, doorMat);
          door.position.set(x, 0.5, y);
          door.rotation.y = horizontal ? 0 : Math.PI / 2;
          this.room.add(door);
        }
        if (v.glints.includes(`${x},${y}`)) {
          const g = new Mesh(new BoxGeometry(0.12, 0.12, 0.12), glintMat);
          g.position.set(x, 0.12, y);
          g.userData.spin = true;
          this.room.add(g);
        }
      }
    }
  }

  resize(): void {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    const pr = this.renderer.getPixelRatio();
    this.target.setSize(Math.round(w * pr), Math.round(h * pr));
    (this.post.mat.uniforms.res!.value as Vector2).set(w * pr, h * pr);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private frame(): void {
    const now = performance.now();
    const t = (now - this.t0) / 1000;
    const dt = this.lastFrame ? Math.min(0.1, (now - this.lastFrame) / 1000) : 0.016;
    this.lastFrame = now;
    this.look.lerp(this.pointer, 0.05);
    if (this.mode === "backdrop") {
      // Cover the viewport with the painting from a distance that fits it.
      const vfov = (this.camera.fov * Math.PI) / 180;
      const fitH = this.plane.h / (2 * Math.tan(vfov / 2));
      const fitW = this.plane.w / (2 * Math.tan(vfov / 2) * this.camera.aspect);
      const dist = Math.min(fitH, fitW) * 0.92 - this.dolly * 2.2;
      const drift = Math.sin(t * 0.21) * 0.25;
      this.camera.position.set(this.look.x * 0.55 + drift, -this.look.y * 0.3 + Math.sin(t * 0.17) * 0.08, dist);
      this.camera.lookAt(this.look.x * 0.2, -this.look.y * 0.1, 0);
      // People stand in the visible part of the room: about 60% of its height,
      // spread over its middle, feet above the dialogue box.
      for (const p of this.people.children) {
        const u = p.userData as { sway: number; i: number; n: number; ar: number; z: number };
        const depth = Math.max(0.5, dist - u.z);
        const visH = 2 * Math.tan(vfov / 2) * depth;
        const visW = visH * this.camera.aspect;
        const h = visH * (u.n > 3 ? 0.52 : 0.6);
        const w = h * u.ar;
        const span = Math.min(visW * 0.66, u.n * w * 0.95);
        const x = u.n === 1 ? visW * 0.12 : -span / 2 + (span * u.i) / (u.n - 1);
        p.scale.set(w, h, 1);
        p.position.set(x + this.camera.position.x * 0.15, this.camera.position.y - visH / 2 + h / 2 + visH * 0.14 + Math.sin(t * 1.3 + u.sway) * 0.02, u.z);
        p.lookAt(this.camera.position.x, p.position.y, this.camera.position.z);
      }
    } else if (this.mode === "diorama") {
      // A fixed camera at the room's open side, leaning toward the pointer.
      this.camera.position.set(this.look.x * 0.45 + Math.sin(t * 0.2) * 0.08, 1.7 - this.look.y * 0.15, 4.3 - this.dolly * 1.2);
      this.camera.lookAt(this.look.x * 0.25, 1.25, -1.6);
      for (const p of this.people.children) {
        const u = p.userData as { sway: number; i: number; n: number; ar: number };
        const h = u.n > 3 ? 1.8 : 2.05;
        const w = h * u.ar;
        const span = Math.min(4.2, u.n * w * 0.9);
        const x = u.n === 1 ? 0.5 : -span / 2 + (span * u.i) / (u.n - 1);
        p.scale.set(w, h, 1);
        p.position.set(x, h / 2 + Math.sin(t * 1.3 + u.sway) * 0.01, this.standZ - (u.i % 2) * 0.15);
        p.lookAt(this.camera.position.x, p.position.y, this.camera.position.z);
      }
    } else if (this.mode === "corridor" && this.corridor) {
      const c = this.corridor;
      c.pos.x += (c.goal.x - c.pos.x) * 0.18;
      c.pos.y += (c.goal.y - c.pos.y) * 0.18;
      c.pos.yaw += (c.goal.yaw - c.pos.yaw) * 0.2;
      const bob = Math.sin(t * 2.2) * 0.008;
      // Stand at the back of the cell, as crawlers do, so its side walls are in view.
      this.camera.position.set(c.pos.x + Math.sin(c.pos.yaw) * 0.38, 0.5 + bob, c.pos.y + Math.cos(c.pos.yaw) * 0.38);
      this.camera.rotation.set(0, c.pos.yaw, 0);
      this.camera.rotateY(this.look.x * -0.06);
      for (const m of this.room.children) {
        if (m.userData.spin) m.rotation.y = t * 1.5;
        if (m.userData.torch) {
          // Held a little low and to the right; the flame breathes.
          m.position.set(this.camera.position.x + Math.cos(c.pos.yaw) * 0.12, 0.42, this.camera.position.z - Math.sin(c.pos.yaw) * 0.12);
          (m as PointLight).intensity = 4.2 + Math.sin(t * 9.1) * 0.18 + Math.sin(t * 23.7) * 0.1;
        }
      }
    }
    if (this.mode === "custom" && this.custom) {
      try {
        this.custom.update?.(t, dt);
      } catch (err) {
        console.error("[gambit] 3D stage update", err);
      }
      // With no post effect, draw straight to the screen so tone mapping applies.
      if (this.post.mat.uniforms.mode!.value === 0) {
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.scene, this.camera);
        return;
      }
    }
    this.post.mat.uniforms.time!.value = t;
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.post.scene, this.post.camera);
  }

  destroy(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.host.removeEventListener("pointermove", this.onPointer);
    this.canvas.removeEventListener("click", this.onClick);
    this.clearRoom();
    for (const t of this.textures.values()) t.dispose();
    this.target.dispose();
    this.post.mat.dispose();
    this.renderer.dispose();
    // Free the context now: a page only gets ~16, and the scene is mounted again on every visit.
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
