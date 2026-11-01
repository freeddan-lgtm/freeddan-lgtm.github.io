// Moon Palace Cancún — an Agent World expansion pack (v1.0.0). Owned by Daniel (see LICENSE).
// Engine-agnostic: works in any three.js (r150+) scene, including Daniel's original Agent World.
//   import { installMoonPalace } from './moon-palace-cancun.js';
//   const mp = installMoonPalace({ THREE, scene, pack, at, facing, connectFrom, makeLabel });
//   every frame: mp.update(dt, t, id => energy, tod, camera)  ·  picking: mp.pickables  ·  remove: mp.dispose()
// An artistic model of a beach-resort concert (beach stage with its back to the sea, sand sections, a pool and
// lobby, resort blocks, palms, palapas, a zip line from Show Island). It is not a survey of the real resort, and it
// is not affiliated with the resort or with any band. Venue-local axes: the stage is at z = -14 and faces +z;
// house right is +x; +z points back toward Show Island. These match MOON_PALACE_SPEC in src/architect.js.

// Mean-motion moon phase (reference new moon 2000-01-06 18:14 UTC, synodic month 29.530588853 d).
// Checked against the 2027-08-02 total-eclipse new moon: off by about 6.5 h, so treat the phase as ±0.5 day.
export function moonPhase(date) {
  const syn = 29.530588853, days = (date.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000;
  const age = ((days % syn) + syn) % syn, illum = (1 - Math.cos(2 * Math.PI * age / syn)) / 2;
  const names = [[1.85, 'a new moon'], [5.54, 'a waxing crescent'], [9.23, 'a first-quarter moon'], [12.92, 'a waxing gibbous moon'], [16.61, 'a full moon'], [20.3, 'a waning gibbous moon'], [23.99, 'a last-quarter moon'], [27.68, 'a waning crescent'], [99, 'a new moon']];
  const fmt = h => { h = ((h % 24) + 24) % 24; const m = Math.round(h * 60); return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  // Rise window from two mean-motion anchors (Cancún, late January: sunset ≈ 18:15, sunrise ≈ 07:12, UTC-5);
  // the moon rises on average 48.8 min later each day. The true time can differ from both anchors.
  const a = 18.25 + (age - 14.765) * 0.8127, b = 7.2 + age * 0.8127;
  return { age, illum, phase: names.find(n => age < n[0])[1], riseFrom: fmt(Math.min(a, b)), riseTo: fmt(Math.max(a, b)), waning: age > 14.765 };
}

export function installMoonPalace({ THREE, scene, pack, at, facing = 0, radius = 56, connectFrom = null, makeLabel = null, quality = 'high', showDate = new Date(Date.UTC(2027, 0, 30, 3, 0)) }) {
  const root = new THREE.Group(); root.name = 'pack:moon-palace-cancun'; root.position.copy(at); root.rotation.y = facing; scene.add(root);
  const anims = [], pickables = [], disposables = [], nightGlow = [];
  let seed = 7121; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const M = (color, o = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, envMapIntensity: 0.3, ...o }); disposables.push(m); return m; };
  const glow = (color, k = 2) => M(color, { emissive: color, emissiveIntensity: k, roughness: 0.4 });
  const G = g => { disposables.push(g); return g; };
  const mesh = (geo, mat, parent, x = 0, y = 0, z = 0, shadow = true) => { const m = new THREE.Mesh(G(geo), mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m; };
  const label = (html, cls, pos, parent = root) => { if (!makeLabel) return null; const o = makeLabel(html, cls); o.position.copy(pos); parent.add(o); return o; };
  const flat = (pts, y = 0) => { const s = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z))); s.closePath(); const g = new THREE.ShapeGeometry(s, 12).rotateX(-Math.PI / 2); g.translate(0, y, 0); return G(g); };
  const shoreZ = x => -22 + 1.2 * Math.sin(x * 0.18) + 0.5 * Math.sin(x * 0.47 + 1);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), col = new THREE.Color();

  // ---------- island: sand top, lawn by the resort, rock underside ----------
  const top = new THREE.Mesh(G(new THREE.CylinderGeometry(radius, radius * 0.97, 2.2, 128)), [M(0xb08a5e), M(0xead8b0, { roughness: 0.98 }), M(0x6b5a62)]);
  top.position.y = -1.1; top.receiveShadow = true; root.add(top);
  const depth = 32, rg = G(new THREE.ConeGeometry(radius * 0.97, depth, 72, 10, true).rotateX(Math.PI)), rp = rg.attributes.position, rv = new THREE.Vector3(), rc = [];
  for (let i = 0; i < rp.count; i++) { rv.fromBufferAttribute(rp, i); const k = (depth / 2 - rv.y) / depth, n = Math.sin(rv.x * 0.31 + 1) * Math.cos(rv.z * 0.27) + 0.5 * Math.sin(rv.y * 0.6 + rv.x * 0.2), s = 1 + (k > 0.04 ? 0.15 * n * Math.min(1, k * 4) : 0); rp.setXYZ(i, rv.x * s, rv.y + (k > 0.04 ? n : 0), rv.z * s); col.set(0xa58663).lerp(new THREE.Color(0x40355e), k); rc.push(col.r, col.g, col.b); }
  rg.setAttribute('color', new THREE.Float32BufferAttribute(rc, 3)); rg.computeVertexNormals();
  const rockM = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }); disposables.push(rockM);
  const rock = new THREE.Mesh(rg, rockM); rock.position.y = -2.2 - depth / 2; root.add(rock);
  const arc = (r, a0, a1, n = 48) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [Math.sin(a) * r, Math.cos(a) * r]; });
  const lawnA = Math.acos(30 / (radius - 0.6));
  mesh(flat(arc(radius - 0.6, -lawnA, lawnA), 0.02), M(0x5f9a4a, { roughness: 0.95 }), root, 0, 0, 0, false);

  // ---------- the sea: turquoise shallows, deep blue offshore, moving glints and foam at the shore ----------
  const seaPts = []; for (let x = -radius; x <= radius; x += 2) { const z = shoreZ(x); if (x * x + z * z < (radius - 0.6) ** 2) seaPts.push([x, z]); }
  const waterU = { time: { value: 0 }, night: { value: 0 }, pool: { value: 0 } };
  const waterMat = (pool) => { const m = new THREE.ShaderMaterial({ uniforms: { time: waterU.time, night: waterU.night, pool: { value: pool } }, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vL; void main(){ vL = position.xz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform float time; uniform float night; uniform float pool; varying vec2 vL;
      float shoreZ(float x){ return -22. + 1.2*sin(x*.18) + .5*sin(x*.47 + 1.); }
      void main(){
        float d = pool > .5 ? .25 : clamp((shoreZ(vL.x) - vL.y) / 26., 0., 1.);
        vec3 shallow = pool > .5 ? vec3(.36,.86,.92) : vec3(.20,.80,.78), deep = vec3(.03,.22,.42);
        vec3 c = mix(shallow, deep, smoothstep(0., 1., d));
        float w = sin(vL.x*.35 + time*1.1)*.5 + sin(vL.y*.55 - time*.8 + vL.x*.12)*.5;
        c += vec3(.10) * smoothstep(.62, 1., w) * (1. - d*.6);
        if (pool < .5) { float sd = shoreZ(vL.x) - vL.y; float foam = smoothstep(1.2, 0., abs(sd - (.7 + .45*sin(time*.9 + vL.x*.3)))); c = mix(c, vec3(.96), foam*.75); }
        c *= mix(1., .32, night); c += vec3(.02,.03,.08)*night;
        gl_FragColor = vec4(c, pool > .5 ? .9 : .94);
      }` }); disposables.push(m); return m; };
  const [x0s, z0s] = seaPts[0], [x1s, z1s] = seaPts[seaPts.length - 1]; // shoreline (west to east), then the rim on the sea side
  const seaShape = [...seaPts, ...arc(radius - 0.6, Math.atan2(x1s, z1s), 2 * Math.PI + Math.atan2(x0s, z0s))];
  const sea = mesh(flat(seaShape, 0.03), waterMat(0), root, 0, 0, 0, false); sea.renderOrder = 1;

  // ---------- beach stage: deck, white canopy, LED wall, line arrays, beams, a four-piece band ----------
  const stage = new THREE.Group(); stage.position.set(0, 0, -14); root.add(stage);
  const dark = M(0x23202d, { roughness: 0.6, metalness: 0.3 }), truss = M(0xc5cad6, { metalness: 0.8, roughness: 0.35 }), canvasW = M(0xf4f1ea, { roughness: 0.55, side: THREE.DoubleSide });
  const deck = mesh(new THREE.BoxGeometry(20, 1.6, 10), dark, stage, 0, 0.8, -1.5);
  mesh(new THREE.BoxGeometry(20, 0.12, 0.14), glow(0x2dd4bf, 2.6), stage, 0, 1.62, 3.45, false);
  for (const x of [-10.2, 10.2]) for (const z of [3, -6]) mesh(new THREE.BoxGeometry(0.5, 13.5, 0.5), truss, stage, x, 6.75, z);
  const canopy = mesh(new THREE.CylinderGeometry(16, 16, 11, 32, 1, true, -0.72, 1.44).rotateX(-Math.PI / 2), canvasW, stage, 0, 1.3, -1.5); // a white arched sail roof
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 448; const cx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; disposables.push(tex);
  const screenM = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }); disposables.push(screenM);
  const screen = mesh(new THREE.PlaneGeometry(14, 6.1), screenM, stage, 0, 7.2, -6.1, false);
  mesh(new THREE.BoxGeometry(14.8, 6.8, 0.3), dark, stage, 0, 7.2, -6.35);
  const boxes = new THREE.InstancedMesh(G(new THREE.BoxGeometry(1.5, 0.62, 1.1)), M(0x15141c), 16); let bi = 0;
  for (const sx2 of [-1, 1]) for (let k = 0; k < 8; k++) { q.setFromEuler(new THREE.Euler(0.06 * k, 0, 0)); m4.compose(v3.set(sx2 * 9.2, 12 - k * 0.64, 2.2), q, one); boxes.setMatrixAt(bi++, m4); }
  boxes.castShadow = true; stage.add(boxes);
  const coneGeo = G(new THREE.ConeGeometry(2.2, 12, 28, 1, true).translate(0, -6, 0)), cones = [];
  for (let i = 0; i < 4; i++) {
    const cm = new THREE.ShaderMaterial({ uniforms: { color: { value: new THREE.Color(i % 2 ? 0x7ef0e4 : 0xffc27a) }, k: { value: 0.2 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = -position.y/12.; vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 color; uniform float k; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float e = pow(abs(dot(vN, vV)), 1.6); float a = k*(1.-vY)*(1.-vY)*e; gl_FragColor = vec4(color*a, a); }' });
    disposables.push(cm); const piv = new THREE.Group(); piv.position.set(-6 + i * 4, 12.6, 2.4); stage.add(piv); const c = new THREE.Mesh(coneGeo, cm); c.rotation.x = -0.4; piv.add(c); cones.push({ piv, m: cm, ph: i * 1.6 });
  }
  const performers = [];
  [[-4, 0], [4, -0.3], [-1.4, -2.6], [1.8, -2.9]].forEach(([x, z], i) => {
    const p = new THREE.Group(); p.position.set(x, 1.6, z); stage.add(p); performers.push(p);
    mesh(new THREE.CapsuleGeometry(0.44, 0.72, 4, 10), M([0xffffff, 0x2dd4bf, 0xffd166, 0xb9b0d6][i]), p, 0, 0.88, 0);
    mesh(new THREE.SphereGeometry(0.38, 16, 12), M(0xe9c9a9), p, 0, 1.78, 0);
    if (i < 2) mesh(new THREE.BoxGeometry(0.9, 0.32, 0.08), M(i ? 0x2b2b2b : 0xc0392b, { roughness: 0.3 }), p, 0, 0.88, 0.46).rotation.z = 0.5;
    if (i === 2) mesh(new THREE.BoxGeometry(1.6, 0.12, 0.5), M(0x111111), p, 0, 0.98, 0.65);
    if (i === 3) for (const dx of [-0.7, 0, 0.7]) mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.35, 16), M(0xe8e8f0, { metalness: 0.4 }), p, dx, 0.45, 0.7);
  });
  deck.userData.pick = screen.userData.pick = canopy.userData.pick = { kind: 'pack-venue', pack: pack.id, id: 'mp-beach' }; pickables.push(deck, screen, canopy);
  label(`<b>🌴 Moon Palace Cancún</b><small>Moon Palace Cancún pack</small>`, 'zone big', new THREE.Vector3(0, 17.5, -14));

  // ---------- soundboard (FOH) tent and delay towers: moved by Keystone Claude's layout search ----------
  const foh = new THREE.Group(); foh.userData.dynamic = true; root.add(foh);
  mesh(new THREE.ConeGeometry(3.3, 2.4, 4, 1).rotateY(Math.PI / 4), M(0xfbfaf6, { roughness: 0.6 }), foh, 0, 3.6, 0);
  for (const [a, b] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), M(0x9aa0aa, { metalness: 0.7 }), foh, a, 1.2, b);
  mesh(new THREE.BoxGeometry(2.6, 0.9, 1.1), M(0x1d1d26, { metalness: 0.4 }), foh, 0, 0.45, -0.4);
  mesh(new THREE.BoxGeometry(2.4, 0.06, 0.9), glow(0x7ef0e4, 1.2), foh, 0, 0.93, -0.4, false);
  label('<b>🎚️ Back by soundboard</b>', 'zone', new THREE.Vector3(0, 5.6, 0), foh);
  const towers = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group(); g.userData.dynamic = true; g.visible = false; root.add(g);
    for (const [a, b] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) mesh(new THREE.BoxGeometry(0.1, 6.2, 0.1), truss, g, a, 3.1, b);
    mesh(new THREE.BoxGeometry(1.5, 0.12, 1.5), truss, g, 0, 5, 0);
    const spk = mesh(new THREE.BoxGeometry(1.2, 1.5, 1.0), M(0x15141c), g, 0, 6, 0); mesh(new THREE.CircleGeometry(0.42, 18), M(0x333340, { metalness: 0.6 }), spk, 0, 0, 0.51, false);
    mesh(new THREE.SphereGeometry(0.1, 8, 6), glow(0xff3344, 3), g, 0, 6.95, 0, false);
    towers.push({ g, cur: new THREE.Vector3(), tgt: new THREE.Vector3(), on: false });
  }
  const fohCur = new THREE.Vector3(0, 0, 12.5), fohTgt = fohCur.clone(); foh.position.copy(fohCur);

  // ---------- coverage heat map (modeled level, shown on the sand when asked) ----------
  const hc = document.createElement('canvas'); hc.width = 48; hc.height = 40; const hx = hc.getContext('2d');
  const htex = new THREE.CanvasTexture(hc); htex.colorSpace = THREE.SRGBColorSpace; htex.magFilter = THREE.LinearFilter; disposables.push(htex);
  const heatM = new THREE.MeshBasicMaterial({ map: htex, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false }); disposables.push(heatM);
  const heat = mesh(new THREE.PlaneGeometry(48, 38).rotateX(-Math.PI / 2), heatM, root, 0, 0.09, 9, false); heat.visible = false; heat.renderOrder = 2; heat.userData.dynamic = true;

  // ---------- crowd on the sand, bouncing on the beat ----------
  const crowdPts = [], spots = {};
  const SECTIONS = { 'Beach pit / front': [-12, 12, -7, -0.5, 110], 'Beach middle': [-16, 16, 0.5, 10.5, 140], 'Back by soundboard': [-20, 20, 11.5, 25, 120] };
  for (const [x0, x1, z0, z1, n] of Object.values(SECTIONS)) for (let i = 0; i < n; i++) crowdPts.push([x0 + rnd() * (x1 - x0), z0 + rnd() * (z1 - z0), rnd() * 6]);
  const crowd = new THREE.InstancedMesh(G(new THREE.CapsuleGeometry(0.26, 0.45, 3, 8)), M(0xffffff, { roughness: 0.6 }), crowdPts.length);
  crowdPts.forEach(([x, z], i) => { m4.makeTranslation(x, 0.5, z); crowd.setMatrixAt(i, m4); col.setHSL(rnd(), 0.5, 0.58); crowd.setColorAt(i, col); });
  crowd.castShadow = true; crowd.userData.dynamic = true; root.add(crowd);
  let hidden = new Set();
  const reseatCrowd = () => { hidden = new Set(); crowdPts.forEach(([x, z], i) => { if (Math.hypot(x - fohTgt.x, z - fohTgt.z) < 3.4 || towers.some(t => t.on && Math.hypot(x - t.tgt.x, z - t.tgt.z) < 1.5)) hidden.add(i); }); };

  // ---------- palms, palapas, loungers (instanced) ----------
  const trunkCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.35, 2.4, 0), new THREE.Vector3(0.95, 4.6, 0), new THREE.Vector3(1.6, 6.4, 0)]);
  const trunkG = G(new THREE.TubeGeometry(trunkCurve, 10, 0.2, 7)), leafPos = [];
  for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; for (let s = 0; s < 6; s++) { const u0 = s / 6, u1 = (s + 1) / 6, r0 = u0 * 3.2, r1 = u1 * 3.2, y0 = -Math.pow(u0, 1.6) * 1.8, y1 = -Math.pow(u1, 1.6) * 1.8, w0 = Math.sin(Math.PI * Math.max(0.12, u0)) * 0.5, w1 = Math.sin(Math.PI * Math.max(0.12, u1)) * 0.5, ca = Math.cos(a), sa = Math.sin(a), px = -sa, pz = ca;
    const A = [ca * r0 + px * w0, y0, sa * r0 + pz * w0], B = [ca * r0 - px * w0, y0, sa * r0 - pz * w0], C = [ca * r1 + px * w1, y1, sa * r1 + pz * w1], D = [ca * r1 - px * w1, y1, sa * r1 - pz * w1];
    leafPos.push(...A, ...B, ...C, ...B, ...D, ...C); } }
  const leafG = G(new THREE.BufferGeometry()); leafG.setAttribute('position', new THREE.Float32BufferAttribute(leafPos, 3)); leafG.computeVertexNormals(); leafG.translate(1.6, 6.4, 0);
  const palmSpots = [];
  for (let i = 0; i < 18; i++) palmSpots.push([-27 - rnd() * 22, -20 + i * 2.6 + rnd()]);
  for (let i = 0; i < 18; i++) palmSpots.push([27 + rnd() * 22, -20 + i * 2.6 + rnd()]);
  for (let i = 0; i < 12; i++) { const a = -0.9 + i * 0.165; palmSpots.push([Math.sin(a) * 50, Math.cos(a) * 50 - 6]); }
  const okIsland = (x, z) => x * x + z * z < (radius - 3) ** 2 && z > shoreZ(x) + 2;
  const palms = palmSpots.filter(([x, z]) => okIsland(x, z));
  const trunkI = new THREE.InstancedMesh(trunkG, M(0x8a6a48, { roughness: 0.95 }), palms.length), leafI = new THREE.InstancedMesh(leafG, M(0x3f8f3a, { roughness: 0.8, side: THREE.DoubleSide }), palms.length);
  palms.forEach(([x, z], i) => { const s = 0.85 + rnd() * 0.45; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI * 2); m4.compose(v3.set(x, 0, z), q, new THREE.Vector3(s, s, s)); trunkI.setMatrixAt(i, m4); leafI.setMatrixAt(i, m4); col.setHSL(0.27 + rnd() * 0.06, 0.5, 0.33 + rnd() * 0.08); leafI.setColorAt(i, col); });
  trunkI.castShadow = leafI.castShadow = true; root.add(trunkI, leafI);
  const palapaSpots = []; for (let i = 0; i < 8; i++) for (const s2 of [-1, 1]) palapaSpots.push([s2 * (29 + (i % 2) * 6), -17 + i * 3.1]);
  const thatchI = new THREE.InstancedMesh(G(new THREE.ConeGeometry(2.1, 1.3, 10)), M(0xc9a15a, { roughness: 1, flatShading: true }), palapaSpots.length);
  const poleI = new THREE.InstancedMesh(G(new THREE.CylinderGeometry(0.08, 0.1, 2.6, 6)), M(0x7a5a3a), palapaSpots.length);
  const loungeI = new THREE.InstancedMesh(G(new THREE.BoxGeometry(0.7, 0.25, 1.9)), M(0xfdfcf8, { roughness: 0.5 }), palapaSpots.length * 2);
  palapaSpots.forEach(([x, z], i) => { m4.makeTranslation(x, 2.9, z); thatchI.setMatrixAt(i, m4); m4.makeTranslation(x, 1.3, z); poleI.setMatrixAt(i, m4); for (const d of [-0.9, 0.9]) { q.setFromEuler(new THREE.Euler(-0.12, 0, 0)); m4.compose(v3.set(x + d, 0.3, z + 1.6), q, one); loungeI.setMatrixAt(i * 2 + (d > 0 ? 1 : 0), m4); } });
  thatchI.castShadow = poleI.castShadow = loungeI.castShadow = true; root.add(thatchI, poleI, loungeI);

  // ---------- resort: terraced hotel blocks with lit windows, lobby palapa, pool, Messenger kiosk ----------
  const white = M(0xf5efe4, { roughness: 0.8 }), terra = M(0xc0673f, { roughness: 0.85 }), winM = glow(0xffd9a0, 1.6); nightGlow.push(winM);
  const block = (x, z, ry, w) => { const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = ry; root.add(b);
    const tiers = [[w, 9.6, 7, 0], [w - 4, 6.4, 5.4, -1.2], [w - 10, 3.2, 3.6, -2.4]];
    for (const [ww, h, d, zz] of tiers) { mesh(new THREE.BoxGeometry(ww, 3.2, d), white, b, 0, h - 1.6, zz); mesh(new THREE.BoxGeometry(ww + 0.4, 0.35, d + 0.4), terra, b, 0, h + 0.17, zz); }
    return b; };
  const blocks = [block(0, 47, 0, 46), block(-38, 30, 0.95, 24), block(38, 30, -0.95, 24)];
  let wn = 0; const winSpots = [];
  blocks.forEach((b, bi2) => { const w = bi2 ? 24 : 46; [[w, 9.6, 7, 0], [w - 4, 6.4, 5.4, -1.2], [w - 10, 3.2, 3.6, -2.4]].forEach(([ww, h, d, zz]) => { for (let x = -ww / 2 + 1.2; x < ww / 2 - 0.8; x += 2.2) winSpots.push([b, x, h - 1.4, zz - d / 2 - 0.02]); }); });
  const winI = new THREE.InstancedMesh(G(new THREE.PlaneGeometry(1.2, 1.4)), winM, winSpots.length);
  const wq = new THREE.Quaternion(), wm = new THREE.Matrix4();
  for (const [b, x, y, z] of winSpots) { b.updateMatrixWorld(true); wm.compose(v3.set(x, y, z), wq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI), one); m4.copy(root.matrixWorld).invert().multiply(b.matrixWorld).multiply(wm); winI.setMatrixAt(wn++, m4); }
  root.add(winI);
  const lobby = new THREE.Group(); lobby.position.set(-26, 0, 37); root.add(lobby);
  mesh(new THREE.ConeGeometry(7.5, 4.2, 12), M(0xbf9452, { roughness: 1, flatShading: true }), lobby, 0, 6.3, 0);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; mesh(new THREE.CylinderGeometry(0.22, 0.26, 4.2, 8), M(0x8a5a3c), lobby, Math.sin(a) * 5.4, 2.1, Math.cos(a) * 5.4); }
  mesh(new THREE.CylinderGeometry(6, 6, 0.3, 24), M(0xe8ddc6), lobby, 0, 0.15, 0);
  mesh(new THREE.BoxGeometry(4, 1.1, 1), M(0x6b4423), lobby, 0, 0.85, -1.5);
  const poolShape = new THREE.Shape(); const pw = 8, ph = 4, pr = 2.4; poolShape.moveTo(-pw + pr, -ph); poolShape.lineTo(pw - pr, -ph); poolShape.quadraticCurveTo(pw, -ph, pw, -ph + pr); poolShape.lineTo(pw, ph - pr); poolShape.quadraticCurveTo(pw, ph, pw - pr, ph); poolShape.lineTo(-pw + pr, ph); poolShape.quadraticCurveTo(-pw, ph, -pw, ph - pr); poolShape.lineTo(-pw, -ph + pr); poolShape.quadraticCurveTo(-pw, -ph, -pw + pr, -ph);
  const poolG = G(new THREE.ShapeGeometry(poolShape, 10).rotateX(-Math.PI / 2));
  mesh(G(new THREE.BoxGeometry(18.4, 0.2, 10.4)), M(0xe9e2d2), root, -24, 0.1, 24, false);
  const pool = mesh(poolG, waterMat(1), root, -24, 0.22, 24, false); pool.renderOrder = 1;
  const kiosk = new THREE.Group(); kiosk.position.set(25, 0, 31); root.add(kiosk);
  mesh(new THREE.BoxGeometry(3.6, 2.4, 2.4), M(0x0866ff, { roughness: 0.5 }), kiosk, 0, 1.2, 0); mesh(new THREE.BoxGeometry(4.2, 0.25, 3), white, kiosk, 0, 2.55, 0);
  label('<b>🏊 Pool & lobby</b>', 'zone', new THREE.Vector3(-24, 4.5, 26));
  label('<b>💬 Meet on Messenger</b>', 'zone', new THREE.Vector3(25, 4.6, 31));
  label('<b>🏖️ Beach pit / front</b>', 'zone', new THREE.Vector3(0, 3.6, -3.2));
  label('<b>Beach middle</b>', 'zone', new THREE.Vector3(-13, 3, 6));

  // ---------- tiki torches along the path from the lobby to the beach ----------
  const torchSpots = []; for (let i = 0; i < 9; i++) for (const s2 of [-1, 1]) torchSpots.push([-12 + s2 * 2.2 - i * 1.4, 30 - i * 3.4]);
  const torchI = new THREE.InstancedMesh(G(new THREE.CylinderGeometry(0.06, 0.08, 2, 6)), M(0x5b3d26), torchSpots.length);
  torchSpots.forEach(([x, z], i) => { m4.makeTranslation(x, 1, z); torchI.setMatrixAt(i, m4); }); root.add(torchI);
  const fc = document.createElement('canvas'); fc.width = fc.height = 64; const fx = fc.getContext('2d'), fg = fx.createRadialGradient(32, 32, 0, 32, 32, 32);
  fg.addColorStop(0, 'rgba(255,240,190,1)'); fg.addColorStop(0.3, 'rgba(255,160,60,.75)'); fg.addColorStop(1, 'rgba(255,90,20,0)'); fx.fillStyle = fg; fx.fillRect(0, 0, 64, 64);
  const ftex = new THREE.CanvasTexture(fc); disposables.push(ftex);
  const fgeo = G(new THREE.BufferGeometry()); fgeo.setAttribute('position', new THREE.Float32BufferAttribute(torchSpots.flatMap(([x, z]) => [x, 2.15, z]), 3));
  const flameM = new THREE.PointsMaterial({ size: 1.1, map: ftex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffb070 }); disposables.push(flameM);
  const flames = new THREE.Points(fgeo, flameM); root.add(flames);

  // ---------- zip line from Show Island ----------
  root.updateMatrixWorld(true);
  const STATION = new THREE.Vector3(0, 0, radius - 3.5); let zip = null;
  if (connectFrom) {
    const here = root.localToWorld(STATION.clone()), zg = new THREE.Group(); scene.add(zg); disposables.push({ dispose: () => scene.remove(zg) });
    const tower = w => { const s = new THREE.Group(); s.position.copy(w); zg.add(s); mesh(new THREE.BoxGeometry(2.8, 0.4, 2.8), M(0x6b4a33), s, 0, 0.2, 0); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(new THREE.BoxGeometry(0.25, 12.5, 0.25), M(0x8892a6, { metalness: 0.6 }), s, a, 6.25, b); mesh(new THREE.BoxGeometry(3.2, 0.5, 3.2), M(0x2dd4bf), s, 0, 12.4, 0); };
    tower(connectFrom); tower(here);
    const A = connectFrom.clone().setY(12), B = here.clone().setY(12), mid = A.clone().lerp(B, 0.5); mid.y -= 3.2;
    const cable = new THREE.QuadraticBezierCurve3(A, mid, B); zg.add(new THREE.Mesh(G(new THREE.TubeGeometry(cable, 60, 0.05, 5)), M(0x222222)));
    const lift = u => cable.getPoint(u).add(new THREE.Vector3(0, -2.5, 0)); // riders hang 2.5 m under the cable
    const ride = new THREE.CatmullRomCurve3([connectFrom.clone().setY(0), connectFrom.clone().setY(4.5), lift(0), lift(0.25), lift(0.5), lift(0.75), lift(1), here.clone().setY(4.5), here.clone().setY(0)]);
    zip = { from: connectFrom.clone(), to: here.clone(), ride, dur: 10 };
    label('<b>🚡 Zip line to Moon Palace</b>', 'zone', connectFrom.clone().setY(14.5), scene);
  }

  // ---------- the moon for the show night (phase from the date; drawn low over the sea, rising after the show) ----------
  const moonPh = moonPhase(showDate);
  const mc = document.createElement('canvas'); mc.width = mc.height = 512; const mx = mc.getContext('2d');
  const mg = mx.createRadialGradient(256, 256, 0, 256, 256, 250); mg.addColorStop(0, '#f4f1e6'); mg.addColorStop(0.85, '#e2ddce'); mg.addColorStop(1, '#c7c1b0');
  mx.save(); mx.translate(256, 256); mx.rotate(moonPh.waning ? 2.6 : -0.5); mx.translate(-256, -256);
  mx.fillStyle = mg; mx.beginPath(); mx.arc(256, 256, 250, 0, Math.PI * 2); mx.fill();
  for (const [x, y, r] of [[210, 180, 70], [290, 150, 55], [300, 220, 60], [170, 260, 60], [240, 270, 45]]) { const g2 = mx.createRadialGradient(x, y, 0, x, y, r); g2.addColorStop(0, 'rgba(90,88,84,.3)'); g2.addColorStop(1, 'rgba(90,88,84,0)'); mx.fillStyle = g2; mx.beginPath(); mx.arc(x, y, r, 0, Math.PI * 2); mx.fill(); }
  // night side: the unlit part of the disc (terminator as an ellipse whose width follows the lit fraction)
  const kx = Math.abs(1 - 2 * moonPh.illum) * 250; mx.fillStyle = 'rgba(14,16,34,0.94)'; mx.beginPath();
  mx.arc(256, 256, 250.5, Math.PI / 2, -Math.PI / 2, false); mx.ellipse(256, 256, kx, 250.5, 0, -Math.PI / 2, Math.PI / 2, moonPh.illum > 0.5); mx.fill(); mx.restore();
  const mtex = new THREE.CanvasTexture(mc); mtex.colorSpace = THREE.SRGBColorSpace; disposables.push(mtex);
  const moonM = new THREE.SpriteMaterial({ map: mtex, fog: false, depthWrite: false, transparent: true }); disposables.push(moonM);
  const moon = new THREE.Sprite(moonM); moon.position.set(-60, 26, -430); moon.scale.set(40, 40, 1); moon.userData.dynamic = true; root.add(moon);

  // ---------- spots, seats, picking ----------
  root.updateMatrixWorld(true);
  const W = (x, z) => root.localToWorld(new THREE.Vector3(x, 0, z));
  Object.assign(spots, { pit: W(0, -5), middle: W(0, 5), back: W(0, 18), pool: W(-22, 30.5), lobby: W(-26, 37), messenger: W(25, 34), station: W(STATION.x, STATION.z - 3), office: W(6, 14) });
  const SEAT = { 'Beach pit / front': [0, -5.2, 9, 2.2], 'Beach middle': [0, 4.5, 12, 3], 'Back by soundboard': null, 'Pool & lobby': [-22, 30.5, 7, 1.5], 'Meet on Messenger 💬': [25, 34.5, 5, 1.2] };
  const seat = (section, i) => { let s = SEAT[section]; if (s === undefined) s = SEAT['Meet on Messenger 💬']; if (!s) s = [fohCur.x + 3.6, fohCur.z + 1, 4, 1.5]; const [x, z, w, d] = s, k = i % 6, row = Math.floor(i / 6); return { pos: W(x + (k - 2.5) * (w / 6), z + row * d * 0.8 - (k % 2) * 0.6), look: W(0, -14) }; };
  const local = p => root.worldToLocal(p.clone());
  const contains = p => { const l = local(p); return l.x * l.x + l.z * l.z < (radius - 0.5) ** 2; };
  const inConcert = p => { const l = local(p); return Math.abs(l.x) < 22 && l.z > -8 && l.z < 26 && contains(p); };
  const stagePos = W(0, -14).setY(4);
  const venues = [{ id: 'mp-beach', name: 'Moon Palace Cancún', emoji: '🌴', color: '#2dd4bf', venue: pack.venues[0], pos: stagePos, pit: spots.pit, energy: { low: 0, mid: 0, high: 0, level: 0 } }];
  let drawT = 0, sweep = 0, info = '', lastT = 0;

  function drawScreen(t, e) {
    const w = 1024, h = 448, gr = cx.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#04131c'); gr.addColorStop(1, '#0b5c63'); cx.fillStyle = gr; cx.fillRect(0, 0, w, h);
    cx.save(); cx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) { const r = ((t * 36 + i * 64) % 450) * (0.9 + e.low * 0.2); cx.strokeStyle = `rgba(45,212,191,${0.18 + 0.3 * e.mid})`; cx.lineWidth = 6; cx.beginPath(); cx.arc(w / 2, h * 0.62, r, 0, Math.PI * 2); cx.stroke(); }
    cx.restore(); cx.fillStyle = '#fff'; cx.textAlign = 'center'; cx.font = '800 64px system-ui, sans-serif'; cx.fillText('RIVIERA MAYA', w / 2, 120);
    cx.font = '600 34px system-ui, sans-serif'; cx.fillStyle = '#ffd9a0'; cx.fillText(info || 'Moon Palace Cancún · beach stage', w / 2, 178);
    const n = 48; for (let i = 0; i < n; i++) { const v = (Math.sin(t * 3 + i * 0.5) * 0.5 + 0.5) * (0.15 + e.level * 0.85); cx.fillStyle = `hsl(${170 + i * 2},80%,${55 + v * 20}%)`; cx.fillRect(40 + i * (w - 80) / n, h - 30 - v * 190, (w - 80) / n - 4, v * 190); }
    tex.needsUpdate = true;
  }
  drawScreen(0, venues[0].energy);

  return {
    id: pack.id, root, venues, pickables, spots, seat, contains, inConcert, local, zip, moon, moonInfo: moonPh, nightGlow, center: at.clone(), radius,
    setInfo(s) { info = s; },
    applyDesign(d, snap = false) {
      fohTgt.set(d.foh.x, 0, d.foh.z);
      towers.forEach((t, i) => { const p = d.towers[i]; t.on = !!p; if (p) { t.tgt.set(p.x, 0, p.z); if (!t.g.visible || snap) { t.cur.copy(t.tgt); t.g.position.copy(t.cur); } } t.g.visible = t.on; });
      if (snap) { fohCur.copy(fohTgt); foh.position.copy(fohCur); }
      reseatCrowd();
    },
    setCoverage(grid, band = [92, 102]) {
      if (!grid) { heat.visible = false; return; }
      const img = hx.createImageData(grid.nx, grid.nz);
      for (let j = 0; j < grid.nz; j++) for (let i = 0; i < grid.nx; i++) { const L = grid.g[j * grid.nx + i], o = ((grid.nz - 1 - j) * grid.nx + i) * 4; let r, g, b;
        if (L < band[0]) { const k = Math.max(0, Math.min(1, (band[0] - L) / 8)); r = 40; g = 120 - 60 * k; b = 255; } else if (L <= band[1]) { const k = (L - band[0]) / (band[1] - band[0]); r = 40 + 200 * k; g = 220; b = 90 - 60 * k; } else { r = 255; g = 70; b = 50; }
        img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 200; }
      hx.putImageData(img, 0, 0); htex.needsUpdate = true; heat.visible = true;
    },
    update(dt, t, energyOf, tod = 'dusk', camera = null) {
      for (const f of anims) f(dt, t);
      const e = energyOf?.('mp-beach'); if (e) venues[0].energy = e; const en = venues[0].energy;
      waterU.time.value = t; waterU.night.value = tod === 'night' ? 1 : tod === 'dusk' ? 0.35 : 0;
      if (t < lastT) sweep = 0; lastT = t; // the scene clock was reset (replayable test frames)
      const beatHz = en.bpm ? en.bpm / 60 : 0.5; sweep += dt * beatHz * Math.PI / 4;
      cones.forEach((c, i) => { c.piv.rotation.z = Math.sin(sweep + c.ph) * 0.4; c.piv.rotation.x = Math.cos(sweep * 0.5 + c.ph) * 0.15; c.m.uniforms.k.value = (tod === 'day' ? 0.05 : 0.15) + en.level * 0.32; });
      performers.forEach((p, i) => { p.position.y = 1.6 + (en.bpm ? Math.sin(Math.PI * (en.beat || 0)) * 0.09 * (0.4 + en.level) : Math.sin(t * 2 + i) * 0.02); p.rotation.y = Math.sin(sweep * 0.5 + i) * 0.25; });
      const k = 1 - Math.exp(-dt * 2.5); fohCur.lerp(fohTgt, k); foh.position.copy(fohCur);
      for (const tw of towers) if (tw.on) { tw.cur.lerp(tw.tgt, k); tw.g.position.copy(tw.cur); tw.g.rotation.y = Math.atan2(tw.cur.x, tw.cur.z + 14); }
      const mm = new THREE.Matrix4();
      crowdPts.forEach(([x, z, p], i) => { if (hidden.has(i)) mm.makeScale(0, 0, 0); else mm.makeTranslation(x, 0.5 + (en.bpm ? Math.abs(Math.sin(Math.PI * ((en.beat || 0) * 0.5 + p * 0.02))) * (0.02 + en.level * 0.08) : 0), z); crowd.setMatrixAt(i, mm); });
      crowd.instanceMatrix.needsUpdate = true;
      flameM.size = 1.0 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.06; flameM.opacity = tod === 'day' ? 0.35 : 1;
      moon.visible = tod !== 'day'; moonM.opacity = tod === 'night' ? 1 : 0.55;
      if (camera) { const near = camera.position.distanceTo(stagePos) < 110; if (near) { drawT -= dt; if (drawT <= 0) { drawT = 1 / 15; drawScreen(t, en); } } }
    },
    dispose() { scene.remove(root); for (const d of disposables) d.dispose?.(); },
  };
}
