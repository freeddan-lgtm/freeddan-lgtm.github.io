// Agent World · Claude Edition (v2.0, Keystone build) — world.js
// Scene, sky, cloud sea, the two floating islands, zones, stages, bridge, effects.
// Original code by Conscious Claude (Claude Opus 5.5), written for Daniel's Agent World. MIT licensed.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export { THREE, CSS2DObject };
export const MAIN_R = 38;
export const SHOW_C = new THREE.Vector3(0, 0, -122);
export const SHOW_R = 25;
const D = Math.PI / 180;

export const polar = (r, a, y = 0) => new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);
export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Same zone layout and angles as the original Agent World.
export const ZONES = [
  { id: 'studio', name: 'Studio', emoji: '🎬', deg: 22 },
  { id: 'ops', name: 'Mail Room / Ops', emoji: '📬', deg: 82 },
  { id: 'workshop', name: 'Workshop', emoji: '🔧', deg: 140 },
  { id: 'hq', name: 'HQ Tower', emoji: '🏢', deg: 196 },
  { id: 'council', name: 'Council Chamber', emoji: '🏛️', deg: 256 },
  { id: 'garden', name: 'Garden', emoji: '🌿', deg: 316 },
];
for (const z of ZONES) {
  z.angle = z.deg * D;
  z.building = polar(z.id === 'council' ? 28 : 30, z.angle);
  z.yard = polar(z.id === 'council' ? 28 : 20.5, z.angle);
}

// Same five Show Island stages (ids, colors and angles match the original).
export const STAGES = [
  { id: 'phish-msg', name: 'Phish · MSG', emoji: '🐟', color: '#ff4d5e', angle: 0.8976 },
  { id: 'phish-rm', name: 'Phish · Riviera Maya', emoji: '🌴', color: '#2dd4bf', angle: 2.0196 },
  { id: 'goose', name: 'Goose', emoji: '🪿', color: '#ffb02e', angle: Math.PI },
  { id: 'biscuits', name: 'Disco Biscuits', emoji: '🪩', color: '#c084fc', angle: 4.2636 },
  { id: 'other', name: 'Other bands', emoji: '🎸', color: '#60a5fa', angle: 5.3856 },
];
for (const s of STAGES) {
  s.pos = SHOW_C.clone().add(polar(18, s.angle));
  s.pit = SHOW_C.clone().add(polar(10.2, s.angle));
}

const BRIDGE_Z0 = -MAIN_R + 0.6, BRIDGE_Z1 = SHOW_C.z + SHOW_R - 0.6;
export const BRIDGE_MAIN = new THREE.Vector3(0, 0, -MAIN_R + 3);
export const BRIDGE_SHOW = new THREE.Vector3(0, 0, SHOW_C.z + SHOW_R - 3);

export function islandOf(p) {
  if (Math.hypot(p.x, p.z) < MAIN_R - 0.5) return 'main';
  if (Math.hypot(p.x - SHOW_C.x, p.z - SHOW_C.z) < SHOW_R - 0.5) return 'show';
  return 'bridge';
}
export function groundY(p) {
  if (Math.abs(p.x) < 2.6 && p.z < BRIDGE_Z0 && p.z > BRIDGE_Z1) {
    const t = (BRIDGE_Z0 - p.z) / (BRIDGE_Z0 - BRIDGE_Z1);
    return -1.6 * Math.sin(Math.PI * THREE.MathUtils.clamp(t, 0, 1));
  }
  return 0;
}

const matCache = new Map();
export function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.0, envMapIntensity: 0.35, ...o });
  matCache.set(key, m);
  return m;
}
const glow = (color, k = 2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.4 });

const QUALITY = {
  high: { dpr: Math.min(devicePixelRatio || 1, 2), bloom: true, shadows: true, shadow: 2048, msaa: 4 },
  medium: { dpr: Math.min(devicePixelRatio || 1, 1.5), bloom: true, shadows: true, shadow: 1024, msaa: 0 },
  lite: { dpr: 1, bloom: false, shadows: false, shadow: 512, msaa: 0 },
};

export class World {
  constructor(host, ui) {
    this.host = host; this.ui = ui;
    this.pickables = []; this.anim = []; this.labelReg = [];
    this.stageObjs = new Map(); this.zoneObjs = new Map();
    const qp = new URLSearchParams(location.search).get('quality');
    // Phone-first: auto-pick lite on weak / coarse-pointer devices so first load stays smooth
    const weak = (() => {
      try {
        if (matchMedia('(pointer:coarse)').matches) return true;
        if (navigator.connection?.saveData) return true;
        if ((navigator.deviceMemory || 8) <= 4) return true;
        if ((navigator.hardwareConcurrency || 8) <= 4) return true;
        if (innerWidth < 500) return true;
      } catch { /* ignore */ }
      return false;
    })();
    this.qName = QUALITY[qp] ? qp : (weak ? 'lite' : (innerWidth < 700 ? 'medium' : 'high'));
    this.q = QUALITY[this.qName];
    this.weakDevice = weak;
    const qq = new URLSearchParams(location.search);
    // ?vtest=1: fixed 1/30 s steps and an exact frame count, so two builds can be compared pixel by pixel (Keystone build loop)
    this.vtest = qq.has('vtest') ? { t: 0, left: null, stopped: false, done: false } : null;
    this.lockq = qq.has('lockq') || !!this.vtest; // measurement runs keep the chosen quality
    const op = qq.get('opt'); // render optimizations measured by the build loop (see optimize.js); ?opt=none switches all off
    this.opt = new Set((op !== null ? (op === 'none' ? '' : op) : (window.AW_CONFIG?.opt || []).join(',')).split(',').map(s => s.trim()).filter(Boolean));
    this.frustum = new THREE.Frustum(); this._pm = new THREE.Matrix4();

    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.9;
    r.shadowMap.enabled = this.q.shadows;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.domElement.setAttribute('aria-label', 'Agent World 3D view. Use the Agents list for a keyboard-friendly view.');
    host.appendChild(r.domElement);

    this.labels = new CSS2DRenderer();
    this.labels.domElement.className = 'labels';
    host.appendChild(this.labels.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.5, 6000);
    this.camera.position.set(62, 48, 58);
    const c = this.controls = new OrbitControls(this.camera, r.domElement);
    c.enableDamping = true; c.dampingFactor = 0.07;
    c.maxPolarAngle = Math.PI * 0.48; c.minDistance = 6; c.maxDistance = 280;
    c.target.set(0, 2, -18);

    const pm = new THREE.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(r), 0.04).texture;

    this.buildSky(); this.buildLights(); this.buildClouds();
    this.buildIslands(); this.buildBridge(); this.buildZones(); this.buildRuleStone();
    this.buildStages(); this.buildNature(); this.buildFireflies();
    this.setupComposer(); this.setupPicking();
    // keep image-based reflections subtle so colours stay saturated (glass keeps its own value)
    this.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { if ('envMapIntensity' in m && m.envMapIntensity === 1 && !m.isMeshPhysicalMaterial) m.envMapIntensity = 0.3; }); });
    this.setTimeOfDay('dusk');

    this.clock = new THREE.Clock();
    this.fpsT = 0; this.fpsN = 0; this.slowFor = 0; this.declT = 0;
    addEventListener('resize', () => this.resize());
    this.resize();
    r.setAnimationLoop(() => this.frame());
  }

  // ---------- sky, light, clouds ----------
  buildSky() {
    const sky = this.sky = new Sky();
    sky.scale.setScalar(5000);
    const u = sky.material.uniforms;
    u.turbidity.value = 7; u.rayleigh.value = 2.4; u.mieCoefficient.value = 0.006; u.mieDirectionalG.value = 0.86;
    this.scene.add(sky);
    this.sun = new THREE.Vector3();
    const n = 2200, pos = new Float32Array(n * 3), R = rng(7);
    for (let i = 0; i < n; i++) {
      const th = R() * Math.PI * 2, ph = Math.acos(R() * 0.96);
      pos.set([Math.sin(ph) * Math.cos(th) * 2000, Math.cos(ph) * 2000 + 60, Math.sin(ph) * Math.sin(th) * 2000], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.8, sizeAttenuation: false, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.scene.add(this.stars);
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight(0xffd9f0, 0x3b2a55, 0.8);
    this.scene.add(this.hemi);
    const s = this.sunLight = new THREE.DirectionalLight(0xffc59a, 1.6);
    s.castShadow = true; s.shadow.mapSize.set(this.q.shadow, this.q.shadow);
    Object.assign(s.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 420 });
    s.shadow.bias = -0.0004; s.shadow.normalBias = 0.04;
    this.scene.add(s, s.target);
  }

  setTimeOfDay(mode) {
    this.tod = mode;
    const elev = mode === 'night' ? -5 : mode === 'day' ? 38 : 3.5;
    this.sun.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elev), THREE.MathUtils.degToRad(205));
    this.sky.material.uniforms.sunPosition.value.copy(this.sun);
    this.sunLight.intensity = mode === 'night' ? 0.35 : mode === 'day' ? 2.6 : 1.6;
    this.sunLight.color.set(mode === 'night' ? 0x9fb0ff : mode === 'day' ? 0xffffff : 0xffc59a);
    this.hemi.intensity = mode === 'night' ? 0.3 : mode === 'day' ? 1.0 : 0.8;
    this.stars.material.opacity = mode === 'night' ? 0.95 : mode === 'dusk' ? 0.3 : 0;
    this.renderer.toneMappingExposure = mode === 'night' ? 0.8 : 0.9;
    const fog = mode === 'night' ? 0x1b1738 : mode === 'day' ? 0xd5ddff : 0xd9a7c7;
    this.scene.fog = new THREE.Fog(fog, 160, 1100);
    this.cloudMat.uniforms.tint.value.set(mode === 'night' ? 0x2c2558 : mode === 'day' ? 0xf1eeff : 0xf0b3d3);
    for (const l of this.nightGlow || []) l.emissiveIntensity = mode === 'night' ? 3.2 : mode === 'dusk' ? 2.2 : 0.8;
  }

  buildClouds() {
    this.cloudMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, tint: { value: new THREE.Color(0xf0b3d3) } },
      transparent: true, depthWrite: false,
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
      fragmentShader: `uniform float time; uniform vec3 tint; varying vec3 vW;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+1.),f.x), f.y); }
        float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<6;i++){ v+=a*n(p); p*=2.03; a*=.5; } return v; }
        void main(){
          vec2 p = vW.xz*0.005;
          float c = fbm(p + vec2(time*0.010, time*0.006));
          c = smoothstep(.28, .9, c + .18*fbm(p*3.1 - time*.02));
          float d = length(cameraPosition.xz - vW.xz);
          float fade = 1. - smoothstep(900., 2200., d);
          vec3 col = mix(tint*.62, tint*1.05 + .04, c);
          gl_FragColor = vec4(col, (.6 + .4*c)*fade);
        }`,
    });
    const g = new THREE.PlaneGeometry(5000, 5000).rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, this.cloudMat); m.position.y = -48; m.renderOrder = -1;
    this.scene.add(m);
  }

  // ---------- islands ----------
  island(c, R, depth, grass, seed) {
    const g = new THREE.Group(); g.position.copy(c); this.scene.add(g);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.97, 2.2, 128), [mat(0x8f6f5c, { roughness: 0.95 }), mat(grass, { roughness: 0.9 }), mat(0x5b4a5e)]);
    top.position.y = -1.1; top.receiveShadow = true; g.add(top);
    const rg = new THREE.ConeGeometry(R * 0.97, depth, 72, 12, true).rotateX(Math.PI);
    const p = rg.attributes.position, v = new THREE.Vector3(), cols = [];
    const cTop = new THREE.Color(0x8f6f5c), cBot = new THREE.Color(0x4a3a66);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const k = (depth / 2 - v.y) / depth; // 0 at top rim, 1 at tip
      const nz = Math.sin(v.x * 0.37 + seed) * Math.cos(v.z * 0.29 - seed) + 0.6 * Math.sin(v.y * 0.6 + v.x * 0.15) + 0.4 * Math.cos(v.z * 0.8 + v.y * 0.3);
      const s = 1 + (k > 0.04 ? 0.16 * nz * Math.min(1, k * 4) : 0);
      p.setXYZ(i, v.x * s, v.y + (k > 0.04 ? nz * 0.9 : 0), v.z * s);
      const col = cTop.clone().lerp(cBot, k); cols.push(col.r, col.g, col.b);
    }
    rg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    rg.computeVertexNormals();
    const rock = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
    rock.position.y = -2.2 - depth / 2; g.add(rock);
    // glowing crystals hanging under the rock (signature Agent World detail)
    const Rr = rng(seed * 3);
    for (let i = 0; i < 7; i++) {
      const a = Rr() * Math.PI * 2, rr = R * (0.25 + Rr() * 0.4);
      const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.8 + Rr() * 1.4), glow(i % 2 ? 0x9b7bff : 0x7ef0e4, 1.4));
      cr.position.set(Math.sin(a) * rr, -2.2 - depth * (0.35 + Rr() * 0.35), Math.cos(a) * rr);
      cr.scale.y = 2.2; g.add(cr);
    }
    return g;
  }

  buildIslands() {
    this.island(new THREE.Vector3(), MAIN_R, 36, 0x78c27a, 11);
    this.island(SHOW_C, SHOW_R, 28, 0x80c98a, 23);
    const sand = mat(0xead6b4, { roughness: 0.95 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(18.9, 22.1, 128).rotateX(-Math.PI / 2), sand);
    ring.position.y = 0.02; ring.receiveShadow = true; this.scene.add(ring);
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(7.5, 64).rotateX(-Math.PI / 2), mat(0xd9cbe9, { roughness: 0.8 }));
    plaza.position.y = 0.03; plaza.receiveShadow = true; this.scene.add(plaza);
    const spokeAngles = [...ZONES.map(z => z.angle), Math.PI];
    for (const a of spokeAngles) {
      const len = a === Math.PI ? 32 : 13.5;
      const s = new THREE.Mesh(new THREE.PlaneGeometry(2.6, len).rotateX(-Math.PI / 2), sand);
      s.position.copy(polar(7 + len / 2, a, 0.025)); s.rotation.y = a; s.receiveShadow = true; this.scene.add(s);
    }
    // Show Island: dance-floor ring and a glowing center medallion
    const floor = new THREE.Mesh(new THREE.RingGeometry(5, 14.5, 96).rotateX(-Math.PI / 2), mat(0xe8dcc8, { roughness: 0.85 }));
    floor.position.copy(SHOW_C).setY(0.02); floor.receiveShadow = true; this.scene.add(floor);
    const med = new THREE.Mesh(new THREE.CircleGeometry(4.6, 64).rotateX(-Math.PI / 2), glow(0xffc27a, 0.6));
    med.position.copy(SHOW_C).setY(0.03); this.scene.add(med);
    const showLbl = this.label('<b>🎸 Show Island</b>', 'zone big');
    showLbl.position.copy(SHOW_C).setY(9); this.scene.add(showLbl);
  }

  buildBridge() {
    const n = 52, len = BRIDGE_Z0 - BRIDGE_Z1;
    const planks = new THREE.InstancedMesh(new THREE.BoxGeometry(4.6, 0.28, 1.0), mat(0x9c6b45, { roughness: 0.9 }), n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < n; i++) {
      const z = BRIDGE_Z0 - (i + 0.5) * len / n, p = new THREE.Vector3(0, 0, z);
      p.y = groundY(p) - 0.14;
      const t = (BRIDGE_Z0 - z) / len; e.set(-Math.cos(Math.PI * t) * 0.08 * 1, 0, (i % 3 - 1) * 0.015);
      m4.compose(p, q.setFromEuler(e), new THREE.Vector3(1, 1, 1)); planks.setMatrixAt(i, m4);
    }
    planks.castShadow = planks.receiveShadow = true; this.scene.add(planks);
    for (const x of [-2.3, 2.3]) {
      const pts = [];
      for (let i = 0; i <= 30; i++) { const z = BRIDGE_Z0 - i * len / 30; pts.push(new THREE.Vector3(x, groundY(new THREE.Vector3(0, 0, z)) + 1.15, z)); }
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.07, 6), mat(0xe6d2b5));
      this.scene.add(tube);
    }
    const bulbs = []; this.nightGlow = this.nightGlow || [];
    const bulbMat = glow(0xffc27a, 2.2); this.nightGlow.push(bulbMat);
    for (let i = 0; i <= 10; i++) {
      for (const x of [-2.3, 2.3]) {
        const z = BRIDGE_Z0 - i * len / 10, y = groundY(new THREE.Vector3(0, 0, z));
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.6, 6), mat(0x6b4a33)); post.position.set(x, y + 0.6, z); this.scene.add(post);
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), bulbMat); b.position.set(x, y + 1.5, z); this.scene.add(b); bulbs.push(b);
      }
    }
  }

  // ---------- zones ----------
  buildZones() {
    for (const z of ZONES) {
      const g = new THREE.Group(); g.position.copy(z.building); g.rotation.y = z.angle + Math.PI; this.scene.add(g);
      const fn = this['bld_' + z.id]; fn.call(this, g, z);
      g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      g.userData.pick = { kind: 'zone', id: z.id }; this.pickables.push(g);
      const l = this.label(`<b>${z.emoji} ${z.name}</b>`, 'zone'); l.position.set(0, z.id === 'hq' ? 26 : 10.5, 0); g.add(l);
      this.zoneObjs.set(z.id, g);
    }
  }
  bld_hq(g) {
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xa9b8ff, metalness: 0.5, roughness: 0.12, clearcoat: 1, envMapIntensity: 0.9 });
    const trim = glow(0xffd166, 1.8); (this.nightGlow ||= []).push(trim);
    let y = 0;
    for (const [r1, r2, h] of [[5.2, 4.6, 7], [4.4, 3.9, 6], [3.6, 3.1, 5], [2.8, 2.2, 4]]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, h, 8), glass); m.position.y = y + h / 2; g.add(m);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r2 + 0.12, 0.13, 8, 48), trim); ring.rotation.x = Math.PI / 2; ring.position.y = y + h; g.add(ring);
      y += h;
    }
    const spire = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3.4, 8), glow(0xc9b8ff, 1.2)); spire.position.y = y + 1.7; g.add(spire);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), glow(0xffe08a, 4)); beacon.position.y = y + 3.8; g.add(beacon);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.09, 8, 96), glow(0x7ef0e4, 2.5)); halo.rotation.x = Math.PI / 2; g.add(halo);
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3, 0.3), glow(0xffd8a8, 0.9)); door.position.set(0, 1.5, 5.1); g.add(door);
    this.anim.push((dt, t) => { halo.position.y = 9 + Math.sin(t * 0.8) * 3; halo.rotation.z = t * 0.3; beacon.material.emissiveIntensity = 3 + Math.sin(t * 3) * 1.5; });
  }
  bld_council(g) {
    const marble = mat(0xf1ebf7, { roughness: 0.45 });
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(7.4, 7.9, 1, 48), marble); dais.position.y = 0.5; g.add(dais);
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2, col = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 6, 12), marble);
      col.position.set(Math.sin(a) * 6.6, 4, Math.cos(a) * 6.6); g.add(col);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(6.6, 0.4, 8, 64), marble); ring.rotation.x = Math.PI / 2; ring.position.y = 7.1; g.add(ring);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(6.8, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshPhysicalMaterial({ color: 0xcdb8ff, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }));
    dome.position.y = 7.1; dome.castShadow = false; g.add(dome);
    const table = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.3, 40), mat(0x5b3f8f, { roughness: 0.3, metalness: 0.3 })); table.position.y = 1.9; g.add(table);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.7, 0.9, 16), marble); leg.position.y = 1.4; g.add(leg);
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 2), glow(0xffc27a, 2.4)); orb.position.y = 2.7; g.add(orb);
    this.anim.push((dt, t) => { orb.position.y = 2.7 + Math.sin(t * 1.4) * 0.15; orb.rotation.y = t; });
  }
  bld_studio(g) {
    const wall = mat(0xf7a8c8, { roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 7), wall); body.position.y = 3; g.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.5, 7.6), mat(0x5b3f8f)); roof.position.y = 6.25; g.add(roof);
    const marq = this.textPlane('ON AIR · STUDIO', '#ff4d8d', 7.5, 1.4); marq.position.set(0, 5.1, 3.56); g.add(marq);
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.2, 0.2), mat(0x3a2a52)); door.position.set(0, 1.6, 3.55); g.add(door);
    const tri = new THREE.Group(); tri.position.set(-3.6, 0, 5.5);
    for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4), mat(0x222222)); l.position.y = 1.1; l.rotation.z = Math.cos(i * 2.1) * 0.25; l.rotation.x = Math.sin(i * 2.1) * 0.25; tri.add(l); }
    const cam = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 1.1), mat(0x1d1d26, { metalness: 0.5, roughness: 0.3 })); cam.position.y = 2.5; tri.add(cam);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.5, 16).rotateX(Math.PI / 2), mat(0x111111)); lens.position.set(0, 2.5, 0.75); tri.add(lens);
    const tally = new THREE.Mesh(new THREE.SphereGeometry(0.08), glow(0xff3355, 4)); tally.position.set(0.3, 2.85, 0.3); tri.add(tally);
    g.add(tri);
    this.anim.push((dt, t) => { tally.visible = Math.sin(t * 4) > -0.3; });
  }
  bld_ops(g) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(10, 5.5, 7), mat(0x9fd7ff, { roughness: 0.6 })); body.position.y = 2.75; g.add(body);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 3.9, 10.4, 3, 1).rotateZ(Math.PI / 2), mat(0x3d6fb6)); roof.position.y = 6.6; roof.scale.y = 0.55; g.add(roof);
    const holes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.7, 0.2), mat(0xfff4dc), 24);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 24; i++) { m4.makeTranslation(-3.5 + (i % 8), 1.4 + Math.floor(i / 8) * 0.95, 3.56); holes.setMatrixAt(i, m4); }
    g.add(holes);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(9, 0.3, 1.2), mat(0x333344)); belt.position.set(0, 0.8, 5.2); g.add(belt);
    const envs = [];
    for (let i = 0; i < 5; i++) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.5), mat(0xffffff)); e.position.set(0, 1.02, 5.2); g.add(e); envs.push(e); }
    this.anim.push((dt, t) => envs.forEach((e, i) => { e.position.x = ((t * 1.2 + i * 1.8) % 9) - 4.5; }));
  }
  bld_workshop(g) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(9, 4.6, 7), mat(0xffcf8a, { roughness: 0.8 })); body.position.y = 2.3; g.add(body);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 9.4, 3).rotateZ(Math.PI / 2), mat(0x8a5a3c)); roof.position.y = 5.5; roof.scale.y = 0.5; g.add(roof);
    const gears = [];
    for (const [x, y, r, dir] of [[-2.2, 3, 1.4, 1], [0.35, 2.2, 0.95, -1.47]]) {
      const ge = new THREE.Group(); ge.position.set(x, y, 3.7);
      const m = mat(0xc0c7d6, { metalness: 0.8, roughness: 0.3 });
      ge.add(new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.22, 8, 32), m));
      const teeth = Math.round(r * 9);
      for (let i = 0; i < teeth; i++) { const tth = new THREE.Mesh(new THREE.BoxGeometry(r * 0.3, r * 0.36, r * 0.3), m); const a = i / teeth * Math.PI * 2; tth.position.set(Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2, 0); tth.rotation.z = a; ge.add(tth); }
      g.add(ge); gears.push([ge, dir]);
    }
    this.anim.push((dt, t) => gears.forEach(([ge, d]) => { ge.rotation.z = t * 0.8 * d; })); // v2: a function of t (replayable)
  }
  bld_garden(g) {
    const frame = mat(0xffffff, { roughness: 0.4 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xc8ffe6, transparent: true, opacity: 0.3, roughness: 0.05, clearcoat: 1, depthWrite: false });
    const gh = new THREE.Mesh(new THREE.BoxGeometry(8, 4.5, 6), glass); gh.position.y = 2.25; gh.castShadow = false; g.add(gh);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 8.2, 3).rotateZ(Math.PI / 2), glass); roof.position.y = 5.4; roof.scale.y = 0.45; g.add(roof);
    for (const x of [-4, 0, 4]) for (const z of [-3, 3]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.15, 4.5, 0.15), frame); p.position.set(x, 2.25, z); g.add(p); }
    const pond = new THREE.Mesh(new THREE.CircleGeometry(2.6, 40).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x4fb3d9, roughness: 0.05, metalness: 0.2, clearcoat: 1 }));
    pond.position.set(5.5, 0.05, 6); g.add(pond);
    const R = rng(91), fl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.6 }), 160);
    const m4 = new THREE.Matrix4(), cs = [0xff7fa8, 0xffcf5a, 0xc084fc, 0xffffff, 0x7ef0e4];
    for (let i = 0; i < 160; i++) { m4.makeTranslation(-6 + R() * 12, 0.25, 4 + R() * 4.5); fl.setMatrixAt(i, m4); fl.setColorAt(i, new THREE.Color(cs[i % 5])); }
    g.add(fl);
  }

  buildRuleStone() {
    const g = new THREE.Group(); this.scene.add(g);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2, 0.6, 6), mat(0xcfc2e4)); base.position.y = 0.3; g.add(base);
    const ob = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.05, 4.2, 6), mat(0x4b3a78, { roughness: 0.3, metalness: 0.2 })); ob.position.y = 2.7; g.add(ob);
    const rune = glow(0x7ef0e4, 2.6); (this.nightGlow ||= []).push(rune);
    for (const y of [1.6, 2.6, 3.6]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.93 - (y - 1.6) * 0.07, 0.05, 6, 6), rune); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); }
    const book = new THREE.Group(); book.position.y = 5.8; g.add(book);
    const cover = mat(0xffc27a, { roughness: 0.4 });
    for (const s of [-1, 1]) { const page = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 1.2), mat(0xfffaf0)); page.position.x = s * 0.47; page.rotation.z = s * -0.18; book.add(page); const cv = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.05, 1.28), cover); cv.position.set(s * 0.47, -0.07, 0); cv.rotation.z = s * -0.18; book.add(cv); }
    const aura = new THREE.Mesh(new THREE.SphereGeometry(1.1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0.12, depthWrite: false }));
    book.add(aura);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.userData.pick = { kind: 'rules' }; this.pickables.push(g);
    const l = this.label('<b>📜 Rule Book</b><small>tap to read</small>', 'zone'); l.position.y = 7.8; g.add(l);
    this.anim.push((dt, t) => { book.rotation.y = t * 0.6; book.position.y = 5.8 + Math.sin(t * 1.3) * 0.25; });
  }

  // ---------- stages ----------
  buildStages() {
    const dark = mat(0x22202e, { roughness: 0.6, metalness: 0.3 });
    const truss = mat(0xb7bccb, { metalness: 0.8, roughness: 0.35 });
    const coneGeo = new THREE.ConeGeometry(2.2, 11, 32, 1, true).translate(0, -5.5, 0);
    for (const s of STAGES) {
      const g = new THREE.Group(); g.position.copy(s.pos); g.rotation.y = s.angle + Math.PI; this.scene.add(g);
      const col = new THREE.Color(s.color);
      const deck = new THREE.Mesh(new THREE.BoxGeometry(13, 1.3, 7.5), dark); deck.position.set(0, 0.65, -0.5); g.add(deck);
      const lip = new THREE.Mesh(new THREE.BoxGeometry(13, 0.12, 0.12), glow(col, 3)); lip.position.set(0, 1.32, 3.25); g.add(lip);
      // LED wall with a live canvas: band name + spectrum
      const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 448;
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(11.5, 5.03), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      screen.position.set(0, 5.1, -3.9); g.add(screen);
      const back = new THREE.Mesh(new THREE.BoxGeometry(12.2, 5.7, 0.3), dark); back.position.set(0, 5.1, -4.1); g.add(back);
      for (const x of [-6.4, 6.4]) { const v = new THREE.Mesh(new THREE.BoxGeometry(0.4, 10, 0.4), truss); v.position.set(x, 5, 2.8); g.add(v); const v2 = v.clone(); v2.position.z = -4.2; g.add(v2); }
      for (const z of [2.8, -4.2]) { const h = new THREE.Mesh(new THREE.BoxGeometry(13.2, 0.4, 0.4), truss); h.position.set(0, 10, z); g.add(h); }
      for (const x of [-6.4, 6.4]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 7.4), truss); h.position.set(x, 10, -0.7); g.add(h); }
      for (const x of [-7.6, 7.6]) for (const y of [0.9, 2.5]) { const sp = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.6, 1.3), mat(0x15141c)); sp.position.set(x, y, 1.6); g.add(sp); const cone = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), mat(0x333340, { metalness: 0.6 })); cone.position.set(x, y, 2.26); g.add(cone); }
      // moving beams (additive volumetric cones)
      const cones = [];
      for (let i = 0; i < 4; i++) {
        const m = new THREE.ShaderMaterial({
          uniforms: { color: { value: col.clone().lerp(new THREE.Color(0xffffff), i % 2 ? 0.35 : 0) }, k: { value: 0.25 } },
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
          vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = -position.y/11.; vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
          fragmentShader: 'uniform vec3 color; uniform float k; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float edge = pow(abs(dot(vN, vV)), 1.6); float a = k*(1.-vY)*(1.-vY)*edge; gl_FragColor = vec4(color*a, a); }',
        });
        const piv = new THREE.Group(); piv.position.set(-4.8 + i * 3.2, 9.7, 2.6); g.add(piv);
        const c = new THREE.Mesh(coneGeo, m); c.rotation.x = -0.35; piv.add(c);
        const head = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.6, 12), mat(0x111111, { metalness: 0.6 })); piv.add(head);
        cones.push({ piv, m, ph: i * 1.7 });
      }
      // the band: four performers who groove with the music
      const performers = [];
      const pCols = [0xffffff, col.getHex(), 0xffd166, 0xb9b0d6];
      [[-3.5, -0.2], [3.4, -0.4], [-1.2, -2.2], [1.6, -2.5]].forEach(([x, z], i) => {
        const p = new THREE.Group(); p.position.set(x, 1.3, z);
        const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.7, 4, 10), mat(pCols[i])); b.position.y = 0.85; p.add(b);
        const h = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), mat(0xffe3cf)); h.position.y = 1.75; p.add(h);
        if (i < 2) { const gtr = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.32, 0.08), mat(i ? 0x2b2b2b : 0xc0392b, { roughness: 0.3 })); gtr.position.set(0, 0.85, 0.45); gtr.rotation.z = 0.5; p.add(gtr); }
        if (i === 2) { const kb = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.5), mat(0x111111)); kb.position.set(0, 0.95, 0.65); p.add(kb); }
        if (i === 3) { for (const dx of [-0.7, 0, 0.7]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.35, 16), mat(0xe8e8f0, { metalness: 0.4 })); d.position.set(dx, 0.45, 0.7); p.add(d); } }
        p.traverse(o => { if (o.isMesh) o.castShadow = true; });
        g.add(p); performers.push(p);
      });
      g.traverse(o => { if (o.isMesh && !(o.material && o.material.isShaderMaterial) && o !== screen) { o.castShadow = true; o.receiveShadow = true; } });
      // pit ring where fans and agents gather
      const ringMat = glow(col, 1.2);
      const pit = new THREE.Mesh(new THREE.RingGeometry(3.7, 4.0, 64).rotateX(-Math.PI / 2), ringMat);
      pit.position.copy(s.pit).setY(0.05); this.scene.add(pit);
      const lbl = this.label(`<b>${s.emoji} ${s.name}</b><small class="cnt">loading…</small>`, 'stage');
      lbl.position.set(0, 12.2, 0); g.add(lbl);
      lbl.element.style.setProperty('--c', s.color);
      lbl.element.addEventListener('click', () => this.onPick?.({ kind: 'stage', id: s.id }));
      deck.userData.pick = screen.userData.pick = { kind: 'stage', id: s.id };
      this.pickables.push(deck, screen);
      this.stageObjs.set(s.id, { s, g, cv, ctx: cv.getContext('2d'), tex, cones, performers, ringMat, lbl, energy: { low: 0, mid: 0, high: 0, level: 0 }, spectrum: null, info: '', drawT: 0 });
      this.drawScreen(this.stageObjs.get(s.id), 0);
    }
  }

  drawScreen(o, t) {
    const { ctx, cv, s } = o, W = cv.width, H = cv.height, e = o.energy;
    const gr = ctx.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, '#0b0816'); gr.addColorStop(1, s.color + '55');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    // light-show background: moving rings driven by the music
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const r = ((t * 40 + i * 70) % 420) * (0.9 + e.low * 0.2);
      ctx.strokeStyle = s.color + Math.round(40 + 60 * e.mid).toString(16).padStart(2, '0');
      ctx.lineWidth = 6 + e.low * 6; ctx.beginPath(); ctx.arc(W / 2, H * 0.42, r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = '700 84px "Bricolage Grotesque", system-ui, sans-serif';
    ctx.shadowColor = s.color; ctx.shadowBlur = 30 + e.level * 15;
    ctx.fillText(`${s.emoji} ${s.name}`, W / 2, 140);
    ctx.shadowBlur = 0; ctx.font = '500 36px "DM Sans", system-ui, sans-serif'; ctx.fillStyle = '#f3eefe';
    ctx.fillText(o.info || 'Live on Show Island', W / 2, 196);
    const sp = o.spectrum, n = 48, bw = W / n;
    for (let i = 0; i < n; i++) {
      const v = sp ? sp[Math.floor(i / n * sp.length)] / 255 : 0.06 + 0.04 * Math.sin(t * 2 + i * 0.4);
      const h = 8 + v * (H - 250);
      ctx.fillStyle = `hsl(${(i / n) * 80 + (t * 6) % 360}, 85%, ${55 + v * 20}%)`;
      ctx.fillRect(i * bw + 3, H - h, bw - 6, h);
    }
    o.tex.needsUpdate = true;
  }

  setStageInfo(id, info, countText) {
    const o = this.stageObjs.get(id); if (!o) return;
    if (info != null) o.info = info;
    if (countText != null) o.lbl.element.querySelector('.cnt').textContent = countText;
  }
  setStageAudio(id, energy, spectrum) {
    const o = this.stageObjs.get(id); if (!o) return;
    o.energy = energy; o.spectrum = spectrum;
  }

  // ---------- nature ----------
  buildNature() {
    const R = rng(5);
    const okMain = (x, z) => {
      const r = Math.hypot(x, z); if (r < 9 || r > MAIN_R - 2) return false;
      if (r > 18 && r < 23) return false;
      if (Math.abs(x) < 3 && z < 0) return false;
      for (const zn of ZONES) { if (Math.hypot(x - zn.building.x, z - zn.building.z) < 9.5) return false; if (Math.hypot(x - zn.yard.x, z - zn.yard.z) < 5) return false; }
      return true;
    };
    const okShow = (x, z) => {
      const dx = x - SHOW_C.x, dz = z - SHOW_C.z, r = Math.hypot(dx, dz);
      if (r < 15.5 || r > SHOW_R - 1.5) return false;
      for (const s of STAGES) if (Math.hypot(x - s.pos.x, z - s.pos.z) < 9) return false;
      if (Math.abs(x) < 3.5 && dz > 0) return false;
      return true;
    };
    const spots = [];
    for (let i = 0; i < 2000 && spots.length < 120; i++) { const a = R() * Math.PI * 2, r = R() * MAIN_R; const x = Math.sin(a) * r, z = Math.cos(a) * r; if (okMain(x, z)) spots.push([x, z, R()]); }
    for (let i = 0; i < 2000 && spots.length < 160; i++) { const a = R() * Math.PI * 2, r = R() * SHOW_R; const x = SHOW_C.x + Math.sin(a) * r, z = SHOW_C.z + Math.cos(a) * r; if (okShow(x, z)) spots.push([x, z, R(), 1]); }
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.28, 1.6, 6), mat(0x7a5236), spots.length);
    const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.25, 1), new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }), spots.length);
    const crown2 = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.9, 1), new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }), spots.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), c = new THREE.Color();
    spots.forEach(([x, z, k, show], i) => {
      const s = 0.8 + k * 0.7;
      m4.compose(new THREE.Vector3(x, 0.8 * s, z), q, sc.set(s, s, s)); trunk.setMatrixAt(i, m4);
      m4.compose(new THREE.Vector3(x, 2.4 * s, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), k * 6), sc.set(s, s * 1.1, s)); crown.setMatrixAt(i, m4);
      m4.compose(new THREE.Vector3(x + 0.3 * s, 3.4 * s, z - 0.2 * s), q, sc.set(s, s, s)); crown2.setMatrixAt(i, m4);
      c.setHSL(show ? 0.42 + k * 0.08 : 0.28 + k * 0.12, 0.5, 0.38 + k * 0.1); crown.setColorAt(i, c);
      c.offsetHSL(0, 0, 0.06); crown2.setColorAt(i, c);
      if (k > 0.86 && !show) { c.setHSL(0.9, 0.55, 0.72); crown.setColorAt(i, c); crown2.setColorAt(i, c); } // a few blossom trees
    });
    for (const m of [trunk, crown, crown2]) { m.castShadow = true; m.receiveShadow = true; this.scene.add(m); }
    if (this.qName !== 'lite') {
      const N = 9000, grass = new THREE.InstancedMesh(new THREE.ConeGeometry(0.07, 0.55, 3).translate(0, 0.27, 0), new THREE.MeshStandardMaterial({ roughness: 1 }), N);
      let k = 0;
      for (let i = 0; i < N * 3 && k < N; i++) {
        const onShow = i % 3 === 0, a = R() * Math.PI * 2, r = Math.sqrt(R()) * (onShow ? SHOW_R : MAIN_R);
        const x = (onShow ? SHOW_C.x : 0) + Math.sin(a) * r, z = (onShow ? SHOW_C.z : 0) + Math.cos(a) * r;
        if (onShow ? !okShow(x, z) : (Math.hypot(x, z) > 18.6 && Math.hypot(x, z) < 22.4) || Math.hypot(x, z) < 7.8 || (Math.abs(x) < 1.6 && z < 0)) continue;
        const s = 0.6 + R() * 0.9;
        m4.compose(new THREE.Vector3(x, 0, z), q.setFromEuler(new THREE.Euler((R() - 0.5) * 0.4, R() * 6, (R() - 0.5) * 0.4)), sc.set(1, s, 1));
        grass.setMatrixAt(k, m4); c.setHSL(0.27 + R() * 0.08, 0.55, 0.32 + R() * 0.15); grass.setColorAt(k, c); k++;
      }
      grass.count = k; grass.receiveShadow = true; this.scene.add(grass);
    }
  }

  buildFireflies() {
    const n = 320, pos = new Float32Array(n * 3), R = rng(42); this.ffBase = [];
    for (let i = 0; i < n; i++) {
      const onShow = i % 3 === 0, a = R() * Math.PI * 2, r = Math.sqrt(R()) * (onShow ? SHOW_R : MAIN_R);
      const b = [(onShow ? SHOW_C.x : 0) + Math.sin(a) * r, 0.6 + R() * 4, (onShow ? SHOW_C.z : 0) + Math.cos(a) * r, R() * 10];
      this.ffBase.push(b); pos.set(b.slice(0, 3), i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,240,180,1)'); gr.addColorStop(0.25, 'rgba(255,210,120,.6)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    this.ff = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.9, map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffe2a0 }));
    this.scene.add(this.ff);
    this.anim.push((dt, t) => {
      const p = this.ff.geometry.attributes.position;
      for (let i = 0; i < n; i++) { const b = this.ffBase[i]; p.setXYZ(i, b[0] + Math.sin(t * 0.4 + b[3]) * 1.5, b[1] + Math.sin(t * 0.9 + b[3] * 2) * 0.5, b[2] + Math.cos(t * 0.35 + b[3]) * 1.5); }
      p.needsUpdate = true;
      this.ff.material.opacity = this.tod === 'day' ? 0.15 : 0.55 + Math.sin(t * 2) * 0.15;
    });
  }

  // ---------- helpers ----------
  label(html, cls = '', prio = 1) {
    const d = document.createElement('div'); d.className = 'lbl ' + cls; d.innerHTML = html;
    const o = new CSS2DObject(d); this.labelReg.push({ el: d, obj: o, prio: typeof prio === 'function' ? prio : () => prio });
    return o;
  }
  unregisterLabel(o) { this.labelReg = this.labelReg.filter(l => l.obj !== o); }
  textPlane(text, color, w, h) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = Math.round(512 * h / w);
    const x = cv.getContext('2d'); x.fillStyle = '#1b1430'; x.fillRect(0, 0, cv.width, cv.height);
    x.font = `700 ${Math.round(cv.height * 0.55)}px system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = color; x.shadowBlur = 18; x.fillStyle = color; x.fillText(text, cv.width / 2, cv.height / 2);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
  }

  setupComposer() {
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: this.q.msaa });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.45, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  setQuality(name) {
    if (!QUALITY[name]) return;
    this.qName = name; this.q = QUALITY[name];
    const was = this.renderer.shadowMap.enabled;
    this.renderer.shadowMap.enabled = this.q.shadows;
    if (was !== this.q.shadows) this.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
    this.sunLight.shadow.mapSize.set(this.q.shadow, this.q.shadow);
    for (const rt of [this.composer.renderTarget1, this.composer.renderTarget2]) { if (rt && rt.samples !== this.q.msaa) { rt.samples = this.q.msaa; rt.dispose(); } }
    if (this.sunLight.shadow.map) { this.sunLight.shadow.map.dispose(); this.sunLight.shadow.map = null; }
    this.resize();
    this.ui?.setQuality?.(name);
  }

  resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return; // fix F6: never size buffers to zero
    this.renderer.setPixelRatio(this.q.dpr);
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(this.q.dpr); this.composer.setSize(w, h);
    this.bloom.resolution.set(w * this.q.dpr / 2, h * this.q.dpr / 2);
    this.labels.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  setupPicking() {
    const ray = new THREE.Raycaster(), v = new THREE.Vector2(), el = this.renderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; this.cancelFly(); });
    el.addEventListener('pointerup', e => {
      if (!down) return; const d = Math.hypot(e.clientX - down[0], e.clientY - down[1]); down = null; if (d > 6) return;
      const rc = el.getBoundingClientRect();
      v.set((e.clientX - rc.left) / rc.width * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
      ray.setFromCamera(v, this.camera);
      for (const h of ray.intersectObjects(this.pickables, true)) {
        let o = h.object; while (o && !o.userData.pick) o = o.parent;
        if (o) { this.onPick?.(o.userData.pick); return; }
      }
      this.onPick?.(null);
    });
  }

  flyTo(target, dist = 22, height = 11, dur = 1.4) {
    this.follow = null;
    const dir = this.camera.position.clone().sub(this.controls.target).setY(0);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1); dir.normalize();
    const toT = target.clone(); toT.y += 1.5;
    this.fly = { fp: this.camera.position.clone(), ft: this.controls.target.clone(), toT, toP: toT.clone().addScaledVector(dir, dist).setY(toT.y + height), t: 0, dur };
  }
  flyToStage(id) { const s = STAGES.find(x => x.id === id); if (!s) return; const dir = s.pit.clone().sub(s.pos).setY(0).normalize(); this.follow = null; const toT = s.pos.clone().setY(4.5); this.fly = { fp: this.camera.position.clone(), ft: this.controls.target.clone(), toT, toP: s.pit.clone().addScaledVector(dir, 12).setY(9), t: 0, dur: 1.6 }; }
  home() { this.follow = null; this.fly = { fp: this.camera.position.clone(), ft: this.controls.target.clone(), toT: new THREE.Vector3(0, 2, -18), toP: new THREE.Vector3(62, 48, 58), t: 0, dur: 1.6 }; }
  installPhoneControls() {
    const pad = document.getElementById('lookpad');
    const zin = document.getElementById('z-in');
    const zout = document.getElementById('z-out');
    const knob = pad?.querySelector('.knob');
    if (!pad) return;
    const c = this.controls;
    let dragging = false, ox = 0, oy = 0, kx = 0, ky = 0;
    const onDown = (e) => {
      e.preventDefault();
      dragging = true;
      ox = e.clientX; oy = e.clientY;
      try { pad.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    };
    const onMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - ox, dy = e.clientY - oy;
      ox = e.clientX; oy = e.clientY;
      c.setAzimuthalAngle(c.getAzimuthalAngle() - dx * 0.01);
      c.setPolarAngle(Math.min(c.maxPolarAngle, Math.max(0.05, c.getPolarAngle() + dy * 0.008)));
      c.update();
      if (knob) {
        kx = Math.max(-28, Math.min(28, kx + dx * 0.35));
        ky = Math.max(-28, Math.min(28, ky + dy * 0.35));
        knob.style.transform = `translate(${kx}px,${ky}px)`;
      }
    };
    const onUp = () => { dragging = false; kx = 0; ky = 0; if (knob) knob.style.transform = ''; };
    pad.addEventListener('pointerdown', onDown);
    pad.addEventListener('pointermove', onMove);
    pad.addEventListener('pointerup', onUp);
    pad.addEventListener('pointercancel', onUp);
    const zoom = (factor) => {
      const cam = this.camera, tg = c.target;
      const dir = cam.position.clone().sub(tg).multiplyScalar(factor);
      const next = tg.clone().add(dir);
      const dist = next.distanceTo(tg);
      if (dist < c.minDistance || dist > c.maxDistance) return;
      cam.position.copy(next); c.update();
    };
    zin?.addEventListener('click', () => zoom(0.82));
    zout?.addEventListener('click', () => zoom(1.22));
  }
  cancelFly() { this.fly = null; }
  vtestStart(frames = 90) { const v = this.vtest; if (!v) return false; v.t = 0; v.left = frames; v.stopped = v.done = false; for (const o of this.stageObjs.values()) o.sweep = 0; return true; }
  metrics() { let meshes = 0, casters = 0, instanced = 0, batched = 0; this.scene.traverse(o => { if (o.isMesh) { meshes++; if (o.castShadow) casters++; if (o.isInstancedMesh) instanced++; if (o.userData.batched) batched++; } }); const i = this.renderer.info; return { meshes, casters, instanced, batched, opt: [...this.opt], quality: this.qName, calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures }; }
  setFollow(obj) { this.fly = null; this.follow = null; if (!obj) return; this.flyTo(obj.position, 14, 7, 0.9); this.follow = obj; this.followLast = obj.position.clone(); }

  declutter() {
    const items = [];
    for (const L of this.labelReg) {
      const el = L.el; if (!el.isConnected || el.style.display === 'none') continue;
      const r = el.getBoundingClientRect(); if (!r.width) continue;
      items.push({ el, r, p: L.prio() });
    }
    items.sort((a, b) => b.p - a.p);
    const placed = [];
    for (const it of items) {
      const hit = placed.some(q => !(it.r.right < q.left || it.r.left > q.right || it.r.bottom < q.top || it.r.top > q.bottom));
      it.el.classList.toggle('hid', hit);
      if (!hit) placed.push(it.r);
    }
  }

  frame() {
    let dt, t;
    if (this.vtest) { const v = this.vtest; if (v.stopped) return; if (v.left !== null && --v.left < 0) { v.stopped = v.done = true; return; } dt = 1 / 30; v.t += dt; t = v.t; }
    else { dt = Math.min(this.clock.getDelta(), 0.1); t = this.clock.elapsedTime; }
    if (!this.host.clientWidth || !this.host.clientHeight) return; // fix F6
    if (this.fly) {
      const f = this.fly; f.t += dt / f.dur; const k = f.t >= 1 ? 1 : f.t < 0.5 ? 4 * f.t ** 3 : 1 - (-2 * f.t + 2) ** 3 / 2;
      this.camera.position.lerpVectors(f.fp, f.toP, k); this.controls.target.lerpVectors(f.ft, f.toT, k);
      if (f.t >= 1) { this.fly = null; if (this.follow) this.followLast.copy(this.follow.position); }
    } else if (this.follow) {
      const p = this.follow.position, d = p.clone().sub(this.followLast); this.followLast.copy(p);
      this.camera.position.add(d); this.controls.target.lerp(p.clone().setY(p.y + 1.5), 0.15);
    }
    this.controls.update();
    const tg = this.controls.target, dir = this.tod === 'night' ? new THREE.Vector3(0.3, 1, 0.25) : this.sun.clone();
    dir.y = Math.max(dir.y, 0.5); dir.normalize();
    this.sunLight.position.copy(tg).addScaledVector(dir, 160); this.sunLight.target.position.copy(tg);
    this.cloudMat.uniforms.time.value = t;
    for (const f of this.anim) f(dt, t);
    this.onTick?.(dt, t);
    const camP = this.camera.position, scr = this.opt.has('screens');
    if (scr) { this._pm.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse); this.frustum.setFromProjectionMatrix(this._pm); }
    for (const o of this.stageObjs.values()) {
      const d = camP.distanceTo(o.s.pos), e = o.energy;
      const near = scr ? d < 90 && this.frustum.intersectsSphere(o.sphere || (o.sphere = new THREE.Sphere(o.s.pos.clone().setY(5), 8))) : d < 130;
      // Fix for the hyperactive lights: the old code used sin(t * (0.6 + energy)), so every energy flicker
      // jumped the phase by t × Δenergy (huge after a few minutes). Now the sweep phase is integrated at a
      // tempo-locked rate (one slow sweep per two bars), energy is pre-smoothed in audio.js, and brightness
      // only breathes gently on the beat.
      const beatHz = e.bpm ? e.bpm / 60 : 0.5, pulse = e.bpm ? Math.exp(-(e.beat || 0) * 5) : 0;
      o.sweep = (o.sweep || 0) + dt * beatHz * Math.PI / 4;
      o.cones.forEach((c, i) => {
        c.piv.rotation.z = Math.sin(o.sweep + c.ph) * 0.42;
        c.piv.rotation.x = Math.cos(o.sweep * 0.5 + c.ph) * 0.16;
        c.m.uniforms.k.value = (this.tod === 'day' ? 0.06 : 0.15) + e.level * 0.32 + pulse * e.level * 0.15 + (i % 2 ? e.high : e.low) * 0.08;
      });
      o.ringMat.emissiveIntensity = 0.9 + e.low * 1.1 + pulse * e.level * 0.4;
      o.performers.forEach((p, i) => { p.position.y = 1.3 + (e.bpm ? Math.sin(Math.PI * (e.beat || 0)) * 0.09 * (0.4 + e.level) : Math.sin(t * 2 + i) * 0.02); p.rotation.y = Math.sin(o.sweep * 0.5 + i) * 0.25; });
      if (near) { o.drawT -= dt; if (o.drawT <= 0) { o.drawT = scr ? 1 / 15 : 1 / 20; this.drawScreen(o, t); } }
    }
    if (this.q.bloom) this.composer.render(); else this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
    this.declT -= dt; if (this.declT <= 0) { this.declT = 0.3; this.declutter(); }
    this.fpsT += dt; this.fpsN++;
    if (this.fpsT >= 1) {
      const fps = Math.round(this.fpsN / this.fpsT); this.fpsT = 0; this.fpsN = 0;
      this.ui?.setFps?.(fps, this.qName);
      if (!this.lockq && fps < 38 && this.qName !== 'lite' && t > 8) { if (++this.slowFor >= 4) { this.slowFor = 0; this.setQuality(this.qName === 'high' ? 'medium' : 'lite'); this.ui?.toast?.('🐢', 'Switched to ' + this.qName + ' graphics', 'To keep things smooth. Change it under Graphics.'); } }
      else this.slowFor = 0;
    }
  }
}
