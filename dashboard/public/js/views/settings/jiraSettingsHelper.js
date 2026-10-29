/**
 * dashboard/public/js/views/settings/jiraSettingsHelper.js
 * Frontend controller for Jira Cloud Settings panel and interactive ticket preview.
 * Modularity ceiling <= 250 lines.
 */
import {
  showAlert,
  updateJiraStatusBadge,
  renderJiraIssueResult,
  renderJiraIssueError,
} from './jiraSettingsRenderer.js';

export function initJiraSettings() {
  const root = document.getElementById('settings-view');
  if (!root) return;

  const baseUrlInput = root.querySelector('#settings-jira-base-url');
  const emailInput = root.querySelector('#settings-jira-email');
  const tokenInput = root.querySelector('#settings-jira-token');
  const toggleEyeBtn = root.querySelector('#toggle-jira-token-vis');
  const pasteBtn = root.querySelector('#paste-jira-token');
  const testBtn = root.querySelector('#btn-test-jira');
  const saveBtn = root.querySelector('#btn-save-jira');
  const statusBadge = root.querySelector('#settings-jira-status-badge');
  const alertBox = root.querySelector('#settings-jira-status-alert');
  const alertTitle = root.querySelector('#settings-jira-alert-title');
  const alertMsg = root.querySelector('#settings-jira-alert-msg');
  const alertClose = root.querySelector('#settings-jira-alert-close');

  const fetchInput = root.querySelector('#jira-fetch-key-input');
  const fetchBtn = root.querySelector('#btn-fetch-jira-test');
  const fetchResult = root.querySelector('#jira-fetch-result');

  if (!saveBtn) return;

  function notify(msg) {
    if (typeof window.notify === 'function') window.notify(msg);
    else if (window.eventBus) window.eventBus.emit('ui:notify', { message: msg });
  }

  async function loadConfig() {
    try {
      const res = await fetch('/api/jira/config').then((r) => r.json());
      if (baseUrlInput && res.baseUrl) baseUrlInput.value = res.baseUrl;
      if (emailInput && res.email !== undefined) emailInput.value = res.email;
      updateJiraStatusBadge(statusBadge, tokenInput, res);
    } catch (err) {
      console.error('[JiraSettings] Lỗi nạp cấu hình:', err);
    }
  }

  loadConfig();

  if (saveBtn.dataset.jiraBound === 'true') return;
  saveBtn.dataset.jiraBound = 'true';

  alertClose?.addEventListener('click', () => { if (alertBox) alertBox.hidden = true; });

  toggleEyeBtn?.addEventListener('click', () => {
    if (!tokenInput) return;
    const isPass = tokenInput.type === 'password';
    tokenInput.type = isPass ? 'text' : 'password';
    toggleEyeBtn.innerHTML = isPass ? '<i class="ph ph-eye-slash"></i>' : '<i class="ph ph-eye"></i>';
  });

  pasteBtn?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && tokenInput) {
        tokenInput.value = text.trim();
        notify('Đã dán Jira Token từ Clipboard!');
      }
    } catch {
      notify('Không thể đọc Clipboard. Hãy dán bằng tay (Ctrl+V).');
    }
  });

  testBtn?.addEventListener('click', async () => {
    testBtn.disabled = true;
    testBtn.innerHTML = '<i class="ph ph-spinner-gap spin"></i> Đang kiểm tra...';
    try {
      const payload = {
        baseUrl: baseUrlInput?.value?.trim() || '',
        email: emailInput?.value?.trim() || '',
        apiToken: tokenInput?.value?.trim() || '',
      };
      const res = await fetch('/api/jira/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then((r) => r.json());

      if (res.success) {
        showAlert(alertBox, alertTitle, alertMsg, true, 'Kết nối Jira thành công!', `Tài khoản: ${res.displayName} (${res.emailAddress}) | TimeZone: ${res.timeZone || 'UTC'}`);
        notify(`Kết nối Jira thành công với tài khoản: ${res.displayName}`);
      } else {
        showAlert(alertBox, alertTitle, alertMsg, false, 'Kết nối thất bại', res.error || 'Vui lòng kiểm tra lại URL, Email và API Token.');
      }
    } catch (err) {
      showAlert(alertBox, alertTitle, alertMsg, false, 'Lỗi kết nối Jira', err.message);
    } finally {
      testBtn.disabled = false;
      testBtn.innerHTML = '<i class="ph-bold ph-plugs"></i> Kiểm tra kết nối';
    }
  });

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="ph ph-spinner-gap spin"></i> Đang lưu...';
    try {
      const payload = {
        baseUrl: baseUrlInput?.value?.trim() || '',
        email: emailInput?.value?.trim() || '',
        apiToken: tokenInput?.value?.trim() || '',
      };
      const res = await fetch('/api/jira/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then((r) => r.json());

      if (res.error) throw new Error(res.error);
      showAlert(alertBox, alertTitle, alertMsg, true, 'Đã lưu cấu hình Jira', res.message || 'Cấu hình Jira đã được ghi vào file .env thành công.');
      notify('Đã lưu cấu hình Jira vào file .env!');
      if (tokenInput) tokenInput.value = '';
      await loadConfig();
    } catch (err) {
      showAlert(alertBox, alertTitle, alertMsg, false, 'Lỗi lưu cấu hình Jira', err.message);
      notify(err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="ph-fill ph-floppy-disk"></i> Lưu cấu hình Jira';
    }
  });

  fetchBtn?.addEventListener('click', async () => {
    const rawKey = fetchInput?.value?.trim();
    if (!rawKey) {
      notify('Vui lòng nhập mã ticket hoặc link Jira (VD: JS-8824)');
      return;
    }
    fetchBtn.disabled = true;
    fetchBtn.innerHTML = '<i class="ph ph-spinner-gap spin"></i> Đang đọc ticket...';
    if (fetchResult) {
      fetchResult.hidden = false;
      fetchResult.innerHTML = '<div style="padding: 16px; color: var(--muted);"><i class="ph ph-spinner-gap spin"></i> Đang tải dữ liệu từ Jira Cloud...</div>';
    }
    try {
      const res = await fetch(`/api/jira/issue?key=${encodeURIComponent(rawKey)}`).then((r) => r.json());
      if (!res.success) throw new Error(res.error || 'Không thể tải ticket');
      renderJiraIssueResult(fetchResult, res);
      notify(`Đã đọc thành công ticket ${res.key}!`);
    } catch (err) {
      renderJiraIssueError(fetchResult, err.message);
      notify(err.message);
    } finally {
      fetchBtn.disabled = false;
      fetchBtn.innerHTML = '<i class="ph-bold ph-ticket"></i> Đọc thử ticket';
    }
  });
}

if (typeof window !== 'undefined') {
  window.initJiraSettings = initJiraSettings;
}
