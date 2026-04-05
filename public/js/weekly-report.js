/* ── Site helpers (nav.js owns the UI, these are for data fetching) ── */
const SITES = { C01158: '96 Shell', C01288: 'Riverside Shell', C09066: '72 Shell' };
function getActiveSite() { return localStorage.getItem('activeSiteId') || 'C01158'; }
function setActiveSite(id) { localStorage.setItem('activeSiteId', id); }



function initSiteSwitcher() {
  const active = getActiveSite();
  document.querySelectorAll('.site-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.site === active);
    btn.addEventListener('click', () => {
      setActiveSite(btn.dataset.site);
      document.querySelectorAll('.site-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      syncDropdownLabel(btn.dataset.site);
    });
  });
  const dropBtn  = document.getElementById('site-dropdown-btn');
  const dropList = document.getElementById('site-dropdown-list');
  if (dropBtn && dropList) {
    syncDropdownLabel(active);
    dropBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropList.classList.toggle('open');
      dropBtn.classList.toggle('open', dropList.classList.contains('open'));
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
      });
    });
  }
  document.getElementById('page-title').textContent = `Weekly Report — ${SITES[active]}`;
}

/* ── Helpers ─────────────────────────────────────────── */
async function api(url) {
  const res  = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}

function getMondayOf(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function fmtDate(str) {
  if (!str) return '—';
  // Handle both ISO strings (from MongoDB Date objects) and plain YYYY-MM-DD strings
  const d = new Date(str);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtRange(mon, sun) {
  const s = new Date(mon + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const e = new Date(sun + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${s} – ${e}`;
}

function weekOfMonth(mondayStr) {
  const monday = new Date(mondayStr + 'T12:00:00');
  const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6);
  if (sunday.getMonth() !== monday.getMonth()) {
    return Math.ceil(monday.getDate() / 7);
  }
  return Math.ceil(sunday.getDate() / 7);
}

function weekLabel(mondayStr) {
  const mon = new Date(mondayStr + 'T12:00:00');
  const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
  const wk = weekOfMonth(mondayStr);
  const mo = mon.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  if (mon.getMonth() !== sun.getMonth()) {
    const sunStr = sun.getFullYear() + '-' + String(sun.getMonth()+1).padStart(2,'0') + '-' + String(sun.getDate()).padStart(2,'0');
    const nextWk = weekOfMonth(sunStr);
    const nextMo = sun.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return `Week ${wk} of ${mo} / Week ${nextWk} of ${nextMo}`;
  }
  return `Week ${wk} of ${mo}`;
}

/* ── State ───────────────────────────────────────────── */
let currentWeekStart = getMondayOf(new Date());

/* ── Init ────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initWeekNav();
  loadReport();
});

/* ── Week nav ────────────────────────────────────────── */
function initWeekNav() {
  document.getElementById('btn-prev').addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    loadReport();
  });
  document.getElementById('btn-next').addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    loadReport();
  });
  document.getElementById('btn-today').addEventListener('click', () => {
    currentWeekStart = getMondayOf(new Date());
    loadReport();
  });
  document.getElementById('btn-print').addEventListener('click', printReport);
}

function updateWeekHeader() {
  const mon    = dateKey(currentWeekStart);
  const sunObj = new Date(currentWeekStart); sunObj.setDate(sunObj.getDate() + 6);
  const sun    = dateKey(sunObj);
  const siteId = getActiveSite();
  document.getElementById('week-info').textContent = weekLabel(mon);
  document.getElementById('week-sub').textContent  = `${SITES[siteId]} · ${fmtRange(mon, sun)}`;
}

/* ── Load report ─────────────────────────────────────── */
async function loadReport() {
  updateWeekHeader();
  const siteId = getActiveSite();
  const mon    = dateKey(currentWeekStart);
  const sunObj = new Date(currentWeekStart); sunObj.setDate(sunObj.getDate() + 6);
  const sun    = dateKey(sunObj);
  const wrap   = document.getElementById('report-wrap');

  wrap.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--muted);font-size:.87rem;">
    <div class="spinner-border spinner-border-sm me-2"></div>Generating report…</div>`;

  try {
    const data = await api(`/api/weekly-report?siteId=${siteId}&from=${mon}&to=${sun}`);
    renderReport(data, mon, sun);
  } catch (e) {
    wrap.innerHTML = `<div style="text-align:center;padding:3rem;color:#d1453b;">${e.message}</div>`;
  }
}

/* ── Render report ───────────────────────────────────── */
function renderReport(data, mon, sun) {
  const wrap = document.getElementById('report-wrap');
  let html = '';

  /* ── 1. CLEANING ── */
  const cleanTotal  = data.sections.length;
  const cleanDone   = data.cleaning.filter(c => c.cleaned).length;
  const cleanMissed = data.cleaning.filter(c => !c.cleaned);
  const cleanScore  = cleanTotal === 0 ? 'gray' : cleanDone === cleanTotal ? 'green' : cleanDone >= cleanTotal * .6 ? 'amber' : 'red';

  html += `<div class="report-section">
    <div class="report-section-head">
      <div class="report-section-title"><i class="bi bi-droplet text-primary"></i> Cleaning</div>
      <span class="score-badge score-${cleanScore}">${cleanDone}/${cleanTotal} sections cleaned</span>
    </div>`;

  if (cleanMissed.length === 0) {
    html += `<div class="report-row"><span class="report-row-name">All sections cleaned this week 🎉</span></div>`;
  } else {
    cleanMissed.forEach(c => {
      html += `<div class="report-row">
        <span class="report-row-name">${c.section.icon || '📦'} ${c.section.name}</span>
        <span class="tag-missed">Not cleaned</span>
      </div>`;
    });
    data.cleaning.filter(c => c.cleaned).forEach(c => {
      html += `<div class="report-row">
        <div>
          <span class="report-row-name">${c.section.icon || '📦'} ${c.section.name}</span>
          <div class="report-row-detail">${c.entry.cleanedBy || '—'} · ${fmtDate(c.entry.dateCleaned)}</div>
        </div>
        <span class="tag-done">Cleaned</span>
      </div>`;
    });
  }
  html += `</div>`;

  /* ── 2. PLANOGRAM ── */
  const planoTotal  = data.sections.length;
  const planoDone   = data.planogram.filter(p => p.checked).length;
  const planoFixed  = data.planogram.filter(p => p.checked && p.entry?.planogramFixed).length;
  const planoMissed = data.planogram.filter(p => !p.checked);
  const planoScore  = planoTotal === 0 ? 'gray' : planoDone === planoTotal ? 'green' : planoDone >= planoTotal * .6 ? 'amber' : 'red';

  html += `<div class="report-section">
    <div class="report-section-head">
      <div class="report-section-title"><i class="bi bi-grid text-info"></i> Planogram Checks</div>
      <span class="score-badge score-${planoScore}">${planoDone}/${planoTotal} checked${planoFixed > 0 ? ` · ${planoFixed} fixed` : ''}</span>
    </div>`;

  if (planoMissed.length === 0) {
    html += `<div class="report-row"><span class="report-row-name">All sections checked this week 🎉</span></div>`;
  } else {
    planoMissed.forEach(p => {
      html += `<div class="report-row">
        <span class="report-row-name">${p.section.icon || '📦'} ${p.section.name}</span>
        <span class="tag-missed">Not checked</span>
      </div>`;
    });
    data.planogram.filter(p => p.checked).forEach(p => {
      html += `<div class="report-row">
        <div>
          <span class="report-row-name">${p.section.icon || '📦'} ${p.section.name}</span>
          <div class="report-row-detail">${p.entry.checkedBy || '—'}${p.entry.planogramFixed ? ' · Fixed' : ''}</div>
        </div>
        <span class="tag-done">Checked</span>
      </div>`;
    });
  }
  html += `</div>`;

  /* ── 3. EXPIRY ── */
  const expTotal      = data.expiry.length;
  const expRemoved    = data.expiry.filter(e => e.removed).length;
  const expNotRemoved = data.expiry.filter(e => !e.removed);
  const expScore      = expTotal === 0 ? 'gray' : expNotRemoved.length === 0 ? 'green' : expNotRemoved.length <= 3 ? 'amber' : 'red';

  html += `<div class="report-section">
    <div class="report-section-head">
      <div class="report-section-title"><i class="bi bi-calendar-x text-danger"></i> Expiry</div>
      <span class="score-badge score-${expScore}">${expTotal} flagged · ${expRemoved} removed · ${expNotRemoved.length} still on shelf</span>
    </div>`;

  if (expTotal === 0) {
    html += `<div class="report-row"><span class="report-row-name" style="color:var(--muted);font-style:italic;">No expiry items flagged this week.</span></div>`;
  } else {
    if (expNotRemoved.length > 0) {
      expNotRemoved.forEach(e => {
        html += `<div class="report-row">
          <div>
            <span class="report-row-name">${e.item}</span>
            <div class="report-row-detail">Expires ${fmtDate(e.expiryDate)} · Flagged by ${e.signOffBy || '—'}</div>
          </div>
          <span class="tag-warn">Still on shelf</span>
        </div>`;
      });
    }
    if (expRemoved > 0) {
      html += `<div class="report-row">
        <span class="report-row-name" style="color:var(--muted);">${expRemoved} item${expRemoved > 1 ? 's' : ''} properly removed</span>
        <span class="tag-done">Removed</span>
      </div>`;
    }
  }
  html += `</div>`;

  /* ── 4. PENDING ORDERS ── */
  const ordTotal   = data.orders.length;
  const ordPending = data.orders.filter(o => !o.ordered);
  const ordDone    = data.orders.filter(o => o.ordered).length;
  const ordScore   = ordTotal === 0 ? 'gray' : ordPending.length === 0 ? 'green' : ordPending.length <= 3 ? 'amber' : 'red';

  html += `<div class="report-section">
    <div class="report-section-head">
      <div class="report-section-title"><i class="bi bi-cart text-warning"></i> Orders</div>
      <span class="score-badge score-${ordScore}">${ordTotal} total · ${ordPending.length} pending · ${ordDone} ordered</span>
    </div>`;

  if (ordTotal === 0) {
    html += `<div class="report-row"><span class="report-row-name" style="color:var(--muted);font-style:italic;">No orders logged this week.</span></div>`;
  } else {
    ordPending.forEach(o => {
      html += `<div class="report-row">
        <div>
          <span class="report-row-name">${o.item}</span>
          <div class="report-row-detail">${o.comments || '—'} · Added ${fmtDate(o.date)}</div>
        </div>
        <span class="tag-warn">Pending</span>
      </div>`;
    });
    if (ordDone > 0) {
      html += `<div class="report-row">
        <span class="report-row-name" style="color:var(--muted);">${ordDone} order${ordDone > 1 ? 's' : ''} placed</span>
        <span class="tag-done">Ordered</span>
      </div>`;
    }
  }
  html += `</div>`;

  wrap.innerHTML = html;
}

/* ── Print / PDF ─────────────────────────────────────── */
function printReport() {
  const siteId   = getActiveSite();
  const siteName = SITES[siteId];
  const mon      = dateKey(currentWeekStart);
  const sunObj   = new Date(currentWeekStart); sunObj.setDate(sunObj.getDate() + 6);
  const sun      = dateKey(sunObj);
  const content  = document.getElementById('report-wrap').innerHTML;
  const wk       = weekLabel(mon);

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
    <title>Weekly Report — ${siteName} — ${fmtRange(mon, sun)}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0;}
      body{font-family:Arial,sans-serif;font-size:10px;padding:10mm;color:#1a1a18;}
      h1{font-size:14px;font-weight:800;margin-bottom:2px;}
      .sub{font-size:9px;color:#8a8880;margin-bottom:8px;}
      .report-section{border:1px solid #e4e2dc;border-radius:8px;margin-bottom:8px;overflow:hidden;}
      .report-section-head{display:flex;justify-content:space-between;align-items:center;padding:5px 8px;background:#f5f4f0;border-bottom:1px solid #e4e2dc;}
      .report-section-title{font-weight:700;font-size:10px;}
      .score-badge{font-size:8px;font-weight:700;padding:2px 7px;border-radius:999px;}
      .score-green{background:#dcfce7;color:#166534;}
      .score-amber{background:#fef3c7;color:#92400e;}
      .score-red{background:#fee2e2;color:#b91c1c;}
      .score-gray{background:#f1f5f9;color:#64748b;}
      .report-row{display:flex;justify-content:space-between;align-items:center;padding:4px 8px;border-bottom:1px solid #f0ede8;font-size:9px;}
      .report-row:last-child{border-bottom:none;}
      .report-row-detail{font-size:8px;color:#8a8880;}
      .tag-done{font-size:7.5px;font-weight:700;padding:1px 6px;border-radius:999px;background:#dcfce7;color:#166534;}
      .tag-missed{font-size:7.5px;font-weight:700;padding:1px 6px;border-radius:999px;background:#fee2e2;color:#b91c1c;}
      .tag-warn{font-size:7.5px;font-weight:700;padding:1px 6px;border-radius:999px;background:#fef3c7;color:#92400e;}
      .tag-info{font-size:7.5px;font-weight:700;padding:1px 6px;border-radius:999px;background:#f1f5f9;color:#64748b;}
      @media print{@page{size:portrait;margin:8mm;}body{padding:0;}}
    </style>
  </head><body>
    <h1>Weekly Store Report — ${siteName} (${siteId})</h1>
    <div class="sub">${wk} · ${fmtRange(mon, sun)} · Generated ${new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
    ${content}
  </body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}