// @ts-nocheck -- procedural scene builder; typed-array indexing and three.js objects are checked at runtime.
// The night drive to Happy Hills: a forest highway in the rain, the spot where the car dies ~1 km out,
// a bus stop with a ringing payphone, a forest trail and the park gate. Plain three.js, browser-only.
// Everything lives in road-local space (road toward -z, car dies at the origin); place the group at ROAD_ORIGIN.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildTrees, canvasTex, glowSprite, lightPool, mat, nightMat, rand, type Kit, type TreeSpec } from "./exterior";
import { createRain } from "./atmosphere";
import { tentWallTexture } from "./circus";
import { paintNotice, NOTICES } from "./notices";
import { GATE, ROAD_Z, STOP_AT, TRAIL, trailDistance } from "./road-rules";
import type { CarModel } from "./carModel";
import type { Lang } from "./story";

/** Far from the apartment block, so the two never share the screen. */
export const ROAD_ORIGIN = new THREE.Vector3(-700, 0, 0);
export const STOP_LATERAL = 3.0; // the car coasts onto the right-hand shoulder

export interface RoadSpot { id: string; pos: THREE.Vector3 } // positions in road-local space
export interface RoadWorld {
  group: THREE.Group;
  /** Car pose after driving `driven` metres; lateral offset to the right of the centre line. */
  pose(driven: number, lateral: number): { pos: THREE.Vector3; yaw: number };
  rain: ReturnType<typeof createRain>;
  triangle: THREE.Group;
  gate: { left: THREE.Group; right: THREE.Group };
  handset: THREE.Object3D;
  spots: Record<string, THREE.Vector3>;
  update(dt: number, c: { t: number; flash: number; camLocal: THREE.Vector3; gateOpen: number }): void;
}

function geoBox(w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  g.translate(x, y, z);
  return g.toNonIndexed();
}
function merged(geos: THREE.BufferGeometry[], m: THREE.Material) {
  const clean = geos.map((g) => { const n = g.index ? g.toNonIndexed() : g; if (n.attributes.uv) n.deleteAttribute("uv"); return n; });
  return new THREE.Mesh(mergeGeometries(clean), m);
}
function textPlate(w: number, h: number, draw: (g: CanvasRenderingContext2D, W: number, H: number) => void, basic = false, lite = false) {
  const W = 512, Hh = Math.round((512 * h) / w);
  const t = canvasTex(W, Hh, (g) => draw(g, W, Hh));
  t.anisotropy = 4;
  const m = basic ? new THREE.MeshBasicMaterial({ map: t }) : nightMat(lite, { map: t, roughness: 0.7 }, 0.12);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
}
function fitText(g: CanvasRenderingContext2D, text: string, maxW: number, size: number, font: string) {
  let s = size; g.font = `bold ${s}px ${font}`;
  while (g.measureText(text).width > maxW && s > 8) { s--; g.font = `bold ${s}px ${font}`; }
  return s;
}
function noticeMesh(id: keyof typeof NOTICES, w: number, h: number, lang: Lang, lite: boolean) {
  const t = canvasTex(256, Math.round((256 * h) / w), (g) => paintNotice(g, 256, Math.round((256 * h) / w), NOTICES[id], lang));
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), nightMat(lite, { map: t, roughness: 0.95, side: THREE.DoubleSide }, 0.1));
}

export function warningTriangle(lite: boolean, kit: Kit) {
  const g = new THREE.Group();
  const red = new THREE.MeshBasicMaterial({ color: "#d0281c" });
  const s = 0.45;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2, b = ((i + 1) / 3) * Math.PI * 2 + Math.PI / 2;
    const ax = Math.cos(a) * s * 0.58, ay = Math.sin(a) * s * 0.58, bx = Math.cos(b) * s * 0.58, by = Math.sin(b) * s * 0.58;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(bx - ax, by - ay), 0.05, 0.02), red);
    bar.position.set((ax + bx) / 2, (ay + by) / 2 + 0.3, 0); bar.rotation.z = Math.atan2(by - ay, bx - ax); g.add(bar);
  }
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.12), mat(lite, { color: "#3a3a3a" })); foot.position.y = 0.01; g.add(foot);
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.02), mat(lite, { color: "#3a3a3a" })); stem.position.y = 0.04; g.add(stem);
  const glint = glowSprite(kit, "#ff2a18", 0.9); glint.position.y = 0.32; g.add(glint);
  return g;
}

/** Windscreen rain and wipers, hazard blinkers and engine steam, attached to the player's car. */
export function fitCar(car: CarModel, kit: Kit, drops: THREE.Texture) {
  const shield = new THREE.Group(); shield.position.set(0, 1.14, -0.7); shield.rotation.x = 0.806; car.group.add(shield);
  const dropTex = drops.clone(); dropTex.needsUpdate = true; dropTex.wrapS = dropTex.wrapT = THREE.RepeatWrapping; dropTex.repeat.set(1.4, 0.7);
  const dropMat = new THREE.MeshBasicMaterial({ map: dropTex, transparent: true, opacity: 0.55, depthWrite: false, color: "#b8c8d4" });
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.68), dropMat); sheet.position.z = 0.012; sheet.renderOrder = 3; shield.add(sheet);
  const armM = new THREE.MeshBasicMaterial({ color: "#0b0c0d" });
  const wipers: THREE.Group[] = [];
  for (const x of [-0.42, 0.22]) {
    const p = new THREE.Group(); p.position.set(x, -0.32, 0.02); shield.add(p);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.56, 0.012), armM); arm.position.y = 0.28; p.add(arm);
    wipers.push(p);
  }
  const hazards: THREE.Sprite[] = [];
  for (const [x, z] of [[-0.78, -2.36], [0.78, -2.36], [-0.78, 2.36], [0.78, 2.36]]) { const s = glowSprite(kit, "#ffa020", 0.8); s.position.set(x, 0.68, z); s.visible = false; car.group.add(s); hazards.push(s); }
  const steamMat = new THREE.SpriteMaterial({ map: kit.glow, color: "#9aa0a4", transparent: true, opacity: 0.2, depthWrite: false });
  const steam: { s: THREE.Sprite; age: number; life: number; vx: number; vz: number }[] = [];
  for (let i = 0; i < 16; i++) { const s = new THREE.Sprite(steamMat.clone()); s.visible = false; car.group.add(s); steam.push({ s, age: Math.random() * 2, life: 1.6 + Math.random(), vx: 0, vz: 0 }); }
  let wipe = 0, lastSide = 0;
  return {
    /** Returns true at the end of each wiper stroke (for the swish). */
    update(dt: number, t: number, o: { wipers: boolean; hazard: boolean; steam: number; hoodOpen: number }) {
      let stroke = false;
      if (o.wipers) {
        wipe += dt * 1.25;
        const ang = (1 - Math.cos(wipe * Math.PI)) * 0.5 * 1.45;
        for (const w of wipers) w.rotation.z = ang;
        const side = Math.floor(wipe) % 2;
        if (side !== lastSide) { lastSide = side; stroke = true; dropTex.offset.x = Math.random(); }
        dropMat.opacity = 0.25 + 0.3 * Math.abs(Math.sin(wipe * Math.PI));
      } else dropMat.opacity = Math.min(0.75, dropMat.opacity + dt * 0.02);
      dropTex.offset.y = (t * 0.02) % 1;
      const blink = o.hazard && Math.sin(t * 6.2) > 0;
      for (const h of hazards) h.visible = blink;
      for (const p of steam) {
        p.s.visible = o.steam > 0.01;
        if (!p.s.visible) continue;
        p.age += dt;
        if (p.age > p.life) { p.age = 0; p.vx = (Math.random() - 0.5) * 0.3; p.vz = (Math.random() - 0.5) * 0.3; }
        const k = p.age / p.life;
        const open = o.hoodOpen;
        p.s.position.set(p.vx * p.age * 2, 0.8 + k * (1.2 + open * 0.8), -1.7 + p.vz * p.age * 2 - (1 - open) * 0.55);
        const sz = 0.4 + k * 1.4; p.s.scale.set(sz, sz, 1);
        p.s.material.opacity = Math.sin(k * Math.PI) * 0.22 * o.steam;
      }
      return stroke;
    },
  };
}

export function buildRoad(kit: Kit, lite: boolean, lang: Lang): RoadWorld {
  const L = (ru: string, en: string) => (lang === "ru" ? ru : en);
  const group = new THREE.Group(); group.position.copy(ROAD_ORIGIN); group.visible = false;
  const r = rand(1987);
  // ---------- the road itself ----------
  const ctrl = [[0, 520], [24, 440], [-16, 350], [14, 255], [-8, 165], [0, 100], [0, 70], [0, 40], [0, 0], [0, -40], [0, -80], [0, -112], [0, -140], [16, -205], [40, -280]];
  const curve = new THREE.CatmullRomCurve3(ctrl.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, "centripetal");
  const N = 2400;
  const P = curve.getSpacedPoints(N);
  const cum = [0];
  for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + P[i].distanceTo(P[i - 1]));
  const total = cum[N];
  let originI = 0;
  for (let i = 0; i <= N; i++) if (P[i].length() < P[originI].length()) originI = i;
  const sOrigin = cum[originI], sStart = sOrigin - STOP_AT;
  const sample = (s: number) => {
    s = Math.max(0, Math.min(total - 0.001, s));
    let lo = 0, hi = N;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const f = (s - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]);
    const p = P[lo].clone().lerp(P[hi], f);
    const tan = P[hi].clone().sub(P[lo]).normalize();
    return { p, tan, right: new THREE.Vector3(-tan.z, 0, tan.x) };
  };
  const pose = (driven: number, lateral: number) => {
    const { p, tan, right } = sample(sStart + driven);
    return { pos: p.addScaledVector(right, lateral), yaw: Math.atan2(-tan.x, -tan.z) };
  };
  const roadDist = (x: number, z: number) => {
    let d = Infinity;
    for (let i = 0; i <= N; i += 6) d = Math.min(d, Math.hypot(P[i].x - x, P[i].z - z));
    return d;
  };
  // asphalt with painted lines, wet and dark
  const asphaltTex = canvasTex(256, 512, (g) => {
    g.fillStyle = "#26282a"; g.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? "0,0,0" : "150,150,150"},${Math.random() * 0.12})`; g.fillRect(Math.random() * 256, Math.random() * 512, 2, 2); }
    for (let i = 0; i < 14; i++) { g.strokeStyle = "rgba(10,10,10,0.5)"; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); let x = Math.random() * 256, y = Math.random() * 512; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += Math.random() * 30 - 15; y += Math.random() * 30; g.lineTo(x, y); } g.stroke(); }
    g.fillStyle = "rgba(205,200,180,0.8)"; g.fillRect(10, 0, 6, 512); g.fillRect(240, 0, 6, 512);
    g.fillRect(125, 0, 6, 220);
  }, true);
  const gravelTex = canvasTex(128, 128, (g) => {
    g.fillStyle = "#3d3a34"; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 1600; i++) { const c = 40 + Math.random() * 70; g.fillStyle = `rgba(${c},${c - 4},${c - 10},0.7)`; g.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2, 1 + Math.random() * 2); }
  }, true);
  const ribbon = (a: number, b: number, y: number, s0: number, s1: number, step: number, vScale: number) => {
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    let n = 0;
    for (let s = s0; s <= s1 + 0.001; s += step) {
      const { p, right } = sample(s);
      pos.push(p.x + right.x * a, y, p.z + right.z * a, p.x + right.x * b, y, p.z + right.z * b);
      uv.push(0, s / vScale, 1, s / vScale);
      if (n) { const k = (n - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
      n++;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    // keep normals pointing up regardless of winding
    const nrm = geo.attributes.normal; for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
    return geo;
  };
  const roadFrom = Math.max(0, sStart - 30), roadTo = total;
  const asphalt = lite ? new THREE.MeshLambertMaterial({ map: asphaltTex, emissive: "#0b0c0d", side: THREE.DoubleSide })
    : new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.32, metalness: 0.25, emissive: "#0a0b0c", side: THREE.DoubleSide });
  group.add(new THREE.Mesh(ribbon(-3.6, 3.6, 0.03, roadFrom, roadTo, 2, 12), asphalt));
  const gravel = nightMat(lite, { map: gravelTex, roughness: 1, side: THREE.DoubleSide }, 0.05);
  gravelTex.repeat.set(1, 1);
  group.add(new THREE.Mesh(ribbon(3.6, 5.6, 0.02, roadFrom, roadTo, 2, 2), gravel));
  group.add(new THREE.Mesh(ribbon(-5.6, -3.6, 0.02, roadFrom, roadTo, 2, 2), gravel));
  // forest floor
  const floorTex = kit.dirt.clone(); floorTex.needsUpdate = true; floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(160, 180);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 900), nightMat(lite, { map: floorTex, color: "#6a6250", roughness: 1 }, 0.06, "#8a7a60"));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.01, 120); group.add(ground);
  // the forest trail, packed earth
  const trailTex = canvasTex(128, 128, (g) => { g.fillStyle = "#3b3026"; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? "20,14,8" : "120,100,70"},${Math.random() * 0.25})`; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 3); } }, true);
  const trailM = nightMat(lite, { map: trailTex, roughness: 1 }, 0.05);
  for (let i = 0; i + 1 < TRAIL.length; i++) {
    const [ax, az] = TRAIL[i], [bx, bz] = TRAIL[i + 1];
    const len = Math.hypot(bx - ax, bz - az) + 1.6;
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(2.4, len), trailM);
    seg.rotation.x = -Math.PI / 2; seg.rotation.z = Math.atan2(bx - ax, bz - az) + Math.PI;
    seg.position.set((ax + bx) / 2, 0.015 + i * 0.001, (az + bz) / 2); group.add(seg);
  }
  // ---------- roadside furniture ----------
  const postGeos: THREE.BufferGeometry[] = [], reflGeos: THREE.BufferGeometry[] = [], poleGeos: THREE.BufferGeometry[] = [];
  for (let s = roadFrom + 10; s < sOrigin + 120; s += 22) {
    const { p, right, tan } = sample(s);
    const ry = Math.atan2(-tan.x, -tan.z);
    for (const side of [-1, 1]) {
      const x = p.x + right.x * 5.0 * side, z = p.z + right.z * 5.0 * side;
      postGeos.push(geoBox(0.11, 1.0, 0.11, x, 0.5, z, 0, ry));
      reflGeos.push(geoBox(0.06, 0.12, 0.02, x - tan.x * 0.06, 0.86, z - tan.z * 0.06, 0, ry));
    }
    if (Math.round(s / 22) % 2 === 0) {
      const x = p.x - right.x * 8.5, z = p.z - right.z * 8.5;
      poleGeos.push(geoBox(0.24, 8, 0.24, x, 4, z, 0, ry), geoBox(1.8, 0.12, 0.12, x, 7.4, z, 0, ry + Math.PI / 2));
    }
  }
  group.add(merged(postGeos, nightMat(lite, { color: "#d8d6cc", roughness: 0.6 }, 0.08)));
  group.add(merged(reflGeos, new THREE.MeshBasicMaterial({ color: "#e08a3a" })));
  group.add(merged(poleGeos, nightMat(lite, { color: "#4a3a2c", roughness: 1 }, 0.05)));
  // guard rail along the bend
  const railGeos: THREE.BufferGeometry[] = [];
  for (let s = sStart + 120; s < sStart + 200; s += 4) {
    const a = sample(s), b = sample(s + 4);
    const pa = a.p.clone().addScaledVector(a.right, 5.2), pb = b.p.clone().addScaledVector(b.right, 5.2);
    const len = pa.distanceTo(pb), mid = pa.clone().add(pb).multiplyScalar(0.5);
    railGeos.push(geoBox(0.05, 0.32, len, mid.x, 0.62, mid.z, 0, Math.atan2(pb.x - pa.x, pb.z - pa.z)), geoBox(0.1, 0.7, 0.1, pa.x, 0.35, pa.z));
  }
  group.add(merged(railGeos, nightMat(lite, { color: "#8e938f", metalness: 0.6, roughness: 0.4 }, 0.06)));
  // road signs, facing approaching drivers
  const spots: Record<string, THREE.Vector3> = {};
  const roadSign = (s: number, side: number, w: number, h: number, draw: (g: CanvasRenderingContext2D, W: number, H: number) => void, y = 2.0) => {
    const { p, right, tan } = sample(s);
    const g = new THREE.Group(); g.position.copy(p).addScaledVector(right, 5.4 * side); g.rotation.y = Math.atan2(-tan.x, -tan.z); group.add(g);
    const plate = textPlate(w, h, draw, false, lite); plate.position.y = y; plate.position.z = 0.03; g.add(plate);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), nightMat(lite, { color: "#5a5d5c", roughness: 0.6 }, 0.03)); back.rotation.y = Math.PI; back.position.y = y; g.add(back);
    for (const x of w > 1 ? [-w * 0.35, w * 0.35] : [0]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, y + h / 2, 8), kit.metal); post.position.set(x, (y + h / 2) / 2 - 0.1, 0); g.add(post); }
    return g;
  };
  const blueSign = (place: string, km: string) => (g: CanvasRenderingContext2D, W: number, H: number) => {
    g.fillStyle = "#1d4fa0"; g.fillRect(0, 0, W, H);
    g.strokeStyle = "#f2f2ee"; g.lineWidth = 10; g.strokeRect(12, 12, W - 24, H - 24);
    g.fillStyle = "#f2f2ee"; g.textBaseline = "middle"; g.textAlign = "left";
    fitText(g, place, W * 0.62, H * 0.32, "Arial, sans-serif"); g.fillText(place, 34, H / 2);
    g.textAlign = "right"; fitText(g, km, W * 0.25, H * 0.42, "Arial, sans-serif"); g.fillText(km, W - 34, H / 2);
  };
  roadSign(sStart + 70, 1, 2.2, 0.7, blueSign(L("Весёлые Горки", "Happy Hills"), "3"));
  roadSign(sStart + 175, 1, 0.9, 0.8, (g, W, H) => {
    g.fillStyle = "#f2f2ee"; g.beginPath(); g.moveTo(W / 2, 10); g.lineTo(W - 10, H - 10); g.lineTo(10, H - 10); g.closePath(); g.fill();
    g.strokeStyle = "#c81e1e"; g.lineWidth = 40; g.lineJoin = "round"; g.stroke();
    g.fillStyle = "#111"; const cx = W / 2, cy = H * 0.66, u = W / 22;
    g.beginPath(); g.ellipse(cx, cy, u * 3.2, u * 1.6, 0, 0, 7); g.fill();
    g.fillRect(cx - u * 2.6, cy, u * 0.7, u * 3); g.fillRect(cx + u * 1.9, cy, u * 0.7, u * 3);
    g.beginPath(); g.ellipse(cx + u * 3.6, cy - u * 1.4, u * 1.3, u * 0.7, -0.5, 0, 7); g.fill();
    g.fillRect(cx + u * 2.8, cy - u * 3.2, u * 0.4, u * 1.4); g.fillRect(cx + u * 2.2, cy - u * 3.3, u * 1.6, u * 0.4);
  }, 2.1);
  const kmSign = roadSign(sOrigin - 24, 1, 2.2, 0.7, blueSign(L("Весёлые Горки", "Happy Hills"), "1"));
  spots.kmSign = kmSign.position.clone().setY(1.9);
  // ---------- the bus stop with a payphone ----------
  const stop = new THREE.Group(); stop.position.set(7.6, 0, -30); group.add(stop);
  const conc = nightMat(lite, { color: "#8a877e", roughness: 0.95 }, 0.07);
  const sg: THREE.BufferGeometry[] = [geoBox(0.16, 2.4, 3.6, 1.0, 1.2, 0), geoBox(1.6, 2.4, 0.14, 0.25, 1.2, 1.8), geoBox(1.6, 2.4, 0.14, 0.25, 1.2, -1.8), geoBox(2.4, 0.14, 4.2, 0.2, 2.47, 0)];
  stop.add(merged(sg, conc));
  stop.add(merged([geoBox(0.4, 0.06, 3.0, 0.7, 0.45, 0), geoBox(0.06, 0.45, 0.06, 0.7, 0.22, 1.3), geoBox(0.06, 0.45, 0.06, 0.7, 0.22, -1.3)], kit.wood));
  const mosaic = textPlate(3.2, 1.5, (g, W, H) => {
    g.fillStyle = "#3d5a6a"; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 8) for (let x = 0; x < W; x += 8) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`; g.fillRect(x, y, 7, 7); }
    g.fillStyle = "#c97a2a"; g.beginPath(); g.ellipse(W * 0.3, H * 0.58, W * 0.09, H * 0.27, 0, 0, 7); g.fill();
    g.beginPath(); g.arc(W * 0.3, H * 0.27, H * 0.13, 0, 7); g.fill();
    g.fillStyle = "#e9d9a0"; g.fillRect(W * 0.27 - 22, H * 0.11, 60, 10);
    g.fillStyle = "#111"; g.beginPath(); g.arc(W * 0.28, H * 0.25, 4, 0, 7); g.arc(W * 0.33, H * 0.25, 4, 0, 7); g.fill();
    for (const [x, c] of [[0.5, "#d33"], [0.6, "#3a3"], [0.7, "#dd3"]] as const) { g.fillStyle = c; g.beginPath(); g.ellipse(W * x, H * 0.3, 18, 24, 0, 0, 7); g.fill(); g.strokeStyle = "#ddd"; g.beginPath(); g.moveTo(W * x, H * 0.3 + 24); g.lineTo(W * 0.36, H * 0.55); g.stroke(); }
    g.fillStyle = "#f2e6c8"; g.font = `bold ${H * 0.13}px Georgia`; g.textAlign = "center"; g.fillText(L("ВЕСЁЛЫЕ ГОРКИ", "HAPPY HILLS"), W * 0.66, H * 0.8);
    g.fillStyle = "rgba(0,0,0,0.35)"; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * W, Math.random() * H, 6 + Math.random() * 30, 6 + Math.random() * 18);
  }, false, lite);
  mosaic.position.set(0.91, 1.35, 0); mosaic.rotation.y = -Math.PI / 2; stop.add(mosaic);
  const timetable = noticeMesh("timetable", 0.42, 0.56, lang, lite); timetable.position.set(0.3, 1.45, 1.88); stop.add(timetable);
  spots.timetable = new THREE.Vector3(7.9, 1.45, -28.1);
  const missing = noticeMesh("missing", 0.36, 0.5, lang, lite); missing.position.set(-0.25, 1.45, 1.88); missing.rotation.z = -0.05; stop.add(missing);
  spots.missing = new THREE.Vector3(7.35, 1.45, -28.1);
  // payphone on the end wall, rings as you walk past
  const phone = new THREE.Group(); phone.position.set(0.25, 0, -1.88); stop.add(phone);
  phone.add(merged([geoBox(0.34, 0.5, 0.18, 0, 1.35, -0.09), geoBox(0.4, 0.06, 0.24, 0, 1.63, -0.1)], mat(lite, { color: "#8b8f8a", metalness: 0.5, roughness: 0.5 })));
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 18), mat(lite, { color: "#1c1c1c" })); dial.rotation.x = Math.PI / 2; dial.position.set(0.04, 1.36, -0.2); phone.add(dial);
  const handset = new THREE.Group(); handset.position.set(-0.13, 1.4, -0.2); phone.add(handset);
  handset.add(merged([geoBox(0.05, 0.24, 0.05, 0, 0, 0), geoBox(0.07, 0.06, 0.06, 0, 0.12, -0.02), geoBox(0.07, 0.06, 0.06, 0, -0.12, -0.02)], mat(lite, { color: "#151515", roughness: 0.6 })));
  spots.payphone = new THREE.Vector3(7.8, 1.4, -32.05);
  // dead lamp by the stop that still glows faintly
  const lampG = new THREE.Group(); lampG.position.set(5.9, 0, -25.5); group.add(lampG);
  lampG.add(merged([geoBox(0.12, 6, 0.12, 0, 3, 0), geoBox(1.4, 0.08, 0.08, -0.65, 5.9, 0)], kit.metal));
  const lampGlow = glowSprite(kit, "#ffb070", 2.2); lampGlow.position.set(-1.3, 5.75, 0); lampG.add(lampGlow);
  const lampPool = lightPool(kit, "#ff9a40", 3.6, 0.35); lampPool.position.set(-1.3, 0.05, 0); lampG.add(lampPool);
  // ---------- fork sign, fallen tree ----------
  const fork = new THREE.Group(); fork.position.set(-5.4, 0, -57); fork.rotation.y = 0.15; group.add(fork);
  fork.add(merged([geoBox(0.12, 1.9, 0.12, 0, 0.95, 0)], kit.wood));
  const arrow = textPlate(1.3, 0.38, (g, W, H) => {
    g.fillStyle = "#6a4a2c"; g.beginPath(); g.moveTo(0, H / 2); g.lineTo(H * 0.6, 0); g.lineTo(W, 0); g.lineTo(W, H); g.lineTo(H * 0.6, H); g.closePath(); g.fill();
    for (let i = 0; i < 30; i++) { g.strokeStyle = "rgba(30,18,8,0.4)"; g.beginPath(); const y = Math.random() * H; g.moveTo(0, y); g.lineTo(W, y + Math.random() * 6 - 3); g.stroke(); }
    g.fillStyle = "#f0e6cc"; g.textAlign = "center"; g.textBaseline = "middle";
    const txt = L("ВЕСЁЛЫЕ ГОРКИ · 300 м", "HAPPY HILLS · 300 m"); fitText(g, txt, W * 0.78, H * 0.42, "'Comic Sans MS', cursive"); g.fillText(txt, W * 0.57, H / 2);
  }, false, lite);
  arrow.material.transparent = true; arrow.material.alphaTest = 0.5;
  arrow.position.set(-0.4, 1.65, 0.07); fork.add(arrow);
  spots.fork = new THREE.Vector3(-5.6, 1.6, -56.9);
  const trunkM = nightMat(lite, { map: kit.bark, color: "#6a5a48", roughness: 1 }, 0.05);
  const fallen = new THREE.Group(); fallen.position.set(0, 0.5, -113); fallen.rotation.y = 0.12; group.add(fallen);
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 17, 12), trunkM); log.rotation.z = Math.PI / 2; fallen.add(log);
  const roots = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.4, 12), nightMat(lite, { color: "#2e251c", roughness: 1 }, 0.04)); roots.rotation.z = Math.PI / 2; roots.position.set(-8.6, 0.6, 0); fallen.add(roots);
  const needleM = nightMat(lite, { color: "#1f3324", roughness: 1 }, 0.05);
  for (let i = 0; i < 7; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(1.1 - i * 0.08, 2.4, 8), needleM); c.rotation.z = -Math.PI / 2; c.position.set(3 + i * 1.0, 0.3 + (i % 2) * 0.4, (i % 2 ? 0.6 : -0.6)); fallen.add(c); }
  spots.fallenTree = new THREE.Vector3(0, 1.0, -111.6);
  // ---------- trail props ----------
  const sandal = new THREE.Group(); sandal.position.set(-20.4, 0.02, -85.4); sandal.rotation.y = 0.7; group.add(sandal);
  sandal.add(merged([geoBox(0.08, 0.025, 0.19, 0, 0.012, 0), geoBox(0.085, 0.03, 0.02, 0, 0.04, 0.03), geoBox(0.085, 0.03, 0.02, 0, 0.04, -0.04), geoBox(0.02, 0.05, 0.02, 0.04, 0.03, 0.07)], mat(lite, { color: "#8a4a22", roughness: 0.8 })));
  spots.sandal = new THREE.Vector3(-20.4, 0.15, -85.4);
  const horse = new THREE.Group(); horse.position.set(-27.4, 0.35, -104.2); horse.rotation.set(0.1, 1.2, 1.35); group.add(horse);
  const white = nightMat(lite, { color: "#d8d0bc", roughness: 0.5 }, 0.1), redM = mat(lite, { color: "#8a1a18", roughness: 0.5 }), gold = mat(lite, { color: "#b08a3a", metalness: 0.7, roughness: 0.4 });
  horse.add(merged([geoBox(0.34, 0.36, 0.95, 0, 0.6, 0), geoBox(0.22, 0.5, 0.24, 0, 0.92, -0.5, -0.5), geoBox(0.2, 0.2, 0.38, 0, 1.12, -0.74), ...[[-0.11, -0.36], [0.11, -0.36], [-0.11, 0.36], [0.11, 0.36]].map(([x, z]) => geoBox(0.08, 0.5, 0.08, x, 0.22, z, z < 0 ? -0.5 : 0.5))], white));
  horse.add(merged([geoBox(0.38, 0.08, 0.4, 0, 0.8, 0.05), geoBox(0.06, 0.4, 0.18, 0, 1.0, -0.4)], redM));
  horse.add(merged([geoBox(0.05, 1.6, 0.05, 0, 1.0, 0.05)], gold));
  spots.horse = new THREE.Vector3(-26.6, 0.6, -103.8);
  const pine = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 9, 9), trunkM); pine.position.set(-24.0, 4.5, -95.6); group.add(pine);
  const ad = noticeMesh("watchman", 0.32, 0.42, lang, lite); ad.position.set(-23.72, 1.5, -95.5); ad.rotation.y = Math.PI / 2 - 0.2; group.add(ad);
  spots.watchman = new THREE.Vector3(-23.7, 1.5, -95.5);
  // ---------- the park gate ----------
  const [gx, gz] = GATE;
  const brick = nightMat(lite, { color: "#7a3a2a", roughness: 0.95 }, 0.06);
  const iron = mat(lite, { color: "#1c1e1f", metalness: 0.7, roughness: 0.5 });
  group.add(merged([geoBox(0.8, 3.6, 0.8, gx - 1.85, 1.8, gz), geoBox(0.8, 3.6, 0.8, gx + 1.85, 1.8, gz), geoBox(0.95, 0.2, 0.95, gx - 1.85, 3.7, gz), geoBox(0.95, 0.2, 0.95, gx + 1.85, 3.7, gz)], brick));
  group.add(merged([geoBox(4.6, 0.16, 0.16, gx, 4.3, gz), geoBox(0.12, 0.7, 0.12, gx - 2.2, 4.0, gz), geoBox(0.12, 0.7, 0.12, gx + 2.2, 4.0, gz)], iron));
  const arch = textPlate(4.2, 0.85, (g, W, H) => {
    g.clearRect(0, 0, W, H);
    g.fillStyle = "#1a1210"; g.beginPath(); g.ellipse(W / 2, H, W / 2, H * 0.95, 0, Math.PI, 0); g.fill();
    g.fillStyle = "#e0a63a"; g.textAlign = "center"; g.textBaseline = "middle";
    fitText(g, L("ВЕСЁЛЫЕ ГОРКИ", "HAPPY HILLS"), W * 0.78, H * 0.45, "Georgia, serif"); g.fillText(L("ВЕСЁЛЫЕ ГОРКИ", "HAPPY HILLS"), W / 2, H * 0.62);
  }, true);
  arch.material.transparent = true; arch.material.alphaTest = 0.3; arch.material.side = THREE.DoubleSide;
  arch.position.set(gx, 4.75, gz); group.add(arch);
  const bulbs: THREE.Sprite[] = [];
  for (let i = 0; i <= 16; i++) { const a = Math.PI - (i / 16) * Math.PI; const b = glowSprite(kit, i % 3 ? "#ffcf7a" : "#ff5a3a", 0.55); b.position.set(gx + Math.cos(a) * 2.15, 4.33 + Math.sin(a) * 0.82, gz + 0.05); group.add(b); bulbs.push(b); }
  for (const x of [gx - 1.85, gx + 1.85]) { const b = glowSprite(kit, "#ffd59a", 1.6); b.position.set(x, 4.15, gz); group.add(b); }
  const gateLight = new THREE.PointLight("#ffb46a", lite ? 6 : 12, 14, 1.6); gateLight.position.set(gx, 3.6, gz + 1.5); group.add(gateLight);
  const leaf = (side: number) => {
    const piv = new THREE.Group(); piv.position.set(gx + side * 1.42, 0, gz); group.add(piv);
    const geos: THREE.BufferGeometry[] = [geoBox(1.4, 0.06, 0.06, -side * 0.7, 0.25, 0), geoBox(1.4, 0.06, 0.06, -side * 0.7, 2.3, 0), geoBox(1.4, 0.05, 0.05, -side * 0.7, 1.3, 0)];
    for (let i = 0; i < 9; i++) { const x = -side * (0.08 + i * 0.165); geos.push(geoBox(0.025, 2.5 + Math.sin(i / 8 * Math.PI) * 0.25, 0.025, x, 1.3, 0)); }
    piv.add(merged(geos, iron));
    return piv;
  };
  const gate = { left: leaf(-1), right: leaf(1) };
  const chain = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 10), gold); chain.position.set(gx - 0.05, 1.25, gz + 0.06); group.add(chain);
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.04), gold); lock.position.set(gx + 0.25, 0.04, gz + 0.5); lock.rotation.set(0.3, 0.5, 1.4); group.add(lock);
  spots.gate = new THREE.Vector3(gx, 1.3, gz + 0.2);
  spots.chain = new THREE.Vector3(gx + 0.25, 0.2, gz + 0.5);
  // fence either side of the gate
  const bars: [number, number][] = [];
  for (let x = -90; x < gx - 2.25; x += 0.17) bars.push([x, gz]);
  for (let x = gx + 2.25; x < -7; x += 0.17) bars.push([x, gz]);
  for (let z = gz; z > -200; z -= 0.17) bars.push([-7, z]);
  const barMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.025, 2.3, 0.025), iron, bars.length);
  const m4 = new THREE.Matrix4();
  bars.forEach(([x, z], i) => { m4.makeTranslation(x, 1.15, z); barMesh.setMatrixAt(i, m4); });
  group.add(barMesh);
  group.add(merged([geoBox(gx - 2.25 + 90, 0.06, 0.06, (gx - 2.25 - 90) / 2, 2.1, gz), geoBox(gx - 2.25 + 90, 0.06, 0.06, (gx - 2.25 - 90) / 2, 0.3, gz),
    geoBox(-7 - gx - 2.25, 0.06, 0.06, (gx + 2.25 - 7) / 2, 2.1, gz), geoBox(-7 - gx - 2.25, 0.06, 0.06, (gx + 2.25 - 7) / 2, 0.3, gz)], iron));
  const poster = noticeMesh("poster", 0.6, 0.85, lang, lite); poster.position.set(gx - 3.3, 1.45, gz + 0.05); group.add(poster);
  spots.poster = new THREE.Vector3(gx - 3.3, 1.45, gz + 0.1);
  // ticket booth by the gate
  const booth = new THREE.Group(); booth.position.set(gx + 4.0, 0, gz + 1.6); group.add(booth);
  booth.add(merged([geoBox(1.6, 2.3, 1.4, 0, 1.15, 0), geoBox(1.9, 0.12, 1.7, 0, 2.36, 0)], nightMat(lite, { color: "#5e7a5a", roughness: 0.8 }, 0.06)));
  const boothWin = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), mat(lite, { color: "#0c1214", metalness: 0.5, roughness: 0.15 })); boothWin.position.set(0, 1.35, 0.71); booth.add(boothWin);
  const kassa = textPlate(0.9, 0.24, (g, W, H) => { g.fillStyle = "#c9b98a"; g.fillRect(0, 0, W, H); g.fillStyle = "#6a1a14"; g.textAlign = "center"; g.textBaseline = "middle"; fitText(g, L("КАССА", "TICKETS"), W * 0.8, H * 0.7, "Georgia, serif"); g.fillText(L("КАССА", "TICKETS"), W / 2, H / 2); }, false, lite);
  kassa.position.set(0, 1.9, 0.72); booth.add(kassa);
  const ticket = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.06), new THREE.MeshBasicMaterial({ color: "#c8b47a" })); ticket.rotation.x = -Math.PI / 2; ticket.position.set(0.1, 1.06, 0.78); booth.add(ticket);
  booth.add(merged([geoBox(0.9, 0.04, 0.2, 0, 1.03, 0.8)], kit.wood));
  spots.ticket = new THREE.Vector3(gx + 4.1, 1.1, gz + 2.4);
  // ---------- what lies beyond: big top and a Ferris wheel, lit ----------
  const tentTex = tentWallTexture(); tentTex.repeat.set(6, 1);
  const tent = new THREE.Group(); tent.position.set(-50, 0, -168); group.add(tent);
  tent.add(new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 6, 28, 1, true), nightMat(lite, { map: tentTex, side: THREE.DoubleSide, roughness: 0.9 }, 0.2, "#ff9a6a")));
  tent.children[0].position.y = 3;
  const roofTex = tentWallTexture("#8a1418", "#d8c8a2"); roofTex.repeat.set(8, 1);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(17.5, 11, 28, 1, true), nightMat(lite, { map: roofTex, side: THREE.DoubleSide, roughness: 0.9 }, 0.18, "#ff9a6a")); roof.position.y = 11.5; tent.add(roof);
  for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; const b = glowSprite(kit, i % 2 ? "#ffd07a" : "#ff6a4a", 1.4, false); b.position.set(Math.cos(a) * 16.6, 6.2, Math.sin(a) * 16.6); tent.add(b); bulbs.push(b); }
  const wheel = new THREE.Group(); wheel.position.set(-16, 16, -160); group.add(wheel);
  const rim = new THREE.Group(); wheel.add(rim);
  rim.add(new THREE.Mesh(new THREE.TorusGeometry(13, 0.14, 6, 48), iron));
  const spokes: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; spokes.push(geoBox(0.08, 13, 0.08, Math.cos(a) * 6.5, Math.sin(a) * 6.5, 0, 0, 0, a - Math.PI / 2)); }
  rim.add(merged(spokes, iron));
  const cabins: THREE.Object3D[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 1.0), mat(lite, { color: ["#8a2a22", "#2a5a7a", "#c09030"][i % 3], roughness: 0.6 }));
    c.position.set(Math.cos(a) * 13, Math.sin(a) * 13 - 0.8, 0); rim.add(c); cabins.push(c);
    const b = glowSprite(kit, i % 2 ? "#ffe0a0" : "#ff7a50", 1.6, false); b.position.set(Math.cos(a) * 13, Math.sin(a) * 13, 0.2); rim.add(b); bulbs.push(b);
  }
  wheel.add(merged([geoBox(0.4, 17, 0.4, -4, -8.2, 1.5, 0, 0, -0.25), geoBox(0.4, 17, 0.4, 4, -8.2, 1.5, 0, 0, 0.25), geoBox(0.4, 17, 0.4, -4, -8.2, -1.5, 0, 0, -0.25), geoBox(0.4, 17, 0.4, 4, -8.2, -1.5, 0, 0, 0.25)], iron));
  const skyGlow = glowSprite(kit, "#ff8a3a", 90, false); skyGlow.material = skyGlow.material.clone(); skyGlow.material.opacity = 0.18; skyGlow.position.set(-30, 14, -175); group.add(skyGlow);
  // ---------- the forest ----------
  const trees: TreeSpec[] = [];
  const blocked = (x: number, z: number) => roadDist(x, z) < 6.6 || trailDistance(x, z) < 3.0 || (x < -6 && z < gz + 1.5) || (x > -7.5 && z < gz - 2 && x < 2) ||
    Math.hypot(x - 7.6, z + 30) < 4.5 || Math.hypot(x - gx, z - gz - 2) < 8 || Math.hypot(x + 24, z + 95.6) < 1.5;
  let birches = 0;
  const maxBirch = lite ? 14 : 45;
  const step = lite ? 3.6 : 2.4;
  for (let s = Math.max(0, sStart - 40); s < sOrigin + 140; s += step) {
    const { p, right } = sample(s);
    for (const side of [-1, 1]) for (let k = 0; k < 2; k++) {
      const off = k === 0 ? 7 + r() * 5 : 12 + r() * (lite ? 22 : 34);
      const x = p.x + right.x * off * side + (r() - 0.5) * 2, z = p.z + right.z * off * side + (r() - 0.5) * 2;
      if (blocked(x, z)) continue;
      let kind: "spruce" | "birch" = r() < (k === 0 ? 0.16 : 0.05) ? "birch" : "spruce";
      if (kind === "birch" && ++birches > maxBirch) kind = "spruce";
      trees.push({ x, y: 0, z, h: kind === "birch" ? 9 + r() * 5 : 10 + r() * 12, kind, seed: Math.floor(r() * 1e9) });
    }
  }
  // the wood between the trail and the road
  for (let i = 0; i < (lite ? 60 : 150); i++) {
    const x = -60 + r() * 56, z = -126 + r() * 80;
    if (blocked(x, z)) continue;
    trees.push({ x, y: 0, z, h: 10 + r() * 12, kind: r() < 0.08 ? "birch" : "spruce", seed: Math.floor(r() * 1e9) });
  }
  group.add(buildTrees(trees, lite, kit));
  // undergrowth
  const bush: THREE.BufferGeometry[] = [];
  for (let i = 0; i < (lite ? 90 : 240); i++) {
    const s = sOrigin - 200 + r() * 340, side = r() < 0.5 ? -1 : 1, { p, right } = sample(s), off = 6.2 + r() * 4;
    const x = p.x + right.x * off * side, z = p.z + right.z * off * side;
    if (blocked(x, z) && roadDist(x, z) < 6) continue;
    if (trailDistance(x, z) < 2.4) continue;
    const g = new THREE.IcosahedronGeometry(0.5 + r() * 0.7, 0); g.scale(1, 0.6 + r() * 0.3, 1); g.translate(x, 0.25, z); bush.push(g);
  }
  if (bush.length) group.add(merged(bush, nightMat(lite, { color: "#2a3524", roughness: 1, flatShading: true }, 0.05, "#3a4a30")));
  // ---------- rain ----------
  const rain = createRain(lite ? 1600 : 4200, 22, 14);
  group.add(rain.mesh);
  let blinkT = 0;
  return {
    group, pose, rain, triangle: warningTriangle(lite, kit), gate, handset, spots,
    update(dt, c) {
      rain.uniforms.uTime.value = c.t; rain.uniforms.uFlash.value = c.flash * 0.4;
      rain.uniforms.uCenter.value.set(c.camLocal.x, c.camLocal.y + 2, c.camLocal.z - 3);
      rim.rotation.z += dt * 0.05;
      for (const cab of cabins) cab.rotation.z = -rim.rotation.z;
      blinkT -= dt;
      if (blinkT <= 0) { blinkT = 0.15 + Math.random() * 0.4; const b = bulbs[Math.floor(Math.random() * bulbs.length)]; b.visible = !b.visible || Math.random() < 0.6; }
      lampGlow.visible = lampPool.visible = Math.random() > 0.03;
      gate.left.rotation.y = c.gateOpen * 1.25; gate.right.rotation.y = -c.gateOpen * 1.25;
      gateLight.intensity = (lite ? 6 : 12) * (Math.random() < 0.02 ? 0.3 : 1);
    },
  };
}
