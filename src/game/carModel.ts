// Shared sedan model used by the street prologue and the drive-to-circus cutscene. Browser-only (three.js).
import * as THREE from "three";

export interface CarModel {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  headlights: THREE.SpotLight[];
  headGlow: THREE.MeshBasicMaterial;
  /** Dashboard instrument glow (dims when the battery dies). */
  gauges: THREE.MeshBasicMaterial;
  /** Hinged bonnet (rotate x positive to open) and boot lid (rotate x negative to open). */
  hood: THREE.Group;
  trunk: THREE.Group;
  tailGlow: THREE.MeshBasicMaterial;
  /** Driver eye position in car-local space (car faces -Z). */
  driverEye: THREE.Vector3;
  ignition: THREE.Vector3;
  /** Half extents of the body footprint for collisions (x, z). */
  half: [number, number];
}

const profile = (pts: [number, number][]) => {
  const s = new THREE.Shape();
  pts.forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y)));
  s.closePath();
  return s;
};

export function buildCar(lite: boolean, color = "#3f6a62"): CarModel {
  const M = (p: THREE.MeshStandardMaterialParameters) =>
    lite
      ? (new THREE.MeshLambertMaterial({ color: p.color ?? "#ffffff", transparent: p.transparent ?? false, opacity: p.opacity ?? 1, side: p.side ?? THREE.FrontSide }) as unknown as THREE.MeshStandardMaterial)
      : new THREE.MeshStandardMaterial(p);
  const paint = M({ color, metalness: 0.6, roughness: 0.28 });
  const chrome = M({ color: "#b9c0c2", metalness: 0.9, roughness: 0.2 });
  const rubber = M({ color: "#141617", roughness: 0.9 });
  const interior = M({ color: "#2a2522", roughness: 0.95 });
  const dash = M({ color: "#1b1d1f", roughness: 0.7 });
  const glass = lite
    ? (new THREE.MeshLambertMaterial({ color: "#8fa6ad", transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }) as unknown as THREE.MeshStandardMaterial)
    : new THREE.MeshStandardMaterial({ color: "#9db3ba", transparent: true, opacity: 0.16, metalness: 0.2, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide });
  const headGlow = new THREE.MeshBasicMaterial({ color: "#6d6a5c" });
  const tailGlow = new THREE.MeshBasicMaterial({ color: "#4a1210" });
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); g.add(mesh); return mesh;
  };
  const W = 1.78;
  const sideShape = (pts: [number, number][], depth: number) => {
    const geo = new THREE.ExtrudeGeometry(profile(pts), { depth, bevelEnabled: false });
    geo.rotateY(-Math.PI / 2); // profile x -> car z, extrusion -> -x
    return geo;
  };
  const slab = (pts: [number, number][], m: THREE.Material, x0: number, width: number) => {
    const mesh = new THREE.Mesh(sideShape(pts, width), m); mesh.position.x = x0 + width; g.add(mesh); return mesh;
  };
  // Hollow body: two thin side skins, a solid nose and tail, and an open cabin with a floor,
  // so the driver sees seats and a dashboard instead of the inside of a painted block.
  const outline: [number, number][] = [[-2.3, 0.32], [2.3, 0.32], [2.32, 0.62], [2.2, 0.86], [1.25, 0.9], [-1.0, 0.9], [-2.2, 0.8], [-2.34, 0.6]];
  for (const x of [-W / 2, W / 2 - 0.05]) slab(outline, paint, x, 0.05);
  slab([[-2.34, 0.6], [-2.3, 0.32], [-0.95, 0.32], [-0.95, 0.84], [-2.2, 0.76]], paint, -W / 2 + 0.04, W - 0.08); // engine bay
  slab([[1.22, 0.32], [2.3, 0.32], [2.32, 0.62], [2.2, 0.82], [1.22, 0.84]], paint, -W / 2 + 0.04, W - 0.08); // boot
  add(new THREE.BoxGeometry(W - 0.1, 0.05, 2.2), dash, 0, 0.36, 0.13); // cabin floor
  add(new THREE.BoxGeometry(W - 0.12, 0.42, 0.05), interior, 0, 0.6, -0.93); // firewall under the dash
  add(new THREE.BoxGeometry(W - 0.12, 0.5, 0.05), interior, 0, 0.62, 1.2); // behind the rear seat
  for (const x of [-W / 2 + 0.07, W / 2 - 0.07]) {
    add(new THREE.BoxGeometry(0.04, 0.48, 2.1), interior, x, 0.64, 0.13); // door cards
    add(new THREE.BoxGeometry(0.1, 0.04, 2.1), dash, x, 0.89, 0.13); // window sill
    add(new THREE.BoxGeometry(0.03, 0.05, 0.3), chrome, x * 0.97, 0.74, -0.3); // door pull
  }
  // Bonnet and boot lids hinge open for the breakdown scene.
  const hood = new THREE.Group(); hood.position.set(0, 0.86, -0.95); g.add(hood);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(W - 0.06, 0.04, 1.3), paint); lid.position.set(0, 0, -0.64); lid.rotation.x = -0.055; hood.add(lid);
  const trunk = new THREE.Group(); trunk.position.set(0, 0.86, 1.24); g.add(trunk);
  const tlid = new THREE.Mesh(new THREE.BoxGeometry(W - 0.06, 0.04, 1.0), paint); tlid.position.set(0, 0, 0.49); tlid.rotation.x = 0.04; trunk.add(tlid);
  // Greenhouse: clear glass with paint roof and pillars.
  const cabW = 1.56;
  const cab = new THREE.ExtrudeGeometry(profile([[-0.95, 0.9], [1.2, 0.9], [0.8, 1.38], [-0.45, 1.38]]), { depth: cabW, bevelEnabled: false });
  cab.rotateY(-Math.PI / 2); cab.translate(-cabW / 2, 0, 0);
  add(cab, glass, cabW, 0, 0).renderOrder = 2;
  // Bumpers, grille, lamps
  add(new THREE.BoxGeometry(W + 0.06, 0.14, 0.12), chrome, 0, 0.42, -2.36);
  add(new THREE.BoxGeometry(W + 0.06, 0.14, 0.12), chrome, 0, 0.42, 2.36);
  add(new THREE.BoxGeometry(0.8, 0.16, 0.03), dash, 0, 0.66, -2.36);
  for (const x of [-0.65, 0.65]) {
    add(new THREE.BoxGeometry(0.34, 0.15, 0.04), headGlow, x, 0.66, -2.37);
    add(new THREE.BoxGeometry(0.36, 0.13, 0.04), tailGlow, x, 0.68, 2.36);
  }
  // Wheels with rims
  const wheels: THREE.Object3D[] = [];
  for (const x of [-0.82, 0.82]) for (const z of [-1.45, 1.4]) {
    const w = new THREE.Group(); w.position.set(x, 0.33, z); g.add(w);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 22), rubber); tire.rotation.z = Math.PI / 2; w.add(tire);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.25, 12), chrome); rim.rotation.z = Math.PI / 2; w.add(rim);
    const arch = add(new THREE.BoxGeometry(0.06, 0.06, 0.9), dash, x * 1.09, 0.7, z); arch.visible = !lite;
    wheels.push(w);
  }
  // Interior: seats, dash, steering wheel, ignition
  for (const x of [-0.4, 0.4]) {
    add(new THREE.BoxGeometry(0.55, 0.14, 0.55), interior, x, 0.52, 0.25);
    const back = add(new THREE.BoxGeometry(0.55, 0.62, 0.12), interior, x, 0.86, 0.55); back.rotation.x = 0.15;
  }
  add(new THREE.BoxGeometry(1.5, 0.16, 0.5), interior, 0, 0.55, 1.05);
  add(new THREE.BoxGeometry(1.52, 0.2, 0.35), dash, 0, 0.82, -0.82);
  const sw = add(new THREE.TorusGeometry(0.18, 0.02, 8, 24), rubber, -0.4, 0.93, -0.55); sw.rotation.x = -0.4;
  add(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 6), dash, -0.4, 0.88, -0.66).rotation.x = Math.PI / 2 - 0.4;
  const gauges = new THREE.MeshBasicMaterial({ color: "#c98a3a" });
  add(new THREE.BoxGeometry(0.3, 0.1, 0.02), gauges, -0.4, 0.95, -0.82);
  add(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 10), chrome, -0.15, 0.82, -0.64).rotation.x = Math.PI / 2;
  // Headlight beams
  const headlights: THREE.SpotLight[] = [];
  for (const x of [-0.65, 0.65]) {
    const s = new THREE.SpotLight("#fff1cc", 0, 40, 0.42, 0.5, 1.2);
    s.position.set(x, 0.66, -2.4); s.target.position.set(x * 1.5, 0, -14); g.add(s, s.target); headlights.push(s);
  }
  return { group: g, wheels, headlights, headGlow, tailGlow, gauges, hood, trunk, driverEye: new THREE.Vector3(-0.4, 1.13, 0.22), ignition: new THREE.Vector3(-0.15, 0.82, -0.66), half: [W / 2 + 0.06, 2.4] };
}

export function setCarLights(car: CarModel, on: boolean, intensity: number) {
  car.headlights.forEach((l) => (l.intensity = on ? intensity : 0));
  car.headGlow.color.set(on ? "#fff4d6" : "#6d6a5c");
  car.tailGlow.color.set(on ? "#ff2a1c" : "#4a1210");
}
