// Agent World · Claude Edition (v2.0, Keystone build) — ui.js
// HUD: activity feed, toasts, XP and badges, panels, sheets, confetti.
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const $ = s => document.querySelector(s);
const LS = 'aw-cc.v1';
export const BADGES = [
  { id: 'council', e: '🏛️', n: 'Council Convened' }, { id: 'inbox', e: '📬', n: 'Inbox Zero' },
  { id: 'networker', e: '🤝', n: 'Networker' }, { id: 'follower', e: '🎥', n: 'Shadow' },
  { id: 'reader', e: '📜', n: 'Rule Reader' }, { id: 'frontrow', e: '🎶', n: 'Front Row' },
  { id: 'architect', e: '📐', n: 'Architect' }, { id: 'summit', e: '🌴', n: 'Beach Summit' },
];

export class UI {
  constructor() {
    this.simOn = true;
    this.st = { xp: 0, badges: [], collabs: 0 };
    try { Object.assign(this.st, JSON.parse(localStorage.getItem(LS) || '{}')); } catch { /* fresh state */ }
    this.renderXP();
    this.conf = []; this.cv = $('#confetti'); this.cx = this.cv.getContext('2d');
    const size = () => { this.cv.width = innerWidth * devicePixelRatio; this.cv.height = innerHeight * devicePixelRatio; };
    size(); addEventListener('resize', size); // CSS keeps the canvas at 100vw × 100vh (fix F5)
    $('#feed').addEventListener('click', e => { const a = e.target.closest('[data-rule]'); if (a) { e.preventDefault(); this.onRule?.(a.dataset.rule); } });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { this.hidePanel(); this.closeSheet(); } });
  }
  save() { try { localStorage.setItem(LS, JSON.stringify(this.st)); } catch { /* storage blocked */ } }

  feed(html, tag = 'sim') {
    const li = document.createElement('li');
    const t = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    li.innerHTML = `<span class="ts">${t}</span>${tag === 'live' ? '<span class="tag live">live</span>' : ''}${html}`;
    const ul = $('#feed'); ul.prepend(li); while (ul.children.length > 7) ul.lastChild.remove();
  }
  toast(icon, title, sub = '') {
    const d = document.createElement('div'); d.className = 'toast glass';
    d.innerHTML = `<span class="ti">${icon}</span><div><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
    $('#toasts').append(d); setTimeout(() => d.classList.add('out'), 3600); setTimeout(() => d.remove(), 4200);
  }
  setFps(fps, q) { $('#fps').textContent = `· ${fps} fps`; this.setQuality(q); }
  setQuality(q) { const b = $('#b-q'); if (b) b.textContent = 'Graphics: ' + q[0].toUpperCase() + q.slice(1); }

  lvl(xp) { let l = 1, need = 100, rest = xp; while (rest >= need) { rest -= need; l++; need = 100 + (l - 1) * 50; } return { l, rest, need }; }
  renderXP() {
    const { l, rest, need } = this.lvl(this.st.xp);
    $('#lvl').textContent = l; $('#xpfill').style.width = (rest / need * 100) + '%';
    $('#xptext').textContent = `${rest} / ${need} XP · ${this.st.collabs} collabs watched`;
    $('#badges').innerHTML = BADGES.map(b => `<span class="badge${this.st.badges.includes(b.id) ? '' : ' locked'}" title="${b.n}${this.st.badges.includes(b.id) ? '' : ' (locked)'}">${b.e} ${b.n}</span>`).join('');
  }
  addXP(n) { const before = this.lvl(this.st.xp).l; this.st.xp += n; const after = this.lvl(this.st.xp).l; if (after > before) { this.toast('⭐', `Level ${after}`, 'Keep watching the collabs.'); this.confetti(); } this.save(); this.renderXP(); }
  collab(xp, label) { this.st.collabs++; this.addXP(xp); }
  badge(id) {
    if (this.st.badges.includes(id)) return; const b = BADGES.find(x => x.id === id); if (!b) return;
    this.st.badges.push(id); this.save(); this.renderXP(); this.toast(b.e, 'Badge unlocked: ' + b.n); this.confetti(); this.addXP(20);
  }

  showPanel(html) { const p = $('#panel'); p.innerHTML = `<button type="button" class="x" id="p-close" aria-label="Close">×</button>` + html; p.hidden = false; $('#p-close').onclick = () => this.hidePanel(); return p; }
  hidePanel() { const p = $('#panel'); if (!p.hidden) { p.hidden = true; this.onPanelClose?.(); } }
  openSheet(html) { const s = $('#sheet'); s.innerHTML = `<button type="button" class="x" id="s-close" aria-label="Close">×</button><div class="sheet-body">` + html + `</div>`; s.hidden = false; $('#s-close').onclick = () => this.closeSheet(); return s; }
  closeSheet() { $('#sheet').hidden = true; }

  audioState(a) {
    $('#a-on').textContent = a.on ? '🔇 Turn off band sound' : '🔊 Turn on band sound';
    $('#a-on').setAttribute('aria-pressed', a.on);
    if (!a.on) $('#a-now').textContent = 'Sound is off. Fly to a stage and turn it on.';
  }

  confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cols = ['#ffcf5a', '#ff7fa8', '#7ef0e4', '#c084fc', '#a3e635', '#fff'], was = this.conf.length, rnd = (a, b) => a + Math.random() * (b - a);
    for (let i = 0; i < 160; i++) this.conf.push({ x: innerWidth / 2 + rnd(-60, 60), y: innerHeight * 0.4, vx: rnd(-7, 7), vy: rnd(-15, -5), r: 0, vr: rnd(-0.3, 0.3), c: cols[i % 6], w: rnd(6, 11), h: rnd(4, 7), life: rnd(2.2, 3.4) });
    if (!was) { this.lastT = 0; requestAnimationFrame(t => this.drawConf(t)); }
  }
  drawConf(t) {
    const cx = this.cx, dt = Math.min(0.05, (t - (this.lastT || t)) / 1000); this.lastT = t;
    cx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); cx.clearRect(0, 0, innerWidth, innerHeight);
    this.conf = this.conf.filter(p => (p.life -= dt) > 0);
    for (const p of this.conf) { p.vy += 30 * dt; p.x += p.vx * dt * 30; p.y += p.vy * dt * 30; p.r += p.vr; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = p.c; cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.restore(); }
    if (this.conf.length) requestAnimationFrame(x => this.drawConf(x)); else cx.clearRect(0, 0, innerWidth, innerHeight);
  }
}
