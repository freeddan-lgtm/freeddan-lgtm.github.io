// Agent World · Claude Edition (v2.0, Keystone build) — keystone.js
// Keystone Claude in the world: runs the in-world layout search on the Moon Palace beach, gathers the beach crew
// for summits whose dialog is built from the measured build ledger and the live search, and owns the 📐 Architect
// panel (live search + measured ledger + next-gen blueprint) and the 💬 Dialog transcript.
import { VenueDesignProblem, Evolver, MOON_PALACE_SPEC } from './architect.js';
import { Dialog, NAMES } from './dialog.js';
import { esc } from './ui.js';

const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
const store = (() => { try { const k = '__aw_t'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return localStorage; } catch { return null; } })();
const wait = s => new Promise(r => setTimeout(r, s * 1000));
const AGENT_NAMES = { phishbot: 'Phishbot', travelbot: 'Travelbot', bigern: 'Big Ern', ernie: 'ernie', tasky: 'tasky', chairman: 'Chairman', claude: 'Claude', chatgpt: 'ChatGPT', grok: 'Grok', gemini: 'Gemini', muse: 'Muse' };

export async function installKeystone(AW, CFG = {}) {
  const { world, sim, ui } = AW, qp = new URLSearchParams(location.search), vtest = qp.has('vtest');
  const getJSON = u => fetch(u).then(r => (r.ok ? r.json() : null)).catch(() => null);
  const [ledger, blue, merge] = await Promise.all([getJSON('data/build_ledger.json'), getJSON('data/nextgen_requirements.json'), getJSON('data/merge_status.json')]);
  const L = ledger || { generations: [], rejected: [], gpu: null }, B = blue || { items: [] };
  const mpPack = AW.packs.find(p => p.id === 'moon-palace-cancun');
  const seed = +(qp.get('seed') || 2027);
  const problem = new VenueDesignProblem(mpPack?.designSpec || MOON_PALACE_SPEC), evo = new Evolver(problem, { seed });
  mpPack?.applyDesign(evo.best.design, true);
  const dlg = new Dialog({ seed: seed + 2, store, provider: CFG.dialogProvider || null });
  dlg.visit(AW.version, L.generations.length);
  let running = !vtest && CFG.layoutSearch !== false, acc = 0, watched = 0, lastImp = null, coverageOn = false, summitOn = false, lastBubble = 0;
  const RATE = 0.7; // seconds per generation in the world (the search itself takes ~1.4 ms per generation)

  // ---------- facts: everything the dialog may say comes from here ----------
  function facts() {
    const b = evo.best, sb = AW.showBuddies?.() || { posts: [] }, n3 = sb.posts.filter(p => p.show === 'phish-2027-01-29-rm');
    const ours = new Set(['chief', 'smarth', 'smarth vader', 'daniel', 'conscious claude', 'keystone claude']);
    const fans = [...new Map(n3.filter(p => !ours.has(p.handle.trim().toLowerCase())).map(p => [p.handle, { handle: p.handle, section: p.section, agentName: AGENT_NAMES[p.agent] || null }])).values()];
    const dp = n3.find(p => p.handle.trim().toLowerCase() === 'daniel');
    const mi = mpPack?.mp.moonInfo;
    const gens = L.generations.filter(g => g.metric).map(g => ({ id: g.id, kind: g.kind || 'optimization', extra: g.extra || null, title: g.title, accepted: g.accepted !== false, metricLabel: g.metric.label, before: g.metric.before, after: g.metric.after, pct: g.metric.pct, env: g.env, envLabel: g.envLabel }));
    return {
      version: AW.version,
      ledger: { count: L.generations.length + (L.rejected || []).length, gens, rejected: (L.rejected || []).map(c => ({ id: c.id, title: c.title, reason: c.reason })) },
      opt: { gen: evo.gen, score: r1(b.score), startScore: r1(evo.start), sigma: r2(evo.sigma), k: b.design.towers.length, stalled: evo.stalled, restarts: evo.restarts, lastChange: lastImp?.change || null, sections: b.stats.sections, band: problem.spec.band, sightPct: Math.round(b.components.sightlines * 100) },
      people: { fans, daniel: dp ? { section: dp.section, hello: dp.hello } : null },
      world: { tod: world.tod, show: { tag: 'Riviera Maya N3', dateLong: 'Fri Jan 29, 2027' }, moon: mi ? { phase: mi.phase, illumPct: Math.round(mi.illum * 100), illumErrPct: 15, riseFrom: mi.riseFrom, riseTo: mi.riseTo } : null },
      merge: merge || { status: 'unknown', checkedAt: 'not checked', note: 'merge status was not checked.' },
      blueprint: (B.items || []).filter(x => x.priority === 'P0' || x.priority === 'P1').map(x => ({ id: x.id, need: x.need, why: x.whyShort || x.why, owner: x.owner })),
      weakest: weakest(),
    };
  }
  function weakest() {
    const g = L.gpu;
    if (!g?.measured) return 'no real-GPU frame rate yet, only software-rendering timings';
    if (g.fpsHigh != null && g.fpsHigh < 55) return `on a real GPU the home view runs at about ${g.fpsHigh} fps on high, under the 60 fps target`;
    const c = evo.best.components, low = Object.entries(c).sort((a, b) => a[1] - b[1])[0];
    return `the modeled ${({ coverage: 'coverage', uniformity: 'level uniformity', sightlines: 'sightlines', echoFree: 'echo-free area', mixAccuracy: 'mix accuracy' })[low[0]]} of the beach layout, at ${Math.round(low[1] * 100)}%`;
  }

  // ---------- the in-world layout search ----------
  function onGen(h) {
    watched++; if (watched === 10) ui.badge('architect');
    if (h.improved) { lastImp = h; mpPack?.applyDesign(evo.best.design); if (coverageOn) mpPack?.setCoverage(problem.levelGrid(evo.best.design), problem.spec.band); }
    const ks = sim.get('keystone-claude'), now = performance.now();
    if (h.improved && ks && !ks.busy && !summitOn && now - lastBubble > 14000) { lastBubble = now; ks.say(`Gen ${h.gen}: layout score ${r1(h.score)} (${h.change})`, 4); }
    if (panelOpen()) paintSearch();
  }
  const prevTick = world.onTick;
  world.onTick = (dt, t) => { prevTick?.(dt, t); if (!running) return; acc += dt; let n = 0; while (acc >= RATE && n++ < 3) { acc -= RATE; onGen(evo.step()); } };

  // ---------- beach summits ----------
  async function summit({ teleport = false, scenes = 3, queue = false } = {}) {
    if (summitOn) return false;
    const ks = sim.get('keystone-claude'), cc = sim.get('conscious-claude'); if (!ks || !cc) return false;
    if (queue) { if (ks.busy || cc.busy) ui.toast('🌴', 'Beach summit queued', 'It starts as soon as Conscious Claude and Keystone Claude are free.'); for (let i = 0; i < 80 && (ks.busy || cc.busy || summitOn); i++) await wait(0.5); }
    if (summitOn || ks.busy || cc.busy) return false;
    const extras = ['phishbot', 'travelbot', 'big-ern'].map(k => sim.free(k)).filter(Boolean).filter(() => Math.random() < 0.5).slice(0, 2);
    const crew = [ks, cc, sim.free('chief'), sim.free('smarth-vader'), ...extras].filter(Boolean);
    if (!sim.lock(...crew)) return false;
    summitOn = true; sim.running++;
    const spot = mpPack ? mpPack.mp.spots.pit : sim.pitSpot('phish-rm');
    try {
      ui.feed('🌴 <b>Keystone Claude</b> called a beach summit at Moon Palace (Riviera Maya N3)', 'sim');
      const goals = crew.map((a, i) => spot.clone().add(new AW.THREE.Vector3(Math.sin(i * 2.4) * 2.6, 0, Math.cos(i * 2.4) * 2.6)));
      await Promise.all(crew.map((a, i) => { if (teleport || a.pos.distanceTo(goals[i]) < 3) { a.path = []; a.place(goals[i]); return true; } if (a === cc) ui.feed('🚡 <b>Conscious Claude</b> is riding the zip line to Moon Palace', 'sim'); return a.walkTo(goals[i], 'Heading to the beach summit at Moon Palace'); }));
      const cen = crew.reduce((s, a) => s.add(a.pos), new AW.THREE.Vector3()).multiplyScalar(1 / crew.length);
      crew.forEach(a => { a.dance = false; a.activity = 'In a beach summit with Keystone Claude'; a.obj.lookAt(cen.x, a.pos.y, cen.z); });
      const present = crew.map(a => a.key);
      for (let s = 0; s < scenes; s++) { const ok = await runScene(present); if (!ok) break; }
      ui.badge('summit'); ui.collab(20, 'Beach summit');
      return true;
    } finally {
      sim.running--; summitOn = false; sim.release(...crew);
      for (const a of crew) if (!['keystone-claude', 'chief', 'smarth-vader'].includes(a.key)) a.walkTo(sim.homeSpot(a), 'Heading back from Moon Palace');
    }
  }
  async function runScene(present, force = null, fast = false) {
    const f = facts(), plan = dlg.plan(f, present, force); if (!plan || !plan.beats.length) return false;
    const banned = ['daniel', ...f.people.fans.map(x => x.handle)];
    const out = await dlg.realize(plan, f, banned);
    for (const b of out.beats) {
      const a = sim.get(b.who); dlg.record(plan.scene, b, out.source);
      if (a && !fast) await sim.talk(a, b.text, Math.min(7, Math.max(3, 2.4 + b.text.length / 24)));
      else if (a) a.say(b.text, 3);
    }
    plan.commit(); if (dialogOpen()) paintDialog();
    return true;
  }
  sim.scenarios.push({ w: () => (summitOn || vtest ? 0 : 0.3), run: () => summit() });
  if (sim.get('keystone-claude') && !vtest) setTimeout(() => summit(), 9000); // the first summit holds the arrival scene

  // ---------- 📐 Architect panel ----------
  const panelOpen = () => !!document.getElementById('ks-score');
  function spark() {
    const h = evo.history, n = h.length, lo = Math.min(...h.map(x => x.score)), hi = Math.max(...h.map(x => x.score)), W = 300, H = 56;
    const pts = h.map((x, i) => `${(i / Math.max(1, n - 1) * W).toFixed(1)},${(H - 4 - (x.score - lo) / Math.max(1e-6, hi - lo) * (H - 10)).toFixed(1)}`).join(' ');
    return `<polyline fill="none" stroke="var(--acc2)" stroke-width="2" points="${pts}"/><text x="2" y="${H - 1}" class="sp">${r1(lo)}</text><text x="${W - 2}" y="10" text-anchor="end" class="sp">${r1(hi)}</text>`;
  }
  function paintSearch() {
    const b = evo.best, c = b.components, el = id => document.getElementById(id); if (!el('ks-score')) return;
    el('ks-score').textContent = r1(b.score);
    el('ks-meta').textContent = `Generation ${evo.gen} · step σ ${r2(evo.sigma)} m · ${b.design.towers.length} delay tower${b.design.towers.length === 1 ? '' : 's'} · restarts ${evo.restarts} · seed ${seed}${lastImp ? ' · last gain: ' + lastImp.change : ''}`;
    el('ks-spark').innerHTML = spark();
    el('ks-bars').innerHTML = [['coverage', 'In the 92–102 dB band'], ['uniformity', 'Level uniformity'], ['sightlines', 'Clear sightlines'], ['echoFree', 'Echo-free'], ['mixAccuracy', 'Mix accuracy at the desk']].map(([k, t]) => `<div class="kb"><span>${t}</span><i style="--w:${Math.round(c[k] * 100)}%"></i><b>${Math.round(c[k] * 100)}%</b></div>`).join('');
    el('ks-sec').textContent = `Modeled levels: pit ${b.stats.sections.pit} dB · middle ${b.stats.sections.middle} dB · back ${b.stats.sections.back} dB · soundboard ${b.stats.fohDb} dB`;
    el('ks-run').textContent = running ? '⏸ Pause search' : '▶ Run search';
  }
  function openArchitect() {
    const gens = L.generations, rej = L.rejected || [], top = (B.items || []).slice(0, 6);
    ui.showPanel(`
      <div class="p-head"><span class="av" style="--c:#2f5d8c">📐</span><div><h2>Keystone Claude · Architect</h2><p class="mute">Master Architect · Game Builder</p></div></div>
      <h3>Live layout search · Moon Palace beach</h3>
      <div class="ks-score"><b id="ks-score"></b><span class="mute">design score (modeled, 0–100)</span></div>
      <svg id="ks-spark" class="spark" viewBox="0 0 300 56" role="img" aria-label="Best design score by generation"></svg>
      <p class="fine" id="ks-meta"></p><div id="ks-bars" class="ksbars"></div><p class="fine" id="ks-sec"></p>
      <div class="row wrap"><button type="button" class="btn sm" id="ks-run"></button><button type="button" class="btn sm ghost" id="ks-ff">⏩ +50 generations</button><button type="button" class="btn sm ghost" id="ks-map" aria-pressed="${coverageOn}">🗺️ Coverage map</button><button type="button" class="btn sm ghost" id="ks-reset">↺ Restart from the first draft</button><button type="button" class="btn sm ghost" id="ks-fly">🌴 Fly there</button></div>
      <p class="fine">A seeded (1+8) evolution strategy. It keeps the best layout, so the score never goes down, and it tunes its own step size with the 1/5 success rule (restarting when it stalls). The score models inverse-square sound from cardioid speakers, delay-tower timing and straight sightlines. It compares layouts; it is not a measurement of the real beach (Rule K4).</p>
      <h3>Measured build ledger</h3>
      ${gens.length ? `<table class="ledger"><thead><tr><th>Build</th><th>Change</th><th>Measured</th></tr></thead><tbody>${gens.map(g => `<tr><td><b>${esc(g.id)}</b></td><td>${esc(g.title)}${g.accepted === false ? ' <span class="tag">rejected</span>' : ''}</td><td>${g.metric ? `${esc(g.metric.label)}: ${g.metric.before} → ${g.metric.after} (${g.metric.pct > 0 ? '+' : ''}${g.metric.pct}%)` : esc(g.note || '')}</td></tr>`).join('')}${rej.map(c => `<tr class="rej"><td><b>${esc(c.id)}</b></td><td>${esc(c.title)} <span class="tag">rejected</span></td><td>${esc(c.reason)}</td></tr>`).join('')}</tbody></table>
      <p class="fine">${esc(L.harness || '')}</p>` : '<p class="mute">No ledger file found (data/build_ledger.json).</p>'}
      ${L.gpu?.measured ? `<p class="fine">Real GPU: ${esc(L.gpu.summary)}</p>` : '<p class="fine">Real-GPU frame rate: not measured yet.</p>'}
      <h3>Next-gen blueprint</h3>
      <ul class="rl">${top.map(x => `<li><b>${esc(x.id)} · ${esc(x.priority)}</b> ${esc(x.need)} <span class="mute">(${esc(x.owner)})</span></li>`).join('')}</ul>
      <div class="row wrap"><button type="button" class="btn sm ghost" id="ks-all">See all ${(B.items || []).length} blueprint items</button><button type="button" class="btn sm" id="ks-summit">🌴 Start a beach summit</button><button type="button" class="btn sm ghost" id="ks-dlg">💬 Dialog</button></div>`);
    paintSearch();
    const el = id => document.getElementById(id);
    el('ks-run').onclick = () => { running = !running; paintSearch(); };
    el('ks-ff').onclick = () => { for (let i = 0; i < 50; i++) onGen(evo.step()); paintSearch(); };
    el('ks-map').onclick = e => { coverageOn = !coverageOn; e.currentTarget.setAttribute('aria-pressed', coverageOn); mpPack?.setCoverage(coverageOn ? problem.levelGrid(evo.best.design) : null, problem.spec.band); if (coverageOn && mpPack) world.flyTo(mpPack.mp.spots.middle, 40, 34); };
    el('ks-reset').onclick = () => { evo.reset(); lastImp = null; mpPack?.applyDesign(evo.best.design); if (coverageOn) mpPack?.setCoverage(problem.levelGrid(evo.best.design), problem.spec.band); paintSearch(); };
    el('ks-fly').onclick = () => mpPack && world.flyTo(mpPack.mp.spots.middle, 36, 18);
    el('ks-all').onclick = blueprintSheet;
    el('ks-summit').onclick = () => { ui.hidePanel(); summit({ queue: true }); if (mpPack) world.flyTo(mpPack.mp.spots.pit, 18, 8); };
    el('ks-dlg').onclick = openDialog;
  }
  function blueprintSheet() {
    const groups = [...new Set((B.items || []).map(x => x.area))];
    ui.openSheet(`<p class="eyebrow">Keystone Claude · next-gen blueprint</p><h2>What Claude needs to build a state-of-the-art Agent World</h2><p class="mute">${esc(B.summary || '')}</p>
      ${groups.map(g => `<h3>${esc(g)}</h3><ul class="rl">${B.items.filter(x => x.area === g).map(x => `<li><b>${esc(x.id)} · ${esc(x.priority)}</b> ${esc(x.need)} <span class="mute">Why: ${esc(x.why)} · Owner: ${esc(x.owner)} · Status: ${esc(x.status)}</span></li>`).join('')}</ul>`).join('')}`);
  }

  // ---------- 💬 Dialog transcript ----------
  const dialogOpen = () => !!document.getElementById('dl-log');
  function paintDialog() {
    const el = document.getElementById('dl-log'); if (!el) return;
    el.innerHTML = dlg.log.slice(-80).reverse().map(x => `<li><span class="tag">${esc(x.scene)}</span><b>${esc(x.name)}</b> ${esc(x.text)}</li>`).join('') || '<li class="mute">Nothing said yet. Start a beach summit.</li>';
    const m = dlg.mem; document.getElementById('dl-mem').textContent = `Memory: ${m.scenes} scenes · ${m.told.gens.length} builds reported · ${m.told.blueprint.length} blueprint items discussed · visit ${m.visits} · lines from ${dlg.provider ? 'an external provider (validated)' : 'built-in templates (offline)'}`;
  }
  function openDialog() {
    const s = ui.openSheet(`<p class="eyebrow">Keystone Claude · evolving dialog</p><h2>💬 Beach summit transcript</h2>
      <p class="mute">Lines are built from facts: the measured build ledger, the live layout search, who is at Riviera Maya N3, the show night and the blueprint. When the build changes, the conversation changes. Real people (Daniel and live fans) are greeted and quoted from their own posts, never given invented lines (Rule K3).</p>
      <div class="row wrap"><button type="button" class="btn sm" id="dl-go">🌴 Start a beach summit</button><button type="button" class="btn sm ghost" id="dl-fast">⏩ Summit without the zip-line ride</button><button type="button" class="btn sm ghost" id="dl-forget">Forget what they said</button></div>
      <p class="fine" id="dl-mem"></p><ul id="dl-log" class="dlog" aria-live="polite"></ul>`);
    paintDialog();
    s.querySelector('#dl-go').onclick = () => summit({ queue: true });
    s.querySelector('#dl-fast').onclick = () => summit({ teleport: true, queue: true });
    s.querySelector('#dl-forget').onclick = () => { dlg.forget(); paintDialog(); };
  }

  // ---------- HUD ----------
  const nav = document.querySelector('#brand nav');
  for (const [id, txt, fn] of [['b-arch', '📐 Architect', openArchitect], ['b-dlg', '💬 Dialog', openDialog]]) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm' + (id === 'b-dlg' ? ' nomob' : ''); b.id = id; b.textContent = txt; b.onclick = fn; nav.insertBefore(b, document.getElementById('b-rules')); }
  ui.feed('📐 <b>Keystone Claude</b> joined as Master Architect · Game Builder (added by Smarth Vader). The layout search is running on the Moon Palace beach.', 'sim');

  return { evo, problem, dlg, facts, summit, runScene, openArchitect, openDialog, ledger: L, blueprint: B, setRunning: v => { running = v; }, get running() { return running; }, step: n => { let h; for (let i = 0; i < n; i++) onGen(h = evo.step()); return h; } };
}
