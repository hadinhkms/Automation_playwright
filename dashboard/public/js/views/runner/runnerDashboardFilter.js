/**
 * dashboard/public/js/views/runner/runnerDashboardFilter.js
 * The tool's own tests (tests/dashboard/) cannot run through this runner (CONTRACT D4). The Script Picker
 * leaves them out of its catalog; this keeps them out of the "Theo Test Suite" previews too, with a count of
 * what is hidden. Display only: saved suites and the run payload are untouched. Wraps app.js globals from
 * outside (app.js is frozen by check:limits). Classic script + CommonJS. Strict ceiling <= 150 lines.
 */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RunnerDashboardFilter = factory();
})(typeof self !== 'undefined' ? self : this, function() {
  const PREFIX = 'tests/dashboard/';
  const isInternal = (p) => typeof p === 'string' && p.replace(/\\/g, '/').startsWith(PREFIX);

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
    const wrap = (name, fn) => {
      if (typeof win[name] !== 'function') return;
      const orig = win[name];
      win[name] = function guarded() { const result = orig.apply(this, arguments); fn(); return result; };
    };
    wrap('updateSuiteSummaryBox', () => pruneList(doc.querySelector('#suite-sum-files-list'), doc.querySelector('#suite-sum-count'), '.suite-summary-pill'));
    wrap('updateExecutionPlanBox', () => pruneList(doc.querySelector('#execution-plan-list'), doc.querySelector('#execution-plan-count'), '.plan-spec-item'));
  }

  const api = { isInternal, pruneList, install, PREFIX };
  if (typeof window !== 'undefined' && window.document) install(window);
  return api;
});
