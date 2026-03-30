/* ── Site management ─────────────────────────────────── */
const SITES = { C01158: '96 Shell', C01288: 'Riverside Shell', C09066: '72 Shell' };

function getActiveSite() { return localStorage.getItem('activeSiteId') || 'C01158'; }
function setActiveSite(siteId) { localStorage.setItem('activeSiteId', siteId); }

function syncDropdownLabel(siteId) {
  const lbl = document.getElementById('site-dropdown-label');
  if (lbl) lbl.textContent = SITES[siteId];
}

function initSiteSwitcher() {
  const active = getActiveSite();

  // Pill switcher (tablet+)
  document.querySelectorAll('.site-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.site === active);
    btn.addEventListener('click', () => {
      setActiveSite(btn.dataset.site);
      document.getElementById('site-overlay').classList.add('active');
      setTimeout(() => { window.location = 'index.html'; }, 120);
    });
  });

  // Mobile dropdown
  const dropBtn  = document.getElementById('site-dropdown-btn');
  const dropList = document.getElementById('site-dropdown-list');
  if (dropBtn && dropList) {
    syncDropdownLabel(active);
    dropBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = dropList.classList.toggle('open');
      dropBtn.classList.toggle('open', open);
    });
    document.addEventListener('click', () => {
      dropList.classList.remove('open');
      dropBtn.classList.remove('open');
    });
    document.querySelectorAll('.site-dropdown-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.site === active);
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        setActiveSite(item.dataset.site);
        document.getElementById('site-overlay').classList.add('active');
        setTimeout(() => { window.location = 'index.html'; }, 120);
      });
    });
  }
}

/* ── Custom tab switching ────────────────────────────── */
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane-custom').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

/* ── Helpers ─────────────────────────────────────────── */
async function api(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json' },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function todayStr() { return new Date().toISOString().split('T')[0]; }
function currentPeriod() {
  const n = new Date();
  return { year: n.getFullYear(), month: n.getMonth() + 1, week: Math.min(Math.ceil(n.getDate() / 7), 4) };
}
function weekStatus(weekNum, hasEntry, viewYear, viewMonth) {
  const now = new Date();
  const cy = now.getFullYear(), cm = now.getMonth() + 1;
  const cw = Math.min(Math.ceil(now.getDate() / 7), 4);
  if (hasEntry) return 'done';
  if (viewYear < cy || (viewYear === cy && viewMonth < cm)) return 'missed';
  if (viewYear === cy && viewMonth === cm && weekNum < cw) return 'missed';
  return 'pending';
}

/* ── State ───────────────────────────────────────────── */
const params    = new URLSearchParams(window.location.search);
const sectionId = params.get('id');
let viewYear, viewMonth;
let cleaningData = [], planoData = [];

/* ── Init ────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  if (!sectionId) return window.location = 'index.html';

  initSiteSwitcher();
  initTabs();

  const p = currentPeriod();
  viewYear  = p.year;
  viewMonth = p.month;

  try {
    const sec = await api(`/api/sections/${sectionId}`);
    document.getElementById('sec-icon').textContent     = sec.icon || '📦';
    document.getElementById('sec-title').textContent    = sec.name;
    document.getElementById('sec-location').textContent = sec.location || '';
    document.title = `${sec.name} — Store Manager`;
  } catch { return window.location = 'index.html'; }

  buildMonthSelectors();
  loadCleaning();
  loadPlanogram();
  loadExpiry();
  loadOrders();
  wireFormHandlers();
});

/* ── Month selectors ─────────────────────────────────── */
function buildMonthSelectors() {
  ['clean-month', 'plano-month'].forEach((id) => {
    const sel = document.getElementById(id);
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const opt = document.createElement('option');
      opt.value = `${d.getFullYear()}-${d.getMonth() + 1}`;
      opt.textContent = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      sel.appendChild(opt);
    }
    sel.addEventListener('change', () => {
      const [y, m] = sel.value.split('-').map(Number);
      viewYear = y; viewMonth = m;
      id === 'clean-month' ? loadCleaning() : loadPlanogram();
    });
  });
}

/* ── CLEANING ────────────────────────────────────────── */
async function loadCleaning() {
  const wrap = document.getElementById('cleaning-weeks');
  wrap.innerHTML = '<div class="empty-state">Loading…</div>';
  try {
    cleaningData = await api(`/api/cleaning-logs?sectionId=${sectionId}&year=${viewYear}&month=${viewMonth}`);
    renderWeekCards(wrap, cleaningData, 'cleaning');
    updateWeekDropdown('f-clean-week', cleaningData);
  } catch (e) { wrap.innerHTML = `<div class="empty-state text-danger">${e.message}</div>`; }
}

/* ── PLANOGRAM ───────────────────────────────────────── */
async function loadPlanogram() {
  const wrap = document.getElementById('plano-weeks');
  wrap.innerHTML = '<div class="empty-state">Loading…</div>';
  try {
    planoData = await api(`/api/planogram-checks?sectionId=${sectionId}&year=${viewYear}&month=${viewMonth}`);
    renderWeekCards(wrap, planoData, 'planogram');
    updateWeekDropdown('f-plano-week', planoData);
  } catch (e) { wrap.innerHTML = `<div class="empty-state text-danger">${e.message}</div>`; }
}

/* ── Week cards renderer ─────────────────────────────── */
function renderWeekCards(container, data, type) {
  const entryMap = {};
  data.forEach((d) => entryMap[d.week] = d);
  container.innerHTML = '';

  for (let w = 1; w <= 4; w++) {
    const entry  = entryMap[w];
    const status = weekStatus(w, !!entry, viewYear, viewMonth);

    const numClass    = { done: 'wn-done', missed: 'wn-missed', pending: 'wn-pending' }[status];
    const statusClass = { done: 'ws-done', missed: 'ws-missed', pending: 'ws-pending' }[status];
    const statusLabel = { done: type === 'cleaning' ? 'Cleaned' : 'Checked', missed: 'Missed', pending: 'Pending' }[status];

    let bodyHtml = '';
    if (entry && type === 'cleaning') {
      bodyHtml = `
        <div class="week-row"><span class="wr-key">Date</span><span class="wr-val">${fmtDate(entry.dateCleaned)}</span></div>
        <div class="week-row"><span class="wr-key">Cleaned by</span><span class="wr-val">${entry.cleanedBy || '—'}</span></div>
        <div class="week-row"><span class="wr-key">Comments</span><span class="wr-val">${entry.comments || '—'}</span></div>`;
    } else if (entry && type === 'planogram') {
      bodyHtml = `
        <div class="week-row"><span class="wr-key">Date</span><span class="wr-val">${fmtDate(entry.dateChecked)}</span></div>
        <div class="week-row"><span class="wr-key">Checked by</span><span class="wr-val">${entry.checkedBy || '—'}</span></div>
        <div class="week-row"><span class="wr-key">Comments</span><span class="wr-val">${entry.comments || '—'}</span></div>
        <div class="week-row"><span class="wr-key">Plano fixed</span><span class="wr-val">${entry.planogramFixed ? '✓ Yes' : '✗ No'}</span></div>`;
    } else {
      bodyHtml = '<span class="week-empty">No entry yet.</span>';
    }

    const delBtn = entry
      ? `<button class="week-del" title="Delete" onclick="deleteWeekEntry('${type}','${entry._id}')"><i class="bi bi-trash3" style="font-size:.75rem"></i></button>`
      : '';

    const card = document.createElement('div');
    card.className = 'week-card';
    card.innerHTML = `
      <div class="week-card-head">
        <span class="week-num ${numClass}">${w}</span>
        <span class="week-label">Week ${w}</span>
        <span class="week-status ${statusClass}">${statusLabel}</span>
        ${delBtn}
      </div>
      <div class="week-body">${bodyHtml}</div>`;
    container.appendChild(card);
  }
}

function updateWeekDropdown(selectId, data) {
  const sel = document.getElementById(selectId);
  const filled = data.map((d) => d.week);
  sel.innerHTML = '';
  const cp = currentPeriod();
  [1,2,3,4].forEach((w) => {
    if (!filled.includes(w)) {
      const opt = document.createElement('option');
      opt.value = w;
      opt.textContent = `Week ${w}`;
      if (w === cp.week) opt.selected = true;
      sel.appendChild(opt);
    }
  });
  if (sel.options.length === 0) sel.innerHTML = '<option disabled>All weeks logged</option>';
}

async function deleteWeekEntry(type, id) {
  if (!confirm('Delete this entry?')) return;
  const col = type === 'cleaning' ? 'cleaning-logs' : 'planogram-checks';
  await api(`/api/${col}/${id}`, { method: 'DELETE' });
  type === 'cleaning' ? loadCleaning() : loadPlanogram();
}

/* ── EXPIRY ──────────────────────────────────────────── */
async function loadExpiry() {
  const wrap   = document.getElementById('expiry-table-wrap');
  const filter = document.getElementById('expiry-filter').value;
  wrap.innerHTML = '<div class="empty-state">Loading…</div>';
  try {
    const data = await api(`/api/expiry-logs?sectionId=${sectionId}&filter=${filter}`);
    if (data.length === 0) {
      wrap.innerHTML = '<div class="empty-state">No expiry items found.</div>';
      return;
    }
    let rows = '';
    data.forEach((item) => {
      const removedBadge = item.removed
        ? '<span class="tag tag-green"><i class="bi bi-check-circle me-1"></i>Removed</span>'
        : `<button class="btn-solid" style="font-size:.7rem;padding:2px 9px" onclick="markExpRemoved('${item._id}')">Mark Removed</button>`;
      rows += `
        <tr>
          <td>${fmtDate(item.date)}</td>
          <td>${item.item}</td>
          <td class="${item.removed ? '' : 'text-danger fw-semibold'}">${fmtDate(item.expiryDate)}</td>
          <td>${removedBadge}</td>
          <td>${item.signOffBy || '—'}</td>
          <td><button class="del-row" onclick="deleteExpiry('${item._id}')"><i class="bi bi-trash3" style="font-size:.8rem"></i></button></td>
        </tr>`;
    });
    wrap.innerHTML = `
      <div class="table-card">
        <table class="table table-hover mb-0">
          <thead><tr><th>Date Found</th><th>Item</th><th>Expiry</th><th>Status</th><th>Sign Off</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch (e) { wrap.innerHTML = `<div class="empty-state text-danger">${e.message}</div>`; }
}

async function markExpRemoved(id) {
  await api(`/api/expiry-logs/${id}`, { method: 'PUT', body: { removed: true, signOffBy: 'Staff' } });
  loadExpiry();
}
async function deleteExpiry(id) {
  if (!confirm('Delete this expiry entry?')) return;
  await api(`/api/expiry-logs/${id}`, { method: 'DELETE' });
  loadExpiry();
}
document.getElementById('expiry-filter').addEventListener('change', loadExpiry);

/* ── ORDERS ──────────────────────────────────────────── */
async function loadOrders() {
  const wrap   = document.getElementById('order-table-wrap');
  const filter = document.getElementById('order-filter').value;
  wrap.innerHTML = '<div class="empty-state">Loading…</div>';
  try {
    const data = await api(`/api/order-items?sectionId=${sectionId}&filter=${filter}`);
    if (data.length === 0) {
      wrap.innerHTML = '<div class="empty-state">No order items found.</div>';
      return;
    }
    let rows = '';
    data.forEach((item) => {
      const statusBadge = item.ordered
        ? '<span class="tag tag-green">Ordered</span>'
        : `<button class="btn-solid btn-solid-amber" style="font-size:.7rem;padding:2px 9px" onclick="markOrdered('${item._id}')">Mark Ordered</button>`;
      rows += `
        <tr>
          <td>${fmtDate(item.date)}</td>
          <td>${item.item}</td>
          <td style="color:var(--muted);font-size:.82rem">${item.comments || '—'}</td>
          <td>${statusBadge}</td>
          <td><button class="del-row" onclick="deleteOrder('${item._id}')"><i class="bi bi-trash3" style="font-size:.8rem"></i></button></td>
        </tr>`;
    });
    wrap.innerHTML = `
      <div class="table-card">
        <table class="table table-hover mb-0">
          <thead><tr><th>Date</th><th>Item</th><th>Comments</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch (e) { wrap.innerHTML = `<div class="empty-state text-danger">${e.message}</div>`; }
}

async function markOrdered(id) {
  await api(`/api/order-items/${id}`, { method: 'PUT', body: { ordered: true } });
  loadOrders();
}
async function deleteOrder(id) {
  if (!confirm('Delete this order entry?')) return;
  await api(`/api/order-items/${id}`, { method: 'DELETE' });
  loadOrders();
}
document.getElementById('order-filter').addEventListener('change', loadOrders);

/* ── Form handlers ───────────────────────────────────── */
function wireFormHandlers() {
  document.querySelectorAll('input[type="date"]').forEach((el) => { if (!el.value) el.value = todayStr(); });

  // Save Cleaning
  document.getElementById('f-clean-save').addEventListener('click', async () => {
    const week = +document.getElementById('f-clean-week').value;
    const date = document.getElementById('f-clean-date').value;
    const by   = document.getElementById('f-clean-by').value.trim();
    const comments = document.getElementById('f-clean-comments').value.trim();
    if (!week || !date) return alert('Week and date are required.');
    try {
      await api('/api/cleaning-logs', { method: 'POST', body: { sectionId, year: viewYear, month: viewMonth, week, dateCleaned: date, cleanedBy: by, comments } });
      bootstrap.Modal.getInstance(document.getElementById('modal-cleaning')).hide();
      document.getElementById('f-clean-by').value = '';
      document.getElementById('f-clean-comments').value = '';
      loadCleaning();
    } catch (e) { alert(e.message); }
  });

  // Save Planogram
  document.getElementById('f-plano-save').addEventListener('click', async () => {
    const week = +document.getElementById('f-plano-week').value;
    const date = document.getElementById('f-plano-date').value;
    const by   = document.getElementById('f-plano-by').value.trim();
    const comments = document.getElementById('f-plano-comments').value.trim();
    const fixed    = document.getElementById('f-plano-fixed').checked;
    if (!week || !date) return alert('Week and date are required.');
    try {
      await api('/api/planogram-checks', { method: 'POST', body: { sectionId, year: viewYear, month: viewMonth, week, dateChecked: date, checkedBy: by, comments, planogramFixed: fixed } });
      bootstrap.Modal.getInstance(document.getElementById('modal-planogram')).hide();
      document.getElementById('f-plano-by').value = '';
      document.getElementById('f-plano-comments').value = '';
      document.getElementById('f-plano-fixed').checked = false;
      loadPlanogram();
    } catch (e) { alert(e.message); }
  });

  // Save Expiry
  document.getElementById('f-exp-save').addEventListener('click', async () => {
    const date    = document.getElementById('f-exp-date').value;
    const item    = document.getElementById('f-exp-item').value.trim();
    const expiry  = document.getElementById('f-exp-expiry').value;
    const sign    = document.getElementById('f-exp-sign').value.trim();
    const removed = document.getElementById('f-exp-removed').checked;
    if (!item) return alert('Item name is required.');
    try {
      await api('/api/expiry-logs', { method: 'POST', body: { sectionId, date, item, expiryDate: expiry, signOffBy: sign, removed } });
      bootstrap.Modal.getInstance(document.getElementById('modal-expiry')).hide();
      document.getElementById('f-exp-item').value = '';
      document.getElementById('f-exp-sign').value = '';
      document.getElementById('f-exp-removed').checked = false;
      loadExpiry();
    } catch (e) { alert(e.message); }
  });

  // Save Order
  document.getElementById('f-ord-save').addEventListener('click', async () => {
    const date     = document.getElementById('f-ord-date').value;
    const item     = document.getElementById('f-ord-item').value.trim();
    const comments = document.getElementById('f-ord-comments').value.trim();
    if (!item) return alert('Item name is required.');
    try {
      await api('/api/order-items', { method: 'POST', body: { sectionId, date, item, comments } });
      bootstrap.Modal.getInstance(document.getElementById('modal-order')).hide();
      document.getElementById('f-ord-item').value = '';
      document.getElementById('f-ord-comments').value = '';
      loadOrders();
    } catch (e) { alert(e.message); }
  });
}