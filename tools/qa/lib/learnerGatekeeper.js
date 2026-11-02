'use strict';
/**
 * Điều phối bộ lọc 4 Cổng (Gatekeeper) trả về danh sách proposed / needsReview / rejected đã sắp xếp ổn định.
 */

const { MAX_EXCERPT_LENGTH } = require('./learnerConstants');
const { sha256, redactSensitiveText, canonicalBusinessText } = require('./learnerText');
const { buildProposedDraft } = require('./learnerDraftBuilder');
const { evaluateFourGates } = require('./learnerGateEvaluators');

function sortCandidates(arr) {
  return arr.sort((a, b) => {
    const pA = a.provenance[0] || {};
    const pB = b.provenance[0] || {};
    return (
      String(pA.source || '').localeCompare(String(pB.source || '')) ||
      String(pA.file || '').localeCompare(String(pB.file || '')) ||
      (pA.line || 0) - (pB.line || 0) ||
      String(a.fingerprint || '').localeCompare(String(b.fingerprint || ''))
    );
  });
}

function evaluateGatekeeper(signals, catalog) {
  const proposed = [];
  const needsReview = [];
  const rejected = [];

  const allExistingEntries = [
    ...(catalog && catalog.shared ? catalog.shared.defects : []),
    ...(catalog && catalog.shared ? catalog.shared.antipatterns : []),
    ...((catalog && catalog.project && catalog.project.entries) || []).filter((e) => e.status === 'active'),
  ];
  const processedList = (catalog && catalog.project && catalog.project.processed) || [];
  const ctx = {
    allExistingEntries,
    processedByFp: new Map(processedList.map((p) => [p.fingerprint, p])),
    batchAcceptedByContent: new Map(),
    batchEntriesForDedup: [],
  };

  for (const sig of signals || []) {
    const draft = buildProposedDraft(sig);
    const normEvidence = String(sig.rawExcerpt || sig.addedText || '')
      .normalize('NFKC')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    const normBusiness = canonicalBusinessText(draft);

    const fingerprint = sha256(`${sig.source}|${normEvidence}|${normBusiness}`);
    const candidateId = `CAND-${fingerprint.slice(0, 12)}`;

    const provenanceItem = {
      source: sig.source,
      file: sig.file || null,
      line: sig.line || null,
      decisionId: sig.decisionId || null,
      sourceHash: sig.sourceHash || sha256(normEvidence),
      excerpt: redactSensitiveText(sig.rawExcerpt || '').slice(0, MAX_EXCERPT_LENGTH),
    };

    const gates = evaluateFourGates(sig, draft, fingerprint, normBusiness, provenanceItem, ctx);
    const gateStatuses = [
      gates.generality.status,
      gates.novelty.status,
      gates.impact.status,
      gates.distillability.status,
    ];

    let classification = 'proposed';
    if (gateStatuses.includes('fail')) classification = 'rejected';
    else if (gateStatuses.includes('unknown')) classification = 'needsReview';

    const candidateRecord = {
      candidateId,
      fingerprint,
      sourceHash: provenanceItem.sourceHash,
      status: classification,
      targetCatalog: draft.targetCatalog,
      type: draft.type,
      title: draft.title,
      category: draft.category,
      trigger: draft.trigger,
      failureMode: draft.failureMode,
      actionableCheck: draft.actionableCheck,
      evidence: provenanceItem.excerpt,
      provenance: [provenanceItem],
      gates,
      review: { status: 'pending', by: '', at: '', rationale: '' },
    };

    if (classification === 'rejected') {
      const failedEntry = Object.entries(gates).find(([, g]) => g.status === 'fail');
      rejected.push({
        ...candidateRecord,
        failedGate: failedEntry ? failedEntry[0] : 'unknown',
        reasonCode: failedEntry ? failedEntry[1].reasonCode : 'rejected',
        reason: failedEntry ? failedEntry[1].reason : 'Không vượt qua bộ lọc 4 cổng.',
      });
    } else if (classification === 'needsReview') {
      ctx.batchAcceptedByContent.set(normBusiness, candidateRecord);
      ctx.batchEntriesForDedup.push(candidateRecord);
      needsReview.push(candidateRecord);
    } else {
      ctx.batchAcceptedByContent.set(normBusiness, candidateRecord);
      ctx.batchEntriesForDedup.push(candidateRecord);
      proposed.push(candidateRecord);
    }
  }

  return {
    proposed: sortCandidates(proposed),
    needsReview: sortCandidates(needsReview),
    rejected: sortCandidates(rejected),
  };
}

module.exports = { evaluateGatekeeper };

