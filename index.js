const BasePage = require('./pages/BasePage');
const { UiActions, ScreenshotHelper } = require('./core/utils/commonUtils');
const dashboardConfig = require('./core/config/dashboardConfig');
const { defineQaConfig } = require('./core/config/defineConfig');
const updater = require('./core/system/updater');
const { test: baseTest } = require('./core/fixtures/baseTest');
const { test: mobileWebTest } = require('./core/fixtures/mobileWebTest');

module.exports = {
  BasePage,
  UiActions,
  ScreenshotHelper,
  dashboardConfig,
  defineQaConfig,
  updater,
  baseTest,
  mobileWebTest,
};
