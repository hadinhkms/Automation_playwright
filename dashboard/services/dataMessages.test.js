const test = require('node:test');
const assert = require('node:assert/strict');
const { accentDataMessage } = require('./dataMessages');

test('adds diacritics to the unaccented dataManager messages', () => {
  assert.equal(accentDataMessage('File a.json da ton tai trong thu muc data/'), 'File a.json đã tồn tại trong thư mục data/');
  assert.equal(accentDataMessage('File a.json khong ton tai trong thu muc data/'), 'File a.json không tồn tại trong thư mục data/');
});

test('leaves already accented or non-string messages alone', () => {
  assert.equal(accentDataMessage('Tệp dữ liệu vượt quá giới hạn 1 MB.'), 'Tệp dữ liệu vượt quá giới hạn 1 MB.');
  assert.equal(accentDataMessage(undefined), undefined);
});
