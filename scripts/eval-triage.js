/**
 * scripts/eval-triage.js
 * Evaluates Failure Triage accuracy on the synthetic dataset (Plan-17b F6 / P17B-TC-11).
 * Target: Accuracy >= 80%.
 * Strict ceiling <= 150 lines.
 */
const fs = require('fs');
const path = require('path');
const { analyzeDiagnostics } = require('../core/diagnostics/diagnosticsAnalyzer');

function runEvaluation() {
  const datasetPath = path.join(__dirname, '..', 'test-fixtures', 'ai-eval', 'triage-dataset.json');
  if (!fs.existsSync(datasetPath)) {
    throw new Error(`Dataset not found at ${datasetPath}`);
  }

  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  let matched = 0;
  const results = [];

  for (const item of dataset) {
    const diag = analyzeDiagnostics({
      error: item.error,
      testTitle: item.testTitle
    });

    const isMatch = diag.topCategory === item.expectedCategory;
    if (isMatch) matched++;

    results.push({
      id: item.id,
      expected: item.expectedCategory,
      predicted: diag.topCategory,
      confidence: diag.findings[0]?.confidence || 0,
      pass: isMatch
    });
  }

  const accuracy = (matched / dataset.length) * 100;
  const passed = accuracy >= 80;

  console.log(`\n==================================================`);
  console.log(`TRIAGE SYNTHETIC EVALUATION REPORT (Plan-17b F6)`);
  console.log(`Total samples: ${dataset.length}`);
  console.log(`Matches: ${matched}/${dataset.length}`);
  console.log(`Accuracy: ${accuracy.toFixed(1)}% (Threshold >= 80%)`);
  console.log(`Verdict: ${passed ? 'PASSED (Green Gate)' : 'FAILED'}`);
  console.log(`==================================================\n`);

  return { passed, accuracy, matched, total: dataset.length, results };
}

if (require.main === module) {
  try {
    const outcome = runEvaluation();
    process.exit(outcome.passed ? 0 : 1);
  } catch (err) {
    console.error('Eval error:', err);
    process.exit(1);
  }
}

module.exports = { runEvaluation };
