const { UiActions, ScreenshotHelper } = require('../core/utils/commonUtils');
const { expect } = require('@playwright/test');

class BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page, featureName) {
    this.page = page;
    this.actions = new UiActions(page);
    const resolvedFeatureName = featureName || this.constructor.name.toLowerCase();
    this.screenshotHelper = new ScreenshotHelper(page, resolvedFeatureName);
  }

  async navigate(url, options = {}) {
    // Prefer 'load' to ensure full page resources, but allow overriding via options
    const gotoOptions = Object.assign({ waitUntil: 'load', timeout: 120000 }, options);
    try {
      await this.page.goto(url, gotoOptions);
    } catch (err) {
      // try to capture a screenshot for diagnosis, but don't fail the error handling if capture itself errors
      try {
        const safeName = String(url).replace(/[:\/\?&=.#]/g, '_');
        await this._capture('navigate_error', safeName);
      } catch (captureErr) {
        // ignore capture errors
      }

      // Retry once with a less strict waitUntil and longer timeout — helps when 'load' hangs on third-party resources
      try {
        await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 });
      } catch (err2) {
        // Log and rethrow the original (or second) error so caller sees failure
        console.error(`Navigation to ${url} failed after retry:`, err2);
        throw err2;
      }
    }
  }

  /**
   * Chờ một element hiển thị ổn định trên trang.
   * @param {import('@playwright/test').Locator} locator - Locator của element cần chờ.
   */
  async waitForElement(locator) {
    return locator.waitFor({ state: 'visible', timeout: 15000 });
  }
  /**
   * Phát hiện xem hiện tại trên màn hình có Modal / Popup / Dialog / Drawer đang mở không.
   * @returns {Promise<boolean>}
   */
  async isModalOrPopupVisible() {
    if (this.screenshotHelper && typeof this.screenshotHelper.isModalOrPopupVisible === 'function') {
      return this.screenshotHelper.isModalOrPopupVisible();
    }
    return false;
  }

  async _capture(actionName, details = '', fullPage = null, options = {}) {
    if (this.screenshotHelper) {
      const fileName = `${actionName}${details ? `-${details}` : ''}`;
      await this.screenshotHelper.takeScreenshot(fileName, fullPage, options);
    }
  }

  async capture(stepName, fullPage = null, options = {}) {
    // Chờ mạng cơ bản ổn định (không bắt buộc, catch lỗi timeout để không gián đoạn)
    await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);

    // Chờ các Skeleton loaders (nếu có) biến mất khỏi DOM
    await this.page.waitForFunction(
      () => !document.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"], [class*="loading-block"]'),
      null,
      { timeout: 15000 }
    ).catch(() => null);
    
    // Chờ giao diện (body) hết các hiệu ứng chuyển động/animation (ví dụ như Skeleton loader dùng animation)
    await this.waitForElementStable(this.page.locator('body'), { timeout: 5000 }).catch(() => null);

    return this._capture(stepName, '', fullPage, options);
  }

  async isElementInViewport(locator) {
    return locator.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < viewportHeight &&
        rect.left < viewportWidth
      );
    });
  }

  async scrollToElementIfOutsideViewport(locator) {
    const isInViewport = await this.isElementInViewport(locator);
    if (!isInViewport) {
      await locator.scrollIntoViewIfNeeded();
    }
  }

  async waitForElementStable(locatorOrSelector, options = {}) {
    const {
      timeout = 10000,
      stableFrameCount = 8,
      maxElements = 120,
    } = options;

    const locator = await this.actions.waitForVisible(locatorOrSelector, { timeout });

    await locator.evaluate(
      async (element, { timeout, stableFrameCount, maxElements }) => {
        const startedAt = performance.now();
        let previousSignature = '';
        let stableFrames = 0;

        const isVisible = (target) => {
          const rect = target.getBoundingClientRect();
          const style = window.getComputedStyle(target);
          return (
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            Number(style.opacity) !== 0 &&
            rect.width > 1 &&
            rect.height > 1 &&
            rect.bottom >= 0 &&
            rect.right >= 0 &&
            rect.top <= window.innerHeight &&
            rect.left <= window.innerWidth
          );
        };

        const hasRunningAnimations = () => {
          if (typeof element.getAnimations !== 'function') return false;
          return element
            .getAnimations({ subtree: true })
            .some((animation) => animation.playState === 'running' || animation.pending);
        };

        const getSignature = () => {
          const targets = [element, ...Array.from(element.querySelectorAll('*')).slice(0, maxElements)];
          const parts = [];

          for (const target of targets) {
            if (!isVisible(target)) continue;

            const rect = target.getBoundingClientRect();
            const style = window.getComputedStyle(target);
            parts.push(
              Math.round(rect.left * 2) / 2,
              Math.round(rect.top * 2) / 2,
              Math.round(rect.width * 2) / 2,
              Math.round(rect.height * 2) / 2,
              style.transform,
              style.opacity
            );
          }

          return parts.join('|');
        };

        while (performance.now() - startedAt < timeout) {
          await new Promise((resolve) => requestAnimationFrame(resolve));

          const signature = getSignature();
          if (signature === previousSignature && !hasRunningAnimations()) {
            stableFrames += 1;
            if (stableFrames >= stableFrameCount) return;
          } else {
            stableFrames = 0;
            previousSignature = signature;
          }
        }

        throw new Error('Element did not become visually stable before timeout.');
      },
      { timeout, stableFrameCount, maxElements }
    );

    return locator;
  }

  async clickElement(locatorOrSelector, options = {}) {
    // await this._capture('click');
    const locator = await this.actions.waitForVisible(locatorOrSelector, { timeout: 30000 });
    // Cuộn đến element nếu cần thiết, phương thức này đã tự kiểm tra
    await this.scrollToElementIfOutsideViewport(locator);
    return this.actions.click(locator, { timeout: 15000, ...options });
  }

  /**
   * Đợi một chút để UI render loading, sau đó chờ đến khi loading overlay thực sự biến mất
   * Hàm này giúp script chạy mượt hơn ở điều kiện mạng chậm, không bị lỗi race condition
   */
  async waitForGlobalLoadingHidden(timeout = 60000) {
    const loadingOverlay = this.page.locator('.overlay-loading');

    await loadingOverlay.waitFor({ state: 'hidden', timeout });
  }

  async fillInput(locatorOrSelector, text, options = {}) {
    const sanitizedText = String(text).substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_');
    // await this._capture('fill', sanitizedText);
    const locator = await this.actions.waitForVisible(locatorOrSelector, { timeout: 30000 });
    // Cuộn đến element nếu cần thiết, phương thức này đã tự kiểm tra
    await this.scrollToElementIfOutsideViewport(locator);
    return this.actions.fill(locator, text, options);
  }

  async fillCodeInputs(inputLocator, code) {
    const codeText = String(code);
    await this.waitForElement(inputLocator.first());

    const inputCount = await inputLocator.count();
    const fillCount = Math.min(inputCount, codeText.length);

    for (let i = 0; i < fillCount; i++) {
      await this.fillInput(inputLocator.nth(i), codeText.charAt(i));
    }
  }

  /**
   * Chụp ảnh màn hình tương thích linh hoạt: toàn trang khi không có modal, viewport khi có modal
   */
  async captureAdaptive(stepName, options = {}) {
    const hasModal = await this.hasVisibleModal();
    return this._capture(stepName, '', !hasModal, options);
  }

  /**
   * Phát hiện xem hiện tại có modal/dialog/popup/drawer nào đang hiển thị không
   */
  async hasVisibleModal() {
    try {
      return await this.page.evaluate(() => {
        const modalSelectors = [
          '[role="dialog"]',
          '[aria-modal="true"]',
          '.MuiModal-root',
          '.MuiDialog-root',
          '.MuiDialog-container',
          '.MuiDialog-paper',
          '.MuiBackdrop-root',
          '.modal.show',
          '.modal-dialog',
          '.popup',
          '.dialog',
        ];
        return modalSelectors.some((selector) => {
          const el = document.querySelector(selector);
          if (!el) return false;
          const style = window.getComputedStyle(el);
          return style && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        });
      });
    } catch {
      return false;
    }
  }

  /**
   * Tải tệp lên thông qua fileChooser
   */
  async uploadFile(locator, filePath) {
    const fileChooserPromise = this.page.waitForEvent('filechooser');
    await this.clickElement(locator);
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePath);
  }

  /**
   * Phương thức chung xử lý luồng Import Excel chuẩn của hệ thống:
   * Nhấn nút Import -> Mở popup -> Chọn file -> Xác nhận
   */
  async importExcelData(importButtonLocator, filePath, importName = 'excel') {
    const safeImportName = String(importName)
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'excel';

    // 1. Nhấn nút Nhập Excel ở ngoài màn hình
    await this.clickElement(importButtonLocator);
    await this.captureAdaptive(`${safeImportName}-after-click-import-excel`);

    // 2. Chờ popup tải file hiển thị và chọn file
    const uploadInput = this.page.locator('input[type="file"]');
    await uploadInput.setInputFiles(filePath);
    await this.captureAdaptive(`${safeImportName}-after-file-selected`);

    // 3. Nhấn nút Tải lên / Xác nhận trong popup
    const confirmBtn = this.page.getByRole('button', { name: /Tải lên|Xác nhận|Nhập dữ liệu|Lưu/i }).first();
    await this.clickElement(confirmBtn);
    await this.captureAdaptive(`${safeImportName}-after-submit`);
  }
}

BasePage.BasePage = BasePage;
module.exports = BasePage;

