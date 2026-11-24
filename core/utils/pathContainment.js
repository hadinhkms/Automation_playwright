/**
 * core/utils/pathContainment.js
 * Nguồn duy nhất cho canonicalPath (resolve symlink) và kiểm tra "nằm trong thư mục cho phép", dùng cho
 * whitelist project của Master Process và cho mọi thao tác xoá file (script, dataset, fixture).
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


/**
 * Ném lỗi 403 nếu `targetPath` (sau khi resolve symlink) không nằm trong `baseDir` (cũng đã resolve),
 * hoặc nếu có symlink không resolve được (dangling/vòng lặp). Symlink trong thư mục trỏ RA NGOÀI bị từ chối.
 */
function assertInsideDir(targetPath, baseDir, label = 'Đường dẫn') {
  const target = canonicalPath(targetPath);
  const base = canonicalPath(baseDir);
  const inside = target && base && (target === base || target.startsWith(base + path.sep));
  if (!inside) {
    const err = new Error(`${label} nằm ngoài thư mục cho phép hoặc đi qua symlink không an toàn.`);
    err.statusCode = 403;
    throw err;
  }
}

module.exports = { canonicalPath, assertInsideDir };
