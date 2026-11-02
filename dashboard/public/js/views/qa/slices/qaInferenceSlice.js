'use strict';

/**
 * dashboard/public/js/views/qa/slices/qaInferenceSlice.js
 * Quản lý giao diện suy luận test case từ Open Questions (Heuristic / AI) và ghi vào test-cases/.
 */

import { apiClient } from '../../../core/apiClient.js';
import {
  refreshInferAiBadge,
  highlightAddedTcInReader,
  renderInferredCardList,
  collectSelectedInferredTestCases,
} from './qaInferenceCardRenderer.js';

export class QaInferenceSlice {
  constructor(qaSlice) {
    this.qaSlice = qaSlice;
    this._inferredItems = [];
    this._inferredTcPath = null;
    this._inferredReqId = null;
  }

  async openInferModal() {
    const root = this.qaSlice._root();
    if (!root || !this.qaSlice._activeDoc) return;
    const modal = root.querySelector('#qa-infer-modal');
    if (!modal) return;

    const subtitle = root.querySelector('#qa-infer-modal-subtitle');
    if (subtitle) subtitle.textContent = `Phân tích câu hỏi đã chốt của ${this.qaSlice._activeDoc.path} và đề xuất Test Cases`;

    const radioHeuristic = root.querySelector('input[name="qa-infer-mode"][value="heuristic"]');
    if (radioHeuristic) radioHeuristic.checked = true;

    refreshInferAiBadge(root, apiClient);
    try { modal.showModal(); } catch (_) { modal.setAttribute('open', ''); }
    await this.runInference();
  }

  async runInference() {
    const root = this.qaSlice._root();
    if (!root || !this.qaSlice._activeDoc) return;

    const loading = root.querySelector('#qa-infer-loading');
    const empty = root.querySelector('#qa-infer-empty');
    const results = root.querySelector('#qa-infer-results');
    const submitBtn = root.querySelector('#qa-infer-submit-btn');
    const mode = root.querySelector('input[name="qa-infer-mode"]:checked')?.value || 'heuristic';

    if (loading) loading.style.display = 'block';
    if (empty) empty.style.display = 'none';
    if (results) results.style.display = 'none';
    if (submitBtn) submitBtn.disabled = true;

    const showEmptyState = (title, desc) => {
      if (!empty) return;
      empty.style.display = 'block';
      const emptyTitle = root.querySelector('#qa-infer-empty-title');
      const emptyDesc = root.querySelector('#qa-infer-empty-desc');
      if (emptyTitle) emptyTitle.textContent = title;
      if (emptyDesc) emptyDesc.textContent = desc;
    };

    try {
      const startAi = window.AiRequest && typeof window.AiRequest.startAiRequest === 'function';
      const res = startAi
        ? await window.AiRequest.startAiRequest({
          url: '/api/qa/infer-testcases',
          body: { reqPath: this.qaSlice._activeDoc.path, mode },
          timeoutMs: 60000,
          owner: this.qaSlice,
        }).promise
        : await apiClient.post('/api/qa/infer-testcases', { reqPath: this.qaSlice._activeDoc.path, mode });

      if (loading) loading.style.display = 'none';
      const items = res.items || res.testCases || [];
      if (!items.length) {
        showEmptyState('Không tìm thấy test case mới cần bổ sung', res.message || 'Các câu hỏi đã chốt đã được bao phủ hoặc không tìm thấy quy tắc biên mới.');
        return;
      }

      if (results) results.style.display = 'flex';
      this.renderInferredCards(items, res.tcPath, res.reqId);
    } catch (err) {
      if (loading) loading.style.display = 'none';
      showEmptyState('Lỗi phân tích', err.message || 'Không thể suy luận test case.');
    }
  }

  renderInferredCards(items, tcPath, reqId) {
    const root = this.qaSlice._root();
    if (!root) return;
    const list = root.querySelector('#qa-infer-cards-list');
    const summaryText = root.querySelector('#qa-infer-summary-text');
    if (!list) return;

    this._inferredItems = items;
    this._inferredTcPath = tcPath || null;
    this._inferredReqId = reqId || 'REQ-001';
    if (summaryText) summaryText.textContent = `Tìm thấy ${items.length} test case tiềm năng từ các câu hỏi đã chốt:`;

    renderInferredCardList(this.qaSlice, list, items, () => this.updateInferredSelectedCount());
    this.updateInferredSelectedCount();
  }

  toggleAllInferred(select) {
    const root = this.qaSlice._root();
    if (!root) return;
    root.querySelectorAll('.qa-inferred-card').forEach((card) => {
      const chk = card.querySelector('.qa-inferred-chk');
      if (chk) { chk.checked = select; card.classList.toggle('is-selected', select); }
    });
    this.updateInferredSelectedCount();
  }

  updateInferredSelectedCount() {
    const root = this.qaSlice._root();
    if (!root) return;
    const selected = root.querySelectorAll('.qa-inferred-chk:checked');
    const total = root.querySelectorAll('.qa-inferred-chk');
    const countText = root.querySelector('#qa-infer-selected-count');
    const submitBtn = root.querySelector('#qa-infer-submit-btn');
    const submitLabel = root.querySelector('#qa-infer-submit-label');
    if (countText) countText.textContent = `Đã chọn: ${selected.length} / ${total.length} test case`;
    if (submitBtn) submitBtn.disabled = selected.length === 0;
    if (submitLabel) submitLabel.textContent = `Thêm vào test-cases (${selected.length})`;
  }

  async submitInferredTestCases() {
    const root = this.qaSlice._root();
    if (!root || !this._inferredItems?.length) return;
    const modal = root.querySelector('#qa-infer-modal');
    const submitBtn = root.querySelector('#qa-infer-submit-btn');
    const submitLabel = root.querySelector('#qa-infer-submit-label');

    const toSubmit = collectSelectedInferredTestCases(root, this._inferredItems);
    if (!toSubmit.length) { this.qaSlice.notify('Vui lòng chọn ít nhất 1 test case để thêm.'); return; }
    if (submitBtn) submitBtn.disabled = true;
    if (submitLabel) submitLabel.textContent = 'Đang thêm test cases...';

    try {
      const res = await apiClient.post('/api/qa/append-testcases', {
        reqId: this._inferredReqId || 'REQ-001',
        tcPath: this._inferredTcPath,
        testCases: toSubmit,
      });
      if (modal) { try { modal.close(); } catch (_) {} }
      this.qaSlice._recentlyAddedTcIds = new Set(toSubmit.map((tc) => tc.suggestedId));
      const tcPathToOpen = res.tcPath || this._inferredTcPath;

      await this.qaSlice.reload(false);
      if (tcPathToOpen) {
        await this.qaSlice.openDocument(tcPathToOpen);
        highlightAddedTcInReader(root, toSubmit[0]?.suggestedId);
      }
      this.qaSlice.notify(res.message || `Đã thêm thành công ${toSubmit.length} test case vào ${tcPathToOpen || 'test-cases'}.`);
    } catch (err) {
      this.qaSlice.notify(`Lỗi thêm test case: ${err.message}`);
    } finally {
      this.updateInferredSelectedCount();
    }
  }
}
