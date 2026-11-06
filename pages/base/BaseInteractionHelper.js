/**
 * Tương tác phần tử: viewport, chờ ổn định, click/fill an toàn, nhập mã nhiều ô.
 * Được BasePage sở hữu; dùng page/actions/screenshotHelper của owner (giữ nguyên API public của BasePage).
 */
class BaseInteractionHelper {
  /** @param {import('../BasePage').BasePage} owner */
  constructor(owner) {
    this.owner = owner;
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
    const isInViewport = await this.owner.isElementInViewport(locator).catch(() => false);
    if (!isInViewport) {
      // WebKit: form re-render làm node cũ bị detach giữa chừng; bỏ qua vì thao tác click/fill sau đó tự cuộn lại
      await locator.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => null);
    }
  }

  async waitForElementStable(locatorOrSelector, options = {}) {
    const {
      timeout = 10000,
      stableFrameCount = 8,
      maxElements = 120,
    } = options;

    const locator = await this.owner.actions.waitForVisible(locatorOrSelector, { timeout });

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
    // await this.owner._capture('click');
    const locator = await this.owner.actions.waitForVisible(locatorOrSelector, { timeout: 30000 });
    // Cuộn đến element nếu cần thiết, phương thức này đã tự kiểm tra
    await this.owner.scrollToElementIfOutsideViewport(locator);
    return this.owner.actions.click(locator, { timeout: 15000, ...options });
  }

  /**
   * Đợi một chút để UI render loading, sau đó chờ đến khi loading overlay thực sự biến mất
   * Hàm này giúp script chạy mượt hơn ở điều kiện mạng chậm, không bị lỗi race condition
   */
  async waitForGlobalLoadingHidden(timeout = 60000) {
    const loadingOverlay = this.owner.page.locator('.overlay-loading');

    await loadingOverlay.waitFor({ state: 'hidden', timeout });
  }

  async fillInput(locatorOrSelector, text, options = {}) {
    const sanitizedText = String(text).substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_');
    // await this.owner._capture('fill', sanitizedText);
    const locator = await this.owner.actions.waitForVisible(locatorOrSelector, { timeout: 30000 });
    // Cuộn đến element nếu cần thiết, phương thức này đã tự kiểm tra
    await this.owner.scrollToElementIfOutsideViewport(locator);
    return this.owner.actions.fill(locator, text, options);
  }

  async fillCodeInputs(inputLocator, code) {
    const codeText = String(code);
    await this.owner.waitForElement(inputLocator.first());

    const inputCount = await inputLocator.count();
    const fillCount = Math.min(inputCount, codeText.length);

    for (let i = 0; i < fillCount; i++) {
      await this.owner.fillInput(inputLocator.nth(i), codeText.charAt(i));
    }
  }
}

module.exports = { BaseInteractionHelper };
