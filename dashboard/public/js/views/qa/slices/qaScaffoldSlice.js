'use strict';

/**
 * dashboard/public/js/views/qa/slices/qaScaffoldSlice.js
 * Quản lý Scaffold Wizard khởi tạo Requirement, Test Case và Spec.
 */

import { apiClient } from '../../../core/apiClient.js';
import { toast } from '../../../core/toast.js';

export class QaScaffoldSlice {
  constructor(qaSlice) {
    this.qaSlice = qaSlice;
  }

  async openScaffoldModal() {
    const root = this.qaSlice._root();
    const modal = root?.querySelector('#qa-scaffold-modal');
    if (!modal) return;

    try {
      const meta = await apiClient.get('/api/qa/scaffold-meta');
      const reqInput = modal.querySelector('#qa-scaffold-req-id');
      const domainSelect = modal.querySelector('#qa-scaffold-domain');

      if (reqInput && meta.nextReqId) reqInput.value = meta.nextReqId;
      if (domainSelect && meta.existingDomains) {
        domainSelect.innerHTML = '';
        meta.existingDomains.forEach((d) => {
          const opt = document.createElement('option');
          opt.value = d;
          opt.textContent = d;
          domainSelect.appendChild(opt);
        });
      }
    } catch (_) {}

    try { modal.showModal(); } catch (_) { modal.setAttribute('open', ''); }
  }

  async extractRawScaffold() {
    const root = this.qaSlice._root();
    const modal = root?.querySelector('#qa-scaffold-modal');
    if (!modal) return;

    const rawTextarea = modal.querySelector('#qa-scaffold-raw-content');
    const rawContent = rawTextarea ? rawTextarea.value.trim() : '';
    if (!rawContent) {
      toast.warn('Vui lòng dán nội dung kịch bản hoặc spec thô.');
      return;
    }

    const previewSection = modal.querySelector('#qa-scaffold-preview-section');
    const previewFiles = modal.querySelector('#qa-scaffold-preview-files');
    const titleInput = modal.querySelector('#qa-scaffold-title');

    try {
      const res = await apiClient.post('/api/qa/extract-scaffold', { rawContent });
      if (res && res.preview) {
        if (titleInput && res.preview.title) titleInput.value = res.preview.title;
        if (previewFiles && res.preview.files) {
          previewFiles.innerHTML = res.preview.files.map((f) => `<li><code>${f}</code></li>`).join('');
        }
        if (previewSection) previewSection.style.display = 'block';
        toast.success(`Đã trích xuất ${res.preview.acCount} AC và ${res.preview.tcCount} TC!`);
      }
    } catch (err) {
      toast.error(`Lỗi trích xuất: ${err.message}`);
    }
  }

  async submitScaffold() {
    const root = this.qaSlice._root();
    const modal = root?.querySelector('#qa-scaffold-modal');
    if (!modal) return;

    const reqId = modal.querySelector('#qa-scaffold-req-id')?.value.trim();
    const title = modal.querySelector('#qa-scaffold-title')?.value.trim();
    const domain = modal.querySelector('#qa-scaffold-domain')?.value.trim();
    const acCount = parseInt(modal.querySelector('#qa-scaffold-ac-count')?.value || '2', 10);

    if (!reqId || !title) {
      toast.warn('Vui lòng nhập đầy đủ Mã REQ và Tiêu đề.');
      return;
    }

    try {
      const res = await apiClient.post('/api/qa/scaffold', { reqId, title, domain, acCount });
      if (res.ok) {
        toast.success(`Đã khởi tạo ${res.created?.length || 3} file thành công!`);
        try { modal.close(); } catch (_) {}
        await this.qaSlice.reload(true);
      }
    } catch (err) {
      toast.error(`Lỗi tạo scaffold: ${err.message}`);
    }
  }
}
