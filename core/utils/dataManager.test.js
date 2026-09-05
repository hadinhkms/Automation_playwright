const test = require('node:test');
const assert = require('node:assert/strict');
const {
  listDatasets,
  jsonToCsv,
  csvToJson,
  generateDynamicValue,
  resolveDynamicValues,
  normalizeDatasetName,
  MAX_DATASET_BYTES,
} = require('./dataManager');

test('DataManager lists existing datasets', () => {
  const list = listDatasets();
  assert.ok(Array.isArray(list));
  assert.ok(list.some((d) => d.fileName === 'users.json'));
  assert.ok(list.some((d) => d.fileName === 'applyJobData.json'));
});

test('DataManager converts JSON array to CSV and back', () => {
  const original = [
    { fullName: 'Test User', otp: '1234', active: true },
    { fullName: 'Second User', otp: '5678', active: false },
  ];
  const csv = jsonToCsv(original);
  assert.ok(csv.includes('fullName,otp,active'));
  assert.ok(csv.includes('Test User,1234,true'));

  const parsed = csvToJson(csv);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].fullName, 'Test User');
  assert.equal(parsed[0].otp, 1234);
  assert.equal(parsed[0].active, true);
});

test('DataManager generates dynamic values correctly', () => {
  const phone = generateDynamicValue('{{random_phone}}');
  assert.match(phone, /^098\d{7}$/);

  const email = generateDynamicValue('{{random_email}}');
  assert.match(email, /^autotest_\d+_\d+@example\.com$/);

  const resolved = resolveDynamicValues({
    phone: '{{random_phone}}',
    user: '{{random_name}}',
    nested: { email: '{{random_email}}' },
  });

  assert.notEqual(resolved.phone, '{{random_phone}}');
  assert.notEqual(resolved.nested.email, '{{random_email}}');
});

test('DataManager rejects malformed CSV and oversized input', () => {
  assert.throws(() => csvToJson('name,value\n"broken,value'), /chưa đóng/);
  assert.throws(() => csvToJson(`name\n${'x'.repeat(MAX_DATASET_BYTES)}`), /1 MB/);
  assert.throws(() => normalizeDatasetName('../outside.json'), /không hợp lệ/);
});
