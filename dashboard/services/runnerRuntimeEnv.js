/**
 * dashboard/services/runnerRuntimeEnv.js
 * Biến môi trường truyền cho tiến trình test con (tách từ runnerService.js).
 */
const { getDashboardConfig } = require('../../core/config/dashboardConfig');

function runtimeEnv(options) {
  const settings = getDashboardConfig();
  const runtime = settings.runtime;
  const api = settings.api;
  const retries = process.env.CI ? runtime.retriesCI : runtime.retriesLocal;
  const selectedSpec = String(options.spec || (Array.isArray(options.specs) && options.specs.length > 0 ? options.specs[0] : '') || '');
  const selectedProject = String(options.project || '');
  const platform = selectedSpec.startsWith('tests/e2e/mobile-web/') || selectedSpec.startsWith('tests/e2e/mobile/') || selectedSpec.includes('.mobile.') || /^Mobile (?:Chrome|Safari)/i.test(selectedProject)
    ? 'mobile-web' : selectedSpec.startsWith('tests/e2e/mobile-app/') ? 'mobile-app' : 'desktop';

  const vpWidth = options.viewport?.width || runtime.viewport.width;
  const vpHeight = options.viewport?.height || runtime.viewport.height;

  return {
    NODE_ENV: options.environment,
    QA_PLATFORM: platform,
    PW_WORKERS: String(options.workers),
    PW_RETRIES: String(retries),
    PW_TEST_TIMEOUT: String(runtime.testTimeout),
    PW_NAVIGATION_TIMEOUT: String(runtime.navigationTimeout),
    PW_ACTION_TIMEOUT: String(runtime.actionTimeout),
    PW_TRACE: runtime.trace,
    PW_SCREENSHOT: runtime.screenshot,
    PW_VIDEO: runtime.video,
    PW_VIEWPORT_WIDTH: String(vpWidth),
    PW_VIEWPORT_HEIGHT: String(vpHeight),
    SHOW_ENV_BANNER: runtime.showEnvBanner ? '1' : '0',
    DEBUG_OPTIONAL_POPUPS: runtime.debugOptionalPopups ? '1' : '0',
    REGISTRATION_BEARER_TOKEN: api.registrationBearerToken || '',
    REGISTRATION_BRANCH: api.branch,
    REGISTRATION_LANG: api.lang,
  };
}

module.exports = { runtimeEnv };
