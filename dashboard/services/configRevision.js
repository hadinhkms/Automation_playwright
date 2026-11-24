/**
 * dashboard/services/configRevision.js
 * Revision (sha1) của file cấu hình dashboard đang dùng, tính từ NỘI DUNG file đã lưu: mọi đường ghi
 * (PUT /api/settings hay sửa tay) đều tự đổi revision, không cần cập nhật riêng.
 * Dùng cho optimistic concurrency: PUT kèm `baseRevision`, lệch -> 409 CONFIG_CONFLICT.
 */
const crypto = require('crypto');
const fs = require('fs');
const { getResolvedConfigPath, getDashboardConfig } = require('../../core/config/dashboardConfig');

function currentRevision() {
  const cfgPath = getResolvedConfigPath();
  // Chưa có file (đang chạy bằng cấu hình mặc định): băm cấu hình hiệu lực để vẫn có revision ổn định.
  const content = fs.existsSync(cfgPath) ? fs.readFileSync(cfgPath) : JSON.stringify(getDashboardConfig());
  return crypto.createHash('sha1').update(content).digest('hex');
}

/** baseRevision từ body, hoặc header If-Match (bỏ dấu nháy và tiền tố W/). Trả undefined nếu không có. */
function requestedBaseRevision(body, headers) {
  if (body && typeof body.baseRevision === 'string' && body.baseRevision) return body.baseRevision;
  const ifMatch = headers && headers['if-match'];
  if (typeof ifMatch === 'string' && ifMatch.trim()) return ifMatch.trim().replace(/^W\//, '').replace(/^"|"$/g, '');
  return undefined;
}

const CONFLICT = {
  ok: false,
  code: 'CONFIG_CONFLICT',
  error: 'Cấu hình đã được thay đổi ở nơi khác. Hãy tải lại trước khi lưu.',
};

module.exports = { currentRevision, requestedBaseRevision, CONFLICT };
