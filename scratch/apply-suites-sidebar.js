const fs = require('fs');

const appPath = 'dashboard/public/app.js';
let content = fs.readFileSync(appPath, 'utf8');

// 1. Add renderSuitesSidebarList function before renderSuiteDropdown
const sidebarListFunction = `
function renderSuitesSidebarList() {
  const container = $('#suites-sidebar-list');
  const countEl = $('#suites-total-count');
  const railCountEl = $('#suites-rail-count');
  if (!container) return;

  const entries = Object.entries(suitesCache);
  if (countEl) countEl.textContent = entries.length;
  if (railCountEl) railCountEl.textContent = entries.length;

  const query = (currentSuiteSearch || '').toLowerCase().trim();
  const filter = currentSuiteFilter || 'all';

  const filtered = entries.filter(([id, suite]) => {
    const isComp = suite.type === 'composite';
    const plat = isComp ? 'composite' : (suite.platform || (suite.project === 'mobile-chrome' ? 'mobile' : 'desktop'));

    if (filter === 'composite' && !isComp) return false;
    if (filter === 'desktop' && (isComp || plat === 'mobile')) return false;
    if (filter === 'mobile' && (isComp || plat !== 'mobile')) return false;

    if (query) {
      const matchKey = id.toLowerCase().includes(query);
      const matchLabel = (suite.label || '').toLowerCase().includes(query);
      const matchGrep = (suite.grep || '').toLowerCase().includes(query);
      const matchDesc = (suite.description || '').toLowerCase().includes(query);
      const matchProject = (suite.project || '').toLowerCase().includes(query);
      if (!matchKey && !matchLabel && !matchGrep && !matchDesc && !matchProject) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = \`
      <div style="padding: 24px 12px; text-align: center; color: var(--muted); font-size: 12px;">
        <i class="ph-bold ph-stack" style="font-size: 24px; display: block; margin-bottom: 6px; opacity: 0.6;"></i>
        Không tìm thấy Test Suite phù hợp
      </div>
    \`;
    return;
  }

  container.innerHTML = filtered.map(([id, suite]) => {
    const isSelected = id === currentSelectedSuiteId;
    const isComp = suite.type === 'composite';
    const plat = isComp ? 'composite' : (suite.platform || (suite.project === 'mobile-chrome' ? 'mobile' : 'desktop'));
    const label = suite.label || id;
    const workers = suite.workers || 2;

    let badgeHtml = '';
    let detailMeta = '';

    if (isComp) {
      const childCount = Array.isArray(suite.suites) ? suite.suites.length : 0;
      badgeHtml = \`<span class="suite-nav-badge suite-badge-composite"><i class="ph-bold ph-lightning"></i> Suite Cha</span>\`;
      detailMeta = \`
        <span class="suite-nav-badge suite-badge-proj"><i class="ph-bold ph-stack"></i> \${childCount} con</span>
        <span class="suite-nav-badge suite-badge-count"><i class="ph-bold ph-cpu"></i> \${workers}W</span>
      \`;
    } else if (plat === 'mobile') {
      badgeHtml = \`<span class="suite-nav-badge suite-badge-mobile"><i class="ph-bold ph-device-mobile"></i> Mobile</span>\`;
      const specCount = Array.isArray(suite.specs) ? suite.specs.length : (suite.specs === 'all' || !suite.specs ? 'All specs' : '1 spec');
      detailMeta = \`
        <span class="suite-nav-badge suite-badge-proj"><i class="ph-bold ph-files"></i> \${specCount}</span>
        <span class="suite-nav-badge suite-badge-count"><i class="ph-bold ph-cpu"></i> \${workers}W</span>
      \`;
    } else {
      badgeHtml = \`<span class="suite-nav-badge suite-badge-desktop"><i class="ph-bold ph-desktop"></i> Desktop</span>\`;
      const specCount = Array.isArray(suite.specs) ? suite.specs.length : (suite.specs === 'all' || !suite.specs ? 'All specs' : '1 spec');
      detailMeta = \`
        <span class="suite-nav-badge suite-badge-proj"><i class="ph-bold ph-files"></i> \${specCount}</span>
        <span class="suite-nav-badge suite-badge-count"><i class="ph-bold ph-cpu"></i> \${workers}W</span>
      \`;
    }

    if (suite.grep) {
      detailMeta += \`<span class="suite-nav-badge suite-badge-tag"><i class="ph-bold ph-tag"></i> \${escapeHtml(suite.grep)}</span>\`;
    }

    return \`
      <div class="suite-nav-item \${isSelected ? 'active' : ''}" data-suite-id="\${escapeHtml(id)}">
        <div class="suite-nav-top">
          <div class="suite-nav-title" title="\${escapeHtml(label)}">\${escapeHtml(label)}</div>
          \${badgeHtml}
        </div>
        <div class="suite-nav-meta">
          \${detailMeta}
        </div>
      </div>
    \`;
  }).join('');

  container.querySelectorAll('.suite-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const suiteId = item.dataset.suiteId;
      if (suiteId && suitesCache[suiteId]) {
        selectSuite(suiteId);
      }
    });
  });
}
`;

// 2. Call renderSuitesSidebarList() inside renderSuitesView
if (!content.includes('renderSuitesSidebarList();')) {
  content = content.replace(
    '  // Render Dropdown selector\n  renderSuiteDropdown();',
    '  // Render Sidebar List & Dropdown selector\n  renderSuitesSidebarList();\n  renderSuiteDropdown();'
  );
}

// 3. Update active card in selectSuite()
if (!content.includes('container.querySelectorAll(\'.suite-nav-item\').forEach')) {
  content = content.replace(
    'function selectSuite(id) {\n  if (!suitesCache[id]) return;\n  currentSelectedSuiteId = id;\n\n  const select = $(\'#suite-picker-select\');\n  if (select && select.value !== id) {\n    select.value = id;\n  }',
    `function selectSuite(id) {
  if (!suitesCache[id]) return;
  currentSelectedSuiteId = id;

  const select = $('#suite-picker-select');
  if (select && select.value !== id) {
    select.value = id;
  }

  // Update active state in sidebar list
  document.querySelectorAll('#suites-sidebar-list .suite-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.suiteId === id);
  });`
  );
}

// 4. Insert renderSuitesSidebarList before renderSuiteDropdown
if (!content.includes('function renderSuitesSidebarList()')) {
  content = content.replace(
    'function renderSuiteDropdown() {',
    sidebarListFunction + '\nfunction renderSuiteDropdown() {'
  );
}

// 5. In syncCurrentSuiteFromInputs: re-render sidebar list so changes to label/type update the card
content = content.replace(
  '  renderSuiteDropdown();\n  updateSuitePreview(currentSelectedSuiteId, updatedSuite);',
  '  renderSuitesSidebarList();\n  renderSuiteDropdown();\n  updateSuitePreview(currentSelectedSuiteId, updatedSuite);'
);

// 6. In initSuitesView: add sidebar search, filter pills, collapse/expand event listeners
const initSidebarListeners = `
  // Suites Sidebar Search & Filter Pills
  $('#suites-search-input')?.addEventListener('input', (e) => {
    currentSuiteSearch = e.target.value;
    renderSuitesSidebarList();
  });

  document.querySelectorAll('.suite-filter-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.suite-filter-pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      currentSuiteFilter = pill.dataset.filter || 'all';
      renderSuitesSidebarList();
    });
  });

  $('#suites-refresh-btn')?.addEventListener('click', () => {
    renderSuitesSidebarList();
    notify('Đã làm mới danh sách Test Suite.');
  });

  // Suites Sidebar Collapse / Expand toggles
  const suitesWorkspace = $('#suites-workspace');
  const toggleSuitesSidebar = () => {
    if (suitesWorkspace) {
      suitesWorkspace.classList.toggle('sidebar-collapsed');
    }
  };

  $('#btn-collapse-suites-sidebar')?.addEventListener('click', () => {
    suitesWorkspace?.classList.add('sidebar-collapsed');
  });

  $('#btn-expand-suites-sidebar')?.addEventListener('click', () => {
    suitesWorkspace?.classList.remove('sidebar-collapsed');
  });

  $('#btn-toggle-suites-sidebar-head')?.addEventListener('click', toggleSuitesSidebar);
`;

content = content.replace(
  '  // Dropdown Picker change\n  $(\'#suite-picker-select\')',
  initSidebarListeners + '\n  // Dropdown Picker change\n  $(\'#suite-picker-select\')'
);

fs.writeFileSync(appPath, content, 'utf8');
console.log('Successfully updated app.js with Suites Sidebar logic.');
