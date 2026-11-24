/**
 * tests/dashboard-api/run-options.test.js
 * Script picker 1a (CONTRACT-script-picker §2.2), via real HTTP + real `playwright test --list`:
 * tags[] -> grep with tag boundary, escaped + anchored spec args, 400 for unknown spec/tag/project,
 * argument-length / count limits, grep cap 200, compatible legacy payloads.
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');
const { specArg, tagGrep } = require('../../dashboard/services/runnerArgs');

const PW = JSON.stringify(require.resolve('@playwright/test'));
const PW_CLI = require.resolve('@playwright/test/cli');
const ODD = 'tests/e2e/desktop/odd [1] (x)+y$z.spec.js';
const A = 'tests/e2e/desktop/a.spec.js';
const MOBILE = 'tests/e2e/mobile/m.spec.js';

const CONFIG = `module.exports = { testDir: './tests', projects: [
  { name: 'Desktop Smoke Tests', testMatch: 'e2e/desktop/**/*.spec.js', grep: /@smoke/ },
  { name: 'Mobile Chrome Smoke Tests', testMatch: 'e2e/mobile/**/*.spec.js', grep: /@smoke/ },
] };\n`;

function writeSpec(root, rel, title) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `const { test } = require(${PW});\ntest('${title}', async () => {});\n`);
}

function listFiles(root, ...args) {
  const res = spawnSync(process.execPath, [PW_CLI, 'test', '--list', '--reporter=json', ...args], { cwd: root, encoding: 'utf8' });
  const json = JSON.parse(res.stdout);
  return json.suites.map((s) => s.file).sort();
}

describe('POST /api/run options (script picker 1a)', () => {
  let fixture; let harness; let root;
  const run = (body) => fetch(`${harness.url}/api/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const state = async () => (await fetch(`${harness.url}/api/state`)).json();
  const idle = async () => { for (let i = 0; i < 100; i += 1) { if (!(await state()).activeRun) return; await new Promise((r) => setTimeout(r, 200)); } throw new Error('run did not finish'); };
  const bad = async (body, pattern) => {
    const res = await run(body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.match((await res.json()).error, pattern);
    const s = await state();
    assert.equal(s.activeRun, null, 'a rejected request must not spawn a run');
  };

  before(async () => {
    fixture = createFixtureWorkspace();
    root = fixture.rootPath;
    fs.writeFileSync(path.join(root, 'playwright.config.js'), CONFIG);
    writeSpec(root, A, 'case a @smoke @a1');
    writeSpec(root, 'tests/e2e/desktop/b.spec.js', 'case b @smoke @a12');
    writeSpec(root, ODD, 'odd one @smoke');
    writeSpec(root, 'tests/e2e/desktop/odd 1 x y z.spec.js', 'odd two @smoke @e2e');
    writeSpec(root, MOBILE, 'mobile @smoke');
    harness = await startDashboardHarness(root);
  });
  after(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });

  describe('real Playwright selects exactly what the server builds', () => {
    test('escaped + anchored spec arg selects ONLY the odd-named file', () => {
      assert.deepEqual(listFiles(root, specArg(ODD)), ['e2e/desktop/odd [1] (x)+y$z.spec.js']);
      // the raw name used as a regex would select a different file / nothing
      assert.notDeepEqual(listFiles(root, ODD), ['e2e/desktop/odd [1] (x)+y$z.spec.js']);
    });

    test('tag grep has a tag boundary: @a1 does not match @a12', () => {
      assert.deepEqual(listFiles(root, '--grep', tagGrep(['@a1'])), ['e2e/desktop/a.spec.js']);
      assert.deepEqual(listFiles(root, '--grep', '@a1'), ['e2e/desktop/a.spec.js', 'e2e/desktop/b.spec.js']);
    });

    test('specs AND tags is an intersection', () => {
      assert.deepEqual(listFiles(root, specArg(A), '--grep', tagGrep(['@smoke'])), ['e2e/desktop/a.spec.js']);
      assert.deepEqual(listFiles(root, specArg(A), '--grep', tagGrep(['@e2e'])), []);
    });
  });

  describe('accepted requests (202) build the real arguments', () => {
    test('odd-named spec: command carries the escaped + anchored arg', async () => {
      const res = await run({ specs: [ODD], projects: ['Desktop Smoke Tests'] });
      assert.equal(res.status, 202);
      const body = await res.json();
      assert.ok(body.command.includes(JSON.stringify(specArg(ODD))), body.command);
      assert.deepEqual(body.options.specs, [ODD]);
      await idle();
    });

    test('tags[] -> grep with boundary in options and command; specs + tags both present', async () => {
      const res = await run({ specs: [A], tags: ['@smoke', '@a1'] });
      assert.equal(res.status, 202);
      const body = await res.json();
      assert.equal(body.options.grep, '(?:@smoke|@a1)(?![\\w-])');
      assert.deepEqual(body.options.tags, ['@smoke', '@a1']);
      assert.ok(body.command.includes(JSON.stringify(body.options.grep)));
      assert.ok(body.command.includes(JSON.stringify(specArg(A))));
      await idle();
    });

    test('compatible legacy payloads: {spec:"all"}, {grep:"@smoke"}, unknown fields ignored', async () => {
      for (const payload of [{ spec: 'all' }, { grep: '@smoke' }, { specs: [A], futureField: { x: 1 } }, { spec: A }]) {
        const res = await run(payload);
        assert.equal(res.status, 202, JSON.stringify(payload));
        await idle();
      }
    });

    test('two simultaneous runs: exactly one 202 and one 409', async () => {
      const [r1, r2] = await Promise.all([run({ specs: [A] }), run({ specs: [A] })]);
      assert.deepEqual([r1.status, r2.status].sort(), [202, 409]);
      await idle();
    });

    test('a project that can run the selected file is accepted', async () => {
      const res = await run({ specs: [MOBILE], projects: ['Mobile Chrome Smoke Tests'] });
      assert.equal(res.status, 202);
      await idle();
    });
  });

  describe('rejections (400, nothing spawned)', () => {
    test('spec that does not exist (deleted file) -> 400 instead of running everything', () => bad({ specs: ['tests/e2e/desktop/gone.spec.js'] }, /Spec không hợp lệ: tests\/e2e\/desktop\/gone\.spec\.js/));
    test('single legacy spec that does not exist -> 400', () => bad({ spec: 'tests/e2e/desktop/gone.spec.js' }, /Spec không hợp lệ/));
    test('valid + invalid specs: the error names only the invalid ones', async () => {
      const res = await run({ specs: [A, 'tests/e2e/desktop/gone.spec.js'] });
      assert.equal(res.status, 400);
      const { error } = await res.json();
      assert.match(error, /gone\.spec\.js/);
      assert.ok(!error.includes('a.spec.js,'));
    });
    test('wrong case and backslash paths -> 400', async () => {
      await bad({ specs: ['tests/e2e/desktop/A.spec.js'] }, /Spec không hợp lệ/);
      await bad({ specs: ['tests\\e2e\\desktop\\a.spec.js'] }, /Spec không hợp lệ/);
    });
    test('specs: [] -> 400', () => bad({ specs: [] }, /Danh sách spec rỗng/));
    test('tag outside availableTags -> 400', () => bad({ tags: ['@nope'] }, /Tag không hợp lệ: @nope/));
    test('more than 20 tags -> 400', () => bad({ tags: Array.from({ length: 21 }, (_, i) => `@t${i}`) }, /Tối đa 20 tag/));
    test('tags + grep together -> 400', () => bad({ tags: ['@smoke'], grep: '@smoke' }, /Chỉ dùng tags hoặc grep/));
    test('grep longer than 200 or with control characters -> 400', async () => {
      await bad({ grep: 'a'.repeat(201) }, /Tag\/grep không hợp lệ/);
      await bad({ grep: 'a\nb' }, /Tag\/grep không hợp lệ/);
    });
    test('grep of 120 chars (over the old cap of 80) is accepted', async () => {
      const res = await run({ specs: [A], grep: `@smoke${'|@a1'.repeat(28)}` });
      assert.equal(res.status, 202);
      assert.ok((await res.json()).options.grep.length > 80);
      await idle();
    });
    test('unknown project in projects[] -> 400', () => bad({ projects: ['Nope'] }, /Project không hợp lệ: Nope/));
    test('no selected file can run on the chosen project -> 400 (D8)', () => bad({ specs: [A], projects: ['Mobile Chrome Smoke Tests'] }, /Không có file nào chạy được trên project đã chọn/));
  });
});

describe('POST /api/run limits (count and command length)', () => {
  let fixture; let harness; let root;
  const run = (body) => fetch(`${harness.url}/api/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  before(async () => {
    fixture = createFixtureWorkspace();
    root = fixture.rootPath;
    fs.writeFileSync(path.join(root, 'playwright.config.js'), 'module.exports = { testDir: "./tests" };\n');
    fs.mkdirSync(path.join(root, 'tests/many'), { recursive: true });
    for (let i = 0; i < 201; i += 1) fs.writeFileSync(path.join(root, `tests/many/m${i}.spec.js`), '');
    for (let i = 0; i < 130; i += 1) fs.writeFileSync(path.join(root, 'tests', `${'long'.repeat(45)}-${i}.spec.js`), '');
    harness = await startDashboardHarness(root);
  });
  after(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });

  test('more than 200 specs -> 400', async () => {
    const res = await run({ specs: Array.from({ length: 201 }, (_, i) => `tests/many/m${i}.spec.js`) });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /Tối đa 200 spec/);
  });

  test('command line over 24000 characters -> 400 with a clear message', async () => {
    const specs = Array.from({ length: 130 }, (_, i) => `tests/${'long'.repeat(45)}-${i}.spec.js`);
    const res = await run({ specs });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /Quá nhiều file đã chọn/);
    assert.equal((await (await fetch(`${harness.url}/api/state`)).json()).activeRun, null);
  });
});
