const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ENGINE_DIR = path.resolve(__dirname, '..', '..');
let detectedRoot = process.env.QA_PROJECT_ROOT ? path.resolve(process.env.QA_PROJECT_ROOT) : ENGINE_DIR;
if (path.basename(detectedRoot) === 'dashboard' && fs.existsSync(path.join(detectedRoot, 'server.js'))) {
  detectedRoot = path.resolve(detectedRoot, '..');
}
const ROOT = detectedRoot;

// Danh mục các thư mục và tệp tin ĐƯỢC PHÉP đồng bộ (Whitelist)
const PERMITTED_PREFIXES = [
  'tests/',
  'pages/',
  'data/',
  'docs/',
  'core/',
  'dashboard/',
  'scripts/',
];

const PERMITTED_EXACT_FILES = [
  'dashboardConfig.json',
  'qa-engine.config.json',
  'package.json',
  'package-lock.json',
  'playwright.config.js',
  'README.md',
  'GIT_WORKFLOW.md',
  'QA_AI_RULES.md',
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
];

// Danh mục các thư mục và tệp tin BỊ CHẶN TUYỆT ĐỐI (Blacklist / Sensitive / Artifacts)
const BLOCKED_PATTERNS = [
  /(^|\/)\.env(\..+)?$/i,
  /(^|\/)credentials(\..+)?$/i,
  /(^|\/)secrets(\..+)?$/i,
  /(^|\/)playwright-report\//i,
  /(^|\/)test-results\//i,
  /(^|\/)evidence\//i,
  /(^|\/)\.dashboard-drafts\//i,
  /(^|\/)\.dashboard-backups\//i,
  /(^|\/)node_modules\//i,
  /(^|\/)tmp\//i,
  /(^|\/)\.tmp\//i,
  /(^|\/)scratch\//i,
  /(^|\/)\.ai\/learning\/scratch\//i,
  /(^|\/)ai\/personal\//i,
  /\.log$/i,
  /Thumbs\.db$/i,
  /\.DS_Store$/i,
  /(^|\/)\.master_process/i,
];

// Danh mục các nhánh chính được bảo vệ (Cấm push trực tiếp, bắt buộc qua PR)
const PROTECTED_BRANCHES = ['main', 'master'];

/**
 * Trích xuất owner/repo từ remote git URL
 */
function getRepoSlug(remoteUrl) {
  if (!remoteUrl) return 'hadinhkms/Automation_playwright_SV';
  const m = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/i);
  if (m) return `${m[1]}/${m[2]}`;
  return 'hadinhkms/Automation_playwright_SV';
}

/**
 * Chuẩn hóa đường dẫn tương đối từ ROOT (dùng forward slash '/')
 */
function normalizeRelativePath(filePath) {
  let rel = path.relative(ROOT, path.resolve(ROOT, filePath));
  return rel.replace(/\\/g, '/');
}

/**
 * Kiểm tra xem tệp tin có bị chặn bảo mật hay không
 */
function isBlockedPath(filePath) {
  const normalized = normalizeRelativePath(filePath);
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Kiểm tra xem tệp tin có nằm trong danh mục được phép đồng bộ hay không
 */
function isPermittedPath(filePath) {
  const normalized = normalizeRelativePath(filePath);

  // Nếu rơi vào blacklist thì luôn luôn bị từ chối
  if (isBlockedPath(normalized)) return false;

  // Kiểm tra file chính xác
  if (PERMITTED_EXACT_FILES.includes(normalized)) return true;

  // Kiểm tra tiền tố thư mục cho phép
  return PERMITTED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

/**
 * Phân loại loại tệp tin để hiển thị icon và badge trên giao diện
 */
function categorizeAsset(filePath) {
  const normalized = normalizeRelativePath(filePath);

  if (isBlockedPath(normalized)) {
    return { type: 'blocked', label: 'Bị chặn (Bảo mật/Rác)', icon: 'ph-shield-warning', color: 'danger' };
  }
  if (normalized.startsWith('tests/')) {
    return { type: 'test_script', label: 'Kịch bản Test', icon: 'ph-tree-structure', color: 'primary' };
  }
  if (normalized.startsWith('pages/')) {
    return { type: 'page_object', label: 'Page Object', icon: 'ph-browsers', color: 'purple' };
  }
  if (normalized.startsWith('data/')) {
    return { type: 'test_data', label: 'Dữ liệu Test', icon: 'ph-database', color: 'teal' };
  }
  if (normalized.includes('dashboardConfig') || normalized.includes('qa-engine.config') || normalized.includes('playwright.config')) {
    return { type: 'test_suite', label: 'Suite & Cấu hình', icon: 'ph-stack', color: 'amber' };
  }
  if (normalized.startsWith('docs/') || normalized.endsWith('.md')) {
    return { type: 'docs', label: 'Tài liệu hướng dẫn', icon: 'ph-book-open', color: 'blue' };
  }
  if (isPermittedPath(normalized)) {
    return { type: 'code', label: 'Mã nguồn hệ thống', icon: 'ph-code', color: 'slate' };
  }
  return { type: 'other', label: 'Khác', icon: 'ph-file', color: 'secondary' };
}

/**
 * Chạy lệnh git với timeout an toàn
 */
function runGit(command, options = {}) {
  try {
    const output = execSync(command, {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: options.timeout || 30000,
      env: { ...process.env, PAGER: 'cat' },
    });
    return { ok: true, output: (output || '').trim() };
  } catch (err) {
    return {
      ok: false,
      output: (err.stdout || '').trim(),
      error: (err.stderr || err.message || '').trim(),
    };
  }
}

/**
 * Lấy trạng thái Git hiện tại của kho mã nguồn
 */
function getGitStatus() {
  const isGitRepo = fs.existsSync(path.join(ROOT, '.git'));
  if (!isGitRepo) {
    return {
      ok: false,
      isGitRepo: false,
      message: 'Thư mục hiện tại không phải là Git repository.',
    };
  }

  // 1. Nhánh hiện tại
  let currentBranch = 'unknown';
  const branchRes = runGit('git rev-parse --abbrev-ref HEAD');
  if (branchRes.ok) {
    currentBranch = branchRes.output;
  }

  // 2. Remote Origin URL
  let remoteUrl = '';
  const remoteRes = runGit('git config --get remote.origin.url');
  if (remoteRes.ok) {
    remoteUrl = remoteRes.output;
  }

  // 3. Kiểm tra Tracking & Ahead/Behind
  let ahead = 0;
  let behind = 0;
  let trackingBranch = '';
  const trackingRes = runGit('git rev-parse --abbrev-ref --symbolic-full-name @{u}');
  if (trackingRes.ok) {
    trackingBranch = trackingRes.output;
    const countRes = runGit('git rev-list --left-right --count HEAD...@{u}');
    if (countRes.ok) {
      const parts = countRes.output.split(/\s+/);
      ahead = parseInt(parts[0], 10) || 0;
      behind = parseInt(parts[1], 10) || 0;
    }
  }

  // 4. Lấy danh sách tệp tin thay đổi (git status --porcelain=v1)
  const statusRes = runGit('git status --porcelain=v1 -uall');
  const permittedFiles = [];
  const blockedFiles = [];
  const otherFiles = [];

  if (statusRes.ok && statusRes.output) {
    const lines = statusRes.output.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      const match = line.match(/^([ MADRCU?!]{1,2})\s+(.*)$/);
      let statusCode = '';
      let rawPath = '';
      if (match) {
        statusCode = match[1].trim();
        rawPath = match[2].trim();
      } else {
        statusCode = line.substring(0, 2).trim();
        rawPath = line.substring(3).trim();
      }
      // Handle rename "old -> new"
      if (rawPath.includes(' -> ')) {
        rawPath = rawPath.split(' -> ')[1].trim();
      }
      // Remove surrounding quotes if git outputs them
      rawPath = rawPath.replace(/^["']|["']$/g, '');

      const normalized = normalizeRelativePath(rawPath);
      const cat = categorizeAsset(normalized);

      const fileItem = {
        path: normalized,
        rawPath,
        status: statusCode, // 'M', 'A', 'D', '??', etc.
        statusText: getStatusDescription(statusCode),
        category: cat.type,
        categoryLabel: cat.label,
        icon: cat.icon,
        color: cat.color,
        isPermitted: isPermittedPath(normalized),
        isBlocked: isBlockedPath(normalized),
      };

      if (fileItem.isBlocked) {
        blockedFiles.push(fileItem);
      } else if (fileItem.isPermitted) {
        permittedFiles.push(fileItem);
      } else {
        otherFiles.push(fileItem);
      }
    }
  }

  // 5. Lấy 10 commit gần nhất
  const commits = [];
  const logRes = runGit('git log -n 10 --pretty=format:"%h%x09%an%x09%ar%x09%s"');
  if (logRes.ok && logRes.output) {
    const logLines = logRes.output.split(/\r?\n/).filter(Boolean);
    for (const logLine of logLines) {
      const [hash, author, timeAgo, subject] = logLine.split('\t');
      commits.push({ hash, author, timeAgo, subject });
    }
  }

  return {
    ok: true,
    isGitRepo: true,
    currentBranch,
    isProtectedBranch: PROTECTED_BRANCHES.includes((currentBranch || '').toLowerCase()),
    remoteUrl,
    repoSlug: getRepoSlug(remoteUrl),
    trackingBranch,
    ahead,
    behind,
    hasChanges: (permittedFiles.length + blockedFiles.length + otherFiles.length) > 0,
    hasPermittedChanges: permittedFiles.length > 0,
    permittedFiles,
    blockedFiles,
    otherFiles,
    totalChangedCount: permittedFiles.length + blockedFiles.length + otherFiles.length,
    recentCommits: commits,
  };
}

function getStatusDescription(code) {
  if (code === '??') return 'Mới (Chưa track)';
  if (code.includes('M')) return 'Đã chỉnh sửa';
  if (code.includes('A')) return 'Đã thêm mới';
  if (code.includes('D')) return 'Đã xóa';
  if (code.includes('R')) return 'Đã đổi tên';
  return 'Thay đổi';
}

/**
 * Lấy nội dung git diff của một file cụ thể
 */
function getFileDiff(filePath) {
  if (!filePath) return { ok: false, error: 'Thiếu đường dẫn tệp tin' };
  const normalized = normalizeRelativePath(filePath);

  // Kiểm tra xem file có mới tinh (untracked) không
  const fullPath = path.join(ROOT, normalized);
  const statusRes = runGit(`git status --porcelain=v1 -- "${normalized}"`);
  const isUntracked = statusRes.output && statusRes.output.startsWith('??');

  if (isUntracked && fs.existsSync(fullPath)) {
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split(/\r?\n/);
      const diffLines = lines.map((line) => '+' + line).join('\n');
      return {
        ok: true,
        file: normalized,
        isNewFile: true,
        diff: `--- /dev/null\n+++ b/${normalized}\n@@ -0,0 +1,${lines.length} @@\n${diffLines}`,
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  const diffRes = runGit(`git diff HEAD -- "${normalized}"`);
  if (!diffRes.ok) {
    return { ok: false, error: diffRes.error || 'Không thể lấy diff của tệp' };
  }

  return {
    ok: true,
    file: normalized,
    isNewFile: false,
    diff: diffRes.output || '(Không có sự khác biệt về văn bản)',
  };
}

/**
 * Chạy kiểm tra chất lượng Framework Quality Gate (scripts/check-framework-structure.js)
 */
function runFrameworkQualityGate() {
  const checkScript = path.join(ROOT, 'scripts', 'check-framework-structure.js');
  if (!fs.existsSync(checkScript)) {
    return {
      ok: true,
      passed: true,
      message: 'Không tìm thấy scripts/check-framework-structure.js, bỏ qua bước kiểm tra.',
      issues: [],
    };
  }

  try {
    const output = execSync('node scripts/check-framework-structure.js', {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 20000,
    });
    return {
      ok: true,
      passed: true,
      summary: (output || '').trim(),
      issues: [],
    };
  } catch (err) {
    const errText = (err.stdout || '') + '\n' + (err.stderr || '');
    const issues = errText
      .split(/\r?\n/)
      .filter((line) => line.trim().startsWith('- ') || line.includes('violations found'))
      .map((line) => line.replace(/^[-\s]+/, '').trim());

    return {
      ok: true,
      passed: false,
      error: 'Framework check không đạt chuẩn',
      summary: (err.stdout || '').trim(),
      issues: issues.length > 0 ? issues : [(err.stderr || err.message || '').trim()],
    };
  }
}

/**
 * Kéo mã nguồn mới nhất từ remote (Git Pull)
 */
function pullCode(options = {}) {
  const logs = [];
  logs.push(`[1/4] Bắt đầu đồng bộ từ remote repo...`);

  // 1. Fetch
  logs.push(`Đang kiểm tra kết nối với remote: git fetch origin...`);
  const fetchRes = runGit('git fetch origin');
  if (!fetchRes.ok) {
    return {
      ok: false,
      message: 'Không thể kết nối hoặc fetch từ remote: ' + fetchRes.error,
      logs,
    };
  }
  logs.push('Fetch thành công.');

  // 2. Kiểm tra xung đột / uncommitted changes
  const statusCheck = runGit('git status --porcelain');
  const hasLocalChanges = !!statusCheck.output;

  let stashed = false;
  if (hasLocalChanges) {
    if (options.stashIfDirty) {
      logs.push('[2/4] Phát hiện thay đổi cục bộ dở dang, đang lưu tạm: git stash...');
      const stashRes = runGit('git stash push -m "Auto-stash trước khi Pull từ Dashboard"');
      if (stashRes.ok) {
        stashed = true;
        logs.push('Đã lưu tạm mã nguồn cục bộ an toàn.');
      }
    } else {
      return {
        ok: false,
        isDirty: true,
        message: 'Bạn có các tệp tin chưa được commit. Vui lòng chọn "Lưu tạm (Stash) & Kéo về" hoặc commit trước khi Pull.',
        logs,
      };
    }
  } else {
    logs.push('[2/4] Trạng thái làm việc sạch (Clean working tree).');
  }

  // 3. Thực hiện git pull
  logs.push('[3/4] Đang kéo mã nguồn mới: git pull --ff-only...');
  let pullRes = runGit('git pull --ff-only');
  if (!pullRes.ok) {
    // Nếu ff-only không được, thử pull thường nếu cho phép
    logs.push('Cảnh báo ff-only: ' + pullRes.error + '. Đang thử git pull thông thường...');
    pullRes = runGit('git pull');
  }

  if (!pullRes.ok) {
    if (stashed) {
      logs.push('Đang khôi phục lại các thay đổi đã stash: git stash pop...');
      runGit('git stash pop');
    }
    return {
      ok: false,
      message: 'Kéo mã nguồn thất bại: ' + (pullRes.error || pullRes.output),
      logs,
    };
  }
  logs.push(pullRes.output || 'Đã cập nhật mã nguồn mới nhất.');

  // 4. Nếu có stashed thì khôi phục lại
  if (stashed) {
    logs.push('Đang khôi phục lại mã nguồn bạn đã sửa trước đó (git stash pop)...');
    const popRes = runGit('git stash pop');
    if (!popRes.ok) {
      logs.push('Cảnh báo xung đột khi pop stash: ' + popRes.error);
    } else {
      logs.push('Đã khôi phục lại mã nguồn sửa đổi thành công.');
    }
  }

  // 5. Kiểm tra nếu package.json thay đổi thì auto npm install
  let npmUpdated = false;
  if (pullRes.output && (pullRes.output.includes('package.json') || pullRes.output.includes('package-lock.json'))) {
    logs.push('[4/4] Phát hiện cập nhật package.json, đang chạy npm install...');
    try {
      const npmRes = execSync('npm install --prefer-offline', { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
      logs.push('Đã cập nhật dependencies thành công.');
      npmUpdated = true;
    } catch (npmErr) {
      logs.push('Cảnh báo npm install: ' + npmErr.message);
    }
  } else {
    logs.push('[4/4] Dependencies không thay đổi.');
  }

  return {
    ok: true,
    message: 'Đã hoàn tất kéo mã nguồn mới nhất về máy!',
    logs,
    npmUpdated,
  };
}

/**
 * Commit & Push các tệp tin ĐÃ ĐƯỢC PHÉP lên remote
 * @param {Object} params
 * @param {string[]} params.files Danh sách đường dẫn tệp tin cần commit
 * @param {string} params.message Nội dung commit message
 * @param {string} [params.branch] Nhánh push lên (mặc định nhánh hiện tại)
 * @param {string} [params.newBranch] Tên nhánh feature mới cần tạo trước khi push
 * @param {boolean} [params.allowProtectedPush] Cho phép push thẳng main (mặc định false)
 * @param {boolean} [params.skipQualityCheck] Bỏ qua kiểm tra framework (mặc định false)
 */
function commitAndPush({ files, message, branch, newBranch, allowProtectedPush = false, skipQualityCheck = false }) {
  const logs = [];

  if (!files || !Array.isArray(files) || files.length === 0) {
    return { ok: false, message: 'Chưa chọn tệp tin nào để commit.', logs };
  }

  if (!message || !message.trim()) {
    return { ok: false, message: 'Vui lòng nhập nội dung commit message.', logs };
  }

  // 1. Kiểm tra nhánh mục tiêu & RÀO CHẮN BẢO VỆ NHÁNH CHÍNH (MAIN / MASTER)
  const currentBranch = runGit('git rev-parse --abbrev-ref HEAD').output || 'main';
  let targetBranch = branch || currentBranch;

  // Nếu người dùng cung cấp newBranch để tách nhánh từ main
  if (newBranch && newBranch.trim()) {
    const cleanBranch = newBranch.trim();
    logs.push(`[Branch] Đang tạo và chuyển sang nhánh Feature: ${cleanBranch}...`);
    const checkoutRes = runGit(`git checkout -b "${cleanBranch}"`);
    if (!checkoutRes.ok) {
      runGit(`git checkout "${cleanBranch}"`);
    }
    targetBranch = cleanBranch;
  }

  // Rào chắn bảo vệ nhánh chính: cấm push trực tiếp lên main/master trừ khi có cờ cho phép rõ ràng
  if (PROTECTED_BRANCHES.includes(targetBranch.toLowerCase()) && !allowProtectedPush) {
    const errMsg = `Nhánh "${targetBranch}" là nhánh chính được bảo vệ (Protected Branch)! Bạn không được phép push trực tiếp vào ${targetBranch}. Vui lòng tạo nhánh Feature (ví dụ: feature/login-test) để đẩy lên và mở Pull Request gửi Lead phê duyệt.`;
    logs.push(`[CHẶN BẢO VỆ NHÁNH] ${errMsg}`);
    return {
      ok: false,
      isProtectedBranch: true,
      message: errMsg,
      logs,
    };
  }

  // 2. RÀO CHẮN BẢO MẬT: Kiểm tra xem có file nào bị chặn lọt vào danh sách không
  const violationFiles = [];
  const validFiles = [];

  for (const rawFile of files) {
    const normalized = normalizeRelativePath(rawFile);
    if (isBlockedPath(normalized) || !isPermittedPath(normalized)) {
      violationFiles.push(normalized);
    } else {
      validFiles.push(normalized);
    }
  }

  if (violationFiles.length > 0) {
    const errMsg = `Bảo vệ an ninh kích hoạt! Phát hiện ${violationFiles.length} tệp không được phép commit: ${violationFiles.slice(0, 3).join(', ')}`;
    logs.push(`[LỖI BẢO MẬT] ${errMsg}`);
    return {
      ok: false,
      securityViolation: true,
      message: errMsg,
      violationFiles,
      logs,
    };
  }

  logs.push(`[1/4] Thẩm định danh sách tệp tin: ${validFiles.length} tệp hợp lệ.`);

  // 3. Chạy Framework Quality Gate trước khi commit
  if (!skipQualityCheck) {
    logs.push(`[2/4] Đang kích hoạt Quality Gate (Kiểm tra chuẩn Framework)...`);
    const qgResult = runFrameworkQualityGate();
    if (!qgResult.passed) {
      logs.push(`❌ Quality Gate thất bại: ${qgResult.issues.length} lỗi vi phạm.`);
      for (const issue of qgResult.issues) {
        logs.push(`  - ${issue}`);
      }
      return {
        ok: false,
        qualityGateFailed: true,
        message: 'Không thể commit! Mã nguồn không vượt qua bài kiểm tra chuẩn Framework.',
        issues: qgResult.issues,
        logs,
      };
    }
    logs.push(`✅ Quality Gate passed: ${qgResult.summary || 'Đạt chuẩn'}.`);
  } else {
    logs.push(`[2/4] Bỏ qua Quality Gate theo yêu cầu.`);
  }

  // 4. Stage chỉ đúng các file hợp lệ (tuyệt đối không dùng git add .)
  logs.push(`[3/4] Đang stage các tệp tin hợp lệ (git add)...`);
  for (const file of validFiles) {
    const addRes = runGit(`git add -- "${file}"`);
    if (!addRes.ok) {
      logs.push(`Lỗi khi add ${file}: ${addRes.error}`);
      return { ok: false, message: `Lỗi khi đưa ${file} vào staging: ${addRes.error}`, logs };
    }
  }
  logs.push(`Đã stage thành công ${validFiles.length} tệp tin.`);

  // 5. Commit
  const sanitizedMsg = message.replace(/"/g, '\\"');
  logs.push(`Đang thực hiện commit: "${message}"...`);
  const commitRes = runGit(`git commit -m "${sanitizedMsg}"`);
  if (!commitRes.ok) {
    if (commitRes.output.includes('nothing to commit') || commitRes.error.includes('nothing to commit')) {
      return { ok: false, message: 'Không có thay đổi nào mới để commit.', logs };
    }
    return { ok: false, message: 'Lỗi khi commit: ' + (commitRes.error || commitRes.output), logs };
  }
  logs.push(commitRes.output);

  // Lấy hash của commit vừa tạo
  const hashRes = runGit('git rev-parse --short HEAD');
  const commitHash = hashRes.ok ? hashRes.output : '';

  // 6. Push lên Remote
  logs.push(`[4/4] Đang đẩy lên remote: git push -u origin ${targetBranch}...`);
  const pushRes = runGit(`git push -u origin ${targetBranch}`);
  if (!pushRes.ok) {
    logs.push(`Lỗi khi push: ${pushRes.error}`);
    return {
      ok: false,
      pushed: false,
      commitHash,
      message: 'Commit thành công nhưng Push lên remote thất bại: ' + pushRes.error,
      logs,
    };
  }

  const remoteUrlRes = runGit('git config --get remote.origin.url');
  const repoSlug = getRepoSlug(remoteUrlRes.output);
  const prUrl = `https://github.com/${repoSlug}/compare/main...${encodeURIComponent(targetBranch)}?expand=1`;

  logs.push(pushRes.output || 'Đẩy lên remote thành công!');
  logs.push(`🎉 Hoàn tất! Commit ${commitHash} đã được đưa lên nhánh ${targetBranch}.`);

  const isFeatureBranch = !PROTECTED_BRANCHES.includes(targetBranch.toLowerCase());
  if (isFeatureBranch) {
    logs.push(`🔗 Link tạo Pull Request gửi Lead duyệt: ${prUrl}`);
  }

  return {
    ok: true,
    pushed: true,
    commitHash,
    branch: targetBranch,
    prUrl,
    isFeatureBranch,
    message: isFeatureBranch
      ? `Đã đẩy lên nhánh ${targetBranch}! Vui lòng mở Pull Request để Lead phê duyệt.`
      : `Đã commit & push thành công (${commitHash}) lên nhánh ${targetBranch}!`,
    logs,
  };
}

/**
 * Danh sách các nhánh cục bộ và từ xa
 */
function listBranches() {
  const branches = [];
  const res = runGit('git branch -a');
  let current = '';

  if (res.ok && res.output) {
    const lines = res.output.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      const isCurrent = line.startsWith('*');
      const name = line.replace(/^[\*\s]+/, '').trim();
      if (isCurrent) current = name;
      branches.push({
        name,
        isCurrent,
        isRemote: name.startsWith('remotes/'),
      });
    }
  }

  return { ok: true, currentBranch: current, branches };
}

/**
 * Chuyển nhánh hoặc tạo nhánh mới
 */
function checkoutBranch(branchName, createNew = false) {
  if (!branchName || !branchName.trim()) {
    return { ok: false, message: 'Tên nhánh không hợp lệ' };
  }
  const cleanName = branchName.trim();
  const cmd = createNew ? `git checkout -b "${cleanName}"` : `git checkout "${cleanName}"`;
  const res = runGit(cmd);
  if (!res.ok) {
    return { ok: false, message: 'Không thể chuyển nhánh: ' + (res.error || res.output) };
  }
  return { ok: true, currentBranch: cleanName, message: `Đã chuyển sang nhánh ${cleanName}` };
}

/**
 * Đồng bộ hóa an toàn Test Suites và Cấu hình lên Git
 * Dành cho endpoint /api/git/sync trên Dashboard, tuân thủ nghiêm ngặt Asset Shield.
 */
function syncSuitesAndConfigs(options = {}) {
  const status = getGitStatus();
  if (!status.ok) {
    return { ok: false, success: false, error: status.message || 'Không thể lấy trạng thái Git.' };
  }

  const currentBranch = status.currentBranch || 'main';
  const permitted = status.permittedFiles || [];

  // 1. Nếu có tệp hợp lệ bị thay đổi, thực hiện kiểm tra và commit
  if (permitted.length > 0) {
    if (options.dryRun) {
      return {
        ok: true,
        success: true,
        currentBranch,
        dryRun: true,
        message: `[Dry Run] Phát hiện ${permitted.length} tệp tin sẵn sàng đồng bộ lên "${currentBranch}".`,
        files: permitted.map((f) => f.path),
      };
    }

    // Quality Gate: Kiểm tra quy chuẩn framework
    if (!options.skipQualityCheck) {
      const qg = runFrameworkQualityGate();
      if (!qg.passed) {
        return {
          ok: false,
          success: false,
          qualityGateFailed: true,
          error: `Framework Quality Gate không đạt chuẩn: ${(qg.issues || []).join('; ')}`,
        };
      }
    }

    // Stage CHỈ các tệp hợp lệ (Asset Shield: tuyệt đối không dùng git add .)
    for (const f of permitted) {
      const addRes = runGit(`git add -- "${f.path}"`);
      if (!addRes.ok) {
        return { ok: false, success: false, error: `Lỗi khi đưa tệp ${f.path} vào staging: ${addRes.error}` };
      }
    }

    // Commit an toàn
    const msg = (options.message || 'chore(dashboard): sync test suites and configs').replace(/"/g, '\\"');
    const commitRes = runGit(`git commit -m "${msg}"`);
    if (!commitRes.ok && !commitRes.output.includes('nothing to commit') && !commitRes.error.includes('nothing to commit')) {
      return { ok: false, success: false, error: `Lỗi khi commit: ${commitRes.error || commitRes.output}` };
    }
  }

  // 2. Kiểm tra lại trạng thái sau khi commit (hoặc trước đó đã có commits ahead)
  const updatedStatus = getGitStatus();
  if (!updatedStatus.ahead || updatedStatus.ahead === 0) {
    return {
      ok: true,
      success: true,
      currentBranch,
      dryRun: !!options.dryRun,
      message: `Test Suites và mã nguồn đã ở trạng thái mới nhất trên nhánh "${currentBranch}" (không có thay đổi mới cần đẩy).`,
      output: 'Everything up-to-date',
    };
  }

  // Chế độ Dry Run phục vụ kiểm thử an toàn
  if (options.dryRun) {
    const dryRunRes = runGit(`git push --dry-run origin ${currentBranch}`);
    return {
      ok: dryRunRes.ok,
      success: dryRunRes.ok,
      currentBranch,
      dryRun: true,
      message: dryRunRes.ok
        ? `[Dry Run] Sẵn sàng đẩy lên nhánh "${currentBranch}".`
        : `[Dry Run] Lỗi đẩy lên remote: ${dryRunRes.error || dryRunRes.output}`,
      output: dryRunRes.output,
    };
  }

  // 3. Đẩy lên remote an toàn
  const pushRes = runGit(`git push origin ${currentBranch}`);
  if (!pushRes.ok) {
    return {
      ok: false,
      success: false,
      error: `Không thể đẩy lên GitHub (nhánh ${currentBranch}): ${pushRes.error || pushRes.output}`,
    };
  }

  return {
    ok: true,
    success: true,
    currentBranch,
    message: `Đã đồng bộ hóa an toàn Test Suites lên nhánh "${currentBranch}" thành công!`,
    output: pushRes.output || 'Push completed successfully',
  };
}

module.exports = {
  ROOT,
  PERMITTED_PREFIXES,
  PERMITTED_EXACT_FILES,
  BLOCKED_PATTERNS,
  isPermittedPath,
  isBlockedPath,
  categorizeAsset,
  getGitStatus,
  getFileDiff,
  runFrameworkQualityGate,
  pullCode,
  commitAndPush,
  syncSuitesAndConfigs,
  listBranches,
  checkoutBranch,
};

