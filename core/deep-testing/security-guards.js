'use strict';

const { expect } = require('@playwright/test');

const XSS_PAYLOADS = [
  '<img src=x onerror="window.__xss_triggered=true">',
  '"><script>window.__xss_triggered=true</script>',
  '<svg onload="window.__xss_triggered=true">',
  'javascript:window.__xss_triggered=true',
];

const SQLI_EDGE_PAYLOADS = ["' OR '1'='1' --", "admin'--", '1; DROP TABLE users --'];
const UNICODE_OVERFLOW_PAYLOADS = ['\u0000\u200B\uFEFF', '👨‍👩‍👧‍👦'.repeat(20), 'A'.repeat(1024)];
const DEFAULT_MUTATION_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

function matchesUrlPattern(req, pattern) {
  if (!pattern) return true;
  if (typeof pattern === 'function') return pattern(req);
  const url = req.url();
  return typeof pattern === 'string' ? url.includes(pattern.replace(/^\*\*\/?/, '')) : pattern.test(url);
}

async function expectSafeXssRender(page, inputAction, options) {
  const payloads = options.payloads ?? XSS_PAYLOADS;
  const expectReflected = options.expectReflectedText !== false;
  expect(payloads.length, '[expectSafeXssRender] Payloads list cannot be empty').toBeGreaterThan(0);

  let dialogTriggered = '';
  const onDialog = (dialog) => {
    dialogTriggered = `${dialog.type()}: ${dialog.message()}`;
    void dialog.dismiss().catch(() => {});
  };

  page.on('dialog', onDialog);
  try {
    for (const payload of payloads) {
      dialogTriggered = '';
      await page.evaluate(() => {
        window.__xss_triggered = false;
      });
      await inputAction(payload);
      await expect(options.sinkLocator, '[expectSafeXssRender] Sink locator must be attached').toBeAttached();

      const audit = await options.sinkLocator.evaluate((sink) => {
        const selector =
          'script, iframe, object, embed, svg[onload], [onerror], [onload], [onclick], [onmouseover], a[href^="javascript:" i]';
        return {
          xssTriggered: window.__xss_triggered === true,
          dangerousNodes: Array.from(sink.querySelectorAll(selector)).map((el) => el.tagName.toLowerCase()),
          textContent: (sink.textContent || '').trim(),
        };
      });

      expect(dialogTriggered, `[expectSafeXssRender] Unexpected dialog for "${payload}"`).toBe('');
      expect(audit.xssTriggered, `[expectSafeXssRender] __xss_triggered sentinel fired for "${payload}"`).toBe(false);
      expect(audit.dangerousNodes, '[expectSafeXssRender] Dangerous DOM elements injected').toEqual([]);
      await expect(options.sinkLocator, '[expectSafeXssRender] Sink locator must be visible').toBeVisible();
      if (expectReflected) {
        expect(audit.textContent, `[expectSafeXssRender] Sink must safely reflect "${payload}"`).toContain(payload);
      }
    }
  } finally {
    page.off('dialog', onDialog);
  }
}

async function expectBoundaryRejected(page, trigger, errorLocator, options = {}) {
  const forbidMutation = options.forbidMutationRequest !== false && !options.allowServerValidation;
  const mutationRequests = [];
  const responsePromises = [];

  const onRequest = (req) => {
    if (
      DEFAULT_MUTATION_METHODS.includes(req.method().toUpperCase()) &&
      matchesUrlPattern(req, options.mutationUrlPattern)
    ) {
      mutationRequests.push(req);
      responsePromises.push(req.response().catch(() => null));
    }
  };

  page.on('request', onRequest);
  try {
    await trigger();
    await new Promise((resolve) => setTimeout(resolve, 60));
  } finally {
    page.off('request', onRequest);
  }

  await expect(errorLocator, '[expectBoundaryRejected] Error locator must be visible').toBeVisible();
  if (options.expectedPattern !== undefined) await expect(errorLocator).toContainText(options.expectedPattern);

  if (forbidMutation) {
    expect(mutationRequests, '[expectBoundaryRejected] Expected 0 mutation requests').toHaveLength(0);
  } else if (options.allowServerValidation && responsePromises.length > 0) {
    const responses = (await Promise.all(responsePromises)).filter((r) => r !== null);
    for (const res of responses) {
      expect(res.status()).toBeGreaterThanOrEqual(400);
      expect(res.status()).toBeLessThan(500);
    }
  }
}

module.exports = {
  XSS_PAYLOADS,
  SQLI_EDGE_PAYLOADS,
  UNICODE_OVERFLOW_PAYLOADS,
  DEFAULT_MUTATION_METHODS,
  matchesUrlPattern,
  expectSafeXssRender,
  expectBoundaryRejected,
};

