/**
 * nav.js — shared navigation component
 * Include this script in any inner page. It will:
 *  1. Inject the topbar home/landing icons
 *  2. Inject the offcanvas menu with all nav links
 *  3. Handle site switching
 *
 * Usage: <script src="js/nav.js"></script>
 * Requires Bootstrap 5 and Bootstrap Icons to already be loaded.
 *
 * Each page sets window.NAV_ACTIVE to highlight the current page:
 *   window.NAV_ACTIVE = 'daily-checklist';
 * Valid values: 'daily-checklist', 'shift-checklist', 'weekly-checklist',
 *               'weekly-report', 'sandwich-tracker', 'schedule', 'section'
 */

(function () {
  const SITES = { C01158: '96 Shell', C01288: 'Riverside Shell', C09066: '72 Shell' };

  function getActiveSite() { return localStorage.getItem('activeSiteId') || 'C01158'; }
  function setActiveSite(id) { localStorage.setItem('activeSiteId', id); }

  /* ── Inject topbar ── */
  function injectTopbar() {
    const existing = document.getElementById('shared-topbar');
    if (existing) return; // already injected

    const siteId = getActiveSite();

    const topbar = document.createElement('div');
    topbar.id = 'shared-topbar';
    topbar.className = 'topbar';
    topbar.innerHTML = `
      <!-- Left: nav icons -->
      <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
        <button class="icon-btn" title="Landing Page" onclick="window.location='/'">
          <i class="bi bi-house-fill" style="font-size:.9rem;"></i>
        </button>
        <button class="icon-btn" title="All Sections" onclick="window.location='/dashboard.html'">
          <i class="bi bi-grid-fill" style="font-size:.9rem;"></i>
        </button>
      </div>

      <!-- Centre: site switcher (tablet+) -->
      <div class="site-switcher" id="site-switcher">
        <button class="site-btn${siteId === 'C01158' ? ' active' : ''}" data-site="C01158">96 Shell</button>
        <button class="site-btn${siteId === 'C01288' ? ' active' : ''}" data-site="C01288">Riverside Shell</button>
        <button class="site-btn${siteId === 'C09066' ? ' active' : ''}" data-site="C09066">72 Shell</button>
      </div>

      <!-- Centre: site dropdown (mobile) -->
      <div class="site-dropdown-wrap" id="site-dropdown-wrap">
        <button class="site-dropdown-btn" id="site-dropdown-btn">
          <span id="site-dropdown-label">${SITES[siteId]}</span>
          <i class="bi bi-chevron-down"></i>
        </button>
        <div class="site-dropdown-list" id="site-dropdown-list">
          <button class="site-dropdown-item${siteId === 'C01158' ? ' active' : ''}" data-site="C01158">96 Shell</button>
          <button class="site-dropdown-item${siteId === 'C01288' ? ' active' : ''}" data-site="C01288">Riverside Shell</button>
          <button class="site-dropdown-item${siteId === 'C09066' ? ' active' : ''}" data-site="C09066">72 Shell</button>
        </div>
      </div>

      <!-- Right: hamburger -->
      <button class="hamburger-btn" data-bs-toggle="offcanvas" data-bs-target="#offcanvas-menu" style="flex-shrink:0;">
        <i class="bi bi-list"></i>
      </button>`;

    // Insert before first child of body
    document.body.insertBefore(topbar, document.body.firstChild);
  }

  /* ── Inject offcanvas ── */
  function injectOffcanvas() {
    if (document.getElementById('offcanvas-menu')) return;
    const active = window.NAV_ACTIVE || '';
    const siteId = getActiveSite();

    // Hide sandwich tracker for 72 Shell
    const hideSandwich = siteId === 'C09066' ? 'style="display:none;"' : '';

    const el = document.createElement('div');
    el.className = 'offcanvas offcanvas-end';
    el.id = 'offcanvas-menu';
    el.setAttribute('tabindex', '-1');
    el.innerHTML = `
      <div class="offcanvas-header">
        <h5 class="offcanvas-title">Menu</h5>
        <button type="button" class="btn-close" data-bs-dismiss="offcanvas"></button>
      </div>
      <div class="offcanvas-body p-0" style="display:flex;flex-direction:column;height:100%;overflow:hidden;">
        <div style="flex:1;overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;scrollbar-color:var(--border) transparent;">
        <div class="menu-label">Navigate</div>
        <button class="menu-item" onclick="window.location='/dashboard.html'" data-bs-dismiss="offcanvas">
          <i class="bi bi-grid"></i> All Sections
        </button>
        <button class="menu-item" onclick="window.location='/'" data-bs-dismiss="offcanvas">
          <i class="bi bi-house"></i> Landing Page
        </button>

        <div class="menu-label">Daily Operations</div>
        <button class="menu-item${active === 'daily-checklist' ? ' active-page' : ''}" onclick="window.location='/daily-checklist.html'" data-bs-dismiss="offcanvas">
          <i class="bi bi-list-check"></i> Daily Checklist
        </button>
        <button class="menu-item${active === 'shift-checklist' ? ' active-page' : ''}" onclick="window.location='/shift-checklist.html'" data-bs-dismiss="offcanvas">
          <i class="bi bi-clipboard-check"></i> Shift Checklist
        </button>
        <button class="menu-item${active === 'weekly-checklist' ? ' active-page' : ''}" onclick="window.location='/weekly-checklist.html'" data-bs-dismiss="offcanvas">
          <i class="bi bi-calendar-week"></i> Weekly Checklist
        </button>

        <div class="menu-label">Manager</div>
        <button class="menu-item${active === 'weekly-report' ? ' active-page' : ''}" onclick="window.location='/weekly-report.html'" data-bs-dismiss="offcanvas">
          <i class="bi bi-file-earmark-bar-graph"></i> Weekly Report
        </button>
        <button class="menu-item${active === 'sandwich-tracker' ? ' active-page' : ''}" onclick="window.location='/sandwich-tracker.html'" data-bs-dismiss="offcanvas" ${hideSandwich}>
          <i class="bi bi-egg-fried"></i> Sandwich Tracker
        </button>
        <button class="menu-item${active === 'schedule' ? ' active-page' : ''}" onclick="window.location='/schedule.html'" data-bs-dismiss="offcanvas">
          <i class="bi bi-calendar-plus"></i> Upload Schedule
        </button>

        </div><!-- /scroll-area -->
      </div>
      <div style="flex-shrink:0;border-top:1px solid var(--border);padding:1rem 1.4rem;background:var(--bg);">
        <p style="font-size:.76rem;color:var(--muted);margin:0 0 .5rem;">Made by <a href="https://www.abhishekchouhan.dev" target="_blank" rel="noopener" style="color:var(--text);font-weight:600;text-decoration:none;">Abhishek</a></p>
        <a href="https://www.abhishekchouhan.dev" target="_blank" rel="noopener"
           style="display:inline-flex;align-items:center;gap:5px;font-size:.76rem;font-weight:600;color:var(--text);text-decoration:none;padding:5px 10px;border:1.5px solid var(--border);border-radius:8px;">
          abhishekchouhan.dev <i class="bi bi-arrow-up-right" style="font-size:.7rem;"></i>
        </a>
      </div>`;

    document.body.appendChild(el);
  }

  /* ── Inject shared CSS ── */
  function injectStyles() {
    if (document.getElementById('nav-shared-styles')) return;
    const style = document.createElement('style');
    style.id = 'nav-shared-styles';
    style.textContent = `
      .icon-btn {
        width: 34px; height: 34px; border-radius: 9px;
        border: 1.5px solid #e4e2dc; background: #ffffff;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: all .15s; color: #1a1a18;
        font-size: .9rem; flex-shrink: 0; padding: 0;
        -webkit-tap-highlight-color: transparent;
      }
      .icon-btn:hover, .icon-btn:active { border-color: #1a1a18; background: #1a1a18; color: #fff; }
    `;
    document.head.appendChild(style);
  }

  /* ── Site switcher logic ── */
  function initSiteSwitcher() {
    const overlay = document.getElementById('site-overlay');
    const reload  = () => { if (overlay) overlay.classList.add('active'); setTimeout(() => window.location.reload(), 120); };

    document.querySelectorAll('.site-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        setActiveSite(btn.dataset.site);
        reload();
      });
    });

    const dropBtn  = document.getElementById('site-dropdown-btn');
    const dropList = document.getElementById('site-dropdown-list');
    if (dropBtn && dropList) {
      dropBtn.addEventListener('click', e => {
        e.stopPropagation();
        dropList.classList.toggle('open');
        dropBtn.classList.toggle('open', dropList.classList.contains('open'));
      });
      document.addEventListener('click', () => {
        dropList.classList.remove('open');
        dropBtn.classList.remove('open');
      });
      document.querySelectorAll('.site-dropdown-item').forEach(item => {
        item.addEventListener('click', e => {
          e.stopPropagation();
          setActiveSite(item.dataset.site);
          reload();
        });
      });
    }
  }

  /* ── Update page title with site name ── */
  function updatePageTitle() {
    const el = document.getElementById('page-title');
    if (!el) return;
    const siteId = getActiveSite();
    const siteName = SITES[siteId];
    // Only append if not already there
    if (!el.textContent.includes(siteName)) {
      el.textContent = el.textContent + ` — ${siteName}`;
    }
  }

  /* ── Boot ── */
  function boot() {
    injectStyles();
    injectTopbar();
    injectOffcanvas();
    initSiteSwitcher();
    // Let page JS run first, then update title
    setTimeout(updatePageTitle, 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();