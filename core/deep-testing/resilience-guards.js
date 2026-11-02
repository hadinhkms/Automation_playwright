'use strict';

const { expect } = require('@playwright/test');

async function expectNetworkFaultRecovery(page, trigger, options) {
  const mode = options.faultMode ?? 'http-500';
  if (options.allowRuntimeTrap && typeof options.allowRuntimeTrap.allow === 'function') {
    options.allowRuntimeTrap.allow({
      source: mode === 'network-abort' ? 'requestfailed' : 'http-5xx',
      pattern: options.urlPattern,
      reason: `Fault injection via expectNetworkFaultRecovery (${mode})`,
    });
  }

  let faultInjected = false;
  const handler = async (route) => {
    if (!faultInjected) {
      faultInjected = true;
      if (mode === 'network-abort') {
        await route.abort('failed');
      } else {
        const status = mode === 'http-503' ? 503 : 500;
        await route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'FAULT_INJECTED', message: `Simulated ${status} fault` }),
        });
      }
      return;
    }
    await route.fallback();
  };

  await page.route(options.urlPattern, handler);
  try {
    await trigger();
    expect(faultInjected, '[expectNetworkFaultRecovery] Fault route was never triggered').toBe(true);
    await expect(options.errorLocator, '[expectNetworkFaultRecovery] Error banner must be visible').toBeVisible();
    if (options.expectedErrorPattern !== undefined) {
      await expect(options.errorLocator).toContainText(options.expectedErrorPattern);
    }

    if (options.submitButton) {
      await expect
        .poll(
          async () =>
            options.submitButton.evaluate((el) => Boolean(
              el.disabled === true ||
                el.getAttribute('aria-disabled') === 'true' ||
                el.getAttribute('aria-busy') === 'true' ||
                el.getAttribute('data-loading') === 'true',
            )),
          { message: '[expectNetworkFaultRecovery] Submit button remained stuck in loading/disabled state after failure' },
        )
        .toBe(false);
    }

    if (options.preservedInputs?.length) {
      for (const item of options.preservedInputs) {
        await expect(
          item.locator,
          `[expectNetworkFaultRecovery] Form input value "${item.expectedValue}" was lost after fault`,
        ).toHaveValue(item.expectedValue);
      }
    }

    if (options.clearedInputs?.length) {
      for (const loc of options.clearedInputs) {
        await expect(loc, '[expectNetworkFaultRecovery] Sensitive input must be cleared after fault').toHaveValue('');
      }
    }
  } finally {
    await page.unroute(options.urlPattern, handler).catch(() => {});
  }
}

async function expectMultiTabConcurrency(page, scenario) {
  const tabB = await page.context().newPage();
  try {
    await scenario.setupBothTabs(page, tabB);
    await scenario.tabAAction(page);
    await scenario.tabBConflictingAction(tabB);
    await scenario.verifyConflictOrIsolation(page, tabB);
  } finally {
    if (!tabB.isClosed()) {
      await tabB.close().catch(() => {});
    }
  }
}

module.exports = {
  expectNetworkFaultRecovery,
  expectMultiTabConcurrency,
};
