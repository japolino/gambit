/**
 * The Table theme's 3D stage: a real walnut table modelled in three.js, lit
 * by a skull candle (the shadow-casting light that flickers) and a low lamp
 * over the mat, with the people standing across from you as lit cut-out
 * planes, the hanging slate scoreboard, and the props you can pick up:
 * ledger (journal), deck case (classes), gavel (theme), bell (wait), coins
 * (shop), skull candle (rest). Everything is modelled in code from lathes,
 * spheres, boxes and extrusions, textured with the theme's own procedural
 * canvases, and edged with an inverted-hull ink line so it shares the cards'
 * comic-woodcut look.
 *
 * The theme's DOM stays on top for text and controls; this class owns the
 * scene graph, camera, lights, picking, hover glow and the zoom-in glide.
 */
import {
  AmbientLight,
  BackSide,
  Box3,
  BoxGeometry,
  BufferAttribute,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Fog,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshDepthMaterial,
  MeshDistanceMaterial,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PlaneGeometry,
  PMREMGenerator,
  PointLight,
  RepeatWrapping,
  RGBADepthPacking,
  Scene,
  ShaderMaterial,
  Shape,
  SphereGeometry,
  SpotLight,
  SRGBColorSpace,
  ACESFilmicToneMapping,
  TorusGeometry,
  AdditiveBlending,
  Vector2,
  Vector3,
  type Material,
  type Object3D,
  type Texture,
  type WebGLRenderTarget,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { rng, type Stage3D } from "../contract.js";
import { leatherUrl, matCanvas, paperUrl, slateUrl, tabletop } from "./tex.js";
import { createPuppetMeshes, type PuppetMeshes } from "../../puppet-mesh.js";
import { duel, duelCamera } from "./duel.js";

/** What the 3D board shows; drawn in chalk on its slate. */
export interface Board3D {
  where: string;
  isNew: boolean;
  day: number;
  time: string;
  vigor: number;
  thread?: { found: number; total: number };
  supplies?: { now: number; max: number };
  /** In a delve: the automap, chalked onto the slate (with a key that changes when it does). */
  map?: { canvas: HTMLCanvasElement; key: string };
}

/** What a delve shows ahead: the next cells, nearest (where you sit) first, with their sides. */
export interface Corridor3D {
  view: { ahead: string; left: string; right: string }[];
  wall: string | null;
  floor: string | null;
}

export interface Person3D {
  id: string;
  name: string;
  /** Prepared art: a cut-out, an opaque picture, or null while it is being prepared. */
  art: { url: string; cutout: boolean } | null;
  talkable: boolean;
}

/** Things in the room you can point at. */
export type PickId = `person:${string}` | "ledger" | "deck" | "gavel" | "bell" | "skull" | "coins" | "board";

const INK = 0x0a0707;
const TAU = Math.PI * 2;

/** An inverted-hull outline: the comic ink line around a smooth mesh. */
function inkMaterial(w: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { w: { value: w } },
    vertexShader: `uniform float w; void main(){ vec3 p = position + normal * w; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `void main(){ gl_FragColor = vec4(0.035, 0.024, 0.02, 1.0); }`,
    side: BackSide,
  });
}

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = () => rej(new Error(url));
    i.src = url;
  });

const canvas = (w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!];
};

/** Chalk text on its own layer, eroded by speckle so it reads as dry chalk on slate. */
function chalk(g: CanvasRenderingContext2D, draw: (l: CanvasRenderingContext2D) => void, seed: number): void {
  const [c, l] = canvas(g.canvas.width, g.canvas.height);
  l.fillStyle = "#f2efe9";
  l.strokeStyle = "#f2efe9";
  l.textBaseline = "alphabetic";
  draw(l);
  // A second, slightly offset pass thickens strokes unevenly.
  l.globalAlpha = 0.45;
  l.translate(1.5, 1);
  draw(l);
  l.setTransform(1, 0, 0, 1, 0, 0);
  l.globalAlpha = 1;
  l.globalCompositeOperation = "destination-out";
  const r = rng(seed);
  for (let i = 0; i < 9000; i++) {
    l.fillStyle = `rgba(0,0,0,${0.3 + r() * 0.7})`;
    l.fillRect(r() * c.width, r() * c.height, 1 + r() * 2.2, 0.8 + r() * 1.2);
  }
  g.drawImage(c, 0, 0);
}

export class Table3D {
  private root: Group;
  private gen: number;
  private textures: Texture[] = [];
  private env: WebGLRenderTarget | null = null;
  private pickables = new Map<PickId, Group>();
  private candle!: PointLight;
  private lamp!: SpotLight;
  private flames: Mesh[] = [];
  private tops = new Map<PickId, Vector3>();
  private boardTex!: CanvasTexture;
  private boardKey = "";
  private boardCanvas!: HTMLCanvasElement;
  private vigorLiquid!: Mesh;
  private slips = new Group();
  private coinGroup = new Group();
  private coinKey = "";
  private people = new Group();
  private peopleKey = "";
  private backdropMesh: Mesh | null = null;
  private corridor = new Group();
  private corridorKey = "";
  private coinUnit = "";
  private backdropUrl = "";
  private personTex = new Map<string, Promise<CanvasTexture | null>>();
  /** People who are cut-outs breathe and sway through Cue's rig (made on first use: `reduced` is set in the constructor). */
  private puppetMeshes: PuppetMeshes | null = null;
  private get puppets(): PuppetMeshes {
    return (this.puppetMeshes ??= createPuppetMeshes(this.reduced));
  }
  private hover: PickId | null = null;
  private ring = 0;
  private busy = false;
  /** Camera: the seated pose, and an optional zoom target. */
  private base = { eye: new Vector3(0, 0.34, 1.05), look: new Vector3(0, 0, -1), fov: 50 };
  private cam = { eye: new Vector3(0, 0.34, 1.05), look: new Vector3(0, 0, -1) };
  private zoom: { id: PickId; eye: Vector3; look: Vector3; since: number; done: (() => void) | null } | null = null;
  private spread = 1;
  private port = false;
  private t = 0;
  private disposed = false;
  /** A fight or a talk staged at the table (duel.ts): fixed camera, nobody else seated, the slate given over to the fight. */
  private enc: "battle" | "parley" | null = null;
  private slateSeen = -1;
  private ringSeen = duel.ring;
  private flareSeen = duel.flare;
  private flareK = 0;
  onReady: (() => void) | null = null;

  constructor(private st: Stage3D, private reduced: boolean) {
    this.root = st.root;
    this.gen = st.generation;
    this.build();
  }

  /** The layer recreated its root (after a delve): we must rebuild. */
  stale(st: Stage3D): boolean {
    return st.generation !== this.gen;
  }

  private tex(c: HTMLCanvasElement, srgb = true, repeat?: [number, number]): CanvasTexture {
    const t = new CanvasTexture(c);
    if (srgb) t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    if (repeat) {
      t.wrapS = t.wrapT = RepeatWrapping;
      t.repeat.set(repeat[0], repeat[1]);
    }
    this.textures.push(t);
    return t;
  }

  private imgTex(url: string, srgb = true): CanvasTexture {
    // Data URLs from tex.ts: decode through an <img> into a canvas texture.
    const [c, g] = canvas(4, 4);
    const t = this.tex(c, srgb);
    void loadImage(url).then((img) => {
      c.width = img.width;
      c.height = img.height;
      g.drawImage(img, 0, 0);
      t.needsUpdate = true;
    });
    return t;
  }

  /** Add an ink outline (shares the geometry) and shadow flags to a mesh. */
  private inked(m: Mesh, w = 0.004, cast = true): Mesh {
    m.castShadow = cast;
    m.receiveShadow = true;
    const o = new Mesh(m.geometry, inkMaterial(w));
    o.raycast = () => {};
    m.add(o);
    return m;
  }

  /* ------------------------------- Build ------------------------------- */

  private build(): void {
    const { renderer, scene } = this.st;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    scene.background = new Color(0x040205);
    scene.fog = new Fog(0x050306, 2.6, 7.5);
    // A dim warm room for metal and glass to reflect.
    const envScene = new Scene();
    envScene.add(new Mesh(new BoxGeometry(10, 10, 10), new MeshBasicMaterial({ color: new Color(0.03, 0.02, 0.02), side: BackSide })));
    const warm = new Mesh(new PlaneGeometry(4, 2), new MeshBasicMaterial({ color: new Color(3, 1.6, 0.6), side: DoubleSide }));
    warm.position.set(-2, 3, 2);
    warm.lookAt(0, 0, 0);
    envScene.add(warm);
    const cool = new Mesh(new PlaneGeometry(6, 1), new MeshBasicMaterial({ color: new Color(0.3, 0.25, 0.4), side: DoubleSide }));
    cool.position.set(3, 2, -3);
    cool.lookAt(0, 0, 0);
    envScene.add(cool);
    const pm = new PMREMGenerator(renderer);
    this.env = pm.fromScene(envScene, 0.04);
    pm.dispose();
    envScene.traverse((o) => {
      const m = o as Mesh;
      m.geometry?.dispose();
      (m.material as Material | undefined)?.dispose?.();
    });
    scene.environment = this.env.texture;
    (scene as Scene & { environmentIntensity: number }).environmentIntensity = 0.45;

    this.lights();
    this.table();
    this.skull();
    this.ledger();
    this.deck();
    this.bell();
    this.gavel();
    this.board();
    this.root.add(this.coinGroup, this.people, this.corridor);
  }

  private lights(): void {
    this.root.add(new AmbientLight(0x2a1c2a, 0.55));
    // The candle on the skull: the light that throws the props' shadows.
    const c = new PointLight(0xff8a30, 2.4, 5.5, 1.6);
    c.castShadow = true;
    c.shadow.mapSize.set(512, 512);
    c.shadow.bias = -0.004;
    c.shadow.radius = 4;
    c.shadow.camera.near = 0.02;
    this.candle = c;
    this.root.add(c);
    // A low lamp over the mat, out of frame: shadows of people and props fall toward you.
    const lamp = new SpotLight(0xffb070, 9, 6, 0.75, 0.7, 1.4);
    lamp.position.set(0.2, 1.75, -0.35);
    lamp.target.position.set(0, 0, -0.9);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(1024, 1024);
    lamp.shadow.bias = -0.0015;
    lamp.shadow.radius = 3;
    this.lamp = lamp;
    this.root.add(lamp, lamp.target);
    // A warm key from your side, so faces across the table read; and a cold rim behind them.
    const key = new PointLight(0xffa868, 1.6, 4, 1.5);
    key.position.set(-0.4, 0.75, 0.35);
    this.root.add(key);
    const rim = new PointLight(0x6a78c8, 2.2, 4, 1.6);
    rim.position.set(0.9, 1.4, -2.3);
    this.root.add(rim);
    const boardLamp = new PointLight(0xffc080, 0.9, 2.2, 1.5);
    boardLamp.position.set(1.15, 1.25, -1.35);
    boardLamp.userData.board = true;
    this.root.add(boardLamp);
  }

  private table(): void {
    const woodC = tabletop(false);
    const wood = this.tex(woodC, true, [3, 1]);
    const bump = this.tex(woodC, false, [3, 1]);
    const top = new Mesh(
      new BoxGeometry(8, 0.07, 2.4),
      new MeshStandardMaterial({ map: wood, bumpMap: bump, bumpScale: 2.2, roughness: 0.62, metalness: 0, color: 0xb08a70 }),
    );
    top.position.set(0, -0.035, 0.1);
    top.receiveShadow = true;
    this.root.add(top);
    // The far edge: a rounded lip that catches the light.
    const lip = new Mesh(new CylinderGeometry(0.038, 0.038, 8, 16), new MeshStandardMaterial({ map: wood, color: 0x9a6a4a, roughness: 0.45 }));
    lip.rotation.z = Math.PI / 2;
    lip.position.set(0, -0.012, -1.1);
    lip.receiveShadow = true;
    this.root.add(lip);
    // The cloth mat, a few millimetres proud of the wood.
    const matT = this.tex(matCanvas());
    const mat = new Mesh(new BoxGeometry(1.5, 0.008, 0.96), [
      new MeshStandardMaterial({ color: 0x0d0a10, roughness: 1 }),
      new MeshStandardMaterial({ color: 0x0d0a10, roughness: 1 }),
      new MeshStandardMaterial({ map: matT, roughness: 0.95, color: 0xd8d0e0 }),
      new MeshStandardMaterial({ color: 0x0d0a10 }),
      new MeshStandardMaterial({ color: 0x0d0a10, roughness: 1 }),
      new MeshStandardMaterial({ color: 0x0d0a10, roughness: 1 }),
    ]);
    mat.position.set(0, 0.004, -0.52);
    mat.receiveShadow = true;
    this.root.add(mat);
  }

  /** Bone with candle wax: cranium, cheekbones, sockets, teeth, two candles with drips and live flames. */
  private skull(): void {
    const g = new Group();
    g.name = "skull";
    const [bc, bg] = canvas(256, 256);
    const r = rng(31);
    bg.fillStyle = "#cdb893";
    bg.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      bg.fillStyle = `rgba(${r() < 0.5 ? "90,60,30" : "255,240,210"},${r() * 0.12})`;
      bg.fillRect(r() * 256, r() * 256, 2 + r() * 4, 1 + r() * 3);
    }
    // One hairline suture across the crown, not a carved pumpkin.
    bg.strokeStyle = "rgba(40,22,10,.45)";
    bg.lineWidth = 1;
    bg.beginPath();
    bg.moveTo(0, 40);
    for (let x = 0; x <= 256; x += 8) bg.lineTo(x, 40 + Math.sin(x * 0.4) * 3 + (r() - 0.5) * 3);
    bg.stroke();
    const bone = new MeshStandardMaterial({ map: this.tex(bc), roughness: 0.88, color: 0xa08a70, vertexColors: true });
    const head = new Group();
    head.position.y = 0.112;
    g.add(head);
    const cr = new Mesh(this.skullGeometry(), bone);
    head.add(this.inked(cr, 0.004));
    // Teeth: an upper row under the maxilla, a lower row on the jaw.
    const toothM = new MeshStandardMaterial({ color: 0xb8a482, roughness: 0.55 });
    for (const [y, rr] of [[-0.071, 0.046], [-0.086, 0.044]] as const)
      for (let i = 0; i < 10; i++) {
        const an = (i - 4.5) * 0.17;
        const tth = new Mesh(new BoxGeometry(0.0095, 0.016, 0.007), toothM);
        tth.position.set(Math.sin(an) * rr, y, 0.052 + Math.cos(an) * rr);
        tth.rotation.y = an;
        tth.castShadow = true;
        head.add(tth);
      }
    // The jaw: a bone arc opening backward.
    const jawM = new MeshStandardMaterial({ map: bone.map, roughness: 0.88, color: 0x8a765e });
    const jaw = new Mesh(new TorusGeometry(0.05, 0.013, 10, 28, Math.PI), jawM);
    jaw.rotation.x = Math.PI / 2;
    jaw.scale.set(1, 1.25, 1);
    jaw.position.set(0, -0.098, 0.045);
    head.add(this.inked(jaw, 0.003));
    // Wax: two candles, drips, a pool on the wood.
    const wax = new MeshStandardMaterial({ color: 0xcdb894, roughness: 0.55, emissive: new Color(0x5a2a08), emissiveIntensity: 0.12 });
    const candles: [number, number, number, number][] = [
      [-0.03, 0.2, -0.01, 0.11],
      [0.038, 0.195, 0.01, 0.075],
    ];
    for (const [x, y, z, h] of candles) {
      const pts = [new Vector2(0, 0), new Vector2(0.021, 0), new Vector2(0.019, h * 0.4), new Vector2(0.021, h * 0.75), new Vector2(0.018, h), new Vector2(0.012, h + 0.004), new Vector2(0, h + 0.002)];
      const cm = new Mesh(new LatheGeometry(pts, 20), wax);
      cm.position.set(x, y, z);
      g.add(this.inked(cm, 0.003));
      const wick = new Mesh(new CylinderGeometry(0.0015, 0.0015, 0.012, 4), new MeshBasicMaterial({ color: 0x111111 }));
      wick.position.set(x, y + h + 0.008, z);
      g.add(wick);
      const fl = this.flame();
      fl.position.set(x, y + h + 0.032, z);
      fl.userData.base = fl.position.y;
      this.flames.push(fl);
      g.add(fl);
      for (let k = 0; k < 3; k++) {
        const drip = new Mesh(new SphereGeometry(0.007, 10, 8), wax);
        drip.scale.set(1, 3 + k, 1);
        drip.position.set(x + (k - 1) * 0.012, y - 0.01 - k * 0.012, z + 0.018 + k * 0.004);
        g.add(drip);
      }
    }
    const pool = new Mesh(new CylinderGeometry(0.105, 0.115, 0.005, 28), new MeshStandardMaterial({ color: 0x8a7860, roughness: 0.4 }));
    pool.position.y = 0.003;
    pool.receiveShadow = true;
    g.add(pool);
    g.scale.setScalar(1.2);
    this.root.add(g);
    this.pickables.set("skull", g);
  }

  /**
   * A skull sculpted from one sphere: a long cranium with flattened temples,
   * a narrower jutting maxilla, a flat base, cheekbones, and deep eye and
   * nose cavities darkened through vertex colours (ambient occlusion).
   */
  private skullGeometry(): SphereGeometry {
    const geo = new SphereGeometry(0.1, 72, 54);
    const pos = geo.attributes.position!;
    const col = new Float32Array(pos.count * 3);
    const d = new Vector3();
    const n = (x: number, y: number, z: number) => new Vector3(x, y, z).normalize();
    const sockets = [n(-0.42, -0.02, 0.9), n(0.42, -0.02, 0.9)];
    const nose = n(0, -0.38, 0.93);
    const cheeks = [n(-0.62, -0.3, 0.72), n(0.62, -0.3, 0.72)];
    const temples = [n(-1, 0.05, 0.1), n(1, 0.05, 0.1)];
    const brows = [n(-0.4, 0.34, 0.85), n(0.4, 0.34, 0.85)];
    const near = (c: Vector3, ang: number) => {
      const a = Math.acos(Math.max(-1, Math.min(1, d.dot(c))));
      return a < ang ? 1 - (a / ang) ** 2 : 0;
    };
    for (let i = 0; i < pos.count; i++) {
      d.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
      let r = 0.1;
      let dark = 0;
      for (const c of sockets) {
        const k = near(c, 0.42);
        r -= 0.062 * k;
        dark = Math.max(dark, Math.min(1, k * 1.6));
      }
      const kn = near(nose, 0.19);
      r -= 0.035 * kn;
      dark = Math.max(dark, Math.min(1, kn * 2));
      for (const c of cheeks) r += 0.012 * near(c, 0.35);
      for (const c of temples) r -= 0.012 * near(c, 0.6);
      for (const c of brows) r += 0.009 * near(c, 0.32);
      let x = d.x * r * 0.88;
      let y = d.y * r;
      let z = d.z * r * 1.14;
      // The maxilla narrows and juts below the eyes.
      if (d.y < 0 && d.z > -0.2) {
        const k = Math.min(1, -d.y * 1.6) * Math.max(0, d.z + 0.2);
        x *= 1 - 0.34 * k;
        z += 0.01 * k;
      }
      if (y < -0.068) y = -0.068 + (y + 0.068) * 0.3;
      pos.setXYZ(i, x, y, z);
      // Bone, darkening into the cavities and under the skull.
      const under = d.y < -0.3 ? 0.65 : 1;
      const b = (1 - dark * 0.94) * under;
      col[i * 3] = b + dark * 0.12;
      col[i * 3 + 1] = b + dark * 0.03;
      col[i * 3 + 2] = b;
    }
    geo.setAttribute("color", new BufferAttribute(col, 3));
    geo.computeVertexNormals();
    return geo;
  }

  /** A candle flame: a camera-facing teardrop of additive light. */
  private flame(): Mesh {
    const [c, g] = canvas(64, 128);
    const gr = g.createRadialGradient(32, 92, 2, 32, 80, 60);
    gr.addColorStop(0, "rgba(255,255,230,1)");
    gr.addColorStop(0.25, "rgba(255,210,110,.95)");
    gr.addColorStop(0.55, "rgba(255,120,30,.55)");
    gr.addColorStop(1, "rgba(255,60,0,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(32, 4);
    g.bezierCurveTo(54, 54, 56, 118, 32, 122);
    g.bezierCurveTo(8, 118, 10, 54, 32, 4);
    g.fill();
    const m = new Mesh(new PlaneGeometry(0.032, 0.064), new MeshBasicMaterial({ map: this.tex(c), transparent: true, depthWrite: false, blending: AdditiveBlending }));
    m.raycast = () => {};
    return m;
  }

  private ledger(): void {
    const g = new Group();
    const leather = this.imgTex(leatherUrl());
    const cover = new MeshStandardMaterial({ map: leather, roughness: 0.55, color: 0xd09080 });
    const [pc, pg] = canvas(256, 64);
    pg.fillStyle = "#e4d4ae";
    pg.fillRect(0, 0, 256, 64);
    for (let y = 1; y < 64; y += 2.4) {
      pg.fillStyle = `rgba(110,90,60,${0.25 + (y % 5) * 0.05})`;
      pg.fillRect(0, y, 256, 0.8);
    }
    const pages = new MeshStandardMaterial({ map: this.tex(pc), roughness: 0.9 });
    const brass = new MeshStandardMaterial({ color: 0xd8a040, metalness: 1, roughness: 0.32 });
    const W = 0.44;
    const D = 0.31;
    const bottom = new Mesh(new RoundedBoxGeometry(W, 0.014, D, 2, 0.005), cover);
    bottom.position.y = 0.007;
    g.add(this.inked(bottom));
    const block = new Mesh(new BoxGeometry(W - 0.025, 0.05, D - 0.018), pages);
    block.position.set(0.008, 0.038, 0);
    block.castShadow = block.receiveShadow = true;
    g.add(block);
    const top = new Mesh(new RoundedBoxGeometry(W, 0.016, D, 2, 0.006), cover);
    top.position.y = 0.071;
    g.add(this.inked(top));
    const spine = new Mesh(new CylinderGeometry(0.04, 0.04, D, 18, 1, false, Math.PI, Math.PI), cover);
    spine.rotation.x = Math.PI / 2;
    spine.position.set(-W / 2, 0.04, 0);
    g.add(this.inked(spine));
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      const c = new Mesh(new BoxGeometry(0.04, 0.019, 0.04), brass);
      c.position.set((x * (W - 0.035)) / 2, 0.072, (z * (D - 0.035)) / 2);
      c.castShadow = true;
      g.add(c);
    }
    const seal = new Mesh(new CylinderGeometry(0.038, 0.04, 0.01, 24), new MeshStandardMaterial({ color: 0x9c1419, roughness: 0.35, emissive: new Color(0x2a0204) }));
    seal.position.set(0.02, 0.083, 0);
    g.add(this.inked(seal, 0.003));
    const ribbon = new Mesh(new PlaneGeometry(0.026, 0.16), new MeshStandardMaterial({ color: 0x9c1419, side: DoubleSide, roughness: 0.6 }));
    ribbon.rotation.x = -Math.PI / 2 + 0.15;
    ribbon.position.set(0.09, 0.03, D / 2 + 0.07);
    ribbon.castShadow = true;
    g.add(ribbon);
    this.root.add(g);
    this.pickables.set("ledger", g);
  }

  private deck(): void {
    const g = new Group();
    const brass = new MeshStandardMaterial({ color: 0xd8a040, metalness: 1, roughness: 0.3 });
    const [ec, eg] = canvas(128, 64);
    eg.fillStyle = "#d8ccb0";
    eg.fillRect(0, 0, 128, 64);
    for (let y = 0; y < 64; y += 2) {
      eg.fillStyle = y % 6 ? "rgba(110,90,60,.55)" : "rgba(60,40,20,.8)";
      eg.fillRect(0, y, 128, 0.8);
    }
    const [bc, bg] = canvas(256, 360);
    bg.fillStyle = "#7a1015";
    bg.fillRect(0, 0, 256, 360);
    bg.strokeStyle = "#e8c070";
    bg.lineWidth = 6;
    bg.strokeRect(14, 14, 228, 332);
    bg.lineWidth = 2;
    bg.strokeRect(26, 26, 204, 308);
    bg.fillStyle = "#f0c860";
    bg.beginPath();
    bg.arc(128, 180, 34, 0, TAU);
    bg.fill();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      bg.beginPath();
      bg.moveTo(128 + Math.cos(a) * 42, 180 + Math.sin(a) * 42);
      bg.lineTo(128 + Math.cos(a + 0.12) * 80, 180 + Math.sin(a + 0.12) * 80);
      bg.lineTo(128 + Math.cos(a - 0.12) * 80, 180 + Math.sin(a - 0.12) * 80);
      bg.fill();
    }
    const edge = new MeshStandardMaterial({ map: this.tex(ec), roughness: 0.85 });
    const back = new MeshStandardMaterial({ map: this.tex(bc), roughness: 0.6 });
    const stack = new Mesh(new BoxGeometry(0.15, 0.085, 0.21), [edge, edge, back, edge, edge, edge]);
    stack.position.y = 0.0475;
    stack.castShadow = stack.receiveShadow = true;
    g.add(stack);
    // The brass cage: posts, rims and bars.
    const bar = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const b = new Mesh(new BoxGeometry(w, h, d), brass);
      b.position.set(x, y, z);
      b.castShadow = true;
      g.add(this.inked(b, 0.002));
    };
    for (const x of [-0.08, 0.08]) for (const z of [-0.11, 0.11]) bar(0.012, 0.1, 0.012, x, 0.05, z);
    for (const y of [0.004, 0.096]) {
      bar(0.172, 0.01, 0.01, 0, y, -0.11);
      bar(0.172, 0.01, 0.01, 0, y, 0.11);
      bar(0.01, 0.01, 0.23, -0.08, y, 0);
      bar(0.01, 0.01, 0.23, 0.08, y, 0);
    }
    for (const z of [-0.04, 0.04]) bar(0.006, 0.1, 0.006, 0.081, 0.05, z);
    this.root.add(g);
    this.pickables.set("deck", g);
  }

  private bell(): void {
    const g = new Group();
    const brass = new MeshStandardMaterial({ color: 0xe2b04a, metalness: 1, roughness: 0.22 });
    const base = new Mesh(new CylinderGeometry(0.075, 0.08, 0.022, 32), new MeshStandardMaterial({ color: 0x2a1408, roughness: 0.5 }));
    base.position.y = 0.011;
    g.add(this.inked(base, 0.003));
    const dome = new Mesh(new SphereGeometry(0.064, 32, 16, 0, TAU, 0, Math.PI / 2), brass);
    dome.position.y = 0.022;
    g.add(this.inked(dome, 0.003));
    const stem = new Mesh(new CylinderGeometry(0.006, 0.006, 0.03, 10), brass);
    stem.position.y = 0.1;
    g.add(stem);
    const knob = new Mesh(new SphereGeometry(0.013, 14, 10), brass);
    knob.scale.y = 0.6;
    knob.position.y = 0.117;
    g.add(this.inked(knob, 0.002));
    g.traverse((o) => ((o as Mesh).castShadow = true));
    g.scale.setScalar(1.25);
    this.root.add(g);
    this.pickables.set("bell", g);
  }

  private gavel(): void {
    const g = new Group();
    const woodC = tabletop(false);
    const wood = this.tex(woodC, true);
    const dark = new MeshStandardMaterial({ map: wood, color: 0x8a5030, roughness: 0.4 });
    const brass = new MeshStandardMaterial({ color: 0xd8a040, metalness: 1, roughness: 0.3 });
    const block = new Mesh(new CylinderGeometry(0.095, 0.1, 0.036, 32), dark);
    block.position.y = 0.018;
    g.add(this.inked(block, 0.003));
    const head = new Mesh(new CylinderGeometry(0.036, 0.036, 0.15, 24), dark);
    head.rotation.z = Math.PI / 2;
    head.position.set(0.02, 0.072, 0);
    g.add(this.inked(head, 0.003));
    for (const x of [-0.04, 0.08]) {
      const band = new Mesh(new CylinderGeometry(0.038, 0.038, 0.014, 24), brass);
      band.rotation.z = Math.PI / 2;
      band.position.set(x, 0.072, 0);
      g.add(band);
    }
    const handle = new Mesh(new CylinderGeometry(0.011, 0.014, 0.3, 12), dark);
    handle.rotation.x = Math.PI / 2 - 0.12;
    handle.position.set(0.02, 0.055, 0.17);
    g.add(this.inked(handle, 0.003));
    g.traverse((o) => ((o as Mesh).castShadow = true));
    this.root.add(g);
    this.pickables.set("gavel", g);
  }

  /** The slate scoreboard on chains, with its glass vigor tube and the thread's slips on hooks. */
  private board(): void {
    const g = new Group();
    const woodC = tabletop(false);
    const frameM = new MeshStandardMaterial({ map: this.tex(woodC, true), color: 0x7a4a30, roughness: 0.55 });
    const frame = new Mesh(new BoxGeometry(0.66, 0.8, 0.045), frameM);
    g.add(this.inked(frame, 0.005, false));
    const [c] = canvas(600, 720);
    this.boardCanvas = c;
    this.boardTex = this.tex(c);
    const slate = new Mesh(new PlaneGeometry(0.56, 0.672), new MeshStandardMaterial({ map: this.boardTex, emissiveMap: this.boardTex, emissive: new Color(0xffffff), emissiveIntensity: 0.22, roughness: 0.9 }));
    slate.position.z = 0.0235;
    g.add(slate);
    const brass = new MeshStandardMaterial({ color: 0xd8a040, metalness: 1, roughness: 0.3 });
    for (const x of [-1, 1]) for (const y of [-1, 1]) {
      const p = new Mesh(new BoxGeometry(0.07, 0.07, 0.05), brass);
      p.position.set(x * 0.3, y * 0.37, 0.004);
      g.add(p);
    }
    // Chains up into the dark.
    const iron = new MeshStandardMaterial({ color: 0x3a3a40, metalness: 0.9, roughness: 0.45 });
    const link = new TorusGeometry(0.018, 0.0045, 6, 12);
    for (const x of [-0.24, 0.24])
      for (let i = 0; i < 26; i++) {
        const l = new Mesh(link, iron);
        l.scale.y = 1.6;
        l.position.set(x, 0.42 + i * 0.05, 0);
        l.rotation.y = i % 2 ? Math.PI / 2 : 0;
        g.add(l);
      }
    // The vigor tube: glass over a glowing liquid, brass caps.
    const tubeH = 0.62;
    const liquid = new Mesh(new CylinderGeometry(0.017, 0.017, 1, 16), new MeshStandardMaterial({ color: 0x38e54d, emissive: new Color(0x38e54d), emissiveIntensity: 2.2, roughness: 0.2 }));
    liquid.position.set(-0.375, 0, 0.03);
    this.vigorLiquid = liquid;
    g.add(liquid);
    const glass = new Mesh(new CylinderGeometry(0.024, 0.024, tubeH, 20), new MeshStandardMaterial({ color: 0xc8ffd8, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, envMapIntensity: 2 }));
    glass.position.set(-0.375, 0, 0.03);
    g.add(glass);
    for (const y of [-1, 1]) {
      const cap = new Mesh(new CylinderGeometry(0.03, 0.03, 0.03, 16), brass);
      cap.position.set(-0.375, (y * (tubeH + 0.03)) / 2, 0.03);
      g.add(cap);
    }
    const glow = new PointLight(0x38e54d, 0.35, 0.8, 2);
    glow.position.set(-0.375, 0, 0.12);
    liquid.userData.glow = glow;
    g.add(glow);
    g.add(this.slips);
    this.root.add(g);
    this.pickables.set("board", g);
  }

  /* ------------------------------ Layout ------------------------------- */

  /** Frame the table for the window's shape; spread the props to the width you can see. */
  private lastW = 0;
  private lastH = 0;
  layout(W: number, H: number): void {
    this.lastW = W;
    this.lastH = H;
    const aspect = W / Math.max(1, H);
    this.port = aspect < 1.15;
    if (this.port) {
      // Phone: lean in over the table so the faces fill the upper half.
      this.base.eye.set(0, 0.5, 1.2);
      this.base.look.set(0, -0.22, -1.3);
      this.base.fov = 62;
    } else {
      this.base.eye.set(0, 0.34, 1.05);
      this.base.look.set(0, 0, -1.0);
      this.base.fov = aspect > 2.2 ? 46 : 50;
    }
    if (this.enc) {
      // The fight or the talk has its own seat (duel.ts), which the flat layers over the room project too.
      const c = duelCamera(this.enc, aspect);
      this.base.eye.set(...c.eye);
      this.base.look.set(...c.look);
      this.base.fov = c.fov;
    }
    const cam = this.st.camera;
    cam.fov = this.base.fov;
    cam.near = 0.03;
    cam.far = 30;
    cam.aspect = aspect;
    cam.updateProjectionMatrix();
    // The half-width you can see at the props' depth, against the width they were placed for.
    const half = Math.tan((this.base.fov * Math.PI) / 360) * aspect * 1.55;
    this.spread = Math.max(0.42, Math.min(1.08, half / 1.3));
    const s = this.spread;
    const at = (id: PickId, x: number, z: number, ry: number) => {
      const o = this.pickables.get(id);
      if (!o) return;
      o.position.set(x * s, 0, z);
      o.rotation.y = ry;
      o.userData.y0 = 0;
    };
    at("skull", -1.0, -0.9, 0.3);
    at("ledger", -1.08, -0.5, 0.5);
    at("deck", 1.3, -0.88, 0.35);
    at("bell", 0.92, -0.92, 0);
    at("gavel", 0.92, -0.3, -0.5);
    const coins = this.coinGroup;
    coins.position.set(-0.68 * s, 0, -0.1);
    this.pickables.set("coins", coins);
    const b = this.pickables.get("board")!;
    if (this.port) {
      b.position.set(0.32, 0.95, -1.9);
      b.rotation.set(0, -0.12, 0.02);
      b.scale.setScalar(0.85);
    } else {
      // In a delve it hangs on the chamber's far wall, in front of the stone.
      b.position.set(1.52 * Math.max(0.85, s), 0.62, this.corridorKey ? -1.36 : -1.8);
      b.rotation.set(0, -0.32, 0.025);
      b.scale.setScalar(0.88);
    }
    if (this.enc) {
      // In a fight the slate hangs high on the right, clear of the figures, with the turn order chalked on it;
      // in a talk (and on a phone, where it would hang off screen) it is taken down.
      b.visible = !this.port;
      b.position.set(1.62 * Math.max(0.9, Math.min(1.25, s)), 0.6, -1.95);
      b.rotation.set(0, -0.38, 0.02);
      b.scale.setScalar(0.92);
    } else b.visible = true;
    this.tops.clear();
    const sk = this.pickables.get("skull")!;
    this.candle.position.set(sk.position.x, 0.56, sk.position.z + 0.04);
    this.layoutPeople();
    this.cam.eye.copy(this.base.eye);
    this.cam.look.copy(this.base.look);
  }

  /* ------------------------------ Data -------------------------------- */

  /** The place's painting on a big dark backdrop far behind the people. */
  async setBackdrop(url: string | null): Promise<void> {
    if (!url || url === this.backdropUrl) return;
    this.backdropUrl = url;
    const t = await this.st.texture(url);
    if (!t || this.disposed || this.backdropUrl !== url) return;
    const img = t.image as { width: number; height: number };
    const ar = img.width / Math.max(1, img.height);
    const h = 6.2;
    if (!this.backdropMesh) {
      this.backdropMesh = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ color: 0x5a4c46, fog: true }));
      this.backdropMesh.position.set(0, 1.15, -4.2);
      this.root.add(this.backdropMesh);
    }
    const m = this.backdropMesh.material as MeshBasicMaterial;
    m.map = t;
    m.needsUpdate = true;
    this.backdropMesh.scale.set(h * ar, h, 1);
    this.backdropMesh.visible = !this.corridorKey;
  }

  /**
   * In a delve the room becomes a stone chamber: the table stands in it, and
   * the passage ahead opens behind the far side of the table, built cell by
   * cell from what you can see (walls, side openings, a locked door, the dead
   * end), lit only by the skull candle and a torch further in.
   */
  setCorridor(c: Corridor3D | null): void {
    const key = c ? JSON.stringify(c) : "";
    if (key === this.corridorKey) return;
    this.corridorKey = key;
    const old = [...this.corridor.children];
    this.corridor.clear();
    for (const o of old)
      o.traverse((x) => {
        const m = x as Mesh;
        m.geometry?.dispose();
        const mat = m.material as Material | Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((k) => k.dispose());
        else mat?.dispose();
      });
    this.flames = this.flames.filter((f) => !f.userData.torch);
    if (this.lastW) this.layout(this.lastW, this.lastH);
    // The empty chair would stand in the passage's mouth.
    for (const o of this.people.children) if (o.name === "chair") o.visible = !c;
    if (this.backdropMesh) this.backdropMesh.visible = !c;
    if (!c) return;
    const FLOOR = -0.78;
    const CEIL = 1.62;
    const HW = 0.82;
    const CD = 1.6;
    const Z1 = -1.45;
    const ROOM = 2.75;
    const wallM = new MeshStandardMaterial({ color: 0x8a7a6c, roughness: 0.95 });
    const floorM = new MeshStandardMaterial({ color: 0x6a5c50, roughness: 0.9 });
    const ceilM = new MeshStandardMaterial({ color: 0x2a2420, roughness: 1 });
    const doorM = new MeshStandardMaterial({ color: 0x5c3e26, roughness: 0.7 });
    // Until the delve's own wall art arrives: dressed stone blocks in black mortar.
    const [bc, bg] = canvas(256, 256);
    const r = rng(77);
    bg.fillStyle = "#141110";
    bg.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 6; row++)
      for (let k = -1; k < 4; k++) {
        const x = k * 80 + (row % 2) * 40 + 3;
        const y = row * 43 + 3;
        const l = 70 + r() * 40;
        bg.fillStyle = `rgb(${l + 18},${l + 8},${l - 4})`;
        bg.fillRect(x, y, 74, 37);
        for (let i = 0; i < 40; i++) {
          bg.fillStyle = `rgba(${r() < 0.5 ? "0,0,0" : "255,240,220"},${r() * 0.12})`;
          bg.fillRect(x + r() * 70, y + r() * 33, 2 + r() * 8, 1 + r() * 4);
        }
      }
    const stone = this.tex(bc, true, [2, 2]);
    wallM.map = stone;
    floorM.map = stone;
    ceilM.map = stone;
    const useArt = (url: string | null, m: MeshStandardMaterial) => {
      if (!url) return;
      void this.st.texture(url).then((t) => {
        if (!t || this.disposed) return;
        m.map = t;
        m.needsUpdate = true;
      });
    };
    useArt(c.wall, wallM);
    useArt(c.floor, floorM);
    const H = CEIL - FLOOR;
    const piece = (w: number, h: number, m: Material, x: number, y: number, z: number, ry: number, rx = 0) => {
      const q = new Mesh(new PlaneGeometry(w, h), m);
      q.position.set(x, y, z);
      q.rotation.set(rx, ry, 0, "YXZ");
      q.receiveShadow = true;
      this.corridor.add(q);
      return q;
    };
    const wallAt = (x: number, z: number, ry: number, w = CD) => piece(w, H, wallM, x, (FLOOR + CEIL) / 2, z, ry);
    const slab = (x: number, z: number, w: number, d: number) => {
      piece(w, d, floorM, x, FLOOR, z, 0, -Math.PI / 2);
      piece(w, d, ceilM, x, CEIL, z, 0, Math.PI / 2);
    };
    const solid = (s: string | undefined) => !s || s === "#" || s === "?";
    // The chamber you sit in: side walls past the table's ends, a floor, a ceiling.
    const roomD = 1.6 - Z1;
    for (const sx of [-1, 1]) for (let z = 1.6 - CD / 2; z > Z1; z -= CD) wallAt(sx * ROOM, z, (-sx * Math.PI) / 2);
    slab(0, Z1 + roomD / 2, ROOM * 2, roomD);
    // Its far wall, with the passage's mouth in the middle unless a wall stands right there.
    const v = c.view;
    const firstShut = solid(v[1]?.ahead);
    const sideW = ROOM - HW;
    for (const sx of [-1, 1]) wallAt(sx * (HW + sideW / 2), Z1, 0, sideW);
    if (firstShut) wallAt(0, Z1, 0, HW * 2);
    // The passage, cell by cell.
    for (let i = 1; i < Math.min(v.length, 5) && !firstShut; i++) {
      const cell = v[i]!;
      const zn = Z1 - (i - 1) * CD;
      const zm = zn - CD / 2;
      if (solid(cell.ahead)) {
        wallAt(0, zn, 0, HW * 2);
        break;
      }
      if (cell.ahead === "L") {
        wallAt(0, zn, 0, HW * 2);
        const door = piece(HW * 1.2, H * 0.78, doorM, 0, FLOOR + H * 0.39, zn + 0.01, 0);
        door.castShadow = true;
        const ring = new Mesh(new TorusGeometry(0.06, 0.012, 8, 20), new MeshStandardMaterial({ color: 0xd8a040, metalness: 1, roughness: 0.35 }));
        ring.position.set(0.22, FLOOR + H * 0.4, zn + 0.03);
        this.corridor.add(ring);
        break;
      }
      slab(0, zm, HW * 2, CD);
      for (const [sx, side] of [[-1, cell.left], [1, cell.right]] as const) {
        if (solid(side)) wallAt(sx * HW, zm, (-sx * Math.PI) / 2);
        else {
          // A side opening: a short stub of floor and the far wall of the cross passage.
          slab(sx * (HW + CD / 2), zm, CD, CD);
          wallAt(sx * (HW + CD), zm, (-sx * Math.PI) / 2);
          wallAt(sx * (HW + CD / 2), zn, Math.PI);
          wallAt(sx * (HW + CD / 2), zn - CD, 0);
        }
      }
      if (i === Math.min(v.length, 5) - 1) wallAt(0, zn - CD, 0, HW * 2).visible = false;
    }
    // A torch a cell in, so the passage reads as stone and not as void.
    if (!firstShut) {
      const torch = new PointLight(0xff9a48, 1.6, 4.5, 1.6);
      torch.position.set(-HW + 0.12, 0.9, Z1 - CD * 0.8);
      this.corridor.add(torch);
      const sconce = new Mesh(new CylinderGeometry(0.03, 0.018, 0.22, 10), new MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.6, metalness: 0.4 }));
      sconce.position.set(-HW + 0.06, 0.78, Z1 - CD * 0.8);
      sconce.rotation.z = -0.35;
      this.corridor.add(sconce);
      const fl = this.flame();
      fl.scale.setScalar(2.4);
      fl.position.set(-HW + 0.1, 0.96, Z1 - CD * 0.8);
      fl.userData.base = fl.position.y;
      fl.userData.torch = true;
      this.flames.push(fl);
      this.corridor.add(fl);
    }
  }

  setBoard(b: Board3D, fontsReady: boolean): void {
    if (this.enc) return;
    const key = JSON.stringify([{ ...b, map: b.map?.key ?? null }, fontsReady]);
    if (key === this.boardKey) return;
    this.boardKey = key;
    const c = this.boardCanvas;
    const g = c.getContext("2d")!;
    const slate = new Image();
    // Paint the slate first (sync from cache if decoded), then the chalk.
    const paint = () => {
      g.clearRect(0, 0, c.width, c.height);
      if (slate.complete && slate.naturalWidth) g.drawImage(slate, 0, 0, c.width, c.height);
      else {
        g.fillStyle = "#16181b";
        g.fillRect(0, 0, c.width, c.height);
      }
      // A brass plate with the place's name.
      const plate = g.createLinearGradient(0, 30, 0, 100);
      plate.addColorStop(0, "#ffe6a0");
      plate.addColorStop(0.5, "#c08a30");
      plate.addColorStop(1, "#5a3608");
      g.fillStyle = plate;
      g.fillRect(40, 28, 520, 76);
      g.strokeStyle = "#1a0e02";
      g.lineWidth = 4;
      g.strokeRect(40, 28, 520, 76);
      g.fillStyle = "#1e1004";
      g.textAlign = "center";
      let size = 44;
      const name = b.where.toUpperCase();
      g.font = `800 ${size}px "Gambit Cinzel", serif`;
      while (g.measureText(name).width > 490 && size > 20) g.font = `800 ${(size -= 2)}px "Gambit Cinzel", serif`;
      g.fillText(name, 300, 66 + size * 0.36);
      chalk(
        g,
        (l) => {
          l.textAlign = "center";
          l.font = `600 30px "Gambit Cinzel", serif`;
          if (b.map) {
            // The automap, chalked large, with the day and hour on one line under it.
            const m = b.map.canvas;
            const sc = Math.min(500 / m.width, 300 / m.height);
            l.save();
            l.globalAlpha = 0.95;
            l.drawImage(m, 300 - (m.width * sc) / 2, 130, m.width * sc, m.height * sc);
            l.restore();
            l.textAlign = "center";
            l.fillStyle = "#f2efe9";
            l.font = `600 40px "Gambit Fell", serif`;
            l.fillText(`Day ${b.day} \u00b7 ${b.time}`, 300, 480);
            l.lineWidth = 5;
            l.strokeStyle = "#f2efe9";
            l.beginPath();
            l.moveTo(40, 512);
            l.quadraticCurveTo(300, 504, 560, 516);
            l.stroke();
            if (b.thread) {
              l.textAlign = "left";
              l.fillStyle = "#c8c2b6";
              l.font = `600 30px "Gambit Cinzel", serif`;
              l.fillText("THREAD", 50, 600);
              l.textAlign = "right";
              l.fillStyle = "#f2efe9";
              l.font = `800 72px "Gambit Cinzel", serif`;
              l.fillText(`${b.thread.found} / ${b.thread.total}`, 550, 620);
            }
            return;
          }
          l.fillStyle = "#c8c2b6";
          l.fillText("DAY", 150, 170);
          l.fillText("HOUR", 450, 170);
          l.fillStyle = "#f2efe9";
          l.font = `800 ${b.day > 99 ? 110 : 150}px "Gambit Cinzel", serif`;
          l.fillText(String(b.day), 150, 330);
          l.font = `600 54px "Gambit Fell", serif`;
          l.fillText(b.time, 450, 340);
          // The hour's sign.
          l.lineWidth = 7;
          l.lineCap = "round";
          l.beginPath();
          if (b.time === "night") {
            l.arc(450, 238, 34, 0.6, TAU - 0.6);
            l.arc(468, 230, 28, TAU - 0.9, 0.9, true);
          } else {
            l.arc(450, 238, b.time === "evening" ? 26 : 22, b.time === "evening" ? Math.PI : 0, TAU);
            for (let i = 0; i < 8; i++) {
              const a = (i / 8) * TAU;
              if (b.time === "evening" && Math.sin(a) > 0.1) continue;
              l.moveTo(450 + Math.cos(a) * 36, 238 + Math.sin(a) * 36);
              l.lineTo(450 + Math.cos(a) * 50, 238 + Math.sin(a) * 50);
            }
          }
          l.stroke();
          // Rough rules.
          l.lineWidth = 5;
          l.beginPath();
          l.moveTo(300, 140);
          l.quadraticCurveTo(306, 260, 298, 372);
          l.moveTo(40, 392);
          l.quadraticCurveTo(300, 384, 560, 396);
          l.stroke();
          l.textAlign = "left";
          l.font = `600 30px "Gambit Cinzel", serif`;
          l.fillStyle = "#c8c2b6";
          if (b.supplies) {
            l.fillText("SUPPLIES", 50, 460);
            l.textAlign = "right";
            l.fillStyle = "#f2efe9";
            l.font = `800 60px "Gambit Cinzel", serif`;
            l.fillText(`${b.supplies.now}/${b.supplies.max}`, 550, 470);
            l.lineWidth = 6;
            l.beginPath();
            for (let i = 0; i < Math.min(20, b.supplies.now); i++) {
              const gx = 50 + Math.floor(i / 5) * 70 + (i % 5) * 12;
              if (i % 5 === 4) {
                l.moveTo(gx - 52, 520);
                l.lineTo(gx + 4, 490);
              } else {
                l.moveTo(gx, 488);
                l.lineTo(gx + 3, 524);
              }
            }
            l.stroke();
          } else {
            l.fillText("VIGOR", 50, 470);
            l.textAlign = "right";
            l.fillStyle = b.vigor > 0.5 ? "#b8ffc4" : b.vigor > 0.25 ? "#ffe08a" : "#ff9a8a";
            l.font = `800 72px "Gambit Cinzel", serif`;
            l.fillText(`${Math.round(b.vigor * 100)}%`, 550, 490);
          }
          if (b.thread) {
            l.textAlign = "left";
            l.fillStyle = "#c8c2b6";
            l.font = `600 30px "Gambit Cinzel", serif`;
            l.fillText("THREAD", 50, 620);
            l.textAlign = "right";
            l.fillStyle = "#f2efe9";
            l.font = `800 72px "Gambit Cinzel", serif`;
            l.fillText(`${b.thread.found} / ${b.thread.total}`, 550, 640);
          }
          if (b.isNew) {
            l.save();
            l.translate(500, 128);
            l.rotate(-0.15);
            l.strokeStyle = "#ff9a8a";
            l.fillStyle = "#ff9a8a";
            l.lineWidth = 5;
            l.beginPath();
            l.ellipse(0, 0, 56, 26, 0, 0, TAU);
            l.stroke();
            l.textAlign = "center";
            l.font = `800 30px "Gambit Cinzel", serif`;
            l.fillText("NEW", 0, 11);
            l.restore();
          }
        },
        b.day * 7 + 3,
      );
      this.boardTex.needsUpdate = true;
    };
    slate.onload = paint;
    slate.src = slateUrl();
    paint();
    // Vigor liquid and its glow.
    const v = Math.max(0.02, Math.min(1, b.vigor));
    const col = new Color(v > 0.5 ? 0x38e54d : v > 0.25 ? 0xffb02a : 0xff3a2a);
    const lm = this.vigorLiquid.material as MeshStandardMaterial;
    lm.color.copy(col);
    lm.emissive.copy(col);
    this.vigorLiquid.scale.y = 0.6 * v;
    this.vigorLiquid.position.y = -0.3 + 0.3 * v;
    (this.vigorLiquid.userData.glow as PointLight).color.copy(col);
    // Thread slips on hooks under the board.
    this.slips.clear();
    const total = Math.min(8, b.thread?.total ?? 0);
    const paper = this.imgTex(paperUrl());
    const slipM = new MeshStandardMaterial({ map: paper, side: DoubleSide, roughness: 0.9 });
    const r = rng(5);
    for (let i = 0; i < total; i++) {
      const x = -0.26 + ((i + 0.5) / total) * 0.52;
      const hook = new Mesh(new TorusGeometry(0.01, 0.002, 6, 10, Math.PI * 1.3), new MeshStandardMaterial({ color: 0xd8a040, metalness: 1, roughness: 0.3 }));
      hook.position.set(x, -0.42, 0.03);
      this.slips.add(hook);
      if (i >= (b.thread?.found ?? 0)) continue;
      const slip = new Mesh(new PlaneGeometry(0.055, 0.085), slipM);
      slip.position.set(x, -0.475, 0.032);
      slip.rotation.z = (r() - 0.5) * 0.3;
      slip.castShadow = true;
      this.slips.add(slip);
    }
  }

  setCoins(n: number, fontsReady: boolean, unit = ""): void {
    this.coinUnit = unit;
    const key = `${n}|${fontsReady}|${unit}`;
    if (key === this.coinKey) return;
    this.coinKey = key;
    for (const c of [...this.coinGroup.children]) {
      this.coinGroup.remove(c);
      (c as Mesh).geometry?.dispose();
    }
    const gold = new MeshStandardMaterial({ color: 0xe0a83c, metalness: 1, roughness: 0.28 });
    const coin = new CylinderGeometry(0.03, 0.03, 0.0075, 24);
    const total = Math.max(1, Math.min(30, Math.round(Math.log2(n + 1) * 3.4)));
    const stacks = [Math.ceil(total * 0.45), Math.ceil(total * 0.33), Math.max(0, total - Math.ceil(total * 0.45) - Math.ceil(total * 0.33))];
    const at: [number, number][] = [[0, 0], [0.066, 0.02], [0.02, 0.06]];
    const r = rng(n + 1);
    stacks.forEach((k, s) => {
      for (let j = 0; j < k; j++) {
        const m = new Mesh(coin, gold);
        m.position.set(at[s]![0] + (r() - 0.5) * 0.004, 0.004 + j * 0.0078, at[s]![1] + (r() - 0.5) * 0.004);
        m.castShadow = m.receiveShadow = true;
        this.coinGroup.add(m);
      }
    });
    for (const [x, z] of [[-0.05, 0.05], [0.11, 0.07]] as const) {
      const m = new Mesh(coin, gold);
      m.position.set(x, 0.004, z);
      m.rotation.z = 0.05;
      m.castShadow = m.receiveShadow = true;
      this.coinGroup.add(m);
    }
    // A slate coaster with the purse chalked on it.
    const [c, g] = canvas(256, 160);
    g.fillStyle = "#17191c";
    g.fillRect(0, 0, 256, 160);
    chalk(
      g,
      (l) => {
        l.textAlign = "center";
        l.fillStyle = "#f6d27a";
        l.font = `800 ${this.coinUnit ? 80 : 96}px "Gambit Cinzel", serif`;
        l.fillText(n >= 10000 ? `${Math.round(n / 1000)}k` : String(n), 128, this.coinUnit ? 88 : 120);
        if (this.coinUnit) {
          l.fillStyle = "#e8e2d6";
          let size = 34;
          const u = this.coinUnit.toUpperCase();
          l.font = `600 ${size}px "Gambit Cinzel", serif`;
          while (l.measureText(u).width > 230 && size > 16) l.font = `600 ${(size -= 2)}px "Gambit Cinzel", serif`;
          l.fillText(u, 128, 140);
        }
      },
      n,
    );
    const coaster = new Mesh(new BoxGeometry(0.15, 0.01, 0.095), [
      new MeshStandardMaterial({ color: 0x0c0c0e }),
      new MeshStandardMaterial({ color: 0x0c0c0e }),
      new MeshStandardMaterial({ map: this.tex(c), roughness: 0.9, emissive: new Color(0xffffff), emissiveMap: this.textures[this.textures.length - 1]!, emissiveIntensity: 0.15 }),
      new MeshStandardMaterial({ color: 0x0c0c0e }),
      new MeshStandardMaterial({ color: 0x0c0c0e }),
      new MeshStandardMaterial({ color: 0x0c0c0e }),
    ]);
    coaster.position.set(0.17, 0.005, 0.07);
    coaster.rotation.y = -0.2;
    coaster.receiveShadow = true;
    this.coinGroup.add(coaster);
  }

  private peopleData: Person3D[] = [];

  setPeople(list: Person3D[], fontsReady: boolean): void {
    const key = JSON.stringify([list, fontsReady]);
    if (key === this.peopleKey) return;
    this.peopleKey = key;
    this.peopleData = list;
    for (const k of [...this.pickables.keys()]) if (k.startsWith("person:")) this.pickables.delete(k);
    for (const c of [...this.people.children]) {
      this.people.remove(c);
      c.traverse((o) => {
        const m = o as Mesh;
        if (m.geometry) m.geometry.dispose();
      });
    }
    if (!list.length) {
      const ch = this.chair();
      ch.visible = !this.corridorKey;
      this.people.add(ch);
      return;
    }
    list.slice(0, 5).forEach((p, i) => {
      const g = new Group();
      g.userData = { i, n: list.length, ar: 0.62, id: p.id };
      const mat = new MeshStandardMaterial({ alphaTest: 0.5, side: DoubleSide, roughness: 0.85, emissive: new Color(0xffffff), emissiveIntensity: i === 0 ? 0.32 : 0.2 });
      const plane = new Mesh(new PlaneGeometry(1, 1), mat);
      plane.castShadow = true;
      plane.receiveShadow = false;
      plane.name = "figure";
      g.add(plane);
      // Until the art lands, a hooded silhouette stands there, so the name card never fronts empty air.
      const sil = this.silhouette();
      this.applyFigure(plane, sil, 0.55);
      if (p.art) {
        void this.figureTexture(p.art.url, p.art.cutout).then((t) => {
          if (!t || this.disposed || plane.parent !== g) return;
          const img = t.image as HTMLCanvasElement;
          this.applyFigure(plane, t, img.width / img.height);
          if (p.art!.cutout) this.puppets.warp(plane, img);
          g.userData.ar = img.width / img.height;
          this.layoutPeople();
          this.onReady?.();
        });
      }
      // A folded name card on the table in front of them.
      const tent = this.tent(p.name, fontsReady);
      tent.name = "tent";
      g.add(tent);
      this.people.add(g);
      this.pickables.set(`person:${p.id}`, g);
    });
    this.layoutPeople();
  }

  private applyFigure(plane: Mesh, t: Texture, ar: number): void {
    const m = plane.material as MeshStandardMaterial;
    m.map = t;
    m.emissiveMap = t;
    m.needsUpdate = true;
    plane.userData.ar = ar;
    plane.customDepthMaterial = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, map: t, alphaTest: 0.5 });
    plane.customDistanceMaterial = new MeshDistanceMaterial({ map: t, alphaTest: 0.5 });
    plane.parent && (plane.parent.userData.ar = ar);
  }

  /** Where each person stands: the one you face in the middle, the rest to the sides and further back. */
  private layoutPeople(): void {
    const s = this.spread;
    const seats = [
      { x: 0, z: -1.38, h: 1.55, foot: -0.55 },
      { x: -0.95, z: -1.55, h: 1.32, foot: -0.5 },
      { x: 0.95, z: -1.55, h: 1.32, foot: -0.5 },
      { x: -0.48, z: -1.85, h: 1.15, foot: -0.4 },
      { x: 0.48, z: -1.85, h: 1.15, foot: -0.4 },
    ];
    for (const g of this.people.children) {
      if (g.name === "chair") continue;
      const u = g.userData as { i: number; ar: number };
      const seat = seats[u.i] ?? seats[0]!;
      const fig = g.getObjectByName("figure") as Mesh | undefined;
      const tent = g.getObjectByName("tent");
      const ar = (fig?.userData.ar as number | undefined) ?? 0.6;
      const h = seat.h * (this.port ? 0.85 : 1);
      const x = seat.x * Math.min(1, s) * (this.port ? 0.75 : 1);
      g.position.set(0, 0, 0);
      if (fig) {
        fig.scale.set(h * ar, h, 1);
        fig.position.set(x, seat.foot + h / 2, seat.z);
        // Face the chair you sit in, but stay upright.
        fig.rotation.set(0, Math.atan2(this.base.eye.x - x, this.base.eye.z - seat.z) * 0.6, 0);
      }
      if (tent) {
        tent.position.set(x * (this.port ? 1 : 0.7), 0, -0.98 + (u.i > 2 ? 0.02 : 0));
        tent.rotation.y = Math.atan2(this.base.eye.x - x, this.base.eye.z + 0.98) * 0.8;
        tent.visible = u.i < 3;
      }
    }
  }

  /** Load a person's art and ink it: a dark contour around the cut-out, or an iron arch around opaque art. */
  private figureTexture(url: string, cutout: boolean): Promise<CanvasTexture | null> {
    const key = `${cutout}|${url}`;
    let p = this.personTex.get(key);
    if (!p) {
      p = loadImage(url)
        .then((img) => {
          const H = Math.min(900, img.height);
          const W = Math.round((img.width * H) / img.height);
          const pad = 8;
          if (cutout) {
            const [c, g] = canvas(W + pad * 2, H + pad);
            g.filter = "brightness(0)";
            for (let a = 0; a < 16; a++) g.drawImage(img, pad + Math.cos((a / 16) * TAU) * 4.5, pad + Math.sin((a / 16) * TAU) * 4.5, W, H);
            // A touch of ink: harder contrast, a little less paint-box colour.
            g.filter = "contrast(1.15) saturate(.9)";
            g.drawImage(img, pad, pad, W, H);
            g.filter = "none";
            // Busts cropped by the picture's own edges fade out there instead of ending in a hard line.
            g.globalCompositeOperation = "destination-out";
            const fw = W * 0.09;
            for (const [x0, x1] of [[pad - 6, pad + fw], [pad + W + 6, pad + W - fw]] as const) {
              const gr = g.createLinearGradient(x0, 0, x1, 0);
              gr.addColorStop(0, "rgba(0,0,0,1)");
              gr.addColorStop(1, "rgba(0,0,0,0)");
              g.fillStyle = gr;
              g.fillRect(Math.min(x0, x1), 0, Math.abs(x1 - x0), H + pad);
            }
            g.globalCompositeOperation = "source-over";
            return this.tex(c);
          }
          // Opaque art: cropped into a gothic arch with an iron frame and a dark inner vignette.
          const AW = Math.round(H * 0.76);
          const [c, g] = canvas(AW, H);
          const arch = new Path2D(`M${AW * 0.1},${H} L${AW * 0.1},${H * 0.38} Q${AW * 0.1},${H * 0.24} ${AW * 0.26},${H * 0.16} Q${AW * 0.4},${H * 0.09} ${AW * 0.5},${H * 0.03} Q${AW * 0.6},${H * 0.09} ${AW * 0.74},${H * 0.16} Q${AW * 0.9},${H * 0.24} ${AW * 0.9},${H * 0.38} L${AW * 0.9},${H}Z`);
          g.save();
          g.clip(arch);
          const sc = Math.max(AW / img.width, H / img.height);
          g.drawImage(img, (AW - img.width * sc) / 2, 0, img.width * sc, img.height * sc);
          const v = g.createRadialGradient(AW / 2, H * 0.45, H * 0.2, AW / 2, H * 0.5, H * 0.62);
          v.addColorStop(0, "rgba(7,5,8,0)");
          v.addColorStop(1, "rgba(7,5,8,.9)");
          g.fillStyle = v;
          g.fillRect(0, 0, AW, H);
          g.restore();
          g.lineJoin = "round";
          g.strokeStyle = "#050304";
          g.lineWidth = H * 0.05;
          g.stroke(arch);
          g.strokeStyle = "#5a4232";
          g.lineWidth = H * 0.018;
          g.stroke(arch);
          g.strokeStyle = "#0a0707";
          g.lineWidth = H * 0.006;
          g.stroke(arch);
          return this.tex(c);
        })
        .catch(() => null);
      this.personTex.set(key, p);
    }
    return p;
  }

  private silhouette(): CanvasTexture {
    const [c, g] = canvas(300, 500);
    g.fillStyle = "#0b080a";
    g.strokeStyle = "#000";
    g.lineWidth = 10;
    const p = new Path2D("M150,30 C200,30 222,80 214,130 C240,150 250,190 262,250 L286,500 L14,500 L38,250 C50,190 60,150 86,130 C78,80 100,30 150,30Z");
    g.fill(p);
    g.stroke(p);
    g.strokeStyle = "rgba(255,140,60,.35)";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(96, 132);
    g.quadraticCurveTo(70, 160, 54, 250);
    g.stroke();
    return this.tex(c);
  }

  private tent(name: string, fontsReady: boolean): Group {
    const g = new Group();
    const [c, x] = canvas(512, 150);
    x.fillStyle = "#e2d6bd";
    x.fillRect(0, 0, 512, 150);
    x.strokeStyle = "#b81d24";
    x.lineWidth = 4;
    x.strokeRect(14, 14, 484, 122);
    x.fillStyle = "#0d0b0e";
    x.textAlign = "center";
    let size = 76;
    x.font = `800 ${size}px "Gambit Cinzel", serif`;
    while (x.measureText(name.toUpperCase()).width > 440 && size > 30) x.font = `800 ${(size -= 4)}px "Gambit Cinzel", serif`;
    x.fillText(name.toUpperCase(), 256, 75 + size * 0.36);
    void fontsReady;
    const face = new MeshStandardMaterial({ map: this.tex(c), roughness: 0.85, emissive: new Color(0xffffff), emissiveMap: this.textures[this.textures.length - 1]!, emissiveIntensity: 0.12 });
    const plain = new MeshStandardMaterial({ color: 0xcfc2a6, roughness: 0.9 });
    const w = 0.3;
    const h = 0.09;
    const front = new Mesh(new PlaneGeometry(w, h), face);
    front.position.set(0, (h / 2) * Math.cos(0.35), 0.016);
    front.rotation.x = -0.35;
    front.castShadow = true;
    const back = new Mesh(new PlaneGeometry(w, h), plain);
    back.position.set(0, (h / 2) * Math.cos(0.35), -0.016);
    back.rotation.x = 0.35;
    back.rotation.y = Math.PI;
    back.castShadow = true;
    g.add(front, back);
    const ink = new Mesh(new BoxGeometry(w + 0.006, 0.004, 0.04), new MeshBasicMaterial({ color: INK }));
    ink.position.y = 0.002;
    g.add(ink);
    return g;
  }

  /** An empty high-backed chair across the table, when nobody is here. */
  private chair(): Group {
    const g = new Group();
    g.name = "chair";
    const wood = new MeshStandardMaterial({ color: 0x3a1a0c, roughness: 0.5 });
    const [vc, vg] = canvas(128, 256);
    vg.fillStyle = "#4a0a10";
    vg.fillRect(0, 0, 128, 256);
    vg.strokeStyle = "rgba(200,120,60,.35)";
    vg.lineWidth = 2;
    for (let y = -16; y < 272; y += 32)
      for (let x = -16; x < 144; x += 32) {
        vg.beginPath();
        vg.moveTo(x, y + 16);
        vg.lineTo(x + 16, y);
        vg.lineTo(x + 32, y + 16);
        vg.lineTo(x + 16, y + 32);
        vg.closePath();
        vg.stroke();
      }
    const velvet = new MeshStandardMaterial({ map: this.tex(vc), roughness: 1 });
    const shape = new Shape();
    shape.moveTo(-0.32, 0);
    shape.lineTo(-0.32, 1.1);
    shape.quadraticCurveTo(-0.3, 1.3, -0.1, 1.34);
    shape.quadraticCurveTo(0, 1.46, 0.1, 1.34);
    shape.quadraticCurveTo(0.3, 1.3, 0.32, 1.1);
    shape.lineTo(0.32, 0);
    shape.lineTo(-0.32, 0);
    const back = new Mesh(new ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 }), wood);
    back.castShadow = back.receiveShadow = true;
    g.add(back);
    const knob = new Mesh(new SphereGeometry(0.035, 14, 10), wood);
    knob.position.set(0, 1.43, 0.03);
    g.add(this.inked(knob, 0.004));
    const pad = new Mesh(new BoxGeometry(0.46, 1.0, 0.02), velvet);
    pad.position.set(0, 0.68, 0.07);
    g.add(pad);
    for (const x of [-0.32, 0.32]) {
      const fin = new Mesh(new SphereGeometry(0.04, 12, 10), wood);
      fin.position.set(x, 1.15, 0.03);
      g.add(fin);
    }
    g.position.set(0, -0.6, -1.5);
    return g;
  }

  setBusy(b: boolean): void {
    this.busy = b;
  }

  /* ---------------------------- Interaction ---------------------------- */

  pick(clientX: number, clientY: number): PickId | null {
    const objs = [...this.pickables.values()];
    const hit = this.st.pick(clientX, clientY, objs);
    if (!hit) return null;
    let o: Object3D | null = hit.object;
    while (o) {
      for (const [id, g] of this.pickables) if (g === o) return id;
      o = o.parent;
    }
    return null;
  }

  setHover(id: PickId | null): void {
    if (id === this.hover) return;
    const glow = (pid: PickId | null, on: boolean) => {
      const g = pid ? this.pickables.get(pid) : null;
      if (!g) return;
      g.traverse((o) => {
        const m = (o as Mesh).material as MeshStandardMaterial | MeshStandardMaterial[] | undefined;
        for (const mt of Array.isArray(m) ? m : m ? [m] : []) {
          if (!(mt instanceof MeshStandardMaterial)) continue;
          if (on) {
            mt.userData.e0 ??= { c: mt.emissive.getHex(), i: mt.emissiveIntensity };
            if (mt.emissiveMap) mt.emissiveIntensity = 0.7;
            else {
              mt.emissive.setHex(0x8a3a08);
              mt.emissiveIntensity = 0.55;
            }
          } else if (mt.userData.e0) {
            mt.emissive.setHex(mt.userData.e0.c);
            mt.emissiveIntensity = mt.userData.e0.i;
            delete mt.userData.e0;
          }
        }
      });
      g.userData.lift = on ? 1 : 0;
    };
    glow(this.hover, false);
    this.hover = id;
    glow(id, true);
  }

  /** Glide the camera in to look at a thing; `then` runs when it has arrived. */
  zoomTo(id: PickId | null, then: (() => void) | null = null): void {
    if (!id) {
      this.zoom = null;
      return;
    }
    const g = this.pickables.get(id);
    if (!g) return;
    const box = new Vector3();
    g.getWorldPosition(box);
    if (id === "board") box.y -= 0.05;
    const look = box.clone().add(new Vector3(0, id === "board" ? 0 : 0.06, 0));
    const dir = this.base.eye.clone().sub(look).normalize();
    const dist = id === "board" ? 1.05 : id === "skull" ? 0.75 : 0.62;
    const eye = look.clone().add(dir.multiplyScalar(dist)).add(new Vector3(0, id === "board" ? 0 : 0.22, 0));
    this.zoom = { id, eye, look, since: this.t, done: then };
    if (this.reduced) {
      this.cam.eye.copy(eye);
      this.cam.look.copy(look);
    }
  }

  get zoomed(): PickId | null {
    return this.zoom?.id ?? null;
  }

  ringBell(): void {
    this.ring = 1;
  }

  /** Screen position (px, relative to the canvas) of a pickable, for DOM labels. */
  screenOf(id: PickId, W: number, H: number, dy = 0): { x: number; y: number; on: boolean } | null {
    const g = this.pickables.get(id);
    if (!g) return null;
    const p = new Vector3();
    if (id.startsWith("person:")) {
      const tent = g.getObjectByName("tent");
      (tent ?? g).getWorldPosition(p);
    } else {
      // Labels sit on top of the thing they name, not at its feet.
      let t = this.tops.get(id);
      if (!t) {
        const bx = new Box3().setFromObject(g);
        t = new Vector3((bx.min.x + bx.max.x) / 2, bx.max.y, (bx.min.z + bx.max.z) / 2);
        this.tops.set(id, t);
      }
      p.copy(t);
    }
    p.y += dy;
    p.project(this.st.camera);
    return { x: ((p.x + 1) / 2) * W, y: ((1 - p.y) / 2) * H, on: p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1 };
  }

  /** Screen position (px) of a point in the room. */
  screenAt(x: number, y: number, z: number, W: number, H: number): { x: number; y: number } {
    const v = new Vector3(x, y, z).project(this.st.camera);
    return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H };
  }

  /** Screen rectangle of the mat's near half (where the narration scroll lies). */
  matRect(W: number, H: number): { x0: number; x1: number; y0: number; y1: number } {
    const pr = (x: number, z: number) => {
      const v = new Vector3(x, 0, z).project(this.st.camera);
      return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H };
    };
    const a = pr(-0.75, -0.82);
    const b = pr(0.75, -0.82);
    const c = pr(-0.75, -0.04);
    const d = pr(0.75, -0.04);
    return { x0: Math.min(a.x, c.x), x1: Math.max(b.x, d.x), y0: a.y, y1: c.y };
  }

  /* ------------------------------- Frame ------------------------------- */

  frame(t: number, dt: number, pointer: { x: number; y: number }): void {
    this.t = t;
    this.puppetMeshes?.tick(t, Math.min(0.1, dt));
    const cam = this.st.camera;
    const z = this.zoom;
    // Seated: lean toward the pointer and breathe. Zoomed: glide to the object.
    if (this.enc) this.duelFrame(dt);
    const still = !!this.enc;
    const goalEye = z ? z.eye : still ? this.base.eye : this.base.eye.clone().add(new Vector3(pointer.x * 0.07, -pointer.y * 0.035 + Math.sin(t * 0.45) * 0.006, Math.sin(t * 0.3) * 0.01));
    const goalLook = z ? z.look : still ? this.base.look : this.base.look.clone().add(new Vector3(pointer.x * 0.22, -pointer.y * 0.12, 0));
    const k = this.reduced ? 1 : 1 - Math.exp(-dt * 6.5);
    this.cam.eye.lerp(goalEye, k);
    this.cam.look.lerp(goalLook, k);
    cam.position.copy(this.cam.eye);
    cam.lookAt(this.cam.look);
    if (z?.done && (this.reduced || t - z.since > 0.55)) {
      const d = z.done;
      z.done = null;
      d();
    }
    // Candle flicker: the light, the flames, and harder when the house is thinking.
    const amp = this.busy ? 2.2 : 1;
    const f = this.reduced ? 1 : 1 + amp * (0.08 * Math.sin(t * 7.3) + 0.05 * Math.sin(t * 13.7 + 1.3) + (Math.random() - 0.5) * 0.06);
    this.candle.intensity = 2.4 * f * (1 + this.flareK * 1.6);
    this.lamp.intensity = 9 * (1 + (f - 1) * 0.25);
    for (const [i, fl] of this.flames.entries()) {
      fl.quaternion.copy(cam.quaternion);
      const s = this.reduced ? 1 : 1 + 0.12 * Math.sin(t * (9 + i * 2.3)) + (Math.random() - 0.5) * 0.08 * amp;
      fl.scale.set(1 / s, s, 1);
    }
    // Hover lift and the bell's shiver.
    for (const [id, g] of this.pickables) {
      if (id.startsWith("person:") || id === "board") continue;
      const lift = (g.userData.lift as number | undefined) ?? 0;
      g.position.y += (lift * 0.025 - g.position.y) * Math.min(1, dt * 10);
    }
    const bell = this.pickables.get("bell");
    if (bell) {
      if (this.ring > 0) this.ring = Math.max(0, this.ring - dt * 1.4);
      const shiver = this.ring > 0 ? Math.sin(t * 60) * 0.06 * this.ring : this.busy && !this.reduced ? Math.sin(t * 40) * 0.02 : 0;
      bell.rotation.z = shiver;
    }
  }

  /** Stage a fight or a talk here (null: back to the scene). */
  setEncounter(kind: "battle" | "parley" | null): void {
    if (kind === this.enc) return;
    this.enc = kind;
    this.zoom = null;
    this.setHover(null);
    this.people.visible = !kind;
    this.slips.visible = !kind;
    this.slateSeen = -1;
    if (!kind) this.patienceCandles(null);
    // The scoreboard goes back to the day and the hour when the fight is over.
    if (!kind) this.boardKey = "";
    if (this.lastW) this.layout(this.lastW, this.lastH);
  }

  /** What the battle asks of the room this frame: its turn order on the slate, the bell, a flare of the candle. */
  private duelFrame(dt: number): void {
    if (duel.slate && duel.slateVersion !== this.slateSeen) {
      this.slateSeen = duel.slateVersion;
      const g = this.boardCanvas.getContext("2d")!;
      g.clearRect(0, 0, this.boardCanvas.width, this.boardCanvas.height);
      g.drawImage(duel.slate, 0, 0, this.boardCanvas.width, this.boardCanvas.height);
      this.boardTex.needsUpdate = true;
    }
    if (duel.ring !== this.ringSeen) {
      this.ringSeen = duel.ring;
      this.ringBell();
    }
    if (duel.flare !== this.flareSeen) {
      this.flareSeen = duel.flare;
      if (!this.reduced) this.flareK = 1;
    }
    this.flareK = Math.max(0, this.flareK - dt * 2.2);
    const pk = this.enc === "parley" && duel.patience ? `${duel.patience.now}/${duel.patience.max}` : "";
    if (pk !== this.patienceKey) this.patienceCandles(pk ? duel.patience : null);
  }

  private patienceRow = new Group();
  private patienceKey = "";
  private rowFlames: Mesh[] = [];
  /** The talk's patience: a row of tapers on the slate's ledge, one snuffed for each that is spent. */
  private patienceCandles(p: { now: number; max: number } | null): void {
    this.patienceKey = p ? `${p.now}/${p.max}` : "";
    this.flames = this.flames.filter((f) => !this.rowFlames.includes(f));
    this.rowFlames = [];
    for (const c of [...this.patienceRow.children]) {
      this.patienceRow.remove(c);
      c.traverse((o) => (o as Mesh).geometry?.dispose());
    }
    const board = this.pickables.get("board");
    if (!p || !board) return;
    if (this.patienceRow.parent !== board) board.add(this.patienceRow);
    const wax = new MeshStandardMaterial({ color: 0xeee2c8, roughness: 0.65, emissive: new Color(0x402010), emissiveIntensity: 0.25 });
    const spent = new MeshStandardMaterial({ color: 0x9a8e78, roughness: 0.8 });
    const brass = new MeshStandardMaterial({ color: 0xd8a040, metalness: 1, roughness: 0.3 });
    const n = Math.max(1, Math.min(8, p.max));
    const tray = new Mesh(new BoxGeometry(0.07 * n + 0.04, 0.016, 0.07), brass);
    tray.position.set(0, -0.415, 0.05);
    this.patienceRow.add(tray);
    for (let i = 0; i < n; i++) {
      const lit = i < p.now;
      const h = lit ? 0.12 : 0.055;
      const c = new Mesh(new CylinderGeometry(0.011, 0.013, h, 12), lit ? wax : spent);
      const x = (i - (n - 1) / 2) * 0.07;
      c.position.set(x, -0.405 + h / 2, 0.05);
      c.castShadow = true;
      this.patienceRow.add(this.inked(c, 0.0025, false));
      const wick = new Mesh(new CylinderGeometry(0.0015, 0.0015, 0.014, 4), new MeshBasicMaterial({ color: 0x120a08 }));
      wick.position.set(x, -0.405 + h + 0.006, 0.05);
      this.patienceRow.add(wick);
      if (lit) {
        const fl = this.flame();
        fl.position.set(x, -0.405 + h + 0.03, 0.05);
        this.patienceRow.add(fl);
        this.flames.push(fl);
        this.rowFlames.push(fl);
      }
    }
    const glow = new PointLight(0xff9a40, 0.25 * p.now, 0.9, 2);
    glow.position.set(0, -0.25, 0.25);
    this.patienceRow.add(glow);
  }

  dispose(): void {
    this.disposed = true;
    this.puppetMeshes?.dispose();
    for (const t of this.textures) t.dispose();
    this.textures = [];
    this.env?.dispose();
    this.env = null;
  }
}
