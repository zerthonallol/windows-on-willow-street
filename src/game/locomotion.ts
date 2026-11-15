// Frame-rate-independent prologue movement. Kept free of three.js so held-key motion is testable.
export const PROLOGUE_WALK = 1.9;
export const PROLOGUE_RUN = 3.2;
export const PROLOGUE_STEP = 1 / 60;

export interface MovementInput {
  right: number;
  forward: number;
}

/** Merge keyboard and stick input, then clamp diagonals to unit length. */
export function normalizeMovement(input: MovementInput): MovementInput {
  const length = Math.hypot(input.right, input.forward);
  if (length <= 1) return input;
  return { right: input.right / length, forward: input.forward / length };
}

/** Distance for one fixed simulation step; never depends on render frame rate. */
export function movementDistance(dt: number, sprint: boolean) {
  return (sprint ? PROLOGUE_RUN : PROLOGUE_WALK) * Math.max(0, dt);
}
