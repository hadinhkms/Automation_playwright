// --- APPLY CONFIG ---
function normalizeFontSizePx(value) {
  const match = /^(\d+(?:\.\d+)?)px$/i.exec(String(value || '').trim());
  if (!match) return null;
  const size = Number(match[1]);
  if (!Number.isFinite(size) || size < 11 || size > 18) return null;
  return size;
}

function applyFontScale(root, fontSize) {
  const body = normalizeFontSizePx(fontSize);
  if (!body) return;
  root.style.setProperty('--font-meta', `${Math.max(9, body - 4)}px`);
  root.style.setProperty('--font-caption', `${Math.max(10, body - 3)}px`);
  root.style.setProperty('--font-control', `${Math.max(11, body - 2)}px`);
  root.style.setProperty('--font-body', `${body}px`);
  root.style.setProperty('--font-panel-title', `${body + 3}px`);
}

function applyLogoElement(element, logoUrl) {
  if (!element || !logoUrl) return;
  if (element.tagName === 'IMG') {
    element.src = logoUrl;
    return;
  }
  element.innerHTML = '';
  element.style.backgroundImage = `url("${String(logoUrl).replace(/"/g, '\\"')}")`;
  element.style.backgroundSize = 'contain';
  element.style.backgroundPosition = 'center';
  element.style.backgroundRepeat = 'no-repeat';
}

function applyAppConfig(config) {
  if (!config) return;
  
  if (config.pageTitle) document.title = config.pageTitle;
  
  const brandName = document.getElementById('brand-name');
  if (brandName && config.projectName) brandName.innerText = config.projectName;
  
  const brandSubtitle = document.getElementById('brand-subtitle');
  if (brandSubtitle && config.projectSubtitle) brandSubtitle.innerText = config.projectSubtitle;
  
  applyLogoElement(document.getElementById('brand-logo'), config.logoUrl);
  
  const favicon = document.getElementById('favicon');
  if (favicon && config.logoUrl) favicon.href = config.logoUrl;

  const root = document.documentElement;
  if (config.primaryColor) {
    root.style.setProperty('--accent', config.primaryColor);
  }
  if (config.backgroundColor) {
    root.style.setProperty('--bg', config.backgroundColor);
  }
  applyFontScale(root, config.fontSize);
}

const $ = (selector) => document.querySelector(selector);
const form = $('#run-form');
const consoleOutput = $('#console');
let currentRun = null;
let timer = null;
let resourceCatalog = { documents: [], data: [], evidence: [], evidenceDetails: [], reports: [], reportDetails: [] };
let currentResource = null;
let activeResourceCategory = 'evidence';
let currentResourceCategory = '';
let evidenceNavigation = [];
const openEvidenceFolders = new Set();
const openReportFolders = new Set();
let codeFiles = [];
let activeCodeRoot = 'all';
let currentCodeFile = null;
let originalCodeContent = '';
let settingsCache = null;
let currentResourceType = '';

function preferredTheme() {
  const savedTheme = localStorage.getItem('playwright-dashboard-theme');
  if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme) {
  const isLight = theme === 'light';
  document.documentElement.dataset.theme = theme;
  $('#theme-button').setAttribute('aria-pressed', String(isLight));
  $('.theme-icon').innerHTML = isLight ? '<i class="ph-fill ph-moon"></i>' : '<i class="ph-fill ph-sun"></i>';
  $('#theme-label').textContent = isLight ? 'Tối' : 'Sáng';
}

applyTheme(preferredTheme());

function fillSelect(selector, values, allLabel) {
  $(selector).innerHTML = values.map((value) =>
    `<option value="${escapeHtml(value)}">${value === 'all' ? allLabel : escapeHtml(value)}</option>`
  ).join('');
}

let testCatalog = { specs: [], specProjects: {} };

function refreshSpecOptions() {
  const project = $('#project').value;
  const selectedSpec = $('#spec').value;
  const hasProjectMapping = Object.keys(testCatalog.specProjects).length > 0;
  const specs = project === 'all' || !hasProjectMapping
    ? testCatalog.specs
    : testCatalog.specs.filter((spec) => testCatalog.specProjects[spec]?.includes(project));
  fillSelect('#spec', ['all', ...specs], 'Tất cả file test');
  if (specs.includes(selectedSpec)) $('#spec').value = selectedSpec;
  updateWorkersForSpec();
}

function updateWorkersForSpec() {
  const spec = $('#spec').value;
  const workersInput = $('#workers');
  if (spec !== 'all') {
    if (!workersInput.disabled) workersInput.dataset.previousValue = workersInput.value;
    workersInput.value = '1';
    workersInput.disabled = true;
  } else {
    workersInput.disabled = false;
    if (workersInput.dataset.previousValue) {
      workersInput.value = workersInput.dataset.previousValue;
    }
  }
  updateManualSpecsPreview();
}

$('#project').addEventListener('change', refreshSpecOptions);
$('#spec').addEventListener('change', updateWorkersForSpec);
$('#grep')?.addEventListener('input', updateManualSpecsPreview);

function fillSettingSelect(selector, values, selected) {
  $(selector).innerHTML = values.map((value) =>
    `<option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}>${escapeHtml(value)}</option>`
  ).join('');
}

function setInputValue(selector, value) {
  $(selector).value = value ?? '';
}

function setChecked(selector, value) {
  $(selector).checked = value === true;
}

function readNumber(target, fallback = 0) {
  if (typeof target === 'string' && (target.startsWith('#') || target.startsWith('.'))) {
    const el = $(target);
    if (!el) return fallback;
    const val = Number(el.value);
    return Number.isFinite(val) ? val : fallback;
  }
  const val = Number(target);
  return Number.isFinite(val) ? val : fallback;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function formatJsonText(content) {
  return JSON.stringify(JSON.parse(content), null, 2);
}

function formatMarkdownText(content) {
  return String(content).replace(/\r\n?/g, '\n').split('\n').map((line) => line.replace(/\s+$/g, '')).join('\n').replace(/\n{4,}/g, '\n\n\n').trimEnd() + '\n';
}

function renderInlineMarkdown(content) {
  return escapeHtml(content)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function renderMarkdown(content) {
  const lines = String(content).replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  let inCode = false;
  let codeBuffer = [];
  let listType = '';
  let tableBuffer = [];

  const closeList = () => {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = '';
  };
  const closeTable = () => {
    if (!tableBuffer.length) return;
    closeList();
    const rows = tableBuffer.map((line) => line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()));
    const header = rows.shift() || [];
    if (rows[0] && rows[0].every((cell) => /^:?-{3,}:?$/.test(cell))) rows.shift();
    html.push('<table><thead><tr>' + header.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join('') + '</tr></thead><tbody>');
    rows.forEach((row) => html.push('<tr>' + row.map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`).join('') + '</tr>'));
    html.push('</tbody></table>');
    tableBuffer = [];
  };

  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      closeTable();
      closeList();
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`);
        codeBuffer = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuffer.push(line);
      continue;
    }
    if (/^\s*\|.+\|\s*$/.test(line)) {
      tableBuffer.push(line);
      continue;
    }

    closeTable();
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      closeList();
      html.push(`<h${heading[1].length}>${renderInlineMarkdown(heading[2])}</h${heading[1].length}>`);
      continue;
    }

    const unordered = /^\s*[-*]\s+(.+)$/.exec(line);
    const ordered = /^\s*\d+\.\s+(.+)$/.exec(line);
    if (unordered || ordered) {
      const nextType = unordered ? 'ul' : 'ol';
      if (listType !== nextType) {
        closeList();
        html.push(`<${nextType}>`);
        listType = nextType;
      }
      html.push(`<li>${renderInlineMarkdown((unordered || ordered)[1])}</li>`);
      continue;
    }

    if (/^\s*>\s+/.test(line)) {
      closeList();
      html.push(`<blockquote>${renderInlineMarkdown(line.replace(/^\s*>\s+/, ''))}</blockquote>`);
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    closeList();
    html.push(`<p>${renderInlineMarkdown(line)}</p>`);
  }
  closeTable();
  closeList();
  if (inCode) html.push(`<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`);
  return html.join('\n');
}

function renderResourceContent(resource) {
  const container = $('#resource-content');
  container.className = `resource-content ${resource.type}`;

  if (resource.type === 'json') {
    const formatted = formatJsonText(resource.content);
    container.innerHTML = `<pre><code>${highlightCode(formatted, true)}</code></pre>`;
    return;
  }

  if (resource.type === 'markdown') {
    container.innerHTML = renderMarkdown(resource.content);
    return;
  }

  container.textContent = resource.content;
}

function notify(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function appendLog(payload) {
  if (consoleOutput.querySelector('.muted')) consoleOutput.textContent = '';
  const line = document.createElement('span');
  line.className = payload.stream === 'stderr' ? 'stderr' : '';
  line.textContent = payload.text;
  consoleOutput.appendChild(line);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function formatDate(value) {
  return value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value)) : '—';
}

function renderRun(run) {
  currentRun = run;
  const status = run?.status || 'idle';
  const labels = { idle: 'Sẵn sàng', running: 'Đang chạy', passed: 'Đã pass', failed: 'Đã fail', stopped: 'Đã dừng' };
  $('#status-card').className = `status-card ${status}`;
  $('#status-label').textContent = labels[status];
  $('#status-detail').textContent = run
    ? `${run.mode === 'ui' ? 'UI mode' : run.options.environment.toUpperCase()} · ${run.options.project === 'all' ? 'Tất cả nhóm test' : run.options.project}`
    : 'Chưa có test run trong phiên này.';
  $('#started-at').textContent = formatDate(run?.startedAt);
  $('#exit-code').textContent = run?.exitCode ?? '—';
  $('#command').textContent = run?.command || 'npx playwright test';
  const running = status === 'running';
  $('#run-button').disabled = running;
  $('#stop-button').disabled = !running;
  $('#ui-button').disabled = running;
  form.querySelectorAll('input, select').forEach((control) => { control.disabled = running; });
  clearInterval(timer);
  const updateDuration = () => {
    if (!run?.startedAt) return $('#duration').textContent = '—';
    const end = run.finishedAt ? new Date(run.finishedAt) : new Date();
    const seconds = Math.max(0, Math.floor((end - new Date(run.startedAt)) / 1000));
    $('#duration').textContent = `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };
  updateDuration();
  if (running) timer = setInterval(updateDuration, 1000);
}

async function request(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Có lỗi xảy ra.');
  return body;
}

function renderResourceList(filter = '') {
  const query = filter.trim().toLowerCase();
  const groups = [
    ['Báo cáo', 'reports', resourceCatalog.reports],
    ['Evidence', 'evidence', resourceCatalog.evidence],
    ['Tài liệu', 'documents', resourceCatalog.documents],
    ['Dữ liệu test', 'data', resourceCatalog.data],
  ];
  $('#resource-list').innerHTML = groups.map(([label, category, files]) => {
    if (activeResourceCategory !== 'all' && activeResourceCategory !== category) return '';
    const matches = files.filter((file) => file.toLowerCase().includes(query));
    if (!matches.length) return '';
    if (category === 'reports') {
      return `<section class="resource-group report-group"><h3>${label}<span>${matches.length}</span></h3>${renderReportTree(matches)}</section>`;
    }
    if (category === 'evidence') {
      evidenceNavigation = matches;
      return `<section class="resource-group evidence-group"><h3>${label}<span>${matches.length}</span></h3>${renderEvidenceTree(matches)}</section>`;
    }
    return `<section class="resource-group"><h3>${label}<span>${matches.length}</span></h3>${matches.map((file) =>
      `<button class="resource-item${file === currentResource ? ' active' : ''}" type="button" data-path="${escapeHtml(file)}" data-category="${category}"><span>${category === 'reports' ? 'R' : file.endsWith('.json') ? '{}' : /\.(png|jpe?g|webp)$/i.test(file) ? '▧' : 'M↓'}</span><div><strong>${escapeHtml(category === 'reports' ? file.split('/').slice(-2,-1)[0] || 'Báo cáo' : file.split('/').pop())}</strong><small>${escapeHtml(file)}</small></div></button>`
    ).join('')}</section>`;
  }).join('') || '<p class="empty-resource">Không tìm thấy file.</p>';
  document.querySelectorAll('.resource-item').forEach((button) => button.addEventListener('click', () => loadResource(button.dataset.path, false, button.dataset.category)));
  document.querySelectorAll('.evidence-folder').forEach((folder) => folder.addEventListener('toggle', () => {
    if (folder.classList.contains('report-folder')) return;
    if (folder.open) openEvidenceFolders.add(folder.dataset.folder); else openEvidenceFolders.delete(folder.dataset.folder);
  }));
  document.querySelectorAll('.report-folder').forEach((folder) => folder.addEventListener('toggle', () => {
    if (folder.open) openReportFolders.add(folder.dataset.reportFolder); else openReportFolders.delete(folder.dataset.reportFolder);
  }));
  document.querySelectorAll('.delete-folder-button').forEach((button) => button.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await deleteEvidenceFolder(button.dataset.folder);
  }));
}

function renderReportTree(files) {
  const root = {};
  files.forEach((file) => {
    let branch = root;
    file.split('/').forEach((segment, index, parts) => {
      if (index === parts.length - 1) {
        branch.__reports = branch.__reports || [];
        branch.__reports.push(file);
      } else {
        branch[segment] = branch[segment] || {};
        branch = branch[segment];
      }
    });
  });
  const countReports = (branch) => (branch.__reports?.length || 0) + Object.entries(branch)
    .filter(([key]) => key !== '__reports')
    .reduce((total, [, child]) => total + countReports(child), 0);
  const reportItems = (items) => items.map((file) => {
    const detail = resourceCatalog.reportDetails.find((item) => item.path === file);
    const createdAt = detail?.modifiedAt ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(detail.modifiedAt)) : 'Không rõ thời gian';
    return `<button class="resource-item report-file${file === currentResource ? ' active' : ''}" type="button" data-path="${escapeHtml(file)}" data-category="reports"><span>R</span><div><strong>Báo cáo Playwright</strong><small>${escapeHtml(createdAt)}</small></div></button>`;
  }).join('');
  const branchHtml = (branch, parentPath = '') => Object.entries(branch)
    .filter(([key]) => key !== '__reports')
    .map(([folder, child]) => {
      const folderPath = parentPath ? `${parentPath}/${folder}` : folder;
      const open = openReportFolders.has(folderPath) ? ' open' : '';
      return `<details class="evidence-folder report-folder" data-report-folder="${escapeHtml(folderPath)}"${open}><summary><span class="folder-icon">▸</span><strong>${escapeHtml(folder)}</strong><small>${countReports(child)}</small></summary><div>${branchHtml(child, folderPath)}${reportItems(child.__reports || [])}</div></details>`;
    }).join('');
  return branchHtml(root) + reportItems(root.__reports || []);
}

function renderEvidenceTree(files) {
  const root = {};
  files.forEach((file) => {
    let branch = root;
    file.split('/').forEach((segment, index, parts) => {
      if (index === parts.length - 1) {
        branch.__files = branch.__files || [];
        branch.__files.push(file);
      } else {
        branch[segment] = branch[segment] || {};
        branch = branch[segment];
      }
    });
  });

  const renderBranch = (branch, depth = 0, parentPath = '') => Object.entries(branch)
    .filter(([key]) => key !== '__files')
    .map(([folder, child]) => {
      const childFiles = countTreeFiles(child);
      const folderPath = parentPath ? `${parentPath}/${folder}` : folder;
      const open = openEvidenceFolders.has(folderPath) ? ' open' : '';
      return `<details class="evidence-folder" data-folder="${escapeHtml(folderPath)}"${open}><summary><span class="folder-icon">▸</span><strong>${escapeHtml(folder)}</strong><small>${childFiles}</small><button class="delete-folder-button" type="button" data-folder="${escapeHtml(folderPath)}" title="Xóa folder">×</button></summary><div>${renderBranch(child, depth + 1, folderPath)}${renderFiles(child.__files || [])}</div></details>`;
    }).join('');

  const renderFiles = (items) => [...items].reverse().map((file) => {
    const detail = resourceCatalog.evidenceDetails.find((item) => item.path === file);
    const createdAt = detail?.modifiedAt ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(detail.modifiedAt)) : 'Không rõ thời gian';
    return `<button class="resource-item evidence-file${file === currentResource ? ' active' : ''}" type="button" data-path="${escapeHtml(file)}" data-category="evidence"><span>▧</span><div><strong>${escapeHtml(file.split('/').pop())}</strong><small>${escapeHtml(createdAt)}</small></div></button>`;
  }).join('');

  return renderBranch(root) + renderFiles(root.__files || []);
}

function countTreeFiles(branch) {
  return (branch.__files?.length || 0) + Object.entries(branch)
    .filter(([key]) => key !== '__files')
    .reduce((total, [, child]) => total + countTreeFiles(child), 0);
}

function hideResourcePreviews() {
  $('#resource-empty').hidden = true;
  $('#resource-content').hidden = true;
  $('#evidence-preview').hidden = true;
  $('#report-preview').hidden = true;
  $('#resource-editor').hidden = true;
  $('#evidence-image').removeAttribute('src');
  $('#report-frame').removeAttribute('src');
}

async function loadResource(resourcePath, reveal = false, category = '') {
  hideResourcePreviews();
  currentResourceCategory = category || currentResourceCategory;
  $('#edit-button').hidden = true;
  $('#delete-button').hidden = !['reports', 'evidence'].includes(currentResourceCategory);
  if (category === 'reports') {
    currentResource = resourcePath;
    const reportUrl = `/reports/${resourcePath.split('/').map(encodeURIComponent).join('/')}`;
    $('#resource-name').textContent = resourcePath;
    $('#resource-type').textContent = 'BÁO CÁO PLAYWRIGHT';
    $('#report-preview').hidden = false;
    $('#report-frame').src = reportUrl;
    $('#report-open').href = reportUrl;
    $('#reveal-button').hidden = true;
    $('#delete-button').hidden = false;
    updateActiveResource();
    return;
  }
  if (/\.(png|jpe?g|webp)$/i.test(resourcePath)) {
    currentResource = resourcePath;
    const imageUrl = `/evidence/${resourcePath.split('/').map(encodeURIComponent).join('/')}`;
    $('#resource-name').textContent = resourcePath;
    $('#resource-type').textContent = 'ẢNH EVIDENCE';
    $('#evidence-preview').hidden = false;
    $('#evidence-image').src = imageUrl;
    $('#evidence-open').href = imageUrl;
    updateEvidencePosition();
    $('#reveal-button').hidden = true;
    $('#delete-button').hidden = false;
    updateActiveResource();
    return;
  }
  try {
    const resource = await request(`/api/resource?path=${encodeURIComponent(resourcePath)}&reveal=${reveal}`);
    currentResource = resourcePath;
    currentResourceType = resource.type;
    $('#resource-name').textContent = resource.path;
    $('#resource-type').textContent = resource.type === 'json' ? 'DỮ LIỆU JSON' : 'MARKDOWN';
    renderResourceContent(resource);
    $('#resource-content').hidden = false;
    $('#evidence-preview').hidden = true;
    $('#reveal-button').hidden = resource.type !== 'json';
    $('#edit-button').hidden = !resource.editable;
    $('#delete-button').hidden = true;
    $('#reveal-button').textContent = resource.masked ? 'Hiện dữ liệu gốc' : 'Che dữ liệu nhạy cảm';
    $('#reveal-button').dataset.revealed = String(!resource.masked);
    renderResourceList($('#resource-search').value);
  } catch (error) { notify(error.message); }
}

function updateActiveResource() {
  document.querySelectorAll('.resource-item').forEach((item) => item.classList.toggle('active', item.dataset.path === currentResource));
}

function updateEvidencePosition() {
  const sequence = currentEvidenceSequence();
  const index = sequence.indexOf(currentResource);
  $('#evidence-position').textContent = index >= 0 ? `${index + 1} / ${sequence.length}` : '—';
  $('#previous-evidence').disabled = index <= 0;
  $('#next-evidence').disabled = index < 0 || index >= sequence.length - 1;
}

function navigateEvidence(direction) {
  const sequence = currentEvidenceSequence();
  const index = sequence.indexOf(currentResource);
  const target = sequence[index + direction];
  if (target) loadResource(target, false, 'evidence');
}

function currentEvidenceSequence() {
  const parentFolder = currentResource?.includes('/') ? currentResource.slice(0, currentResource.lastIndexOf('/')) : '';
  return evidenceNavigation.filter((item) => item.slice(0, item.lastIndexOf('/')) === parentFolder);
}

async function deleteEvidenceFolder(folderPath) {
  const imageCount = resourceCatalog.evidence.filter((item) => item.startsWith(`${folderPath}/`)).length;
  if (!window.confirm(`Xóa folder evidence này và ${imageCount} ảnh bên trong?\n\n${folderPath}`)) return;
  try {
    const result = await request('/api/artifact', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'evidence-folder', path: folderPath }),
    });
    notify(result.message);
    if (currentResource?.startsWith(`${folderPath}/`)) {
      currentResource = null;
      currentResourceCategory = '';
      hideResourcePreviews();
      $('#resource-empty').hidden = false;
    }
    openEvidenceFolders.clear();
    await openExplorer();
  } catch (error) { notify(error.message); }
}

async function editCurrentResource() {
  if (!currentResource) return;
  try {
    const resource = await request(`/api/resource?path=${encodeURIComponent(currentResource)}&reveal=true`);
    currentResourceType = resource.type;
    $('#resource-edit-content').value = resource.type === 'json' ? formatJsonText(resource.content) : resource.type === 'markdown' ? formatMarkdownText(resource.content) : resource.content;
    $('#resource-content').hidden = true;
    $('#resource-editor').hidden = false;
    $('#edit-button').hidden = true;
    $('#reveal-button').hidden = true;
  } catch (error) { notify(error.message); }
}

function formatCurrentResourceEditor() {
  const editor = $('#resource-edit-content');
  try {
    if (currentResourceType === 'json' || currentResource?.endsWith('.json')) {
      editor.value = formatJsonText(editor.value);
      notify('Đã định dạng JSON.');
      return;
    }
    if (currentResourceType === 'markdown' || currentResource?.endsWith('.md')) {
      editor.value = formatMarkdownText(editor.value);
      notify('Đã định dạng Markdown.');
      return;
    }
    notify('File này không có định dạng tự động.');
  } catch (error) {
    notify(`Không thể định dạng: ${error.message}`);
  }
}

async function saveCurrentResource() {
  const saveButton = $('#save-resource-button');
  saveButton.disabled = true;
  try {
    const content = currentResourceType === 'json' || currentResource?.endsWith('.json')
      ? formatJsonText($('#resource-edit-content').value)
      : $('#resource-edit-content').value;
    const result = await request('/api/resource', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: currentResource, content }),
    });
    notify(`${result.message} Backup: ${result.backup}`);
    await loadResource(currentResource, false, currentResourceCategory);
  } catch (error) { notify(error.message); }
  finally { saveButton.disabled = false; }
}

async function deleteCurrentArtifact() {
  if (!currentResource || !['reports', 'evidence'].includes(currentResourceCategory)) return;
  const label = currentResourceCategory === 'reports' ? 'toàn bộ folder report, gồm HTML, data, trace/video đóng gói bên trong' : 'evidence';
  if (!window.confirm(`Bạn chắc chắn muốn xóa ${label}?\n\n${currentResource}`)) return;
  try {
    const result = await request('/api/artifact', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: currentResourceCategory === 'reports' ? 'report' : 'evidence', path: currentResource }),
    });
    notify(result.message);
    currentResource = null;
    currentResourceCategory = '';
    hideResourcePreviews();
    $('#resource-empty').hidden = false;
    $('#resource-name').textContent = 'Chọn một mục để xem chi tiết';
    $('#resource-type').textContent = 'RESOURCE';
    $('#delete-button').hidden = true;
    await openExplorer();
  } catch (error) { notify(error.message); }
}

async function openExplorer() {
  try {
    resourceCatalog = await request('/api/resources');
    $('#resource-summary').innerHTML = `<span><strong>${resourceCatalog.reports.length}</strong> báo cáo</span><span><strong>${resourceCatalog.evidence.length}</strong> evidence</span><span><strong>${resourceCatalog.documents.length + resourceCatalog.data.length}</strong> tệp</span>`;
    renderResourceList();
  } catch (error) { notify(error.message); }
}

async function openCodeWorkspace() {
  try {
    const result = await request('/api/code-files');
    codeFiles = result.files;
    $('#code-file-count').textContent = `${codeFiles.length} tệp`;
    renderCodeTree();
  } catch (error) { notify(error.message); }
}

function renderCodeTree() {
  const query = $('#code-search').value.trim().toLowerCase();
  const matches = codeFiles.filter((file) => (activeCodeRoot === 'all' || file.startsWith(`${activeCodeRoot}/`)) && file.toLowerCase().includes(query));
  const grouped = { tests: [], pages: [], core: [] };
  const rootLabels = { tests: 'Test', pages: 'Page Object', core: 'Core' };
  matches.forEach((file) => grouped[file.split('/')[0]]?.push(file));
  $('#code-tree').innerHTML = Object.entries(grouped).map(([root, files]) => {
    if (!files.length) return '';
    return `<details class="code-folder" open><summary><span>▾</span><strong>${rootLabels[root] || root}</strong><small>${files.length}</small></summary><div>${renderCodeBranch(files, root)}</div></details>`;
  }).join('') || '<p class="empty-resource">Không tìm thấy file mã nguồn.</p>';
  document.querySelectorAll('.code-file').forEach((button) => button.addEventListener('click', () => loadCodeFile(button.dataset.path)));
}

function renderCodeBranch(files, root) {
  const tree = {};
  files.forEach((file) => {
    let branch = tree;
    file.split('/').slice(1).forEach((segment, index, parts) => {
      if (index === parts.length - 1) {
        branch.__files = branch.__files || [];
        branch.__files.push(file);
      } else {
        branch[segment] = branch[segment] || {};
        branch = branch[segment];
      }
    });
  });
  const branchHtml = (branch) => Object.entries(branch).filter(([key]) => key !== '__files').map(([folder, child]) =>
    `<details class="code-folder nested" open><summary><span>▾</span><strong>${escapeHtml(folder)}</strong><small>${countTreeFiles(child)}</small></summary><div>${branchHtml(child)}${fileHtml(child.__files || [])}</div></details>`
  ).join('');
  const fileHtml = (items) => items.map((file) => `<button class="code-file${file === currentCodeFile ? ' active' : ''}" type="button" data-path="${escapeHtml(file)}"><span>JS</span><strong>${escapeHtml(file.split('/').pop())}</strong></button>`).join('');
  return branchHtml(tree) + fileHtml(tree.__files || []);
}

async function loadCodeFile(filePath) {
  try {
    const source = await request(`/api/code?path=${encodeURIComponent(filePath)}`);
    currentCodeFile = filePath;
    originalCodeContent = source.content;
    $('#code-file-name').textContent = filePath;
    $('#code-language').textContent = filePath.endsWith('.json') ? 'JSON' : 'JAVASCRIPT';
    $('#code-editor').value = source.content;
    $('#code-preview code').innerHTML = highlightCode(source.content, filePath.endsWith('.json'));
    $('#code-editor-stage').hidden = false;
    $('#code-editor-stage').classList.remove('editing');
    $('#code-editor').hidden = true;
    $('#code-empty').hidden = true;
    $('#code-edit-button').hidden = false;
    $('#code-format-button').hidden = true;
    $('#code-save-button').hidden = true;
    $('#code-cancel-button').hidden = true;
    $('#code-status-text').textContent = `${source.content.split('\n').length} dòng`;
    document.querySelectorAll('.code-file').forEach((item) => item.classList.toggle('active', item.dataset.path === filePath));
  } catch (error) { notify(error.message); }
}

function highlightCode(content, isJson = false) {
  const pattern = isJson
    ? /("(?:\\.|[^"\\])*")|\b(true|false|null)\b|(-?\b\d+(?:\.\d+)?\b)/g
    : /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|\b(const|let|var|class|extends|new|function|async|await|return|if|else|for|while|try|catch|throw|require|module|exports|this|super|import|from|export|default|true|false|null|undefined)\b|\b(\d+(?:\.\d+)?)\b/g;
  let html = '';
  let cursor = 0;
  for (const match of content.matchAll(pattern)) {
    html += escapeHtml(content.slice(cursor, match.index));
    const token = match[0];
    let type = 'number';
    if (isJson) type = match[1] ? 'string' : match[2] ? 'keyword' : 'number';
    else type = match[1] ? 'comment' : match[2] ? 'string' : match[3] ? 'keyword' : 'number';
    html += `<span class="syntax-${type}">${escapeHtml(token)}</span>`;
    cursor = match.index + token.length;
  }
  return html + escapeHtml(content.slice(cursor));
}

function enterCodeEditMode() {
  if (!currentCodeFile) return;
  $('#code-editor-stage').classList.add('editing');
  $('#code-editor').hidden = false;
  $('#code-editor').focus();
  $('#code-edit-button').hidden = true;
  $('#code-format-button').hidden = !currentCodeFile.endsWith('.json');
  $('#code-save-button').hidden = false;
  $('#code-save-button').disabled = true;
  $('#code-cancel-button').hidden = false;
  $('#code-status-text').textContent = 'Đang chỉnh sửa';
}

function leaveCodeEditMode() {
  $('#code-editor').value = originalCodeContent;
  $('#code-preview code').innerHTML = highlightCode(originalCodeContent, currentCodeFile?.endsWith('.json'));
  $('#code-editor-stage').classList.remove('editing');
  $('#code-editor').hidden = true;
  $('#code-edit-button').hidden = false;
  $('#code-format-button').hidden = true;
  $('#code-save-button').hidden = true;
  $('#code-cancel-button').hidden = true;
  $('#code-status-text').textContent = 'Sẵn sàng';
}

function formatCurrentCodeEditor() {
  if (!currentCodeFile?.endsWith('.json')) {
    notify('Chỉ hỗ trợ định dạng tự động cho JSON.');
    return;
  }
  try {
    $('#code-editor').value = formatJsonText($('#code-editor').value);
    $('#code-preview code').innerHTML = highlightCode($('#code-editor').value, true) + '\n';
    $('#code-save-button').disabled = $('#code-editor').value === originalCodeContent;
    $('#code-cancel-button').hidden = $('#code-editor').value === originalCodeContent;
    $('#code-status-text').textContent = 'Đã định dạng';
  } catch (error) {
    notify(`Không thể định dạng JSON: ${error.message}`);
  }
}

async function saveCodeFile() {
  if (!currentCodeFile) return;
  const button = $('#code-save-button');
  button.disabled = true;
  try {
    const content = currentCodeFile.endsWith('.json') ? formatJsonText($('#code-editor').value) : $('#code-editor').value;
    const result = await request('/api/code', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: currentCodeFile, content }),
    });
    originalCodeContent = content;
    $('#code-editor').value = content;
    $('#code-preview code').innerHTML = highlightCode(originalCodeContent, currentCodeFile.endsWith('.json'));
    $('#code-editor-stage').classList.remove('editing');
    $('#code-editor').hidden = true;
    $('#code-edit-button').hidden = false;
    $('#code-format-button').hidden = true;
    $('#code-save-button').hidden = true;
    $('#code-cancel-button').hidden = true;
    $('#code-status-text').textContent = 'Đã lưu';
    notify(`${result.message} Backup: ${result.backup}`);
  } catch (error) {
    $('#code-status-text').textContent = 'Lưu thất bại';
    notify(error.message);
    button.disabled = false;
  }
}

let currentRunnerMode = 'suite';

function renderRunnerSuiteOptions(suites, activeId = '') {
  const select = $('#runner-suite-select');
  if (!select) return;
  const entries = Object.entries(suites || {});
  if (entries.length === 0) {
    select.innerHTML = '<option value="">(Chưa có kịch bản nào)</option>';
    updateSuiteSummaryBox('');
    return;
  }
  select.innerHTML = entries.map(([id, suite]) => {
    let fileLabel = 'Tất cả file';
    if (Array.isArray(suite.specs) && suite.specs.length > 0) fileLabel = `${suite.specs.length} file`;
    else if (suite.spec && suite.spec !== 'all') fileLabel = '1 file';
    return `<option value="${escapeHtml(id)}" ${activeId === id ? 'selected' : ''}>${escapeHtml(suite.label || id)} (${fileLabel})</option>`;
  }).join('');

  const targetId = (activeId && entries.some(([id]) => id === activeId)) ? activeId : entries[0][0];
  select.value = targetId;
  updateSuiteSummaryBox(targetId);
}

function updateSuiteSummaryBox(suiteId) {
  const suite = window.dashboardSuites?.[suiteId];
  const summaryBox = $('#suite-summary-box');
  if (!suite || !summaryBox) {
    window.activeSuiteSpecs = null;
    $('#test-suite').value = '';
    return;
  }
  $('#test-suite').value = suiteId;
  $('#suite-sum-project').textContent = suite.project === 'all' ? 'Tất cả nhóm' : suite.project;
  
  const vp = suite.viewport || { preset: 'default', width: 1920, height: 1080 };
  const vpText = vp.preset === 'default' ? 'Mặc định' : `${vp.width}x${vp.height}`;
  $('#suite-sum-viewport').textContent = vpText;

  $('#suite-sum-grep').textContent = suite.grep ? suite.grep : 'Không tag';
  $('#suite-sum-workers').textContent = `${suite.workers || 2} luồng`;

  let specs = suite.specs;
  if (!specs && suite.spec) specs = suite.spec === 'all' ? 'all' : [suite.spec];

  const filesList = $('#suite-sum-files-list');
  const filesCount = $('#suite-sum-count');

  if (Array.isArray(specs) && specs.length > 0) {
    window.activeSuiteSpecs = specs;
    if (filesCount) filesCount.textContent = String(specs.length);
    if (filesList) {
      filesList.innerHTML = specs.map((s) => `
        <span class="suite-summary-pill" title="${escapeHtml(s)}">
          <i class="ph-bold ph-file-js"></i> ${escapeHtml(s.split('/').pop())}
        </span>
      `).join('');
    }
  } else {
    window.activeSuiteSpecs = null;
    if (filesCount) filesCount.textContent = 'Toàn bộ';
    if (filesList) {
      filesList.innerHTML = `<span class="suite-summary-pill"><i class="ph-bold ph-files"></i> Toàn bộ file .spec.js</span>`;
    }
  }
}

function renderTagChips(tags = []) {
  const container = $('#runner-tag-chips');
  if (!container) return;
  if (tags.length === 0) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = tags.map((t) =>
    `<button type="button" class="tag-chip-btn" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`
  ).join('');

  container.querySelectorAll('.tag-chip-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.tag;
      const grepInput = $('#grep');
      if (!grepInput) return;
      if (grepInput.value.trim() === tag) {
        grepInput.value = '';
        btn.classList.remove('active');
      } else {
        grepInput.value = tag;
        container.querySelectorAll('.tag-chip-btn').forEach((b) => b.classList.toggle('active', b === btn));
      }
      updateManualSpecsPreview();
    });
  });
}

function updateManualSpecsPreview() {
  let manualScope = 'all';
  document.querySelectorAll('.runner-scope-tab-btn').forEach((btn) => {
    if (btn.classList.contains('active')) manualScope = btn.dataset.manualScope;
  });

  const project = $('#project')?.value || 'all';
  const hasProjectMapping = testCatalog.specProjects && Object.keys(testCatalog.specProjects).length > 0;
  const projectSpecs = project === 'all' || !hasProjectMapping
    ? (testCatalog.specs || [])
    : (testCatalog.specs || []).filter((spec) => testCatalog.specProjects[spec]?.includes(project));

  const titleSpan = $('#manual-specs-preview-title');
  const countSpan = $('#manual-specs-preview-count');
  const listContainer = $('#manual-specs-preview-list');
  if (!listContainer) return;

  if (manualScope === 'file') {
    const selectedFile = $('#spec')?.value;
    if (selectedFile && selectedFile !== 'all') {
      if (titleSpan) titleSpan.textContent = 'File đã chọn';
      if (countSpan) countSpan.textContent = '1 file';
      listContainer.innerHTML = `
        <span class="suite-summary-pill" title="${escapeHtml(selectedFile)}">
          <i class="ph-bold ph-file-js"></i> ${escapeHtml(selectedFile.split('/').pop())}
        </span>
      `;
    } else {
      if (titleSpan) titleSpan.textContent = 'Chưa chọn file';
      if (countSpan) countSpan.textContent = '0';
      listContainer.innerHTML = `<span style="color:var(--muted); font-size:11px; padding:4px;">Vui lòng chọn 1 file trong danh sách thả xuống</span>`;
    }
  } else if (manualScope === 'grep') {
    const rawGrep = $('#grep')?.value.trim() || '';
    const grepLower = rawGrep.toLowerCase();

    // Update active class on tag chips
    document.querySelectorAll('#runner-tag-chips .tag-chip-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.tag.toLowerCase() === grepLower);
    });

    if (grepLower) {
      const matchedSpecs = projectSpecs.filter((spec) => {
        const tags = testCatalog.specTags?.[spec] || [];
        return tags.some((t) => t.toLowerCase().includes(grepLower) || grepLower.includes(t.toLowerCase()));
      });

      if (matchedSpecs.length > 0) {
        if (titleSpan) titleSpan.textContent = `Tìm thấy ${matchedSpecs.length} file có tag "${rawGrep}"`;
        if (countSpan) countSpan.textContent = `${matchedSpecs.length} files`;
        listContainer.innerHTML = matchedSpecs.map((s) => {
          const tags = testCatalog.specTags?.[s] || [];
          return `
            <span class="suite-summary-pill" title="${escapeHtml(s)} (Tags: ${tags.join(', ')})">
              <i class="ph-bold ph-tag"></i> ${escapeHtml(s.split('/').pop())}
            </span>
          `;
        }).join('');
      } else {
        if (titleSpan) titleSpan.textContent = `Không tìm thấy file nào có tag "${rawGrep}"`;
        if (countSpan) countSpan.textContent = `0 files`;
        listContainer.innerHTML = `<span style="color:var(--danger,#ef4444); font-size:11px; padding:4px;"><i class="ph-bold ph-warning"></i> Không có file .spec.js nào chứa tag này trong nhóm ${project === 'all' ? 'dự án' : project}</span>`;
      }
    } else {
      if (titleSpan) titleSpan.textContent = 'Chọn hoặc nhập Tag để lọc file test';
      if (countSpan) countSpan.textContent = `${projectSpecs.length} files sẵn có`;
      listContainer.innerHTML = projectSpecs.map((s) => `
        <span class="suite-summary-pill" title="${escapeHtml(s)}">
          <i class="ph-bold ph-file-js"></i> ${escapeHtml(s.split('/').pop())}
        </span>
      `).join('');
    }
  } else {
    // all
    if (titleSpan) titleSpan.textContent = project === 'all' ? 'Tất cả file test' : `File test thuộc ${project}`;
    if (countSpan) countSpan.textContent = `${projectSpecs.length} files`;
    if (projectSpecs.length === 0) {
      listContainer.innerHTML = `<span style="color:var(--muted); font-size:11px; padding:4px;">Không có file test nào phù hợp với nhóm này</span>`;
    } else {
      listContainer.innerHTML = projectSpecs.map((s) => `
        <span class="suite-summary-pill" title="${escapeHtml(s)}">
          <i class="ph-bold ph-file-js"></i> ${escapeHtml(s.split('/').pop())}
        </span>
      `).join('');
    }
  }
}

function setRunnerMode(mode) {
  currentRunnerMode = mode;
  document.querySelectorAll('.runner-mode-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.mode === mode);
  });
  const suitePanel = $('#runner-suite-mode');
  const manualPanel = $('#runner-manual-mode');
  if (suitePanel) suitePanel.hidden = mode !== 'suite';
  if (manualPanel) manualPanel.hidden = mode !== 'manual';

  if (mode === 'suite') {
    const selectedId = $('#runner-suite-select')?.value;
    if (selectedId) updateSuiteSummaryBox(selectedId);
  } else {
    window.activeSuiteSpecs = null;
    $('#test-suite').value = '';
    updateManualSpecsPreview();
  }
}

function createSuiteCardElement(id, suite = {}) {
  const card = document.createElement('div');
  card.className = 'suite-card';
  card.dataset.suiteId = id;
  
  const projects = Array.from(new Set(['all', ...(testCatalog.projects || [])]));
  const projectOptions = projects.map((p) => 
    `<option value="${escapeHtml(p)}" ${p === (suite.project || 'all') ? 'selected' : ''}>${p === 'all' ? 'Tất cả nhóm test' : escapeHtml(p)}</option>`
  ).join('');

  const allSpecs = testCatalog.specs || [];
  let selectedSpecs = [];
  if (Array.isArray(suite.specs)) selectedSpecs = suite.specs;
  else if (typeof suite.spec === 'string' && suite.spec !== 'all') selectedSpecs = [suite.spec];

  let currentScopeMode = 'all';
  if (suite.grep && suite.grep.trim().length > 0) {
    currentScopeMode = 'grep';
  } else if (selectedSpecs.length > 0) {
    currentScopeMode = 'custom';
  }

  const specCheckboxes = allSpecs.map((s) => {
    const parts = s.split('/');
    const fileName = parts.pop();
    const dirPath = parts.length > 0 ? parts.join('/') + '/' : '';
    return `
      <label class="suite-spec-item">
        <input type="checkbox" class="suite-spec-cb" value="${escapeHtml(s)}" ${selectedSpecs.includes(s) ? 'checked' : ''}>
        <span class="suite-spec-name"><span style="color: var(--muted); font-size: 11px;">${escapeHtml(dirPath)}</span><strong>${escapeHtml(fileName)}</strong></span>
      </label>
    `;
  }).join('');

  const vpPreset = suite.viewport?.preset || 'default';
  const vpWidth = suite.viewport?.width || 1920;
  const vpHeight = suite.viewport?.height || 1080;

  card.innerHTML = `
    <div class="suite-card-head">
      <span class="suite-card-badge"><i class="ph-bold ph-package"></i> <span class="suite-card-title">${escapeHtml(suite.label || 'Kịch bản mới')}</span></span>
      <button type="button" class="suite-card-delete btn-delete-suite"><i class="ph-bold ph-trash"></i> Xóa</button>
    </div>
    <div class="suite-card-fields">
      <label class="wide">Tên kịch bản<small>Tên gợi nhớ hiển thị trên dashboard (ví dụ: Smoke Tests, Admin Flows).</small>
        <input type="text" data-field="label" value="${escapeHtml(suite.label || '')}" placeholder="Ví dụ: Smoke Tests" required>
      </label>
      <label>Nhóm browser / Project<small>Browser áp dụng cho kịch bản.</small>
        <select data-field="project">${projectOptions}</select>
      </label>
      <label>Số luồng chạy (Workers)<small>Số browser chạy song song (1 - 8).</small>
        <input type="number" data-field="workers" min="1" max="8" value="${suite.workers || 2}">
      </label>
      <label class="wide">Kích thước màn hình (Viewport)<small>Độ phân giải browser chạy kịch bản này.</small>
        <select data-field="viewport-preset">
          <option value="default" ${vpPreset === 'default' ? 'selected' : ''}>🖥️ Mặc định theo hệ thống</option>
          <option value="1920x1080" ${vpPreset === '1920x1080' ? 'selected' : ''}>🖥️ Desktop Full HD (1920 x 1080)</option>
          <option value="1366x768" ${vpPreset === '1366x768' ? 'selected' : ''}>💻 Desktop Laptop (1366 x 768)</option>
          <option value="2560x1440" ${vpPreset === '2560x1440' ? 'selected' : ''}>🖥️ Desktop 2K (2560 x 1440)</option>
          <option value="390x844" ${vpPreset === '390x844' ? 'selected' : ''}>📱 Mobile iPhone (390 x 844)</option>
          <option value="360x800" ${vpPreset === '360x800' ? 'selected' : ''}>📱 Mobile Android (360 x 800)</option>
          <option value="custom" ${vpPreset === 'custom' ? 'selected' : ''}>⚙️ Tự nhập kích thước (Custom)</option>
        </select>
      </label>
      <div class="suite-custom-vp-box wide" ${vpPreset === 'custom' ? '' : 'style="display:none;"'}>
        <label>Chiều rộng (px)<input type="number" data-field="viewport-width" value="${vpWidth}" min="320" max="7680"></label>
        <label>Chiều cao (px)<input type="number" data-field="viewport-height" value="${vpHeight}" min="320" max="4320"></label>
      </div>
      
      <!-- SCOPE SELECTION SECTION -->
      <div class="suite-scope-section wide">
        <label class="suite-section-label">Phạm vi bài test (Test Scope)
          <small>Chọn 1 trong 3 cách thức chỉ định bài test cho kịch bản này.</small>
        </label>
        <div class="suite-scope-modes">
          <label class="scope-mode-option ${currentScopeMode === 'all' ? 'active' : ''}">
            <input type="radio" name="scope-mode-${id}" value="all" ${currentScopeMode === 'all' ? 'checked' : ''}>
            <div class="scope-mode-info">
              <strong>🌐 Toàn bộ dự án</strong>
              <small>Chạy tất cả các file test</small>
            </div>
          </label>
          <label class="scope-mode-option ${currentScopeMode === 'grep' ? 'active' : ''}">
            <input type="radio" name="scope-mode-${id}" value="grep" ${currentScopeMode === 'grep' ? 'checked' : ''}>
            <div class="scope-mode-info">
              <strong>🏷️ Lọc theo Tag</strong>
              <small>Ví dụ: @smoke, @regression</small>
            </div>
          </label>
          <label class="scope-mode-option ${currentScopeMode === 'custom' ? 'active' : ''}">
            <input type="radio" name="scope-mode-${id}" value="custom" ${currentScopeMode === 'custom' ? 'checked' : ''}>
            <div class="scope-mode-info">
              <strong>📑 Chọn từng File</strong>
              <small>Tích chọn các file cụ thể</small>
            </div>
          </label>
        </div>

        <!-- GREP BOX (Shown only when scope === 'grep') -->
        <div class="suite-scope-grep-box" ${currentScopeMode === 'grep' ? '' : 'style="display:none;"'}>
          <label>Nhập Tag hoặc Từ khóa cần lọc<small>Playwright sẽ tự động quét toàn bộ dự án để tìm các test case có tag này (ví dụ: <code>@smoke</code>, <code>@CompanySite</code>).</small>
            <input type="text" data-field="grep" value="${escapeHtml(suite.grep || '')}" placeholder="Ví dụ: @smoke hoặc @regression">
          </label>
        </div>

        <!-- FILES CHECKLIST (Shown only when scope === 'custom') -->
        <div class="suite-scope-files-box" ${currentScopeMode === 'custom' ? '' : 'style="display:none;"'}>
          <div class="suite-specs-actions">
            <span class="suite-selected-count">Đã chọn: ${selectedSpecs.length} file</span>
            <div class="suite-specs-actions-btns">
              <button type="button" class="btn-specs-action btn-select-all-specs">Chọn tất cả</button>
              <button type="button" class="btn-specs-action btn-deselect-all-specs">Bỏ chọn</button>
            </div>
          </div>
          <div class="suite-specs-checklist">
            ${specCheckboxes || '<p style="color:var(--muted); font-size:11px; padding:4px;">Chưa có file spec nào.</p>'}
          </div>
        </div>
      </div>
    </div>
  `;

  const labelInput = card.querySelector('[data-field="label"]');
  const titleSpan = card.querySelector('.suite-card-title');
  labelInput.addEventListener('input', () => {
    titleSpan.textContent = labelInput.value.trim() || 'Kịch bản mới';
  });

  const vpSelect = card.querySelector('[data-field="viewport-preset"]');
  const vpCustomBox = card.querySelector('.suite-custom-vp-box');
  vpSelect.addEventListener('change', () => {
    vpCustomBox.style.display = vpSelect.value === 'custom' ? 'grid' : 'none';
  });

  const grepBox = card.querySelector('.suite-scope-grep-box');
  const filesBox = card.querySelector('.suite-scope-files-box');
  const countSpan = card.querySelector('.suite-selected-count');
  
  const updateCount = () => {
    const checked = card.querySelectorAll('.suite-spec-cb:checked').length;
    if (countSpan) countSpan.textContent = `Đã chọn: ${checked} file`;
  };

  card.querySelectorAll(`input[name="scope-mode-${id}"]`).forEach((radio) => {
    radio.addEventListener('change', () => {
      card.querySelectorAll('.scope-mode-option').forEach((opt) => {
        opt.classList.toggle('active', opt.querySelector('input') === radio);
      });
      if (grepBox) grepBox.style.display = radio.value === 'grep' ? 'block' : 'none';
      if (filesBox) filesBox.style.display = radio.value === 'custom' ? 'flex' : 'none';
      updateCount();
    });
  });

  card.querySelectorAll('.suite-spec-cb').forEach((cb) => {
    cb.addEventListener('change', updateCount);
  });

  card.querySelector('.btn-select-all-specs')?.addEventListener('click', () => {
    card.querySelectorAll('.suite-spec-cb').forEach((cb) => { cb.checked = true; });
    updateCount();
  });

  card.querySelector('.btn-deselect-all-specs')?.addEventListener('click', () => {
    card.querySelectorAll('.suite-spec-cb').forEach((cb) => { cb.checked = false; });
    updateCount();
  });

  card.querySelector('.btn-delete-suite').addEventListener('click', () => {
    card.remove();
    checkEmptySuitesState();
  });

  return card;
}

function checkEmptySuitesState() {
  const container = $('#suites-settings-list');
  if (!container) return;
  if (container.querySelectorAll('.suite-card').length === 0) {
    container.innerHTML = `
      <div class="suite-empty-state">
        <i class="ph-bold ph-folder-notch-open" style="font-size: 24px; color: var(--muted);"></i>
        <p>Chưa có kịch bản test nào được thiết lập.</p>
        <small>Bấm "Thêm kịch bản mới" phía trên để tạo kịch bản đầu tiên.</small>
      </div>
    `;
  } else {
    const emptyState = container.querySelector('.suite-empty-state');
    if (emptyState) emptyState.remove();
  }
}

function renderSuiteSettingsCards(suites) {
  const container = $('#suites-settings-list');
  if (!container) return;
  container.innerHTML = '';
  const entries = Object.entries(suites || {});
  if (entries.length === 0) {
    checkEmptySuitesState();
    return;
  }
  entries.forEach(([id, suite]) => {
    container.appendChild(createSuiteCardElement(id, suite));
  });
}

function renderSettings(settings) {
  settingsCache = settings;
  renderSuiteSettingsCards(settings.suites || {});
  const environmentEntries = Object.entries(settings.environments || {});
  $('#environment-settings').innerHTML = environmentEntries.map(([key, env]) => `
    <div class="environment-row" data-env="${escapeHtml(key)}">
      <div class="environment-key"><strong>${escapeHtml(key)}</strong><small>${escapeHtml(env.label || key.toUpperCase())}</small></div>
      <div class="environment-fields">
        <label>Tên hiển thị<small>Tên dễ đọc của môi trường trong dashboard.</small><input data-setting="environment-label" value="${escapeHtml(env.label || '')}"></label>
        <label>URL website<small>Địa chỉ web seeker dùng cho UI test.</small><input data-setting="environment-base-url" value="${escapeHtml(env.baseURL || '')}"></label>
        <label>URL API<small>Địa chỉ API tương ứng với môi trường này.</small><input data-setting="environment-api-base-url" value="${escapeHtml(env.apiBaseURL || '')}"></label>
      </div>
    </div>
  `).join('');

  fillSettingSelect('#settings-default-environment', environmentEntries.map(([key]) => key), settings.runtime.defaultEnvironment);
  fillSettingSelect('#settings-trace', settings.options.trace, settings.runtime.trace);
  fillSettingSelect('#settings-screenshot', settings.options.screenshot, settings.runtime.screenshot);
  fillSettingSelect('#settings-video', settings.options.video, settings.runtime.video);

  setInputValue('#settings-workers', settings.runtime.workers);
  setInputValue('#settings-test-timeout', settings.runtime.testTimeout);
  setInputValue('#settings-navigation-timeout', settings.runtime.navigationTimeout);
  setInputValue('#settings-action-timeout', settings.runtime.actionTimeout);
  setInputValue('#settings-retries-local', settings.runtime.retriesLocal);
  setInputValue('#settings-retries-ci', settings.runtime.retriesCI);
  setInputValue('#settings-viewport-width', settings.runtime.viewport.width);
  setInputValue('#settings-viewport-height', settings.runtime.viewport.height);
  setChecked('#settings-show-env-banner', settings.runtime.showEnvBanner);
  setChecked('#settings-debug-optional-popups', settings.runtime.debugOptionalPopups);

  setInputValue('#settings-registration-token', '');
  setInputValue('#settings-api-branch', settings.api.branch);
  setInputValue('#settings-api-lang', settings.api.lang);
  setInputValue('#settings-register-retries', settings.api.registerRetries);
  setInputValue('#settings-register-timeout', settings.api.registerTimeout);
  setInputValue('#settings-consent-retries', settings.api.consentRetries);
  setInputValue('#settings-consent-timeout', settings.api.consentTimeout);
  $('#settings-token-status').textContent = settings.api.hasRegistrationBearerToken
    ? 'Đã lưu bearer token. Để trống ô token nếu không muốn thay đổi.'
    : 'Chưa có bearer token được lưu.';

  setInputValue('#settings-retention-days', settings.artifacts.retentionDays);
  setInputValue('#settings-max-reports-per-day', settings.artifacts.maxReportsPerDay);
  setChecked('#settings-auto-cleanup-evidence', settings.artifacts.autoCleanupEvidence);
  setChecked('#settings-auto-cleanup-reports', settings.artifacts.autoCleanupReports);

  if (settings.discord) {
    setInputValue('#settings-discord-webhook', settings.discord.webhookUrl);
    setInputValue('#settings-discord-channel', settings.discord.channelName);
    setChecked('#settings-discord-notify-finish', settings.discord.notifyOnFinish);
    setChecked('#settings-discord-notify-fail-only', settings.discord.notifyOnlyOnFailure);
  }

  if (settings.branding) {
    setInputValue('#settings-project-name', settings.branding.projectName);
    setInputValue('#settings-project-subtitle', settings.branding.projectSubtitle);
    setInputValue('#settings-page-title', settings.branding.pageTitle);
    setInputValue('#settings-logo-url', settings.branding.logoUrl);
    setInputValue('#settings-primary-color', settings.branding.primaryColor || '#1A2B4C');
    setInputValue('#settings-background-color', settings.branding.backgroundColor || '');
    setInputValue('#settings-font-size', settings.branding.fontSize || '14px');
    if ($('#settings-primary-color-picker') && /^#[0-9A-Fa-f]{6}$/.test(settings.branding.primaryColor)) {
      $('#settings-primary-color-picker').value = settings.branding.primaryColor;
    }
    if ($('#settings-background-color-picker') && /^#[0-9A-Fa-f]{6}$/.test(settings.branding.backgroundColor)) {
      $('#settings-background-color-picker').value = settings.branding.backgroundColor;
    }
    updateBrandingPreview();
  }
}

function updateBrandingPreview() {
  const name = $('#settings-project-name')?.value.trim() || 'CarThings Automation';
  const subtitle = $('#settings-project-subtitle')?.value.trim() || 'Playwright Dashboard';
  const title = $('#settings-page-title')?.value.trim() || name;
  const logoUrl = $('#settings-logo-url')?.value.trim();
  const primaryColor = $('#settings-primary-color')?.value.trim() || '#1A2B4C';
  const backgroundColor = $('#settings-background-color')?.value.trim() || '';
  const fontSize = $('#settings-font-size')?.value.trim() || '14px';
  const preview = $('#mockup-window') || $('.branding-preview');
  const logo = $('#branding-preview-logo');
  const favicon = $('#mockup-tab-favicon');

  if (!preview) return;

  if ($('#branding-preview-name')) $('#branding-preview-name').textContent = name;
  if ($('#branding-preview-subtitle')) $('#branding-preview-subtitle').textContent = subtitle;
  if ($('#branding-preview-title')) $('#branding-preview-title').textContent = title;

  if (logo) applyLogoElement(logo, logoUrl);
  if (favicon) applyLogoElement(favicon, logoUrl);

  // Sync primary color
  if (/^#[0-9A-Fa-f]{6}$/.test(primaryColor)) {
    if ($('#settings-primary-color-picker')) $('#settings-primary-color-picker').value = primaryColor;
    const swatchPreview = $('.color-picker-preview');
    if (swatchPreview) swatchPreview.style.backgroundColor = primaryColor;
  }

  document.querySelectorAll('.color-swatch-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.color?.toLowerCase() === primaryColor.toLowerCase());
  });

  // Sync background color
  const bgPickerPreview = $('.bg-picker-preview');
  if (/^#[0-9A-Fa-f]{6}$/.test(backgroundColor)) {
    if ($('#settings-background-color-picker')) $('#settings-background-color-picker').value = backgroundColor;
    if (bgPickerPreview) bgPickerPreview.style.backgroundColor = backgroundColor;
  } else {
    if (bgPickerPreview) bgPickerPreview.style.backgroundColor = 'var(--surface)';
  }

  document.querySelectorAll('.bg-swatch-btn').forEach((btn) => {
    const btnBg = btn.dataset.bg || '';
    btn.classList.toggle('active', btnBg.toLowerCase() === backgroundColor.toLowerCase());
  });

  // Sync font size buttons
  document.querySelectorAll('.font-size-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.size === fontSize);
  });

  if (primaryColor) preview.style.setProperty('--accent', primaryColor);
  else preview.style.removeProperty('--accent');

  const appBody = preview.querySelector('.mockup-app-body');
  if (backgroundColor) {
    preview.style.backgroundColor = backgroundColor;
    if (appBody) appBody.style.backgroundColor = backgroundColor;
  } else {
    preview.style.removeProperty('background-color');
    if (appBody) appBody.style.removeProperty('background-color');
  }

  applyFontScale(preview, fontSize);
}

function collectSettingsPayload() {
  const suites = {};
  document.querySelectorAll('#suites-settings-list .suite-card').forEach((card, index) => {
    const label = card.querySelector('[data-field="label"]')?.value.trim() || `Suite ${index + 1}`;
    const scopeRadio = card.querySelector(`input[name^="scope-mode-"]:checked`);
    const scopeMode = scopeRadio ? scopeRadio.value : 'all';
    let grep = '';
    let specs = 'all';
    let spec = 'all';

    if (scopeMode === 'grep') {
      grep = card.querySelector('[data-field="grep"]')?.value.trim() || '';
    } else if (scopeMode === 'custom') {
      const checkedBoxes = Array.from(card.querySelectorAll('.suite-spec-cb:checked')).map((cb) => cb.value);
      if (checkedBoxes.length > 0) {
        specs = checkedBoxes;
        spec = checkedBoxes.length === 1 ? checkedBoxes[0] : 'custom';
      }
    }

    const vpPreset = card.querySelector('[data-field="viewport-preset"]')?.value || 'default';
    let vpWidth = readNumber(card.querySelector('[data-field="viewport-width"]')?.value, 1920);
    let vpHeight = readNumber(card.querySelector('[data-field="viewport-height"]')?.value, 1080);
    if (vpPreset === '1920x1080') { vpWidth = 1920; vpHeight = 1080; }
    else if (vpPreset === '1366x768') { vpWidth = 1366; vpHeight = 768; }
    else if (vpPreset === '2560x1440') { vpWidth = 2560; vpHeight = 1440; }
    else if (vpPreset === '390x844') { vpWidth = 390; vpHeight = 844; }
    else if (vpPreset === '360x800') { vpWidth = 360; vpHeight = 800; }
    const viewport = { preset: vpPreset, width: vpWidth, height: vpHeight };

    let key = card.dataset.suiteId;
    if (!key || key.startsWith('suite-')) {
      key = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `suite-${index + 1}`;
    }
    suites[key] = { label, project, viewport, spec, specs, grep, workers };
  });

  const environments = {};
  document.querySelectorAll('.environment-row').forEach((row) => {
    environments[row.dataset.env] = {
      label: row.querySelector('[data-setting="environment-label"]').value,
      baseURL: row.querySelector('[data-setting="environment-base-url"]').value,
      apiBaseURL: row.querySelector('[data-setting="environment-api-base-url"]').value,
    };
  });

  const api = {
    branch: $('#settings-api-branch').value,
    lang: $('#settings-api-lang').value,
    registerRetries: readNumber('#settings-register-retries'),
    registerTimeout: readNumber('#settings-register-timeout'),
    consentRetries: readNumber('#settings-consent-retries'),
    consentTimeout: readNumber('#settings-consent-timeout'),
  };
  const token = $('#settings-registration-token').value.trim();
  if (token) api.registrationBearerToken = token;

  const discord = {
    webhookUrl: $('#settings-discord-webhook')?.value.trim() || '',
    channelName: $('#settings-discord-channel')?.value.trim() || '#qa-automation-reports',
    notifyOnFinish: $('#settings-discord-notify-finish')?.checked === true,
    notifyOnlyOnFailure: $('#settings-discord-notify-fail-only')?.checked === true,
  };

  return {
    suites,
    environments,
    runtime: {
      defaultEnvironment: $('#settings-default-environment').value,
      workers: readNumber('#settings-workers'),
      testTimeout: readNumber('#settings-test-timeout'),
      navigationTimeout: readNumber('#settings-navigation-timeout'),
      actionTimeout: readNumber('#settings-action-timeout'),
      retriesLocal: readNumber('#settings-retries-local'),
      retriesCI: readNumber('#settings-retries-ci'),
      trace: $('#settings-trace').value,
      screenshot: $('#settings-screenshot').value,
      video: $('#settings-video').value,
      viewport: {
        width: readNumber('#settings-viewport-width'),
        height: readNumber('#settings-viewport-height'),
      },
      showEnvBanner: $('#settings-show-env-banner').checked,
      debugOptionalPopups: $('#settings-debug-optional-popups').checked,
    },
    api,
    discord,
    artifacts: {
      retentionDays: readNumber('#settings-retention-days'),
      maxReportsPerDay: readNumber('#settings-max-reports-per-day'),
      autoCleanupEvidence: $('#settings-auto-cleanup-evidence').checked,
      autoCleanupReports: $('#settings-auto-cleanup-reports').checked,
    },
    branding: {
      projectName: $('#settings-project-name').value.trim(),
      projectSubtitle: $('#settings-project-subtitle').value.trim(),
      pageTitle: $('#settings-page-title').value.trim(),
      logoUrl: $('#settings-logo-url').value.trim(),
      primaryColor: $('#settings-primary-color').value.trim(),
      backgroundColor: $('#settings-background-color').value.trim(),
      fontSize: $('#settings-font-size').value.trim(),
    },
  };
}

function renderBotSettings(cfg, currentBranch = 'main') {
  if (!cfg) return;
  setInputValue('#settings-bot-token', '');
  const botTokenDesc = $('#settings-bot-token-desc');
  if (botTokenDesc) {
    botTokenDesc.textContent = cfg.hasDiscordToken
      ? `Đã lưu: ${cfg.discordToken} (để trống nếu giữ token cũ)`
      : 'Token xác thực bot (chưa lưu token).';
  }

  setInputValue('#settings-bot-channel-id', cfg.allowedChannelId || '');
  setInputValue('#settings-bot-gh-token', '');
  const ghTokenDesc = $('#settings-bot-gh-token-desc');
  if (ghTokenDesc) {
    ghTokenDesc.textContent = cfg.hasGithubToken
      ? `Đã lưu: ${cfg.githubToken} (để trống nếu giữ token cũ)`
      : 'GitHub Token quyền Workflow Dispatch (chưa lưu token).';
  }

  setInputValue('#settings-bot-gh-owner', cfg.githubOwner || 'hadinhkms');
  setInputValue('#settings-bot-gh-repo', cfg.githubRepo || 'Automation_Carthings');
  setInputValue('#settings-bot-gh-workflow', cfg.githubWorkflow || 'discord-run-playwright.yml');
  setInputValue('#settings-bot-gh-ref', cfg.githubRef || 'main');
  setInputValue('#settings-git-current-branch', `${currentBranch} (origin/${currentBranch})`);
}

async function openSettings() {
  try {
    const [settings, botData] = await Promise.all([
      request('/api/settings'),
      request('/api/discord-bot/config').catch(() => null)
    ]);
    renderSettings(settings);
    if (botData?.config) renderBotSettings(botData.config, botData.currentGitBranch);
  } catch (error) { notify(error.message); }
}

async function saveSettings() {
  const button = $('#save-settings-button');
  button.disabled = true;
  try {
    const botPayload = {
      discordToken: $('#settings-bot-token')?.value.trim() || undefined,
      allowedChannelId: $('#settings-bot-channel-id')?.value.trim(),
      githubToken: $('#settings-bot-gh-token')?.value.trim() || undefined,
      githubOwner: $('#settings-bot-gh-owner')?.value.trim(),
      githubRepo: $('#settings-bot-gh-repo')?.value.trim(),
      githubWorkflow: $('#settings-bot-gh-workflow')?.value.trim(),
      githubRef: $('#settings-bot-gh-ref')?.value.trim(),
    };

    const [result] = await Promise.all([
      request('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collectSettingsPayload()),
      }),
      request('/api/discord-bot/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(botPayload),
      }).catch((e) => console.error('Lưu Bot config:', e.message))
    ]);

    renderSettings(result.settings);
    if (result.settings.branding) applyAppConfig(result.settings.branding);
    notify(`${result.message} Backup: ${result.backup}`);
    const config = await request('/api/config');
    fillSelect('#environment', config.environments, '');
    if (config.defaults?.environment) $('#environment').value = config.defaults.environment;
    if (config.defaults?.workers) $('#workers').value = config.defaults.workers;

    testCatalog = { specs: config.specs, specProjects: config.specProjects || {}, projects: config.projects || [] };
    window.dashboardSuites = config.suites || {};
    renderRunnerSuiteOptions(window.dashboardSuites);
  } catch (error) { notify(error.message); }
  finally { button.disabled = false; }
}

$('#sync-git-button')?.addEventListener('click', async () => {
  const btn = $('#sync-git-button');
  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-spinner-gap"></i> Đang đồng bộ...';
  try {
    const result = await request('/api/git/sync', { method: 'POST' });
    notify(result.message || 'Đã đồng bộ hóa Test Suites lên GitHub thành công!');
  } catch (err) {
    notify(`Lỗi đồng bộ Git: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ph-bold ph-cloud-arrow-up"></i> Đồng bộ lên GitHub';
  }
});

$('#test-discord-button')?.addEventListener('click', async () => {
  const btn = $('#test-discord-button');
  const webhookUrl = $('#settings-discord-webhook')?.value.trim();
  const channelName = $('#settings-discord-channel')?.value.trim();
  if (!webhookUrl) {
    notify('Vui lòng dán Discord Webhook URL trước khi thử.');
    return;
  }
  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-spinner-gap"></i> Đang gửi...';
  try {
    const result = await request('/api/discord/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl, channelName }),
    });
    notify(result.message || 'Đã gửi tin nhắn thử nghiệm thành công về Discord!');
  } catch (err) {
    notify(`Gửi tin nhắn thử thất bại: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ph-bold ph-paper-plane-tilt"></i> Gửi tin nhắn thử';
  }
});

async function initialize() {
  try {
    const [config, state] = await Promise.all([request('/api/config'), request('/api/state')]);
    if (config.branding) applyAppConfig(config.branding);
    fillSelect('#environment', config.environments, '');
    fillSelect('#project', config.projects, 'Tất cả nhóm test');
    
    testCatalog = {
      specs: config.specs,
      specTags: config.specTags || {},
      availableTags: config.availableTags || [],
      specProjects: config.specProjects || {},
      projects: config.projects || [],
    };
    renderTagChips(config.availableTags || []);
    refreshSpecOptions();

    window.dashboardSuites = config.suites || {};
    renderRunnerSuiteOptions(window.dashboardSuites);

    if (config.defaults?.environment) $('#environment').value = config.defaults.environment;
    if (config.defaults?.workers) $('#workers').value = config.defaults.workers;
    state.logs.forEach((entry) => appendLog(entry.payload));
    renderRun(state.activeRun || state.lastRun);
  } catch (error) { notify(error.message); }

  const events = new EventSource('/api/events');
  events.onmessage = ({ data }) => {
    const event = JSON.parse(data);
    if (event.type === 'log') appendLog(event.payload);
    if (event.type === 'status') renderRun(event.payload);
  };
  events.onerror = () => notify('Mất kết nối tới dashboard server.');
}

document.querySelectorAll('.runner-mode-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    setRunnerMode(tab.dataset.mode);
  });
});

document.querySelectorAll('.runner-scope-tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.manualScope;
    document.querySelectorAll('.runner-scope-tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
    const fileBox = $('#runner-file-filter-box');
    const grepBox = $('#runner-grep-filter-box');
    if (fileBox) fileBox.style.display = mode === 'file' ? 'block' : 'none';
    if (grepBox) grepBox.style.display = mode === 'grep' ? 'block' : 'none';
    updateManualSpecsPreview();
  });
});

$('#runner-suite-select')?.addEventListener('change', (e) => {
  updateSuiteSummaryBox(e.target.value);
});

$('#add-suite-button')?.addEventListener('click', () => {
  const container = $('#suites-settings-list');
  if (!container) return;
  const emptyState = container.querySelector('.suite-empty-state');
  if (emptyState) emptyState.remove();
  const newId = `suite-${Date.now().toString(36)}`;
  const newCard = createSuiteCardElement(newId, {
    label: '',
    project: 'all',
    spec: 'all',
    grep: '',
    workers: 2,
  });
  container.appendChild(newCard);
  const labelInput = newCard.querySelector('[data-field="label"]');
  labelInput.focus();
});

document.querySelectorAll('.settings-subtab').forEach((tab) => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.subtab;
    document.querySelectorAll('.settings-subtab').forEach((t) => t.classList.toggle('active', t === tab));
    
    const suitesPanel = document.querySelector('.settings-suites');
    const brandingPanel = document.querySelector('.settings-branding');
    const discordPanel = document.querySelector('.settings-discord');
    const runtimePanel = document.querySelector('.settings-runtime');
    const envPanel = document.querySelector('.settings-environments');
    const apiPanel = document.querySelector('.settings-api');
    const artifactsPanel = document.querySelector('.settings-artifacts');

    if (suitesPanel) suitesPanel.hidden = target !== 'suites';
    if (brandingPanel) brandingPanel.hidden = target !== 'branding';
    if (discordPanel) discordPanel.hidden = target !== 'discord';
    
    const isGeneral = target === 'general';
    if (runtimePanel) runtimePanel.hidden = !isGeneral;
    if (envPanel) envPanel.hidden = !isGeneral;
    if (apiPanel) apiPanel.hidden = !isGeneral;
    if (artifactsPanel) artifactsPanel.hidden = !isGeneral;
  });
});

$('#test-discord-button')?.addEventListener('click', async () => {
  const button = $('#test-discord-button');
  const webhookUrl = $('#settings-discord-webhook')?.value.trim();
  if (!webhookUrl) {
    notify('Vui lòng nhập Discord Webhook URL trước khi bấm thử.');
    $('#settings-discord-webhook')?.focus();
    return;
  }
  button.disabled = true;
  button.innerHTML = '<i class="ph ph-spinner-gap"></i> Đang gửi...';
  try {
    const result = await request('/api/discord/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl }),
    });
    notify(result.message || 'Đã gửi tin nhắn thử nghiệm tới Discord!');
  } catch (err) {
    notify(err.message);
  } finally {
    button.disabled = false;
    button.innerHTML = '<i class="ph-bold ph-paper-plane-tilt"></i> Gửi tin nhắn thử';
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  let payload = {};
  if (currentRunnerMode === 'suite') {
    const suiteId = $('#runner-suite-select')?.value;
    const suite = window.dashboardSuites?.[suiteId] || {};
    let specs = suite.specs;
    if (!specs && suite.spec) specs = suite.spec === 'all' ? 'all' : [suite.spec];

    payload = {
      environment: $('#environment').value,
      project: suite.project || 'all',
      grep: suite.grep || '',
      workers: Number(suite.workers || 2),
      viewport: suite.viewport,
      suiteLabel: suite.label || suiteId,
      headed: $('#headed').checked,
    };
    if (Array.isArray(specs) && specs.length > 0) {
      payload.specs = specs;
    } else {
      payload.spec = 'all';
    }
  } else {
    let manualScope = 'all';
    document.querySelectorAll('.runner-scope-tab-btn').forEach((btn) => {
      if (btn.classList.contains('active')) manualScope = btn.dataset.manualScope;
    });

    let spec = 'all';
    let grep = '';
    if (manualScope === 'file') {
      spec = $('#spec')?.value || 'all';
    } else if (manualScope === 'grep') {
      grep = $('#grep')?.value.trim() || '';
    }

    payload = {
      environment: $('#environment').value,
      project: $('#project').value,
      spec,
      grep,
      workers: Number($('#workers').value),
      headed: $('#headed').checked,
    };
  }

  consoleOutput.textContent = '';
  $('#run-button').disabled = true;
  $('#run-button').innerHTML = '<i class="ph ph-spinner-gap"></i> Đang khởi động...';
  try {
    const run = await request('/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    renderRun(run);
  } catch (error) {
    notify(error.message);
    $('#run-button').disabled = false;
  } finally {
    $('#run-button').innerHTML = '<i class="ph-fill ph-play"></i> Chạy test';
  }
});

function selectedOptions() {
  if (currentRunnerMode === 'suite') {
    const suiteId = $('#runner-suite-select')?.value;
    const suite = window.dashboardSuites?.[suiteId] || {};
    let specs = suite.specs;
    if (!specs && suite.spec) specs = suite.spec === 'all' ? 'all' : [suite.spec];
    const opts = {
      environment: $('#environment').value,
      project: suite.project || 'all',
      grep: suite.grep || '',
      workers: Number(suite.workers || 2),
      headed: true,
    };
    if (Array.isArray(specs) && specs.length > 0) {
      opts.specs = specs;
    } else {
      opts.spec = 'all';
    }
    return opts;
  }
  let manualScope = 'all';
  document.querySelectorAll('.runner-scope-tab-btn').forEach((btn) => {
    if (btn.classList.contains('active')) manualScope = btn.dataset.manualScope;
  });

  let spec = 'all';
  let grep = '';
  if (manualScope === 'file') {
    spec = $('#spec')?.value || 'all';
  } else if (manualScope === 'grep') {
    grep = $('#grep')?.value.trim() || '';
  }

  return {
    environment: $('#environment').value,
    project: $('#project').value,
    spec,
    grep,
    workers: Number($('#workers').value),
    headed: true,
  };
}

$('#ui-button').addEventListener('click', async () => {
  const button = $('#ui-button');
  button.disabled = true;
  button.innerHTML = '<i class="ph ph-spinner-gap"></i> Đang mở UI...';
  try {
    const run = await request('/api/ui', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(selectedOptions()) });
    renderRun(run);
    notify('Playwright UI đang được mở trong cửa sổ riêng.');
  } catch (error) {
    notify(error.message);
    button.disabled = false;
  } finally {
    button.innerHTML = '<i class="ph ph-browser"></i> Mở Playwright UI';
  }
});

$('#stop-button').addEventListener('click', async () => {
  try { await request('/api/stop', { method: 'POST' }); } catch (error) { notify(error.message); }
});
$('#clear-button').addEventListener('click', () => { consoleOutput.textContent = ''; });
document.querySelectorAll('.view-tab').forEach((button) => button.addEventListener('click', async () => {
  document.querySelectorAll('.view-tab').forEach((tab) => { tab.classList.toggle('active', tab === button); tab.setAttribute('aria-selected', String(tab === button)); });
  document.querySelectorAll('.dashboard-view').forEach((view) => { const active = view.id === button.dataset.view; view.hidden = !active; view.classList.toggle('active', active); });
  if (button.dataset.view === 'resources-view') await openExplorer();
  if (button.dataset.view === 'code-view') await openCodeWorkspace();
  if (button.dataset.view === 'settings-view') await openSettings();
}));
document.querySelectorAll('.resource-filter').forEach((button) => button.addEventListener('click', () => {
  activeResourceCategory = button.dataset.category;
  document.querySelectorAll('.resource-filter').forEach((filter) => filter.classList.toggle('active', filter === button));
  renderResourceList($('#resource-search').value);
}));
$('#resource-search').addEventListener('input', (event) => renderResourceList(event.target.value));
$('#reveal-button').addEventListener('click', () => loadResource(currentResource, $('#reveal-button').dataset.revealed !== 'true'));
$('#edit-button').addEventListener('click', editCurrentResource);
$('#save-resource-button').addEventListener('click', saveCurrentResource);
$('#cancel-edit-button').addEventListener('click', () => loadResource(currentResource, false, currentResourceCategory));
$('#delete-button').addEventListener('click', deleteCurrentArtifact);
$('#previous-evidence').addEventListener('click', () => navigateEvidence(-1));
$('#next-evidence').addEventListener('click', () => navigateEvidence(1));
$('#code-search').addEventListener('input', renderCodeTree);
document.querySelectorAll('.code-root-filter').forEach((button) => button.addEventListener('click', () => {
  activeCodeRoot = button.dataset.root;
  document.querySelectorAll('.code-root-filter').forEach((filter) => filter.classList.toggle('active', filter === button));
  renderCodeTree();
}));
$('#code-editor').addEventListener('input', () => {
  const changed = $('#code-editor').value !== originalCodeContent;
  $('#code-preview code').innerHTML = highlightCode($('#code-editor').value, currentCodeFile?.endsWith('.json')) + '\n';
  $('#code-save-button').disabled = !changed;
  $('#code-cancel-button').hidden = !changed;
  $('#code-status-text').textContent = changed ? 'Đã chỉnh sửa' : 'Sẵn sàng';
});
$('#code-editor').addEventListener('scroll', () => {
  $('#code-preview').scrollTop = $('#code-editor').scrollTop;
  $('#code-preview').scrollLeft = $('#code-editor').scrollLeft;
});
$('#code-edit-button').addEventListener('click', enterCodeEditMode);
$('#code-format-button').addEventListener('click', formatCurrentCodeEditor);
$('#code-cancel-button').addEventListener('click', leaveCodeEditMode);
$('#code-save-button').addEventListener('click', saveCodeFile);
$('#format-resource-button').addEventListener('click', formatCurrentResourceEditor);
$('#reload-settings-button').addEventListener('click', openSettings);
$('#save-settings-button').addEventListener('click', saveSettings);
[
  '#settings-project-name',
  '#settings-project-subtitle',
  '#settings-page-title',
  '#settings-logo-url',
  '#settings-primary-color',
  '#settings-background-color',
  '#settings-font-size',
].forEach((selector) => $(selector)?.addEventListener('input', updateBrandingPreview));

$('#settings-primary-color-picker')?.addEventListener('input', (e) => {
  if ($('#settings-primary-color')) $('#settings-primary-color').value = e.target.value;
  updateBrandingPreview();
});

document.querySelectorAll('.color-swatch-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const color = btn.dataset.color;
    if ($('#settings-primary-color')) $('#settings-primary-color').value = color;
    if ($('#settings-primary-color-picker')) $('#settings-primary-color-picker').value = color;
    updateBrandingPreview();
  });
});

$('#settings-background-color-picker')?.addEventListener('input', (e) => {
  if ($('#settings-background-color')) $('#settings-background-color').value = e.target.value;
  updateBrandingPreview();
});

document.querySelectorAll('.bg-swatch-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const bg = btn.dataset.bg || '';
    if ($('#settings-background-color')) $('#settings-background-color').value = bg;
    if ($('#settings-background-color-picker') && bg) $('#settings-background-color-picker').value = bg;
    updateBrandingPreview();
  });
});

$('#btn-reset-bg-color')?.addEventListener('click', () => {
  if ($('#settings-background-color')) $('#settings-background-color').value = '';
  updateBrandingPreview();
});

document.querySelectorAll('.font-size-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const size = btn.dataset.size || '14px';
    if ($('#settings-font-size')) $('#settings-font-size').value = size;
    updateBrandingPreview();
  });
});

document.querySelectorAll('.guide-nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const step = btn.dataset.guideStep;
    document.querySelectorAll('.guide-nav-btn').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.guide-pane').forEach((pane) => {
      pane.classList.toggle('active', pane.id === `guide-pane-${step}`);
    });
  });
});

$('#theme-button').addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('playwright-dashboard-theme', theme);
  applyTheme(theme);
});

initialize();
