// Festival Grounds — an Agent World expansion pack (v1.0.0, MIT).
// Engine-agnostic: works in any three.js (r150+) scene, including Daniel's original Agent World.
// Usage:
//   import { installFestivalGrounds } from './festival-grounds.js';
//   const pack = await (await fetch('packs/festival-grounds/pack.json')).json();
//   const fg = installFestivalGrounds({ THREE, scene, pack, at: new THREE.Vector3(46, 0, -196), connectFrom: showIslandRimPoint });
//   // every frame:  fg.update(dt, t, venueId => ({ low, mid, high, level }))   (energy is optional)
//   // picking:      raycast against fg.pickables; hits carry userData.pick = { kind:'pack-venue', pack:'festival-grounds', id }
//   // remove:       fg.dispose()   (leaves the base world exactly as it was — Rule V2)
// Written by Conscious Claude (Claude Opus 5.5) for Smarth Vader and Daniel.

const LAYOUT = { // degrees around the island, distance from centre (venue fronts face the centre)
  'fg-booth': [10, 14], 'fg-field': [72, 27], 'fg-amph': [144, 27], 'fg-camp': [208, 26], 'fg-club': [254, 27], 'fg-lot': [298, 27],
};
const STATION_DEG = 328;

export function installFestivalGrounds({ THREE, scene, pack, at, radius = 40, connectFrom = null, makeLabel = null, quality = 'high' }) {
  const D = Math.PI / 180, root = new THREE.Group(); root.name = 'pack:festival-grounds'; root.position.copy(at); scene.add(root);
  const anims = [], pickables = [], disposables = [], venues = [], crowds = [], energyMats = [];
  const polar = (r, a, y = 0) => new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);
  let seed = 77; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const M = (color, o = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, envMapIntensity: 0.3, ...o }); disposables.push(m); return m; };
  const G = (g) => { disposables.push(g); return g; };
  const glow = (c, k = 2) => M(c, { emissive: c, emissiveIntensity: k, roughness: 0.4 });
  const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(G(geo), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
  const textTex = (lines, { w = 512, h = 256, bg = '#1b1430', fg = '#fff', glowC = null, size = 0.3 } = {}) => {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, w, h); x.textAlign = 'center'; x.textBaseline = 'middle';
    const L = [].concat(lines); L.forEach((s, i) => { const fs = Math.round(h * (i === 0 ? size : size * 0.5)); x.font = `${i === 0 ? 800 : 500} ${fs}px system-ui, sans-serif`; if (glowC) { x.shadowColor = glowC; x.shadowBlur = 20; } x.fillStyle = i === 0 ? fg : '#e9e3ff'; x.fillText(s, w / 2, h * (L.length === 1 ? 0.5 : 0.18 + i * (0.72 / L.length))); });
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; disposables.push(t); return t;
  };
  const sign = (parent, lines, w, h, opts, x, y, z) => { const m = new THREE.Mesh(G(new THREE.PlaneGeometry(w, h)), new THREE.MeshBasicMaterial({ map: textTex(lines, opts), toneMapped: false })); disposables.push(m.material); m.position.set(x, y, z); parent.add(m); return m; };
  const label = (html, cls, y, parent) => {
    let o;
    if (makeLabel) o = makeLabel(html, cls);
    else { const t = textTex(html.replace(/<[^>]+>/g, ' ').trim(), { w: 512, h: 96, bg: 'rgba(24,19,48,0.75)', size: 0.5 }); o = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false })); o.scale.set(8, 1.5, 1); disposables.push(o.material); }
    o.position.y = y; parent.add(o); return o;
  };

  // ---------- island ----------
  const top = new THREE.Mesh(G(new THREE.CylinderGeometry(radius, radius * 0.97, 2.2, 128)), [M(0x8f6f5c), M(0x86c47c, { roughness: 0.9 }), M(0x5b4a5e)]);
  top.position.y = -1.1; top.receiveShadow = true; root.add(top);
  const depth = 32, rg = G(new THREE.ConeGeometry(radius * 0.97, depth, 72, 12, true).rotateX(Math.PI)), p = rg.attributes.position, v = new THREE.Vector3(), cols = [];
  const cTop = new THREE.Color(0x9a6b52), cBot = new THREE.Color(0x5a3a5e);
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = (depth / 2 - v.y) / depth; const nz = Math.sin(v.x * 0.33 + 4) * Math.cos(v.z * 0.27) + 0.5 * Math.sin(v.y * 0.7 + v.x * 0.2); const s = 1 + (k > 0.04 ? 0.17 * nz * Math.min(1, k * 4) : 0); p.setXYZ(i, v.x * s, v.y + (k > 0.04 ? nz : 0), v.z * s); const c = cTop.clone().lerp(cBot, k); cols.push(c.r, c.g, c.b); }
  rg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); rg.computeVertexNormals();
  const rock = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 })); disposables.push(rock.material); rock.position.y = -2.2 - depth / 2; root.add(rock);
  const path = new THREE.Mesh(G(new THREE.RingGeometry(10.5, 13.2, 96).rotateX(-Math.PI / 2)), M(0xead6b4, { roughness: 0.95 })); path.position.y = 0.02; path.receiveShadow = true; root.add(path);
  const lbl = label('<b>🎪 Festival Grounds</b><small>expansion pack</small>', 'zone big', 12, root);

  // ---------- crowds (instanced, bob with the music) ----------
  function crowd(parent, n, placeFn, venueId) {
    const im = new THREE.InstancedMesh(G(new THREE.CapsuleGeometry(0.32, 0.55, 3, 8)), M(0xffffff, { roughness: 0.6 }), n);
    const base = [], m4 = new THREE.Matrix4(), c = new THREE.Color();
    for (let i = 0; i < n; i++) { const [x, y, z] = placeFn(i); base.push([x, y + 0.6, z, rnd() * 6]); m4.makeTranslation(x, y + 0.6, z); im.setMatrixAt(i, m4); c.setHSL(rnd(), 0.55, 0.55); im.setColorAt(i, c); }
    im.castShadow = true; parent.add(im); crowds.push({ im, base, venueId });
  }

  // ---------- venues ----------
  const B = {
    'fg-amph'(g, ve) {
      const red = M(0xb5452b, { flatShading: true, roughness: 0.95 });
      for (const s of [-1, 1]) { const r = mesh(new THREE.DodecahedronGeometry(5, 1), red, g, s * 12, 6, -2); r.scale.set(0.8, 1.5, 1.1); r.rotation.set(0.1, s * 0.6, s * -0.15); }
      mesh(new THREE.BoxGeometry(12, 1.2, 6), M(0x2a2533), g, 0, 0.6, -2);
      const shell = mesh(new THREE.CylinderGeometry(7, 7, 8, 32, 1, true, -Math.PI / 2, Math.PI), M(0xf3e8dc, { side: THREE.DoubleSide, roughness: 0.5 }), g, 0, 5, -2.5);
      shell.rotation.y = Math.PI; shell.scale.z = 0.6;
      const lip = mesh(new THREE.BoxGeometry(12, 0.12, 0.12), glow(ve.color, 2.5), g, 0, 1.25, 1); energyMats.push([lip.material, ve.id, 2.5]);
      const pts = []; for (let k = 0; k < 5; k++) { const r = 6 + k * 1.6, y = k * 0.55; pts.push(new THREE.Vector2(r, y), new THREE.Vector2(r + 1.6, y)); if (k < 4) pts.push(new THREE.Vector2(r + 1.6, y + 0.55)); }
      const seats = mesh(new THREE.LatheGeometry(pts, 48, -Math.PI / 2.6, Math.PI / 1.3), M(0xc9a58a, { side: THREE.DoubleSide, roughness: 0.9 }), g, 0, 0, -2);
      crowd(g, 110, i => { const k = i % 5, a = (rnd() - 0.5) * Math.PI / 1.45, r = 6.8 + k * 1.6; return [Math.sin(a) * r, k * 0.55, Math.cos(a) * r - 2]; }, ve.id);
      const tp = new THREE.Group(); tp.position.set(0, 2.6, 13.2); g.add(tp); // tapers' platform
      mesh(new THREE.BoxGeometry(5, 0.3, 2), M(0x3a3348), tp); mesh(new THREE.BoxGeometry(5, 2.6, 0.3), M(0x3a3348), tp, 0, -1.3, 0.85);
      for (let i = 0; i < 4; i++) { mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2, 6), M(0x222222), tp, -1.8 + i * 1.2, 1.6, 0); mesh(new THREE.BoxGeometry(0.15, 0.32, 0.15), M(0x111111, { metalness: 0.7 }), tp, -1.8 + i * 1.2, 3.25, 0); }
      label('🎙️ Tapers', 'zone', 4.4, tp);
    },
    'fg-field'(g, ve) {
      mesh(new THREE.BoxGeometry(14, 1.5, 7), M(0x24202e), g, 0, 0.75, -2);
      const arch = mesh(new THREE.TorusGeometry(7.5, 0.35, 10, 48, Math.PI), M(0xc0c7d6, { metalness: 0.8, roughness: 0.3 }), g, 0, 1.5, -2);
      const archGlow = mesh(new THREE.TorusGeometry(7.1, 0.12, 8, 48, Math.PI), glow(ve.color, 2.2), g, 0, 1.5, -1.8); energyMats.push([archGlow.material, ve.id, 2.2]);
      for (const s of [-1, 1]) { const scr = sign(g, [ve.name, 'Main stage'], 4.5, 3, { glowC: ve.color, fg: ve.color }, s * 10.3, 5, -2.5); scr.rotation.y = -s * 0.25; mesh(new THREE.BoxGeometry(0.4, 7, 0.4), M(0x444455), g, s * 10.3, 2.8, -2.8); }
      crowd(g, 150, () => [(rnd() - 0.5) * 18, 0, 3 + rnd() * 8], ve.id);
      const flags = [];
      for (let i = 0; i < 6; i++) { const x = -12 + i * 4.8, pole = mesh(new THREE.CylinderGeometry(0.06, 0.06, 6, 6), M(0xdddddd), g, x, 3, 12); const f = mesh(new THREE.PlaneGeometry(1.4, 0.9), M([0xff4d5e, 0xfacc15, 0x22c55e, 0x60a5fa, 0xc084fc, 0xfb923c][i], { side: THREE.DoubleSide }), g, x + 0.7, 5.5, 12); flags.push(f); }
      const wheel = new THREE.Group(); wheel.position.set(13, 8.5, 4); wheel.rotation.y = Math.PI / 2; g.add(wheel);
      const rim = M(0xffffff, { metalness: 0.5, roughness: 0.3 });
      mesh(new THREE.TorusGeometry(6.5, 0.14, 8, 64), rim, wheel); const lights = glow(0xffd166, 2); mesh(new THREE.TorusGeometry(6.65, 0.06, 6, 64), lights, wheel);
      const hub = new THREE.Group(); wheel.add(hub); const cars = [];
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const sp = mesh(new THREE.BoxGeometry(0.08, 6.5, 0.08), rim, hub, Math.sin(a) * 3.25, Math.cos(a) * 3.25, 0); sp.rotation.z = -a; const car = mesh(new THREE.BoxGeometry(0.9, 0.8, 0.9), M([0xff4d5e, 0x60a5fa, 0xfacc15, 0x22c55e][i % 4]), hub, Math.sin(a) * 6.5, Math.cos(a) * 6.5 - 0.6, 0); cars.push(car); }
      for (const s of [-1, 1]) { const leg = mesh(new THREE.BoxGeometry(0.3, 10, 0.3), rim, g, 13, 4, 4 + s * 2.5); leg.rotation.x = s * 0.25; }
      anims.push((dt, t) => { hub.rotation.z = t * 0.12; cars.forEach(c => { c.rotation.z = -hub.rotation.z; }); flags.forEach((f, i) => { f.rotation.y = Math.sin(t * 3 + i) * 0.4; }); });
    },
    'fg-club'(g, ve) {
      const wall = M(0x1c1530, { roughness: 0.8 });
      mesh(new THREE.BoxGeometry(11, 6, 0.4), wall, g, 0, 3, -4); for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.4, 6, 8), wall, g, s * 5.5, 3, 0);
      mesh(new THREE.BoxGeometry(11.8, 0.4, 8.8), M(0x2b2140), g, 0, 6.2, 0);
      mesh(new THREE.BoxGeometry(10.6, 0.1, 7.6), M(0x2a2236, { roughness: 0.25, metalness: 0.4 }), g, 0, 0.05, 0);
      mesh(new THREE.BoxGeometry(6, 0.8, 2.4), M(0x332a44), g, 0, 0.4, -2.6);
      const neon = sign(g, ['LATE NIGHT'], 7, 1.4, { bg: '#12081f', fg: '#ff5fb7', glowC: '#ff2d95', size: 0.55 }, 0, 7.3, 4.1);
      const ball = mesh(new THREE.IcosahedronGeometry(0.8, 2), M(0xffffff, { metalness: 1, roughness: 0.05, flatShading: true, envMapIntensity: 1.2 }), g, 0, 5, 0);
      const pl = new THREE.PointLight(0xff4fb0, 18, 16, 2); pl.position.set(0, 4.5, 1); g.add(pl);
      crowd(g, 26, () => [(rnd() - 0.5) * 8, 0.1, -0.5 + rnd() * 3.5], ve.id);
      anims.push((dt, t) => { ball.rotation.y = t * 0.8; neon.material.color.setScalar(0.75 + 0.25 * Math.abs(Math.sin(t * 2.3))); pl.color.setHSL((t * 0.07) % 1, 0.9, 0.6); });
      energyMats.push([{ set emissiveIntensity(v) { pl.intensity = 10 + v * 6; } }, ve.id, 1]);
    },
    'fg-camp'(g, ve) {
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; mesh(new THREE.DodecahedronGeometry(0.35), M(0x8a8a96, { flatShading: true }), g, Math.sin(a) * 1.4, 0.2, Math.cos(a) * 1.4); }
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + 0.3, log = mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.4, 10), M(0x7a4f30), g, Math.sin(a) * 3.6, 0.3, Math.cos(a) * 3.6); log.rotation.z = Math.PI / 2; log.rotation.y = a; }
      const flames = [0xffd27a, 0xff8a2a, 0xff4b1f].map((c, i) => { const f = new THREE.Mesh(G(new THREE.ConeGeometry(0.75 - i * 0.18, 1.8 - i * 0.3, 8)), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, toneMapped: false })); disposables.push(f.material); f.position.y = 0.9; g.add(f); return f; });
      const fire = new THREE.PointLight(0xff8a3a, 22, 18, 2); fire.position.y = 1.4; g.add(fire);
      for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.8, tent = mesh(new THREE.ConeGeometry(1.6, 2.2, 4), M([0x3b82f6, 0x22c55e, 0xf97316, 0xa855f7][i]), g, Math.sin(a) * 8, 1.1, Math.cos(a) * 8); tent.rotation.y = a; }
      anims.push((dt, t) => { flames.forEach((f, i) => { const s = 1 + Math.sin(t * (9 + i * 3) + i) * 0.12; f.scale.set(s, 1 + Math.sin(t * 7 + i * 2) * 0.2, s); f.rotation.y = t * (1 + i); }); fire.intensity = 18 + Math.sin(t * 13) * 3 + Math.sin(t * 7.3) * 2; });
    },
    'fg-lot'(g, ve) {
      const cols = [0xff4d5e, 0xfacc15, 0x22c55e, 0x60a5fa, 0xc084fc, 0xfb923c];
      for (let i = 0; i < 6; i++) {
        const x = -10 + i * 4, tent = new THREE.Group(); tent.position.set(x, 0, -1.5); g.add(tent);
        mesh(new THREE.BoxGeometry(3.4, 0.15, 3), M(cols[i]), tent, 0, 2.6, 0);
        const roof = mesh(new THREE.ConeGeometry(2.5, 0.8, 4), M(cols[i]), tent, 0, 3.05, 0); roof.rotation.y = Math.PI / 4;
        for (const [px, pz] of [[-1.6, -1.4], [1.6, -1.4], [-1.6, 1.4], [1.6, 1.4]]) mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), M(0xdddddd), tent, px, 1.3, pz);
        mesh(new THREE.BoxGeometry(2.6, 0.9, 0.9), M(0xf5e6c8), tent, 0, 0.45, 0.9);
      }
      const bulbs = glow(0xffe2a0, 2.4), bg = G(new THREE.SphereGeometry(0.1, 8, 6));
      for (let i = 0; i < 40; i++) { const x = -12 + i * 0.6, y = 3.6 - Math.sin((i % 7) / 6 * Math.PI) * 0.5, b = new THREE.Mesh(bg, bulbs); b.position.set(x, y, 0.4); g.add(b); }
      sign(g, ['SHAKEDOWN ST', 'grilled cheese · glass · good vibes'], 7, 2, { bg: '#0f2a1a', fg: '#7dffb0', glowC: '#22c55e', size: 0.36 }, 0, 5.2, -1.4);
      crowd(g, 30, () => [(rnd() - 0.5) * 22, 0, 2 + rnd() * 3], ve.id);
    },
    'fg-booth'(g, ve) {
      mesh(new THREE.BoxGeometry(4, 2.2, 2.4), M(0x2dd4bf), g, 0, 1.1, 0);
      const roof = mesh(new THREE.ConeGeometry(3.4, 1.4, 4), M(0x0f766e), g, 0, 2.9, 0); roof.rotation.y = Math.PI / 4;
      const types = pack?.venueTypesPreview || ['Amphitheater: main gate · behind the soundboard', 'Festival: info booth · main water station', 'Club: box office · by the bar', 'Campground: check-in · shuttle stop'];
      sign(g, ['🧭 MEETUP BOOTH', ...types], 5.5, 3.6, { bg: '#0b2b2a', fg: '#7ef0e4', glowC: '#2dd4bf', size: 0.2, w: 768, h: 512 }, 0, 4.4, 1.25);
    },
  };

  for (const ve of pack.venues) {
    const [deg, r] = LAYOUT[ve.id] || [rnd() * 360, 20];
    const a = deg * D, g = new THREE.Group(); g.position.copy(polar(r, a)); g.rotation.y = a + Math.PI; root.add(g);
    (B[ve.id] || B['fg-booth'])(g, ve);
    g.userData.pick = { kind: 'pack-venue', pack: pack.id, id: ve.id }; pickables.push(g);
    label(`<b>${ve.emoji} ${ve.name}</b><small>${pack.name} pack</small>`, 'zone', ve.id === 'fg-field' ? 11 : ve.id === 'fg-amph' ? 13 : 8.5, g);
    root.updateMatrixWorld(true);
    const front = g.localToWorld(new THREE.Vector3(0, 0, ve.id === 'fg-amph' ? 5 : 5.5)), stagePos = g.localToWorld(new THREE.Vector3(0, 0, -2));
    venues.push({ id: ve.id, name: ve.name, emoji: ve.emoji, color: ve.color, venue: ve, group: g, pos: stagePos, pit: front, energy: { low: 0, mid: 0, high: 0, level: 0 } });
  }

  // ---------- trees ----------
  const nT = quality === 'lite' ? 25 : 55, tr = new THREE.InstancedMesh(G(new THREE.IcosahedronGeometry(1.2, 1)), new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }), nT); disposables.push(tr.material);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), c = new THREE.Color(); let k = 0;
  for (let i = 0; i < 900 && k < nT; i++) { const a = rnd() * Math.PI * 2, r = 16 + rnd() * (radius - 18); const pt = polar(r, a); if (Math.abs(((a / D - STATION_DEG + 540) % 360) - 180) < 10) continue; if (venues.some(v => v.group.position.distanceTo(pt) < (v.id === 'fg-booth' ? 5 : 13))) continue; const s = 0.8 + rnd() * 0.8; m4.compose(pt.setY(2 * s), q, sc.set(s, s * 1.2, s)); tr.setMatrixAt(k, m4); c.setHSL(0.3 + rnd() * 0.1, 0.5, 0.38); tr.setColorAt(k, c); k++; }
  tr.count = k; tr.castShadow = true; root.add(tr);

  // ---------- cable car from Show Island ----------
  root.updateMatrixWorld(true);
  const station = (worldPos, parent) => { const s = new THREE.Group(); s.position.copy(parent.worldToLocal(worldPos.clone())); parent.add(s); mesh(new THREE.BoxGeometry(2.6, 0.4, 2.6), M(0x6b4a33), s, 0, 0.2, 0); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(new THREE.BoxGeometry(0.25, 12, 0.25), M(0x8892a6, { metalness: 0.6 }), s, x, 6, z); mesh(new THREE.BoxGeometry(3, 0.5, 3), M(0x3d6fb6), s, 0, 12.2, 0); return s; };
  let gondola = null;
  if (connectFrom) {
    const here = root.localToWorld(polar(radius - 3, STATION_DEG * D));
    const cableG = new THREE.Group(); scene.add(cableG); disposables.push({ dispose: () => scene.remove(cableG) });
    station(connectFrom, cableG); station(here, cableG);
    const A = connectFrom.clone().setY(connectFrom.y + 11.8), Bp = here.clone().setY(here.y + 11.8), mid = A.clone().lerp(Bp, 0.5); mid.y -= 3;
    const curve = new THREE.QuadraticBezierCurve3(A, mid, Bp);
    cableG.add(new THREE.Mesh(G(new THREE.TubeGeometry(curve, 60, 0.05, 5)), M(0x222222)));
    gondola = new THREE.Group(); cableG.add(gondola);
    mesh(new THREE.BoxGeometry(1.8, 1.5, 1.4), M(0xff6f61, { roughness: 0.4 }), gondola, 0, -1.6, 0);
    mesh(new THREE.BoxGeometry(1.6, 0.7, 1.45), new THREE.MeshPhysicalMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.45 }), gondola, 0, -1.4, 0);
    mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 6), M(0x333333), gondola, 0, -0.5, 0);
    anims.push((dt, t) => { const u = (Math.sin(t * 0.09) + 1) / 2; gondola.position.copy(curve.getPoint(u)); const tg = curve.getTangent(u); gondola.rotation.y = Math.atan2(tg.x, tg.z); });
    root.userData.cable = { A: connectFrom.clone(), B: here.clone() };
  }

  return {
    id: pack.id, root, venues, pickables, center: at.clone(), radius, gondola,
    spots: Object.fromEntries(venues.map(v => [v.id, v.pit.clone()])),
    update(dt, t, energyOf) {
      for (const f of anims) f(dt, t);
      for (const ve of venues) { const e = energyOf?.(ve.id); if (e) ve.energy = e; }
      for (const [m, id, base] of energyMats) { const e = venues.find(v => v.id === id).energy; m.emissiveIntensity = base * (0.75 + e.low * 0.7); }
      for (const cr of crowds) {
        const e = venues.find(v => v.id === cr.venueId)?.energy || { level: 0 }, amp = 0.04 + e.level * 0.22, mm = new THREE.Matrix4();
        // crowds bounce on the band's beat (each fan a little early or late), or sway gently with no music
        cr.base.forEach(([x, y, z, ph], i) => { const b = e.bpm ? Math.abs(Math.sin(Math.PI * ((e.beat || 0) + ph * 0.025))) * amp : Math.abs(Math.sin(t * 1.5 + ph)) * 0.03; mm.makeTranslation(x, y + b, z); cr.im.setMatrixAt(i, mm); });
        cr.im.instanceMatrix.needsUpdate = true;
      }
    },
    dispose() { scene.remove(root); for (const d of disposables) d.dispose?.(); },
  };
}
