'use strict';

/**
 * dashboard/public/js/views/qa/slices/qaConflictSlice.js
 * Quản lý giao diện xử lý xung đột truy vết (Conflict Studio) và xóa Requirement an toàn (DOM-safe).
 */

import { apiClient } from '../../../core/apiClient.js';

function createFileImpactRow({ checked, disabled, chkClass, labelText, labelColor, relPath, noteText }) {
  const row = document.createElement('label');
  row.style.cssText = `display: flex; align-items: center; gap: 8px; cursor: ${disabled ? 'default' : 'pointer'};`;

  const chk = document.createElement('input');
  chk.type = 'checkbox';
  chk.checked = Boolean(checked);
  chk.disabled = Boolean(disabled);
  if (chkClass) chk.className = chkClass;
  chk.style.accentColor = 'var(--danger, #ef4444)';

  const span = document.createElement('span');
  const strong = document.createElement('strong');
  strong.style.color = labelColor || 'var(--text)';
  strong.textContent = `${labelText}: `;

  const code = document.createElement('code');
  code.className = 'qa-mono';
  code.textContent = relPath;

  span.append(strong, code);
  if (noteText) {
    const small = document.createElement('small');
    small.style.color = 'var(--muted)';
    small.textContent = ` ${noteText}`;
    span.appendChild(small);
  }

  row.append(chk, span);
  return row;
}

export class QaConflictSlice {
  constructor(qaSlice) {
    this.qaSlice = qaSlice;
    this._deleteTargetReqId = null;
  }

  renderConflicts(root) {
    if (this.qaSlice.conflictStudio && typeof this.qaSlice.conflictStudio.render === 'function') {
      this.qaSlice.conflictStudio.render(root);
    }
  }

  getReqIdFromDoc(doc) {
    if (!doc) return null;
    const fromPath = String(doc.path || '').match(/\b(REQ-\d{3})\b/i);
    if (fromPath) return fromPath[1].toUpperCase();
    const fromContent = String(doc.content || '').match(/^id:\s*(REQ-\d{3})\b/im);
    if (fromContent) return fromContent[1].toUpperCase();
    return null;
  }

  async openDeleteRequirementModal(docArg) {
    const root = this.qaSlice._root();
    const doc = docArg || this.qaSlice._activeDoc;
    if (!root || !doc) return;
    const modal = root.querySelector('#qa-delete-req-modal');
    if (!modal) return;

    const reqId = this.getReqIdFromDoc(doc);
    if (!reqId) {
      this.qaSlice.notify('Không xác định được mã REQ của tài liệu này.');
      return;
    }

    this._deleteTargetReqId = reqId;

    const targetIdEl = root.querySelector('#qa-delete-target-id');
    const hintEl = root.querySelector('#qa-delete-confirm-hint');
    const inputEl = root.querySelector('#qa-delete-confirm-input');
    const submitBtn = root.querySelector('#qa-delete-submit-btn');
    const listEl = root.querySelector('#qa-delete-files-list');

    if (targetIdEl) targetIdEl.textContent = reqId;
    if (hintEl) hintEl.textContent = reqId;
    if (inputEl) inputEl.value = '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.style.cursor = 'not-allowed';
      submitBtn.style.opacity = '0.5';
    }

    if (listEl) {
      listEl.textContent = 'Đang quét các file liên đới...';
    }

    try { modal.showModal(); } catch (_) { modal.setAttribute('open', ''); }

    try {
      const impact = await apiClient.get('/api/qa/requirement/impact', { reqId });
      if (!listEl) return;
      listEl.textContent = '';

      const reqFiles = impact.files?.requirements || [];
      const tcFiles = impact.files?.testCases || [];
      const specFiles = impact.files?.specs || [];

      if (!reqFiles.length && !tcFiles.length && !specFiles.length) {
        const empty = document.createElement('span');
        empty.style.color = 'var(--muted)';
        empty.textContent = 'Không tìm thấy file liên quan trên đĩa.';
        listEl.appendChild(empty);
        return;
      }

      reqFiles.forEach((f) => listEl.appendChild(createFileImpactRow({
        checked: true, disabled: true, labelText: 'Requirement', relPath: f.relPath,
      })));
      tcFiles.forEach((f) => listEl.appendChild(createFileImpactRow({
        checked: true, disabled: false, chkClass: 'qa-delete-chk-tc', labelText: 'Test Case', relPath: f.relPath,
      })));
      specFiles.forEach((f) => listEl.appendChild(createFileImpactRow({
        checked: false, disabled: false, chkClass: 'qa-delete-chk-spec', labelText: 'Automation Spec',
        labelColor: '#f59e0b', relPath: f.relPath, noteText: '(Mã nguồn Playwright)',
      })));
    } catch (err) {
      if (listEl) {
        listEl.textContent = '';
        const errSpan = document.createElement('span');
        errSpan.style.color = 'var(--danger, #ef4444)';
        errSpan.textContent = `Lỗi khi quét liên đới: ${err.message}`;
        listEl.appendChild(errSpan);
      }
    }
  }

  checkDeleteConfirmInput() {
    const root = this.qaSlice._root();
    if (!root) return;
    const inputEl = root.querySelector('#qa-delete-confirm-input');
    const submitBtn = root.querySelector('#qa-delete-submit-btn');
    if (!inputEl || !submitBtn || !this._deleteTargetReqId) return;

    const val = inputEl.value.trim().toUpperCase();
    const isMatch = val === this._deleteTargetReqId.toUpperCase();
    submitBtn.disabled = !isMatch;
    submitBtn.style.cursor = isMatch ? 'pointer' : 'not-allowed';
    submitBtn.style.opacity = isMatch ? '1' : '0.5';
  }

  async submitDeleteRequirement() {
    const root = this.qaSlice._root();
    if (!root || !this._deleteTargetReqId) return;
    const modal = root.querySelector('#qa-delete-req-modal');
    const submitBtn = root.querySelector('#qa-delete-submit-btn');

    const chkTc = root.querySelector('.qa-delete-chk-tc');
    const chkSpec = root.querySelector('.qa-delete-chk-spec');
    const deleteTestCase = chkTc ? chkTc.checked : true;
    const deleteSpec = chkSpec ? chkSpec.checked : false;

    if (submitBtn) submitBtn.disabled = true;

    try {
      const res = await apiClient.delete('/api/qa/requirement', {
        reqId: this._deleteTargetReqId,
        deleteTestCase,
        deleteSpec,
      });

      if (modal) { try { modal.close(); } catch (_) {} }
      const deletedId = this._deleteTargetReqId;
      this._deleteTargetReqId = null;
      this.qaSlice.activeDocPath = null;
      this.qaSlice._activeDoc = null;

      const overview = root.querySelector('#qa-reader-overview');
      const pane = root.querySelector('#qa-reader-doc');
      if (overview) overview.hidden = false;
      if (pane) pane.hidden = true;

      this.qaSlice.notify(res.message || `Đã xóa thành công ${deletedId}.`);
      await this.qaSlice.reload(true);
    } catch (err) {
      this.qaSlice.notify(`Lỗi khi xóa Requirement: ${err.message}`);
    } finally {
      this.checkDeleteConfirmInput();
    }
  }
}
