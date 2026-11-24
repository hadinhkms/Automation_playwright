/**
 * dashboard/services/projectPathGuard.js
 * Chuẩn hoá đường dẫn cho whitelist project của Master Process:
 *  - canonicalPath: resolve symlink (kể cả khi đích chưa tồn tại: resolve phần cha tồn tại gần nhất),
 *    để symlink nằm trong project nhưng trỏ ra ngoài không vượt qua whitelist.
 *  - isForeignDrivePath: `C:\Windows` / `C:/Windows` trên POSIX chỉ là tên tương đối, không bao giờ
 *    là project hợp lệ -> bị từ chối thay vì lọt vào "bên trong root".
 */
const fs = require('fs');
const path = require('path');

function canonicalPath(target) {
  let current = path.resolve(target);
  const rest = [];
  for (;;) {
    try {
      return path.join(fs.realpathSync(current), ...rest.reverse());
    } catch (_) {
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(target);
      rest.push(path.basename(current));
      current = parent;
    }
  }
}

function isForeignDrivePath(target) {
  return process.platform !== 'win32' && /^[A-Za-z]:[\\/]/.test(String(target || ''));
}

module.exports = { canonicalPath, isForeignDrivePath };
