/* ── Checklist tasks definition ──────────────────────── */
const CHECKLIST = [
  { category: 'Shop',            tasks: ['Remove Expired Product'] },
  { category: 'Coolers',         tasks: ['Restock Top Brands', 'Take Temps & Log'] },
  { category: 'Bathroom',        tasks: ['General Check for Supplies', 'Empty Garbage'] },
  { category: 'Forecourt',       tasks: ['Empty Garbage on Forecourt', 'Quick Check on Supplies'] },
  { category: 'FCB Machine',     tasks: ['Restock Supplies (Cups, Lids, Straws)'] },
  { category: 'Hot Cup Coffee',  tasks: ['Ensure Supplies are Fully Stocked', 'Wipe Down Coffee Area'] },
];

const SHIFTS = ['S1', 'S2', 'S3'];
const SITES  = { C01158: '96 Shell', C01288: 'Riverside Shell', C09066: '72 Shell' };

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
    `Shift Checklist — ${SITES[active]} (${active})`;
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
let checklistData    = {};
let pendingCell      = null;
let activeInitial    = ''; // the "quick tap" initial

/* ── Init ────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initSiteSwitcher();
  initWeekNav();
  initActiveInitialBar();
  loadWeek();
  initSignModal();
  initPrint();
});

/* ── Active initial bar ──────────────────────────────── */
function initActiveInitialBar() {
  const display  = document.getElementById('active-initial-display');
  const input    = document.getElementById('active-initial-input');
  const clearBtn = document.getElementById('active-initial-clear');
  const editBtn  = document.getElementById('active-initial-edit');
  const hint     = document.getElementById('active-initial-hint');

  // Always show the input box — no toggling
  input.style.display = 'inline-block';

  function updateBar() {
    if (activeInitial) {
      input.value      = activeInitial;
      hint.textContent = 'Tap any empty cell to sign off instantly';
      hint.style.color = '#166534';
      input.style.background = '#dcfce7';
      input.style.borderColor = '#166534';
      input.style.color = '#166534';
    } else {
      hint.textContent = 'Enter your initials above to enable quick sign-off';
      hint.style.color = 'var(--muted)';
      input.style.background = '';
      input.style.borderColor = '';
      input.style.color = '';
    }
    // hide old badge/edit/clear — not needed anymore
    display.style.display  = 'none';
    clearBtn.style.display = 'none';
    editBtn.style.display  = 'none';
  }

  // Commit on Enter or blur
  input.addEventListener('input', () => {
    const val = input.value.trim().toUpperCase();
    activeInitial = val;
    updateBar();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
  });

  updateBar();
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
  const sunday = days[6];
  const week   = weekOfMonth(currentWeekStart);
  const month  = currentWeekStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const siteId = getActiveSite();
  document.getElementById('week-nav-info').textContent = weekHeader(currentWeekStart, sunday);
  document.getElementById('week-nav-sub').textContent  = `${SITES[siteId]} · ${fmtWeekRange(currentWeekStart, sunday)}`;
}

/* ── Load week data ──────────────────────────────────── */
async function loadWeek() {
  updateWeekHeader();
  const siteId = getActiveSite();
  const days   = getWeekDates(currentWeekStart);
  const from   = dateKey(days[0]);
  const to     = dateKey(days[6]);
  try {
    const entries = await api(`/api/checklist?siteId=${siteId}&from=${from}&to=${to}`);
    checklistData = {};
    entries.forEach((e) => { checklistData[`${e.date}|${e.task}|${e.shift}`] = e; });
    renderTable(days);
  } catch (err) {
    document.getElementById('checklist-container').innerHTML =
      `<div style="text-align:center;padding:3rem;color:#d1453b;">${err.message}</div>`;
  }
}

/* ── Render table ────────────────────────────────────── */
function renderTable(days) {
  const todayKey = dateKey(new Date());

  // Reorder: today first, then remaining days in chronological order
  const todayIdx = days.findIndex(d => dateKey(d) === todayKey);
  let orderedDays;
  if (todayIdx > 0) {
    // Put today first, then days after today, then days before today
    const after  = days.slice(todayIdx + 1);
    const before = days.slice(0, todayIdx);
    orderedDays = [days[todayIdx], ...after, ...before];
  } else {
    orderedDays = days; // today is already Mon or not in this week
  }

  let thead = `<tr><th style="min-width:180px;">Task</th>`;
  orderedDays.forEach((d) => {
    const isToday = dateKey(d) === todayKey;
    thead += `<th colspan="3" class="${isToday ? 'th-today' : ''}" style="text-align:center;">
      ${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getDate()}
    </th>`;
  });
  thead += '</tr><tr><th></th>';
  orderedDays.forEach((d) => {
    const isToday = dateKey(d) === todayKey;
    SHIFTS.forEach((s) => {
      thead += `<th class="${isToday ? 'th-today' : ''}" style="text-align:center;">${s}</th>`;
    });
  });
  thead += '</tr>';

  let tbody = '';
  CHECKLIST.forEach(({ category, tasks }) => {
    tbody += `<tr class="cat-row"><td colspan="${1 + orderedDays.length * 3}">${category}</td></tr>`;
    tasks.forEach((task) => {
      tbody += `<tr><td class="task-cell">${task}</td>`;
      orderedDays.forEach((d) => {
        const dk      = dateKey(d);
        const isToday = dk === todayKey;
        SHIFTS.forEach((shift) => {
          const key   = `${dk}|${task}|${shift}`;
          const entry = checklistData[key];
          const base  = isToday ? 'shift-cell col-today' : 'shift-cell';
          if (entry) {
            tbody += `<td class="${base} signed"
              data-date="${dk}" data-task="${encodeURIComponent(task)}" data-shift="${shift}"
              title="Signed: ${entry.initials} — tap to edit/delete">${entry.initials}</td>`;
          } else {
            tbody += `<td class="${base}"
              data-date="${dk}" data-task="${encodeURIComponent(task)}" data-shift="${shift}">
              <span class="sign-placeholder">—</span></td>`;
          }
        });
      });
      tbody += '</tr>';
    });
  });

  document.getElementById('checklist-container').innerHTML = `
    <table class="checklist-table">
      <thead>${thead}</thead>
      <tbody>${tbody}</tbody>
    </table>`;

  // Wire up cell clicks — only today's cells are interactive
  const todayKeyNow = dateKey(new Date());
  document.querySelectorAll('.shift-cell').forEach((cell) => {
    const cellDate = cell.dataset.date;
    if (cellDate !== todayKeyNow) {
      cell.style.cursor = 'default';
      cell.title = cellDate < todayKeyNow ? 'Past date — cannot edit' : 'Future date — cannot log ahead';
      return; // skip click listener
    }
    cell.addEventListener('click', () => {
      const date  = cell.dataset.date;
      const task  = decodeURIComponent(cell.dataset.task);
      const shift = cell.dataset.shift;
      const key   = `${date}|${task}|${shift}`;
      const entry = checklistData[key];

      if (entry) {
        openSignModal(date, task, shift);
      } else if (activeInitial) {
        quickSign(date, task, shift);
      } else {
        openSignModal(date, task, shift);
      }
    });
  });
}

/* ── Quick sign (no modal) ───────────────────────────── */
async function quickSign(date, task, shift) {
  const siteId = getActiveSite();
  // Optimistic UI — update cell immediately
  const key = `${date}|${task}|${shift}`;
  const cell = document.querySelector(
    `.shift-cell[data-date="${date}"][data-task="${encodeURIComponent(task)}"][data-shift="${shift}"]`
  );
  if (cell) {
    cell.classList.add('signed');
    cell.innerHTML = activeInitial;
    cell.title = `Signed: ${activeInitial}`;
  }
  try {
    const entry = await api('/api/checklist', {
      method: 'POST',
      body: { siteId, date, task, shift, initials: activeInitial }
    });
    // Store in local state so edit/delete works immediately without a reload
    checklistData[key] = entry;
  } catch (e) {
    // Revert optimistic update on failure
    if (cell) {
      cell.classList.remove('signed');
      cell.innerHTML = '<span class="sign-placeholder">—</span>';
    }
    alert(e.message);
  }
}

/* ── Sign modal (for edit/delete or when no active initial) ── */
function initSignModal() {
  // Handled dynamically inside openSignModal
}

function openSignModal(date, task, shift) {
  const key     = `${date}|${task}|${shift}`;
  const entry   = checklistData[key] || null;
  const dateObj = new Date(date + 'T12:00:00');

  pendingCell = { date, task, shift, existingId: entry?._id || null };

  document.getElementById('sign-modal-title').textContent = `${task} — ${shift}`;
  document.getElementById('sign-task-name').textContent   = fmtDay(dateObj);

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
    // Pre-fill with active initial if set
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
  const { date, task, shift, existingId } = pendingCell;
  const siteId = getActiveSite();
  try {
    if (existingId) {
      await api(`/api/checklist/${existingId}`, { method: 'PUT', body: { initials } });
    } else {
      await api('/api/checklist', { method: 'POST', body: { siteId, date, task, shift, initials } });
    }
    bootstrap.Modal.getInstance(document.getElementById('modal-sign')).hide();
    loadWeek();
  } catch (e) { alert(e.message); }
}

async function deleteSign() {
  try {
    await api(`/api/checklist/${pendingCell.existingId}`, { method: 'DELETE' });
    bootstrap.Modal.getInstance(document.getElementById('modal-sign')).hide();
    loadWeek();
  } catch (e) { alert(e.message); }
}


const API_BASE  = '/api/checklist';
const ENTRY_KEY = (e) => `${e.date}|${e.task}|${e.shift}`;

function buildPrintHTML(siteId, siteName, startStr, endStr, days, dataMap) {
  const s = new Date(startStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const e = new Date(endStr   + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const monthYear = new Date(startStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  let dayHeaders = '<th style="width:22%;text-align:left;padding:3px 5px;font-size:8.5px;">Task - Sign by Shift</th>';
  days.forEach(d => {
    dayHeaders += `<th colspan="3" style="text-align:center;padding:3px 4px;font-size:8.5px;border-left:1px solid #bbb;">${d.toLocaleDateString('en-US',{weekday:'short'})} ${d.getDate()}</th>`;
  });

  let shiftRow = '<th></th>';
  days.forEach(() => {
    ['S1','S2','S3'].forEach(s => {
      shiftRow += `<th style="text-align:center;font-size:7.5px;padding:2px 3px;border-left:1px solid #eee;">${s}</th>`;
    });
  });

  let rows = '';
  CHECKLIST.forEach(({ category, tasks }) => {
    rows += `<tr><td colspan="${1 + days.length * 3}" style="text-align:center;background:#e8e8e8;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;padding:2px 5px;border-top:1px solid #bbb;border-bottom:1px solid #bbb;">${category}</td></tr>`;
    tasks.forEach(task => {
      rows += `<tr><td style="padding:2px 5px;font-size:8px;border-right:1px solid #ddd;">${task}</td>`;
      days.forEach(d => {
        const dk = dateKey(d);
        ['S1','S2','S3'].forEach(shift => {
          const entry = dataMap[dk + '|' + task + '|' + shift];
          const bg  = entry ? '#e6f9ee' : '#fff';
          const txt = entry ? `<b style="color:#166534;font-size:8px;">${entry.initials}</b>` : '';
          rows += `<td style="text-align:center;background:${bg};border-left:1px solid #ddd;padding:1px 2px;">${txt}</td>`;
        });
      });
      rows += '</tr>';
    });
  });

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
    <title>Shift Checklist — ${siteName} — ${s} to ${e}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; font-size: 8.5px; padding: 6mm; }
      .header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
      .shell-logo { font-size: 22px; line-height: 1; }
      .title-block { text-align: center; flex: 1; }
      .title-block h1 { font-size: 12px; font-weight: 700; margin-bottom: 2px; }
      .info-block { font-size: 8px; text-align: right; border: 1px solid #ccc; padding: 3px 6px; line-height: 1.8; min-width: 120px; }
      .info-block div { border-bottom: 1px solid #eee; }
      .info-block div:last-child { border-bottom: none; }
      .promise { font-size: 7.5px; color: #444; margin: 4px 0 5px; line-height: 1.4; border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; padding: 3px 0; }
      table { border-collapse: collapse; width: 100%; table-layout: fixed; }
      th { background: #f0f0f0; font-size: 8px; font-weight: 700; padding: 2px 3px; border: 1px solid #bbb; text-align: center; }
      th:first-child { text-align: left; }
      td { border: 1px solid #ddd; vertical-align: middle; height: 13px; }
      @media print {
        @page { size: landscape; margin: 6mm; }
        body { padding: 0; }
      }
    </style>
  </head><body>
    <div class="header-row">
      <div class="shell-logo">🐚</div>
      <div class="title-block">
        <h1>Site Cleaning Checklist</h1>
        <div style="font-size:8px;color:#555;">Shift Checklist — ${siteName}</div>
      </div>
      <div class="info-block">
        <div>C-Location: <b>${siteId}</b></div>
        <div>Week: <b>${s} – ${e}</b></div>
        <div>Month/Year: <b>${monthYear}</b></div>
      </div>
    </div>
    <div class="promise">We promise customers a great experience every time they visit. To keep our promise, your site needs to be thoroughly checked so it is ready to serve customers.</div>
    <table>
      <thead><tr>${dayHeaders}</tr><tr>${shiftRow}</tr></thead>
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