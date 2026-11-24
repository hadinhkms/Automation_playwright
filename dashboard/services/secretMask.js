/**
 * dashboard/services/secretMask.js
 * Che bí mật trong văn bản lỗi trước khi lưu vào lịch sử/trả qua API. Che theo MẪU (token, header, URL, JWT...) và
 * theo GIÁ TRỊ (registrationBearerToken, biến môi trường có tên TOKEN|SECRET|KEY|PASSWORD|WEBHOOK dài >= 8).
 * Thà che thừa còn hơn lộ: header cookie/authorization bị che đến hết dòng.
 */
const { getDashboardConfig } = require('../../core/config/dashboardConfig');

const MIN_SECRET_LENGTH = 8;
const SECRET_ENV_NAME = /TOKEN|SECRET|KEY|PASSWORD|WEBHOOK/i;
const ANSI = /\u001b\[[0-9;]{0,20}m/g;

// Mọi lượng từ đều CÓ CẬN và không có hai nhóm co giãn kề nhau: không backtrack bậc hai (ReDoS, Gate 3 Z-1).
// Mẫu chạy trên MỌI dòng log của run, nên một dòng xấu do trang đích in ra không được phép treo server.
const PATTERNS = [
  // Discord webhook URL (chứa token ngay trong đường dẫn)
  [/https?:\/\/(?:[\w-]{1,64}\.)?discord(?:app)?\.com\/api\/webhooks\/\d{1,32}\/[\w-]{1,256}/gi, '***'],
  // header nhạy cảm: che đến hết dòng
  [/\b((?:proxy-)?authorization|x-api-key|api-key|x-auth-token|set-cookie|cookie)(\s{0,32}[:=]\s{0,32}).*$/gim, '$1$2***'],
  // URL userinfo: //user:pass@host hoặc //token@host
  [/(\/\/)[^\s/@]{1,512}@/g, '$1***@'],
  // JWT, GitHub, Slack
  [/\beyJ[\w-]{1,2048}\.[\w-]{1,2048}\.[\w-]{1,2048}/g, '***'],
  [/\b(?:gh[pousr]_[A-Za-z0-9]{20,255}|github_pat_[A-Za-z0-9_]{20,255}|xox[abprso]-[A-Za-z0-9-]{10,255})/g, '***'],
  // Bearer (kể cả "Bearer:" / "bearer=") và Basic
  [/\bbearer[\s:=]{1,20}[A-Za-z0-9._~+/=-]{1,2048}/gi, 'Bearer ***'],
  [/\bbasic\s{1,20}[A-Za-z0-9+/=]{6,2048}/gi, 'Basic ***'],
  // key=value / key: value cho tên chứa api_key, token, secret, password, passwd, pwd (cả trong query string và JSON)
  [/([\w.-]{0,64}(?:api[_-]?key|token|secret|passw(?:or)?d|pwd)[\w.-]{0,64})(["']?\s{0,32}[:=]\s{0,32})("[^"]{0,2048}"|'[^']{0,2048}'|[^\s&,;"']{1,2048})/gi, '$1$2***'],
];

function secretValues() {
  const values = Object.entries(process.env)
    .filter(([name, value]) => SECRET_ENV_NAME.test(name) && String(value || '').length >= MIN_SECRET_LENGTH)
    .map(([, value]) => String(value));
  try {
    const token = getDashboardConfig().api.registrationBearerToken || '';
    if (token.length > 0) values.push(token);
  } catch (_) { /* config unreadable: patterns still apply */ }
  return [...new Set(values)].sort((a, b) => b.length - a.length);
}

const MAX_SEGMENT = 16 * 1024;

function applyPatterns(text, values) {
  let out = text;
  for (const value of values) out = out.split(value).join('***');
  for (const [pattern, replacement] of PATTERNS) out = out.replace(pattern, replacement);
  return out;
}

/**
 * Chụp một lần danh sách giá trị bí mật (env + registrationBearerToken) rồi trả hàm che: dùng cho log trực tiếp
 * (mỗi dòng gọi một lần, không đọc lại cấu hình/ môi trường mỗi dòng). Giá trị đổi sau lúc chụp không được che.
 * Văn bản dài hơn MAX_SEGMENT được cắt tại khoảng trắng thành các đoạn <= 16 KB rồi che từng đoạn; một chuỗi liền
 * không có khoảng trắng dài hơn 16 KB (blob, không phải văn bản log có nghĩa) bị THAY bằng ***(N ký tự) chứ không
 * phát nguyên văn.
 */
function createMasker() {
  const values = secretValues();
  return (text) => {
    const input = String(text ?? '').replace(ANSI, '');
    if (input.length <= MAX_SEGMENT) return applyPatterns(input, values);
    let out = '';
    let segment = '';
    for (const piece of input.split(/(\s+)/)) {
      if (piece.length > MAX_SEGMENT) {
        out += applyPatterns(segment, values);
        segment = '';
        out += `***(${piece.length} ký tự)`;
      } else if (segment.length + piece.length > MAX_SEGMENT) {
        out += applyPatterns(segment, values);
        segment = piece;
      } else {
        segment += piece;
      }
    }
    return out + applyPatterns(segment, values);
  };
}

const maskSecrets = (text) => createMasker()(text);

module.exports = { maskSecrets, createMasker, MIN_SECRET_LENGTH };
