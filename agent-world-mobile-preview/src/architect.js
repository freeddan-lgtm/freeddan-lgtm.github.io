// Agent World · Claude Edition (v2.0, Keystone build) — architect.js
// Keystone Claude's in-world build loop: a seeded (1+λ) evolution strategy that keeps improving a concert-venue
// layout (delay-speaker towers + the soundboard) against a MODELED objective, and adapts its own step size with the
// 1/5 success rule. Pure JavaScript (no three.js, no DOM), so it runs and replays identically in Node and the browser.
//
// What it is: an elitist search over a layout. The best design never gets worse; the search tunes its own mutation
// size from its success rate. What it is not: a model rewriting itself. The objective is a simple acoustic and
// sightline model, good for comparing layouts, not a substitute for measuring a real venue (Rule K4).

export function mulberry32(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const gauss = rnd => { let u = 0; while (u <= 1e-12) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r1 = v => Math.round(v * 10) / 10;

// Default venue: the Moon Palace Cancún beach stage (artistic model, metres, venue-local axes:
// the stage is at negative z and faces +z; house right is +x).
export const MOON_PALACE_SPEC = {
  name: 'Moon Palace Cancún · beach stage (modeled)',
  stage: { x: 0, z: -14, y: 7, axis: [0, 1] },
  mainLevel: 120,      // dB SPL at 1 m, main PA (modeled point source; tuned so the pit sits just under the 102 dB cap)
  towerLevel: 113,     // dB SPL at 1 m, each delay tower (modeled)
  towerHeight: 6, earHeight: 1.6, c: 343,
  haas: 0.010,         // towers are delayed to arrive 10 ms after the main PA on their own axis
  band: [92, 102],     // target listening band, dB (102 dB cap is guideline-inspired, not a legal limit)
  sections: [
    { id: 'pit', name: 'Beach pit / front', x0: -14, x1: 14, z0: -8, z1: 0, w: 1.3 },
    { id: 'middle', name: 'Beach middle', x0: -18, x1: 18, z0: 0, z1: 11, w: 1.0 },
    { id: 'back', name: 'Back by soundboard', x0: -22, x1: 22, z0: 11, z1: 26, w: 0.8 },
  ],
  towerZone: { x0: -20, x1: 20, z0: 2, z1: 22 }, fohZone: { x0: -8, x1: 8, z0: 12, z1: 24 },
  grid: 2, towerR: 0.9, fohR: 2.4, kMax: 4, towerCost: 1.5, minSpacing: 4,
  initial: { towers: [{ x: 0, z: 6 }], foh: { x: 0, z: 12.5 } }, // a naive first draft: one tower dead centre, desk at the front edge
};

export class VenueDesignProblem {
  constructor(spec = MOON_PALACE_SPEC) {
    this.spec = spec; this.points = [];
    for (const s of spec.sections) for (let x = s.x0 + spec.grid / 2; x < s.x1; x += spec.grid) for (let z = s.z0 + spec.grid / 2; z < s.z1; z += spec.grid) this.points.push({ x, z, w: s.w, sec: s.id });
    this.W = this.points.reduce((a, p) => a + p.w, 0);
  }
  initial() { return clone(this.spec.initial); }
  clampDesign(d) {
    const S = this.spec, T = S.towerZone, F = S.fohZone;
    return { towers: d.towers.slice(0, S.kMax).map(t => ({ x: clamp(t.x, T.x0, T.x1), z: clamp(t.z, T.z0, T.z1) })), foh: { x: clamp(d.foh.x, F.x0, F.x1), z: clamp(d.foh.z, F.z0, F.z1) } };
  }
  // Modeled level at a listener: incoherent power sum of the main PA and every tower, each a cardioid point source
  // with inverse-square spreading (no air absorption, no ground reflection).
  levelAt(d, x, z) {
    const S = this.spec, st = S.stage, eh = S.earHeight;
    const dm = Math.hypot(x - st.x, eh - st.y, z - st.z), cm = ((x - st.x) * st.axis[0] + (z - st.z) * st.axis[1]) / Math.max(1e-6, Math.hypot(x - st.x, z - st.z));
    const Lm = S.mainLevel + 20 * Math.log10(Math.max(0.1, 0.5 * (1 + cm))) - 20 * Math.log10(dm);
    let p = 10 ** (Lm / 10); const towers = [];
    for (const t of d.towers) {
      const ax = t.x - st.x, az = t.z - st.z, al = Math.hypot(ax, az) || 1, dt = Math.hypot(x - t.x, eh - S.towerHeight, z - t.z);
      const ct = ((x - t.x) * ax + (z - t.z) * az) / al / Math.max(1e-6, Math.hypot(x - t.x, z - t.z));
      const Lt = S.towerLevel + 20 * Math.log10(Math.max(0.1, 0.5 * (1 + ct))) - 20 * Math.log10(dt);
      p += 10 ** (Lt / 10);
      const delta = (Math.hypot(t.x - st.x, S.towerHeight - st.y, t.z - st.z) / S.c + S.haas + dt / S.c) - dm / S.c; // tower arrival minus main arrival, s
      towers.push({ Lt, delta });
    }
    return { L: 10 * Math.log10(p), Lm, towers };
  }
  blocked(d, x, z) { // does a tower or the soundboard tent stand between this listener and the stage centre?
    const S = this.spec, sx = S.stage.x, sz = S.stage.z;
    const hit = (cx, cz, r) => { const vx = sx - x, vz = sz - z, L2 = vx * vx + vz * vz, u = ((cx - x) * vx + (cz - z) * vz) / L2; if (u <= 0.02 || u >= 0.98) return false; return Math.hypot(x + u * vx - cx, z + u * vz - cz) < r; };
    return d.towers.some(t => hit(t.x, t.z, S.towerR)) || hit(d.foh.x, d.foh.z, S.fohR);
  }
  evaluate(dIn) {
    const S = this.spec, d = this.clampDesign(dIn), Ls = [], per = {};
    let inBand = 0, block = 0, echo = 0, sum = 0, sum2 = 0;
    for (const p of this.points) {
      const r = this.levelAt(d, p.x, p.z); Ls.push(r.L); sum += p.w * r.L; sum2 += p.w * r.L * r.L;
      if (r.L >= S.band[0] && r.L <= S.band[1]) inBand += p.w;
      if (this.blocked(d, p.x, p.z)) block += p.w;
      if (r.towers.some(t => t.Lt > r.Lm - 6 && (t.delta < -0.002 || t.delta > 0.035))) echo += p.w;
      const q = per[p.sec] || (per[p.sec] = { n: 0, sum: 0 }); q.n++; q.sum += r.L;
    }
    const mean = sum / this.W, std = Math.sqrt(Math.max(0, sum2 / this.W - mean * mean));
    const med = [...Ls].sort((a, b) => a - b)[Math.floor(Ls.length / 2)], Lf = this.levelAt(d, d.foh.x, d.foh.z).L;
    let crowd = 0; for (let i = 0; i < d.towers.length; i++) for (let j = i + 1; j < d.towers.length; j++) if (Math.hypot(d.towers[i].x - d.towers[j].x, d.towers[i].z - d.towers[j].z) < S.minSpacing) crowd++;
    const C = inBand / this.W, U = Math.exp(-std / 4), Sl = 1 - block / this.W, E = 1 - echo / this.W, M = Math.exp(-Math.abs(Lf - med) / 3);
    const score = 100 * (0.35 * C + 0.2 * U + 0.2 * Sl + 0.15 * E + 0.1 * M) - S.towerCost * d.towers.length - 5 * crowd;
    const sections = Object.fromEntries(Object.entries(per).map(([k, v]) => [k, r1(v.sum / v.n)]));
    return { score, design: d, components: { coverage: C, uniformity: U, sightlines: Sl, echoFree: E, mixAccuracy: M }, stats: { meanDb: r1(mean), stdDb: r1(std), fohDb: r1(Lf), medianDb: r1(med), sections, towers: d.towers.length } };
  }
  levelGrid(d, nx = 48, nz = 40, box = { x0: -24, x1: 24, z0: -10, z1: 28 }) { // for the coverage heat map
    const g = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) g[j * nx + i] = this.levelAt(d, box.x0 + (i + 0.5) / nx * (box.x1 - box.x0), box.z0 + (j + 0.5) / nz * (box.z1 - box.z0)).L;
    return { nx, nz, box, g };
  }
}
const clone = o => JSON.parse(JSON.stringify(o));

// Plain-language description of what changed between two designs (house left/right from the audience's view).
export function describeChange(a, b) {
  if (b.towers.length > a.towers.length) { const t = b.towers.find(t => !a.towers.some(u => u.x === t.x && u.z === t.z)) || b.towers[b.towers.length - 1]; return `added a delay tower ${side(t.x)}, ${r1(t.z + 14)} m from the stage`; }
  if (b.towers.length < a.towers.length) return `removed a delay tower (now ${b.towers.length})`;
  let best = { d: Math.hypot(b.foh.x - a.foh.x, b.foh.z - a.foh.z), what: 'the soundboard', from: a.foh, to: b.foh };
  b.towers.forEach((t, i) => { const d = Math.hypot(t.x - a.towers[i].x, t.z - a.towers[i].z); if (d > best.d) best = { d, what: `delay tower #${i + 1}`, from: a.towers[i], to: t }; });
  const dz = best.to.z - best.from.z, dx = best.to.x - best.from.x;
  const dir = Math.abs(dz) > Math.abs(dx) ? (dz < 0 ? 'toward the stage' : 'back') : (dx > 0 ? 'to house right' : 'to house left');
  return `moved ${best.what} by ${r1(best.d)} m ${dir}`;
}
const side = x => Math.abs(x) < 2 ? 'at centre' : x > 0 ? `${r1(x)} m house right` : `${r1(-x)} m house left`;

export class Evolver {
  constructor(problem, { seed = 2027, lambda = 8, sigma0 = 6, pStruct = 0.15 } = {}) {
    Object.assign(this, { problem, seed, lambda, sigma0, pStruct });
    this.reset();
  }
  reset() {
    this.rnd = mulberry32(this.seed); this.gen = 0; this.sigma = this.sigma0; this.window = []; this.restarts = 0;
    this.best = this.problem.evaluate(this.problem.initial()); this.start = this.best.score;
    this.history = [{ gen: 0, score: this.best.score, sigma: this.sigma, k: this.best.design.towers.length, change: 'first draft' }];
  }
  mutate(d) {
    const S = this.problem.spec, rnd = this.rnd, c = clone(d), T = S.towerZone;
    if (rnd() < this.pStruct) {
      if (c.towers.length < S.kMax && (rnd() < 0.55 || c.towers.length < 2)) c.towers.push({ x: T.x0 + rnd() * (T.x1 - T.x0), z: T.z0 + rnd() * (T.z1 - T.z0) });
      else if (c.towers.length > 1) c.towers.splice(Math.floor(rnd() * c.towers.length), 1);
      return this.problem.clampDesign(c);
    }
    for (const t of c.towers) { t.x += gauss(rnd) * this.sigma; t.z += gauss(rnd) * this.sigma; }
    c.foh.x += gauss(rnd) * this.sigma * 0.5; c.foh.z += gauss(rnd) * this.sigma * 0.5;
    return this.problem.clampDesign(c);
  }
  step() {
    this.gen++; let bestChild = null;
    for (let i = 0; i < this.lambda; i++) { const e = this.problem.evaluate(this.mutate(this.best.design)); if (!bestChild || e.score > bestChild.score) bestChild = e; }
    const improved = bestChild.score > this.best.score + 1e-9;
    this.window.push(improved ? 1 : 0); if (this.window.length > 10) this.window.shift();
    if (this.window.length >= 5) { const rate = this.window.reduce((a, b) => a + b, 0) / this.window.length; this.sigma = clamp(this.sigma * (rate > 0.2 ? 1.15 : 0.87), 0.25, 12); } // 1/5 success rule
    let change = null, delta = 0;
    if (improved) { change = describeChange(this.best.design, bestChild.design); delta = bestChild.score - this.best.score; this.best = bestChild; }
    const h = { gen: this.gen, score: this.best.score, sigma: this.sigma, k: this.best.design.towers.length, improved, delta, change };
    this.history.push(h); if (this.history.length > 2000) this.history.splice(1, 1);
    // Stagnation restart: after 60 generations without a gain at the minimum step, widen the step again to explore.
    // Elitism keeps the best layout, so a restart can never make the design worse.
    if (this.stalled >= 60 && this.sigma <= 0.3) { this.sigma = this.sigma0; this.window = []; this.restarts++; h.restart = this.restarts; }
    return h;
  }
  run(n) { let last; for (let i = 0; i < n; i++) last = this.step(); return last; }
  get stalled() { let n = 0; for (let i = this.history.length - 1; i > 0 && !this.history[i].improved && !this.history[i].restart; i--) n++; return n; }
}
