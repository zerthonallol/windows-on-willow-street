export function availableStoryChoice(condition: "notes" | "gens" | undefined, notes: number, gens: number) {
  return condition === "notes" ? notes >= 3 : condition === "gens" ? gens >= 3 : true;
}

export function canReleaseBear(armed: boolean, flashlight: boolean, distance: number, visible: boolean) {
  return armed && !flashlight && distance < 3 && visible;
}
/** The ringmaster's radio needs at least two running fuse boxes to call for rescue. */
export function canCallRadio(gens: number) {
  return gens >= 2;
}
