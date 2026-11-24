'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeSettings } = require('./settingsMerge');

// Gate 3 Z-5: a JSON body can carry a real own "__proto__" key; merging must never reach prototypes.
test('__proto__, constructor and prototype keys are ignored at every depth', () => {
  const current = { branding: { projectName: 'A', fontSize: '14px' }, runtime: { viewport: { width: 1, height: 2 } } };
  const body = JSON.parse('{"branding":{"__proto__":{"polluted":"yes"},"projectName":"B"},"__proto__":{"top":"x"},"runtime":{"viewport":{"constructor":{"prototype":{"deep":"x"}},"width":3}},"constructor":{"prototype":{"c":"x"}}}');
  const merged = mergeSettings(current, body);
  assert.equal(merged.branding.projectName, 'B');
  assert.equal(merged.branding.fontSize, '14px');
  assert.equal(merged.runtime.viewport.width, 3);
  assert.equal(merged.runtime.viewport.height, 2);
  assert.equal(merged.branding.polluted, undefined, 'no inherited polluted property');
  assert.equal(Object.getPrototypeOf(merged.branding), Object.prototype, 'prototype of the merged section untouched');
  assert.equal(Object.getPrototypeOf(merged), Object.prototype);
  assert.equal(merged.top, undefined);
  assert.equal(merged.runtime.viewport.deep, undefined);
  assert.equal(({}).polluted, undefined);
  assert.equal(({}).top, undefined);
  assert.ok(!Object.prototype.hasOwnProperty.call(merged, 'constructor') || merged.constructor === Object, 'no own constructor key from the body');
});

test('normal merging behaviour is unchanged (sections merge, suites/environments replace)', () => {
  const merged = mergeSettings({ branding: { a: 1, b: 2 }, suites: { x: {}, y: {} } }, { branding: { b: 3 }, suites: { z: {} } });
  assert.deepEqual(merged, { branding: { a: 1, b: 3 }, suites: { z: {} } });
});
