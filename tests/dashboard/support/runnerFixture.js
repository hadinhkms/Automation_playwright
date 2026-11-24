/**
 * tests/dashboard/support/runnerFixture.js
 * Seeds an isolated workspace for Runner view tests: two app specs with distinct tags plus an
 * internal Dashboard spec (tests/dashboard/) that carries a shared tag.
 */
const fs = require('fs');
const path = require('path');
const { createFixtureWorkspace } = require('./fixtureWorkspace');

const spec = (name, tags) => `const { test } = require('@playwright/test');\ntest('${name} ${tags}', async () => {});\n`;

function createRunnerFixture() {
  const fixture = createFixtureWorkspace();
  const write = (rel, body) => {
    const full = path.join(fixture.rootPath, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body, 'utf8');
  };
  // The server writes the config it resolves from the project root; give it its own so the tracked
  // core/config/dashboardConfig.json is never touched by PUT /api/settings in these tests.
  write('dashboardConfig.json', '{}\n');
  write('tests/e2e/desktop/alpha.spec.js', spec('alpha', '@e2e @smoke'));
  write('tests/e2e/mobile/beta.spec.js', spec('beta', '@mobile'));
  write('tests/dashboard/internal.spec.js', spec('internal', '@smoke @dashboardonly'));
  return fixture;
}

module.exports = { createRunnerFixture };
