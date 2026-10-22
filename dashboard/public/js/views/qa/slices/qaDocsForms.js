'use strict';

/**
 * dashboard/public/js/views/qa/slices/qaDocsForms.js
 * Quản lý khung form và lưu tài liệu Requirements / Test Cases.
 * Line budget: <= 150 lines (role: module).
 */

import { apiClient } from '../../../core/apiClient.js';

export function closeReaderForm(slice) {
  const root = slice._root();
  if (!root) return;
  const box = root.querySelector('#qa-reader-form');
  if (box) {
    box.textContent = '';
    box.hidden = true;
  }
  const readerMain = root.querySelector('#qa-reader-main');
  if (readerMain) readerMain.classList.remove('has-open-form');
  const outline = root.querySelector('#qa-reader-outline');
  if (outline) outline.hidden = false;
}

export function formShell(slice, title, hint, lastAuthor = '') {
  const root = slice._root();
  const box = root.querySelector('#qa-reader-form');
  box.textContent = '';
  box.hidden = false;

  const readerMain = root.querySelector('#qa-reader-main');
  if (readerMain) readerMain.classList.add('has-open-form');
  const outline = root.querySelector('#qa-reader-outline');
  if (outline) outline.hidden = true;

  const head = slice._el('div', null, 'qa-form-head');
  head.appendChild(slice._el('p', title, 'qa-form-title'));
  const closeBtn = slice._el('button', null, 'qa-form-close-btn');
  closeBtn.type = 'button';
  closeBtn.title = 'Đóng';
  closeBtn.innerHTML = '<i class="ph-bold ph-x"></i>';
  head.appendChild(closeBtn);
  box.appendChild(head);

  if (hint) {
    const hintEl = slice._el('p', hint, 'qa-form-hint');
    hintEl.style.maxWidth = 'none';
    box.appendChild(hintEl);
  }

  const body = slice._el('div', null, 'qa-form-body');
  box.appendChild(body);

  const footer = slice._el('div', null, 'qa-form-footer');
  const byWrap = slice._el('label', null, 'qa-form-by');
  byWrap.appendChild(slice._el('span', 'Người chốt', 'qa-field-label'));
  const by = document.createElement('input');
  by.type = 'text';
  by.placeholder = 'Tên bạn';
  by.value = lastAuthor || '';
  byWrap.appendChild(by);
  footer.appendChild(byWrap);

  const save = slice._el('button', 'Lưu vào tài liệu', 'btn-primary-sm');
  save.type = 'button';
  const cancel = slice._el('button', 'Huỷ', 'btn-secondary-sm');
  cancel.type = 'button';
  const status = slice._el('span', '', 'qa-form-status');
  footer.appendChild(save);
  footer.appendChild(cancel);
  footer.appendChild(status);
  box.appendChild(footer);

  const onCancel = () => closeReaderForm(slice);
  cancel.addEventListener('click', onCancel);
  closeBtn.addEventListener('click', onCancel);
  slice._renderDisposers.push(() => {
    cancel.removeEventListener('click', onCancel);
    closeBtn.removeEventListener('click', onCancel);
  });

  return { box, body, by, save, status };
}

export async function saveDocument(docsSlice, content, status, save) {
  const slice = docsSlice.qaSlice;
  const doc = slice._activeDoc;
  if (!doc) return false;
  save.disabled = true;
  status.className = 'qa-form-status';
  status.textContent = 'Đang lưu…';
  try {
    const res = await apiClient.put('/api/qa/document', {
      path: doc.path,
      content,
      expectedBytes: doc.bytes,
    });
    status.textContent = res.changed ? `Đã lưu. Bản sao lưu: ${res.backup}` : 'Không có thay đổi nào.';
    closeReaderForm(slice);
    await slice.reload();
    slice.notify(res.changed ? 'Đã cập nhật tài liệu requirement.' : 'Tài liệu không thay đổi.');
    return true;
  } catch (error) {
    status.className = 'qa-form-status is-error';
    status.textContent = error.status === 409
      ? 'Tài liệu đã đổi trên đĩa (hoặc AI Agent đang chạy). Bấm Làm mới rồi thử lại.'
      : `Không lưu được: ${error.message}`;
    save.disabled = false;
    return false;
  }
}
