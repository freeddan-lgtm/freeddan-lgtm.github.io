// Hollywood Bowl — an Agent World expansion pack (v1.0.0). Owned by Daniel (see LICENSE).
// Engine-agnostic: works in any three.js (r150+) scene, including Daniel's original Agent World.
//   import { installHollywoodBowl } from './hollywood-bowl.js';
//   const bowl = installHollywoodBowl({ THREE, scene, pack, at, facing, connectFrom, makeLabel });
//   every frame: bowl.update(dt, t, id => energy)   ·   picking: bowl.pickables   ·   remove: bowl.dispose()
// An artistic model of a concentric-shell amphitheater in the Hollywood Hills under a full moon.
// It is not an architectural survey of the real venue.

export function installHollywoodBowl({ THREE, scene, pack, at, facing = 0, radius = 46, connectFrom = null, makeLabel = null, quality = 'high' }) {
  const root = new THREE.Group(); root.name = 'pack:hollywood-bowl'; root.position.copy(at); root.rotation.y = facing; scene.add(root);
  const anims = [], pickables = [], disposables = [], crowds = [];
  const polar = (r, a, y = 0) => new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);
  let seed = 4242; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const M = (color, o = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, envMapIntensity: 0.3, ...o }); disposables.push(m); return m; };
  const G = g => { disposables.push(g); return g; };
  const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(G(geo), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
  const label = (html, cls, pos, parent = root) => {
    let o; if (makeLabel) o = makeLabel(html, cls);
    else { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const x = cv.getContext('2d'); x.fillStyle = 'rgba(24,19,48,.75)'; x.fillRect(0, 0, 512, 96); x.fillStyle = '#fff'; x.font = '700 44px system-ui'; x.textAlign = 'center'; x.fillText(html.replace(/<[^>]+>/g, ' ').trim(), 256, 62); const t = new THREE.CanvasTexture(cv); disposables.push(t); o = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false })); o.scale.set(9, 1.7, 1); }
    o.position.copy(pos); parent.add(o); return o;
  };
  const SHELL = new THREE.Vector3(0, 0, -14); // centre of the shell's opening; the audience faces it from +z

  // ---------- island ----------
  const top = new THREE.Mesh(G(new THREE.CylinderGeometry(radius, radius * 0.97, 2.2, 128)), [M(0x8a6a52), M(0x7a8c4a, { roughness: 0.95 }), M(0x5b4a5e)]);
  top.position.y = -1.1; top.receiveShadow = true; root.add(top);
  const depth = 34, rg = G(new THREE.ConeGeometry(radius * 0.97, depth, 72, 12, true).rotateX(Math.PI)), p = rg.attributes.position, v = new THREE.Vector3(), cols = [];
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = (depth / 2 - v.y) / depth, nz = Math.sin(v.x * 0.3 + 2) * Math.cos(v.z * 0.26) + 0.5 * Math.sin(v.y * 0.6 + v.x * 0.2), s = 1 + (k > 0.04 ? 0.16 * nz * Math.min(1, k * 4) : 0); p.setXYZ(i, v.x * s, v.y + (k > 0.04 ? nz : 0), v.z * s); const c = new THREE.Color(0x9a7452).lerp(new THREE.Color(0x4a3a66), k); cols.push(c.r, c.g, c.b); }
  rg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); rg.computeVertexNormals();
  const rock = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 })); disposables.push(rock.material); rock.position.y = -2.2 - depth / 2; root.add(rock);

  // ---------- the Hollywood Hills (chaparral-covered ridges behind and around the bowl) ----------
  const hillLights = [];
  const ridge = (x, z, r, h) => {
    const g = G(new THREE.SphereGeometry(r, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2)), hp = g.attributes.position, hc = [], q = new THREE.Vector3();
    for (let i = 0; i < hp.count; i++) { q.fromBufferAttribute(hp, i); const n = Math.sin(q.x * 0.35 + x) * Math.cos(q.z * 0.31 + z) + Math.sin(q.x * 0.9) * 0.4; q.y *= h / r * (1 + n * 0.12); hp.setXYZ(i, q.x, q.y, q.z); const c = new THREE.Color(n > 0.3 ? 0x41582f : n > -0.4 ? 0x6b7a3a : 0x9a7b4f); c.offsetHSL(0, 0, (rnd() - 0.5) * 0.05); hc.push(c.r, c.g, c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(hc, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 })); disposables.push(m.material);
    m.position.set(x, -0.5, z); m.castShadow = m.receiveShadow = true; root.add(m);
    for (let k = 0; k < 26; k++) { const a = rnd() * Math.PI * 2, el = 0.15 + rnd() * 0.75; hillLights.push(x + Math.cos(a) * Math.cos(el) * r * 0.98, -0.5 + Math.sin(el) * h * 0.98, z + Math.sin(a) * Math.cos(el) * r * 0.98); }
  };
  ridge(0, -38, 15, 16); ridge(-24, -31, 13, 12); ridge(24, -32, 13, 13); ridge(-36, -13, 11, 9); ridge(37, -12, 10, 8); ridge(-12, -42, 9, 11); ridge(13, -43, 9, 12);
  const hg = G(new THREE.BufferGeometry()); hg.setAttribute('position', new THREE.Float32BufferAttribute(hillLights, 3));
  const hl = new THREE.Points(hg, new THREE.PointsMaterial({ color: 0xffd9a0, size: 0.35, transparent: true, opacity: 0.9 })); disposables.push(hl.material); root.add(hl);
  label('<b>⛰️ Hollywood Hills</b>', 'zone', new THREE.Vector3(0, 19, -38));

  // ---------- the shell: nested concentric arches ----------
  const shell = new THREE.Group(); shell.position.copy(SHELL); root.add(shell);
  const white = M(0xf4f1ea, { roughness: 0.35 }), ringLights = [];
  const dome = new THREE.Mesh(G(new THREE.SphereGeometry(11.5, 48, 24, Math.PI, Math.PI, 0, Math.PI / 2)), M(0xe9e4da, { side: THREE.DoubleSide, roughness: 0.5 })); dome.position.z = -1.2; dome.receiveShadow = true; shell.add(dome);
  for (let k = 0; k < 9; k++) {
    const R = 12.6 - k * 0.62, z = -k * 0.95;
    mesh(new THREE.TorusGeometry(R, 0.3, 10, 80, Math.PI), white, shell, 0, 0, z);
    if (k % 2 === 0) { const lm = new THREE.MeshStandardMaterial({ color: 0x8fb8ff, emissive: 0x8fb8ff, emissiveIntensity: 1.6 }); disposables.push(lm); const r = new THREE.Mesh(G(new THREE.TorusGeometry(R - 0.33, 0.07, 6, 80, Math.PI)), lm); r.position.z = z + 0.05; shell.add(r); ringLights.push([lm, k]); }
  }
  mesh(new THREE.CylinderGeometry(13, 13, 1.2, 64, 1, false, -Math.PI / 2, Math.PI), M(0x3a3046, { roughness: 0.45 }), shell, 0, 0.6, 0);
  anims.push((dt, t) => ringLights.forEach(([m, k]) => { m.color.setHSL((t * 0.006 + k * 0.05) % 1, 0.65, 0.62); m.emissive.copy(m.color); })); // slow colour drift, never strobing

  // ---------- the orchestra and conductor ----------
  const rows = [[4, 8], [6, 11], [8, 14], [10, 16]], players = [];
  rows.forEach(([r, n]) => { for (let j = 0; j < n; j++) { const a = -1.15 + (j / (n - 1)) * 2.3; players.push([Math.sin(a) * r, 1.2, -Math.cos(a) * r * 0.55 + 2.5]); } });
  const pm = new THREE.InstancedMesh(G(new THREE.CapsuleGeometry(0.3, 0.55, 3, 8)), M(0x15121c, { roughness: 0.6 }), players.length);
  const heads = new THREE.InstancedMesh(G(new THREE.SphereGeometry(0.24, 10, 8)), M(0xe8c9a8), players.length);
  const m4 = new THREE.Matrix4(); players.forEach(([x, y, z], i) => { m4.makeTranslation(x, y + 0.55, z); pm.setMatrixAt(i, m4); m4.makeTranslation(x, y + 1.25, z); heads.setMatrixAt(i, m4); });
  pm.castShadow = true; shell.add(pm, heads);
  const pod = mesh(new THREE.BoxGeometry(1.4, 0.5, 1.4), M(0x2a2236), shell, 0, 1.45, 7.5);
  const cond = new THREE.Group(); cond.position.set(0, 1.7, 7.5); shell.add(cond);
  mesh(new THREE.CapsuleGeometry(0.34, 0.65, 4, 10), M(0x0d0b12), cond, 0, 0.65, 0); mesh(new THREE.SphereGeometry(0.27, 12, 10), M(0xe8c9a8), cond, 0, 1.45, 0);
  const arm = new THREE.Group(); arm.position.set(0.3, 1.1, -0.1); cond.add(arm); mesh(new THREE.BoxGeometry(0.06, 0.06, 0.9), M(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 }), arm, 0, 0, -0.45);
  void pod;

  // ---------- seating: boxes up front, benches climbing the hillside ----------
  const pts = []; for (let k = 0; k < 20; k++) { const r = 15 + k * 1.3, y = k * 0.46; pts.push(new THREE.Vector2(r, y), new THREE.Vector2(r + 1.3, y)); if (k < 19) pts.push(new THREE.Vector2(r + 1.3, y + 0.46)); }
  const seats = mesh(new THREE.LatheGeometry(pts, 64, -1.08, 2.16), M(0x8c8378, { side: THREE.DoubleSide, roughness: 0.9 }), root, SHELL.x, 0, SHELL.z);
  void seats;
  const boxPos = []; for (let k = 0; k < 4; k++) for (let a = -0.95; a <= 0.95; a += 0.16) boxPos.push([Math.sin(a) * (15.6 + k * 1.3), k * 0.46 + 0.35, SHELL.z + Math.cos(a) * (15.6 + k * 1.3)]);
  const boxes = new THREE.InstancedMesh(G(new THREE.BoxGeometry(1.0, 0.7, 0.8)), M(0x5b2333, { roughness: 0.6 }), boxPos.length);
  boxPos.forEach(([x, y, z], i) => { m4.makeTranslation(x, y, z); boxes.setMatrixAt(i, m4); }); boxes.castShadow = true; root.add(boxes);
  const crowd = (n, place, venueId) => {
    const im = new THREE.InstancedMesh(G(new THREE.CapsuleGeometry(0.26, 0.45, 3, 8)), M(0xffffff, { roughness: 0.6 }), n), base = [], c = new THREE.Color();
    for (let i = 0; i < n; i++) { const [x, y, z] = place(i); base.push([x, y + 0.5, z, rnd() * 6]); m4.makeTranslation(x, y + 0.5, z); im.setMatrixAt(i, m4); c.setHSL(rnd(), 0.45, 0.55); im.setColorAt(i, c); }
    im.castShadow = true; root.add(im); crowds.push({ im, base, venueId });
  };
  crowd(320, () => { const k = Math.floor(rnd() * 20), a = (rnd() - 0.5) * 2.05, r = 15.6 + k * 1.3; return [Math.sin(a) * r, k * 0.46, SHELL.z + Math.cos(a) * r]; }, 'hb-bowl');
  for (const s of [-1, 1]) for (let k = 0; k < 7; k++) { const a = s * (1.16 + rnd() * 0.08), r = 17 + k * 3.4, tr = mesh(new THREE.IcosahedronGeometry(1.5 + rnd() * 0.6, 1), M(0x3f6b34, { flatShading: true }), root, Math.sin(a) * r, 2.6 + k * 0.75, SHELL.z + Math.cos(a) * r); tr.scale.y = 1.3; }
  label('<b>🌙 Hollywood Bowl</b><small>Hollywood Bowl pack</small>', 'zone big', new THREE.Vector3(0, 17, SHELL.z - 2));

  // ---------- a large full moon over the hills ----------
  const mc = document.createElement('canvas'); mc.width = mc.height = 1024; const x = mc.getContext('2d');
  const rg2 = x.createRadialGradient(512, 512, 0, 512, 512, 500); rg2.addColorStop(0, '#f4f1e6'); rg2.addColorStop(0.85, '#e4e0d2'); rg2.addColorStop(1, '#c9c4b4');
  x.fillStyle = rg2; x.beginPath(); x.arc(512, 512, 500, 0, Math.PI * 2); x.fill(); x.save(); x.clip();
  for (const [cx, cy, r, a] of [[420, 360, 150, 0.22], [560, 300, 110, 0.2], [610, 430, 120, 0.18], [330, 520, 120, 0.2], [470, 520, 90, 0.16], [700, 560, 80, 0.14], [380, 230, 70, 0.12], [640, 640, 60, 0.1]]) { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(90,88,84,${a * 1.6})`); g.addColorStop(1, 'rgba(90,88,84,0)'); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); } // maria
  for (let k = 0; k < 140; k++) { const cx = 60 + rnd() * 900, cy = 60 + rnd() * 900, r = 3 + Math.pow(rnd(), 3) * 26; x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 1.5; x.beginPath(); x.arc(cx - 1, cy - 1, r, 0, Math.PI * 2); x.stroke(); x.strokeStyle = 'rgba(70,68,64,.22)'; x.beginPath(); x.arc(cx + 1.5, cy + 1.5, r, 0, Math.PI * 2); x.stroke(); }
  const ty = [500, 830]; for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2; x.strokeStyle = 'rgba(255,255,250,.13)'; x.lineWidth = 3; x.beginPath(); x.moveTo(ty[0], ty[1]); x.lineTo(ty[0] + Math.cos(a) * 260, ty[1] + Math.sin(a) * 260); x.stroke(); } // bright rayed crater
  const limb = x.createRadialGradient(512, 512, 380, 512, 512, 512); limb.addColorStop(0, 'rgba(0,0,0,0)'); limb.addColorStop(1, 'rgba(60,55,50,.35)'); x.fillStyle = limb; x.fillRect(0, 0, 1024, 1024); x.restore();
  const mt = new THREE.CanvasTexture(mc); mt.colorSpace = THREE.SRGBColorSpace; disposables.push(mt);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: mt, fog: false, depthWrite: false, color: 0xfffaf0 })); disposables.push(moon.material);
  const MOON = new THREE.Vector3(0, 150, -470); moon.position.copy(MOON); moon.scale.set(78, 78, 1); root.add(moon);
  const hc = document.createElement('canvas'); hc.width = hc.height = 256; const h = hc.getContext('2d'), hgd = h.createRadialGradient(128, 128, 30, 128, 128, 128);
  hgd.addColorStop(0, 'rgba(220,230,255,.55)'); hgd.addColorStop(0.35, 'rgba(190,205,255,.18)'); hgd.addColorStop(1, 'rgba(180,200,255,0)'); h.fillStyle = hgd; h.fillRect(0, 0, 256, 256);
  const ht = new THREE.CanvasTexture(hc); disposables.push(ht);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: ht, fog: false, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true })); disposables.push(halo.material);
  halo.position.copy(MOON); halo.scale.set(260, 260, 1); root.add(halo); halo.renderOrder = -1;
  const moonlight = new THREE.DirectionalLight(0xcfdcff, 0.35); moonlight.position.copy(MOON); moonlight.target.position.set(0, 0, 0); root.add(moonlight, moonlight.target);

  // ---------- cable car from Show Island ----------
  root.updateMatrixWorld(true);
  let gondola = null; const STATION = polar(radius - 3, 1.25);
  if (connectFrom) {
    const here = root.localToWorld(STATION.clone()), cg = new THREE.Group(); scene.add(cg); disposables.push({ dispose: () => scene.remove(cg) });
    const tower = w => { const s = new THREE.Group(); s.position.copy(w); cg.add(s); mesh(new THREE.BoxGeometry(2.6, 0.4, 2.6), M(0x6b4a33), s, 0, 0.2, 0); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(new THREE.BoxGeometry(0.25, 12, 0.25), M(0x8892a6, { metalness: 0.6 }), s, a, 6, b); mesh(new THREE.BoxGeometry(3, 0.5, 3), M(0x7c3aed), s, 0, 12.2, 0); };
    tower(connectFrom); tower(here);
    const A = connectFrom.clone().setY(connectFrom.y + 11.8), B = here.clone().setY(here.y + 11.8), mid = A.clone().lerp(B, 0.5); mid.y -= 3;
    const curve = new THREE.QuadraticBezierCurve3(A, mid, B); cg.add(new THREE.Mesh(G(new THREE.TubeGeometry(curve, 60, 0.05, 5)), M(0x222222)));
    gondola = new THREE.Group(); cg.add(gondola); mesh(new THREE.BoxGeometry(1.8, 1.5, 1.4), M(0x7c3aed, { roughness: 0.4 }), gondola, 0, -1.6, 0); mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 6), M(0x333333), gondola, 0, -0.5, 0);
    anims.push((dt, t) => { const u = (Math.sin(t * 0.08 + 1) + 1) / 2; gondola.position.copy(curve.getPoint(u)); const tg = curve.getTangent(u); gondola.rotation.y = Math.atan2(tg.x, tg.z); });
  }

  // ---------- picking, spots, update ----------
  shell.userData.pick = { kind: 'pack-venue', pack: pack.id, id: 'hb-bowl' }; pickables.push(shell);
  root.updateMatrixWorld(true);
  const stagePos = root.localToWorld(SHELL.clone().setY(2)), front = root.localToWorld(new THREE.Vector3(0, 0, SHELL.z + 15));
  const venues = [{ id: 'hb-bowl', name: 'Hollywood Bowl', emoji: '🌙', color: '#8fb8ff', venue: pack.venues[0], group: shell, pos: stagePos, pit: front, energy: { low: 0, mid: 0, high: 0, level: 0 } }];
  const spots = { 'hb-bowl': front, 'hb-stage': root.localToWorld(new THREE.Vector3(3, 0, SHELL.z + 10)), 'hb-plaza': root.localToWorld(new THREE.Vector3(-26, 0, 20)) };

  return {
    id: pack.id, root, venues, pickables, spots, moon, center: at.clone(), radius, gondola,
    update(dt, t, energyOf) {
      for (const f of anims) f(dt, t);
      const e = energyOf?.('hb-bowl'); if (e) venues[0].energy = e; const en = venues[0].energy;
      arm.rotation.x = en.bpm ? Math.sin(Math.PI * 2 * (en.beat || 0)) * 0.5 - 0.3 : Math.sin(t * 1.2) * 0.15 - 0.3; // the conductor beats time
      const mm = new THREE.Matrix4();
      for (const cr of crowds) { cr.base.forEach(([cx, cy, cz, ph], i) => { mm.makeTranslation(cx, cy + (en.bpm ? Math.abs(Math.sin(Math.PI * ((en.beat || 0) * 0.5 + ph * 0.02))) * (0.02 + en.level * 0.08) : 0), cz); cr.im.setMatrixAt(i, mm); }); cr.im.instanceMatrix.needsUpdate = true; }
    },
    dispose() { scene.remove(root); for (const d of disposables) d.dispose?.(); },
  };
}
