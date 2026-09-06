const fs = require('fs');
const path = require('path');

/**
 * Ghi an toàn mã nguồn Page Object và Spec BDD với Sandbox, Syntax Validate và Auto-Backup
 */
function saveDraftFiles({
  ROOT,
  pomFile,
  specFile,
  createBackupFn,
  execSyncFn,
}) {
  if (!pomFile || !pomFile.path || typeof pomFile.content !== 'string') {
    throw new Error('Thiếu thông tin file Page Object để lưu.');
  }
  if (!specFile || !specFile.path || typeof specFile.content !== 'string') {
    throw new Error('Thiếu thông tin file Spec BDD để lưu.');
  }

  // 1. Sandbox Validation
  const validateSandboxPath = (relPath, allowedPrefixes) => {
    const normalized = relPath.split('\\').join('/');
    if (normalized.includes('..') || path.isAbsolute(relPath)) {
      throw new Error(`Đường dẫn "${relPath}" vi phạm quy tắc bảo mật (Path Traversal).`);
    }
    const isAllowed = allowedPrefixes.some((prefix) => normalized.startsWith(prefix));
    if (!isAllowed) {
      throw new Error(`Đường dẫn "${relPath}" nằm ngoài Sandbox cho phép (${allowedPrefixes.join(', ')}).`);
    }
    return path.resolve(ROOT, normalized);
  };

  const pomAbsPath = validateSandboxPath(pomFile.path, ['pages/desktop/', 'pages/mobile-web/']);
  const specAbsPath = validateSandboxPath(specFile.path, ['tests/e2e/desktop/', 'tests/e2e/mobile-web/']);

  // 2. Validate JavaScript Syntax trước khi ghi đĩa
  try {
    new Function(pomFile.content);
  } catch (err) {
    throw new Error(`Mã Page Object có lỗi cú pháp JavaScript: ${err.message}`);
  }

  try {
    new Function(specFile.content);
  } catch (err) {
    throw new Error(`Mã Spec BDD có lỗi cú pháp JavaScript: ${err.message}`);
  }

  // 3. Tự động sao lưu (Auto-Backup)
  const backups = [];
  if (fs.existsSync(pomAbsPath) && typeof createBackupFn === 'function') {
    backups.push(createBackupFn(pomFile.path, pomAbsPath));
  }
  if (fs.existsSync(specAbsPath) && typeof createBackupFn === 'function') {
    backups.push(createBackupFn(specFile.path, specAbsPath));
  }

  // 4. Ghi file an toàn
  fs.mkdirSync(path.dirname(pomAbsPath), { recursive: true });
  fs.writeFileSync(pomAbsPath, pomFile.content, 'utf8');

  fs.mkdirSync(path.dirname(specAbsPath), { recursive: true });
  fs.writeFileSync(specAbsPath, specFile.content, 'utf8');

  // 5. Framework Guard: Tự động chạy check:framework cho các file vừa tạo
  let frameworkCheck = { passed: true, output: '' };
  if (typeof execSyncFn === 'function') {
    try {
      const pomRel = path.relative(ROOT, pomAbsPath).replace(/\\/g, '/');
      const specRel = path.relative(ROOT, specAbsPath).replace(/\\/g, '/');
      const checkOutput = execSyncFn(`node scripts/check-framework-structure.js "${pomRel}" "${specRel}"`, {
        cwd: ROOT,
        stdio: 'pipe',
        timeout: 10000,
      }).toString();
      frameworkCheck = { passed: true, output: checkOutput.trim() };
    } catch (checkErr) {
      const combinedOutput = [
        checkErr.stdout ? checkErr.stdout.toString() : '',
        checkErr.stderr ? checkErr.stderr.toString() : '',
      ].filter(Boolean).join('\n').trim();

      frameworkCheck = {
        passed: false,
        output: combinedOutput || checkErr.message,
      };
    }
  }

  return {
    success: true,
    message: 'Đã lưu Page Object và Spec BDD thành công!',
    backups,
    savedFiles: [pomFile.path, specFile.path],
    frameworkCheck,
  };
}

module.exports = {
  saveDraftFiles,
};
