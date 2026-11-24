/**
 * dashboard/public/js/views/runner/picker/pickerBridge.js
 * The only contact surface with the legacy app.js (classic script, frozen by check:limits):
 *  - window.ScriptPicker {isActive, getRunPayload}: app.js asks it for the payload (1 line at each run point);
 *  - the "Execution plan" box on the right shows the picked files;
 *  - POST /api/run failures are shown inline (S8/S10) in addition to app.js's toast.
 * app.js functions are window properties (function declarations), so wrapping them here is seen by its callers.
 */
import { escapeHtml } from './pickerText.js';

export const NOT_READY = 'Danh sách script chưa sẵn sàng. Chờ tải xong, bấm Thử lại hoặc dùng tab Theo Test Suite.';

export function exposeScriptPicker(win, api) {
  win.ScriptPicker = { isActive: api.isActive, getRunPayload: api.getRunPayload, isReady: api.isReady };
  return () => { delete win.ScriptPicker; };
}

function planHtml(files) {
  return files.map((f) => `<div class="plan-spec-item" title="${escapeHtml(f.path)}"><div class="plan-spec-main"><i class="ph-bold ph-file-js"></i><span class="plan-spec-name">${escapeHtml(f.name)}</span></div>
    <div class="plan-spec-meta"><span class="plan-pill pill-platform">${escapeHtml(f.platform)}</span>${f.tags.slice(0, 3).map((t) => `<span class="plan-pill pill-tag">${escapeHtml(t)}</span>`).join('')}</div></div>`).join('');
}

/** Wrap app.js globals; returns the restore function. */
export function bridgeLegacy(win, api) {
  const doc = win.document;
  const restores = [];
  const wrap = (name, make) => {
    const orig = win[name];
    if (typeof orig !== 'function') return;
    win[name] = make(orig);
    restores.push(() => { win[name] = orig; });
  };
  wrap('updateExecutionPlanBox', (orig) => function pickerPlan() {
    const result = orig.apply(this, arguments);
    if (!api.isActive()) return result;
    const files = api.selectedFiles();
    const list = doc.querySelector('#execution-plan-list');
    const count = doc.querySelector('#execution-plan-count');
    const target = doc.querySelector('#execution-plan-target');
    if (count) count.textContent = `${files.length} script`;
    if (target) target.textContent = 'Chọn script';
    if (list) list.innerHTML = files.length ? planHtml(files) : '<div class="plan-empty"><i class="ph-bold ph-info"></i><span>Chưa chọn script nào</span></div>';
    return result;
  });
  wrap('request', (orig) => async function pickerRequest(url, options) {
    if ((url === '/api/run' || url === '/api/ui') && api.isActive() && !api.isReady()) {
      const err = new Error(NOT_READY); // loading / error / empty catalog: nothing is selectable, so nothing runs
      api.runFailed(err);
      throw err;
    }
    try {
      const body = await orig.apply(this, arguments);
      if (url === '/api/run' && api.isActive()) api.runSucceeded();
      return body;
    } catch (err) {
      if (url === '/api/run' && api.isActive() && api.isReady()) api.runFailed(err);
      throw err;
    }
  });
  return () => restores.forEach((r) => r());
}
