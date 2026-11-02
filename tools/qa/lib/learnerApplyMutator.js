'use strict';
/**
 * Cập nhật bộ nhớ trạng thái Project Knowledge Overlay (reject, merge provenance, cấp ID đơn điệu PDH/PPA).
 */

const {
  MAX_CATALOG_ENTRIES,
  MAX_PROVENANCE_PER_ENTRY,
  MAX_EXCERPT_LENGTH,
  LearnerError,
} = require('./learnerConstants');
const {
  redactSensitiveText,
  canonicalBusinessText,
  computeResolutionContentHash,
} = require('./learnerText');
const { validateProjectKnowledgeObject } = require('./learnerKnowledgeSchema');

function applyCandidatesToKnowledge(actionable, currentCatalog, knowledge, processedMap) {
  let activeDhCount = knowledge.entries.filter((e) => e.targetCatalog === 'defect' && e.status === 'active').length;
  let activePaCount = knowledge.entries.filter((e) => e.targetCatalog === 'antipattern' && e.status === 'active').length;

  const allExistingActive = [
    ...currentCatalog.shared.defects,
    ...currentCatalog.shared.antipatterns,
    ...knowledge.entries.filter((e) => e.status === 'active'),
  ];

  const appliedItems = [];
  const rejectedItems = [];

  for (const c of actionable) {
    if (processedMap.has(c.fingerprint)) continue;

    if (c.review.status === 'rejected') {
      const procRecord = {
        fingerprint: c.fingerprint,
        resolution: 'rejected',
        resolutionHash: computeResolutionContentHash(c, 'rejected'),
        entryId: null,
        replacementId: null,
        reviewedBy: c.review.by.trim(),
        processedAt: c.review.at.trim(),
      };
      knowledge.processed.push(procRecord);
      processedMap.set(c.fingerprint, procRecord);
      rejectedItems.push({
        candidateId: c.candidateId || `CAND-${c.fingerprint.slice(0, 12)}`,
        fingerprint: c.fingerprint,
        resolution: 'rejected',
      });
      continue;
    }

    const candCanonical = canonicalBusinessText(c);
    const duplicateEntry = allExistingActive.find((e) => canonicalBusinessText(e) === candCanonical);

    if (duplicateEntry) {
      if (c.review.resolution !== 'merged' || c.review.mergeTargetId !== duplicateEntry.id) {
        throw new LearnerError(
          `Candidate "${c.candidateId || c.fingerprint}" trùng nội dung với mục "${duplicateEntry.id}". Chỉ cho phép gộp provenance khi khai rõ review.resolution="merged" và review.mergeTargetId="${duplicateEntry.id}".`,
          'DUPLICATE_ENTRY_WITHOUT_MERGE',
        );
      }
      if (duplicateEntry.layer === 'shared' || !String(duplicateEntry.id).startsWith('P')) {
        throw new LearnerError(
          `Không thể gộp provenance trực tiếp vào mục Shared Catalog "${duplicateEntry.id}" (vùng ship chỉ đọc).`,
          'CANNOT_MUTATE_SHARED_ENTRY',
        );
      }
      const targetEntry = knowledge.entries.find((e) => e.id === duplicateEntry.id);
      const mergedProvenance = [...targetEntry.provenance];
      for (const p of c.provenance) {
        if (mergedProvenance.length >= MAX_PROVENANCE_PER_ENTRY) {
          throw new LearnerError(
            `Gộp provenance vào mục "${targetEntry.id}" vượt quá giới hạn ${MAX_PROVENANCE_PER_ENTRY} nguồn.`,
            'PROVENANCE_LIMIT_EXCEEDED',
          );
        }
        mergedProvenance.push(p);
      }
      targetEntry.provenance = mergedProvenance;
      const procRecord = {
        fingerprint: c.fingerprint,
        resolution: 'merged',
        resolutionHash: computeResolutionContentHash(c, 'merged'),
        entryId: targetEntry.id,
        replacementId: null,
        reviewedBy: c.review.by.trim(),
        processedAt: c.review.at.trim(),
      };
      knowledge.processed.push(procRecord);
      processedMap.set(c.fingerprint, procRecord);
      appliedItems.push({
        id: targetEntry.id,
        candidateId: c.candidateId,
        fingerprint: c.fingerprint,
        resolution: 'merged',
        targetCatalog: c.targetCatalog,
        title: targetEntry.title,
      });
      continue;
    }

    if (c.type === 'DH') {
      if (activeDhCount + 1 > MAX_CATALOG_ENTRIES) {
        throw new LearnerError(
          `Vượt trần dung lượng Project Defect Catalog (${activeDhCount + 1}/${MAX_CATALOG_ENTRIES}). Huỷ toàn bộ batch apply.`,
          'CAP_OVERFLOW',
        );
      }
      activeDhCount++;
    } else {
      if (activePaCount + 1 > MAX_CATALOG_ENTRIES) {
        throw new LearnerError(
          `Vượt trần dung lượng Project Antipattern Catalog (${activePaCount + 1}/${MAX_CATALOG_ENTRIES}). Huỷ toàn bộ batch apply.`,
          'CAP_OVERFLOW',
        );
      }
      activePaCount++;
    }

    const nextNum = c.type === 'DH' ? knowledge.nextIds.DH++ : knowledge.nextIds.PA++;
    const newId = `P${c.type}-${String(nextNum).padStart(3, '0')}`;

    const newEntry = {
      id: newId,
      targetCatalog: c.targetCatalog,
      title: redactSensitiveText(c.title.trim()),
      category: c.category,
      trigger: redactSensitiveText(c.trigger.trim()),
      failureMode: redactSensitiveText(c.failureMode.trim()),
      actionableCheck: redactSensitiveText(c.actionableCheck.trim()),
      fingerprint: c.fingerprint,
      status: 'active',
      provenance: c.provenance.map((p) => ({
        source: p.source,
        file: p.file || null,
        line: p.line || null,
        decisionId: p.decisionId || null,
        sourceHash: p.sourceHash,
        commit: p.commit || null,
        excerpt: redactSensitiveText(p.excerpt || '').slice(0, MAX_EXCERPT_LENGTH),
      })),
      reviewedBy: c.review.by.trim(),
      reviewedAt: c.review.at.trim(),
    };

    knowledge.entries.push(newEntry);
    allExistingActive.push(newEntry);

    const procRecord = {
      fingerprint: c.fingerprint,
      resolution: 'applied',
      resolutionHash: computeResolutionContentHash(c, 'applied'),
      entryId: newId,
      replacementId: null,
      reviewedBy: c.review.by.trim(),
      processedAt: c.review.at.trim(),
    };
    knowledge.processed.push(procRecord);
    processedMap.set(c.fingerprint, procRecord);

    appliedItems.push({
      id: newId,
      candidateId: c.candidateId || `CAND-${c.fingerprint.slice(0, 12)}`,
      fingerprint: c.fingerprint,
      resolution: 'applied',
      targetCatalog: newEntry.targetCatalog,
      title: newEntry.title,
    });
  }

  validateProjectKnowledgeObject(knowledge, 'knowledge.json');
  return { appliedItems, rejectedItems };
}

module.exports = { applyCandidatesToKnowledge };

