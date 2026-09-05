const fs = require('fs');
const path = require('path');

const DEFAULT_ROOT = path.resolve(__dirname, '../..');
const DRAFTS_DIR_NAME = '.dashboard-drafts';

function resolveDraftDir(type, rootDir = DEFAULT_ROOT) {
  if (!['script', 'page'].includes(type)) {
    throw new Error(`Loại bản nháp không hợp lệ: "${type}". Chỉ hỗ trợ "script" hoặc "page".`);
  }
  const folder = type === 'script' ? 'scripts' : 'pages';
  return path.join(rootDir, DRAFTS_DIR_NAME, folder);
}

function sanitizeDraftId(id, type) {
  const raw = String(id || '').trim();
  if (raw && /^[a-zA-Z0-9_.-]+$/.test(raw) && !raw.includes('..')) {
    return raw;
  }
  return `draft_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function saveDraft({ type, id, data = {}, rootDir = DEFAULT_ROOT }) {
  const targetDir = resolveDraftDir(type, rootDir);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const safeId = sanitizeDraftId(id, type);
  const filePath = path.join(targetDir, `${safeId}.json`);

  let existing = null;
  if (fs.existsSync(filePath)) {
    try {
      existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      existing = null;
    }
  }

  const now = new Date().toISOString();
  const draftRecord = {
    id: safeId,
    type,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    data: data || {},
  };

  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(draftRecord, null, 2), 'utf8');
  fs.renameSync(tempPath, filePath);

  return draftRecord;
}

function getDraft({ type, id, rootDir = DEFAULT_ROOT }) {
  if (!id) return null;
  const targetDir = resolveDraftDir(type, rootDir);
  const safeId = String(id).replace(/[^a-zA-Z0-9_.-]/g, '');
  const filePath = path.join(targetDir, `${safeId}.json`);

  if (!fs.existsSync(filePath)) return null;

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.warn(`[DraftManager] Lỗi đọc draft ${filePath}:`, error.message);
    return null;
  }
}

function listDrafts({ type, rootDir = DEFAULT_ROOT }) {
  const targetDir = resolveDraftDir(type, rootDir);
  if (!fs.existsSync(targetDir)) return [];

  const files = fs.readdirSync(targetDir).filter((file) => file.endsWith('.json'));
  const results = [];

  for (const file of files) {
    const fullPath = path.join(targetDir, file);
    try {
      const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      results.push(content);
    } catch (error) {
      console.warn(`[DraftManager] Bỏ qua file draft lỗi ${file}:`, error.message);
    }
  }

  // Sắp xếp bản nháp mới nhất lên đầu
  results.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  return results;
}

function deleteDraft({ type, id, rootDir = DEFAULT_ROOT }) {
  if (!id) return { success: false, error: 'Thiếu id bản nháp cần xóa' };
  const targetDir = resolveDraftDir(type, rootDir);
  const safeId = String(id).replace(/[^a-zA-Z0-9_.-]/g, '');
  const filePath = path.join(targetDir, `${safeId}.json`);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return { success: true, id: safeId, type, message: `Đã xóa bản nháp ${safeId}` };
  }

  return { success: true, id: safeId, type, message: `Bản nháp ${safeId} không tồn tại hoặc đã bị xóa trước đó.` };
}

function cleanupDraft({ type, id, rootDir = DEFAULT_ROOT }) {
  if (!id) return false;
  try {
    const res = deleteDraft({ type, id, rootDir });
    return res.success;
  } catch (err) {
    console.warn(`[DraftManager] Lỗi cleanup draft ${type}/${id}:`, err.message);
    return false;
  }
}

module.exports = {
  DRAFTS_DIR_NAME,
  resolveDraftDir,
  sanitizeDraftId,
  saveDraft,
  getDraft,
  listDrafts,
  deleteDraft,
  cleanupDraft,
};
