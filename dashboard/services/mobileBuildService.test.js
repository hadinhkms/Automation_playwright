/**
 * dashboard/services/mobileBuildService.test.js
 * TC-2.7 (AC-203, BR-201, BR-202) and APK badging parsing (TECH-202).
 */
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');
const { saveBuild, deleteBuild, validateBuildName } = require('./mobileBuildService');
const { parseBadging } = require('./mobileApkInfo');

function body(buffer, headers = {}) {
  const stream = Readable.from([buffer]);
  stream.headers = { 'content-length': String(buffer.length), ...headers };
  stream.complete = false;
  stream.on('end', () => { stream.complete = true; });
  return stream;
}

describe('validateBuildName (BR-202)', () => {
  test('accepts plain .apk names', () => {
    assert.equal(validateBuildName('app-release_1.2.apk'), 'app-release_1.2.apk');
    assert.equal(validateBuildName('APP.APK'), 'APP.APK');
  });
  for (const bad of ['../a.apk', 'a/b.apk', 'a\\b.apk', '.hidden.apk', 'x.exe', 'app.apk.exe', 'a b.apk', '', 'a..apk', `${'a'.repeat(120)}.apk`]) {
    test(`rejects ${JSON.stringify(bad)} with 400`, () => {
      assert.throws(() => validateBuildName(bad), (err) => err.status === 400);
    });
  }
});

describe('saveBuild / deleteBuild', () => {
  let root;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'mobile-build-')); });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }));

  test('stores the file under apps/ and leaves no .part file', async () => {
    const info = await saveBuild(root, body(Buffer.from('APKDATA')), 'app.apk');
    assert.deepEqual([info.path, info.sizeBytes], ['apps/app.apk', 7]);
    assert.deepEqual(fs.readdirSync(path.join(root, 'apps')), ['app.apk']);
  });

  test('refuses a duplicate name unless overwrite is confirmed (BR-201)', async () => {
    await saveBuild(root, body(Buffer.from('v1')), 'app.apk');
    await assert.rejects(saveBuild(root, body(Buffer.from('v2')), 'app.apk'), (err) => err.status === 409);
    assert.equal(fs.readFileSync(path.join(root, 'apps/app.apk'), 'utf8'), 'v1');
    await saveBuild(root, body(Buffer.from('v2')), 'app.apk', { overwrite: true });
    assert.equal(fs.readFileSync(path.join(root, 'apps/app.apk'), 'utf8'), 'v2');
  });

  test('rejects an empty body with 400 and cleans up', async () => {
    await assert.rejects(saveBuild(root, body(Buffer.alloc(0)), 'empty.apk'), (err) => err.status === 400);
    assert.deepEqual(fs.readdirSync(path.join(root, 'apps')), []);
  });

  test('rejects a declared size over 300 MB with 413 before writing', async () => {
    const req = body(Buffer.from('x'), { 'content-length': String(301 * 1024 * 1024) });
    await assert.rejects(saveBuild(root, req, 'big.apk'), (err) => err.status === 413);
    assert.equal(fs.existsSync(path.join(root, 'apps')), false);
  });

  test('TC-2.7: a build used by the active run cannot be replaced or deleted (AC-203)', async () => {
    await saveBuild(root, body(Buffer.from('v1')), 'app.apk');
    const isInUse = (p) => p === 'apps/app.apk';
    await assert.rejects(saveBuild(root, body(Buffer.from('v2')), 'app.apk', { overwrite: true, isInUse }), (err) => err.status === 409);
    assert.throws(() => deleteBuild(root, 'app.apk', { isInUse }), (err) => err.status === 409);
    assert.ok(fs.existsSync(path.join(root, 'apps/app.apk')));
  });

  test('deletes an unused build and returns 404 for a missing one', async () => {
    await saveBuild(root, body(Buffer.from('v1')), 'app.apk');
    assert.deepEqual(deleteBuild(root, 'app.apk'), { deleted: 'apps/app.apk' });
    assert.throws(() => deleteBuild(root, 'app.apk'), (err) => err.status === 404);
    assert.throws(() => deleteBuild(root, '../package.json'), (err) => err.status === 400);
  });
});

describe('parseBadging (TECH-202)', () => {
  test('reads package, version and label from aapt2 output', () => {
    const out = "package: name='com.coloros.calculator' versionCode='15000010' versionName='15.0.10' platformBuildVersionName='15'\r\n"
      + "sdkVersion:'30'\r\napplication-label:'Calculator'\r\n";
    assert.deepEqual(parseBadging(out), { packageName: 'com.coloros.calculator', versionName: '15.0.10', versionCode: '15000010', label: 'Calculator' });
  });

  test('returns empty fields for unexpected output', () => {
    assert.deepEqual(parseBadging('ERROR: dump failed'), { packageName: '', versionName: '', versionCode: '', label: '' });
  });
});
