const fs = require('fs');
const { randomBytes } = require('crypto');
const { getFormattedDate, resolveEvidenceDir } = require('./evidencePath');
const { waitForPageStable, waitForVisualLoadingHidden, scrollPageForStabilization } = require('./pageStability');
const { isModalOrPopupVisible } = require('./modalDetector');

let globalScreenshotSequence = 0;
let globalRunDateInfo = getFormattedDate(new Date());
let currentTestFile = '';
const fallbackRunId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomBytes(3).toString('hex')}`;

class ScreenshotHelper {
  constructor(page, featureName) {
    this.page = page;
    this.featureName = featureName;
    try {
      const { test } = require('@playwright/test');
      const info = test.info();
      if (info?.file && info.file !== currentTestFile) {
        currentTestFile = info.file;
        globalScreenshotSequence = 0;
        globalRunDateInfo = getFormattedDate(new Date());
      }
    } catch (e) {}
    this.runDateInfo = globalRunDateInfo;
    this.screenshotCount = 0;
  }

  getEvidenceDir() {
    return resolveEvidenceDir(this.featureName, this.runDateInfo, fallbackRunId);
  }

  async waitForPageStable(options = {}) { return waitForPageStable(this.page, options); }
  async waitForVisualLoadingHidden(options = {}) { return waitForVisualLoadingHidden(this.page, options); }
  async isModalOrPopupVisible() { return isModalOrPopupVisible(this.page); }

  async takeScreenshot(stepName, fullPage = null, options = {}) {
    const captureSequence = ++globalScreenshotSequence;
    this.screenshotCount = captureSequence;
    const hasModal = await this.isModalOrPopupVisible();
    const shouldCaptureFullPage = hasModal ? Boolean(options.forceFullPage) : (fullPage !== false);

    const {
      waitForNetworkIdle = false, scrollDuringStabilization = shouldCaptureFullPage,
      waitForAnimations = true, stabilizationMs = 0, waitForLoadState = true,
      loadState = 'domcontentloaded', waitForDomContentLoaded = true,
      maxStabilizationMs = 5000, stableFrameCount = 5,
      waitForVisualLoading = true, visualLoadingTimeout = 15000,
    } = options;

    if (waitForDomContentLoaded) { try { await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 }); } catch (e) {} }
    if (waitForLoadState) { try { await this.page.waitForLoadState(loadState, { timeout: 10000 }); } catch (e) {} }
    if (waitForNetworkIdle) { try { await this.page.waitForLoadState('networkidle', { timeout: 10000 }); } catch (e) {} }
    if (waitForVisualLoading) await this.waitForVisualLoadingHidden({ timeout: visualLoadingTimeout });

    if (waitForAnimations) {
      await this.waitForPageStable({ maxWaitMs: maxStabilizationMs, stableFrameCount });
      if (stabilizationMs > 0) {
        await this.page.evaluate((ms) => new Promise((res) => window.setTimeout(res, ms)), stabilizationMs);
        await this.waitForPageStable({ maxWaitMs: maxStabilizationMs, stableFrameCount });
      }
    }

    if (scrollDuringStabilization) await scrollPageForStabilization(this.page);

    const dir = this.getEvidenceDir();
    const safeStepName = (stepName || 'step').replace(/[^a-zA-Z0-9-_]+/g, '-').toLowerCase();
    const targetPath = `${dir}/step${String(captureSequence).padStart(3, '0')}_${safeStepName}.png`;
    fs.mkdirSync(dir, { recursive: true });
    try {
      await this.page.screenshot({ path: targetPath, fullPage: shouldCaptureFullPage, animations: 'disabled' });
    } catch (e) {}
  }

  async takeFullPageScreenshot(stepName) { await this.takeScreenshot(stepName, true); }
}

module.exports = { ScreenshotHelper, getFormattedDate };
