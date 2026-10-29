'use strict';

/**
 * dashboard/public/js/views/qa/analyzer/reqAnalyzerModalState.js
 * Loading states, AI readiness checks, and modal visibility toggles for Requirement Analyzer.
 * Modularity ceiling <= 150 lines.
 */

import { apiClient } from '../../../core/apiClient.js';
import { toast } from '../../../core/toast.js';

export const SAMPLE_REQUIREMENT_TEXT = [
  'Tính năng: Bổ sung trường "Trung tâm sát hạch" trên Hồ sơ Giáo viên',
  '1. Bối cảnh:',
  '- Hồ sơ giáo viên có thêm trường "Trung tâm sát hạch" đứng cạnh "Trung tâm đang công tác".',
  '- Cho phép chọn từ danh sách hoặc "Thêm trung tâm mới".',
  '- Có nút "Dùng lại trung tâm đang công tác".',
  '',
  '2. Quy tắc nghiệp vụ:',
  '- MST KHÔNG bắt buộc khi tạo trung tâm sát hạch mới.',
  '- Bắt buộc cả khi tạo mới và cập nhật.',
  '- Nâng giới hạn chọn phường/xã từ 6 lên 10 mục.',
  '- Nút dùng lại tự động ẩn sau khi bấm.'
].join('\n');

export function setAnalyzerText(textarea, text) {
  if (!textarea) return;
  textarea.value = text;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

export function setLoadingState(root, isLoading, isError = false) {
  const inputSection = root.querySelector('#qa-req-analyzer-input-section');
  const loadingSection = root.querySelector('#qa-req-analyzer-loading');
  const resultsSection = root.querySelector('#qa-req-analyzer-results-section');
  if (isLoading) {
    if (inputSection) inputSection.style.display = 'none';
    if (loadingSection) loadingSection.style.display = 'block';
    if (resultsSection) resultsSection.style.display = 'none';
  } else if (isError) {
    if (loadingSection) loadingSection.style.display = 'none';
    if (inputSection) inputSection.style.display = 'flex';
    if (resultsSection) resultsSection.style.display = 'none';
  } else {
    if (loadingSection) loadingSection.style.display = 'none';
    if (inputSection) inputSection.style.display = 'none';
    if (resultsSection) resultsSection.style.display = 'flex';
  }
}

export async function checkAiStatus(root) {
  const badge = root.querySelector('#qa-req-analyzer-ai-badge');
  if (!badge) return;
  badge.textContent = 'Đang kiểm tra AI...';
  try {
    const config = await apiClient.get('/api/ai/config');
    if (config && config.hasKey) {
      badge.textContent = `🟢 Sẵn sàng (${config.provider} - ${config.model})`;
      badge.style.color = 'var(--success)';
    } else {
      badge.textContent = '⚪ Chưa cấu hình Key';
      badge.style.color = 'var(--danger)';
    }
  } catch (_) {
    badge.textContent = '⚪ Không khả dụng';
  }
}

export function showInputView(root) {
  const inputSection = root.querySelector('#qa-req-analyzer-input-section');
  const loadingSection = root.querySelector('#qa-req-analyzer-loading');
  const resultsSection = root.querySelector('#qa-req-analyzer-results-section');
  const copyBtn = root.querySelector('#qa-req-analyzer-btn-copy');
  const scaffoldBtn = root.querySelector('#qa-req-analyzer-btn-scaffold');

  if (inputSection) inputSection.style.display = 'flex';
  if (loadingSection) loadingSection.style.display = 'none';
  if (resultsSection) resultsSection.style.display = 'none';
  if (copyBtn) copyBtn.style.display = 'none';
  if (scaffoldBtn) scaffoldBtn.style.display = 'none';
}

export async function fetchJiraTicket(root, jiraKeyInput, fetchJiraBtn) {
  const key = (jiraKeyInput?.value || '').trim();
  if (!key) return toast.info('Vui lòng nhập mã hoặc URL Jira (VD: JS-8824)');
  if (fetchJiraBtn) fetchJiraBtn.disabled = true;
  try {
    const res = await apiClient.get(`/api/jira/issue?key=${encodeURIComponent(key)}`);
    if (!res?.success) throw new Error(res?.error || 'Không thể tải ticket từ Jira');
    const textarea = root.querySelector('#qa-req-analyzer-text');
    setAnalyzerText(textarea, res.formattedForReq || res.summary);
    if (jiraKeyInput) jiraKeyInput.value = res.key;
    toast.success(`Đã nạp ticket ${res.key} từ Jira thành công!`);
  } catch (e) {
    toast.error(e.message || 'Lỗi đọc ticket Jira. Kiểm tra cấu hình trong Settings > Jira.');
  } finally {
    if (fetchJiraBtn) fetchJiraBtn.disabled = false;
  }
}
