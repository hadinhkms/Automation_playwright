'use strict';
/**
 * Engine Học Chọn Lọc Xuyên Trung Gian (Multi-Hop Selective Learning) — Public Facade & Orchestrator.
 */

const { loadConfig } = require('./config');
const {
  SCHEMA_VERSION,
  POLICY_VERSION,
  STOPWORDS_VERSION,
  STATIC_MAPPING_VERSION,
  MAX_CATALOG_ENTRIES,
  MAX_SIGNALS,
  JACCARD_THRESHOLD,
  VALID_CATEGORIES,
  STATIC_RULE_MAPPING,
  LearnerError,
} = require('./learnerConstants');
const {
  redactSensitiveText,
  containsUnredactedSensitive,
  computeLexicalJaccard,
  computeScopeSourceHash,
} = require('./learnerText');
const { parseCatalogMarkdown } = require('./learnerCatalogMarkdown');
const { loadCatalog } = require('./learnerCatalogLoader');
const { collectDiff } = require('./learnerGitDiff');
const { extractSignalsFromDiff } = require('./learnerDiffSignals');
const { extractSignalsFromDecisions } = require('./learnerDecisionSignals');
const { evaluateGatekeeper } = require('./learnerGatekeeper');
const { applyReviewedCandidates } = require('./learnerApplyEngine');
const {
  buildReviewArtifact,
  resolveAndValidateReviewOutputPath,
  exportReviewArtifact,
} = require('./learnerArtifactExport');

function learn(root, options = {}) {
  const cfg = { ...loadConfig(root), ...options };

  if (options.apply) {
    if (!options.review) {
      throw new LearnerError('Chế độ --apply bắt buộc phải chỉ định --review=<path>.', 'MISSING_REVIEW_FLAG');
    }
    return applyReviewedCandidates(root, options.review, cfg);
  }

  const catalog = loadCatalog(root, cfg);
  let diffResult;
  if (options.diffText !== undefined) {
    diffResult = {
      diffText: options.diffText,
      skipped: [],
      scope: {
        mode: options.since ? 'since' : 'injected-diff',
        since: options.since || null,
        resolvedBaseSha: 'injected',
        layout: {
          requirementsDir: cfg.requirementsDir,
          testCasesDir: cfg.testCasesDir,
          projectDir: cfg.projectDir,
          ignoreSpecs: cfg.ignoreSpecs,
        },
        untrackedSkippedCount: 0,
        untrackedFiles: [],
      },
    };
  } else {
    diffResult = collectDiff(root, cfg);
  }

  const diffExtracted = extractSignalsFromDiff(diffResult, { ...cfg, root });
  const decExtracted = extractSignalsFromDecisions(root);

  const allSignals = [...diffExtracted.signals, ...decExtracted.signals];
  if (allSignals.length > MAX_SIGNALS) {
    throw new LearnerError(
      `Tổng số tín hiệu (${allSignals.length}) vượt quá giới hạn ${MAX_SIGNALS}.`,
      'SIGNAL_LIMIT_EXCEEDED',
    );
  }

  const sourceHash = computeScopeSourceHash(allSignals);
  const evaluated = evaluateGatekeeper(allSignals, catalog);
  const allSkipped = [...diffExtracted.skipped, ...decExtracted.skipped];

  return {
    schemaVersion: SCHEMA_VERSION,
    mode: options.dryRun ? 'preview-dry-run' : 'preview',
    scope: diffResult.scope,
    snapshotHash: catalog.snapshotHash,
    sourceHash,
    catalogStats: catalog.stats,
    proposed: evaluated.proposed,
    needsReview: evaluated.needsReview,
    rejected: evaluated.rejected,
    applied: [],
    skipped: allSkipped,
    errors: [],
  };
}

module.exports = {
  SCHEMA_VERSION,
  POLICY_VERSION,
  STOPWORDS_VERSION,
  STATIC_MAPPING_VERSION,
  MAX_CATALOG_ENTRIES,
  JACCARD_THRESHOLD,
  VALID_CATEGORIES,
  STATIC_RULE_MAPPING,
  LearnerError,
  redactSensitiveText,
  containsUnredactedSensitive,
  computeLexicalJaccard,
  parseCatalogMarkdown,
  loadCatalog,
  collectDiff,
  extractSignalsFromDiff,
  extractSignalsFromDecisions,
  evaluateGatekeeper,
  applyReviewedCandidates,
  learn,
  buildReviewArtifact,
  resolveAndValidateReviewOutputPath,
  exportReviewArtifact,
  computeScopeSourceHash,
};

