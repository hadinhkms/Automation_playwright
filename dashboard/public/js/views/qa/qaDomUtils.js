'use strict';

/**
 * dashboard/public/js/views/qa/qaDomUtils.js
 * DOM and alert utility helpers for QA Slice.
 */

export function createEl(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined && text !== null) el.textContent = String(text);
  if (className) el.className = className;
  return el;
}

export function createRow(cells, className) {
  const tr = document.createElement('tr');
  if (className) tr.className = className;
  cells.forEach((c) => tr.appendChild(c instanceof Node ? c : createEl('td', c)));
  return tr;
}

export function createCell(text, className) {
  return createEl('td', text, className);
}

export function setEmptyContent(root, id, lines) {
  const node = root && root.querySelector(`#${id}`);
  if (!node) return;
  node.textContent = '';
  if (!lines || !lines.length) { node.hidden = true; return; }
  lines.forEach((line, i) => {
    node.appendChild(createEl('p', line, i === 0 ? 'qa-empty-title' : 'qa-empty-line'));
  });
  node.hidden = false;
}

export function showQaAlert(root, text, severity = 'warn') {
  const box = root && root.querySelector('#qa-alert');
  const span = root && root.querySelector('#qa-alert-text');
  if (!box || !span) return;
  span.textContent = text;
  box.classList.toggle('qa-alert-danger', severity === 'danger');
  box.classList.toggle('qa-alert-warn', severity !== 'danger');
  box.hidden = false;
}

export function hideQaAlert(root) {
  const box = root && root.querySelector('#qa-alert');
  if (box) box.hidden = true;
}

export function formatDegradedMessage(degraded) {
  if (!degraded || !degraded.length) return null;
  const parts = degraded.map((d) => d.part).join(', ');
  const anyMissing = degraded.some((d) => d.reason && (d.reason.status === 404 || String(d.reason.message || '').includes('404')));
  return anyMissing
    ? `Server đang chạy là bản cũ hơn giao diện: thiếu API cho ${parts}.`
      + ' Dừng rồi khởi động lại dashboard (Stop_Dashboard.bat rồi Start_Dashboard.bat).'
    : `Chưa tải được ${parts}. Phần còn lại vẫn dùng bình thường.`;
}
