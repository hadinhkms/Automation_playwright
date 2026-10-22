const fs = require('fs');

class UiActions {
  constructor(page) {
    this.page = page;
  }

  resolveLocator(locatorOrSelector) {
    if (!locatorOrSelector) return null;
    if (typeof locatorOrSelector === 'string') return this.page.locator(locatorOrSelector);
    if (typeof locatorOrSelector === 'object') {
      if (typeof locatorOrSelector.waitFor === 'function') return locatorOrSelector;
      if (typeof locatorOrSelector.selector === 'string') return this.page.locator(locatorOrSelector.selector);
    }
    return locatorOrSelector;
  }

  async waitForVisible(locatorOrSelector, options = {}) {
    if (typeof locatorOrSelector === 'function') {
      throw new TypeError(
        'UiActions.waitForVisible requires a Playwright Locator or a selector string, not a locator method like .first or .last. Call .first() / .last() before passing it in.'
      );
    }
    const locator = this.resolveLocator(locatorOrSelector);
    if (!locator || typeof locator.waitFor !== 'function') {
      throw new TypeError('UiActions.waitForVisible requires a Playwright Locator or a selector string. Received: ' + String(locatorOrSelector));
    }
    const { timeout = 15000, state = 'visible' } = options;
    await locator.waitFor({ state, timeout });
    return locator;
  }

  async click(locatorOrSelector, options = {}) {
    const locator = await this.waitForVisible(locatorOrSelector, options);
    const clickOptions = {};
    if (options.force !== undefined) clickOptions.force = options.force;
    if (options.button) clickOptions.button = options.button;
    if (options.position) clickOptions.position = options.position;
    if (options.delay !== undefined) clickOptions.delay = options.delay;
    if (options.timeout !== undefined) clickOptions.timeout = options.timeout;
    await locator.click(clickOptions);
    return locator;
  }

  async fill(locatorOrSelector, value, options = {}) {
    const locator = await this.waitForVisible(locatorOrSelector, options);
    const fillOptions = {};
    if (options.force !== undefined) fillOptions.force = options.force;
    await locator.fill(value, fillOptions);
    return locator;
  }

  async fillAutocomplete(locatorOrSelector, value, options = {}) {
    const locator = await this.waitForVisible(locatorOrSelector, options);
    await locator.fill('');
    await locator.pressSequentially(String(value));
    return locator;
  }

  async check(locatorOrSelector, options = {}) {
    const locator = await this.waitForVisible(locatorOrSelector, options);
    await locator.check({ force: options.force });
    return locator;
  }

  async uncheck(locatorOrSelector, options = {}) {
    const locator = await this.waitForVisible(locatorOrSelector, options);
    await locator.uncheck({ force: options.force });
    return locator;
  }
}

module.exports = { UiActions };
