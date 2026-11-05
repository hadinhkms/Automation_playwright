'use strict';

/**
 * Unit test cho cổng kiểm tra trần số dòng, vùng vàng 80%, độ dài dòng & file nháp.
 * Chạy: node --test scripts/check-code-limits.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runCodeLimitsCheck } = require('./lib/codeLimits');
const { determineFileRole, isForbiddenScratchFile } = require('./lib/codeLimitsPolicy');

function withTempWorkspace(files, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'code-limits-'));
  try {
    for (const [relPath, content] of Object.entries(files)) {
      const abs = path.join(root, relPath);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content, 'utf8');
    }
    return fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function makeLines(count, prefix = 'const step = 1;') {
  return Array.from({ length: count }, (_, idx) => `${prefix} // line ${idx + 1}`).join('\n') + '\n';
}

test('determineFileRole phân loại đúng role theo quality-policy.json', () => {
  assert.equal(determineFileRole('tests/e2e/desktop/login.spec.js'), 'test');
  assert.equal(determineFileRole('tests/api/orders.spec.js'), 'test');
  assert.equal(determineFileRole('tests/dashboard/support/batchHelper.js', 'module.exports = {};'), 'module');
  assert.equal(determineFileRole('pages/desktop/LoginPage.js'), 'module');
  assert.equal(determineFileRole('core/fixtures/baseTest.js'), 'module');
  assert.equal(determineFileRole('core/local/employer-api.js'), 'service');
  assert.equal(determineFileRole('core/local/string-utils.js'), 'utils');
  assert.equal(determineFileRole('core/local/helpers/date.js'), 'utils');
});

test('chặn Page Object vượt trần 250 dòng và cảnh báo/chặn vùng vàng >= 200 dòng', () => {
  withTempWorkspace(
    {
      'pages/desktop/OversizedPage.js': makeLines(251),
      'pages/desktop/YellowPage.js': makeLines(205),
      'pages/desktop/CleanPage.js': makeLines(140),
    },
    (root) => {
      const over = runCodeLimitsCheck({ root, targetArgs: ['pages/desktop/OversizedPage.js'] });
      assert.equal(over.passed, false);
      assert.equal(over.violations[0].kind, 'exceeds-line-limit');

      const yellow = runCodeLimitsCheck({ root, targetArgs: ['pages/desktop/YellowPage.js'] });
      assert.equal(yellow.passed, true);
      assert.equal(yellow.warnings.length, 1);
      assert.equal(yellow.warnings[0].kind, 'yellow-zone-warning');

      const yellowStrict = runCodeLimitsCheck({
        root,
        strict: true,
        targetArgs: ['pages/desktop/YellowPage.js'],
      });
      assert.equal(yellowStrict.passed, false);

      const addedLogicInYellow = runCodeLimitsCheck({
        root,
        targetArgs: ['pages/desktop/YellowPage.js'],
        diffByFile: {
          'pages/desktop/YellowPage.js': '+function submitCheckoutForm() {\n+  return true;\n+}\n',
        },
      });
      assert.equal(addedLogicInYellow.passed, false);
      assert.equal(addedLogicInYellow.violations[0].kind, 'yellow-zone-added-logic');

      const clean = runCodeLimitsCheck({ root, strict: true, targetArgs: ['pages/desktop/CleanPage.js'] });
      assert.equal(clean.passed, true);
    },
  );
});

test('chặn spec vượt 800 dòng, utils vượt 150 dòng, service vượt 200 dòng', () => {
  withTempWorkspace(
    {
      'tests/e2e/desktop/giant.spec.js': makeLines(805),
      'core/local/format-utils.js': makeLines(151),
      'core/local/payment-service.js': makeLines(201),
    },
    (root) => {
      const res = runCodeLimitsCheck({
        root,
        targetArgs: [
          'tests/e2e/desktop/giant.spec.js',
          'core/local/format-utils.js',
          'core/local/payment-service.js',
        ],
      });
      assert.equal(res.passed, false);
      assert.equal(res.violations.length, 3);
    },
  );
});

test('chặn dòng đơn > 500 ký tự và file nháp ngoài vùng cách ly scratch/', () => {
  assert.equal(isForbiddenScratchFile('tests/e2e/desktop/login.ai-test.spec.js'), true);
  assert.equal(isForbiddenScratchFile('pages/desktop/draft_LoginPage.js'), true);
  assert.equal(isForbiddenScratchFile('scratch/draft_probe.js'), false);
  assert.equal(isForbiddenScratchFile('tests/scratch/temp_selector.spec.js'), false);

  withTempWorkspace(
    {
      'pages/desktop/LongLinePage.js': `const s = '${'a'.repeat(505)}';\n`,
      'tests/e2e/desktop/probe.ai-test.spec.js': 'const x = 1;\n',
    },
    (root) => {
      const res = runCodeLimitsCheck({
        root,
        targetArgs: [
          'pages/desktop/LongLinePage.js',
          'tests/e2e/desktop/probe.ai-test.spec.js',
        ],
      });
      assert.equal(res.passed, false);
      const kinds = res.violations.map((v) => v.kind).sort();
      assert.deepEqual(kinds, ['forbidden-scratch-file', 'line-too-long']);
    },
  );
});

