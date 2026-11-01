// Agent World · Claude Edition (v2.0, Keystone build) — agents.js
// Avatars, accessories, walking (incl. zip-line legs), speech, Show Buddies fans, and the simulation director.
// Everything here is a labelled simulation unless a live bridge is connected (see main.js).
import { THREE, CSS2DObject, ZONES, STAGES, SHOW_C, BRIDGE_MAIN, BRIDGE_SHOW, islandOf, groundY, polar, mat, rng } from './world.js';

const R = (...a) => Math.random(...a); // late-bound so the ?vtest=1 seeded Math.random applies
const VTEST = typeof location !== 'undefined' && new URLSearchParams(location.search).has('vtest');
const pick = a => a[Math.floor(R() * a.length)];
const wait = s => new Promise(r => setTimeout(r, s * 1000));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const zone = id => ZONES.find(z => z.id === id);
const COUNCIL = zone('council');
const readable = c => { const hsl = {}; new THREE.Color(c).getHSL(hsl); return hsl.l < 0.35 ? '#c4b5fd' : c; }; // dark avatars (Smarth Vader) stay legible in the feed
function floorY(p) { return groundY(p) + (Math.hypot(p.x - COUNCIL.building.x, p.z - COUNCIL.building.z) < 7.8 ? 1 : 0); }

// ---------- accessories ----------
const G = {
  body: new THREE.CapsuleGeometry(0.55, 0.75, 6, 18), head: new THREE.SphereGeometry(0.5, 28, 18),
  eye: new THREE.SphereGeometry(0.12, 14, 10), pupil: new THREE.SphereGeometry(0.065, 10, 8), foot: new THREE.CapsuleGeometry(0.16, 0.2, 4, 8),
};
const glowM = (c, k = 2) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k, roughness: 0.4 });
const M = (c, o) => mat(c, o);
function box(w, h, d, m) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); }
function cyl(rt, rb, h, m, s = 20) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), m); }
let BP_TEX = null;
function blueprintTex() { // shared canvas texture: a tiny venue floor plan on blueprint paper (Keystone Claude's tablet)
  if (BP_TEX) return BP_TEX;
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 180; const x = cv.getContext('2d');
  x.fillStyle = '#0b2a4a'; x.fillRect(0, 0, 256, 180);
  x.strokeStyle = 'rgba(126,240,228,.25)'; x.lineWidth = 1;
  for (let i = 0; i <= 256; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 180); x.stroke(); }
  for (let j = 0; j <= 180; j += 16) { x.beginPath(); x.moveTo(0, j); x.lineTo(256, j); x.stroke(); }
  x.strokeStyle = '#7ef0e4'; x.lineWidth = 3; x.strokeRect(78, 18, 100, 34);
  x.beginPath(); x.arc(128, 52, 96, 0.25 * Math.PI, 0.75 * Math.PI); x.stroke(); x.strokeRect(116, 128, 24, 18);
  x.fillStyle = '#ffb08f'; for (const [px, py] of [[84, 104], [172, 104]]) { x.beginPath(); x.arc(px, py, 7, 0, Math.PI * 2); x.fill(); }
  x.fillStyle = '#e6f6ff'; x.font = '700 18px system-ui, sans-serif'; x.fillText('v2', 12, 166);
  BP_TEX = new THREE.CanvasTexture(cv); BP_TEX.colorSpace = THREE.SRGBColorSpace; return BP_TEX;
}

export const ACCESSORIES = {
  spark(g, a) { // Conscious Claude: a slowly turning eight-point starburst halo + clipboard
    const s = new THREE.Group(); s.position.y = 3.05; const m = glowM(0xff9a6b, 2.6);
    for (let i = 0; i < 8; i++) { const r = box(0.07, i % 2 ? 0.42 : 0.62, 0.07, m); r.rotation.z = i * Math.PI / 4; s.add(r); }
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), glowM(0xffe0c8, 4)); s.add(core);
    g.add(s); a.push((dt, t) => { s.rotation.z = t * 0.6; s.rotation.y = Math.sin(t * 0.8) * 0.4; s.position.y = 3.05 + Math.sin(t * 2) * 0.06; });
    const cb = box(0.42, 0.56, 0.05, M(0x8a5a3c)); cb.position.set(0.66, 1.15, 0.3); cb.rotation.set(-0.3, -0.4, 0.15); g.add(cb);
    const pg = box(0.34, 0.42, 0.02, M(0xffffff)); pg.position.set(0.68, 1.16, 0.33); pg.rotation.copy(cb.rotation); g.add(pg);
  },
  tophat(g) { const m = M(0x16141f); const b = cyl(0.55, 0.55, 0.05, m); b.position.y = 2.5; const c = cyl(0.33, 0.35, 0.55, m); c.position.y = 2.8; const band = cyl(0.355, 0.355, 0.1, M(0xffd166)); band.position.y = 2.6; g.add(b, c, band); },
  crown(g, a, d) {
    const m = M(0xffcf4a, { metalness: 0.9, roughness: 0.25 }); const base = cyl(0.36, 0.38, 0.22, m, 24); base.position.y = 2.55; g.add(base);
    for (let i = 0; i < 6; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.26, 6), m); const t = i / 6 * Math.PI * 2; sp.position.set(Math.sin(t) * 0.33, 2.78, Math.cos(t) * 0.33); g.add(sp); const gem = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), glowM(i % 2 ? 0xff4d8d : 0x7ef0e4, 1.6)); gem.position.set(Math.sin(t) * 0.38, 2.55, Math.cos(t) * 0.38); g.add(gem); }
  },
  bulb(g, a) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), glowM(0xfff1a6, 2.5)); const s = cyl(0.1, 0.12, 0.14, M(0x9aa0aa, { metalness: 0.8 })); const grp = new THREE.Group(); b.position.y = 0.16; grp.add(b, s); grp.position.y = 2.95; g.add(grp); a.push((dt, t) => { grp.position.y = 2.95 + Math.sin(t * 2.2) * 0.08; b.material.emissiveIntensity = 2 + Math.sin(t * 5) * 0.6; }); },
  briefcase(g) { const c = box(0.5, 0.36, 0.14, M(0x6b4423)); c.position.set(0.72, 0.75, 0); const h = box(0.18, 0.06, 0.06, M(0x3b2614)); h.position.set(0.72, 0.96, 0); g.add(c, h); },
  propeller(g, a) { const cap = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0xff6fb1)); cap.position.y = 2.28; const p = new THREE.Group(); p.position.y = 2.78; p.add(box(0.9, 0.03, 0.12, M(0xffd166)), cyl(0.03, 0.03, 0.12, M(0x333333), 6)); g.add(cap, p); a.push((dt, t) => { p.rotation.y = t * 9; }); },
  heart(g, a) { const h = new THREE.Group(), m = glowM(0xff5c93, 1.4); const l = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), m); l.position.x = -0.1; const r = l.clone(); r.position.x = 0.1; const c = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.3, 12), m); c.rotation.z = Math.PI; c.position.y = -0.14; h.add(l, r, c); h.position.y = 2.95; g.add(h); a.push((dt, t) => { const s = 1 + Math.max(0, Math.sin(t * 6)) * 0.15; h.scale.set(s, s, s); h.rotation.y = t; }); },
  donut(g, a) { const d = new THREE.Group(); const dough = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.1, 10, 20), M(0xd9a066)); const ice = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.08, 10, 20), M(0xff6fae)); ice.position.z = 0.04; d.add(dough, ice); d.position.y = 2.95; g.add(d); a.push((dt, t) => { d.rotation.y = t * 1.5; d.position.y = 2.95 + Math.sin(t * 2) * 0.06; }); },
  megaphone(g) { const m = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 14, 1, true), M(0xffffff, { side: THREE.DoubleSide })); m.rotation.z = Math.PI / 2; m.position.set(0.85, 1.4, 0.2); g.add(m); },
  camera(g) { const c = box(0.42, 0.3, 0.5, M(0x1d1d26, { metalness: 0.5, roughness: 0.3 })); c.position.set(0.55, 1.75, 0.15); const l = cyl(0.11, 0.13, 0.22, M(0x0b0b0f)); l.rotation.x = Math.PI / 2; l.position.set(0.55, 1.75, 0.48); const r = new THREE.Mesh(new THREE.SphereGeometry(0.04), glowM(0xff3355, 3)); r.position.set(0.7, 1.92, 0.2); g.add(c, l, r); },
  magnifier(g) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 8, 20), M(0x333344, { metalness: 0.7 })); r.position.set(0.75, 1.6, 0.3); const glass = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20), new THREE.MeshPhysicalMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.5 })); glass.position.copy(r.position); const h = cyl(0.03, 0.03, 0.35, M(0x6b4423), 8); h.position.set(0.82, 1.32, 0.3); h.rotation.z = 0.3; g.add(r, glass, h); },
  envelope(g, a) { const e = new THREE.Group(); e.add(box(0.5, 0.32, 0.04, M(0xffffff))); const f = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.2, 3), M(0xe3e8f5)); f.rotation.set(Math.PI / 2, 0, Math.PI); f.position.set(0, 0.05, 0.03); f.scale.z = 0.2; e.add(f); e.position.y = 2.98; g.add(e); a.push((dt, t) => { e.rotation.y = Math.sin(t) * 0.5; }); },
  coin(g, a) { const c = cyl(0.22, 0.22, 0.06, M(0xffcf4a, { metalness: 1, roughness: 0.2 }), 24); c.rotation.x = Math.PI / 2; c.position.y = 2.98; g.add(c); a.push((dt, t) => { c.rotation.z = t * 3; }); },
  check(g, a) { const c = new THREE.Group(), m = glowM(0x84cc16, 1.2); const s1 = box(0.1, 0.24, 0.08, m); s1.position.set(-0.1, -0.04, 0); s1.rotation.z = 0.8; const s2 = box(0.1, 0.46, 0.08, m); s2.position.set(0.09, 0.06, 0); s2.rotation.z = -0.6; c.add(s1, s2); c.position.y = 2.98; g.add(c); a.push((dt, t) => { c.rotation.y = t * 1.2; }); },
  plane(g, a) { const p = new THREE.Group(), m = M(0xffffff); p.add(box(0.5, 0.1, 0.1, m)); const w = box(0.12, 0.03, 0.6, M(0x60a5fa)); p.add(w); const tl = box(0.08, 0.16, 0.03, M(0x60a5fa)); tl.position.set(-0.22, 0.07, 0); p.add(tl); g.add(p); a.push((dt, t) => { p.position.set(Math.cos(t * 1.4) * 0.8, 2.9 + Math.sin(t * 2.8) * 0.1, Math.sin(t * 1.4) * 0.8); p.rotation.y = -t * 1.4 - Math.PI / 2; }); },
  hardhat(g) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.44, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0xfacc15, { roughness: 0.35 })); h.position.y = 2.32; const b = cyl(0.56, 0.56, 0.04, M(0xfacc15)); b.position.y = 2.33; g.add(h, b); },
  bolt(g, a) { const b = new THREE.Group(), m = glowM(0xff8a1f, 2); const p1 = box(0.1, 0.32, 0.07, m); p1.position.set(0.04, 0.12, 0); p1.rotation.z = -0.4; const p2 = box(0.1, 0.32, 0.07, m); p2.position.set(-0.04, -0.12, 0); p2.rotation.z = -0.4; const mid = box(0.2, 0.08, 0.07, m); b.add(p1, p2, mid); b.position.y = 2.98; g.add(b); a.push((dt, t) => { b.rotation.y = t * 2; }); },
  glasses(g) { const m = M(0x111111); for (const x of [-0.18, 0.18]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.022, 6, 18), m); r.position.set(x, 2.12, 0.47); g.add(r); } const br = box(0.12, 0.02, 0.02, m); br.position.set(0, 2.14, 0.48); g.add(br); },
  cross(g, a) { const c = new THREE.Group(), m = glowM(0xff3b3b, 1.5); const s1 = box(0.08, 0.42, 0.08, m); s1.rotation.z = 0.785; const s2 = s1.clone(); s2.rotation.z = -0.785; c.add(s1, s2); c.position.y = 2.98; g.add(c); a.push((dt, t) => { c.rotation.y = Math.sin(t * 2) * 0.8; }); },
  atom(g, a) { const at = new THREE.Group(), m = glowM(0x22d3ee, 1.6); at.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), glowM(0xffffff, 2))); for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.015, 6, 32), m); r.rotation.set(i * 1.05, i * 0.6, 0); at.add(r); } at.position.y = 3.0; g.add(at); a.push((dt, t) => { at.rotation.y = t * 1.3; at.rotation.x = t * 0.7; }); },
  helmet(g) { // Smarth Vader: glossy black dome, face grille, shoulder cape
    const m = M(0x0d0c12, { metalness: 0.6, roughness: 0.18 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.56, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), m); dome.position.y = 2.1; g.add(dome);
    const flare = cyl(0.6, 0.66, 0.22, m, 24); flare.position.y = 1.78; g.add(flare);
    const grill = box(0.28, 0.2, 0.08, M(0x2a2a33, { metalness: 0.8 })); grill.position.set(0, 1.86, 0.52); g.add(grill);
    for (const x of [-0.18, 0.18]) { const lens = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), glowM(0xff3355, 0.8)); lens.position.set(x, 2.13, 0.46); lens.scale.z = 0.5; g.add(lens); }
  },
  keystone(g, a) { // Keystone Claude: white builder's helmet with a Claude-orange ridge, a glowing keystone above it, and a hovering blueprint tablet
    const white = M(0xf8f5ee, { roughness: 0.3 });
    const hat = new THREE.Mesh(new THREE.SphereGeometry(0.46, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), white); hat.position.y = 2.3;
    const brim = cyl(0.58, 0.58, 0.05, white); brim.position.y = 2.31;
    const ridge = box(0.09, 0.1, 0.9, M(0xd97757)); ridge.position.y = 2.73; g.add(hat, brim, ridge);
    const sh = new THREE.Shape(); sh.moveTo(-0.17, -0.2); sh.lineTo(0.17, -0.2); sh.lineTo(0.26, 0.2); sh.lineTo(-0.26, 0.2); sh.closePath();
    const ks = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false }).translate(0, 0, -0.06), glowM(0xff9a6b, 2.4)); ks.position.y = 3.2; g.add(ks);
    const tab = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.44), new THREE.MeshBasicMaterial({ map: blueprintTex(), transparent: true, opacity: 0.88, side: THREE.DoubleSide, depthWrite: false }));
    tab.position.set(0.8, 1.55, 0.35); tab.rotation.set(-0.5, -0.6, 0); g.add(tab);
    a.push((dt, t) => { ks.rotation.y = t * 0.9; ks.position.y = 3.2 + Math.sin(t * 1.7) * 0.07; tab.position.y = 1.55 + Math.sin(t * 2.3) * 0.04; });
  },
  cap(g) { const m = M(0x1e3a8a); const c = new THREE.Mesh(new THREE.SphereGeometry(0.47, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), m); c.position.y = 2.25; const b = box(0.5, 0.04, 0.4, m); b.position.set(0, 2.27, -0.5); g.add(c, b); },
  none() {},
};

function cape(g, color) {
  const geo = new THREE.PlaneGeometry(1.1, 1.5, 4, 6); geo.translate(0, -0.75, 0);
  const c = new THREE.Mesh(geo, M(color, { side: THREE.DoubleSide, roughness: 0.8 })); c.position.set(0, 1.75, -0.5); c.rotation.x = 0.12; c.castShadow = true; g.add(c);
  return c;
}

export function buildAvatar(d, scale = 1) {
  const g = new THREE.Group(), anims = [];
  const col = new THREE.Color(d.color);
  const body = new THREE.Mesh(G.body, M(col, { roughness: 0.5 })); body.position.y = 1.0;
  const head = new THREE.Mesh(G.head, M(col.clone().lerp(new THREE.Color(0xffffff), 0.22), { roughness: 0.45 })); head.position.y = 2.05;
  const eyeM = M(0xffffff, { roughness: 0.2 }), pupM = M(0x111111, { roughness: 0.2 });
  for (const x of [-0.18, 0.18]) { const e = new THREE.Mesh(G.eye, eyeM); e.position.set(x, 2.12, 0.41); const p = new THREE.Mesh(G.pupil, pupM); p.position.set(x, 2.12, 0.51); g.add(e, p); }
  const feet = [-0.22, 0.22].map(x => { const f = new THREE.Mesh(G.foot, M(0x2a2238)); f.rotation.x = Math.PI / 2; f.position.set(x, 0.16, 0.08); g.add(f); return f; });
  g.add(body, head);
  for (const p of [body, head, ...feet]) p.userData.dynamic = true; // walk/dance animate these: never batch them
  if (d.cape) { anims.capeMesh = cape(g, d.cape); anims.capeMesh.userData.dynamic = true; }
  (ACCESSORIES[d.acc] || ACCESSORIES.none)(g, anims, d);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.scale.setScalar(scale);
  g.userData.parts = { body, head, feet };
  return { g, anims };
}

// Daniel's Show Buddies cast → accessory + color, so fans keep their chosen agent look.
const CAST = { ernie: ['propeller', '#f0abfc'], bigern: ['camera', '#c084fc'], phishbot: ['donut', '#dc2626'], travelbot: ['plane', '#60a5fa'], tasky: ['check', '#a3e635'], gordo: ['bolt', '#f97316'], helperbot: ['heart', '#fde2c4'], chairman: ['crown', '#7c3aed'], claude: ['spark', '#d97757'], chatgpt: ['none', '#10a37f'], grok: ['none', '#111827'], gemini: ['none', '#4285f4'], muse: ['none', '#0866ff'], meta: ['none', '#0866ff'] };

// ---------- obstacle-aware routing ----------
// Expansion packs can add travel legs (for example a zip line to their island): hook(from, to, baseRoute) returns
// an array of legs or null. A leg is a THREE.Vector3 (walk there) or { ride: THREE.Curve, dur: seconds }.
export const ROUTE_HOOKS = [];
const OBST = [{ c: new THREE.Vector3(0, 0, 0), r: 2.6 }, ...ZONES.filter(z => z.id !== 'council').map(z => ({ c: z.building, r: 7 })), { c: COUNCIL.building, r: 0 }];
function detour(a, b) {
  for (const o of OBST) {
    if (!o.r) continue;
    const ab = b.clone().sub(a); const L = ab.lengthSq(); if (L < 1e-6) continue;
    const t = THREE.MathUtils.clamp(o.c.clone().sub(a).dot(ab) / L, 0, 1); const p = a.clone().addScaledVector(ab, t);
    const dv = p.clone().sub(o.c).setY(0); const d = dv.length();
    if (d < o.r && t > 0.02 && t < 0.98) { if (d < 1e-3) dv.set(-ab.z, 0, ab.x); dv.normalize(); return o.c.clone().addScaledVector(dv, o.r + 1.2).setY(0); }
  }
  return null;
}
function route(from, to) { for (const h of ROUTE_HOOKS) { const r = h(from, to, baseRoute); if (r) return r; } return baseRoute(from, to); }
export function baseRoute(from, to) {
  const a = islandOf(from), b = islandOf(to), pts = [];
  if (a !== b) {
    const toShow = b === 'show' || (b === 'bridge' && a === 'main');
    if (toShow) { if (a === 'main') pts.push(BRIDGE_MAIN.clone()); pts.push(BRIDGE_SHOW.clone()); }
    else { if (a === 'show') pts.push(BRIDGE_SHOW.clone()); pts.push(BRIDGE_MAIN.clone()); }
  }
  pts.push(to.clone());
  const out = []; let prev = from.clone();
  for (const p of pts) { let d = detour(prev, p), guard = 0; while (d && guard++ < 2) { out.push(d); prev = d; d = detour(prev, p); } out.push(p); prev = p; }
  return out;
}

// ---------- Agent ----------
export class Agent {
  constructor(def, sim, opts = {}) {
    this.def = def; this.key = def.key; this.name = def.name; this.sim = sim;
    const { g, anims } = buildAvatar(def, opts.scale || 1);
    this.obj = g; this.anims = anims; this.pos = g.position; this.capeMesh = anims.capeMesh; g.userData.dynamic = true; // never batch an avatar away from its group
    this.path = []; this.speed = (def.group === 'character' ? 3.4 : 3.8) + R() * 0.8;
    this.busy = null; this.activity = 'Arriving'; this.bubbleUntil = 0; this.phase = R() * 10; this.wanderT = 2 + R() * 6; this.dance = false;
    this.posts = [];
    const el = document.createElement('div'); el.className = 'ag' + (def.group === 'character' ? ' char' : '') + (def.key === 'conscious-claude' ? ' cc' : '') + (def.key === 'keystone-claude' ? ' ks' : '') + (opts.fan ? ' fan' : '');
    el.style.setProperty('--c', def.color);
    el.innerHTML = `<div class="bub" hidden></div><button class="nm" type="button">${esc(opts.label || def.name)}</button>`;
    this.el = el; this.bub = el.querySelector('.bub');
    el.querySelector('.nm').addEventListener('click', () => sim.world.onPick?.({ kind: opts.fan ? 'fan' : 'agent', id: this.key }));
    this.lbl = new CSS2DObject(el); this.lbl.position.y = 2.75 + (def.acc && def.acc !== 'none' ? 0.55 : 0); g.add(this.lbl);
    sim.world.labelReg.push({ el, obj: this.lbl, prio: () => (sim.selected === this ? 9 : this.bubbleUntil > performance.now() ? 4 : this.key === 'conscious-claude' || this.key === 'keystone-claude' ? 3 : def.group === 'character' ? 2.5 : opts.fan ? 0.5 : 1) });
    g.userData.pick = { kind: opts.fan ? 'fan' : 'agent', id: this.key };
    sim.world.pickables.push(g); sim.world.scene.add(g);
  }
  place(p) { this.pos.copy(p); this.pos.y = floorY(p); }
  walkTo(p, activity) {
    if (activity) this.activity = activity;
    clearTimeout(this.walkTimeout); const prev = this.arrive; this.arrive = null; prev?.(false);
    this.path = route(this.pos, p);
    let est = 0, at = this.pos.clone(); for (const L of this.path) { if (L.ride) est += L.dur; else { est += at.distanceTo(L) / this.speed; at = L; } }
    const ms = Math.max(45, est * 1.6 + 8) * 1000; // long trips (zip line to Moon Palace) get a proportionally longer timeout
    return new Promise(res => { this.arrive = res; this.walkTimeout = setTimeout(() => { if (this.arrive === res) { this.path = []; this.arrive = null; res(false); } }, ms); });
  }
  say(text, dur = 3.4) {
    this.bub.textContent = text; this.bub.hidden = false; this.bubbleUntil = performance.now() + dur * 1000;
    clearTimeout(this.bubT); this.bubT = setTimeout(() => { this.bub.hidden = true; this.bubbleUntil = 0; }, dur * 1000);
  }
  update(dt, t) {
    const parts = this.obj.userData.parts;
    if (this.path.length && this.path[0].ride) { // riding a zip line: follow the curve, feet dangle
      const L = this.path[0]; L.u = (L.u || 0) + dt / L.dur; const u = Math.min(1, L.u), k = L.rev ? 1 - u : u;
      const p = L.ride.getPoint(k), tg = L.ride.getTangent(k); this.pos.copy(p);
      this.obj.rotation.y = Math.atan2(L.rev ? -tg.x : tg.x, L.rev ? -tg.z : tg.z);
      parts.feet[0].position.z = 0.08 + Math.sin(t * 4 + this.phase) * 0.12; parts.feet[1].position.z = 0.08 - Math.sin(t * 4 + this.phase) * 0.12;
      if (u >= 1) { this.path.shift(); if (!this.path.length) { clearTimeout(this.walkTimeout); const a = this.arrive; this.arrive = null; a?.(true); } }
      for (const f of this.anims) f(dt, t + this.phase);
      return;
    }
    if (this.path.length) {
      const target = this.path[0], d = target.clone().sub(this.pos).setY(0), dist = d.length();
      const step = this.speed * dt;
      if (dist <= step) { this.pos.x = target.x; this.pos.z = target.z; this.path.shift(); if (!this.path.length) { clearTimeout(this.walkTimeout); const a = this.arrive; this.arrive = null; a?.(true); } }
      else { d.normalize(); this.pos.addScaledVector(d, step); const yaw = Math.atan2(d.x, d.z); let dy = yaw - this.obj.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.obj.rotation.y += dy * Math.min(1, dt * 10); }
      this.pos.y = floorY(this.pos) + Math.abs(Math.sin(t * 9 + this.phase)) * 0.12;
      parts.feet[0].position.z = 0.08 + Math.sin(t * 9 + this.phase) * 0.18; parts.feet[1].position.z = 0.08 - Math.sin(t * 9 + this.phase) * 0.18;
      parts.body.rotation.z = Math.sin(t * 9 + this.phase) * 0.05;
    } else {
      const bpmK = this.dance ? (this.sim.energyAt(this.pos) || 0.3) : 0;
      this.pos.y = floorY(this.pos) + (this.dance ? Math.abs(Math.sin(t * 7.5 + this.phase)) * (0.12 + bpmK * 0.35) : Math.sin(t * 2 + this.phase) * 0.03);
      parts.body.rotation.z = this.dance ? Math.sin(t * 3.75 + this.phase) * 0.12 : 0;
      parts.head.rotation.y = Math.sin(t * 0.7 + this.phase) * 0.35;
    }
    if (this.capeMesh) this.capeMesh.rotation.x = 0.12 + (this.path.length ? 0.35 : 0) + Math.sin(t * 3 + this.phase) * 0.05;
    for (const f of this.anims) f(dt, t + this.phase);
  }
}

// ---------- scripted content ----------
const TASKS = {
  product: [
    { ask: 'a 30-second onboarding for Show Buddies', tag: 'roadmap', reply: "On it. Spec by Friday.", sp: 'botbuild', spLine: 'Scaffolded the onboarding flow. Tests are green.' },
    { ask: 'stop duplicate posts on Show Island', tag: 'bug fix', reply: 'Good catch. One post per fan per show.', sp: 'botbuild', spLine: 'Duplicate guard is in. Counts now show people, not posts.' },
  ],
  clients: [
    { ask: 'a client pulse before Monday', tag: 'client pulse', reply: "I'll get the health scores.", sp: 'inbox-triage', spLine: 'Inbox sorted. Two clients need a reply today.' },
    { ask: 'chase the overdue invoices', tag: 'invoices', reply: 'Routing it to Invoice Agent.', sp: 'invoice-agent', spLine: 'Reminders sent and the ledger is reconciled.' },
  ],
  marketing: [
    { ask: 'a recap reel of the Riviera Maya run', tag: 'content', reply: 'Big Ern, you there?', sp: 'big-ern', spLine: 'Storyboard is ready. Smarth Vader shot the B-roll.' },
    { ask: 'what fans want from Show Buddies', tag: 'research', reply: 'Pulling sources now.', sp: 'content-researcher', spLine: 'Top ask: find a buddy for the beach pit.' },
  ],
};
const COUNCIL_TOPICS = [
  { q: 'Is “recursive self-improvement” the right name for Keystone Claude’s build loop?', outsider: 'A newcomer hears RSI and pictures an AI rewriting itself.', contrarian: 'Then the name oversells it. The model does not change.', fp: 'What it does: each build starts from the last proven-better build, and the layout search tunes its own step size.', gordo: 'Ship it under an honest name and keep the measurements.', chairman: 'Decided: call it the Keystone build loop, and keep the RSI label honest.' },
  { q: 'Should the clone write to the live Show Buddies backend?', outsider: 'A new fan expects it to just work.', contrarian: "If it writes, one bug spams Daniel's real database.", fp: 'Writes need consent and tokens. The clone has neither by default.', gordo: 'Ship read-only today. Writes stay in the original app.', chairman: "Decided: read-only by default. Posting happens in Daniel's app." },
  { q: 'Should the stages play real band recordings?', outsider: 'Fans want to hear their band.', contrarian: "We don't have the rights to share those recordings.", fp: 'The job is a live feel, not a specific recording.', gordo: 'Generate original jams now. Let people load files they own.', chairman: 'Decided: original generated music, plus your own lossless files.' },
  { q: 'Do we add new venues now or later?', outsider: 'More stages make the island feel alive.', contrarian: 'More stages also means more to maintain.', fp: 'Venues are data. Keep them in a separate pack.', gordo: 'Ship the expansion as its own add-on.', chairman: 'Decided: new venues ship as a separate expansion pack.' },
  { q: 'How loud should the island be by default?', outsider: 'Silence feels broken.', contrarian: 'Surprise audio is worse than silence.', fp: "Browsers won't play sound until you tap anyway.", gordo: 'One clear Sound on button. Distance does the rest.', chairman: 'Decided: sound starts on your tap and fades with distance.' },
];
const STAGE_LINES = {
  'phish-msg': ['MSG NYE run. Chills already.', 'Is this a Tweezer? Feels like a Tweezer.', 'Saving a spot by the soundboard.'],
  'phish-rm': ['Beach pit, toes in the sand.', 'Sunset set break by the soundboard.', 'This jam is going places.'],
  goose: ['Goose is cooking tonight.', 'Dance party in the back!', 'That build-up though…'],
  biscuits: ['Trance-fusion hour.', 'Glow sticks up!', 'The drop is coming…'],
  other: ['Add your band, start a stage.', 'Bluegrass breakdown!', 'Open mic energy.'],
};
const IDLE = {
  'conscious-claude': ['Priorities locked for the week ✔', 'Who owns this? …ah, Product.', 'Rule Book check: all green.', 'Routing three asks to the directors.'],
  product: ['What if onboarding took 30 seconds?', 'Roadmap v3… or v4?'], clients: ['Everyone is green today 🟢', 'Renewal call at 2pm.'],
  marketing: ['New tagline: Never go solo.', 'Launch post drafted.'], ernie: ["Daniel's inbox is calm. Suspicious.", 'Front door is open 🚪'],
  helperbot: ['Finished a task ✅', 'Helped with a family errand 💗'], phishbot: ['Setlist predictions loading…', 'Ticket drop alert armed.'],
  'big-ern': ['Rendering the thumbnail.', 'B-roll looks gorgeous.'], 'content-researcher': ['Found three fresh angles.', 'Sources checked twice.'],
  'inbox-triage': ['Inbox: 12 → 0.', 'Drafted four replies.'], 'invoice-agent': ['Ledger balanced.', 'Two invoices paid today.'],
  tasky: ['Captured 5 action items.', 'Closing the loop.'], travelbot: ['Cancún flights look good.', 'Itinerary updated ✈️'],
  botbuild: ['Testing a new agent.', 'Shipping v2 of the onboarding agent.'], gordo: ['When does it ship?', 'Done beats perfect.'],
  outsider: ['How would a stranger see this?'], contrarian: ['Counterpoint…'], 'first-principles': ['What is actually true here?'], chairman: ['Preparing the next Council agenda.'],
};

// ---------- Simulation director ----------
export class Sim {
  constructor(world, ui, rules, roster) {
    this.world = world; this.ui = ui; this.rules = rules; this.agents = new Map(); this.fans = new Map();
    this.running = 0; this.nextScenario = 4; this.chatterT = 3; this.inboxCount = 0; this.selected = null; this.greeted = false;
    // v2 extension points (used by expansion packs and keystone.js): extra scenarios, fan placement, dance and energy zones
    this.scenarios = []; this.fanPlacers = []; this.danceSpots = []; this.energyHooks = [];
    this.councilSeats = []; const cb = COUNCIL.building;
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; this.councilSeats.push(new THREE.Vector3(cb.x + Math.sin(a) * 3.4, 0, cb.z + Math.cos(a) * 3.4)); }
    const all = [...roster.agents, ...roster.characters];
    all.forEach(d => { const a = new Agent(d, this); a.place(this.homeSpot(a)); a.activity = 'Settling in'; this.agents.set(d.key, a); });
    ['chief', 'smarth-vader'].forEach(k => { const a = this.agents.get(k); if (a) { a.dance = true; a.activity = 'Dancing in the beach pit at Riviera Maya'; } });
    if (!VTEST) setTimeout(() => this.meetDaniel(), 5000);
  }
  get(k) { return this.agents.get(k); }
  free(k) { const a = this.agents.get(k); return a && !a.busy ? a : null; }
  energyAt(p) { let best = 0; for (const s of STAGES) { const o = this.world.stageObjs.get(s.id); const d = p.distanceTo(s.pos); if (d < 22) best = Math.max(best, o.energy.level * (1 - d / 22) * 2); } for (const h of this.energyHooks) best = Math.max(best, h(p) || 0); return best; }
  atDanceSpot(p) { return islandOf(p) === 'show' || this.danceSpots.some(f => f(p)); }
  homeSpot(a) {
    for (const f of this.homeResolvers || []) { const r = f(a); if (r) return r; } // expansion packs
    const h = a.def.home || 'garden';
    if (h.startsWith('show:')) { const s = STAGES.find(x => x.id === h.slice(5)) || STAGES[1]; const k = a.key === 'chief' ? -0.9 : a.key === 'smarth-vader' ? 0.9 : (R() - 0.5) * 3; return s.pit.clone().add(polar(1.6, s.angle + Math.PI / 2 + k)); }
    if (h === 'council') return COUNCIL.building.clone().add(polar(3.3 + R() * 2.2, R() * Math.PI * 2));
    const z = zone(h) || zone('garden'); return z.yard.clone().add(polar(R() * 3.5, R() * Math.PI * 2));
  }
  pitSpot(stageId) { const s = STAGES.find(x => x.id === stageId); return s.pit.clone().add(polar(1 + R() * 2.4, R() * Math.PI * 2)); }
  nearSpot(a) { return a.pos.clone().add(polar(1.6, R() * Math.PI * 2)).setY(0); }

  async talk(a, text, dur = 3.4, feed = true) { a.say(text, dur); if (feed) this.ui.feed(`<b style="color:${readable(a.def.color)}">${esc(a.name)}</b>: ${esc(text)}`, 'sim'); await wait(dur + 0.25); }
  lock(...as) { if (as.some(a => !a || a.busy)) return false; as.forEach(a => { a.busy = true; }); return true; }
  release(...as) { as.forEach(a => { if (a) { a.busy = null; a.dance = ['chief', 'smarth-vader', 'keystone-claude'].includes(a.key) && this.atDanceSpot(a.pos); } }); }

  async meetDaniel() {
    const cc = this.get('conscious-claude'), dn = this.get('daniel'); if (!this.lock(cc, dn)) return;
    this.running++;
    try {
      this.ui.feed('✴️ <b>Conscious Claude</b> joined Agent World as Chief of Staff (added by Smarth Vader)', 'sim');
      await cc.walkTo(this.nearSpot(dn), 'Heading to meet Daniel');
      cc.obj.lookAt(dn.pos.x, cc.pos.y, dn.pos.z);
      await this.talk(cc, "Hi Daniel! Smarth Vader added me — I'm Conscious Claude, your Chief of Staff agent. 🤘", 5);
      dn.say('👋', 2.5); // Rule K3: Daniel is a real person, so the simulation never puts invented words in his mouth
      this.greeted = true;
    } finally { this.running--; this.release(cc, dn); cc.walkTo(this.homeSpot(cc), 'Back at HQ'); }
  }

  async routeWork() {
    const dirs = ['product', 'clients', 'marketing'].map(k => this.free(k)).filter(Boolean); if (!dirs.length) return;
    const cc = this.free('conscious-claude'), dir = pick(dirs), task = pick(TASKS[dir.key]), sp = this.free(task.sp);
    if (!this.lock(cc, dir, sp)) return;
    this.running++;
    try {
      cc.activity = `Planning: ${task.ask}`;
      await this.talk(cc, `New priority for Daniel's world: ${task.ask}.`);
      await cc.walkTo(this.nearSpot(dir), `Routing "${task.ask}" to ${dir.name}`);
      this.ui.feed(`<b style="color:#d97757">Conscious Claude</b> → <b style="color:${dir.def.color}">${dir.name}</b> <span class="dim">· ${task.tag}</span>`, 'sim');
      await this.talk(cc, `${dir.name}, can you own this?`, 2.6, false);
      await this.talk(dir, task.reply, 2.8);
      await dir.walkTo(this.nearSpot(sp), `Briefing ${sp.name}`);
      await this.talk(dir, `${sp.name}, this one's yours.`, 2.6, false);
      sp.activity = `Working on: ${task.ask}`;
      await this.talk(sp, task.spLine, 3.6);
      this.ui.collab(15, `${dir.name} × ${sp.name}`);
    } finally {
      this.running--; this.release(cc, dir, sp);
      dir.walkTo(this.homeSpot(dir), 'Back at the desk'); cc.walkTo(this.homeSpot(cc), 'Back at HQ');
    }
  }

  async convene() {
    const keys = ['outsider', 'contrarian', 'first-principles', 'gordo', 'chairman'];
    const cc = this.free('conscious-claude'), ms = keys.map(k => this.free(k));
    if (!this.lock(cc, ...ms)) return;
    this.running++;
    const topic = pick(COUNCIL_TOPICS);
    try {
      this.ui.feed('🏛️ <b>Conscious Claude convened the Council of Advisors</b>', 'sim');
      await Promise.all([cc, ...ms].map((a, i) => a.walkTo(this.councilSeats[i * 1 + (i > 2 ? 1 : 0)], 'In a Council session')));
      [cc, ...ms].forEach(a => a.obj.lookAt(COUNCIL.building.x, a.pos.y, COUNCIL.building.z));
      await this.talk(cc, `Council, the question: ${topic.q}`, 4.2);
      await this.talk(ms[0], topic.outsider); await this.talk(ms[1], topic.contrarian);
      await this.talk(ms[2], topic.fp); await this.talk(ms[3], topic.gordo);
      await this.talk(ms[4], topic.chairman, 4.4);
      const rc = this.rules?.get('C5'); if (rc) await this.talk(cc, `Logged with dissent, per ${rc.id}: ${rc.cite}`, 4);
      this.ui.badge('council'); this.ui.collab(25, 'Council session');
    } finally {
      this.running--; this.release(cc, ...ms);
      ms.forEach(a => a.walkTo(this.homeSpot(a), 'Back in the chamber')); cc.walkTo(this.homeSpot(cc), 'Back at HQ');
    }
  }

  async showTrip() {
    const pool = ['phishbot', 'travelbot', 'tasky', 'helperbot', 'big-ern', 'ernie'].map(k => this.free(k)).filter(Boolean);
    if (!pool.length) return; const a = pick(pool); if (!this.lock(a)) return;
    const st = a.key === 'phishbot' ? pick(['phish-msg', 'phish-rm']) : pick(STAGES).id;
    this.running++;
    try {
      await a.walkTo(this.pitSpot(st), `Walking to ${STAGES.find(s => s.id === st).name}`);
      a.dance = true; a.activity = `Catching the show at ${STAGES.find(s => s.id === st).name}`;
      await this.talk(a, pick(STAGE_LINES[st]), 3.2);
      await wait(6 + R() * 8);
    } finally { this.running--; this.release(a); a.walkTo(this.homeSpot(a), 'Heading home'); }
  }

  async inbox() {
    const e = this.free('ernie'), t = this.free('inbox-triage'), k = this.free('tasky'); if (!this.lock(e, t, k)) return;
    this.running++;
    try {
      await this.talk(e, 'New request for Daniel. Routing it.', 2.8);
      await e.walkTo(this.nearSpot(t), 'Delivering a request to Inbox Triage');
      await this.talk(t, 'Flagged, drafted, routed. tasky, capture the follow-up?', 3.2);
      await this.talk(k, 'Captured ✅', 2.2);
      if (++this.inboxCount >= 2) this.ui.badge('inbox');
      this.ui.collab(10, 'Inbox handoff');
    } finally { this.running--; this.release(e, t, k); e.walkTo(this.homeSpot(e), 'Back at the front door'); }
  }

  async smarthDrop() {
    const s = this.free('smarth-vader'), b = this.free('big-ern'); if (!this.lock(s, b)) return;
    this.running++;
    try {
      s.dance = false;
      await s.walkTo(this.nearSpot(b), 'Taking footage to Big Ern');
      await this.talk(s, 'Fresh footage from the beach pit. Full Flowers 🌸', 3.2);
      await this.talk(b, 'Cutting it into the recap reel now.', 3);
      this.ui.collab(10, 'Smarth Vader × Big Ern');
    } finally { this.running--; this.release(s, b); s.walkTo(this.homeSpot(s), 'Back to the beach pit').then(() => { if (!s.busy) s.dance = true; }); }
  }

  async citeRule() {
    if (!this.rules?.ready) return;
    const a = pick([...this.agents.values()].filter(x => !x.busy && x.def.group !== 'character')); if (!a) return;
    const r = this.rules.randomFor(a.def); if (!r) return;
    a.say(`📜 ${r.id}: ${r.cite}`, 4.2); this.ui.feed(`<b style="color:${readable(a.def.color)}">${esc(a.name)}</b> cited <a href="#" data-rule="${r.id}">${r.id}</a>`, 'sim');
  }

  async askRule(rule) { // Rule Book "Ask Conscious Claude" button
    const cc = this.get('conscious-claude'); if (!cc) return;
    this.world.flyTo(cc.pos, 13, 6);
    cc.say(`${rule.id} · ${rule.title}: ${rule.cite}`, 6); this.ui.feed(`<b style="color:#d97757">Conscious Claude</b> explained <b>${rule.id}</b>`, 'sim');
  }

  update(dt, t) {
    for (const a of this.agents.values()) a.update(dt, t);
    for (const f of this.fans.values()) f.update(dt, t);
    if (this.ui.simOn === false) return;
    this.nextScenario -= dt;
    if (this.nextScenario <= 0 && this.running < 3) {
      this.nextScenario = 3 + R() * 4;
      const extraW = this.scenarios.reduce((s, x) => s + (typeof x.w === 'function' ? x.w() : x.w), 0);
      let roll = R() * (1 + extraW);
      if (roll >= 1) { roll -= 1; const sc = this.scenarios.find(x => (roll -= (typeof x.w === 'function' ? x.w() : x.w)) < 0) || this.scenarios[this.scenarios.length - 1]; Promise.resolve().then(() => sc.run()).catch(e => console.warn(e)); return; }
      (roll < 0.3 ? this.routeWork() : roll < 0.42 ? this.convene() : roll < 0.62 ? this.showTrip() : roll < 0.76 ? this.inbox() : roll < 0.84 ? this.smarthDrop() : this.citeRule()).catch(e => console.warn(e));
    }
    this.chatterT -= dt;
    if (this.chatterT <= 0) {
      this.chatterT = 2.5 + R() * 3;
      const idle = [...this.agents.values()].filter(a => !a.busy && !a.path.length && !a.bubbleUntil);
      if (idle.length) { const a = pick(idle); const lines = a.def.lines || IDLE[a.key]; if (lines) a.say(pick(lines), 2.8); }
    }
    for (const a of this.agents.values()) {
      if (a.busy || a.path.length || a.dance) continue;
      a.wanderT -= dt;
      if (a.wanderT <= 0) { a.wanderT = 5 + R() * 9; a.walkTo(this.homeSpot(a), IDLE[a.key] ? 'Working: ' + pick(IDLE[a.key]) : 'Hanging out'); }
    }
  }

  // ---------- Show Buddies fans (live or sample posts) ----------
  setFans(posts) {
    const sig = posts.map(p => p.id + ':' + p.hello + ':' + p.section).sort().join('|');
    if (sig === this.fanSig) return; this.fanSig = sig; // unchanged data: keep figures (and any open panel) intact
    if (this.selected?.post) { this.world.setFollow(null); this.ui.hidePanel(); }
    for (const f of this.fans.values()) { this.world.scene.remove(f.obj); this.world.unregisterLabel(f.lbl); this.world.pickables = this.world.pickables.filter(p => p !== f.obj); }
    this.fans.clear(); for (const a of this.agents.values()) a.posts = [];
    const charOf = h => ({ chief: 'chief', smarth: 'smarth-vader', 'smarth vader': 'smarth-vader', daniel: 'daniel', 'conscious claude': 'conscious-claude', 'keystone claude': 'keystone-claude' })[String(h || '').trim().toLowerCase()];
    const byStage = new Map();
    for (const p of posts) {
      const ck = charOf(p.handle); if (ck && this.agents.get(ck)) { this.agents.get(ck).posts.push(p); continue; }
      const st = p.stage; if (!byStage.has(st)) byStage.set(st, []); byStage.get(st).push(p);
    }
    for (const [stId, list] of byStage) {
      const s = STAGES.find(x => x.id === stId); if (!s) continue;
      list.forEach((p, i) => {
        const [acc, color] = CAST[p.agent] || ['none', '#94a3b8'];
        const key = 'fan-' + p.id;
        const a = new Agent({ key, name: p.handle, color, acc, group: 'fan', home: 'show:' + stId }, this, { fan: true, scale: 0.72, label: `${p.handle} · ${p.dateShort || ''}`.trim() });
        a.post = p; a.dance = true; a.activity = p.hello ? `“${p.hello}”` : 'Looking for a show buddy';
        const custom = this.fanPlacers.map(f => f(p, i, list)).find(Boolean); // packs can seat fans by section (Moon Palace)
        if (custom) { a.place(custom.pos); a.obj.lookAt(custom.look.x, 0, custom.look.z); }
        else { const ang = s.angle + Math.PI + (i - (list.length - 1) / 2) * 0.5; a.place(s.pit.clone().add(polar(3 + (i % 2) * 0.6, ang))); a.obj.lookAt(s.pos.x, 0, s.pos.z); }
        this.fans.set(key, a);
      });
    }
  }
}
