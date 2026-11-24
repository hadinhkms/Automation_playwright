/**
 * dashboard/services/settingsMerge.js
 * PUT /api/settings từng phần (vd. picker chỉ gửi {suites}) không được làm mất các trường khác: normalize của core
 * xử lý một số trường thiếu như "rỗng" (branding.fontSize "14px" -> ""). Gộp sâu body vào cấu hình HIỆN CÓ trước khi
 * normalize. Các map có thể bị xoá khoá (environments, suites) được THAY THẾ nguyên khối, không gộp; mảng và giá trị
 * đơn thay thế; chỉ các nhóm cố định (branding, runtime(+viewport), api, artifacts, discord, server, qa, docs) gộp.
 */
const REPLACE_WHOLE = new Set(['environments', 'suites']);

// Z-5: JSON.parse tạo khoá "__proto__" thật; gán out["__proto__"] đổi prototype (ô nhiễm). Bỏ qua các khoá này.
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function mergeDeep(current, body) {
  const out = { ...current };
  for (const [key, value] of Object.entries(body)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    out[key] = isPlain(value) && isPlain(current[key]) ? mergeDeep(current[key], value) : value;
  }
  return out;
}

function mergeSettings(current, body) {
  const out = { ...current };
  for (const [key, value] of Object.entries(isPlain(body) ? body : {})) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    if (REPLACE_WHOLE.has(key) || !isPlain(value) || !isPlain(current[key])) out[key] = value;
    else out[key] = mergeDeep(current[key], value);
  }
  return out;
}

module.exports = { mergeSettings };
