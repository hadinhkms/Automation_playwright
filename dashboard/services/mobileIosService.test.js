/**
 * dashboard/services/mobileIosService.test.js
 * PLAN-25 P3 unit tests: iOS settings validation (AC-303 / BR-301 / BR-302, TC-3.4),
 * .env persistence (REQ-301), iOS run options and command (AC-304, TC-3.5).
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { validateIosConfig, readIosConfig, saveIosConfig } = require('./mobileIosService');
const { validateMobileOptions, buildArgs, buildEnv, displayCommand } = require('./mobileRunOptions');
const { listProfiles } = require('./mobileAppProfiles');

const SIM = { name: 'iPhone 15', platformVersion: '17.5', simulator: true };
const REAL = { name: 'QA iPhone', platformVersion: '17.4', udid: '00008110-001A2B3C4D5E6F70', simulator: false };

describe('validateIosConfig (AC-303, BR-301)', () => {
  test('accepts http(s)://host[:port] and normalizes host and port', () => {
    assert.deepEqual(validateIosConfig({ host: 'http://192.168.1.20', port: 4723 }).host, 'http://192.168.1.20');
    const withPort = validateIosConfig({ host: 'https://QA-Mac.local:4800/', port: 4723 });
    assert.equal(withPort.host, 'https://qa-mac.local');
    assert.equal(withPort.port, 4800);
    assert.equal(validateIosConfig({}).host, '');
  });

  const badHosts = [
    'file:///etc/passwd', 'ftp://mac', 'http://mac /x', 'http://mac;rm -rf /', 'http://mac/wd/hub',
    'http://user:pass@mac', 'http://mac?x=1', 'mac.local', 'http://$(whoami)', 'http://mac`id`', 'http://-mac',
  ];
  for (const host of badHosts) {
    test(`rejects host ${JSON.stringify(host)} with 400`, () => {
      assert.throws(() => validateIosConfig({ host }), (err) => err.status === 400 && /http\(s\)/.test(err.message));
    });
  }

  test('rejects bad port, devices, app location, Team ID and bundle ids with 400', () => {
    const cases = [
      { host: 'http://mac', port: 70000 },
      { devices: '{not json' },
      { devices: [{ name: 'iPhone; rm', platformVersion: '17.5' }] },
      { devices: [{ name: 'iPhone', platformVersion: 'latest' }] },
      { devices: [{ name: 'iPhone', platformVersion: '17.5', simulator: false }] },
      { devices: [SIM, { ...SIM }] },
      { devices: Array.from({ length: 11 }, (_, i) => ({ ...SIM, name: `iPhone ${i}` })) },
      { app: 'C:\\apps\\My.ipa' },
      { app: '/Users/qa/../etc/My.app' },
      { app: 'file:///Users/qa/My.app' },
      { bundleId: 'com.a;calc' },
      { xcodeOrgId: 'abc' },
      { wdaBundleId: 'not a bundle' },
    ];
    for (const input of cases) {
      assert.throws(() => validateIosConfig(input), (err) => err.status === 400, JSON.stringify(input));
    }
  });

  test('keeps declared devices; real iPhone needs a UDID; no password field exists (BR-302)', () => {
    const cfg = validateIosConfig({ devices: JSON.stringify([SIM, REAL]), xcodeOrgId: 'AB12CD34EF', wdaBundleId: 'com.acme.WebDriverAgentRunner', password: 'secret' });
    assert.deepEqual(cfg.devices, [{ ...SIM, udid: '' }, REAL]);
    assert.equal(cfg.xcodeOrgId, 'AB12CD34EF');
    assert.equal('password' in cfg, false);
  });
});

describe('iOS settings in .env (REQ-301) and run options (AC-304)', () => {
  let root;
  before(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mobile-ios-'));
    fs.mkdirSync(path.join(root, 'tests/native/shared/app'), { recursive: true });
    fs.mkdirSync(path.join(root, 'tests/native/android'), { recursive: true });
    fs.writeFileSync(path.join(root, 'tests/native/shared/app/launch.native.js'), "it('TC-101 opens @smoke', () => {});");
    fs.writeFileSync(path.join(root, 'tests/native/android/back.native.js'), "it('TC-150 back', () => {});");
    fs.writeFileSync(path.join(root, '.env'), '# keep me\nBASE_URL=https://x.test\nIOS_APPIUM_HOST=\nIOS_APPIUM_PORT=4723\n');
  });
  after(() => fs.rmSync(root, { recursive: true, force: true }));

  test('save rewrites only IOS_* lines, keeps comments and other keys, and reads back', () => {
    saveIosConfig(root, { host: 'http://10.0.0.5', port: 4724, devices: [SIM], app: '/Users/qa/Builds/My App.app', bundleId: '' });
    const text = fs.readFileSync(path.join(root, '.env'), 'utf8');
    assert.match(text, /^# keep me$/m);
    assert.match(text, /^BASE_URL=https:\/\/x\.test$/m);
    assert.match(text, /^IOS_APPIUM_HOST=http:\/\/10\.0\.0\.5$/m);
    assert.match(text, /^IOS_APP='\/Users\/qa\/Builds\/My App\.app'$/m);
    assert.equal((text.match(/^IOS_APPIUM_HOST=/gm) || []).length, 1);
    const back = readIosConfig(root);
    assert.equal(back.port, 4724);
    assert.deepEqual(back.devices, [{ ...SIM, udid: '' }]);
    assert.equal(back.app, '/Users/qa/Builds/My App.app');
    assert.equal(back.error, '');
  });

  test('a hand-broken .env value is reported, not thrown', () => {
    const file = path.join(root, '.env');
    const before = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, `${before}IOS_DEVICES=[oops\n`);
    try {
      const cfg = readIosConfig(root);
      assert.match(cfg.error, /JSON/);
      assert.equal(cfg.host, '');
    } finally {
      fs.writeFileSync(file, before);
    }
  });

  const iosRun = (patch = {}) => ({
    platform: 'ios', specs: ['tests/native/shared/app/launch.native.js'], device: 'iPhone 15@17.5',
    app: { type: 'bundle', bundleId: 'com.apple.Preferences' }, grep: '@smoke', ...patch,
  });

  test('iOS command uses wdio.ios.conf.js and env carries Mac host, device and app (AC-304)', () => {
    const opts = validateMobileOptions(iosRun(), root);
    assert.equal(displayCommand(opts), 'npx wdio run ./wdio.ios.conf.js --spec tests/native/shared/app/launch.native.js --mochaOpts.grep @smoke');
    assert.deepEqual(buildArgs(opts).slice(0, 2), ['run', './wdio.ios.conf.js']);
    const env = buildEnv(opts, root);
    assert.equal(env.IOS_APPIUM_HOST, 'http://10.0.0.5');
    assert.equal(env.IOS_APPIUM_PORT, '4724');
    assert.equal(env.IOS_DEVICE_NAME, 'iPhone 15');
    assert.equal(env.IOS_PLATFORM_VERSION, '17.5');
    assert.equal(env.IOS_SIMULATOR, 'true');
    assert.equal(env.IOS_BUNDLE_ID, 'com.apple.Preferences');
    assert.equal(env.IOS_APP, '', 'saved IOS_APP must not leak into a bundle-id run');
    assert.equal(env.IOS_NO_RESET, 'true');
    assert.equal('xcodeOrgId' in opts, false, 'Team ID never travels with the run options (SSE/history)');
  });

  test('iOS run with a Mac path or URL sets IOS_APP and clears the bundle id', () => {
    const byPath = buildEnv(validateMobileOptions(iosRun({ app: { type: 'mac-path', path: '/Users/qa/My.app' } }), root), root);
    assert.equal(byPath.IOS_APP, '/Users/qa/My.app');
    assert.equal(byPath.IOS_BUNDLE_ID, '');
    const byUrl = buildEnv(validateMobileOptions(iosRun({ app: { type: 'url', url: 'https://ci.example.com/My.ipa' } }), root), root);
    assert.equal(byUrl.IOS_APP, 'https://ci.example.com/My.ipa');
  });

  test('iOS run rejects undeclared devices, Windows paths, android-only specs and odd URLs with 400', () => {
    const cases = [
      iosRun({ device: 'iPhone 99@1.0' }),
      iosRun({ app: { type: 'mac-path', path: 'C:\\apps\\My.ipa' } }),
      iosRun({ app: { type: 'url', url: 'javascript:alert(1)' } }),
      iosRun({ app: { type: 'apk', path: 'apps/app.apk' } }),
      iosRun({ specs: ['tests/native/android/back.native.js'] }),
    ];
    for (const input of cases) {
      assert.throws(() => validateMobileOptions(input, root), (err) => err.status === 400, JSON.stringify(input));
    }
  });
});

describe('listProfiles (S-05)', () => {
  test('returns platform-specific fields and skips broken entries', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mobile-prof-'));
    fs.mkdirSync(path.join(root, 'core/native'), { recursive: true });
    fs.writeFileSync(path.join(root, 'core/native/app-profiles.json'), JSON.stringify({ profiles: [
      { id: 'calc', name: 'Calc', android: { appPackage: 'com.a.calc', appActivity: '.Main' }, ios: { bundleId: 'com.a.calc' } },
      { id: 'calc', name: 'Duplicate', android: { appPackage: 'com.b.calc' } },
      { id: 'bad id!', android: { appPackage: 'com.c.x' } },
      { id: 'ios-only', ios: { app: '/Users/qa/X.app' } },
    ] }));
    try {
      assert.deepEqual(listProfiles(root, 'android'), [{ id: 'calc', name: 'Calc', appPackage: 'com.a.calc', appActivity: '.Main' }]);
      assert.deepEqual(listProfiles(root, 'ios').map((p) => p.id), ['calc', 'ios-only']);
      fs.writeFileSync(path.join(root, 'core/native/app-profiles.json'), '{oops');
      assert.deepEqual(listProfiles(root, 'ios'), []);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
