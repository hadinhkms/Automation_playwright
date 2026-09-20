#!/usr/bin/env node
'use strict';

/**
 * PRE-SYNC DRIFT DETECTOR — CHỈ ĐỌC, KHÔNG BAO GIỜ GHI.
 *
 * Mô phỏng chính xác những gì scripts/sync-satellites.js sắp GHI ĐÈ, rồi liệt kê
 * các file mà vệ tinh đang có nội dung riêng (số dòng chỉ tồn tại ở vệ tinh > 0).
 *
 * Bối cảnh: commit 7ad6984 tại Automation_Carthings (2026-09-16) phải khôi phục tay
 * 179 dòng core/utils/commonUtils.js + 4 dòng core/config/dashboardConfig.js sau khi
 * sync xoá mất. Công cụ này để sync DỪNG LẠI thay vì âm thầm xoá.
 *
 * QUAN TRỌNG: dùng chung MODULES_TO_SYNC + isExcluded() với sync-satellites.js qua
 * scripts/lib/sync-manifest.js. Một bản mô phỏng KHÔNG áp dụng excludes sẽ báo sai
 * (vd. core/local, core/config/dashboardConfig.json vốn không bao giờ bị ghi đè).
 *
 * So sánh theo NỘI DUNG DÒNG, đã chuẩn hoá CRLF/LF và BOM: file chỉ khác kiểu xuống
 * dòng sẽ hiện 0/0 (sync vẫn ghi đè nhưng không mất nội dung nào). Vì vậy con số ở đây
 * có thể lệch vài dòng so với `diff` thuần byte — đó là chủ ý.
 *
 * Cách dùng:
 *   node scripts/pre-sync-drift.js                     # báo cáo, luôn exit 0
 *   node scripts/pre-sync-drift.js --strict            # exit 1 nếu có drift HOẶC không kiểm được
 *   node scripts/pre-sync-drift.js --satellite=CarThings
 *   node scripts/pre-sync-drift.js --satellite-root=/tmp/drift   # CI: <root>/<tên vệ tinh>
 *   node scripts/pre-sync-drift.js --json
 *   node scripts/pre-sync-drift.js --no-history   # tắt phân loại, coi mọi lệch là nội dung riêng
 *
 * PHÂN LOẠI DÒNG SẼ MẤT (xem scripts/lib/hubHistory.js): một dòng "chỉ có ở vệ tinh" có thể
 * là bản CŨ của chính Hub (ghi đè là đúng ý) hoặc nội dung vệ tinh tự viết (ghi đè là mất
 * dữ liệu). Cổng tra lịch sử git của Hub để tách hai nhóm, và CHỈ chặn nhóm thứ hai. Không
 * tách thì mỗi lần Hub bump cache-bust sẽ tự khoá đường sync của chính mình.
 */

const fs = require('fs');
const path = require('path');

const {
  HUB_ROOT,
  SATELLITES,
  MODULES_TO_SYNC,
  ROOT_FILES_TO_SYNC,
  assertNoForbiddenModules,
  resolveExcludes,
  isExcluded,
  moduleOf,
  ALWAYS_DELIVERED_MODULES,
} = require('./lib/sync-manifest');
const { createHubHistoryProbe, classifyLostLines } = require('./lib/hubHistory');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

// Trần an toàn cho LCS chính xác. Đủ cho file lớn nhất hiện tại của Hub
// (dashboard/public/app.js ~16.5k dòng => ~270M ô, chạy trong vài giây).
// Vượt trần thì rơi về xấp xỉ multiset — CHÚ Ý: xấp xỉ có xu hướng ĐẾM THIẾU,
// nên mọi dòng bị nghi ngờ đều được in kèm dấu "(~xap xi)".
const MAX_LCS_CELLS = 400000000;

function splitLines(buf) {
  const text = buf.toString('utf8').replace(/^﻿/, '');
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** Độ dài LCS theo dòng, bộ nhớ O(n) — chỉ cần độ dài, không cần truy vết. */
function lcsLength(a, b) {
  let prev = new Int32Array(b.length + 1);
  let cur = new Int32Array(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    const ai = a[i - 1];
    for (let j = 1; j <= b.length; j += 1) {
      cur[j] = ai === b[j - 1]
        ? prev[j - 1] + 1
        : (prev[j] >= cur[j - 1] ? prev[j] : cur[j - 1]);
    }
    const tmp = prev;
    prev = cur;
    cur = tmp;
    cur.fill(0);
  }
  return prev[b.length];
}

/** Xấp xỉ khi file quá lớn: đếm dòng ở b không khớp được dòng nào ở a (multiset). */
function multisetOnlyInB(a, b) {
  const pool = new Map();
  for (const line of a) pool.set(line, (pool.get(line) || 0) + 1);
  let only = 0;
  for (const line of b) {
    const n = pool.get(line) || 0;
    if (n > 0) pool.set(line, n - 1);
    else only += 1;
  }
  return only;
}

/**
 * Số dòng CHỈ có ở vệ tinh (tương đương `diff --new-line-format` giữa hub và satellite).
 * Cắt phần đầu/đuôi giống nhau trước để LCS chỉ chạy trên vùng thực sự lệch.
 */
function countSatelliteOnlyLines(hubBuf, satBuf) {
  let a = splitLines(hubBuf);
  let b = splitLines(satBuf);

  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head += 1;
  let tail = 0;
  while (
    tail < a.length - head
    && tail < b.length - head
    && a[a.length - 1 - tail] === b[b.length - 1 - tail]
  ) tail += 1;

  a = a.slice(head, a.length - tail);
  b = b.slice(head, b.length - tail);

  if (!b.length) return { satelliteOnly: 0, hubOnly: a.length, exact: true };
  if (!a.length) return { satelliteOnly: b.length, hubOnly: 0, exact: true };

  if (a.length * b.length > MAX_LCS_CELLS) {
    return { satelliteOnly: multisetOnlyInB(a, b), hubOnly: multisetOnlyInB(b, a), exact: false };
  }

  const common = lcsLength(a, b);
  return { satelliteOnly: b.length - common, hubOnly: a.length - common, exact: true };
}

/**
 * Các dòng của vệ tinh KHÔNG còn tồn tại trong bản Hub hiện tại — tức phần thực sự biến mất
 * sau khi ghi đè. Khác với LCS (đo mức xáo trộn): một dòng chỉ bị đổi vị trí vẫn còn nguyên
 * nội dung sau sync, nên không tính là mất.
 */
function lostLines(hubBuf, satBuf) {
  const hub = new Set(splitLines(hubBuf).map((l) => l.trim()));
  const seen = new Set();
  const out = [];
  for (const raw of splitLines(satBuf)) {
    const line = raw.trim();
    if (!line || hub.has(line) || seen.has(line)) continue;
    seen.add(line);
    out.push(line);
  }
  return out;
}

function isBinary(buf) {
  return buf.includes(0);
}

/**
 * Duyệt CÙNG THỨ TỰ và CÙNG LUẬT LOẠI TRỪ như copyDirRecursive():
 * kiểm tra isExcluded(destPath) trước, và với thư mục thì không đệ quy vào.
 */
function walkModule(srcDir, destDir, excludes, out) {
  if (!fs.existsSync(srcDir)) return;

  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (isExcluded(destPath, excludes)) {
      out.skipped.push(destPath);
      continue;
    }

    if (entry.isDirectory()) {
      walkModule(srcPath, destPath, excludes, out);
      continue;
    }
    if (!entry.isFile()) continue;

    if (!fs.existsSync(destPath)) continue; // file mới: sync chỉ thêm, không xoá gì

    const hubBuf = fs.readFileSync(srcPath);
    const satBuf = fs.readFileSync(destPath);
    if (hubBuf.equals(satBuf)) continue;

    out.overwritten.push({ srcPath, destPath, hubBuf, satBuf });
  }
}

function collectSatellite(sat) {
  const targetDir = sat.localPath;
  const out = { overwritten: [], skipped: [] };

  for (const mod of MODULES_TO_SYNC) {
    walkModule(
      path.join(HUB_ROOT, mod.src),
      path.join(targetDir, mod.dest),
      resolveExcludes(targetDir, mod),
      out,
    );
  }

  for (const file of ROOT_FILES_TO_SYNC) {
    const srcPath = path.join(HUB_ROOT, file);
    const destPath = path.join(targetDir, file);
    if (!fs.existsSync(srcPath) || !fs.existsSync(destPath)) continue;
    const hubBuf = fs.readFileSync(srcPath);
    const satBuf = fs.readFileSync(destPath);
    if (hubBuf.equals(satBuf)) continue;
    out.overwritten.push({ srcPath, destPath, hubBuf, satBuf });
  }

  const toRel = (p) => path.relative(targetDir, p).split(path.sep).join('/');

  const files = out.overwritten.map(({ destPath, hubBuf, satBuf }) => {
    const rel = toRel(destPath);
    if (isBinary(hubBuf) || isBinary(satBuf)) {
      return { file: rel, satelliteOnly: 0, hubOnly: 0, binary: true, exact: true, lost: [] };
    }
    const { satelliteOnly, hubOnly, exact } = countSatelliteOnlyLines(hubBuf, satBuf);
    return { file: rel, satelliteOnly, hubOnly, binary: false, exact, lost: lostLines(hubBuf, satBuf) };
  });

  files.sort((x, y) => y.satelliteOnly - x.satelliteOnly || x.file.localeCompare(y.file));
  return { files, skipped: out.skipped.map(toRel) };
}

function main() {
  assertNoForbiddenModules();

  const argv = process.argv.slice(2);
  const strict = argv.includes('--strict');
  const asJson = argv.includes('--json');
  const filterArg = argv.find((a) => a.startsWith('--satellite='));
  const filter = filterArg ? filterArg.split('=')[1].toLowerCase() : null;
  const useHistory = !argv.includes('--no-history');

  // Không tra được lịch sử => classifyLostLines() xếp mọi dòng vào nhóm "riêng", tức cổng
  // tự động lùi về hành vi bảo thủ cũ. Đó là hướng đúng khi thiếu thông tin, nhưng phải NÓI RA:
  // nếu không, người vận hành sẽ tưởng vệ tinh thật sự có nội dung riêng.
  const history = useHistory
    ? createHubHistoryProbe(HUB_ROOT)
    : { everHad: () => false, available: false, shallow: false, reason: 'đã tắt bằng --no-history' };

  // Trên CI không có D:\... — job clone từng vệ tinh vào <root>/<tên vệ tinh> rồi trỏ vào đây.
  const rootArg = argv.find((a) => a.startsWith('--satellite-root='));
  const satelliteRoot = rootArg ? rootArg.slice('--satellite-root='.length) : null;

  const targets = SATELLITES
    .filter((s) => !filter || s.name.toLowerCase().includes(filter))
    .map((s) => (satelliteRoot ? { ...s, localPath: path.join(satelliteRoot, s.name) } : s));
  const report = [];
  let atRisk = 0;
  let behindTotal = 0;
  let missing = 0;

  if (!asJson) {
    console.log(`${colors.cyan}${colors.bright}=====================================================${colors.reset}`);
    console.log(`${colors.cyan}${colors.bright}  PRE-SYNC DRIFT DETECTOR (read-only)                ${colors.reset}`);
    console.log(`${colors.cyan}${colors.bright}=====================================================${colors.reset}`);
    console.log(`${colors.dim}Hub: ${HUB_ROOT}${colors.reset}`);
    if (!history.available) {
      console.log(`${colors.yellow}⚠️  Không phân loại được bản cũ vs nội dung riêng: ${history.reason}${colors.reset}`);
      console.log(`${colors.dim}   => Mọi dòng lệch đều bị coi là nội dung riêng (bảo thủ).${colors.reset}`);
    }
  }

  for (const sat of targets) {
    if (!fs.existsSync(sat.localPath)) {
      missing += 1;
      report.push({ satellite: sat.name, localPath: sat.localPath, available: false, files: [] });
      if (!asJson) {
        console.log('\n-----------------------------------------------------');
        console.log(`🛰️  ${colors.bright}${sat.name}${colors.reset}`);
        console.log(`${colors.yellow}⚠️  Bỏ qua: không có bản sao cục bộ tại ${sat.localPath}${colors.reset}`);
        console.log(`${colors.dim}   (Trên CI hãy clone vệ tinh rồi chạy lại với localPath trỏ vào bản clone.)${colors.reset}`);
      }
      continue;
    }

    const { files, skipped } = collectSatellite(sat);
    for (const f of files) {
      const groups = classifyLostLines(f.file, f.lost || [], history);
      f.staleCount = groups.stale.length;
      f.trivialCount = groups.trivial.length;
      f.ownedLines = groups.owned;
    }
    // "Có nguy cơ" giờ chỉ tính file có dòng Hub CHƯA TỪNG có. File chỉ tụt hậu không còn
    // chặn sync — chính nó là thứ sync sinh ra để sửa.
    // Tách hai nhóm: nội dung riêng nằm trong module Hub sở hữu hoàn toàn (dashboard/) thì
    // vẫn bị ghi đè — đó là thiết kế, không phải sự cố — nhưng vẫn phải liệt kê ra.
    const alwaysOverwritten = files.filter(
      (f) => f.ownedLines.length > 0 && ALWAYS_DELIVERED_MODULES.includes(moduleOf(f.file)),
    );
    const risky = files.filter(
      (f) => f.ownedLines.length > 0 && !ALWAYS_DELIVERED_MODULES.includes(moduleOf(f.file)),
    );
    const behind = files.filter((f) => f.ownedLines.length === 0 && f.satelliteOnly > 0);
    atRisk += risky.length;
    behindTotal += behind.length;
    report.push({ satellite: sat.name, localPath: sat.localPath, available: true, files, skipped });

    if (asJson) continue;

    console.log('\n-----------------------------------------------------');
    console.log(`🛰️  ${colors.bright}${sat.name}${colors.reset}  ${colors.dim}${sat.localPath}${colors.reset}`);
    console.log(`${colors.dim}   Bỏ qua do excludes: ${skipped.length ? skipped.join(', ') : '(không có)'}${colors.reset}`);

    if (!files.length) {
      console.log(`${colors.green}✅ Không có file nào của Hub sẽ ghi đè nội dung khác ở vệ tinh.${colors.reset}`);
      continue;
    }

    const width = Math.max(4, ...files.map((f) => f.file.length));
    console.log(`
   ${'FILE'.padEnd(width)}  ${'SAT-ONLY'.padStart(8)}  ${'HUB-ONLY'.padStart(8)}  ${'BAN-CU'.padStart(7)}  ${'RIENG'.padStart(6)}`);
    console.log(`   ${'-'.repeat(width)}  ${'-'.repeat(8)}  ${'-'.repeat(8)}  ${'-'.repeat(7)}  ${'-'.repeat(6)}`);
    for (const f of files) {
      const mark = f.binary ? ' (binary)' : (f.exact ? '' : ' (~xap xi)');
      const owned = f.ownedLines.length;
      const line = `   ${f.file.padEnd(width)}  ${String(f.satelliteOnly).padStart(8)}  ${String(f.hubOnly).padStart(8)}`
        + `  ${String(f.staleCount).padStart(7)}  ${String(owned).padStart(6)}${mark}`;
      if (owned > 0) console.log(`${colors.red}${line}${colors.reset}`);
      else if (f.satelliteOnly > 0) console.log(`${colors.yellow}${line}${colors.reset}`);
      else console.log(`${colors.dim}${line}${colors.reset}`);
    }

    console.log('');
    if (behind.length) {
      console.log(`${colors.yellow}↻ ${behind.length} file chỉ là BẢN CŨ của Hub — ghi đè là đúng mục đích sync.${colors.reset}`);
    }
    if (alwaysOverwritten.length) {
      console.log(`${colors.yellow}⚠️  ${alwaysOverwritten.length} file trong ${ALWAYS_DELIVERED_MODULES.join(', ')}/ sẽ bị GHI ĐÈ (vùng Hub sở hữu hoàn toàn):${colors.reset}`);
      for (const f of alwaysOverwritten) {
        console.log(`${colors.yellow}   ${f.file} (${f.ownedLines.length} dòng riêng)${colors.reset}`);
      }
      console.log(`${colors.dim}   Sync KHÔNG dừng vì việc này: giữ lại dashboard/ sẽ chặn luôn mọi tính năng mới.${colors.reset}`);
    }
    if (risky.length) {
      console.log(`${colors.red}${colors.bright}❌ ${risky.length} file có nội dung Hub CHƯA TỪNG CÓ và sẽ bị sync xoá:${colors.reset}`);
      for (const f of risky) {
        console.log(`${colors.red}   ${f.file}${colors.reset}`);
        for (const l of f.ownedLines.slice(0, 8)) {
          console.log(`${colors.dim}      | ${l.length > 120 ? `${l.slice(0, 117)}...` : l}${colors.reset}`);
        }
        if (f.ownedLines.length > 8) {
          console.log(`${colors.dim}      | ... còn ${f.ownedLines.length - 8} dòng${colors.reset}`);
        }
      }
      console.log(`${colors.yellow}   → Chuyển phần riêng sang core/local/ (xem core/local/README.md), hoặc đưa ngược lên Hub nếu dùng chung được.${colors.reset}`);
    } else {
      console.log(`${colors.green}✅ Không có nội dung riêng nào bị mất; sync an toàn.${colors.reset}`);
    }
  }

  if (asJson) {
    console.log(JSON.stringify({
      hubRoot: HUB_ROOT,
      strict,
      atRisk,
      behind: behindTotal,
      historyAvailable: history.available,
      historyReason: history.reason,
      satellites: report,
    }, null, 2));
  } else {
    console.log(`
${colors.bright}Tổng kết: ${atRisk} file có nội dung riêng sẽ mất; ${behindTotal} file chỉ tụt hậu (ghi đè an toàn); ${missing} vệ tinh không kiểm tra được.${colors.reset}`);
  }

  // --strict cũng fail khi có vệ tinh KHÔNG kiểm tra được: một cổng chặn im lặng bỏ qua
  // vệ tinh vắng mặt thì vô dụng đúng vào lúc cần nhất (CI không có bản sao cục bộ).
  if (strict && (atRisk > 0 || missing > 0)) {
    if (!asJson) {
      const why = atRisk > 0
        ? `${atRisk} file có nội dung riêng sẽ bị xoá`
        : `${missing} vệ tinh không kiểm tra được`;
      console.error(`${colors.red}${colors.bright}STRICT: dừng tiến trình sync (${why}).${colors.reset}`);
    }
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

/**
 * Kiểm một vệ tinh và trả về danh sách file có nội dung RIÊNG sẽ bị xoá.
 * Dùng chung bởi CLI ở trên và bởi scripts/sync-satellites.js, để cổng chặn trước khi ghi
 * và báo cáo của CLI không bao giờ nói hai điều khác nhau.
 *
 * @param {{localPath: string}} sat
 * @param {ReturnType<createHubHistoryProbe>} history
 */
function auditSatellite(sat, history) {
  const { files, skipped } = collectSatellite(sat);
  const blocked = [];
  for (const f of files) {
    const groups = classifyLostLines(f.file, f.lost || [], history);
    f.staleCount = groups.stale.length;
    f.trivialCount = groups.trivial.length;
    f.ownedLines = groups.owned;
    if (groups.owned.length) blocked.push(f);
  }
  return { files, skipped, blocked };
}

module.exports = {
  countSatelliteOnlyLines,
  collectSatellite,
  walkModule,
  splitLines,
  lostLines,
  auditSatellite,
};
