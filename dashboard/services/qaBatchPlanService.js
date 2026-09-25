'use strict';

/**
 * dashboard/services/qaBatchPlanService.js
 * Lập kế hoạch sửa hàng loạt (PLAN-18). Client chỉ gửi findingKey; server tra finding của lần quét
 * gần nhất, đọc file thật, chỉ giữ bản vá parse được và làm finding biến mất (INV-1, INV-3). Bản vá
 * lưu dạng ý định (kind + dòng + lựa chọn) để lúc commit dựng lại trên nội dung hiện tại.
 */

const fs = require('node:fs');
const { getQaSummary, getFindingsIndex } = require('./qaService');
const { resolveSafePath } = require('./qaFindingFixerService');
const { reasonText } = require('./qaFindingCatalog');
const { parseDocument, serializeDocument, replaceLine, hashNormalized } = require('./qaFixText');
const { validateSyntax, isResolved } = require('./qaFixValidate');
const { planFinding, loadReqContext } = require('./qaQuickFixes');
const {
  httpError,
  createSession,
  requireSession,
  requireRevision,
} = require('./qaBatchSessionStore');

const MAX_KEYS = 200;
const MAX_FILE_BYTES = 512 * 1024;
const CONTEXT_LINES = 2;
const ROUTE_ACTION = { scaffold: 'scaffold', autofix: 'autofix' };

function skipEntry(finding, reasonCode) {
  let nextAction = { type: 'detail' };
  if (reasonCode === 'MANUAL_ROUTE' && ROUTE_ACTION[finding.fixRoute]) nextAction = { type: ROUTE_ACTION[finding.fixRoute] };
  if (finding.kind === 'ma-tc-trung') nextAction = { type: 'openDoc', target: String(finding.where || '').split(',')[0].replace(/\s*\(.*$/, '').trim() };
  return {
    findingKey: finding.findingKey,
    kind: finding.kind || null,
    where: finding.where || null,
    reasonCode,
    reason: reasonText(reasonCode),
    nextAction,
  };
}

function readTarget(root, finding) {
  const resolved = resolveSafePath(root, String(finding.where || ''));
  if (!resolved) return { skip: 'PATH_REJECTED' };
  if (!resolved.lineNumber) return { skip: 'LINE_UNKNOWN' };
  let stat;
  try {
    stat = fs.statSync(resolved.absPath);
  } catch (_) {
    return { skip: 'FILE_NOT_FOUND' };
  }
  if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return { skip: 'FILE_NOT_FOUND' };
  return { relPath: resolved.relPath, absPath: resolved.absPath, line: resolved.lineNumber };
}

/** Dựng một bản vá trên `doc`; trả { edits, target, doc } hoặc { skip }. */
function tryPatch(root, doc, relPath, patch, ctx) {
  const planned = planFinding(patch.kind, doc.lines, patch.line, { ...ctx, relPath }, patch.choice);
  if (planned.skip) return planned;
  const next = planned.edits.reduce((d, edit) => replaceLine(d, edit.index, edit.text), doc);
  if (!isResolved(patch.kind, next.lines, planned.target)) return { skip: 'NOT_RESOLVED' };
  const syntax = validateSyntax(relPath, serializeDocument(next), { root });
  if (!syntax.ok) return { skip: syntax.reasonCode };
  return { ...planned, doc: next };
}

function hunkOf(before, after, edits) {
  const indexes = edits.map((edit) => edit.index);
  const start = Math.max(0, Math.min(...indexes) - CONTEXT_LINES);
  const end = Math.min(before.lines.length - 1, Math.max(...indexes) + CONTEXT_LINES);
  return {
    startLine: start + 1,
    changedLines: indexes.map((i) => i + 1),
    before: before.lines.slice(start, end + 1),
    after: after.lines.slice(start, end + 1),
  };
}

function describePatch(patch, doc, result) {
  return {
    ...patch,
    risk: patch.choice.skipMode === 'unskip' ? 'behavior' : 'low',
    defaultSelected: true,
    hunk: hunkOf(doc, result.doc, result.edits),
  };
}

function describePlan(session) {
  const cards = [...session.files.values()].map((file) => ({
    relPath: file.relPath,
    action: file.action,
    patches: [...file.patches.values()],
  }));
  const patches = cards.reduce((n, card) => n + card.patches.length, 0);
  return {
    ok: true,
    session: { sessionId: session.id, revision: session.revision, expiresAt: new Date(session.expiresAt).toISOString() },
    cards,
    skipped: session.skipped,
    totals: { patches, files: cards.length, skipped: session.skipped.length },
  };
}

/** POST batch-plan. `options.findingsIndex` chỉ dùng trong test. */
function buildPlan(root, findingKeys, options = {}) {
  if (!Array.isArray(findingKeys) || !findingKeys.length || findingKeys.length > MAX_KEYS
    || !findingKeys.every((key) => typeof key === 'string' && key)) {
    throw httpError(400, 'INVALID_BODY', `Cần từ 1 đến ${MAX_KEYS} findingKey.`);
  }
  let index = options.findingsIndex || getFindingsIndex(root);
  if (!index) {
    getQaSummary(root);
    index = getFindingsIndex(root);
  }
  const ctx = loadReqContext(root);
  const files = new Map();
  const skipped = [];
  for (const key of new Set(findingKeys)) {
    const finding = index && index.byKey.get(key);
    if (!finding) { skipped.push(skipEntry({ findingKey: key }, 'NOT_IN_LATEST_SCAN')); continue; }
    if (finding.fixRoute !== 'quick') { skipped.push(skipEntry(finding, 'MANUAL_ROUTE')); continue; }
    const target = readTarget(root, finding);
    if (target.skip) { skipped.push(skipEntry(finding, target.skip)); continue; }
    if (!files.has(target.relPath)) {
      const content = fs.readFileSync(target.absPath, 'utf8');
      files.set(target.relPath, {
        relPath: target.relPath,
        absPath: target.absPath,
        action: 'modified',
        baseHash: hashNormalized(content),
        doc: parseDocument(content),
        patches: new Map(),
      });
    }
    const file = files.get(target.relPath);
    const patch = {
      findingKey: key,
      kind: finding.kind,
      line: target.line,
      occurrences: finding.occurrences || 1,
      choice: finding.kind === 'test-bi-skip-am-tham' ? { skipMode: 'wip' } : {},
    };
    const result = tryPatch(root, file.doc, file.relPath, patch, ctx);
    if (result.skip) { skipped.push(skipEntry(finding, result.skip)); continue; }
    file.patches.set(key, describePatch(patch, file.doc, result));
  }
  for (const [relPath, file] of files) if (!file.patches.size) files.delete(relPath);
  return describePlan(createSession(root, { files, skipped, scanId: index ? index.scanId : null }));
}

/** POST batch-input: đổi lựa chọn của một bản vá (Phase 2: chế độ xử lý test bị skip). */
function applyInput(root, { sessionId, revision, findingKey, input } = {}) {
  const session = requireSession(root, sessionId);
  if (session.state !== 'PLANNED') throw httpError(409, 'INVALID_STATE', 'Kế hoạch không còn ở trạng thái chờ áp dụng.');
  requireRevision(session, revision);
  const file = [...session.files.values()].find((f) => f.patches.has(findingKey));
  if (!file) throw httpError(404, 'FINDING_NOT_FOUND', 'Bản vá không có trong kế hoạch này.');
  const current = file.patches.get(findingKey);
  const skipMode = input && input.skipMode;
  if (current.kind !== 'test-bi-skip-am-tham' || !['wip', 'unskip'].includes(skipMode)) {
    throw httpError(400, 'INVALID_INPUT', 'Lựa chọn không hợp lệ cho bản vá này.');
  }
  const patch = { ...current, choice: { skipMode } };
  const result = tryPatch(root, file.doc, file.relPath, patch, {});
  if (result.skip) return { ok: true, revision: session.revision, skipped: skipEntry(current, result.skip) };
  file.patches.set(findingKey, describePatch(patch, file.doc, result));
  session.revision += 1;
  return { ok: true, revision: session.revision, card: { relPath: file.relPath, action: file.action, patches: [...file.patches.values()] } };
}

/**
 * Dựng nội dung cuối của mỗi file từ nội dung HIỆN TẠI + các bản vá được tick, lần lượt.
 * ALREADY_FIXED ở đây nghĩa là bản vá trước trong cùng file đã xử lý luôn (vd. chung describe).
 */
function composeForCommit(root, session, accepted) {
  const ctx = loadReqContext(root);
  const out = [];
  for (const file of session.files.values()) {
    const chosen = [...file.patches.values()].filter((p) => accepted.has(p.findingKey));
    if (!chosen.length) continue;
    const original = fs.readFileSync(file.absPath, 'utf8');
    let doc = parseDocument(original);
    const applied = [];
    const notApplied = [];
    for (const patch of chosen) {
      const result = tryPatch(root, doc, file.relPath, patch, ctx);
      if (result.skip === 'ALREADY_FIXED') applied.push(patch.findingKey);
      else if (result.skip) notApplied.push({ findingKey: patch.findingKey, reasonCode: result.skip });
      else {
        doc = result.doc;
        applied.push(patch.findingKey);
      }
    }
    out.push({ file, original, content: serializeDocument(doc), applied, notApplied });
  }
  return out;
}

module.exports = { buildPlan, applyInput, composeForCommit, MAX_KEYS };
