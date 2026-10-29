'use strict';

/**
 * tools/qa/lib/sources.js
 * Facade chuẩn hoá 3 nguồn dữ liệu QA (requirements, test-cases, automated Playwright specs).
 */

const { loadRequirements, parseFrontMatter } = require('./sourcesMarkdown');
const { loadTestCases } = require('./sourcesTestCases');
const {
  ASYNC_MATCHERS,
  PLAYWRIGHT_SAFE_CALL_WHITELIST,
  VERIFIED_DEEP_HELPERS,
  extractVerifiedHelperImports,
} = require('./sourcesAssertionConstants');
const { extractTestCallbackBody } = require('./sourcesCallbackExtractor');
const { analyzeTestAssertions } = require('./sourcesAssertionAnalyzer');
const { findMissingAwaits } = require('./sourcesMissingAwait');
const { loadAutomatedTests } = require('./sourcesAutomated');

module.exports = {
  loadRequirements,
  loadTestCases,
  loadAutomatedTests,
  parseFrontMatter,
  findMissingAwaits,
  extractTestCallbackBody,
  extractVerifiedHelperImports,
  analyzeTestAssertions,
  ASYNC_MATCHERS,
  PLAYWRIGHT_SAFE_CALL_WHITELIST,
  VERIFIED_DEEP_HELPERS,
};
