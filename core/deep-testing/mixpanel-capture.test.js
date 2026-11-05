'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const {
  decodeMixpanelBody,
  startMixpanelCapture,
  expectMixpanelEvent,
  expectNoMixpanelEvent,
} = require('./mixpanel-capture');

const SIGN_IN = { event: 'Job Search Performed', properties: { province_number: 1, filter_version: '1.0' } };
const b64 = (value) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64');

/** Page giả: chỉ cần on/off('request') như Playwright Page. */
function fakePage() {
  const emitter = new EventEmitter();
  const fire = (url, body, method = 'POST') =>
    emitter.emit('request', { url: () => url, postData: () => body, method: () => method });
  return { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), fire };
}

test('decodeMixpanelBody handles base64 form, raw "+", JSON data, batch and garbage', () => {
  const encoded = b64([SIGN_IN]);
  assert.deepEqual(decodeMixpanelBody(`data=${encodeURIComponent(encoded)}&ip=1`), [SIGN_IN]);
  assert.deepEqual(decodeMixpanelBody(`data=${encoded}`), [SIGN_IN]);
  assert.deepEqual(decodeMixpanelBody(`data=${encodeURIComponent(JSON.stringify(SIGN_IN))}`), [SIGN_IN]);
  assert.equal(decodeMixpanelBody(JSON.stringify([SIGN_IN, SIGN_IN])).length, 2);
  assert.deepEqual(decodeMixpanelBody(''), []);
  assert.deepEqual(decodeMixpanelBody('data=%%%not-base64'), []);
  assert.deepEqual(decodeMixpanelBody('foo=bar'), []);
});

test('startMixpanelCapture splits track/engage, matches EU host and proxy, ignores others', () => {
  const page = fakePage();
  const cap = startMixpanelCapture(page, { hosts: ['track.app.local'] });
  page.fire('https://api-eu.mixpanel.com/track/?verbose=1', `data=${encodeURIComponent(b64([SIGN_IN]))}`);
  page.fire('https://api-eu.mixpanel.com/engage/', JSON.stringify({ $set: { plan: 'free' } }));
  page.fire('https://track.app.local/track', JSON.stringify({ event: 'Proxy', properties: {} }));
  page.fire('https://analytics.other.local/track', JSON.stringify({ event: 'Other', properties: {} }));
  page.fire('https://api-eu.mixpanel.com/track', '', 'OPTIONS');
  page.fire('https://api-eu.mixpanel.com/track', '');
  assert.deepEqual(cap.events.map((e) => e.event), ['Job Search Performed', 'Proxy']);
  assert.equal(cap.profiles.length, 1);
  assert.equal(cap.undecoded.length, 1, 'empty body (not preflight) is reported as undecoded');

  cap.stop();
  page.fire('https://api-eu.mixpanel.com/track', JSON.stringify({ event: 'After', properties: {} }));
  assert.equal(cap.events.length, 2, 'stop() detaches the listener');
});

test('expectMixpanelEvent checks properties, exact count and reports captured names', async () => {
  const page = fakePage();
  const cap = startMixpanelCapture(page);
  page.fire('https://api.mixpanel.com/track', JSON.stringify([SIGN_IN]));

  const found = await expectMixpanelEvent(cap, 'Job Search Performed', {
    count: 1,
    settleMs: 10,
    properties: { province_number: 1 },
  });
  assert.equal(found.length, 1);
  await assert.rejects(
    expectMixpanelEvent(cap, 'Job Search Performed', { properties: { province_number: 34 } }),
    /properties/,
  );

  page.fire('https://api.mixpanel.com/track', JSON.stringify([SIGN_IN]));
  await assert.rejects(
    expectMixpanelEvent(cap, 'Job Search Performed', { count: 1, settleMs: 10 }),
    /exactly 1x/,
  );
  await assert.rejects(
    expectMixpanelEvent(cap, 'Missing Event', { timeoutMs: 200 }),
    /captured events: Job Search Performed/,
  );
  await assert.rejects(expectNoMixpanelEvent(cap, 'Job Search Performed', { settleMs: 10 }), /must not fire/);
  await expectNoMixpanelEvent(cap, 'Missing Event', { settleMs: 10 });
});
