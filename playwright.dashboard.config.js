// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Isolated Playwright configuration dedicated exclusively to Dashboard Studio testing.
 * Separate from business E2E suites to avoid configuration and grep collision.
 */
module.exports = defineConfig({
  testDir: './tests/dashboard',
  testMatch: '**/*.spec.js',
  timeout: 30000,
  retries: 0,
  workers: 1,
  outputDir: './tests/dashboard/test-results',
  use: {
    headless: true,
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
    trace: 'off'
  },
  projects: [
    {
      name: 'Dashboard Chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
