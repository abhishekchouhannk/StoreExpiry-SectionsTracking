const SITES     = { C01158: '96 Shell', C01288: 'Riverside Shell', C09066: '72 Shell' };
const PASSWORDS = { C01158: 'C01158', C01288: 'C01288', C09066: 'C09066' };

let selectedFile   = null;
let parsedSchedule = null;

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
    `Upload Schedule — ${SITES[active]}`;
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

function dateKey(date) { return date.toISOString().split('T')[0]; }

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ── Password ────────────────────────────────────────── */
function checkPassword() {
  const siteId  = getActiveSite();
  const input   = document.getElementById('lock-input').value.trim();
  const correct = PASSWORDS[siteId];
  if (input === correct) {
    document.getElementById('lock-screen').style.display  = 'none';
    document.getElementById('main-content').style.display = 'block';
    loadHistory();
  } else {
    document.getElementById('lock-error').textContent = 'Incorrect password. Try again.';
    document.getElementById('lock-input').value = '';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initSiteSwitcher();
  // Allow Enter key on lock screen
  document.getElementById('lock-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') checkPassword();
  });
  initUpload();
});

/* ── Upload / drag & drop ────────────────────────────── */
function initUpload() {
  const area  = document.getElementById('upload-area');
  const input = document.getElementById('file-input');

  input.addEventListener('change', (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
  });

  area.addEventListener('dragover', (e) => {
    e.preventDefault();
    area.classList.add('dragover');
  });
  area.addEventListener('dragleave', () => area.classList.remove('dragover'));
  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
}

function handleFile(file) {
  if (!file.type.startsWith('image/')) return alert('Please upload an image file.');
  selectedFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('preview-img').src = e.target.result;
    document.getElementById('preview-wrap').style.display = 'block';
    document.getElementById('upload-area').style.display  = 'none';
  };
  reader.readAsDataURL(file);
}

function clearImage() {
  selectedFile = null;
  parsedSchedule = null;
  document.getElementById('preview-wrap').style.display = 'none';
  document.getElementById('upload-area').style.display  = 'block';
  document.getElementById('preview-img').src = '';
  document.getElementById('file-input').value = '';
  document.getElementById('result-wrap').classList.remove('show');
  document.getElementById('status-card').classList.remove('show');
}

/* ── Parse with Claude ───────────────────────────────── */
async function parseSchedule() {
  if (!selectedFile) return;

  const btn    = document.getElementById('btn-parse');
  const status = document.getElementById('status-card');

  btn.disabled    = true;
  btn.textContent = 'Parsing…';
  status.className = 'status-card processing show';
  status.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Claude is reading the schedule image…';

  try {
    // Convert image to base64
    const base64 = await fileToBase64(selectedFile);
    const mimeType = selectedFile.type;

    // Send to server which calls Claude Vision
    const result = await api('/api/schedule/parse', {
      method: 'POST',
      body: { image: base64, mimeType, siteId: getActiveSite() }
    });

    parsedSchedule = result.schedule;
    status.className = 'status-card success show';
    status.innerHTML = `<i class="bi bi-check-circle me-2"></i>Parsed successfully — ${parsedSchedule.length} people found. Review below then save.`;

    renderParsedResult(parsedSchedule, result.weekStart);
  } catch (e) {
    status.className = 'status-card error show';
    status.innerHTML = `<i class="bi bi-x-circle me-2"></i>Error: ${e.message}`;
  } finally {
    btn.disabled    = false;
    btn.innerHTML   = '<i class="bi bi-magic me-1"></i> Parse with Claude';
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ── Render parsed result ────────────────────────────── */
function renderParsedResult(schedule, weekStart) {
  const wrap = document.getElementById('result-wrap');
  const sunday = new Date(weekStart + 'T12:00:00');
  sunday.setDate(sunday.getDate() + 6);

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;">
      <div>
        <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:.88rem;">Parsed Schedule</div>
        <div style="font-size:.76rem;color:var(--muted);">${fmtDate(weekStart)} – ${fmtDate(sunday)}</div>
      </div>
      <button class="btn-solid" onclick="saveSchedule()"><i class="bi bi-cloud-upload me-1"></i>Save Schedule</button>
    </div>`;

  schedule.forEach(person => {
    html += `<div class="person-card">
      <div class="person-name">${person.name}</div>
      <div class="shift-pills">`;
    person.shifts.forEach(s => {
      const cls = s.hours > 0 ? 'shift-pill working' : 'shift-pill off';
      const lbl = s.hours > 0 ? `${s.day}: ${s.start}–${s.end}` : `${s.day}: off`;
      html += `<span class="${cls}">${lbl}</span>`;
    });
    html += `</div></div>`;
  });

  wrap.innerHTML = html;
  wrap.classList.add('show');
}

/* ── Save schedule to DB ─────────────────────────────── */
async function saveSchedule() {
  if (!parsedSchedule) return;
  try {
    await api('/api/schedule', {
      method: 'POST',
      body: { siteId: getActiveSite(), schedule: parsedSchedule }
    });
    document.getElementById('status-card').className = 'status-card success show';
    document.getElementById('status-card').innerHTML =
      '<i class="bi bi-check-circle me-2"></i>Schedule saved! The landing page will now greet staff by name.';
    clearImage();
    loadHistory();
  } catch (e) { alert(e.message); }
}

/* ── History ─────────────────────────────────────────── */
async function loadHistory() {
  const siteId = getActiveSite();
  try {
    const schedules = await api(`/api/schedule?siteId=${siteId}`);
    if (!schedules.length) {
      document.getElementById('history-wrap').innerHTML = '';
      return;
    }
    let html = '<div class="history-title">Saved Schedules</div>';
    schedules.forEach(s => {
      const sunday = new Date(s.weekStart + 'T12:00:00');
      sunday.setDate(sunday.getDate() + 6);
      html += `
        <div class="history-item">
          <div>
            <div style="font-weight:600;font-size:.84rem;">${fmtDate(s.weekStart)} – ${fmtDate(sunday)}</div>
            <span>${s.schedule.length} people · uploaded ${fmtDate(s.createdAt)}</span>
          </div>
          <button class="del-history" onclick="deleteSchedule('${s._id}')" title="Delete">
            <i class="bi bi-trash3"></i>
          </button>
        </div>`;
    });
    document.getElementById('history-wrap').innerHTML = html;
  } catch (e) { console.error(e); }
}

async function deleteSchedule(id) {
  if (!confirm('Delete this schedule?')) return;
  try {
    await api(`/api/schedule/${id}`, { method: 'DELETE' });
    loadHistory();
  } catch (e) { alert(e.message); }
}