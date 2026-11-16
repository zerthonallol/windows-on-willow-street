// @ts-nocheck -- prologue level written loosely; strict optional-property checks disabled for this file only.
// Prologue level: the player's 7th-floor apartment on a stormy night. Plain three.js, browser-only.
import * as THREE from "three";
import { Sfx } from "./audio";
import { createRain, Lightning } from "./atmosphere";
import { APARTMENT, CUTSCENE, voiceUrl, type Lang } from "./story";
import parquetUrl from "@/assets/apartment/parquet.jpg";
import wallpaperUrl from "@/assets/apartment/wallpaper.jpg";
import tileUrl from "@/assets/apartment/tile.jpg";
import rugUrl from "@/assets/apartment/rug.jpg";
import photoUrl from "@/assets/apartment/photo.jpg";
import { departureNext, canBeginMainGame, stairLap, hallFeature, START_FLOOR, STAIR_HEIGHT, type DepartureStage, type DepartureAction } from "./departure-rules";
import { movementDistance, normalizeMovement, PROLOGUE_STEP } from "./locomotion";
import { buildCar, setCarLights, type CarModel } from "./carModel";
import { buildYardView, buildStreetLife, buildBlock, buildCat, createKit, createStormSky, updateWind, HAZE, type Kit, type LivingWorld } from "./exterior";
import { NOTICES, paintNotice, type NoticeId } from "./notices";
import { buildRoad, fitCar, ROAD_ORIGIN, STOP_LATERAL, type RoadWorld } from "./roadTrip";
import { BATTERY_DIES_ON, CRUISE, DIE_AT, GATE, HEAD_OFF_Z, SPUTTER_AT, STOP_AT, canHeadOff, canLeaveCar, roadTask, trailDistance, walkable } from "./road-rules";

export interface AptHud { prompt: string; objective: string; subtitle: string; paused: boolean; flashlight: boolean; fade: number; note: { title: string; body: string } | null }
export interface AptCallbacks { onHud: (h: AptHud) => void; onProgress: (p: number) => void; onReady: () => void; onDone: () => void }

type Box = [number, number, number, number]; // minX, minZ, maxX, maxZ
type Zone = "apt" | "hall" | "stairs" | "street" | "road";
interface Spot { id: string; pos: THREE.Vector3; label: () => string; ok: () => boolean; use: () => void; zone?: Zone }

const H = STAIR_HEIGHT, T = 0.12, EYE = 1.65, R = 0.28;

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = true) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const context = c.getContext("2d");
  if (!context) throw new Error("Canvas context unavailable");
  draw(context);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const woodTex = (base: string, dark: string) => canvasTex(512, 512, (g) => {
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 140; i++) {
    g.strokeStyle = dark; g.globalAlpha = 0.08 + Math.random() * 0.18; g.lineWidth = 1 + Math.random() * 3;
    const y = Math.random() * 512; g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 6);
    g.stroke();
  }
  g.globalAlpha = 1;
});
const fabricTex = (base: string) => canvasTex(256, 256, (g) => {
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) for (let x = 0; x < 256; x += 2) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? "0,0,0" : "255,255,255"},${Math.random() * 0.08})`;
    g.fillRect(x, y, 2, 2);
  }
  g.strokeStyle = "rgba(0,0,0,0.12)";
  for (let i = 0; i < 256; i += 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); }
});
const plasterTex = () => canvasTex(256, 256, (g) => {
  g.fillStyle = "#d9d4c8"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(80,70,50,${Math.random() * 0.06})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
});
const brushedTex = () => canvasTex(512, 512, (g) => {
  g.fillStyle = "#9aa09d"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1800; i++) {
    const shade = 80 + Math.floor(Math.random() * 130);
    g.strokeStyle = `rgba(${shade},${shade},${shade},${0.025 + Math.random() * 0.07})`;
    g.lineWidth = Math.random() < 0.95 ? 1 : 2;
    const x = Math.random() * 512, y = Math.random() * 512;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.random() * 2 - 1, y + 20 + Math.random() * 180); g.stroke();
  }
  for (let i = 0; i < 22; i++) {
    g.strokeStyle = "rgba(45,50,48,0.18)"; g.lineWidth = 1;
    const x = Math.random() * 512, y = Math.random() * 512;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20 + Math.random() * 70, y + Math.random() * 9 - 4); g.stroke();
  }
  const grime = g.createLinearGradient(0, 350, 0, 512); grime.addColorStop(0, "rgba(30,35,32,0)"); grime.addColorStop(1, "rgba(30,35,32,0.28)");
  g.fillStyle = grime; g.fillRect(0, 350, 512, 162);
});
const linoTex = () => canvasTex(512, 512, (g) => {
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    g.fillStyle = (x + y) % 2 ? "#7b6a55" : "#a89478"; g.fillRect(x * 64, y * 64, 64, 64);
  }
  for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.07})`; g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); }
});
const quiltTex = () => canvasTex(256, 512, (g) => {
  g.fillStyle = "#3a2018"; g.fillRect(0, 0, 256, 512);
  g.strokeStyle = "#1c0f0b"; g.lineWidth = 3;
  for (let i = -512; i < 512; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 512, 512); g.stroke(); g.beginPath(); g.moveTo(i + 512, 0); g.lineTo(i, 512); g.stroke(); }
  g.fillStyle = "#b08a4a";
  for (let y = 0; y < 512; y += 64) for (let x = 0; x < 256; x += 64) { g.beginPath(); g.arc(x + 32, y, 4, 0, 7); g.fill(); }
}, false);
const dropsTex = () => canvasTex(512, 512, (g) => {
  g.clearRect(0, 0, 512, 512);
  for (let i = 0; i < 380; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, r = 1 + Math.random() * 3.5;
    g.fillStyle = `rgba(200,220,235,${0.15 + Math.random() * 0.3})`; g.beginPath(); g.ellipse(x, y, r * 0.8, r, 0, 0, 7); g.fill();
    if (Math.random() < 0.15) { g.strokeStyle = "rgba(200,220,235,0.18)"; g.lineWidth = r * 0.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.random() * 4 - 2, y + 30 + Math.random() * 80); g.stroke(); }
  }
});

export class Apartment {
  touch = { mx: 0, my: 0, lookX: 0, lookY: 0, sprint: false };
  readonly isTouch: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private sfx = new Sfx();
  private timer = new THREE.Timer();
  private raf = 0;
  private keys = new Set<string>();
  private pos = new THREE.Vector3(2.2, 0, 4.4);
  private yaw = 0.3;
  private pitch = 0;
  private boxes: Box[] = [];
  private spots: Spot[] = [];
  private focus: Spot | null = null;
  private done = new Set<string>();
  private loader: THREE.TextureLoader;
  private lightning = new Lightning();
  private rain!: ReturnType<typeof createRain>;
  private view!: THREE.MeshBasicMaterial;
  private storm!: THREE.DirectionalLight;
  private lamps: { light: THREE.PointLight; bulb: THREE.MeshStandardMaterial; base: number }[] = [];
  private tvLight!: THREE.PointLight;
  private tvScreen!: THREE.CanvasTexture;
  private tvOn = false;
  private led!: THREE.MeshBasicMaterial;
  private flash!: THREE.SpotLight;
  private flashOn = false;
  private voice: HTMLAudioElement | null = null;
  private subtitle = "";
  private stepT = 0;
  private hudT = 0;
  private blackout = 0;
  private finished = false;
  private hand: { keys: THREE.Object3D; flash: THREE.Object3D } = { keys: new THREE.Object3D(), flash: new THREE.Object3D() };
  private door!: THREE.Group;
  private doorOpen = 0;
  private departure: DepartureStage = "apartment";
  private departureTime = 0;
  private liftDoors: THREE.Mesh[] = [];
  private liftDisplay: THREE.CanvasTexture | null = null;
  private floorDisplay: THREE.CanvasTexture | null = null;
  private floor = START_FLOOR;
  private stairSigns: { i: number; tex: THREE.CanvasTexture }[] = [];
  private stairDoor!: THREE.Group;
  private stairDoorOpen = 1;
  private stairWin!: THREE.MeshBasicMaterial;
  private stairLight!: THREE.PointLight;
  private hallLight!: THREE.PointLight;
  private exitGroup!: THREE.Group;
  private exitFiller!: THREE.Mesh;
  private street!: THREE.Group;
  private streetSky!: THREE.MeshBasicMaterial;
  private streetRain!: ReturnType<typeof createRain>;
  private car!: CarModel;
  private seatEye = new THREE.Vector3();
  private engine: OscillatorNode | null = null;
  private accumulator = 0;
  private fade = 0;
  private driveDistance = 0;
  // living exterior
  private kit!: Kit;
  private yard!: LivingWorld;
  private yardRain!: ReturnType<typeof createRain>;
  private streetLife!: LivingWorld;
  private sky!: ReturnType<typeof createStormSky>;
  private windNow = 1;
  private badLamp: { light: THREE.PointLight | null; lens: THREE.MeshBasicMaterial; cone: THREE.Mesh; base: number } | null = null;
  private badLampT = 0;
  // stairwell life
  private liftGroup = new THREE.Group();
  private liftBtn!: THREE.MeshBasicMaterial;
  private liftBtnT = 0;
  private liftCalls = 0;
  private exitDoors: THREE.Object3D[] = [];
  private exitGlass!: THREE.MeshBasicMaterial;
  private exitOpening = false;
  private exitOpen = 0;
  private transition: { t: number; mid: () => void; fired: boolean } | null = null;
  private reading: { title: string; body: string; at: THREE.Vector3 } | null = null;
  private doorSigns: { tex: THREE.CanvasTexture; offset: number }[] = [];
  private graffiti: { i: number; tex: THREE.CanvasTexture }[] = [];
  private floorProps: { obj: THREE.Object3D; floors: number[] }[] = [];
  private dynBoxes: { b: Box; on: () => boolean }[] = [];
  private hallLamp!: THREE.MeshBasicMaterial;
  private hallLightOn = true;
  private hallFlicker = 0;
  private mailDoor!: THREE.Object3D;
  private mailLetter!: THREE.Mesh;
  private mailOpen = 0;
  private panelDoor!: THREE.Object3D;
  private panelOpen = false;
  private panelAngle = 0;
  private meterDiscs: THREE.Object3D[] = [];
  private chuteHatches: THREE.Object3D[] = [];
  private chuteT = 0;
  private chuteCount = 0;
  private chuteAngle = 0;
  private stroller!: THREE.Group;
  private strollerBody!: THREE.Group;
  private strollerStop = 0;
  private strollerAmp = 1;
  private cats: { cat: ReturnType<typeof buildCat>; yaw: number }[] = [];
  private catPets = 0;
  private windowLooks = 0;
  private rings: Record<string, number> = {};
  private outerDoor!: THREE.Object3D;
  private outerOpen = 0;
  // the drive to the park and the breakdown
  private road!: RoadWorld;
  private carFit: ReturnType<typeof fitCar> | null = null;
  private carSpots: { spot: Spot; local: THREE.Vector3 }[] = [];
  private roadDriven = 0;
  private roadSpeed = 0;
  private roadLateral = 1.8;
  private carYaw = 0;
  private roadFade = 0;
  private engineDead = false;
  private decel = 0;
  private cranks = 0;
  private batteryDead = false;
  private hazard = false;
  private wipers = true;
  private radioStep = 0;
  private hoodUp = false;
  private hoodAngle = 0;
  private trunkUp = false;
  private trunkAngle = 0;
  private holdingTriangle = false;
  private trianglePlaced = false;
  private trunkTriangle!: THREE.Object3D;
  private phoneT = 2;
  private phoneAnswered = false;
  private gateOpening = false;
  private gateAngle = 0;
  private parkEntered = false;
  private owlT = 12;
  private nagT = 0;

  constructor(private container: HTMLElement, private cb: AptCallbacks, private lang: Lang) {
    this.isTouch = window.matchMedia("(pointer: coarse)").matches;
    const manager = new THREE.LoadingManager();
    manager.onProgress = (_u, l, t) => cb.onProgress(l / t);
    manager.onLoad = () => { this.renderer.compile(this.scene, this.camera); cb.onReady(); this.say("a_wake"); };
    this.loader = new THREE.TextureLoader(manager);

    this.renderer = new THREE.WebGLRenderer({ antialias: !this.isTouch, powerPreference: "high-performance", stencil: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isTouch ? 1.25 : 1.75));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.03, 220);
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera);
    this.scene.fog = new THREE.Fog(HAZE, 30, 170);
    this.scene.background = new THREE.Color("#05070a");

    this.build();
    this.bind();
    this.sfx.startRain(0.22);
    this.sfx.startWind();
    this.lightning.thunder = (d, v) => this.sfx.thunder(d, v);
    this.timer.connect(document);
    if (import.meta.env.DEV) (window as unknown as { __apt: Apartment }).__apt = this;
    this.loop();
  }

  // ---------- materials ----------
  private tex(url: string, rx = 1, ry = 1) {
    const t = this.loader.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.anisotropy = 4;
    return t;
  }
  private mat(p: THREE.MeshStandardMaterialParameters) {
    return this.isTouch ? new THREE.MeshLambertMaterial({ map: p.map ?? null, color: p.color ?? "#ffffff", emissive: p.emissive ?? "#000000", emissiveIntensity: p.emissiveIntensity ?? 1, transparent: p.transparent, opacity: p.opacity ?? 1, side: p.side }) as unknown as THREE.MeshStandardMaterial
      : new THREE.MeshStandardMaterial({ roughness: 0.8, ...p });
  }
  private box(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, collide = false, parent: THREE.Object3D = this.scene) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y + h / 2, z);
    parent.add(mesh);
    if (collide) this.boxes.push([x - w / 2, z - d / 2, x + w / 2, z + d / 2]);
    return mesh;
  }
  private cyl(rt: number, rb: number, h: number, m: THREE.Material, x: number, y: number, z: number, seg = 16, parent: THREE.Object3D = this.scene) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
    mesh.position.set(x, y + h / 2, z);
    parent.add(mesh);
    return mesh;
  }

  /** Wall segment along an axis with rectangular openings (doors/windows). */
  private wall(axis: "x" | "z", fixed: number, a: number, b: number, wallTex: string, holes: { a: number; b: number; y0: number; y1: number }[] = [], tiled = 1.1) {
    const pieces: [number, number, number, number][] = []; // from, to, y0, y1
    let cur = a;
    for (const h of [...holes].sort((p, q) => p.a - q.a)) {
      if (h.a > cur) pieces.push([cur, h.a, 0, H]);
      if (h.y0 > 0) pieces.push([h.a, h.b, 0, h.y0]);
      if (h.y1 < H) pieces.push([h.a, h.b, h.y1, H]);
      cur = h.b;
    }
    if (cur < b) pieces.push([cur, b, 0, H]);
    for (const [f, t, y0, y1] of pieces) {
      const len = t - f, hh = y1 - y0;
      const m = this.mat({ map: this.tex(wallTex, len / tiled, hh / tiled), roughness: 0.95 });
      const mid = (f + t) / 2;
      if (axis === "x") this.box(len, hh, T, m, mid, y0, fixed, y0 === 0);
      else this.box(T, hh, len, m, fixed, y0, mid, y0 === 0);
    }
    // skirting board
    const sk = this.mat({ map: woodTex("#5a3a22", "#2a180c"), roughness: 0.6 });
    for (const [f, t, y0] of pieces) if (y0 === 0 && !holes.some((h) => h.y0 === 0 && f >= h.a && t <= h.b)) {
      const len = t - f, mid = (f + t) / 2;
      if (axis === "x") { this.box(len, 0.08, 0.02, sk, mid, 0, fixed + T / 2 + 0.01); this.box(len, 0.08, 0.02, sk, mid, 0, fixed - T / 2 - 0.01); }
      else { this.box(0.02, 0.08, len, sk, fixed + T / 2 + 0.01, 0, mid); this.box(0.02, 0.08, len, sk, fixed - T / 2 - 0.01, 0, mid); }
    }
  }

  private window(x0: number, x1: number, drops: THREE.Texture) {
    const frameM = this.mat({ color: "#e8e2d4", roughness: 0.5 });
    const y0 = 0.9, y1 = 2.35, w = x1 - x0, cxw = (x0 + x1) / 2;
    this.box(w + 0.1, 0.06, 0.08, frameM, cxw, y0 - 0.03, 0);
    this.box(w + 0.1, 0.06, 0.08, frameM, cxw, y1 - 0.03, 0);
    this.box(0.06, y1 - y0, 0.08, frameM, x0, y0, 0);
    this.box(0.06, y1 - y0, 0.08, frameM, x1, y0, 0);
    this.box(0.05, y1 - y0, 0.07, frameM, cxw, y0, 0);
    this.box(w, 0.05, 0.07, frameM, cxw, y0 + 1.0, 0);
    // glass with running drops
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, y1 - y0), new THREE.MeshBasicMaterial({ map: drops, transparent: true, opacity: 0.9, depthWrite: false, color: "#a8c0d0" }));
    glass.position.set(cxw, (y0 + y1) / 2, 0.01);
    this.scene.add(glass);
    const tint = new THREE.Mesh(new THREE.PlaneGeometry(w, y1 - y0), new THREE.MeshBasicMaterial({ color: "#0d1820", transparent: true, opacity: 0.18, depthWrite: false }));
    tint.position.set(cxw, (y0 + y1) / 2, 0.0);
    this.scene.add(tint);
    // sill + radiator
    const sill = this.mat({ color: "#f0ece2", roughness: 0.35 });
    this.box(w + 0.3, 0.04, 0.3, sill, cxw, y0 - 0.04, 0.15);
    const rad = this.mat({ color: "#d8d2c4", roughness: 0.4, metalness: 0.3 });
    for (let i = 0; i < Math.floor(w / 0.09); i++) this.box(0.06, 0.55, 0.1, rad, x0 + 0.1 + i * 0.09, 0.18, 0.18);
    this.cyl(0.015, 0.015, 0.18, rad, x0 + 0.12, 0, 0.2, 8);
    // curtains: wavy heavy drapes + sheer tulle
    const curtain = (cx: number, width: number, m: THREE.Material) => {
      const g = new THREE.PlaneGeometry(width, 2.45, 24, 1);
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 22) * 0.04);
      g.computeVertexNormals();
      const c = new THREE.Mesh(g, m);
      c.position.set(cx, 1.35, 0.3);
      this.scene.add(c);
    };
    const drape = this.mat({ map: fabricTex("#5a2a24"), side: THREE.DoubleSide, roughness: 1 });
    curtain(x0 - 0.2, 0.55, drape);
    curtain(x1 + 0.2, 0.55, drape);
    const tulle = new THREE.MeshStandardMaterial({ color: "#f4efe4", transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
    curtain(cxw - w * 0.33, w * 0.3, tulle);
    this.box(w + 1.2, 0.03, 0.03, this.mat({ color: "#b89a60", metalness: 0.6, roughness: 0.4 }), cxw, 2.58, 0.3);
    return { y0, y1 };
  }

  private build() {
    const sc = this.scene;
    const hemi = new THREE.HemisphereLight("#7a8aa8", "#2a2018", 0.5);
    sc.add(hemi);
    this.storm = new THREE.DirectionalLight("#b8ccff", 0);
    this.storm.position.set(3, 6, -8);
    sc.add(this.storm);
    const amb = new THREE.AmbientLight("#ffe2c0", 0.14);
    sc.add(amb);

    // outside: a real courtyard seventeen metres below the windows, under a storm sky
    this.kit = createKit(this.isTouch);
    this.sky = createStormSky(this.isTouch); sc.add(this.sky.mesh);
    this.yard = buildYardView(this.isTouch, -16.8, this.kit); sc.add(this.yard.group);
    this.yardRain = createRain(this.isTouch ? 1200 : 3000, 46, 34);
    this.yardRain.uniforms.uCenter.value.set(5, -14.8, -22);
    this.yard.group.add(this.yardRain.mesh);
    this.rain = createRain(this.isTouch ? 900 : 2200, 9, 10);
    this.rain.uniforms.uCenter.value.set(4.5, 2, -5);
    sc.add(this.rain.mesh);
    // facade outside the window ledge
    const facade = this.mat({ color: "#5b5852", roughness: 1 });
    this.box(12, 0.15, 0.6, facade, 4.5, 0.6, -0.4);

    // floors and ceiling
    const floor = (x0: number, z0: number, x1: number, z1: number, m: THREE.Material) => {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), m);
      f.rotation.x = -Math.PI / 2; f.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); sc.add(f);
    };
    floor(0, 0, 5, 6, this.mat({ map: this.tex(parquetUrl, 2.5, 3), roughness: 0.45 }));
    floor(5, 3, 9, 6, this.mat({ map: this.tex(parquetUrl, 2, 1.5), roughness: 0.45 }));
    const lino = linoTex(); lino.repeat.set(2, 1.5);
    floor(5, 0, 9, 3, this.mat({ map: lino, roughness: 0.5 }));
    const ceilT = plasterTex(); ceilT.repeat.set(4, 3);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), this.mat({ map: ceilT, roughness: 1 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(4.5, H, 3); sc.add(ceil);
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.75), this.mat({ map: this.tex(rugUrl), roughness: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(2.2, 0.005, 3.1); sc.add(rug);

    // walls
    const drops = dropsTex();
    this.drops = drops;
    this.wall("x", 0, 0, 5, wallpaperUrl, [{ a: 0.9, b: 2.3, y0: 0.9, y1: 2.35 }, { a: 2.8, b: 4.2, y0: 0.9, y1: 2.35 }]);
    this.wall("x", 0, 5, 9, tileUrl, [{ a: 6.3, b: 7.9, y0: 0.9, y1: 2.35 }], 0.9);
    this.wall("x", 6, 0, 9, wallpaperUrl);
    this.wall("z", 0, 0, 6, wallpaperUrl);
    this.wall("z", 9, 0, 3, tileUrl, [], 0.9);
    this.wall("z", 9, 3, 6, wallpaperUrl, [{ a: 4.0, b: 5.0, y0: 0, y1: 2.1 }]);
    this.wall("z", 5, 0, 6, wallpaperUrl, [{ a: 3.6, b: 4.6, y0: 0, y1: 2.15 }]);
    this.wall("x", 3, 5, 9, wallpaperUrl, [{ a: 6.4, b: 7.3, y0: 0, y1: 2.15 }]);
    this.window(0.9, 2.3, drops);
    this.window(2.8, 4.2, drops);
    this.window(6.3, 7.9, drops);
    // door frames
    const jamb = this.mat({ map: woodTex("#e6dfcf", "#b8ad98"), roughness: 0.5 });
    for (const [x, z, ax] of [[5, 4.1, "z"], [6.85, 3, "x"]] as const) {
      if (ax === "z") { this.box(0.18, 0.08, 1.1, jamb, x, 2.15, z); this.box(0.18, 2.15, 0.06, jamb, x, 0, z - 0.52); this.box(0.18, 2.15, 0.06, jamb, x, 0, z + 0.52); }
      else { this.box(1.0, 0.08, 0.18, jamb, x, 2.15, z); this.box(0.06, 2.15, 0.18, jamb, x - 0.47, 0, z); this.box(0.06, 2.15, 0.18, jamb, x + 0.47, 0, z); }
    }
    this.buildDeparture();

    this.living();
    this.kitchen();
    this.hall();
    this.lightsSetup();

    // first-person flashlight
    this.flash = new THREE.SpotLight("#fff4dc", 0, 14, 0.5, 0.5, 1.5);
    this.flash.position.set(0.2, -0.15, 0);
    this.camera.add(this.flash);
    this.flash.target.position.set(0, -0.1, -1);
    this.camera.add(this.flash.target);
  }
  private drops!: THREE.Texture;

  private living() {
    const wood = this.mat({ map: woodTex("#6b4026", "#2b160a"), roughness: 0.55 });
    const darkWood = this.mat({ map: woodTex("#3d2516", "#180a04"), roughness: 0.45 });
    // "stenka" wall unit along the back wall (z=6)
    this.box(3.2, 2.3, 0.45, darkWood, 2.2, 0, 5.75, true);
    const glassM = new THREE.MeshStandardMaterial({ color: "#88a0a8", transparent: true, opacity: 0.25, roughness: 0.1, metalness: 0.4 });
    this.box(1.0, 0.9, 0.02, glassM, 1.4, 1.15, 5.51);
    const bookCols = ["#6b1e1e", "#1f3d5c", "#2e4a2a", "#7a6a3a", "#3a2a4a", "#8a4a20", "#20302e"];
    for (let shelf = 0; shelf < 2; shelf++) {
      let x = 2.35;
      while (x < 3.6) {
        const w = 0.03 + Math.random() * 0.04, h = 0.22 + Math.random() * 0.1;
        this.box(w, h, 0.18, this.mat({ color: bookCols[Math.floor(Math.random() * bookCols.length)], roughness: 0.9 }), x, 1.2 + shelf * 0.42, 5.5);
        x += w + 0.005;
      }
    }
    // crystal glasses behind glass
    const crystal = new THREE.MeshStandardMaterial({ color: "#d8f0ff", transparent: true, opacity: 0.5, roughness: 0.05, metalness: 0.2 });
    for (let i = 0; i < 6; i++) this.cyl(0.03, 0.025, 0.1, crystal, 1.05 + i * 0.13, 1.25, 5.62, 10);
    // the photo frame on the open shelf
    const frame = this.box(0.26, 0.22, 0.02, this.mat({ color: "#a8884a", metalness: 0.5, roughness: 0.4 }), 1.3, 0.78, 5.48);
    frame.rotation.x = -0.15;
    const ph = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.18), this.mat({ map: this.tex(photoUrl), roughness: 0.6 }));
    ph.position.set(0, 0, -0.012); ph.rotation.y = Math.PI; frame.add(ph);
    this.spot("photo", new THREE.Vector3(1.3, 0.9, 5.45), () => this.l("Посмотреть фотографию", "Look at the photo"), () => true, () => { this.done.add("photo"); this.say("a_photo"); });

    // CRT TV on a stand by the left wall
    this.box(0.5, 0.55, 1.2, wood, 0.3, 0, 3.1, true);
    const tv = new THREE.Group(); tv.position.set(0.35, 0.55, 3.1); this.scene.add(tv);
    const plastic = this.mat({ color: "#2a2826", roughness: 0.5 });
    this.box(0.5, 0.48, 0.62, plastic, 0, 0, 0, false, tv);
    this.tvScreen = canvasTex(256, 192, (g) => { g.fillStyle = "#0a0c0c"; g.fillRect(0, 0, 256, 192); }, false);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.36), new THREE.MeshBasicMaterial({ map: this.tvScreen, toneMapped: false }));
    screen.position.set(0.255, 0.25, 0); screen.rotation.y = Math.PI / 2; tv.add(screen);
    this.cyl(0.004, 0.004, 0.45, this.mat({ color: "#aaa", metalness: 0.9 }), -0.05, 0.48, -0.08, 6, tv).rotation.z = 0.5;
    this.cyl(0.004, 0.004, 0.45, this.mat({ color: "#aaa", metalness: 0.9 }), -0.05, 0.48, 0.08, 6, tv).rotation.z = -0.5;
    this.spot("tv", new THREE.Vector3(0.6, 0.85, 3.1), () => this.tvOn ? this.l("Выключить телевизор", "Turn off the TV") : this.l("Включить телевизор", "Turn on the TV"), () => true, () => {
      this.tvOn = !this.tvOn; this.sfx.click();
      if (this.tvOn && !this.done.has("tv")) { this.done.add("tv"); this.say("a_tv"); }
    });

    // sofa facing the TV
    const fabric = this.mat({ map: fabricTex("#5d4a3a"), roughness: 1 });
    this.box(0.95, 0.42, 2.1, fabric, 3.6, 0, 3.1, true);
    this.box(0.25, 0.55, 2.1, fabric, 4.0, 0.42, 3.1);
    this.box(0.95, 0.25, 0.22, fabric, 3.6, 0.42, 2.0);
    this.box(0.95, 0.25, 0.22, fabric, 3.6, 0.42, 4.2);
    for (const z of [2.6, 3.6]) { const c = this.box(0.55, 0.14, 0.9, this.mat({ map: fabricTex("#6e5845") }), 3.45, 0.42, z); c.scale.set(1, 1, 0.98); }
    const pillow = this.box(0.12, 0.35, 0.35, this.mat({ map: fabricTex("#8a6a3a") }), 3.85, 0.56, 2.4); pillow.rotation.z = -0.3;
    const blanket = this.box(0.5, 0.05, 0.9, this.mat({ map: fabricTex("#3a4a5a") }), 3.5, 0.56, 3.9); blanket.rotation.y = 0.2;
    // coffee table with mug and newspaper
    this.box(0.6, 0.04, 1.0, wood, 2.2, 0.42, 3.1, true);
    for (const [dx, dz] of [[-0.25, -0.45], [0.25, -0.45], [-0.25, 0.45], [0.25, 0.45]]) this.box(0.04, 0.42, 0.04, wood, 2.2 + dx, 0, 3.1 + dz);
    this.cyl(0.04, 0.035, 0.09, this.mat({ color: "#e8e0d0", roughness: 0.3 }), 2.1, 0.46, 2.85, 14);
    const paper = this.box(0.3, 0.005, 0.4, this.mat({ color: "#d8d0bc" }), 2.25, 0.46, 3.3); paper.rotation.y = 0.4;
    // floor lamp
    const brass = this.mat({ color: "#a08040", metalness: 0.7, roughness: 0.35 });
    this.cyl(0.15, 0.18, 0.03, brass, 4.55, 0, 5.2);
    this.cyl(0.015, 0.015, 1.5, brass, 4.55, 0.03, 5.2, 8);
    this.cyl(0.14, 0.24, 0.3, this.mat({ color: "#e8c890", emissive: "#ffb060", emissiveIntensity: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }), 4.55, 1.45, 5.2, 18);
    // wall clock + carpet on the wall (very 80s)
    const clock = this.cyl(0.18, 0.18, 0.04, this.mat({ color: "#efe8d8" }), 0.07, 1.9, 1.4, 24); clock.rotation.z = Math.PI / 2;
    const wallRug = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.2), this.mat({ map: this.tex(rugUrl), roughness: 1 }));
    wallRug.position.set(4.93, 1.55, 2.35); wallRug.rotation.y = -Math.PI / 2; this.scene.add(wallRug);
    // chandelier
    this.cyl(0.01, 0.01, 0.35, brass, 2.4, H - 0.35, 3.1, 6);
    this.cyl(0.25, 0.1, 0.12, this.mat({ color: "#f4ecd8", emissive: "#ffd8a0", emissiveIntensity: 0.8 }), 2.4, H - 0.47, 3.1, 20);
    // window spot
    this.spot("window", new THREE.Vector3(3.5, 1.5, 0.3), () => this.l("Выглянуть в окно", "Look out the window"), () => this.done.has("phone"), () => {
      this.done.add("window"); this.say("a_window"); this.lightning.update(99); this.sfx.thunder(0.3, 1);
    });
  }

  private kitchen() {
    const cab = this.mat({ map: woodTex("#c8b48a", "#8a7450"), roughness: 0.6 });
    const top = this.mat({ color: "#7a6e60", roughness: 0.4 });
    // counter along x=9
    this.box(0.6, 0.85, 2.6, cab, 8.65, 0, 1.6, true);
    this.box(0.64, 0.04, 2.6, top, 8.63, 0.85, 1.6);
    this.box(0.35, 0.7, 2.0, cab, 8.78, 1.5, 1.4);
    // sink + tap
    const steel = this.mat({ color: "#c0c4c8", metalness: 0.9, roughness: 0.25 });
    this.box(0.45, 0.02, 0.5, steel, 8.6, 0.885, 1.0);
    this.cyl(0.012, 0.012, 0.25, steel, 8.85, 0.89, 1.0, 8);
    // stove with kettle
    this.box(0.6, 0.86, 0.55, this.mat({ color: "#e8e4dc", roughness: 0.3 }), 8.65, 0, 3.0 - 0.3, true);
    for (const [dx, dz] of [[-0.12, -0.12], [0.12, 0.12], [-0.12, 0.12], [0.12, -0.12]]) this.cyl(0.07, 0.07, 0.01, this.mat({ color: "#222" }), 8.65 + dx, 0.86, 2.7 + dz, 14);
    this.cyl(0.06, 0.09, 0.16, this.mat({ color: "#2f5a8a", roughness: 0.3, metalness: 0.2 }), 8.53, 0.87, 2.58, 16);
    // rounded old fridge in the corner
    const fridge = this.mat({ color: "#eeeae0", roughness: 0.25 });
    this.box(0.65, 1.6, 0.65, fridge, 5.45, 0, 0.45, true);
    this.box(0.03, 0.25, 0.04, steel, 5.75, 1.0, 0.8);
    // table + stools + calendar
    const tw = this.mat({ map: woodTex("#a07850", "#5a3c20"), roughness: 0.5 });
    this.box(0.8, 0.04, 0.8, tw, 6.6, 0.72, 2.2, true);
    this.box(0.08, 0.72, 0.08, tw, 6.6, 0, 2.2);
    for (const [x, z] of [[6.0, 2.2], [7.2, 2.2]]) { this.box(0.36, 0.03, 0.36, tw, x, 0.45, z); this.box(0.05, 0.45, 0.05, tw, x, 0, z); }
    const kettleLight = new THREE.PointLight("#ffd8a8", 0, 1, 2); kettleLight.position.set(6.6, 1.0, 2.2); this.scene.add(kettleLight);
    const calendar = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.42), this.mat({ map: canvasTex(128, 180, (g) => {
      g.fillStyle = "#efe6d0"; g.fillRect(0, 0, 128, 180); g.fillStyle = "#8a1a1a"; g.font = "bold 22px serif"; g.fillText("НОЯБРЬ", 16, 32);
      g.fillStyle = "#222"; g.font = "12px serif"; for (let d = 1; d <= 30; d++) g.fillText(String(d), 10 + ((d - 1) % 7) * 16, 56 + Math.floor((d - 1) / 7) * 22);
      g.strokeStyle = "#c00"; g.lineWidth = 2; g.beginPath(); g.arc(10 + 6 * 16 + 6, 56 + 1 * 22 - 4, 9, 0, 7); g.stroke();
    }, false) }));
    calendar.position.set(5.07, 1.6, 2.0); calendar.rotation.y = Math.PI / 2; this.scene.add(calendar);
  }

  private hall() {
    // padded front door at x=9 (z 4..5)
    this.door = new THREE.Group();
    this.door.position.set(8.97, 0, 4.03);
    this.scene.add(this.door);
    const pad = this.mat({ map: quiltTex(), roughness: 0.7 });
    const leaf = this.box(0.06, 2.08, 0.94, pad, 0, 0, 0.47, false, this.door);
    leaf.position.x = 0;
    const brass = this.mat({ color: "#c0a050", metalness: 0.8, roughness: 0.3 });
    this.box(0.06, 0.03, 0.14, brass, -0.05, 1.0, 0.82, false, this.door);
    this.cyl(0.015, 0.015, 0.03, brass, -0.04, 1.55, 0.47, 8, this.door).rotation.z = Math.PI / 2;
    this.boxes.push([8.85, 4.0, 9.1, 5.0]);
    // coat hooks, coat, shoe rack, mirror
    const wood = this.mat({ map: woodTex("#6b4026", "#2b160a"), roughness: 0.55 });
    this.box(1.0, 0.1, 0.04, wood, 7.4, 1.7, 5.92);
    const coat = this.box(0.5, 0.95, 0.18, this.mat({ map: fabricTex("#2f3a2e") }), 7.2, 0.85, 5.8);
    coat.rotation.z = 0.04;
    this.box(0.25, 0.25, 0.25, this.mat({ map: fabricTex("#3a2a20") }), 7.7, 1.45, 5.82);
    this.box(0.9, 0.3, 0.3, wood, 7.4, 0, 5.8, true);
    for (let i = 0; i < 3; i++) this.box(0.12, 0.1, 0.28, this.mat({ color: ["#1a1410", "#3a2416", "#502a1a"][i] }), 7.1 + i * 0.3, 0.3, 5.8);
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.9), new THREE.MeshStandardMaterial({ color: "#9aa8b0", metalness: 1, roughness: 0.08 }));
    mirror.position.set(5.07, 1.4, 5.2); mirror.rotation.y = Math.PI / 2; this.scene.add(mirror);
    // console with landline phone + answering machine
    this.box(0.4, 0.8, 0.8, wood, 5.3, 0, 4.9, true);
    const phoneM = this.mat({ color: "#7a1a14", roughness: 0.35 });
    this.box(0.2, 0.08, 0.24, phoneM, 5.3, 0.8, 4.75);
    const handset = this.box(0.05, 0.05, 0.24, phoneM, 5.36, 0.88, 4.75); handset.rotation.x = 0.05;
    this.box(0.18, 0.06, 0.22, this.mat({ color: "#1a1a1c", roughness: 0.4 }), 5.3, 0.8, 5.1);
    this.led = new THREE.MeshBasicMaterial({ color: "#ff2010", toneMapped: false });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 6), this.led); led.position.set(5.4, 0.87, 5.05); this.scene.add(led);
    this.spot("phone", new THREE.Vector3(5.35, 0.9, 4.95), () => this.l("Прослушать автоответчик (1 сообщение)", "Play the answering machine (1 message)"), () => !this.done.has("phone"), () => {
      this.done.add("phone"); this.sfx.click(); this.sfx.tape();
      this.say("a_phone", () => { this.blackout = 2.2; this.sfx.thunder(0, 1); });
    });
    // key rack with car keys + flashlight
    this.box(0.25, 0.18, 0.03, wood, 8.89, 1.35, 3.5).rotation.y = Math.PI / 2;
    const keys = new THREE.Group(); keys.position.set(8.85, 1.38, 3.5); this.scene.add(keys);
    this.cyl(0.018, 0.018, 0.005, brass, 0, 0, 0, 10, keys).rotation.z = Math.PI / 2;
    this.box(0.01, 0.06, 0.015, this.mat({ color: "#c8c8c8", metalness: 0.9 }), 0, -0.07, 0, false, keys);
    this.box(0.015, 0.05, 0.03, this.mat({ color: "#111" }), 0, -0.06, 0.03, false, keys);
    this.hand.keys = keys;
    const torch = this.cyl(0.025, 0.03, 0.2, this.mat({ color: "#2a2a2a", metalness: 0.4, roughness: 0.4 }), 8.75, 0.3, 5.6, 12);
    torch.rotation.z = Math.PI / 2; torch.position.y = 0.33;
    this.hand.flash = torch;
    this.spot("keys", new THREE.Vector3(8.8, 1.3, 3.5), () => this.l("Взять ключи от машины и фонарик", "Take the car keys and flashlight"), () => this.ready() && !this.done.has("keys"), () => {
      this.done.add("keys"); this.sfx.pickup(); keys.visible = false; torch.visible = false; this.flashOn = true; this.say("a_keys");
    });
    this.spot("door", new THREE.Vector3(8.9, 1.2, 4.5), () => this.l("Выйти в подъезд", "Step out into the stairwell"), () => this.done.has("keys") && !this.done.has("door"), () => {
      this.done.add("door"); this.sfx.door();
      this.boxes = this.boxes.filter((b) => !(b[0] === 8.85 && b[1] === 4.0));
      this.say("a_door");
    });
  }

  /** Fits text into a label canvas without clipping, whatever the plaque's proportions. */
  private drawLabel(g: CanvasRenderingContext2D, w: number, h: number, text: string, fg: string, bg: string) {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    let size = Math.floor(h * 0.64);
    g.font = `bold ${size}px monospace`;
    while (size > 6 && g.measureText(text).width > w * 0.86) { size -= 1; g.font = `bold ${size}px monospace`; }
    g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, w / 2, h / 2 + size * 0.05);
  }
  private sign(text: string, x: number, y: number, z: number, width = 0.5, height = 0.3, rotation = 0, parent: THREE.Object3D = this.scene, fg = "#dbe6d2", bg = "#182421") {
    const cw = Math.min(512, Math.max(96, Math.round(width * 900)));
    const ch = Math.min(512, Math.max(32, Math.round((cw * height) / width)));
    const texture = canvasTex(cw, ch, (g) => this.drawLabel(g, cw, ch, text, fg, bg), false);
    texture.userData = { fg, bg };
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture }));
    mesh.position.set(x, y, z); mesh.rotation.y = rotation; parent.add(mesh);
    return texture;
  }
  private paintSign(texture: THREE.CanvasTexture | null, text: string, fg?: string, bg?: string) {
    const c = texture?.image as HTMLCanvasElement | undefined;
    const g = c?.getContext("2d");
    if (!g || !texture || !c) return;
    this.drawLabel(g, c.width, c.height, text, fg ?? texture.userData.fg ?? "#dbe6d2", bg ?? texture.userData.bg ?? "#182421");
    texture.needsUpdate = true;
  }
  /** A taped paper notice on a wall; looking at it and pressing E opens it full-screen. */
  private notice(id: NoticeId, x: number, y: number, z: number, rotY: number, w: number, h: number, tilt: number, parent: THREE.Object3D = this.scene, spotAt?: THREE.Vector3) {
    const n = NOTICES[id];
    const cw = 256, ch = Math.round((256 * h) / w);
    const texture = canvasTex(cw, ch, (g) => paintNotice(g, cw, ch, n, this.lang), false);
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.mat({ map: texture, roughness: 0.95, transparent: !!n.tabs, alphaTest: n.tabs ? 0.5 : 0 }));
    const holder = new THREE.Group(); holder.position.set(x, y, z); holder.rotation.y = rotY; parent.add(holder);
    sheet.rotation.z = tilt; holder.add(sheet);
    const tape = this.mat({ color: "#d8cf9a", transparent: true, opacity: 0.75, roughness: 0.6 });
    for (const sx of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.32, 0.03), tape);
      strip.position.set(sx * w * 0.38, h * 0.47, 0.002); strip.rotation.z = sx * 0.6 + tilt; holder.add(strip);
    }
    if (parent === this.scene || spotAt) {
      const at = spotAt ?? new THREE.Vector3(x, y, z);
      this.spot(`notice-${id}${spotAt ? "-s" : ""}`, at, () => this.l("Прочитать объявление", "Read the notice"), () => this.departure !== "apartment", () => this.read(n.title[this.lang], n.body[this.lang]), spotAt ? "stairs" : "hall");
    }
  }
  private read(title: string, body: string) {
    this.sfx.click();
    this.reading = { title, body, at: this.pos.clone() };
  }

  private buildLift(metal: THREE.Material, dark: THREE.Material) {
    const L = this.liftGroup; this.scene.add(L);
    const trim = this.mat({ map: brushedTex(), color: "#737c79", metalness: 0.72, roughness: 0.42 });
    const leaves = this.mat({ map: brushedTex(), color: "#b0b5b1", metalness: 0.68, roughness: 0.36 });
    const recess = this.mat({ color: "#111615", roughness: 0.95 });
    const header = this.mat({ map: plasterTex(), color: "#b5b8ac", roughness: 0.95 });
    // Wall above the portal is shared by the lift (upper floors) and the street exit (ground floor).
    this.box(1.6, H - 2.22, 0.14, header, 12.8, 2.22, 3);
    this.box(1.82, 2.22, 0.1, recess, 12.8, 0, 3.015, false, L);
    for (const x of [12.405, 13.195]) {
      const leaf = this.box(0.775, 2.02, 0.055, leaves, x, 0.025, 3.085, false, L);
      this.liftDoors.push(leaf);
      this.box(0.018, 1.96, 0.012, trim, x + (x < 12.8 ? 0.31 : -0.31), 0.055, 3.12, false, L);
    }
    this.box(0.026, 2.03, 0.018, dark, 12.8, 0.02, 3.122, false, L);
    for (const x of [11.94, 13.66]) this.box(0.13, 2.24, 0.16, trim, x, 0, 3.07, false, L);
    this.box(1.84, 0.15, 0.16, trim, 12.8, 2.08, 3.07, false, L);
    this.box(1.72, 0.035, 0.34, trim, 12.8, 0, 3.15, false, L);
    for (const x of [11.97, 13.63]) for (const y of [0.22, 1.95]) {
      const rivet = this.cyl(0.014, 0.014, 0.012, metal, x, y, 3.16, 8, L); rivet.rotation.x = Math.PI / 2;
    }
    this.sign(this.l("ЛИФТ", "LIFT"), 12.8, 2.5, 3.09, 0.72, 0.18, 0, L);
    this.liftDisplay = this.sign("--", 12.8, 2.27, 3.16, 0.36, 0.18, 0, L, "#d7a75d", "#111615");
    // The handwritten "out of order" sheet is a real readable notice now.
    this.notice("lift", 12.92, 1.43, 3.128, 0, 0.3, 0.4, 0.05, L);
    this.spot("notice-lift", new THREE.Vector3(12.92, 1.43, 3.13), () => this.l("Прочитать объявление на лифте", "Read the note on the lift"), () => this.floor !== 1 && this.departure !== "apartment",
      () => this.read(NOTICES.lift.title[this.lang], NOTICES.lift.body[this.lang]), "hall");
    // Call station with a button that actually lights up.
    this.box(0.16, 0.34, 0.055, trim, 13.88, 1.14, 3.095, false, L);
    this.sign("▲  ▼", 13.88, 1.39, 3.126, 0.12, 0.09, 0, L, "#222927", "#a1a7a2");
    this.liftBtn = new THREE.MeshBasicMaterial({ color: "#3a0c08" });
    this.cyl(0.03, 0.03, 0.025, this.liftBtn, 13.88, 1.245, 3.135, 16, L).rotation.x = Math.PI / 2;
    this.spot("liftCall", new THREE.Vector3(13.88, 1.32, 3.14), () => this.l("Вызвать лифт", "Call the elevator"), () => this.floor !== 1 && this.departure !== "apartment", () => {
      this.liftCalls++; this.liftBtnT = 1.4; this.sfx.click();
      const lines: [string, string][] = [
        ["Кнопка загорелась… и погасла. Лифт опять сломан — придётся пешком.", "The button lights up… and dies. The lift is broken again — stairs it is."],
        ["Где-то глубоко в шахте что-то лязгнуло. И снова тишина.", "Somewhere deep in the shaft something clanks. Then silence again."],
        ["Хватит. Даже если он приедет — я в него не сяду.", "Enough. Even if it comes, I'm not getting in."],
      ];
      const [ru, en] = lines[Math.min(this.liftCalls - 1, lines.length - 1)];
      this.caption(ru, en);
      if (this.liftCalls === 2) window.setTimeout(() => this.sfx.clunk(), 900);
    }, "hall");
    this.spot("liftListen", new THREE.Vector3(12.8, 0.95, 3.13), () => this.l("Прислушаться к дверям лифта", "Listen at the lift doors"), () => this.floor !== 1 && this.departure !== "apartment", () => {
      this.sfx.creak(0.03);
      this.caption("Из щели тянет сквозняком. Внизу, в шахте, кто-то тихо напевает считалочку…", "A draught seeps through the gap. Far down the shaft someone is softly humming a nursery rhyme…");
    }, "hall");
  }

  /** Ground floor: the building's front door with a small vestibule stands where the lift is upstairs. */
  private buildExit(metal: THREE.Material) {
    const E = this.exitGroup = new THREE.Group(); this.scene.add(E); E.visible = false;
    const frameM = this.mat({ color: "#3b4240", metalness: 0.5, roughness: 0.5 });
    const leafM = this.mat({ map: woodTex("#4a3424", "#22150c"), roughness: 0.7 });
    const tamb = this.mat({ map: plasterTex(), color: "#6f746a", roughness: 1 });
    const tambGreen = this.mat({ map: plasterTex(), color: "#3e5c50", roughness: 1 });
    // vestibule (тамбур) behind the doorway
    this.box(1.72, 0.05, 1.6, this.mat({ map: linoTex(), color: "#6d6a62" }), 12.8, -0.05, 2.15, false, E);
    this.box(1.72, 0.05, 1.6, tamb, 12.8, 2.28, 2.15, false, E);
    for (const x of [11.92, 13.68]) { this.box(0.06, 2.3, 1.6, tamb, x, 0, 2.15, false, E); this.box(0.065, 1.1, 1.6, tambGreen, x, 0, 2.15, false, E); }
    this.box(1.72, 2.3, 0.06, tamb, 12.8, 0, 1.33, false, E);
    const glowTex = canvasTex(128, 160, (g) => {
      const bg = g.createLinearGradient(0, 0, 0, 160); bg.addColorStop(0, "#0b1118"); bg.addColorStop(1, "#1a1a1c");
      g.fillStyle = bg; g.fillRect(0, 0, 128, 160);
      const r = g.createRadialGradient(34, 70, 2, 34, 70, 70); r.addColorStop(0, "rgba(255,190,110,0.95)"); r.addColorStop(1, "rgba(255,190,110,0)");
      g.fillStyle = r; g.fillRect(0, 0, 128, 160);
      for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(200,215,230,${0.1 + Math.random() * 0.2})`; g.lineWidth = 1 + Math.random() * 2; const x = Math.random() * 128, y = Math.random() * 160; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.random() * 3 - 1.5, y + 10 + Math.random() * 30); g.stroke(); }
    }, false);
    this.exitGlass = new THREE.MeshBasicMaterial({ map: glowTex, color: "#c8ccd2" });
    // outer street door at the end of the vestibule, its glass glowing from the streetlight
    this.box(1.0, 2.1, 0.06, leafM, 12.8, 0, 1.37, false, E);
    const outerPane = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.85), this.exitGlass); outerPane.position.set(12.8, 1.45, 1.405); E.add(outerPane);
    this.box(0.25, 0.04, 0.05, metal, 13.1, 1.0, 1.42, false, E);
    const lampMat = new THREE.MeshBasicMaterial({ color: "#d8e4c0" });
    this.box(0.25, 0.05, 0.25, lampMat, 12.8, 2.22, 2.1, false, E);
    // inner double doors in the hall wall, hinged at the outer edges, opening into the vestibule
    for (const x of [11.94, 13.66]) this.box(0.12, 2.24, 0.16, frameM, x, 0, 3.07, false, E);
    this.box(1.84, 0.14, 0.16, frameM, 12.8, 2.1, 3.07, false, E);
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(12.8 + side * 0.8, 0.02, 3.06); E.add(pivot);
      const cx = -side * 0.395;
      this.box(0.78, 2.04, 0.05, leafM, cx, 0, 0, false, pivot);
      for (const face of [-1, 1]) {
        const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.66), this.exitGlass);
        pane.position.set(cx, 1.5, face * 0.027); if (face < 0) pane.rotation.y = Math.PI; pivot.add(pane);
      }
      this.box(0.035, 0.35, 0.04, metal, cx - side * 0.3, 0.85, 0.05, false, pivot);
      this.exitDoors.push(pivot);
    }
    this.sign(this.l("ВЫХОД", "EXIT"), 12.8, 2.43, 3.09, 0.6, 0.2, 0, E, "#e9ffe9", "#1d6b35");
    this.box(1.3, 0.02, 0.7, this.mat({ map: fabricTex("#2c2720"), roughness: 1 }), 12.8, 0, 3.55, false, E);
    // intercom panel beside the doors
    this.box(0.18, 0.32, 0.04, this.mat({ color: "#8a8f8c", metalness: 0.6, roughness: 0.4 }), 13.95, 1.1, 3.09, false, E);
    for (let i = 0; i < 9; i++) this.box(0.03, 0.03, 0.012, this.mat({ color: "#2a2c2c" }), 13.91 + (i % 3) * 0.04, 1.16 + Math.floor(i / 3) * 0.05, 3.115, false, E);
    this.box(0.12, 0.04, 0.012, new THREE.MeshBasicMaterial({ color: "#3a8a3a" }), 13.95, 1.36, 3.115, false, E);
    this.spot("buildingExit", new THREE.Vector3(12.8, 1.2, 3.15), () => this.l("Открыть дверь на улицу", "Open the street door"), () => this.departure === "ground" && !this.transition, () => this.leaveBuilding(), "hall");
    this.spot("intercom", new THREE.Vector3(13.95, 1.3, 3.13), () => this.l("Нажать кнопку домофона", "Press the intercom button"), () => this.departure === "ground", () => {
      this.sfx.beep();
      this.caption("Домофон пискнул. Изнутри дверь открывается и так.", "The intercom beeps. From inside the door opens anyway.");
    }, "hall");
  }
  private leaveBuilding() {
    this.sfx.door(); this.exitOpening = true;
    this.transition = {
      t: 0, fired: false, mid: () => {
        this.advanceDeparture("leaveBuilding"); this.pos.set(17.2, 0, 5.85); this.yaw = -Math.PI / 2; this.pitch = 0;
        this.street.visible = true; this.yard.group.visible = false; this.rain.mesh.visible = false;
        const fog = this.scene.fog as THREE.Fog; fog.near = 14; fog.far = 130; fog.color.set(HAZE);
        this.sfx.door();
        this.caption("Моя машина у фонаря. Ключи со мной.", "My car is under the streetlight. I've got the keys.");
      },
    };
  }

  private buildHallDetails(metal: THREE.Material, dark: THREE.Material) {
    const pale = this.mat({ color: "#c7c4b5", roughness: 0.82 });
    const pipeMat = this.mat({ color: "#8b9088", metalness: 0.45, roughness: 0.55 });
    const red = this.mat({ color: "#6f211b", roughness: 0.65 });
    const plaster = this.mat({ map: plasterTex(), color: "#b5b8ac" });
    const green = this.mat({ map: plasterTex(), color: "#4f7466" });
    const stripe = this.mat({ color: "#2e463d", roughness: 0.8 });
    // Hall side of our apartment wall: painted like the rest of the landing instead of showing wallpaper.
    const clad = (z0: number, z1: number, y0: number, y1: number) => {
      const len = z1 - z0, mid = (z0 + z1) / 2;
      this.box(0.02, y1 - y0, len, plaster, 9.075, y0, mid);
      if (y0 < 1.15) { this.box(0.024, 1.15 - y0, len, green, 9.077, y0, mid); this.box(0.026, 0.035, len, stripe, 9.078, 1.13, mid); }
    };
    clad(3.0, 3.96, 0, H); clad(5.04, 6.0, 0, H); clad(3.96, 5.04, 2.12, H);
    // Door casing, flat number and doorbell for our own (padded) door.
    const casing = this.mat({ map: woodTex("#5a3b2a", "#2a170e"), roughness: 0.7 });
    for (const z of [3.96, 5.04]) this.box(0.035, 2.2, 0.08, casing, 9.1, 0, z);
    this.box(0.035, 0.08, 1.16, casing, 9.1, 2.12, 4.5);
    this.doorSigns.push({ tex: this.sign("26", 9.12, 2.38, 4.5, 0.2, 0.13, Math.PI / 2), offset: -2 });
    this.box(0.03, 0.09, 0.06, this.mat({ color: "#e6e0cc" }), 9.1, 1.45, 5.18);
    this.box(0.034, 0.025, 0.025, red, 9.1, 1.48, 5.18);
    this.box(0.7, 0.015, 0.45, this.mat({ map: fabricTex("#4a3a26"), roughness: 1 }), 9.45, 0, 4.5);
    this.spot("doormat", new THREE.Vector3(9.45, 0.15, 4.5), () => this.l("Заглянуть под коврик", "Look under the doormat"), () => this.floor === START_FLOOR && this.departure !== "apartment", () => {
      this.sfx.click();
      this.caption("Запасной ключ на месте. Мама всегда прятала его здесь.", "The spare key is still there. Mum always hid it here.");
    }, "hall");

    // Two-column mailbox cabinet; our box No. 26 really opens.
    this.box(0.2, 1.0, 1.16, dark, 9.16, 0.72, 5.72);
    for (let row = 0; row < 4; row++) for (let col = 0; col < 2; col++) {
      const z = 5.43 + col * 0.56, y = 0.79 + row * 0.22, n = 25 + row * 2 + col;
      let parent: THREE.Object3D = this.scene, ox = 9.275, oz = z;
      if (n === 26) {
        const pivot = new THREE.Group(); pivot.position.set(9.275, y, z - 0.26); this.scene.add(pivot);
        this.mailDoor = pivot; parent = pivot; ox = 0; oz = 0.26;
        const letter = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.13), this.mat({ map: canvasTex(128, 64, (g) => {
          g.fillStyle = "#e9e1c8"; g.fillRect(0, 0, 128, 64); g.fillStyle = "#8a2a1e"; g.fillRect(96, 6, 24, 28); g.strokeStyle = "#555"; g.beginPath(); g.moveTo(10, 40); g.lineTo(80, 40); g.moveTo(10, 50); g.lineTo(70, 50); g.stroke();
        }, false) }));
        letter.position.set(9.24, y + 0.1, z); letter.rotation.y = Math.PI / 2; letter.rotation.z = 0.08; this.scene.add(letter);
        this.mailLetter = letter;
        this.spot("mailbox", new THREE.Vector3(9.3, y + 0.1, z), () => this.l("Открыть свой почтовый ящик №26", "Open your mailbox No. 26"), () => this.departure !== "apartment" && !this.done.has("mail"), () => {
          this.done.add("mail"); this.sfx.click(); this.sfx.creak(0.04);
          window.setTimeout(() => {
            this.mailLetter.visible = false;
            this.read(this.l("Открытка без марки", "A postcard with no stamp"), this.l(
              "На лицевой стороне — карусель парка «Весёлые горки».\nНа обороте детский почерк:\n\n«Ты обещал прийти. Мы ждём тебя у ворот.\nСорок лет ждём.\n— Т.»",
              "The front shows the carousel at Happy Hills park.\nOn the back, a child's handwriting:\n\n\"You promised to come. We're waiting at the gate.\nWe've waited forty years.\n— T.\""));
          }, 450);
        }, "hall");
      }
      this.box(0.035, 0.2, 0.52, metal, ox, y - (parent === this.scene ? 0 : y), oz, false, parent);
      this.box(0.012, 0.025, 0.3, dark, ox + 0.023, y - (parent === this.scene ? 0 : y) + 0.125, oz, false, parent);
      this.sign(String(n), ox + 0.027, (parent === this.scene ? y : 0) + 0.055, oz, 0.1, 0.06, Math.PI / 2, parent);
    }
    // Cast-iron radiator and supply pipes on the wall opposite the mailboxes.
    for (let i = 0; i < 9; i++) this.box(0.075, 0.58, 0.13, pale, 9.72 + i * 0.105, 0.28, 3.19);
    for (const y of [0.38, 0.75]) this.box(1.0, 0.055, 0.08, pale, 10.14, y, 3.19);
    for (const x of [9.63, 10.67]) this.cyl(0.022, 0.022, 0.3, pipeMat, x, 0, 3.18, 10);
    this.spot("radiator", new THREE.Vector3(10.15, 0.65, 3.25), () => this.l("Потрогать батарею", "Touch the radiator"), () => this.departure !== "apartment", () => {
      this.caption("Еле тёплая. Отопление, как всегда, дали «по графику».", "Barely warm. The heating is on \"according to schedule\", as usual.");
    }, "hall");
    const horizontal = this.cyl(0.026, 0.026, 6.4, pipeMat, 0, 0, 0, 10);
    horizontal.rotation.z = Math.PI / 2; horizontal.position.set(12.45, 2.43, 7.74);
    this.cyl(0.032, 0.032, 2.5, pipeMat, 15.68, 0, 3.38, 10);
    for (const y of [0.35, 1.45, 2.3]) this.box(0.12, 0.035, 0.12, dark, 15.68, y, 3.38);
    // Electrical cables run along the ceiling to the lamp.
    const cable = this.mat({ color: "#1d1f1e", roughness: 0.8 });
    this.box(6.6, 0.018, 0.018, cable, 12.55, H - 0.04, 3.2); this.box(0.018, 0.018, 2.3, cable, 12.4, H - 0.04, 4.35);
    // Readable paper notices: a board by our door, others on the walls.
    this.box(0.025, 0.72, 0.82, this.mat({ map: woodTex("#9a7a4e", "#6a4a2a"), roughness: 0.9 }), 9.1, 1.08, 3.5);
    this.notice("hotwater", 9.117, 1.58, 3.3, Math.PI / 2, 0.26, 0.34, 0.04);
    this.notice("dog", 9.117, 1.36, 3.7, Math.PI / 2, 0.26, 0.34, -0.06);
    this.notice("meeting", 13.7, 1.42, 7.925, Math.PI, 0.3, 0.42, 0.03);
    this.notice("missing", 10.2, 1.42, 3.082, 0, 0.3, 0.42, -0.04);
    this.sign(this.l("НЕ КУРИТЬ", "NO SMOKING"), 11.25, 1.72, 3.085, 0.62, 0.2, 0, this.scene, "#7a2a20", "#ddd6be");
    const cracks = canvasTex(256, 256, (g) => {
      g.clearRect(0, 0, 256, 256); g.strokeStyle = "rgba(45,48,42,0.5)"; g.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        let x = 130 + Math.random() * 30 - 15, y = 20; g.beginPath(); g.moveTo(x, y);
        for (let j = 0; j < 7; j++) { x += Math.random() * 36 - 18; y += 20 + Math.random() * 18; g.lineTo(x, y); } g.stroke();
      }
    }, false);
    const crack = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 1.0), new THREE.MeshBasicMaterial({ map: cracks, transparent: true, depthWrite: false }));
    crack.position.set(14.2, 1.65, 3.081); this.scene.add(crack);
    // Damp ceiling stain above the lift.
    const stain = canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 10, 64, 64, 64); r.addColorStop(0, "rgba(90,70,30,0.35)"); r.addColorStop(0.7, "rgba(90,70,30,0.18)"); r.addColorStop(1, "rgba(90,70,30,0)"); g.fillStyle = r; g.fillRect(0, 0, 128, 128); }, false);
    const st = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), new THREE.MeshBasicMaterial({ map: stain, transparent: true, depthWrite: false }));
    st.rotation.x = Math.PI / 2; st.position.set(13.6, H - 0.005, 3.7); this.scene.add(st);
    // Graffiti scratched into the green paint.
    const graf = canvasTex(256, 96, (g) => { g.clearRect(0, 0, 256, 96); g.font = "bold 34px 'Comic Sans MS', cursive"; g.fillStyle = "rgba(20,20,22,0.7)"; g.save(); g.rotate(-0.06); g.fillText(this.l("ЦОЙ ЖИВ", "TSOI LIVES"), 14, 56); g.restore(); }, false);
    const grafM = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.28), new THREE.MeshBasicMaterial({ map: graf, transparent: true, depthWrite: false }));
    grafM.position.set(11.55, 0.72, 7.924); grafM.rotation.y = Math.PI; this.scene.add(grafM);
    // Fire extinguisher.
    this.cyl(0.1, 0.11, 0.52, red, 15.62, 0.45, 4.05, 14);
    this.box(0.12, 0.06, 0.08, dark, 15.62, 0.98, 4.05);
    this.sign(this.l("ОГНЕТУШИТЕЛЬ", "FIRE EXTINGUISHER"), 15.89, 1.35, 4.05, 0.62, 0.16, -Math.PI / 2, this.scene, "#e5d8c4", "#6f211b");
    this.spot("extinguisher", new THREE.Vector3(15.62, 0.8, 4.05), () => this.l("Осмотреть огнетушитель", "Inspect the fire extinguisher"), () => this.departure !== "apartment", () => {
      this.caption("Пломба 1979 года, стрелка давно на нуле. Лучше не проверять.", "Seal dated 1979, needle long since at zero. Better not test it.");
    }, "hall");
    // Electrical panel with a door that opens onto spinning meters.
    this.box(0.7, 0.8, 0.12, dark, 15.1, 1.1, 3.1);
    const meterFace = canvasTex(96, 64, (g) => { g.fillStyle = "#d9d6c8"; g.fillRect(0, 0, 96, 64); g.fillStyle = "#111"; g.fillRect(10, 10, 76, 16); g.fillStyle = "#eee"; g.font = "bold 13px monospace"; g.fillText("0 4 7 1 9", 14, 23); g.fillStyle = "#333"; g.font = "9px monospace"; g.fillText("кВт·ч  СО-И446", 10, 50); }, false);
    for (let i = 0; i < 3; i++) {
      const x = 14.88 + i * 0.22;
      this.box(0.18, 0.26, 0.06, this.mat({ color: "#2b2e2d" }), x, 1.32, 3.17);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.1), new THREE.MeshBasicMaterial({ map: meterFace, color: "#b8b4a6" })); face.position.set(x, 1.5, 3.202); this.scene.add(face);
      const disc = this.cyl(0.045, 0.045, 0.004, this.mat({ color: "#a8a8a0", metalness: 0.8, roughness: 0.3 }), x, 1.38, 3.2, 16); this.meterDiscs.push(disc);
    }
    this.box(0.5, 0.05, 0.05, this.mat({ color: "#6a1a14" }), 15.1, 1.2, 3.18);
    const panel = new THREE.Group(); panel.position.set(14.75, 1.1, 3.17); this.scene.add(panel);
    this.box(0.7, 0.8, 0.02, metal, 0.35, 0, 0.01, false, panel);
    this.box(0.04, 0.08, 0.02, dark, 0.64, 0.38, 0.03, false, panel);
    this.sign("⚡ 380V", 0.35, 0.62, 0.022, 0.24, 0.1, 0, panel, "#1a1a1a", "#e2c23a");
    this.panelDoor = panel;
    this.spot("panel", new THREE.Vector3(15.1, 1.5, 3.2), () => this.panelOpen ? this.l("Закрыть электрощиток", "Close the fuse box") : this.l("Открыть электрощиток", "Open the fuse box"), () => this.departure !== "apartment", () => {
      this.panelOpen = !this.panelOpen; this.sfx.creak(0.08); this.sfx.click();
      if (this.panelOpen && !this.done.has("panelSeen")) {
        this.done.add("panelSeen");
        this.caption("Счётчики крутятся. На дверце нацарапано: «7 эт. — после полуночи не открывать».", "The meters spin. Scratched inside the door: \"7th floor — don't open after midnight\".");
      }
    }, "hall");
    // Light switch beside the stairwell door controls the landing lamp.
    this.box(0.08, 0.12, 0.02, this.mat({ color: "#e4ddc8" }), 11.05, 1.15, 7.925);
    this.box(0.03, 0.05, 0.02, this.mat({ color: "#bdb5a0" }), 11.05, 1.19, 7.91);
    this.spot("lightSwitch", new THREE.Vector3(11.05, 1.2, 7.91), () => this.hallLightOn ? this.l("Выключить свет", "Switch the light off") : this.l("Включить свет", "Switch the light on"), () => this.departure !== "apartment", () => {
      this.hallLightOn = !this.hallLightOn; this.sfx.click();
    }, "hall");
    // Neighbours' doorbells: someone (or something) answers.
    const answers: Record<string, [string, string][]> = {
      a: [["За дверью залаяла собака. Никто не открыл.", "A dog starts barking behind the door. Nobody answers."],
        ["Собака скулит и скребётся в дверь. Хозяев, видно, нет.", "The dog whines and scratches at the door. Its owners must be out."],
        ["Тишина. Даже собака замолчала.", "Silence. Even the dog has gone quiet."]],
      b: [["Шаркающие шаги… Глазок потемнел. Кто-то смотрит — и молчит.", "Shuffling steps… The peephole goes dark. Someone is watching — silently."],
        ["«Уходи», — шепчут из-за двери. Голос детский.", "\"Go away,\" someone whispers behind the door. A child's voice."],
        ["Никого. Только глазок всё ещё тёмный.", "Nobody. The peephole is still dark."]],
    };
    for (const [x, key, offset] of [[12.6, "a", -1], [14.8, "b", 0]] as const) {
      this.box(0.06, 0.08, 0.025, this.mat({ color: "#e6e0cc" }), x + 0.68, 1.45, 7.835);
      this.box(0.025, 0.025, 0.02, red, x + 0.68, 1.47, 7.82);
      this.spot(`bell-${key}`, new THREE.Vector3(x + 0.68, 1.5, 7.82), () => this.l(`Позвонить в квартиру ${4 * this.floor + offset}`, `Ring flat ${4 * this.floor + offset}`), () => this.departure !== "apartment", () => {
        const k = this.rings[key] = (this.rings[key] ?? 0) + 1;
        this.sfx.doorbell();
        if (key === "a" && k < 3) window.setTimeout(() => this.sfx.bark(), 700);
        const list = answers[key]; const [ru, en] = list[Math.min(k - 1, list.length - 1)];
        window.setTimeout(() => this.caption(ru, en), 900);
      }, "hall");
    }
    // Ground floor only: an old pram that rocks by itself.
    const pram = this.stroller = new THREE.Group(); pram.position.set(11.4, 0, 7.15); pram.rotation.y = 0.25; this.scene.add(pram);
    const pramM = this.mat({ map: fabricTex("#27334a"), roughness: 0.9 });
    const rock = new THREE.Group(); rock.position.y = 0.18; pram.add(rock); this.strollerBody = rock;
    this.box(0.42, 0.34, 0.78, pramM, 0, 0.12, 0, false, rock);
    const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.42, 14, 1, true, 0, Math.PI), pramM);
    hood.rotation.z = Math.PI / 2; hood.position.set(0, 0.46, -0.24); hood.material.side = THREE.DoubleSide; rock.add(hood);
    this.box(0.46, 0.025, 0.025, metal, 0, 0.62, 0.55, false, rock);
    for (const sx of [-0.2, 0.2]) { const bar = this.box(0.02, 0.02, 0.4, metal, sx, 0.42, 0.42, false, rock); bar.rotation.x = -0.6; }
    for (const [sx, sz] of [[-0.22, -0.28], [0.22, -0.28], [-0.22, 0.28], [0.22, 0.28]]) {
      const wheel = this.cyl(0.11, 0.11, 0.03, this.mat({ color: "#151515" }), sx, 0.0, sz, 14, pram); wheel.rotation.z = Math.PI / 2; wheel.position.y = 0.11;
    }
    this.floorProps.push({ obj: pram, floors: [1] });
    this.dynBoxes.push({ b: [11.1, 6.7, 11.7, 7.6], on: () => this.floor === 1 });
    this.spot("pram", new THREE.Vector3(11.4, 0.6, 7.15), () => this.l("Остановить коляску", "Stop the pram"), () => this.floor === 1 && this.departure === "ground" && this.strollerStop <= 0, () => {
      this.strollerStop = 7; this.sfx.creak(0.06);
      this.caption("Внутри пусто. Только старая погремушка… Кто её качал?", "It's empty. Just an old rattle… Who was rocking it?");
    }, "hall");
    // Damp footprints leading from the stair door towards the lift.
    const footprint = new THREE.MeshBasicMaterial({ color: "#29312f", transparent: true, opacity: 0.32, depthWrite: false });
    for (let i = 0; i < 7; i++) {
      const foot = new THREE.Mesh(new THREE.CircleGeometry(0.085, 12), footprint);
      foot.scale.set(0.55, 1, 1); foot.rotation.x = -Math.PI / 2; foot.rotation.z = (i % 2 ? 0.18 : -0.18);
      foot.position.set(10.45 + i * 0.31, 0.006, 7.35 - i * 0.47 + (i % 2 ? 0.12 : -0.12)); this.scene.add(foot);
    }
  }

  private buildDeparture() {
    const plaster = this.mat({ map: plasterTex(), color: "#b5b8ac" });
    const green = this.mat({ map: plasterTex(), color: "#4f7466" });
    const concrete = this.mat({ map: linoTex(), color: "#777c7b", roughness: 0.85 });
    const stepMat = this.mat({ map: plasterTex(), color: "#8c8a82", roughness: 0.9 });
    const metal = this.mat({ map: woodTex("#717a78", "#313735"), metalness: 0.65, roughness: 0.38 });
    const rail = this.mat({ color: "#3b2a1f", roughness: 0.6 });
    const dark = this.mat({ color: "#202625" });
    const door = this.mat({ map: woodTex("#5a3b2a", "#2a170e"), roughness: 0.7 });
    const lamp = new THREE.MeshBasicMaterial({ color: "#e6f2d5" });
    const wall = (w: number, d: number, x: number, z: number, y = 0, collide = y === 0, h = H, parent: THREE.Object3D = this.scene) => {
      this.box(w, h, d, plaster, x, y, z, collide, parent);
      this.box(w + 0.01, Math.min(1.15, h), d + 0.01, green, x, y, z, false, parent);
    };
    // ---- 7th / 1st floor hall (same layout every floor) ----
    this.box(7, 0.1, 5, concrete, 12.5, -0.1, 5.5);
    this.box(7, 0.1, 5, plaster, 12.5, H, 5.5);
    wall(3, 0.14, 10.5, 3); wall(2.4, 0.14, 14.8, 3);
    wall(0.14, 2, 16, 4); wall(0.14, 1.3, 16, 7.35);
    wall(0.14, 2, 9, 7);
    // hall wall towards the stairwell, with a doorway at x 9.6..10.8
    wall(0.46, 0.14, 9.37, 8); wall(5.2, 0.14, 13.4, 8);
    this.box(1.2, H - 2.1, 0.14, plaster, 10.2, 2.1, 8);
    this.floorDisplay = this.sign("7", 10.2, 2.35, 7.92, 0.36, 0.24, Math.PI);
    this.buildLift(metal, dark);
    // Neighbours' panelled doors, architraves, peepholes, handles and coir mats.
    for (const [x, n] of [[12.6, "27"], [14.8, "28"]] as const) {
      this.box(1, 2.12, 0.08, door, x, 0, 7.88);
      for (const dx of [-0.55, 0.55]) this.box(0.09, 2.22, 0.12, door, x + dx, 0, 7.86);
      this.box(1.19, 0.09, 0.12, door, x, 2.13, 7.86);
      this.box(0.78, 0.58, 0.025, dark, x, 1.3, 7.825);
      this.box(0.78, 0.58, 0.025, dark, x, 0.3, 7.825);
      this.doorSigns.push({ tex: this.sign(n, x, 1.93, 7.81, 0.22, 0.15, Math.PI), offset: n === "27" ? -1 : 0 });
      this.box(0.12, 0.03, 0.06, metal, x + 0.32, 1, 7.8);
      this.cyl(0.018, 0.018, 0.025, metal, x, 1.61, 7.8, 10).rotation.x = Math.PI / 2;
      this.box(1.04, 0.018, 0.48, this.mat({ map: fabricTex("#30291f"), roughness: 1 }), x, 0, 7.48);
    }
    this.buildHallDetails(metal, dark);
    // round frosted ceiling fixture ("таблетка") instead of a bare tube
    this.hallLamp = new THREE.MeshBasicMaterial({ color: "#f2f6e4" });
    const shade = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.hallLamp);
    shade.rotation.x = Math.PI; shade.scale.y = 0.45; shade.position.set(12.4, H - 0.03, 5.5); this.scene.add(shade);
    this.cyl(0.215, 0.215, 0.03, metal, 12.4, H - 0.05, 5.5, 20);
    const light = new THREE.PointLight("#d5eac7", this.isTouch ? 2.5 : 5, 9, 1.6);
    light.position.set(12.4, 2.5, 5.2); this.scene.add(light);
    this.hallLight = light;
    // The end wall is solid on every floor; the ground floor's street door replaces the lift instead.
    this.exitFiller = this.box(0.14, H, 1.7, plaster, 16, 0, 5.85);
    this.buildExit(metal);
    this.buildStairs(plaster, green, stepMat, rail, door, lamp, wall);
    this.buildStreet(metal, dark);
    this.buildRoadTrip();
  }

  /**
   * Stairwell behind the hall (x 9.2..15.8, z 8..10.5): two flights per storey around a railing.
   * One storey is modelled and repeated above/below; walking a full storey shifts the floor counter,
   * so the descent from floor 7 to floor 1 is seamless. Floor-specific props swap at the wrap.
   */
  private buildStairs(plaster: THREE.Material, green: THREE.Material, stepMat: THREE.Material, rail: THREE.Material, doorMat: THREE.Material, lamp: THREE.Material,
    wall: (w: number, d: number, x: number, z: number, y?: number, collide?: boolean, h?: number) => void) {
    const slab = this.mat({ map: linoTex(), color: "#6f6a62", roughness: 0.9 });
    const nosing = this.mat({ color: "#4a4a46", metalness: 0.5, roughness: 0.5 });
    // Frosted, rain-streaked glass with the blurred glow of the courtyard lamps behind it.
    const frosted = canvasTex(256, 280, (g) => {
      const bg = g.createLinearGradient(0, 0, 0, 280); bg.addColorStop(0, "#1b2533"); bg.addColorStop(1, "#2a2622");
      g.fillStyle = bg; g.fillRect(0, 0, 256, 280);
      for (const [x, y, r, c] of [[70, 190, 70, "255,170,90"], [200, 150, 40, "255,190,120"], [150, 230, 30, "210,220,255"]] as const) {
        const gr = g.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, `rgba(${c},0.75)`); gr.addColorStop(1, `rgba(${c},0)`);
        g.fillStyle = gr; g.fillRect(0, 0, 256, 280);
      }
      for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(230,235,240,${Math.random() * 0.05})`; g.fillRect(Math.random() * 256, Math.random() * 280, 2, 2); }
      for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(200,215,230,${0.12 + Math.random() * 0.18})`; g.lineWidth = 1 + Math.random() * 2.5; const x = Math.random() * 256, y = Math.random() * 280; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.random() * 4 - 2, y + 15 + Math.random() * 50); g.stroke(); }
      g.fillStyle = "#3b2a1f"; g.fillRect(124, 0, 8, 280); g.fillRect(0, 120, 256, 8);
    }, false);
    const glassWin = new THREE.MeshBasicMaterial({ map: frosted, color: "#30404f" });
    this.stairWin = glassWin;
    const chuteNote = canvasTex(256, 200, (g) => paintNotice(g, 256, 200, NOTICES.chute, this.lang), false);
    const chuteNoteM = this.mat({ map: chuteNote, roughness: 0.95 });
    const chuteM = this.mat({ map: plasterTex(), color: "#8f948c", metalness: 0.15, roughness: 0.8 });
    const potM = this.mat({ color: "#8a4a2a", roughness: 0.9 }), plantM = this.mat({ color: "#2f4a24", roughness: 1 });
    // collisions (2D, once)
    this.boxes.push([9.07, 8.0, 9.21, 10.5], [15.73, 8.0, 15.9, 10.5], [9.0, 10.43, 15.9, 10.57], [11.2, 9.2, 14.8, 9.3], [15.27, 8.0, 15.75, 8.48]);
    for (const o of [-2 * H, -H, 0, H]) {
      const i = Math.round(o / H);
      // outer walls of this storey
      wall(0.14, 2.5, 9.14, 9.25, o, false); wall(0.14, 2.5, 15.8, 9.25, o, false); wall(6.8, 0.14, 12.5, 10.5, o, false);
      if (o !== 0) { wall(0.46, 0.14, 9.37, 8, o, false); wall(5.2, 0.14, 13.4, 8, o, false); this.box(1.2, H - 2.1, 0.14, plaster, 10.2, o + 2.1, 8); }
      // landings
      this.box(2.0, 0.14, 2.36, slab, 10.2, o - 0.14, 9.25);
      this.box(0.95, 0.14, 2.36, slab, 15.27, o - 1.35 - 0.14, 9.25);
      // flights: 9 steps of 0.4 m x 0.15 m each, with worn steel nosings
      for (let s = 0; s < 9; s++) {
        const yA = o - (s + 0.5) * 0.15, yB = o - 1.35 - (s + 0.5) * 0.15;
        this.box(0.4, 0.3, 1.13, stepMat, 11.4 + s * 0.4, yA - 0.3, 8.63);
        this.box(0.4, 0.3, 1.13, stepMat, 14.6 - s * 0.4, yB - 0.3, 9.87);
        this.box(0.03, 0.012, 1.13, nosing, 11.215 + s * 0.4, yA, 8.63);
        this.box(0.03, 0.012, 1.13, nosing, 14.785 - s * 0.4, yB, 9.87);
        // balusters along the well
        this.box(0.025, 0.9, 0.025, rail, 11.4 + s * 0.4, yA, 9.22);
        this.box(0.025, 0.9, 0.025, rail, 14.6 - s * 0.4, yB, 9.28);
      }
      for (const [z, y0] of [[9.22, o], [9.28, o - 1.35]] as const) {
        const hr = this.box(3.7, 0.05, 0.07, rail, 13.0, 0, z);
        hr.position.y = y0 - 0.675 + 0.92; hr.rotation.z = (z === 9.22 ? -1 : 1) * Math.atan2(1.35, 3.6);
      }
      // frosted window on the mid landing: frame, sill, a dusty plant and a jar of cigarette ends
      const wy = o - 1.35;
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.1), glassWin);
      win.position.set(15.72, wy + 1.55, 9.25); win.rotation.y = -Math.PI / 2; this.scene.add(win);
      for (const dz of [-0.53, 0.53]) this.box(0.06, 1.18, 0.06, rail, 15.7, wy + 0.97, 9.25 + dz);
      this.box(0.06, 0.06, 1.12, rail, 15.7, wy + 2.1, 9.25);
      this.box(0.26, 0.04, 1.2, this.mat({ color: "#d6d2c4", roughness: 0.5 }), 15.62, wy + 0.97, 9.25);
      this.cyl(0.07, 0.055, 0.13, potM, 15.62, wy + 1.01, 9.62, 10);
      for (let k = 0; k < 4; k++) { const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), plantM); leaf.scale.set(1, 0.5, 1.6); leaf.position.set(15.62 + (k % 2 ? 0.03 : -0.03), wy + 1.18 + k * 0.025, 9.62 + (k - 1.5) * 0.04); leaf.rotation.y = k; this.scene.add(leaf); }
      const jar = this.cyl(0.04, 0.04, 0.1, new THREE.MeshStandardMaterial({ color: "#9ab0a0", transparent: true, opacity: 0.45, roughness: 0.1 }), 15.6, wy + 1.01, 8.95, 10);
      void jar;
      // rubbish chute in the corner with a hinged hatch
      this.box(0.46, H, 0.4, chuteM, 15.5, wy - H / 2, 8.27);
      this.box(0.4, 0.34, 0.02, this.mat({ color: "#1a1c1b" }), 15.5, wy + 0.58, 8.475);
      const hatch = new THREE.Group(); hatch.position.set(15.5, wy + 0.58, 8.49); this.scene.add(hatch);
      this.box(0.38, 0.32, 0.025, chuteM, 0, 0, 0, false, hatch);
      this.box(0.14, 0.03, 0.03, this.mat({ color: "#2a2c2b", metalness: 0.6 }), 0, 0.26, 0.02, false, hatch);
      this.chuteHatches.push(hatch);
      const cn = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.22), chuteNoteM); cn.position.set(15.0, wy + 1.5, 8.085); cn.rotation.z = 0.04; this.scene.add(cn);
      // radiator, bulbs, floor number painted by each doorway
      for (let r = 0; r < 8; r++) this.box(0.08, 0.5, 0.05, plaster, 15.62, wy + 0.25, 8.9 + r * 0.1);
      this.box(0.14, 0.07, 0.14, lamp, 10.2, o + H - 0.08, 9.25);
      this.box(0.14, 0.07, 0.14, lamp, 15.27, o + H - 1.35 - 0.08, 9.25);
      this.stairSigns.push({ i, tex: this.sign("7", 10.2, o + 2.35, 8.08, 0.36, 0.24) });
      // graffiti on the landing wall changes from floor to floor
      const gt = canvasTex(512, 200, () => {}, false);
      const gm = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.45), new THREE.MeshBasicMaterial({ map: gt, transparent: true, depthWrite: false }));
      gm.position.set(9.215, o + 0.75, 9.75); gm.rotation.y = Math.PI / 2; this.scene.add(gm);
      this.graffiti.push({ i, tex: gt });
      // closed door leaf on the other storeys; on this storey the leaf swings
      if (o === 0) {
        this.stairDoor = new THREE.Group(); this.stairDoor.position.set(9.6, 0, 8.02); this.scene.add(this.stairDoor);
        this.box(1.2, 2.08, 0.05, doorMat, 0.6, 0, 0, false, this.stairDoor);
        this.box(0.14, 0.03, 0.05, rail, 1.05, 1.0, 0.04, false, this.stairDoor);
      } else this.box(1.2, 2.08, 0.05, doorMat, 10.2, o, 8.02);
      this.box(0.12, 0.18, 0.02, lamp, 10.2, o + 1.0, 10.42);
    }
    this.box(6.8, 0.2, 2.5, plaster, 12.5, 2 * H, 9.25);
    const a = new THREE.PointLight("#e2efc9", this.isTouch ? 2.4 : 4, 7, 1.6); a.position.set(10.2, H - 0.3, 9.25); this.scene.add(a);
    if (!this.isTouch) { const b = new THREE.PointLight("#e2efc9", 2.6, 6, 1.6); b.position.set(15.0, H - 1.6, 9.25); this.scene.add(b); }
    this.stairLight = a;
    // Floor-specific life on the mid landing (swapped when the floor counter changes).
    const cat = buildCat(this.isTouch, "#2d2621");
    cat.group.position.set(15.35, -1.35, 10.1); cat.group.rotation.y = -Math.PI / 2 - 0.4; this.scene.add(cat.group);
    this.cats.push({ cat, yaw: cat.group.rotation.y });
    this.floorProps.push({ obj: cat.group, floors: [4] });
    const saucer = this.cyl(0.08, 0.06, 0.025, this.mat({ color: "#e8e2d4", roughness: 0.3 }), 15.05, -1.35, 10.25, 14);
    this.floorProps.push({ obj: saucer, floors: [4] });
    this.spot("cat-stairs", new THREE.Vector3(15.35, -1.05, 10.1), () => this.l("Погладить кошку", "Pet the cat"), () => this.floor === 4 && this.departure === "stairs", () => this.petCat(), "stairs");
    const bottles = new THREE.Group(); this.scene.add(bottles);
    const glassG = new THREE.MeshStandardMaterial({ color: "#2f5a2e", transparent: true, opacity: 0.75, roughness: 0.1 });
    const glassB = new THREE.MeshStandardMaterial({ color: "#5a3416", transparent: true, opacity: 0.75, roughness: 0.1 });
    for (const [x, z, m, lie] of [[15.55, 9.95, glassG, false], [15.45, 10.2, glassB, false], [15.2, 10.05, glassG, true]] as const) {
      const b = this.cyl(0.035, 0.035, 0.24, m, x, -1.35, z, 10, bottles);
      if (lie) { b.rotation.z = Math.PI / 2; b.position.y = -1.35 + 0.035; }
      this.cyl(0.012, 0.02, 0.08, m, x, -1.35 + 0.24, z, 8, bottles).visible = !lie;
    }
    this.floorProps.push({ obj: bottles, floors: [6] });
    this.spot("bottles", new THREE.Vector3(15.4, -1.2, 10.05), () => this.l("Осмотреть бутылки", "Look at the bottles"), () => this.floor === 6 && this.departure === "stairs", () => {
      this.caption("Пустые бутылки и окурки. Опять соседи с шестого «отмечали».", "Empty bottles and cigarette ends. The sixth-floor neighbours were \"celebrating\" again.");
    }, "stairs");
    this.spot("chute", new THREE.Vector3(15.5, -0.6, 8.5), () => this.l("Открыть мусоропровод", "Open the rubbish chute"), () => this.departure === "stairs" && this.chuteT <= 0, () => {
      this.chuteCount++; this.chuteT = 3.4; this.sfx.creak(0.07); this.sfx.chute();
      const lines: [string, string][] = [
        ["Внизу что-то долго падало… и вдруг перестало. Будто поймали.", "Something falls for a long time down there… then stops. As if caught."],
        ["Из люка тянет холодом — и почему-то сладкой ватой.", "Cold air seeps from the hatch — smelling, oddly, of candy floss."],
        ["Тишина. Лучше его больше не открывать.", "Silence. Better not open it again."],
      ];
      const [ru, en] = lines[Math.min(this.chuteCount - 1, lines.length - 1)];
      this.caption(ru, en);
    }, "stairs");
    this.spot("notice-chute", new THREE.Vector3(15.0, 0.15, 8.1), () => this.l("Прочитать объявление", "Read the notice"), () => this.departure === "stairs",
      () => this.read(NOTICES.chute.title[this.lang], NOTICES.chute.body[this.lang]), "stairs");
    this.spot("stairWindow", new THREE.Vector3(15.65, 0.2, 9.25), () => this.l("Посмотреть в окно", "Look out of the window"), () => this.departure === "stairs", () => {
      this.windowLooks++;
      if (this.windowLooks === 1) this.caption("Сквозь мутное стекло — фонари и дождь. У качелей кто-то стоит… Нет, показалось.", "Through the grimy glass — streetlights and rain. Someone is standing by the swings… No, just my imagination.");
      else this.caption("Дождь не стихает. Машина ждёт у фонаря.", "The rain won't let up. The car is waiting under the streetlight.");
    }, "stairs");
    this.updateFloorSigns();
  }
  private petCat() {
    this.catPets++; this.sfx.purr(); if (this.catPets % 3 === 0) this.sfx.meow();
    const lines: [string, string][] = [
      ["Тёплая. Мурчит. Хоть кто-то в этом доме мне рад.", "Warm. Purring. At least someone in this building is glad to see me."],
      ["Кошка уставилась куда-то мне за спину. Не люблю, когда они так делают.", "The cat stares at something behind me. I hate it when they do that."],
      ["Мяукнула и потёрлась о ботинок. Ладно, мне пора.", "She meows and rubs against my boot. All right, I have to go."],
    ];
    const [ru, en] = lines[(this.catPets - 1) % lines.length];
    this.caption(ru, en);
  }
  private updateFloorSigns() {
    for (const s of this.stairSigns) { const f = this.floor + s.i; this.paintSign(s.tex, f >= 1 && f <= 9 ? String(f) : ""); }
    this.paintSign(this.floorDisplay, String(this.floor));
    for (const d of this.doorSigns) this.paintSign(d.tex, String(4 * this.floor + d.offset));
    const tags: Record<number, [string, string, string]> = {
      9: ["КРЫША ЗАКРЫТА", "ROOF CLOSED", "#5a1a14"], 8: ["АЛИСА", "ALISA", "#1a2a5a"], 7: ["ЦОЙ ЖИВ", "TSOI LIVES", "#141414"],
      6: ["Здесь был Вася", "Vasya was here", "#2a2a6a"], 5: ["СПАРТАК — ЧЕМПИОН", "SPARTAK FOREVER", "#7a1410"], 4: ["Катя + Серёжа", "Katya + Seryozha", "#7a1a4a"],
      3: ["НЕ ХОДИ В ПАРК", "DON'T GO TO THE PARK", "#5a0e0a"], 2: ["КИНО", "KINO", "#141414"], 1: ["ОН ЖДЁТ", "HE IS WAITING", "#6a0c08"],
    };
    for (const gs of this.graffiti) {
      const f = this.floor + gs.i, c = gs.tex.image as HTMLCanvasElement, g = c.getContext("2d");
      if (!g) continue;
      g.clearRect(0, 0, c.width, c.height);
      const tag = tags[f];
      if (tag) {
        g.save(); g.translate(30, 120); g.rotate(-0.05 - (f % 3) * 0.03);
        g.font = `bold ${f === 1 || f === 3 ? 64 : 56}px 'Comic Sans MS', 'Segoe Print', cursive`;
        g.fillStyle = tag[2]; g.globalAlpha = 0.78; g.fillText(this.l(tag[0], tag[1]), 0, 0);
        if (f === 4) { g.font = "bold 60px serif"; g.fillText("♥", g.measureText(this.l(tag[0], tag[1])).width + 18, 0); }
        g.restore();
      }
      gs.tex.needsUpdate = true;
    }
    const ground = hallFeature(this.floor) === "exit";
    this.liftGroup.visible = !ground;
    if (this.exitGroup) this.exitGroup.visible = ground;
    for (const p of this.floorProps) p.obj.visible = p.floors.includes(this.floor);
  }
  /** Local ground height: hall/landing 0, flights descend one storey (H) per lap. */
  private groundY(x: number, z: number) {
    if (x >= 16) return x > 19.5 && x < 28.5 ? -0.15 : 0;
    if (z < 8.07 || x <= 11.2) return 0;
    if (x >= 14.8) return -1.35;
    const f = (x - 11.2) / 3.6;
    return z < 9.25 ? -f * 1.35 : -1.35 - (1 - f) * 1.35;
  }

  private buildStreet(metal: THREE.Material, dark: THREE.Material) {
    const st = this.street = new THREE.Group(); this.scene.add(st); st.visible = false;
    const lite = this.isTouch;
    // panel-block facade with random lit windows (also hides the interior behind it)
    const lit: [number, number][] = [];
    const facadeTex = canvasTex(1024, 1024, (g) => {
      g.fillStyle = "#5d5f5c"; g.fillRect(0, 0, 1024, 1024);
      for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(20,20,20,${Math.random() * 0.12})`; g.fillRect(Math.random() * 1024, Math.random() * 1024, 3, 3); }
      g.strokeStyle = "rgba(25,25,25,0.55)"; g.lineWidth = 3;
      for (let r = 0; r <= 9; r++) { g.beginPath(); g.moveTo(0, r * 113.8); g.lineTo(1024, r * 113.8); g.stroke(); }
      for (let c = 0; c <= 6; c++) { g.beginPath(); g.moveTo(c * 170.7, 0); g.lineTo(c * 170.7, 1024); g.stroke(); }
      for (let r = 0; r < 9; r++) for (let c = 0; c < 6; c++) {
        if (r === 8 && c === 3) continue; // entrance bay
        const x = c * 170.7 + 45, y = r * 113.8 + 30;
        g.fillStyle = "#a6a293"; g.fillRect(x - 5, y - 5, 90, 70);
        g.fillStyle = "#151c24"; g.fillRect(x, y, 80, 60);
        g.fillStyle = "#a6a293"; g.fillRect(x + 38, y, 4, 60); g.fillRect(x, y + 20, 80, 3);
        if (Math.random() < 0.28) lit.push([x, y]);
        g.fillStyle = "#3c3a36"; g.fillRect(x - 6, y + 64, 92, 7);
      }
      g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(0, 0, 1024, 30);
    }, false);
    const litTex = canvasTex(1024, 1024, (g) => {
      g.fillStyle = "#000"; g.fillRect(0, 0, 1024, 1024);
      for (const [x, y] of lit) { g.fillStyle = Math.random() < 0.5 ? "#ffb35c" : "#d9e4ff"; g.globalAlpha = 0.55 + Math.random() * 0.4; g.fillRect(x, y, 80, 60); g.fillStyle = "#331a08"; g.globalAlpha = 0.5; g.fillRect(x + 38, y, 4, 60); g.fillRect(x, y + 20, 80, 3); }
      g.globalAlpha = 1;
    }, false);
    const facade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 24.3, 19), new THREE.MeshLambertMaterial({ map: facadeTex, emissive: "#ffffff", emissiveMap: litTex, emissiveIntensity: 0.9 }));
    facade.position.set(16.19, 12.15, 5.5 + 0.35); st.add(facade);
    // the rest of our long block continues up and down the street
    for (const [z, ent, seed] of [[-14.65, 4, 71], [26.35, -4, 72]] as const) {
      const b = buildBlock(this.kit, { len: 22, depth: 12, floors: 9, seed, lit: 0.3, entrances: [ent] });
      b.group.position.set(10.3, 0.6, z); b.group.rotation.y = Math.PI / 2; st.add(b.group);
    }
    // entrance: door, canopy, warm lamp, steps
    this.box(0.05, 2.25, 1.3, this.mat({ map: woodTex("#3a2a20", "#1a110b") }), 16.33, 0, 5.85, false, st);
    this.box(0.04, 0.9, 0.8, this.mat({ color: "#2c3c44", transparent: true, opacity: 0.6 }), 16.37, 1.1, 5.85, false, st);
    this.box(1.6, 0.12, 2.6, this.mat({ color: "#4c4a45" }), 17.1, 2.6, 5.85, false, st);
    this.box(1.6, 0.12, 2.0, this.mat({ map: plasterTex(), color: "#77746d" }), 17.1, -0.02, 5.85, false, st);
    this.box(0.25, 0.12, 0.05, new THREE.MeshBasicMaterial({ color: "#ffd59a" }), 16.42, 2.42, 5.85, false, st);
    const doorLamp = new THREE.PointLight("#ffbf73", lite ? 3 : 6, 7, 1.7); doorLamp.position.set(16.9, 2.35, 5.85); st.add(doorLamp);
    this.sign("12", 16.32, 3.0, 4.6, 0.36, 0.24, Math.PI / 2, st);
    // sidewalk, curbs, wet asphalt with markings, far sidewalk
    const pave = this.mat({ map: (() => { const t = linoTex(); t.repeat.set(4, 22); return t; })(), color: "#5e605d", roughness: 0.6 });
    this.box(3.2, 0.2, 26, pave, 17.9, -0.2, 4.5, false, st);
    const curb = this.mat({ color: "#8b8b86", roughness: 0.7 });
    this.box(0.18, 0.2, 26, curb, 19.5, -0.2, 4.5, false, st);
    this.box(0.18, 0.2, 60, curb, 28.5, -0.2, 4.5, false, st);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(9, 90), lite ? new THREE.MeshLambertMaterial({ color: "#1d2125" }) : new THREE.MeshStandardMaterial({ color: "#1a1e22", roughness: 0.22, metalness: 0.35 }));
    road.rotation.x = -Math.PI / 2; road.position.set(24, -0.15, 4.5); st.add(road);
    const paint = new THREE.MeshBasicMaterial({ color: "#a8a597" });
    for (let z = -40; z < 48; z += 4) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 2), paint); m.rotation.x = -Math.PI / 2; m.position.set(24, -0.145, z); st.add(m); }
    this.box(3, 0.2, 90, pave, 30, -0.2, 4.5, false, st);
    for (let i = 0; i < 10; i++) {
      const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.5 + Math.random() * 0.9, 24), lite ? new THREE.MeshLambertMaterial({ color: "#2a3338", transparent: true, opacity: 0.6 }) : new THREE.MeshStandardMaterial({ color: "#46545a", roughness: 0.02, metalness: 0.9, transparent: true, opacity: 0.55 }));
      puddle.rotation.x = -Math.PI / 2; puddle.scale.y = 0.5; puddle.position.set(20.5 + Math.random() * 7, -0.14, -6 + i * 2.4); st.add(puddle);
    }
    // fence along the far sidewalk
    for (let z = -40; z < 50; z += 2.2) { this.box(0.05, 1.3, 0.05, metal, 31.3, 0, z, false, st); }
    for (const y of [0.4, 1.2]) this.box(0.04, 0.05, 90, metal, 31.3, y, 5, false, st);
    // street lamps with soft light cones and road reflections
    const cone = new THREE.MeshBasicMaterial({ color: "#ffcf8a", transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const glowTex = canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, "rgba(255,200,130,0.8)"); r.addColorStop(1, "rgba(255,200,130,0)"); g.fillStyle = r; g.fillRect(0, 0, 128, 128); }, false);
    const glow = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    [-3, 9.5, 22].forEach((z, i) => {
      this.cyl(0.06, 0.09, 6, metal, 19.85, 0, z, 10, st);
      const arm = this.box(1.6, 0.06, 0.06, metal, 20.6, 5.9, z, false, st); arm.rotation.z = -0.08;
      this.box(0.6, 0.14, 0.3, dark, 21.3, 5.72, z, false, st);
      const lens = new THREE.MeshBasicMaterial({ color: "#ffe6b8" });
      this.box(0.5, 0.03, 0.22, lens, 21.3, 5.7, z, false, st);
      const c = new THREE.Mesh(new THREE.ConeGeometry(2.4, 5.6, 24, 1, true), cone); c.position.set(21.3, 2.9, z); st.add(c);
      const r = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 7), glow); r.rotation.x = -Math.PI / 2; r.position.set(22.4, -0.135, z + 1.5); st.add(r);
      let l: THREE.PointLight | null = null;
      if (!lite || i === 1) { l = new THREE.PointLight("#ffcf8a", lite ? 14 : 22, 16, 1.4); l.position.set(21.3, 5.4, z); st.add(l); }
      // the lamp at the far end is dying: it buzzes and blinks
      if (i === 2) this.badLamp = { light: l, lens, cone: c, base: lite ? 14 : 22 };
    });
    // bench and bin by the entrance
    this.box(0.45, 0.06, 1.6, this.mat({ map: woodTex("#4e3a28", "#24170c") }), 17.0, 0.45, 1.5, false, st);
    for (const z of [0.85, 2.15]) this.box(0.4, 0.45, 0.06, metal, 17.0, 0, z, false, st);
    this.cyl(0.22, 0.2, 0.7, metal, 17.0, 0, 2.8, 12, st);
    this.boxes.push([16.75, 0.7, 17.25, 3.05]);
    // trunks of the sidewalk trees
    for (const [x, z] of [[18.6, -1.6], [18.7, 13.2], [18.5, -9.5]]) this.boxes.push([x - 0.18, z - 0.18, x + 0.18, z + 0.18]);
    // a neighbour's parked car up the street and the player's car under the lamp
    const other = buildCar(lite, "#6b2a24");
    for (const s of other.headlights) { s.parent?.remove(s); s.target.parent?.remove(s.target); }
    other.headlights = [];
    // Opposite lane: the animated pull-away never intersects this parked car.
    other.group.position.set(26.35, -0.15, -4.2); st.add(other.group);
    this.boxes.push([26.35 - other.half[0], -4.2 - other.half[1], 26.35 + other.half[0], -4.2 + other.half[1]]);
    this.buildCar(st);
    this.streetRain = createRain(lite ? 1400 : 3600, 18, 12);
    this.streetRain.uniforms.uCenter.value.set(22, 2, 5);
    st.add(this.streetRain.mesh);
    // the living part: blocks across the road, swaying trees, playground, leaves, wires and traffic
    this.streetLife = buildStreetLife(st, lite, () => this.sfx.honk(), this.kit);
    // a stray cat sheltering from the rain on the entrance step
    const cat = buildCat(lite, "#5a4a3a");
    cat.group.position.set(17.55, 0.1, 6.55); cat.group.rotation.y = Math.PI / 2 + 0.5; st.add(cat.group);
    this.cats.push({ cat, yaw: cat.group.rotation.y });
    this.spot("cat-street", new THREE.Vector3(17.55, 0.4, 6.55), () => this.l("Погладить кошку", "Pet the cat"), () => this.departure === "street", () => this.petCat(), "street");
  }

  private buildCar(parent: THREE.Object3D) {
    const car = this.car = buildCar(this.isTouch);
    const cx = 21.2, cz = 7.2;
    car.group.position.set(cx, -0.15, cz); parent.add(car.group);
    this.boxes.push([cx - car.half[0], cz - car.half[1], cx + car.half[0], cz + car.half[1]]);
    const world = (v: THREE.Vector3) => v.clone().add(car.group.position);
    this.seatEye = world(car.driverEye);
    this.spot("carDoor", new THREE.Vector3(cx - 0.95, 0.9, cz - 0.1), () => this.l("Сесть за руль", "Get into the driver's seat"), () => this.departure === "street", () => {
      this.advanceDeparture("enterCar"); this.sfx.click(); this.sfx.door(); this.yaw = 0; this.pitch = -0.18;
      this.caption("Дорога ведёт к старому парку. Пора узнать правду.", "The road leads to the old park. Time to find the truth.");
    });
    this.spot("ignition", world(car.ignition), () => this.l("Повернуть ключ — завести машину", "Turn the key — start the engine"), () => this.departure === "car", () => {
      this.advanceDeparture("startEngine"); this.sfx.click(); this.motor(24, 0.06);
      setCarLights(car, true, this.isTouch ? 14 : 40);
      this.caption("Двигатель ожил. Назад дороги нет.", "The engine comes alive. No turning back now.");
    });
  }

  private changeFloor(dir: -1 | 1) {
    const lap = stairLap(this.floor, dir);
    if (!lap) return false;
    this.floor = lap.floor;
    // Reuse the identical landing one storey above/below without a visible camera jump.
    this.pos.y += lap.cameraYOffset;
    this.updateFloorSigns(); this.sfx.creak(0.05);
    const f = this.floor;
    if (f === 1 && this.departure === "stairs") {
      this.advanceDeparture("arrive");
      this.caption("Первый этаж. Выход там, где наверху лифт. За дверью всё ещё льёт.", "First floor. The way out is where the lift is upstairs. It's still pouring outside.");
    } else if (dir < 0 && f === 4) this.caption("Четвёртый… На каждом этаже одна и та же лампочка мигает.", "Fourth… the same bulb flickers on every floor.");
    return true;
  }
  private advanceDeparture(action: DepartureAction) {
    const next = departureNext(this.departure, action);
    if (next === this.departure) return;
    this.departure = next; this.departureTime = 0; this.focus = null;
    if (canBeginMainGame(next)) { this.finished = true; this.cb.onDone(); }
  }
  private caption(ru: string, en: string) {
    this.voice?.pause(); this.subtitle = this.l(ru, en);
  }
  private motor(frequency: number, volume: number) {
    this.engine?.stop();
    const oscillator = this.sfx.ctx.createOscillator(); const gain = this.sfx.ctx.createGain();
    oscillator.type = "sawtooth"; oscillator.frequency.value = frequency; gain.gain.value = volume;
    oscillator.connect(gain).connect(this.sfx.master); oscillator.start(); this.engine = oscillator;
  }

  private lightsSetup() {
    const add = (x: number, y: number, z: number, color: string, intensity: number, dist: number) => {
      const light = new THREE.PointLight(color, intensity, dist, 1.6);
      light.position.set(x, y, z);
      this.scene.add(light);
      const bulb = new THREE.MeshStandardMaterial({ color: "#fff2d8", emissive: color, emissiveIntensity: 2 });
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), bulb); m.position.copy(light.position); this.scene.add(m);
      this.lamps.push({ light, bulb, base: intensity });
    };
    add(2.4, H - 0.55, 3.1, "#ffcf90", 7, 9);   // chandelier
    add(4.55, 1.55, 5.2, "#ffb060", 3, 5);     // floor lamp
    add(6.8, H - 0.25, 1.5, "#fff0c8", this.isTouch ? 0 : 2.2, 5);   // kitchen (flickers)
    add(7.2, H - 0.25, 4.6, "#ffe0b0", 3, 5);  // hall
    this.tvLight = new THREE.PointLight("#9ab8ff", 0, 5, 2);
    this.tvLight.position.set(1.0, 0.9, 3.1);
    this.scene.add(this.tvLight);
  }

  // ---------- helpers ----------
  private l(ru: string, en: string) { return this.lang === "ru" ? ru : en; }
  private spot(id: string, pos: THREE.Vector3, label: () => string, ok: () => boolean, use: () => void, zone?: Zone) { this.spots.push(zone ? { id, pos, label, ok, use, zone } : { id, pos, label, ok, use }); }
  /** Which space the player stands in, so objects behind a wall never get focus. */
  private zone(): Zone {
    const { x, z } = this.pos;
    if (x >= 16.1) return "street";
    if (z > 8.03 && x > 9.15) return "stairs";
    if (x > 9.05 && z <= 8.03) return "hall";
    return "apt";
  }
  private ready() { return ["tv", "phone", "photo", "window"].every((k) => this.done.has(k)); }
  private objective() {
    if (this.finished) return "";
    const goals: Partial<Record<DepartureStage, string>> = {
      landing: this.l("7 этаж · Спуститься по лестнице", "Floor 7 · Take the stairs down"),
      stairs: this.l(`Лестница · Этаж ${this.floor} · Вниз на 1-й`, `Stairs · Floor ${this.floor} · Down to 1`),
      ground: this.l("1 этаж · Выйти на улицу", "Floor 1 · Leave the building"),
      street: this.l("Подойти к своей машине у фонаря", "Reach your car under the streetlight"),
      car: this.l("Завести машину", "Start the car"),
      starting: this.l(this.departureTime < 1.65 ? "Двигатель запускается…" : "Отъезд от дома…", this.departureTime < 1.65 ? "Engine starting…" : "Driving away…"),
    };
    if (goals[this.departure]) return goals[this.departure];
    if (this.done.has("keys")) return this.l("Выйти из квартиры", "Leave the apartment");
    if (this.ready()) return this.l("Взять ключи у входной двери", "Take the keys by the front door");
    const todo: string[] = [];
    if (!this.done.has("tv")) todo.push(this.l("включить телевизор", "turn on the TV"));
    if (!this.done.has("phone")) todo.push(this.l("прослушать автоответчик в прихожей", "check the answering machine in the hall"));
    if (!this.done.has("photo")) todo.push(this.l("найти старую фотографию", "find the old photo"));
    if (this.done.has("phone") && !this.done.has("window")) todo.push(this.l("выглянуть в окно", "look out the window"));
    return todo.join(" · ");
  }
  private say(id: string, after?: () => void) {
    this.voice?.pause();
    const line = APARTMENT[id];
    this.subtitle = line.text[this.lang];
    const a = new Audio(voiceUrl(this.lang, id));
    a.volume = 1;
    this.voice = a;
    let fired = false;
    const end = () => { if (fired) return; fired = true; if (this.voice === a) this.subtitle = ""; after?.(); };
    a.onended = end;
    a.onerror = () => setTimeout(end, 5000);
    a.play().catch(() => setTimeout(end, Math.max(4000, this.subtitle.length * 70)));
  }

  // ---------- input ----------
  lock() { if (!this.isTouch) this.renderer.domElement.requestPointerLock?.(); void this.sfx.ctx.resume(); }
  toggleFlash() { if (this.done.has("keys")) { this.flashOn = !this.flashOn; this.sfx.click(); } }
  interact() {
    void this.sfx.ctx.resume();
    if (this.reading) { this.reading = null; this.sfx.click(); return; }
    if (this.focus) this.focus.use();
  }
  private onKeyDown = (e: KeyboardEvent) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
    this.keys.add(e.code);
    if (!e.repeat && e.code === "KeyE") this.interact();
    if (!e.repeat && e.code === "KeyF") this.toggleFlash();
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
  private onBlur = () => { this.keys.clear(); this.touch.mx = 0; this.touch.my = 0; this.touch.sprint = false; };
  private onMouseMove = (e: MouseEvent) => { if (document.pointerLockElement === this.renderer.domElement) this.look(e.movementX, e.movementY, 0.0022); };
  private onMouseDown = () => { if (this.isTouch) return; if (document.pointerLockElement !== this.renderer.domElement) this.lock(); else this.interact(); };
  private onResize = () => {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  };
  private bind() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    this.renderer.domElement.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("resize", this.onResize);
    window.addEventListener("blur", this.onBlur);
  }
  private look(dx: number, dy: number, k: number) {
    this.yaw -= dx * k;
    this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch - dy * k));
  }
  private hallOpen() { return this.departure === "landing" || this.departure === "ground" || (this.departure === "stairs" && this.floor === START_FLOOR); }
  private blocked(x: number, z: number) {
    const d = this.departure;
    if (d === "car" || d === "starting" || this.finished || this.transition) return true;
    if (x > 8.9 && x < 16.2 && z < 3.28 && z > 2.72) return true; // closed lift doors
    if (x > 15.7 && x < 16.6) return true; // building wall / exit door (opened by interaction only)
    if (d !== "apartment" && x < 9.35 && z < 7.9) return true; // own apartment closed behind us
    if (x > 9.5 && x < 10.9 && z > 7.75 && z < 8.25 && !(this.hallOpen() && this.stairDoorOpen > 0.8)) return true;
    if (d === "ground" && x > 11.2 && z > 8.07) return true; // no basement trips
    const stair = x > 9.2 && x < 15.75;
    if (x < 0.15 || x > 31 || z < (x < 9 ? 0.15 : x < 16 ? 0.95 : -12) || z > (x < 16 ? (stair ? 10.43 : 7.8) : 20)) return true;
    for (const [a, b, c, d] of this.boxes) if (x > a - R && x < c + R && z > b - R && z < d + R) return true;
    for (const { b, on } of this.dynBoxes) if (on() && x > b[0] - R && x < b[2] + R && z > b[1] - R && z < b[3] + R) return true;
    if (this.street.visible) for (const f of this.streetLife.obstacles?.() ?? []) if (f && x > f[0] - R && x < f[2] + R && z > f[1] - R && z < f[3] + R) return true;
    return false;
  }

  // ---------- loop ----------
  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    this.timer.update();
    const frameDt = Math.min(this.timer.getDelta(), 0.1);
    const t = this.timer.getElapsed();
    const paused = !this.isTouch && document.pointerLockElement !== this.renderer.domElement;
    if (!paused) {
      // Fixed simulation steps keep held-key walking smooth at any render frame rate.
      this.accumulator = Math.min(this.accumulator + frameDt, PROLOGUE_STEP * 6);
      while (this.accumulator >= PROLOGUE_STEP) {
        this.update(PROLOGUE_STEP);
        this.accumulator -= PROLOGUE_STEP;
      }
    } else this.accumulator = 0;
    this.updateFx(frameDt, t);
    this.renderer.render(this.scene, this.camera);
    if (!this.container.dataset["sceneReady"]) this.container.dataset["sceneReady"] = "1";
    this.hudT -= frameDt;
    if (this.hudT <= 0) {
      this.hudT = 0.1;
      const note = this.reading ? { title: this.reading.title, body: this.reading.body } : null;
      this.cb.onHud({ prompt: note ? "" : this.focus?.label() ?? "", objective: this.objective(), subtitle: note ? "" : this.subtitle, paused: paused && !this.finished, flashlight: this.flashOn, fade: this.fade, note });
    }
  };

  private update(dt: number) {
    const seated = this.departure === "car" || this.departure === "starting";
    if (!seated && (this.touch.lookX || this.touch.lookY)) { this.look(this.touch.lookX, this.touch.lookY, 0.006); this.touch.lookX = this.touch.lookY = 0; }
    const k = this.keys;
    const rawX = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0) + this.touch.mx;
    const rawY = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0) + this.touch.my;
    const input = normalizeMovement({ right: rawX, forward: rawY });
    const mx = input.right, my = input.forward;
    const len = Math.hypot(mx, my);
    const sprint = k.has("ShiftLeft") || k.has("ShiftRight") || this.touch.sprint;
    const sp = movementDistance(dt, sprint);
    const oldX = this.pos.x, oldZ = this.pos.z;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    const nx = this.pos.x + (fx * my + rx * mx) * sp, nz = this.pos.z + (fz * my + rz * mx) * sp;
    if (!this.blocked(nx, this.pos.z)) this.pos.x = nx;
    if (!this.blocked(this.pos.x, nz)) this.pos.z = nz;
    // Each crossing wraps to the adjacent identical landing and changes exactly one floor.
    if (!seated && this.pos.z > 9.3 && this.pos.x < 16) {
      if (oldX >= 11.2 && this.pos.x < 11.2) {
        if (!this.changeFloor(-1)) this.pos.x = oldX;
      } else if (oldX < 11.2 && this.pos.x >= 11.2) {
        if (!this.changeFloor(1)) this.pos.x = oldX;
      }
    }
    if (this.departure === "apartment" && this.done.has("door") && this.pos.x > 9.35) {
      this.advanceDeparture("leaveApartment"); this.caption("В подъезде тихо. Нужно спуститься на первый этаж.", "The stairwell is quiet. I need to get to the first floor.");
    }
    if (this.departure === "landing" && this.pos.z > 8.3) {
      this.advanceDeparture("enterStairs"); this.caption("Седьмой этаж. Пешком… Только бы свет не погас.", "Seventh floor. On foot… just don't let the lights go out.");
    }
    const moved = Math.hypot(this.pos.x - oldX, this.pos.z - oldZ) > 0.0001;
    const moving = len > 0.1 && !seated && moved;
    if (moving) {
      this.stepT -= dt * (sprint ? 1.5 : 1);
      if (this.stepT <= 0) { this.stepT = 0.5; this.sfx.step(0.5); if (Math.random() < 0.25) this.sfx.creak(0.06); }
    }
    const bob = moving ? Math.sin(performance.now() * 0.009) * 0.025 : 0;
    if (seated) this.camera.position.copy(this.seatEye);
    else {
      const gy = this.groundY(this.pos.x, this.pos.z);
      this.pos.y = THREE.MathUtils.damp(this.pos.y, gy, 18, dt);
      if (Math.abs(this.pos.y - gy) > 0.5) this.pos.y = gy;
      this.camera.position.set(this.pos.x, this.pos.y + EYE + bob, this.pos.z);
    }
    this.camera.rotation.set(this.pitch, this.yaw, 0);

    // focus the nearest usable object in front of the camera
    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);
    this.focus = null;
    let best = 0.86;
    if (this.reading && this.pos.distanceTo(this.reading.at) > 1.1) this.reading = null;
    const zone = this.zone();
    for (const s of this.spots) {
      if (!s.ok() || (this.departure !== "apartment" && ["tv", "phone", "photo", "window", "keys", "door"].includes(s.id))) continue;
      if (s.zone && s.zone !== zone) continue;
      const to = s.pos.clone().sub(this.camera.position);
      const d = to.length();
      if (d > 2.2) continue;
      const dot = to.normalize().dot(fwd);
      if (dot > best) { best = dot; this.focus = s; }
    }
  }

  /** Ignition, a gentle pull-away and an exterior chase shot, then fade into the pictured intro. */
  private updateDrive(t: number) {
    if (this.departure === "done") { this.fade = 1; return; }
    if (this.departure !== "starting") { this.fade = 0; this.driveDistance = 0; return; }
    const time = this.departureTime;
    const smooth = (a: number, b: number, v: number) => {
      const x = THREE.MathUtils.clamp((v - a) / (b - a), 0, 1);
      return x * x * (3 - 2 * x);
    };
    const driveT = Math.max(0, time - 1.65);
    const accelT = Math.min(driveT, 2);
    this.driveDistance = 1.5 * accelT * accelT + Math.max(0, driveT - 2) * 6;
    const speed = Math.min(6, driveT * 3);
    const car = this.car;
    car.group.position.z = 7.2 - this.driveDistance;
    car.group.position.x = 21.2 + smooth(0, 4, driveT) * 0.55;
    car.wheels.forEach((wheel) => { wheel.rotation.x = -this.driveDistance / 0.33; });
    if (this.engine) this.engine.frequency.setTargetAtTime((time < 1.65 ? 27 + Math.sin(t * 32) * 7 : 52) + speed * 5, this.sfx.ctx.currentTime, 0.1);

    // Begin in the driver's seat, then pull outside to show the car actually leaving.
    const seat = car.group.localToWorld(car.driverEye.clone());
    seat.y += Math.sin(t * 35) * 0.003 * (1 - smooth(1.2, 2.5, time));
    const chase = new THREE.Vector3(car.group.position.x + 4.3, 2.35, car.group.position.z + 6.4);
    this.camera.position.lerpVectors(seat, chase, smooth(1.15, 2.65, time));
    this.camera.lookAt(car.group.position.x, 0.72, car.group.position.z - 2.1);
    this.streetRain.uniforms.uCenter.value.set(car.group.position.x, 2, car.group.position.z - 3);
    this.fade = smooth(8.05, 9.25, time);
    if (time > 1.8 && !this.done.has("driveAway")) {
      this.done.add("driveAway");
      this.caption("Машина тронулась. Седьмой этаж остался позади.", "The car pulls away. The seventh floor is behind me.");
    }
    if (time > 6.2 && !this.done.has("driveRoad")) {
      this.done.add("driveRoad");
      this.caption("Двор исчез в зеркале. Теперь только дорога и дождь.", "The courtyard vanishes behind me. Only the road and the rain remain.");
    }
    if (time > 9.4) this.advanceDeparture("engineReady");
  }

  private updateFx(dt: number, t: number) {
    const active = this.isTouch || document.pointerLockElement === this.renderer.domElement;
    if (active) this.departureTime += dt;
    this.stairDoorOpen = THREE.MathUtils.damp(this.stairDoorOpen, this.hallOpen() ? 1 : 0, 4, dt);
    this.stairDoor.rotation.y = this.stairDoorOpen * 1.5;
    this.stairLight.intensity = (this.isTouch ? 2.4 : 4) * (Math.random() < 0.015 ? 0.25 : 1);
    this.updateDrive(t);
    if (this.transition) {
      const tr = this.transition; tr.t += dt;
      const k = tr.t < 0.7 ? THREE.MathUtils.smoothstep(tr.t, 0.15, 0.65) : 1 - THREE.MathUtils.smoothstep(tr.t, 0.95, 1.5);
      this.fade = Math.max(this.fade, k);
      if (!tr.fired && tr.t >= 0.7) { tr.fired = true; tr.mid(); }
      if (tr.t >= 1.5) this.transition = null;
    }
    const fl = this.lightning.update(dt);
    this.storm.intensity = fl * 4;
    this.stairWin.color.setRGB(0.19 + fl * 0.7, 0.25 + fl * 0.75, 0.31 + fl * 0.8);
    if (this.street.visible) { this.streetRain.uniforms.uTime.value = t; this.streetRain.uniforms.uFlash.value = fl * 0.4; }
    this.updateExterior(dt, t, fl);
    this.updateStairwell(dt, t);
    this.rain.uniforms.uTime.value = t;
    this.rain.uniforms.uFlash.value = fl * 0.4;
    this.drops.offset.y = (t * 0.015) % 1;
    // lamps; blackout after the call
    if (this.blackout > 0) this.blackout -= dt;
    const out = this.blackout > 0 && this.blackout < 1.9 ? (Math.random() < 0.15 ? 0.4 : 0) : this.blackout > 0 ? 0.2 : 1;
    this.lamps.forEach((l, i) => {
      let k = out;
      if (i === 2 && Math.random() < 0.03) k *= 0.2; // dying kitchen bulb
      l.light.intensity = l.base * k;
      l.bulb.emissiveIntensity = 2 * k;
    });
    // TV
    if (this.tvOn) {
      const g = (this.tvScreen.image as HTMLCanvasElement).getContext("2d")!;
      g.fillStyle = "#1a2a48"; g.fillRect(0, 0, 256, 192);
      g.fillStyle = "#2a3e68"; g.fillRect(0, 130, 256, 62);
      g.fillStyle = "#c9b089"; g.beginPath(); g.ellipse(128, 92, 30, 36, 0, 0, 7); g.fill();
      g.fillStyle = "#222"; g.fillRect(88, 120, 80, 50);
      g.fillStyle = "#fff"; g.font = "bold 16px sans-serif"; g.fillText(this.l("НОВОСТИ · 23:47", "NEWS · 11:47 PM"), 10, 150);
      g.font = "12px sans-serif"; g.fillText(this.l("ПАРК «ВЕСЁЛЫЕ ГОРКИ»", "HAPPY HILLS PARK"), 10, 170);
      for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`; g.fillRect(Math.random() * 256, Math.random() * 192, 2, 1); }
      g.fillStyle = "rgba(0,0,0,0.15)"; for (let y = (t * 60) % 4; y < 192; y += 4) g.fillRect(0, y, 256, 1);
      this.tvScreen.needsUpdate = true;
      this.tvLight.intensity = 2.2 * (0.8 + Math.random() * 0.3);
    } else if (this.tvLight.intensity > 0) {
      const g = (this.tvScreen.image as HTMLCanvasElement).getContext("2d")!;
      g.fillStyle = "#0a0c0c"; g.fillRect(0, 0, 256, 192); this.tvScreen.needsUpdate = true; this.tvLight.intensity = 0;
    }
    this.led.color.set(!this.done.has("phone") && Math.sin(t * 6) > 0 ? "#ff2010" : "#300404");
    this.flash.intensity = this.flashOn ? 25 : 0;
    if (this.done.has("door")) {
      const want = this.departure === "apartment" || this.departure === "landing" ? 1 : 0;
      this.doorOpen = THREE.MathUtils.damp(this.doorOpen, want, 2.5, dt);
      this.door.rotation.y = -this.doorOpen * 1.6;
    }
  }

  private updateExterior(dt: number, t: number, fl: number) {
    const w = this.windNow = updateWind(t);
    const d = this.departure;
    const outside = d === "apartment" || d === "landing";
    this.yard.group.visible = outside && !this.street.visible;
    this.sky.mesh.visible = this.yard.group.visible || this.street.visible;
    this.sky.mesh.position.copy(this.camera.position);
    this.sky.uniforms.uTime.value = t; this.sky.uniforms.uFlash.value = fl;
    if (this.yard.group.visible) {
      this.yard.update(dt, { flash: fl, wind: w, t });
      this.yardRain.uniforms.uTime.value = t; this.yardRain.uniforms.uFlash.value = fl * 0.4;
    }
    if (this.street.visible) {
      this.streetLife.update(dt, { flash: fl, wind: w, t, player: this.pos, allowTraffic: d === "street" });
      if (this.badLamp) {
        this.badLampT -= dt;
        if (this.badLampT <= 0) this.badLampT = Math.random() < 0.12 ? 0.6 + Math.random() * 0.8 : 0.08;
        const on = this.badLampT > 0.5 ? Math.random() < 0.4 : true;
        if (this.badLamp.light) this.badLamp.light.intensity = on ? this.badLamp.base : 0;
        this.badLamp.lens.color.set(on ? "#ffe6b8" : "#3a3020"); this.badLamp.cone.visible = on;
      }
    }
    // weather sounds: muffled indoors, full force in the street
    const street = this.street.visible;
    this.sfx.setWind((street ? 0.11 : d === "apartment" ? 0.025 : 0.012) * w);
    this.sfx.setRain(street ? 0.34 : d === "apartment" ? 0.22 : 0.1);
    // cats: tail sways, head follows the player when close
    for (const { cat, yaw } of this.cats) {
      if (!cat.group.visible || (cat.group.parent === this.street && !street)) continue;
      cat.tail.rotation.y = Math.sin(t * 1.4 + yaw) * 0.45;
      cat.tip.rotation.x = Math.sin(t * 2.3 + yaw) * 0.35;
      const wp = cat.group.getWorldPosition(new THREE.Vector3());
      const dx = this.pos.x - wp.x, dz = this.pos.z - wp.z;
      const look = Math.hypot(dx, dz) < 3.5 ? THREE.MathUtils.clamp(THREE.MathUtils.euclideanModulo(Math.atan2(dx, dz) - yaw + Math.PI, Math.PI * 2) - Math.PI, -1, 1) : Math.sin(t * 0.4) * 0.4;
      cat.head.rotation.y = THREE.MathUtils.damp(cat.head.rotation.y, look, 3, dt);
    }
  }

  private updateStairwell(dt: number, t: number) {
    // landing lamp: switch + occasional flicker with a buzz
    if (this.hallFlicker > 0) this.hallFlicker -= dt;
    else if (Math.random() < dt * 0.06) { this.hallFlicker = 0.25 + Math.random() * 0.5; if (this.zone() === "hall") this.sfx.hum(0.03); }
    const flick = this.hallFlicker > 0 ? (Math.random() < 0.5 ? 0.12 : 1) : 1;
    const k = this.hallLightOn ? flick : 0;
    this.hallLight.intensity = (this.isTouch ? 2.5 : 5) * k;
    this.hallLamp.color.setRGB(0.12 + 0.83 * k, 0.12 + 0.85 * k, 0.11 + 0.78 * k);
    // lift button glow
    if (this.liftBtnT > 0) this.liftBtnT -= dt;
    this.liftBtn.color.set(this.liftBtnT > 0 && (this.liftBtnT > 0.9 || Math.sin(t * 30) > 0) ? "#ff3a20" : "#3a0c08");
    // mailbox door, fuse-box door and meters
    this.mailOpen = THREE.MathUtils.damp(this.mailOpen, this.done.has("mail") ? 1 : 0, 6, dt);
    this.mailDoor.rotation.y = -this.mailOpen * 1.7;
    this.panelAngle = THREE.MathUtils.damp(this.panelAngle, this.panelOpen ? 1 : 0, 5, dt);
    this.panelDoor.rotation.y = -this.panelAngle * 1.9;
    this.meterDiscs.forEach((m, i) => { m.rotation.y += dt * (2 + i * 1.3); });
    // rubbish chute hatches (one per storey, they move together)
    if (this.chuteT > 0) this.chuteT -= dt;
    this.chuteAngle = THREE.MathUtils.damp(this.chuteAngle, this.chuteT > 0.7 ? 1 : 0, 6, dt);
    for (const h of this.chuteHatches) h.rotation.x = this.chuteAngle * 0.95;
    // the pram rocks by itself unless you stop it
    if (this.strollerStop > 0) this.strollerStop -= dt;
    this.strollerAmp = THREE.MathUtils.damp(this.strollerAmp, this.strollerStop > 0 ? 0 : 1, 2, dt);
    this.strollerBody.rotation.x = Math.sin(t * 2.3) * 0.07 * this.strollerAmp;
    if (this.floor === 1 && this.strollerAmp > 0.6 && this.zone() === "hall" && Math.random() < dt * 0.25) this.sfx.creak(0.015);
    // street door: leaves swing open into the vestibule while leaving
    this.exitOpen = THREE.MathUtils.damp(this.exitOpen, this.exitOpening ? 1 : 0, 4, dt);
    this.exitDoors.forEach((p, i) => { p.rotation.y = (i === 0 ? 1 : -1) * this.exitOpen * 1.25; });
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.engine?.stop(); this.engine = null;
    this.voice?.pause();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("blur", this.onBlur);
    if (document.pointerLockElement) document.exitPointerLock();
    this.sfx.dispose();
    this.timer.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mt of mats) { (mt as THREE.MeshStandardMaterial).map?.dispose(); mt.dispose(); }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
