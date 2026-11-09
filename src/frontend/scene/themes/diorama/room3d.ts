/**
 * The diorama as a real 3D shop (three.js on the host's layer): a modelled
 * counter in a room of bookcases (indoors, the place's painting as the back
 * wall) or a market stall of crates under a timber beam with nets (outdoors,
 * the painting as the view behind). A brass lamp hangs over the counter as
 * a real shadow-casting light. People stand behind the counter as lit
 * cut-out planes (opaque art in a framed standee). Every action is a lit
 * object on the counter: hovering lifts it and lights its yellow ring;
 * clicking glides the camera in to it and opens its choices in a panel
 * beside it (Esc, Back or a click elsewhere pulls back). Talking acts at
 * once. Each object also has a DOM label projected onto it every frame, so
 * keyboard and touch reach everything. The narration, the journal and the
 * theme picker stay DOM overlays.
 */
import {
  ACESFilmicToneMapping,
  Color,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshDistanceMaterial,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  BufferGeometry,
  Float32BufferAttribute,
  AdditiveBlending,
  PerspectiveCamera,
  DoubleSide,
  Vector3,
  type CanvasTexture,
  type Object3D,
  type Texture,
} from "three";
import { esc, rng, type EncounterView, type MenuItem, type SceneView, type ThemeCtx } from "../contract.js";
import { board } from "./bridge.js";
import { Casters, battlePose, footlights, proscenium, measureBand, parleyPose, poseCamera, toWorld, type Footlights, type Pose } from "./encounter3d.js";
import type { Stage3D } from "../../layer3d.js";
import * as M from "./models.js";
import { cleanCutout } from "./chart.js";
import { followStory, journalHtml, narrationHtml, pickerHtml, sayHtml } from "./shared.js";
import { wireTypewriter } from "../typewriter.js";
import { WEDGE } from "./props3d.js";
import { phoneActsHtml } from "./phone.js";
import type { Mode } from "./flat.js";
import { createPuppetMeshes } from "../../puppet-mesh.js";

interface Item {
  key: string;
  obj: Object3D;
  /** Where its label sits, in the object's local space. */
  anchor: Vector3;
  /** What the camera looks at when it glides in (local space). */
  focus: Vector3;
  label: string;
  /** Glide the camera in and show a panel (true), or act at once. */
  zoom: boolean;
  run?: () => void;
  panel?: () => string;
  /** How far the camera stands off when it glides in. */
  dist: number;
  ring: Mesh | null;
  baseY: number;
  hot: number;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const HANDS: Record<string, [number, number]> = { morning: [9, 0], afternoon: [15, 0], evening: [18, 30], night: [23, 0] };

/** People drawn behind the counter; the rest are in the guest book. */
const BEHIND_COUNTER = 4;

export function room3d(ctx: ThemeCtx, host: HTMLElement): Mode {
  host.innerHTML = `<div class="dr d3">
  <div class="stage3"></div>
  <div class="vig3 np"></div>
  <div class="labels np"></div>
  <div class="panel" hidden></div>
  <div class="say">${sayHtml()}</div>
  <div class="phacts" role="group" aria-label="What you can do here"></div>
  <div class="ovl"></div>
  <div class="lb plate encplate" hidden>${WEDGE}<b></b><small></small></div>
</div>`;
  const dr = host.querySelector(".dr") as HTMLDivElement;
  const stageEl = host.querySelector(".stage3") as HTMLDivElement;
  const labelsEl = host.querySelector(".labels") as HTMLDivElement;
  const panelEl = host.querySelector(".panel") as HTMLDivElement;
  const say = host.querySelector(".say") as HTMLDivElement;
  const sayIn = host.querySelector(".say-in") as HTMLDivElement;
  const write = wireTypewriter(ctx, host.querySelector(".dr-tw") as HTMLFormElement);
  const phacts = host.querySelector(".phacts") as HTMLDivElement;
  const ovl = host.querySelector(".ovl") as HTMLDivElement;
  const encPlate = host.querySelector(".encplate") as HTMLDivElement;
  let destroyed = false;
  let active = false;
  let last: SceneView | null = null;
  let st: Stage3D | null = null;
  let gen = -1;
  let logOpen = false;
  let pickOpen = false;

  /* ---------------- The scene graph (built once per generation) ---------------- */
  let world: Group | null = null;
  let roomKind = "";
  let parts: {
    back: Mesh; easel: ReturnType<typeof M.easel>; register: ReturnType<typeof M.register>; tea: ReturnType<typeof M.teacup>;
    hour: ReturnType<typeof M.hourglass>; dagger: ReturnType<typeof M.dagger>; lantern: ReturnType<typeof M.lanternModel>;
    jour: Group; cls: Group; globe: ReturnType<typeof M.globe>; clock: ReturnType<typeof M.clockModel>; spools: Group; spoolKey: string;
    lamp: PointLight; flame: PointLight; people: Group; peopleKey: string; cards: Group; cardsKey: string; extras: Group; extrasKey: string;
    motes: Points; cardsAnchor: Group; lampG: Group; fill: { hemi: HemisphereLight; front: PointLight; rim: PointLight };
  } | null = null;
  const items = new Map<string, Item>();
  const dynTex = new Set<Texture>();
  // People who are cut-outs breathe and sway behind the counter through Cue's rig.
  const puppets = createPuppetMeshes(ctx.reducedMotion);
  /** Props drawn inward toward the middle of the counter on a narrow (phone) screen. */
  let squeeze: Object3D[] = [];

  let phoneRatio = 0;
  let shadowAt = 0;
  /** Hand the renderer back as the layer had it (another theme, or the corridor, may use it next). */
  function releasePhoneRender(): void {
    if (!phoneRatio || !st) return;
    st.renderer.setPixelRatio(phoneRatio);
    st.renderer.shadowMap.autoUpdate = true;
    phoneRatio = 0;
  }

  function place(o: Object3D, x: number, y: number, z: number, ry = 0): Object3D {
    o.position.set(x, y, z);
    o.rotation.y = ry;
    return o;
  }

  function build(s: Stage3D, indoor: boolean): void {
    s.root.clear();
    items.clear();
    const r = s.renderer;
    r.shadowMap.enabled = true;
    r.shadowMap.type = PCFSoftShadowMap;
    // A phone's GPU pays for every pixel and every shadow, and the words on screen are DOM or Pixi, so they stay sharp:
    // fewer pixels in the room, its shadows redrawn a few times a second rather than every frame.
    if (innerWidth <= 760 || innerHeight <= 480) {
      phoneRatio ||= r.getPixelRatio();
      r.setPixelRatio(Math.min(1.25, phoneRatio));
      r.shadowMap.autoUpdate = false;
      r.shadowMap.needsUpdate = true;
    }
    r.toneMapping = ACESFilmicToneMapping;
    r.toneMappingExposure = 1.35;
    s.scene.background = new Color(0x080503);
    s.scene.fog = new Fog(0x0b0705, 6.5, 15);
    const w = new Group();
    s.root.add(w);
    world = w;
    roomKind = indoor ? "in" : "out";

    // Room.
    w.add(M.floorAndCeiling(indoor));
    const back = M.paintingWall(indoor ? 5.4 : 11, indoor ? 3.04 : 6.2);
    if (indoor) {
      back.position.set(0, 1.62, -1.95);
      w.add(M.pillars());
      w.add(M.bookcaseWall(-1, 11), M.bookcaseWall(1, 29));
    } else {
      back.position.set(0, 2.3, -4.6);
      (back.material as MeshStandardMaterial).emissiveIntensity = 0.5;
      w.add(M.stallFrame());
      w.add(M.crateStack(-1, 13), M.crateStack(1, 41));
    }
    w.add(back);
    w.add(M.counter());

    // Light: the hanging lamp (the one shadow-casting light), a warm fill from the shop floor, a rim behind the people.
    const lampG = M.lamp();
    place(lampG, -0.3, 2.78, 0.5);
    w.add(lampG);
    const lamp = new PointLight(0xffc27a, 26, 0, 1.6);
    lamp.position.set(-0.3, 2.58, 0.5);
    lamp.castShadow = true;
    const small = Math.min(innerWidth, innerHeight) < 600;
    lamp.shadow.mapSize.set(small ? 512 : 1024, small ? 512 : 1024);
    lamp.shadow.bias = -0.004;
    lamp.shadow.radius = 5;
    lamp.shadow.camera.near = 0.1;
    lamp.shadow.camera.far = 12;
    w.add(lamp);
    const hemi = new HemisphereLight(0xffdcb0, 0x1c0e06, 0.55);
    w.add(hemi);
    const front = new PointLight(0xffb070, 7, 0, 1.6);
    front.position.set(2.4, 2.2, 2.8);
    w.add(front);
    const rim = new PointLight(0xffa860, 5, 0, 1.6);
    rim.position.set(0.4, 2.7, -1.3);
    w.add(rim);

    // Props.
    const easel = M.easel();
    place(easel.group, -1.58, M.TOP, 0.32, 0.55);
    w.add(easel.group);
    const cardsAnchor = new Group();
    cardsAnchor.position.set(0.24, 0, 0.46);
    easel.group.add(cardsAnchor);
    const cards = new Group();
    cardsAnchor.add(cards);
    const register = M.register();
    place(register.group, 1.42, M.TOP, 0.16, -0.45);
    register.group.scale.setScalar(0.8);
    w.add(register.group);
    const tea = M.teacup();
    place(tea.group, -0.55, M.TOP, 0.78, 0.3);
    w.add(tea.group);
    const hour = M.hourglass();
    place(hour.group, 0.48, M.TOP, 0.86, -0.2);
    hour.group.scale.setScalar(0.85);
    w.add(hour.group);
    const dagger = M.dagger();
    place(dagger.group, 0.95, M.TOP, 0.86, -0.15);
    w.add(dagger.group);
    const lantern = M.lanternModel();
    place(lantern.group, 2.0, M.TOP, 0.1, 0.4);
    lantern.group.scale.setScalar(1.3);
    w.add(lantern.group);
    const flame = new PointLight(0xffb050, 0, 2.5, 2);
    flame.position.set(2.0, M.TOP + 0.17, 0.1);
    w.add(flame);
    const cls = M.bookModel(0x1f3a24, "Classes");
    place(cls, 1.88, M.TOP + 0.042, 0.84, -0.22);
    const jour = M.bookModel(0x6a1810, "Journal");
    place(jour, 1.86, M.TOP + 0.13, 0.82, -0.06);
    jour.scale.setScalar(0.92);
    w.add(cls, jour);
    const globe = M.globe();
    place(globe.group, -1.95, M.TOP, 0.58, 0);
    w.add(globe.group);
    const clock = M.clockModel();
    if (indoor) place(clock.group, -1.12, 2.5, -1.86);
    else place(clock.group, -2.6, 2.1, -0.08);
    w.add(clock.group);
    const extras = new Group();
    w.add(extras);
    const people = new Group();
    w.add(people);

    // Dust motes drifting in the lamp's light.
    const r0 = rng(5);
    const pos: number[] = [];
    for (let i = 0; i < 90; i++) pos.push(-1.6 + r0() * 3, 1.2 + r0() * 1.6, -0.8 + r0() * 1.8);
    const mg = new BufferGeometry();
    mg.setAttribute("position", new Float32BufferAttribute(pos, 3));
    const motes = new Points(mg, new PointsMaterial({ color: 0xffe2a0, size: 0.012, transparent: true, opacity: 0.55, depthWrite: false, blending: AdditiveBlending }));
    w.add(motes);

    squeeze = [easel.group, register.group, tea.group, hour.group, dagger.group, lantern.group, flame, cls, jour, globe.group];
    for (const o of squeeze) o.userData.bx = o.position.x;
    parts = { back, easel, register, tea, hour, dagger, lantern, jour, cls, globe, clock, spools: new Group(), spoolKey: "", lamp, flame, people, peopleKey: "", cards, cardsKey: "", extras, extrasKey: "", motes, cardsAnchor, lampG, fill: { hemi, front, rim } };
    encParts?.casters.dispose();
    encParts = null;
    w.add(parts.spools);
    gen = s.generation;
  }

  /* ---------------- An encounter staged in the shop ---------------- */
  // A fight: the counter is cleared and becomes a little theatre's stage, footlights along its front edge; the
  // battle (stage/themes/diorama) stands its paper figures on it and the room throws their shadows. A talk: the
  // person you talk to stands behind the counter, framed close; the till rings up the running offer.
  let enc: EncounterView | null = null;
  let encParts: { group: Group; foot: Footlights; casters: Casters; guest: Group; guestKey: string; guestX: number; prosc: Group } | null = null;
  const encCam = new PerspectiveCamera();
  let encPose: Pose | null = null;
  let encPoseKey = "";
  let parleyVer = -1;
  let shakeSeen = 0;

  function stageAspect(): number {
    const b = stageEl.getBoundingClientRect();
    return Math.max(0.3, b.width / Math.max(1, b.height));
  }
  /** The framing for the encounter at the current screen shape (cached), and the counter band the battle reads. */
  function encFraming(): Pose | null {
    if (!enc) return null;
    const aspect = stageAspect();
    const key = `${enc.kind}|${aspect.toFixed(3)}`;
    if (key !== encPoseKey || !encPose) {
      encPoseKey = key;
      encPose = enc.kind === "battle" ? battlePose(aspect) : parleyPose(aspect, aspect >= 0.95 && stageEl.clientHeight < 320);
      poseCamera(encCam, encPose, aspect);
      if (enc.kind === "battle") board().band = measureBand(encCam, aspect, -1.42, 1.32);
      if (encParts) encParts.guestX = guestX(aspect);
      // The screen changed shape: re-place the backcloth and the props for the new framing.
      queueMicrotask(() => {
        applyEnc();
        syncGuest();
      });
    } else poseCamera(encCam, encPose, aspect);
    return encPose;
  }
  /** Where the person stands in a talk: a little left of centre (the till and the hourglass flank them). */
  function guestX(aspect: number): number {
    if (aspect < 0.95) return 0;
    const p = toWorld(encCam, 0.45, 0.45, { z: -0.5 });
    return p ? Math.max(-1.6, Math.min(0.6, p.x)) : -0.6;
  }

  function ensureEncParts(): void {
    if (encParts || !world || !parts) return;
    const g = new Group();
    const small = Math.min(innerWidth, innerHeight) < 600;
    const foot = footlights(7, 1.55, small);
    g.add(foot.group);
    const casters = new Casters();
    g.add(casters.group);
    const guest = new Group();
    g.add(guest);
    const prosc = proscenium(roomKind === "in");
    g.add(prosc);
    world.add(g);
    encParts = { group: g, foot, casters, guest, guestKey: "", guestX: -0.6, prosc };
    encPoseKey = "";
  }

  /** Show, hide and move the shop's things for the encounter (after every render, which shows them again). */
  function applyEnc(): void {
    if (!parts) return;
    const P = parts;
    const on = !!enc;
    dr.classList.toggle("enc", on);
    dr.dataset.enc = enc?.kind ?? "";
    const E0 = encParts;
    if (!on) {
      if (encParts) encParts.group.visible = false;
      P.people.visible = true;
      for (const o of [P.easel.group, P.register.group, P.hour.group]) delete o.userData.ex;
      if (P.hour.group.userData.hz !== undefined) P.hour.group.position.z = P.hour.group.userData.hz as number;
      P.register.group.scale.setScalar(0.8);
      P.hour.group.scale.setScalar(0.85);
      P.easel.group.visible = P.register.group.visible = true;
      if (E0) E0.prosc.visible = false;
      P.fill.hemi.intensity = 0.55;
      P.lamp.castShadow = true;
      P.lampG.position.y = 2.78;
      P.fill.front.intensity = 7;
      P.fill.rim.intensity = 5;
      (P.back.material as MeshStandardMaterial).emissiveIntensity = roomKind === "in" ? 0.28 : 0.5;
      const home = P.back.userData.home as { p: Vector3; s: number } | undefined;
      if (home) {
        P.back.position.copy(home.p);
        P.back.scale.setScalar(home.s);
        delete P.back.userData.home;
      }
      encPlate.hidden = true;
      return;
    }
    ensureEncParts();
    const E = encParts!;
    E.group.visible = true;
    const battle = enc!.kind === "battle";
    E.foot.group.visible = battle;
    E.casters.group.visible = battle;
    E.guest.visible = !battle;
    E.prosc.visible = battle;
    if (battle) {
      // The valance hangs just inside the top of the frame.
      const top = toWorld(encCam, 0.5, 0.0, { z: -0.3 });
      const val = E.prosc.userData.valance as Group;
      if (top) val.position.y = Math.max(M.TOP + 1.2, top.y - 0.02);
    }
    P.people.visible = false;
    // Clear the middle of the counter: the small props go, the easel and the till are pushed to the ends.
    for (const o of [P.tea.group, P.hour.group, P.dagger.group, P.globe.group, P.extras, P.cardsAnchor]) o.visible = false;
    for (const o of [P.lantern.group, P.jour, P.cls]) o.visible = !battle;
    if (battle) P.flame.intensity = 0;
    // A fight clears the counter to the wings; in a talk the till stands at the person's elbow ringing up the
    // running offer, the hourglass at the other runs with their patience, the easel beyond it.
    P.easel.group.visible = P.register.group.visible = !battle;
    // A narrow screen keeps the till and the hourglass in frame, tucked in at the person's elbows.
    const portrait = stageAspect() < 0.95;
    const edgeX = (sx: number) => toWorld(encCam, sx, 0.3, { z: -0.3 })?.x;
    const lo = portrait ? edgeX(0.14) : undefined;
    const hi = portrait ? edgeX(0.84) : undefined;
    P.easel.group.userData.ex = E.guestX - 1.62;
    P.register.group.userData.ex = hi === undefined ? E.guestX + 0.95 : Math.min(E.guestX + 0.95, hi);
    P.register.group.scale.setScalar(portrait ? 0.5 : 0.66);
    P.spools.visible = false;
    // In a fight the place's painting comes forward as the little theatre's backcloth, just behind the counter,
    // so the footlights throw the figures' shadows up it.
    P.back.userData.home ??= { p: P.back.position.clone(), s: P.back.scale.x };
    const home = P.back.userData.home as { p: Vector3; s: number };
    // The fight is lit by the footlights: the room's fills drop so the shadows they throw read.
    P.fill.hemi.intensity = battle ? 0.32 : 0.55;
    P.lamp.castShadow = !battle;
    // The lamp's shade would hang into the turn-order bunting: in a fight it is drawn up out of the frame.
    P.lampG.position.y = battle ? 3.6 : 2.78;
    P.fill.front.intensity = battle ? 1.5 : 7;
    P.fill.rim.intensity = battle ? 1 : 5;
    (P.back.material as MeshStandardMaterial).emissiveIntensity = battle ? 0.1 : roomKind === "in" ? 0.28 : 0.5;
    // Inside the proscenium's opening only; the room's own wings frame it. In a talk outdoors it hangs a little
    // behind the person (the stall's far view would show the bare floor over the counter); indoors the shop's
    // own back wall stays.
    if (battle || roomKind === "out") {
      const bw = (P.back.geometry as PlaneGeometry).parameters.width;
      const k = (battle ? 5.0 : 6.4) / bw;
      P.back.scale.setScalar(k);
      const bh = (P.back.geometry as PlaneGeometry).parameters.height * k;
      P.back.position.set(0, M.TOP - (battle ? 0.15 : 1.0) + bh / 2, battle ? -0.42 : -1.45);
    } else {
      P.back.position.copy(home.p);
      P.back.scale.setScalar(home.s);
    }
    if (!battle) {
      const pl = board().parley;
      // The hourglass at their elbow runs with their patience.
      if (pl.patienceMax > 0) {
        const sand = pl.patience / pl.patienceMax;
        P.hour.group.visible = true;
        P.hour.group.userData.ex = lo === undefined ? E.guestX - 0.8 : Math.max(E.guestX - 0.8, lo);
        P.hour.group.scale.setScalar(portrait ? 1.1 : 1.3);
        // Back beside them on the counter top (its home is the counter's front edge, under the talk's plaque).
        P.hour.group.userData.hz ??= P.hour.group.position.z;
        P.hour.group.position.z = 0.2;
        P.hour.top.scale.set(0.3 + sand * 0.7, 0.2 + sand * 0.8, 0.3 + sand * 0.7);
        P.hour.bottom.scale.set(0.4 + (1 - sand) * 0.6, 0.15 + (1 - sand) * 0.85, 0.4 + (1 - sand) * 0.6);
        // Its base reads PATIENCE and a row of brass pips, one lit per patience left; four times round the
        // ring so one copy always faces the camera whole.
        const left = pl.patience;
        const max = pl.patienceMax;
        M.redraw(P.hour.base, (g, w, h) => {
          g.fillStyle = "#3a200d";
          g.fillRect(0, 0, w, h);
          g.textAlign = "center";
          g.textBaseline = "middle";
          const q = w / 4;
          let size = 30;
          g.font = `800 ${size}px 'Gambit Cinzel', Georgia, serif`;
          const tw = g.measureText("PATIENCE").width;
          const pr = Math.min(h * 0.16, (q * 0.42) / Math.max(1, max) / 2.4);
          const need = tw + 14 + max * pr * 2.4;
          if (need > q * 0.92) {
            size = Math.floor((size * q * 0.92) / need);
            g.font = `800 ${size}px 'Gambit Cinzel', Georgia, serif`;
          }
          const tw2 = g.measureText("PATIENCE").width;
          const pw = max * pr * 2.4;
          for (let k = 0; k < 4; k++) {
            const x0 = (k + 0.5) * q - (tw2 + 14 + pw) / 2;
            g.fillStyle = "#e8c27a";
            g.fillText("PATIENCE", x0 + tw2 / 2, h * 0.55);
            for (let i = 0; i < max; i++) {
              const cx = x0 + tw2 + 14 + pr * 1.2 + i * pr * 2.4;
              g.beginPath();
              g.arc(cx, h * 0.55, pr, 0, Math.PI * 2);
              g.fillStyle = i < left ? "#ffd86a" : "#1a0c04";
              g.fill();
              g.lineWidth = 2;
              g.strokeStyle = "#c8963e";
              g.stroke();
            }
          }
        });
      }
      const n = pl.offer ? Number(/-?\d+/.exec(pl.offer)?.[0] ?? NaN) : NaN;
      if (Number.isFinite(n)) flags(P.register.flags, n, (pl.unit ?? "").trim() || "offer");
      // The till's brass plate names the stake.
      if (pl.label) inked(P.register.plate, [{ text: pl.label.toUpperCase(), font: "800 44px 'Gambit Cinzel', Georgia, serif", color: "#261505", y: 0.55 }], "#c8963e");
    }
  }

  /** The person you talk to, as a lit cut-out (or a framed standee) behind the counter. */
  function syncGuest(): void {
    const pe = enc;
    if (!encParts || !pe || pe.kind !== "parley" || !st || !last) return;
    const E = encParts;
    const pl = board().parley;
    const known = pe.personId ? ctx.people(last).find((p) => p.id === pe.personId) : undefined;
    let url: string | null = null;
    let cutout = true;
    if (known) {
      const a = ctx.personArt(last, known.id);
      if (a) {
        cutout = a.cutout && !a.keyed;
        url = cutout ? cleanCutout(a.url, () => !destroyed && ctx.rerender()) : a.source;
      }
    }
    if (!url && pl.url) {
      url = pl.url;
      cutout = !pl.framed;
    }
    if (!url && pe.art) url = ctx.art(pe.art);
    const key = `${url ?? ""}|${cutout}|${E.guestX.toFixed(2)}`;
    if (key === E.guestKey) return;
    E.guestKey = key;
    for (const c of [...E.guest.children]) {
      E.guest.remove(c);
      c.traverse((o) => {
        const m = o as Mesh;
        m.geometry?.dispose();
        (m.material as MeshStandardMaterial | undefined)?.dispose?.();
      });
    }
    const x = E.guestX;
    const z = -0.5;
    if (url && !cutout) {
      const sd = M.standee(0.72);
      sd.group.scale.setScalar(1.08);
      sd.group.position.set(x, 1.6, z + 0.1);
      E.guest.add(sd.group);
      loaded.delete("guest");
      paint(sd.face, url, 0.72, "guest");
      return;
    }
    const h = 1.5;
    const plane = new Mesh(new PlaneGeometry(1, 1), new MeshStandardMaterial({ color: url ? 0xffffff : 0x1a0f08, roughness: 0.75, alphaTest: 0.5, shadowSide: DoubleSide }));
    plane.material.userData.ownEmissive = false;
    plane.scale.set(h * 0.62, h, 1);
    plane.position.set(x, 2.0 - h / 2, z);
    plane.castShadow = true;
    plane.receiveShadow = true;
    E.guest.add(plane);
    {
      // Nobody drawn yet (or the picture still loading): a dark card silhouette holds the place.
      const t = M.drawnTex(256, 400, (g, w, hh) => {
        g.fillStyle = "#2a170b";
        g.beginPath();
        g.ellipse(w / 2, hh * 0.2, w * 0.17, hh * 0.13, 0, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.moveTo(w * 0.1, hh);
        g.bezierCurveTo(w * 0.1, hh * 0.55, w * 0.25, hh * 0.38, w / 2, hh * 0.36);
        g.bezierCurveTo(w * 0.75, hh * 0.38, w * 0.9, hh * 0.55, w * 0.9, hh);
        g.fill();
      });
      dynTex.add(t);
      plane.material.map = t;
      plane.material.color.setHex(0xffffff);
      plane.material.needsUpdate = true;
      if (!url) return;
    }
    const g0 = gen;
    void st.texture(url).then((tx) => {
      if (!tx || destroyed || g0 !== gen || !plane.parent) return;
      const img = tx.image as { width: number; height: number };
      plane.scale.set((h * img.width) / Math.max(1, img.height), h, 1);
      plane.material.map = tx;
      plane.material.needsUpdate = true;
      plane.customDistanceMaterial = new MeshDistanceMaterial({ map: tx, alphaTest: 0.5 });
      puppets.warp(plane, tx.image as HTMLImageElement);
    });
  }

  /** Per frame while an encounter is staged: footlights, the enemies' shadows, the guest, the nameplate. */
  function encFrame(t: number): void {
    if (!enc || !encParts || !parts || !st) return;
    const E = encParts;
    const s = t / 1000;
    const still = ctx.reducedMotion;
    const bd = board();
    if (enc.kind === "battle") {
      E.casters.sync(bd.enemies, encCam, stageAspect());
      const any = bd.enemies.some((m) => m.alive);
      E.foot.light.intensity = (any ? 16 : 9) * (still ? 1 : 1 + Math.sin(s * 11) * 0.04 + Math.sin(s * 6.1) * 0.03);
      // A footlight under a figure's base would burn through it: those step aside (go dark).
      E.foot.flames.forEach((f) => {
        const unit = f.parent!;
        unit.getWorldPosition(tmp);
        tmp.project(encCam);
        const sx = (tmp.x + 1) / 2;
        unit.visible = !bd.enemies.some((m) => m.alive && Math.abs(m.x - sx) < 0.085);
      });
      E.foot.flames.forEach((f, i) => {
        const k = still ? 1 : 1 + Math.sin(s * (9 + i) + i * 1.7) * 0.12;
        f.scale.set(1, k, 1);
        E.foot.glows[i]!.lookAt(st!.camera.position);
        E.foot.glows[i]!.scale.setScalar(0.9 + (k - 1) * 1.5);
      });
      // A blow makes the lamp swing on its chain.
      if (bd.shake > shakeSeen) shakeSeen = bd.shake;
      const since = performance.now() / 1000 - shakeSeen;
      const amp = still || since > 3 ? 0 : 0.09 * Math.exp(-since * 1.6);
      parts.lampG.rotation.z = Math.sin(since * 7) * amp;
      parts.lampG.rotation.x = Math.cos(since * 5.3) * amp * 0.5;
      encPlate.hidden = true;
      return;
    }
    if (bd.parley.ver !== parleyVer) {
      parleyVer = bd.parley.ver;
      applyEnc();
      syncGuest();
    }
    // The brass nameplate on the counter's back edge in front of them: who, and what the talk is about.
    const pe = enc;
    const name = pe.name;
    const role = (last && pe.personId ? ctx.people(last).find((p) => p.id === pe.personId)?.role : undefined) ?? bd.parley.role ?? "";
    const sub = bd.parley.title || role;
    const b = encPlate.querySelector("b")!;
    if (b.textContent !== name) b.textContent = name;
    const sm = encPlate.querySelector("small")!;
    if (sm.textContent !== sub) sm.textContent = sub;
    encPlate.hidden = false;
    tmp.set(E.guestX, M.TOP + 0.03, 0.02).project(st.camera);
    const bb = stageEl.getBoundingClientRect();
    encPlate.style.transform = `translate(${(((tmp.x + 1) / 2) * bb.width).toFixed(1)}px, ${(((1 - tmp.y) / 2) * bb.height).toFixed(1)}px) translate(-50%, -100%)`;
  }

  function stageEncounter(e: EncounterView | null): boolean {
    if (destroyed) return false;
    if (!e) {
      if (!enc) return false;
      enc = null;
      board().staged = null;
      board().band = null;
      encPose = null;
      applyEnc();
      if (last && active) render(last);
      return false;
    }
    if (!active || !ctx.has3d) return false;
    enc = e;
    unzoom();
    pickOpen = false;
    logOpen = false;
    hovered = null;
    board().staged = e.kind;
    parleyVer = -1;
    if (encParts) encParts.guestKey = "";
    if (last) render(last);
    ensureEncParts();
    encPoseKey = "";
    encFraming();
    if (encParts) encParts.guestX = guestX(stageAspect());
    applyEnc();
    syncGuest();
    return true;
  }

  /* ---------------- Interactive items ---------------- */
  function item(key: string, obj: Object3D, anchor: [number, number, number], label: string, zoom: boolean, opts: { run?: () => void; panel?: () => string; dist?: number; ring?: number; focus?: [number, number, number] } = {}): void {
    let it = items.get(key);
    if (!it || it.obj !== obj) {
      let ring: Mesh | null = null;
      if (opts.ring && obj.parent) {
        ring = M.glowRing(opts.ring);
        ring.position.set(0, 0.004, 0);
        obj.add(ring);
      }
      obj.traverse((o) => (o.userData.item = key));
      it = { key, obj, anchor: new Vector3(...anchor), focus: new Vector3(...(opts.focus ?? anchor)), label, zoom, dist: opts.dist ?? 0.9, ring, baseY: obj.position.y, hot: 0 };
      items.set(key, it);
    }
    it.label = label;
    it.zoom = zoom;
    it.run = opts.run;
    it.panel = opts.panel;
    obj.visible = true;
  }
  function drop(key: string): void {
    const it = items.get(key);
    if (!it) return;
    it.obj.visible = false;
    items.delete(key);
  }

  /* ---------------- Camera ---------------- */
  const cam = { pos: new Vector3(0, 1.85, 3.4), target: new Vector3(0, 1.3, -0.3), goalPos: new Vector3(), goalTarget: new Vector3() };
  let zoomKey: string | null = null;
  let zoomAfter: (() => void) | null = null;
  let zoomAt = 0;
  function basePose(): { pos: Vector3; target: Vector3; fov: number } {
    const b = stageEl.getBoundingClientRect();
    const aspect = Math.max(0.3, b.width / Math.max(1, b.height));
    if (aspect < 0.8) return { pos: new Vector3(0, 2.75, 4.6), target: new Vector3(0, 1.38, -0.3), fov: 2 * Math.atan(0.27 / aspect) * (180 / Math.PI) };
    const want = Math.tan((76 / 2) * (Math.PI / 180));
    const fov = Math.max(37, Math.min(62, 2 * Math.atan(want / aspect) * (180 / Math.PI)));
    return { pos: new Vector3(0, 1.88, 3.45), target: new Vector3(0, 1.32, -0.35), fov };
  }
  function zoomTo(it: Item, after?: () => void): void {
    zoomKey = it.key;
    zoomAfter = after ?? null;
    zoomAt = performance.now();
    const p = new Vector3();
    it.obj.localToWorld(p.copy(it.focus));
    const bp = basePose();
    const dir = bp.pos.clone().sub(p).setY(0).normalize();
    cam.goalTarget.copy(p);
    cam.goalPos.copy(p).addScaledVector(dir, it.dist).add(new Vector3(0, it.dist * 0.42, 0));
    showPanel(true);
  }
  function unzoom(): void {
    if (!zoomKey) return;
    zoomKey = null;
    zoomAfter = null;
    panelEl.hidden = true;
    panelEl.innerHTML = "";
  }
  function showPanel(focus = false): void {
    const it = zoomKey ? items.get(zoomKey) : null;
    if (!it || !it.panel) {
      panelEl.hidden = true;
      return;
    }
    panelEl.hidden = false;
    const wp = new Vector3();
    it.obj.getWorldPosition(wp);
    panelEl.classList.toggle("pl", wp.x > 0);
    panelEl.classList.toggle("pr", wp.x <= 0);
    panelEl.innerHTML = `${it.panel()}<button class="pb back" data-act="back">Back</button>`;
    if (focus) panelEl.querySelector<HTMLElement>("button:not(.back)")?.focus({ preventScroll: true });
    if (last?.hex) {
      const svg = panelEl.querySelector<SVGSVGElement>(".hexsvg");
      if (svg) ctx.drawHex(svg, last);
    }
  }

  /* ---------------- Input ---------------- */
  let acts = new Map<string, () => void>();
  let hovered: string | null = null;
  function activate(key: string): void {
    const it = items.get(key);
    if (!it) return;
    if (!it.zoom) {
      it.run?.();
      return;
    }
    zoomTo(it, it.run);
  }
  const fire = (key: string) => {
    if (key === "log") {
      logOpen = !logOpen;
      if (last) render(last);
      return;
    }
    if (key === "globe") {
      pickOpen = !pickOpen;
      if (last) render(last);
      return;
    }
    if (key === "back") return unzoom();
    if (key.startsWith("theme:")) {
      pickOpen = false;
      ctx.setTheme(key.slice(6) as never);
      return;
    }
    if (key.startsWith("i:")) return activate(key.slice(2));
    const a = acts.get(key);
    if (a) {
      unzoom();
      a();
    }
  };
  const onClick = (e: MouseEvent) => {
    if (enc) return;
    const t = (e.target as Element).closest<HTMLElement | SVGElement>("[data-act]");
    if (t && dr.contains(t)) {
      e.preventDefault();
      fire(t.dataset.act!);
      return;
    }
    if ((e.target as Element).closest(".panel, .say, .phacts, .ovl, .fg")) return;
    if (pickOpen) {
      pickOpen = false;
      if (last) render(last);
    }
    const hit = st?.pick(e.clientX, e.clientY, [...items.values()].filter((i) => i.obj.visible).map((i) => i.obj));
    const key = hit?.object.userData.item as string | undefined;
    if (key && key !== zoomKey) activate(key);
    else if (!key) unzoom();
  };
  let moveAt = 0;
  const onMove = (e: PointerEvent) => {
    if (!st || e.pointerType === "touch" || enc) return;
    const now = performance.now();
    if (now - moveAt < 60) return;
    moveAt = now;
    if ((e.target as Element).closest(".panel, .say, .phacts, .ovl, .labels button")) return;
    const hit = st.pick(e.clientX, e.clientY, [...items.values()].filter((i) => i.obj.visible).map((i) => i.obj));
    hovered = (hit?.object.userData.item as string | undefined) ?? null;
    dr.style.cursor = hovered ? "pointer" : "";
  };
  const onFocus = (e: FocusEvent) => {
    const k = (e.target as HTMLElement).dataset?.act;
    hovered = k?.startsWith("i:") ? k.slice(2) : null;
  };
  dr.addEventListener("click", onClick);
  dr.addEventListener("pointermove", onMove);
  dr.addEventListener("focusin", onFocus);

  /* ---------------- Per frame ---------------- */
  const tmp = new Vector3();
  const labelEls = new Map<string, HTMLElement>();
  function frame(t: number, dt: number): void {
    if (!st || !parts) return;
    // In a fight the figures' shadows on the backcloth are part of the show: four times a second; otherwise once.
    if (phoneRatio && t - shadowAt > (enc?.kind === "battle" ? 250 : 1000)) {
      shadowAt = t;
      st.renderer.shadowMap.needsUpdate = true;
    }
    puppets.tick(t, Math.min(0.1, dt));
    const camera = st.camera;
    const bp = basePose();
    if (!enc && Math.abs(camera.fov - bp.fov) > 0.01) {
      camera.fov = bp.fov;
      camera.updateProjectionMatrix();
    }
    const kx = stageEl.clientWidth / Math.max(1, stageEl.clientHeight) < 0.8 ? 0.6 : 1;
    for (const o of squeeze) o.position.x = (o.userData.ex ?? o.userData.bx) * (o.userData.ex === undefined ? kx : 1);
    const ep = encFraming();
    if (ep && Math.abs(camera.fov - ep.fov) > 0.01) {
      camera.fov = ep.fov;
      camera.updateProjectionMatrix();
    }
    const still = ctx.reducedMotion;
    const p = ctx.pointer();
    const lean = ep ? (enc?.kind === "battle" ? 0.08 : 0.25) : zoomKey ? 0.04 : 1;
    const gp = ep ? ep.pos : zoomKey ? cam.goalPos : bp.pos;
    const gt = ep ? ep.target : zoomKey ? cam.goalTarget : bp.target;
    const breathe = still ? 0 : Math.sin(t * 0.0004) * 0.03;
    const goal = tmp.set(gp.x + p.x * 0.32 * lean, gp.y - p.y * 0.12 * lean + breathe, gp.z);
    const k = 1 - Math.exp(-dt * (still ? 30 : 5.5));
    cam.pos.lerp(goal, k);
    cam.target.lerp(gt, k);
    camera.position.copy(cam.pos);
    camera.lookAt(cam.target);
    if (zoomAfter && performance.now() - zoomAt > 650) {
      const f = zoomAfter;
      zoomAfter = null;
      f();
    }
    // Flicker, pendulum, steam, motes.
    if (!still) {
      const s = t / 1000;
      parts.lamp.intensity = (enc?.kind === "battle" ? 9 : 26) * (1 + Math.sin(s * 13) * 0.025 + Math.sin(s * 7.3) * 0.02);
      if (parts.flame.intensity > 0) parts.flame.intensity = 1.6 * (1 + Math.sin(s * 17) * 0.15 + Math.sin(s * 9) * 0.1);
      parts.clock.pendulum.rotation.z = Math.sin(s * Math.PI) * 0.18;
      parts.tea.steam.forEach((m, i) => {
        const ph = (s * 0.35 + i / 3) % 1;
        m.position.y = 0.2 + ph * 0.22;
        (m.material as { opacity: number }).opacity = Math.sin(ph * Math.PI) * 0.9;
        m.lookAt(camera.position);
      });
      const arr = parts.motes.geometry.getAttribute("position");
      for (let i = 0; i < arr.count; i++) {
        let y = arr.getY(i) + dt * 0.03;
        if (y > 2.8) y = 1.2;
        arr.setY(i, y);
        arr.setX(i, arr.getX(i) + Math.sin(s * 0.3 + i) * dt * 0.01);
      }
      arr.needsUpdate = true;
    }
    // Hover: lift and light the ring.
    for (const it of items.values()) {
      const want = hovered === it.key || zoomKey === it.key ? 1 : 0;
      it.hot += (want - it.hot) * Math.min(1, dt * 10);
      it.obj.position.y = it.baseY + it.hot * 0.025;
      if (it.ring) (it.ring.material as { opacity: number }).opacity = 0.32 + it.hot * 0.68;
      it.obj.traverse((o) => {
        const m = (o as Mesh).material as MeshStandardMaterial | undefined;
        if (m && "emissive" in m && !m.emissiveMap && !m.userData.ownEmissive) {
          m.userData.base ??= { c: m.emissive.getHex(), i: m.emissiveIntensity };
          if (it.hot > 0.01) {
            m.emissive.setHex(0xffb030);
            m.emissiveIntensity = it.hot * 0.28;
          } else {
            m.emissive.setHex(m.userData.base.c);
            m.emissiveIntensity = m.userData.base.i;
          }
        }
      });
    }
    encFrame(t);
    // Labels follow their objects on screen.
    const b = stageEl.getBoundingClientRect();
    for (const [key, el] of labelEls) {
      const it = items.get(key);
      if (!it || !it.obj.visible || zoomKey) {
        el.style.visibility = "hidden";
        continue;
      }
      it.obj.localToWorld(tmp.copy(it.anchor));
      tmp.project(camera);
      if (tmp.z > 1) {
        el.style.visibility = "hidden";
        continue;
      }
      el.style.visibility = "";
      el.style.transform = `translate(${(((tmp.x + 1) / 2) * b.width).toFixed(1)}px, ${(((1 - tmp.y) / 2) * b.height).toFixed(1)}px) translate(-50%, 0)`;
      el.classList.toggle("hot", it.hot > 0.5);
    }
  }

  /* ---------------- Data → scene ---------------- */
  function flags(t: CanvasTexture, coin: number, currency: string): void {
    M.redraw(t, (g, w, h) => {
      g.fillStyle = "#120a04";
      g.fillRect(0, 0, w, h);
      const d = String(Math.max(0, Math.min(999999, Math.round(coin))));
      const fw = Math.min(70, (w - 40) / d.length - 8);
      const x0 = w / 2 - (d.length * (fw + 8)) / 2;
      [...d].forEach((ch, i) => {
        const x = x0 + i * (fw + 8);
        const gr = g.createLinearGradient(0, 20, 0, 150);
        gr.addColorStop(0, "#fff8e4");
        gr.addColorStop(1, "#d9c79c");
        g.fillStyle = gr;
        g.fillRect(x, 18, fw, 120);
        g.fillStyle = "rgba(0,0,0,.2)";
        g.fillRect(x, 18, fw, 18);
        g.fillStyle = "#3a1a08";
        g.font = `800 ${Math.round(fw * 1.2)}px 'Gambit Cinzel', Georgia, serif`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(ch, x + fw / 2, 84);
      });
      g.fillStyle = "#e9c77a";
      g.font = "600 26px 'Gambit Cinzel', Georgia, serif";
      g.textAlign = "center";
      g.fillText(currency.toUpperCase().slice(0, 16), w / 2, 172);
    });
  }
  function inked(t: CanvasTexture, lines: { text: string; font: string; color: string; y: number }[], bg: string | null): void {
    M.redraw(t, (g, w, h) => {
      if (bg) {
        g.fillStyle = bg;
        g.fillRect(0, 0, w, h);
      }
      g.textAlign = "center";
      g.textBaseline = "middle";
      for (const l of lines) {
        g.font = l.font;
        g.fillStyle = l.color;
        let size = parseInt(/(\d+)px/.exec(l.font)?.[1] ?? "40", 10);
        while (g.measureText(l.text).width > w * 0.9 && size > 12) {
          size -= 2;
          g.font = l.font.replace(/\d+px/, `${size}px`);
        }
        g.fillText(l.text, w / 2, l.y * h);
      }
    });
  }
  function clockFace(t: CanvasTexture, time: string): void {
    const [hh, mm] = HANDS[time] ?? [12, 0];
    M.redraw(t, (g, w) => {
      const c = w / 2;
      g.fillStyle = "#f6ecd2";
      g.beginPath();
      g.arc(c, c, c, 0, Math.PI * 2);
      g.fill();
      // The day/night window.
      const sky = g.createLinearGradient(0, c * 0.35, 0, c * 0.8);
      const night = time === "night" || time === "evening";
      sky.addColorStop(0, night ? "#0d1530" : "#7fb2d8");
      sky.addColorStop(1, night ? (time === "evening" ? "#d0704a" : "#2c3462") : "#f2d9a0");
      g.fillStyle = sky;
      g.beginPath();
      g.arc(c, c, c * 0.62, Math.PI * 1.15, Math.PI * 1.85);
      g.arc(c, c, c * 0.36, Math.PI * 1.85, Math.PI * 1.15, true);
      g.fill();
      g.fillStyle = night ? "#f2e6b8" : "#ffd66a";
      g.beginPath();
      g.arc(c, c * 0.5, c * 0.08, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#3a2410";
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2;
        const r0 = i % 5 ? 0.9 : 0.8;
        g.lineWidth = i % 5 ? 2 : 6;
        g.beginPath();
        g.moveTo(c + Math.sin(a) * c * r0, c - Math.cos(a) * c * r0);
        g.lineTo(c + Math.sin(a) * c * 0.96, c - Math.cos(a) * c * 0.96);
        g.stroke();
      }
      const hand = (a: number, len: number, wd: number) => {
        g.lineWidth = wd;
        g.lineCap = "round";
        g.strokeStyle = "#1d1208";
        g.beginPath();
        g.moveTo(c, c);
        g.lineTo(c + Math.sin(a) * len, c - Math.cos(a) * len);
        g.stroke();
      };
      hand(((hh % 12) + mm / 60) * (Math.PI / 6), c * 0.5, 12);
      hand(mm * (Math.PI / 30), c * 0.78, 7);
    });
  }

  /** Crop a painting to a plane's aspect (on a clone, so other users of the texture keep theirs). */
  function fitTex(src: Texture, aspect: number): Texture {
    const t = src.clone();
    const img = src.image as { width: number; height: number };
    const ia = img.width / Math.max(1, img.height);
    if (ia > aspect) {
      t.repeat.set(aspect / ia, 1);
      t.offset.set((1 - aspect / ia) / 2, 0);
    } else {
      t.repeat.set(1, ia / aspect);
      t.offset.set(0, (1 - ia / aspect) / 2);
    }
    t.needsUpdate = true;
    dynTex.add(t);
    return t;
  }
  const loaded = new Map<string, string>();
  function paint(meshObj: Mesh, url: string | null, aspect: number, slot: string): void {
    if (!st || !url || loaded.get(slot) === url) return;
    loaded.set(slot, url);
    const g0 = gen;
    void st.texture(url).then((tx) => {
      if (!tx || destroyed || g0 !== gen || loaded.get(slot) !== url) return;
      const m = meshObj.material as MeshStandardMaterial;
      m.map = fitTex(tx, aspect);
      m.emissiveMap = m.map;
      m.needsUpdate = true;
    });
  }

  function people(v: SceneView): { id: string; x: number; name: string; role: string; talk: (() => void) | null }[] {
    if (!parts || !st) return [];
    // Four fit behind the counter; anyone else is in the guest book (render: "x:others").
    const list = ctx.people(v).slice(0, BEHIND_COUNTER);
    const n = list.length;
    const xs = n === 1 ? [0.05] : n === 2 ? [-0.5, 0.55] : list.map((_, i) => -0.95 + (1.9 * i) / Math.max(1, n - 1));
    const arts = list.map((p) => ctx.personArt(v, p.id));
    const again = () => !destroyed && ctx.rerender();
    const urls = arts.map((a) => (a ? (a.cutout && !a.keyed ? cleanCutout(a.url, again) ?? "" : `src:${a.source}`) : ""));
    const key = list.map((p, i) => `${p.id}|${urls[i]}`).join(";");
    if (key !== parts.peopleKey) {
      parts.peopleKey = key;
      for (const c of [...parts.people.children]) {
        parts.people.remove(c);
        c.traverse((o) => {
          const m = o as Mesh;
          m.geometry?.dispose();
          (m.material as MeshStandardMaterial | undefined)?.dispose?.();
        });
      }
      for (const k of [...items.keys()]) if (k.startsWith("p:")) items.delete(k);
      list.forEach((p, i) => {
        const a = arts[i];
        const x = xs[i]!;
        const z = -0.5 - (i % 2) * 0.12;
        if (a && (!a.cutout || a.keyed)) {
          const sd = M.standee(0.72);
          sd.group.position.set(x, 1.53, z + 0.1);
          parts!.people.add(sd.group);
          loaded.delete(`p:${p.id}`);
          paint(sd.face, a.source, 0.72, `p:${p.id}`);
          return;
        }
        const h = n > 2 ? 1.34 : 1.42;
        const plane = new Mesh(new PlaneGeometry(1, 1), new MeshStandardMaterial({ color: a ? 0xffffff : 0x1a0f08, roughness: 0.75, alphaTest: 0.5, transparent: false }));
        plane.material.userData.ownEmissive = false;
        plane.scale.set(h * 0.68, h, 1);
        plane.position.set(x, 1.93 - h / 2, z);
        plane.castShadow = true;
        plane.receiveShadow = true;
        parts!.people.add(plane);
        const url = urls[i];
        if (a && url) {
          const g0 = gen;
          void st!.texture(url).then((tx) => {
            if (!tx || destroyed || g0 !== gen) return;
            const img = tx.image as { width: number; height: number };
            plane.scale.set((h * img.width) / Math.max(1, img.height), h, 1);
            plane.material.map = tx;
            plane.material.needsUpdate = true;
            plane.customDistanceMaterial = new MeshDistanceMaterial({ map: tx, alphaTest: 0.5 });
            puppets.warp(plane, tx.image as HTMLImageElement);
          });
        }
      });
    }
    return list.map((p, i) => ({ id: p.id, x: xs[i]!, name: p.name, role: p.role, talk: p.talkable ? p.talk : null }));
  }

  function render(v: SceneView): void {
    if (destroyed || !active) return;
    last = v;
    ctx.backdrop(v, { post: "none", custom: true });
    const s3 = ctx.stage3d();
    if (!s3) return;
    st = s3;
    const indoor = v.indoor;
    if (!parts || s3.generation !== gen || roomKind !== (indoor ? "in" : "out")) {
      loaded.clear();
      labelEls.clear();
      build(s3, indoor);
      s3.setUpdate(frame);
    }
    const P = parts!;
    acts = new Map();
    const s = ctx.status(v);
    const box = ctx.box(v);
    const menu = ctx.menu(v);
    dr.classList.toggle("busy", !!box.busy);
    const used = new Set<string>();
    const take = (pred: (m: MenuItem) => boolean): MenuItem | null => {
      const m = menu.find((x) => !used.has(x.key) && pred(x)) ?? null;
      if (m) used.add(m.key);
      return m;
    };
    const btn = (m: MenuItem) => {
      acts.set(`m:${m.key}`, m.run);
      return `<button class="pb" data-act="m:${esc(m.key)}">${esc(m.label)}</button>`;
    };

    // The place: the back wall (or the view), and the easel's painting with its brass plaque.
    const pa = ctx.placeArt(v);
    paint(P.back, pa, indoor ? 5.4 / 3.04 : 11 / 6.2, "back");
    paint(P.easel.board, pa, 0.86, "board");
    if (!P.easel.plaque.userData.tex) {
      P.easel.plaque.userData.tex = M.drawnTex(512, 72, () => {});
      (P.easel.plaque.material as MeshStandardMaterial).map = P.easel.plaque.userData.tex;
    }
    inked(P.easel.plaque.userData.tex as CanvasTexture, [{ text: s.where.toUpperCase(), font: "800 40px 'Gambit Cinzel', Georgia, serif", color: "#261505", y: 0.55 }], "#c8963e");

    // People.
    const ppl = people(v);
    for (const p of ppl) for (const m of menu) if (m.key === `talk:${p.id}`) used.add(m.key);
    const others = ctx.people(v).slice(BEHIND_COUNTER);
    const otherTalk = menu.filter((m) => others.some((o) => m.key === `talk:${o.id}`));
    for (const m of otherTalk) used.add(m.key);
    acts.set("journal", () => ctx.journal.toggle());
    acts.set("classes", () => ctx.classes.toggle());
    ppl.forEach((p) => {
      const obj = P.people.children.find((c) => Math.abs(c.position.x - p.x) < 0.01);
      if (!obj) return;
      const sy = obj.scale.y || 1;
      item(`p:${p.id}`, obj, [0, (M.TOP + 0.05 - obj.position.y) / sy, (0.05 - obj.position.z) / (obj.scale.z || 1)], p.name, false, { run: p.talk ?? undefined });
    });

    // Look around: the easel.
    const look = take((m) => m.kind === "search");
    item("easel", P.easel.group, [0, 0.02, 0.3], look ? look.label : s.where, true, {
      dist: 1.6,
      focus: [0, 0.95, 0.1],
      panel: () => `<h4>${esc(s.where)}</h4><p>${esc(box.desc)}</p>${look ? btn(look) : ""}${v.hex ? `<div class="hexwrap"><svg class="hexsvg" role="group" aria-label="The overland"></svg></div>` : ""}`,
    });
    // Postcards: the ways out.
    const exits = menu.filter((m) => !used.has(m.key) && m.kind === "exit");
    exits.forEach((m) => used.add(m.key));
    const cardsKey = exits.map((m) => `${m.key}|${m.art ?? ""}`).join(";");
    if (cardsKey !== P.cardsKey) {
      P.cardsKey = cardsKey;
      P.cards.clear();
      exits.slice(0, 5).forEach((m, i) => {
        const pc = M.postcard();
        const k = Math.min(5, exits.length);
        pc.group.position.set(-0.28 + (0.5 * i) / Math.max(1, k - 1) * (k > 1 ? 1 : 0), 0.13, 0.01 * i);
        pc.group.rotation.set(-0.18, 0, -0.18 + (0.36 * i) / Math.max(1, k - 1));
        P.cards.add(pc.group);
        {
          const words = m.label.split(/\s+/);
          const half = Math.ceil(words.length / 2);
          const rows = words.length > 2 ? [words.slice(0, half).join(" "), words.slice(half).join(" ")] : [m.label];
          const ct = M.drawnTex(256, 300, () => {});
          dynTex.add(ct);
          const fm = pc.face.material as MeshStandardMaterial;
          fm.map = ct;
          fm.needsUpdate = true;
          inked(ct, [
            { text: "POST CARD", font: "800 26px 'Gambit Cinzel', Georgia, serif", color: "#7a4a20", y: 0.18 },
            ...rows.map((t, j) => ({ text: t, font: "italic 400 40px 'Gambit Fell', Georgia, serif", color: "#2b170a", y: 0.5 + (j - (rows.length - 1) / 2) * 0.2 })),
          ], "#e9dcbc");
        }
        loaded.delete(`card:${m.key}`);
        if (m.art) paint(pc.face, m.art, 0.85, `card:${m.key}`);
      });
    }
    if (exits.length) {
      item("cards", P.cardsAnchor, [0, -0.04, 0.08], v.hex ? "The overland" : "Travel", true, {
        dist: 1.2,
        focus: [0, 0.15, 0],
        panel: () => `<h4>${v.hex ? "The overland" : "Where to?"}</h4>${v.hex ? `<div class="hexwrap"><svg class="hexsvg" role="group" aria-label="The overland"></svg></div>` : ""}<div class="trips">${exits.map((m) => {
          acts.set(`m:${m.key}`, m.run);
          return `<button class="pb trip" data-act="m:${esc(m.key)}">${m.art ? `<span class="th" style="background-image:url('${esc(m.art)}')"></span>` : ""}<span>${esc(m.label)}</span></button>`;
        }).join("")}</div>`,
      });
    } else drop("cards");

    // Tea: rest; the napkin is inked with vigor.
    const rest = take((m) => m.kind === "rest");
    const vig = Math.round(s.vigor * 100);
    const lvl = Math.max(0, Math.min(1, s.vigor));
    P.tea.tea.position.y = 0.06 + lvl * 0.075;
    P.tea.tea.scale.setScalar(0.62 + lvl * 0.38);
    P.tea.tea.visible = lvl > 0.02;
    P.tea.steam.forEach((m, i) => (m.visible = i < (lvl > 0.7 ? 3 : lvl > 0.4 ? 2 : lvl > 0.12 ? 1 : 0)));
    inked(P.tea.napkin, [{ text: `VIGOR ${vig}%`, font: "800 30px 'Gambit Cinzel', Georgia, serif", color: "#3a1a08", y: 0.84 }], "#e2d6bc");
    item("tea", P.tea.group, [0, 0.0, 0.34], rest ? rest.label : `Vigor ${vig}%`, !!rest, {
      ring: 0.22,
      dist: 0.75,
      panel: () => `<h4>A pot of tea</h4><p>Vigor ${vig}%. ${vig >= 100 ? "The party is fresh." : "A rest would do the party good."}</p>${rest ? btn(rest) : ""}`,
      run: rest ? undefined : () => {},
    });
    // Hourglass: wait; its sand is the time of day.
    const wait = take((m) => m.kind === "wait");
    if (wait) {
      const sand = { morning: 0.85, afternoon: 0.55, evening: 0.28, night: 0.06 }[s.time] ?? 0.5;
      P.hour.top.scale.set(0.3 + sand * 0.7, 0.2 + sand * 0.8, 0.3 + sand * 0.7);
      P.hour.bottom.scale.set(0.4 + (1 - sand) * 0.6, 0.15 + (1 - sand) * 0.85, 0.4 + (1 - sand) * 0.6);
      // The band wraps the base; u = 0 faces the viewer, so one WAIT is centred there (drawn split across the seam).
      M.redraw(P.hour.base, (g, w, h) => {
        g.fillStyle = "#3a200d";
        g.fillRect(0, 0, w, h);
        g.font = "800 34px 'Gambit Cinzel', Georgia, serif";
        g.fillStyle = "#e8c27a";
        g.textAlign = "center";
        g.textBaseline = "middle";
        for (const u of [0, 0.25, 0.5, 0.75, 1]) g.fillText("WAIT", u * w, h * 0.55);
      });
      item("hour", P.hour.group, [0, -0.02, 0.14], wait.label, true, { ring: 0.17, dist: 0.8, panel: () => `<h4>${esc(cap(s.time))}, day ${s.day}</h4><p>Let the sand run and the day move on.</p>${btn(wait)}` });
    } else drop("hour");
    // The bounty: a fight.
    const fight = take((m) => m.group === "fight");
    if (fight) {
      inked(P.dagger.note, [
        { text: "BOUNTY", font: "800 96px 'Gambit Cinzel', Georgia, serif", color: "#5a160c", y: 0.32 },
        { text: fight.label, font: "italic 56px 'Gambit Fell', Georgia, serif", color: "#2a1608", y: 0.68 },
      ], "#e6d4a8");
      item("fight", P.dagger.group, [0, -0.02, 0.18], fight.label, true, { ring: 0.24, dist: 0.85, panel: () => `<h4>A bounty</h4><p>Someone here is spoiling for trouble.</p>${btn(fight)}` });
    } else drop("fight");
    // The register: the purse; the drawer opens when there is a shop.
    const shop = take((m) => m.kind === "shop");
    flags(P.register.flags, s.coin, s.currency);
    inked(P.register.plate, [{ text: (shop?.label ?? "Merchant").toUpperCase(), font: "800 44px 'Gambit Cinzel', Georgia, serif", color: "#261505", y: 0.55 }], "#c8963e");
    P.register.drawer.position.z = shop ? 0.42 : 0.26;
    item("reg", P.register.group, [0, -0.03, 0.42], shop ? shop.label : `${s.coin} ${s.currency}`, true, {
      ring: 0.5,
      dist: 1.35,
      focus: [0, 0.4, 0.1],
      panel: () => `<h4>The till</h4><p>${s.coin} ${esc(s.currency)} in your purse.</p>${shop ? btn(shop) : `<p class="muted">Nothing for sale here.</p>`}`,
    });
    // Lantern: into a delve.
    const lantern = take((m) => m.kind === "delve" || m.key === "leave");
    P.flame.intensity = lantern ? 1.6 : 0;
    if (lantern) item("lantern", P.lantern.group, [0, -0.02, 0.12], lantern.label, true, { ring: 0.16, dist: 0.9, panel: () => `<h4>A lantern</h4><p>The way down is dark.</p>${btn(lantern)}` });
    else drop("lantern");
    // Books: the journal and the classes.
    item("jour", P.jour, [0, 0.2, 0.05], "Journal", true, { dist: 0.9, run: () => !ctx.journal.open && ctx.journal.toggle() });
    item("cls", P.cls, [0, -0.06, 0.2], "Classes", true, { dist: 0.9, run: () => !ctx.classes.open && ctx.classes.toggle() });
    item("globe", P.globe.group, [0, -0.02, 0.15], "Theme", false, { run: () => fire("globe") });
    if (zoomKey === "jour" && !ctx.journal.open && !zoomAfter) unzoom();
    if (zoomKey === "cls" && !ctx.classes.open && !zoomAfter) unzoom();

    // The clock: day and time.
    clockFace(P.clock.face, s.time);
    // The thread rack.
    const th = s.thread;
    const found = th ? th.found.length : 0;
    const total = th ? Math.max(th.total, found) : 0;
    const sk = `${found}/${total}`;
    if (th && sk !== P.spoolKey) {
      P.spoolKey = sk;
      P.spools.clear();
      const rack = M.spoolRack(Math.min(9, total), found);
      if (indoor) rack.position.set(1.85, 2.6, -0.9);
      else rack.position.set(1.7, 2.4, -0.3);
      P.spools.add(rack);
    }
    P.spools.visible = !!th;

    // Supplies and anything left over, along the back of the counter.
    const leftovers = menu.filter((m) => !used.has(m.key));
    const ek = `${s.supplies ? `${s.supplies.now}/${s.supplies.max}` : ""}|${leftovers.map((m) => m.key).join(",")}|${otherTalk.length ? "others" : ""}`;
    if (ek !== P.extrasKey) {
      P.extrasKey = ek;
      P.extras.clear();
      for (const k of [...items.keys()]) if (k.startsWith("x:")) items.delete(k);
      if (s.supplies) for (let i = 0; i < s.supplies.max; i++) P.extras.add(place(M.jarModel(i < s.supplies.now), -1.0 + (i % 6) * 0.11, M.TOP, 0.14 + Math.floor(i / 6) * 0.11));
      leftovers.forEach((m, i) => {
        const l = M.letterModel();
        P.extras.add(place(l, -0.2 + i * 0.32, M.TOP, 0.22, (i % 2 ? 0.2 : -0.2)));
      });
      if (otherTalk.length) P.extras.add(place(M.letterModel(), 0.55, M.TOP, 0.3, -0.12));
    }
    leftovers.forEach((m, i) => {
      const l = P.extras.children[(s.supplies ? s.supplies.max : 0) + i];
      if (l) item(`x:${m.key}`, l, [0, 0.0, 0.1], m.label, false, { run: m.run, ring: 0.16 });
    });
    // The guest book: everyone here who doesn't fit behind the counter.
    const book = otherTalk.length ? P.extras.children[(s.supplies ? s.supplies.max : 0) + leftovers.length] : undefined;
    if (book)
      item("x:others", book, [0, 0.0, 0.1], `${others.length} others here`, true, {
        ring: 0.16,
        dist: 0.8,
        panel: () => `<h4>Also here</h4><div class="trips">${otherTalk.map((m) => {
          const o = others.find((x) => m.key === `talk:${x.id}`);
          acts.set(`m:${m.key}`, m.run);
          return `<button class="pb" data-act="m:${esc(m.key)}">${esc(m.label)}${o?.role ? `<small> · ${esc(o.role)}</small>` : ""}</button>`;
        }).join("")}</div>`,
      });

    /* ---------------- DOM: labels, status, narration, overlays ---------------- */
    const lbl: string[] = [];
    for (const it of items.values()) {
      if (it.key === "globe" || it.key === "clock" || it.key === "threads") continue;
      const cls = it.key.startsWith("p:") ? "lb plate" : "lb quiet";
      const p = ppl.find((x) => `p:${x.id}` === it.key);
      if (p) lbl.push(`<button class="${cls}" data-k="${esc(it.key)}" data-act="i:${esc(it.key)}" aria-label="Talk to ${esc(p.name)}" ${p.talk ? "" : "disabled"}>${WEDGE}<b>${esc(p.name)}</b><small>${esc(p.role)}</small></button>`);
      else lbl.push(`<button class="${cls}" data-k="${esc(it.key)}" data-act="i:${esc(it.key)}">${esc(it.label)}</button>`);
    }
    lbl.push(`<button class="lb quiet globe-l" data-k="globe" data-act="globe" aria-haspopup="true" aria-expanded="${pickOpen}">Theme</button>`);
    const html = lbl.join("");
    if (labelsEl.dataset.h !== html) {
      labelsEl.dataset.h = html;
      labelsEl.innerHTML = html;
      labelEls.clear();
      labelsEl.querySelectorAll<HTMLElement>("[data-k]").forEach((el) => labelEls.set(el.dataset.k!, el));
    }
    // Status the shop's walls carry, as small plaques tied to them.
    statusLabels(s.day, s.time, th ? { found, total, goal: th.goal } : null);

    const sh = narrationHtml(box, logOpen, v);
    const saidMore = sayIn.dataset.h !== sh;
    if (saidMore) {
      sayIn.dataset.h = sh;
      sayIn.innerHTML = sh;
    }
    write.sync(v, ctx.journal.open);
    followStory(say, v, saidMore);
    say.classList.toggle("open", logOpen);
    const actsHtml = phoneActsHtml(ctx, v, acts, v.hex && exits.length ? "i:cards" : null);
    if (phacts.dataset.h !== actsHtml) {
      phacts.dataset.h = actsHtml;
      phacts.innerHTML = actsHtml;
    }
    const ov: string[] = [];
    if (ctx.journal.open) ov.push(journalHtml(ctx, v));
    if (pickOpen) ov.push(pickerHtml(ctx, v));
    const oh = ov.join("");
    if (ovl.dataset.h !== oh) {
      ovl.dataset.h = oh;
      ovl.innerHTML = oh;
    }
    if (zoomKey) showPanel();
    if (enc) {
      applyEnc();
      syncGuest();
    }
  }

  /** The clock's ribbon and the thread rack's tag: DOM plaques projected onto those objects. */
  function statusLabels(day: number, time: string, th: { found: number; total: number; goal: string } | null): void {
    if (!parts) return;
    const want = `day|${day}|${time}|${th ? `${th.found}/${th.total}|${th.goal}` : ""}`;
    if (labelsEl.dataset.s === want && labelEls.has("clock")) return;
    labelsEl.dataset.s = want;
    labelsEl.querySelectorAll(".st").forEach((e) => e.remove());
    const clockEl = document.createElement("div");
    clockEl.className = "st ribbon3";
    clockEl.dataset.k = "clock";
    clockEl.setAttribute("role", "status");
    clockEl.innerHTML = `Day ${day}<small>${esc(cap(time))}</small>`;
    labelsEl.append(clockEl);
    labelEls.set("clock", clockEl);
    items.set("clock", { key: "clock", obj: parts.clock.group, anchor: new Vector3(0, -0.8, 0.06), focus: new Vector3(), label: "", zoom: false, dist: 1, ring: null, baseY: parts.clock.group.position.y, hot: 0 });
    if (th && parts.spools.children[0]) {
      const t = document.createElement("button");
      t.className = "st threads3";
      t.dataset.k = "threads";
      t.dataset.act = "i:threads";
      t.title = th.goal;
      t.innerHTML = `<b>THREADS ${th.found}/${th.total}</b><span>${esc(th.goal)}</span>`;
      labelsEl.append(t);
      labelEls.set("threads", t);
      items.set("threads", { key: "threads", obj: parts.spools.children[0], anchor: new Vector3(0, -0.36, 0), focus: new Vector3(), label: "", zoom: false, dist: 1, ring: null, baseY: parts.spools.children[0].position.y, hot: 0, run: () => ctx.journal.toggle() });
    }
  }

  return {
    activate() {
      if (active) return;
      active = true;
      host.hidden = false;
      stageEl.append(ctx.world);
      gen = -1;
    },
    deactivate() {
      if (!active) return;
      active = false;
      host.hidden = true;
      unzoom();
      st?.setUpdate(null);
      releasePhoneRender();
      parts = null;
    },
    render,
    encounter: stageEncounter,
    key(e) {
      if (e.key !== "Escape" || enc) return false;
      if (pickOpen) {
        pickOpen = false;
        if (last) render(last);
        return true;
      }
      if (ctx.journal.open) {
        ctx.journal.toggle();
        unzoom();
        return true;
      }
      if (zoomKey) {
        unzoom();
        return true;
      }
      if (logOpen) {
        logOpen = false;
        if (last) render(last);
        return true;
      }
      return false;
    },
    destroy() {
      destroyed = true;
      st?.setUpdate(null);
      releasePhoneRender();
      dr.removeEventListener("click", onClick);
      dr.removeEventListener("pointermove", onMove);
      dr.removeEventListener("focusin", onFocus);
      for (const t of dynTex) t.dispose();
      encParts?.casters.dispose();
      if (enc) board().staged = null;
      puppets.dispose();
      M.forgetTextures();
    },
  };
}
