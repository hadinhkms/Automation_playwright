'use strict';

/**
 * tools/qa/lib/sourcesMarkdown.js
 * Đọc và phân tích requirements/*.md (YAML front-matter phẳng, AC headings, bảng Rules).
 * Không dùng dependency ngoài.
 */

const fs = require('node:fs');
const path = require('node:path');

const RE_AC_HEADING = /^\s{0,3}#{2,6}\s*(AC-\d{3})\b\s*[:\-–—]?\s*(.*?)\s*$/;
const RE_ID_NEAR_MISS = /^\s{0,3}#{2,6}\s*((?:AC|TC|REQ)[-_]?\d{1,4})\b/i;
const RE_ID_CANONICAL = /^(AC|TC|REQ)-\d{3}$/;

const AUTOMATION_ALIASES = new Map([
  ['yes', 'Yes'], ['co', 'Yes'], ['có', 'Yes'], ['done', 'Yes'],
  ['no', 'No'], ['khong', 'No'], ['không', 'No'], ['manual', 'No'],
  ['thu cong', 'No'], ['thủ công', 'No'], ['n/a', 'No'],
  ['candidate', 'Candidate'], ['ung vien', 'Candidate'], ['ứng viên', 'Candidate'],
  ['planned', 'Candidate'], ['todo', 'Candidate'],
]);

/** Đọc file và chuẩn hoá CRLF + BOM. Repo Windows rất hay có CRLF. */
function readText(file) {
  return fs
    .readFileSync(file, 'utf8')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n');
}

/** Front-matter phẳng `key: value`. Đủ dùng và không cần thư viện YAML. */
function parseFrontMatter(text) {
  if (!text.startsWith('---')) return { data: {}, body: text, offset: 0 };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { data: {}, body: text, offset: 0 };
  const raw = text.slice(3, end);
  const body = text.slice(end + 4);
  const data = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Za-z0-9_]+)\s*:\s*(.*)$/);
    if (m) data[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return { data, body, offset: text.slice(0, end + 4).split('\n').length - 1 };
}

function normalizeAutomation(raw) {
  const original = String(raw || '').trim();
  const undecorated = original.replace(/[*`_~]/g, '').trim();
  const cleaned = undecorated
    .replace(/[^\p{L}\p{N}\/ ]/gu, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!cleaned) return { value: undecorated ? null : '', raw: original };
  const hit = AUTOMATION_ALIASES.get(cleaned);
  return { value: hit || null, raw: original };
}

/** Tách các dòng dữ liệu của bảng markdown nằm dưới một heading. */
function tableRowsUnder(lines, headingRe) {
  const out = [];
  let inSection = false;
  for (const line of lines) {
    if (/^#{2,3}\s/.test(line)) inSection = headingRe.test(line);
    if (!inSection) continue;
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;
    if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
    out.push(cells);
  }
  return out;
}

function listMarkdown(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.md') && f.toLowerCase() !== 'readme.md')
    .map((f) => path.join(dir, f));
}

/** requirements/*.md -> [{ id, title, status, acs: [...], rules: [...] }] */
function loadRequirements(root, options = {}) {
  const reqs = [];
  const dir = options.requirementsDir || 'requirements';
  for (const file of listMarkdown(path.join(root, dir))) {
    const text = readText(file);
    const { data, body, offset } = parseFrontMatter(text);
    const rel = path.relative(root, file).replace(/\\/g, '/');
    if (!data.id) {
      reqs.push({ id: null, file: rel, missingFrontMatter: true, acs: [], rules: [] });
      continue;
    }
    const lines = body.split('\n');
    const acs = [];
    const nearMisses = [];
    lines.forEach((line, i) => {
      const m = line.match(RE_AC_HEADING);
      if (m) {
        acs.push({ id: m[1], title: m[2], line: i + 1 + (offset || 0) });
        return;
      }
      const near = line.match(RE_ID_NEAR_MISS);
      if (near && !RE_ID_CANONICAL.test(near[1])) {
        nearMisses.push({ raw: near[1], line: i + 1 + (offset || 0) });
      }
    });
    const rules = tableRowsUnder(lines, /Rules and validation/i)
      .filter((cells) => !/^Field\/rule$/i.test(cells[0]))
      .map((cells) => ({
        field: cells[0],
        valid: cells[1] || '',
        invalid: cells[2] || '',
        boundary: cells[3] || '',
        expected: cells[4] || '',
        testCases: (cells[5] || '').match(/TC-\d{3}/g) || [],
      }));
    reqs.push({
      id: data.id,
      title: data.title || '',
      status: data.status || 'Unknown',
      version: data.version || '',
      risk: data.risk || '',
      owner: data.owner || '',
      testCaseFile: data.test_cases || '',
      file: rel,
      acs,
      nearMisses,
      rules,
    });
  }
  return reqs;
}

module.exports = {
  readText,
  parseFrontMatter,
  normalizeAutomation,
  tableRowsUnder,
  listMarkdown,
  loadRequirements,
};

