/**
 * dashboard/services/runnerArgs.js
 * Hàm thuần dựng đối số cho `playwright test` (CONTRACT script-picker §2.2):
 *  - specArg: đối số vị trí của Playwright là REGEX không phân biệt hoa thường, khớp chuỗi con trên ĐƯỜNG DẪN
 *    TUYỆT ĐỐI của file. Nên mỗi spec được dựng từ đường dẫn tuyệt đối (realpath của gốc dự án + spec), escape,
 *    neo `^…$` (không khớp `tests/sub/tests/e2e/a.spec.js` khi chọn `tests/e2e/a.spec.js`); `/` -> `[\\/]`
 *    chấp nhận cả `\` lẫn `/`. realpath vì macOS /var -> /private/var: Playwright so với đường dẫn đã resolve.
 *  - tagGrep: regex grep sinh từ tags[] có ranh giới tag hai đầu (`@REQ` không khớp `@REQ-001`, `x@smoke` không khớp `@smoke`).
 *  - buildPlaywrightArgs + argsLength: đo độ dài dòng lệnh thật để chặn trước giới hạn CreateProcess (Windows).
 */
const fs = require('fs');
const path = require('path');

const MAX_ARGS_CHARS = 24000;
const MAX_SPECS = 200;
const MAX_TAGS = 20;

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function canonicalRoot(root) {
  try { return fs.realpathSync(root); } catch (_) { return path.resolve(root); }
}

function specArg(spec, root) {
  const absolute = path.join(canonicalRoot(root), ...String(spec).split('/')).replace(/\\/g, '/');
  return `^${escapeRegex(absolute).replace(/\//g, '[\\\\/]')}$`;
}

function tagGrep(tags) {
  return `(?<![\\w@-])(?:${tags.map(escapeRegex).join('|')})(?![\\w-])`;
}

function buildPlaywrightArgs(options, uiMode = false, root = process.cwd()) {
  const args = ['test'];
  if (Array.isArray(options.specs) && options.specs.length > 0) args.push(...options.specs.map((s) => specArg(s, root)));
  else if (options.spec && options.spec !== 'all') args.push(specArg(options.spec, root));

  if (Array.isArray(options.projects) && options.projects.length > 0) {
    for (const proj of options.projects) args.push(`--project=${proj}`);
  } else if (options.project && options.project !== 'all') {
    args.push(`--project=${options.project}`);
  }
  if (options.grep) args.push('--grep', options.grep);
  if (uiMode) args.push('--ui');
  else if (options.headed) args.push('--headed');
  return args;
}

/** Độ dài dòng lệnh: tổng độ dài các đối số + 1 khoảng trắng mỗi đối số (giống cách CreateProcess đếm). */
const argsLength = (args) => args.reduce((sum, arg) => sum + String(arg).length + 1, 0);

module.exports = { MAX_ARGS_CHARS, MAX_SPECS, MAX_TAGS, escapeRegex, specArg, tagGrep, buildPlaywrightArgs, argsLength };
