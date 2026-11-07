/**
 * Cue's puppet warp for people drawn as meshes in a three.js theme (the
 * diorama room, the table): warp(mesh, image) swaps a person's 1×1 plane for
 * the rig's grid, and tick() moves the grid every frame, so the figure
 * breathes, sways and turns its head in the room, lit and shadowed like the
 * plane was. Only real cut-outs are warped; opaque art and busts stay flat.
 * The same vendored rig as puppet-dom.ts and the battle stage.
 */
import { BufferAttribute, BufferGeometry, type Mesh } from "three";
import type { SpriteFaceBox } from "../../vendor/cue-puppet/shims.js";
import { PUPPET_NEUTRAL_MOOD } from "../../vendor/cue-puppet/sprite-puppet-acting.js";
import { puppetGrid, puppetMeshPositions, puppetPose, type PuppetGrid } from "../../vendor/cue-puppet/sprite-puppet-rig.js";
import { alphaBBox, buildFigureRig, type AlphaBox, type FigureRig } from "../stage/puppet/rig-build.js";

export const PUPPET_GRID: PuppetGrid = puppetGrid(16, 24);

type Sized = CanvasImageSource & { width: number; height: number };

/**
 * The rig of a picture, from its alpha. cut: it has real transparency (a
 * figure); null when the picture cannot be read.
 */
export function rigOf(image: Sized, face: SpriteFaceBox | null = null): { figure: FigureRig; cut: boolean } | null {
  const w = image.width;
  const h = image.height;
  if (!w || !h || typeof document === "undefined") return null;
  let bbox: AlphaBox = [0, 0, 1, 1];
  let cut = false;
  try {
    const k = Math.min(1, 256 / h);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * k));
    c.height = Math.max(1, Math.round(h * k));
    const g = c.getContext("2d");
    if (!g) return null;
    g.drawImage(image, 0, 0, c.width, c.height);
    const data = g.getImageData(0, 0, c.width, c.height).data;
    bbox = alphaBBox(data, c.width, c.height, 24, 1) ?? bbox;
    let clear = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i]! < 24) clear++;
    cut = clear / (data.length / 4) > 0.03;
  } catch {
    return null;
  }
  return { figure: buildFigureRig("standing", bbox, w, h, face), cut };
}

/** A unit-plane grid geometry (x, y in -0.5..0.5) for the puppet, normals facing +z. */
export function gridGeometry(grid: PuppetGrid = PUPPET_GRID): BufferGeometry {
  const n = grid.uv.length / 2;
  const geo = new BufferGeometry();
  const pos = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  const normal = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = grid.uv[i * 2]!;
    const v = grid.uv[i * 2 + 1]!;
    // The grid's uv runs down the image; three's v runs up.
    uv[i * 2] = u;
    uv[i * 2 + 1] = 1 - v;
    pos[i * 3] = u - 0.5;
    pos[i * 3 + 1] = 0.5 - v;
    normal[i * 3 + 2] = 1;
  }
  geo.setAttribute("position", new BufferAttribute(pos, 3));
  geo.setAttribute("uv", new BufferAttribute(uv, 2));
  geo.setAttribute("normal", new BufferAttribute(normal, 3));
  geo.setIndex(new BufferAttribute(new Uint16Array(grid.indices), 1));
  return geo;
}

export interface PuppetMeshes {
  /** Warp this person's plane by the picture it shows (no-op for opaque art). True when warped. */
  warp(mesh: Mesh, image: Sized, face?: SpriteFaceBox | null): boolean;
  /** Move every warped mesh (seconds). Meshes taken out of the scene are dropped. */
  tick(time: number, dt: number): void;
  dispose(): void;
}

type Warped = { mesh: Mesh; figure: FigureRig; phase: number; clocks: { breath: number; sway: number } };

export function createPuppetMeshes(reducedMotion: boolean): PuppetMeshes {
  let list: Warped[] = [];
  const clip = new Float32Array(PUPPET_GRID.uv.length);
  return {
    warp(mesh, image, face = null) {
      if (reducedMotion) return false;
      const rig = rigOf(image, face);
      if (!rig?.cut) return false;
      list = list.filter((w) => w.mesh !== mesh);
      const old = mesh.geometry;
      mesh.geometry = gridGeometry();
      old?.dispose();
      list.push({ mesh, figure: rig.figure, phase: Math.random(), clocks: { breath: Math.random() * 3, sway: Math.random() * 5 } });
      return true;
    },
    tick(time, dt) {
      list = list.filter((w) => w.mesh.parent);
      for (const w of list) {
        w.clocks.breath += dt;
        w.clocks.sway += dt;
        if (!w.mesh.visible) continue;
        const r = w.figure.rig;
        const pose = puppetPose({
          time,
          phase: w.phase,
          figH: r.figH,
          faceW: r.faceW,
          breathing: 1,
          sway: 1,
          head: 1,
          talk: 0,
          reaction: null,
          strength: 1,
          clocks: w.clocks,
          acting: 1,
          mood: { ...PUPPET_NEUTRAL_MOOD },
          gaze: 0,
          side: w.phase > 0.5 ? 1 : -1,
          gestures: [],
          physics: { bodyX: 0, bodyY: 0, hairX: 0, hairY: 0, windX: 0 },
          shift: null,
        });
        puppetMeshPositions(r, pose, PUPPET_GRID, clip);
        const pos = w.mesh.geometry.attributes.position as BufferAttribute;
        const a = pos.array as Float32Array;
        // Clip space spans the picture at -1..1; the plane is 1×1.
        for (let i = 0, j = 0; i < clip.length; i += 2, j += 3) {
          a[j] = clip[i]! * 0.5;
          a[j + 1] = clip[i + 1]! * 0.5;
        }
        pos.needsUpdate = true;
        w.mesh.geometry.computeBoundingSphere();
      }
    },
    dispose() {
      list = [];
    },
  };
}
