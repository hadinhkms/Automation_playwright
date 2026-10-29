'use strict';

/**
 * tools/qa/lib/sources.js
 * Facade chuẩn hoá 3 nguồn dữ liệu QA (requirements, test-cases, automated Playwright specs).
 */

const { loadRequirements, parseFrontMatter } = require('./sourcesMarkdown');
const { loadTestCases } = require('./sourcesTestCases');
const { ASYNC_MATCHERS, findMissingAwaits } = require('./sourcesMissingAwait');
const { loadAutomatedTests } = require('./sourcesAutomated');

module.exports = {
  loadRequirements,
  loadTestCases,
  loadAutomatedTests,
  parseFrontMatter,
  findMissingAwaits,
  ASYNC_MATCHERS,
};
