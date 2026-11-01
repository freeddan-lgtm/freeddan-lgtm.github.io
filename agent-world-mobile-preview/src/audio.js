// Agent World · Conscious Claude Edition — audio.js (v2: distinct genre engines + modeled venue acoustics)
//
// Every stage runs its own band: a genre with its own instruments, groove, tempo, harmony and mix.
// Signal chain per stage:
//   instruments → bus → genre EQ → out ─┬→ air absorption (distance low-pass) → HRTF panner → master
//                                       └→ venue convolution reverb (diffuse field) → master
//   crowd / ocean / fire ambience → HRTF panner
// Venue impulse responses are generated from acoustic parameters: early reflections, pre-delay, and a
// diffuse tail with separate low / mid / high RT60. They are MODELED from typical values for each venue
// type, not measured impulse responses of the real buildings.
// Everything runs as 32-bit float at 48 kHz. There is no lossy codec anywhere in the chain.

const R = Math.random;
const pick = a => a[Math.floor(R() * a.length)];
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const CH = { maj: [0, 4, 7], min: [0, 3, 7], min7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], dom7: [0, 4, 7, 10], sus2: [0, 2, 7] };

// ---------- venue acoustics (modeled) ----------
export const VENUES = {
  arena:    { name: 'Arena bowl (MSG-style, ~19,000 seats)', rt60: [3.0, 2.3, 1.4], pre: 0.045, er: [[0.017, 0.5], [0.029, 0.42], [0.043, 0.36], [0.061, 0.3], [0.085, 0.24]], slap: [0.21, 0.16], wet: 0.34, crowd: 0.05 },
  beach:    { name: 'Open-air beach stage (canopy only)', rt60: [0.45, 0.32, 0.2], pre: 0.011, er: [[0.008, 0.45], [0.019, 0.22]], wet: 0.11, crowd: 0.03, amb: 'ocean' },
  theater:  { name: 'Historic theater (~2,500 seats)', rt60: [1.8, 1.45, 0.95], pre: 0.021, er: [[0.012, 0.5], [0.019, 0.46], [0.027, 0.4], [0.038, 0.34], [0.052, 0.28], [0.068, 0.22]], wet: 0.27, crowd: 0.035 },
  hall:     { name: 'Wood-panelled music hall', rt60: [1.3, 1.1, 0.8], pre: 0.016, er: [[0.010, 0.5], [0.017, 0.4], [0.026, 0.33], [0.04, 0.25]], wet: 0.22, crowd: 0.03 },
  club:     { name: 'Small club (~400 capacity)', rt60: [0.85, 0.65, 0.4], pre: 0.007, er: [[0.005, 0.55], [0.009, 0.45], [0.014, 0.38], [0.02, 0.3], [0.027, 0.22]], wet: 0.19, crowd: 0.04 },
  canyon:   { name: 'Rock-walled amphitheater', rt60: [1.5, 1.15, 0.7], pre: 0.028, er: [[0.024, 0.5], [0.041, 0.42], [0.066, 0.3]], slap: [0.26, 0.2], wet: 0.23, crowd: 0.04 },
  field:    { name: 'Open festival field', rt60: [0.4, 0.28, 0.18], pre: 0.01, er: [[0.012, 0.3]], wet: 0.08, crowd: 0.06 },
  campfire: { name: 'Open air, close around a fire', rt60: [0.22, 0.18, 0.12], pre: 0.004, er: [[0.005, 0.3]], wet: 0.05, crowd: 0, amb: 'fire' },
  lot:      { name: 'Parking-lot street between tents', rt60: [0.35, 0.27, 0.18], pre: 0.006, er: [[0.011, 0.3], [0.022, 0.2], [0.033, 0.13]], wet: 0.1, crowd: 0.05 },
  bowl:     { name: 'Concentric-shell amphitheater (Hollywood Bowl-style)', rt60: [1.1, 0.85, 0.55], pre: 0.006, er: [[0.006, 0.62], [0.009, 0.55], [0.013, 0.5], [0.018, 0.44], [0.024, 0.38], [0.031, 0.3], [0.04, 0.24]], wet: 0.17, crowd: 0.03 },
};

// ---------- genres ----------
// Each genre's play(E, st, c, t) is called once per 16th note. c = { i (0..15), bar, step, spb, inten, root, chord }.
export const GENRES = {
  'prog-funk': {
    name: 'Arena prog-funk rock', bpm: 108, root: 45, scale: [0, 2, 4, 5, 7, 9, 10], prog: [[0, 'dom7'], [10, 'maj'], [5, 'maj'], [0, 'dom7']], swing: 0.04, venue: 'arena', eq: [1, 1], trim: 0.85,
    play(E, st, c, t) {
      const { i, inten } = c;
      if (i === 0 || i === 10 || (i === 3 && inten > 0.5)) E.kick(st, t, { f0: 140, f1: 50, dec: 0.35, click: 0.4, vol: 0.9 });
      if (i === 4 || i === 12) E.snare(st, t, { vol: 0.55 });
      if (i === 7 || i === 9 || i === 15) E.snare(st, t, { vol: 0.07, dec: 0.07 });
      E.hat(st, t, false, i % 4 === 0 ? 0.12 : i % 2 === 0 ? 0.085 : 0.045);
      if (i === 14 && inten > 0.6) E.hat(st, t, true, 0.09);
      if (i === 0 && c.bar % 4 === 0) E.crash(st, t, 0.16 * inten + 0.05);
      const bp = { 0: 0, 3: 12, 6: 7, 8: 0, 10: 10, 11: 12, 14: 7 };
      if (i in bp) E.bass(st, t, mtof(c.root - 12 + bp[i]), c.spb * 1.5, 'finger', 0.4);
      if ([2, 5, 6, 10, 13].includes(i) && inten > 0.3) E.clav(st, t, c.chord.map(n => n + 12), 0.06);
      if (i === 0 && inten > 0.55) E.organ(st, t, c.chord.map(n => n + 12), c.spb * 15, 0.045);
      if (inten > 0.35) E.improv(st, c, t, 'guitar', { oct: 2, durs: [1, 2, 2, 3, 4, 6], p: 0.5 });
    },
  },
  'island-reggae': {
    name: 'Island reggae / calypso', bpm: 76, root: 50, scale: [0, 2, 4, 5, 7, 9, 11], prog: [[0, 'maj'], [5, 'maj'], [7, 'maj'], [5, 'maj']], swing: 0.12, venue: 'beach', eq: [0, 0], trim: 0.6,
    play(E, st, c, t) {
      const { i, inten } = c;
      if (i === 8) { E.kick(st, t, { f0: 95, f1: 48, dec: 0.5, click: 0.1, vol: 0.85 }); E.rim(st, t, 0.4); } // one drop
      if (i % 2 === 0) E.hat(st, t, false, i % 4 === 2 ? 0.07 : 0.045);
      E.shaker(st, t, i % 2 ? 0.025 : 0.04);
      if (i === 4 || i === 12) E.skank(st, t, c.chord.map(n => n + 12), 0.09);
      if (inten > 0.4 && i % 4 === 2) E.organ(st, t, c.chord.map(n => n + 12), c.spb * 0.7, 0.03);
      const bp = { 0: 0, 3: 0, 6: 7, 10: 4, 12: 5, 14: 7 };
      if (i in bp) E.bass(st, t, mtof(c.root - 12 + bp[i]), c.spb * (i === 0 ? 3 : 2), 'sub', 0.32);
      if (i % 2 === 0) E.improv(st, c, t, 'steel', { oct: 2, durs: [1, 2, 2, 3], unit: 2, p: 0.45 });
    },
  },
  'disco-house': {
    name: 'Indie disco-house', bpm: 124, root: 40, scale: [0, 2, 3, 5, 7, 9, 10], prog: [[0, 'min7'], [5, 'dom7']], barsPerChord: 2, swing: 0, venue: 'theater', eq: [1, 2], trim: 0.75,
    play(E, st, c, t) {
      const { i, inten } = c;
      if (i % 4 === 0) { E.kick(st, t, { f0: 120, f1: 47, dec: 0.5, click: 0.2, vol: 0.95 }); E.pump(st, t, c.spb * 3.5); }
      if (i === 4 || i === 12) E.clap(st, t, 0.4);
      if (i % 4 === 2) E.hat(st, t, true, 0.085);
      else E.hat(st, t, false, 0.035);
      if (i % 2 === 0) E.bass(st, t, mtof(c.root + (i % 4 === 2 ? 12 : 0)), c.spb * 0.9, 'octave', 0.45);
      if (i === 3 || i === 11 || (inten > 0.6 && i === 6)) E.rhodes(st, t, c.chord.map(n => n + 12), c.spb * 1.6, 0.07);
      if (inten > 0.4 && i % 2 === 1) E.chuck(st, t, c.chord.map(n => n + 24), 0.035);
      if (i === 0 && c.bar % 2 === 0) E.pad(st, t, c.chord.map(n => n + 12), c.spb * 31, 0.018);
      if (inten > 0.5) E.improv(st, c, t, 'cleanguitar', { oct: 3, durs: [1, 2, 2, 4], p: 0.4 });
    },
  },
  'trance-fusion': {
    name: 'Trance-fusion (livetronica)', bpm: 138, root: 42, scale: [0, 2, 3, 5, 7, 8, 10], prog: [[0, 'min'], [8, 'maj'], [3, 'maj'], [10, 'maj']], barsPerChord: 2, swing: 0, venue: 'theater', eq: [1, 2], trim: 0.86,
    play(E, st, c, t) {
      const { i, inten, bar } = c, phrase = bar % 8, breakdown = (bar % 32) >= 24 && (bar % 32) < 26;
      if (i % 4 === 0 && !breakdown) { E.kick(st, t, { f0: 165, f1: 52, dec: 0.28, click: 0.5, vol: 0.95 }); E.pump(st, t, c.spb * 3); }
      if (i % 4 === 2) E.hat(st, t, true, 0.075);
      if (inten > 0.6 && i % 2 === 1) E.hat(st, t, false, 0.035);
      if ((i === 4 || i === 12) && !breakdown) E.clap(st, t, 0.32);
      if (phrase === 7 && i >= 8) E.snare(st, t, { vol: 0.08 + (i - 8) * 0.04, dec: 0.08 });
      if (phrase === 6 && i === 0) E.riser(st, t, c.spb * 32);
      if (phrase === 0 && i === 0) E.crash(st, t, 0.22);
      if (i % 4 !== 0 && !breakdown) E.bass(st, t, mtof(c.root), c.spb * 0.8, 'roll', 0.42);
      if (i === 0 && bar % 2 === 0) E.pad(st, t, c.chord.map(n => n + 12), c.spb * 31, 0.022);
      if (inten > 0.45) { const seq = [0, 12, 7, 12, 3, 12, 10, 7]; E.acid(st, t, mtof(c.root + 12 + seq[(i + bar) % 8]), c.spb * 0.9, i % 4 === 2 ? 1 : 0.3, 0.05); }
    },
  },
  bluegrass: {
    name: 'Bluegrass breakdown', bpm: 150, root: 43, scale: [0, 2, 4, 7, 9], prog: [[0, 'maj'], [5, 'maj'], [0, 'maj'], [7, 'maj']], swing: 0.02, venue: 'hall', eq: [1, 1], trim: 1.9,
    play(E, st, c, t) {
      const { i, inten } = c;
      if (i === 0) E.upright(st, t, c.root - 12, 0.7);
      if (i === 8) E.upright(st, t, c.root - 5, 0.65);
      if (i === 4 || i === 12) { E.strum(st, t, c.chord.map(n => n + 12), 'guitar', 0.05, true); E.chop(st, t, c.chord.map(n => n + 24), 0.06); }
      const v = [c.chord[0] + 24, c.chord[1] + 24, c.chord[2] + 24, c.chord[0] + 36], roll = [0, 1, 3, 0, 1, 3, 0, 2];
      E.pluck(st, t, v[roll[i % 8]], { inst: 'banjo', vol: i % 2 ? 0.06 : 0.085 });
      if (inten > 0.45) E.improv(st, c, t, 'fiddle', { oct: 3, durs: [2, 3, 4, 6, 8], p: 0.55 });
    },
  },
  jamgrass: {
    name: 'Red-rock jamgrass', bpm: 132, root: 45, scale: [0, 2, 4, 5, 7, 9, 10], prog: [[0, 'maj'], [10, 'maj'], [5, 'maj'], [0, 'maj']], swing: 0.03, venue: 'canyon', eq: [1, 1], trim: 1.55,
    play(E, st, c, t) {
      const { i, inten } = c;
      if (i === 0 || i === 8) E.kick(st, t, { f0: 90, f1: 55, dec: 0.25, click: 0, vol: 0.45 });
      if (i === 4 || i === 12) E.snare(st, t, { vol: 0.18, dec: 0.25, bp: 3200, tone: [200, 300] });
      if (i % 2 === 0) E.shaker(st, t, 0.035);
      if (i % 4 === 0) E.upright(st, t, c.root - 12 + [0, 4, 7, 9][i / 4], 0.6);
      if ([0, 4, 6, 10, 12, 14].includes(i)) E.strum(st, t, c.chord.map(n => n + 12), 'guitar', i % 4 === 0 ? 0.05 : 0.03, i % 4 !== 0);
      E.improv(st, c, t, inten > 0.75 ? 'dobro' : 'mandolin', { oct: 3, durs: [1, 1, 2, 2, 3], p: 0.5 });
    },
  },
  'festival-rock': {
    name: 'Festival rock anthem', bpm: 126, root: 47, scale: [0, 2, 4, 5, 7, 9, 11], prog: [[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj']], swing: 0, venue: 'field', eq: [1, 2], trim: 1.1,
    play(E, st, c, t) {
      const { i, inten } = c;
      if (i === 0 || i === 8 || (inten > 0.6 && i === 6)) E.kick(st, t, { f0: 130, f1: 48, dec: 0.4, click: 0.5, vol: 0.95 });
      if (i === 4 || i === 12) E.snare(st, t, { vol: 0.65, dec: 0.25, tone: [170, 290] });
      if (i % 2 === 0) E.hat(st, t, false, 0.08);
      if (i === 0 && c.bar % 2 === 0) E.crash(st, t, 0.2);
      if (i % 2 === 0) E.power(st, t, c.root, inten > 0.6 && i === 0 ? c.spb * 7 : c.spb * 0.7, 0.05);
      if (i % 2 === 0) E.bass(st, t, mtof(c.root - 12), c.spb * 0.9, 'finger', 0.33);
      if (i === 0 && inten > 0.5) E.organ(st, t, c.chord.map(n => n + 12), c.spb * 15, 0.03);
      if (inten > 0.4) E.improv(st, c, t, 'guitar', { oct: 2, durs: [2, 2, 4, 4, 6, 8], p: 0.45 });
    },
  },
  'late-night-funk': {
    name: 'Late-night funk with horns', bpm: 98, root: 41, scale: [0, 2, 3, 5, 7, 9, 10], prog: [[0, 'min7'], [0, 'min7'], [0, 'min7'], [5, 'dom7']], swing: 0.1, venue: 'club', eq: [0, 1], trim: 1.1,
    play(E, st, c, t) {
      const { i, inten } = c;
      if (i === 0 || i === 7 || i === 10) E.kick(st, t, { f0: 120, f1: 52, dec: 0.3, click: 0.3, vol: 0.85 });
      if (i === 4 || i === 12) E.snare(st, t, { vol: 0.5, tone: [200, 340] });
      if ([2, 9, 15].includes(i)) E.snare(st, t, { vol: 0.06, dec: 0.06 });
      E.hat(st, t, false, i % 2 ? 0.035 : 0.07);
      if (inten > 0.55 && (i === 0 || i === 6 || i === 10)) E.cowbell(st, t, 0.06);
      const bp = { 0: 0, 2: 12, 3: 10, 7: 7, 10: 0, 11: 3, 14: 12 };
      if (i in bp) E.bass(st, t, mtof(c.root - 12 + bp[i]), c.spb * 0.9, 'slap', 0.36);
      if ([1, 3, 6, 9, 11, 14].includes(i)) E.clav(st, t, c.chord.map(n => n + 12), 0.05);
      if ((i === 6 || i === 14) && c.bar % 2 === 1) E.brass(st, t, c.chord.map(n => n + 12), c.spb * 1.2, 0.05);
      if (inten > 0.55) E.improv(st, c, t, 'brass', { oct: 3, durs: [1, 2, 2, 3, 4], p: 0.4 });
    },
  },
  campfire: {
    name: 'Campfire singalong (acoustic)', bpm: 88, root: 43, scale: [0, 2, 4, 5, 7, 9, 11], prog: [[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj']], swing: 0.14, venue: 'campfire', eq: [0, 0], trim: 2.6,
    play(E, st, c, t) {
      const { i, inten } = c;
      if ([0, 4, 6, 10, 12, 14].includes(i)) E.strum(st, t, c.chord.map(n => n + 12), 'guitar', i % 4 === 0 ? 0.16 : 0.1, i % 4 === 2);
      if (i % 4 === 2) E.shaker(st, t, 0.03);
      if (i === 0 || i === 8) E.kick(st, t, { f0: 100, f1: 62, dec: 0.18, click: 0, vol: 0.35 });
      if (i === 4 || i === 12) E.snare(st, t, { vol: 0.12, dec: 0.08, bp: 1600, tone: [240, 400] });
      if (inten > 0.5 && i % 2 === 0) E.improv(st, c, t, 'harmonica', { oct: 3, durs: [1, 2, 3, 4], unit: 2, p: 0.45 });
    },
  },
  'drum-circle': {
    name: 'Lot drum circle', bpm: 112, root: 50, scale: [0, 3, 5, 7, 10], prog: [[0, 'min']], swing: 0.3, venue: 'lot', eq: [1, 0], trim: 1.6,
    play(E, st, c, t) {
      const { i, inten } = c;
      if (i === 0 || i === 10) E.kick(st, t, { f0: 92, f1: 68, dec: 0.32, click: 0.05, vol: 0.6 });
      if (i === 0 || i === 8) E.djembe(st, t, 'bass', 0.6);
      if ([3, 6, 11, 14].includes(i)) E.djembe(st, t, 'tone', 0.4);
      if ([4, 12, 15].includes(i)) E.djembe(st, t, 'slap', 0.45);
      if ([2, 7, 10, 13].includes(i)) E.conga(st, t, i % 2 ? 330 : 247, 0.32);
      E.shaker(st, t, i % 2 ? 0.025 : 0.045);
      if ([0, 3, 6, 10, 12].includes(i)) E.cowbell(st, t, 0.04, true);
      if (inten > 0.5 && i % 2 === 0) E.improv(st, c, t, 'kalimba', { oct: 2, durs: [1, 1, 2], unit: 2, p: 0.4 });
    },
  },
  symphonic: {
    name: 'Symphonic pops under the stars', bpm: 84, root: 48, scale: [0, 2, 4, 5, 7, 9, 11], prog: [[0, 'maj'], [9, 'min'], [5, 'maj'], [7, 'dom7']], swing: 0, venue: 'bowl', eq: [0, 1], trim: 1.7,
    play(E, st, c, t) {
      const { i, inten, bar } = c;
      if (i === 0) E.strings(st, t, c.chord.map(n => n + 12), c.spb * 16, 0.045);
      if (i === 0 || i === 8) E.strings(st, t, [c.root - 12], c.spb * 8, 0.06);
      if (i % 2 === 0) { const arp = [0, 1, 2, 3, 2, 1, 2, 3], v = [...c.chord.map(n => n + 12), c.chord[0] + 24]; E.pluck(st, t, v[arp[i / 2] % v.length] + (i > 8 ? 12 : 0), { inst: 'harp', vol: 0.12 }); }
      if (i === 0 && bar % 4 === 0) E.timpani(st, t, mtof(c.root - 12), 0.5);
      const pk = bar % 32; if (pk >= 22 && pk < 24) E.timpani(st, t, mtof(c.root - 12), 0.08 + (pk - 22 + i / 16) * 0.12);
      if (pk === 23 && i === 0) E.cymbalSwell(st, t, c.spb * 16);
      if (inten > 0.65 && [3, 7, 11].includes(i)) E.celesta(st, t, c.chord[i % 3] + 24, 0.04);
      if (inten > 0.4 && i % 2 === 0) E.improv(st, c, t, 'horn', { oct: 2, durs: [2, 3, 4, 6], unit: 2, p: 0.5 });
    },
  },
};

// Which band plays where. Expansion packs add entries: STYLES[id] = { genre, venue? }.
export const STYLES = {
  'phish-msg': { genre: 'prog-funk', venue: 'arena' },
  'phish-rm': { genre: 'island-reggae', venue: 'beach' },
  goose: { genre: 'disco-house', venue: 'theater' },
  biscuits: { genre: 'trance-fusion', venue: 'theater' },
  other: { genre: 'bluegrass', venue: 'hall' },
};

const KS_PRESET = { // plucked strings (Karplus–Strong)
  banjo: { bright: 0.92, damp: 0.991, dur: 1.0, hp: 350 }, mandolin: { bright: 0.85, damp: 0.994, dur: 1.0, hp: 250 },
  guitar: { bright: 0.55, damp: 0.997, dur: 1.8, hp: 80 }, harp: { bright: 0.32, damp: 0.998, dur: 2.4, hp: 60 },
  upright: { bright: 0.22, damp: 0.993, dur: 1.2, hp: 30 }, dobro: { bright: 0.6, damp: 0.997, dur: 1.6, hp: 120 },
};

export class AudioEngine {
  constructor(ui) { this.ui = ui; this.on = false; this.vol = 0.8; this.stages = new Map(); this.focus = null; this.ks = new Map(); this.irs = new Map(); this.offline = false; }

  register(id, pos) {
    const s = STYLES[id] || {}, g = GENRES[s.genre] || GENRES['festival-rock'];
    const venue = s.venue || g.venue;
    this.stages.set(id, {
      id, pos: pos.clone(), genre: g, venue: VENUES[venue] || VENUES.theater,
      style: { name: s.name || g.name, bpm: g.bpm, venue, genre: s.genre, gain: s.gain },
      step: 0, next: 0, active: false, file: null, lead: { deg: 7, rest: 0 },
      energy: { low: 0, mid: 0, high: 0, level: 0, beat: 0, bpm: 0 }, spec: new Uint8Array(32),
    });
  }

  build(ctxOverride = null) {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = this.ctx = ctxOverride || new AC({ sampleRate: 48000, latencyHint: 'playback' });
    this.master = ctx.createGain(); this.master.gain.value = this.vol;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -6; lim.knee.value = 4; lim.ratio.value = 14; lim.attack.value = 0.002; lim.release.value = 0.2;
    this.master.connect(lim).connect(ctx.destination);
    const n = ctx.sampleRate * 2; this.noise = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this.noise.getChannelData(0); for (let i = 0; i < n; i++) d[i] = R() * 2 - 1;
    this.crackle = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const cd = this.crackle.getChannelData(0); for (let k = 0; k < 90; k++) { const at = Math.floor(R() * (cd.length - 600)), a = 0.3 + R() * 0.7; for (let j = 0; j < 500; j++) cd[at + j] += a * (R() * 2 - 1) * Math.exp(-j / (40 + R() * 80)); }
    this.drive = new Float32Array(2048); for (let i = 0; i < 2048; i++) { const x = i / 1024 - 1; this.drive[i] = Math.tanh(x * 3.2) * 0.9; }
    for (const st of this.stages.values()) this.buildStage(st);
  }

  irFor(key) {
    if (this.irs.has(key)) return this.irs.get(key);
    const v = VENUES[key] || VENUES.theater, ctx = this.ctx, sr = ctx.sampleRate;
    const n = Math.floor(sr * (Math.max(...v.rt60) * 1.2 + v.pre + 0.1)), ir = ctx.createBuffer(2, n, sr);
    const a = fc => 1 - Math.exp(-2 * Math.PI * fc / sr), a1 = a(250), a2 = a(3500), [rl, rm, rh] = v.rt60;
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (const [tt, g] of v.er) { const i0 = Math.floor((v.pre + tt + (c ? 0.0009 : -0.0005) * (0.5 + R())) * sr); for (let k = 0; k < 20 && i0 + k < n; k++) d[i0 + k] += g * (c ? 0.9 : 1) * Math.exp(-k / 3) * (k % 2 ? -0.5 : 1); }
      if (v.slap) { const i0 = Math.floor((v.pre + v.slap[0] + c * 0.004) * sr); for (let k = 0; k < 400 && i0 + k < n; k++) d[i0 + k] += v.slap[1] * (R() * 2 - 1) * Math.exp(-k / 90); }
      const start = Math.floor((v.pre + v.er[v.er.length - 1][0] * 0.5) * sr); let l1 = 0, l2 = 0;
      for (let i = start; i < n; i++) {
        const t = (i - start) / sr, x = R() * 2 - 1; l1 += a1 * (x - l1); l2 += a2 * (x - l2);
        d[i] += Math.min(1, t / 0.03) * 0.45 * (l1 * 3.5 * Math.exp(-6.91 * t / rl) + (l2 - l1) * Math.exp(-6.91 * t / rm) + (x - l2) * 0.45 * Math.exp(-6.91 * t / rh));
      }
    }
    this.irs.set(key, ir); return ir;
  }

  buildStage(st) {
    const ctx = this.ctx, g = st.genre;
    st.bus = ctx.createGain(); st.bus.gain.value = (st.style.gain ?? 0.8) * (g.trim || 1);
    st.lo = ctx.createBiquadFilter(); st.lo.type = 'lowshelf'; st.lo.frequency.value = 120; st.lo.gain.value = g.eq?.[0] ?? 0;
    st.hi = ctx.createBiquadFilter(); st.hi.type = 'highshelf'; st.hi.frequency.value = 6000; st.hi.gain.value = g.eq?.[1] ?? 0;
    st.out = ctx.createGain(); st.out.gain.value = 0;
    st.air = ctx.createBiquadFilter(); st.air.type = 'lowpass'; st.air.frequency.value = 18000; st.air.Q.value = 0.5;
    const p = st.panner = ctx.createPanner();
    Object.assign(p, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 10, maxDistance: 600, rolloffFactor: 1.1 });
    if (p.positionX) { p.positionX.value = st.pos.x; p.positionY.value = 5; p.positionZ.value = st.pos.z; } else p.setPosition(st.pos.x, 5, st.pos.z);
    st.bus.connect(st.lo).connect(st.hi).connect(st.out).connect(st.air).connect(p).connect(this.master);
    st.conv = ctx.createConvolver(); st.conv.buffer = this.irFor(st.style.venue);
    st.revGain = ctx.createGain(); st.revGain.gain.value = 0; st.conv.connect(st.revGain).connect(this.master);
    st.send = ctx.createGain(); st.out.connect(st.send);
    st.delay = ctx.createDelay(1.5); st.delay.delayTime.value = 60 / g.bpm * 0.75;
    const fb = ctx.createGain(); fb.gain.value = 0.3; const dl = ctx.createGain(); dl.gain.value = 0.22;
    st.delay.connect(fb).connect(st.delay); st.delay.connect(dl).connect(st.bus);
    st.pumpG = ctx.createGain(); st.pumpG.connect(st.bus); // pads duck under the kick (side-chain feel)
    st.amb = ctx.createGain(); st.amb.gain.value = 0; st.amb.connect(p);
    st.an = ctx.createAnalyser(); st.an.fftSize = 512; st.an.smoothingTimeConstant = 0.7; st.hi.connect(st.an);
    st.fft = new Uint8Array(st.an.frequencyBinCount);
  }

  activate(st, on, t) {
    st.active = on;
    st.out.gain.setTargetAtTime(on ? 1 : 0, t, on ? 0.3 : 0.6);
    st.amb.gain.setTargetAtTime(on ? 1 : 0, t, 0.8);
    if (on) {
      if (!st.convOn) { st.send.connect(st.conv); st.convOn = true; }
      st.next = t + 0.08; this.startAmb(st); if (st.file) this.playFile(st);
    } else {
      if (st.src) { st.src.stop(t + 1.5); st.src = null; }
      if (!this.offline) setTimeout(() => { if (!st.active) { if (st.convOn) { st.send.disconnect(st.conv); st.convOn = false; } this.stopAmb(st); } }, 4000);
    }
  }

  startAmb(st) {
    if (st.ambSrc) return; const c = this.ctx, v = st.venue, srcs = [];
    const loop = (buf, rate = 1) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; s.start(c.currentTime, R() * 1.5); srcs.push(s); return s; };
    if (v.crowd) { const s = loop(this.noise, 0.9), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 0.5; const g = c.createGain(); g.gain.value = v.crowd * 0.5; s.connect(bp).connect(g).connect(st.amb); }
    if (v.amb === 'ocean') {
      const s = loop(this.noise, 0.5), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; const g = c.createGain(); g.gain.value = 0.05;
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.08; lg.gain.value = 0.04; lfo.connect(lg).connect(g.gain); lfo.start(); srcs.push(lfo);
      s.connect(lp).connect(g).connect(st.amb);
    }
    if (v.amb === 'fire') { const s = loop(this.crackle), hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200; const g = c.createGain(); g.gain.value = 0.05; s.connect(hp).connect(g).connect(st.amb); }
    st.ambSrc = srcs;
  }
  stopAmb(st) { for (const s of st.ambSrc || []) try { s.stop(); } catch { /* already stopped */ } st.ambSrc = null; }

  async enable() {
    if (!this.ctx) this.build();
    await this.ctx.resume();
    this.on = true;
    clearInterval(this.timer); this.timer = setInterval(() => this.schedule(), 25);
    this.ui?.audioState?.(this);
  }
  disable() { this.on = false; clearInterval(this.timer); this.ctx?.suspend(); this.ui?.audioState?.(this); }
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
  pageHidden(h) { if (!this.ctx || !this.on) return; h ? this.ctx.suspend() : this.ctx.resume(); }

  // Each frame: move the listener, pick audible stages, model distance, smooth the light-show energy.
  update(camera) {
    const now = performance.now() / 1000, dt = Math.min(0.1, now - (this._last || now)); this._last = now;
    if (!this.ctx || !this.on) { for (const st of this.stages.values()) { const e = st.energy; e.level *= 0.92; e.low *= 0.92; e.mid *= 0.92; e.high *= 0.92; e.bpm = 0; } return; }
    const ctx = this.ctx, L = ctx.listener, p = camera.position, t = ctx.currentTime;
    const f = camera.getWorldDirection(this._f || (this._f = camera.position.clone())), up = camera.up;
    if (L.positionX) { L.positionX.setTargetAtTime(p.x, t, 0.05); L.positionY.setTargetAtTime(p.y, t, 0.05); L.positionZ.setTargetAtTime(p.z, t, 0.05); L.forwardX.setTargetAtTime(f.x, t, 0.05); L.forwardY.setTargetAtTime(f.y, t, 0.05); L.forwardZ.setTargetAtTime(f.z, t, 0.05); L.upX.value = up.x; L.upY.value = up.y; L.upZ.value = up.z; }
    else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, up.x, up.y, up.z); }
    let nearest = null, nd = 1e9;
    for (const st of this.stages.values()) {
      const d = Math.hypot(p.x - st.pos.x, p.y - 5, p.z - st.pos.z);
      if (d < nd) { nd = d; nearest = st; }
      const want = d < 120 || this.focus === st.id;
      if (want !== st.active) this.activate(st, want, t);
      // distance cues: high frequencies fade with distance (air absorption); the venue's reverb stays, so far = wetter
      st.air.frequency.setTargetAtTime(Math.max(2500, 19000 * Math.exp(-d / 160)), t, 0.2);
      st.revGain.gain.setTargetAtTime(st.active ? st.venue.wet * Math.max(0, Math.min(1, 1.5 - d / 140)) : 0, t, 0.3);
      const e = st.energy;
      if (st.active) {
        st.an.getByteFrequencyData(st.fft);
        const avg = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += st.fft[i]; return s / (b - a) / 255; };
        const raw = { low: avg(1, 6), mid: avg(6, 50), high: avg(50, 160) };
        raw.level = raw.low * 0.5 + raw.mid * 0.35 + raw.high * 0.15;
        for (const k of ['low', 'mid', 'high', 'level']) { const tau = raw[k] > e[k] ? 0.12 : 0.6; e[k] += (raw[k] - e[k]) * (1 - Math.exp(-dt / tau)); }
        for (let i = 0; i < 32; i++) { const a = Math.floor(Math.pow(i / 32, 1.6) * 200) + 1, b = Math.floor(Math.pow((i + 1) / 32, 1.6) * 200) + 2; st.spec[i] = Math.round(st.spec[i] * 0.6 + avg(a, b) * 255 * 0.4); }
        e.bpm = st.file ? 0 : st.genre.bpm;
        if (st.beatAnchor != null) e.beat = ((((t - st.beatAnchor) * e.bpm / 60) % 1) + 1) % 1;
      } else { e.level *= 0.94; e.low *= 0.94; e.mid *= 0.94; e.high *= 0.94; }
    }
    this.nearest = nd < 140 ? nearest : null;
  }

  schedule() {
    const ctx = this.ctx; if (!ctx || ctx.state !== 'running') return;
    const ahead = ctx.currentTime + 0.14;
    for (const st of this.stages.values()) {
      if (!st.active || st.file) continue;
      if (st.next < ctx.currentTime - 0.25) st.next = ctx.currentTime + 0.05;
      const spb = 60 / st.genre.bpm / 4;
      while (st.next < ahead) { this.stepAt(st, st.step, st.next); st.next += spb; st.step++; }
    }
  }
  stepAt(st, step, tGrid) {
    const g = st.genre, spb = 60 / g.bpm / 4, i = step % 16, bar = Math.floor(step / 16);
    if (i % 4 === 0) st.beatAnchor = tGrid;
    const arc = (bar % 32) / 32, inten = arc < 0.72 ? 0.25 + 0.75 * (arc / 0.72) : Math.max(0.25, 1 - 2.6 * (arc - 0.72));
    st.inten = inten;
    const [deg, q] = g.prog[Math.floor(bar / (g.barsPerChord || 1)) % g.prog.length], root = g.root + deg;
    const c = { i, bar, step, spb, inten, root, chord: CH[q].map(n => root + n) };
    if (i === 0 && bar % 32 === 22) this.cheer(st, tGrid);
    g.play(this, st, c, tGrid + (i % 2 ? g.swing * spb : 0));
  }

  // ---------- helpers ----------
  later(end, fn) { if (!this.offline) setTimeout(fn, Math.max(0, end - this.ctx.currentTime) * 1000 + 300); }
  gainEnv(t, a, peak, d, sus, len, r, dest) {
    const g = this.ctx.createGain(), p = g.gain, hold = Math.max(len, a + d);
    p.setValueAtTime(0.0001, t); p.exponentialRampToValueAtTime(peak, t + a);
    p.exponentialRampToValueAtTime(Math.max(0.0001, peak * sus), t + a + d);
    p.setValueAtTime(Math.max(0.0001, peak * sus), t + hold); p.exponentialRampToValueAtTime(0.0001, t + hold + r);
    g.connect(dest); g.end = t + hold + r + 0.02; return g;
  }
  // Oscillators are clamped below the Nyquist limit so high overtones never alias.
  osc(type, f, t, end, dest, det = 0) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(Math.min(f, this.ctx.sampleRate * 0.45), t); o.detune.value = det; o.connect(dest); o.start(t); o.stop(end); return o; }
  filt(type, f, q, dest) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; if (dest) b.connect(dest); return b; }
  nz(t, end, dest, rate = 1) { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = rate; s.connect(dest); s.start(t, R() * 1.5); s.stop(end); return s; }
  done(end, ...nodes) { this.later(end, () => nodes.forEach(n => { try { n.disconnect(); } catch { /* gone */ } })); }

  // ---------- drums ----------
  kick(st, t, { f0 = 150, f1 = 48, dec = 0.4, click = 0.3, vol = 0.9 } = {}) {
    const c = this.ctx, g = c.createGain(), o = c.createOscillator();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + 0.07);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dec);
    o.connect(g).connect(st.bus); o.start(t); o.stop(t + dec + 0.02);
    if (click) { const hp = this.filt('highpass', 2500, 0.7), cg = this.gainEnv(t, 0.001, click * 0.5, 0.008, 0.01, 0.008, 0.005, st.bus); hp.connect(cg); this.nz(t, t + 0.03, hp); this.done(t + 0.1, hp, cg); }
    this.done(t + dec + 0.1, g);
  }
  snare(st, t, { tone = [185, 330], bp = 2200, dec = 0.18, vol = 0.5 } = {}) {
    const tg = this.gainEnv(t, 0.001, vol * 0.6, 0.06, 0.01, 0.06, 0.02, st.bus);
    tone.forEach(f => this.osc('triangle', f, t, t + 0.12, tg));
    const b = this.filt('bandpass', bp, 0.7), ng = this.gainEnv(t, 0.001, vol, dec * 0.6, 0.2, dec * 0.6, dec * 0.4, st.bus); b.connect(ng); this.nz(t, t + dec + 0.05, b);
    this.done(t + dec + 0.2, tg, b, ng);
  }
  rim(st, t, vol) { const b = this.filt('bandpass', 1700, 4), g = this.gainEnv(t, 0.001, vol, 0.02, 0.01, 0.02, 0.01, st.bus); b.connect(g); this.nz(t, t + 0.05, b); const tg = this.gainEnv(t, 0.001, vol * 0.6, 0.02, 0.01, 0.02, 0.01, st.bus); this.osc('triangle', 520, t, t + 0.05, tg); this.done(t + 0.2, b, g, tg); }
  clap(st, t, vol) {
    const b = this.filt('bandpass', 1150, 1.1), g = this.ctx.createGain(), p = g.gain; g.connect(st.bus); b.connect(g);
    p.setValueAtTime(0, t); for (const k of [0, 0.011, 0.022]) { p.setValueAtTime(vol, t + k); p.exponentialRampToValueAtTime(vol * 0.2, t + k + 0.009); }
    p.setValueAtTime(vol * 0.7, t + 0.032); p.exponentialRampToValueAtTime(0.001, t + 0.2);
    this.nz(t, t + 0.22, b); this.done(t + 0.4, b, g);
  }
  hat(st, t, open, vol) { // six detuned square waves through band-pass and high-pass: the classic metallic hat
    const len = open ? 0.32 : 0.045, bp = this.filt('bandpass', 10000, 0.8), hp = this.filt('highpass', 7000, 0.7);
    const g = this.gainEnv(t, 0.001, vol, len * 0.5, 0.25, len * 0.5, len * 0.5, st.bus); bp.connect(hp).connect(g);
    for (const f of [205.3, 304.4, 369.6, 522.7, 540, 800]) this.osc('square', f * 1.9, t, t + len + 0.05, bp);
    this.done(t + len + 0.2, bp, hp, g);
  }
  crash(st, t, vol) {
    const hp = this.filt('highpass', 3500, 0.5), g = this.gainEnv(t, 0.002, vol, 0.3, 0.4, 0.5, 1.4, st.bus); hp.connect(g);
    this.nz(t, t + 2.3, hp); for (const f of [205.3, 304.4, 369.6, 522.7, 540, 800]) this.osc('square', f * 2.7, t, t + 2.3, hp);
    this.done(t + 2.5, hp, g);
  }
  cymbalSwell(st, t, len) { const hp = this.filt('highpass', 4000, 0.5), g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + len); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 1.5); hp.connect(g).connect(st.bus); this.nz(t, t + len + 1.6, hp); this.done(t + len + 2, hp, g); }
  shaker(st, t, vol) { const b = this.filt('bandpass', 6500, 1.2), g = this.gainEnv(t, 0.006, vol, 0.03, 0.2, 0.03, 0.03, st.bus); b.connect(g); this.nz(t, t + 0.1, b); this.done(t + 0.3, b, g); }
  cowbell(st, t, vol, agogo = false) { const b = this.filt('bandpass', agogo ? 1100 : 800, 3), g = this.gainEnv(t, 0.001, vol, 0.05, 0.3, 0.05, 0.15, st.bus); b.connect(g); const k = agogo ? 1.35 : 1; this.osc('square', 540 * k, t, t + 0.3, b); this.osc('square', 800 * k, t, t + 0.3, b); this.done(t + 0.5, b, g); }
  conga(st, t, f, vol) { const c = this.ctx, o = c.createOscillator(), g = this.gainEnv(t, 0.002, vol, 0.08, 0.3, 0.05, 0.15, st.bus); o.frequency.setValueAtTime(f * 1.12, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.04); o.connect(g); o.start(t); o.stop(t + 0.35); const b = this.filt('bandpass', 2200, 1.5), ng = this.gainEnv(t, 0.001, vol * 0.25, 0.01, 0.1, 0.01, 0.01, st.bus); b.connect(ng); this.nz(t, t + 0.04, b); this.done(t + 0.5, g, b, ng); }
  djembe(st, t, kind, vol) {
    if (kind === 'bass') return this.conga(st, t, 78, vol);
    if (kind === 'tone') return this.conga(st, t, 340, vol * 0.8);
    const b = this.filt('bandpass', 3000, 1), g = this.gainEnv(t, 0.001, vol, 0.03, 0.1, 0.02, 0.04, st.bus); b.connect(g); this.nz(t, t + 0.08, b);
    const tg = this.gainEnv(t, 0.001, vol * 0.4, 0.03, 0.1, 0.02, 0.03, st.bus); this.osc('sine', 520, t, t + 0.1, tg); this.done(t + 0.3, b, g, tg);
  }
  timpani(st, t, f, vol) {
    const g = this.gainEnv(t, 0.004, vol, 0.25, 0.35, 0.3, 1.4, st.bus);
    [[1, 1], [1.5, 0.5], [1.98, 0.3], [2.44, 0.15]].forEach(([r, a]) => { const gg = this.ctx.createGain(); gg.gain.value = a; gg.connect(g); const o = this.osc('sine', f * r * 1.01, t, t + 2.2, gg); o.frequency.exponentialRampToValueAtTime(f * r, t + 0.15); });
    const lp = this.filt('lowpass', 900, 0.7), ng = this.gainEnv(t, 0.001, vol * 0.4, 0.04, 0.05, 0.03, 0.05, st.bus); lp.connect(ng); this.nz(t, t + 0.1, lp);
    this.done(t + 2.5, g, lp, ng);
  }
  riser(st, t, len) { const b = this.filt('bandpass', 300, 2), g = this.ctx.createGain(); b.frequency.exponentialRampToValueAtTime(7000, t + len); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + len); g.gain.setValueAtTime(0.0001, t + len + 0.01); b.connect(g).connect(st.bus); this.nz(t, t + len + 0.02, b); this.done(t + len + 0.3, b, g); }
  cheer(st, t) { if (!st.venue.crowd) return; const b = this.filt('bandpass', 1300, 0.7), g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(st.venue.crowd * 4, t + 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5); b.connect(g).connect(st.amb); this.nz(t, t + 3.6, b, 0.8); this.done(t + 4, b, g); }
  pump(st, t, len) { const p = st.pumpG.gain; p.cancelScheduledValues(t); p.setValueAtTime(0.25, t); p.linearRampToValueAtTime(1, t + len); }

  // ---------- bass ----------
  bass(st, t, f, len, kind, vol) {
    if (kind === 'sub') { const lp = this.filt('lowpass', 260, 0.7), g = this.gainEnv(t, 0.012, vol, 0.1, 0.8, len, 0.08, st.bus); lp.connect(g); this.osc('sine', f, t, g.end, lp); this.osc('triangle', f, t, g.end, lp); this.done(g.end, lp, g); return; }
    if (kind === 'slap') { const lp = this.filt('lowpass', 3200, 2), g = this.gainEnv(t, 0.002, vol, 0.08, 0.45, len, 0.05, st.bus); lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(450, t + 0.12); lp.connect(g); this.osc('sawtooth', f, t, g.end, lp); this.osc('sine', f, t, g.end, g); const b = this.filt('bandpass', 2500, 2), ng = this.gainEnv(t, 0.001, vol * 0.3, 0.01, 0.1, 0.01, 0.01, st.bus); b.connect(ng); this.nz(t, t + 0.03, b); this.done(g.end, lp, g, b, ng); return; }
    if (kind === 'roll') { const lp = this.filt('lowpass', 700, 3), g = this.gainEnv(t, 0.003, vol, 0.06, 0.35, len, 0.03, st.bus); lp.connect(g); this.osc('sawtooth', f, t, g.end, lp, -6); this.osc('sawtooth', f, t, g.end, lp, 6); this.done(g.end, lp, g); return; }
    const base = kind === 'octave' ? 900 : 650 + (st.inten || 0.5) * 300;
    const lp = this.filt('lowpass', base, kind === 'octave' ? 4 : 1.5), g = this.gainEnv(t, 0.004, vol, 0.12, 0.6, len, 0.06, st.bus);
    lp.frequency.setValueAtTime(base * 1.8, t); lp.frequency.exponentialRampToValueAtTime(base, t + 0.12);
    lp.connect(g); this.osc(kind === 'octave' ? 'square' : 'sawtooth', f, t, g.end, lp); this.osc('sine', f / 2, t, g.end, g);
    this.done(g.end, lp, g);
  }
  acid(st, t, f, len, accent, vol) { // TB-303 style resonant squelch
    const lp = this.filt('lowpass', 300, 13), g = this.gainEnv(t, 0.003, vol * (0.7 + accent * 0.5), 0.1, 0.5, len, 0.03, st.bus);
    lp.frequency.setValueAtTime(400 + accent * 2600, t); lp.frequency.exponentialRampToValueAtTime(260, t + len);
    lp.connect(g); g.connect(st.delay); this.osc('sawtooth', f, t, g.end, lp); this.done(g.end + 0.5, lp, g);
  }
  upright(st, t, midi, vol) { this.pluck(st, t, midi, { inst: 'upright', vol }); const g = this.gainEnv(t, 0.01, vol * 0.25, 0.2, 0.3, 0.2, 0.3, st.bus); this.osc('sine', mtof(midi), t, g.end, g); this.done(g.end, g); }

  // ---------- keys, guitars, pads ----------
  clav(st, t, chord, vol) { for (const n of chord) { const b = this.filt('bandpass', 1500, 3), g = this.gainEnv(t, 0.002, vol, 0.06, 0.15, 0.04, 0.04, st.bus); b.connect(g); this.osc('square', mtof(n), t, g.end, b); this.done(g.end, b, g); } }
  organ(st, t, chord, len, vol) {
    const g = this.gainEnv(t, 0.02, vol, 0.1, 0.9, len, 0.15, st.bus), trem = this.ctx.createOscillator(), tg = this.ctx.createGain();
    trem.frequency.value = 6.4; tg.gain.value = vol * 0.25; trem.connect(tg).connect(g.gain); trem.start(t); trem.stop(g.end);
    for (const n of chord) [[1, 1], [2, 0.6], [3, 0.4], [4, 0.25], [6, 0.12]].forEach(([r, a]) => { const gg = this.ctx.createGain(); gg.gain.value = a; gg.connect(g); this.osc('sine', mtof(n) * r, t, g.end, gg); });
    this.done(g.end, g, tg);
  }
  rhodes(st, t, chord, len, vol) {
    for (const n of chord) {
      const f = mtof(n), g = this.gainEnv(t, 0.003, vol, 0.4, 0.35, len, 0.3, st.bus), car = this.osc('sine', f, t, g.end, g);
      const mod = this.ctx.createOscillator(), mg = this.ctx.createGain(); mod.frequency.value = f; mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(f * 0.15, t + 0.6);
      mod.connect(mg).connect(car.frequency); mod.start(t); mod.stop(g.end); this.done(g.end, g, mg);
    }
  }
  skank(st, t, chord, vol) { const hp = this.filt('highpass', 500, 0.7), lp = this.filt('lowpass', 3200, 0.7), g = this.gainEnv(t, 0.002, vol, 0.05, 0.2, 0.04, 0.05, st.bus); hp.connect(lp).connect(g); chord.forEach((n, k) => this.osc('sawtooth', mtof(n), t + k * 0.004, g.end, hp, 5)); this.done(g.end, hp, lp, g); }
  chuck(st, t, chord, vol) { const b = this.filt('bandpass', 1900, 1.2), g = this.gainEnv(t, 0.001, vol, 0.025, 0.1, 0.02, 0.02, st.bus); b.connect(g); chord.forEach(n => this.osc('sawtooth', mtof(n), t, g.end, b)); this.done(g.end, b, g); }
  power(st, t, root, len, vol) {
    const pre = this.ctx.createGain(); pre.gain.value = 3.5; const ws = this.ctx.createWaveShaper(); ws.curve = this.drive; ws.oversample = '4x';
    const lp = this.filt('lowpass', 3400, 0.8), hp = this.filt('highpass', 90, 0.7), g = this.gainEnv(t, 0.003, vol, 0.1, 0.7, len, 0.08, st.bus);
    pre.connect(ws).connect(hp).connect(lp).connect(g);
    for (const n of [root, root + 7, root + 12]) { this.osc('sawtooth', mtof(n), t, g.end, pre, -7); this.osc('sawtooth', mtof(n), t, g.end, pre, 7); }
    this.done(g.end, pre, ws, lp, hp, g);
  }
  pad(st, t, chord, len, vol) {
    const lp = this.filt('lowpass', 2800, 0.6), g = this.gainEnv(t, 0.4, vol, 0.5, 0.85, len, 0.8, st.pumpG); lp.connect(g);
    for (const n of chord) for (const d of [-18, -7, 0, 7, 18]) this.osc('sawtooth', mtof(n), t, g.end, lp, d);
    this.done(g.end, lp, g);
  }
  strings(st, t, chord, len, vol) {
    const lp = this.filt('lowpass', 2300, 0.6), g = this.gainEnv(t, 0.38, vol, 0.4, 0.9, len, 0.7, st.bus); lp.connect(g);
    const vib = this.ctx.createOscillator(), vg = this.ctx.createGain(); vib.frequency.value = 5.3; vg.gain.value = 7; vib.connect(vg); vib.start(t); vib.stop(g.end);
    for (const n of chord) for (const d of [-9, 0, 9]) { const o = this.osc('sawtooth', mtof(n), t, g.end, lp, d); vg.connect(o.detune); }
    this.done(g.end, lp, g, vg);
  }
  brass(st, t, chord, len, vol, soft = false) {
    for (const n of [].concat(chord)) {
      const lp = this.filt('lowpass', 400, 1.2), g = this.gainEnv(t, soft ? 0.09 : 0.04, vol, 0.1, 0.75, len, soft ? 0.25 : 0.1, st.bus);
      lp.frequency.setValueAtTime(400, t); lp.frequency.exponentialRampToValueAtTime(soft ? 1300 : 2600, t + (soft ? 0.18 : 0.08)); lp.frequency.exponentialRampToValueAtTime(soft ? 900 : 1600, t + 0.4);
      lp.connect(g); const o = this.osc('sawtooth', mtof(n), t, g.end, lp); o.detune.setValueAtTime(-35, t); o.detune.linearRampToValueAtTime(0, t + 0.06);
      this.done(g.end, lp, g);
    }
  }
  celesta(st, t, midi, vol) { const f = mtof(midi), g = this.gainEnv(t, 0.002, vol, 0.3, 0.2, 0.2, 0.6, st.bus); this.osc('sine', f, t, g.end, g); const g2 = this.gainEnv(t, 0.002, vol * 0.3, 0.1, 0.1, 0.05, 0.2, st.bus); this.osc('sine', f * 4, t, g2.end, g2); this.done(g.end, g, g2); }

  // Karplus–Strong plucked string, rendered once per note and cached (tuned exactly with playbackRate).
  ksBuffer(midi, inst) {
    const key = inst + midi; if (this.ks.has(key)) return this.ks.get(key);
    const P = KS_PRESET[inst], sr = this.ctx.sampleRate, f = mtof(midi), L = Math.max(2, Math.round(sr / f - 0.5));
    const n = Math.floor(sr * P.dur), buf = this.ctx.createBuffer(1, n, sr), d = buf.getChannelData(0), line = new Float32Array(L);
    let y = 0; for (let i = 0; i < L; i++) { y += P.bright * ((R() * 2 - 1) - y); line[i] = y; }
    let p = 0, peak = 0;
    for (let i = 0; i < n; i++) { const a = line[p], b = line[(p + 1) % L]; d[i] = a; line[p] = P.damp * 0.5 * (a + b); p = (p + 1) % L; peak = Math.max(peak, Math.abs(a)); }
    for (let i = 0; i < n; i++) d[i] /= peak || 1;
    const out = { buf, rate: f / (sr / (L + 0.5)) }; this.ks.set(key, out); return out;
  }
  pluck(st, t, midi, { inst = 'guitar', vol = 0.1, len = null, glide = 0, dest = null } = {}) {
    const { buf, rate } = this.ksBuffer(Math.round(midi), inst), s = this.ctx.createBufferSource(); s.buffer = buf;
    s.playbackRate.setValueAtTime(rate * (glide ? Math.pow(2, -glide / 12) : 1), t); if (glide) s.playbackRate.exponentialRampToValueAtTime(rate, t + 0.12);
    const hp = this.filt('highpass', KS_PRESET[inst].hp, 0.7), g = this.ctx.createGain(), end = t + (len ?? buf.duration);
    g.gain.setValueAtTime(vol, t); if (len != null) { g.gain.setValueAtTime(vol, t + len); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.04); }
    s.connect(hp).connect(g).connect(dest || st.bus); s.start(t); s.stop(end + 0.05); this.done(end + 0.1, hp, g);
  }
  strum(st, t, chord, inst, vol, up = false) { const notes = up ? [...chord].reverse() : chord; notes.forEach((n, k) => this.pluck(st, t + k * 0.012, n, { inst, vol })); }
  chop(st, t, chord, vol) { chord.forEach((n, k) => this.pluck(st, t + k * 0.004, n, { inst: 'mandolin', vol, len: 0.07 })); }

  // ---------- improvising lead ----------
  improv(st, c, t, inst, o = {}) {
    const g = st.genre, L = st.lead;
    if (L.rest > 0) { L.rest--; return; }
    const phraseRest = c.bar % 4 === 3 && c.i >= 8;
    if (R() > (o.p ?? 0.5) * (phraseRest ? 0.15 : 0.45 + c.inten * 0.65)) return;
    const sc = g.scale, span = sc.length * 2;
    L.deg = Math.max(0, Math.min(span, L.deg + pick([-2, -1, -1, 1, 1, 2, 0, 3, -3])));
    if (c.i % 8 === 0) { const target = pick(c.chord) % 12; let best = L.deg, bd = 99; for (let d = 0; d <= span; d++) { const n = g.root + sc[d % sc.length] + 12 * Math.floor(d / sc.length); if (n % 12 === target && Math.abs(d - L.deg) < bd) { bd = Math.abs(d - L.deg); best = d; } } L.deg = best; }
    let midi = g.root + 12 * (o.oct ?? 2) + sc[L.deg % sc.length] + 12 * Math.floor(L.deg / sc.length);
    while (midi > 93) midi -= 12; // keep leads in a natural playing range (≤ A6)
    const steps = pick(o.durs || [1, 2, 2, 4]); L.rest = steps - 1;
    this.lead(st, inst, midi, t, c.spb * steps * (o.unit || 1) * 0.95, c);
  }
  lead(st, inst, midi, t, len, c) {
    const f = mtof(midi), ctx = this.ctx;
    if (inst === 'mandolin' || inst === 'dobro' || inst === 'banjo') {
      if (inst === 'mandolin' && len > 0.25) { for (let k = 0; k * 0.065 < len; k++) this.pluck(st, t + k * 0.065, midi, { inst, vol: 0.07, len: 0.08 }); return; }
      return this.pluck(st, t, midi, { inst, vol: 0.11, glide: inst === 'dobro' ? 2 : 0 });
    }
    if (inst === 'steel') {
      const g = this.gainEnv(t, 0.003, 0.14, 0.45, 0.25, Math.min(len, 0.5), 0.35, st.bus);
      [[1, 1], [2, 0.45], [3.02, 0.16], [4.1, 0.06]].forEach(([r, a]) => { const gg = ctx.createGain(); gg.gain.value = a; gg.connect(g); this.osc('sine', f * r, t, g.end, gg); });
      if (len > 0.45) for (let k = 1; k * 0.075 < len; k++) { const g2 = this.gainEnv(t + k * 0.075, 0.003, 0.05, 0.05, 0.3, 0.04, 0.05, st.bus); this.osc('sine', f, t + k * 0.075, g2.end, g2); this.done(g2.end, g2); }
      return this.done(g.end, g);
    }
    if (inst === 'kalimba') { const g = this.gainEnv(t, 0.002, 0.12, 0.25, 0.2, 0.1, 0.5, st.bus); this.osc('sine', f, t, g.end, g); const g2 = this.gainEnv(t, 0.001, 0.03, 0.04, 0.1, 0.02, 0.05, st.bus); this.osc('sine', f * 5.4, t, g2.end, g2); return this.done(g.end, g, g2); }
    if (inst === 'brass' || inst === 'horn') return this.brass(st, t, midi, len, inst === 'horn' ? 0.06 : 0.07, inst === 'horn');
    if (inst === 'cleanguitar') { this.pluck(st, t, midi, { inst: 'guitar', vol: 0.12, dest: st.delay }); return this.pluck(st, t, midi, { inst: 'guitar', vol: 0.14 }); }
    const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = inst === 'fiddle' ? 5.8 : inst === 'harmonica' ? 5 : 5.6; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(inst === 'fiddle' ? 14 : 9, t + Math.min(len, 0.3)); vib.connect(vg);
    let g; const nodes = [vg];
    if (inst === 'fiddle') {
      g = this.gainEnv(t, 0.07, 0.07, 0.1, 0.85, len, 0.12, st.bus);
      const f1 = this.filt('bandpass', 750, 2, g), f2 = this.filt('bandpass', 2600, 2.5, g), lp = this.filt('lowpass', 4500, 0.7, g); nodes.push(f1, f2, lp, g);
      const o = this.osc('sawtooth', f, t, g.end, f1); o.connect(f2); o.connect(lp); vg.connect(o.detune);
    } else if (inst === 'harmonica') {
      g = this.gainEnv(t, 0.05, 0.06, 0.1, 0.8, len, 0.1, st.bus);
      const b = this.filt('bandpass', 1300, 1.4, g); nodes.push(b, g);
      const o1 = this.osc('square', f, t, g.end, b), o2 = this.osc('sawtooth', f, t, g.end, b, 8); vg.connect(o1.detune); vg.connect(o2.detune);
    } else { // overdriven lead guitar with string bends
      g = this.gainEnv(t, 0.005, 0.08, 0.15, 0.75, len, 0.18, st.bus);
      const pre = ctx.createGain(); pre.gain.value = 2.5 + (c?.inten || 0.5) * 3; const ws = ctx.createWaveShaper(); ws.curve = this.drive; ws.oversample = '4x';
      const cab = this.filt('lowpass', 3600, 0.9), hp = this.filt('highpass', 120, 0.7); pre.connect(ws).connect(hp).connect(cab).connect(g); g.connect(st.delay); nodes.push(pre, ws, cab, hp, g);
      const bend = R() < 0.3 && len > 0.2, o1 = this.osc('sawtooth', f, t, g.end, pre, -5), o2 = this.osc('square', f, t, g.end, pre, 5);
      for (const o of [o1, o2]) { if (bend) { o.frequency.setValueAtTime(f * Math.pow(2, -2 / 12), t); o.frequency.exponentialRampToValueAtTime(f, t + 0.12); } vg.connect(o.detune); }
    }
    vib.start(t); vib.stop(g.end); this.done(g.end, ...nodes);
  }

  // ---------- files and licensed recordings ----------
  async loadFile(stageId, file) {
    if (!this.ctx) await this.enable();
    return this.useBuffer(stageId, await file.arrayBuffer(), { name: file.name, type: file.type });
  }
  async loadUrl(stageId, url, meta = {}) { // licensed recordings hosted with the app (Rule A5)
    if (!this.ctx) this.build();
    const r = await fetch(url); if (!r.ok) throw new Error(`Could not fetch ${url} (${r.status})`);
    return this.useBuffer(stageId, await r.arrayBuffer(), { name: meta.title || url.split('/').pop(), type: r.headers.get('content-type') || '' }, meta);
  }
  async useBuffer(stageId, buf, fileLike, meta = null) {
    const st = this.stages.get(stageId); if (!st) throw new Error('Unknown stage');
    const info = sniff(new DataView(buf), fileLike);
    const audio = await this.ctx.decodeAudioData(buf.slice(0));
    if (st.src) { st.src.stop(); st.src = null; }
    st.file = { name: fileLike.name, audio, info, licensed: meta };
    if (!meta) this.focus = stageId; // a file you just picked plays right away; licensed tracks wait until you're near
    if (st.active) this.playFile(st);
    return describe(info, this.ctx.sampleRate, audio);
  }
  playFile(st) { if (st.src) st.src.stop(); const s = this.ctx.createBufferSource(); s.buffer = st.file.audio; s.loop = true; s.connect(st.bus); s.start(); st.src = s; }
  clearFile(stageId) { const st = this.stages.get(stageId); if (!st) return; if (st.src) st.src.stop(); st.src = null; st.file = null; }
  styleOf(id) { return this.stages.get(id)?.style; }
  venueOf(id) { return this.stages.get(id)?.venue; }
  fileOf(id) { return this.stages.get(id)?.file; }
}

// Render a few seconds of a stage's band offline (no speakers needed): used for previews and tests.
export async function renderPreview(id, seconds = 12, startBar = 14) {
  const eng = new AudioEngine(); eng.offline = true;
  const ctx = new OfflineAudioContext(2, Math.floor(48000 * seconds), 48000);
  const pos = { x: 0, y: 0, z: -14, clone() { return { x: 0, y: 0, z: -14 }; } };
  eng.register(id, pos); eng.build(ctx);
  const st = eng.stages.get(id); eng.activate(st, true, 0); st.revGain.gain.value = st.venue.wet;
  const spb = 60 / st.genre.bpm / 4;
  for (let k = 0, t = 0.05; t < seconds - 0.3; k++, t += spb) eng.stepAt(st, startBar * 16 + k, t);
  return ctx.startRendering();
}

// Read the container header so the player can report format, bit depth and sample rate honestly.
function sniff(v, file) {
  const tag = n => String.fromCharCode(...Array.from({ length: 4 }, (_, i) => v.getUint8(n + i)));
  try {
    if (tag(0) === 'fLaC') { const b = o => v.getUint8(8 + o); return { fmt: 'FLAC', lossless: true, rate: (b(10) << 12) | (b(11) << 4) | (b(12) >> 4), ch: ((b(12) >> 1) & 7) + 1, bits: (((b(12) & 1) << 4) | (b(13) >> 4)) + 1 }; }
    if (tag(0) === 'RIFF' && tag(8) === 'WAVE') { let o = 12; while (o < v.byteLength - 8) { const id = tag(o), sz = v.getUint32(o + 4, true); if (id === 'fmt ') { const fmt = v.getUint16(o + 8, true); return { fmt: fmt === 3 ? 'WAV (float)' : 'WAV', lossless: true, ch: v.getUint16(o + 10, true), rate: v.getUint32(o + 12, true), bits: v.getUint16(o + 22, true) }; } o += 8 + sz + (sz & 1); } }
    if (tag(0) === 'FORM' && (tag(8) === 'AIFF' || tag(8) === 'AIFC')) return { fmt: 'AIFF', lossless: true };
    if (tag(4) === 'ftyp') return { fmt: 'MP4/M4A (ALAC is lossless, AAC is not)', lossless: null };
    if (tag(0).startsWith('ID3') || (v.getUint8(0) === 0xff && (v.getUint8(1) & 0xe0) === 0xe0)) return { fmt: 'MP3', lossless: false };
    if (tag(0) === 'OggS') return { fmt: 'Ogg (Vorbis/Opus, lossy)', lossless: false };
  } catch { /* fall through */ }
  return { fmt: file.type || 'unknown', lossless: null };
}
function describe(i, ctxRate, a) {
  const parts = [i.fmt]; if (i.bits) parts.push(`${i.bits}-bit`); if (i.rate) parts.push(`${(i.rate / 1000).toFixed(1).replace('.0', '')} kHz`);
  const lossless = i.lossless === true ? 'Lossless source' : i.lossless === false ? 'Lossy source (the file itself is compressed)' : 'Source type unknown';
  const rs = i.rate && i.rate !== ctxRate ? ` · browser resampled ${i.rate / 1000}→${ctxRate / 1000} kHz` : ' · no resampling';
  return `${parts.join(' · ')} · ${a.numberOfChannels} ch · ${a.duration.toFixed(1)} s — ${lossless}; played as 32-bit float${rs}`;
}
