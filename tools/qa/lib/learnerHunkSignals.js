'use strict';
/**
 * Xây dựng đối tượng tín hiệu học tập từ một hunk diff của tài liệu Markdown hoặc Playwright Spec.
 */

const { MAX_EXCERPT_LENGTH } = require('./learnerConstants');
const { sha256, redactSensitiveText } = require('./learnerText');
const { analyzeRiskIndicators } = require('./learnerDiffParser');

const HEADING_RE = /^\s{0,3}#{2,6}\s*((?:AC|TC)-\d{3})\b\s*[:\-–—]?\s*(.*?)\s*$/;

function buildDocHunkSignal(filePath, fileKind, hunk, nonBlankAdded) {
  const fullHunkText = hunk.allNewAndContext.join('\n');
  const addedText = hunk.added.join('\n');

  const headings = [];
  for (const l of hunk.allNewAndContext) {
    const hm = l.match(HEADING_RE);
    if (hm) headings.push({ id: hm[1], title: hm[2] });
  }

  const tableRowsAdded = hunk.added
    .filter((l) => l.trim().startsWith('|') && !/^\s*\|[\s:-]+\|\s*$/.test(l))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
    .filter((cells) => cells.length >= 3 && !/^(?:Field\/rule|ID|REQ|TC)$/i.test(cells[0] || ''));

  const hasExpectedInContext =
    /\bexpected\b\s*[:|]/i.test(fullHunkText) ||
    /kết\s+quả\s+mong\s+đợi/i.test(fullHunkText) ||
    tableRowsAdded.some((cells) => cells.length >= 5 && Boolean(cells[4]));

  const riskInfo = analyzeRiskIndicators(`${addedText}\n${hunk.sectionHint}`);
  const hasTypeKeywordOnly =
    /\b(?:Type\s*:\s*Security|Security|Edge|Boundary|Negative)\b/i.test(addedText) &&
    riskInfo.tags.length === 0;

  const headingSummary = headings.length > 0 ? `${headings[0].id}: ${headings[0].title}` : '';
  const redactedAdded = redactSensitiveText(addedText.trim());
  const redactedContext = redactSensitiveText(fullHunkText.trim());
  const onlyHeadingAdded =
    nonBlankAdded.length === 1 && HEADING_RE.test(nonBlankAdded[0]) && !hasExpectedInContext;

  return {
    source: `git-diff:${fileKind}`,
    file: filePath,
    line: hunk.newStart,
    targetCatalog: 'defect',
    isNoise: false,
    headingSummary,
    hasExpectedInContext,
    onlyHeadingAdded,
    hasTypeKeywordOnly,
    riskTags: riskInfo.tags,
    suggestedCategory: riskInfo.suggestedCategory || 'Data & BVA',
    tableRowsAdded,
    addedText: redactedAdded,
    contextText: redactedContext,
    rawExcerpt: redactedAdded.slice(0, MAX_EXCERPT_LENGTH),
    sourceHash: sha256(`${filePath}:${hunk.newStart}:${addedText}`),
  };
}

function buildSpecHunkSignal(filePath, isNewFile, hunk) {
  const oldCode = hunk.removed.join('\n');
  const newCode = hunk.added.join('\n');
  const fullSpecHunk = hunk.allNewAndContext.join('\n');

  const oldHasExpect = /\bexpect(?:\.soft)?\s*\(/.test(oldCode);
  const newHasExpect = /\bexpect(?:\.soft)?\s*\(/.test(newCode);
  const oldMissingAwait =
    oldHasExpect &&
    !/\b(?:await|return)\s+expect/.test(oldCode) &&
    /\bawait\s+expect/.test(newCode);
  const oldUrlOnly =
    oldHasExpect &&
    /\btoHave(?:URL|Title)\s*\(/.test(oldCode) &&
    !/\bto(?:BeVisible|HaveText|ContainText|HaveValue|BeDisabled|HaveAttribute)\s*\(/.test(oldCode);
  const newAddsDeeperAssert =
    newHasExpect &&
    /\bto(?:BeVisible|HaveText|ContainText|HaveValue|BeDisabled|HaveAttribute|HaveCount)\s*\(/.test(newCode);
  const newAddsNegativeSideEffectCheck =
    /\b(?:waitForRequest|on\(['"]request|toBeDisabled|aria-busy|requestCount)\b/.test(newCode);
  const newAddsParallelIsolation =
    /\b(?:test\.describe\.configure|unique|randomUUID|createIsolated|seedUser)\b/i.test(newCode);

  const isAssertionFix =
    !isNewFile &&
    ((oldHasExpect && newHasExpect && oldCode.trim() !== newCode.trim()) ||
      (oldUrlOnly && newAddsDeeperAssert) ||
      newAddsNegativeSideEffectCheck ||
      newAddsParallelIsolation);

  const isPureMissingAwaitFix =
    oldMissingAwait &&
    oldCode.replace(/\bawait\s+/g, '').trim() === newCode.replace(/\bawait\s+/g, '').trim();

  const isNewSpecOrAssertionOnly =
    (isNewFile || !oldHasExpect) &&
    newHasExpect &&
    !newAddsNegativeSideEffectCheck &&
    !newAddsParallelIsolation;

  const hasOpaqueHelperCall =
    !oldHasExpect &&
    !newHasExpect &&
    /\b(?:verify|assert|check)[A-Z][A-Za-z0-9_]*\s*\(/.test(newCode);

  let suggestedCategory = 'Superficial Assertion';
  if (newAddsNegativeSideEffectCheck) suggestedCategory = 'Negative Side Effects';
  else if (newAddsParallelIsolation) suggestedCategory = 'Parallel Isolation';
  else if (oldMissingAwait) suggestedCategory = 'Async & Timing';

  const redactedNew = redactSensitiveText(newCode.trim());
  const redactedOld = redactSensitiveText(oldCode.trim());

  return {
    source: 'git-diff:playwright-spec',
    file: filePath,
    line: hunk.newStart,
    targetCatalog: 'antipattern',
    isNoise: false,
    isNewFile,
    isAssertionFix,
    isPureMissingAwaitFix,
    isNewSpecOrAssertionOnly,
    hasOpaqueHelperCall,
    suggestedCategory,
    oldCode: redactedOld,
    addedText: redactedNew,
    contextText: redactSensitiveText(fullSpecHunk.trim()),
    rawExcerpt: redactedNew.slice(0, MAX_EXCERPT_LENGTH),
    sourceHash: sha256(`${filePath}:${hunk.newStart}:${oldCode}->${newCode}`),
  };
}

module.exports = {
  buildDocHunkSignal,
  buildSpecHunkSignal,
};

