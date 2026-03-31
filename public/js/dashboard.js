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

  // ── Pill switcher (tablet+) ──
  document.querySelectorAll('.site-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.site === active);
    btn.addEventListener('click', () => {
      setActiveSite(btn.dataset.site);
      document.querySelectorAll('.site-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      syncDropdownLabel(btn.dataset.site);
      document.getElementById('page-title').textContent = SITES[btn.dataset.site];
      loadDashboard(true);
    });
  });

  // ── Mobile dropdown ──
  const dropBtn  = document.getElementById('site-dropdown-btn');
  const dropList = document.getElementById('site-dropdown-list');

  if (dropBtn && dropList) {
    syncDropdownLabel(active);

    dropBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = dropList.classList.toggle('open');
      dropBtn.classList.toggle('open', open);
    });

    document.addEventListener('click', () => {
      dropList.classList.remove('open');
      dropBtn.classList.remove('open');
    });

    document.querySelectorAll('.site-dropdown-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.site === active);
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const site = item.dataset.site;
        setActiveSite(site);
        document.querySelectorAll('.site-dropdown-item').forEach((i) => i.classList.remove('active'));
        item.classList.add('active');
        syncDropdownLabel(site);
        // keep pills in sync too
        document.querySelectorAll('.site-btn').forEach((b) => b.classList.toggle('active', b.dataset.site === site));
        document.getElementById('page-title').textContent = SITES[site];
        dropList.classList.remove('open');
        dropBtn.classList.remove('open');
        loadDashboard(true);
      });
    });
  }

  document.getElementById('page-title').textContent = SITES[active];
}

function syncDropdownLabel(siteId) {
  const lbl = document.getElementById('site-dropdown-label');
  if (lbl) lbl.textContent = SITES[siteId];
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
let _allSections = [];

document.addEventListener('DOMContentLoaded', () => {
  initSiteSwitcher();
  loadDashboard();
  setupAddSection();
  setupDetailModals();
  setupSearch();
});

function setupSearch() {
  const input = document.getElementById('section-search');
  if (!input) return;

  input.addEventListener('input', () => {
    filterSections(input.value.trim().toLowerCase());
  });

  // When the viewport shrinks (keyboard opened) and the search input is focused,
  // scroll the search bar to the very top so results are visible below it.
  // Using visualViewport instead of 'focus' means it fires every time the
  // keyboard opens, even if the input is already focused from a previous tap.
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      if (document.activeElement === input) {
        setTimeout(() => {
          const wrap = document.querySelector('.search-wrap');
          if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    });
  } else {
    // Fallback for browsers without visualViewport
    input.addEventListener('focus', () => {
      setTimeout(() => {
        const wrap = document.querySelector('.search-wrap');
        if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 350);
    });
  }
}

function filterSections(q) {
  const grid  = document.getElementById('sections-grid');
  if (!grid) return;
  const cards = grid.querySelectorAll('.sec-card[data-sid]');
  const empty = grid.querySelector('.search-empty');
  let visible = 0;

  cards.forEach((card) => {
    const name = (card.querySelector('.sec-name')?.textContent || '').toLowerCase();
    const loc  = (card.querySelector('.sec-loc')?.textContent || '').toLowerCase();
    const show = !q || name.includes(q) || loc.includes(q);
    card.style.display = show ? '' : 'none';
    if (show) visible++;
  });

  if (empty) empty.style.display = (visible === 0 && q) ? 'block' : 'none';
  const addCard = grid.querySelector('.add-card');
  if (addCard) addCard.style.display = '';
}

/* ── Overlay ─────────────────────────────────────────── */
function showOverlay() { document.getElementById('site-overlay').classList.add('active'); }
function hideOverlay() { document.getElementById('site-overlay').classList.remove('active'); }

/* ── Load Dashboard ──────────────────────────────────── */
async function loadDashboard(withOverlay = false) {
  const siteId = getActiveSite();
  if (withOverlay) showOverlay();
  try {
    const data = await api(`/api/dashboard?siteId=${siteId}`);
    renderSummary(data.summary);
    renderSections(data.sections);
  } catch (e) {
    document.getElementById('sections-grid').innerHTML =
      `<div style="grid-column:1/-1;text-align:center;padding:3rem 0;color:#d1453b;font-size:.87rem;">Failed to load: ${e.message}</div>`;
  } finally {
    hideOverlay();
  }
}

/* ── Summary ─────────────────────────────────────────── */
function renderSummary(s) {
  document.getElementById('sum-expiry').textContent   = s.expiryAlerts;
  document.getElementById('sum-orders').textContent   = s.pendingOrders;
  document.getElementById('sum-cleans').innerHTML =
    `<span>${s.cleansThisWeek}</span><span style="font-size:.9em;font-weight:400;opacity:.5;margin:0 1px">/</span><span>${s.totalSections}</span>`;
  document.getElementById('sum-sections').textContent = s.totalSections;
}

/* ── Sections ────────────────────────────────────────── */
function renderSections(sections) {
  const grid = document.getElementById('sections-grid');
  grid.innerHTML = '<div class="search-empty">No sections match your search.</div>';

  // Re-apply any active search after render
  const searchInput = document.getElementById('section-search');
  const activeQuery = searchInput ? searchInput.value.trim().toLowerCase() : '';

  sections.forEach((s) => {
    const card = document.createElement('div');
    card.className = 'sec-card';
    card.dataset.sid = s._id;
    card.innerHTML = `
      <button class="del-btn" data-id="${s._id}" title="Delete section">
        <i class="bi bi-trash3"></i>
      </button>
      <div class="sec-icon">${s.icon || '📦'}</div>
      <p class="sec-name">${s.name}</p>
      <p class="sec-loc">${s.location || '—'}</p>
      <div class="sec-pills">${buildPills(s)}</div>`;
    grid.appendChild(card);
  });

  // Add card
  const addCard = document.createElement('div');
  addCard.className = 'add-card';
  addCard.setAttribute('data-bs-toggle', 'modal');
  addCard.setAttribute('data-bs-target', '#modal-add-section');
  addCard.innerHTML = `<i class="bi bi-plus-circle"></i><span>Add Section</span>`;
  grid.appendChild(addCard);

  // Events — clone to clear any previous listener
  const newGrid = grid.cloneNode(true);
  grid.parentNode.replaceChild(newGrid, grid);
  newGrid.addEventListener('click', handleGridClick);

  // Re-apply search filter if user had typed something
  if (activeQuery) filterSections(activeQuery);
}

function buildPills(s) {
  let html = '';
  html += s.expiryCount > 0
    ? `<span class="pill p-red"><i class="bi bi-exclamation-circle"></i>${s.expiryCount} expiring</span>`
    : `<span class="pill p-green"><i class="bi bi-check-circle"></i>No expiry</span>`;
  html += s.orderCount > 0
    ? `<span class="pill p-amber"><i class="bi bi-cart"></i>${s.orderCount} order${s.orderCount > 1 ? 's' : ''}</span>`
    : `<span class="pill p-green"><i class="bi bi-check-circle"></i>No orders</span>`;
  html += s.cleanedThisWeek
    ? `<span class="pill p-green"><i class="bi bi-check-circle"></i>Cleaned</span>`
    : `<span class="pill p-gray"><i class="bi bi-clock"></i>Clean due</span>`;
  return html;
}

function handleGridClick(e) {
  const delBtn = e.target.closest('.del-btn');
  if (delBtn) {
    e.stopPropagation();
    if (confirm('Delete this section and ALL its data? This cannot be undone.')) {
      api(`/api/sections/${delBtn.dataset.id}`, { method: 'DELETE' }).then(() => loadDashboard());
    }
    return;
  }
  const card = e.target.closest('.sec-card[data-sid]');
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

  document.getElementById('modal-expiry-detail').addEventListener('show.bs.modal', async () => {
    const body = document.getElementById('expiry-detail-body');
    body.innerHTML = '<div class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm"></div></div>';
    try {
      const data = await api(`/api/dashboard/expiry-details?siteId=${getActiveSite()}`);
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

  document.getElementById('modal-order-detail').addEventListener('show.bs.modal', async () => {
    const body = document.getElementById('order-detail-body');
    body.innerHTML = '<div class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm"></div></div>';
    try {
      const data = await api(`/api/dashboard/order-details?siteId=${getActiveSite()}`);
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

  document.getElementById('modal-clean-detail').addEventListener('show.bs.modal', async () => {
    const body = document.getElementById('clean-detail-body');
    body.innerHTML = '<div class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm"></div></div>';
    try {
      const data = await api(`/api/dashboard/cleaning-details?siteId=${getActiveSite()}`);
      const p = data.currentPeriod;
      const monthName = new Date(p.year, p.month - 1).toLocaleString('en-US', { month: 'long' });
      // Sort: not cleaned first, cleaned at bottom
      const sorted  = [...data.details].sort((a, b) => (a.cleaned === b.cleaned) ? 0 : a.cleaned ? 1 : -1);
      const notDone = sorted.filter(d => !d.cleaned).length;
      const done    = sorted.filter(d =>  d.cleaned).length;
      let html = `<p class="text-muted small mb-3">Week ${p.week} of ${monthName} ${p.year} &nbsp;&middot;&nbsp; <span style="color:#b91c1c;font-weight:600;">${notDone} remaining</span> &nbsp;&middot;&nbsp; <span style="color:#166534;font-weight:600;">${done} done</span></p>`;
      html += '<ul class="list-group list-group-flush">';
      sorted.forEach((d) => {
        html += d.cleaned
          ? `<li class="list-group-item d-flex align-items-center gap-2" style="flex-wrap:wrap;padding:.65rem 0;">
               <span>${d.section.icon || '📦'}</span>
               <strong style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${d.section.name}</strong>
               <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex-shrink:0;">
                 <span style="font-size:.68rem;font-weight:700;padding:2px 8px;border-radius:999px;background:#dcfce7;color:#166534;">
                   <i class="bi bi-check-circle-fill me-1"></i>Cleaned
                 </span>
                 <span style="font-size:.68rem;color:#8a8880;">${d.entry.cleanedBy || '—'} · ${fmtDate(d.entry.dateCleaned)}</span>
               </div>
             </li>`
          : `<li class="list-group-item d-flex align-items-center gap-2" style="padding:.65rem 0;">
               <span>${d.section.icon || '📦'}</span>
               <strong style="flex:1;min-width:0;">${d.section.name}</strong>
               <span style="font-size:.68rem;font-weight:700;padding:2px 8px;border-radius:999px;background:#fee2e2;color:#b91c1c;flex-shrink:0;">
                 <i class="bi bi-x-circle me-1"></i>Not cleaned
               </span>
             </li>`;
      });
      html += '</ul>';
      body.innerHTML = html;
    } catch (e) { body.innerHTML = `<p class="text-danger">${e.message}</p>`; }
  });
}

/* ── Global modal actions ────────────────────────────── */
async function markExpiryRemoved(id, btn) {
  try {
    await api(`/api/expiry-logs/${id}`, { method: 'PUT', body: { removed: true, signOffBy: 'Staff' } });
    btn.closest('tr').style.opacity = '0.4';
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Done';
    loadDashboard();
  } catch (e) { alert(e.message); }
}

async function markOrderDone(id, btn) {
  try {
    await api(`/api/order-items/${id}`, { method: 'PUT', body: { ordered: true } });
    btn.closest('tr').style.opacity = '0.4';
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Done';
    loadDashboard();
  } catch (e) { alert(e.message); }
}