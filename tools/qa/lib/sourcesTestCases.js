'use strict';

/**
 * tools/qa/lib/sourcesTestCases.js
 * Đọc test-cases/*.md -> bảng Traceability / Bảng truy vết, chi tiết TC và lý do không automation.
 */

const path = require('node:path');
const {
  readText,
  normalizeAutomation,
  tableRowsUnder,
  listMarkdown,
} = require('./sourcesMarkdown');

const RE_TC_HEADING = /^\s{0,3}#{2,6}\s*(TC-\d{3})\b\s*[:\-–—]?\s*(.*?)\s*$/;

/** test-cases/*.md -> [{ reqId, acId, tcId, automation, spec, priority }] + chi tiết TC */
function loadTestCases(root, options = {}) {
  const dir = options.testCasesDir || 'test-cases';
  const links = [];
  const nearMisses = [];
  const details = [];
  const noAutomationReasons = new Set();

  for (const file of listMarkdown(path.join(root, dir))) {
    const base = path.basename(file).toLowerCase();
    if (base === 'traceability.md') continue;
    const text = readText(file);
    const rel = path.relative(root, file).replace(/\\/g, '/');
    const lines = text.split('\n');

    const baseReqMatch = base.match(/^(REQ-\d{3})/i);
    const defaultReqId = baseReqMatch ? baseReqMatch[1].toUpperCase() : null;

    let rowIdx = 0;
    for (const cells of tableRowsUnder(lines, /^##\s+(?:Traceability|Bảng truy vết)/i)) {
      rowIdx++;
      if (/^REQ-\d{3}$/i.test(cells[0] || '')) {
        const [reqId, acId, tcId, automation, spec, priority] = cells;
        const auto = normalizeAutomation(automation);
        links.push({
          reqId: reqId.toUpperCase(),
          acId,
          tcId,
          automation: auto.value,
          automationRaw: auto.raw,
          spec: (spec || '').replace(/`/g, '').trim(),
          priority: (priority || '').trim(),
          file: rel,
          rowId: `${rel}:${rowIdx}`,
        });
      } else if (/^TC-\d{3}$/i.test(cells[0] || '')) {
        const tcId = cells[0];
        const acsFound = (cells[1] || '').match(/AC-\d{3}/gi) || [];
        const priority = (cells[3] || '').trim();
        const auto = normalizeAutomation(cells[4]);
        const spec = (cells[5] || '').replace(/`/g, '').trim();

        if (acsFound.length === 0 && defaultReqId) {
          links.push({
            reqId: defaultReqId,
            acId: '',
            tcId,
            automation: auto.value,
            automationRaw: auto.raw,
            spec,
            priority,
            file: rel,
            rowId: `${rel}:${rowIdx}`,
          });
        } else {
          for (const rawAc of acsFound) {
            links.push({
              reqId: defaultReqId || '',
              acId: rawAc.toUpperCase(),
              tcId,
              automation: auto.value,
              automationRaw: auto.raw,
              spec,
              priority,
              file: rel,
              rowId: `${rel}:${rowIdx}`,
            });
          }
        }
      } else {
        const looksLikeData =
          /^req[-_ ]?\d+/i.test(cells[0] || '') || /^tc[-_]?\d+/i.test(cells[0] || '');
        if (looksLikeData) nearMisses.push({ raw: cells.slice(0, 3).join(' | '), file: rel });
      }
    }

    for (const cells of tableRowsUnder(lines, /Case không automation/i)) {
      const m = (cells[0] || '').match(/TC-\d{3}/);
      if (m && (cells[1] || '').trim()) noAutomationReasons.add(m[0]);
    }

    lines.forEach((line, i) => {
      const m = line.match(RE_TC_HEADING);
      if (m) details.push({ tcId: m[1], title: m[2], file: rel, line: i + 1 });
    });
  }
  return { links, details, noAutomationReasons, nearMisses };
}

module.exports = { loadTestCases };
