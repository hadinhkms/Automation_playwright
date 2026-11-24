/**
 * dashboard/public/js/views/runner/picker/pickerLegacyGuard.js
 * While the picker panel is shown, the old #run-button (hidden by CSS) must be REALLY out of service. The hero
 * #ui-button ("Mở Playwright UI") stays usable: it sends the picker's payload and the request wrapper refuses it when
 * nothing is selected or the catalog is not ready. #run-button: disabled,
 * out of the tab order and its clicks swallowed, so a script calling .click()/dispatchEvent cannot start the old
 * "run everything" path. The app's own disabled state (a run in progress) is remembered and given back exactly
 * when the picker panel is left (suite mode). app.js is not touched.
 */
function guardButton(win, selector, isVisible) {
  const doc = win.document;
  const btn = doc.querySelector(selector);
  const panel = doc.getElementById('runner-manual-mode');
  if (!btn || !panel) return () => {};
  let appDisabled = btn.disabled;
  let own = 0;
  const setDisabled = (v) => { if (btn.disabled !== v) { own += 1; btn.disabled = v; } };
  const sync = () => {
    if (isVisible()) {
      if (!btn.dataset.spLocked) { btn.dataset.spLocked = '1'; appDisabled = btn.disabled; }
      setDisabled(true);
      btn.setAttribute('aria-hidden', 'true');
      btn.tabIndex = -1;
    } else if (btn.dataset.spLocked) {
      delete btn.dataset.spLocked;
      setDisabled(appDisabled);
      btn.removeAttribute('aria-hidden');
      btn.removeAttribute('tabindex');
    }
  };
  const swallow = (e) => { if (isVisible()) { e.preventDefault(); e.stopImmediatePropagation(); } };
  btn.addEventListener('click', swallow, true);
  const watchBtn = new win.MutationObserver(() => {
    if (own > 0) { own -= 1; return; }
    if (btn.dataset.spLocked) { appDisabled = btn.disabled; setDisabled(true); } // the app changed it while locked
  });
  const watchPanel = new win.MutationObserver(sync);
  watchBtn.observe(btn, { attributes: true, attributeFilter: ['disabled'] });
  watchPanel.observe(panel, { attributes: true, attributeFilter: ['hidden'] });
  sync();
  return () => {
    watchBtn.disconnect(); watchPanel.disconnect(); btn.removeEventListener('click', swallow, true);
    if (btn.dataset.spLocked) { delete btn.dataset.spLocked; btn.disabled = appDisabled; btn.removeAttribute('aria-hidden'); btn.removeAttribute('tabindex'); }
  };
}

export function guardLegacyRunButton(win, isVisible) {
  return guardButton(win, '#run-button', isVisible);
}
