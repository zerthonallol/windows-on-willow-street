import { describe, expect, it } from "vitest";
import { departureNext, canBeginMainGame } from "./departure-rules";
import { STALL_DISTANCE_LEFT, canLeaveCar, canHeadOff, roadTask, walkable, SPUTTER_AT, DIE_AT, STOP_AT, GATE } from "./road-rules";

describe("the drive to the park", () => {
  it("the car dies about 1 km before the park", () => {
    expect(STALL_DISTANCE_LEFT).toBe(1000);
    expect(SPUTTER_AT).toBeLessThan(DIE_AT);
    expect(DIE_AT).toBeLessThan(STOP_AT);
  });
  it("starting the engine leads onto the road, not straight into the park", () => {
    expect(departureNext("starting", "engineReady")).toBe("road");
    expect(canBeginMainGame("road")).toBe(false);
    expect(departureNext("road", "stall")).toBe("stalled");
    expect(departureNext("stalled", "leaveCar")).toBe("walk");
    expect(canBeginMainGame("walk")).toBe(false);
    expect(departureNext("walk", "enterPark")).toBe("done");
    expect(canBeginMainGame("done")).toBe(true);
  });
  it("you must try to restart the car before getting out", () => {
    expect(canLeaveCar({ cranks: 0 })).toBe(false);
    expect(canLeaveCar({ cranks: 1 })).toBe(true);
  });
  it("you set off on foot only after checking the engine and putting out the warning triangle", () => {
    expect(canHeadOff({ hood: true, triangle: false })).toBe(false);
    expect(canHeadOff({ hood: false, triangle: true })).toBe(false);
    expect(canHeadOff({ hood: true, triangle: true })).toBe(true);
  });
  it("follows the plan of action in order", () => {
    const p = { cranks: 0, outside: false, hood: false, triangle: false, atGate: false };
    expect(roadTask(p)).toBe("crank");
    expect(roadTask({ ...p, cranks: 1 })).toBe("leaveCar");
    expect(roadTask({ ...p, cranks: 1, outside: true })).toBe("hood");
    expect(roadTask({ ...p, cranks: 1, outside: true, hood: true })).toBe("triangle");
    expect(roadTask({ ...p, cranks: 1, outside: true, hood: true, triangle: true })).toBe("walk");
    expect(roadTask({ ...p, cranks: 1, outside: true, hood: true, triangle: true, atGate: true })).toBe("gate");
  });
  it("the road, the trail and the gate clearing are walkable; the forest is not", () => {
    expect(walkable(0, 0)).toBe(true);
    expect(walkable(0, -130)).toBe(false); // fallen tree blocks the road
    expect(walkable(-13, -69)).toBe(true);
    expect(walkable(-40, -40)).toBe(false);
    expect(walkable(GATE[0], GATE[1] - 2)).toBe(false);
    expect(walkable(GATE[0], GATE[1] - 2, true)).toBe(true);
  });
});
