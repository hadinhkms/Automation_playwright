/**
 * dashboard/public/js/views/runner/runnerTagGuard.js
 * R1: in "Theo Tag" a typed text with no valid @tag (e.g. "smoke") produced grep "" and ran EVERYTHING.
 * Now the run buttons are blocked with a clear warning and the previews do not claim a match. Only tags
 * starting with @ are filterable; the raw text is never passed as grep. Classic script wrapping app.js
 * globals from outside (app.js is frozen by check:limits) + CommonJS. Strict ceiling <= 150 lines.
 */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RunnerTagGuard = factory();
})(typeof self !== 'undefined' ? self : this, function() {
  const MESSAGE = 'Chỉ lọc được theo tag bắt đầu bằng @, ví dụ @smoke.';

  /** True when the box has text but not one valid @tag token. */
  function isInvalidTagText(text) {
    const value = String(text || '').trim();
    return value.length > 0 && !/@[\w-]+/.test(value);
  }

  function install(win) {
    const doc = win.document;
    const input = doc.querySelector('#grep');
    if (!input) return null;

    const tagScopeActive = () => Boolean(doc.querySelector('.runner-mode-tab.active[data-mode="manual"]')
      && doc.querySelector('.runner-scope-tab-btn.active[data-manual-scope="grep"]'));
    const blocked = () => tagScopeActive() && isInvalidTagText(input.value);

    let warning = doc.getElementById('runner-tag-warning');
    if (!warning) {
      warning = doc.createElement('p');
      warning.id = 'runner-tag-warning';
      warning.className = 'runner-tag-warning';
      warning.setAttribute('role', 'alert');
      warning.textContent = MESSAGE;
      warning.hidden = true;
      (input.closest('label') || input).insertAdjacentElement('afterend', warning);
    }

    const buttons = () => ['#run-button', '#ui-button'].map((s) => doc.querySelector(s)).filter(Boolean);
    // app.js disables these buttons itself while a run is active. Remember what it wants (appDisabled) and
    // give back exactly that when the tag box is valid again, never a blind "enabled".
    const own = new WeakMap(); // button -> number of our own pending `disabled` mutations
    const setDisabled = (b, value) => { if (b.disabled !== value) { own.set(b, (own.get(b) || 0) + 1); b.disabled = value; } };
    function evaluate() {
      const bad = blocked();
      warning.hidden = !bad;
      buttons().forEach((b) => {
        if (bad) {
          if (!b.dataset.tagBlocked) { b.dataset.tagBlocked = '1'; b.dataset.appDisabled = b.disabled ? '1' : '0'; }
          setDisabled(b, true);
          b.title = MESSAGE;
        } else if (b.dataset.tagBlocked) {
          delete b.dataset.tagBlocked;
          setDisabled(b, b.dataset.appDisabled === '1');
          delete b.dataset.appDisabled;
          b.removeAttribute('title');
        }
      });
      return bad;
    }
    const watcher = new win.MutationObserver((records) => records.forEach((r) => {
      const b = r.target;
      if ((own.get(b) || 0) > 0) { own.set(b, own.get(b) - 1); return; }
      if (!b.dataset.tagBlocked) return;
      b.dataset.appDisabled = b.disabled ? '1' : '0'; // the app changed it while we hold it: remember, keep it locked
      setDisabled(b, true);
    }));
    buttons().forEach((b) => watcher.observe(b, { attributes: true, attributeFilter: ['disabled'] }));

    // Authoritative guard, even if app.js re-enables a button: the run never starts while blocked.
    const stop = (e) => { if (blocked()) { e.preventDefault(); e.stopImmediatePropagation(); evaluate(); } };
    doc.querySelector('#run-form')?.addEventListener('submit', stop, true);
    doc.querySelector('#ui-button')?.addEventListener('click', stop, true);

    ['input', 'change', 'click'].forEach((evt) => doc.addEventListener(evt, (e) => {
      if (evt !== 'click' || (e.target.closest && e.target.closest('.runner-mode-tab, .runner-scope-tab-btn, .tag-chip-btn'))) setTimeout(evaluate, 0);
    }, true));

    const wrap = (name, make) => { if (typeof win[name] === 'function') win[name] = make(win[name]); };
    const noMatch = (listSel, countSel, titleSel, text) => {
      const list = doc.querySelector(listSel); if (list) list.innerHTML = `<span style="color:var(--muted); font-size:11px; padding:4px;">${text}</span>`;
      const count = doc.querySelector(countSel); if (count) count.textContent = '0';
      const title = titleSel && doc.querySelector(titleSel); if (title) title.textContent = 'Chưa có tag hợp lệ';
    };
    wrap('updateManualSpecsPreview', (orig) => function guardedPreview() {
      const result = orig.apply(this, arguments);
      if (blocked()) noMatch('#manual-specs-preview-list', '#manual-specs-preview-count', '#manual-specs-preview-title', MESSAGE);
      return result;
    });
    wrap('updateExecutionPlanBox', (orig) => function guardedPlan() {
      const result = orig.apply(this, arguments);
      if (blocked()) noMatch('#execution-plan-list', '#execution-plan-count', null, MESSAGE);
      return result;
    });
    evaluate();
    return { evaluate, blocked };
  }

  const api = { isInvalidTagText, MESSAGE, install };
  if (typeof window !== 'undefined' && window.document) api.instance = install(window);
  return api;
});
