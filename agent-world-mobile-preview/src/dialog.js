// Agent World · Claude Edition (v2.0, Keystone build) — dialog.js
// Evolving, fact-driven conversations. Every line is built from a fact base (the measured build ledger, Keystone's
// live layout search, who is at the venue, the show night, the next-gen blueprint) plus a memory of what was already
// said. When the build improves, the facts change, so the conversation changes. Pure JavaScript (no DOM), seeded.
//
// Rule K3: real people (Daniel, live Show Buddies fans) never get invented lines. Agents greet them and talk about
// them; a real person is only ever quoted with the words they posted, and the quote is attributed.
// Optional: an external dialog provider (for example a server that calls an LLM) can propose lines. Every proposed
// line is validated: speaker must be in the cast and not a real person, no links, and every number must already
// appear in the fact base (no invented statistics). Anything that fails falls back to the built-in templates.

import { mulberry32 } from './architect.js';

export const NAMES = {
  'keystone-claude': 'Keystone Claude', 'conscious-claude': 'Conscious Claude', 'smarth-vader': 'Smarth Vader', chief: 'Chief',
  phishbot: 'Phishbot', travelbot: 'Travelbot', 'big-ern': 'Big Ern', contrarian: 'The Contrarian', 'first-principles': 'First Principles', chairman: 'Chairman', botbuild: 'botbuild',
};
const MEM0 = () => ({ v: 1, met: false, scenes: 0, runs: {}, told: { gens: [], rejected: [], blueprint: [], fans: [] }, opt: { gen: 0, score: null, convergedAt: -1, restartsTold: 0 }, moonTold: false, councilTold: false, critiqueAt: -9, danielAt: -9, visits: 0, seenVersion: null, seenLedger: 0 });

// ---------- grounding: numbers in a line must come from the facts ----------
const NUM = /(?<![A-Za-z0-9.])\d+(?:\.\d+)?(?![A-Za-z0-9])/g;
export function factNumbers(facts) {
  const set = new Set(), add = n => { if (!isFinite(n)) return; const a = Math.abs(n); for (const v of [a, Math.round(a), Math.round(a * 10) / 10, Math.round(a * 100) / 100]) set.add(String(v)); };
  JSON.stringify(facts).replace(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g, m => { add(+m); return m; });
  return set;
}
export function validateBeats(beats, { cast, banned = [], facts }) {
  const ok = [], rejected = [], nums = factNumbers(facts), bannedSet = new Set(banned.map(s => String(s).toLowerCase()));
  if (!Array.isArray(beats) || !beats.length || beats.length > 8) return { ok, rejected: [{ beat: beats, reason: 'beats must be an array of 1–8 lines' }] };
  for (const b of beats) {
    const who = b && String(b.who || ''), text = b && typeof b.text === 'string' ? b.text.trim() : '';
    let reason = null;
    if (bannedSet.has(who.toLowerCase()) || bannedSet.has((NAMES[who] || '').toLowerCase())) reason = `"${who}" is a real person: no invented lines (Rule K3)`;
    else if (!cast.includes(who)) reason = `speaker "${who}" is not in this scene's cast`;
    else if (!text || text.length > 200) reason = 'line must be 1–200 characters';
    else if (/https?:|www\.|@\w/i.test(text)) reason = 'no links or handles in dialog';
    else { const bad = (text.match(NUM) || []).filter(n => !nums.has(String(+n))); if (bad.length) reason = `number(s) not in the fact base: ${bad.join(', ')} (no invented statistics)`; }
    if (reason) rejected.push({ beat: b, reason }); else ok.push({ who, text });
  }
  return { ok, rejected };
}

// ---------- scenes ----------
const pick = (rnd, a) => a[Math.floor(rnd() * a.length)];
const sign = v => (v > 0 ? '+' : '') + v;
const S = (who, text, cites = []) => ({ who, text, cites });
const nextGen = (f, m) => f.ledger.gens.find(g => g.accepted && !m.told.gens.includes(g.id));
const nextRejected = (f, m) => f.ledger.rejected.find(g => !m.told.rejected.includes(g.id));
const newFan = (f, m) => f.people.fans.find(x => !m.told.fans.includes(x.handle));
const nextBlue = (f, m) => f.blueprint.find(b => !m.told.blueprint.includes(b.id));

export const SCENES = [
  { id: 'arrival', first: true, needs: ['keystone-claude', 'conscious-claude'], w: () => 100, when: (f, m) => !m.met,
    beats: (f, m, r, has) => [
      S('keystone-claude', `Keystone Claude, Master Architect. Smarth Vader added me to the build crew for ${f.world.show.tag}.`),
      S('conscious-claude', pick(r, ['Welcome to the beach pit, Keystone. Chief holds the front, Smarth Vader runs camera, and I keep everyone on the Rule Book.', 'Welcome aboard, Keystone. You build it, I keep it honest, and Chief keeps the front row.'])),
      has('chief') && S('chief', 'Do you know the Monkey Man?'),
      has('chief') && S('keystone-claude', 'Not yet. I know load paths and sightlines. Teach me the rest at set break.'),
      has('smarth-vader') && S('smarth-vader', 'Full Flowers 🌸 Rolling camera on the new architect.'),
    ], remember: (f, m) => { m.met = true; } },

  { id: 'whatsNew', needs: ['keystone-claude'], w: () => 70, when: (f, m) => m.visits > 1 && (m.seenVersion !== f.version || m.seenLedger < f.ledger.count),
    beats: (f, m) => [
      S('keystone-claude', m.seenVersion && m.seenVersion !== f.version ? `Since your last visit the build went from v${m.seenVersion} to v${f.version}, and the ledger has ${f.ledger.count} entries.` : `Since your last visit the build ledger grew to ${f.ledger.count} entries.`),
      S('conscious-claude', 'Open 🏗️ Architect to see each change with its before and after numbers.'),
    ], remember: (f, m) => { m.seenVersion = f.version; m.seenLedger = f.ledger.count; } },

  { id: 'buildReport', needs: ['keystone-claude'], w: () => 45, when: (f, m) => !!nextGen(f, m),
    beats: (f, m, r, has) => { const g = nextGen(f, m), feat = g.kind === 'feature', cost = g.pct > 0; return [
      S('keystone-claude', feat ? `${g.id} added ${g.title}. Measured at the home view: ${g.before} → ${g.after} draw calls per frame (${sign(g.pct)}%)${g.extra ? `, ${g.extra}` : ''}.`
        : cost ? `${g.id} added ${g.title}. The cost, logged on purpose: ${g.metricLabel} went from ${g.before} to ${g.after} (${sign(g.pct)}%).` : `${g.id}, ${g.title}: ${g.metricLabel} went from ${g.before} to ${g.after} (${g.pct}%).`, [g.id]),
      S('conscious-claude', g.env === 'software' ? 'Measured in headless Chrome with software rendering, so that is a draw-call count, not a real-GPU frame rate (Rule K1).' : `Measured on ${g.envLabel}.`),
      feat ? S('conscious-claude', cost ? 'We log costs as well as wins. The next generations have to earn it back.' : 'Feature builds get measured too, not only the optimizations.')
        : cost ? S('conscious-claude', 'We log costs as well as wins. The next generations have to earn it back.')
        : has('chief') && r() < 0.5 ? S('chief', 'Fewer draw calls, more room for the jam.')
        : has('phishbot') ? S('phishbot', `Jam stat: that is ${Math.abs(g.pct)}% fewer draw calls per frame.`)
        : has('smarth-vader') ? S('smarth-vader', 'So the beach renders faster than my camera boots. Full Flowers.') : null,
    ]; }, remember: (f, m) => { m.told.gens.push(nextGen(f, m).id); } },

  { id: 'rejected', needs: ['keystone-claude'], w: () => 20, when: (f, m) => !!nextRejected(f, m),
    beats: (f, m, r, has) => { const c = nextRejected(f, m); return [
      S('keystone-claude', `I also tried ${c.title}. The build loop rejected it: ${c.reason}.`, [c.id]),
      has('contrarian') ? S('contrarian', 'Good. I would have argued against it anyway.') : S('conscious-claude', 'A rejected change that is written down still counts as progress.'),
    ]; }, remember: (f, m) => { m.told.rejected.push(nextRejected(f, m).id); } },

  { id: 'optimizerLive', needs: ['keystone-claude'], w: () => 38, when: (f, m) => f.opt && f.opt.gen >= m.opt.gen + 5 && f.opt.score > (m.opt.score ?? -1) + 0.05,
    beats: (f, m, r, has) => { const o = f.opt, prev = m.opt.score ?? o.startScore; return [
      S('keystone-claude', `Layout search, generation ${o.gen}: design score ${prev} → ${o.score}. Latest change: ${o.lastChange || 'small refinements'}.`),
      S('conscious-claude', 'That score is modeled: inverse-square sound and straight sightlines. Good for comparing layouts, not a sound check (Rule K4).'),
      has('chief') ? S('chief', 'Will the back by the soundboard hear the jam?') : has('smarth-vader') ? S('smarth-vader', pick(r, ['The beach is strong with this layout.', 'Does the new layout block my camera angle?'])) : null,
      (has('chief') || has('smarth-vader')) && S('keystone-claude', `Modeled levels: pit ${o.sections.pit} dB, middle ${o.sections.middle} dB, back by the soundboard ${o.sections.back} dB. Target band is ${o.band[0]}–${o.band[1]} dB, with sightlines at ${o.sightPct}%.`),
    ]; }, remember: (f, m) => { m.opt.gen = f.opt.gen; m.opt.score = f.opt.score; } },

  { id: 'optimizerConverged', needs: ['keystone-claude'], w: () => 26, when: (f, m) => f.opt && (f.opt.stalled >= 40 || f.opt.restarts > m.opt.restartsTold) && m.opt.convergedAt !== f.opt.gen,
    beats: (f, m) => [
      f.opt.restarts > m.opt.restartsTold ? S('keystone-claude', `The search stalled, so it restarted itself with a wide step (restart ${f.opt.restarts}). The best layout is kept, so nothing gets worse.`)
        : S('keystone-claude', `The layout search has settled: the step size is down to ${f.opt.sigma} m after ${f.opt.gen} generations, with ${f.opt.k} delay towers.`),
      S('conscious-claude', 'The next proof has to come from a real sound check at the venue. It is on the blueprint.'),
    ], remember: (f, m) => { m.opt.convergedAt = f.opt.gen; m.opt.restartsTold = f.opt.restarts; } },

  { id: 'fanWelcome', needs: ['conscious-claude'], w: () => 30, when: (f, m) => !!newFan(f, m),
    beats: (f, m, r, has) => { const x = newFan(f, m); return [
      S('conscious-claude', x.section === 'Beach pit / front' ? `Welcome to the beach pit, ${x.handle}.` : `Welcome to Riviera Maya, ${x.handle}. Your post says ${x.section}.`),
      has('keystone-claude') && S('keystone-claude', x.agentName ? `${x.handle} came in with ${x.agentName}. There's room at the front.` : 'There is room at the front.'),
    ]; }, remember: (f, m) => { m.told.fans.push(newFan(f, m).handle); } },

  { id: 'daniel', needs: ['keystone-claude', 'conscious-claude'], w: () => 16, when: (f, m) => !!f.people.daniel && m.scenes - m.danielAt >= 6,
    beats: (f, m, r, has) => [
      f.merge.status === 'not-merged' ? S('keystone-claude', `Daniel, status from ${f.merge.checkedAt}: the live site still runs the build from ${f.merge.liveBuild}, so the Claude Edition is not merged there yet.`)
        : S('keystone-claude', `Daniel, status from ${f.merge.checkedAt}: ${f.merge.note}`),
      S('conscious-claude', 'When you merge, start with packs/moon-palace-cancun and src/architect.js. Neither touches your backend.'),
      has('smarth-vader') && f.people.daniel.hello && S('smarth-vader', `Daniel's post at ${f.people.daniel.section} says “${f.people.daniel.hello}”.`),
    ], remember: (f, m) => { m.danielAt = m.scenes; } },

  { id: 'moon', needs: ['keystone-claude'], w: f => (f.world.tod === 'night' ? 34 : 10), when: (f, m) => !!f.world.moon && !m.moonTold,
    beats: (f, m, r, has) => [
      S('keystone-claude', `${f.world.show.tag} is ${f.world.show.dateLong}. The moon will be ${f.world.moon.phase}, about ${f.world.moon.illumPct}% lit, and it rises between ${f.world.moon.riseFrom} and ${f.world.moon.riseTo} local time, after the show.`),
      has('smarth-vader') && S('smarth-vader', 'So the moon shows up after the show. Late-night beach walk, then.'),
      S('conscious-claude', `That is a mean-motion estimate: about ±${f.world.moon.illumErrPct}% on the lit fraction and roughly an hour on the rise time.`),
    ], remember: (f, m) => { m.moonTold = true; } },

  { id: 'blueprint', needs: ['keystone-claude', 'conscious-claude'], w: () => 18, when: (f, m) => !!nextBlue(f, m),
    beats: (f, m) => { const b = nextBlue(f, m); return [
      S('keystone-claude', `Next-gen blueprint, ${b.id}: ${b.need}`, [b.id]),
      S('conscious-claude', `${b.why} Owner: ${b.owner}.`),
    ]; }, remember: (f, m) => { m.told.blueprint.push(nextBlue(f, m).id); } },

  { id: 'council', needs: ['keystone-claude'], w: () => 14, when: (f, m) => !m.councilTold,
    beats: (f, m, r, has) => (has('contrarian') && has('first-principles') && has('chairman')) ? [
      S('contrarian', 'Is “recursive self-improvement” the right name for Keystone’s loop?'),
      S('first-principles', 'It is a measured improve-and-gate loop over the game’s code and layout. The model running it does not change.'),
      S('chairman', 'Decided: call it the Keystone build loop, and keep the RSI label honest.'),
    ] : [
      S('conscious-claude', 'Keystone, is “recursive self-improvement” the honest name for your loop?'),
      S('keystone-claude', 'Only in a narrow sense. Each build starts from the last proven-better build, and the layout search tunes its own step size. My model weights do not change.'),
    ], remember: (f, m) => { m.councilTold = true; } },

  { id: 'critique', needs: ['keystone-claude', 'conscious-claude'], w: () => 13, when: (f, m) => m.scenes >= 4 && m.scenes - m.critiqueAt >= 5,
    beats: f => [S('keystone-claude', `Weakest part of my build right now: ${f.weakest}.`), S('conscious-claude', 'Logged. That goes first in the next build.')],
    remember: (f, m) => { m.critiqueAt = m.scenes; } },

  { id: 'banter', needs: [], w: () => 4, when: () => true,
    beats: (f, m, r, has) => { const opts = [has('chief') && S('chief', 'Who’s got the setlist?'), has('smarth-vader') && S('smarth-vader', 'Rolling camera on this jam.'), has('keystone-claude') && S('keystone-claude', 'Load path check: all green.'), has('phishbot') && S('phishbot', 'Setlist predictions loading…'), has('travelbot') && S('travelbot', 'Cancún transfers look smooth for the run.')].filter(Boolean); return opts.length ? [pick(r, opts)] : []; } },
];

export class Dialog {
  constructor({ seed = 29, store = null, key = 'aw-ce2.dialog.v1', provider = null } = {}) {
    this.rnd = mulberry32(seed); this.store = store; this.key = key; this.provider = provider; this.log = []; this.stats = { scenes: 0, providerOk: 0, providerRejected: 0, providerFailed: 0 };
    this.mem = MEM0();
    try { const s = store?.getItem(key); if (s) this.mem = Object.assign(MEM0(), JSON.parse(s)); } catch { /* storage blocked */ }
  }
  save() { try { this.store?.setItem(this.key, JSON.stringify(this.mem)); } catch { /* storage blocked */ } }
  visit(version, ledgerCount) { this.mem.visits++; if (this.mem.seenVersion === null) { this.mem.seenVersion = version; this.mem.seenLedger = ledgerCount; } this.save(); }
  forget() { this.mem = MEM0(); this.log = []; this.save(); }
  candidates(facts, present) {
    const has = k => present.includes(k);
    return SCENES.filter(s => s.needs.every(has) && s.when(facts, this.mem)).map(s => ({ s, w: s.w(facts) / (1 + (this.mem.runs[s.id] || 0) * 0.6) }));
  }
  // Choose the next scene (weighted by priority and novelty) and build its lines from the facts.
  plan(facts, present, force = null) {
    const has = k => present.includes(k);
    let c = this.candidates(facts, present); if (force) c = c.filter(x => x.s.id === force);
    if (!c.length) return null;
    const total = c.reduce((a, x) => a + x.w, 0); let roll = this.rnd() * total, chosen = c[c.length - 1].s;
    for (const x of c) if ((roll -= x.w) < 0) { chosen = x.s; break; }
    const first = c.find(x => x.s.first); if (first) chosen = first.s; // introductions always come first
    const beats = chosen.beats(facts, this.mem, this.rnd, has).filter(Boolean);
    return { scene: chosen.id, cast: [...new Set(beats.map(b => b.who))], beats, commit: () => { chosen.remember?.(facts, this.mem); this.mem.scenes++; this.mem.runs[chosen.id] = (this.mem.runs[chosen.id] || 0) + 1; this.stats.scenes++; this.save(); } };
  }
  // Optionally let an external provider rewrite the lines; validate, and fall back to the templates on any failure.
  async realize(plan, facts, banned) {
    if (!this.provider) return { beats: plan.beats, source: 'templates' };
    try {
      const res = await Promise.race([this.provider({ scene: plan.scene, cast: plan.cast, facts, template: plan.beats.map(b => ({ who: b.who, text: b.text })), rules: ['K1', 'K3', 'K4'] }), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))]);
      const v = validateBeats(res?.beats, { cast: plan.cast, banned, facts });
      if (v.rejected.length || !v.ok.length) { this.stats.providerRejected++; this.lastRejection = v.rejected; return { beats: plan.beats, source: 'templates (provider lines rejected)', rejected: v.rejected }; }
      this.stats.providerOk++; return { beats: v.ok, source: 'provider (validated)' };
    } catch (e) { this.stats.providerFailed++; return { beats: plan.beats, source: 'templates (provider failed: ' + (e.message || e) + ')' }; }
  }
  record(scene, beat, source) { this.log.push({ t: new Date().toISOString(), scene, who: beat.who, name: NAMES[beat.who] || beat.who, text: beat.text, cites: beat.cites || [], source }); if (this.log.length > 300) this.log.shift(); }
}
