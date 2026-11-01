// Agent World · Claude Edition (v2.0, Keystone build) — optimize.js
// Render optimizations that the Keystone build loop measures and gates (tools/rsi/build_loop.mjs). Each one is a
// flag in window.AW_CONFIG.opt (or ?opt=a,b / ?opt=none) so the loop can switch it on and off and keep only what
// measurably helps without changing the picture.
//   casters — small meshes (eyes, pupils, trinkets) stop casting shadows: fewer shadow-pass draw calls.
//   batch   — meshes that never move relative to their parent are merged per material ("static batching"),
//             found by watching every object for a moment instead of guessing. Merges never cross a top-level
//             group (an island, a stage, a pack) and loose meshes are bucketed in 48 m cells, so frustum culling
//             still skips what is off screen.
//   screens — handled in world.js: LED walls redraw only when on screen and near, at 15 Hz.
import { THREE } from './world.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function cullSmallCasters(scene, minRadius = 0.3) {
  let n = 0; const s = new THREE.Vector3(); scene.updateMatrixWorld(true);
  scene.traverse(o => {
    if (!o.isMesh || !o.castShadow || o.isInstancedMesh) return;
    const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
    o.getWorldScale(s); if (g.boundingSphere.radius * Math.max(s.x, s.y, s.z) < minRadius) { o.castShadow = false; n++; }
  });
  return n;
}

const sig = g => Object.keys(g.attributes).sort().map(k => k + g.attributes[k].itemSize + (g.attributes[k].normalized ? 'n' : '')).join('|') + (g.index ? '|i' : '|ni') + (Object.keys(g.morphAttributes).length ? '|m' : '');

export async function batchStatic(world, { observeMs = 2500 } = {}) {
  const scene = world.scene, snap = new Map();
  scene.traverse(o => snap.set(o, [o.position.clone(), o.quaternion.clone(), o.scale.clone(), o.visible]));
  await new Promise(r => setTimeout(r, observeMs));
  const dyn = new Set();
  for (const [o, [p, q, s, v]] of snap) if (!o.position.equals(p) || !o.quaternion.equals(q) || !o.scale.equals(s) || o.visible !== v || o.userData.dynamic) dyn.add(o);
  const pickSet = new Set(world.pickables);
  const groups = new Map(); let meshes = 0;
  scene.traverse(o => { if (o.isMesh) meshes++; });
  scene.updateMatrixWorld(true);
  scene.traverse(m => {
    if (!m.isMesh || m.isInstancedMesh || m.isSkinnedMesh || !snap.has(m) || dyn.has(m) || !m.visible || m.children.length) return;
    const mat = m.material; if (Array.isArray(mat) || mat.transparent || mat.isShaderMaterial || mat.isRawShaderMaterial || !mat.visible) return;
    if (m.userData.pick || pickSet.has(m) || m.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender || m.morphTargetInfluences) return;
    // anchor = nearest ancestor that moves (merged geometry rides along with it) or is pickable (picking still finds
    // it through the merged child), else the scene
    let a = m.parent, bad = false;
    while (a && a !== scene && !dyn.has(a) && !a.userData.pick && !pickSet.has(a) && a.parent !== scene) { if (!a.visible) { bad = true; break; } a = a.parent; }
    if (bad || !a || (a !== scene && !a.visible)) return;
    if (m.matrixWorld.determinant() <= 0) return;
    let cell = '';
    if (a === scene) { const g = m.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); const c = g.boundingSphere.center.clone().applyMatrix4(m.matrixWorld); cell = Math.floor(c.x / 48) + ',' + Math.floor(c.z / 48); }
    const key = [a.uuid, cell, mat.uuid, m.castShadow, m.receiveShadow, m.renderOrder, m.frustumCulled, sig(m.geometry)].join('#');
    (groups.get(key) || groups.set(key, { anchor: a, mat, list: [] }).get(key)).list.push(m);
  });
  let merged = 0, removed = 0;
  for (const { anchor, mat, list } of groups.values()) {
    if (list.length < 2) continue;
    const inv = new THREE.Matrix4().copy(anchor.matrixWorld).invert();
    const geos = list.map(m => { const g = m.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k); g.clearGroups(); return g; });
    const g = mergeGeometries(geos, false); geos.forEach(x => x.dispose()); if (!g) continue;
    const out = new THREE.Mesh(g, mat); out.castShadow = list[0].castShadow; out.receiveShadow = list[0].receiveShadow; out.renderOrder = list[0].renderOrder;
    out.name = 'batched:' + list.length; out.userData.batched = list.length; anchor.add(out); out.updateMatrixWorld(true);
    for (const m of list) m.parent.remove(m);
    merged++; removed += list.length;
  }
  let after = 0; scene.traverse(o => { if (o.isMesh) after++; });
  return { meshesBefore: meshes, meshesAfter: after, batches: merged, meshesMerged: removed, dynamicObjects: dyn.size };
}

export async function optimizeWorld(world, flags) {
  const out = { flags: [...flags] };
  if (flags.has('casters')) out.castersCulled = cullSmallCasters(world.scene);
  if (flags.has('batch')) Object.assign(out, await batchStatic(world));
  world.optReport = out;
  return out;
}
