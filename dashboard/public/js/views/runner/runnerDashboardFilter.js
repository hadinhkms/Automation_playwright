/**
 * dashboard/public/js/views/runner/runnerDashboardFilter.js
 * L2: the Runner view hides the tool's own tests (tests/dashboard/) from its file list, tag chips and
 * previews, with a "Hiện test của Dashboard" switch (remembered in localStorage). Display only: the
 * catalog, saved suites and what a run executes are untouched. Wraps app.js globals from outside
 * (app.js is frozen by check:limits). Classic script + CommonJS. Strict ceiling <= 150 lines.
 */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RunnerDashboardFilter = factory();
})(typeof self !== 'undefined' ? self : this, function() {
  const PREFIX = 'tests/dashboard/';
  const KEY = 'runner.showDashboardTests';

  const isInternal = (p) => typeof p === 'string' && p.replace(/\\/g, '/').startsWith(PREFIX);

  function readShow(storage) {
    try { return Boolean(storage) && storage.getItem(KEY) === '1'; } catch (_) { return false; }
  }
  function writeShow(storage, on) {
    try { if (storage) storage.setItem(KEY, on ? '1' : '0'); } catch (_) { /* private mode: keep in memory only */ }
  }

  /** Tags that exist only in internal specs are dropped from the chips; tags of app specs stay. */
  function visibleTags(tags, specTags) {
    const keep = new Set();
    Object.entries(specTags || {}).forEach(([spec, list]) => { if (!isInternal(spec)) (list || []).forEach((t) => keep.add(t)); });
    return (tags || []).filter((t) => keep.has(t));
  }

  /** Remove internal items from a rendered list; fix the leading number of the count label. */
  function pruneList(container, countEl, itemSelector) {
    if (!container) return 0;
    const hidden = Array.from(container.querySelectorAll(itemSelector)).filter((el) => isInternal(el.getAttribute('title')));
    hidden.forEach((el) => el.remove());
    if (hidden.length && countEl) {
      const m = /^(\d+)(.*)$/.exec(countEl.textContent.trim());
      if (m) countEl.textContent = `${Math.max(0, Number(m[1]) - hidden.length)}${m[2]} (+${hidden.length} test Dashboard đang ẩn)`;
    }
    return hidden.length;
  }

  function install(win) {
    const doc = win.document;
    const store = (() => { try { return win.localStorage; } catch (_) { return null; } })();
    const state = { show: readShow(store) };
    const wrap = (name, make) => { if (typeof win[name] === 'function') win[name] = make(win[name]); };
    const catalog = () => (typeof testCatalog === 'undefined' ? {} : testCatalog) || {};

    wrap('refreshSpecOptions', (orig) => function guardedOptions() {
      const result = orig.apply(this, arguments);
      const select = doc.querySelector('#spec');
      if (select && !state.show) {
        Array.from(select.options).forEach((o) => { if (isInternal(o.value) && o.value !== select.value) o.remove(); });
      }
      return result;
    });
    wrap('renderTagChips', (orig) => function guardedChips(tags) {
      return orig.call(this, state.show ? tags : visibleTags(tags, catalog().specTags));
    });
    const afterRender = (name, fn) => wrap(name, (orig) => function guarded() {
      const result = orig.apply(this, arguments);
      if (!state.show) fn();
      return result;
    });
    afterRender('updateManualSpecsPreview', () => {
      const h = pruneList(doc.querySelector('#manual-specs-preview-list'), doc.querySelector('#manual-specs-preview-count'), '.suite-summary-pill');
      const title = doc.querySelector('#manual-specs-preview-title');
      if (h && title) title.textContent = title.textContent.replace(/\d+/, (n) => String(Math.max(0, Number(n) - h)));
    });
    afterRender('updateSuiteSummaryBox', () => pruneList(doc.querySelector('#suite-sum-files-list'), doc.querySelector('#suite-sum-count'), '.suite-summary-pill'));
    afterRender('updateExecutionPlanBox', () => pruneList(doc.querySelector('#execution-plan-list'), doc.querySelector('#execution-plan-count'), '.plan-spec-item'));

    function refreshAll() {
      const c = catalog();
      if (typeof win.refreshSpecOptions === 'function' && c.specs) win.refreshSpecOptions();
      if (typeof win.renderTagChips === 'function') win.renderTagChips(c.availableTags || []);
      if (typeof win.updateManualSpecsPreview === 'function') win.updateManualSpecsPreview();
      const suite = doc.querySelector('#runner-suite-select');
      if (typeof win.updateSuiteSummaryBox === 'function') win.updateSuiteSummaryBox(suite && suite.value);
      if (typeof win.updateExecutionPlanBox === 'function') win.updateExecutionPlanBox(suite && suite.value);
    }

    // app.js bound these two by reference at load (before wrapping), so re-run the wrapped version after them.
    const again = (selector, event, name) => {
      const el = doc.querySelector(selector);
      if (el) el.addEventListener(event, () => { if (typeof win[name] === 'function') win[name](); });
    };
    again('#project', 'change', 'refreshSpecOptions');
    again('#grep', 'input', 'updateManualSpecsPreview');

    const switcher = doc.querySelector('#runner-view .runner-mode-switcher');
    if (switcher && !doc.getElementById('runner-show-dashboard-tests')) {
      const label = doc.createElement('label');
      label.className = 'runner-dashboard-toggle';
      const box = doc.createElement('input');
      box.type = 'checkbox';
      box.id = 'runner-show-dashboard-tests';
      box.checked = state.show;
      box.addEventListener('change', () => { state.show = box.checked; writeShow(store, state.show); refreshAll(); });
      label.append(box, doc.createTextNode(' Hiện test của Dashboard'));
      switcher.insertAdjacentElement('afterend', label);
    }
    return { state, refreshAll };
  }

  const api = { isInternal, visibleTags, pruneList, readShow, writeShow, install, KEY, PREFIX };
  if (typeof window !== 'undefined' && window.document) api.instance = install(window);
  return api;
});
