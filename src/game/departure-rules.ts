export type DepartureStage = "apartment" | "landing" | "stairs" | "ground" | "street" | "car" | "starting" | "done";
export type DepartureAction = "leaveApartment" | "enterStairs" | "arrive" | "leaveBuilding" | "enterCar" | "startEngine" | "engineReady";

/** The lift is broken: the only way down from floor 7 is the stairs. */
export const LIFT_WORKS = false;
export const START_FLOOR = 7;
export const STAIR_HEIGHT = 2.7;

/**
 * Crossing the lower landing wraps to the identical landing of the next storey.
 * The camera offset exactly cancels that wrap, so the view never jumps.
 */
export function stairLap(floor: number, dir: -1 | 1) {
  const next = nextFloor(floor, dir);
  if (next === floor) return null;
  return { floor: next, cameraYOffset: dir < 0 ? STAIR_HEIGHT : -STAIR_HEIGHT };
}

const steps: Partial<Record<DepartureStage, Partial<Record<DepartureAction, DepartureStage>>>> = {
  apartment: { leaveApartment: "landing" },
  landing: { enterStairs: "stairs" },
  stairs: { arrive: "ground" },
  ground: { leaveBuilding: "street" },
  street: { enterCar: "car" },
  car: { startEngine: "starting" },
  starting: { engineReady: "done" },
};

export function departureNext(stage: DepartureStage, action: DepartureAction): DepartureStage {
  return steps[stage]?.[action] ?? stage;
}
export function canBeginMainGame(stage: DepartureStage) { return stage === "done"; }
/** Floor after walking one full storey down (-1) or up (+1); never above the start floor or below 1. */
export function nextFloor(floor: number, dir: -1 | 1) { return Math.max(1, Math.min(START_FLOOR, floor + dir)); }
