/**
 * dashboard/services/runnerArgs.js
 * Hàm thuần dựng đối số cho `playwright test` (CONTRACT script-picker §2.2):
 *  - specArg: đối số vị trí của Playwright là REGEX không phân biệt hoa thường, khớp chuỗi con, nên mỗi spec
 *    được escape rồi neo cuối (`a.spec.js$` không còn khớp `xa.spec.js`); `/` -> `[\\/]` chấp nhận cả `\` lẫn `/`.
 *  - tagGrep: regex grep sinh từ tags[] có ranh giới tag (`@REQ` không khớp `@REQ-001`).
 *  - buildPlaywrightArgs + argsLength: đo độ dài dòng lệnh thật để chặn trước giới hạn CreateProcess (Windows).
 */
const MAX_ARGS_CHARS = 24000;
const MAX_SPECS = 200;
const MAX_TAGS = 20;

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function specArg(spec) {
  return `${escapeRegex(spec).replace(/\//g, '[\\\\/]')}$`;
}

function tagGrep(tags) {
  return `(?:${tags.map(escapeRegex).join('|')})(?![\\w-])`;
}

function buildPlaywrightArgs(options, uiMode = false) {
  const args = ['test'];
  if (Array.isArray(options.specs) && options.specs.length > 0) args.push(...options.specs.map(specArg));
  else if (options.spec && options.spec !== 'all') args.push(specArg(options.spec));

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
