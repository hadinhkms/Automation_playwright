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

/**
 * Trả về null khi đường dẫn không thể xác định an toàn: gặp symlink không resolve được
 * (dangling hoặc vòng lặp) -> từ chối, không "leo lên cha" rồi coi tên link là thư mục thường.
 * Giới hạn: kiểm tra rồi mới dùng (TOCTOU) — symlink có thể bị đổi giữa lúc check và lúc chạy lệnh;
 * guard chỉ chặn cấu hình sai/tấn công tĩnh, không thay thế quyền truy cập hệ điều hành.
 */
function canonicalPath(target) {
  let current = path.resolve(target);
  const rest = [];
  for (;;) {
    try {
      return path.join(fs.realpathSync(current), ...rest.reverse());
    } catch (_) {
      try { fs.lstatSync(current); return null; } catch (__) { /* thật sự chưa tồn tại */ }
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
