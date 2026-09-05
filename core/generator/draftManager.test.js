const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  saveDraft,
  getDraft,
  listDrafts,
  deleteDraft,
  cleanupDraft,
  resolveDraftDir,
} = require('./draftManager');

const TEST_ROOT = path.join(__dirname, '../../.tmp/test_drafts_dir');

test.beforeEach(() => {
  if (fs.existsSync(TEST_ROOT)) {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_ROOT, { recursive: true });
});

test.after(() => {
  if (fs.existsSync(TEST_ROOT)) {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  }
});

test('saveDraft creates an atomic script draft and getDraft retrieves it', () => {
  const draftData = {
    scenarioName: 'Quy trình ứng tuyển nhanh không cần CV',
    platform: 'desktop',
    featureName: 'Ứng tuyển nhanh',
    steps: [{ type: 'When', text: 'Bấm nộp hồ sơ' }],
  };

  const saved = saveDraft({
    type: 'script',
    id: 'script_draft_01',
    data: draftData,
    rootDir: TEST_ROOT,
  });

  assert.equal(saved.id, 'script_draft_01');
  assert.equal(saved.type, 'script');
  assert.deepEqual(saved.data, draftData);
  assert.ok(saved.createdAt);
  assert.ok(saved.updatedAt);

  const retrieved = getDraft({
    type: 'script',
    id: 'script_draft_01',
    rootDir: TEST_ROOT,
  });

  assert.ok(retrieved);
  assert.equal(retrieved.id, 'script_draft_01');
  assert.deepEqual(retrieved.data, draftData);
});

test('saveDraft creates a page draft and listDrafts returns items sorted by updatedAt', async () => {
  const page1 = saveDraft({
    type: 'page',
    id: 'page_draft_01',
    data: { title: 'Trang tìm kiếm', className: 'SearchPage', platform: 'desktop' },
    rootDir: TEST_ROOT,
  });

  // Chờ 10ms để đảm bảo updatedAt khác biệt
  await new Promise((resolve) => setTimeout(resolve, 15));

  const page2 = saveDraft({
    type: 'page',
    id: 'page_draft_02',
    data: { title: 'Trang ứng tuyển', className: 'ApplyPage', platform: 'mobile-web' },
    rootDir: TEST_ROOT,
  });

  const list = listDrafts({ type: 'page', rootDir: TEST_ROOT });
  assert.equal(list.length, 2);
  // page2 được lưu sau nên updatedAt mới hơn -> xếp trước
  assert.equal(list[0].id, 'page_draft_02');
  assert.equal(list[1].id, 'page_draft_01');
});

test('deleteDraft and cleanupDraft remove draft file cleanly', () => {
  saveDraft({
    type: 'script',
    id: 'to_delete_script',
    data: { scenarioName: 'Temporary' },
    rootDir: TEST_ROOT,
  });

  const beforeDelete = getDraft({ type: 'script', id: 'to_delete_script', rootDir: TEST_ROOT });
  assert.ok(beforeDelete);

  const res = deleteDraft({ type: 'script', id: 'to_delete_script', rootDir: TEST_ROOT });
  assert.equal(res.success, true);

  const afterDelete = getDraft({ type: 'script', id: 'to_delete_script', rootDir: TEST_ROOT });
  assert.equal(afterDelete, null);

  // Test cleanupDraft
  saveDraft({
    type: 'page',
    id: 'to_cleanup_page',
    data: { title: 'Temp' },
    rootDir: TEST_ROOT,
  });

  const cleanRes = cleanupDraft({ type: 'page', id: 'to_cleanup_page', rootDir: TEST_ROOT });
  assert.equal(cleanRes, true);
  assert.equal(getDraft({ type: 'page', id: 'to_cleanup_page', rootDir: TEST_ROOT }), null);
});

test('draftManager rejects invalid draft types', () => {
  assert.throws(
    () => saveDraft({ type: 'invalid_type', rootDir: TEST_ROOT }),
    /Loại bản nháp không hợp lệ/
  );
  assert.throws(
    () => resolveDraftDir('unknown', TEST_ROOT),
    /Loại bản nháp không hợp lệ/
  );
});
