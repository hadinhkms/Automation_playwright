#!/usr/bin/env node
'use strict';

/**
 * scripts/run-unit-tests.js
 * Cross-platform recursive unit test runner for core/, dashboard/, scripts/, and tools/.
 * Avoids Node 22 Windows bare-directory resolution errors when invoking `node --test <dir>`.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const TARGET_DIRS = ['core', 'dashboard', 'scripts', 'tools'];

function collectTests(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTests(full, acc);
    } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
      acc.push(full);
    }
  }
  return acc;
}

const files = [];
for (const sub of TARGET_DIRS) {
  collectTests(path.join(ROOT, sub), files);
}
files.sort();

if (!files.length) {
  console.error('Không tìm thấy file unit test (*.test.js) nào trong core/, dashboard/, scripts/, tools/.');
  process.exit(1);
}

const extraArgs = process.argv.slice(2);
const result = spawnSync(process.execPath, ['--test', ...extraArgs, ...files], {
  cwd: ROOT,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);

