/**
 * What the diorama shop builds when a fight or a talk starts in it
 * (room3d.ts `encounter`): the camera framings, solved per screen shape so
 * the counter top lands where the battle stands its figures; a row of brass
 * footlights along the counter's front edge (the counter becomes a little
 * paper theatre's stage) with a low shadow-casting light; and invisible
 * shadow casters, one per enemy, cut from the enemy's own picture, so each
 * paper figure the battle draws over the room throws a real shadow on the
 * oak and a tall one on the painted back wall.
 */
import {
  AdditiveBlending,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshDepthMaterial,
  MeshDistanceMaterial,
  RGBADepthPacking,
  SpotLight,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  BoxGeometry,
  ExtrudeGeometry,
  Shape,
  Raycaster,
  SphereGeometry,
  Texture,
  Vector2,
  Vector3,
} from "three";
import type { EnemyMark, RoomBand } from "./bridge.js";
import { TOP, mat, shade } from "./models.js";

export const FRONT_Z = 0.85;

/** A camera pose: where it stands, what it looks at, its vertical field of view. */
export interface Pose {
  pos: Vector3;
  target: Vector3;
  fov: number;
}

/** The vertical field of view an encounter uses at this aspect (w/h). */
export function encounterFov(aspect: number): number {
  if (aspect < 0.95) return Math.max(42, Math.min(72, 2 * Math.atan(0.44 / aspect) * (180 / Math.PI)));
  const want = Math.tan((76 / 2) * (Math.PI / 180));
  return Math.max(37, Math.min(62, 2 * Math.atan(want / aspect) * (180 / Math.PI)));
}

/**
 * A camera on the room's centre line that puts world point `a` at screen
 * height `sa` and `b` at `sb` (0 top, 1 bottom), searching its height and
 * distance (it prefers to stand near `z0`).
 */
export function solvePose(fov: number, a: { y: number; z: number; s: number }, b: { y: number; z: number; s: number }, z0: number, x = 0, h0?: number): Pose {
  const th = Math.tan((fov / 2) * (Math.PI / 180));
  let best = { err: Infinity, h: 2, z: z0, pitch: 0.3 };
  for (let z = Math.max(1.0, z0 - 2); z <= z0 + 1.4; z += 0.05) {
    for (let h = 0.9; h <= 4; h += 0.01) {
      const aa = Math.atan2(h - a.y, z - a.z);
      const pitch = aa - Math.atan((a.s - 0.5) * 2 * th);
      const ab = Math.atan2(h - b.y, z - b.z);
      const s = 0.5 + Math.tan(ab - pitch) / (2 * th);
      const err = Math.abs(s - b.s) + (h0 === undefined ? Math.abs(z - z0) * 0.004 : Math.abs(h - h0) * 0.01);
      if (err < best.err) best = { err, h, z, pitch };
    }
  }
  const reach = best.z + 1;
  return {
    pos: new Vector3(x, best.h, best.z),
    target: new Vector3(x, best.h - Math.tan(best.pitch) * reach, best.z - reach),
    fov,
  };
}

/** The framing for a fight: the counter top is the stage floor. */
export function battlePose(aspect: number): Pose {
  const fov = encounterFov(aspect);
  if (aspect < 0.95) {
    // Upright, the counter sits high enough to leave room for the cards and a full skill rack: the shorter the screen, the higher.
    const floor = Math.max(0.33, Math.min(0.4, 0.33 + 0.643 - aspect));
    return solvePose(fov, { y: TOP, z: 0, s: floor - 0.0715 }, { y: TOP, z: FRONT_Z, s: floor + 0.0585 }, 3.6);
  }
  return solvePose(fov, { y: TOP, z: 0, s: 0.46 }, { y: TOP, z: FRONT_Z, s: 0.665 }, 2.8);
}

/** The framing for a talk: the person behind the counter, big, the counter's back edge low on screen. */
export function parleyPose(aspect: number, strip = false): Pose {
  const fov = encounterFov(aspect);
  if (aspect < 0.95) return solvePose(fov, { y: 2.0, z: -0.5, s: 0.03 }, { y: TOP, z: 0, s: 0.36 }, 3.4, 0, 1.75);
  // A phone gives the talk a short wide strip of room: the person fills it, the counter along its foot.
  if (strip) return solvePose(fov, { y: 2.02, z: -0.5, s: 0.07 }, { y: TOP, z: 0, s: 0.9 }, 2.6);
  return solvePose(fov, { y: 2.02, z: -0.5, s: 0.2 }, { y: TOP, z: 0, s: 0.6 }, 3.5);
}

/** A camera set to a pose, for projecting and unprojecting against the pose (not the gliding camera). */
export function poseCamera(cam: PerspectiveCamera, p: Pose, aspect: number): PerspectiveCamera {
  cam.fov = p.fov;
  cam.aspect = aspect;
  cam.near = 0.05;
  cam.far = 40;
  cam.position.copy(p.pos);
  cam.lookAt(p.target);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
  return cam;
}

const v = new Vector3();
/** World point → screen fractions. */
export function toScreen(cam: PerspectiveCamera, x: number, y: number, z: number): { x: number; y: number } {
  v.set(x, y, z).project(cam);
  return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
}

const ray = new Raycaster();
const ndc = new Vector2();
/** Screen fractions → the point on the horizontal plane at height `py` (or the vertical plane z = `pz`). */
export function toWorld(cam: PerspectiveCamera, sx: number, sy: number, plane: { y?: number; z?: number }): Vector3 | null {
  ndc.set(sx * 2 - 1, -(sy * 2 - 1));
  ray.setFromCamera(ndc, cam);
  const o = ray.ray.origin;
  const d = ray.ray.direction;
  let t: number;
  if (plane.y !== undefined) {
    if (Math.abs(d.y) < 1e-5) return null;
    t = (plane.y - o.y) / d.y;
  } else {
    if (Math.abs(d.z) < 1e-5) return null;
    t = (plane.z! - o.z) / d.z;
  }
  if (t <= 0) return null;
  return o.clone().addScaledVector(d, t);
}

/** World units per screen height at a point (how big a figure of screen height h is there). */
export function unitsPerScreen(cam: PerspectiveCamera, p: Vector3): number {
  const fwd = new Vector3();
  cam.getWorldDirection(fwd);
  const d = p.clone().sub(cam.position).dot(fwd);
  return 2 * Math.tan((cam.fov / 2) * (Math.PI / 180)) * Math.max(0.1, d);
}

/** Where the counter top lies on screen for the fight's framing. */
export function measureBand(cam: PerspectiveCamera, aspect: number, spanL: number, spanR: number): RoomBand {
  const back = toScreen(cam, 0, TOP, 0).y;
  const front = toScreen(cam, 0, TOP, FRONT_Z).y;
  const zf = 0.45;
  const l = toScreen(cam, spanL, TOP, zf).x;
  const r = toScreen(cam, spanR, TOP, zf).x;
  return { back, front, left: Math.max(0.02, l), right: Math.min(0.98, r), aspect };
}

/* ------------------------------ Footlights ------------------------------ */

export interface Footlights {
  group: Group;
  flames: Mesh[];
  glows: Mesh[];
  light: SpotLight;
}

/**
 * A row of brass footlight cups along the front of the counter, each with a
 * tin reflector turned toward the back and a candle flame, and one low warm
 * light that throws the figures' shadows up the back wall.
 */
export function footlights(n: number, span: number, small: boolean): Footlights {
  const g = new Group();
  const brass = mat.brass();
  const tin = new MeshStandardMaterial({ color: 0xd8c8a0, metalness: 0.9, roughness: 0.28, side: DoubleSide });
  const wax = mat.color(0xf2e6c6, 0.5);
  const cupG = new LatheGeometry([[0, 0], [0.05, 0], [0.056, 0.012], [0.05, 0.03], [0.038, 0.04], [0.036, 0.045]].map(([x, y]) => new Vector2(x, y)), 24);
  // A curved tin hood, open toward the stage (the back), shading the audience.
  const hoodG = new CylinderGeometry(0.075, 0.075, 0.12, 20, 1, true, -Math.PI / 2 - 1.1, 2.2);
  const flames: Mesh[] = [];
  const glows: Mesh[] = [];
  const glowTex = glowTexture();
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0 : -span + (2 * span * i) / (n - 1);
    const unit = new Group();
    unit.position.set(x, TOP, FRONT_Z - 0.07);
    unit.add(new Mesh(cupG, brass));
    const hood = new Mesh(hoodG, tin);
    hood.position.set(0, 0.075, 0.012);
    hood.rotation.y = Math.PI;
    unit.add(hood);
    const candle = new Mesh(new CylinderGeometry(0.016, 0.016, 0.05, 10), wax);
    candle.position.y = 0.065;
    unit.add(candle);
    const flame = new Mesh(new SphereGeometry(0.013, 10, 8).scale(1, 2.1, 1), new MeshBasicMaterial({ color: 0xffd36a }));
    flame.position.y = 0.112;
    flame.userData.ownEmissive = true;
    unit.add(flame);
    flames.push(flame);
    const glow = new Mesh(new PlaneGeometry(0.22, 0.22), new MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0.8 }));
    glow.position.y = 0.11;
    glow.userData.ownEmissive = true;
    unit.add(glow);
    glows.push(glow);
    g.add(shade(unit, false, true));
    for (const f of [flame, glow]) f.castShadow = false;
  }
  // One spot from just in front of the footlight row, up across the stage to the backcloth (a single shadow pass).
  const light = new SpotLight(0xffa850, 16, 0, 1.0, 0.7, 1.2);
  light.position.set(-1.35, TOP + 0.12, FRONT_Z + 0.6);
  light.target.position.set(0.35, TOP + 0.85, -0.45);
  light.castShadow = true;
  light.shadow.mapSize.set(small ? 512 : 1024, small ? 512 : 1024);
  light.shadow.bias = -0.0015;
  light.shadow.radius = 5;
  light.shadow.camera.near = 0.1;
  light.shadow.camera.far = 8;
  g.add(light, light.target);
  return { group: g, flames, glows, light };
}

let glowCanvas: HTMLCanvasElement | null = null;
function glowTexture(): CanvasTexture {
  if (!glowCanvas) {
    glowCanvas = document.createElement("canvas");
    glowCanvas.width = glowCanvas.height = 64;
    const c = glowCanvas.getContext("2d")!;
    const r = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, "rgba(255,230,160,1)");
    r.addColorStop(0.25, "rgba(255,180,80,.55)");
    r.addColorStop(1, "rgba(255,140,40,0)");
    c.fillStyle = r;
    c.fillRect(0, 0, 64, 64);
  }
  return new CanvasTexture(glowCanvas);
}

/* ------------------------------ Shadow casters ------------------------------ */

/**
 * One invisible plane per enemy, standing where its figure stands on the
 * counter and as tall, cut from its picture's alpha: it writes no colour,
 * only the shadow maps, so the lamp and the footlights throw the figure's
 * own silhouette on the wood and the wall.
 */
export class Casters {
  readonly group = new Group();
  private planes = new Map<string, { mesh: Mesh; tex: Texture | null; image: CanvasImageSource | null }>();
  private texOf = new WeakMap<object, Texture>();
  private owned = new Set<Texture>();
  private geo = new PlaneGeometry(1, 1).translate(0, 0.5, 0);

  sync(marks: EnemyMark[], cam: PerspectiveCamera, aspect: number): void {
    const seen = new Set<string>();
    for (const m of marks) {
      seen.add(m.id);
      let p = this.planes.get(m.id);
      if (!p) {
        // Double-sided in the shadow pass: three draws a one-sided material's back faces there, and these face the light.
        const mat0 = new MeshBasicMaterial({ color: 0xffffff, alphaTest: 0.5, colorWrite: false, depthWrite: false, side: DoubleSide, shadowSide: DoubleSide });
        const mesh = new Mesh(this.geo, mat0);
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        mesh.renderOrder = -1;
        p = { mesh, tex: null, image: null };
        this.planes.set(m.id, p);
        this.group.add(mesh);
      }
      if (m.image && m.image !== p.image) {
        p.image = m.image;
        let t = this.texOf.get(m.image as object);
        if (!t) {
          t = new Texture(m.image as HTMLImageElement);
          t.needsUpdate = true;
          this.texOf.set(m.image as object, t);
          this.owned.add(t);
        }
        p.tex = t;
        const [bx, by, bw, bh] = m.bbox;
        // Its own UV window on the shared texture (the bbox), so the plane is exactly the figure.
        const tt = t.clone();
        tt.needsUpdate = true;
        tt.repeat.set(bw, bh);
        tt.offset.set(bx, 1 - by - bh);
        this.owned.add(tt);
        const mm = p.mesh.material as MeshBasicMaterial;
        mm.map = tt;
        mm.needsUpdate = true;
        p.mesh.customDistanceMaterial = new MeshDistanceMaterial({ map: tt, alphaTest: 0.5 });
        p.mesh.customDepthMaterial = new MeshDepthMaterial({ map: tt, alphaTest: 0.5, depthPacking: RGBADepthPacking });
      }
      const feet = toWorld(cam, m.x + m.dx, m.y, { y: TOP });
      const show = !!p.tex && m.alive && m.alpha > 0.35 && !!feet && feet.z > -0.25 && feet.z < FRONT_Z;
      p.mesh.visible = show;
      if (!show || !feet) continue;
      const u = unitsPerScreen(cam, feet);
      const hW = Math.max(0.05, m.h * u);
      const img = m.image as { width?: number; height?: number } | null;
      const iw = (img?.width ?? 1) * m.bbox[2];
      const ih = (img?.height ?? 1) * m.bbox[3];
      const wW = p.tex ? (hW * iw) / Math.max(1, ih) : hW * 0.45;
      p.mesh.position.set(feet.x, TOP + 0.002 - m.dy * u, feet.z);
      p.mesh.scale.set(wW, hW, 1);
      p.mesh.lookAt(cam.position.x, p.mesh.position.y, cam.position.z);
      void aspect;
    }
    for (const [id, p] of this.planes) {
      if (seen.has(id)) continue;
      this.group.remove(p.mesh);
      (p.mesh.material as MeshBasicMaterial).dispose();
      this.planes.delete(id);
    }
  }

  dispose(): void {
    for (const t of this.owned) t.dispose();
    this.owned.clear();
    this.geo.dispose();
    for (const p of this.planes.values()) (p.mesh.material as MeshBasicMaterial).dispose();
    this.planes.clear();
  }
}

/* ------------------------------ The proscenium ------------------------------ */

/**
 * A little theatre's frame stood on the counter for a fight: two walnut flats at the ends of the backcloth with
 * brass-capped edges, and over the opening a red velvet valance with a scalloped hem on a brass rod (its height
 * is set per framing: `userData.valance`).
 */
export function proscenium(indoor: boolean): Group {
  const g = new Group();
  const wal = mat.walnut(0.4, 1.4);
  const brass = mat.brass();
  for (const sx of [-1, 1]) {
    const flat = new Group();
    const h = 3.0;
    const board = new Mesh(new BoxGeometry(0.5, h, 0.06), wal);
    board.position.set(0, h / 2, 0);
    flat.add(board);
    for (const y of [0.4, 1.5, 2.6]) {
      const band = new Mesh(new BoxGeometry(0.52, 0.04, 0.08), brass);
      band.position.set(0, y, 0);
      flat.add(band);
    }
    const edge = new Mesh(new CylinderGeometry(0.018, 0.018, h, 10), brass);
    edge.position.set(-sx * 0.25, h / 2, 0.03);
    flat.add(edge);
    flat.position.set(sx * 2.72, TOP - 0.2, -0.3);
    g.add(shade(flat));
  }
  const val = new Group();
  const W = 6.2;
  const s = new Shape();
  const n = 16;
  s.moveTo(-W / 2, 0.42);
  s.lineTo(W / 2, 0.42);
  s.lineTo(W / 2, 0.12);
  for (let i = n; i > 0; i--) {
    const x1 = -W / 2 + ((i - 1) * W) / n;
    const xm = x1 + W / n / 2;
    s.quadraticCurveTo(xm, -0.08, x1, 0.12);
  }
  s.closePath();
  const velvet = new MeshStandardMaterial({ color: indoor ? 0x5a1410 : 0x4a1a12, roughness: 0.92, metalness: 0 });
  const cloth = new Mesh(new ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false }), velvet);
  cloth.position.set(0, -0.42, 0);
  val.add(cloth);
  const trim = new Mesh(new BoxGeometry(W, 0.03, 0.05), brass);
  trim.position.set(0, -0.3, 0.03);
  val.add(trim);
  const rod = new Mesh(new CylinderGeometry(0.03, 0.03, W + 0.3, 12).rotateZ(Math.PI / 2), brass);
  rod.position.set(0, 0.0, 0.04);
  val.add(rod);
  val.position.set(0, TOP + 1.9, -0.25);
  g.add(shade(val, true, true));
  g.userData.valance = val;
  g.visible = false;
  return g;
}
