'use strict';
/**
 * Bóc tách tín hiệu học tập từ decisions.json (chỉ nhận quyết định đã confirmed và hợp lệ schema).
 */

const fs = require('node:fs');
const path = require('node:path');
const { MAX_EXCERPT_LENGTH, LearnerError } = require('./learnerConstants');
const { sha256, stripBomAndNormalizeLf, redactSensitiveText } = require('./learnerText');
const { analyzeRiskIndicators } = require('./learnerDiffParser');

function extractSignalsFromDecisions(root) {
  const decisionsPath = path.join(root, 'decisions.json');
  if (!fs.existsSync(decisionsPath)) {
    return { present: false, signals: [], skipped: [] };
  }

  let raw;
  try {
    raw = fs.readFileSync(decisionsPath, 'utf8');
  } catch (err) {
    throw new LearnerError(`Không đọc được decisions.json: ${err.message}`, 'DECISIONS_READ_ERROR');
  }

  let data;
  try {
    data = JSON.parse(stripBomAndNormalizeLf(raw));
  } catch (err) {
    throw new LearnerError(`decisions.json không phải JSON hợp lệ: ${err.message}`, 'DECISIONS_INVALID_JSON');
  }

  if (!data || typeof data !== 'object' || !Array.isArray(data.decisions)) {
    throw new LearnerError('decisions.json thiếu mảng "decisions" ở cấp root.', 'DECISIONS_INVALID_SCHEMA');
  }

  const signals = [];
  const skipped = [];

  for (let i = 0; i < data.decisions.length; i++) {
    const d = data.decisions[i];
    if (!d || typeof d !== 'object' || !d.id || !d.title || !Array.isArray(d.options)) {
      throw new LearnerError(
        `decisions.json: mục tại vị trí ${i} (${(d && d.id) || 'thiếu id'}) sai schema bắt buộc.`,
        'DECISIONS_ITEM_INVALID_SCHEMA',
      );
    }

    if (d.status !== 'confirmed') {
      skipped.push({ decisionId: d.id, file: 'decisions.json', reason: 'decision-not-confirmed' });
      continue;
    }

    if (!d.answer || typeof d.answer !== 'object' || Array.isArray(d.answer)) {
      throw new LearnerError(
        `decisions.json: mục "${d.id}" có status="confirmed" nhưng trường answer không phải object.`,
        'DECISION_CONFIRMED_MISSING_ANSWER',
      );
    }

    const optionId = typeof d.answer.optionId === 'string' ? d.answer.optionId.trim() : '';
    if (!optionId) {
      throw new LearnerError(
        `decisions.json: mục "${d.id}" có status="confirmed" nhưng thiếu answer.optionId.`,
        'DECISION_CONFIRMED_EMPTY_OPTION',
      );
    }

    const matchedOption = d.options.find((opt) => opt && opt.id === optionId);
    if (!matchedOption || typeof matchedOption.label !== 'string' || !matchedOption.label.trim()) {
      throw new LearnerError(
        `decisions.json: mục "${d.id}" có answer.optionId="${optionId}" không tồn tại trong danh sách options.`,
        'DECISION_CONFIRMED_INVALID_OPTION',
      );
    }

    const noteText = typeof d.answer.note === 'string' ? d.answer.note.trim() : '';
    const consequenceText = typeof matchedOption.consequence === 'string' ? matchedOption.consequence.trim() : '';
    const combinedEvidence = redactSensitiveText(
      [
        `Decision ${d.id}: ${d.title}`,
        `Chosen Option (${optionId}): ${matchedOption.label.trim()}`,
        consequenceText ? `Consequence: ${consequenceText}` : '',
        noteText ? `Note: ${noteText}` : '',
      ]
        .filter(Boolean)
        .join(' | '),
    );

    const riskInfo = analyzeRiskIndicators(`${d.title} ${matchedOption.label} ${consequenceText} ${noteText}`);

    signals.push({
      source: 'decisions.json',
      file: 'decisions.json',
      line: 1,
      decisionId: d.id,
      severity: d.severity || 'soon',
      targetCatalog: 'defect',
      isNoise: false,
      title: redactSensitiveText(d.title.trim()),
      chosenOptionLabel: redactSensitiveText(matchedOption.label.trim()),
      note: redactSensitiveText(noteText),
      consequence: redactSensitiveText(consequenceText),
      hasExpectedInContext: Boolean(noteText || consequenceText),
      riskTags: riskInfo.tags,
      suggestedCategory: riskInfo.suggestedCategory || 'State & Concurrency',
      addedText: combinedEvidence,
      contextText: combinedEvidence,
      rawExcerpt: combinedEvidence.slice(0, MAX_EXCERPT_LENGTH),
      sourceHash: sha256(`decision:${d.id}:${optionId}:${noteText}`),
    });
  }

  return { present: true, signals, skipped };
}

module.exports = { extractSignalsFromDecisions };

