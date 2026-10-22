/**
 * dashboard/public/js/views/settings/jiraSettingsRenderer.js
 * DOM rendering and markup formatting for Jira Settings panel.
 * Modularity ceiling <= 150 lines.
 */
'use strict';

export function escapeHtml(str) {
  return String(str || '').replace(/[&<>'"]/g, (tag) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag] || tag));
}

export function showAlert(alertBox, alertTitle, alertMsg, success, title, msg) {
  if (!alertBox) return;
  alertBox.hidden = false;
  alertBox.className = `settings-card settings-card-wide settings-ai-alert ${success ? 'settings-ai-alert--success' : 'settings-ai-alert--error'}`;
  const icon = alertBox.querySelector('.settings-ai-alert-icon');
  if (icon) icon.className = success ? 'ph-fill ph-check-circle settings-ai-alert-icon' : 'ph-fill ph-warning-circle settings-ai-alert-icon';
  if (alertTitle) alertTitle.textContent = title;
  if (alertMsg) alertMsg.textContent = msg;
}

export function updateJiraStatusBadge(statusBadge, tokenInput, res) {
  if (!statusBadge) return;
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

export function renderJiraIssueResult(container, res) {
  if (!container) return;
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

  container.innerHTML = `
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
}

export function renderJiraIssueError(container, message) {
  if (!container) return;
  container.innerHTML = '<div style="padding: 12px; color: #f85149; '
    + 'background: rgba(248,81,73,0.1); border-radius: 6px; font-size: 12px;">'
    + `<i class="ph ph-warning-circle"></i> ${escapeHtml(message)}</div>`;
}
