'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { findClassDeclaration } = require('./classDeclaration');
const { parsePageObject } = require('./pageParser');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('JSDoc "Base class for" không bị bắt thành class "for"', () => {
  const src = '/**\n * Base class for native Screens\n */\nclass Real extends Base {}';
  assert.deepEqual(findClassDeclaration(src), { className: 'Real', baseClass: 'Base' });
});

test('bỏ qua comment dòng, giữ chuỗi chứa //, nhận export/module.exports', () => {
  assert.deepEqual(findClassDeclaration('// class Fake extends X\nconst u = "http://a/class Nope";\nexport default class Page {}'), { className: 'Page', baseClass: null });
  assert.deepEqual(findClassDeclaration("module.exports = class Foo extends BasePage {}"), { className: 'Foo', baseClass: 'BasePage' });
  assert.equal(findClassDeclaration('/* class A {} */ const x = 1;'), null);
});

test('regression: pages/native/NativeBasePage.js ra NativeBasePage, không phải "for"', () => {
  const page = parsePageObject('pages/native/NativeBasePage.js', ROOT);
  assert.equal(page.className, 'NativeBasePage');
  assert.equal(page.baseClass, 'None');
});

test('mọi Page Object thật trong pages/ có className là identifier hợp lệ khớp một class trong file', () => {
  const fs = require('fs');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  for (const file of walk(path.join(ROOT, 'pages')).filter((f) => f.endsWith('.js'))) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const { className } = parsePageObject(rel, ROOT);
    const text = fs.readFileSync(file, 'utf8');
    if (/^\s*(?:export\s+)?class\s/m.test(text)) {
      assert.match(text, new RegExp(`class\\s+${className}\\b`), `${rel} -> ${className}`);
    }
  }
});
