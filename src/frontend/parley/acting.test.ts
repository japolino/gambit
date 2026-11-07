import { describe, expect, test } from "bun:test";
import { PUPPET_ACT } from "./acting.js";
import { SPRITE_HOT_SET } from "../../vendor/cue-puppet/shims.js";
import { PUPPET_GESTURE_S, PUPPET_NEUTRAL_MOOD, puppetMoodFor } from "../../vendor/cue-puppet/sprite-puppet-acting.js";

describe("Parley acting", () => {
  test("every mood is a Cue expression the rig knows, with a real gesture", () => {
    for (const [mood, [expr, k, gesture]] of Object.entries(PUPPET_ACT)) {
      if (expr) {
        expect((SPRITE_HOT_SET as readonly string[]).includes(expr)).toBe(true);
        expect(puppetMoodFor(expr, k)).not.toEqual({ ...PUPPET_NEUTRAL_MOOD });
      } else expect(mood).toBe("unmoved");
      if (gesture) expect(PUPPET_GESTURE_S[gesture]).toBeGreaterThan(0);
    }
  });
  test("an angry read breathes faster than calm, a sad one slower", () => {
    expect(puppetMoodFor(PUPPET_ACT.irritated[0], PUPPET_ACT.irritated[1]).breathRate).toBeGreaterThan(1);
    expect(puppetMoodFor(PUPPET_ACT.moved[0], PUPPET_ACT.moved[1]).breathRate).toBeLessThan(1);
  });
});
