'use strict';

/**
 * Lõi truy vết REQ -> AC -> TC -> spec. Hàm thuần, không I/O ngoài đọc file, không ghi gì.
 *
 * Phân công: chuẩn viết requirement/test case (template, quy tắc, ví dụ) thuộc repo
 * `hadinhkms/Support_doc_n_TestCase`. File này KHÔNG định nghĩa lại chuẩn đó — nó chỉ đọc
 * đúng những định danh mà chuẩn quy định và trả lời ba câu hỏi bằng máy:
 *
 *   1. Nghiệp vụ nào đã ghi nhận mà chưa có test case?      -> ac-khong-co-tc
 *   2. Test case nào đã viết mà chưa có script?             -> tc-chua-automation  (= ứng viên automation)
 *   3. Script nào đang chạy mà không truy về được nghiệp vụ? -> spec-khong-truy-vet
 *
 * Câu 3 là cái bắt "missing business": một spec không gắn `@REQ-xxx` nghĩa là hành vi nó
 * kiểm chứng không nằm trong tài liệu nào — hoặc tài liệu thiếu, hoặc spec thừa.
 *
 * Quy ước định danh (xem ai/shared/AI_PROMPTS.md mục 3):
 *   requirements/REQ-xxx-<slug>.md   chứa các `AC-yyy`
 *   test-cases/REQ-xxx-<slug>.md     chứa các `TC-zzz` kèm AC liên quan và priority
 *   tests/**\/*.spec.js               `test.describe('... @REQ-xxx')`
 *                                     `test('TC-zzz - AC-yyy <mô tả> @smoke')`
 */

const fs = require('fs');
const path = require('path');

const RE_REQ = /\bREQ-(\d{3})\b/g;
const RE_AC = /\bAC-(\d{3})\b/g;
const RE_TC = /\bTC-(\d{3})\b/g;
const RE_PRIORITY = /\bP([0-3])\b/;

// Cột "Automation" trong bảng traceability. Một TC khai KHÔNG automation là quyết định có chủ ý
// (kiểm tra thị giác, phụ thuộc bên thứ ba, chạy một lần rồi thôi) — cổng không được báo động mãi
// về nó, nếu không người ta sẽ quen với màu đỏ rồi bỏ qua cả cảnh báo thật.
const AUTOMATION_NO = new Set(['no', 'khong', 'không', 'manual', 'thu cong', 'thủ công', 'n/a']);
const AUTOMATION_CANDIDATE = new Set(['candidate', 'ung vien', 'ứng viên', 'planned', 'todo']);

function readAutomationColumn(line) {
  for (const cell of line.split('|').map((c) => c.trim().toLowerCase())) {
    if (AUTOMATION_NO.has(cell)) return 'no';
    if (AUTOMATION_CANDIDATE.has(cell)) return 'candidate';
    if (cell === 'yes' || cell === 'co' || cell === 'có') return 'yes';
  }
  return null;
}

const DEFAULT_DIRS = {
  requirements: 'requirements',
  testCases: 'test-cases',
  specs: 'tests',
};

function listFiles(root, relativeDir, filter) {
  const absolute = path.join(root, relativeDir);
  if (!fs.existsSync(absolute)) return [];
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && filter(entry.name)) out.push(full);
    }
  };
  walk(absolute);
  return out.map((p) => path.relative(root, p).split(path.sep).join('/'));
}

function uniqueMatches(text, regex) {
  const found = new Set();
  for (const m of text.matchAll(regex)) found.add(m[0]);
  return [...found];
}

/** Bỏ khối code để không nhặt nhầm định danh nằm trong ví dụ code của tài liệu. */
function stripCodeBlocks(markdown) {
  return markdown.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
}

function parseRequirements(root, dir) {
  const files = listFiles(root, dir, (n) => n.endsWith('.md') && n.toUpperCase() !== 'README.MD');
  const requirements = new Map();

  for (const file of files) {
    const text = stripCodeBlocks(fs.readFileSync(path.join(root, file), 'utf8'));
    const reqIds = uniqueMatches(text, RE_REQ);
    if (!reqIds.length) continue;
    const primary = reqIds[0];
    const existing = requirements.get(primary) || { id: primary, files: [], acs: [] };
    existing.files.push(file);
    existing.acs = [...new Set([...existing.acs, ...uniqueMatches(text, RE_AC)])];
    requirements.set(primary, existing);
  }
  return { files, requirements };
}

function parseTestCases(root, dir) {
  const files = listFiles(root, dir, (n) => n.endsWith('.md') && n.toUpperCase() !== 'README.MD');
  const testCases = new Map();

  for (const file of files) {
    const raw = fs.readFileSync(path.join(root, file), 'utf8');
    const text = stripCodeBlocks(raw);
    const fileReq = uniqueMatches(text, RE_REQ)[0] || null;

    // Mỗi dòng chứa TC-xxx được coi là một khai báo test case; AC và priority lấy trên cùng dòng.
    for (const line of text.split(/\r?\n/)) {
      const tcIds = uniqueMatches(line, RE_TC);
      if (!tcIds.length) continue;
      const acOnLine = uniqueMatches(line, RE_AC);
      const priorityMatch = RE_PRIORITY.exec(line);
      for (const tc of tcIds) {
        // Một TC thường xuất hiện ở nhiều nơi: bảng traceability (có AC + priority),
        // automation plan, phần mô tả chi tiết. GỘP chứ không để bản gặp trước thắng —
        // nếu không, thứ tự đọc thư mục sẽ quyết định dữ liệu nào bị mất.
        const existing = testCases.get(tc) || {
          id: tc, req: null, acs: [], priority: null, automation: null, file, files: [], title: '',
        };
        existing.automation = existing.automation || readAutomationColumn(line);
        existing.req = existing.req || uniqueMatches(line, RE_REQ)[0] || fileReq;
        existing.acs = [...new Set([...existing.acs, ...acOnLine])];
        existing.priority = existing.priority || (priorityMatch ? `P${priorityMatch[1]}` : null);
        if (!existing.files.includes(file)) existing.files.push(file);
        // Ưu tiên giữ dòng có AC làm title, vì đó là dòng khai báo chính thức.
        if (!existing.title || (acOnLine.length && !RE_AC.test(existing.title))) {
          existing.title = line.trim().slice(0, 160);
          existing.file = file;
        }
        RE_AC.lastIndex = 0;
        testCases.set(tc, existing);
      }
    }
  }
  return { files, testCases };
}

function parseSpecs(root, dir) {
  const files = listFiles(root, dir, (n) => n.endsWith('.spec.js') || n.endsWith('.spec.ts'));
  const specs = [];

  for (const file of files) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    const describeTitles = [...text.matchAll(/\btest\.describe\s*\(\s*(['"`])([\s\S]*?)\1/g)].map((m) => m[2]);
    const testTitles = [...text.matchAll(/(?<!\.)\btest\s*\(\s*(['"`])([\s\S]*?)\1/g)].map((m) => m[2]);

    const reqs = [...new Set(describeTitles.concat(testTitles).flatMap((t) => uniqueMatches(t, RE_REQ)))];
    const tcs = [...new Set(testTitles.flatMap((t) => uniqueMatches(t, RE_TC)))];
    const acs = [...new Set(testTitles.flatMap((t) => uniqueMatches(t, RE_AC)))];

    specs.push({ file, reqs, tcs, acs, testCount: testTitles.length });
  }
  return { files, specs };
}

/**
 * @param {{root?: string, dirs?: object}} options
 * @returns báo cáo truy vết đầy đủ, không ném lỗi khi tài liệu chưa tồn tại.
 */
function buildTraceReport({ root = process.cwd(), dirs = {} } = {}) {
  const d = { ...DEFAULT_DIRS, ...dirs };

  const hasRequirements = fs.existsSync(path.join(root, d.requirements));
  const hasTestCases = fs.existsSync(path.join(root, d.testCases));

  const { requirements } = parseRequirements(root, d.requirements);
  const { testCases } = parseTestCases(root, d.testCases);
  const { specs } = parseSpecs(root, d.specs);

  const allAcs = new Set();
  for (const req of requirements.values()) req.acs.forEach((ac) => allAcs.add(ac));

  const acsCoveredByTc = new Set();
  for (const tc of testCases.values()) tc.acs.forEach((ac) => acsCoveredByTc.add(ac));

  const tcsInSpecs = new Set();
  const reqsInSpecs = new Set();
  for (const s of specs) {
    s.tcs.forEach((tc) => tcsInSpecs.add(tc));
    s.reqs.forEach((r) => reqsInSpecs.add(r));
  }

  const findings = [];

  // 1. Nghiệp vụ đã ghi nhận nhưng chưa ai thiết kế test case.
  for (const ac of [...allAcs].sort()) {
    if (!acsCoveredByTc.has(ac)) {
      const owner = [...requirements.values()].find((r) => r.acs.includes(ac));
      findings.push({
        kind: 'ac-khong-co-tc',
        severity: 'major',
        id: ac,
        detail: `${ac} (thuộc ${owner ? owner.id : '?'}) chưa có test case nào trong ${d.testCases}/`,
      });
    }
  }

  // 2. Test case đã viết nhưng chưa có script -> ứng viên automation.
  //    Trừ TC đã khai rõ là cố ý không automation: ghi ở mức info, không tính là nợ.
  const candidates = [];
  for (const tc of [...testCases.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    if (tcsInSpecs.has(tc.id)) continue;

    if (tc.automation === 'no') {
      findings.push({
        kind: 'tc-co-y-thu-cong',
        severity: 'info',
        id: tc.id,
        detail: `${tc.id}${tc.priority ? ` (${tc.priority})` : ''} khai rõ không automation — giữ nguyên, không tính là nợ`,
      });
      continue;
    }

    candidates.push(tc);
    findings.push({
      kind: 'tc-chua-automation',
      severity: tc.priority === 'P0' || tc.priority === 'P1' ? 'major' : 'minor',
      id: tc.id,
      detail: `${tc.id}${tc.priority ? ` (${tc.priority})` : ''} chưa có spec nào tham chiếu tới`,
    });
  }

  // 3. Spec đang chạy mà không truy về được nghiệp vụ nào -> nguy cơ missing business.
  for (const s of specs) {
    if (s.reqs.length === 0) {
      findings.push({
        kind: 'spec-khong-truy-vet',
        severity: hasRequirements ? 'major' : 'info',
        id: s.file,
        detail: `${s.file}: test.describe thiếu tag @REQ-xxx`,
      });
    }
  }

  // 4. Spec trỏ tới định danh không tồn tại trong tài liệu.
  for (const s of specs) {
    for (const r of s.reqs) {
      if (!requirements.has(r)) {
        findings.push({
          kind: 'dinh-danh-khong-ton-tai',
          severity: hasRequirements ? 'major' : 'info',
          id: r,
          detail: `${s.file} tham chiếu ${r} nhưng ${d.requirements}/ không có requirement này`,
        });
      }
    }
    for (const tc of s.tcs) {
      if (!testCases.has(tc)) {
        findings.push({
          kind: 'dinh-danh-khong-ton-tai',
          severity: hasTestCases ? 'major' : 'info',
          id: tc,
          detail: `${s.file} tham chiếu ${tc} nhưng ${d.testCases}/ không có test case này`,
        });
      }
    }
  }

  const bootstrap = !hasRequirements && !hasTestCases;

  return {
    root,
    dirs: d,
    hasRequirements,
    hasTestCases,
    bootstrap,
    counts: {
      requirements: requirements.size,
      acceptanceCriteria: allAcs.size,
      testCases: testCases.size,
      specs: specs.length,
      specsWithoutTrace: specs.filter((s) => s.reqs.length === 0).length,
    },
    requirements: [...requirements.values()],
    testCases: [...testCases.values()],
    specs,
    candidates,
    findings,
  };
}

/** Ứng viên automation đã xếp hạng: P0 trước, rồi theo ID. */
function rankAutomationCandidates(report, limit = 7) {
  const weight = { P0: 0, P1: 1, P2: 2, P3: 3 };
  return [...report.candidates]
    .sort((a, b) => (weight[a.priority] ?? 9) - (weight[b.priority] ?? 9) || a.id.localeCompare(b.id))
    .slice(0, limit);
}

module.exports = {
  DEFAULT_DIRS,
  buildTraceReport,
  rankAutomationCandidates,
  parseRequirements,
  parseTestCases,
  parseSpecs,
  stripCodeBlocks,
};
