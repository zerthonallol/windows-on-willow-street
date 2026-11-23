/** Align the existing street entrance with the ground-floor vestibule. */
export const STREET_OFFSET = { x: 6.95, z: 17.66 };
export const STREET_LENGTH = 360;
export const STREET_MIN_Z = -12;
export const STREET_MAX_Z = 20;
export function streetToWorld(x: number, z: number) {
  return { x: STREET_OFFSET.x + z, z: STREET_OFFSET.z - x };
}
export function worldToStreet(x: number, z: number) {
  return { x: STREET_OFFSET.z - z, z: x - STREET_OFFSET.x };
}
export function streetGround(x: number) { return x > 19.5 && x < 28.5 ? -0.15 : 0; }
export function inStreet(x: number, z: number) {
  return x > 16.38 && x < 31 && z > STREET_MIN_Z && z < STREET_MAX_Z;
}