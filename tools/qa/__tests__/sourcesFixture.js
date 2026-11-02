'use strict';

/**
 * Shared fixture & helpers cho bộ unit test sources*.test.js của tools/qa.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function makeRepo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-sources-'));
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

function lineOf(text, needle) {
  const i = text.split('\n').findIndex((l) => l.includes(needle));
  if (i === -1) throw new Error(`Fixture không còn dòng nào chứa: ${needle}`);
  return i + 1;
}

const asWindowsFile = (text) => `\uFEFF${text.replace(/\n/g, '\r\n')}`;

const REQ_FULL = `---
id: REQ-001
title: "Đăng nhập bằng email và mật khẩu"
status: Ready for Test
version: 1.0
risk: High
owner: Auth squad
slug: sign-in
test_cases: test-cases/REQ-001.md
---

# REQ-001: Đăng nhập

## Acceptance criteria

### AC-001: Đăng nhập thành công với credential hợp lệ

**Given** tài khoản active **Then** vào dashboard

### AC-002 - Credential sai bị từ chối

**Given** ở /login **Then** hiện lỗi chung

#### AC-003 Email sai định dạng bị chặn ở client

### AC-004

## Rules and validation

| Field/rule | Valid | Invalid | Boundary | Expected | Test cases |
|---|---|---|---|---|---|
| Email | \`a@b.com\` | \`not-an-email\` | 254, 255 | Lỗi tại trường | TC-004, TC-012 |
| Password | 8-64 ký tự | rỗng | 8, 64, 65 | Lỗi validation | |

## Non-functional expectations

| Mục | Giá trị |
|---|---|
| Performance | p95 < 1s |
`;

const TC_FULL = `# Test cases: REQ-001

## Traceability

| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
|---|---|---|---|---|---|
| REQ-001 | AC-001 | TC-001 | Yes | \`tests/auth/login.spec.ts\` | P0 |
| REQ-001 | AC-002 | TC-002 | No | - | P1 |
| REQ-001 | AC-002 | TC-003 | Candidate | - |  P2  |

## Test cases

### TC-001: Đăng nhập thành công

### TC-002 - Sai mật khẩu

#### TC-003 Khoá tài khoản

## Case không automation

| Test case | Lý do | Bù đắp bằng gì |
|---|---|---|
| TC-002 | Cần tua thời gian server, staging chưa hỗ trợ | Test ở tầng API |
| TC-003 |  | Chưa có |
`;

function traceabilityFile(automation) {
  return `# TC

## Traceability

| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
|---|---|---|---|---|---|
| REQ-001 | AC-001 | TC-001 | ${automation} | - | P0 |
`;
}

module.exports = {
  makeRepo,
  withRepo,
  lineOf,
  asWindowsFile,
  REQ_FULL,
  TC_FULL,
  traceabilityFile,
};

