'use strict';

/**
 * dashboard/services/qaInferenceService.js
 * Orchestrator điều phối suy luận kiểm thử QA (Heuristic vs AI) và trích xuất Scaffold.
 * Tuân thủ chuẩn Modular Decomposition (PLAN-07).
 */

const fs = require('fs');
const path = require('path');

const {
  RE_REQ,
  RE_AC,
  RE_TC,
  extractAcs,
  extractDecidedQuestions,
  findTestCaseFile,
  getNextTcId,
  slugify,
  inferDomainFromText,
} = require('./qa/markdownRequirementParser');

const { inferWithHeuristic } = require('./qa/heuristicInferenceEngine');
const { inferWithAi, extractWithAi } = require('./qa/semanticAiInferenceEngine');
const {
  detectIsTestScript,
  parseTestBlocksFromScript,
  extractHeuristicFromTestScript,
  extractHeuristicFromSpecText,
} = require('./qa/scaffoldScriptParser');
const { appendTestCasesToDocument, synthesizeScaffoldContents } = require('./qa/scaffoldSynthesizer');

async function inferTestCases({ root, reqPath, mode = 'heuristic', clientConfig = null }) {
  const absReqPath = path.resolve(root, reqPath);
  if (!fs.existsSync(absReqPath)) {
    throw Object.assign(new Error(`Tài liệu requirement "${reqPath}" không tồn tại.`), { status: 404 });
  }

  const reqContent = fs.readFileSync(absReqPath, 'utf8');
  const reqMatch = reqContent.match(RE_REQ);
  const reqId = reqMatch ? reqMatch[0].toUpperCase() : 'REQ-001';

  const decidedQuestions = extractDecidedQuestions(reqContent);
  if (!decidedQuestions.length) {
    return {
      success: true,
      reqId,
      mode,
      count: 0,
      items: [],
      message: 'Không tìm thấy câu hỏi nào đã chốt (**Đã chốt:**) trong mục Open Questions của tài liệu này.',
    };
  }

  const acs = extractAcs(reqContent);
  const tcFile = findTestCaseFile(root, reqId);
  const existingTcIds = [];
  const existingTcTitles = [];

  if (tcFile.exists) {
    const tcContent = fs.readFileSync(tcFile.absPath, 'utf8');
    for (const match of tcContent.matchAll(RE_TC)) existingTcIds.push(match[0].toUpperCase());
    for (const line of tcContent.split(/\r?\n/)) {
      if (line.includes('TC-')) existingTcTitles.push(line.trim());
    }
  }

  const items = mode === 'ai'
    ? await inferWithAi({ reqId, reqContent, decidedQuestions, existingTcIds, existingTcTitles, acs, clientConfig, root })
    : inferWithHeuristic({ reqId, decidedQuestions, existingTcIds, existingTcTitles, acs });

  return {
    success: true,
    reqId,
    mode,
    tcPath: tcFile.relPath,
    tcExists: tcFile.exists,
    decidedQuestionsCount: decidedQuestions.length,
    count: items.length,
    items,
  };
}

async function extractScaffoldFromRaw(root, payload = {}) {
  const rawContent = String(payload.rawContent || '').trim();
  if (!rawContent) {
    throw Object.assign(new Error('Nội dung thô (Spec hoặc Test Script) không được để trống.'), { status: 400 });
  }

  const isTestScript = detectIsTestScript(rawContent);
  const inputType = isTestScript ? 'test_script' : 'spec_text';

  let nextReqId = 'REQ-001';
  let existingDomains = ['auth', 'job', 'account', 'general'];
  try {
    const { getScaffoldMeta } = require('./qaService');
    const meta = getScaffoldMeta(root);
    if (meta.nextReqId) nextReqId = meta.nextReqId;
    if (Array.isArray(meta.existingDomains) && meta.existingDomains.length) existingDomains = meta.existingDomains;
  } catch (_) {}

  const textReqMatch = rawContent.match(/\bREQ-(\d{3})\b/i);
  const reqId = (payload.reqId && /^REQ-\d{3}$/i.test(payload.reqId.trim()))
    ? payload.reqId.trim().toUpperCase()
    : (textReqMatch ? textReqMatch[0].toUpperCase() : nextReqId);

  const domain = (payload.domain && String(payload.domain).trim())
    ? String(payload.domain).trim().toLowerCase()
    : inferDomainFromText(rawContent, existingDomains);

  let aiResult = null;
  if (!isTestScript && payload.useAi !== false) {
    try {
      aiResult = await extractWithAi(root, rawContent, inputType, reqId, domain, payload);
    } catch (_) {}
  }

  const parsed = aiResult || (isTestScript
    ? extractHeuristicFromTestScript(rawContent, reqId, domain)
    : extractHeuristicFromSpecText(rawContent, reqId, domain));

  const synthesized = synthesizeScaffoldContents(root, {
    reqId,
    domain: parsed.domain || domain,
    title: parsed.title || `Tính năng ${reqId}`,
    slug: parsed.slug || slugify(parsed.title || `feature-${reqId}`),
    businessGoal: parsed.businessGoal || `Mục tiêu nghiệp vụ cho ${parsed.title || reqId}`,
    acs: parsed.acs && parsed.acs.length ? parsed.acs : [{ id: 'AC-001', title: 'Tiêu chí chính', given: 'Tiền điều kiện', when: 'Thao tác', then: 'Kết quả mong đợi' }],
    rules: parsed.rules || [],
    testCases: parsed.testCases && parsed.testCases.length ? parsed.testCases : [],
    rawScriptBody: isTestScript ? rawContent : null,
    specCode: parsed.specCode || null,
  });

  return {
    success: true,
    engine: aiResult ? 'ai' : 'heuristic',
    inputType,
    preview: {
      reqId: synthesized.reqId,
      title: synthesized.title,
      slug: synthesized.slug,
      domain: synthesized.domain,
      acCount: synthesized.acs.length,
      acs: synthesized.acs,
      tcCount: synthesized.testCases.length,
      testCases: synthesized.testCases,
      files: [synthesized.reqRelPath, synthesized.tcRelPath, synthesized.specRelPath],
    },
    generated: {
      reqRelPath: synthesized.reqRelPath,
      reqContent: synthesized.reqContent,
      tcRelPath: synthesized.tcRelPath,
      tcContent: synthesized.tcContent,
      specRelPath: synthesized.specRelPath,
      specContent: synthesized.specContent,
    },
  };
}

module.exports = {
  extractAcs,
  extractDecidedQuestions,
  findTestCaseFile,
  getNextTcId,
  inferWithHeuristic,
  inferWithAi,
  inferTestCases,
  appendTestCasesToDocument,
  slugify,
  detectIsTestScript,
  extractHeuristicFromTestScript,
  extractHeuristicFromSpecText,
  extractScaffoldFromRaw,
  synthesizeScaffoldContents,
};
