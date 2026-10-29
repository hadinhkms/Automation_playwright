'use strict';

/**
 * dashboard/public/js/views/qa/slices/qaScaffoldSlice.js
 * Quản lý Scaffold Wizard 3 chế độ (raw / new / infer) khởi tạo Requirement, Test Case và Spec.
 */

import { apiClient } from '../../../core/apiClient.js';
import {
  setBtnContent,
  resetScaffoldForm,
  applyScaffoldMetaToDom,
  renderExtractedScaffoldPreview,
} from './qaScaffoldPreviewRenderer.js';

export class QaScaffoldSlice {
  constructor(qaSlice) {
    this.qaSlice = qaSlice;
    this._scaffoldRawExtracted = null;
  }

  async openScaffoldModal() {
    const root = this.qaSlice._root();
    if (!root) return;
    const modal = root.querySelector('#qa-scaffold-modal');
    if (!modal) return;

    this._scaffoldRawExtracted = null;
    resetScaffoldForm(root);
    try { modal.showModal(); } catch (_) { modal.setAttribute('open', ''); }

    try {
      const meta = await apiClient.get('/api/qa/scaffold/meta');
      applyScaffoldMetaToDom(root, meta);
    } catch (_) {}
  }

  async extractRawScaffold() {
    const root = this.qaSlice._root();
    if (!root) return null;
    const rawContent = root.querySelector('#qa-scaffold-raw-content')?.value.trim() || '';
    if (!rawContent) {
      this.qaSlice.notify('Vui lòng dán nội dung Spec văn bản hoặc Playwright Test Script vào ô nội dung.');
      return null;
    }

    const reqId = root.querySelector('#qa-scaffold-raw-req-id')?.value.trim() || '';
    const domain = root.querySelector('#qa-scaffold-raw-domain')?.value.trim() || '';
    const extractBtn = root.querySelector('#qa-btn-extract-raw');
    if (extractBtn) { extractBtn.disabled = true; setBtnContent(extractBtn, 'ph-bold ph-spinner ph-spin', 'Đang phân tích...'); }

    try {
      const startAi = window.AiRequest && typeof window.AiRequest.startAiRequest === 'function';
      const res = startAi
        ? await window.AiRequest.startAiRequest({
          url: '/api/qa/scaffold/extract',
          body: { rawContent, reqId, domain },
          timeoutMs: 60000,
          owner: this.qaSlice,
        }).promise
        : await apiClient.post('/api/qa/scaffold/extract', { rawContent, reqId, domain });

      this._scaffoldRawExtracted = res;
      renderExtractedScaffoldPreview(root, res);
      this.qaSlice.notify(`Đã phân tích thành công (${res.preview?.acCount ?? 0} ACs, ${res.preview?.tcCount ?? 0} Test Cases).`);
      return res;
    } catch (err) {
      this.qaSlice.notify(`Lỗi phân tích: ${err.message}`);
      return null;
    } finally {
      if (extractBtn) { extractBtn.disabled = false; setBtnContent(extractBtn, 'ph-bold ph-lightning', 'Phân tích & Xem trước'); }
    }
  }

  async submitScaffold() {
    const root = this.qaSlice._root();
    if (!root) return;
    const modal = root.querySelector('#qa-scaffold-modal');
    const submitBtn = root.querySelector('#qa-btn-submit-scaffold');
    const mode = root.querySelector('input[name="qa-scaffold-mode"]:checked')?.value || 'raw';

    if (mode === 'raw') {
      const extracted = this._scaffoldRawExtracted || await this.extractRawScaffold();
      if (!extracted) return;
      if (submitBtn) { submitBtn.disabled = true; setBtnContent(submitBtn, 'ph-bold ph-spinner ph-spin', 'Đang khởi tạo...'); }
      try {
        const res = await apiClient.post('/api/qa/scaffold', {
          mode: 'raw_create',
          reqId: extracted.preview.reqId,
          title: extracted.preview.title,
          slug: extracted.preview.slug,
          customFiles: extracted.generated,
        });
        if (modal) { try { modal.close(); } catch (_) {} }
        this.qaSlice.notify(res.message || `Đã khởi tạo thành công 3 files cho ${extracted.preview.reqId}.`);
        await this.qaSlice.reload(true);
        if (res.primaryFile) await this.qaSlice.openDocument(res.primaryFile);
      } catch (err) {
        this.qaSlice.notify(`Lỗi khởi tạo 3 files: ${err.message}`);
      } finally {
        if (submitBtn) { submitBtn.disabled = false; setBtnContent(submitBtn, 'ph-bold ph-file-plus', 'Khởi tạo bộ tài liệu'); }
      }
      return;
    }

    if (mode === 'infer') {
      const specPath = root.querySelector('#qa-scaffold-spec-path')?.value.trim();
      if (!specPath) { this.qaSlice.notify('Vui lòng nhập đường dẫn spec để suy luận ngược.'); return; }
      if (submitBtn) submitBtn.disabled = true;
      try {
        const res = await apiClient.post('/api/qa/scaffold', { inferFromSpecPath: specPath });
        if (modal) { try { modal.close(); } catch (_) {} }
        this.qaSlice.notify(res.message || 'Đã suy luận tài liệu từ spec thành công.');
        await this.qaSlice.reload(true);
      } catch (err) {
        this.qaSlice.notify(`Lỗi suy luận: ${err.message}`);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
      return;
    }

    const reqId = root.querySelector('#qa-scaffold-req-id')?.value.trim().toUpperCase();
    const title = root.querySelector('#qa-scaffold-title')?.value.trim();
    const domain = root.querySelector('#qa-scaffold-domain')?.value.trim() || 'general';
    const acCount = parseInt(root.querySelector('#qa-scaffold-ac-count')?.value, 10) || 2;
    if (!reqId || !/^REQ-\d{3}$/.test(reqId)) { this.qaSlice.notify('Mã Requirement không hợp lệ (yêu cầu dạng REQ-001).'); return; }
    if (!title) { this.qaSlice.notify('Vui lòng nhập tiêu đề tính năng.'); return; }

    if (submitBtn) submitBtn.disabled = true;
    try {
      const res = await apiClient.post('/api/qa/scaffold', { reqId, title, domain, acCount });
      if (modal) { try { modal.close(); } catch (_) {} }
      this.qaSlice.notify(res.message || `Đã tạo thành công bộ kịch bản cho ${reqId}.`);
      await this.qaSlice.reload(true);
    } catch (err) {
      this.qaSlice.notify(`Lỗi khởi tạo: ${err.message}`);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }
}
