// Moon Palace Cancún → Agent World · Claude Edition adapter. Remove its AW_CONFIG.packs entry and the base world is
// unchanged (Rule V2). Seats Riviera Maya fans by their Show Buddies section, moves Chief, Smarth Vader and Keystone
// Claude to the beach pit, adds the zip line to agent routing, and exposes the venue to Keystone's layout search.
import * as THREE from 'three';
import { installMoonPalace } from './moon-palace-cancun.js';
import { STYLES } from '../../src/audio.js';
import { Agent, ROUTE_HOOKS } from '../../src/agents.js';
import { SHOW_C, SHOW_R, polar } from '../../src/world.js';
import { MOON_PALACE_SPEC } from '../../src/architect.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmt = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export default async function install(AW, base) {
  const { world, sim, audio, ui, rulebook } = AW;
  const pack = await fetch(base + 'pack.json').then(r => r.json());
  // Between the Phish · MSG and Phish · Riviera Maya stages, clear of the Festival Grounds and Hollywood Bowl islands.
  const ang = 1.45, from = SHOW_C.clone().add(polar(SHOW_R - 2.5, ang)), at = SHOW_C.clone().add(polar(SHOW_R + 28 + 50, ang));
  const facing = Math.atan2(SHOW_C.x - at.x, SHOW_C.z - at.z); // +z (audience side) looks back toward Show Island
  const mp = installMoonPalace({ THREE, scene: world.scene, pack, at, facing, connectFrom: from, makeLabel: (h, c) => world.label(h, c), quality: world.qName });
  world.pickables.push(...mp.pickables);
  world.nightGlow = [...(world.nightGlow || []), ...mp.nightGlow]; world.setTimeOfDay(world.tod);
  const v = pack.venues[0];
  STYLES[v.id] = v.music; audio.register(v.id, mp.venues[0].pos); audio.stages.get(v.id).label = v.name; if (audio.ctx) audio.buildStage(audio.stages.get(v.id));

  // Homes: the beach crew lives in the pit; pack residents at their posts.
  const HOME = { chief: ['pit', -1.7, -0.4], 'smarth-vader': ['pit', 1.7, -0.4], 'keystone-claude': ['pit', 0, 1.2], 'lifeguard-luz': ['pit', 10, -2], 'host-mateo': ['lobby', 0, 2] };
  (sim.homeResolvers ||= []).push(a => { const h = HOME[a.key]; if (!h) return null; const [spot, dx, dz] = h; return mp.spots[spot].clone().add(new THREE.Vector3(dx, 0, dz).applyAxisAngle(new THREE.Vector3(0, 1, 0), facing)).add(polar(Math.random() * 0.6, Math.random() * Math.PI * 2)); });
  for (const d of pack.agents) { const a = new Agent({ ...d, pack: pack.id }, sim); a.place(sim.homeSpot(a)); a.activity = d.key === 'lifeguard-luz' ? 'Watching the water at Moon Palace' : 'Running the lobby at Moon Palace'; sim.agents.set(d.key, a); }
  for (const k of ['chief', 'smarth-vader', 'keystone-claude']) { const a = sim.get(k); if (!a || a.busy) continue; a.path = []; a.place(sim.homeSpot(a)); a.dance = true; a.activity = k === 'keystone-claude' ? 'Surveying the beach stage at Moon Palace' : 'Dancing in the beach pit at Moon Palace (Riviera Maya N3)'; a.obj.lookAt(mp.venues[0].pos.x, a.pos.y, mp.venues[0].pos.z); }

  // Fans for any Riviera Maya night sit in their Show Buddies section.
  const seen = new Map();
  sim.fanPlacers.push((p, i) => { if (p.stage !== 'phish-rm') return null; if (i === 0) seen.clear(); const n = seen.get(p.section) || 0; seen.set(p.section, n + 1); return mp.seat(p.section, n + 2); });
  // Zip line: any trip that starts or ends on the Moon Palace island rides it.
  ROUTE_HOOKS.push((a, b, baseRoute) => {
    if (!mp.zip) return null; const ia = mp.contains(a), ib = mp.contains(b); if (ia === ib) return null;
    if (ib) return [...baseRoute(a, mp.zip.from), { ride: mp.zip.ride, dur: mp.zip.dur }, b.clone()];
    return [mp.zip.to.clone(), { ride: mp.zip.ride, dur: mp.zip.dur, rev: true }, ...baseRoute(mp.zip.from, b)];
  });
  sim.danceSpots.push(p => mp.inConcert(p));
  sim.energyHooks.push(p => { const e = audio.stages.get(v.id)?.energy; return e && mp.inConcert(p) ? e.level * 1.2 : 0; });

  if (rulebook?.ready) {
    rulebook.data.chapters.push({ id: 'MP', title: `${pack.name} pack`, blurb: `Rules added by the ${pack.name} expansion.` });
    for (const r of pack.rules) { rulebook.data.rules.push(r); rulebook.byId.set(r.id, r); }
  }

  const prevTick = world.onTick;
  world.onTick = (dt, t) => { prevTick?.(dt, t); mp.update(dt, t, id => audio.stages.get(id)?.energy, world.tod, world.camera); };
  const prevPick = world.onPick;
  world.onPick = p => (p?.kind === 'pack-venue' && p.pack === pack.id ? showVenue() : prevPick?.(p));
  let night = 'phish-2027-01-29-rm';

  function showVenue(sel = night) {
    night = sel;
    const sb = AW.showBuddies?.() || { shows: [], posts: [] }, nights = sb.shows.filter(s => s.id.startsWith('phish-') && s.id.endsWith('-rm') && !s.past).sort((a, b) => a.date.localeCompare(b.date));
    const posts = sb.posts.filter(p => p.show === sel), secs = ['Beach pit / front', 'Beach middle', 'Back by soundboard', 'Pool & lobby', 'Meet on Messenger 💬'];
    const mi = mp.moonInfo, st = audio.styleOf(v.id), vn = audio.venueOf(v.id), show = nights.find(s => s.id === sel);
    world.flyTo(mp.spots.middle, 34, 16);
    ui.showPanel(`
      <div class="p-head"><span class="av" style="--c:${v.color}">${v.emoji}</span><div><h2>${esc(v.name)}</h2><p class="mute">Riviera Maya, MX · ${esc(pack.name)} pack</p></div></div>
      <p>${esc(v.blurb)}</p>
      <h3>Pick a night</h3><div class="chips">${nights.map(s => `<button type="button" class="chip${s.id === sel ? ' on' : ''}" data-mp-night="${esc(s.id)}">${esc((s.tag || '').replace('Riviera Maya ', '') || s.date)} · ${esc(fmt(s.date))}</button>`).join('') || '<span class="mute">No Riviera Maya dates loaded.</span>'}</div>
      <h3>Who's going${show ? ' · ' + esc(show.tag || fmt(show.date)) : ''}</h3>
      ${secs.map(sec => { const here = posts.filter(p => p.section === sec); return here.length ? `<div class="post"><b>${esc(sec)}</b> · ${here.map(p => esc(p.handle)).join(', ')}</div>` : ''; }).join('') || '<p class="mute">Nobody has posted for this night yet.</p>'}
      ${sel === 'phish-2027-01-29-rm' ? `<p class="fine">The moon for N3 (Fri Jan 29): ${esc(mi.phase)}, about ${Math.round(mi.illum * 100)}% lit (±15%), rising about ${esc(mi.riseFrom)}–${esc(mi.riseTo)} local, after the show. Mean-motion estimate; the 3D moon is drawn as it rises over the sea.</p>` : ''}
      <h3>Live music</h3><p class="mute">${esc(st.name)} · ${st.bpm} BPM · original music generated live</p>
      <p class="fine">Acoustics: ${esc(vn.name)} · reverb ≈ ${vn.rt60[1]} s mid-band (modeled, not measured)</p>
      <div class="row wrap"><button type="button" class="btn" id="mp-listen">🎧 Listen here</button><button type="button" class="btn ghost" id="mp-pit">🏖️ Beach pit</button><button type="button" class="btn ghost" id="mp-arch">📐 Layout search</button><button type="button" class="btn ghost" id="mp-moon">🌙 Moon over the sea</button></div>
      <h3>Who works here</h3><div class="fans">${pack.agents.map(a => `<button type="button" class="fanbtn" data-mp-ag="${a.key}" style="--c:${a.color}">${a.icon} ${esc(a.name)} <small>${esc(a.title)}</small></button>`).join('')}</div>
      <p class="fine">An artistic model of a beach-resort show, not a survey of the real resort, and not affiliated with the resort or any band. Delay towers and the soundboard are placed by Keystone Claude's modeled layout search.</p>`);
    document.querySelectorAll('[data-mp-night]').forEach(b => b.onclick = () => showVenue(b.dataset.mpNight));
    document.getElementById('mp-listen').onclick = async () => { await audio.enable(); audio.focus = v.id; world.flyTo(mp.spots.pit, 20, 8); };
    document.getElementById('mp-pit').onclick = () => world.flyTo(mp.spots.pit, 16, 7);
    document.getElementById('mp-arch').onclick = () => AW.keystone?.openArchitect();
    document.getElementById('mp-moon').onclick = () => { world.setTimeOfDay('night'); const tb = document.getElementById('b-tod'); if (tb) tb.textContent = '🌙 Night'; const m = new THREE.Vector3(); mp.moon.getWorldPosition(m); world.follow = null; world.fly = { fp: world.camera.position.clone(), ft: world.controls.target.clone(), toT: mp.spots.pit.clone().lerp(m, 0.06).setY(10), toP: mp.spots.back.clone().setY(9), t: 0, dur: 2.2 }; };
    document.querySelectorAll('[data-mp-ag]').forEach(x => x.onclick = () => prevPick?.({ kind: 'agent', id: x.dataset.mpAg }));
  }

  const nav = document.querySelector('#brand nav'), btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'btn sm'; btn.id = 'b-mp'; btn.textContent = '🌴 Moon Palace';
  btn.onclick = () => showVenue();
  nav.insertBefore(btn, document.getElementById('b-rules'));
  ui.feed(`🌴 <b>${esc(pack.name)}</b> expansion installed: the Riviera Maya beach show. Ride the zip line from Show Island.`, 'sim');
  return { id: pack.id, name: pack.name, version: pack.version, mp, designSpec: MOON_PALACE_SPEC, applyDesign: (d, snap) => mp.applyDesign(d, snap), setCoverage: (g, band) => mp.setCoverage(g, band), showVenue, dispose: () => mp.dispose() };
}
