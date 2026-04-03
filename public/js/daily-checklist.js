/* ── Daily checklist tasks ───────────────────────────── */
const CHECKLIST = [
  { category: 'Shop', tasks: [
    'Sweep Floors',
    'Mop Floors',
    'Clean Baseboards',
    'Sanitize & Wipe POS Terminal',
    'Sanitize & Wipe Lottery Display',
    'Sanitize & Wipe Interior/Exterior Door Handles',
    'Ensure No Slip or Trip Hazards',
  ]},
  { category: 'Coolers', tasks: [
    'Clean Surfaces',
    'Ensure Items are to Planogram',
  ]},
  { category: 'Bathroom', tasks: [
    'Deep Clean Toilet & Sink',
    'Mop Floor',
  ]},
  { category: 'Forecourt', tasks: [
    'Sanitize Touch Screens on Pumps',
    'Sanitize Pump Payment Terminals',
    'Clean Handles & Hoses',
    'Clean Off Any Sticker Residue',
    'Replace Supplies',
  ]},
  { category: 'FCB Machine', tasks: [
    'Empty Drip Tray',
    'Clean Floor Around Area',
    'Wipe Down Nozzles',
    'Clean Under FCB Machine (Remove Cups, Lids, Dust)',
  ]},
  { category: 'Hot Cup / Bean to Cup Machine', tasks: [
    'Empty Grounds Bin',
    'Ensure Hoppers are Full',
    'Empty Drain Grate, Clean with Sanitizer (Not Bleach)',
    'Wipe Dispense Nozzles with Clean Sanitizer Towel',
    'Clean Around Dispensing Area',
    'Prepare for Daily Intellirinse Auto Clean',
    'Clean Bean Hopper with Dry Paper Towel',
    'Remove Wastewater from Tank',
  ]},
  { category: 'Food Service', tasks: [
    'Clean & Sanitize Food Prep Area',
    'Clean & Sanitize All Food Equipment',
    'Capture Waste for Right Offs as Per Site Policy',
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
    `Daily Checklist — ${SITES[active]} (${active})`;
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

function getWeekDates(weekStart) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
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

function fmtDay(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtWeekRange(start, end) {
  const s = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const e = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${s} – ${e}`;
}

function weekOfMonth(date) {
  // True calendar week: week 1 = 1-7, week 2 = 8-14, etc.
  return Math.ceil(date.getDate() / 7);
}

function weekHeader(weekStart, weekEnd) {
  const startMonth = weekStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const endMonth   = weekEnd.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const week       = weekOfMonth(weekStart);
  if (startMonth === endMonth) {
    return `Week ${week} of ${startMonth}`;
  } else {
    // Spans two months — show based on which month has more days in this week
    return `Week ${week} of ${startMonth} / Week 1 of ${weekEnd.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
  }
}

/* ── State ───────────────────────────────────────────── */
let currentWeekStart = getMondayOf(new Date());
let checklistData    = {}; // keyed "YYYY-MM-DD|task" → entry
let pendingCell      = null;
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
      hint.textContent         = 'Tap any empty cell to sign off instantly';
      hint.style.color         = '#166534';
      input.style.background   = '#dcfce7';
      input.style.borderColor  = '#166534';
      input.style.color        = '#166534';
    } else {
      hint.textContent         = 'Enter your initials above to enable quick sign-off';
      hint.style.color         = 'var(--muted)';
      input.style.background   = '';
      input.style.borderColor  = '';
      input.style.color        = '';
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
  const days   = getWeekDates(currentWeekStart);
  const week   = weekOfMonth(currentWeekStart);
  const month  = currentWeekStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const siteId = getActiveSite();
  document.getElementById('week-nav-info').textContent = weekHeader(days[0], days[6]);
  document.getElementById('week-nav-sub').textContent  = `${SITES[siteId]} · ${fmtWeekRange(days[0], days[6])}`;
}

/* ── Load week ───────────────────────────────────────── */
async function loadWeek() {
  updateWeekHeader();
  const siteId = getActiveSite();
  const days   = getWeekDates(currentWeekStart);
  const from   = dateKey(days[0]);
  const to     = dateKey(days[6]);
  try {
    const entries = await api(`/api/daily-checklist?siteId=${siteId}&from=${from}&to=${to}`);
    checklistData = {};
    entries.forEach((e) => { checklistData[`${e.date}|${e.task}`] = e; });
    renderTable(days);
  } catch (err) {
    document.getElementById('checklist-container').innerHTML =
      `<div style="text-align:center;padding:3rem;color:#d1453b;">${err.message}</div>`;
  }
}

/* ── Render table ────────────────────────────────────── */
function renderTable(days) {
  const todayKey = dateKey(new Date());

  // Today first, then rest in chronological order
  const todayIdx = days.findIndex(d => dateKey(d) === todayKey);
  const orderedDays = todayIdx > 0
    ? [days[todayIdx], ...days.slice(todayIdx + 1), ...days.slice(0, todayIdx)]
    : days;

  // Header
  let thead = '<tr><th>Task</th>';
  orderedDays.forEach((d) => {
    const isToday = dateKey(d) === todayKey;
    thead += `<th class="${isToday ? 'th-today' : ''}">
      ${d.toLocaleDateString('en-US', { weekday: 'short' })}<br>
      <span style="font-size:.8em;opacity:.7;">${d.getDate()}</span>
    </th>`;
  });
  thead += '</tr>';

  // Body
  let tbody = '';
  CHECKLIST.forEach(({ category, tasks }) => {
    tbody += `<tr class="cat-row"><td colspan="${1 + orderedDays.length}">${category}</td></tr>`;
    tasks.forEach((task) => {
      tbody += `<tr><td class="task-cell">${task}</td>`;
      orderedDays.forEach((d) => {
        const dk      = dateKey(d);
        const isToday = dk === todayKey;
        const key     = `${dk}|${task}`;
        const entry   = checklistData[key];
        const base    = isToday ? 'day-cell col-today' : 'day-cell';
        if (entry) {
          tbody += `<td class="${base} signed"
            data-date="${dk}" data-task="${encodeURIComponent(task)}"
            title="${entry.initials} — tap to edit/delete">${entry.initials}</td>`;
        } else {
          tbody += `<td class="${base}"
            data-date="${dk}" data-task="${encodeURIComponent(task)}">
            <span class="sign-placeholder">—</span></td>`;
        }
      });
      tbody += '</tr>';
    });
  });

  document.getElementById('checklist-container').innerHTML = `
    <table class="checklist-table">
      <thead>${thead}</thead>
      <tbody>${tbody}</tbody>
    </table>`;

  // Wire clicks — only today's cells are interactive
  const todayKeyNow = dateKey(new Date());
  document.querySelectorAll('.day-cell').forEach((cell) => {
    const cellDate = cell.dataset.date;
    if (cellDate !== todayKeyNow) {
      cell.style.cursor = 'default';
      cell.title = cellDate < todayKeyNow ? 'Past date — cannot edit' : 'Future date — cannot log ahead';
      return; // skip click listener
    }
    cell.addEventListener('click', () => {
      const date  = cell.dataset.date;
      const task  = decodeURIComponent(cell.dataset.task);
      const entry = checklistData[`${date}|${task}`];
      if (entry) {
        openSignModal(date, task);
      } else if (activeInitial) {
        quickSign(date, task);
      } else {
        openSignModal(date, task);
      }
    });
  });
}

/* ── Quick sign ──────────────────────────────────────── */
async function quickSign(date, task) {
  const siteId = getActiveSite();
  const key    = `${date}|${task}`;
  const cell   = document.querySelector(
    `.day-cell[data-date="${date}"][data-task="${encodeURIComponent(task)}"]`
  );
  // Optimistic update
  if (cell) {
    cell.classList.add('signed');
    cell.innerHTML = activeInitial;
  }
  try {
    const entry = await api('/api/daily-checklist', {
      method: 'POST',
      body: { siteId, date, task, initials: activeInitial }
    });
    checklistData[key] = entry;
  } catch (e) {
    // Revert on failure
    if (cell) { cell.classList.remove('signed'); cell.innerHTML = '<span class="sign-placeholder">—</span>'; }
    alert(e.message);
  }
}

/* ── Sign modal ──────────────────────────────────────── */
function openSignModal(date, task) {
  const key   = `${date}|${task}`;
  const entry = checklistData[key] || null;

  pendingCell = { date, task, existingId: entry?._id || null };

  document.getElementById('sign-modal-title').textContent = task;
  document.getElementById('sign-task-name').textContent   = fmtDay(new Date(date + 'T12:00:00'));

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
  const { date, task, existingId } = pendingCell;
  const siteId = getActiveSite();
  try {
    if (existingId) {
      await api(`/api/daily-checklist/${existingId}`, { method: 'PUT', body: { initials } });
    } else {
      await api('/api/daily-checklist', { method: 'POST', body: { siteId, date, task, initials } });
    }
    bootstrap.Modal.getInstance(document.getElementById('modal-sign')).hide();
    loadWeek();
  } catch (e) { alert(e.message); }
}

async function deleteSign() {
  try {
    await api(`/api/daily-checklist/${pendingCell.existingId}`, { method: 'DELETE' });
    bootstrap.Modal.getInstance(document.getElementById('modal-sign')).hide();
    loadWeek();
  } catch (e) { alert(e.message); }
}


const API_BASE  = '/api/daily-checklist';
const ENTRY_KEY = (e) => `${e.date}|${e.task}`;

function buildPrintHTML(siteId, siteName, startStr, endStr, days, dataMap) {
  const s = new Date(startStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const e = new Date(endStr   + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const monthYear = new Date(startStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  let dayHeaders = '<th style="width:28%;text-align:left;padding:3px 5px;font-size:9px;">Task - Sign by Day</th>';
  days.forEach(d => {
    dayHeaders += `<th style="text-align:center;padding:3px 4px;font-size:9px;border-left:1px solid #bbb;">${d.toLocaleDateString('en-US',{weekday:'short'})}<br>${d.getDate()}</th>`;
  });

  let rows = '';
  CHECKLIST.forEach(({ category, tasks }) => {
    rows += `<tr><td colspan="${1 + days.length}" style="text-align:center;background:#e8e8e8;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;padding:3px 5px;border-top:1px solid #bbb;border-bottom:1px solid #bbb;">${category}</td></tr>`;
    tasks.forEach(task => {
      rows += `<tr><td style="padding:2px 5px;font-size:8.5px;border-right:1px solid #ddd;">${task}</td>`;
      days.forEach(d => {
        const entry = dataMap[dateKey(d) + '|' + task];
        const bg  = entry ? '#e6f9ee' : '#fff';
        const txt = entry ? `<b style="color:#166534;font-size:9px;">${entry.initials}</b>` : '';
        rows += `<td style="text-align:center;background:${bg};border-left:1px solid #ddd;padding:2px 3px;">${txt}</td>`;
      });
      rows += '</tr>';
    });
  });

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
    <title>Daily Checklist — ${siteName} — ${s} to ${e}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; font-size: 9px; padding: 6mm; }
      .header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
      .shell-logo { font-size: 22px; line-height: 1; }
      .title-block { text-align: center; flex: 1; }
      .title-block h1 { font-size: 13px; font-weight: 700; margin-bottom: 2px; }
      .info-block { font-size: 8px; text-align: right; border: 1px solid #ccc; padding: 3px 6px; line-height: 1.8; min-width: 120px; }
      .info-block div { border-bottom: 1px solid #eee; }
      .info-block div:last-child { border-bottom: none; }
      .promise { font-size: 7.5px; color: #444; margin: 4px 0 5px; line-height: 1.4; border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; padding: 3px 0; }
      table { border-collapse: collapse; width: 100%; table-layout: fixed; }
      th { background: #f0f0f0; font-size: 8.5px; font-weight: 700; padding: 3px 4px; border: 1px solid #bbb; text-align: center; }
      th:first-child { text-align: left; }
      td { border: 1px solid #ddd; vertical-align: middle; height: 14px; }
      @media print {
        @page { size: landscape; margin: 6mm; }
        body { padding: 0; }
        html, body { height: 100%; }
      }
    </style>
  </head><body>
    <div class="header-row">
      <div class="shell-logo">🐚</div>
      <div class="title-block">
        <h1>Site Cleaning Checklist</h1>
        <div style="font-size:8px;color:#555;">Daily Checklist — ${siteName}</div>
      </div>
      <div class="info-block">
        <div>C-Location: <b>${siteId}</b></div>
        <div>Week: <b>${s} – ${e}</b></div>
        <div>Month/Year: <b>${monthYear}</b></div>
      </div>
    </div>
    <div class="promise">We promise customers a great experience every time they visit. To keep our promise, your site needs to be thoroughly checked so it is ready to serve customers.</div>
    <table>
      <thead><tr>${dayHeaders}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body></html>`;
}

/* ── Print / PDF ─────────────────────────────────────── */
function initPrint() {
  const btn = document.getElementById('btn-print');
  if (!btn) return;
  btn.addEventListener('click', () => {
    // Pre-fill start with current week's Monday
    const monday = dateKey(currentWeekStart);
    document.getElementById('print-start').value = monday;
    setEndDate(monday);
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-print')).show();
  });

  document.getElementById('print-start').addEventListener('change', (e) => {
    setEndDate(e.target.value);
  });

  document.getElementById('btn-print-confirm').addEventListener('click', generatePDF);
}

function setEndDate(startStr) {
  if (!startStr) return;
  const start = new Date(startStr + 'T12:00:00');
  const end   = new Date(start);
  end.setDate(end.getDate() + 6);
  const endStr = dateKey(end);
  document.getElementById('print-end').value = endStr;
  const s = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const e = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  document.getElementById('print-range-label').textContent = `${s} – ${e} (7 days)`;
}

async function generatePDF() {
  const startStr = document.getElementById('print-start').value;
  const endStr   = document.getElementById('print-end').value;
  if (!startStr || !endStr) return;

  const siteId   = getActiveSite();
  const siteName = SITES[siteId];

  // Fetch data for the selected range
  let entries;
  try {
    entries = await api(`${API_BASE}?siteId=${siteId}&from=${startStr}&to=${endStr}`);
  } catch (e) { alert('Failed to load data: ' + e.message); return; }

  // Build data map
  const dataMap = {};
  entries.forEach((e) => {
    const k = ENTRY_KEY(e);
    dataMap[k] = e;
  });

  // Build 7 days in chronological order
  const start = new Date(startStr + 'T12:00:00');
  const days  = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });

  // Generate print HTML
  const html = buildPrintHTML(siteId, siteName, startStr, endStr, days, dataMap);

  // Open in new window and trigger print
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);

  bootstrap.Modal.getInstance(document.getElementById('modal-print')).hide();
}