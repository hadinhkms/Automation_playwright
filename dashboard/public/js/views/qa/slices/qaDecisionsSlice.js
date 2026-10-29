'use strict';

/**
 * dashboard/public/js/views/qa/slices/qaDecisionsSlice.js
 * Quản lý tab Quyết định kiểm thử tương tác (decisions.json, PUT /api/qa/decision, DOM-safe 100%).
 */

import { apiClient } from '../../../core/apiClient.js';

const KNOWN_SEVERITY = new Set(['blocking', 'urgent']);

export class QaDecisionsSlice {
  constructor(qaSlice) {
    this.qaSlice = qaSlice;
  }

  renderDecisions(root) {
    const r = root || this.qaSlice._root();
    if (!r) return;
    const box = r.querySelector('#qa-decisions-list');
    if (!box) return;
    box.textContent = '';

    const data = this.qaSlice.decisions;
    if (!data || !data.exists || !Array.isArray(data.decisions) || !data.decisions.length) {
      this.qaSlice._setEmpty('qa-decisions-empty', [
        'Chưa có sổ quyết định',
        `Tạo file "${(data && data.file) || 'decisions.json'}" ở gốc repo khi cần ghi lại các quyết định`
          + ' còn treo. Thiếu file là trạng thái bình thường, không phải lỗi.',
      ]);
      return;
    }
    this.qaSlice._setEmpty('qa-decisions-empty', null);

    data.decisions.forEach((d) => box.appendChild(this._decisionCard(d)));
  }

  _decisionCard(d) {
    const answer = d.answer || {};
    const card = this.qaSlice._el('article', null, `qa-decision ${d.answered ? 'is-answered' : 'is-pending'}`);

    const head = this.qaSlice._el('div', null, 'qa-decision-head');
    head.appendChild(this.qaSlice._el('span', d.id || 'DECISION', 'qa-mono'));
    head.appendChild(this.qaSlice._el('strong', d.title || '(không có tiêu đề)', 'qa-decision-title'));
    if (d.severity) {
      const sevClass = KNOWN_SEVERITY.has(d.severity) ? ` qa-badge-${d.severity}` : '';
      head.appendChild(this.qaSlice._el('span', d.severity, `qa-badge${sevClass}`));
    }
    head.appendChild(this.qaSlice._el('span', d.answered ? 'Đã chốt' : 'Đang chờ', 'qa-decision-state'));
    card.appendChild(head);

    if (d.blocks) card.appendChild(this.qaSlice._el('p', `Đang chặn: ${d.blocks}`, 'qa-decision-blocks'));
    if (d.context) card.appendChild(this.qaSlice._el('p', d.context, 'qa-decision-context'));

    const form = this.qaSlice._el('div', null, 'qa-decision-form');
    const groupName = `qa-decision-${d.id}`;
    (d.options || []).forEach((opt) => {
      const label = this.qaSlice._el('label', null, 'qa-option');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = groupName;
      input.value = opt.id;
      input.checked = answer.optionId === opt.id;
      label.appendChild(input);

      const text = this.qaSlice._el('span', null, 'qa-option-text');
      text.appendChild(this.qaSlice._el('strong', opt.label || opt.id));
      if (opt.id === d.recommended) text.appendChild(this.qaSlice._el('span', 'Đề xuất', 'qa-badge qa-badge-rec'));
      if (opt.consequence) text.appendChild(this.qaSlice._el('small', opt.consequence, 'qa-option-conseq'));
      label.appendChild(text);
      form.appendChild(label);
    });
    if (d.recommendationReason) {
      form.appendChild(this.qaSlice._el('p', `Lý do đề xuất: ${d.recommendationReason}`, 'qa-decision-reason'));
    }

    const noteWrap = this.qaSlice._el('div', null, 'qa-field');
    noteWrap.appendChild(this.qaSlice._el('label', d.answered ? 'Lý do đã ghi' : 'Lý do chọn', 'qa-field-label'));
    const note = document.createElement('textarea');
    note.className = 'qa-textarea';
    note.rows = 2;
    note.value = d.answered ? (answer.note || '') : '';
    if (!d.answered && answer.note) note.placeholder = answer.note;
    noteWrap.appendChild(note);
    form.appendChild(noteWrap);

    const byWrap = this.qaSlice._el('div', null, 'qa-field');
    byWrap.appendChild(this.qaSlice._el('label', 'Người chốt (bắt buộc)', 'qa-field-label'));
    const by = document.createElement('input');
    by.type = 'text';
    by.value = answer.confirmedBy || '';
    byWrap.appendChild(by);
    form.appendChild(byWrap);

    const actions = this.qaSlice._el('div', null, 'qa-decision-actions');
    const save = this.qaSlice._el('button', 'Lưu quyết định', 'btn-primary-sm');
    save.type = 'button';
    const status = this.qaSlice._el('span', answer.confirmedAt ? `Chốt lúc ${answer.confirmedAt}` : '', 'qa-decision-stamp');

    const handler = async () => {
      const picked = form.querySelector(`input[name="${groupName}"]:checked`);
      save.disabled = true;
      status.textContent = 'Đang lưu…';
      try {
        const res = await apiClient.put('/api/qa/decision', {
          id: d.id,
          optionId: picked ? picked.value : null,
          note: note.value,
          confirmedBy: by.value,
        });
        status.textContent = res.decision && res.decision.answered
          ? `Đã chốt lúc ${res.decision.answer.confirmedAt}`
          : 'Đã lưu nháp — còn thiếu người chốt nên chưa tính là đã trả lời.';
        this.qaSlice.notify('Đã lưu quyết định.');
        await this.qaSlice.reload();
        this.qaSlice.switchTab('decisions');
      } catch (error) {
        status.textContent = error.status === 409
          ? 'Không lưu được: AI Agent đang chạy. Dừng tác vụ rồi thử lại.'
          : `Không lưu được: ${error.message}`;
      } finally {
        save.disabled = false;
      }
    };
    save.addEventListener('click', handler);
    this.qaSlice._renderDisposers.push(() => save.removeEventListener('click', handler));
    actions.append(save, status);
    form.appendChild(actions);

    card.appendChild(form);
    return card;
  }
}
