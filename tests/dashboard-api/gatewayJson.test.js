/**
 * tests/dashboard-api/gatewayJson.test.js
 * Unit tests for core/ai/gateway/json.js (AI17-04).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { extractJson, validateShape } = require('../../core/ai/gateway/json');

test('gatewayJson: bóc tách JSON bọc trong markdown code block ```json', () => {
  const raw = 'Đây là kết quả AI trả về:\n```json\n{\n  "title": "Sample test",\n  "count": 5\n}\n```\nHy vọng đúng yêu cầu!';
  const extracted = extractJson(raw);
  assert.deepEqual(extracted, { title: 'Sample test', count: 5 });
});

test('gatewayJson: bóc tách JSON mảng gốc bọc trong code block không nhãn', () => {
  const raw = '```\n[{"id": 1}, {"id": 2}]\n```';
  const extracted = extractJson(raw);
  assert.deepEqual(extracted, [{ id: 1 }, { id: 2 }]);
});

test('gatewayJson: xử lý chính xác dấu ngoặc nhọn nằm trong chuỗi ký tự', () => {
  const raw = '{"message": "Kiểm tra {ngoặc} và [mảng] trong chuỗi", "valid": true}';
  const extracted = extractJson(raw);
  assert.equal(extracted.message, 'Kiểm tra {ngoặc} và [mảng] trong chuỗi');
  assert.equal(extracted.valid, true);
});

test('gatewayJson: validateShape kiểm tra type, required, và properties', () => {
  const schema = {
    type: 'object',
    required: ['id', 'status'],
    properties: {
      id: { type: 'string' },
      status: { type: 'string', enum: ['pass', 'fail'] },
      score: { type: 'number' }
    }
  };

  const validData = { id: 'TC-01', status: 'pass', score: 95 };
  assert.equal(validateShape(schema, validData).valid, true);

  const missingReq = { id: 'TC-01' };
  const resMissing = validateShape(schema, missingReq);
  assert.equal(resMissing.valid, false);
  assert.match(resMissing.error, /Missing required field "status"/);

  const invalidEnum = { id: 'TC-01', status: 'unknown' };
  const resEnum = validateShape(schema, invalidEnum);
  assert.equal(resEnum.valid, false);
  assert.match(resEnum.error, /must be one of/);
});
