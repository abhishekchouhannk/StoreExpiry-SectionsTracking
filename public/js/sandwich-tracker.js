/* ── Site helpers (nav.js owns the UI, these are for data fetching) ── */
const SITES = { C01158: '96 Shell', C01288: 'Riverside Shell', C09066: '72 Shell' };
function getActiveSite() { return localStorage.getItem('activeSiteId') || 'C01158'; }
function setActiveSite(id) { localStorage.setItem('activeSiteId', id); }

const SANDWICHES = [
  { group: 'Sandwiches', items: [
    'F&L SNDW Egg Salad',
    'F&L SNDW Trky/Mnt',
    'F&L SNDW Tuna Sld',
    'F&L Sub Hungryman',
    'F&L Wrap Chkn Buffalo',
  ]},
  { group: 'English Muffins', items: [
    'F&L Eng Muff Egg/Bcn/Che',
    'F&L Eng Muff Egg/Ched',
    'F&L Eng Muff Egg/Ssg/Che',
  ]},
];

const COLS = [
  { key: 'orderQty',     label: 'Order Qty' },
  { key: 'receivedQty',  label: 'Received' },
  { key: 'expiryDate',   label: 'Expiry' },
  { key: 'sticker',      label: '$2 Sticker' },
  { key: 'sales',        label: 'Sales' },
  { key: 'waste',        label: 'Waste' },
  { key: 'pdi',          label: 'PDI' },
  { key: 'sign',         label: 'Sign' },
];



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
  document.getElementById('page-title').textContent =
    `Sandwich Tracker — ${SITES[active]}`;
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

function getWednesdayOf(monday) {
  const d = new Date(monday);
  d.setDate(d.getDate() + 2);
  return d;
}

function dateKey(date) {
  // Use local date to avoid UTC offset shifting the date (e.g. Vancouver PST/PDT)
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fmtShort(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtFull(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

/* ── State ───────────────────────────────────────────── */
let currentWeekStart = getMondayOf(new Date());
let trackerData      = {}; // keyed "sandwich" → entry
let pendingSandwich  = null;
let pendingId        = null;

/* ── Init ────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

  // 72 Shell doesn't do sandwiches — redirect to dashboard
  if (getActiveSite() === 'C09066') {
    document.getElementById('tracker-container').innerHTML = `
      <div style="text-align:center;padding:4rem 1rem;color:var(--muted);">
        <div style="font-size:2rem;margin-bottom:.75rem;">🚫</div>
        <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:1rem;margin-bottom:.4rem;color:var(--text);">Not available for 72 Shell</div>
        <div style="font-size:.85rem;">The sandwich tracker is only for 96 Shell and Riverside Shell.</div>
      </div>`;
    // Hide delivery bar too
    document.querySelector('.delivery-bar').style.display = 'none';
    document.querySelector('.week-nav').style.display = 'none';
    return;
  }

  initWeekNav();
  initDeliveryBar();
  loadWeek();
  initModal();
});

/* ── Delivery bar ────────────────────────────────────── */
function initDeliveryBar() {
  const orderInput    = document.getElementById('order-date');
  const deliveryInput = document.getElementById('delivery-date');

  // When order date changes, auto-set delivery to next Wednesday
  orderInput.addEventListener('change', () => {
    const d = new Date(orderInput.value + 'T12:00:00');
    // Find next Wednesday
    const daysUntilWed = (3 - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + daysUntilWed);
    deliveryInput.value = dateKey(d);
    saveDeliveryDates();
  });

  deliveryInput.addEventListener('change', saveDeliveryDates);
}

function setDeliveryBarDates() {
  const monday    = currentWeekStart;
  const wednesday = getWednesdayOf(monday);
  document.getElementById('order-date').value    = dateKey(monday);
  document.getElementById('delivery-date').value = dateKey(wednesday);
}

function saveDeliveryDates() {
  // Stored as part of the week's data — saved when user edits an entry
}

function getDeliveryDates() {
  return {
    orderDate:    document.getElementById('order-date').value,
    deliveryDate: document.getElementById('delivery-date').value,
  };
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
  const monday    = currentWeekStart;
  const wednesday = getWednesdayOf(monday);
  const sunday    = new Date(monday); sunday.setDate(sunday.getDate() + 6);
  const siteId    = getActiveSite();

  const wk = Math.ceil(monday.getDate() / 7);
  const mo  = monday.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  document.getElementById('week-info').textContent =
    `Week ${wk} of ${mo}`;
  document.getElementById('week-sub').textContent  =
    `${SITES[siteId]} · Order by Mon ${fmtShort(dateKey(monday))} · Delivery ${fmtShort(dateKey(wednesday))}`;
}

/* ── Load week ───────────────────────────────────────── */
async function loadWeek() {
  updateWeekHeader();
  setDeliveryBarDates();
  const siteId    = getActiveSite();
  const weekStart = dateKey(currentWeekStart);
  try {
    const entries = await api(`/api/sandwich-tracker?siteId=${siteId}&weekStart=${weekStart}`);
    trackerData = {};
    entries.forEach(e => { trackerData[e.sandwich] = e; });

    // If there's a saved delivery date from a previous entry, restore it
    const anyEntry = entries.find(e => e.deliveryDate);
    if (anyEntry) {
      if (anyEntry.orderDate)    document.getElementById('order-date').value    = anyEntry.orderDate;
      if (anyEntry.deliveryDate) document.getElementById('delivery-date').value = anyEntry.deliveryDate;
    }

    renderTable();
  } catch (err) {
    document.getElementById('tracker-container').innerHTML =
      `<div style="text-align:center;padding:3rem;color:#d1453b;">${err.message}</div>`;
  }
}

/* ── Render table ────────────────────────────────────── */
function renderTable() {
  // Header
  let thead = '<tr><th>Sandwich Name</th>';
  COLS.forEach(c => { thead += `<th>${c.label}</th>`; });
  thead += '</tr>';

  // Body
  let tbody = '';
  SANDWICHES.forEach(({ group, items }) => {
    tbody += `<tr class="group-row"><td colspan="${1 + COLS.length}">${group}</td></tr>`;
    items.forEach(sandwich => {
      const entry = trackerData[sandwich];
      tbody += `<tr><td>${sandwich}</td>`;

      COLS.forEach(col => {
        const val = entry?.[col.key];
        let display = '';

        if (val === undefined || val === null || val === '') {
          display = `<span class="placeholder">—</span>`;
        } else if (col.key === 'expiryDate') {
          display = fmtShort(val);
        } else if (col.key === 'sticker') {
          display = val === 'yes'
            ? '<span class="sticker-yes">Yes</span>'
            : val === 'no' ? '<span class="sticker-no">No</span>' : 'N/A';
        } else if (col.key === 'pdi') {
          display = val === 'yes' ? '✓' : val === 'no' ? '✗' : val;
        } else if (col.key === 'waste' && val > 0) {
          display = `<span style="color:#c2410c;font-weight:700;">${val}</span>`;
        } else {
          display = val;
        }

        const filled = entry && val !== undefined && val !== null && val !== '';
        const cls    = filled ? 'cell-filled' : 'cell-empty';
        tbody += `<td class="${cls}" data-sandwich="${encodeURIComponent(sandwich)}">${display}</td>`;
      });

      tbody += '</tr>';
    });
  });

  document.getElementById('tracker-container').innerHTML = `
    <table class="sw-table">
      <thead>${thead}</thead>
      <tbody>${tbody}</tbody>
    </table>`;

  // Wire clicks on data cells
  document.querySelectorAll('.sw-table td[data-sandwich]').forEach(cell => {
    cell.addEventListener('click', () => {
      const sandwich = decodeURIComponent(cell.dataset.sandwich);
      openEntryModal(sandwich);
    });
  });
}

/* ── Modal ───────────────────────────────────────────── */
function initModal() {
  document.getElementById('btn-entry-save').addEventListener('click', saveEntry);
}

function openEntryModal(sandwich) {
  const entry = trackerData[sandwich] || {};
  pendingSandwich = sandwich;
  pendingId       = entry._id || null;

  document.getElementById('entry-modal-title').textContent    = 'Edit Entry';
  document.getElementById('entry-sandwich-name').textContent  = sandwich;

  document.getElementById('f-order-qty').value    = entry.orderQty    ?? '';
  document.getElementById('f-received-qty').value = entry.receivedQty ?? '';
  document.getElementById('f-expiry-date').value  = entry.expiryDate  ?? '';
  document.getElementById('f-sticker').value      = entry.sticker     ?? '';
  document.getElementById('f-sales').value        = entry.sales       ?? '';
  document.getElementById('f-waste').value        = entry.waste       ?? '';
  document.getElementById('f-pdi').value          = entry.pdi         ?? '';
  document.getElementById('f-sign').value         = entry.sign        ?? '';

  // Footer — show delete if existing entry
  const footer = document.getElementById('entry-modal-footer');
  footer.innerHTML = pendingId
    ? `<button class="btn-ghost" data-bs-dismiss="modal">Cancel</button>
       <button class="btn-solid btn-solid-red" id="btn-entry-delete" onclick="deleteEntry()">Delete</button>
       <button class="btn-solid" id="btn-entry-save" onclick="saveEntry()">Save</button>`
    : `<button class="btn-ghost" data-bs-dismiss="modal">Cancel</button>
       <button class="btn-solid" id="btn-entry-save" onclick="saveEntry()">Save</button>`;

  bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-entry')).show();
}

async function saveEntry() {
  const { orderDate, deliveryDate } = getDeliveryDates();
  const siteId    = getActiveSite();
  const weekStart = dateKey(currentWeekStart);
  const sandwich  = pendingSandwich;

  const body = {
    siteId, weekStart, sandwich,
    orderDate, deliveryDate,
    orderQty:    document.getElementById('f-order-qty').value    || null,
    receivedQty: document.getElementById('f-received-qty').value || null,
    expiryDate:  document.getElementById('f-expiry-date').value  || null,
    sticker:     document.getElementById('f-sticker').value      || null,
    sales:       document.getElementById('f-sales').value        || null,
    waste:       document.getElementById('f-waste').value        || null,
    pdi:         document.getElementById('f-pdi').value          || null,
    sign:        document.getElementById('f-sign').value.trim()  || null,
  };

  try {
    if (pendingId) {
      await api(`/api/sandwich-tracker/${pendingId}`, { method: 'PUT', body });
    } else {
      await api('/api/sandwich-tracker', { method: 'POST', body });
    }
    bootstrap.Modal.getInstance(document.getElementById('modal-entry')).hide();
    loadWeek();
  } catch (e) { alert(e.message); }
}

async function deleteEntry() {
  if (!pendingId) return;
  try {
    await api(`/api/sandwich-tracker/${pendingId}`, { method: 'DELETE' });
    bootstrap.Modal.getInstance(document.getElementById('modal-entry')).hide();
    loadWeek();
  } catch (e) { alert(e.message); }
}