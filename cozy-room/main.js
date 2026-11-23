// Cozy Game Room · 3D 空间漫游
// 布局对照参考图：左墙 = 百叶窗 + 窗下书柜 + 冰箱 + 沙发 + 海报；后墙 = L 型书桌双屏 + 电视柜；中间 Switch 地毯；吊顶暖色灯带
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {
  rand, rr, pick, woodTexture, noiseTexture, cityTexture, monitorLeftTexture, monitorRightTexture,
  createTVTexture, posterTexture, rugTexture, fridgeTexture, createClockTexture,
} from './textures.js';

// ====================== 渲染器 / 场景 ======================
const R = { x0: -3.2, x1: 3.2, z0: -2.8, z1: 2.8, h: 2.7 };
const H = R.h;
const TOUCH = matchMedia('(pointer: coarse)').matches;   // 手机 / 平板
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, TOUCH ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);
RectAreaLightUniformsLib.init();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07080b);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.03, 60);
camera.position.set(2.85, 2.4, 2.55);
camera.lookAt(-1.2, 0.6, -1.0);

const colliders = [];   // 第一人称碰撞（只看 xz）

// ====================== 材质 ======================
const std = (o) => new THREE.MeshStandardMaterial(o);
const M = {
  wall: std({ color: 0xd9c2a2, roughness: 0.92 }),
  ceil: std({ color: 0xcfb796, roughness: 0.95 }),
  carpet: std({ map: noiseTexture('#3b3835', 26, [9, 8]), roughness: 1 }),
  wood: std({ map: woodTexture('#7d5030'), roughness: 0.55 }),
  woodDark: std({ map: woodTexture('#4b2f1b'), roughness: 0.6 }),
  black: std({ color: 0x141414, roughness: 0.45, metalness: 0.2 }),
  metal: std({ color: 0x2c2c2c, roughness: 0.35, metalness: 0.8 }),
  chrome: std({ color: 0xbfbfbf, roughness: 0.2, metalness: 1 }),
  fabric: std({ color: 0xe4d4b8, roughness: 1 }),
  fabric2: std({ color: 0xeee2ca, roughness: 1 }),
  white: std({ color: 0xeeeeee, roughness: 0.4 }),
  ceramic: std({ color: 0xebe5da, roughness: 0.35 }),
  soil: std({ color: 0x2a1d14, roughness: 1 }),
  green: std({ color: 0x2f6e35, roughness: 0.65, side: THREE.DoubleSide }),
  green2: std({ color: 0x3f8a3f, roughness: 0.65, side: THREE.DoubleSide }),
  door: std({ color: 0xcbb699, roughness: 0.6 }),
  led: std({ color: 0x000000, emissive: 0xff9a3c, emissiveIntensity: 6 }),
  ledSoft: std({ color: 0x000000, emissive: 0xffb257, emissiveIntensity: 3 }),
  down: std({ color: 0x000000, emissive: 0xfff0d8, emissiveIntensity: 2.5 }),
  rgb: std({ color: 0x000000, emissive: 0xff00ff, emissiveIntensity: 3 }),
  deskMat: std({ color: 0x1b1d20, roughness: 0.95 }),
};

// ====================== 工具函数 ======================
function B(mat, x0, x1, y0, y1, z0, z1, { parent = scene, cast = true, receive = true, collide = false, round = 0 } = {}) {
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  const geo = round > 0
    ? new RoundedBoxGeometry(w, h, d, 3, Math.min(round, Math.min(w, h, d) / 2 - 0.0005))
    : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(geo, mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.castShadow = cast; m.receiveShadow = receive;
  parent.add(m);
  if (collide) addCollider(x0, x1, z0, z1);
  return m;
}
const addCollider = (x0, x1, z0, z1) => colliders.push({ x0, x1, z0, z1 });

const leafSmallGeo = (() => {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(0.04, 0.08, 0, 0.17); s.quadraticCurveTo(-0.04, 0.08, 0, 0);
  return new THREE.ShapeGeometry(s, 6);
})();

function mesh(geo, mat, x, y, z, { parent = scene, cast = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true;
  parent.add(m); return m;
}

function rectLight(color, intensity, w, h, pos, target) {
  const l = new THREE.RectAreaLight(color, intensity, w, h);
  l.position.set(...pos); l.lookAt(...target);
  scene.add(l); return l;
}

function pointLight(color, intensity, distance, pos) {
  const l = new THREE.PointLight(color, intensity, distance, 2);
  l.position.set(...pos); scene.add(l); return l;
}

// 挂画：rotY = 0 后墙 / PI/2 左墙 / PI 前墙 / -PI/2 右墙
function picture(tex, w, h, pos, rotY, { frame = 0x111111, border = 0.025, depth = 0.025 } = {}) {
  const g = new THREE.Group();
  const fr = new THREE.Mesh(new THREE.BoxGeometry(w + border * 2, h + border * 2, depth), std({ color: frame, roughness: 0.5 }));
  fr.castShadow = true; g.add(fr);
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std({ map: tex, roughness: 0.55 }));
  pic.position.z = depth / 2 + 0.001; g.add(pic);
  g.position.set(...pos); g.rotation.y = rotY; scene.add(g);
  return g;
}

// ====================== 建筑：地面 / 墙 / 吊顶 ======================
{
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(R.x1 - R.x0, R.z1 - R.z0), M.carpet);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(R.x1 - R.x0, R.z1 - R.z0), M.ceil);
  ceil.rotation.x = Math.PI / 2; ceil.position.y = H; scene.add(ceil);

  const o = { cast: false };
  B(M.wall, -3.3, 3.3, 0, H, R.z0 - 0.1, R.z0, o);       // 后墙
  B(M.wall, R.x1, R.x1 + 0.1, 0, H, -2.9, 2.9, o);       // 右墙
  B(M.wall, -3.3, 3.3, 0, H, R.z1, R.z1 + 0.1, o);       // 前墙
}

// 左墙带窗洞
const WZ0 = -2.5, WZ1 = -0.45, WY0 = 0.88, WY1 = 2.36;
{
  const o = { cast: false };
  B(M.wall, R.x0 - 0.1, R.x0, 0, WY0, -2.9, 2.9, o);
  B(M.wall, R.x0 - 0.1, R.x0, WY1, H, -2.9, 2.9, o);
  B(M.wall, R.x0 - 0.1, R.x0, WY0, WY1, -2.9, WZ0, o);
  B(M.wall, R.x0 - 0.1, R.x0, WY0, WY1, WZ1, 2.9, o);
  // 窗洞内壁
  B(M.wall, -3.55, R.x0 - 0.1, WY0 - 0.05, WY0, WZ0, WZ1, o);
  B(M.wall, -3.55, R.x0 - 0.1, WY1, WY1 + 0.05, WZ0, WZ1, o);
  B(M.wall, -3.55, R.x0 - 0.1, WY0, WY1, WZ0 - 0.05, WZ0, o);
  B(M.wall, -3.55, R.x0 - 0.1, WY0, WY1, WZ1, WZ1 + 0.05, o);
  // 窗框
  B(M.black, -3.5, -3.46, WY0, WY1, (WZ0 + WZ1) / 2 - 0.02, (WZ0 + WZ1) / 2 + 0.02, o);
  B(M.black, -3.5, -3.46, WY0, WY0 + 0.04, WZ0, WZ1, o);
  B(M.black, -3.5, -3.46, WY1 - 0.04, WY1, WZ0, WZ1, o);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(WZ1 - WZ0, WY1 - WY0),
    new THREE.MeshStandardMaterial({ color: 0x8899aa, transparent: true, opacity: 0.08, roughness: 0.05, metalness: 0.5 }));
  glass.position.set(-3.47, (WY0 + WY1) / 2, (WZ0 + WZ1) / 2); glass.rotation.y = Math.PI / 2; scene.add(glass);
  // 窗外城市
  const city = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: cityTexture() }));
  city.position.set(-7.5, 1.3, -1.4); city.rotation.y = Math.PI / 2; scene.add(city);
  // 窗台
  B(M.wood, R.x0 - 0.12, R.x0 + 0.04, WY0 - 0.03, WY0, WZ0 - 0.04, WZ1 + 0.04);

  // 百叶窗
  const slatGeo = new THREE.BoxGeometry(0.004, 0.05, WZ1 - WZ0 - 0.04);
  const slatMat = std({ color: 0x1e1f22, roughness: 0.5, metalness: 0.15 });
  const step = 0.042, n = Math.floor((WY1 - WY0 - 0.1) / step);
  const slats = new THREE.InstancedMesh(slatGeo, slatMat, n);
  const d = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    d.position.set(R.x0 - 0.035, WY0 + 0.05 + i * step, (WZ0 + WZ1) / 2);
    d.rotation.set(0, 0, 1.05); d.updateMatrix(); slats.setMatrixAt(i, d.matrix);
  }
  scene.add(slats);
  B(M.black, R.x0 - 0.07, R.x0 + 0.01, WY1 - 0.07, WY1 - 0.01, WZ0 + 0.01, WZ1 - 0.01, o);
  B(M.black, R.x0 - 0.06, R.x0, WY0 + 0.02, WY0 + 0.04, WZ0 + 0.02, WZ1 - 0.02, o);
  for (const z of [WZ0 + 0.4, WZ1 - 0.4]) B(M.black, R.x0 - 0.03, R.x0 - 0.026, WY0 + 0.04, WY1 - 0.07, z, z + 0.004, o);
}

// 踢脚线
{
  const o = { cast: false };
  B(M.woodDark, R.x0, R.x1, 0, 0.08, R.z0, R.z0 + 0.015, o);
  B(M.woodDark, R.x0, R.x1, 0, 0.08, R.z1 - 0.015, R.z1, o);
  B(M.woodDark, R.x0, R.x0 + 0.015, 0, 0.08, R.z0, R.z1, o);
  B(M.woodDark, R.x1 - 0.015, R.x1, 0, 0.08, R.z0, R.z1, o);
}

// 吊顶灯槽 + 暖光灯带
{
  const o = { cast: false }, dpt = 0.14, y0 = H - 0.25, y1 = H - 0.21;
  B(M.wall, R.x0, R.x1, y0, y1, R.z0, R.z0 + dpt, o);
  B(M.wall, R.x0, R.x1, y0, y1, R.z1 - dpt, R.z1, o);
  B(M.wall, R.x0, R.x0 + dpt, y0, y1, R.z0, R.z1, o);
  B(M.wall, R.x1 - dpt, R.x1, y0, y1, R.z0, R.z1, o);
  const s = 0.014;
  B(M.led, R.x0 + dpt, R.x1 - dpt, y1, y1 + s, R.z0 + dpt - s, R.z0 + dpt, o);
  B(M.led, R.x0 + dpt, R.x1 - dpt, y1, y1 + s, R.z1 - dpt, R.z1 - dpt + s, o);
  B(M.led, R.x0 + dpt - s, R.x0 + dpt, y1, y1 + s, R.z0 + dpt, R.z1 - dpt, o);
  B(M.led, R.x1 - dpt, R.x1 - dpt + s, y1, y1 + s, R.z0 + dpt, R.z1 - dpt, o);
  // 灯带照向墙面（洗墙效果）
  const c = 0xff9540, I = 3.2, y = H - 0.27;
  rectLight(c, I, 6.2, 0.12, [0, y, R.z0 + 0.16], [0, 0, R.z0 - 0.35]);
  rectLight(c, I, 6.2, 0.12, [0, y, R.z1 - 0.16], [0, 0, R.z1 + 0.35]);
  rectLight(c, I, 5.4, 0.12, [R.x0 + 0.16, y, 0], [R.x0 - 0.35, 0, 0]);
  rectLight(c, I, 5.4, 0.12, [R.x1 - 0.16, y, 0], [R.x1 + 0.35, 0, 0]);
  // 灯带也照亮吊顶
  rectLight(0xffa050, 0.3, 6.0, 5.2, [0, H - 0.2, 0], [0, H + 1, 0]);
}

// 筒灯 + 射灯（主灯）
const spots = [];
{
  const discGeo = new THREE.CircleGeometry(0.055, 32), ringGeo = new THREE.RingGeometry(0.055, 0.075, 32);
  const ringMat = std({ color: 0xdddddd, roughness: 0.3, metalness: 0.6, side: THREE.DoubleSide });
  const list = [[-1.6, -1.7, -1.6, -2.4, true], [0.3, -1.8, 0.2, -2.6, false], [-1.2, 1.4, -1.2, 1.5, true], [1.4, 0.8, 1.6, 0.2, false], [2.2, -1.5, 2.25, -2.6, false]];
  for (const [x, z, tx, tz, shadow] of list) {
    const disc = new THREE.Mesh(discGeo, M.down); disc.rotation.x = Math.PI / 2; disc.position.set(x, H - 0.002, z); scene.add(disc);
    const ring = new THREE.Mesh(ringGeo, ringMat); ring.rotation.x = Math.PI / 2; ring.position.set(x, H - 0.003, z); scene.add(ring);
    const s = new THREE.SpotLight(0xffd6a8, 16, 0, 0.7, 0.75, 2);
    s.position.set(x, H - 0.03, z); s.target.position.set(tx, 0, tz);
    if (shadow) {
      s.castShadow = true; s.shadow.mapSize.set(1024, 1024); s.shadow.bias = -0.0004; s.shadow.normalBias = 0.02;
      s.shadow.camera.near = 0.2; s.shadow.camera.far = 6;
    }
    scene.add(s, s.target); spots.push(s);
  }
}
const hemi = new THREE.HemisphereLight(0xffd9b0, 0x3a2c20, 0.45);
scene.add(hemi);

// ====================== 家具：L 型书桌 + 置物架 ======================
const DZ0 = R.z0, DZ1 = R.z0 + 0.66, DY = 0.75;
{
  B(M.wood, R.x0, 1.0, DY - 0.04, DY, DZ0, DZ1, { collide: true });
  B(M.woodDark, 0.96, 1.0, 0, DY - 0.04, DZ0 + 0.02, DZ1 - 0.02);
  B(M.woodDark, -1.4, -1.36, 0, DY - 0.04, DZ0 + 0.02, DZ1 - 0.02);
  B(M.woodDark, R.x0 + 0.02, R.x0 + 0.06, 0, DY - 0.04, DZ0 + 0.02, DZ1 - 0.02);
  B(M.woodDark, R.x0, 1.0, 0.35, DY - 0.04, DZ0, DZ0 + 0.02, { cast: false });
  // 置物架
  B(M.woodDark, R.x0, 1.0, DY, 1.58, DZ0, DZ0 + 0.02, { cast: false });
  B(M.wood, R.x0, 1.0, 1.54, 1.58, DZ0, DZ0 + 0.27);
  B(M.wood, 0.96, 1.0, DY, 1.54, DZ0, DZ0 + 0.27);
  B(M.ledSoft, R.x0 + 0.05, 0.95, 1.528, 1.54, DZ0 + 0.235, DZ0 + 0.25, { cast: false });
  rectLight(0xffb060, 3.5, 4.0, 0.05, [-1.1, 1.525, DZ0 + 0.2], [-1.1, 0, DZ0 + 0.45]);
}

// 显示器
function monitor(x, z, tex, rotY = 0) {
  const g = new THREE.Group();
  B(M.black, -0.12, 0.12, 0, 0.012, -0.09, 0.09, { parent: g });
  B(M.metal, -0.022, 0.022, 0.012, 0.22, -0.035, -0.005, { parent: g });
  B(M.black, -0.33, 0.33, 0.12, 0.5, -0.005, 0.025, { parent: g, round: 0.008 });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.355), new THREE.MeshBasicMaterial({ map: tex }));
  scr.position.set(0, 0.31, 0.0262); g.add(scr);
  g.position.set(x, DY, z); g.rotation.y = rotY; scene.add(g);
  return g;
}
{
  const mons = [[-2.15, monitorLeftTexture(), 0x9aa6b0], [-0.6, monitorRightTexture(), 0xff6a3a]];
  for (const [x, tex, glow] of mons) {
    monitor(x, DZ0 + 0.2, tex);
    rectLight(glow, 1.6, 0.6, 0.34, [x, DY + 0.31, DZ0 + 0.24], [x, DY + 0.1, DZ0 + 2.5]);
    B(M.deskMat, x - 0.42, x + 0.42, DY, DY + 0.003, DZ0 + 0.36, DZ0 + 0.63, { cast: false });
    B(M.black, x - 0.22, x + 0.2, DY + 0.003, DY + 0.025, DZ0 + 0.42, DZ0 + 0.55, { round: 0.006 });
    B(M.rgb, x - 0.215, x + 0.195, DY + 0.003, DY + 0.006, DZ0 + 0.555, DZ0 + 0.558, { cast: false });
    B(M.black, x + 0.28, x + 0.34, DY + 0.003, DY + 0.03, DZ0 + 0.44, DZ0 + 0.54, { round: 0.013 });
  }
  // 音箱
  for (const x of [-2.62, -1.68, -1.07, -0.13]) B(M.black, x - 0.05, x + 0.05, DY, DY + 0.18, DZ0 + 0.1, DZ0 + 0.22, { round: 0.01 });
}

// 置物架上的小物件 / 台灯 / 时钟
const clockTex = createClockTexture();
{
  const S = 1.58;
  // 台灯
  const lx = R.x0 + 0.22, lz = DZ0 + 0.14;
  mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.02, 24), M.black, lx, S + 0.01, lz);
  mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 12), M.metal, lx, S + 0.1, lz);
  const shade = mesh(new THREE.CylinderGeometry(0.055, 0.08, 0.12, 32, 1, true),
    std({ color: 0xf5e0c0, emissive: 0xffb050, emissiveIntensity: 0.9, side: THREE.DoubleSide, roughness: 0.8 }), lx, S + 0.2, lz, { cast: false });
  shade.receiveShadow = false;
  pointLight(0xffa64a, 1.2, 3, [lx, S + 0.18, lz + 0.05]);
  // 时钟
  B(M.black, -1.0, -0.8, S, S + 0.09, DZ0 + 0.06, DZ0 + 0.12, { round: 0.008 });
  const cf = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.075), new THREE.MeshBasicMaterial({ map: clockTex }));
  cf.position.set(-0.9, S + 0.045, DZ0 + 0.1215); scene.add(cf);
  // 粉色小手办
  const pink = std({ color: 0xff8fb1, roughness: 0.5 });
  mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.08, 16), pink, -0.35, S + 0.04, DZ0 + 0.13);
  mesh(new THREE.SphereGeometry(0.035, 20, 16), pink, -0.35, S + 0.115, DZ0 + 0.13);
  // 小相框
  picture(posterTexture('cute'), 0.1, 0.13, [-1.55, S + 0.09, DZ0 + 0.09], 0.15, { frame: 0xf2ece0, border: 0.012, depth: 0.015 });
  // 书和盒子
  ['#c0392b', '#2c3e50', '#d4ac0d', '#7f8c8d'].forEach((c, i) => B(std({ color: c, roughness: 0.7 }), 0.45 + i * 0.045, 0.485 + i * 0.045, S, S + 0.2 - i * 0.01, DZ0 + 0.04, DZ0 + 0.21));
  B(std({ color: 0x3a6ea5, roughness: 0.6 }), -2.0, -1.84, S, S + 0.07, DZ0 + 0.05, DZ0 + 0.18);
  B(std({ color: 0xe8e2d4, roughness: 0.6 }), -2.6, -2.48, S, S + 0.12, DZ0 + 0.06, DZ0 + 0.16);
  smallPlant(0.8, S, DZ0 + 0.13, 0.8);
}

// 墙上海报（后墙）
picture(posterTexture('headphones'), 0.62, 0.42, [-2.0, 2.05, R.z0 + 0.013], 0, { frame: 0x1a1a1a });
picture(posterTexture('cute'), 0.28, 0.36, [-1.18, 2.0, R.z0 + 0.013], 0, { frame: 0xf0ebe0 });
picture(posterTexture('vinyl'), 0.42, 0.58, [-0.45, 2.02, R.z0 + 0.013], 0, { frame: 0x050505 });

// 电竞椅
function chair(x, z, rotY, color) {
  const g = new THREE.Group();
  const fab = std({ color, roughness: 0.85 });
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.045), M.metal);
    leg.position.set(Math.cos(a) * 0.15, 0.07, Math.sin(a) * 0.15); leg.rotation.y = -a; leg.castShadow = true; g.add(leg);
    mesh(new THREE.SphereGeometry(0.028, 12, 8), M.black, Math.cos(a) * 0.29, 0.028, Math.sin(a) * 0.29, { parent: g });
  }
  mesh(new THREE.CylinderGeometry(0.025, 0.032, 0.32, 16), M.chrome, 0, 0.24, 0, { parent: g });
  B(M.black, -0.12, 0.12, 0.36, 0.4, -0.1, 0.1, { parent: g });
  B(fab, -0.25, 0.25, 0.4, 0.48, -0.24, 0.24, { parent: g, round: 0.035 });
  const back = B(fab, -0.23, 0.23, 0.56, 1.18, 0.21, 0.28, { parent: g, round: 0.03 });
  back.rotation.x = 0.12; back.position.z += 0.04;
  B(fab, -0.13, 0.13, 1.12, 1.24, 0.25, 0.31, { parent: g, round: 0.03 }).rotation.x = 0.12;
  B(M.black, -0.025, 0.025, 0.42, 0.62, 0.22, 0.25, { parent: g });
  for (const s of [-1, 1]) {
    B(M.black, s * 0.24 - 0.015, s * 0.24 + 0.015, 0.46, 0.64, -0.02, 0.02, { parent: g });
    B(M.black, s * 0.24 - 0.035, s * 0.24 + 0.035, 0.64, 0.67, -0.13, 0.12, { parent: g, round: 0.012 });
  }
  g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
  addCollider(x - 0.3, x + 0.3, z - 0.3, z + 0.3);
  return g;
}
chair(-2.15, -1.82, 0.18, 0x202124);
chair(-0.62, -1.78, -0.22, 0x3b414b);

// 主机（RGB 风扇）
{
  B(M.black, 0.6, 0.84, 0, 0.5, DZ0 + 0.08, DZ0 + 0.55, { round: 0.012 });
  const torus = new THREE.TorusGeometry(0.065, 0.007, 8, 40);
  for (const y of [0.36, 0.17]) mesh(torus, M.rgb, 0.72, y, DZ0 + 0.553, { cast: false });
  B(M.rgb, 0.605, 0.835, 0.488, 0.494, DZ0 + 0.549, DZ0 + 0.553, { cast: false });
}

// ====================== 电视柜 + 电视 ======================
const tvTex = createTVTexture();
{
  const X0 = 1.35, X1 = 3.15, Z0 = R.z0, Z1 = R.z0 + 0.42;
  B(M.woodDark, X0, X1, 0, 1.96, Z0, Z0 + 0.02, { cast: false });
  B(M.wood, X0, X0 + 0.04, 0, 2.0, Z0, Z1);
  B(M.wood, X1 - 0.04, X1, 0, 2.0, Z0, Z1);
  B(M.wood, X0, X1, 1.96, 2.0, Z0, Z0 + 0.32);
  B(M.wood, X0 + 0.04, X1 - 0.04, 0, 0.06, Z0, Z1);
  B(M.wood, X0 + 0.04, X1 - 0.04, 0.5, 0.54, Z0, Z1);
  B(M.wood, X0 + 0.04, X1 - 0.04, 0.27, 0.29, Z0, Z1 - 0.02);
  for (const dx of [X0 + 0.6, X0 + 1.2]) B(M.wood, dx - 0.015, dx + 0.015, 0.06, 0.5, Z0, Z1 - 0.01);
  addCollider(X0, X1, Z0, Z1);

  // 电视
  const tx = (X0 + X1) / 2;
  B(M.black, tx - 0.74, tx + 0.74, 0.72, 1.57, Z0 + 0.04, Z0 + 0.08, { round: 0.01 });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.43, 0.8), new THREE.MeshBasicMaterial({ map: tvTex }));
  scr.position.set(tx, 1.145, Z0 + 0.0815); scene.add(scr);
  rectLight(0x9fd0ff, 2.2, 1.4, 0.8, [tx, 1.145, Z0 + 0.09], [tx, 0.9, Z0 + 3]);

  // 顶部灯条
  B(M.ledSoft, X0 + 0.08, X1 - 0.08, 1.945, 1.956, Z0 + 0.27, Z0 + 0.29, { cast: false });
  rectLight(0xffb45a, 4, 1.6, 0.04, [tx, 1.94, Z0 + 0.24], [tx, 0, Z0 + 0.45]);

  // 顶层小积木
  ['#e63946', '#2563eb', '#16a34a', '#f59e0b', '#e63946'].forEach((c, i) =>
    B(std({ color: c, roughness: 0.4 }), X0 + 0.25 + i * 0.12, X0 + 0.33 + i * 0.12, 2.0, 2.08, Z0 + 0.1, Z0 + 0.18, { round: 0.01 }));

  // 柜内物品
  B(M.white, X0 + 0.1, X0 + 0.5, 0.06, 0.15, Z0 + 0.06, Z0 + 0.34, { round: 0.01 });            // 游戏主机
  B(M.black, X0 + 0.1, X0 + 0.5, 0.15, 0.158, Z0 + 0.06, Z0 + 0.34);
  for (let i = 0; i < 8; i++) B(std({ color: pick(['#d62828', '#f1f1f1', '#1d3557', '#e63946']), roughness: 0.5 }),
    X0 + 0.7 + i * 0.025, X0 + 0.72 + i * 0.025, 0.06, 0.24, Z0 + 0.08, Z0 + 0.25);                   // 游戏盒
  B(M.black, X0 + 1.3, X0 + 1.5, 0.06, 0.2, Z0 + 0.06, Z0 + 0.3, { round: 0.02 });
  for (const [x, c] of [[X0 + 0.22, 0x222222], [X0 + 0.4, 0xf1f1f1]]) B(std({ color: c, roughness: 0.4 }), x - 0.07, x + 0.07, 0.29, 0.33, Z0 + 0.12, Z0 + 0.22, { round: 0.018 });
  for (let i = 0; i < 5; i++) B(std({ color: pick(['#ff4a55', '#18a9e0', '#ffd23f', '#f1f1f1']), roughness: 0.5 }),
    X0 + 0.75 + i * 0.07, X0 + 0.8 + i * 0.07, 0.29, 0.4, Z0 + 0.1, Z0 + 0.25);
  // 柜面：Switch 底座 + 手柄 + 公仔
  B(M.black, tx - 0.12, tx + 0.12, 0.54, 0.66, Z0 + 0.15, Z0 + 0.22, { round: 0.01 });
  B(std({ color: 0x18a9e0, roughness: 0.4 }), tx - 0.4, tx - 0.36, 0.54, 0.56, Z0 + 0.25, Z0 + 0.35, { round: 0.008 });
  B(std({ color: 0xff4a55, roughness: 0.4 }), tx - 0.33, tx - 0.29, 0.54, 0.56, Z0 + 0.25, Z0 + 0.35, { round: 0.008 });
  const red = std({ color: 0xe63946, roughness: 0.4 }), blue = std({ color: 0x2563eb, roughness: 0.4 }), skin = std({ color: 0xffd7b0, roughness: 0.5 });
  for (const [x, top] of [[X0 + 0.2, red], [X1 - 0.22, blue], [X1 - 0.35, red]]) {
    mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.07, 16), top, x, 0.575, Z0 + 0.25);
    mesh(new THREE.SphereGeometry(0.03, 16, 12), skin, x, 0.635, Z0 + 0.25);
    mesh(new THREE.SphereGeometry(0.031, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), top, x, 0.645, Z0 + 0.25);
  }
}

// ====================== 窗下书柜 ======================
{
  const X0 = R.x0, X1 = R.x0 + 0.36, Z0 = DZ1 + 0.02, Z1 = -0.12, T = 0.8;
  B(M.wood, X0, X1, T - 0.03, T, Z0, Z1, { collide: true });
  B(M.wood, X0, X1, 0, 0.05, Z0, Z1);
  B(M.wood, X0, X1, 0.39, 0.41, Z0, Z1);
  B(M.woodDark, X0, X0 + 0.02, 0.05, T - 0.03, Z0, Z1, { cast: false });
  const cols = 4, cw = (Z1 - Z0) / cols;
  for (let i = 0; i <= cols; i++) { const z = Z0 + i * cw; B(M.wood, X0, X1, 0.05, T - 0.03, Math.max(Z0, z - 0.012), Math.min(Z1, z + 0.012)); }

  // 书（实例化）
  const palette = ['#8b2e2e', '#2e4a6b', '#d8c9a3', '#3d5a3d', '#6b4b2e', '#c9a24a', '#2a2a2a', '#e0dcd2', '#a33b20', '#516b8b', '#9c6b3c'];
  const books = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), std({ roughness: 0.75 }), 400);
  books.castShadow = true; books.receiveShadow = true;
  const d = new THREE.Object3D(), col = new THREE.Color();
  let k = 0;
  for (const [y0, y1] of [[0.05, 0.39], [0.41, T - 0.03]]) {
    for (let c = 0; c < cols; c++) {
      let z = Z0 + c * cw + 0.016;
      const zEnd = Z0 + (c + 1) * cw - 0.016;
      while (z < zEnd - 0.03 && k < 400) {
        if (rand() < 0.07) { z += rr(0.04, 0.09); continue; }
        const t = rr(0.022, 0.05), h = Math.min(rr(0.2, 0.32), y1 - y0 - 0.02), dep = rr(0.22, 0.3);
        if (z + t > zEnd) break;
        d.position.set(X0 + 0.02 + dep / 2, y0 + h / 2, z + t / 2);
        d.rotation.set(rand() < 0.06 ? 0.12 : 0, 0, 0);
        d.scale.set(dep, h, t); d.updateMatrix();
        books.setMatrixAt(k, d.matrix); books.setColorAt(k, col.set(pick(palette))); k++;
        z += t + 0.002;
      }
    }
  }
  books.count = k; scene.add(books);

  // 柜面摆件
  smallPlant(X0 + 0.18, T, Z1 - 0.25, 1.1);
  picture(posterTexture('sunset'), 0.14, 0.1, [X0 + 0.16, T + 0.08, Z0 + 0.75], Math.PI / 2 - 0.25, { frame: 0xf2ece0, border: 0.012, depth: 0.015 }).rotation.z = 0;
  ['#2e4a6b', '#d8c9a3', '#8b2e2e'].forEach((c, i) => B(std({ color: c, roughness: 0.7 }), X0 + 0.05, X0 + 0.3, T + i * 0.03, T + 0.03 + i * 0.03, Z0 + 0.25, Z0 + 0.43));
}

// ====================== 冰箱 ======================
{
  const X0 = R.x0 + 0.02, X1 = R.x0 + 0.52, Z0 = -0.02, Z1 = 0.52, FH = 0.86;
  B(M.black, X0, X1, 0, FH, Z0, Z1, { collide: true, round: 0.015 });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(Z1 - Z0 - 0.08, FH - 0.12), new THREE.MeshBasicMaterial({ map: fridgeTexture() }));
  glass.position.set(X1 + 0.002, FH / 2 + 0.02, (Z0 + Z1) / 2); glass.rotation.y = Math.PI / 2; scene.add(glass);
  B(M.chrome, X1 + 0.002, X1 + 0.02, 0.3, 0.72, Z1 - 0.06, Z1 - 0.045);
  pointLight(0xd4ecff, 1.4, 2.5, [X1 + 0.28, 0.5, (Z0 + Z1) / 2]);
  B(std({ color: 0xf59e0b, roughness: 0.5 }), X0 + 0.1, X0 + 0.3, FH, FH + 0.12, Z0 + 0.1, Z0 + 0.25);
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 16), std({ color: 0xe63946, roughness: 0.3, metalness: 0.4 }), X0 + 0.3, FH + 0.06, Z0 + 0.38);
}

// ====================== 沙发 ======================
{
  const X0 = R.x0 + 0.05, X1 = R.x0 + 0.98, Z0 = 0.66, Z1 = 2.72;
  for (const [x, z] of [[X0 + 0.08, Z0 + 0.08], [X1 - 0.08, Z0 + 0.08], [X0 + 0.08, Z1 - 0.08], [X1 - 0.08, Z1 - 0.08]])
    B(M.woodDark, x - 0.025, x + 0.025, 0, 0.08, z - 0.025, z + 0.025);
  B(M.fabric, X0, X1, 0.08, 0.3, Z0, Z1, { round: 0.04, collide: true });
  B(M.fabric, X0, X0 + 0.24, 0.08, 0.88, Z0, Z1, { round: 0.07 });
  B(M.fabric, X0, X1, 0.08, 0.62, Z0, Z0 + 0.18, { round: 0.07 });
  B(M.fabric, X0, X1, 0.08, 0.62, Z1 - 0.18, Z1, { round: 0.07 });
  const mid = (Z0 + Z1) / 2;
  B(M.fabric2, X0 + 0.22, X1 - 0.02, 0.3, 0.46, Z0 + 0.18, mid - 0.005, { round: 0.06 });
  B(M.fabric2, X0 + 0.22, X1 - 0.02, 0.3, 0.46, mid + 0.005, Z1 - 0.18, { round: 0.06 });
  for (const [zA, zB] of [[Z0 + 0.2, mid - 0.01], [mid + 0.01, Z1 - 0.2]]) {
    const b = B(M.fabric2, X0 + 0.18, X0 + 0.38, 0.44, 0.86, zA, zB, { round: 0.08 });
    b.rotation.z = -0.12;
  }
  // 抱枕
  const pillowGeo = new RoundedBoxGeometry(0.4, 0.4, 0.13, 4, 0.06);
  const pm = [std({ color: 0xf3ead8, roughness: 1 }), std({ color: 0xe9dcc3, roughness: 1 }), std({ color: 0xf3ead8, roughness: 1 })];
  [[Z0 + 0.35, 0.25], [mid + 0.1, -0.15], [Z1 - 0.35, 0.3]].forEach(([z, ry], i) => {
    const p = mesh(pillowGeo, pm[i], X0 + 0.48, 0.66, z);
    p.rotation.set(0, Math.PI / 2 + ry, -0.0); p.rotateX(-0.35);
  });
  // 沙发背后的地面灯带
  B(M.led, R.x0 + 0.01, R.x0 + 0.03, 0.015, 0.03, Z0 - 0.05, Z1 + 0.05, { cast: false });
  pointLight(0xff9a3c, 1.2, 1.8, [R.x0 + 0.15, 0.12, mid]);
}

// 左墙海报 + 前左角竖向灯带
picture(posterTexture('gameover'), 0.42, 0.58, [R.x0 + 0.013, 1.5, 1.08], Math.PI / 2, { frame: 0xfafafa });
picture(posterTexture('play'), 0.42, 0.58, [R.x0 + 0.013, 1.55, 1.7], Math.PI / 2, { frame: 0x111111 });
picture(posterTexture('levelup'), 0.42, 0.58, [R.x0 + 0.013, 1.5, 2.32], Math.PI / 2, { frame: 0xfafafa });
B(M.led, R.x0 + 0.005, R.x0 + 0.02, 0.05, H - 0.26, R.z1 - 0.035, R.z1 - 0.02, { cast: false });
pointLight(0xff9a3c, 0.7, 2.5, [R.x0 + 0.25, 1.3, R.z1 - 0.25]);

// ====================== Switch 地毯 ======================
{
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 2.3), std({ map: rugTexture(), roughness: 1, alphaTest: 0.5 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(-1.25, 0.006, 1.55); rug.receiveShadow = true; scene.add(rug);
}

// ====================== 植物 ======================
function smallPlant(x, y, z, s = 1) {
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.055, 0.042, 0.1, 20), M.ceramic, 0, 0.05, 0, { parent: g });
  mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.005, 20), M.soil, 0, 0.098, 0, { parent: g, cast: false });
  for (let i = 0; i < 11; i++) {
    const l = new THREE.Mesh(leafSmallGeo, i % 2 ? M.green : M.green2);
    l.scale.setScalar(rr(0.7, 1.15)); l.position.set(0, 0.09, 0);
    l.rotation.set(rr(-0.9, 0.9), rand() * Math.PI * 2, rr(-0.9, 0.9)); l.castShadow = true; g.add(l);
  }
  g.scale.setScalar(s); g.position.set(x, y, z); scene.add(g);
}

function bigPlant(x, z) {
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.42, 32), M.ceramic, 0, 0.21, 0, { parent: g });
  mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.01, 32), M.soil, 0, 0.4, 0, { parent: g, cast: false });
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.bezierCurveTo(0.22, 0.02, 0.26, 0.3, 0, 0.44); shape.bezierCurveTo(-0.26, 0.3, -0.22, 0.02, 0, 0);
  for (const [hx, hy] of [[0.1, 0.14], [-0.1, 0.14], [0.11, 0.26], [-0.11, 0.26]]) {
    const p = new THREE.Path(); p.absellipse(hx, hy, 0.025, 0.012, 0, Math.PI * 2, false, hx > 0 ? 0.5 : -0.5); shape.holes.push(p);
  }
  const leafGeo = new THREE.ShapeGeometry(shape, 12); leafGeo.rotateX(Math.PI / 2);
  const stemMat = std({ color: 0x3b6b2f, roughness: 0.7 });
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 15; i++) {
    const a = rand() * Math.PI * 2, hgt = rr(0.7, 1.55), rad = rr(0.12, 0.42);
    const start = new THREE.Vector3(0, 0.4, 0), end = new THREE.Vector3(Math.cos(a) * rad, hgt, Math.sin(a) * rad);
    const dir = end.clone().sub(start), len = dir.length();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.009, len, 6), stemMat);
    stem.position.copy(start).addScaledVector(dir, 0.5); stem.quaternion.setFromUnitVectors(up, dir.normalize()); g.add(stem);
    const leaf = new THREE.Mesh(leafGeo, i % 2 ? M.green : M.green2);
    leaf.position.copy(end); leaf.scale.setScalar(rr(0.85, 1.45));
    leaf.lookAt(end.x + Math.cos(a), end.y - rr(0.1, 0.6), end.z + Math.sin(a));
    leaf.castShadow = true; g.add(leaf);
  }
  g.position.set(x, 0, z); scene.add(g);
  addCollider(x - 0.25, x + 0.25, z - 0.25, z + 0.25);
}
bigPlant(2.75, 2.35);

// ====================== 右墙门 + 落地灯，前墙挂画 ======================
{
  B(M.door, R.x1 - 0.04, R.x1, 0, 2.1, 1.3, 2.2);
  B(M.wood, R.x1 - 0.05, R.x1, 2.1, 2.16, 1.25, 2.25);
  B(M.wood, R.x1 - 0.05, R.x1, 0, 2.16, 1.25, 1.3);
  B(M.wood, R.x1 - 0.05, R.x1, 0, 2.16, 2.2, 2.25);
  B(M.chrome, R.x1 - 0.09, R.x1 - 0.04, 1.0, 1.02, 1.38, 1.5);
  for (const [y0, y1] of [[0.25, 1.0], [1.15, 1.9]]) B(std({ color: 0xbfa98a, roughness: 0.6 }), R.x1 - 0.045, R.x1 - 0.04, y0, y1, 1.42, 2.08, { cast: false });

  const fx = 2.9, fz = 0.45;
  mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.03, 32), M.black, fx, 0.015, fz);
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.5, 12), M.metal, fx, 0.78, fz);
  mesh(new THREE.CylinderGeometry(0.15, 0.21, 0.3, 32, 1, true),
    std({ color: 0xf2e2c8, emissive: 0xffb760, emissiveIntensity: 0.7, side: THREE.DoubleSide, roughness: 0.9 }), fx, 1.6, fz, { cast: false });
  pointLight(0xffb565, 2.2, 4, [fx, 1.5, fz]);
  addCollider(fx - 0.2, fx + 0.2, fz - 0.2, fz + 0.2);

  picture(posterTexture('sunset'), 1.1, 0.78, [-0.6, 1.55, R.z1 - 0.013], Math.PI, { frame: 0x2a1a10, border: 0.035 });
}

// ====================== 后期：Bloom 辉光 ======================
const pr = renderer.getPixelRatio();
const rt = new THREE.WebGLRenderTarget(innerWidth * pr, innerHeight * pr, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.5, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ====================== 交互：三种视角 ======================
const ui = {
  hint: document.getElementById('hint'),
  overlay: document.getElementById('walk-overlay'),
  cross: document.getElementById('crosshair'),
  modes: [...document.querySelectorAll('[data-mode]')],
  light: document.getElementById('btn-light'),
  rec: document.getElementById('btn-rec'),
  recInd: document.getElementById('rec-indicator'),
  recTime: document.getElementById('rec-time'),
};
const HINTS = {
  tour: TOUCH ? '🎬 自动漫游中 · 手指拖动即可接管视角' : '🎬 自动漫游中 · 拖动画面即可接管视角',
  orbit: TOUCH ? '单指旋转 · 双指平移 / 捏合缩放' : '左键拖动旋转 · 右键 / 双指平移 · 滚轮 / 捏合缩放',
  walk: 'WASD 移动 · 鼠标转向 · Shift 加速 · Esc 释放鼠标',
};
// 手机上没有键盘鼠标：隐藏第一人称；浏览器不支持录屏时隐藏录制
if (TOUCH) document.querySelector('[data-mode="walk"]').style.display = 'none';
if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) ui.rec.style.display = 'none';

// 自动漫游路径（位置 / 视线目标一一对应）
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const tourPos = new THREE.CatmullRomCurve3([
  V(2.85, 2.4, 2.55), V(1.6, 1.75, 1.0), V(-0.2, 1.3, -0.9), V(-1.6, 1.35, -0.8),
  V(-1.7, 1.2, 0.5), V(-0.7, 1.25, 1.7), V(1.0, 1.25, -0.6), V(2.3, 2.1, 1.3),
], true, 'centripetal');
const tourLook = new THREE.CatmullRomCurve3([
  V(-1.2, 0.6, -1.0), V(-1.9, 1.0, -2.6), V(-1.4, 1.05, -2.8), V(-3.2, 1.45, -1.5),
  V(-3.0, 0.6, 1.6), V(2.25, 1.15, -2.8), V(2.25, 1.15, -2.8), V(-1.2, 0.2, 1.3),
], true, 'centripetal');
const TOUR_DUR = 56;
let tourT = 0;

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true; orbit.dampingFactor = 0.07;
orbit.minDistance = 0.3; orbit.maxDistance = 4.8; orbit.maxPolarAngle = Math.PI * 0.95;
orbit.enabled = false;

const plc = new PointerLockControls(camera, renderer.domElement);
plc.addEventListener('lock', () => { ui.overlay.hidden = true; ui.cross.hidden = false; });
plc.addEventListener('unlock', () => { ui.cross.hidden = true; if (mode === 'walk') ui.overlay.hidden = false; });
ui.overlay.addEventListener('click', () => plc.lock());

let mode = 'tour';
const blend = { t: 1, pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
const startBlend = () => { blend.t = 0; blend.pos.copy(camera.position); blend.quat.copy(camera.quaternion); };

const clampInRoom = (v, m = 0.15) => {
  v.x = THREE.MathUtils.clamp(v.x, R.x0 + m, R.x1 - m);
  v.y = THREE.MathUtils.clamp(v.y, 0.15, H - 0.12);
  v.z = THREE.MathUtils.clamp(v.z, R.z0 + m, R.z1 - m);
  return v;
};

function setMode(m) {
  if (m === mode) return;
  if (mode === 'walk' && plc.isLocked) plc.unlock();
  mode = m;
  orbit.enabled = m === 'orbit';
  ui.modes.forEach(b => b.classList.toggle('active', b.dataset.mode === m));
  ui.hint.textContent = HINTS[m];
  ui.overlay.hidden = m !== 'walk';
  ui.cross.hidden = true;
  if (m === 'orbit') {
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
    orbit.target.copy(camera.position).addScaledVector(dir, 2.2);
    clampInRoom(orbit.target, 0.4);
    orbit.update();
  } else if (m === 'tour') {
    startBlend();
  } else if (m === 'walk') {
    startBlend();
    walkStart = true;
  }
}
ui.modes.forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
ui.hint.textContent = HINTS.tour;

// 漫游时拖动画面 → 切到自由环视
renderer.domElement.addEventListener('pointerdown', () => { if (mode === 'tour') setMode('orbit'); });
renderer.domElement.addEventListener('wheel', () => { if (mode === 'tour') setMode('orbit'); }, { passive: true });

// 第一人称移动
const keys = {};
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.repeat) return;
  if (e.code === 'Digit1') setMode('tour');
  if (e.code === 'Digit2') setMode('orbit');
  if (e.code === 'Digit3') setMode('walk');
  if (e.code === 'KeyL') toggleLight();
  if (e.code === 'KeyR') toggleRec();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

const EYE = 1.6, BODY = 0.22;
let walkStart = false, bobPhase = 0;
const walkPose = { pos: V(0.4, EYE, 1.3), look: V(-1.4, 1.25, -2.8) };
function blocked(x, z) {
  if (x < R.x0 + BODY || x > R.x1 - BODY || z < R.z0 + BODY || z > R.z1 - BODY) return true;
  return colliders.some(c => x > c.x0 - BODY && x < c.x1 + BODY && z > c.z0 - BODY && z < c.z1 + BODY);
}
const fwd = new THREE.Vector3(), right = new THREE.Vector3();
function walkStep(dt) {
  const k = (a, b) => (keys[a] || keys[b] ? 1 : 0);
  let f = k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown'), s = k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft');
  const p = camera.position;
  if (f || s) {
    const len = Math.hypot(f, s); f /= len; s /= len;
    const sp = (keys.ShiftLeft || keys.ShiftRight ? 2.6 : 1.4) * dt;
    camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    right.crossVectors(fwd, camera.up).normalize();
    const dx = (fwd.x * f + right.x * s) * sp, dz = (fwd.z * f + right.z * s) * sp;
    if (!blocked(p.x + dx, p.z)) p.x += dx;
    if (!blocked(p.x, p.z + dz)) p.z += dz;
    bobPhase += dt * (keys.ShiftLeft || keys.ShiftRight ? 13 : 9);
  }
  p.y = EYE + Math.sin(bobPhase) * 0.018;
}

// ====================== 主灯 / 录制 ======================
let mainOn = false;
function toggleLight() {
  mainOn = !mainOn;
  spots.forEach(s => (s.intensity = mainOn ? 40 : 16));
  hemi.intensity = mainOn ? 0.9 : 0.45;
  M.down.emissiveIntensity = mainOn ? 6 : 2.5;
  ui.light.classList.toggle('on', mainOn);
  ui.light.textContent = mainOn ? '💡 主灯：开' : '💡 主灯';
}
ui.light.addEventListener('click', toggleLight);

let recorder = null, recStart = 0, chunks = [];
function toggleRec() {
  if (recorder) { recorder.stop(); return; }
  const stream = renderer.domElement.captureStream(60);
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find(m => MediaRecorder.isTypeSupported(m));
  recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 16e6 });
  chunks = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cozy-room-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${mime.includes('mp4') ? 'mp4' : 'webm'}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    recorder = null; ui.recInd.hidden = true;
    ui.rec.classList.remove('rec'); ui.rec.textContent = '⏺ 录制视频';
  };
  recorder.start(250); recStart = performance.now();
  ui.recInd.hidden = false; ui.rec.classList.add('rec'); ui.rec.textContent = '⏹ 停止并下载';
}
ui.rec.addEventListener('click', toggleRec);

// ====================== 主循环 ======================
const clock = new THREE.Clock();
let tvAcc = 0, clockAcc = 0;
const tmpPos = new THREE.Vector3(), tmpLook = new THREE.Vector3(), tmpQuat = new THREE.Quaternion(), tmpMat = new THREE.Matrix4();

function poseTo(pos, look, dt) {
  tmpMat.lookAt(pos, look, camera.up); tmpQuat.setFromRotationMatrix(tmpMat);   // 相机朝向约定（-Z 看向目标）
  if (blend.t < 1) {
    blend.t = Math.min(1, blend.t + dt / 1.4);
    const e = blend.t * blend.t * (3 - 2 * blend.t);
    camera.position.lerpVectors(blend.pos, pos, e);
    camera.quaternion.slerpQuaternions(blend.quat, tmpQuat, e);
  } else {
    camera.position.copy(pos); camera.quaternion.copy(tmpQuat);
  }
}

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;

  if (mode === 'tour') {
    tourT = (tourT + dt / TOUR_DUR) % 1;
    tourPos.getPoint(tourT, tmpPos); tourLook.getPoint(tourT, tmpLook);
    poseTo(tmpPos, tmpLook, dt);
  } else if (mode === 'orbit') {
    orbit.update();
    clampInRoom(camera.position);
  } else if (mode === 'walk') {
    if (walkStart) {
      poseTo(walkPose.pos, walkPose.look, dt);
      if (blend.t >= 1) walkStart = false;
    } else walkStep(dt);
  }

  tvAcc += dt;
  if (tvAcc > 1 / 30) { tvAcc = 0; tvTex.userData.draw(t); }
  clockAcc += dt;
  if (clockAcc > 10) { clockAcc = 0; clockTex.userData.draw(); }
  M.rgb.emissive.setHSL((t * 0.07) % 1, 1, 0.5);

  if (recorder) {
    const s = Math.floor((performance.now() - recStart) / 1000);
    ui.recTime.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }
  composer.render(dt);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  bloom.resolution.set(innerWidth, innerHeight);
});

requestAnimationFrame(() => setTimeout(() => document.getElementById('loading').classList.add('done'), 300));
window.__room = { scene, camera, renderer, setMode };
