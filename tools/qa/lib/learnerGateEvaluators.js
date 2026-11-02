'use strict';
/**
 * Đánh giá chi tiết 4 Cổng sàng lọc (Generality, Novelty, Impact, Distillability) cho từng tín hiệu.
 */

const { MAX_PROVENANCE_PER_ENTRY, JACCARD_THRESHOLD } = require('./learnerConstants');
const {
  tokenizeForJaccard,
  computeLexicalJaccard,
  detectScriptHint,
  canonicalBusinessText,
} = require('./learnerText');

function evaluateNoveltyAgainstPool(sig, draft, fingerprint, normBusiness, comparePool) {
  let exactHit = null;
  let lexicalHit = null;
  let crossLanguageLowContext = false;

  const sigEvidenceText = `${sig.headingSummary || ''} ${sig.addedText || sig.rawExcerpt || ''}`.trim();
  const sigTextForJaccard = `${draft.title} ${draft.trigger} ${draft.failureMode} ${draft.actionableCheck} ${sig.rawExcerpt || ''}`;
  const sigTokens = tokenizeForJaccard(sigEvidenceText || sigTextForJaccard);
  const sigScript = detectScriptHint(sigEvidenceText || sigTextForJaccard);

  for (const existing of comparePool) {
    if (existing.fingerprint && existing.fingerprint === fingerprint) {
      exactHit = existing;
      break;
    }
    const existingCanonical = canonicalBusinessText(existing);
    if (existingCanonical === normBusiness) {
      exactHit = existing;
      break;
    }
    const jacDraft = computeLexicalJaccard(sigTextForJaccard, existingCanonical);
    const jacEv = sigEvidenceText
      ? computeLexicalJaccard(sigEvidenceText, existingCanonical)
      : { score: 0, empty: true };
    const bestScore = Math.max(jacDraft.score, jacEv.score);
    const isEmpty = jacDraft.empty && jacEv.empty;
    if (!isEmpty && bestScore >= JACCARD_THRESHOLD) {
      if (!lexicalHit || bestScore > lexicalHit.score) {
        lexicalHit = { id: existing.id || existing.candidateId, score: bestScore, metadata: existing.metadata };
      }
    } else if (!isEmpty && bestScore >= 0.25 && detectScriptHint(existingCanonical) !== sigScript) {
      crossLanguageLowContext = true;
    }
  }

  if (exactHit) {
    return {
      status: 'fail',
      reasonCode: 'exact-duplicate',
      reason: `Trùng khớp hoàn toàn với mục đã có (${exactHit.id || exactHit.candidateId}).`,
    };
  }
  if (lexicalHit) {
    return {
      status: 'unknown',
      reasonCode: 'possible-duplicate-lexical',
      reason: `Lexical Jaccard = ${lexicalHit.score} (>= ${JACCARD_THRESHOLD}) so với mục ${lexicalHit.id}. Cần Reviewer xác nhận có trùng ngữ nghĩa hay không.`,
      matchedId: lexicalHit.id,
      jaccardScore: lexicalHit.score,
    };
  }
  if (sig.targetCatalog === 'antipattern' && /\btoHave(?:URL|Title)\b/.test(sig.oldCode || sig.addedText || '')) {
    return {
      status: 'unknown',
      reasonCode: 'partial-static-coverage:spec-chi-assert-url',
      reason: 'Rule tĩnh "spec-chi-assert-url" chỉ bao phủ phần cú pháp URL-only; giữ phần ngữ nghĩa cho Reviewer đánh giá.',
    };
  }
  if (sigTokens.size < 4 || crossLanguageLowContext) {
    return {
      status: 'unknown',
      reasonCode: crossLanguageLowContext ? 'cross-language-comparison' : 'low-lexical-context',
      reason: 'Ít ngữ cảnh từ vựng hoặc khác ngôn ngữ với catalog hiện có; cần Reviewer kiểm tra độ mới.',
    };
  }
  return null;
}

function evaluateFourGates(sig, draft, fingerprint, normBusiness, provenanceItem, ctx) {
  const gates = {
    generality: { status: 'pass', reasonCode: 'reusable-pattern', reason: 'Có ngữ cảnh kiểm thử có thể tái sử dụng.' },
    novelty: { status: 'pass', reasonCode: 'novel-signal', reason: 'Chưa trùng với catalog hoặc lịch sử xử lý.' },
    impact: { status: 'pass', reasonCode: 'risk-evidence-present', reason: 'Có bằng chứng rủi ro kiểm thử.' },
    distillability: {
      status: 'pass',
      reasonCode: 'schema-valid',
      reason: 'Đủ trường dữ liệu chuẩn và đã redact thông tin nhạy cảm.',
    },
  };

  if (sig.isNoise) {
    gates.generality = {
      status: 'fail',
      reasonCode: sig.noiseReason || 'trivial-noise',
      reason: `Thay đổi cục bộ (${sig.noiseReason || 'comment/format/config'}), không có tính tổng quát để học.`,
    };
    return gates;
  }

  // Gate 2: Novelty
  if (ctx.processedByFp.has(fingerprint)) {
    const prev = ctx.processedByFp.get(fingerprint);
    gates.novelty = {
      status: 'fail',
      reasonCode: 'already-processed',
      reason: `Tín hiệu đã được xử lý trước đó với trạng thái "${prev.resolution}".`,
    };
  } else if (sig.isPureMissingAwaitFix) {
    gates.novelty = {
      status: 'fail',
      reasonCode: 'covered-by-static-rule:assertion-thieu-await',
      reason: 'Đã được bắt tự động 100% bởi rule tĩnh "assertion-thieu-await" trong tools/qa.',
    };
  } else if (ctx.batchAcceptedByContent.has(normBusiness)) {
    const primary = ctx.batchAcceptedByContent.get(normBusiness);
    if (primary.provenance.length < MAX_PROVENANCE_PER_ENTRY) primary.provenance.push(provenanceItem);
    gates.novelty = {
      status: 'fail',
      reasonCode: 'merged-in-batch',
      reason: `Trùng nội dung với candidate "${primary.candidateId}" trong cùng batch (đã gộp provenance).`,
    };
  } else {
    const poolResult = evaluateNoveltyAgainstPool(sig, draft, fingerprint, normBusiness, [
      ...ctx.allExistingEntries,
      ...ctx.batchEntriesForDedup,
    ]);
    if (poolResult) gates.novelty = poolResult;
  }

  // Gate 3: Impact
  if (sig.targetCatalog === 'antipattern') {
    if (sig.hasOpaqueHelperCall) {
      gates.impact = {
        status: 'unknown',
        reasonCode: 'opaque-helper-context',
        reason: 'Spec gọi hàm helper chưa rõ nội dung assertion bên trong; cần Reviewer kiểm tra.',
      };
    } else if (sig.isNewSpecOrAssertionOnly && !sig.isAssertionFix) {
      gates.impact = {
        status: 'unknown',
        reasonCode: 'new-assertion-not-automatically-fix',
        reason: 'Một dòng expect mới trong spec mới không mặc định là bản vá false-positive; cần Reviewer xác nhận.',
      };
    } else if (!sig.isAssertionFix) {
      gates.impact = {
        status: 'fail',
        reasonCode: 'no-assertion-or-isolation-risk',
        reason: 'Thay đổi trong spec không chứa bản sửa lỗi assertion, await hoặc cô lập trạng thái.',
      };
    }
  } else if (sig.source === 'decisions.json') {
    if (!sig.riskTags || sig.riskTags.length === 0) {
      gates.impact = {
        status: 'unknown',
        reasonCode: 'decision-impact-needs-review',
        reason: `Quyết định đã chốt (severity: ${sig.severity}) nhưng cần Reviewer xác nhận mức độ rủi ro kiểm thử (data/security/state/BVA).`,
      };
    }
  } else if (sig.onlyHeadingAdded || sig.hasTypeKeywordOnly) {
    gates.impact = {
      status: 'unknown',
      reasonCode: 'keyword-or-heading-only',
      reason: 'Chỉ có tiêu đề hoặc từ khoá phân loại (như Security/Edge) đơn lẻ chưa đủ bằng chứng vượt Gate 3.',
    };
  } else if (!sig.riskTags || sig.riskTags.length === 0) {
    gates.impact = {
      status: 'fail',
      reasonCode: 'happy-path-routine',
      reason: 'Thay đổi thuộc luồng happy-path thông thường, không có bằng chứng rủi ro biên/bảo mật/trạng thái.',
    };
  }

  // Gate 4: Distillability
  if ((sig.onlyHeadingAdded || !sig.hasExpectedInContext) && sig.targetCatalog === 'defect') {
    gates.distillability = {
      status: 'unknown',
      reasonCode: 'missing-expected-outcome',
      reason: 'Thiếu thông tin kết quả kỳ vọng (Expected) trong ngữ cảnh diff; Engine không tự bịa hành vi.',
    };
  }
  if (sig.hasOpaqueHelperCall) {
    gates.distillability = {
      status: 'unknown',
      reasonCode: 'insufficient-spec-context',
      reason: 'Thiếu ngữ cảnh bên trong helper để chưng cất quy tắc kiểm tra cụ thể.',
    };
  }

  return gates;
}

module.exports = { evaluateFourGates };

