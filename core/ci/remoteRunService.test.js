const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRemoteRun, createRemoteRunService } = require('./remoteRunService');

const config = {
  environments: { qc: {}, prod: {} },
  suites: { smoke: {} },
  github: { owner: 'owner', repo: 'repo', workflow: 'run.yml', ref: 'main', token: 'token' },
};

test('remote run validates whitelist and production confirmation', () => {
  assert.equal(validateRemoteRun({ suite: 'smoke', environment: 'qc' }, config).valid, true);
  assert.equal(validateRemoteRun({ suite: 'smoke', environment: 'prod' }, config).valid, false);
  assert.equal(validateRemoteRun({ suite: 'smoke', environment: 'prod', confirmProd: true }, config, { allowProd: true }).valid, true);
  assert.equal(validateRemoteRun({ suite: 'unknown', environment: 'qc' }, config).valid, false);
});

test('remote run dispatches with correlation id and deduplicates idempotency keys', async () => {
  let calls = 0;
  const service = createRemoteRunService({ config, now: () => 100000, dispatch: async (payload) => { calls += 1; assert.equal(payload.inputs.env, 'qc'); assert.ok(payload.inputs.correlation_id); } });
  const first = await service.dispatch({ suite: 'smoke', environment: 'qc', idempotencyKey: 'same-key' });
  const second = await service.dispatch({ suite: 'smoke', environment: 'qc', idempotencyKey: 'same-key' });
  assert.equal(calls, 1);
  assert.equal(second.idempotent, true);
  assert.equal(first.state, 'queued');
  assert.match(first.runUrl, /actions\/workflows\/run.yml/);
});
