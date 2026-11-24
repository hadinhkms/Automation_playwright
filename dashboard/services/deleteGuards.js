/**
 * dashboard/services/deleteGuards.js
 * Chốt chặn symlink cho các thao tác XOÁ file (script, dataset, fixture): file/đường dẫn sau khi resolve
 * symlink phải nằm trong thư mục cho phép, symlink dangling/vòng lặp bị từ chối (403). Gọi ngay trước khi xoá,
 * ở route, vì các service xoá cũ là file legacy vượt trần dòng. Giới hạn TOCTOU: xem core/utils/pathContainment.js.
 */
const fs = require('fs');
const path = require('path');
const { assertInsideDir } = require('../../core/utils/pathContainment');
const { findCustomFixturePath } = require('../../core/generator/objectRepository');

const exists = (p) => Boolean(fs.lstatSync(p, { throwIfNoEntry: false }));

/** Dùng cùng quy tắc xác định root với core/utils/dataManager (QA_PROJECT_ROOT, nếu không thì thư mục engine). */
function dataDir() {
  const rootDir = process.env.QA_PROJECT_ROOT ? path.resolve(process.env.QA_PROJECT_ROOT) : path.resolve(__dirname, '../..');
  return path.join(rootDir, 'data');
}

function guardScriptDelete(spec, root) {
  const value = String(spec || '').replace(/\\/g, '/');
  // Đường dẫn sai dạng để service tự từ chối với thông báo riêng.
  if (path.isAbsolute(value) || value.includes('..') || !value.startsWith('tests/')) return;
  const fullPath = path.resolve(root, value);
  if (exists(fullPath)) assertInsideDir(fullPath, path.resolve(root, 'tests'), 'Kịch bản');
}

function guardDatasetDelete(fileName) {
  const safeName = path.basename(String(fileName || '').trim());
  if (!safeName) return;
  const fullPath = path.join(dataDir(), safeName);
  if (exists(fullPath)) assertInsideDir(fullPath, dataDir(), 'Tệp dữ liệu');
}

function guardFixtureDelete(name, root) {
  const info = findCustomFixturePath(name, root);
  if (info) assertInsideDir(info.fullPath, path.dirname(info.fullPath), 'Fixture');
}

module.exports = { guardScriptDelete, guardDatasetDelete, guardFixtureDelete };
