const API_BASE = '/api/testwash';
const now = new Date();
let currentMonth = now.getMonth();
let currentYear = now.getFullYear();
let currentLogs = [];
const monthNames = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];
const twModalEl = document.getElementById('modal-testwash');
const twModal = new bootstrap.Modal(twModalEl);
document.addEventListener('DOMContentLoaded', () => {
  populateMonthSelect();
  fetchLogs();
  document.getElementById('tw-month').addEventListener('change', (e) => {
    const [y, m] = e.target.value.split('-').map(Number);
    currentYear = y;
    currentMonth = m;
    fetchLogs();
  });
  document.getElementById('tw-search').addEventListener('input', renderTable);
  document.querySelector('[data-bs-target="#modal-testwash"]').addEventListener('click', openAddModal);
  document.getElementById('f-tw-save').addEventListener('click', saveTestwash);
});
function populateMonthSelect(){
  const select = document.getElementById('tw-month');
  select.innerHTML = '';
  // current month + 11 back = 1 year of history, plus lets them scroll forward a bit too
  const options = [];
  for (let i = -11; i <= 1; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    options.push({ year: d.getFullYear(), month: d.getMonth() });
  }
  options.reverse().forEach(opt => {
    const el = document.createElement('option');
    el.value = `${opt.year}-${opt.month}`;
    el.textContent = `${monthNames[opt.month]} ${opt.year}`;
    if (opt.year === currentYear && opt.month === currentMonth) el.selected = true;
    select.appendChild(el);
  });
}
async function fetchLogs(){
  document.getElementById('tw-table-wrap').innerHTML = '<div class="empty-state">Loading…</div>';
  try {
    const res = await fetch(`${API_BASE}?month=${currentMonth}&year=${currentYear}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to load');
    currentLogs = json.data;
    renderTable();
  } catch (err) {
    console.error(err);
    document.getElementById('tw-table-wrap').innerHTML = '<div class="empty-state">Failed to load testwash logs.</div>';
  }
}
function renderTable(){
  const search = document.getElementById('tw-search').value.trim().toLowerCase();
  const filtered = currentLogs.filter(l => {
    if (!search) return true;
    return l.issuedTo.toLowerCase().includes(search)
      || l.carwashCode.toLowerCase().includes(search)
      || l.issuedBy.toLowerCase().includes(search);
  });
  const uniqueEmployees = new Set(currentLogs.map(l => l.issuedTo.trim().toLowerCase())).size;
  document.getElementById('tw-month-summary').textContent =
    `${currentLogs.length} issued · ${uniqueEmployees} unique employee${uniqueEmployees === 1 ? '' : 's'} — ${monthNames[currentMonth]} ${currentYear}`;
  const wrap = document.getElementById('tw-table-wrap');
  if (filtered.length === 0) {
    wrap.innerHTML = `<div class="empty-state">No testwashes ${search ? 'match your search' : 'logged for this month'}.</div>`;
    return;
  }
  const rows = filtered.map(log => {
    const d = new Date(log.issuedAt);
    const dateStr = d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `
      <tr>
        <td>${dateStr}</td>
        <td>${timeStr}</td>
        <td><span class="tag tag-code">${escapeHtml(log.carwashCode)}</span></td>
        <td>${escapeHtml(log.issuedTo)}</td>
        <td>${escapeHtml(log.issuedBy)}</td>
        <td style="color:var(--muted);">${escapeHtml(log.notes || '—')}</td>
        <td style="text-align:right;">
          <button class="del-row" onclick="deleteTestwash('${log._id}')" title="Delete">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
  wrap.innerHTML = `
    <div class="table-card">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Time</th>
            <th>Code</th>
            <th>Issued To</th>
            <th>Issued By</th>
            <th>Notes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}
function escapeHtml(str){
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;').replace(/"/g,'&quot;');
}
function openAddModal(){
  document.getElementById('tw-modal-title').textContent = 'Log a Testwash';
  document.getElementById('f-tw-id').value = '';
  document.getElementById('f-tw-code').value = '';
  document.getElementById('f-tw-issued-to').value = '';
  document.getElementById('f-tw-issued-by').value = '';
  document.getElementById('f-tw-notes').value = '';
  const today = new Date();
  document.getElementById('f-tw-date').value = today.toISOString().split('T')[0];
  document.getElementById('f-tw-time').value = today.toTimeString().slice(0,5);
}
async function saveTestwash(){
  const payload = {
    carwashCode: document.getElementById('f-tw-code').value.trim(),
    date: document.getElementById('f-tw-date').value,
    time: document.getElementById('f-tw-time').value,
    issuedTo: document.getElementById('f-tw-issued-to').value.trim(),
    issuedBy: document.getElementById('f-tw-issued-by').value.trim(),
    notes: document.getElementById('f-tw-notes').value.trim()
  };
  if (!payload.carwashCode || !payload.date || !payload.time || !payload.issuedTo || !payload.issuedBy) {
    alert('Please fill in all required fields.');
    return;
  }
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Save failed');
    twModal.hide();
    const savedDate = new Date(json.data.issuedAt);
    currentMonth = savedDate.getMonth();
    currentYear = savedDate.getFullYear();
    populateMonthSelect();
    fetchLogs();
  } catch (err) {
    console.error(err);
    alert(err.message || 'Something went wrong while saving.');
  }
}
async function deleteTestwash(id){
  try {
    const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Delete failed');
    fetchLogs();
  } catch (err) {
    console.error(err);
    alert(err.message || 'Failed to delete entry.');
  }
}