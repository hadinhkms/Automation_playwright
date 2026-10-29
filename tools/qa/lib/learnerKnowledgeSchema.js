'use strict';
/**
 * Khởi tạo và kiểm định schema Project Knowledge Overlay (<testCasesDir>/_learning/knowledge.json).
 */

const {
  SCHEMA_VERSION,
  MAX_CATALOG_ENTRIES,
  MAX_TITLE_LENGTH,
  MAX_FIELD_LENGTH,
  MAX_PROVENANCE_PER_ENTRY,
  MAX_EXCERPT_LENGTH,
  VALID_CATEGORIES,
  LearnerError,
} = require('./learnerConstants');
const { unicodeLength, containsUnredactedSensitive } = require('./learnerText');

function emptyProjectKnowledge() {
  return {
    schemaVersion: SCHEMA_VERSION,
    nextIds: { DH: 1, PA: 1 },
    entries: [],
    processed: [],
    graduations: [],
  };
}

function validateProjectKnowledgeObject(data, fileLabel = 'knowledge.json') {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new LearnerError(`${fileLabel} phải là một JSON object.`, 'INVALID_KNOWLEDGE_SCHEMA');
  }
  if (data.schemaVersion !== SCHEMA_VERSION) {
    throw new LearnerError(
      `${fileLabel}: schemaVersion "${data.schemaVersion}" không khớp "${SCHEMA_VERSION}".`,
      'UNSUPPORTED_SCHEMA_VERSION',
    );
  }
  if (
    !data.nextIds ||
    typeof data.nextIds !== 'object' ||
    !Number.isInteger(data.nextIds.DH) ||
    data.nextIds.DH < 1 ||
    !Number.isInteger(data.nextIds.PA) ||
    data.nextIds.PA < 1
  ) {
    throw new LearnerError(
      `${fileLabel}: nextIds.DH và nextIds.PA phải là số nguyên dương >= 1.`,
      'INVALID_KNOWLEDGE_NEXT_IDS',
    );
  }
  if (!Array.isArray(data.entries) || !Array.isArray(data.processed) || !Array.isArray(data.graduations)) {
    throw new LearnerError(
      `${fileLabel}: entries, processed và graduations phải là mảng.`,
      'INVALID_KNOWLEDGE_ARRAYS',
    );
  }

  const seenIds = new Set();
  let maxDhNum = 0;
  let maxPaNum = 0;
  let activeDh = 0;
  let activePa = 0;

  for (let i = 0; i < data.entries.length; i++) {
    const e = data.entries[i];
    if (!e || typeof e !== 'object') {
      throw new LearnerError(`${fileLabel}: entries[${i}] không hợp lệ.`, 'INVALID_PROJECT_ENTRY');
    }
    const idMatch = String(e.id || '').match(/^(PDH|PPA)-(\d{3,4})$/);
    if (!idMatch) {
      throw new LearnerError(
        `${fileLabel}: entries[${i}].id "${e.id}" sai định dạng (phải là PDH-001 hoặc PPA-001).`,
        'INVALID_PROJECT_ENTRY_ID',
      );
    }
    if (seenIds.has(e.id)) {
      throw new LearnerError(`${fileLabel}: Trùng mã project entry "${e.id}".`, 'DUPLICATE_PROJECT_ENTRY_ID');
    }
    seenIds.add(e.id);

    const prefix = idMatch[1] === 'PDH' ? 'DH' : 'PA';
    const num = Number.parseInt(idMatch[2], 10);
    if (prefix === 'DH') maxDhNum = Math.max(maxDhNum, num);
    else maxPaNum = Math.max(maxPaNum, num);

    const expectedTarget = prefix === 'DH' ? 'defect' : 'antipattern';
    if (e.targetCatalog !== expectedTarget) {
      throw new LearnerError(
        `${fileLabel}: Mục ${e.id} có targetCatalog "${e.targetCatalog}" không khớp "${expectedTarget}".`,
        'MISMATCHED_TARGET_CATALOG',
      );
    }
    if (!VALID_CATEGORIES[prefix].has(e.category)) {
      throw new LearnerError(`${fileLabel}: Mục ${e.id} có category "${e.category}" không hợp lệ.`, 'INVALID_PROJECT_CATEGORY');
    }
    if (!e.title || unicodeLength(e.title) > MAX_TITLE_LENGTH) {
      throw new LearnerError(
        `${fileLabel}: Mục ${e.id} có title trống hoặc vượt ${MAX_TITLE_LENGTH} ký tự.`,
        'INVALID_PROJECT_TITLE',
      );
    }
    for (const f of ['trigger', 'failureMode', 'actionableCheck']) {
      if (!e[f] || typeof e[f] !== 'string' || unicodeLength(e[f]) > MAX_FIELD_LENGTH) {
        throw new LearnerError(
          `${fileLabel}: Mục ${e.id} có trường "${f}" trống hoặc vượt ${MAX_FIELD_LENGTH} ký tự.`,
          'INVALID_PROJECT_FIELD',
        );
      }
      if (containsUnredactedSensitive(e[f])) {
        throw new LearnerError(
          `${fileLabel}: Mục ${e.id} chứa thông tin nhạy cảm chưa redact ở trường "${f}".`,
          'UNREDACTED_SENSITIVE_DATA',
        );
      }
    }
    if (e.status !== 'active' && e.status !== 'retired') {
      throw new LearnerError(
        `${fileLabel}: Mục ${e.id} có status "${e.status}" không hợp lệ (chỉ nhận active | retired).`,
        'INVALID_PROJECT_STATUS',
      );
    }
    if (e.status === 'active') {
      if (prefix === 'DH') activeDh++;
      else activePa++;
    }
    if (!Array.isArray(e.provenance) || e.provenance.length === 0 || e.provenance.length > MAX_PROVENANCE_PER_ENTRY) {
      throw new LearnerError(
        `${fileLabel}: Mục ${e.id} phải có từ 1..${MAX_PROVENANCE_PER_ENTRY} provenance.`,
        'INVALID_PROVENANCE_COUNT',
      );
    }
    for (const p of e.provenance) {
      if (!p || typeof p !== 'object' || !p.source) {
        throw new LearnerError(`${fileLabel}: Provenance của ${e.id} thiếu source.`, 'INVALID_PROVENANCE_ITEM');
      }
      if (p.excerpt && unicodeLength(p.excerpt) > MAX_EXCERPT_LENGTH) {
        throw new LearnerError(
          `${fileLabel}: Provenance excerpt của ${e.id} vượt ${MAX_EXCERPT_LENGTH} ký tự.`,
          'PROVENANCE_EXCERPT_TOO_LONG',
        );
      }
    }
  }

  if (activeDh > MAX_CATALOG_ENTRIES || activePa > MAX_CATALOG_ENTRIES) {
    throw new LearnerError(
      `${fileLabel}: Số mục active vượt trần ${MAX_CATALOG_ENTRIES} (DH=${activeDh}, PA=${activePa}).`,
      'PROJECT_CAP_EXCEEDED',
    );
  }
  if (data.nextIds.DH <= maxDhNum || data.nextIds.PA <= maxPaNum) {
    throw new LearnerError(
      `${fileLabel}: nextIds (${JSON.stringify(data.nextIds)}) không lớn hơn ID lớn nhất đã cấp (DH=${maxDhNum}, PA=${maxPaNum}) — vi phạm nguyên tắc không tái sử dụng ID retired.`,
      'NON_MONOTONIC_NEXT_IDS',
    );
  }

  return data;
}

module.exports = {
  emptyProjectKnowledge,
  validateProjectKnowledgeObject,
};

