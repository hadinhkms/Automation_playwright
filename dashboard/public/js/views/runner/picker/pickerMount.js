/**
 * dashboard/public/js/views/runner/picker/pickerMount.js
 * Mounts the Script Picker in the Runner view's "Chọn script" mode (replaces the old Tất cả / 1 File / Theo Tag
 * scope tabs). Controller only: state in pickerState, drawing in pickerTree/Toolbar/Footer, legacy contact in
 * pickerBridge. Delegated events, one render function per region (the search input is never re-created).
 */
import { apiClient } from '../../../core/apiClient.js';
import { buildCatalog } from './pickerModel.js';
import { createState, pruneMissing } from './pickerState.js';
import { renderTree, firstKey } from './pickerTree.js';
import { renderToolbar, renderResultsLine } from './pickerToolbar.js';
import { renderFooter, renderProjects } from './pickerFooter.js';
import { skeleton, emptyCatalog, loadError, noMatch } from './pickerStatus.js';
import { bindEvents } from './pickerEvents.js';
import { deriveView } from './pickerView.js';
import { exposeScriptPicker, bridgeLegacy } from './pickerBridge.js';
import { followAccent } from './pickerContrast.js';
import { escapeHtml } from './pickerText.js';

let current = null;

export function mountScriptPicker(win = window) {
  if (current) return current;
  const doc = win.document;
  const panel = doc.getElementById('runner-manual-mode');
  if (!panel) return null;
  const root = doc.createElement('div');
  root.id = 'script-picker';
  root.className = 'sp';
  root.innerHTML = '<div class="sp-head"><p class="sp-eyebrow">CHỌN SCRIPT</p><h3>Chạy test nào?</h3></div><div id="sp-top"></div><div id="sp-body"></div><div id="sp-foot"></div>';
  panel.prepend(root);
  doc.getElementById('runner-view')?.classList.add('has-script-picker');
  const tab = doc.querySelector('.runner-mode-tab[data-mode="manual"]');
  if (tab) tab.innerHTML = '<i class="ph-bold ph-list-checks"></i> Chọn script';

  const ctx = { catalog: null, state: createState(), phase: 'loading', slow: false, error: '', runError: '', notice: '', running: false, focusKey: '', suites: {}, projectsOpen: false, undo: null };
  const $ = (sel) => root.querySelector(sel);
  const controls = () => ({
    environment: doc.querySelector('#environment')?.value || '', workers: Number(doc.querySelector('#workers')?.value) || 2, headed: Boolean(doc.querySelector('#headed')?.checked),
    frozen: (() => { const b = doc.querySelector('#runner-freeze-banner'); return Boolean(b && win.getComputedStyle(b).display !== 'none'); })(),
  });
  const view = () => deriveView(ctx, controls());
  const isVisible = () => !panel.hidden; // M1: the old payload (= run everything) must never apply while this panel is shown
  const isReady = () => ctx.phase === 'ready';
  const isActive = () => isReady() && isVisible();

  function renderFoot() {
    if (ctx.phase !== 'ready') { $('#sp-foot').innerHTML = ''; return; }
    const v = view();
    $('#sp-foot').innerHTML = renderProjects({ chosen: v.info.projects, options: v.options, override: ctx.state.projects.size > 0, open: ctx.projectsOpen }) + renderFooter(v.info);
    win.updateExecutionPlanBox?.();
  }
  function renderBody(keepFocus = true) {
    if (ctx.phase !== 'ready') {
      $('#sp-top').innerHTML = '';
      $('#sp-body').innerHTML = ctx.phase === 'error' ? loadError(ctx.error) : (ctx.phase === 'empty' ? emptyCatalog() : (ctx.slow !== null ? skeleton(ctx.slow) : ''));
      return;
    }
    const v = view();
    const hadFocus = keepFocus && $('#sp-body').contains(doc.activeElement);
    $('#sp-results').innerHTML = renderResultsLine({ state: ctx.state, found: v.found, activeFilters: v.activeFilters });
    if (!ctx.focusKey || ![...v.visibleByGroup.values()].flat().length) ctx.focusKey = firstKey(ctx.catalog, v.visibleByGroup);
    $('#sp-body').innerHTML = v.found.length ? renderTree(ctx.catalog, v.visibleByGroup, ctx.state, ctx.focusKey) : noMatch(ctx.state, v.activeLabel);
    if (hadFocus) $(`[data-key="${CSS.escape(ctx.focusKey)}"]`)?.focus();
  }
  function renderTop() {
    if (ctx.phase !== 'ready') return;
    const v = view();
    const keep = doc.activeElement && root.contains(doc.activeElement) ? doc.activeElement.closest('[data-platform],[data-tag],[data-suite]') : null;
    const sig = keep && (keep.dataset.platform ? `[data-platform="${CSS.escape(keep.dataset.platform)}"]` : keep.dataset.tag ? `[data-tag="${CSS.escape(keep.dataset.tag)}"]` : `[data-suite="${CSS.escape(keep.dataset.suite)}"]`);
    $('#sp-top').innerHTML = renderToolbar({ catalog: ctx.catalog, state: ctx.state, suites: ctx.suites, found: v.found, filtersOpen: win.matchMedia('(min-width: 768px)').matches || v.activeFilters > 0, activeFilters: v.activeFilters })
      + (ctx.undo ? `<p class="sp-banner" role="status">${escapeHtml(ctx.undo.text)} <button type="button" class="sp-link" data-act="undo">Hoàn tác</button></p>` : '');
    if (sig) $(sig)?.focus();
  }
  const renderAll = () => { renderTop(); renderBody(false); renderFoot(); };
  const changed = () => { ctx.runError = ''; ctx.notice = ''; renderBody(); renderFoot(); };
  const groupFiles = (key) => view().visibleByGroup.get(key) || [];

  async function load() {
    ctx.phase = 'loading'; ctx.slow = null; ctx.error = '';
    renderAll();
    const t1 = setTimeout(() => { if (ctx.phase === 'loading') { ctx.slow = false; renderBody(); } }, 100);
    const t2 = setTimeout(() => { if (ctx.phase === 'loading') { ctx.slow = true; renderBody(); } }, 3000);
    try {
      const config = await apiClient.get('/api/config');
      ctx.catalog = buildCatalog(config);
      ctx.suites = config.suites || {};
      pruneMissing(ctx.state, ctx.catalog);
      ctx.phase = ctx.catalog.files.length ? 'ready' : 'empty';
    } catch (err) { ctx.phase = 'error'; ctx.error = err.message || 'lỗi không rõ'; } finally { clearTimeout(t1); clearTimeout(t2); }
    renderAll();
  }

  const unbind = bindEvents({ root, doc, win, ctx, view, groupFiles, renderTop, renderBody, renderFoot, changed, load, isActive, $ });

  const stop = doc.querySelector('#stop-button');
  const watcher = stop ? new win.MutationObserver(() => { ctx.running = !stop.disabled; renderFoot(); }) : null;
  watcher?.observe(stop, { attributes: true, attributeFilter: ['disabled'] });
  ['#environment', '#workers', '#headed'].forEach((s) => doc.querySelector(s)?.addEventListener('change', renderFoot));

  const api = {
    isActive: isVisible, isReady, selectedFiles: () => (isReady() ? view().selected : []),
    getRunPayload: () => (isReady() ? view().payload : { specs: [] }), // not ready: an empty list the server rejects (400)
    runSucceeded: () => { ctx.runError = ''; renderFoot(); },
    runFailed: (err) => { ctx.notice = ''; ctx.runError = err.status === 409 ? 'Đang có một test run khác. Chờ chạy xong hoặc bấm Dừng.' : `Chưa chạy được: ${err.message}. Lựa chọn của bạn vẫn còn — sửa rồi bấm Chạy lại.`; renderFoot(); },
  };
  const stopAccent = followAccent(win, root);
  const undoExpose = exposeScriptPicker(win, api);
  const undoBridge = bridgeLegacy(win, api);
  if (tab && doc.querySelector('.runner-mode-tab.active')?.dataset.mode === 'suite') tab.click(); // the picker is the default mode (HANDOFF 1)
  load();
  current = {
    api, ctx,
    unmount() { root.remove(); doc.getElementById('runner-view')?.classList.remove('has-script-picker'); unbind(); watcher?.disconnect(); stopAccent(); undoBridge(); undoExpose(); current = null; },
  };
  return current;
}
