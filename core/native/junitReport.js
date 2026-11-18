'use strict';

/**
 * Merges per-worker WDIO JUnit files into one report and reads its test cases back.
 * WDIO writes one file per worker (one per spec file); Gate 4 receipts need a single file.
 */

const fs = require('fs');
const path = require('path');

const SUITE_BLOCK = /<testsuite\b[\s\S]*?<\/testsuite>|<testsuite\b[^>]*\/>/g;
const CASE_BLOCK = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
const ATTR = /([\w:-]+)="([^"]*)"/g;

function decodeXml(text) {
  return String(text)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');
}

function attributes(text) {
  const out = {};
  let match = ATTR.exec(text);
  while (match) {
    out[match[1]] = decodeXml(match[2]);
    match = ATTR.exec(text);
  }
  ATTR.lastIndex = 0;
  return out;
}

/** Reads test cases with a status of passed, failed or skipped. */
function parseJunitCases(xml) {
  const cases = [];
  let match = CASE_BLOCK.exec(String(xml || ''));
  while (match) {
    const attrs = attributes(match[1]);
    const body = match[3] || '';
    let status = 'passed';
    if (/<(failure|error)\b/.test(body)) status = 'failed';
    else if (/<skipped\b/.test(body)) status = 'skipped';
    cases.push({ classname: attrs.classname || '', name: attrs.name || '', time: Number(attrs.time) || 0, status });
    match = CASE_BLOCK.exec(String(xml || ''));
  }
  CASE_BLOCK.lastIndex = 0;
  return cases;
}

function summarize(cases) {
  return {
    tests: cases.length,
    failures: cases.filter((c) => c.status === 'failed').length,
    skipped: cases.filter((c) => c.status === 'skipped').length,
  };
}

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** Combines the <testsuite> blocks of several JUnit documents under one <testsuites> root. */
function mergeJunitXml(documents, name = 'native') {
  const suites = documents.flatMap((xml) => String(xml || '').match(SUITE_BLOCK) || []);
  const totals = summarize(parseJunitCases(suites.join('\n')));
  const time = parseJunitCases(suites.join('\n')).reduce((sum, c) => sum + c.time, 0);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuites name="${escapeAttr(name)}" tests="${totals.tests}" failures="${totals.failures}" errors="0" skipped="${totals.skipped}" time="${time.toFixed(3)}">`,
    ...suites,
    '</testsuites>',
    '',
  ].join('\n');
}

/** Worker files of one run: junit-<runId>-<cid>.xml (the merged file has no cid). */
function workerFiles(dir, runId) {
  if (!fs.existsSync(dir)) return [];
  const prefix = `junit-${runId}-`;
  return fs.readdirSync(dir)
    .filter((n) => n.startsWith(prefix) && n.endsWith('.xml'))
    .sort()
    .map((n) => path.join(dir, n));
}

/**
 * Writes junit-<runId>.xml from the worker files and removes them.
 * Returns the merged path, or '' when the run produced no worker file.
 */
function mergeRunReports(dir, runId, target = path.join(dir, `junit-${runId}.xml`)) {
  const parts = workerFiles(dir, runId).filter((p) => path.resolve(p) !== path.resolve(target));
  if (parts.length === 0) return fs.existsSync(target) ? target : '';
  const xml = mergeJunitXml(parts.map((p) => fs.readFileSync(p, 'utf8')), `native-${runId}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, xml, 'utf8');
  parts.forEach((p) => fs.rmSync(p, { force: true }));
  return target;
}

module.exports = { parseJunitCases, mergeJunitXml, mergeRunReports, summarize, workerFiles };
