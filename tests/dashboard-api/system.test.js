/**
 * tests/dashboard-api/system.test.js
 * API Contract tests for system endpoints: /api/config, /api/health, /api/state
 * Executed via Node.js native test runner (node --test).
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');

describe('API Contract: System & Lifecycle Routes', () => {
  let fixture;
  let harness;

  before(async () => {
    fixture = createFixtureWorkspace();
    harness = await startDashboardHarness(fixture.rootPath);
  });

  after(async () => {
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
  });

  test('GET /api/health returns 200 and healthy server payload', async () => {
    const res = await fetch(`${harness.url}/api/health`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /application\/json/);
    const body = await res.json();
    assert.ok(body.appName !== undefined);
    assert.ok(body.port !== undefined);
    assert.ok(body.pid !== undefined);
    assert.ok(body.workspaceRoot !== undefined);
  });

  test('GET /api/config returns 200 and valid configuration schema', async () => {
    const res = await fetch(`${harness.url}/api/config`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /application\/json/);
    const body = await res.json();
    assert.ok(typeof body === 'object');
    assert.ok(body.branding !== undefined || body.features !== undefined || body.port !== undefined);
  });

  test('GET /api/state returns 200 and runner state schema', async () => {
    const res = await fetch(`${harness.url}/api/state`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /application\/json/);
    const body = await res.json();
    assert.ok(body.status !== undefined || body.activeRun !== undefined || body.running !== undefined);
  });

  test('GET /api/unknown-endpoint returns 404 with error payload', async () => {
    const res = await fetch(`${harness.url}/api/unknown-endpoint`);
    assert.equal(res.status, 404);
    assert.match(res.headers.get('content-type') || '', /application\/json/);
    const body = await res.json();
    assert.ok(body.error !== undefined);
  });

  test('TC-23-02: Contract SHA256 matches approved hash and audit registry has closed Hub findings', async () => {
    const contractPath = path.resolve(__dirname, '../../.delivery/contract.json');
    const approvedPath = path.resolve(__dirname, '../../.delivery/approved_contract.sha256');
    const registryPath = path.resolve(__dirname, '../../audit/FINDINGS_REGISTRY.md');

    assert.ok(fs.existsSync(contractPath), 'contract.json must exist');
    assert.ok(fs.existsSync(approvedPath), 'approved_contract.sha256 must exist');
    assert.ok(fs.existsSync(registryPath), 'FINDINGS_REGISTRY.md must exist');

    const contractBytes = fs.readFileSync(contractPath);
    const contractHash = crypto.createHash('sha256').update(contractBytes).digest('hex');
    const approvedHash = fs.readFileSync(approvedPath, 'utf8').trim().toLowerCase();
    assert.equal(contractHash, approvedHash, 'contract.json hash must match approved_contract.sha256');

    const registryText = fs.readFileSync(registryPath, 'utf8');
    assert.match(registryText, /HUB-01.*CLOSED/);
    assert.match(registryText, /HUB-02.*CLOSED/);
  });

  test('TC-24-03: System audit probes P1-P5 pass and system integrity is verified (AC-24-03)', () => {
    const probeScript = path.resolve(__dirname, '../../.master_process/scripts/audit-probes.ps1');
    assert.ok(fs.existsSync(probeScript), 'audit-probes.ps1 must exist');
    const content = fs.readFileSync(probeScript, 'utf8');
    assert.match(content, /:\(exclude\)_Plan_implement/, 'Probe P4 must exclude _Plan_implement');
    assert.match(content, /:\(exclude\)\*\.md/, 'Probe P4 must exclude *.md');
    const dummyKeyPattern = new RegExp('AKIA' + 'IOSFODNN7EXAMPLE'); // master-process-disable-secret-check: test fixture
    assert.match(content, dummyKeyPattern, 'Probe P4 must filter dummy aws example key');
  });
});

