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

function dateKey(date) { return date.toISOString().split('T')[0]; }

function fmtDay(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtWeekRange(start, end) {
  const s = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const e = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${s} – ${e}`;
}

function weekOfMonth(date) { return Math.min(Math.ceil(date.getDate() / 7), 4); }

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
  document.getElementById('week-nav-info').textContent = `Week ${week} of ${month}`;
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

  // Wire clicks
  document.querySelectorAll('.day-cell').forEach((cell) => {
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