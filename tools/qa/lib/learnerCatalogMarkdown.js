'use strict';
/**
 * Bộ phân tích và kiểm định nghiêm ngặt Shared Catalog Markdown (DH / PA).
 */

const {
  MAX_CATALOG_ENTRIES,
  MAX_TITLE_LENGTH,
  MAX_FIELD_LENGTH,
  VALID_CATEGORIES,
  REQUIRED_FIELDS,
  LearnerError,
  normalizeCatalogType,
} = require('./learnerConstants');
const { unicodeLength, stripBomAndNormalizeLf } = require('./learnerText');

function failCatalog(msg, code) {
  throw new LearnerError(msg, code);
}

function extractEntryBlocks(lines, prefix, fileLabel) {
  let inFence = false;
  let fenceMarker = null;
  const entryBlocks = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (marker === fenceMarker) {
        inFence = false;
        fenceMarker = null;
      }
      continue;
    }
    if (inFence) continue;

    if (/^\s*###\s+/.test(line)) {
      const validHeading = line.match(/^###\s+\[([A-Za-z]+-\d{2,3})\]\s+(.+?)\s*$/);
      if (!validHeading) {
        failCatalog(
          `${fileLabel}:${lineNo}: Heading entry sai quy ước "${line.trim()}". Phải theo mẫu "### [${prefix}-01] <Tiêu đề>".`,
          'MALFORMED_CATALOG_HEADING',
        );
      }
      const id = validHeading[1];
      const title = validHeading[2].trim();
      if (!id.startsWith(`${prefix}-`)) {
        failCatalog(
          `${fileLabel}:${lineNo}: Mã "${id}" sai tiền tố cho catalog ${prefix} (yêu cầu "${prefix}-xx").`,
          'WRONG_CATALOG_PREFIX',
        );
      }
      if (unicodeLength(title) === 0 || unicodeLength(title) > MAX_TITLE_LENGTH) {
        failCatalog(
          `${fileLabel}:${lineNo}: Tiêu đề của "${id}" phải từ 1..${MAX_TITLE_LENGTH} ký tự Unicode.`,
          'INVALID_TITLE_LENGTH',
        );
      }
      if (current) entryBlocks.push(current);
      current = { id, title, line: lineNo, rawLines: [] };
      continue;
    }

    if (current) {
      if (/^\s*#{1,2}\s+/.test(line)) {
        entryBlocks.push(current);
        current = null;
        continue;
      }
      current.rawLines.push({ lineNo, text: line });
    }
  }
  if (current) entryBlocks.push(current);
  return entryBlocks;
}

function parseCatalogMarkdown(rawText, type, fileLabel = 'catalog.md') {
  const { prefix, targetCatalog } = normalizeCatalogType(type);
  const allowedCategories = VALID_CATEGORIES[prefix];
  const lines = stripBomAndNormalizeLf(rawText).split('\n');
  const entryBlocks = extractEntryBlocks(lines, prefix, fileLabel);

  const seenIds = new Set();
  const entries = [];

  for (const block of entryBlocks) {
    if (seenIds.has(block.id)) {
      failCatalog(`${fileLabel}:${block.line}: Trùng mã ID "${block.id}" trong catalog.`, 'DUPLICATE_CATALOG_ID');
    }
    seenIds.add(block.id);

    const fields = new Map();
    const metadata = { staticRule: null, coverage: null };

    for (const item of block.rawLines) {
      const trimmed = item.text.trim();
      if (!trimmed || trimmed === '---') continue;

      const commentMatch = trimmed.match(/^<!--\s*(.*?)\s*-->$/);
      if (commentMatch) {
        for (const part of commentMatch[1].split('|').map((p) => p.trim())) {
          const kv = part.match(/^(staticRule|coverage)\s*:\s*(.+)$/i);
          if (kv) metadata[kv[1].toLowerCase() === 'staticrule' ? 'staticRule' : 'coverage'] = kv[2].trim();
        }
        continue;
      }

      const fieldMatch = item.text.match(/^\s*-\s*\*\*([^*]+)\*\*\s*:\s*(.*?)\s*$/);
      if (fieldMatch) {
        const fieldName = fieldMatch[1].trim();
        const fieldValue = fieldMatch[2].trim();
        if (!REQUIRED_FIELDS.includes(fieldName)) {
          failCatalog(
            `${fileLabel}:${item.lineNo}: Trường không hợp lệ "${fieldName}" ở mục ${block.id}. Chỉ nhận: ${REQUIRED_FIELDS.join(', ')}.`,
            'UNKNOWN_CATALOG_FIELD',
          );
        }
        if (fields.has(fieldName)) {
          failCatalog(`${fileLabel}:${item.lineNo}: Trường "${fieldName}" bị lặp lại ở mục ${block.id}.`, 'DUPLICATE_CATALOG_FIELD');
        }
        if (!fieldValue) {
          failCatalog(`${fileLabel}:${item.lineNo}: Trường "${fieldName}" ở mục ${block.id} không được để trống.`, 'EMPTY_CATALOG_FIELD');
        }
        fields.set(fieldName, fieldValue);
        continue;
      }

      failCatalog(`${fileLabel}:${item.lineNo}: Dòng không hợp lệ trong mục ${block.id}: "${trimmed}".`, 'MALFORMED_CATALOG_CONTENT');
    }

    for (const reqField of REQUIRED_FIELDS) {
      if (!fields.has(reqField)) {
        failCatalog(`${fileLabel}:${block.line}: Mục ${block.id} thiếu trường bắt buộc "${reqField}".`, 'MISSING_CATALOG_FIELD');
      }
    }

    const category = fields.get('Category');
    if (!allowedCategories.has(category)) {
      failCatalog(
        `${fileLabel}:${block.line}: Mục ${block.id} có Category "${category}" không hợp lệ. Chỉ nhận: ${[...allowedCategories].join(', ')}.`,
        'INVALID_CATEGORY_ENUM',
      );
    }

    const trigger = fields.get('Trigger');
    const failureMode = fields.get('Failure Mode');
    const actionableCheck = fields.get('Actionable Check');

    for (const [label, val] of [['Trigger', trigger], ['Failure Mode', failureMode], ['Actionable Check', actionableCheck]]) {
      if (unicodeLength(val) > MAX_FIELD_LENGTH) {
        failCatalog(
          `${fileLabel}:${block.line}: Trường "${label}" của mục ${block.id} vượt quá ${MAX_FIELD_LENGTH} ký tự Unicode.`,
          'FIELD_TOO_LONG',
        );
      }
    }

    entries.push({
      id: block.id,
      type: prefix,
      targetCatalog,
      title: block.title,
      category,
      trigger,
      failureMode,
      actionableCheck,
      metadata,
      layer: 'shared',
      status: 'active',
    });
  }

  if (entries.length > MAX_CATALOG_ENTRIES) {
    failCatalog(
      `${fileLabel}: Số lượng mục (${entries.length}) vượt quá trần cho phép (${MAX_CATALOG_ENTRIES}).`,
      'CATALOG_CAP_EXCEEDED',
    );
  }

  return entries;
}

module.exports = { parseCatalogMarkdown };

