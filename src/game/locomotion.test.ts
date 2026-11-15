import { describe, expect, it } from "vitest";
import { movementDistance, normalizeMovement, PROLOGUE_RUN, PROLOGUE_STEP, PROLOGUE_WALK } from "./locomotion";

describe("prologue locomotion", () => {
  it("moves continuously while a key is held instead of jumping on release", () => {
    const frames = Array.from({ length: 60 }, () => movementDistance(PROLOGUE_STEP, false));
    expect(frames.every((distance) => distance > 0 && distance <= PROLOGUE_WALK * PROLOGUE_STEP)).toBe(true);
    expect(frames.reduce((sum, distance) => sum + distance, 0)).toBeCloseTo(PROLOGUE_WALK);
  });

  it("uses the same fixed-step rule for sprinting", () => {
    expect(movementDistance(PROLOGUE_STEP, true)).toBeCloseTo(PROLOGUE_RUN / 60);
    expect(movementDistance(0, true)).toBe(0);
  });

  it("does not make diagonal movement faster", () => {
    const diagonal = normalizeMovement({ right: 1, forward: 1 });
    expect(Math.hypot(diagonal.right, diagonal.forward)).toBeCloseTo(1);
  });
});
