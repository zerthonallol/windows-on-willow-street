import { describe, expect, it } from "vitest";
import { inStreet, STREET_LENGTH, streetGround, streetToWorld, worldToStreet } from "./street-rules";

describe("grounded apartment departure", () => {
  it("aligns the outside entrance with the end of the vestibule", () => {
    const entrance = streetToWorld(16.33, 5.85);
    expect(entrance.x).toBeCloseTo(12.8);
    expect(entrance.z).toBeCloseTo(1.33);
    expect(worldToStreet(entrance.x, entrance.z)).toEqual({ x: 16.33, z: 5.8500000000000005 });
  });
  it("keeps the whole pull-away and both sidewalks over ground", () => {
    for (let t = 0; t <= 9.4; t += 0.1) {
      const driveT = Math.max(0, t - 1.65), accel = Math.min(driveT, 2);
      const z = 7.2 - (1.5 * accel * accel + Math.max(0, driveT - 2) * 6);
      expect(Math.abs(z) + 2.4).toBeLessThan(STREET_LENGTH / 2);
      expect(streetGround(21.2)).toBe(-0.15);
    }
    expect(inStreet(17.2, -12.1)).toBe(false);
    expect(inStreet(30, 20.1)).toBe(false);
    expect(inStreet(17.2, 5.85)).toBe(true);
  });
});