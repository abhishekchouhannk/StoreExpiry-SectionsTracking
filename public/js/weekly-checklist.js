/* ── Weekly checklist tasks ──────────────────────────── */
const CHECKLIST = [
  { category: 'Shop', tasks: [
    'Clean Shelving & Product',
    'Inspect Price Tags & Replace as Needed',
    'Clean Backroom Shelves & Floor',
    'Ensure Products are Well Organized',
  ]},
  { category: 'Freezers', tasks: [
    'Clean Dust from Vents',
    'Clean Ice Build Up',
  ]},
  { category: 'Coolers', tasks: [
    'Inspect for Any Leaks in Walk In Cooler',
    'Clean Shelves and Sliders in Walk In Cooler',
    'Clean Dust from Vents',
  ]},
  { category: 'Bathroom', tasks: [
    'Wipe Down Tiles & Walls',
    'Clean Down Door Surfaces',
    'Remove Graffiti',
  ]},
  { category: 'Forecourt', tasks: [
    'Wipe Down Exterior Merchandiser',
    'Wipe Down Product',
    'Clean Signage',
    'Ensure Signage is Current',
    'Remove Any Faded or Damaged Product',
  ]},
  { category: 'FCB Machine', tasks: [
    'Deep Clean Under Machine',
    'Check Dates of BiBs',
  ]},
  { category: 'Hot Cup / Bean to Cup Machine', tasks: [
    'Clean Brew Head',
    'Clean Water Tower Nozzle',
    'Dust Tea Rack',
  ]},
];

const SITES = { C01158: '96 Shell', C01288: 'Riverside Shell', C09066: '72 Shell' };

/* ── Site management ─────────────────────────────────── */
function getActiveSite() { return localStorage.getItem('activeSiteId') || 'C01158'; }
function setActiveSite(id) { localStorage.setItem('activeSiteId', id); }

function syncDropdownLabel(siteId) {
  const lbl = document.getElementById('site-dropdown-label');
  if (lbl) lbl.textContent = SITES[siteId];
}

function initSiteSwitcher() {
  const active = getActiveSite();
  document.querySelectorAll('.site-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.site === active);
    btn.addEventListener('click', () => {
      setActiveSite(btn.dataset.site);
      document.querySelectorAll('.site-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      syncDropdownLabel(btn.dataset.site);
      document.getElementById('site-overlay').classList.add('active');
      setTimeout(() => window.location.reload(), 120);
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
        document.getElementById('site-overlay').classList.add('active');
        setTimeout(() => window.location.reload(), 120);
      });
    });
  }
  document.getElementById('page-title').textContent =
    `Weekly Checklist — ${SITES[active]} (${active})`;
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

function getMondayOf(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateKey(date) {
  // Use local date to avoid UTC offset shifting the date (e.g. Vancouver PST/PDT)
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fmtDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function weekOfMonth(monday) {
  // Use Sunday's date to determine week number — matches physical calendar feel
  // e.g. Apr 6-12: Sunday is Apr 12, ceil(12/7) = 2 → Week 2 ✓
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  // If Sunday is in a different month, use Monday's perspective
  if (sunday.getMonth() !== monday.getMonth()) {
    return Math.ceil(monday.getDate() / 7);
  }
  return Math.ceil(sunday.getDate() / 7);
}

function weekHeader(weekStart, weekEnd) {
  const startMonth = weekStart.getMonth();
  const endMonth   = weekEnd.getMonth();
  const wk = weekOfMonth(weekStart);
  const mo = weekStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  if (startMonth !== endMonth) {
    const nextWk = weekOfMonth(weekEnd);
    const nextMo = weekEnd.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    // return `Week ${wk} of ${mo} / Week ${nextWk} of ${nextMo}`;
    return `Week ${wk} of ${mo}`;
  }
  return `Week ${wk} of ${mo}`;
}

/* ── State ───────────────────────────────────────────── */
let currentWeekStart = getMondayOf(new Date());
let checklistData    = {}; // keyed "weekStart|task" → entry
let pendingTask      = null;
let activeInitial    = '';

/* ── Init ────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initSiteSwitcher();
  initWeekNav();
  initActiveInitialBar();
  loadWeek();
  initPrint();
});

/* ── Active initial bar ──────────────────────────────── */
function initActiveInitialBar() {
  const input = document.getElementById('active-initial-input');
  const hint  = document.getElementById('active-initial-hint');
  input.addEventListener('input', () => {
    activeInitial = input.value.trim().toUpperCase();
    if (activeInitial) {
      hint.textContent        = 'Tap any unsigned task to sign off instantly';
      hint.style.color        = '#166534';
      input.style.background  = '#dcfce7';
      input.style.borderColor = '#166534';
      input.style.color       = '#166534';
    } else {
      hint.textContent        = 'Enter your initials above to enable quick sign-off';
      hint.style.color        = 'var(--muted)';
      input.style.background  = '';
      input.style.borderColor = '';
      input.style.color       = '';
    }
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
}

/* ── Week nav ────────────────────────────────────────── */
function initWeekNav() {
  document.getElementById('btn-prev').addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    loadWeek();
  });
  document.getElementById('btn-next').addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    loadWeek();
  });
  document.getElementById('btn-today').addEventListener('click', () => {
    currentWeekStart = getMondayOf(new Date());
    loadWeek();
  });
}

function updateWeekHeader() {
  const sunday = new Date(currentWeekStart);
  sunday.setDate(sunday.getDate() + 6);
  const siteId = getActiveSite();
  document.getElementById('week-nav-info').textContent =
    weekHeader(currentWeekStart, sunday);
  document.getElementById('week-nav-sub').textContent  =
    `${SITES[siteId]} · ${fmtDate(currentWeekStart)} – ${fmtDate(sunday)}`;
}

/* ── Load week ───────────────────────────────────────── */
async function loadWeek() {
  updateWeekHeader();
  const siteId   = getActiveSite();
  const weekStart = dateKey(currentWeekStart);
  try {
    const entries = await api(`/api/weekly-checklist?siteId=${siteId}&weekStart=${weekStart}`);
    checklistData = {};
    entries.forEach((e) => { checklistData[`${e.weekStart}|${e.task}`] = e; });
    renderTable();
  } catch (err) {
    document.getElementById('checklist-container').innerHTML =
      `<div style="text-align:center;padding:3rem;color:#d1453b;">${err.message}</div>`;
  }
}

/* ── Render table ────────────────────────────────────── */
function renderTable() {
  const weekStart = dateKey(currentWeekStart);
  let tbody = '';
  CHECKLIST.forEach(({ category, tasks }) => {
    tbody += `<tr class="cat-row"><td colspan="2">${category}</td></tr>`;
    tasks.forEach((task) => {
      const key   = `${weekStart}|${task}`;
      const entry = checklistData[key];
      const signCol = entry
        ? `<td class="sign-col signed" data-task="${encodeURIComponent(task)}" title="Tap to edit/delete">${entry.initials}</td>`
        : `<td class="sign-col" data-task="${encodeURIComponent(task)}"><span class="sign-placeholder">—</span></td>`;
      tbody += `<tr><td style="font-size:.85rem;padding:.5rem 1rem;">${task}</td>${signCol}</tr>`;
    });
  });

  document.getElementById('checklist-container').innerHTML = `
    <table class="checklist-table">
      <thead><tr><th>Task</th><th style="text-align:center;width:90px;">Signed</th></tr></thead>
      <tbody>${tbody}</tbody>
    </table>`;

  document.querySelectorAll('.sign-col').forEach((cell) => {
    cell.addEventListener('click', () => {
      const task  = decodeURIComponent(cell.dataset.task);
      const key   = `${weekStart}|${task}`;
      const entry = checklistData[key];
      if (entry) {
        openSignModal(task);
      } else if (activeInitial) {
        quickSign(task);
      } else {
        openSignModal(task);
      }
    });
  });
}

/* ── Quick sign ──────────────────────────────────────── */
async function quickSign(task) {
  const siteId    = getActiveSite();
  const weekStart = dateKey(currentWeekStart);
  const key       = `${weekStart}|${task}`;
  const cell      = document.querySelector(`.sign-col[data-task="${encodeURIComponent(task)}"]`);
  if (cell) { cell.classList.add('signed'); cell.innerHTML = activeInitial; }
  try {
    const entry = await api('/api/weekly-checklist', {
      method: 'POST',
      body: { siteId, weekStart, task, initials: activeInitial }
    });
    checklistData[key] = entry;
  } catch (e) {
    if (cell) { cell.classList.remove('signed'); cell.innerHTML = '<span class="sign-placeholder">—</span>'; }
    alert(e.message);
  }
}

/* ── Sign modal ──────────────────────────────────────── */
function openSignModal(task) {
  const weekStart = dateKey(currentWeekStart);
  const key   = `${weekStart}|${task}`;
  const entry = checklistData[key] || null;

  pendingTask = { task, weekStart, existingId: entry?._id || null };

  document.getElementById('sign-modal-title').textContent = 'Sign Off';
  document.getElementById('sign-task-name').textContent   = task;

  const signForm   = document.getElementById('sign-form');
  const signedView = document.getElementById('signed-view');
  const footer     = document.getElementById('sign-modal-footer');

  if (entry) {
    signForm.style.display   = 'none';
    signedView.style.display = 'block';
    document.getElementById('signed-initials-display').textContent = entry.initials;
    document.getElementById('signed-meta-display').textContent =
      `Signed off · ${new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    footer.innerHTML = `
      <button class="btn-ghost" data-bs-dismiss="modal">Close</button>
      <button class="btn-solid" id="btn-edit-sign" style="background:#c47a1a;">Edit</button>
      <button class="btn-solid btn-solid-red" id="btn-delete-sign">Delete</button>`;
    document.getElementById('btn-edit-sign').addEventListener('click', () => switchToEditMode(entry.initials));
    document.getElementById('btn-delete-sign').addEventListener('click', deleteSign);
  } else {
    signForm.style.display   = 'block';
    signedView.style.display = 'none';
    document.getElementById('sign-initials').value = activeInitial;
    footer.innerHTML = `
      <button class="btn-ghost" data-bs-dismiss="modal">Cancel</button>
      <button class="btn-solid" id="btn-sign-save">Sign Off</button>`;
    document.getElementById('btn-sign-save').addEventListener('click', saveSign);
    document.getElementById('sign-initials').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveSign();
    });
  }

  bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-sign')).show();
  if (!entry) setTimeout(() => document.getElementById('sign-initials').focus(), 300);
}

function switchToEditMode(currentInitials) {
  document.getElementById('signed-view').style.display = 'none';
  document.getElementById('sign-form').style.display   = 'block';
  document.getElementById('sign-initials').value       = currentInitials;
  document.getElementById('sign-modal-footer').innerHTML = `
    <button class="btn-ghost" data-bs-dismiss="modal">Cancel</button>
    <button class="btn-solid" id="btn-sign-save">Update</button>`;
  document.getElementById('btn-sign-save').addEventListener('click', saveSign);
  setTimeout(() => document.getElementById('sign-initials').focus(), 100);
}

async function saveSign() {
  const initials = document.getElementById('sign-initials').value.trim().toUpperCase();
  if (!initials) return document.getElementById('sign-initials').focus();
  const { task, weekStart, existingId } = pendingTask;
  const siteId = getActiveSite();
  try {
    if (existingId) {
      await api(`/api/weekly-checklist/${existingId}`, { method: 'PUT', body: { initials } });
    } else {
      await api('/api/weekly-checklist', { method: 'POST', body: { siteId, weekStart, task, initials } });
    }
    bootstrap.Modal.getInstance(document.getElementById('modal-sign')).hide();
    loadWeek();
  } catch (e) { alert(e.message); }
}

async function deleteSign() {
  try {
    await api(`/api/weekly-checklist/${pendingTask.existingId}`, { method: 'DELETE' });
    bootstrap.Modal.getInstance(document.getElementById('modal-sign')).hide();
    loadWeek();
  } catch (e) { alert(e.message); }
}

/* ── Print / PDF ─────────────────────────────────────── */
function initPrint() {
  const btn = document.getElementById('btn-print');
  if (!btn) return;
  btn.addEventListener('click', () => {
    document.getElementById('print-start').value = dateKey(currentWeekStart);
    updatePrintLabel(dateKey(currentWeekStart));
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-print')).show();
  });
  document.getElementById('print-start').addEventListener('change', (e) => updatePrintLabel(e.target.value));
  document.getElementById('btn-print-confirm').addEventListener('click', generatePDF);
}

function updatePrintLabel(startStr) {
  if (!startStr) return;
  const start = new Date(startStr + 'T12:00:00');
  const end   = new Date(start); end.setDate(end.getDate() + 6);
  document.getElementById('print-range-label').textContent =
    `${fmtDate(start)} – ${fmtDate(end)}`;
}

async function generatePDF() {
  const startStr = document.getElementById('print-start').value;
  if (!startStr) return;
  const siteId   = getActiveSite();
  const siteName = SITES[siteId];
  let entries;
  try {
    entries = await api(`/api/weekly-checklist?siteId=${siteId}&weekStart=${startStr}`);
  } catch (e) { alert('Failed to load data: ' + e.message); return; }

  const dataMap = {};
  entries.forEach((e) => { dataMap[`${e.weekStart}|${e.task}`] = e; });

  const start    = new Date(startStr + 'T12:00:00');
  const end      = new Date(start); end.setDate(end.getDate() + 6);
  const monthYear = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const s = fmtDate(start), e2 = fmtDate(end);

  let rows = '';
  CHECKLIST.forEach(({ category, tasks }) => {
    rows += `<tr><td colspan="2" style="text-align:center;background:#e8e8e8;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;padding:3px 8px;border-top:1px solid #bbb;border-bottom:1px solid #bbb;">${category}</td></tr>`;
    tasks.forEach(task => {
      const entry = dataMap[`${startStr}|${task}`];
      const bg    = entry ? '#e6f9ee' : '#fff';
      const txt   = entry ? `<b style="color:#166534;font-size:11px;">${entry.initials}</b>` : '';
      rows += `<tr>
        <td style="padding:3px 8px;font-size:10px;border-right:1px solid #ddd;">${task}</td>
        <td style="text-align:center;background:${bg};padding:3px 8px;font-size:10px;width:80px;">${txt}</td>
      </tr>`;
    });
  });

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
    <title>Weekly Checklist — ${siteName} — ${s}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0;}
      body{font-family:Arial,sans-serif;font-size:10px;padding:10mm;}
      .header-row{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;}
      .shell-logo{font-size:28px;}
      .title-block{text-align:center;flex:1;}
      .title-block h1{font-size:16px;font-weight:700;margin-bottom:2px;}
      .title-block p{font-size:9px;color:#555;}
      .info-block{font-size:9px;text-align:right;border:1px solid #ccc;padding:4px 8px;line-height:2;min-width:130px;}
      .info-block div{border-bottom:1px solid #eee;}
      .info-block div:last-child{border-bottom:none;}
      .promise{font-size:8px;color:#444;margin:5px 0 7px;line-height:1.5;border-top:1px solid #ccc;border-bottom:1px solid #ccc;padding:3px 0;}
      table{border-collapse:collapse;width:100%;max-width:480px;}
      th{background:#f0f0f0;font-size:9px;font-weight:700;padding:4px 8px;border:1px solid #bbb;text-align:left;}
      th:last-child{text-align:center;width:80px;}
      td{border:1px solid #ddd;vertical-align:middle;height:18px;}
      @media print{@page{size:portrait;margin:8mm;}body{padding:0;}}
    </style>
  </head><body>
    <div class="header-row">
      <div class="shell-logo">🐚</div>
      <div class="title-block">
        <h1>Site Cleaning Checklist</h1>
        <p>Weekly Checklist — ${siteName}</p>
      </div>
      <div class="info-block">
        <div>C-Location: <b>${siteId}</b></div>
        <div>Week: <b>${s} – ${e2}</b></div>
        <div>Month/Year: <b>${monthYear}</b></div>
      </div>
    </div>
    <div class="promise">We promise customers a great experience every time they visit. To keep our promise, your site needs to be thoroughly checked so it is ready to serve customers.</div>
    <table>
      <thead><tr><th>Task</th><th style="text-align:center;">Signed</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
  bootstrap.Modal.getInstance(document.getElementById('modal-print')).hide();
}