import { describe, expect, test } from "bun:test";

import { PUPPET_REST, puppetGrid } from "../../../vendor/cue-puppet/sprite-puppet-rig";
import { alphaBBox, buildFigureRig } from "./rig-build";
import { figureMeshPositions, variantDisplace, variantPose } from "./variants";

function rgba(w: number, h: number, box: [number, number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  const [x0, y0, x1, y1] = box;
  for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) data[(y * w + x) * 4 + 3] = 255;
  return data;
}

describe("figure rig", () => {
  test("the alpha bbox finds the opaque figure and ignores an empty image", () => {
    const box = alphaBBox(rgba(100, 200, [20, 30, 80, 190]), 100, 200)!;
    expect(box[0]).toBeCloseTo(0.2, 1);
    expect(box[1]).toBeCloseTo(0.15, 1);
    expect(box[0] + box[2]).toBeCloseTo(0.8, 1);
    expect(box[1] + box[3]).toBeCloseTo(0.95, 1);
    expect(alphaBBox(new Uint8ClampedArray(40 * 40 * 4), 40, 40)).toBeNull();
  });

  test("a huge figure is anchored at the image bottom and keeps its head near the top", () => {
    const huge = buildFigureRig("huge", [0.1, 0.1, 0.8, 0.6], 720, 720);
    expect(huge.bbox[1] + huge.bbox[3]).toBeCloseTo(1, 6);
    expect(huge.face.y).toBeLessThan(0.6);
    const standing = buildFigureRig("standing", [0.2, 0.05, 0.6, 0.9], 512, 768);
    expect(standing.face.y).toBeLessThan(0.3);
  });
});

describe("rig variants", () => {
  const fig = buildFigureRig("floating", [0.2, 0.05, 0.6, 0.85], 512, 768);
  const motion = { time: 1.3, phase: 0.4, strength: 1 };

  test("serpentine drops the neck terms; huge breathes deeper and sways less", () => {
    const pose = { ...PUPPET_REST, tilt: 0.1, nod: 0.01, lift: 0.01, sway: 0.01 };
    const s = variantPose("serpentine", pose);
    expect(s.tilt).toBe(0);
    expect(s.nod).toBe(0);
    const h = variantPose("huge", pose);
    expect(h.lift).toBeGreaterThan(pose.lift);
    expect(h.sway).toBeLessThan(pose.sway);
  });

  test("a floating figure moves at its hem too (no foot anchor); a standing one adds nothing", () => {
    const hem = variantDisplace("floating", fig.rig, motion, 0, 0.02, [0, 0]);
    expect(Math.hypot(hem[0], hem[1])).toBeGreaterThan(0);
    expect(variantDisplace("standing", fig.rig, motion, 0, 0.02, [0, 0])).toEqual([0, 0]);
    expect(variantDisplace("floating", fig.rig, { ...motion, strength: 0 }, 0, 0.02, [0, 0])).toEqual([0, 0]);
  });

  test("at rest the mesh is the image's own pixel grid", () => {
    const grid = puppetGrid(4, 6);
    const out = figureMeshPositions(fig.rig, PUPPET_REST, grid, "standing", { ...motion, strength: 0 }, 512, 768);
    for (let i = 0; i < out.length; i += 2) {
      expect(out[i]!).toBeCloseTo(grid.uv[i]! * 512, 3);
      expect(out[i + 1]!).toBeCloseTo(grid.uv[i + 1]! * 768, 3);
    }
  });
});
