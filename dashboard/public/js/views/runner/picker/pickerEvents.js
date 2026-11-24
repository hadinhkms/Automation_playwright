/**
 * dashboard/public/js/views/runner/picker/pickerEvents.js
 * Delegated events of the picker: clicks (chips, rows, links, run), search input, switch, tree keyboard,
 * Ctrl+Enter and "/". Pure wiring: all state changes go through pickerState / the controller's render helpers.
 */
import { toggleFile, toggleGroup, selectVisible, clearFilters, toggleIn } from './pickerState.js';
import { quickSuites } from './pickerToolbar.js';
import { replaceSelection, restore } from './pickerQuickApply.js';
import { tagsFromGrep } from './pickerPayload.js';
import { handleTreeKey } from './pickerKeys.js';

export function bindEvents({ root, doc, win, ctx, view, groupFiles, renderTop, renderBody, renderFoot, changed, load, isActive, refreshHistory, $ }) {
  const flash = () => { setTimeout(() => { ctx.undo = null; renderTop(); }, 6000); };
  function applySuite(s) {
    const paths = s.specs === 'all' ? ctx.catalog.files.map((f) => f.path) : s.specs;
    replaceSelection(ctx, paths, { source: s.label, projects: s.project && s.project !== 'all' ? [s.project] : [], tags: tagsFromGrep(s.grep) || [] });
    flash();
  }
  function applyHistory(btn) {
    const h = ctx.history;
    if (btn.dataset.history === 'fail') replaceSelection(ctx, h.latest.specs, { source: 'Fail lần trước', projects: h.latest.run.projects || [], missing: h.latest.missing.length });
    else {
      const run = h.runs.find((r) => r.id === btn.dataset.historyRun);
      if (!run) return;
      const paths = run.specs && run.specs.length ? run.specs : ctx.catalog.files.map((f) => f.path);
      replaceSelection(ctx, paths, { source: 'Chạy gần đây', projects: run.projects || [], tags: run.tags || [], missing: paths.filter((p) => !ctx.catalog.byPath.has(p)).length });
    }
    flash(); renderTop(); changed();
  }
  const actions = {
    focus(el) { $('#sp-body').querySelectorAll('[tabindex="0"]').forEach((n) => n.setAttribute('tabindex', '-1')); el.setAttribute('tabindex', '0'); ctx.focusKey = el.dataset.key; el.focus(); },
    expand(el, open) { const key = el.dataset.group; if (open) ctx.state.collapsed.delete(key); else ctx.state.collapsed.add(key); ctx.focusKey = el.dataset.key; renderBody(); },
    toggle(el) { ctx.focusKey = el.dataset.key; if (el.dataset.group) toggleGroup(ctx.state, groupFiles(el.dataset.group)); else toggleFile(ctx.state, el.dataset.path); changed(); },
    selectAll() { selectVisible(ctx.state, view().found); changed(); },
    focusSearch() { $('#sp-search')?.focus(); },
  };
  const act = {
    'clear-query': () => { ctx.state.query = ''; const i = $('#sp-search'); i.value = ''; i.focus(); renderTop(); changed(); },
    'clear-filters': () => { clearFilters(ctx.state); ctx.state.tagOnly = false; renderTop(); changed(); },
    'select-found': () => { const f = view().found; selectVisible(ctx.state, f, !f.every((x) => ctx.state.selected.has(x.path))); renderTop(); changed(); },
    retry: () => load(),
    'focus-tree': () => $('[role="treeitem"][tabindex="0"]')?.focus(),
    'open-projects': () => { ctx.projectsOpen = !ctx.projectsOpen; if (!ctx.projectsOpen) ctx.state.projects.clear(); renderFoot(); },
    undo: () => { if (ctx.undo) { restore(ctx.state, ctx.undo.prev); ctx.undo = null; renderTop(); changed(); } },
    'history-retry': () => refreshHistory(),
    'copy-cmd': () => { win.navigator.clipboard?.writeText(view().info.command).catch(() => null); const b = $('[data-act="copy-cmd"]'); b.textContent = 'Đã sao chép'; setTimeout(() => { if (b.isConnected) b.textContent = 'Sao chép lệnh'; }, 2000); },
    run: () => { if (view().info.canRun) { ctx.notice = `Đã gửi yêu cầu chạy ${ctx.state.selected.size} script`; renderFoot(); doc.getElementById('run-form')?.requestSubmit(); } },
  };
  function onClick(e) {
    const t = e.target;
    const hist = t.closest('[data-history],[data-history-run]');
    if (hist && !hist.disabled) { applyHistory(hist); return; }
    const chip = t.closest('[data-platform],[data-tag],[data-suite],[data-project]');
    if (chip) {
      if (chip.dataset.platform) toggleIn(ctx.state.platforms, chip.dataset.platform);
      else if (chip.dataset.tag) { toggleIn(ctx.state.tags, chip.dataset.tag); if (!ctx.state.tags.size) ctx.state.tagOnly = false; }
      else if (chip.dataset.project) toggleIn(ctx.state.projects, chip.dataset.project);
      else { const s = quickSuites(ctx.suites).find((x) => x.key === chip.dataset.suite); applySuite(s); }
      renderTop(); changed(); return;
    }
    const a = t.closest('[data-act]');
    const item = t.closest('[role="treeitem"]');
    if (a && item && ['file', 'group', 'expand'].includes(a.dataset.act)) {
      if (a.dataset.act === 'expand') actions.expand(item, item.getAttribute('aria-expanded') !== 'true'); else actions.toggle(item);
      return;
    }
    if (item && t.closest('.sp-row')) { actions.toggle(item); return; }
    if (a && act[a.dataset.act]) { act[a.dataset.act](); return; }
    const go = t.closest('[data-view-go]');
    if (go) win.__STUDIO_CORE__?.featureRegistry.switchView(go.dataset.viewGo);
  }
  root.addEventListener('click', onClick);
  root.addEventListener('input', (e) => { if (e.target.id === 'sp-search') { ctx.state.query = e.target.value; $('.sp-clear').hidden = !e.target.value; changed(); } });
  root.addEventListener('change', (e) => { if (e.target.id === 'sp-tagonly') { ctx.state.tagOnly = e.target.checked; renderTop(); changed(); } });
  root.addEventListener('keydown', (e) => {
    if (e.target.id === 'sp-search' && e.key === 'Escape' && ctx.state.query) { e.preventDefault(); act['clear-query'](); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); act.run(); return; }
    handleTreeKey(e, $('.sp-tree') || doc.createElement('ul'), actions);
  });
  // "/" focuses the search box only for a plain key press outside anything editable (m1).
  const typing = (t) => Boolean(t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable || (t.closest && t.closest('[contenteditable=""], [contenteditable="true"]'))));
  const onSlash = (e) => { if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.defaultPrevented && isActive() && !typing(e.target)) { e.preventDefault(); actions.focusSearch(); } };
  doc.addEventListener('keydown', onSlash);

  return () => doc.removeEventListener('keydown', onSlash);
}
