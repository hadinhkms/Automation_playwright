'use strict';

const { expect } = require('@playwright/test');
const { expectNetworkFaultRecovery, expectMultiTabConcurrency } = require('./resilience-guards');
const {
  XSS_PAYLOADS,
  SQLI_EDGE_PAYLOADS,
  UNICODE_OVERFLOW_PAYLOADS,
  DEFAULT_MUTATION_METHODS,
  matchesUrlPattern,
  expectSafeXssRender,
  expectBoundaryRejected,
} = require('./security-guards');

async function isButtonDisabledOrBusy(locator) {
  return locator
    .evaluate((el) => Boolean(
      el.disabled === true ||
        el.getAttribute('aria-disabled') === 'true' ||
        el.getAttribute('aria-busy') === 'true' ||
        el.getAttribute('data-loading') === 'true' ||
        el.classList.contains('loading') ||
        el.classList.contains('is-loading'),
    ))
    .catch(() => false);
}

async function expectIdempotentSubmit(page, trigger, urlPattern, options = {}) {
  const methods = (options.methods ?? DEFAULT_MUTATION_METHODS).map((m) => m.toUpperCase());
  const requireLock = options.requireDisabledOrLoading !== false;
  const settleMs = options.settleMs ?? 200;
  const btnLocator = options.buttonLocator ?? (typeof trigger !== 'function' ? trigger : undefined);
  const matchedRequests = [];
  const responsePromises = [];
  let sawDisabledOrBusy = false;

  const sampleButtonLock = async () => {
    if (btnLocator && !sawDisabledOrBusy && (await isButtonDisabledOrBusy(btnLocator))) {
      sawDisabledOrBusy = true;
    }
  };

  const onRequest = (req) => {
    if (methods.includes(req.method().toUpperCase()) && matchesUrlPattern(req, urlPattern)) {
      matchedRequests.push(req);
      responsePromises.push(req.response().catch(() => null));
      void sampleButtonLock();
    }
  };

  page.on('request', onRequest);
  try {
    if (typeof trigger === 'function') {
      await trigger();
    } else {
      await trigger.click();
      await sampleButtonLock();
      await trigger.click({ force: true, timeout: 500 }).catch(() => {});
    }
    await sampleButtonLock();
    await new Promise((resolve) => setTimeout(resolve, settleMs));
    await sampleButtonLock();
  } finally {
    page.off('request', onRequest);
  }

  expect(
    matchedRequests.length,
    `[expectIdempotentSubmit] Expected exactly 1 mutation request, got ${matchedRequests.length}`,
  ).toBe(1);

  if (requireLock && btnLocator) {
    expect(
      sawDisabledOrBusy,
      '[expectIdempotentSubmit] Expected submit button to be disabled or aria-busy during submission',
    ).toBe(true);
  }

  const responses = (await Promise.all(responsePromises)).filter((r) => r !== null);
  expect(responses.length, '[expectIdempotentSubmit] Expected mutation HTTP response').toBeGreaterThanOrEqual(1);
  for (const res of responses) {
    expect(res.status(), '[expectIdempotentSubmit] Unexpected HTTP 409 Conflict').not.toBe(409);
    expect(res.status(), `[expectIdempotentSubmit] Unexpected HTTP 5xx (${res.status()})`).toBeLessThan(500);
  }

  if (options.postSubmitAssert) await options.postSubmitAssert(responses[0]);
  return responses[0];
}

async function expectStatePersistence(page, assertFn, options = {}) {
  await assertFn();
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (options.expectStorageKeys?.length) {
    for (const item of options.expectStorageKeys) {
      const val = await page.evaluate(
        ({ storage, key }) =>
          storage === 'local' ? window.localStorage.getItem(key) : window.sessionStorage.getItem(key),
        item,
      );
      expect(val, `[expectStatePersistence] Storage key "${item.key}" missing after reload`).not.toBeNull();
    }
  }
  await assertFn();
}

async function expectPerformanceBudget(page, action, budget) {
  const start = performance.now();
  await action();
  const elapsedMs = Math.round(performance.now() - start);
  expect(elapsedMs, `[expectPerformanceBudget] ${elapsedMs}ms > ${budget.maxActionMs}ms`).toBeLessThanOrEqual(
    budget.maxActionMs,
  );
  if (budget.maxDomInteractiveMs !== undefined || budget.maxTransferSizeBytes !== undefined) {
    const m = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const res = performance.getEntriesByType('resource');
      return {
        domInteractiveMs: nav ? Math.round(nav.domInteractive) : 0,
        transferSizeBytes: (nav?.transferSize ?? 0) + res.reduce((s, r) => s + (r.transferSize || 0), 0),
      };
    });
    if (budget.maxDomInteractiveMs !== undefined) expect(m.domInteractiveMs).toBeLessThanOrEqual(budget.maxDomInteractiveMs);
    if (budget.maxTransferSizeBytes !== undefined) expect(m.transferSizeBytes).toBeLessThanOrEqual(budget.maxTransferSizeBytes);
  }
  return { elapsedMs };
}

module.exports = {
  XSS_PAYLOADS,
  SQLI_EDGE_PAYLOADS,
  UNICODE_OVERFLOW_PAYLOADS,
  expectIdempotentSubmit,
  expectSafeXssRender,
  expectStatePersistence,
  expectBoundaryRejected,
  expectPerformanceBudget,
  expectNetworkFaultRecovery,
  expectMultiTabConcurrency,
};

