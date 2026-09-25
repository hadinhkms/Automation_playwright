/**
 * tests/setup/global.teardown.js
 * Dọn dẹp runtime-users còn sót sau khi toàn bộ test suite chạy xong.
 * Trường hợp: worker bị kill đột ngột (OOM, timeout) khiến fixture cleanupQueue
 * không kịp chạy teardown → file JSON user test còn sót trong test-results/runtime-users/.
 */
const fs = require('fs');
const path = require('path');

const RUNTIME_USERS_DIR = path.join(process.cwd(), 'test-results', 'runtime-users');
const MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 giờ — file cũ hơn chắc chắn là orphan

module.exports = async function globalTeardown() {
  if (!fs.existsSync(RUNTIME_USERS_DIR)) return;

  const now = Date.now();
  let cleaned = 0;

  try {
    const files = fs.readdirSync(RUNTIME_USERS_DIR);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(RUNTIME_USERS_DIR, file);
      try {
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > MAX_AGE_MS) {
          fs.unlinkSync(filePath);
          cleaned++;
        }
      } catch (err) {
        // File có thể đã bị xóa bởi worker khác — bỏ qua
      }
    }

    if (cleaned > 0) {
      console.log(`[globalTeardown] Đã dọn ${cleaned} file runtime-user orphan.`);
    }
  } catch (err) {
    console.warn(`[globalTeardown] Lỗi khi dọn dẹp runtime-users: ${err.message}`);
  }
};
