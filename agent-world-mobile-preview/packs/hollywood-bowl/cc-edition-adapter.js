// Hollywood Bowl → Agent World · Conscious Claude Edition adapter. Remove its AW_CONFIG.packs entry and the
// base world is unchanged (Rule V2).
import * as THREE from 'three';
import { installHollywoodBowl } from './hollywood-bowl.js';
import { STYLES } from '../../src/audio.js';
import { Agent } from '../../src/agents.js';
import { SHOW_C, SHOW_R, polar } from '../../src/world.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export default async function install(AW, base) {
  const { world, sim, audio, ui, rulebook } = AW;
  const [pack, data] = await Promise.all([fetch(base + 'pack.json').then(r => r.json()), fetch(base + 'shows.expansion.json').then(r => r.json())]);

  // Mirror of the Festival Grounds: past the gap between the Goose and Disco Biscuits stages.
  const ang = 3.7, from = SHOW_C.clone().add(polar(SHOW_R - 2.5, ang)), at = SHOW_C.clone().add(polar(SHOW_R + 28 + 46, ang));
  const facing = Math.atan2(SHOW_C.x - at.x, SHOW_C.z - at.z); // the audience looks back toward Show Island; the moon rises behind the shell
  const hb = installHollywoodBowl({ THREE, scene: world.scene, pack, at, facing, connectFrom: from, makeLabel: (h, c) => world.label(h, c), quality: world.qName });
  world.pickables.push(...hb.pickables);

  for (const v of hb.venues) { STYLES[v.id] = v.venue.music; audio.register(v.id, v.pos); audio.stages.get(v.id).label = v.name; if (audio.ctx) audio.buildStage(audio.stages.get(v.id)); }

  const homeOf = new Map();
  (sim.homeResolvers ||= []).push(a => { const h = homeOf.get(a.key); return h ? hb.spots[h].clone().add(polar(1 + Math.random() * 3, Math.random() * Math.PI * 2)) : null; });
  for (const d of pack.agents) { homeOf.set(d.key, d.home); const a = new Agent({ ...d, pack: pack.id }, sim); a.place(sim.homeSpot(a)); a.activity = 'At the Hollywood Bowl'; sim.agents.set(d.key, a); }

  if (rulebook?.ready) {
    rulebook.data.chapters.push({ id: 'HB', title: `${pack.name} pack`, blurb: `Rules added by the ${pack.name} expansion.` });
    for (const r of pack.rules) { rulebook.data.rules.push(r); rulebook.byId.set(r.id, r); }
  }

  const prevTick = world.onTick;
  world.onTick = (dt, t) => { prevTick?.(dt, t); hb.update(dt, t, id => audio.stages.get(id)?.energy); };
  const prevPick = world.onPick;
  world.onPick = p => (p?.kind === 'pack-venue' && p.pack === pack.id ? showVenue(p.id) : prevPick?.(p));

  function showVenue(id) {
    const v = hb.venues.find(x => x.id === id), ve = v.venue, vt = data.venueTypes[ve.venueType], st = audio.styleOf(id), vn = audio.venueOf(id);
    world.flyTo(v.pit, 30, 12);
    ui.showPanel(`
      <div class="p-head"><span class="av" style="--c:${ve.color}">${ve.emoji}</span><div><h2>${esc(ve.name)}</h2><p class="mute">${esc(pack.name)} pack · Los Angeles, CA</p></div></div>
      <p>${esc(ve.blurb)}</p>
      <h3>Live music</h3><p class="mute">${esc(st.name)} · ${st.bpm} BPM · original music generated live</p>
      <p class="fine">Acoustics: ${esc(vn.name)} · reverb ≈ ${vn.rt60[1]} s mid-band, dense shell reflections in the first 40 ms (modeled, not measured)</p>
      <div class="row"><button type="button" class="btn" id="hb-listen">🎧 Listen here</button><button type="button" class="btn ghost" id="hb-moon">🌕 Look at the moon</button></div>
      <h3>Public meetup spots</h3><ul class="shows">${vt.spots.map(s => `<li><b>${esc(s.when)}</b><span>${esc(s.where)}</span><em>${esc(s.time)}</em></li>`).join('')}</ul>
      <h3>Seating</h3><p class="mute">${vt.sections.map(esc).join(' · ')}</p>
      <h3>Who's here</h3><div class="fans">${pack.agents.map(a => `<button type="button" class="fanbtn" data-hb-ag="${a.key}" style="--c:${a.color}">${a.icon} ${esc(a.name)} <small>${esc(a.title)}</small></button>`).join('')}</div>
      <p class="fine">An artistic model, not affiliated with the venue. No show dates are included; add confirmed dates from the official calendar.</p>`);
    document.getElementById('hb-listen').onclick = async () => { await audio.enable(); audio.focus = id; world.flyTo(v.pit, 18, 7); };
    document.getElementById('hb-moon').onclick = () => { world.follow = null; const m = new THREE.Vector3(); hb.moon.getWorldPosition(m); const look = v.pit.clone(); world.fly = { fp: world.camera.position.clone(), ft: world.controls.target.clone(), toT: m.clone().multiplyScalar(0.12).add(look.multiplyScalar(0.88)).setY(40), toP: v.pit.clone().add(new THREE.Vector3(0, 6, 0)).addScaledVector(v.pit.clone().sub(m).setY(0).normalize(), 22), t: 0, dur: 2.2 }; };
    document.querySelectorAll('[data-hb-ag]').forEach(x => x.onclick = () => prevPick?.({ kind: 'agent', id: x.dataset.hbAg }));
  }

  const nav = document.querySelector('#brand nav'), btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'btn sm'; btn.id = 'b-bowl'; btn.textContent = '🌙 Hollywood Bowl';
  btn.onclick = () => showVenue('hb-bowl');
  nav.insertBefore(btn, document.getElementById('b-rules'));
  ui.feed(`🌙 <b>${esc(pack.name)}</b> expansion installed: an orchestra under a full moon in the Hollywood Hills. Ride the cable car from Show Island.`, 'sim');
  return { id: pack.id, name: pack.name, version: pack.version, hb, dispose: () => hb.dispose() };
}
