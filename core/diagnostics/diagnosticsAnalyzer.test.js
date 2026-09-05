const test = require('node:test');
const assert = require('node:assert/strict');
const { analyzeDiagnostics } = require('./diagnosticsAnalyzer');

test('Diagnostics classifies locator, overlay, and assertion failures deterministically', () => {
  const input = { stepTitle: 'Người dùng bấm nút', error: 'Timeout waiting for locator button.submit: element is covered by overlay' };
  const first = analyzeDiagnostics(input);
  const second = analyzeDiagnostics(input);
  assert.deepEqual(first, second);
  assert.deepEqual(first.findings.map((finding) => finding.code), ['locator-not-found', 'covered-by-overlay']);
  assert.equal(first.deterministic, true);
  assert.equal(first.findings[0].suggestedFix.requiresConfirmation, true);
});

test('Diagnostics masks sensitive values and reports unknown evidence gaps', () => {
  const result = analyzeDiagnostics({ error: 'password=secret123 token=abc123', trace: 'trace.zip' });
  assert.equal(result.findings[0].code, 'unknown');
  assert.doesNotMatch(JSON.stringify(result), /secret123|abc123/);
  assert.equal(result.masked, true);
});
