/**
 * dashboard/public/js/views/settings/jiraSettingsHelper.js
 * Frontend controller for Jira Cloud Settings panel and interactive ticket preview.
 * Modularity ceiling <= 250 lines.
 */

let jiraInitialized = false;

export function initJiraSettings() {
  const root = document.getElementById('settings-view') || document;
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

  function showAlert(success, title, msg) {
    if (!alertBox) return;
    alertBox.hidden = false;
    alertBox.className = `settings-card settings-card-wide settings-ai-alert ${success ? 'settings-ai-alert--success' : 'settings-ai-alert--error'}`;
    const icon = alertBox.querySelector('.settings-ai-alert-icon');
    if (icon) icon.className = success ? 'ph-fill ph-check-circle settings-ai-alert-icon' : 'ph-fill ph-warning-circle settings-ai-alert-icon';
    if (alertTitle) alertTitle.textContent = title;
    if (alertMsg) alertMsg.textContent = msg;
  }

  function notify(msg) {
    if (typeof window.notify === 'function') window.notify(msg);
    else if (window.eventBus) window.eventBus.emit('ui:notify', { message: msg });
  }

  async function loadConfig() {
    try {
      const res = await fetch('/api/jira/config').then((r) => r.json());
      if (baseUrlInput && res.baseUrl) baseUrlInput.value = res.baseUrl;
      if (emailInput && res.email) emailInput.value = res.email;
      if (statusBadge) {
        if (res.hasToken) {
          statusBadge.className = 'settings-badge-status is-active';
          statusBadge.innerHTML = `<i class="ph-fill ph-check-circle"></i> Đã kết nối (${res.maskedToken || 'Token hợp lệ'})`;
          if (tokenInput) tokenInput.placeholder = 'Đã có token (Nhập token mới nếu muốn thay đổi)';
        } else {
          statusBadge.className = 'settings-badge-status';
          statusBadge.innerHTML = '<i class="ph-fill ph-circle"></i> Chưa cấu hình token';
          if (tokenInput) tokenInput.placeholder = 'Dán Jira API Token vào đây (ATATT...)';
        }
      }
    } catch (err) {
      console.error('[JiraSettings] Lỗi nạp cấu hình:', err);
    }
  }

  loadConfig();

  if (jiraInitialized) return;
  jiraInitialized = true;

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
      const payload = {};
      const b = baseUrlInput?.value?.trim();
      const em = emailInput?.value?.trim();
      const tk = tokenInput?.value?.trim();
      if (b) payload.baseUrl = b;
      if (em) payload.email = em;
      if (tk) payload.apiToken = tk;
      const res = await fetch('/api/jira/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then((r) => r.json());

      if (res.success) {
        showAlert(true, 'Kết nối Jira thành công!', `Tài khoản: ${res.displayName} (${res.emailAddress}) | TimeZone: ${res.timeZone || 'UTC'}`);
        notify(`Kết nối Jira thành công với tài khoản: ${res.displayName}`);
      } else {
        showAlert(false, 'Kết nối thất bại', res.error || 'Vui lòng kiểm tra lại URL, Email và API Token.');
      }
    } catch (err) {
      showAlert(false, 'Lỗi kết nối Jira', err.message);
    } finally {
      testBtn.disabled = false;
      testBtn.innerHTML = '<i class="ph-bold ph-plugs"></i> Kiểm tra kết nối';
    }
  });

  saveBtn?.addEventListener('click', async () => {
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
      showAlert(true, 'Đã lưu cấu hình Jira', res.message || 'Cấu hình Jira đã được ghi vào file .env thành công.');
      notify('Đã lưu cấu hình Jira vào file .env!');
      if (tokenInput) tokenInput.value = '';
      await loadConfig();
    } catch (err) {
      showAlert(false, 'Lỗi lưu cấu hình Jira', err.message);
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
      fetchResult.innerHTML = '<div style="padding: 16px; color: var(--muted);">'
        + '<i class="ph ph-spinner-gap spin"></i> Đang tải dữ liệu từ Jira Cloud...</div>';
    }
    try {
      const res = await fetch(`/api/jira/issue?key=${encodeURIComponent(rawKey)}`).then((r) => r.json());
      if (!res.success) throw new Error(res.error || 'Không thể tải ticket');

      const acItems = (res.acs || [])
        .map((ac, idx) => `<li><strong>AC-${idx + 1}:</strong> ${escapeHtml(ac)}</li>`)
        .join('');
      const badgeType = `<span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; `
        + `background: rgba(59,130,246,0.15); color: #3b82f6;">${escapeHtml(res.issueType)}</span>`;
      const badgeStatus = `<span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; `
        + `background: rgba(16,185,129,0.15); color: #10b981;">${escapeHtml(res.status)}</span>`;
      const jiraLink = `<a href="${escapeHtml(res.url)}" target="_blank" rel="noopener" `
        + `style="font-size: 12px; color: var(--accent); display: flex; align-items: center; gap: 4px;">`
        + `<i class="ph ph-arrow-square-out"></i> Mở trên Jira</a>`;
      const acBlock = acItems
        ? `<div style="margin-bottom: 10px;">`
          + `<strong style="font-size: 12px; color: var(--accent);">`
          + `Tiêu chí Acceptance Criteria trích xuất (${res.acs.length}):</strong>`
          + `<ul style="margin: 4px 0 0; padding-left: 18px; font-size: 12px; color: var(--text);">${acItems}</ul>`
          + `</div>`
        : '';
      const preStyle = 'margin: 0; padding: 10px; background: rgba(0,0,0,0.25); border-radius: 6px; '
        + 'font-size: 11.5px; max-height: 180px; overflow-y: auto; white-space: pre-wrap; '
        + 'font-family: var(--font-mono); color: var(--text);';

      fetchResult.innerHTML = `
        <div style="padding: 14px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 8px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="settings-badge-status is-active" style="font-weight: 700;">${escapeHtml(res.key)}</span>
              ${badgeType}
              ${badgeStatus}
            </div>
            ${jiraLink}
          </div>
          <h4 style="margin: 0 0 8px; font-size: 14px; color: var(--text);">${escapeHtml(res.summary)}</h4>
          <div style="font-size: 12px; color: var(--muted); margin-bottom: 10px;">
            Assignee: <strong>${escapeHtml(res.assignee)}</strong> | Priority: <strong>${escapeHtml(res.priority)}</strong>
          </div>
          ${acBlock}
          <div style="font-size: 11px; font-weight: 600; color: var(--muted); margin-bottom: 4px;">Mô tả chi tiết:</div>
          <pre style="${preStyle}">${escapeHtml(res.descriptionMarkdown || 'Không có mô tả')}</pre>
        </div>
      `;
      notify(`Đã đọc thành công ticket ${res.key}!`);
    } catch (err) {
      if (fetchResult) {
        fetchResult.innerHTML = '<div style="padding: 12px; color: #f85149; '
          + 'background: rgba(248,81,73,0.1); border-radius: 6px; font-size: 12px;">'
          + `<i class="ph ph-warning-circle"></i> ${escapeHtml(err.message)}</div>`;
      }
      notify(err.message);
    } finally {
      fetchBtn.disabled = false;
      fetchBtn.innerHTML = '<i class="ph-bold ph-ticket"></i> Đọc thử ticket';
    }
  });
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>'"]/g, (tag) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag] || tag));
}

if (typeof window !== 'undefined') {
  window.initJiraSettings = initJiraSettings;
}
