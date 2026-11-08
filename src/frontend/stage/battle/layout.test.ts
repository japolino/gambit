import { describe, expect, test } from "bun:test";

import { computeLayout, enemySlots } from "./layout";

describe("stage layout", () => {
  test("foes fill the stage: a lone one can run off the top, a crowd stays big, and a framed theme keeps them in the frame", () => {
    const l = computeLayout(1568, 589, 1);
    const room = l.floorY - l.enemyArea.y;
    const lone = enemySlots(l, ["standing"])[0]!;
    expect(lone.height).toBeGreaterThan(room * 1.4);
    expect(lone.y).toBeGreaterThan(lone.floorY);
    expect(lone.y - lone.height).toBeLessThan(l.enemyArea.y);
    // A hat may go off the top of the screen, a face may not.
    for (const rigs of [["standing"], ["floating"], ["huge"], ["serpentine", "standing"]] as const) {
      for (const s of enemySlots({ ...l, enemyArea: { ...l.enemyArea, y: 0 } }, [...rigs])) expect(s.y - s.height).toBeGreaterThanOrEqual(-s.height * 0.0701);
    }
    // On a phone the strip across the top is the ceiling.
    const phone = computeLayout(390, 800, 2);
    for (const s of enemySlots(phone, ["standing", "floating"])) expect(s.y - s.height).toBeGreaterThanOrEqual(phone.enemyArea.y - s.height * 0.0701);
    const three = enemySlots(l, ["standing", "standing", "standing"]);
    for (const s of three) expect(s.height).toBeGreaterThan(room * 0.95);
    expect(three[1]!.height).toBeGreaterThan(three[0]!.height);
    const framed = enemySlots({ ...l, framed: true }, ["standing"])[0]!;
    expect(framed.height).toBeLessThan(room);
    expect(framed.y).toBe(framed.floorY);
  });

  test("a phone stacks enemies, timeline, party, menu without overlap", () => {
    const l = computeLayout(390, 844, 3);
    expect(l.portrait).toBe(true);
    expect(l.timeline.y).toBeGreaterThanOrEqual(l.enemyArea.y + l.enemyArea.h);
    expect(l.party.y).toBeGreaterThanOrEqual(l.timeline.y + l.timeline.h);
    expect(l.menu.y).toBeGreaterThanOrEqual(l.party.y + l.party.h);
    expect(l.menu.y + l.menu.h).toBeLessThanOrEqual(844);
    expect(l.menu.h).toBeGreaterThan(200);
    expect(l.cards).toHaveLength(3);
    for (const c of l.cards) expect(c.x + c.w).toBeLessThanOrEqual(390);
  });

  test("a wide screen puts party and menu side by side under the enemies", () => {
    const l = computeLayout(1280, 800, 3);
    expect(l.portrait).toBe(false);
    expect(l.menu.x).toBeGreaterThanOrEqual(l.party.x + l.party.w);
    expect(l.menu.x + l.menu.w).toBeLessThanOrEqual(1280);
    expect(l.party.y).toBeGreaterThan(l.floorY - 40);
  });

  test("enemy slots stay on screen and the huge boss towers from below the floor", () => {
    const l = computeLayout(390, 844, 3);
    const slots = enemySlots(l, ["huge", "floating"]);
    expect(slots[0]!.y).toBeGreaterThan(l.floorY);
    expect(slots[0]!.height).toBeGreaterThan(slots[1]!.height);
    expect(slots[1]!.y).toBeLessThan(slots[1]!.floorY);
    const three = enemySlots(l, ["standing", "standing", "standing"]);
    for (const s of three) {
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThan(390);
    }
    expect(three[1]!.depth).toBe(0);
    expect(three[0]!.depth).toBeGreaterThan(0);
  });
});
