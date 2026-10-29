'use strict';

const {
  redactSensitiveText,
  redactHeaders,
  matchesAllowRule,
  isBenignAbortedSubresource,
} = require('./runtime-redaction');

function createRuntimeTrap(page) {
  const records = [];
  const allowRules = [];
  const allowedRecords = new WeakSet();
  const inspectedRecords = new WeakSet();

  page.on('pageerror', (err) => {
    const rawMessage = err?.stack || err?.message || String(err);
    records.push({
      source: 'pageerror',
      message: redactSensitiveText(rawMessage),
      url: redactSensitiveText(page.url()),
      timestamp: new Date().toISOString(),
    });
  });

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    const locUrl = redactSensitiveText(msg.location()?.url || '');
    const isBrowserNetworkEcho =
      /^Failed to load resource: the server responded with a status of 5\d{2}\b/.test(text) &&
      Boolean(locUrl) &&
      records.some((r) => r.source === 'http-5xx' && r.url === locUrl);
    if (isBrowserNetworkEcho) return;
    records.push({
      source: 'console.error',
      message: redactSensitiveText(text),
      url: locUrl || redactSensitiveText(page.url()),
      timestamp: new Date().toISOString(),
    });
  });

  const recordRequestFailure = (rawUrl, method, resourceType, errorText, headers = {}) => {
    if (isBenignAbortedSubresource(rawUrl, resourceType, errorText)) return;
    const redactedUrl = redactSensitiveText(rawUrl);
    if (
      resourceType === 'fetch' &&
      records.some((r) => r.source === 'requestfailed' && r.resourceType === 'fetch' && r.url === redactedUrl)
    ) {
      return;
    }
    records.push({
      source: 'requestfailed',
      message: redactSensitiveText(`${method} ${rawUrl} failed: ${errorText}`),
      url: redactedUrl,
      method,
      resourceType,
      timestamp: new Date().toISOString(),
      redactedHeaders: redactHeaders(headers),
    });
  };

  page.on('requestfailed', (req) => {
    const errorText = req.failure()?.errorText ?? 'unknown request failure';
    recordRequestFailure(req.url(), req.method(), req.resourceType(), errorText, req.headers());
  });

  page.on('response', (res) => {
    const status = res.status();
    if (status < 500) return;
    const req = res.request();
    const redactedUrl = redactSensitiveText(res.url());
    for (let i = records.length - 1; i >= 0; i--) {
      const prev = records[i];
      if (
        prev.source === 'console.error' &&
        prev.url === redactedUrl &&
        /^Failed to load resource: the server responded with a status of 5\d{2}\b/.test(prev.message)
      ) {
        records.splice(i, 1);
      }
    }
    records.push({
      source: 'http-5xx',
      message: redactSensitiveText(`HTTP ${status} on ${req.method()} ${res.url()}`),
      url: redactedUrl,
      method: req.method(),
      status,
      resourceType: req.resourceType(),
      timestamp: new Date().toISOString(),
      redactedHeaders: redactHeaders(req.headers()),
    });
  });

  const computeUnexpected = () =>
    records.filter((r) => !allowedRecords.has(r) && !allowRules.some((rule) => matchesAllowRule(r, rule)));

  const flushBrowserQueue = async () => {
    if (!page.isClosed()) {
      await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 10))).catch(() => {});
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  };

  return {
    get records() {
      return records;
    },
    allow(rule) {
      if (!rule?.reason || !String(rule.reason).trim()) {
        throw new Error('runtimeTrap.allow() bắt buộc phải khai báo trường reason không rỗng.');
      }
      allowRules.push(rule);
    },
    allowRecord(record) {
      allowedRecords.add(record);
    },
    clearAllowed() {
      allowRules.length = 0;
    },
    getUnexpectedRecords() {
      const unexpected = computeUnexpected();
      for (const rec of unexpected) inspectedRecords.add(rec);
      return unexpected;
    },
    getUnacknowledgedForTeardown() {
      return computeUnexpected().filter((rec) => !inspectedRecords.has(rec));
    },
    flushBrowserQueue,
    assertClean() {
      const unexpected = computeUnexpected();
      if (unexpected.length === 0) return;
      const summary = unexpected
        .map((r, idx) => `  [${idx + 1}] [${r.source}] ${r.message}`)
        .join('\n');
      throw new Error(`Runtime Bug-Trap phát hiện ${unexpected.length} lỗi ngầm:\n${summary}`);
    },
  };
}

function expectNoConsoleOrPageError(trap) {
  trap.assertClean();
}

async function expectExpectedError(trap, rule, action) {
  if (!rule?.reason || !String(rule.reason).trim()) {
    throw new Error('expectExpectedError() bắt buộc phải khai báo trường reason không rỗng.');
  }
  const startIndex = trap.records.length;
  await action();
  await trap.flushBrowserQueue();
  const matched = trap.records.slice(startIndex).filter((record) => matchesAllowRule(record, rule));
  if (matched.length === 0) {
    throw new Error(`expectExpectedError thất bại: Không bắt được lỗi khớp source="${rule.source}".`);
  }
  for (const record of matched) trap.allowRecord(record);
  return matched;
}

module.exports = {
  redactSensitiveText,
  redactHeaders,
  matchesAllowRule,
  createRuntimeTrap,
  expectNoConsoleOrPageError,
  expectExpectedError,
};

