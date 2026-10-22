'use strict';

/**
 * dashboard/public/js/views/qa/slices/qaBatchSlice.js
 * Quản lý tab Static Findings và quy trình Auto-Fix.
 */

import { apiClient } from '../../../core/apiClient.js';
import { toast } from '../../../core/toast.js';

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
    const modal = root?.querySelector('#qa-fix-modal');
    if (!modal) return;

    const list = modal.querySelector('#qa-fix-preview-list');
    if (list) list.innerHTML = '<p style="color: var(--muted);">Đang phân tích thay đổi dự kiến…</p>';
    try { modal.showModal(); } catch (_) { modal.setAttribute('open', ''); }

    try {
      const res = await apiClient.post('/api/qa/fix', { dryRun: true });
      if (!res || !res.changes) throw new Error('Không nhận được kế hoạch sửa');
      this.qaSlice._fixChanges = res.changes;
      if (list) {
        list.innerHTML = '';
        if (!res.changes.length) {
          list.innerHTML = '<p style="color: var(--muted); padding: 12px 0;">Không có lỗi nào cần sửa tự động.</p>';
          return;
        }
        res.changes.forEach((c) => {
          const item = document.createElement('div');
          item.style.cssText = 'padding: 6px 0; border-bottom: 1px solid var(--line); font-size: 12.5px;';
          item.textContent = `${c.file || ''}: ${c.description || c.action || ''}`;
          list.appendChild(item);
        });
      }
    } catch (err) {
      if (list) list.innerHTML = `<p style="color: var(--danger);">Lỗi phân tích: ${err.message}</p>`;
    }
  }

  async applyAutoFix() {
    const root = this.qaSlice._root();
    const modal = root?.querySelector('#qa-fix-modal');
    try {
      const res = await apiClient.post('/api/qa/fix', { dryRun: false });
      toast.success(`Đã tự động sửa ${res.updatedFiles || 0} file thành công!`);
      if (modal) { try { modal.close(); } catch (_) {} }
      await this.qaSlice.reload(true);
    } catch (err) {
      toast.error(`Lỗi khi áp dụng sửa: ${err.message}`);
    }
  }

  openScaffoldModal() { return this.qaSlice.scaffoldSlice.openScaffoldModal(); }
  extractRawScaffold() { return this.qaSlice.scaffoldSlice.extractRawScaffold(); }
  submitScaffold() { return this.qaSlice.scaffoldSlice.submitScaffold(); }
}
