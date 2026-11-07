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
 */
import {
  BoxGeometry,
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
} from "three";

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

/** Procedural stand-ins until the generated tileable textures land. */
function proceduralTexture(kind: "wall" | "floor" | "ceil" | "door", seed = 7): CanvasTexture {
  const s = 128;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  let r = seed;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  const base = { wall: [74, 66, 58], floor: [58, 52, 46], ceil: [30, 27, 25], door: [92, 62, 38] }[kind];
  g.fillStyle = `rgb(${base.join(",")})`;
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < 900; i++) {
    const k = (rnd() - 0.5) * 34;
    g.fillStyle = `rgba(${base.map((v) => Math.max(0, Math.min(255, v + k))).join(",")},.6)`;
    g.fillRect(rnd() * s, rnd() * s, 2 + rnd() * 3, 2 + rnd() * 3);
  }
  g.strokeStyle = "rgba(10,8,6,.75)";
  g.lineWidth = 3;
  if (kind === "wall") {
    for (let row = 0; row < 4; row++) {
      const y = row * 32;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(s, y);
      g.stroke();
      for (let col = 0; col < 3; col++) {
        const x = col * 48 + (row % 2 ? 24 : 0);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x, y + 32);
        g.stroke();
      }
    }
  } else if (kind === "floor") {
    for (let i = 0; i <= 2; i++) {
      g.beginPath();
      g.moveTo(0, i * 64);
      g.lineTo(s, i * 64);
      g.moveTo(i * 64, 0);
      g.lineTo(i * 64, s);
      g.stroke();
    }
  } else if (kind === "door") {
    for (let i = 1; i < 5; i++) {
      g.beginPath();
      g.moveTo((i * s) / 5, 0);
      g.lineTo((i * s) / 5, s);
      g.stroke();
    }
    g.fillStyle = "#2b2420";
    g.fillRect(s * 0.1, s * 0.25, s * 0.8, 8);
    g.fillRect(s * 0.1, s * 0.7, s * 0.8, 8);
    g.fillStyle = "#c9a865";
    g.beginPath();
    g.arc(s * 0.78, s * 0.5, 6, 0, Math.PI * 2);
    g.fill();
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  t.magFilter = NearestFilter;
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
    vec2 px = floor(vUv * res / 2.0);
    float l = pow(dot(c, vec3(0.299, 0.587, 0.114)), 1.0 / 2.2);
    l = clamp((l - 0.1) * 1.4, 0.0, 1.0);
    col = l > bayer4(px) ? paper : ink;
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
  private mode: "backdrop" | "corridor" | "none" = "none";
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
        ink: { value: new Color(0x0c0b0a) },
        paper: { value: new Color(0xe8e2d0) },
      },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new Mesh(new PlaneGeometry(2, 2), mat);
    const ps = new Scene();
    ps.add(quad);
    this.post = { scene: ps, camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1), mat };
    host.addEventListener("pointermove", this.onPointer);
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
  }

  /** The place's painting, displaced by a depth guess. */
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
      mesh.userData = { sway: i * 1.7, i, n: shown.length, ar: ud.w / Math.max(1, ud.h), z: 1.5 + (i % 2) * 0.3 };
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
    const wallMat = new MeshBasicMaterial({ map: wallTex, side: DoubleSide });
    const floorMat = new MeshBasicMaterial({ map: proceduralTexture("floor", 11) });
    const ceilMat = new MeshBasicMaterial({ map: proceduralTexture("ceil", 23) });
    const doorMat = new MeshBasicMaterial({ map: proceduralTexture("door", 5), side: DoubleSide });
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
      for (const m of this.room.children) if (m.userData.spin) m.rotation.y = t * 1.5;
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
    this.clearRoom();
    for (const t of this.textures.values()) t.dispose();
    this.target.dispose();
    this.post.mat.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }
}
