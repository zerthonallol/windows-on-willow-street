// @ts-nocheck -- procedural prop builders, indices are bounds-checked at runtime
import * as THREE from "three";
import { rustTexture, paperTexture } from "./textures";

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const std = (color: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });
let rustCache: THREE.Texture | null = null;
const rust = () => (rustCache ??= rustTexture());

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Broken metal cabinet against a wall. Door swings on a hinge; `inside` is where the loot sits. */
export function buildCabinet() {
  const g = new THREE.Group();
  const body = std("#5a6a62", { map: rust(), metalness: 0.55, roughness: 0.7 });
  const darkIn = std("#120e0b", { roughness: 1 });
  const W = 0.95, H = 1.9, Dp = 0.6, t = 0.05;
  const panel = (w: number, h: number, d: number, x: number, y: number, z: number, m = body) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    p.position.set(x, y, z);
    p.castShadow = true; p.receiveShadow = true;
    g.add(p);
    return p;
  };
  panel(W, H, t, 0, H / 2, -Dp / 2 + t / 2, darkIn); // back
  panel(t, H, Dp, -W / 2, H / 2, 0);
  panel(t, H, Dp, W / 2, H / 2, 0);
  panel(W, t, Dp, 0, H, 0);
  panel(W, t, Dp, 0, 0.08, 0);
  panel(W - t, t, Dp - 0.05, 0, 0.85, 0); // shelf
  panel(W - t, t, Dp - 0.05, 0, 1.4, 0);
  // vents + dents
  for (let i = 0; i < 4; i++) panel(0.4, 0.02, 0.01, 0, 1.6 + i * 0.05, Dp / 2 + 0.01, darkIn);
  // hinged door (pivot on the left edge)
  const hinge = new THREE.Group();
  hinge.position.set(-W / 2, 0, Dp / 2);
  g.add(hinge);
  const door = new THREE.Mesh(new THREE.BoxGeometry(W, H - 0.1, 0.04), body);
  door.position.set(W / 2, H / 2, 0.02);
  door.castShadow = true;
  hinge.add(door);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.05), std("#9a9a8a", { metalness: 1, roughness: 0.3 }));
  handle.position.set(W - 0.1, H / 2, 0.06);
  hinge.add(handle);
  // the door hangs crooked on a broken hinge
  hinge.rotation.z = rnd(-0.03, 0.03);
  hinge.rotation.y = rnd(0, 0.12);
  g.rotation.z = rnd(-0.03, 0.03);
  return { group: g, hinge, inside: new THREE.Vector3(0, 0.9, 0) };
}

/** Body of a missing worker lying on the floor with a blood pool. */
export function buildCorpse() {
  const g = new THREE.Group();
  const cloth = std(["#2c3a52", "#4a3a28", "#5a1a1a", "#2e3a2a"][Math.floor(Math.random() * 4)], { roughness: 1 });
  const skin = std("#8a8070", { roughness: 0.9 });
  const blood = new THREE.MeshBasicMaterial({ color: "#2a0405", transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const cap = (r: number, l: number, m: THREE.Material, p: [number, number, number], rz = Math.PI / 2, ry = 0) => {
    const c = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 4, 8), m);
    c.position.set(...p);
    c.rotation.set(0, ry, rz);
    c.castShadow = true;
    g.add(c);
    return c;
  };
  cap(0.2, 0.55, cloth, [0, 0.2, 0]);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), skin);
  head.position.set(0.62, 0.15, 0.05);
  g.add(head);
  cap(0.07, 0.45, cloth, [0.15, 0.1, 0.35], Math.PI / 2, -0.7);
  cap(0.07, 0.45, cloth, [0.1, 0.1, -0.35], Math.PI / 2, 0.9);
  cap(0.09, 0.6, std("#1e1e22"), [-0.65, 0.1, 0.13], Math.PI / 2, 0.15);
  cap(0.09, 0.6, std("#1e1e22"), [-0.62, 0.1, -0.15], Math.PI / 2, -0.25);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(rnd(0.7, 1.1), 18), blood);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(rnd(-0.2, 0.3), 0.015, rnd(-0.2, 0.2));
  pool.scale.set(1, rnd(0.6, 1), 1);
  g.add(pool);
  for (let i = 0; i < 4; i++) {
    const d = new THREE.Mesh(new THREE.CircleGeometry(rnd(0.05, 0.14), 8), blood);
    d.rotation.x = -Math.PI / 2;
    d.position.set(rnd(-1.4, 1.4), 0.016, rnd(-1.2, 1.2));
    g.add(d);
  }
  g.rotation.y = Math.random() * Math.PI * 2;
  return g;
}

const exhibitLabel = (text: string) =>
  canvasTex(256, 64, (g) => {
    g.fillStyle = "#c9a96a"; g.fillRect(0, 0, 256, 64);
    g.strokeStyle = "#3a2a10"; g.lineWidth = 4; g.strokeRect(4, 4, 248, 56);
    g.fillStyle = "#2a1a08"; g.font = "bold 22px serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, 128, 33);
  });

/** Glass display case on a pedestal with a creepy circus exhibit inside. */
export function buildExhibit(kind: number) {
  const g = new THREE.Group();
  const wood = std("#4a2a18", { map: rust(), roughness: 0.9 });
  const ped = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 1.4), wood);
  ped.position.y = 0.5; ped.castShadow = true; g.add(ped);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.5), std("#b08a3a", { metalness: 0.7, roughness: 0.4 }));
  trim.position.y = 1.02; g.add(trim);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.2, 1.3), new THREE.MeshStandardMaterial({ color: "#a8c8d0", transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.2, depthWrite: false }));
  glass.position.y = 1.65; g.add(glass);
  // a cracked pane
  const crack = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (c) => { c.strokeStyle = "rgba(230,240,255,0.7)"; c.lineWidth = 1.5; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(64, 64); let x = 64, y = 64; for (let k = 0; k < 4; k++) { x += rnd(-25, 25); y += rnd(-25, 25); c.lineTo(x, y); } c.stroke(); } }), transparent: true, depthWrite: false }));
  crack.position.set(0.1, 1.7, 0.655); g.add(crack);
  const labels = ["КЛОУН ПИППО", "ДВУХГОЛОВЫЙ", "ЗАСПИРТОВАНО", "МАСКА 1931", "ПРОПАВШИЙ №7"];
  const inner = new THREE.Group();
  inner.position.y = 1.08;
  g.add(inner);
  const white = std("#e8e0d0", { roughness: 0.6 }), red = std("#c8101a", { emissive: "#400", emissiveIntensity: 0.5 });
  if (kind % 5 === 0) {
    // clown head with red nose & frizzy hair
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), white); h.position.y = 0.45; inner.add(h);
    const n = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), red); n.position.set(0, 0.45, 0.28); inner.add(n);
    for (const s of [-1, 1]) { const hair = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0), std("#d0401a")); hair.position.set(s * 0.28, 0.55, -0.05); inner.add(hair); }
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.2, 10), std("#3a1a2a")); neck.position.y = 0.1; inner.add(neck);
  } else if (kind % 5 === 1) {
    // two-headed doll
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.3, 4, 8), std("#7a5a8a")); body.position.y = 0.3; inner.add(body);
    for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), white); h.position.set(s * 0.12, 0.66, 0); inner.add(h); }
  } else if (kind % 5 === 2) {
    // specimen jars
    for (let i = 0; i < 3; i++) {
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.45, 12), new THREE.MeshStandardMaterial({ color: "#9ab040", transparent: true, opacity: 0.55, emissive: "#3a5010", emissiveIntensity: 0.6 }));
      jar.position.set(-0.35 + i * 0.35, 0.22, 0); inner.add(jar);
      const thing = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), std("#d8c0a0")); thing.position.set(-0.35 + i * 0.35, 0.2, 0); inner.add(thing);
    }
  } else if (kind % 5 === 3) {
    // mask on a stand
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), std("#222")); st.position.y = 0.25; inner.add(st);
    const mask = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 10, 0, Math.PI), white); mask.position.y = 0.55; inner.add(mask);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.CircleGeometry(0.05, 8), std("#000")); e.position.set(s * 0.09, 0.6, 0.25); inner.add(e); }
  } else {
    // old shoes & hat of a missing child
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 10), std("#2a6fd1")); hat.position.set(-0.2, 0.2, 0); inner.add(hat);
    for (const s of [-1, 1]) { const sh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.25), std("#5a2a10")); sh.position.set(0.2 + s * 0.08, 0.04, 0); inner.add(sh); }
  }
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), new THREE.MeshBasicMaterial({ map: exhibitLabel(labels[kind % 5]) }));
  lab.position.set(0, 0.7, 0.71); g.add(lab);
  return g;
}

/** Painted clown photo cutout with a face hole. */
export function buildCutout() {
  const tex = canvasTex(256, 384, (g) => {
    g.fillStyle = "#1a1030"; g.fillRect(0, 0, 256, 384);
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#c8161e" : "#f0e2c0"; g.fillRect(i * 32, 200, 32, 184); }
    g.fillStyle = "#f2d36b"; g.beginPath(); g.arc(128, 120, 80, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#e8e0d0"; g.beginPath(); g.arc(128, 120, 58, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#000"; g.beginPath(); g.arc(128, 120, 36, 0, Math.PI * 2); g.fill(); // face hole
    g.fillStyle = "#c8101a"; g.font = "bold 30px serif"; g.textAlign = "center"; g.fillText("ХА-ХА!", 128, 260);
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.4})`; g.fillRect(Math.random() * 256, Math.random() * 384, 3, 8); }
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.1), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 1 }));
  m.position.y = 1.05;
  const g = new THREE.Group();
  g.add(m);
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.06), std("#3a2a18"));
  leg.position.set(0, 0.6, -0.35); leg.rotation.x = -0.4; g.add(leg);
  g.rotation.z = rnd(-0.1, 0.1);
  return g;
}

/** Rusty animal cage on wheels. */
export function buildCage() {
  const g = new THREE.Group();
  const m = std("#5a3a20", { map: rust(), metalness: 0.6, roughness: 0.6 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 1.6), std("#3a1a10")); base.position.y = 0.5; g.add(base);
  const roof = base.clone(); roof.position.y = 2.4; g.add(roof);
  for (let i = 0; i < 12; i++) {
    const bent = i === 5 || i === 6;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.9, 5), m);
    b.position.set(-1.1 + i * 0.2, 1.45, 0.78);
    if (bent) b.rotation.z = (i === 5 ? -0.4 : 0.4);
    g.add(b);
    const b2 = b.clone(); b2.rotation.z = 0; b2.position.z = -0.78; g.add(b2);
  }
  for (const [x, z] of [[-0.9, 0.8], [0.9, 0.8], [-0.9, -0.8], [0.9, -0.8]]) {
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.06, 6, 12), std("#7a1010")); w.position.set(x, 0.3, z); g.add(w);
  }
  return g;
}

/** Overturned popcorn cart. */
export function buildPopcornCart() {
  const g = new THREE.Group();
  const stripes = canvasTex(128, 64, (c) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? "#f0e2c0" : "#c8161e"; c.fillRect(i * 16, 0, 16, 64); } });
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.8), new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.8 }));
  box.position.y = 0.9; g.add(box);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.7), new THREE.MeshStandardMaterial({ color: "#ffe9a0", transparent: true, opacity: 0.3, emissive: "#ffb040", emissiveIntensity: 0.15 }));
  glass.position.y = 1.7; g.add(glass);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.4, 4), new THREE.MeshStandardMaterial({ map: stripes })); roof.position.y = 2.25; roof.rotation.y = Math.PI / 4; g.add(roof);
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 14), std("#c9962a", { metalness: 0.7 })); w.position.set(s * 0.6, 0.35, 0); w.rotation.y = Math.PI / 2; g.add(w); }
  g.rotation.z = rnd(-0.12, 0.12);
  return g;
}

/** Scatters trash (bags, cans, papers, popcorn boxes) around the given world points via instancing. */
export function scatterTrash(scene: THREE.Scene, spots: THREE.Vector3[], heavy: THREE.Vector3[]) {
  const dummy = new THREE.Object3D();
  const kinds = [
    { geo: new THREE.IcosahedronGeometry(0.35, 1), mat: std("#141a14", { roughness: 0.35, metalness: 0.1 }), y: 0.22, s: [1, 0.7, 1], n: 1 },
    { geo: new THREE.CylinderGeometry(0.05, 0.05, 0.16, 8), mat: std("#a01818", { metalness: 0.8, roughness: 0.4 }), y: 0.05, s: [1, 1, 1], n: 3, lie: true },
    { geo: new THREE.PlaneGeometry(0.3, 0.22), mat: new THREE.MeshStandardMaterial({ map: paperTexture?.(), color: "#cfc4a4", side: THREE.DoubleSide, roughness: 1 }), y: 0.02, s: [1, 1, 1], n: 4, flat: true },
    { geo: new THREE.CylinderGeometry(0.12, 0.08, 0.25, 6), mat: std("#d02a2a", { roughness: 0.9 }), y: 0.1, s: [1, 1, 1], n: 1, lie: true },
  ];
  const all = [...spots.map((p) => ({ p, k: 1 })), ...heavy.map((p) => ({ p, k: 4 }))];
  for (const kd of kinds) {
    const mats: THREE.Matrix4[] = [];
    for (const { p, k } of all) {
      const n = Math.round(kd.n * k * rnd(0.4, 1.4));
      for (let i = 0; i < n; i++) {
        dummy.position.set(p.x + rnd(-1.3, 1.3), kd.y, p.z + rnd(-1.3, 1.3));
        dummy.rotation.set(kd.flat ? -Math.PI / 2 : kd.lie ? Math.PI / 2 : 0, Math.random() * 6, kd.lie ? Math.random() * 6 : 0);
        const sc = rnd(0.7, 1.3);
        dummy.scale.set(kd.s[0] * sc, kd.s[1] * sc, kd.s[2] * sc);
        dummy.updateMatrix();
        mats.push(dummy.matrix.clone());
      }
    }
    const im = new THREE.InstancedMesh(kd.geo, kd.mat, Math.max(1, mats.length));
    mats.forEach((m, i) => im.setMatrixAt(i, m));
    im.count = mats.length;
    im.receiveShadow = true;
    scene.add(im);
  }
}

/** Wooden plank texture for building walls with a peeling poster band. */
export function plankTexture() {
  return canvasTex(256, 256, (g) => {
    for (let i = 0; i < 8; i++) { const v = 40 + Math.random() * 25; g.fillStyle = `rgb(${v + 30},${v + 10},${v - 10})`; g.fillRect(0, i * 32, 256, 31); g.fillStyle = "#140c06"; g.fillRect(0, i * 32 + 31, 256, 1); }
    for (let i = 0; i < 600; i++) { g.fillStyle = `rgba(10,5,0,${Math.random() * 0.3})`; g.fillRect(Math.random() * 256, Math.random() * 256, Math.random() * 30, 1); }
    g.fillStyle = "rgba(160,20,26,0.75)"; g.fillRect(30, 90, 90, 70);
    g.fillStyle = "rgba(240,220,170,0.8)"; g.font = "bold 16px serif"; g.fillText("ЦИРК!", 48, 130);
  });
}

/** Walls of a building: planks; interior floor: dirty tiles. */
export function tileTexture() {
  const t = canvasTex(256, 256, (g) => {
    for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? "#3a2a24" : "#6a5a48"; g.fillRect(x * 64, y * 64, 64, 64); }
    for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(15,8,4,${Math.random() * 0.35})`; g.fillRect(Math.random() * 256, Math.random() * 256, 4, 4); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
