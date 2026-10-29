'use strict';

/**
 * dashboard/public/js/views/qa/slices/qaBatchSlice.js
 * Quản lý tab Static Findings và quy trình Auto-Fix (DOM-safe, không dùng innerHTML dữ liệu repo).
 */

import { apiClient } from '../../../core/apiClient.js';

const SEVERITY_LABEL = { major: 'Nghiêm trọng', minor: 'Cần xử lý', info: 'Ghi nhận' };

export class QaBatchSlice {
  constructor(qaSlice) {
    this.qaSlice = qaSlice;
  }

  renderFindings(root) {
    if (!root) return;

    const staticGapsCard = root.querySelector('#qa-static-gaps-card');
    const staticGapsBadge = root.querySelector('#qa-static-gaps-badge');
    const summary = this.qaSlice.summary;
    const staticGaps = (summary && Array.isArray(summary.findings)) ? summary.findings : [];

    if (staticGapsCard) {
      staticGapsCard.hidden = staticGaps.length === 0 && !(this.qaSlice.batch && this.qaSlice.batch.hasActiveResult);
      const blockers = staticGaps.filter((f) => f.severity === 'blocker').length;
      if (staticGapsBadge) {
        staticGapsBadge.textContent = `${staticGaps.length} phát hiện (${blockers > 0 ? `${blockers} blocker` : 'cảnh báo'})`;
        staticGapsBadge.className = `qa-badge ${blockers > 0 ? 'qa-badge-danger' : 'qa-badge-warn'}`;
      }
      if (this.qaSlice.batch) {
        if (!this.qaSlice.batch.alive) this.qaSlice.batch.init(root);
        this.qaSlice.batch.render(summary);
      }
    }

    const box = root.querySelector('#qa-findings-groups');
    if (this.qaSlice.conflictStudio) this.qaSlice.conflictStudio.destroy();
    if (!box || !this.qaSlice.trace) return;
    box.textContent = '';

    const groups = this.qaSlice.trace.findings || {};
    const total = ['major', 'minor', 'info'].reduce((n, k) => n + ((groups[k] || []).length), 0);
    if (!total && staticGaps.length === 0) {
      this.qaSlice._setEmpty('qa-findings-empty', this.qaSlice.trace.bootstrap
        ? ['Chưa có gì để đối chiếu', 'Repo chưa có tài liệu nên chưa thể tìm khoảng hở nào.']
        : ['Không còn khoảng hở nào trong ma trận truy vết']);
      return;
    }
    this.qaSlice._setEmpty('qa-findings-empty', null);

    ['major', 'minor', 'info'].forEach((severity) => {
      const items = groups[severity] || [];
      if (!items.length) return;
      const section = this.qaSlice._el('div', null, `qa-finding-group qa-finding-${severity}`);
      section.appendChild(this.qaSlice._el('h4', `${SEVERITY_LABEL[severity]} (${items.length})`, 'qa-finding-head'));

      const byKind = new Map();
      items.forEach((f) => {
        if (!byKind.has(f.kind)) byKind.set(f.kind, { label: f.label, rows: [] });
        byKind.get(f.kind).rows.push(f);
      });
      byKind.forEach(({ label, rows }, kind) => {
        if (kind === 'ac-lech-giua-tai-lieu-va-spec' && this.qaSlice.conflictStudio) {
          this.qaSlice.conflictStudio.render(section, rows);
          return;
        }
        section.appendChild(this.qaSlice._el('p', `${label} — ${rows.length}`, 'qa-finding-kind'));
        const ul = this.qaSlice._el('ul', null, 'qa-finding-list');
        rows.slice(0, 50).forEach((f) => ul.appendChild(this.qaSlice._el('li', f.detail)));
        if (rows.length > 50) ul.appendChild(this.qaSlice._el('li', `… và ${rows.length - 50} mục nữa`, 'qa-dim'));
        section.appendChild(ul);
      });
      box.appendChild(section);
    });
  }

  async openAutoFixModal() {
    const root = this.qaSlice._root();
    if (!root) return;
    const modal = root.querySelector('#qa-fix-modal');
    const summaryText = root.querySelector('#qa-fix-summary-text');
    const listEl = root.querySelector('#qa-fix-changes-list');
    const applyBtn = root.querySelector('#qa-btn-apply-fix');
    if (!modal || !summaryText || !listEl || !applyBtn) return;

    summaryText.textContent = 'Đang quét phân tích và chuẩn hóa ma trận (dry-run)...';
    listEl.textContent = '';
    const loadingLi = document.createElement('li');
    loadingLi.textContent = 'Đang tải thông tin...';
    listEl.appendChild(loadingLi);
    applyBtn.disabled = true;

    try { modal.showModal(); } catch (_) { modal.setAttribute('open', ''); }

    try {
      const res = await apiClient.post('/api/qa/fix', { dryRun: true });
      listEl.textContent = '';
      this.qaSlice._fixChanges = res.changes || [];

      if (!res.ok && res.error) {
        summaryText.textContent = `Lỗi: ${res.message || res.error}`;
        applyBtn.disabled = true;
        return;
      }

      summaryText.textContent = res.message || 'Hoàn tất quét xem trước.';
      if (this.qaSlice._fixChanges.length === 0) {
        const emptyLi = document.createElement('li');
        emptyLi.style.color = 'var(--success, #10b981)';
        emptyLi.textContent = 'Tất cả liên kết spec và candidate đã ở trạng thái chuẩn.';
        listEl.appendChild(emptyLi);
        applyBtn.disabled = true;
      } else {
        applyBtn.disabled = false;
        for (const change of this.qaSlice._fixChanges) {
          const li = document.createElement('li');
          if (change.kind === 'chuan-hoa-duong-dan-spec') {
            li.textContent = `[Đường dẫn] ${change.file}:${change.line} -> ${change.to}`;
          } else if (change.kind === 'them-test-case-chua-khai-bao') {
            li.textContent = `[Candidate mới] ${change.file}:${change.line} -> ${change.tcId} (${change.acId}) [${change.spec}]`;
          } else {
            li.textContent = `[Thay đổi] ${change.file}:${change.line || ''} -> ${change.kind || change.description || ''}`;
          }
          listEl.appendChild(li);
        }
      }
    } catch (err) {
      summaryText.textContent = `Lỗi kết nối khi quét Auto-Fix: ${err.message}`;
      listEl.textContent = '';
      applyBtn.disabled = true;
    }
  }

  async applyAutoFix() {
    const root = this.qaSlice._root();
    if (!root) return;
    const modal = root.querySelector('#qa-fix-modal');
    const applyBtn = root.querySelector('#qa-btn-apply-fix');
    const summaryText = root.querySelector('#qa-fix-summary-text');
    if (!applyBtn) return;

    applyBtn.disabled = true;
    if (summaryText) summaryText.textContent = 'Đang thực thi live fix và đồng bộ ma trận...';

    try {
      const res = await apiClient.post('/api/qa/fix', { dryRun: false });
      if (modal) { try { modal.close(); } catch (_) {} }
      this.qaSlice.notify(res.message || 'Đã chuẩn hóa thành công các liên kết.');
      await this.qaSlice.reload(true);
    } catch (err) {
      if (summaryText) summaryText.textContent = `Lỗi khi thực thi: ${err.message}`;
      applyBtn.disabled = false;
    }
  }

  openScaffoldModal() { return this.qaSlice.scaffoldSlice.openScaffoldModal(); }
  extractRawScaffold() { return this.qaSlice.scaffoldSlice.extractRawScaffold(); }
  submitScaffold() { return this.qaSlice.scaffoldSlice.submitScaffold(); }
}
