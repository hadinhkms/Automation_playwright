/**
 * dashboard/public/js/views/runner/runnerPickerLoader.js
 * Loads the Script Picker with a dynamic import so a broken/blocked picker file cannot break main.js's module
 * graph (the Settings and every other screen). If the import fails the Runner's "Chọn script" panel shows the
 * error and run requests carry an empty list (rejected by the server): nothing falls back to "run everything".
 */
export async function loadScriptPicker(win = window) {
  try {
    const { mountScriptPicker } = await import('./picker/pickerMount.js');
    return mountScriptPicker(win);
  } catch (err) {
    return blockedPicker(win, err);
  }
}

function blockedPicker(win, err) {
  const doc = win.document;
  const panel = doc.getElementById('runner-manual-mode');
  if (!panel) return null;
  console.error('[ScriptPicker] failed to load:', err);
  const box = doc.createElement('div');
  box.id = 'script-picker-error';
  box.className = 'sp-error';
  box.setAttribute('role', 'alert');
  box.textContent = `Không tải được bộ chọn script (${(err && err.message) || 'lỗi không rõ'}). Tải lại trang hoặc dùng tab Theo Test Suite.`;
  panel.prepend(box);
  doc.getElementById('runner-view')?.classList.add('has-script-picker'); // hides the old scope tabs here too
  win.ScriptPicker = { isActive: () => !panel.hidden, isReady: () => false, getRunPayload: () => ({ specs: [] }) };
  return { unmount() { box.remove(); doc.getElementById('runner-view')?.classList.remove('has-script-picker'); delete win.ScriptPicker; } };
}
