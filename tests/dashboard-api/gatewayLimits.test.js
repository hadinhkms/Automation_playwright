/**
 * tests/dashboard-api/gatewayLimits.test.js
 * Unit tests for core/ai/gateway/limits.js (AI17-14).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { acquireSlot, checkInputSize, MAX_CONCURRENT_CALLS } = require('../../core/ai/gateway/limits');

test('gatewayLimits: tối đa 2 slot đồng thời; slot thứ 3 trả về lỗi BUSY', () => {
  const slot1 = acquireSlot();
  assert.equal(slot1.acquired, true);

  const slot2 = acquireSlot();
  assert.equal(slot2.acquired, true);

  const slot3 = acquireSlot();
  assert.equal(slot3.acquired, false);
  assert.equal(slot3.error.code, 'BUSY');
  assert.match(slot3.error.message, /Đang có 2 tác vụ AI chạy/);

  // Giải phóng slot 1
  slot1.release();

  // Bây giờ có thể lấy lại slot
  const slotRetry = acquireSlot();
  assert.equal(slotRetry.acquired, true);

  // Dọn dẹp
  slot2.release();
  slotRetry.release();
});

test('gatewayLimits: từ chối TOO_LARGE khi nội dung vượt trần ký tự của tác vụ', () => {
  const longText = 'A'.repeat(15000);
  const messages = [{ role: 'user', content: longText }];

  const res = checkInputSize('inferTestCases', messages);
  assert.equal(res.ok, false);
  assert.equal(res.error.code, 'TOO_LARGE');
  assert.match(res.error.message, /Nội dung quá dài/);
});

test('gatewayLimits: chấp nhận nội dung trong giới hạn cho phép', () => {
  const okText = 'A'.repeat(5000);
  const messages = [{ role: 'user', content: okText }];

  const res = checkInputSize('inferTestCases', messages);
  assert.equal(res.ok, true);
  assert.equal(res.totalChars, 5000);
});
