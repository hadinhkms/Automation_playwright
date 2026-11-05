'use strict';

/**
 * Bắt và decode request Mixpanel để spec verify event tracking qua network.
 * Bản JavaScript của `playwright/tests/support/mixpanel-capture.ts` (Hub QA, Plan 17), cùng API.
 * Hỗ trợ: form `data=<base64|JSON>`, JSON body (object/batch), GET `?data=`, sendBeacon.
 * Proxy `api_host` riêng: option `hosts` hoặc env `MIXPANEL_API_HOST` (phân tách bằng dấu phẩy).
 */
const { expect } = require('@playwright/test');

const DEFAULT_HOST = /(^|\.)mixpanel\.com$/i;
const ENDPOINT = /\/(track|engage|groups)\/?$/i;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseJsonRecords(text) {
  try {
    const value = JSON.parse(text);
    const list = Array.isArray(value) ? value : [value];
    return list.filter((item) => typeof item === 'object' && item !== null);
  } catch (_) {
    return null;
  }
}

function decodeDataParam(data) {
  const direct = parseJsonRecords(data);
  if (direct) return direct;
  // URLSearchParams biến '+' chưa encode thành khoảng trắng; base64 không có khoảng trắng.
  const decoded = Buffer.from(data.replace(/ /g, '+'), 'base64').toString('utf8');
  return parseJsonRecords(decoded) || [];
}

/** Decode body (hoặc query string) của một request Mixpanel thành danh sách bản ghi. */
function decodeMixpanelBody(raw) {
  const text = String(raw || '').trim();
  if (text === '') return [];
  if (text.startsWith('[') || text.startsWith('{')) return parseJsonRecords(text) || [];
  const data = new URLSearchParams(text).get('data');
  return data === null ? [] : decodeDataParam(data);
}

function hostMatcher(hosts) {
  const extra = hosts || String(process.env.MIXPANEL_API_HOST || '').split(',');
  const list = extra.map((h) => h.trim().toLowerCase()).filter(Boolean);
  return (host) => DEFAULT_HOST.test(host) || list.includes(host.toLowerCase());
}

/** Bắt đầu lắng nghe request Mixpanel trên `page`. Gọi TRƯỚC khi thao tác flow. */
function startMixpanelCapture(page, options = {}) {
  const isMixpanelHost = hostMatcher(options.hosts);
  const events = [];
  const profiles = [];
  const undecoded = [];

  const onRequest = (req) => {
    if (req.method() === 'OPTIONS') return; // CORS preflight, không có payload
    const url = new URL(req.url());
    const match = ENDPOINT.exec(url.pathname);
    if (!match || !isMixpanelHost(url.hostname)) return;
    const records = decodeMixpanelBody(req.postData() || url.search.replace(/^\?/, ''));
    if (records.length === 0) {
      undecoded.push(req.url());
      return;
    }
    for (const record of records) {
      if (match[1].toLowerCase() !== 'track') {
        profiles.push(record);
        continue;
      }
      events.push({ event: String(record.event || ''), properties: record.properties || {}, url: req.url() });
    }
  };

  page.on('request', onRequest);
  return { events, profiles, undecoded, stop: () => page.off('request', onRequest) };
}

function matching(capture, name, where) {
  return capture.events.filter((e) => e.event === name && (where ? where(e) : true));
}

function describeCapture(capture) {
  const names = capture.events.map((e) => e.event).join(', ') || '(none)';
  const skipped = capture.undecoded.length ? `; undecoded requests: ${capture.undecoded.length}` : '';
  return `captured events: ${names}${skipped}`;
}

/**
 * Chờ event `name` được bắn, kiểm số lần (nếu có) và property bắt buộc. Trả về các event khớp.
 * @param {object} [options] `properties` (subset, áp cho MỌI event khớp), `where`, `count`,
 *   `timeoutMs` (mặc định 10s, SDK có thể batch), `settleMs` (mặc định 500ms, bắt bắn trùng)
 */
async function expectMixpanelEvent(capture, name, options = {}) {
  const { properties, where, count, timeoutMs = 10000, settleMs = 500 } = options;
  const minimum = count === undefined ? 1 : count;
  await expect
    .poll(() => matching(capture, name, where).length, {
      message: `Mixpanel event "${name}" not fired ${minimum}x — ${describeCapture(capture)}`,
      timeout: timeoutMs,
    })
    .toBeGreaterThanOrEqual(minimum);

  if (count !== undefined) {
    await sleep(settleMs);
    const fired = matching(capture, name, where).length;
    expect(fired, `Mixpanel event "${name}" must fire exactly ${count}x (duplicate firing?)`).toBe(count);
  }

  const found = matching(capture, name, where);
  if (properties) {
    found.forEach((e, i) => {
      expect(e.properties, `Mixpanel event "${name}" #${i + 1} properties`).toMatchObject(properties);
    });
  }
  return found;
}

/** Kiểm event `name` KHÔNG được bắn trong khoảng `settleMs` (mặc định 1s). */
async function expectNoMixpanelEvent(capture, name, options = {}) {
  await sleep(options.settleMs === undefined ? 1000 : options.settleMs);
  const fired = matching(capture, name, options.where).length;
  expect(fired, `Mixpanel event "${name}" must not fire — ${describeCapture(capture)}`).toBe(0);
}

module.exports = {
  decodeMixpanelBody,
  startMixpanelCapture,
  expectMixpanelEvent,
  expectNoMixpanelEvent,
};
