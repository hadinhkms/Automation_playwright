'use strict';

/**
 * dashboard/public/js/views/qa/slices/qaDocsReader.js
 * Quản lý giao diện đọc và hiển thị Markdown Requirements / Test Cases.
 * Line budget: <= 170 lines (role: module, safe from 200 warning zone).
 */

import { apiClient } from '../../../core/apiClient.js';
import { renderMarkdown, parseFrontMatter } from '../markdownView.js';
import { parseOpenQuestions } from '../openQuestions.js';

export function renderDocMeta(slice, meta) {
  const box = slice._root() && slice._root().querySelector('#qa-reader-meta');
  if (!box) return;
  box.textContent = '';
  const SKIP = new Set(['title', 'id', 'slug']);
  for (const [key, value] of meta) {
    if (SKIP.has(key.toLowerCase()) || !value) continue;
    box.appendChild(slice._el('dt', key));
    box.appendChild(slice._el('dd', value));
  }
}

export function setReaderHead(slice, relPath, doc, meta = []) {
  const root = slice._root();
  if (!root) return;
  const kind = root.querySelector('#qa-reader-kind');
  const title = root.querySelector('#qa-reader-title');
  const pathEl = root.querySelector('#qa-reader-path');
  const label = doc && doc.kind === 'test-case' ? 'TÀI LIỆU TEST CASE' : 'TÀI LIỆU REQUIREMENT';
  const fromMeta = (meta.find(([k]) => k.toLowerCase() === 'title') || [])[1];
  if (kind) kind.textContent = doc ? label : 'TÀI LIỆU';
  if (title) title.textContent = doc ? (fromMeta || doc.name) : relPath;
  if (pathEl) pathEl.textContent = doc ? `${doc.path} · ${Math.max(1, Math.round(doc.bytes / 1024))} KB` : relPath;
}

export function renderDocChips(slice, container, doc) {
  container.textContent = '';
  const req = (slice.trace?.requirements || []).find((r) => (r.files || []).includes(doc.path));

  if (doc.kind === 'requirement' && req) {
    const uncovered = new Set((slice.trace?.findings?.major || []).filter((f) => f.kind === 'ac-khong-co-tc').map((f) => f.id));
    for (const ac of (req.acs || []).slice().sort()) {
      const covered = !uncovered.has(ac);
      const chip = slice._el('span', null, `qa-chip ${covered ? 'qa-chip-covered' : 'qa-chip-uncovered'}`);
      chip.appendChild(slice._el('span', ac));
      chip.appendChild(slice._el('span', covered ? 'có TC' : 'chưa có TC'));
      chip.title = covered ? `${ac} đã có test case` : `${ac} chưa có test case nào phủ`;
      container.appendChild(chip);
    }
    return;
  }

  for (const id of (doc.ids || []).slice(0, 24)) container.appendChild(slice._el('span', id, 'qa-chip'));
  if ((doc.ids || []).length > 24) container.appendChild(slice._el('span', `+${doc.ids.length - 24}`, 'qa-chip'));
}

export function renderOutline(slice, body) {
  const box = slice._root() && slice._root().querySelector('#qa-reader-outline');
  if (!box) return;
  box.textContent = '';
  const headings = [...body.querySelectorAll('.qa-md-h')];
  if (headings.length < 3) return;

  box.appendChild(slice._el('p', 'Mục lục', 'qa-outline-title'));
  headings.forEach((heading) => {
    const level = Number((heading.className.match(/qa-md-h(\d)/) || [, '1'])[1]);
    const link = slice._el('button', heading.textContent, `qa-outline-link qa-outline-l${level}`);
    link.type = 'button';
    link.title = heading.textContent;
    const handler = () => { body.scrollTop = heading.offsetTop - body.offsetTop; };
    link.addEventListener('click', handler);
    slice._renderDisposers.push(() => link.removeEventListener('click', handler));
    box.appendChild(link);
  });
}

export function setReaderActions(slice, doc, markdown) {
  const root = slice._root();
  if (!root) return;
  const answerBtn = root.querySelector('#qa-reader-answer');
  const answerLabel = root.querySelector('#qa-reader-answer-label');
  const editBtn = root.querySelector('#qa-reader-edit');
  const inferBtn = root.querySelector('#qa-reader-infer');
  const deleteBtn = root.querySelector('#qa-reader-delete');
  const editable = Boolean(doc) && doc.kind === 'requirement';

  if (editBtn) editBtn.hidden = !editable;
  if (deleteBtn) deleteBtn.hidden = !editable;

  const parsed = editable ? parseOpenQuestions(markdown) : { found: false, questions: [] };
  slice._openQuestions = parsed.questions;
  const pending = parsed.questions.filter((q) => !q.answered).length;
  const hasDecided = parsed.questions.some((q) => q.answered);

  if (answerBtn) {
    answerBtn.hidden = !parsed.found || !parsed.questions.length;
    if (answerLabel) answerLabel.textContent = pending ? `Trả lời câu hỏi (${pending})` : 'Câu hỏi đã chốt';
  }
  if (inferBtn) inferBtn.hidden = !editable || !hasDecided;

  const acMatches = [...(markdown || '').matchAll(/^#{2,4}\s*(AC-\d{3})\b[:\s\-—]*(.*)$/gim)];
  slice._activeDocAcs = acMatches.map((m) => ({ id: m[1].toUpperCase(), title: m[2].trim() }));
  if (!slice._activeDocAcs.length) {
    const allAc = [...(markdown || '').matchAll(/\bAC-\d{3}\b/g)];
    slice._activeDocAcs = [...new Set(allAc.map((m) => m[0].toUpperCase()))].map((id) => ({ id, title: '' }));
  }
}

export async function openDocument(docsSlice, relPath) {
  const slice = docsSlice.qaSlice;
  const root = slice._root();
  if (!root || !relPath) return;
  const overview = root.querySelector('#qa-reader-overview');
  const pane = root.querySelector('#qa-reader-doc');
  const body = root.querySelector('#qa-reader-body');
  const chips = root.querySelector('#qa-reader-chips');
  if (!pane || !body) return;

  slice.activeDocPath = relPath;
  slice._activeDoc = null;
  docsSlice._closeReaderForm();
  if (overview) overview.hidden = true;
  pane.hidden = false;
  docsSlice.renderDocList(root);

  body.textContent = '';
  if (chips) chips.textContent = '';
  body.appendChild(slice._el('p', 'Đang mở tài liệu…', 'qa-reader-loading'));

  let doc;
  try {
    doc = await apiClient.get('/api/qa/document', { path: relPath });
  } catch (error) {
    body.textContent = '';
    body.appendChild(slice._el('div', error.status === 404 ? `Không tìm thấy ${relPath}.` : `Lỗi mở file: ${error.message}`, 'qa-reader-error'));
    setReaderHead(slice, relPath, null);
    return;
  }

  if (slice.activeDocPath !== relPath) return;

  try {
    slice._activeDoc = doc;
    const { meta, body: markdown } = parseFrontMatter(doc?.content || '');
    setReaderHead(slice, doc.path, doc, meta);
    setReaderActions(slice, doc, doc.content || '');
    renderDocMeta(slice, meta);
    if (chips) renderDocChips(slice, chips, doc);

    body.textContent = '';
    body.appendChild(renderMarkdown(markdown));
    body.scrollTop = 0;
    renderOutline(slice, body);
  } catch (renderError) {
    body.textContent = '';
    body.appendChild(slice._el('div', `Không thể hiển thị tài liệu: ${renderError.message || renderError}`, 'qa-reader-error'));
  }
}
