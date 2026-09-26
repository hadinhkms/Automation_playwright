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
const { runTriageFailure } = require('./triageFailure');
const { parseJiraMarkupToMarkdown, extractJiraKey } = require('./jiraStoryParser');
const { runCheckRequirementClarity } = require('./checkRequirementClarity');
const { runDraftBugReport } = require('./draftBugReport');
const { runGenerateTestCases } = require('./generateTestCases');
const { runSuggestLocator } = require('./suggestLocator');
const { runReviewSpec, staticSpecReview } = require('./reviewSpec');
const { runAnalyzeTestImpact } = require('./analyzeTestImpact');
const { runGenerateReleaseBriefing } = require('./generateReleaseBriefing');
const { runAnalyzeRequirementChange } = require('./analyzeRequirementChange');
const { runGeneratePlaywrightSpec, validateScriptSyntax } = require('./generatePlaywrightSpec');
const { runDraftDecisionRecord } = require('./draftDecisionRecord');
const { formatForJira } = require('./copyForJira');
const { runDetectFlakyTests } = require('./detectFlakyTests');
const { runSummarizeCiRun } = require('./summarizeCiRun');

module.exports = {
  runArbitrateConflict,
  runInferTestCases,
  runExtractScaffold,
  runAnalyzeRequirement,
  runInlineSuggest,
  runTriageFailure,
  parseJiraMarkupToMarkdown,
  extractJiraKey,
  runCheckRequirementClarity,
  runDraftBugReport,
  runGenerateTestCases,
  runSuggestLocator,
  runReviewSpec,
  staticSpecReview,
  runAnalyzeTestImpact,
  runGenerateReleaseBriefing,
  runAnalyzeRequirementChange,
  runGeneratePlaywrightSpec,
  validateScriptSyntax,
  runDraftDecisionRecord,
  formatForJira,
  runDetectFlakyTests,
  runSummarizeCiRun
};
