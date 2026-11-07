/**
 * The shop's furniture and props as three.js models, built in code: the
 * counter (a bevelled, chamfered oak slab over a panelled walnut front),
 * bookcases with instanced books, crate stacks, the easel, the cash
 * register (an extruded side profile so its key deck really slopes), a
 * lathed teacup and hourglass, a lantern, books, a globe, a pendulum clock,
 * the thread rack, a hanging lamp, framed standees. Materials use the
 * theme's procedural canvas textures (textures.ts) as colour and bump maps.
 * Units are metres; the counter top is at y = 1.05, its front edge at z = 0.85.
 */
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  QuadraticBezierCurve3,
  RepeatWrapping,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  type Material,
  type Texture,
} from "three";
import { rng } from "../contract.js";
import { bookcase, oak, paper, stallStack, walnut } from "./textures.js";

export const TOP = 1.05;

/* ------------------------------ Textures ------------------------------ */

/** Every texture the models made, to dispose with the theme. */
export const madeTextures = new Set<Texture>();
function canvasTex(c: HTMLCanvasElement, rx = 1, ry = 1, srgb = true): CanvasTexture {
  const t = new CanvasTexture(c);
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 4;
  madeTextures.add(t);
  return t;
}
const texCache = new Map<string, CanvasTexture>();
function cachedTex(key: string, make: () => HTMLCanvasElement, rx = 1, ry = 1): CanvasTexture {
  const k = `${key}|${rx}|${ry}`;
  let t = texCache.get(k);
  if (!t) {
    t = canvasTex(make(), rx, ry);
    texCache.set(k, t);
  }
  return t;
}
export function forgetTextures(): void {
  for (const t of madeTextures) t.dispose();
  madeTextures.clear();
  texCache.clear();
}

/** A canvas you draw text or a picture on, as a texture you can redraw later. */
export function drawnTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!, w, h);
  const t = canvasTex(c);
  t.wrapS = t.wrapT = 1001; // ClampToEdge
  return t;
}
export function redraw(t: CanvasTexture, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): void {
  const c = t.image as HTMLCanvasElement;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, c.width, c.height);
  draw(g, c.width, c.height);
  t.needsUpdate = true;
}

/* ------------------------------ Materials ------------------------------ */

const std = (o: ConstructorParameters<typeof MeshStandardMaterial>[0]) => new MeshStandardMaterial(o);
export const mat = {
  oak: (rx = 1, ry = 1) => {
    const t = cachedTex("oak", oak, rx, ry);
    return std({ map: t, bumpMap: t, bumpScale: 1.2, roughness: 0.42, metalness: 0 });
  },
  walnut: (rx = 1, ry = 1) => {
    const t = cachedTex("walnut", walnut, rx, ry);
    return std({ map: t, bumpMap: t, bumpScale: 1, roughness: 0.6 });
  },
  brass: () => std({ color: 0xc8963e, metalness: 0.85, roughness: 0.32, emissive: 0x1a0e00 }),
  darkBrass: () => std({ color: 0x7a5420, metalness: 0.8, roughness: 0.45 }),
  iron: () => std({ color: 0x2a2a2a, metalness: 0.7, roughness: 0.55 }),
  verdigris: () => {
    const t = cachedTex("verd", () => paper(19, 256, 256, [70, 104, 84]), 2, 2);
    return std({ color: 0x9fc0a8, map: t, bumpMap: t, bumpScale: 3, metalness: 0.55, roughness: 0.5 });
  },
  porcelain: () => new MeshPhysicalMaterial({ color: 0xf6efe2, roughness: 0.18, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
  glass: () => new MeshPhysicalMaterial({ color: 0xe8f4f6, roughness: 0.05, transmission: 0.0, transparent: true, opacity: 0.22, metalness: 0, clearcoat: 1, depthWrite: false }),
  paper: () => std({ map: cachedTex("paperM", () => paper(41, 256, 256), 1, 1), roughness: 0.9 }),
  color: (c: number, rough = 0.7, metal = 0) => std({ color: c, roughness: rough, metalness: metal }),
};

/** Mark meshes to cast and receive shadows. */
export function shade<T extends Object3D>(o: T, cast = true, receive = true): T {
  o.traverse((m) => {
    if ((m as Mesh).isMesh) {
      m.castShadow = cast;
      m.receiveShadow = receive;
    }
  });
  return o;
}
function mesh(g: BufferGeometry, m: Material | Material[], x = 0, y = 0, z = 0): Mesh {
  const me = new Mesh(g, m);
  me.position.set(x, y, z);
  return me;
}
const lathe = (pts: [number, number][], seg = 40) => new LatheGeometry(pts.map(([x, y]) => new Vector2(x, y)), seg);

/* ------------------------------ The room ------------------------------ */

/** The counter: chamfered oak slab with a bullnose bevel, a walnut front with raised panels and a plinth. */
export function counter(): Group {
  const g = new Group();
  const c = 0.24, x0 = -2.15, x1 = 2.15, zb = 0.0, zf = 0.85;
  const s = new Shape();
  s.moveTo(x0, -zb);
  s.lineTo(x1, -zb);
  s.lineTo(x1, -(zf - c));
  s.lineTo(x1 - c, -zf);
  s.lineTo(x0 + c, -zf);
  s.lineTo(x0, -(zf - c));
  s.closePath();
  const slab = new ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.022, bevelSize: 0.03, bevelSegments: 4 });
  slab.rotateX(-Math.PI / 2);
  g.add(mesh(slab, mat.oak(0.24, 0.9), 0, TOP - 0.072, 0));
  // Front: the main face and two chamfer faces, walnut, set back under the lip.
  const fh = TOP - 0.1;
  const wal = mat.walnut(1.2, 0.6);
  const front = mesh(new BoxGeometry(x1 - x0 - 2 * c, fh, 0.06), wal, 0, fh / 2, zf - 0.04);
  g.add(front);
  for (const sx of [-1, 1]) {
    const f = mesh(new BoxGeometry(c * Math.SQRT2, fh, 0.06), wal, sx * (x1 - c / 2 - 0.02), fh / 2, zf - c / 2 - 0.04);
    f.rotation.y = sx * Math.PI / 4;
    g.add(f);
  }
  // Raised panels with a moulded frame on the main face.
  const pn = 6;
  const pw = (x1 - x0 - 2 * c) / pn;
  const panel = mat.walnut(0.35, 0.35);
  const rail = mat.oak(0.2, 0.05);
  for (let i = 0; i < pn; i++) {
    const cx = x0 + c + pw * (i + 0.5);
    g.add(mesh(new BoxGeometry(pw * 0.72, fh * 0.56, 0.03), panel, cx, fh * 0.52, zf + 0.0));
    g.add(mesh(new BoxGeometry(pw * 0.8, 0.025, 0.04), rail, cx, fh * 0.82, zf - 0.005));
    g.add(mesh(new BoxGeometry(pw * 0.8, 0.025, 0.04), rail, cx, fh * 0.22, zf - 0.005));
  }
  // Plinth and a dark body so nothing behind shows below the top.
  g.add(mesh(new BoxGeometry(x1 - x0 - 2 * c + 0.06, 0.1, 0.1), mat.color(0x1c1008, 0.8), 0, 0.05, zf - 0.02));
  g.add(mesh(new BoxGeometry(x1 - x0 - 0.1, fh, zf - 0.1), mat.color(0x120a05, 0.9), 0, fh / 2, (zf - 0.1) / 2));
  return shade(g);
}

/** A floor of planks and (indoors) a beamed ceiling. */
export function floorAndCeiling(indoor: boolean): Group {
  const g = new Group();
  const f = mesh(new PlaneGeometry(9, 9), mat.oak(1.6, 4), 0, 0, -0.5);
  (f.material as MeshStandardMaterial).color = new Color(0x6a4a30);
  f.rotation.x = -Math.PI / 2;
  f.receiveShadow = true;
  g.add(f);
  if (indoor) {
    const ceil = mesh(new PlaneGeometry(7, 5), mat.walnut(2, 2), 0, 3.5, -0.4);
    ceil.rotation.x = Math.PI / 2;
    g.add(ceil);
    for (const z of [-1.6, -0.4, 0.8]) g.add(shade(mesh(new BoxGeometry(6.6, 0.22, 0.22), mat.walnut(3, 0.2), 0, 3.4, z), true, false));
  }
  return g;
}

const BOOK_COLORS = [0x6c2219, 0x2e3e2c, 0x24304a, 0x5c4022, 0x784e2c, 0x44182e, 0x2c221a, 0x8a6a3e, 0x4a523a, 0x60281e];

/** A tall bookcase against a side wall, filled with instanced books, its face turned toward the room. */
export function bookcaseWall(side: -1 | 1, seed: number): Group {
  const g = new Group();
  const r = rng(seed);
  const W = 3.6, H = 3.4, D = 0.42;
  const back = mesh(new PlaneGeometry(W, H), std({ map: cachedTex(`bc${side}`, () => bookcase(seed, side < 0 ? "left" : "right")), roughness: 0.85, color: 0x806a58 }), 0, H / 2, -D / 2 + 0.01);
  g.add(back);
  const wal = mat.walnut(0.6, 0.3);
  const shelfY: number[] = [];
  for (let y = 0.3; y < H - 0.2; y += 0.48) {
    shelfY.push(y);
    g.add(mesh(new BoxGeometry(W, 0.04, D), wal, 0, y, 0));
  }
  for (const x of [-W / 2, -W / 6, W / 6, W / 2]) g.add(mesh(new BoxGeometry(0.06, H, D), wal, x, H / 2, 0));
  g.add(mesh(new BoxGeometry(W + 0.1, 0.12, D + 0.04), wal, 0, H, 0));
  const books: Matrix4[] = [];
  const colors: Color[] = [];
  const m = new Matrix4();
  for (const y of shelfY.slice(0, -1)) {
    let x = -W / 2 + 0.05;
    while (x < W / 2 - 0.08) {
      if (Math.abs(x - -W / 6) < 0.04 || Math.abs(x - W / 6) < 0.04) {
        x += 0.07;
        continue;
      }
      if (r() < 0.06) {
        x += 0.12 + r() * 0.15;
        continue;
      }
      const t = 0.03 + r() * 0.035, h = 0.24 + r() * 0.16, d = 0.24 + r() * 0.08;
      const lean = r() < 0.05 ? 0.25 : 0;
      m.makeRotationZ(-lean).premultiply(new Matrix4().makeTranslation(x + t / 2, y + 0.02 + h / 2, -D / 2 + d / 2 + 0.02));
      m.multiply(new Matrix4().makeScale(t, h, d));
      books.push(m.clone());
      const col = new Color(BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)]!).multiplyScalar(0.7 + r() * 0.6);
      colors.push(col);
      x += t + 0.002 + (lean ? 0.1 : 0);
    }
  }
  const im = new InstancedMesh(new BoxGeometry(1, 1, 1), std({ roughness: 0.75, color: 0xffffff }), books.length);
  books.forEach((b, i) => {
    im.setMatrixAt(i, b);
    im.setColorAt(i, colors[i]!);
  });
  im.instanceMatrix.needsUpdate = true;
  g.add(im);
  // Turned to face the room from its wall.
  g.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
  g.position.set(side * 3.05, 0, -0.1);
  return shade(g, true, true);
}

/** A stack of crates and barrels for an outdoor stall's side. */
export function crateStack(side: -1 | 1, seed: number): Group {
  const g = new Group();
  const r = rng(seed);
  const crateMat = std({ map: cachedTex(`st${side}`, () => stallStack(seed, side < 0 ? "left" : "right"), 0.5, 0.25), roughness: 0.85, color: 0x9a8070 });
  const plank = mat.oak(0.4, 0.4);
  (plank as MeshStandardMaterial).color = new Color(0x8a6a50);
  for (let row = 0; row < 3; row++) {
    for (let k = 0; k < 4; k++) {
      if (r() < 0.2 && row > 0) continue;
      const w = 0.6 + r() * 0.25, h = 0.55 + r() * 0.15;
      const box = mesh(new BoxGeometry(w, h, w), r() < 0.5 ? crateMat : plank, (r() - 0.5) * 0.2, row * 0.62 + h / 2, -1.6 + k * 0.85 + (r() - 0.5) * 0.15);
      box.rotation.y = (r() - 0.5) * 0.3;
      g.add(box);
      // Corner battens.
      for (const dy of [-h / 2 + 0.04, h / 2 - 0.04]) g.add(mesh(new BoxGeometry(w + 0.02, 0.06, w + 0.02), mat.color(0x3a2312, 0.85), box.position.x, box.position.y + dy, box.position.z));
    }
  }
  const barrel = lathe([[0, 0], [0.26, 0], [0.31, 0.2], [0.33, 0.4], [0.31, 0.6], [0.26, 0.8], [0, 0.8]], 24);
  for (let i = 0; i < 2; i++) {
    const b = mesh(barrel, plank, 0.5 * side * -1, 0, 1.2 - i * 0.7);
    g.add(b);
    for (const y of [0.15, 0.65]) {
      const hoop = mesh(new TorusGeometry(0.31, 0.012, 6, 28), mat.iron(), b.position.x, y, b.position.z);
      hoop.rotation.x = Math.PI / 2;
      g.add(hoop);
    }
  }
  g.position.set(side * 3.0, 0, 0);
  return shade(g);
}

/** Corner pillars that frame the back wall indoors. */
export function pillars(): Group {
  const g = new Group();
  for (const sx of [-1, 1]) {
    g.add(mesh(new BoxGeometry(0.34, 3.5, 0.34), mat.walnut(0.2, 1.2), sx * 2.75, 1.75, -1.75));
    g.add(mesh(new BoxGeometry(0.44, 0.16, 0.44), mat.walnut(0.2, 0.1), sx * 2.75, 0.08, -1.75));
  }
  return shade(g);
}

/** The outdoor stall's frame: posts, a timber beam with iron bolts, a tarred canvas valance, nets with floats. */
export function stallFrame(): Group {
  const g = new Group();
  const timber = mat.walnut(0.3, 1.4);
  for (const sx of [-1, 1]) g.add(mesh(new BoxGeometry(0.22, 3.4, 0.22), timber, sx * 2.6, 1.7, -0.25));
  g.add(mesh(new BoxGeometry(5.9, 0.28, 0.3), mat.walnut(3, 0.2), 0, 3.25, -0.25));
  for (let i = 0; i < 9; i++) g.add(mesh(new CylinderGeometry(0.025, 0.025, 0.04, 10).rotateX(Math.PI / 2), mat.iron(), -2.6 + i * 0.65, 3.25, -0.08));
  // Tarred canvas valance with a ragged hem (alpha from a drawn canvas).
  const hem = drawnTex(1024, 128, (gg, w, h) => {
    const gr = gg.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#26221c");
    gr.addColorStop(1, "#14110d");
    gg.fillStyle = gr;
    gg.beginPath();
    gg.moveTo(0, 0);
    gg.lineTo(w, 0);
    const rr = rng(77);
    for (let x = w; x >= 0; x -= 14 + rr() * 26) gg.lineTo(x, h * (0.62 + rr() * 0.3));
    gg.closePath();
    gg.fill();
    gg.strokeStyle = "rgba(0,0,0,.35)";
    gg.lineWidth = 6;
    for (let x = 20; x < w; x += 46) {
      gg.beginPath();
      gg.moveTo(x, 0);
      gg.quadraticCurveTo(x + 10, h * 0.4, x + 4, h * 0.8);
      gg.stroke();
    }
  });
  const val = mesh(new PlaneGeometry(5.9, 0.55), std({ map: hem, transparent: true, alphaTest: 0.4, roughness: 0.6, side: DoubleSide }), 0, 2.86, -0.08);
  g.add(val);
  // Nets swagged under the beam, with cork floats.
  const rope = mat.color(0xa89878, 0.9);
  const cork = mat.color(0xb8874e, 0.8);
  for (let i = 0; i < 4; i++) {
    const xa = -2.5 + i * 1.3, xb = xa + 1.2;
    for (let k = 0; k < 4; k++) {
      const curve = new QuadraticBezierCurve3(new Vector3(xa, 3.05 - k * 0.02, -0.02), new Vector3((xa + xb) / 2, 2.55 - k * 0.07, 0.04), new Vector3(xb, 3.05 - k * 0.02, -0.02));
      g.add(new Mesh(new TubeGeometry(curve, 20, 0.006, 4), rope));
      if (k === 1) for (const t of [0.3, 0.5, 0.7]) {
        const p = curve.getPoint(t);
        g.add(mesh(new SphereGeometry(0.045, 10, 8).scale(1.3, 0.8, 1), cork, p.x, p.y - 0.03, p.z + 0.02));
      }
    }
  }
  return shade(g, true, false);
}

/** A back wall made of the place's painting, lit by the room but never lost in shadow. */
export function paintingWall(w: number, h: number): Mesh {
  const m = new Mesh(new PlaneGeometry(w, h), std({ color: 0xffffff, roughness: 0.92, emissive: 0xffffff, emissiveIntensity: 0.28 }));
  m.receiveShadow = true;
  return m;
}

/** A hanging brass lamp; the light itself is added by the room. */
export function lamp(): Group {
  const g = new Group();
  g.add(mesh(new CylinderGeometry(0.008, 0.008, 0.75, 6), mat.darkBrass(), 0, 0.38, 0));
  const shadeG = lathe([[0.02, 0.0], [0.05, -0.01], [0.14, -0.1], [0.22, -0.2], [0.23, -0.21], [0.2, -0.21], [0.13, -0.12], [0.04, -0.03]], 32);
  const sh = mesh(shadeG, std({ color: 0xc8963e, metalness: 0.85, roughness: 0.3, side: DoubleSide }), 0, 0, 0);
  g.add(sh);
  g.add(mesh(new SphereGeometry(0.06, 16, 12), new MeshBasicMaterial({ color: 0xfff1c8 }), 0, -0.15, 0));
  return g;
}

/* ------------------------------ Props ------------------------------ */

/** The easel: three splayed legs, a ledge, a clamp; the board's face is a painting you can swap. */
export function easel(): { group: Group; board: Mesh; plaque: Mesh; ledgeY: number } {
  const g = new Group();
  const wood = mat.oak(0.08, 0.6);
  (wood as MeshStandardMaterial).color = new Color(0xb08060);
  const leg = (x0: number, z0: number, x1: number, z1: number) => {
    const a = new Vector3(x0, 0, z0), b = new Vector3(x1, 1.62, z1);
    const len = a.distanceTo(b);
    const m = mesh(new BoxGeometry(0.045, len, 0.035), wood);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.lookAt(b);
    m.rotateX(Math.PI / 2);
    return m;
  };
  g.add(leg(-0.36, 0.08, -0.04, 0.02), leg(0.36, 0.08, 0.04, 0.02), leg(0, -0.42, 0, -0.04));
  const ledgeY = 0.42;
  g.add(mesh(new BoxGeometry(0.98, 0.04, 0.12), wood, 0, ledgeY, 0.1));
  g.add(mesh(new BoxGeometry(0.98, 0.06, 0.02), wood, 0, ledgeY + 0.04, 0.16));
  // The board: a frame with depth and a painted face.
  const bw = 0.86, bh = 1.0;
  const frameMat = mat.walnut(0.2, 0.6);
  const by = ledgeY + 0.03 + bh / 2;
  g.add(mesh(new BoxGeometry(bw + 0.16, bh + 0.16, 0.06), frameMat, 0, by, 0.055));
  // A gilt slip inside the frame so the painting stands out from the wall behind it.
  const slip = mat.brass();
  for (const [x, y, ww, hh] of [[0, bh / 2 + 0.012, bw + 0.04, 0.024], [0, -bh / 2 - 0.012, bw + 0.04, 0.024], [-bw / 2 - 0.012, 0, 0.024, bh], [bw / 2 + 0.012, 0, 0.024, bh]] as const) g.add(mesh(new BoxGeometry(ww, hh, 0.012), slip, x, by + y, 0.088));
  const board = mesh(new PlaneGeometry(bw, bh), std({ color: 0xffffff, roughness: 0.85, emissive: 0xffffff, emissiveIntensity: 0.12 }), 0, by, 0.087);
  g.add(board);
  g.add(mesh(new BoxGeometry(0.2, 0.07, 0.07), wood, 0, by + bh / 2 + 0.06, 0.06));
  const plaque = mesh(new PlaneGeometry(0.62, 0.09), std({ color: 0xffffff, roughness: 0.35, metalness: 0.4 }), 0, ledgeY + 0.04, 0.172);
  g.add(plaque);
  return { group: shade(g), board, plaque, ledgeY };
}

/** A postcard (a painted face on a card with a white border). */
export function postcard(): { group: Group; face: Mesh } {
  const g = new Group();
  g.add(mesh(new BoxGeometry(0.2, 0.27, 0.004), mat.paper()));
  const face = mesh(new PlaneGeometry(0.17, 0.2), std({ color: 0xffffff, roughness: 0.8, emissive: 0xffffff, emissiveIntensity: 0.1 }), 0, 0.02, 0.003);
  g.add(face);
  return { group: shade(g, true, false), face };
}

/**
 * The cash register: the body is an extruded side profile (plinth, the
 * sloping key deck, the tall cabinet) so it has real depth, with brass
 * trim, lathed keys on the deck, a crest, a crank, and a drawer that slides
 * out (with coins in it) when there is a shop. The price flags are a canvas.
 */
export function register(): { group: Group; flags: CanvasTexture; drawer: Group; plate: CanvasTexture } {
  const g = new Group();
  const W = 0.78;
  const verd = mat.verdigris();
  const brass = mat.brass();
  const p = new Shape();
  // Side profile in (z, y): front at z = 0.25, back at -0.25.
  p.moveTo(0.25, 0.1);
  p.lineTo(0.25, 0.2);
  p.lineTo(0.06, 0.4);
  p.lineTo(0.06, 0.66);
  p.lineTo(-0.2, 0.7);
  p.lineTo(-0.25, 0.66);
  p.lineTo(-0.25, 0.1);
  p.closePath();
  const body = new ExtrudeGeometry(p, { depth: W, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 });
  body.rotateY(-Math.PI / 2);
  body.translate(W / 2, 0, 0);
  g.add(mesh(body, verd));
  g.add(mesh(new BoxGeometry(W + 0.08, 0.1, 0.56), verd, 0, 0.05, 0));
  g.add(mesh(new BoxGeometry(W + 0.1, 0.02, 0.58), brass, 0, 0.105, 0));
  // Brass edges along the deck and the cabinet.
  g.add(mesh(new BoxGeometry(W + 0.03, 0.02, 0.02), brass, 0, 0.405, 0.06));
  g.add(mesh(new BoxGeometry(W + 0.03, 0.02, 0.02), brass, 0, 0.665, 0.06));
  // Price flags behind glass on the cabinet front.
  const flags = drawnTex(512, 192, () => {});
  g.add(mesh(new BoxGeometry(0.5, 0.17, 0.02), mat.color(0x120a04, 0.4), 0, 0.53, 0.065));
  g.add(mesh(new PlaneGeometry(0.46, 0.15), std({ map: flags, roughness: 0.4, emissive: 0xffffff, emissiveMap: flags, emissiveIntensity: 0.35 }), 0, 0.53, 0.077));
  g.add(mesh(new PlaneGeometry(0.46, 0.15), mat.glass(), 0, 0.53, 0.082));
  for (const [x, y, w, h] of [[0, 0.615, 0.52, 0.02], [0, 0.445, 0.52, 0.02], [-0.25, 0.53, 0.02, 0.19], [0.25, 0.53, 0.02, 0.19]] as const) g.add(mesh(new BoxGeometry(w, h, 0.03), brass, x, y, 0.07));
  // Crest.
  const crest = new Shape();
  crest.moveTo(-0.3, 0);
  crest.quadraticCurveTo(0, 0.22, 0.3, 0);
  crest.lineTo(0.22, 0);
  crest.quadraticCurveTo(0, 0.13, -0.22, 0);
  crest.closePath();
  g.add(mesh(new ExtrudeGeometry(crest, { depth: 0.02, bevelEnabled: false }), brass, 0, 0.69, -0.02));
  g.add(mesh(new SphereGeometry(0.03, 12, 10), brass, 0, 0.84, -0.01));
  // Keys on the sloping deck.
  const keyG = lathe([[0, 0], [0.022, 0], [0.022, 0.01], [0.018, 0.02], [0, 0.022]], 16);
  const ivory = mat.color(0xf2e6c6, 0.4);
  const slope = Math.atan2(0.2, 0.19);
  for (let row = 0; row < 3; row++) {
    for (let k = 0; k < 7; k++) {
      const t = (row + 0.6) / 3.4;
      const key = mesh(keyG, row === 1 ? ivory : brass, -W / 2 + 0.08 + k * 0.104, 0.2 + t * 0.2 + 0.012, 0.25 - t * 0.19);
      key.rotation.x = slope;
      g.add(key);
    }
  }
  // Crank on the right side.
  const crank = new Group();
  crank.add(mesh(new CylinderGeometry(0.012, 0.012, 0.16, 8), brass, 0, 0.08, 0));
  crank.add(mesh(new SphereGeometry(0.03, 12, 10), mat.color(0x6b2a14, 0.4), 0, 0.17, 0));
  crank.position.set(W / 2 + 0.04, 0.35, 0);
  crank.rotation.z = -0.5;
  g.add(crank);
  // The drawer, with coins, and a brass plate on its front.
  const drawer = new Group();
  drawer.add(mesh(new BoxGeometry(W - 0.06, 0.07, 0.4), mat.color(0x2a1a0c, 0.7), 0, 0, -0.2));
  for (let i = 0; i < 10; i++) {
    const coin = mesh(new CylinderGeometry(0.025, 0.025, 0.006, 16), brass, -0.3 + (i % 5) * 0.14 + (i > 4 ? 0.05 : 0), 0.04, -0.08 - Math.floor(i / 5) * 0.1);
    coin.rotation.x = 0.2 * (i % 3);
    drawer.add(coin);
  }
  drawer.add(mesh(new BoxGeometry(W - 0.02, 0.09, 0.025), verd, 0, 0, 0.0));
  const plate = drawnTex(512, 64, () => {});
  drawer.add(mesh(new PlaneGeometry(0.42, 0.055), std({ map: plate, metalness: 0.6, roughness: 0.35 }), 0, 0, 0.014));
  drawer.position.set(0, 0.15, 0.26);
  g.add(drawer);
  return { group: shade(g), flags, drawer, plate };
}

/** A teacup on a saucer on a folded napkin (the napkin is inked with vigor); the tea is a disc you can lower. */
export function teacup(): { group: Group; tea: Mesh; steam: Mesh[]; napkin: CanvasTexture } {
  const g = new Group();
  const napkin = drawnTex(256, 256, () => {});
  const nap = mesh(new PlaneGeometry(0.42, 0.42), std({ map: napkin, roughness: 0.95 }), 0, 0.003, 0.04);
  nap.rotation.x = -Math.PI / 2;
  nap.rotation.z = 0.2;
  g.add(nap);
  const porc = mat.porcelain();
  g.add(mesh(lathe([[0, 0.006], [0.1, 0.006], [0.15, 0.016], [0.16, 0.026], [0.15, 0.024], [0.1, 0.016], [0.04, 0.018], [0, 0.018]]), porc));
  const cup = lathe([[0, 0.02], [0.05, 0.02], [0.055, 0.025], [0.075, 0.06], [0.09, 0.11], [0.098, 0.15], [0.092, 0.15], [0.084, 0.11], [0.07, 0.065], [0.045, 0.04], [0, 0.04]], 40);
  g.add(mesh(cup, porc));
  const band = mesh(new CylinderGeometry(0.0955, 0.093, 0.012, 40, 1, true), mat.brass(), 0, 0.135, 0);
  g.add(band);
  const handle = mesh(new TorusGeometry(0.035, 0.009, 8, 20, Math.PI * 1.3), porc, 0.105, 0.1, 0);
  handle.rotation.z = -Math.PI * 0.65;
  g.add(handle);
  const tea = mesh(new CircleGeometry(0.086, 32), std({ color: 0x8a4a14, roughness: 0.15, emissive: 0x3a1a04 }), 0, 0.135, 0);
  tea.rotation.x = -Math.PI / 2;
  g.add(tea);
  const steam: Mesh[] = [];
  const puff = drawnTex(64, 128, (gg, w, h) => {
    const gr = gg.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    gr.addColorStop(0, "rgba(255,244,220,.5)");
    gr.addColorStop(1, "rgba(255,244,220,0)");
    gg.fillStyle = gr;
    gg.fillRect(0, 0, w, h);
  });
  for (let i = 0; i < 3; i++) {
    const s = mesh(new PlaneGeometry(0.09, 0.2), new MeshBasicMaterial({ map: puff, transparent: true, depthWrite: false, blending: AdditiveBlending }), (i - 1) * 0.03, 0.26, 0);
    steam.push(s);
    g.add(s);
  }
  return { group: shade(g, true, true), tea, steam, napkin };
}

/** An hourglass: turned caps and spindles, a glass waist, sand cones you can resize; WAIT carved on the base. */
export function hourglass(): { group: Group; top: Mesh; bottom: Mesh; base: CanvasTexture } {
  const g = new Group();
  const wood = mat.walnut(0.3, 0.3);
  const base = drawnTex(512, 64, () => {});
  const cap = (y: number, label: boolean) => {
    const c = mesh(new CylinderGeometry(0.11, 0.115, 0.035, 32), label ? [std({ map: base, roughness: 0.6 }), wood, wood] : wood, 0, y, 0);
    return c;
  };
  g.add(cap(0.018, true), cap(0.37, false));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    g.add(mesh(lathe([[0.008, 0], [0.012, 0.05], [0.007, 0.1], [0.013, 0.17], [0.007, 0.24], [0.012, 0.3], [0.008, 0.335]], 10), wood, Math.cos(a) * 0.09, 0.035, Math.sin(a) * 0.09));
  }
  const glassG = lathe([[0.004, 0.04], [0.07, 0.05], [0.075, 0.1], [0.04, 0.17], [0.008, 0.195], [0.04, 0.22], [0.075, 0.29], [0.07, 0.345], [0.004, 0.35]], 32);
  g.add(mesh(glassG, mat.glass()));
  const sand = mat.color(0xe0b060, 0.9);
  const top = mesh(lathe([[0, 0], [0.06, 0], [0.008, -0.06], [0, -0.065]], 24), sand, 0, 0.29, 0);
  const bottom = mesh(lathe([[0, 0], [0.068, 0], [0.002, 0.07], [0, 0.07]], 24), sand, 0, 0.04, 0);
  g.add(top, bottom);
  return { group: shade(g, true, true), top, bottom, base };
}

/** A dagger driven into the counter through a bounty note (the note is a canvas you write the fight on). */
export function dagger(): { group: Group; note: CanvasTexture } {
  const g = new Group();
  const note = drawnTex(512, 384, () => {});
  const n = mesh(new PlaneGeometry(0.36, 0.27), std({ map: note, roughness: 0.95 }), 0, 0.003, 0);
  n.rotation.x = -Math.PI / 2;
  n.rotation.z = -0.15;
  g.add(n);
  const d = new Group();
  const blade = new Shape();
  blade.moveTo(-0.018, 0);
  blade.lineTo(0.018, 0);
  blade.lineTo(0.004, -0.24);
  blade.lineTo(-0.004, -0.24);
  blade.closePath();
  d.add(mesh(new ExtrudeGeometry(blade, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.003, bevelSegments: 1 }), std({ color: 0xc8ced4, metalness: 0.95, roughness: 0.18 }), 0, 0, -0.003));
  d.add(mesh(new BoxGeometry(0.13, 0.018, 0.026), mat.brass(), 0, 0.009, 0));
  for (const sx of [-1, 1]) d.add(mesh(new SphereGeometry(0.016, 10, 8), mat.brass(), sx * 0.068, 0.009, 0));
  d.add(mesh(new CylinderGeometry(0.014, 0.016, 0.11, 10), mat.color(0x3a1d10, 0.7), 0, 0.075, 0));
  d.add(mesh(new SphereGeometry(0.022, 12, 10), mat.brass(), 0, 0.14, 0));
  d.position.set(0.02, 0.17, 0.0);
  d.rotation.z = 0.5;
  d.rotation.x = -0.25;
  g.add(d);
  return { group: shade(g), note };
}

/** A brass lantern with a candle; the flame is a light-emitting sprite the room flickers. */
export function lanternModel(): { group: Group; flame: Mesh } {
  const g = new Group();
  const brass = mat.brass();
  g.add(mesh(new CylinderGeometry(0.1, 0.11, 0.03, 4).rotateY(Math.PI / 4), brass, 0, 0.015, 0));
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) g.add(mesh(new BoxGeometry(0.012, 0.25, 0.012), brass, x * 0.065, 0.155, z * 0.065));
  g.add(mesh(new BoxGeometry(0.13, 0.24, 0.13), mat.glass(), 0, 0.155, 0));
  g.add(mesh(new CylinderGeometry(0.02, 0.1, 0.09, 4).rotateY(Math.PI / 4), brass, 0, 0.32, 0));
  const ring = mesh(new TorusGeometry(0.035, 0.006, 6, 16), brass, 0, 0.39, 0);
  g.add(ring);
  g.add(mesh(new CylinderGeometry(0.018, 0.018, 0.07, 12), mat.color(0xf2e6c6, 0.5), 0, 0.065, 0));
  const flame = mesh(new SphereGeometry(0.018, 10, 8).scale(1, 1.9, 1), new MeshBasicMaterial({ color: 0xffd36a }), 0, 0.12, 0);
  g.add(flame);
  return { group: shade(g, true, false), flame };
}

/** A book lying flat, spine toward you, the title stamped in gold on the spine. */
export function bookModel(color: number, title: string): Group {
  const g = new Group();
  const W = 0.44, H = 0.07, D = 0.3;
  const spine = drawnTex(512, 96, (gg, w, h) => {
    const base = new Color(color);
    gg.fillStyle = `#${base.getHexString()}`;
    gg.fillRect(0, 0, w, h);
    const gr = gg.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "rgba(255,255,255,.18)");
    gr.addColorStop(0.5, "rgba(0,0,0,0)");
    gr.addColorStop(1, "rgba(0,0,0,.45)");
    gg.fillStyle = gr;
    gg.fillRect(0, 0, w, h);
    gg.fillStyle = "#e6c06a";
    for (const x of [30, 46, w - 46, w - 30]) gg.fillRect(x, 0, 5, h);
    gg.font = "800 52px 'Gambit Cinzel', Georgia, serif";
    gg.textAlign = "center";
    gg.textBaseline = "middle";
    gg.fillStyle = "#f0cf7a";
    gg.fillText(title.toUpperCase(), w / 2, h / 2 + 3);
  });
  const cover = std({ color, roughness: 0.6, bumpMap: cachedTex("paperM", () => paper(41, 256, 256)), bumpScale: 2 });
  const pages = mat.color(0xe8dab8, 0.9);
  const spineMat = std({ map: spine, roughness: 0.55 });
  // Box faces: +x, -x, +y, -y, +z (spine, toward you), -z.
  g.add(mesh(new BoxGeometry(W, H, D), [pages, pages, cover, cover, spineMat, pages]));
  g.add(mesh(new BoxGeometry(W + 0.012, 0.012, D + 0.01), cover, 0, H / 2, 0));
  g.add(mesh(new BoxGeometry(W + 0.012, 0.012, D + 0.01), cover, 0, -H / 2, 0));
  // A ribbon bookmark.
  g.add(mesh(new BoxGeometry(0.025, 0.002, 0.12), mat.color(0xb02e22, 0.6), 0.12, -H / 2 + 0.02, D / 2 + 0.05));
  return shade(g);
}

/** A globe on a turned stand with a brass meridian. */
export function globe(): { group: Group; sphere: Mesh } {
  const g = new Group();
  const map = drawnTex(512, 256, (gg, w, h) => {
    gg.fillStyle = "#3f6e6a";
    gg.fillRect(0, 0, w, h);
    const r = rng(9);
    gg.fillStyle = "#b89b5e";
    for (let i = 0; i < 9; i++) {
      gg.beginPath();
      const cx = r() * w, cy = h * (0.2 + r() * 0.6);
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const rr = 20 + r() * 40;
        gg.lineTo(cx + Math.cos(a) * rr * 1.4, cy + Math.sin(a) * rr);
      }
      gg.fill();
    }
    gg.strokeStyle = "rgba(240,224,180,.35)";
    for (let y = 32; y < h; y += 32) {
      gg.beginPath();
      gg.moveTo(0, y);
      gg.lineTo(w, y);
      gg.stroke();
    }
  });
  const sphere = mesh(new SphereGeometry(0.12, 32, 20), std({ map, roughness: 0.35, metalness: 0.05 }), 0, 0.3, 0);
  sphere.rotation.z = 0.4;
  g.add(sphere);
  const mer = mesh(new TorusGeometry(0.135, 0.008, 6, 40, Math.PI * 1.2), mat.brass(), 0, 0.3, 0);
  mer.rotation.z = -Math.PI * 0.1 + 0.4;
  g.add(mer);
  g.add(mesh(lathe([[0, 0], [0.1, 0], [0.1, 0.025], [0.05, 0.04], [0.02, 0.08], [0.015, 0.16], [0, 0.16]], 24), mat.walnut(0.3, 0.3)));
  return { group: shade(g), sphere };
}

/** A pendulum wall clock; its face is a canvas with the hands and a sun/moon window. */
export function clockModel(): { group: Group; face: CanvasTexture; pendulum: Group } {
  const g = new Group();
  const case_ = mat.walnut(0.3, 0.6);
  g.add(mesh(new BoxGeometry(0.4, 0.46, 0.1), case_, 0, 0, 0));
  const crown = new Shape();
  crown.moveTo(-0.22, 0);
  crown.quadraticCurveTo(0, 0.18, 0.22, 0);
  crown.closePath();
  g.add(mesh(new ExtrudeGeometry(crown, { depth: 0.1, bevelEnabled: false }), case_, 0, 0.23, -0.05));
  g.add(mesh(new BoxGeometry(0.3, 0.5, 0.08), case_, 0, -0.48, 0));
  const face = drawnTex(512, 512, () => {});
  g.add(mesh(new CircleGeometry(0.16, 40), std({ map: face, roughness: 0.4, emissive: 0xffffff, emissiveMap: face, emissiveIntensity: 0.25 }), 0, 0.01, 0.051));
  const bezel = mesh(new TorusGeometry(0.165, 0.012, 8, 40), mat.brass(), 0, 0.01, 0.05);
  g.add(bezel);
  const pendulum = new Group();
  pendulum.add(mesh(new BoxGeometry(0.01, 0.3, 0.01), mat.brass(), 0, -0.15, 0));
  pendulum.add(mesh(new CylinderGeometry(0.05, 0.05, 0.012, 24).rotateX(Math.PI / 2), mat.brass(), 0, -0.31, 0));
  pendulum.position.set(0, -0.25, 0.045);
  g.add(pendulum);
  g.add(mesh(new PlaneGeometry(0.24, 0.42), mat.glass(), 0, -0.48, 0.042));
  return { group: shade(g, true, false), face, pendulum };
}

/** The quest-thread rack: a beam with pegs; spools are added by the room (red thread when found). */
export function spoolRack(n: number, found: number): Group {
  const g = new Group();
  const len = 0.2 + n * 0.17;
  g.add(mesh(new BoxGeometry(len, 0.06, 0.08), mat.walnut(0.4, 0.1), 0, 0, 0));
  const flange = mat.oak(0.2, 0.2);
  const bare = mat.color(0xc7a77a, 0.7);
  const thread = std({ color: 0xc0281e, roughness: 0.55, emissive: 0x3a0402 });
  for (let i = 0; i < n; i++) {
    const s = new Group();
    const on = i < found;
    s.add(mesh(new CylinderGeometry(0.004, 0.004, 0.06, 6), mat.brass(), 0, 0.03, 0));
    s.add(mesh(new CylinderGeometry(0.055, 0.055, 0.016, 20), flange, 0, -0.008, 0));
    s.add(mesh(new CylinderGeometry(on ? 0.047 : 0.024, on ? 0.047 : 0.024, 0.1, 20), on ? thread : bare, 0, -0.066, 0));
    s.add(mesh(new CylinderGeometry(0.055, 0.055, 0.016, 20), flange, 0, -0.124, 0));
    if (on) s.add(new Mesh(new TubeGeometry(new QuadraticBezierCurve3(new Vector3(0.045, -0.1, 0.01), new Vector3(0.06, -0.2, 0.03), new Vector3(0.04, -0.3, 0.01)), 10, 0.003, 4), thread));
    s.position.set(-len / 2 + 0.1 + i * 0.17, -0.06, 0.02);
    g.add(s);
  }
  return shade(g, true, false);
}

/** A glass jar (supplies), full or empty. */
export function jarModel(full: boolean): Group {
  const g = new Group();
  g.add(mesh(lathe([[0, 0], [0.04, 0], [0.045, 0.02], [0.045, 0.1], [0.03, 0.12], [0.03, 0.13], [0, 0.13]], 20), mat.glass()));
  if (full) g.add(mesh(new CylinderGeometry(0.04, 0.04, 0.08, 20), mat.color(0xc78a3a, 0.6), 0, 0.045, 0));
  g.add(mesh(new CylinderGeometry(0.034, 0.034, 0.025, 20), mat.walnut(0.1, 0.1), 0, 0.14, 0));
  return shade(g, true, false);
}

/** A sealed letter lying on the counter (any action without a prop of its own). */
export function letterModel(): Group {
  const g = new Group();
  const l = mesh(new BoxGeometry(0.24, 0.006, 0.16), mat.paper(), 0, 0.003, 0);
  l.rotation.y = 0.2;
  g.add(l);
  g.add(mesh(new CylinderGeometry(0.025, 0.025, 0.008, 16), mat.color(0x8e1c14, 0.4), 0, 0.009, 0));
  return shade(g, true, true);
}

/** A soft yellow ring under a usable prop (the reference's selection outline); it brightens on hover. */
export function glowRing(r: number): Mesh {
  const t = cachedTex("ring", () => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const gr = g.createRadialGradient(64, 64, 30, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,220,80,0)");
    gr.addColorStop(0.72, "rgba(255,220,80,.9)");
    gr.addColorStop(0.8, "rgba(255,200,60,.5)");
    gr.addColorStop(1, "rgba(255,200,60,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    return c;
  });
  const m = new Mesh(new PlaneGeometry(r * 2, r * 2), new MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0.35 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.004;
  m.renderOrder = 2;
  return m;
}

/**
 * A framed standee for opaque art: a carved mahogany frame with a gilt slip,
 * the portrait inside, on a turned post with feet, so it stands behind the
 * counter at the same depth as the others.
 */
export function standee(aspect: number): { group: Group; face: Mesh } {
  const g = new Group();
  const h = 1.0, w = h * aspect, b = 0.1;
  // A dark timber alcove frame, not a gilt picture frame: the portrait reads as a window into the back of the shop.
  const maho = std({ color: 0x3a2214, roughness: 0.6, map: cachedTex("walnut", walnut, 0.3, 0.3) });
  const gilt = std({ color: 0x140a04, roughness: 0.8 });
  const bar = (x: number, y: number, ww: number, hh: number, m: Material, d = 0.06): void => {
    g.add(mesh(new BoxGeometry(ww, hh, d), m, x, y, 0));
  };
  bar(0, h / 2 + b / 2, w + 2 * b, b, maho);
  bar(0, -h / 2 - b / 2, w + 2 * b, b, maho);
  bar(-w / 2 - b / 2, 0, b, h, maho);
  bar(w / 2 + b / 2, 0, b, h, maho);
  bar(0, h / 2 + 0.008, w + 0.016, 0.016, gilt, 0.07);
  bar(0, -h / 2 - 0.008, w + 0.016, 0.016, gilt, 0.07);
  bar(-w / 2 - 0.008, 0, 0.016, h, gilt, 0.07);
  bar(w / 2 + 0.008, 0, 0.016, h, gilt, 0.07);
  const crest = new Shape();
  crest.moveTo(-0.16, 0);
  crest.quadraticCurveTo(0, 0.14, 0.16, 0);
  crest.closePath();
  g.add(mesh(new ExtrudeGeometry(crest, { depth: 0.06, bevelEnabled: false }), maho, 0, h / 2 + b - 0.01, -0.03));
  const face = mesh(new PlaneGeometry(w, h), std({ color: 0xffffff, roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0.18 }), 0, 0, 0.005);
  g.add(face);
  g.add(mesh(new CylinderGeometry(0.03, 0.04, 0.9, 12), maho, 0, -h / 2 - 0.45, -0.03));
  return { group: shade(g, true, true), face };
}
