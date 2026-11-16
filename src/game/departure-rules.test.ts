import { describe, expect, it } from "vitest";
import { departureNext, canBeginMainGame, nextFloor, stairLap, hallFeature, LIFT_WORKS, START_FLOOR, STAIR_HEIGHT, type DepartureStage } from "./departure-rules";

describe("departure before the main game", () => {
  it("leaving the apartment leads to the landing, not the main game", () => {
    expect(departureNext("apartment", "leaveApartment")).toBe("landing");
    expect(canBeginMainGame("landing")).toBe(false);
  });
  it("the lift is broken, so the player must take the stairs from floor 7 to floor 1", () => {
    expect(LIFT_WORKS).toBe(false);
    expect(START_FLOOR).toBe(7);
    expect(departureNext("landing", "leaveBuilding")).toBe("landing");
    expect(departureNext("landing", "enterStairs")).toBe("stairs");
    expect(departureNext("stairs", "arrive")).toBe("ground");
    let f = 7; for (let i = 0; i < 6; i++) f = nextFloor(f, -1);
    expect(f).toBe(1);
    expect(nextFloor(1, -1)).toBe(1);
    expect(nextFloor(7, 1)).toBe(7);
  });
  it("wraps each storey without changing the apparent camera height", () => {
    expect(stairLap(7, -1)).toEqual({ floor: 6, cameraYOffset: STAIR_HEIGHT });
    expect(stairLap(6, 1)).toEqual({ floor: 7, cameraYOffset: -STAIR_HEIGHT });
    expect(stairLap(1, -1)).toBeNull();
    expect(stairLap(7, 1)).toBeNull();
  });
  it("requires reaching the street before entering the car", () => {
    expect(departureNext("ground", "enterCar")).toBe("ground");
    expect(departureNext("ground", "leaveBuilding")).toBe("street");
    expect(departureNext("street", "enterCar")).toBe("car");
  });
  it("only starts the main game after walking into the park", () => {
    for (const stage of ["apartment", "landing", "stairs", "ground", "street", "car", "starting", "road", "stalled", "walk"] as DepartureStage[]) {
      expect(canBeginMainGame(stage)).toBe(false);
    }
    expect(departureNext("car", "startEngine")).toBe("starting");
    expect(departureNext("starting", "engineReady")).toBe("road");
    expect(departureNext("walk", "enterPark")).toBe("done");
    expect(canBeginMainGame("done")).toBe(true);
  });
  it("shows the street exit instead of the lift on the first floor only", () => {
    expect(hallFeature(1)).toBe("exit");
    expect(hallFeature(START_FLOOR)).toBe("lift");
    for (let f = 2; f <= 9; f++) expect(hallFeature(f)).toBe("lift");
  });
});
