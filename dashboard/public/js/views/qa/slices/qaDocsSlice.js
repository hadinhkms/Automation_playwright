'use strict';

/**
 * dashboard/public/js/views/qa/slices/qaDocsSlice.js
 * Quản lý giao diện đọc và biên tập tài liệu Requirements / Test Cases Markdown.
 * Phân rã mô-đun tuân thủ giới hạn 150 dòng (role: module).
 */

import { docLink, docListItem, renderDocList } from './qaDocsList.js';
import {
  openDocument as readerOpenDocument,
  renderDocMeta as readerRenderDocMeta,
  setReaderHead as readerSetReaderHead,
  renderDocChips as readerRenderDocChips,
  renderOutline as readerRenderOutline,
  setReaderActions as readerSetReaderActions,
} from './qaDocsReader.js';
import {
  closeReaderForm as formCloseReaderForm,
  formShell as formFormShell,
  saveDocument as formSaveDocument,
} from './qaDocsForms.js';
import {
  openAnswerForm as formOpenAnswerForm,
  openEditForm as formOpenEditForm,
} from './qaDocsAnswerForm.js';

export class QaDocsSlice {
  constructor(qaSlice) {
    this.qaSlice = qaSlice;
    this._lastAuthor = '';
  }

  renderDocs(root) {
    const r = root || this.qaSlice._root();
    if (!r) return;
    const workspace = r.querySelector('#qa-docs-workspace');
    const tbody = r.querySelector('#qa-docs-tbody');
    if (!workspace || !tbody) return;
    tbody.textContent = '';

    if (!this.qaSlice.trace) {
      workspace.hidden = true;
      this.qaSlice._setEmpty('qa-docs-empty', [
        'Đang tải dữ liệu tài liệu...',
        'Hệ thống đang kết nối và phân tích requirements / test cases của repo.',
      ]);
      return;
    }

    if (this.qaSlice.trace.available === false) {
      workspace.hidden = true;
      this.qaSlice._setEmpty('qa-docs-empty', [
        'Chưa có analyzer trong repo này',
        (this.qaSlice.trace.analyzer && this.qaSlice.trace.analyzer.error) || '',
        'Chạy một lượt sync từ Hub để nhận scripts/lib/qaTrace.js.',
      ].filter(Boolean));
      return;
    }

    const reqs = this.qaSlice.trace.requirements || [];
    if (!reqs.length && !this.qaSlice.documents.length) {
      workspace.hidden = true;
      this.qaSlice._setEmpty('qa-docs-empty', [
        'Repo này chưa có tài liệu requirement',
        `Chưa thấy thư mục "${(this.qaSlice.trace.dirs || {}).requirements}/" hoặc thư mục đó chưa có file nào đúng quy ước.`,
        'Đây là trạng thái bình thường khi dự án bắt đầu từ script. Mỗi requirement là một file'
          + ' Markdown mang mã REQ-xxx, bên trong có các AC-yyy.',
        `Hiện có ${(this.qaSlice.trace.counts || {}).specs || 0} spec chưa truy vết được về nghiệp vụ nào —`
          + ' đó chính là vùng rủi ro sót nghiệp vụ.',
      ]);
      return;
    }

    this.qaSlice._setEmpty('qa-docs-empty', null);
    workspace.hidden = false;

    reqs.forEach((req) => {
      const firstFile = (req.files || [])[0];
      const cellFile = firstFile
        ? this._docLink(firstFile, (req.files || []).join(', '))
        : this.qaSlice._cell('—', 'qa-dim');
      const action = this.qaSlice._el('td');
      if (firstFile) {
        const btn = this.qaSlice._el('button', 'Mở tài liệu', 'btn-secondary-sm');
        btn.type = 'button';
        const handler = () => this.openDocument(firstFile);
        btn.addEventListener('click', handler);
        this.qaSlice._renderDisposers.push(() => btn.removeEventListener('click', handler));
        action.appendChild(btn);
      }
      tbody.appendChild(this.qaSlice._row([
        this.qaSlice._cell(req.id, 'qa-mono'),
        this.qaSlice._cell(req.acCount),
        this.qaSlice._cell(req.tcCount),
        cellFile,
        action,
      ]));
    });

    this.renderDocList(r);
    if (this.qaSlice.activeDocPath) {
      this.openDocument(this.qaSlice.activeDocPath);
    } else {
      this.showOverview();
    }
  }

  _docLink(relPath, label) {
    return docLink(this, relPath, label);
  }

  _docListItem(doc) {
    return docListItem(this, doc);
  }

  renderDocList(root) {
    return renderDocList(this, root);
  }

  showOverview() {
    const root = this.qaSlice._root();
    if (!root) return;
    this.qaSlice.activeDocPath = null;
    this.qaSlice._activeDoc = null;
    this._closeReaderForm();
    const overview = root.querySelector('#qa-reader-overview');
    const doc = root.querySelector('#qa-reader-doc');
    if (overview) overview.hidden = false;
    if (doc) doc.hidden = true;
    this.renderDocList(root);
  }

  async openDocument(relPath) {
    return readerOpenDocument(this, relPath);
  }

  _setReaderActions(doc, markdown) {
    return readerSetReaderActions(this.qaSlice, doc, markdown);
  }

  _renderDocMeta(meta) {
    return readerRenderDocMeta(this.qaSlice, meta);
  }

  _setReaderHead(relPath, doc, meta) {
    return readerSetReaderHead(this.qaSlice, relPath, doc, meta);
  }

  _renderDocChips(container, doc) {
    return readerRenderDocChips(this.qaSlice, container, doc);
  }

  _renderOutline(body) {
    return readerRenderOutline(this.qaSlice, body);
  }

  _closeReaderForm() {
    return formCloseReaderForm(this.qaSlice);
  }

  _formShell(title, hint) {
    return formFormShell(this.qaSlice, title, hint, this._lastAuthor);
  }

  async _saveDocument(content, status, save) {
    return formSaveDocument(this, content, status, save);
  }

  openAnswerForm() {
    return formOpenAnswerForm(this);
  }

  openEditForm() {
    return formOpenEditForm(this);
  }
}
