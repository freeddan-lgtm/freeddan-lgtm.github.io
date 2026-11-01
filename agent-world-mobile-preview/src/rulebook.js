// Agent World · Conscious Claude Edition — rulebook.js
// The interactive Rule Book. Every agent and character can read it: humans in the overlay,
// in-world agents through sim.rules, and outside software through data/rules.json or window.AgentWorld.rules.
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const LS = 'aw-cc.acks.v1';
const load = () => { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; } };
const save = v => { try { localStorage.setItem(LS, JSON.stringify(v)); } catch { /* storage blocked: acks last for this visit */ } };

export class RuleBook {
  constructor(ui) { this.ui = ui; this.ready = false; this.acks = load(); this.filter = { q: '', ch: 'all', aud: 'all' }; }

  async load(url = 'data/rules.json') {
    const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw new Error('rules.json ' + r.status);
    this.data = await r.json(); this.byId = new Map(this.data.rules.map(x => [x.id, x])); this.ready = true;
    const api = { version: this.data.version, all: () => this.data.rules.slice(), get: id => this.get(id), search: q => this.search(q), forAgent: k => this.forAgent(k), open: id => this.open(id) };
    window.AgentWorld = Object.assign(window.AgentWorld || {}, { rules: api });
    return this;
  }
  get(id) { return this.byId?.get(String(id).toUpperCase()); }
  search(q) { q = String(q || '').toLowerCase().trim(); if (!q) return this.data.rules.slice(); return this.data.rules.filter(r => (r.id + ' ' + r.title + ' ' + r.text + ' ' + r.cite).toLowerCase().includes(q)); }
  audienceOf(def) { const g = typeof def === 'string' ? def : def?.group; return g === 'character' ? 'characters' : g === 'council' ? 'council' : 'agents'; }
  forAgent(def) { const a = this.audienceOf(def); return this.data.rules.filter(r => r.applies.includes(a)); }
  randomFor(def) { const l = this.forAgent(def); return l[Math.floor(Math.random() * l.length)]; }

  bind(el, people) { this.el = el; this.people = people; }

  open(focusId) {
    if (!this.ready || !this.el) return;
    this.el.hidden = false; document.body.classList.add('rb-open');
    this.ui?.badge?.('reader');
    this.render(focusId);
    const q = this.el.querySelector('#rb-q'); if (!focusId) setTimeout(() => q?.focus(), 50);
  }
  close() { if (this.el) { this.el.hidden = true; document.body.classList.remove('rb-open'); } }

  render(focusId) {
    const d = this.data, f = this.filter;
    const list = this.search(f.q).filter(r => (f.ch === 'all' || r.chapter === f.ch) && (f.aud === 'all' || r.applies.includes(f.aud)));
    const chips = (name, items, cur) => items.map(([v, l]) => `<button type="button" class="chip${cur === v ? ' on' : ''}" data-${name}="${v}" aria-pressed="${cur === v}">${esc(l)}</button>`).join('');
    const ppl = this.people || [];
    this.el.innerHTML = `
      <div class="rb-card" role="dialog" aria-modal="true" aria-labelledby="rb-title">
        <header class="rb-head">
          <div><p class="eyebrow">Version ${esc(d.version)} · kept by ${esc(d.keeper)}</p><h2 id="rb-title">📜 ${esc(d.title)}</h2></div>
          <button type="button" class="x" id="rb-close" aria-label="Close the Rule Book">×</button>
        </header>
        <div class="rb-tools">
          <label class="sr" for="rb-q">Search rules</label>
          <input id="rb-q" class="sin" type="search" placeholder="Search: privacy, council, audio, S1…" value="${esc(f.q)}" autocomplete="off">
          <div class="chips" role="group" aria-label="Chapter">${chips('ch', [['all', 'All chapters'], ...d.chapters.map(c => [c.id, c.title])], f.ch)}</div>
          <div class="chips" role="group" aria-label="Who it applies to">${chips('aud', [['all', 'Everyone'], ...Object.keys(d.audiences).map(k => [k, k[0].toUpperCase() + k.slice(1)])], f.aud)}</div>
        </div>
        <div class="rb-body">
          ${d.chapters.map(c => { const rs = list.filter(r => r.chapter === c.id); if (!rs.length) return ''; return `<section class="rb-ch"><h3>${esc(c.id)} · ${esc(c.title)}</h3><p class="mute">${esc(c.blurb)}</p>${rs.map(r => this.ruleHtml(r, ppl)).join('')}</section>`; }).join('') || '<p class="mute">No rules match. Try another word or clear the filters.</p>'}
        </div>
        <footer class="rb-foot">For agents: this Rule Book is JSON at <code>data/rules.json</code> and <code>AgentWorld.rules</code> in the page. ${esc(d.how_to_cite)}</footer>
      </div>`;
    const el = this.el;
    el.querySelector('#rb-close').onclick = () => this.close();
    el.onclick = e => { if (e.target === el) this.close(); };
    el.onkeydown = e => { if (e.key === 'Escape') this.close(); };
    const q = el.querySelector('#rb-q');
    q.oninput = () => { f.q = q.value; const pos = q.selectionStart; this.render(); const n = this.el.querySelector('#rb-q'); n.focus(); n.setSelectionRange(pos, pos); };
    el.querySelectorAll('[data-ch]').forEach(b => b.onclick = () => { f.ch = b.dataset.ch; this.render(); });
    el.querySelectorAll('[data-aud]').forEach(b => b.onclick = () => { f.aud = b.dataset.aud; this.render(); });
    el.querySelectorAll('[data-ask]').forEach(b => b.onclick = () => { const r = this.get(b.dataset.ask); this.close(); this.onAsk?.(r); });
    el.querySelectorAll('[data-copy]').forEach(b => b.onclick = async () => {
      const r = this.get(b.dataset.copy), txt = `${r.id} (${r.title}): ${r.text}`;
      try { await navigator.clipboard.writeText(txt); b.textContent = 'Copied'; } catch { const p = b.closest('.rule').querySelector('.rtext'); const s = getSelection(); const rg = document.createRange(); rg.selectNodeContents(p); s.removeAllRanges(); s.addRange(rg); b.textContent = 'Selected, press Ctrl/⌘+C'; }
    });
    el.querySelectorAll('form[data-ack]').forEach(fm => fm.onsubmit = e => {
      e.preventDefault(); const id = fm.dataset.ack, who = fm.querySelector('select').value; if (!who) return;
      const l = this.acks[id] || (this.acks[id] = []); if (!l.includes(who)) l.push(who); save(this.acks);
      this.ui?.toast?.('✍️', `${who} acknowledged ${id}`, 'Saved in this browser only.'); this.render(id);
    });
    if (focusId) { const t = el.querySelector(`#rule-${CSS.escape(focusId)}`); if (t) { t.classList.add('flash'); t.scrollIntoView({ block: 'center' }); } }
  }

  ruleHtml(r, ppl) {
    const acks = this.acks[r.id] || [];
    return `<article class="rule" id="rule-${esc(r.id)}">
      <div class="rhead"><span class="rid">${esc(r.id)}</span><h4>${esc(r.title)}</h4></div>
      <p class="rtext">${esc(r.text)}</p>
      <p class="rcite">“${esc(r.cite)}”</p>
      <div class="rmeta">${r.applies.map(a => `<span class="tag">${esc(a)}</span>`).join('')}</div>
      <div class="ractions">
        <button type="button" class="btn sm" data-ask="${esc(r.id)}">✴️ Ask Conscious Claude</button>
        <button type="button" class="btn sm ghost" data-copy="${esc(r.id)}">Copy</button>
        <form class="ack" data-ack="${esc(r.id)}"><label class="sr" for="ack-${esc(r.id)}">Acknowledge as</label>
          <select id="ack-${esc(r.id)}" class="sin sm"><option value="">Acknowledge as…</option>${ppl.map(p => `<option>${esc(p)}</option>`).join('')}</select>
          <button class="btn sm ghost" type="submit">Sign</button></form>
      </div>
      ${acks.length ? `<p class="acks">Acknowledged by ${acks.map(esc).join(', ')}</p>` : ''}
    </article>`;
  }
}
