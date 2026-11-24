/**
 * dashboard/public/js/views/runner/picker/pickerQuick.js
 * The "Chọn nhanh" row (HANDOFF 6): history chips (Fail lần trước, Chạy gần đây) and suite chips, plus the
 * history status lines (S5 no history, S5b load error, S5c nothing failed). Quick chips REPLACE the selection.
 */
import { escapeHtml } from './pickerText.js';
import { recentSets, runLabel } from './pickerHistory.js';

/** Single suites with an explicit file list or "all"; composite (parent) suites are not chips. */
export function quickSuites(suites = {}) {
  return Object.entries(suites)
    .filter(([, s]) => s && s.type !== 'composite' && ((Array.isArray(s.specs) && s.specs.length) || s.specs === 'all'))
    .map(([key, s]) => ({ key, label: s.label || key, specs: s.specs, grep: s.grep || '', project: s.project || '' }));
}

const sizeOf = (s, catalog) => (s.specs === 'all' ? catalog.files.length : s.specs.filter((p) => catalog.byPath.has(p)).length);

function suiteChips(list, catalog) {
  if (!list.length) return '';
  const one = (s) => `<button type="button" class="sp-chip sp-chip-quick" data-suite="${escapeHtml(s.key)}"><i class="ph-bold ph-stack" aria-hidden="true"></i>Suite: ${escapeHtml(s.label)} (${sizeOf(s, catalog)})</button>`;
  const more = list.length > 3 ? `<details class="sp-more"><summary>Thêm suite</summary>${list.slice(3).map(one).join('')}</details>` : '';
  return `${list.slice(0, 3).map(one).join('')}${more}`;
}

function failChip(h) {
  const n = h.latest.specs.length;
  const off = h.error || !h.latest.run || n === 0;
  return `<button type="button" class="sp-chip sp-chip-quick" data-history="fail"${off ? ' disabled aria-disabled="true"' : ''}><i class="ph-bold ph-arrow-counter-clockwise" aria-hidden="true"></i>Fail lần trước (${h.error ? 0 : n})</button>`;
}

function recentChip(h, now) {
  const sets = h.error ? [] : recentSets(h.runs);
  if (!sets.length) return '<button type="button" class="sp-chip sp-chip-quick" data-history="recent" disabled aria-disabled="true"><i class="ph-bold ph-clock-counter-clockwise" aria-hidden="true"></i>Chạy gần đây</button>';
  const items = sets.map((r) => `<button type="button" class="sp-link sp-recent-item" data-history-run="${escapeHtml(r.id)}">${escapeHtml(runLabel(r, now))}</button>`).join('');
  return `<details class="sp-more sp-recent"><summary class="sp-chip sp-chip-quick"><i class="ph-bold ph-clock-counter-clockwise" aria-hidden="true"></i>Chạy gần đây</summary><div class="sp-recent-list">${items}</div></details>`;
}

function historyLine(h) {
  if (h.error) return '<p class="sp-hint sp-warn" role="status"><i class="ph-bold ph-warning" aria-hidden="true"></i> Không tải được lịch sử chạy. <button type="button" class="sp-link" data-act="history-retry">Thử lại</button></p>';
  if (!h.runs.length) return '<p class="sp-hint">Chưa có lịch sử chạy. Chạy một lần để thấy “Fail lần trước” và “Gần đây”.</p>';
  if (!h.latest.run) return '<p class="sp-hint">Lần chạy trước không có script nào fail.</p>';
  if (!h.latest.specs.length) return '<p class="sp-hint">Các script fail ở lần chạy trước đã bị xoá khỏi dự án.</p>';
  return '';
}

export function renderQuickRow({ catalog, suites, history, now = Date.now() }) {
  const list = quickSuites(suites);
  const hist = history.loaded ? `${failChip(history)}${recentChip(history, now)}` : '';
  if (!hist && !list.length) return '';
  return `<div class="sp-quick" role="group" aria-label="Chọn nhanh"><span class="sp-grouplabel">Chọn nhanh</span>${hist}${suiteChips(list, catalog)}</div>${history.loaded ? historyLine(history) : ''}`;
}
