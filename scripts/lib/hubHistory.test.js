/**
 * scripts/lib/hubHistory.test.js
 * Chạy tay: node --test scripts/lib/hubHistory.test.js
 *
 * Dựng repo git thật trong thư mục tạm — thăm dò lịch sử là thứ KHÔNG mock được cho có,
 * vì cái cần kiểm chính là hành vi của `git log -S` trên một file đã đổi qua nhiều commit.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { createHubHistoryProbe, classifyLostLines, isTrivialLine } = require('./hubHistory');

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
}

function makeRepo(revisions) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-history-'));
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'test@example.com']);
  git(root, ['config', 'user.name', 'Test']);
  revisions.forEach((content, i) => {
    fs.writeFileSync(path.join(root, 'doc.md'), content, 'utf8');
    git(root, ['add', '-A']);
    git(root, ['commit', '-q', '-m', `rev ${i}`]);
  });
  return root;
}

const withRepo = (revisions, fn) => {
  const root = makeRepo(revisions);
  try { return fn(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
};

test('dòng Hub từng có rồi bỏ đi vẫn bị nhận ra là bản cũ', () => {
  withRepo(['dòng gốc\nsẽ bị xoá\n', 'dòng gốc\nthay bằng dòng mới\n'], (root) => {
    const probe = createHubHistoryProbe(root);
    assert.equal(probe.available, true);
    assert.equal(probe.everHad('doc.md', 'sẽ bị xoá'), true, 'Hub từng có dòng này');
    assert.equal(probe.everHad('doc.md', 'vệ tinh tự viết dòng này'), false);
  });
});

test('chỉ tra đúng file được hỏi, không lẫn sang file khác', () => {
  withRepo(['chung\n'], (root) => {
    fs.writeFileSync(path.join(root, 'other.md'), 'chỉ có ở other\n', 'utf8');
    git(root, ['add', '-A']);
    git(root, ['commit', '-q', '-m', 'other']);
    const probe = createHubHistoryProbe(root);
    assert.equal(probe.everHad('other.md', 'chỉ có ở other'), true);
    assert.equal(probe.everHad('doc.md', 'chỉ có ở other'), false, 'không được tính chéo file');
  });
});

test('không phải repo git thì báo không dùng được, không ném lỗi', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'not-a-repo-'));
  try {
    const probe = createHubHistoryProbe(dir);
    assert.equal(probe.available, false);
    assert.match(probe.reason, /git/i);
    assert.equal(probe.everHad('doc.md', 'bất kỳ'), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('clone nông bị từ chối thay vì âm thầm báo mọi dòng là nội dung riêng', () => {
  withRepo(['a\n', 'b\n', 'c\n'], (origin) => {
    const shallow = fs.mkdtempSync(path.join(os.tmpdir(), 'shallow-'));
    fs.rmSync(shallow, { recursive: true, force: true });
    execFileSync('git', ['clone', '-q', '--depth', '1', `file://${origin.split(path.sep).join('/')}`, shallow], {
      encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
    });
    try {
      const probe = createHubHistoryProbe(shallow);
      assert.equal(probe.shallow, true);
      assert.equal(probe.available, false, 'nông thì không đủ lịch sử để kết luận');
      assert.match(probe.reason, /fetch-depth/);
    } finally {
      fs.rmSync(shallow, { recursive: true, force: true });
    }
  });
});

const fakeProbe = (had) => ({ everHad: (_f, line) => had.includes(line), available: true });

test('chia đúng ba nhóm: bản cũ, dòng vụn, nội dung riêng', () => {
  const groups = classifyLostLines(
    'x.js',
    ['const cu = 1;', '}', 'const rieng = 2;', ');'],
    fakeProbe(['const cu = 1;']),
  );
  assert.deepEqual(groups.stale, ['const cu = 1;']);
  assert.deepEqual(groups.owned, ['const rieng = 2;']);
  assert.deepEqual(groups.trivial, ['}', ');']);
});

test('mất khả năng tra lịch sử thì mọi dòng thành nội dung riêng — lùi về phía an toàn', () => {
  const dead = { everHad: () => false, available: false };
  const groups = classifyLostLines('x.js', ['a = 1;', 'b = 2;'], dead);
  assert.equal(groups.owned.length, 2, 'thiếu thông tin thì phải chặn, không được cho qua');
  assert.equal(groups.stale.length, 0);
});

test('dòng vụn được nhận diện theo số ký tự có nghĩa', () => {
  for (const t of ['}', '  );  ', '---', '\t{']) assert.equal(isTrivialLine(t), true, t);
  for (const t of ['const a=1;', '# Tiêu đề']) assert.equal(isTrivialLine(t), false, t);
});
