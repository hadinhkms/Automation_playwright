'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { pullUpstreamQaSkills } = require('./qaUpstreamSync');

test('pullUpstreamQaSkills hút toàn bộ skill từ QA Hub sang Automation Hub và giữ nguyên skill nội bộ', () => {
  const fakeQaHub = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-qa-hub-'));
  const fakeAutoHub = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-auto-hub-'));

  try {
    // 1. Tạo skill ở QA Hub kèm thư mục con references/
    fs.mkdirSync(path.join(fakeQaHub, '.agents', 'skills', 'qa-logic-gaps', 'references'), { recursive: true });
    fs.writeFileSync(path.join(fakeQaHub, '.agents', 'skills', 'qa-logic-gaps', 'SKILL.md'), '# Logic Gaps v2\n', 'utf8');
    fs.writeFileSync(
      path.join(fakeQaHub, '.agents', 'skills', 'qa-logic-gaps', 'references', 'catalog.md'),
      '# Catalog\n',
      'utf8',
    );

    // 2. Tạo skill nội bộ sẵn có ở Automation Hub
    fs.mkdirSync(path.join(fakeAutoHub, '.agents', 'skills', 'playwright_test'), { recursive: true });
    fs.writeFileSync(path.join(fakeAutoHub, '.agents', 'skills', 'playwright_test', 'SKILL.md'), '# Local PW Skill\n', 'utf8');

    // 3. Chạy lần 1: cập nhật 2 file mới
    const res1 = pullUpstreamQaSkills({ hubRoot: fakeAutoHub, qaHubRoot: fakeQaHub });
    assert.equal(res1.available, true);
    assert.equal(res1.updatedCount, 2);
    assert.deepEqual(res1.syncedSkills, ['qa-logic-gaps']);
    assert.equal(
      fs.readFileSync(path.join(fakeAutoHub, '.agents', 'skills', 'qa-logic-gaps', 'SKILL.md'), 'utf8'),
      '# Logic Gaps v2\n',
    );
    assert.equal(
      fs.readFileSync(path.join(fakeAutoHub, '.agents', 'skills', 'qa-logic-gaps', 'references', 'catalog.md'), 'utf8'),
      '# Catalog\n',
    );
    // Skill nội bộ không bị đụng tới
    assert.equal(
      fs.readFileSync(path.join(fakeAutoHub, '.agents', 'skills', 'playwright_test', 'SKILL.md'), 'utf8'),
      '# Local PW Skill\n',
    );

    // 4. Chạy lần 2 (idempotent): 0 file thay đổi
    const res2 = pullUpstreamQaSkills({ hubRoot: fakeAutoHub, qaHubRoot: fakeQaHub });
    assert.equal(res2.updatedCount, 0);
  } finally {
    fs.rmSync(fakeQaHub, { recursive: true, force: true });
    fs.rmSync(fakeAutoHub, { recursive: true, force: true });
  }
});

test('pullUpstreamQaSkills xử lý an toàn khi máy không có QA Hub', () => {
  const fakeAutoHub = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-auto-hub-noqa-'));
  try {
    const res = pullUpstreamQaSkills({ hubRoot: fakeAutoHub, qaHubRoot: null });
    assert.equal(res.available, false);
    assert.equal(res.updatedCount, 0);
  } finally {
    fs.rmSync(fakeAutoHub, { recursive: true, force: true });
  }
});

