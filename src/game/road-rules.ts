// Rules for the night drive to the park and the walk after the car dies. Plain TS (no three.js) so it is testable.
// Road-local coordinates: the road runs toward -z; the car dies at the origin.

/** The car stalls this far (metres, story distance) from the park gate. */
export const STALL_DISTANCE_LEFT = 1000;
/** Where the engine starts coughing and where it dies, measured as distance driven along the road. */
export const SPUTTER_AT = 300;
export const DIE_AT = 335;
export const STOP_AT = 380;
export const CRUISE = 16; // m/s, about 58 km/h on a wet country road

export type RoadTask = "crank" | "leaveCar" | "hood" | "triangle" | "walk" | "gate";
export interface RoadProgress { cranks: number; outside: boolean; hood: boolean; triangle: boolean; atGate: boolean }

/** You may leave the dead car only after trying to restart it at least once. */
export function canLeaveCar(p: Pick<RoadProgress, "cranks">) { return p.cranks >= 1; }
/** You head off on foot only after checking the engine and putting out the warning triangle. */
export function canHeadOff(p: Pick<RoadProgress, "hood" | "triangle">) { return p.hood && p.triangle; }
/** The restart attempt on which the flat battery finally gives up. */
export const BATTERY_DIES_ON = 3;

/** The plan of action, in order: the first unfinished step is the current objective. */
export function roadTask(p: RoadProgress): RoadTask {
  if (!p.outside) return p.cranks < 1 ? "crank" : "leaveCar";
  if (!p.hood) return "hood";
  if (!p.triangle) return "triangle";
  return p.atGate ? "gate" : "walk";
}

// ---------- walkable ground after the car dies ----------
/** Straight road section around the dead car (x = 0 is the centre line). */
export const ROAD_HALF = 5.6; // carriageway + gravel shoulders
export const ROAD_Z: [number, number] = [-112, 60]; // a fallen tree blocks the road beyond -112
export const HEAD_OFF_Z = -16; // walking further than this needs the plan done
/** Forest trail from the road to the park gate. */
export const TRAIL: [number, number][] = [[-4.5, -60], [-13, -69], [-21, -86], [-25, -104], [-29, -119], [-31, -127]];
export const TRAIL_HALF = 1.6;
export const GATE: [number, number] = [-31, -128.5];

function segDist(px: number, pz: number, a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
}
export function trailDistance(x: number, z: number) {
  let d = Infinity;
  for (let i = 0; i + 1 < TRAIL.length; i++) {
    const a = TRAIL[i], b = TRAIL[i + 1];
    if (a && b) d = Math.min(d, segDist(x, z, a, b));
  }
  return d;
}
/** Can the player stand here? Road strip, the trail, or the small clearing in front of the gate. */
export function walkable(x: number, z: number, gateOpen = false) {
  const [gx, gz] = GATE;
  if (x > gx + 2.1 && x < gx + 6.1 && z > gz + 0.7 && z < gz + 2.5) return false; // ticket booth
  if (Math.abs(x) < ROAD_HALF && z > ROAD_Z[0] && z < ROAD_Z[1]) return true;
  // bus stop pad and shelter (its two end walls are solid)
  if (x >= ROAD_HALF - 0.1 && x < 8.45 && z > -33.5 && z < -26.5) return !(x > 6.85 && (Math.abs(z + 28.2) < 0.35 || Math.abs(z + 31.8) < 0.35));
  if (trailDistance(x, z) < TRAIL_HALF) return z > gz + 0.35 || (gateOpen && Math.abs(x - gx) < 1.3);
  if (z > gz + 0.35 && Math.hypot(x - gx, z - (gz + 2)) < 4) return true;
  if (gateOpen && Math.abs(x - gx) < 1.3 && z <= gz + 0.35 && z > gz - 4) return true;
  return false;
}
