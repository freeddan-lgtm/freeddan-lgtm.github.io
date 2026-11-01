// Festival Grounds → Agent World · Conscious Claude Edition adapter.
// Loaded by main.js when window.AW_CONFIG.packs lists it. It only adds things; removing the pack
// from the config leaves the base world exactly as it was (Rule V2).
import * as THREE from 'three';
import { installFestivalGrounds } from './festival-grounds.js';
import { STYLES } from '../../src/audio.js';
import { Agent } from '../../src/agents.js';
import { SHOW_C, SHOW_R, polar } from '../../src/world.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const pick = a => a[Math.floor(Math.random() * a.length)];

export default async function install(AW, base) {
  const { world, sim, audio, ui, rulebook } = AW;
  const [pack, data] = await Promise.all([fetch(base + 'pack.json').then(r => r.json()), fetch(base + 'shows.expansion.json').then(r => r.json())]);

  // Place the island beyond the gap between the Riviera Maya and Goose stages, linked by cable car.
  const ang = 2.58, from = SHOW_C.clone().add(polar(SHOW_R - 2.5, ang));
  const at = SHOW_C.clone().add(polar(SHOW_R + 28 + 40, ang));
  const fg = installFestivalGrounds({ THREE, scene: world.scene, pack, at, connectFrom: from, makeLabel: (h, c) => world.label(h, c), quality: world.qName });
  world.pickables.push(...fg.pickables);

  // Music: each venue with a style gets its own spatial stage in the shared audio engine.
  for (const v of fg.venues) {
    if (!v.venue.music) continue;
    STYLES[v.id] = v.venue.music; audio.register(v.id, v.pos); audio.stages.get(v.id).label = v.name;
    if (audio.ctx) audio.buildStage(audio.stages.get(v.id));
  }

  // Residents walk only on their own island.
  const homeOf = new Map();
  (sim.homeResolvers ||= []).push(a => { const h = homeOf.get(a.key); return h ? fg.spots[h].clone().add(polar(1 + Math.random() * 3, Math.random() * Math.PI * 2)) : null; });
  for (const d of pack.agents) {
    homeOf.set(d.key, d.home);
    const a = new Agent({ ...d, pack: pack.id }, sim); a.place(sim.homeSpot(a));
    a.activity = 'Hanging out at ' + (pack.venues.find(v => v.id === d.home)?.name || 'Festival Grounds');
    sim.agents.set(d.key, a);
  }

  // Rules: a new chapter in the shared Rule Book.
  if (rulebook?.ready) {
    rulebook.data.chapters.push({ id: 'EX', title: `${pack.name} pack`, blurb: `Rules added by the ${pack.name} expansion.` });
    for (const r of pack.rules) { rulebook.data.rules.push(r); rulebook.byId.set(r.id, r); }
  }

  // Frame updates: crowds and lights follow each venue's music.
  const prevTick = world.onTick;
  world.onTick = (dt, t) => { prevTick?.(dt, t); fg.update(dt, t, id => audio.stages.get(id)?.energy); };

  // Picking → venue panel.
  const prevPick = world.onPick;
  world.onPick = p => (p?.kind === 'pack-venue' && p.pack === pack.id ? showVenue(p.id) : prevPick?.(p));
  function showVenue(id) {
    const v = fg.venues.find(x => x.id === id), ve = v.venue, vt = data.venueTypes[ve.venueType];
    world.flyTo(v.pit, 22, 11);
    const here = pack.agents.filter(a => a.home === id);
    ui.showPanel(`
      <div class="p-head"><span class="av" style="--c:${ve.color}">${ve.emoji}</span><div><h2>${esc(ve.name)}</h2><p class="mute">${esc(pack.name)} pack · ${esc(ve.venueType)}</p></div></div>
      <p>${esc(ve.blurb)}</p>
      ${ve.music ? `<h3>Live band audio</h3><p class="mute">${esc(audio.styleOf(id).name)} · ${audio.styleOf(id).bpm} BPM · original music generated live</p><p class="fine">Acoustics: ${esc(audio.venueOf(id).name)} · reverb ≈ ${audio.venueOf(id).rt60[1]} s (modeled)</p><div class="row"><button type="button" class="btn" id="fg-listen">🎧 Listen here</button></div>` : ''}
      ${vt ? `<h3>Public meetup spots</h3><ul class="shows">${vt.spots.map(s => `<li><b>${esc(s.when)}</b><span>${esc(s.where)}</span><em>${esc(s.time)}</em></li>`).join('')}</ul><h3>Sections</h3><p class="mute">${vt.sections.map(esc).join(' · ')}</p>` : ''}
      ${id === 'fg-booth' ? `<h3>Meetup spots by venue type</h3><ul class="shows">${Object.entries(data.venueTypes).map(([k, t]) => `<li><b>${esc(k)}</b><span>${esc(t.spots[0].where)}</span><em>${esc(t.spots[0].time)}</em></li>`).join('')}</ul>` : ''}
      ${here.length ? `<h3>Who's here</h3><div class="fans">${here.map(a => `<button type="button" class="fanbtn" data-fg-ag="${a.key}" style="--c:${a.color}">${a.icon} ${esc(a.name)} <small>${esc(a.title)}</small></button>`).join('')}</div>` : ''}
      <p class="fine">No show dates ship with this pack. Add confirmed dates from each band's official tour page to shows.json.</p>`);
    const b = document.getElementById('fg-listen'); if (b) b.onclick = async () => { await audio.enable(); audio.focus = id; world.flyTo(v.pit, 16, 8); };
    document.querySelectorAll('[data-fg-ag]').forEach(x => x.onclick = () => prevPick?.({ kind: 'agent', id: x.dataset.fgAg }));
  }

  // HUD: a button to fly over, and a sheet listing the venues.
  const nav = document.querySelector('#brand nav');
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn sm'; btn.id = 'b-festival'; btn.textContent = '🎪 Festival';
  btn.onclick = () => {
    world.flyTo(fg.center, 70, 42);
    const s = ui.openSheet(`<h2>🎪 ${esc(pack.name)}</h2><p class="mute">${esc(pack.description)}</p><div class="stagegrid">${fg.venues.map(v => `<button type="button" class="stagebtn" data-fg="${v.id}" style="--c:${v.color}"><span class="se">${v.emoji}</span><b>${esc(v.name)}</b><small>${esc(v.venue.music ? v.venue.music.name : 'Info & meetups')}</small></button>`).join('')}</div>`);
    s.querySelectorAll('[data-fg]').forEach(x => x.onclick = () => { ui.closeSheet(); showVenue(x.dataset.fg); });
  };
  nav.insertBefore(btn, document.getElementById('b-rules'));

  ui.feed(`🎪 <b>${esc(pack.name)}</b> expansion installed: ${fg.venues.length} venues, ${pack.agents.length} new agents, ${pack.rules.length} rules. Ride the cable car from Show Island.`, 'sim');
  setTimeout(() => { const t = sim.get('tapebot'); if (t) t.say(pick(t.def.lines), 3); }, 4000);
  return { id: pack.id, name: pack.name, version: pack.version, fg, dispose: () => fg.dispose() };
}
