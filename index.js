const BasePage = require('./pages/BasePage');
const { UiActions, ScreenshotHelper } = require('./core/utils/commonUtils');
const dashboardConfig = require('./core/config/dashboardConfig');
const updater = require('./core/system/updater');

module.exports = {
  BasePage,
  UiActions,
  ScreenshotHelper,
  dashboardConfig,
  updater,
};
