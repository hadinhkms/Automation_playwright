'use strict';

/**
 * dashboard/public/js/views/qa/slices/qaCandidatesSlice.js
 * Quản lý danh sách Test Candidates và lựa chọn sinh bản thảo BDD.
 */

import {
  generateBddDraft,
  copyBddDraft,
  closeBddDraft,
  toggleBddDraftFullscreen,
} from './qaBddDraftController.js';

const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 };
const KNOWN_PRIORITY = new Set(['p0', 'p1', 'p2', 'p3']);
const AUTOMATION_LABEL = {
  yes: 'Khai: có automation',
  no: 'Khai: không automation',
  candidate: 'Khai: ứng viên',
};

export class QaCandidatesSlice {
  constructor(qaSlice) {
    this.qaSlice = qaSlice;
  }

  renderCandidates(root) {
    const r = root || this.qaSlice._root();
    if (!r) return;
    const wrap = r.querySelector('#qa-candidates-wrap');
    const tbody = r.querySelector('#qa-candidates-tbody');
    if (!tbody) return;
    tbody.textContent = '';

    const list = (this.qaSlice.candidates || [])
      .filter((c) => this.qaSlice.priorityFilter === 'all' || c.priority === this.qaSlice.priorityFilter)
      .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
        || String(a.id).localeCompare(String(b.id)));

    if (!list.length) {
      if (wrap) wrap.hidden = true;
      this.syncPickState(r);
      this.qaSlice._setEmpty('qa-candidates-empty', (this.qaSlice.candidates || []).length
        ? ['Không có ứng viên nào ở mức ưu tiên này']
        : ['Không có test case nào đang chờ automation', 'Hoặc mọi test case đã có script, hoặc repo chưa có thư mục test-cases/.']);
      return;
    }

    this.qaSlice._setEmpty('qa-candidates-empty', null);
    if (wrap) wrap.hidden = false;

    list.forEach((c) => {
      const prioKey = String(c.priority || '').toLowerCase();
      const prioClass = KNOWN_PRIORITY.has(prioKey) ? ` qa-prio-${prioKey}` : '';
      const tdPick = this.qaSlice._el('td', null, 'qa-pick-col');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.className = 'qa-candidate-pick';
      box.checked = this.qaSlice.pickedIds.has(c.id);
      box.setAttribute('aria-label', `Chọn ${c.id}`);
      const onChange = () => {
        if (box.checked) this.qaSlice.pickedIds.add(c.id);
        else this.qaSlice.pickedIds.delete(c.id);
        this.syncPickState(r);
      };
      box.addEventListener('change', onChange);
      this.qaSlice._renderDisposers.push(() => box.removeEventListener('change', onChange));
      tdPick.appendChild(box);

      const isRecent = Boolean(this.qaSlice._recentlyAddedTcIds && this.qaSlice._recentlyAddedTcIds.has(c.id));
      tbody.appendChild(this.qaSlice._row([
        tdPick,
        this.qaSlice._cell(c.id, 'qa-mono'),
        this.qaSlice._cell(c.title || '—', 'qa-candidate-title'),
        this.qaSlice._cell(c.req || '—', 'qa-mono'),
        this.qaSlice._cell((c.acs || []).join(', ') || '—', 'qa-mono'),
        this.qaSlice._cell(c.priority || '—', `qa-prio${prioClass}`),
        this.qaSlice._cell(AUTOMATION_LABEL[c.automation] || c.automation || 'Chưa khai', 'qa-dim'),
        this.qaSlice._cell(c.file || '—', 'qa-mono qa-dim'),
      ], isRecent ? 'qa-row-highlight' : ''));
    });

    this.syncPickState(r);
  }

  syncPickState(root) {
    const r = root || this.qaSlice._root();
    if (!r) return;
    const visible = [...r.querySelectorAll('#qa-candidates-tbody .qa-pick-col input')];
    const picked = visible.filter((b) => b.checked).length;
    const all = r.querySelector('#qa-pick-all');
    if (all) {
      all.checked = visible.length > 0 && picked === visible.length;
      all.indeterminate = picked > 0 && picked < visible.length;
    }
    const btn = r.querySelector('#qa-btn-draft');
    const label = r.querySelector('#qa-btn-draft-label');
    const clear = r.querySelector('#qa-btn-draft-clear');
    if (btn) btn.disabled = this.qaSlice.pickedIds.size === 0;
    if (label) label.textContent = this.qaSlice.pickedIds.size ? `Sinh bản thảo BDD (${this.qaSlice.pickedIds.size})` : 'Sinh bản thảo BDD';
    if (clear) clear.hidden = this.qaSlice.pickedIds.size === 0;
  }

  toggleAllPicks(checked) {
    const root = this.qaSlice._root();
    if (!root) return;
    for (const box of root.querySelectorAll('#qa-candidates-tbody .qa-pick-col input')) {
      box.checked = checked;
      const id = (box.getAttribute('aria-label') || '').replace('Chọn ', '').trim();
      if (checked) this.qaSlice.pickedIds.add(id);
      else this.qaSlice.pickedIds.delete(id);
    }
    this.syncPickState(root);
  }

  clearPicks() {
    this.qaSlice.pickedIds.clear();
    const root = this.qaSlice._root();
    if (root) {
      for (const box of root.querySelectorAll('#qa-candidates-tbody .qa-pick-col input')) box.checked = false;
    }
    this.closeDraft();
    this.syncPickState(root);
  }

  async generateDraft() { await generateBddDraft(this.qaSlice); }
  async copyDraft() { await copyBddDraft(this.qaSlice); }
  closeDraft() { closeBddDraft(this.qaSlice); }
  toggleDraftFullscreen(forceState) { toggleBddDraftFullscreen(this.qaSlice, forceState); }
}
