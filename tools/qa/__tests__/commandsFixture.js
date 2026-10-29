'use strict';

/**
 * Shared fixture & helpers cho bộ unit test commands*.test.js của tools/qa.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function makeRepo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-commands-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
  }
  return root;
}

const withRepo = (files, fn) => {
  const root = makeRepo(files);
  try {
    return fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

/**
 * Dựng một bản ghi test giống hệt hình dạng mà sources.js trả về, hỗ trợ cả
 * allTcIds/allAcIds (multi-TC) và assertionProfile/onlyNavigationAssert.
 */
function spec(title, opts = {}) {
  const m = /^(TC-\d{3})\s*-\s*(AC-\d{3})\b/.exec(title);
  const reqId = 'reqId' in opts ? opts.reqId : 'REQ-001';
  const file = opts.file || 'playwright/tests/login.spec.js';
  return {
    title,
    tcId: m ? m[1] : null,
    acId: m ? m[2] : null,
    allTcIds: [...new Set([...title.matchAll(/\bTC-(\d{3})\b/g)].map((match) => match[0]))],
    allAcIds: [...new Set([...title.matchAll(/\bAC-(\d{3})\b/g)].map((match) => match[0]))],
    reqId,
    tags: 'tags' in opts ? opts.tags : reqId ? [reqId] : [],
    file,
    path: file,
    isSetup: Boolean(opts.isSetup),
    line: opts.line || 7,
    assertionCount: 'assertionCount' in opts ? opts.assertionCount : 1,
    assertionProfile: opts.assertionProfile || null,
    onlyNavigationAssert: Boolean(opts.onlyNavigationAssert),
    isSkipped: Boolean(opts.isSkipped),
    missingAwaits: opts.missingAwaits || [],
  };
}

const stubAutomated = (tests, extra = {}) => () => ({
  tests,
  error: null,
  emptyResult: false,
  emptyMessage: null,
  ignoredCount: 0,
  ignorePrefixes: [],
  ...extra,
});

const opts = (tests, extra) => ({ loadAutomated: stubAutomated(tests, extra) });

const only = (findings, kind) => findings.filter((f) => f.kind === kind);
const kindSet = (findings) => new Set(findings.map((f) => f.kind));

function mustReplace(text, from, to) {
  if (!text.includes(from)) throw new Error(`Fixture không còn chứa: ${from}`);
  return text.replace(from, to);
}

const TC_002_YES = '| TC-002 | Yes | `tests/login.spec.js` | P1 |';

const REQ = `---
id: REQ-001
title: Đăng nhập
status: Ready for Test
version: 1.0
risk: High
owner: Auth squad
test_cases: test-cases/REQ-001.md
---

# REQ-001: Đăng nhập

## Acceptance criteria

### AC-001: Đăng nhập thành công với credential hợp lệ

**Given** tài khoản active **When** nhập đúng **Then** vào dashboard

### AC-002: Sai mật khẩu bị từ chối

**Given** tài khoản active **When** nhập sai password **Then** hiện lỗi chung

## Rules and validation

| Field/rule | Valid | Invalid | Boundary | Expected | Test cases |
|---|---|---|---|---|---|
| Email | \`a@b.com\` | \`not-an-email\` | 254, 255 | Lỗi tại trường | TC-002 |
`;

const TC = `# Test cases: REQ-001

## Traceability

| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
|---|---|---|---|---|---|
| REQ-001 | AC-001 | TC-001 | Yes | \`tests/login.spec.js\` | P0 |
| REQ-001 | AC-002 | TC-002 | Yes | \`tests/login.spec.js\` | P1 |

## Test cases

### TC-001: Đăng nhập thành công

### TC-002: Sai mật khẩu
`;

const DOCS = { 'requirements/REQ-001.md': REQ, 'test-cases/REQ-001.md': TC };

const CLEAN_TESTS = [
  spec('TC-001 - AC-001 vào được dashboard', { line: 7 }),
  spec('TC-002 - AC-002 hiện lỗi chung', { line: 15 }),
];

const MANIFEST_OK = JSON.stringify({
  ship: [{ path: 'templates', reason: 'x' }],
  seed: [{ path: 'qa.config.json', reason: 'x' }],
  own: [
    { path: 'requirements', reason: 'x' },
    { path: 'test-cases', reason: 'x' },
  ],
});

const MULTI_TC_TESTS = [
  spec('TC-001 - AC-001 đăng nhập rồi thử sai mật khẩu [TC-001 TC-002]', { line: 7 }),
];

module.exports = {
  makeRepo,
  withRepo,
  spec,
  stubAutomated,
  opts,
  only,
  kindSet,
  mustReplace,
  TC_002_YES,
  REQ,
  TC,
  DOCS,
  CLEAN_TESTS,
  MANIFEST_OK,
  MULTI_TC_TESTS,
};

