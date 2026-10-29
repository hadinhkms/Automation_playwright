'use strict';
/**
 * Đọc Shared Catalog + Project Knowledge Overlay -> tổng hợp Effective View, Stats và SnapshotHash.
 */

const fs = require('node:fs');
const path = require('node:path');
const { loadConfig } = require('./config');
const {
  SCHEMA_VERSION,
  POLICY_VERSION,
  MAX_CATALOG_ENTRIES,
  MAX_EFFECTIVE_BEFORE_DEDUP,
  JACCARD_THRESHOLD,
  SHARED_DEFECT_REL,
  SHARED_ANTIPATTERN_REL,
  LearnerError,
} = require('./learnerConstants');
const {
  sha256,
  stripBomAndNormalizeLf,
  computeLexicalJaccard,
  canonicalBusinessText,
} = require('./learnerText');
const { resolveAndValidateRepoPath } = require('./learnerPaths');
const { parseCatalogMarkdown } = require('./learnerCatalogMarkdown');
const { emptyProjectKnowledge, validateProjectKnowledgeObject } = require('./learnerKnowledgeSchema');

function mergeOverlayCatalog(sharedEntries, projectEntries, targetCatalog, shadowed) {
  const effective = [...sharedEntries];
  for (const pe of projectEntries) {
    if (effective.length >= MAX_EFFECTIVE_BEFORE_DEDUP) break;
    const peText = canonicalBusinessText(pe);
    const matchShared = sharedEntries.find((se) => {
      if (canonicalBusinessText(se) === peText) return true;
      const jac = computeLexicalJaccard(peText, canonicalBusinessText(se));
      return !jac.empty && jac.score >= JACCARD_THRESHOLD;
    });
    if (matchShared) {
      shadowed.push({ projectEntryId: pe.id, shadowedBySharedId: matchShared.id, targetCatalog });
    } else {
      effective.push(pe);
    }
  }
  return effective;
}

function loadCatalog(root, options = {}) {
  const cfg = { ...loadConfig(root), ...options };
  const defectPath = path.resolve(root, options.sharedDefectCatalog || SHARED_DEFECT_REL);
  const antipatternPath = path.resolve(root, options.sharedAntipatternCatalog || SHARED_ANTIPATTERN_REL);

  if (!fs.existsSync(defectPath)) {
    throw new LearnerError(`Thiếu file Shared Defect Catalog: ${SHARED_DEFECT_REL}`, 'MISSING_SHARED_CATALOG');
  }
  if (!fs.existsSync(antipatternPath)) {
    throw new LearnerError(
      `Thiếu file Shared Playwright Antipattern Catalog: ${SHARED_ANTIPATTERN_REL}`,
      'MISSING_SHARED_CATALOG',
    );
  }

  let rawDefects;
  let rawAntipatterns;
  try {
    rawDefects = fs.readFileSync(defectPath, 'utf8');
    rawAntipatterns = fs.readFileSync(antipatternPath, 'utf8');
  } catch (err) {
    throw new LearnerError(`Lỗi đọc Shared Catalog: ${err.message}`, 'SHARED_CATALOG_READ_ERROR');
  }

  const sharedDefects = parseCatalogMarkdown(rawDefects, 'DH', SHARED_DEFECT_REL);
  const sharedAntipatterns = parseCatalogMarkdown(rawAntipatterns, 'PA', SHARED_ANTIPATTERN_REL);

  const knowledgeRelPath = `${cfg.testCasesDir || 'test-cases'}/_learning/knowledge.json`;
  const { absPath: knowledgeAbsPath, relPath: validatedKnowledgeRel } = resolveAndValidateRepoPath(
    root,
    knowledgeRelPath,
    { requireOwn: Boolean(options.requireOwnOverlay) },
  );

  let projectKnowledge = emptyProjectKnowledge();
  let projectOverlayPresent = false;

  if (fs.existsSync(knowledgeAbsPath)) {
    projectOverlayPresent = true;
    let rawJson;
    try {
      rawJson = fs.readFileSync(knowledgeAbsPath, 'utf8');
    } catch (err) {
      throw new LearnerError(`Không đọc được ${validatedKnowledgeRel}: ${err.message}`, 'PROJECT_OVERLAY_READ_ERROR');
    }
    let parsed;
    try {
      parsed = JSON.parse(stripBomAndNormalizeLf(rawJson));
    } catch (err) {
      throw new LearnerError(
        `${validatedKnowledgeRel} không phải JSON hợp lệ: ${err.message}`,
        'PROJECT_OVERLAY_INVALID_JSON',
      );
    }
    projectKnowledge = validateProjectKnowledgeObject(parsed, validatedKnowledgeRel);
  }

  const projectActiveDefects = projectKnowledge.entries
    .filter((e) => e.targetCatalog === 'defect' && e.status === 'active')
    .map((e) => ({ ...e, type: 'DH', layer: 'project' }));
  const projectActiveAntipatterns = projectKnowledge.entries
    .filter((e) => e.targetCatalog === 'antipattern' && e.status === 'active')
    .map((e) => ({ ...e, type: 'PA', layer: 'project' }));

  const shadowed = [];
  const effectiveDefects = mergeOverlayCatalog(sharedDefects, projectActiveDefects, 'defect', shadowed);
  const effectiveAntipatterns = mergeOverlayCatalog(sharedAntipatterns, projectActiveAntipatterns, 'antipattern', shadowed);

  const canonicalProjectState = JSON.stringify({
    schemaVersion: projectKnowledge.schemaVersion,
    nextIds: projectKnowledge.nextIds,
    entries: projectKnowledge.entries,
    processed: projectKnowledge.processed,
    graduations: projectKnowledge.graduations,
  });

  const snapshotHash = sha256(
    [
      `schema:${SCHEMA_VERSION}`,
      `policy:${POLICY_VERSION}`,
      `sharedDH:${stripBomAndNormalizeLf(rawDefects)}`,
      `sharedPA:${stripBomAndNormalizeLf(rawAntipatterns)}`,
      `project:${canonicalProjectState}`,
    ].join('\n---\n'),
  );

  const retiredCount = projectKnowledge.entries.filter((e) => e.status === 'retired').length;

  return {
    schemaVersion: SCHEMA_VERSION,
    maxEntriesPerCatalog: MAX_CATALOG_ENTRIES,
    overlayPath: validatedKnowledgeRel,
    overlayPresent: projectOverlayPresent,
    shared: { defects: sharedDefects, antipatterns: sharedAntipatterns },
    project: projectKnowledge,
    effective: { defects: effectiveDefects, antipatterns: effectiveAntipatterns, shadowed },
    stats: {
      shared: {
        DH: sharedDefects.length,
        PA: sharedAntipatterns.length,
        total: sharedDefects.length + sharedAntipatterns.length,
      },
      project: {
        DH: projectActiveDefects.length,
        PA: projectActiveAntipatterns.length,
        active: projectActiveDefects.length + projectActiveAntipatterns.length,
        retired: retiredCount,
        processed: projectKnowledge.processed.length,
        graduations: projectKnowledge.graduations.length,
      },
      effective: {
        DH: effectiveDefects.length,
        PA: effectiveAntipatterns.length,
        total: effectiveDefects.length + effectiveAntipatterns.length,
        shadowed: shadowed.length,
      },
    },
    snapshotHash,
  };
}

module.exports = { loadCatalog };

