const API_BASE = '/api/testwash';
const now = new Date();
let currentMonth = now.getMonth();
let currentYear = now.getFullYear();
let currentLogs = [];
const monthNames = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];
const twModalEl = document.getElementById('modal-testwash');
const twModal = new bootstrap.Modal(twModalEl);
const twWarningEl = document.getElementById('modal-tw-warning');
const twWarningModal = new bootstrap.Modal(twWarningEl);
document.addEventListener('DOMContentLoaded', () => {
  populateMonthSelect();
  fetchLogs();
  document.getElementById('tw-month').addEventListener('change', (e) => {
    const [y, m] = e.target.value.split('-').map(Number);
    currentYear = y;
    currentMonth = m;
    fetchLogs();
  });
  document.getElementById('tw-prev-month').addEventListener('click', () => navigateMonth(-1));
  document.getElementById('tw-next-month').addEventListener('click', () => navigateMonth(1));
  document.getElementById('tw-today-btn').addEventListener('click', () => {
    currentMonth = now.getMonth();
    currentYear = now.getFullYear();
    populateMonthSelect();
    fetchLogs();
  });
  document.getElementById('tw-search').addEventListener('input', renderTable);
  document.querySelector('[data-bs-target="#modal-testwash"]').addEventListener('click', openAddModal);
  document.getElementById('f-tw-save').addEventListener('click', handleSaveClick);
  document.getElementById('tw-warning-back').addEventListener('click', () => {
    twWarningModal.hide();
    twModal.show();
  });
  document.getElementById('tw-warning-continue').addEventListener('click', () => {
    twWarningModal.hide();
    doSave();
  });
});
function navigateMonth(delta){
  currentMonth += delta;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  populateMonthSelect();
  fetchLogs();
}
function populateMonthSelect(){
  const select = document.getElementById('tw-month');
  select.innerHTML = '';
  const options = [];
  for (let i = -11; i <= 1; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    options.push({ year: d.getFullYear(), month: d.getMonth() });
  }
  // Make sure whatever month we've navigated to is always present as an option,
  // even if it's outside the default -11/+1 range.
  if (!options.some(o => o.year === currentYear && o.month === currentMonth)) {
    options.push({ year: currentYear, month: currentMonth });
  }
  options.sort((a, b) => (a.year - b.year) || (a.month - b.month));
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
/**
 * Normalizes a name for comparison: lowercase + trimmed + collapsed whitespace.
 */
function normalizeName(name){
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}
/**
 * Checks if the given "issuedTo" name fuzzily matches anyone already
 * logged this month. Catches exact matches regardless of case,
 * and partial matches like "john" vs "john sylva".
 */
function findPossibleDuplicate(issuedToRaw){
  const normalized = normalizeName(issuedToRaw);
  if (!normalized) return null;
  return currentLogs.find(log => {
    const existing = normalizeName(log.issuedTo);
    if (!existing) return false;
    return existing === normalized
      || existing.includes(normalized)
      || normalized.includes(existing);
  }) || null;
}
function handleSaveClick(){
  const issuedTo = document.getElementById('f-tw-issued-to').value.trim();
  const carwashCode = document.getElementById('f-tw-code').value.trim();
  const date = document.getElementById('f-tw-date').value;
  const time = document.getElementById('f-tw-time').value;
  const issuedBy = document.getElementById('f-tw-issued-by').value.trim();
  if (!carwashCode || !date || !time || !issuedTo || !issuedBy) {
    alert('Please fill in all required fields.');
    return;
  }
  const duplicate = findPossibleDuplicate(issuedTo);
  if (duplicate) {
    const sameName = normalizeName(duplicate.issuedTo) === normalizeName(issuedTo);
    const text = sameName
      ? `<strong>${escapeHtml(duplicate.issuedTo)}</strong> has already been issued a testwash this month (Code: ${escapeHtml(duplicate.carwashCode)}).`
      : `<strong>${escapeHtml(duplicate.issuedTo)}</strong> — a similarly named employee — has already been issued a testwash this month. Just making sure this isn't a duplicate entry for the same person.`;
    document.getElementById('tw-warning-text').innerHTML = text;
    twModal.hide();
    // small delay so the bootstrap modal transition doesn't collide
    setTimeout(() => twWarningModal.show(), 200);
    return;
  }
  doSave();
}
async function doSave(){
  const payload = {
    carwashCode: document.getElementById('f-tw-code').value.trim(),
    date: document.getElementById('f-tw-date').value,
    time: document.getElementById('f-tw-time').value,
    issuedTo: document.getElementById('f-tw-issued-to').value.trim(),
    issuedBy: document.getElementById('f-tw-issued-by').value.trim(),
    notes: document.getElementById('f-tw-notes').value.trim()
  };
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