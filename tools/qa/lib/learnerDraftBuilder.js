'use strict';
/**
 * Sinh bản nháp bài học đề xuất (Proposed Draft) đã redact từ tín hiệu thô.
 */

const path = require('node:path');
const {
  MAX_TITLE_LENGTH,
  MAX_FIELD_LENGTH,
  VALID_CATEGORIES,
} = require('./learnerConstants');
const { redactSensitiveText } = require('./learnerText');

function buildProposedDraft(signal) {
  const targetCatalog = signal.targetCatalog === 'antipattern' ? 'antipattern' : 'defect';
  const type = targetCatalog === 'antipattern' ? 'PA' : 'DH';
  const category =
    signal.suggestedCategory && VALID_CATEGORIES[type].has(signal.suggestedCategory)
      ? signal.suggestedCategory
      : type === 'PA'
      ? 'Superficial Assertion'
      : 'Data & BVA';

  let title = '';
  let trigger = '';
  let failureMode = '';
  let actionableCheck = '';

  if (signal.source === 'decisions.json') {
    title = `Quyết định ${signal.decisionId}: ${signal.title}`.slice(0, MAX_TITLE_LENGTH);
    trigger = `Khi kiểm thử phạm vi liên quan tới quyết định "${signal.title}".`.slice(0, MAX_FIELD_LENGTH);
    failureMode = (
      signal.consequence ||
      `Triển khai hoặc viết test lệch với phương án đã chốt (${signal.chosenOptionLabel}).`
    ).slice(0, MAX_FIELD_LENGTH);
    actionableCheck = (
      signal.note
        ? `Áp dụng phương án "${signal.chosenOptionLabel}" — Lưu ý: ${signal.note}`
        : `Đối chiếu AC/TC/Spec tuân thủ phương án "${signal.chosenOptionLabel}".`
    ).slice(0, MAX_FIELD_LENGTH);
  } else if (targetCatalog === 'antipattern') {
    const addedStr = String(signal.addedText || signal.rawExcerpt || '');
    const summaryLine = (addedStr.split('\n')[0] || 'Cải thiện assertion trong Playwright spec').trim();
    title = `Gia cố assertion kiểm thử tự động (${path.basename(signal.file || 'spec.ts')})`.slice(0, MAX_TITLE_LENGTH);
    trigger = `Khi viết hoặc rà soát Playwright spec có mẫu tương tự: ${(signal.oldCode || summaryLine).slice(0, 180)}`.slice(
      0,
      MAX_FIELD_LENGTH,
    );
    failureMode = `Assertion cũ (${(signal.oldCode || 'thiếu kiểm tra chiều sâu').slice(0, 180)}) có nguy cơ pass giả hoặc gây flaky.`.slice(
      0,
      MAX_FIELD_LENGTH,
    );
    actionableCheck = `Áp dụng mẫu kiểm tra chặt chẽ hơn: ${summaryLine.slice(0, 220)}`.slice(0, MAX_FIELD_LENGTH);
  } else {
    const addedStr = String(signal.addedText || signal.rawExcerpt || '');
    const rawHeading = signal.headingSummary || (addedStr.split('\n')[0] || '').replace(/^[#|\s*-]+/, '').trim();
    title = (rawHeading || `Kiểm thử biên và ngoại lệ (${path.basename(signal.file || 'doc.md')})`).slice(
      0,
      MAX_TITLE_LENGTH,
    );
    trigger = `Khi rà soát requirement/test-case có ngữ cảnh: ${title}`.slice(0, MAX_FIELD_LENGTH);
    failureMode = `Bỏ sót kịch bản kiểm thử hoặc quy tắc biên được bổ sung trong: ${String(signal.rawExcerpt || '').slice(0, 200)}`.slice(
      0,
      MAX_FIELD_LENGTH,
    );
    actionableCheck = `Đảm bảo AC, bảng Rules và Test Case bao phủ đầy đủ điều kiện: ${String(signal.rawExcerpt || '').slice(0, 220)}`.slice(
      0,
      MAX_FIELD_LENGTH,
    );
  }

  return {
    targetCatalog,
    type,
    title: redactSensitiveText(title),
    category,
    trigger: redactSensitiveText(trigger),
    failureMode: redactSensitiveText(failureMode),
    actionableCheck: redactSensitiveText(actionableCheck),
  };
}

module.exports = { buildProposedDraft };

