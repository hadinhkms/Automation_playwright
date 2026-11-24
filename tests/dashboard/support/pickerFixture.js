/**
 * tests/dashboard/support/pickerFixture.js
 * Isolated workspace for Script Picker tests: desktop/mobile/api specs with tags, a Vietnamese-named file,
 * a name with spaces, an internal Dashboard spec, and a plain-object Playwright config with projects.
 */
const fs = require('fs');
const path = require('path');
const { createFixtureWorkspace } = require('./fixtureWorkspace');

const spec = (name, tags) => `const { test } = require('@playwright/test');\ntest('${name} ${tags}', async () => {});\n`;

const FILES = {
  'tests/e2e/desktop/alpha.spec.js': spec('alpha', '@e2e @smoke'),
  'tests/e2e/desktop/dang-nhap.spec.js': spec('dang nhap', '@e2e @auth'),
  'tests/e2e/desktop/with space.spec.js': spec('with space', '@e2e'),
  'tests/e2e/mobile/beta.spec.js': spec('beta', '@mobile @smoke'),
  'tests/api/gamma.spec.js': spec('gamma', '@api'),
  'tests/dashboard/internal.spec.js': spec('internal', '@smoke @dashboardonly'),
};

const CONFIG = `module.exports = { projects: [
  { name: 'Desktop Smoke Tests', testMatch: '**/e2e/desktop/**', grep: /@smoke/ },
  { name: 'Desktop Regression Tests', testMatch: '**/e2e/desktop/**', grep: /@e2e/, grepInvert: /@smoke/ },
  { name: 'Mobile Chrome Smoke Tests', testMatch: '**/e2e/mobile/**' },
  { name: 'Mobile Safari Smoke Tests', testMatch: '**/e2e/mobile/**' },
  { name: 'API Tests', testMatch: '**/api/**' },
] };\n`;

function createPickerFixture(extra = {}) {
  const fixture = createFixtureWorkspace();
  const write = (rel, body) => {
    const full = path.join(fixture.rootPath, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body, 'utf8');
  };
  write('dashboardConfig.json', JSON.stringify({ suites: extra.suites || {} }));
  write('playwright.config.js', CONFIG);
  Object.entries({ ...FILES, ...(extra.files || {}) }).forEach(([rel, body]) => write(rel, body));
  return fixture;
}

module.exports = { createPickerFixture, FILES };
