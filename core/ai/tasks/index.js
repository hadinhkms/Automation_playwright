/**
 * core/ai/tasks/index.js
 * Central entrypoint for all AI tasks (F9).
 * Strict ceiling <= 150 lines.
 */
const { runArbitrateConflict } = require('./arbitrateConflict');
const { runInferTestCases } = require('./inferTestCases');
const { runExtractScaffold } = require('./extractScaffold');
const { runAnalyzeRequirement } = require('./analyzeRequirement');
const { runInlineSuggest } = require('./inlineSuggest');

module.exports = {
  runArbitrateConflict,
  runInferTestCases,
  runExtractScaffold,
  runAnalyzeRequirement,
  runInlineSuggest
};
