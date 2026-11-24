/**
 * dashboard/services/secretMask.js
 * Che bí mật trong văn bản lỗi trước khi lưu vào lịch sử/trả qua API. Che theo MẪU (token, header, URL, JWT...) và
 * theo GIÁ TRỊ (registrationBearerToken, biến môi trường có tên TOKEN|SECRET|KEY|PASSWORD|WEBHOOK dài >= 8).
 * Thà che thừa còn hơn lộ: header cookie/authorization bị che đến hết dòng.
 */
const { getDashboardConfig } = require('../../core/config/dashboardConfig');

const MIN_SECRET_LENGTH = 8;
const SECRET_ENV_NAME = /TOKEN|SECRET|KEY|PASSWORD|WEBHOOK/i;
const ANSI = /\u001b\[[0-9;]*m/g;

const PATTERNS = [
  // Discord webhook URL (chứa token ngay trong đường dẫn)
  [/https?:\/\/(?:[\w-]+\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+/gi, '***'],
  // header nhạy cảm: che đến hết dòng
  [/\b((?:proxy-)?authorization|x-api-key|api-key|x-auth-token|set-cookie|cookie)(\s*[:=]\s*).*$/gim, '$1$2***'],
  // URL userinfo: //user:pass@host hoặc //token@host
  [/(\/\/)[^\s/@]+@/g, '$1***@'],
  // JWT, GitHub, Slack
  [/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, '***'],
  [/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[abprso]-[A-Za-z0-9-]{10,})/g, '***'],
  // Bearer (kể cả "Bearer:" / "bearer=") và Basic
  [/\bbearer\s*[:=]?\s*[A-Za-z0-9._~+/=-]+/gi, 'Bearer ***'],
  [/\bbasic\s+[A-Za-z0-9+/=]{6,}/gi, 'Basic ***'],
  // key=value / key: value cho tên chứa api_key, token, secret, password, passwd, pwd (cả trong query string)
  [/\b([\w.-]*(?:api[_-]?key|token|secret|passw(?:or)?d|pwd)[\w.-]*)(["']?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s&,;"']+)/gi, '$1$2***'],
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

/**
 * Chụp một lần danh sách giá trị bí mật (env + registrationBearerToken) rồi trả hàm che: dùng cho log trực tiếp
 * (mỗi dòng gọi một lần, không đọc lại cấu hình/ môi trường mỗi dòng). Giá trị đổi sau lúc chụp không được che.
 */
function createMasker() {
  const values = secretValues();
  return (text) => {
    let out = String(text ?? '').replace(ANSI, '');
    for (const value of values) out = out.split(value).join('***');
    for (const [pattern, replacement] of PATTERNS) out = out.replace(pattern, replacement);
    return out;
  };
}

const maskSecrets = (text) => createMasker()(text);

module.exports = { maskSecrets, createMasker, MIN_SECRET_LENGTH };
