/* ── Site management ─────────────────────────────────── */
const SITES = {
  C01158: '96 Shell',
  C01288: 'Riverside Shell',
  C09066: '72 Shell',
};

function getActiveSite() {
  return localStorage.getItem('activeSiteId') || 'C01158';
}

function setActiveSite(siteId) {
  localStorage.setItem('activeSiteId', siteId);
}

function initSiteSwitcher() {
  const active = getActiveSite();
  document.querySelectorAll('.site-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.site === active);
    btn.addEventListener('click', () => {
      setActiveSite(btn.dataset.site);
      document.querySelectorAll('.site-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('page-title').textContent = SITES[btn.dataset.site] + ' — Sections';
      loadDashboard();
    });
  });
  document.getElementById('page-title').textContent = SITES[active] + ' — Sections';
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

/* ── Init ────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initSiteSwitcher();
  loadDashboard();
  setupAddSection();
  setupDetailModals();
});

/* ── Load Dashboard ──────────────────────────────────── */
async function loadDashboard() {
  const siteId = getActiveSite();
  try {
    const data = await api(`/api/dashboard?siteId=${siteId}`);
    renderSummary(data.summary);
    renderSections(data.sections);
  } catch (e) {
    document.getElementById('sections-grid').innerHTML =
      `<div class="col-12 text-center py-5 text-danger">Failed to load: ${e.message}</div>`;
  }
}

/* ── Summary Bar ─────────────────────────────────────── */
function renderSummary(s) {
  document.getElementById('sum-expiry').textContent   = s.expiryAlerts;
  document.getElementById('sum-orders').textContent   = s.pendingOrders;
  document.getElementById('sum-cleans').textContent   = `${s.cleansThisWeek}/${s.totalSections}`;
  document.getElementById('sum-sections').textContent = s.totalSections;
}

/* ── Section Cards ───────────────────────────────────── */
function renderSections(sections) {
  const grid = document.getElementById('sections-grid');
  grid.innerHTML = '';

  if (sections.length === 0) {
    grid.innerHTML = `
      <div class="col-12 text-center py-5 text-muted">
        No sections yet. Add your first section below.
      </div>`;
  }

  sections.forEach((s) => {
    const pills = buildPills(s);
    const col = document.createElement('div');
    col.className = 'col-12 col-md-6 col-lg-4';
    col.innerHTML = `
      <div class="card section-card p-3 position-relative" data-sid="${s._id}">
        <button class="btn btn-sm position-absolute top-0 end-0 m-2 delete-section-btn" data-id="${s._id}" title="Delete section">
          <i class="bi bi-trash3 text-muted"></i>
        </button>
        <div class="d-flex align-items-center gap-3 mb-3">
          <div class="section-icon">${s.icon || '📦'}</div>
          <div>
            <h5 class="mb-0 fw-semibold">${s.name}</h5>
            <small class="text-muted">${s.location || ''}</small>
          </div>
        </div>
        <div class="d-flex flex-wrap gap-2">${pills}</div>
      </div>`;
    grid.appendChild(col);
  });

  // "Add Section" card
  const addCol = document.createElement('div');
  addCol.className = 'col-12 col-md-6 col-lg-4';
  addCol.innerHTML = `
    <div class="card section-card add-card p-3 d-flex align-items-center justify-content-center text-center"
         data-bs-toggle="modal" data-bs-target="#modal-add-section">
      <i class="bi bi-plus-circle fs-1 text-muted"></i>
      <div class="text-muted mt-2 small fw-semibold">Add Section</div>
    </div>`;
  grid.appendChild(addCol);

  // Remove old listener to avoid duplicates, re-add fresh
  const newGrid = grid.cloneNode(true);
  grid.parentNode.replaceChild(newGrid, grid);
  newGrid.addEventListener('click', handleGridClick);
}

function buildPills(s) {
  let html = '';
  if (s.expiryCount > 0) {
    html += `<span class="stat-pill bg-danger bg-opacity-10 text-danger"><i class="bi bi-exclamation-circle me-1"></i>${s.expiryCount} expiring</span>`;
  } else {
    html += `<span class="stat-pill bg-success bg-opacity-10 text-success"><i class="bi bi-check-circle me-1"></i>No expiry</span>`;
  }
  if (s.orderCount > 0) {
    html += `<span class="stat-pill bg-warning bg-opacity-10 text-warning"><i class="bi bi-cart me-1"></i>${s.orderCount} order${s.orderCount > 1 ? 's' : ''}</span>`;
  } else {
    html += `<span class="stat-pill bg-success bg-opacity-10 text-success"><i class="bi bi-check-circle me-1"></i>No orders</span>`;
  }
  if (s.cleanedThisWeek) {
    html += `<span class="stat-pill bg-success bg-opacity-10 text-success"><i class="bi bi-check-circle me-1"></i>Cleaned</span>`;
  } else {
    html += `<span class="stat-pill bg-secondary bg-opacity-10 text-secondary"><i class="bi bi-clock me-1"></i>Clean due</span>`;
  }
  return html;
}

function handleGridClick(e) {
  // Delete button
  const delBtn = e.target.closest('.delete-section-btn');
  if (delBtn) {
    e.stopPropagation();
    const id = delBtn.dataset.id;
    if (confirm('Delete this section and ALL its data? This cannot be undone.')) {
      api(`/api/sections/${id}`, { method: 'DELETE' }).then(() => loadDashboard());
    }
    return;
  }
  // Card click → navigate (pass siteId so section page knows which site it belongs to)
  const card = e.target.closest('.section-card[data-sid]');
  if (card) {
    window.location = `section.html?id=${card.dataset.sid}&siteId=${getActiveSite()}`;
  }
}

/* ── Add Section ─────────────────────────────────────── */
function setupAddSection() {
  document.getElementById('add-sec-save').addEventListener('click', async () => {
    const name     = document.getElementById('add-sec-name').value.trim();
    const icon     = document.getElementById('add-sec-icon').value.trim();
    const location = document.getElementById('add-sec-location').value.trim();
    const siteId   = getActiveSite();
    if (!name) return alert('Section name is required.');
    try {
      await api('/api/sections', { method: 'POST', body: { name, icon, location, siteId } });
      bootstrap.Modal.getInstance(document.getElementById('modal-add-section')).hide();
      document.getElementById('add-sec-name').value     = '';
      document.getElementById('add-sec-icon').value     = '';
      document.getElementById('add-sec-location').value = '';
      loadDashboard();
    } catch (e) { alert(e.message); }
  });
}

/* ── Detail Modals ───────────────────────────────────── */
function setupDetailModals() {

  // ── Expiry Detail ──
  document.getElementById('modal-expiry-detail').addEventListener('show.bs.modal', async () => {
    const siteId = getActiveSite();
    const body = document.getElementById('expiry-detail-body');
    body.innerHTML = '<div class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm"></div></div>';
    try {
      const data = await api(`/api/dashboard/expiry-details?siteId=${siteId}`);
      if (data.length === 0) {
        body.innerHTML = '<p class="text-center text-success py-3"><i class="bi bi-check-circle me-2"></i>No expiry alerts!</p>';
        return;
      }
      let html = '<div class="accordion" id="expiry-acc">';
      data.forEach((group, i) => {
        html += `
          <div class="accordion-item border-0 mb-2">
            <h2 class="accordion-header">
              <button class="accordion-button ${i > 0 ? 'collapsed' : ''} fw-semibold" type="button"
                      data-bs-toggle="collapse" data-bs-target="#exp-c-${i}">
                ${group.section.icon || '📦'} ${group.section.name}
                <span class="badge bg-danger ms-auto me-2">${group.items.length}</span>
              </button>
            </h2>
            <div id="exp-c-${i}" class="accordion-collapse collapse ${i === 0 ? 'show' : ''}" data-bs-parent="#expiry-acc">
              <div class="accordion-body p-0">
                <table class="table table-sm mb-0">
                  <thead class="table-light"><tr>
                    <th class="ps-3" style="font-size:.75rem">ITEM</th>
                    <th style="font-size:.75rem">EXPIRY DATE</th>
                    <th style="font-size:.75rem">ACTION</th>
                  </tr></thead>
                  <tbody>
                    ${group.items.map(item => `
                      <tr>
                        <td class="ps-3">${item.item}</td>
                        <td class="text-danger fw-semibold">${fmtDate(item.expiryDate)}</td>
                        <td>
                          <button class="btn btn-success btn-sm py-0 px-2" style="font-size:.75rem"
                                  onclick="markExpiryRemoved('${item._id}',this)">
                            <i class="bi bi-check me-1"></i>Remove
                          </button>
                        </td>
                      </tr>`).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>`;
      });
      html += '</div>';
      body.innerHTML = html;
    } catch (e) { body.innerHTML = `<p class="text-danger">${e.message}</p>`; }
  });

  // ── Order Detail ──
  document.getElementById('modal-order-detail').addEventListener('show.bs.modal', async () => {
    const siteId = getActiveSite();
    const body = document.getElementById('order-detail-body');
    body.innerHTML = '<div class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm"></div></div>';
    try {
      const data = await api(`/api/dashboard/order-details?siteId=${siteId}`);
      if (data.length === 0) {
        body.innerHTML = '<p class="text-center text-success py-3"><i class="bi bi-check-circle me-2"></i>No pending orders!</p>';
        return;
      }
      let html = '<div class="accordion" id="order-acc">';
      data.forEach((group, i) => {
        html += `
          <div class="accordion-item border-0 mb-2">
            <h2 class="accordion-header">
              <button class="accordion-button ${i > 0 ? 'collapsed' : ''} fw-semibold" type="button"
                      data-bs-toggle="collapse" data-bs-target="#ord-c-${i}">
                ${group.section.icon || '📦'} ${group.section.name}
                <span class="badge bg-warning text-dark ms-auto me-2">${group.items.length}</span>
              </button>
            </h2>
            <div id="ord-c-${i}" class="accordion-collapse collapse ${i === 0 ? 'show' : ''}" data-bs-parent="#order-acc">
              <div class="accordion-body p-0">
                <table class="table table-sm mb-0">
                  <thead class="table-light"><tr>
                    <th class="ps-3" style="font-size:.75rem">ITEM</th>
                    <th style="font-size:.75rem">COMMENTS</th>
                    <th style="font-size:.75rem">ACTION</th>
                  </tr></thead>
                  <tbody>
                    ${group.items.map(item => `
                      <tr>
                        <td class="ps-3">${item.item}</td>
                        <td class="text-muted small">${item.comments || '—'}</td>
                        <td>
                          <button class="btn btn-success btn-sm py-0 px-2" style="font-size:.75rem"
                                  onclick="markOrderDone('${item._id}',this)">
                            <i class="bi bi-check me-1"></i>Ordered
                          </button>
                        </td>
                      </tr>`).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>`;
      });
      html += '</div>';
      body.innerHTML = html;
    } catch (e) { body.innerHTML = `<p class="text-danger">${e.message}</p>`; }
  });

  // ── Cleaning Detail ──
  document.getElementById('modal-clean-detail').addEventListener('show.bs.modal', async () => {
    const siteId = getActiveSite();
    const body = document.getElementById('clean-detail-body');
    body.innerHTML = '<div class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm"></div></div>';
    try {
      const data = await api(`/api/dashboard/cleaning-details?siteId=${siteId}`);
      const p = data.currentPeriod;
      const monthName = new Date(p.year, p.month - 1).toLocaleString('en-US', { month: 'long' });
      let html = `<p class="text-muted small mb-3">Week ${p.week} of ${monthName} ${p.year}</p>`;
      html += '<ul class="list-group list-group-flush">';
      data.details.forEach((d) => {
        if (d.cleaned) {
          html += `
            <li class="list-group-item d-flex align-items-center">
              <span class="me-2">${d.section.icon || '📦'}</span>
              <strong>${d.section.name}</strong>
              <span class="ms-auto badge bg-success bg-opacity-15 text-success">
                <i class="bi bi-check-circle-fill me-1"></i>Cleaned by ${d.entry.cleanedBy || '—'} · ${fmtDate(d.entry.dateCleaned)}
              </span>
            </li>`;
        } else {
          html += `
            <li class="list-group-item d-flex align-items-center">
              <span class="me-2">${d.section.icon || '📦'}</span>
              <strong>${d.section.name}</strong>
              <span class="ms-auto badge bg-danger bg-opacity-10 text-danger">
                <i class="bi bi-x-circle me-1"></i>Not cleaned
              </span>
            </li>`;
        }
      });
      html += '</ul>';
      body.innerHTML = html;
    } catch (e) { body.innerHTML = `<p class="text-danger">${e.message}</p>`; }
  });
}

/* ── Global actions called from modal onclick ────────── */
async function markExpiryRemoved(id, btn) {
  try {
    await api(`/api/expiry-logs/${id}`, { method: 'PUT', body: { removed: true, signOffBy: 'Staff' } });
    const row = btn.closest('tr');
    row.style.opacity = '0.4';
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Done';
    loadDashboard();
  } catch (e) { alert(e.message); }
}

async function markOrderDone(id, btn) {
  try {
    await api(`/api/order-items/${id}`, { method: 'PUT', body: { ordered: true } });
    const row = btn.closest('tr');
    row.style.opacity = '0.4';
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Done';
    loadDashboard();
  } catch (e) { alert(e.message); }
}