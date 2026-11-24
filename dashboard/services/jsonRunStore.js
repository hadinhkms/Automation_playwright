/**
 * dashboard/services/jsonRunStore.js
 * Kho lịch sử chạy dạng JSON dùng chung (Mobile và Web): đọc chịu lỗi (record/tệp hỏng bị bỏ qua), ghi nguyên tử
 * (tệp tạm + rename, thử lại EPERM/EBUSY/EACCES cho Windows), mới nhất trước, cắt còn `maxRuns`.
 * `quarantineCorrupt`: tệp không parse được thì đổi tên thành index.corrupt-<ts>.json (giữ tối đa 3) rồi bắt đầu
 * danh sách rỗng, thay vì âm thầm ghi đè mất dữ liệu (Web). Mobile giữ hành vi cũ (chỉ bỏ qua).
 * Đọc-sửa-ghi chạy ĐỒNG BỘ (không await giữa đọc và ghi).
 */
const fs = require('fs');
const path = require('path');

const KEEP_CORRUPT = 3;

function writeAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  // Windows: antivirus or indexers can hold the target for a moment (EPERM/EBUSY); retry briefly.
  for (let attempt = 1; ; attempt += 1) {
    try { fs.renameSync(tmp, file); return; } catch (err) {
      if (attempt >= 5 || !['EPERM', 'EBUSY', 'EACCES'].includes(err.code)) { fs.rmSync(tmp, { force: true }); throw err; }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20 * attempt);
    }
  }
}

function quarantine(file) {
  const dir = path.dirname(file);
  try {
    fs.renameSync(file, path.join(dir, `index.corrupt-${Date.now()}.json`));
    const old = fs.readdirSync(dir).filter((n) => /^index\.corrupt-\d+\.json$/.test(n)).sort();
    old.slice(0, Math.max(0, old.length - KEEP_CORRUPT)).forEach((n) => fs.rmSync(path.join(dir, n), { force: true }));
  } catch (_) { /* best effort: a failed rename must not break reads */ }
}

function createJsonRunStore({ fileFor, maxRuns, isValidRecord, quarantineCorrupt = false }) {
  /** { runs, ok }: ok=false khi lỗi đọc KHÔNG phải ENOENT (EACCES/EBUSY/EPERM...): không được ghi đè (R-4). */
  function load(root) {
    const file = fileFor(root);
    let raw;
    try { raw = fs.readFileSync(file, 'utf8'); } catch (err) { return { runs: [], ok: err.code === 'ENOENT', err }; }
    let parsed;
    try { parsed = JSON.parse(raw); } catch (_) {
      if (quarantineCorrupt) quarantine(file);
      return { runs: [], ok: true };
    }
    const runs = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.runs) ? parsed.runs : []);
    return { runs: runs.filter(isValidRecord).sort((a, b) => b.startedAt.localeCompare(a.startedAt)), ok: true };
  }

  const read = (root) => load(root).runs;

  /** Adds a record (replacing one with the same id) and keeps the newest `maxRuns`. */
  function append(root, record) {
    if (!isValidRecord(record)) return null;
    const state = load(root);
    if (!state.ok) {
      console.warn(`[run-history] không đọc được ${fileFor(root)} (${state.err.code || state.err.message}): bỏ lần ghi để không mất lịch sử`);
      return null;
    }
    const runs = [record, ...state.runs.filter((r) => r.id !== record.id)].slice(0, maxRuns);
    writeAtomic(fileFor(root), { version: 1, runs });
    return record;
  }

  return { read, append, fileFor };
}

module.exports = { createJsonRunStore, writeAtomic };
