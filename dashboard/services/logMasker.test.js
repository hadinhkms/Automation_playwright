'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createLogMasker, FLUSH_MS } = require('./logMasker');
const { createMasker } = require('./secretMask');

const collect = () => { const out = []; return { out, emit: (t) => out.push(t) }; };

test('a secret split across two chunks is still masked (the partial line waits for its newline)', () => {
  const { out, emit } = collect();
  const m = createLogMasker(createMasker(), emit);
  m.push('call https://admin:Pa55w0');
  m.push('rdXYZ@host/db failed\nnext line\n');
  assert.equal(out.join(''), 'call https://***@host/db failed\nnext line\n');
});

test('complete lines are emitted at once; a trailing partial line is held then flushed (masked)', async () => {
  const { out, emit } = collect();
  const m = createLogMasker(createMasker(), emit);
  m.push('first\nsecond api_key=abcd1234efgh');
  assert.deepEqual(out, ['first\n'], 'only the complete line so far');
  await new Promise((r) => setTimeout(r, FLUSH_MS + 150));
  assert.equal(out.join(''), 'first\nsecond api_key=***', 'the timer flushes the partial line, masked');
});

test('flush() on process end emits the rest; a very long line without newline is not held forever', () => {
  const { out, emit } = collect();
  const m = createLogMasker(createMasker(), emit);
  m.push('tail Bearer abc.def');
  m.flush();
  assert.equal(out.join(''), 'tail Bearer ***');
  const big = collect();
  const m2 = createLogMasker(createMasker(), big.emit);
  m2.push('x'.repeat(9000));
  assert.equal(big.out.join('').length, 9000, 'over MAX_PENDING it is emitted without waiting');
});

test('createMasker snapshots secret env values once (no per-line environment/config read)', () => {
  process.env.SNAP_SECRET_KEY = 'snapshot-value-123';
  const mask = createMasker();
  delete process.env.SNAP_SECRET_KEY;
  assert.equal(mask('x snapshot-value-123 y'), 'x *** y');
  const started = process.hrtime.bigint();
  for (let i = 0; i < 20000; i += 1) mask('GET /a/b/c.js:12 expect(received).toBe(expected)');
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  assert.ok(ms < 1500, `20000 lines took ${ms} ms`);
});
