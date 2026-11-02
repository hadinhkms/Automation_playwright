'use strict';
/**
 * Phân tích unified diff theo từng hunk và nhận diện các chỉ báo rủi ro kiểm thử (State, BVA, Security, Resilience).
 */

const { stripBomAndNormalizeLf } = require('./learnerText');

function isCommentOrBlankLine(line, fileKind) {
  const t = String(line || '').trim();
  if (!t) return true;
  if (fileKind === 'playwright-spec') {
    return t.startsWith('//') || t.startsWith('/*') || t.startsWith('*') || t.startsWith('*/');
  }
  return /^<!--.*-->$/.test(t);
}

function isConfigOrEnvOnlyLine(line) {
  const t = String(line || '').trim();
  if (!t) return false;
  return /\b(?:process\.env\.|requireEnv\s*\(|dotenv|BASE_URL|PLAYWRIGHT_)/i.test(t) && !/\bexpect\b/.test(t);
}

function parseUnifiedDiffHunks(diffText) {
  const lines = stripBomAndNormalizeLf(diffText).split('\n');
  const files = [];
  let currentFile = null;
  let currentHunk = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('diff --git ')) {
      if (currentHunk && currentFile) currentFile.hunks.push(currentHunk);
      currentHunk = null;
      if (currentFile) files.push(currentFile);
      currentFile = { oldPath: null, newPath: null, isNewFile: false, isDeletedFile: false, hunks: [] };
      continue;
    }

    if (line.startsWith('new file mode ')) {
      if (currentFile) currentFile.isNewFile = true;
      continue;
    }
    if (line.startsWith('deleted file mode ')) {
      if (currentFile) currentFile.isDeletedFile = true;
      continue;
    }
    if (line.startsWith('--- ')) {
      const p = line.slice(4).trim();
      if (!currentFile) currentFile = { oldPath: null, newPath: null, isNewFile: false, isDeletedFile: false, hunks: [] };
      if (p === '/dev/null') currentFile.isNewFile = true;
      else currentFile.oldPath = p.replace(/^a\//, '').replace(/^"|"$/g, '');
      continue;
    }
    if (line.startsWith('+++ ')) {
      const p = line.slice(4).trim();
      if (!currentFile) currentFile = { oldPath: null, newPath: null, isNewFile: false, isDeletedFile: false, hunks: [] };
      if (p === '/dev/null') currentFile.isDeletedFile = true;
      else currentFile.newPath = p.replace(/^b\//, '').replace(/^"|"$/g, '');
      continue;
    }

    const hunkHeader = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)$/);
    if (hunkHeader) {
      if (currentHunk && currentFile) currentFile.hunks.push(currentHunk);
      currentHunk = {
        oldStart: Number.parseInt(hunkHeader[1], 10),
        newStart: Number.parseInt(hunkHeader[3], 10),
        sectionHint: (hunkHeader[5] || '').trim(),
        added: [],
        removed: [],
        context: [],
        allNewAndContext: [],
      };
      continue;
    }

    if (!currentHunk) continue;
    if (line.startsWith('+')) {
      const content = line.slice(1);
      currentHunk.added.push(content);
      currentHunk.allNewAndContext.push(content);
    } else if (line.startsWith('-')) {
      currentHunk.removed.push(line.slice(1));
    } else if (line.startsWith(' ')) {
      const content = line.slice(1);
      currentHunk.context.push(content);
      currentHunk.allNewAndContext.push(content);
    }
  }

  if (currentHunk && currentFile) currentFile.hunks.push(currentHunk);
  if (currentFile) files.push(currentFile);
  return files;
}

const STATE_CONCURRENCY_EN_RE =
  /\b(?:double[-_\s]?submit|idempoten\w*|rapid\s+click|race\s+condition|concurrent|aria-busy|back\s+button|browser\s+back|session\s+expir\w*|lockout|locked)\b/i;
const STATE_CONCURRENCY_VI_RE =
  /(?:bấm\s+đúp|gửi\s+trùng|phiên\s+hết\s+hạn|khóa\s+tài\s+khoản|nút\s+back)/i;

const DATA_BVA_EN_RE =
  /\b(?:whitespace|trim|minlength|maxlength|boundary|bva|min\s*-\s*1|max\s*\+\s*1|paste|negative\s+number|decimal|nan|overflow)\b/i;
const DATA_BVA_VI_RE =
  /(?:khoảng\s+trắng|giá\s+trị\s+biên|biên\s+dưới|biên\s+trên|số\s+âm|dán\s+chuỗi)/i;

const SECURITY_EN_RE =
  /\b(?:xss|script\s*injection|idor|privilege|unauthorized|forbidden|csrf|sql\s*injection|sanitiz\w*|public\s+exposure)\b/i;
const SECURITY_VI_RE =
  /(?:mã\s+độc|phân\s+quyền|truy\s+cập\s+trái\s+phép|bảo\s+mật)/i;

const RESILIENCE_EN_RE =
  /\b(?:preserve\s+input|retain\s+value|5xx|500|502|503|timeout|retry|rollback|recovery|network\s+error)\b/i;
const RESILIENCE_VI_RE =
  /(?:bảo\s+toàn\s+dữ\s+liệu|giữ\s+nguyên\s+giá\s+trị|lỗi\s+máy\s+chủ|khôi\s+phục)/i;

function analyzeRiskIndicators(text) {
  const s = String(text || '');
  const tags = [];
  let suggestedCategory = null;

  if (STATE_CONCURRENCY_EN_RE.test(s) || STATE_CONCURRENCY_VI_RE.test(s)) {
    tags.push('state-concurrency');
    suggestedCategory = suggestedCategory || 'State & Concurrency';
  }
  if (DATA_BVA_EN_RE.test(s) || DATA_BVA_VI_RE.test(s)) {
    tags.push('data-bva');
    suggestedCategory = suggestedCategory || 'Data & BVA';
  }
  if (SECURITY_EN_RE.test(s) || SECURITY_VI_RE.test(s)) {
    tags.push('security-access');
    suggestedCategory = suggestedCategory || 'Security & Access';
  }
  if (RESILIENCE_EN_RE.test(s) || RESILIENCE_VI_RE.test(s)) {
    tags.push('resilience-recovery');
    suggestedCategory = suggestedCategory || 'Resilience & Recovery';
  }

  return { tags, suggestedCategory };
}

module.exports = {
  isCommentOrBlankLine,
  isConfigOrEnvOnlyLine,
  parseUnifiedDiffHunks,
  analyzeRiskIndicators,
};

