'use strict';

/**
 * dashboard/public/js/views/qa/slices/qaDocsAnswerForm.js
 * Form trả lời câu hỏi treo và form biên tập markdown trực tiếp.
 * Line budget: <= 150 lines (role: module).
 */

import { applyAnswers } from '../openQuestions.js';
import { formShell, saveDocument } from './qaDocsForms.js';

export function openAnswerForm(docsSlice) {
  const slice = docsSlice.qaSlice;
  if (!slice._activeDoc || !slice._openQuestions || !slice._openQuestions.length) return;
  const { body, by, save, status } = formShell(
    slice,
    'Trả lời câu hỏi treo',
    'Câu trả lời được ghi thẳng vào dòng câu hỏi, thay cho đuôi "cần ... xác nhận". Phần còn lại giữ nguyên.',
    docsSlice._lastAuthor,
  );

  const hasDecided = slice._openQuestions.some((q) => q.answered);
  if (hasDecided) {
    const banner = slice._el('div', null, 'qa-infer-prompt-banner');
    banner.style.cssText = 'background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;';
    const text = slice._el('span', '💡 Đã có quyết định chốt! Rà soát để tự động sinh Test Case:', null);
    text.style.fontSize = '12px';
    text.style.fontWeight = '600';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-secondary-sm';
    btn.textContent = '🔍 Rà soát Test Case';
    btn.addEventListener('click', () => slice.inferenceSlice.openInferModal());
    banner.appendChild(text);
    banner.appendChild(btn);
    body.appendChild(banner);
  }

  const inputs = [];
  for (const q of slice._openQuestions) {
    const card = slice._el('div', null, `qa-question${q.answered ? ' is-answered' : ''}`);
    card.appendChild(slice._el('p', q.text, 'qa-question-text'));
    if (q.answered) {
      card.appendChild(slice._el('p', 'Câu này đã có kết luận trong tài liệu.', 'qa-question-note'));
    } else {
      const area = document.createElement('textarea');
      area.className = 'qa-textarea';
      area.style.width = '100%';
      area.style.boxSizing = 'border-box';
      area.rows = 2;
      area.placeholder = 'Kết luận của bạn…';
      card.appendChild(area);
      inputs.push({ line: q.line, area });
    }
    body.appendChild(card);
  }

  const handler = async () => {
    const author = by.value.trim();
    if (!author) {
      status.className = 'qa-form-status is-error';
      status.textContent = 'Cần tên người chốt để ghi vào tài liệu.';
      return;
    }
    const answers = inputs.map((i) => ({ line: i.line, answer: i.area.value })).filter((a) => a.answer.trim());
    if (!answers.length) {
      status.className = 'qa-form-status is-error';
      status.textContent = 'Chưa nhập câu trả lời nào.';
      return;
    }
    docsSlice._lastAuthor = author;
    const stamp = new Date().toISOString().slice(0, 10);
    const next = applyAnswers(slice._activeDoc.content, answers, { author, date: stamp });
    await saveDocument(docsSlice, next.content, status, save);
  };
  save.addEventListener('click', handler);
  slice._renderDisposers.push(() => save.removeEventListener('click', handler));
}

export function openEditForm(docsSlice) {
  const slice = docsSlice.qaSlice;
  if (!slice._activeDoc) return;
  const { body, by, save, status } = formShell(
    slice,
    'Sửa tài liệu requirement',
    'Sửa trực tiếp Markdown. Bản cũ được sao lưu tự động trước khi ghi đè.',
    docsSlice._lastAuthor,
  );

  const area = document.createElement('textarea');
  area.className = 'qa-textarea qa-edit-area';
  area.style.width = '100%';
  area.style.boxSizing = 'border-box';
  area.rows = 22;
  area.value = slice._activeDoc.content;
  area.spellcheck = false;
  body.appendChild(area);

  const handler = async () => {
    const author = by.value.trim();
    if (author) docsSlice._lastAuthor = author;
    await saveDocument(docsSlice, area.value, status, save);
  };
  save.addEventListener('click', handler);
  slice._renderDisposers.push(() => save.removeEventListener('click', handler));
}
