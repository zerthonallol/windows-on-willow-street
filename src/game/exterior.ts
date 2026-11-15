// @ts-nocheck -- procedural scene builder; typed-array indexing and three.js shader hooks are checked at runtime.
// Living night exterior shared by the apartment window view and the street outside the entrance:
// storm sky, wind-swayed trees, 3D panel blocks with flickering windows, a playground,
// passing cars, a pedestrian with an umbrella and drifting leaves. Plain three.js, browser-only.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildCar, type CarModel } from "./carModel";

// ---------- small helpers ----------
export function rand(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = false) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function mat(lite: boolean, p: Record<string, unknown>) {
  if (lite) {
    const { roughness, metalness, ...rest } = p;
    return new THREE.MeshLambertMaterial(rest);
  }
  return new THREE.MeshStandardMaterial({ roughness: 0.85, ...p });
}

function boxGeo(w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y + h / 2, z);
  return g;
}
function cylGeo(rt: number, rb: number, h: number, x: number, y: number, z: number, seg = 8) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  g.translate(x, y + h / 2, z);
  return g;
}
function mergedMesh(geos: THREE.BufferGeometry[], m: THREE.Material) {
  const clean = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of clean) { g.deleteAttribute("uv"); if (!g.attributes.normal) g.computeVertexNormals(); }
  return new THREE.Mesh(mergeGeometries(clean), m);
}

// ---------- wind ----------
/** Shared wind uniforms: every swaying material reads these, so one update moves the whole world. */
export const wind = { uTime: { value: 0 }, uWind: { value: 1 } };
export function updateWind(t: number) {
  const gust = 0.72 + 0.32 * Math.sin(t * 0.21) + 0.22 * Math.sin(t * 0.57 + 1.3) + 0.12 * Math.sin(t * 1.63 + 0.4);
  wind.uTime.value = t;
  wind.uWind.value = Math.max(0.25, gust);
  return wind.uWind.value;
}

function windify(m: THREE.Material, leaf: boolean) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = wind.uTime;
    sh.uniforms.uWind = wind.uWind;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;\nuniform float uWind;\nattribute vec4 aTree;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
{
  float th = max(aTree.w, 0.5);
  float hh = clamp((position.y - aTree.y) / th, 0.0, 1.25);
  float ph = aTree.x * 0.37 + aTree.z * 0.23;
  float env = 0.6 + 0.4 * sin(uTime * 0.33 + ph * 0.15);
  float sway = sin(uTime * 1.2 + ph) * 0.6 + sin(uTime * 2.35 + ph * 1.9) * 0.22;
  float bend = hh * hh * th * 0.03 * uWind * env;
  transformed.x += bend * (0.9 + sway);
  transformed.z += bend * 0.45 * sin(uTime * 1.05 + ph * 1.3);
  ${leaf ? `float fl = sin(uTime * 9.0 + position.x * 7.0 + position.z * 6.0 + position.y * 5.0);
  transformed += vec3(fl, fl * 0.5, -fl * 0.7) * 0.05 * uWind * hh;` : ""}
}`);
  };
  m.customProgramCacheKey = () => (leaf ? "wind-leaf" : "wind-solid");
}

// ---------- shared textures ----------
export interface Kit {
  lite: boolean;
  glow: THREE.Texture;
  bay: THREE.Texture;
  litWin: THREE.Texture;
  leaf: THREE.Texture;
  bark: THREE.Texture;
  dirt: THREE.Texture;
  pave: THREE.Texture;
  glowMats: Map<string, THREE.Material>;
  poolMats: Map<string, THREE.Material>;
  concrete: THREE.Material;
  roof: THREE.Material;
  metal: THREE.Material;
  darkMetal: THREE.Material;
  wood: THREE.Material;
  asphalt: THREE.Material;
}

export function createKit(lite: boolean): Kit {
  const glow = canvasTex(128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.25, "rgba(255,255,255,0.45)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  });
  const bay = canvasTex(256, 256, (g) => {
    g.fillStyle = "#6c6b65"; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? "20,20,18" : "210,205,195"},${Math.random() * 0.06})`;
      g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 3, 2 + Math.random() * 3);
    }
    g.fillStyle = "rgba(18,18,16,0.6)"; g.fillRect(0, 0, 256, 3); g.fillRect(0, 0, 3, 256);
    g.fillStyle = "rgba(225,220,210,0.12)"; g.fillRect(0, 3, 256, 2);
    const st = g.createLinearGradient(0, 180, 0, 256); st.addColorStop(0, "rgba(12,12,10,0.4)"); st.addColorStop(1, "rgba(12,12,10,0)");
    g.fillStyle = st; g.fillRect(66, 180, 124, 76);
    g.fillStyle = "#a6a293"; g.fillRect(56, 40, 144, 132);
    const gl = g.createLinearGradient(0, 46, 0, 166); gl.addColorStop(0, "#1d2631"); gl.addColorStop(1, "#080a0e");
    g.fillStyle = gl; g.fillRect(62, 46, 132, 120);
    g.fillStyle = "#a6a293"; g.fillRect(125, 46, 6, 120); g.fillRect(62, 88, 132, 5);
    g.fillStyle = "#33312d"; g.fillRect(50, 172, 156, 8);
  }, true);
  const litWin = canvasTex(64, 64, (g) => {
    const r = g.createRadialGradient(32, 16, 2, 32, 30, 44);
    r.addColorStop(0, "#ffffff"); r.addColorStop(1, "#7d7d7d");
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    g.fillStyle = "rgba(0,0,0,0.42)"; g.fillRect(0, 0, 11, 64); g.fillRect(53, 0, 11, 64);
    g.fillStyle = "rgba(0,0,0,0.75)"; g.fillRect(30, 0, 4, 64); g.fillRect(0, 21, 64, 3);
    g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(14, 44, 18, 20);
  });
  const leaf = canvasTex(256, 256, (g) => {
    g.clearRect(0, 0, 256, 256);
    g.strokeStyle = "rgba(60,45,30,0.9)"; g.lineWidth = 2;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(128, 128); g.lineTo(30 + Math.random() * 196, 30 + Math.random() * 196); g.stroke(); }
    for (let i = 0; i < 34; i++) {
      const x = 28 + Math.random() * 200, y = 28 + Math.random() * 200, s = 9 + Math.random() * 11, a = Math.random() * Math.PI * 2;
      g.save(); g.translate(x, y); g.rotate(a);
      const v = 200 + Math.floor(Math.random() * 55);
      g.fillStyle = `rgb(${v},${v - 10},${v - 40})`;
      g.beginPath(); g.moveTo(-s, 0); g.quadraticCurveTo(0, -s * 0.7, s, 0); g.quadraticCurveTo(0, s * 0.7, -s, 0); g.fill();
      g.strokeStyle = "rgba(90,70,40,0.6)"; g.lineWidth = 1; g.beginPath(); g.moveTo(-s, 0); g.lineTo(s, 0); g.stroke();
      g.restore();
    }
  });
  const bark = canvasTex(64, 256, (g) => {
    g.fillStyle = "#d9d9d6"; g.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(40,40,40,${0.15 + Math.random() * 0.25})`; g.fillRect(Math.random() * 64, Math.random() * 256, 1 + Math.random() * 2, 6 + Math.random() * 30); }
    for (let i = 0; i < 40; i++) { g.fillStyle = "rgba(15,15,15,0.75)"; g.fillRect(Math.random() * 64, Math.random() * 256, 6 + Math.random() * 14, 2 + Math.random() * 2); }
  }, true);
  const dirt = canvasTex(256, 256, (g) => {
    g.fillStyle = "#2b2a1f"; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5000; i++) {
      const c = Math.random();
      g.fillStyle = c < 0.4 ? `rgba(60,62,34,${Math.random() * 0.5})` : c < 0.7 ? `rgba(90,70,40,${Math.random() * 0.35})` : `rgba(10,10,8,${Math.random() * 0.4})`;
      g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 4, 2 + Math.random() * 4);
    }
  }, true);
  const pave = canvasTex(256, 256, (g) => {
    g.fillStyle = "#57585a"; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? "0,0,0" : "255,255,255"},${Math.random() * 0.06})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
    g.strokeStyle = "rgba(20,20,20,0.5)"; g.lineWidth = 2;
    for (let y = 0; y <= 256; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
    for (let x = 0; x <= 256; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  }, true);
  return {
    lite, glow, bay, litWin, leaf, bark, dirt, pave,
    glowMats: new Map(), poolMats: new Map(),
    concrete: mat(lite, { color: "#7a7871", roughness: 0.95 }),
    roof: mat(lite, { color: "#3a3936", roughness: 1 }),
    metal: mat(lite, { color: "#59605e", metalness: 0.5, roughness: 0.5 }),
    darkMetal: mat(lite, { color: "#25292a", metalness: 0.4, roughness: 0.6 }),
    wood: mat(lite, { color: "#5a4330", roughness: 0.9 }),
    asphalt: lite ? new THREE.MeshLambertMaterial({ color: "#1c2024" }) : new THREE.MeshStandardMaterial({ color: "#15181b", roughness: 0.22, metalness: 0.35 }),
  };
}

export function glowSprite(kit: Kit, color: string, size: number, fog = true) {
  const key = color + fog;
  let m = kit.glowMats.get(key);
  if (!m) { m = new THREE.SpriteMaterial({ map: kit.glow, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog }); kit.glowMats.set(key, m); }
  const s = new THREE.Sprite(m);
  s.scale.set(size, size, 1);
  return s;
}
/** Warm pool of light on the ground under a lamp — a cheap stand-in for a real light. */
export function lightPool(kit: Kit, color: string, radius: number, opacity = 0.5) {
  const key = color + opacity;
  let m = kit.poolMats.get(key);
  if (!m) { m = new THREE.MeshBasicMaterial({ map: kit.glow, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }); kit.poolMats.set(key, m); }
  const p = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), m);
  p.rotation.x = -Math.PI / 2;
  return p;
}

// ---------- sky ----------
const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const skyFrag = /* glsl */ `
uniform float uTime;
uniform float uFlash;
varying vec3 vDir;
float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash2(i), hash2(i+vec2(1,0)), f.x), mix(hash2(i+vec2(0,1)), hash2(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.07; a*=0.5; } return v; }
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 horizon = vec3(0.052,0.040,0.036);
  vec3 zenith = vec3(0.008,0.010,0.016);
  vec3 col = mix(horizon, zenith, smoothstep(-0.02, 0.5, h));
  vec2 uv = d.xz / (max(h, 0.0) + 0.16) * 0.8 + vec2(uTime * 0.025, uTime * 0.008);
  float c = fbm(uv) * 0.75 + fbm(uv * 2.4 + 9.0) * 0.4;
  float clouds = smoothstep(0.35, 0.85, c);
  vec3 cloudCol = mix(vec3(0.085,0.066,0.058), vec3(0.03,0.03,0.036), smoothstep(0.0, 0.45, h));
  col = mix(col, cloudCol, clouds * smoothstep(-0.04, 0.08, h));
  col += vec3(0.5,0.55,0.75) * uFlash * (0.15 + clouds * 0.7);
  col = mix(vec3(0.03,0.028,0.028), col, smoothstep(-0.15, 0.0, h));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;
/** Overcast storm sky lit orange from below by the city. Keep its position on the camera. */
export function createStormSky() {
  const uniforms = { uTime: { value: 0 }, uFlash: { value: 0 } };
  const m = new THREE.ShaderMaterial({ uniforms, vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false, fog: false });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), m);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return { mesh, uniforms };
}
/** Fog colour that matches the sky horizon so distant blocks melt into the haze. */
export const HAZE = "#3a322f";

// ---------- trees ----------
export type TreeKind = "birch" | "poplar" | "maple" | "spruce";
export interface TreeSpec { x: number; y: number; z: number; h: number; kind: TreeKind; seed: number }

const UP = new THREE.Vector3(0, 1, 0);
function tag(g: THREE.BufferGeometry, base: THREE.Vector3, h: number, color: THREE.Color) {
  const n = g.attributes.position.count;
  const tr = new Float32Array(n * 4), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    tr[i * 4] = base.x; tr[i * 4 + 1] = base.y; tr[i * 4 + 2] = base.z; tr[i * 4 + 3] = h;
    col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b;
  }
  g.setAttribute("aTree", new THREE.BufferAttribute(tr, 4));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}
function limb(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, seg: number) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, true);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}
const LEAF_COLORS: Record<TreeKind, string[]> = {
  birch: ["#c9a227", "#b48a1e", "#d6b33a", "#9c8a2c"],
  poplar: ["#8a6a22", "#6f5a24", "#9a7a2a", "#5d5a2a"],
  maple: ["#b5521d", "#9a3a18", "#c47a22", "#7a4a1e"],
  spruce: ["#1f3324", "#243a28"],
};

/** Merges every tree into three draw calls (bark, leaves, needles) that sway together on the GPU. */
export function buildTrees(specs: TreeSpec[], lite: boolean, kit: Kit) {
  const bark: THREE.BufferGeometry[] = [], leaves: THREE.BufferGeometry[] = [], needles: THREE.BufferGeometry[] = [];
  const tmpCol = new THREE.Color();
  for (const s of specs) {
    const r = rand(s.seed);
    const base = new THREE.Vector3(s.x, s.y, s.z);
    const barkCol = new THREE.Color(s.kind === "birch" ? "#e4e2da" : s.kind === "spruce" ? "#3a2c22" : "#4a4038");
    if (s.kind === "spruce") {
      bark.push(tag(limb(base, base.clone().add(new THREE.Vector3(0, s.h, 0)), s.h * 0.025, 0.02, 6), base, s.h, barkCol));
      const tiers = 6;
      for (let i = 0; i < tiers; i++) {
        const y = s.h * (0.15 + (i / tiers) * 0.8), rad = s.h * 0.27 * (1 - i / (tiers + 0.6)), hh = s.h * 0.28;
        const cone = new THREE.ConeGeometry(rad, hh, 9, 1);
        cone.rotateY(r() * 3); cone.translate(s.x, s.y + y + hh / 2, s.z);
        needles.push(tag(cone, base, s.h, tmpCol.set(LEAF_COLORS.spruce[i % 2]).clone()));
      }
      continue;
    }
    const trunkFrac = s.kind === "poplar" ? 0.18 : s.kind === "birch" ? 0.3 : 0.32;
    const spread = s.kind === "poplar" ? 0.38 : s.kind === "birch" ? 0.75 : 0.95;
    const density = s.kind === "maple" ? 3 : s.kind === "birch" ? 3 : 2;
    const palette = LEAF_COLORS[s.kind];
    const leafAt = (p: THREE.Vector3) => {
      for (let k = 0; k < density; k++) {
        const size = (0.9 + r() * 0.6) * Math.min(1.3, s.h / 10);
        const card = new THREE.PlaneGeometry(size, size);
        card.rotateX(r() * Math.PI); card.rotateY(r() * Math.PI * 2); card.rotateZ(r() * Math.PI);
        card.translate(p.x + (r() - 0.5) * 0.7, p.y + (r() - 0.5) * 0.5, p.z + (r() - 0.5) * 0.7);
        const c = tmpCol.set(palette[Math.floor(r() * palette.length)]).clone().multiplyScalar(0.8 + r() * 0.4);
        leaves.push(tag(card, base, s.h, c));
      }
    };
    const grow = (a: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number, depth: number) => {
      const b = a.clone().addScaledVector(dir, len);
      bark.push(tag(limb(a, b, rad, rad * 0.62, depth >= 1 ? 5 : 3), base, s.h, barkCol));
      if (depth === 0) { if (r() < 0.85) leafAt(b); return; }
      for (let k = 0; k < 2; k++) {
        const p = a.clone().lerp(b, 0.55 + r() * 0.45);
        const axis = new THREE.Vector3(r() - 0.5, (r() - 0.5) * 0.3, r() - 0.5).normalize();
        const nd = dir.clone().applyAxisAngle(axis, spread * (0.5 + r() * 0.6));
        if (s.kind === "poplar") nd.lerp(UP, 0.45).normalize();
        if (s.kind === "birch" && depth === 1) { nd.y -= 0.35; nd.normalize(); }
        grow(p, nd, len * (0.58 + r() * 0.14), rad * 0.58, depth - 1);
      }
    };
    // Leader: a slightly wandering trunk with lateral branches at every node above the bole.
    let prev = base.clone();
    const nodes = 5;
    for (let i = 1; i <= nodes; i++) {
      const y = s.h * (trunkFrac + (1 - trunkFrac) * (i / nodes) * 0.92);
      const p = new THREE.Vector3(s.x + (r() - 0.5) * 0.25 * i * 0.3, s.y + y, s.z + (r() - 0.5) * 0.25 * i * 0.3);
      const rad = s.h * 0.022 * (1 - (i - 1) / (nodes + 1));
      bark.push(tag(limb(prev, p, rad * 1.25, rad, 7), base, s.h, barkCol));
      if (i === 1 && trunkFrac > 0.2) { prev = p; continue; }
      const count = s.kind === "poplar" ? 3 : 3;
      for (let k = 0; k < count; k++) {
        const ang = (k / count) * Math.PI * 2 + r() * 1.2 + i;
        const tilt = s.kind === "poplar" ? 0.35 + r() * 0.2 : s.kind === "birch" ? 0.75 + r() * 0.3 : 0.9 + r() * 0.35;
        const dir = new THREE.Vector3(Math.cos(ang) * Math.sin(tilt), Math.cos(tilt), Math.sin(ang) * Math.sin(tilt)).normalize();
        const remaining = (s.h - y) / s.h;
        const len = s.h * (s.kind === "poplar" ? 0.22 : 0.3) * (0.5 + remaining * 0.8);
        grow(p, dir, len, rad * 0.55, 2);
      }
      prev = p;
    }
    leafAt(prev);
  }
  const group = new THREE.Group();
  const add = (geos: THREE.BufferGeometry[], m: THREE.Material, leaf: boolean) => {
    if (!geos.length) return;
    windify(m, leaf);
    const mesh = new THREE.Mesh(mergeGeometries(geos), m);
    mesh.frustumCulled = false;
    group.add(mesh);
  };
  add(bark, mat(lite, { map: kit.bark, vertexColors: true, roughness: 0.95 }), false);
  add(leaves, mat(lite, { map: kit.leaf, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9 }), true);
  add(needles, mat(lite, { color: "#ffffff", vertexColors: true, roughness: 1 }), false);
  return group;
}

/** Random tree mix for a strip of ground. */
export function scatterTrees(out: TreeSpec[], r: () => number, n: number, x0: number, x1: number, z0: number, z1: number, y: number, kinds: TreeKind[], h0: number, h1: number) {
  for (let i = 0; i < n; i++) {
    out.push({ x: x0 + r() * (x1 - x0), z: z0 + r() * (z1 - z0), y, h: h0 + r() * (h1 - h0), kind: kinds[Math.floor(r() * kinds.length)], seed: Math.floor(r() * 1e9) });
  }
}

// ---------- panel blocks ----------
interface WindowSet { mesh: THREE.InstancedMesh; mats: THREE.Matrix4[]; on: boolean[]; tv: number[]; colors: THREE.Color[] }
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const WARM = ["#ffbf6e", "#ffd69a", "#ffae55", "#f7c98a", "#ffe2b5"];
const COOL = ["#dbe6ff", "#c6d6f2"];

export interface BlockOpts { len: number; depth: number; floors: number; seed: number; lit?: number; floorH?: number; entrances?: number[]; balconies?: number; aviation?: boolean; roof?: boolean }
export interface Block { group: THREE.Group; windows: WindowSet; beacons: THREE.Mesh[] }

/** A Soviet 9–16 storey panel block: textured facade, balconies, entrances, roof clutter and lit windows. */
export function buildBlock(kit: Kit, o: BlockOpts): Block {
  const r = rand(o.seed);
  const fh = o.floorH ?? 2.8;
  const H = o.floors * fh;
  const group = new THREE.Group();
  const lenBays = Math.max(1, Math.round(o.len / 3.2)), depBays = Math.max(1, Math.round(o.depth / 3.2));
  const bwL = o.len / lenBays, bwD = o.depth / depBays;
  const face = (bays: number) => {
    const t = kit.bay.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(bays, o.floors); t.needsUpdate = true;
    return mat(kit.lite, { map: t, roughness: 0.95 });
  };
  const side = face(depBays), front = face(lenBays);
  const body = new THREE.Mesh(new THREE.BoxGeometry(o.len, H, o.depth), [side, side, kit.roof, kit.roof, front, front]);
  body.position.y = H / 2; group.add(body);
  // plinth
  group.add(new THREE.Mesh(boxGeo(o.len + 0.1, 0.6, o.depth + 0.1, 0, -0.6, 0), kit.roof));

  // lit windows (instanced quads over the glass)
  const slots: THREE.Matrix4[] = [];
  const entranceBays = new Set((o.entrances ?? []).map((x) => Math.floor((x + o.len / 2) / bwL)));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
  const addSlot = (x: number, y: number, z: number, ry: number) => { q.setFromEuler(e.set(0, ry, 0)); slots.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, one)); };
  for (let f = 0; f < o.floors; f++) {
    const y = (f + 0.586) * fh;
    for (let i = 0; i < lenBays; i++) {
      const x = -o.len / 2 + (i + 0.5) * bwL;
      if (!(f === 0 && entranceBays.has(i))) addSlot(x, y, o.depth / 2 + 0.03, 0);
      addSlot(x, y, -o.depth / 2 - 0.03, Math.PI);
    }
    for (let i = 0; i < depBays; i++) {
      const z = -o.depth / 2 + (i + 0.5) * bwD;
      addSlot(o.len / 2 + 0.03, y, z, Math.PI / 2);
      addSlot(-o.len / 2 - 0.03, y, z, -Math.PI / 2);
    }
  }
  const winGeo = new THREE.PlaneGeometry(bwL * 0.505, fh * 0.46);
  const winMat = new THREE.MeshBasicMaterial({ map: kit.litWin, color: "#ffffff" });
  const mesh = new THREE.InstancedMesh(winGeo, winMat, slots.length);
  const on: boolean[] = [], tv: number[] = [], colors: THREE.Color[] = [];
  const litChance = o.lit ?? 0.28;
  slots.forEach((s, i) => {
    const lit = r() < litChance;
    on.push(lit);
    mesh.setMatrixAt(i, lit ? s : ZERO);
    const roll = r();
    const c = new THREE.Color(roll < 0.08 ? "#8fb0ff" : roll < 0.25 ? COOL[Math.floor(r() * COOL.length)] : WARM[Math.floor(r() * WARM.length)]);
    c.multiplyScalar(0.55 + r() * 0.45);
    if (roll < 0.08) tv.push(i);
    colors.push(c);
    mesh.setColorAt(i, c);
  });
  mesh.frustumCulled = false;
  group.add(mesh);

  // balconies in whole columns on the front face
  const balc: THREE.BufferGeometry[] = [];
  for (let i = 0; i < lenBays; i++) {
    if (entranceBays.has(i) || r() > (o.balconies ?? 0.4)) continue;
    const x = -o.len / 2 + (i + 0.5) * bwL, w = bwL * 0.82, zf = o.depth / 2;
    for (let f = 1; f < o.floors; f++) {
      const y = f * fh;
      balc.push(boxGeo(w, 0.14, 1.1, x, y - 0.14, zf + 0.55));
      balc.push(boxGeo(w, 1.0, 0.08, x, y, zf + 1.06));
      balc.push(boxGeo(0.08, 1.0, 1.1, x - w / 2, y, zf + 0.55));
      balc.push(boxGeo(0.08, 1.0, 1.1, x + w / 2, y, zf + 0.55));
    }
  }
  if (balc.length) group.add(mergedMesh(balc, kit.concrete));

  // entrances: door, canopy, warm lamp and its pool of light
  for (const x of o.entrances ?? []) {
    const zf = o.depth / 2;
    group.add(new THREE.Mesh(boxGeo(1.4, 2.15, 0.12, x, 0, zf + 0.04), kit.darkMetal));
    group.add(new THREE.Mesh(boxGeo(2.6, 0.16, 1.6, x, 2.55, zf + 0.8), kit.concrete));
    group.add(new THREE.Mesh(boxGeo(2.0, 0.6, 1.6, x, -0.6, zf + 0.8), kit.concrete));
    const lamp = new THREE.Mesh(boxGeo(0.3, 0.1, 0.1, x, 2.35, zf + 0.14), new THREE.MeshBasicMaterial({ color: "#ffd79a" }));
    group.add(lamp);
    const s = glowSprite(kit, "#ffb867", 2.2); s.position.set(x, 2.4, zf + 0.3); group.add(s);
    const p = lightPool(kit, "#ffa048", 3.4, 0.42); p.position.set(x, -0.56, zf + 2.2); group.add(p);
  }

  // roof: parapet, lift machine rooms, antennas
  const roof: THREE.BufferGeometry[] = [
    boxGeo(o.len, 0.7, 0.2, 0, H, o.depth / 2 - 0.1), boxGeo(o.len, 0.7, 0.2, 0, H, -o.depth / 2 + 0.1),
    boxGeo(0.2, 0.7, o.depth, o.len / 2 - 0.1, H, 0), boxGeo(0.2, 0.7, o.depth, -o.len / 2 + 0.1, H, 0),
  ];
  for (const x of o.entrances ?? [0]) {
    roof.push(boxGeo(3.2, 2.6, 4, x, H, -o.depth * 0.15));
    for (let k = 0; k < 2; k++) {
      const ax = x + (r() - 0.5) * 6, az = (r() - 0.5) * o.depth * 0.6;
      roof.push(cylGeo(0.03, 0.03, 2.6, ax, H, az, 5));
      roof.push(boxGeo(1.2, 0.04, 0.04, ax, H + 2.2, az));
    }
  }
  if (o.roof !== false) group.add(mergedMesh(roof, kit.roof));
  const beacons: THREE.Mesh[] = [];
  if (o.aviation) {
    const bm = new THREE.MeshBasicMaterial({ color: "#ff2a1a", fog: false });
    for (const x of [-o.len / 2 + 0.4, o.len / 2 - 0.4]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), bm); b.position.set(x, H + 1, 0); group.add(b); beacons.push(b);
    }
  }
  return { group, windows: { mesh, mats: slots, on, tv, colors }, beacons };
}

/** Keeps windows living: lights go on and off, TVs flicker. */
export class WindowLife {
  private sets: WindowSet[] = [];
  private tick = 0;
  private tvT = 0;
  add(b: Block) { this.sets.push(b.windows); }
  update(dt: number) {
    this.tick -= dt; this.tvT -= dt;
    if (this.tick <= 0 && this.sets.length) {
      this.tick = 0.5 + Math.random() * 1.6;
      const s = this.sets[Math.floor(Math.random() * this.sets.length)];
      const i = Math.floor(Math.random() * s.mats.length);
      s.on[i] = !s.on[i] || Math.random() < 0.3;
      s.mesh.setMatrixAt(i, s.on[i] ? s.mats[i] : ZERO);
      s.mesh.instanceMatrix.needsUpdate = true;
    }
    if (this.tvT <= 0) {
      this.tvT = 0.12;
      const c = new THREE.Color();
      for (const s of this.sets) {
        if (!s.tv.length) continue;
        for (const i of s.tv) { c.copy(s.colors[i]).multiplyScalar(0.5 + Math.random() * 0.8); s.mesh.setColorAt(i, c); }
        s.mesh.instanceColor.needsUpdate = true;
      }
    }
  }
}

// ---------- street furniture ----------
export function buildLamp(kit: Kit, x: number, y: number, z: number, ry: number, h = 6.2, pool = true) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry;
  g.add(new THREE.Mesh(cylGeo(0.07, 0.11, h, 0, 0, 0, 8), kit.metal));
  const arm = new THREE.Mesh(boxGeo(1.6, 0.07, 0.07, 0.75, h - 0.15, 0), kit.metal); arm.rotation.z = -0.06; g.add(arm);
  g.add(new THREE.Mesh(boxGeo(0.62, 0.16, 0.32, 1.5, h - 0.32, 0), kit.darkMetal));
  g.add(new THREE.Mesh(boxGeo(0.52, 0.03, 0.24, 1.5, h - 0.34, 0), new THREE.MeshBasicMaterial({ color: "#ffe2b0" })));
  const s = glowSprite(kit, "#ffb35a", 3.2); s.position.set(1.5, h - 0.45, 0); g.add(s);
  if (pool) { const p = lightPool(kit, "#ff9f45", 4.6, 0.5); p.position.set(1.7, 0.04, 0); g.add(p); }
  return g;
}

export function buildCat(lite: boolean, fur = "#2b2724") {
  const g = new THREE.Group();
  const m = mat(lite, { color: fur, roughness: 1 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), m); body.scale.set(1, 1.35, 1.25); body.position.set(0, 0.13, -0.02); g.add(body);
  const head = new THREE.Group(); head.position.set(0, 0.29, 0.06); g.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10), m); skull.scale.set(1.05, 0.95, 1); head.add(skull);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.05, 4), m); ear.position.set(sx * 0.038, 0.06, -0.005); ear.rotation.z = -sx * 0.25; head.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), new THREE.MeshBasicMaterial({ color: "#b9c94a" })); eye.position.set(sx * 0.026, 0.01, 0.058); head.add(eye);
  }
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), m); snout.scale.set(1.1, 0.75, 0.9); snout.position.set(0, -0.022, 0.055); head.add(snout);
  for (const sx of [-1, 1]) { const paw = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), m); paw.scale.set(1, 0.6, 1.4); paw.position.set(sx * 0.04, 0.015, 0.08); g.add(paw); }
  const tail = new THREE.Group(); tail.position.set(0, 0.04, -0.12); g.add(tail);
  const t1 = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.2, 6), m); t1.rotation.x = Math.PI / 2 - 0.2; t1.position.set(0, 0.01, -0.09); tail.add(t1);
  const tip = new THREE.Group(); tip.position.set(0, 0.03, -0.19); tail.add(tip);
  const t2 = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.014, 0.16, 6), m); t2.position.set(0, 0.07, 0); tip.add(t2);
  return { group: g, head, tail, tip };
}

function buildPedestrian(lite: boolean) {
  const g = new THREE.Group();
  const coat = mat(lite, { color: "#26272b", roughness: 1 });
  const legs: THREE.Object3D[] = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(sx * 0.1, 0.85, 0); g.add(pivot);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.85, 0.15), coat); leg.position.y = -0.42; pivot.add(leg);
    legs.push(pivot);
  }
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.75, 8), coat); torso.position.y = 1.22; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), mat(lite, { color: "#a07c66" })); head.position.y = 1.72; g.add(head);
  const um = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.3, 10, 1, true), mat(lite, { color: "#3a1418", side: THREE.DoubleSide })); um.position.set(0.05, 2.05, 0.05); g.add(um);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.75, 4), coat); stick.position.set(0.05, 1.7, 0.05); g.add(stick);
  return { group: g, legs, umbrella: um };
}

function buildPlayground(kit: Kit, lite: boolean) {
  const g = new THREE.Group();
  const red = mat(lite, { color: "#8a2a1e", roughness: 0.7, metalness: 0.3 });
  const blue = mat(lite, { color: "#2a4a7a", roughness: 0.7, metalness: 0.3 });
  const yellow = mat(lite, { color: "#a88a22", roughness: 0.7 });
  // swing: A-frames, top bar, seat on chains (pivot swings in the wind)
  for (const x of [-1.1, 1.1]) for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(cylGeo(0.04, 0.04, 2.5, 0, 0, 0, 6), blue); leg.position.set(x, 0, s * 0.55); leg.rotation.x = s * 0.22; g.add(leg);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.4, 6), blue); bar.rotation.z = Math.PI / 2; bar.position.set(0, 2.42, 0); g.add(bar);
  const swing = new THREE.Group(); swing.position.set(0, 2.4, 0); g.add(swing);
  for (const x of [-0.25, 0.25]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.9, 4), kit.metal); c.position.set(x, -0.95, 0); swing.add(c); }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.25), red); seat.position.set(0, -1.9, 0); swing.add(seat);
  // slide
  const slide = new THREE.Group(); slide.position.set(4.2, 0, 1.5); g.add(slide);
  slide.add(new THREE.Mesh(boxGeo(0.9, 0.06, 0.9, 0, 1.5, 0), yellow));
  for (const [x, z] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) slide.add(new THREE.Mesh(cylGeo(0.035, 0.035, 1.5, x, 0, z, 6), blue));
  const chute = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 2.4), red); chute.position.set(0, 0.82, 1.45); chute.rotation.x = 0.64; slide.add(chute);
  const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 1.7), kit.metal); ladder.position.set(0, 0.8, -0.9); ladder.rotation.x = -1.05; slide.add(ladder);
  // carousel: turns slowly by itself in the wind
  const carousel = new THREE.Group(); carousel.position.set(2.2, 0, 4.5); g.add(carousel);
  carousel.add(new THREE.Mesh(cylGeo(1.1, 1.1, 0.08, 0, 0.25, 0, 18), red));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const hb = new THREE.Mesh(boxGeo(0.04, 0.6, 0.04, Math.cos(a) * 0.8, 0.33, Math.sin(a) * 0.8), kit.metal); carousel.add(hb);
  }
  carousel.add(new THREE.Mesh(cylGeo(0.05, 0.05, 0.9, 0, 0.3, 0, 6), kit.metal));
  // sandbox
  g.add(new THREE.Mesh(boxGeo(2.2, 0.25, 0.12, -2.4, 0, 3.0), kit.wood));
  g.add(new THREE.Mesh(boxGeo(2.2, 0.25, 0.12, -2.4, 0, 5.1), kit.wood));
  g.add(new THREE.Mesh(boxGeo(0.12, 0.25, 2.2, -3.5, 0, 4.05), kit.wood));
  g.add(new THREE.Mesh(boxGeo(0.12, 0.25, 2.2, -1.3, 0, 4.05), kit.wood));
  g.add(new THREE.Mesh(boxGeo(2.1, 0.12, 2.0, -2.4, 0, 4.05), mat(lite, { color: "#6b5a3e" })));
  // benches
  for (const [x, z, ry] of [[-4.2, 0.5, Math.PI / 2], [6.5, 4.8, -Math.PI / 2]] as const) {
    const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = ry; g.add(b);
    b.add(new THREE.Mesh(boxGeo(1.7, 0.05, 0.42, 0, 0.45, 0), kit.wood));
    b.add(new THREE.Mesh(boxGeo(1.7, 0.35, 0.05, 0, 0.55, -0.2), kit.wood));
    for (const sx of [-0.7, 0.7]) b.add(new THREE.Mesh(boxGeo(0.06, 0.45, 0.4, sx, 0, 0), kit.darkMetal));
  }
  // low fence around it
  const fence: THREE.BufferGeometry[] = [];
  const fx0 = -5, fx1 = 7.5, fz0 = -1.6, fz1 = 6.4;
  for (const [a, b, z] of [[fx0, fx1, fz0], [fx0, fx1, fz1]] as const) { fence.push(boxGeo(b - a, 0.04, 0.04, (a + b) / 2, 0.75, z)); for (let x = a; x <= b; x += 1.25) fence.push(boxGeo(0.04, 0.8, 0.04, x, 0, z)); }
  for (const x of [fx0, fx1]) { fence.push(boxGeo(0.04, 0.04, fz1 - fz0, x, 0.75, (fz0 + fz1) / 2)); for (let z = fz0; z <= fz1; z += 1.25) fence.push(boxGeo(0.04, 0.8, 0.04, x, 0, z)); }
  g.add(mergedMesh(fence, kit.metal));
  return { group: g, swing, carousel };
}

function buildGarbage(kit: Kit, lite: boolean) {
  const g = new THREE.Group();
  const brick = mat(lite, { color: "#6a3a2a", roughness: 1 });
  g.add(new THREE.Mesh(boxGeo(5, 1.6, 0.2, 0, 0, -1.1), brick));
  g.add(new THREE.Mesh(boxGeo(0.2, 1.6, 2.2, -2.5, 0, 0), brick));
  g.add(new THREE.Mesh(boxGeo(0.2, 1.6, 2.2, 2.5, 0, 0), brick));
  const green = mat(lite, { color: "#2e4a33", roughness: 0.8, metalness: 0.3 });
  for (const x of [-1.5, 0, 1.5]) {
    g.add(new THREE.Mesh(boxGeo(1.2, 1.05, 0.95, x, 0, -0.4), green));
    const lid = new THREE.Mesh(boxGeo(1.24, 0.05, 1.0, 0, 0, 0), green); lid.position.set(x, 1.05, -0.4); lid.rotation.x = x === 0 ? -0.5 : 0; g.add(lid);
  }
  const bag = mat(lite, { color: "#151515", roughness: 0.6 });
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), bag); b.scale.y = 0.75; b.position.set(-1.8 + i * 1.1, 0.18, 0.5 + (i % 2) * 0.2); g.add(b); }
  return g;
}

function buildGarages(kit: Kit, lite: boolean, n: number, seed: number) {
  const r = rand(seed);
  const g = new THREE.Group();
  const wall = mat(lite, { color: "#5a5852", roughness: 1 });
  const doorCols = ["#3c4a3a", "#4a3a2a", "#2e3e52", "#5a2a24", "#45484a"];
  for (let i = 0; i < n; i++) {
    const x = i * 3.2;
    g.add(new THREE.Mesh(boxGeo(3.1, 2.4, 6, x, 0, 0), wall));
    const door = mat(lite, { color: doorCols[Math.floor(r() * doorCols.length)], roughness: 0.6, metalness: 0.4 });
    g.add(new THREE.Mesh(boxGeo(2.5, 2.0, 0.06, x, 0, 3.02), door));
    g.add(new THREE.Mesh(boxGeo(3.2, 0.12, 6.3, x, 2.4, 0.1), kit.roof));
  }
  const s = glowSprite(kit, "#ffd4a0", 1.4); s.position.set(n * 1.6, 2.6, 3.2); g.add(s);
  return g;
}

/** A car that drives through every so often, headlights blazing; stops and honks if someone is in its lane. */
export class PassingCar {
  car: CarModel;
  private along = 0;
  private dir = 1;
  private wait: number;
  private speed = 0;
  private honked = false;
  active = false;
  constructor(parent: THREE.Object3D, private kit: Kit, lite: boolean, color: string,
    private o: { axis: "x" | "z"; lane: number; laneOffset: number; y: number; from: number; to: number; cruise: number; gap: [number, number] }, private onHonk?: () => void) {
    this.car = buildCar(lite, color);
    for (const s of this.car.headlights) { s.parent?.remove(s); s.target.parent?.remove(s.target); }
    this.car.headlights = [];
    this.car.headGlow.color.set("#fff4d6"); this.car.tailGlow.color.set("#ff2a1c");
    const beam = new THREE.MeshBasicMaterial({ color: "#fff0c8", transparent: true, opacity: 0.06, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    for (const x of [-0.62, 0.62]) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(1.3, 9, 14, 1, true), beam);
      c.rotation.x = Math.PI / 2 + 0.06; c.position.set(x, 0.62, -2.4 - 4.5); this.car.group.add(c);
      const hs = glowSprite(kit, "#fff2d0", 0.9); hs.position.set(x, 0.66, -2.45); this.car.group.add(hs);
      const ts = glowSprite(kit, "#ff3020", 0.5); ts.position.set(x, 0.75, 2.45); this.car.group.add(ts);
    }
    const pool = lightPool(kit, "#fff0d0", 3.5, 0.35); pool.scale.set(0.9, 2.2, 1); pool.position.set(0, 0.03, -8.5); this.car.group.add(pool);
    parent.add(this.car.group);
    this.car.group.visible = false;
    this.wait = 2 + Math.random() * 6;
  }
  private place() {
    const g = this.car.group, o = this.o;
    const lane = o.lane + o.laneOffset * this.dir;
    if (o.axis === "x") { g.position.set(this.along, o.y, lane); g.rotation.y = this.dir > 0 ? -Math.PI / 2 : Math.PI / 2; }
    else { g.position.set(lane, o.y, this.along); g.rotation.y = this.dir > 0 ? Math.PI : 0; }
  }
  /** World-space footprint when active, for player collisions. */
  footprint(): [number, number, number, number] | null {
    if (!this.active) return null;
    const p = this.car.group.position, hx = this.o.axis === "x" ? 2.4 : 1.0, hz = this.o.axis === "x" ? 1.0 : 2.4;
    return [p.x - hx, p.z - hz, p.x + hx, p.z + hz];
  }
  update(dt: number, allow: boolean, player?: THREE.Vector3) {
    if (!allow) { this.active = false; this.car.group.visible = false; return; }
    if (!this.active) {
      this.wait -= dt;
      if (this.wait > 0) return;
      this.active = true; this.honked = false; this.dir = Math.random() < 0.5 ? 1 : -1;
      this.along = this.dir > 0 ? this.o.from : this.o.to; this.speed = this.o.cruise;
      this.car.group.visible = true;
    }
    let target = this.o.cruise;
    if (player) {
      const lane = this.o.lane + this.o.laneOffset * this.dir;
      const lat = this.o.axis === "x" ? player.z - lane : player.x - lane;
      const ahead = ((this.o.axis === "x" ? player.x : player.z) - this.along) * this.dir;
      if (Math.abs(lat) < 1.7 && ahead > 0 && ahead < 14) {
        target = ahead < 4.2 ? 0 : this.o.cruise * Math.min(1, (ahead - 4.2) / 9);
        if (!this.honked && ahead < 11) { this.honked = true; this.onHonk?.(); }
      }
    }
    this.speed = THREE.MathUtils.damp(this.speed, target, target < this.speed ? 3.5 : 0.8, dt);
    this.along += this.speed * this.dir * dt;
    this.car.wheels.forEach((w) => { w.rotation.x -= (this.speed * dt) / 0.33; });
    this.place();
    if (this.along > this.o.to + 1 || this.along < this.o.from - 1) {
      this.active = false; this.car.group.visible = false;
      this.wait = this.o.gap[0] + Math.random() * (this.o.gap[1] - this.o.gap[0]);
    }
  }
}

// ---------- falling leaves ----------
const leafVert = /* glsl */ `
uniform float uTime; uniform float uWind; uniform vec3 uCenter; uniform float uSize; uniform float uHeight;
attribute vec3 aRnd;
varying vec3 vCol; varying float vRot;
void main(){
  vec3 p = position;
  float t = uTime * (0.35 + aRnd.x * 0.4);
  float y = mod(p.y - uTime * (0.45 + aRnd.y * 0.5), uHeight);
  vec3 w;
  float dx = uTime * uWind * (1.1 + aRnd.z) + sin(t * 2.0 + aRnd.x * 20.0) * 0.6;
  w.x = uCenter.x + mod(p.x + dx - uCenter.x + uSize * 0.5, uSize) - uSize * 0.5;
  w.z = uCenter.z + mod(p.z + cos(t * 1.7 + aRnd.y * 9.0) * 0.5 - uCenter.z + uSize * 0.5, uSize) - uSize * 0.5;
  w.y = uCenter.y + y;
  vec4 mv = viewMatrix * vec4(w, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (90.0 + aRnd.x * 60.0) / -mv.z;
  vCol = mix(vec3(0.55,0.32,0.08), vec3(0.62,0.5,0.12), aRnd.y);
  vRot = t * 3.0 + aRnd.z * 6.28;
}`;
const leafFrag = /* glsl */ `
uniform float uLight;
varying vec3 vCol; varying float vRot;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float s = sin(vRot), co = cos(vRot);
  c = vec2(c.x * co - c.y * s, c.x * s + c.y * co);
  float d = length(vec2(c.x * 2.2, c.y));
  if (d > 0.48) discard;
  gl_FragColor = vec4(vCol * uLight, 1.0);
  #include <colorspace_fragment>
}`;
export function createFallingLeaves(count: number, size: number, height: number) {
  const pos = new Float32Array(count * 3), rnd = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos.set([Math.random() * size, Math.random() * height, Math.random() * size], i * 3);
    rnd.set([Math.random(), Math.random(), Math.random()], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aRnd", new THREE.BufferAttribute(rnd, 3));
  const uniforms = { uTime: wind.uTime, uWind: wind.uWind, uCenter: { value: new THREE.Vector3() }, uSize: { value: size }, uHeight: { value: height }, uLight: { value: 0.35 } };
  const m = new THREE.ShaderMaterial({ uniforms, vertexShader: leafVert, fragmentShader: leafFrag });
  const mesh = new THREE.Points(g, m);
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

// ---------- power lines ----------
function buildWires(kit: Kit, poles: THREE.Vector3[], h: number) {
  const g = new THREE.Group();
  const lines: { line: THREE.Line; a: THREE.Vector3; b: THREE.Vector3; ph: number }[] = [];
  const wm = new THREE.LineBasicMaterial({ color: "#0c0d0e" });
  for (const p of poles) {
    g.add(new THREE.Mesh(cylGeo(0.12, 0.16, h, p.x, p.y, p.z, 6), kit.concrete));
    g.add(new THREE.Mesh(boxGeo(1.6, 0.1, 0.1, p.x, p.y + h - 0.6, p.z), kit.wood));
  }
  for (let i = 0; i + 1 < poles.length; i++) for (let k = -1; k <= 1; k += 2) {
    const a = poles[i].clone().add(new THREE.Vector3(k * 0.7, h - 0.55, 0)), b = poles[i + 1].clone().add(new THREE.Vector3(k * 0.7, h - 0.55, 0));
    const geo = new THREE.BufferGeometry().setFromPoints(new Array(16).fill(0).map(() => new THREE.Vector3()));
    const line = new THREE.Line(geo, wm); line.frustumCulled = false; g.add(line);
    lines.push({ line, a, b, ph: Math.random() * 6 });
  }
  const tmp = new THREE.Vector3();
  const update = (t: number, w: number) => {
    for (const l of lines) {
      const pos = l.line.geometry.attributes.position;
      for (let i = 0; i < 16; i++) {
        const f = i / 15, sag = Math.sin(f * Math.PI);
        tmp.lerpVectors(l.a, l.b, f);
        tmp.y -= sag * 1.1;
        tmp.x += sag * Math.sin(t * 1.4 + l.ph) * 0.18 * w;
        pos.setXYZ(i, tmp.x, tmp.y, tmp.z);
      }
      pos.needsUpdate = true;
    }
  };
  return { group: g, update };
}

// ---------- worlds ----------
export interface WorldCtx { flash: number; wind: number; player?: THREE.Vector3; allowTraffic?: boolean; t: number }
export interface LivingWorld { group: THREE.Group; update: (dt: number, c: WorldCtx) => void; obstacles?: () => ([number, number, number, number] | null)[] }

/** What the player sees from the 7th-floor windows: the courtyard seventeen metres below and the block across it. */
export function buildYardView(lite: boolean, G: number, kit = createKit(lite)): LivingWorld {
  const g = new THREE.Group();
  const r = rand(1987);
  const life = new WindowLife();
  const beacons: THREE.Mesh[] = [];
  // ground, sidewalk, driveways and footpaths
  kit.dirt.repeat.set(40, 40);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), mat(lite, { map: kit.dirt, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(5, G, -70); g.add(ground);
  const paveMat = mat(lite, { map: kit.pave, color: "#8a8a88", roughness: 0.7 });
  kit.pave.repeat.set(60, 2);
  g.add(new THREE.Mesh(boxGeo(130, 0.14, 2.6, 5, G, -1.3), paveMat));
  const drive = (z: number, w: number) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(150, w), kit.asphalt); m.rotation.x = -Math.PI / 2; m.position.set(5, G + 0.02, z); g.add(m); };
  drive(-5.8, 6.4); drive(-33, 5.5);
  for (const z of [-2.6, -9.0, -30.25, -35.75]) g.add(new THREE.Mesh(boxGeo(150, 0.16, 0.18, 5, G, z), kit.concrete));
  const path = mat(lite, { color: "#4c4a44", roughness: 0.9 });
  const fp = new THREE.Mesh(new THREE.PlaneGeometry(90, 1.6), path); fp.rotation.x = -Math.PI / 2; fp.position.set(5, G + 0.025, -13.6); g.add(fp);
  const fp2 = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 17), path); fp2.rotation.x = -Math.PI / 2; fp2.position.set(-10, G + 0.025, -21.5); g.add(fp2);
  // our building's facade below the windows (the wall we look down along)
  // Thin shell, rotated so its front (entrances) faces the yard; it tops out just under our floor.
  const ownBlock = buildBlock(kit, { len: 96, depth: 1, floors: 6, floorH: 2.7, seed: 7, lit: 0.3, entrances: [25, 0.5, -24], balconies: 0, roof: false });
  ownBlock.group.position.set(5, G + 0.55, 0.2); ownBlock.group.rotation.y = Math.PI; g.add(ownBlock.group); life.add(ownBlock);
  // parked cars along our driveway
  const cols = ["#6b2a24", "#d8d2c0", "#2a3a52", "#4a5a3a", "#8a7a52", "#1e1f22", "#7a1c1c"];
  for (const x of [-26, -19.5, -12, -2.5, 3.2, 14.5, 21, 33]) {
    const c = buildCar(lite, cols[Math.floor(r() * cols.length)]);
    for (const s of c.headlights) { s.parent?.remove(s); s.target.parent?.remove(s.target); }
    c.group.position.set(x, G + 0.02, -3.9 + r() * 0.3); c.group.rotation.y = Math.PI / 2 + (r() < 0.5 ? Math.PI : 0) + (r() - 0.5) * 0.06;
    g.add(c.group);
  }
  // lamps along the lawn, arms over the driveway
  const lampXs = [-24, -10, 4, 18, 32];
  lampXs.forEach((x) => g.add(buildLamp(kit, x, G, -9.8, Math.PI / 2)));
  if (!lite) for (const x of [4, 18]) { const l = new THREE.PointLight("#ffb466", 26, 18, 1.5); l.position.set(x, G + 5.6, -8.3); g.add(l); }
  // trees: two tall poplars right in front of the windows, birches on the lawn, a mix in the courtyard
  const trees: TreeSpec[] = [
    { x: 1.2, y: G, z: -11.2, h: 18.5, kind: "poplar", seed: 11 },
    { x: 10.4, y: G, z: -11.8, h: 16.8, kind: "poplar", seed: 12 },
  ];
  for (let x = -34; x < 46; x += 6 + r() * 3) if (Math.abs(x - 1.2) > 3 && Math.abs(x - 10.4) > 3) trees.push({ x, y: G, z: -10.6 - r() * 1.5, h: 9 + r() * 4, kind: r() < 0.7 ? "birch" : "maple", seed: Math.floor(r() * 1e9) });
  scatterTrees(trees, r, 14, -36, -12, -15, -29, G, ["maple", "birch", "poplar"], 8, 15);
  scatterTrees(trees, r, 10, 16, 48, -15, -29, G, ["maple", "birch", "poplar"], 8, 15);
  trees.push({ x: -6.5, y: G, z: -27, h: 9, kind: "spruce", seed: 3 }, { x: 13.5, y: G, z: -26.5, h: 7.5, kind: "spruce", seed: 4 }, { x: -8, y: G, z: -18, h: 6.5, kind: "spruce", seed: 5 });
  g.add(buildTrees(trees, lite, kit));
  // playground, garbage corner, garages
  const pg = buildPlayground(kit, lite); pg.group.position.set(2, G, -21); g.add(pg.group);
  const gb = buildGarbage(kit, lite); gb.position.set(-20, G, -15.5); g.add(gb);
  const gar = buildGarages(kit, lite, 8, 44); gar.position.set(26, G, -24); g.add(gar);
  [-3, 22].forEach((x) => { const lamp = buildLamp(kit, x, G, -16.5, -Math.PI / 2, 5.2); g.add(lamp); });
  // the block across the yard and the city behind it
  const opp = buildBlock(kit, { len: 100, depth: 12, floors: 9, seed: 21, lit: 0.27, entrances: [-36, -12, 12, 36] });
  opp.group.position.set(6, G + 0.6, -42.5); g.add(opp.group); life.add(opp);
  for (const x of [-36, -12, 12, 36]) for (const dx of [-7, 7]) { const c = buildCar(lite, cols[Math.floor(r() * cols.length)]); for (const s of c.headlights) { s.parent?.remove(s); s.target.parent?.remove(s.target); } c.group.position.set(6 + x + dx + r(), G + 0.02, -34.2); c.group.rotation.y = Math.PI / 2; if (r() < 0.6) g.add(c.group); }
  const far = [
    { x: -20, z: -100, len: 70, floors: 14, seed: 31, ry: 0 },
    { x: 60, z: -95, len: 60, floors: 16, seed: 32, ry: 0.15 },
    { x: 95, z: -50, len: 60, floors: 9, seed: 33, ry: Math.PI / 2 },
    { x: -85, z: -55, len: 60, floors: 12, seed: 34, ry: -Math.PI / 2 },
    { x: 20, z: -150, len: 90, floors: 12, seed: 35, ry: 0 },
  ];
  for (const f of far) {
    const b = buildBlock(kit, { len: f.len, depth: 12, floors: f.floors, seed: f.seed, lit: 0.22, entrances: [], balconies: 0.3, aviation: f.floors >= 14 });
    b.group.position.set(f.x, G + 0.6, f.z); b.group.rotation.y = f.ry; g.add(b.group); life.add(b); beacons.push(...b.beacons);
  }
  // distant factory chimney with blinking lights above the haze
  const chim = new THREE.Mesh(cylGeo(1.6, 3.2, 70, -70, G, -240, 12), kit.roof); g.add(chim);
  const bm = new THREE.MeshBasicMaterial({ color: "#ff2414", fog: false });
  for (const y of [25, 50, 70]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), bm); b.position.set(-70, G + y, -240); g.add(b); beacons.push(b); }
  // a car now and then, and a neighbour walking home under an umbrella
  const traffic = new PassingCar(g, kit, lite, "#c8c2b0", { axis: "x", lane: -6.9, laneOffset: 1.05, y: G + 0.02, from: -75, to: 80, cruise: 9, gap: [7, 18] });
  const walker = buildPedestrian(lite); g.add(walker.group);
  const route = [new THREE.Vector3(-38, G, -13.6), new THREE.Vector3(-10, G, -13.6), new THREE.Vector3(-10, G, -29), new THREE.Vector3(-10, G, -13.6), new THREE.Vector3(48, G, -13.6)];
  let leg = 0, legT = 0;
  return {
    group: g,
    update: (dt, c) => {
      life.update(dt);
      const blink = Math.sin(c.t * 2.2) > 0.6;
      for (const b of beacons) b.visible = blink;
      pg.swing.rotation.x = Math.sin(c.t * 1.9) * 0.18 * c.wind + Math.sin(c.t * 0.7) * 0.05;
      pg.carousel.rotation.y += dt * 0.12 * c.wind;
      traffic.update(dt, true);
      // walker
      const a = route[leg], b = route[(leg + 1) % route.length];
      const segLen = a.distanceTo(b);
      legT += (dt * 1.25) / Math.max(segLen, 0.01);
      if (legT >= 1) { legT = 0; leg = (leg + 1) % (route.length - 1); }
      walker.group.position.lerpVectors(a, b, Math.min(legT, 1));
      walker.group.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
      const sw = Math.sin(c.t * 6.5) * 0.45;
      walker.legs[0].rotation.x = sw; walker.legs[1].rotation.x = -sw;
      walker.umbrella.rotation.z = Math.sin(c.t * 1.3) * 0.08 * c.wind;
    },
  };
}

/** Brings the street outside the entrance to life: real blocks, swaying trees, a playground, leaves, wires and traffic. */
export function buildStreetLife(st: THREE.Group, lite: boolean, onHonk: () => void, kit = createKit(lite)): LivingWorld {
  const r = rand(4242);
  const life = new WindowLife();
  const beacons: THREE.Mesh[] = [];
  // courtyard behind the far fence
  kit.dirt.repeat.set(30, 30);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 180), mat(lite, { map: kit.dirt, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(101.5, -0.02, 5); st.add(ground);
  const blocks = [
    { x: 58, z: 6, len: 96, floors: 9, seed: 51, ry: -Math.PI / 2, ent: [-30, -6, 18, 42] },
    { x: 42, z: -48, len: 50, floors: 9, seed: 52, ry: 0, ent: [-10, 12] },
    { x: 100, z: 50, len: 70, floors: 14, seed: 53, ry: -Math.PI / 2 + 0.2, ent: [] },
    { x: 115, z: -40, len: 60, floors: 16, seed: 54, ry: -Math.PI / 2, ent: [] },
    { x: 40, z: 58, len: 44, floors: 12, seed: 55, ry: Math.PI, ent: [0] },
  ];
  for (const b of blocks) {
    const blk = buildBlock(kit, { len: b.len, depth: 12, floors: b.floors, seed: b.seed, lit: 0.26, entrances: b.ent, aviation: b.floors >= 14 });
    blk.group.position.set(b.x, 0.58, b.z); blk.group.rotation.y = b.ry; st.add(blk.group); life.add(blk); beacons.push(...blk.beacons);
  }
  // trees: along both sidewalks and through the courtyard
  const trees: TreeSpec[] = [
    { x: 18.6, y: 0, z: -1.6, h: 10.5, kind: "birch", seed: 61 },
    { x: 18.7, y: 0, z: 13.2, h: 9.5, kind: "maple", seed: 62 },
    { x: 18.5, y: 0, z: -9.5, h: 12, kind: "poplar", seed: 63 },
  ];
  for (let z = -24; z < 34; z += 4.2 + r() * 2) trees.push({ x: 32.8 + r() * 1.6, y: 0, z, h: 8 + r() * 5, kind: r() < 0.5 ? "birch" : r() < 0.5 ? "maple" : "poplar", seed: Math.floor(r() * 1e9) });
  scatterTrees(trees, r, 16, 36, 50, -30, 40, 0, ["maple", "birch", "poplar", "birch"], 8, 15);
  trees.push({ x: 45, y: 0, z: 13, h: 8, kind: "spruce", seed: 66 }, { x: 37, y: 0, z: -12, h: 7, kind: "spruce", seed: 67 });
  st.add(buildTrees(trees, lite, kit));
  const pg = buildPlayground(kit, lite); pg.group.position.set(40.5, 0, 0); pg.group.rotation.y = -Math.PI / 2; st.add(pg.group);
  const gb = buildGarbage(kit, lite); gb.position.set(37, 0, 26); gb.rotation.y = -Math.PI / 2; st.add(gb);
  for (const z of [-14, 8, 30]) st.add(buildLamp(kit, 35, 0, z, Math.PI, 5.2));
  // power line along the far sidewalk; wires sway in the wind
  const wires = buildWires(kit, [-34, -14, 6, 26, 46].map((z) => new THREE.Vector3(30.1, 0, z)), 8.5);
  st.add(wires.group);
  // drifting autumn leaves around the player
  const leaves = createFallingLeaves(lite ? 140 : 360, 26, 9);
  st.add(leaves.mesh);
  // traffic in both lanes; it brakes and honks for a pedestrian
  const traffic = new PassingCar(st, kit, lite, "#b8b2a2", { axis: "z", lane: 23.95, laneOffset: -0.55, y: -0.15, from: -40, to: 40, cruise: 10, gap: [9, 20] }, onHonk);
  return {
    group: st,
    obstacles: () => [traffic.footprint()],
    update: (dt, c) => {
      life.update(dt);
      const blink = Math.sin(c.t * 2.2) > 0.6;
      for (const b of beacons) b.visible = blink;
      pg.swing.rotation.x = Math.sin(c.t * 1.9) * 0.2 * c.wind + Math.sin(c.t * 0.7) * 0.05;
      pg.carousel.rotation.y += dt * 0.12 * c.wind;
      wires.update(c.t, c.wind);
      if (c.player) leaves.uniforms.uCenter.value.set(c.player.x, -0.2, c.player.z);
      leaves.uniforms.uLight.value = 0.3 + c.flash * 0.8;
      traffic.update(dt, c.allowTraffic !== false, c.player);
    },
  };
}
