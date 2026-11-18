/**
 * dashboard/services/mobileServices.test.js
 * Unit tests for the Mobile App services: adb parsing, spec catalog, run option validation, result parsing.
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseAdbDevices } = require('./mobileDeviceService');
const { extractTests, getCatalog } = require('./mobileSpecService');
const { validateMobileOptions, buildArgs, buildEnv, displayCommand } = require('./mobileRunOptions');
const { consumeLine } = require('./mobileRunnerService');
const { collectEvidence, findWdioBin } = require('./mobileRunArtifacts');

describe('parseAdbDevices', () => {
  test('parses ready, unauthorized and offline devices with properties', () => {
    const out = 'List of devices attached\r\n6XPNHY9D       device product:CPH2481 model:CPH2481 device:OP5709L1 transport_id:1\r\n'
      + 'emulator-5554  unauthorized transport_id:2\r\n192.168.1.5:5555 offline\r\n\r\n';
    const devices = parseAdbDevices(out);
    assert.equal(devices.length, 3);
    assert.deepEqual(devices[0], { serial: '6XPNHY9D', state: 'device', ready: true, model: 'CPH2481', product: 'CPH2481', emulator: false });
    assert.equal(devices[1].ready, false);
    assert.equal(devices[1].emulator, true);
    assert.equal(devices[2].serial, '192.168.1.5:5555');
  });

  test('ignores daemon banners, empty output and malformed serials', () => {
    assert.deepEqual(parseAdbDevices(''), []);
    assert.deepEqual(parseAdbDevices('* daemon not running; starting now at tcp:5037\n* daemon started successfully\nList of devices attached\n'), []);
    assert.deepEqual(parseAdbDevices('List of devices attached\nbad;serial device\n'), []);
  });

  test('replaces underscores in model names', () => {
    assert.equal(parseAdbDevices('emulator-5556 device model:sdk_gphone64_x86_64')[0].model, 'sdk gphone64 x86 64');
  });
});

describe('extractTests', () => {
  test('collects describe/it titles and @tags across quote styles', () => {
    const src = "describe('@android @smoke App launch', () => {\n it(\"TC-1 - opens @login\", async () => {});\n it.skip(`TC-2 - later`, () => {});\n});";
    const info = extractTests(src);
    assert.deepEqual(info.suites, ['@android @smoke App launch']);
    assert.deepEqual(info.tests, ['TC-1 - opens @login', 'TC-2 - later']);
    assert.deepEqual(info.tags, ['@android', '@login', '@smoke']);
  });

  test('is stable across repeated calls (regex lastIndex reset)', () => {
    const src = "it('a @x', () => {});";
    assert.deepEqual(extractTests(src).tests, ['a @x']);
    assert.deepEqual(extractTests(src).tests, ['a @x']);
  });
});

describe('mobile run options and catalog', () => {
  let root;
  before(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mobile-svc-'));
    fs.mkdirSync(path.join(root, 'tests/native/android/auth'), { recursive: true });
    fs.mkdirSync(path.join(root, 'apps'));
    fs.writeFileSync(path.join(root, 'tests/native/android/launch.native.js'), "describe('@smoke Launch', () => { it('TC-1 opens', () => {}); });");
    fs.writeFileSync(path.join(root, 'tests/native/android/auth/login.native.js'), "it('TC-2 login @login', () => {});");
    fs.writeFileSync(path.join(root, 'tests/native/android/helper.js'), '');
    fs.writeFileSync(path.join(root, 'apps/app.apk'), 'x');
    fs.writeFileSync(path.join(root, 'apps/notes.txt'), 'x');
    fs.writeFileSync(path.join(root, 'wdio.android.conf.js'), '');
  });
  after(() => fs.rmSync(root, { recursive: true, force: true }));

  const base = () => ({ platform: 'android', specs: ['tests/native/android/launch.native.js'], app: { type: 'apk', path: 'apps/app.apk' } });

  test('catalog lists only *.native.js specs and .apk builds, with merged tags', () => {
    const cat = getCatalog(root, 'android');
    assert.deepEqual(cat.specs.map((s) => s.path), ['tests/native/android/auth/login.native.js', 'tests/native/android/launch.native.js']);
    assert.deepEqual(cat.tags, ['@login', '@smoke']);
    assert.deepEqual(cat.apps.map((a) => a.path), ['apps/app.apk']);
    assert.equal(cat.configReady, true);
  });

  test('accepts a valid APK run and builds wdio args and env', () => {
    const opts = validateMobileOptions({ ...base(), grep: '@smoke', udid: 'emulator-5554' }, root);
    assert.deepEqual(buildArgs(opts), ['run', './wdio.android.conf.js', '--spec', 'tests/native/android/launch.native.js', '--mochaOpts.grep', '@smoke']);
    const env = buildEnv(opts, root);
    assert.equal(env.ANDROID_APP_PATH, path.join(root, 'apps/app.apk'));
    assert.equal(env.ANDROID_APP_PACKAGE, '');
    assert.equal(env.ANDROID_UDID, 'emulator-5554');
    assert.equal(env.ANDROID_NO_RESET, 'false');
    assert.match(displayCommand(opts), /^npx wdio run/);
  });

  test('installed app clears APK path and forces noReset', () => {
    const opts = validateMobileOptions({ ...base(), app: { type: 'installed', appPackage: 'com.android.settings', appActivity: '.Settings' } }, root);
    const env = buildEnv(opts, root);
    assert.equal(env.ANDROID_APP_PATH, '');
    assert.equal(env.ANDROID_APP_PACKAGE, 'com.android.settings');
    assert.equal(env.ANDROID_NO_RESET, 'true');
  });

  const rejects = [
    ['iOS platform', { platform: 'ios' }, /iOS/],
    ['unknown platform', { platform: 'windows' }, /Nền tảng/],
    ['no specs', { specs: [] }, /ít nhất một/],
    ['spec outside catalog', { specs: ['../../etc/passwd'] }, /không tồn tại/],
    ['non-native helper file', { specs: ['tests/native/android/helper.js'] }, /không tồn tại/],
    ['grep injection', { grep: '@smoke; rm -rf /' }, /Tag/],
    ['grep without @', { grep: 'smoke' }, /Tag/],
    ['bad udid', { udid: 'a b' }, /Serial/],
    ['apk outside apps/', { app: { type: 'apk', path: '../secret.apk' } }, /APK/],
    ['missing app', { app: null }, /APK hoặc/],
    ['bad package', { app: { type: 'installed', appPackage: 'nodots' } }, /Package/],
    ['package injection', { app: { type: 'installed', appPackage: 'com.a;calc' } }, /Package/],
    ['bad activity', { app: { type: 'installed', appPackage: 'com.a.b', appActivity: '../x' } }, /Activity/],
  ];
  for (const [name, patch, pattern] of rejects) {
    test(`rejects ${name} with status 400`, () => {
      assert.throws(() => validateMobileOptions({ ...base(), ...patch }, root), (err) => err.status === 400 && pattern.test(err.message));
    });
  }

  test('collectEvidence returns only recent png files with encoded URLs', () => {
    const dir = path.join(root, 'evidence/native/android');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'FAIL a b.png'), 'x');
    fs.writeFileSync(path.join(dir, 'note.txt'), 'x');
    const old = path.join(dir, 'old.png');
    fs.writeFileSync(old, 'x');
    fs.utimesSync(old, new Date(2020, 0, 1), new Date(2020, 0, 1));
    const items = collectEvidence(root, 'android', new Date().toISOString());
    assert.deepEqual(items.map((i) => i.url), ['/evidence/native/android/FAIL%20a%20b.png']);
  });
});

describe('findWdioBin', () => {
  test('finds the repo WDIO CLI and reports 503 when it is not installed anywhere', () => {
    assert.match(findWdioBin(process.cwd()), /@wdio[\\/]cli[\\/]bin[\\/]wdio\.js$/);
    const cwd = process.cwd();
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'mobile-nowdio-'));
    process.chdir(empty);
    try {
      assert.throws(() => findWdioBin(empty), (err) => err.status === 503 && /npm install/.test(err.message));
    } finally {
      process.chdir(cwd);
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe('consumeLine (spec reporter parsing)', () => {
  test('records pass/fail once, strips ANSI and durations, and advances phase', () => {
    const run = { phase: 'starting', results: [] };
    consumeLine(run, '[0-0] RUNNING in Android - file:///tests/native/android/launch.native.js');
    consumeLine(run, '[OPPO #0-0]    \x1b[32m✓\x1b[39m TC-1 opens (1.2s)');
    consumeLine(run, '[OPPO #0-0]    ✓ TC-1 opens');
    consumeLine(run, '[OPPO #0-0]    ✖ TC-2 login');
    assert.equal(run.phase, 'testing');
    assert.deepEqual(run.results, [{ title: 'TC-1 opens', status: 'passed' }, { title: 'TC-2 login', status: 'failed' }]);
  });
});
