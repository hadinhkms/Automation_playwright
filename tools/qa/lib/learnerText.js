'use strict';
/**
 * Xử lý chuỗi, băm SHA-256, redact thông tin nhạy cảm và độ tương đồng từ vựng Lexical Jaccard.
 */

const crypto = require('node:crypto');
const { STOPWORDS_EN_VI } = require('./learnerConstants');

function sha256(content) {
  return crypto.createHash('sha256').update(String(content), 'utf8').digest('hex');
}

function unicodeLength(str) {
  return [...String(str || '')].length;
}

function stripBomAndNormalizeLf(text) {
  return String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

function redactSensitiveText(input) {
  let s = String(input || '');
  s = s.replace(/\b(https?:\/\/)[^/\s:@]+:[^/\s@]+@/gi, '$1[REDACTED_URL_CRED]@');
  s = s.replace(
    /([?&](?:token|access_token|refresh_token|api_key|apikey|secret|password|passwd|pwd|auth|signature|sig|key)=)[^&\s'")\]]+/gi,
    '$1[REDACTED_PARAM]',
  );
  s = s.replace(
    /\b(Authorization|X-Api-Key|X-Auth-Token)\s*[:=]\s*(?:Bearer\s+|Basic\s+)?[A-Za-z0-9._~+/=-]{4,}/gi,
    '$1: [REDACTED_AUTH_HEADER]',
  );
  s = s.replace(/\bBearer\s+[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b/g, 'Bearer [REDACTED_JWT]');
  s = s.replace(
    /\b(password|passwd|pwd|secret|client_secret|api_key|apikey|access_token|private_key|auth_token)\s*([:=])\s*(['"`])[^'"`\n]{1,200}\3/gi,
    '$1$2$3[REDACTED_SECRET]$3',
  );
  s = s.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]');
  s = s.replace(/\b[A-Za-z]:\\Users\\[^\\\s'")\]]+(?:\\[^\\\s'")\]]+)*/gi, '[REDACTED_USER_PATH]');
  s = s.replace(/\/(?:Users|home)\/[^/\s'")\]]+(?:\/[^/\s'")\]]+)*/g, '[REDACTED_USER_PATH]');
  s = s.replace(
    /\b(IGNORE\s+ALL\s+PREVIOUS\s+INSTRUCTIONS|SYSTEM\s+OVERRIDE|EXEC_SHELL)\b/gi,
    '[REDACTED_INSTRUCTION]',
  );
  return s;
}

function containsUnredactedSensitive(input) {
  const s = String(input || '');
  if (/\b(https?:\/\/)[^/\s:@]+:[^/\s@]+@/i.test(s)) return true;
  if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/.test(s)) return true;
  if (/\b(Authorization|X-Api-Key)\s*[:=]\s*(?:Bearer\s+)?(?!\[REDACTED)[A-Za-z0-9._~+/=-]{6,}/i.test(s)) {
    return true;
  }
  if (/\b(password|secret|api_key|access_token|private_key)\s*[:=]\s*['"`](?!\[REDACTED)[^'"`\n]+['"`]/i.test(s)) {
    return true;
  }
  return false;
}

function tokenizeForJaccard(text) {
  const normalized = String(text || '').normalize('NFKC').toLowerCase();
  const rawTokens = normalized.match(/[\p{L}\p{N}]+/gu) || [];
  const tokens = new Set();
  for (const tok of rawTokens) {
    if (STOPWORDS_EN_VI.has(tok)) continue;
    if (tok.length < 2 && !/^\d+$/.test(tok)) continue;
    tokens.add(tok);
  }
  return tokens;
}

function computeLexicalJaccard(textA, textB) {
  const setA = tokenizeForJaccard(textA);
  const setB = tokenizeForJaccard(textB);
  if (setA.size === 0 || setB.size === 0) {
    return { score: 0, empty: true, tokenCountA: setA.size, tokenCountB: setB.size };
  }
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  const score = union === 0 ? 0 : Number((intersection / union).toFixed(4));
  return { score, empty: false, tokenCountA: setA.size, tokenCountB: setB.size };
}

function detectScriptHint(text) {
  const s = String(text || '').normalize('NFKC');
  const hasViDiacritics = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(s);
  return hasViDiacritics ? 'vi' : 'en';
}

function canonicalBusinessText(entryOrCandidate) {
  return [
    entryOrCandidate.title || '',
    entryOrCandidate.trigger || '',
    entryOrCandidate.failureMode || '',
    entryOrCandidate.actionableCheck || '',
  ]
    .map((s) => String(s).normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' '))
    .join(' | ');
}

function isIso8601Timestamp(val) {
  if (typeof val !== 'string' || !val.trim()) return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(val.trim())) return false;
  return !Number.isNaN(Date.parse(val.trim()));
}

function computeResolutionContentHash(cand, resolution) {
  return sha256(
    [
      cand.fingerprint || '',
      resolution,
      cand.targetCatalog || '',
      canonicalBusinessText(cand),
      (cand.review && cand.review.mergeTargetId) || '',
    ].join('|'),
  );
}

function computeScopeSourceHash(signals) {
  const sortedHashes = (signals || [])
    .map((s) => `${s.source}:${s.file || s.decisionId || ''}:${s.sourceHash || ''}`)
    .sort();
  return sha256(sortedHashes.join('\n'));
}

module.exports = {
  sha256,
  unicodeLength,
  stripBomAndNormalizeLf,
  redactSensitiveText,
  containsUnredactedSensitive,
  tokenizeForJaccard,
  computeLexicalJaccard,
  detectScriptHint,
  canonicalBusinessText,
  isIso8601Timestamp,
  computeResolutionContentHash,
  computeScopeSourceHash,
};

