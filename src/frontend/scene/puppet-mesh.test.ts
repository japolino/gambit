import { describe, expect, test } from "bun:test";
import { gridGeometry, PUPPET_GRID } from "./puppet-mesh.js";

describe("puppet mesh grid", () => {
  test("covers the unit plane with three's uv (v up) and faces +z", () => {
    const g = gridGeometry();
    const pos = g.attributes.position!.array as Float32Array;
    const uv = g.attributes.uv!.array as Float32Array;
    const normal = g.attributes.normal!.array as Float32Array;
    const n = PUPPET_GRID.uv.length / 2;
    expect(pos.length).toBe(n * 3);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      minX = Math.min(minX, pos[i * 3]!);
      maxX = Math.max(maxX, pos[i * 3]!);
      minY = Math.min(minY, pos[i * 3 + 1]!);
      maxY = Math.max(maxY, pos[i * 3 + 1]!);
      // The top of the picture (grid v = 0) is up in the plane and at v = 1 in three.
      expect(uv[i * 2 + 1]).toBeCloseTo(pos[i * 3 + 1]! + 0.5, 5);
      expect(normal[i * 3 + 2]).toBe(1);
    }
    expect([minX, maxX, minY, maxY]).toEqual([-0.5, 0.5, -0.5, 0.5]);
    expect(g.index!.count).toBe(PUPPET_GRID.indices.length);
  });
});
