/**
 * dashboard/services/projectPathGuard.js
 * Chuẩn hoá đường dẫn cho whitelist project của Master Process:
 *  - canonicalPath: resolve symlink (kể cả khi đích chưa tồn tại: resolve phần cha tồn tại gần nhất),
 *    để symlink nằm trong project nhưng trỏ ra ngoài không vượt qua whitelist.
 *  - isForeignDrivePath: `C:\Windows` / `C:/Windows` trên POSIX chỉ là tên tương đối, không bao giờ
 *    là project hợp lệ -> bị từ chối thay vì lọt vào "bên trong root".
 */
const { canonicalPath } = require('../../core/utils/pathContainment');

function isForeignDrivePath(target) {
  return process.platform !== 'win32' && /^[A-Za-z]:[\\/]/.test(String(target || ''));
}

module.exports = { canonicalPath, isForeignDrivePath };
