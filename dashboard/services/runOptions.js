/**
 * dashboard/services/runOptions.js
 * Xác thực body của POST /api/run (và /api/ui) — CONTRACT script-picker §2.2. Nguyên tắc: từ chối 400
 * rõ ràng thay vì lọc im lặng (trước đây spec không tồn tại bị bỏ qua rồi chạy TẤT CẢ).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getDashboardConfig, GREP_MAX_LENGTH } = require('../../core/config/dashboardConfig');
const { listSpecs, listSpecDetails, getPlaywrightProjects } = require('./specService');
const { getSpecProjects } = require('./specProjectsService');
const { getLastConfigError } = require('./playwrightConfigLoader');
const { MAX_ARGS_CHARS, MAX_SPECS, MAX_TAGS, tagGrep, buildPlaywrightArgs, argsLength } = require('./runnerArgs');

const present = (value) => value !== undefined && value !== null;
const mustBeArray = (value, field) => {
  if (present(value) && !Array.isArray(value)) throw new Error(`${field} phải là một mảng.`);
};

/** Chuỗi đường dẫn đã biết cần che: gốc dự án (đã/chưa resolve), home; cả dạng `/` lẫn `\\`. Dài trước để không che dở. */
function knownPaths(root) {
  const resolved = (() => { try { return fs.realpathSync(root); } catch (_) { return path.resolve(root); } })();
  const swap = (p) => [p, p.replace(/\\/g, '/'), p.replace(/\//g, '\\')];
  const project = [...new Set([resolved, path.resolve(root), String(root)].flatMap(swap))];
  const home = swap(os.homedir());
  return [...project.map((p) => [p, '<project>']), ...home.map((p) => [p, '~'])]
    .filter(([p]) => p.length > 1)
    .sort((x, y) => y[0].length - x[0].length);
}

/**
 * Dòng đầu của lỗi cấu hình, không lộ cấu trúc máy chủ: (1) thay các đường dẫn ĐÃ BIẾT (gốc dự án, home) bằng
 * <project>/~ bằng split/join, kể cả khi có dấu cách/ngoặc; (2) phần đường dẫn tuyệt đối còn lại chỉ giữ tên cuối
 * (đoạn giữa có thể chứa dấu cách/ngoặc, ví dụ `C:\Users\Bob\a b\c.js` -> `c.js`). Không có Require stack.
 */
function safeConfigError(why, root = process.cwd()) {
  let text = String(why).split('\n')[0];
  for (const [known, placeholder] of knownPaths(root)) text = text.split(known).join(placeholder);
  return text.replace(/(?:<project>|~)?(?:[A-Za-z]:)?[\\/](?:[^\\/'"\n]+[\\/])+([^\\/'"\s():]+)/g, '$1');
}

const names = (list) => `${list.slice(0, 10).join(', ')}${list.length > 10 ? `, … (+${list.length - 10})` : ''}`;
const stringArray = (value) => [...new Set(value.map(String))];

function parseSpecs(input, allSpecs) {
  if (present(input.specs) && input.specs !== 'all') mustBeArray(input.specs, 'specs');
  if (present(input.spec) && typeof input.spec !== 'string') throw new Error('spec phải là một chuỗi.');
  if (Array.isArray(input.specs)) {
    const specs = stringArray(input.specs);
    if (specs.length === 0) throw new Error('Danh sách spec rỗng.');
    const bad = specs.filter((s) => !allSpecs.includes(s));
    if (bad.length > 0) throw new Error(`Spec không hợp lệ: ${names(bad)}`);
    if (specs.length > MAX_SPECS) throw new Error(`Tối đa ${MAX_SPECS} spec mỗi lần chạy.`);
    return specs;
  }
  if (input.spec && input.spec !== 'all') {
    if (!allSpecs.includes(input.spec)) throw new Error(`Spec không hợp lệ: ${input.spec}`);
    return [input.spec];
  }
  return [];
}

function parseProjects(input, root) {
  mustBeArray(input.projects, 'projects');
  if (present(input.project) && typeof input.project !== 'string') throw new Error('project phải là một chuỗi.');
  const known = getPlaywrightProjects(root);
  const configHint = () => {
    const why = getLastConfigError();
    return why ? ` Không đọc được playwright.config.js (${safeConfigError(why, root)}) nên danh sách project trống; xem log máy chủ để biết chi tiết và sửa cấu hình rồi thử lại.` : '';
  };
  if (Array.isArray(input.projects)) {
    const projects = stringArray(input.projects);
    const bad = projects.filter((p) => !known.includes(p));
    if (bad.length > 0) throw new Error(`Project không hợp lệ: ${names(bad)}.${configHint()}`);
    return projects;
  }
  if (input.project && input.project !== 'all') {
    if (!known.includes(input.project)) throw new Error(`Project không hợp lệ.${configHint()}`);
    return [input.project];
  }
  return [];
}

function parseGrep(input, root) {
  mustBeArray(input.tags, 'tags');
  if (present(input.grep) && typeof input.grep !== 'string') throw new Error('grep phải là một chuỗi.');
  let grep = String(input.grep || '').trim();
  let tags = [];
  if (Array.isArray(input.tags) && input.tags.length > 0) {
    if (grep) throw new Error('Chỉ dùng tags hoặc grep, không dùng cả hai.');
    tags = stringArray(input.tags);
    if (tags.length > MAX_TAGS) throw new Error(`Tối đa ${MAX_TAGS} tag mỗi lần chạy.`);
    const available = listSpecDetails(root).availableTags;
    const bad = tags.filter((t) => !available.includes(t));
    if (bad.length > 0) throw new Error(`Tag không hợp lệ: ${names(bad)}`);
    grep = tagGrep(tags);
  }
  if (grep.length > GREP_MAX_LENGTH || /[\r\n\0]/.test(grep)) throw new Error(`Tag/grep không hợp lệ hoặc dài quá ${GREP_MAX_LENGTH} ký tự.`);
  return { grep, tags };
}

/**
 * D8: có project được chọn nhưng không file nào chạy được trên project đó -> 400 (thay vì "No tests found").
 * Chỉ áp khi dữ liệu là của Playwright; nếu chỉ có ước lượng thì KHÔNG từ chối (đừng chặn lượt chạy hợp lệ vì dữ liệu không chắc).
 */
async function assertSomeSpecRuns(projects, specs, allSpecs, root) {
  if (projects.length === 0) return;
  const { map, source } = await getSpecProjects(root);
  if (source !== 'playwright') return;
  const files = specs.length > 0 ? specs : allSpecs;
  if (!files.some((f) => (map[f] || []).some((p) => projects.includes(p)))) {
    throw new Error('Không có file nào chạy được trên project đã chọn.');
  }
}

async function validateOptions(input, root = process.env.QA_PROJECT_ROOT || process.cwd()) {
  const settings = getDashboardConfig();
  const allSpecs = listSpecs(null, root);
  const environment = String(input.environment || settings.runtime.defaultEnvironment);
  const workers = Number(input.workers || settings.runtime.workers);
  const suiteLabel = typeof input.suiteLabel === 'string' ? input.suiteLabel.slice(0, 80) : '';

  let viewport = null;
  if (input.viewport && typeof input.viewport === 'object') {
    const w = Number(input.viewport.width);
    const h = Number(input.viewport.height);
    if (Number.isInteger(w) && w >= 320 && w <= 7680 && Number.isInteger(h) && h >= 320 && h <= 4320) viewport = { width: w, height: h };
  }

  const specs = parseSpecs(input, allSpecs);
  const projects = parseProjects(input, root);
  const project = String(input.project || 'all');
  if (!Object.keys(settings.environments).includes(environment)) throw new Error('Environment không hợp lệ.');
  if (!Number.isInteger(workers) || workers < 1 || workers > 8) throw new Error('Luồng chạy phải từ 1 đến 8.');
  const { grep, tags } = parseGrep(input, root);
  await assertSomeSpecRuns(projects, specs, allSpecs, root);

  const spec = specs.length === 1 ? specs[0] : (specs.length > 1 ? specs.join(' ') : 'all');
  const options = { project, projects, environment, spec, specs, tags, grep, workers, headed: input.headed === true, viewport, suiteLabel };
  if (argsLength(buildPlaywrightArgs(options, false, root)) > MAX_ARGS_CHARS) throw new Error('Quá nhiều file đã chọn; chọn theo thư mục/tag.');
  return options;
}

module.exports = { validateOptions, safeConfigError };
