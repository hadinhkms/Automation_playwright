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
  collectAllExistingTcIds,
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
      reqId,
      totalInferred: 0,
      mode,
      testCases: [],
      message: 'Không tìm thấy câu hỏi nào đã chốt (**Đã chốt:**) trong mục Open Questions của tài liệu này.',
    };
  }

  const acs = extractAcs(reqContent);
  const tcFile = findTestCaseFile(root, reqId);
  const existingTcIds = collectAllExistingTcIds(root);
  const existingTcTitles = [];

  if (tcFile.exists) {
    const tcContent = fs.readFileSync(tcFile.absPath, 'utf8');
    for (const match of tcContent.matchAll(RE_TC)) {
      const tid = match[0].toUpperCase();
      if (!existingTcIds.includes(tid)) existingTcIds.push(tid);
    }
    const lines = tcContent.split(/\r?\n/);
    for (const line of lines) {
      if (line.includes('TC-') || line.startsWith('###')) {
        existingTcTitles.push(line.trim());
      }
    }
  }

  const items = mode === 'ai'
    ? await inferWithAi({ decidedQuestions, acs, existingTcIds, clientConfig, root })
    : inferWithHeuristic({ reqId, decidedQuestions, existingTcIds, existingTcTitles, acs });

  return {
    reqId,
    mode,
    totalInferred: items.length,
    testCases: items,
  };
}

async function extractScaffoldFromRaw({ rawContent, root, clientConfig = null }) {
  if (!rawContent || !rawContent.trim()) {
    throw new Error('Nội dung thô không được để trống');
  }

  const isScript = detectIsTestScript(rawContent);
  const extracted = isScript
    ? extractHeuristicFromTestScript(rawContent)
    : (clientConfig && clientConfig.mode === 'ai'
      ? await extractWithAi({ rawText: rawContent, clientConfig, root })
      : extractHeuristicFromSpecText(rawContent));

  const synthesized = synthesizeScaffoldContents({
    root,
    extracted,
    isScript,
    rawContent,
    slugify,
    inferDomainFromText,
  });

  return {
    isScript,
    extracted,
    targetReqId: synthesized.targetReqId,
    domain: synthesized.domain,
    files: synthesized.files,
  };
}

module.exports = {
  RE_REQ,
  RE_AC,
  RE_TC,
  extractDecidedQuestions,
  extractAcs,
  getNextTcId,
  collectAllExistingTcIds,
  findTestCaseFile,
  slugify,
  inferDomainFromText,
  inferWithHeuristic,
  inferWithAi,
  inferTestCases,
  detectIsTestScript,
  parseTestBlocksFromScript,
  extractHeuristicFromTestScript,
  extractHeuristicFromSpecText,
  extractWithAi,
  extractScaffoldFromRaw,
  appendTestCasesToDocument,
};
