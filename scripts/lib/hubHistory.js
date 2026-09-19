'use strict';

/**
 * PHÂN BIỆT "VỆ TINH TỤT HẬU" VỚI "VỆ TINH CÓ NỘI DUNG RIÊNG".
 *
 * scripts/pre-sync-drift.js so sánh Hub-hiện-tại với vệ-tinh-hiện-tại. Phép so sánh đó
 * KHÔNG phân biệt được hai tình huống trái ngược nhau:
 *
 *   (a) Vệ tinh giữ bản CŨ của chính file Hub (vd. còn `app.js?v=5.5` trong khi Hub đã
 *       bump lên 5.6). Ghi đè là ĐÚNG Ý — đó chính là mục đích của sync.
 *   (b) Vệ tinh tự thêm nội dung riêng. Ghi đè là MẤT DỮ LIỆU — đúng thảm hoạ 7ad6984.
 *
 * Cả hai đều hiện ra dưới dạng "dòng chỉ có ở vệ tinh". Nếu chặn cả hai thì mọi lần Hub
 * sửa file (kể cả bump cache-bust) sẽ tự khoá đường sync của chính mình, và tính năng mới
 * không bao giờ tới được vệ tinh.
 *
 * Tiêu chí phân biệt: LỊCH SỬ GIT CỦA HUB. Nếu dòng đó từng tồn tại trong file này ở một
 * commit nào đó của Hub, thì nó là di sản Hub — vệ tinh chỉ đang tụt hậu. Nếu Hub chưa bao
 * giờ có dòng đó, nó do vệ tinh tự viết.
 */

const { execFileSync } = require('child_process');

// Dòng quá ngắn (`}`, `);`, `---`) không mang nội dung nghiệp vụ. Chúng luôn trùng với
// đâu đó trong lịch sử nên phân loại chúng là vô nghĩa; tách riêng để không gây nhiễu.
const TRIVIAL_MAX_CHARS = 3;

function git(cwd, args, timeout = 20000) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 1 << 24,
    timeout,
  });
}

/**
 * @param {string} hubRoot Thư mục gốc repo Hub.
 * @returns {{everHad: (relFile: string, line: string) => boolean, available: boolean,
 *            shallow: boolean, reason: string}}
 */
function createHubHistoryProbe(hubRoot) {
  let available = false;
  let shallow = false;
  let reason = '';

  try {
    git(hubRoot, ['rev-parse', '--is-inside-work-tree']);
    available = true;
  } catch (err) {
    reason = 'Hub không phải repo git nên không tra được lịch sử.';
  }

  if (available) {
    try {
      shallow = git(hubRoot, ['rev-parse', '--is-shallow-repository']).trim() === 'true';
    } catch (_) { shallow = false; }
    if (shallow) {
      // Bản clone nông chỉ có vài commit gần nhất: mọi dòng cũ đều trông như "Hub chưa từng
      // có". Im lặng chấp nhận sẽ biến cổng thành máy báo động giả. Nói thẳng ra.
      available = false;
      reason = 'Hub là bản clone nông (shallow); cần fetch-depth: 0 để tra được lịch sử.';
    }
  }

  const cache = new Map();

  function everHad(relFile, line) {
    if (!available) return false;
    const needle = line.trim();
    if (!needle) return true;

    const key = `${relFile}\u0000${needle}`;
    if (cache.has(key)) return cache.get(key);

    let found = false;
    try {
      // -S đếm số commit làm THAY ĐỔI số lần xuất hiện của chuỗi này trong file.
      // Có kết quả nghĩa là chuỗi từng tồn tại ở đó.
      found = git(hubRoot, ['log', '--all', '--format=%H', '-S', needle, '--', relFile]).trim().length > 0;
    } catch (_) {
      found = false;
    }
    cache.set(key, found);
    return found;
  }

  return {
    everHad,
    get available() { return available; },
    get shallow() { return shallow; },
    get reason() { return reason; },
  };
}

function isTrivialLine(line) {
  return line.trim().replace(/\s+/g, '').length <= TRIVIAL_MAX_CHARS;
}

/**
 * Chia các dòng "sẽ mất khi ghi đè" thành 3 nhóm.
 *
 * @param {string} relFile Đường dẫn tương đối (giống nhau ở Hub và vệ tinh).
 * @param {string[]} lostLines Dòng có ở vệ tinh mà bản Hub hiện tại KHÔNG có.
 * @param {ReturnType<createHubHistoryProbe>} probe
 * @returns {{stale: string[], trivial: string[], owned: string[]}}
 */
function classifyLostLines(relFile, lostLines, probe) {
  const stale = [];
  const trivial = [];
  const owned = [];

  for (const line of lostLines) {
    if (isTrivialLine(line)) { trivial.push(line); continue; }
    if (probe.everHad(relFile, line)) { stale.push(line); continue; }
    owned.push(line);
  }

  return { stale, trivial, owned };
}

module.exports = { createHubHistoryProbe, classifyLostLines, isTrivialLine, TRIVIAL_MAX_CHARS };
