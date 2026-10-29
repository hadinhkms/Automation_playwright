'use strict';

/**
 * dashboard/public/js/views/qa/slices/qaBddDraftController.js
 * Sinh, sao chép, đóng và phóng to khung bản thảo BDD cho Test Candidates (DOM-safe).
 */

import { apiClient } from '../../../core/apiClient.js';

export async function generateBddDraft(qaSlice) {
  const root = qaSlice._root();
  if (!root || !qaSlice.pickedIds.size) return;
  const box = root.querySelector('#qa-draft');
  const body = root.querySelector('#qa-draft-body');
  const meta = root.querySelector('#qa-draft-meta');
  const warn = root.querySelector('#qa-draft-warnings');
  if (!box || !body) return;

  box.hidden = false;
  body.style.width = '100%';
  body.style.maxWidth = 'none';
  body.textContent = 'Đang dựng bản thảo…';
  if (warn) warn.textContent = '';
  if (meta) meta.textContent = '';

  const ids = [...qaSlice.pickedIds].sort();
  let res;
  try {
    res = await apiClient.get('/api/qa/bdd-draft', { ids: ids.join(',') });
  } catch (error) {
    body.textContent = '';
    if (meta) meta.textContent = '';
    if (warn) {
      warn.textContent = '';
      warn.appendChild(qaSlice._el('p', `Không dựng được bản thảo: ${error.message}`, 'qa-draft-error'));
    }
    return;
  }

  const disclaimer = '# Lưu ý: Bản thảo KHÔNG được lưu lại (tự sinh từ tài liệu hiện tại).\n\n';
  qaSlice.draftText = disclaimer + (res.text || '');
  body.textContent = qaSlice.draftText;
  if (meta) {
    const missing = (res.missing || []).length ? ` · không có trong tài liệu: ${res.missing.join(', ')}` : '';
    meta.textContent = `${(res.ids || []).length} test case · dựng từ ${(res.dirs || {}).testCases}/${missing}`;
  }
  if (warn) {
    warn.textContent = '';
    for (const w of res.warnings || []) warn.appendChild(qaSlice._el('p', w, 'qa-draft-warn'));
  }
  body.scrollTop = 0;
}

export async function copyBddDraft(qaSlice) {
  const root = qaSlice._root();
  const copyBtn = root && root.querySelector('#qa-draft-copy');
  const status = root && root.querySelector('#qa-draft-meta');
  if (!qaSlice.draftText) return;
  try {
    await navigator.clipboard.writeText(qaSlice.draftText);
    qaSlice.notify('Đã sao chép kịch bản BDD vào bộ nhớ tạm.');
    if (copyBtn) {
      const span = copyBtn.querySelector('span');
      const origLabel = span ? span.textContent : '';
      if (span) span.textContent = 'Đã sao chép!';
      copyBtn.style.borderColor = 'var(--success, #10b981)';
      copyBtn.style.color = 'var(--success, #10b981)';
      setTimeout(() => {
        if (span) span.textContent = origLabel || 'Sao chép';
        copyBtn.style.borderColor = '';
        copyBtn.style.color = '';
      }, 1800);
    }
  } catch (_) {
    const body = root && root.querySelector('#qa-draft-body');
    if (body && window.getSelection) {
      const range = document.createRange();
      range.selectNodeContents(body);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    if (status) status.textContent = 'Trình duyệt chặn clipboard — nội dung đã được bôi đen, bấm Ctrl+C.';
  }
}

export function closeBddDraft(qaSlice) {
  const root = qaSlice._root();
  const box = root && root.querySelector('#qa-draft');
  if (!box) return;
  box.classList.remove('is-fullscreen');
  const expandIcon = box.querySelector('#qa-draft-expand-icon');
  const expandLabel = box.querySelector('#qa-draft-expand-label');
  const expandBtn = box.querySelector('#qa-draft-expand');
  if (expandIcon) expandIcon.className = 'ph-bold ph-corners-out';
  if (expandLabel) expandLabel.textContent = 'Phóng to';
  if (expandBtn) expandBtn.title = 'Phóng to toàn màn hình';
  box.hidden = true;
}

export function toggleBddDraftFullscreen(qaSlice, forceState) {
  const root = qaSlice._root();
  const box = root && root.querySelector('#qa-draft');
  if (!box) return;
  const isFull = typeof forceState === 'boolean' ? forceState : !box.classList.contains('is-fullscreen');
  box.classList.toggle('is-fullscreen', isFull);
  const expandIcon = box.querySelector('#qa-draft-expand-icon');
  const expandLabel = box.querySelector('#qa-draft-expand-label');
  const expandBtn = box.querySelector('#qa-draft-expand');
  if (expandIcon) expandIcon.className = isFull ? 'ph-bold ph-corners-in' : 'ph-bold ph-corners-out';
  if (expandLabel) expandLabel.textContent = isFull ? 'Thu nhỏ' : 'Phóng to';
  if (expandBtn) expandBtn.title = isFull ? 'Thu nhỏ khung xem (Esc)' : 'Phóng to toàn màn hình';
}

